import { PlayerMovement } from "./PlayerMovement";
import {
  createPlayerRealtime,
  popNextPosition,
  getAllPlayers,
} from "../realtime/PlayerRealtime";
import {
  AVAILABLE_SPRITES,
  getCharacterByName,
  getSpritePaths,
  CharacterSprite,
} from "../utils/spriteUtils";
import { supabase } from "@/utils/supabase/client";
import { onChatInputFocusChange } from "../chatState"; // Import onChatInputFocusChange
import { getWhiteboardOpen } from "../whiteboardState";

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
    private remotePlayers: Record<string, any> = {};
    private prevRemotePos: Record<string, { x: number; y: number }> = {};
    private loadingTextures = new Set<string>(); // avoid duplicate loads
    private perPlayerChar: Record<string, CharacterSprite> = {};
    // HTML overlay elements for crisp text rendering
    private playerNameElement: HTMLElement | null = null;
    private remoteNameElements: Record<string, HTMLElement> = {};
    private gameContainer: HTMLElement | null = null;

    constructor() {
      super("MapScene");
      // will be set from Supabase in create(); default fallback
      this.selectedCharacter = AVAILABLE_SPRITES[0];
    }

    private getGameContainer(): HTMLElement | null {
      if (!this.gameContainer) {
        this.gameContainer = this.game.canvas.parentElement;
      }
      return this.gameContainer;
    }

    private createNameOverlay(name: string, isLocalPlayer: boolean = false): HTMLElement {
      const container = this.getGameContainer();
      if (!container) return document.createElement('div');

      const overlay = document.createElement('div');
      overlay.className = 'player-name-overlay';
      overlay.textContent = name;
      
      // Crisp CSS styling
      Object.assign(overlay.style, {
        position: 'absolute',
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        fontWeight: '600',
        color: '#ffffff',
        textAlign: 'center',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        userSelect: 'none',
        zIndex: '1000',
        textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8), -1px -1px 2px rgba(0, 0, 0, 0.8)',
        background: 'rgba(0, 0, 0, 0.6)',
        padding: '2px 6px',
        borderRadius: '4px',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        backdropFilter: 'blur(2px)',
        transform: 'translate(-50%, -100%)',
        transition: 'opacity 0.2s ease',
      });

      // Add special styling for local player
      if (isLocalPlayer) {
        overlay.style.border = '1px solid rgba(59, 130, 246, 0.5)';
        overlay.style.background = 'rgba(59, 130, 246, 0.2)';
      }

      container.appendChild(overlay);
      return overlay;
    }

    private updateNameOverlayPosition(element: HTMLElement, worldX: number, worldY: number) {
      if (!element || !this.cameras.main) return;

      // Hide name overlays when whiteboard is open
      if (getWhiteboardOpen()) {
        element.style.display = 'none';
        return;
      }

      // Show name overlays when whiteboard is closed
      element.style.display = 'block';

      // Convert world coordinates to screen coordinates
      const camera = this.cameras.main;
      const screenX = (worldX - camera.worldView.x) * camera.zoom;
      const screenY = (worldY - camera.worldView.y) * camera.zoom;

      // Get canvas position
      const canvas = this.game.canvas;
      const canvasRect = canvas.getBoundingClientRect();
      
      // Position relative to canvas
      element.style.left = `${canvasRect.left + screenX}px`;
      element.style.top = `${canvasRect.top + screenY - 8}px`;
    }

    private destroyNameOverlay(element: HTMLElement | null) {
      if (element && element.parentNode) {
        element.parentNode.removeChild(element);
      }
    }

    private loadAllCharacters() {
      for (const c of AVAILABLE_SPRITES) {
        const paths = getSpritePaths(c);
        const idleKey = `${c.name}_idle_img`;
        const walkKey = `${c.name}_walk_img`;
        const runKey = `${c.name}_run_img`;

        if (!this.textures.exists(idleKey)) {
          this.load.image(idleKey, paths.idle);
        }
        if (!this.textures.exists(walkKey)) {
          this.load.image(walkKey, paths.walk);
        }
        if (!this.textures.exists(runKey)) {
          this.load.image(runKey, paths.run);
        }
      }
    }

    preload() {
      this.load.crossOrigin = "anonymous";  // Keep if needed for external assets
      this.load.image("tiles", "/assests/tiles.png", {
        scaleMode: Phaser.ScaleModes.NEAREST,
      });
      this.load.tilemapTiledJSON("map", "/assests/map2.json");

      // Preload all characters to avoid async race with Supabase fetch
      this.loadAllCharacters();

      // Fallback texture
      const g = this.add.graphics();
      g.fillStyle(0x3498db, 1);
      g.fillRect(0, 0, 32, 32);
      g.generateTexture("player", 32, 32);
      g.destroy();
    }

    private ensureAnimsFor(char: CharacterSprite) {
      const sliceSheet = (imgKey: string, frames: number) => {
        const tex = this.textures.get(imgKey);
        if (!tex) {
          return { frameNames: [] as string[], fw: 0, fh: 0 };
        }

        // Check if frames already exist to avoid re-slicing
        const expectedFirst = `${imgKey}_0`;
        if ((tex as any).frames && (tex as any).frames[expectedFirst]) {
          const names = Array.from(
            { length: frames },
            (_, i) => `${imgKey}_${i}`
          );
          return { frameNames: names, fw: 0, fh: 0 };
        }

        const src = tex.getSourceImage() as
          | HTMLImageElement
          | HTMLCanvasElement;
        const totalW = (src as any).width as number;
        const totalH = (src as any).height as number;
        const frameWidth = Math.floor(totalW / frames);
        const frameHeight = totalH;

        const names: string[] = [];
        for (let i = 0; i < frames; i++) {
          const name = `${imgKey}_${i}`;
          tex.add(name, 0, i * frameWidth, 0, frameWidth, frameHeight);
          names.push(name);
        }
        return { frameNames: names, fw: frameWidth, fh: frameHeight };
      };

      const idleKey = `${char.name}_idle_img`;
      const walkKey = `${char.name}_walk_img`;
      const runKey = `${char.name}_run_img`;

      const idle = sliceSheet(idleKey, char.idleFrames);
      const walk = sliceSheet(walkKey, char.walkFrames);
      const run = sliceSheet(runKey, char.runFrames);

      const ensureAnim = (
        key: string,
        imgKey: string,
        names: string[],
        frameRate: number
      ) => {
        if (this.anims.exists(key) || !names.length) return;
        this.anims.create({
          key,
          frames: names.map((n) => ({ key: imgKey, frame: n })),
          frameRate,
          repeat: -1,
        });
      };

      ensureAnim(char.animations.idle, idleKey, idle.frameNames, 6);
      ensureAnim(char.animations.walk, walkKey, walk.frameNames, 10);
      ensureAnim(char.animations.run, runKey, run.frameNames, 12);
    }

    private createPlayerAt(x: number, y: number, tileW: number, tileH: number) {
      const char = this.selectedCharacter;
      this.ensureAnimsFor(char);

      const firstFrame = `${char.name}_idle_img_0`;
      this.player = this.physics.add.sprite(x, y, `${char.name}_idle_img`, firstFrame);
      const scale = ((tileH) / (this.textures.get(`${char.name}_idle_img`)?.getSourceImage() as any)?.height) * 1.5 || 1;
      this.player.setOrigin(0.5, 0.7).setDepth(10);
      this.player.setScale(scale);
      this.player.setCollideWorldBounds(true);

      const bodySize = Math.min(tileW, tileH) * 0.6;
      const legExtension = tileH;
      this.player.body.setSize(bodySize, bodySize + legExtension);

      this.cameras.main.roundPixels = true;
      this.cameras.main.startFollow(this.player, true, 1, 1);
      this.cameras.main.setFollowOffset(0, 0);

      // Play idle only if animation exists
      if (this.anims.exists(char.animations.idle)) {
        this.player.anims.play(char.animations.idle);
      }

      this.playerMovement = new PlayerMovement(
        this.player,
        this.cursors,
        this.wasd,
        90,
        char.animations
      );

      if (this.wallsLayer) {
        this.physics.add.collider(this.player, this.wallsLayer, null, null, this);
      }

      // Remember my character for meta
      this.perPlayerChar[opts.userId] = char;

      // --- PLAYER NAME LABEL (HTML OVERLAY) ---
      if (this.playerNameElement) {
        this.destroyNameOverlay(this.playerNameElement);
      }
      
      const playerName = opts.name || "Player";
      this.playerNameElement = this.createNameOverlay(playerName, true);
      // --- END PLAYER NAME LABEL ---
    }

    // --- FIXED REMOTE SPRITE/ANIMATION LOGIC ---
    private ensureRemoteSprite(
      userId: string,
      characterName?: string,
      x?: number,
      y?: number
    ) {
      // Check if scene is still active
      if (
        !this.add ||
        !this.scene ||
        typeof this.scene.isActive !== "function" ||
        this.scene.isActive() === false
      ) {
        return null;
      }

      let s = this.remotePlayers[userId];
      const char = characterName
        ? getCharacterByName(characterName) ?? AVAILABLE_SPRITES[0]
        : this.perPlayerChar[userId] ?? AVAILABLE_SPRITES[0];
      this.perPlayerChar[userId] = char;

      this.ensureAnimsFor(char);

      if (!s) {
        s = this.add.sprite(x ?? 0, y ?? 0, `${char.name}_idle_img`);
        s.setOrigin(0.5, 0.7).setDepth(9);
        if (this.player) s.setScale(this.player.scaleX, this.player.scaleY);
        this.remotePlayers[userId] = s;
      } else {
        const desiredTex = `${char.name}_idle_img`;
        if (s.texture?.key !== desiredTex) {
          s.anims?.stop();
          s.setTexture(desiredTex);
        }
      }

      // Play idle only if animation exists
      if (this.anims.exists(char.animations.idle)) {
        s.anims.play(char.animations.idle, true);
      }

          // --- REMOTE PLAYER NAME LABEL (HTML OVERLAY) ---
          if (this.remoteNameElements[userId]) {
            this.destroyNameOverlay(this.remoteNameElements[userId]);
          }
          
          // Get the correct name for this user
          let remoteName = userId;
          const allPlayers = getAllPlayers();
          const found = allPlayers.find(p => p.id === userId);
          if (found && found.name) remoteName = found.name;
    
          this.remoteNameElements[userId] = this.createNameOverlay(remoteName, false);
          // --- END REMOTE PLAYER NAME LABEL ---
      return s;
    }

    private handlePresenceSync = (_state: Record<string, any[]>) => {};

    private async pickUserCharacter() {
      try {
        const { data, error } = await supabase
          .from("user_characters")
          .select("character_id")
          .eq("user_id", opts.userId)
          .single();

        if (!error && data?.character_id) {
          const byName = getCharacterByName(data.character_id);
          this.selectedCharacter = byName ?? AVAILABLE_SPRITES[0];
        } else {
          this.selectedCharacter = AVAILABLE_SPRITES[0];
        }
      } catch {
        this.selectedCharacter = AVAILABLE_SPRITES[0];
      }
    }

    private initRealtime() {
      this.rt = createPlayerRealtime({
        roomId: opts.roomId,
        me: {
          userId: opts.userId,
          name: opts.name,
          character: this.selectedCharacter.name,
          avatar: opts.avatarUrl,
        },
        handlers: {
          onPlayerPos: (p) => {
            if (p.userId === opts.userId) return;

            const s = this.ensureRemoteSprite(p.userId, p.character, p.x, p.y);
            if (!s) return;

            s.setPosition(p.x, p.y);

            const prev = this.prevRemotePos?.[p.userId];
            const dx = prev ? p.x - prev.x : 0;
            const dy = prev ? p.y - prev.y : 0;
            const moving = Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1;
            const running = Math.abs(dx) > 1.0 || Math.abs(dy) > 1.0;

            const char = this.perPlayerChar[p.userId] ?? AVAILABLE_SPRITES[0];
            const { idle, walk, run } = char.animations;

            if (moving) {
              const target =
                running && this.anims.exists(run)
                  ? run
                  : this.anims.exists(walk)
                  ? walk
                  : idle;
              if (target && s.anims?.currentAnim?.key !== target) {
                s.anims.play(target, true);
              }
            } else if (
              this.anims.exists(idle) &&
              s.anims?.currentAnim?.key !== idle
            ) {
              s.anims.play(idle, true);
            }

            if (dx !== 0) s.setFlipX(dx < 0);
            this.prevRemotePos[p.userId] = { x: p.x, y: p.y };
          },
          onPresenceSync: this.handlePresenceSync,
        },
      });

      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.rt?.destroy();
        this.rt = null;
        Object.values(this.remotePlayers).forEach((s) => s.destroy());
        this.remotePlayers = {};
      });
    }

    private setupMapBounds(
      mapW: number,
      mapH: number,
      tileW: number,
      tileH: number
    ) {
      const insetX = tileW * 0.5;
      const insetY = tileH * 0.5;
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
    }

    private setupCameraZoom(mapW: number, mapH: number) {
      this.cameras.main.setZoom(2.7);
    }

    private createMapFromJSON(json: any) {
      const width = json.width;
      const height = json.height;
      const tileW = json.tilewidth;
      const tileH = json.tileheight;
      const firstgid = json.tilesets?.[0]?.firstgid ?? 1;

      const map = this.make.tilemap({
        tileWidth: tileW,
        tileHeight: tileH,
        width,
        height,
      });
      this.tilemap = map;

      const tiles = map.addTilesetImage("tiles", "tiles", tileW, tileH, 0, 0);
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

          const layer = map.createBlankLayer(
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

      return { map, tileW, tileH };
    }

    async create() {
      const keyboard = this.input.keyboard;
      if (!keyboard) return;

      this.cursors = keyboard.createCursorKeys();
      this.wasd = keyboard.addKeys("W,A,S,D");

      // Subscribe to chat focus changes to enable/disable Phaser input
      const offChatFocus = onChatInputFocusChange((isFocused) => {
        if (keyboard) {
          keyboard.enabled = !isFocused;
        }
      });
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => offChatFocus());

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

        this.setupMapBounds(mapW, mapH, this.tileW, this.tileH);
        this.setupCameraZoom(mapW, mapH);

        // Pick user character from Supabase
        await this.pickUserCharacter();

        // Ensure animations exist for my char and create me
        const spawnX = this.mapW / 2;
        const spawnY = this.mapH - 2 * this.tileH;
        this.createPlayerAt(spawnX, spawnY, this.tileW, this.tileH);
        this.initRealtime();
      } catch {
        const json = await fetch("/assests/map1.json").then((r) => r.json());
        const { map, tileW, tileH } = this.createMapFromJSON(json);
        this.mapW = map.widthInPixels;
        this.mapH = map.heightInPixels;
        this.tileW = tileW;
        this.tileH = tileH;

        this.setupMapBounds(this.mapW, this.mapH, tileW, tileH);
        this.setupCameraZoom(this.mapW, this.mapH);

        await this.pickUserCharacter();

        const spawnX = this.mapW / 2;
        const spawnY = this.mapH - 2 * tileH;
        this.createPlayerAt(spawnX, spawnY, tileW, tileH);
        this.initRealtime();
      }
    }

    update(time: number, delta: number) {
      this.playerMovement?.update(time, delta);

      // Update HTML overlay positions
      if (this.player && this.playerNameElement) {
        this.updateNameOverlayPosition(
          this.playerNameElement,
          this.player.x,
          this.player.y - this.player.displayHeight / 2 - 8
        );
      }

      for (const userId in this.remotePlayers) {
        const s = this.remotePlayers[userId];
        const element = this.remoteNameElements[userId];
        if (s && element) {
          this.updateNameOverlayPosition(
            element,
            s.x,
            s.y - s.displayHeight / 2 - 8
          );
        }
      }

      if (this.player && this.rt) {
        this.rt.broadcastPosition({
          x: this.player.x,
          y: this.player.y,
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
      this.prevRemotePos = {};
      this.loadingTextures.clear();
      
      // Clean up HTML overlays
      this.destroyNameOverlay(this.playerNameElement);
      this.playerNameElement = null;
      
      for (const userId in this.remoteNameElements) {
        this.destroyNameOverlay(this.remoteNameElements[userId]);
      }
      this.remoteNameElements = {};
      if (this.playerNameContainer) {
        this.playerNameContainer.destroy();
        this.playerNameContainer = null;
      }
      for (const userId in this.remoteNameContainers) {
        this.remoteNameContainers[userId].destroy();
        delete this.remoteNameContainers[userId];
      }
    }
  })();
}
