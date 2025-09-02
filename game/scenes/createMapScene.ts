import { PlayerMovement } from "./PlayerMovement";
import {
  createPlayerRealtime,
  getPlayerMeta,
  popNextPosition,
} from "../realtime/PlayerRealtime";

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

    // Remote sprites keyed by playerId
    private remotePlayers: Record<string, any> = {};
    private loadingTextures = new Set<string>(); // avoid duplicate loads

    constructor() {
      super("MapScene");
    }

    preload() {
      this.load.crossOrigin = "anonymous";
      this.load.image("tiles", "/assests/tiles.png", {
        scaleMode: Phaser.ScaleModes.NEAREST,
      });
      this.load.tilemapTiledJSON("map", "/assests/map1.json");
      // Local player's sprite images (Pink Monster)
      this.load.image(
        "pink_idle_img",
        "/sprites/1 Pink_Monster/Pink_Monster_Idle_4.png"
      );
      this.load.image(
        "pink_walk_img",
        "/sprites/1 Pink_Monster/Pink_Monster_Walk_6.png"
      );
      this.load.image(
        "pink_run_img",
        "/sprites/1 Pink_Monster/Pink_Monster_Run_6.png"
      );
    }

    private createPlayerAt(x: number, y: number, tileW: number, tileH: number) {
      // Slice helper: split a single-row sheet into frames and register them on the texture
      const sliceSheet = (imgKey: string, frames: number) => {
        const tex = this.textures.get(imgKey);
        // If texture not ready, skip (shouldn't happen because we load in preload)
        if (!tex) return { frameNames: [] as string[], fw: 0, fh: 0 };
        const src = tex.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
        const totalW = src.width as number;
        const totalH = src.height as number;
        const frameWidth = Math.floor(totalW / frames);
        const frameHeight = totalH;
        const names: string[] = [];
        for (let i = 0; i < frames; i++) {
          const name = `${imgKey}_${i}`;
          // add(name, sourceIndex, x, y, width, height)
          tex.add(name, 0, i * frameWidth, 0, frameWidth, frameHeight);
          names.push(name);
        }
        return { frameNames: names, fw: frameWidth, fh: frameHeight };
      };

      // Prepare frames and animations (idle + walk + run)
      const idle = sliceSheet("pink_idle_img", 4);
      const walk = sliceSheet("pink_walk_img", 6);
      const run = sliceSheet("pink_run_img", 6);

      const ensureAnim = (
        key: string,
        imgKey: string,
        names: string[],
        frameRate: number
      ) => {
        if (this.anims.exists(key)) return;
        this.anims.create({
          key,
          frames: names.map((n) => ({ key: imgKey, frame: n })),
          frameRate,
          repeat: -1,
        });
      };

      ensureAnim("pink_idle", "pink_idle_img", idle.frameNames, 6);
      ensureAnim("pink_walk", "pink_walk_img", walk.frameNames, 10);
      ensureAnim("pink_run", "pink_run_img", run.frameNames, 12);

      // Create player sprite using first idle frame
      const firstFrame = idle.frameNames[0] ?? undefined;
      this.player = this.physics.add.sprite(x, y, "pink_idle_img", firstFrame);

      const desiredH = Math.min(tileH * 1.2, tileH * 1.6);
      const scale = desiredH / (idle.fh || tileH);
      this.player.setOrigin(0.5, 0.7).setDepth(10);
      this.player.setScale(scale);
      this.player.setCollideWorldBounds(true);

      // Body as a circle that roughly fits character feet/torso
      const bodySize = Math.min(tileW, tileH) * 0.6;
      this.player.body.setCircle(
        bodySize / 2,
        -bodySize / 2 + (this.player.displayWidth / 2),
        -bodySize / 2 + (this.player.displayHeight / 2)
      );

      // Camera follow
      this.cameras.main.roundPixels = true;
      this.cameras.main.startFollow(this.player, true, 1, 1);
      this.cameras.main.setFollowOffset(0, 0);

      // Start idle by default
      this.player.anims.play("pink_idle");

      this.playerMovement = new PlayerMovement(
        this.player,
        this.cursors,
        this.wasd
      );

      if (this.wallsLayer) {
        this.physics.add.collider(this.player, this.wallsLayer, null, null, this);
      }
    }

    /**
     * Ensure a remote sprite exists and has the correct avatar texture.
     * If avatar isn't loaded yet, load it and then swap texture.
     */
    private ensureRemoteSprite(userId: string, avatarUrl?: string, x?: number, y?: number) {
      // Check if sprite already exists
      if (this.remotePlayers[userId]) {
        // If avatarUrl was provided later, make sure texture is applied once loaded
        if (avatarUrl) this.ensureAvatarTexture(userId, avatarUrl);
        return this.remotePlayers[userId];
      }

      if (!this.physics) {
        console.warn("Physics system not available; cannot create remote sprite");
        return null;
      }

      const size = Math.min(this.tileW ?? 16, this.tileH ?? 16);
      const defaultKey = "player"; // fallback
      const avatarKey = `avatar:${userId}`;

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

      // If we already have the texture cached, use it
      if (this.textures.exists(avatarKey)) {
        return createSprite(avatarKey);
      }

      // Create sprite with default texture first
      const sprite = createSprite(defaultKey);

      // If we know an avatar URL, load it and swap when ready
      if (avatarUrl) this.ensureAvatarTexture(userId, avatarUrl);

      return sprite;
    }

    private ensureAvatarTexture(userId: string, avatarUrl: string) {
      const avatarKey = `avatar:${userId}`;
      if (this.textures.exists(avatarKey)) {
        // Already loaded; just set it if sprite exists
        this.remotePlayers[userId]?.setTexture(avatarKey);
        return;
      }
      if (this.loadingTextures.has(avatarKey)) return;

      this.loadingTextures.add(avatarKey);
      this.load.image(avatarKey, avatarUrl);
      this.load.once(Phaser.Loader.Events.COMPLETE, () => {
        this.loadingTextures.delete(avatarKey);
        if (this.remotePlayers[userId]) {
          this.remotePlayers[userId].setTexture(avatarKey);
        }
      });
      this.load.start();
    }

    // Optional: if you later wire presence, you could use this to prune sprites.
    private handlePresenceSync = (_state: Record<string, any[]>) => {
      // Keeping as a stub for compatibility.
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

            // Make sure we have a sprite & correct avatar
            const s = this.ensureRemoteSprite(p.userId, p.avatarUrl, p.x, p.y);
            if (!s) return;

            // We rely on queue popping in update(); here we could optionally seed position
            // to reduce initial snap on first packet.
            if (!s.body || (s.x === 0 && s.y === 0)) {
              s.setPosition(p.x, p.y);
            }
          },
          onPresenceSync: this.handlePresenceSync,
        },
      });

      // Always cleanup
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

      // Build map (with safe fallback if tileset name differs in JSON)
      try {
        const map = this.make.tilemap({ key: "map" });
        this.tilemap = map;

        const tilesetName = map.tilesets?.[0]?.name || "tiles";
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
        // JSON fallback (if createFromJSON path fails due to name mismatches)
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

      // broadcast my position
      if (this.player && this.rt) {
        this.rt.broadcastPosition({
          x: this.player.x,
          y: this.player.y,
        });
      }

      // drain one queued sample per remote player each frame (smooth stepping)
      const ids = Object.keys(this.remotePlayers);
      for (const id of ids) {
        if (id === opts.userId) continue;

        const sample = popNextPosition(id);
        if (!sample) continue;

        const s = this.ensureRemoteSprite(id, getPlayerMeta(id)?.avatarUrl);
        if (!s) continue;

        // simple step; for interpolation you can tween or lerp here
        s.setPosition(sample.x, sample.y);
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
      this.loadingTextures.clear();
    }
  })();
}
