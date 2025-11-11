import { PlayerMovement } from "./PlayerMovement";
import {
  createPlayerRealtime,
  popNextPosition,
  getAllPlayers,
  onPlayerMeta,
} from "../realtime/PlayerRealtime";
import {
  AVAILABLE_SPRITES,
  getCharacterByName,
  getSpritePaths,
  CharacterSprite,
} from "../utils/spriteUtils";
import { supabase } from "@/utils/supabase/client";
import { onChatInputFocusChange } from "../chatState";
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
    private loadingTextures = new Set<string>();
    private perPlayerChar: Record<string, CharacterSprite> = {};
    private spriteCharacterMap: Record<string, string> = {};
    private pendingPositions: Record<string, { x: number; y: number }> = {};
    private characterLoading: Set<string> = new Set();
    private playerNameElement: HTMLElement | null = null;
    private remoteNameElements: Record<string, HTMLElement> = {};
    private gameContainer: HTMLElement | null = null;

    constructor() {
      super("MapScene");
      // default fallback
      this.selectedCharacter = AVAILABLE_SPRITES[0];
    }

    // ---------------------------
    // Helpers for sanitized keys
    // ---------------------------
    private safeName(char: CharacterSprite) {
      return char.name.replace(/\s+/g, "_").replace(/[^\w\-]/g, "");
    }

    private animKey(char: CharacterSprite, baseKey: string) {
      const safe = this.safeName(char);
      return `${safe}__${baseKey}`;
    }

    private textureKey(char: CharacterSprite, state: "idle" | "walk" | "run") {
      return `${this.safeName(char)}_${state}_img`;
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
        zIndex: '50',
        textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8), -1px -1px 2px rgba(0, 0, 0, 0.8)',
        background: 'rgba(0, 0, 0, 0.6)',
        padding: '2px 6px',
        borderRadius: '4px',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        backdropFilter: 'blur(2px)',
        transform: 'translate(-50%, -100%)',
        transition: 'opacity 0.2s ease',
      });

      if (isLocalPlayer) {
        overlay.style.border = '1px solid rgba(59, 130, 246, 0.5)';
        overlay.style.background = 'rgba(59, 130, 246, 0.2)';
      }

      container.appendChild(overlay);
      return overlay;
    }

    private updateNameOverlayPosition(element: HTMLElement, worldX: number, worldY: number) {
      if (!element || !this.cameras.main) return;

      if (getWhiteboardOpen()) {
        element.style.display = 'none';
        return;
      }

      element.style.display = 'block';

      const camera = this.cameras.main;
      const screenX = (worldX - camera.worldView.x) * camera.zoom;
      const screenY = (worldY - camera.worldView.y) * camera.zoom;

      const canvas = this.game.canvas;
      const canvasRect = canvas.getBoundingClientRect();

      element.style.left = `${canvasRect.left + screenX}px`;
      element.style.top = `${canvasRect.top + screenY - 8}px`;
    }

    private destroyNameOverlay(element: HTMLElement | null) {
      if (element && element.parentNode) {
        element.parentNode.removeChild(element);
      }
    }

    // ---------------------------
    // Loading / textures
    // ---------------------------
    private loadAllCharacters() {
      for (const c of AVAILABLE_SPRITES) {
        const paths = getSpritePaths(c);
        const idleKey = this.textureKey(c, "idle");
        const walkKey = this.textureKey(c, "walk");
        const runKey = this.textureKey(c, "run");

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
      this.load.crossOrigin = "anonymous";
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

    // ---------------------------
    // Animation creation / slicing
    // ---------------------------
    private ensureAnimsFor(char: CharacterSprite) {
      const sliceSheet = (imgKey: string, frames: number) => {
        const tex = this.textures.get(imgKey);
        if (!tex) {
          console.warn(`Texture not found: ${imgKey}`);
          return { frameNames: [] as string[], fw: 0, fh: 0 };
        }

        const expectedFirst = `${imgKey}_0`;
        if ((tex as any).frames && (tex as any).frames[expectedFirst]) {
          const names = Array.from({ length: frames }, (_, i) => `${imgKey}_${i}`);
          const validNames = names.filter((n) => {
            const frame = (tex as any).frames[n];
            return frame && frame.width > 0 && frame.height > 0;
          });
          return { frameNames: validNames, fw: 0, fh: 0 };
        }

        const src = tex.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
        if (!src) {
          console.warn(`Source image not found for texture: ${imgKey}`);
          return { frameNames: [] as string[], fw: 0, fh: 0 };
        }

        const totalW = (src as any).width as number;
        const totalH = (src as any).height as number;

        if (!totalW || !totalH || totalW <= 0 || totalH <= 0) {
          console.warn(`Invalid dimensions for texture: ${imgKey} (${totalW}x${totalH})`);
          return { frameNames: [] as string[], fw: 0, fh: 0 };
        }

        const frameWidth = Math.floor(totalW / frames);
        const frameHeight = totalH;

        if (frameWidth <= 0) {
          console.warn(`Invalid frame width for texture: ${imgKey} (frames: ${frames}, width: ${totalW})`);
          return { frameNames: [] as string[], fw: 0, fh: 0 };
        }

        const names: string[] = [];
        for (let i = 0; i < frames; i++) {
          const name = `${imgKey}_${i}`;
          try {
            // tex.add(name, 0, i * frameWidth, 0, frameWidth, frameHeight);
            // Phaser's TextureManager add signature differs between versions; use add to frames map if available:
            if ((tex as any).add) {
              (tex as any).add(name, 0, i * frameWidth, 0, frameWidth, frameHeight);
            } else {
              // fallback: create a frame from canvas
              (tex as any).frames = (tex as any).frames || {};
              (tex as any).frames[name] = { width: frameWidth, height: frameHeight };
            }
            names.push(name);
          } catch (e) {
            console.warn(`Failed to add frame ${name}:`, e);
          }
        }
        return { frameNames: names, fw: frameWidth, fh: frameHeight };
      };

      const idleKey = this.textureKey(char, "idle");
      const walkKey = this.textureKey(char, "walk");
      const runKey = this.textureKey(char, "run");

      const idle = sliceSheet(idleKey, char.idleFrames);
      const walk = sliceSheet(walkKey, char.walkFrames);
      const run = sliceSheet(runKey, char.runFrames);

      const idleAnimKey = this.animKey(char, char.animations.idle);
      const walkAnimKey = this.animKey(char, char.animations.walk);
      const runAnimKey = this.animKey(char, char.animations.run);

      const ensureAnim = (key: string, imgKey: string, names: string[], frameRate: number) => {
        if (this.anims.exists(key)) return;
        if (!names.length) {
          console.warn(`No valid frames for animation: ${key} (texture: ${imgKey})`);
          return;
        }

        const tex = this.textures.get(imgKey);
        if (!tex) {
          console.warn(`Texture not found when creating animation: ${imgKey}`);
          return;
        }

        const validFrames = names.filter((n) => {
          const frame = (tex as any).frames?.[n];
          return frame && frame.width > 0 && frame.height > 0;
        });

        if (!validFrames.length) {
          console.warn(`No valid frames found for animation: ${key}`);
          return;
        }

        try {
          this.anims.create({
            key,
            frames: validFrames.map((n) => ({ key: imgKey, frame: n })),
            frameRate,
            repeat: -1,
          });
        } catch (e) {
          console.error(`Failed to create animation ${key}:`, e);
        }
      };

      ensureAnim(idleAnimKey, idleKey, idle.frameNames, 6);
      ensureAnim(walkAnimKey, walkKey, walk.frameNames, 10);
      ensureAnim(runAnimKey, runKey, run.frameNames, 12);
    }

    // ---------------------------
    // Player creation
    // ---------------------------
    private createPlayerAt(x: number, y: number, tileW: number, tileH: number) {
      const char = this.selectedCharacter;
      this.ensureAnimsFor(char);

      const idleTexKey = this.textureKey(char, "idle");
      const firstFrame = `${idleTexKey}_0`;

      this.player = this.physics.add.sprite(x, y, idleTexKey, firstFrame);

      // Increased size factor
      const scaleFactor = 2;
      const originalHeight = (this.textures.get(idleTexKey)?.getSourceImage() as any)?.height;
      const scale = ((tileH) / originalHeight) * scaleFactor || 1.5;

      this.player.setOrigin(0.5, 0.7).setDepth(10);
      this.player.setScale(scale);
      this.player.setCollideWorldBounds(true);

      const hitboxWidth = tileW * 0.2 * scaleFactor;
      const hitboxHeight = tileH * 1.8 * scaleFactor;
      this.player.body.setSize(hitboxWidth, hitboxHeight);

      this.cameras.main.roundPixels = true;
      this.cameras.main.startFollow(this.player, true, 1, 1);
      this.cameras.main.setFollowOffset(0, 0);

      const idleAnimKey = this.animKey(char, char.animations.idle);
      if (this.anims.exists(idleAnimKey)) {
        const anim = this.anims.get(idleAnimKey);
        if (anim && anim.frames && anim.frames.length > 0) {
          try {
            this.player.anims.play(idleAnimKey);
          } catch (e) {
            console.warn(`Failed to play idle animation:`, e);
          }
        }
      }

      this.playerMovement = new PlayerMovement(
        this.player,
        this.cursors,
        this.wasd,
        90,
        char.animations
      );
// Pass namespaced animation keys so PlayerMovement plays the correct animations
const nsAnimations = {
  idle: this.animKey(char, char.animations.idle),
  walk: this.animKey(char, char.animations.walk),
  run:  this.animKey(char, char.animations.run),
};

console.log(`[DEBUG] PlayerMovement animations for local player:`, nsAnimations);

this.playerMovement = new PlayerMovement(
  this.player,
  this.cursors,
  this.wasd,
  90,
  nsAnimations
);

      if (this.wallsLayer) {
        this.physics.add.collider(this.player, this.wallsLayer, null, null, this);
      }

      // Remember my character for meta
      this.perPlayerChar[opts.userId] = char;
      this.spriteCharacterMap[opts.userId] = char.name;

      // Player name overlay
      if (this.playerNameElement) {
        this.destroyNameOverlay(this.playerNameElement);
      }
      const playerName = opts.name || "Player";
      this.playerNameElement = this.createNameOverlay(playerName, true);
    }

    // ---------------------------
    // Fetch character mapping
    // ---------------------------
    private async fetchCharacterForUser(userId: string): Promise<CharacterSprite> {
      console.log(`[FETCH] Fetching character for user_id: ${userId}`);
      const { data, error } = await supabase
        .from("user_characters")
        .select("character_name")
        .eq("user_id", userId)
        .single();

      console.log(`[FETCH] Result for ${userId}:`, { data, error });

      if (error) {
        console.error(`[FETCH] Error for ${userId}:`, error);
        return AVAILABLE_SPRITES[0];
      }

      if (!data?.character_name) {
        console.warn(`[FETCH] No character_name for ${userId}`);
        return AVAILABLE_SPRITES[0];
      }

      const characterNameFromDB = data.character_name;
      const char = getCharacterByName(characterNameFromDB);

      if (char) {
        console.log(`[FETCH] ✅ Matched "${characterNameFromDB}" -> sprite: ${char.name} for ${userId}`);
        return char;
      } else {
        console.error(`[FETCH] ❌ No match found for "${characterNameFromDB}" in AVAILABLE_SPRITES`);
        console.log(`[FETCH] Available names are:`, AVAILABLE_SPRITES.map(s => `"${s.name}"`));
        return AVAILABLE_SPRITES[0];
      }
    }

    private handlePresenceSync = (_state: Record<string, any[]>) => {};

    private async pickUserCharacter() {
      try {
        const { data, error } = await supabase
          .from("user_characters")
          .select("character_name")
          .eq("user_id", opts.userId)
          .single();

        if (!error && data?.character_name) {
          const byName = getCharacterByName(data.character_name);
          this.selectedCharacter = byName ?? AVAILABLE_SPRITES[0];
        } else {
          this.selectedCharacter = AVAILABLE_SPRITES[0];
        }
      } catch {
        this.selectedCharacter = AVAILABLE_SPRITES[0];
      }
    }

    // ---------------------------
    // Realtime init & handlers
    // ---------------------------
    private initRealtime() {
      console.log('[INIT REALTIME] Starting realtime initialization for room:', opts.roomId);

      this.rt = createPlayerRealtime({
        roomId: opts.roomId,
        me: {
          userId: opts.userId,
          name: opts.name,
          avatar: opts.avatarUrl,
        },
        handlers: {
          onPlayerPos: (p) => {
            if (p.userId === opts.userId) return;

            // If we don't have character yet, queue the position and fetch character
            if (!this.perPlayerChar[p.userId] && !this.characterLoading.has(p.userId)) {
              this.characterLoading.add(p.userId);
              this.pendingPositions[p.userId] = { x: p.x, y: p.y };

              this.fetchCharacterForUser(p.userId).then(char => {
                this.perPlayerChar[p.userId] = char;
                this.characterLoading.delete(p.userId);

                const pendingPos = this.pendingPositions[p.userId];
                if (pendingPos) {
                  const s = this.ensureRemoteSprite(p.userId, pendingPos.x, pendingPos.y);
                  if (s) {
                    this.updateSpritePositionAndAnimation(s, { ...p, userId: p.userId }, char);
                  }
                  delete this.pendingPositions[p.userId];
                }
              });
              return;
            }

            // If character is still loading, just queue the position
            if (this.characterLoading.has(p.userId)) {
              this.pendingPositions[p.userId] = { x: p.x, y: p.y };
              return;
            }

            const char = this.perPlayerChar[p.userId];
            if (!char) return;

            const s = this.ensureRemoteSprite(p.userId, p.x, p.y);
            if (!s) return;

            this.updateSpritePositionAndAnimation(s, { ...p, userId: p.userId }, char);
          },
          onPresenceSync: this.handlePresenceSync,
        },
      });

      const offMeta = onPlayerMeta((playerId, meta) => {
        if (playerId === opts.userId) return;

        if (!this.perPlayerChar[playerId] && !this.characterLoading.has(playerId)) {
          this.characterLoading.add(playerId);
          this.fetchCharacterForUser(playerId).then(char => {
            this.perPlayerChar[playerId] = char;
            this.characterLoading.delete(playerId);

            const pendingPos = this.pendingPositions[playerId];
            if (pendingPos) {
              this.ensureRemoteSprite(playerId, pendingPos.x, pendingPos.y);
              delete this.pendingPositions[playerId];
            }
          });
        }
      });

      setTimeout(async () => {
        const allPlayers = getAllPlayers();
        const fetchPromises: Promise<void>[] = [];

        for (const participant of allPlayers) {
          if (!participant.id || participant.id === opts.userId) continue;
          if (!this.perPlayerChar[participant.id] && !this.characterLoading.has(participant.id)) {
            this.characterLoading.add(participant.id);

            const promise = this.fetchCharacterForUser(participant.id).then(char => {
              this.perPlayerChar[participant.id] = char;
              this.characterLoading.delete(participant.id);

              const pendingPos = this.pendingPositions[participant.id];
              if (pendingPos) {
                this.ensureRemoteSprite(participant.id, pendingPos.x, pendingPos.y);
                delete this.pendingPositions[participant.id];
              }
            });

            fetchPromises.push(promise);
          }
        }

        await Promise.all(fetchPromises);
        console.log(`[INIT] Loaded characters for ${fetchPromises.length} players`);
      }, 500);

      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        try { offMeta(); } catch {}
        this.rt?.destroy();
        this.rt = null;
        Object.values(this.remotePlayers).forEach((s) => s.destroy());
        this.remotePlayers = {};
        this.pendingPositions = {};
        this.characterLoading.clear();
      });
    }

    // ---------------------------
    // Remote sprite helpers
    // ---------------------------
    private updateSpritePositionAndAnimation(s: any, p: { x: number; y: number; userId?: string }, char: CharacterSprite) {
      s.setPosition(p.x, p.y);

      const prev = this.prevRemotePos?.[p.userId ?? ""];
      const dx = prev ? p.x - prev.x : 0;
      const dy = prev ? p.y - prev.y : 0;
      const moving = Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1;
      const running = Math.abs(dx) > 1.0 || Math.abs(dy) > 1.0;

      const idleKey = this.animKey(char, char.animations.idle);
      const walkKey = this.animKey(char, char.animations.walk);
      const runKey  = this.animKey(char, char.animations.run);

      if (moving) {
        const targetKey = (running && this.anims.exists(runKey)) ? runKey
                         : (this.anims.exists(walkKey) ? walkKey : idleKey);

        if (targetKey && s.anims?.currentAnim?.key !== targetKey) {
          try { s.anims.play(targetKey, true); } catch (e) { console.warn('Failed to play target animation', e); }
        }
      } else {
        if (this.anims.exists(idleKey) && s.anims?.currentAnim?.key !== idleKey) {
          try { s.anims.play(idleKey, true); } catch (e) { console.warn('Failed to play idle animation', e); }
        }
      }

      if (dx !== 0) s.setFlipX(dx < 0);
      if (p.userId) this.prevRemotePos[p.userId] = { x: p.x, y: p.y };
    }

    private ensureRemoteSprite(userId: string, x?: number, y?: number) {
      if (!this.add || !this.scene || typeof this.scene.isActive !== "function" || this.scene.isActive() === false) {
        return null;
      }

      const char = this.perPlayerChar[userId];
      if (!char) {
        return null;
      }

      this.ensureAnimsFor(char);

      let s = this.remotePlayers[userId];
      const desiredTextureKey = this.textureKey(char, "idle");
      const desiredFirstFrame = `${desiredTextureKey}_0`;
      const storedCharName = this.spriteCharacterMap[userId];

      if (!s || storedCharName !== char.name) {
        if (s) {
          s.destroy();
        }

        s = this.physics.add.sprite(x ?? 0, y ?? 0, desiredTextureKey, desiredFirstFrame);
        this.spriteCharacterMap[userId] = char.name;

        const scaleFactor = 2;
        const originalHeight = (this.textures.get(desiredTextureKey)?.getSourceImage() as any)?.height;
        const scale = ((this.tileH) / originalHeight) * scaleFactor || 1.5;

        s.setOrigin(0.5, 0.7).setDepth(9);
        s.setScale(scale);

        const idleAnimKey = this.animKey(char, char.animations.idle);
        if (this.anims.exists(idleAnimKey)) {
          const anim = this.anims.get(idleAnimKey);
          if (anim && anim.frames && anim.frames.length > 0) {
            try {
              s.anims.play(idleAnimKey);
            } catch (e) {
              console.warn(`Failed to play idle animation for ${userId}:`, e);
            }
          }
        }

        this.remotePlayers[userId] = s;
      }

      // Update name overlay
      if (this.remoteNameElements[userId]) {
        this.destroyNameOverlay(this.remoteNameElements[userId]);
      }
      let remoteName = userId;
      const allPlayers = getAllPlayers();
      const found = allPlayers.find((p: any) => p.id === userId);
      if (found && found.name) remoteName = found.name;
      this.remoteNameElements[userId] = this.createNameOverlay(remoteName, false);

      return s;
    }

    private updateRemoteSpriteCharacter(userId: string, char: CharacterSprite) {
      const s = this.remotePlayers[userId];
      if (!s) return;

      this.ensureAnimsFor(char);

      const desiredTex = this.textureKey(char, "idle");
      console.log(`Force updating sprite texture for ${userId} to "${desiredTex}"`);

      s.anims?.stop();
      s.setTexture(desiredTex);

      if (this.player) {
        s.setScale(this.player.scaleX, this.player.scaleY);
      } else {
        const scaleFactor = 2;
        const originalHeight = (this.textures.get(desiredTex)?.getSourceImage() as any)?.height;
        const scale = ((this.tileH) / originalHeight) * scaleFactor || 1.5;
        s.setScale(scale);
      }

      const idleAnimKey = this.animKey(char, char.animations.idle);
      if (this.anims.exists(idleAnimKey)) {
        try {
          s.anims.play(idleAnimKey, true);
        } catch (e) {
          console.warn(`Failed to play idle animation for ${userId}:`, e);
        }
      }
    }

    // ---------------------------
    // Map creation helpers
    // ---------------------------
    private setupMapBounds(mapW: number, mapH: number, tileW: number, tileH: number) {
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
      this.cameras.main.setZoom(3);
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

    // ---------------------------
    // Scene lifecycle
    // ---------------------------
    async create() {
      console.log('[CREATE] Scene create() called');
      const keyboard = this.input.keyboard;
      if (!keyboard) return;

      this.cursors = keyboard.createCursorKeys();
      this.wasd = keyboard.addKeys("W,A,S,D");

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

        console.log('[CREATE] Picking user character');
        await this.pickUserCharacter();
        console.log('[CREATE] Selected character:', this.selectedCharacter.name);

        const spawnX = this.mapW / 2;
        const spawnY = this.mapH / 2;
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
        this.setupCameraZoom(this.mapW, tileH);

        await this.pickUserCharacter();

        const spawnX = this.mapW / 2;
        const spawnY = this.mapH / 2;
        this.createPlayerAt(spawnX, spawnY, tileW, tileH);
        this.initRealtime();
      }
    }

    update(time: number, delta: number) {
      this.playerMovement?.update(time, delta);

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
      this.spriteCharacterMap = {};
      // Clean up HTML overlays
      this.destroyNameOverlay(this.playerNameElement);
      this.playerNameElement = null;

      for (const userId in this.remoteNameElements) {
        this.destroyNameOverlay(this.remoteNameElements[userId]);
      }
      this.remoteNameElements = {};
    }
  })();
}
