/**
 * Shared drawing kit for the background scenes that play behind the phone.
 *
 * Everything is drawn procedurally on a 2D canvas; there are no image assets.
 * Coordinates are in CSS pixels (the stage scales the context for devicePixelRatio).
 */

/** Broad look of the world, derived from the birth/current year. */
export type EraLook = 'ancient' | 'medieval' | 'early' | 'industrial' | 'modern' | 'future';

export function eraLook(year: number): EraLook {
  if (year < 500) return 'ancient';
  if (year < 1500) return 'medieval';
  if (year < 1800) return 'early';
  if (year < 1930) return 'industrial';
  if (year < 2030) return 'modern';
  return 'future';
}

export interface Layout {
  w: number;
  h: number;
  /** Rectangle the phone covers on screen. Draw the important action outside it. */
  phone: { x: number; y: number; w: number; h: number };
  /** True when the viewport is taller than wide (the phone fills most of it and dips during scenes). */
  portrait: boolean;
  /** Horizontal positions (px) that are visible beside the phone, best first. */
  slots: number[];
  /** Ground line (px from top). */
  groundY: number;
  /** Vertical centre of the free area above the ground. */
  midY: number;
}

export function makeLayout(w: number, h: number, phone: Layout['phone']): Layout {
  const portrait = h > w * 1.05 || phone.w > w * 0.7;
  let slots: number[];
  if (portrait) {
    // The phone dips during scenes, so the upper part of the screen is visible.
    slots = [w * 0.5, w * 0.22, w * 0.78, w * 0.36, w * 0.64];
  } else {
    const left = phone.x;
    const right = w - (phone.x + phone.w);
    slots = [left * 0.5, phone.x + phone.w + right * 0.5, left * 0.22, phone.x + phone.w + right * 0.78, left * 0.78, phone.x + phone.w + right * 0.22];
  }
  const groundY = portrait ? h * 0.56 : h * 0.78;
  return { w, h, phone, portrait, slots, groundY, midY: groundY * 0.5 };
}

/** Everything a scene's draw function receives each frame. */
export interface SceneFrame {
  g: CanvasRenderingContext2D;
  L: Layout;
  /** Seconds since the scene started. */
  t: number;
  /** Seconds since the previous frame. */
  dt: number;
  /** Scene duration in seconds. */
  dur: number;
  /** Progress 0..1. */
  p: number;
  /** Fade envelope 0..1: rises over the first 0.5s and falls over the last 0.7s. */
  a: number;
  era: EraLook;
  /** Seeded random for this scene instance (stable across frames when re-created with the same seed). */
  rand: Rand;
  /** Per-instance scratch space that persists between frames (particles, etc.). */
  mem: Record<string, unknown>;
}

export interface SceneDef {
  dur: number;
  /** Optional camera shake amplitude in px at time t. */
  shake?: (t: number, dur: number) => number;
  /** Optional colour wash over the whole stage, e.g. 'rgba(255,0,0,0.1)'. */
  draw: (f: SceneFrame) => void;
}

// ------------------------------------------------------------------ maths

