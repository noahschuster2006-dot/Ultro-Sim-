import { chance, pick, rfloat, rint, rnd, weighted } from './rng';
import { STAT_BY_ID, type StatId } from './data/stats';
import { eraOf, mediaEraOf, type EraDef } from './data/eras';
import { countryName } from './data/countries';
import type { Character, GameState, LifeStage, Memory, NPC, Params, Relationship, RelType, StoryKind, Tone, WorldContext, Pet, Item } from './types';
import { SKILL_BY_ID, UNLOCK_LEVEL } from './data/skills';

export function lifeStage(age: number): LifeStage {
  if (age < 2) return 'infant';
  if (age < 13) return 'child';
  if (age < 18) return 'teen';
  if (age < 30) return 'youngAdult';
  if (age < 45) return 'adult';
  if (age < 65) return 'midlife';
  if (age < 85) return 'senior';
  return 'elder';
}

export const STAGE_NAMES: Record<LifeStage, string> = {
  infant: 'Infant',
  child: 'Childhood',
  teen: 'Teen',
  youngAdult: 'Young adult',
  adult: 'Adult',
  midlife: 'Mid-life',
  senior: 'Senior',
  elder: 'Elder',
};

/** A calendar year for display: 35 BC, 1990. */
export function fmtYear(y: number): string {
  return y < 0 ? `${-y} BC` : String(y);
}

export function fmtMoney(n: number): string {
  const sign = n < 0 ? '-' : '';
  const a = Math.abs(Math.round(n));
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e4) return `${sign}$${Math.round(a / 1000)}K`;
  return `${sign}$${a.toLocaleString('en-US')}`;
}

const MIND_STATS = new Set<StatId>(['anxiety', 'depression', 'trauma', 'mania', 'paranoia', 'stress']);

/**
 * The context object every system and event works through. It wraps the
 * mutable game state with helpers for stats, money, memory, relationships,
 * chains and randomness so that content code stays short and consistent.
 */
export class Ctx {
  constructor(
    public s: GameState,
    public p: Params = {},
  ) {}

  get c(): Character {
    return this.s.char;
  }
  get w(): WorldContext {
    return this.s.world.contexts[this.c.countryId];
  }
  get year(): number {
    return this.s.world.year;
  }
  get age(): number {
    return this.c.age;
  }
  get era(): EraDef {
    return eraOf(this.year);
  }
  get stage(): LifeStage {
    return lifeStage(this.c.age);
  }
  get he(): string {
    return this.c.gender === 'male' ? 'he' : this.c.gender === 'female' ? 'she' : 'they';
  }
  get countryName(): string {
    return countryName(this.c.countryId, this.year);
  }
  get media() {
    return mediaEraOf(this.year);
  }

  // ---------------------------------------------------------------- randomness
  r(): number {
    return rnd(this.s);
  }
  chance(p: number): boolean {
    return chance(this.s, p);
  }
  int(a: number, b: number): number {
    return rint(this.s, a, b);
  }
  float(a: number, b: number): number {
    return rfloat(this.s, a, b);
  }
  pick<T>(arr: readonly T[]): T {
    return pick(this.s, arr);
  }
  weighted<T>(arr: readonly T[], w: (t: T) => number): T | undefined {
    return weighted(this.s, arr, w);
  }
  uid(prefix: string): string {
    return `${prefix}${this.s.nextId++}`;
  }

  // ---------------------------------------------------------------- stats
  stat(id: StatId): number {
    return this.c.stats[id];
  }
  mod(id: StatId, delta: number): number {
    if (!delta || Number.isNaN(delta)) return 0;
    const def = STAT_BY_ID[id];
    let d = delta;
    if (d > 0 && MIND_STATS.has(id) && this.curse('madness')) d *= 2;
    if (d < 0 && id === 'health' && this.blessing('vitality')) d *= 0.8;
    const cap = this.c.bio.caps[id] ?? def.max;
    const before = this.c.stats[id];
    const after = Math.max(def.min, Math.min(cap, before + d));
    this.c.stats[id] = Math.round(after * 10) / 10;
    return this.c.stats[id] - before;
  }
  mods(m: Partial<Record<StatId, number>>): void {
    for (const k of Object.keys(m) as StatId[]) this.mod(k, m[k]!);
  }
  set(id: StatId, value: number): void {
    const def = STAT_BY_ID[id];
    this.c.stats[id] = Math.max(def.min, Math.min(this.c.bio.caps[id] ?? def.max, value));
  }

