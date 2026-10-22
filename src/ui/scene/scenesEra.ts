/**
 * Era scenes: health and old age, life moments, natural wonders, history, pageantry and the uncanny.
 *
 * Every scene is a short procedural animation drawn on the stage canvas behind the phone.
 * Conventions:
 *  - `mk()` wraps each draw in save/restore and multiplies the global alpha by the fade envelope,
 *    so helpers below only ever *multiply* globalAlpha (or restore a saved base).
 *  - Figures stand at L.slots[0] / L.slots[1] in landscape (~L.h*0.22 tall) and are centred in the
 *    top half in portrait (~L.h*0.18 tall). `U(L)` is the size unit for non-figure details.
 *  - Particle kinds: 0 dot, 1 streak, 2 confetti, 3 smoke puff (grows), 4 leaf/petal/feather, 5 glow orb.
 */
import type { EraLook, Layout, Particle, SceneDef, SceneFrame } from './kit';
import { CONFETTI_COLORS, clamp, easeIn, easeInOut, easeOut, glow, heart, lerp, makeRand, particles, person, sky, span, star, stepParticles } from './kit';
import type { EraSceneId } from './ids';

type G = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const ERA_I: Record<EraLook, number> = { ancient: 0, medieval: 1, early: 2, industrial: 3, modern: 4, future: 5 };
const before = (era: EraLook, e: EraLook) => ERA_I[era] < ERA_I[e];
const MAXP = 280;

// ================================================================== layout helpers

function U(L: Layout): number {
  if (L.portrait) return clamp(Math.min(L.w / 420, L.groundY / 480), 0.5, 1.6);
  const fw = Math.min(L.phone.x, L.w - L.phone.x - L.phone.w);
  return clamp(Math.min(fw / 520, L.h / 900), 0.45, 1.6);
}
/** Feet line; lifted a little in portrait so it stays clear of the dipped phone. */
const FY = (L: Layout, u: number) => (L.portrait ? L.groundY - 26 * u : L.groundY);
/** Figure height. */
const FH = (L: Layout) => L.h * (L.portrait ? 0.18 : 0.22);
/** Two action points: the slots beside the phone, or left/right of centre in portrait. */
function AB(L: Layout, pa = 0.32, pb = 0.74): [number, number] {
  return L.portrait ? [L.w * pa, L.w * pb] : [L.slots[0], L.slots[1]];
}
/** Main action x. */
const MX = (L: Layout) => (L.portrait ? L.w * 0.5 : L.slots[0]);
function hidden(L: Layout, x: number, m = 0): boolean {
  return !L.portrait && x > L.phone.x + m && x < L.phone.x + L.phone.w - m;
}
/** A random x somewhere visible. */
function visX(L: Layout, r: () => number, margin = 30): number {
  if (L.portrait) return margin + r() * (L.w - 2 * margin);
  const left = Math.max(10, L.phone.x - margin * 2);
  const right = Math.max(10, L.w - (L.phone.x + L.phone.w) - margin * 2);
  const v = r() * (left + right);
  return v < left ? margin + v : L.phone.x + L.phone.w + margin + (v - left);
}

// ================================================================== frame helpers

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
function once<T>(mem: Record<string, unknown>, key: string, make: () => T): T {
  if (!(key in mem)) mem[key] = make();
  return mem[key] as T;
}
function at(f: SceneFrame, key: string, tz: number): boolean {
  if (f.t >= tz && !f.mem[key]) {
    f.mem[key] = 1;
    return true;
  }
  return false;
}
function emit(f: SceneFrame, key: string, rate: number, fn: () => void): void {
  let acc = ((f.mem[key] as number | undefined) ?? 0) + rate * f.dt;
  while (acc >= 1) {
    fn();
    acc -= 1;
  }
  f.mem[key] = acc;
}
function P(x: number, y: number, vx: number, vy: number, max: number, size: number, color: string, kind = 0, rot = 0, vr = 0): Particle {
  return { x, y, vx, vy, life: 0, max, size, color, kind, rot, vr };
}
function add(ps: Particle[], p: Particle): void {
  if (ps.length < MAXP) ps.push(p);
}
function drawParts(g: G, ps: Particle[], alpha = 1): void {
  const base = g.globalAlpha;
  for (const p of ps) {
    const k = p.life / p.max;
    const fa = clamp(Math.min(1 - k, p.life * 6)) * alpha;
    if (fa <= 0.005) continue;
    g.globalAlpha = base * fa;
    switch (p.kind) {
      case 1:
        g.strokeStyle = p.color;
        g.lineWidth = p.size;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(p.x, p.y);
        g.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
        g.stroke();
        break;
      case 2:
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.rot ?? 0);
        g.fillStyle = p.color;
        g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        g.restore();
        break;
      case 3:
        g.globalAlpha = base * fa * 0.5;
        g.fillStyle = p.color;
        g.beginPath();
        g.arc(p.x, p.y, p.size * (1 + k * 1.5), 0, TAU);
        g.fill();
        break;
      case 4:
        g.save();
        g.translate(p.x + Math.sin(p.life * 2.6 + p.size) * 6, p.y);
        g.rotate(p.rot ?? 0);
        g.fillStyle = p.color;
        g.beginPath();
        g.ellipse(0, 0, p.size, p.size * 0.42, 0, 0, TAU);
        g.fill();
        g.restore();
        break;
      case 5:
        glow(g, p.x, p.y, p.size, p.color);
        break;
      default:
        g.fillStyle = p.color;
        g.beginPath();
        g.arc(p.x, p.y, p.size, 0, TAU);
        g.fill();
    }
  }
  g.globalAlpha = base;
}

// ================================================================== painting helpers

function fillA(g: G, color: string, alpha: number, fn: () => void): void {
  const base = g.globalAlpha;
  g.globalAlpha = base * clamp(alpha);
  g.fillStyle = color;
  g.beginPath();
  fn();
  g.fill();
  g.globalAlpha = base;
}
function wash(g: G, L: Layout, color: string, alpha: number): void {
  if (alpha <= 0) return;
  fillA(g, color, alpha, () => g.rect(0, 0, L.w, L.h));
}
function floor(g: G, L: Layout, y: number, color: string): void {
  g.fillStyle = color;
  g.fillRect(0, y, L.w, L.h - y);
}
function circ(g: G, x: number, y: number, r: number): void {
  g.moveTo(x + r, y);
  g.arc(x, y, Math.max(0, r), 0, TAU);
}
function line(g: G, x1: number, y1: number, x2: number, y2: number): void {
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
}
function ring(g: G, x: number, y: number, r: number, w: number, color: string, alpha: number): void {
  if (alpha <= 0 || r <= 0) return;
  const base = g.globalAlpha;
  g.globalAlpha = base * clamp(alpha);
  g.strokeStyle = color;
  g.lineWidth = w;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.stroke();
  g.globalAlpha = base;
}
function rrect(g: G, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}
/** Rolling hills silhouette from baseY. */
function hills(g: G, L: Layout, baseY: number, amp: number, color: string, seed: number, freq = 1): void {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(0, L.h);
  for (let x = 0; x <= L.w + 20; x += 20) {
    const y = baseY - amp * (0.5 + 0.3 * Math.sin((x / L.w) * 5 * freq + seed) + 0.2 * Math.sin((x / L.w) * 13 * freq + seed * 2.3));
    g.lineTo(x, y);
  }
  g.lineTo(L.w, L.h);
  g.closePath();
  g.fill();
}
/** Hand position of person(...,{pose:'wave'}) for a given phase. */
function waveHand(x: number, y: number, h: number, dir: number, phase: number): [number, number] {
  const ang = Math.PI - 0.5 + Math.sin(phase * 9) * 0.35;
  const sh = y - h * 0.74 + h * 0.03;
  return [x + dir * Math.sin(ang) * h * 0.3, sh + Math.cos(ang) * h * 0.3];
}
/** A seated figure. (x, y) is the floor under the hips; faces dir. */
function seated(g: G, x: number, y: number, h: number, col: string, dir = 1, hair?: string, armUp = 0): void {
  const hipY = y - h * 0.3;
  const sh = hipY - h * 0.33;
  const head = h * 0.13;
  g.save();
  g.strokeStyle = col;
  g.fillStyle = col;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.lineWidth = Math.max(2, h * 0.075);
  g.beginPath();
  g.moveTo(x, hipY);
  g.lineTo(x + dir * h * 0.2, hipY);
  g.lineTo(x + dir * h * 0.21, y);
  g.stroke();
  g.lineWidth = Math.max(3, h * 0.14);
  line(g, x, hipY, x, sh);
  g.lineWidth = Math.max(2, h * 0.075);
  g.beginPath();
  g.moveTo(x, sh + h * 0.03);
  g.lineTo(x + dir * h * (0.12 + armUp * 0.05), sh + h * (0.2 - armUp * 0.25));
  g.lineTo(x + dir * h * (0.2 + armUp * 0.05), hipY - h * (0.05 + armUp * 0.3));
  g.stroke();
  g.beginPath();
  circ(g, x + dir * h * 0.02, sh - head * 1.05, head);
  g.fill();
  if (hair) {
    g.fillStyle = hair;
    g.beginPath();
    g.arc(x + dir * h * 0.02, sh - head * 1.05, head * 1.08, Math.PI * 1.02, -0.02);
    g.fill();
  }
  g.restore();
}
/** An older figure: slight stoop, white hair and a cane. */
function elder(g: G, x: number, y: number, h: number, col: string, dir: 1 | -1, stoop = 0.12, hair = '#e6e6ea', cane = 1, phase = 0, walk = false): void {
  g.save();
  g.translate(x, y);
  g.rotate(dir * stoop);
  person(g, 0, 0, h, { color: col, dir, pose: walk ? 'walk' : 'stand', phase });
  const head = h * 0.13;
  const hy = -h * 0.74 - head * 1.05;
  g.fillStyle = hair;
  g.beginPath();
  g.arc(0, hy, head * 1.08, Math.PI * 1.05, -0.05);
  g.fill();
  g.restore();
  if (cane > 0) {
    const base = g.globalAlpha;
    g.globalAlpha = base * cane;
    g.strokeStyle = '#6b4a2e';
    g.lineWidth = Math.max(2, h * 0.035);
    g.lineCap = 'round';
    const cx = x + dir * h * 0.28;
    line(g, cx, y, cx - dir * h * 0.03, y - h * 0.5);
    g.beginPath();
    g.arc(cx - dir * h * 0.07, y - h * 0.5, h * 0.04, Math.PI, 0);
    g.stroke();
    g.globalAlpha = base;
  }
}
/** A horse silhouette. (x, y) is the ground under its middle; h ≈ height at the withers. */
function horse(g: G, x: number, y: number, h: number, dir: number, ph: number, col: string, cloth?: string, gait = 1): void {
  g.save();
  g.translate(x, y);
  g.scale(dir, 1);
  g.fillStyle = col;
  g.strokeStyle = col;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const by = -h * 0.66;
  g.lineWidth = h * 0.075;
  const legs: [number, number][] = [
    [-0.4, 0],
    [-0.3, 1.7],
    [0.34, 3.2],
    [0.44, 4.8],
  ];
  for (const [lx, off] of legs) {
    const s = Math.sin(ph * 9 * gait + off) * gait;
    const hx = lx * h;
    const hy = by + h * 0.1;
    const kx = hx + s * h * 0.14;
    const ky = hy + h * 0.28 - Math.max(0, s) * h * 0.04;
    g.beginPath();
    g.moveTo(hx, hy);
    g.lineTo(kx, ky);
    g.lineTo(kx + s * h * 0.06 - Math.abs(s) * h * 0.05, -Math.max(0, s) * h * 0.08);
    g.stroke();
  }
  g.beginPath();
  g.ellipse(0, by, h * 0.56, h * 0.22, 0, 0, TAU);
  g.moveTo(h * 0.28, by - h * 0.12);
  g.lineTo(h * 0.56, by - h * 0.6);
  g.lineTo(h * 0.72, by - h * 0.52);
  g.lineTo(h * 0.58, by + h * 0.04);
  g.closePath();
  g.fill();
  g.beginPath();
  g.ellipse(h * 0.74, by - h * 0.42, h * 0.19, h * 0.085, 0.75, 0, TAU);
  g.fill();
  g.beginPath();
  g.moveTo(h * 0.56, by - h * 0.62);
  g.lineTo(h * 0.6, by - h * 0.76);
  g.lineTo(h * 0.65, by - h * 0.6);
  g.fill();
  g.lineWidth = h * 0.09;
  g.beginPath();
  g.moveTo(-h * 0.52, by - h * 0.08);
  g.quadraticCurveTo(-h * 0.78 - Math.sin(ph * 6) * h * 0.05, by + h * 0.05, -h * 0.72, by + h * 0.38);
  g.stroke();
  if (cloth) {
    g.fillStyle = cloth;
    g.beginPath();
    g.moveTo(-h * 0.5, by - h * 0.12);
    g.lineTo(h * 0.45, by - h * 0.12);
    g.lineTo(h * 0.5, by + h * 0.34);
    for (let i = 0; i <= 6; i++) g.lineTo(h * (0.5 - i * 0.17), by + h * (i % 2 ? 0.28 : 0.36));
    g.closePath();
    g.fill();
  }
  g.restore();
}
/** Bare tree silhouette (deterministic). */
function tree(g: G, x: number, y: number, h: number, col: string, seed: number, sway = 0): void {
  const r = makeRand(seed);
  g.save();
  g.strokeStyle = col;
  g.lineCap = 'round';
  const br = (bx: number, by: number, len: number, ang: number, w: number, d: number) => {
    const ex = bx + Math.cos(ang) * len;
    const ey = by + Math.sin(ang) * len;
    g.lineWidth = w;
    line(g, bx, by, ex, ey);
    if (d <= 0) return;
    const n = 2;
    for (let i = 0; i < n; i++) br(ex, ey, len * (0.62 + r() * 0.15), ang + (i - 0.5) * (0.7 + r() * 0.4) + sway * (4 - d) * 0.02, w * 0.62, d - 1);
  };
  br(x, y, h * 0.38, -Math.PI / 2, h * 0.07, 4);
  g.restore();
}
function steam(f: SceneFrame, ps: Particle[], key: string, x: number, y: number, u: number, rate = 6): void {
  emit(f, key, rate, () => add(ps, P(x + (f.rand() - 0.5) * 10 * u, y, (f.rand() - 0.5) * 10 * u, -(24 + f.rand() * 14) * u, 1.5, 5 * u, 'rgba(255,255,255,0.75)', 3)));
}
function bowl(g: G, x: number, y: number, r: number, col: string, fill?: string): void {
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(x - r, y - r * 0.55);
  g.lineTo(x + r, y - r * 0.55);
  g.quadraticCurveTo(x + r * 0.95, y, x + r * 0.35, y);
  g.lineTo(x - r * 0.35, y);
  g.quadraticCurveTo(x - r * 0.95, y, x - r, y - r * 0.55);
  g.fill();
  if (fill) {
    g.fillStyle = fill;
    g.beginPath();
    g.ellipse(x, y - r * 0.55, r * 0.92, r * 0.16, 0, 0, TAU);
    g.fill();
  }
}

// ================================================================== SICK

const sick = mk(3.8, (f) => {
  const { g, L, t, era } = f;
  const u = U(L);
  const fy = FY(L, u);
  const fh = FH(L);
  const old = before(era, 'industrial');
  const ps = particles(f.mem);
  sky(g, L, old ? ['#22172a', '#3a2834', '#55392f'] : ['#151c36', '#222f55', '#364473']);
  floor(g, L, fy, old ? '#2e2119' : '#1e2238');
  const ax = L.portrait ? L.w * 0.38 : L.slots[0];
  const bx = L.portrait ? L.w * 0.84 : L.slots[1];
  const s2 = L.portrait ? 0.78 : 1;
  const bw = fh * (L.portrait ? 1.05 : 1.3);
  const x0 = ax - bw / 2;
  const mY = fy - fh * 0.3;
  // window with the moon
  const wx = ax - fh * 0.15;
  const wy = fy - fh * 1.25;
  const ww = fh * 0.5;
  glow(g, wx + ww / 2, wy + ww / 2, ww * 1.2, old ? 'rgba(255,220,160,0.35)' : 'rgba(170,200,255,0.35)');
  g.fillStyle = old ? '#3c2f40' : '#24335e';
  g.fillRect(wx, wy, ww, ww);
  g.fillStyle = '#f4ecd0';
  g.beginPath();
  circ(g, wx + ww * 0.62, wy + ww * 0.38, ww * 0.16);
  g.fill();
  g.fillStyle = old ? '#3c2f40' : '#24335e';
  g.beginPath();
  circ(g, wx + ww * 0.55, wy + ww * 0.34, ww * 0.14);
  g.fill();
  g.strokeStyle = old ? '#1d1418' : '#121a33';
  g.lineWidth = 4 * u;
  g.strokeRect(wx, wy, ww, ww);
  line(g, wx + ww / 2, wy, wx + ww / 2, wy + ww);
  line(g, wx, wy + ww / 2, wx + ww, wy + ww / 2);
  // bed
  const wood = old ? '#4a3021' : '#2b3150';
  g.fillStyle = wood;
  g.fillRect(x0, mY, bw, fh * 0.1);
  g.fillRect(x0, mY, fh * 0.04, fy - mY);
  g.fillRect(x0 + bw - fh * 0.06, fy - fh * 0.62, fh * 0.06, fh * 0.62);
  g.beginPath();
  g.arc(x0 + bw - fh * 0.03, fy - fh * 0.62, fh * 0.03, Math.PI, 0);
  g.fill();
  g.fillRect(x0 - fh * 0.01, fy - fh * 0.42, fh * 0.05, fh * 0.42);
  g.fillStyle = '#dcd5c6';
  g.fillRect(x0 + fh * 0.04, mY - fh * 0.05, bw - fh * 0.1, fh * 0.06);
  const hx = x0 + bw - fh * 0.2;
  const hy = mY - fh * 0.15;
  g.fillStyle = '#f2eee6';
  g.beginPath();
  g.ellipse(hx + fh * 0.02, mY - fh * 0.1, fh * 0.14, fh * 0.065, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#2a2230';
  g.beginPath();
  circ(g, hx, hy, fh * 0.075);
  g.fill();
  const breathe = Math.sin(t * 2.4) * fh * 0.012;
  g.fillStyle = old ? '#7d5a44' : '#7d6bb0';
  g.beginPath();
  g.moveTo(x0 + fh * 0.04, mY - fh * 0.04);
  g.quadraticCurveTo(x0 + fh * 0.06, mY - fh * 0.16, x0 + fh * 0.18, mY - fh * 0.15);
  g.quadraticCurveTo(x0 + bw * 0.45, mY - fh * 0.13 - breathe, hx - fh * 0.12, mY - fh * 0.2 - breathe);
  g.lineTo(hx - fh * 0.07, mY - fh * 0.06);
  g.lineTo(hx - fh * 0.07, mY + fh * 0.02);
  g.lineTo(x0 + fh * 0.04, mY + fh * 0.02);
  g.closePath();
  g.fill();
  g.strokeStyle = old ? '#a07a5a' : '#a497d6';
  g.lineWidth = 2 * u;
  for (let i = 1; i < 4; i++) line(g, x0 + (bw * i) / 4.4, mY - fh * 0.12, x0 + (bw * i) / 4.4, mY + fh * 0.01);
  // fever: a cool cloth (old) or thermometer (newer)
  const fever = 1 - span(t, 2.4, 3.4);
  if (old) {
    g.fillStyle = '#efe9dc';
    g.fillRect(hx - fh * 0.06, hy - fh * 0.085, fh * 0.12, fh * 0.035);
  } else {
    const tx1 = hx - fh * 0.04;
    const ty1 = hy + fh * 0.02;
    const tx2 = tx1 - fh * 0.16;
    const ty2 = ty1 - fh * 0.12;
    g.strokeStyle = '#f4f6fa';
    g.lineWidth = 5 * u;
    g.lineCap = 'round';
    line(g, tx1, ty1, tx2, ty2);
    g.strokeStyle = '#e8413c';
    g.lineWidth = 2.4 * u;
    const m = 0.2 + 0.75 * span(t, 0.4, 2.0) * (0.6 + 0.4 * fever);
    line(g, tx1, ty1, lerp(tx1, tx2, m), lerp(ty1, ty2, m));
    glow(g, lerp(tx1, tx2, m), lerp(ty1, ty2, m), 12 * u, 'rgba(255,90,70,0.8)', fever);
  }
  // fever squiggles
  g.strokeStyle = '#ff9d7a';
  g.lineWidth = 2.5 * u;
  for (let i = 0; i < 3; i++) {
    const k = (t * 0.6 + i / 3) % 1;
    const base = g.globalAlpha;
    g.globalAlpha = base * Math.sin(k * Math.PI) * fever * 0.9;
    g.beginPath();
    for (let j = 0; j <= 8; j++) {
      const yy = hy - fh * 0.12 - k * fh * 0.35 - j * 3 * u;
      g.lineTo(hx + (i - 1) * fh * 0.07 + Math.sin(j * 1.3 + t * 5) * 3 * u, yy);
    }
    g.stroke();
    g.globalAlpha = base;
  }
  // bedside table: soup + tissues (or a candle and herbs)
  const tx = x0 + bw + fh * 0.16;
  const tt = fy - fh * 0.34;
  g.fillStyle = wood;
  g.fillRect(tx - fh * 0.12, tt, fh * 0.24, fh * 0.04);
  g.fillRect(tx - fh * 0.1, tt, fh * 0.03, fy - tt);
  g.fillRect(tx + fh * 0.07, tt, fh * 0.03, fy - tt);
  bowl(g, tx - fh * 0.04, tt, fh * 0.07, old ? '#8a6a4a' : '#e9e2d6', '#e3a64a');
  steam(f, ps, 'st', tx - fh * 0.04, tt - fh * 0.06, u, 5);
  if (old) {
    g.fillStyle = '#efe2c0';
    g.fillRect(tx + fh * 0.05, tt - fh * 0.1, fh * 0.03, fh * 0.1);
    glow(g, tx + fh * 0.065, tt - fh * 0.13, fh * 0.2 * (1 + Math.sin(t * 13) * 0.06), 'rgba(255,200,110,0.8)');
    g.fillStyle = '#ffd27a';
    g.beginPath();
    g.ellipse(tx + fh * 0.065, tt - fh * 0.125, 2.5 * u, 6 * u, 0, 0, TAU);
    g.fill();
  } else {
    g.fillStyle = '#5ab0d8';
    g.fillRect(tx + fh * 0.02, tt - fh * 0.07, fh * 0.09, fh * 0.07);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(tx + fh * 0.04, tt - fh * 0.07);
    g.quadraticCurveTo(tx + fh * 0.065, tt - fh * 0.16 - Math.sin(t * 3) * 2 * u, tx + fh * 0.09, tt - fh * 0.07);
    g.fill();
  }
  // carer at the second slot
  const ch = fh * s2;
  if (old) {
    const ph = t * 0.15;
    person(g, bx, fy, ch, { color: '#2b2219', dress: true, accent: '#5b4a2e', hat: 'hood', pose: 'wave', phase: ph, dir: -1 });
    const [hx2, hy2] = waveHand(bx, fy, ch, -1, ph);
    g.strokeStyle = '#7a5a30';
    g.lineWidth = 2.5 * u;
    for (let i = -1; i <= 1; i++) line(g, hx2, hy2, hx2 + i * 6 * u, hy2 - ch * 0.16);
    g.fillStyle = '#6fae4f';
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.ellipse(hx2 + ((i % 3) - 1) * 7 * u, hy2 - ch * (0.1 + 0.03 * Math.floor(i / 3)), 6 * u, 3 * u, (i - 2.5) * 0.5, 0, TAU);
      g.fill();
    }
    glow(g, hx2, hy2 - ch * 0.12, ch * 0.3, 'rgba(160,230,120,0.45)');
    emit(f, 'hb', 5, () => add(ps, P(hx2, hy2 - ch * 0.12, (f.rand() - 0.7) * 40 * u, -(10 + f.rand() * 20) * u, 2, (3 + f.rand() * 2) * u, f.rand.pick(['#8fd16a', '#c3e88a']), 4, f.rand() * TAU, 1.5)));
  } else {
    const wx2 = bx + (1 - easeOut(t / 1.6)) * fh * 0.6;
    const walking = t < 1.5;
    glow(g, wx2, fy - ch * 0.6, ch * 0.9, 'rgba(255,210,150,0.35)');
    person(g, wx2, fy, ch, { color: '#3a4470', pose: walking ? 'walk' : 'hold', phase: t, dir: -1, accent: '#7fd1c7' });
    if (!walking) {
      g.fillStyle = '#c9c2b3';
      g.fillRect(wx2 - ch * 0.32, fy - ch * 0.66, ch * 0.64, ch * 0.03);
      bowl(g, wx2, fy - ch * 0.66, ch * 0.08, '#f2ede4', '#e8b04f');
      steam(f, ps, 'st2', wx2, fy - ch * 0.72, u, 4);
    }
  }
  stepParticles(ps, f.dt, 0);
  drawParts(g, ps);
});

