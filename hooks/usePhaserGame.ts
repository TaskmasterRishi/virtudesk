// game/hooks/usePhaserGame.ts
'use client'

import { useEffect, useRef, useCallback } from 'react'

type CreateScenes = (Phaser: any) => any[]

export function usePhaserGame(options: {
  createScenes: CreateScenes
  onResize?: (game: any, container: HTMLDivElement) => void
}) {
  const { createScenes, onResize } = options
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<any>(null)

  const handleResize = useCallback(() => {
    const container = containerRef.current
    const game = gameRef.current
    if (!container || !game) return

    const w = container.clientWidth || 960
    const h = container.clientHeight || 640
    game.scale.resize(w, h)
    onResize?.(game, container)
  }, [onResize])

  useEffect(() => {
    let destroyed = false

    const init = async () => {
      const Phaser = (await import('phaser')).default
      if (destroyed || !containerRef.current) return

      const w = containerRef.current.clientWidth || 960
      const h = containerRef.current.clientHeight || 640

      const game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: containerRef.current,
        width: w,
        height: h,
        pixelArt: true,
        render: {
          pixelArt: true,
          antialias: false,
        },
        backgroundColor: '#1e1e1e',
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
          width: w,
          height: h,
        },
        physics: {
          default: 'arcade',
          arcade: {
            gravity: { x: 0, y: 0 },
            debug: false,
            fixedStep: true,
          },
        },
        scene: createScenes(Phaser),
      })

      gameRef.current = game

      window.addEventListener('resize', handleResize)

      const container = containerRef.current
      const ro = new ResizeObserver(() => handleResize())
      ro.observe(container)

      handleResize()

      return () => ro.disconnect()
    }

    init()

    return () => {
      destroyed = true
      window.removeEventListener('resize', handleResize)
      gameRef.current?.destroy(true)
      gameRef.current = null
    }
  }, [createScenes, handleResize])

  return { containerRef, gameRef, handleResize }
}