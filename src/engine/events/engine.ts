import { Ctx } from '../ctx';
import type { GameState, PendingEvent, ResolvedEvent } from '../types';
import { distortChoices } from '../systems/mind';
import { ALL_CHAINS, ALL_EVENTS } from './registry';
import { textOf, type ChainDef, type EventDef } from './types';

export const EVENTS: Record<string, EventDef> = {};
for (const e of ALL_EVENTS) {
  if (EVENTS[e.id]) throw new Error(`Duplicate event id ${e.id}`);
  EVENTS[e.id] = e;
}
export const CHAINS: Record<string, ChainDef> = Object.fromEntries(ALL_CHAINS.map((c) => [c.id, c]));

/** Errors swallowed while resolving content; surfaced by tests and the simulator. */
export const ENGINE_ERRORS: string[] = [];

function safeAuto(e: EventDef, x: Ctx): string {
  if (!e.auto) return '';
  try {
    return e.auto(x) || '';
  } catch (err) {
    ENGINE_ERRORS.push(`${e.id}[auto]: ${(err as Error).message}`);
    return '';
  }
}

/** Whether a queued random event still makes sense at resolution time. */
function stillRelevant(x: Ctx, e: EventDef): boolean {
  if (!e.triggered) {
    if (x.c.legal.prison && !e.prison) return false;
    if (!x.c.legal.prison && e.prison === true && e.cat === 'legal') return false;
  }
  if (e.when && !e.when(x)) return false;
  if (!e.triggered && typeof e.weight === 'function' && e.weight(x) <= 0) return false;
  return true;
}

function eligible(x: Ctx, e: EventDef, random: boolean): boolean {
  const c = x.c;
  if (random && e.triggered) return false;
  if (e.minAge !== undefined && c.age < e.minAge) return false;
  if (e.maxAge !== undefined && c.age > e.maxAge) return false;
  if (e.years && (x.year < e.years[0] || x.year > e.years[1])) return false;
  if (random && c.legal.prison && !e.prison) return false;
  if (random && !c.legal.prison && e.prison === true && e.cat === 'legal') return false;
  const last = c.eventHistory[e.id];
  if (last !== undefined) {
    if (e.once) return false;
    if (random && c.age - last < (e.cooldown ?? 3)) return false;
  }
  if (e.when && !e.when(x)) return false;
  return true;
}

function weightOf(x: Ctx, e: EventDef): number {
  let w = typeof e.weight === 'function' ? e.weight(x) : e.weight ?? 1;
  if (w <= 0) return 0;
  if (e.memory) for (const [tag, mult] of Object.entries(e.memory)) if (x.hasMemory(tag)) w *= mult;
  if (e.violent && x.curse('violence')) w *= 3;
  if (e.violent && x.blessing('protection')) w *= 0.5;
  return w;
}

/** Fire an event now: queue it when it has choices, otherwise resolve it. */
export function fire(x: Ctx, e: EventDef, chainId?: string): boolean {
  const params = e.bind ? e.bind(x) : {};
  if (params === null) return false;
  x.c.eventHistory[e.id] = x.c.age;
  if (e.choices?.length) {
    x.s.queue.push({ uid: x.uid('q'), eventId: e.id, params, age: x.c.age, visible: [], distortions: [], chainId });
    return true;
  }
  const px = new Ctx(x.s, params);
  const title = textOf(e.title, px);
  const text = textOf(e.text, px);
  const out = safeAuto(e, px);
  const msg = [text, out].filter(Boolean).join(' ');
  px.log(`${title}: ${msg}`, 'neutral');
  x.s.recent.push({ title, text, outcome: out || '', age: x.c.age });
  if (chainId) advanceChain(x, chainId);
  return true;
}

/** Choose random life events for the year. Childhood is quieter than adulthood. */
export function rollYearEvents(x: Ctx): void {
  const age = x.c.age;
  let n = age < 3 ? 0 : age < 6 ? 1 : age < 13 ? 1 + (x.chance(0.4) ? 1 : 0) : 2 + (x.chance(0.5) ? 1 : 0);
  if (x.c.legal.prison) n = 1 + (x.chance(0.3) ? 1 : 0);
  const fired = new Set<string>();
  for (let i = 0; i < n; i++) {
    const pool = ALL_EVENTS.filter((e) => !fired.has(e.id) && eligible(x, e, true));
    const pick = x.weighted(pool, (e) => weightOf(x, e));
    if (!pick) break;
    fired.add(pick.id);
    fire(x, pick);
  }
}

export function advanceChain(x: Ctx, chainId: string): void {
  const ch = x.c.chains.find((q) => q.chainId === chainId);
  const def = CHAINS[chainId];
  if (!ch || !def) return;
  ch.step++;
  if (ch.step >= def.steps.length) {
    x.c.chains = x.c.chains.filter((q) => q !== ch);
    return;
  }
  ch.dueAge = x.c.age + def.steps[ch.step].delay;
}

