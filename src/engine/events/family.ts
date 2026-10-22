import type { Ctx } from '../ctx';
import type { NPC } from '../types';
import { fmtYear } from '../ctx';
import type { ChainDef, EventDef } from './types';
import { bindRel, npcId, poor, rich, who } from './helpers';
import { price } from '../acts/common';
import { linkNpcs, makeNpc } from '../systems/npcs';
import { adopt, birthChild, canConceive } from '../systems/relationships';

/**
 * Family life from both sides of the kitchen table: growing up with parents,
 * siblings and grandparents; raising children of your own; caring for ageing
 * parents; in-laws, feuds, secrets and reunions. Prefix `fa_`.
 */

// ------------------------------------------------------------------ local helpers
const alive = (n: NPC | undefined): n is NPC => !!n && n.alive;

/** Your living children aged lo..hi. */
function kids(x: Ctx, lo: number, hi: number): NPC[] {
  return x.children().filter((n) => alive(n) && x.npcAge(n) >= lo && x.npcAge(n) <= hi);
}
const hasKid = (lo: number, hi: number) => (x: Ctx) => kids(x, lo, hi).length > 0;
const bindKid = (lo: number, hi: number) => (x: Ctx) => {
  const k = kids(x, lo, hi);
  return k.length ? { npcId: x.pick(k).id } : null;
};
/** Age of the bound NPC. */
function ageOf(x: Ctx): number {
  const n = x.npc(npcId(x));
  return n ? x.npcAge(n) : 0;
}
function npcOf(x: Ctx): NPC | undefined {
  return x.npc(npcId(x));
}
const isAlive = (x: Ctx) => alive(npcOf(x));
/** Possessive pronoun for the bound NPC. */
function his(x: Ctx): string {
  const g = npcOf(x)?.gender;
  return g === 'male' ? 'his' : g === 'female' ? 'her' : 'their';
}
function him(x: Ctx): string {
  const g = npcOf(x)?.gender;
  return g === 'male' ? 'him' : g === 'female' ? 'her' : 'them';
}
/** "Mum"/"Dad" for the bound parent (or "Mother"/"Father" in older eras). */
function ma(x: Ctx, n: NPC | undefined = npcOf(x)): string {
  const old = x.year < 1900;
  if (!n) return 'your parent';
  if (n.gender === 'female') return old ? 'Mother' : 'Mum';
  if (n.gender === 'male') return old ? 'Father' : 'Dad';
  return x.first(n);
}
/** Son/daughter/child for the bound child. */
function sonOr(x: Ctx): string {
  const g = npcOf(x)?.gender;
  return g === 'male' ? 'son' : g === 'female' ? 'daughter' : 'child';
}
const hasParents = (x: Ctx) => x.aliveParents().filter(alive).length > 0;
const twoParents = (x: Ctx) => x.aliveParents().filter(alive).length >= 2;
const sib = bindRel('sibling');
const parentRel = bindRel('parent');
/** A living parent aged 65 or more. */
const bindOldParent = (min = 65) => (x: Ctx) => {
  const ps = x.aliveParents().filter((n) => alive(n) && x.npcAge(n) >= min);
  return ps.length ? { npcId: x.pick(ps).id } : null;
};
const car = (x: Ctx) => (x.year >= 1910 ? 'car' : 'cart');
const P = (x: Ctx, n: number) => price(x, n);

/** Create a family NPC and link them to you. */
function relative(x: Ctx, type: 'sibling' | 'grandchild' | 'parent' | 'inLaw' | 'child', age: number, aff = 50, extra: Record<string, string | number | boolean> = {}, lastName?: string): NPC {
  const n = makeNpc(x, { age: Math.max(0, age), lastName: lastName ?? x.c.lastName, career: age < 18 ? null : undefined, religionId: x.c.religionId });
  x.addRel(n.id, type, { affinity: aff, trust: aff, meta: extra });
  return n;
}

// ------------------------------------------------------------------ growing up
const CHILDHOOD: EventDef[] = [
  {
    id: 'fa_handMeDowns', cat: 'childhood', minAge: 4, maxAge: 13, weight: 1.2, cooldown: 5, when: (x) => !rich(x), bind: sib, scene: 'family',
    title: 'Hand-me-downs', text: (x) => `You inherit ${who(x)}'s old coat. The sleeves are long, the pockets still hold ${x.pick(['a conker', 'a sweet wrapper', 'a note that says "LOSER"', 'a tiny plastic dinosaur'])}.`,
    choices: [
      { label: 'Wear it proudly', tags: ['cautious'], run: (x) => { x.mods({ happiness: 2, resilience: 2 }); x.relMod(npcId(x), 3); return 'You roll the sleeves up twice and swagger anyway.'; } },
      { label: 'Refuse to wear it', tags: ['impulsive'], scene: 'argument', run: (x) => { x.mods({ ego: 2, happiness: -1 }); return 'A standoff at the front door. The coat won. It always wins.'; } },
      { label: 'Customise it', run: (x) => { x.mods({ creativity: 3 }); x.train('tailoring', 2); return 'Three badges and a safety pin later, it is unmistakably yours.'; } },
    ],
  },
  {
    id: 'fa_roadTrip', cat: 'childhood', minAge: 4, maxAge: 14, weight: 1, cooldown: 4, when: hasParents, scene: 'roadTrip',
    title: 'Family road trip', text: (x) => (x.year >= 1910 ? 'Eight hours in the back seat, one bag of crisps, and a map nobody can fold.' : 'Three days on a jolting wagon to visit relatives over the hills.'),
    choices: [
      { label: 'Ask "Are we there yet?"', tags: ['impulsive'], run: (x) => { x.mods({ happiness: 1 }); for (const p of x.aliveParents()) x.relMod(p.id, -1); return `You asked forty-one times. The answer was "no" forty times and "${x.pick(['nearly', 'ask again and see', 'we are now lost'])}" once.`; } },
      { label: 'Play I Spy', tags: ['social'], run: (x) => { x.mods({ happiness: 3 }); for (const p of x.aliveParents()) x.relMod(p.id, 2); return 'Something beginning with "C". Cow. It was always cow.'; } },
      { label: 'Read the map', tags: ['cautious'], run: (x) => { x.mods({ smarts: 2, confidence: 2 }); return 'You spotted the wrong turn before anyone else. Promoted to navigator for life.'; } },
    ],
  },
  {
    id: 'fa_parentsFight', cat: 'childhood', minAge: 4, maxAge: 16, weight: 0.9, cooldown: 4, when: twoParents, scene: 'argument',
    title: 'Raised voices', text: 'Through the bedroom wall you hear your parents arguing about money again.',
    choices: [
      { label: 'Turn up the music', tags: ['cautious'], run: (x) => { x.mods({ anxiety: 2, resilience: 1 }); return 'The song drowned them out. It did not drown out the slammed door.'; } },
      { label: 'Walk in and ask them to stop', tags: ['help'], run: (x) => { x.mods({ confidence: 3, stress: 2 }); for (const p of x.aliveParents()) x.relMod(p.id, 2, 2); return 'They went quiet, then apologised. Later you heard them whispering instead.'; } },
      { label: 'Hide under the covers', run: (x) => { x.mods({ anxiety: 4, loneliness: 2 }); return 'You counted the stars on your ceiling until it stopped.'; } },
    ],
  },
  {
    id: 'fa_parentsSplit', cat: 'childhood', minAge: 5, maxAge: 16, weight: 0.35, once: true, when: (x) => twoParents(x) && !x.hasMemory('fa_parentsSplit'), scene: 'family',
    title: 'The family meeting', text: 'Your parents sit you down at the kitchen table. They are "going to live in two houses now".',
    choices: [
      { label: 'Ask whose fault it is', run: (x) => { x.mods({ anxiety: 4, trauma: 3 }); x.remember('fa_parentsSplit', 'Parents separated', 40); return '"Nobody\'s," they said together. It was the last thing they agreed on for a year.'; } },
      { label: 'Cry and hug them both', tags: ['social'], scene: 'reunion', run: (x) => { x.mods({ happiness: -6, empathy: 3 }); for (const p of x.aliveParents()) x.relMod(p.id, 4, 2); x.remember('fa_parentsSplit', 'Parents separated', 40); return 'For one minute the three of you were a family again, all in one hug.'; } },
      { label: 'Go quiet', tags: ['cautious'], scene: 'lonely', run: (x) => { x.mods({ loneliness: 5, resilience: 2 }); x.remember('fa_parentsSplit', 'Parents separated', 40); return 'You nodded, went upstairs and lined up your toys very, very neatly.'; } },
    ],
  },
  {
    id: 'fa_twoHomes', cat: 'childhood', minAge: 5, maxAge: 17, weight: 1.5, cooldown: 3, when: (x) => x.hasMemory('fa_parentsSplit') && twoParents(x), scene: 'moving',
    title: 'Every other weekend', text: 'Two toothbrushes, two bedrooms, one overnight bag that never fully unpacks.',
    choices: [
      { label: 'Play them off each other', tags: ['impulsive'], run: (x) => { x.mods({ ego: 2, karma: -2 }); x.train('manipulation', 2); return '"But Mum lets me." Two sets of rules, both bent in your favour.'; } },
      { label: 'Keep the peace', tags: ['help'], run: (x) => { x.mods({ stress: 2, empathy: 2 }); x.train('conflictResolution', 2); return 'You became a tiny diplomat, carrying messages and leaving out the barbs.'; } },
      { label: 'Ask to stay put', tags: ['cautious'], run: (x) => { x.mods({ happiness: 2 }); return 'They agreed you could pick weekends. Being asked felt like being grown up.'; } },
    ],
  },
  {
    id: 'fa_stepParent', cat: 'childhood', minAge: 4, maxAge: 16, weight: 0.5, once: true, when: (x) => x.hasMemory('fa_parentsSplit') || x.aliveParents().length === 1, scene: 'familyDinner',
    title: 'A new grown-up', text: 'A parent brings someone new to dinner. They have clearly practised your name.',
    choices: [
      { label: 'Give them a chance', tags: ['social'], run: (x) => { const n = relative(x, 'parent', x.int(30, 50), 45, { step: true }); n.lastName = x.pick([n.lastName, x.c.lastName]); x.mods({ empathy: 2 }); return `${n.firstName} laughed at your joke, a real laugh. Maybe this is fine.`; } },
      { label: 'Be politely frosty', tags: ['cautious'], run: (x) => { const n = relative(x, 'parent', x.int(30, 50), 25, { step: true }); return `${n.firstName} asked about school. You said "fine" in a tone that ended the subject.`; } },
      { label: 'Flick peas at them', tags: ['impulsive', 'violent'], scene: 'argument', run: (x) => { const n = relative(x, 'parent', x.int(30, 50), 15, { step: true }); x.mods({ aggression: 2, discipline: -2 }); return `${n.firstName} wore the pea with dignity. You were grounded without dessert.`; } },
    ],
  },
  {
    id: 'fa_stepParentBond', cat: 'childhood', minAge: 6, maxAge: 17, weight: 1.2, cooldown: 4,
    bind: (x) => { const r = x.rels('parent').filter((p) => p.meta.step); return r.length ? { npcId: x.pick(r).npcId } : null; }, scene: 'family',
    title: 'Step by step', text: (x) => `${who(x)} offers to teach you ${x.pick(['to ride a bike', 'to fish', 'card tricks', 'how to bake bread', 'to whistle'])}.`,
    choices: [
      { label: 'Say yes', tags: ['social'], run: (x) => { x.relMod(npcId(x), 8, 6); x.mods({ happiness: 3 }); return `It took all afternoon. Somewhere in there you stopped calling ${him(x)} "${who(x)}" in that tone.`; } },
      { label: '"You\'re not my real parent"', tags: ['impulsive'], scene: 'argument', run: (x) => { x.relMod(npcId(x), -6, -3); x.mods({ stress: 2 }); return 'It landed hard. They nodded and said, "I know. I\'m still here though."'; } },
      { label: 'Maybe another day', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), 1); return 'They said the offer stands. It kept standing for years.'; } },
    ],
  },
  {
    id: 'fa_moving', cat: 'childhood', minAge: 4, maxAge: 16, weight: 0.6, cooldown: 6, when: hasParents, scene: 'moving',
    title: 'Moving house', text: (x) => `Your family is moving ${x.pick(['across the country', 'to the other side of town', 'for a parent\'s new job', 'somewhere cheaper'])}. Your whole room fits in four boxes.`,
    choices: [
      { label: 'Say a big goodbye', tags: ['social'], scene: 'friends', run: (x) => { x.mods({ happiness: -2, empathy: 2, loneliness: 2 }); return 'Your best friend gave you a rock "to remember them by". You kept it for decades.'; } },
      { label: 'Refuse to pack', tags: ['impulsive'], run: (x) => { x.mods({ stress: 3 }); return 'You were packed anyway, along with your protest sign.'; } },
      { label: 'Claim the best room', tags: ['ambitious'], scene: 'house', run: (x) => { x.mods({ happiness: 3, confidence: 2 }); return 'You sprinted up the stairs first. Window seat. Victory.'; } },
    ],
  },
  {
    id: 'fa_granRecipe', cat: 'childhood', minAge: 5, maxAge: 14, weight: 1, once: true, bind: bindRel('grandparent'), scene: 'cooking',
    title: 'The secret recipe', text: (x) => `${who(x)} lets you into the kitchen for the family ${x.pick(['dumplings', 'stew', 'honey cake', 'flatbread', 'pie', 'soup'])}. "Never write it down."`,
    choices: [
      { label: 'Memorise every step', tags: ['cautious'], run: (x) => { x.train('cooking', 4); x.relMod(npcId(x), 5); x.remember('fa_recipe', `Learned the family recipe from ${who(x)}`, 25, npcId(x)); return 'A pinch, a handful, "until it looks right". You learned anyway.'; } },
      { label: 'Write it down secretly', tags: ['ambitious'], run: (x) => { x.train('cooking', 2); x.mods({ smarts: 1 }); return 'You wrote it on your hand. It washed off in the bath.'; } },
      { label: 'Eat the dough', tags: ['impulsive'], run: (x) => { x.mods({ happiness: 3 }); x.relMod(npcId(x), 2); return 'Swatted with a wooden spoon. Worth it.'; } },
    ],
  },
  {
    id: 'fa_granWarStory', cat: 'childhood', minAge: 6, maxAge: 15, weight: 0.9, once: true, bind: bindRel('grandparent'), scene: 'grandparents',
    title: 'The old medal', text: (x) => `In a drawer at ${who(x)}'s house you find a medal wrapped in a handkerchief.`,
    choices: [
      { label: 'Ask about it', tags: ['social'], run: (x) => { x.mods({ wisdom: 3, empathy: 2 }); x.train('history', 2); x.relMod(npcId(x), 6, 4); return `${who(x)} talked for an hour, then went quiet and made tea. You never forgot the quiet part.`; } },
      { label: 'Put it back', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 1 }); return 'Some drawers are other people\'s. You closed it gently.'; } },
      { label: 'Wear it to school', tags: ['impulsive'], scene: 'classroom', run: (x) => { x.mods({ popularity: 3 }); x.relMod(npcId(x), -3); return 'Huge hit at show-and-tell. Less of a hit when it was noticed missing.'; } },
    ],
  },
  {
    id: 'fa_brokenVase', cat: 'childhood', minAge: 4, maxAge: 12, weight: 1, cooldown: 5, bind: sib, scene: 'argument',
    title: 'Who broke it?', text: (x) => `The good vase is in pieces. You and ${who(x)} are the only suspects.`,
    choices: [
      { label: 'Own up', tags: ['help'], run: (x) => { x.mods({ karma: 3, discipline: 2 }); x.relMod(npcId(x), 5, 5); return 'Grounded, but your sibling looked at you like a hero.'; } },
      { label: `Blame your sibling`, tags: ['impulsive'], run: (x) => { x.mods({ karma: -3 }); x.relMod(npcId(x), -8, -10); x.train('deception', 2); return 'It worked. They never fully trusted you with a secret again.'; } },
      { label: 'Glue it together', tags: ['cautious'], run: (x) => { x.mods({ dexterity: 2, creativity: 1 }); return x.chance(0.4) ? 'Nobody noticed for eleven years.' : 'It held until the first flowers went in. Water everywhere.'; } },
    ],
  },
  {
    id: 'fa_shareRoom', cat: 'childhood', minAge: 5, maxAge: 15, weight: 0.8, once: true, bind: sib, when: (x) => !rich(x), scene: 'family',
    title: 'Sharing a room', text: (x) => `You and ${who(x)} have to share a bedroom. There is exactly one good bed.`,
    choices: [
      { label: 'Draw a line down the middle', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), -2); x.mods({ discipline: 2 }); return 'The tape border held. Border skirmishes continued nightly.'; } },
      { label: 'Build a blanket fort together', tags: ['social'], run: (x) => { x.relMod(npcId(x), 8, 4); x.mods({ happiness: 4 }); return 'You whispered until midnight. Best roommates you would ever have.'; } },
      { label: 'Fight for the bed', tags: ['violent'], scene: 'fight', run: (x) => { x.relMod(npcId(x), -5); x.mods({ fitness: 1, aggression: 2 }); return x.chance(0.5) ? 'Pillow victory. You slept like a conqueror.' : 'You lost. The floor was cold.'; } },
    ],
  },
  {
    id: 'fa_newBabyJealous', cat: 'childhood', minAge: 2, maxAge: 9, weight: 2, once: true,
    bind: (x) => { const r = x.rels('sibling').filter((s) => { const n = x.npc(s.npcId); return n && x.npcAge(n) <= 1; }); return r.length ? { npcId: r[0].npcId } : null; }, scene: 'birth',
    title: 'The new baby', text: (x) => `Everyone coos at ${who(x)}. Nobody has looked at your drawing for three days.`,
    choices: [
      { label: 'Help with the nappies', tags: ['help'], run: (x) => { x.mods({ empathy: 3, discipline: 1 }); x.relMod(npcId(x), 6); return 'You held the baby very, very carefully. Big sibling energy unlocked.'; } },
      { label: 'Act like a baby too', tags: ['impulsive'], run: (x) => { x.mods({ happiness: 1, confidence: -1 }); return 'You demanded a bottle. Everyone laughed. You were secretly delighted.'; } },
      { label: 'Ask to send it back', run: (x) => { x.mods({ happiness: -1 }); return '"The hospital has a no-returns policy," said your father, very seriously.'; } },
    ],
  },
  {
    id: 'fa_bedtimeStory', cat: 'childhood', minAge: 3, maxAge: 7, weight: 1, cooldown: 3, bind: parentRel, scene: 'reading',
    title: 'Bedtime story', text: (x) => `${ma(x)} is tired, but you want the long story again.`,
    choices: [
      { label: 'Beg for one more', tags: ['impulsive'], run: (x) => { x.relMod(npcId(x), 2); x.mods({ smarts: 1 }); return `${ma(x)} fell asleep mid-sentence. You finished it yourself.`; } },
      { label: 'Tell the story yourself', tags: ['social'], run: (x) => { x.mods({ creativity: 3 }); x.train('writing', 1); return 'Your version had more dragons and a talking sock. It was better.'; } },
      { label: 'Say goodnight', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), 3); return 'A kiss on the forehead and the hall light left on. Perfect.'; } },
    ],
  },
  {
    id: 'fa_lostMarket', cat: 'childhood', minAge: 3, maxAge: 8, weight: 0.6, once: true, when: hasParents, scene: 'shopping',
    title: 'Lost in the crowd', text: (x) => `You let go of a hand at the ${x.year < 1900 ? 'market' : 'shopping centre'} and suddenly every grown-up is a stranger.`,
    choices: [
      { label: 'Stay exactly where you are', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 2 }); return 'Your parent came back running, white as a sheet, and squeezed you breathless.'; } },
      { label: 'Ask a shopkeeper', tags: ['social'], run: (x) => { x.mods({ confidence: 3 }); return 'They gave you a sweet and called out over the crowd. Reunited within minutes.'; } },
      { label: 'Go exploring', tags: ['impulsive'], run: (x) => { x.mods({ riskTolerance: 3, anxiety: 2 }); return 'An hour later you were found in the pet section, holding a rabbit, completely unbothered.'; } },
    ],
  },
  {
    id: 'fa_parentWorksLate', cat: 'childhood', minAge: 6, maxAge: 14, weight: 0.8, cooldown: 4, when: (x) => x.aliveParents().length === 1 || poor(x), bind: parentRel, scene: 'lonely',
    title: 'Latchkey kid', text: (x) => `${ma(x)} works late again. There is a note on the table and food to heat up.`,
    choices: [
      { label: 'Make dinner for them too', tags: ['help'], scene: 'cooking', run: (x) => { x.train('cooking', 2); x.relMod(npcId(x), 7, 4); x.mods({ discipline: 2 }); return `Slightly burnt pasta. ${ma(x)} ate every bite and had to look away for a second.`; } },
      { label: 'Watch TV till they\'re home', run: (x) => { x.mods({ loneliness: 3, happiness: 1 }); return 'You fell asleep on the sofa. You woke up tucked into bed.'; } },
      { label: 'Do your homework', tags: ['cautious'], scene: 'study', run: (x) => { x.mods({ smarts: 2, discipline: 2 }); return 'Gold star the next day. You showed nobody, then everybody.'; } },
    ],
  },
  {
    id: 'fa_gameNight', cat: 'childhood', minAge: 6, maxAge: 16, weight: 1, cooldown: 3, when: hasParents, scene: 'gaming',
    title: 'Family game night', text: (x) => `Out comes ${x.year < 1930 ? 'the old draughts board' : x.year < 1985 ? 'the battered Monopoly set' : x.pick(['the board game with missing pieces', 'the console, four controllers, one working'])}. Rivalries are ancient.`,
    choices: [
      { label: 'Play to win', tags: ['ambitious'], run: (x) => { x.mods({ ego: 2, smarts: 1 }); return x.chance(0.5) ? 'You won and gloated. The board was "accidentally" knocked over.' : 'You lost to your dad, who has cheated since 1990-something.'; } },
      { label: 'Let the little one win', tags: ['help'], run: (x) => { x.mods({ empathy: 3, karma: 1 }); return 'Their victory dance was worth every throw.'; } },
      { label: 'Flip the board', tags: ['impulsive', 'violent'], scene: 'argument', run: (x) => { x.mods({ aggression: 2 }); for (const p of x.aliveParents()) x.relMod(p.id, -2); return 'Game night was cancelled for a month. Legends were born.'; } },
    ],
  },
  {
    id: 'fa_allowance', cat: 'childhood', minAge: 7, maxAge: 14, weight: 0.8, once: true, when: (x) => hasParents(x) && !poor(x), scene: 'moneyUp',
    title: 'Pocket money', text: 'Your parents offer pocket money in exchange for chores.',
    choices: [
      { label: 'Negotiate a raise', tags: ['ambitious'], run: (x) => { x.train('negotiation', 3); x.mods({ confidence: 2 }); return 'You presented a chart. They doubled it to make you stop talking.'; } },
      { label: 'Save every coin', tags: ['cautious'], run: (x) => { x.money(P(x, 60)); x.mods({ discipline: 3 }); return 'A jar under the bed, heavier every week. Pure joy.'; } },
      { label: 'Spend it on sweets', tags: ['impulsive'], run: (x) => { x.mods({ happiness: 3, health: -1 }); return 'Gone in an afternoon. Your teeth hated you, briefly.'; } },
    ],
  },
  {
    id: 'fa_runAway', cat: 'childhood', minAge: 6, maxAge: 11, weight: 0.5, once: true, when: hasParents, scene: 'travel',
    title: 'Running away', text: 'After an unjust bedtime ruling you pack a bag: a torch, two biscuits and a teddy.',
    choices: [
      { label: 'Get to the end of the road', tags: ['impulsive'], run: (x) => { x.mods({ riskTolerance: 2, confidence: 1 }); return 'You sat on the kerb for twenty minutes, then came home for dinner.'; } },
      { label: 'Run away to the garden', tags: ['cautious'], scene: 'camping', run: (x) => { x.mods({ happiness: 2 }); return 'Your mum brought you a sandwich and a blanket. Best exile ever.'; } },
      { label: 'Leave a dramatic note', run: (x) => { x.mods({ creativity: 2 }); x.train('writing', 1); return '"Dear Family, you will be sorry." They framed it. It still hangs in the hall.'; } },
    ],
  },
  {
    id: 'fa_cousinsSummer', cat: 'childhood', minAge: 5, maxAge: 15, weight: 0.8, cooldown: 4, scene: 'beach',
    title: 'Cousins for summer', text: (x) => `Your cousins come to stay for ${x.year < 1900 ? 'the harvest' : 'the summer holidays'}. The house becomes a wild animal enclosure.`,
    choices: [
      { label: 'Form a gang', tags: ['social'], run: (x) => { x.mods({ happiness: 4, popularity: 2 }); return 'A secret handshake, a den, and a vow of eternal loyalty that lasted until September.'; } },
      { label: 'Compete at everything', tags: ['ambitious'], scene: 'sports', run: (x) => { x.mods({ fitness: 2, ego: 2 }); return 'Races, arm wrestling, who can eat more. You won the eating.'; } },
      { label: 'Hide with a book', tags: ['cautious'], scene: 'reading', run: (x) => { x.mods({ smarts: 2, loneliness: 1 }); return 'You discovered the airing cupboard is soundproof. Bliss.'; } },
    ],
  },
  {
    id: 'fa_familyWedding', cat: 'childhood', minAge: 4, maxAge: 12, weight: 0.6, cooldown: 5, scene: 'wedding',
    title: 'Flower duty', text: (x) => `Your ${x.pick(['aunt', 'uncle', 'cousin'])} is getting married and you have been given a job: ${x.pick(['flowers', 'carrying the rings'])}.`,
    choices: [
      { label: 'Take it very seriously', tags: ['cautious'], run: (x) => { x.mods({ discipline: 2, popularity: 2 }); return 'Slow, solemn steps. Three guests cried. Possibly at you.'; } },
      { label: 'Dance down the aisle', tags: ['impulsive'], scene: 'dance', run: (x) => { x.mods({ happiness: 4, confidence: 3 }); return 'The video of your aisle routine is still shown at every family gathering.'; } },
      { label: 'Eat the cake early', tags: ['impulsive'], run: (x) => { x.mods({ happiness: 3 }); return 'There is a finger-sized tunnel in the back tier. Nobody proved anything.'; } },
    ],
  },
  {
    id: 'fa_familyPhoto', cat: 'childhood', minAge: 3, maxAge: 12, weight: 0.7, cooldown: 5, when: hasParents, scene: 'family',
    title: 'Family portrait', text: (x) => (x.year < 1840 ? 'A painter has been hired. You must sit perfectly still for hours.' : x.year < 1900 ? 'The photographer insists nobody may move or smile for a whole minute.' : 'Matching outfits. A photographer with a squeaky toy. Everyone is sweating.'),
    choices: [
      { label: 'Smile nicely', tags: ['cautious'], run: (x) => { x.mods({ discipline: 1 }); return 'The picture hung over the fireplace for forty years. You look angelic. You were not.'; } },
      { label: 'Pull a face', tags: ['impulsive'], run: (x) => { x.mods({ happiness: 2, creativity: 1 }); return 'Immortalised mid-grimace. Your grandchildren will love it.'; } },
      { label: 'Poke your sibling', tags: ['violent'], when: (x) => x.rels('sibling').length > 0, run: (x) => { x.mods({ happiness: 1 }); return 'The final portrait shows a family and one blurred, shrieking child.'; } },
    ],
  },
  {
    id: 'fa_curfew', cat: 'teen', minAge: 13, maxAge: 17, weight: 1.2, cooldown: 2, when: hasParents, bind: parentRel, scene: 'argument',
    title: 'Curfew wars', text: (x) => `${ma(x)} says home by ten. Everyone else is staying out until midnight. Allegedly.`,
    choices: [
      { label: 'Negotiate eleven', tags: ['social'], run: (x) => { x.train('negotiation', 2); x.relMod(npcId(x), 1, 2); return 'Ten-thirty, with a phone call. A diplomatic triumph.'; } },
      { label: 'Climb out the window', tags: ['impulsive'], run: (x) => { x.mods({ riskTolerance: 3, happiness: 2 }); if (x.chance(0.5)) { x.relMod(npcId(x), -6, -8); return `${ma(x)} was waiting in the kitchen with the lights off. Grounded for a month.`; } return 'Back by two, nobody the wiser. The drainpipe creaked like a traitor.'; } },
      { label: 'Come home on time', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), 3, 5); x.mods({ discipline: 2 }); return 'Trust banked. It paid out later when you really needed it.'; } },
    ],
  },
  {
    id: 'fa_embarrassingParents', cat: 'teen', minAge: 13, maxAge: 17, weight: 1, cooldown: 3, bind: parentRel, scene: 'beach',
    title: 'Mortifying', text: (x) => `${ma(x)} ${x.pick(['dances at the school gate', 'calls you "my little pumpkin" in front of your friends', 'wears socks with sandals on holiday', 'tries to use teen slang'])}.`,
    choices: [
      { label: 'Pretend not to know them', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), -2); return 'You walked ten paces ahead like a stranger. They waved anyway.'; } },
      { label: 'Join in', tags: ['social'], scene: 'dance', run: (x) => { x.relMod(npcId(x), 6, 3); x.mods({ confidence: 3, popularity: x.chance(0.5) ? 2 : -2 }); return 'Your friends were horrified, then oddly impressed.'; } },
      { label: 'Die of shame', run: (x) => { x.mods({ anxiety: 2 }); return 'You did not actually die. It felt close.'; } },
    ],
  },
  {
    id: 'fa_drivingLesson', cat: 'teen', minAge: 15, maxAge: 17, years: [1920, 2300], once: true, bind: parentRel, scene: 'car',
    title: 'Driving lesson', text: (x) => `${ma(x)} takes you to an empty car park, grips the dashboard and says, "Gently."`,
    choices: [
      { label: 'Go gently', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), 4); x.mods({ confidence: 2 }); return 'Smooth. Mostly. Some stalling. A good afternoon.'; } },
      { label: 'Floor it', tags: ['impulsive'], scene: 'carChase', run: (x) => { x.relMod(npcId(x), -3); x.mods({ riskTolerance: 4 }); return `A trolley bay will never be the same. Neither will ${ma(x)}'s voice.`; } },
      { label: 'Ask for advice', tags: ['social'], run: (x) => { x.relMod(npcId(x), 5, 3); x.mods({ wisdom: 2 }); return 'You learned to drive, and also why your parent never takes the motorway.'; } },
    ],
  },
  {
    id: 'fa_coverForSibling', cat: 'teen', minAge: 13, maxAge: 17, weight: 0.9, cooldown: 3, bind: sib, scene: 'family',
    title: 'Cover story', text: (x) => `${who(x)} is sneaking out tonight and needs you to say they are "at a friend's studying".`,
    choices: [
      { label: 'Cover for them', tags: ['help'], run: (x) => { x.relMod(npcId(x), 7, 6); x.train('deception', 1); return 'You lied beautifully. They owe you forever.'; } },
      { label: 'Charge a fee', tags: ['ambitious'], run: (x) => { x.relMod(npcId(x), -1); x.money(P(x, 20)); x.train('negotiation', 1); return 'Cash up front. Pure business.'; } },
      { label: 'Tell your parents', tags: ['cautious'], scene: 'argument', run: (x) => { x.relMod(npcId(x), -10, -10); x.mods({ karma: 1 }); return 'Your sibling was grounded. You were "a snitch" until Christmas.'; } },
    ],
  },
  {
    id: 'fa_teenHeartToHeart', cat: 'teen', minAge: 14, maxAge: 17, weight: 0.8, cooldown: 4, bind: parentRel, scene: 'calm',
    title: 'Late-night talk', text: (x) => `You find ${ma(x)} awake in the kitchen at 2am, and for once neither of you wants to argue.`,
    choices: [
      { label: 'Tell them what\'s wrong', tags: ['social'], run: (x) => { x.relMod(npcId(x), 8, 8); x.mods({ anxiety: -4, depression: -2 }); return 'They did not fix it. They listened, which was better.'; } },
      { label: 'Ask about their youth', run: (x) => { x.relMod(npcId(x), 5, 3); x.mods({ wisdom: 3 }); return `Turns out ${ma(x)} was also once a disaster. Comforting.`; } },
      { label: 'Grab a snack and go', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), 1); return 'A nod, a shared biscuit, a moment you both pretended not to have.'; } },
    ],
  },
];


