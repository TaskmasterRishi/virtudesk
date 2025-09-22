// playerRealTime.ts
// Supabase realtime networking for player positions.
// - Connects to a room channel
// - Throttles + broadcasts local positions
// - Broadcasts player meta (name, character, avatar) on join & on meta-requests
// - Handshakes: new client sends "meta-req", others reply with "player-meta"
// - Receives remote positions -> per-player bounded queues
// - Exposes queues + meta + subscription helpers


import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/utils/supabase/client";

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    destroyRealtime();
  });
}

export type PlayerMeta = {
  userId: string;
  name?: string;
  character?: string;
  avatar?: string;
};

export type PlayerPosPayload = {
  userId: string;
  x: number;
  y: number;
  ts: number;
  name?: string;
  character?: string;
  avatar?: string;
};

type PositionSample = { x: number; y: number; ts: number };
type QueueMap = Map<string, PositionSample[]>;
type PlayerMetaInfo = { name?: string; character?: string; avatar?: string };

// --- State ---
let channel: RealtimeChannel | null = null;
let roomIdRef: string | null = null;
let playerIdRef: string | null = null;
let myMetaRef: PlayerMetaInfo = {};

const positionQueues: QueueMap = new Map();
const metaCache = new Map<string, PlayerMetaInfo>();
const lastSeen = new Map<string, number>();

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

// --- Audio / Video / WebRTC ---
let localStream: MediaStream | null = null; // microphone
let localVideoStream: MediaStream | null = null; // camera
const peerConnections = new Map<string, RTCPeerConnection>();
const audioElements = new Map<string, HTMLAudioElement>();
const videoElements = new Map<string, HTMLVideoElement>();
const remoteVideoStreams = new Map<string, MediaStream>();
const remoteVideoSubscribers = new Set<(id: string, stream: MediaStream) => void>();
// Perfect-negotiation helpers
const politePeers = new Map<string, boolean>();
const settingRemoteAnswerPending = new Map<string, boolean>();

// --- Robust helpers for signaling
const pendingCandidates = new Map<string, RTCIceCandidateInit[]>(); // buffer candidates per peer
const makingOffer = new Set<string>(); // guard per peer to avoid duplicate offers

// --- Audio range for proximity (you can keep/change)
const AUDIO_RANGE = 100; // pixels

// --- Utils ---
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

function getDistance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// --- Audio volume proximity
function updateAudioVolumes(myPos: { x: number; y: number }) {
  for (const [otherId, queue] of positionQueues) {
    if (otherId === playerIdRef) continue;
    const latest = queue[queue.length - 1];
    if (!latest) continue;

    const dist = getDistance(myPos, latest);
    const audio = audioElements.get(otherId);
    if (!audio) continue;

    // simple cutoff (you can make it smooth)
    audio.volume = dist <= AUDIO_RANGE ? 1 : 0;
  }
}

// --- init mic with basic processing
async function initAudio() {
  if (!localStream) {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  } else {
    // If a prior stream exists but tracks are ended (tab resumed), reacquire
    const ended = localStream.getTracks().every(t => t.readyState === 'ended');
    if (ended) {
      try { localStream.getTracks().forEach(t => t.stop()); } catch {}
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    }
  }
}