// ================================================================== DENTIST

function tooth(g: G, x: number, y: number, s: number): void {
  g.beginPath();
  g.moveTo(x - s * 0.5, y - s * 0.1);
  g.bezierCurveTo(x - s * 0.55, y - s * 0.58, x - s * 0.15, y - s * 0.62, x, y - s * 0.45);
  g.bezierCurveTo(x + s * 0.15, y - s * 0.62, x + s * 0.55, y - s * 0.58, x + s * 0.5, y - s * 0.1);
  g.bezierCurveTo(x + s * 0.48, y + s * 0.2, x + s * 0.4, y + s * 0.35, x + s * 0.32, y + s * 0.75);
  g.quadraticCurveTo(x + s * 0.22, y + s * 0.84, x + s * 0.16, y + s * 0.6);
  g.quadraticCurveTo(x, y + s * 0.22, x - s * 0.16, y + s * 0.6);
  g.quadraticCurveTo(x - s * 0.22, y + s * 0.84, x - s * 0.32, y + s * 0.75);
  g.bezierCurveTo(x - s * 0.4, y + s * 0.35, x - s * 0.48, y + s * 0.2, x - s * 0.5, y - s * 0.1);
  g.closePath();
}

const dentist = mk(3.4, (f) => {
  const { g, L, t, era } = f;
  const u = U(L);
  const fy = FY(L, u);
  const fh = FH(L);
  const old = before(era, 'industrial');
  const ps = particles(f.mem);
  sky(g, L, old ? ['#3a2e2a', '#5a463a', '#7a604a'] : ['#cdeeed', '#a7dcdc', '#7fc3c6']);
  floor(g, L, fy, old ? '#3a2a20' : '#5c9ea3');
  const [ax, bx] = AB(L, 0.3, 0.72);
  const s = L.portrait ? 0.85 : 1;
  const h = fh * s;
  // chair
  const cx = ax;
  const col = old ? '#4a3021' : '#2f4a66';
  g.fillStyle = col;
  g.fillRect(cx - h * 0.05, fy - h * 0.28, h * 0.1, h * 0.28);
  g.fillRect(cx - h * 0.2, fy - h * 0.03, h * 0.4, h * 0.03);
  g.save();
  g.translate(cx, fy - h * 0.3);
  g.fillStyle = old ? '#6a4630' : '#3d7fa6';
  g.beginPath();
  rrect(g, -h * 0.28, -h * 0.06, h * 0.5, h * 0.08, h * 0.03);
  g.fill();
  g.rotate(-0.55);
  g.beginPath();
  rrect(g, -h * 0.62, -h * 0.07, h * 0.36, h * 0.08, h * 0.03);
  g.fill();
  g.restore();
  // reclining patient
  g.strokeStyle = '#1e2433';
  g.fillStyle = '#1e2433';
  g.lineCap = 'round';
  g.lineWidth = h * 0.08;
  const hipX = cx - h * 0.18;
  const hipY = fy - h * 0.38;
  g.beginPath();
  g.moveTo(hipX - h * 0.32, hipY - h * 0.2);
  g.lineTo(hipX, hipY);
  g.lineTo(cx + h * 0.2, hipY + h * 0.01);
  g.lineTo(cx + h * 0.32, fy - h * 0.15);
  g.stroke();
  g.beginPath();
  circ(g, hipX - h * 0.42, hipY - h * 0.28, h * 0.075);
  g.fill();
  // lamp
  const lx = cx - h * 0.25;
  const ly = fy - h * 0.95;
  if (old) {
    g.fillStyle = '#efe2c0';
    g.fillRect(lx - 3 * u, ly, 6 * u, 18 * u);
    glow(g, lx, ly - 4 * u, h * 0.35, 'rgba(255,200,110,0.7)');
  } else {
    g.strokeStyle = '#26394f';
    g.lineWidth = 4 * u;
    line(g, cx + h * 0.15, fy - h * 0.3, cx + h * 0.15, ly - h * 0.1);
    line(g, cx + h * 0.15, ly - h * 0.1, lx, ly);
    g.fillStyle = '#26394f';
    g.beginPath();
    g.arc(lx, ly, h * 0.07, 0, Math.PI);
    g.fill();
    glow(g, lx, ly + h * 0.05, h * 0.45, 'rgba(255,255,230,0.6)', 0.7 + 0.3 * Math.sin(t * 2));
  }
  // dentist with a tool
  const dx = cx - h * 0.7;
  if (!L.portrait || L.w > 0) {
    const ph = 0.05 + Math.sin(t * 2) * 0.02;
    person(g, dx, fy, h, { color: old ? '#2a2119' : '#f2f6fa', pose: 'wave', phase: ph, dir: 1, accent: '#5aa0c8' });
    const [tx, ty] = waveHand(dx, fy, h, 1, ph);
    g.strokeStyle = '#9aa4b0';
    g.lineWidth = 2.5 * u;
    line(g, tx, ty, tx + h * 0.12, ty + h * 0.06);
  }
  // giant tooth with grime that is brushed away
  const ts = (L.portrait ? 0.55 : 0.8) * fh;
  const tX = bx;
  const tY = fy - (L.portrait ? fh * 1.1 : fh * 1.05) + Math.sin(t * 2) * 5 * u;
  const clean = span(t, 0.7, 2.1);
  glow(g, tX, tY, ts * (1.1 + clean * 0.5), 'rgba(255,255,255,0.55)', 0.4 + clean * 0.6);
  g.fillStyle = '#ffffff';
  g.strokeStyle = '#9cc3cc';
  g.lineWidth = 4 * u;
  tooth(g, tX, tY, ts);
  g.fill();
  g.stroke();
  const spots: [number, number, number][] = [
    [-0.25, -0.25, 0.1],
    [0.18, -0.3, 0.08],
    [0.05, -0.05, 0.12],
    [-0.3, 0.15, 0.07],
    [0.3, 0.05, 0.09],
  ];
  const brushX = tX + Math.sin(t * 14) * ts * 0.4;
  spots.forEach(([sx, sy, sr], i) => {
    const gone = clamp((t - 0.8 - i * 0.22) / 0.35);
    fillA(g, '#c9a64a', (1 - gone) * 0.85, () => circ(g, tX + sx * ts, tY + sy * ts, sr * ts));
  });
  if (t > 0.6 && t < 2.3) {
    const by = tY - ts * 0.2 + Math.sin(t * 4) * ts * 0.15;
    g.fillStyle = '#4fc3f7';
    g.beginPath();
    rrect(g, brushX - ts * 0.05, by - ts * 0.62, ts * 0.1, ts * 0.55, ts * 0.04);
    g.fill();
    g.fillStyle = '#f5f5f5';
    g.fillRect(brushX - ts * 0.09, by - ts * 0.1, ts * 0.18, ts * 0.12);
    emit(f, 'bub', 30, () => add(ps, P(brushX + (f.rand() - 0.5) * ts * 0.3, by, (f.rand() - 0.5) * 120 * u, -(f.rand() * 100 + 30) * u, 0.8, (2 + f.rand() * 5) * u, 'rgba(230,250,255,0.9)', 0)));
  }
  if (t > 2.1) {
    const k = t - 2.1;
    star(g, tX + ts * 0.32, tY - ts * 0.35, ts * 0.16 * Math.sin(clamp(k / 0.6) * Math.PI), '#ffffff', k * 2);
    star(g, tX - ts * 0.3, tY + ts * 0.1, ts * 0.1 * Math.sin(clamp((k - 0.25) / 0.6) * Math.PI), '#ffffff', -k * 2);
    star(g, tX + ts * 0.6, tY + ts * 0.3, ts * 0.08 * Math.sin(clamp((k - 0.45) / 0.6) * Math.PI), '#fff8c0', k);
    const base = g.globalAlpha;
    g.globalAlpha = base * clamp(1 - Math.abs(k - 0.4) / 0.4) * 0.8;
    g.strokeStyle = '#ffffff';
    g.lineWidth = ts * 0.06;
    line(g, tX - ts * 0.35 + k * ts * 0.3, tY - ts * 0.4, tX - ts * 0.45 + k * ts * 0.3, tY + ts * 0.1);
    g.globalAlpha = base;
  }
  stepParticles(ps, f.dt, 300 * u);
  drawParts(g, ps);
});

// ================================================================== CHECKUP

const checkup = mk(3.6, (f) => {
  const { g, L, t, era } = f;
  const u = U(L);
  const fy = FY(L, u);
  const fh = FH(L);
  const old = before(era, 'industrial');
  const ps = particles(f.mem);
  sky(g, L, old ? ['#2e2620', '#4d3d2c', '#6b5538'] : ['#17324a', '#24506e', '#3b7090']);
  floor(g, L, fy, old ? '#2c2018' : '#173040');
  const [ax, bx] = AB(L, 0.3, 0.74);
  const h = fh * (L.portrait ? 0.9 : 1);
  const dx = ax - h * 0.25;
  const px = ax + h * 0.38;
  // patient on a stool
  g.fillStyle = old ? '#4a3021' : '#4a6a80';
  g.fillRect(px - h * 0.12, fy - h * 0.3, h * 0.24, h * 0.04);
  g.fillRect(px - h * 0.1, fy - h * 0.3, h * 0.03, h * 0.3);
  g.fillRect(px + h * 0.07, fy - h * 0.3, h * 0.03, h * 0.3);
  seated(g, px, fy, h, '#1a1f2e', -1);
  if (old) {
    const ph = 0.04 + Math.sin(t * 1.7) * 0.03;
    person(g, dx, fy, h, { color: '#2b2219', dress: true, accent: '#4f5a33', hat: 'hood', pose: 'wave', phase: ph, dir: 1 });
    const [hx, hy] = waveHand(dx, fy, h, 1, ph);
    g.strokeStyle = '#7a5a30';
    g.lineWidth = 2.5 * u;
    for (let i = -1; i <= 1; i++) line(g, hx, hy, hx + i * 5 * u, hy - h * 0.15);
    g.fillStyle = '#7cc35a';
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.ellipse(hx + ((i % 3) - 1) * 6 * u, hy - h * (0.1 + 0.035 * Math.floor(i / 3)), 6 * u, 3 * u, (i - 2.5) * 0.5, 0, TAU);
      g.fill();
    }
    emit(f, 'hb', 6, () => add(ps, P(hx, hy - h * 0.12, (f.rand() * 30 + 10) * u, -(10 + f.rand() * 20) * u, 2, (3 + f.rand() * 2) * u, f.rand.pick(['#8fd16a', '#c3e88a']), 4, f.rand() * TAU, 1.5)));
    // mortar and pestle on a stand
    const mx = dx - h * 0.35;
    g.fillStyle = '#3d2a1c';
    g.fillRect(mx - h * 0.02, fy - h * 0.4, h * 0.04, h * 0.4);
    bowl(g, mx, fy - h * 0.4, h * 0.09, '#8d8d86', '#6aa24c');
    g.strokeStyle = '#a5a59c';
    g.lineWidth = 5 * u;
    line(g, mx + h * 0.02, fy - h * 0.48, mx + h * 0.08 + Math.sin(t * 6) * 3 * u, fy - h * 0.6);
  } else {
    const ph = 0;
    person(g, dx, fy, h, { color: '#eef3f8', pose: 'wave', phase: ph, dir: 1 });
    const [hx, hy] = waveHand(dx, fy, h, 1, ph);
    // stethoscope
    const head = h * 0.13;
    const sh = fy - h * 0.74;
    g.strokeStyle = '#26323f';
    g.lineWidth = 3 * u;
    g.beginPath();
    g.moveTo(dx - head * 0.8, sh - head * 0.2);
    g.quadraticCurveTo(dx, sh + h * 0.16, dx + head * 0.8, sh - head * 0.2);
    g.stroke();
    g.beginPath();
    g.moveTo(dx, sh + h * 0.11);
    g.quadraticCurveTo(dx + h * 0.1, sh + h * 0.3, dx + h * 0.06, sh + h * 0.36);
    g.stroke();
    g.fillStyle = '#9aa7b4';
    g.beginPath();
    circ(g, dx + h * 0.06, sh + h * 0.37, 5 * u);
    g.fill();
    // clipboard in raised hand
    g.fillStyle = '#8a5a34';
    g.fillRect(hx - h * 0.02, hy - h * 0.2, h * 0.16, h * 0.21);
    g.fillStyle = '#ffffff';
    g.fillRect(hx + h * 0.0, hy - h * 0.18, h * 0.12, h * 0.17);
    g.strokeStyle = '#7aa0c0';
    g.lineWidth = 1.5 * u;
    for (let i = 0; i < 4; i++) line(g, hx + h * 0.015, hy - h * (0.15 - i * 0.035), hx + h * (0.1 - (i % 2) * 0.03), hy - h * (0.15 - i * 0.035));
  }
  // heart and pulse line
  const hy = fy - (L.portrait ? fh * 1.55 : fh * 1.35);
  const hr = (L.portrait ? 0.16 : 0.22) * fh;
  const beat = t % 0.85;
  const sc = 1 + 0.14 * Math.exp(-beat * 9) + 0.08 * Math.exp(-Math.max(0, beat - 0.18) * 9) * (beat > 0.18 ? 1 : 0);
  const hX = L.portrait ? L.w * 0.5 : bx;
  glow(g, hX, hy, hr * 3 * sc, 'rgba(255,90,110,0.55)');
  heart(g, hX, hy, hr * sc, '#ff4d6a');
  heart(g, hX - hr * 0.3, hy - hr * 0.35, hr * 0.22 * sc, 'rgba(255,255,255,0.55)');
  if (!old) {
    const w = L.portrait ? L.w * 0.8 : Math.min(L.w - L.phone.x - L.phone.w - 40 * u, fh * 2.2);
    const x0 = hX - w / 2;
    const ly = hy + hr * 1.9;
    const rev = clamp(t / 2.4);
    g.strokeStyle = '#6dffb0';
    g.lineWidth = 3 * u;
    g.lineJoin = 'round';
    g.beginPath();
    const N = 80;
    let ex = x0;
    let ey = ly;
    for (let i = 0; i <= N * rev; i++) {
      const xx = x0 + (i / N) * w;
      const ph = ((i / N) * 3) % 1;
      let yy = ly;
      if (ph > 0.42 && ph < 0.46) yy = ly - hr * 0.3;
      else if (ph >= 0.46 && ph < 0.5) yy = ly + hr * 0.9;
      else if (ph >= 0.5 && ph < 0.54) yy = ly - hr * 1.2;
      else if (ph >= 0.54 && ph < 0.58) yy = ly + hr * 0.3;
      g.lineTo(xx, yy);
      ex = xx;
      ey = yy;
    }
    g.stroke();
    glow(g, ex, ey, 14 * u, 'rgba(120,255,180,0.9)');
  }
  if (t > 2.6) {
    const k = easeOut((t - 2.6) / 0.4);
    const cx = hX + hr * 1.6;
    const cy = hy - hr * 1.1;
    g.fillStyle = '#2ecc71';
    g.beginPath();
    circ(g, cx, cy, hr * 0.45 * k);
    g.fill();
    g.strokeStyle = '#ffffff';
    g.lineWidth = 4 * u;
    g.beginPath();
    g.moveTo(cx - hr * 0.2 * k, cy);
    g.lineTo(cx - hr * 0.04 * k, cy + hr * 0.16 * k);
    g.lineTo(cx + hr * 0.22 * k, cy - hr * 0.14 * k);
    g.stroke();
  }
  stepParticles(ps, f.dt, 0);
  drawParts(g, ps);
});

// ================================================================== REHAB

const rehab = mk(3.8, (f) => {
  const { g, L, t } = f;
  const u = U(L);
  const fy = FY(L, u);
  const fh = FH(L);
  const ps = particles(f.mem);
  const k = span(t, 0, 3.4);
  sky(g, L, ['#1f2350', '#5b4a8a', '#e88a6a', '#ffd59a']);
  const cx = MX(L);
  const sunX = L.portrait ? L.w * 0.5 : L.slots[0];
  const sunY = lerp(fy + fh * 0.2, fy - fh * 0.75, easeOut(k));
  const R = fh * 0.4;
  glow(g, sunX, sunY, R * 5, 'rgba(255,200,120,0.6)');
  g.save();
  g.translate(sunX, sunY);
  g.rotate(t * 0.15);
  g.fillStyle = 'rgba(255,230,160,0.25)';
  for (let i = 0; i < 12; i++) {
    g.rotate(TAU / 12);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(R * 4, -R * 0.25);
    g.lineTo(R * 4, R * 0.25);
    g.fill();
  }
  g.restore();
  g.fillStyle = '#ffe3a0';
  g.beginPath();
  circ(g, sunX, sunY, R);
  g.fill();
  hills(g, L, fy + 4 * u, fh * 0.25, '#4a3a5c', 1.3);
  floor(g, L, fy, '#3a2c4a');
  // circle of chairs with seated people
  const rx = fh * (L.portrait ? 0.7 : 0.85);
  const ry = fh * 0.16;
  const N = 6;
  const seats: { x: number; y: number; d: number; dir: 1 | -1 }[] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU + 0.3;
    seats.push({ x: cx + Math.cos(a) * rx, y: fy - fh * 0.05 + Math.sin(a) * ry, d: Math.sin(a), dir: Math.cos(a) > 0 ? -1 : 1 });
  }
  seats.sort((a, b) => a.d - b.d);
  const cols = ['#2a2440', '#33284a', '#2d2a46', '#3a2b4e', '#28304a', '#30284a'];
  seats.forEach((s, i) => {
    const sc = 0.72 + 0.18 * (s.d + 1) * 0.5;
    const h = fh * sc;
    g.fillStyle = '#5e4a6e';
    g.fillRect(s.x - s.dir * h * 0.06, s.y - h * 0.33, h * 0.04 * -s.dir || h * 0.04, h * 0.33);
    g.fillRect(s.x - h * 0.08, s.y - h * 0.3, h * 0.28 * s.dir, h * 0.035);
    const lift = i === 2 ? span(t, 1.4, 2.2) - span(t, 2.8, 3.4) : 0;
    seated(g, s.x, s.y, h, cols[i], s.dir, undefined, lift);
  });
  // supportive group: figures with linked arms, glowing where hands join
  const gX = L.portrait ? L.w * 0.5 : L.slots[1];
  const gh = fh * (L.portrait ? 0.62 : 1);
  const gY = L.portrait ? L.h * 0.27 : fy;
  const step = gh * 0.58;
  const gather = easeInOut(clamp((t - 0.2) / 1.3));
  const xs = [-1.5, -0.5, 0.5, 1.5].map((i) => gX + i * lerp(step * 1.5, step, gather));
  const gcols = ['#2c2448', '#3a2850', '#2a3050', '#352a4c'];
  xs.forEach((x, i) => person(g, x, gY, gh, { color: gcols[i], pose: gather > 0.98 ? 'hold' : 'walk', phase: t * 0.6 + i, dir: i < 2 ? 1 : -1, dress: i % 2 === 1, accent: '#4a3a62' }));
  if (gather > 0.98) {
    for (let i = 0; i < 3; i++) {
      const jx = (xs[i] + xs[i + 1]) / 2;
      const jy = gY - gh * 0.65;
      glow(g, jx, jy, gh * 0.22 * (1 + 0.15 * Math.sin(t * 5 + i)), 'rgba(255,225,160,0.95)', clamp((t - 1.5) / 0.4));
      if (at(f, 'j' + i, 1.6 + i * 0.25)) for (let k2 = 0; k2 < 4; k2++) add(ps, P(jx, jy, (f.rand() - 0.5) * 40 * u, -(40 + f.rand() * 40) * u, 2, (5 + f.rand() * 4) * u, '#ff8fa3', 6));
    }
  }
  stepParticles(ps, f.dt, 0);
  for (const p of ps) {
    const base = g.globalAlpha;
    g.globalAlpha = base * clamp(1 - p.life / p.max);
    heart(g, p.x + Math.sin(p.life * 3) * 6 * u, p.y, p.size, p.color);
    g.globalAlpha = base;
  }
});

// ================================================================== AGING

const aging = mk(4.2, (f) => {
  const { g, L, t } = f;
  const u = U(L);
  const fy = FY(L, u);
  const fh = FH(L);
  const ps = particles(f.mem);
  const k = span(t, 0.5, 3.4);
  sky(g, L, ['#3a2f55', '#9a5a6a', '#e09a5a']);
  wash(g, L, '#2a2a3a', k * 0.35);
  hills(g, L, fy + 4 * u, fh * 0.2, '#5a3a3a', 2.1);
  floor(g, L, fy, '#4a2e2a');
  const [ax, bx] = AB(L, 0.34, 0.74);
  // tree shedding leaves
  const tX = L.portrait ? L.w * 0.12 : ax - fh * 0.9;
  tree(g, tX, fy, fh * 1.6, '#2a1c1c', 11, Math.sin(t));
  emit(f, 'lf', 14, () =>
    add(ps, P(visX(L, f.rand), -10, (20 + f.rand() * 40) * u, (40 + f.rand() * 40) * u, 4, (5 + f.rand() * 4) * u, f.rand.pick(['#e07a2f', '#c94f2a', '#f2b33d', '#8a4a2a']), 4, f.rand() * TAU, (f.rand() - 0.5) * 4)),
  );
  // figure turning grey
  const h = fh * (L.portrait ? 0.95 : 1) * (1 - k * 0.06);
  const c = (a: number[], b: number[]) => `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], k))).join(',')})`;
  elder(g, ax, fy, h, c([29, 34, 51], [88, 92, 108]), 1, k * 0.16, c([74, 46, 26], [236, 236, 240]), clamp((k - 0.5) * 3));
  // spinning clock
  const cX = L.portrait ? L.w * 0.72 : bx;
  const cY = L.portrait ? L.h * 0.14 : fy - fh * 1.1;
  const R = fh * (L.portrait ? 0.32 : 0.45);
  glow(g, cX, cY, R * 1.8, 'rgba(255,230,190,0.45)');
  g.fillStyle = '#3a2a2a';
  g.beginPath();
  circ(g, cX, cY, R * 1.08);
  g.fill();
  g.fillStyle = '#f5ecd8';
  g.beginPath();
  circ(g, cX, cY, R);
  g.fill();
  g.strokeStyle = '#3a2a2a';
  g.lineCap = 'round';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    g.lineWidth = (i % 3 ? 2 : 4) * u;
    line(g, cX + Math.cos(a) * R * 0.8, cY + Math.sin(a) * R * 0.8, cX + Math.cos(a) * R * 0.92, cY + Math.sin(a) * R * 0.92);
  }
  const spin = t * t * 3.2;
  g.lineWidth = 6 * u;
  line(g, cX, cY, cX + Math.sin(spin / 12) * R * 0.5, cY - Math.cos(spin / 12) * R * 0.5);
  g.lineWidth = 3.5 * u;
  line(g, cX, cY, cX + Math.sin(spin) * R * 0.78, cY - Math.cos(spin) * R * 0.78);
  // motion trail of the minute hand
  const base = g.globalAlpha;
  g.globalAlpha = base * clamp(t / 2) * 0.25;
  g.fillStyle = '#c9a07a';
  g.beginPath();
  g.moveTo(cX, cY);
  g.arc(cX, cY, R * 0.78, spin - Math.PI / 2 - 1.2, spin - Math.PI / 2);
  g.fill();
  g.globalAlpha = base;
  g.fillStyle = '#3a2a2a';
  g.beginPath();
  circ(g, cX, cY, 5 * u);
  g.fill();
  stepParticles(ps, f.dt, 0);
  drawParts(g, ps);
});

