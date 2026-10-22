import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { CAREERS } from '../src/engine/data/careers';
import { STAT_CATEGORIES, STAT_DEFS } from '../src/engine/data/stats';
import { SKILLS, SKILL_BY_ID, SKILL_COMBOS } from '../src/engine/data/skills';
import { PROGRAMS } from '../src/engine/data/programs';
import { HOBBIES } from '../src/engine/data/occult';
import { CRIMES, OPS, SUPPLY_STAGES } from '../src/engine/data/underworld';
import { ASSETS } from '../src/engine/data/assets';
import { COUNTRIES, RELIGION_BY_ID } from '../src/engine/data/countries';
import { ERAS } from '../src/engine/data/eras';
import { CHAINS, EVENTS } from '../src/engine/events/engine';
import { ACTIONS } from '../src/engine/actions';

test('the stat model has 47 stats across 8 categories', () => {
  assert.equal(STAT_DEFS.length, 47);
  assert.equal(STAT_CATEGORIES.length, 8);
  for (const cat of STAT_CATEGORIES) assert.ok(STAT_DEFS.some((s) => s.cat === cat.id), `category ${cat.id} has stats`);
  assert.equal(new Set(STAT_DEFS.map((s) => s.id)).size, 47);
});

test('the career bible has 127 careers with 10-rung ladders', () => {
  assert.equal(CAREERS.length, 127);
  assert.equal(new Set(CAREERS.map((c) => c.id)).size, 127);
  for (const c of CAREERS) {
    assert.equal(c.ladder.length, 10, `${c.id} ladder`);
    assert.ok(c.years[0] < c.years[1], `${c.id} years`);
    assert.ok(c.salary > 0 && c.growth >= 1, `${c.id} pay`);
    if (c.branch) assert.equal(c.branch.ladder.length, 11 - c.branch.at, `${c.id} branch ladder`);
  }
  assert.ok(CAREERS.filter((c) => c.cat === 'secret').length >= 10);
});

test('there are 200+ skill nodes and every reference resolves', () => {
  assert.ok(SKILLS.length >= 200, `${SKILLS.length} skills`);
  assert.equal(new Set(SKILLS.map((s) => s.id)).size, SKILLS.length);
  for (const s of SKILLS) if (s.prereq) assert.ok(SKILL_BY_ID[s.prereq], `${s.id} prereq ${s.prereq}`);
  const referenced = new Set<string>();
  for (const c of CAREERS) {
    c.trains.forEach((t) => referenced.add(t));
    Object.keys(c.skills ?? {}).forEach((t) => referenced.add(t));
    c.branch?.trains.forEach((t) => referenced.add(t));
  }
  PROGRAMS.forEach((p) => p.trains.forEach((t) => referenced.add(t)));
  HOBBIES.forEach((h) => h.skills.forEach((t) => referenced.add(t)));
  CRIMES.forEach((c) => c.skill && referenced.add(c.skill));
  OPS.forEach((o) => referenced.add(o.skill));
  SUPPLY_STAGES.forEach((s) => referenced.add(s.skill));
  SKILL_COMBOS.forEach((c) => Object.keys(c.need).forEach((t) => referenced.add(t)));
  for (const id of referenced) assert.ok(SKILL_BY_ID[id], `unknown skill referenced: ${id}`);
});

test('secret combos point at real secret careers', () => {
  for (const combo of SKILL_COMBOS) if (combo.career) assert.ok(CAREERS.some((c) => c.id === combo.career), combo.id);
});

test('eras cover the timeline without gaps', () => {
  for (let i = 1; i < ERAS.length; i++) assert.equal(ERAS[i].from, ERAS[i - 1].to + 1, ERAS[i].id);
});

test('countries reference real religions', () => {
  for (const c of COUNTRIES) for (const [, weights] of c.religions) for (const [r] of weights) assert.ok(RELIGION_BY_ID[r], `${c.id}: ${r}`);
});

test('the asset table has the 14 bible asset classes plus extras', () => {
  assert.ok(ASSETS.length >= 14);
});

test('every chain step and every queued event id exists', () => {
  for (const ch of Object.values(CHAINS)) for (const st of ch.steps) assert.ok(EVENTS[st.eventId], `${ch.id} -> ${st.eventId}`);
  // Scan engine source for x.queue('...') / queue('...') / chain('...') calls.
  const files: string[] = [];
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.ts')) files.push(p);
    }
  };
  walk(join(import.meta.dirname, '..', 'src', 'engine'));
  const queued = new Set<string>();
  const chained = new Set<string>();
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/\.queue\('([A-Za-z0-9_]+)'/g)) queued.add(m[1]);
    for (const m of src.matchAll(/\.chain\('([A-Za-z0-9_]+)'/g)) chained.add(m[1]);
  }
  assert.ok(queued.size > 20);
  for (const id of queued) assert.ok(EVENTS[id], `queued event ${id} is not defined`);
  for (const id of chained) assert.ok(CHAINS[id], `chain ${id} is not defined`);
});

test('triggered events with choices always offer at least one choice', () => {
  for (const e of Object.values(EVENTS)) {
    if (e.choices) assert.ok(e.choices.length >= 1, e.id);
    assert.ok(e.choices?.length || e.auto, `${e.id} has neither choices nor auto`);
  }
});

test('event pool size', () => {
  const n = Object.keys(EVENTS).length;
  assert.ok(n >= 650, `${n} events`);
  const templated = Object.keys(EVENTS).filter((id) => /^cr_.+_(break|crisis|apex)$/.test(id)).length;
  assert.equal(templated, 127 * 3);
});

test('action ids are unique', () => {
  assert.equal(new Set(ACTIONS.map((a) => a.id)).size, ACTIONS.length);
});
