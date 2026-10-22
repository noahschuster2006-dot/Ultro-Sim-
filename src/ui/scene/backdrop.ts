/**
 * The ambient, always-on view behind the phone: an era-appropriate street and skyline by day or
 * night, or a prison cell. Static layers are rendered once into an offscreen canvas (keyed by
 * size, era, night, prison and a coarse wealth level); each frame only blits that layer and draws
 * a handful of moving things (clouds, twinkling stars, birds, traffic, chimney smoke, dust motes)
 * plus a mood tint. No per-frame allocations beyond a few short-lived numbers.
 */
import type { EraLook, Layout } from './kit';
import { clamp, makeRand, person, skyline } from './kit';

type G = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

export interface BackdropOpts {
  night: boolean;
  prison: boolean;
  /** 0..1, happiness. */
  mood: number;
  /** 0..1. */
  wealth: number;
}

// ------------------------------------------------------------------ palettes

interface Pal {
  day: [string, string, string];
  night: [string, string, string];
  farDay: string;
  farNight: string;
  nearDay: string;
  nearNight: string;
  roofDay: string;
  roofNight: string;
  win: string;
  winDay: string;
  street: string;
  streetNight: string;
  walk: string;
  walkNight: string;
  accent: string;
}

const PAL: Record<EraLook, Pal> = {
  ancient: {
    day: ['#74ade2', '#b9d8ee', '#f2d9a8'],
    night: ['#070a1c', '#18203e', '#3a2c48'],
    farDay: '#d8c3a0',
    farNight: '#2c2a40',
    nearDay: '#c49a6c',
    nearNight: '#1e1a26',
    roofDay: '#a8784e',
    roofNight: '#17141e',
    win: '#ffb35c',
    winDay: 'rgba(60,40,30,0.55)',
    street: '#c8ab82',
    streetNight: '#221e22',
    walk: '#d8c09a',
    walkNight: '#2a2428',
    accent: '#e8c070',
  },
  medieval: {
    day: ['#7aa8d8', '#c2d8ea', '#e8e0c4'],
    night: ['#060a1a', '#141c38', '#2e2a44'],
    farDay: '#a7adb6',
    farNight: '#262a3e',
    nearDay: '#7a6e60',
    nearNight: '#19171f',
    roofDay: '#5a3a30',
    roofNight: '#141218',
    win: '#ffc46a',
    winDay: 'rgba(40,30,30,0.55)',
    street: '#857a6c',
    streetNight: '#1d1b20',
    walk: '#9a8e7c',
    walkNight: '#242128',
    accent: '#c9a050',
  },
  early: {
    day: ['#80aedc', '#cadeed', '#f0dbbc'],
    night: ['#070a1c', '#161e3c', '#342c48'],
    farDay: '#b8aca6',
    farNight: '#2a2a40',
    nearDay: '#8c5a48',
    nearNight: '#1c1820',
    roofDay: '#4a3a3a',
    roofNight: '#141218',
    win: '#ffd27a',
    winDay: 'rgba(40,40,60,0.5)',
    street: '#7c746c',
    streetNight: '#1c1b20',
    walk: '#9c948a',
    walkNight: '#242228',
    accent: '#d8b060',
  },
  industrial: {
    day: ['#93a2b0', '#c6c3b8', '#e2c69c'],
    night: ['#080a16', '#1a1c2e', '#4a3428'],
    farDay: '#8a8580',
    farNight: '#24222c',
    nearDay: '#5a4640',
    nearNight: '#17151a',
    roofDay: '#3a2e2a',
    roofNight: '#121014',
    win: '#ffd27a',
    winDay: 'rgba(30,30,40,0.5)',
    street: '#5e5a56',
    streetNight: '#18181c',
    walk: '#8a847c',
    walkNight: '#222126',
    accent: '#c88a40',
  },
  modern: {
    day: ['#4f98e2', '#a6cff0', '#f2e2c6'],
    night: ['#050a1c', '#121c3c', '#2c2a52'],
    farDay: '#9db2c8',
    farNight: '#1e2440',
    nearDay: '#53647a',
    nearNight: '#121624',
    roofDay: '#3e4a5a',
    roofNight: '#0e111c',
    win: '#ffe08a',
    winDay: 'rgba(210,235,255,0.45)',
    street: '#3c4048',
    streetNight: '#111318',
    walk: '#9a9ca2',
    walkNight: '#1e2026',
    accent: '#ff5d73',
  },
  future: {
    day: ['#62bcf0', '#bfe6f8', '#f6d6ee'],
    night: ['#060418', '#16123c', '#3a1c5a'],
    farDay: '#93a8d2',
    farNight: '#201c48',
    nearDay: '#3e4e72',
    nearNight: '#0e0e26',
    roofDay: '#2e3a5a',
    roofNight: '#0a0a1e',
    win: '#7ef0ff',
    winDay: 'rgba(200,250,255,0.5)',
    street: '#252a40',
    streetNight: '#0c0c1c',
    walk: '#4a5272',
    walkNight: '#16162c',
    accent: '#ff4fd8',
  },
};