// ================================================================== NURSING HOME

function wheelchair(g: G, x: number, y: number, h: number, ph: number): void {
  const R = h * 0.22;
  g.save();
  g.strokeStyle = '#3a4048';
  g.fillStyle = '#3a4048';
  g.lineWidth = Math.max(2, h * 0.025);
  g.beginPath();
  g.arc(x, y - R, R, 0, TAU);
  g.stroke();
  for (let i = 0; i < 4; i++) {
    const a = ph + (i * Math.PI) / 4;
    line(g, x - Math.cos(a) * R, y - R - Math.sin(a) * R, x + Math.cos(a) * R, y - R + Math.sin(a) * R);
  }
  g.beginPath();
  circ(g, x + h * 0.32, y - h * 0.05, h * 0.05);
  g.fill();
  g.lineWidth = Math.max(2, h * 0.04);
  line(g, x - h * 0.08, y - h * 0.3, x + h * 0.22, y - h * 0.3);
  line(g, x + h * 0.22, y - h * 0.3, x + h * 0.32, y - h * 0.08);
  line(g, x - h * 0.08, y - h * 0.3, x - h * 0.14, y - h * 0.68);
  line(g, x - h * 0.14, y - h * 0.68, x - h * 0.24, y - h * 0.68);
  g.restore();
}

const nursingHome = mk(4.0, (f) => {
  const { g, L, t, era } = f;
  const u = U(L);
  const fy = FY(L, u);
  const fh = FH(L);
  const ps = particles(f.mem);
  sky(g, L, ['#8ccbec', '#c4e6f2', '#eef0d6']);
  glow(g, L.w * 0.85, L.h * 0.12, fh * 1.2, 'rgba(255,250,210,0.9)');
  hills(g, L, fy - fh * 0.05, fh * 0.35, '#8cc47a', 0.7);
  // hedges
  g.fillStyle = '#5d9b52';
  for (let x = -20; x < L.w + 40; x += fh * 0.42) {
    g.beginPath();
    circ(g, x, fy - fh * 0.12, fh * 0.22);
    g.fill();
  }
  floor(g, L, fy, '#79b465');
  const fl = once(f.mem, 'fl', () => {
    const r = makeRand(5);
    return Array.from({ length: 40 }, () => [r(), r(), r.pick(['#ff7aa2', '#ffd54f', '#ffffff', '#b388ff'])] as [number, number, string]);
  });
  for (const [fx, fy2, c] of fl) {
    const x = fx * L.w;
    if (hidden(L, x)) continue;
    g.fillStyle = c;
    g.beginPath();
    circ(g, x, fy + 6 * u + fy2 * (L.h - fy) * 0.5, 4 * u);
    g.fill();
  }
  const [ax, bx] = AB(L, 0.27, 0.72);
  const h = fh * (L.portrait ? 0.85 : 1);
  // bench with an elder, another elder with a cane
  g.fillStyle = '#7a5232';
  g.fillRect(ax - h * 0.35, fy - h * 0.3, h * 0.6, h * 0.05);
  g.fillRect(ax - h * 0.35, fy - h * 0.55, h * 0.04, h * 0.3);
  g.fillRect(ax - h * 0.33, fy - h * 0.3, h * 0.03, h * 0.3);
  g.fillRect(ax + h * 0.2, fy - h * 0.3, h * 0.03, h * 0.3);
  seated(g, ax - h * 0.18, fy, h, '#3c4058', 1, '#eeeeee', 0.6 + Math.sin(t * 3) * 0.2);
  elder(g, ax + h * 0.5, fy, h, '#4a3a52', -1, 0.1, '#e8e8ec', 1);
  // nurse pushing a wheelchair
  const wx = bx - h * 0.1 + Math.sin(t * 0.8) * h * 0.2 - h * 0.1;
  const ph = (wx - bx) / (h * 0.22);
  wheelchair(g, wx, fy, h, ph);
  seated(g, wx + h * 0.02, fy - h * 0.05, h * 0.92, '#3a3550', 1, '#f0f0f0');
  person(g, wx - h * 0.4, fy, h, { color: before(era, 'industrial') ? '#3a4a6a' : '#4f86c6', dress: before(era, 'modern'), accent: '#ffffff', pose: 'walk', phase: t * 0.6, dir: 1 });
  g.strokeStyle = '#3a4048';
  g.lineWidth = Math.max(2, h * 0.05);
  line(g, wx - h * 0.3, fy - h * 0.58, wx - h * 0.22, fy - h * 0.66);
  // butterflies
  for (let i = 0; i < 3; i++) {
    const bxx = (L.portrait ? L.w * (0.25 + i * 0.25) : i < 2 ? ax + (i - 0.5) * h * 0.9 : bx + h * 0.4) + Math.sin(t * 1.3 + i * 2) * 25 * u;
    const byy = fy - h * (1.1 + 0.2 * i) + Math.sin(t * 2.1 + i) * 12 * u;
    const fl2 = Math.abs(Math.sin(t * 14 + i));
    g.fillStyle = ['#ff9ec4', '#ffd54f', '#b0a4ff'][i];
    g.beginPath();
    g.ellipse(bxx - 5 * u * fl2, byy, 6 * u * fl2, 8 * u, 0.3, 0, TAU);
    g.ellipse(bxx + 5 * u * fl2, byy, 6 * u * fl2, 8 * u, -0.3, 0, TAU);
    g.fill();
  }
  emit(f, 'pt', 4, () => add(ps, P(visX(L, f.rand), fy - fh * 1.6 * f.rand(), 15 * u, 12 * u, 3, 4 * u, '#ffc8dd', 4, f.rand() * TAU, 1)));
  stepParticles(ps, f.dt, 0);
  drawParts(g, ps);
});

// ================================================================== DEMENTIA

const dementia = mk(4.4, (f) => {
  const { g, L, t } = f;
  const u = U(L);
  const fy = FY(L, u);
  const fh = FH(L);
  sky(g, L, ['#5b5a78', '#8f8aa6', '#c7c0cc']);
  floor(g, L, fy, '#6d6680');
  const ax = L.portrait ? L.w * 0.3 : L.slots[0] - fh * 0.3;
  const h = fh * (L.portrait ? 0.9 : 1);
  // armchair and seated elder, still and calm
  g.fillStyle = '#4a3f5a';
  g.beginPath();
  rrect(g, ax - h * 0.22, fy - h * 0.7, h * 0.18, h * 0.7, h * 0.06);
  rrect(g, ax - h * 0.2, fy - h * 0.34, h * 0.5, h * 0.12, h * 0.04);
  g.fill();
  seated(g, ax, fy - h * 0.05, h, '#2b2840', 1, '#eceaf0', 0.2);
  // photographs drifting into fog
  const photos = once(f.mem, 'ph', () => {
    const r = makeRand(31);
    return [0, 1, 2, 3, 4].map((i) => {
      const tx = L.portrait ? L.w * (0.2 + r() * 0.6) : i % 2 ? L.slots[1] + (r() - 0.5) * 200 * U(L) : L.slots[0] + (r() - 0.2) * 160 * U(L);
      return { t0: 0.2 + i * 0.55, x0: ax + h * 0.15, y0: fy - h * 0.75, tx, ty: L.h * (L.portrait ? 0.06 + r() * 0.28 : 0.1 + r() * 0.4), rot: (r() - 0.5) * 0.6, kind: i };
    });
  });
  const pw = fh * (L.portrait ? 0.42 : 0.52);
  for (const p of photos) {
    const d = t - p.t0;
    if (d < 0) continue;
    const m = easeOut(clamp(d / 1.8));
    const x = lerp(p.x0, p.tx, m) + Math.sin(t * 0.8 + p.kind) * 8 * u;
    const y = lerp(p.y0, p.ty, m) + Math.cos(t * 0.6 + p.kind) * 6 * u;
    const fade = p.kind === 3 ? 1 - span(d, 2.6, 3.6) * 0.4 : 1 - span(d, 1.4, 3.2) * 0.85;
    const detail = p.kind === 3 ? 1 : 1 - span(d, 0.6, 2.2);
    const sc = 0.4 + 0.6 * m;
    g.save();
    g.translate(x, y);
    g.rotate(p.rot + Math.sin(t + p.kind) * 0.05);
    g.scale(sc, sc);
    g.globalAlpha *= fade;
    if (p.kind === 3) glow(g, 0, 0, pw * 1.2, 'rgba(255,220,160,0.7)', clamp(d - 0.8));
    g.fillStyle = '#f7f1e3';
    g.fillRect(-pw / 2, -pw * 0.42, pw, pw * 0.84);
    g.fillStyle = '#c8a77a';
    g.fillRect(-pw * 0.43, -pw * 0.35, pw * 0.86, pw * 0.58);
    g.globalAlpha *= detail;
    const sh = pw * 0.5;
    switch (p.kind) {
      case 0:
        person(g, -pw * 0.15, pw * 0.2, sh, { color: '#5a3e28' });
        person(g, pw * 0.15, pw * 0.2, sh * 0.6, { color: '#5a3e28', pose: 'wave', phase: t });
        break;
      case 1:
        g.fillStyle = '#5a3e28';
        g.fillRect(-pw * 0.2, -pw * 0.05, pw * 0.4, pw * 0.25);
        g.beginPath();
        g.moveTo(-pw * 0.26, -pw * 0.05);
        g.lineTo(0, -pw * 0.25);
        g.lineTo(pw * 0.26, -pw * 0.05);
        g.fill();
        break;
      case 2:
        g.fillStyle = '#f5d48a';
        g.beginPath();
        circ(g, pw * 0.25, -pw * 0.2, pw * 0.07);
        g.fill();
        tree(g, -pw * 0.1, pw * 0.22, pw * 0.5, '#5a3e28', 3);
        break;
      case 3:
        person(g, -pw * 0.1, pw * 0.2, sh, { color: '#5a3e28', hat: 'tophat' });
        person(g, pw * 0.12, pw * 0.2, sh * 0.95, { color: '#5a3e28', dress: true, accent: '#f7f1e3', hat: 'veil' });
        break;
      default:
        g.fillStyle = '#5a3e28';
        g.beginPath();
        g.ellipse(0, pw * 0.05, pw * 0.16, pw * 0.11, 0, 0, TAU);
        circ(g, pw * 0.13, -pw * 0.08, pw * 0.07);
        g.fill();
    }
    g.restore();
  }
  // drifting fog banks
  const fogA = 0.3 + span(t, 0.5, 3.5) * 0.45;
  for (let i = 0; i < 7; i++) {
    const x = ((i * 0.19 + t * 0.03 * (i % 2 ? 1 : -1) + 1) % 1.2) * L.w - L.w * 0.1;
    const y = L.h * (0.1 + (i % 4) * 0.15);
    glow(g, x, y, L.h * 0.35, 'rgba(240,236,246,0.75)', fogA);
  }
});

// ================================================================== GRAVE VISIT

const graveVisit = mk(4.0, (f) => {
  const { g, L, t, era } = f;
  const u = U(L);
  const fy = FY(L, u);
  const fh = FH(L);
  const ps = particles(f.mem);
  sky(g, L, ['#585d72', '#8e8a90', '#cfa77e']);
  glow(g, L.w * 0.5, fy - fh * 0.2, L.w * 0.5, 'rgba(255,210,150,0.35)');
  hills(g, L, fy + 2 * u, fh * 0.18, '#5a5a4a', 0.4);
  floor(g, L, fy, '#55553f');
  const [ax, bx] = AB(L, 0.4, 0.82);
  const h = fh * (L.portrait ? 0.9 : 1);
  // light rays
  const base = g.globalAlpha;
  g.globalAlpha = base * (0.18 + 0.08 * Math.sin(t * 1.2));
  g.fillStyle = '#fff2d0';
  g.beginPath();
  g.moveTo(ax + h * 0.2 - h * 0.6, 0);
  g.lineTo(ax + h * 0.2 + h * 0.1, 0);
  g.lineTo(ax + h * 0.55, fy);
  g.lineTo(ax - h * 0.05, fy);
  g.fill();
  g.globalAlpha = base;
  // tree with falling leaves
  const tX = L.portrait ? L.w * 0.08 : ax - h * 1.1;
  tree(g, tX, fy, h * 1.7, '#2e2622', 23, Math.sin(t * 0.8));
  emit(f, 'lf', 9, () => {
    const x = L.portrait ? f.rand() * L.w : f.rand() < 0.6 ? tX + (f.rand() - 0.3) * h : visX(L, f.rand);
    add(ps, P(x, fy - h * (1.0 + f.rand() * 0.6), (15 + f.rand() * 25) * u, (30 + f.rand() * 20) * u, 4.5, (5 + f.rand() * 3) * u, f.rand.pick(['#d9772b', '#b8452a', '#e8b03a']), 4, f.rand() * TAU, (f.rand() - 0.5) * 3));
  });
  // headstone
  const sx = ax + h * 0.32;
  const stone = (x: number, s: number) => {
    g.fillStyle = '#8a8c90';
    g.beginPath();
    if (era === 'medieval') {
      g.rect(x - s * 0.06, fy - s * 0.62, s * 0.12, s * 0.62);
      g.rect(x - s * 0.2, fy - s * 0.5, s * 0.4, s * 0.1);
    } else if (era === 'ancient') {
      g.moveTo(x - s * 0.18, fy);
      g.lineTo(x - s * 0.14, fy - s * 0.5);
      g.lineTo(x, fy - s * 0.58);
      g.lineTo(x + s * 0.14, fy - s * 0.5);
      g.lineTo(x + s * 0.18, fy);
    } else {
      g.moveTo(x - s * 0.2, fy);
      g.lineTo(x - s * 0.2, fy - s * 0.38);
      g.arc(x, fy - s * 0.38, s * 0.2, Math.PI, 0);
      g.lineTo(x + s * 0.2, fy);
    }
    g.fill();
    g.fillStyle = '#6c6e72';
    if (era !== 'medieval') {
      g.fillRect(x - s * 0.1, fy - s * 0.4, s * 0.2, s * 0.025);
      g.fillRect(x - s * 0.08, fy - s * 0.33, s * 0.16, s * 0.02);
      g.fillRect(x - s * 0.08, fy - s * 0.27, s * 0.16, s * 0.02);
    }
  };
  stone(sx, h);
  if (!L.portrait || L.w > 0) {
    stone(bx, h * 0.8);
    stone(bx + h * 0.5, h * 0.7);
    // a small lantern
    g.fillStyle = '#2a2622';
    g.fillRect(bx - h * 0.3, fy - h * 0.12, h * 0.08, h * 0.12);
    glow(g, bx - h * 0.26, fy - h * 0.07, h * 0.2 * (1 + Math.sin(t * 9) * 0.05), 'rgba(255,200,110,0.9)');
  }
  // kneeling visitor
  const kx = ax - h * 0.15;
  person(g, kx, fy, h, { color: '#24222c', pose: 'kneel', dir: 1, dress: era !== 'modern' && era !== 'future', accent: '#33303c' });
  const m = span(t, 0.6, 1.8);
  const fx0 = kx + h * 0.12;
  const fy0 = fy - h * 0.38;
  const fx = lerp(fx0, sx - h * 0.18, m);
  const fyy = lerp(fy0, fy - h * 0.04, m);
  g.strokeStyle = '#24222c';
  g.lineWidth = Math.max(2, h * 0.07);
  g.lineCap = 'round';
  line(g, kx, fy - h * 0.55, fx, fyy);
  g.strokeStyle = '#3d7a3a';
  g.lineWidth = 2 * u;
  const fl = ['#f4f0e8', '#e86a8a', '#f5c64a', '#f4f0e8', '#b46ad8'];
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.28 + (m > 0.99 ? 0.6 : 0);
    const len = h * 0.16;
    const ex = fx + Math.cos(a) * len;
    const ey = fyy + Math.sin(a) * len;
    line(g, fx, fyy, ex, ey);
    g.fillStyle = fl[i];
    g.beginPath();
    circ(g, ex, ey, h * 0.028);
    g.fill();
  }
  stepParticles(ps, f.dt, 0);
  drawParts(g, ps);
});

// ================================================================== RETIREMENT

const retirement = mk(3.8, (f) => {
  const { g, L, t, era } = f;
  const u = U(L);
  const fy = FY(L, u);
  const fh = FH(L);
  const ps = particles(f.mem);
  sky(g, L, ['#2b2050', '#9c456c', '#f0905a', '#ffd38a']);
  const [ax, bx] = AB(L, 0.36, 0.8);
  const sX = L.portrait ? L.w * 0.5 : ax;
  const sY = fy - fh * 0.25 + span(t, 0, 3.8) * fh * 0.15;
  glow(g, sX, sY, fh * 2.2, 'rgba(255,190,110,0.7)');
  g.fillStyle = '#ffcf6a';
  g.beginPath();
  circ(g, sX, sY, fh * 0.42);
  g.fill();
  hills(g, L, fy + 2 * u, fh * 0.25, '#4a2a48', 3.3);
  floor(g, L, fy, '#2e1b30');
  const h = fh * (L.portrait ? 0.9 : 1);
  // porch: deck, posts, roof edge
  const pw = h * 1.6;
  const px = ax - pw / 2;
  g.fillStyle = '#24152a';
  g.fillRect(px, fy - h * 0.06, pw, h * 0.06);
  g.fillRect(px + h * 0.04, fy - h * 1.25, h * 0.06, h * 1.2);
  g.fillRect(px + pw - h * 0.1, fy - h * 1.25, h * 0.06, h * 1.2);
  g.fillRect(px - h * 0.1, fy - h * 1.32, pw + h * 0.2, h * 0.09);
  for (let i = 0; i < 9; i++) g.fillRect(px + h * 0.1 + i * (pw - h * 0.2) / 9, fy - h * 0.38, h * 0.025, h * 0.32);
  g.fillRect(px + h * 0.08, fy - h * 0.4, pw * 0.25, h * 0.03);
  g.fillRect(px + pw * 0.72, fy - h * 0.4, pw * 0.25, h * 0.03);
  // rocking chair
  const cx = ax;
  const a = Math.sin(t * 2.2) * 0.09;
  g.save();
  g.translate(cx, fy - h * 0.06);
  g.rotate(a);
  g.strokeStyle = '#1a0f1e';
  g.lineWidth = Math.max(2, h * 0.035);
  g.beginPath();
  g.moveTo(-h * 0.32, -h * 0.05);
  g.quadraticCurveTo(0, h * 0.05, h * 0.32, -h * 0.05);
  g.stroke();
  line(g, -h * 0.15, 0, -h * 0.15, -h * 0.28);
  line(g, h * 0.15, 0, h * 0.15, -h * 0.28);
  line(g, -h * 0.2, -h * 0.28, h * 0.18, -h * 0.28);
  line(g, -h * 0.18, -h * 0.28, -h * 0.3, -h * 0.75);
  seated(g, -h * 0.08, 0.02 * h, h, '#1a0f1e', 1, '#d9d4dc', 0.4);
  g.restore();
  // gold watch on a chain
  const wX = L.portrait ? L.w * 0.82 : bx;
  const wTop = L.portrait ? L.h * 0.05 : fy - fh * 1.7;
  const len = fh * (L.portrait ? 0.55 : 0.8);
  const sw = Math.sin(t * 2.6) * 0.4;
  const wx = wX + Math.sin(sw) * len;
  const wy = wTop + Math.cos(sw) * len;
  const R = fh * (L.portrait ? 0.15 : 0.27);
  g.strokeStyle = '#e8c45a';
  g.lineWidth = 2 * u;
  g.setLineDash([5 * u, 3 * u]);
  line(g, wX, wTop, wx, wy - R);
  g.setLineDash([]);
  glow(g, wx, wy, R * 2.6, 'rgba(255,215,110,0.6)');
  g.fillStyle = '#d9a72e';
  g.beginPath();
  circ(g, wx, wy, R);
  circ(g, wx, wy - R * 1.12, R * 0.16);
  g.fill();
  g.fillStyle = '#fff6dc';
  g.beginPath();
  circ(g, wx, wy, R * 0.8);
  g.fill();
  if (before(era, 'early')) {
    star(g, wx, wy, R * 0.55, '#d9a72e', t * 0.5);
  } else {
    g.strokeStyle = '#3a2a10';
    g.lineCap = 'round';
    g.lineWidth = 2.5 * u;
    line(g, wx, wy, wx + Math.sin(t * 0.5) * R * 0.4, wy - Math.cos(t * 0.5) * R * 0.4);
    g.lineWidth = 1.5 * u;
    line(g, wx, wy, wx + Math.sin(t * 6) * R * 0.65, wy - Math.cos(t * 6) * R * 0.65);
  }
  const ext = Math.abs(Math.cos(t * 2.6));
  if (ext < 0.2) star(g, wx + R * 0.5, wy - R * 0.5, R * 0.5 * (1 - ext / 0.2), '#ffffff', t);
  emit(f, 'sp', 8, () => add(ps, P(wx + (f.rand() - 0.5) * R * 2, wy + (f.rand() - 0.5) * R * 2, 0, -15 * u, 1, (1.5 + f.rand() * 2) * u, '#fff1b0', 0)));
  stepParticles(ps, f.dt, 0);
  drawParts(g, ps);
});

// ================================================================== MOVING

function box(g: G, x: number, y: number, w: number, h: number, col = '#c8935a'): void {
  g.fillStyle = col;
  g.fillRect(x, y - h, w, h);
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.fillRect(x, y - h, w, h * 0.12);
  g.fillStyle = '#e9d6a8';
  g.fillRect(x + w * 0.42, y - h, w * 0.16, h * 0.5);
}

