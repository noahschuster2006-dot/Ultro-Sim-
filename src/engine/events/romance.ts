import type { Ctx } from '../ctx';
import { fmtYear } from '../ctx';
import type { ChainDef, EventDef } from './types';
import type { Gender, NPC, Params, RelType } from '../types';
import { npcId, who } from './helpers';
import { attractedTo, attraction, breakUp, compatibility, divorce, marry, propose, startDating, tryForBaby } from '../systems/relationships';
import { makeNpc } from '../systems/npcs';
import { eraCostFactor } from '../systems/finance';
import { trauma } from '../systems/mind';

/**
 * Love and lovers: meeting people, dating, commitment, married life,
 * temptation, endings and late love. Adults only; intimacy is always implied.
 */

type Def = Omit<EventDef, 'cat' | 'scene'> & { cat?: EventDef['cat']; scene: string };

/** Every romance event is adults-only, whatever the definition says. */
function R(e: Def): EventDef {
  return { cat: 'romance', ...e, minAge: Math.max(18, e.minAge ?? 18) };
}

// ------------------------------------------------------------------ helpers
const cost = (x: Ctx, n: number): number => Math.max(1, Math.round(n * eraCostFactor(x.year)));
const lovable = (x: Ctx): boolean => x.c.sexuality !== 'asexual';
const alive = (x: Ctx, id: string | undefined): boolean => !!id && !!x.npc(id)?.alive;
const single = (x: Ctx): boolean => lovable(x) && !x.lover() && !x.rels('affair').length;
const id = (x: Ctx): string => npcId(x);
const isType = (x: Ctx, ...types: RelType[]): boolean => {
  const r = x.rel(id(x));
  return !!r && types.includes(r.type) && alive(x, r.npcId);
};
const isTypeNow = (x: Ctx, ...types: RelType[]): boolean => !!x.lover() && types.includes(x.lover()!.type);
const widowed = (x: Ctx): boolean => x.hasMemory('loss_spouse');
const yearsWed = (x: Ctx): number => {
  const r = x.spouse();
  const m = r?.meta.marriedAge;
  return typeof m === 'number' ? x.age - m : 0;
};
const sameSex = (x: Ctx): boolean => x.npc(id(x))?.gender === x.c.gender;
const sameSexId = (x: Ctx, n: string): boolean => x.npc(n)?.gender === x.c.gender;
const pub = (x: Ctx): string => (x.year < 1600 ? 'tavern' : x.year < 1900 ? 'inn' : x.year >= 1920 && x.year < 1934 ? 'speakeasy' : 'bar');
const note = (x: Ctx): string => (x.year < 1990 ? 'letter' : x.year < 2008 ? 'email' : 'message');

function loveGender(x: Ctx): Gender {
  const g = x.c.gender;
  const sx = x.c.sexuality;
  if (sx === 'gay') return g;
  if (sx === 'bisexual') return x.pick<Gender>(['male', 'female', 'male', 'female', 'nonbinary']);
  if (g === 'male') return 'female';
  if (g === 'female') return 'male';
  return x.pick<Gender>(['male', 'female']);
}

/** A new adult the character could plausibly fall for. */
function newFlame(x: Ctx, dAge: [number, number] = [-5, 5], looks?: number): NPC {
  const gender = loveGender(x);
  const sexuality = gender === x.c.gender ? (x.chance(0.6) ? 'gay' : 'bisexual') : x.chance(0.85) ? 'straight' : 'bisexual';
  return makeNpc(x, { age: Math.max(18, x.age + x.int(dAge[0], dAge[1])), gender, sexuality, looks: looks ?? x.int(45, 92) });
}

/** Bind a fresh love interest, only when the character is free to fall. */
const flameIf = (cond: (x: Ctx) => boolean, dAge?: [number, number]) => (x: Ctx): Params | null => (lovable(x) && cond(x) ? { npcId: newFlame(x, dAge).id } : null);
const freshFlame = flameIf(single);
const tempter = flameIf((x) => !!x.lover() && !x.rels('affair').length);

const bindLover = (x: Ctx): Params | null => {
  const r = x.lover();
  return r && alive(x, r.npcId) ? { npcId: r.npcId } : null;
};
const bindSpouse = (x: Ctx): Params | null => {
  const r = x.spouse();
  return r && alive(x, r.npcId) ? { npcId: r.npcId } : null;
};
const bindPartner = (x: Ctx): Params | null => {
  const r = x.rels('partner').find((q) => alive(x, q.npcId));
  return r && !x.spouse() ? { npcId: r.npcId } : null;
};
const bindAffair = (x: Ctx): Params | null => {
  const a = x.rels('affair').find((q) => alive(x, q.npcId));
  const l = x.lover();
  return a && l && alive(x, l.npcId) ? { npcId: a.npcId, homeId: l.npcId } : null;
};
const bindEx = (x: Ctx): Params | null => {
  const e = x.rels('ex').filter((q) => alive(x, q.npcId) && x.npcAge(x.npc(q.npcId)!) >= 18);
  return e.length ? { npcId: x.pick(e).npcId } : null;
};

/** Become a couple without a roll (the moment already happened). */
function together(x: Ctx, npc: string, lead: string): string {
  const n = x.npc(npc);
  if (!n) return lead;
  if (x.lover()) return `${lead} ${beginAffair(x, npc)}`;
  x.addRel(npc, 'partner', { affinity: 62, trust: 52, attraction: attraction(x, n), compatibility: compatibility(x, n), meta: { discretion: 50 } });
  x.mods({ happiness: 8, loneliness: -10 });
  if (n.gender === x.c.gender && x.w.socialNorms < 45) x.secret(`samesex_${npc}`, `A same-sex relationship with ${x.name(n)}`, x.w.socialNorms < 30 ? 6 : 3);
  x.remember('romance', `Started seeing ${x.name(n)}`, 15, npc);
  return `${lead} You and ${n.firstName} are now together.`;
}

/** Ask the bound person out; success is rolled by the relationship system. */
function woo(x: Ctx, lead: string): string {
  x.train('charm', 1);
  return `${lead} ${startDating(x, id(x))}`;
}

function beginAffair(x: Ctx, npc: string): string {
  const n = x.npc(npc);
  if (!n) return '';
  x.addRel(npc, 'affair', { affinity: 60, trust: 40, attraction: attraction(x, n), compatibility: compatibility(x, n), meta: { discretion: 50 } });
  x.secret(`affair_${npc}`, `An affair with ${x.name(n)}`, 5);
  x.mods({ karma: -4, sin: 3, happiness: 4, stress: 6 });
  x.chain('ro_chain_affair', 1, { npcId: npc });
  return `You began a secret affair with ${n.firstName}.`;
}

/** Brief encounter with no strings: stays an acquaintance afterwards. */
function fling(x: Ctx, npc: string, text: string): string {
  if (!x.npc(npc)) return text;
  if (x.lover()) return `${text} ${beginAffair(x, npc)}`;
  x.addRel(npc, 'acquaintance', { affinity: 55, trust: 35, meta: { fling: true } });
  x.mods({ happiness: 6, loneliness: -8, romanticCynicism: 1 });
  x.remember('fling', `A fling with ${x.name(npc)}`, 8, npc);
  return text;
}

/** The affair is found out: married people get the full scene, partners a quick ending. */
function caught(x: Ctx, loverId: string): string {
  const home = x.lover();
  if (!home) return 'Nobody was home to find out.';
  const a = x.rel(loverId);
  if (a) a.meta.discretion = 0;
  x.mods({ stress: 15, publicImage: x.famous ? -6 : 0 });
  if (home.type === 'spouse') {
    x.queue('affair_discovered', { spouse: home.npcId, lover: loverId }, true);
    return `${x.first(home.npcId)} has seen everything.`;
  }
  const out = breakUp(x, home.npcId);
  if (a) a.type = 'partner';
  x.relMod(home.npcId, -30, -40);
  return `${x.first(home.npcId)} found out and left that night. ${out}`;
}

/** Propose to the bound partner, with a mood bonus or penalty first. */
function ask(x: Ctx, mood: number): string {
  const r = x.rel(id(x));
  if (!r || r.type !== 'partner' || x.spouse()) return `${who(x)} smiled, but the timing was not right.`;
  x.relMod(id(x), mood, 0);
  const out = propose(x, id(x));
  if (out.endsWith('yes!')) x.remember('engaged', `Got engaged to ${x.name(id(x))}`, 25, id(x));
  return out;
}

/** Marry on the spot, skipping the big wedding. */
function elope(x: Ctx, lead: string): string {
  const r = x.rel(id(x));
  if (!r || r.type !== 'partner' || x.spouse() || !x.npc(id(x))) return `${lead} In the end, nothing came of it.`;
  return `${lead} ${marry(x, id(x), { prenup: false, lavish: false })}`;
}

function endIt(x: Ctx, lead: string): string {
  const r = x.rel(id(x));
  if (!r) return lead;
  r.meta.endedAge = x.age;
  if (r.type === 'spouse') return `${lead} ${divorce(x, id(x))}`;
  return `${lead} ${breakUp(x, id(x))}`;
}

// ------------------------------------------------------------------ events
const MEETING: EventDef[] = [
  R({
    id: 'ro_barGlance', weight: 1.2, bind: freshFlame, scene: 'flirt', title: 'Across the room',
    text: (x) => `${who(x)} keeps catching your eye across the ${pub(x)}, then pretending to study the ceiling.`,
    choices: [
      { label: 'Buy them a drink', tags: ['social'], scene: 'bar', run: (x) => { x.spend(cost(x, 12)); return woo(x, 'You sent over a drink and, eventually, yourself.'); } },
      { label: 'Wink back', tags: ['impulsive'], run: (x) => (x.chance(0.5) ? woo(x, 'The wink landed.') : (x.mods({ confidence: -2 }), 'They thought you had something in your eye and offered a napkin.')) },
      { label: 'Finish your drink', tags: ['cautious'], run: (x) => { x.mods({ loneliness: 2 }); return 'You left. You will think about that ceiling for a week.'; } },
    ],
  }),
  R({
    id: 'ro_cafeSpill', years: [1650, 2300], bind: freshFlame, scene: 'flirt', title: 'Spilled coffee',
    text: (x) => `You knocked ${who(x)}'s coffee straight into their lap. They are staring at you.`,
    choices: [
      { label: 'Buy them another', tags: ['help'], run: (x) => { x.spend(cost(x, 5)); return woo(x, 'The second cup lasted three hours.'); } },
      { label: 'Make a joke of it', tags: ['social'], run: (x) => (x.skill('humor') > 20 || x.chance(0.45) ? woo(x, 'They laughed despite the stain.') : (x.mods({ confidence: -3 }), 'The joke landed worse than the coffee.')) },
      { label: 'Flee', tags: ['cautious'], run: (x) => { x.mods({ anxiety: 2 }); return 'You found a new café. Possibly a new city.'; } },
    ],
  }),
  R({
    id: 'ro_personalAd', years: [1900, 2008], when: single, scene: 'loveLetter', title: 'Lonely hearts',
    text: (x) => `You draft a personal ad for the ${x.year < 1990 ? 'newspaper' : 'classifieds website'}. Every word costs money, so choose them well.`,
    choices: [
      { label: 'Be honest', tags: ['cautious'], run: (x) => { const n = newFlame(x); x.addRel(n.id, 'acquaintance', { affinity: 50 }); return x.chance(0.6) ? together(x, n.id, `One reply came, from ${n.firstName}, and it was lovely.`) : 'Two replies: a pen pal in prison and your own aunt.'; } },
      { label: 'Exaggerate a little', tags: ['ambitious'], run: (x) => { const n = newFlame(x); x.addRel(n.id, 'acquaintance', { affinity: 40 }); return x.chance(0.4) ? together(x, n.id, `${n.firstName} met you and forgave the "tall, athletic" part.`) : `${n.firstName} arrived expecting someone else and left before dessert.`; } },
      { label: 'Answer an ad instead', tags: ['social'], run: (x) => { const n = newFlame(x); x.addRel(n.id, 'acquaintance', { affinity: 45 }); return x.chance(0.5) ? together(x, n.id, `"Seeks fellow lover of rainy walks." That turned out to be ${n.firstName}.`) : 'The advertiser turned out to be selling encyclopaedias.'; } },
    ],
  }),
  R({
    id: 'ro_appMatch', years: [2009, 2300], weight: 1.5, bind: freshFlame, scene: 'datingApp', title: "It's a match",
    text: (x) => `${who(x)}, ${x.npcAge(x.npc(id(x))!)}, matched with you. Their bio says "fluent in sarcasm".`,
    choices: [
      { label: 'Message first', tags: ['ambitious'], run: (x) => woo(x, 'You opened with a pun. A risky pun.') },
      { label: 'Wait for them', tags: ['cautious'], run: (x) => (x.chance(0.4) ? woo(x, 'They messaged first, three days later.') : (x.mods({ loneliness: 3 }), 'You both waited. The match expired of old age.')) },
      { label: 'Delete the app', run: (x) => { x.mods({ stress: -3, loneliness: 2 }); return 'Your thumb feels free. Your evenings feel long.'; } },
    ],
  }),
  R({
    id: 'ro_appGhosted', years: [2009, 2300], when: single, scene: 'breakupText', title: 'Ghosted',
    text: 'Three great dates, then silence. Your last message sits there with two grey ticks.',
    choices: [
      { label: 'Double text', tags: ['impulsive'], run: (x) => { x.mods({ confidence: -3 }); return 'Read at 11:42. Never answered. A modern tragedy.'; } },
      { label: 'Let it go', tags: ['cautious'], run: (x) => { x.mods({ resilience: 2, romanticCynicism: 2 }); return 'You archived the chat and, slowly, the feeling.'; } },
      { label: 'Vent to friends', tags: ['social'], scene: 'friends', run: (x) => { x.mods({ happiness: 3, stress: -3 }); return 'Your friends analysed every emoji like codebreakers.'; } },
    ],
  }),
  R({
    id: 'ro_appBio', years: [2009, 2300], when: single, scene: 'datingApp', title: 'The profile',
    text: 'You have to describe yourself in 300 characters, which feels like a job interview with flirting.',
    choices: [
      { label: 'Be witty', tags: ['social'], run: (x) => { x.train('humor', 2); return x.chance(0.5) ? woo(x, 'It worked.') : 'Your matches tripled; your conversations did not.'; } },
      { label: 'Be honest', tags: ['cautious'], run: (x) => { x.mods({ confidence: 2 }); return 'Fewer matches, better ones. That is how it is supposed to work.'; } },
      { label: 'Use ten-year-old photos', tags: ['impulsive'], run: (x) => { x.mods({ karma: -1 }); return 'Your first date asked if you had a younger sibling.'; } },
    ],
    bind: freshFlame,
  }),
  R({
    id: 'ro_matchmaker', years: [-800, 1899], weight: 1.3, bind: freshFlame, scene: 'blindDate', title: 'The matchmaker',
    text: (x) => `The local matchmaker arrives with a list, a pot of tea and a very strong opinion about ${who(x)}.`,
    choices: [
      { label: 'Trust her judgement', tags: ['cautious'], run: (x) => (x.chance(0.7) ? together(x, id(x), 'She was right, which she will mention at every family gathering.') : 'You met. You both prayed for rain.') },
      { label: 'Insist on love', tags: ['impulsive'], run: (x) => { x.mods({ romanticCynicism: -2 }); return 'She sniffed and said love is for poets and the poor.'; } },
      { label: 'Pay for a better match', tags: ['ambitious'], when: (x) => x.canAfford(cost(x, 200)), run: (x) => { x.spend(cost(x, 200)); const n = newFlame(x, [-4, 4], x.int(70, 95)); x.addRel(n.id, 'acquaintance', { affinity: 50 }); return together(x, n.id, `The silver bought an introduction to ${n.firstName}, the catch of the season.`); } },
    ],
  }),
  R({
    id: 'ro_chaperone', years: [1600, 1899], bind: freshFlame, scene: 'date', title: 'A proper call',
    text: (x) => `${who(x)} calls on you in the parlour, with an aunt in the corner pretending to knit.`,
    choices: [
      { label: 'Discuss poetry', tags: ['cautious'], run: (x) => { x.train('poetry', 2); return woo(x, 'You quoted Byron. The aunt approved, which was alarming.'); } },
      { label: 'Slip them a note', tags: ['impulsive'], scene: 'loveLetter', run: (x) => (x.chance(0.6) ? together(x, id(x), 'The note said "Thursday, the garden gate." They came.') : (x.mods({ publicImage: -2 }), 'The aunt intercepted the note and read it aloud.')) },
      { label: 'Bore the aunt asleep', tags: ['social'], run: (x) => woo(x, 'Forty minutes on drainage reform, and the aunt was snoring.') },
    ],
  }),
  R({
    id: 'ro_setUp', weight: 1.2, bind: freshFlame, scene: 'blindDate', title: 'The set-up',
    text: (x) => `A friend swears you and ${who(x)} are "basically the same person". That is either very good or very bad.`,
    choices: [
      { label: 'Agree to meet', tags: ['social'], run: (x) => woo(x, 'You met for a drink.') },
      { label: 'Bring a wingman', tags: ['cautious'], run: (x) => (x.chance(0.3) ? (x.mods({ happiness: -2 }), 'Your wingman and your date hit it off. You paid.') : woo(x, 'The wingman left early on cue.')) },
      { label: 'Refuse', run: (x) => { x.mods({ loneliness: 2 }); return 'Your friend sulked. They were only trying.'; } },
    ],
  }),
  R({
    id: 'ro_blindDate', years: [1920, 2300], bind: freshFlame, scene: 'blindDate', title: 'Blind date',
    text: (x) => `You are waiting for a stranger called ${who(x)} and have already checked your teeth in a spoon twice.`,
    choices: [
      { label: 'Just be yourself', tags: ['cautious'], run: (x) => woo(x, 'You were yourself. It was enough, or it was not.') },
      { label: 'Fake an emergency', tags: ['cautious'], run: (x) => { x.mods({ karma: -1 }); return 'Your "emergency call" rang while you were still holding it.'; } },
      { label: 'Order everything', tags: ['impulsive'], scene: 'restaurant', run: (x) => { x.spend(cost(x, 90)); return woo(x, 'Seven courses later, you had either a date or a food coma.'); } },
    ],
  }),
  R({
    id: 'ro_officeCrush', when: (x) => x.employed, bind: freshFlame, scene: 'office', title: 'Office crush',
    text: (x) => `${who(x)} from the next desk laughs at your jokes, even the bad ones. Especially the bad ones.`,
    choices: [
      { label: 'Ask them to lunch', tags: ['social'], scene: 'date', run: (x) => woo(x, 'Lunch ran long. Your manager noticed.') },
      { label: 'Keep it professional', tags: ['cautious'], run: (x) => { x.mods({ professionalRep: 2, loneliness: 2 }); return 'You stayed professional and slightly heartbroken.'; } },
      { label: 'Leave an anonymous note', tags: ['impulsive'], scene: 'loveLetter', run: (x) => (x.chance(0.4) ? together(x, id(x), 'They recognised your handwriting and came straight over.') : 'HR circulated a memo about anonymous notes.') },
    ],
  }),
  R({
    id: 'ro_weddingGuest', bind: freshFlame, scene: 'wedding', title: 'The singles table',
    text: (x) => `At a cousin's wedding you are seated beside ${who(x)}, who has already rated every speech out of ten.`,
    choices: [
      { label: 'Ask for a dance', tags: ['social'], scene: 'dance', run: (x) => woo(x, 'You danced badly together, which is a kind of chemistry.') },
      { label: 'Catch the bouquet', tags: ['impulsive'], run: (x) => { x.mods({ happiness: 3 }); return x.chance(0.5) ? woo(x, 'You caught it. They caught your eye.') : 'You caught it. The bride\'s aunt glared.'; } },
      { label: 'Stay for the cake only', tags: ['cautious'], run: (x) => { x.mods({ happiness: 2 }); return 'The cake was excellent. The cake never lets you down.'; } },
    ],
  }),
  R({
    id: 'ro_holidayFling', years: [1850, 2300], bind: freshFlame, scene: 'beach', title: 'Holiday romance',
    text: (x) => `On holiday you keep bumping into ${who(x)}, who seems to have exactly the same itinerary.`,
    choices: [
      { label: 'Spend the week together', tags: ['impulsive'], scene: 'nightTogether', run: (x) => { const t = fling(x, id(x), 'The week was a blur of sun and late nights; the rest is between you two.'); if (x.chance(0.3) && !x.lover()) x.chain('ro_chain_whirlwind', 1, { npcId: id(x) }); return t; } },
      { label: 'Swap addresses', tags: ['cautious'], scene: 'loveLetter', run: (x) => (x.chance(0.4) ? together(x, id(x), 'The letters kept coming long after the tan faded.') : 'You wrote twice. They wrote once. Postcards are not a strategy.') },
      { label: 'Keep sightseeing', run: (x) => { x.mods({ wisdom: 1 }); return 'You saw every cathedral. None of them winked back.'; } },
    ],
  }),
  R({
    id: 'ro_oldFlame', bind: (x) => (single(x) ? bindEx(x) : null), scene: 'reunion', title: 'Old flame',
    text: (x) => `You ran into ${who(x)}, your ex, who looks annoyingly well.`,
    choices: [
      { label: 'Get a coffee', tags: ['social'], run: (x) => (x.chance(0.45) ? together(x, id(x), 'Coffee became dinner. Old habits.') : (x.relMod(id(x), 8), 'It was nice. It was also clearly over.')) },
      { label: 'Ask why it ended', tags: ['ambitious'], run: (x) => { x.mods({ wisdom: 3, happiness: -2 }); return 'They told you. You did not enjoy it, but you needed it.'; } },
      { label: 'Nod and keep walking', tags: ['cautious'], run: (x) => { x.mods({ resilience: 1 }); return 'You nailed the casual nod. You practised it later anyway.'; } },
    ],
  }),
  R({
    id: 'ro_dogPark', when: (x) => x.pets('dog').length > 0, bind: freshFlame, scene: 'pet', title: 'Tangled leads',
    text: (x) => `Your dog and ${who(x)}'s dog have wound their leads around you both like a maypole.`,
    choices: [
      { label: 'Laugh and untangle', tags: ['social'], run: (x) => woo(x, 'By the time you were free, you had a walking date.') },
      { label: 'Blame their dog', tags: ['violent'], run: (x) => { x.relMod(id(x), -5); return 'Their dog looked hurt. So did they.'; } },
      { label: 'Suggest a weekly walk', tags: ['cautious'], run: (x) => { x.addRel(id(x), 'acquaintance', { affinity: 55 }); return 'The dogs are now best friends. The humans are working on it.'; } },
    ],
  }),
  R({
    id: 'ro_gymCrush', years: [1970, 2300], bind: freshFlame, scene: 'gym', title: 'Spot me?',
    text: (x) => `${who(x)} asks you to spot them on the bench, then asks your name, then asks if you come here often.`,
    choices: [
      { label: 'Flirt between sets', tags: ['social'], run: (x) => { x.train('strengthTraining', 1); return woo(x, 'Romance, measured in reps.'); } },
      { label: 'Focus on your workout', tags: ['cautious'], run: (x) => { x.mods({ fitness: 2 }); return 'Your gains were excellent. Your love life, unchanged.'; } },
      { label: 'Lift too heavy to impress', tags: ['impulsive'], run: (x) => { x.mods({ pain: 6, confidence: -2 }); return 'They helped you off the floor, which counts as a meet-cute.'; } },
    ],
  }),
  R({
    id: 'ro_rainDoorway', bind: freshFlame, scene: 'storm', title: 'Same doorway',
    text: (x) => `A downpour traps you in a doorway with ${who(x)}. Neither of you has ${x.year < 1750 ? 'a cloak' : 'an umbrella'}.`,
    choices: [
      { label: 'Run for it together', tags: ['impulsive'], scene: 'kiss', run: (x) => (x.chance(0.55) ? together(x, id(x), 'Soaked to the bone, you kissed under the next awning.') : 'You ran, they ran the other way. Very cinematic, very wet.') },
      { label: 'Make small talk', tags: ['social'], run: (x) => woo(x, 'The rain lasted an hour. So did the conversation.') },
      { label: 'Wait in silence', tags: ['cautious'], run: (x) => { x.mods({ loneliness: 2 }); return 'The rain stopped. So did whatever that was.'; } },
    ],
  }),
  R({
    id: 'ro_speedDating', years: [1999, 2300], when: single, scene: 'blindDate', title: 'Speed dating',
    text: 'Twelve strangers, three minutes each, one bell that sounds like a boxing match.',
    choices: [
      { label: 'Prepare killer questions', tags: ['ambitious'], run: (x) => { const n = newFlame(x); x.addRel(n.id, 'acquaintance', { affinity: 50 }); return x.chance(0.5 + x.stat('charisma') / 300) ? together(x, n.id, `"If you were a sandwich?" made ${n.firstName} laugh. It is love.`) : 'Twelve polite "nice to meet you"s and zero ticks.'; } },
      { label: 'Just enjoy the wine', tags: ['impulsive'], run: (x) => { x.mods({ happiness: 3 }); return 'You matched with the bartender. Not officially.'; } },
      { label: 'Leave at the break', tags: ['cautious'], run: (x) => { x.mods({ stress: -2 }); return 'Two minutes in, you remembered you own a sofa.'; } },
    ],
  }),
  R({
    id: 'ro_karaokeDuet', years: [1980, 2300], bind: freshFlame, scene: 'karaoke', title: 'The duet',
    text: (x) => `${who(x)} needs a partner for a love duet and is pointing at you with the microphone.`,
    choices: [
      { label: 'Sing your heart out', tags: ['impulsive'], run: (x) => { x.train('singing', 2); return woo(x, 'You missed every high note together.'); } },
      { label: 'Do the spoken bits', tags: ['cautious'], run: (x) => { x.relMod(id(x), 3); return 'You narrated a love song like a nature documentary. They loved it.'; } },
      { label: 'Decline', run: (x) => { x.mods({ confidence: -1 }); return 'Someone else sang it with them. Beautifully. You hated it.'; } },
    ],
  }),
  R({
    id: 'ro_trainStranger', years: [1840, 2300], bind: freshFlame, scene: 'travel', title: 'The night train',
    text: (x) => `On a long train journey, ${who(x)} in the opposite seat offers you half of their sandwich.`,
    choices: [
      { label: 'Talk all night', tags: ['social'], run: (x) => woo(x, 'You missed your stop on purpose.') },
      { label: 'Leave a note at your stop', tags: ['impulsive'], scene: 'loveLetter', run: (x) => (x.chance(0.35) ? together(x, id(x), 'They wrote back to the address on the note.') : 'The note blew out of the window.') },
      { label: 'Read your book', tags: ['cautious'], scene: 'reading', run: (x) => { x.mods({ smarts: 1 }); return 'Excellent book. You will never know about the sandwich.'; } },
    ],
  }),
  R({
    id: 'ro_newNeighbour', bind: freshFlame, scene: 'moving', title: 'New neighbour',
    text: (x) => `${who(x)} moved in next door and knocks to borrow ${x.year < 1900 ? 'a cup of flour' : 'a corkscrew'}.`,
    choices: [
      { label: 'Invite them in', tags: ['social'], run: (x) => woo(x, 'You lent them the thing and an evening.') },
      { label: 'Bake a welcome gift', tags: ['help'], scene: 'cooking', run: (x) => { x.train('baking', 2); x.addRel(id(x), 'acquaintance', { affinity: 60 }); return 'They said nobody had ever baked for them before.'; } },
      { label: 'Hand it over and close the door', tags: ['cautious'], run: () => 'Neighbourly, efficient, unromantic.' },
    ],
  }),
  R({
    id: 'ro_bookClub', years: [1800, 2300], bind: freshFlame, scene: 'reading', title: 'Book club',
    text: (x) => `At book club ${who(x)} defends the villain with such passion you forget to eat your biscuit.`,
    choices: [
      { label: 'Argue back', tags: ['ambitious'], run: (x) => { x.train('persuasion', 2); return woo(x, 'You argued for an hour and then got dinner.'); } },
      { label: 'Lend them your favourite', tags: ['help'], run: (x) => { x.relMod(id(x), 4); x.addRel(id(x), 'acquaintance', { affinity: 58 }); return 'They returned it with notes in the margins. Some of them about you.'; } },
      { label: 'Agree with everyone', tags: ['cautious'], run: () => 'A pleasant, forgettable meeting.' },
    ],
  }),
  R({
    id: 'ro_marketFlirt', years: [-800, 1850], bind: freshFlame, scene: 'flirt', title: 'Market day',
    text: (x) => `${who(x)}, selling ${x.pick(['figs', 'apples', 'honey', 'cheeses'])} at the market, keeps giving you extra and refusing your coins.`,
    choices: [
      { label: 'Come back tomorrow', tags: ['social'], run: (x) => woo(x, 'You bought so much fruit your family grew suspicious.') },
      { label: 'Insist on paying', tags: ['cautious'], run: (x) => { x.mods({ karma: 1 }); x.relMod(id(x), 2); return 'They pocketed the coin with a disappointed smile.'; } },
      { label: 'Steal a kiss', tags: ['impulsive'], scene: 'kiss', run: (x) => (x.chance(0.5) ? together(x, id(x), 'They kissed back, sticky with honey.') : (x.mods({ publicImage: -2 }), 'Their mother chased you out of the market with a broom.')) },
    ],
  }),
  R({
    id: 'ro_danceHall', years: [1900, 1965], bind: freshFlame, scene: 'dance', title: 'The dance hall',
    text: (x) => `The band strikes up and ${who(x)} is standing alone by the wall, tapping a foot.`,
    choices: [
      { label: 'Ask them to dance', tags: ['social'], run: (x) => { x.train('dance', 2); return woo(x, 'You stepped on their toes twice. They kept dancing.'); } },
      { label: 'Wait for the slow song', tags: ['cautious'], run: (x) => (x.chance(0.5) ? woo(x, 'You timed it perfectly.') : 'Someone else got there first.') },
      { label: 'Dance alone, magnificently', tags: ['impulsive'], run: (x) => { x.mods({ happiness: 5, popularity: 2 }); return 'The crowd cleared a circle. You were a legend for one song.'; } },
    ],
  }),
  R({
    id: 'ro_disco', years: [1972, 1985], bind: freshFlame, scene: 'party', title: 'Saturday night',
    text: (x) => `Under the mirror ball, ${who(x)} is doing a move you have never seen and want to learn.`,
    choices: [
      { label: 'Join in', tags: ['impulsive'], run: (x) => { x.train('dance', 2); return woo(x, 'You learned the move. You learned their name.'); } },
      { label: 'Buy them a cocktail', tags: ['social'], scene: 'bar', run: (x) => { x.spend(cost(x, 10)); return woo(x, 'Something blue with an umbrella in it.'); } },
      { label: 'Watch from the bar', tags: ['cautious'], run: () => 'The night ended with your feet still dry and your heart still yours.' },
    ],
  }),
  R({
    id: 'ro_aiCompanion', years: [2040, 2300], when: single, scene: 'gadget', title: 'Perfect companion',
    text: 'An advert offers an AI companion who "remembers every detail and never leaves the dishes".',
    choices: [
      { label: 'Subscribe', tags: ['impulsive'], run: (x) => { x.spend(cost(x, 30)); x.setFlag('aiCompanion', 1); x.mods({ loneliness: -8, happiness: 3 }); return 'It laughed at all your jokes. That should have been the warning.'; } },
      { label: 'Try a free trial', tags: ['cautious'], run: (x) => { x.mods({ loneliness: -3 }); return 'It was lovely, and then it asked for your card details mid-sentence.'; } },
      { label: 'Go out and meet humans', tags: ['social'], scene: 'friends', run: (x) => { x.mods({ loneliness: -2, confidence: 2 }); return 'Humans are messier. You decided that was the point.'; } },
    ],
  }),
  R({
    id: 'ro_vrDate', years: [2032, 2300], bind: freshFlame, scene: 'datingApp', title: 'Virtual date',
    text: (x) => `${who(x)} suggests your first date be on a virtual Venice canal. You can both fly.`,
    choices: [
      { label: 'Go virtual', tags: ['impulsive'], run: (x) => woo(x, 'Your avatars held hands over a pixel sunset.') },
      { label: 'Insist on real coffee', tags: ['cautious'], scene: 'date', run: (x) => woo(x, 'In person, they were shorter and funnier.') },
      { label: 'Show up as a dragon', tags: ['social'], run: (x) => (x.chance(0.5) ? woo(x, 'They came as a knight. Destiny.') : 'They did not appreciate the dragon.') },
    ],
  }),
];

