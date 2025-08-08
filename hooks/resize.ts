// game/utils/resize.ts
export function defaultResize(game: any, container: HTMLDivElement) {
    const scene: any = game.scene.getScene('MapScene')
    if (scene?.cameras?.main && scene?.physics?.world?.bounds) {
      const mapW = scene.physics.world.bounds.width
      const mapH = scene.physics.world.bounds.height
      const nw = container.clientWidth ?? 960
      const nh = container.clientHeight ?? 640
      const base = Math.min(nw / mapW, nh / mapH) || 1
      const desired = base * 2
      scene.cameras.main.setZoom(Math.max(0.25, Math.min(desired, 4)))
    }
  }