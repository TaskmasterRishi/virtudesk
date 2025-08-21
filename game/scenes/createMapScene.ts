import { PlayerMovement } from "./PlayerMovement";

export interface MapSceneOptions {
  avatarUrl: string;
}

export function createMapScene(opts: MapSceneOptions, Phaser: any) {
  return new (class MapScene extends Phaser.Scene {
    player!: any;
    cursors!: any;
    wasd!: any;
    mapW!: number;
    mapH!: number;
    private playerMovement!: PlayerMovement;
    private wallsLayer: any | null = null;
    private tilemap: any | null = null;
    private tileset: any | null = null;

    constructor() {
      super("MapScene");
    }

    preload() {
      this.load.crossOrigin = "anonymous";
      this.load.image("tiles", "/assests/tiles.png", {
        scaleMode: Phaser.ScaleModes.NEAREST,
      });
      this.load.tilemapTiledJSON("map", "/assests/map1.json");
      this.load.image("player", opts.avatarUrl);
    }

    private createPlayerAt(x: number, y: number, tileW: number, tileH: number) {
      this.player = this.physics.add.sprite(x, y, "player");
      const size = Math.min(tileW, tileH);
      this.player.setOrigin(0.5, 0.5).setDepth(10);
      this.player.setDisplaySize(size, size);
      this.player.setCollideWorldBounds(true);
      this.player.body.setCircle(
        size / 2.2,
        (this.player.displayWidth - size) / 2,
        (this.player.displayHeight - size) / 2
      );

      this.cameras.main.roundPixels = true;
      // Remove smoothing to avoid sub-pixel camera positions (causes seams)
      this.cameras.main.startFollow(this.player, true, 1, 1);
      this.cameras.main.setFollowOffset(0, 0);

      this.playerMovement = new PlayerMovement(
        this.player,
        this.cursors,
        this.wasd
      );

      if (this.wallsLayer) {
        this.physics.add.collider(this.player, this.wallsLayer, null, null, this);
      }
    }

    create() {
      const keyboard = this.input.keyboard;
      if (!keyboard) return;

      this.cursors = keyboard.createCursorKeys();
      this.wasd = keyboard.addKeys("W,A,S,D");

      try {
        const map = this.make.tilemap({ key: "map" });
        this.tilemap = map;

        const tilesetName = map.tilesets[0]?.name || "tiles";
        const tileset = map.addTilesetImage(tilesetName, "tiles", 16, 16, 0, 0);
        if (!tileset) throw new Error("Failed to load tileset");
        this.tileset = tileset;

        map.layers.forEach((layer: any) => {
          if (layer.type === "tilelayer") {
            const createdLayer = map.createLayer(layer.name, [tileset], 0, 0);
            if (createdLayer) {
              createdLayer.setDepth(layer.id);
              createdLayer.setVisible(layer.visible);
              createdLayer.setCullPadding(2, 2);
              if (layer.name === "walls") {
                this.wallsLayer = createdLayer;
                this.wallsLayer.setCollisionByExclusion([-1], true);
                this.wallsLayer.setCollisionFromCollisionGroup();
              }
            }
          }
        });

        const mapW = map.widthInPixels;
        const mapH = map.heightInPixels;
        this.mapW = mapW;
        this.mapH = mapH;

        const insetX = map.tileWidth * 0.5;
        const insetY = map.tileHeight * 0.5;
        const leftBound = insetX;
        const rightBound = mapW - insetX;
        const topBound = insetY;
        const bottomBound = mapH - insetY;

        this.physics.world.setBounds(
          leftBound,
          topBound,
          rightBound - leftBound,
          bottomBound - topBound
        );
        this.cameras.main.setBounds(0, 0, mapW, mapH);
        this.cameras.main.setRoundPixels(true);
        this.cameras.main.setDeadzone(0, 0);

        const viewW = this.scale.width;
        const viewH = this.scale.height;
        const baseZoom = Math.min(viewW / mapW, viewH / mapH) || 1;
        // Use integer zoom to avoid tile seams
        const desiredZoom = Math.max(1, Math.min(4, Math.round(baseZoom * 2)));
        this.cameras.main.setZoom(desiredZoom);

        const spawnX = map.tileWidth * 1.5;
        const spawnY = map.tileHeight * 1.5;
        this.createPlayerAt(spawnX, spawnY, map.tileWidth, map.tileHeight);
      } catch {
        fetch("/assests/map1.json")
          .then((r) => r.json())
          .then((json) => {
            const width = json.width;
            const height = json.height;
            const tileW = json.tilewidth;
            const tileH = json.tileheight;
            const firstgid = json.tilesets?.[0]?.firstgid ?? 1;

            const map2 = this.make.tilemap({
              tileWidth: tileW,
              tileHeight: tileH,
              width,
              height,
            });
            this.tilemap = map2;

            const tiles = map2.addTilesetImage(
              "tiles",
              "tiles",
              tileW,
              tileH,
              0,
              0
            );
            if (!tiles) throw new Error("Failed to load tileset");
            this.tileset = tiles;

            json.layers
              .filter((l: any) => l.type === "tilelayer")
              .forEach((l: any, idx: number) => {
                const flat: number[] = l.data ?? [];
                const normalized = flat.map((v: number) =>
                  v === 0 ? -1 : v - firstgid
                );
                const grid: number[][] = [];
                for (let i = 0; i < normalized.length; i += width) {
                  grid.push(normalized.slice(i, i + width));
                }

                const layer = map2.createBlankLayer(
                  l.name,
                  tiles,
                  0,
                  0,
                  width,
                  height
                );
                layer.putTilesAt(grid, 0, 0);
                layer.setDepth(l.id ?? idx);
                layer.setVisible(l.visible !== false);
                layer.setCullPadding(2, 2);
                if (l.name === "walls") {
                  this.wallsLayer = layer;
                  this.wallsLayer.setCollisionByExclusion([-1], true);
                  this.wallsLayer.setCollisionFromCollisionGroup();
                }
              });

            const mapW = map2.widthInPixels;
            const mapH = map2.heightInPixels;
            this.mapW = mapW;
            this.mapH = mapH;

            const leftBound = tileW;
            const rightBound = mapW - tileW * 2;
            const topBound = tileH;
            const bottomBound = mapH - tileH * 2;
            this.physics.world.setBounds(
              leftBound,
              topBound,
              rightBound - leftBound,
              bottomBound - topBound
            );
            this.cameras.main.setBounds(0, 0, mapW, mapH);
            this.cameras.main.setRoundPixels(true);
            this.cameras.main.setDeadzone(0, 0);

            const viewW = this.scale.width;
            const viewH = this.scale.height;
            const baseZoom = Math.min(viewW / mapW, viewH / mapH) || 1;
            const desiredZoom = Math.max(1, Math.min(4, Math.round(baseZoom * 2)));
            this.cameras.main.setZoom(desiredZoom);

            const spawnX = tileW * 30;
            const spawnY = tileH * 50;
            this.createPlayerAt(spawnX, spawnY, tileW, tileH);
          });
      }
    }

    update(time: number, delta: number) {
      this.playerMovement?.update(time, delta);
    }

    shutdown() {
      if (this.tilemap) {
        this.tilemap.destroy();
        this.tilemap = null;
      }
      if (this.tileset?.destroy) {
        this.tileset.destroy();
        this.tileset = null;
      }
      this.wallsLayer = null;
    }
  })();
}