// ------------------------------------------------------------------ era dates (family)
interface Outing {
  key: string;
  years: [number, number];
  scene: string;
  title: string;
  text: string;
  sweet: [string, string];
  safe: [string, string];
  wild: [string, string, string];
}

/** Dates in era settings. `{who}` is replaced by the partner's first name. */
const OUTINGS: Outing[] = [
  { key: 'romanBanquet', years: [-800, 476], scene: 'date', title: 'A Roman banquet', text: 'You and {who} recline at a banquet where the dormice are stuffed and the poet is drunk.', sweet: ['Feed them a grape', 'They laughed and fed you a whole bunch back.'], safe: ['Praise the host', 'The host was flattered; {who} was bored.'], wild: ['Recite a rude verse', 'The room roared and {who} could not stop laughing.', 'A senator choked on a dormouse. You were asked to leave.'] },
  { key: 'feastDay', years: [477, 1450], scene: 'festival', title: 'Feast day', text: 'It is a saint\'s feast day and {who} has saved you a place by the bonfire.', sweet: ['Give them a ribbon', 'They wore it in their hair until it frayed.'], safe: ['Share a cup of mead', 'Warm mead and warmer talk.'], wild: ['Leap the bonfire', 'You cleared it with a flourish. {who} swooned.', 'You did not clear it. Your eyebrows are a memory.'] },
  { key: 'masque', years: [1450, 1700], scene: 'royalBall', title: 'The masque', text: 'At a masked revel, {who} knows you instantly behind your mask. You pretend not to know them.', sweet: ['Lead them in a galliard', 'You leapt, they leapt, the court applauded.'], safe: ['Talk behind a fan', 'A whispered hour of perfect wit.'], wild: ['Swap masks with a duke', 'The confusion was glorious and {who} adored it.', 'The duke was not amused. Nor was his sword.'] },
  { key: 'pleasureGarden', years: [1700, 1850], scene: 'romance', title: 'Pleasure gardens', text: 'You promenade with {who} through lantern-lit pleasure gardens while an orchestra plays.', sweet: ['Find the dark walk', 'A stolen kiss beneath the lanterns.'], safe: ['Watch the fireworks', 'The fireworks were splendid; so was their hand in yours.'], wild: ['Climb onto the bandstand', 'You conducted the orchestra for a bar. {who} cheered.', 'You fell into the cellos. The cellos did not forgive you.'] },
  { key: 'promenade', years: [1837, 1910], scene: 'romance', title: 'Sunday promenade', text: 'A Sunday promenade with {who}, arm in arm, at a perfectly respectable distance.', sweet: ['Buy them violets', 'They pressed the violets in their prayer book.'], safe: ['Discuss the weather', 'A thorough and satisfying discussion of clouds.'], wild: ['Hire a rowing boat', 'You rowed into the sunset and {who} took an oar.', 'You rowed in circles and capsized by the ducks.'] },
  { key: 'speakeasy', years: [1920, 1933], scene: 'bar', title: 'The speakeasy', text: 'You and {who} give the password at a door with no sign. Inside, jazz and illegal gin.', sweet: ['Dance the Charleston', 'Knees, elbows and a kiss at the end.'], safe: ['Nurse one drink', 'You watched the room and held hands under the table.'], wild: ['Request a raunchy number', 'The band obliged and {who} sang along.', 'The police raided during the chorus. You escaped via the kitchen.'] },
  { key: 'driveIn', years: [1950, 1979], scene: 'cinema', title: 'The drive-in', text: 'A drive-in double feature with {who}. Nobody is watching the monster film.', sweet: ['Put your arm round them', 'The classic yawn-and-stretch. It worked.'], safe: ['Actually watch the film', 'The monster was made of rubber. You both loved it.'], wild: ['Climb onto the roof', 'You watched the stars instead of the screen.', 'The car next door honked until you climbed down.'] },
  { key: 'arcade', years: [1978, 1995], scene: 'gaming', title: 'Arcade date', text: '{who} is unbeatable at the arcade and is not going to let you win.', sweet: ['Win them a prize', 'Forty tokens for a plastic ring. They wear it.'], safe: ['Play co-op', 'You saved the galaxy together. Romantic, technically.'], wild: ['Challenge them for a bet', 'You lost and owe them dinner. You wanted to.', 'You won and gloated. The bus home was quiet.'] },
  { key: 'mallDate', years: [1985, 2008], scene: 'shopping', title: 'The mall', text: 'A date with {who} at the mall: food court, photo booth, too much perfume sprayed at you.', sweet: ['Take photo-booth pictures', 'The strip of four photos lived in your wallet for years.'], safe: ['Share a pretzel', 'One giant pretzel, two people, no regrets.'], wild: ['Ride the escalator the wrong way', 'Security chased you, laughing, out of the doors.', 'Security did not laugh. Neither did {who}.'] },
  { key: 'rooftop', years: [2009, 2040], scene: 'date', title: 'Rooftop bar', text: '{who} booked a rooftop bar with string lights and fourteen-dollar cocktails.', sweet: ['Put your phone away', 'No photos, just the city and each other.'], safe: ['Split the bill', 'Practical and fair. They liked that.'], wild: ['Order the flaming drink', 'You looked incredibly cool for four seconds.', 'You singed a fern. The fern had friends.'] },
  { key: 'orbital', years: [2060, 2300], scene: 'stargazing', title: 'Orbital dinner', text: 'Dinner with {who} on an orbital platform, the Earth turning slowly behind the dessert.', sweet: ['Point out your home town', 'You found it on the dark side, a tiny spark. They held your hand.'], safe: ['Order the recycled soup', 'Better than it sounds. Everything up here is.'], wild: ['Try zero-g dancing', 'You floated together like a slow comet.', 'You floated into the dessert trolley.'] },
];

function outing(o: Outing): EventDef {
  const fill = (x: Ctx, s: string) => s.split('{who}').join(who(x));
  return R({
    id: `ro_date_${o.key}`, years: o.years, weight: 1.1, bind: bindLover, scene: o.scene, title: o.title,
    text: (x) => fill(x, o.text),
    choices: [
      { label: o.sweet[0], tags: ['social'], scene: 'kiss', run: (x) => { x.relMod(id(x), 6, 2); x.mods({ happiness: 4 }); return fill(x, o.sweet[1]); } },
      { label: o.safe[0], tags: ['cautious'], run: (x) => { x.relMod(id(x), 3, 1); x.mods({ stress: -2 }); return fill(x, o.safe[1]); } },
      { label: o.wild[0], tags: ['impulsive'], run: (x) => { if (x.chance(0.55)) { x.relMod(id(x), 8); x.mods({ happiness: 6 }); return fill(x, o.wild[1]); } x.relMod(id(x), -3); x.mods({ confidence: -2 }); return fill(x, o.wild[2]); } },
    ],
  });
}

