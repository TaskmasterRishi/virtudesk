import { getChatInputFocus } from '../chatState';
import { getWhiteboardOpen } from '../whiteboardState'; // Import getWhiteboardOpen
import { getCreateTaskPanelOpen } from '../createTaskPanelState';

export class PlayerMovement {
  private animationKeys: {
    idle: string;
    walk: string;
    run: string;
  };

  private canPlayAnimation(key?: string): boolean {
    if (!key || !this.player?.anims?.animationManager) return false;
    const manager = this.player.anims.animationManager;
    if (!manager.exists(key)) return false;
    const anim = manager.get(key);
    return Boolean(anim && Array.isArray(anim.frames) && anim.frames.length > 0);
  }

  private tryPlayAnimation(key?: string, ignoreIfPlaying: boolean = true): boolean {
    if (!key || !this.player?.anims) return false;
    if (!this.canPlayAnimation(key)) return false;
    try {
      this.player.anims.play(key, ignoreIfPlaying);
      return true;
    } catch (err) {
      console.warn(`Failed to play animation ${key}:`, err);
      return false;
    }
  }

  constructor(
    public player: any,
    public cursors: any,
    public wasd: any,
    public speed: number = 90, // pixels per second
    animationKeys?: { idle: string; walk: string; run: string }
  ) {
    // Default to pink monster animations if no keys provided (backward compatibility)
    this.animationKeys = animationKeys || {
      idle: 'pink_idle',
      walk: 'pink_walk',
      run: 'pink_run'
    };
  }

  update(_: number, __: number) {
    if (!this.player || !this.cursors) return;

    // Disable movement if chat is focused OR whiteboard is open
    if (getChatInputFocus() || getWhiteboardOpen() || getCreateTaskPanelOpen()) {
      this.player.setVelocity(0, 0);
      if (this.player.anims?.currentAnim?.key !== this.animationKeys.idle) {
        this.tryPlayAnimation(this.animationKeys.idle, true);
      }
      return;
    }

    let vx = 0, vy = 0;
    // Arrow and WASD keys
    // Only check for movement keys if chat input is NOT focused and whiteboard is NOT open
    if (!getChatInputFocus() && !getWhiteboardOpen()) {
      if (this.cursors.left?.isDown || this.wasd?.A?.isDown) vx -= 1;
      if (this.cursors.right?.isDown || this.wasd?.D?.isDown) vx += 1;
      if (this.cursors.up?.isDown || this.wasd?.W?.isDown) vy -= 1;
      if (this.cursors.down?.isDown || this.wasd?.S?.isDown) vy += 1;
    }
    
    // Normalize diagonal movement
    if (vx && vy) {
      const norm = Math.SQRT1_2;
      vx *= norm;
      vy *= norm;
    }

    this.player.setVelocity(vx * this.speed, vy * this.speed);
    if (!vx && !vy) this.player.setVelocity(0, 0);

    // Animation switching and flip
    const moving = Math.abs(vx) > 0 || Math.abs(vy) > 0;
    if (moving) {
      const running = Math.abs(vx) > 0.9 || Math.abs(vy) > 0.9;
      const target = running && this.canPlayAnimation(this.animationKeys.run)
        ? this.animationKeys.run
        : (this.canPlayAnimation(this.animationKeys.walk) ? this.animationKeys.walk : undefined);
      if (target && this.player.anims?.currentAnim?.key !== target) {
        this.tryPlayAnimation(target, true);
      }
    } else if (this.player.anims?.currentAnim?.key !== this.animationKeys.idle) {
      this.tryPlayAnimation(this.animationKeys.idle, true);
    }

    // Face left/right by horizontal velocity
    if (vx !== 0) {
      this.player.setFlipX(vx < 0);
    }
  }
}

