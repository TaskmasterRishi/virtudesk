// playerRealTime.ts
// Supabase realtime networking for player positions.
// - Connects to a room channel
// - Throttles + broadcasts local positions
// - Broadcasts player meta (name, avatarUrl) on join & on meta-requests
// - Handshakes: new client sends "meta-req", others reply with "player-meta"
// - Receives remote positions -> per-player bounded queues
// - Exposes queues + meta + subscription helpers

import { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/utils/supabase/client'

export type PlayerMeta = {
  userId: string
  name?: string
  avatarUrl?: string
}

export type PlayerPosPayload = {
  userId: string
  x: number
  y: number
  ts: number
  name?: string
  avatarUrl?: string
}

type PositionSample = { x: number; y: number; ts: number }
type QueueMap = Map<string, PositionSample[]>
type PlayerMetaInfo = { name?: string; avatarUrl?: string }

// --- State ---
let channel: RealtimeChannel | null = null
let roomIdRef: string | null = null
let playerIdRef: string | null = null
let myMetaRef: PlayerMetaInfo = {}

const positionQueues: QueueMap = new Map()
const metaCache = new Map<string, PlayerMetaInfo>()

// Subscribers
type UpdateCb = (playerId: string, pos: PositionSample) => void
const updateSubscribers = new Set<UpdateCb>()
const metaSubscribers = new Set<(playerId: string, meta: PlayerMetaInfo) => void>()

// --- Throttle ---
const SEND_HZ = 15
const SEND_INTERVAL_MS = Math.floor(1000 / SEND_HZ)
let lastSentAt = 0
let lastPending: { x: number; y: number } | null = null
let sendTimer: ReturnType<typeof setTimeout> | null = null

// --- Utils ---
function pushToQueue(playerId: string, sample: PositionSample) {
  const q = positionQueues.get(playerId) ?? []
  q.push(sample)
  if (q.length > 8) q.shift() // max 8 samples
  positionQueues.set(playerId, q)
}

function safeSend(event: string, payload: Record<string, any>) {
  if (!channel) return
  try {
    channel.send({ type: 'broadcast', event, payload })
  } catch {
    // swallow
  }
}

// --- Init ---
export async function initRealtime(opts: {
  roomId: string
  playerId: string
  meta?: PlayerMetaInfo // Clerk meta (name/avatar)
}): Promise<void> {
  const { roomId, playerId, meta } = opts
  roomIdRef = roomId
  playerIdRef = playerId
  myMetaRef = { ...(meta ?? {}) }

  // Cleanup old channel
  if (channel) {
    try { await channel.unsubscribe() } catch {}
  }
  channel = null

  channel = supabase.channel(`room:${roomId}`, {
    config: { broadcast: { self: false } },
  })

  // Position updates
  channel.on('broadcast', { event: 'player-pos' }, (payload) => {
    const data = payload.payload as { playerId: string; x: number; y: number; ts?: number }
    if (!data?.playerId || data.playerId === playerIdRef) return

    const sample: PositionSample = {
      x: data.x,
      y: data.y,
      ts: data.ts ?? Date.now(),
    }

    pushToQueue(data.playerId, sample)
    updateSubscribers.forEach((cb) => cb(data.playerId, sample))
  })

  // Meta updates
  channel.on('broadcast', { event: 'player-meta' }, (payload) => {
    const data = payload.payload as { playerId: string; name?: string; avatarUrl?: string }
    if (!data?.playerId || data.playerId === playerIdRef) return

    const next: PlayerMetaInfo = { name: data.name, avatarUrl: data.avatarUrl }
    metaCache.set(data.playerId, next)
    metaSubscribers.forEach((cb) => cb(data.playerId, next))
  })

  // Meta request (handshake) -> reply with our meta
  channel.on('broadcast', { event: 'meta-req' }, (payload) => {
    const data = payload.payload as { from?: string }
    // avoid echoing to our own request
    if (data?.from && data.from === playerIdRef) return
    // reply with our current meta
    if (playerIdRef) {
      safeSend('player-meta', { playerId: playerIdRef, ...myMetaRef })
    }
  })

  await channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      // send our meta once on join (so current listeners update)
      if (myMetaRef && (myMetaRef.name || myMetaRef.avatarUrl)) {
        sendPlayerMeta(myMetaRef)
      }
      // ask others to send their meta (so we see existing players on refresh/late join)
      safeSend('meta-req', { from: playerIdRef })
    }
  })
}

