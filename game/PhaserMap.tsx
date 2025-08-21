// game/PhaserMap.tsx
'use client'

import { useUser } from '@clerk/nextjs'
import { createMapScene } from './scenes/createMapScene'
import { usePhaserGame } from '@/hooks/usePhaserGame'
import { defaultResize } from '@/hooks/resize'
import { useMemo } from 'react'

export default function PhaserMap({ roomId }: { roomId: string }) {
  const { user } = useUser()
  const me = useMemo(() => {
    const name =
      user?.fullName ??
      user?.username ??
      user?.primaryEmailAddress?.emailAddress ??
      'Anonymous'
    return {
      userId: user?.id ?? 'anon',
      name,
      avatarUrl: user?.imageUrl || '/logo.png',
    }
  }, [user])

  const createScenes = useMemo(
    () => (Phaser: any) =>
      [createMapScene(
        {
          roomId,
          userId: me.userId,
          name: me.name,
          avatarUrl: me.avatarUrl,
        },
        Phaser
      )],
    [roomId, me.userId, me.name, me.avatarUrl]
  )

  const { containerRef } = usePhaserGame({
    createScenes,
    onResize: defaultResize,
  })

  return <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 500 }} />
}