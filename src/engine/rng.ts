/**
 * Deterministic, serializable RNG. All randomness in the engine flows through
 * the `rng` field of the game state so that a seed + the same sequence of
 * player choices always reproduces the same life.
 */
export interface RngHolder {
  rng: number;
}

/** mulberry32 step; mutates holder.rng and returns a float in [0, 1). */
export function rnd(h: RngHolder): number {
  h.rng = (h.rng + 0x6d2b79f5) | 0;
  let t = h.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function rint(h: RngHolder, min: number, max: number): number {
  return Math.floor(rnd(h) * (max - min + 1)) + min;
}

export function rfloat(h: RngHolder, min: number, max: number): number {
  return rnd(h) * (max - min) + min;
}

export function chance(h: RngHolder, p: number): boolean {
  return rnd(h) < p;
}

export function pick<T>(h: RngHolder, arr: readonly T[]): T {
  if (arr.length === 0) throw new Error('pick() from empty array');
  return arr[Math.floor(rnd(h) * arr.length)];
}

export function pickN<T>(h: RngHolder, arr: readonly T[], n: number): T[] {
  return shuffle(h, arr).slice(0, n);
}

export function shuffle<T>(h: RngHolder, arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd(h) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Box-Muller normal sample. */
export function normal(h: RngHolder, mean: number, sd: number): number {
  const u = Math.max(rnd(h), 1e-9);
  const v = rnd(h);
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function weighted<T>(h: RngHolder, items: readonly T[], weight: (t: T) => number): T | undefined {
  let total = 0;
  for (const it of items) total += Math.max(0, weight(it));
  if (total <= 0) return undefined;
  let roll = rnd(h) * total;
  for (const it of items) {
    roll -= Math.max(0, weight(it));
    if (roll <= 0) return it;
  }
  return items[items.length - 1];
}

/** Stable string hash (FNV-1a) for deterministic per-event decisions. */
export function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function newSeed(): number {
  return (Math.floor(Math.random() * 0xffffffff) ^ Date.now()) >>> 0;
}