function hexMix(a: string, b: string, k: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const m = (s: number) => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
  return `rgb(${m(16)},${m(8)},${m(0)})`;
}

// ------------------------------------------------------------------ cache

interface Cache {
  key: string;
  canvas: HTMLCanvasElement;
  clouds: HTMLCanvasElement[];
  dot: HTMLCanvasElement[];
  /** twinkling stars: x, y, size, phase */
  stars: Float32Array;
  /** chimney tops: x, y */
  chimneys: Float32Array;
  /** cloud lanes: x0, y, speed, sprite, scale */
  cl: Float32Array;
  /** vehicles: x0, lane, speed, colourIdx */
  cars: Float32Array;
  roadTop: number;
  roadH: number;
  /** prison window rect */
  win: [number, number, number, number];
}

let cache: Cache | null = null;

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function ctx(c: HTMLCanvasElement): G {
  return c.getContext('2d') as G;
}

function cloudSprite(seed: number, night: boolean, scale: number): HTMLCanvasElement {
  const w = 260;
  const h = 110;
  const c = makeCanvas(w * scale, h * scale);
  const g = ctx(c);
  g.scale(scale, scale);
  const r = makeRand(seed);
  g.fillStyle = night ? 'rgba(70,80,120,0.5)' : 'rgba(255,255,255,0.85)';
  g.beginPath();
  const n = 5 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const x = 40 + (i / (n - 1)) * 180 + (r() - 0.5) * 20;
    const rad = 22 + r() * 22 * Math.sin((i / (n - 1)) * Math.PI) + 10;
    const y = 80 - rad * 0.6;
    g.moveTo(x + rad, y);
    g.arc(x, y, rad, 0, TAU);
  }
  g.rect(30, 70, 200, 22);
  g.fill();
  if (!night) {
    g.fillStyle = 'rgba(180,195,220,0.35)';
    g.fillRect(30, 84, 200, 8);
  }
  return c;
}

function dotSprite(color: string, scale: number): HTMLCanvasElement {
  const s = 32;
  const c = makeCanvas(s * scale, s * scale);
  const g = ctx(c);
  g.scale(scale, scale);
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, color);
  grad.addColorStop(0.25, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  return c;
}

// ------------------------------------------------------------------ static city

