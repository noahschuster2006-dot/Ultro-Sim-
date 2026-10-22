import type { Ctx } from '../ctx';
import { CAREERS, CAREER_BY_ID, careerTitle, type CareerDef } from '../data/careers';
import { eraOf } from '../data/eras';
import { religionWeights } from '../data/countries';
import { normal, weighted } from '../rng';
import type { Gender, NPC, NpcLinkKind, Sexuality } from '../types';
import { firstName, lastName } from './naming';

export interface NpcOpts {
  gender?: Gender;
  age?: number;
  birthYear?: number;
  firstName?: string;
  lastName?: string;
  countryId?: string;
  religionId?: string;
  career?: string | null;
  careerLevel?: number;
  karma?: number;
  wealth?: number;
  smarts?: number;
  looks?: number;
  aggression?: number;
  criminal?: number;
  sexuality?: Sexuality;
  dynasty?: boolean;
  parentIds?: string[];
  fame?: number;
}

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

function rollSexuality(x: Ctx): Sexuality {
  const r = x.r();
  if (r < 0.05) return 'gay';
  if (r < 0.1) return 'bisexual';
  if (r < 0.12) return 'asexual';
  return 'straight';
}

export function makeNpc(x: Ctx, o: NpcOpts = {}): NPC {
  const year = x.year;
  const birthYear = o.birthYear ?? year - (o.age ?? x.int(18, 60));
  const countryId = o.countryId ?? x.c.countryId;
  const gender: Gender = o.gender ?? (x.chance(0.5) ? 'male' : 'female');
  const rel = o.religionId ?? weighted(x.s, religionWeights(countryId, birthYear), ([, w]) => w)?.[0] ?? 'none';
  const npc: NPC = {
    id: x.uid('n'),
    firstName: o.firstName ?? firstName(x.s, countryId, birthYear, gender),
    lastName: o.lastName ?? lastName(x.s, countryId, birthYear),
    gender,
    sexuality: o.sexuality ?? rollSexuality(x),
    birthYear,
    alive: true,
    countryId,
    religionId: rel,
    smarts: clamp(o.smarts ?? normal(x.s, 50, 16)),
    looks: clamp(o.looks ?? normal(x.s, 50, 16)),
    health: clamp(normal(x.s, 78, 12)),
    karma: Math.max(-100, Math.min(100, Math.round(o.karma ?? normal(x.s, 10, 30)))),
    ambition: clamp(normal(x.s, 50, 18)),
    aggression: clamp(o.aggression ?? normal(x.s, 30, 15)),
    charisma: clamp(normal(x.s, 50, 16)),
    loyalty: clamp(normal(x.s, 55, 18)),
    fame: o.fame ?? 0,
    wealth: o.wealth ?? Math.max(0, Math.round(normal(x.s, 20000, 25000))),
    career: null,
    education: [],
    traits: [],
    links: [],
    childIds: [],
    parentIds: o.parentIds ?? [],
    notes: [],
    dynasty: o.dynasty,
    criminal: o.criminal ?? 0,
  };
  const age = year - birthYear;
  if (o.career !== undefined) {
    npc.career = o.career ? { careerId: o.career, level: o.careerLevel ?? Math.max(1, Math.min(10, Math.round((age - 18) / 5) + 1)) } : null;
  } else if (age >= 18) {
    const def = pickNpcCareer(x, npc);
    if (def) npc.career = { careerId: def.id, level: Math.max(1, Math.min(10, Math.round((age - 18) / 6) + x.int(0, 2))) };
  }
  if (npc.career && CAREER_BY_ID[npc.career.careerId]?.tags.includes('criminal')) npc.criminal = Math.max(npc.criminal ?? 0, 40);
  x.s.npcs[npc.id] = npc;
  return npc;
}

