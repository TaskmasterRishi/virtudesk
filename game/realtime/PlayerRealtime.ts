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
  const { roomId, me, handlers, fps = 15 } = options

  const playerPositions = new Map<string, PlayerPosPayload>()
  const debounceTimers = new Map<string, NodeJS.Timeout>()
  const DEBOUNCE_DELAY = 100

  const channel = supabase.channel(`room:${roomId}`, {
    config: {
      broadcast: { self: false },
      presence: { key: me.userId },
    },
  })

  function processPlayerPosition(playerPayload: PlayerPosPayload) {
    playerPositions.set(playerPayload.userId, playerPayload)
    
    if (debounceTimers.has(playerPayload.userId)) {
      clearTimeout(debounceTimers.get(playerPayload.userId)!)
    }
    
    const timer = setTimeout(() => {
      const finalData = playerPositions.get(playerPayload.userId)
      if (finalData?.ts === playerPayload.ts) {
        handlers?.onPlayerPos?.(finalData)
      }
      debounceTimers.delete(playerPayload.userId)
    }, DEBOUNCE_DELAY)
    
    debounceTimers.set(playerPayload.userId, timer)
  }

  channel.on('broadcast', { event: 'player-pos' }, ({ payload }) => {
    try {
      const playerPayload = payload as PlayerPosPayload
      
      if (!playerPayload?.userId || typeof playerPayload.ts !== 'number') {
        console.warn('Invalid player position payload:', payload)
        return
      }
      
      if (playerPayload.userId === me.userId) return
      
      processPlayerPosition(playerPayload)
    } catch (error) {
      console.error('Error processing player position:', error)
    }
  })

  channel.on('presence', { event: 'sync' }, () => {
    try {
      handlers?.onPresenceSync?.(channel.presenceState())
    } catch (error) {
      console.error('Error in presence sync:', error)
    }
  })

  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      try {
        await channel.track({ ...me })
      } catch (error) {
        console.error('Error tracking presence:', error)
      }
    }
  })

  let lastSent = 0
  let latest: Omit<PlayerPosPayload, 'ts'> | null = null
  const intervalMs = Math.max(16, Math.floor(1000 / fps))
  const interval = setInterval(() => {
    if (!latest) return
    const now = Date.now()
    if (now - lastSent < intervalMs) return
    
    lastSent = now
    try {
      void channel.send({
        type: 'broadcast',
        event: 'player-pos',
        payload: { ...latest, ts: now },
      })
    } catch (error) {
      console.error('Error broadcasting position:', error)
    }
  }, intervalMs)

  function broadcastPosition(data: {
    x: number
    y: number
    vx?: number
    vy?: number
  }) {
    if (typeof data.x !== 'number' || typeof data.y !== 'number') {
      console.warn('Invalid position data:', data)
      return
    }
    
    latest = {
      userId: me.userId,
      name: me.name,
      avatarUrl: me.avatarUrl,
      ...data
    }
  }

  async function destroy() {
    clearInterval(interval)
    debounceTimers.forEach(timer => clearTimeout(timer))
    debounceTimers.clear()
    playerPositions.clear()
    
    try {
      await channel.untrack()
    } catch (error) {
      console.error('Error untracking presence:', error)
    } finally {
      try {
        await channel.unsubscribe()
      } catch (error) {
        console.error('Error unsubscribing:', error)
      }
    }
  }

  return {
    channel,
    broadcastPosition,
    destroy,
  }
}
