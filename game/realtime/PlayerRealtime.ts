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
import { error } from "console";

if (typeof window !== "undefined") {
 window.addEventListener("popstate",async ()=>{
  await destroyRealtime();
 })
 window.addEventListener("beforeunload",async ()=>{
  await destroyRealtime();
 })
}
let MODE:string
export function setMODE(m:string){
  MODE=m
  if(m === 'meeting'){
    // Send meeting-meta to everyone (like joining a room)
    safeSend("meeting-meta", { from: playerIdRef });
  }
}

// Meeting participants management
let meetingParticipants: MediaComponentTtype[] = [];

export function setMeetingParticipants(participants: MediaComponentTtype[]) {
  meetingParticipants = participants;
}

export function getMeetingParticipants(): MediaComponentTtype[] {
  return meetingParticipants;
}

// Meeting functionality
// let meetingModeRef = false;
// let meetingParticipantsRef = new Set<string>();


export async function startMeeting(setStream:Dispatch<SetStateAction<MediaStream | undefined>>) {
   closeAllPeerConnections();
 
  
  // Close all existing peer connections
  
  // Get new stream with video and audio for meeting
  try {
    const meetingStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });
    
    // Set the new stream
    setSTREAM(meetingStream);
    setStream(meetingStream);
    // Set mode to meeting (this will trigger meeting-meta request)
    setMODE('meeting');
    
    // Notify everyone to join meeting
    safeSend("meeting-invite", { 
      from: playerIdRef, 
      meetingId: `meeting_${Date.now()}`,
      initiator: playerIdRef 
    });
  } catch (error) {
    console.error("Failed to get meeting stream:", error);
  }
}

export async function joinMeeting(setStream:Dispatch<SetStateAction<MediaStream | undefined>>) {
  closeAllPeerConnections();

   
    
    // Close all existing peer connections
    
    // Get new stream with video and audio for meeting
    try {
      const meetingStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      // Set the new stream
      setSTREAM(meetingStream);
      setStream(meetingStream)
      // Set mode to meeting (this will trigger meeting-meta request)
      setMODE('meeting');
      
      // Send meeting join signal
      
    } catch (error) {
      console.error("Failed to get meeting stream:", error);
    }
  
}