export function pickNpcCareer(x: Ctx, npc: NPC): CareerDef | undefined {
  const year = x.year;
  const crooked = npc.karma < -25 || (npc.criminal ?? 0) > 30;
  const pool = CAREERS.filter(
    (c) =>
      year >= c.years[0] &&
      year <= c.years[1] &&
      !c.special &&
      !c.family &&
      !c.needsWar &&
      (!c.countries || c.countries.includes(npc.countryId)) &&
      (c.min?.smarts ?? 0) <= npc.smarts + 10,
  );
  return weighted(x.s, pool, (c) => {
    let w = 1;
    if (c.tags.includes('criminal')) w = crooked ? 3 : 0.08;
    if (c.cat === 'trades' || c.cat === 'service') w *= 2.2;
    if (c.edu && npc.smarts < 55) w *= 0.4;
    return w;
  });
}

export function npcTitle(x: Ctx, npc: NPC): string {
  if (!npc.career) return x.npcAge(npc) < 18 ? (x.npcAge(npc) < 5 ? 'Toddler' : 'Student') : 'Unemployed';
  const def = CAREER_BY_ID[npc.career.careerId];
  return def ? careerTitle(def, npc.career.level, false) : 'Worker';
}

export function linkNpcs(x: Ctx, a: string, b: string, kind: NpcLinkKind): void {
  const na = x.s.npcs[a];
  const nb = x.s.npcs[b];
  if (!na || !nb || a === b) return;
  if (!na.links.some((l) => l.npcId === b)) na.links.push({ npcId: b, kind });
  if (!nb.links.some((l) => l.npcId === a)) nb.links.push({ npcId: a, kind });
}

/**
 * Ripple effects through the relationship graph: hurting someone angers their
 * allies and family; helping them earns goodwill. Reaches 2 hops out.
 */
export function ripple(x: Ctx, npcId: string, delta: number, reason: string): string[] {
  const hit: string[] = [];
  const npc = x.s.npcs[npcId];
  if (!npc) return hit;
  const seen = new Set([npcId]);
  const frontier = npc.links.filter((l) => l.kind === 'ally' || l.kind === 'family' || l.kind === 'spouse' || l.kind === 'gang').map((l) => ({ id: l.npcId, factor: 1 }));
  for (const second of [...frontier]) {
    const n2 = x.s.npcs[second.id];
    if (!n2) continue;
    for (const l of n2.links) if ((l.kind === 'ally' || l.kind === 'family') && !frontier.some((f) => f.id === l.npcId)) frontier.push({ id: l.npcId, factor: 0.4 });
  }
  for (const f of frontier) {
    if (seen.has(f.id)) continue;
    seen.add(f.id);
    const n = x.s.npcs[f.id];
    if (!n?.alive) continue;
    const r = x.rel(f.id);
    const d = Math.round(delta * f.factor);
    if (r) {
      r.affinity = Math.max(0, Math.min(100, r.affinity + d));
      if (r.affinity < 15 && delta < 0 && !['parent', 'child', 'sibling', 'spouse'].includes(r.type)) r.type = 'enemy';
    } else if (delta <= -25 && f.factor === 1) {
      x.addRel(f.id, 'enemy', { affinity: 10, trust: 5, meta: { reason } });
    }
    hit.push(f.id);
  }
  return hit;
}

export interface NpcNews {
  npcId: string;
  text: string;
  kind: 'death' | 'rise' | 'crime' | 'marriage' | 'birth' | 'fall';
}

function mortality(age: number, health: number, year: number): number {
  let p = age < 1 ? eraOf(year).infantMortality : age < 40 ? 0.002 : age < 60 ? 0.006 : age < 70 ? 0.018 : age < 80 ? 0.045 : age < 90 ? 0.11 : 0.25;
  const em = eraOf(year).lifespanModifier;
  if (em < 0 && age >= 1) p *= 1 + -em / 12;
  if (health < 30) p *= 2;
  return Math.min(0.6, p);
}