/** Era city layer with lit-window fraction; records chimney tops into `chim`. */
function city(g: G, L: Layout, baseY: number, era: EraLook, wall: string, roof: string, seed: number, win: string | null, lit: number, chim: number[], accent: string | null): void {
  const r = makeRand(seed);
  let x = -12;
  while (x < L.w + 12) {
    let bw = 50 + r() * 60;
    let bh = 40 + r() * 60;
    let winTop = 10;
    g.fillStyle = wall;
    switch (era) {
      case 'ancient': {
        if (r() < 0.3) {
          // temple: steps, columns, architrave, pediment
          bw = 110 + r() * 50;
          bh = 70 + r() * 20;
          g.fillRect(x, baseY - 10, bw, 10);
          const n = 5 + Math.floor(r() * 2);
          const cw = bw / (n * 2 - 1);
          for (let i = 0; i < n; i++) g.fillRect(x + i * cw * 2, baseY - bh, cw, bh);
          g.fillRect(x - 4, baseY - bh - 12, bw + 8, 14);
          g.fillStyle = roof;
          g.beginPath();
          g.moveTo(x - 8, baseY - bh - 12);
          g.lineTo(x + bw / 2, baseY - bh - 40);
          g.lineTo(x + bw + 8, baseY - bh - 12);
          g.fill();
          x += bw + 8 + r() * 14;
          continue;
        }
        bh = 26 + r() * 34;
        g.fillRect(x, baseY - bh, bw, bh);
        g.fillStyle = roof;
        g.fillRect(x - 3, baseY - bh - 4, bw + 6, 5);
        winTop = 10;
        break;
      }
      case 'medieval': {
        const k = r();
        if (k < 0.22) {
          bw = 34 + r() * 18;
          bh = 100 + r() * 60;
          g.fillRect(x, baseY - bh, bw, bh);
          for (let i = 0; i < 4; i++) g.fillRect(x + (i * bw) / 3.4, baseY - bh - 10, bw / 7, 10);
        } else if (k < 0.34) {
          bw = 42;
          bh = 80 + r() * 40;
          g.fillRect(x, baseY - bh, bw, bh);
          g.fillStyle = roof;
          g.beginPath();
          g.moveTo(x - 2, baseY - bh);
          g.lineTo(x + bw / 2, baseY - bh - 70);
          g.lineTo(x + bw + 2, baseY - bh);
          g.fill();
        } else {
          bh = 40 + r() * 34;
          g.fillRect(x, baseY - bh, bw, bh);
          g.fillStyle = roof;
          g.beginPath();
          g.moveTo(x - 5, baseY - bh);
          g.lineTo(x + bw / 2, baseY - bh - bw * 0.5);
          g.lineTo(x + bw + 5, baseY - bh);
          g.fill();
        }
        break;
      }
      case 'early': {
        bw = 40 + r() * 40;
        bh = 60 + r() * 60;
        g.fillRect(x, baseY - bh, bw, bh);
        g.fillStyle = roof;
        if (r() < 0.18) {
          g.beginPath();
          g.arc(x + bw / 2, baseY - bh, bw / 2.3, Math.PI, 0);
          g.fill();
          g.fillRect(x + bw / 2 - 2, baseY - bh - bw / 2.3 - 16, 4, 16);
        } else {
          g.beginPath();
          g.moveTo(x - 3, baseY - bh);
          g.lineTo(x + bw / 2, baseY - bh - 22);
          g.lineTo(x + bw + 3, baseY - bh);
          g.fill();
        }
        break;
      }
      case 'industrial': {
        const k = r();
        if (k < 0.35) {
          // factory with a sawtooth roof and a tall chimney
          bw = 110 + r() * 60;
          bh = 50 + r() * 30;
          g.fillRect(x, baseY - bh, bw, bh);
          g.beginPath();
          for (let sx = x; sx < x + bw - 1; sx += 22) {
            g.moveTo(sx, baseY - bh);
            g.lineTo(sx + 22, baseY - bh - 16);
            g.lineTo(sx + 22, baseY - bh);
          }
          g.fill();
          const cx = x + bw * (0.2 + r() * 0.6);
          const ch = 70 + r() * 50;
          g.fillRect(cx - 6, baseY - bh - ch, 12, ch);
          g.fillStyle = roof;
          g.fillRect(cx - 8, baseY - bh - ch, 16, 6);
          chim.push(cx, baseY - bh - ch);
        } else {
          bh = 70 + r() * 70;
          g.fillRect(x, baseY - bh, bw, bh);
          g.fillStyle = roof;
          g.fillRect(x - 2, baseY - bh - 5, bw + 4, 6);
        }
        winTop = 14;
        break;
      }
      case 'modern': {
        bw = 40 + r() * 60;
        bh = 90 + r() * 210;
        g.fillRect(x, baseY - bh, bw, bh);
        g.fillStyle = roof;
        g.fillRect(x, baseY - bh, bw, 6);
        if (r() < 0.25) g.fillRect(x + bw / 2 - 2, baseY - bh - 34, 4, 34);
        winTop = 14;
        break;
      }
      case 'future': {
        bw = 34 + r() * 50;
        bh = 150 + r() * 240;
        g.beginPath();
        g.moveTo(x, baseY);
        g.lineTo(x + bw * 0.12, baseY - bh);
        g.lineTo(x + bw * 0.5, baseY - bh - 46);
        g.lineTo(x + bw * 0.88, baseY - bh);
        g.lineTo(x + bw, baseY);
        g.fill();
        if (accent && r() < 0.5) {
          g.fillStyle = accent;
          g.fillRect(x + bw * 0.12, baseY - bh * (0.4 + r() * 0.4), bw * 0.76, 3);
        }
        winTop = 18;
        break;
      }
    }
    if (win && bh > 30) {
      const cols = Math.max(1, Math.floor((bw - 8) / 14));
      const rows = Math.max(1, Math.floor((bh - winTop - 8) / 18));
      const x0 = x + (bw - cols * 14) / 2 + 4;
      for (let cx = 0; cx < cols; cx++)
        for (let cy = 0; cy < rows; cy++) {
          if (r() >= lit) continue;
          g.fillStyle = win;
          g.fillRect(x0 + cx * 14, baseY - bh + winTop + cy * 18, 6, era === 'ancient' || era === 'medieval' ? 7 : 8);
        }
    }
    x += bw + 3 + r() * 14;
  }
}

