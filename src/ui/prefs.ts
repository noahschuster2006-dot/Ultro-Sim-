import { useSyncExternalStore } from 'react';

/** Per-device UI preferences (not part of the save file). */
export interface UiPrefs {
  /** Play background scenes behind the phone. */
  scenes: boolean;
  /** On small screens, lower the phone while a scene plays so it can be seen. */
  dipPhone: boolean;
  /** No camera shake, shorter transitions. */
  reducedMotion: boolean;
  /** Home-screen wallpaper id. */
  wallpaper: string;
}

const KEY = 'lifesim-ultra:ui';
const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const DEFAULTS: UiPrefs = { scenes: true, dipPhone: true, reducedMotion: !!reduced, wallpaper: 'era' };

function load(): UiPrefs {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<UiPrefs>) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

let current = load();
const subs = new Set<() => void>();

export const uiPrefs = {
  get: (): UiPrefs => current,
  set(patch: Partial<UiPrefs>): void {
    current = { ...current, ...patch };
    try {
      localStorage.setItem(KEY, JSON.stringify(current));
    } catch {
      /* storage blocked */
    }
    subs.forEach((fn) => fn());
  },
  subscribe(fn: () => void): () => void {
    subs.add(fn);
    return () => subs.delete(fn);
  },
};

export function usePrefs(): UiPrefs {
  return useSyncExternalStore(uiPrefs.subscribe, uiPrefs.get, uiPrefs.get);
}