// ------------------------------------------------------------------ holidays (parameterised by faith and place)
interface Holiday {
  key: string;
  title: string;
  when: (x: Ctx) => boolean;
  years?: [number, number];
  scene: string;
  child: string;
  adult: string;
  /** [label, outcome, scene?] for: help / indulge / reflect. */
  opts: [string, string, string?][];
}
const rel = (...ids: string[]) => (x: Ctx) => ids.includes(x.c.religionId);
const land = (...ids: string[]) => (x: Ctx) => ids.includes(x.c.countryId);
const HOLIDAYS: Holiday[] = [
  { key: 'christmas', title: 'Christmas', when: rel('christianity'), years: [336, 2300], scene: 'familyDinner',
    child: 'Christmas morning. You were awake at five, staring at the shapes under the tree.', adult: 'You are hosting Christmas. Eleven relatives, one oven, and a bird the size of a small dog.',
    opts: [['Help with dinner', 'The gravy was yours and everyone said so, twice.', 'cooking'], ['Tear into the presents', 'Paper everywhere. A gift you will remember forever and three socks.'], ['Go to midnight service', 'Candles, cold air, an old carol. For a moment the world was very quiet.', 'holy']] },
  { key: 'easter', title: 'Easter', when: rel('christianity'), years: [200, 2300], scene: 'picnic',
    child: 'An egg hunt in the garden. Your cousin is already cheating.', adult: 'You hide eggs in the garden for the little ones and forget where half of them went.',
    opts: [['Help the smallest find theirs', 'A three-year-old with chocolate on every surface hugged your leg.'], ['Eat all the chocolate', 'A sugar high, a sugar crash and no regrets.'], ['Go to church in your best', 'Lilies and bells. Your grandmother squeezed your hand.', 'holy']] },
  { key: 'eidFitr', title: 'Eid al-Fitr', when: rel('islam'), years: [624, 2300], scene: 'familyDinner',
    child: 'Ramadan is over. New clothes, sweet pastries and coins from every uncle.', adult: 'Eid morning: prayers, then a house so full of family the doorbell never stops.',
    opts: [['Help cook the feast', 'Your mother handed you the knife for the lamb. A rite of passage.', 'cooking'], ['Collect Eidi from everyone', 'Your pockets jingled. Your aunt pinched both cheeks for every coin.'], ['Give to those in need', 'You delivered food to a neighbour who would have spent the day alone.', 'volunteer']] },
  { key: 'eidAdha', title: 'Eid al-Adha', when: rel('islam'), years: [624, 2300], scene: 'family',
    child: 'The whole family gathers for Eid al-Adha. The kitchen smells of cardamom by dawn.', adult: 'Eid al-Adha. You portion the meat three ways: family, friends, and those who have none.',
    opts: [['Share with the neighbours', 'Plates came back full of their own cooking. Nobody went hungry on your street.', 'volunteer'], ['Eat until you cannot move', 'Rice, lamb and three desserts. You napped like a lion.'], ['Listen to the story of Ibrahim', 'An old story, told again. It meant something new this year.', 'holy']] },
  { key: 'iftar', title: 'Iftar', when: rel('islam'), years: [624, 2300], scene: 'familyDinner',
    child: 'You are fasting for the first time. The sun sets agonisingly slowly.', adult: 'You host iftar. The dates are out, the soup is hot, the guests are watching the clock.',
    opts: [['Wait for everyone', 'You broke the fast together, one date each, laughing at the silence before.'], ['Sneak a sip early', 'Nobody saw. You felt guilty for the whole meal.'], ['Pray before eating', 'Patience made the first sip of water taste like a miracle.', 'holy']] },
  { key: 'hanukkah', title: 'Hanukkah', when: rel('judaism'), years: [-160, 2300], scene: 'festival',
    child: 'The menorah is in the window and you are allowed to light a candle yourself.', adult: 'Eight nights of candles, latkes and arguments about how to spin a dreidel properly.',
    opts: [['Fry the latkes', 'Oil everywhere, smoke alarm screaming, best latkes ever made.', 'cooking'], ['Gamble at dreidel', 'You cleaned out the whole family of chocolate coins. Ruthless.', 'casino'], ['Tell the story of the oil', 'One night\'s oil lasting eight. You told it well; the children were rapt.', 'holy']] },
  { key: 'passover', title: 'Passover', when: rel('judaism'), years: [-1200, 2300], scene: 'familyDinner',
    child: 'The seder. As the youngest, you have to ask the four questions in front of everyone.', adult: 'You lead the seder this year. Your uncle has already questioned your horseradish.',
    opts: [['Read every word', 'Long, solemn and finished at midnight. Your grandfather nodded once. High praise.'], ['Hunt the afikoman', 'You found it behind the radiator and negotiated a ransom.'], ['Invite a stranger', 'A lonely colleague came. They cried at "next year in Jerusalem".', 'friends']] },
  { key: 'diwali', title: 'Diwali', when: rel('hinduism', 'sikhism'), scene: 'fireworks',
    child: 'Diwali! Clay lamps on every step and a box of sparklers with your name on it.', adult: 'You clean the house top to bottom, light the diyas and wait for the sweets to arrive.',
    opts: [['Make rangoli at the door', 'A coloured-powder lotus. A neighbour photographed it.', 'festival'], ['Light every firework', 'Sparks, smoke and one singed eyebrow.'], ['Pray to Lakshmi', 'The lamps flickered. You felt your house was being watched over.', 'holy']] },
  { key: 'holi', title: 'Holi', when: rel('hinduism'), scene: 'festival',
    child: 'Holi. You have a water pistol full of pink and a list of targets.', adult: 'Holi in the street. Strangers smear colour on your face and wish you joy.',
    opts: [['Colour the grandparents', 'Grandma was turned green and laughed until she wheezed.'], ['Ambush everyone', 'You were purple for three days. Glorious.'], ['Light the Holika bonfire', 'Evil burns, good wins. The fire warmed every face around it.', 'camping']] },
  { key: 'lunarNewYear', title: 'Lunar New Year', when: (x) => ['cn'].includes(x.c.countryId) || rel('folk', 'buddhism')(x), scene: 'festival',
    child: 'Red envelopes, dumplings and a dragon dancing down your street.', adult: 'You travel home for Lunar New Year with half the country. The relatives have questions.',
    opts: [['Fold dumplings with everyone', 'One had a coin inside. You found it and are lucky all year.', 'cooking'], ['Count your red envelopes', 'A fortune in small notes. Your mother "kept it safe" for you.', 'moneyUp'], ['Sweep out the bad luck', 'The house was spotless and the year started fresh.']] },
  { key: 'vesak', title: 'Vesak', when: rel('buddhism'), scene: 'festival',
    child: 'Lanterns for the Buddha\'s birthday. You helped build one shaped like a lotus.', adult: 'Vesak. The temple glows with lanterns and the air smells of incense and jasmine.',
    opts: [['Serve food at the temple', 'You ladled rice for strangers for hours. Your heart felt very light.', 'volunteer'], ['Release a lantern', 'It drifted up until it was a star among stars.'], ['Meditate with the monks', 'Two hours of stillness. Your knees disagreed; your mind did not.', 'calm']] },
  { key: 'oshogatsu', title: 'New Year at the shrine', when: rel('shinto'), scene: 'festival',
    child: 'New Year: mochi, the first sunrise, and your first visit to the shrine in a new kimono.', adult: 'The family\'s first shrine visit of the year. You buy charms for everyone.',
    opts: [['Pound the mochi', 'Bang, flip, bang. The rhythm went perfectly. Mostly.', 'cooking'], ['Draw a fortune', 'Great blessing! You tied it to the tree anyway, just in case.', 'tarot'], ['Ring the shrine bell', 'One clear note into the cold air. A good start.', 'holy']] },
  { key: 'vaisakhi', title: 'Vaisakhi', when: rel('sikhism'), years: [1699, 2300], scene: 'parade',
    child: 'Vaisakhi! The procession winds past the gurdwara and someone hands you a sweet.', adult: 'You march in the Vaisakhi procession with your family, serving langar at the end.',
    opts: [['Serve langar', 'You served dal to hundreds. Everyone eats as equals here.', 'volunteer'], ['Dance the bhangra', 'Your uncle out-danced everyone. You came a close second.', 'dance'], ['Listen to the hymns', 'The kirtan rose and fell like breathing.', 'holy']] },
  { key: 'nowruz', title: 'Nowruz', when: (x) => rel('zoroastrianism')(x) || land('ir')(x), scene: 'festival',
    child: 'Nowruz. You jump over the little fire with your cousins: "my yellow to you, your red to me".', adult: 'You set the haft-sin table: seven things for a new year, and a goldfish nobody asked for.',
    opts: [['Set the table just so', 'Sprouts, apples, garlic and a very confused goldfish. Perfect.'], ['Jump the fire', 'You cleared it with style. Your aunt screamed anyway.', 'camping'], ['Visit the elders first', 'Tea, sweets and stories in every living room on the street.', 'grandparents']] },
  { key: 'saturnalia', title: 'Saturnalia', when: rel('romanPaganism'), years: [-500, 400], scene: 'party',
    child: 'Saturnalia: masters serve slaves, children shout in the streets and nobody wears a toga.', adult: 'Saturnalia. You crown the household\'s mock king and pour the wine with your own hands.',
    opts: [['Serve the household', 'You waited on your own servants at dinner. They enjoyed it far too much.'], ['Gamble openly in the street', 'Dice are legal for a week. You lost three sesterces and a sandal.', 'casino'], ['Give little gifts', 'Wax candles and clay figurines for everyone. Io Saturnalia!']] },
  { key: 'panathenaia', title: 'The Panathenaia', when: rel('greekPaganism'), years: [-700, 400], scene: 'parade',
    child: 'The great procession climbs to Athena\'s temple carrying her new robe.', adult: 'You march your family in the great procession, all in your finest chitons.',
    opts: [['Carry an offering', 'You carried a basket of barley without dropping a grain.', 'holy'], ['Watch the chariot races', 'You cheered yourself hoarse for a team that came last.', 'sports'], ['Feast after the sacrifice', 'Roast meat for the whole city. Nobody cooked at home.']] },
  { key: 'wepet', title: 'The new year flood', when: rel('egyptianPaganism'), years: [-800, 400], scene: 'festival',
    child: 'The river rises, which means a new year. Your family drinks and sings by the water.', adult: 'The Nile floods on time. You thank the gods and feast with the whole household.',
    opts: [['Bring bread to the temple', 'The priests accepted it with a nod. The harvest will be good.', 'holy'], ['Drink the festival beer', 'Sweet and strong. You danced by the river until the stars came out.', 'bar'], ['Float a lamp on the river', 'It bobbed away downstream, carrying a wish.']] },
  { key: 'yule', title: 'Yule', when: rel('paganism'), years: [-800, 1300], scene: 'camping',
    child: 'The Yule log burns all night and nobody is allowed to let it go out.', adult: 'You drag the Yule log home through the snow and toast the longest night.',
    opts: [['Tend the fire all night', 'Dawn came and the fire still burned. Luck for the year.'], ['Drink the mead', 'Toast after toast to gods, ancestors and the goat.', 'bar'], ['Leave food for the spirits', 'In the morning the bowl was empty. Probably a fox. Probably.', 'ghost']] },
  { key: 'thanksgiving', title: 'Thanksgiving', when: land('us'), years: [1863, 2300], scene: 'familyDinner',
    child: 'Thanksgiving. The adults argue about politics while you hide rolls in your pockets.', adult: 'You are hosting Thanksgiving. Your uncle has opinions and the turkey is still frozen.',
    opts: [['Say what you are thankful for', 'You said "everyone here". Even your uncle went quiet.'], ['Fight over the drumstick', 'A clean victory. Your cousin will not forget.'], ['Keep the peace at the table', 'Politics were banned. You talked about pie for three hours.']] },
  { key: 'newYearsEve', title: 'New Year\'s Eve', when: rel('none', 'folk', 'christianity'), years: [1900, 2300], scene: 'fireworks',
    child: 'You are allowed to stay up until midnight for the first time.', adult: 'Midnight approaches. The family counts down, glasses raised.',
    opts: [['Make a family resolution', 'Everyone agreed to eat dinner together more. It lasted till February.'], ['Bang pots in the street', 'The whole road joined in. A gloriously loud start to the year.', 'party'], ['Fall asleep at 11:58', 'You woke up in the new year on the sofa with a party hat on.']] },
];

const HOLIDAY_EVENTS: EventDef[] = HOLIDAYS.map((h) => ({
  id: `fa_hol_${h.key}`, cat: 'family', minAge: 3, weight: 1.3, cooldown: 4, years: h.years,
  when: (x: Ctx) => h.when(x) && (x.age >= 18 || hasParents(x)), scene: h.scene,
  title: h.title, text: (x: Ctx) => (x.age < 18 ? h.child : h.adult),
  choices: h.opts.map(([label, out, scene], i) => ({
    label, scene, tags: (i === 0 ? ['help'] : i === 1 ? ['impulsive'] : ['cautious']) as ('help' | 'impulsive' | 'cautious')[],
    run: (x: Ctx) => {
      if (i === 0) { x.mods({ empathy: 2, happiness: 3 }); for (const r of x.rels('parent', 'child', 'sibling', 'spouse')) x.relMod(r.npcId, 2); }
      else if (i === 1) x.mods({ happiness: 5, discipline: -1 });
      else x.mods({ faith: 3, wisdom: 2, stress: -3 });
      return out;
    },
  })),
}));