function buildCity(c: Cache, g: G, L: Layout, era: EraLook, night: boolean, wealth: number): void {
  const p = PAL[era];
  const gy = L.groundY;
  // sky: wealth warms the horizon by day and deepens the glow at night
  const [t, m, h] = night ? p.night : p.day;
  const grad = g.createLinearGradient(0, 0, 0, gy);
  grad.addColorStop(0, night ? hexMix(t, '#000000', 0.1) : t);
  grad.addColorStop(0.55, m);
  grad.addColorStop(1, night ? hexMix(h, '#7a3a6a', wealth * 0.35) : hexMix(h, '#ffc27a', wealth * 0.45));
  g.fillStyle = grad;
  g.fillRect(0, 0, L.w, L.h);
  const r = makeRand(91);
  const sunX = L.portrait ? L.w * 0.78 : Math.max(60, L.phone.x * 0.32);
  const sunY = gy * (L.portrait ? 0.12 : 0.2);
  if (night) {
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 160; i++) {
      const x = r() * L.w;
      const y = r() * gy * 0.75;
      const s = 0.6 + r() * 1.2;
      g.globalAlpha = 0.25 + r() * 0.5;
      g.fillRect(x, y, s, s);
    }
    g.globalAlpha = 1;
    const mg = g.createRadialGradient(sunX, sunY, 0, sunX, sunY, 90);
    mg.addColorStop(0, 'rgba(240,236,210,0.45)');
    mg.addColorStop(1, 'rgba(240,236,210,0)');
    g.fillStyle = mg;
    g.fillRect(sunX - 90, sunY - 90, 180, 180);
    g.fillStyle = '#f1edd8';
    g.beginPath();
    g.arc(sunX, sunY, 22, 0, TAU);
    g.fill();
    g.fillStyle = night ? p.night[0] : '#000';
    g.beginPath();
    g.arc(sunX + 9, sunY - 5, 19, 0, TAU);
    g.fill();
  } else {
    const sg = g.createRadialGradient(sunX, sunY, 0, sunX, sunY, 150);
    sg.addColorStop(0, 'rgba(255,246,210,0.9)');
    sg.addColorStop(0.2, 'rgba(255,236,180,0.5)');
    sg.addColorStop(1, 'rgba(255,236,180,0)');
    g.fillStyle = sg;
    g.fillRect(sunX - 150, sunY - 150, 300, 300);
    g.fillStyle = '#fff8dc';
    g.beginPath();
    g.arc(sunX, sunY, 26, 0, TAU);
    g.fill();
  }
  // far and near city
  skyline(g, L, gy - 24, era, night ? p.farNight : p.farDay, 3, night ? 'rgba(255,220,150,0.18)' : undefined);
  const chim: number[] = [];
  const lit = night ? 0.22 + 0.5 * wealth : 0.3;
  city(g, L, gy, era, night ? p.nearNight : p.nearDay, night ? p.roofNight : p.roofDay, 17, night ? p.win : p.winDay, lit, chim, era === 'future' ? p.accent : null);
  c.chimneys = new Float32Array(chim.slice(0, 8));
  // street: sidewalk, road, kerb, markings
  const walkH = Math.max(8, (L.h - gy) * 0.16);
  const roadTop = gy + walkH;
  const roadH = Math.max(18, (L.h - gy) * 0.5);
  c.roadTop = roadTop;
  c.roadH = roadH;
  g.fillStyle = night ? p.walkNight : p.walk;
  g.fillRect(0, gy, L.w, walkH);
  g.fillStyle = night ? p.streetNight : p.street;
  g.fillRect(0, roadTop, L.w, L.h - roadTop);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(0, roadTop, L.w, 3);
  const ei = ['ancient', 'medieval', 'early', 'industrial', 'modern', 'future'].indexOf(era);
  if (ei <= 3) {
    // cobbles / packed earth texture
    g.fillStyle = night ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.08)';
    for (let y = roadTop + 6; y < L.h; y += 9) for (let x = (y * 7) % 14; x < L.w; x += 14) if (r() < (ei === 0 ? 0.25 : 0.7)) g.fillRect(x, y, 8, 4);
    if (ei === 3) {
      g.fillStyle = night ? 'rgba(200,200,220,0.18)' : 'rgba(40,40,40,0.4)';
      g.fillRect(0, roadTop + roadH * 0.45, L.w, 2);
      g.fillRect(0, roadTop + roadH * 0.6, L.w, 2);
    }
  } else {
    g.fillStyle = ei === 5 ? 'rgba(110,240,255,0.7)' : night ? 'rgba(230,230,210,0.35)' : 'rgba(250,250,240,0.8)';
    for (let x = 0; x < L.w; x += 46) g.fillRect(x, roadTop + roadH * 0.5 - 1.5, 24, 3);
    if (ei === 5) {
      g.fillStyle = 'rgba(255,79,216,0.5)';
      g.fillRect(0, roadTop + 2, L.w, 2);
    }
  }
  // street lamps / torches
  for (let x = 40; x < L.w; x += 150) {
    if (!L.portrait && x > L.phone.x && x < L.phone.x + L.phone.w) continue;
    const lh = ei <= 2 ? 30 : 46;
    g.fillStyle = night ? '#0c0c12' : 'rgba(30,30,36,0.8)';
    g.fillRect(x - 1.5, gy + walkH * 0.5 - lh, 3, lh);
    if (night) {
      const lg = g.createRadialGradient(x, gy + walkH * 0.5 - lh, 0, x, gy + walkH * 0.5 - lh, 46);
      lg.addColorStop(0, ei <= 2 ? 'rgba(255,170,70,0.75)' : ei === 5 ? 'rgba(140,240,255,0.7)' : 'rgba(255,220,150,0.7)');
      lg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = lg;
      g.fillRect(x - 46, gy + walkH * 0.5 - lh - 46, 92, 92);
    }
    g.fillStyle = night ? (ei <= 2 ? '#ffb35c' : '#fff1c0') : '#3a3a40';
    g.beginPath();
    g.arc(x, gy + walkH * 0.5 - lh, 4, 0, TAU);
    g.fill();
  }
  // twinkle stars, clouds, vehicles
  const st = new Float32Array(40 * 4);
  for (let i = 0; i < 40; i++) {
    st[i * 4] = r() * L.w;
    st[i * 4 + 1] = r() * gy * 0.6;
    st[i * 4 + 2] = 1.2 + r() * 1.6;
    st[i * 4 + 3] = r() * TAU;
  }
  c.stars = st;
  const cl = new Float32Array(6 * 5);
  for (let i = 0; i < 6; i++) {
    cl[i * 5] = r() * (L.w + 300);
    cl[i * 5 + 1] = gy * (0.05 + r() * 0.35);
    cl[i * 5 + 2] = 3 + r() * 6;
    cl[i * 5 + 3] = i % 3;
    cl[i * 5 + 4] = 0.6 + r() * 0.7;
  }
  c.cl = cl;
  const cars = new Float32Array(7 * 4);
  for (let i = 0; i < 7; i++) {
    cars[i * 4] = r() * (L.w + 200);
    cars[i * 4 + 1] = i % 2;
    cars[i * 4 + 2] = 30 + r() * 45;
    cars[i * 4 + 3] = Math.floor(r() * 5);
  }
  c.cars = cars;
}