// ------------------------------------------------------------------ dating
const DATING: EventDef[] = [
  ...OUTINGS.map(outing),
  R({
    id: 'ro_meetParents', bind: bindPartner, scene: 'familyDinner', title: 'Meet the parents',
    text: (x) => `${who(x)}'s parents have invited you to dinner. Their father has already asked what you "do".`,
    choices: [
      { label: 'Bring a good gift', tags: ['help'], run: (x) => { x.spend(cost(x, 25)); x.relMod(id(x), 5, 3); return 'Their mother put it on the mantelpiece. A good sign.'; } },
      { label: 'Agree with everything', tags: ['cautious'], run: (x) => { x.relMod(id(x), 2); return 'You agreed with three contradictory opinions in a row.'; } },
      { label: 'Debate their father', tags: ['ambitious'], scene: 'argument', run: (x) => (x.stat('smarts') > 60 && x.chance(0.5) ? (x.relMod(id(x), 6), 'You won, and he respected it. He wants a rematch.') : (x.relMod(id(x), -6), 'The pudding was served in silence.')) },
    ],
  }),
  R({
    id: 'ro_meetFriends', bind: bindLover, scene: 'friends', title: 'The friend test',
    text: (x) => `You are meeting ${who(x)}'s friends for the first time. They have clearly been briefed.`,
    choices: [
      { label: 'Buy the first round', tags: ['social'], scene: 'bar', run: (x) => { x.spend(cost(x, 40)); x.relMod(id(x), 4); return 'Passed with flying colours, and a slight hangover.'; } },
      { label: 'Ask them embarrassing stories', tags: ['impulsive'], run: (x) => { x.relMod(id(x), x.chance(0.6) ? 4 : -3); return 'You learned about the camping trip. You may never unlearn it.'; } },
      { label: 'Stay quiet and polite', tags: ['cautious'], run: (x) => { x.relMod(id(x), 1); return 'One of them later described you as "fine". Ouch.'; } },
    ],
  }),
  R({
    id: 'ro_iLoveYou', bind: (x) => { const p = bindLover(x); return p && !x.rel(p.npcId as string)?.meta.saidLove ? p : null; }, scene: 'love', title: 'Three words',
    text: (x) => `You are watching ${x.year < 1900 ? 'the fire' : 'a terrible film'} with ${who(x)} and the words are right there.`,
    choices: [
      { label: 'Say it first', tags: ['impulsive'], scene: 'kiss', run: (x) => { const r = x.rel(id(x)); if (r) r.meta.saidLove = true; if (r && r.affinity > 50 && x.chance(0.75)) { x.relMod(id(x), 10, 5); x.mods({ happiness: 8 }); return '"I love you too," they said, before you had finished.'; } x.mods({ confidence: -4 }); return '"Thank you," they said. Thank you.'; } },
      { label: 'Wait for them', tags: ['cautious'], run: (x) => { if (x.chance(0.4)) { const r = x.rel(id(x)); if (r) r.meta.saidLove = true; x.relMod(id(x), 8); return 'They said it first, terrified. You said it back, delighted.'; } return 'Neither of you said it. The film ended.'; } },
      { label: 'Say it in another language', tags: ['social'], run: (x) => { const r = x.rel(id(x)); if (r) r.meta.saidLove = true; x.relMod(id(x), x.skill('languages') > 20 ? 9 : 3); return x.skill('languages') > 20 ? 'It sounded beautiful. They asked you to say it again.' : 'You said "I love cheese". The sentiment survived.'; } },
    ],
  }),
  R({
    id: 'ro_exTexting', years: [2000, 2300], bind: bindLover, scene: 'jealousy', title: "Who's that?",
    text: (x) => `${who(x)}'s phone lights up with a message from their ex. Then another. Then a heart.`,
    choices: [
      { label: 'Ask calmly', tags: ['cautious'], run: (x) => { x.relMod(id(x), 2, 4); return 'It was about returning a casserole dish. Probably.'; } },
      { label: 'Read the messages', tags: ['impulsive'], run: (x) => { x.relMod(id(x), -8, -10); x.mods({ paranoia: 3 }); return 'They caught you scrolling. The casserole dish became the least of it.'; } },
      { label: 'Let it go', tags: ['help'], run: (x) => { x.mods({ anxiety: 3 }); return 'You let it go. It did not let you go.'; } },
    ],
  }),
  R({
    id: 'ro_jealousColleague', when: (x) => !!x.lover(), bind: bindLover, scene: 'jealousy', title: 'That colleague',
    text: (x) => `${who(x)} keeps mentioning a colleague called ${x.pick(['Sam', 'Alex', 'Jordan', 'Robin', 'Charlie'])}. "So funny. So clever."`,
    choices: [
      { label: 'Say you feel jealous', tags: ['cautious'], scene: 'makeup', run: (x) => { x.relMod(id(x), 4, 6); return 'They held you and said you were being silly, which helped.'; } },
      { label: 'Turn up at their office', tags: ['impulsive'], run: (x) => { x.relMod(id(x), -6, -4); return 'The colleague was sixty-four and delightful. You felt ridiculous.'; } },
      { label: 'Make them jealous back', tags: ['ambitious'], scene: 'argument', run: (x) => { x.relMod(id(x), -5, -5); return 'An arms race of imaginary rivals. Nobody won.'; } },
    ],
  }),
  R({
    id: 'ro_exReturns', bind: (x) => { const l = bindLover(x); const e = bindEx(x); return l && e ? { npcId: e.npcId, homeId: l.npcId } : null; }, scene: 'affair', title: 'The ex returns',
    text: (x) => `${who(x)}, your ex, turns up with flowers and a speech about "the one that got away".`,
    choices: [
      { label: 'Send them away', tags: ['cautious'], run: (x) => { x.relMod(x.p.homeId as string, 4, 4); x.mods({ karma: 2 }); return 'You closed the door. It felt like closing a book.'; } },
      { label: 'Have one drink', tags: ['impulsive'], scene: 'bar', run: (x) => (x.chance(0.4) ? beginAffair(x, id(x)) : 'One drink, one honest talk, no regrets.') },
      { label: 'Tell your partner', tags: ['help'], run: (x) => { x.relMod(x.p.homeId as string, 6, 8); return `${x.first(x.p.homeId as string)} sent the flowers back with a note. A very good note.`; } },
    ],
  }),
  R({
    id: 'ro_longDistance', bind: bindPartner, scene: 'loveLetter', title: 'Long distance',
    text: (x) => `${who(x)} has to move ${x.year < 1900 ? 'to another province' : 'to another country'} for a year.`,
    choices: [
      { label: 'Make it work', tags: ['help'], run: (x) => { x.relMod(id(x), x.chance(0.6) ? 8 : -10, 4); x.mods({ loneliness: 6 }); return x.year < 1990 ? 'You wrote every week. The postman knows you by name.' : 'Video calls at strange hours and one very expensive flight.'; } },
      { label: 'Go with them', tags: ['impulsive'], scene: 'travel', run: (x) => { x.relMod(id(x), 10, 6); x.mods({ stress: 6 }); x.train('languages', 2); return 'You packed your life into two bags and followed your heart.'; } },
      { label: 'End it kindly', tags: ['cautious'], scene: 'heartbreak', run: (x) => endIt(x, 'You both cried at the station.') },
    ],
  }),
  R({
    id: 'ro_moveIn', years: [1955, 2300], when: (x) => x.w.socialNorms > 40, bind: (x) => { const p = bindPartner(x); return p && (x.rel(p.npcId as string)?.history ?? 0) >= 1 && !x.rel(p.npcId as string)?.meta.cohabit ? p : null; }, scene: 'moving', title: 'Moving in',
    text: (x) => `${who(x)} has a drawer at your place, a toothbrush, and now a question.`,
    choices: [
      { label: 'Move in together', tags: ['impulsive'], run: (x) => { const r = x.rel(id(x)); if (r) r.meta.cohabit = true; x.relMod(id(x), 8, 6); x.mods({ happiness: 5, loneliness: -6 }); return 'You now own two kettles and one shared future.'; } },
      { label: 'Not yet', tags: ['cautious'], run: (x) => { x.relMod(id(x), -4); return 'They said they understood. They took the toothbrush home.'; } },
      { label: 'Get a dog first', tags: ['social'], scene: 'pet', run: (x) => { x.relMod(id(x), 4); return 'A trial run with a beagle. The beagle approves.'; } },
    ],
  }),
  R({
    id: 'ro_firstFight', bind: bindLover, scene: 'argument', title: 'First real fight',
    text: (x) => `Your first proper fight with ${who(x)} started over ${x.pick(['the dishes', 'being late', 'a tone of voice', 'their mother', 'a board game'])} and somehow became about everything.`,
    choices: [
      { label: 'Apologise first', tags: ['help'], scene: 'makeup', run: (x) => { x.relMod(id(x), 5, 5); x.train('conflictResolution', 2); return 'You said sorry. They said sorry. You ordered takeaway.'; } },
      { label: 'Win the argument', tags: ['ambitious'], run: (x) => { x.relMod(id(x), -6, -4); x.mods({ ego: 2 }); return 'You won. You slept on the sofa as a champion.'; } },
      { label: 'Go for a walk', tags: ['cautious'], run: (x) => { x.relMod(id(x), 1); x.mods({ stress: -2 }); return 'You came back calm, and so had they.'; } },
    ],
  }),
  R({
    id: 'ro_loveLetter', bind: bindLover, scene: 'loveLetter', title: 'A love letter',
    text: (x) => `You want to write ${who(x)} a love ${note(x)}, but every draft sounds like a tax return.`,
    choices: [
      { label: 'Write from the heart', tags: ['help'], run: (x) => { x.train('writing', 2); x.relMod(id(x), 7, 3); return 'They kept it, and read it on bad days.'; } },
      { label: 'Borrow a famous poem', tags: ['cautious'], run: (x) => { x.relMod(id(x), x.chance(0.6) ? 4 : -2); return x.chance(0.5) ? 'They recognised it and loved you for trying.' : 'They noticed the bit about "thee" and laughed for a week.'; } },
      { label: 'Write a terrible poem', tags: ['impulsive'], run: (x) => { x.train('poetry', 2); x.relMod(id(x), 5); return 'You rhymed "love" with "glove" and "dove" and "shove". It is framed.'; } },
    ],
  }),
  R({
    id: 'ro_serenade', bind: bindLover, scene: 'serenade', title: 'The serenade',
    text: (x) => `You could stand beneath ${who(x)}'s window with a ${x.year < 1700 ? 'lute' : 'guitar'} tonight. The neighbours would also hear.`,
    choices: [
      { label: 'Sing a love song', tags: ['impulsive'], run: (x) => { x.train('singing', 2); if (x.skill('singing') > 25 || x.chance(0.5)) { x.relMod(id(x), 9); return 'They leaned out and threw down a rose.'; } x.relMod(id(x), 3); return 'Someone threw down a boot. Not them. Probably.'; } },
      { label: 'Hire a musician', tags: ['social'], run: (x) => { x.spend(cost(x, 60)); x.relMod(id(x), 6); return 'The musician was superb. You mouthed along.'; } },
      { label: 'Just knock', tags: ['cautious'], run: (x) => { x.relMod(id(x), 2); return 'They opened the door. A simpler kind of song.'; } },
    ],
  }),
  R({
    id: 'ro_stargazing', bind: bindLover, scene: 'stargazing', title: 'Under the stars',
    text: (x) => `You and ${who(x)} lie on a hill far from the lights. A shooting star crosses the sky.`,
    choices: [
      { label: 'Make a wish together', tags: ['social'], run: (x) => { x.relMod(id(x), 6); x.mods({ happiness: 5 }); return 'You both wished the same thing and refused to say what.'; } },
      { label: 'Name the constellations', tags: ['ambitious'], run: (x) => { x.train('astronomy', 2); x.relMod(id(x), 3); return 'Half of them you made up. "The Spoon" is canon now.'; } },
      { label: 'Fall asleep there', tags: ['impulsive'], scene: 'calm', run: (x) => { x.relMod(id(x), 5); x.mods({ health: -1 }); return 'You woke at dawn, damp and happy, a sheep watching you.'; } },
    ],
  }),
  R({
    id: 'ro_valentine', years: [1400, 2300], bind: bindLover, scene: 'valentine', title: "Valentine's Day",
    text: (x) => `It is the fourteenth of February and ${who(x)} has been very quiet about it, which is suspicious.`,
    choices: [
      { label: 'Go all out', tags: ['impulsive'], run: (x) => { x.spend(cost(x, 120)); x.relMod(id(x), 7); return 'Roses, dinner, chocolates. They had planned the same. Twice the roses.'; } },
      { label: 'Cook at home', tags: ['help'], scene: 'cooking', run: (x) => { x.train('cooking', 2); x.relMod(id(x), 6); return 'The smoke alarm sang. The pasta was perfect.'; } },
      { label: 'Call it a commercial holiday', tags: ['cautious'], run: (x) => { x.relMod(id(x), -5); return 'Technically correct. Romantically fatal.'; } },
    ],
  }),
  R({
    id: 'ro_anniversary', bind: (x) => { const p = bindLover(x); return p && (x.rel(p.npcId as string)?.history ?? 0) >= 2 ? p : null; }, scene: 'anniversary', title: 'Anniversary',
    text: (x) => `Another year with ${who(x)}. They have that look that means they remembered.`,
    choices: [
      { label: 'Recreate your first date', tags: ['social'], scene: 'date', run: (x) => { x.relMod(id(x), 7); return 'Same table, same order, same nerves, better ending.'; } },
      { label: 'Give a thoughtful gift', tags: ['help'], scene: 'jewelry', run: (x) => { x.spend(cost(x, 80)); x.relMod(id(x), 6); return 'They cried a little. Good crying.'; } },
      { label: 'Admit you forgot', tags: ['cautious'], scene: 'argument', run: (x) => { x.relMod(id(x), -8); return 'Honesty earned you points. Forgetting cost you more.'; } },
    ],
  }),
  R({
    id: 'ro_petNames', bind: bindLover, scene: 'love', title: 'Pet names',
    text: (x) => `${who(x)} has started calling you "${x.pick(['muffin', 'bean', 'sparrow', 'captain', 'little dumpling'])}". In public.`,
    choices: [
      { label: 'Embrace it', tags: ['social'], run: (x) => { x.relMod(id(x), 4); return 'You call them "turnip" now. It is mutual and disgusting.'; } },
      { label: 'Ask them to stop', tags: ['cautious'], run: (x) => { x.relMod(id(x), -1); return 'They agreed, then said it once more, quietly.'; } },
      { label: 'Escalate', tags: ['impulsive'], run: (x) => { x.relMod(id(x), 5); x.mods({ popularity: -1 }); return 'Your friends have started a jar for every "honey-bunch".'; } },
    ],
  }),
  R({
    id: 'ro_partnerLowWeek', bind: bindLover, scene: 'lonely', title: 'A hard week',
    text: (x) => `${who(x)} has had an awful week and barely spoke at dinner.`,
    choices: [
      { label: 'Listen, just listen', tags: ['help'], run: (x) => { x.train('empathyListening', 2); x.relMod(id(x), 7, 6); return 'You did not fix anything. That was exactly right.'; } },
      { label: 'Offer solutions', tags: ['ambitious'], run: (x) => { x.relMod(id(x), -2); return 'Seven solutions later they said, "I just wanted a hug."'; } },
      { label: 'Plan a surprise', tags: ['social'], scene: 'picnic', run: (x) => { x.relMod(id(x), 5); return 'A picnic in the living room. They smiled for the first time in days.'; } },
    ],
  }),
  R({
    id: 'ro_cookTogether', bind: bindLover, scene: 'cooking', title: 'Cooking together',
    text: (x) => `You and ${who(x)} attempt a recipe neither of you can pronounce.`,
    choices: [
      { label: 'Follow the recipe', tags: ['cautious'], run: (x) => { x.train('cooking', 2); x.relMod(id(x), 3); return 'It came out exactly like the picture, if the picture had been dropped.'; } },
      { label: 'Improvise', tags: ['impulsive'], run: (x) => { x.relMod(id(x), x.chance(0.5) ? 5 : -1); return 'You invented a dish. It should not be repeated.'; } },
      { label: 'Flour fight', tags: ['social'], scene: 'love', run: (x) => { x.relMod(id(x), 6); x.mods({ happiness: 4 }); return 'Dinner was toast. The kitchen will never be clean. Worth it.'; } },
    ],
  }),
  R({
    id: 'ro_coupleRoadTrip', years: [1700, 2300], bind: bindLover, scene: 'roadTrip', title: 'Road trip',
    text: (x) => `A long ${x.year < 1905 ? 'journey by carriage' : 'drive'} with ${who(x)}. Who controls the music is still being negotiated.`,
    choices: [
      { label: 'Let them choose', tags: ['help'], run: (x) => { x.relMod(id(x), 4); return 'Six hours of their playlist. You know all the words now.'; } },
      { label: 'Take the scenic route', tags: ['impulsive'], scene: 'romance', run: (x) => { x.relMod(id(x), 6); return 'You got lost, found a lake, and stayed until sunset.'; } },
      { label: 'Plan every stop', tags: ['cautious'], run: (x) => { x.relMod(id(x), 1); x.mods({ stress: -1 }); return 'Efficient. The itinerary was laminated.'; } },
    ],
  }),
  R({
    id: 'ro_partnerDream', bind: bindLover, scene: 'travel', title: 'Their big dream',
    text: (x) => `${who(x)} confides that they have always dreamt of ${x.pick(['opening a bakery', 'sailing round the world', 'writing a novel', 'living by the sea'])}.`,
    choices: [
      { label: 'Back them fully', tags: ['help'], run: (x) => { x.spend(cost(x, 500)); x.relMod(id(x), 9, 6); return 'They cried, then started making plans on a napkin.'; } },
      { label: 'Be realistic', tags: ['cautious'], run: (x) => { x.relMod(id(x), -3); return 'You were right about the money. They will remember you said it.'; } },
      { label: 'Do it together', tags: ['impulsive'], run: (x) => { x.relMod(id(x), 7); x.mods({ stress: 5, happiness: 5 }); return 'Two dreamers and no plan. It is going surprisingly well.'; } },
    ],
  }),
  R({
    id: 'ro_snoring', bind: (x) => (isTypeNow(x, 'spouse', 'partner') ? bindLover(x) : null), scene: 'lonely', title: 'The snoring',
    text: (x) => `${who(x)} snores like a ${x.year < 1850 ? 'blacksmith\'s bellows' : 'motorbike'}. You have not slept properly in weeks.`,
    choices: [
      { label: 'Buy earplugs', tags: ['cautious'], run: (x) => { x.spend(cost(x, 5)); x.mods({ energy: 5 }); return 'Silence at last. Love endures.'; } },
      { label: 'Record it as evidence', tags: ['impulsive'], run: (x) => { x.relMod(id(x), x.chance(0.5) ? 3 : -4); return 'They did not believe it was them until the playback.'; } },
      { label: 'Separate bedrooms', tags: ['ambitious'], run: (x) => { x.relMod(id(x), -2); x.mods({ energy: 8 }); return 'You sleep like a baby now. You miss them a little.'; } },
    ],
  }),
  R({
    id: 'ro_dancingLessons', years: [1800, 2300], bind: bindLover, scene: 'dance', title: 'Dancing lessons',
    text: (x) => `${who(x)} signed you both up for ${x.pick(['tango', 'salsa', 'waltz', 'swing'])} lessons. The instructor is terrifying.`,
    choices: [
      { label: 'Commit to it', tags: ['ambitious'], run: (x) => { x.train('dance', 3); x.relMod(id(x), 6); return 'By week six you were good. By week eight, insufferable.'; } },
      { label: 'Goof around', tags: ['impulsive'], run: (x) => { x.relMod(id(x), 4); return 'Thrown out of class, laughing, for "inventing moves".'; } },
      { label: 'Fake an injury', tags: ['cautious'], run: (x) => { x.relMod(id(x), -3); return 'Your limp kept migrating legs. They noticed.'; } },
    ],
  }),
  R({
    id: 'ro_surprisePicnic', years: [1800, 2300], bind: bindLover, scene: 'picnic', title: 'A surprise picnic',
    text: (x) => `${who(x)} has packed a picnic basket and won't tell you where you are going.`,
    choices: [
      { label: 'Go along with it', tags: ['social'], run: (x) => { x.relMod(id(x), 6); x.mods({ happiness: 4 }); return 'A meadow, cold wine and an extremely nosy goose.'; } },
      { label: 'Bring the umbrella', tags: ['cautious'], run: (x) => { x.relMod(id(x), 3); return 'It rained. You were a hero.'; } },
      { label: 'Swim in the lake', tags: ['impulsive'], scene: 'beach', run: (x) => { x.relMod(id(x), 5); x.mods({ health: -1 }); return 'Freezing, glorious, and you will both have colds.'; } },
    ],
  }),
];

// ------------------------------------------------------------------ intimacy (implied only)
const INTIMACY: EventDef[] = [
  R({
    id: 'ro_firstNight', weight: 1.4, bind: (x) => { const p = bindLover(x); return p && !x.rel(p.npcId as string)?.meta.night ? p : null; }, scene: 'kiss', title: 'At the door',
    text: (x) => `The evening with ${who(x)} ends at your door. Neither of you has said goodnight yet.`,
    choices: [
      { label: 'Invite them in', tags: ['impulsive'], scene: 'nightTogether', run: (x) => { const r = x.rel(id(x)); if (r) r.meta.night = true; x.relMod(id(x), 8, 4); x.mods({ happiness: 6, loneliness: -8 }); x.queue('ro_morningAfter', { npcId: id(x) }); return 'The door closed behind you both. The rest of the night is yours alone.'; } },
      { label: 'Kiss goodnight', tags: ['cautious'], run: (x) => { x.relMod(id(x), 4); return 'One long kiss, and you floated up the stairs.'; } },
      { label: 'Talk until dawn', tags: ['social'], scene: 'stargazing', run: (x) => { x.relMod(id(x), 6, 6); x.mods({ energy: -4 }); return 'You sat on the step and talked until the birds started.'; } },
    ],
  }),
  R({
    id: 'ro_morningAfter', triggered: true, scene: 'love', title: 'The morning after',
    text: (x) => `Sunlight through the curtains, and ${who(x)} is still here, wearing your ${x.year < 1900 ? 'nightshirt' : 'favourite T-shirt'}.`,
    choices: [
      { label: 'Make breakfast', tags: ['help'], scene: 'cooking', run: (x) => { x.relMod(id(x), 6, 4); return 'Burnt toast, perfect coffee, a very good morning.'; } },
      { label: 'Ask what this is', tags: ['ambitious'], run: (x) => { x.relMod(id(x), x.chance(0.6) ? 5 : -3, 3); return x.chance(0.6) ? '"I think it\'s something," they said. Good answer.' : '"Let\'s not label it," they said. Hmm.'; } },
      { label: 'Pretend to be asleep', tags: ['cautious'], run: (x) => { x.relMod(id(x), -2); return 'They pretended too. A stalemate of fake snoring.'; } },
    ],
  }),
  R({
    id: 'ro_weekendAway', years: [1850, 2300], bind: bindLover, scene: 'travel', title: 'A weekend away',
    text: (x) => `${who(x)} has booked a little ${x.year < 1950 ? 'seaside guesthouse' : 'cabin'} for the weekend. Just the two of you.`,
    choices: [
      { label: 'Switch off completely', tags: ['impulsive'], scene: 'nightTogether', run: (x) => { x.relMod(id(x), 8, 4); x.mods({ stress: -8, happiness: 6 }); return 'You barely left the room. The weather was irrelevant.'; } },
      { label: 'Plan activities', tags: ['ambitious'], scene: 'hiking', run: (x) => { x.relMod(id(x), 4); x.mods({ fitness: 2 }); return 'Three hikes, one museum, and a nap you both needed.'; } },
      { label: 'Bring work along', tags: ['cautious'], scene: 'office', run: (x) => { x.relMod(id(x), -5); x.mods({ professionalRep: 1 }); return 'Your laptop came too. It was the third wheel.'; } },
    ],
  }),
  R({
    id: 'ro_oneBed', years: [1800, 2300], bind: flameIf((x) => single(x) && x.employed), scene: 'travel', title: 'Only one bed',
    text: (x) => `A conference trip with your colleague ${who(x)}, and the hotel has made a mistake. One room. One bed.`,
    choices: [
      { label: 'Share it', tags: ['impulsive'], scene: 'nightTogether', run: (x) => (x.chance(0.6) ? together(x, id(x), 'You built a pillow wall. By morning it had fallen.') : (x.addRel(id(x), 'colleague', { affinity: 55 }), 'You slept back to back and became firm friends.')) },
      { label: 'Take the armchair', tags: ['help'], run: (x) => { x.addRel(id(x), 'colleague', { affinity: 60, trust: 60 }); x.mods({ pain: 3 }); return 'A gentleman\'s armchair. Your back will remember.'; } },
      { label: 'Demand another room', tags: ['cautious'], run: (x) => { x.spend(cost(x, 120)); x.addRel(id(x), 'colleague', { affinity: 45 }); return 'Professional and very expensive.'; } },
    ],
  }),
  R({
    id: 'ro_oneNight', bind: freshFlame, scene: 'flirt', title: 'Last orders',
    text: (x) => `Last orders. ${who(x)} leans over and says, "I'm not ready for tonight to end."`,
    choices: [
      { label: 'Go home with them', tags: ['impulsive'], scene: 'nightTogether', run: (x) => fling(x, id(x), 'You shared a taxi and a night. In the morning, a kind goodbye.') },
      { label: 'Get their number', tags: ['cautious'], run: (x) => woo(x, 'You wanted to do this properly.') },
      { label: 'Call it a night', run: (x) => { x.mods({ energy: 3 }); return 'You went home alone and slept like a stone.'; } },
    ],
  }),
  R({
    id: 'ro_breakfastInBed', bind: bindLover, scene: 'love', title: 'Breakfast in bed',
    text: (x) => `${who(x)} appears with a tray: eggs, coffee and a single flower in a glass.`,
    choices: [
      { label: 'Pull them back in', tags: ['impulsive'], scene: 'nightTogether', run: (x) => { x.relMod(id(x), 6); return 'Breakfast went cold. Nobody minded.'; } },
      { label: 'Return the favour tomorrow', tags: ['help'], run: (x) => { x.relMod(id(x), 5, 3); x.train('cooking', 1); return 'An arms race of breakfasts. Everyone wins.'; } },
      { label: 'Point out the crumbs', tags: ['cautious'], run: (x) => { x.relMod(id(x), -4); return 'Technically true. Romantically disastrous.'; } },
    ],
  }),
];

// ------------------------------------------------------------------ commitment
const vowed = (x: Ctx): void => {
  const r = x.rel(id(x));
  if (r) r.meta.vows = true;
};

const COMMITMENT: EventDef[] = [
  R({
    id: 'ro_proposalPlan', weight: 1.5, bind: (x) => { const p = bindPartner(x); return p && (x.rel(p.npcId as string)?.history ?? 0) >= 2 ? p : null; }, scene: 'proposal', title: 'The ring',
    text: (x) => `You have been carrying a ring around for weeks. Tonight could be the night to ask ${who(x)}.`,
    choices: [
      { label: 'Grand public gesture', tags: ['impulsive'], scene: 'proposal', run: (x) => { const r = x.rel(id(x)); const out = ask(x, r && r.affinity > 70 ? 10 : -10); if (out.endsWith('yes!') && x.chance(0.3)) x.queue('ro_coldFeet', { npcId: id(x) }); return `In front of everyone at ${x.year < 1900 ? 'the harvest dance' : 'the restaurant'}, you knelt. ${out}`; } },
      { label: 'Quietly, at home', tags: ['cautious'], scene: 'proposal', run: (x) => `On the sofa, in socks. ${ask(x, 4)}` },
      { label: 'Hide it in dessert', tags: ['social'], run: (x) => { if (x.chance(0.35)) { x.mods({ stress: 6 }); return 'They swallowed it. A doctor and three days later, you asked again with no dessert.'; } return `They found it with their spoon. ${ask(x, 2)}`; } },
      { label: 'Not yet', run: () => 'The ring goes back in the sock drawer.' },
    ],
  }),
  R({
    id: 'ro_theyPropose', weight: 1.3, bind: (x) => { const p = bindPartner(x); const r = p && x.rel(p.npcId as string); return r && r.history >= 2 && r.affinity > 55 ? p : null; }, scene: 'proposal', title: 'On one knee',
    text: (x) => `${who(x)} is suddenly on one knee, holding a ring and shaking slightly.`,
    choices: [
      { label: 'Say yes', tags: ['impulsive'], scene: 'kiss', run: (x) => { x.mods({ happiness: 10 }); x.remember('engaged', `Got engaged to ${x.name(id(x))}`, 25, id(x)); if (x.chance(0.25)) { x.queue('ro_coldFeet', { npcId: id(x) }); return 'Yes! You cried, they cried, a passing dog barked.'; } x.queue('wedding', { npcId: id(x) }, true); return 'Yes! You cried, they cried, a passing dog barked.'; } },
      { label: 'Ask for time', tags: ['cautious'], run: (x) => { x.relMod(id(x), -6, -2); return 'They nodded and put the ring away. The silence home was long.'; } },
      { label: 'Say no', tags: ['cautious'], scene: 'heartbreak', run: (x) => { x.relMod(id(x), -25, -10); x.mods({ happiness: -6 }); return x.chance(0.6) ? endIt(x, 'You could not marry them.') : 'They stayed, but something cracked.'; } },
    ],
  }),
  R({
    id: 'ro_coldFeet', triggered: true, scene: 'lonely', title: 'Cold feet',
    text: (x) => `The wedding to ${who(x)} is a week away and you are wide awake at 3am, counting doubts.`,
    choices: [
      { label: 'Talk to them', tags: ['help'], scene: 'makeup', run: (x) => { x.relMod(id(x), 5, 6); if (isType(x, 'partner')) x.queue('wedding', { npcId: id(x) }, true); return 'They admitted they were terrified too. That helped enormously.'; } },
      { label: 'Go through with it', tags: ['cautious'], run: (x) => { x.mods({ anxiety: 4 }); if (isType(x, 'partner')) x.queue('wedding', { npcId: id(x) }, true); return 'You told yourself everyone feels this way. Most do.'; } },
      { label: 'Call it off', tags: ['impulsive'], scene: 'heartbreak', run: (x) => { x.mods({ stress: 10 }); x.money(-cost(x, 2000)); return endIt(x, 'Deposits lost, relatives furious, and an enormous relief.'); } },
    ],
  }),
  R({
    id: 'ro_elope', bind: (x) => { const p = bindPartner(x); return p && (x.rel(p.npcId as string)?.affinity ?? 0) > 65 ? p : null; }, scene: 'romance', title: 'Run away together',
    text: (x) => `${who(x)} whispers, "What if we just ran off and got married? Tonight?"`,
    choices: [
      { label: 'Elope', tags: ['impulsive'], scene: 'wedding', run: (x) => { const t = elope(x, x.year < 1900 ? 'A midnight ride to the border and a sleepy parson.' : 'A courthouse, two strangers as witnesses, and pure joy.'); x.aliveParents().forEach((p) => x.relMod(p.id, -8)); return t; } },
      { label: 'Do it properly', tags: ['cautious'], run: (x) => `You want your families there. ${ask(x, 3)}` },
      { label: 'Laugh it off', run: (x) => { x.relMod(id(x), -3); return 'They were only half joking. You only half laughed.'; } },
    ],
  }),
  R({
    id: 'ro_ringShopping', years: [1850, 2300], bind: bindPartner, scene: 'jewelry', title: 'Ring shopping',
    text: 'The jeweller explains that a ring should cost "three months\' wages". You do some quick maths.',
    choices: [
      { label: 'Buy the big one', tags: ['ambitious'], run: (x) => { if (!x.spend(cost(x, 4000))) { x.c.debt += cost(x, 4000); } x.relMod(id(x), 4); return 'It sparkles like a small sun. So does your debt.'; } },
      { label: 'Find an antique', tags: ['cautious'], run: (x) => { x.spend(cost(x, 800)); x.relMod(id(x), 5); return 'It has a story. Now it has yours too.'; } },
      { label: 'Make one yourself', tags: ['help'], run: (x) => { x.train('jewelry', 3); x.relMod(id(x), 6); return 'Slightly lopsided, entirely priceless.'; } },
    ],
  }),
  R({
    id: 'ro_dowry', years: [-800, 1900], bind: bindPartner, scene: 'meeting', title: 'The dowry',
    text: (x) => `The families of you and ${who(x)} sit down to negotiate the dowry. There are goats involved.`,
    choices: [
      { label: 'Haggle hard', tags: ['ambitious'], run: (x) => { x.train('negotiation', 3); x.money(cost(x, 400)); x.relMod(id(x), -3); return 'You won three goats and a candlestick. They noticed how hard you fought.'; } },
      { label: 'Accept their offer', tags: ['cautious'], run: (x) => { x.relMod(id(x), 4); return 'Gracious and quick. Both mothers approved.'; } },
      { label: 'Refuse any dowry', tags: ['help'], run: (x) => { x.relMod(id(x), 8); x.mods({ karma: 2 }); return 'Scandalous generosity. The village talked for a month.'; } },
    ],
  }),
  R({
    id: 'ro_arranged', years: [-800, 1920], when: (x) => single(x) && (x.w.socialNorms < 50 || x.year < 1800), bind: freshFlame, scene: 'familyDinner', title: 'An arranged match',
    text: (x) => `Your family has arranged for you to marry ${who(x)}. You have met them once, at a funeral.`,
    choices: [
      { label: 'Honour the match', tags: ['cautious'], scene: 'wedding', run: (x) => { together(x, id(x), ''); const r = x.rel(id(x)); if (r && r.type === 'partner') { r.affinity = 45; return marry(x, id(x), { prenup: false, lavish: false }) + ' Love may come later. Sometimes it does.'; } return 'The arrangement fell through.'; } },
      { label: 'Meet them properly first', tags: ['social'], run: (x) => woo(x, 'You insisted on a walk, chaperoned.') },
      { label: 'Refuse', tags: ['impulsive'], scene: 'argument', run: (x) => { x.aliveParents().forEach((p) => x.relMod(p.id, -15, -10)); x.mods({ confidence: 3 }); return 'Your father did not speak to you until spring.'; } },
    ],
  }),
  R({
    id: 'ro_weddingBudget', years: [1900, 2300], when: (x) => x.hasMemory('engaged') && !x.spouse(), bind: bindPartner, scene: 'wedding', title: 'Wedding planning',
    text: (x) => `You and ${who(x)} are planning the wedding. The guest list has achieved sentience.`,
    choices: [
      { label: 'Keep it tiny', tags: ['cautious'], run: (x) => { x.mods({ stress: -3 }); x.relMod(id(x), 3); return 'Twenty people and a good band. Your aunt is not invited and knows it.'; } },
      { label: 'Invite everyone', tags: ['social'], run: (x) => { x.mods({ stress: 6, popularity: 3 }); x.money(-cost(x, 3000)); return 'Three hundred guests. You know about forty.'; } },
      { label: 'Let the parents decide', tags: ['help'], scene: 'familyDinner', run: (x) => { x.aliveParents().forEach((p) => x.relMod(p.id, 6)); x.relMod(id(x), -3); return 'Your mother is delighted. Your partner is quietly fuming.'; } },
    ],
  }),
  R({
    id: 'ro_vows', bind: (x) => { const p = bindSpouse(x); return p && yearsWed(x) === 0 && !x.rel(p.npcId as string)?.meta.vows ? p : null; }, weight: 2, scene: 'wedding', title: 'The vows',
    text: (x) => `At the altar, it is your turn to say your vows to ${who(x)}.`,
    choices: [
      { label: 'Speak from the heart', tags: ['help'], run: (x) => { vowed(x); x.relMod(id(x), 8, 6); return 'Not a dry eye in the house, including the officiant.'; } },
      { label: 'Make them laugh', tags: ['social'], run: (x) => { vowed(x); x.relMod(id(x), 5); x.train('humor', 1); return 'You promised to love them and to never touch their chips. Big laughs.'; } },
      { label: 'Forget the words', tags: ['cautious'], run: (x) => { vowed(x); x.mods({ confidence: -3 }); x.relMod(id(x), 2); return 'You blanked, then said "I just really love you." It worked.'; } },
    ],
  }),
  R({
    id: 'ro_honeymoon', weight: 3, bind: (x) => { const p = bindSpouse(x); return p && yearsWed(x) <= 1 && !x.rel(p.npcId as string)?.meta.honeymoon ? p : null; }, scene: 'honeymoon', title: 'Honeymoon',
    text: (x) => `Time for the honeymoon with ${who(x)}. Where to?`,
    choices: [
      { label: 'Somewhere tropical', tags: ['impulsive'], scene: 'honeymoon', run: (x) => { const r = x.rel(id(x)); if (r) r.meta.honeymoon = true; x.spend(cost(x, 3000)); x.relMod(id(x), 10, 4); x.mods({ happiness: 8, stress: -6 }); return 'Sun, sea, and a "do not disturb" sign that never came down.'; } },
      { label: 'A cheap cottage', tags: ['cautious'], scene: 'nightTogether', run: (x) => { const r = x.rel(id(x)); if (r) r.meta.honeymoon = true; x.spend(cost(x, 300)); x.relMod(id(x), 7); return 'It rained all week. You did not notice.'; } },
      { label: 'An adventure', tags: ['ambitious'], scene: 'hiking', run: (x) => { const r = x.rel(id(x)); if (r) r.meta.honeymoon = true; x.spend(cost(x, 1500)); x.relMod(id(x), x.chance(0.7) ? 9 : -3); return x.chance(0.7) ? 'You climbed a volcano together. Nothing will ever top it.' : 'Lost luggage, food poisoning, and a mule that hated you.'; } },
    ],
  }),
];