const moving = mk(3.8, (f) => {
  const { g, L, t, era } = f;
  const u = U(L);
  const fy = FY(L, u);
  const fh = FH(L);
  const ps = particles(f.mem);
  const ei = ERA_I[era];
  sky(g, L, ['#7fc0ea', '#b8def0', '#f2ecd4']);
  hills(g, L, fy - fh * 0.1, fh * 0.3, '#9cc58a', 4.1);
  floor(g, L, fy, ei >= 3 ? '#6b6e74' : '#9a7a52');
  const [ax, bx] = AB(L, 0.32, 0.8);
  const s = L.portrait ? 0.62 : 1;
  const h = fh * s;
  const arrive = easeOut(clamp(t / 1.7));
  const vx = lerp(-h * 2.2, ax - (L.portrait ? h * 0.2 : 0), arrive);
  const speed = 1 - arrive;
  const wheelPh = -arrive * 14;
  if (speed > 0.05) emit(f, 'du', 20 * speed, () => add(ps, P(vx - h * 0.9, fy - 6 * u, -(30 + f.rand() * 40) * u, -(10 + f.rand() * 20) * u, 1, (7 + f.rand() * 6) * u, ei >= 3 ? '#b0b0b0' : '#c9a878', 3)));
  const wheel = (x: number, r: number, spokes: boolean) => {
    g.fillStyle = '#1c1c22';
    g.beginPath();
    circ(g, x, fy - r, r);
    g.fill();
    g.strokeStyle = spokes ? '#8a6a42' : '#9aa0a8';
    g.lineWidth = Math.max(1.5, r * 0.12);
    for (let i = 0; i < (spokes ? 4 : 3); i++) {
      const a = wheelPh + (i * Math.PI) / (spokes ? 4 : 3);
      line(g, x - Math.cos(a) * r * 0.75, fy - r - Math.sin(a) * r * 0.75, x + Math.cos(a) * r * 0.75, fy - r + Math.sin(a) * r * 0.75);
    }
  };
  if (ei < 3) {
    // horse-drawn cart
    const cw = h * 1.1;
    const c0 = vx - cw * 0.65;
    horse(g, vx + h * 0.55, fy, h * 0.7, 1, t * speed * 2.2 + 0.3, '#3b2a20', undefined, Math.max(0.15, speed));
    g.strokeStyle = '#5a3e26';
    g.lineWidth = 4 * u;
    line(g, c0 + cw, fy - h * 0.32, vx + h * 0.35, fy - h * 0.42);
    g.fillStyle = '#7a5434';
    g.fillRect(c0, fy - h * 0.42, cw, h * 0.14);
    box(g, c0 + cw * 0.05, fy - h * 0.42, cw * 0.32, h * 0.26, '#a77a4a');
    box(g, c0 + cw * 0.4, fy - h * 0.42, cw * 0.28, h * 0.2, '#b98a54');
    box(g, c0 + cw * 0.15, fy - h * 0.68, cw * 0.26, h * 0.2, '#9c6e40');
    g.fillStyle = '#d8c39a';
    g.beginPath();
    g.ellipse(c0 + cw * 0.84, fy - h * 0.48, cw * 0.12, h * 0.09, 0, 0, TAU);
    g.fill();
    wheel(c0 + cw * 0.35, h * 0.24, true);
  } else {
    const tw = h * 1.7;
    const t0 = vx - tw * 0.55;
    const hover = ei === 5;
    const lift = hover ? h * 0.12 + Math.sin(t * 3) * 3 * u : 0;
    if (hover) glow(g, vx, fy - 6 * u, tw * 0.6, 'rgba(120,230,255,0.6)');
    g.save();
    g.translate(0, -lift);
    g.fillStyle = ei === 3 ? '#2f4a3a' : hover ? '#dfe8f5' : '#f4f4f0';
    g.fillRect(t0, fy - h * 0.95, tw * 0.7, h * 0.78);
    g.fillStyle = ei === 3 ? '#253a2e' : hover ? '#5a6fd8' : '#e05a3a';
    g.beginPath();
    rrect(g, t0 + tw * 0.71, fy - h * 0.62, tw * 0.28, h * 0.45, h * 0.08);
    g.fill();
    g.fillStyle = '#a8d8f0';
    g.fillRect(t0 + tw * 0.8, fy - h * 0.56, tw * 0.13, h * 0.16);
    g.fillStyle = ei === 3 ? '#e8d8a0' : '#e05a3a';
    g.fillRect(t0 + tw * 0.05, fy - h * 0.62, tw * 0.6, h * 0.08);
    g.restore();
    if (!hover) {
      wheel(t0 + tw * 0.18, h * 0.14, ei === 3);
      wheel(t0 + tw * 0.82, h * 0.14, ei === 3);
    }
    // boxes stacked beside the truck after arriving
    const n = Math.floor(span(t, 1.8, 3.0) * 3.99);
    for (let i = 0; i < n; i++) box(g, t0 - h * 0.45 + (i % 2) * h * 0.06, fy - Math.floor(i / 2) * h * 0.24 - (i === 3 ? 0 : 0), h * 0.32, h * 0.24);
  }
  // new front door
  const dX = bx;
  const dw = h * 0.42;
  const dh = h * 0.95;
  g.fillStyle = '#c9a77a';
  g.fillRect(dX - h * 0.55, fy - h * 1.4, h * 1.1, h * 1.4);
  g.fillStyle = '#8a3a2a';
  g.beginPath();
  g.moveTo(dX - h * 0.7, fy - h * 1.4);
  g.lineTo(dX, fy - h * 1.85);
  g.lineTo(dX + h * 0.7, fy - h * 1.4);
  g.fill();
  const open = span(t, 2.2, 3.0);
  glow(g, dX, fy - dh * 0.5, dh * 0.9, 'rgba(255,220,140,0.85)', open);
  g.fillStyle = '#ffe2a0';
  g.fillRect(dX - dw / 2, fy - dh, dw, dh);
  g.fillStyle = ei >= 4 ? '#3a6a8a' : '#5a3a26';
  g.fillRect(dX - dw / 2, fy - dh, dw * (1 - open * 0.8), dh);
  g.fillStyle = '#e8c45a';
  g.beginPath();
  circ(g, dX - dw / 2 + dw * (1 - open * 0.8) - 7 * u, fy - dh * 0.5, 3 * u);
  g.fill();
  g.fillStyle = '#7a8a5a';
  g.fillRect(dX - dw * 0.6, fy - 4 * u, dw * 1.2, 4 * u);
  // mover carrying a box to the door
  const wx = lerp(dX - h * 1.1, dX - h * 0.5, span(t, 1.2, 2.6));
  const walking = t > 1.2 && t < 2.6;
  person(g, wx, fy, h, { color: '#24304a', pose: walking ? 'walk' : 'hold', phase: t, dir: 1 });
  box(g, wx - h * 0.18, fy - h * 0.52, h * 0.36, h * 0.28);
  stepParticles(ps, f.dt, 0);
  drawParts(g, ps);
});


// ================================================================== HEATWAVE

const heatwave = mk(3.6, (f) => {
  const { g, L, t, era } = f;
  const u = U(L);
  const fy = FY(L, u);
  const fh = FH(L);
  const ps = particles(f.mem);
  const k = span(t, 0, 2.5);
  sky(g, L, ['#ff8a3a', '#ffb45e', '#ffe0a0']);
  wash(g, L, '#c0301a', 0.12 + 0.08 * Math.sin(t * 3) + k * 0.1);
  const [ax, bx] = AB(L, 0.3, 0.7);
  const sX = L.portrait ? L.w * 0.5 : bx;
  const sY = L.portrait ? L.h * 0.13 : L.h * 0.24;
  const R = fh * (L.portrait ? 0.38 : 0.5) * (1 + 0.04 * Math.sin(t * 4) + k * 0.12);
  glow(g, sX, sY, R * 5, 'rgba(255,240,170,0.8)');
  g.save();
  g.translate(sX, sY);
  g.rotate(t * 0.3);
  g.fillStyle = 'rgba(255,250,200,0.35)';
  for (let i = 0; i < 16; i++) {
    g.rotate(TAU / 16);
    g.beginPath();
    g.moveTo(R * 1.1, -R * 0.12);
    g.lineTo(R * (1.9 + 0.3 * Math.sin(t * 5 + i)), 0);
    g.lineTo(R * 1.1, R * 0.12);
    g.fill();
  }
  g.restore();
  g.fillStyle = '#fff6c8';
  g.beginPath();
  circ(g, sX, sY, R);
  g.fill();
  floor(g, L, fy, '#c98a4a');
  // cracks spreading across the ground
  const cracks = once(f.mem, 'cr', () => {
    const r = makeRand(77);
    return Array.from({ length: 14 }, () => {
      const pts: [number, number][] = [];
      let x = r() * L.w;
      let y = fy + 6 + r() * (L.h - fy) * 0.5;
      for (let j = 0; j < 6; j++) {
        pts.push([x, y]);
        x += (r() - 0.5) * 80;
        y += r() * 22;
      }
      return pts;
    });
  });
  g.strokeStyle = '#6a3a1a';
  g.lineWidth = 2.5 * u;
  g.lineJoin = 'round';
  for (const c of cracks) {
    const n = Math.floor(k * (c.length - 1)) + 1;
    g.beginPath();
    for (let j = 0; j <= Math.min(n, c.length - 1); j++) g.lineTo(c[j][0], c[j][1]);
    g.stroke();
  }
  // heat shimmer rising
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = 2 * u;
  for (let i = 0; i < 6; i++) {
    const y = fy - ((t * 45 * u + i * fh * 0.22) % (fh * 1.4));
    const base = g.globalAlpha;
    g.globalAlpha = base * Math.sin(((fy - y) / (fh * 1.4)) * Math.PI) * 0.8;
    g.beginPath();
    for (let x = 0; x <= L.w; x += 16) g.lineTo(x, y + Math.sin(x * 0.03 + t * 6 + i) * 4 * u);
    g.stroke();
    g.globalAlpha = base;
  }
  // a figure fanning itself
  const h = fh * (L.portrait ? 0.85 : 1);
  const fx = ax;
  const ph = t * 1.6;
  person(g, fx, fy, h, { color: '#3a1e14', pose: 'wave', phase: ph, dir: 1, hat: before(era, 'industrial') ? 'hood' : 'cap', accent: '#5a2e1e' });
  const [hx, hy] = waveHand(fx, fy, h, 1, ph);
  g.fillStyle = '#f4e2b8';
  g.beginPath();
  g.moveTo(hx, hy);
  g.arc(hx, hy, h * 0.13, -Math.PI * 0.95 + Math.sin(ph * 9) * 0.3, -Math.PI * 0.35 + Math.sin(ph * 9) * 0.3);
  g.fill();
  emit(f, 'sw', 3, () => add(ps, P(fx + (f.rand() - 0.5) * h * 0.1, fy - h * 0.9, (f.rand() - 0.5) * 30 * u, -20 * u, 0.7, 3 * u, '#bfe6ff', 0)));
  // thermometer (or a cracked clay jar in older days)
  const tx = L.portrait ? fx + h * 0.6 : ax + h * 0.8;
  if (before(era, 'early')) {
    g.fillStyle = '#9a5a32';
    g.beginPath();
    g.ellipse(tx, fy - h * 0.2, h * 0.16, h * 0.2, 0, 0, TAU);
    g.rect(tx - h * 0.07, fy - h * 0.46, h * 0.14, h * 0.1);
    g.fill();
    g.strokeStyle = '#4a2a14';
    g.lineWidth = 2 * u;
    g.beginPath();
    g.moveTo(tx - h * 0.02, fy - h * 0.38);
    g.lineTo(tx + h * 0.04, fy - h * 0.25);
    g.lineTo(tx - h * 0.01, fy - h * 0.12);
    g.stroke();
  } else {
    const th = h * 0.9;
    g.fillStyle = '#ffffff';
    g.beginPath();
    rrect(g, tx - h * 0.05, fy - th - h * 0.05, h * 0.1, th, h * 0.05);
    circ(g, tx, fy - h * 0.1, h * 0.09);
    g.fill();
    const lvl = lerp(0.3, 1, easeOut(k));
    g.fillStyle = '#e8301c';
    g.beginPath();
    circ(g, tx, fy - h * 0.1, h * 0.065);
    g.rect(tx - h * 0.025, fy - h * 0.1 - (th - h * 0.12) * lvl, h * 0.05, (th - h * 0.12) * lvl);
    g.fill();
    glow(g, tx, fy - h * 0.1 - (th - h * 0.12) * lvl, h * 0.25, 'rgba(255,80,40,0.8)', k);
  }
  // wilted plant
  const px = L.portrait ? L.w * 0.08 : bx + h * 0.6;
  g.strokeStyle = '#6a6a2a';
  g.lineWidth = 3 * u;
  for (let i = -1; i <= 1; i++) {
    g.beginPath();
    g.moveTo(px + i * 6 * u, fy);
    g.quadraticCurveTo(px + i * 10 * u, fy - h * 0.35, px + i * 18 * u + h * 0.1 * k, fy - h * (0.3 - 0.12 * k));
    g.stroke();
  }
  stepParticles(ps, f.dt, 300 * u);
  drawParts(g, ps);
});

// ================================================================== BLIZZARD

const blizzard = mk(3.8, (f) => {
  const { g, L, t, era } = f;
  const u = U(L);
  const fy = FY(L, u);
  const fh = FH(L);
  const ps = particles(f.mem);
  const k = span(t, 0, 2.8);
  sky(g, L, ['#4a5568', '#7b8698', '#b9c2ce']);
  hills(g, L, fy - fh * 0.1, fh * 0.3, '#d8dee6', 2.2);
  floor(g, L, fy, '#eef2f6');
  const [ax, bx] = AB(L, 0.34, 0.76);
  const h = fh * (L.portrait ? 0.85 : 1);
  // buried vehicles / carts
  const mounds = L.portrait ? [L.w * 0.12, L.w * 0.86] : [ax - h * 0.9, bx - h * 0.2, bx + h * 0.7];
  const old = before(era, 'industrial');
  mounds.forEach((mx, i) => {
    const sc = i === 1 ? 1 : 0.8;
    const bury = lerp(0.35, 0.85, k);
    if (old) {
      g.fillStyle = '#5a3e26';
      g.strokeStyle = '#5a3e26';
      g.lineWidth = 4 * u;
      g.beginPath();
      g.arc(mx + h * 0.2 * sc, fy - h * 0.2 * sc, h * 0.2 * sc, 0, TAU);
      g.stroke();
      g.fillRect(mx - h * 0.45 * sc, fy - h * 0.38 * sc, h * 0.8 * sc, h * 0.08 * sc);
      line(g, mx - h * 0.45 * sc, fy - h * 0.34 * sc, mx - h * 0.85 * sc, fy - h * 0.2 * sc);
    } else {
      g.fillStyle = ['#b03a3a', '#3a5a9a', '#3a7a5a'][i % 3];
      g.beginPath();
      rrect(g, mx - h * 0.5 * sc, fy - h * 0.32 * sc, h * sc, h * 0.2 * sc, h * 0.06 * sc);
      rrect(g, mx - h * 0.3 * sc, fy - h * 0.48 * sc, h * 0.55 * sc, h * 0.2 * sc, h * 0.08 * sc);
      g.fill();
      g.fillStyle = '#a8c0d8';
      g.fillRect(mx - h * 0.22 * sc, fy - h * 0.44 * sc, h * 0.18 * sc, h * 0.12 * sc);
      g.fillRect(mx + h * 0.0 * sc, fy - h * 0.44 * sc, h * 0.18 * sc, h * 0.12 * sc);
    }
    g.fillStyle = '#f4f7fa';
    g.beginPath();
    g.ellipse(mx, fy, h * 0.75 * sc, h * 0.5 * sc * bury, 0, Math.PI, TAU);
    g.fill();
    g.beginPath();
    g.ellipse(mx - h * 0.1 * sc, fy - h * 0.5 * sc * bury, h * 0.3 * sc, h * 0.08 * sc, 0, Math.PI, TAU);
    g.fill();
  });
  // lamp post / lantern being swamped
  const lx = L.portrait ? L.w * 0.72 : bx + h * 0.15;
  g.fillStyle = '#2a2e38';
  g.fillRect(lx - 3 * u, fy - h * 1.2, 6 * u, h * 1.2);
  g.fillRect(lx - h * 0.06, fy - h * 1.28, h * 0.12, h * 0.1);
  glow(g, lx, fy - h * 1.22, h * 0.5 * (0.85 + 0.15 * Math.sin(t * 17)), 'rgba(255,220,150,0.85)');
  // figure leaning into the wind with a flapping scarf
  const fx = ax + Math.sin(t * 0.5) * 5 * u;
  g.save();
  g.translate(fx, fy);
  g.rotate(-0.22);
  person(g, 0, 0, h, { color: '#1e2433', pose: 'walk', phase: t * 0.35, dir: -1, hat: old ? 'hood' : 'cap', accent: '#2a3446' });
  g.strokeStyle = '#d0342c';
  g.lineWidth = h * 0.05;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(0, -h * 0.72);
  for (let i = 1; i <= 5; i++) g.lineTo(i * h * 0.07, -h * 0.72 + Math.sin(t * 18 - i) * h * 0.03);
  g.stroke();
  g.restore();
  // snow and wind streaks
  emit(f, 'sn', 110, () => add(ps, P(f.rand() * L.w * 1.2 - L.w * 0.4, -10, (260 + f.rand() * 200) * u, (140 + f.rand() * 120) * u, 3, (1.5 + f.rand() * 2.5) * u, '#ffffff', 0)));
  emit(f, 'wd', 6, () => add(ps, P(-50, f.rand() * fy, (900 + f.rand() * 300) * u, (80 + f.rand() * 40) * u, 1.6, 2 * u, 'rgba(255,255,255,0.5)', 1)));
  for (const p of ps) p.vx += Math.sin(t * 3 + p.y * 0.02) * 10 * u * f.dt;
  stepParticles(ps, f.dt, 0);
  drawParts(g, ps);
  wash(g, L, '#e6ecf2', 0.1 + k * 0.25);
});

// ================================================================== VOLCANO

const volcano = mk(
  4.2,
  (f) => {
    const { g, L, t } = f;
    const u = U(L);
    const fy = FY(L, u);
    const fh = FH(L);
    const ps = particles(f.mem);
    const t0 = 0.7;
    const d = t - t0;
    sky(g, L, ['#120808', '#3a140e', '#7a2a12']);
    const vx = MX(L);
    const bw = L.portrait ? L.w * 0.55 : Math.min(L.phone.x * 0.95, fh * 2.6);
    const vh = fh * (L.portrait ? 1.4 : 1.8);
    const topY = fy - vh;
    const cw = bw * 0.14;
    glow(g, vx, topY, vh * 1.4, 'rgba(255,110,40,0.8)', d > 0 ? 0.6 + 0.3 * Math.sin(t * 6) : 0.25);
    // distant ridge and the far-side glow
    hills(g, L, fy - fh * 0.2, fh * 0.45, '#2a0e0c', 5.5, 1.5);
    if (!L.portrait) glow(g, L.slots[1], fy - fh * 0.2, fh * 1.6, 'rgba(255,90,30,0.4)', clamp(d));
    // ash cloud
    if (d > 0) {
      emit(f, 'ash', 34, () => {
        const sp = (60 + f.rand() * 80) * u;
        add(ps, P(vx + (f.rand() - 0.5) * cw, topY, (f.rand() - 0.5) * 70 * u, -sp, 3 + f.rand() * 1.5, (22 + f.rand() * 24) * u, f.rand.pick(['#2a2422', '#3a3230', '#4a403c']), 3));
      });
      emit(f, 'lv', 70, () => {
        const a = -Math.PI / 2 + (f.rand() - 0.5) * 1.2;
        const sp = (250 + f.rand() * 450) * u;
        add(ps, P(vx + (f.rand() - 0.5) * cw * 0.6, topY, Math.cos(a) * sp, Math.sin(a) * sp, 1.2 + f.rand() * 0.8, (2.5 + f.rand() * 4) * u, f.rand.pick(['#ffcf3a', '#ff8a1a', '#ff5a10', '#fff1a0']), f.rand() < 0.4 ? 1 : 0));
      });
    }
    if (at(f, 'boom', t0)) {
      for (let i = 0; i < 40; i++) {
        const a = -Math.PI / 2 + (f.rand() - 0.5) * 2.2;
        const sp = (500 + f.rand() * 700) * u;
        add(ps, P(vx, topY, Math.cos(a) * sp, Math.sin(a) * sp, 1.6, (3 + f.rand() * 4) * u, '#ffd36a', 1));
      }
    }
    // smoke/ash first (behind cone), lava on top
    const smoke = ps.filter((p) => p.kind === 3);
    const hot = ps.filter((p) => p.kind !== 3);
    drawParts(g, smoke);
    // cone
    g.fillStyle = '#1a0a08';
    g.beginPath();
    g.moveTo(vx - bw, fy + 2);
    g.quadraticCurveTo(vx - bw * 0.35, fy - vh * 0.35, vx - cw, topY);
    g.lineTo(vx - cw * 0.4, topY + vh * 0.04);
    g.lineTo(vx + cw * 0.3, topY + vh * 0.02);
    g.lineTo(vx + cw, topY);
    g.quadraticCurveTo(vx + bw * 0.35, fy - vh * 0.35, vx + bw, fy + 2);
    g.closePath();
    g.fill();
    // lava flows creeping down the flanks
    if (d > 0) {
      const flows = [-0.8, -0.35, 0.4, 0.75];
      flows.forEach((fl, i) => {
        const m = clamp((d - i * 0.25) / 2.2);
        if (m <= 0) return;
        const pts: [number, number][] = [];
        for (let j = 0; j <= 20 * m; j++) {
          const q = j / 20;
          const yy = topY + q * vh;
          const half = cw + (bw - cw) * (q * q * 0.6 + q * 0.4) * 0.9;
          pts.push([vx + fl * half * 0.9 * Math.min(1, q * 1.4 + 0.2) + Math.sin(q * 9 + i) * 6 * u, yy]);
        }
        for (const [w, c] of [
          [12, '#b8280c'],
          [6, '#ff7a1a'],
          [2.5, '#ffe07a'],
        ] as [number, string][]) {
          g.strokeStyle = c;
          g.lineWidth = w * u;
          g.lineCap = 'round';
          g.lineJoin = 'round';
          g.beginPath();
          for (const [x, y] of pts) g.lineTo(x, y);
          g.stroke();
        }
      });
      glow(g, vx, topY, cw * 3, 'rgba(255,230,140,1)', clamp(1 - d / 0.6) + 0.3);
    }
    // volcanic lightning in the ash
    if (d > 0.8 && Math.sin(t * 23) > 0.93) {
      g.strokeStyle = '#e8e4ff';
      g.lineWidth = 2.5 * u;
      g.beginPath();
      let lx = vx + Math.sin(t * 7) * bw * 0.4;
      let ly = topY - vh * 0.7;
      g.moveTo(lx, ly);
      for (let i = 0; i < 6; i++) {
        lx += Math.sin(t * 31 + i * 3) * 18 * u;
        ly += vh * 0.09;
        g.lineTo(lx, ly);
      }
      g.stroke();
    }
    stepParticles(ps, f.dt, 0);
    for (const p of hot) p.vy += 500 * u * f.dt;
    for (const p of smoke) {
      p.vx *= 1 - 0.3 * f.dt;
      p.vy *= 1 - 0.25 * f.dt;
    }
    drawParts(g, hot);
    // falling ash flakes everywhere
    emit(f, 'fl', d > 0 ? 20 : 0, () => add(ps, P(visX(L, f.rand), -5, (f.rand() - 0.3) * 30 * u, (50 + f.rand() * 40) * u, 4, 1.5 * u, '#8a7a72', 4, 0, 2)));
    if (d > 0) wash(g, L, '#fff0c0', clamp(1 - d / 0.35) * 0.7);
  },
  (t) => {
    const d = t - 0.7;
    if (d < 0) return 1;
    return Math.max(2, 14 * (1 - d / 1.2));
  },
);