// ------------------------------------------------------------------ static prison

function buildPrison(c: Cache, g: G, L: Layout, night: boolean): void {
  const gy = L.groundY;
  const grad = g.createLinearGradient(0, 0, 0, gy);
  grad.addColorStop(0, night ? '#24282f' : '#62686f');
  grad.addColorStop(1, night ? '#16191e' : '#474c53');
  g.fillStyle = grad;
  g.fillRect(0, 0, L.w, L.h);
  // concrete blocks
  g.strokeStyle = night ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.12)';
  g.lineWidth = 2;
  g.beginPath();
  let row = 0;
  for (let y = 46; y < gy; y += 46, row++) {
    g.moveTo(0, y);
    g.lineTo(L.w, y);
    for (let x = (row % 2) * 46; x < L.w; x += 92) {
      g.moveTo(x, y - 46);
      g.lineTo(x, y);
    }
  }
  g.stroke();
  // grime streaks
  const r = makeRand(5);
  g.fillStyle = 'rgba(0,0,0,0.06)';
  for (let i = 0; i < 18; i++) g.fillRect(r() * L.w, r() * gy * 0.5, 6 + r() * 14, gy * (0.2 + r() * 0.5));
  // barred window with a sliver of sky
  const ww = L.portrait ? Math.min(150, L.w * 0.4) : Math.min(220, L.phone.x * 0.55);
  const wh = ww * 0.62;
  const wx = (L.portrait ? L.w * 0.5 : L.slots[0]) - ww / 2;
  const wy = L.portrait ? L.h * 0.05 : L.h * 0.12;
  c.win = [wx, wy, ww, wh];
  g.fillStyle = night ? '#0c0e12' : '#2e3238';
  g.fillRect(wx - 14, wy - 14, ww + 28, wh + 28);
  const sg = g.createLinearGradient(0, wy, 0, wy + wh);
  sg.addColorStop(0, night ? '#0a1230' : '#5aa2e6');
  sg.addColorStop(1, night ? '#24305a' : '#bfe0f6');
  g.fillStyle = sg;
  g.fillRect(wx, wy, ww, wh);
  if (night) {
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 8; i++) g.fillRect(wx + r() * ww, wy + r() * wh * 0.8, 1.6, 1.6);
  }
  // light shaft by day
  if (!night) {
    g.fillStyle = 'rgba(255,244,210,0.10)';
    g.beginPath();
    g.moveTo(wx, wy + wh);
    g.lineTo(wx + ww, wy + wh);
    g.lineTo(wx + ww + gy * 0.45, gy + 30);
    g.lineTo(wx + gy * 0.45, gy + 30);
    g.closePath();
    g.fill();
  }
  // tally marks
  g.strokeStyle = night ? 'rgba(200,200,210,0.25)' : 'rgba(30,30,30,0.35)';
  g.lineWidth = 2;
  g.beginPath();
  const tx = wx + ww + 40;
  const ty = wy + wh * 0.9;
  for (let k = 0; k < 3; k++) {
    for (let i = 0; i < 4; i++) {
      g.moveTo(tx + k * 34 + i * 6, ty);
      g.lineTo(tx + k * 34 + i * 6, ty + 22);
    }
    g.moveTo(tx + k * 34 - 3, ty + 18);
    g.lineTo(tx + k * 34 + 22, ty + 4);
  }
  g.stroke();
  // floor
  g.fillStyle = night ? '#121418' : '#34383e';
  g.fillRect(0, gy, L.w, L.h - gy);
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.fillRect(0, gy, L.w, 4);
  // bunk bed
  const bx = L.portrait ? L.w * 0.5 : L.slots[1];
  const bw = L.portrait ? L.w * 0.6 : Math.min(300, (L.w - L.phone.x - L.phone.w) * 0.75);
  const metal = night ? '#2a2e36' : '#5c636d';
  g.fillStyle = metal;
  g.fillRect(bx - bw / 2, gy - 150, 8, 150);
  g.fillRect(bx + bw / 2 - 8, gy - 150, 8, 150);
  for (const by of [gy - 40, gy - 120]) {
    g.fillStyle = metal;
    g.fillRect(bx - bw / 2, by, bw, 8);
    g.fillStyle = night ? '#3a4050' : '#8a93a6';
    g.fillRect(bx - bw / 2 + 8, by - 14, bw - 16, 14);
    g.fillStyle = night ? '#4a4e5a' : '#d8dce4';
    g.fillRect(bx - bw / 2 + 12, by - 22, 46, 10);
  }
}