export function leaveMeeting() {
  
  
  // Send leave signal
  safeSend("meeting-leave", { from: playerIdRef });
  
  // Close all existing connections
  closeAllPeerConnections();
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

let PROXIMITY_DISTANCE=100

export function getMyId(){return playerIdRef}

//Webrtc related
export type MediaComponentTtype={
  track:MediaStream
  from:string,
}
export const RTCEventEmitter=new EventEmitter()

export function setMediaElement(setState:Dispatch<SetStateAction<{
track: MediaStream;
    from: string;
}[]>>,mode:string){
  console.log("called setmediaelement")

  console.log("onTrack listner added")
  RTCEventEmitter.on("onTrack in "+mode,(t:MediaStream,f:string)=>{
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
  
  if(RTCEventEmitter.listenerCount("onClose in "+mode)===0){
  RTCEventEmitter.on("onClose in "+mode,(f:string)=>{
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
  ICE:string
}

let STREAM:MediaStream|null=null;
export function nullifySTREAM(){
  STREAM=null
}
class PeerService{
  peer:undefined|RTCPeerConnection
  queue:any[]
  state:boolean
  senders:(RTCRtpSender|undefined)[]
  targetId:string
  constructor(from:string){
    this.targetId = from
    this.senders=[]
    this.queue=[]
    this.state=false
    let myHostname="localhost"
    if(window){myHostname=window.location.hostname}
    if(!this.peer){
      this.peer=new RTCPeerConnection({
      
      iceServers: [
        {
          urls: [
            'stun:stun.l.google.com:19302',
            'stun:global.stun.twilio.com:3478',
        
          ],
        },
      ]
      
    });
      
      if(STREAM){
        STREAM.getTracks().forEach((track)=>{this.senders.push(this.peer?.addTrack(track,STREAM!))})
       
      }else{console.error("STREAM is not defined")}

      this.peer.onicecandidate=(e)=>{
         if(!e.candidate){return}
         if(!from){
          console.error("from not defined in constructor")
          return;
         }
         
         console.log("sending ICE to:", from)
         channel?.send({type:"broadcast",event:"webrtc-ICE",payload:{from:playerIdRef,to:from,ICE:JSON.stringify(e.candidate)}})
      }
      this.peer.ontrack=(event)=>{

        RTCEventEmitter.emit("onTrack in "+MODE,event.streams[0],from)
       console.log("peer ontrack event",event)
      }
    }
  }
  async getOffer(){
    if(this.peer){
      if(STREAM){
         this.senders.forEach((sender)=>{this.peer?.removeTrack(sender!)})
        this.senders=[]
        STREAM.getTracks().forEach((track)=>{this.senders.push(this.peer?.addTrack(track,STREAM!))})
       
      }else{console.error("STREAM is not defined")}
      const offer=await this.peer.createOffer()
      await this.peer.setLocalDescription(new RTCSessionDescription(offer))
      return offer
    }
  }
  async getAnswer(offer:RTCSessionDescriptionInit){
    if(this.peer){
      await this.peer.setRemoteDescription(new RTCSessionDescription(offer))
      if(STREAM){
        this.senders.forEach((sender)=>{this.peer?.removeTrack(sender!)})
        this.senders=[]
        STREAM.getTracks().forEach((track)=>{this.peer?.addTrack(track,STREAM!)})

      }else{console.error("STREAM is not defined")}
      const answer=await this.peer.createAnswer();
      await this.peer.setLocalDescription(new RTCSessionDescription(answer))
        this.state=true
      this.queue.forEach(async (ICE)=>{
        try{
        await this.peer?.addIceCandidate(new RTCIceCandidate(ICE))
          console.log("ICE actually added")
        }catch(e){console.error("Problem occured while addinf ICE")}
      })
      this.queue=[]

      return answer;
    }
  }
  async setLocal(ACK:RTCSessionDescriptionInit){
    if(this.peer){
      await this.peer.setRemoteDescription(new RTCSessionDescription(ACK))
      this.state=true
      this.queue.forEach(async (ICE)=>{
         try{
          await this.peer?.addIceCandidate(new RTCIceCandidate(ICE))
            console.log("ICE actually added")
          }catch(e){console.error("Problem occured while addinf ICE")}
      })
      this.queue=[]
    }
  }
  async addICECandidates(ICE:RTCIceCandidate){
    if(!this.state){
      this.queue.push(ICE)
    }
    else{
      try{
      await this.peer?.addIceCandidate(new RTCIceCandidate(ICE))
      console.log("ICE actually added")
      }catch(e){console.error("Problem occured while addinf ICE")}

    }
    
  }
  close(){
    this.peer?.close()
  }
}

const peersConnections=new Map<string,PeerService>()

// Helper functions for meeting mode
function closeAllPeerConnections() {
  console.log("Closing all peer connections for meeting mode");
  peersConnections.forEach((peerService, playerId) => {
    peerService.close();
  });
  peersConnections.clear();
}






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
    
    // Create offer for the player
    if (STREAM) {
      createOffer(STREAM, data.from);
    }
  }
});

// Meeting meta events - similar to webrtc-meta but for meeting participants only
channel.on("broadcast", { event: "meeting-meta" }, async ({ payload }) => {
  if(MODE!=="meeting"){return}
  const data = payload as { from: string };
  console.log("meeting-meta received from:", data.from);
  if (!data.from || data.from === playerIdRef) return;
  
  // Always respond to meeting-meta (like webrtc-meta)
  console.log("Responding to meeting-meta from:", data.from);
  
  
  if (!peersConnections.has(data.from)) {
    peersConnections.set(data.from, new PeerService(data.from));
  }
  
  channel?.send({
    type: "broadcast",
    event: "meeting-meta-ACK",
    payload: { from: playerIdRef, to: data.from },
  });
});

channel.on("broadcast", { event: "meeting-meta-ACK" }, async ({ payload }) => {
  const data = payload as { from: string; to: string };
  console.log("meeting-meta-ACK received from:", data.from);
  if (!data.from || data.from === playerIdRef) return;
  if (data.to === playerIdRef) {
    
    // Only create connection if we're in meeting mode
    if (MODE === 'meeting') {
      console.log(`Creating meeting connection to: ${data.from}`);
      
      
      if (!peersConnections.has(data.from)) {
        peersConnections.set(data.from, new PeerService(data.from));
      }
      
      // Create offer for meeting participant
      if (STREAM) {
        createOffer(STREAM, data.from);
      }
    } else {
      console.log(`Not in meeting mode, ignoring meeting-meta-ACK from: ${data.from}`);
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
      console.log("Inside supabase webrtc ICE revieveng Event"+data.ICE)
      if(Peer?.peer && data.ICE){
        try{
        await Peer.addICECandidates(JSON.parse(data.ICE))
         console.log("Ice recieved and sent to Peer Service")
        }catch(e){console.error("Problem oiccures while Sending ICE to Peer Service")}
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
    
    if(playerIdRef){
      const myPosition = positionQueues.get(playerIdRef);
  
  if (myPosition && myPosition.length > 0) {
    const myLatestPos = myPosition[myPosition.length - 1];
    const distance = getDistance(myLatestPos, { x: data.x, y: data.y });
  
    const audioElement = document.getElementById(`PeerAudio${data.playerId}`) as HTMLAudioElement;
    if (audioElement) {
      audioElement.muted = distance > PROXIMITY_DISTANCE;
    }
  }
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
    
  
  });
  
  // Meeting event handlers
  channel.on("broadcast", { event: "meeting-invite" }, (payload) => {
    const data = payload.payload as { from: string; meetingId: string; initiator: string };
    if (!data?.from || data.from === playerIdRef) return;
    
    console.log("Received meeting invite from", data.from);
    
    // Emit custom event for UI to handle
    window.dispatchEvent(new CustomEvent('meeting-invite', { 
      detail: { from: data.from, meetingId: data.meetingId, initiator: data.initiator }
    }));
  });

  // channel.on("broadcast", { event: "meeting-join" }, (payload) => {
  //   const data = payload.payload as { from: string; meetingId: string };
  //   if (!data?.from || data.from === playerIdRef) return;
    
  
  //   console.log("Player joined meeting:", data.from);
    
  //   // If we're already in meeting mode, request meeting meta from the new participant
  //   if (MODE === 'meeting') {
  //     console.log(`Requesting meeting meta from new participant: ${data.from}`);
  //     safeSend("meeting-meta", { from: playerIdRef });
  //   }
  // });


  channel.on("broadcast", { event: "meeting-leave" }, (payload) => {
    const data = payload.payload as { from: string };
    if (!data?.from || data.from === playerIdRef) return;
    
    
    console.log("Player left meeting:", data.from);

    
    // Close connection to the player who left
    const peerService = peersConnections.get(data.from);
    if (peerService) {
      peerService.close();
      peersConnections.delete(data.from);
      console.log(`Closed connection to ${data.from} who left meeting`);
    }
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
console.log("called createOffer for:", fromId)
    
    const Peer=peersConnections.get(fromId)
    if (!Peer) {
      console.log(`No peer connection found for ${fromId}`);
      return;
    }
    
    const offer = await Peer?.getOffer()
    if (offer) {
      channel?.send({type:"broadcast",event:"webrtc-initials",payload:{from:playerIdRef,to:fromId,sdp:offer}})
    }
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
STREAM=null

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