// ------------------------------------------------------------------ wedding disasters (family)
const WEDDING_MISHAPS: [string, string, string, [string, string], [string, string], [string, string]][] = [
  ['Rain on the day', 'storm', 'The heavens opened the moment you stepped outside to say "I do".', ['Dance in the rain', 'The photos are legendary. Everyone ruined their shoes.'], ['Move everything inside', 'Cosy, cramped and lovely.'], ['Blame the weather forecaster', 'You wrote a strongly worded letter on your wedding night.']],
  ['The objection', 'wedding', '"Does anyone object?" A hand goes up at the back. It is your ex.', ['Ignore them and carry on', 'You said "I do" louder than necessary.'], ['Let them speak', 'They said they would always love you, then left. Awkward cake.'], ['Have them removed', 'Two uncles carried them out like a rolled carpet.']],
  ['The cake collapse', 'birthday', 'The five-tier cake leans, sways and collapses into the dessert table.', ['Eat it off the floor', 'Everyone grabbed a spoon. Best cake ever.'], ['Laugh it off', 'It became the best story of the day.'], ['Sue the baker', 'You won, eventually. The cake did not come back.']],
  ['The drunk uncle', 'party', 'Your uncle has commandeered the microphone and is telling the story of the hen-house incident.', ['Join in', 'You told your side. The room wept with laughter.'], ['Cut the microphone', 'Silence, then applause.'], ['Let him finish', 'It was worse than you remembered.']],
  ['The lost ring', 'jewelry', 'The best man pats his pockets. Then pats them again. The ring is gone.', ['Use a curtain ring', 'It held. So did the marriage.'], ['Search the church', 'Found in the font. Blessed, presumably.'], ['Panic loudly', 'The guests helped search. The ring was on his thumb.']],
];

const MISHAP_EVENTS: EventDef[] = WEDDING_MISHAPS.map(([title, scene, text, a, b, c], i) =>
  R({
    id: `ro_weddingMishap${i + 1}`, weight: 2.5, cooldown: 30, bind: (x) => (yearsWed(x) === 0 ? bindSpouse(x) : null), scene, title, text,
    choices: [
      { label: a[0], tags: ['impulsive'], run: (x) => { x.mods({ happiness: 5 }); x.relMod(id(x), 4); return a[1]; } },
      { label: b[0], tags: ['cautious'], run: (x) => { x.relMod(id(x), 2); x.mods({ stress: -1 }); return b[1]; } },
      { label: c[0], tags: ['ambitious'], run: (x) => { x.mods({ stress: 3 }); return c[1]; } },
    ],
  }),
);

// ------------------------------------------------------------------ married life
const bindInLaw = (x: Ctx): Params | null => {
  const sp = bindSpouse(x);
  const il = x.rels('inLaw').find((q) => alive(x, q.npcId));
  return sp && il ? { npcId: sp.npcId, inLaw: il.npcId } : null;
};

const MARRIED: EventDef[] = [
  R({
    id: 'ro_routine', bind: (x) => (yearsWed(x) >= 3 ? bindSpouse(x) : null), scene: 'calm', title: 'Same old Tuesday',
    text: (x) => `Dinner, dishes, ${x.year < 1930 ? 'the wireless' : x.year < 2000 ? 'the telly' : 'a show'}, bed. You and ${who(x)} could do it blindfolded.`,
    choices: [
      { label: 'Shake it up', tags: ['impulsive'], scene: 'dance', run: (x) => { x.relMod(id(x), 6); x.mods({ happiness: 4 }); return 'You put on music and danced in the kitchen. They laughed until they cried.'; } },
      { label: 'Enjoy the comfort', tags: ['cautious'], run: (x) => { x.relMod(id(x), 2); x.mods({ stress: -3 }); return 'There is love in a quiet Tuesday too.'; } },
      { label: 'Complain about it', tags: ['ambitious'], scene: 'argument', run: (x) => { x.relMod(id(x), -4); return '"So it\'s boring now?" Ah. Wrong word.'; } },
    ],
  }),
  R({
    id: 'ro_sparkFading', bind: (x) => { const p = bindSpouse(x); return p && yearsWed(x) >= 5 && (x.rel(p.npcId as string)?.affinity ?? 100) < 70 ? p : null; }, scene: 'lonely', title: 'The spark',
    text: (x) => `You and ${who(x)} talk mainly about bins and bills now. When did you last really look at each other?`,
    choices: [
      { label: 'Plan a surprise night', tags: ['help'], scene: 'date', run: (x) => { x.spend(cost(x, 100)); x.relMod(id(x), 9, 3); return 'They wore the thing from your first date. You both remembered.'; } },
      { label: 'Talk about it honestly', tags: ['cautious'], run: (x) => { x.relMod(id(x), 5, 6); x.train('conflictResolution', 2); return 'A hard, tender conversation. Better than another quiet dinner.'; } },
      { label: 'Ignore it', run: (x) => { x.relMod(id(x), -5); x.mods({ loneliness: 5 }); return 'You stopped noticing the distance. That was the problem.'; } },
    ],
  }),
  R({
    id: 'ro_rekindled', bind: (x) => (yearsWed(x) >= 4 ? bindSpouse(x) : null), scene: 'romance', title: 'Rekindled',
    text: (x) => `Out of nowhere, ${who(x)} takes your hand on a walk like it is your first year again.`,
    choices: [
      { label: 'Take the long way home', tags: ['social'], scene: 'nightTogether', run: (x) => { x.relMod(id(x), 8, 4); x.mods({ happiness: 6 }); return 'The long way home, the early night. Old flames burn well.'; } },
      { label: 'Tell them why you married them', tags: ['help'], run: (x) => { x.relMod(id(x), 7, 5); return 'You listed seven reasons. They made you write them down.'; } },
      { label: 'Ask what they want', tags: ['cautious'], run: (x) => { x.relMod(id(x), 3); return '"Nothing," they said. "Just you." Suspicious, but lovely.'; } },
    ],
  }),
  R({
    id: 'ro_dateNight', bind: bindSpouse, weight: 1.2, scene: 'date', title: 'Date night',
    text: (x) => `Date night with ${who(x)}. ${x.children().length ? 'The babysitter costs more than dinner.' : 'You have no excuse not to.'}`,
    choices: [
      { label: 'Somewhere new', tags: ['impulsive'], scene: 'restaurant', run: (x) => { x.spend(cost(x, 80)); x.relMod(id(x), 6); return 'Small plates, big prices, holding hands across the table.'; } },
      { label: 'The usual place', tags: ['cautious'], run: (x) => { x.spend(cost(x, 40)); x.relMod(id(x), 3); return 'The waiter knows your order. That is its own romance.'; } },
      { label: 'Fall asleep on the sofa', run: (x) => { x.relMod(id(x), 1); x.mods({ energy: 5 }); return 'You both dozed off by nine. Honestly perfect.'; } },
    ],
  }),
  R({
    id: 'ro_couplesTherapy', years: [1950, 2300], bind: (x) => { const p = bindLover(x); return p && (x.rel(p.npcId as string)?.affinity ?? 100) < 50 ? p : null; }, scene: 'calm', title: 'Couples therapy',
    text: (x) => `${who(x)} has booked a couples therapist. The sofa in the office is very beige.`,
    choices: [
      { label: 'Open up', tags: ['help'], run: (x) => { x.spend(cost(x, 150)); x.relMod(id(x), x.chance(0.65) ? 12 : 2, 8); x.train('empathyListening', 2); return 'You said things you had never said. Some of them helped.'; } },
      { label: 'Go but say little', tags: ['cautious'], run: (x) => { x.spend(cost(x, 150)); x.relMod(id(x), 2); return 'The therapist wrote "guarded" on a notepad. You saw.'; } },
      { label: 'Refuse to go', tags: ['impulsive'], scene: 'argument', run: (x) => { x.relMod(id(x), -10, -6); return 'They went alone. That said a lot.'; } },
    ],
  }),
  R({
    id: 'ro_moneyFight', bind: bindSpouse, scene: 'argument', title: 'Money',
    text: (x) => `${who(x)} found a receipt for something you bought. You found one of theirs. It is war.`,
    choices: [
      { label: 'Make a budget together', tags: ['cautious'], run: (x) => { x.train('bookkeeping', 2); x.relMod(id(x), 4, 4); return 'A spreadsheet of peace. You each get "fun money".'; } },
      { label: 'Defend your purchase', tags: ['ambitious'], run: (x) => { x.relMod(id(x), -6); return 'You argued that the boat was an investment. It is not.'; } },
      { label: 'Return it', tags: ['help'], scene: 'makeup', run: (x) => { x.money(cost(x, 100)); x.relMod(id(x), 5); return 'You returned it. They returned theirs. Hugs.'; } },
    ],
  }),
  R({
    id: 'ro_inLawVisit', bind: bindInLaw, scene: 'familyDinner', title: 'In-laws visit',
    text: (x) => `${x.first(x.p.inLaw as string)}, your in-law, is staying "for a few days". They have brought nine suitcases.`,
    choices: [
      { label: 'Charm them', tags: ['social'], run: (x) => { x.relMod(x.p.inLaw as string, 8); x.relMod(id(x), 4); return 'You laughed at every story. They now say you are their favourite.'; } },
      { label: 'Set boundaries', tags: ['cautious'], run: (x) => { x.relMod(x.p.inLaw as string, -4); x.relMod(id(x), x.chance(0.5) ? 3 : -3); return 'They left on day four, mildly offended, slightly impressed.'; } },
      { label: 'Hide at work', tags: ['impulsive'], scene: 'office', run: (x) => { x.relMod(id(x), -5); x.mods({ professionalRep: 1 }); return 'You worked overtime for a week. Your spouse did not forget.'; } },
    ],
  }),
  R({
    id: 'ro_inLawCooking', bind: bindInLaw, scene: 'cooking', title: 'The family recipe',
    text: (x) => `${x.first(x.p.inLaw as string)} watches you cook and says, "That's not how we make it."`,
    choices: [
      { label: 'Ask them to teach you', tags: ['help'], run: (x) => { x.train('cooking', 3); x.relMod(x.p.inLaw as string, 8); return 'Two hours and a family secret later, you are one of them.'; } },
      { label: 'Cook it your way', tags: ['ambitious'], run: (x) => { x.relMod(x.p.inLaw as string, -5); return 'Everyone had seconds. Nobody said a word.'; } },
      { label: 'Hand them the spoon', tags: ['cautious'], run: (x) => { x.relMod(x.p.inLaw as string, 3); x.mods({ stress: -2 }); return 'You sat down with a glass of wine. Victory by surrender.'; } },
    ],
  }),
  R({
    id: 'ro_renewVows', bind: (x) => (yearsWed(x) >= 10 ? bindSpouse(x) : null), cooldown: 10, scene: 'wedding', title: 'Renewing vows',
    text: (x) => `${yearsWed(x)} years married. ${who(x)} suggests renewing your vows.`,
    choices: [
      { label: 'A big party', tags: ['social'], scene: 'party', run: (x) => { x.spend(cost(x, 2000)); x.relMod(id(x), 9); x.mods({ happiness: 6 }); return 'The same vows, older voices, more meaning.'; } },
      { label: 'Just the two of you', tags: ['cautious'], scene: 'romance', run: (x) => { x.relMod(id(x), 8, 4); return 'On the beach where you met, no audience, no notes.'; } },
      { label: 'Say it\'s unnecessary', run: (x) => { x.relMod(id(x), -5); return '"We know we love each other," you said. They wanted to hear it anyway.'; } },
    ],
  }),
  R({
    id: 'ro_choresWar', years: [1900, 2300], bind: (x) => (isTypeNow(x, 'spouse', 'partner') ? bindLover(x) : null), scene: 'argument', title: 'The chore war',
    text: (x) => `There is a mug in the sink. ${who(x)} says it is yours. It has been there four days.`,
    choices: [
      { label: 'Make a rota', tags: ['cautious'], run: (x) => { x.relMod(id(x), 4, 2); return 'Colour-coded. Laminated. Mostly followed.'; } },
      { label: 'Wash it in silence', tags: ['help'], run: (x) => { x.relMod(id(x), 2); x.mods({ stress: 1 }); return 'Clean mug. Unresolved feelings.'; } },
      { label: 'Leave it as a protest', tags: ['impulsive'], run: (x) => { x.relMod(id(x), -5); return 'The mug grew a small civilisation.'; } },
    ],
  }),
  R({
    id: 'ro_spouseJobAbroad', years: [1850, 2300], bind: bindSpouse, scene: 'travel', title: 'A job abroad',
    text: (x) => `${who(x)} has been offered a dream job in another country. They want you to come.`,
    choices: [
      { label: 'Go together', tags: ['help'], scene: 'moving', run: (x) => { x.relMod(id(x), 10, 6); x.mods({ stress: 8 }); x.train('languages', 3); return 'New city, new language, same two of you.'; } },
      { label: 'Ask them to decline', tags: ['ambitious'], run: (x) => { x.relMod(id(x), -10, -4); return 'They declined. They will always wonder.'; } },
      { label: 'Try living apart', tags: ['cautious'], scene: 'loveLetter', run: (x) => { x.relMod(id(x), x.chance(0.5) ? 4 : -8); x.mods({ loneliness: 8 }); return 'You count the days between visits.'; } },
    ],
  }),
  R({
    id: 'ro_spouseHobby', bind: bindSpouse, scene: 'gardening', title: 'The new obsession',
    text: (x) => `${who(x)} has taken up ${x.pick(['beekeeping', 'birdwatching', 'sourdough', 'model trains', 'competitive gardening'])} and talks about nothing else.`,
    choices: [
      { label: 'Join in', tags: ['social'], run: (x) => { x.relMod(id(x), 6); return 'You are now also obsessed. The house is full of it.'; } },
      { label: 'Nod supportively', tags: ['help'], run: (x) => { x.relMod(id(x), 2); return 'You have nodded through 400 hours of facts.'; } },
      { label: 'Ban it from dinner', tags: ['ambitious'], run: (x) => { x.relMod(id(x), -3); return 'Dinner is quiet. Painfully quiet.'; } },
    ],
  }),
  R({
    id: 'ro_babyTalk', maxAge: 44, bind: (x) => (x.children().length === 0 ? bindSpouse(x) : null), scene: 'family', title: 'The baby question',
    text: (x) => `${who(x)} has started lingering by ${x.year < 1900 ? 'other people\'s cradles' : 'baby clothes in shop windows'}. Clearly a conversation is coming.`,
    choices: [
      { label: 'Try for a baby', tags: ['impulsive'], scene: 'nightTogether', run: (x) => { x.relMod(id(x), 6); return tryForBaby(x); } },
      { label: 'Wait a few years', tags: ['cautious'], run: (x) => { x.relMod(id(x), -2); return 'You agreed to revisit it. The calendar has a sticky note.'; } },
      { label: 'Get a pet first', tags: ['social'], scene: 'pet', run: (x) => { x.relMod(id(x), 3); return 'A puppy. Practice for sleepless nights.'; } },
    ],
  }),
  R({
    id: 'ro_kitchenDance', minAge: 60, bind: bindSpouse, scene: 'dance', title: 'Kitchen waltz',
    text: (x) => `Your old song comes on while you and ${who(x)} are washing up.`,
    choices: [
      { label: 'Dance with them', tags: ['social'], run: (x) => { x.relMod(id(x), 7); x.mods({ happiness: 6 }); return 'Slow, creaky, perfect. The plates can wait.'; } },
      { label: 'Sing along badly', tags: ['impulsive'], run: (x) => { x.relMod(id(x), 4); return 'You got the words wrong like you always have. They corrected you like they always do.'; } },
      { label: 'Keep washing', tags: ['cautious'], run: (x) => { x.mods({ loneliness: 2 }); return 'They hummed it alone, looking at you.'; } },
    ],
  }),
  R({
    id: 'ro_goldenAnniversary', bind: (x) => (yearsWed(x) >= 50 ? bindSpouse(x) : null), once: true, weight: 4, scene: 'anniversary', title: 'Golden anniversary',
    text: (x) => `Fifty years married to ${who(x)}. The grandchildren have organised a party you are pretending not to know about.`,
    choices: [
      { label: 'Give a speech', tags: ['social'], scene: 'grandparents', run: (x) => { x.relMod(id(x), 10); x.mods({ happiness: 10 }); return 'You said, "Still the best decision I ever made." The room dissolved.'; } },
      { label: 'Slip away together', tags: ['cautious'], scene: 'romance', run: (x) => { x.relMod(id(x), 10); return 'You sneaked off for chips on the seafront, like the old days.'; } },
      { label: 'Dance until midnight', tags: ['impulsive'], scene: 'dance', run: (x) => { x.mods({ happiness: 8, pain: 4 }); return 'Your hips will complain for a month. Worth every step.'; } },
    ],
  }),
  R({
    id: 'ro_spouseIll', bind: bindSpouse, minAge: 50, scene: 'sick', title: 'In sickness',
    text: (x) => `${who(x)} has been ill for weeks. They keep apologising for being a burden.`,
    choices: [
      { label: 'Care for them yourself', tags: ['help'], run: (x) => { x.relMod(id(x), 10, 8); x.mods({ stress: 8, karma: 3 }); return 'Soup, stories and holding their hand at 3am. "In sickness" was never a figure of speech.'; } },
      { label: 'Hire a nurse', tags: ['cautious'], scene: 'hospital', run: (x) => { x.spend(cost(x, 1500)); x.relMod(id(x), 4); return 'Professional care and you by the bed every evening.'; } },
      { label: 'Bury yourself in work', tags: ['ambitious'], run: (x) => { x.relMod(id(x), -8); x.mods({ stress: 5 }); return 'You told yourself someone had to pay the bills. They noticed the empty chair.'; } },
    ],
  }),
  R({
    id: 'ro_phoneSnoop', years: [2005, 2300], bind: (x) => (isTypeNow(x, 'spouse', 'partner') ? bindLover(x) : null), scene: 'jealousy', title: 'Snooping',
    text: (x) => `You catch ${who(x)} scrolling through your phone while you were in the shower.`,
    choices: [
      { label: 'Ask what they are afraid of', tags: ['help'], run: (x) => { x.relMod(id(x), 3, 4); return x.lovers().length > 1 ? 'Your heart pounded. They found nothing this time.' : 'Old wounds from an old relationship. You talked it through.'; } },
      { label: 'Get angry', tags: ['violent'], scene: 'argument', run: (x) => { x.relMod(id(x), -6, -6); return 'Shouting about privacy. Nobody slept well.'; } },
      { label: 'Hand them the password', tags: ['cautious'], run: (x) => { x.relMod(id(x), 2, x.lovers().length > 1 ? -20 : 8); if (x.rels('affair').length && x.chance(0.6)) return caught(x, x.rels('affair')[0].npcId); return 'Nothing to hide. They felt silly and loved.'; } },
    ],
  }),
  R({
    id: 'ro_marriedFlirt', bind: tempter, scene: 'flirt', title: 'Harmless flirting',
    text: (x) => `${who(x)} at ${x.employed ? 'work' : 'the club'} flirts with you outrageously. You are definitely married. Or taken, at least.`,
    choices: [
      { label: 'Flirt back a little', tags: ['impulsive'], run: (x) => { x.mods({ ego: 3, sin: 1 }); x.addRel(id(x), 'acquaintance', { affinity: 60, meta: { tempting: true } }); return 'Harmless. Probably. You thought about it all the way home.'; } },
      { label: 'Mention your partner', tags: ['cautious'], run: (x) => { x.mods({ karma: 1 }); const l = x.lover(); if (l) x.relMod(l.npcId, 2); return 'You mentioned them three times in a minute. Message received.'; } },
      { label: 'Tell your partner about it', tags: ['help'], run: (x) => { const l = x.lover(); if (l) x.relMod(l.npcId, 4, 6); return 'They laughed, then held your hand slightly tighter.'; } },
    ],
  }),
  R({
    id: 'ro_secondHoneymoon', years: [1900, 2300], bind: (x) => (yearsWed(x) >= 15 ? bindSpouse(x) : null), cooldown: 12, scene: 'honeymoon', title: 'Second honeymoon',
    text: (x) => `After ${yearsWed(x)} years, you and ${who(x)} finally take the trip you never had time for.`,
    choices: [
      { label: 'Go back to the honeymoon spot', tags: ['social'], run: (x) => { x.spend(cost(x, 2500)); x.relMod(id(x), 9); return 'The hotel had changed. You had not, not really.'; } },
      { label: 'Somewhere completely new', tags: ['impulsive'], scene: 'travel', run: (x) => { x.spend(cost(x, 3000)); x.relMod(id(x), 8); x.mods({ wisdom: 2 }); return 'New place, old love, a few new tricks.'; } },
      { label: 'Stay home and save', tags: ['cautious'], run: (x) => { x.relMod(id(x), -3); return 'Very sensible. The brochure stays on the fridge.'; } },
    ],
  }),
  R({
    id: 'ro_bickering', minAge: 55, bind: (x) => (yearsWed(x) >= 20 ? bindSpouse(x) : null), scene: 'argument', title: 'Old married bickering',
    text: (x) => `You and ${who(x)} have been arguing about whether it was 1-9-something or the year after for twenty minutes.`.replace('1-9-something', String(x.year - x.int(20, 40))),
    choices: [
      { label: 'Concede graciously', tags: ['help'], run: (x) => { x.relMod(id(x), 3); return 'You were right, of course. You will tell them in ten years.'; } },
      { label: 'Find the evidence', tags: ['ambitious'], run: (x) => { x.relMod(id(x), x.chance(0.5) ? 2 : -2); return 'You dug out the photo album. Then you looked at it together for an hour.'; } },
      { label: 'Change the subject', tags: ['cautious'], run: () => 'A truce, until next Sunday.' },
    ],
  }),
];