export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
export const easeIn = (t: number) => Math.pow(clamp(t), 3);
export const easeInOut = (t: number) => {
  const x = clamp(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
/** 0→1 over [a,b] of t, eased. */
export const span = (t: number, a: number, b: number) => easeInOut((t - a) / (b - a));

export function envelope(t: number, dur: number, fadeIn = 0.5, fadeOut = 0.7): number {
  return clamp(Math.min(t / fadeIn, (dur - t) / fadeOut));
}

export interface Rand {
  (): number;
  range(a: number, b: number): number;
  pick<T>(xs: readonly T[]): T;
}

export function makeRand(seed: number): Rand {
  let a = seed >>> 0 || 1;
  const r = (() => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }) as Rand;
  r.range = (lo, hi) => lo + r() * (hi - lo);
  r.pick = (xs) => xs[Math.floor(r() * xs.length)];
  return r;
}

// ------------------------------------------------------------------ painting helpers

export function sky(g: CanvasRenderingContext2D, L: Layout, stops: string[], alpha = 1): void {
  const grad = g.createLinearGradient(0, 0, 0, L.h);
  stops.forEach((c, i) => grad.addColorStop(i / Math.max(1, stops.length - 1), c));
  g.save();
  g.globalAlpha *= alpha;
  g.fillStyle = grad;
  g.fillRect(0, 0, L.w, L.h);
  g.restore();
}

export function glow(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha = 1): void {
  if (r <= 0) return;
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.save();
  g.globalAlpha *= alpha;
  g.fillStyle = grad;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

export function ground(g: CanvasRenderingContext2D, L: Layout, color: string, alpha = 1): void {
  g.save();
  g.globalAlpha *= alpha;
  g.fillStyle = color;
  g.fillRect(0, L.groundY, L.w, L.h - L.groundY);
  g.restore();
}

/** A stylised standing person. (x, y) is the point between the feet; h is full height. */
export interface PersonOpts {
  color?: string;
  /** 'stand' | 'wave' | 'cheer' (both arms up) | 'walk' | 'sit' | 'fight' | 'kneel' */
  pose?: 'stand' | 'wave' | 'cheer' | 'walk' | 'fight' | 'kneel' | 'hold';
  /** Animation phase in seconds (drives walking / waving). */
  phase?: number;
  /** Faces right when 1, left when -1. */
  dir?: 1 | -1;
  dress?: boolean;
  hat?: 'none' | 'cap' | 'crown' | 'helmet' | 'grad' | 'hood' | 'tophat' | 'veil';
  /** Extra accent colour (dress, tie, sash). */
  accent?: string;
  alpha?: number;
}

export function person(g: CanvasRenderingContext2D, x: number, y: number, h: number, o: PersonOpts = {}): void {
  const col = o.color ?? '#1d2233';
  const ph = o.phase ?? 0;
  const dir = o.dir ?? 1;
  const head = h * 0.13;
  const shoulderY = y - h * 0.74;
  const hipY = y - h * 0.42;
  const lw = Math.max(2, h * 0.075);
  g.save();
  g.globalAlpha *= o.alpha ?? 1;
  g.strokeStyle = col;
  g.fillStyle = col;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.lineWidth = lw;
  const kneel = o.pose === 'kneel';
  const hip = kneel ? y - h * 0.3 : hipY;
  const sh = kneel ? shoulderY + h * 0.12 : shoulderY;
  // legs
  const swing = o.pose === 'walk' ? Math.sin(ph * 7) * h * 0.12 : 0;
  g.beginPath();
  if (kneel) {
    g.moveTo(x, hip);
    g.lineTo(x + dir * h * 0.15, y - h * 0.02);
    g.lineTo(x - dir * h * 0.12, y);
  } else {
    g.moveTo(x, hip);
    g.lineTo(x - h * 0.08 + swing, y);
    g.moveTo(x, hip);
    g.lineTo(x + h * 0.08 - swing, y);
  }
  g.stroke();
  // body
  if (o.dress) {
    g.beginPath();
    g.moveTo(x - h * 0.05, sh);
    g.lineTo(x + h * 0.05, sh);
    g.lineTo(x + h * 0.16, hip + h * 0.12);
    g.lineTo(x - h * 0.16, hip + h * 0.12);
    g.closePath();
    g.fillStyle = o.accent ?? col;
    g.fill();
    g.fillStyle = col;
  } else {
    g.beginPath();
    g.moveTo(x, sh);
    g.lineTo(x, hip);
    g.lineWidth = lw * 1.9;
    g.stroke();
    g.lineWidth = lw;
    if (o.accent) {
      g.strokeStyle = o.accent;
      g.lineWidth = lw * 0.6;
      g.beginPath();
      g.moveTo(x, sh + h * 0.02);
      g.lineTo(x, sh + h * 0.14);
      g.stroke();
      g.strokeStyle = col;
      g.lineWidth = lw;
    }
  }
  // arms
  const armLen = h * 0.3;
  const arm = (side: -1 | 1, angle: number) => {
    const ex = x + side * Math.sin(angle) * armLen;
    const ey = sh + h * 0.03 + Math.cos(angle) * armLen;
    g.beginPath();
    g.moveTo(x, sh + h * 0.03);
    g.lineTo(ex, ey);
    g.stroke();
  };
  switch (o.pose) {
    case 'wave':
      arm(dir === 1 ? -1 : 1, 0.25);
      arm(dir, Math.PI - 0.5 + Math.sin(ph * 9) * 0.35);
      break;
    case 'cheer':
      arm(-1, Math.PI - 0.45 + Math.sin(ph * 8) * 0.15);
      arm(1, Math.PI - 0.45 + Math.cos(ph * 8) * 0.15);
      break;
    case 'fight':
      arm(dir, Math.PI / 2 + Math.sin(ph * 14) * 0.5);
      arm(dir === 1 ? -1 : 1, 0.9);
      break;
    case 'hold':
      arm(-1, Math.PI / 2 - 0.2);
      arm(1, Math.PI / 2 - 0.2);
      break;
    case 'walk':
      arm(-1, 0.25 + Math.sin(ph * 7) * 0.35);
      arm(1, 0.25 - Math.sin(ph * 7) * 0.35);
      break;
    default:
      arm(-1, 0.22);
      arm(1, 0.22);
  }
  // head
  const hy = sh - head * 1.05;
  g.beginPath();
  g.arc(x, hy, head, 0, Math.PI * 2);
  g.fill();
  // hats
  const hat = o.hat ?? 'none';
  if (hat !== 'none') {
    g.save();
    g.fillStyle = o.accent ?? col;
    if (hat === 'crown') {
      g.fillStyle = '#f2c94c';
      g.beginPath();
      g.moveTo(x - head, hy - head * 0.6);
      g.lineTo(x - head, hy - head * 1.6);
      g.lineTo(x - head * 0.5, hy - head * 1.05);
      g.lineTo(x, hy - head * 1.8);
      g.lineTo(x + head * 0.5, hy - head * 1.05);
      g.lineTo(x + head, hy - head * 1.6);
      g.lineTo(x + head, hy - head * 0.6);
      g.closePath();
      g.fill();
    } else if (hat === 'grad') {
      g.fillStyle = '#111';
      g.fillRect(x - head * 1.5, hy - head * 1.25, head * 3, head * 0.35);
      g.fillRect(x - head * 0.7, hy - head * 1.05, head * 1.4, head * 0.5);
    } else if (hat === 'helmet') {
      g.beginPath();
      g.arc(x, hy - head * 0.1, head * 1.15, Math.PI, 0);
      g.fill();
    } else if (hat === 'hood') {
      g.beginPath();
      g.moveTo(x - head * 1.3, hy + head * 1.2);
      g.quadraticCurveTo(x - head * 1.4, hy - head * 1.6, x, hy - head * 2);
      g.quadraticCurveTo(x + head * 1.4, hy - head * 1.6, x + head * 1.3, hy + head * 1.2);
      g.closePath();
      g.fill();
    } else if (hat === 'tophat') {
      g.fillRect(x - head * 1.3, hy - head * 0.95, head * 2.6, head * 0.3);
      g.fillRect(x - head * 0.8, hy - head * 2.3, head * 1.6, head * 1.4);
    } else if (hat === 'cap') {
      g.beginPath();
      g.arc(x, hy - head * 0.2, head, Math.PI, 0);
      g.fill();
      g.fillRect(x, hy - head * 0.35, dir * head * 1.5, head * 0.25);
    } else if (hat === 'veil') {
      g.globalAlpha *= 0.75;
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.moveTo(x - head * 0.9, hy - head * 0.6);
      g.quadraticCurveTo(x, hy - head * 1.6, x + head * 0.9, hy - head * 0.6);
      g.lineTo(x + head * 2, y - h * 0.35);
      g.lineTo(x - head * 2, y - h * 0.35);
      g.closePath();
      g.fill();
    }
    g.restore();
  }
  g.restore();
}

/** A filled heart centred on (x, y) with half-width r. */
export function heart(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  g.save();
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x, y + r * 0.9);
  g.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.7, y - r * 1.4, x, y - r * 0.45);
  g.bezierCurveTo(x + r * 0.7, y - r * 1.4, x + r * 1.6, y - r * 0.2, x, y + r * 0.9);
  g.fill();
  g.restore();
}