/**
 * NPC autonomy. Everyone the player knows lives their own life: ages, works,
 * rises, falls, marries, has children and dies — whether you watch or not.
 */
export function npcTick(x: Ctx): NpcNews[] {
  const news: NpcNews[] = [];
  const known = new Set(x.c.relationships.map((r) => r.npcId));
  for (const npc of Object.values(x.s.npcs)) {
    if (!npc.alive) continue;
    const age = x.year - npc.birthYear;
    if (age < 0) continue;
    if (age > 50) npc.health = clamp(npc.health - x.float(0, 2.5));
    else npc.health = clamp(npc.health + x.float(-1, 1));
    if (x.chance(mortality(age, npc.health, x.year))) {
      npc.alive = false;
      npc.deathYear = x.year;
      npc.causeOfDeath = age > 70 ? x.pick(['old age', 'heart failure', 'a stroke', 'pneumonia']) : (npc.criminal ?? 0) > 40 && x.chance(0.5) ? 'a gangland shooting' : x.pick(['an accident', 'cancer', 'a heart attack', 'an illness']);
      if (known.has(npc.id) || npc.dynasty) news.push({ npcId: npc.id, text: `${npc.firstName} ${npc.lastName} died of ${npc.causeOfDeath} at ${age}.`, kind: 'death' });
      continue;
    }
    npc.karma = Math.max(-100, Math.min(100, npc.karma + Math.round(normal(x.s, 0, 2))));
    // Careers.
    if (age >= 18 && age < 67) {
      if (!npc.career && x.chance(0.35)) {
        const def = pickNpcCareer(x, npc);
        if (def) npc.career = { careerId: def.id, level: 1 };
      } else if (npc.career) {
        const def = CAREER_BY_ID[npc.career.careerId];
        if (!def || x.year > def.years[1]) {
          npc.career = null;
        } else {
          const promoteP = 0.08 + npc.ambition / 400 + npc.smarts / 600;
          if (npc.career.level < 10 && x.chance(promoteP)) {
            npc.career.level++;
            if (npc.career.level >= 7 && known.has(npc.id)) {
              const title = careerTitle(def, npc.career.level, false);
              npc.notes.push(`Became ${title} at ${age}`);
              news.push({ npcId: npc.id, text: `${npc.firstName} ${npc.lastName} has become ${aOrAn(title)} ${title}.`, kind: def.tags.includes('criminal') ? 'crime' : 'rise' });
            }
          }
          npc.wealth += Math.round(def.salary * Math.pow(def.growth, npc.career.level - 1) * 0.15);
          if (def.tags.includes('fame')) npc.fame = clamp(npc.fame + (def.fame ?? 1) * 0.5);
          if (def.tags.includes('criminal')) npc.criminal = clamp((npc.criminal ?? 0) + 2);
        }
        // Rare turn to crime.
        if (npc.karma < -35 && x.chance(0.03) && !def?.tags.includes('criminal')) {
          const crimeCareer = CAREERS.find((c) => c.tags.includes('criminal') && !c.special && x.year >= c.years[0] && x.year <= c.years[1] && (!c.countries || c.countries.includes(npc.countryId)));
          if (crimeCareer) {
            npc.career = { careerId: crimeCareer.id, level: 1 };
            npc.criminal = clamp((npc.criminal ?? 0) + 25);
            if (known.has(npc.id)) news.push({ npcId: npc.id, text: `Word on the street: ${npc.firstName} ${npc.lastName} has turned to crime.`, kind: 'fall' });
          }
        }
      }
    } else if (age >= 67 && npc.career && x.chance(0.4)) {
      npc.career = null;
      npc.notes.push(`Retired at ${age}`);
    }
    // Marriage & children for NPCs that matter to the dynasty.
    if (!npc.spouseId && !npc.spouseName && age >= 20 && age <= 50 && x.chance(0.09)) {
      if (npc.dynasty) {
        const sp = makeNpc(x, { gender: npc.gender === 'male' ? 'female' : 'male', age: Math.max(18, age + x.int(-4, 4)), countryId: npc.countryId });
        npc.spouseId = sp.id;
        sp.spouseId = npc.id;
        linkNpcs(x, npc.id, sp.id, 'spouse');
        news.push({ npcId: npc.id, text: `${npc.firstName} married ${sp.firstName} ${sp.lastName}.`, kind: 'marriage' });
      } else {
        npc.spouseName = `${firstName(x.s, npc.countryId, npc.birthYear, npc.gender === 'male' ? 'female' : 'male')} ${npc.lastName}`;
      }
    }
    if (npc.dynasty && npc.spouseId && age >= 20 && age <= 42 && npc.childIds.length < 4 && x.chance(0.16)) {
      const sp = x.s.npcs[npc.spouseId];
      const surname = npc.gender === 'male' || !sp ? npc.lastName : sp.lastName;
      const kid = makeNpc(x, {
        age: 0,
        lastName: x.s.dynasty.name && npc.lastName === x.s.dynasty.name ? x.s.dynasty.name : surname,
        countryId: npc.countryId,
        career: null,
        dynasty: true,
        parentIds: [npc.id, npc.spouseId],
        smarts: (npc.smarts + (sp?.smarts ?? 50)) / 2 + normal(x.s, 0, 10),
        looks: (npc.looks + (sp?.looks ?? 50)) / 2 + normal(x.s, 0, 10),
      });
      npc.childIds.push(kid.id);
      if (sp) sp.childIds.push(kid.id);
      linkNpcs(x, npc.id, kid.id, 'family');
      if (x.rel(npc.id)?.type === 'child') {
        x.addRel(kid.id, 'grandchild', { affinity: 70, trust: 70 });
        x.c.flags.grandchildren = ((x.c.flags.grandchildren as number) || 0) + 1;
      }
      news.push({ npcId: kid.id, text: `${npc.firstName} welcomed a baby: ${kid.firstName}.`, kind: 'birth' });
    }
  }
  prune(x);
  return news;
}

