
export class PlayerMovement {
  constructor(
    public player: any,
    public cursors: any,
    public wasd: any,
    public speed: number = 200 // pixels per second
  ) {}

  update(_: number, __: number) {
    if (!this.player || !this.cursors) return;

    let vx = 0, vy = 0;
    // Arrow keys
    if (this.cursors.left?.isDown) vx -= 1;
    if (this.cursors.right?.isDown) vx += 1;
    if (this.cursors.up?.isDown) vy -= 1;
    if (this.cursors.down?.isDown) vy += 1;
    // WASD keys
    if (this.wasd?.A?.isDown) vx -= 1;
    if (this.wasd?.D?.isDown) vx += 1;
    if (this.wasd?.W?.isDown) vy -= 1;
    if (this.wasd?.S?.isDown) vy += 1;

    // Normalize diagonal movement
    if (vx && vy) {
      const norm = Math.SQRT1_2;
      vx *= norm;
      vy *= norm;
    }

    this.player.setVelocity(vx * this.speed, vy * this.speed);
    if (!vx && !vy) this.player.setVelocity(0, 0);
  }
}

