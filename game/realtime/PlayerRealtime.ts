// playerRealTime.ts
// Supabase realtime networking for player positions.
// - Connects to a room channel
// - Throttles + broadcasts local positions
// - Broadcasts player meta (name, character) on join & on meta-requests
// - Handshakes: new client sends "meta-req", others reply with "player-meta"
// - Receives remote positions -> per-player bounded queues
// - Exposes queues + meta + subscription helpers
// playerRealTime.ts
import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/utils/supabase/client";

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    destroyRealtime();
  });
  window.addEventListener("pagehide", () => {
    destroyRealtime();
  });
}

export type PlayerMeta = {
  userId: string;
  name?: string;
  character?: string;
};

export type PlayerPosPayload = {
  userId: string;
  x: number;
  y: number;
  ts: number;
  name?: string;
  character?: string;
};

type PositionSample = { x: number; y: number; ts: number };
type QueueMap = Map<string, PositionSample[]>;
type PlayerMetaInfo = { name?: string; character?: string };

// --- State ---
let channel: RealtimeChannel | null = null;
let roomIdRef: string | null = null;
let playerIdRef: string | null = null;
let myMetaRef: PlayerMetaInfo = {};

const positionQueues: QueueMap = new Map();
const metaCache = new Map<string, PlayerMetaInfo>();

// Subscribers
type UpdateCb = (playerId: string, pos: PositionSample) => void;
const updateSubscribers = new Set<UpdateCb>();
const metaSubscribers = new Set<(playerId: string, meta: PlayerMetaInfo) => void>();

// --- Throttle ---
const SEND_HZ = 15;
const SEND_INTERVAL_MS = Math.floor(1000 / SEND_HZ);
let lastSentAt = 0;
let lastPending: { x: number; y: number } | null = null;
let sendTimer: ReturnType<typeof setTimeout> | null = null;

// --- Audio / WebRTC ---
let localStream: MediaStream | null = null;
const peerConnections = new Map<string, RTCPeerConnection>();
const audioElements = new Map<string, HTMLAudioElement>();

async function initAudio() {
  if (!localStream) {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  }
}

async function createPeerConnection(remoteId: string) {
  if (peerConnections.has(remoteId)) return peerConnections.get(remoteId)!;

  const pc = new RTCPeerConnection();

  if (localStream) {
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream!));
  }

  pc.ontrack = (event) => {
    let audio = audioElements.get(remoteId);
    if (!audio) {
      audio = document.createElement("audio");
      audio.autoplay = true;
      document.body.appendChild(audio);
      audioElements.set(remoteId, audio);
    }
    audio.srcObject = event.streams[0];
  };

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      safeSend("webrtc-candidate", {
        from: playerIdRef,
        to: remoteId,
        candidate: event.candidate,
      });
    }
  };

  peerConnections.set(remoteId, pc);
  return pc;
}

async function handleOffer(from: string, sdp: any) {
  const pc = await createPeerConnection(from);
  await pc.setRemoteDescription(new RTCSessionDescription(sdp));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  safeSend("webrtc-answer", { from: playerIdRef, to: from, sdp: answer });
}

async function handleAnswer(from: string, sdp: any) {
  const pc = await createPeerConnection(from);
  await pc.setRemoteDescription(new RTCSessionDescription(sdp));
}