function prune(x: Ctx): void {
  const keep = new Set<string>();
  for (const r of x.c.relationships) keep.add(r.npcId);
  for (const n of Object.values(x.s.npcs)) if (n.dynasty) {
    keep.add(n.id);
    if (n.spouseId) keep.add(n.spouseId);
    n.childIds.forEach((c) => keep.add(c));
    n.parentIds.forEach((c) => keep.add(c));
  }
  for (const m of x.c.memories) if (m.npcId) keep.add(m.npcId);
  for (const ch of x.c.chains) for (const v of Object.values(ch.params)) if (typeof v === 'string' && x.s.npcs[v]) keep.add(v);
  for (const q of x.s.queue) for (const v of Object.values(q.params)) if (typeof v === 'string' && x.s.npcs[v]) keep.add(v);
  for (const e of x.s.dynasty.enemies) if (e.npcId) keep.add(e.npcId);
  for (const a of x.s.dynasty.allies) if (a.npcId) keep.add(a.npcId);
  // Keep second-degree links of living relationships.
  for (const id of [...keep]) for (const l of x.s.npcs[id]?.links ?? []) keep.add(l.npcId);
  for (const id of Object.keys(x.s.npcs)) {
    const n = x.s.npcs[id];
    if (keep.has(id)) continue;
    if (!n.alive && n.deathYear && x.year - n.deathYear < 5) continue;
    delete x.s.npcs[id];
  }
  for (const n of Object.values(x.s.npcs)) n.links = n.links.filter((l) => x.s.npcs[l.npcId]);
}

export function aOrAn(word: string): string {
  if (/^(uni|use|usu|uti|eu|one|once)/i.test(word)) return 'a';
  if (/^(hour|honest|honor|heir)/i.test(word)) return 'an';
  return /^[aeiou]/i.test(word) ? 'an' : 'a';
}