// ================================================================== METEOR

const starsOf = (mem: Record<string, unknown>, L: Layout, n: number, maxY: number) =>
  once(mem, 'stars', () => {
    const r = makeRand(99);
    return Array.from({ length: n }, () => [r() * L.w, r() * maxY, 0.5 + r() * 1.6, r() * 6] as [number, number, number, number]);
  });
function drawStars(g: G, stars: [number, number, number, number][], t: number, alpha = 1, u = 1): void {
  const base = g.globalAlpha;
  g.fillStyle = '#ffffff';
  for (const [x, y, s, ph] of stars) {
    g.globalAlpha = base * alpha * (0.5 + 0.5 * Math.sin(t * 2 + ph));
    g.fillRect(x, y, s * u, s * u);
  }
  g.globalAlpha = base;
}

const meteor = mk(
  4.0,
  (f) => {
    const { g, L, t } = f;
    const u = U(L);
    const fy = FY(L, u);
    const fh = FH(L);
    const ps = particles(f.mem);
    const tI = 1.7;
    sky(g, L, ['#04061a', '#0d1638', '#2a2550']);
    drawStars(g, starsOf(f.mem, L, 120, fy), t, 1, u);
    const ix = L.portrait ? L.w * 0.32 : L.slots[0];
    const iy = fy - fh * 0.3;
    const sx = L.portrait ? L.w * 1.15 : L.w * 0.98;
    const sy = -L.h * 0.08;
    const m = easeIn(clamp((t - 0.2) / (tI - 0.2)));
    const mx = lerp(sx, ix, m);
    const my = lerp(sy, iy, m);
    const d = t - tI;
    if (d < 0) {
      // trail
      const dx = ix - sx;
      const dy = iy - sy;
      const len = Math.hypot(dx, dy);
      const nx = dx / len;
      const ny = dy / len;
      const tl = Math.min(len * m, fh * 2.6);
      const grad = g.createLinearGradient(mx, my, mx - nx * tl, my - ny * tl);
      grad.addColorStop(0, 'rgba(255,240,200,0.95)');
      grad.addColorStop(0.3, 'rgba(255,140,40,0.7)');
      grad.addColorStop(1, 'rgba(255,60,20,0)');
      g.fillStyle = grad;
      const w = fh * 0.09;
      g.beginPath();
      g.moveTo(mx + ny * w, my - nx * w);
      g.lineTo(mx - nx * tl, my - ny * tl);
      g.lineTo(mx - ny * w, my + nx * w);
      g.fill();
      glow(g, mx, my, fh * 0.6, 'rgba(255,200,120,0.9)');
      g.fillStyle = '#fffbe8';
      g.beginPath();
      circ(g, mx, my, fh * 0.06);
      g.fill();
      emit(f, 'sp', 60, () => add(ps, P(mx, my, -nx * 120 * u + (f.rand() - 0.5) * 80 * u, -ny * 120 * u + (f.rand() - 0.5) * 80 * u, 0.6 + f.rand() * 0.5, (1.5 + f.rand() * 2) * u, f.rand.pick(['#ffd36a', '#ff8a2a', '#fff1c0']), 0)));
    } else {
      // distant flash, dome and rising column
      const dome = fh * 2.2 * easeOut(clamp(d / 0.7));
      glow(g, ix, iy, dome * 2.2, 'rgba(255,180,90,0.8)', clamp(1 - d / 2.2));
      fillA(g, '#ffe6a0', clamp(1 - d / 0.8), () => g.ellipse(ix, iy, dome, dome * 0.75, 0, Math.PI, TAU));
      ring(g, ix, iy, d * 900 * u, 6 * u, '#fff2d0', clamp(1 - d / 1.0));
      const col = fh * 1.3 * easeOut(clamp(d / 1.6));
      fillA(g, '#5a3a32', clamp(d * 2) * 0.85, () => {
        g.rect(ix - fh * 0.1, iy - col, fh * 0.2, col);
        g.ellipse(ix, iy - col, fh * 0.35 * clamp(d), fh * 0.16 * clamp(d), 0, 0, TAU);
      });
      glow(g, ix, iy - col, fh * 0.5, 'rgba(255,120,50,0.6)', clamp(1 - d / 2));
    }
    hills(g, L, fy + 2 * u, fh * 0.3, '#0a0a1a', 6.1, 1.2);
    floor(g, L, fy, '#08081a');
    // watchers
    const wx = L.portrait ? L.w * 0.72 : L.slots[1];
    const h = fh * (L.portrait ? 0.8 : 1);
    const lit = d > 0 ? clamp(1 - d / 2) : 0;
    const cols = ['#141428', '#1a1a30', '#10101e'];
    [-0.45, 0, 0.42].forEach((o, i) => {
      person(g, wx + o * h, fy, h * (i === 2 ? 0.7 : 1), { color: cols[i], pose: i === 0 ? 'wave' : 'stand', phase: 0.02, dir: -1 });
    });
    if (lit > 0) glow(g, wx, fy - h * 0.5, h, 'rgba(255,170,90,0.35)', lit);
    stepParticles(ps, f.dt, 0);
    drawParts(g, ps);
    if (d > 0) wash(g, L, '#fff4dc', clamp(1 - d / 0.5) * 0.85);
  },
  (t) => {
    const d = t - 2.0;
    return d < 0 ? 0 : Math.max(0, 10 * (1 - d / 1.2));
  },
);

// ================================================================== ECLIPSE

const eclipse = mk(4.4, (f) => {
  const { g, L, t } = f;
  const u = U(L);
  const fy = FY(L, u);
  const fh = FH(L);
  const sX = L.portrait ? L.w * 0.5 : L.slots[1];
  const sY = L.portrait ? L.h * 0.15 : L.h * 0.28;
  const R = fh * (L.portrait ? 0.3 : 0.38);
  const off = t < 2.2 ? lerp(2.4, 0, easeInOut(t / 2.2)) : t < 3.3 ? 0 : -lerp(0, 0.9, easeInOut((t - 3.3) / 1.1));
  const dark = clamp(1 - Math.abs(off) / 2);
  const total = clamp(1 - Math.abs(off) / 0.12);
  sky(g, L, ['#3a7ac0', '#7ab0e0', '#cfe2ee']);
  wash(g, L, '#05061a', dark * dark * 0.92);
  // horizon glow all round during totality
  fillA(g, '#ff9a50', total * 0.5, () => g.rect(0, fy - fh * 0.35, L.w, fh * 0.35));
  glow(g, L.w * 0.5, fy, L.w * 0.6, 'rgba(255,150,80,0.4)', total);
  drawStars(g, starsOf(f.mem, L, 90, fy * 0.8), t, dark * dark, u);
  // sun
  glow(g, sX, sY, R * 4, 'rgba(255,240,190,0.9)', 1 - dark * 0.9);
  if (total > 0) {
    g.save();
    g.translate(sX, sY);
    g.rotate(t * 0.08);
    g.globalAlpha *= total;
    glow(g, 0, 0, R * 2.8, 'rgba(220,235,255,0.85)');
    g.strokeStyle = 'rgba(235,245,255,0.6)';
    g.lineCap = 'round';
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * TAU;
      const l = R * (1.5 + 0.9 * Math.abs(Math.sin(i * 2.3)));
      g.lineWidth = (1 + (i % 3)) * u;
      line(g, Math.cos(a) * R, Math.sin(a) * R, Math.cos(a) * l, Math.sin(a) * l);
    }
    g.fillStyle = '#ff6a8a';
    for (let i = 0; i < 4; i++) {
      const a = i * 1.7 + 0.4;
      g.beginPath();
      circ(g, Math.cos(a) * R * 1.02, Math.sin(a) * R * 1.02, R * 0.07);
      g.fill();
    }
    g.restore();
  }
  g.fillStyle = '#fff6d6';
  g.beginPath();
  circ(g, sX, sY, R);
  g.fill();
  // moon
  const mX = sX + off * R;
  g.fillStyle = '#07081a';
  g.beginPath();
  circ(g, mX, sY - off * R * 0.08, R * 1.03);
  g.fill();
  // diamond ring as the moon slides off
  if (t > 3.3) {
    const k = clamp((t - 3.3) / 0.25) * clamp(1 - (t - 3.55) / 0.6);
    if (k > 0) {
      const dx = sX + R * 0.95;
      glow(g, dx, sY, R * 1.4, 'rgba(255,255,240,1)', k);
      star(g, dx, sY, R * 0.5 * k, '#ffffff', 0.3);
    }
  }
  hills(g, L, fy + 2 * u, fh * 0.2, '#1a2030', 0.9);
  floor(g, L, fy, '#141a26');
  // onlookers gazing up
  const px = L.portrait ? L.w * 0.5 : L.slots[0];
  const h = fh * (L.portrait ? 0.8 : 1);
  const dir: 1 | -1 = L.portrait ? 1 : 1;
  [-0.6, 0, 0.55, 1.0].forEach((o, i) => {
    const x = px + o * h;
    person(g, x, fy, h * (i === 3 ? 0.65 : 1), { color: ['#141a28', '#1a2030', '#121826', '#1a1e2c'][i], pose: i === 1 ? 'wave' : 'stand', phase: 0.03, dir, dress: i === 2 });
    // glasses glint
    const hy = fy - h * (i === 3 ? 0.65 : 1) * 0.88;
    fillA(g, '#2a2a2a', 1, () => g.rect(x + dir * h * 0.03, hy - 2 * u, h * 0.09, 4 * u));
  });
});

// ================================================================== FAMINE

const famine = mk(3.8, (f) => {
  const { g, L, t } = f;
  const u = U(L);
  const fy = FY(L, u);
  const fh = FH(L);
  const ps = particles(f.mem);
  sky(g, L, ['#7a5e44', '#b8935e', '#dcbc86']);
  glow(g, L.w * 0.6, L.h * 0.18, fh * 1.2, 'rgba(255,240,200,0.6)');
  fillA(g, '#f4e2b8', 0.8, () => circ(g, L.w * 0.6, L.h * 0.18, fh * 0.25));
  hills(g, L, fy - fh * 0.05, fh * 0.2, '#a8844f', 7.7);
  floor(g, L, fy, '#9a7644');
  // withered stalks swaying
  const stalks = once(f.mem, 'stk', () => {
    const r = makeRand(13);
    return Array.from({ length: 60 }, () => [r(), r(), r()] as [number, number, number]);
  });
  g.strokeStyle = '#6a5228';
  g.lineWidth = 2 * u;
  g.lineCap = 'round';
  for (const [sx, sy, sh] of stalks) {
    const x = sx * L.w;
    if (hidden(L, x)) continue;
    const y = fy + 4 * u + sy * (L.h - fy) * 0.4;
    const hh = fh * (0.15 + sh * 0.2);
    const bend = 0.6 + Math.sin(t * 2 + sx * 9) * 0.15;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + hh * 0.1, y - hh * 0.8, x + hh * bend * 0.6, y - hh * (1 - bend * 0.4));
    g.stroke();
  }
  // cracks
  g.strokeStyle = '#6a4e28';
  g.lineWidth = 1.5 * u;
  for (let i = 0; i < 10; i++) {
    const x = ((i * 0.13 + 0.05) % 1) * L.w;
    line(g, x, fy + 10 * u, x + 30 * u, fy + 30 * u + (i % 3) * 10 * u);
  }
  const [ax, bx] = AB(L, 0.32, 0.74);
  const h = fh * (L.portrait ? 0.85 : 1);
  // parent holding out an empty bowl, child beside
  person(g, ax, fy, h, { color: '#3a2a1e', pose: 'hold', dir: 1, hat: 'hood', accent: '#4a3624', dress: true });
  g.save();
  g.translate(ax + h * 0.3, fy - h * 0.66);
  g.rotate(-0.35);
  bowl(g, 0, h * 0.04, h * 0.08, '#8a6a4a', '#3a2a1a');
  g.restore();
  person(g, ax - h * 0.38, fy, h * 0.58, { color: '#3a2a1e', pose: 'stand', dir: 1 });
  // empty bowls in a row and a bare tree with a crow
  const tX = L.portrait ? L.w * 0.86 : bx + h * 0.4;
  tree(g, tX, fy, h * 1.4, '#4a3420', 41);
  g.fillStyle = '#1a1414';
  g.beginPath();
  g.ellipse(tX - h * 0.2, fy - h * 0.92, h * 0.06, h * 0.035, 0, 0, TAU);
  circ(g, tX - h * 0.25, fy - h * 0.95, h * 0.025);
  g.fill();
  const bowlsX = L.portrait ? [L.w * 0.55, L.w * 0.64, L.w * 0.73] : [bx - h * 0.6, bx - h * 0.3, bx];
  bowlsX.forEach((x, i) => {
    g.save();
    g.translate(x, fy);
    g.rotate(i === 1 ? 0.3 : 0);
    bowl(g, 0, 0, h * 0.08, '#7a5a3a', '#2e2216');
    g.restore();
  });
  // blowing dust
  emit(f, 'du', 16, () => add(ps, P(-20, fy - f.rand() * fh * 1.2, (180 + f.rand() * 120) * u, (f.rand() - 0.5) * 20 * u, 3.5, (14 + f.rand() * 18) * u, f.rand.pick(['#c8a676', '#b8946a', '#d8b888']), 3)));
  emit(f, 'ds', 10, () => add(ps, P(-20, fy - f.rand() * fh * 1.5, (500 + f.rand() * 200) * u, 0, 1.6, 1.5 * u, 'rgba(240,220,180,0.7)', 1)));
  stepParticles(ps, f.dt, 0);
  drawParts(g, ps, 0.8);
  wash(g, L, '#c8a070', 0.15);
});

// ================================================================== REFUGEES

const refugees = mk(4.2, (f) => {
  const { g, L, t } = f;
  const u = U(L);
  const fy = FY(L, u);
  const fh = FH(L);
  sky(g, L, ['#262848', '#6a4a6a', '#d88a5a']);
  glow(g, L.w * 0.5, fy - fh * 0.1, L.w * 0.4, 'rgba(255,170,100,0.6)');
  fillA(g, '#ffcf8a', 1, () => circ(g, L.w * 0.5, fy - fh * 0.05, fh * 0.35));
  hills(g, L, fy - fh * 0.15, fh * 0.4, '#4a3048', 8.3, 0.8);
  hills(g, L, fy, fh * 0.2, '#2e1e30', 2.9, 1.4);
  floor(g, L, fy, '#24182a');
  // birds
  g.strokeStyle = '#1a1220';
  g.lineWidth = 2 * u;
  for (let i = 0; i < 5; i++) {
    const bx = ((i * 0.21 + t * 0.04) % 1) * L.w;
    const by = L.h * (0.12 + (i % 3) * 0.05);
    const fl = Math.sin(t * 8 + i) * 5 * u;
    g.beginPath();
    g.moveTo(bx - 8 * u, by - fl);
    g.lineTo(bx, by);
    g.lineTo(bx + 8 * u, by - fl);
    g.stroke();
  }
  // the line of walkers
  const h = fh * (L.portrait ? 0.7 : 0.85);
  const sp = h * 0.55;
  const off = t * 22 * u;
  const n = Math.ceil(L.w / sp) + 2;
  const cols = ['#1a1220', '#20162a', '#181020', '#221826'];
  for (let i = 0; i < n; i++) {
    const x = ((i * sp + off) % (n * sp)) - sp;
    if (hidden(L, x, -h * 0.3)) continue;
    const kind = (i * 7) % 5;
    const c = cols[i % 4];
    const hh = kind === 4 ? h * 0.6 : h * (0.92 + ((i * 3) % 4) * 0.03);
    const ph = t * 0.55 + i * 0.37;
    person(g, x, fy, hh, { color: c, pose: 'walk', phase: ph, dir: 1, dress: kind === 1 || kind === 3, accent: c, hat: kind === 2 ? 'hood' : 'none' });
    g.fillStyle = ['#6a4a3a', '#5a5a7a', '#7a5a3a', '#4a5a4a', '#6a3a4a'][kind];
    if (kind === 0 || kind === 3) {
      g.beginPath();
      g.ellipse(x, fy - hh * 1.06, hh * 0.13, hh * 0.07, 0, 0, TAU);
      g.fill();
    } else if (kind === 1 || kind === 2) {
      g.beginPath();
      circ(g, x - hh * 0.12, fy - hh * 0.62, hh * 0.13);
      g.fill();
    }
  }
  wash(g, L, '#d88a5a', 0.06);
});

// ================================================================== INVENTION

function gear(g: G, x: number, y: number, r: number, teeth: number, rot: number, col: string): void {
  g.fillStyle = col;
  g.beginPath();
  const st = Math.PI / teeth;
  for (let i = 0; i < teeth * 2; i++) {
    const a = rot + i * st;
    const rr = i % 2 ? r : r * 1.2;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    g.lineTo(x + Math.cos(a + st * 0.7) * rr, y + Math.sin(a + st * 0.7) * rr);
  }
  g.closePath();
  g.fill();
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.beginPath();
  circ(g, x, y, r * 0.3);
  g.fill();
}

const invention = mk(3.6, (f) => {
  const { g, L, t } = f;
  const u = U(L);
  const fy = FY(L, u);
  const fh = FH(L);
  const ps = particles(f.mem);
  const tOn = 1.3;
  const on = t >= tOn ? 1 : Math.sin(t * 37) * Math.sin(t * 13) > 0.25 && t > 0.4 ? 0.7 : 0.05;
  sky(g, L, ['#10141e', '#1c2232', '#283044']);
  wash(g, L, '#ffe9a0', on * 0.12);
  floor(g, L, fy, '#141822');
  const bX = L.portrait ? L.w * 0.5 : L.slots[0];
  const bY = L.portrait ? L.h * 0.2 : fy - fh * 1.25;
  const R = fh * (L.portrait ? 0.4 : 0.48);
  // rays
  if (on === 1) {
    g.save();
    g.translate(bX, bY);
    g.rotate(t * 0.4);
    g.globalAlpha *= clamp((t - tOn) * 3) * 0.3;
    g.fillStyle = '#fff2b0';
    for (let i = 0; i < 12; i++) {
      g.rotate(TAU / 12);
      g.beginPath();
      g.moveTo(R * 1.2, -R * 0.12);
      g.lineTo(R * 2.6, 0);
      g.lineTo(R * 1.2, R * 0.12);
      g.fill();
    }
    g.restore();
  }
  glow(g, bX, bY, R * 3.5, 'rgba(255,225,120,0.9)', on);
  // glass
  g.fillStyle = on > 0.5 ? '#fff6c8' : 'rgba(200,215,235,0.35)';
  g.beginPath();
  g.arc(bX, bY, R, Math.PI * 0.78, Math.PI * 2.22);
  g.lineTo(bX + R * 0.38, bY + R * 1.15);
  g.lineTo(bX - R * 0.38, bY + R * 1.15);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.7)';
  g.lineWidth = 3 * u;
  g.beginPath();
  g.arc(bX, bY, R * 0.75, Math.PI * 1.1, Math.PI * 1.4);
  g.stroke();
  // filament
  g.strokeStyle = on > 0.5 ? '#ff9a1a' : '#6a5a4a';
  g.lineWidth = 3 * u;
  g.beginPath();
  g.moveTo(bX - R * 0.2, bY + R * 1.1);
  g.lineTo(bX - R * 0.2, bY + R * 0.1);
  for (let i = 0; i <= 6; i++) g.lineTo(bX - R * 0.2 + (i * R * 0.4) / 6, bY + (i % 2 ? -R * 0.1 : R * 0.1));
  g.lineTo(bX + R * 0.2, bY + R * 1.1);
  g.stroke();
  // screw base
  for (let i = 0; i < 4; i++) {
    g.fillStyle = i % 2 ? '#7a8494' : '#a8b2c0';
    g.fillRect(bX - R * 0.42, bY + R * 1.15 + i * R * 0.13, R * 0.84, R * 0.13);
  }
  g.fillStyle = '#3a3a3a';
  g.beginPath();
  g.arc(bX, bY + R * 1.67, R * 0.2, 0, Math.PI);
  g.fill();
  if (at(f, 'pop', tOn)) {
    for (let i = 0; i < 40; i++) {
      const a = f.rand() * TAU;
      const s = (300 + f.rand() * 500) * u;
      add(ps, P(bX + Math.cos(a) * R, bY + Math.sin(a) * R, Math.cos(a) * s, Math.sin(a) * s, 0.8, 2.5 * u, f.rand.pick(['#fff1a0', '#ffc84a', '#ffffff']), 1));
    }
  }
  // inventor
  const h = fh * (L.portrait ? 0.8 : 1);
  const ix = L.portrait ? L.w * 0.18 : bX - fh * 0.75;
  person(g, ix, fy, h, { color: '#1a1e2a', pose: t > tOn ? 'cheer' : 'stand', phase: t, dir: 1 });
  // gears
  const gX = L.portrait ? L.w * 0.8 : L.slots[1];
  const gY = L.portrait ? fy - fh * 0.55 : fy - fh * 0.75;
  const gr = fh * (L.portrait ? 0.22 : 0.32);
  const sp = t < tOn ? 0.5 : 2.2;
  const rot = (f.mem.rot as number | undefined) ?? 0;
  f.mem.rot = rot + sp * f.dt;
  gear(g, gX, gY, gr, 12, rot, '#c8963a');
  gear(g, gX + gr * 1.95, gY - gr * 0.6, gr * 0.6, 8, -rot * 1.5 + 0.2, '#8a96a8');
  gear(g, gX - gr * 1.4, gY + gr * 1.05, gr * 0.5, 7, -rot * 1.7 + 0.1, '#a87a3a');
  if (t > tOn) emit(f, 'gs', 18, () => add(ps, P(gX + gr * 1.2, gY - gr * 0.35, (f.rand() - 0.2) * 250 * u, -(f.rand() * 250 + 50) * u, 0.5, 2 * u, '#ffd36a', 1)));
  stepParticles(ps, f.dt, 500 * u);
  drawParts(g, ps);
});

// ================================================================== MOON LANDING

function astronaut(g: G, x: number, y: number, h: number, dir: number, armUp: number): void {
  g.save();
  g.translate(x, y);
  g.scale(dir, 1);
  g.fillStyle = '#d8dade';
  g.fillRect(-h * 0.24, -h * 0.72, h * 0.16, h * 0.32);
  g.fillStyle = '#f4f5f7';
  g.lineCap = 'round';
  g.strokeStyle = '#f4f5f7';
  g.lineWidth = h * 0.12;
  line(g, -h * 0.05, -h * 0.42, -h * 0.1, -h * 0.04);
  line(g, h * 0.05, -h * 0.42, h * 0.1, -h * 0.04);
  g.beginPath();
  rrect(g, -h * 0.14, -h * 0.78, h * 0.28, h * 0.42, h * 0.08);
  g.fill();
  g.lineWidth = h * 0.09;
  line(g, h * 0.08, -h * 0.7, h * 0.08 + h * 0.2, -h * 0.7 + lerp(h * 0.18, -h * 0.12, armUp));
  line(g, -h * 0.08, -h * 0.7, -h * 0.12, -h * 0.46);
  g.beginPath();
  circ(g, 0, -h * 0.88, h * 0.14);
  g.fill();
  g.fillStyle = '#d8a73a';
  g.beginPath();
  g.ellipse(h * 0.05, -h * 0.88, h * 0.08, h * 0.09, 0, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.8)';
  g.beginPath();
  circ(g, h * 0.08, -h * 0.92, h * 0.02);
  g.fill();
  g.fillStyle = '#5a6a7a';
  g.fillRect(-h * 0.06, -h * 0.66, h * 0.12, h * 0.07);
  g.restore();
}

