import { el, fitCanvas } from './dom';

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Radius, px. */
  r: number;
  color: string;
  born: number;
  life: number;
}

/**
 * A few specks of light off a key that was just hit, while the streak is long.
 * Each one takes the color of its key, so a spark still says which finger typed.
 * The canvas only runs while a spark is alive, and stays empty under reduced motion.
 */
export class Sparks {
  readonly canvas = el('canvas.sparks', { 'aria-hidden': 'true' });
  private sparks: Spark[] = [];
  private running = false;
  private previous = 0;
  private calm = window.matchMedia('(prefers-reduced-motion: reduce)');

  /** `x` and `y` are viewport coordinates: where the sparks leave from. */
  emit(x: number, y: number, color: string, count: number): void {
    if (this.calm.matches || count <= 0) return;
    const box = this.canvas.getBoundingClientRect();
    if (box.width === 0) return;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const now = performance.now();
    for (let i = 0; i < count; i++) {
      this.sparks.push({
        x: x - box.left + (Math.random() - 0.5) * 0.5 * rem,
        y: y - box.top,
        vx: (Math.random() - 0.5) * 2.4 * rem,
        vy: -(2.6 + Math.random() * 2.4) * rem,
        r: (0.07 + Math.random() * 0.05) * rem,
        color,
        born: now,
        life: 420 + Math.random() * 320,
      });
    }
    if (!this.running) {
      this.running = true;
      this.previous = now;
      requestAnimationFrame(this.frame);
    }
  }

  private frame = (now: number): void => {
    const dt = Math.min(50, now - this.previous) / 1000;
    this.previous = now;
    const { ctx, width, height } = fitCanvas(this.canvas);
    ctx.clearRect(0, 0, width, height);
    this.sparks = this.sparks.filter((spark) => now - spark.born < spark.life);
    for (const spark of this.sparks) {
      const age = (now - spark.born) / spark.life;
      // They leave fast and hang: the rise is braked, never pulled back down.
      const brake = Math.exp(-3.2 * dt);
      spark.vx *= brake;
      spark.vy *= brake;
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      const fade = (1 - age) ** 1.6;
      ctx.fillStyle = spark.color;
      // A wide faint disc under a small bright one: the glow of the speck.
      ctx.globalAlpha = fade * 0.16;
      ctx.beginPath();
      ctx.arc(spark.x, spark.y, spark.r * 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = fade * 0.9;
      ctx.beginPath();
      ctx.arc(spark.x, spark.y, spark.r * (1 - age * 0.35), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (this.sparks.length > 0) requestAnimationFrame(this.frame);
    else this.running = false;
  };
}
