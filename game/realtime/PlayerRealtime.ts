// game/realtime/playerRealtime.ts
'use client'

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
  vx?: number
  vy?: number
  ts: number
  name?: string
  avatarUrl?: string
}

type Handlers = {
  onPlayerPos?: (payload: PlayerPosPayload) => void
  onPresenceSync?: (state: Record<string, any[]>) => void
}

export function createPlayerRealtime(options: {
  roomId: string
  me: PlayerMeta
  handlers?: Handlers
  fps?: number // default 15
}) {
  const { roomId, me, handlers, fps = 30 } = options

  const channel = supabase.channel(`room:${roomId}`, {
    config: {
      broadcast: { self: false },
      presence: { key: me.userId },
    },
  })

  // Listen for other players' position broadcasts
  channel.on('broadcast', { event: 'player-pos' }, ({ payload }) => {
    handlers?.onPlayerPos?.(payload as PlayerPosPayload)
  })

  // Presence sync (who's here)
  channel.on('presence', { event: 'sync' }, () => {
    handlers?.onPresenceSync?.(channel.presenceState())
  })

  // Join and announce presence metadata
  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track({ ...me })
    }
  })

  // Throttled broadcaster (default ~15 Hz)
  let lastSent = 0
  let latest: Omit<PlayerPosPayload, 'ts'> | null = null
  const intervalMs = Math.max(16, Math.floor(1000 / fps))
  const interval = setInterval(() => {
    if (!latest) return
    const now = Date.now()
    if (now - lastSent < intervalMs) return
    lastSent = now
    void channel.send({
      type: 'broadcast',
      event: 'player-pos',
      payload: { ...latest, ts: now },
    })
  }, intervalMs)

  function broadcastPosition(data: {
    x: number
    y: number
    vx?: number
    vy?: number
  }) {
    latest = {
      userId: me.userId,
      name: me.name,
      avatarUrl: me.avatarUrl,
      x: data.x,
      y: data.y,
      vx: data.vx,
      vy: data.vy,
    }
  }

  async function destroy() {
    clearInterval(interval)
    try {
      await channel.untrack()
    } finally {
      await channel.unsubscribe()
    }
  }

  return {
    channel,
    broadcastPosition,
    destroy,
  }
}