async function handleCandidate(from: string, candidate: any) {
  const pc = await createPeerConnection(from);
  try {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (err) {
    console.warn("Error adding ICE candidate", err);
  }
}

async function callPlayer(remoteId: string) {
  const pc = await createPeerConnection(remoteId);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  safeSend("webrtc-offer", { from: playerIdRef, to: remoteId, sdp: offer });
}

// --- Utils ---

const AUDIO_RANGE = 100; // pixels

function updateAudioVolumes(myPos: { x: number; y: number }) {
  for (const [otherId, queue] of positionQueues) {
    if (otherId === playerIdRef) continue;
    const latest = queue[queue.length - 1];
    if (!latest) continue;

    const dx = myPos.x - latest.x;
    const dy = myPos.y - latest.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const audio = audioElements.get(otherId);
    if (!audio) continue;

    audio.volume = dist <= AUDIO_RANGE ? 1 : 0;
  }
}

function pushToQueue(playerId: string, sample: PositionSample) {
  const q = positionQueues.get(playerId) ?? [];
  q.push(sample);
  if (q.length > 8) q.shift();
  positionQueues.set(playerId, q);
}

function safeSend(event: string, payload: Record<string, any>) {
  if (!channel) return;
  try {
    channel.send({ type: "broadcast", event, payload });
  } catch {}
}

// --- Init ---
export async function initRealtime(opts: {
  roomId: string;
  playerId: string;
  meta?: PlayerMetaInfo;
}): Promise<void> {
  const { roomId, playerId, meta } = opts;
  roomIdRef = roomId;
  playerIdRef = playerId;
  myMetaRef = { ...(meta ?? {}) };

  if (channel) {
    try {
      await channel.unsubscribe();
    } catch {}
  }
  channel = null;

  channel = supabase.channel(`room:${roomId}`, {
    config: { broadcast: { self: false } },
  });

  // --- Position updates ---
  channel.on("broadcast", { event: "player-pos" }, (payload) => {
    const data = payload.payload as { playerId: string; x: number; y: number; ts?: number };
    if (!data?.playerId || data.playerId === playerIdRef) return;
    const sample: PositionSample = { x: data.x, y: data.y, ts: data.ts ?? Date.now() };
    pushToQueue(data.playerId, sample);
    updateSubscribers.forEach((cb) => cb(data.playerId, sample));

    if (playerIdRef) {
      const myQueue = positionQueues.get(playerIdRef);
      const myPos = myQueue?.[myQueue.length - 1];
      if (myPos) {
        updateAudioVolumes(myPos);
      }
    }
  });

  // --- Meta updates ---
  channel.on("broadcast", { event: "player-meta" }, (payload) => {
    const data = payload.payload as { playerId: string; name?: string; character?: string };
    if (!data?.playerId || data.playerId === playerIdRef) return;
    const next: PlayerMetaInfo = { name: data.name, character: data.character };
    metaCache.set(data.playerId, next);
    metaSubscribers.forEach((cb) => cb(data.playerId, next));

    if (playerIdRef && playerIdRef > data.playerId) {
      callPlayer(data.playerId);
    }
  });

  // --- Meta request (handshake) ---
  channel.on("broadcast", { event: "meta-req" }, (payload) => {
    const data = payload.payload as { from?: string };
    if (data?.from && data.from === playerIdRef) return;
    if (playerIdRef) {
      safeSend("player-meta", { playerId: playerIdRef, ...myMetaRef });
    }
  });

  // --- WebRTC signaling ---
  channel.on("broadcast", { event: "webrtc-offer" }, (payload) => {
    const { from, sdp } = payload.payload;
    if (from !== playerIdRef) handleOffer(from, sdp);
  });

  channel.on("broadcast", { event: "webrtc-answer" }, (payload) => {
    const { from, sdp } = payload.payload;
    if (from !== playerIdRef) handleAnswer(from, sdp);
  });

  channel.on("broadcast", { event: "webrtc-candidate" }, (payload) => {
    const { from, candidate } = payload.payload;
    if (from !== playerIdRef) handleCandidate(from, candidate);
  });

  // --- Subscribe ---
  await channel.subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      await initAudio();
      if (myMetaRef && (myMetaRef.name || myMetaRef.character)) {
        sendPlayerMeta(myMetaRef);
      }
      safeSend("meta-req", { from: playerIdRef });

      metaCache.forEach((_, otherId) => {
        if (otherId !== playerIdRef) {
          callPlayer(otherId);
        }
      });
    }
  });
}