// --- Sending ---
export function sendPosition(x: number, y: number) {
  if (!channel || !playerIdRef) return
  const now = Date.now()

  if (now - lastSentAt >= SEND_INTERVAL_MS) {
    // immediate
    lastSentAt = now
    lastPending = null
    safeSend('player-pos', { playerId: playerIdRef, x, y, ts: now })
  } else {
    // coalesce + schedule
    lastPending = { x, y }
    if (!sendTimer) {
      const wait = SEND_INTERVAL_MS - (now - lastSentAt)
      sendTimer = setTimeout(() => {
        sendTimer = null
        if (!channel || !lastPending) return
        const t = Date.now()
        safeSend('player-pos', { playerId: playerIdRef, x: lastPending.x, y: lastPending.y, ts: t })
        lastSentAt = t
        lastPending = null
      }, Math.max(0, wait))
    }
  }
}

export function sendPlayerMeta(meta: PlayerMetaInfo) {
  if (!channel || !playerIdRef) return
  myMetaRef = { ...myMetaRef, ...meta }
  const payload = { playerId: playerIdRef, ...myMetaRef }
  safeSend('player-meta', payload)
  metaCache.set(playerIdRef, { ...metaCache.get(playerIdRef), ...myMetaRef })
}

// --- Subscriptions ---
export function onPlayerUpdate(cb: UpdateCb) {
  updateSubscribers.add(cb)
  return () => updateSubscribers.delete(cb)
}

export function onPlayerMeta(cb: (playerId: string, meta: PlayerMetaInfo) => void) {
  metaSubscribers.add(cb)
  return () => metaSubscribers.delete(cb)
}

export function getPlayerMeta(playerId: string) {
  return metaCache.get(playerId)
}

// --- Queues ---
export function getPositionQueues() {
  return positionQueues as ReadonlyMap<string, ReadonlyArray<PositionSample>>
}

export function popNextPosition(playerId: string) {
  const q = positionQueues.get(playerId)
  return q?.shift()
}

export function clearPlayerQueue(playerId: string) {
  positionQueues.delete(playerId)
}

// --- Cleanup ---
export async function destroyRealtime() {
  if (channel) {
    try { await channel.unsubscribe() } catch {}
  }
  channel = null
  positionQueues.clear()
  updateSubscribers.clear()
  metaSubscribers.clear()
  metaCache.clear()
  lastPending = null
  if (sendTimer) {
    clearTimeout(sendTimer)
    sendTimer = null
  }
}

// --- Backward compatibility wrapper ---
export function createPlayerRealtime(options: {
  roomId: string
  me: PlayerMeta // includes Clerk userId, name, avatarUrl
  handlers?: {
    onPlayerPos?: (payload: PlayerPosPayload) => void
    onPresenceSync?: (state: Record<string, any[]>) => void
  }
}) {
  const { roomId, me, handlers } = options

  void initRealtime({
    roomId,
    playerId: me.userId,
    meta: { name: me.name, avatarUrl: me.avatarUrl },
  }).then(() => {
    // presence bridge compatibility (no-op but keeps old API happy)
    handlers?.onPresenceSync?.({})
  })

  const offUpdate = onPlayerUpdate((playerId, pos) => {
    if (playerId === me.userId) return
    const meta = getPlayerMeta(playerId)
    handlers?.onPlayerPos?.({
      userId: playerId,
      x: pos.x,
      y: pos.y,
      ts: pos.ts,
      name: meta?.name,
      avatarUrl: meta?.avatarUrl,
    })
  })

  const offMeta = onPlayerMeta(() => {
    // no-op; we fold meta into the next position callback for old consumers
  })

  return {
    broadcastPosition: (data: { x: number; y: number }) => sendPosition(data.x, data.y),
    destroy: async () => {
      offUpdate()
      offMeta()
      await destroyRealtime()
    },
    channel: null as any, // intentionally hidden
  }
}