const moonLanding = mk(4.2, (f) => {
  const { g, L, t } = f;
  const u = U(L);
  const fy = FY(L, u);
  const fh = FH(L);
  const ps = particles(f.mem);
  sky(g, L, ['#000004', '#03051a', '#0a0c22']);
  drawStars(g, starsOf(f.mem, L, 140, fy), t, 1, u);
  // Earth
  const eX = L.portrait ? L.w * 0.8 : L.slots[1] + fh * 0.4;
  const eY = L.portrait ? L.h * 0.1 : L.h * 0.22;
  const eR = fh * (L.portrait ? 0.22 : 0.32);
  glow(g, eX, eY, eR * 2, 'rgba(110,170,255,0.6)');
  g.fillStyle = '#2a6ad0';
  g.beginPath();
  circ(g, eX, eY, eR);
  g.fill();
  g.save();
  g.beginPath();
  circ(g, eX, eY, eR);
  g.clip();
  g.fillStyle = '#4aa860';
  const sh = (t * 6) % (eR * 2);
  for (const [cx, cy, rx, ry] of [
    [-0.3, -0.2, 0.35, 0.25],
    [0.4, 0.3, 0.3, 0.4],
    [-0.1, 0.5, 0.2, 0.15],
    [1.6, -0.3, 0.3, 0.3],
  ]) {
    g.beginPath();
    g.ellipse(eX + cx * eR + sh - eR, eY + cy * eR, rx * eR, ry * eR, 0.4, 0, TAU);
    g.fill();
  }
  g.fillStyle = 'rgba(255,255,255,0.75)';
  g.fillRect(eX - eR, eY - eR * 0.55, eR * 2, eR * 0.08);
  g.fillRect(eX - eR, eY + eR * 0.2, eR * 2, eR * 0.06);
  g.fillStyle = 'rgba(0,0,10,0.55)';
  g.beginPath();
  circ(g, eX + eR * 0.55, eY + eR * 0.2, eR * 1.05);
  g.fill();
  g.restore();
  // lunar ground with craters
  g.fillStyle = '#8e8e96';
  g.beginPath();
  g.moveTo(0, L.h);
  g.lineTo(0, fy - fh * 0.05);
  g.quadraticCurveTo(L.w * 0.5, fy - fh * 0.2, L.w, fy - fh * 0.05);
  g.lineTo(L.w, L.h);
  g.fill();
  const cr = once(f.mem, 'cr', () => {
    const r = makeRand(4);
    return Array.from({ length: 16 }, () => [r(), r(), 0.3 + r()] as [number, number, number]);
  });
  for (const [cx, cy, cs] of cr) {
    const x = cx * L.w;
    const y = fy + cy * (L.h - fy) * 0.6;
    fillA(g, '#6e6e76', 1, () => g.ellipse(x, y, cs * fh * 0.2, cs * fh * 0.05, 0, 0, TAU));
    fillA(g, '#a8a8b0', 1, () => g.ellipse(x, y + cs * fh * 0.015, cs * fh * 0.17, cs * fh * 0.03, 0, 0, Math.PI));
  }
  // lander
  const lx = L.portrait ? L.w * 0.76 : L.slots[1] - fh * 0.3;
  const lh = fh * (L.portrait ? 0.6 : 0.85);
  g.strokeStyle = '#b0b0b8';
  g.lineWidth = 3 * u;
  line(g, lx - lh * 0.3, fy - lh * 0.35, lx - lh * 0.55, fy);
  line(g, lx + lh * 0.3, fy - lh * 0.35, lx + lh * 0.55, fy);
  g.fillStyle = '#d9a83a';
  g.beginPath();
  g.moveTo(lx - lh * 0.35, fy - lh * 0.3);
  g.lineTo(lx + lh * 0.35, fy - lh * 0.3);
  g.lineTo(lx + lh * 0.3, fy - lh * 0.6);
  g.lineTo(lx - lh * 0.3, fy - lh * 0.6);
  g.fill();
  g.fillStyle = '#c8ccd4';
  g.beginPath();
  g.moveTo(lx - lh * 0.25, fy - lh * 0.6);
  g.lineTo(lx + lh * 0.28, fy - lh * 0.6);
  g.lineTo(lx + lh * 0.2, fy - lh * 0.95);
  g.lineTo(lx - lh * 0.15, fy - lh * 1.0);
  g.closePath();
  g.fill();
  g.fillStyle = '#2a3040';
  g.fillRect(lx - lh * 0.05, fy - lh * 0.88, lh * 0.12, lh * 0.1);
  // astronaut planting a flag
  const ax = L.portrait ? L.w * 0.34 : L.slots[0];
  const h = fh * (L.portrait ? 0.85 : 1);
  const hop = t < 1.0 ? Math.abs(Math.sin(t * Math.PI * 2)) * h * 0.08 : 0;
  const plant = span(t, 1.0, 1.5);
  astronaut(g, ax - h * 0.15, fy - hop, h, 1, 1 - plant * 0.5);
  const poleX = ax + h * 0.2;
  const poleTop = fy - h * 1.15 - (1 - plant) * h * 0.2;
  g.strokeStyle = '#e8e8ec';
  g.lineWidth = 3.5 * u;
  line(g, poleX, poleTop, poleX, fy - (1 - plant) * h * 0.2);
  const unf = easeOut(clamp((t - 1.5) / 0.8));
  const fw = h * 0.5 * unf;
  const fhh = h * 0.3;
  if (fw > 1) {
    g.fillStyle = '#e04a4a';
    g.beginPath();
    g.moveTo(poleX, poleTop);
    for (let i = 0; i <= 8; i++) g.lineTo(poleX + (fw * i) / 8, poleTop + Math.sin(i * 0.8 + t * 2) * 2 * u * (1 - unf * 0.7));
    for (let i = 8; i >= 0; i--) g.lineTo(poleX + (fw * i) / 8, poleTop + fhh + Math.sin(i * 0.8 + t * 2) * 2 * u * (1 - unf * 0.7));
    g.fill();
    g.fillStyle = '#ffffff';
    g.fillRect(poleX, poleTop + fhh * 0.4, fw, fhh * 0.2);
    star(g, poleX + fw * 0.25, poleTop + fhh * 0.22, fhh * 0.12 * unf, '#ffe066');
  }
  if (at(f, 'dust', 1.45)) for (let i = 0; i < 16; i++) add(ps, P(poleX, fy, (f.rand() - 0.5) * 140 * u, -(30 + f.rand() * 60) * u, 1.6, (4 + f.rand() * 6) * u, '#c8c8d0', 3));
  if (t < 1.0 && at(f, 'hop' + Math.floor(t * 2), t)) add(ps, P(ax - h * 0.15, fy, 0, -10 * u, 0.8, 6 * u, '#c8c8d0', 3));
  stepParticles(ps, f.dt, 60 * u);
  drawParts(g, ps);
});

// ================================================================== INTERNET

const internet = mk(3.8, (f) => {
  const { g, L, t } = f;
  const u = U(L);
  const fy = FY(L, u);
  const fh = FH(L);
  sky(g, L, ['#030818', '#081634', '#0e2448']);
  const cX = L.portrait ? L.w * 0.5 : L.slots[0];
  const cY = L.portrait ? L.h * 0.27 : L.h * 0.42;
  const R = fh * (L.portrait ? 0.85 : 0.95) * easeOut(clamp(t / 0.6) * 0.5 + 0.5);
  const rot = t * 0.6;
  glow(g, cX, cY, R * 1.8, 'rgba(60,160,255,0.5)');
  const grad = g.createRadialGradient(cX - R * 0.3, cY - R * 0.3, R * 0.1, cX, cY, R);
  grad.addColorStop(0, '#1e5aa0');
  grad.addColorStop(1, '#0a2448');
  g.fillStyle = grad;
  g.beginPath();
  circ(g, cX, cY, R);
  g.fill();
  g.strokeStyle = 'rgba(110,210,255,0.35)';
  g.lineWidth = 1.5 * u;
  for (let i = 0; i < 6; i++) {
    const a = rot + (i * Math.PI) / 6;
    const rx = Math.abs(Math.cos(a)) * R;
    g.beginPath();
    g.ellipse(cX, cY, rx, R, 0, 0, TAU);
    g.stroke();
  }
  for (let i = -2; i <= 2; i++) {
    const yy = cY + (i / 3) * R;
    const rx = Math.sqrt(Math.max(0, R * R - (yy - cY) ** 2));
    line(g, cX - rx, yy, cX + rx, yy);
  }
  // nodes on the sphere and arcs between them
  const nodes = once(f.mem, 'nd', () => {
    const r = makeRand(8);
    return Array.from({ length: 12 }, () => [r() * TAU, (r() - 0.5) * 2.2] as [number, number]);
  });
  const proj = nodes.map(([lon, lat]) => {
    const cl = Math.cos(lat);
    return { x: cX + R * cl * Math.sin(lon + rot), y: cY - R * Math.sin(lat) * 0.9, z: cl * Math.cos(lon + rot) };
  });
  const reveal = clamp(t / 1.5);
  g.lineWidth = 2 * u;
  for (let i = 0; i < proj.length; i++) {
    const a = proj[i];
    const b = proj[(i * 5 + 3) % proj.length];
    if (a.z < -0.1 || b.z < -0.1 || i / proj.length > reveal) continue;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const ox = (mx - cX) * 0.6;
    const oy = (my - cY) * 0.6 - R * 0.25;
    const qx = mx + ox;
    const qy = my + oy;
    g.strokeStyle = 'rgba(90,240,255,0.7)';
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.quadraticCurveTo(qx, qy, b.x, b.y);
    g.stroke();
    const k = (t * 0.8 + i * 0.27) % 1;
    const px = (1 - k) * (1 - k) * a.x + 2 * (1 - k) * k * qx + k * k * b.x;
    const py = (1 - k) * (1 - k) * a.y + 2 * (1 - k) * k * qy + k * k * b.y;
    glow(g, px, py, 10 * u, 'rgba(255,255,255,1)');
    fillA(g, '#ff7af0', 1, () => circ(g, px, py, 3 * u));
  }
  for (const p of proj) {
    if (p.z < 0) continue;
    glow(g, p.x, p.y, 9 * u, 'rgba(120,255,220,0.9)', p.z);
    fillA(g, '#c8fff0', p.z, () => circ(g, p.x, p.y, 3 * u));
  }
  // devices receiving streams
  const dX = L.portrait ? L.w * 0.5 : L.slots[1];
  const dY = L.portrait ? L.h * 0.5 : fy - fh * 0.2;
  const ds = fh * (L.portrait ? 0.35 : 0.55);
  const devs = L.portrait ? [-1.1, 0, 1.1] : [-0.9, 0, 0.9];
  devs.forEach((o, i) => {
    const x = dX + o * ds * 1.2;
    const y = dY - (i === 1 ? ds * 0.3 : 0);
    const lit = clamp((t - 0.6 - i * 0.3) * 2);
    glow(g, x, y - ds * 0.3, ds * 0.9, 'rgba(80,200,255,0.5)', lit);
    g.fillStyle = '#1a2a40';
    g.beginPath();
    if (i === 1) rrect(g, x - ds * 0.45, y - ds * 0.62, ds * 0.9, ds * 0.58, ds * 0.05);
    else rrect(g, x - ds * 0.18, y - ds * 0.66, ds * 0.36, ds * 0.62, ds * 0.06);
    g.fill();
    g.fillStyle = `rgba(90,220,255,${0.25 + 0.6 * lit})`;
    if (i === 1) g.fillRect(x - ds * 0.4, y - ds * 0.57, ds * 0.8, ds * 0.48);
    else g.fillRect(x - ds * 0.14, y - ds * 0.6, ds * 0.28, ds * 0.5);
    if (i === 1) {
      g.fillStyle = '#2a3a50';
      g.fillRect(x - ds * 0.55, y - ds * 0.04, ds * 1.1, ds * 0.06);
    }
  });
  // packet stream along the bottom
  for (let i = 0; i < 18; i++) {
    const k = (t * 0.5 + i / 18) % 1;
    const x = k * L.w;
    if (hidden(L, x)) continue;
    const y = (L.portrait ? L.h * 0.53 : fy + fh * 0.08) + Math.sin(k * 20 + i) * 6 * u;
    fillA(g, i % 3 ? '#5af0ff' : '#ff7af0', 0.8, () => g.rect(x, y, 8 * u, 3 * u));
  }
});

// ================================================================== PARADE

const parade = mk(4.0, (f) => {
  const { g, L, t } = f;
  const u = U(L);
  const fy = FY(L, u);
  const fh = FH(L);
  const ps = particles(f.mem);
  sky(g, L, ['#5ab0f0', '#9ad0f4', '#e8f4f8']);
  floor(g, L, fy, '#8a8a94');
  g.fillStyle = '#b8b8c0';
  g.fillRect(0, fy, L.w, 6 * u);
  // bunting
  for (let row = 0; row < 2; row++) {
    const y0 = L.h * (0.06 + row * 0.08);
    const sag = 30 * u;
    const n = Math.floor(L.w / (26 * u));
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5) * (L.w / n);
      const q = (x % (L.w / 2)) / (L.w / 2);
      const y = y0 + Math.sin(q * Math.PI) * sag + Math.sin(t * 3 + i) * 2 * u;
      g.fillStyle = CONFETTI_COLORS[(i + row) % CONFETTI_COLORS.length];
      g.beginPath();
      g.moveTo(x - 10 * u, y);
      g.lineTo(x + 10 * u, y);
      g.lineTo(x, y + 18 * u);
      g.fill();
    }
  }
  const [ax, bx] = AB(L, 0.3, 0.74);
  const h = fh * (L.portrait ? 0.72 : 1);
  // marching band
  const n = L.portrait ? 2 : 3;
  const bob = Math.abs(Math.sin(t * 6)) * h * 0.03;
  for (let i = 0; i < n; i++) {
    const x = ax + (i - (n - 1) / 2) * h * 0.5 + Math.sin(t * 0.8) * 8 * u;
    person(g, x, fy - bob, h, { color: '#2a2a5a', pose: 'walk', phase: t * 0.9, dir: 1, accent: '#f2c94c' });
    const head = h * 0.13;
    const hy = fy - bob - h * 0.74 - head * 1.05;
    g.fillStyle = '#c0283a';
    g.fillRect(x - head * 0.9, hy - head * 2.3, head * 1.8, head * 1.6);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.ellipse(x, hy - head * 2.7, head * 0.35, head * 0.6, 0, 0, TAU);
    g.fill();
    const iy = fy - bob - h * 0.5;
    if (i === 0) {
      g.fillStyle = '#e8e8f0';
      g.beginPath();
      g.ellipse(x + h * 0.08, iy, h * 0.14, h * 0.12, 0, 0, TAU);
      g.fill();
      g.strokeStyle = '#c0283a';
      g.lineWidth = 3 * u;
      g.stroke();
      if (Math.sin(t * 12) > 0.6) star(g, x + h * 0.08, iy - h * 0.14, 6 * u, '#ffffff');
    } else {
      g.strokeStyle = '#f2c94c';
      g.lineWidth = h * 0.05;
      g.beginPath();
      g.arc(x + h * 0.1, iy - h * 0.05, h * 0.12, -Math.PI * 0.5, Math.PI * 1.1);
      g.stroke();
      g.fillStyle = '#f2c94c';
      g.beginPath();
      g.ellipse(x + h * 0.1, iy - h * 0.2, h * 0.1, h * 0.05, 0, 0, TAU);
      g.fill();
    }
  }
  emit(f, 'nt', 4, () => add(ps, P(ax + (f.rand() - 0.5) * h, fy - h * 1.1, (f.rand() - 0.5) * 30 * u, -50 * u, 2, 9 * u, '#2a2a5a', 7)));
  // float
  const fx = bx + Math.sin(t * 0.7) * 10 * u;
  const fw = h * 1.4;
  const wob = Math.sin(t * 4) * 2 * u;
  g.fillStyle = '#1c1c22';
  g.beginPath();
  circ(g, fx - fw * 0.3, fy - h * 0.08, h * 0.08);
  circ(g, fx + fw * 0.3, fy - h * 0.08, h * 0.08);
  g.fill();
  g.fillStyle = '#ff5d9e';
  g.beginPath();
  rrect(g, fx - fw / 2, fy - h * 0.42 + wob, fw, h * 0.28, h * 0.06);
  g.fill();
  g.fillStyle = '#ffd166';
  for (let i = 0; i < 9; i++) {
    g.beginPath();
    g.arc(fx - fw / 2 + (i + 0.5) * (fw / 9), fy - h * 0.14 + wob, fw / 18, 0, Math.PI);
    g.fill();
  }
  g.save();
  g.translate(fx + fw * 0.2, fy - h * 0.85 + wob);
  g.rotate(t * 0.8);
  for (let i = 0; i < 8; i++) {
    g.rotate(TAU / 8);
    g.fillStyle = i % 2 ? '#ffd166' : '#ff9f1c';
    g.beginPath();
    g.ellipse(h * 0.18, 0, h * 0.16, h * 0.07, 0, 0, TAU);
    g.fill();
  }
  g.fillStyle = '#c0283a';
  g.beginPath();
  circ(g, 0, 0, h * 0.1);
  g.fill();
  g.restore();
  person(g, fx - fw * 0.25, fy - h * 0.42 + wob, h * 0.8, { color: '#3a1e4a', pose: 'wave', phase: t, dir: 1, dress: true, accent: '#06d6a0', hat: 'crown' });
  // balloons
  for (let i = 0; i < 3; i++) {
    const bxx = fx - fw * 0.45 + i * 12 * u;
    const byy = fy - h * (1.3 + i * 0.1) + Math.sin(t * 2 + i) * 4 * u;
    g.strokeStyle = '#555';
    g.lineWidth = 1;
    line(g, bxx, byy, fx - fw * 0.45, fy - h * 0.42 + wob);
    g.fillStyle = ['#4cc9f0', '#ff5d73', '#ffd166'][i];
    g.beginPath();
    g.ellipse(bxx, byy, h * 0.07, h * 0.09, 0, 0, TAU);
    g.fill();
  }
  emit(f, 'cf', 45, () => add(ps, P(visX(L, f.rand, 10), -10, (f.rand() - 0.5) * 60 * u, (60 + f.rand() * 60) * u, 4, (6 + f.rand() * 5) * u, f.rand.pick(CONFETTI_COLORS), 2, f.rand() * TAU, (f.rand() - 0.5) * 10)));
  stepParticles(ps, f.dt, 0);
  drawParts(
    g,
    ps.filter((p) => p.kind !== 7),
  );
  for (const p of ps) {
    if (p.kind !== 7) continue;
    const base = g.globalAlpha;
    g.globalAlpha = base * clamp(1 - p.life / p.max);
    g.fillStyle = p.color;
    g.beginPath();
    g.ellipse(p.x, p.y, p.size * 0.6, p.size * 0.45, -0.4, 0, TAU);
    g.fill();
    g.fillRect(p.x + p.size * 0.45, p.y - p.size * 1.6, 2 * u, p.size * 1.6);
    g.globalAlpha = base;
  }
});

// ================================================================== ROYAL BALL

function chandelier(g: G, x: number, y: number, s: number, t: number): void {
  g.save();
  g.translate(x, 0);
  g.rotate(Math.sin(t * 0.9) * 0.02);
  g.strokeStyle = '#c8a24a';
  g.lineWidth = 2;
  line(g, 0, 0, 0, y);
  g.fillStyle = '#d8b24a';
  g.beginPath();
  g.ellipse(0, y + s * 0.05, s * 0.55, s * 0.08, 0, 0, TAU);
  g.ellipse(0, y - s * 0.2, s * 0.32, s * 0.05, 0, 0, TAU);
  g.fill();
  g.beginPath();
  g.moveTo(-s * 0.1, y + s * 0.1);
  g.lineTo(0, y + s * 0.35);
  g.lineTo(s * 0.1, y + s * 0.1);
  g.fill();
  const flames = (n: number, rx: number, yy: number) => {
    for (let i = 0; i < n; i++) {
      const fx = -rx + (2 * rx * i) / (n - 1);
      g.fillStyle = '#f4ecd8';
      g.fillRect(fx - 2, yy - s * 0.1, 4, s * 0.1);
      glow(g, fx, yy - s * 0.13, s * 0.18 * (1 + Math.sin(t * 11 + i) * 0.08), 'rgba(255,210,120,0.9)');
      g.fillStyle = '#ffe08a';
      g.beginPath();
      g.ellipse(fx, yy - s * 0.13, 2.5, 5, 0, 0, TAU);
      g.fill();
    }
  };
  flames(5, s * 0.5, y + s * 0.02);
  flames(3, s * 0.28, y - s * 0.23);
  for (let i = 0; i < 6; i++) {
    const cx = -s * 0.45 + i * s * 0.18;
    if (Math.sin(t * 5 + i * 2) > 0.7) star(g, cx, y + s * 0.15, s * 0.05, '#ffffff', t);
  }
  g.restore();
}

const royalBall = mk(4.0, (f) => {
  const { g, L, t } = f;
  const u = U(L);
  const fy = FY(L, u);
  const fh = FH(L);
  const ps = particles(f.mem);
  sky(g, L, ['#2a0c1e', '#4a1830', '#5e2438']);
  // tall arched windows and pillars
  const step = fh * 0.9;
  for (let x = step * 0.5; x < L.w; x += step) {
    if (hidden(L, x, -20)) continue;
    const i = Math.round(x / step);
    if (i % 2) {
      fillA(g, '#3a4a7a', 0.55, () => {
        g.rect(x - fh * 0.16, fy - fh * 1.7, fh * 0.32, fh * 1.2);
        g.arc(x, fy - fh * 1.7, fh * 0.16, Math.PI, 0);
      });
      glow(g, x, fy - fh * 1.4, fh * 0.5, 'rgba(180,200,255,0.25)');
    } else {
      g.fillStyle = '#e8d8b8';
      g.fillRect(x - fh * 0.07, 0, fh * 0.14, fy);
      g.fillStyle = '#c8a24a';
      g.fillRect(x - fh * 0.1, fy - fh * 0.08, fh * 0.2, fh * 0.08);
    }
  }
  // polished floor
  floor(g, L, fy, '#3a1424');
  for (let i = 0; i < 12; i++) {
    const x = (i / 12) * L.w;
    fillA(g, '#5a2434', 0.6, () => g.rect(x, fy, L.w / 24, L.h - fy));
  }
  // chandeliers
  const [ax, bx] = AB(L, 0.28, 0.72);
  const cs = fh * (L.portrait ? 0.55 : 0.75);
  const cy = L.portrait ? L.h * 0.12 : L.h * 0.18;
  chandelier(g, ax, cy, cs, t);
  chandelier(g, bx, cy, cs, t + 1);
  // waltzing couples
  const h = fh * (L.portrait ? 0.62 : 0.85);
  const dressCols = ['#e8406a', '#4ac0e0', '#f2c94c', '#b388ff'];
  const couples = L.portrait ? [[L.w * 0.5, 0]] : [
    [ax, 0],
    [bx, 2],
  ];
  const items: { x: number; y: number; s: number; a: number; c: number }[] = [];
  for (const [cx, ci] of couples) {
    for (let k = 0; k < 2; k++) {
      const a = t * 1.4 + k * Math.PI;
      items.push({ x: cx + Math.cos(a) * h * 0.6, y: fy + Math.sin(a) * h * 0.08, s: 0.88 + 0.12 * Math.sin(a), a, c: ci + k });
    }
  }
  items.sort((p, q) => p.y - q.y);
  for (const it of items) {
    const hh = h * it.s;
    const spin = Math.sin(it.a * 2) * 0.2;
    const dcol = dressCols[it.c % 4];
    glow(g, it.x, it.y, hh * 0.4, 'rgba(255,220,160,0.25)');
    person(g, it.x - hh * 0.12, it.y, hh, { color: '#1a0a14', pose: 'hold', dir: 1, accent: '#f4f4f4' });
    g.save();
    g.translate(it.x + hh * 0.12, it.y);
    g.rotate(spin * 0.3);
    person(g, 0, 0, hh * 0.95, { color: '#2a1020', pose: 'hold', dir: -1, dress: true, accent: dcol });
    g.fillStyle = dcol;
    g.beginPath();
    g.moveTo(-hh * 0.1, -hh * 0.36);
    g.lineTo(hh * 0.1, -hh * 0.36);
    g.lineTo(hh * (0.26 + spin), 0);
    g.lineTo(-hh * (0.26 - spin), 0);
    g.closePath();
    g.fill();
    g.restore();
  }
  emit(f, 'sp', 10, () => add(ps, P(visX(L, f.rand), f.rand() * fy, 0, 8 * u, 1.2, 2 * u, '#fff1c0', 0)));
  stepParticles(ps, f.dt, 0);
  drawParts(g, ps);
});

