/**
 * Canvas water for the duck race: layered moving ripples, light sheen and glints, lane ropes with bobbing floats,
 * V-shaped wakes, expanding rings, splash droplets and a checkered finish band. Draw calls are batched per frame.
 */

export interface PondDuck { stern: number; bow: number; y: number; speed: number }
interface Ring { x: number; y: number; r: number; max: number; age: number; ttl: number }
interface Drop { x: number; y: number; vx: number; vy: number; age: number; ttl: number; r: number }
interface Glint { x: number; y: number; p: number; s: number; w: number }

const THEMES = {
  light: { top: '#2a8fb8', bottom: '#167199', laneTint: 'rgba(255,255,255,0.055)', ink: '255,255,255', shadow: 'rgba(6,44,66,0.28)', bank: 'rgba(6,40,60,0.35)', floatA: '#ef5a4c', floatB: '#fbfaf5', rope: 'rgba(255,255,255,0.55)', check: '#14232b' },
  dark: { top: '#11506b', bottom: '#0a3549', laneTint: 'rgba(255,255,255,0.04)', ink: '200,236,255', shadow: 'rgba(0,10,18,0.45)', bank: 'rgba(0,0,0,0.45)', floatA: '#d9503f', floatB: '#d9dcd6', rope: 'rgba(200,236,255,0.4)', check: '#071016' },
};

export class Pond {
  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private rings: Ring[] = [];
  private drops: Drop[] = [];
  private glints: Glint[] = [];
  private trails: { x: number; y: number; age: number }[][] = [];
  private lastRing: number[] = [];
  private last = 0;
  /** Static water (gradient, lane tints, start line, finish band), rebuilt on resize or theme change. */
  private base: HTMLCanvasElement | null = null;
  private baseKey = '';
  /** Adaptive quality: drops to "lite" (one ripple layer, no sheen, 1x pixels) when frames run slow. */
  private lite = false;
  private frameAvg = 16;
  private slowFrames = 0;