// --- Sending ---
export function sendPosition(x: number, y: number) {
  if (!channel || !playerIdRef) return;
  const now = Date.now();

  // ✅ Push my own position locally
  pushToQueue(playerIdRef, { x, y, ts: now });

  if (now - lastSentAt >= SEND_INTERVAL_MS) {
    lastSentAt = now;
    lastPending = null;
    safeSend("player-pos", { playerId: playerIdRef, x, y, ts: now });
  } else {
    lastPending = { x, y };
    if (!sendTimer) {
      const wait = SEND_INTERVAL_MS - (now - lastSentAt);
      sendTimer = setTimeout(() => {
        sendTimer = null;
        if (!channel || !lastPending) return;
        const t = Date.now();
        safeSend("player-pos", { playerId: playerIdRef, x: lastPending.x, y: lastPending.y, ts: t });
        lastSentAt = t;
        lastPending = null;
      }, Math.max(0, wait));
    }
  }

  // ✅ Update audio volumes whenever I move
  const myQueue = positionQueues.get(playerIdRef);
  const myPos = myQueue?.[myQueue.length - 1];
  if (myPos) {
    updateAudioVolumes(myPos);
  }
}

export function sendPlayerMeta(meta: PlayerMetaInfo) {
  if (!channel || !playerIdRef) return;
  myMetaRef = { ...myMetaRef, ...meta };
  const payload = { playerId: playerIdRef, ...myMetaRef };
  safeSend("player-meta", payload);
  metaCache.set(playerIdRef, { ...metaCache.get(playerIdRef), ...myMetaRef });
}

// --- Subscriptions ---
export function onPlayerUpdate(cb: UpdateCb) {
  updateSubscribers.add(cb);
  return () => updateSubscribers.delete(cb);
}

export function onPlayerMeta(cb: (playerId: string, meta: PlayerMetaInfo) => void) {
  metaSubscribers.add(cb);
  return () => metaSubscribers.delete(cb);
}

export function getPlayerMeta(playerId: string) {
  return metaCache.get(playerId);
}

// --- Queues ---
export function getPositionQueues() {
  return positionQueues as ReadonlyMap<string, ReadonlyArray<PositionSample>>;
}

export function popNextPosition(playerId: string) {
  const q = positionQueues.get(playerId);
  return q?.shift();
}

export function clearPlayerQueue(playerId: string) {
  positionQueues.delete(playerId);
}

export async function destroyRealtime() {
  if (channel) {
    try {
      await channel.unsubscribe();
    } catch {}
  }
  channel = null;

  positionQueues.clear();
  updateSubscribers.clear();
  metaSubscribers.clear();
  metaCache.clear();
  lastPending = null;
  if (sendTimer) {
    clearTimeout(sendTimer);
    sendTimer = null;
  }

  peerConnections.forEach((pc) => pc.close());
  peerConnections.clear();

  audioElements.forEach((audio) => {
    if (audio.srcObject) {
      (audio.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
    }
    audio.srcObject = null;
    audio.remove();
  });
  audioElements.clear();

  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }
}

// --- Wrapper ---
export function createPlayerRealtime(options: {
  roomId: string;
  me: PlayerMeta;
  handlers?: {
    onPlayerPos?: (payload: PlayerPosPayload) => void;
    onPresenceSync?: (state: Record<string, any[]>) => void;
  };
}) {
  const { roomId, me, handlers } = options;

  void initRealtime({
    roomId,
    playerId: me.userId,
    meta: { name: me.name, character: me.character },
  }).then(() => {
    handlers?.onPresenceSync?.({});
  });

  const offUpdate = onPlayerUpdate((playerId, pos) => {
    if (playerId === me.userId) return;
    const meta = getPlayerMeta(playerId);
    handlers?.onPlayerPos?.({
      userId: playerId,
      x: pos.x,
      y: pos.y,
      ts: pos.ts,
      name: meta?.name,
      character: meta?.character,
    });
  });

  const offMeta = onPlayerMeta(() => {});

  return {
    broadcastPosition: (data: { x: number; y: number }) => sendPosition(data.x, data.y),
    destroy: async () => {
      offUpdate();
      offMeta();
      await destroyRealtime();
    },
    channel: null as any,
  };
}