// ================================================================== JOUST

function knight(g: G, x: number, y: number, h: number, dir: 1 | -1, ph: number, cloth: string, lance: number, tilt = 0): void {
  const hh = h * 0.62;
  horse(g, x, y, hh, dir, ph, '#2a1f1a', cloth, 1);
  const backY = y - hh * 0.66 - hh * 0.18;
  g.save();
  g.translate(x - dir * h * 0.04, backY);
  g.rotate(-dir * tilt);
  g.fillStyle = '#9aa2ae';
  g.beginPath();
  rrect(g, -h * 0.07, -h * 0.36, h * 0.14, h * 0.36, h * 0.04);
  g.fill();
  g.strokeStyle = '#9aa2ae';
  g.lineWidth = h * 0.07;
  g.lineCap = 'round';
  line(g, 0, -h * 0.02, dir * h * 0.12, h * 0.16);
  g.fillStyle = '#b8c0ca';
  g.beginPath();
  circ(g, 0, -h * 0.45, h * 0.085);
  g.fill();
  g.fillStyle = '#2a2a30';
  g.fillRect(dir > 0 ? 0 : -h * 0.08, -h * 0.46, h * 0.08, h * 0.02);
  g.fillStyle = cloth;
  g.beginPath();
  g.moveTo(0, -h * 0.52);
  g.quadraticCurveTo(-dir * h * 0.2, -h * 0.66 + Math.sin(ph * 10) * h * 0.03, -dir * h * 0.3, -h * 0.5);
  g.quadraticCurveTo(-dir * h * 0.15, -h * 0.55, 0, -h * 0.5);
  g.fill();
  // lance
  if (lance > 0) {
    g.strokeStyle = '#e8d8b0';
    g.lineWidth = h * 0.045;
    line(g, -dir * h * 0.2, -h * 0.18, dir * h * (-0.2 + lance), -h * 0.24);
    g.strokeStyle = cloth;
    g.lineWidth = h * 0.02;
    line(g, dir * h * 0.1, -h * 0.19, dir * h * Math.min(lance - 0.2, 0.5), -h * 0.21);
    g.fillStyle = '#9aa2ae';
    g.beginPath();
    g.moveTo(dir * h * 0.06, -h * 0.29);
    g.lineTo(dir * h * 0.06, -h * 0.11);
    g.lineTo(dir * h * 0.16, -h * 0.2);
    g.fill();
  }
  // shield
  g.fillStyle = cloth;
  g.beginPath();
  g.moveTo(dir * h * 0.02, -h * 0.34);
  g.lineTo(dir * h * 0.14, -h * 0.34);
  g.quadraticCurveTo(dir * h * 0.15, -h * 0.12, dir * h * 0.08, -h * 0.06);
  g.quadraticCurveTo(dir * h * 0.01, -h * 0.12, dir * h * 0.02, -h * 0.34);
  g.fill();
  g.fillStyle = '#f2c94c';
  g.fillRect(dir > 0 ? h * 0.07 : -h * 0.09, -h * 0.32, h * 0.02, h * 0.22);
  g.restore();
}

const joust = mk(
  3.8,
  (f) => {
    const { g, L, t } = f;
    const u = U(L);
    const fy = FY(L, u);
    const fh = FH(L);
    const ps = particles(f.mem);
    const tC = 1.6;
    sky(g, L, ['#6ab0e8', '#a8d4f0', '#eaf4f0']);
    hills(g, L, fy - fh * 0.15, fh * 0.3, '#88b870', 3.4);
    floor(g, L, fy, '#c8a870');
    // stands with a cheering crowd and banners
    const sX = L.portrait ? L.w * 0.5 : L.slots[1];
    const sw = L.portrait ? L.w * 0.9 : Math.min(L.w - L.phone.x - L.phone.w - 30 * u, fh * 2.6);
    const sTop = L.portrait ? L.h * 0.16 : fy - fh * 0.75;
    const sBot = L.portrait ? L.h * 0.27 : fy;
    g.fillStyle = '#7a4a2a';
    g.fillRect(sX - sw / 2, sTop, sw, sBot - sTop);
    g.fillStyle = '#c0283a';
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? '#c0283a' : '#f2c94c';
      g.beginPath();
      g.moveTo(sX - sw / 2 + (i * sw) / 8, sTop);
      g.lineTo(sX - sw / 2 + ((i + 1) * sw) / 8, sTop);
      g.lineTo(sX - sw / 2 + ((i + 0.5) * sw) / 8, sTop + 14 * u);
      g.fill();
    }
    const heads = Math.floor(sw / (16 * u));
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < heads; i++) {
        const x = sX - sw / 2 + (i + 0.5 + row * 0.5) * (sw / heads);
        if (x > sX + sw / 2) continue;
        const jump = t > tC ? Math.abs(Math.sin(t * 9 + i)) * 5 * u : Math.abs(Math.sin(t * 3 + i)) * 2 * u;
        fillA(g, ['#3a2a4a', '#4a2a2a', '#2a3a4a'][(i + row) % 3], 1, () => circ(g, x, sTop - 4 * u - row * 12 * u - jump, 6 * u));
      }
    }
    for (let i = 0; i < 3; i++) {
      const px = sX - sw / 2 + (i + 0.5) * (sw / 3);
      g.strokeStyle = '#4a3020';
      g.lineWidth = 3 * u;
      line(g, px, sTop - 30 * u, px, sTop - 80 * u);
      g.fillStyle = ['#2a5ad8', '#c0283a', '#2a9a5a'][i];
      g.beginPath();
      g.moveTo(px, sTop - 80 * u);
      for (let k = 0; k <= 5; k++) g.lineTo(px + k * 9 * u, sTop - 80 * u + k * 1.5 * u + Math.sin(t * 6 - k) * 3 * u);
      g.lineTo(px, sTop - 60 * u);
      g.fill();
    }
    // the tilt and the charge
    const mX = L.portrait ? L.w * 0.5 : L.slots[0];
    const h = fh * (L.portrait ? 0.8 : 0.95);
    g.fillStyle = '#6a4024';
    const tw = L.portrait ? L.w : L.phone.x + 20;
    g.fillRect(0, fy - h * 0.38, tw, h * 0.05);
    for (let x = 10; x < tw; x += h * 0.4) g.fillRect(x, fy - h * 0.38, h * 0.03, h * 0.38);
    const v = (L.portrait ? L.w * 0.35 : L.phone.x * 0.45) / tC;
    const meet = h * 0.15;
    const xa = mX - meet - (tC - t) * v;
    const xb = mX + meet + (tC - t) * v;
    const hit = t >= tC;
    knight(g, xa, fy + h * 0.05, h, 1, t * 1.2, '#c0283a', 1.0, 0);
    knight(g, xb, fy - h * 0.02, h, -1, t * 1.2 + 0.4, '#2a5ad8', hit ? 0.45 : 1.0, hit ? clamp((t - tC) * 3) * 0.25 : 0);
    if (at(f, 'clash', tC)) {
      const cx = mX;
      const cy = fy - h * 0.75;
      for (let i = 0; i < 26; i++) {
        const a = f.rand() * TAU;
        const s = (150 + f.rand() * 350) * u;
        add(ps, P(cx, cy, Math.cos(a) * s, Math.sin(a) * s - 150 * u, 1.2, (6 + f.rand() * 8) * u, f.rand.pick(['#e8d8b0', '#c8b080', '#2a5ad8']), 2, f.rand() * TAU, (f.rand() - 0.5) * 20));
      }
      for (let i = 0; i < 16; i++) {
        const a = f.rand() * TAU;
        const s = (300 + f.rand() * 300) * u;
        add(ps, P(cx, cy, Math.cos(a) * s, Math.sin(a) * s, 0.4, 2 * u, '#fff4b0', 1));
      }
    }
    if (hit) {
      const d = t - tC;
      glow(g, mX, fy - h * 0.75, h * 0.6, 'rgba(255,240,180,0.9)', clamp(1 - d / 0.4));
      star(g, mX, fy - h * 0.75, h * 0.25 * clamp(1 - d / 0.35), '#ffffff', d * 4);
    }
    emit(f, 'du', 14, () => {
      add(ps, P(xa - h * 0.3, fy, -30 * u, -20 * u, 0.9, (8 + f.rand() * 6) * u, '#d8c090', 3));
      add(ps, P(xb + h * 0.3, fy, 30 * u, -20 * u, 0.9, (8 + f.rand() * 6) * u, '#d8c090', 3));
    });
    for (const p of ps) if (p.kind === 2 || p.kind === 1) p.vy += 700 * u * f.dt;
    stepParticles(ps, f.dt, 0);
    drawParts(g, ps);
  },
  (t) => {
    const d = t - 1.6;
    return d >= 0 && d < 0.4 ? 6 * (1 - d / 0.4) : 0;
  },
);

// ================================================================== DUEL

/** Hand position of person(...,{pose:'fight'}) for a given phase. */
function fightHand(x: number, y: number, h: number, dir: number, phase: number): [number, number] {
  const ang = Math.PI / 2 + Math.sin(phase * 14) * 0.5;
  const sh = y - h * 0.74 + h * 0.03;
  return [x + dir * Math.sin(ang) * h * 0.3, sh + Math.cos(ang) * h * 0.3];
}
/** Phase giving a fight-arm angle offset of v (−1..1). */
const fightPh = (v: number) => Math.asin(clamp(v, -1, 1)) / 14;

const duel = mk(3.8, (f) => {
  const { g, L, t, era } = f;
  const u = U(L);
  const fy = FY(L, u);
  const fh = FH(L);
  const ps = particles(f.mem);
  sky(g, L, ['#3a3a5e', '#a07a92', '#f2c4a2']);
  glow(g, L.w * 0.5, fy, L.w * 0.45, 'rgba(255,200,150,0.6)');
  // distant trees
  const tr = once(f.mem, 'tr', () => {
    const r = makeRand(17);
    return Array.from({ length: 14 }, () => [r(), 0.6 + r() * 0.6] as [number, number]);
  });
  g.fillStyle = '#5a4a62';
  for (const [x, s] of tr) {
    g.beginPath();
    g.moveTo(x * L.w - fh * 0.15 * s, fy);
    g.lineTo(x * L.w, fy - fh * 0.9 * s);
    g.lineTo(x * L.w + fh * 0.15 * s, fy);
    g.fill();
  }
  floor(g, L, fy, '#4a4058');
  const h = fh * (L.portrait ? 0.85 : 1);
  const swords = before(era, 'early');
  const fut = era === 'future';
  const col = '#1a1424';
  if (swords) {
    const mX = MX(L);
    const ax = mX - h * 0.38;
    const bx = mX + h * 0.38;
    const fencing = t > 0.6 && t < 2.1;
    const disarm = t >= 2.1;
    const va = fencing ? Math.sin(t * 9) : disarm ? -0.6 : 0.1;
    const vb = fencing ? Math.sin(t * 9 + 2.2) : 0;
    const pa = fightPh(va);
    person(g, ax, fy, h, { color: col, pose: 'fight', phase: pa, dir: 1 });
    const [hax, hay] = fightHand(ax, fy, h, 1, pa);
    const angA = -0.2 + va * 0.5;
    g.strokeStyle = '#d8dde6';
    g.lineWidth = 3.5 * u;
    g.lineCap = 'round';
    line(g, hax, hay, hax + Math.cos(angA) * h * 0.5, hay + Math.sin(angA) * h * 0.5);
    if (!disarm) {
      const pb = fightPh(vb);
      person(g, bx, fy, h, { color: '#2a1e30', pose: 'fight', phase: pb, dir: -1 });
      const [hbx, hby] = fightHand(bx, fy, h, -1, pb);
      const angB = Math.PI + 0.2 - vb * 0.5;
      line(g, hbx, hby, hbx + Math.cos(angB) * h * 0.5, hby + Math.sin(angB) * h * 0.5);
      if (fencing && Math.abs(Math.sin(t * 9 + 1.1)) < 0.12) {
        const cx = (hax + hbx) / 2;
        const cy = (hay + hby) / 2 - h * 0.05;
        star(g, cx, cy, 10 * u, '#ffffff', t * 5);
        emit(f, 'sp' + Math.floor(t * 3), 200, () => add(ps, P(cx, cy, (f.rand() - 0.5) * 300 * u, -(f.rand() * 200) * u, 0.3, 1.8 * u, '#fff2b0', 1)));
      }
    } else {
      person(g, bx + h * 0.1 * span(t, 2.1, 2.5), fy, h, { color: '#2a1e30', pose: 'cheer', phase: 0, dir: -1 });
      // sword spinning away and sticking in the ground
      const d = t - 2.1;
      const fl = clamp(d / 0.9);
      const sx = lerp(bx - h * 0.3, bx + h * 0.95, fl);
      const sy = fy - h * 0.6 - Math.sin(fl * Math.PI) * h * 0.7 + fl * h * 0.4;
      const sa = fl < 1 ? d * 14 : -Math.PI / 2 - 0.25;
      line(g, sx, sy, sx + Math.cos(sa) * h * 0.5, sy + Math.sin(sa) * h * 0.5);
      g.strokeStyle = '#8a6a3a';
      g.lineWidth = 5 * u;
      line(g, sx - Math.cos(sa) * h * 0.06, sy - Math.sin(sa) * h * 0.06, sx, sy);
      if (at(f, 'land', 3.0)) for (let i = 0; i < 14; i++) add(ps, P(bx + h * 0.95 + Math.cos(-0.25 - Math.PI / 2) * h * 0.5, fy, (f.rand() - 0.5) * 120 * u, -(20 + f.rand() * 60) * u, 1.4, (8 + f.rand() * 8) * u, '#d8ccd8', 3));
    }
  } else {
    const [ax0, bx0] = AB(L, 0.2, 0.8);
    const ax = ax0;
    const bx = bx0;
    const raise = t > 0.7;
    const bUp = t > 2.3;
    const pa = raise && t < 3.0 ? 0 : fightPh(-1);
    person(g, ax, fy, h, { color: col, pose: 'fight', phase: pa, dir: 1, hat: era === 'early' ? 'tophat' : 'none' });
    if (bUp) person(g, bx, fy, h, { color: '#2a1e30', pose: 'wave', phase: 0, dir: -1, hat: era === 'early' ? 'tophat' : 'none' });
    else person(g, bx, fy, h, { color: '#2a1e30', pose: 'fight', phase: raise ? 0 : fightPh(-1), dir: -1, hat: era === 'early' ? 'tophat' : 'none' });
    const [hax, hay] = fightHand(ax, fy, h, 1, pa);
    const [hbx, hby] = bUp ? waveHand(bx, fy, h, -1, 0) : fightHand(bx, fy, h, -1, raise ? 0 : fightPh(-1));
    g.fillStyle = fut ? '#7a8aa8' : '#3a2a1e';
    g.fillRect(hax, hay - 3 * u, h * 0.12, 6 * u);
    if (bUp) {
      g.save();
      g.translate(hbx, hby);
      g.rotate(-Math.PI / 2 + 0.5);
      g.fillRect(0, -3 * u, h * 0.12, 6 * u);
      g.restore();
    } else g.fillRect(hbx - h * 0.12, hby - 3 * u, h * 0.12, 6 * u);
    const shot = (key: string, tz: number, x: number, y: number, vx: number, vy: number) => {
      if (!at(f, key, tz)) return;
      for (let i = 0; i < 10; i++) add(ps, P(x, y, vx * 0.08 + (f.rand() - 0.5) * 50 * u, vy * 0.08 - f.rand() * 30 * u, 1.8, (8 + f.rand() * 8) * u, fut ? '#bfe8ff' : '#e8e4ec', 3));
      add(ps, P(x, y, vx, vy, 0.9, fut ? 4 * u : 2.5 * u, fut ? '#55f3ff' : '#fff2b0', 1));
      add(ps, P(x, y, 0, 0, 0.15, 30 * u, fut ? 'rgba(85,243,255,1)' : 'rgba(255,220,140,1)', 5));
    };
    // first shot goes wide, the second into the sky
    shot('s1', 1.6, hax + h * 0.12, hay, 1500 * u, -520 * u);
    if (bUp) {
      const [tx, ty] = [hbx + Math.cos(-Math.PI / 2 + 0.5) * h * 0.12, hby + Math.sin(-Math.PI / 2 + 0.5) * h * 0.12];
      shot('s2', 2.5, tx, ty, -300 * u, -1500 * u);
    }
    if (t > 1.6 && t < 1.75) star(g, hax + h * 0.14, hay, 9 * u, '#fff4c0', t * 8);
    if (t > 2.5 && t < 2.65) star(g, hbx - h * 0.05, hby - h * 0.12, 9 * u, '#fff4c0', t * 8);
  }
  // mist banks
  for (let i = 0; i < 6; i++) {
    const x = ((i * 0.23 + t * 0.025 * (i % 2 ? 1 : -1) + 1) % 1.3) * L.w - L.w * 0.15;
    glow(g, x, fy - fh * 0.1 * (i % 3), fh * 1.4, 'rgba(240,226,236,0.6)', 0.7);
  }
  for (const p of ps) if (p.kind === 3) p.vy -= 10 * u * f.dt;
  stepParticles(ps, f.dt, 0, 0.6);
  drawParts(g, ps);
});

// ================================================================== TAROT

const tarot = mk(3.8, (f) => {
  const { g, L, t } = f;
  const u = U(L);
  const fy = FY(L, u);
  const fh = FH(L);
  const ps = particles(f.mem);
  sky(g, L, ['#100822', '#22103a', '#361a52']);
  drawStars(g, starsOf(f.mem, L, 60, fy * 0.7), t, 0.6, u);
  // tent drape
  g.fillStyle = '#4a1a4a';
  g.beginPath();
  g.moveTo(0, 0);
  for (let x = 0; x <= L.w; x += 60 * u) g.quadraticCurveTo(x + 30 * u, 40 * u, x + 60 * u, 0);
  g.lineTo(L.w, 0);
  g.fill();
  floor(g, L, fy, '#1a0e24');
  const [ax] = AB(L, 0.5, 0.75);
  const h = fh * (L.portrait ? 0.85 : 1);
  // fortune teller behind a table with a crystal ball
  person(g, ax, fy - h * 0.05, h, { color: '#24122e', dress: true, accent: '#5a2a6a', hat: 'hood', pose: 'hold', dir: 1 });
  const tY = fy - h * 0.42;
  g.fillStyle = '#6a1e4a';
  g.beginPath();
  g.ellipse(ax, tY, h * 0.5, h * 0.08, 0, 0, TAU);
  g.rect(ax - h * 0.5, tY, h, fy - tY);
  g.fill();
  g.fillStyle = '#f2c94c';
  for (let i = 0; i < 12; i++) g.fillRect(ax - h * 0.5 + (i + 0.3) * (h / 12), fy - h * 0.06, 3 * u, h * 0.05);
  const bR = h * 0.13;
  const bY = tY - bR * 0.9;
  const pulse = 0.75 + 0.25 * Math.sin(t * 3);
  glow(g, ax, bY, bR * 4.5 * pulse, 'rgba(150,120,255,0.75)');
  const grad = g.createRadialGradient(ax - bR * 0.3, bY - bR * 0.3, bR * 0.1, ax, bY, bR);
  grad.addColorStop(0, '#e8f0ff');
  grad.addColorStop(0.5, '#8a7aff');
  grad.addColorStop(1, '#3a2a8a');
  g.fillStyle = grad;
  g.beginPath();
  circ(g, ax, bY, bR);
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.6)';
  g.lineWidth = 2 * u;
  for (let i = 0; i < 2; i++) {
    g.beginPath();
    g.arc(ax, bY, bR * (0.4 + i * 0.25), t * (2 + i) + i, t * (2 + i) + i + 2);
    g.stroke();
  }
  g.fillStyle = '#b8902a';
  g.fillRect(ax - bR * 0.7, tY - bR * 0.15, bR * 1.4, bR * 0.25);
  // cards flipping one by one
  const cX = L.portrait ? L.w * 0.5 : L.slots[1];
  const cY = L.portrait ? L.h * 0.13 : fy - fh * 1.0;
  const cw = fh * (L.portrait ? 0.24 : 0.36);
  const chh = cw * 1.6;
  const syms = ['sun', 'moon', 'star'];
  for (let i = 0; i < 3; i++) {
    const x = cX + (i - 1) * cw * 1.3;
    const k = clamp((t - 0.7 - i * 0.6) / 0.5);
    const sx = Math.abs(Math.cos(k * Math.PI));
    const front = k > 0.5;
    const y = cY + Math.sin(t * 2 + i) * 4 * u - (front && i === 1 ? span(t, 2.4, 3.0) * cw * 0.3 : 0);
    if (front && i === 1) glow(g, x, y, cw * 1.6, 'rgba(255,220,120,0.8)', span(t, 2.4, 3.0));
    g.save();
    g.translate(x, y);
    g.scale(Math.max(0.02, sx), 1);
    g.fillStyle = front ? '#f6ecd2' : '#3a1e6a';
    g.beginPath();
    rrect(g, -cw / 2, -chh / 2, cw, chh, cw * 0.08);
    g.fill();
    g.strokeStyle = '#d9b24a';
    g.lineWidth = 2.5 * u;
    g.beginPath();
    rrect(g, -cw / 2 + 4 * u, -chh / 2 + 4 * u, cw - 8 * u, chh - 8 * u, cw * 0.06);
    g.stroke();
    if (!front) {
      star(g, 0, 0, cw * 0.22, '#d9b24a');
    } else {
      const s = syms[i];
      if (s === 'sun') {
        glow(g, 0, 0, cw * 0.4, 'rgba(255,200,80,0.8)');
        fillA(g, '#f2a62a', 1, () => circ(g, 0, 0, cw * 0.18));
      } else if (s === 'moon') {
        fillA(g, '#5a4aa0', 1, () => circ(g, 0, 0, cw * 0.22));
        fillA(g, '#f6ecd2', 1, () => circ(g, cw * 0.1, -cw * 0.06, cw * 0.19));
      } else star(g, 0, 0, cw * 0.26, '#3a8ad8');
    }
    g.restore();
  }
  emit(f, 'sp', 14, () => add(ps, P(ax + (f.rand() - 0.5) * bR * 3, bY + (f.rand() - 0.5) * bR, (f.rand() - 0.5) * 20 * u, -(20 + f.rand() * 30) * u, 1.6, (1.5 + f.rand() * 2) * u, f.rand.pick(['#d8c8ff', '#fff1b0', '#a8e8ff']), 0)));
  stepParticles(ps, f.dt, 0);
  drawParts(g, ps);
});