/** Queue the next step of every consequence chain that has come due. */
export function chainTick(x: Ctx): void {
  for (const ch of [...x.c.chains]) {
    if (ch.dueAge > x.c.age) continue;
    const def = CHAINS[ch.chainId];
    if (!def) {
      x.endChain(ch.chainId);
      continue;
    }
    const step = def.steps[ch.step];
    const ev = step && EVENTS[step.eventId];
    if (!ev) {
      x.endChain(ch.chainId);
      continue;
    }
    const px = new Ctx(x.s, { ...ch.params });
    if (ev.when && !ev.when(px)) {
      advanceChain(x, ch.chainId);
      continue;
    }
    ch.dueAge = 99999;
    x.c.eventHistory[ev.id] = x.c.age;
    if (ev.choices?.length) {
      x.s.queue.push({ uid: x.uid('q'), eventId: ev.id, params: { ...ch.params }, age: x.c.age, visible: [], distortions: [], chainId: ch.chainId });
    } else {
      const title = textOf(ev.title, px);
      const text = textOf(ev.text, px);
      const out = safeAuto(ev, px);
      px.log(`${title}: ${[text, out].filter(Boolean).join(' ')}`, 'major');
      x.s.recent.push({ title, text, outcome: out || '', age: x.c.age });
      advanceChain(x, ch.chainId);
    }
  }
}

/** Resolve visibility (mental-state distortion) and cache text for queued events. */
export function prepareQueue(s: GameState): void {
  for (const q of [...s.queue]) {
    if (q.prepared) continue;
    const def = EVENTS[q.eventId];
    if (!def) {
      s.queue = s.queue.filter((p) => p !== q);
      continue;
    }
    if (!def.choices?.length) {
      // Triggered events without choices resolve on the spot.
      s.queue = s.queue.filter((p) => p !== q);
      const x = new Ctx(s, q.params);
      const title = textOf(def.title, x);
      const text = textOf(def.text, x);
      const out = safeAuto(def, x);
      if (s.char.alive) x.log(`${title}: ${[text, out].filter(Boolean).join(' ')}`, 'major');
      s.recent.push({ title, text, outcome: out || '', age: s.char.age });
      if (q.chainId) advanceChain(x, q.chainId);
      continue;
    }
    if (def.bind && Object.keys(q.params).length === 0 && !q.chainId) {
      const p = def.bind(new Ctx(s, {}));
      if (p) q.params = p;
    }
    const x = new Ctx(s, q.params);
    const choices = def.choices ?? [];
    const available = choices.map((ch, i) => (ch.when && !ch.when(x) ? -1 : i)).filter((i) => i >= 0);
    const d = distortChoices(x, q.uid, choices, available.length ? available : choices.map((_, i) => i));
    q.visible = d.visible;
    q.distortions = d.notes;
    q.title = textOf(def.title, x);
    q.text = textOf(def.text, x);
    q.labels = choices.map((ch) => textOf(ch.label, x));
    q.hints = choices.map((ch) => (ch.hint ? textOf(ch.hint, x) : undefined));
    q.prepared = true;
  }
}

export interface EventView {
  uid: string;
  eventId: string;
  cat: string;
  /** The main person involved, when the event is about someone. */
  npcId?: string;
  /** The pet involved, when the event is about one. */
  petId?: string;
  /** Scene hint from the event definition, if it has one. */
  scene?: string;
  title: string;
  text: string;
  choices: { index: number; label: string; hint?: string }[];
  distortions: string[];
  chain?: string;
}

export function currentEvent(s: GameState): EventView | null {
  // Preparing can auto-resolve choice-less events, so read the front afterwards.
  if (s.queue.some((q) => !q.prepared)) prepareQueue(s);
  const q = s.queue[0];
  if (!q) return null;
  const def = EVENTS[q.eventId];
  const who = typeof q.params.npcId === 'string' && s.npcs[q.params.npcId] ? q.params.npcId : undefined;
  return {
    uid: q.uid,
    eventId: q.eventId,
    cat: def?.cat ?? 'world',
    npcId: who,
    petId: typeof q.params.petId === 'string' && s.char.pets.some((p) => p.id === q.params.petId) ? q.params.petId : undefined,
    scene: def?.scene,
    title: q.title ?? '',
    text: q.text ?? '',
    choices: q.visible.map((i) => ({ index: i, label: q.labels?.[i] ?? '…', hint: q.hints?.[i] })),
    distortions: q.distortions,
    chain: q.chainId ? CHAINS[q.chainId]?.name : undefined,
  };
}

/** Resolve the player's choice for the front event of the queue. */
export function choose(s: GameState, uid: string, index: number): ResolvedEvent | null {
  const qi = s.queue.findIndex((q) => q.uid === uid);
  if (qi < 0) return null;
  const q: PendingEvent = s.queue[qi];
  const def = EVENTS[q.eventId];
  s.queue.splice(qi, 1);
  if (!def?.choices?.[index] || !q.visible.includes(index)) return null;
  const x = new Ctx(s, q.params);
  // Several events can queue in one year; an earlier one may have changed the
  // world (lost the job, ended the marriage). Re-check before resolving.
  if (stillRelevant(x, def) === false) {
    const res: ResolvedEvent = { title: q.title ?? '', text: q.text ?? '', choice: q.labels?.[index], outcome: 'The moment passed.', age: q.age };
    s.recent.push(res);
    if (q.chainId) advanceChain(x, q.chainId);
    prepareQueue(s);
    return res;
  }
  const choice = def.choices[index];
  let out = '';
  try {
    out = choice.run(x) || '';
  } catch (err) {
    ENGINE_ERRORS.push(`${def.id}[${index}]: ${(err as Error).message}`);
    out = 'The moment passed.';
  }
  const res: ResolvedEvent = { title: q.title ?? '', text: q.text ?? '', choice: q.labels?.[index], outcome: out, age: q.age, scene: choice.scene };
  s.recent.push(res);
  if (s.recent.length > 40) s.recent.splice(0, s.recent.length - 40);
  if (s.char.alive) x.log(`${res.title} — ${res.choice}${out ? `: ${out}` : ''}`, 'neutral');
  if (q.chainId) advanceChain(x, q.chainId);
  prepareQueue(s);
  return res;
}