/** A five-point star. */
export function star(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, rot = 0): void {
  g.save();
  g.fillStyle = color;
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = rot + (i * Math.PI) / 5 - Math.PI / 2;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
  g.restore();
}

/**
 * Era-appropriate skyline silhouette along baseY.
 * Deterministic for a given seed so it does not flicker between frames.
 */
export function skyline(g: CanvasRenderingContext2D, L: Layout, baseY: number, era: EraLook, color: string, seed = 7, windows?: string): void {
  const r = makeRand(seed);
  g.save();
  g.fillStyle = color;
  let x = -20;
  while (x < L.w + 20) {
    let bw = 40 + r() * 70;
    let bh = 30 + r() * 90;
    switch (era) {
      case 'ancient': {
        // temples with columns and pediments, low houses
        if (r() < 0.35) {
          bw = 90 + r() * 60;
          bh = 50 + r() * 30;
          g.fillRect(x, baseY - bh, bw, bh);
          g.beginPath();
          g.moveTo(x - 6, baseY - bh);
          g.lineTo(x + bw / 2, baseY - bh - 26);
          g.lineTo(x + bw + 6, baseY - bh);
          g.fill();
        } else {
          bh = 20 + r() * 30;
          g.fillRect(x, baseY - bh, bw, bh);
        }
        break;
      }
      case 'medieval': {
        if (r() < 0.3) {
          // tower with battlements
          bw = 34 + r() * 20;
          bh = 90 + r() * 60;
          g.fillRect(x, baseY - bh, bw, bh);
          for (let i = 0; i < 4; i++) g.fillRect(x + (i * bw) / 3.5, baseY - bh - 10, bw / 7, 10);
        } else if (r() < 0.4) {
          // church spire
          bw = 40;
          bh = 70 + r() * 40;
          g.fillRect(x, baseY - bh, bw, bh);
          g.beginPath();
          g.moveTo(x, baseY - bh);
          g.lineTo(x + bw / 2, baseY - bh - 60);
          g.lineTo(x + bw, baseY - bh);
          g.fill();
        } else {
          bh = 30 + r() * 30;
          g.fillRect(x, baseY - bh, bw, bh);
          g.beginPath();
          g.moveTo(x - 4, baseY - bh);
          g.lineTo(x + bw / 2, baseY - bh - 22);
          g.lineTo(x + bw + 4, baseY - bh);
          g.fill();
        }
        break;
      }
      case 'early': {
        bh = 40 + r() * 50;
        g.fillRect(x, baseY - bh, bw, bh);
        if (r() < 0.25) {
          g.beginPath();
          g.arc(x + bw / 2, baseY - bh, bw / 2.4, Math.PI, 0);
          g.fill();
        } else {
          g.beginPath();
          g.moveTo(x - 3, baseY - bh);
          g.lineTo(x + bw / 2, baseY - bh - 18);
          g.lineTo(x + bw + 3, baseY - bh);
          g.fill();
        }
        break;
      }
      case 'industrial': {
        bh = 50 + r() * 80;
        g.fillRect(x, baseY - bh, bw, bh);
        if (r() < 0.45) g.fillRect(x + bw * 0.6, baseY - bh - 50 - r() * 40, 10, 60 + r() * 40);
        break;
      }
      case 'modern': {
        bw = 36 + r() * 60;
        bh = 80 + r() * 220;
        g.fillRect(x, baseY - bh, bw, bh);
        if (r() < 0.2) g.fillRect(x + bw / 2 - 2, baseY - bh - 30, 4, 30);
        break;
      }
      case 'future': {
        bw = 30 + r() * 50;
        bh = 140 + r() * 260;
        g.beginPath();
        g.moveTo(x, baseY);
        g.lineTo(x + bw * 0.15, baseY - bh);
        g.lineTo(x + bw * 0.5, baseY - bh - 40);
        g.lineTo(x + bw * 0.85, baseY - bh);
        g.lineTo(x + bw, baseY);
        g.fill();
        break;
      }
    }
    if (windows && era !== 'ancient') {
      g.save();
      g.fillStyle = windows;
      const cols = Math.max(1, Math.floor(bw / 14));
      const rows = Math.max(1, Math.floor(bh / 18));
      for (let cx = 0; cx < cols; cx++)
        for (let cy = 0; cy < rows; cy++) if (r() < 0.35) g.fillRect(x + 5 + cx * 14, baseY - bh + 8 + cy * 18, 5, 7);
      g.restore();
      g.fillStyle = color;
    }
    x += bw + r() * 14;
  }
  g.restore();
}

