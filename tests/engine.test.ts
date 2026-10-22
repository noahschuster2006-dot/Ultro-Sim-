import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ageUp, choose, continueAs, Ctx, currentEvent, deserialize, ENGINE_ERRORS, heirCandidates, newGame, performAction, serialize } from '../src/engine/index';
import type { GameState } from '../src/engine/types';
import { bodyTick, lifespan, wealthPercentile } from '../src/engine/systems/body';
import { openCase, legalTick, tryCase } from '../src/engine/systems/legal';
import { distortChoices } from '../src/engine/systems/mind';
import { die } from '../src/engine/systems/dynasty';
import { makeNpc } from '../src/engine/systems/npcs';
import { addCurse } from '../src/engine/systems/spirit';
import { prepareQueue } from '../src/engine/events/engine';
import { autoplay, checkInvariants } from '../scripts/autoplay';

function playYears(s: GameState, years: number, pick = 0): void {
  for (let i = 0; i < years && s.phase === 'alive'; i++) {
    let ev = currentEvent(s);
    while (ev) {
      choose(s, ev.uid, ev.choices[Math.min(pick, ev.choices.length - 1)].index);
      ev = currentEvent(s);
    }
    if (s.phase !== 'alive') break;
    ageUp(s);
  }
}

test('a seed plus the same choices reproduces the same life exactly', () => {
  const a = newGame({ seed: 12345, year: 1950, countryId: 'us' });
  const b = newGame({ seed: 12345, year: 1950, countryId: 'us' });
  playYears(a, 40);
  playYears(b, 40);
  assert.equal(serialize(a), serialize(b));
  const c = newGame({ seed: 54321, year: 1950, countryId: 'us' });
  playYears(c, 40);
  assert.notEqual(serialize(a), serialize(c));
});

test('save files round-trip', () => {
  const s = newGame({ seed: 9, year: 1800, countryId: 'gb' });
  playYears(s, 25);
  const back = deserialize(serialize(s));
  assert.ok(back);
  assert.equal(serialize(back!), serialize(s));
  assert.equal(deserialize('{"version": -1}'), null);
  assert.equal(deserialize('not json'), null);
});

test('newborns get a family, a world and a dynasty', () => {
  const s = newGame({ seed: 3, year: 1347, countryId: 'fr', lastName: 'Valois' });
  const x = new Ctx(s);
  assert.equal(s.char.age, 0);
  assert.equal(s.dynasty.name, 'Valois');
  assert.equal(s.char.lastName, 'Valois');
  assert.equal(x.rels('parent').length, 2);
  assert.ok(s.world.contexts.fr);
  assert.ok(s.world.activeHistorical.includes('blackDeath'));
  assert.ok(!s.world.contexts.us, 'the United States does not exist in 1347');
  assert.deepEqual(checkInvariants(s), []);
});

test('the life expectancy formula follows the design bible', () => {
  const s = newGame({ seed: 1, year: 2000, countryId: 'us' });
  const x = new Ctx(s);
  const c = s.char;
  c.lifespan = { geneticsBonus: 2, offset: 0 };
  c.traits = [];
  c.totals = { happiness: 70 * 10, health: 80 * 10, years: 10 };
  c.money = 0;
  c.assets = [];
  c.debt = 0;
  let L = lifespan(x);
  // 72 + 2 + (US 0 + digital era 0) + (80-50)*0.3 + (70-50)*0.15 + wealth 0
  assert.equal(L.base, 74);
  assert.equal(L.health, 9);
  assert.equal(L.happiness, 3);
  assert.equal(L.final, 86);
  c.addictions.push({ kind: 'alcohol', severity: 3, active: true, yearsClean: 0, inRecovery: false, everActive: true });
  c.bio.chronic.push({ id: 'diabetes', severity: 1, diagnosedAge: 40, managed: true });
  c.bio.injuries.push({ id: 'limp', name: 'Limp', age: 30, combat: true }, { id: 'oneEye', name: 'Eye', age: 31, combat: true });
  L = lifespan(x);
  assert.equal(L.addiction, -6);
  assert.equal(L.chronic, -3);
  assert.equal(L.combat, -3);
  assert.equal(L.final, 86 - 12);
  c.lifespan.offset = 100;
  assert.equal(lifespan(x).final, 115, 'clamped at 115');
  c.lifespan.offset = -200;
  assert.equal(lifespan(x).final, 18, 'clamped at 18');
  c.money = 10_000_000;
  assert.ok(wealthPercentile(x) > 70);
});

test('evidence above 60 leads to arrest; trials can convict and imprison', () => {
  const s = newGame({ seed: 42, year: 1990, countryId: 'us' });
  const x = new Ctx(s);
  s.char.age = 30;
  const k = openCase(x, 'burglary', { witnesses: 0 });
  k.evidence = 95;
  s.char.stats.heat = 80;
  let arrested = false;
  for (let i = 0; i < 6 && !arrested; i++) {
    legalTick(x);
    arrested = s.queue.some((q) => q.eventId === 'legal_arrest');
  }
  assert.ok(arrested, 'arrest event queued');
  const v = tryCase(x, k.id, 0, true, false, false);
  assert.ok(v.convicted, 'plea deals always convict');
  assert.equal(s.char.legal.record.length, 1);
  assert.ok(v.years === 0 ? s.char.legal.probation > 0 : !!s.char.legal.prison);
});

