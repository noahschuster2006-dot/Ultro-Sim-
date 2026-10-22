import { useEffect, useRef } from 'react';
import { drawBackdrop } from './backdrop';
import { sceneBus } from './bus';
import type { SceneId } from './ids';
import { envelope, eraLook, makeLayout, makeRand, type Layout, type SceneDef } from './kit';
import { LIFE_SCENE_DEFS } from './scenesLife';
import { WORLD_SCENE_DEFS } from './scenesWorld';
import { ROMANCE_SCENE_DEFS } from './scenesRomance';
import { LEISURE_SCENE_DEFS } from './scenesLeisure';
import { WORK_SCENE_DEFS } from './scenesWork';
import { ERA_SCENE_DEFS } from './scenesEra';
import { SCENE_FALLBACK } from './fallback';
import { uiPrefs } from '../prefs';

export const SCENE_DEFS: Partial<Record<SceneId, SceneDef>> = {
  ...WORLD_SCENE_DEFS,
  ...LIFE_SCENE_DEFS,
  ...ROMANCE_SCENE_DEFS,
  ...LEISURE_SCENE_DEFS,
  ...WORK_SCENE_DEFS,
  ...ERA_SCENE_DEFS,
};

function defFor(id: SceneId): SceneDef | undefined {
  return SCENE_DEFS[id] ?? (SCENE_FALLBACK[id] ? SCENE_DEFS[SCENE_FALLBACK[id]!] : undefined);
}

export interface StageEnv {
  year: number;
  night: boolean;
  prison: boolean;
  mood: number;
  wealth: number;
}

interface Running {
  id: SceneId;
  def: SceneDef;
  start: number;
  mem: Record<string, unknown>;
  rand: ReturnType<typeof makeRand>;
}

/**
 * Full-viewport canvas behind the phone. Draws the ambient backdrop all the
 * time and plays queued scenes over it, one after another.
 */
export function Stage({ env, phoneEl }: { env: StageEnv; phoneEl: React.RefObject<HTMLElement | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const envRef = useRef(env);
  envRef.current = env;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const g = canvas.getContext('2d');
    if (!g) return;
    let raf = 0;
    let last = performance.now();
    let lastDraw = 0;
    let layout: Layout | null = null;
    let running: Running | null = null;
    const queue: SceneId[] = [];
    let seed = 1;
    let errors = 0;

    const measure = () => {
      // The stage is mostly out of focus behind the phone; 1x keeps big full-screen fills cheap.
      const dpr = Math.min(window.devicePixelRatio || 1, 1);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const el = phoneEl.current;
      // The phone is always centred in the viewport; use its untransformed size so
      // the dip animation does not move the layout.
      const pw = el?.offsetWidth ?? w * 0.3;
      const ph = el?.offsetHeight ?? h - 40;
      const r = { x: (w - pw) / 2, y: (h - ph) / 2, w: pw, h: ph };
      layout = makeLayout(w, h, r);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(document.documentElement);
    if (phoneEl.current) ro.observe(phoneEl.current);
    window.addEventListener('resize', measure);

    const startNext = () => {
      const id = queue.shift();
      const def = id ? defFor(id) : undefined;
      if (!id || !def) {
        running = null;
        sceneBus.setPlaying(null);
        return;
      }
      seed = (seed * 1103515245 + 12345) >>> 0;
      running = { id, def, start: performance.now(), mem: {}, rand: makeRand(seed) };
      sceneBus.setPlaying(id);
    };

    const unsub = sceneBus.subscribe(({ id }) => {
      if (!uiPrefs.get().scenes) return;
      if (running?.id === id || queue.includes(id)) return;
      if (queue.length >= 2) queue.shift();
      queue.push(id);
      if (!running) startNext();
    });
    const skip = () => {
      queue.length = 0;
      if (running) running.start = performance.now() - running.def.dur * 1000 + 450;
    };
    sceneBus.skipListeners.add(skip);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (document.hidden || !layout) return;
      // The idle backdrop only needs ~30fps; scenes get every frame.
      if (!running && now - lastDraw < 33) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      lastDraw = now;
      const L = layout;
      const e = envRef.current;
      const era = eraLook(e.year);
      g.save();
      let shake = 0;
      if (running) {
        const t = (now - running.start) / 1000;
        if (t >= running.def.dur) startNext();
        else if (running.def.shake && !uiPrefs.get().reducedMotion) shake = running.def.shake(t, running.def.dur) * envelope(t, running.def.dur);
      }
      if (shake) g.translate((Math.random() - 0.5) * shake * 2, (Math.random() - 0.5) * shake * 2);
      try {
        drawBackdrop(g, L, now / 1000, era, { night: e.night, prison: e.prison, mood: e.mood, wealth: e.wealth });
      } catch (err) {
        if (errors++ < 3) console.error('backdrop', err);
      }
      if (running) {
        const t = (now - running.start) / 1000;
        const dur = running.def.dur;
        try {
          g.save();
          running.def.draw({ g, L, t, dt, dur, p: Math.min(1, t / dur), a: envelope(t, dur), era, rand: running.rand, mem: running.mem });
          g.restore();
        } catch (err) {
          g.restore();
          if (errors++ < 5) console.error('scene', running.id, err);
          startNext();
        }
      }
      g.restore();
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('resize', measure);
      unsub();
      sceneBus.skipListeners.delete(skip);
      sceneBus.setPlaying(null);
    };
  }, [phoneEl]);

  return <canvas ref={canvasRef} className="stage" aria-hidden onClick={() => sceneBus.skip()} />;
}