// ------------------------------------------------------------------ era flavour
const ERA_FAMILY: EventDef[] = [
  {
    id: 'fa_paterfamilias', cat: 'childhood', minAge: 6, maxAge: 15, years: [-800, 476], once: true, weight: 1.5, when: hasParents, scene: 'family',
    title: 'The paterfamilias', text: 'Your father, head of the household by law, has decided your future over breakfast without asking you.',
    choices: [
      { label: 'Obey without a word', tags: ['cautious'], run: (x) => { x.mods({ discipline: 4, happiness: -2 }); x.train('etiquette', 2); return 'He nodded, satisfied. Roman fathers rarely say more than that.'; } },
      { label: 'Ask your mother to intervene', tags: ['social'], run: (x) => { x.train('persuasion', 2); x.mods({ confidence: 1 }); return 'She did it so cleverly he thought it was his own idea to change his mind.'; } },
      { label: 'Make an offering to the household gods', run: (x) => { x.mods({ faith: 4 }); return 'The Lares watched from their little shrine. Things changed. Slowly.'; }, scene: 'holy' },
    ],
  },
  {
    id: 'fa_sisterDowry', cat: 'family', minAge: 14, maxAge: 40, years: [-800, 1920], once: true, weight: 0.8,
    bind: (x) => { const r = x.rels('sibling').filter((s) => { const n = x.npc(s.npcId); return n && n.gender === 'female' && x.npcAge(n) >= 18 && x.npcAge(n) <= 30; }); return r.length ? { npcId: r[0].npcId } : null; }, scene: 'familyDinner',
    title: 'The dowry', text: (x) => `The family is haggling over ${who(x)}'s dowry. The groom's side wants ${x.pick(['three cows more', 'the good linen', 'the orchard', 'a silver chest'])}.`,
    choices: [
      { label: 'Contribute your savings', tags: ['help'], when: (x) => x.age >= 16, run: (x) => { const c = P(x, 300); if (!x.spend(c)) return 'You had nothing to give but your blessing.'; x.relMod(npcId(x), 12, 8); x.mods({ karma: 3 }); return `${who(x)} kissed your cheek. The deal was sealed by sundown.`; } },
      { label: 'Help haggle', tags: ['ambitious'], run: (x) => { x.train('negotiation', 3); x.relMod(npcId(x), 4); return 'You talked them down to two cows and a goat. A legend at fifteen.'; } },
      { label: 'Ask if she even likes him', tags: ['social'], run: (x) => { x.relMod(npcId(x), 8, 10); x.mods({ empathy: 3 }); return `Nobody else had asked. ${who(x)} told you everything that night.`; } },
    ],
  },
  {
    id: 'fa_nanny', cat: 'childhood', minAge: 3, maxAge: 10, years: [1820, 1939], once: true, weight: 1.5, when: rich, scene: 'family',
    title: 'Nanny', text: 'Your parents are a rumour glimpsed at teatime. Nanny, starched and formidable, is the true ruler of the nursery.',
    choices: [
      { label: 'Win Nanny over', tags: ['social'], run: (x) => { x.mods({ happiness: 3, empathy: 2 }); x.train('etiquette', 2); return 'She slipped you a ginger biscuit and called you "pet". The highest honour.'; } },
      { label: 'Put a frog in her bed', tags: ['impulsive'], run: (x) => { x.mods({ creativity: 2, discipline: -2 }); return 'Nanny did not scream. Nanny removed it calmly and you ate cold porridge for a week.'; } },
      { label: 'Beg to see your mother', tags: ['cautious'], scene: 'lonely', run: (x) => { x.mods({ loneliness: 3 }); for (const p of x.aliveParents()) x.relMod(p.id, 3); return 'Ten minutes in the drawing room, a pat on the head, then back upstairs.'; } },
    ],
  },
  {
    id: 'fa_evacuation', cat: 'childhood', minAge: 4, maxAge: 14, years: [1939, 1944], once: true, weight: 3, when: (x) => ['gb', 'fr', 'de', 'ru', 'it', 'jp'].includes(x.c.countryId), scene: 'refugees',
    title: 'Evacuated', text: 'A label on your coat, a gas mask in a box, and a train to the countryside without your parents.',
    choices: [
      { label: 'Be brave for the little ones', tags: ['help'], run: (x) => { x.mods({ resilience: 5, empathy: 3, trauma: 2 }); x.remember('warChild', 'Evacuated as a child in wartime', 35); return 'You held a crying stranger\'s hand all the way. You never learned their name.'; } },
      { label: 'Love the countryside', tags: ['social'], scene: 'farm', run: (x) => { x.mods({ happiness: 3, fitness: 2 }); x.train('farming', 2); x.remember('warChild', 'Evacuated as a child in wartime', 30); return 'Cows, apples, a farmer\'s wife who fed you like royalty. Home felt very far away.'; } },
      { label: 'Write home every day', tags: ['cautious'], scene: 'loveLetter', run: (x) => { x.mods({ loneliness: 4, smarts: 1 }); x.train('writing', 2); for (const p of x.aliveParents()) x.relMod(p.id, 6); x.remember('warChild', 'Evacuated as a child in wartime', 35); return 'Your mother kept every single letter in a biscuit tin.'; } },
    ],
  },
  {
    id: 'fa_fatherReturns', cat: 'childhood', minAge: 3, maxAge: 12, years: [1918, 1919], once: true, weight: 2, when: twoParents, scene: 'reunion',
    title: 'Home from the war', text: 'A thin man in uniform at the door. Your mother is crying. You are told he is your father.',
    choices: [
      { label: 'Run to him', tags: ['social'], run: (x) => { for (const p of x.aliveParents()) x.relMod(p.id, 6); x.mods({ happiness: 4 }); return 'He held you very tightly and did not speak for a long time.'; } },
      { label: 'Hide behind your mother', tags: ['cautious'], run: (x) => { x.mods({ anxiety: 2 }); return 'It took weeks before you sat on his knee. He waited patiently.'; } },
      { label: 'Ask about his medals', run: (x) => { x.mods({ wisdom: 1 }); return 'He put them in a drawer and never wore them again.'; } },
    ],
  },
  {
    id: 'fa_fatherReturns2', cat: 'childhood', minAge: 3, maxAge: 12, years: [1945, 1947], once: true, weight: 2, when: twoParents, scene: 'reunion',
    title: 'The stranger at the door', text: 'The war is over. The man your mother calls your father has finally come home.',
    choices: [
      { label: 'Show him your drawings', tags: ['social'], run: (x) => { for (const p of x.aliveParents()) x.relMod(p.id, 6); x.mods({ happiness: 3 }); return 'He looked at every one, very slowly, as if they were maps home.'; } },
      { label: 'Keep your distance', tags: ['cautious'], run: (x) => { x.mods({ anxiety: 2, resilience: 1 }); return 'He jumped at loud noises. So, eventually, did you, in sympathy.'; } },
      { label: 'Ask him to stay forever', run: (x) => { x.mods({ empathy: 2 }); return '"Forever," he promised. He mostly kept it.'; } },
    ],
  },
  {
    id: 'fa_suburbs', cat: 'childhood', minAge: 4, maxAge: 14, years: [1948, 1968], once: true, weight: 1.2, when: (x) => hasParents(x) && !poor(x), scene: 'house',
    title: 'The new suburb', text: 'A brand-new house with a lawn, a carport and identical neighbours. Your mother has bought an electric mixer.',
    choices: [
      { label: 'Ride bikes with the street kids', tags: ['social'], scene: 'friends', run: (x) => { x.mods({ happiness: 4, fitness: 2, popularity: 2 }); return 'Out till the streetlights came on, every night, all summer.'; } },
      { label: 'Watch the new television', scene: 'gadget', run: (x) => { x.mods({ happiness: 2, creativity: 1 }); return 'Black and white cowboys. You practised their walk in the hall.'; } },
      { label: 'Mow the lawn for coins', tags: ['ambitious'], run: (x) => { x.money(P(x, 40)); x.mods({ discipline: 2 }); return 'You cut the whole street\'s grass. An empire of lawns.'; } },
    ],
  },
  {
    id: 'fa_duckCover', cat: 'childhood', minAge: 5, maxAge: 14, years: [1951, 1969], once: true, weight: 0.8, when: land('us', 'gb', 'ru', 'de'), scene: 'family',
    title: 'The fallout shelter', text: 'Your father is digging a shelter in the back garden. He has stocked it with tinned peaches.',
    choices: [
      { label: 'Help dig', tags: ['help'], scene: 'construction', run: (x) => { x.mods({ fitness: 2, anxiety: 2 }); x.train('construction', 2); for (const p of x.aliveParents()) x.relMod(p.id, 3); return 'You dug for a weekend. It became the best den in the street.'; } },
      { label: 'Eat the peaches', tags: ['impulsive'], run: (x) => { x.mods({ happiness: 2 }); return 'Civilisation\'s last peaches. Gone by Tuesday.'; } },
      { label: 'Ask if the world will end', tags: ['cautious'], run: (x) => { x.mods({ anxiety: 3, wisdom: 1 }); return '"Not today," your mother said, and made cocoa.'; } },
    ],
  },
  {
    id: 'fa_wireless', cat: 'childhood', minAge: 4, maxAge: 15, years: [1925, 1955], once: true, weight: 1, when: hasParents, scene: 'family',
    title: 'Round the wireless', text: 'Every evening the family gathers round the wireless set. Nobody may speak during the serial.',
    choices: [
      { label: 'Do all the voices after', tags: ['social'], run: (x) => { x.mods({ creativity: 3, popularity: 1 }); x.train('acting', 2); return 'Your impression of the villain had your father crying with laughter.'; } },
      { label: 'Fiddle with the dial', tags: ['impulsive'], scene: 'gadget', run: (x) => { x.mods({ smarts: 1 }); x.train('electronicsRepair', 1); return 'You found a foreign station playing jazz and were banned from the dial.'; } },
      { label: 'Listen to the news with Dad', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 2 }); x.train('history', 1); return 'He explained the world in a low voice. You felt very grown up.'; } },
    ],
  },
  {
    id: 'fa_screenTime', cat: 'childhood', minAge: 5, maxAge: 14, years: [2010, 2300], weight: 1, cooldown: 4, when: hasParents, scene: 'gadget',
    title: 'Screen time', text: (x) => `Your parents announce a screen-time limit of ${x.pick(['one hour', 'thirty minutes', 'weekends only'])}. This is an outrage.`,
    choices: [
      { label: 'Negotiate', tags: ['social'], run: (x) => { x.train('negotiation', 2); return 'An extra hour, earned by reading. You read very fast.'; } },
      { label: 'Hack the parental controls', tags: ['impulsive'], scene: 'hacker', run: (x) => { x.train('programming', 2); x.mods({ discipline: -2 }); return 'You bypassed it in four minutes. They found out in five.'; } },
      { label: 'Go outside instead', tags: ['cautious'], scene: 'playground', run: (x) => { x.mods({ fitness: 2, happiness: 2 }); return 'You found a tree, a stick, and a neighbour\'s kid. The old ways still work.'; } },
    ],
  },
  {
    id: 'fa_videoCallGran', cat: 'childhood', minAge: 4, maxAge: 15, years: [2008, 2300], weight: 1, cooldown: 3, bind: bindRel('grandparent'), scene: 'gadget',
    title: 'Video call', text: (x) => `${who(x)} has video-called again. All you can see is a forehead and a ceiling fan.`,
    choices: [
      { label: 'Teach them to hold the phone', tags: ['help'], run: (x) => { x.relMod(npcId(x), 6, 3); x.mods({ empathy: 2 }); return `After twenty minutes you could see ${his(x)} whole face. ${who(x)} was beaming.`; } },
      { label: 'Show them your room', tags: ['social'], run: (x) => { x.relMod(npcId(x), 4); x.mods({ happiness: 2 }); return 'A full tour, including the dust under the bed. Very well received.'; } },
      { label: 'Freeze your face and hang up', tags: ['impulsive'], run: (x) => { x.relMod(npcId(x), -2); return '"Bad connection." Your guilt had a perfect signal.'; } },
    ],
  },
  {
    id: 'fa_apprenticed', cat: 'childhood', minAge: 10, maxAge: 14, years: [500, 1800], once: true, weight: 1.2, when: (x) => hasParents(x) && !rich(x), scene: 'factory',
    title: 'Sent to a master', text: (x) => `Your father has arranged for you to be apprenticed to the ${x.pick(['blacksmith', 'baker', 'weaver', 'carpenter', 'cooper'])} two villages over.`,
    choices: [
      { label: 'Work hard', tags: ['ambitious'], run: (x) => { x.mods({ discipline: 4, fitness: 2 }); x.train(x.pick(['blacksmithing', 'baking', 'tailoring', 'carpentry']), 4); return 'Up before dawn, burns on your hands, and pride in every finished piece.'; } },
      { label: 'Beg to stay home', tags: ['cautious'], run: (x) => { x.mods({ happiness: 1 }); for (const p of x.aliveParents()) x.relMod(p.id, -2); return 'They let you stay. The family ate a little less that winter.'; } },
      { label: 'Charm the master', tags: ['social'], run: (x) => { x.train('charm', 2); x.mods({ popularity: 2 }); return 'He gave you the easy jobs and an extra bowl of stew. Clever.'; } },
    ],
  },
  {
    id: 'fa_farmChores', cat: 'childhood', minAge: 5, maxAge: 14, years: [-800, 1940], weight: 1, cooldown: 4, when: (x) => poor(x) || x.c.familyStatus === 'working', scene: 'farm',
    title: 'Dawn chores', text: 'It is still dark and you have to milk the goat, fetch water and feed the hens before breakfast.',
    choices: [
      { label: 'Get it done', tags: ['cautious'], run: (x) => { x.mods({ discipline: 3, fitness: 2 }); x.train('animalHusbandry', 2); return 'The goat kicked the bucket over once. You started again without crying.'; } },
      { label: 'Name all the hens', run: (x) => { x.mods({ creativity: 2, happiness: 2 }); return 'Agnes, Duchess and Mrs Peck. It made the eggs feel personal.'; } },
      { label: 'Sleep in', tags: ['impulsive'], run: (x) => { x.mods({ energy: 3 }); for (const p of x.aliveParents()) x.relMod(p.id, -3); return 'You were hauled out by your ankle. Lesson learned.'; } },
    ],
  },
  {
    id: 'fa_ancestorShrine', cat: 'family', minAge: 5, years: [-800, 2300], weight: 0.8, cooldown: 6, when: rel('shinto', 'buddhism', 'folk', 'romanPaganism', 'hinduism'), scene: 'holy',
    title: 'The ancestors', text: 'Incense curls in front of the family shrine. Photographs, or masks, of people who came before you.',
    choices: [
      { label: 'Make an offering', tags: ['cautious'], run: (x) => { x.mods({ faith: 3, divineFavor: 2 }); return 'Rice, fruit and a cup of tea. The house felt quieter, in a good way.'; } },
      { label: 'Ask who they were', tags: ['social'], scene: 'grandparents', run: (x) => { x.mods({ wisdom: 3 }); x.train('history', 1); return 'A smuggler, a scholar and a woman who outlived three husbands. Interesting family.'; } },
      { label: 'Tell them your news', run: (x) => { x.mods({ stress: -3, happiness: 2 }); return 'Talking to the dead turned out to be very relaxing.'; } },
    ],
  },
  {
    id: 'fa_familyGroupChat', cat: 'family', minAge: 16, years: [2012, 2300], weight: 1, cooldown: 3, when: (x) => x.rels('parent', 'sibling', 'child').length >= 2, scene: 'gadget',
    title: 'The family group chat', text: (x) => `The family group chat has ${x.int(40, 300)} unread messages. Most are ${x.pick(['blurry photos of a cake', 'a forwarded chain letter', 'an argument about a parking space', 'your aunt\'s new emoji discovery'])}.`,
    choices: [
      { label: 'Reply with a thumbs-up', tags: ['cautious'], run: (x) => { x.mods({ stress: -1 }); return 'Ambiguous. Diplomatic. Your mother read it as passive-aggressive.'; } },
      { label: 'Wade into the argument', tags: ['impulsive'], scene: 'argument', run: (x) => { x.mods({ stress: 3 }); for (const r of x.rels('sibling')) x.relMod(r.npcId, -2); return 'You won. Three relatives left the group. Your uncle rejoined twice.'; } },
      { label: 'Mute it for a year', run: (x) => { x.mods({ stress: -3 }); return 'Peace. You missed one birthday and a minor scandal.'; } },
    ],
  },
  {
    id: 'fa_hologramGran', cat: 'family', minAge: 8, years: [2090, 2300], weight: 0.8, once: true, scene: 'ghost',
    title: 'Grandma.exe', text: 'The family has a memorial AI of your late great-grandmother. She still asks if you are eating properly.',
    choices: [
      { label: 'Talk to her', tags: ['social'], run: (x) => { x.mods({ happiness: 2, loneliness: -3 }); return 'She told the same story about the dog. Somehow it was comforting.'; } },
      { label: 'Update her personality', tags: ['ambitious'], scene: 'hacker', run: (x) => { x.train('aiDevelopment', 2); return 'She became slightly more fun and noticeably less judgemental. Was that her, though?'; } },
      { label: 'Switch her off', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 3, depression: 1 }); return 'The room was very quiet afterwards. Some people should be allowed to rest.'; } },
    ],
  },
];