// Create peer connection (and attach local tracks)
async function createPeerConnection(remoteId: string) {
  if (peerConnections.has(remoteId)) return peerConnections.get(remoteId)!;

  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
    ],
    iceCandidatePoolSize: 4,
  });

  // Decide polite/impolite per connection (lower ID is polite)
  if (playerIdRef) {
    politePeers.set(remoteId, playerIdRef < remoteId);
  }

  // Prepare transceivers up front to stabilize SDP (m-lines stay consistent)
  try {
    pc.addTransceiver('audio', { direction: 'sendrecv' });
  } catch {}
  try {
    pc.addTransceiver('video', { direction: localVideoStream ? 'sendrecv' : 'recvonly' });
  } catch {}

  // Add local audio tracks so remote receives our audio
  if (localStream) {
    for (const track of localStream.getTracks()) {
      const audioSender = pc.getSenders().find((s) => s.track?.kind === 'audio');
      if (audioSender && (audioSender as RTCRtpSender).replaceTrack) {
        try { await (audioSender as RTCRtpSender).replaceTrack(track); } catch { pc.addTrack(track, localStream); }
      } else {
        pc.addTrack(track, localStream);
      }
    }
  }
  // Do NOT attach camera unless a call is active; startVideoWith will add it

  // When we receive remote audio, attach to an <audio> element
  pc.ontrack = (event) => {
    const stream = event.streams[0] ?? null;
    if (!stream) return;
    // attach audio
    if (event.track.kind === 'audio') {
      let audio = audioElements.get(remoteId);
      if (!audio) {
        audio = document.createElement("audio");
        audio.autoplay = true;
        audio.setAttribute("playsinline", "");
        audioElements.set(remoteId, audio);
        document.body.appendChild(audio);
      }
      audio.srcObject = stream;
      // Attempt to start playback immediately; some browsers require a gesture, but this helps when already interacted
      try { void (audio as HTMLMediaElement).play?.(); } catch {}
    }
    // attach video (hidden by default; UI can adopt it if needed)
    if (event.track.kind === 'video') {
      let video = videoElements.get(remoteId);
      if (!video) {
        video = document.createElement('video');
        video.autoplay = true;
        video.muted = false;
        video.playsInline = true as any;
        video.style.display = 'none';
        videoElements.set(remoteId, video);
        document.body.appendChild(video);
      }
      video.srcObject = stream;
      remoteVideoStreams.set(remoteId, stream);
      // notify subscribers
      remoteVideoSubscribers.forEach((cb) => {
        try { cb(remoteId, stream); } catch {}
      });
    }
  };

  // Send ICE candidates via Supabase
  pc.onicecandidate = (e) => {
    if (e.candidate) {
      safeSend("webrtc-candidate", {
        from: playerIdRef,
        to: remoteId,
        candidate: e.candidate.toJSON(),
      });
    }
  };

  // Trigger renegotiation when needed (fires on caller when tracks added)
  pc.onnegotiationneeded = async () => {
    if (makingOffer.has(remoteId)) return;
    makingOffer.add(remoteId);
    try {
      const offer = await pc.createOffer();
      // Guard: if closed, bail
      if (pc.signalingState === 'closed') return;
      await pc.setLocalDescription(offer);
      safeSend('webrtc-offer', { from: playerIdRef, to: remoteId, sdp: pc.localDescription });
    } catch (e) {
      // ignore
    } finally {
      makingOffer.delete(remoteId);
    }
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed') {
      try { pc.restartIce(); } catch {}
    }
  };

  peerConnections.set(remoteId, pc);

  return pc;
}

// Drain buffered ICE candidates for a remote peer (call after remote description set)
async function drainPendingCandidates(remoteId: string) {
  const pc = peerConnections.get(remoteId);
  if (!pc) return;
  const list = pendingCandidates.get(remoteId);
  if (!list?.length) return;
  for (const cand of list) {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(cand));
    } catch (err) {
      // ignore / log
      // console.warn("failed to add buffered candidate", err);
    }
  }
  pendingCandidates.delete(remoteId);
}

// --- Signaling handlers ---
async function handleOffer(from: string, sdp: RTCSessionDescriptionInit) {
  // we are the callee (answerer)
  if (!playerIdRef) return;
  // create/get pc
  const pc = await createPeerConnection(from);

  const isPolite = politePeers.get(from) ?? true;
  const offerCollision = pc.signalingState !== 'stable' || makingOffer.has(from);
  let ignoreOffer = !isPolite && offerCollision;

  if (ignoreOffer) return;

  if (offerCollision) {
    // rollback local description on polite side
    try { await pc.setLocalDescription({ type: 'rollback' } as any); } catch {}
  }
  try { await pc.setRemoteDescription(new RTCSessionDescription(sdp)); } catch { return; }

  // drain any buffered ICE candidates that arrived before the offer
  await drainPendingCandidates(from);

  // create and send answer
  try {
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    safeSend("webrtc-answer", { from: playerIdRef, to: from, sdp: pc.localDescription });
  } catch (err) {
    console.warn("Failed to create/send answer", err);
  }

  // Ensure we also publish our local video after accepting remote offer (caller side)
  // Do not request camera/mic here; we only add camera if user initiates a call
}