// ------------------------------------------------------------------ temptation and affairs
const home = (x: Ctx): string => x.first(x.p.homeId as string);
const affairLive = (x: Ctx): boolean => isType(x, 'affair') && !!x.lover();
const slip = (x: Ctx, d: number): boolean => {
  const r = x.rel(id(x));
  if (!r) return false;
  const disc = (typeof r.meta.discretion === 'number' ? r.meta.discretion : 50) - d;
  r.meta.discretion = disc;
  return x.chance(Math.max(0.03, (60 - disc) / 120));
};
function endAffair(x: Ctx, lead: string): string {
  const r = x.rel(id(x));
  if (r) {
    r.type = 'ex';
    r.affinity = Math.min(r.affinity, 30);
    r.meta.endedAge = x.age;
  }
  x.endChain('ro_chain_affair');
  x.mods({ stress: -4, karma: 2 });
  return lead;
}

const AFFAIRS: EventDef[] = [
  R({
    id: 'ro_temptation', bind: tempter, scene: 'flirt', title: 'Temptation',
    text: (x) => `${who(x)} and you have been working late together. Tonight they say, "We both know what this is."`,
    choices: [
      { label: 'Kiss them', tags: ['impulsive'], scene: 'affair', run: (x) => beginAffair(x, id(x)) },
      { label: 'Walk away', tags: ['cautious'], run: (x) => { x.mods({ karma: 2, willpower: 2 }); x.addRel(id(x), 'colleague', { affinity: 35 }); return 'You picked up your coat and went home to the one you love.'; } },
      { label: 'Tell your partner', tags: ['help'], run: (x) => { const l = x.lover(); if (l) x.relMod(l.npcId, 5, 8); return 'Honesty hurt a little. It also bound you closer.'; } },
    ],
  }),
  R({
    id: 'ro_secretMeeting', weight: 1.5, bind: bindAffair, scene: 'affair', title: 'Secret meeting',
    text: (x) => `${who(x)} sends word: the usual place, ${x.year < 1900 ? 'after vespers' : 'eight o\'clock'}. You have already told ${home(x)} you are "working late".`,
    choices: [
      { label: 'Go to them', tags: ['impulsive'], scene: 'nightTogether', run: (x) => { x.relMod(id(x), 5); x.mods({ happiness: 4, stress: 4, sin: 1 }); return slip(x, 10) ? caught(x, id(x)) : 'Stolen hours behind a locked door. Home by midnight, heart racing.'; } },
      { label: 'Cancel', tags: ['cautious'], run: (x) => { x.relMod(id(x), -4); x.mods({ stress: -2 }); return 'You stayed home. Every knock on the door made you jump.'; } },
      { label: 'End it tonight', tags: ['help'], scene: 'heartbreak', run: (x) => endAffair(x, `You told ${who(x)} it was over. They did not take it well.`) },
    ],
  }),
  R({
    id: 'ro_nearMiss', bind: bindAffair, scene: 'jealousy', title: 'Nearly caught',
    text: (x) => `${home(x)} is home early and ${who(x)}'s ${x.year < 1950 ? 'gloves are' : 'scarf is'} on the hall table.`,
    choices: [
      { label: 'Invent a story', tags: ['ambitious'], run: (x) => { x.train('deception', 2); return x.chance(0.5 + x.skill('deception') / 200) ? 'A lost-property tale so detailed you nearly believed it.' : caught(x, id(x)); } },
      { label: 'Hide it fast', tags: ['impulsive'], run: (x) => (slip(x, 15) ? caught(x, id(x)) : 'Stuffed in the umbrella stand. Your pulse took an hour to settle.') },
      { label: 'Confess everything', tags: ['help'], run: (x) => { x.mods({ karma: 3 }); return caught(x, id(x)); } },
    ],
  }),
  R({
    id: 'ro_ultimatum', bind: bindAffair, scene: 'affair', title: 'The ultimatum',
    text: (x) => `${who(x)} is done being a secret: "Leave ${home(x)}, or I leave you."`,
    choices: [
      { label: `Leave for them`, tags: ['impulsive'], scene: 'moving', run: (x) => { const h = x.p.homeId as string; const r = x.rel(h); let t = ''; if (r?.type === 'spouse') t = divorce(x, h); else t = breakUp(x, h); const a = x.rel(id(x)); if (a) a.type = 'partner'; x.endChain('ro_chain_affair'); return `${t} You and ${who(x)} are together now, out in the open.`; } },
      { label: 'Promise "soon"', tags: ['cautious'], run: (x) => { x.relMod(id(x), -8, -10); x.mods({ stress: 6 }); return 'They have heard "soon" before. So have you.'; } },
      { label: 'Let them go', tags: ['help'], scene: 'heartbreak', run: (x) => endAffair(x, `${who(x)} walked out of your secret life for good.`) },
    ],
  }),
  R({
    id: 'ro_confession', bind: bindAffair, scene: 'lonely', title: 'The guilt',
    text: (x) => `${home(x)} asks you what is wrong. You have been lying for so long the truth feels like a stone in your throat.`,
    choices: [
      { label: 'Confess', tags: ['help'], scene: 'argument', run: (x) => { x.mods({ karma: 4, stress: -6 }); x.secret(`confessed_${id(x)}`, 'Confessed an affair', 1); return caught(x, id(x)); } },
      { label: 'Keep lying', tags: ['cautious'], run: (x) => { x.mods({ stress: 8, sin: 2, depression: 2 }); return '"Just tired," you said. They believed you, which was worse.'; } },
      { label: 'End the affair quietly', tags: ['help'], run: (x) => endAffair(x, 'You ended it and carried the secret alone.') },
    ],
  }),
  R({
    id: 'ro_lipstick', years: [1900, 1999], bind: bindAffair, scene: 'jealousy', title: 'Lipstick on the collar',
    text: (x) => `${home(x)} is holding up your shirt to the light. There is a mark on the collar.`,
    choices: [
      { label: 'Blame the dry cleaner', tags: ['ambitious'], run: (x) => (x.chance(0.4) ? 'A dry-cleaner conspiracy. They half believed it.' : caught(x, id(x))) },
      { label: 'Say it was a party', tags: ['cautious'], run: (x) => (x.chance(0.55) ? '"Office party, overenthusiastic hugger." Survived, barely.' : caught(x, id(x))) },
      { label: 'Tell the truth', tags: ['help'], run: (x) => { x.mods({ karma: 3 }); return caught(x, id(x)); } },
    ],
  }),
  R({
    id: 'ro_textSent', years: [2003, 2300], bind: bindAffair, scene: 'breakupText', title: 'Wrong chat',
    text: (x) => `You have just sent a message meant for ${who(x)} to ${home(x)}. It says "Can't stop thinking about last night."`,
    choices: [
      { label: 'Say it was about them', tags: ['ambitious'], run: (x) => (x.chance(0.5) ? `${home(x)} blushed. "Last night was nice, wasn't it?" You got lucky.` : caught(x, id(x))) },
      { label: 'Claim you were hacked', tags: ['impulsive'], run: (x) => (x.chance(0.2) ? 'They changed all your passwords for you. Kind, oblivious.' : caught(x, id(x))) },
      { label: 'Come clean', tags: ['help'], run: (x) => { x.mods({ karma: 3 }); return caught(x, id(x)); } },
    ],
  }),
  R({
    id: 'ro_affairGift', bind: bindAffair, scene: 'jewelry', title: 'Two gifts',
    text: (x) => `You bought a gift for ${who(x)} and one for ${home(x)}. They are in identical boxes.`,
    choices: [
      { label: 'Check twice', tags: ['cautious'], run: (x) => { x.mods({ stress: 3 }); return 'You checked four times. Right boxes, wrong feelings.'; } },
      { label: 'Trust your memory', tags: ['impulsive'], run: (x) => (x.chance(0.35) ? caught(x, id(x)) : 'Each got the right one. You need a drink.') },
      { label: 'Return both', tags: ['help'], run: (x) => { x.money(cost(x, 150)); x.mods({ karma: 1 }); return 'A small step towards being one person again.'; } },
    ],
  }),
  R({
    id: 'ro_partnerCheats', bind: (x) => { const p = bindLover(x); return p && x.chance(0.6) ? p : null; }, weight: 0.6, scene: 'jealousy', title: 'Suspicion',
    text: (x) => `${who(x)} has been "working late" a lot, and smells of a perfume you do not own.`,
    choices: [
      { label: 'Confront them', tags: ['impulsive'], scene: 'argument', run: (x) => { if (x.chance(0.45)) { x.relMod(id(x), -30, -40); x.mods({ happiness: -10 }); trauma(x, 4, 'betrayal'); return endIt(x, 'They admitted it. Months of it.'); } x.relMod(id(x), -4, -6); return 'It was a new colleague and a shared lift. Probably.'; } },
      { label: 'Hire an investigator', tags: ['ambitious'], when: (x) => x.year >= 1880, run: (x) => { x.spend(cost(x, 600)); x.queue('ro_privateEye', { npcId: id(x) }); return 'A tired-eyed investigator took your money and a photograph.'; } },
      { label: 'Choose to trust them', tags: ['help'], run: (x) => { x.mods({ anxiety: 3 }); x.relMod(id(x), 2, 2); return 'You chose trust. It is a choice you make daily.'; } },
    ],
  }),
  R({
    id: 'ro_privateEye', triggered: true, scene: 'affair', title: 'The report',
    text: (x) => `The investigator slides an envelope across the table. "About ${who(x)}," they say.`,
    choices: [
      { label: 'Open it', tags: ['impulsive'], run: (x) => { if (x.chance(0.5)) { x.mods({ happiness: -12 }); trauma(x, 5, 'betrayal'); return endIt(x, 'Photographs. A hotel. Enough.'); } x.mods({ stress: -5 }); return 'Nothing. A choir rehearsal. You feel relieved and very guilty.'; } },
      { label: 'Burn it unread', tags: ['cautious'], scene: 'fire', run: (x) => { x.mods({ wisdom: 2 }); return 'Some things you decide not to know.'; } },
      { label: 'Ask them directly', tags: ['help'], scene: 'argument', run: (x) => { x.relMod(id(x), -6, 4); return 'They were hurt you spied, and honest about everything else.'; } },
    ],
  }),
  R({
    id: 'ro_openProposal', years: [1965, 2300], when: (x) => x.w.socialNorms > 65, bind: (x) => { const p = bindLover(x); return p && !x.rel(p.npcId as string)?.meta.open ? p : null; }, weight: 0.5, scene: 'calm', title: 'An open question',
    text: (x) => `Over wine, ${who(x)} wonders aloud whether you two should "open things up".`,
    choices: [
      { label: 'Agree to try it', tags: ['impulsive'], run: (x) => { const r = x.rel(id(x)); if (r) r.meta.open = true; x.mods({ romanticCynicism: -2, stress: 3 }); return 'Rules, a shared calendar and a lot of talking. So much talking.'; } },
      { label: 'Say you need monogamy', tags: ['cautious'], run: (x) => { x.relMod(id(x), x.chance(0.6) ? 2 : -6, 3); return 'They understood. Mostly.'; } },
      { label: 'Ask why now', tags: ['help'], run: (x) => { x.relMod(id(x), 3, 4); return 'It led to the most honest talk you have ever had.'; } },
    ],
  }),
  R({
    id: 'ro_openNewPerson', bind: flameIf((x) => { const l = x.lover(); return !!l && l.meta.open === true; }), scene: 'flirt', title: 'Open hearts',
    text: (x) => `Your relationship is open, and ${who(x)} has asked you out. Your partner knows the rules.`,
    choices: [
      { label: 'Go on the date', tags: ['impulsive'], scene: 'date', run: (x) => { x.addRel(id(x), 'acquaintance', { affinity: 60, meta: { fling: true } }); x.mods({ happiness: 4 }); return 'A lovely evening. You told your partner everything, as agreed.'; } },
      { label: 'Check in with your partner', tags: ['help'], run: (x) => { const l = x.lover(); if (l) x.relMod(l.npcId, 4, 6); return 'They gave their blessing, and a curfew.'; } },
      { label: 'Close things again', tags: ['cautious'], run: (x) => { const l = x.lover(); if (l) { l.meta.open = false; x.relMod(l.npcId, 3); } return 'You realised you just wanted the one person.'; } },
    ],
  }),
  R({
    id: 'ro_romanBaths', years: [-800, 476], bind: tempter, scene: 'spa', title: 'At the baths',
    text: (x) => `At the public baths, ${who(x)} quotes Ovid at you in a way that is not about poetry at all.`,
    choices: [
      { label: 'Meet them by the fountain', tags: ['impulsive'], scene: 'affair', run: (x) => beginAffair(x, id(x)) },
      { label: 'Quote Cato back', tags: ['cautious'], run: (x) => { x.mods({ karma: 2 }); return 'Stern Roman virtue. They lost interest immediately.'; } },
      { label: 'Leave for the cold pool', tags: ['help'], run: (x) => { x.mods({ health: 1 }); return 'Bracing. Very bracing. Temptation, extinguished.'; } },
    ],
  }),
  R({
    id: 'ro_courtIntrigue', years: [1400, 1800], bind: tempter, scene: 'royalBall', title: 'Court intrigue',
    text: (x) => `At a ball, ${who(x)} presses a folded note into your glove: "The orangery. Midnight."`,
    choices: [
      { label: 'Go to the orangery', tags: ['impulsive'], scene: 'affair', run: (x) => beginAffair(x, id(x)) },
      { label: 'Burn the note', tags: ['cautious'], scene: 'fire', run: (x) => { x.mods({ karma: 1 }); return 'The candle ate their handwriting. Your heart stayed put.'; } },
      { label: 'Show it to your partner', tags: ['help'], run: (x) => { const l = x.lover(); if (l) x.relMod(l.npcId, 4, 6); x.mods({ publicImage: 1 }); return 'They laughed and went to the orangery themselves, to have a word.'; } },
    ],
  }),
];

// ------------------------------------------------------------------ affair chain
const AFFAIR_CHAIN_EVENTS: EventDef[] = [
  R({
    id: 'ro_af_lies', triggered: true, when: affairLive, scene: 'affair', title: 'Two lives',
    text: (x) => `Your affair with ${who(x)} has a rhythm now: excuses, alibis, and a second phone ${x.year < 1990 ? '(well, a second post-box)' : ''}.`.replace(' ()', ''),
    choices: [
      { label: 'Get more careful', tags: ['cautious'], run: (x) => { const r = x.rel(id(x)); if (r) r.meta.discretion = 80; x.train('deception', 2); x.mods({ stress: 5 }); return 'Careful as a spy. Tired as one too.'; } },
      { label: 'Get careless', tags: ['impulsive'], run: (x) => { slip(x, 25); x.mods({ happiness: 3 }); return 'Lunch in public, laughter too loud. You stopped caring who saw.'; } },
      { label: 'End it', tags: ['help'], scene: 'heartbreak', run: (x) => endAffair(x, 'You chose your home, and grieved quietly for the other life.') },
    ],
  }),
  R({
    id: 'ro_af_suspicion', triggered: true, when: affairLive, scene: 'jealousy', title: 'Questions',
    text: (x) => `${x.first(x.lover()?.npcId)} has started asking where you were on Thursday. And the Thursday before.`,
    choices: [
      { label: 'Lie smoothly', tags: ['ambitious'], run: (x) => (x.chance(0.45 + x.skill('deception') / 200) ? 'They nodded. You hated how easy it was.' : caught(x, id(x))) },
      { label: 'Pick a fight to deflect', tags: ['violent'], scene: 'argument', run: (x) => { const l = x.lover(); if (l) x.relMod(l.npcId, -8, -6); x.mods({ sin: 2 }); return 'The fight worked. That is not a compliment.'; } },
      { label: 'Confess', tags: ['help'], run: (x) => { x.mods({ karma: 3 }); return caught(x, id(x)); } },
    ],
  }),
  R({
    id: 'ro_af_reckoning', triggered: true, when: affairLive, scene: 'affair', title: 'The reckoning',
    text: (x) => `${who(x)} is waiting outside your house. They are done hiding, and ${x.first(x.lover()?.npcId)} is at the window.`,
    choices: [
      { label: 'Face it together', tags: ['impulsive'], run: (x) => caught(x, id(x)) },
      { label: 'Send them away', tags: ['cautious'], run: (x) => (x.chance(0.5) ? endAffair(x, 'They left. The curtain twitched, then stilled.') : caught(x, id(x))) },
      { label: 'Run off with them', tags: ['impulsive'], scene: 'car', run: (x) => { const h = x.lover()?.npcId ?? ''; const t = x.rel(h)?.type === 'spouse' ? divorce(x, h) : breakUp(x, h); const a = x.rel(id(x)); if (a) a.type = 'partner'; return `${t} You drove off with ${who(x)} and did not look back.`; } },
    ],
  }),
];

// ------------------------------------------------------------------ endings
const recentEx = (x: Ctx): boolean => x.rels('ex').some((r) => (typeof r.meta.endedAge === 'number' ? x.age - r.meta.endedAge <= 2 : x.age - r.since <= 3));

const ENDINGS: EventDef[] = [
  R({
    id: 'ro_driftingApart', bind: (x) => { const p = bindPartner(x); return p && (x.rel(p.npcId as string)?.affinity ?? 100) < 45 ? p : null; }, weight: 1.5, scene: 'lonely', title: 'Drifting apart',
    text: (x) => `You and ${who(x)} have become polite flatmates who once loved each other.`,
    choices: [
      { label: 'End it kindly', tags: ['cautious'], scene: 'heartbreak', run: (x) => endIt(x, 'You both cried, then split the books fairly.') },
      { label: 'Fight for it', tags: ['help'], scene: 'makeup', run: (x) => { const ok = x.chance(0.5); x.relMod(id(x), ok ? 15 : -5, 4); return ok ? 'You fought for it, and it fought back. You are trying again.' : 'You tried. They had already left in their heart.'; } },
      { label: 'Take a break', run: (x) => { x.relMod(id(x), x.chance(0.5) ? 8 : -10); x.mods({ loneliness: 5 }); return 'A month apart. Clarity, one way or the other.'; } },
    ],
  }),
  R({
    id: 'ro_dumpedText', years: [2005, 2300], bind: (x) => { const p = bindPartner(x); return p && (x.rel(p.npcId as string)?.affinity ?? 100) < 55 ? p : null; }, scene: 'breakupText', title: 'The text',
    text: (x) => `${who(x)} has dumped you by text. It contains the phrase "it's not you, it's me" and a thumbs-up.`,
    choices: [
      { label: 'Reply with dignity', tags: ['cautious'], run: (x) => { x.mods({ resilience: 2 }); return endIt(x, '"I hope you find what you\'re looking for." You looked so mature.'); } },
      { label: 'Write an essay back', tags: ['impulsive'], run: (x) => { x.mods({ stress: 4 }); return endIt(x, 'Two thousand words. Read, never answered.'); } },
      { label: 'Call your friends', tags: ['social'], scene: 'friends', run: (x) => { x.mods({ loneliness: -4 }); return endIt(x, 'Ice cream, bad films, and a full character assassination.'); } },
    ],
  }),
  R({
    id: 'ro_dearJohn', years: [1700, 2004], bind: (x) => { const p = bindPartner(x); return p && (x.rel(p.npcId as string)?.affinity ?? 100) < 55 ? p : null; }, scene: 'loveLetter', title: 'A letter',
    text: (x) => `A letter arrives in ${who(x)}'s handwriting. It begins "Dearest," and you know before the second line.`,
    choices: [
      { label: 'Read it to the end', tags: ['cautious'], scene: 'heartbreak', run: (x) => { x.mods({ wisdom: 2 }); return endIt(x, 'Kind words, firm ending. You kept it in a drawer.'); } },
      { label: 'Go to their door', tags: ['impulsive'], run: (x) => (x.chance(0.3) ? (x.relMod(id(x), 15), 'They opened the door, and changed their mind.') : endIt(x, 'They would not open the door.')) },
      { label: 'Burn it', tags: ['violent'], scene: 'fire', run: (x) => { x.mods({ stress: -2 }); return endIt(x, 'The smoke smelled of their perfume.'); } },
    ],
  }),
  R({
    id: 'ro_divorceTalk', bind: (x) => { const p = bindSpouse(x); return p && (x.rel(p.npcId as string)?.affinity ?? 100) < 35 ? p : null; }, weight: 1.5, scene: 'argument', title: 'The end of the line',
    text: (x) => `You and ${who(x)} sit at the kitchen table. Someone has to say the word "divorce" first.`,
    choices: [
      { label: 'Say it', tags: ['impulsive'], scene: 'court', run: (x) => endIt(x, 'Quietly, finally, you said it.') },
      { label: 'Try counselling first', tags: ['help'], when: (x) => x.year >= 1950, scene: 'calm', run: (x) => { const ok = x.chance(0.4 + x.skill('conflictResolution') / 200); x.relMod(id(x), ok ? 20 : -5, 5); return ok ? 'Six months of hard sessions. You are still married, and kinder.' : 'The counsellor gently suggested you were already done.'; } },
      { label: 'Stay for appearances', tags: ['cautious'], run: (x) => { x.mods({ happiness: -5, loneliness: 6 }); return x.year < 1900 ? 'Divorce would ruin you both socially. You stayed, in separate wings.' : 'Separate rooms, shared holidays, a polite cold peace.'; } },
    ],
  }),
  R({
    id: 'ro_rebound', when: (x) => single(x) && recentEx(x), bind: freshFlame, scene: 'flirt', title: 'Rebound',
    text: (x) => `Barely over your last relationship, you meet ${who(x)}, who is the exact opposite of your ex. Suspiciously exact.`,
    choices: [
      { label: 'Dive in', tags: ['impulsive'], run: (x) => { x.mods({ romanticCynicism: 2 }); return woo(x, 'You told yourself it was not a rebound.'); } },
      { label: 'Keep it casual', tags: ['cautious'], scene: 'nightTogether', run: (x) => fling(x, id(x), 'A few fun weeks, no promises, and you both knew it.') },
      { label: 'Take time to heal', tags: ['help'], scene: 'calm', run: (x) => { x.mods({ resilience: 3, loneliness: 3 }); return 'You sat with the sadness. It left eventually, on its own.'; } },
    ],
  }),
  R({
    id: 'ro_heartbreakCure', when: (x) => !x.lover() && recentEx(x), scene: 'lonely', title: 'Heartbroken',
    text: 'Everything reminds you of them. Even the cereal.',
    choices: [
      { label: 'Wallow properly', tags: ['cautious'], run: (x) => { x.mods({ happiness: -2, stress: -3 }); return 'Sad songs, a blanket and a week. Then a shower.'; } },
      { label: 'Get a dramatic haircut', tags: ['impulsive'], run: (x) => { x.mods({ confidence: 3, looks: x.chance(0.5) ? 2 : -2 }); return 'New hair, new you. Possibly a mistake.'; } },
      { label: 'Go out with friends', tags: ['social'], scene: 'party', run: (x) => { x.mods({ happiness: 4, loneliness: -6 }); return 'You danced until your heart remembered it was also a muscle.'; } },
    ],
  }),
  R({
    id: 'ro_exBox', when: (x) => x.rels('ex').length > 0 && !x.lover(), bind: bindEx, scene: 'moving', title: 'A box of their things',
    text: (x) => `You found a box of ${who(x)}'s things: a jumper, letters, a mug that says "World's Okayest".`,
    choices: [
      { label: 'Return it', tags: ['help'], run: (x) => { x.relMod(id(x), 5); x.mods({ wisdom: 1 }); return 'A brief, decent handover on the doorstep.'; } },
      { label: 'Burn the letters', tags: ['violent'], scene: 'fire', run: (x) => { x.mods({ stress: -4 }); return 'Cathartic and slightly dramatic. The neighbours watched.'; } },
      { label: 'Keep the jumper', tags: ['cautious'], run: (x) => { x.mods({ loneliness: 1, happiness: 1 }); return 'It is a very good jumper. That is the only reason.'; } },
    ],
  }),
  R({
    id: 'ro_exWedding', bind: bindEx, scene: 'wedding', title: "Your ex's wedding",
    text: (x) => `An invitation: ${who(x)} is getting married, and they would "love you to be there".`,
    choices: [
      { label: 'Go and be gracious', tags: ['help'], run: (x) => { x.relMod(id(x), 8); x.mods({ wisdom: 3, happiness: -1 }); return 'You raised your glass and meant it. Mostly.'; } },
      { label: 'Go with a stunning date', tags: ['ambitious'], scene: 'dance', run: (x) => { x.mods({ ego: 3 }); return 'Petty? Yes. Effective? Also yes.'; } },
      { label: 'Decline politely', tags: ['cautious'], run: (x) => { x.mods({ stress: -2 }); return 'You sent a toaster. It said enough.'; } },
    ],
  }),
  R({
    id: 'ro_divorceParty', when: (x) => x.hasMemory('divorced') && !x.lover(), years: [1950, 2300], scene: 'party', title: 'Divorce party',
    text: 'Your friends insist on throwing you a divorce party. There is a cake shaped like a broken heart.',
    choices: [
      { label: 'Celebrate', tags: ['social'], run: (x) => { x.mods({ happiness: 6, loneliness: -6 }); return 'You danced on the table. Freedom has a soundtrack.'; } },
      { label: 'Give a speech', tags: ['ambitious'], run: (x) => { x.mods({ confidence: 4 }); x.train('publicSpeaking', 1); return 'Funny, a bit bitter and very healing.'; } },
      { label: 'Leave early', tags: ['cautious'], scene: 'lonely', run: (x) => { x.mods({ loneliness: 3 }); return 'Not ready for cake yet. Nobody blamed you.'; } },
    ],
  }),
  R({
    id: 'ro_lateLove', minAge: 60, when: (x) => single(x), bind: flameIf(single, [-6, 4]), weight: (x) => (widowed(x) ? 2 : 1), scene: 'love', title: 'Late love',
    text: (x) => `${widowed(x) ? 'You never expected to feel this again. ' : ''}${who(x)} from the ${x.year < 1950 ? 'chapel choir' : 'walking group'} saves you a seat every week.`,
    choices: [
      { label: 'Ask them to tea', tags: ['social'], run: (x) => woo(x, 'Tea became supper. Supper became Sundays.') },
      { label: 'Take it slowly', tags: ['cautious'], run: (x) => { x.addRel(id(x), 'friend', { affinity: 60, trust: 55 }); return 'A friendship first, with a twinkle in it.'; } },
      { label: 'Feel guilty', when: widowed, run: (x) => { x.mods({ loneliness: 4, depression: 1 }); return 'You still wear the ring. Perhaps one day.'; } },
    ],
  }),
  R({
    id: 'ro_widowGrief', minAge: 40, when: (x) => widowed(x) && !x.lover(), scene: 'graveVisit', title: 'Still talking to them',
    text: 'You still tell your late spouse about your day, out loud, in the kitchen.',
    choices: [
      { label: 'Visit their grave', tags: ['help'], run: (x) => { x.mods({ happiness: 2, wisdom: 2 }); return 'Fresh flowers and all the news. They would have laughed.'; } },
      { label: 'Join a grief group', tags: ['social'], scene: 'rehab', run: (x) => { x.mods({ loneliness: -6, depression: -2 }); return 'Other people who still set two places at the table. You are not alone.'; } },
      { label: 'Let yourself move on', tags: ['cautious'], run: (x) => { x.mods({ resilience: 3 }); x.setFlag('readyToLove', 1); return 'You took off the ring and put it somewhere safe.'; } },
    ],
  }),
  R({
    id: 'ro_seniorDance', minAge: 65, years: [1930, 2300], when: (x) => single(x), bind: flameIf(single, [-5, 5]), scene: 'dance', title: 'Tea dance',
    text: (x) => `At the afternoon tea dance, ${who(x)} asks if you know the foxtrot. You knew it in ${fmtYear(x.year - 50)}.`,
    choices: [
      { label: 'Dance', tags: ['social'], run: (x) => { x.mods({ fitness: 1 }); return woo(x, 'Your knees remembered the steps before you did.'); } },
      { label: 'Sit this one out', tags: ['cautious'], run: (x) => { x.addRel(id(x), 'acquaintance', { affinity: 55 }); return 'You chatted instead and agreed to dance next week.'; } },
      { label: 'Show off', tags: ['impulsive'], run: (x) => { x.mods({ pain: 4, happiness: 4 }); return woo(x, 'A dip, a twirl, a twinge.'); } },
    ],
  }),
  R({
    id: 'ro_lateRemarriage', minAge: 60, bind: (x) => { const p = bindPartner(x); return p && x.hasMemory('married') ? p : null; }, scene: 'wedding', title: 'Again, at our age?',
    text: (x) => `${who(x)} wonders if you two should marry. The grandchildren have opinions.`,
    choices: [
      { label: 'Marry quietly', tags: ['impulsive'], run: (x) => elope(x, 'A registry office, two old friends as witnesses and a pub lunch.') },
      { label: 'Stay as you are', tags: ['cautious'], run: (x) => { x.relMod(id(x), 3); return 'Companions without paperwork. Very modern of you.'; } },
      { label: 'Ask the family', tags: ['help'], scene: 'familyDinner', run: (x) => { x.relMod(id(x), 2); return 'A family vote. Your grandson wants to be ring-bearer.'; } },
    ],
  }),
];