// ------------------------------------------------------------------ expecting and raising children
const expecting = (x: Ctx) => !!x.flag('pregnantDue');
const babyName = (x: Ctx) => x.first(npcId(x));
const PARENTING: EventDef[] = [
  {
    id: 'fa_pregnancyNews', cat: 'family', minAge: 18, maxAge: 60, weight: 6, cooldown: 2, when: expecting, scene: 'pregnancy',
    title: 'Expecting', text: (x) => (x.year >= 1960 ? 'Two lines on the test. You both stare at it as if it might change its mind.' : 'The midwife smiles and confirms it: a baby is coming.'),
    choices: [
      { label: 'Tell everyone at once', tags: ['social'], scene: 'familyDinner', run: (x) => { x.mods({ happiness: 6 }); for (const p of x.aliveParents()) x.relMod(p.id, 5); return 'Your mother screamed so loudly the neighbours came round to check.'; } },
      { label: 'Keep it secret a while', tags: ['cautious'], run: (x) => { x.mods({ happiness: 4, anxiety: 2 }); const l = x.lover(); if (l) x.relMod(l.npcId, 4, 4); return 'Your own private miracle, for a few more weeks.'; } },
      { label: 'Start a spreadsheet', tags: ['ambitious'], run: (x) => { x.mods({ anxiety: 3, discipline: 2 }); x.train('bookkeeping', 1); return 'Nappies per year, multiplied by eighteen. You went quite pale.'; } },
    ],
  },
  {
    id: 'fa_babyShower', cat: 'family', minAge: 18, maxAge: 60, weight: 4, cooldown: 2, years: [1930, 2300], when: expecting, scene: 'babyShower',
    title: 'Baby shower', text: 'Friends throw you a baby shower: pastel balloons, games involving melted chocolate in nappies, and far too many tiny socks.',
    choices: [
      { label: 'Play every silly game', tags: ['social'], run: (x) => { x.mods({ happiness: 5, popularity: 2 }); return 'You won "guess the bump size" with suspicious accuracy.'; } },
      { label: 'Open the gifts slowly', tags: ['cautious'], run: (x) => { x.money(P(x, 300)); x.mods({ happiness: 3 }); return 'Three identical baby monitors and one hand-knitted blanket that made you cry.'; } },
      { label: 'Announce the name', tags: ['impulsive'], run: (x) => { x.mods({ happiness: 2 }); return 'A gasp, then polite silence. Your aunt said "how... unique".'; } },
    ],
  },
  {
    id: 'fa_nursery', cat: 'family', minAge: 18, maxAge: 60, weight: 3, cooldown: 2, when: expecting, scene: 'construction',
    title: 'The nursery', text: (x) => `You need to turn the ${x.pick(['spare room', 'box room', 'study', 'corner of the bedroom'])} into a nursery before the baby arrives.`,
    choices: [
      { label: 'Assemble the cot yourself', tags: ['ambitious'], run: (x) => { x.train('carpentry', 2); x.mods({ stress: 3 }); return 'Six hours, four leftover screws, one cot that stands. Mostly.'; } },
      { label: 'Paint a mural', run: (x) => { x.train('painting', 3); x.mods({ creativity: 3, happiness: 2 }); return 'A slightly cross-eyed giraffe. The baby will love it.'; } },
      { label: 'Pay someone', tags: ['cautious'], run: (x) => { if (!x.spend(P(x, 400))) return 'Too pricey. You and a screwdriver it is.'; x.mods({ stress: -2 }); return 'Done in a day. You felt rich and slightly useless.'; } },
    ],
  },
  {
    id: 'fa_naming', cat: 'family', minAge: 18, weight: 8, cooldown: 1,
    bind: (x) => { const k = x.rels('child').filter((r) => !r.meta.named && !r.meta.adopted && (() => { const n = x.npc(r.npcId); return n && x.npcAge(n) === 0; })()); return k.length ? { npcId: k[0].npcId } : null; }, scene: 'birth',
    title: 'What\'s in a name', text: (x) => `The baby is here and the paperwork wants a name. You have been calling them "${babyName(x)}", but it isn't settled.`,
    choices: [
      { label: 'Keep it', tags: ['cautious'], run: (x) => { const r = x.rel(npcId(x)); if (r) r.meta.named = true; x.mods({ happiness: 2 }); return `${babyName(x)} it is. It suits the little face perfectly.`; } },
      { label: 'Honour a grandparent', tags: ['help'], when: (x) => x.c.relationships.some((r) => r.type === 'parent'), run: (x) => {
        const r = x.rel(npcId(x)); if (r) r.meta.named = true;
        const n = npcOf(x);
        const g = x.c.relationships.filter((q) => q.type === 'parent').map((q) => x.npc(q.npcId)).find((q) => q && q.gender === n?.gender);
        if (n && g) { n.firstName = g.firstName; x.relMod(g.id, 10, 5); return `Named ${g.firstName}, after ${g.alive ? 'a grandparent who wept at the news' : 'a grandparent who did not live to see it'}.`; }
        return `You kept ${babyName(x)} but gave a family name as the middle one. Everyone was pleased.`;
      } },
      { label: 'Pick something bold', tags: ['impulsive'], run: (x) => { const r = x.rel(npcId(x)); if (r) r.meta.named = true; const n = npcOf(x); if (n) n.firstName = x.pick(x.year < 1900 ? ['Augustus', 'Cassius', 'Octavia', 'Perpetua', 'Thaddeus', 'Euphemia'] : ['Nova', 'Storm', 'Zephyr', 'Juniper', 'Blaze', 'Orion', 'Saffron']); return `Meet ${babyName(x)}. The registrar raised one eyebrow.`; } },
    ],
  },
  {
    id: 'fa_sleepless', cat: 'family', minAge: 18, weight: 3, cooldown: 2, bind: bindKid(0, 1), scene: 'lonely',
    title: 'Sleepless nights', text: (x) => `It is 3am. ${babyName(x)} has been crying for two hours and nobody knows why.`,
    choices: [
      { label: 'Take the night shift', tags: ['help'], run: (x) => { x.mods({ energy: -8, stress: 4 }); x.relMod(npcId(x), 4); const l = x.lover(); if (l) x.relMod(l.npcId, 5, 3); return 'You walked the hallway four hundred times singing the only lullaby you know.'; } },
      { label: 'Drive around the block', tags: ['impulsive'], when: (x) => x.year >= 1920, scene: 'car', run: (x) => { x.mods({ energy: -4 }); return 'Asleep by the second roundabout. You sat in the drive for an hour, afraid to move.'; } },
      { label: 'Ask your parents for help', tags: ['cautious'], when: hasParents, scene: 'grandparents', run: (x) => { x.mods({ energy: 3, stress: -3 }); for (const p of x.aliveParents()) x.relMod(p.id, 4); return 'Grandma took one look, did something with her elbow and the baby fell asleep. Witchcraft.'; } },
    ],
  },
  {
    id: 'fa_firstSteps', cat: 'family', minAge: 18, weight: 4, cooldown: 1,
    bind: (x) => { const k = kids(x, 1, 1).filter((n) => !x.rel(n.id)?.meta.steps); return k.length ? { npcId: k[0].id } : null; }, scene: 'family',
    title: 'First steps', text: (x) => `${babyName(x)} lets go of the sofa, wobbles, and takes three steps toward you.`,
    choices: [
      { label: 'Catch them', tags: ['help'], run: (x) => { const r = x.rel(npcId(x)); if (r) r.meta.steps = true; x.relMod(npcId(x), 6); x.mods({ happiness: 6 }); return 'Straight into your arms, giggling. You would remember it on your deathbed.'; } },
      { label: 'Grab the camera', tags: ['ambitious'], run: (x) => { const r = x.rel(npcId(x)); if (r) r.meta.steps = true; x.mods({ happiness: 3 }); return 'You missed it. You captured the fall afterwards in perfect focus.'; } },
      { label: 'Cheer like a stadium', tags: ['social'], scene: 'sports', run: (x) => { const r = x.rel(npcId(x)); if (r) r.meta.steps = true; x.mods({ happiness: 5 }); return `${babyName(x)} sat down, startled, then clapped for ${him(x)}self.`; } },
    ],
  },
  {
    id: 'fa_firstWord', cat: 'family', minAge: 18, weight: 3, cooldown: 1,
    bind: (x) => { const k = kids(x, 1, 2).filter((n) => !x.rel(n.id)?.meta.word); return k.length ? { npcId: k[0].id } : null; }, scene: 'birth',
    title: 'First word', text: (x) => `${babyName(x)} points at you and says a word. A real word.`,
    choices: [
      { label: 'It was "Mama"', run: (x) => { const r = x.rel(npcId(x)); if (r) r.meta.word = true; x.mods({ happiness: 5 }); return 'Half the family celebrated. The other half demanded a recount.'; } },
      { label: 'It was "Dada"', run: (x) => { const r = x.rel(npcId(x)); if (r) r.meta.word = true; x.mods({ happiness: 5 }); return 'Smug fathers everywhere rejoiced.'; } },
      { label: 'It was "No"', tags: ['impulsive'], run: (x) => { const r = x.rel(npcId(x)); if (r) r.meta.word = true; x.mods({ happiness: 3 }); return 'Clear, firm and used three hundred times by dinner.'; } },
    ],
  },
  {
    id: 'fa_toddlerMeltdown', cat: 'family', minAge: 18, weight: 1.5, cooldown: 2, bind: bindKid(2, 4), scene: 'shopping',
    title: 'Aisle five meltdown', text: (x) => `${babyName(x)} is face down on the shop floor, screaming, because the banana broke.`,
    choices: [
      { label: 'Stay calm and wait', tags: ['cautious'], run: (x) => { x.mods({ willpower: 3, stress: 2 }); return 'An old woman nodded at you in solidarity. You felt seen.'; } },
      { label: 'Give in with a sweet', tags: ['impulsive'], run: (x) => { x.mods({ stress: -2 }); x.relMod(npcId(x), 2); return 'Instant silence. You have created a monster.'; } },
      { label: 'Lie down and scream too', tags: ['social'], run: (x) => { x.mods({ happiness: 3, publicImage: -1 }); return `${babyName(x)} stopped, stared, and helped you up. Reverse psychology works.`; } },
    ],
  },
  {
    id: 'fa_firstDaySchool', cat: 'family', minAge: 18, weight: 2.5, cooldown: 1,
    bind: (x) => { const k = kids(x, 5, 5).filter((n) => !x.rel(n.id)?.meta.school); return k.length ? { npcId: k[0].id } : null; }, scene: 'classroom',
    title: 'First day of school', text: (x) => `${babyName(x)} in a uniform that is two sizes too big, holding your hand very tightly at the gate.`,
    choices: [
      { label: 'Walk them in', tags: ['help'], run: (x) => { const r = x.rel(npcId(x)); if (r) r.meta.school = true; x.relMod(npcId(x), 4); return 'They let go first. You cried in the car, not them.'; } },
      { label: 'Wave from the gate', tags: ['cautious'], run: (x) => { const r = x.rel(npcId(x)); if (r) r.meta.school = true; x.mods({ happiness: -1 }); return 'One look back, one wave, and gone. Part of you went with them.'; } },
      { label: 'Take a hundred photos', tags: ['social'], run: (x) => { const r = x.rel(npcId(x)); if (r) r.meta.school = true; x.mods({ happiness: 3 }); return `${babyName(x)} is blinking in all of them. You framed the blurriest.`; } },
    ],
  },
  {
    id: 'fa_schoolRun', cat: 'family', minAge: 18, years: [1950, 2300], weight: 1, cooldown: 3, bind: bindKid(5, 11), scene: 'car',
    title: 'The school run', text: (x) => `You are late. ${babyName(x)} has one shoe, no lunch, and has just remembered it is ${x.pick(['dress-up day', 'the bake sale', 'show-and-tell', 'the class trip'])}.`,
    choices: [
      { label: 'Improvise heroically', tags: ['ambitious'], run: (x) => { x.mods({ creativity: 3, stress: 2 }); x.relMod(npcId(x), 4); return 'A costume made from a bin bag and a colander. Best in class.'; } },
      { label: 'Make them go as they are', tags: ['cautious'], run: (x) => { x.mods({ discipline: 1 }); x.relMod(npcId(x), -2); return 'Lessons in preparedness. Very unpopular ones.'; } },
      { label: 'Phone in "sick" for both of you', tags: ['impulsive'], scene: 'cinema', run: (x) => { x.mods({ happiness: 4 }); x.relMod(npcId(x), 6); return 'A secret day off: cinema, pancakes, and a pact of silence.'; } },
    ],
  },
  {
    id: 'fa_kidBirthday', cat: 'family', minAge: 18, weight: 1.6, cooldown: 2, bind: bindKid(3, 12), scene: 'birthday',
    title: 'Birthday party', text: (x) => `${babyName(x)} turns ${ageOf(x)} and has invited ${x.int(8, 30)} children. All of them are coming.`,
    choices: [
      { label: 'Go all out', tags: ['ambitious'], run: (x) => { if (!x.spend(P(x, 400))) { x.relMod(npcId(x), 2); return 'You couldn\'t afford the bouncy castle, so you became one. Your back regrets it.'; } x.relMod(npcId(x), 8); x.mods({ stress: 3 }); return `A magician, a cake shaped like a ${x.pick(['dragon', 'castle', 'rocket', 'horse'])} and a sugar riot. Legendary.`; } },
      { label: 'Keep it simple', tags: ['cautious'], scene: 'familyDinner', run: (x) => { x.relMod(npcId(x), 4); return 'Pass the parcel, musical chairs, homemade cake. Nobody needed more.'; } },
      { label: 'Hire a clown', tags: ['impulsive'], run: (x) => { x.spend(P(x, 150)); x.relMod(npcId(x), x.chance(0.5) ? 6 : -3); return x.chance(0.5) ? 'Huge success.' : 'Three children cried. The clown cried too.'; } },
    ],
  },
  {
    id: 'fa_reportCard', cat: 'family', minAge: 18, years: [1850, 2300], weight: 1.4, cooldown: 2, bind: bindKid(6, 17), scene: 'exam',
    title: 'The report card', text: (x) => { const n = npcOf(x); const good = (n?.smarts ?? 50) > 55; return `${babyName(x)}'s report card says "${good ? 'a pleasure to teach, top of the class' : 'easily distracted, capable of more'}".`; },
    choices: [
      { label: 'Praise the effort', tags: ['help'], run: (x) => { x.relMod(npcId(x), 6, 4); return 'They stood a little taller all week.'; } },
      { label: 'Hire a tutor', tags: ['ambitious'], run: (x) => { if (!x.spend(P(x, 300))) return 'Tutors cost money. You became the tutor. Long-division tears ensued.'; const n = npcOf(x); if (n) n.smarts = Math.min(100, n.smarts + 4); x.relMod(npcId(x), -1); return 'Grades went up. Weekend joy went down.'; } },
      { label: 'Ban fun until it improves', tags: ['cautious'], scene: 'argument', run: (x) => { x.relMod(npcId(x), -6, -3); const n = npcOf(x); if (n) n.smarts = Math.min(100, n.smarts + 2); return 'Better grades, a slammed door, and a very cold breakfast.'; } },
    ],
  },
  {
    id: 'fa_kidBullied', cat: 'family', minAge: 18, weight: 1.2, cooldown: 4, bind: bindKid(6, 15), scene: 'classroom',
    title: 'Your kid\'s bully', text: (x) => `${babyName(x)} comes home with a torn bag and won't say why. You find out a kid at school has been picking on ${him(x)}.`,
    choices: [
      { label: 'Talk to the school', tags: ['cautious'], scene: 'meeting', run: (x) => { x.relMod(npcId(x), 5, 5); return x.chance(0.6) ? 'The head took it seriously. It stopped within a week.' : 'Forms were filled in. It slowed down. You stayed watchful.'; } },
      { label: 'Teach them to stand up', tags: ['help'], scene: 'sports', run: (x) => { x.relMod(npcId(x), 6, 4); return `Confidence lessons, some boxing, a lot of pep talks. ${babyName(x)} walked differently by spring.`; } },
      { label: 'Confront the bully\'s parents', tags: ['impulsive'], scene: 'argument', run: (x) => { x.mods({ stress: 4 }); x.relMod(npcId(x), 3); return x.chance(0.5) ? 'They were mortified and apologised. Their kid did too.' : 'It was a shouting match in a car park. Not your finest hour.'; } },
    ],
  },
  {
    id: 'fa_kidIsBully', cat: 'family', minAge: 18, weight: 0.6, cooldown: 6, bind: bindKid(7, 15), scene: 'meeting',
    title: 'A call from school', text: (x) => `The headteacher says ${babyName(x)} has been bullying a younger child.`,
    choices: [
      { label: 'Make them apologise in person', tags: ['help'], run: (x) => { x.relMod(npcId(x), -3, 3); x.mods({ karma: 3 }); return 'A mumbled sorry turned into a real one. Then, oddly, a friendship.'; } },
      { label: 'Ask what\'s going on at home', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), 5, 6); x.mods({ wisdom: 2 }); return 'It came out in a rush: they were scared about something you hadn\'t noticed.'; } },
      { label: 'Defend your child', tags: ['impulsive'], run: (x) => { x.relMod(npcId(x), 3, -2); x.mods({ karma: -3 }); return '"My child would never." Your child absolutely would.'; } },
    ],
  },
  {
    id: 'fa_babiesQuestion', cat: 'family', minAge: 18, weight: 1, once: true, bind: bindKid(4, 7), scene: 'family',
    title: 'The big question', text: (x) => `At dinner, ${babyName(x)} asks where babies come from. Every adult freezes.`,
    choices: [
      { label: 'Tell the stork story', tags: ['cautious'], run: (x) => { x.mods({ happiness: 1 }); return 'They told the whole class. The teacher sent a note.'; } },
      { label: 'Give a simple, honest answer', tags: ['help'], run: (x) => { x.relMod(npcId(x), 4, 6); x.mods({ wisdom: 2 }); return 'An age-appropriate answer. They said "okay" and asked for more peas.'; } },
      { label: '"Ask your other parent"', tags: ['impulsive'], run: (x) => { const l = x.lover(); if (l) x.relMod(l.npcId, -2); return 'Your partner gave you a look that could curdle milk.'; } },
    ],
  },
  {
    id: 'fa_kidWantsPet', cat: 'family', minAge: 18, weight: 1, cooldown: 4, bind: bindKid(5, 12), scene: 'pet',
    title: 'Can we have a puppy?', text: (x) => `${babyName(x)} has made a presentation, with slides, on why the family needs a dog.`,
    choices: [
      { label: 'Say yes', tags: ['impulsive'], run: (x) => { x.relMod(npcId(x), 10); x.mods({ happiness: 4 }); x.spend(P(x, 200)); return 'They promised to walk it every day. You walked it every day.'; } },
      { label: 'Start with a goldfish', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), 2); return 'Goldfish Number One lived a long life. Goldfish Two through Six, less so.'; } },
      { label: 'Say no', run: (x) => { x.relMod(npcId(x), -4); return 'The presentation will be resubmitted next quarter, with graphs.'; } },
    ],
  },
  {
    id: 'fa_teenRebellion', cat: 'family', minAge: 28, weight: 1.5, cooldown: 3, bind: bindKid(13, 17), scene: 'argument',
    title: 'Teenage rebellion', text: (x) => `${babyName(x)} has ${x.pick(['dyed their hair green', 'started slamming every door', 'declared you "literally ruining my life"', 'got a very questionable band T-shirt', 'stopped speaking in full sentences'])}.`,
    choices: [
      { label: 'Pick your battles', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), 3, 4); x.mods({ wisdom: 2 }); return 'You let the hair go and held the line on homework. Grudging respect.'; } },
      { label: 'Lay down the law', tags: ['ambitious'], run: (x) => { x.relMod(npcId(x), -6, -4); x.mods({ stress: 3 }); return 'Order restored. Conversations reduced to grunts.'; } },
      { label: 'Remember being that age', tags: ['help'], scene: 'calm', run: (x) => { x.relMod(npcId(x), 7, 5); return `You showed ${him(x)} your own teenage photos. Shared horror bridged the gap.`; } },
    ],
  },
  {
    id: 'fa_lateHome', cat: 'family', minAge: 30, weight: 1, cooldown: 3, bind: bindKid(14, 17), scene: 'lonely',
    title: 'Two in the morning', text: (x) => `${babyName(x)} promised to be home by eleven. It is 2am and ${his(x)} ${x.year >= 1995 ? 'phone goes to voicemail' : 'friends\' parents don\'t know anything'}.`,
    choices: [
      { label: 'Go out looking', tags: ['help'], scene: 'car', run: (x) => { x.mods({ stress: 5 }); x.relMod(npcId(x), 2, 2); return 'Found them at a bus stop, sheepish and fine. You held them a bit too long.'; } },
      { label: 'Wait up in the dark', tags: ['cautious'], run: (x) => { x.mods({ anxiety: 4 }); x.relMod(npcId(x), -2, 3); return 'The key turned at 2:40. You said nothing. The silence said plenty.'; } },
      { label: 'Call the police', tags: ['impulsive'], scene: 'police', run: (x) => { x.mods({ stress: 3 }); x.relMod(npcId(x), -5); return 'An officer found them at a party. Mortifying for everyone, but safe.'; } },
    ],
  },
  {
    id: 'fa_kidCrush', cat: 'family', minAge: 28, weight: 0.8, cooldown: 4, bind: bindKid(13, 16), scene: 'dance',
    title: 'The school dance', text: (x) => `${babyName(x)} has been asked to the school dance and is in a full-blown panic about what to wear.`,
    choices: [
      { label: 'Help them get ready', tags: ['help'], run: (x) => { x.relMod(npcId(x), 7, 5); return 'You fixed a collar, said "you look great", and were waved away. Mission accomplished.'; } },
      { label: 'Embarrassing photos at the door', tags: ['impulsive'], run: (x) => { x.relMod(npcId(x), -2); x.mods({ happiness: 4 }); return 'Thirty photos. They will thank you at their wedding.'; } },
      { label: 'Give a gentle talk', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), 2, 4); return '"Be kind, be home on time." They rolled their eyes and listened.'; } },
    ],
  },
  {
    id: 'fa_collegeFund', cat: 'family', minAge: 25, years: [1900, 2300], weight: 0.8, cooldown: 6, bind: bindKid(8, 17), scene: 'moneyUp',
    title: 'The college fund', text: (x) => `University for ${babyName(x)} will cost ${x.fmt(P(x, 40000))}. The fund currently holds a button and some optimism.`,
    choices: [
      { label: 'Start saving seriously', tags: ['cautious'], run: (x) => { const c = P(x, 5000); if (!x.spend(c)) return 'You opened an account with what you had. It\'s a start.'; x.relMod(npcId(x), 4); x.setFlag(`fa_fund_${npcId(x)}`, true); return `${x.fmt(c)} in. Holidays were shorter for a few years.`; } },
      { label: 'Invest it boldly', tags: ['ambitious'], scene: 'stocks', run: (x) => { const c = P(x, 3000); if (!x.spend(c)) return 'Nothing to invest. Maybe next year.'; if (x.chance(0.5)) { x.money(c * 2); return 'It doubled. You told everyone you were a genius.'; } return 'The market ate half of it. You told no one.'; } },
      { label: 'They can earn a scholarship', tags: ['impulsive'], run: (x) => { const n = npcOf(x); if (n) n.ambition = Math.min(100, n.ambition + 5); return 'A bold strategy. They studied harder out of pure spite.'; } },
    ],
  },
  {
    id: 'fa_emptyNest', cat: 'family', minAge: 38, maxAge: 75, once: true, weight: 2,
    when: (x) => x.children().filter(alive).length > 0 && kids(x, 0, 18).length === 0 && kids(x, 19, 24).length > 0, scene: 'lonely',
    title: 'Empty nest', text: 'The last child has moved out. The house is very tidy and very, very quiet.',
    choices: [
      { label: 'Turn their room into a gym', tags: ['ambitious'], scene: 'gym', run: (x) => { x.mods({ fitness: 3, happiness: 2 }); return 'Within a week there were clothes drying on the exercise bike.'; } },
      { label: 'Rediscover your partner', tags: ['social'], when: (x) => !!x.lover(), scene: 'date', run: (x) => { const l = x.lover()!; x.relMod(l.npcId, 8, 4); x.mods({ happiness: 4 }); return 'Dinner without anyone asking for a lift. You remembered why you liked each other.'; } },
      { label: 'Call them every day', tags: ['cautious'], run: (x) => { x.mods({ loneliness: 3 }); for (const k of x.children()) x.relMod(k.id, x.chance(0.5) ? 2 : -1); return 'They answered most of the time. "Mum, I\'m fine." "Dad, I\'m FINE."'; } },
    ],
  },
  {
    id: 'fa_boomerang', cat: 'family', minAge: 40, years: [1970, 2300], weight: 0.9, cooldown: 6, bind: bindKid(22, 35), scene: 'moving',
    title: 'Boomerang kid', text: (x) => `${babyName(x)}, ${ageOf(x)}, is on the doorstep with three bin bags and a ${x.pick(['broken heart', 'lost job', 'rent hike', 'failed start-up'])}. "Just for a few weeks."`,
    choices: [
      { label: 'Welcome them home', tags: ['help'], scene: 'family', run: (x) => { x.relMod(npcId(x), 8, 4); x.spend(P(x, 1000)); x.mods({ stress: 2 }); return 'A few weeks became eighteen months. You secretly loved it.'; } },
      { label: 'Set rent and rules', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), 2, 4); x.money(P(x, 600)); return 'A contract on the fridge. They grumbled and saved up a deposit within a year.'; } },
      { label: 'Tough love: say no', tags: ['ambitious'], run: (x) => { x.relMod(npcId(x), -8, -4); return 'They stayed on a friend\'s sofa. It worked out. They mention it at Christmas.'; } },
    ],
  },
  {
    id: 'fa_kidCareer', cat: 'family', minAge: 34, weight: 0.8, cooldown: 6, bind: bindKid(16, 22), scene: 'interview',
    title: 'The big plan', text: (x) => `${babyName(x)} announces a plan to become ${x.pick(['a professional musician', 'an actor', 'a stand-up comedian', 'a sculptor', 'a pro gamer', 'a circus performer'])} instead of going to university.`,
    choices: [
      { label: 'Back them fully', tags: ['help'], run: (x) => { x.relMod(npcId(x), 10, 6); x.spend(P(x, 1000)); return 'You were in the front row of every tiny gig. They never forgot it.'; } },
      { label: 'Insist on a backup plan', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), -2, 2); return 'A part-time course and the dream on weekends. A reasonable truce.'; } },
      { label: 'Forbid it', tags: ['ambitious'], scene: 'argument', run: (x) => { x.relMod(npcId(x), -12, -6); return 'They went anyway. Some silences last years.'; } },
    ],
  },
  {
    id: 'fa_scienceFair', cat: 'family', minAge: 25, weight: 0.8, cooldown: 4, bind: bindKid(8, 14), years: [1950, 2300], scene: 'lab',
    title: 'Science fair', text: (x) => `${babyName(x)}'s science fair project is due tomorrow. It is a ${x.pick(['volcano', 'potato battery', 'mould garden', 'paper rocket'])} and it is not finished.`,
    choices: [
      { label: 'Help (a little)', tags: ['help'], run: (x) => { x.relMod(npcId(x), 5); x.mods({ smarts: 1 }); return 'Midnight, baking soda everywhere, and a third-place ribbon.'; } },
      { label: 'Take over completely', tags: ['ambitious'], run: (x) => { x.relMod(npcId(x), -2); x.mods({ ego: 2 }); return 'First prize. Everyone could tell. Including the judges.'; } },
      { label: 'Let them figure it out', tags: ['cautious'], run: (x) => { const n = npcOf(x); if (n) n.smarts = Math.min(100, n.smarts + 2); return 'Lopsided, honest, all theirs. They were prouder than any ribbon.'; } },
    ],
  },
  {
    id: 'fa_sportsDay', cat: 'family', minAge: 22, weight: 1, cooldown: 3, bind: bindKid(5, 12), scene: 'sports',
    title: 'Sports day', text: (x) => `${babyName(x)} is in the egg-and-spoon race. There is also a parents' race, and you have been signed up.`,
    choices: [
      { label: 'Run the parents\' race', tags: ['ambitious'], run: (x) => { x.mods({ fitness: 1 }); if (x.chance(0.4)) { x.relMod(npcId(x), 6); return 'You won! And pulled a hamstring. Worth it.'; } x.relMod(npcId(x), 3); return 'You fell spectacularly. Your child has never been happier.'; } },
      { label: 'Cheer from the sidelines', tags: ['social'], run: (x) => { x.relMod(npcId(x), 5); return 'They came fourth, then waved at you like they had won gold.'; } },
      { label: 'Film everything', tags: ['cautious'], run: (x) => { x.mods({ happiness: 2 }); return 'Forty minutes of footage, mostly of grass.'; } },
    ],
  },
  {
    id: 'fa_schoolPlay', cat: 'family', minAge: 22, weight: 1, cooldown: 3, bind: bindKid(4, 11), scene: 'theater',
    title: 'The school play', text: (x) => `${babyName(x)} has been cast as ${x.pick(['Tree Number Three', 'a sheep', 'the narrator', 'the lead', 'a cloud with one line'])}.`,
    choices: [
      { label: 'Make the costume', tags: ['help'], run: (x) => { x.train('tailoring', 2); x.relMod(npcId(x), 5); return 'Cardboard, cotton wool and love. It fell apart in Act Two. Still magnificent.'; } },
      { label: 'Cheer too loudly', tags: ['impulsive'], run: (x) => { x.relMod(npcId(x), 3); x.mods({ happiness: 4 }); return 'A standing ovation for one line. The teacher had to pause the show.'; } },
      { label: 'Miss it for work', tags: ['ambitious'], when: (x) => x.employed, scene: 'office', run: (x) => { x.relMod(npcId(x), -8); x.mods({ professionalRep: 1, depression: 2 }); return 'They looked for you in the audience. You watched a shaky video on the train home.'; } },
    ],
  },
  {
    id: 'fa_toothFairy', cat: 'family', minAge: 22, years: [1900, 2300], weight: 1, once: true, bind: bindKid(5, 8), scene: 'family',
    title: 'The tooth fairy', text: (x) => `${babyName(x)} lost a tooth. It is under the pillow and you have no coins.`,
    choices: [
      { label: 'Leave a note from the fairy', tags: ['social'], run: (x) => { x.mods({ creativity: 3 }); x.relMod(npcId(x), 4); return 'Tiny handwriting, glitter, an IOU. Your child treasured it for years.'; } },
      { label: 'Raid the piggy bank', tags: ['impulsive'], run: (x) => { x.relMod(npcId(x), 2); return 'You paid the tooth fairy from your child\'s own savings. A perfect crime.'; } },
      { label: 'Tell the truth', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), -1, 3); return 'They took it well, then demanded the money anyway.'; } },
    ],
  },
  {
    id: 'fa_parentsEvening', cat: 'family', minAge: 22, years: [1880, 2300], weight: 1, cooldown: 3, bind: bindKid(6, 16), scene: 'meeting',
    title: 'Parents\' evening', text: (x) => `Five minutes each with ${x.int(6, 12)} teachers about ${babyName(x)}. The queue for maths is already out the door.`,
    choices: [
      { label: 'Take careful notes', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), 2, 3); return 'You learned they are brilliant at history and terrible at sitting still.'; } },
      { label: 'Charm every teacher', tags: ['social'], run: (x) => { x.train('charm', 1); x.relMod(npcId(x), 2); return 'The art teacher said your child is "a free spirit". You chose to hear "genius".'; } },
      { label: 'Argue about a grade', tags: ['impulsive'], scene: 'argument', run: (x) => { x.relMod(npcId(x), -3); x.mods({ stress: 2 }); return 'You won the argument and lost your child\'s will to live.'; } },
    ],
  },
  {
    id: 'fa_sickChild', cat: 'family', minAge: 18, weight: 1, cooldown: 3, bind: bindKid(0, 10), scene: 'sick',
    title: 'A fever', text: (x) => `${babyName(x)} wakes up burning hot and floppy in the middle of the night.`,
    choices: [
      { label: 'Go straight to the doctor', tags: ['cautious'], scene: 'hospital', run: (x) => { x.spend(P(x, 100)); x.relMod(npcId(x), 4); return 'Just a virus. You slept in the chair beside the bed anyway.'; } },
      { label: 'Cool cloths and stories', tags: ['help'], run: (x) => { x.mods({ energy: -5 }); x.relMod(npcId(x), 6); return 'By morning the fever broke. They remembered your stories, not the illness.'; } },
      { label: 'Try a grandmother\'s remedy', run: (x) => { x.train('herbalism', 1); return 'Onion socks. Nobody knows why. It seemed to help, or the night did.'; } },
    ],
  },
  {
    id: 'fa_kidsFighting', cat: 'family', minAge: 22, weight: 1.2, cooldown: 3, when: (x) => kids(x, 4, 16).length >= 2, scene: 'fight',
    title: 'Sibling war', text: (x) => { const [a, b] = kids(x, 4, 16); return `${x.first(a)} and ${x.first(b)} are fighting over ${x.pick(['the remote', 'the front seat', 'a single biscuit', 'who looked at whom'])}. Again.`; },
    choices: [
      { label: 'Make them work it out', tags: ['cautious'], run: (x) => { for (const k of kids(x, 4, 16)) x.relMod(k.id, 1); return 'Twenty minutes of negotiation. Peace, briefly.'; } },
      { label: 'Confiscate the thing', tags: ['ambitious'], run: (x) => { x.mods({ discipline: 1 }); return 'United against you at last. A strange kind of victory.'; } },
      { label: 'Pick a side', tags: ['impulsive'], scene: 'argument', run: (x) => { const k = kids(x, 4, 16); x.relMod(k[0]?.id, 4); x.relMod(k[1]?.id, -6); return '"You always take their side." Now it was true.'; } },
    ],
  },
  {
    id: 'fa_favouriteChild', cat: 'family', minAge: 30, weight: 0.8, cooldown: 6, when: (x) => x.children().filter(alive).length >= 2, bind: bindKid(10, 60), scene: 'familyDinner',
    title: 'The favourite', text: (x) => `${babyName(x)} says, in front of everyone, that you have always had a favourite, and it isn't ${him(x)}.`,
    choices: [
      { label: 'Deny it warmly', tags: ['help'], run: (x) => { x.relMod(npcId(x), 3, 2); return 'A long hug. Nobody fully believed it, but everybody needed it.'; } },
      { label: 'Admit it, gently', tags: ['impulsive'], run: (x) => { x.relMod(npcId(x), -6, 4); x.mods({ wisdom: 2 }); return 'Honest, painful, and the start of a much better conversation.'; } },
      { label: 'Change the subject', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), -3); return '"Who wants pudding?" Classic. Ineffective. Delicious.'; } },
    ],
  },
  {
    id: 'fa_kidComesOut', cat: 'family', minAge: 30, weight: 0.5, once: true, bind: bindKid(14, 30), scene: 'family',
    title: 'Something to tell you', text: (x) => `${babyName(x)} sits you down, hands shaking, and tells you ${his(x)} heart belongs to someone of the same gender.`,
    choices: [
      { label: 'Hold them and say you love them', tags: ['help'], scene: 'reunion', run: (x) => { x.relMod(npcId(x), 15, 15); x.mods({ empathy: 4, karma: 4 }); return 'They cried with relief. You would remember their face for the rest of your life.'; } },
      { label: 'Ask for time to understand', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), -2, 2); x.mods({ wisdom: 2 }); return 'You read, listened and came back a month later with a hug. Better late than never.'; } },
      { label: 'Worry about their safety', run: (x) => { x.relMod(npcId(x), 4, 6); x.mods({ anxiety: 3 }); return 'Not what they feared to hear. You love them; you also know how the world can be.'; } },
    ],
  },
  {
    id: 'fa_teachKidDrive', cat: 'family', minAge: 33, years: [1925, 2080], weight: 1.2, once: true, bind: bindKid(16, 18), scene: 'car',
    title: 'Teaching them to drive', text: (x) => `${babyName(x)} is behind the wheel. You are gripping the door handle so hard it might come off.`,
    choices: [
      { label: 'Stay zen', tags: ['cautious'], scene: 'calm', run: (x) => { x.relMod(npcId(x), 6, 4); x.mods({ willpower: 2 }); return '"Mirror, signal, manoeuvre." You breathed. They passed first time.'; } },
      { label: 'Shout "BRAKE!"', tags: ['impulsive'], run: (x) => { x.relMod(npcId(x), -3); x.mods({ stress: 4 }); return 'There was nothing there. There was never anything there.'; } },
      { label: 'Pay for proper lessons', tags: ['ambitious'], run: (x) => { x.spend(P(x, 500)); return 'The instructor has a brake on his side. Wise man.'; } },
    ],
  },
  {
    id: 'fa_kidAsksMoney', cat: 'family', minAge: 40, weight: 1, cooldown: 4, bind: bindKid(18, 40), scene: 'moneyDown',
    title: 'The bank of Mum and Dad', text: (x) => `${babyName(x)} needs ${x.fmt(P(x, 3000))} for ${x.pick(['a deposit on a flat', 'a car that will "change everything"', 'a business idea', 'a wedding', 'an emergency they won\'t explain'])}.`,
    choices: [
      { label: 'Give it', tags: ['help'], run: (x) => { if (!x.spend(P(x, 3000))) { x.relMod(npcId(x), 2); return 'You didn\'t have it. You gave a hug and some very old advice.'; } x.relMod(npcId(x), 8, 4); return 'They promised to pay it back. You both knew that was a fairy tale.'; } },
      { label: 'Make it a loan', tags: ['cautious'], run: (x) => { if (!x.spend(P(x, 3000))) return 'Nothing to lend. They understood.'; x.relMod(npcId(x), 3, 4); if (x.chance(0.5)) { x.money(P(x, 3000)); return 'Paid back in full within a year. You were weirdly moved.'; } return 'Paid back in good intentions, mostly.'; } },
      { label: 'Say no', tags: ['ambitious'], run: (x) => { x.relMod(npcId(x), -6); return 'They found it elsewhere. And mentioned it at every family dinner since.'; } },
    ],
  },
];