async function handleAnswer(from: string, sdp: RTCSessionDescriptionInit) {
  const pc = await createPeerConnection(from);
  try { await pc.setRemoteDescription(new RTCSessionDescription(sdp)); } catch { return; }
  // drain any buffered candidates
  await drainPendingCandidates(from);
  // if we have local video and sender exists but track is missing on remote side, trigger renegotiation
  if (localVideoStream && !pc.getSenders().some((s) => s.track?.kind === 'video')) {
    try {
      for (const track of localVideoStream.getVideoTracks()) {
        pc.addTrack(track, localVideoStream);
      }
    } catch {}
  }
}

async function handleCandidate(from: string, candidate: RTCIceCandidateInit) {
  const pc = peerConnections.get(from);
  // if remote description not set yet, buffer candidate
  if (!pc || !pc.remoteDescription || !pc.remoteDescription.type) {
    const list = pendingCandidates.get(from) ?? [];
    list.push(candidate);
    pendingCandidates.set(from, list);
    return;
  }
  try {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (err) {
    console.warn("Error adding ICE candidate", err);
  }
}

async function callPlayer(remoteId: string) {
  if (!playerIdRef) return;
  // deterministic rule: only caller if local id > remote id (lexicographic)
  if (!(playerIdRef > remoteId)) return;

  // avoid duplicate offers
  if (makingOffer.has(remoteId)) return;
  makingOffer.add(remoteId);

  try {
    // ensure mic is available before creating offer so audio is included
    await initAudio().catch(() => {});
    const pc = await createPeerConnection(remoteId);
    // Explicitly create and send offer for audio-only proximity
    const offer = await pc.createOffer();
    if (pc.signalingState === 'closed') return;
    await pc.setLocalDescription(offer);
    safeSend("webrtc-offer", { from: playerIdRef, to: remoteId, sdp: pc.localDescription });
  } catch (err) {
    console.warn("callPlayer error", err);
  } finally {
    makingOffer.delete(remoteId);
  }
}

// --- Init / Realtime setup ---
export async function initRealtime(opts: {
  roomId: string;
  playerId: string;
  meta?: PlayerMetaInfo;
}): Promise<void> {
  const { roomId, playerId, meta } = opts;
  roomIdRef = roomId;
  playerIdRef = playerId;
  myMetaRef = { ...(meta ?? {}) };

  // unsubscribe if previous channel existed
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
    lastSeen.set(data.playerId, Date.now());
    const sample: PositionSample = { x: data.x, y: data.y, ts: data.ts ?? Date.now() };
    pushToQueue(data.playerId, sample);
    updateSubscribers.forEach((cb) => cb(data.playerId, sample));

    // If we have our own pos, update audio volumes
    if (playerIdRef) {
      const myQueue = positionQueues.get(playerIdRef);
      const myPos = myQueue?.[myQueue.length - 1];
      if (myPos) updateAudioVolumes(myPos);
    }
  });

  // --- Meta updates ---
  channel.on("broadcast", { event: "player-meta" }, (payload) => {
    const data = payload.payload as { playerId: string; name?: string; character?: string; avatar?: string };
    if (!data?.playerId || data.playerId === playerIdRef) return;
    lastSeen.set(data.playerId, Date.now());
    const next: PlayerMetaInfo = { name: data.name, character: data.character, avatar: data.avatar };
    metaCache.set(data.playerId, next);
    metaSubscribers.forEach((cb) => cb(data.playerId, next));

    // Start proximity audio p2p for lower-id (caller) pairs only
    if (playerIdRef && playerIdRef > data.playerId) {
      initAudio().then(() => callPlayer(data.playerId)).catch(() => {});
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
    const { from, to, sdp } = payload.payload as { from: string; to?: string; sdp: RTCSessionDescriptionInit };
    if (from !== playerIdRef && (!to || to === playerIdRef)) {
      initAudio().then(() => handleOffer(from, sdp)).catch((e) => {
        console.warn("initAudio failed before handleOffer", e);
      });
    }
  });

  channel.on("broadcast", { event: "webrtc-answer" }, (payload) => {
    const { from, to, sdp } = payload.payload as { from: string; to?: string; sdp: RTCSessionDescriptionInit };
    if (from !== playerIdRef && (!to || to === playerIdRef)) handleAnswer(from, sdp);
  });

  channel.on("broadcast", { event: "webrtc-candidate" }, (payload) => {
    const { from, to, candidate } = payload.payload as { from: string; to?: string; candidate: RTCIceCandidateInit };
    if (from !== playerIdRef && (!to || to === playerIdRef)) handleCandidate(from, candidate);
  });

  // --- Call request/response/end (video consent) ---
  channel.on("broadcast", { event: "call-request" }, (payload) => {
    const { from, to } = payload.payload as { from: string; to: string };
    if (!playerIdRef || to !== playerIdRef) return;
    callRequestSubscribers.forEach((cb) => cb(from, metaCache.get(from) ?? {}));
  });

  channel.on("broadcast", { event: "call-response" }, async (payload) => {
    const { from, to, accept } = payload.payload as { from: string; to: string; accept: boolean };
    if (!playerIdRef || to !== playerIdRef) return;
    if (accept) {
      try { await startVideoWith(from); } catch {}
    }
    callResponseSubscribers.forEach((cb) => cb(from, accept));
  });

  channel.on("broadcast", { event: "call-end" }, async (payload) => {
    const { from, to } = payload.payload as { from: string; to: string };
    if (!playerIdRef || to !== playerIdRef) return;
    try { await stopVideoWith(from); } catch {}
    callEndSubscribers.forEach((cb) => cb(from));
  });

  // --- Subscribe ---
  await channel.subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      // init mic only
      try { await initAudio(); } catch {}

      // send meta so others learn about us
      if (myMetaRef && (myMetaRef.name || myMetaRef.character || myMetaRef.avatar)) {
        sendPlayerMeta(myMetaRef);
      }
      safeSend("meta-req", { from: playerIdRef });

      // Do not auto-call existing players
    }
  });

  // --- Periodic cleanup of stale players ---
  setInterval(() => {
    const now = Date.now();
    const TIMEOUT = 10000; // 10 seconds
    for (const [id, ts] of lastSeen.entries()) {
      if (id === playerIdRef) continue; // never remove self
      if (now - ts > TIMEOUT) {
        lastSeen.delete(id);
        metaCache.delete(id);
        positionQueues.delete(id);
      }
    }
  }, 2000);
}

