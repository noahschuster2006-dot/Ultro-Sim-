import type { SceneId } from './ids';

/** Tiny pub/sub between game logic (which decides what happened) and the stage (which draws it). */
type Req = { id: SceneId; key: string };
type Listener = (r: Req) => void;

const listeners = new Set<Listener>();
const stateListeners = new Set<(playing: SceneId | null) => void>();
let current: SceneId | null = null;
const recentKeys: string[] = [];

export const sceneBus = {
  /** Ask the stage to play a scene. `key` de-duplicates (e.g. one event uid plays once). */
  play(id: SceneId | null | undefined, key: string = `${id}:${Date.now()}`): void {
    if (!id) return;
    if (recentKeys.includes(key)) return;
    recentKeys.push(key);
    if (recentKeys.length > 60) recentKeys.shift();
    listeners.forEach((fn) => fn({ id, key }));
  },
  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  /** Stage reports what is playing so the phone can lower itself. */
  setPlaying(id: SceneId | null): void {
    if (id === current) return;
    current = id;
    stateListeners.forEach((fn) => fn(id));
  },
  get playing(): SceneId | null {
    return current;
  },
  onPlaying(fn: (playing: SceneId | null) => void): () => void {
    stateListeners.add(fn);
    return () => stateListeners.delete(fn);
  },
  skipListeners: new Set<() => void>(),
  /** Skip whatever is playing (tap on the background). */
  skip(): void {
    this.skipListeners.forEach((fn) => fn());
  },
};
