import { PlayerMovement } from "./PlayerMovement";
import { createPlayerRealtime } from "@/game/realtime/PlayerRealtime";

export interface MapSceneOptions {
  roomId: string;
  userId: string;
  name?: string;
  avatarUrl: string;
}

export function createMapScene(opts: MapSceneOptions, Phaser: any) {
  return new (class MapScene extends Phaser.Scene {
    player!: any;
    cursors!: any;
    wasd!: any;
    mapW!: number;
    mapH!: number;
    tileW!: number;
    tileH!: number;
    private playerMovement!: PlayerMovement;
    private wallsLayer: any | null = null;
    private tilemap: any | null = null;
    private tileset: any | null = null;
    private rt: ReturnType<typeof createPlayerRealtime> | null = null;
    private remotePlayers: Record<string, any> = {};

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

    private ensureRemoteSprite(userId: string, avatarUrl?: string, x?: number, y?: number) {
      if (this.remotePlayers[userId]) return this.remotePlayers[userId];

      const size = Math.min(this.tileW ?? 16, this.tileH ?? 16);
      const key = `avatar:${userId}`;
      const createSprite = (texKey: string) => {
        const s = this.physics.add.sprite(x ?? 0, y ?? 0, texKey);
        s.setOrigin(0.5, 0.5).setDepth(9);
        s.setDisplaySize(size, size);
        s.body.setCircle(
          size / 2.2,
          (s.displayWidth - size) / 2,
          (s.displayHeight - size) / 2
        );
        this.remotePlayers[userId] = s;
        if (this.wallsLayer) this.physics.add.collider(s, this.wallsLayer);
        return s;
      };

      if (avatarUrl && !this.textures.exists(key)) {
        this.load.image(key, avatarUrl);
        this.load.once(Phaser.Loader.Events.COMPLETE, () => {
          if (!this.remotePlayers[userId]) createSprite(key);
        });
        this.load.start();
      } else if (this.textures.exists(key)) {
        createSprite(key);
      } else {
        createSprite("player");
      }
      return this.remotePlayers[userId];
    }

    private handlePresenceSync = (state: Record<string, any[]>) => {
      const present = new Set(Object.keys(state));
      Object.keys(this.remotePlayers).forEach((id) => {
        if (!present.has(id)) {
          this.remotePlayers[id]?.destroy();
          delete this.remotePlayers[id];
        }
      });
    };

    private initRealtime() {
      this.rt = createPlayerRealtime({
        roomId: opts.roomId,
        me: {
          userId: opts.userId,
          name: opts.name,
          avatarUrl: opts.avatarUrl,
        },
        handlers: {
          onPlayerPos: (p) => {
            if (p.userId === opts.userId) return;
            const s = this.ensureRemoteSprite(p.userId, p.avatarUrl, p.x, p.y);
            if (s) {
              s.setPosition(p.x, p.y);
              if (typeof p.vx === "number" && typeof p.vy === "number") {
                s.setVelocity(p.vx, p.vy);
              }
            }
          },
          onPresenceSync: this.handlePresenceSync,
        },
        fps: 15,
      });

      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.rt?.destroy();
        this.rt = null;
        Object.values(this.remotePlayers).forEach((s) => s.destroy());
        this.remotePlayers = {};
      });
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
        this.tileW = map.tileWidth;
        this.tileH = map.tileHeight;

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
        const desiredZoom = Math.max(1, Math.min(4, Math.round(baseZoom * 2)));
        this.cameras.main.setZoom(desiredZoom);

        const spawnX = map.tileWidth * 1.5;
        const spawnY = map.tileHeight * 1.5;
        this.createPlayerAt(spawnX, spawnY, map.tileWidth, map.tileHeight);

        this.initRealtime();
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
            this.tileW = tileW;
            this.tileH = tileH;

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

            this.initRealtime();
          });
      }
    }

    update(time: number, delta: number) {
      this.playerMovement?.update(time, delta);
      if (this.player && this.rt) {
        const vx = this.player.body?.velocity?.x ?? 0;
        const vy = this.player.body?.velocity?.y ?? 0;
        this.rt.broadcastPosition({
          x: this.player.x,
          y: this.player.y,
          vx,
          vy,
        });
      }
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
      this.rt?.destroy();
      this.rt = null;
      Object.values(this.remotePlayers).forEach((s) => s.destroy());
      this.remotePlayers = {};
    }
  })();
}