  // ---------------------------------------------------------------- money
  money(amount: number): number {
    let a = amount;
    if (a > 0) {
      const poverty = this.curse('poverty');
      if (poverty) a *= Math.pow(0.5, Math.min(2, poverty));
      if (this.blessing('fortune')) a *= 1.25;
      if ((this.c.flags.pactGoldUntil as number) >= this.age) a *= 2;
    }
    a = Math.round(a);
    this.c.money += a;
    return a;
  }
  canAfford(amount: number): boolean {
    return this.c.money >= amount;
  }
  /** Spend if affordable; returns false and does nothing otherwise. */
  spend(amount: number): boolean {
    if (amount <= 0) return true;
    if (this.c.money < amount) return false;
    this.c.money -= Math.round(amount);
    return true;
  }
  fmt(n: number): string {
    return fmtMoney(n);
  }

  // ---------------------------------------------------------------- log & memory
  log(text: string, tone: Tone = 'neutral'): void {
    this.c.log.push({ age: this.c.age, year: this.year, text, tone });
  }
  remember(tag: string, text: string, significance: number, npcId?: string): void {
    const m: Memory = { age: this.c.age, year: this.year, tag, text, significance, npcId };
    this.c.memories.push(m);
    this.c.memories.sort((a, b) => b.significance - a.significance);
    if (this.c.memories.length > 50) this.c.memories.length = 50;
  }
  memory(tag: string, minYearsAgo = 0): Memory | undefined {
    return this.c.memories.find((m) => m.tag === tag && this.c.age - m.age >= minYearsAgo);
  }
  hasMemory(tag: string, minYearsAgo = 0): boolean {
    return !!this.memory(tag, minYearsAgo);
  }

  // ---------------------------------------------------------------- flags
  flag(k: string): number | string | boolean | undefined {
    return this.c.flags[k];
  }
  setFlag(k: string, v: number | string | boolean): void {
    this.c.flags[k] = v;
  }
  bump(k: string, by = 1): number {
    const v = ((this.c.flags[k] as number) || 0) + by;
    this.c.flags[k] = v;
    return v;
  }

  // ---------------------------------------------------------------- skills
  skill(id: string): number {
    return this.c.skills[id]?.level ?? 0;
  }
  skillUnlocked(id: string): boolean {
    const def = SKILL_BY_ID[id];
    if (!def) return false;
    if (def.fromYear && this.year < def.fromYear) return false;
    if (def.prereq && this.skill(def.prereq) < UNLOCK_LEVEL && this.skill(id) <= 0) return false;
    return true;
  }
  /** Train a skill. Locked skills get a trickle toward their prerequisite instead. */
  train(id: string, amount: number): number {
    const def = SKILL_BY_ID[id];
    if (!def) return 0;
    if (!this.skillUnlocked(id)) {
      if (def.prereq && (!def.fromYear || this.year >= def.fromYear)) return this.train(def.prereq, amount * 0.6);
      return 0;
    }
    const cur = this.c.skills[id] ?? { level: 0, peak: 0, lastUsedAge: this.age };
    const learn = 0.6 + this.stat('smarts') / 200 + this.stat('discipline') / 300 + (this.c.traits.includes('scholarly') && (def.cat === 'academic' || def.cat === 'tech') ? 0.25 : 0) + (this.c.traits.includes('cunning') && (def.cat === 'criminal' || def.cat === 'social') ? 0.25 : 0) + (this.c.traits.includes('artistic') && def.cat === 'creative' ? 0.25 : 0) + (this.c.traits.includes('shrewd') && def.cat === 'business' ? 0.25 : 0);
    // Diminishing returns near mastery.
    const gain = amount * learn * (1 - cur.level / 130);
    cur.level = Math.min(100, Math.round((cur.level + gain) * 10) / 10);
    cur.peak = Math.max(cur.peak, cur.level);
    cur.lastUsedAge = this.age;
    this.c.skills[id] = cur;
    return gain;
  }

  // ---------------------------------------------------------------- curses & blessings
  curse(id: string): number {
    return this.c.spiritual.curses.find((x) => x.id === id)?.level ?? 0;
  }
  blessing(id: string): number {
    return this.c.spiritual.blessings.find((x) => x.id === id)?.level ?? 0;
  }

