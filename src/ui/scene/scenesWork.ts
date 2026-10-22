/**
 * Work, crime, pets and money scenes: offices, classrooms, labs, farms, heists, pets and shopping.
 *
 * Every scene paints its own full background, keeps its action beside the phone on desktop
 * (L.slots[0] / L.slots[1]) or in the upper part of the screen in portrait, and changes props by era.
 */
import type { WorkSceneId } from './ids';
import {
  CONFETTI_COLORS,
  clamp,
  drawConfetti,
  drawDots,
  easeOut,
  glow,
  heart,
  lerp,
  particles,
  sky,
  skyline,
  span,
  stepParticles,
  type EraLook,
  type Layout,
  type Particle,
  type SceneDef,
  type SceneFrame,
} from './kit';

type G = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const EI: Record<EraLook, number> = { ancient: 0, medieval: 1, early: 2, industrial: 3, modern: 4, future: 5 };

// ================================================================== frame + layout helpers

function mk(dur: number, draw: (f: SceneFrame) => void, shake?: (t: number, dur: number) => number): SceneDef {
  const def: SceneDef = {
    dur,
    draw: (f) => {
      f.g.save();
      f.g.globalAlpha *= f.a;
      draw(f);
      f.g.restore();
    },
  };
  if (shake) def.shake = shake;
  return def;
}

interface Box {
  /** Size unit: 1 when a figure is 200px tall. */
  u: number;
  /** Figure height. */
  FH: number;
  /** Floor line where feet stand. */
  FY: number;
  /** Left action x (beside the phone, or left of centre in portrait). */
  A: number;
  /** Right action x. */
  B: number;
  /** Centre x for single-subject scenes (slot 0 on desktop, screen centre in portrait). */
  C: number;
  P: boolean;
}

function box(L: Layout): Box {
  const side = L.portrait ? L.w : Math.min(L.phone.x, L.w - L.phone.x - L.phone.w);
  const FH = L.portrait ? Math.min(L.h * 0.18, L.w * 0.42) : Math.min(L.h * 0.22, side * 0.45);
  const u = FH / 200;
  return {
    u,
    FH,
    FY: L.portrait ? L.groundY - 16 * u : L.groundY,
    A: L.portrait ? L.w * 0.28 : L.slots[0],
    B: L.portrait ? L.w * 0.72 : L.slots[1],
    C: L.portrait ? L.w * 0.5 : L.slots[0],
    P: L.portrait,
  };
}

// ================================================================== painting primitives

function rrPath(g: G, x: number, y: number, w: number, h: number, r: number): void {
  r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function rr(g: G, x: number, y: number, w: number, h: number, r: number, col: string): void {
  rrPath(g, x, y, w, h, r);
  g.fillStyle = col;
  g.fill();
}

function circ(g: G, x: number, y: number, r: number, col: string): void {
  g.fillStyle = col;
  g.beginPath();
  g.arc(x, y, Math.max(0, r), 0, TAU);
  g.fill();
}

function ell(g: G, x: number, y: number, rx: number, ry: number, col: string, rot = 0): void {
  g.fillStyle = col;
  g.beginPath();
  g.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), rot, 0, TAU);
  g.fill();
}

function ln(g: G, x1: number, y1: number, x2: number, y2: number, col: string, w: number): void {
  g.strokeStyle = col;
  g.lineWidth = w;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
}