/** Simple particle system stored in a scene's mem. */
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  rot?: number;
  vr?: number;
  kind?: number;
}

export function particles(mem: Record<string, unknown>, key = 'ps'): Particle[] {
  if (!mem[key]) mem[key] = [];
  return mem[key] as Particle[];
}

/** Advance particles with gravity (px/s²) and drop dead ones. */
export function stepParticles(ps: Particle[], dt: number, gravity = 0, drag = 0): void {
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i];
    p.vy += gravity * dt;
    if (drag) {
      p.vx *= 1 - drag * dt;
      p.vy *= 1 - drag * dt;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.vr) p.rot = (p.rot ?? 0) + p.vr * dt;
    p.life += dt;
    if (p.life >= p.max) ps.splice(i, 1);
  }
}

/** Confetti-style rectangles. */
export function drawConfetti(g: CanvasRenderingContext2D, ps: Particle[], alpha = 1): void {
  for (const p of ps) {
    g.save();
    g.globalAlpha *= alpha * clamp(1 - p.life / p.max + 0.3);
    g.translate(p.x, p.y);
    g.rotate(p.rot ?? 0);
    g.fillStyle = p.color;
    g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    g.restore();
  }
}

/** Soft round particles (smoke, sparks, dust). */
export function drawDots(g: CanvasRenderingContext2D, ps: Particle[], alpha = 1, fade = true): void {
  for (const p of ps) {
    g.save();
    g.globalAlpha *= alpha * (fade ? clamp(1 - p.life / p.max) : 1);
    g.fillStyle = p.color;
    g.beginPath();
    g.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
}

export const CONFETTI_COLORS = ['#ff5d73', '#ffd166', '#06d6a0', '#4cc9f0', '#b388ff', '#ff9f1c'];

/** Big caption text drawn on the stage (used sparingly, e.g. "POW"). */
export function caption(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, alpha = 1): void {
  g.save();
  g.globalAlpha *= alpha;
  g.font = `900 ${size}px system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = size / 8;
  g.strokeStyle = 'rgba(0,0,0,0.55)';
  g.strokeText(text, x, y);
  g.fillStyle = color;
  g.fillText(text, x, y);
  g.restore();
}