// --- Sending ---
export function sendPosition(x: number, y: number) {
  if (!channel || !playerIdRef) return;
  const now = Date.now();

  // push own pos locally so proximity check has a reference
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

  // update audio volumes whenever we move
  const myQueue = positionQueues.get(playerIdRef);
  const myPos = myQueue?.[myQueue.length - 1];
  if (myPos) updateAudioVolumes(myPos);
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
  return () => { updateSubscribers.delete(cb) }
}

export function onPlayerMeta(cb: (playerId: string, meta: PlayerMetaInfo) => void) {
  metaSubscribers.add(cb);
  return () => { metaSubscribers.delete(cb) }
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

  // Close & stop peer connections and their tracks (senders & receivers)
  peerConnections.forEach((pc) => {
    try {
      pc.getSenders().forEach((s) => s.track?.stop());
      pc.getReceivers().forEach((r) => r.track?.stop());
      pc.close();
    } catch {}
  });
  peerConnections.clear();

  // Remove audio elements and stop their streams
  audioElements.forEach((audio) => {
    try {
      if (audio.srcObject) {
        (audio.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      }
      audio.pause();
      audio.srcObject = null;
      if (audio.parentNode) audio.parentNode.removeChild(audio);
    } catch {}
  });
  audioElements.clear();

  // Remove video elements and stop their streams
  videoElements.forEach((video) => {
    try {
      if (video.srcObject) {
        (video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      }
      video.pause();
      video.srcObject = null;
      if (video.parentNode) video.parentNode.removeChild(video);
    } catch {}
  });
  videoElements.clear();

  // Stop local mic
  if (localStream) {
    try {
      localStream.getTracks().forEach((t) => t.stop());
    } catch {}
    localStream = null;
  }

  // Stop local camera
  if (localVideoStream) {
    try {
      localVideoStream.getTracks().forEach((t) => t.stop());
    } catch {}
    localVideoStream = null;
  }

  // clear pending candidates & makingOffer state
  pendingCandidates.clear();
  makingOffer.clear();
}

// --- Compatibility wrapper ---
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
    meta: { name: me.name, character: me.character, avatar: me.avatar },
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
      avatar: meta?.avatar,
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

// --- Utilities for UI ---
export function getAllPlayers(): Array<{ id: string; name?: string; character?: string; avatar?: string }> {
  const ids = new Set<string>();
  metaCache.forEach((_v, k) => ids.add(k));
  positionQueues.forEach((_v, k) => ids.add(k));
  if (playerIdRef) ids.add(playerIdRef);
  const out: Array<{ id: string; name?: string; character?: string; avatar?: string }> = [];
  ids.forEach((id) => {
    const meta = metaCache.get(id) ?? {};
    out.push({ id, name: meta.name, character: meta.character, avatar: meta.avatar });
  });
  return out;
}

export function getSelfId() { return playerIdRef; }

export function getRemoteVideoStream(remoteId: string) { return remoteVideoStreams.get(remoteId) || null; }
export function getLocalVideoStream() { return localVideoStream; }
export function onRemoteVideo(cb: (id: string, stream: MediaStream) => void) { remoteVideoSubscribers.add(cb); return () => { remoteVideoSubscribers.delete(cb) } }

async function ensureCamera(): Promise<MediaStream> {
  if (!localVideoStream) {
    localVideoStream = await navigator.mediaDevices.getUserMedia({ video: true });
  }
  return localVideoStream;
}

async function renegotiate(remoteId: string) {
  const pc = peerConnections.get(remoteId) || await createPeerConnection(remoteId);
  if (!pc) return;
  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    safeSend('webrtc-offer', { from: playerIdRef, to: remoteId, sdp: pc.localDescription });
  } catch (e) {
    console.warn('renegotiate failed', e);
  }
}

export async function startVideoWith(remoteId: string) {
  const pc = peerConnections.get(remoteId) || await createPeerConnection(remoteId);
  if (!pc) return;
  const cam = await ensureCamera();
  // add track if not already added
  const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
  const track = cam.getVideoTracks()[0];
  if (track) {
    if (sender) {
      try { await sender.replaceTrack(track); } catch { pc.addTrack(track, cam); }
    } else {
      pc.addTrack(track, cam);
    }
  }
  // negotiation will be triggered by onnegotiationneeded
  // keep proximity-only logic; do not force audio to max
}

export async function stopVideoWith(remoteId: string) {
  const pc = peerConnections.get(remoteId);
  if (pc) {
    pc.getSenders().forEach((s) => {
      if (s.track?.kind === 'video') {
        try { s.track.stop(); } catch {}
        try { pc.removeTrack(s); } catch {}
      }
    });
    // negotiation will be triggered by onnegotiationneeded
  }
  const el = videoElements.get(remoteId);
  if (el) {
    try {
      el.pause();
      el.srcObject = null;
      if (el.parentNode) el.parentNode.removeChild(el);
    } catch {}
    videoElements.delete(remoteId);
  }
  // if no other peers use camera, stop it
  if (localVideoStream) {
    const anyVideoSending = Array.from(peerConnections.values()).some((peer) =>
      peer.getSenders().some((s) => s.track?.kind === 'video')
    );
    if (!anyVideoSending) {
      try { localVideoStream.getTracks().forEach((t) => t.stop()); } catch {}
      localVideoStream = null;
    }
  }
}

// --- Call request/response helpers ---
type CallReqCb = (fromId: string, meta: PlayerMetaInfo) => void;
type CallRespCb = (remoteId: string, accepted: boolean) => void;
type CallEndCb = (remoteId: string) => void;
const callRequestSubscribers = new Set<CallReqCb>();
const callResponseSubscribers = new Set<CallRespCb>();
const callEndSubscribers = new Set<CallEndCb>();

export function onIncomingCall(cb: CallReqCb) { callRequestSubscribers.add(cb); return () => { callRequestSubscribers.delete(cb) } }
export function onCallResponse(cb: CallRespCb) { callResponseSubscribers.add(cb); return () => { callResponseSubscribers.delete(cb) } }
export function onCallEnd(cb: CallEndCb) { callEndSubscribers.add(cb); return () => { callEndSubscribers.delete(cb) } }

export async function requestCall(remoteId: string) {
  if (!playerIdRef || !channel) return;
  safeSend('call-request', { from: playerIdRef, to: remoteId });
}

export async function respondToCall(remoteId: string, accept: boolean) {
  if (!playerIdRef || !channel) return;
  if (accept) {
    try { await startVideoWith(remoteId); } catch {}
  }
  safeSend('call-response', { from: playerIdRef, to: remoteId, accept });
}

export async function endCall(remoteId: string) {
  if (!playerIdRef || !channel) return;
  try { await stopVideoWith(remoteId); } catch {}
  safeSend('call-end', { from: playerIdRef, to: remoteId });
}