// ------------------------------------------------------------------ grandchildren, adoption, fostering, blended families
const grandkids = (x: Ctx, lo: number, hi: number) => x.rels('grandchild').map((r) => x.npc(r.npcId)).filter((n): n is NPC => alive(n) && x.npcAge(n) >= lo && x.npcAge(n) <= hi);
const bindGrandkid = (lo: number, hi: number) => (x: Ctx) => { const g = grandkids(x, lo, hi); return g.length ? { npcId: x.pick(g).id } : null; };
const bindMeta = (key: string, lo = 0, hi = 120) => (x: Ctx) => {
  const r = x.rels('child', 'parent').filter((q) => q.meta[key] && (() => { const n = x.npc(q.npcId); return n && x.npcAge(n) >= lo && x.npcAge(n) <= hi; })());
  return r.length ? { npcId: x.pick(r).npcId } : null;
};
const childless = (x: Ctx) => x.children().filter(alive).length === 0;
const GENERATIONS: EventDef[] = [
  {
    id: 'fa_grandchildBorn', cat: 'family', minAge: 38, weight: 1.6, cooldown: 4, bind: bindKid(20, 45), scene: 'birth',
    title: 'A grandchild', text: (x) => `${babyName(x)} calls from the hospital: you are a grandparent.`,
    choices: [
      { label: 'Rush to the hospital', tags: ['help'], scene: 'hospital', run: (x) => { const k = npcOf(x); if (!k) return 'Sadder news overtook the happy kind.'; const g = makeNpc(x, { age: 0, career: null, lastName: k.lastName, parentIds: [k.id], religionId: k.religionId }); k.childIds.push(g.id); linkNpcs(x, k.id, g.id, 'family'); x.addRel(g.id, 'grandchild', { affinity: 70, trust: 60 }); x.relMod(k.id, 6); x.mods({ happiness: 8 }); x.remember('fa_grandchild', `Grandchild ${g.firstName} was born`, 35, g.id); return `You held ${g.firstName} and suddenly understood your own parents completely.`; } },
      { label: 'Knit something', tags: ['cautious'], run: (x) => { const k = npcOf(x); if (!k) return 'Sadder news overtook the happy kind.'; const g = makeNpc(x, { age: 0, career: null, lastName: k.lastName, parentIds: [k.id], religionId: k.religionId }); k.childIds.push(g.id); linkNpcs(x, k.id, g.id, 'family'); x.addRel(g.id, 'grandchild', { affinity: 60, trust: 55 }); x.train('tailoring', 2); x.mods({ happiness: 6 }); return `A slightly lopsided blanket for little ${g.firstName}. It was used until it was rags.`; } },
      { label: 'Offer lots of advice', tags: ['impulsive'], run: (x) => { const k = npcOf(x); if (!k) return 'Sadder news overtook the happy kind.'; const g = makeNpc(x, { age: 0, career: null, lastName: k.lastName, parentIds: [k.id], religionId: k.religionId }); k.childIds.push(g.id); linkNpcs(x, k.id, g.id, 'family'); x.addRel(g.id, 'grandchild', { affinity: 60, trust: 50 }); x.relMod(k.id, -4); x.mods({ happiness: 6 }); return `"In my day..." You were gently shown the door. ${g.firstName} is perfect anyway.`; } },
    ],
  },
  {
    id: 'fa_babysitGrandkid', cat: 'family', minAge: 40, weight: 1.5, cooldown: 2, bind: bindGrandkid(1, 10), scene: 'playground',
    title: 'Babysitting duty', text: (x) => `You have ${who(x)} for the whole weekend. The parents left a three-page list of rules.`,
    choices: [
      { label: 'Follow every rule', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), 3); return 'Bedtime at seven, no sugar. Very dull. The parents were very grateful.'; } },
      { label: 'Ice cream for breakfast', tags: ['impulsive'], scene: 'party', run: (x) => { x.relMod(npcId(x), 10); x.mods({ happiness: 5 }); return 'A grandparent\'s house is a lawless paradise. As it should be.'; } },
      { label: 'Teach them something old', tags: ['help'], scene: 'gardening', run: (x) => { x.relMod(npcId(x), 7, 4); x.mods({ wisdom: 2 }); return `You taught ${him(x)} to ${x.pick(['plant beans', 'whistle with grass', 'play cards', 'bake scones'])}. It will outlive you.`; } },
    ],
  },
  {
    id: 'fa_grandkidStories', cat: 'family', minAge: 50, weight: 1.2, cooldown: 3, bind: bindGrandkid(5, 16), scene: 'grandparents',
    title: 'Tell me about the old days', text: (x) => `${who(x)} wants to know what life was like when you were little, back in ${fmtYear(x.year - x.age + 8)}.`,
    choices: [
      { label: 'Tell the truth', tags: ['social'], run: (x) => { x.relMod(npcId(x), 6, 4); x.mods({ wisdom: 2 }); return 'They could not believe you lived without any of it. You could barely believe it either.'; } },
      { label: 'Embellish wildly', tags: ['impulsive'], run: (x) => { x.relMod(npcId(x), 8); x.mods({ creativity: 3 }); return 'Wolves, a shipwreck and a duel with a postman. They will retell it at your funeral.'; } },
      { label: 'Show the photo album', tags: ['cautious'], scene: 'reading', run: (x) => { x.relMod(npcId(x), 5); return '"Is that YOU?" Yes. The hair was a choice.'; } },
    ],
  },
  {
    id: 'fa_spoilGrandkid', cat: 'family', minAge: 45, weight: 1, cooldown: 3, bind: bindGrandkid(3, 14), scene: 'shopping',
    title: 'Spoiling them', text: (x) => `${who(x)} has seen a very expensive toy and is looking at you with enormous eyes.`,
    choices: [
      { label: 'Buy it', tags: ['impulsive'], run: (x) => { x.spend(P(x, 120)); x.relMod(npcId(x), 8); const pa = npcOf(x)?.parentIds[0]; if (pa) x.relMod(pa, -3); return 'The parents gave you a look. Their child gave you a hug. Fair trade.'; } },
      { label: 'Make them earn it', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), 2, 3); return 'A month of helping in the garden, then the toy. They valued it more.'; } },
      { label: 'Give an old toy of yours', tags: ['help'], run: (x) => { x.relMod(npcId(x), 4); return `A battered ${x.pick(['tin soldier', 'teddy', 'spinning top', 'yo-yo'])} with history. They loved it more than the shiny one.`; } },
    ],
  },
  {
    id: 'fa_grandkidTech', cat: 'family', minAge: 55, years: [1990, 2300], weight: 1, cooldown: 4, bind: bindGrandkid(8, 25), scene: 'gadget',
    title: 'Tech support', text: (x) => `${who(x)} is patiently showing you how to ${x.year < 2010 ? 'send an email' : x.year < 2060 ? 'make a video call' : 'stop the house AI ordering soup'} for the fourth time.`,
    choices: [
      { label: 'Take notes', tags: ['cautious'], run: (x) => { x.mods({ smarts: 1 }); x.relMod(npcId(x), 3); return 'A laminated card by the device. You mastered it. Mostly.'; } },
      { label: 'Pretend to understand', run: (x) => { x.relMod(npcId(x), 1); return 'You nodded. You did not understand. Next week, round five.'; } },
      { label: 'Pay them in biscuits', tags: ['social'], run: (x) => { x.relMod(npcId(x), 6); return 'A beautiful arrangement. Unlimited support for unlimited shortbread.'; } },
    ],
  },
  {
    id: 'fa_teenGrandkid', cat: 'family', minAge: 55, weight: 0.8, cooldown: 4, bind: bindGrandkid(14, 19), scene: 'lonely',
    title: 'They don\'t visit', text: (x) => `${who(x)} is a teenager now and visits have become rare and short.`,
    choices: [
      { label: 'Send a card with money', tags: ['help'], scene: 'loveLetter', run: (x) => { x.spend(P(x, 50)); x.relMod(npcId(x), 4); return 'A text came back: "thx gran/grandad ❤️". You printed it.'; } },
      { label: 'Invite them for a skill', tags: ['social'], run: (x) => { x.relMod(npcId(x), 7, 5); return `You offered to teach ${him(x)} ${x.pick(['to drive', 'poker', 'to fix an engine', 'your famous recipe'])}. They came every Sunday.`; } },
      { label: 'Let them be young', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 2, loneliness: 2 }); return 'They\'ll come back around. They always do.'; } },
    ],
  },
  {
    id: 'fa_greatGrandchild', cat: 'family', minAge: 65, weight: 2, once: true, bind: bindGrandkid(20, 45), scene: 'grandparents',
    title: 'Four generations', text: (x) => `${who(x)} has had a baby. Someone takes a photo of four generations on one sofa.`,
    choices: [
      { label: 'Hold the baby', tags: ['help'], run: (x) => { x.mods({ happiness: 10 }); x.remember('fa_greatGrand', 'Met a great-grandchild', 40); return 'Tiny fingers round your old one. Some circles close beautifully.'; } },
      { label: 'Give a speech', tags: ['social'], scene: 'familyDinner', run: (x) => { x.mods({ happiness: 7 }); x.train('publicSpeaking', 1); return 'You meant to say a few words. It was twenty minutes. Nobody minded.'; } },
      { label: 'Write the baby a letter', tags: ['cautious'], scene: 'loveLetter', run: (x) => { x.mods({ wisdom: 3, happiness: 5 }); return '"To be opened when you are grown." Sealed and kept in the family Bible.'; } },
    ],
  },
  {
    id: 'fa_infertility', cat: 'family', minAge: 26, maxAge: 45, once: true, weight: 0.8,
    when: (x) => !!x.lover() && childless(x) && !expecting(x) && x.c.eventHistory['fa_pregnancyNews'] === undefined, scene: 'calm',
    title: 'Still waiting', text: 'Another month, another quiet disappointment. You have been hoping for a baby for a long time now.',
    choices: [
      { label: 'See a specialist', tags: ['cautious'], scene: 'checkup', run: (x) => { x.spend(P(x, 500)); x.mods({ anxiety: 2 }); x.mod('fertility', 8); x.remember('fa_infertility', 'Struggled to have a baby', 35); return 'Tests, charts, kind doctors. Answers, or at least a plan.'; } },
      { label: 'Hold each other', tags: ['help'], scene: 'makeup', run: (x) => { const l = x.lover(); if (l) x.relMod(l.npcId, 8, 8); x.mods({ depression: -2, stress: -3 }); x.remember('fa_infertility', 'Struggled to have a baby', 35); return 'You cried, then laughed about something silly. Whatever happens, you have each other.'; } },
      { label: 'Think about adoption', tags: ['social'], run: (x) => { x.remember('fa_infertility', 'Struggled to have a baby', 35); x.queue('fa_adoptionCall'); return 'You picked up a leaflet. It sat on the fridge, glowing, for a week.'; } },
    ],
  },
  {
    id: 'fa_fertilityTreatment', cat: 'family', minAge: 26, maxAge: 47, years: [1980, 2300], once: true, weight: 2,
    when: (x) => x.hasMemory('fa_infertility') && !!x.lover() && childless(x) && !expecting(x), scene: 'checkup',
    title: 'Fertility treatment', text: (x) => `The clinic says treatment could help. One round costs ${x.fmt(P(x, 12000))}, and there are no guarantees.`,
    choices: [
      { label: 'Try one round', tags: ['ambitious'], when: (x) => canConceive(x) === true, run: (x) => {
        if (!x.spend(P(x, 12000))) return 'You could not afford it this year. You held hands in the car park and drove home.';
        if (x.chance(0.45)) { x.setFlag('pregnantDue', x.age + 1); x.setFlag('babyOther', x.lover()?.npcId ?? ''); x.mods({ happiness: 10 }); return 'Two weeks of waiting. Then the call: it worked.'; }
        x.mods({ depression: 4, happiness: -4 }); return 'It didn\'t take this time. The nurse held your hand for a long minute.';
      } },
      { label: 'Explore a donor or surrogate', tags: ['social'], when: (x) => canConceive(x) !== true && x.year >= 1990, scene: 'birth', run: (x) => {
        if (!x.spend(P(x, 30000))) return 'The cost is impossible right now. You keep the folder anyway.';
        const k = birthChild(x, x.lover()?.npcId); return `A long road, lots of paperwork, a lot of kindness from strangers. Then ${k.firstName} arrived.`;
      } },
      { label: 'Decide your family is already whole', tags: ['cautious'], scene: 'romance', run: (x) => { const l = x.lover(); if (l) x.relMod(l.npcId, 6, 6); x.mods({ wisdom: 4, stress: -4 }); return 'You chose each other, and a life with room in it. It turned out to be a good one.'; } },
    ],
  },
  {
    id: 'fa_adoptionCall', cat: 'family', minAge: 21, years: [1850, 2300], weight: 0.25, cooldown: 8,
    when: (x) => x.age >= 25 && x.children().filter(alive).length < 3 && !poor(x), scene: 'family',
    title: 'Room for one more', text: 'An adoption agency calls. There is a child who needs a family, and your file is on the desk.',
    choices: [
      { label: 'Adopt', tags: ['help'], scene: 'reunion', run: (x) => adopt(x) },
      { label: 'Offer to foster first', tags: ['cautious'], run: (x) => { x.queue('fa_fosterArrives'); return 'You signed up for training. The house felt like it was holding its breath.'; } },
      { label: 'Not right now', run: (x) => { x.mods({ wisdom: 1 }); return 'You said no, kindly. You thought about that child for a long time.'; } },
    ],
  },
  {
    id: 'fa_fosterArrives', cat: 'family', minAge: 25, years: [1900, 2300], weight: 0.3, cooldown: 6, scene: 'moving',
    title: 'A foster placement', text: 'A social worker on your doorstep at 9pm with a sleepy child and one small backpack.',
    choices: [
      { label: 'Take them in', tags: ['help'], run: (x) => { const k = makeNpc(x, { age: x.int(3, 13), career: null }); x.addRel(k.id, 'child', { affinity: 35, trust: 25, meta: { foster: true } }); x.mods({ karma: 6, stress: 4 }); x.remember('fa_foster', `Fostered ${k.firstName}`, 35, k.id); return `${k.firstName} ate two bowls of cereal and fell asleep in their coat. Day one.`; } },
      { label: 'Respite weekend only', tags: ['cautious'], run: (x) => { x.mods({ karma: 3, empathy: 2 }); return 'Two days of pancakes and board games. They waved from the car window.'; } },
      { label: 'You can\'t right now', run: (x) => { x.mods({ wisdom: 1 }); return 'The social worker understood. Someone else said yes that night.'; } },
    ],
  },
  {
    id: 'fa_fosterDecision', cat: 'family', minAge: 25, weight: 2, once: true, bind: bindMeta('foster', 0, 17), scene: 'court',
    title: 'Forever?', text: (x) => `${who(x)} has been with you for a while. The court asks whether you would adopt ${him(x)} permanently.`,
    choices: [
      { label: 'Yes. Forever.', tags: ['help'], scene: 'reunion', run: (x) => { const r = x.rel(npcId(x)); if (r) { r.meta.adopted = true; delete r.meta.foster; } const n = npcOf(x); if (n) n.lastName = x.c.lastName; x.relMod(npcId(x), 15, 15); x.mods({ happiness: 8 }); return `${who(x)} asked, very quietly, if this meant you couldn't give them back. "Never," you said.`; } },
      { label: 'Support reunification', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), 4, 6); x.mods({ karma: 4, empathy: 3 }); return 'They went home to a parent who had fought hard to get well. You stayed in their life as an aunt-or-uncle figure.'; } },
      { label: 'Ask them what they want', tags: ['social'], run: (x) => { x.relMod(npcId(x), 8, 10); const r = x.rel(npcId(x)); if (r && x.chance(0.6)) { r.meta.adopted = true; delete r.meta.foster; return 'They chose you. You have never been chosen like that before.'; } return 'They wanted to try home again. You helped them pack and promised to call.'; } },
    ],
  },
  {
    id: 'fa_adoptedQuestions', cat: 'family', minAge: 25, weight: 1.5, once: true, bind: bindMeta('adopted', 7, 25), scene: 'family',
    title: 'Where did I come from?', text: (x) => `${who(x)} wants to know about ${his(x)} birth family.`,
    choices: [
      { label: 'Tell them everything you know', tags: ['help'], run: (x) => { x.relMod(npcId(x), 6, 10); return 'Not much, but all of it honest. They thanked you for never hiding it.'; } },
      { label: 'Help them search', tags: ['social'], run: (x) => { x.spend(P(x, 200)); x.relMod(npcId(x), 8, 8); x.queue('fa_birthParentContact', { npcId: npcId(x) }); return 'Archives, forms, a long wait. You did it together.'; } },
      { label: 'Ask them to wait until they\'re older', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), -3, -3); return 'They agreed. They also started looking on their own.'; } },
    ],
  },
  {
    id: 'fa_birthParentContact', cat: 'family', minAge: 25, triggered: true, when: isAlive, scene: 'reunion',
    title: 'A letter from the past', text: (x) => `${who(x)}'s birth parent has written. They would like to meet.`,
    choices: [
      { label: 'Go with them', tags: ['help'], run: (x) => { x.relMod(npcId(x), 10, 8); x.mods({ empathy: 4 }); return 'Two strangers with the same nose. You held the coffee and the silence.'; } },
      { label: 'Let them go alone', tags: ['cautious'], run: (x) => { x.mods({ anxiety: 3 }); x.relMod(npcId(x), 4, 6); return 'They came home and hugged you hard. "You\'re still my parent," they said, unprompted.'; } },
      { label: 'Feel threatened', tags: ['impulsive'], scene: 'jealousy', run: (x) => { x.relMod(npcId(x), -6, -4); return 'You said something you regretted for a year. Love is not a pie, it turns out.'; } },
    ],
  },
  {
    id: 'fa_stepkidMeet', cat: 'family', minAge: 22, weight: 1.5, once: true,
    bind: (x) => { const l = x.lover(); const n = x.npc(l?.npcId); if (!n) return null; const sk = n.childIds.map((id) => x.npc(id)).filter((k): k is NPC => alive(k) && !x.rel(k.id) && x.npcAge(k) < 18); return sk.length ? { npcId: sk[0].id } : null; }, scene: 'familyDinner',
    title: 'Your partner\'s kid', text: (x) => `Your partner's ${sonOr(x)}, ${who(x)}, ${ageOf(x)}, is coming to live with you part-time. ${who(x)} has crossed arms and a stare that could strip paint.`,
    choices: [
      { label: 'Go slow', tags: ['cautious'], run: (x) => { x.addRel(npcId(x), 'child', { affinity: 35, trust: 30, meta: { step: true } }); return 'No pressure, no "call me Mum/Dad". Just pancakes on Saturdays. The stare softened.'; } },
      { label: 'Find a shared hobby', tags: ['social'], scene: 'gaming', run: (x) => { x.addRel(npcId(x), 'child', { affinity: 50, trust: 40, meta: { step: true } }); return 'You discovered you both love terrible horror films. An alliance formed.'; } },
      { label: 'Lay down house rules', tags: ['ambitious'], scene: 'argument', run: (x) => { x.addRel(npcId(x), 'child', { affinity: 20, trust: 20, meta: { step: true } }); const l = x.lover(); if (l) x.relMod(l.npcId, -3); return '"You\'re not my parent." The door slam shook a picture off the wall.'; } },
    ],
  },
  {
    id: 'fa_blendedHoliday', cat: 'family', minAge: 25, weight: 1.2, cooldown: 3, when: (x) => x.rels('child').some((r) => r.meta.step) && x.rels('child').some((r) => !r.meta.step), scene: 'familyDinner',
    title: 'Blended holidays', text: 'Your kids, their kids, two exes\' schedules and one turkey. Planning the holidays requires a spreadsheet.',
    choices: [
      { label: 'Host everyone', tags: ['social'], run: (x) => { for (const k of x.children()) x.relMod(k.id, 4); x.mods({ stress: 4 }); return 'Chaos, crackers and one magical moment when the kids all ganged up on you in a snowball fight.'; } },
      { label: 'Alternate years', tags: ['cautious'], run: (x) => { x.mods({ stress: -2 }); return 'Fair, orderly and a little lonely every other December.'; } },
      { label: 'Start a new tradition', tags: ['help'], scene: 'picnic', run: (x) => { for (const k of x.children()) x.relMod(k.id, 6); x.mods({ happiness: 4 }); return 'A picnic on Boxing Day, rain or shine. It belonged to all of you.'; } },
    ],
  },
  {
    id: 'fa_scan', cat: 'family', minAge: 18, maxAge: 60, years: [1965, 2300], weight: 3, cooldown: 2, when: expecting, scene: 'pregnancy',
    title: 'The scan', text: 'A grainy black-and-white blob on the screen. A heartbeat, fast as a sparrow.',
    choices: [
      { label: 'Find out boy or girl', tags: ['impulsive'], run: (x) => { x.mods({ happiness: 4 }); return 'You started buying tiny clothes on the way home.'; } },
      { label: 'Keep it a surprise', tags: ['cautious'], run: (x) => { x.mods({ happiness: 3 }); return 'Yellow everything. Very neutral, very cheerful.'; } },
      { label: 'Cry at the heartbeat', tags: ['social'], run: (x) => { const l = x.lover(); if (l) x.relMod(l.npcId, 6, 4); x.mods({ happiness: 5 }); return 'The sonographer handed you tissues without looking up. She sees this a lot.'; } },
    ],
  },
  {
    id: 'fa_singleParent', cat: 'family', minAge: 18, weight: 1, cooldown: 4, when: (x) => !x.lover() && kids(x, 0, 12).length > 0, bind: bindKid(0, 12), scene: 'lonely',
    title: 'Doing it alone', text: (x) => `Work, dinner, homework, bath, bed, laundry. Just you and ${babyName(x)} against the world.`,
    choices: [
      { label: 'Ask friends for help', tags: ['social'], scene: 'friends', run: (x) => { x.mods({ stress: -4, loneliness: -3 }); return 'A rota of friends and a neighbour who does Tuesdays. A village after all.'; } },
      { label: 'Push through', tags: ['ambitious'], run: (x) => { x.mods({ resilience: 4, energy: -5, stress: 3 }); x.relMod(npcId(x), 4); return 'Exhausted and unbeaten. Your kid noticed. They always notice.'; } },
      { label: 'Take a night for yourself', tags: ['cautious'], scene: 'spa', run: (x) => { x.spend(P(x, 60)); x.mods({ stress: -6, happiness: 3 }); return 'A sitter, a bath, a book. You felt like a person again.'; } },
    ],
  },
  {
    id: 'fa_backToWork', cat: 'family', minAge: 20, years: [1950, 2300], weight: 1.2, once: true, when: (x) => x.employed, bind: bindKid(0, 1), scene: 'office',
    title: 'Back to work?', text: (x) => `Leave is ending. ${babyName(x)} is tiny, and your desk feels like another planet.`,
    choices: [
      { label: 'Go back full-time', tags: ['ambitious'], run: (x) => { x.mods({ professionalRep: 2, stress: 3 }); return 'You cried in the car park on day one and ran a meeting on day two.'; } },
      { label: 'Ask for part-time', tags: ['cautious'], scene: 'meeting', run: (x) => { x.mods({ happiness: 3 }); return x.chance(0.6) ? 'They said yes. Best of both, mostly.' : 'They said no. You made it work anyway, somehow.'; } },
      { label: 'Stay home a while', tags: ['help'], scene: 'family', run: (x) => { x.relMod(npcId(x), 6); x.mods({ happiness: 3, loneliness: 2 }); return 'Long days, small victories. You saw every first.'; } },
    ],
  },
  {
    id: 'fa_familyHoliday', cat: 'family', minAge: 25, weight: 1, cooldown: 3, when: hasKid(3, 16), scene: 'beach',
    title: 'Family holiday', text: (x) => (x.year >= 1950 ? 'A week by the sea. The car is packed to the roof and someone needs the toilet already.' : 'A rare week at the coast in a rented cottage, the whole brood in tow.'),
    choices: [
      { label: 'Plan every day', tags: ['cautious'], run: (x) => { x.spend(P(x, 800)); for (const k of x.children()) x.relMod(k.id, 3); return 'An itinerary, laminated. The children mutinied by Wednesday.'; } },
      { label: 'Wing it', tags: ['impulsive'], scene: 'roadTrip', run: (x) => { x.spend(P(x, 600)); for (const k of x.children()) x.relMod(k.id, 5); return 'Rain, a wrong turn, and the best chip shop in the world. Perfect.'; } },
      { label: 'Stay home and camp in the garden', tags: ['help'], scene: 'camping', run: (x) => { for (const k of x.children()) x.relMod(k.id, 4); x.mods({ happiness: 3 }); return 'Free, ridiculous and fondly remembered by everyone.'; } },
    ],
  },
];

