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
import { Dispatch, SetStateAction, useCallback } from "react";
import { off } from "process";
import { EventEmitter } from 'events';
import Stream from "stream";

if (typeof window !== "undefined") {
 window.addEventListener("popstate",async ()=>{
  await destroyRealtime();
 })
 window.addEventListener("beforeunload",async ()=>{
  await destroyRealtime();
 })
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

export type ChatMessage = {
  id: string; // Unique message ID
  senderId: string;
  senderName?: string;
  message: string;
  timestamp: number;
};

// --- State ---
let channel: RealtimeChannel | null = null;
let roomIdRef: string | null = null;
let playerIdRef: string | null = null;
let myMetaRef: PlayerMetaInfo = {};

const positionQueues: QueueMap = new Map();
const metaCache = new Map<string, PlayerMetaInfo>();
const chatMessageSubscribers = new Set<(message: ChatMessage) => void>();
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

//Webrtc related
export type MediaComponentTtype={
  track:MediaStream
  from:string,
}
export const RTCEventEmitter=new EventEmitter()
RTCEventEmitter.on("onTrack",(track)=>{
})
export function setMediaElement(setState:Dispatch<SetStateAction<{
track: MediaStream;
    from: string;
}[]>>){
  console.log("called setmediaelement")

  console.log("onTrack listner added")
  RTCEventEmitter.on("onTrack",(t:MediaStream,f:string)=>{
    console.log("inside the rtceventemnitter ontrack")
    setState((prev)=>{
      for(let a of prev){
        if(a.from==f){
          return prev;
        }
      }
      const ans=[...prev]
      ans.push({track:t,from:f})
      return ans
    })
  })
  
  if(RTCEventEmitter.listenerCount("onClose")===0){
  RTCEventEmitter.on("onClose",(f:string)=>{
    setState((prev)=>{
      const ans=prev.filter((participant)=>{return participant.from!==f})
      
      return ans;
    })
  })
  }
}
export function removeMediaElement(from:string){
  RTCEventEmitter.emit("onClose",from)
}
type RTCBroadcastType={
    from:string | null,
    to:string,
    sdp:RTCSessionDescriptionInit|undefined
}
type ICEBroadcastType={
  from:string,
  to:string,
  ICE:RTCIceCandidateInit
}

let STREAM:MediaStream|null=null;

class PeerService{
  peer:undefined|RTCPeerConnection
  constructor(from:string){
    if(!this.peer){
      this.peer=new RTCPeerConnection({
        iceServers:[{
          urls:[
            "stun:stun.l.google.com:19302",
            "stun:global.stun.twilio.com:3478",
          ]
        }]
      })
      if(STREAM){
        STREAM.getTracks().forEach((track)=>{this.peer?.addTrack(track,STREAM!)})
        console.log(STREAM)
      }else{console.error("STREAM is not defined")}
      this.peer.onicecandidate=(e)=>{
         if(!e.candidate){return}
        channel?.send({type:"broadcast",event:"webrtc-ICE",payload:{from:playerIdRef,to:from,payload:e.candidate.toJSON()}})
      }
      this.peer.ontrack=(event)=>{

        RTCEventEmitter.emit("onTrack",event.streams[0],from)
       console.log("peer ontrack event",event)
      }
    }
  }
  async getOffer(){
    if(this.peer){
      const offer=await this.peer.createOffer()
      await this.peer.setLocalDescription(new RTCSessionDescription(offer))
      return offer
    }
  }
  async getAnswer(offer:RTCSessionDescriptionInit){
    if(this.peer){
      await this.peer.setRemoteDescription(new RTCSessionDescription(offer))
      const answer=await this.peer.createAnswer();
      await this.peer.setLocalDescription(new RTCSessionDescription(answer))
      return answer;
    }
  }
  async setLocal(ACK:RTCSessionDescriptionInit){
    if(this.peer){
      await this.peer.setRemoteDescription(new RTCSessionDescription(ACK))
    }
  }
  async addICECandidates(ICE:RTCIceCandidateInit){
    await this.peer?.addIceCandidate(new RTCIceCandidate(ICE))
    console.log("ICE added")
  }
  close(){
    this.peer?.close()
  }
}

const peersConnections=new Map<string,PeerService>()


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
function rtcSafeSend(event:string,payload:RTCBroadcastType){
 if (!channel) return;
  try {
    channel.send({ type: "broadcast", event, payload });
  } catch {}
}
function getDistance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
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

// WebRTC related

channel.on("broadcast", { event: "webrtc-meta" }, async ({ payload }) => {
  const data = payload as { from: string };
  console.log("meta received", data);
  if (!data.from || data.from === playerIdRef) return;
    if (!peersConnections.has(data.from)) {
      peersConnections.set(data.from, new PeerService(data.from));
    }
  channel?.send({
    type: "broadcast",
    event: "webrtc-meta-ACK",
    payload: { from: playerIdRef, to: data.from },
  });
});

channel.on("broadcast", { event: "webrtc-meta-ACK" }, async ({ payload }) => {
  const data = payload as { from: string; to: string };
  console.log("meta ACK received", data);
  if (!data.from || data.from === playerIdRef) return;
  if (data.to === playerIdRef) {
    if (!peersConnections.has(data.from)) {
      peersConnections.set(data.from, new PeerService(data.from));
    }
    if (STREAM) {
      createOffer(STREAM,data.from);
    }
  }
});

channel.on("broadcast", { event: "webrtc-initials" }, async ({ payload }) => {
  const data = payload as { from: string; to: string; sdp: RTCSessionDescriptionInit };
  console.log("event: webrtc-initials(new user just joined)", data);
  if (!data.from || data.from === playerIdRef) return;
  if (data.to === playerIdRef) {
    const Peer = peersConnections.get(data.from);
    const answer = await Peer?.getAnswer(data.sdp);
    rtcSafeSend("webrtc-initials-ACK", { from: playerIdRef, to: data.from, sdp: answer });
  }
});

channel.on("broadcast", { event: "webrtc-initials-ACK" }, ({ payload }) => {
  const data = payload as { from: string; to: string; sdp: RTCSessionDescriptionInit };
  if (!data.from || data.from === playerIdRef) return;
  if (data.to === playerIdRef) {
    const Peer = peersConnections.get(data.from);
    Peer?.setLocal(data.sdp);
   
    console.log("ACK recieved:", data.from);
  }
});
channel.on("broadcast",{event:"webrtc-destroy"},({payload})=>{
  const data = payload as { from: string}
  console.log("WebRTC peer destroyed ",data.from)
    peersConnections.get(data.from)?.close()
    peersConnections.delete(data.from)
    removeMediaElement(data.from)
})
channel.on("broadcast",{event:"webrtc-ICE"},async ({payload})=>{
  const data= payload as ICEBroadcastType
  if(!data.from || data.from==playerIdRef){return ;}
  if(data.to===playerIdRef){
      const Peer=peersConnections.get(data.from);
      if(Peer?.peer && data.ICE){
        Peer.addICECandidates(data.ICE)
      }
  }
})


  // --- Position updates ---
  channel.on("broadcast", { event: "player-pos" }, (payload) => {
    const data = payload.payload as { playerId: string; x: number; y: number; ts?: number };
    if (!data?.playerId || data.playerId === playerIdRef) return;
    lastSeen.set(data.playerId, Date.now());
    const sample: PositionSample = { x: data.x, y: data.y, ts: data.ts ?? Date.now() };
    pushToQueue(data.playerId, sample);
    updateSubscribers.forEach((cb) => cb(data.playerId, sample));
    
    
    
  });
  
  // --- Meta updates ---
  channel.on("broadcast", { event: "player-meta" }, (payload) => {
    const data = payload.payload as { playerId: string; name?: string; character?: string; avatar?: string };
    if (!data?.playerId || data.playerId === playerIdRef) return;
    lastSeen.set(data.playerId, Date.now());
    const next: PlayerMetaInfo = { name: data.name, character: data.character, avatar: data.avatar };
    metaCache.set(data.playerId, next);
    metaSubscribers.forEach((cb) => cb(data.playerId, next));
    
  
  });
  
  // --- Chat messages ---
  channel.on("broadcast", { event: "chat-message" }, (payload) => {
    const message = payload.payload as ChatMessage;
    chatMessageSubscribers.forEach((cb) => cb(message));
  });
  
  // --- Meta request (handshake) ---
  channel.on("broadcast", { event: "meta-req" }, (payload) => {
    const data = payload.payload as { from?: string };
    if (data?.from && data.from === playerIdRef) return;
    if (playerIdRef) {
      safeSend("player-meta", { playerId: playerIdRef, ...myMetaRef });
    }
  });
  
  // --- Subscribe ---
  await channel.subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      // send meta so others learn about us
      if (myMetaRef && (myMetaRef.name || myMetaRef.character || myMetaRef.avatar)) {
        sendPlayerMeta(myMetaRef);
      }
      safeSend("meta-req", { from: playerIdRef });
      startSignaling()
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
   
}
export async function setSTREAM(s:MediaStream) {
  STREAM=s
}
export async function startSignaling() {

  channel?.send({type:"broadcast",event:"webrtc-meta",payload:{from:playerIdRef}})
  console.log("signalinf start")
}
export async function createOffer(localStream:MediaStream|undefined=undefined,fromId:string,){
console.log("called creatOffer")
    
      const Peer=peersConnections.get(fromId)
     // if(localStream){
       // localStream.getTracks().forEach((track)=>{Peer?.peer?.addTrack(track,localStream)})
     // }
      //else{console.error("localStream is undefined")}
      const offer = await Peer?.getOffer()
      channel?.send({type:"broadcast",event:"webrtc-initials",payload:{from:playerIdRef,to:fromId,sdp:offer}})
  
  
}

export function sendChatMessage(message: string) {
  if (!channel || !playerIdRef) return;
  const chatMessage: ChatMessage = {
    id: Math.random().toString(36).substring(2, 9), // Simple unique ID
    senderId: playerIdRef,
    senderName: myMetaRef.name,
    message,
    timestamp: Date.now(),
  };
  safeSend("chat-message", chatMessage);
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

export function onChatMessage(cb: (message: ChatMessage) => void) {
  chatMessageSubscribers.add(cb);
  return () => { chatMessageSubscribers.delete(cb) }
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
  channel?.send({type:"broadcast",event:"webrtc-destroy",payload:{from:playerIdRef}})
  peersConnections.forEach((Peer)=>{Peer.close()})
  peersConnections.clear();
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
  
  // Clear chat subscribers
  chatMessageSubscribers.clear();

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