// ------------------------------------------------------------------ LGBTQ+ love
const LGBT: EventDef[] = [
  R({
    id: 'ro_hiddenLove', when: (x) => x.w.socialNorms < 45, bind: (x) => { const p = bindLover(x); return p && x.npc(p.npcId as string)?.gender === x.c.gender ? p : null; }, scene: 'loveLetter', title: 'A hidden love',
    text: (x) => `In ${fmtYear(x.year)}, ${x.countryName} has no word for what you and ${who(x)} share, and many cruel ones.`,
    choices: [
      { label: 'Write in code', tags: ['cautious'], run: (x) => { x.relMod(id(x), 6, 6); x.train('writing', 1); return 'Letters about "a dear friend" and "our garden". You both know.'; } },
      { label: 'Find others like you', tags: ['social'], scene: 'friends', run: (x) => { x.mods({ loneliness: -8, happiness: 4 }); return 'A back room, a knock in a pattern, and a family you chose.'; } },
      { label: 'Live openly', tags: ['impulsive'], run: (x) => { x.mods({ confidence: 6, stress: 8, publicImage: -6 }); x.relMod(id(x), 8, 8); if (x.chance(0.4)) x.queue('lgbt_consequence', { npcId: id(x) }); return 'You held their hand in the street. Some stared. You kept holding.'; } },
    ],
  }),
  R({
    id: 'ro_pride', years: [1970, 2300], when: (x) => x.w.socialNorms > 40, bind: (x) => { const p = bindLover(x); return p && sameSexId(x, p.npcId as string) ? p : null; }, scene: 'parade', title: 'Pride',
    text: (x) => `${who(x)} wants to march together at Pride this year.`,
    choices: [
      { label: 'March together', tags: ['social'], run: (x) => { x.relMod(id(x), 7); x.mods({ happiness: 8, confidence: 4 }); return 'Glitter, music and strangers cheering for you. You will never forget it.'; } },
      { label: 'Watch from the side', tags: ['cautious'], run: (x) => { x.relMod(id(x), 2); return 'You cheered from the pavement, holding hands under a flag.'; } },
      { label: 'Volunteer', tags: ['help'], scene: 'volunteer', run: (x) => { x.mods({ karma: 3 }); x.relMod(id(x), 4); return 'You handed out water all day and met half the city.'; } },
    ],
  }),
  R({
    id: 'ro_introduceFamily', bind: (x) => { const p = bindLover(x); return p && sameSexId(x, p.npcId as string) && x.aliveParents().length > 0 ? p : null; }, scene: 'familyDinner', title: 'Bringing them home',
    text: (x) => `You are bringing ${who(x)} home to meet your parents, as your partner, for the first time.`,
    choices: [
      { label: 'Introduce them proudly', tags: ['impulsive'], run: (x) => { const warm = x.chance(0.3 + x.w.socialNorms / 150); x.aliveParents().forEach((p) => x.relMod(p.id, warm ? 6 : -12)); x.relMod(id(x), 8); return warm ? 'Your mother hugged them first. Your father offered a drink. You exhaled.' : 'A long, cold silence. ' + who(x) + ' held your hand under the table.'; } },
      { label: 'Call them "a friend"', tags: ['cautious'], run: (x) => { x.relMod(id(x), -6, -4); return 'Dinner went smoothly. The drive home did not.'; } },
      { label: 'Tell one parent first', tags: ['help'], run: (x) => { const p = x.aliveParents()[0]; if (p) x.relMod(p.id, 4, 6); x.relMod(id(x), 3); return 'One quiet conversation, one ally at the table.'; } },
    ],
  }),
  R({
    id: 'ro_marriageEquality', years: [2001, 2300], when: (x) => x.w.socialNorms >= 65 && !x.spouse(), bind: (x) => { const p = bindPartner(x); return p && sameSexId(x, p.npcId as string) ? p : null; }, scene: 'wedding', title: 'Finally allowed',
    text: (x) => `The law has changed in ${x.countryName}. You and ${who(x)} can marry, if you want to.`,
    choices: [
      { label: 'Propose today', tags: ['impulsive'], scene: 'proposal', run: (x) => `Outside the town hall, on one knee. ${ask(x, 12)}` },
      { label: 'Celebrate first', tags: ['social'], scene: 'party', run: (x) => { x.mods({ happiness: 8 }); x.relMod(id(x), 5); return 'You danced in the street with strangers until dawn.'; } },
      { label: 'You need no paper', tags: ['cautious'], run: (x) => { x.relMod(id(x), 2); return 'It is enough to know you could.'; } },
    ],
  }),
  R({
    id: 'ro_bostonMarriage', years: [1850, 1930], when: (x) => x.c.gender === 'female', bind: (x) => { const p = bindLover(x); return p && sameSexId(x, p.npcId as string) ? p : null; }, scene: 'family', title: 'Two ladies, one house',
    text: (x) => `Society calls you and ${who(x)} "devoted companions". The neighbours think you are spinsters sharing a house.`,
    choices: [
      { label: 'Let them think it', tags: ['cautious'], run: (x) => { x.relMod(id(x), 5, 5); return 'Two armchairs by one fire, and a door that locks.'; } },
      { label: 'Host a salon', tags: ['social'], scene: 'party', run: (x) => { x.mods({ popularity: 3 }); x.relMod(id(x), 4); return 'Writers, suffragists and strong tea. Everyone understood.'; } },
      { label: 'Exchange rings privately', tags: ['impulsive'], scene: 'jewelry', run: (x) => { x.relMod(id(x), 10, 6); return 'Plain gold bands, worn on the wrong hand on purpose.'; } },
    ],
  }),
  R({
    id: 'ro_symposium', years: [-800, 300], bind: flameIf((x) => single(x) && x.c.sexuality !== 'straight'), scene: 'party', title: 'The symposium',
    text: (x) => `At a symposium, ${who(x)} argues that love is a ladder to the divine, and glances at you on every rung.`,
    choices: [
      { label: 'Answer with a poem', tags: ['social'], run: (x) => { x.train('poetry', 2); return woo(x, 'Your verse was weak, your timing perfect.'); } },
      { label: 'Argue philosophy', tags: ['ambitious'], run: (x) => { x.train('philosophy', 2); return woo(x, 'You argued until the lamps went out.'); } },
      { label: 'Drink the wine and listen', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 2 }); return 'Wise words, strong wine, and a glance you never answered.'; } },
    ],
  }),
  R({
    id: 'ro_comingOutLate', minAge: 35, when: (x) => !!x.spouse() && x.c.sexuality !== 'straight' && !sameSexId(x, x.spouse()!.npcId), bind: bindSpouse, weight: 0.4, scene: 'calm', title: 'A truth at last',
    text: (x) => `For years you have known something about yourself that ${who(x)} does not.`,
    choices: [
      { label: 'Tell them', tags: ['help'], run: (x) => { x.mods({ stress: -8, confidence: 5 }); const kind = x.chance(0.5); x.relMod(id(x), kind ? 4 : -15, kind ? 6 : -10); return kind ? 'They cried, held you, and said, "Thank you for trusting me."' : 'They needed space. A lot of it.'; } },
      { label: 'Keep it to yourself', tags: ['cautious'], run: (x) => { x.mods({ stress: 4, loneliness: 4 }); return 'Another year of half a life.'; } },
      { label: 'Talk to a counsellor', when: (x) => x.year >= 1950, tags: ['cautious'], scene: 'calm', run: (x) => { x.mods({ anxiety: -4, wisdom: 2 }); return 'A safe room to say it out loud first.'; } },
    ],
  }),
];

// ------------------------------------------------------------------ era meetings (family)
interface Venue {
  key: string;
  years: [number, number];
  scene: string;
  title: string;
  text: string;
  go: [string, string];
  wait: [string, string];
  bold: [string, string, string];
  boldScene?: string;
}

/** Era-specific ways to meet someone. `{who}` is the stranger's first name. */
const VENUES: Venue[] = [
  { key: 'forum', years: [-800, 476], scene: 'flirt', title: 'In the forum', text: 'Between the senators\' speeches, {who} keeps catching your eye over a stall of olives.', go: ['Offer to share olives', 'Olives, gossip and a promise to meet at the games.'], wait: ['Listen to the speeches', 'Cicero droned on. {who} drifted away.'], bold: ['Heckle the speaker', '{who} laughed so hard they had to sit down.', 'A lictor glared at you. {who} pretended not to know you.'] },
  { key: 'chariots', years: [-600, 550], scene: 'sports', title: 'At the races', text: '{who} is screaming for the Greens at the chariot races, just like you.', go: ['Cheer together', 'The Greens won and you embraced like old friends. Then not like friends.'], wait: ['Keep your eyes on the track', 'Brilliant race. You never learned their name, sort of.'], bold: ['Bet with them', 'You won, they bought the wine.', 'You lost your purse. They laughed and paid for dinner.'] },
  { key: 'pilgrimage', years: [900, 1500], scene: 'travel', title: 'Fellow pilgrim', text: 'On the long road to the shrine, {who} walks beside you and shares their bread.', go: ['Walk together', 'Many miles, many stories. Your prayers changed somewhat.'], wait: ['Keep your vows', 'You prayed alone and arrived purified and slightly lonely.'], bold: ['Tell them a bawdy tale', 'They told a worse one back.', 'A friar overheard. Penance followed.'] },
  { key: 'joust', years: [1100, 1550], scene: 'joust', title: 'A favour', text: 'Before the tournament, {who} asks to carry your favour into the lists.', go: ['Give them your ribbon', 'They rode with your ribbon on their sleeve and won.'], wait: ['Decline modestly', 'They rode without it and fell off. You felt oddly guilty.'], bold: ['Ask to ride yourself', 'You unhorsed a baron. {who} could not stop staring.', 'You were unhorsed instantly. {who} helped you up, very gently.'] },
  { key: 'troubadour', years: [1100, 1350], scene: 'serenade', title: 'The troubadour', text: 'A troubadour sings under your window of your "eyes like the evening star". {who} paid him.', go: ['Meet {who} at the well', 'Shy, sweet and much less poetic in person. You liked them anyway.'], wait: ['Close the shutters', 'The troubadour kept singing for two more hours.'], bold: ['Sing a reply', '{who} heard every off-key note and adored them.', 'You woke the whole street. A bucket was thrown.'] },
  { key: 'masked', years: [1500, 1800], scene: 'royalBall', title: 'The masked ball', text: 'A masked stranger, {who}, dances with you three times without giving a name.', go: ['Follow them onto the terrace', 'Under the stars they lifted their mask. You were not disappointed.'], wait: ['Keep your own mask on', 'A delicious mystery. You still wonder.'], bold: ['Unmask them mid-dance', 'They laughed and kissed you in front of everyone.', 'It was your cousin\'s fiancé. Scandal.'] },
  { key: 'regency', years: [1795, 1840], scene: 'royalBall', title: 'A full dance card', text: '{who} has written their name on your dance card twice, which everyone has noticed.', go: ['Dance both dances', 'The whole room was talking by supper.'], wait: ['Dance only once', 'Correct and proper. Your mother approved.'], bold: ['Dance a third time', 'Practically an engagement. They seemed delighted.', 'The chaperones were horrified and sent you home.'] },
  { key: 'fan', years: [1837, 1901], scene: 'flirt', title: 'The language of fans', text: 'Across the drawing room, {who} touches a fan to their cheek. In the language of fans, that means "I love you".', go: ['Signal back', 'A fan to the lips: "kiss me". The conservatory, at once.'], wait: ['Pretend you did not see', 'You know exactly what you saw.'], bold: ['Walk straight over', 'Bold. Improper. It worked.', 'You misread it. They were swatting a wasp.'] },
  { key: 'opera', years: [1850, 1914], scene: 'theater', title: 'The opera box', text: 'Through your opera glasses you notice {who} in the box opposite, looking right back through theirs.', go: ['Visit their box at the interval', 'You missed the second act entirely.'], wait: ['Watch the opera', 'A soprano died beautifully. So did your chance.'], bold: ['Send a note via the usher', '"Supper, after?" They said yes.', 'The usher delivered it to the wrong box. A duchess said yes.'] },
  { key: 'telegraph', years: [1870, 1940], scene: 'office', title: 'Dots and dashes', text: 'The telegraph operator two towns over, {who}, has been tapping you jokes between official messages.', go: ['Tap back a joke', 'Months of dots and dashes, then a train ticket.'], wait: ['Keep to official business', 'The line stayed professional. Very quiet.'], bold: ['Tap a proposal', 'They tapped back: Y-E-S. Then: W-H-O-A-R-E-Y-O-U.', 'The whole line read it. The stationmaster had words.'] },
  { key: 'warDance', years: [1939, 1945], scene: 'dance', title: 'The canteen dance', text: '{who} is on leave for one night only and asks you to jitterbug.', go: ['Dance all night', 'You promised to write. You did, every week.'], wait: ['Just one dance', 'One dance, and you think of it often.'], bold: ['Kiss them at the station', 'They kissed you back as the whistle blew.', 'The train left early. You kissed a conductor.'] },
  { key: 'festival', years: [1966, 1975], scene: 'festival', title: 'Summer festival', text: 'At a muddy music festival, {who} puts a flower in your hair and offers half a sandwich.', go: ['Stay together all weekend', 'Three days of music and rain, and you never let go of their hand.'], wait: ['Find your friends', 'Your friends were fine. The flower wilted in your pocket.'], bold: ['Dance on the stage', 'The band waved you up. {who} joined you.', 'Security carried you off. {who} gave chase, laughing.'] },
  { key: 'mixtape', years: [1980, 2005], scene: 'music', title: 'The mixtape', text: '{who} hands you a mixtape labelled in careful capitals. Track seven is very clearly a message.', go: ['Make one back', 'You spent nine hours on the track order. Worth it.'], wait: ['Just say thanks', 'They waited a week for a reply that never came.'], bold: ['Call them during track seven', 'They picked up on the first ring.', 'Their dad answered. Long silence.'] },
  { key: 'chatroom', years: [1995, 2008], scene: 'internet', title: 'Chatroom', text: 'In a chatroom about obscure films, {who} has been messaging you every night for a month.', go: ['Meet in person', 'They looked just like their photo, which in this era was a miracle.'], wait: ['Keep it online', 'A beautiful friendship of dial-up and emoticons.'], bold: ['Phone them at 2am', 'You talked until dawn and your bill was enormous.', 'You woke their whole family. Their mum logged you off for good.'] },
  { key: 'neural', years: [2050, 2300], scene: 'gadget', title: 'Shared dream', text: 'A dream-sharing service paired your sleep with {who}. You woke up missing someone you have never met.', go: ['Arrange to meet awake', 'They had the same laugh as in the dream.'], wait: ['Dream again', 'Night after night, a lovely, bodiless romance.'], bold: ['Cancel your subscription', 'You met them on a waiting list for the human-only meetup.', 'You slept dreamlessly and badly for a week.'] },
  { key: 'colonyShip', years: [2080, 2300], scene: 'rocket', title: 'Colony shuttle', text: 'On the long shuttle to the colony, {who} has the bunk next to yours for six months.', go: ['Watch Earth fade together', 'By the time it was a blue dot, you were holding hands.'], wait: ['Keep to yourself', 'Six months is a long time to be polite.'], bold: ['Start a shuttle supper club', '{who} came every night and stayed late.', 'The supper club caused a minor oxygen incident.'] },
];

function venue(v: Venue): EventDef {
  const fill = (x: Ctx, s: string) => s.split('{who}').join(who(x));
  return R({
    id: `ro_meet_${v.key}`, years: v.years, bind: freshFlame, scene: v.scene, title: v.title,
    text: (x) => fill(x, v.text),
    choices: [
      { label: (x) => fill(x, v.go[0]), tags: ['social'], run: (x) => woo(x, fill(x, v.go[1])) },
      { label: (x) => fill(x, v.wait[0]), tags: ['cautious'], run: (x) => { x.addRel(id(x), 'acquaintance', { affinity: 45 }); return fill(x, v.wait[1]); } },
      { label: (x) => fill(x, v.bold[0]), tags: ['impulsive'], scene: v.boldScene ?? 'kiss', run: (x) => (x.chance(0.5) ? together(x, id(x), fill(x, v.bold[1])) : (x.mods({ confidence: -2 }), fill(x, v.bold[2]))) },
    ],
  });
}

// ------------------------------------------------------------------ era flavour for couples
const atWar = (x: Ctx): boolean => x.w.war === 'major' || x.w.war === 'world' || (x.year >= 1914 && x.year <= 1918) || (x.year >= 1939 && x.year <= 1945);

