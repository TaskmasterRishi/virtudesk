export class PlayerMovement {
  private readonly player: Phaser.Physics.Arcade.Sprite;
  private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private readonly wasd: Record<string, Phaser.Input.Keyboard.Key>;
  private readonly baseSpeed: number = 500;

  constructor(
    player: Phaser.Physics.Arcade.Sprite,
    cursors: Phaser.Types.Input.Keyboard.CursorKeys,
    wasd: Record<string, Phaser.Input.Keyboard.Key>
  ) {
    this.player = player;
    this.cursors = cursors;
    this.wasd = wasd;
  }

  update(time: number, delta: number) {
    if (!this.player?.body) return;

    const speed = this.baseSpeed * (delta / 16.67); // Normalized to 60fps
    const left = this.cursors.left?.isDown || this.wasd.A.isDown;
    const right = this.cursors.right?.isDown || this.wasd.D.isDown;
    const up = this.cursors.up?.isDown || this.wasd.W.isDown;
    const down = this.cursors.down?.isDown || this.wasd.S.isDown;

    const vx = (right ? 1 : 0) - (left ? 1 : 0);
    const vy = (down ? 1 : 0) - (up ? 1 : 0);

    if (vx !== 0 || vy !== 0) {
      const len = Math.hypot(vx, vy);
      this.player.setVelocity(
        (vx / len) * speed,
        (vy / len) * speed
      );
    } else {
      this.player.setVelocity(0, 0);
    }
  }
}