test('juveniles are not executed and get a juvenile record', () => {
  const s = newGame({ seed: 7, year: 1990, countryId: 'us' });
  const x = new Ctx(s);
  s.char.age = 15;
  const k = openCase(x, 'murder', { witnesses: 0 });
  const v = tryCase(x, k.id, 0, true, false, false);
  assert.equal(v.death, false);
  assert.ok(s.char.legal.juvenileRecord);
  assert.ok((s.char.legal.prison?.sentence ?? 0) <= 4);
});

test('anxiety hides choices but never all of them', () => {
  const s = newGame({ seed: 11, year: 2000, countryId: 'us' });
  const x = new Ctx(s);
  const choices = [{ tags: ['cautious'] }, { tags: ['ambitious'] }, { tags: ['impulsive'] }, {}];
  const calm = distortChoices(x, 'q1', choices, [0, 1, 2, 3]);
  assert.equal(calm.visible.length, 4);
  s.char.stats.anxiety = 95;
  s.char.stats.depression = 90;
  const anxious = distortChoices(x, 'q1', choices, [0, 1, 2, 3]);
  assert.ok(anxious.visible.length < 4);
  assert.ok(anxious.visible.length >= 1);
  assert.ok(anxious.visible.includes(0), 'cautious choices survive anxiety');
  assert.ok(anxious.notes.length > 0);
  assert.deepEqual(distortChoices(x, 'q1', choices, [0, 1, 2, 3]), anxious, 'deterministic per event');
});

test('death passes 70% of the estate after debts to heirs and continues the dynasty', () => {
  const s = newGame({ seed: 99, year: 1950, countryId: 'us' });
  const x = new Ctx(s);
  s.char.age = 70;
  s.world.year += 70;
  s.char.money = 1_000_000;
  s.char.debt = 100_000;
  const kid = makeNpc(x, { age: 40, lastName: s.char.lastName, dynasty: true });
  x.addRel(kid.id, 'child', { affinity: 80 });
  addCurse(x, 'poverty', 2, 'test');
  s.char.will = { shares: { [kid.id]: 100 }, charity: 0, trustFund: false };
  die(x, 'old age', 'peaceful');
  assert.equal(s.phase, 'dead');
  assert.equal(s.death!.inheritancePool, 630_000);
  assert.equal(s.death!.heirs[0].share, 630_000);
  assert.equal(s.dynasty.members.length, 1);
  assert.ok(s.dynasty.curses.some((c) => c.id === 'poverty' && c.level === 1), 'curses weaken by one level');
  assert.deepEqual(heirCandidates(s).map((h) => h.id), [kid.id]);
  continueAs(s, kid.id);
  assert.equal(s.phase, 'alive');
  assert.equal(s.char.id, kid.id);
  assert.equal(s.char.generation, 2);
  assert.ok(s.char.money >= 630_000);
  assert.ok(s.char.spiritual.curses.some((c) => c.id === 'poverty'));
  assert.ok(s.char.relationships.some((r) => r.type === 'parent' && r.npcId === s.dynasty.members[0].id), 'the deceased is remembered as a parent');
  assert.deepEqual(checkInvariants(s), []);
});

test('actions spend action points and refill on age-up', () => {
  const s = newGame({ seed: 5, year: 2000, countryId: 'us' });
  playYears(s, 25);
  if (s.phase !== 'alive') return;
  prepareQueue(s);
  const before = s.char.ap;
  const r = performAction(s, 'meditate');
  if (r.ok) assert.equal(s.char.ap, before - 1);
  while (s.char.ap > 0 && performAction(s, 'meditate').ok);
  assert.equal(performAction(s, 'meditate').ok, false);
  playYears(s, 1);
  if (s.phase === 'alive') assert.equal(s.char.ap, s.char.apMax);
});

test('the dementia path is opt-in', () => {
  for (const opt of [false, true]) {
    const s = newGame({ seed: 314, year: 1950, countryId: 'jp', settings: { dementiaPath: opt } });
    const x = new Ctx(s);
    s.char.age = 80;
    s.char.bio.predisposition.dementia = 1;
    for (let i = 0; i < 40; i++) bodyTick(x);
    const had = s.char.bio.chronic.some((c) => c.id === 'dementia');
    assert.equal(had, opt, `dementiaPath=${opt}`);
  }
});

test('autoplay across eras, generations and crime runs without engine errors', () => {
  ENGINE_ERRORS.length = 0;
  const starts: [number, string][] = [[-200, 'it'], [1100, 'gb'], [1600, 'es'], [1880, 'us'], [1930, 'de'], [1975, 'co'], [2005, 'in'], [2030, 'jp']];
  let lives = 0;
  for (let i = 0; i < starts.length; i++) {
    const r = autoplay(500 + i * 31, starts[i][0], starts[i][1], 2, i % 2 === 0);
    assert.deepEqual(r.errors, [], `start ${starts[i].join(' ')}`);
    lives += r.lives.length;
    assert.ok(r.years > 10);
  }
  assert.ok(lives >= starts.length);
  assert.deepEqual(ENGINE_ERRORS, []);
});