// ------------------------------------------------------------------ build

function build(key: string, L: Layout, era: EraLook, night: boolean, prison: boolean, wealth: number, scale: number): Cache {
  const canvas = makeCanvas(L.w * scale, L.h * scale);
  const g = ctx(canvas);
  g.scale(scale, scale);
  const c: Cache = {
    key,
    canvas,
    clouds: [cloudSprite(1, night, scale), cloudSprite(2, night, scale), cloudSprite(3, night, scale)],
    dot: [dotSprite('rgba(255,244,214,1)', scale), dotSprite('rgba(255,60,60,1)', scale), dotSprite('rgba(120,240,255,1)', scale)],
    stars: new Float32Array(0),
    chimneys: new Float32Array(0),
    cl: new Float32Array(0),
    cars: new Float32Array(0),
    roadTop: 0,
    roadH: 0,
    win: [0, 0, 0, 0],
  };
  if (prison) buildPrison(c, g, L, night);
  else buildCity(c, g, L, era, night, wealth);
  return c;
}

// ------------------------------------------------------------------ per-frame layers

const CAR_COLS = ['#d64545', '#3a7bd5', '#f2c94c', '#e8e8ee', '#2a9a6a'];
const OLD_CAR_COLS = ['#1c1c22', '#3a2a22', '#22303a', '#2a2a2a', '#4a3a2a'];

function drawClouds(g: G, L: Layout, c: Cache, time: number, maxY: number, alpha: number): void {
  const cl = c.cl;
  const base = g.globalAlpha;
  g.globalAlpha = base * alpha;
  for (let i = 0; i < cl.length; i += 5) {
    const s = cl[i + 4];
    const w = 260 * s;
    const x = ((cl[i] + time * cl[i + 2]) % (L.w + w + 100)) - w - 50;
    const y = cl[i + 1];
    if (y > maxY) continue;
    g.drawImage(c.clouds[cl[i + 3]], x, y, w, 110 * s);
  }
  g.globalAlpha = base;
}