  // ---------------------------------------------------------------- NPCs & relationships
  npc(id: string | undefined): NPC | undefined {
    return id ? this.s.npcs[id] : undefined;
  }
  npcAge(n: NPC): number {
    return (n.deathYear ?? this.year) - n.birthYear;
  }
  name(id: string | NPC | undefined): string {
    const n = typeof id === 'string' ? this.s.npcs[id] : id;
    return n ? `${n.firstName} ${n.lastName}` : 'someone';
  }
  first(id: string | NPC | undefined): string {
    const n = typeof id === 'string' ? this.s.npcs[id] : id;
    return n ? n.firstName : 'someone';
  }
  rel(id: string | undefined): Relationship | undefined {
    return id ? this.c.relationships.find((r) => r.npcId === id) : undefined;
  }
  rels(...types: RelType[]): Relationship[] {
    return this.c.relationships.filter((r) => types.includes(r.type) && this.s.npcs[r.npcId]?.alive);
  }
  addRel(npcId: string, type: RelType, init: Partial<Relationship> = {}): Relationship {
    const existing = this.rel(npcId);
    if (existing) {
      existing.type = type;
      Object.assign(existing, init);
      return existing;
    }
    const r: Relationship = { npcId, type, affinity: 50, trust: 50, attraction: 0, compatibility: 50, history: 0, since: this.c.age, meta: {}, ...init };
    this.c.relationships.push(r);
    return r;
  }
  relMod(npcId: string | undefined, affinity: number, trust = 0): void {
    const r = this.rel(npcId);
    if (!r) return;
    r.affinity = Math.max(0, Math.min(100, r.affinity + affinity));
    r.trust = Math.max(0, Math.min(100, r.trust + trust));
    r.history++;
  }
  partner(): Relationship | undefined {
    return this.rels('spouse')[0] ?? this.rels('partner')[0];
  }
  spouse(): Relationship | undefined {
    return this.rels('spouse')[0];
  }
  /** Current romantic partner or spouse (not an affair). */
  lover(): Relationship | undefined {
    return this.spouse() ?? this.partner();
  }
  /** Everyone you are romantically involved with, affairs included. */
  lovers(): Relationship[] {
    return this.rels('spouse', 'partner', 'affair');
  }
  /** Living pets, optionally of one species. */
  pets(species?: string): Pet[] {
    return this.c.pets.filter((p) => p.alive && (!species || p.species === species));
  }
  pet(id: string | undefined): Pet | undefined {
    return id ? this.c.pets.find((p) => p.id === id) : undefined;
  }
  hasItem(typeId: string): boolean {
    return this.c.items.some((i) => i.typeId === typeId);
  }
  item(id: string | undefined): Item | undefined {
    return id ? this.c.items.find((i) => i.id === id) : undefined;
  }
  children(): NPC[] {
    return this.rels('child').map((r) => this.s.npcs[r.npcId]);
  }
  aliveParents(): NPC[] {
    return this.rels('parent').map((r) => this.s.npcs[r.npcId]);
  }

  // ---------------------------------------------------------------- chains
  chain(chainId: string, delay: number, params: Record<string, string | number> = {}): void {
    if (this.c.chains.some((ch) => ch.chainId === chainId)) return;
    this.c.chains.push({ chainId, step: 0, dueAge: this.c.age + delay, params });
  }
  endChain(chainId: string): void {
    this.c.chains = this.c.chains.filter((ch) => ch.chainId !== chainId);
  }
  inChain(chainId: string): boolean {
    return this.c.chains.some((ch) => ch.chainId === chainId);
  }

  // ---------------------------------------------------------------- events
  /** Queue an event for the player. Choice visibility is computed when it is presented. */
  queue(eventId: string, params: Params = {}, front = false): void {
    const pe = { uid: this.uid('q'), eventId, params, age: this.c.age, visible: [], distortions: [], prepared: false };
    if (front) this.s.queue.unshift(pe);
    else this.s.queue.push(pe);
  }
  queued(eventId: string): boolean {
    return this.s.queue.some((q) => q.eventId === eventId);
  }

  // ---------------------------------------------------------------- media
  story(kind: StoryKind, headline: string, sentiment: number, planted = false): void {
    const outlet = this.pick(this.media.outlets);
    this.c.media.stories.unshift({ year: this.year, age: this.age, kind, outlet, headline, sentiment, planted });
    if (this.c.media.stories.length > 60) this.c.media.stories.length = 60;
  }
  secret(id: string, text: string, severity: number): void {
    if (this.c.media.secrets.some((x) => x.id === id && !x.exposed)) return;
    this.c.media.secrets.push({ id, text, severity, age: this.age, exposed: false });
  }

  // ---------------------------------------------------------------- misc
  get famous(): boolean {
    return this.stat('fame') >= 30 || this.stat('infamy') >= 40;
  }
  get inPrison(): boolean {
    return !!this.c.legal.prison;
  }
  get employed(): boolean {
    return !!this.c.career;
  }
  netWorth(): number {
    let total = this.c.money - this.c.debt + this.c.crime.dirtyMoney + this.c.crime.offshore;
    for (const a of this.c.assets) if (!a.seized) total += a.value - a.mortgage;
    for (const it of this.c.items) total += it.value;
    return Math.round(total);
  }
  hasSkillCombo(need: Record<string, number>): boolean {
    return Object.entries(need).every(([k, v]) => this.skill(k) >= v);
  }
}