// ------------------------------------------------------------------ ageing parents
const oldParent = bindOldParent(65);
const ELDERS: EventDef[] = [
  {
    id: 'fa_parentForgetful', cat: 'family', minAge: 30, weight: 1, once: true, bind: bindOldParent(70), scene: 'dementia',
    title: 'Little lapses', text: (x) => `${ma(x)} has asked you the same question three times in one phone call and left the kettle on the hob again.`,
    choices: [
      { label: 'Book a doctor\'s appointment', tags: ['help'], scene: 'checkup', run: (x) => { x.relMod(npcId(x), 3, 4); x.chain('fa_chain_parentDecline', 1, { npcId: npcId(x) }); return `${ma(x)} grumbled all the way there. You held ${his(x)} hand in the waiting room anyway.`; } },
      { label: 'Laugh it off together', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), 2); x.chain('fa_chain_parentDecline', 2, { npcId: npcId(x) }); return '"Getting old," you both agreed. Neither of you quite believed it.'; } },
      { label: 'Call your siblings', tags: ['social'], when: (x) => x.rels('sibling').length > 0, run: (x) => { for (const r of x.rels('sibling')) x.relMod(r.npcId, 3, 3); x.chain('fa_chain_parentDecline', 1, { npcId: npcId(x) }); return 'The first family conference call in years. It would not be the last.'; } },
    ],
  },
  {
    id: 'fa_pd_diagnosis', cat: 'family', triggered: true, minAge: 18, when: isAlive, scene: 'checkup',
    title: 'The diagnosis', text: (x) => `The doctor uses a gentle voice and a long word. ${ma(x)}'s memory is going to keep slipping.`,
    choices: [
      { label: 'Learn everything you can', tags: ['cautious'], scene: 'library', run: (x) => { x.train('medicine', 1); x.mods({ stress: 3, wisdom: 2 }); return 'Books, leaflets, support groups. Knowledge made it a little less frightening.'; } },
      { label: 'Make memories while you can', tags: ['help'], scene: 'roadTrip', run: (x) => { x.relMod(npcId(x), 10, 6); x.spend(P(x, 500)); return `A trip back to where ${ma(x)} grew up. ${ma(x)} named every street.`; } },
      { label: 'Fall apart in the car park', run: (x) => { x.mods({ depression: 4, stress: 4 }); return 'Ten minutes of ugly crying behind the wheel. Then you went back in and smiled.'; } },
    ],
  },
  {
    id: 'fa_pd_care', cat: 'family', triggered: true, minAge: 18, when: isAlive, scene: 'nursingHome',
    title: 'Who will care?', text: (x) => `${ma(x)} can't live alone safely any more. Somebody has to decide.`,
    choices: [
      { label: 'Move them in with you', tags: ['help'], scene: 'moving', run: (x) => { x.relMod(npcId(x), 12, 8); x.mods({ stress: 8, karma: 5, energy: -5 }); x.setFlag('fa_parentLivesWithYou', npcId(x)); return 'A stairlift, a pill organiser, and your childhood stories told back to you every evening.'; } },
      { label: 'Choose a good care home', tags: ['cautious'], run: (x) => { const c = P(x, 20000); if (!x.spend(c)) { x.mods({ stress: 6 }); return 'The good ones cost a fortune. You found an okay one and visited every week.'; } x.relMod(npcId(x), 2, 2); x.mods({ stress: 2 }); return 'Bright rooms, kind staff. You still cried in the car every Sunday.'; } },
      { label: 'Leave it to your siblings', tags: ['impulsive'], when: (x) => x.rels('sibling').length > 0, scene: 'argument', run: (x) => { for (const r of x.rels('sibling')) x.relMod(r.npcId, -10, -8); x.mods({ karma: -4 }); return 'They took it on. They have not entirely forgiven you.'; } },
    ],
  },
  {
    id: 'fa_pd_lastTalk', cat: 'family', triggered: true, minAge: 18, when: isAlive, scene: 'calm',
    title: 'A good day', text: (x) => `For one afternoon ${ma(x)} is completely, startlingly clear, and knows exactly who you are.`,
    choices: [
      { label: 'Say everything', tags: ['social'], run: (x) => { x.relMod(npcId(x), 15, 10); x.mods({ wisdom: 5, depression: -3 }); x.remember('fa_lastTalk', `A last clear talk with ${who(x)}`, 50, npcId(x)); return `"I know," ${ma(x)} said, and patted your hand. "I always knew."`; } },
      { label: 'Ask the old questions', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 4 }); x.remember('fa_lastTalk', `A last clear talk with ${who(x)}`, 45, npcId(x)); return 'You finally learned the family secret about the missing uncle. It was funnier than expected.'; } },
      { label: 'Just sit together', tags: ['help'], scene: 'grandparents', run: (x) => { x.relMod(npcId(x), 10); x.mods({ stress: -6 }); x.remember('fa_lastTalk', `A last quiet afternoon with ${who(x)}`, 45, npcId(x)); return 'Tea, the radio, the light moving across the carpet. Enough.'; } },
    ],
  },
  {
    id: 'fa_parentFall', cat: 'family', minAge: 30, weight: 1, cooldown: 5, bind: bindOldParent(72), scene: 'hospital',
    title: 'A fall', text: (x) => `${ma(x)} has had a fall at home and lay on the kitchen floor for an hour before a neighbour heard.`,
    choices: [
      { label: 'Install an alarm and rails', tags: ['cautious'], run: (x) => { x.spend(P(x, 600)); x.relMod(npcId(x), 4, 4); return `${ma(x)} called it "fuss" and used the rails every single day.`; } },
      { label: 'Drive over every day', tags: ['help'], scene: 'car', run: (x) => { x.relMod(npcId(x), 8, 4); x.mods({ energy: -4, stress: 3 }); return 'Crosswords, soup, and a slow return to stubborn independence.'; } },
      { label: 'Raise the care-home question', run: (x) => { x.relMod(npcId(x), -5); return `"Over my dead body," said ${ma(x)}. The conversation was postponed.`; } },
    ],
  },
  {
    id: 'fa_movingParentIn', cat: 'family', minAge: 30, weight: 0.6, once: true, bind: oldParent, when: (x) => !x.flag('fa_parentLivesWithYou'), scene: 'moving',
    title: 'The spare room', text: (x) => `${ma(x)} is lonely since being widowed, and drops hints about your spare room with the subtlety of a brass band.`,
    choices: [
      { label: 'Invite them to move in', tags: ['help'], run: (x) => { x.setFlag('fa_parentLivesWithYou', npcId(x)); x.relMod(npcId(x), 10, 6); const l = x.lover(); if (l) x.relMod(l.npcId, -3); x.mods({ stress: 3 }); return `${ma(x)} reorganised your kitchen within a week. You found it oddly comforting.`; } },
      { label: 'Find a flat nearby', tags: ['cautious'], scene: 'house', run: (x) => { x.relMod(npcId(x), 5, 3); return 'Ten minutes away. Close enough for dinners, far enough for sanity.'; } },
      { label: 'Pretend not to notice', tags: ['impulsive'], run: (x) => { x.relMod(npcId(x), -4); x.mods({ karma: -2 }); return 'The hints grew louder. So did your guilt.'; } },
    ],
  },
  {
    id: 'fa_parentLivesWithYou', cat: 'family', minAge: 30, weight: 2, cooldown: 3, when: (x) => !!x.flag('fa_parentLivesWithYou') && alive(x.npc(String(x.flag('fa_parentLivesWithYou')))),
    bind: (x) => ({ npcId: String(x.flag('fa_parentLivesWithYou')) }), scene: 'familyDinner',
    title: 'Three generations, one roof', text: (x) => `${ma(x)} has opinions about your cooking, your parenting and your thermostat.`,
    choices: [
      { label: 'Let them run the kitchen', tags: ['cautious'], scene: 'cooking', run: (x) => { x.relMod(npcId(x), 6); x.train('cooking', 2); return 'You ate better than you had in years and learned the soup.'; } },
      { label: 'Set boundaries', tags: ['ambitious'], run: (x) => { x.relMod(npcId(x), -2, 3); x.mods({ stress: -2 }); return 'A calm talk and a sign on the thermostat. Peace, mostly.'; } },
      { label: 'Snap at them', tags: ['impulsive'], scene: 'argument', run: (x) => { x.relMod(npcId(x), -6); x.mods({ stress: 2 }); return 'You apologised that night. They had already forgiven you, and also told the neighbours.'; } },
    ],
  },
  {
    id: 'fa_nursingHomeVisit', cat: 'family', minAge: 30, weight: 0.8, cooldown: 3, bind: bindOldParent(78), scene: 'nursingHome',
    title: 'Sunday visit', text: (x) => `At the home, ${ma(x)} introduces you to the nurse as ${x.pick(['"my favourite"', '"the one who never calls"', '"my clever one"', 'someone else entirely'])}.`,
    choices: [
      { label: 'Bring the old photos', tags: ['help'], run: (x) => { x.relMod(npcId(x), 6); return 'Faces from 50 years ago, recognised instantly. Yesterday, less so.'; } },
      { label: 'Play their old music', tags: ['social'], scene: 'music', run: (x) => { x.relMod(npcId(x), 7); x.mods({ happiness: 2 }); return `${ma(x)} sang every word of a song from ${fmtYear(x.year - 60)}. The whole lounge joined in.`; } },
      { label: 'Keep it short', tags: ['cautious'], run: (x) => { x.mods({ stress: -1 }); x.relMod(npcId(x), 1); return 'Twenty minutes. You stood in the car park for ten more, not ready to drive.'; } },
    ],
  },
  {
    id: 'fa_oldLetters', cat: 'family', minAge: 30, weight: 0.8, once: true, when: (x) => x.c.relationships.some((r) => r.type === 'parent' && !x.npc(r.npcId)?.alive), scene: 'loveLetter',
    title: 'The letters', text: 'Clearing out the attic, you find a shoebox of letters your parents wrote each other long before you were born.',
    choices: [
      { label: 'Read them all', tags: ['impulsive'], run: (x) => { x.mods({ wisdom: 4, empathy: 3 }); x.remember('fa_letters', 'Found my parents\' old love letters', 30); return 'They were young, silly and wildly in love. You never knew them like this.'; } },
      { label: 'Read just one', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 2, happiness: 2 }); return '"Counting the days till Tuesday." You put the rest back, smiling.'; } },
      { label: 'Share them with the family', tags: ['social'], scene: 'familyDinner', run: (x) => { for (const r of x.rels('sibling', 'child')) x.relMod(r.npcId, 3); return 'Your siblings read them aloud at dinner. Laughter, then quiet, then more laughter.'; } },
    ],
  },
  {
    id: 'fa_parentDating', cat: 'family', minAge: 25, weight: 0.6, once: true, bind: oldParent, scene: 'date',
    title: (x) => `${ma(x)} has a date`, text: (x) => `${ma(x)}, widowed for years, announces a date with someone from ${x.pick(['the bowls club', 'the library', 'church', 'a dating site', 'dance class'])}.`,
    choices: [
      { label: 'Help them get ready', tags: ['help'], run: (x) => { x.relMod(npcId(x), 8, 6); return 'You did their collar and told them to be home by ten. Revenge is sweet.'; } },
      { label: 'Vet the date', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), -2, 2); return 'A thorough background check revealed a very nice retired postman.'; } },
      { label: 'Be weird about it', tags: ['impulsive'], run: (x) => { x.relMod(npcId(x), -4); return 'You sulked like a teenager. Roles reversed; nobody enjoyed it.'; } },
    ],
  },
  {
    id: 'fa_parentWill', cat: 'family', minAge: 30, weight: 0.6, once: true, bind: oldParent, scene: 'office',
    title: 'The will', text: (x) => `${ma(x)} wants to "talk about the will", and has made a list of who gets the good teapot.`,
    choices: [
      { label: 'Listen properly', tags: ['help'], run: (x) => { x.relMod(npcId(x), 6, 6); x.mods({ wisdom: 2 }); return 'Uncomfortable, important, and over with a cup of tea from the good teapot.'; } },
      { label: 'Ask for the house', tags: ['ambitious'], run: (x) => { x.relMod(npcId(x), -4); x.setFlag('fa_wantedHouse', true); return 'Your siblings heard about it by teatime.'; } },
      { label: '"Don\'t talk like that"', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), 2); return 'They let it drop. Later you wished you had listened.'; } },
    ],
  },
  {
    id: 'fa_parentScam', cat: 'family', minAge: 25, years: [1990, 2300], weight: 0.6, cooldown: 6, bind: bindOldParent(68), scene: 'hacker',
    title: 'A suspicious call', text: (x) => `${ma(x)} mentions a "very nice man from the bank" who needs ${his(x)} account details to fix a problem.`,
    choices: [
      { label: 'Rush over and stop it', tags: ['help'], scene: 'car', run: (x) => { x.relMod(npcId(x), 6, 6); return 'You arrived just as the details were being read out. A close one.'; } },
      { label: 'Set up safeguards', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), 3, 4); x.train('cybersecurity', 1); return 'Call blockers, a code word, and a sticky note: "BANKS NEVER ASK".'; } },
      { label: 'Get angry with them', tags: ['impulsive'], scene: 'argument', run: (x) => { x.relMod(npcId(x), -5, -2); return 'They felt foolish. Next time, they did not tell you.'; } },
    ],
  },
];