  constructor(private canvas: HTMLCanvasElement, private lanes: number, readonly top = 10, readonly finishW = 16, readonly startX = 8) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.resize();
  }

  get width() { return this.w; }
  get laneH() { return (this.h - this.top) / this.lanes; }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = this.lite ? 1 : Math.min(2, window.devicePixelRatio || 1);
    this.baseKey = '';
    this.w = Math.max(1, r.width);
    this.h = Math.max(1, r.height);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.glints = Array.from({ length: Math.min(160, Math.round((this.w * this.h) / 2200)) }, () => ({
      x: Math.random() * this.w, y: Math.random() * this.h, p: Math.random() * Math.PI * 2, s: 0.5 + Math.random() * 1.3, w: 2 + Math.random() * 5,
    }));
  }

  /** Droplets and rings at a point; power ~0.5 (paddle) to 2 (winner). */
  splash(x: number, y: number, power = 1) {
    const n = Math.round(10 * power);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.95;
      const v = (0.08 + Math.random() * 0.16) * Math.sqrt(power);
      this.drops.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, ttl: 500 + Math.random() * 400, r: 0.8 + Math.random() * 1.8 });
    }
    this.rings.push({ x, y, r: 3, max: 18 + 14 * power, age: 0, ttl: 900 + 300 * power });
    this.rings.push({ x, y, r: 1, max: 10 + 10 * power, age: -120, ttl: 800 + 300 * power });
  }

  /** Paints the parts of the pond that never move onto an offscreen canvas. */
  private paintBase(th: (typeof THEMES)['light'], ink: (a: number) => string) {
    const key = `${this.w}x${this.h}@${this.dpr}:${th.top}`;
    if (this.base && key === this.baseKey) return;
    this.baseKey = key;
    const c = (this.base ??= document.createElement('canvas'));
    c.width = this.canvas.width;
    c.height = this.canvas.height;
    const ctx = c.getContext('2d')!, { w, h } = this, lh = this.laneH;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, th.top);
    g.addColorStop(1, th.bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = th.laneTint;
    for (let i = 0; i < this.lanes; i += 2) ctx.fillRect(0, this.top + i * lh, w, lh);
    ctx.strokeStyle = ink(0.45);
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(this.startX, 0);
    ctx.lineTo(this.startX, h);
    ctx.stroke();
    ctx.setLineDash([]);
    const fx = w - this.finishW, sq = this.finishW / 2;
    ctx.fillStyle = ink(0.9);
    ctx.fillRect(fx, 0, this.finishW, h);
    ctx.beginPath();
    for (let y = 0, row = 0; y < h; y += sq, row++) ctx.rect(fx + (row % 2) * sq, y, sq, sq);
    ctx.fillStyle = th.check;
    ctx.fill();
    const edge = ctx.createLinearGradient(0, 0, 0, 10);
    edge.addColorStop(0, th.bank);
    edge.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, w, 10);
  }

  private adapt(dt: number) {
    this.frameAvg = this.frameAvg * 0.92 + dt * 0.08;
    if (!this.lite && this.frameAvg > 26) {
      if (++this.slowFrames > 45) { this.lite = true; this.resize(); }
    } else this.slowFrames = 0;
  }

  draw(t: number, ducks: PondDuck[]) {
    const dt = this.last ? Math.min(50, t - this.last) : 16;
    this.last = t;
    this.adapt(dt);
    const { ctx, w } = this;
    const th = document.documentElement.dataset.theme === 'dark' ? THEMES.dark : THEMES.light;
    const lh = this.laneH;
    const ink = (a: number) => `rgba(${th.ink},${a.toFixed(3)})`;
    this.paintBase(th, ink);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.base!, 0, 0);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // Slow light sheen drifting across the surface.
    if (!this.lite) {
      const sx = ((t * 0.025) % (w * 2.4)) - w * 0.7;
      const sheen = ctx.createLinearGradient(sx, 0, sx + w * 0.6, this.h);
      sheen.addColorStop(0, ink(0));
      sheen.addColorStop(0.5, ink(0.07));
      sheen.addColorStop(1, ink(0));
      ctx.fillStyle = sheen;
      ctx.fillRect(0, 0, w, this.h);
    }

    // Layered ripples: dashed sine lines flowing left at different speeds.
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    const layers = this.lite ? ([[0, 0.5, 0.16, 1]] as const) : ([[0, 0.22, 0.16, 1], [1, 0.5, 0.11, 0.7], [2, 0.8, 0.14, 1.3]] as const);
    for (const [k, frac, alpha, speed] of layers) {
      ctx.beginPath();
      for (let i = 0; i < this.lanes; i++) {
        const base = this.top + i * lh + lh * frac;
        for (let x = 0; x <= w; x += 12) {
          const y = base + 1.5 * Math.sin(x * 0.045 + t * 0.0016 * speed + i * 1.3 + k) + 0.8 * Math.sin(x * 0.11 - t * 0.0022 + k * 2);
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
      }
      ctx.setLineDash([10 + k * 6, 16 + k * 5]);
      ctx.lineDashOffset = t * 0.02 * speed;
      ctx.strokeStyle = ink(alpha);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Sun glints that twinkle in and out.
    ctx.beginPath();
    for (const gl of this.glints) {
      const a = Math.max(0, Math.sin(t * 0.0021 * gl.s + gl.p));
      if (a < 0.82) continue;
      const k = (a - 0.82) / 0.18;
      ctx.moveTo(gl.x + gl.w * k, gl.y);
      ctx.ellipse(gl.x, gl.y, gl.w * k, 0.9 * k, 0, 0, Math.PI * 2);
    }
    ctx.fillStyle = ink(0.75);
    ctx.fill();


    // Ducks: wakes, shadows, rings.
    ducks.forEach((d, i) => {
      const trail = (this.trails[i] ??= []);
      for (const p of trail) p.age += dt;
      while (trail.length && trail[0]!.age > 1100) trail.shift();
      if (d.speed > 0.015 && (!trail.length || d.stern - trail[trail.length - 1]!.x > 3)) trail.push({ x: d.stern, y: d.y, age: 0 });
      if (trail.length > 1) {
        const tail = trail[0]!;
        const grad = ctx.createLinearGradient(d.stern, 0, tail.x, 0);
        grad.addColorStop(0, ink(0.55));
        grad.addColorStop(1, ink(0));
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.6;
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(d.stern, d.y);
          for (let j = trail.length - 1; j >= 0; j--) {
            const p = trail[j]!;
            const spread = Math.min(lh * 0.42, (d.stern - p.x) * 0.2 + p.age * 0.004);
            ctx.lineTo(p.x, p.y + side * spread + Math.sin(p.x * 0.3 + t * 0.01) * 0.6);
          }
          ctx.stroke();
        }
      }
      // Reflection/shadow under the duck and a little bow foam when moving.
      const cx = (d.stern + d.bow) / 2, rx = (d.bow - d.stern) / 2 + 3;
      ctx.fillStyle = th.shadow;
      ctx.beginPath();
      ctx.ellipse(cx, d.y + 2.5, rx, 3.6, 0, 0, Math.PI * 2);
      ctx.fill();
      if (d.speed > 0.02) {
        ctx.fillStyle = ink(Math.min(0.7, d.speed * 6));
        ctx.beginPath();
        ctx.ellipse(d.bow + 1, d.y + 0.5, 3 + d.speed * 18, 1.6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      const every = d.speed > 0.02 ? 170 : 1400;
      if (t - (this.lastRing[i] ?? -1e9) > every) {
        this.lastRing[i] = t;
        this.rings.push({ x: cx, y: d.y + 1, r: rx * 0.6, max: rx + (d.speed > 0.02 ? 16 : 9), age: 0, ttl: d.speed > 0.02 ? 900 : 1600 });
      }
    });

    ctx.lineWidth = 1.1;
    this.rings = this.rings.filter(r => (r.age += dt) < r.ttl);
    for (const r of this.rings) {
      if (r.age < 0) continue;
      const k = r.age / r.ttl, rad = r.r + (r.max - r.r) * (1 - (1 - k) ** 2);
      ctx.strokeStyle = ink(0.5 * (1 - k));
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, rad, rad * 0.3, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Lane ropes with bobbing floats (two batched fills).
    ctx.strokeStyle = th.rope;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < this.lanes; i++) { ctx.moveTo(0, this.top + i * lh); ctx.lineTo(w - this.finishW, this.top + i * lh); }
    ctx.stroke();
    for (const [color, parity] of [[th.floatA, 0], [th.floatB, 1]] as const) {
      ctx.beginPath();
      for (let i = 1; i < this.lanes; i++) {
        const y0 = this.top + i * lh;
        for (let x = 6, n = 0; x < w - this.finishW - 4; x += 15, n++) {
          if (n % 2 !== parity) continue;
          const y = y0 + Math.sin(t * 0.003 + x * 0.07 + i) * 1.2;
          ctx.moveTo(x + 4.6, y);
          ctx.ellipse(x, y, 4.6, 2.5, 0, 0, Math.PI * 2);
        }
      }
      ctx.fillStyle = color;
      ctx.fill();
    }

    // Splash droplets.
    this.drops = this.drops.filter(d => (d.age += dt) < d.ttl);
    ctx.beginPath();
    for (const d of this.drops) {
      d.vy += 0.0009 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      ctx.moveTo(d.x + d.r, d.y);
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    }
    ctx.fillStyle = ink(0.85);
    ctx.fill();

  }
}