function poly(g: G, col: string, pts: number[]): void {
  g.fillStyle = col;
  g.beginPath();
  for (let i = 0; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
  g.fill();
}

function withA(g: G, a: number, fn: () => void): void {
  if (a <= 0.001) return;
  const b = g.globalAlpha;
  g.globalAlpha = b * clamp(a);
  fn();
  g.globalAlpha = b;
}

/** Four-point twinkle. */
function sparkle(g: G, x: number, y: number, r: number, col: string): void {
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(x, y - r);
  g.quadraticCurveTo(x, y, x + r, y);
  g.quadraticCurveTo(x, y, x, y + r);
  g.quadraticCurveTo(x, y, x - r, y);
  g.quadraticCurveTo(x, y, x, y - r);
  g.fill();
}

function text(g: G, s: string, x: number, y: number, size: number, col: string, outline = true, weight = 900): void {
  g.font = `${weight} ${Math.max(6, size)}px system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (outline) {
    g.lineWidth = size / 7;
    g.lineJoin = 'round';
    g.strokeStyle = 'rgba(0,0,0,0.55)';
    g.strokeText(s, x, y);
  }
  g.fillStyle = col;
  g.fillText(s, x, y);
}

/** Wall gradient plus a floor band. */
function room(g: G, L: Layout, FY: number, top: string, bot: string, floorCol: string, edge = 'rgba(255,255,255,0.08)'): void {
  sky(g, L, [top, bot]);
  g.fillStyle = floorCol;
  g.fillRect(0, FY, L.w, L.h - FY);
  g.fillStyle = edge;
  g.fillRect(0, FY, L.w, 3);
}

function rays(g: G, x: number, y: number, r0: number, r1: number, n: number, rot: number, col: string, w: number): void {
  g.strokeStyle = col;
  g.lineWidth = w;
  g.lineCap = 'round';
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU;
    g.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
    g.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
  }
  g.stroke();
}

/** Spawn `rate` things per second, stored as a fractional accumulator in mem. */
function emit(f: SceneFrame, key: string, rate: number, fn: () => void, cap = 300, ps?: Particle[]): void {
  const k = '_e' + key;
  let acc = ((f.mem[k] as number | undefined) ?? 0) + rate * f.dt;
  while (acc >= 1) {
    acc -= 1;
    if (!ps || ps.length < cap) fn();
  }
  f.mem[k] = acc;
}

/** True the first time it is called for a key. */
function once(f: SceneFrame, key: string): boolean {
  if (f.mem[key]) return false;
  f.mem[key] = 1;
  return true;
}

function spawn(ps: Particle[], x: number, y: number, vx: number, vy: number, max: number, size: number, color: string, kind = 0, rot = 0, vr = 0): void {
  if (ps.length >= 300) return;
  ps.push({ x, y, vx, vy, life: 0, max, size, color, kind, rot, vr });
}

/** Draw particles with a custom painter; alpha fades out over the last third of life. */
function drawPs(g: G, ps: Particle[], fn: (p: Particle) => void): void {
  const b = g.globalAlpha;
  for (const p of ps) {
    g.globalAlpha = b * clamp((1 - p.life / p.max) * 3);
    fn(p);
  }
  g.globalAlpha = b;
}

function clock(g: G, x: number, y: number, r: number, t: number, face = '#fdf6e3', rim = '#2b2b38'): void {
  circ(g, x, y, r * 1.12, rim);
  circ(g, x, y, r, face);
  g.strokeStyle = rim;
  g.lineWidth = r * 0.07;
  g.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    g.moveTo(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8);
    g.lineTo(x + Math.cos(a) * r * 0.92, y + Math.sin(a) * r * 0.92);
  }
  g.stroke();
  const tick = Math.floor(t * 2) + easeOut(((t * 2) % 1) * 4);
  const sa = -Math.PI / 2 + (tick / 12) * TAU;
  const ma = -Math.PI / 2 + t * 0.9;
  ln(g, x, y, x + Math.cos(ma) * r * 0.55, y + Math.sin(ma) * r * 0.55, rim, r * 0.1);
  ln(g, x, y, x + Math.cos(sa) * r * 0.8, y + Math.sin(sa) * r * 0.8, '#e63946', r * 0.05);
  circ(g, x, y, r * 0.08, rim);
}

function bill(g: G, x: number, y: number, s: number, rot: number, col = '#5fbf5a'): void {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.fillStyle = col;
  g.fillRect(-s, -s * 0.5, s * 2, s);
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.fillRect(-s * 0.85, -s * 0.38, s * 1.7, s * 0.76);
  circ(g, 0, 0, s * 0.3, '#2f7a32');
  g.restore();
}

function paper(g: G, x: number, y: number, w: number, h: number, rot: number, col = '#fbfaf3', lines = '#9db0d0', n = 5): void {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.fillStyle = col;
  g.fillRect(-w / 2, -h / 2, w, h);
  g.fillStyle = lines;
  for (let i = 0; i < n; i++) g.fillRect(-w * 0.36, -h * 0.36 + (i * h * 0.72) / Math.max(1, n - 1), w * (i % 3 === 2 ? 0.45 : 0.72), Math.max(1, h * 0.035));
  g.restore();
}

// ================================================================== figures

type Hat = 'none' | 'fedora' | 'hard' | 'top' | 'cap' | 'surg' | 'chef' | 'hood' | 'bun' | 'grad';
interface FigO {
  dir?: 1 | -1;
  /** Front arm angle (0 down, PI/2 forward, PI up). */
  armF?: number;
  armB?: number;
  hat?: Hat;
  hatCol?: string;
  /** Tie / sash colour. */
  accent?: string;
  dress?: string;
  /** Walk phase (s). */
  walk?: number;
  /** Bend forward at the hips (radians). */
  lean?: number;
  /** Nod the head down (0..1). */
  nod?: number;
}
interface FigPts {
  fx: number;
  fy: number;
  bx: number;
  by: number;
  hx: number;
  hy: number;
  hr: number;
}

function fig(g: G, x: number, y: number, h: number, col: string, o: FigO = {}): FigPts {
  const dir = o.dir ?? 1;
  const lw = Math.max(2, h * 0.08);
  const hipY = y - h * 0.42;
  const sw = o.walk !== undefined ? Math.sin(o.walk * 7) * h * 0.12 : 0;
  g.strokeStyle = col;
  g.fillStyle = col;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.lineWidth = lw;
  g.beginPath();
  g.moveTo(x, hipY);
  g.lineTo(x - h * 0.08 + sw, y);
  g.moveTo(x, hipY);
  g.lineTo(x + h * 0.08 - sw, y);
  g.stroke();
  const lean = (o.lean ?? 0) * dir;
  const c = Math.cos(lean);
  const s = Math.sin(lean);
  const P = (dx: number, dy: number): [number, number] => [x + dx * c - dy * s, hipY + dx * s + dy * c];
  const [sx, sy] = P(0, -h * 0.32);
  if (o.dress) {
    const a1 = P(-h * 0.05, -h * 0.32);
    const a2 = P(h * 0.05, -h * 0.32);
    const a3 = P(h * 0.17, h * 0.12);
    const a4 = P(-h * 0.17, h * 0.12);
    poly(g, o.dress, [a1[0], a1[1], a2[0], a2[1], a3[0], a3[1], a4[0], a4[1]]);
  } else {
    g.lineWidth = lw * 2;
    g.beginPath();
    g.moveTo(x, hipY);
    g.lineTo(sx, sy);
    g.stroke();
    if (o.accent) {
      const t0 = P(0, -h * 0.3);
      const t1 = P(0, -h * 0.17);
      ln(g, t0[0], t0[1], t1[0], t1[1], o.accent, lw * 0.7);
    }
  }
  g.strokeStyle = col;
  g.lineWidth = lw;
  const arm = (ang: number, side: number): [number, number] => {
    const L = h * 0.3;
    const dx = side * dir * Math.sin(ang) * L;
    const dy = Math.cos(ang) * L;
    const ex = sx + dx * c - dy * s;
    const ey = sy + dx * s + dy * c;
    g.beginPath();
    g.moveTo(sx, sy);
    g.lineTo(ex, ey);
    g.stroke();
    return [ex, ey];
  };
  const [bx, by] = arm(o.armB ?? 0.2, -1);
  const [fx, fy] = arm(o.armF ?? 0.2, 1);
  const nod = (o.nod ?? 0) * 0.08 * h;
  const [hx0, hy0] = P(0, -h * 0.47);
  const hx = hx0 + dir * nod * 0.6;
  const hy = hy0 + nod;
  const hr = h * 0.13;
  circ(g, hx, hy, hr, col);
  hat(g, hx, hy, hr, o.hat ?? 'none', o.hatCol ?? col, dir);
  return { fx, fy, bx, by, hx, hy, hr };
}

function hat(g: G, x: number, y: number, r: number, kind: Hat, col: string, dir: number): void {
  switch (kind) {
    case 'fedora':
      ell(g, x, y - r * 0.55, r * 1.7, r * 0.28, col);
      rr(g, x - r * 0.9, y - r * 1.55, r * 1.8, r * 1.05, r * 0.4, col);
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.fillRect(x - r * 0.9, y - r * 0.85, r * 1.8, r * 0.2);
      break;
    case 'hard':
      g.fillStyle = col;
      g.beginPath();
      g.arc(x, y - r * 0.2, r * 1.15, Math.PI, 0);
      g.fill();
      g.fillRect(x - r * 1.45, y - r * 0.32, r * 2.9, r * 0.28);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(x - r * 0.12, y - r * 1.3, r * 0.24, r * 1.0);
      break;
    case 'top':
      g.fillStyle = col;
      g.fillRect(x - r * 1.3, y - r * 0.95, r * 2.6, r * 0.3);
      g.fillRect(x - r * 0.8, y - r * 2.3, r * 1.6, r * 1.4);
      break;
    case 'cap':
      g.fillStyle = col;
      g.beginPath();
      g.arc(x, y - r * 0.2, r, Math.PI, 0);
      g.fill();
      g.fillRect(x, y - r * 0.35, dir * r * 1.5, r * 0.25);
      break;
    case 'surg':
      g.fillStyle = col;
      g.beginPath();
      g.arc(x, y - r * 0.15, r * 1.08, Math.PI, 0);
      g.fill();
      rr(g, x - r * 0.95 + dir * r * 0.15, y + r * 0.05, r * 1.9, r * 0.85, r * 0.3, '#eaf6ff');
      break;
    case 'chef':
      g.fillStyle = '#ffffff';
      g.fillRect(x - r * 0.9, y - r * 1.2, r * 1.8, r * 0.6);
      circ(g, x - r * 0.5, y - r * 1.5, r * 0.6, '#ffffff');
      circ(g, x + r * 0.5, y - r * 1.5, r * 0.6, '#ffffff');
      circ(g, x, y - r * 1.8, r * 0.7, '#ffffff');
      break;
    case 'hood':
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(x - r * 1.3, y + r * 1.2);
      g.quadraticCurveTo(x - r * 1.4, y - r * 1.6, x, y - r * 2);
      g.quadraticCurveTo(x + r * 1.4, y - r * 1.6, x + r * 1.3, y + r * 1.2);
      g.closePath();
      g.fill();
      break;
    case 'bun':
      circ(g, x - dir * r * 0.8, y - r * 0.6, r * 0.55, col);
      break;
    case 'grad':
      g.fillStyle = col;
      poly(g, col, [x - r * 1.6, y - r * 1.1, x, y - r * 1.6, x + r * 1.6, y - r * 1.1, x, y - r * 0.6]);
      g.fillRect(x - r * 0.75, y - r * 1.05, r * 1.5, r * 0.5);
      break;
    default:
  }
}

// ================================================================== animals & vehicles

/** Horse (or ox). (x, y) = ground under the body centre, s = body length. */
function horse(g: G, x: number, y: number, s: number, col: string, t: number, dir: 1 | -1, speed: number, o: { ox?: boolean; mane?: string; rider?: string; riderHat?: Hat; riderHatCol?: string } = {}): void {
  const ph = t * speed;
  const gal = speed > 0 ? 1 : 0;
  const bob = gal * Math.sin(ph * 2) * s * 0.035;
  const by = y - s * 0.62 + bob;
  g.save();
  g.translate(x, 0);
  g.scale(dir, 1);
  g.strokeStyle = col;
  g.lineCap = 'round';
  const legW = s * (o.ox ? 0.09 : 0.065);
  const leg = (lx: number, off: number, front: boolean, shade: string) => {
    const a = gal * Math.sin(ph + off) * 0.6;
    const hipY = by + s * 0.08;
    const kx = lx + Math.sin(a) * s * 0.27;
    const ky = hipY + Math.cos(a) * s * 0.27;
    const a2 = a + (front ? -1 : 1) * gal * Math.max(0, Math.cos(ph + off)) * 0.9;
    const hx = kx + Math.sin(a2) * s * 0.28;
    const hy = Math.min(y, ky + Math.cos(a2) * s * 0.28);
    g.strokeStyle = shade;
    g.lineWidth = legW;
    g.beginPath();
    g.moveTo(lx, hipY);
    g.lineTo(kx, ky);
    g.lineTo(hx, hy);
    g.stroke();
  };
  const dark = 'rgba(0,0,0,0.25)';
  // far legs first (darker)
  g.save();
  leg(s * 0.3, 1.6, true, col);
  leg(-s * 0.3, 4.7, false, col);
  g.globalAlpha *= 1;
  g.restore();
  withA(g, 1, () => {
    g.save();
    g.globalCompositeOperation = 'source-over';
    g.restore();
  });
  leg(s * 0.26, 0, true, col);
  leg(-s * 0.34, 3.1, false, col);
  // tail
  g.strokeStyle = o.mane ?? col;
  g.lineWidth = s * (o.ox ? 0.035 : 0.08);
  g.beginPath();
  g.moveTo(-s * 0.4, by - s * 0.06);
  const tw = Math.sin(ph * 1.5) * s * 0.08;
  g.quadraticCurveTo(-s * 0.62, by - s * 0.02 + tw, -s * 0.6 - gal * s * 0.15, by + s * (o.ox ? 0.35 : 0.25) - gal * s * 0.15);
  g.stroke();
  // body
  ell(g, 0, by, s * 0.45, s * (o.ox ? 0.24 : 0.19), col);
  withA(g, 0.5, () => ell(g, -s * 0.05, by + s * 0.1, s * 0.33, s * 0.07, dark));
  if (o.ox) {
    // short neck, low head and horns
    poly(g, col, [s * 0.3, by - s * 0.16, s * 0.6, by - s * 0.05, s * 0.62, by + s * 0.12, s * 0.3, by + s * 0.12]);
    ell(g, s * 0.66, by + s * 0.05, s * 0.13, s * 0.11, col, 0.4);
    g.strokeStyle = '#f2ead8';
    g.lineWidth = s * 0.035;
    g.beginPath();
    g.moveTo(s * 0.62, by - s * 0.04);
    g.quadraticCurveTo(s * 0.55, by - s * 0.2, s * 0.68, by - s * 0.22);
    g.moveTo(s * 0.7, by - s * 0.02);
    g.quadraticCurveTo(s * 0.82, by - s * 0.15, s * 0.74, by - s * 0.24);
    g.stroke();
    circ(g, s * 0.7, by + s * 0.02, s * 0.018, '#111');
  } else {
    const nb = gal * Math.sin(ph * 2 + 0.5) * s * 0.03;
    poly(g, col, [s * 0.22, by - s * 0.12, s * 0.48, by - s * 0.48 + nb, s * 0.6, by - s * 0.38 + nb, s * 0.44, by + s * 0.06]);
    ell(g, s * 0.62, by - s * 0.36 + nb, s * 0.17, s * 0.075, col, 0.55);
    poly(g, col, [s * 0.5, by - s * 0.47 + nb, s * 0.52, by - s * 0.58 + nb, s * 0.56, by - s * 0.46 + nb]);
    circ(g, s * 0.59, by - s * 0.41 + nb, s * 0.018, '#111');
    g.strokeStyle = o.mane ?? '#1a1210';
    g.lineWidth = s * 0.05;
    g.beginPath();
    g.moveTo(s * 0.48, by - s * 0.5 + nb);
    g.quadraticCurveTo(s * 0.34 - gal * s * 0.06, by - s * 0.33, s * 0.22, by - s * 0.14);
    g.stroke();
  }
  if (o.rider) {
    const rx = s * 0.02;
    const ry = by - s * 0.18;
    g.strokeStyle = o.rider;
    g.lineWidth = s * 0.07;
    ln(g, rx, ry, rx + s * 0.08, ry - s * 0.32, o.rider, s * 0.09);
    ln(g, rx + s * 0.06, ry - s * 0.26, rx + s * 0.3, ry - s * 0.18, o.rider, s * 0.05);
    ln(g, rx, ry, rx + s * 0.1, ry + s * 0.2, o.rider, s * 0.06);
    circ(g, rx + s * 0.1, ry - s * 0.42, s * 0.08, o.rider);
    if (o.riderHat) hat(g, rx + s * 0.1, ry - s * 0.42, s * 0.08, o.riderHat, o.riderHatCol ?? o.rider, 1);
  }
  g.restore();
}

interface CarO {
  police?: boolean;
  old?: boolean;
  hover?: boolean;
  bag?: boolean;
}
/** Side-view car. (x, y) = ground under the centre, len = body length, faces dir. */
function car(g: G, x: number, y: number, len: number, dir: 1 | -1, body: string, t: number, o: CarO = {}): void {
  g.save();
  g.translate(x, 0);
  g.scale(dir, 1);
  const lift = o.hover ? len * 0.12 + Math.sin(t * 5) * len * 0.02 : 0;
  const bounce = Math.abs(Math.sin(t * 18)) * len * 0.012;
  const wy = y - len * 0.1 - lift;
  const top = y - len * 0.3 - lift - bounce;
  if (o.hover) glow(g, 0, y - lift * 0.4, len * 0.5, 'rgba(90,220,255,0.6)');
  if (o.old) {
    rr(g, -len * 0.5, top, len, len * 0.18, len * 0.03, body);
    rr(g, -len * 0.3, top - len * 0.2, len * 0.36, len * 0.22, len * 0.02, body);
    g.fillStyle = '#a6d4ff';
    g.fillRect(-len * 0.26, top - len * 0.16, len * 0.13, len * 0.12);
    g.fillRect(-len * 0.1, top - len * 0.16, len * 0.13, len * 0.12);
    g.fillStyle = '#222';
    g.fillRect(-len * 0.55, wy - len * 0.02, len * 1.1, len * 0.03);
  } else {
    g.fillStyle = body;
    g.beginPath();
    g.moveTo(-len * 0.5, wy + len * 0.02);
    g.lineTo(-len * 0.5, top + len * 0.05);
    g.lineTo(-len * 0.3, top);
    g.lineTo(-len * 0.18, top - len * 0.16);
    g.lineTo(len * 0.14, top - len * 0.16);
    g.lineTo(len * 0.28, top);
    g.lineTo(len * 0.48, top + len * 0.03);
    g.lineTo(len * 0.5, wy + len * 0.02);
    g.closePath();
    g.fill();
    g.fillStyle = '#9fd3ff';
    poly(g, '#9fd3ff', [-len * 0.27, top + len * 0.01, -len * 0.16, top - len * 0.12, -len * 0.03, top - len * 0.12, -len * 0.03, top + len * 0.01]);
    poly(g, '#9fd3ff', [len * 0.01, top + len * 0.01, len * 0.01, top - len * 0.12, len * 0.12, top - len * 0.12, len * 0.23, top + len * 0.01]);
    if (o.police) {
      g.fillStyle = '#1b2440';
      g.fillRect(-len * 0.28, top + len * 0.04, len * 0.5, len * 0.1);
      text(g, 'POLICE', -len * 0.03, top + len * 0.09, len * 0.075, '#ffffff', false);
    }
    circ(g, len * 0.47, top + len * 0.08, len * 0.03, '#fff6b0');
    glow(g, len * 0.55, top + len * 0.08, len * 0.3, 'rgba(255,240,170,0.45)');
    g.fillStyle = '#ff3b3b';
    g.fillRect(-len * 0.5, top + len * 0.05, len * 0.03, len * 0.05);
  }
  if (o.police) {
    const ph = Math.floor(t * 8) % 2;
    const ly = (o.old ? top - len * 0.2 : top - len * 0.16) - len * 0.04;
    rr(g, -len * 0.12, ly, len * 0.1, len * 0.045, len * 0.01, ph ? '#ff2b3b' : '#5a1218');
    rr(g, -len * 0.02, ly, len * 0.1, len * 0.045, len * 0.01, ph ? '#1c2c70' : '#3d8bff');
    glow(g, ph ? -len * 0.07 : len * 0.03, ly, len * 0.45, ph ? 'rgba(255,40,60,0.7)' : 'rgba(60,130,255,0.75)');
  }
  if (o.bag) {
    const bx = -len * 0.08;
    const byy = (o.old ? top - len * 0.2 : top - len * 0.16) - len * 0.07;
    ell(g, bx, byy, len * 0.09, len * 0.07, '#c8a66b');
    text(g, '$', bx, byy + len * 0.005, len * 0.09, '#2f7a32', false);
  }
  if (!o.hover) {
    for (const wx of [-len * 0.32, len * 0.3]) {
      circ(g, wx, wy, len * 0.1, '#15151b');
      circ(g, wx, wy, len * 0.05, '#9aa3b5');
      const a = -t * 25;
      ln(g, wx, wy, wx + Math.cos(a) * len * 0.05, wy + Math.sin(a) * len * 0.05, '#15151b', len * 0.015);
    }
  }
  g.restore();
}

function cat(g: G, x: number, y: number, s: number, col: string, t: number): void {
  // curled cat: (x, y) = ground under its middle, s = length
  const br = 1 + Math.sin(t * 3) * 0.03;
  ell(g, x, y - s * 0.22 * br, s * 0.45, s * 0.24 * br, col);
  // tail wrapping round the front
  g.strokeStyle = col;
  g.lineWidth = s * 0.09;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x + s * 0.4, y - s * 0.12);
  const tw = Math.sin(t * 2.2) * s * 0.06;
  g.quadraticCurveTo(x + s * 0.2, y + s * 0.02, x - s * 0.25, y - s * 0.03 + tw);
  g.quadraticCurveTo(x - s * 0.45, y - s * 0.06 + tw, x - s * 0.5, y - s * 0.16 + tw);
  g.stroke();
  // head resting on the left
  const hx = x - s * 0.33;
  const hy = y - s * 0.24 + Math.sin(t * 3) * s * 0.01;
  circ(g, hx, hy, s * 0.17, col);
  poly(g, col, [hx - s * 0.16, hy - s * 0.06, hx - s * 0.13, hy - s * 0.3, hx - s * 0.02, hy - s * 0.14]);
  poly(g, col, [hx + s * 0.02, hy - s * 0.14, hx + s * 0.11, hy - s * 0.3, hx + s * 0.16, hy - s * 0.06]);
  poly(g, '#ff9fb4', [hx - s * 0.13, hy - s * 0.1, hx - s * 0.12, hy - s * 0.22, hx - s * 0.06, hy - s * 0.14]);
  // closed eyes
  g.strokeStyle = '#1a1a22';
  g.lineWidth = s * 0.02;
  g.beginPath();
  g.arc(hx - s * 0.07, hy, s * 0.04, 0.2, Math.PI - 0.2);
  g.moveTo(hx + s * 0.1, hy);
  g.arc(hx + s * 0.06, hy, s * 0.04, 0.2, Math.PI - 0.2);
  g.stroke();
  circ(g, hx - s * 0.005, hy + s * 0.06, s * 0.02, '#ff7a99');
  // stripes
  g.strokeStyle = 'rgba(0,0,0,0.18)';
  g.lineWidth = s * 0.05;
  g.beginPath();
  for (let i = 0; i < 3; i++) {
    g.moveTo(x - s * 0.05 + i * s * 0.14, y - s * 0.44 * br);
    g.lineTo(x - s * 0.02 + i * s * 0.14, y - s * 0.32 * br);
  }
  g.stroke();
}

function dog(g: G, x: number, y: number, s: number, col: string, t: number): void {
  // lying dog facing right, (x, y) = surface, s = length
  ell(g, x, y - s * 0.14, s * 0.4, s * 0.15, col);
  ell(g, x + s * 0.18, y - s * 0.03, s * 0.2, s * 0.05, col);
  const hx = x + s * 0.38;
  const hy = y - s * 0.3;
  circ(g, hx, hy, s * 0.15, col);
  ell(g, hx + s * 0.14, hy + s * 0.04, s * 0.1, s * 0.07, col);
  circ(g, hx + s * 0.23, hy + s * 0.02, s * 0.03, '#1a1a22');
  ell(g, hx - s * 0.09, hy + s * 0.04, s * 0.06, s * 0.13, 'rgba(0,0,0,0.35)', 0.3);
  circ(g, hx + s * 0.04, hy - s * 0.03, s * 0.025, '#1a1a22');
  const wag = Math.sin(t * 14) * 0.5;
  g.strokeStyle = col;
  g.lineWidth = s * 0.06;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x - s * 0.36, y - s * 0.2);
  g.lineTo(x - s * 0.36 - Math.cos(wag + 0.6) * s * 0.22, y - s * 0.2 - Math.sin(wag + 0.6) * s * 0.22);
  g.stroke();
}

function parrot(g: G, x: number, y: number, s: number, t: number, body = '#e63946', wing = '#1d9bf0'): void {
  // (x, y) = feet on perch, s = height
  const bob = Math.sin(t * 6) * s * 0.03;
  g.save();
  g.translate(x, y);
  // tail
  poly(g, wing, [-s * 0.08, -s * 0.2, s * 0.02, -s * 0.2, -s * 0.06, s * 0.45, -s * 0.18, s * 0.42]);
  poly(g, '#ffd166', [-s * 0.06, -s * 0.15, -s * 0.02, -s * 0.15, -s * 0.09, s * 0.35, -s * 0.14, s * 0.34]);
  ell(g, 0, -s * 0.35, s * 0.17, s * 0.3, body, -0.15);
  ell(g, -s * 0.05, -s * 0.32, s * 0.1, s * 0.24, wing, -0.25);
  ell(g, -s * 0.07, -s * 0.18, s * 0.07, s * 0.12, '#06d6a0', -0.25);
  const hy = -s * 0.68 + bob;
  circ(g, s * 0.04, hy, s * 0.14, body);
  circ(g, s * 0.08, hy - s * 0.02, s * 0.055, '#ffffff');
  circ(g, s * 0.095, hy - s * 0.02, s * 0.028, '#111');
  g.fillStyle = '#ffd166';
  g.beginPath();
  g.moveTo(s * 0.14, hy - s * 0.04);
  g.quadraticCurveTo(s * 0.3, hy - s * 0.02, s * 0.2, hy + s * 0.12);
  g.lineTo(s * 0.13, hy + s * 0.05);
  g.closePath();
  g.fill();
  ln(g, -s * 0.04, 0, -s * 0.04, -s * 0.08, '#444', s * 0.03);
  ln(g, s * 0.05, 0, s * 0.05, -s * 0.08, '#444', s * 0.03);
  g.restore();
}

/** Era-appropriate desk device. (x, y) = desk top centre, s = scale (figure height units). */
function deskDevice(g: G, f: SceneFrame, x: number, y: number, u: number): void {
  const { t, era } = f;
  const e = EI[era];
  if (e <= 2) {
    // parchment, inkpot and a scratching quill
    g.save();
    g.translate(x, y - 3 * u);
    g.transform(1, 0, -0.5, 0.35, 0, 0);
    g.fillStyle = '#f1e2b8';
    g.fillRect(-55 * u, -70 * u, 110 * u, 70 * u);
    g.restore();
    const lines = Math.floor(t * 2.2);
    for (let i = 0; i < Math.min(5, lines + 1); i++) {
      const w = i < lines ? 70 * u : ((t * 2.2) % 1) * 70 * u;
      ln(g, x - 40 * u + i * 2 * u, y - 22 * u + i * 4 * u, x - 40 * u + i * 2 * u + w, y - 22 * u + i * 4 * u, '#3a2a55', 1.5 * u);
    }
    const qi = Math.min(4, lines);
    const qx = x - 40 * u + qi * 2 * u + ((t * 2.2) % 1) * 70 * u;
    const qy = y - 22 * u + qi * 4 * u + Math.sin(t * 30) * 1.5 * u;
    g.save();
    g.translate(qx, qy);
    g.rotate(-0.6);
    ell(g, 0, -40 * u, 9 * u, 38 * u, '#ffffff');
    ln(g, 0, 0, 0, -75 * u, '#c8c0d8', 2 * u);
    g.restore();
    rr(g, x + 42 * u, y - 18 * u, 18 * u, 18 * u, 4 * u, '#1d2233');
  } else if (e === 3) {
    // typewriter with a sheet and flying letters
    rr(g, x - 52 * u, y - 30 * u, 104 * u, 30 * u, 6 * u, '#2a2d38');
    poly(g, '#3b3f4c', [x - 44 * u, y - 30 * u, x + 44 * u, y - 30 * u, x + 36 * u, y - 46 * u, x - 36 * u, y - 46 * u]);
    rr(g, x - 56 * u, y - 54 * u, 112 * u, 10 * u, 5 * u, '#15161c');
    const sh = 40 * u + Math.min(40 * u, t * 12 * u);
    g.fillStyle = '#fbfaf3';
    g.fillRect(x - 32 * u, y - 50 * u - sh, 64 * u, sh);
    g.fillStyle = '#20263a';
    for (let i = 0; i < Math.floor(sh / (8 * u)); i++) g.fillRect(x - 26 * u, y - 50 * u - sh + 6 * u + i * 8 * u, (i % 3 === 2 ? 26 : 50) * u, 2 * u);
    g.fillStyle = '#d6d9e0';
    for (let r = 0; r < 2; r++) for (let k = 0; k < 7; k++) circ(g, x - 36 * u + k * 12 * u + r * 6 * u, y - 18 * u + r * 9 * u, 3.5 * u, (Math.floor(t * 14) + k + r) % 9 === 0 ? '#ffd166' : '#d6d9e0');
    const car2 = ((t * 0.5) % 1) * 30 * u;
    rr(g, x + 50 * u - car2, y - 62 * u, 10 * u, 8 * u, 2 * u, '#c9a227');
  } else if (e === 4) {
    // computer monitor with scrolling code
    rr(g, x - 6 * u, y - 30 * u, 12 * u, 30 * u, 2 * u, '#2a2d38');
    rr(g, x - 26 * u, y - 6 * u, 52 * u, 6 * u, 3 * u, '#2a2d38');
    glow(g, x, y - 75 * u, 110 * u, 'rgba(80,170,255,0.45)');
    rr(g, x - 66 * u, y - 122 * u, 132 * u, 92 * u, 7 * u, '#1b1e28');
    rr(g, x - 60 * u, y - 116 * u, 120 * u, 80 * u, 4 * u, '#0d2a4a');
    const cols = ['#4cc9f0', '#ffd166', '#06d6a0', '#ff5d73', '#b388ff'];
    const scroll = Math.floor(t * 4);
    for (let i = 0; i < 7; i++) {
      const k = scroll + i;
      const w = (20 + ((k * 37) % 70)) * u;
      g.fillStyle = cols[k % cols.length];
      g.fillRect(x - 52 * u + ((k * 13) % 3) * 8 * u, y - 108 * u + i * 10 * u, i === 6 ? w * ((t * 4) % 1) : w, 4 * u);
    }
    rr(g, x - 50 * u, y - 4 * u, 100 * u, 8 * u, 3 * u, '#3a3f50');
  } else {
    // floating hologram panels
    const fl = 0.75 + 0.25 * Math.sin(t * 23) * Math.sin(t * 7);
    glow(g, x, y - 70 * u, 130 * u, 'rgba(60,240,255,0.5)');
    withA(g, 0.35 * fl, () => poly(g, '#5ff6ff', [x - 20 * u, y, x + 20 * u, y, x + 70 * u, y - 120 * u, x - 70 * u, y - 120 * u]));
    for (let i = 0; i < 3; i++) {
      const px = x + (i - 1) * 46 * u;
      const py = y - 95 * u + Math.sin(t * 2 + i) * 6 * u - (i === 1 ? 14 * u : 0);
      withA(g, 0.6 * fl, () => {
        rr(g, px - 24 * u, py - 32 * u, 48 * u, 56 * u, 5 * u, 'rgba(90,240,255,0.5)');
        g.fillStyle = '#e8ffff';
        for (let k = 0; k < 4; k++) g.fillRect(px - 17 * u, py - 22 * u + k * 11 * u, (14 + ((i * 7 + k * 11 + Math.floor(t * 3)) % 20)) * u, 3 * u);
      });
    }
    rr(g, x - 30 * u, y - 5 * u, 60 * u, 5 * u, 2 * u, '#5ff6ff');
  }
}

function desk(g: G, x: number, FY: number, w: number, u: number, top: string, front: string): number {
  const ty = FY - 82 * u;
  rr(g, x - w / 2, ty, w, 10 * u, 3 * u, top);
  g.fillStyle = front;
  g.fillRect(x - w / 2 + 6 * u, ty + 10 * u, w - 12 * u, 72 * u);
  g.fillStyle = 'rgba(255,255,255,0.08)';
  g.fillRect(x - w / 2 + 14 * u, ty + 22 * u, w * 0.35, 3 * u);
  return ty;
}

// ================================================================== WORK & STUDY

const office = mk(3.4, (f) => {
  const { g, L, t, era } = f;
  const { u, FY, A, B, FH, P } = box(L);
  const e = EI[era];
  room(g, L, FY, e >= 5 ? '#121638' : e <= 2 ? '#4a3524' : '#2c3e6e', e >= 5 ? '#2a2f6a' : e <= 2 ? '#6b4b30' : '#4f70b0', e <= 2 ? '#3a2616' : '#262a3e');
  // window with the town outside
  const ww = (P ? 170 : 220) * u;
  const wh = 160 * u;
  const wx = B - ww / 2;
  const wy = FY - 330 * u;
  rr(g, wx - 8 * u, wy - 8 * u, ww + 16 * u, wh + 16 * u, 6 * u, e <= 2 ? '#2b1a0e' : '#1b2440');
  g.save();
  rrPath(g, wx, wy, ww, wh, 3 * u);
  g.clip();
  sky(g, L, ['#7fc8ff', '#ffd9a0']);
  circ(g, wx + ww * 0.75, wy + wh * 0.3, 16 * u, '#fff3b0');
  for (let i = 0; i < 6; i++) {
    const bh = (30 + ((i * 47) % 70)) * u * (e >= 4 ? 1.3 : 0.7);
    g.fillStyle = i % 2 ? '#5a78b8' : '#3f5a96';
    g.fillRect(wx + (i * ww) / 6, wy + wh - bh, ww / 6 - 3 * u, bh);
  }
  g.restore();
  ln(g, wx + ww / 2, wy, wx + ww / 2, wy + wh, e <= 2 ? '#2b1a0e' : '#1b2440', 5 * u);
  ln(g, wx, wy + wh / 2, wx + ww, wy + wh / 2, e <= 2 ? '#2b1a0e' : '#1b2440', 5 * u);
  // clock
  clock(g, B + (P ? 0 : ww * 0.7), P ? wy - 52 * u : wy + 20 * u, 34 * u, t * 3);
  // plant and filing cabinet on the right
  rr(g, B - 40 * u, FY - 110 * u, 80 * u, 110 * u, 4 * u, e <= 2 ? '#5b3b20' : '#8b95ad');
  for (let i = 0; i < 3; i++) rr(g, B - 32 * u, FY - 100 * u + i * 34 * u, 64 * u, 28 * u, 3 * u, e <= 2 ? '#6e4a2a' : '#a5afc6');
  // papers piling up on the cabinet
  const pile = Math.floor(span(t, 0.3, 2.8) * 8);
  for (let i = 0; i < pile; i++) paper(g, B + Math.sin(i * 3.1) * 4 * u, FY - 114 * u - i * 5 * u, 58 * u, 8 * u, Math.sin(i * 2.3) * 0.08, '#fbfaf3', '#fbfaf3', 0);
  // the worker
  const dx = A + (P ? 22 : 40) * u;
  const typing = 1.25 + Math.sin(t * 22) * 0.12;
  fig(g, dx, FY, FH, '#1d2233', { dir: -1, armF: typing, armB: 1.1 + Math.cos(t * 19) * 0.1, accent: '#ff5d73', hat: e <= 2 ? 'top' : 'none', nod: 0.4 + Math.sin(t * 2) * 0.2 });
  const ty = desk(g, A, FY, (P ? 200 : 240) * u, u, e <= 2 ? '#8a5a32' : '#d48c4a', e <= 2 ? '#6b4325' : '#b06c35');
  deskDevice(g, f, A - (P ? 28 : 40) * u, ty, u);
  // coffee mug with steam (or a candle in old eras)
  const mx = A + (P ? 75 : 95) * u;
  if (e <= 2) {
    rr(g, mx - 5 * u, ty - 28 * u, 10 * u, 28 * u, 2 * u, '#fff3d6');
    glow(g, mx, ty - 36 * u, 45 * u, 'rgba(255,190,80,0.8)', 0.85 + 0.15 * Math.sin(t * 20));
    ell(g, mx, ty - 35 * u, 4 * u, 8 * u, '#ffcf5a');
  } else {
    rr(g, mx - 10 * u, ty - 22 * u, 20 * u, 22 * u, 4 * u, '#ff5d73');
    for (let i = 0; i < 2; i++) {
      const k = (t * 0.8 + i * 0.5) % 1;
      withA(g, 0.5 * (1 - k), () => circ(g, mx + Math.sin(k * 8 + i) * 5 * u, ty - 28 * u - k * 40 * u, (5 + k * 6) * u, '#ffffff'));
    }
  }
  // sheets fly off the desk
  const ps = particles(f.mem);
  emit(f, 'p', 3, () => spawn(ps, A - 30 * u, ty - 20 * u, f.rand.range(-60, 60) * u, f.rand.range(-160, -110) * u, 1.6, 22 * u, '#fbfaf3', 0, 0, f.rand.range(-4, 4)), 30, ps);
  stepParticles(ps, f.dt, 140 * u, 0.6);
  drawConfetti(g, ps);
});

const meeting = mk(3.4, (f) => {
  const { g, L, t, era } = f;
  const { u, FY, A, B, FH, P } = box(L);
  const e = EI[era];
  room(g, L, FY, '#203a5c', '#3c6b8f', '#1c2b3d');
  // chart board on the right with growing bars
  const bw = (P ? 170 : 240) * u;
  const bh = 170 * u;
  const bx = B - bw / 2;
  const by = FY - 330 * u;
  glow(g, B, by + bh / 2, bw * 0.9, 'rgba(120,200,255,0.35)');
  rr(g, bx - 8 * u, by - 8 * u, bw + 16 * u, bh + 16 * u, 6 * u, e <= 2 ? '#5b3b20' : '#cfd6e6');
  rr(g, bx, by, bw, bh, 3 * u, e <= 2 ? '#2d3a2a' : e >= 5 ? '#0b2238' : '#ffffff');
  const bars = [0.35, 0.55, 0.45, 0.8, 1.0];
  const cols = ['#4cc9f0', '#06d6a0', '#ffd166', '#ff9f1c', '#ff5d73'];
  for (let i = 0; i < bars.length; i++) {
    const k = span(t, 0.3 + i * 0.25, 0.9 + i * 0.25);
    const hh = bars[i] * (bh - 30 * u) * k;
    const xw = (bw - 30 * u) / bars.length;
    rr(g, bx + 15 * u + i * xw + xw * 0.15, by + bh - 12 * u - hh, xw * 0.7, hh, 2 * u, e <= 2 ? '#f4f1e1' : cols[i]);
  }
  // trend arrow
  const ak = span(t, 1.4, 2.4);
  if (ak > 0) {
    const x0 = bx + 20 * u;
    const y0 = by + bh - 30 * u;
    const x1 = lerp(x0, bx + bw - 18 * u, ak);
    const y1 = lerp(y0, by + 18 * u, ak);
    ln(g, x0, y0, x1, y1, '#ff3d5a', 6 * u);
    poly(g, '#ff3d5a', [x1 + 10 * u, y1 - 8 * u, x1 - 6 * u, y1 - 6 * u, x1 + 4 * u, y1 + 10 * u]);
  }
  // presenter with a pointer
  const px = B + (P ? -bw / 2 + 4 * u : bw / 2 + 30 * u);
  const pd: 1 | -1 = P ? 1 : -1;
  const pp = fig(g, px, FY, FH, '#14213d', { dir: pd, armF: 2.2 + Math.sin(t * 2) * 0.15, accent: '#ffd166', dress: P ? undefined : '#ff5d73' });
  ln(g, pp.fx, pp.fy, pp.fx + pd * 50 * u, pp.fy - 50 * u, '#d0b07a', 3 * u);
  // table with nodding colleagues
  const tw = (P ? 180 : 260) * u;
  const n = P ? 2 : 3;
  for (let i = 0; i < n; i++) {
    const x = A - tw / 2 + (tw / n) * (i + 0.5);
    const nod = Math.max(0, Math.sin(t * 5 + i * 1.7)) * 0.8;
    fig(g, x, FY - 10 * u, FH * 0.85, ['#2e4057', '#3b2f5c', '#1f4e5f'][i], { dir: i % 2 ? -1 : 1, armF: 1.3, armB: 1.2, nod, accent: ['#06d6a0', '#ffd166', '#4cc9f0'][i] });
  }
  const ty = FY - 70 * u;
  rr(g, A - tw / 2 - 14 * u, ty, tw + 28 * u, 14 * u, 6 * u, e <= 2 ? '#7a4a28' : '#d9dde8');
  g.fillStyle = e <= 2 ? '#5a3418' : '#9aa3b8';
  g.fillRect(A - tw / 2, ty + 14 * u, 10 * u, 56 * u);
  g.fillRect(A + tw / 2 - 10 * u, ty + 14 * u, 10 * u, 56 * u);
  for (let i = 0; i < n; i++) paper(g, A - tw / 2 + (tw / n) * (i + 0.5), ty - 2 * u, 28 * u, 6 * u, 0, '#ffffff', '#ffffff', 0);
  // idea / agreement marks
  const ps = particles(f.mem);
  emit(f, 'm', 2.5, () => spawn(ps, A + f.rand.range(-tw / 2, tw / 2), FY - FH * 1.05, f.rand.range(-10, 10) * u, -50 * u, 1.2, 9 * u, f.rand.pick(['#06d6a0', '#ffd166']), 0), 20, ps);
  stepParticles(ps, f.dt);
  drawPs(g, ps, (p) => {
    g.strokeStyle = p.color;
    g.lineWidth = 3 * u;
    g.beginPath();
    g.moveTo(p.x - p.size, p.y);
    g.lineTo(p.x - p.size * 0.3, p.y + p.size * 0.7);
    g.lineTo(p.x + p.size, p.y - p.size * 0.8);
    g.stroke();
  });
});

const interview = mk(3.4, (f) => {
  const { g, L, t, era } = f;
  const { u, FY, A, B, FH, P } = box(L);
  const e = EI[era];
  room(g, L, FY, '#3d2c5e', '#6c4f8f', '#2a1f3c');
  glow(g, A, FY - FH * 0.7, FH * 1.4, 'rgba(255,220,160,0.35)');
  // two chairs facing each other; candidate and interviewer
  const gap = (P ? 48 : 70) * u;
  const meet = span(t, 1.2, 1.8);
  const chair = (x: number, dir: number) => {
    g.fillStyle = '#ff9f1c';
    g.fillRect(x - 24 * u, FY - 58 * u, 48 * u, 9 * u);
    g.fillRect(x - dir * 24 * u - 4 * u, FY - 130 * u, 9 * u, 80 * u);
    g.fillRect(x - 20 * u, FY - 50 * u, 6 * u, 50 * u);
    g.fillRect(x + 14 * u, FY - 50 * u, 6 * u, 50 * u);
  };
  chair(A - gap - 10 * u, 1);
  chair(A + gap + 10 * u, -1);
  const lx = A - gap + meet * 22 * u;
  const rx = A + gap - meet * 22 * u;
  const shake = t > 1.8 && t < 2.8 ? Math.sin(t * 22) * 0.18 : 0;
  const a = fig(g, lx, FY, FH, '#1d2233', { dir: 1, armF: lerp(0.3, 1.45, meet) + shake, accent: '#4cc9f0' });
  const b = fig(g, rx, FY, FH, '#3a1f4d', { dir: -1, armF: lerp(0.3, 1.45, meet) + shake, accent: '#ffd166', hat: e <= 2 ? 'top' : 'none' });
  if (meet > 0.95) {
    const hx = (a.fx + b.fx) / 2;
    const hy = (a.fy + b.fy) / 2;
    glow(g, hx, hy, 50 * u, 'rgba(255,230,140,0.9)');
    circ(g, hx, hy, 9 * u, '#2b2238');
    for (let i = 0; i < 3; i++) sparkle(g, hx + Math.cos(t * 3 + i * 2.1) * 30 * u, hy - 20 * u + Math.sin(t * 3 + i * 2.1) * 16 * u, 7 * u, '#fff3b0');
  }
  // the résumé on the right gets stamped
  const rw = (P ? 110 : 150) * u;
  const rh = rw * 1.3;
  const ry = FY - 170 * u - rh / 2 + Math.sin(t * 2) * 5 * u;
  g.save();
  g.translate(B, ry);
  g.rotate(-0.08);
  glow(g, 0, 0, rw * 1.1, 'rgba(255,255,255,0.35)');
  rr(g, -rw / 2, -rh / 2, rw, rh, 6 * u, e <= 2 ? '#f1e2b8' : '#ffffff');
  circ(g, -rw * 0.28, -rh * 0.32, rw * 0.12, '#8fb3ff');
  g.fillStyle = '#2d3a5c';
  g.fillRect(-rw * 0.1, -rh * 0.38, rw * 0.45, rh * 0.04);
  g.fillStyle = '#b6c0d6';
  g.fillRect(-rw * 0.1, -rh * 0.29, rw * 0.3, rh * 0.03);
  for (let i = 0; i < 6; i++) g.fillRect(-rw * 0.38, -rh * 0.12 + i * rh * 0.08, rw * (i % 2 ? 0.55 : 0.76), rh * 0.03);
  const st = span(t, 2.0, 2.2);
  if (st > 0) {
    const sc = lerp(2.2, 1, st);
    g.save();
    g.translate(rw * 0.12, rh * 0.18);
    g.rotate(-0.25);
    g.scale(sc, sc);
    withA(g, st, () => {
      g.strokeStyle = '#06a77d';
      g.lineWidth = 5 * u;
      rrPath(g, -40 * u, -16 * u, 80 * u, 32 * u, 6 * u);
      g.stroke();
      text(g, 'HIRED', 0, 1 * u, 20 * u, '#06a77d', false);
    });
    g.restore();
  }
  g.restore();
});

const classroom = mk(3.4, (f) => {
  const { g, L, t, era } = f;
  const { u, FY, A, B, FH, P } = box(L);
  const e = EI[era];
  room(g, L, FY, '#f2c57c', '#e69a5a', '#7a4a2a');
  // board
  const bw = (P ? 175 : 250) * u;
  const bh = 140 * u;
  const bx = B - bw / 2 + (P ? 0 : 20 * u);
  const by = FY - 320 * u;
  rr(g, bx - 9 * u, by - 9 * u, bw + 18 * u, bh + 18 * u, 5 * u, '#8a5a32');
  rr(g, bx, by, bw, bh, 3 * u, e >= 5 ? '#0d2a4a' : '#24533f');
  if (e >= 5) glow(g, bx + bw / 2, by + bh / 2, bw * 0.6, 'rgba(80,220,255,0.3)');
  const chalk = e >= 5 ? '#7ff3ff' : '#f4f6ee';
  const lines = e <= 0 ? ['α β γ', '1 + 1 = 2'] : ['A B C', '2 + 2 = 4'];
  for (let i = 0; i < lines.length; i++) {
    const k = span(t, 0.2 + i * 0.9, 1.0 + i * 0.9);
    if (k <= 0) continue;
    g.save();
    g.beginPath();
    g.rect(bx, by, bw * 0.12 + bw * 0.8 * k, bh);
    g.clip();
    text(g, lines[i], bx + bw / 2, by + bh * (0.32 + i * 0.36), 30 * u, chalk, false, 700);
    g.restore();
  }
  // teacher pointing at the board
  const tx = P ? bx + bw - 6 * u : bx - 32 * u;
  const td: 1 | -1 = P ? -1 : 1;
  fig(g, tx, FY, FH, '#2b2d42', { dir: td, armF: 2.1 + Math.sin(t * 3) * 0.2, accent: '#e63946', dress: '#7b2cbf', hat: 'bun' });
  // students at desks raising hands
  const n = P ? 3 : 3;
  const sp = (P ? 52 : 80) * u;
  for (let i = 0; i < n; i++) {
    const x = A + (i - (n - 1) / 2) * sp;
    const up = Math.max(0, Math.sin(t * 2.5 + i * 2.2));
    fig(g, x, FY - 6 * u, FH * 0.7, ['#ef476f', '#118ab2', '#06d6a0'][i], { dir: -1 as 1 | -1, armF: lerp(1.2, Math.PI - 0.2 + Math.sin(t * 12 + i) * 0.1, up), armB: 1.2 });
    rr(g, x - 26 * u, FY - 58 * u, 52 * u, 9 * u, 2 * u, '#c58a4a');
    g.fillStyle = '#7a4a2a';
    g.fillRect(x - 20 * u, FY - 50 * u, 40 * u, 50 * u);
    if (up > 0.8) sparkle(g, x + 4 * u, FY - FH * 0.95 - 10 * u, 8 * u, '#fff3b0');
  }
  // apple on the front desk
  circ(g, A + sp * 1.2, FY - 66 * u, 9 * u, '#e63946');
  ell(g, A + sp * 1.2 + 4 * u, FY - 77 * u, 5 * u, 2.5 * u, '#06a77d', -0.5);
});

const exam = mk(3.4, (f) => {
  const { g, L, t } = f;
  const { u, FY, A, B, P } = box(L);
  room(g, L, FY, '#1f3b73', '#3a6ea5', '#14284d');
  glow(g, A, FY - 190 * u, 260 * u, 'rgba(255,255,255,0.25)');
  // the test paper
  const pw = (P ? 150 : 200) * u;
  const ph = pw * 1.25;
  const cy = FY - 200 * u;
  g.save();
  g.translate(A, cy);
  g.rotate(-0.06);
  rr(g, -pw / 2, -ph / 2, pw, ph, 6 * u, '#fffdf4');
  g.fillStyle = '#20263a';
  g.fillRect(-pw * 0.4, -ph * 0.42, pw * 0.4, ph * 0.04);
  for (let i = 0; i < 5; i++) {
    const yy = -ph * 0.26 + i * ph * 0.13;
    g.fillStyle = '#9db0d0';
    g.fillRect(-pw * 0.4, yy, pw * 0.52, ph * 0.025);
    if (t > 0.35 + i * 0.3) {
      g.strokeStyle = '#06a77d';
      g.lineWidth = 4 * u;
      g.beginPath();
      g.moveTo(pw * 0.2, yy);
      g.lineTo(pw * 0.26, yy + ph * 0.04);
      g.lineTo(pw * 0.38, yy - ph * 0.05);
      g.stroke();
    }
  }
  // big grade stamp
  const st = span(t, 1.95, 2.15);
  if (st > 0) {
    const sc = lerp(2.6, 1, st);
    g.save();
    g.translate(pw * 0.18, -ph * 0.36);
    g.rotate(0.2);
    g.scale(sc, sc);
    withA(g, st, () => {
      g.strokeStyle = '#e63946';
      g.lineWidth = 5 * u;
      g.beginPath();
      g.arc(0, 0, 34 * u, 0, TAU);
      g.stroke();
      text(g, 'A+', 0, 2 * u, 36 * u, '#e63946', false);
    });
    g.restore();
  }
  g.restore();
  if (t > 2.15) {
    const ps = particles(f.mem, 'c');
    if (once(f, 'burst')) for (let i = 0; i < 40; i++) spawn(ps, A + pw * 0.18, cy - ph * 0.36, f.rand.range(-260, 260) * u, f.rand.range(-320, -40) * u, 1.6, 12 * u, f.rand.pick(CONFETTI_COLORS), 0, 0, f.rand.range(-8, 8));
    stepParticles(ps, f.dt, 380 * u, 0.8);
    drawConfetti(g, ps);
  }
  // pencil scribbling across (before the stamp)
  const pk = clamp(t / 1.9);
  const prow = Math.min(4, Math.floor(pk * 5));
  const ppx = A - pw * 0.15 + Math.sin(t * 25) * 10 * u + pw * 0.45;
  const ppy = cy - ph * 0.26 + prow * ph * 0.13;
  g.save();
  g.translate(ppx, t < 1.9 ? ppy : lerp(ppy, ppy + 60 * u, span(t, 1.9, 2.3)));
  g.rotate(0.6);
  g.fillStyle = '#ffd166';
  g.fillRect(-7 * u, -95 * u, 14 * u, 80 * u);
  g.fillStyle = '#ff8fa3';
  g.fillRect(-7 * u, -108 * u, 14 * u, 12 * u);
  poly(g, '#f1d3a4', [-7 * u, -15 * u, 7 * u, -15 * u, 0, 0]);
  circ(g, 0, -3 * u, 2.5 * u, '#222');
  g.restore();
  // ticking clock on the right with a countdown ring
  const cr = (P ? 52 : 70) * u;
  const cx = B;
  const cyy = FY - 230 * u;
  const k = clamp(t / 3);
  glow(g, cx, cyy, cr * 1.8, 'rgba(255,90,90,0.35)', 0.6 + 0.4 * Math.sin(t * 12));
  g.strokeStyle = '#ffd166';
  g.lineWidth = 8 * u;
  g.beginPath();
  g.arc(cx, cyy, cr * 1.3, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - k));
  g.stroke();
  clock(g, cx, cyy, cr, t * 4);
  // sweat
  for (let i = 0; i < 2; i++) {
    const kk = (t * 1.2 + i * 0.5) % 1;
    withA(g, 1 - kk, () => ell(g, cx + (i ? 1 : -1) * cr * 1.35, cyy - cr * 0.6 + kk * 40 * u, 5 * u, 8 * u, '#7fd6ff'));
  }
}, (t) => (t > 1.95 && t < 2.3 ? 6 : 0));

const library = mk(3.4, (f) => {
  const { g, L, t } = f;
  const { u, FY, A, B, FH, P } = box(L);
  room(g, L, FY, '#3b2418', '#6e4024', '#2a170c');
  glow(g, L.w * 0.5, FY * 0.35, L.w * 0.5, 'rgba(255,200,120,0.25)');
  // tall shelves at both sides
  const shelf = (cx: number, w: number, seed: number) => {
    const top = FY - 380 * u;
    rr(g, cx - w / 2 - 8 * u, top - 8 * u, w + 16 * u, FY - top + 8 * u, 4 * u, '#4a2a14');
    const rowH = 62 * u;
    let s = seed;
    const cols = ['#e63946', '#118ab2', '#06d6a0', '#ffd166', '#7b2cbf', '#ff9f1c', '#f4f1de', '#3d5a80'];
    for (let r = 0; r < 6; r++) {
      const y = top + r * rowH;
      g.fillStyle = '#2a170c';
      g.fillRect(cx - w / 2, y, w, rowH - 6 * u);
      let x = cx - w / 2 + 3 * u;
      while (x < cx + w / 2 - 12 * u) {
        s = (s * 9301 + 49297) % 233280;
        const bw = (8 + (s % 9)) * u;
        const bh = rowH - (12 + (s % 14)) * u;
        g.fillStyle = cols[s % cols.length];
        g.fillRect(x, y + rowH - 6 * u - bh, bw, bh);
        g.fillStyle = 'rgba(255,255,255,0.25)';
        g.fillRect(x + bw * 0.2, y + rowH - 6 * u - bh + 6 * u, bw * 0.6, 2 * u);
        x += bw + 1.5 * u;
      }
      g.fillStyle = '#6e4024';
      g.fillRect(cx - w / 2, y + rowH - 6 * u, w, 6 * u);
    }
  };
  const sw = (P ? 150 : 220) * u;
  shelf(A, sw, 17);
  shelf(B, sw, 91);
  // rolling ladder with a climber
  const lx = A + lerp(-sw * 0.3, sw * 0.25, span(t, 0.2, 1.6));
  const ltop = FY - 340 * u;
  ln(g, lx - 18 * u, FY, lx - 4 * u, ltop, '#c58a4a', 5 * u);
  ln(g, lx + 18 * u, FY, lx + 32 * u, ltop, '#c58a4a', 5 * u);
  for (let i = 1; i < 9; i++) {
    const k = i / 9;
    ln(g, lerp(lx - 18 * u, lx - 4 * u, k), lerp(FY, ltop, k), lerp(lx + 18 * u, lx + 32 * u, k), lerp(FY, ltop, k), '#c58a4a', 3 * u);
  }
  const climb = span(t, 0.8, 2.4);
  const cyy = FY - climb * 150 * u;
  fig(g, lx + 7 * u + climb * 6 * u, cyy, FH * 0.9, '#1d2233', { dir: 1, armF: 2.6, armB: 2.3 + Math.sin(t * 6) * 0.2, accent: '#ffd166', walk: climb < 1 ? t : undefined });
  // floating glowing books from the right shelf
  const n = 5;
  for (let i = 0; i < n; i++) {
    const k = span(t, 0.3 + i * 0.25, 1.6 + i * 0.25);
    if (k <= 0) continue;
    const bx = B + (i - 2) * 40 * u + Math.sin(t * 2 + i) * 10 * u;
    const by = FY - 120 * u - i * 40 * u - k * 120 * u + Math.sin(t * 3 + i * 2) * 8 * u;
    const flap = Math.sin(t * 9 + i) * 0.6;
    glow(g, bx, by, 50 * u, 'rgba(255,230,150,0.6)');
    g.save();
    g.translate(bx, by);
    g.rotate(Math.sin(t + i) * 0.2);
    const col = ['#e63946', '#118ab2', '#06d6a0', '#ffd166', '#7b2cbf'][i];
    g.save();
    g.scale(1, 0.6 + 0.4 * Math.cos(flap));
    poly(g, col, [0, 0, -26 * u, -8 * u, -26 * u, 12 * u, 0, 18 * u]);
    poly(g, col, [0, 0, 26 * u, -8 * u, 26 * u, 12 * u, 0, 18 * u]);
    poly(g, '#fffbe8', [0, 2 * u, -22 * u, -5 * u, -22 * u, 10 * u, 0, 15 * u]);
    poly(g, '#fffbe8', [0, 2 * u, 22 * u, -5 * u, 22 * u, 10 * u, 0, 15 * u]);
    g.restore();
    g.restore();
  }
  const ps = particles(f.mem);
  emit(f, 'd', 14, () => spawn(ps, B + f.rand.range(-90, 90) * u, FY - f.rand.range(100, 340) * u, f.rand.range(-8, 8) * u, f.rand.range(-30, -10) * u, 1.5, f.rand.range(1.5, 3.5) * u, '#ffe6a6'), 60, ps);
  stepParticles(ps, f.dt);
  drawDots(g, ps);
});

const lab = mk(3.4, (f) => {
  const { g, L, t, era } = f;
  const { u, FY, A, B, FH, P } = box(L);
  const e = EI[era];
  room(g, L, FY, e <= 2 ? '#2b1e3a' : '#1b4965', e <= 2 ? '#4b2f5a' : '#3d8fae', e <= 2 ? '#1a1224' : '#12324a');
  // bench on the right with beakers
  const bw = (P ? 180 : 250) * u;
  const ty = FY - 82 * u;
  rr(g, B - bw / 2, ty, bw, 12 * u, 3 * u, '#38405a');
  g.fillStyle = '#4f5a78';
  g.fillRect(B - bw / 2 + 8 * u, ty + 12 * u, bw - 16 * u, 70 * u);
  const ps = particles(f.mem);
  const liquids = ['#06d6a0', '#ff5d73', '#b388ff', '#ffd166'];
  for (let i = 0; i < 3; i++) {
    const x = B - bw * 0.3 + i * bw * 0.3;
    const h = (i === 1 ? 90 : 65) * u;
    const col = liquids[i];
    glow(g, x, ty - h * 0.35, 60 * u, col, 0.5);
    if (i === 1) {
      // flask
      withA(g, 0.35, () => {
        g.fillStyle = '#e8f6ff';
        g.beginPath();
        g.moveTo(x - 7 * u, ty - h);
        g.lineTo(x + 7 * u, ty - h);
        g.lineTo(x + 7 * u, ty - h * 0.55);
        g.lineTo(x + 30 * u, ty);
        g.lineTo(x - 30 * u, ty);
        g.lineTo(x - 7 * u, ty - h * 0.55);
        g.closePath();
        g.fill();
      });
      poly(g, col, [x - 22 * u, ty - h * 0.22, x + 22 * u, ty - h * 0.22, x + 30 * u, ty, x - 30 * u, ty]);
    } else {
      withA(g, 0.35, () => rr(g, x - 18 * u, ty - h, 36 * u, h, 4 * u, '#e8f6ff'));
      rr(g, x - 18 * u, ty - h * 0.55, 36 * u, h * 0.55, 4 * u, col);
    }
    emit(f, 'b' + i, 7, () => spawn(ps, x + f.rand.range(-8, 8) * u, ty - h * (i === 1 ? 1 : 0.55), f.rand.range(-12, 12) * u, f.rand.range(-90, -50) * u, 1.3, f.rand.range(3, 7) * u, col, 1), 120, ps);
  }
  // microscope on the left bench end
  const mx = A + (P ? 55 : 80) * u;
  rr(g, mx - 40 * u, ty, 80 * u, 12 * u, 3 * u, '#38405a');
  g.fillStyle = '#4f5a78';
  g.fillRect(mx - 34 * u, ty + 12 * u, 68 * u, 70 * u);
  if (e >= 3) {
    rr(g, mx - 16 * u, ty - 8 * u, 32 * u, 8 * u, 2 * u, '#1d2233');
    ln(g, mx + 6 * u, ty - 6 * u, mx + 10 * u, ty - 50 * u, '#1d2233', 7 * u);
    g.save();
    g.translate(mx - 2 * u, ty - 50 * u);
    g.rotate(-0.5);
    rr(g, -6 * u, -36 * u, 12 * u, 46 * u, 3 * u, '#e9edf5');
    g.restore();
    rr(g, mx - 14 * u, ty - 26 * u, 28 * u, 4 * u, 1 * u, '#1d2233');
  } else {
    // alembic
    circ(g, mx, ty - 22 * u, 22 * u, '#c58a4a');
    ln(g, mx + 10 * u, ty - 40 * u, mx + 40 * u, ty - 60 * u, '#c58a4a', 5 * u);
  }
  // the scientist
  const eureka = t > 1.9;
  const sc = fig(g, A - (P ? 15 : 20) * u, FY, FH, '#f4f6fb', { dir: 1, armF: eureka ? Math.PI - 0.3 : 1.2, armB: eureka ? Math.PI - 0.5 : 0.4, nod: eureka ? 0 : 0.8, hat: 'none' });
  // goggles
  rr(g, sc.hx - sc.hr * 0.2, sc.hy - sc.hr * 0.4, sc.hr * 1.3, sc.hr * 0.5, sc.hr * 0.2, '#4cc9f0');
  ln(g, sc.hx - 0, sc.hy + sc.hr * 1.1, sc.hx, sc.hy + sc.hr * 2.6, '#c8d3e6', 2 * u);
  if (eureka) {
    const k = span(t, 1.9, 2.3);
    const bx = sc.hx;
    const by = sc.hy - sc.hr * 2.6 - 30 * u;
    glow(g, bx, by, 110 * u * k, 'rgba(255,240,120,0.9)');
    rays(g, bx, by, 34 * u, (34 + 40 * k) * u, 12, t * 0.8, '#ffe066', 4 * u);
    circ(g, bx, by, 22 * u * k, '#fff3a0');
    rr(g, bx - 9 * u, by + 18 * u * k, 18 * u, 12 * u * k, 3 * u, '#9aa3b5');
  }
  stepParticles(ps, f.dt);
  drawPs(g, ps, (p) => {
    g.strokeStyle = p.color;
    g.lineWidth = 2 * u;
    g.beginPath();
    g.arc(p.x + Math.sin(p.life * 9) * 3 * u, p.y, p.size, 0, TAU);
    g.stroke();
  });
});

const factory = mk(3.4, (f) => {
  const { g, L, t, era } = f;
  const { u, FY, A, B, FH, P } = box(L);
  const e = EI[era];
  sky(g, L, e >= 5 ? ['#1b1440', '#4a2c7a'] : ['#5a4a6a', '#d98a5a']);
  // smokestacks along the back
  const ps = particles(f.mem);
  const stacks = P ? [L.w * 0.15, L.w * 0.85] : [A - 120 * u, B + 140 * u, A + 130 * u];
  for (const sx of stacks) {
    const sh = 330 * u;
    if (e >= 3) {
      g.fillStyle = '#3a2a35';
      g.fillRect(sx - 18 * u, FY - sh, 36 * u, sh);
      g.fillStyle = '#e63946';
      g.fillRect(sx - 18 * u, FY - sh + 20 * u, 36 * u, 10 * u);
      emit(f, 's' + sx, 6, () => spawn(ps, sx, FY - sh, f.rand.range(10, 40) * u, f.rand.range(-70, -40) * u, 2.2, f.rand.range(14, 24) * u, e >= 5 ? '#b9a4ff' : '#9a8f98', 0), 120, ps);
    }
  }
  stepParticles(ps, f.dt);
  for (const p of ps) p.size += f.dt * 12 * u;
  drawDots(g, ps, 0.55);
  g.fillStyle = '#2a2236';
  g.fillRect(0, FY - 150 * u, L.w, 150 * u);
  g.fillStyle = '#1a1424';
  g.fillRect(0, FY, L.w, L.h - FY);
  // big turning gears on the right
  const gear = (x: number, y: number, r: number, teeth: number, rot: number, col: string) => {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.fillStyle = col;
    g.beginPath();
    for (let i = 0; i < teeth * 2; i++) {
      const a = (i / (teeth * 2)) * TAU;
      const rr2 = i % 2 ? r : r * 1.18;
      g.lineTo(Math.cos(a - 0.12) * rr2, Math.sin(a - 0.12) * rr2);
      g.lineTo(Math.cos(a + 0.12) * rr2, Math.sin(a + 0.12) * rr2);
    }
    g.closePath();
    g.fill();
    circ(g, 0, 0, r * 0.45, 'rgba(0,0,0,0.35)');
    circ(g, 0, 0, r * 0.18, col);
    g.restore();
  };
  const r1 = (P ? 48 : 64) * u;
  glow(g, B, FY - 230 * u, 180 * u, 'rgba(255,190,90,0.4)');
  gear(B - r1 * 0.65, FY - 250 * u, r1, 10, t * 1.5, '#ffb703');
  gear(B + r1 * 1.15, FY - 250 * u + r1 * 0.55, r1 * 0.7, 7, -t * 1.5 * (10 / 7) + 0.2, '#fb8500');
  gear(B - r1 * 0.2, FY - 250 * u - r1 * 1.55, r1 * 0.55, 6, -t * 1.5 * (10 / 6), '#8ecae6');
  // conveyor belt on the left with boxes
  const cw = (P ? 200 : 300) * u;
  const cy = FY - 70 * u;
  rr(g, A - cw / 2, cy, cw, 16 * u, 8 * u, '#2b2d42');
  for (let i = 0; i < 9; i++) {
    const rx = A - cw / 2 + 8 * u + (i * (cw - 16 * u)) / 8;
    circ(g, rx, cy + 8 * u, 6 * u, '#8d99ae');
    ln(g, rx, cy + 8 * u, rx + Math.cos(t * 8) * 5 * u, cy + 8 * u + Math.sin(t * 8) * 5 * u, '#2b2d42', 2 * u);
  }
  g.fillStyle = '#3d405b';
  g.fillRect(A - cw / 2 + 10 * u, cy + 16 * u, 10 * u, 54 * u);
  g.fillRect(A + cw / 2 - 20 * u, cy + 16 * u, 10 * u, 54 * u);
  const spacing = 70 * u;
  const off = (t * 60 * u) % spacing;
  const stationX = A + (P ? 10 : 20) * u;
  for (let x = A - cw / 2 + off; x < A + cw / 2 - 20 * u; x += spacing) {
    const done = x > stationX;
    rr(g, x - 18 * u, cy - 34 * u, 36 * u, 34 * u, 3 * u, done ? '#ffb703' : '#c8b6a6');
    if (done) {
      g.fillStyle = '#e63946';
      g.fillRect(x - 18 * u, cy - 22 * u, 36 * u, 7 * u);
    }
  }
  // worker hammering (or a robot arm in modern eras)
  const hit = Math.pow(Math.max(0, Math.sin(t * 7)), 4);
  if (e >= 4) {
    const bx = stationX;
    const by = cy - 150 * u;
    rr(g, bx - 22 * u, by - 18 * u, 44 * u, 22 * u, 4 * u, '#4f5a78');
    const ang = 0.4 + hit * 0.5;
    const ex = bx + Math.sin(ang) * 55 * u;
    const ey = by + Math.cos(ang) * 55 * u;
    ln(g, bx, by, ex, ey, e >= 5 ? '#c6f7ff' : '#ff9f1c', 12 * u);
    ln(g, ex, ey, bx, cy - 40 * u, e >= 5 ? '#c6f7ff' : '#ff9f1c', 10 * u);
    circ(g, ex, ey, 9 * u, '#2b2d42');
    circ(g, bx, by, 9 * u, '#2b2d42');
    if (e >= 5) glow(g, bx, cy - 40 * u, 50 * u, 'rgba(120,240,255,0.8)', 0.5 + hit * 0.5);
  } else {
    const w = fig(g, stationX - 46 * u, FY, FH, '#2b2d42', { dir: 1, armF: 2.6 - hit * 1.6, armB: 0.8, hat: 'cap', hatCol: '#3d405b', accent: '#e63946' });
    ln(g, w.fx, w.fy, w.fx + 20 * u, w.fy - 22 * u, '#7a4a2a', 4 * u);
    rr(g, w.fx + 12 * u, w.fy - 32 * u, 22 * u, 12 * u, 2 * u, '#8d99ae');
  }
  if (hit > 0.9) {
    const sp = particles(f.mem, 'sp');
    if (sp.length < 60) for (let i = 0; i < 4; i++) spawn(sp, stationX, cy - 36 * u, f.rand.range(-160, 160) * u, f.rand.range(-220, -60) * u, 0.45, 3 * u, '#ffe066');
  }
  const sp = particles(f.mem, 'sp');
  stepParticles(sp, f.dt, 600 * u);
  drawDots(g, sp, 1, true);
});

const farm = mk(3.4, (f) => {
  const { g, L, t, era } = f;
  const { u, FY, A, B, FH, P } = box(L);
  const e = EI[era];
  sky(g, L, ['#5ec8ff', '#bff0ff', '#fff3c4']);
  glow(g, L.w * 0.82, FY * 0.18, 160 * u, 'rgba(255,230,120,0.9)');
  circ(g, L.w * 0.82, FY * 0.18, 40 * u, '#ffd166');
  // rolling hills
  g.fillStyle = '#7bc96f';
  g.beginPath();
  g.moveTo(0, FY);
  for (let x = 0; x <= L.w; x += 40) g.lineTo(x, FY - 90 * u - Math.sin(x * 0.006 + 1) * 40 * u);
  g.lineTo(L.w, FY);
  g.fill();
  g.fillStyle = '#5aa84e';
  g.fillRect(0, FY - 20 * u, L.w, L.h);
  // ploughed rows with sprouts growing
  g.fillStyle = '#8a5a32';
  g.fillRect(0, FY, L.w, L.h - FY);
  for (let r = 0; r < 4; r++) {
    const y = FY + 14 * u + r * 22 * u;
    g.fillStyle = '#6b4325';
    g.fillRect(0, y, L.w, 6 * u);
    for (let x = (r % 2) * 20 * u; x < L.w; x += 40 * u) {
      const grow = span(t, 0.2 + ((x / L.w) * 1.2 + r * 0.1), 1.2 + (x / L.w) * 1.2 + r * 0.1);
      if (grow <= 0) continue;
      ln(g, x, y, x, y - 14 * u * grow, '#2d8a3a', 3 * u);
      ell(g, x - 5 * u * grow, y - 12 * u * grow, 6 * u * grow, 3 * u * grow, '#43b047', -0.5);
      ell(g, x + 5 * u * grow, y - 14 * u * grow, 6 * u * grow, 3 * u * grow, '#43b047', 0.5);
    }
  }
  // red barn on the right
  const bw = (P ? 130 : 170) * u;
  const bh = 120 * u;
  const bx = B;
  g.fillStyle = '#d62828';
  g.fillRect(bx - bw / 2, FY - 20 * u - bh, bw, bh);
  poly(g, '#9d0208', [bx - bw / 2 - 12 * u, FY - 20 * u - bh, bx, FY - 20 * u - bh - 70 * u, bx + bw / 2 + 12 * u, FY - 20 * u - bh]);
  g.fillStyle = '#fefae0';
  g.fillRect(bx - 30 * u, FY - 20 * u - 70 * u, 60 * u, 70 * u);
  g.strokeStyle = '#d62828';
  g.lineWidth = 5 * u;
  g.beginPath();
  g.moveTo(bx - 30 * u, FY - 90 * u);
  g.lineTo(bx + 30 * u, FY - 20 * u);
  g.moveTo(bx + 30 * u, FY - 90 * u);
  g.lineTo(bx - 30 * u, FY - 20 * u);
  g.stroke();
  rr(g, bx - 14 * u, FY - 20 * u - bh - 40 * u, 28 * u, 22 * u, 3 * u, '#fefae0');
  // tractor (or ox and plough) crossing the left
  const ps = particles(f.mem);
  const span2 = (P ? 120 : 200) * u;
  const x = A - span2 / 2 + span(t, 0, 3.4) * span2;
  if (e <= 2) {
    // farmer behind the plough
    horse(g, x + 30 * u, FY - 4 * u, 150 * u, '#8a5a32', t, 1, 5, { ox: true });
    ln(g, x - 40 * u, FY - 60 * u, x + 10 * u, FY - 70 * u, '#5a3418', 4 * u);
    poly(g, '#8d99ae', [x - 52 * u, FY - 6 * u, x - 30 * u, FY - 6 * u, x - 44 * u, FY - 30 * u]);
    ln(g, x - 44 * u, FY - 30 * u, x - 60 * u, FY - 70 * u, '#5a3418', 4 * u);
    fig(g, x - 82 * u, FY - 4 * u, FH * 0.85, '#3d2b1f', { dir: 1, armF: 1.3, walk: t, hat: 'hood', hatCol: '#5c4033' });
  } else {
    const len = 130 * u;
    const ty = FY - 4 * u + Math.abs(Math.sin(t * 9)) * 2 * u;
    if (e >= 5) glow(g, x, FY - 10 * u, 80 * u, 'rgba(90,220,255,0.6)');
    // body
    rr(g, x - len * 0.45, ty - len * 0.42, len * 0.6, len * 0.22, 6 * u, e >= 5 ? '#4cc9f0' : '#e63946');
    rr(g, x - len * 0.38, ty - len * 0.8, len * 0.36, len * 0.4, 6 * u, e >= 5 ? '#4cc9f0' : '#e63946');
    rr(g, x - len * 0.33, ty - len * 0.74, len * 0.26, len * 0.18, 4 * u, '#bfe8ff');
    g.fillStyle = '#2b2d42';
    g.fillRect(x + len * 0.06, ty - len * 0.62, 7 * u, len * 0.22);
    // wheels
    const wheel = (wx: number, r: number) => {
      circ(g, wx, ty - r, r, '#1d1d24');
      circ(g, wx, ty - r, r * 0.5, '#ffd166');
      ln(g, wx, ty - r, wx + Math.cos(t * 6) * r * 0.5, ty - r + Math.sin(t * 6) * r * 0.5, '#1d1d24', 3 * u);
    };
    wheel(x - len * 0.32, len * 0.24);
    wheel(x + len * 0.12, len * 0.15);
    fig(g, x - len * 0.2, ty - len * 0.42, FH * 0.45, '#1d2233', { dir: 1, armF: 1.3, hat: 'cap', hatCol: '#ffd166' });
    emit(f, 'puff', e >= 5 ? 0 : 5, () => spawn(ps, x + len * 0.09, ty - len * 0.62, f.rand.range(-30, -10) * u, -50 * u, 1.4, 8 * u, '#e9e3d8'), 30, ps);
  }
  emit(f, 'dust', 8, () => spawn(ps, x - 50 * u, FY - 6 * u, f.rand.range(-50, -20) * u, f.rand.range(-30, -5) * u, 0.9, f.rand.range(4, 8) * u, '#c49a6c'), 60, ps);
  stepParticles(ps, f.dt);
  drawDots(g, ps, 0.8);
});

const construction = mk(3.4, (f) => {
  const { g, L, t, era } = f;
  const { u, FY, A, B, FH, P } = box(L);
  const e = EI[era];
  sky(g, L, ['#4aa3df', '#9fd8ff', '#ffe5b4']);
  g.fillStyle = '#c8a26a';
  g.fillRect(0, FY, L.w, L.h - FY);
  const beam = e >= 3 ? '#ff7f11' : '#a0672f';
  // building frame rising on the left
  const fw = (P ? 150 : 210) * u;
  const floors = 5;
  const fh = 56 * u;
  const built = span(t, 0.1, 2.6) * floors;
  for (let i = 0; i < floors; i++) {
    const k = clamp(built - i);
    if (k <= 0) break;
    const y0 = FY - i * fh;
    const y1 = y0 - fh * k;
    for (let c = 0; c <= 3; c++) {
      const x = A - fw / 2 + (c * fw) / 3;
      ln(g, x, y0, x, y1, beam, 8 * u);
    }
    if (k >= 1) {
      ln(g, A - fw / 2, y0 - fh, A + fw / 2, y0 - fh, beam, 9 * u);
      ln(g, A - fw / 2, y0, A - fw / 2 + fw / 3, y0 - fh, beam, 3 * u);
      ln(g, A + fw / 2, y0, A + fw / 2 - fw / 3, y0 - fh, beam, 3 * u);
      if (e < 3 && i % 2 === 0) {
        g.fillStyle = 'rgba(210,180,140,0.9)';
        g.fillRect(A - fw / 2 + 4 * u, y0 - fh + 4 * u, fw / 3 - 8 * u, fh - 8 * u);
      }
    }
  }
  // worker on top with a hard hat, welding sparks
  const topY = FY - Math.floor(clamp(built, 0, floors - 0.001)) * fh;
  const wp = fig(g, A + fw * 0.15, topY, FH * 0.7, '#2b2d42', { dir: -1, armF: 1.4 + Math.sin(t * 15) * 0.1, hat: 'hard', hatCol: '#ffd60a', accent: '#ff7f11' });
  const ps = particles(f.mem);
  if (e >= 3) {
    glow(g, wp.fx - 6 * u, wp.fy, 40 * u, 'rgba(160,220,255,0.9)', 0.6 + 0.4 * Math.sin(t * 40));
    emit(f, 'w', 50, () => spawn(ps, wp.fx - 6 * u, wp.fy, f.rand.range(-160, 160) * u, f.rand.range(-200, 0) * u, 0.5, 2.5 * u, f.rand.pick(['#ffe066', '#ffffff', '#ffb703'])), 120, ps);
  }
  stepParticles(ps, f.dt, 600 * u);
  drawDots(g, ps);
  // crane on the right
  const mastX = B + (P ? 30 : 40) * u;
  const mh = 400 * u;
  const lat = (x0: number, y0: number, x1: number, y1: number, w: number) => {
    ln(g, x0 - w, y0, x1 - w, y1, '#ffd60a', 4 * u);
    ln(g, x0 + w, y0, x1 + w, y1, '#ffd60a', 4 * u);
    const n = 10;
    for (let i = 0; i < n; i++) {
      const k0 = i / n;
      const k1 = (i + 1) / n;
      ln(g, lerp(x0, x1, k0) - w, lerp(y0, y1, k0), lerp(x0, x1, k1) + w, lerp(y0, y1, k1), '#ffd60a', 2 * u);
    }
  };
  if (e >= 3) lat(mastX, FY, mastX, FY - mh, 10 * u);
  else ln(g, mastX, FY, mastX, FY - mh, '#7a4a28', 12 * u);
  const jibL = (P ? 180 : 260) * u;
  const swing = Math.sin(t * 0.9) * 0.05;
  g.save();
  g.translate(mastX, FY - mh);
  g.rotate(swing);
  ln(g, 40 * u, 0, -jibL, 0, e >= 3 ? '#ffd60a' : '#7a4a28', 10 * u);
  rr(g, 20 * u, -6 * u, 40 * u, 26 * u, 3 * u, '#3d405b');
  ln(g, 0, -40 * u, -jibL, 0, '#3d405b', 2 * u);
  ln(g, 0, -40 * u, 40 * u, 0, '#3d405b', 2 * u);
  ln(g, 0, 0, 0, -40 * u, e >= 3 ? '#ffd60a' : '#7a4a28', 6 * u);
  // trolley + load (beam or stone block)
  const tx = -jibL * lerp(0.35, 0.85, (Math.sin(t * 1.3) + 1) / 2);
  const drop = 120 * u + Math.sin(t * 2) * 30 * u;
  rr(g, tx - 10 * u, -2 * u, 20 * u, 10 * u, 2 * u, '#3d405b');
  ln(g, tx, 8 * u, tx, drop, '#1d1d24', 2 * u);
  g.save();
  g.translate(tx, drop);
  g.rotate(Math.sin(t * 2.4) * 0.12);
  if (e >= 3) rr(g, -50 * u, 0, 100 * u, 12 * u, 2 * u, beam);
  else rr(g, -26 * u, 0, 52 * u, 34 * u, 3 * u, '#b8a88a');
  g.restore();
  g.restore();
  // safety cones
  for (let i = 0; i < 3; i++) {
    const cx = B - 70 * u + i * 40 * u;
    poly(g, '#ff7f11', [cx - 10 * u, FY, cx + 10 * u, FY, cx, FY - 28 * u]);
    g.fillStyle = '#ffffff';
    g.fillRect(cx - 5 * u, FY - 14 * u, 10 * u, 4 * u);
  }
});

const surgery = mk(3.6, (f) => {
  const { g, L, t, era } = f;
  const { u, FY, A, B, FH, P } = box(L);
  const e = EI[era];
  room(g, L, FY, '#0f4c5c', '#1a7a8c', '#0b3640');
  // big operating lamps
  const lampY = FY - 360 * u;
  for (const lx of [A - 50 * u, A + 50 * u]) {
    ln(g, lx, 0, lx, lampY - 20 * u, '#c8d6e5', 4 * u);
    withA(g, 0.3, () => poly(g, '#fffbe0', [lx - 30 * u, lampY, lx + 30 * u, lampY, lx + 110 * u, FY - 70 * u, lx - 110 * u, FY - 70 * u]));
    glow(g, lx, lampY, 90 * u, 'rgba(255,255,230,0.9)');
    ell(g, lx, lampY - 8 * u, 40 * u, 18 * u, '#dfe6ee');
    ell(g, lx, lampY, 28 * u, 8 * u, '#fffbe0');
  }
  // table with patient under a blue sheet
  const tw = (P ? 170 : 230) * u;
  const ty = FY - 86 * u;
  ln(g, A, ty, A, FY, '#8395a7', 10 * u);
  rr(g, A - tw / 2, ty - 6 * u, tw, 10 * u, 4 * u, '#c8d6e5');
  circ(g, A - tw / 2 + 22 * u, ty - 18 * u, 15 * u, '#f1c27d');
  ell(g, A + 10 * u, ty - 14 * u, tw * 0.4, 18 * u * (1 + Math.sin(t * 2.4) * 0.05), '#48cae4');
  // masked surgeons on both sides of the table
  const s1 = fig(g, A - tw * 0.2, FY, FH, '#2a9d8f', { dir: 1, armF: 1.6 + Math.sin(t * 4) * 0.1, armB: 1.3, hat: 'surg', hatCol: '#2a9d8f', lean: 0.2 });
  fig(g, A + tw * 0.32, FY, FH, '#2a9d8f', { dir: -1, armF: 1.7 + Math.cos(t * 3) * 0.15, armB: 1.2, hat: 'surg', hatCol: '#2a9d8f', lean: 0.2 });
  // a gleaming tool
  ln(g, s1.fx, s1.fy, s1.fx + 16 * u, s1.fy + 6 * u, '#e9edf5', 3 * u);
  sparkle(g, s1.fx + 16 * u, s1.fy + 6 * u, (6 + 4 * Math.sin(t * 9)) * u, '#ffffff');
  // heart monitor on the right
  const mw = (P ? 150 : 210) * u;
  const mh = 120 * u;
  const mx = B - mw / 2;
  const my = FY - 300 * u;
  ln(g, B, my + mh, B, FY, '#8395a7', 6 * u);
  rr(g, mx - 8 * u, my - 8 * u, mw + 16 * u, mh + 16 * u, 10 * u, '#22303c');
  rr(g, mx, my, mw, mh, 6 * u, e >= 5 ? '#04131f' : '#03140a');
  glow(g, B, my + mh / 2, mw * 0.8, 'rgba(70,255,150,0.25)');
  const ey = my + mh * 0.55;
  const amp = mh * 0.32;
  const period = mw * 0.5;
  g.save();
  g.beginPath();
  g.rect(mx, my, mw, mh);
  g.clip();
  g.strokeStyle = '#46ff96';
  g.lineWidth = 3 * u;
  g.lineJoin = 'round';
  g.beginPath();
  const shift = (t * mw * 0.6) % period;
  for (let x = 0; x <= mw; x += 3) {
    const ph = ((x + shift) % period) / period;
    let y = 0;
    if (ph > 0.4 && ph < 0.45) y = -((ph - 0.4) / 0.05) * amp;
    else if (ph >= 0.45 && ph < 0.5) y = -amp + ((ph - 0.45) / 0.05) * amp * 1.4;
    else if (ph >= 0.5 && ph < 0.55) y = amp * 0.4 - ((ph - 0.5) / 0.05) * amp * 0.4;
    else if (ph > 0.65 && ph < 0.8) y = -Math.sin(((ph - 0.65) / 0.15) * Math.PI) * amp * 0.2;
    g.lineTo(mx + x, ey + y);
  }
  g.stroke();
  g.restore();
  const beat = Math.pow(Math.max(0, Math.sin(t * 7.5)), 8);
  heart(g, mx + mw - 22 * u, my + 20 * u, (10 + 4 * beat) * u, '#ff3d5a');
  text(g, String(72 + Math.floor(Math.sin(t) * 3)), mx + 30 * u, my + 20 * u, 18 * u, '#46ff96', false);
  // success: a big heart and sparkles at the end
  const ok = span(t, 2.3, 2.7);
  if (ok > 0) {
    const hx = B;
    const hy = my - 50 * u;
    glow(g, hx, hy, 90 * u * ok, 'rgba(255,90,120,0.7)');
    heart(g, hx, hy, (24 + 6 * beat) * u * ok, '#ff3d5a');
    for (let i = 0; i < 4; i++) sparkle(g, hx + Math.cos(i * 1.6 + t * 2) * 50 * u, hy + Math.sin(i * 1.6 + t * 2) * 30 * u, 7 * u * ok, '#ffffff');
  }
});

const stage = mk(3.6, (f) => {
  const { g, L, t } = f;
  const { u, FY, A, B, FH, P } = box(L);
  room(g, L, FY, '#12051f', '#2a0a3a', '#3a1d0c', 'rgba(255,200,120,0.3)');
  // curtains
  const cw = P ? L.w * 0.12 : L.w * 0.09;
  for (const side of [0, 1]) {
    const x0 = side ? L.w - cw : 0;
    g.fillStyle = '#9d0208';
    g.fillRect(x0, 0, cw, FY);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = 0; i < 4; i++) g.fillRect(x0 + (i * cw) / 4 + cw * 0.12, 0, cw * 0.06, FY);
  }
  g.fillStyle = '#9d0208';
  g.beginPath();
  g.moveTo(0, 0);
  for (let x = 0; x <= L.w; x += 60 * u) g.quadraticCurveTo(x + 30 * u, 70 * u, x + 60 * u, 0);
  g.fill();
  // spotlight cone and performer
  const px = A;
  withA(g, 0.35, () => poly(g, '#fff3c4', [px - 20 * u, 0, px + 20 * u, 0, px + 120 * u, FY, px - 120 * u, FY]));
  glow(g, px, FY, 160 * u, 'rgba(255,230,150,0.7)');
  ell(g, px, FY + 4 * u, 120 * u, 18 * u, 'rgba(255,240,200,0.6)');
  const bow = span(t, 0.9, 1.4) * (1 - span(t, 2.2, 2.7));
  const arm = lerp(Math.PI - 0.4, 0.6, span(t, 0.7, 1.2));
  fig(g, px, FY, FH, '#1a1423', { dir: 1, armF: arm, armB: lerp(Math.PI - 0.4, 0.3, span(t, 0.7, 1.2)), lean: bow * 1.1, dress: '#ff006e', hat: 'none' });
  // second spot on the right: a bouquet and "BRAVO"
  if (!P) {
    withA(g, 0.25, () => poly(g, '#c8b6ff', [B - 20 * u, 0, B + 20 * u, 0, B + 100 * u, FY, B - 100 * u, FY]));
    glow(g, B, FY - 160 * u, 140 * u, 'rgba(200,180,255,0.5)');
  }
  const bk = span(t, 1.2, 1.8);
  if (bk > 0) text(g, 'BRAVO!', P ? L.w * 0.5 : B, (P ? 110 : FY - 230) * u + (P ? 0 : 0), 44 * u * (0.6 + 0.4 * easeOut(bk)), '#ffd166', true);
  // roses thrown onto the stage
  const ps = particles(f.mem);
  if (t > 1.2) emit(f, 'r', 7, () => spawn(ps, f.rand.range(0, L.w), FY + 40 * u, f.rand.range(-60, 60) * u, f.rand.range(-420, -300) * u, 2, 7 * u, f.rand.pick(['#ff006e', '#ff5d73', '#ffd166']), 0, 0, f.rand.range(-6, 6)), 40, ps);
  stepParticles(ps, f.dt, 300 * u);
  drawPs(g, ps, (p) => {
    g.save();
    g.translate(p.x, p.y);
    g.rotate(p.rot ?? 0);
    ln(g, 0, 0, 0, 16 * u, '#2d8a3a', 2 * u);
    circ(g, 0, 0, p.size, p.color);
    g.restore();
  });
  // audience heads with clapping hands
  const n = Math.ceil(L.w / (46 * u));
  for (let i = 0; i < n; i++) {
    const x = i * 46 * u + 20 * u;
    if (!P && x > L.phone.x && x < L.phone.x + L.phone.w) continue;
    const hy = FY + 50 * u + (i % 2) * 14 * u;
    circ(g, x, hy, 18 * u, '#0b0612');
    g.fillStyle = '#0b0612';
    g.fillRect(x - 24 * u, hy + 12 * u, 48 * u, 60 * u);
    const cl = Math.abs(Math.sin(t * 12 + i * 1.3));
    if (t > 1.0 && i % 2 === 0) {
      circ(g, x - 6 * u - cl * 6 * u, hy - 28 * u, 6 * u, '#0b0612');
      circ(g, x + 6 * u + cl * 6 * u, hy - 28 * u, 6 * u, '#0b0612');
    }
  }
});

const newsroom = mk(3.4, (f) => {
  const { g, L, t, era } = f;
  const { u, FY, A, B, FH, P } = box(L);
  const e = EI[era];
  if (e <= 1) {
    // town crier in the market square
    sky(g, L, ['#7fc8ff', '#ffe0a8']);
    skyline(g, L, FY, era, '#8a6a4a', 5);
    g.fillStyle = '#b89a6a';
    g.fillRect(0, FY, L.w, L.h - FY);
    const cr = fig(g, A, FY, FH, '#5a189a', { dir: 1, armF: 2.4 + Math.sin(t * 14) * 0.25, armB: 1.4, hat: 'top', hatCol: '#3c096c', accent: '#ffd166' });
    // bell in the raised hand
    g.save();
    g.translate(cr.fx, cr.fy);
    g.rotate(Math.sin(t * 14) * 0.5);
    poly(g, '#ffb703', [-10 * u, 8 * u, 10 * u, 8 * u, 6 * u, -10 * u, -6 * u, -10 * u]);
    circ(g, 0, 10 * u, 4 * u, '#9c6644');
    g.restore();
    for (let i = 0; i < 3; i++) {
      const k = (t * 2 + i / 3) % 1;
      g.strokeStyle = `rgba(255,214,102,${(1 - k) * 0.9})`;
      g.lineWidth = 3 * u;
      g.beginPath();
      g.arc(cr.fx, cr.fy, 14 * u + k * 50 * u, -2.2, -0.9);
      g.stroke();
    }
    // scroll in the other hand
    rr(g, cr.bx - 4 * u, cr.by - 2 * u, 26 * u, 40 * u, 3 * u, '#f1e2b8');
    // speech bubble
    const k = span(t, 0.5, 0.9);
    const bx = P ? L.w * 0.62 : A + 120 * u;
    const by = FY - FH * 1.35;
    if (k > 0) {
      g.save();
      g.translate(bx, by);
      g.scale(k, k);
      rr(g, -80 * u, -34 * u, 160 * u, 68 * u, 20 * u, '#ffffff');
      poly(g, '#ffffff', [-40 * u, 30 * u, -70 * u, 60 * u, -15 * u, 30 * u]);
      text(g, 'HEAR YE!', 0, 0, 28 * u, '#9d0208', false);
      g.restore();
    }
    // crowd turning to listen
    const n = P ? 3 : 4;
    for (let i = 0; i < n; i++) {
      const x = B + (i - (n - 1) / 2) * (P ? 42 : 60) * u;
      fig(g, x, FY, FH * (0.75 + (i % 2) * 0.1), ['#6b4226', '#3a5a40', '#8d5b4c', '#4a4e69'][i], { dir: -1, armF: i === 1 ? 2.4 : 0.3, hat: i === 2 ? 'hood' : 'none', dress: i % 2 ? '#bc6c25' : undefined, walk: undefined });
    }
    return;
  }
  if (e <= 3) {
    // printing press era: spinning newspaper headline
    room(g, L, FY, '#3a2a1a', '#6b4b30', '#2a1c10');
    const k = span(t, 0.1, 1.2);
    const rot = (1 - k) * TAU * 2;
    const sc = lerp(0.1, 1, k);
    const w = (P ? 260 : 300) * u;
    const h = w * 0.7;
    const cx = P ? L.w * 0.5 : A;
    const cy = FY - 210 * u;
    glow(g, cx, cy, w, 'rgba(255,240,200,0.45)');
    g.save();
    g.translate(cx, cy);
    g.rotate(rot);
    g.scale(sc, sc);
    rr(g, -w / 2, -h / 2, w, h, 4 * u, '#f4efe1');
    text(g, 'EXTRA!', 0, -h * 0.3, h * 0.22, '#1d1d24', false);
    g.fillStyle = '#1d1d24';
    g.fillRect(-w * 0.44, -h * 0.13, w * 0.88, 3 * u);
    g.fillStyle = '#9a9488';
    g.fillRect(-w * 0.42, -h * 0.05, w * 0.36, h * 0.4);
    for (let i = 0; i < 6; i++) g.fillRect(w * 0.02, -h * 0.05 + i * h * 0.07, w * 0.38, h * 0.03);
    g.restore();
    if (!P) {
      const pb = fig(g, B, FY, FH, '#2b2d42', { dir: -1, armF: 2.5 + Math.sin(t * 10) * 0.15, hat: 'cap', hatCol: '#3d405b', accent: '#e63946' });
      paper(g, pb.fx, pb.fy - 16 * u, 34 * u, 44 * u, 0.2, '#f4efe1', '#555', 4);
      text(g, 'EXTRA!', B, FY - FH * 1.35, 30 * u, '#ffd166');
    }
    return;
  }
  // modern / future TV studio
  room(g, L, FY, '#071a3a', '#0d3b7a', '#06142b');
  const ww = (P ? 180 : 260) * u;
  const wh = 150 * u;
  const wx = B - ww / 2;
  const wy = FY - 330 * u;
  glow(g, B, wy + wh / 2, ww, 'rgba(60,140,255,0.5)');
  rr(g, wx, wy, ww, wh, 6 * u, e >= 5 ? 'rgba(80,220,255,0.35)' : '#1b4f9c');
  // globe on the wall screen
  circ(g, B, wy + wh / 2, wh * 0.35, '#2a7ad6');
  g.strokeStyle = 'rgba(255,255,255,0.5)';
  g.lineWidth = 2 * u;
  for (let i = -1; i <= 1; i++) {
    g.beginPath();
    g.ellipse(B, wy + wh / 2, Math.abs(Math.cos(t + i)) * wh * 0.35 + 1, wh * 0.35, 0, 0, TAU);
    g.stroke();
  }
  // anchor behind the desk
  const ax = A;
  fig(g, ax, FY, FH, e >= 5 ? '#6ef3ff' : '#1d2233', { dir: 1, armF: 1.3 + Math.sin(t * 5) * 0.15, armB: 0.9, accent: '#e63946', nod: Math.max(0, Math.sin(t * 4)) * 0.4 });
  const dw = (P ? 180 : 230) * u;
  poly(g, '#c1121f', [ax - dw / 2, FY - 80 * u, ax + dw / 2, FY - 80 * u, ax + dw / 2 - 16 * u, FY, ax - dw / 2 + 16 * u, FY]);
  g.fillStyle = '#ffffff';
  g.fillRect(ax - dw / 2, FY - 80 * u, dw, 6 * u);
  text(g, 'NEWS', ax, FY - 42 * u, 24 * u, '#ffffff', false);
  // camera with red tally light
  if (!P) {
    const cx = B - ww / 2 - 30 * u;
    ln(g, cx, FY, cx - 20 * u, FY - 90 * u, '#2b2d42', 4 * u);
    ln(g, cx, FY, cx + 20 * u, FY - 90 * u, '#2b2d42', 4 * u);
    rr(g, cx - 35 * u, FY - 130 * u, 70 * u, 44 * u, 6 * u, '#2b2d42');
    rr(g, cx - 55 * u, FY - 120 * u, 22 * u, 24 * u, 4 * u, '#14151b');
    const on = Math.floor(t * 2) % 2 === 0;
    circ(g, cx + 22 * u, FY - 122 * u, 5 * u, on ? '#ff2b3b' : '#5a1218');
    if (on) glow(g, cx + 22 * u, FY - 122 * u, 22 * u, 'rgba(255,40,60,0.8)');
  }
  // BREAKING banner across the top
  const by = (P ? 0.1 : 0.12) * L.h;
  const bk = span(t, 0.2, 0.6);
  g.fillStyle = '#d00000';
  g.fillRect(0, by, L.w * bk, 46 * u);
  g.fillStyle = '#ffffff';
  g.fillRect(0, by + 46 * u, L.w * bk, 22 * u);
  if (bk > 0.9) {
    const flash = Math.floor(t * 4) % 2 ? '#ffffff' : '#ffd166';
    const tx = P ? L.w * 0.5 : L.slots[0];
    text(g, 'BREAKING NEWS', tx, by + 23 * u, 28 * u, flash, false);
    if (!P) text(g, 'BREAKING NEWS', L.slots[1], by + 23 * u, 28 * u, flash, false);
    g.save();
    g.beginPath();
    g.rect(0, by + 46 * u, L.w, 22 * u);
    g.clip();
    const tick = '  MARKETS SURGE  •  LOCAL HERO NAMED  •  STORM INCOMING  •  ';
    g.font = `700 ${14 * u}px system-ui, sans-serif`;
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillStyle = '#1d1d24';
    const tw2 = g.measureText(tick).width;
    for (let x = -((t * 120 * u) % tw2); x < L.w; x += tw2) g.fillText(tick, x, by + 57 * u);
    g.restore();
  }
});

// ================================================================== BUSINESS, CRIME, PETS & MONEY

const startup = mk(3.6, (f) => {
  const { g, L, t, era } = f;
  const { u, FY, A, B, FH, P } = box(L);
  const e = EI[era];
  room(g, L, FY, '#2b2d42', '#4a4e69', '#3d3d48');
  // garage door rolled up, string lights
  g.fillStyle = '#8d99ae';
  g.fillRect(0, 0, L.w, 40 * u);
  for (let i = 0; i < 6; i++) {
    g.fillStyle = i % 2 ? '#7a8599' : '#8d99ae';
    g.fillRect(0, i * 7 * u, L.w, 7 * u);
  }
  for (let x = 20 * u; x < L.w; x += 50 * u) {
    const on = (Math.floor(t * 3) + Math.round(x / (50 * u))) % 3 !== 0;
    const col = CONFETTI_COLORS[Math.round(x / (50 * u)) % CONFETTI_COLORS.length];
    const y = 60 * u + Math.sin(x * 0.02) * 10 * u;
    circ(g, x, y, 5 * u, on ? col : '#555');
    if (on) glow(g, x, y, 20 * u, col, 0.6);
  }
  // workbench with laptop (lantern + blueprint in old eras)
  const ty = desk(g, A, FY, (P ? 190 : 240) * u, u, '#c58a4a', '#8a5a32');
  const lx = A - 30 * u;
  if (e >= 4) {
    glow(g, lx, ty - 30 * u, 90 * u, e >= 5 ? 'rgba(90,240,255,0.6)' : 'rgba(120,200,255,0.6)');
    g.save();
    g.translate(lx, ty);
    poly(g, '#c8d0e0', [-40 * u, 0, 40 * u, 0, 46 * u, 4 * u, -46 * u, 4 * u]);
    poly(g, '#3a3f50', [-36 * u, 0, 36 * u, 0, 40 * u, -56 * u, -32 * u, -56 * u]);
    poly(g, '#1a6cff', [-31 * u, -4 * u, 31 * u, -4 * u, 35 * u, -51 * u, -28 * u, -51 * u]);
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 4; i++) g.fillRect(-22 * u, -44 * u + i * 9 * u, (14 + ((i * 17 + Math.floor(t * 3)) % 26)) * u, 3 * u);
    g.restore();
  } else {
    paper(g, lx, ty - 4 * u, 90 * u, 10 * u, 0, '#3a86ff', '#ffffff', 2);
    glow(g, lx + 50 * u, ty - 26 * u, 60 * u, 'rgba(255,190,80,0.8)');
    rr(g, lx + 42 * u, ty - 36 * u, 16 * u, 36 * u, 4 * u, '#ffd166');
  }
  fig(g, A + (P ? 40 : 55) * u, FY, FH, '#1d2233', { dir: -1, armF: 1.3 + Math.sin(t * 20) * 0.1, armB: 1.1, hat: 'cap', hatCol: '#ff006e' });
  // money plant growing on the bench
  const px = A + (P ? 70 : 95) * u;
  rr(g, px - 14 * u, ty - 26 * u, 28 * u, 26 * u, 4 * u, '#e76f51');
  const grow = span(t, 0.3, 2.6);
  const sh = 90 * u * grow;
  ln(g, px, ty - 26 * u, px + Math.sin(t * 2) * 4 * u, ty - 26 * u - sh, '#2d8a3a', 4 * u);
  for (let i = 0; i < 5; i++) {
    const k = clamp(grow * 5 - i);
    if (k <= 0) break;
    const ly = ty - 26 * u - (i + 1) * 17 * u * grow;
    bill(g, px + (i % 2 ? 14 : -14) * u, ly, 10 * u * k, (i % 2 ? 0.5 : -0.5) + Math.sin(t * 3 + i) * 0.1);
  }
  // whiteboard with a rocket doodle that launches
  const bw = (P ? 160 : 230) * u;
  const bh = 160 * u;
  const by = FY - 340 * u;
  rr(g, B - bw / 2 - 6 * u, by - 6 * u, bw + 12 * u, bh + 12 * u, 5 * u, '#cfd6e6');
  rr(g, B - bw / 2, by, bw, bh, 3 * u, '#ffffff');
  // chart doodle
  g.strokeStyle = '#1a6cff';
  g.lineWidth = 3 * u;
  g.beginPath();
  g.moveTo(B - bw * 0.42, by + bh * 0.85);
  g.lineTo(B - bw * 0.2, by + bh * 0.75);
  g.lineTo(B - bw * 0.05, by + bh * 0.8);
  g.lineTo(B + bw * 0.1, by + bh * 0.5);
  g.stroke();
  const lk = span(t, 1.0, 2.6);
  const rx = B + bw * 0.25 + lk * 40 * u;
  const ry = by + bh * 0.62 - lk * (bh * 0.62 + 160 * u);
  const ps = particles(f.mem);
  if (lk > 0) emit(f, 'fl', 40, () => spawn(ps, rx - 10 * u, ry + 30 * u, f.rand.range(-30, 10) * u, f.rand.range(60, 140) * u, 0.5, f.rand.range(3, 7) * u, f.rand.pick(['#ffd166', '#ff9f1c', '#ff5d73'])), 100, ps);
  stepParticles(ps, f.dt);
  drawDots(g, ps);
  g.save();
  g.translate(rx, ry);
  g.rotate(0.25);
  g.strokeStyle = '#e63946';
  g.lineWidth = 3 * u;
  g.fillStyle = lk > 0 ? '#ffffff' : 'rgba(255,255,255,0)';
  g.beginPath();
  g.moveTo(0, -36 * u);
  g.quadraticCurveTo(16 * u, -16 * u, 12 * u, 20 * u);
  g.lineTo(-12 * u, 20 * u);
  g.quadraticCurveTo(-16 * u, -16 * u, 0, -36 * u);
  g.fill();
  g.stroke();
  g.beginPath();
  g.arc(0, -8 * u, 6 * u, 0, TAU);
  g.moveTo(-12 * u, 8 * u);
  g.lineTo(-22 * u, 26 * u);
  g.lineTo(-12 * u, 20 * u);
  g.moveTo(12 * u, 8 * u);
  g.lineTo(22 * u, 26 * u);
  g.lineTo(12 * u, 20 * u);
  g.stroke();
  g.restore();
  if (lk > 0.6) text(g, 'TO THE MOON!', B, by - 30 * u, 22 * u, '#ffd166');
});

const stocks = mk(3.4, (f) => {
  const { g, L, t, era } = f;
  const { u, FY, A, B, FH, P } = box(L);
  const e = EI[era];
  room(g, L, FY, '#050b1a', '#0b1f3a', '#08101e');
  const old = e <= 3;
  const screen = (cx: number, seed: number, up: boolean) => {
    const w = (P ? 165 : 240) * u;
    const h = 150 * u;
    const x0 = cx - w / 2;
    const y0 = FY - 400 * u;
    if (!old) glow(g, cx, y0 + h / 2, w * 0.8, up ? 'rgba(40,255,140,0.35)' : 'rgba(255,60,80,0.35)');
    rr(g, x0 - 6 * u, y0 - 6 * u, w + 12 * u, h + 12 * u, 6 * u, old ? '#6b4325' : '#1c2333');
    rr(g, x0, y0, w, h, 3 * u, old ? '#22382c' : '#03070f');
    // grid
    g.strokeStyle = old ? 'rgba(255,255,255,0.08)' : 'rgba(80,140,255,0.15)';
    g.lineWidth = 1;
    g.beginPath();
    for (let i = 1; i < 4; i++) {
      g.moveTo(x0, y0 + (i * h) / 4);
      g.lineTo(x0 + w, y0 + (i * h) / 4);
    }
    g.stroke();
    const col = old ? '#f4f6ee' : up ? '#2bff88' : '#ff3d5a';
    g.strokeStyle = col;
    g.lineWidth = 3 * u;
    g.lineJoin = 'round';
    g.beginPath();
    const n = 26;
    const shown = Math.floor(n * clamp(t / 2.4)) + 1;
    let lastX = x0;
    let lastY = y0 + h / 2;
    for (let i = 0; i < Math.min(n, shown); i++) {
      const k = i / (n - 1);
      const noise = Math.sin(i * 1.7 + seed) * 0.12 + Math.sin(i * 3.3 + seed * 2) * 0.07;
      const trend = up ? k * 0.6 : -k * 0.55;
      const yy = y0 + h * (0.6 - trend - noise);
      lastX = x0 + 8 * u + k * (w - 16 * u);
      lastY = clamp(yy, y0 + 6 * u, y0 + h - 6 * u);
      g.lineTo(lastX, lastY);
    }
    g.stroke();
    circ(g, lastX, lastY, 5 * u, col);
    glow(g, lastX, lastY, 24 * u, col, 0.8);
    text(g, up ? '▲ +12%' : '▼ -8%', cx, y0 - 26 * u, 22 * u, up ? '#2bff88' : '#ff3d5a');
  };
  screen(A, 1, true);
  screen(B, 4, false);
  // ticker tape across the top
  const ty = (P ? 0.08 : 0.1) * L.h;
  g.fillStyle = old ? '#d8ccaa' : '#000000';
  g.fillRect(0, ty, L.w, 30 * u);
  g.save();
  g.beginPath();
  g.rect(0, ty, L.w, 30 * u);
  g.clip();
  g.font = `800 ${16 * u}px ui-monospace, monospace`;
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  const items = ['ACME ▲2.4', 'GLOBO ▼1.1', 'ZAP ▲8.0', 'MEGA ▼3.2', 'NOVA ▲0.7', 'BOLT ▲5.5'];
  let x = -((t * 140 * u) % (L.w * 0.25));
  let i = 0;
  while (x < L.w) {
    const s = items[i % items.length];
    g.fillStyle = old ? '#2a2a2a' : s.includes('▲') ? '#2bff88' : '#ff3d5a';
    g.fillText(s, x, ty + 15 * u);
    x += g.measureText(s).width + 30 * u;
    i++;
  }
  g.restore();
  // traders: one cheering, one tearing hair
  const tA = fig(g, A + (P ? 10 : 70) * u, FY, FH, '#1d2233', { dir: 1, armF: Math.PI - 0.35 + Math.sin(t * 10) * 0.2, armB: Math.PI - 0.5 + Math.cos(t * 10) * 0.2, accent: '#2bff88' });
  fig(g, B - (P ? 10 : 70) * u, FY, FH, '#2a1d33', { dir: -1, armF: 2.7 + Math.sin(t * 14) * 0.1, armB: 2.7 + Math.cos(t * 14) * 0.1, accent: '#ff3d5a', nod: 0.6 });
  // paper slips flying
  const ps = particles(f.mem);
  emit(f, 's', 10, () => spawn(ps, tA.fx, tA.fy, f.rand.range(-120, 120) * u, f.rand.range(-260, -120) * u, 1.6, 12 * u, f.rand.pick(['#ffffff', '#ffd166', '#8ecae6']), 0, 0, f.rand.range(-6, 6)), 80, ps);
  stepParticles(ps, f.dt, 260 * u, 0.5);
  drawConfetti(g, ps);
});

/** Dim back room with a single hanging lamp at x. */
function backRoom(g: G, L: Layout, FY: number, lampX: number, u: number, t: number, warm = 'rgba(255,200,110,0.75)'): void {
  room(g, L, FY, '#151024', '#2e2140', '#0e0b16');
  const ly = FY - 330 * u + Math.sin(t * 1.4) * 4 * u;
  ln(g, lampX, 0, lampX + Math.sin(t * 1.4) * 4 * u, ly, '#2a2433', 2 * u);
  glow(g, lampX, ly + 120 * u, 300 * u, warm, 0.8);
  withA(g, 0.18, () => poly(g, '#ffe0a0', [lampX - 20 * u, ly, lampX + 20 * u, ly, lampX + 170 * u, FY, lampX - 170 * u, FY]));
  poly(g, '#3a5a40', [lampX - 30 * u, ly + 16 * u, lampX + 30 * u, ly + 16 * u, lampX + 12 * u, ly - 8 * u, lampX - 12 * u, ly - 8 * u]);
  circ(g, lampX, ly + 18 * u, 8 * u, '#fff3c4');
}

const bribe = mk(3.4, (f) => {
  const { g, L, t } = f;
  const { u, FY, A, B, FH, P } = box(L);
  backRoom(g, L, FY, A, u, t);
  // table and two shady figures
  const tw = (P ? 170 : 230) * u;
  const gap = tw * 0.62;
  fig(g, A - gap, FY, FH, '#1b1a24', { dir: 1, armF: 1.5, hat: 'fedora', hatCol: '#2b2838', accent: '#c1121f' });
  fig(g, A + gap, FY, FH, '#22283a', { dir: -1, armF: lerp(0.3, 1.45, span(t, 1.2, 1.6)), hat: 'top', hatCol: '#14161f', accent: '#ffd166' });
  const ty = FY - 82 * u;
  rr(g, A - tw / 2, ty, tw, 10 * u, 3 * u, '#5a3418');
  g.fillStyle = '#3d2410';
  g.fillRect(A - tw * 0.4, ty + 10 * u, 10 * u, 72 * u);
  g.fillRect(A + tw * 0.4 - 10 * u, ty + 10 * u, 10 * u, 72 * u);
  // envelope sliding across
  const k = span(t, 0.3, 1.4);
  const ex = lerp(A - tw * 0.38, A + tw * 0.28, k);
  g.save();
  g.translate(ex, ty - 2 * u);
  g.transform(1.3, 0, -0.5, 0.6, 0, 0);
  bill(g, 4 * u, -34 * u, 18 * u, -0.25);
  bill(g, -2 * u, -38 * u, 18 * u, 0.15);
  rr(g, -32 * u, -40 * u, 64 * u, 40 * u, 3 * u, '#e9d8a6');
  poly(g, '#d4bf86', [-32 * u, -40 * u, 32 * u, -40 * u, 0, -18 * u]);
  g.restore();
  glow(g, ex, ty - 10 * u, 50 * u, 'rgba(120,255,140,0.5)', 0.5 + 0.5 * Math.sin(t * 6));
  // close-up handshake on the right
  const hx = B;
  const hy = FY - 200 * u;
  const hk = span(t, 0.5, 0.9);
  if (hk > 0) {
    const shake = Math.sin(t * 20) * 6 * u * (t < 3 ? 1 : 0);
    const s = (P ? 0.7 : 1) * u;
    g.save();
    g.translate(hx, hy + shake);
    g.scale(hk, hk);
    glow(g, 0, 0, 120 * s, 'rgba(120,255,140,0.35)');
    // sleeves
    rr(g, -150 * s, -24 * s, 90 * s, 48 * s, 6 * s, '#2b2838');
    rr(g, 60 * s, -24 * s, 90 * s, 48 * s, 6 * s, '#22283a');
    g.fillStyle = '#ffffff';
    g.fillRect(-66 * s, -24 * s, 10 * s, 48 * s);
    g.fillRect(56 * s, -24 * s, 10 * s, 48 * s);
    // clasped hands
    ell(g, -22 * s, 0, 40 * s, 26 * s, '#e0a96d');
    ell(g, 22 * s, -4 * s, 40 * s, 24 * s, '#c68642');
    for (let i = 0; i < 4; i++) ell(g, -6 * s + i * 12 * s, 18 * s, 7 * s, 10 * s, '#e0a96d');
    ell(g, 30 * s, -26 * s, 16 * s, 8 * s, '#c68642', -0.4);
    g.restore();
    for (let i = 0; i < 3; i++) {
      const kk = (t * 0.9 + i / 3) % 1;
      withA(g, (1 - kk) * hk, () => text(g, '$', hx + (i - 1) * 50 * u, hy - 50 * u - kk * 90 * u, 28 * u, '#7CFF6B'));
    }
  }
  // wink eye mark above the receiver
  if (t > 1.6 && t < 3) text(g, ';)', A + gap, FY - FH * 1.25, 26 * u, '#ffd166');
});

const laundering = mk(3.4, (f) => {
  const { g, L, t } = f;
  const { u, FY, A, B, P } = box(L);
  room(g, L, FY, '#bde0fe', '#a2d2ff', '#e9ecef', 'rgba(0,0,0,0.1)');
  // checker floor
  g.fillStyle = '#ced4da';
  for (let x = 0; x < L.w; x += 40 * u) for (let y = FY; y < L.h; y += 40 * u) if ((Math.round(x / (40 * u)) + Math.round((y - FY) / (40 * u))) % 2) g.fillRect(x, y, 40 * u, 40 * u);
  // big washing machine on the left
  const mw = (P ? 150 : 200) * u;
  const mh = mw * 1.1;
  const shake = Math.sin(t * 40) * 3 * u;
  const mx = A + shake;
  const my = FY - mh;
  rr(g, mx - mw / 2, my, mw, mh, 14 * u, '#f8f9fa');
  rr(g, mx - mw / 2, my, mw, mh * 0.18, 14 * u, '#dee2e6');
  circ(g, mx + mw * 0.3, my + mh * 0.09, 7 * u, '#ff006e');
  circ(g, mx + mw * 0.15, my + mh * 0.09, 7 * u, '#06d6a0');
  rr(g, mx - mw * 0.4, my + mh * 0.06, mw * 0.3, mh * 0.06, 3 * u, '#212529');
  const dr = mw * 0.32;
  const dy = my + mh * 0.58;
  circ(g, mx, dy, dr * 1.15, '#adb5bd');
  circ(g, mx, dy, dr, '#4cc9f0');
  g.save();
  g.beginPath();
  g.arc(mx, dy, dr, 0, TAU);
  g.clip();
  ell(g, mx, dy + dr * 0.5, dr * 1.2, dr * 0.6, '#48cae4');
  for (let i = 0; i < 7; i++) {
    const a = t * 7 + (i / 7) * TAU;
    const rr2 = dr * (0.35 + (i % 3) * 0.18);
    bill(g, mx + Math.cos(a) * rr2, dy + Math.sin(a) * rr2, 13 * u, a + i);
  }
  for (let i = 0; i < 6; i++) circ(g, mx + Math.cos(-t * 4 + i) * dr * 0.7, dy + Math.sin(-t * 4 + i) * dr * 0.7, 6 * u, 'rgba(255,255,255,0.7)');
  g.restore();
  withA(g, 0.35, () => ell(g, mx - dr * 0.35, dy - dr * 0.4, dr * 0.25, dr * 0.12, '#ffffff', -0.6));
  // suds bubbling out
  const ps = particles(f.mem);
  emit(f, 'b', 16, () => spawn(ps, mx + f.rand.range(-mw / 2, mw / 2), my + f.rand.range(0, 10) * u, f.rand.range(-30, 30) * u, f.rand.range(-90, -40) * u, 1.8, f.rand.range(5, 14) * u, '#ffffff'), 80, ps);
  stepParticles(ps, f.dt);
  drawPs(g, ps, (p) => {
    g.strokeStyle = 'rgba(120,170,220,0.9)';
    g.lineWidth = 2 * u;
    g.beginPath();
    g.arc(p.x, p.y, p.size, 0, TAU);
    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.fill();
    g.stroke();
  });
  // clothesline of clean sparkling bills on the right
  const cw = (P ? 160 : 260) * u;
  const cy = FY - 300 * u;
  ln(g, B - cw / 2, FY, B - cw / 2, cy - 10 * u, '#6c757d', 6 * u);
  ln(g, B + cw / 2, FY, B + cw / 2, cy - 10 * u, '#6c757d', 6 * u);
  g.strokeStyle = '#495057';
  g.lineWidth = 2 * u;
  g.beginPath();
  g.moveTo(B - cw / 2, cy);
  g.quadraticCurveTo(B, cy + 30 * u, B + cw / 2, cy);
  g.stroke();
  const n = 5;
  for (let i = 0; i < n; i++) {
    const k = span(t, 0.4 + i * 0.25, 0.8 + i * 0.25);
    if (k <= 0) continue;
    const xx = B - cw / 2 + (cw * (i + 0.7)) / (n + 0.4);
    const kk = (xx - B) / (cw / 2);
    const yy = cy + 30 * u * (1 - kk * kk) * 0.5 + 18 * u;
    const sw = Math.sin(t * 3 + i) * 0.1;
    g.save();
    g.translate(xx, yy - 18 * u);
    g.rotate(sw);
    g.scale(k, k);
    bill(g, 0, 22 * u, 22 * u, Math.PI / 2, '#7bd88f');
    rr(g, -4 * u, -4 * u, 8 * u, 12 * u, 2 * u, '#c58a4a');
    g.restore();
    sparkle(g, xx + 14 * u, yy + 4 * u + Math.sin(t * 5 + i) * 6 * u, (5 + 3 * Math.sin(t * 8 + i)) * u, '#ffffff');
  }
  text(g, 'SQUEAKY CLEAN', B, cy - 50 * u, 22 * u, '#ffffff');
}, () => 1.5);

const carChase = mk(3.2, (f) => {
  const { g, L, t, era } = f;
  const { u, FY, A, B, FH, P } = box(L);
  const e = EI[era];
  const night = e >= 3;
  sky(g, L, night ? ['#060918', '#14193a', '#2a1f4a'] : ['#f4a261', '#e9c46a', '#f4e1b0']);
  skyline(g, L, FY - 30 * u, era, night ? '#0b0d1e' : '#a8754a', 41, night ? 'rgba(255,214,120,0.45)' : undefined);
  // road
  g.fillStyle = night ? '#1a1a22' : '#b88a5a';
  g.fillRect(0, FY - 30 * u, L.w, L.h);
  const speed = 900 * u;
  if (night) {
    g.fillStyle = '#ffd166';
    for (let x = -((t * speed) % (120 * u)); x < L.w; x += 120 * u) g.fillRect(x, FY + 30 * u, 60 * u, 6 * u);
  } else {
    g.fillStyle = '#8a6a44';
    for (let x = -((t * speed) % (90 * u)); x < L.w; x += 90 * u) circ(g, x, FY + 30 * u, 5 * u, '#8a6a44');
  }
  // speed lines
  g.strokeStyle = night ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.6)';
  g.lineWidth = 2 * u;
  g.beginPath();
  for (let i = 0; i < 14; i++) {
    const y = FY - 260 * u + ((i * 37) % 230) * u;
    const len = (60 + ((i * 53) % 120)) * u;
    const x = L.w - ((t * speed * 1.4 + i * 211 * u) % (L.w + len));
    g.moveTo(x, y);
    g.lineTo(x + len, y);
  }
  g.stroke();
  // getaway in front (right), chaser behind (left)
  const bob = (k: number) => Math.sin(t * 9 + k) * 3 * u;
  const ps = particles(f.mem);
  if (e <= 2) {
    const s = (P ? 130 : 170) * u;
    horse(g, B + bob(1), FY, s, '#2b1d14', t, 1, 9, { mane: '#111', rider: '#1b1a24', riderHat: 'hood', riderHatCol: '#2b2838' });
    ell(g, B - s * 0.25, FY - s * 0.9, s * 0.14, s * 0.12, '#c8a66b');
    text(g, '$', B - s * 0.25, FY - s * 0.9, s * 0.14, '#2f7a32', false);
    horse(g, A + bob(2), FY, s, '#f1e2c8', t + 0.3, 1, 9, { mane: '#c8a66b', rider: '#14213d', riderHat: 'top', riderHatCol: '#0b1022' });
    glow(g, A + s * 0.3, FY - s * 1.1, 60 * u, 'rgba(255,190,80,0.8)', 0.8 + 0.2 * Math.sin(t * 20));
    emit(f, 'd', 30, () => spawn(ps, f.rand.pick([A, B]) - s * 0.4, FY - 4 * u, f.rand.range(-300, -150) * u, f.rand.range(-60, -10) * u, 0.7, f.rand.range(5, 10) * u, '#d4a373'), 120, ps);
  } else {
    const len = (P ? 150 : 200) * u;
    const fut = e === 5;
    car(g, B + bob(1), FY, len, 1, '#d00000', t, { old: e === 3, hover: fut, bag: true });
    car(g, A + bob(2), FY, len, 1, '#f2f4f8', t + 0.1, { police: true, old: e === 3, hover: fut });
    emit(f, 'd', 30, () => spawn(ps, f.rand.pick([A, B]) - len * 0.55, FY - 14 * u, f.rand.range(-300, -150) * u, f.rand.range(-40, -10) * u, 0.7, f.rand.range(5, 10) * u, fut ? '#7ff3ff' : '#8d99ae'), 120, ps);
    // siren rings
    const k = (t * 1.6) % 1;
    g.strokeStyle = Math.floor(t * 8) % 2 ? 'rgba(255,80,100,0.8)' : 'rgba(80,140,255,0.8)';
    g.lineWidth = 3 * u;
    withA(g, 1 - k, () => {
      g.beginPath();
      g.arc(A, FY - len * 0.5, 20 * u + k * 120 * u, 0, TAU);
      g.stroke();
    });
  }
  stepParticles(ps, f.dt);
  drawDots(g, ps, 0.7);
  // money bills fluttering from the getaway
  const bs = particles(f.mem, 'bills');
  emit(f, 'bill', 5, () => spawn(bs, B - 40 * u, FY - FH * 0.6, f.rand.range(-420, -260) * u, f.rand.range(-120, -40) * u, 1.6, 10 * u, '#5fbf5a', 0, 0, f.rand.range(-8, 8)), 30, bs);
  stepParticles(bs, f.dt, 120 * u);
  drawPs(g, bs, (p) => bill(g, p.x, p.y, p.size, p.rot ?? 0));
}, () => 2);

const smuggling = mk(3.6, (f) => {
  const { g, L, t } = f;
  const { u, FY, A, B, FH, P } = box(L);
  sky(g, L, ['#020414', '#0a1636', '#132a52']);
  // stars and moon
  for (let i = 0; i < 40; i++) {
    const x = (i * 97.3) % L.w;
    const y = ((i * 53.1) % (FY * 0.55));
    circ(g, x, y, (1 + (i % 3) * 0.5) * u, `rgba(255,255,255,${0.4 + 0.4 * Math.sin(t * 3 + i)})`);
  }
  glow(g, L.w * 0.15, FY * 0.18, 90 * u, 'rgba(230,240,255,0.7)');
  circ(g, L.w * 0.15, FY * 0.18, 26 * u, '#f1f5ff');
  circ(g, L.w * 0.15 + 10 * u, FY * 0.18 - 6 * u, 22 * u, '#0a1636');
  // sea
  const seaY = FY - 40 * u;
  g.fillStyle = '#071833';
  g.fillRect(0, seaY, L.w, L.h);
  g.strokeStyle = 'rgba(120,180,255,0.35)';
  g.lineWidth = 2 * u;
  g.beginPath();
  for (let r = 0; r < 5; r++) {
    const y = seaY + 12 * u + r * 24 * u;
    for (let x = -((t * 30 * u + r * 40 * u) % (60 * u)); x < L.w; x += 60 * u) {
      g.moveTo(x, y);
      g.quadraticCurveTo(x + 15 * u, y - 6 * u, x + 30 * u, y);
    }
  }
  g.stroke();
  // lighthouse on the right with sweeping beam
  const lx = B + (P ? 40 : 80) * u;
  const top = FY - 360 * u;
  poly(g, '#1a1f33', [lx - 60 * u, seaY + 10 * u, lx + 60 * u, seaY + 10 * u, lx + 40 * u, seaY - 30 * u, lx - 40 * u, seaY - 30 * u]);
  poly(g, '#e9ecef', [lx - 30 * u, seaY - 30 * u, lx + 30 * u, seaY - 30 * u, lx + 18 * u, top, lx - 18 * u, top]);
  for (let i = 0; i < 3; i++) {
    const y0 = seaY - 30 * u - (i * 2 + 1) * (seaY - 30 * u - top) / 6;
    g.fillStyle = '#d00000';
    g.fillRect(lx - 26 * u + i * 3 * u, y0 - 20 * u, 52 * u - i * 6 * u, 26 * u);
  }
  rr(g, lx - 22 * u, top - 34 * u, 44 * u, 34 * u, 4 * u, '#ffe066');
  poly(g, '#d00000', [lx - 28 * u, top - 34 * u, lx + 28 * u, top - 34 * u, lx, top - 60 * u]);
  const ang = Math.PI + Math.sin(t * 1.3) * 0.6;
  const bl = L.w * 0.9;
  withA(g, 0.3, () => poly(g, '#fff7c2', [lx, top - 17 * u, lx + Math.cos(ang - 0.08) * bl, top - 17 * u + Math.sin(ang - 0.08) * bl, lx + Math.cos(ang + 0.08) * bl, top - 17 * u + Math.sin(ang + 0.08) * bl]));
  glow(g, lx, top - 17 * u, 80 * u, 'rgba(255,240,160,0.9)');
  // boat with crates bobbing on the left
  const bob = Math.sin(t * 2.2) * 5 * u;
  const tilt = Math.sin(t * 1.8) * 0.05;
  const bw = (P ? 170 : 230) * u;
  g.save();
  g.translate(A, seaY + 6 * u + bob);
  g.rotate(tilt);
  // crates
  const crate = (x: number, y: number, s: number) => {
    rr(g, x - s / 2, y - s, s, s, 2 * u, '#a0672f');
    g.strokeStyle = '#6b4325';
    g.lineWidth = 3 * u;
    g.strokeRect(x - s / 2 + 3 * u, y - s + 3 * u, s - 6 * u, s - 6 * u);
    text(g, '?', x, y - s / 2, s * 0.5, '#ffd166', false);
  };
  crate(-bw * 0.25, -14 * u, 40 * u);
  crate(-bw * 0.25 + 42 * u, -14 * u, 40 * u);
  crate(-bw * 0.25 + 20 * u, -54 * u, 36 * u);
  // hooded smuggler with a lantern, sneaking
  const sm = fig(g, bw * 0.28, -14 * u, FH * 0.8, '#0d0d14', { dir: -1, armF: 1.3, armB: 0.4, hat: 'hood', hatCol: '#1a1a2a', lean: 0.15 });
  glow(g, sm.fx - 6 * u, sm.fy + 10 * u, 50 * u, 'rgba(255,190,80,0.8)', 0.8 + 0.2 * Math.sin(t * 15));
  rr(g, sm.fx - 11 * u, sm.fy + 2 * u, 10 * u, 14 * u, 2 * u, '#ffd36b');
  poly(g, '#5c3a1e', [-bw / 2, -16 * u, bw / 2, -16 * u, bw * 0.4, 18 * u, -bw * 0.42, 18 * u]);
  g.fillStyle = '#7a4f2a';
  g.fillRect(-bw / 2, -16 * u, bw, 6 * u);
  g.restore();
  // "shh" bubble when the beam swings close
  const near = Math.sin(t * 1.3) > 0.35;
  if (near) text(g, 'SHH!', A + bw * 0.28, seaY - FH * 1.0, 24 * u, '#ffffff');
});

const gangMeeting = mk(3.6, (f) => {
  const { g, L, t, era } = f;
  const { u, FY, A, B, FH, P } = box(L);
  const e = EI[era];
  backRoom(g, L, FY, A, u, t, 'rgba(255,170,80,0.7)');
  // round table with three figures
  const tw = (P ? 170 : 220) * u;
  const hatK: Hat = e <= 2 ? 'top' : 'fedora';
  const spots: [number, number, 1 | -1, string, string][] = [
    [A - tw * 0.55, 0.95, 1, '#16141c', '#c1121f'],
    [A, 0.82, 1, '#1d1a26', '#ffd166'],
    [A + tw * 0.55, 0.95, -1, '#16141c', '#7b2cbf'],
  ];
  const cig: [number, number][] = [];
  for (let i = 0; i < 3; i++) {
    const [x, s, dir, col, acc] = spots[i];
    const lean = i === 1 ? 0 : 0.15 + Math.max(0, Math.sin(t * 2 + i)) * 0.12;
    const p = fig(g, x, FY - (i === 1 ? 26 * u : 0), FH * s, col, { dir, armF: i === 1 ? 1.2 : 1.45, armB: 0.6, hat: hatK, hatCol: '#0c0b10', accent: acc, lean });
    cig.push([p.hx + dir * p.hr * 1.2, p.hy + p.hr * 0.4]);
    // glowing eyes under hat brims
    withA(g, 0.8, () => {
      circ(g, p.hx + dir * p.hr * 0.4, p.hy - p.hr * 0.05, p.hr * 0.12, '#ffeeaa');
      circ(g, p.hx + dir * p.hr * 0.05, p.hy - p.hr * 0.05, p.hr * 0.12, '#ffeeaa');
    });
  }
  ell(g, A, FY - 78 * u, tw * 0.62, 18 * u, '#2a3b2a');
  ell(g, A, FY - 82 * u, tw * 0.6, 15 * u, '#355e3b');
  g.fillStyle = '#1a1a1a';
  g.fillRect(A - 8 * u, FY - 70 * u, 16 * u, 70 * u);
  // cards and chips on the table
  for (let i = 0; i < 4; i++) rr(g, A - 50 * u + i * 26 * u, FY - 92 * u, 16 * u, 10 * u, 2 * u, i % 2 ? '#ffffff' : '#ffd166');
  for (let i = 0; i < 3; i++) ell(g, A + 30 * u, FY - 88 * u - i * 4 * u, 9 * u, 3 * u, '#c1121f');
  // cigars with smoke curls
  const ps = particles(f.mem);
  for (let i = 0; i < cig.length; i++) {
    const [cx, cy] = cig[i];
    ln(g, cx - (i === 2 ? -1 : 1) * 10 * u, cy, cx, cy, '#6b4325', 4 * u);
    const pulse = 0.6 + 0.4 * Math.sin(t * 3 + i * 2);
    glow(g, cx, cy, 14 * u, 'rgba(255,90,30,1)', pulse);
    circ(g, cx, cy, 2.5 * u, '#ff6b2b');
    emit(f, 'c' + i, 6, () => spawn(ps, cx, cy - 2 * u, f.rand.range(-10, 10) * u, f.rand.range(-50, -30) * u, 2.4, 5 * u, '#9a90a8', 0, f.rand.range(0, TAU)), 120, ps);
  }
  stepParticles(ps, f.dt);
  for (const p of ps) {
    p.size += f.dt * 10 * u;
    p.x += Math.sin(p.life * 3 + (p.rot ?? 0)) * 12 * u * f.dt;
  }
  drawDots(g, ps, 0.35);
  // wall map with red X and a briefcase of cash on the right
  const mw = (P ? 150 : 210) * u;
  const mh = 120 * u;
  const my = FY - 330 * u;
  glow(g, B, my + mh / 2, mw * 0.8, 'rgba(255,60,60,0.25)');
  rr(g, B - mw / 2, my, mw, mh, 3 * u, '#d8c8a0');
  g.strokeStyle = '#8a7a58';
  g.lineWidth = 2 * u;
  g.beginPath();
  g.moveTo(B - mw * 0.4, my + mh * 0.7);
  g.bezierCurveTo(B - mw * 0.1, my + mh * 0.2, B + mw * 0.1, my + mh * 0.9, B + mw * 0.4, my + mh * 0.3);
  g.stroke();
  g.setLineDash([6 * u, 5 * u]);
  g.strokeStyle = '#c1121f';
  g.lineWidth = 3 * u;
  g.beginPath();
  g.moveTo(B - mw * 0.35, my + mh * 0.3);
  g.lineTo(lerp(B - mw * 0.35, B + mw * 0.25, span(t, 0.3, 1.6)), lerp(my + mh * 0.3, my + mh * 0.65, span(t, 0.3, 1.6)));
  g.stroke();
  g.setLineDash([]);
  if (t > 1.6) text(g, 'X', B + mw * 0.25, my + mh * 0.65, 30 * u, '#e63946');
  for (const [px, py] of [[-0.4, 0.1], [0.4, 0.1]]) circ(g, B + mw * px, my + mh * py, 5 * u, '#e63946');
  // briefcase
  const bk = span(t, 1.8, 2.3);
  const bx = B;
  const by = FY - 10 * u;
  rr(g, bx - 60 * u, by - 50 * u, 120 * u, 50 * u, 6 * u, '#2b2d42');
  if (bk > 0) {
    glow(g, bx, by - 50 * u, 110 * u * bk, 'rgba(120,255,120,0.7)');
    g.save();
    g.translate(bx, by - 50 * u);
    g.scale(1, -bk);
    rr(g, -60 * u, 0, 120 * u, 44 * u, 6 * u, '#3d405b');
    g.restore();
    for (let i = 0; i < 4; i++) bill(g, bx - 38 * u + i * 25 * u, by - 56 * u - Math.sin(t * 4 + i) * 2 * u, 12 * u, Math.PI / 2);
  } else {
    rr(g, bx - 16 * u, by - 62 * u, 32 * u, 12 * u, 4 * u, '#2b2d42');
  }
});

const petCat = mk(3.4, (f) => {
  const { g, L, t } = f;
  const { u, FY, A, B, P } = box(L);
  room(g, L, FY, '#ffcdb2', '#ffb4a2', '#b5838d');
  glow(g, A, FY - 80 * u, 260 * u, 'rgba(255,240,200,0.6)');
  // window with a moon and fairy lights
  const ww = (P ? 140 : 180) * u;
  rr(g, B - ww / 2 - 8 * u, FY - 340 * u, ww + 16 * u, 150 * u + 16 * u, 8 * u, '#ffffff');
  rr(g, B - ww / 2, FY - 332 * u, ww, 150 * u, 4 * u, '#5e548e');
  circ(g, B + ww * 0.2, FY - 290 * u, 18 * u, '#fff3b0');
  // rug and cat
  ell(g, A, FY + 10 * u, (P ? 120 : 170) * u, 26 * u, '#e5989b');
  ell(g, A, FY + 10 * u, (P ? 90 : 130) * u, 18 * u, '#ffcad4');
  const cs = (P ? 140 : 180) * u;
  cat(g, A, FY + 4 * u, cs, '#f4a261', t);
  // purr marks
  const k = (t * 1.5) % 1;
  withA(g, 1 - k, () => text(g, 'purr', A - cs * 0.5 - 10 * u, FY - cs * 0.5 - k * 30 * u, 18 * u, '#6d597a', false, 800));
  // floating hearts
  const ps = particles(f.mem);
  emit(f, 'h', 3, () => spawn(ps, A + f.rand.range(-cs * 0.4, cs * 0.3), FY - cs * 0.4, f.rand.range(-15, 15) * u, f.rand.range(-70, -45) * u, 2.2, f.rand.range(8, 14) * u, f.rand.pick(['#ff5d8f', '#ff99ac', '#ff3d5a'])), 30, ps);
  stepParticles(ps, f.dt);
  drawPs(g, ps, (p) => heart(g, p.x + Math.sin(p.life * 4) * 6 * u, p.y, p.size, p.color));
  // yarn ball rolling with its thread
  const yr = 26 * u;
  const yx = B + Math.sin(t * 1.6) * 50 * u;
  const yy = FY - yr;
  g.strokeStyle = '#7b2cbf';
  g.lineWidth = 3 * u;
  g.beginPath();
  g.moveTo(yx, FY - 2 * u);
  g.bezierCurveTo(yx - 60 * u, FY + 10 * u, B - 80 * u, FY - 4 * u, B - 120 * u, FY + 14 * u);
  g.stroke();
  circ(g, yx, yy, yr, '#9d4edd');
  g.strokeStyle = '#c77dff';
  g.lineWidth = 2.5 * u;
  const rot = Math.sin(t * 1.6) * 50 / 26;
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.ellipse(yx, yy, yr * 0.9, yr * (0.25 + i * 0.18), rot + i * 0.8, 0, TAU);
    g.stroke();
  }
});

const petHorse = mk(3.4, (f) => {
  const { g, L, t } = f;
  const { u, FY, A, B, P } = box(L);
  sky(g, L, ['#48b8ff', '#a8e6ff', '#fff6d5']);
  glow(g, L.w * 0.85, FY * 0.2, 150 * u, 'rgba(255,230,120,0.9)');
  circ(g, L.w * 0.85, FY * 0.2, 36 * u, '#ffd166');
  // clouds drifting
  for (let i = 0; i < 3; i++) {
    const cx = ((i * 0.37 * L.w - t * 30 * u) % (L.w + 200 * u) + L.w + 200 * u) % (L.w + 200 * u) - 100 * u;
    const cy = FY * (0.15 + i * 0.12);
    for (let k = 0; k < 3; k++) circ(g, cx + k * 30 * u, cy - (k === 1 ? 10 * u : 0), (k === 1 ? 26 : 20) * u, 'rgba(255,255,255,0.9)');
  }
  // far hills scroll slowly, meadow and fence scroll fast
  const speed = 360 * u;
  g.fillStyle = '#95d5b2';
  g.beginPath();
  g.moveTo(0, FY);
  for (let x = 0; x <= L.w + 40; x += 40) g.lineTo(x, FY - 110 * u - Math.sin((x + t * speed * 0.2) * 0.005) * 40 * u);
  g.lineTo(L.w, FY);
  g.fill();
  g.fillStyle = '#52b788';
  g.fillRect(0, FY - 20 * u, L.w, L.h);
  // fence
  const fs = 110 * u;
  const off = (t * speed) % fs;
  g.fillStyle = '#ffffff';
  for (let x = -off; x < L.w + fs; x += fs) g.fillRect(x, FY - 90 * u, 8 * u, 76 * u);
  g.fillRect(0, FY - 78 * u, L.w, 6 * u);
  g.fillRect(0, FY - 50 * u, L.w, 6 * u);
  // flowers whizzing by in the foreground
  for (let i = 0; i < 30; i++) {
    const x = ((i * 83 * u - t * speed * 1.3) % (L.w + 20) + L.w + 20) % (L.w + 20);
    const y = FY + 10 * u + ((i * 29) % 60) * u;
    circ(g, x, y, 4 * u, CONFETTI_COLORS[i % CONFETTI_COLORS.length]);
    circ(g, x, y, 1.6 * u, '#ffffff');
  }
  // the horse galloping (a second foal on the right on desktop)
  const s = (P ? 180 : 230) * u;
  const ps = particles(f.mem);
  horse(g, (P ? L.w * 0.5 : A) + Math.sin(t * 1.5) * 20 * u, FY + 6 * u, s, '#8b4513', t, 1, 10, { mane: '#2b1a0e' });
  if (!P) horse(g, B, FY + 6 * u, s * 0.7, '#f1e2c8', t + 0.4, 1, 11, { mane: '#c8a66b' });
  emit(f, 'd', 20, () => spawn(ps, (P ? L.w * 0.5 : A) - s * 0.35, FY, f.rand.range(-260, -140) * u, f.rand.range(-60, -10) * u, 0.8, f.rand.range(4, 9) * u, '#b7e4c7'), 60, ps);
  stepParticles(ps, f.dt);
  drawDots(g, ps, 0.7);
  // butterflies
  for (let i = 0; i < 3; i++) {
    const bx = (P ? L.w * (0.25 + i * 0.25) : B + (i - 1) * 80 * u) + Math.sin(t * 2 + i) * 30 * u;
    const by = FY - 260 * u + Math.cos(t * 2.6 + i * 2) * 30 * u;
    const fl = Math.abs(Math.sin(t * 16 + i));
    ell(g, bx - 6 * u * fl, by, 7 * u * fl, 6 * u, ['#ff9f1c', '#b388ff', '#ff5d8f'][i]);
    ell(g, bx + 6 * u * fl, by, 7 * u * fl, 6 * u, ['#ff9f1c', '#b388ff', '#ff5d8f'][i]);
  }
});

const petBird = mk(3.4, (f) => {
  const { g, L, t } = f;
  const { u, FY, A, B, P } = box(L);
  room(g, L, FY, '#1b998b', '#7ae7c7', '#0f5e55');
  // jungle leaves at the edges
  for (let i = 0; i < 8; i++) {
    const x = (i % 2 ? L.w : 0) + (i % 2 ? -1 : 1) * (20 + (i * 13) % 40) * u;
    const y = (i * 0.12 + 0.05) * FY;
    ell(g, x, y, 80 * u, 26 * u, i % 3 ? '#2d6a4f' : '#40916c', (i % 2 ? -1 : 1) * (0.4 + (i % 3) * 0.2) + Math.sin(t + i) * 0.05);
  }
  // perch stand
  const px = A;
  const py = FY - 220 * u;
  ln(g, px, FY, px, py, '#8a5a32', 8 * u);
  ln(g, px - 70 * u, py, px + 70 * u, py, '#a0672f', 9 * u);
  ell(g, px, FY, 40 * u, 8 * u, '#6b4325');
  const ps2 = (P ? 150 : 190) * u;
  parrot(g, px - 10 * u, py - 4 * u, ps2, t);
  // speech bubble
  const k = span(t, 0.6, 1.0);
  if (k > 0) {
    const bx = P ? L.w * 0.66 : A + 130 * u;
    const by = py - ps2 * 0.95;
    g.save();
    g.translate(bx, by);
    g.scale(k, k);
    g.rotate(Math.sin(t * 5) * 0.04);
    rr(g, -78 * u, -30 * u, 156 * u, 60 * u, 22 * u, '#ffffff');
    poly(g, '#ffffff', [-50 * u, 24 * u, -84 * u, 50 * u, -26 * u, 26 * u]);
    text(g, t > 2 ? 'PRETTY!' : 'HELLO!', 0, 0, 26 * u, '#e63946', false);
    g.restore();
  }
  // a smaller bird flitting on the right (desktop) / a seed bowl
  if (!P) {
    const bx = B + Math.sin(t * 1.7) * 60 * u;
    const by = FY - 250 * u + Math.sin(t * 3.1) * 40 * u;
    const fl = Math.sin(t * 20);
    ell(g, bx, by, 16 * u, 12 * u, '#ffd166');
    circ(g, bx + 13 * u, by - 8 * u, 9 * u, '#ffd166');
    poly(g, '#ff9f1c', [bx + 20 * u, by - 10 * u, bx + 30 * u, by - 7 * u, bx + 20 * u, by - 4 * u]);
    poly(g, '#f4a261', [bx - 4 * u, by, bx + 8 * u, by, bx, by - 26 * u * fl]);
    circ(g, bx + 15 * u, by - 10 * u, 2 * u, '#111');
  }
  rr(g, B - 40 * u, FY - 26 * u, 80 * u, 26 * u, 10 * u, '#ff5d73');
  for (let i = 0; i < 8; i++) circ(g, B - 28 * u + i * 8 * u, FY - 26 * u - (i % 2) * 3 * u, 4 * u, '#ffd166');
  // feathers drifting down
  const ps = particles(f.mem);
  emit(f, 'f', 4, () => spawn(ps, px + f.rand.range(-40, 40) * u, py - ps2 * 0.4, f.rand.range(-20, 20) * u, f.rand.range(10, 30) * u, 2.6, 12 * u, f.rand.pick(['#e63946', '#1d9bf0', '#ffd166', '#06d6a0']), 0, 0, f.rand.range(-2, 2)), 30, ps);
  stepParticles(ps, f.dt, 10 * u);
  drawPs(g, ps, (p) => {
    g.save();
    g.translate(p.x + Math.sin(p.life * 3) * 14 * u, p.y);
    g.rotate((p.rot ?? 0) + Math.sin(p.life * 3) * 0.6);
    ell(g, 0, 0, p.size * 0.35, p.size, p.color);
    ln(g, 0, -p.size, 0, p.size * 1.2, 'rgba(255,255,255,0.6)', 1.2 * u);
    g.restore();
  });
});

const vet = mk(3.4, (f) => {
  const { g, L, t } = f;
  const { u, FY, A, B, FH, P } = box(L);
  room(g, L, FY, '#caf0f8', '#90e0ef', '#48cae4', 'rgba(0,0,0,0.1)');
  // paw prints on the wall
  for (let i = 0; i < 5; i++) {
    const x = (i * 0.21 + 0.06) * L.w;
    const y = FY * (0.1 + (i % 2) * 0.12);
    withA(g, 0.3, () => {
      circ(g, x, y, 10 * u, '#0096c7');
      for (let k = 0; k < 4; k++) circ(g, x + (k - 1.5) * 8 * u, y - 13 * u - (k % 3 ? 3 : 0) * u, 4 * u, '#0096c7');
    });
  }
  // exam table with a dog
  const tw = (P ? 170 : 220) * u;
  const ty = FY - 90 * u;
  ln(g, A, ty, A, FY, '#6c757d', 12 * u);
  rr(g, A - tw / 2, ty - 8 * u, tw, 12 * u, 5 * u, '#adb5bd');
  const ds = (P ? 130 : 160) * u;
  dog(g, A - 10 * u, ty - 8 * u, ds, '#e9c46a', t);
  // bandage wrapping the front paw
  const bk = span(t, 0.6, 2.2);
  const px = A - 10 * u + ds * 0.32;
  const py = ty - 8 * u - ds * 0.03;
  for (let i = 0; i < Math.floor(bk * 4); i++) rr(g, px - 18 * u + i * 9 * u, py - ds * 0.055, 6 * u, ds * 0.11, 2 * u, '#ffffff');
  // vet
  const vx = A + tw / 2 + 14 * u;
  const v = fig(g, vx, FY, FH, '#0077b6', { dir: -1, armF: 1.5 + Math.sin(t * 8) * 0.15, armB: 1.0, accent: '#0096c7', lean: 0.15 });
  ln(g, v.hx, v.hy + v.hr * 1.2, v.hx - 4 * u, v.hy + v.hr * 3, '#e9edf5', 2.5 * u);
  circ(g, v.hx - 4 * u, v.hy + v.hr * 3, 4 * u, '#e9edf5');
  rr(g, v.hx - v.hr * 0.6, v.hy - v.hr * 1.2, v.hr * 1.2, v.hr * 0.5, 3 * u, '#ffffff');
  // heart with a cross on the right
  const beat = Math.pow(Math.max(0, Math.sin(t * 6)), 6);
  const hx = B;
  const hy = FY - 240 * u;
  const hk = span(t, 1.8, 2.3);
  glow(g, hx, hy, 140 * u, 'rgba(255,120,150,0.5)');
  heart(g, hx, hy, (52 + 8 * beat) * u, '#ff4d6d');
  g.fillStyle = '#ffffff';
  g.fillRect(hx - 8 * u, hy - 26 * u, 16 * u, 44 * u);
  g.fillRect(hx - 22 * u, hy - 12 * u, 44 * u, 16 * u);
  if (hk > 0) {
    for (let i = 0; i < 5; i++) sparkle(g, hx + Math.cos(i * 1.26 + t) * 80 * u, hy + Math.sin(i * 1.26 + t) * 60 * u, 9 * u * hk, '#ffffff');
    text(g, 'ALL BETTER!', hx, hy + 100 * u, 22 * u * hk, '#ffffff');
  }
  // dog hearts
  const ps = particles(f.mem);
  if (t > 1.5) emit(f, 'h', 3, () => spawn(ps, A + ds * 0.35, ty - ds * 0.5, f.rand.range(-15, 15) * u, -60 * u, 1.6, 9 * u, '#ff4d6d'), 20, ps);
  stepParticles(ps, f.dt);
  drawPs(g, ps, (p) => heart(g, p.x, p.y, p.size, p.color));
});

const jewelry = mk(3.4, (f) => {
  const { g, L, t } = f;
  const { u, FY, A, B, P } = box(L);
  room(g, L, FY, '#240046', '#3c096c', '#10002b', 'rgba(255,215,0,0.2)');
  glow(g, A, FY - 140 * u, 260 * u, 'rgba(255,215,120,0.35)');
  // glass display case
  const cw = (P ? 175 : 240) * u;
  const ch = 120 * u;
  const cy = FY - 80 * u;
  rr(g, A - cw / 2 - 10 * u, cy, cw + 20 * u, 80 * u, 6 * u, '#5a189a');
  g.fillStyle = '#ffd700';
  g.fillRect(A - cw / 2 - 10 * u, cy, cw + 20 * u, 4 * u);
  rr(g, A - cw / 2, cy - 10 * u, cw, 10 * u, 2 * u, '#7b2cbf');
  // rings on cushions
  const gems = ['#ff006e', '#4cc9f0', '#06d6a0'];
  for (let i = 0; i < 3; i++) {
    const x = A + (i - 1) * cw * 0.32;
    rr(g, x - 20 * u, cy - 24 * u, 40 * u, 16 * u, 6 * u, '#10002b');
    g.strokeStyle = '#ffd700';
    g.lineWidth = 4 * u;
    g.beginPath();
    g.ellipse(x, cy - 34 * u, 13 * u, 15 * u, 0, 0, TAU);
    g.stroke();
    glow(g, x, cy - 52 * u, 30 * u, gems[i], 0.7);
    poly(g, gems[i], [x - 9 * u, cy - 50 * u, x + 9 * u, cy - 50 * u, x + 5 * u, cy - 58 * u, x - 5 * u, cy - 58 * u]);
    poly(g, gems[i], [x - 9 * u, cy - 50 * u, x + 9 * u, cy - 50 * u, x, cy - 42 * u]);
  }
  // glass
  withA(g, 0.18, () => rr(g, A - cw / 2, cy - ch, cw, ch - 10 * u, 4 * u, '#e0f7ff'));
  g.strokeStyle = 'rgba(255,255,255,0.6)';
  g.lineWidth = 2 * u;
  g.strokeRect(A - cw / 2, cy - ch, cw, ch - 10 * u);
  const sh = ((t * 0.6) % 1.4) - 0.2;
  withA(g, 0.35, () => poly(g, '#ffffff', [A - cw / 2 + sh * cw, cy - ch, A - cw / 2 + sh * cw + 24 * u, cy - ch, A - cw / 2 + sh * cw - 16 * u, cy - 10 * u, A - cw / 2 + sh * cw - 40 * u, cy - 10 * u]));
  // necklace on a velvet bust
  const nx = B;
  const ny = FY - 210 * u;
  poly(g, '#10002b', [nx - 60 * u, FY, nx + 60 * u, FY, nx + 40 * u, ny + 40 * u, nx + 70 * u, ny - 10 * u, nx - 70 * u, ny - 10 * u, nx - 40 * u, ny + 40 * u]);
  rr(g, nx - 18 * u, ny - 70 * u, 36 * u, 64 * u, 10 * u, '#10002b');
  const swing = Math.sin(t * 2) * 0.06;
  g.save();
  g.translate(nx, ny - 10 * u);
  g.rotate(swing);
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI * (i / 12);
    circ(g, Math.cos(a) * 55 * u, Math.sin(a) * 55 * u * 0.9, 5 * u, '#f8f9fa');
  }
  glow(g, 0, 70 * u, 60 * u, 'rgba(255,0,110,0.8)');
  poly(g, '#ff006e', [0, 52 * u, 16 * u, 66 * u, 0, 92 * u, -16 * u, 66 * u]);
  poly(g, '#ff8fab', [0, 56 * u, 8 * u, 66 * u, 0, 72 * u, -8 * u, 66 * u]);
  g.restore();
  // twinkles everywhere
  for (let i = 0; i < 10; i++) {
    const k = (t * 1.2 + i * 0.37) % 1;
    const x = i % 2 ? A + ((i * 37) % 100 - 50) / 50 * cw * 0.5 : nx + ((i * 53) % 140 - 70) * u;
    const y = i % 2 ? cy - 30 * u - ((i * 23) % 60) * u : ny + ((i * 41) % 120 - 20) * u;
    sparkle(g, x, y, 10 * u * Math.sin(k * Math.PI), '#ffffff');
  }
  const pr = span(t, 1.3, 1.7);
  if (pr > 0) text(g, '$$$$', A, cy - ch - 40 * u, 26 * u * pr, '#ffd700');
});

const luxury = mk(3.6, (f) => {
  const { g, L, t, era } = f;
  const { u, FY, A, B, FH, P } = box(L);
  const e = EI[era];
  sky(g, L, ['#0096c7', '#48cae4', '#ade8f4']);
  // sun glare and lens flare
  const sx = L.w * (P ? 0.82 : 0.9);
  const sy = FY * 0.16;
  glow(g, sx, sy, 260 * u, 'rgba(255,250,200,0.95)');
  circ(g, sx, sy, 40 * u, '#fffbe0');
  rays(g, sx, sy, 50 * u, 110 * u, 14, t * 0.3, 'rgba(255,255,220,0.5)', 4 * u);
  for (let i = 1; i <= 3; i++) withA(g, 0.25, () => circ(g, lerp(sx, L.w * 0.3, i / 4), lerp(sy, FY * 0.7, i / 4), (14 + i * 8) * u, ['#ffd166', '#b388ff', '#4cc9f0'][i - 1]));
  // sea
  const seaY = FY - 30 * u;
  g.fillStyle = '#0077b6';
  g.fillRect(0, seaY, L.w, L.h);
  g.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < 25; i++) {
    const x = ((i * 131 * u - t * 30 * u) % L.w + L.w) % L.w;
    g.fillRect(x, seaY + 10 * u + ((i * 37) % 80) * u, 30 * u, 2 * u);
  }
  // yacht (or a sailing ship in old eras)
  const bob = Math.sin(t * 2) * 4 * u;
  const yw = (P ? 210 : 290) * u;
  const yx = A;
  const yy = seaY + 10 * u + bob;
  if (e <= 2) {
    poly(g, '#7a4a28', [yx - yw / 2, yy - 40 * u, yx + yw / 2, yy - 50 * u, yx + yw * 0.38, yy, yx - yw * 0.4, yy]);
    ln(g, yx, yy - 40 * u, yx, yy - 250 * u, '#5a3418', 6 * u);
    poly(g, '#fffbe8', [yx - 6 * u, yy - 240 * u, yx - 6 * u, yy - 60 * u, yx - yw * 0.38, yy - 60 * u]);
    poly(g, '#fffbe8', [yx + 6 * u, yy - 230 * u, yx + 6 * u, yy - 70 * u, yx + yw * 0.32, yy - 70 * u]);
    poly(g, '#e63946', [yx, yy - 250 * u, yx + 34 * u, yy - 240 * u + Math.sin(t * 8) * 3 * u, yx, yy - 230 * u]);
  } else {
    poly(g, '#ffffff', [yx - yw / 2, yy - 40 * u, yx + yw / 2 + 20 * u, yy - 46 * u, yx + yw * 0.36, yy, yx - yw * 0.44, yy]);
    g.fillStyle = '#023e8a';
    g.fillRect(yx - yw * 0.45, yy - 18 * u, yw * 0.86, 6 * u);
    poly(g, '#f1f5f9', [yx - yw * 0.3, yy - 40 * u, yx + yw * 0.25, yy - 40 * u, yx + yw * 0.12, yy - 80 * u, yx - yw * 0.24, yy - 80 * u]);
    g.fillStyle = '#1d3557';
    g.fillRect(yx - yw * 0.2, yy - 70 * u, yw * 0.3, 14 * u);
    poly(g, '#e2e8f0', [yx - yw * 0.16, yy - 80 * u, yx + yw * 0.06, yy - 80 * u, yx - 0, yy - 108 * u, yx - yw * 0.12, yy - 108 * u]);
    if (e >= 5) glow(g, yx, yy, yw * 0.5, 'rgba(90,240,255,0.4)');
  }
  // rich figure in sunglasses toasting
  const rx = yx + yw * (e <= 2 ? -0.25 : 0.32);
  const rich = fig(g, rx, yy - (e <= 2 ? 40 : 46) * u, FH * 0.75, '#1d2233', { dir: -1, armF: 2.4 + Math.sin(t * 3) * 0.1, armB: 0.5, accent: '#ffd700', hat: e <= 2 ? 'top' : 'none' });
  rr(g, rich.hx - rich.hr * 1.0, rich.hy - rich.hr * 0.35, rich.hr * 1.4, rich.hr * 0.45, 2 * u, '#111');
  glow(g, rich.fx, rich.fy - 8 * u, 26 * u, 'rgba(255,230,120,0.9)');
  poly(g, '#ffe066', [rich.fx - 6 * u, rich.fy - 22 * u, rich.fx + 6 * u, rich.fy - 22 * u, rich.fx, rich.fy - 6 * u]);
  ln(g, rich.fx, rich.fy - 6 * u, rich.fx, rich.fy + 4 * u, '#ffffff', 2 * u);
  // champagne bottle popping on the right
  const bx = B;
  const by = FY - 128 * u;
  const pop = span(t, 0.8, 0.95);
  g.fillStyle = '#8a5a32';
  for (const k of [-70, 0, 70]) g.fillRect(bx + k * u - 5 * u, seaY - 30 * u, 10 * u, 70 * u);
  rr(g, bx - (P ? 70 : 100) * u, seaY - 36 * u, (P ? 140 : 200) * u, 12 * u, 3 * u, '#c58a4a');
  g.save();
  g.translate(bx, by);
  g.rotate(0.35);
  rr(g, -20 * u, -10 * u, 40 * u, 100 * u, 10 * u, '#1b4332');
  rr(g, -8 * u, -50 * u, 16 * u, 44 * u, 5 * u, '#1b4332');
  g.fillStyle = '#ffd700';
  g.fillRect(-9 * u, -54 * u, 18 * u, 18 * u);
  rr(g, -16 * u, 20 * u, 32 * u, 36 * u, 4 * u, '#ffd700');
  g.restore();
  const ps = particles(f.mem);
  const nx = bx + Math.sin(0.35) * 52 * u;
  const ny = by - Math.cos(0.35) * 52 * u;
  if (pop > 0) {
    if (once(f, 'cork')) {
      spawn(ps, nx, ny, 160 * u, -520 * u, 1.6, 9 * u, '#c58a4a', 1);
      for (let i = 0; i < 40; i++) spawn(ps, nx, ny, f.rand.range(-40, 260) * u, f.rand.range(-520, -260) * u, 1.4, f.rand.range(3, 7) * u, f.rand.pick(['#fff3b0', '#ffffff', '#ffe066']));
    }
    if (t < 2.2) emit(f, 'sp', 30, () => spawn(ps, nx, ny, f.rand.range(-20, 180) * u, f.rand.range(-420, -220) * u, 1.2, f.rand.range(3, 6) * u, f.rand.pick(['#fff3b0', '#ffffff', '#ffe066'])), 200, ps);
    glow(g, nx, ny, 70 * u * (1 - span(t, 0.95, 1.6)), 'rgba(255,255,220,1)');
  }
  stepParticles(ps, f.dt, 500 * u);
  drawPs(g, ps, (p) => {
    if (p.kind === 1) ell(g, p.x, p.y, p.size, p.size * 0.7, p.color, p.life * 12);
    else circ(g, p.x, p.y, p.size, p.color);
  });
  if (pop > 0 && t < 1.6) text(g, 'POP!', nx + 40 * u, ny - 60 * u, 34 * u, '#ffd166');
});

const gadget = mk(3.6, (f) => {
  const { g, L, t, era } = f;
  const { u, FY, A, B, FH, P } = box(L);
  const e = EI[era];
  room(g, L, FY, '#1a1a40', '#3a0ca3', '#10102a');
  // box opening with light rays
  const bw = (P ? 130 : 170) * u;
  const bh = 90 * u;
  const bx = A;
  const by = FY - bh;
  const open = span(t, 0.4, 0.9);
  const rise = span(t, 0.8, 1.6);
  const glowCol = e >= 5 ? 'rgba(90,240,255,0.9)' : e >= 4 ? 'rgba(120,180,255,0.9)' : 'rgba(255,220,120,0.9)';
  if (open > 0) {
    glow(g, bx, by - 60 * u, 260 * u * open, glowCol);
    rays(g, bx, by, 40 * u, (40 + 220 * open) * u, 16, t * 0.4, 'rgba(255,255,255,0.35)', 6 * u);
  }
  // device
  const dy = by - 20 * u - rise * 110 * u + Math.sin(t * 3) * 4 * u * rise;
  if (rise > 0) {
    g.save();
    g.translate(bx, dy);
    if (e <= 2) {
      // clockwork bird toy with a turning key
      const hop = Math.abs(Math.sin(t * 8)) * 6 * u;
      ell(g, 0, -hop, 40 * u, 28 * u, '#ffb703');
      circ(g, 30 * u, -26 * u - hop, 20 * u, '#ffb703');
      poly(g, '#e85d04', [46 * u, -30 * u - hop, 66 * u, -24 * u - hop, 46 * u, -18 * u - hop]);
      circ(g, 36 * u, -30 * u - hop, 4 * u, '#111');
      ell(g, -6 * u, -6 * u - hop, 24 * u, 14 * u, '#fb8500', Math.sin(t * 16) * 0.4);
      g.save();
      g.translate(-42 * u, -hop);
      g.rotate(t * 6);
      g.fillStyle = '#c0c0c0';
      ell(g, 0, -12 * u, 6 * u, 10 * u, '#c0c0c0');
      ell(g, 0, 12 * u, 6 * u, 10 * u, '#c0c0c0');
      g.restore();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + t * 3;
        circ(g, Math.cos(a) * 14 * u, Math.sin(a) * 14 * u - hop, 3 * u, '#c58a4a');
      }
    } else if (e === 3) {
      // valve radio with music notes
      rr(g, -60 * u, -50 * u, 120 * u, 90 * u, 30 * u, '#8a5a32');
      rr(g, -48 * u, -36 * u, 64 * u, 54 * u, 20 * u, '#e9d8a6');
      g.strokeStyle = '#8a5a32';
      g.lineWidth = 2 * u;
      for (let i = 0; i < 5; i++) {
        g.beginPath();
        g.moveTo(-44 * u, -28 * u + i * 10 * u);
        g.lineTo(12 * u, -28 * u + i * 10 * u);
        g.stroke();
      }
      circ(g, 38 * u, -16 * u, 10 * u, '#ffd166');
      circ(g, 38 * u, 14 * u, 10 * u, '#ffd166');
      for (let i = 0; i < 3; i++) {
        const k = (t * 0.8 + i / 3) % 1;
        withA(g, 1 - k, () => text(g, i % 2 ? '♫' : '♪', -40 * u + i * 40 * u + Math.sin(k * 6) * 10 * u, -70 * u - k * 80 * u, 28 * u, '#ffd166'));
      }
    } else if (e === 4) {
      // smartphone glowing
      rr(g, -34 * u, -70 * u, 68 * u, 130 * u, 12 * u, '#111');
      const scr = g.createLinearGradient(0, -62 * u, 0, 52 * u);
      scr.addColorStop(0, '#ff006e');
      scr.addColorStop(0.5, '#8338ec');
      scr.addColorStop(1, '#3a86ff');
      g.fillStyle = scr;
      rrPath(g, -28 * u, -62 * u, 56 * u, 114 * u, 8 * u);
      g.fill();
      for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) rr(g, -21 * u + c * 16 * u, -50 * u + r * 18 * u, 11 * u, 11 * u, 3 * u, CONFETTI_COLORS[(r * 3 + c) % 6]);
      rr(g, -10 * u, -66 * u, 20 * u, 3 * u, 1.5 * u, '#333');
    } else {
      // hologram orb projecting a face/heart
      const fl = 0.75 + 0.25 * Math.sin(t * 25);
      rr(g, -30 * u, 40 * u, 60 * u, 12 * u, 6 * u, '#c6f7ff');
      withA(g, 0.35 * fl, () => poly(g, '#5ff6ff', [-24 * u, 40 * u, 24 * u, 40 * u, 60 * u, -80 * u, -60 * u, -80 * u]));
      withA(g, 0.8 * fl, () => {
        g.strokeStyle = '#aaffff';
        g.lineWidth = 2 * u;
        for (let i = 0; i < 3; i++) {
          g.beginPath();
          g.ellipse(0, -30 * u, 40 * u, 40 * u * Math.abs(Math.cos(t * 1.5 + i)), i, 0, TAU);
          g.stroke();
        }
        circ(g, 0, -30 * u, 14 * u, '#e8ffff');
      });
    }
    g.restore();
  }
  // the box (lid flips away)
  rr(g, bx - bw / 2, by, bw, bh, 4 * u, '#ff006e');
  g.fillStyle = '#ffd166';
  g.fillRect(bx - 8 * u, by, 16 * u, bh);
  g.save();
  g.translate(bx - bw / 2, by);
  g.rotate(-open * 2.2);
  rr(g, 0, -14 * u, bw, 14 * u, 3 * u, '#ff4d8d');
  g.fillStyle = '#ffd166';
  g.fillRect(bw / 2 - 8 * u, -14 * u, 16 * u, 14 * u);
  g.restore();
  // happy owner
  const ox = P ? L.w * 0.82 : B;
  const ch = t > 1.2;
  fig(g, ox, FY, FH, '#1d2233', { dir: -1, armF: ch ? Math.PI - 0.4 + Math.sin(t * 9) * 0.15 : 1.3, armB: ch ? Math.PI - 0.5 + Math.cos(t * 9) * 0.15 : 1.1, accent: '#06d6a0' });
  if (ch) text(g, 'NEW!', ox, FY - FH * 1.3, 30 * u, '#ffd166');
  const ps = particles(f.mem);
  if (t > 0.9 && once(f, 'burst')) for (let i = 0; i < 70; i++) spawn(ps, bx, by - 20 * u, f.rand.range(-300, 300) * u, f.rand.range(-460, -160) * u, 2.2, 12 * u, f.rand.pick(CONFETTI_COLORS), 0, 0, f.rand.range(-9, 9));
  stepParticles(ps, f.dt, 420 * u, 0.6);
  drawConfetti(g, ps);
});

const taxes = mk(3.4, (f) => {
  const { g, L, t, era } = f;
  const { u, FY, A, B, FH, P } = box(L);
  const e = EI[era];
  room(g, L, FY, '#6c757d', '#adb5bd', '#495057');
  // pile of forms growing on the left, more raining down
  const pile = Math.floor(span(t, 0, 2.8) * 14) + 4;
  for (let i = 0; i < pile; i++) paper(g, A + Math.sin(i * 2.7) * 14 * u, FY - 5 * u - i * 9 * u, (P ? 120 : 160) * u, 10 * u, Math.sin(i * 1.9) * 0.08, i % 3 ? '#fffdf4' : '#e9f5ff', '#fffdf4', 0);
  const ps = particles(f.mem);
  emit(f, 'f', 5, () => spawn(ps, A + f.rand.range(-100, 100) * u, -40 * u, f.rand.range(-20, 20) * u, f.rand.range(120, 200) * u, 3, f.rand.range(40, 60) * u, '#fffdf4', 0, f.rand.range(-0.4, 0.4), f.rand.range(-1.5, 1.5)), 20, ps);
  stepParticles(ps, f.dt);
  drawPs(g, ps, (p) => {
    paper(g, p.x, p.y, p.size, p.size * 1.3, p.rot ?? 0, '#fffdf4', '#9db0d0', 5);
    g.save();
    g.translate(p.x, p.y);
    g.rotate(p.rot ?? 0);
    text(g, 'TAX', 0, -p.size * 0.48, p.size * 0.22, '#d00000', false);
    g.restore();
  });
  // giant form in front
  const fw = (P ? 140 : 180) * u;
  const fh = fw * 1.3;
  const fy = FY - pile * 9 * u - fh / 2 - 6 * u;
  g.save();
  g.translate(A, fy);
  g.rotate(-0.05);
  rr(g, -fw / 2, -fh / 2, fw, fh, 4 * u, '#ffffff');
  g.fillStyle = '#d00000';
  g.fillRect(-fw / 2, -fh / 2, fw, fh * 0.16);
  text(g, e <= 2 ? 'TITHE' : 'TAX FORM', 0, -fh * 0.42, fh * 0.1, '#ffffff', false);
  for (let i = 0; i < 6; i++) {
    g.fillStyle = '#ced4da';
    g.fillRect(-fw * 0.4, -fh * 0.22 + i * fh * 0.1, fw * 0.5, fh * 0.03);
    g.strokeStyle = '#adb5bd';
    g.lineWidth = 1.5 * u;
    g.strokeRect(fw * 0.16, -fh * 0.25 + i * fh * 0.1, fw * 0.24, fh * 0.07);
  }
  g.restore();
  // sweating figure
  const sx = B - (P ? 20 : 70) * u;
  const s = fig(g, sx, FY, FH, '#3d405b', { dir: 1, armF: 2.6 + Math.sin(t * 7) * 0.1, armB: 2.6 + Math.cos(t * 7) * 0.1, accent: '#ffd166', nod: 0.3 });
  for (let i = 0; i < 3; i++) {
    const k = (t * 1.4 + i / 3) % 1;
    const side = i % 2 ? 1 : -1;
    withA(g, 1 - k, () => {
      const x = s.hx + side * (s.hr * 1.3 + k * 20 * u);
      const y = s.hy - s.hr * 0.5 + k * 30 * u;
      g.fillStyle = '#4cc9f0';
      g.beginPath();
      g.moveTo(x, y - 9 * u);
      g.quadraticCurveTo(x + 6 * u, y + 2 * u, x, y + 5 * u);
      g.quadraticCurveTo(x - 6 * u, y + 2 * u, x, y - 9 * u);
      g.fill();
    });
  }
  // calculator (abacus before industrial) with ticking digits
  const cx = B + (P ? 40 : 70) * u;
  const cyy = FY - 150 * u;
  if (e <= 2) {
    rr(g, cx - 50 * u, cyy - 60 * u, 100 * u, 120 * u, 4 * u, '#8a5a32');
    rr(g, cx - 42 * u, cyy - 52 * u, 84 * u, 104 * u, 2 * u, '#f1e2b8');
    for (let r = 0; r < 5; r++) {
      const y = cyy - 40 * u + r * 20 * u;
      ln(g, cx - 42 * u, y, cx + 42 * u, y, '#5a3418', 2 * u);
      for (let b = 0; b < 5; b++) {
        const slide = ((Math.floor(t * 4) + r * 3 + b) % 7 === 0 ? 1 : 0) * 10 * u;
        circ(g, cx - 34 * u + b * 10 * u + (b > 2 ? 20 * u : 0) + slide, y, 5 * u, ['#e63946', '#ffd166', '#06d6a0', '#4cc9f0', '#b388ff'][r]);
      }
    }
  } else {
    rr(g, cx - 50 * u, cyy - 70 * u, 100 * u, 140 * u, 12 * u, '#212529');
    rr(g, cx - 40 * u, cyy - 60 * u, 80 * u, 30 * u, 4 * u, '#b7e4c7');
    const val = Math.floor(span(t, 0.2, 2.6) * 98765);
    g.font = `800 ${16 * u}px ui-monospace, monospace`;
    g.textAlign = 'right';
    g.textBaseline = 'middle';
    g.fillStyle = '#1b4332';
    g.fillText('-' + val.toLocaleString('en-US'), cx + 36 * u, cyy - 45 * u);
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++) {
        const pressed = (Math.floor(t * 8) % 16) === r * 4 + c;
        rr(g, cx - 40 * u + c * 21 * u, cyy - 20 * u + r * 21 * u, 17 * u, 17 * u, 3 * u, pressed ? '#ffd166' : c === 3 ? '#ff9f1c' : '#495057');
      }
  }
});

// ================================================================== export

export const WORK_SCENE_DEFS: Record<WorkSceneId, SceneDef> = {
  office,
  meeting,
  interview,
  classroom,
  exam,
  library,
  lab,
  factory,
  farm,
  construction,
  surgery,
  stage,
  newsroom,
  startup,
  stocks,
  bribe,
  laundering,
  carChase,
  smuggling,
  gangMeeting,
  petCat,
  petHorse,
  petBird,
  vet,
  jewelry,
  luxury,
  gadget,
  taxes,
};