// ------------------------------------------------------------------ siblings, in-laws, feuds, secrets
const inLaw = bindRel('inLaw');
const KIN: EventDef[] = [
  {
    id: 'fa_meetInLaws', cat: 'family', minAge: 18, weight: 2, once: true, when: (x) => !!x.lover() && x.rels('inLaw').length === 0, scene: 'familyDinner',
    title: 'Meeting the in-laws', text: (x) => `Dinner with ${x.first(x.lover()!.npcId)}'s parents. The tablecloth is ironed. So is the silence.`,
    choices: [
      { label: 'Compliment the cooking', tags: ['social'], run: (x) => { const l = x.npc(x.lover()?.npcId); const n = relative(x, 'inLaw', (l ? x.npcAge(l) : x.age) + x.int(24, 34), 55, {}, l?.lastName); x.train('charm', 1); return `${n.firstName} glowed. You were offered seconds, the highest honour.`; } },
      { label: 'Talk politics', tags: ['impulsive'], scene: 'argument', run: (x) => { const l = x.npc(x.lover()?.npcId); const n = relative(x, 'inLaw', (l ? x.npcAge(l) : x.age) + x.int(24, 34), 25, {}, l?.lastName); return `${n.firstName} put down the gravy boat and said "I see". The temperature dropped ten degrees.`; } },
      { label: 'Help with the washing up', tags: ['help'], scene: 'cooking', run: (x) => { const l = x.npc(x.lover()?.npcId); const n = relative(x, 'inLaw', (l ? x.npcAge(l) : x.age) + x.int(24, 34), 60, {}, l?.lastName); return `You and ${n.firstName} bonded over a stubborn roasting tin. Allies.`; } },
    ],
  },
  {
    id: 'fa_inLawCriticism', cat: 'family', minAge: 20, weight: 1.2, cooldown: 3, bind: inLaw, scene: 'argument',
    title: 'Helpful suggestions', text: (x) => `${who(x)} has ${x.pick(['re-folded all your towels', 'suggested you might "try a little harder" with dinner', 'brought their own vacuum cleaner', 'given your child a haircut without asking'])}.`,
    choices: [
      { label: 'Smile and seethe', tags: ['cautious'], run: (x) => { x.mods({ stress: 4, willpower: 2 }); return 'Your jaw hurt from smiling. Your partner owes you dinner.'; } },
      { label: 'Say something', tags: ['impulsive'], run: (x) => { x.relMod(npcId(x), -8, -4); const l = x.lover(); if (l) x.relMod(l.npcId, -3); return 'A frosty silence, a slammed car door, and a ceasefire by Easter.'; } },
      { label: 'Ask their advice on purpose', tags: ['social'], run: (x) => { x.relMod(npcId(x), 8, 4); x.train('manipulation', 1); return 'Disarmed completely. They now think you are a genius for listening.'; } },
    ],
  },
  {
    id: 'fa_inLawLoan', cat: 'family', minAge: 22, weight: 0.6, cooldown: 6, bind: inLaw, scene: 'moneyDown',
    title: 'A family favour', text: (x) => `${who(x)} needs ${x.fmt(P(x, 2000))} for a roof repair and is too proud to ask directly. Your partner is asking for them.`,
    choices: [
      { label: 'Pay it quietly', tags: ['help'], run: (x) => { if (!x.spend(P(x, 2000))) return 'You couldn\'t. Your partner understood; their parent less so.'; x.relMod(npcId(x), 10, 6); const l = x.lover(); if (l) x.relMod(l.npcId, 5, 3); return 'They never mentioned it, but you got the best chair at every visit after.'; } },
      { label: 'Help fix it yourselves', tags: ['social'], scene: 'construction', run: (x) => { x.train('construction', 2); x.relMod(npcId(x), 6); return 'A weekend on a ladder. Your father-in-law supervised loudly.'; } },
      { label: 'Decline', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), -5); return 'The roof leaked. The atmosphere at dinner did too.'; } },
    ],
  },
  {
    id: 'fa_inLawHoliday', cat: 'family', minAge: 22, weight: 1, cooldown: 3, when: (x) => x.rels('inLaw').length > 0 && x.rels('parent').length > 0, scene: 'familyDinner',
    title: 'Whose turn is it?', text: 'Both sets of parents expect you for the holidays. Both are already hurt.',
    choices: [
      { label: 'Do both on one day', tags: ['ambitious'], scene: 'car', run: (x) => { x.mods({ stress: 5, health: -1 }); for (const r of x.rels('inLaw', 'parent')) x.relMod(r.npcId, 3); return 'Two dinners, three hundred miles. You did not eat again until March.'; } },
      { label: 'Host both families', tags: ['social'], run: (x) => { x.mods({ stress: 4 }); for (const r of x.rels('inLaw', 'parent')) x.relMod(r.npcId, x.chance(0.6) ? 4 : -3); return 'The mothers discovered a shared hatred of the same TV host. A miracle.'; } },
      { label: 'Go away somewhere, just you two', tags: ['impulsive'], scene: 'travel', when: (x) => !!x.lover(), run: (x) => { for (const r of x.rels('inLaw', 'parent')) x.relMod(r.npcId, -3); const l = x.lover()!; x.relMod(l.npcId, 6); return 'Sun, peace and two very long voicemails.'; } },
    ],
  },
  {
    id: 'fa_siblingFallout', cat: 'family', minAge: 25, weight: 0.6, once: true, bind: sib, scene: 'argument',
    title: 'The fallout', text: (x) => `An argument with ${who(x)} over ${x.pick(['an old debt', 'something said at a wedding', 'who did more for your parents', 'a business deal'])} turns ugly.`,
    choices: [
      { label: 'Walk out and stay out', tags: ['impulsive'], run: (x) => { x.relMod(npcId(x), -20, -15); x.chain('fa_chain_estrangement', 2, { npcId: npcId(x) }); return 'You stopped answering calls. Years can pass quickly like this.'; } },
      { label: 'Apologise first', tags: ['help'], scene: 'makeup', run: (x) => { x.relMod(npcId(x), 6, 4); x.mods({ ego: -2, wisdom: 2 }); return 'It cost you some pride. It saved you a sibling.'; } },
      { label: 'Let it cool off', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), -5); return 'Three weeks later, a birthday card. Nobody mentioned it again.'; } },
    ],
  },
  {
    id: 'fa_es_silence', cat: 'family', triggered: true, minAge: 18, when: isAlive, scene: 'lonely',
    title: 'Empty chair', text: (x) => `Another family gathering without ${who(x)}. Everyone avoids saying the name.`,
    choices: [
      { label: 'Ask how they\'re doing', tags: ['social'], run: (x) => { x.mods({ loneliness: 2 }); return `${who(x)} has a new job and a dog, you hear. You find you want to know the dog's name.`; } },
      { label: 'Insist you\'re fine', tags: ['cautious'], run: (x) => { x.mods({ ego: 2, loneliness: 3 }); return 'You were fine. Mostly. Except at birthdays.'; } },
      { label: 'Call them', tags: ['help'], scene: 'reunion', run: (x) => { x.relMod(npcId(x), 15, 10); x.endChain('fa_chain_estrangement'); return 'It rang twice. "Hello?" Both of you cried before anyone said anything useful.'; } },
    ],
  },
  {
    id: 'fa_es_letter', cat: 'family', triggered: true, minAge: 18, when: isAlive, scene: 'loveLetter',
    title: 'A letter', text: (x) => `After years of silence, a letter in ${who(x)}'s handwriting. It is long.`,
    choices: [
      { label: 'Write back', tags: ['help'], run: (x) => { x.relMod(npcId(x), 10, 6); return 'Your reply took four drafts. The fifth was short and honest.'; } },
      { label: 'Read it, keep it, wait', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 2 }); return 'You read it twenty times. It lives in your bedside drawer.'; } },
      { label: 'Burn it unread', tags: ['impulsive'], scene: 'fire', run: (x) => { x.relMod(npcId(x), -10); x.mods({ depression: 2 }); x.endChain('fa_chain_estrangement'); return 'The paper curled and went. You never found out what it said.'; } },
    ],
  },
  {
    id: 'fa_es_reunion', cat: 'family', triggered: true, minAge: 18, when: isAlive, scene: 'reunion',
    title: 'Same café, years later', text: (x) => `You and ${who(x)} meet in a café. You both look older. You both order the same thing.`,
    choices: [
      { label: 'Hug first', tags: ['social'], run: (x) => { x.relMod(npcId(x), 25, 20); x.mods({ happiness: 8 }); x.remember('fa_reconciled', `Reconciled with ${who(x)} after years apart`, 45, npcId(x)); return 'A long hug in the doorway, blocking everyone. Nobody minded.'; } },
      { label: 'Talk it all through', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), 18, 18); x.mods({ wisdom: 4 }); x.remember('fa_reconciled', `Reconciled with ${who(x)}`, 40, npcId(x)); return 'Three hours, two pots of tea. You both remembered the fight differently, and it no longer mattered.'; } },
      { label: 'Bring up the old fight', tags: ['impulsive'], scene: 'argument', run: (x) => { x.relMod(npcId(x), -5); return 'Ten minutes in, you were twelve years old again. Maybe next time.'; } },
    ],
  },
  {
    id: 'fa_inheritanceSquabble', cat: 'family', minAge: 25, weight: 1, once: true,
    when: (x) => x.rels('sibling').length > 0 && x.c.relationships.some((r) => r.type === 'parent' && !x.npc(r.npcId)?.alive), bind: sib, scene: 'court',
    title: 'Dividing it up', text: (x) => `The estate is being divided. You and ${who(x)} both want ${x.pick(['the house', 'the grandfather clock', 'the family ring', 'the allotment', 'Mum\'s recipe book'])}.`,
    choices: [
      { label: 'Let them have it', tags: ['help'], run: (x) => { x.relMod(npcId(x), 10, 8); x.mods({ karma: 4 }); return 'They were stunned. Years later, they gave it to your child.'; } },
      { label: 'Hire a lawyer', tags: ['ambitious'], run: (x) => { x.spend(P(x, 3000)); x.relMod(npcId(x), -20, -15); if (x.chance(0.5)) { x.money(P(x, 8000)); return 'You won. You also lost a sibling, at least for a while.'; } return 'You lost, and paid the fees. The clock ticks smugly in their hall.'; } },
      { label: 'Flip a coin', tags: ['impulsive'], run: (x) => { x.relMod(npcId(x), 2); return x.chance(0.5) ? 'Heads. You won, fair and square. Mostly square.' : 'Tails. Your sibling did a victory lap of the kitchen.'; } },
    ],
  },
  {
    id: 'fa_familyBusiness', cat: 'family', minAge: 18, maxAge: 45, weight: 0.6, once: true, when: (x) => hasParents(x) && !poor(x), bind: parentRel, scene: 'meeting',
    title: 'The family business', text: (x) => `${ma(x)} wants you to take over the family ${x.year < 1800 ? x.pick(['bakery', 'forge', 'inn', 'mill']) : x.pick(['shop', 'restaurant', 'garage', 'printing firm', 'hardware store'])}.`,
    choices: [
      { label: 'Take it on', tags: ['ambitious'], run: (x) => { x.relMod(npcId(x), 12, 8); x.train('management', 3); x.money(P(x, 5000)); x.setFlag('fa_familyBusiness', true); return 'Your name on the sign under theirs. It felt heavier than you expected.'; } },
      { label: 'Decline kindly', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), -6); return '"Your grandfather started this," they said. You knew. That was the problem.'; } },
      { label: 'Suggest selling it', tags: ['impulsive'], scene: 'moneyUp', run: (x) => { x.relMod(npcId(x), -10, -5); return 'They went pale, then quiet, then said they would "think about it". They are still thinking.'; } },
    ],
  },
  {
    id: 'fa_familyBusinessFight', cat: 'family', minAge: 20, weight: 1.2, cooldown: 4, when: (x) => !!x.flag('fa_familyBusiness'), bind: (x) => bindRel('sibling', 'parent', 'child')(x), scene: 'meeting',
    title: 'Board meeting', text: (x) => `${who(x)} thinks the family business should ${x.pick(['go online', 'expand', 'fire Uncle Bob', 'change the logo', 'open on Sundays'])}. You disagree.`,
    choices: [
      { label: 'Compromise', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), 3, 3); x.train('negotiation', 1); return 'A trial run. It half worked, which was enough for everyone to claim credit.'; } },
      { label: 'Pull rank', tags: ['ambitious'], run: (x) => { x.relMod(npcId(x), -7); x.money(P(x, 1000)); return 'You were right, profits rose, and Christmas was frosty.'; } },
      { label: 'Try their way', tags: ['help'], run: (x) => { x.relMod(npcId(x), 7, 5); if (x.chance(0.5)) { x.money(P(x, 2000)); return 'It worked. You were glad to be wrong.'; } x.money(-P(x, 1000)); return 'It flopped. You did not say "I told you so". Out loud.'; } },
    ],
  },
  {
    id: 'fa_dnaTest', cat: 'family', minAge: 20, years: [2012, 2300], weight: 0.5, once: true, scene: 'lab',
    title: 'The DNA kit', text: 'A home DNA kit as a gift. You spit in a tube, mail it off and forget about it until an email arrives.',
    choices: [
      { label: 'Open the matches', tags: ['impulsive'], run: (x) => {
        if (x.chance(0.4)) { const n = relative(x, 'sibling', x.age + x.int(-12, 12), 30, { half: true }); n.lastName = x.pick([n.lastName, 'Doe', 'Morrow', 'Lindqvist', 'Okafor']); x.remember('fa_halfSibling', `Discovered a half-sibling, ${n.firstName}`, 45, n.id); x.secret('fa_halfSibling', `A parent had a secret child, ${n.firstName}`, 30); return `"Close family match: half-sibling." Someone called ${n.firstName}, living two hours away.`; }
        x.mods({ happiness: 2 }); return `You are ${x.int(2, 9)}% something unexpected and related to a minor ${x.pick(['baron', 'pirate', 'poet', 'horse thief'])}.`;
      } },
      { label: 'Only read the ancestry map', tags: ['cautious'], run: (x) => { x.train('history', 1); return 'Colourful blobs across the continents. You bought a cookbook for each.'; } },
      { label: 'Delete the email', tags: ['cautious'], run: (x) => { x.mods({ paranoia: 1 }); return 'Some doors are better left closed. You will wonder forever.'; } },
    ],
  },
  {
    id: 'fa_halfSibMeet', cat: 'family', minAge: 20, weight: 3, once: true, bind: (x) => { const r = x.rels('sibling').filter((q) => q.meta.half); return r.length ? { npcId: r[0].npcId } : null; }, scene: 'reunion',
    title: 'The half-sibling', text: (x) => `You meet ${who(x)} for the first time. Same laugh. Same terrible habit of cracking knuckles.`,
    choices: [
      { label: 'Embrace it', tags: ['social'], run: (x) => { x.relMod(npcId(x), 20, 10); x.mods({ happiness: 5 }); return 'A sibling you never knew you had. You have a lot of birthdays to catch up on.'; } },
      { label: 'Confront your parent', tags: ['impulsive'], when: hasParents, scene: 'argument', run: (x) => { for (const p of x.aliveParents()) x.relMod(p.id, -10, -15); x.mods({ trauma: 2 }); return 'The truth came out in pieces, over a long and painful evening.'; } },
      { label: 'Keep it at arm\'s length', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), 3); return 'Christmas cards, the occasional coffee. Maybe that is enough.'; } },
    ],
  },
  {
    id: 'fa_familySecret', cat: 'family', minAge: 16, weight: 0.5, once: true, when: (x) => x.rels('parent', 'grandparent', 'sibling').length > 0, scene: 'scandal',
    title: 'Hush', text: (x) => `At a funeral, an elderly aunt lets something slip: ${x.pick(['Grandpa was married before', 'the family fortune began with smuggling', 'your parents eloped', 'there was a baby given away in the 50s', 'your surname was changed at the border'])}.`,
    choices: [
      { label: 'Dig deeper', tags: ['ambitious'], scene: 'library', run: (x) => { x.train('history', 2); x.mods({ smarts: 1, paranoia: 1 }); return 'Archives, old ledgers, one bewildering photograph. The story was stranger than the rumour.'; } },
      { label: 'Ask the family directly', tags: ['social'], scene: 'familyDinner', run: (x) => { for (const r of x.rels('parent', 'grandparent')) x.relMod(r.npcId, x.chance(0.5) ? 4 : -4, 2); return 'A long silence, then the whole story, then wine. A strange, good night.'; } },
      { label: 'Let sleeping dogs lie', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 2 }); return 'Every family has a cupboard. You left this one closed.'; } },
    ],
  },
  {
    id: 'fa_siblingWedding', cat: 'family', minAge: 18, weight: 0.8, cooldown: 5, bind: (x) => { const r = x.rels('sibling').filter((q) => { const n = x.npc(q.npcId); return n && x.npcAge(n) >= 20 && x.npcAge(n) <= 45; }); return r.length ? { npcId: x.pick(r).npcId } : null; }, scene: 'wedding',
    title: 'Sibling\'s wedding', text: (x) => `${who(x)} is getting married and you have been asked to give a speech.`,
    choices: [
      { label: 'Write a heartfelt speech', tags: ['help'], run: (x) => { x.relMod(npcId(x), 10, 4); x.train('publicSpeaking', 2); return 'Half the room cried. The other half was about to.'; } },
      { label: 'Roast them', tags: ['impulsive'], run: (x) => { x.relMod(npcId(x), x.chance(0.6) ? 6 : -8); x.train('comedy', 2); return x.chance(0.5) ? 'Huge laughs. The story about the haunted canoe killed.' : 'One joke too far. The bride\'s grandmother left.'; } },
      { label: 'Keep it short', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), 3); return 'Ninety seconds, one joke, a toast. The caterers adored you.'; } },
    ],
  },
  {
    id: 'fa_siblingRivalryAdult', cat: 'family', minAge: 22, weight: 0.8, cooldown: 5, bind: sib, scene: 'jealousy',
    title: 'The golden child', text: (x) => `At dinner your parents brag about ${who(x)}'s ${x.pick(['promotion', 'new house', 'perfect children', 'marathon time'])} for the fortieth minute.`,
    choices: [
      { label: 'Congratulate them sincerely', tags: ['help'], run: (x) => { x.relMod(npcId(x), 6, 3); x.mods({ wisdom: 2 }); return 'They pulled you aside after: "They brag about you to me, you know."'; } },
      { label: 'Announce your own news', tags: ['ambitious'], run: (x) => { x.mods({ ego: 2 }); x.relMod(npcId(x), -3); return 'An arms race of achievements. Dessert went cold.'; } },
      { label: 'Excuse yourself early', tags: ['cautious'], scene: 'lonely', run: (x) => { x.mods({ loneliness: 2 }); return 'You drove home in silence and felt eight years old.'; } },
    ],
  },
  {
    id: 'fa_siblingCrisis', cat: 'family', minAge: 20, weight: 0.8, cooldown: 5, bind: sib, scene: 'calm',
    title: 'A call at midnight', text: (x) => `${who(x)} calls at midnight. ${x.pick(['Their marriage is over', 'They have lost their job', 'They are in hospital', 'They need somewhere to stay'])}.`,
    choices: [
      { label: 'Drive over now', tags: ['help'], scene: 'car', run: (x) => { x.relMod(npcId(x), 12, 10); x.mods({ energy: -3, karma: 3 }); return 'You were there by one. You did not say anything clever. You did not need to.'; } },
      { label: 'Talk them through it', tags: ['social'], run: (x) => { x.relMod(npcId(x), 7, 6); x.train('empathyListening', 2); return 'Two hours on the phone. The worst of it passed.'; } },
      { label: 'Send money', tags: ['cautious'], run: (x) => { x.spend(P(x, 500)); x.relMod(npcId(x), 4); return 'Practical, useful, and slightly not what they needed.'; } },
    ],
  },
  {
    id: 'fa_familyReunion', cat: 'family', minAge: 25, weight: 0.6, cooldown: 8, scene: 'picnic',
    title: 'The family reunion', text: (x) => `Matching T-shirts, a marquee, and ${x.int(40, 140)} people who all share your nose.`,
    choices: [
      { label: 'Organise the games', tags: ['social'], scene: 'sports', run: (x) => { x.mods({ popularity: 3, happiness: 4 }); x.train('leadership', 1); return 'A three-legged race with your 80-year-old great-uncle. You lost; he gloated.'; } },
      { label: 'Build the family tree', tags: ['cautious'], run: (x) => { x.train('history', 2); x.mods({ wisdom: 2 }); return 'Four hundred names on one big sheet. Someone was definitely a pirate.'; } },
      { label: 'Hide by the buffet', tags: ['impulsive'], scene: 'restaurant', run: (x) => { x.mods({ happiness: 2, health: -1 }); return 'Seven sausage rolls and three awkward conversations with strangers who knew your nappy size.'; } },
    ],
  },
];

