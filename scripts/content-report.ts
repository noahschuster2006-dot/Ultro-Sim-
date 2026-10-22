import { CAREERS, CAREER_CAT_NAMES } from '../src/engine/data/careers';
import { STAT_DEFS, STAT_CATEGORIES } from '../src/engine/data/stats';
import { SKILLS, SKILL_CATEGORIES, SKILL_COMBOS } from '../src/engine/data/skills';
import { COUNTRIES, RELIGIONS } from '../src/engine/data/countries';
import { ERAS } from '../src/engine/data/eras';
import { HISTORY } from '../src/engine/data/history';
import { ASSETS } from '../src/engine/data/assets';
import { CRIMES, DRUGS, OPS } from '../src/engine/data/underworld';
import { MENTAL_CONDITIONS, ADDICTIONS, CHRONIC } from '../src/engine/data/conditions';
import { OFFICES, LAWS } from '../src/engine/data/politics';
import { SOCIETIES, PACTS, CURSES, TRAITS } from '../src/engine/data/occult';
import { PROGRAMS } from '../src/engine/data/programs';
import { CHAINS, EVENTS } from '../src/engine/events/engine';
import { ACTIONS } from '../src/engine/actions';

/** Prints the real content counts so documentation never overclaims. */
const events = Object.values(EVENTS);
const byCat: Record<string, number> = {};
for (const e of events) byCat[e.cat] = (byCat[e.cat] ?? 0) + 1;
const templated = events.filter((e) => /^cr_.+_(break|crisis|apex)$/.test(e.id)).length;
const choices = events.reduce((t, e) => t + (e.choices?.length ?? 0), 0);
const careerCats: Record<string, number> = {};
for (const c of CAREERS) careerCats[CAREER_CAT_NAMES[c.cat]] = (careerCats[CAREER_CAT_NAMES[c.cat]] ?? 0) + 1;

const rows: [string, string | number][] = [
  ['Stats', `${STAT_DEFS.length} across ${STAT_CATEGORIES.length} categories`],
  ['Careers', `${CAREERS.length} (${CAREERS.length * 10} ladder rungs, ${CAREERS.filter((c) => c.branch).length} with branch tracks, ${CAREERS.filter((c) => c.cat === 'secret').length} secret)`],
  ['Skills', `${SKILLS.length} nodes in ${SKILL_CATEGORIES.length} categories, ${SKILL_COMBOS.length} secret combos`],
  ['Event definitions', `${events.length} (${events.length - templated} hand-authored + ${templated} per-career templates), ${choices} choices`],
  ['Consequence chains', Object.keys(CHAINS).length],
  ['Player actions', ACTIONS.length],
  ['Eras', ERAS.length],
  ['Countries', COUNTRIES.length],
  ['Religions', RELIGIONS.length],
  ['Historical world events', HISTORY.length],
  ['Asset classes', ASSETS.length],
  ['Crimes', CRIMES.length],
  ['Drug types / other operations', `${DRUGS.length} / ${OPS.length}`],
  ['Mental-health conditions', MENTAL_CONDITIONS.length],
  ['Addictions', ADDICTIONS.length],
  ['Chronic conditions', CHRONIC.length],
  ['Education programs', PROGRAMS.length],
  ['Political offices / laws', `${OFFICES.length} / ${LAWS.length}`],
  ['Secret societies / pacts / curses', `${SOCIETIES.length} / ${PACTS.length} / ${CURSES.length}`],
  ['Inheritable traits', TRAITS.length],
];
for (const [k, v] of rows) console.log(`${k.padEnd(34)} ${v}`);
console.log('\nEvents by category:', Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '));
console.log('Careers by category:', Object.entries(careerCats).map(([k, v]) => `${k} ${v}`).join(', '));
