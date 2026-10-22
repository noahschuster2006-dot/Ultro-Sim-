import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ACTIONS, Ctx, EVENTS, newGame } from '../src/engine/index';
import { sceneForAction, sceneForEvent, sceneForOutcome, sceneForText } from '../src/ui/scene/classify';
import { ALL_SCENES } from '../src/ui/scene/ids';
import { WORLD_SCENE_DEFS } from '../src/ui/scene/scenesWorld';
import { LIFE_SCENE_DEFS } from '../src/ui/scene/scenesLife';
import { ROMANCE_SCENE_DEFS } from '../src/ui/scene/scenesRomance';
import { LEISURE_SCENE_DEFS } from '../src/ui/scene/scenesLeisure';
import { WORK_SCENE_DEFS } from '../src/ui/scene/scenesWork';
import { ERA_SCENE_DEFS } from '../src/ui/scene/scenesEra';
import { SCENE_FALLBACK } from '../src/ui/scene/fallback';

const ALL = new Set<string>(ALL_SCENES);

test('new-life presets are honoured', () => {
  for (const sexuality of ['straight', 'gay', 'bisexual', 'asexual'] as const) {
    const s = newGame({ seed: 77, year: 1990, countryId: 'us', sexuality });
    assert.equal(s.char.sexuality, sexuality);
  }
  const s = newGame({ seed: 5, year: 1990, countryId: 'us', familyHealth: 'loving', religionId: 'buddhism', traits: ['athletic', 'scholarly', 'notATrait'], siblings: 'none' });
  const x = new Ctx(s);
  assert.equal(s.char.familyHealth, 'loving');
  assert.equal(s.char.religionId, 'buddhism');
  assert.ok(s.char.traits.includes('athletic') && s.char.traits.includes('scholarly'));
  assert.ok(!s.char.traits.includes('notATrait'), 'unknown traits are ignored');
  assert.equal(x.rels('sibling').length, 0);
  const many = newGame({ seed: 5, year: 1990, countryId: 'us', siblings: 'many' });
  assert.ok(new Ctx(many).rels('sibling').length >= 4);
});

test('the alien invasion plays the alien scene', () => {
  assert.ok(EVENTS.w_alienInvasion && EVENTS.w_ufoSighting && EVENTS.w_abduction);
  assert.equal(sceneForEvent('w_alienInvasion', 'world', 'Invasion', ''), 'aliens');
  assert.equal(sceneForOutcome('w_alienInvasion', 'Fight back', ''), 'war');
});

test('everyday actions animate: time with a friend shows friends', () => {
  assert.equal(sceneForAction('rel_time', 'npc1', 'You had a good time.'), 'friends');
  assert.equal(sceneForAction('workout', undefined, ''), 'sports');
  assert.equal(sceneForAction('crime', 'arson', ''), 'fire');
  assert.equal(sceneForAction('buy', 'house', ''), 'house');
});

test('keyword rules respect word boundaries', () => {
  assert.equal(sceneForText('Injury on the field'), 'hospital');
  assert.equal(sceneForText('The industrial revolution'), 'riot');
  assert.notEqual(sceneForText('A girlfriend'), 'friends');
  assert.equal(sceneForText('Wedding bells'), 'wedding');
});

test('every scene the classifier can return exists, and every action id it names is real', () => {
  const src = readFileSync(join(import.meta.dirname, '..', 'src', 'ui', 'scene', 'classify.ts'), 'utf8');
  for (const m of src.matchAll(/'([a-zA-Z]+)'\]/g)) assert.ok(ALL.has(m[1]), `rule scene ${m[1]}`);
  for (const m of src.matchAll(/return '([a-zA-Z]+)'/g)) assert.ok(ALL.has(m[1]), `returned scene ${m[1]}`);
  const actionIds = new Set(ACTIONS.map((a) => a.id));
  for (const m of src.matchAll(/case '([a-zA-Z_]+)':/g)) assert.ok(actionIds.has(m[1]), `action ${m[1]}`);
});

test('every event plays a background scene, and every scene hint is a real scene', () => {
  for (const e of Object.values(EVENTS)) {
    if (e.scene !== undefined) assert.ok(ALL.has(e.scene), `${e.id}: unknown scene "${e.scene}"`);
    for (const c of e.choices ?? []) if (c.scene !== undefined) assert.ok(ALL.has(c.scene), `${e.id} choice: unknown scene "${c.scene}"`);
    const t = typeof e.title === 'string' ? e.title : e.id;
    const sc = sceneForEvent(e.id, e.cat, t, typeof e.text === 'string' ? e.text : '', e.scene);
    assert.ok(ALL.has(sc), `${e.id} -> ${sc}`);
  }
});

test('every player action plays a background scene', () => {
  for (const a of ACTIONS) {
    if (typeof a.scene === 'string') assert.ok(ALL.has(a.scene), `${a.id}: unknown scene "${a.scene}"`);
    const hint = typeof a.scene === 'function' ? a.scene(undefined, '') : a.scene;
    if (hint !== undefined) assert.ok(ALL.has(hint), `${a.id}: unknown scene "${hint}"`);
    assert.ok(ALL.has(sceneForAction(a.id, undefined, '', hint, a.cat)), a.id);
  }
});

test('every scene id has a drawing (or, while being drawn, a drawn fallback)', () => {
  const defs: Record<string, unknown> = { ...WORLD_SCENE_DEFS, ...LIFE_SCENE_DEFS, ...ROMANCE_SCENE_DEFS, ...LEISURE_SCENE_DEFS, ...WORK_SCENE_DEFS, ...ERA_SCENE_DEFS };
  for (const id of ALL_SCENES) {
    const fb = SCENE_FALLBACK[id];
    assert.ok(defs[id] || (fb && defs[fb]), `${id} has neither a drawing nor a drawn fallback`);
  }
  for (const id of Object.keys(defs)) assert.ok(ALL.has(id), `drawing for unknown scene id ${id}`);
});

test('intimate and affair content is adults-only', () => {
  const ADULT_SCENES = new Set(['nightTogether', 'affair', 'datingApp', 'honeymoon', 'pregnancy']);
  for (const e of Object.values(EVENTS)) {
    const scenes = [e.scene, ...(e.choices ?? []).map((c) => c.scene)].filter(Boolean) as string[];
    if (scenes.some((sc) => ADULT_SCENES.has(sc)) || e.cat === 'romance') {
      assert.ok((e.minAge ?? 0) >= 18 || (e.triggered && e.cat !== 'romance'), `${e.id} must have minAge >= 18`);
    }
  }
  for (const a of ACTIONS) {
    if (a.cat === 'romance' || (typeof a.scene === 'string' && ADULT_SCENES.has(a.scene))) {
      const s = newGame({ seed: 1, year: 2000, countryId: 'us' });
      s.char.age = 15;
      const x = new Ctx(s);
      const av = a.avail ? a.avail(x) : true;
      assert.notEqual(av, true, `${a.id} must not be available to a 15-year-old`);
    }
  }
});