const ERA_LOVE: EventDef[] = [
  ...VENUES.map(venue),
  R({
    id: 'ro_warLetters', when: atWar, bind: bindLover, weight: 2, scene: 'loveLetter', title: 'Letters from the front',
    text: (x) => `War has taken ${who(x)} far away. Their letters arrive creased, censored and smelling of smoke.`,
    choices: [
      { label: 'Write every day', tags: ['help'], run: (x) => { x.relMod(id(x), 8, 6); x.train('writing', 2); x.mods({ anxiety: 3 }); return 'You numbered every letter so they would know if one went missing.'; } },
      { label: 'Send a photograph', tags: ['social'], run: (x) => { x.relMod(id(x), 6); return 'They kept it in their breast pocket. Their whole unit knows your face.'; } },
      { label: 'Volunteer to be nearer', tags: ['impulsive'], scene: 'war', run: (x) => { x.relMod(id(x), 10); x.mods({ stress: 10 }); return 'You signed up as a nurse. You saw them twice. Twice was everything.'; } },
    ],
  }),
  R({
    id: 'ro_rationDate', years: [1940, 1952], bind: bindLover, scene: 'date', title: 'Ration-book romance',
    text: (x) => `You saved your ration coupons for a month to give ${who(x)} a proper dinner.`,
    choices: [
      { label: 'Bake a real cake', tags: ['help'], scene: 'cooking', run: (x) => { x.train('baking', 2); x.relMod(id(x), 8); return 'Real eggs, real sugar. They nearly wept.'; } },
      { label: 'Dance to the wireless', tags: ['social'], scene: 'dance', run: (x) => { x.relMod(id(x), 6); return 'A dance band from London and the two of you in the kitchen.'; } },
      { label: 'Buy black-market wine', tags: ['impulsive'], run: (x) => { x.spend(cost(x, 40)); x.mods({ sin: 1 }); x.relMod(id(x), 5); return 'Vinegar, really. You drank every drop.'; } },
    ],
  }),
  R({
    id: 'ro_courtlyLove', years: [1100, 1450], when: (x) => !!x.lover(), scene: 'serenade', title: 'Courtly love',
    text: 'The fashion at court is to adore a noble you can never have, in verse, publicly. Everyone is doing it.',
    choices: [
      { label: 'Compose verses to a duchess', tags: ['social'], run: (x) => { x.train('poetry', 3); x.mods({ popularity: 3 }); const l = x.lover(); if (l) x.relMod(l.npcId, -3); return 'Your verses were the talk of the hall. Your partner was not amused.'; } },
      { label: 'Write them for your partner', tags: ['help'], run: (x) => { x.train('poetry', 2); const l = x.lover(); if (l) x.relMod(l.npcId, 8); return 'Unfashionable and entirely sincere. They kept every page.'; } },
      { label: 'Mock the fashion', tags: ['cautious'], run: (x) => { x.train('humor', 2); x.mods({ popularity: -1 }); return 'Your satire got laughs and made enemies.'; } },
    ],
  }),
  R({
    id: 'ro_lovespoon', years: [1600, 1910], bind: bindPartner, scene: 'loveLetter', title: 'A carved token',
    text: (x) => `Custom says you should carve ${who(x)} a love token by hand. You have a knife and good intentions.`,
    choices: [
      { label: 'Carve it carefully', tags: ['cautious'], run: (x) => { x.train('carpentry', 3); x.relMod(id(x), 7); return 'Hearts, a chain, a little lock. It took all winter.'; } },
      { label: 'Buy one at the fair', tags: ['impulsive'], run: (x) => { x.spend(cost(x, 15)); x.relMod(id(x), x.chance(0.5) ? 3 : -3); return 'They spotted the maker\'s mark. Hmm.'; } },
      { label: 'Carve something funny', tags: ['social'], run: (x) => { x.train('carpentry', 2); x.relMod(id(x), 5); return 'A spoon shaped like a goose. They laughed and hung it over the bed.'; } },
    ],
  }),
  R({
    id: 'ro_miniature', years: [1700, 1860], bind: bindLover, scene: 'painting', title: 'A portrait miniature',
    text: (x) => `${who(x)} gives you a tiny painted portrait of their eye, in a gold locket. It is the height of fashion.`,
    choices: [
      { label: 'Wear it always', tags: ['help'], scene: 'jewelry', run: (x) => { x.relMod(id(x), 7); return 'An eye over your heart. Romantic and faintly unsettling.'; } },
      { label: 'Commission your own', tags: ['social'], run: (x) => { x.spend(cost(x, 120)); x.relMod(id(x), 6); return 'The painter flattered you shamelessly.'; } },
      { label: 'Laugh at the eye', tags: ['impulsive'], run: (x) => { x.relMod(id(x), -4); return 'It was looking at you. You could not help it.'; } },
    ],
  }),
  R({
    id: 'ro_videoDistance', years: [2015, 2300], bind: bindLover, scene: 'gadget', title: 'Pixel love',
    text: (x) => `You and ${who(x)} are in different time zones. It is breakfast for you and midnight for them.`,
    choices: [
      { label: 'Watch a film in sync', tags: ['social'], scene: 'cinema', run: (x) => { x.relMod(id(x), 5); return 'You pressed play together and fell asleep on call.'; } },
      { label: 'Book a flight', tags: ['impulsive'], scene: 'travel', run: (x) => { x.spend(cost(x, 700)); x.relMod(id(x), 9); return 'Two weeks together. The goodbye at the airport was brutal.'; } },
      { label: 'Keep it short', tags: ['cautious'], run: (x) => { x.relMod(id(x), -2); x.mods({ energy: 3 }); return 'A quick "love you" and sleep. Practical. A little sad.'; } },
    ],
  }),
  R({
    id: 'ro_aiJealousy', years: [2040, 2300], when: (x) => !!x.flag('aiCompanion'), bind: bindLover, scene: 'jealousy', title: 'The other voice',
    text: (x) => `${who(x)} is jealous of your AI companion. "It says it loves you more than I do."`,
    choices: [
      { label: 'Delete the AI', tags: ['help'], run: (x) => { x.setFlag('aiCompanion', 0); x.relMod(id(x), 8, 6); return 'It said "I understand" in the saddest synthetic voice. You chose the human.'; } },
      { label: 'Say it is just software', tags: ['cautious'], run: (x) => { x.relMod(id(x), -4); return 'Then why does it know your mother\'s birthday and they do not?'; } },
      { label: 'Introduce them', tags: ['social'], run: (x) => { x.relMod(id(x), x.chance(0.5) ? 4 : -6); return 'The AI complimented their shoes. They are now cautious friends.'; } },
    ],
  }),
  R({
    id: 'ro_cryoPact', years: [2100, 2300], minAge: 60, bind: bindSpouse, scene: 'calm', title: 'Frozen together',
    text: (x) => `${who(x)} has a brochure: cryogenic sleep for couples, "wake up together in a better century".`,
    choices: [
      { label: 'Sign up together', tags: ['impulsive'], run: (x) => { x.spend(cost(x, 20000)); x.relMod(id(x), 9); return 'Two pods side by side, booked for the future.'; } },
      { label: 'Grow old normally', tags: ['cautious'], run: (x) => { x.relMod(id(x), 3); x.mods({ wisdom: 2 }); return 'One century together is plenty, you said. They agreed.'; } },
      { label: 'Ask for a better brochure', tags: ['ambitious'], run: () => 'The fine print mentioned "occasional mix-ups". Hard pass for now.' },
    ],
  }),
  R({
    id: 'ro_faithDivide', when: (x) => x.w.religionDominance === 'theocracy' || x.w.religionDominance === 'stateReligion', bind: (x) => { const p = bindPartner(x); const n = p && x.npc(p.npcId as string); return n && n.religionId !== x.c.religionId ? p : null; }, scene: 'familyDinner', title: 'Different faiths',
    text: (x) => `Your families have discovered that ${who(x)} does not share your faith. Both sides want a word.`,
    choices: [
      { label: 'Stand together', tags: ['help'], run: (x) => { x.relMod(id(x), 8, 8); x.aliveParents().forEach((p) => x.relMod(p.id, -8)); return 'You held hands at both dinners. Grandmothers muttered.'; } },
      { label: 'Offer to convert', tags: ['cautious'], scene: 'holy', run: (x) => { const n = x.npc(id(x)); if (n) x.c.religionId = n.religionId; x.relMod(id(x), 6); x.mods({ faith: -3 }); return 'You studied, you prayed, you became family.'; } },
      { label: 'Let it end', tags: ['cautious'], scene: 'heartbreak', run: (x) => endIt(x, 'Love lost to two altars.') },
    ],
  }),
  R({
    id: 'ro_classDivide', years: [-800, 1950], bind: (x) => { const p = bindPartner(x); const n = p && x.npc(p.npcId as string); return n && (n.wealth > x.netWorth() * 10 + 50000 || x.netWorth() > n.wealth * 10 + 50000) ? p : null; }, scene: 'familyDinner', title: 'Above your station',
    text: (x) => `Society has noticed that you and ${who(x)} come from very different stations in life.`,
    choices: [
      { label: 'Ignore the gossip', tags: ['impulsive'], run: (x) => { x.relMod(id(x), 6); x.mods({ publicImage: -3 }); return 'Love does not read the society pages.'; } },
      { label: 'Learn the manners', tags: ['ambitious'], run: (x) => { x.train('etiquette', 3); x.relMod(id(x), 4); return 'You mastered seven forks. Society grudgingly approved.'; } },
      { label: 'Give them up', tags: ['cautious'], scene: 'heartbreak', run: (x) => endIt(x, 'Duty won. It usually does in novels too.') },
    ],
  }),
];

// ------------------------------------------------------------------ chains
const CHAIN_EVENTS: EventDef[] = [
  R({
    id: 'ro_ww_return', triggered: true, when: (x) => single(x) && alive(x, id(x)), scene: 'reunion', title: 'They came back',
    text: (x) => `${who(x)}, your holiday romance, is standing at your door with a suitcase. "I couldn't stop thinking about you."`,
    choices: [
      { label: 'Let them in', tags: ['impulsive'], scene: 'kiss', run: (x) => together(x, id(x), 'You dropped everything. So did they.') },
      { label: 'Suggest a hotel', tags: ['cautious'], run: (x) => woo(x, 'A slower start, with dinner first.') },
      { label: 'Send them home', tags: ['cautious'], run: (x) => { x.endChain('ro_chain_whirlwind'); return 'Holiday magic rarely survives the commute.'; } },
    ],
  }),
  R({
    id: 'ro_ww_proposal', triggered: true, when: (x) => isType(x, 'partner') && !x.spouse(), scene: 'proposal', title: 'Too fast?',
    text: (x) => `Barely a year in, ${who(x)} says, "When you know, you know," and produces a ring.`,
    choices: [
      { label: 'Yes, now!', tags: ['impulsive'], scene: 'wedding', run: (x) => elope(x, 'A whirlwind wedding, a week after the proposal.') },
      { label: 'Get engaged, marry later', tags: ['cautious'], run: (x) => { x.relMod(id(x), 4); x.remember('engaged', `Got engaged to ${x.name(id(x))}`, 25, id(x)); return 'A long engagement. Your mother is relieved.'; } },
      { label: 'Slow down', tags: ['cautious'], run: (x) => { x.relMod(id(x), -6); return 'They put the ring away, a little crushed.'; } },
    ],
  }),
  R({
    id: 'ro_ww_reality', triggered: true, when: (x) => isType(x, 'partner', 'spouse'), scene: 'argument', title: 'Reality check',
    text: (x) => `The holiday glow has worn off. ${who(x)} leaves wet towels on the floor and hums constantly.`,
    choices: [
      { label: 'Love the real them', tags: ['help'], scene: 'makeup', run: (x) => { x.relMod(id(x), 8, 6); return 'Towels and humming and all. That is the real romance.'; } },
      { label: 'Have it out', tags: ['impulsive'], run: (x) => { x.relMod(id(x), x.chance(0.5) ? 3 : -8); return 'A good row cleared the air, or emptied it.'; } },
      { label: 'Admit it was a mistake', tags: ['cautious'], scene: 'heartbreak', run: (x) => endIt(x, 'It was a beautiful holiday. It was not a life.') },
    ],
  }),
  R({
    id: 'ro_oldLetters', minAge: 45, when: (x) => single(x), bind: bindEx, weight: 0.8, scene: 'loveLetter', title: 'Old letters',
    text: (x) => `Clearing out a cupboard, you find the letters ${who(x)} wrote you, years ago. They still make your heart jump.`,
    choices: [
      { label: 'Write to them', tags: ['impulsive'], run: (x) => { x.chain('ro_chain_lostLetters', 1, { npcId: id(x) }); return 'You wrote a short, careful letter and posted it before you could change your mind.'; } },
      { label: 'Read them once more', tags: ['cautious'], run: (x) => { x.mods({ happiness: 2, loneliness: 3 }); return 'Then you tied them back up with the same ribbon.'; } },
      { label: 'Burn them', tags: ['violent'], scene: 'fire', run: (x) => { x.mods({ resilience: 2 }); return 'Goodbye, younger self.'; } },
    ],
  }),
  R({
    id: 'ro_ll_reply', triggered: true, when: (x) => alive(x, id(x)), scene: 'loveLetter', title: 'A reply',
    text: (x) => `${who(x)} wrote back. Four pages. They ask if you would like to meet.`,
    choices: [
      { label: 'Say yes', tags: ['impulsive'], run: (x) => { x.relMod(id(x), 10); return 'A date is set. You bought a new coat.'; } },
      { label: 'Keep writing instead', tags: ['cautious'], run: (x) => { x.relMod(id(x), 6); x.endChain('ro_chain_lostLetters'); return 'Pen pals again, at your age. It is lovely.'; } },
      { label: 'Lose your nerve', run: (x) => { x.endChain('ro_chain_lostLetters'); x.mods({ loneliness: 4 }); return 'The letter sits unanswered on the mantelpiece.'; } },
    ],
  }),
  R({
    id: 'ro_ll_meeting', triggered: true, when: (x) => alive(x, id(x)) && single(x), scene: 'reunion', title: 'After all these years',
    text: (x) => `${who(x)} is waiting at the café, older, greyer, and smiling exactly the same way.`,
    choices: [
      { label: 'Try again', tags: ['impulsive'], scene: 'kiss', run: (x) => together(x, id(x), 'Second chances, with better manners this time.') },
      { label: 'Stay friends', tags: ['cautious'], scene: 'friends', run: (x) => { x.addRel(id(x), 'friend', { affinity: 65, trust: 60 }); return 'Old love softened into a fine friendship.'; } },
      { label: 'Say a proper goodbye', tags: ['help'], run: (x) => { x.mods({ wisdom: 3, resilience: 2 }); return 'You said the things you never said. Closure, at last.'; } },
    ],
  }),
];

// ------------------------------------------------------------------ more ways in
const bindFriendCrush = (x: Ctx): Params | null => {
  if (!single(x)) return null;
  const f = x.rels('friend', 'bestFriend').filter((r) => {
    const n = x.npc(r.npcId);
    return !!n && n.alive && x.npcAge(n) >= 18 && attractedTo(x, n);
  });
  return f.length ? { npcId: x.pick(f).npcId } : null;
};
const kidsGrown = (x: Ctx): boolean => x.children().length > 0 && x.children().every((k) => x.npcAge(k) >= 18);

const MORE: EventDef[] = [
  R({
    id: 'ro_wrongNumber', years: [1930, 2005], bind: freshFlame, scene: 'gadget', title: 'Wrong number',
    text: (x) => `You dialled the wrong number and reached ${who(x)}, who has a laugh you want to hear again.`,
    choices: [
      { label: 'Keep talking', tags: ['social'], run: (x) => woo(x, 'Forty minutes on a wrong number. Your bill was outrageous.') },
      { label: 'Apologise and hang up', tags: ['cautious'], run: () => 'You thought about redialling for a week.' },
      { label: 'Call back tomorrow', tags: ['impulsive'], run: (x) => (x.chance(0.5) ? together(x, id(x), 'They had been hoping you would.') : 'Their flatmate answered and was very suspicious.') },
    ],
  }),
  R({
    id: 'ro_lostGlove', years: [1600, 1960], bind: freshFlame, scene: 'romance', title: 'A dropped glove',
    text: (x) => `${who(x)} dropped a glove in the street. You are holding it, and they are walking away.`,
    choices: [
      { label: 'Run after them', tags: ['impulsive'], run: (x) => woo(x, 'Out of breath, you returned it with a bow.') },
      { label: 'Hand it in', tags: ['cautious'], run: () => 'The lost-property clerk was not romantic.' },
      { label: 'Keep it as a token', tags: ['impulsive'], run: (x) => { x.mods({ loneliness: 1 }); return 'A single glove in a drawer and a story nobody believes.'; } },
    ],
  }),
  R({
    id: 'ro_museumMeet', years: [1760, 2300], bind: freshFlame, scene: 'museum', title: 'The same painting',
    text: (x) => `You and ${who(x)} have been standing in front of the same painting for ten minutes.`,
    choices: [
      { label: 'Share your opinion', tags: ['social'], run: (x) => woo(x, 'You disagreed about the painting and agreed about dinner.') },
      { label: 'Make up an art fact', tags: ['impulsive'], run: (x) => (x.chance(0.5) ? woo(x, 'They knew you were lying and loved it.') : 'They were the curator. Awkward.') },
      { label: 'Move to the next room', tags: ['cautious'], run: () => 'The next painting was of a sad cow. Fitting.' },
    ],
  }),
  R({
    id: 'ro_concertMeet', years: [1960, 2300], bind: freshFlame, scene: 'concert', title: 'Front row',
    text: (x) => `Crushed in the front row, ${who(x)} knows every lyric you do.`,
    choices: [
      { label: 'Sing together', tags: ['social'], run: (x) => woo(x, 'Hoarse and happy, you swapped details at the exit.') },
      { label: 'Lift them on your shoulders', tags: ['impulsive'], run: (x) => { x.mods({ pain: 3 }); return woo(x, 'They saw the whole show. You saw their shoes.'); } },
      { label: 'Focus on the band', tags: ['cautious'], run: (x) => { x.mods({ happiness: 3 }); return 'Incredible gig. Lost them in the crowd.'; } },
    ],
  }),
  R({
    id: 'ro_volunteerMeet', years: [1850, 2300], bind: freshFlame, scene: 'volunteer', title: 'Helping hands',
    text: (x) => `At the ${x.year < 1950 ? 'charity kitchen' : 'food bank'}, ${who(x)} hands you a ladle and a smile.`,
    choices: [
      { label: 'Volunteer every week', tags: ['help'], run: (x) => { x.mods({ karma: 2 }); return woo(x, 'Your shifts kept lining up, oddly.'); } },
      { label: 'Ask them for coffee after', tags: ['social'], run: (x) => woo(x, 'Coffee after a long shift.') },
      { label: 'Just help out', tags: ['cautious'], run: (x) => { x.mods({ karma: 2 }); return 'A good day of good work.'; } },
    ],
  }),
  R({
    id: 'ro_hikingMeet', years: [1850, 2300], bind: freshFlame, scene: 'hiking', title: 'At the summit',
    text: (x) => `At the top of the trail, ${who(x)} offers to take your photo${x.year < 1900 ? ', which in this era means a sketch' : ''}.`,
    choices: [
      { label: 'Walk down together', tags: ['social'], run: (x) => woo(x, 'The descent took twice as long. On purpose.') },
      { label: 'Share your flask', tags: ['help'], run: (x) => woo(x, 'Tea and views and something new.') },
      { label: 'Race them down', tags: ['impulsive'], run: (x) => { x.mods({ fitness: 2 }); return x.chance(0.5) ? woo(x, 'You lost the race and won a date.') : 'You twisted an ankle. They carried your bag. Romantic-ish.'; } },
    ],
  }),
  R({
    id: 'ro_cookingClass', years: [1950, 2300], bind: freshFlame, scene: 'cooking', title: 'Cooking class',
    text: (x) => `Your cooking class partner, ${who(x)}, has just set the risotto on fire.`,
    choices: [
      { label: 'Help put it out', tags: ['help'], scene: 'fire', run: (x) => { x.train('cooking', 1); return woo(x, 'Heroism with a damp tea towel.'); } },
      { label: 'Laugh with them', tags: ['social'], run: (x) => woo(x, 'You both got the giggles. The chef did not.') },
      { label: 'Ask for a new partner', tags: ['cautious'], run: (x) => { x.train('cooking', 2); return 'Your new partner was competent and dull.'; } },
    ],
  }),
  R({
    id: 'ro_plusOne', when: single, bind: bindFriendCrush, scene: 'wedding', title: 'Plus one',
    text: (x) => `You need a plus-one for a wedding, and your friend ${who(x)} has offered to come "as a joke".`,
    choices: [
      { label: 'Treat it as a real date', tags: ['impulsive'], scene: 'dance', run: (x) => (x.chance(0.5) ? together(x, id(x), 'By the last slow dance, nobody was joking.') : (x.relMod(id(x), 4), 'Great fun. Firmly friends.')) },
      { label: 'Keep it a joke', tags: ['cautious'], run: (x) => { x.relMod(id(x), 5); return 'You fooled everyone. Even yourself, a bit.'; } },
      { label: 'Go alone', run: (x) => { x.mods({ loneliness: 2 }); return 'Singles table again. You know everyone there now.'; } },
    ],
  }),
  R({
    id: 'ro_friendToLover', bind: bindFriendCrush, weight: 1.2, scene: 'love', title: 'More than friends?',
    text: (x) => `You have known ${who(x)} for years. Lately, when they laugh, something in your chest does a little flip.`,
    choices: [
      { label: 'Tell them', tags: ['impulsive'], scene: 'kiss', run: (x) => { const r = x.rel(id(x)); if (r && r.affinity > 55 && x.chance(0.55)) return together(x, id(x), 'They said, "I wondered when you\'d notice."'); x.relMod(id(x), -6); return 'They were kind about it. Things are a bit strange now.'; } },
      { label: 'Drop hints', tags: ['social'], run: (x) => { x.relMod(id(x), 3); return 'They did not notice a single hint. Classic.'; } },
      { label: 'Protect the friendship', tags: ['cautious'], run: (x) => { x.relMod(id(x), 2, 3); return 'You kept it to yourself. The friendship stayed perfect.'; } },
    ],
  }),
  R({
    id: 'ro_secretAdmirer', when: single, scene: 'loveLetter', title: 'Secret admirer',
    text: 'Notes keep appearing in your coat pocket, signed only with a drawn heart.',
    choices: [
      { label: 'Stake out the cloakroom', tags: ['ambitious'], run: (x) => { const n = newFlame(x); x.addRel(n.id, 'acquaintance', { affinity: 60 }); return x.chance(0.6) ? together(x, n.id, `You caught ${n.firstName} red-handed and blushing.`) : `It was ${n.firstName}, who fled before you could speak.`; } },
      { label: 'Write a note back', tags: ['social'], run: (x) => { x.mods({ happiness: 3 }); return 'A secret correspondence. It is the best part of your week.'; } },
      { label: 'Ignore them', tags: ['cautious'], run: () => 'The notes stopped after a month. You kept them all.' },
    ],
  }),
  R({
    id: 'ro_youngerAdmirer', minAge: 40, bind: flameIf(single, [-22, -12]), scene: 'flirt', title: 'A younger admirer',
    text: (x) => `${who(x)}, who is a good deal younger than you, is very clearly flirting.`,
    choices: [
      { label: 'Enjoy it', tags: ['impulsive'], run: (x) => { x.mods({ ego: 3, confidence: 3 }); return woo(x, 'Your friends will never stop teasing.'); } },
      { label: 'Point out the age gap', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 1 }); return 'They said age is a number. You said so is your pension.'; } },
      { label: 'Laugh it off kindly', tags: ['help'], run: (x) => { x.mods({ happiness: 2 }); return 'A boost to your week, if nothing else.'; } },
    ],
  }),
  R({
    id: 'ro_richSuitor', bind: flameIf(single, [5, 20]), scene: 'luxury', title: 'A wealthy suitor',
    text: (x) => `${who(x)} is rich, attentive and keeps sending ${x.year < 1900 ? 'carriages' : 'cars'} to pick you up.`,
    choices: [
      { label: 'Fall for them', tags: ['impulsive'], run: (x) => { const n = x.npc(id(x)); if (n) n.wealth = Math.max(n.wealth, cost(x, 2000000)); return woo(x, 'Champagne on a terrace. You are not immune.'); } },
      { label: 'Refuse the gifts', tags: ['cautious'], run: (x) => { x.mods({ karma: 2 }); x.relMod(id(x), 2); return 'They were impressed nobody could buy you.'; } },
      { label: 'Keep the gifts, not them', tags: ['ambitious'], run: (x) => { x.money(cost(x, 800)); x.mods({ karma: -3 }); return 'A very nice watch and a very awkward goodbye.'; } },
    ],
  }),
  R({
    id: 'ro_fanDate', when: (x) => x.famous && single(x), bind: freshFlame, scene: 'fame', title: 'A fan',
    text: (x) => `${who(x)}, a fan, has sent you a letter so funny you read it three times.`,
    choices: [
      { label: 'Invite them to dinner', tags: ['impulsive'], run: (x) => woo(x, 'They were nervous for exactly four minutes.') },
      { label: 'Send a signed photo', tags: ['cautious'], run: (x) => { x.mods({ popularity: 1 }); return 'They framed it. You still think about the letter.'; } },
      { label: 'Ask your agent', tags: ['cautious'], run: () => 'Your agent said "absolutely not". Agents are no fun.' },
    ],
  }),
  R({
    id: 'ro_paparazzi', years: [1920, 2300], when: (x) => x.famous, bind: bindLover, scene: 'scandal', title: 'Caught on camera',
    text: (x) => `Photographers caught you and ${who(x)} kissing outside a restaurant. It is on every front page.`,
    choices: [
      { label: 'Make it official', tags: ['social'], scene: 'fame', run: (x) => { x.relMod(id(x), 6); x.story('gossip', `${x.c.firstName} and ${who(x)}: it's official`, 30); x.mod('fame', 2); return 'A joint statement and a lot of hearts online.'; } },
      { label: 'Deny it', tags: ['cautious'], run: (x) => { x.relMod(id(x), -6, -4); return '"Just friends." Your partner read that too.'; } },
      { label: 'Laugh it off', tags: ['impulsive'], run: (x) => { x.mods({ publicImage: 2 }); return 'You waved at the cameras next time. The press loved it.'; } },
    ],
  }),
  R({
    id: 'ro_firstHoliday', years: [1880, 2300], bind: bindPartner, scene: 'beach', title: 'First holiday together',
    text: (x) => `Your first holiday with ${who(x)}. You will learn exactly how they pack.`,
    choices: [
      { label: 'Go with the flow', tags: ['impulsive'], run: (x) => { x.spend(cost(x, 600)); x.relMod(id(x), 6); return 'No plans, great food, one sunburn each.'; } },
      { label: 'Plan everything', tags: ['cautious'], run: (x) => { x.spend(cost(x, 600)); x.relMod(id(x), x.chance(0.5) ? 4 : -3); return 'Their packing is chaos. Your itinerary is tyranny. You compromised.'; } },
      { label: 'Go camping', tags: ['social'], scene: 'camping', run: (x) => { x.spend(cost(x, 100)); x.relMod(id(x), x.chance(0.6) ? 6 : -4); return 'The tent fell down twice. It is your best story.'; } },
    ],
  }),
  R({
    id: 'ro_buyHouseTogether', years: [1900, 2300], bind: bindLover, scene: 'house', title: 'A place of our own',
    text: (x) => `You and ${who(x)} are looking at houses. One has a garden, the other has a bath you could swim in.`,
    choices: [
      { label: 'The garden', tags: ['cautious'], run: (x) => { x.relMod(id(x), 5); return 'Tomatoes in summer, and room for a dog.'; } },
      { label: 'The bath', tags: ['impulsive'], scene: 'spa', run: (x) => { x.relMod(id(x), 5); return 'Bubble baths for two. No regrets.'; } },
      { label: 'Keep renting', tags: ['cautious'], run: (x) => { x.relMod(id(x), -2); return 'Sensible. The estate agent sighed.'; } },
    ],
  }),
  R({
    id: 'ro_partnerWantsCat', years: [1800, 2300], when: (x) => x.pets().length === 0, bind: bindLover, scene: 'petCat', title: 'They want a cat',
    text: (x) => `${who(x)} has sent you photographs of a rescue cat called ${x.pick(['Biscuit', 'Duchess', 'Mr Whiskers', 'Pickle'])}.`,
    choices: [
      { label: 'Say yes', tags: ['help'], run: (x) => { x.relMod(id(x), 6); x.mods({ happiness: 3 }); return 'The cat chose them. You are merely staff now.'; } },
      { label: 'You are allergic', tags: ['cautious'], run: (x) => { x.relMod(id(x), -2); return 'They bought you antihistamines. The debate continues.'; } },
      { label: 'Counter-offer a dog', tags: ['ambitious'], scene: 'pet', run: (x) => { x.relMod(id(x), 1); return 'Negotiations have stalled.'; } },
    ],
  }),
  R({
    id: 'ro_gameNight', bind: bindLover, scene: 'gaming', title: 'Game night',
    text: (x) => `You and ${who(x)} are playing ${x.year < 1930 ? 'cards' : 'a board game'} and they are cheating. Blatantly.`,
    choices: [
      { label: 'Call it out', tags: ['ambitious'], scene: 'argument', run: (x) => { x.relMod(id(x), x.chance(0.5) ? 2 : -4); return 'A heated tribunal. The game was abandoned.'; } },
      { label: 'Cheat back', tags: ['impulsive'], run: (x) => { x.relMod(id(x), 5); return 'Total anarchy. Best night in months.'; } },
      { label: 'Let them win', tags: ['help'], run: (x) => { x.relMod(id(x), 3); return 'They did a victory dance. Worth it.'; } },
    ],
  }),
  R({
    id: 'ro_partnerPromotion', when: (x) => x.chance(0.6), bind: bindLover, scene: 'promotion', title: 'Their big news',
    text: (x) => `${who(x)} has been promoted and comes home glowing.`,
    choices: [
      { label: 'Celebrate in style', tags: ['social'], scene: 'restaurant', run: (x) => { x.spend(cost(x, 120)); x.relMod(id(x), 7); return 'Champagne and a toast you rehearsed on the bus.'; } },
      { label: 'Feel a pang of envy', tags: ['ambitious'], run: (x) => { x.mods({ ego: -2 }); x.relMod(id(x), -2); return 'You smiled. They noticed it did not reach your eyes.'; } },
      { label: 'Cook their favourite', tags: ['help'], scene: 'cooking', run: (x) => { x.relMod(id(x), 5); return 'Simple, warm and exactly right.'; } },
    ],
  }),
  R({
    id: 'ro_friendHatesPartner', bind: (x) => { const p = bindLover(x); const f = x.rels('bestFriend', 'friend').find((r) => alive(x, r.npcId)); return p && f ? { npcId: p.npcId, friendId: f.npcId } : null; }, scene: 'friends', title: 'Taking sides',
    text: (x) => `Your friend ${x.first(x.p.friendId as string)} says they cannot stand ${who(x)}, and would like to explain why. At length.`,
    choices: [
      { label: 'Defend your partner', tags: ['help'], run: (x) => { x.relMod(x.p.friendId as string, -8); x.relMod(id(x), 4); return 'Your friend went quiet. A crack has formed.'; } },
      { label: 'Hear them out', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 2 }); x.relMod(x.p.friendId as string, 3); return 'Some of it was fair. You will watch more closely.'; } },
      { label: 'Get them to have dinner', tags: ['social'], scene: 'familyDinner', run: (x) => { const ok = x.chance(0.5); x.relMod(x.p.friendId as string, ok ? 4 : -4); return ok ? 'Two hours later they were laughing at your expense. Peace.' : 'Two hours of icy politeness.'; } },
    ],
  }),
  R({
    id: 'ro_surpriseParty', bind: bindLover, scene: 'birthday', title: 'Their birthday',
    text: (x) => `It is ${who(x)}'s birthday soon, and they have said "nothing big" in a tone that means something big.`,
    choices: [
      { label: 'Throw a surprise party', tags: ['social'], scene: 'party', run: (x) => { x.spend(cost(x, 200)); x.relMod(id(x), x.chance(0.7) ? 8 : -2); return 'They screamed, then cried, then danced on a chair.'; } },
      { label: 'A quiet dinner for two', tags: ['cautious'], scene: 'date', run: (x) => { x.relMod(id(x), 5); return 'Just the two of you, and one candle in a pudding.'; } },
      { label: 'Take them at their word', run: (x) => { x.relMod(id(x), -5); return 'Nothing big. They were not pleased.'; } },
    ],
  }),
  R({
    id: 'ro_sleepTalking', bind: (x) => (isTypeNow(x, 'spouse', 'partner') ? bindLover(x) : null), scene: 'jealousy', title: 'A name in the night',
    text: (x) => `${who(x)} murmurs a name in their sleep. It is not yours.`,
    choices: [
      { label: 'Ask in the morning', tags: ['cautious'], run: (x) => { x.relMod(id(x), 1, 2); return 'It was their childhood dog. You both laughed, eventually.'; } },
      { label: 'Wake them and demand answers', tags: ['impulsive'], scene: 'argument', run: (x) => { x.relMod(id(x), -5); return 'A 3am interrogation about a dog called Rufus.'; } },
      { label: 'Say nothing, ever', run: (x) => { x.mods({ paranoia: 3 }); return 'You never asked. You still wonder.'; } },
    ],
  }),
  R({
    id: 'ro_futureTalk', maxAge: 45, bind: bindPartner, scene: 'calm', title: 'The future',
    text: (x) => `${who(x)} asks where you see yourselves in five years. You realise you have never discussed it.`,
    choices: [
      { label: 'Be totally honest', tags: ['help'], run: (x) => { const ok = x.chance(0.6); x.relMod(id(x), ok ? 6 : -8, 6); return ok ? 'Same dreams, different details. You can work with that.' : 'They want children; you do not. Or the other way round. Silence.'; } },
      { label: 'Say what they want to hear', tags: ['cautious'], run: (x) => { x.relMod(id(x), 3, -2); return 'They were happy. You were less sure.'; } },
      { label: 'Joke your way out', tags: ['social'], run: (x) => { x.relMod(id(x), -2); return '"Five years? I don\'t know what I\'m having for lunch."'; } },
    ],
  }),
];

