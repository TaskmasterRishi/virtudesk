// game/scenes/createMapScene.ts
export interface MapSceneOptions {
  avatarUrl: string
}

export function createMapScene(opts: MapSceneOptions, Phaser: any) {
  return new (class MapScene extends Phaser.Scene {
    player!: any
    cursors!: any
    wasd!: any
    mapW!: number
    mapH!: number

    constructor() {
      super('MapScene')
    }

    preload() {
      this.load.crossOrigin = 'anonymous'
      this.load.image('tiles', '/assests/tiles.png')
      this.load.tilemapTiledJSON('map', '/assests/map1.json')
      this.load.image('player', opts.avatarUrl)
    }

    private createPlayerAt(x: number, y: number, tileW: number, tileH: number) {
      this.player = this.physics.add.sprite(x, y, 'player')
      const size = Math.min(tileW, tileH)
      this.player.setOrigin(0.5, 0.5).setDepth(10)
      this.player.setDisplaySize(size, size)
      this.player.setCollideWorldBounds(true)
      this.player.body.setCircle(
        size / 2,
        (this.player.displayWidth - size) / 2,
        (this.player.displayHeight - size) / 2
      )
      this.cameras.main.roundPixels = true
      this.cameras.main.startFollow(this.player, true, 0.08, 0.08)
      this.cameras.main.setFollowOffset(0, 0)
    }

    create() {
      const keyboard = this.input.keyboard
      if (!keyboard) return

      this.cursors = keyboard.createCursorKeys()
      this.wasd = keyboard.addKeys('W,A,S,D')

      try {
        const map = this.make.tilemap({ key: 'map' })
        const tilesetName = map.tilesets[0]?.name || 'tiles'
        const tileset = map.addTilesetImage(tilesetName, 'tiles', 16, 16, 0, 0)
        if (!tileset) throw new Error('Failed to load tileset')

        const layerName = map.layers[0]?.name || 'Ground'
        map.createLayer(layerName, [tileset], 0, 0)

        const mapW = map.widthInPixels
        const mapH = map.heightInPixels
        this.mapW = mapW
        this.mapH = mapH

        const leftBound = map.tileWidth
        const rightBound = mapW - map.tileWidth * 2
        const topBound = map.tileHeight
        const bottomBound = mapH - map.tileHeight
        this.physics.world.setBounds(
          leftBound,
          topBound,
          rightBound - leftBound,
          bottomBound - topBound
        )
        this.cameras.main.setBounds(0, 0, mapW, mapH)
        this.cameras.main.setDeadzone(0, 0)

        const viewW = this.scale.width
        const viewH = this.scale.height
        const baseZoom = Math.min(viewW / mapW, viewH / mapH) || 1
        this.cameras.main.setZoom(baseZoom*1.5)

        const spawnX = map.tileWidth * 1.5
        const spawnY = map.tileHeight * 1.5
        this.createPlayerAt(spawnX, spawnY, map.tileWidth, map.tileHeight)
      } catch {
        fetch('/assests/map1.json')
          .then((r) => r.json())
          .then((json) => {
            const width = json.width
            const tileW = json.tilewidth
            const tileH = json.tileheight
            const firstgid = json.tilesets?.[0]?.firstgid ?? 1

            const flat = json.layers?.[0]?.data ?? []
            const normalized = flat.map((v: number) => (v === 0 ? -1 : v - firstgid))

            const grid: number[][] = []
            for (let i = 0; i < normalized.length; i += width) {
              grid.push(normalized.slice(i, i + width))
            }

            const map2 = this.make.tilemap({ data: grid, tileWidth: tileW, tileHeight: tileH })
            const tiles = map2.addTilesetImage('tiles', 'tiles', tileW, tileH, 0, 0)
            if (!tiles) throw new Error('Failed to load tileset')

            map2.createLayer(0, [tiles], 0, 0)

            const mapW = map2.widthInPixels
            const mapH = map2.heightInPixels
            this.mapW = mapW
            this.mapH = mapH

            const leftBound = tileW
            const rightBound = mapW - tileW * 2
            const topBound = tileH
            const bottomBound = mapH - tileH * 2
            this.physics.world.setBounds(
              leftBound,
              topBound,
              rightBound - leftBound,
              bottomBound - topBound
            )
            this.cameras.main.setBounds(0, 0, mapW, mapH)
            this.cameras.main.setDeadzone(0, 0)

            const viewW = this.scale.width
            const viewH = this.scale.height
            const baseZoom = Math.min(viewW / mapW, viewH / mapH) || 1
            this.cameras.main.setZoom(baseZoom*1.5)

            const spawnX = tileW * 100
            const spawnY = tileH * 100
            this.createPlayerAt(spawnX, spawnY, tileW, tileH)
          })
      }
    }

    update() {
      if (!this.player) return
      const speed = 150
      let vx = 0
      let vy = 0

      const left = this.cursors.left?.isDown || this.wasd.A.isDown
      const right = this.cursors.right?.isDown || this.wasd.D.isDown
      const up = this.cursors.up?.isDown || this.wasd.W.isDown
      const down = this.cursors.down?.isDown || this.wasd.S.isDown

      if (left) vx -= 1
      if (right) vx += 1
      if (up) vy -= 1
      if (down) vy += 1

      if (vx !== 0 || vy !== 0) {
        const len = Math.hypot(vx, vy) || 1
        vx = (vx / len) * speed
        vy = (vy / len) * speed
      }

      this.player.setVelocity(vx, vy)
    }
  })()
}