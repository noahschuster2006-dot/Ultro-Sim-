import { ENGINE_ERRORS, ageUp, careerView, choose, continueAs, currentEvent, heirCandidates, newGame, performAction, viewActions, type ActionCat } from '../src/engine/index';
import type { GameState } from '../src/engine/types';
import { STAT_DEFS } from '../src/engine/data/stats';

/** Deterministic tiny RNG for the bot so autoplay is reproducible too. */
function botRng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const CATS: ActionCat[] = ['health', 'mind', 'lifestyle', 'social', 'career', 'education', 'skills', 'crime', 'assets', 'politics', 'media', 'spirit', 'estate', 'prison'];

export function checkInvariants(s: GameState): string[] {
  const errs: string[] = [];
  for (const d of STAT_DEFS) {
    const v = s.char.stats[d.id];
    if (typeof v !== 'number' || Number.isNaN(v)) errs.push(`stat ${d.id} is ${v}`);
    else if (v < d.min - 0.001 || v > d.max + 0.001) errs.push(`stat ${d.id}=${v} out of range`);
  }
  if (!Number.isFinite(s.char.money)) errs.push(`money ${s.char.money}`);
  if (!Number.isFinite(s.char.debt) || s.char.debt < 0) errs.push(`debt ${s.char.debt}`);
  for (const r of s.char.relationships) if (!s.npcs[r.npcId] && r.type !== 'parent') errs.push(`dangling relationship ${r.type} ${r.npcId}`);
  return errs;
}

export interface AutoplayResult {
  generations: number;
  years: number;
  events: number;
  actions: number;
  errors: string[];
  lives: { name: string; age: number; cause: string; year: number }[];
  state: GameState;
}

export function autoplay(seed: number, year: number, countryId: string | undefined, maxGenerations: number, aggressive = false): AutoplayResult {
  const rnd = botRng(seed ^ 0x9e3779b9);
  const s = newGame({ seed, year, countryId });
  const res: AutoplayResult = { generations: 1, years: 0, events: 0, actions: 0, errors: [], lives: [], state: s };
  let guard = 0;
  while (guard++ < 5000) {
    // Resolve events.
    let ev = currentEvent(s);
    let evGuard = 0;
    while (ev && evGuard++ < 50) {
      const pick = ev.choices[Math.floor(rnd() * ev.choices.length)];
      if (!pick) {
        res.errors.push(`event ${ev.title} has no visible choices`);
        s.queue.shift();
      } else {
        choose(s, ev.uid, pick.index);
        res.events++;
      }
      ev = currentEvent(s);
    }
    if (s.phase === 'alive') {
      // A few random actions.
      for (let i = 0; i < 3; i++) {
        const cat = CATS[Math.floor(rnd() * CATS.length)];
        if (!aggressive && (cat === 'crime') && rnd() < 0.7) continue;
        const acts = viewActions(s, cat).filter((a) => a.enabled);
        if (!acts.length) continue;
        const a = acts[Math.floor(rnd() * acts.length)];
        let arg: string | undefined;
        if (a.options?.length) {
          const opts = a.options.filter((o) => !o.disabled);
          if (!opts.length) continue;
          arg = opts[Math.floor(rnd() * opts.length)].value;
        }
        if (a.id === 'practice') arg = Object.keys(s.char.skills)[0] ?? 'literacy';
        if (a.id === 'apply') continue;
        if (['buy', 'buyMortgage', 'buyDirty', 'invest'].includes(a.id)) arg = a.id === 'invest' ? 'stocks' : 'house';
        if (['sell', 'sellPart', 'develop', 'renovate', 'rent'].includes(a.id)) arg = s.char.assets[0]?.id;
        performAction(s, a.id, arg, a.amount ? Math.max(1000, Math.round(s.char.money * 0.2)) : undefined);
        res.actions++;
        const ev2 = currentEvent(s);
        if (ev2) break;
      }
      // Occasionally interact with someone.
      const rels = s.char.relationships;
      if (rels.length && rnd() < 0.5 && !currentEvent(s)) {
        const r = rels[Math.floor(rnd() * rels.length)];
        const acts = viewActions(s, 'rel', r.npcId).filter((a) => a.enabled && !a.options && (aggressive || !['rel_murder', 'rel_attack'].includes(a.id)));
        if (acts.length) {
          performAction(s, acts[Math.floor(rnd() * acts.length)].id, r.npcId);
          res.actions++;
        }
      }
      // Try for a job sometimes.
      if (!s.char.career && s.char.age >= 18 && rnd() < 0.5 && !currentEvent(s)) {
        const options = careerView(s).filter((v) => v.eligible);
        if (options.length) performAction(s, 'apply', options[Math.floor(rnd() * options.length)].def.id);
      }
      if (currentEvent(s)) continue;
      const r = ageUp(s);
      if (!r.ok) {
        if (s.queue.length) continue;
        res.errors.push(`ageUp refused: ${r.reason}`);
        break;
      }
      res.years++;
      while (ENGINE_ERRORS.length) res.errors.push(`engine: ${ENGINE_ERRORS.shift()}`);
      for (const e of checkInvariants(s)) res.errors.push(`gen ${res.generations} age ${s.char.age}: ${e}`);
      if (res.errors.length > 20) break;
    }
    if (s.phase === 'dead' || s.phase === 'over') {
      const d = s.death!;
      res.lives.push({ name: d.name, age: d.age, cause: d.cause, year: d.year });
      if (s.phase === 'over' || res.generations >= maxGenerations) break;
      const heirs = heirCandidates(s);
      if (!heirs.length) break;
      continueAs(s, heirs[Math.floor(rnd() * heirs.length)].id);
      res.generations++;
    }
  }
  return res;
}