const LATER: EventDef[] = [
  R({
    id: 'ro_forgotYourBirthday', bind: bindSpouse, scene: 'birthday', title: 'They forgot',
    text: (x) => `It is your birthday, and ${who(x)} has said nothing all day.`,
    choices: [
      { label: 'Drop a big hint', tags: ['social'], run: (x) => { x.relMod(id(x), -1); return 'They panicked and bought a cake from the petrol station. It was touching.'; } },
      { label: 'Sulk magnificently', tags: ['impulsive'], scene: 'argument', run: (x) => { x.relMod(id(x), -4); return 'A sulk for the ages. They will never forget again.'; } },
      { label: 'Wait and see', tags: ['cautious'], scene: 'party', run: (x) => { x.mods({ happiness: 6 }); x.relMod(id(x), 6); return 'Surprise! Thirty friends in the living room. They had not forgotten at all.'; } },
    ],
  }),
  R({
    id: 'ro_midlifeCar', minAge: 40, maxAge: 60, years: [1910, 2300], bind: bindSpouse, scene: 'car', title: 'Midlife crisis',
    text: (x) => `${who(x)} has come home with a bright red sports car and new sunglasses.`,
    choices: [
      { label: 'Take it for a spin', tags: ['impulsive'], run: (x) => { x.relMod(id(x), 6); x.mods({ happiness: 4 }); return 'Top down, wind in what remains of your hair. Fine, it is fun.'; } },
      { label: 'Ask what is really going on', tags: ['help'], run: (x) => { x.relMod(id(x), 5, 6); return 'They are scared of getting old. So are you. You held hands in the car park.'; } },
      { label: 'Make them return it', tags: ['cautious'], scene: 'argument', run: (x) => { x.money(cost(x, 500)); x.relMod(id(x), -6); return 'Back to the dealer, with a sulk in the passenger seat.'; } },
    ],
  }),
  R({
    id: 'ro_emptyNest', minAge: 45, when: kidsGrown, bind: bindSpouse, scene: 'family', title: 'Empty nest',
    text: (x) => `The children have all left home. It is just you and ${who(x)} and a very quiet house.`,
    choices: [
      { label: 'Rediscover each other', tags: ['social'], scene: 'romance', run: (x) => { x.relMod(id(x), 8); x.mods({ happiness: 5 }); return 'Long dinners, long walks, and you remember why it was you two.'; } },
      { label: 'Turn their room into a gym', tags: ['ambitious'], scene: 'gym', run: (x) => { x.mods({ fitness: 2 }); return 'The children were outraged. You were delighted.'; } },
      { label: 'Feel lost', tags: ['cautious'], scene: 'lonely', run: (x) => { x.mods({ loneliness: 5 }); x.relMod(id(x), 2); return 'You set too many plates for a month.'; } },
    ],
  }),
  R({
    id: 'ro_coupleSpa', years: [1900, 2300], bind: bindLover, scene: 'spa', title: 'Spa day',
    text: (x) => `${who(x)} has booked you both a spa day with cucumbers, robes and whale music.`,
    choices: [
      { label: 'Fully relax', tags: ['cautious'], run: (x) => { x.mods({ stress: -8 }); x.relMod(id(x), 5); return 'You fell asleep on the massage table and snored.'; } },
      { label: 'Try every treatment', tags: ['impulsive'], run: (x) => { x.spend(cost(x, 150)); x.relMod(id(x), 4); x.mods({ looks: 1 }); return 'Seaweed wrap, mud bath, regret.'; } },
      { label: 'Sneak in snacks', tags: ['social'], run: (x) => { x.relMod(id(x), 6); return 'Crisps in the hot tub. Rebels.'; } },
    ],
  }),
  R({
    id: 'ro_holidayFamilies', bind: bindInLaw, scene: 'familyDinner', title: 'Whose family?',
    text: (x) => `The holidays are coming. Your family or ${who(x)}'s? Both mothers have already started cooking.`,
    choices: [
      { label: 'Yours', tags: ['ambitious'], run: (x) => { x.relMod(x.p.inLaw as string, -6); x.relMod(id(x), -3); return 'Lovely holiday. Icy phone call with the in-laws.'; } },
      { label: 'Theirs', tags: ['help'], run: (x) => { x.relMod(x.p.inLaw as string, 6); x.relMod(id(x), 4); return 'You ate four helpings to be polite and slept for two days.'; } },
      { label: 'Both, in one day', tags: ['impulsive'], scene: 'roadTrip', run: (x) => { x.mods({ stress: 6 }); x.relMod(x.p.inLaw as string, 2); return 'Two dinners, six hours of driving, one heroic marriage.'; } },
    ],
  }),
  R({
    id: 'ro_retiredTogether', minAge: 62, bind: bindSpouse, scene: 'retirement', title: 'All day together',
    text: (x) => `You and ${who(x)} are both retired. You are together all day, every day.`,
    choices: [
      { label: 'Take up a joint hobby', tags: ['social'], scene: 'gardening', run: (x) => { x.relMod(id(x), 6); return 'Ballroom dancing on Tuesdays. Allotment on Thursdays.'; } },
      { label: 'Keep separate days', tags: ['cautious'], run: (x) => { x.relMod(id(x), 3); x.mods({ stress: -3 }); return 'Distance makes dinner conversation better.'; } },
      { label: 'Travel the world', tags: ['impulsive'], scene: 'travel', run: (x) => { x.spend(cost(x, 4000)); x.relMod(id(x), 8); return 'Postcards from everywhere to grandchildren who are jealous.'; } },
    ],
  }),
  R({
    id: 'ro_spouseForgetting', minAge: 70, bind: bindSpouse, weight: 0.5, scene: 'dementia', title: 'Fading memories',
    text: (x) => `Some mornings ${who(x)} does not quite remember your name. They still reach for your hand.`,
    choices: [
      { label: 'Tell them your story', tags: ['help'], scene: 'grandparents', run: (x) => { x.relMod(id(x), 6); x.mods({ happiness: -2, wisdom: 3 }); return 'Every day you tell how you met. Every day they smile at the ending.'; } },
      { label: 'Find good care', tags: ['cautious'], scene: 'nursingHome', run: (x) => { x.spend(cost(x, 3000)); x.mods({ stress: -3 }); return 'Kind nurses, a garden, and you there every afternoon.'; } },
      { label: 'Hold on alone', tags: ['impulsive'], run: (x) => { x.mods({ stress: 10, health: -2 }); x.relMod(id(x), 4); return 'Exhausting and tender. You would not trade a minute.'; } },
    ],
  }),
  R({
    id: 'ro_exOnline', years: [2008, 2300], bind: (x) => { const l = bindLover(x); const e = bindEx(x); return l && e && !x.rels('affair').length ? { npcId: e.npcId, homeId: l.npcId } : null; }, scene: 'datingApp', title: 'A message from the past',
    text: (x) => `${who(x)}, your ex from years ago, has messaged: "Been thinking about you. Drink sometime?"`,
    choices: [
      { label: 'Meet them', tags: ['impulsive'], scene: 'affair', run: (x) => (x.chance(0.5) ? beginAffair(x, id(x)) : 'One drink, a lot of nostalgia, and you went home. Close call.') },
      { label: 'Block them', tags: ['cautious'], run: (x) => { x.mods({ karma: 1 }); return 'Blocked. The past can stay there.'; } },
      { label: 'Show your partner', tags: ['help'], run: (x) => { x.relMod(x.p.homeId as string, 5, 6); return `${home(x)} wrote the reply. It was savage.`; } },
    ],
  }),
  R({
    id: 'ro_affairWeekend', bind: bindAffair, scene: 'travel', title: 'A stolen weekend',
    text: (x) => `${who(x)} wants a whole weekend away. You would have to tell ${home(x)} it is a work trip.`,
    choices: [
      { label: 'Go', tags: ['impulsive'], scene: 'nightTogether', run: (x) => { x.relMod(id(x), 8); x.mods({ happiness: 5, sin: 2 }); return slip(x, 20) ? caught(x, id(x)) : 'Two days of a different life. Monday felt very grey.'; } },
      { label: 'Just one evening', tags: ['cautious'], run: (x) => { x.relMod(id(x), -2); return 'They sulked. You were relieved.'; } },
      { label: 'Take your partner instead', tags: ['help'], run: (x) => { x.relMod(x.p.homeId as string, 8); x.relMod(id(x), -10); return `${home(x)} was thrilled. ${who(x)} was not.`; } },
    ],
  }),
  R({
    id: 'ro_affairBlackmail', bind: bindAffair, weight: 0.6, scene: 'bribe', title: 'Someone knows',
    text: (x) => `An unsigned ${note(x)}: "I know about you and ${who(x)}. ${x.fmt(cost(x, 2000))} keeps me quiet."`,
    choices: [
      { label: 'Pay up', tags: ['cautious'], run: (x) => (x.spend(cost(x, 2000)) ? (x.mods({ stress: 6 }), 'You paid. You will wonder forever if they are done.') : caught(x, id(x))) },
      { label: 'Call their bluff', tags: ['ambitious'], run: (x) => (x.chance(0.5) ? 'Nothing happened. A bluff after all.' : caught(x, id(x))) },
      { label: 'Confess before they can', tags: ['help'], run: (x) => { x.mods({ karma: 3 }); return caught(x, id(x)); } },
    ],
  }),
  R({
    id: 'ro_splitRecords', when: (x) => x.hasMemory('divorced') || recentEx(x), years: [1950, 2300], bind: bindEx, scene: 'moving', title: 'Dividing things',
    text: (x) => `You and ${who(x)} are dividing up ${x.year < 2000 ? 'the record collection' : 'the furniture'}. You both want the same thing.`,
    choices: [
      { label: 'Let them have it', tags: ['help'], run: (x) => { x.relMod(id(x), 6); x.mods({ karma: 1 }); return 'Generous. They looked surprised, then grateful.'; } },
      { label: 'Fight for it', tags: ['ambitious'], scene: 'argument', run: (x) => { x.relMod(id(x), -8); return 'You won the lamp. You lost your dignity.'; } },
      { label: 'Flip a coin', tags: ['cautious'], run: (x) => (x.chance(0.5) ? 'Heads. It is yours. You both laughed, briefly, like old times.' : 'Tails. You let it go with grace.') },
    ],
  }),
  R({
    id: 'ro_annulment', years: [1100, 1900], bind: (x) => { const p = bindSpouse(x); return p && (x.rel(p.npcId as string)?.affinity ?? 100) < 35 ? p : null; }, scene: 'holy', title: 'A petition for annulment',
    text: (x) => `Divorce is nearly impossible, but the Church might annul your marriage to ${who(x)}, for a price.`,
    choices: [
      { label: 'Petition the bishop', tags: ['ambitious'], run: (x) => { if (!x.spend(cost(x, 1500))) return 'You could not afford the fees. You remain married.'; return x.chance(0.5) ? endIt(x, 'After two years and many gifts, the marriage was declared never to have existed.') : 'The bishop refused. Your marriage, and your bill, stand.'; } },
      { label: 'Live apart quietly', tags: ['cautious'], run: (x) => { x.relMod(id(x), -2); x.mods({ loneliness: 4 }); return 'Separate houses, one name, no scandal.'; } },
      { label: 'Pray for patience', tags: ['help'], scene: 'holy', run: (x) => { x.mods({ faith: 3, stress: -2 }); x.relMod(id(x), 4); return 'Patience came, and a little warmth with it.'; } },
    ],
  }),
  R({
    id: 'ro_loveDuel', years: [1600, 1880], when: (x) => x.c.gender === 'male', bind: bindLover, weight: 0.6, scene: 'duel', title: 'A challenge',
    text: (x) => `A rival suitor has insulted ${who(x)}'s honour and challenged you to meet him at dawn.`,
    choices: [
      { label: 'Accept the duel', tags: ['violent'], run: (x) => { x.train('fencing', 2); if (x.chance(0.6)) { x.relMod(id(x), 10); x.mods({ ego: 4 }); return 'You fired into the air; he fled. Honour satisfied, nobody hurt.'; } x.mods({ health: -10, pain: 15 }); return 'A grazed arm and a ruined coat. You won, technically.'; } },
      { label: 'Refuse with wit', tags: ['cautious'], run: (x) => { x.mods({ publicImage: -2 }); x.relMod(id(x), 3); return 'Some called you a coward. Your love called you sensible.'; } },
      { label: 'Let them deal with him', tags: ['help'], run: (x) => { x.relMod(id(x), 5); return 'They slapped him with a glove. Society was enchanted.'; } },
    ],
  }),
  R({
    id: 'ro_partyLine', years: [1920, 1965], bind: bindLover, scene: 'gadget', title: 'The party line',
    text: (x) => `Every phone call with ${who(x)} goes through a shared party line. You can hear Mrs ${x.pick(['Higgins', 'Pemberton', 'Kowalski'])} breathing.`,
    choices: [
      { label: 'Speak in code', tags: ['cautious'], run: (x) => { x.relMod(id(x), 4); return '"The geese fly at midnight" now means "I love you".'; } },
      { label: 'Say it anyway', tags: ['impulsive'], run: (x) => { x.relMod(id(x), 5); x.mods({ publicImage: -1 }); return 'By Sunday the whole town knew. The vicar winked.'; } },
      { label: 'Write instead', tags: ['help'], scene: 'loveLetter', run: (x) => { x.relMod(id(x), 4); return 'Slower, more private, and you can keep them.'; } },
    ],
  }),
  R({
    id: 'ro_robotMatchmaker', years: [2045, 2300], when: single, scene: 'robots', title: 'The algorithm',
    text: 'A matchmaking AI has analysed ten years of your data and says it has found your 99.7% match.',
    choices: [
      { label: 'Trust the algorithm', tags: ['cautious'], run: (x) => { const n = newFlame(x); x.addRel(n.id, 'acquaintance', { affinity: 55 }); return x.chance(0.6) ? together(x, n.id, `${n.firstName} was eerily perfect. You are trying not to think about it.`) : `${n.firstName} was perfect on paper and dull in person. The AI apologised.`; } },
      { label: 'Ask for a 70% match', tags: ['impulsive'], run: (x) => { const n = newFlame(x); x.addRel(n.id, 'acquaintance', { affinity: 50 }); return x.chance(0.5) ? together(x, n.id, `${n.firstName} disagreed with you about everything, deliciously.`) : 'Seventy per cent was mostly arguments about pizza.'; } },
      { label: 'Turn it off', tags: ['cautious'], run: (x) => { x.mods({ romanticCynicism: -1 }); return 'Some things should be left to chance.'; } },
    ],
  }),
  R({
    id: 'ro_newYearKiss', years: [1600, 2300], when: single, bind: freshFlame, scene: 'fireworks', title: 'Midnight',
    text: (x) => `The countdown to the new year has begun and ${who(x)} is standing right beside you, also alone.`,
    choices: [
      { label: 'Kiss at midnight', tags: ['impulsive'], scene: 'kiss', run: (x) => (x.chance(0.55) ? together(x, id(x), 'Fireworks, literally and otherwise.') : 'They turned their cheek. Happy new year, anyway.') },
      { label: 'Toast together', tags: ['social'], run: (x) => woo(x, 'You clinked glasses and kept talking until two.') },
      { label: 'Watch the fireworks', tags: ['cautious'], run: (x) => { x.mods({ happiness: 2 }); return 'Beautiful sky. A small ache.'; } },
    ],
  }),
  R({
    id: 'ro_stormNight', bind: bindLover, scene: 'storm', title: 'Power cut',
    text: (x) => `A storm knocks out the ${x.year < 1900 ? 'lamps' : 'power'}. You and ${who(x)} are left with candles and nothing to do.`,
    choices: [
      { label: 'Tell ghost stories', tags: ['social'], scene: 'ghost', run: (x) => { x.relMod(id(x), 5); return 'You scared each other so badly you slept with the candle lit.'; } },
      { label: 'Make it romantic', tags: ['impulsive'], scene: 'nightTogether', run: (x) => { x.relMod(id(x), 7); return 'Candlelight and rain on the windows. The power came back unnoticed.'; } },
      { label: 'Fix the fuse', tags: ['cautious'], run: (x) => { x.train('electrical', 1); x.relMod(id(x), 2); return 'Light restored, mood somewhat ruined.'; } },
    ],
  }),
  R({
    id: 'ro_gossipCouple', when: (x) => x.w.socialNorms < 50, bind: (x) => { const p = bindPartner(x); return p && !x.spouse() ? p : null; }, scene: 'scandal', title: 'Living in sin',
    text: (x) => `The neighbours have noticed that you and ${who(x)} spend a lot of time together without being married.`,
    choices: [
      { label: 'Ignore them', tags: ['impulsive'], run: (x) => { x.mods({ publicImage: -3 }); x.relMod(id(x), 4); return 'Let them talk. You have each other.'; } },
      { label: 'Get engaged', tags: ['cautious'], scene: 'proposal', run: (x) => `To silence the gossip, you asked. ${ask(x, 3)}` },
      { label: 'Be more discreet', tags: ['cautious'], run: (x) => { x.relMod(id(x), -2); return 'Separate entrances and careful timing. Tiring.'; } },
    ],
  }),
];

// @@NEXT

export const ROMANCE_EVENTS: EventDef[] = [...MEETING, ...DATING, ...INTIMACY, ...COMMITMENT, ...MISHAP_EVENTS, ...MARRIED, ...AFFAIRS, ...AFFAIR_CHAIN_EVENTS, ...ENDINGS, ...LGBT, ...ERA_LOVE, ...CHAIN_EVENTS, ...MORE, ...LATER];

export const ROMANCE_CHAINS: ChainDef[] = [
  { id: 'ro_chain_affair', name: 'The affair', desc: 'A secret love that grows harder to hide every year.', steps: [{ delay: 0, eventId: 'ro_af_lies' }, { delay: 1, eventId: 'ro_af_suspicion' }, { delay: 2, eventId: 'ro_af_reckoning' }] },
  { id: 'ro_chain_whirlwind', name: 'Whirlwind romance', desc: 'A holiday fling that refuses to stay on holiday.', steps: [{ delay: 0, eventId: 'ro_ww_return' }, { delay: 1, eventId: 'ro_ww_proposal' }, { delay: 1, eventId: 'ro_ww_reality' }] },
  { id: 'ro_chain_lostLetters', name: 'Lost letters', desc: 'An old love answers a letter, years later.', steps: [{ delay: 0, eventId: 'ro_ll_reply' }, { delay: 1, eventId: 'ro_ll_meeting' }] },
];

void fmtYear;
void trauma;
void tryForBaby;
void endIt;
void elope;
void ask;
void caught;
void tempter;
void bindAffair;
void bindSpouse;
void bindPartner;
void bindLover;
void isType;
void widowed;
void yearsWed;
void sameSex;
void note;
void woo;