function drawCityDyn(g: G, L: Layout, time: number, era: EraLook, c: Cache, night: boolean): void {
  const gy = L.groundY;
  const base = g.globalAlpha;
  const ei = ['ancient', 'medieval', 'early', 'industrial', 'modern', 'future'].indexOf(era);
  drawClouds(g, L, c, time, gy * 0.45, night ? 0.6 : 0.9);
  if (night) {
    const st = c.stars;
    g.fillStyle = '#ffffff';
    for (let i = 0; i < st.length; i += 4) {
      const a = Math.sin(time * 1.3 + st[i + 3]);
      if (a < 0.2) continue;
      g.globalAlpha = base * a * 0.9;
      const s = st[i + 2];
      g.fillRect(st[i] - s / 2, st[i + 1] - s / 2, s, s);
    }
    g.globalAlpha = base;
  } else {
    // two lazy flocks of birds
    g.strokeStyle = 'rgba(40,40,50,0.6)';
    g.lineWidth = 1.6;
    g.beginPath();
    for (let f = 0; f < 2; f++) {
      const span = L.w + 300;
      const fx = ((time * (14 + f * 6) + f * span * 0.5) % span) - 150;
      const fy = gy * (0.22 + f * 0.12) + Math.sin(time * 0.4 + f) * 10;
      for (let b = 0; b < 4; b++) {
        const x = fx - b * 16 + (b % 2) * 4;
        const y = fy + Math.abs(b - 1.5) * 7;
        const flap = Math.sin(time * 6 + b * 1.3 + f) * 3;
        g.moveTo(x - 6, y - flap);
        g.lineTo(x, y);
        g.lineTo(x + 6, y - flap);
      }
    }
    g.stroke();
  }
  // chimney smoke
  const ch = c.chimneys;
  if (ch.length) {
    g.fillStyle = night ? '#2a2630' : '#8a8580';
    for (let i = 0; i < ch.length; i += 2) {
      for (let k = 0; k < 5; k++) {
        const age = (time * 0.18 + k / 5 + i * 0.13) % 1;
        g.globalAlpha = base * (1 - age) * 0.4;
        g.beginPath();
        g.arc(ch[i] + age * 40, ch[i + 1] - age * 90, 6 + age * 18, 0, TAU);
        g.fill();
      }
    }
    g.globalAlpha = base;
  }
  // future: flying traffic lanes
  if (ei === 5) {
    for (let i = 0; i < 6; i++) {
      const lane = i % 2;
      const sp = 60 + i * 12;
      const x = lane ? L.w - (((time * sp + i * 300) % (L.w + 100)) - 50) : ((time * sp + i * 300) % (L.w + 100)) - 50;
      const y = gy * (0.38 + lane * 0.1) + Math.sin(time + i) * 4;
      g.fillStyle = night ? '#0a0a1a' : '#2a3050';
      g.fillRect(x - 9, y - 3, 18, 6);
      g.globalAlpha = base * (night ? 1 : 0.6);
      g.drawImage(c.dot[lane ? 1 : 2], x + (lane ? 6 : -14), y - 8, 16, 16);
      g.globalAlpha = base;
    }
  }
  // street traffic (industrial onwards)
  if (ei >= 3) {
    const cars = c.cars;
    for (let i = 0; i < cars.length; i += 4) {
      const lane = cars[i + 1];
      const dir = lane ? -1 : 1;
      const span = L.w + 200;
      let x = ((cars[i] + time * cars[i + 2]) % span) - 100;
      if (dir < 0) x = L.w - x;
      const y = c.roadTop + c.roadH * (lane ? 0.78 : 0.32);
      const len = 46;
      const hover = ei === 5;
      const by = y - (hover ? 8 : 4);
      g.fillStyle = night ? '#0b0c12' : ei === 3 ? OLD_CAR_COLS[cars[i + 3]] : CAR_COLS[cars[i + 3]];
      g.fillRect(x - len / 2, by - 10, len, 10);
      g.fillRect(x - len * 0.3 + dir * 2, by - 18, len * 0.5, 9);
      if (!night) {
        g.fillStyle = 'rgba(190,220,255,0.8)';
        g.fillRect(x - len * 0.24 + dir * 2, by - 16, len * 0.38, 5);
      }
      if (!hover) {
        g.fillStyle = '#101014';
        g.beginPath();
        g.arc(x - len * 0.3, by, 4.5, 0, TAU);
        g.arc(x + len * 0.3, by, 4.5, 0, TAU);
        g.fill();
      }
      if (night || hover) {
        g.drawImage(c.dot[0], x + dir * len * 0.5 - 12, by - 18, 24, 24);
        g.drawImage(c.dot[1], x - dir * len * 0.5 - 8, by - 14, 16, 16);
        if (hover) g.drawImage(c.dot[2], x - 20, by - 10, 40, 24);
      }
    }
  }
  // a few pedestrians on the pavement
  const py = gy + (c.roadTop - gy) * 0.75;
  for (let i = 0; i < 3; i++) {
    const dir: 1 | -1 = i % 2 ? -1 : 1;
    const span = L.w + 60;
    let x = ((time * (12 + i * 4) + i * span * 0.37) % span) - 30;
    if (dir < 0) x = L.w - x;
    person(g, x, py, 26 + i * 2, { color: night ? '#08080c' : 'rgba(30,30,40,0.85)', pose: 'walk', phase: time * 0.6 + i, dir });
  }
}

