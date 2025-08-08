// game/PhaserMap.tsx
'use client'

import { useUser } from '@clerk/nextjs'
import { createMapScene } from './scenes/createMapScene'
import { usePhaserGame } from '@/hooks/usePhaserGame'
import { defaultResize } from '@/hooks/resize'
import { useMemo } from 'react'

export default function PhaserMap() {
  const { user } = useUser()
  const avatarUrl = user?.imageUrl || '/logo.png'

  const createScenes = useMemo(
    () => (Phaser: any) => [createMapScene({ avatarUrl }, Phaser)],
    [avatarUrl]
  )

  const { containerRef } = usePhaserGame({
    createScenes,
    onResize: defaultResize,
  })

  return <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 500 }} />
}