// ================================================================== ANGEL

function wing(g: G, x: number, y: number, s: number, side: -1 | 1, flap: number): void {
  g.save();
  g.translate(x, y);
  g.scale(side, 1);
  g.rotate(-0.25 - flap * 0.35);
  for (let i = 0; i < 3; i++) {
    const k = 1 - i * 0.22;
    g.fillStyle = ['#ffffff', '#f2f0ff', '#e2e0f4'][i];
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(s * 0.5 * k, -s * 0.75 * k, s * 1.05 * k, -s * 0.55 * k);
    g.quadraticCurveTo(s * 0.85 * k, -s * 0.2 * k, s * 0.95 * k, s * 0.05 * k);
    for (let j = 0; j < 4; j++) g.quadraticCurveTo(s * (0.8 - j * 0.2) * k, s * 0.3 * k, s * (0.72 - j * 0.2) * k, s * (0.12 + j * 0.05) * k);
    g.closePath();
    g.fill();
  }
  g.restore();
}

const angel = mk(4.0, (f) => {
  const { g, L, t } = f;
  const u = U(L);
  const fy = FY(L, u);
  const fh = FH(L);
  const ps = particles(f.mem);
  sky(g, L, ['#141a3a', '#30406e', '#7a7aa8']);
  floor(g, L, fy, '#2a2e4a');
  const aX = MX(L);
  const h = fh * (L.portrait ? 0.85 : 1);
  // column of light
  const colA = span(t, 0, 0.9);
  const cw = h * 0.55;
  const grad = g.createLinearGradient(aX - cw * 1.6, 0, aX + cw * 1.6, 0);
  grad.addColorStop(0, 'rgba(255,240,200,0)');
  grad.addColorStop(0.5, 'rgba(255,245,215,0.75)');
  grad.addColorStop(1, 'rgba(255,240,200,0)');
  const base = g.globalAlpha;
  g.globalAlpha = base * colA;
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(aX - cw * 0.6, 0);
  g.lineTo(aX + cw * 0.6, 0);
  g.lineTo(aX + cw * 1.6, fy);
  g.lineTo(aX - cw * 1.6, fy);
  g.fill();
  g.globalAlpha = base;
  glow(g, aX, fy, cw * 2, 'rgba(255,240,200,0.7)', colA);
  // angel descending
  const yA = lerp(-h * 0.3, fy - h * 0.35, easeOut(clamp((t - 0.3) / 2.2))) + Math.sin(t * 2) * 4 * u;
  const flap = Math.sin(t * 3);
  glow(g, aX, yA - h * 0.6, h * 1.2, 'rgba(255,250,230,0.8)');
  wing(g, aX, yA - h * 0.7, h * 0.75, -1, flap);
  wing(g, aX, yA - h * 0.7, h * 0.75, 1, flap);
  person(g, aX, yA, h, { color: '#fbf7ee', dress: true, accent: '#fbf7ee', pose: 'hold', dir: 1 });
  const head = h * 0.13;
  const hy = yA - h * 0.74 - head * 1.05;
  glow(g, aX, hy - head * 1.4, head * 2.2, 'rgba(255,220,120,0.9)');
  g.strokeStyle = '#ffd86a';
  g.lineWidth = 3.5 * u;
  g.beginPath();
  g.ellipse(aX, hy - head * 1.5, head * 0.95, head * 0.3, 0, 0, TAU);
  g.stroke();
  emit(f, 'fe', 6, () => add(ps, P(aX + (f.rand() - 0.5) * h * 1.2, yA - h * 0.7, (f.rand() - 0.5) * 30 * u, (25 + f.rand() * 20) * u, 3.5, (5 + f.rand() * 3) * u, '#ffffff', 4, f.rand() * TAU, (f.rand() - 0.5) * 2)));
  emit(f, 'mo', 16, () => add(ps, P(aX + (f.rand() - 0.5) * cw * 2, fy - f.rand() * fh * 0.5, 0, -(30 + f.rand() * 40) * u, 2, (1.5 + f.rand() * 1.5) * u, '#fff4c8', 0)));
  // a kneeling witness bathed in light
  const kx = L.portrait ? L.w * 0.78 : L.slots[1];
  const kh = h * (L.portrait ? 0.8 : 1);
  glow(g, kx, fy - kh * 0.4, kh * 0.9, 'rgba(255,240,200,0.45)', colA);
  person(g, kx, fy, kh, { color: '#1a1e36', pose: 'kneel', dir: L.portrait ? -1 : -1 });
  stepParticles(ps, f.dt, 0);
  drawParts(g, ps);
});

// ================================================================== REINCARNATION

const reincarnation = mk(4.2, (f) => {
  const { g, L, t } = f;
  const u = U(L);
  const fy = FY(L, u);
  const fh = FH(L);
  const ps = particles(f.mem);
  sky(g, L, ['#04030e', '#120a2e', '#2a1450']);
  drawStars(g, starsOf(f.mem, L, 130, L.h), t, 1, u);
  const cX = MX(L);
  const cY = L.portrait ? L.h * 0.25 : L.h * 0.4;
  const S = fh * (L.portrait ? 0.9 : 1.1);
  // spiral of light
  const grow = easeOut(clamp(t / 1.2));
  const base = g.globalAlpha;
  for (let arm = 0; arm < 2; arm++) {
    for (let i = 0; i < 70; i++) {
      const q = i / 70;
      const th = q * 9 + t * 1.6 + arm * Math.PI;
      const r = q * S * grow;
      const x = cX + Math.cos(th) * r;
      const y = cY + Math.sin(th) * r * 0.55;
      g.globalAlpha = base * (1 - q) * 0.9;
      g.fillStyle = `hsl(${200 + q * 120 + arm * 30},90%,75%)`;
      g.beginPath();
      circ(g, x, y, (1 - q) * 5 * u + 1.2 * u);
      g.fill();
    }
  }
  g.globalAlpha = base;
  glow(g, cX, cY, S * 0.7, 'rgba(190,150,255,0.6)');
  floor(g, L, fy, '#0e0820');
  // the soul orb: rises from the earth, circles the spiral, then becomes a new star
  let ox: number;
  let oy: number;
  if (t < 1.6) {
    const k = easeInOut(t / 1.6);
    ox = cX;
    oy = lerp(fy - 10 * u, cY, k);
  } else if (t < 2.8) {
    const k = (t - 1.6) / 1.2;
    const r = S * 0.35 * Math.sin(k * Math.PI);
    ox = cX + Math.cos(k * TAU * 1.5) * r;
    oy = cY + Math.sin(k * TAU * 1.5) * r * 0.55;
  } else {
    const k = easeIn((t - 2.8) / 0.8);
    ox = cX;
    oy = lerp(cY, L.h * 0.05, clamp(k));
  }
  glow(g, ox, oy, 40 * u, 'rgba(255,240,220,1)');
  fillA(g, '#ffffff', 1, () => circ(g, ox, oy, 7 * u));
  emit(f, 'tr', 40, () => add(ps, P(ox, oy, (f.rand() - 0.5) * 20 * u, (f.rand() - 0.5) * 20 * u, 0.9, (8 + f.rand() * 8) * u, 'rgba(210,190,255,0.8)', 5)));
  if (t > 3.6) {
    const k = clamp((t - 3.6) / 0.3);
    star(g, cX, L.h * 0.05, 14 * u * k, '#ffffff', t);
    glow(g, cX, L.h * 0.05, 60 * u * k, 'rgba(255,255,255,0.9)');
  }
  // a new bud blooming nearby
  const bX = L.portrait ? L.w * 0.8 : L.slots[1];
  const bh = fh * (L.portrait ? 0.4 : 0.6);
  const bloom = span(t, 2.6, 3.6);
  g.strokeStyle = '#4ac07a';
  g.lineWidth = 3 * u;
  line(g, bX, fy, bX, fy - bh);
  g.fillStyle = '#4ac07a';
  g.beginPath();
  g.ellipse(bX - bh * 0.15, fy - bh * 0.45, bh * 0.15, bh * 0.05, -0.5, 0, TAU);
  g.fill();
  glow(g, bX, fy - bh, bh * (0.6 + bloom), 'rgba(255,180,230,0.7)', 0.4 + bloom * 0.6);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + t * 0.2;
    g.fillStyle = i % 2 ? '#ff9ad0' : '#ffc4e4';
    g.beginPath();
    g.ellipse(bX + Math.cos(a) * bh * 0.14 * bloom, fy - bh + Math.sin(a) * bh * 0.14 * bloom, bh * (0.06 + 0.1 * bloom), bh * 0.06, a, 0, TAU);
    g.fill();
  }
  fillA(g, '#ffe66a', 1, () => circ(g, bX, fy - bh, bh * 0.06));
  stepParticles(ps, f.dt, 0);
  drawParts(g, ps);
});

// ================================================================== SEANCE

const seance = mk(4.0, (f) => {
  const { g, L, t } = f;
  const u = U(L);
  const fy = FY(L, u);
  const fh = FH(L);
  const ps = particles(f.mem);
  const sp = span(t, 1.0, 2.0) * (1 - span(t, 3.3, 3.9));
  sky(g, L, ['#08060e', '#120e1e', '#1c1428']);
  floor(g, L, fy, '#0e0a14');
  const tX = MX(L);
  const h = fh * (L.portrait ? 0.85 : 1);
  const lev = sp * h * 0.05 + Math.sin(t * 3) * sp * 2 * u;
  const tY = fy - h * 0.38 - lev;
  const tw = h * 0.85;
  // sitters behind the table with joined hands
  const sitters = [-0.6, -0.2, 0.2, 0.6];
  sitters.forEach((o, i) => {
    const x = tX + o * tw;
    const yy = tY + h * 0.02 + lev;
    g.fillStyle = ['#2a2034', '#30243a', '#261e30', '#2e2238'][i];
    g.beginPath();
    g.moveTo(x - h * 0.13, yy);
    g.quadraticCurveTo(x - h * 0.13, yy - h * 0.35, x, yy - h * 0.36);
    g.quadraticCurveTo(x + h * 0.13, yy - h * 0.35, x + h * 0.13, yy);
    g.fill();
    g.beginPath();
    circ(g, x, yy - h * 0.46, h * 0.1);
    g.fill();
  });
  g.strokeStyle = '#2a2034';
  g.lineWidth = h * 0.06;
  g.lineCap = 'round';
  for (let i = 0; i < sitters.length - 1; i++) {
    const x1 = tX + sitters[i] * tw;
    const x2 = tX + sitters[i + 1] * tw;
    const mx = (x1 + x2) / 2;
    g.beginPath();
    g.moveTo(x1 + h * 0.08, tY - h * 0.22 + lev);
    g.lineTo(mx, tY - h * 0.03);
    g.lineTo(x2 - h * 0.08, tY - h * 0.22 + lev);
    g.stroke();
    glow(g, mx, tY - h * 0.03, h * 0.12, 'rgba(140,230,255,0.9)', sp);
  }
  // table
  g.fillStyle = '#3a1a2a';
  g.beginPath();
  g.ellipse(tX, tY, tw * 0.8, h * 0.1, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#2a1220';
  g.beginPath();
  g.moveTo(tX - tw * 0.8, tY);
  g.lineTo(tX - tw * 0.75, tY + h * 0.3);
  for (let i = 0; i <= 8; i++) g.lineTo(tX - tw * 0.75 + (i * tw * 1.5) / 8, tY + h * (i % 2 ? 0.33 : 0.3));
  g.lineTo(tX + tw * 0.8, tY);
  g.fill();
  if (lev > 1) fillA(g, '#000000', 0.4, () => g.ellipse(tX, fy, tw * 0.7, h * 0.04, 0, 0, TAU));
  // candles: warm, turning blue while the spirit is here
  const candle = (x: number, y: number, s: number, i: number) => {
    g.fillStyle = '#efe6d0';
    g.fillRect(x - s * 0.05, y - s * 0.3, s * 0.1, s * 0.3);
    const fl = 1 + Math.sin(t * 13 + i * 2) * 0.1;
    const lean = sp * Math.sign(tX - x) * 0.3;
    glow(g, x, y - s * 0.38, s * 0.6 * fl, sp > 0.5 ? 'rgba(120,200,255,0.9)' : 'rgba(255,190,100,0.9)');
    g.fillStyle = sp > 0.5 ? '#bfe8ff' : '#ffd27a';
    g.beginPath();
    g.ellipse(x + lean * s * 0.1, y - s * 0.4, s * 0.04, s * 0.1 * fl, lean, 0, TAU);
    g.fill();
  };
  [-0.55, -0.2, 0.25, 0.6].forEach((o, i) => candle(tX + o * tw, tY + (i % 2 ? h * 0.03 : -h * 0.02), h * 0.35, i));
  // the spectral glow rising from the table
  if (sp > 0) {
    const gy = tY - h * 0.25 - sp * h * 0.55;
    glow(g, tX, gy, h * 1.1, 'rgba(150,220,255,0.6)', sp);
    const base = g.globalAlpha;
    g.globalAlpha = base * sp * 0.75;
    g.fillStyle = '#d6f2ff';
    const gw = h * 0.28;
    g.beginPath();
    g.moveTo(tX - gw, gy + h * 0.35);
    g.quadraticCurveTo(tX - gw * 1.1, gy - h * 0.25, tX, gy - h * 0.3);
    g.quadraticCurveTo(tX + gw * 1.1, gy - h * 0.25, tX + gw, gy + h * 0.35);
    for (let i = 0; i <= 5; i++) g.lineTo(tX + gw - (i * 2 * gw) / 5, gy + h * (0.35 + (i % 2 ? -0.06 : 0.03) + Math.sin(t * 6 + i) * 0.02));
    g.closePath();
    g.fill();
    g.globalAlpha = base * sp * 0.6;
    g.strokeStyle = '#4a6a8a';
    g.lineWidth = 2.5 * u;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.arc(tX + s * gw * 0.35, gy - h * 0.08, gw * 0.12, Math.PI * 0.15, Math.PI * 0.85);
      g.stroke();
    }
    g.globalAlpha = base;
  }
  // candelabra and drifting orbs at the second slot
  if (!L.portrait) {
    const cx = L.slots[1];
    g.fillStyle = '#8a7030';
    g.fillRect(cx - 4 * u, fy - h * 0.7, 8 * u, h * 0.7);
    g.fillRect(cx - h * 0.2, fy - h * 0.72, h * 0.4, 6 * u);
    g.fillRect(cx - h * 0.25, fy - 6 * u, h * 0.5, 6 * u);
    [-0.2, 0, 0.2].forEach((o, i) => candle(cx + o * h, fy - h * 0.72 - (i === 1 ? h * 0.05 : 0), h * 0.35, i + 5));
  }
  emit(f, 'orb', sp * 6, () => add(ps, P(visX(L, f.rand), fy - f.rand() * fh * 1.2, (f.rand() - 0.5) * 20 * u, -(10 + f.rand() * 15) * u, 2.5, (12 + f.rand() * 12) * u, 'rgba(150,220,255,0.8)', 5)));
  stepParticles(ps, f.dt, 0);
  drawParts(g, ps);
});

// ================================================================== FESTIVAL

const festival = mk(4.0, (f) => {
  const { g, L, t } = f;
  const u = U(L);
  const fy = FY(L, u);
  const fh = FH(L);
  const ps = particles(f.mem);
  sky(g, L, ['#120a2a', '#2a1452', '#4a2060']);
  floor(g, L, fy, '#2a1838');
  // strings of lanterns
  for (let row = 0; row < 2; row++) {
    const y0 = L.h * (0.05 + row * 0.1);
    const n = Math.max(6, Math.floor(L.w / (70 * u)));
    g.strokeStyle = '#1a0e20';
    g.lineWidth = 1.5;
    g.beginPath();
    for (let i = 0; i <= n; i++) {
      const x = (i / n) * L.w;
      g.lineTo(x, y0 + Math.sin((i / n) * Math.PI * 2) * 20 * u + 20 * u);
    }
    g.stroke();
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) / n) * L.w;
      const y = y0 + Math.sin(((i + 0.5) / n) * Math.PI * 2) * 20 * u + 20 * u + 14 * u;
      const sw = Math.sin(t * 2 + i) * 3 * u;
      const c = (i + row) % 3 === 0 ? '#f2c94c' : '#e8302a';
      glow(g, x + sw, y, 34 * u, c === '#e8302a' ? 'rgba(255,90,60,0.7)' : 'rgba(255,210,90,0.7)');
      g.fillStyle = c;
      g.beginPath();
      g.ellipse(x + sw, y, 11 * u, 14 * u, 0, 0, TAU);
      g.fill();
      g.fillStyle = '#3a1a10';
      g.fillRect(x + sw - 5 * u, y - 16 * u, 10 * u, 3 * u);
      g.fillRect(x + sw - 5 * u, y + 13 * u, 10 * u, 3 * u);
    }
  }
  // dragon dance
  const dX = MX(L);
  const h = fh * (L.portrait ? 0.7 : 0.9);
  const segs = 8;
  const segW = h * 0.32;
  const headX = dX + segW * (segs / 2 - 0.5) + Math.sin(t * 0.9) * 15 * u;
  const pts: [number, number][] = [];
  for (let i = 0; i < segs; i++) {
    const x = headX - i * segW;
    const y = fy - h * 1.0 + Math.sin(t * 4 - i * 0.7) * h * 0.18;
    pts.push([x, y]);
  }
  for (let i = segs - 1; i >= 0; i--) {
    const [x, y] = pts[i];
    if (i % 2 === 0 || i === segs - 1) {
      person(g, x, fy, h * 0.75, { color: '#1a0e20', pose: 'walk', phase: t + i * 0.3, dir: 1, accent: '#f2c94c' });
      g.strokeStyle = '#8a5a2a';
      g.lineWidth = 3 * u;
      line(g, x, fy - h * 0.5, x, y);
    }
  }
  for (let i = segs - 1; i >= 1; i--) {
    const [x, y] = pts[i];
    const r = h * (0.17 - i * 0.008);
    g.fillStyle = i % 2 ? '#e8302a' : '#d0201a';
    g.beginPath();
    circ(g, x, y, r);
    g.fill();
    g.fillStyle = '#f2c94c';
    g.beginPath();
    g.moveTo(x - r * 0.6, y - r * 0.8);
    g.lineTo(x, y - r * 1.5);
    g.lineTo(x + r * 0.6, y - r * 0.8);
    g.fill();
    g.fillStyle = 'rgba(255,220,120,0.6)';
    g.beginPath();
    g.arc(x, y, r * 0.6, 0.2, Math.PI - 0.2);
    g.fill();
  }
  // head
  const [hx, hy] = pts[0];
  const hr = h * 0.24;
  glow(g, hx, hy, hr * 2.5, 'rgba(255,120,60,0.5)');
  g.fillStyle = '#e8302a';
  g.beginPath();
  rrect(g, hx - hr, hy - hr * 0.8, hr * 2.1, hr * 1.4, hr * 0.4);
  g.fill();
  g.fillStyle = '#f2c94c';
  g.beginPath();
  g.moveTo(hx - hr * 0.6, hy - hr * 0.8);
  g.lineTo(hx - hr * 0.9, hy - hr * 1.6);
  g.lineTo(hx - hr * 0.2, hy - hr * 0.8);
  g.moveTo(hx + hr * 0.2, hy - hr * 0.8);
  g.lineTo(hx + hr * 0.1, hy - hr * 1.7);
  g.lineTo(hx + hr * 0.6, hy - hr * 0.8);
  g.fill();
  const jaw = Math.abs(Math.sin(t * 5)) * hr * 0.3;
  g.fillStyle = '#ffffff';
  g.fillRect(hx + hr * 0.3, hy + hr * 0.45, hr * 0.8, hr * 0.12 + jaw * 0.3);
  g.fillStyle = '#e8302a';
  g.fillRect(hx - hr * 0.2, hy + hr * 0.5 + jaw, hr * 1.3, hr * 0.25);
  fillA(g, '#ffffff', 1, () => circ(g, hx + hr * 0.5, hy - hr * 0.25, hr * 0.22));
  fillA(g, '#1a0e20', 1, () => circ(g, hx + hr * 0.58, hy - hr * 0.25, hr * 0.11));
  g.strokeStyle = '#f2c94c';
  g.lineWidth = 2.5 * u;
  g.beginPath();
  g.moveTo(hx + hr * 1.05, hy + hr * 0.1);
  g.quadraticCurveTo(hx + hr * 1.6, hy + hr * 0.2 + Math.sin(t * 6) * hr * 0.3, hx + hr * 1.9, hy - hr * 0.2);
  g.stroke();
  // coloured powder thrown in the air
  const pX = L.portrait ? L.w * 0.5 : L.slots[1];
  const pY = L.portrait ? L.h * 0.3 : fy;
  const ph = fh * (L.portrait ? 0.45 : 0.9);
  const throwers = L.portrait ? [] : [-0.5, 0, 0.5];
  throwers.forEach((o, i) => person(g, pX + o * ph, pY, ph, { color: ['#2a1438', '#341a40', '#2a1a3a'][i], pose: 'cheer', phase: t + i, dir: 1, dress: i === 1, accent: '#ff5d9e' }));
  const cols = ['#ff4fa3', '#3ad07a', '#ffd23a', '#3a9aff', '#b04aff', '#ff7a2a'];
  [0.4, 1.0, 1.6, 2.2, 2.8].forEach((tz, i) => {
    if (!at(f, 'pw' + i, tz)) return;
    const c = cols[i % cols.length];
    const x = pX + (i % 3 - 1) * ph * 0.5;
    const y = L.portrait ? L.h * 0.3 - fh * 0.2 : pY - ph * 1.0;
    for (let k = 0; k < 18; k++) {
      const a = -Math.PI / 2 + (f.rand() - 0.5) * 2.4;
      const s = (80 + f.rand() * 220) * u;
      add(ps, P(x, y, Math.cos(a) * s, Math.sin(a) * s, 2 + f.rand(), (14 + f.rand() * 14) * u, c, 3));
    }
  });
  // small fireworks
  [1.2, 2.4].forEach((tz, i) => {
    if (!at(f, 'fw' + i, tz)) return;
    const x = L.portrait ? L.w * (0.3 + i * 0.4) : visX(L, f.rand, 80);
    const y = L.h * (0.2 + f.rand() * 0.1);
    const c = f.rand.pick(cols);
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * TAU;
      add(ps, P(x, y, Math.cos(a) * 180 * u, Math.sin(a) * 180 * u, 1.1, 2 * u, c, 1));
    }
  });
  for (const p of ps) {
    if (p.kind === 3) {
      p.vx *= 1 - 1.5 * f.dt;
      p.vy = p.vy * (1 - 1.5 * f.dt) + 15 * u * f.dt;
    } else p.vy += 120 * u * f.dt;
  }
  stepParticles(ps, f.dt, 0);
  drawParts(g, ps);
});

export const ERA_SCENE_DEFS: Record<EraSceneId, SceneDef> = {
  sick,
  dentist,
  checkup,
  rehab,
  aging,
  nursingHome,
  dementia,
  graveVisit,
  retirement,
  moving,
  heatwave,
  blizzard,
  volcano,
  meteor,
  eclipse,
  famine,
  refugees,
  invention,
  moonLanding,
  internet,
  parade,
  royalBall,
  joust,
  duel,
  tarot,
  angel,
  reincarnation,
  seance,
  festival,
};