function drawPrisonDyn(g: G, L: Layout, time: number, c: Cache, night: boolean): void {
  const [wx, wy, ww, wh] = c.win;
  const base = g.globalAlpha;
  // clouds sliding past the window
  g.save();
  g.beginPath();
  g.rect(wx, wy, ww, wh);
  g.clip();
  const x = ((time * 6) % (ww + 200)) - 160 + wx;
  g.globalAlpha = base * (night ? 0.5 : 0.9);
  g.drawImage(c.clouds[0], x, wy + wh * 0.2, 180, 76);
  g.restore();
  // bars (drawn over the clouds)
  g.fillStyle = night ? '#121418' : '#2a2e34';
  const n = 5;
  for (let i = 1; i < n; i++) g.fillRect(wx + (ww * i) / n - 4, wy, 8, wh);
  g.fillRect(wx, wy + wh * 0.5 - 3, ww, 6);
  // dust motes in the light shaft by day, a flickering bulb by night
  if (!night) {
    g.fillStyle = '#fff6d8';
    for (let i = 0; i < 18; i++) {
      const k = (time * 0.03 + i * 0.137) % 1;
      const mx = wx + ww * ((i * 0.37) % 1) + k * L.groundY * 0.45;
      const my = wy + wh + k * (L.groundY - wy - wh) + Math.sin(time + i) * 6;
      g.globalAlpha = base * Math.sin(k * Math.PI) * 0.6;
      g.fillRect(mx, my, 2, 2);
    }
    g.globalAlpha = base;
  } else {
    const fl = Math.sin(time * 23) > 0.96 ? 0.4 : 1;
    const bx = L.portrait ? L.w * 0.5 : L.slots[1];
    g.globalAlpha = base * 0.55 * fl;
    g.drawImage(c.dot[0], bx - 160, -60, 320, 220);
    g.globalAlpha = base;
  }
}

function moodTint(g: G, L: Layout, mood: number, night: boolean): void {
  const k = clamp(mood) - 0.5;
  const base = g.globalAlpha;
  if (k > 0.04) {
    g.globalAlpha = base * k * (night ? 0.16 : 0.22);
    g.fillStyle = '#ffa04a';
    g.fillRect(0, 0, L.w, L.h);
  } else if (k < -0.04) {
    g.globalAlpha = base * -k * 0.55;
    g.fillStyle = '#4a5468';
    g.fillRect(0, 0, L.w, L.h);
  }
  g.globalAlpha = base;
}

// ------------------------------------------------------------------ entry point

export function drawBackdrop(g: CanvasRenderingContext2D, L: Layout, time: number, era: EraLook, o: BackdropOpts): void {
  const m = g.getTransform();
  const scale = clamp(Math.round(Math.hypot(m.a, m.b) * 4) / 4, 1, 2);
  const wq = Math.round(clamp(o.wealth) * 3);
  const key = `${L.w}x${L.h}@${scale}|${L.phone.x},${L.phone.w}|${era}|${o.night ? 1 : 0}|${o.prison ? 1 : 0}|${o.prison ? 0 : wq}`;
  if (!cache || cache.key !== key) cache = build(key, L, era, o.night, o.prison, wq / 3, scale);
  g.save();
  g.drawImage(cache.canvas, 0, 0, L.w, L.h);
  if (o.prison) drawPrisonDyn(g, L, time, cache, o.night);
  else drawCityDyn(g, L, time, era, cache, o.night);
  moodTint(g, L, o.mood, o.night);
  g.restore();
}
