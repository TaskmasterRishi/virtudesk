import { PlayerMovement } from "./PlayerMovement";
import {
  createPlayerRealtime,
  getPlayerMeta,
  popNextPosition,
} from "../realtime/PlayerRealtime";
import {
  getOrSelectCharacter,
  getSpritePaths,
  CharacterSprite,
} from "../utils/spriteUtils";

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
    private selectedCharacter!: CharacterSprite;
    // Remote sprites keyed by playerId
    // Remote sprites keyed by playerId
    private remotePlayers: Record<string, any> = {};
    private prevRemotePos: Record<string, { x: number; y: number }> = {};
    private loadingTextures = new Set<string>(); // avoid duplicate loads

    constructor() {
      super("MapScene");
      // Select a random character for this player
      this.selectedCharacter = getOrSelectCharacter();
    }

    preload() {
      this.load.crossOrigin = "anonymous";
      this.load.image("tiles", "/assests/tiles.png", {
        scaleMode: Phaser.ScaleModes.NEAREST,
      });
      this.load.tilemapTiledJSON("map", "/assests/map1.json");
      
      // Load the selected character's sprite images
      const spritePaths = getSpritePaths(this.selectedCharacter);
      this.load.image("character_idle_img", spritePaths.idle);
      this.load.image("character_walk_img", spritePaths.walk);
      this.load.image("character_run_img", spritePaths.run);
      
      // Create a simple colored square as fallback for remote players
      const g = this.add.graphics();
      g.fillStyle(0x3498db, 1);
      g.fillRect(0, 0, 32, 32);
      g.generateTexture('player', 32, 32);
      g.destroy();
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
      const idle = sliceSheet("character_idle_img", this.selectedCharacter.idleFrames);
      const walk = sliceSheet("character_walk_img", this.selectedCharacter.walkFrames);
      const run = sliceSheet("character_run_img", this.selectedCharacter.runFrames);

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

      ensureAnim(this.selectedCharacter.animations.idle, "character_idle_img", idle.frameNames, 6);
      ensureAnim(this.selectedCharacter.animations.walk, "character_walk_img", walk.frameNames, 10);
      ensureAnim(this.selectedCharacter.animations.run, "character_run_img", run.frameNames, 12);

      // Create player sprite using first idle frame
      const firstFrame = idle.frameNames[0] ?? undefined;
      this.player = this.physics.add.sprite(x, y, "character_idle_img", firstFrame);

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
      this.player.anims.play(this.selectedCharacter.animations.idle);

      this.playerMovement = new PlayerMovement(
        this.player,
        this.cursors,
        this.wasd,
        90, // speed
        this.selectedCharacter.animations
      );

      if (this.wallsLayer) {
        this.physics.add.collider(this.player, this.wallsLayer, null, null, this);
      }
    }
    private ensureRemoteSprite(userId: string, _characterName?: string, x?: number, y?: number) {
      if (this.remotePlayers[userId]) {
        return this.remotePlayers[userId];
      }
      if (!this.physics) return null;

      // Use the same preloaded sheets as local
      const s = this.physics.add.sprite(x ?? 0, y ?? 0, "character_idle_img");
      s.setOrigin(0.5, 0.7).setDepth(9);

      // Match local player's scale EXACTLY
      if (this.player) {
        s.setScale(this.player.scaleX, this.player.scaleY);
      }

      const bodySize = Math.min(this.tileW, this.tileH) * 0.6;
      s.body.setCircle(
        bodySize / 2,
        -bodySize / 2 + (s.displayWidth / 2),
        -bodySize / 2 + (s.displayHeight / 2)
      );

      const idleKey = this.selectedCharacter.animations.idle;
      if (this.anims.exists(idleKey)) s.anims.play(idleKey, true);

      this.remotePlayers[userId] = s;
      if (this.wallsLayer) this.physics.add.collider(s, this.wallsLayer);
      return s;
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
          character: this.selectedCharacter.name,
        },
        handlers: {
          onPlayerPos: (p) => {
            if (p.userId === opts.userId) return;

            // Make sure we have a sprite & correct character
            const s = this.ensureRemoteSprite(p.userId, p.character, p.x, p.y);
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
                // Set collision for all non-empty tiles (any tile ID > 0)
                this.wallsLayer.setCollisionByExclusion([-1, 0], true);
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
                  this.wallsLayer.setCollisionByExclusion([-1, 0], true);
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
 
         const s = this.ensureRemoteSprite(id);
         if (!s) continue;
 
         const prev = this.prevRemotePos?.[id];
         const dx = prev ? sample.x - prev.x : 0;
         const dy = prev ? sample.y - prev.y : 0;
         const moving = Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1;
         const running = Math.abs(dx) > 1.0 || Math.abs(dy) > 1.0;
 
         const { idle, walk, run } = this.selectedCharacter.animations;
         if (moving) {
           const target = running && this.anims.exists(run) ? run : (this.anims.exists(walk) ? walk : undefined);
           if (target && s.anims?.currentAnim?.key !== target) s.anims.play(target, true);
         } else if (this.anims.exists(idle) && s.anims?.currentAnim?.key !== idle) {
           s.anims.play(idle, true);
         }
 
         if (dx !== 0) s.setFlipX(dx < 0);
         s.setPosition(sample.x, sample.y);
         this.prevRemotePos[id] = { x: sample.x, y: sample.y };
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
      this.prevRemotePos = {};
      this.loadingTextures.clear();
    }
  })();
}