// ------------------------------------------------------------------ more of the whole life
const deadKin = (x: Ctx, type: 'grandparent' | 'parent') => x.c.relationships.some((r) => r.type === type && x.npc(r.npcId)?.alive === false);
const MORE: EventDef[] = [
  {
    id: 'fa_grandparentsSummer', cat: 'childhood', minAge: 5, maxAge: 13, weight: 0.9, cooldown: 4, bind: bindRel('grandparent'), scene: 'farm',
    title: 'Summer at Gran\'s', text: (x) => `You are packed off to ${who(x)}'s for the summer: no ${x.year >= 1990 ? 'internet' : 'television'}, a lot of fresh air, and very early bedtimes.`,
    choices: [
      { label: 'Help in the garden', tags: ['help'], scene: 'gardening', run: (x) => { x.train('farming', 2); x.relMod(npcId(x), 6, 4); return 'You grew one enormous marrow and were unreasonably proud.'; } },
      { label: 'Explore the woods', tags: ['impulsive'], scene: 'hiking', run: (x) => { x.mods({ fitness: 2, riskTolerance: 2, happiness: 3 }); return 'A den, a stream, and a ruined wall you were certain was a castle.'; } },
      { label: 'Read their old books', tags: ['cautious'], scene: 'reading', run: (x) => { x.mods({ smarts: 3 }); x.relMod(npcId(x), 3); return 'Dusty adventure novels with notes in the margins from when they were your age.'; } },
    ],
  },
  {
    id: 'fa_siblingClub', cat: 'childhood', minAge: 5, maxAge: 12, weight: 0.8, once: true, bind: sib, scene: 'camping',
    title: 'The secret club', text: (x) => `You and ${who(x)} start a secret club with a password, a den and very strict membership rules.`,
    choices: [
      { label: 'Let the neighbours join', tags: ['social'], scene: 'friends', run: (x) => { x.mods({ popularity: 3 }); x.relMod(npcId(x), 3); return 'Membership swelled to six. Then came the great schism over biscuits.'; } },
      { label: 'Keep it just you two', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), 8, 6); return 'You still remember the password. So do they.'; } },
      { label: 'Declare yourself president', tags: ['ambitious'], run: (x) => { x.relMod(npcId(x), -3); x.train('leadership', 1); return 'A coup within the week. History repeats.'; } },
    ],
  },
  {
    id: 'fa_parentJobLoss', cat: 'childhood', minAge: 7, maxAge: 17, weight: 0.5, once: true, bind: parentRel, scene: 'fired',
    title: 'Hard times', text: (x) => `${ma(x)} has lost ${his(x)} job. The house goes quiet in a new way, and dinners get simpler.`,
    choices: [
      { label: 'Offer your savings', tags: ['help'], run: (x) => { x.relMod(npcId(x), 10, 8); x.mods({ empathy: 3 }); return `${ma(x)} refused, then hugged you so hard your ribs creaked.`; } },
      { label: 'Stop asking for things', tags: ['cautious'], run: (x) => { x.mods({ discipline: 3, anxiety: 2 }); return 'You grew up a little that year, in ways nobody asked you to.'; } },
      { label: 'Get a paper round', tags: ['ambitious'], when: (x) => x.age >= 11, run: (x) => { x.money(P(x, 100)); x.mods({ discipline: 2, fitness: 1 }); return 'Up at six, every day, rain or shine. You put half in the biscuit tin.'; } },
    ],
  },
  {
    id: 'fa_heightChart', cat: 'childhood', minAge: 3, maxAge: 11, weight: 0.8, once: true, when: hasParents, scene: 'family',
    title: 'Pencil marks', text: 'Every birthday a pencil line on the kitchen doorframe. You are trying to cheat by standing on tiptoe.',
    choices: [
      { label: 'Stand on tiptoe', tags: ['impulsive'], run: (x) => { x.mods({ happiness: 2 }); return 'Your mark says you grew four inches this year. Science disagrees.'; } },
      { label: 'Stand up straight', tags: ['cautious'], run: (x) => { x.mods({ discipline: 1 }); return 'Honest growth: one inch. Your parents dated it carefully.'; } },
      { label: 'Measure your parents too', tags: ['social'], run: (x) => { for (const p of x.aliveParents()) x.relMod(p.id, 3); return 'Everyone got a line, even the dog. The door was never painted again.'; } },
    ],
  },
  {
    id: 'fa_grandparentFuneral', cat: 'childhood', minAge: 6, maxAge: 17, weight: 2, once: true, when: (x) => deadKin(x, 'grandparent'), scene: 'funeral',
    title: 'Saying goodbye', text: 'Your first family funeral. Everyone speaks in low voices and someone keeps giving you sandwiches.',
    choices: [
      { label: 'Read a poem', tags: ['social'], scene: 'holy', run: (x) => { x.mods({ confidence: 3, wisdom: 3 }); return 'Your voice shook on the last line. The whole room held its breath with you.'; } },
      { label: 'Ask what happens now', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 2, faith: 2 }); return 'Each grown-up gave a different answer. You chose the kindest one.'; } },
      { label: 'Sit with your parent', tags: ['help'], run: (x) => { for (const p of x.aliveParents()) x.relMod(p.id, 6, 4); x.mods({ empathy: 3 }); return 'You held their hand. For once you were the one doing the comforting.'; } },
    ],
  },
  {
    id: 'fa_protectSibling', cat: 'teen', minAge: 12, maxAge: 17, weight: 0.8, cooldown: 4,
    bind: (x) => { const r = x.rels('sibling').filter((q) => { const n = x.npc(q.npcId); return n && x.npcAge(n) < x.age && x.npcAge(n) >= 6; }); return r.length ? { npcId: r[0].npcId } : null; }, scene: 'playground',
    title: 'Big sibling duty', text: (x) => `Some older kids are picking on ${who(x)} at the bus stop.`,
    choices: [
      { label: 'Step in calmly', tags: ['help'], run: (x) => { x.relMod(npcId(x), 10, 8); x.mods({ confidence: 3 }); return '"Leave it." They did. Your sibling followed you home like a duckling.'; } },
      { label: 'Square up', tags: ['violent'], scene: 'fight', run: (x) => { x.relMod(npcId(x), 8); x.mods({ aggression: 3, streetCred: 2 }); return x.chance(0.5) ? 'One shove and they scattered.' : 'A bloody nose, a detention, and a sibling who thinks you are a superhero.'; } },
      { label: 'Tell a teacher', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), 4, 4); return 'It got sorted properly. Less heroic, more effective.'; } },
    ],
  },
  {
    id: 'fa_phonesAtDinner', cat: 'teen', minAge: 13, maxAge: 17, years: [2008, 2300], weight: 1, cooldown: 3, when: hasParents, scene: 'familyDinner',
    title: 'The phone basket', text: 'Your parents have introduced a basket for phones at dinner. Yours is buzzing inside it like a trapped wasp.',
    choices: [
      { label: 'Accept the basket', tags: ['cautious'], run: (x) => { for (const p of x.aliveParents()) x.relMod(p.id, 4); return 'You actually talked. Your dad has a surprisingly good story about a goose.'; } },
      { label: 'Sneak a second phone', tags: ['impulsive'], run: (x) => { x.train('deception', 1); return 'Caught when it rang under the table. Both phones confiscated.'; } },
      { label: 'Make them put theirs in too', tags: ['social'], run: (x) => { x.mods({ confidence: 2 }); for (const p of x.aliveParents()) x.relMod(p.id, 2, 2); return 'Your mum lasted eleven minutes. Hypocrisy noted.'; } },
    ],
  },
  {
    id: 'fa_leavingHome', cat: 'youngAdult', minAge: 17, maxAge: 20, weight: 1.5, once: true, when: hasParents, scene: 'moving',
    title: 'Leaving home', text: 'The car is packed. Your old bedroom looks oddly small. Your parent is pretending not to cry.',
    choices: [
      { label: 'Hug them for a long time', tags: ['social'], scene: 'reunion', run: (x) => { for (const p of x.aliveParents()) x.relMod(p.id, 8, 4); return 'Neither of you let go first. Eventually the dog intervened.'; } },
      { label: 'Go before you cry', tags: ['cautious'], run: (x) => { x.mods({ resilience: 2 }); return 'You made it to the end of the road before you cried.'; } },
      { label: 'Promise to call every week', tags: ['help'], run: (x) => { for (const p of x.aliveParents()) x.relMod(p.id, 5); return 'You did, for six weeks. Then every month. They treasured every call.'; } },
    ],
  },
  {
    id: 'fa_plagueCousin', cat: 'family', minAge: 8, years: [1347, 1353], once: true, weight: 3, scene: 'plague',
    title: 'An orphaned cousin', text: 'The pestilence has taken your aunt and uncle. Their child stands at your door with a small bundle.',
    choices: [
      { label: 'Take them in', tags: ['help'], run: (x) => { const n = relative(x, 'sibling', x.int(4, 12), 45, { cousin: true }); x.mods({ karma: 5, empathy: 3 }); return `${n.firstName} slept in your bed that night, and many nights after.`; } },
      { label: 'Find them a convent', tags: ['cautious'], scene: 'holy', run: (x) => { x.mods({ faith: 2 }); return 'The sisters took the child with kind hands. You visited at Easter.'; } },
      { label: 'Keep the door shut', tags: ['cautious'], run: (x) => { x.mods({ karma: -5, trauma: 3 }); return 'Fear won. You thought about that small bundle for the rest of your life.'; } },
    ],
  },
  {
    id: 'fa_emigrantLetters', cat: 'family', minAge: 10, years: [1840, 1930], weight: 0.8, once: true, bind: sib, scene: 'loveLetter',
    title: 'Letters from abroad', text: (x) => `${who(x)} emigrated across the ocean and writes every few months. This letter has a photograph and a ticket inside.`,
    choices: [
      { label: 'Use the ticket', tags: ['impulsive'], scene: 'travel', run: (x) => { x.relMod(npcId(x), 10, 6); x.mods({ riskTolerance: 4 }); x.remember('emigrated', 'Followed a sibling overseas', 40); return 'Weeks at sea, then a crowded dock and a face you knew. You cried into their coat.'; } },
      { label: 'Write back and stay', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), 4); x.train('writing', 1); return 'You sold the ticket and sent the money back. The letters kept coming for years.'; } },
      { label: 'Read it aloud to the family', tags: ['social'], scene: 'familyDinner', run: (x) => { for (const p of x.aliveParents()) x.relMod(p.id, 3); return 'Your mother traced the photograph with her thumb and said nothing at all.'; } },
    ],
  },
  {
    id: 'fa_mourningDress', cat: 'family', minAge: 12, years: [1840, 1914], weight: 1.5, once: true, when: (x) => deadKin(x, 'grandparent') || deadKin(x, 'parent'), scene: 'funeral',
    title: 'Full mourning', text: 'Society says the family must wear black for a full year, with jet buttons and no parties.',
    choices: [
      { label: 'Observe every rule', tags: ['cautious'], run: (x) => { x.mods({ discipline: 3, publicImage: 2 }); x.train('etiquette', 2); return 'Twelve months of black crape. The neighbours approved deeply.'; } },
      { label: 'Wear one coloured ribbon', tags: ['impulsive'], run: (x) => { x.mods({ creativity: 2, publicImage: -2 }); return 'A tiny violet ribbon. Your aunt fainted. Grandmama would have laughed.'; } },
      { label: 'Make a hair keepsake', tags: ['help'], scene: 'jewelry', run: (x) => { x.train('artisanship', 2); return 'A woven locket, as was the fashion. Odd, tender, and kept for a century.'; } },
    ],
  },
  {
    id: 'fa_rationing', cat: 'family', minAge: 5, years: [1940, 1953], weight: 1.2, once: true, when: land('gb', 'de', 'fr', 'it', 'ru', 'jp'), scene: 'cooking',
    title: 'The ration book', text: 'One egg a week, a scrap of butter and a lot of turnips. The family has to make it stretch.',
    choices: [
      { label: 'Dig for victory', tags: ['help'], scene: 'gardening', run: (x) => { x.train('farming', 2); x.mods({ fitness: 2 }); return 'Potatoes in the lawn, a hen in the shed. You ate better than the neighbours.'; } },
      { label: 'Invent a recipe', tags: ['ambitious'], run: (x) => { x.train('cooking', 3); x.mods({ creativity: 2 }); return 'Mock banana made from parsnips. It was terrible. Everyone ate it.'; } },
      { label: 'Swap on the black market', tags: ['impulsive'], scene: 'smuggling', run: (x) => { x.mods({ karma: -2 }); x.money(-P(x, 20)); return 'Real chocolate. Hidden under a floorboard, savoured over a month.'; } },
    ],
  },
  {
    id: 'fa_telegram', cat: 'family', minAge: 12, years: [1880, 1965], weight: 0.6, cooldown: 10, scene: 'loveLetter',
    title: 'Telegram!', text: 'A telegram boy at the door. Everyone freezes, because telegrams are never ordinary news.',
    choices: [
      { label: 'Open it at once', tags: ['impulsive'], run: (x) => { const good = x.chance(0.6); x.mods(good ? { happiness: 5 } : { depression: 3 }); return good ? '"BABY GIRL ARRIVED STOP ALL WELL STOP" The whole street came round with sherry.' : '"COME AT ONCE STOP" You caught the night train with your heart in your mouth.'; } },
      { label: 'Make someone else open it', tags: ['cautious'], run: (x) => { x.mods({ anxiety: 2 }); return 'Your father read it and laughed. A cousin had won a pig at the fair.'; } },
      { label: 'Tip the boy first', tags: ['help'], run: (x) => { x.spend(P(x, 2)); x.mods({ karma: 1 }); return 'He grinned and cycled off whistling. The news inside was happy too.'; } },
    ],
  },
  {
    id: 'fa_marsCall', cat: 'family', minAge: 10, years: [2150, 2300], weight: 0.8, cooldown: 4, bind: (x) => bindRel('sibling', 'child', 'parent')(x), scene: 'rocket',
    title: 'Message from Mars', text: (x) => `${who(x)} has moved to a Mars colony. Messages arrive twenty minutes late, full of red dust and pride.`,
    choices: [
      { label: 'Record a long reply', tags: ['social'], run: (x) => { x.relMod(npcId(x), 6, 4); return 'Twenty minutes each way. You learned to ask all your questions at once.'; } },
      { label: 'Send a care package', tags: ['help'], run: (x) => { x.spend(P(x, 400)); x.relMod(npcId(x), 8); return 'Real coffee and a jar of the family jam. Arrival in seven months.'; } },
      { label: 'Book a visit', tags: ['ambitious'], scene: 'travel', run: (x) => { if (!x.spend(P(x, 20000))) return 'The ticket costs more than your house. Maybe one day.'; x.relMod(npcId(x), 15, 8); return 'You stood together under a pink sky. Worth every penny.'; } },
    ],
  },
  {
    id: 'fa_romanAdoption', cat: 'family', minAge: 35, years: [-300, 400], weight: 1.5, once: true, when: (x) => childless(x) && (rich(x) || x.c.familyStatus === 'middle'), scene: 'court',
    title: 'Adopting an heir', text: 'Without a son to carry the name, Roman custom suggests adopting a promising young man as your heir.',
    choices: [
      { label: 'Adopt a nephew', tags: ['ambitious'], run: (x) => { const n = makeNpc(x, { age: x.int(16, 24), gender: 'male', lastName: x.c.lastName, career: null, dynasty: true }); x.addRel(n.id, 'child', { affinity: 55, trust: 50, meta: { adopted: true } }); x.mods({ publicImage: 3 }); return `${n.firstName} takes your name before the magistrate. The family line continues.`; } },
      { label: 'Trust the gods instead', tags: ['cautious'], scene: 'holy', run: (x) => { x.mods({ faith: 4 }); return 'You burned incense to Juno. The house remained quiet.'; } },
      { label: 'Leave it all to friends', tags: ['social'], run: (x) => { x.mods({ karma: 2 }); return 'Your will names three friends and a freedman. Scandalous. Generous.'; } },
    ],
  },
  {
    id: 'fa_homework', cat: 'family', minAge: 22, weight: 1, cooldown: 3, bind: bindKid(7, 14), scene: 'study',
    title: 'Homework help', text: (x) => `${babyName(x)} needs help with ${x.pick(['long division', 'fractions', 'a history essay', 'a poem', 'a map of the world'])}. You have absolutely no idea.`,
    choices: [
      { label: 'Learn it together', tags: ['help'], run: (x) => { x.mods({ smarts: 2 }); x.relMod(npcId(x), 5); return 'You both got it in the end. You were more excited than they were.'; } },
      { label: 'Bluff confidently', tags: ['impulsive'], run: (x) => { x.relMod(npcId(x), -2); return 'The teacher\'s red pen disagreed with you. Your child now trusts you less on maths.'; } },
      { label: 'Say "ask your teacher"', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), -1); return 'Defensible. Unsatisfying. Classic parenting.'; } },
    ],
  },
  {
    id: 'fa_willYouDie', cat: 'family', minAge: 22, weight: 1, once: true, bind: bindKid(4, 9), scene: 'calm',
    title: 'A big question', text: (x) => `At bedtime ${babyName(x)} asks, very seriously, whether you are going to die one day.`,
    choices: [
      { label: 'Answer honestly and gently', tags: ['help'], run: (x) => { x.relMod(npcId(x), 5, 8); x.mods({ wisdom: 3 }); return '"Not for a very, very long time." They fell asleep holding your finger.'; } },
      { label: 'Talk about heaven', tags: ['cautious'], scene: 'holy', run: (x) => { x.mods({ faith: 2 }); x.relMod(npcId(x), 3); return 'They asked if dogs go too. You said yes, absolutely.'; } },
      { label: 'Change the subject', run: (x) => { x.relMod(npcId(x), -1); return 'They asked again at breakfast. Children are relentless.'; } },
    ],
  },
  {
    id: 'fa_kidFirstJob', cat: 'family', minAge: 30, weight: 1, once: true, bind: bindKid(15, 19), scene: 'interview',
    title: 'Their first job', text: (x) => `${babyName(x)} has a first job at ${x.year < 1900 ? 'the mill' : x.pick(['a burger place', 'the corner shop', 'a garden centre', 'the cinema'])}.`,
    choices: [
      { label: 'Drive them on day one', tags: ['help'], scene: 'car', run: (x) => { x.relMod(npcId(x), 4); return 'They asked you to drop them round the corner. You understood. Mostly.'; } },
      { label: 'Visit as a customer', tags: ['impulsive'], run: (x) => { x.relMod(npcId(x), -2); x.mods({ happiness: 3 }); return 'You tipped enormously. They wanted to vanish into the floor.'; } },
      { label: 'Teach them to budget', tags: ['cautious'], run: (x) => { const n = npcOf(x); if (n) n.wealth = Math.min(100, n.wealth + 3); x.relMod(npcId(x), 2); return 'Half saved, half spent. They called it "boring". It worked.'; } },
    ],
  },
  {
    id: 'fa_kidAbroad', cat: 'family', minAge: 38, weight: 0.7, once: true, bind: bindKid(20, 35), scene: 'travel',
    title: 'Moving away', text: (x) => `${babyName(x)} has been offered a life on the other side of the world and is going to take it.`,
    choices: [
      { label: 'Throw them a send-off', tags: ['social'], scene: 'party', run: (x) => { x.relMod(npcId(x), 8, 4); return 'You were brave until the departure gate. Then you were not.'; } },
      { label: 'Ask them to stay', tags: ['impulsive'], run: (x) => { x.relMod(npcId(x), -5); return 'They went anyway, and felt guilty. You both wished you had said it differently.'; } },
      { label: 'Plan your first visit', tags: ['help'], run: (x) => { x.relMod(npcId(x), 6); x.mods({ happiness: 2 }); return 'Flights booked before their plane even landed.'; } },
    ],
  },
  {
    id: 'fa_kidGraduation', cat: 'family', minAge: 38, years: [1850, 2300], weight: 1, once: true, bind: bindKid(21, 23), scene: 'graduation',
    title: 'Cap and gown', text: (x) => `${babyName(x)} crosses the stage. You remember carrying that same person in one arm.`,
    choices: [
      { label: 'Cheer embarrassingly loud', tags: ['impulsive'], run: (x) => { x.relMod(npcId(x), 6); x.mods({ happiness: 6 }); return 'The whole hall turned around. Your child pretended not to know you, then hugged you.'; } },
      { label: 'Take them for a fancy dinner', tags: ['social'], scene: 'restaurant', run: (x) => { x.spend(P(x, 200)); x.relMod(npcId(x), 7); return 'They ordered the most expensive thing on the menu. Fair.'; } },
      { label: 'Write them a letter', tags: ['help'], scene: 'loveLetter', run: (x) => { x.relMod(npcId(x), 9, 6); return 'They found it in their bag on the train and read it three times.'; } },
    ],
  },
  {
    id: 'fa_sundayCall', cat: 'family', minAge: 55, weight: 1, cooldown: 3, bind: bindKid(25, 60), scene: 'gadget',
    title: 'The Sunday call', text: (x) => `${babyName(x)} calls every Sunday. Today ${x.pick(['they sound tired', 'they have big news', 'they want your recipe', 'they just want to chat'])}.`,
    choices: [
      { label: 'Just listen', tags: ['help'], run: (x) => { x.relMod(npcId(x), 6, 5); return 'An hour flew. They said "thanks, I needed that" before hanging up.'; } },
      { label: 'Give advice', tags: ['ambitious'], run: (x) => { x.relMod(npcId(x), x.chance(0.5) ? 3 : -3); return 'Some of it landed. Some of it was about their hair.'; } },
      { label: 'Tell them about your ailments', tags: ['impulsive'], run: (x) => { x.relMod(npcId(x), -1); return 'Twenty minutes on your knee. They were patient. Saint-like, even.'; } },
    ],
  },
  {
    id: 'fa_rolesReverse', cat: 'elder', minAge: 72, weight: 1.2, once: true, bind: bindKid(35, 70), scene: 'nursingHome',
    title: 'Roles reversed', text: (x) => `${babyName(x)} has started checking your fridge, your pills and your driving. Gently. Constantly.`,
    choices: [
      { label: 'Let them help', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), 8, 6); x.mods({ wisdom: 3, stress: -2 }); return 'You remembered doing the same for your own parents. It felt like a circle closing.'; } },
      { label: 'Insist you\'re fine', tags: ['impulsive'], run: (x) => { x.relMod(npcId(x), -4); x.mods({ ego: 2 }); return 'You are fine. You also cannot find your keys. Both things are true.'; } },
      { label: 'Make a deal', tags: ['social'], run: (x) => { x.relMod(npcId(x), 5, 5); return 'You hand over the car keys; they stop mentioning the stairs. Peace.'; } },
    ],
  },
  {
    id: 'fa_parentsAnniversary', cat: 'family', minAge: 20, weight: 0.7, once: true, when: twoParents, scene: 'anniversary',
    title: 'Their anniversary', text: 'Your parents are about to celebrate forty years together. Someone has to organise something.',
    choices: [
      { label: 'Throw a surprise party', tags: ['social'], scene: 'party', run: (x) => { x.spend(P(x, 600)); for (const p of x.aliveParents()) x.relMod(p.id, 10, 4); return 'They walked in, everyone shouted, and your dad actually wept.'; } },
      { label: 'Recreate their first date', tags: ['help'], scene: 'date', run: (x) => { for (const p of x.aliveParents()) x.relMod(p.id, 12, 6); return 'Same café, same table, same terrible song on the jukebox. They held hands like teenagers.'; } },
      { label: 'Just send a card', tags: ['cautious'], run: (x) => { for (const p of x.aliveParents()) x.relMod(p.id, 1); return 'It went on the mantelpiece, between the cards from people who made more effort.'; } },
    ],
  },
  {
    id: 'fa_passRecipe', cat: 'family', minAge: 55, weight: 1, once: true, bind: (x) => bindKid(18, 60)(x) ?? bindGrandkid(12, 40)(x), scene: 'cooking',
    title: 'Passing it on', text: (x) => `You decide it is time to teach ${who(x)} the family recipe, the one that was never written down.`,
    choices: [
      { label: 'Teach every step', tags: ['help'], run: (x) => { x.relMod(npcId(x), 8, 6); x.mods({ happiness: 4 }); return 'Their first attempt was nearly right. "It\'s the pinch of love," you lied.'; } },
      { label: 'Finally write it down', tags: ['cautious'], scene: 'reading', run: (x) => { x.mods({ wisdom: 2 }); return 'A stained index card, now laminated. Generations of grandmothers spin in their graves.'; } },
      { label: 'Keep one secret ingredient', tags: ['impulsive'], run: (x) => { x.relMod(npcId(x), 3); x.mods({ ego: 2 }); return 'They will never get it quite right. You will always be needed.'; } },
    ],
  },
  {
    id: 'fa_heirloom', cat: 'elder', minAge: 60, weight: 0.8, once: true, bind: (x) => bindKid(18, 70)(x) ?? bindGrandkid(16, 50)(x), scene: 'jewelry',
    title: 'The heirloom', text: (x) => `You take out the ${x.pick(['pocket watch', 'wedding ring', 'old sword', 'brooch', 'family Bible'])} that has passed through ${x.int(3, 7)} generations. It is time it went to ${who(x)}.`,
    choices: [
      { label: 'Tell its whole story', tags: ['social'], run: (x) => { x.relMod(npcId(x), 10, 6); x.mods({ wisdom: 2 }); return 'Wars, weddings, one pawnshop and a daring rescue. They held it like glass.'; } },
      { label: 'Give it without fuss', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), 6); return 'A quick "this is yours now" and a cup of tea. They understood exactly what it meant.'; } },
      { label: 'Keep it a little longer', tags: ['impulsive'], run: (x) => { x.mods({ happiness: 1 }); return 'You put it back in the drawer. Next year. Probably.'; } },
    ],
  },
  {
    id: 'fa_memoir', cat: 'elder', minAge: 65, weight: 0.8, once: true, when: (x) => x.children().filter(alive).length > 0, scene: 'reading',
    title: 'For the family', text: 'Your family asks you to write down your life story before the details slip away.',
    choices: [
      { label: 'Write the whole thing', tags: ['ambitious'], scene: 'office', run: (x) => { x.train('writing', 4); x.mods({ wisdom: 4, happiness: 3 }); x.remember('fa_memoir', 'Wrote a memoir for the family', 30); return 'Two hundred pages. You left out three things and told the truth about everything else.'; } },
      { label: 'Record it out loud', tags: ['social'], run: (x) => { x.mods({ happiness: 4 }); for (const k of x.children()) x.relMod(k.id, 4); return 'Hours of tapes, full of laughter and long pauses. Your voice, kept forever.'; } },
      { label: 'Some stories die with you', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 2 }); return 'You smiled mysteriously and changed the subject. Let them wonder.'; } },
    ],
  },
  {
    id: 'fa_grandkidWedding', cat: 'elder', minAge: 60, weight: 1, cooldown: 5, bind: bindGrandkid(20, 40), scene: 'wedding',
    title: 'Grandchild\'s wedding', text: (x) => `${who(x)} is getting married, and has asked for one dance with you.`,
    choices: [
      { label: 'Dance like it\'s 40 years ago', tags: ['impulsive'], scene: 'dance', run: (x) => { x.relMod(npcId(x), 10); x.mods({ happiness: 6, health: -1 }); return 'Your hip complained. The dance floor applauded.'; } },
      { label: 'A slow, careful waltz', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), 8); x.mods({ happiness: 5 }); return 'Three minutes that you would replay on quiet afternoons.'; } },
      { label: 'Give a toast', tags: ['social'], scene: 'familyDinner', run: (x) => { x.relMod(npcId(x), 7); x.train('publicSpeaking', 1); return '"I held you when you were this big." The entire room said "awww".'; } },
    ],
  },
  {
    id: 'fa_everyoneTogether', cat: 'elder', minAge: 70, weight: 1, cooldown: 4, when: (x) => x.rels('child', 'grandchild').length >= 3, scene: 'familyDinner',
    title: 'Everyone home', text: 'For once, every child and grandchild is home at the same table. It is very loud.',
    choices: [
      { label: 'Raise a glass', tags: ['social'], run: (x) => { for (const r of x.rels('child', 'grandchild')) x.relMod(r.npcId, 3); x.mods({ happiness: 8 }); return 'You said a few words and couldn\'t finish. Someone finished for you.'; } },
      { label: 'Just watch them all', tags: ['cautious'], scene: 'grandparents', run: (x) => { x.mods({ wisdom: 3, happiness: 6 }); return 'All these people, and none of them would exist without you. Remarkable.'; } },
      { label: 'Take a family photo', tags: ['help'], scene: 'family', run: (x) => { x.mods({ happiness: 5 }); return 'Thirty people, one timer, eleven attempts. Everyone is blinking. Perfect.'; } },
    ],
  },
  {
    id: 'fa_uncleScheme', cat: 'family', minAge: 20, weight: 0.6, cooldown: 8, scene: 'startup',
    title: 'Uncle\'s big idea', text: (x) => `Your uncle wants you to invest ${x.fmt(P(x, 1500))} in ${x.pick(['a llama farm', 'self-heating socks', 'a racehorse', 'a restaurant with no menu', 'a "sure thing"'])}.`,
    choices: [
      { label: 'Invest', tags: ['impulsive'], run: (x) => { if (!x.spend(P(x, 1500))) return 'You didn\'t have it. Lucky you.'; if (x.chance(0.25)) { x.money(P(x, 6000)); return 'It worked! Nobody, least of all your uncle, can explain why.'; } return 'It did not work. He sends a postcard every Christmas apologising.'; } },
      { label: 'Politely decline', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 1 }); return 'He was disappointed, and then asked your cousin.'; } },
      { label: 'Ask for a business plan', tags: ['ambitious'], run: (x) => { x.train('investing', 1); return 'It arrived on a napkin. You framed it.'; } },
    ],
  },
  {
    id: 'fa_auntAdvice', cat: 'family', minAge: 15, maxAge: 35, weight: 0.8, cooldown: 5, scene: 'restaurant',
    title: 'The eccentric aunt', text: (x) => `Your aunt, who ${x.pick(['once sailed alone around Africa', 'has been married four times', 'keeps bees and a parrot', 'ran away with a circus'])}, takes you to lunch to give you "life advice".`,
    choices: [
      { label: 'Take notes', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 3 }); return '"Never marry anyone who is rude to waiters." Life-changing, in hindsight.'; } },
      { label: 'Match her wine for wine', tags: ['impulsive'], scene: 'bar', run: (x) => { x.mods({ happiness: 4, health: -1 }); return 'Four hours later you knew every family secret and had a tattoo appointment.'; } },
      { label: 'Ask about her adventures', tags: ['social'], run: (x) => { x.mods({ riskTolerance: 3, creativity: 2 }); return 'You left with a head full of distant places and a strong urge to buy a boat.'; } },
    ],
  },
  {
    id: 'fa_familyHeirlessKing', cat: 'family', minAge: 18, years: [-800, 1900], weight: 0.6, once: true, when: (x) => ['aristocracy', 'royalty'].includes(x.c.familyStatus) && x.rels('sibling').length > 0, bind: sib, scene: 'royalBall',
    title: 'The family name', text: (x) => `The family elders gather to decide whether you or ${who(x)} will represent the house at court this season.`,
    choices: [
      { label: 'Make your case', tags: ['ambitious'], run: (x) => { x.train('oratory', 2); x.relMod(npcId(x), -5); x.mods({ publicImage: 3 }); return 'Your speech carried the room. Your sibling\'s smile did not reach their eyes.'; } },
      { label: 'Step aside for them', tags: ['help'], run: (x) => { x.relMod(npcId(x), 10, 8); x.mods({ karma: 3 }); return 'They glittered at court and never forgot who gave them the chance.'; } },
      { label: 'Suggest you go together', tags: ['social'], scene: 'dance', run: (x) => { x.relMod(npcId(x), 5, 4); x.train('etiquette', 2); return 'A sibling double act. The court found you charming and slightly terrifying.'; } },
    ],
  },
  {
    id: 'fa_familyMoveCountry', cat: 'family', minAge: 25, weight: 0.4, once: true, when: hasKid(4, 15), scene: 'moving',
    title: 'Uproot everyone?', text: 'A good opportunity in another city means moving the whole family. The children have opinions.',
    choices: [
      { label: 'Move', tags: ['ambitious'], run: (x) => { x.money(P(x, 3000)); for (const k of kids(x, 4, 15)) x.relMod(k.id, -4); x.mods({ stress: 4 }); return 'Tears in the car, new friends by Christmas. Mostly.'; } },
      { label: 'Stay for the kids', tags: ['help'], run: (x) => { for (const k of kids(x, 4, 15)) x.relMod(k.id, 5); x.mods({ wisdom: 2 }); return 'You turned it down. Some richer life somewhere else, unlived.'; } },
      { label: 'Let the family vote', tags: ['social'], run: (x) => { for (const k of kids(x, 4, 15)) x.relMod(k.id, 4, 4); return x.chance(0.5) ? 'They voted to go. Ownership made it easier.' : 'They voted to stay. Democracy is a harsh mistress.'; } },
    ],
  },
];

const EXTRA: EventDef[] = [
  {
    id: 'fa_nightmare', cat: 'family', minAge: 20, weight: 1, cooldown: 3, bind: bindKid(3, 8), scene: 'ghost',
    title: 'Monster under the bed', text: (x) => `${babyName(x)} pads into your room at 3am: there is a monster under the bed.`,
    choices: [
      { label: 'Check with a torch', tags: ['help'], run: (x) => { x.relMod(npcId(x), 5, 5); return 'You found a sock and a raisin. Monster officially evicted.'; } },
      { label: 'Let them climb in', tags: ['social'], run: (x) => { x.relMod(npcId(x), 6); x.mods({ energy: -3 }); return 'A small foot in your ribs all night. You would not trade it for anything.'; } },
      { label: 'Spray "monster repellent"', tags: ['cautious'], run: (x) => { x.mods({ creativity: 2 }); x.relMod(npcId(x), 4); return 'Water in a bottle with a scary label. Works every time.'; } },
    ],
  },
  {
    id: 'fa_lullaby', cat: 'family', minAge: 18, weight: 1.2, cooldown: 2, bind: bindKid(0, 2), scene: 'music',
    title: 'The lullaby', text: (x) => `${babyName(x)} will only sleep to one song, and you are on verse forty.`,
    choices: [
      { label: 'Sing the old family song', tags: ['help'], run: (x) => { x.train('singing', 1); x.relMod(npcId(x), 4); return 'Your mother sang it to you. Out like a light.'; } },
      { label: 'Make up new words', tags: ['impulsive'], run: (x) => { x.mods({ creativity: 3 }); return 'A ballad about a cheese-stealing badger. Instant hit.'; } },
      { label: 'Hum and sway', tags: ['cautious'], scene: 'dance', run: (x) => { x.mods({ stress: -3 }); return 'A slow dance in the dark with someone very small. Peace.'; } },
    ],
  },
  {
    id: 'fa_bikeRide', cat: 'family', minAge: 22, years: [1890, 2300], weight: 0.9, cooldown: 4, bind: bindKid(5, 10), scene: 'playground',
    title: 'Stabilisers off', text: (x) => `${babyName(x)} wants the stabilisers off today. You are holding the back of the saddle.`,
    choices: [
      { label: 'Let go secretly', tags: ['impulsive'], run: (x) => { x.relMod(npcId(x), 6); x.mods({ happiness: 4 }); return 'Thirty metres before they realised. Then a wobble, a crash, and a huge grin.'; } },
      { label: 'Run alongside forever', tags: ['help'], scene: 'sports', run: (x) => { x.mods({ fitness: 2 }); x.relMod(npcId(x), 4); return 'You ran a half-marathon in the park. They learned anyway.'; } },
      { label: 'Kneepads first', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), 2); return 'Padded like a knight. Not a single scratch. Slightly less fun.'; } },
    ],
  },
  {
    id: 'fa_parentRemarries', cat: 'family', minAge: 25, weight: 0.6, once: true, bind: bindOldParent(55), scene: 'wedding',
    title: 'Second time around', text: (x) => `${ma(x)} is getting remarried at ${ageOf(x)} and has asked you to stand beside ${him(x)} at the ceremony.`,
    choices: [
      { label: 'Say yes, beaming', tags: ['help'], run: (x) => { x.relMod(npcId(x), 12, 6); x.mods({ happiness: 5 }); return `${ma(x)} looked twenty years younger. You cried more than the couple.`; } },
      { label: 'Agree, a bit stiffly', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), 3); return 'You did your part. By the cake, you were genuinely happy for them.'; } },
      { label: 'Object, privately', tags: ['impulsive'], scene: 'argument', run: (x) => { x.relMod(npcId(x), -10, -5); return '"I\'m not asking permission," they said. They were right.'; } },
    ],
  },
];

export const FAMILY_EVENTS: EventDef[] = [...CHILDHOOD, ...HOLIDAY_EVENTS, ...ERA_FAMILY, ...PARENTING, ...GENERATIONS, ...ELDERS, ...KIN, ...MORE, ...EXTRA];

export const FAMILY_CHAINS: ChainDef[] = [
  { id: 'fa_chain_parentDecline', name: 'Memory fades', desc: 'An ageing parent slowly loses their memory.', steps: [{ delay: 0, eventId: 'fa_pd_diagnosis' }, { delay: 2, eventId: 'fa_pd_care' }, { delay: 2, eventId: 'fa_pd_lastTalk' }] },
  { id: 'fa_chain_estrangement', name: 'Estranged', desc: 'A falling-out with a sibling, years of silence, and a chance to mend it.', steps: [{ delay: 0, eventId: 'fa_es_silence' }, { delay: 4, eventId: 'fa_es_letter' }, { delay: 3, eventId: 'fa_es_reunion' }] },
];

void his; void fmtYear; void linkNpcs; void adopt; void birthChild; void ageOf; void isAlive; void sonOr; void hasKid; void bindKid; void bindOldParent; void car;
