import type { ChainDef, EventDef } from './types';
import type { Ctx } from '../ctx';
import type { AddictionKind } from '../types';
import { bindRel, check, npcId, who } from './helpers';
import { diagnose, injure, bmiCategory } from '../systems/body';
import { onset, cure, hasCondition, therapyAvailable, medicationAvailable } from '../systems/mind';
import { expose, addictionOf, attemptRecovery } from '../systems/addiction';
import { eraCostFactor } from '../systems/finance';

// ------------------------------------------------------------------ local helpers

/** Modern dollars scaled to the era. */
function cost(x: Ctx, n: number): number {
  return Math.max(1, Math.round(n * eraCostFactor(x.year)));
}

/** Pay an era-scaled bill if possible. */
function pay(x: Ctx, n: number): boolean {
  return x.spend(cost(x, n));
}

function hasChronic(x: Ctx, id: string): boolean {
  return x.c.bio.chronic.some((c) => c.id === id);
}

function untreated(x: Ctx) {
  return x.c.bio.chronic.find((c) => !c.managed);
}

function manageAll(x: Ctx): number {
  let n = 0;
  for (const c of x.c.bio.chronic) if (!c.managed) { c.managed = true; n++; }
  return n;
}

function addicted(x: Ctx, kind?: AddictionKind): boolean {
  return x.c.addictions.some((a) => (kind ? a.kind === kind : true) && a.active);
}

function recovering(x: Ctx): AddictionKind | null {
  const a = x.c.addictions.find((d) => d.everActive && (d.inRecovery || (!d.active && d.yearsClean > 0)));
  return a ? a.kind : null;
}

function doctor(x: Ctx): string {
  if (x.year < 1400) return 'the healer';
  if (x.year < 1850) return 'the physician';
  return 'the doctor';
}

function grandkid(x: Ctx) {
  return x.rels('grandchild')[0];
}

function friendOf(x: Ctx) {
  return x.rels('bestFriend', 'friend').sort((a, b) => b.affinity - a.affinity)[0];
}

const female = (x: Ctx) => x.c.gender === 'female';
const male = (x: Ctx) => x.c.gender === 'male';

/** Body, mind and growing old. */
export const AGING_EVENTS: EventDef[] = [
  // ================================================================== BODY
  {
    id: 'ag_commonCold', cat: 'health', minAge: 18, weight: 1.2, cooldown: 2, scene: 'sick',
    title: 'Streaming cold',
    text: 'Your nose has become a tap and your head is full of wet wool.',
    choices: [
      { label: 'Stay in bed', tags: ['cautious'], run: (x) => { x.mods({ health: 2, stress: -3, energy: 4 }); return 'Two days of soup and naps. You emerged reborn and slightly embarrassed by your browser history.'; } },
      { label: 'Power through', tags: ['ambitious'], run: (x) => { x.mods({ health: -4, stress: 3 }); if (x.employed) x.mod('professionalRep', 1); return 'You worked through it and generously shared it with everyone in the building.'; } },
      { label: (x) => (x.year < 1900 ? 'Try a folk remedy' : 'Try a weird home remedy'), tags: ['impulsive'], run: (x) => { x.train('herbalism', 2); if (x.chance(0.5)) { x.mod('health', 3); return 'Garlic, honey and something brown. Against all odds, it worked.'; } x.mod('happiness', -2); return 'The onion in your sock did nothing but make the sock smell like onion.'; } },
    ],
  },
  {
    id: 'ag_foodPoisoning', cat: 'health', minAge: 16, weight: 0.8, cooldown: 4, scene: 'sick',
    title: 'Bad shellfish',
    text: 'Something you ate last night has filed a formal complaint.',
    choices: [
      { label: 'Ride it out', tags: ['cautious'], run: (x) => { x.mods({ health: -5, fitness: -1, happiness: -3 }); return 'You spent a long night on first-name terms with the bathroom floor.'; } },
      { label: 'See a doctor', tags: ['help'], when: (x) => x.year >= 1850, scene: 'checkup', run: (x) => { pay(x, 120); x.mods({ health: -2 }); return 'Fluids, rest and a stern lecture about gas-station sushi.'; } },
      { label: 'Write a scathing review', tags: ['social'], run: (x) => { x.mods({ health: -5, ego: 2 }); x.train('writing', 2); return x.year >= 2000 ? 'Your one-star review got 400 likes. The restaurant replied with a coupon.' : 'You told everyone in town. The cook glared at you for a decade.'; } },
    ],
  },
  {
    id: 'ag_sprainedAnkle', cat: 'health', minAge: 14, maxAge: 85, weight: 0.8, cooldown: 4, scene: 'sick',
    title: 'Rolled ankle',
    text: 'One wrong step off a curb and your ankle is now the size of a grapefruit.',
    choices: [
      { label: 'Rest, ice, elevate', tags: ['cautious'], run: (x) => { x.mods({ pain: 5, fitness: -2 }); return 'Two weeks on the couch with a bag of frozen peas. Full recovery.'; } },
      { label: 'Walk it off', tags: ['impulsive'], run: (x) => { x.mods({ pain: 10 }); if (x.chance(0.15)) return `It never quite healed right. ${injure(x, false, 'limp')}`; return 'It hurt for a month but you were proven technically right.'; } },
      { label: 'Get it x-rayed', tags: ['help'], when: (x) => x.year >= 1900, scene: 'hospital', run: (x) => { pay(x, 300); x.mods({ pain: 3 }); return 'Just a sprain. You got a fetching boot and a lot of sympathy.'; } },
    ],
  },
  {
    id: 'ag_brokenWrist', cat: 'health', minAge: 8, weight: (x) => (x.age >= 65 ? 1 : 0.4), cooldown: 6, scene: 'hospital',
    title: 'A bad fall',
    text: (x) => (x.age >= 65 ? 'The rug and you finally had it out. The rug won and your wrist is broken.' : 'You put out a hand to break a fall and it broke instead.'),
    choices: [
      { label: (x) => (x.year < 1850 ? 'Have it splinted' : 'Get a proper cast'), tags: ['help'], run: (x) => { pay(x, 800); x.mods({ pain: 8, health: -3 }); return x.year < 1850 ? 'The bonesetter pulled, you screamed, and two sticks did the rest.' : 'Six weeks in a cast covered in signatures and one rude drawing.'; } },
      { label: 'Physical therapy after', tags: ['cautious'], when: (x) => x.year >= 1940, scene: 'gym', run: (x) => { pay(x, 600); x.mods({ pain: 4, discipline: 2, dexterity: 1 }); return 'Squeezing foam balls three times a day. It works, annoyingly.'; } },
      { label: 'Ignore it', tags: ['impulsive'], run: (x) => { x.mods({ pain: 12 }); if (x.chance(0.5)) return `It set crooked. ${injure(x, false, 'badBones')}`; return 'Somehow it healed. Your doctor is still annoyed.'; } },
    ],
  },
  {
    id: 'ag_hayFever', cat: 'health', minAge: 6, weight: 0.7, cooldown: 5, scene: 'sick',
    title: 'Pollen season',
    text: 'Every tree in the region has decided to reproduce directly into your face.',
    choices: [
      { label: 'Take antihistamines', tags: ['cautious'], when: (x) => x.year >= 1945, run: (x) => { pay(x, 15); x.mods({ energy: -3, happiness: 2 }); return 'Your sneezing stopped and you slept for fourteen hours.'; } },
      { label: 'Stay indoors', tags: ['cautious'], run: (x) => { x.mods({ loneliness: 3, fitness: -1 }); return 'You watched spring happen through a closed window.'; } },
      { label: 'Eat local honey', run: (x) => { x.train('herbalism', 1); return x.chance(0.3) ? 'Either the honey worked or the season ended. You credit the honey.' : 'Delicious, sticky and medically useless.'; } },
    ],
  },
  {
    id: 'ag_allergyDiscovery', cat: 'health', minAge: 18, weight: 0.4, once: true, scene: 'hospital',
    title: 'Sudden allergy',
    text: 'Halfway through dinner your lips start to tingle and swell. Apparently you are allergic now.',
    choices: [
      { label: 'Get to a hospital', tags: ['help'], run: (x) => { pay(x, 900); x.mods({ health: -4, anxiety: 4 }); x.remember('allergy', 'Discovered a serious food allergy', 25); return x.year >= 1960 ? 'A shot, an hour of monitoring and a lifetime supply of label reading.' : 'The physician bled you, which did nothing, but it passed anyway.'; } },
      { label: 'Wait it out', tags: ['cautious'], run: (x) => { x.mods({ health: -8, anxiety: 8 }); return 'It passed, slowly. You will never look at a prawn the same way.'; } },
      { label: 'Finish the plate', tags: ['impulsive'], run: (x) => { x.mods({ health: -14, anxiety: 6 }); return 'Bold. Stupid. You spent the night wheezing and reconsidering everything.'; } },
    ],
  },
  {
    id: 'ag_toothache', cat: 'health', minAge: 10, weight: 0.8, cooldown: 4, scene: 'dentist',
    title: 'Throbbing tooth',
    text: 'One molar has started screaming every time you drink anything cold.',
    choices: [
      { label: (x) => (x.year < 1850 ? 'Visit the barber-surgeon' : 'Book the dentist'), tags: ['help'], run: (x) => { pay(x, 250); x.mods({ pain: x.year < 1850 ? 10 : 3, health: 2 }); return x.year < 1850 ? 'He pulled it with pliers and a knee on your chest. Problem solved.' : 'A filling and a lecture about flossing. You promised. You lied.'; } },
      { label: 'Chew on the other side', tags: ['cautious'], run: (x) => { x.mods({ pain: 6 }); if (x.chance(0.3)) { x.mod('health', -5); return 'It became an abscess. Your face swelled like a chipmunk.'; } return 'It quietly went away. Teeth are mysterious.'; } },
      { label: 'Clove oil', run: (x) => { x.train('herbalism', 2); x.mod('pain', -3); return 'Numb, spicy and only a temporary truce.'; } },
    ],
  },
  {
    id: 'ag_dentistCleaning', cat: 'health', minAge: 18, years: [1920, 2300], weight: 0.6, cooldown: 4, scene: 'dentist',
    title: 'Dental cleaning',
    text: 'The hygienist asks you questions while both of her hands are in your mouth.',
    choices: [
      { label: 'Answer anyway', tags: ['social'], run: (x) => { x.mods({ happiness: 1 }); return '"Aaah ooh ahhh." She understood perfectly. They always do.'; } },
      { label: 'Get whitening', tags: ['impulsive'], when: (x) => x.year >= 1990, run: (x) => { if (!pay(x, 400)) return 'You could not afford the smile upgrade.'; x.mods({ looks: 2, confidence: 2 }); return 'Your teeth now glow faintly in the dark.'; } },
      { label: 'Admit you never floss', tags: ['cautious'], run: (x) => { x.mods({ health: 1, discipline: 1 }); return 'Honesty earned you a pamphlet and a tiny disappointed sigh.'; } },
    ],
  },
  {
    id: 'ag_wisdomTeeth', cat: 'health', minAge: 17, maxAge: 30, weight: 0.5, once: true, scene: 'dentist',
    title: 'Wisdom teeth',
    text: 'Four wisdom teeth are growing in sideways like they have somewhere better to be.',
    choices: [
      { label: 'Have them out', tags: ['help'], when: (x) => x.year >= 1900, run: (x) => { pay(x, 1200); x.mods({ pain: 6, happiness: 2 }); return 'You said loving, baffling things on the anaesthetic and lived on ice cream for a week.'; } },
      { label: 'Leave them', tags: ['cautious'], run: (x) => { x.mods({ pain: 4 }); return 'They made a little room for themselves. Your jaw clicks now.'; } },
      { label: 'Pull them yourself', tags: ['impulsive'], when: (x) => x.year < 1900, run: (x) => { x.mods({ pain: 15, health: -4, resilience: 3 }); return 'String, a door and a deep breath. Never again.'; } },
    ],
  },
  {
    id: 'ag_squinting', cat: 'health', minAge: 14, maxAge: 60, years: [1300, 2300], weight: 0.6, once: true, scene: 'checkup',
    title: 'Blurry world',
    text: 'Street signs have started to look like abstract art.',
    choices: [
      { label: 'Get glasses', tags: ['cautious'], run: (x) => { pay(x, 200); x.mods({ smarts: 1, happiness: 2, looks: x.chance(0.5) ? 1 : -1 }); return 'Trees have individual leaves! Who knew?'; } },
      { label: 'Try contact lenses', when: (x) => x.year >= 1960, run: (x) => { pay(x, 300); x.mods({ looks: 1, happiness: 1 }); return 'You poked yourself in the eye forty times. Then it clicked.'; } },
      { label: 'Laser surgery', tags: ['ambitious'], when: (x) => x.year >= 1995, scene: 'surgery', run: (x) => { if (!pay(x, 3500)) return 'The price made your eyes water more than the laser would have.'; x.mods({ happiness: 4, confidence: 2 }); return 'Ten minutes, a smell of burning, and perfect vision.'; } },
      { label: 'Squint harder', tags: ['impulsive'], run: (x) => { x.mods({ pain: 2 }); return 'You now wave at strangers who turn out to be bins.'; } },
    ],
  },
  {
    id: 'ag_hearingCheck', cat: 'health', minAge: 50, weight: (x) => (x.age >= 65 ? 1 : 0.4), once: true, scene: 'checkup',
    title: 'Say that again?',
    text: 'Your family has started speaking to you very slowly and very loudly.',
    choices: [
      { label: (x) => (x.year >= 1950 ? 'Get a hearing aid' : 'Buy an ear trumpet'), tags: ['help'], run: (x) => { pay(x, x.year >= 1950 ? 1500 : 30); x.mods({ happiness: 3, loneliness: -4 }); return x.year >= 1950 ? 'Birds! Fridges! The neighbour\'s opinions! The world is noisy again.' : 'A brass horn the size of a trombone. You hear everything and look magnificent.'; } },
      { label: 'Just nod along', tags: ['cautious'], run: (x) => { x.mods({ loneliness: 4 }); return 'You agreed to things you did not hear. One of them was a cruise.'; } },
      { label: 'Blame the mumblers', tags: ['impulsive'], run: (x) => { x.mods({ ego: 2, loneliness: 2 }); return 'Everyone mumbles nowadays. This is a hill you will die on.'; } },
    ],
  },
  {
    id: 'ag_scaleShock', cat: 'health', minAge: 20, weight: (x) => (bmiCategory(x.c) === 'overweight' || bmiCategory(x.c) === 'obese' ? 1.2 : 0.3), cooldown: 4, scene: 'checkup',
    title: 'The scale',
    text: 'The number on the scale has opinions about your recent life choices.',
    choices: [
      { label: 'Eat healthier', tags: ['cautious'], run: (x) => { x.c.diet = 'healthy'; x.c.bio.weightKg = Math.max(45, x.c.bio.weightKg - x.int(2, 6)); x.mods({ health: 3, discipline: 2 }); return 'You discovered vegetables are fine if you add enough garlic.'; } },
      { label: 'Join a gym', tags: ['ambitious'], when: (x) => x.year >= 1950, scene: 'gym', run: (x) => { pay(x, 400); x.c.bio.weightKg = Math.max(45, x.c.bio.weightKg - x.int(1, 5)); x.mods({ fitness: 4, confidence: 2 }); x.train('strengthTraining', 3); return 'You went more than three times, which puts you in the elite top half.'; } },
      { label: 'Throw out the scale', tags: ['impulsive'], run: (x) => { x.mods({ happiness: 2, health: -1 }); return 'Problem solved, in a sense.'; } },
    ],
  },
  {
    id: 'ag_fadDiet', cat: 'health', minAge: 18, years: [1920, 2300], weight: 0.5, cooldown: 5, scene: 'cooking',
    title: 'Miracle diet',
    text: (x) => `Everyone at ${x.employed ? 'work' : 'the club'} is on a new diet that involves eating only ${x.pick(['grapefruit', 'cabbage soup', 'raw meat', 'shakes', 'things beginning with P'])}.`,
    choices: [
      { label: 'Try it', tags: ['impulsive'], run: (x) => { x.c.bio.weightKg = Math.max(45, x.c.bio.weightKg - x.int(1, 4)); x.mods({ happiness: -3, energy: -4 }); return 'You lost weight and the will to live, then found both again at a buffet.'; } },
      { label: 'Stick to balanced meals', tags: ['cautious'], run: (x) => { x.c.diet = 'balanced'; x.mods({ health: 2, wisdom: 1 }); return 'Boring, effective and smug.'; } },
      { label: 'Mock it loudly', tags: ['social'], run: (x) => { x.mods({ popularity: -1, ego: 2 }); x.train('humor', 2); return 'Your impression of the cabbage-soup guy got a laugh. Not from him.'; } },
    ],
  },
  {
    id: 'ag_firstFiveK', cat: 'health', minAge: 18, maxAge: 75, years: [1970, 2300], weight: (x) => (x.stat('fitness') >= 40 ? 0.7 : 0.3), once: true, scene: 'sports',
    title: 'Your first 5K',
    text: 'A friend talked you into a charity 5K. The start line is full of people in very short shorts.',
    choices: [
      { label: 'Run the whole thing', tags: ['ambitious'], run: (x) => { const ok = check(x, x.stat('fitness'), 45); x.train('running', 4); x.mods(ok ? { fitness: 3, confidence: 4, happiness: 4 } : { fitness: 2, pain: 4 }); return ok ? 'You crossed the line red-faced and euphoric. You bought the T-shirt.' : 'You walked the last kilometre behind a man dressed as a banana.'; } },
      { label: 'Jog and chat', tags: ['social'], scene: 'friends', run: (x) => { x.mods({ fitness: 2, loneliness: -3, happiness: 3 }); return 'Slowest time in your age group. Best conversation, though.'; } },
      { label: 'Cheer from the side', tags: ['cautious'], run: (x) => { x.mods({ happiness: 1 }); return 'You held a sign. Your sign was funnier than most people\'s training.'; } },
    ],
  },
  {
    id: 'ag_marathon', cat: 'health', minAge: 20, maxAge: 75, years: [1896, 2300], weight: (x) => (x.stat('fitness') >= 55 ? 0.8 : 0), cooldown: 6, scene: 'sports',
    title: 'Marathon day',
    text: 'Twenty-six miles. You trained for months and your toenails have filed for divorce.',
    choices: [
      { label: 'Go for a personal best', tags: ['ambitious'], run: (x) => { x.train('marathon', 6); if (check(x, x.stat('fitness') + x.stat('willpower') / 2, 80)) { x.mods({ confidence: 6, happiness: 6, fitness: 2 }); x.remember('marathon', 'Ran a marathon', 35); return 'You smashed it and cried at mile 26 for reasons you could not explain.'; } x.mods({ pain: 10, health: -3 }); return 'You hit the wall at mile 20. The wall won, but you finished.'; } },
      { label: 'Run for charity', tags: ['help'], scene: 'volunteer', run: (x) => { x.train('marathon', 4); x.mods({ karma: 4, happiness: 5, fitness: 1 }); x.remember('marathon', 'Ran a marathon for charity', 35); return 'You raised money for a children\'s hospital and finished holding hands with a stranger.'; } },
      { label: 'Pull out sensibly', tags: ['cautious'], run: (x) => { x.mods({ happiness: -2, health: 1 }); return 'Your knee whispered "no". For once, you listened.'; } },
    ],
  },
  {
    id: 'ag_badSleep', cat: 'health', minAge: 18, weight: (x) => (x.stat('stress') >= 50 ? 1.2 : 0.5), cooldown: 3, scene: 'lonely',
    title: '3 a.m. again',
    text: 'You are awake at 3 a.m. replaying a conversation from 2009 in high definition.',
    choices: [
      { label: 'Build a sleep routine', tags: ['cautious'], scene: 'calm', run: (x) => { x.mods({ energy: 6, stress: -4, discipline: 2 }); return 'Same bedtime, no screens, cold room. Boring, beautiful sleep.'; } },
      { label: 'Get up and read', run: (x) => { x.mods({ smarts: 1, energy: -2 }); return 'You finished a whole novel and fell asleep on the last page.'; } },
      { label: 'Nightcap', tags: ['impulsive'], scene: 'bar', run: (x) => { expose(x, 'alcohol', 0.3); x.mods({ energy: -2 }); return 'It knocked you out and woke you again at 4. Classic.'; } },
      { label: 'See a sleep doctor', tags: ['help'], when: (x) => x.year >= 1970, scene: 'checkup', run: (x) => { pay(x, 400); if (hasCondition(x, 'insomnia')) cure(x, 'insomnia'); x.mods({ energy: 8, stress: -3 }); return 'They wired you up overnight and found the problem. You sleep like a cat now.'; } },
    ],
  },
  {
    id: 'ag_snoring', cat: 'health', minAge: 30, weight: 0.5, cooldown: 6, scene: 'sick',
    bind: (x) => { const l = x.lover(); return l ? { npcId: l.npcId } : null; },
    title: 'The snoring',
    text: (x) => `${who(x)} recorded you sleeping. It sounds like a moose dragging a chainsaw up a staircase.`,
    choices: [
      { label: 'Get it checked', tags: ['help'], when: (x) => x.year >= 1970, scene: 'checkup', run: (x) => { pay(x, 500); x.mods({ energy: 5, health: 2 }); x.relMod(npcId(x), 4); return 'Sleep apnoea. A mask that makes you look like a fighter pilot fixed it.'; } },
      { label: 'Deny everything', tags: ['impulsive'], run: (x) => { x.relMod(npcId(x), -3); return `"That was the dog." ${who(x)} pointed out you do not have a dog.`; } },
      { label: 'Sleep in another room', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), -1); x.mods({ energy: 3, loneliness: 2 }); return 'Everyone is rested and slightly lonely.'; } },
    ],
  },
  {
    id: 'ag_annualCheckup', cat: 'health', minAge: 30, years: [1920, 2300], weight: (x) => (x.age >= 50 ? 1 : 0.5), cooldown: 3, scene: 'checkup',
    title: 'Annual check-up',
    text: (x) => `${doctor(x)[0].toUpperCase() + doctor(x).slice(1)} asks how much you drink and you halve the real number out of habit.`,
    choices: [
      { label: 'Be honest', tags: ['cautious'], run: (x) => { pay(x, 150); x.mods({ health: 3, wisdom: 1 }); if (x.age >= 45 && !hasChronic(x, 'hypertension') && x.chance(0.2)) { diagnose(x, 'hypertension'); return 'Your blood pressure is high. Caught early, at least.'; } return 'All good. Bloodwork came back boring, which is the dream.'; } },
      { label: 'Ask for every test', tags: ['ambitious'], run: (x) => { pay(x, 600); x.mods({ anxiety: 2, health: 2 }); if (x.age >= 40 && x.chance(0.15)) { const id = x.pick(['diabetes', 'hypertension', 'heartDisease']); if (diagnose(x, id)) { x.c.bio.chronic[x.c.bio.chronic.length - 1].managed = true; return 'They found something early, and early is everything. It is managed.'; } } return 'Every test is normal. You feel faintly cheated.'; } },
      { label: 'Skip it this year', tags: ['impulsive'], run: (x) => { x.mods({ stress: -1 }); return 'What you do not know cannot hurt you, according to no doctor ever.'; } },
    ],
  },
  {
    id: 'ag_secondOpinion', cat: 'health', minAge: 18, weight: (x) => (untreated(x) ? 1.5 : 0), cooldown: 4, scene: 'checkup',
    when: (x) => !!untreated(x),
    title: 'Second opinion',
    text: 'The first doctor was rushed and vague. A friend swears by a specialist across town.',
    choices: [
      { label: 'See the specialist', tags: ['help'], run: (x) => { if (!pay(x, 700)) return 'The specialist was beyond your budget.'; const c = untreated(x); if (c) c.managed = true; x.mods({ anxiety: -5, health: 3 }); return 'A clear plan, a better prescription and a doctor who actually looked up from the chart.'; } },
      { label: 'Trust the first doctor', tags: ['cautious'], run: (x) => { x.mods({ anxiety: 2 }); return 'You stuck with the plan you had. It is fine. Probably.'; } },
      { label: 'Ask the internet', tags: ['impulsive'], when: (x) => x.year >= 1998, scene: 'internet', run: (x) => { x.mods({ anxiety: 8 }); return 'The internet says you have either a cold or eleven fatal diseases.'; } },
    ],
  },
  {
    id: 'ag_altMedicine', cat: 'health', minAge: 18, weight: 0.5, cooldown: 5, scene: 'calm',
    title: 'Alternative cure',
    text: (x) => `A neighbour swears ${x.year >= 1970 ? x.pick(['crystals', 'acupuncture', 'homeopathic drops', 'a juice cleanse']) : x.pick(['leeches', 'a tonic from a travelling salesman', 'a lucky charm', 'mercury pills'])} cured everything from gout to heartbreak.`,
    choices: [
      { label: 'Give it a go', tags: ['impulsive'], run: (x) => { pay(x, 80); if (x.chance(0.35)) { x.mods({ happiness: 3, stress: -3 }); return 'You felt better. Placebo is still an effect.'; } x.mods({ health: -1 }); return 'It did nothing except empty your wallet with impressive confidence.'; } },
      { label: 'Ask a real doctor', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 2 }); return `${doctor(x)} raised one eyebrow so high it nearly left the building.`; } },
      { label: 'Sell it yourself', tags: ['ambitious'], when: (x) => x.stat('karma') < 0 || x.stat('ego') > 60, run: (x) => { x.money(cost(x, 300)); x.mods({ karma: -4 }); return 'You bottled tap water and called it "Vitality Essence". It sold out.'; } },
    ],
  },
  {
    id: 'ag_bloodletting', cat: 'health', minAge: 12, years: [-800, 1850], weight: 0.7, cooldown: 4, scene: 'checkup',
    title: 'Balancing humours',
    text: 'The physician declares your humours unbalanced and reaches for a lancet and a bowl.',
    choices: [
      { label: 'Submit to bleeding', run: (x) => { x.mods({ health: -5, energy: -6 }); return 'Pale, dizzy, and assured you are cured. You feel worse.'; } },
      { label: 'Ask for herbs instead', tags: ['cautious'], scene: 'gardening', run: (x) => { x.train('herbalism', 3); x.mods({ health: 2 }); return 'Willow bark and rest. Accidental, ancient aspirin.'; } },
      { label: 'Pray instead', tags: ['cautious'], scene: 'holy', run: (x) => { x.mods({ faith: 3, health: 1 }); x.train('prayer', 2); return 'You recovered. The physician took credit anyway.'; } },
    ],
  },
  {
    id: 'ag_plagueDoctor', cat: 'health', minAge: 5, years: [1340, 1720], weight: (x) => (x.w.healthCrisis ? 2 : 0.3), cooldown: 8, scene: 'plague',
    title: 'The beaked doctor',
    text: 'A figure in a bird mask and waxed coat knocks at your door, asking about fevers.',
    choices: [
      { label: 'Flee to the countryside', tags: ['cautious'], scene: 'refugees', run: (x) => { pay(x, 100); x.mods({ stress: 4, health: 2 }); return 'Fresh air and distance. The single best medicine of the century.'; } },
      { label: 'Let him in', tags: ['help'], run: (x) => { if (x.chance(0.25)) { x.mods({ health: -12 }); return 'He brought more sickness than he cured. You barely survived the fever.'; } x.mods({ anxiety: 3 }); return 'He sniffed his herb-filled beak, declared you healthy and left smoke behind.'; } },
      { label: 'Bar the door', tags: ['impulsive'], run: (x) => { x.mods({ loneliness: 6, anxiety: 5 }); return 'You stayed shut in for weeks. Lonely, but alive.'; } },
    ],
  },
  {
    id: 'ag_penicillin', cat: 'health', minAge: 5, years: [1942, 2300], weight: 0.6, cooldown: 6, scene: 'hospital',
    title: 'Infected cut',
    text: 'A small cut has gone red, hot and angry. A generation ago this could have killed you.',
    choices: [
      { label: 'Take the antibiotics', tags: ['help'], run: (x) => { pay(x, 60); x.mods({ health: 2 }); return x.year < 1955 ? 'Penicillin! The miracle drug cleared it in days. You feel like you live in the future.' : 'Ten days of pills. Gone. Modern medicine is quietly astonishing.'; } },
      { label: 'Stop the pills early', tags: ['impulsive'], run: (x) => { x.mods({ health: -4 }); return 'It came back angrier. Finish the course, says everyone, correctly.'; } },
      { label: 'Wait and see', tags: ['cautious'], run: (x) => { if (x.chance(0.3)) { x.mods({ health: -10 }); return 'It spread. You ended up on an IV drip for a week.'; } return 'Your immune system handled it, smugly.'; } },
    ],
  },
  {
    id: 'ag_vaccine', cat: 'health', minAge: 5, years: [1800, 2300], weight: (x) => (x.w.healthCrisis ? 2 : 0.4), cooldown: 6, scene: 'checkup',
    title: 'Vaccination drive',
    text: (x) => (x.year < 1900 ? 'A doctor in town is offering the new cowpox inoculation against smallpox.' : 'There is a vaccination clinic at the community centre this week.'),
    choices: [
      { label: 'Get vaccinated', tags: ['cautious'], run: (x) => { x.mods({ immunity: 8, health: 2 }); return 'A sore arm for a day and protection for years. Bargain.'; } },
      { label: 'Volunteer at the clinic', tags: ['help'], scene: 'volunteer', run: (x) => { x.mods({ immunity: 6, karma: 3, empathy: 2 }); x.train('medicine', 2); return 'You handed out lollipops to brave children and stickers to braver adults.'; } },
      { label: 'Skip it', tags: ['impulsive'], run: (x) => { if (x.w.healthCrisis && x.chance(0.3)) { x.mods({ health: -10 }); return 'You caught exactly what it was for. A miserable month in bed.'; } return 'Nothing happened. This time.'; } },
    ],
  },
  {
    id: 'ag_roboticSurgery', cat: 'health', minAge: 40, years: [2000, 2300], weight: (x) => (x.age >= 55 ? 0.6 : 0.2), once: true, scene: 'surgery',
    title: 'Robot surgeon',
    text: 'Your hip needs work, and the hospital offers a robot that operates through holes the size of a coin.',
    choices: [
      { label: 'Trust the robot', tags: ['ambitious'], run: (x) => { pay(x, 4000); x.mods({ pain: -10, fitness: 3, happiness: 3 }); return 'Home in two days. The robot did not even ask for a tip.'; } },
      { label: 'Ask for a human', tags: ['cautious'], run: (x) => { pay(x, 3000); x.mods({ pain: -6, fitness: 1 }); return 'A human surgeon with very steady hands and a terrible playlist.'; } },
      { label: 'Physiotherapy instead', tags: ['cautious'], scene: 'gym', run: (x) => { x.mods({ pain: -3, discipline: 2 }); return 'Slow, steady, and you avoided the knife for now.'; } },
    ],
  },
  {
    id: 'ag_xray', cat: 'health', minAge: 10, years: [1896, 1950], weight: 0.3, once: true, scene: 'hospital',
    title: 'See-through you',
    text: 'The hospital has a machine that photographs your bones. Everyone is very excited and nobody is wearing lead.',
    choices: [
      { label: 'Have a look inside', tags: ['impulsive'], run: (x) => { x.mods({ smarts: 1, happiness: 2 }); return 'You framed the picture of your own hand. It is your best portrait.'; } },
      { label: 'Keep your bones private', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 1 }); return 'In a few decades, you will look very smart about this.'; } },
    ],
  },
  {
    id: 'ag_botox', cat: 'adult', minAge: 30, maxAge: 75, years: [2002, 2300], weight: 0.4, cooldown: 6, scene: 'spa',
    title: 'Little tweak',
    text: 'A clinic offers to smooth the lines on your forehead "so subtle nobody will notice".',
    choices: [
      { label: 'Book it', tags: ['impulsive'], run: (x) => { if (!pay(x, 500)) return 'Your wallet frowned so hard it needed treatment.'; x.mods({ looks: 2, confidence: 2 }); return 'Everyone noticed. You now look permanently mildly surprised.'; } },
      { label: 'Embrace the lines', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 2, happiness: 2 }); return 'They are laughter lines. You earned every one.'; } },
      { label: 'Go big: a facelift', tags: ['ambitious'], when: (x) => x.age >= 45 && x.canAfford(cost(x, 12000)), scene: 'surgery', run: (x) => { pay(x, 12000); x.mods({ looks: 5, pain: 6, ego: 3 }); return 'You look ten years younger and slightly windswept.'; } },
    ],
  },
  {
    id: 'ag_hairLoss', cat: 'adult', minAge: 25, maxAge: 60, weight: (x) => (male(x) ? 0.8 : 0.2), once: true, scene: 'aging',
    title: 'Retreating hairline',
    text: 'The shower drain is collecting more of you every week.',
    choices: [
      { label: 'Shave it all off', tags: ['impulsive'], run: (x) => { x.mods({ confidence: 4, looks: 1 }); return 'Bald and bold. You look like an action hero or a very confident egg.'; } },
      { label: (x) => (x.year >= 1990 ? 'Get a transplant' : 'Buy a wig'), tags: ['ambitious'], run: (x) => { pay(x, x.year >= 1990 ? 6000 : 200); x.mods({ looks: 2, confidence: 2 }); return x.year >= 1990 ? 'Hair from the back now lives at the front. A neighbourly arrangement.' : 'A fine wig. In strong wind it develops ambitions of its own.'; } },
      { label: 'Comb-over', run: (x) => { x.mods({ looks: -1, ego: 2 }); return 'A masterpiece of engineering that fools absolutely nobody.'; } },
    ],
  },
  {
    id: 'ag_backPain', cat: 'health', minAge: 30, weight: (x) => (x.age >= 45 ? 0.9 : 0.4), cooldown: 4, scene: 'sick',
    title: 'Back goes',
    text: 'You bent down to pick up a sock and your back made a noise like a breaking branch.',
    choices: [
      { label: 'Stretch daily', tags: ['cautious'], scene: 'yoga', run: (x) => { x.train('yoga', 3); x.mods({ pain: -4, fitness: 1, discipline: 1 }); return 'You can touch your knees now. Toes are a five-year plan.'; } },
      { label: (x) => (x.year >= 1900 ? 'See a chiropractor' : 'Visit the bonesetter'), run: (x) => { pay(x, 150); x.mods({ pain: x.chance(0.6) ? -6 : 3 }); return 'Crack. Pop. Either better or a lot worse. Today, better.'; } },
      { label: 'Lie on the floor for a day', tags: ['impulsive'], run: (x) => { x.mods({ pain: -2, loneliness: 2 }); return 'You became intimately familiar with your ceiling. It needs repainting.'; } },
    ],
  },
  {
    id: 'ag_bloodPressure', cat: 'health', minAge: 40, years: [1920, 2300], weight: (x) => (x.stat('stress') >= 50 ? 0.6 : 0.3), once: true, scene: 'checkup',
    when: (x) => !hasChronic(x, 'hypertension'),
    title: 'High pressure',
    text: 'A pharmacy machine takes your blood pressure and beeps like it is calling for backup.',
    choices: [
      { label: 'Start medication', tags: ['help'], run: (x) => { diagnose(x, 'hypertension'); const c = x.c.bio.chronic.find((d) => d.id === 'hypertension'); if (c) c.managed = true; x.mods({ health: 2 }); return 'One small pill a day and a strong talking-to about salt.'; } },
      { label: 'Cut salt and stress', tags: ['cautious'], scene: 'calm', run: (x) => { x.mods({ stress: -6, health: 2, discipline: 2 }); x.c.diet = 'healthy'; return 'Food tastes like cardboard and the numbers dropped. Fair trade.'; } },
      { label: 'Blame the machine', tags: ['impulsive'], run: (x) => { x.mods({ ego: 1 }); if (x.chance(0.5)) diagnose(x, 'hypertension'); return 'Machines can be wrong. So can you.'; } },
    ],
  },
  {
    id: 'ag_sugarTest', cat: 'health', minAge: 35, years: [1925, 2300], weight: (x) => (bmiCategory(x.c) === 'obese' || x.c.diet === 'excessive' ? 0.7 : 0.15), once: true, scene: 'checkup',
    when: (x) => !hasChronic(x, 'diabetes'),
    title: 'Sugar levels',
    text: 'You are always thirsty and always tired. The doctor wants a blood sugar test.',
    choices: [
      { label: 'Take the test', tags: ['help'], run: (x) => { if (x.chance(0.6)) { diagnose(x, 'diabetes'); const c = x.c.bio.chronic.find((d) => d.id === 'diabetes'); if (c && x.year >= 1925) c.managed = true; return 'Type 2 diabetes, caught early. Insulin and a new relationship with bread.'; } x.mods({ anxiety: -3 }); return 'Borderline. A warning shot across the biscuit tin.'; } },
      { label: 'Change your diet first', tags: ['cautious'], scene: 'cooking', run: (x) => { x.c.diet = 'healthy'; x.mods({ health: 3, happiness: -1 }); return 'You discovered lentils. Lentils discovered you.'; } },
      { label: 'Avoid the doctor', tags: ['impulsive'], run: (x) => { if (x.chance(0.4)) diagnose(x, 'diabetes'); x.mods({ health: -2 }); return 'Avoidance is not a treatment plan, but it is a plan.'; } },
    ],
  },
  {
    id: 'ag_chronicFlare', cat: 'health', minAge: 18, weight: (x) => (untreated(x) ? 1.2 : 0), cooldown: 3, scene: 'sick',
    when: (x) => !!untreated(x),
    title: 'Bad flare-up',
    text: 'Your condition has flared and this week every stair feels like a mountain.',
    choices: [
      { label: 'Follow the treatment plan', tags: ['help'], scene: 'checkup', run: (x) => { pay(x, 300); const n = manageAll(x); x.mods({ health: 4, pain: -4 }); return n ? 'Pills, appointments and patience. It is under control now.' : 'Back on track.'; } },
      { label: 'Rest and pace yourself', tags: ['cautious'], run: (x) => { x.mods({ pain: -2, stress: -3, energy: 3 }); return 'You cancelled everything and let your body sulk in peace.'; } },
      { label: 'Pretend it is fine', tags: ['impulsive'], run: (x) => { x.mods({ health: -5, pain: 5 }); return 'You smiled through it at a party and paid for it for a week.'; } },
    ],
  },
  {
    id: 'ag_creakyJoints', cat: 'health', minAge: 50, weight: (x) => (x.age >= 60 ? 0.8 : 0.3), once: true, scene: 'aging',
    when: (x) => !hasChronic(x, 'arthritis'),
    title: 'Morning creaks',
    text: 'Your knees now forecast rain more accurately than the radio.',
    choices: [
      { label: 'Get it diagnosed', tags: ['help'], scene: 'checkup', run: (x) => { diagnose(x, 'arthritis'); const c = x.c.bio.chronic.find((d) => d.id === 'arthritis'); if (c) c.managed = true; x.mods({ pain: -3 }); return 'Arthritis. Anti-inflammatories and warm baths are your new best friends.'; } },
      { label: 'Gentle swimming', tags: ['cautious'], scene: 'beach', run: (x) => { x.train('swimming', 3); x.mods({ pain: -4, fitness: 2 }); return 'Floating is the only time nothing hurts. You go every morning now.'; } },
      { label: 'Ignore it', tags: ['impulsive'], run: (x) => { if (x.chance(0.6)) diagnose(x, 'arthritis'); x.mods({ pain: 4 }); return 'It did not ignore you back.'; } },
    ],
  },
  {
    id: 'ag_wheezing', cat: 'health', minAge: 6, weight: 0.3, once: true, scene: 'sick',
    when: (x) => !hasChronic(x, 'asthma'),
    title: 'Tight chest',
    text: 'After climbing one flight of stairs you are wheezing like an old accordion.',
    choices: [
      { label: 'See a specialist', tags: ['help'], when: (x) => x.year >= 1950, scene: 'checkup', run: (x) => { diagnose(x, 'asthma'); const c = x.c.bio.chronic.find((d) => d.id === 'asthma'); if (c) c.managed = true; pay(x, 200); return 'Asthma. You now carry an inhaler like a tiny emergency trumpet.'; } },
      { label: 'Move somewhere cleaner', tags: ['cautious'], scene: 'moving', run: (x) => { x.mods({ health: 3, stress: 3 }); return 'Fewer factories, more trees. You can breathe again.'; } },
      { label: 'Breathe through it', run: (x) => { if (x.chance(0.5)) diagnose(x, 'asthma'); x.mods({ anxiety: 3 }); return 'Some days are fine. Some days the air is thick as soup.'; } },
    ],
  },
  {
    id: 'ag_heartScare', cat: 'health', minAge: 45, weight: (x) => (x.stat('stress') >= 60 || bmiCategory(x.c) === 'obese' ? 0.8 : 0.3), cooldown: 8, scene: 'hospital',
    title: 'Chest pain',
    text: 'A tight, crushing feeling in your chest while carrying the shopping. Your left arm feels strange.',
    choices: [
      { label: 'Get to a hospital now', tags: ['help'], run: (x) => { pay(x, 2000); if (x.chance(0.5)) { if (diagnose(x, 'heartDisease')) { const c = x.c.bio.chronic.find((d) => d.id === 'heartDisease'); if (c && x.year >= 1960) c.managed = true; } x.remember('heartScare', 'Survived a heart scare', 45); x.chain('ag_heartRecovery', 1); x.mods({ wisdom: 3 }); return 'A minor heart attack, caught in time. You have been given a second go.'; } x.mods({ anxiety: 4 }); return 'Severe heartburn. Mortifying, but you were right to go.'; } },
      { label: 'Sit down and wait', tags: ['cautious'], run: (x) => { if (x.chance(0.4)) { diagnose(x, 'heartDisease'); x.mods({ health: -12 }); return 'It passed, but it left damage. You should have gone.'; } x.mods({ anxiety: 5 }); return 'It eased off after an hour. You are rattled.'; } },
      { label: 'Finish the errand', tags: ['impulsive'], run: (x) => { x.mods({ health: -8 }); if (x.chance(0.5)) diagnose(x, 'heartDisease'); return 'You collapsed in the car park. A stranger called an ambulance.'; } },
    ],
  },
  {
    id: 'ag_cancerScreening', cat: 'health', minAge: 45, years: [1960, 2300], weight: (x) => (x.age >= 55 ? 0.6 : 0.3), cooldown: 5, scene: 'checkup',
    title: 'Screening letter',
    text: 'A letter invites you for a routine cancer screening. You put it on the fridge and stare at it.',
    choices: [
      { label: 'Go to the appointment', tags: ['cautious'], run: (x) => { if (x.chance(0.08) && diagnose(x, 'cancer')) { const c = x.c.bio.chronic.find((d) => d.id === 'cancer'); if (c) c.managed = true; x.remember('cancerEarly', 'Cancer caught early by screening', 50); return 'They found something small and early. Treatment starts next week, and the odds are very good.'; } x.mods({ anxiety: -4 }); return 'All clear. You celebrated with cake, which feels on brand.'; } },
      { label: 'Bring a friend along', tags: ['social'], scene: 'friends', run: (x) => { x.mods({ anxiety: -6, loneliness: -3 }); return 'All clear, and you got lunch out of it.'; } },
      { label: 'Put it off', tags: ['impulsive'], run: (x) => { if (x.chance(0.05)) diagnose(x, 'cancer'); x.mods({ anxiety: 3 }); return 'The letter is still on the fridge. It judges you every morning.'; } },
    ],
  },
  {
    id: 'ag_migraine', cat: 'health', minAge: 14, weight: 0.5, cooldown: 4, scene: 'sick',
    title: 'Migraine',
    text: 'A shimmering zigzag in your vision, then a headache like a marching band in your skull.',
    choices: [
      { label: 'Dark room, cold cloth', tags: ['cautious'], run: (x) => { x.mods({ pain: -3, energy: -3 }); return 'Six hours of silence in the dark. You emerge like a vampire.'; } },
      { label: 'Find your triggers', tags: ['help'], when: (x) => x.year >= 1950, scene: 'checkup', run: (x) => { pay(x, 150); x.mods({ pain: -5, discipline: 2 }); return 'Red wine and skipped lunches. You can avoid one of those.'; } },
      { label: 'Push on through', tags: ['ambitious'], run: (x) => { x.mods({ pain: 6, stress: 4 }); return 'You threw up in a pot plant at work. Heroic, in a way.'; } },
    ],
  },
  {
    id: 'ag_kneeReplacement', cat: 'senior', minAge: 60, years: [1970, 2300], weight: (x) => (hasChronic(x, 'arthritis') ? 1 : 0.3), once: true, scene: 'surgery',
    title: 'New knee',
    text: 'Your surgeon says your knee is "bone on bone" with the cheerfulness of a man booking a holiday.',
    choices: [
      { label: 'Have the surgery', tags: ['help'], run: (x) => { if (!pay(x, 6000)) return 'The waiting list is long and the price is longer. You wait.'; x.mods({ pain: -12, fitness: 3, happiness: 4 }); return 'Titanium knee! You set off airport alarms and climb stairs like a teenager.'; } },
      { label: 'Use a cane', tags: ['cautious'], run: (x) => { x.mods({ pain: -3 }); return 'A handsome cane with a brass top. You point at things with it now.'; } },
      { label: 'Ask for a second opinion', tags: ['cautious'], scene: 'checkup', run: (x) => { pay(x, 200); x.mods({ pain: -2, wisdom: 1 }); return 'Physio first, says the second surgeon. You buy a year.'; } },
    ],
  },
  {
    id: 'ag_kitchenCut', cat: 'health', minAge: 16, weight: 0.5, cooldown: 5, scene: 'cooking',
    title: 'Knife slip',
    text: 'You were showing off your chopping skills and now there is a lot of red on the cutting board.',
    choices: [
      { label: 'Get stitches', tags: ['help'], scene: 'hospital', run: (x) => { pay(x, 300); x.train('cooking', 1); return 'Seven stitches and a nurse who called you "chef" sarcastically.'; } },
      { label: 'Butterfly bandage', tags: ['cautious'], run: (x) => { x.mods({ pain: 3 }); return 'Taped, wrapped and only slightly wonky. You will have a cool scar story.'; } },
      { label: 'Keep cooking', tags: ['impulsive'], run: (x) => { x.mods({ pain: 4, ego: 2 }); x.train('cooking', 2); return 'Dinner was excellent. Nobody asked about the "extra seasoning".'; } },
    ],
  },
  {
    id: 'ag_flu', cat: 'health', minAge: 10, weight: (x) => (x.w.healthCrisis ? 1.5 : 0.7), cooldown: 3, scene: 'sick',
    title: 'Proper flu',
    text: 'Not a cold. The real thing. Every bone aches and you are hot and cold at once.',
    choices: [
      { label: 'Bed and broth', tags: ['cautious'], run: (x) => { x.mods({ health: -3, energy: -5 }); return 'A week of fever dreams about talking furniture. You lived.'; } },
      { label: 'Have someone check on you', tags: ['help'], run: (x) => { const r = friendOf(x) ?? x.rels('spouse', 'partner', 'child', 'parent')[0]; x.mods({ health: -2, loneliness: -4 }); if (r) { x.relMod(r.npcId, 4, 4); return `${x.first(r.npcId)} brought soup, tissues and a terrible magazine. You love them.`; } return 'A neighbour left soup on the step. Small kindnesses.'; } },
      { label: 'Go to work anyway', tags: ['ambitious'], when: (x) => x.employed, scene: 'office', run: (x) => { x.mods({ health: -7, popularity: -2 }); return 'You infected the whole department. HR sent a memo with your name in it.'; } },
    ],
  },
  {
    id: 'ag_smokersCough', cat: 'health', minAge: 35, years: [1880, 2300], weight: (x) => (x.hasMemory('smoker') || x.flag('smoker') ? 1.2 : 0.25), cooldown: 6, scene: 'sick',
    title: 'The cough',
    text: 'A cough has settled into your chest and refuses to pay rent.',
    choices: [
      { label: 'Quit smoking', tags: ['help'], run: (x) => { x.setFlag('smoker', false); x.mods({ health: 4, stress: 5, willpower: 3 }); return 'Hardest thing you have ever done. Food tastes of things again.'; } },
      { label: 'Get your lungs checked', tags: ['cautious'], when: (x) => x.year >= 1920, scene: 'checkup', run: (x) => { pay(x, 300); if (x.age >= 50 && x.chance(0.3)) { diagnose(x, 'copd'); return 'Early COPD. The doctor is calm. You are not.'; } return 'Clear, for now. A very clear warning.'; } },
      { label: 'Light another one', tags: ['impulsive'], run: (x) => { x.mods({ health: -4, stress: -2 }); return 'You coughed through the whole cigarette. Peak irony.'; } },
    ],
  },
  {
    id: 'ag_sunburn', cat: 'health', minAge: 10, weight: 0.4, cooldown: 4, scene: 'beach',
    title: 'Lobster mode',
    text: 'You fell asleep on the beach and woke up glowing like a stop sign.',
    choices: [
      { label: 'Aloe and shade', tags: ['cautious'], run: (x) => { x.mods({ pain: 3 }); return 'You peeled like a snake for a week but learned nothing.'; } },
      { label: 'Get the mole checked', tags: ['help'], when: (x) => x.year >= 1970 && x.age >= 30, scene: 'checkup', run: (x) => { pay(x, 150); x.mods({ anxiety: -2, wisdom: 1 }); return 'Benign. You now own a hat the size of a satellite dish.'; } },
      { label: 'Go back out', tags: ['impulsive'], run: (x) => { x.mods({ pain: 6, health: -2, happiness: 2 }); return 'Your shoulders are now officially a fire hazard.'; } },
    ],
  },
  {
    id: 'ag_gymPlateau', cat: 'health', minAge: 18, maxAge: 75, years: [1950, 2300], weight: (x) => (x.stat('fitness') >= 50 ? 0.7 : 0.2), cooldown: 4, scene: 'gym',
    title: 'Stuck at the gym',
    text: 'Same weights, same reps, same reflection. Your progress has flatlined.',
    choices: [
      { label: 'Hire a trainer', tags: ['ambitious'], run: (x) => { if (!pay(x, 800)) return 'Trainers cost more than you thought. You watched videos instead.'; x.train('strengthTraining', 5); x.mods({ fitness: 4, discipline: 2 }); return 'A cheerful sadist named Kai fixed your form and broke your spirit. Gains!'; } },
      { label: 'Try a new sport', scene: 'sports', run: (x) => { x.train(x.pick(['climbing', 'swimming', 'tennis', 'cycling', 'boxing']), 4); x.mods({ fitness: 3, happiness: 3 }); return 'Something new, and you are terrible at it. Delightful.'; } },
      { label: 'Rest week', tags: ['cautious'], run: (x) => { x.mods({ energy: 5, pain: -3 }); return 'You came back stronger. Rest is training too, who knew.'; } },
    ],
  },
  {
    id: 'ag_yogaClass', cat: 'health', minAge: 18, years: [1960, 2300], weight: 0.5, cooldown: 5, scene: 'yoga',
    title: 'First yoga class',
    text: 'The instructor says "find your breath". You have only just found the right room.',
    choices: [
      { label: 'Commit to it', tags: ['cautious'], run: (x) => { x.train('yoga', 5); x.mods({ stress: -6, fitness: 2, pain: -2 }); return 'Three months in, you can touch your toes and you are insufferable about it.'; } },
      { label: 'Fall asleep in savasana', run: (x) => { x.mods({ stress: -4, energy: 4 }); return 'Best nap of your life. You snored. Someone giggled.'; } },
      { label: 'Compete with the person next to you', tags: ['ambitious'], run: (x) => { x.mods({ pain: 4, ego: 2 }); return 'You pulled a muscle trying to out-stretch a seventy-year-old. She won.'; } },
    ],
  },
  {
    id: 'ag_learnToSwim', cat: 'health', minAge: 25, weight: (x) => (x.skill('swimming') < 5 ? 0.4 : 0), once: true, scene: 'beach',
    title: 'Adult swim',
    text: 'You never learned to swim, and the beginner class is mostly six-year-olds.',
    choices: [
      { label: 'Sign up anyway', tags: ['ambitious'], run: (x) => { x.train('swimming', 8); x.mods({ confidence: 4, fitness: 2 }); return 'You graduated alongside a girl called Poppy. She got a better badge.'; } },
      { label: 'Private lessons', tags: ['cautious'], run: (x) => { pay(x, 400); x.train('swimming', 6); x.mods({ confidence: 2 }); return 'Expensive dignity. Worth it.'; } },
      { label: 'Stay on dry land', run: (x) => { x.mods({ anxiety: 1 }); return 'You remain an excellent sitter-by-the-pool.'; } },
    ],
  },
  {
    id: 'ag_summitHike', cat: 'health', minAge: 18, maxAge: 80, weight: (x) => (x.stat('fitness') >= 45 ? 0.5 : 0.15), cooldown: 6, scene: 'hiking',
    title: 'The big climb',
    text: 'A mountain you have stared at for years. Today, the weather is perfect.',
    choices: [
      { label: 'Go for the summit', tags: ['ambitious'], run: (x) => { x.train('mountaineering', 4); if (check(x, x.stat('fitness'), 55)) { x.mods({ happiness: 7, confidence: 5 }); x.remember('summit', 'Reached a mountain summit', 30); return 'At the top, the whole world fell quiet. You cried a bit. Wind, obviously.'; } x.mods({ pain: 5 }); return 'You turned back two hundred metres short. The mountain will wait.'; } },
      { label: 'Take the scenic route', tags: ['cautious'], run: (x) => { x.mods({ stress: -6, happiness: 4, fitness: 1 }); return 'Wildflowers, a picnic, a nap in the sun. No summit, no regrets.'; } },
      { label: 'Bring friends', tags: ['social'], scene: 'friends', run: (x) => { x.mods({ loneliness: -5, happiness: 4, fitness: 1 }); return 'Mostly you just complained together, which is bonding.'; } },
    ],
  },
  {
    id: 'ag_tattooRegret', cat: 'adult', minAge: 28, years: [1990, 2300], weight: 0.25, once: true, scene: 'checkup',
    title: 'Old tattoo',
    text: 'The tattoo you got at nineteen is a name, and you can no longer remember whose.',
    choices: [
      { label: 'Laser it off', tags: ['cautious'], run: (x) => { pay(x, 1500); x.mods({ pain: 6, happiness: 2 }); return 'Eight sessions of being snapped with a hot rubber band. Gone.'; } },
      { label: 'Turn it into a dragon', tags: ['impulsive'], run: (x) => { pay(x, 400); x.mods({ looks: 1, happiness: 3 }); return 'The name is now a dragon\'s belly. The dragon is great.'; } },
      { label: 'Keep it', run: (x) => { x.mods({ wisdom: 2 }); return 'It is a record of who you were. That person had awful taste and a big heart.'; } },
    ],
  },
  {
    id: 'ag_cosmeticSurgery', cat: 'adult', minAge: 25, maxAge: 70, years: [1950, 2300], weight: (x) => (x.stat('confidence') < 40 ? 0.4 : 0.15), cooldown: 10, scene: 'surgery',
    title: 'Under the knife?',
    text: 'You have stared at the same feature in the mirror for years. A surgeon says it is a "simple procedure".',
    choices: [
      { label: 'Do it', tags: ['impulsive'], run: (x) => { if (!pay(x, 8000)) return 'You could not afford it. Maybe that is a sign.'; if (x.chance(0.8)) { x.mods({ looks: 5, confidence: 4, pain: 6 }); return 'It turned out lovely. You smile at mirrors now.'; } x.mods({ looks: -2, happiness: -6 }); return 'It did not turn out how you pictured. A hard lesson about expectations.'; } },
      { label: 'Talk to a therapist first', tags: ['help'], when: (x) => therapyAvailable(x.year), scene: 'calm', run: (x) => { pay(x, 200); x.mods({ confidence: 4, anxiety: -3 }); return 'You worked out it was never really about your nose.'; } },
      { label: 'Learn to like it', tags: ['cautious'], run: (x) => { x.mods({ confidence: 2, wisdom: 2 }); return 'Your face is a family heirloom. Odd, but yours.'; } },
    ],
  },
  {
    id: 'ag_kidneyStone', cat: 'health', minAge: 30, weight: 0.3, once: true, scene: 'hospital',
    title: 'Kidney stone',
    text: 'A pain so sharp you briefly saw your ancestors. It is a stone the size of a grain of rice.',
    choices: [
      { label: 'Go to hospital', tags: ['help'], run: (x) => { pay(x, 1500); x.mods({ pain: 4 }); return 'Pain relief, fluids and the strange pride of keeping the stone in a jar.'; } },
      { label: 'Drink all the water', tags: ['cautious'], run: (x) => { x.mods({ pain: 10, health: 1 }); return 'It passed. So did a day you will never get back.'; } },
      { label: 'Write a dramatic will', tags: ['impulsive'], run: (x) => { x.train('writing', 1); x.mods({ pain: 8 }); return 'It turned out to be survivable, but the will was beautiful.'; } },
    ],
  },
  {
    id: 'ag_appendix', cat: 'health', minAge: 8, maxAge: 70, weight: 0.2, once: true, scene: 'surgery',
    title: 'Appendix',
    text: 'A pain low on your right side has you doubled over. The doctor presses and you nearly hit the ceiling.',
    choices: [
      { label: 'Emergency surgery', tags: ['help'], run: (x) => { pay(x, 3000); if (x.year < 1890 && x.chance(0.5)) { x.mods({ health: -20 }); return 'Surgery in this age is a gamble. You survived it, just.'; } x.mods({ health: -4 }); return 'Out it came. You have a scar and a story.'; } },
      { label: 'Wait for it to settle', tags: ['cautious'], run: (x) => { x.mods({ health: -15, pain: 10 }); return 'It burst. You spent a frightening month recovering.'; } },
    ],
  },
  {
    id: 'ag_tuberculosis', cat: 'health', minAge: 15, years: [1700, 1955], weight: (x) => (x.c.money < cost(x, 2000) ? 0.4 : 0.15), once: true, scene: 'sick',
    when: (x) => !hasChronic(x, 'tuberculosis'),
    title: 'The consumption',
    text: 'A cough that will not quit, blood on the handkerchief, and a doctor who goes very quiet.',
    choices: [
      { label: 'Go to a sanatorium', tags: ['help'], scene: 'nursingHome', run: (x) => { diagnose(x, 'tuberculosis'); pay(x, 1500); const c = x.c.bio.chronic.find((d) => d.id === 'tuberculosis'); if (c) c.managed = true; x.mods({ loneliness: 8 }); return 'A year on a mountain balcony wrapped in blankets. Slowly, you mend.'; } },
      { label: 'Keep working', tags: ['ambitious'], run: (x) => { diagnose(x, 'tuberculosis'); x.mods({ health: -10 }); return 'You could not afford to stop. Your body keeps the score.'; } },
      { label: 'Pray for recovery', tags: ['cautious'], scene: 'holy', run: (x) => { x.mods({ faith: 4 }); if (x.chance(0.5)) { x.mods({ health: 2 }); return 'It was only a bad bronchitis. You lit a candle in gratitude.'; } diagnose(x, 'tuberculosis'); return 'Prayer brought comfort if not a cure.'; } },
    ],
  },
  {
    id: 'ag_takeTheWaters', cat: 'health', minAge: 30, years: [1700, 1935], weight: (x) => (x.c.money > cost(x, 5000) ? 0.5 : 0), cooldown: 8, scene: 'spa',
    title: 'Taking the waters',
    text: 'Your physician prescribes a season at a fashionable spa town to drink foul-smelling mineral water.',
    choices: [
      { label: 'Go for the season', tags: ['social'], run: (x) => { pay(x, 1500); x.mods({ health: 3, stress: -6, popularity: 2 }); return 'The water tasted of eggs. The gossip was delicious.'; } },
      { label: 'Bathe, but skip the drinking', tags: ['cautious'], run: (x) => { pay(x, 800); x.mods({ stress: -4, pain: -3 }); return 'Hot springs fix everything except your opinion of the water.'; } },
      { label: 'Stay home', run: (x) => { x.mods({ wisdom: 1 }); return 'You saved a fortune and drank tea instead.'; } },
    ],
  },
  {
    id: 'ag_ether', cat: 'health', minAge: 15, years: [1846, 1900], weight: 0.25, once: true, scene: 'surgery',
    title: 'The ether dome',
    text: 'You need an operation, and the surgeon offers a new marvel: ether, to sleep through the cutting.',
    choices: [
      { label: 'Breathe the ether', tags: ['cautious'], run: (x) => { x.mods({ health: -3, smarts: 1 }); return 'You woke up with no memory of the pain. Truly a modern miracle.'; } },
      { label: 'Bite a leather strap', tags: ['impulsive'], run: (x) => { x.mods({ pain: 15, resilience: 4, trauma: 3 }); return 'The old way. You will tell this story with a haunted look for decades.'; } },
    ],
  },
  {
    id: 'ag_bionicLimb', cat: 'health', minAge: 18, years: [2060, 2300], weight: (x) => (x.c.bio.injuries.length ? 1 : 0), once: true, scene: 'robots',
    title: 'Upgrade offer',
    text: 'A clinic offers to replace your old injury with a neural-linked prosthetic that is, frankly, better than the original.',
    choices: [
      { label: 'Get the upgrade', tags: ['ambitious'], run: (x) => { if (!pay(x, 20000)) return 'Your insurance said no, very politely.'; const inj = x.c.bio.injuries.pop(); if (inj) { const caps = x.c.bio.caps as Record<string, number>; for (const k of Object.keys(caps)) caps[k] = Math.min(100, caps[k] + 20); } x.mods({ fitness: 5, dexterity: 5, happiness: 5 }); return 'Your new limb has a warranty and a firmware update every Tuesday.'; } },
      { label: 'Keep your body human', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 2, faith: 1 }); return 'Scars and all, it is yours.'; } },
    ],
  },
  {
    id: 'ag_geneTherapy', cat: 'health', minAge: 18, years: [2040, 2300], weight: (x) => (x.c.bio.chronic.length ? 0.7 : 0), cooldown: 8, scene: 'lab',
    title: 'Gene therapy',
    text: 'A trial offers to rewrite the faulty instructions behind your condition with one injection.',
    choices: [
      { label: 'Join the trial', tags: ['ambitious'], run: (x) => { const c = x.c.bio.chronic[0]; if (x.chance(0.7) && c) { x.c.bio.chronic.splice(0, 1); x.mods({ happiness: 8, health: 6 }); return 'It worked. Your condition is simply gone. You keep checking.'; } x.mods({ health: -3 }); return 'No effect, some side effects. Science is a process.'; } },
      { label: 'Wait for approval', tags: ['cautious'], run: (x) => { manageAll(x); return 'Your current treatment keeps things steady while the scientists finish arguing.'; } },
    ],
  },
  {
    id: 'ag_stepCounter', cat: 'health', minAge: 18, years: [2012, 2300], weight: 0.5, cooldown: 6, scene: 'gadget',
    title: '10,000 steps',
    text: 'Your watch buzzes: "Time to stand up!" It has been saying this since breakfast.',
    choices: [
      { label: 'Close all the rings', tags: ['ambitious'], scene: 'sports', run: (x) => { x.mods({ fitness: 3, discipline: 2 }); x.train('running', 2); return 'You walked laps of your kitchen at 11:58 p.m. to hit the goal. Victory.'; } },
      { label: 'Turn off notifications', tags: ['cautious'], run: (x) => { x.mods({ stress: -3 }); return 'Peace. Sweet, sedentary peace.'; } },
      { label: 'Strap it to the dog', tags: ['impulsive'], when: (x) => x.pets('dog').length > 0, scene: 'pet', run: (x) => { x.mods({ happiness: 4 }); return 'Your dog did 40,000 steps. You are now top of the office leaderboard.'; } },
    ],
  },
  {
    id: 'ag_hypochondria', cat: 'health', minAge: 25, weight: (x) => (x.stat('anxiety') >= 50 ? 0.8 : 0.2), cooldown: 4, scene: 'checkup',
    title: 'Is it serious?',
    text: 'A small lump, a twitchy eye and a headache. You are certain it is all connected and fatal.',
    choices: [
      { label: 'See the doctor once', tags: ['cautious'], run: (x) => { pay(x, 100); x.mods({ anxiety: -6 }); return 'A cyst, a lack of sleep and too much coffee. All fixable.'; } },
      { label: 'Research all night', tags: ['impulsive'], scene: 'internet', when: (x) => x.year >= 1998, run: (x) => { x.mods({ anxiety: 8, energy: -4 }); return 'By 4 a.m. you had diagnosed yourself with a disease that only affects Victorian sailors.'; } },
      { label: 'Talk about the worry', tags: ['help'], scene: 'calm', run: (x) => { x.mods({ anxiety: -8, wisdom: 1 }); if (therapyAvailable(x.year)) x.c.mental.therapy = true; return 'Turns out the fear needed treating more than the twitch.'; } },
    ],
  },
  {
    id: 'ag_concussion', cat: 'health', minAge: 12, maxAge: 80, weight: 0.25, cooldown: 8, scene: 'hospital',
    title: 'Knock on the head',
    text: 'An open cupboard door and your head met at speed. You are seeing two of everything.',
    choices: [
      { label: 'Get checked out', tags: ['help'], run: (x) => { pay(x, 500); x.mods({ health: -2 }); return 'Mild concussion. No screens, no driving, lots of dull rest.'; } },
      { label: 'Lie down a bit', tags: ['cautious'], run: (x) => { x.mods({ health: -4, smarts: -1 }); return 'You were foggy for a week but it lifted.'; } },
      { label: 'Laugh it off', tags: ['impulsive'], run: (x) => { x.mods({ health: -5 }); if (x.chance(0.1)) return `It was worse than it looked. ${injure(x, false, 'brainInjury')}`; return 'You laughed, then sat down very suddenly.'; } },
    ],
  },
  {
    id: 'ag_feverDream', cat: 'health', minAge: 5, maxAge: 95, weight: 0.3, cooldown: 6, scene: 'sick',
    title: 'Fever dream',
    text: 'A fever spiked overnight and your wallpaper has started making suggestions.',
    choices: [
      { label: 'Call for help', tags: ['help'], run: (x) => { pay(x, 100); x.mods({ health: -2 }); return 'Cool cloths, medicine and someone holding your hand until it broke.'; } },
      { label: 'Write down the visions', tags: ['impulsive'], scene: 'reading', run: (x) => { x.mods({ creativity: 4, health: -4 }); x.train('writing', 2); return 'Most of it was nonsense. One line became the best thing you ever wrote.'; } },
      { label: 'Sweat it out', tags: ['cautious'], run: (x) => { x.mods({ health: -5 }); return 'You soaked three sets of sheets. The fever broke at dawn.'; } },
    ],
  },
  {
    id: 'ag_eyeTest', cat: 'health', minAge: 40, years: [1300, 2300], weight: (x) => (x.age >= 45 ? 0.8 : 0.3), once: true, scene: 'aging',
    title: 'Arms too short',
    text: 'You now hold menus at arm\'s length. Soon you will need longer arms.',
    choices: [
      { label: 'Get reading glasses', tags: ['cautious'], scene: 'reading', run: (x) => { pay(x, 50); x.mods({ smarts: 1, happiness: 2 }); return 'Small print is back. So is the habit of pushing glasses onto your head and losing them.'; } },
      { label: 'Borrow a friend\'s', tags: ['social'], run: (x) => { x.mods({ pain: 2, happiness: 1 }); return 'They were the wrong strength. Everything looks like it is underwater, but closer.'; } },
      { label: 'Refuse on principle', tags: ['impulsive'], run: (x) => { x.mods({ ego: 2 }); return 'You ordered the wrong dish three times this month out of pride.'; } },
    ],
  },
  // ================================================================== MIND
  {
    id: 'ag_stressPileUp', cat: 'mental', minAge: 18, weight: (x) => (x.stat('stress') >= 55 ? 1.5 : 0.4), cooldown: 3, scene: 'office',
    title: 'Too much at once',
    text: 'Bills, deadlines, family and a leaking roof all arrived in the same week, like they planned it.',
    choices: [
      { label: 'Make a list, do one thing', tags: ['cautious'], scene: 'calm', run: (x) => { x.mods({ stress: -8, discipline: 2 }); return 'You crossed off one item. Then another. The mountain became stairs.'; } },
      { label: 'Ask for help', tags: ['help'], run: (x) => { const r = friendOf(x) ?? x.rels('spouse', 'partner', 'sibling', 'parent')[0]; x.mods({ stress: -10, loneliness: -4 }); if (r) { x.relMod(r.npcId, 3, 4); return `${x.first(r.npcId)} took half the list without a word. You owe them dinner.`; } return 'A neighbour fixed the roof. People are kinder than the news suggests.'; } },
      { label: 'Do it all tonight', tags: ['ambitious'], run: (x) => { x.mods({ stress: 4, energy: -8, discipline: 2 }); return 'You did it all by 4 a.m. and then forgot your own birthday.'; } },
    ],
  },
  {
    id: 'ag_burnout', cat: 'mental', minAge: 22, maxAge: 75, weight: (x) => (x.employed && x.stat('stress') >= 65 ? 1.5 : 0), cooldown: 5, scene: 'office',
    title: 'Running on empty',
    text: 'You stared at the same email for forty minutes. You do not care about anything, and that scares you.',
    choices: [
      { label: 'Take proper time off', tags: ['help'], scene: 'calm', run: (x) => { if (hasCondition(x, 'burnout')) cure(x, 'burnout'); x.mods({ stress: -15, energy: 10, professionalRep: -1 }); return 'Two weeks of nothing. The world did not end. You came back human.'; } },
      { label: 'Talk to your manager', tags: ['cautious'], run: (x) => { x.mods({ stress: -8, confidence: 2 }); return 'They had no idea. Your workload is now actually reasonable.'; } },
      { label: 'Push through', tags: ['ambitious'], run: (x) => { onset(x, 'burnout'); x.mods({ stress: 6, health: -3 }); return 'Your body eventually made the decision for you. Please rest.'; } },
    ],
  },
  {
    id: 'ag_anxiousDays', cat: 'mental', minAge: 16, weight: (x) => (x.stat('anxiety') >= 55 ? 1.3 : 0.3), cooldown: 3, scene: 'lonely',
    title: 'Knot in the stomach',
    text: 'A constant hum of worry has moved in. Nothing is wrong, and yet everything feels wrong.',
    choices: [
      { label: (x) => (therapyAvailable(x.year) ? 'Book a therapist' : 'Confide in a wise elder'), tags: ['help'], scene: 'calm', run: (x) => { if (therapyAvailable(x.year)) { pay(x, 150); x.c.mental.therapy = true; } x.mods({ anxiety: -10, wisdom: 1 }); return 'Naming the worry shrank it. You have tools now.'; } },
      { label: 'Breathing exercises', tags: ['cautious'], scene: 'calm', run: (x) => { x.train('meditation', 3); x.mods({ anxiety: -5 }); return 'Four in, hold, four out. Your shoulders came down an inch.'; } },
      { label: 'Keep busy', run: (x) => { x.mods({ anxiety: -2, energy: -4 }); return 'You cleaned the oven at midnight. It looks amazing. The worry is still there.'; } },
    ],
  },
  {
    id: 'ag_lowMood', cat: 'mental', minAge: 16, weight: (x) => (x.stat('depression') >= 45 && x.stat('depression') < 70 ? 1.4 : 0), cooldown: 3, scene: 'lonely',
    title: 'Grey weeks',
    text: 'Food tastes of nothing, sleep does not rest you, and the things you loved feel far away.',
    choices: [
      { label: 'Tell someone you trust', tags: ['help'], run: (x) => { const r = x.rels('bestFriend', 'spouse', 'partner', 'sibling', 'parent', 'friend').sort((a, b) => b.affinity - a.affinity)[0]; x.mods({ depression: -10, loneliness: -8 }); if (r) { x.relMod(r.npcId, 6, 8); return `${x.first(r.npcId)} listened, then held your hand all the way to getting proper help.`; } return 'You said it out loud to someone kind. It was the first step.'; } },
      { label: 'See a doctor', tags: ['help'], when: (x) => x.year >= 1900, scene: 'checkup', run: (x) => { if (therapyAvailable(x.year)) x.c.mental.therapy = true; if (medicationAvailable(x.year)) x.c.mental.medication = true; x.mods({ depression: -12 }); return 'Depression is an illness, and illnesses have treatments. Things are starting to lift.'; } },
      { label: 'Small daily walks', tags: ['cautious'], scene: 'hiking', run: (x) => { x.mods({ depression: -5, fitness: 1 }); return 'Ten minutes of daylight a day. Not a cure, but a crack of light.'; } },
    ],
  },
  {
    id: 'ag_firstTherapy', cat: 'mental', minAge: 18, weight: (x) => (therapyAvailable(x.year) && !x.c.mental.therapy && (x.stat('anxiety') >= 40 || x.stat('depression') >= 35 || x.stat('trauma') >= 30) ? 0.9 : 0), once: true, scene: 'calm',
    title: 'The first session',
    text: 'A soft chair, a box of tissues, and a stranger asking "So, what brings you here?"',
    choices: [
      { label: 'Be completely honest', tags: ['help'], run: (x) => { pay(x, 150); x.c.mental.therapy = true; x.mods({ anxiety: -6, depression: -6, trauma: -4, wisdom: 2 }); return 'You cried for fifty minutes and felt lighter than you had in years.'; } },
      { label: 'Test the waters', tags: ['cautious'], run: (x) => { pay(x, 150); x.c.mental.therapy = true; x.mods({ anxiety: -3 }); return 'You talked about your commute for an hour. It is a start. It counts.'; } },
      { label: 'Make jokes the whole time', run: (x) => { pay(x, 150); x.train('humor', 2); x.mods({ anxiety: -1 }); return '"Interesting that you deflect with humour," she said. Ouch. Fair.'; } },
    ],
  },
  {
    id: 'ag_therapyBreakthrough', cat: 'mental', minAge: 18, weight: (x) => (x.c.mental.therapy ? 0.8 : 0), cooldown: 5, scene: 'calm',
    title: 'Breakthrough',
    text: 'Mid-session, your therapist connects two things you had never connected. The room goes quiet.',
    choices: [
      { label: 'Sit with it', tags: ['cautious'], run: (x) => { x.mods({ trauma: -8, wisdom: 4, anxiety: -4 }); return 'An old knot loosened. You walked home in a kind of daze.'; } },
      { label: 'Call your family about it', tags: ['social'], scene: 'family', run: (x) => { const p = x.rels('parent', 'sibling')[0]; x.mods({ trauma: -5, empathy: 3 }); if (p) { x.relMod(p.npcId, 5, 5); return `A long, careful call with ${x.first(p.npcId)}. Some old things got said, kindly.`; } return 'There was nobody left to call, so you wrote a letter and kept it.'; } },
      { label: 'Change the subject', run: (x) => { x.mods({ anxiety: 2 }); return 'Not today. Your therapist nodded. It will keep.'; } },
    ],
  },
  {
    id: 'ag_medicationTalk', cat: 'mental', minAge: 18, weight: (x) => (medicationAvailable(x.year) && !x.c.mental.medication && x.stat('depression') >= 40 ? 0.8 : 0), cooldown: 5, scene: 'checkup',
    title: 'Medication?',
    text: 'Your doctor suggests an antidepressant. You worry it will change who you are.',
    choices: [
      { label: 'Try it', tags: ['help'], run: (x) => { x.c.mental.medication = true; x.mods({ depression: -10, energy: -2 }); return 'A few rocky weeks, then the colour slowly came back. You are still you.'; } },
      { label: 'Try therapy first', tags: ['cautious'], when: (x) => therapyAvailable(x.year), scene: 'calm', run: (x) => { x.c.mental.therapy = true; x.mods({ depression: -6 }); return 'Talking first, pills if needed. Your doctor thinks that is a fine plan.'; } },
      { label: 'Ask lots of questions', tags: ['cautious'], run: (x) => { x.mods({ anxiety: -3, smarts: 1 }); return 'Side effects, timelines, alternatives. Feeling informed helped on its own.'; } },
    ],
  },
  {
    id: 'ag_griefWaves', cat: 'mental', minAge: 12, weight: (x) => (hasCondition(x, 'grief') || x.hasMemory('loss') ? 1.2 : 0.1), cooldown: 3, scene: 'graveVisit',
    title: 'Grief, again',
    text: 'A song in a shop, a smell, a handwriting on an old envelope, and the loss is new again.',
    choices: [
      { label: 'Let yourself cry', tags: ['cautious'], run: (x) => { x.mods({ depression: -3, trauma: -3, empathy: 2 }); return 'You sat in the car and let it come. Grief is love with nowhere to go.'; } },
      { label: 'Join a grief group', tags: ['help'], scene: 'rehab', run: (x) => { x.c.mental.supportGroup = true; if (hasCondition(x, 'grief')) cure(x, 'grief'); x.mods({ loneliness: -8, depression: -6 }); return 'A circle of strangers who understood immediately. You laughed for the first time in months.'; } },
      { label: 'Visit their grave', tags: ['social'], run: (x) => { x.mods({ depression: -4, faith: 1 }); return 'You told them all the news. The wind seemed to listen.'; } },
    ],
  },
  {
    id: 'ag_lonelyEvening', cat: 'mental', minAge: 18, weight: (x) => (x.stat('loneliness') >= 50 ? 1.4 : 0.3), cooldown: 3, scene: 'lonely',
    title: 'Quiet house',
    text: 'Another evening where the only voice you hear is the radio.',
    choices: [
      { label: 'Call an old friend', tags: ['social'], scene: 'friends', run: (x) => { const r = friendOf(x); x.mods({ loneliness: -8, happiness: 3 }); if (r) { x.relMod(r.npcId, 5); return `${x.first(r.npcId)} picked up on the first ring. "I was just thinking about you!"`; } return 'You found an old number. They remembered you fondly.'; } },
      { label: 'Join a club', tags: ['help'], run: (x) => { x.mods({ loneliness: -10, popularity: 2 }); return `You joined a ${x.pick(['choir', 'chess club', 'book club', 'walking group', 'pottery class'])}. You are now somebody\'s Thursday.`; } },
      { label: 'Get a pet', tags: ['cautious'], when: (x) => x.pets().length === 0, scene: 'pet', run: (x) => { x.mods({ loneliness: -8, happiness: 4 }); return 'You did not adopt one yet, but you spent the evening looking at shelter photos and feel lighter.'; } },
    ],
  },
  {
    id: 'ag_purpose', cat: 'mental', minAge: 25, weight: (x) => (x.stat('happiness') < 50 ? 0.8 : 0.4), cooldown: 6, scene: 'calm',
    title: 'What is it for?',
    text: 'Washing up after dinner, you are suddenly asking what any of it is for.',
    choices: [
      { label: 'Volunteer somewhere', tags: ['help'], scene: 'volunteer', run: (x) => { x.mods({ happiness: 5, karma: 4, empathy: 3 }); return 'Being useful to strangers filled a hole you did not know you had.'; } },
      { label: 'Start something creative', tags: ['ambitious'], scene: 'painting', run: (x) => { x.mods({ creativity: 5, happiness: 3 }); x.train(x.pick(['painting', 'writing', 'music', 'poetry']), 4); return 'Something that did not exist before now does. That is something.'; } },
      { label: 'Read philosophy', tags: ['cautious'], scene: 'reading', run: (x) => { x.train('philosophy', 4); x.mods({ wisdom: 4 }); return 'The Stoics said much of it is out of your hands. Oddly relieving.'; } },
      { label: (x) => (x.year < 1800 ? 'Ask the priest' : 'Try a place of worship'), scene: 'holy', run: (x) => { x.mods({ faith: 5, loneliness: -3 }); return 'Whether or not the answer was there, the community was.'; } },
    ],
  },
  {
    id: 'ag_mindfulness', cat: 'mental', minAge: 16, weight: 0.5, cooldown: 5, scene: 'calm',
    title: 'Sit still',
    text: (x) => (x.year >= 2010 ? 'A meditation app promises inner peace in ten minutes a day.' : 'A traveller teaches you to sit quietly and watch your breath.'),
    choices: [
      { label: 'Practise daily', tags: ['cautious'], run: (x) => { x.train('meditation', 6); x.mods({ stress: -7, anxiety: -5, willpower: 2 }); return 'You noticed thoughts without chasing them. Mostly. Some days.'; } },
      { label: 'Go on a silent retreat', tags: ['ambitious'], scene: 'yoga', run: (x) => { pay(x, 600); x.train('meditation', 10); x.mods({ stress: -12, wisdom: 3 }); return 'Seven days without speaking. On day three you laughed at a leaf for an hour.'; } },
      { label: 'Fall asleep', run: (x) => { x.mods({ energy: 5 }); return 'You meditated directly into a nap. Honestly, still a win.'; } },
    ],
  },
  {
    id: 'ag_spiderPhobia', cat: 'mental', minAge: 12, weight: 0.4, cooldown: 6, scene: 'house',
    title: 'Bathtub intruder',
    text: 'A spider the size of a saucer is sitting in the bath, looking at you like it pays rent.',
    choices: [
      { label: 'Cup and card', tags: ['cautious'], run: (x) => { x.mods({ confidence: 2, karma: 1 }); return 'You carried it outside at arm\'s length, whimpering softly. It lives.'; } },
      { label: 'Call for backup', tags: ['social'], run: (x) => { x.mods({ anxiety: 2 }); return 'Someone braver dealt with it. You hid behind a door like a hero.'; } },
      { label: 'Try exposure therapy', tags: ['help'], when: (x) => x.year >= 1960, scene: 'calm', run: (x) => { x.mods({ anxiety: -4, resilience: 3 }); return 'Six sessions later you held a tarantula named Doris. She was lovely.'; } },
    ],
  },
  {
    id: 'ag_flyingFear', cat: 'mental', minAge: 18, years: [1930, 2300], weight: 0.4, cooldown: 6, scene: 'travel',
    title: 'Fear of flying',
    text: 'The plane hits turbulence and you are gripping the armrest and a stranger\'s hand.',
    choices: [
      { label: 'Breathe and count', tags: ['cautious'], scene: 'calm', run: (x) => { x.mods({ anxiety: -2, resilience: 2 }); return 'You counted to 4,000. The plane landed. You applauded.'; } },
      { label: 'Chat to the stranger', tags: ['social'], run: (x) => { x.mods({ anxiety: -4, loneliness: -3 }); return 'She was a retired pilot. She explained every bump. You are almost cured.'; } },
      { label: 'Take a fear-of-flying course', tags: ['help'], run: (x) => { pay(x, 300); x.mods({ anxiety: -6, confidence: 3 }); return 'You learned how wings work. Knowledge beat fear, narrowly.'; } },
    ],
  },
  {
    id: 'ag_heightsFear', cat: 'mental', minAge: 14, weight: 0.3, cooldown: 8, scene: 'hiking',
    title: 'Glass floor',
    text: 'Friends drag you onto a lookout with a glass floor. There is nothing between you and a long drop except confidence.',
    choices: [
      { label: 'Step out', tags: ['ambitious'], run: (x) => { x.mods({ confidence: 4, anxiety: 2 }); return 'Your legs shook, but you stood there and looked. The view was incredible.'; } },
      { label: 'Admire from the edge', tags: ['cautious'], run: (x) => { x.mods({ happiness: 1 }); return 'You took the photos. Someone has to.'; } },
      { label: 'Lie down on it', tags: ['impulsive'], run: (x) => { x.mods({ happiness: 3, anxiety: 3 }); return 'A small child stepped over you. You made a new friend.'; } },
    ],
  },
  {
    id: 'ag_gratitude', cat: 'mental', minAge: 16, weight: 0.5, cooldown: 5, scene: 'reading',
    title: 'Three good things',
    text: 'Someone suggests writing down three good things each night before bed.',
    choices: [
      { label: 'Try it for a month', tags: ['cautious'], run: (x) => { x.mods({ happiness: 5, depression: -3, wisdom: 1 }); x.train('writing', 1); return 'Good coffee. A dog that waved. Clean sheets. It adds up.'; } },
      { label: 'Tell people instead', tags: ['social'], scene: 'friends', run: (x) => { x.mods({ happiness: 4, popularity: 2 }); const r = friendOf(x); if (r) x.relMod(r.npcId, 4); return 'You told three people what you appreciate about them. Two cried.'; } },
      { label: 'Roll your eyes', run: (x) => { x.mods({ ego: 1 }); return 'Too twee. You wrote "complaint" three times and slept fine.'; } },
    ],
  },
  {
    id: 'ag_smallJoy', cat: 'mental', minAge: 8, weight: 0.6, cooldown: 3, scene: 'picnic',
    title: 'A perfect moment',
    text: (x) => `Warm light, ${x.pick(['a good cup of tea', 'fresh bread', 'a cat on your lap', 'children laughing next door', 'rain on the roof'])}, and for once nothing needs doing.`,
    choices: [
      { label: 'Savour it', tags: ['cautious'], run: (x) => { x.mods({ happiness: 5, stress: -4 }); return 'You did not take a photo. You just stayed. It was enough.'; } },
      { label: 'Share it with someone', tags: ['social'], run: (x) => { const r = x.lover() ?? friendOf(x); x.mods({ happiness: 4, loneliness: -3 }); if (r) { x.relMod(r.npcId, 3); return `${x.first(r.npcId)} sat with you. Neither of you said anything. Perfect.`; } return 'You told a neighbour about it. They smiled all day.'; } },
      { label: 'Write it down', run: (x) => { x.train('poetry', 2); x.mods({ creativity: 2, happiness: 3 }); x.remember('perfectMoment', 'A perfect, ordinary afternoon', 15); return 'Years later you will find this note and remember the exact light.'; } },
    ],
  },
  {
    id: 'ag_imposter', cat: 'mental', minAge: 22, maxAge: 70, weight: (x) => (x.employed ? 0.6 : 0), cooldown: 5, scene: 'office',
    title: 'Imposter',
    text: 'Everyone at work seems to know what they are doing. You are sure you will be found out any minute.',
    choices: [
      { label: 'Admit it to a colleague', tags: ['social'], run: (x) => { x.mods({ anxiety: -6, confidence: 3 }); return '"Oh, me too," they said. Then the boss said it too. Nobody knows anything.'; } },
      { label: 'List your actual wins', tags: ['cautious'], run: (x) => { x.mods({ confidence: 5, anxiety: -3 }); return 'Written down, your record is quite impressive. Who knew.'; } },
      { label: 'Overwork to compensate', tags: ['ambitious'], run: (x) => { x.mods({ stress: 6, professionalRep: 2 }); return 'Nobody found you out. Nobody saw you either, for three months.'; } },
    ],
  },
  {
    id: 'ag_overthinking', cat: 'mental', minAge: 14, weight: (x) => (x.stat('anxiety') >= 40 ? 0.7 : 0.3), cooldown: 4, scene: 'lonely',
    title: 'Replaying it',
    text: 'You said "you too" when the waiter told you to enjoy your meal. It has been six days.',
    choices: [
      { label: 'Laugh at yourself', tags: ['cautious'], run: (x) => { x.train('humor', 2); x.mods({ anxiety: -4, happiness: 2 }); return 'The waiter has forgotten. The waiter has said it himself.'; } },
      { label: 'Tell a friend', tags: ['social'], scene: 'friends', run: (x) => { x.mods({ anxiety: -5, loneliness: -2 }); return 'They told you something worse they did. Bonding through cringe.'; } },
      { label: 'Never go back', tags: ['impulsive'], run: (x) => { x.mods({ anxiety: 2 }); return 'That restaurant had the best noodles in town. A heavy price.'; } },
    ],
  },
  {
    id: 'ag_temper', cat: 'mental', minAge: 18, weight: (x) => (x.stat('aggression') >= 55 ? 1 : 0.2), cooldown: 4, scene: 'argument',
    title: 'Short fuse',
    text: 'You shouted at a printer, then at a person, then at yourself. Your temper is running the show.',
    choices: [
      { label: 'Anger management', tags: ['help'], when: (x) => x.year >= 1970, scene: 'rehab', run: (x) => { pay(x, 300); x.mods({ aggression: -8, empathy: 3 }); return 'Counting to ten sounds silly until it saves a friendship.'; } },
      { label: 'Take up boxing', tags: ['ambitious'], scene: 'gym', run: (x) => { x.train('boxing', 4); x.mods({ aggression: -5, fitness: 3 }); return 'Hitting a bag is cheaper than hitting the wall.'; } },
      { label: 'Apologise to everyone', tags: ['social'], run: (x) => { x.mods({ aggression: -3, karma: 2, popularity: 1 }); return 'Awkward apologies all round. The printer did not accept.'; } },
    ],
  },
  {
    id: 'ag_digitalDetox', cat: 'mental', minAge: 14, years: [2010, 2300], weight: 0.6, cooldown: 4, scene: 'gadget',
    title: 'Screen time',
    text: 'Your phone reports you spent nine hours a day on it last week. It sounds almost proud.',
    choices: [
      { label: 'Detox weekend', tags: ['cautious'], scene: 'camping', run: (x) => { x.mods({ stress: -8, anxiety: -5, happiness: 3 }); return 'You reached for your phone 200 times. By Sunday, you noticed birds.'; } },
      { label: 'Delete one app', tags: ['cautious'], run: (x) => { x.mods({ stress: -3, discipline: 2 }); return 'You redownloaded it on Thursday, but it was a good four days.'; } },
      { label: 'Doomscroll anyway', tags: ['impulsive'], run: (x) => { x.mods({ anxiety: 4, depression: 2 }); return 'You now know far too much about a stranger\'s kitchen renovation.'; } },
    ],
  },
  {
    id: 'ag_seasonalBlues', cat: 'mental', minAge: 16, weight: 0.4, cooldown: 4, scene: 'blizzard',
    title: 'Winter blues',
    text: 'It gets dark at four and you feel like a bear who forgot to hibernate.',
    choices: [
      { label: (x) => (x.year >= 1980 ? 'Buy a light lamp' : 'Sit by the brightest window'), tags: ['cautious'], run: (x) => { pay(x, 80); x.mods({ depression: -5, energy: 3 }); return 'Fake sunshine at breakfast. Surprisingly effective.'; } },
      { label: 'Plan something cosy', tags: ['social'], scene: 'familyDinner', run: (x) => { x.mods({ happiness: 4, loneliness: -5 }); return 'Soup, candles, friends. Winter is not so bad with company.'; } },
      { label: 'Book a sunny trip', tags: ['impulsive'], when: (x) => x.year >= 1950, scene: 'beach', run: (x) => { if (!pay(x, 1200)) return 'Too expensive. You put a beach photo on the fridge instead.'; x.mods({ happiness: 6, depression: -6 }); return 'A week of sunlight. You came back tanned and smug.'; } },
    ],
  },
  {
    id: 'ag_cryInPublic', cat: 'mental', minAge: 16, weight: 0.3, cooldown: 5, scene: 'lonely',
    title: 'Tears on the bus',
    text: 'Out of nowhere you start crying on the bus. A grandmother hands you a mint.',
    choices: [
      { label: 'Accept the mint', tags: ['social'], run: (x) => { x.mods({ loneliness: -4, happiness: 2, empathy: 2 }); return 'She told you about her late husband for five stops. You both felt better.'; } },
      { label: 'Book a check-in with yourself', tags: ['help'], scene: 'calm', run: (x) => { x.mods({ depression: -4, wisdom: 2 }); return 'You took the afternoon off and asked yourself what was really going on. Good question.'; } },
      { label: 'Pretend it is allergies', tags: ['cautious'], run: (x) => { x.mods({ anxiety: 2 }); return 'Nobody believed you, and everyone was kind anyway.'; } },
    ],
  },
  {
    id: 'ag_friendStruggling', cat: 'mental', minAge: 16, weight: 0.6, cooldown: 5, scene: 'friends',
    bind: bindRel('bestFriend', 'friend'),
    title: 'Friend in a slump',
    text: (x) => `${who(x)} has gone quiet. Messages unanswered, plans cancelled. Something is wrong.`,
    choices: [
      { label: 'Show up with food', tags: ['help'], run: (x) => { x.relMod(npcId(x), 8, 10); x.mods({ empathy: 3, karma: 3 }); return `${who(x)} cried when they opened the door. "I did not know how to ask." You stayed all evening.`; } },
      { label: 'Help them find support', tags: ['help'], run: (x) => { x.relMod(npcId(x), 6, 8); x.mods({ karma: 2 }); x.train('empathyListening', 3); return `You sat with ${who(x)} while they made the call. You are a good friend.`; } },
      { label: 'Give them space', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), -2); return 'Space is sometimes right. You check in again next month.'; } },
    ],
  },
  {
    id: 'ag_oldDiary', cat: 'mental', minAge: 30, weight: 0.4, once: true, scene: 'reading',
    title: 'Old diary',
    text: 'In a box in the attic you find your diary from when you were fifteen. It is mostly about dramatic lunches.',
    choices: [
      { label: 'Read it all', tags: ['impulsive'], run: (x) => { x.mods({ happiness: 4, wisdom: 2 }); return 'You were so sure about everything. You want to hug that kid.'; } },
      { label: 'Read it aloud to friends', tags: ['social'], scene: 'party', run: (x) => { x.mods({ happiness: 5, popularity: 2 }); x.train('comedy', 2); return 'A dramatic reading of your poem "Nobody Understands Me (Part 4)". Standing ovation.'; } },
      { label: 'Burn it', tags: ['cautious'], scene: 'camping', run: (x) => { x.mods({ stress: -2 }); return 'Some secrets deserve a dignified ending.'; } },
    ],
  },
  {
    id: 'ag_confession', cat: 'mental', minAge: 14, years: [-800, 1900], weight: (x) => (x.stat('trauma') >= 30 || x.stat('depression') >= 40 ? 1 : 0.3), cooldown: 5, scene: 'holy',
    title: 'Heavy heart',
    text: 'A heaviness has sat on you for months. There are no therapists yet, but there are people who listen.',
    choices: [
      { label: 'Speak to a priest or elder', tags: ['help'], run: (x) => { x.mods({ depression: -6, trauma: -4, faith: 3 }); return 'You talked through the night. Someone carrying it with you made it lighter.'; } },
      { label: 'Write long letters', tags: ['cautious'], scene: 'loveLetter', run: (x) => { x.train('writing', 3); x.mods({ depression: -4 }); return 'Pages and pages. A friend wrote back with equal honesty.'; } },
      { label: 'Work it into the ground', tags: ['ambitious'], scene: 'farm', run: (x) => { x.mods({ fitness: 2, depression: -1, stress: 3 }); return 'Hard labour quiets the head for a while.'; } },
    ],
  },
  {
    id: 'ag_restCure', cat: 'mental', minAge: 18, years: [1850, 1950], weight: (x) => (x.stat('depression') >= 45 || x.stat('anxiety') >= 55 ? 0.6 : 0), cooldown: 8, scene: 'nursingHome',
    title: 'Nerves',
    text: 'The doctor diagnoses "nerves" and prescribes a stay at a country rest home.',
    choices: [
      { label: 'Go, with letters from home', tags: ['help'], run: (x) => { pay(x, 1000); x.mods({ stress: -10, depression: -6, loneliness: 3 }); return 'Long walks, kind nurses, and letters every week. You came home steadier.'; } },
      { label: 'Find a modern specialist', tags: ['cautious'], when: (x) => therapyAvailable(x.year), scene: 'calm', run: (x) => { x.c.mental.therapy = true; x.mods({ anxiety: -6, depression: -6 }); return 'A new kind of doctor who just lets you talk. Remarkable.'; } },
      { label: 'Refuse and soldier on', run: (x) => { x.mods({ stress: 3 }); return 'Stiff upper lip. It holds, mostly.'; } },
    ],
  },
  {
    id: 'ag_panicPlan', cat: 'mental', minAge: 14, weight: (x) => (hasCondition(x, 'panic') || hasCondition(x, 'anxietyDisorder') ? 1 : 0), cooldown: 3, scene: 'calm',
    title: 'Safety plan',
    text: 'You have had enough panic attacks to know the signs. Today you have a choice about what to do next.',
    choices: [
      { label: 'Use your grounding tricks', tags: ['cautious'], run: (x) => { x.mods({ anxiety: -6, resilience: 3 }); return 'Five things you can see, four you can hear. It passed in minutes.'; } },
      { label: 'Keep seeing your therapist', tags: ['help'], when: (x) => therapyAvailable(x.year), run: (x) => { x.c.mental.therapy = true; x.mods({ anxiety: -8 }); if (x.chance(0.25)) { cure(x, 'panic'); cure(x, 'anxietyDisorder'); return 'Months without an attack. Your therapist says you can space out sessions.'; } return 'Slow, real progress.'; } },
      { label: 'Avoid crowded places', run: (x) => { x.mods({ loneliness: 4, anxiety: -2 }); return 'Safer, smaller life. Be careful it does not shrink too far.'; } },
    ],
  },
  {
    id: 'ag_perfectionist', cat: 'mental', minAge: 18, weight: (x) => (x.stat('discipline') >= 60 ? 0.6 : 0.2), cooldown: 5, scene: 'office',
    title: 'Not good enough',
    text: 'You rewrote one email eleven times. It was about biscuits.',
    choices: [
      { label: 'Send it at "good enough"', tags: ['cautious'], run: (x) => { x.mods({ stress: -5, anxiety: -3 }); return 'Nobody noticed the missing comma. The world continued.'; } },
      { label: 'Ask why you do this', tags: ['help'], scene: 'calm', run: (x) => { x.mods({ wisdom: 3, anxiety: -4 }); return 'A long walk and some honesty: it was never about the biscuits.'; } },
      { label: 'Rewrite it again', tags: ['ambitious'], run: (x) => { x.mods({ stress: 4 }); return 'Draft twelve. It is now a short story. About biscuits.'; } },
    ],
  },
  {
    id: 'ag_strangerKindness', cat: 'mental', minAge: 10, weight: 0.5, cooldown: 4, scene: 'friends',
    title: 'Random kindness',
    text: 'A stranger pays for your coffee "because you look like you needed a win today".',
    choices: [
      { label: 'Pay it forward', tags: ['help'], run: (x) => { pay(x, 10); x.mods({ happiness: 5, karma: 3 }); return 'You bought coffee for the next three people. A chain was born.'; } },
      { label: 'Thank them warmly', tags: ['social'], run: (x) => { x.mods({ happiness: 4, loneliness: -2 }); return 'You chatted for ten minutes. Their dog liked you best.'; } },
      { label: 'Get suspicious', tags: ['cautious'], run: (x) => { x.mods({ paranoia: 2 }); return 'You checked the coffee for poison. It was just coffee. And kindness.'; } },
    ],
  },
  {
    id: 'ag_laughingFit', cat: 'mental', minAge: 8, weight: 0.5, cooldown: 4, scene: 'friends',
    title: 'Giggle fit',
    text: 'At the worst possible moment, in a silent room, something becomes the funniest thing in the world.',
    choices: [
      { label: 'Let it out', tags: ['impulsive'], run: (x) => { x.mods({ happiness: 6, stress: -6, popularity: -1 }); return 'You laughed until you cried. A stranger joined in. Glorious.'; } },
      { label: 'Bite your cheek', tags: ['cautious'], run: (x) => { x.mods({ willpower: 2, happiness: 2 }); return 'You held it in, shaking silently like a washing machine on spin.'; } },
    ],
  },
  {
    id: 'ag_natureWalk', cat: 'mental', minAge: 12, weight: 0.5, cooldown: 3, scene: 'hiking',
    title: 'Into the woods',
    text: 'You have been indoors too long. The trees are right there.',
    choices: [
      { label: 'Walk without a plan', tags: ['cautious'], run: (x) => { x.mods({ stress: -6, depression: -3, fitness: 1 }); return 'Moss, birdsong and a deer that looked at you like you were the strange one.'; } },
      { label: 'Forage for dinner', tags: ['ambitious'], scene: 'cooking', run: (x) => { x.train('herbalism', 3); x.mods({ happiness: 3 }); return 'Wild garlic and blackberries. You felt like an ancient wizard.'; } },
      { label: 'Bring someone', tags: ['social'], scene: 'friends', run: (x) => { const r = x.lover() ?? friendOf(x); x.mods({ stress: -4, loneliness: -4 }); if (r) x.relMod(r.npcId, 4); return 'You talked about everything and nothing. Best afternoon in months.'; } },
    ],
  },
  {
    id: 'ag_supportGroup', cat: 'mental', minAge: 18, years: [1935, 2300], weight: (x) => (x.stat('trauma') >= 35 && !x.c.mental.supportGroup ? 0.7 : 0), cooldown: 6, scene: 'rehab',
    title: 'Circle of chairs',
    text: 'A flyer for a peer support group: "You are not the only one."',
    choices: [
      { label: 'Go and listen', tags: ['help'], run: (x) => { x.c.mental.supportGroup = true; x.mods({ loneliness: -6, trauma: -4 }); return 'You did not speak the first week. The second, you could not stop.'; } },
      { label: 'Bring a friend', tags: ['social'], run: (x) => { x.c.mental.supportGroup = true; x.mods({ loneliness: -8, anxiety: -3 }); return 'Easier with company. The biscuits are terrible and the people are wonderful.'; } },
      { label: 'Not yet', tags: ['cautious'], run: (x) => { x.mods({ anxiety: 1 }); return 'You kept the flyer. It is on the fridge, waiting.'; } },
    ],
  },
  {
    id: 'ag_birthdayBlues', cat: 'mental', minAge: 29, weight: (x) => ([29, 39, 49, 59, 69, 79].includes(x.age) ? 3 : 0), cooldown: 5, scene: 'birthday',
    title: 'Big birthday',
    text: (x) => `You are about to turn ${x.age + 1}. That number seems to belong to someone much older.`,
    choices: [
      { label: 'Throw a huge party', tags: ['social'], scene: 'party', run: (x) => { pay(x, 500); x.mods({ happiness: 6, loneliness: -6 }); return 'Everyone you love in one room, singing badly. You feel exactly the right age.'; } },
      { label: 'Do something new', tags: ['ambitious'], scene: 'travel', run: (x) => { x.mods({ happiness: 5, confidence: 3 }); return `You ${x.pick(['jumped out of a plane', 'learned to surf', 'took a pottery course', 'climbed a hill at dawn'])}. New decade, new tricks.`; } },
      { label: 'Ignore it entirely', tags: ['cautious'], run: (x) => { x.mods({ happiness: -1 }); return 'You told nobody. Your mother told everybody.'; } },
    ],
  },
  {
    id: 'ag_moodApp', cat: 'mental', minAge: 16, years: [2015, 2300], weight: 0.3, cooldown: 6, scene: 'gadget',
    title: 'Mood tracker',
    text: 'An app asks you to rate your mood every evening with a little face.',
    choices: [
      { label: 'Track for a month', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 2, anxiety: -3 }); return 'Turns out every bad day follows a night of bad sleep. Data!'; } },
      { label: 'Share it with your doctor', tags: ['help'], scene: 'checkup', run: (x) => { x.mods({ depression: -4, anxiety: -3 }); return 'Your doctor actually found it useful. Small adjustments, big difference.'; } },
      { label: 'Only pick the happy face', run: (x) => { x.mods({ happiness: 1 }); return 'According to the app you are the happiest person alive. Hmm.'; } },
    ],
  },
  {
    id: 'ag_learnSomething', cat: 'mental', minAge: 40, weight: 0.5, cooldown: 6, scene: 'classroom',
    title: 'Never too late',
    text: (x) => `An evening class in ${x.pick(['Italian', 'piano', 'astronomy', 'woodwork', 'watercolours'])} has one place left. Most students are half your age.`,
    choices: [
      { label: 'Sign up', tags: ['ambitious'], run: (x) => { pay(x, 200); x.mods({ smarts: 2, happiness: 4, creativity: 2 }); x.train(x.pick(['languages', 'music', 'astronomy', 'carpentry', 'painting']), 5); return 'You were the oldest and the keenest. The teacher adores you.'; } },
      { label: 'Teach yourself', tags: ['cautious'], scene: 'library', run: (x) => { x.mods({ smarts: 1, discipline: 2 }); return 'Library books and stubbornness. Slow, but yours.'; } },
      { label: 'Maybe next year', run: (x) => { x.mods({ happiness: -1 }); return 'Next year has a way of never arriving.'; } },
    ],
  },
  {
    id: 'ag_joyfulDay', cat: 'mental', minAge: 18, weight: (x) => (x.stat('happiness') >= 60 ? 0.6 : 0.2), cooldown: 4, scene: 'fireworks',
    title: 'Good news day',
    text: 'Three bits of good news arrive before lunch. You are suspicious of the universe.',
    choices: [
      { label: 'Celebrate', tags: ['social'], scene: 'party', run: (x) => { x.mods({ happiness: 6, loneliness: -3 }); return 'Cake for everyone. Even the grumpy neighbour had a slice.'; } },
      { label: 'Write a thank-you note', tags: ['help'], run: (x) => { x.mods({ happiness: 4, karma: 2 }); return 'You thanked someone who helped you years ago. They framed it.'; } },
      { label: 'Wait for the catch', tags: ['cautious'], run: (x) => { x.mods({ anxiety: 2 }); return 'There was no catch. You missed most of the fun waiting for one.'; } },
    ],
  },
  {
    id: 'ag_selfCompassion', cat: 'mental', minAge: 20, weight: (x) => (x.stat('confidence') < 40 ? 0.7 : 0.2), cooldown: 5, scene: 'calm',
    title: 'Inner critic',
    text: 'The voice in your head is meaner to you than you would ever be to a friend.',
    choices: [
      { label: 'Talk to yourself like a friend', tags: ['cautious'], run: (x) => { x.mods({ confidence: 5, depression: -3 }); return '"You did your best with what you knew." Weird to say. Weirder how much it helped.'; } },
      { label: 'Get support', tags: ['help'], when: (x) => therapyAvailable(x.year), run: (x) => { x.c.mental.therapy = true; x.mods({ confidence: 4, anxiety: -4 }); return 'Your therapist named the voice. It sounds a lot like a teacher you once had.'; } },
      { label: 'Prove it wrong', tags: ['ambitious'], run: (x) => { x.mods({ confidence: 3, stress: 3 }); return 'You did the scary thing. The critic went quiet, for now.'; } },
    ],
  },
  {
    id: 'ag_eclipseWonder', cat: 'mental', minAge: 8, weight: 0.15, once: true, scene: 'eclipse',
    title: 'Total eclipse',
    text: 'The sky goes dark at midday and the birds fall silent. Everyone around you gasps.',
    choices: [
      { label: 'Just watch', tags: ['cautious'], run: (x) => { x.mods({ happiness: 6, wisdom: 3, faith: 2 }); x.remember('eclipse', 'Saw a total eclipse', 25); return 'Two minutes that felt like a lifetime. You feel very small, in a good way.'; } },
      { label: 'Hold someone\'s hand', tags: ['social'], run: (x) => { const r = x.lover() ?? friendOf(x); x.mods({ happiness: 6, loneliness: -4 }); if (r) x.relMod(r.npcId, 5); return 'Sharing wonder doubles it.'; } },
      { label: (x) => (x.year < 1700 ? 'Fear the omen' : 'Explain the science'), run: (x) => { if (x.year < 1700) { x.mods({ anxiety: 4, faith: 3 }); return 'You prayed until the sun returned. It did, as suns tend to.'; } x.train('astronomy', 3); return 'You explained orbital mechanics. A child next to you was riveted. Her father less so.'; } },
    ],
  },
  // ================================================================== ADDICTION & RECOVERY
  {
    id: 'ag_temptation', cat: 'health', minAge: 18, weight: (x) => (recovering(x) ? 1.5 : 0), cooldown: 2, scene: 'bar',
    title: 'Just one',
    text: (x) => `At a party someone offers you ${recovering(x) === 'gambling' ? 'a seat at the card table' : 'a drink'}. "Just one. You have earned it."`,
    choices: [
      { label: 'Say no, kindly', tags: ['cautious'], run: (x) => { x.mods({ willpower: 4, confidence: 2 }); return 'You held a soda all night. Nobody noticed, which was the point.'; } },
      { label: 'Leave early', tags: ['cautious'], scene: 'car', run: (x) => { x.mods({ willpower: 2, loneliness: 2 }); return 'You slipped out and went home to a quiet, proud evening.'; } },
      { label: 'Call your sponsor', tags: ['help'], scene: 'rehab', run: (x) => { x.mods({ willpower: 5, loneliness: -3 }); return 'Ten minutes on the phone in a coat closet. Crisis averted.'; } },
      { label: 'Have just one', tags: ['impulsive'], run: (x) => { const k = recovering(x) ?? 'alcohol'; expose(x, k, 1.2); x.mods({ happiness: -4 }); return 'One became three. It is not the end, but it is a warning. Tomorrow is a new day one.'; } },
    ],
  },
  {
    id: 'ag_sponsor', cat: 'health', minAge: 18, years: [1935, 2300], weight: (x) => (recovering(x) ? 0.8 : 0), once: true, scene: 'rehab',
    title: 'Finding a sponsor',
    text: 'An older woman at the meeting has twenty years sober and a laugh like a foghorn. She offers to be your sponsor.',
    choices: [
      { label: 'Accept gratefully', tags: ['help'], run: (x) => { x.mods({ willpower: 6, loneliness: -6 }); x.remember('sponsor', 'Found a sponsor in recovery', 30); return 'She calls every Sunday and takes no nonsense. You love her.'; } },
      { label: 'Ask what it involves', tags: ['cautious'], run: (x) => { x.mods({ willpower: 3, wisdom: 2 }); return '"Honesty, coffee and showing up." Seems doable.'; } },
      { label: 'You can do this alone', run: (x) => { x.mods({ loneliness: 3, ego: 2 }); return 'Maybe. It is harder that way.'; } },
    ],
  },
  {
    id: 'ag_soberAnniversary', cat: 'health', minAge: 18, weight: (x) => (x.c.addictions.some((a) => a.everActive && !a.active && a.yearsClean >= 1) ? 1 : 0), cooldown: 3, scene: 'rehab',
    title: 'Clean anniversary',
    text: (x) => { const a = x.c.addictions.find((d) => d.everActive && !d.active && d.yearsClean >= 1); const y = a ? Math.floor(a.yearsClean) : 1; return `Today marks ${y} year${y === 1 ? '' : 's'} clean. You get a little coin and a big hug.`; },
    choices: [
      { label: 'Share your story', tags: ['help'], run: (x) => { x.mods({ happiness: 6, willpower: 4, karma: 3 }); return 'A newcomer in the back row cried. Afterward, they asked for your number.'; } },
      { label: 'Celebrate with family', tags: ['social'], scene: 'familyDinner', run: (x) => { x.mods({ happiness: 6, loneliness: -5 }); for (const r of x.rels('spouse', 'partner', 'child', 'parent').slice(0, 3)) x.relMod(r.npcId, 4, 6); return 'Cake, sparkling juice and a toast to you. Trust, slowly rebuilt.'; } },
      { label: 'Quiet gratitude', tags: ['cautious'], scene: 'calm', run: (x) => { x.mods({ wisdom: 3, stress: -4 }); return 'A walk at sunrise, a thank-you to nobody and everybody.'; } },
    ],
  },
  {
    id: 'ag_relapseWarning', cat: 'health', minAge: 18, weight: (x) => (recovering(x) && x.stat('stress') >= 55 ? 1.4 : 0), cooldown: 3, scene: 'lonely',
    title: 'Old cravings',
    text: 'A terrible week and the old craving comes back, whispering that you deserve a break.',
    choices: [
      { label: 'Go to a meeting', tags: ['help'], scene: 'rehab', run: (x) => { x.mods({ willpower: 5, stress: -5 }); return 'You said "I want to use" out loud in a room full of people who understood. The craving lost its grip.'; } },
      { label: 'Exercise it off', tags: ['cautious'], scene: 'gym', run: (x) => { x.mods({ fitness: 2, stress: -4, willpower: 2 }); return 'You ran until the voice got bored and left.'; } },
      { label: 'Give in', tags: ['impulsive'], run: (x) => { const k = recovering(x) ?? 'alcohol'; expose(x, k, 1.6); x.mods({ happiness: -6, depression: 4 }); return 'A slip. Shame is loud, but slips are part of many recoveries. Reach back out.'; } },
    ],
  },
  {
    id: 'ag_hittingBottom', cat: 'health', minAge: 18, weight: (x) => (addicted(x) ? 1.2 : 0), cooldown: 3, scene: 'lonely',
    title: 'Morning after',
    text: 'You wake up not remembering how you got home, with a message from someone you love that just says "Please."',
    choices: [
      { label: (x) => { const a = x.c.addictions.find((d) => d.active); return a?.kind === 'gambling' ? (x.year >= 1957 ? 'Go to Gamblers Anonymous' : 'Swear off the tables') : a?.kind === 'alcohol' && x.year >= 1935 ? 'Go to a meeting' : 'Try to quit'; }, tags: ['help'], scene: 'rehab', run: (x) => { const a = x.c.addictions.find((d) => d.active); if (!a) return 'You decided it would not happen again, and it has not.'; const pref: Record<string, string> = { alcohol: 'aa', gambling: 'ga', opioids: 'methadone', stimulants: 'cold', sex: 'cold', power: 'stepDown', violence: 'faith' }; const r = attemptRecovery(x, a.kind, x.year >= 1965 ? pref[a.kind] : 'cold'); if (!r.ok && r.text.startsWith('Nothing')) return attemptRecovery(x, a.kind, 'cold').text; return r.text; } },
      { label: 'Tell them the truth', tags: ['social'], run: (x) => { const r = x.lover() ?? x.rels('parent', 'sibling', 'bestFriend')[0]; x.mods({ willpower: 3, anxiety: -2 }); if (r) { x.relMod(r.npcId, 3, 6); return `You told ${x.first(r.npcId)} everything. They did not leave. They asked how to help.`; } return 'You wrote it all down. Honesty with yourself is a start.'; } },
      { label: 'Carry on as usual', tags: ['impulsive'], run: (x) => { x.mods({ health: -4, depression: 4 }); return 'You deleted the message. It did not delete itself from your mind.'; } },
    ],
  },
  {
    id: 'ag_friendAddiction', cat: 'health', minAge: 18, weight: 0.5, cooldown: 6, scene: 'rehab',
    bind: bindRel('bestFriend', 'friend', 'sibling'),
    title: 'Worried about them',
    text: (x) => `${who(x)} has been drinking every day, borrowing money and lying about small things.`,
    choices: [
      { label: 'Gently say you are worried', tags: ['help'], run: (x) => { x.train('empathyListening', 3); if (x.chance(0.5)) { x.relMod(npcId(x), 6, 8); return `${who(x)} was quiet, then said "I know." You drove them to their first meeting.`; } x.relMod(npcId(x), -4); return `${who(x)} got defensive. But the seed is planted, and you will be there when they are ready.`; } },
      { label: 'Stage an intervention', tags: ['ambitious'], scene: 'familyDinner', run: (x) => { if (x.chance(0.45)) { x.relMod(npcId(x), 4, 6); return 'Tears, letters, a packed bag. They agreed to treatment.'; } x.relMod(npcId(x), -8, -6); return 'They stormed out. It will take time.'; } },
      { label: 'Set a boundary', tags: ['cautious'], run: (x) => { x.mods({ stress: -3, wisdom: 2 }); x.relMod(npcId(x), -2); return 'No more loans, but always a phone call. Love with a fence.'; } },
    ],
  },
  {
    id: 'ag_officeDrinks', cat: 'adult', minAge: 21, years: [1900, 2300], weight: (x) => (x.employed ? 0.5 : 0), cooldown: 4, scene: 'bar',
    title: 'Every Friday',
    text: 'Friday drinks have become Thursday drinks, and now Wednesday drinks too.',
    choices: [
      { label: 'Go once a week', tags: ['cautious'], run: (x) => { x.mods({ loneliness: -3, popularity: 1 }); return 'Fizzy water after the first round. Everyone still likes you.'; } },
      { label: 'Suggest a lunch instead', tags: ['social'], scene: 'restaurant', run: (x) => { x.mods({ popularity: 2, health: 1 }); return 'Tacos on Thursdays caught on. Your liver sent a thank-you note.'; } },
      { label: 'Keep up with everyone', tags: ['impulsive'], run: (x) => { expose(x, 'alcohol', 0.7); x.mods({ health: -3, popularity: 2 }); return 'Great stories, dreadful mornings.'; } },
    ],
  },
  {
    id: 'ag_casinoNight', cat: 'adult', minAge: 21, years: [1650, 2300], weight: 0.35, cooldown: 5, scene: 'casino',
    title: 'Lucky streak',
    text: 'You won big on your first hand and your heart is racing. The dealer smiles knowingly.',
    choices: [
      { label: 'Walk away a winner', tags: ['cautious'], run: (x) => { x.money(cost(x, 200)); x.mods({ happiness: 4, willpower: 2 }); return 'You cashed out and bought everyone breakfast. Legend.'; } },
      { label: 'Set a limit', tags: ['cautious'], run: (x) => { x.money(cost(x, x.int(-100, 150))); x.mods({ happiness: 2 }); return 'A fun night, within budget. Rare and admirable.'; } },
      { label: 'Let it ride', tags: ['impulsive'], run: (x) => { expose(x, 'gambling', 0.8); if (x.chance(0.3)) { x.money(cost(x, 800)); return 'Double or nothing became double. The feeling is dangerous.'; } x.spend(Math.min(Math.max(0, x.c.money), cost(x, 600))); x.mods({ happiness: -5 }); return 'You lost it all and then some. The house always wins.'; } },
    ],
  },
  {
    id: 'ag_painPills', cat: 'health', minAge: 18, years: [1900, 2300], weight: (x) => (x.stat('pain') >= 30 ? 0.8 : 0.2), cooldown: 6, scene: 'checkup',
    title: 'Strong painkillers',
    text: 'After an injury the doctor writes you a prescription for strong painkillers. They work very, very well.',
    choices: [
      { label: 'Take exactly as directed', tags: ['cautious'], run: (x) => { x.mods({ pain: -8 }); return 'You finished the course and did not refill. Textbook.'; } },
      { label: 'Ask for alternatives', tags: ['help'], scene: 'gym', run: (x) => { x.mods({ pain: -5, wisdom: 2 }); return 'Physio, ice and a milder pill. Slower, safer.'; } },
      { label: 'Ask for a refill', tags: ['impulsive'], run: (x) => { expose(x, 'opioids', 0.8); x.mods({ pain: -10 }); return 'The pain is gone and something else has moved in. Be careful.'; } },
    ],
  },
  {
    id: 'ag_rehabStay', cat: 'health', minAge: 18, years: [1950, 2300], weight: (x) => (x.c.addictions.some((a) => a.active && a.severity >= 3) ? 0.9 : 0), cooldown: 4, scene: 'rehab',
    title: 'A bed opens',
    text: 'A residential treatment centre calls. A bed has opened up, starting Monday.',
    choices: [
      { label: 'Take the bed', tags: ['help'], run: (x) => { const a = x.c.addictions.find((d) => d.active); if (!a) return 'You no longer need it. Someone else will.'; const opt = a.kind === 'alcohol' || a.kind === 'opioids' || a.kind === 'stimulants' ? 'rehab' : a.kind === 'gambling' ? 'counselling' : a.kind === 'power' ? 'spiritual' : 'therapy'; const r = attemptRecovery(x, a.kind, opt); if (!r.ok && !r.text.startsWith('Nothing')) return r.text; if (!r.ok) return attemptRecovery(x, a.kind, 'cold').text; return r.text; } },
      { label: 'Do outpatient instead', tags: ['cautious'], run: (x) => { x.mods({ willpower: 3 }); return 'Evenings at the clinic, days at work. Harder, but you are trying.'; } },
      { label: 'Not now', tags: ['impulsive'], run: (x) => { x.mods({ depression: 3 }); return 'You let it go. The number is still saved in your phone.'; } },
    ],
  },
  {
    id: 'ag_makingAmends', cat: 'health', minAge: 20, weight: (x) => (recovering(x) ? 0.7 : 0), once: true, scene: 'reunion',
    bind: (x) => { const r = x.rels('ex', 'sibling', 'parent', 'child', 'friend', 'enemy').sort((a, b) => a.affinity - b.affinity)[0]; return r ? { npcId: r.npcId } : null; },
    title: 'Making amends',
    text: (x) => `Your recovery has brought you to the hardest step: apologising to ${who(x)} for the years you were not yourself.`,
    choices: [
      { label: 'Apologise in person', tags: ['help'], run: (x) => { if (x.chance(0.6)) { x.relMod(npcId(x), 15, 12); x.mods({ happiness: 6 }); return `${who(x)} listened, then hugged you for a long time.`; } x.relMod(npcId(x), 3, 3); x.mods({ wisdom: 3 }); return `${who(x)} was not ready to forgive. You said it anyway, and that was the point.`; } },
      { label: 'Write a letter', tags: ['cautious'], scene: 'loveLetter', run: (x) => { x.relMod(npcId(x), 6, 6); x.mods({ stress: -4 }); return 'Four drafts. A reply came weeks later: "Thank you. Let us start again."'; } },
      { label: 'Not yet', run: (x) => { x.mods({ anxiety: 2 }); return 'Your sponsor says there is no deadline. There is just readiness.'; } },
    ],
  },
  {
    id: 'ag_dryJanuary', cat: 'health', minAge: 21, years: [2010, 2300], weight: 0.4, cooldown: 5, scene: 'calm',
    title: 'Dry month',
    text: 'Half your friends are doing a month without alcohol and talking about it constantly.',
    choices: [
      { label: 'Join in', tags: ['cautious'], run: (x) => { x.mods({ health: 3, energy: 4, willpower: 2 }); return 'Better sleep, clearer skin, and you found a very fancy alcohol-free gin.'; } },
      { label: 'Make it a whole year', tags: ['ambitious'], when: (x) => addicted(x, 'alcohol') || x.hasMemory('recovery'), run: (x) => { x.mods({ health: 5, willpower: 5 }); const a = addictionOf(x, 'alcohol'); if (a) a.severity = Math.max(0, a.severity - 0.5); return 'One month became twelve. You barely miss it.'; } },
      { label: 'Mock them over wine', tags: ['impulsive'], run: (x) => { expose(x, 'alcohol', 0.2); x.mods({ popularity: -1 }); return 'Your jokes were funny until about the fourth glass.'; } },
    ],
  },
  {
    id: 'ag_vapeHabit', cat: 'health', minAge: 18, years: [2008, 2300], weight: 0.3, cooldown: 6, scene: 'calm',
    title: 'Little habit',
    text: 'The vape that was supposed to help you quit has become its own habit. It tastes of "blue".',
    choices: [
      { label: 'Taper off', tags: ['cautious'], run: (x) => { x.mods({ health: 3, willpower: 3, stress: 3 }); return 'Lower strength each month. Now you just fiddle with a pen.'; } },
      { label: 'Get help quitting', tags: ['help'], scene: 'checkup', run: (x) => { x.mods({ health: 3, willpower: 2 }); return 'A free clinic, patches and a cheerful nurse. Done.'; } },
      { label: 'Upgrade the flavour', tags: ['impulsive'], run: (x) => { x.mods({ health: -2 }); return 'Now it tastes of "galaxy". You are not sure what that is.'; } },
    ],
  },
  {
    id: 'ag_gamblingDebts', cat: 'health', minAge: 18, weight: (x) => (addicted(x, 'gambling') ? 1.2 : 0), cooldown: 3, scene: 'moneyDown',
    title: 'Hidden debts',
    text: 'The letters are piling up and you have been hiding them in a drawer.',
    choices: [
      { label: 'Come clean and get help', tags: ['help'], run: (x) => { const r = attemptRecovery(x, 'gambling', x.year >= 1957 ? 'ga' : 'cold'); x.mods({ stress: -4 }); return r.text; } },
      { label: 'One big win will fix it', tags: ['impulsive'], scene: 'casino', run: (x) => { expose(x, 'gambling', 1); if (x.chance(0.2)) { x.money(cost(x, 2000)); return 'You won. You will think it was skill. It was not.'; } x.spend(Math.min(Math.max(0, x.c.money), cost(x, 2000))); x.mods({ depression: 5 }); return 'It did not fix it. Please talk to someone.'; } },
      { label: 'Self-exclude', tags: ['cautious'], run: (x) => { x.mods({ willpower: 4 }); const r = attemptRecovery(x, 'gambling', 'cold'); return `You banned yourself from every venue. ${r.text}`; } },
    ],
  },
  {
    id: 'ag_soberCompanion', cat: 'health', minAge: 18, weight: (x) => (recovering(x) ? 0.5 : 0), cooldown: 5, scene: 'friends',
    title: 'Sober fun',
    text: 'You worry life is boring without your old crutch. A friend suggests a sober night out.',
    choices: [
      { label: 'Go dancing', tags: ['social'], scene: 'dance', run: (x) => { x.mods({ happiness: 5, loneliness: -5, fitness: 1 }); return 'Turns out you can dance terribly while completely sober. Liberating.'; } },
      { label: 'Find a new hobby', tags: ['cautious'], scene: 'painting', run: (x) => { x.mods({ creativity: 3, happiness: 3 }); x.train(x.pick(['painting', 'climbing', 'cooking', 'music']), 4); return 'The hours you used to lose are now yours to fill.'; } },
      { label: 'Stay in', run: (x) => { x.mods({ energy: 3 }); return 'A night in with tea is not boring. It is just peaceful.'; } },
    ],
  },
  {
    id: 'ag_partnerDrinking', cat: 'health', minAge: 21, weight: (x) => (x.lover() ? 0.35 : 0), cooldown: 6, scene: 'argument',
    bind: (x) => { const l = x.lover(); return l ? { npcId: l.npcId } : null; },
    title: 'Their drinking',
    text: (x) => `You find empty bottles hidden in ${who(x)}'s wardrobe. More than you expected.`,
    choices: [
      { label: 'Talk when they are sober', tags: ['help'], run: (x) => { x.relMod(npcId(x), 2, 6); x.train('conflictResolution', 3); return `${who(x)} broke down and agreed to see someone. The road is long, but you are on it together.`; } },
      { label: 'Get support for yourself', tags: ['help'], when: (x) => x.year >= 1950, scene: 'rehab', run: (x) => { x.mods({ stress: -5, wisdom: 2 }); return 'A group for families of drinkers. You learned you cannot fix them, only love them.'; } },
      { label: 'Pour it all away', tags: ['impulsive'], run: (x) => { x.relMod(npcId(x), -6); return 'A furious row, then silence. Then, days later, a quiet "you were right".'; } },
    ],
  },
  {
    id: 'ag_opiumDen', cat: 'health', minAge: 18, years: [1800, 1920], weight: 0.2, cooldown: 8, scene: 'drugs',
    title: 'Laudanum',
    text: 'The chemist sells laudanum for everything from coughs to "melancholy". Everyone seems to take it.',
    choices: [
      { label: 'Refuse it', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 2 }); return 'You bore your cough honestly. Future doctors would approve.'; } },
      { label: 'Take a little', tags: ['impulsive'], run: (x) => { expose(x, 'opioids', 0.6); x.mods({ pain: -6, happiness: 2 }); return 'A warm, drifting calm. It wants you to come back.'; } },
      { label: 'Try herbal tea', tags: ['help'], scene: 'gardening', run: (x) => { x.train('herbalism', 2); x.mods({ stress: -2 }); return 'Chamomile and honey. Less exciting, more sensible.'; } },
    ],
  },
  {
    id: 'ag_quitCaffeine', cat: 'health', minAge: 18, years: [1700, 2300], weight: 0.3, cooldown: 6, scene: 'restaurant',
    title: 'Coffee cold turkey',
    text: 'You decide to quit coffee. By noon you have a headache and a vendetta against the sun.',
    choices: [
      { label: 'Tough it out', tags: ['cautious'], run: (x) => { x.mods({ willpower: 3, energy: -3, stress: -2 }); return 'Day four, the fog lifted. You are now that person who drinks hot water with lemon.'; } },
      { label: 'Switch to tea', run: (x) => { x.mods({ energy: 1 }); return 'A sensible compromise. Your mug collection quadrupled.'; } },
      { label: 'Abandon the plan', tags: ['impulsive'], run: (x) => { x.mods({ happiness: 3 }); return 'You lasted until 2 p.m. Coffee is the one addiction you embrace.'; } },
    ],
  },
  {
    id: 'ag_relapseRecovery', cat: 'health', minAge: 18, weight: (x) => (x.c.addictions.some((a) => a.active && a.everActive && x.hasMemory('recovery')) ? 1 : 0), cooldown: 3, scene: 'calm',
    title: 'Starting over',
    text: 'You slipped and you are back at day one. The shame is heavy, but you know the way back.',
    choices: [
      { label: 'Go back to the group', tags: ['help'], scene: 'rehab', run: (x) => { const a = x.c.addictions.find((d) => d.active); x.mods({ loneliness: -5 }); if (!a) return 'They welcomed you back like you had never left.'; const r = attemptRecovery(x, a.kind, 'cold'); return `They welcomed you back like you had never left. ${r.text}`; } },
      { label: 'Forgive yourself first', tags: ['cautious'], run: (x) => { x.mods({ depression: -4, willpower: 2 }); return 'Relapse is part of many recoveries, not the end of one.'; } },
      { label: 'Hide it', tags: ['impulsive'], run: (x) => { x.mods({ anxiety: 4 }); return 'Secrets make addiction stronger. You know this. Tomorrow, maybe.'; } },
    ],
  },
  {
    id: 'ag_helpingNewcomer', cat: 'health', minAge: 25, weight: (x) => (x.c.addictions.some((a) => a.everActive && !a.active && a.yearsClean >= 3) ? 0.7 : 0), cooldown: 5, scene: 'rehab',
    title: 'The newcomer',
    text: 'A shaking young man sits in the back of the meeting. He looks exactly like you did.',
    choices: [
      { label: 'Sit next to him', tags: ['help'], run: (x) => { x.mods({ karma: 5, empathy: 4, happiness: 4 }); x.train('mentoring', 3); return 'You got him a coffee and your number. He called at 2 a.m. You answered.'; } },
      { label: 'Become a sponsor', tags: ['help'], run: (x) => { x.mods({ karma: 6, willpower: 4 }); x.train('mentoring', 5); x.remember('sponsorOthers', 'Became a sponsor to others in recovery', 35); return 'Helping him keeps you honest too. That is the secret.'; } },
      { label: 'Give him space', tags: ['cautious'], run: (x) => { x.mods({ empathy: 1 }); return 'You nodded at him. Sometimes a nod is enough.'; } },
    ],
  },
  // ================================================================== AGEING: MIDLIFE
  {
    id: 'ag_firstGrey', cat: 'midlife', minAge: 28, maxAge: 50, weight: 0.8, once: true, scene: 'aging',
    title: 'First grey hair',
    text: 'There it is in the bathroom mirror: one silver hair, glinting like it owns the place.',
    choices: [
      { label: 'Pluck it', tags: ['impulsive'], run: (x) => { x.mods({ happiness: 1 }); return 'Gone. Three came to its funeral.'; } },
      { label: 'Dye everything', tags: ['cautious'], scene: 'spa', run: (x) => { pay(x, 80); x.mods({ looks: 1 }); return 'Your hair is now a shade that does not occur in nature. Close enough.'; } },
      { label: 'Call it distinguished', run: (x) => { x.mods({ confidence: 3, wisdom: 1 }); return 'Silver fox in training. You wear it with pride.'; } },
    ],
  },
  {
    id: 'ag_midlifeCrisis', cat: 'midlife', minAge: 40, maxAge: 55, weight: 0.8, once: true, scene: 'car',
    title: 'Midlife crisis',
    text: 'You wake up one morning and realise you are halfway. Suddenly you want something loud, fast and shiny.',
    choices: [
      { label: (x) => (x.year >= 1910 ? 'Buy a sports car' : 'Buy a fine horse'), tags: ['impulsive'], run: (x) => { if (!pay(x, 40000)) { x.mods({ happiness: -2 }); return 'The dealer laughed. You bought a very nice helmet instead.'; } x.mods({ happiness: 8, ego: 4, looks: 1 }); return 'Bright red, impractical and absolutely glorious. Your back hurts getting in.'; } },
      { label: 'Learn the guitar', tags: ['ambitious'], scene: 'music', run: (x) => { x.train('music', 6); x.mods({ creativity: 4, happiness: 5 }); return 'You started a band with three accountants. You play one gig a year. It is the best night of it.'; } },
      { label: 'Run away to the sea', tags: ['impulsive'], scene: 'beach', run: (x) => { pay(x, 2000); x.mods({ happiness: 6, stress: -8 }); return 'A month by the ocean. You came back tanned with a new appreciation for home.'; } },
      { label: 'Take stock calmly', tags: ['cautious'], scene: 'calm', run: (x) => { x.mods({ wisdom: 5, stress: -3 }); return 'You made a list of what matters. It was short and mostly people.'; } },
    ],
  },
  {
    id: 'ag_careerSwitch', cat: 'midlife', minAge: 38, maxAge: 60, weight: (x) => (x.employed && x.stat('happiness') < 55 ? 0.6 : 0.15), once: true, scene: 'interview',
    title: 'Second career?',
    text: 'You have done this job for twenty years. You can do it in your sleep, and some days you think you do.',
    choices: [
      { label: 'Retrain in something new', tags: ['ambitious'], scene: 'classroom', run: (x) => { pay(x, 3000); x.mods({ happiness: 6, smarts: 2, stress: 4 }); return 'You were the oldest in the class. You also took the best notes.'; } },
      { label: 'Turn a hobby into side income', tags: ['cautious'], run: (x) => { x.money(cost(x, 500)); x.mods({ creativity: 3, happiness: 3 }); return 'Weekends selling things you made. It feeds your soul and some of your bills.'; } },
      { label: 'Stay put', run: (x) => { x.mods({ wisdom: 1 }); return 'Steady has its own quiet dignity. And a pension.'; } },
    ],
  },
  {
    id: 'ag_menopause', cat: 'midlife', minAge: 45, maxAge: 58, weight: (x) => (female(x) ? 1.2 : 0), once: true, scene: 'calm',
    title: 'The change',
    text: 'Hot flushes in meetings, sleep that comes and goes, and moods arriving without an appointment.',
    choices: [
      { label: 'Talk to your doctor', tags: ['help'], when: (x) => x.year >= 1940, scene: 'checkup', run: (x) => { pay(x, 150); x.mods({ energy: 4, stress: -4, health: 2 }); return 'Proper treatment and a doctor who listened. You feel like yourself again.'; } },
      { label: 'Swap notes with friends', tags: ['social'], scene: 'friends', run: (x) => { x.mods({ loneliness: -6, happiness: 4 }); return 'Over lunch you all compared symptoms and laughed until you were too hot. Again.'; } },
      { label: 'Exercise and fans', tags: ['cautious'], scene: 'yoga', run: (x) => { x.mods({ fitness: 2, stress: -3 }); return 'A desk fan named "Gerald" is now your closest colleague.'; } },
    ],
  },
  {
    id: 'ag_andropause', cat: 'midlife', minAge: 45, maxAge: 65, weight: (x) => (male(x) ? 0.6 : 0), once: true, scene: 'checkup',
    title: 'Losing steam',
    text: 'You are tired all the time, a bit flat, and your energy has gone missing somewhere around the middle.',
    choices: [
      { label: 'Get your levels checked', tags: ['help'], when: (x) => x.year >= 1950, run: (x) => { pay(x, 200); x.mods({ energy: 6, depression: -3 }); return 'Low on a couple of things, easily fixed. The spark is back.'; } },
      { label: 'Start lifting weights', tags: ['ambitious'], scene: 'gym', run: (x) => { x.train('strengthTraining', 4); x.mods({ fitness: 4, confidence: 3 }); return 'Turns out iron is great medicine. You groan when you sit down, though.'; } },
      { label: 'Accept a slower pace', tags: ['cautious'], scene: 'calm', run: (x) => { x.mods({ stress: -5, wisdom: 2 }); return 'Afternoon naps are not a weakness. They are a strategy.'; } },
    ],
  },
  {
    id: 'ag_emptyNest', cat: 'midlife', minAge: 40, maxAge: 70, weight: (x) => (x.children().length && x.children().every((n) => x.npcAge(n) >= 18) ? 0.8 : 0), once: true, scene: 'house',
    title: 'Empty nest',
    text: 'The last child has moved out. The house is very tidy and very quiet.',
    choices: [
      { label: 'Turn their room into a study', tags: ['ambitious'], scene: 'reading', run: (x) => { x.mods({ happiness: 3, creativity: 2 }); return 'Your own room for the first time in decades. You mostly nap in it.'; } },
      { label: 'Call them every day', tags: ['social'], run: (x) => { for (const c of x.rels('child')) x.relMod(c.npcId, 2); x.mods({ loneliness: -3 }); return 'They love you. They would also love some space.'; } },
      { label: 'Rediscover each other', tags: ['social'], when: (x) => !!x.lover(), scene: 'romance', run: (x) => { const l = x.lover(); if (l) x.relMod(l.npcId, 6, 4); x.mods({ happiness: 5 }); return 'Dinner without anyone asking for a lift. You remember why you liked each other.'; } },
    ],
  },
  {
    id: 'ag_agingParent', cat: 'midlife', minAge: 35, maxAge: 70, weight: 0.7, cooldown: 6, scene: 'nursingHome',
    bind: (x) => { const p = x.rels('parent').find((r) => { const n = x.npc(r.npcId); return !!n && x.npcAge(n) >= 70; }); return p ? { npcId: p.npcId } : null; },
    title: 'Caring for a parent',
    text: (x) => `${who(x)} left the stove on again and fell in the garden. They insist they are "perfectly fine".`,
    choices: [
      { label: 'Move them in with you', tags: ['help'], scene: 'family', run: (x) => { x.relMod(npcId(x), 8, 6); x.mods({ stress: 6, karma: 4 }); return `${who(x)} rearranged your kitchen on day one. It is chaos, and it is love.`; } },
      { label: 'Arrange home care', tags: ['cautious'], run: (x) => { pay(x, 3000); x.relMod(npcId(x), 4, 3); x.mods({ stress: 2 }); return `A cheerful carer visits daily. ${who(x)} pretends to hate her and adores her.`; } },
      { label: 'Visit more often', tags: ['social'], run: (x) => { x.relMod(npcId(x), 5, 4); x.mods({ stress: 3 }); return 'Sunday lunches became Wednesday and Sunday. Old stories, told again, are still good.'; } },
    ],
  },
  {
    id: 'ag_youngBoss', cat: 'midlife', minAge: 48, maxAge: 70, years: [1950, 2300], weight: (x) => (x.employed ? 0.5 : 0), once: true, scene: 'office',
    title: 'Your new boss',
    text: 'Your new manager is twenty-six, says "circle back" a lot and is genuinely very good at the job.',
    choices: [
      { label: 'Offer to mentor', tags: ['help'], run: (x) => { x.train('mentoring', 4); x.mods({ professionalRep: 3, wisdom: 2 }); return 'You teach them office politics; they teach you keyboard shortcuts. Fair trade.'; } },
      { label: 'Learn from them', tags: ['cautious'], run: (x) => { x.mods({ smarts: 2, ego: -2 }); return 'Humility, it turns out, is a skill you can still pick up.'; } },
      { label: 'Grumble in the break room', tags: ['impulsive'], run: (x) => { x.mods({ popularity: -2, stress: 2 }); return 'Your grumbling got back to them. Awkward.'; } },
    ],
  },
  {
    id: 'ag_wrinkles', cat: 'midlife', minAge: 40, maxAge: 65, weight: 0.5, once: true, scene: 'aging',
    title: 'Mirror check',
    text: 'In harsh shop lighting you catch a glimpse of your parent looking back at you. It is you.',
    choices: [
      { label: 'Fancy face cream', tags: ['impulsive'], scene: 'shopping', run: (x) => { pay(x, 120); x.mods({ looks: 1 }); return 'It smells of roses and money. Results: hopeful.'; } },
      { label: 'Smile at the reflection', tags: ['cautious'], run: (x) => { x.mods({ happiness: 3, wisdom: 2 }); return 'Those lines came from laughing. Worth every one.'; } },
      { label: 'Avoid that shop', run: (x) => { x.mods({ ego: 1 }); return 'The lighting was the problem, clearly.'; } },
    ],
  },
  {
    id: 'ag_reunion', cat: 'midlife', minAge: 30, maxAge: 80, years: [1900, 2300], weight: (x) => ([30, 40, 50, 60, 70].includes(x.age) ? 3 : 0), cooldown: 8, scene: 'reunion',
    title: 'School reunion',
    text: (x) => `Your ${x.age - 18}-year school reunion. Name tags, warm wine, and the class clown is now a dentist.`,
    choices: [
      { label: 'Go and catch up', tags: ['social'], scene: 'party', run: (x) => { x.mods({ happiness: 5, loneliness: -6 }); return 'Everyone is older and kinder. The old cliques have mellowed into fondness.'; } },
      { label: 'Find your old crush', tags: ['impulsive'], run: (x) => { x.mods({ happiness: 3 }); return 'They were lovely, married, and showed you forty photos of their grandchildren. Good for them.'; } },
      { label: 'Skip it', tags: ['cautious'], run: (x) => { x.mods({ stress: -2 }); return 'You saw the photos online. Everyone looked exactly the same and completely different.'; } },
    ],
  },
  // ================================================================== AGEING: SENIOR
  {
    id: 'ag_retirementParty', cat: 'senior', minAge: 58, maxAge: 75, years: [1880, 2300], weight: (x) => (x.employed && !x.c.retired ? 0.9 : 0), once: true, scene: 'retirement',
    title: 'Retirement party',
    text: 'Speeches, a cake shaped like your desk and a gold watch. Is this the end of your working life?',
    choices: [
      { label: 'Retire happily', tags: ['cautious'], run: (x) => { x.c.retired = true; x.mods({ stress: -15, happiness: 6 }); x.remember('retired', 'Retired after a long working life', 40); return 'You walked out into the sunshine and nobody needed you for anything. Bliss.'; } },
      { label: 'Give a funny speech', tags: ['social'], scene: 'party', run: (x) => { x.c.retired = true; x.train('humor', 3); x.mods({ happiness: 8, popularity: 3 }); x.remember('retired', 'Retired with a famous farewell speech', 40); return 'You roasted everyone lovingly. HR is still recovering.'; } },
      { label: 'Not ready yet', tags: ['ambitious'], run: (x) => { x.mods({ professionalRep: 2, stress: 2 }); return 'You stayed on part time. The cake was eaten anyway.'; } },
    ],
  },
  {
    id: 'ag_retiredRestless', cat: 'senior', minAge: 58, weight: (x) => (x.c.retired ? 1 : 0), cooldown: 5, scene: 'retirement',
    title: 'Now what?',
    text: 'You have alphabetised the spice rack twice. Retirement is lovely, and a little empty.',
    choices: [
      { label: 'Volunteer', tags: ['help'], scene: 'volunteer', run: (x) => { x.mods({ happiness: 6, karma: 4, loneliness: -6 }); return 'You read to children at the library. Their favourite voice is your dragon.'; } },
      { label: 'Take up a craft', tags: ['ambitious'], scene: 'painting', run: (x) => { x.train(x.pick(['carpentry', 'painting', 'sculpture', 'artisanship']), 5); x.mods({ creativity: 4, happiness: 4 }); return 'Your first birdhouse looked like a crime scene. Your fifth sold at a fair.'; } },
      { label: 'Consult part time', tags: ['ambitious'], when: (x) => x.c.careerHistory.length > 0, scene: 'office', run: (x) => { x.money(cost(x, 5000)); x.mods({ confidence: 3 }); return 'Two days a week of being the wise old hand. Perfect.'; } },
      { label: 'Embrace doing nothing', tags: ['cautious'], scene: 'calm', run: (x) => { x.mods({ stress: -6 }); return 'You watched clouds. One looked like your old boss. You laughed for an hour.'; } },
    ],
  },
  {
    id: 'ag_downsizing', cat: 'senior', minAge: 62, weight: 0.5, once: true, scene: 'moving',
    title: 'Too much house',
    text: 'Stairs are getting harder and half the rooms are full of boxes from previous decades.',
    choices: [
      { label: 'Downsize', tags: ['cautious'], run: (x) => { x.money(cost(x, 30000)); x.mods({ stress: -4, happiness: -2 }); return 'A cosy flat with a lift. You cried leaving the old house, then loved the new one.'; } },
      { label: 'Give things away', tags: ['help'], scene: 'volunteer', run: (x) => { x.mods({ karma: 3, happiness: 3 }); return 'Every grandchild got something with a story attached. Lighter in every way.'; } },
      { label: 'Stay and adapt', tags: ['impulsive'], scene: 'house', run: (x) => { pay(x, 4000); x.mods({ happiness: 2 }); return 'A stair lift. You ride it like a slow, dignified rollercoaster.'; } },
    ],
  },
  {
    id: 'ag_grandparentDuty', cat: 'senior', minAge: 45, weight: (x) => (x.rels('grandchild').length ? 1 : 0), cooldown: 3, scene: 'grandparents',
    bind: (x) => { const g = grandkid(x); return g ? { npcId: g.npcId } : null; },
    title: 'Grandparent duty',
    text: (x) => `You are minding ${who(x)} for the weekend. You have been given a list of rules you fully intend to ignore.`,
    choices: [
      { label: 'Spoil them rotten', tags: ['impulsive'], scene: 'amusement', run: (x) => { x.relMod(npcId(x), 8); x.mods({ happiness: 6 }); return 'Ice cream for breakfast and a late night. You returned a sugared-up hurricane.'; } },
      { label: 'Teach an old skill', tags: ['cautious'], scene: 'cooking', run: (x) => { x.relMod(npcId(x), 6); x.mods({ happiness: 5, wisdom: 2 }); return `You taught ${who(x)} your family recipe. They will make it for their own grandchildren.`; } },
      { label: 'Tell old stories', tags: ['social'], scene: 'reading', run: (x) => { x.relMod(npcId(x), 5); x.mods({ happiness: 4, loneliness: -4 }); return 'They asked for the story about the goat three times. It gets better each time.'; } },
    ],
  },
  {
    id: 'ag_techLesson', cat: 'senior', minAge: 60, years: [1995, 2300], weight: 0.7, cooldown: 5, scene: 'gadget',
    title: 'New gadget',
    text: (x) => `Your family bought you a ${x.year >= 2030 ? 'home AI that talks back' : x.year >= 2010 ? 'smartphone' : 'computer'}. It has already made three noises you do not understand.`,
    choices: [
      { label: 'Ask a grandchild', tags: ['social'], when: (x) => x.rels('grandchild').length > 0, scene: 'grandparents', run: (x) => { const g = grandkid(x); if (g) x.relMod(g.npcId, 5); x.mods({ smarts: 1, loneliness: -3 }); return 'They explained it very slowly and very patiently, like you once did with their shoelaces.'; } },
      { label: 'Take a class', tags: ['cautious'], scene: 'classroom', run: (x) => { x.train('programming', 1); x.mods({ smarts: 2, confidence: 2 }); return 'You can now video call, which mostly shows your ceiling and one ear.'; } },
      { label: 'Put it in a drawer', tags: ['impulsive'], run: (x) => { x.mods({ loneliness: 2 }); return 'The drawer occasionally buzzes. You ignore it with dignity.'; } },
    ],
  },
  {
    id: 'ag_scamCall', cat: 'senior', minAge: 65, years: [1990, 2300], weight: 0.5, cooldown: 4, scene: 'hacker',
    title: 'Urgent call',
    text: 'A man says your bank account is compromised and you must move your savings "to a safe account" immediately.',
    choices: [
      { label: 'Hang up and call the bank', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 3, confidence: 2 }); return 'A scam, naturally. The bank thanked you. You felt very sharp.'; } },
      { label: 'Waste his time', tags: ['impulsive'], run: (x) => { x.train('comedy', 2); x.mods({ happiness: 4 }); return 'You kept him on the line for forty minutes describing your cat. He hung up on you.'; } },
      { label: 'Do as he says', run: (x) => { const lost = Math.min(Math.max(0, x.c.money), cost(x, 5000)); x.spend(lost); x.mods({ happiness: -8, anxiety: 6 }); return 'It was a scam. It happens to clever people too. Your family helped you report it.'; } },
    ],
  },
  {
    id: 'ag_bucketList', cat: 'senior', minAge: 55, weight: 0.5, cooldown: 6, scene: 'travel',
    title: 'Bucket list',
    text: 'You find an old list titled "Before I go". Most of it is still unticked.',
    choices: [
      { label: 'See the wonder of the world', tags: ['ambitious'], run: (x) => { if (!pay(x, 6000)) return 'Not this year. You bought a big book of photos and planned instead.'; x.mods({ happiness: 8, wisdom: 2 }); x.remember('bucketTrip', 'Ticked off a bucket-list journey', 30); return 'You stood where you dreamed of standing. It was even bigger than you imagined.'; } },
      { label: 'Something daring', tags: ['impulsive'], scene: 'sports', run: (x) => { x.mods({ happiness: 7, confidence: 4, anxiety: 2 }); return `You ${x.year >= 1930 ? 'went skydiving' : 'rode a camel across a desert'}. Your screaming was described as "operatic".`; } },
      { label: 'Fix an old regret', tags: ['help'], scene: 'reunion', run: (x) => { x.mods({ happiness: 5, wisdom: 3, karma: 2 }); return 'You wrote to someone you wronged decades ago. They wrote back.'; } },
    ],
  },
  {
    id: 'ag_writeWill', cat: 'senior', minAge: 50, weight: (x) => (x.age >= 65 ? 0.7 : 0.3), once: true, scene: 'office',
    title: 'Making a will',
    text: 'A lawyer with a cardigan asks who gets what. Suddenly the good china is a political issue.',
    choices: [
      { label: 'Split it evenly', tags: ['cautious'], run: (x) => { pay(x, 400); x.setFlag('hasWill', true); x.mods({ stress: -4, wisdom: 2 }); return 'Fair, sensible and nobody will speak to anyone about it. Perfect.'; } },
      { label: 'Leave it to charity', tags: ['help'], scene: 'volunteer', run: (x) => { pay(x, 400); x.setFlag('hasWill', true); x.mods({ karma: 6 }); return 'A scholarship in your name. The children are surprisingly supportive. Mostly.'; } },
      { label: 'Add some jokes', tags: ['impulsive'], run: (x) => { pay(x, 400); x.setFlag('hasWill', true); x.train('humor', 2); x.mods({ happiness: 4 }); return 'Everyone gets a riddle. The lawyer is concerned. You are delighted.'; } },
    ],
  },
  {
    id: 'ag_walkingStick', cat: 'senior', minAge: 68, weight: 0.5, once: true, scene: 'aging',
    title: 'Third leg',
    text: 'The doctor says a walking stick would help. You have been dreading this conversation.',
    choices: [
      { label: 'Get a dashing one', tags: ['impulsive'], run: (x) => { pay(x, 150); x.mods({ confidence: 3, fitness: 1 }); return 'Silver-topped and very swishy. You gesture with it at pigeons.'; } },
      { label: 'Balance classes', tags: ['cautious'], scene: 'yoga', run: (x) => { x.train('yoga', 3); x.mods({ fitness: 2 }); return 'Tai chi in the park with other wobbly legends. Steadier already.'; } },
      { label: 'Refuse', tags: ['impulsive'], run: (x) => { if (x.chance(0.3)) { x.mods({ health: -6, pain: 6 }); return 'You fell on the ice. Fine, give me the stick.'; } x.mods({ ego: 2 }); return 'You are doing fine. For now.'; } },
    ],
  },
  {
    id: 'ag_hipFall', cat: 'senior', minAge: 70, weight: (x) => (x.stat('fitness') < 40 ? 0.6 : 0.25), cooldown: 6, scene: 'hospital',
    title: 'A fall',
    text: 'You slipped on the kitchen floor and could not get up for an hour.',
    choices: [
      { label: (x) => (x.year >= 1990 ? 'Get an alarm pendant' : 'Arrange a daily visitor'), tags: ['help'], run: (x) => { pay(x, 200); x.mods({ anxiety: -4, loneliness: -2 }); return 'Someone will always know if you need help. A huge relief for everyone.'; } },
      { label: 'Strength exercises', tags: ['cautious'], scene: 'gym', run: (x) => { x.mods({ fitness: 3, pain: 2 }); return 'Sit-to-stands, ten a day. Your thighs are furious and much stronger.'; } },
      { label: 'Hide it from family', tags: ['impulsive'], run: (x) => { x.mods({ anxiety: 3 }); if (x.chance(0.3)) return `It happened again, worse. ${injure(x, false, 'badBones')}`; return 'Your secret is safe. Your hip is less sure.'; } },
    ],
  },
  {
    id: 'ag_hearingGrandkids', cat: 'senior', minAge: 60, weight: (x) => (x.rels('grandchild').length >= 1 ? 0.6 : 0), cooldown: 4, scene: 'familyDinner',
    title: 'Big family lunch',
    text: 'The whole clan is round your table. It is loud, chaotic and nobody is listening to anyone.',
    choices: [
      { label: 'Make a toast', tags: ['social'], run: (x) => { for (const r of x.rels('child', 'grandchild').slice(0, 5)) x.relMod(r.npcId, 3); x.mods({ happiness: 6 }); return 'You told them how proud you are. Even the teenager looked up from their plate.'; } },
      { label: 'Sit back and watch', tags: ['cautious'], run: (x) => { x.mods({ happiness: 5, wisdom: 2 }); return 'All this, from two people meeting by chance. Astonishing, really.'; } },
      { label: 'Start a family argument', tags: ['impulsive'], scene: 'argument', run: (x) => { x.mods({ happiness: 2 }); return 'You mentioned politics. Pass the potatoes and duck.'; } },
    ],
  },
  {
    id: 'ag_greatGrandchild', cat: 'elder', minAge: 65, weight: (x) => (x.rels('grandchild').some((r) => { const n = x.npc(r.npcId); return !!n && x.npcAge(n) >= 22; }) ? 0.4 : 0), once: true, scene: 'birth',
    title: 'Four generations',
    text: 'Your grandchild places their newborn in your arms. Four generations in one photograph.',
    choices: [
      { label: 'Hold them close', tags: ['cautious'], run: (x) => { x.mods({ happiness: 10 }); x.remember('greatGrandchild', 'Held a great-grandchild', 50); return 'Tiny fingers wrapped round yours. Everything was worth it.'; } },
      { label: 'Give the baby advice', tags: ['social'], run: (x) => { x.train('humor', 1); x.mods({ happiness: 8 }); x.remember('greatGrandchild', 'Met a great-grandchild', 50); return '"Buy land, call your mother, avoid shellfish." The baby burped. Agreed.'; } },
    ],
  },
  {
    id: 'ag_seniorDiscount', cat: 'senior', minAge: 60, maxAge: 66, years: [1950, 2300], weight: 0.5, once: true, scene: 'shopping',
    title: 'Senior discount',
    text: 'The cashier gives you the senior discount without being asked. You did not ask for it.',
    choices: [
      { label: 'Take it with joy', tags: ['cautious'], run: (x) => { x.money(cost(x, 5)); x.mods({ happiness: 2 }); return 'Ten percent off cheese. Age has its perks.'; } },
      { label: 'Be outraged', tags: ['impulsive'], run: (x) => { x.mods({ ego: 2, happiness: -1 }); return '"Do I look sixty?" The cashier said yes, carefully.'; } },
      { label: 'Ask for more discounts', tags: ['ambitious'], run: (x) => { x.train('negotiation', 2); x.money(cost(x, 20)); return 'Cinema, buses, the barber. You have turned ageing into a sport.'; } },
    ],
  },
  {
    id: 'ag_cruise', cat: 'senior', minAge: 62, years: [1960, 2300], weight: (x) => (x.c.retired ? 0.5 : 0.15), cooldown: 8, scene: 'luxury',
    title: 'The cruise',
    text: 'A brochure arrives: a floating hotel, twelve buffets and a man who plays the piano badly every night.',
    choices: [
      { label: 'Book it', tags: ['impulsive'], run: (x) => { if (!pay(x, 4000)) return 'Too dear this year. You went to the seaside for a day instead.'; x.mods({ happiness: 7, loneliness: -5, health: -1 }); return 'You won the ship quiz and gained four pounds. Triumph.'; } },
      { label: 'Go with old friends', tags: ['social'], when: (x) => !!friendOf(x), scene: 'friends', run: (x) => { pay(x, 4000); const r = friendOf(x); if (r) x.relMod(r.npcId, 8); x.mods({ happiness: 8 }); return 'Two weeks of giggling like teenagers. The staff will remember you.'; } },
      { label: 'Stay on land', tags: ['cautious'], run: (x) => { x.mods({ stress: -1 }); return 'Your seasickness sends its thanks.'; } },
    ],
  },
  {
    id: 'ag_memoir', cat: 'senior', minAge: 60, weight: 0.4, once: true, scene: 'reading',
    title: 'Your story',
    text: 'Your grandchildren keep asking about the old days. Maybe you should write it all down.',
    choices: [
      { label: 'Write a memoir', tags: ['ambitious'], run: (x) => { x.train('writing', 6); x.mods({ wisdom: 4, happiness: 5 }); x.remember('memoir', 'Wrote down your life story', 35); return 'Three hundred pages, eleven of them about one disastrous wedding.'; } },
      { label: 'Record the stories', tags: ['social'], when: (x) => x.year >= 1930, run: (x) => { x.mods({ happiness: 4, loneliness: -3 }); return 'Hours of your voice, saved forever. Your laugh is on every tape.'; } },
      { label: 'Some things stay private', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 1 }); return 'Not every story needs telling. A few are just for you.'; } },
    ],
  },
  {
    id: 'ag_oldFriendLoss', cat: 'elder', minAge: 65, weight: (x) => (x.rels('friend', 'bestFriend').length ? 0.6 : 0.3), cooldown: 4, scene: 'funeral',
    title: 'Another goodbye',
    text: 'The phone rings early. Another friend from the old days has gone. The list of people who remember you young is getting shorter.',
    choices: [
      { label: 'Speak at the funeral', tags: ['social'], run: (x) => { x.mods({ depression: 3, wisdom: 3 }); x.train('publicSpeaking', 2); return 'You told the story of the stolen goose. Everyone laughed through their tears.'; } },
      { label: 'Call the friends left', tags: ['help'], scene: 'friends', run: (x) => { x.mods({ loneliness: -6, depression: -2 }); return 'You rang everyone still here. Lunch next week, no excuses.'; } },
      { label: 'Grieve quietly', tags: ['cautious'], scene: 'graveVisit', run: (x) => { x.mods({ depression: 4 }); return 'You sat with their photograph and a glass of their favourite drink.'; } },
    ],
  },
  {
    id: 'ag_memoryLapse', cat: 'senior', minAge: 58, weight: 0.6, cooldown: 3, scene: 'aging',
    title: 'Where are my keys?',
    text: 'You walked into the kitchen with great purpose and now have no idea why.',
    choices: [
      { label: 'Laugh it off', tags: ['cautious'], run: (x) => { x.train('humor', 1); x.mods({ happiness: 2 }); return 'The keys were in the fridge. The milk was in your coat. Classic.'; } },
      { label: 'Do puzzles daily', tags: ['ambitious'], scene: 'reading', run: (x) => { x.mods({ smarts: 2, discipline: 1 }); return 'Crosswords, sudoku, and arguments with the radio quiz. Sharp as a tack.'; } },
      { label: 'Get it checked', tags: ['help'], when: (x) => x.year >= 1950, scene: 'checkup', run: (x) => { pay(x, 200); x.mods({ anxiety: -4 }); return 'Perfectly normal for your age. Everyone forgets why they are in the kitchen.'; } },
    ],
  },
  // ================================================================== AGEING: ELDER
  {
    id: 'ag_dementiaSigns', cat: 'elder', minAge: 68, weight: (x) => (x.s.settings.dementiaPath && !hasChronic(x, 'dementia') ? 0.5 : 0), once: true, scene: 'dementia',
    when: (x) => x.s.settings.dementiaPath && !hasChronic(x, 'dementia'),
    title: 'Lost on the way home',
    text: 'You took the same route home you have taken for thirty years, and suddenly nothing looked familiar.',
    choices: [
      { label: 'See a doctor with family', tags: ['help'], scene: 'checkup', run: (x) => { diagnose(x, 'dementia'); const c = x.c.bio.chronic.find((d) => d.id === 'dementia'); if (c && x.year >= 1995) c.managed = true; x.mods({ loneliness: -4 }); return 'Early dementia. Hard words, but caught early, with people beside you and a plan.'; } },
      { label: 'Make notes and routines', tags: ['cautious'], scene: 'reading', run: (x) => { x.mods({ anxiety: -2, discipline: 2 }); if (x.chance(0.5)) diagnose(x, 'dementia'); return 'Sticky notes on every door and a calendar the size of a wall. They help.'; } },
      { label: 'Keep it to yourself', run: (x) => { diagnose(x, 'dementia'); x.mods({ anxiety: 6, loneliness: 4 }); return 'It is frightening to carry alone. Your family would want to know.'; } },
    ],
  },
  {
    id: 'ag_dementiaGoodDay', cat: 'elder', minAge: 60, weight: (x) => (x.s.settings.dementiaPath && hasChronic(x, 'dementia') ? 1.2 : 0), cooldown: 2, scene: 'grandparents',
    when: (x) => x.s.settings.dementiaPath && hasChronic(x, 'dementia'),
    title: 'A clear day',
    text: 'This morning everything is sharp and bright. You know every name, every face, every song.',
    choices: [
      { label: 'Call everyone you love', tags: ['social'], scene: 'family', run: (x) => { for (const r of x.rels('child', 'grandchild', 'spouse', 'sibling').slice(0, 5)) x.relMod(r.npcId, 6, 4); x.mods({ happiness: 8 }); return 'You told each of them something you wanted them to know. They will treasure it.'; } },
      { label: 'Write letters for later', tags: ['help'], scene: 'loveLetter', run: (x) => { x.train('writing', 2); x.mods({ happiness: 5, wisdom: 3 }); return 'Letters for birthdays you may not remember. Your love, in ink, waiting.'; } },
      { label: 'Sing the old songs', tags: ['cautious'], scene: 'music', run: (x) => { x.mods({ happiness: 6, stress: -4 }); return 'Every word came back. Music lives in a part of you nothing can touch.'; } },
    ],
  },
  {
    id: 'ag_dementiaFog', cat: 'elder', minAge: 60, weight: (x) => (x.s.settings.dementiaPath && hasChronic(x, 'dementia') ? 1 : 0), cooldown: 2, scene: 'dementia',
    when: (x) => x.s.settings.dementiaPath && hasChronic(x, 'dementia'),
    title: 'Faded pictures',
    text: 'There is a kind stranger in your kitchen who calls you by a family name. Their face tugs at something.',
    choices: [
      { label: 'Hold their hand', tags: ['cautious'], run: (x) => { x.mods({ anxiety: -4, loneliness: -4 }); return 'You did not remember their name, but you remembered that you love them. That was enough.'; } },
      { label: 'Look at the photo album', tags: ['help'], scene: 'reading', run: (x) => { x.mods({ anxiety: -3, happiness: 3 }); return 'Page by page, it came back. "There you are," you said, and they cried.'; } },
      { label: 'Ask them to tell a story', tags: ['social'], run: (x) => { x.mods({ happiness: 3 }); return 'They told you about your own wedding. It was a beautiful story.'; } },
    ],
  },
  {
    id: 'ag_dementiaCare', cat: 'elder', minAge: 60, weight: (x) => (x.s.settings.dementiaPath && hasChronic(x, 'dementia') ? 0.7 : 0), once: true, scene: 'nursingHome',
    when: (x) => x.s.settings.dementiaPath && hasChronic(x, 'dementia'),
    title: 'Care plan',
    text: 'Your family sits you down, gently, to talk about what kind of help you will need next.',
    choices: [
      { label: 'Choose a memory care home', tags: ['help'], run: (x) => { pay(x, 5000); x.setFlag('inCare', true); x.mods({ anxiety: -4 }); return 'A garden, a cat called Biscuit and staff who sing with you. It feels safe.'; } },
      { label: 'Stay home with carers', tags: ['cautious'], scene: 'house', run: (x) => { pay(x, 3000); x.mods({ happiness: 3 }); return 'Your own chair, your own window, and someone kind every morning.'; } },
      { label: 'Write down your wishes', tags: ['cautious'], scene: 'reading', run: (x) => { x.setFlag('hasWill', true); x.mods({ wisdom: 3, stress: -4 }); return 'Your favourite music, your favourite blanket, no fuss. They will honour it.'; } },
    ],
  },
  {
    id: 'ag_careHomeChoice', cat: 'elder', minAge: 80, years: [1900, 2300], weight: (x) => (x.flag('inCare') ? 0 : x.stat('health') < 50 ? 1 : 0.3), once: true, scene: 'nursingHome',
    title: 'Moving to care',
    text: 'Stairs, cooking and the garden have all become too much. Your family brings brochures with lots of smiling photos.',
    choices: [
      { label: 'Move into a care home', tags: ['cautious'], run: (x) => { pay(x, 5000); x.setFlag('inCare', true); x.mods({ loneliness: -6, stress: -5, happiness: -2 }); return 'Hard to leave home. But there is bingo, and a man called Arthur who flirts with everyone.'; } },
      { label: 'Live with family', tags: ['social'], scene: 'family', run: (x) => { const c = x.rels('child')[0]; if (c) x.relMod(c.npcId, 4, 4); x.mods({ loneliness: -8 }); return 'A room at the back with a view of the garden and the noise of grandchildren.'; } },
      { label: 'Stay independent', tags: ['impulsive'], scene: 'house', run: (x) => { x.mods({ confidence: 3, anxiety: 3 }); return 'Your house, your rules, your slightly alarming ladder use.'; } },
    ],
  },
  {
    id: 'ag_careHomeFriends', cat: 'elder', minAge: 70, weight: (x) => (x.flag('inCare') ? 1.2 : 0), cooldown: 2, scene: 'nursingHome',
    title: 'New neighbours',
    text: 'The care home has a new resident with a sharp tongue, a former career on the stage and a secret stash of sherry.',
    choices: [
      { label: 'Befriend them', tags: ['social'], run: (x) => { x.mods({ loneliness: -8, happiness: 5 }); return 'You are now the terrors of the day room. The staff pretend to disapprove.'; } },
      { label: 'Organise a quiz night', tags: ['ambitious'], scene: 'party', run: (x) => { x.mods({ popularity: 3, happiness: 4 }); return 'Fierce competition. Two people were sent to their rooms. Excellent.'; } },
      { label: 'Keep to your room', tags: ['cautious'], scene: 'reading', run: (x) => { x.mods({ loneliness: 3, stress: -2 }); return 'A good book and a quiet afternoon. Sometimes that is the luxury.'; } },
    ],
  },
  {
    id: 'ag_careHomeTalent', cat: 'elder', minAge: 70, weight: (x) => (x.flag('inCare') ? 0.7 : 0), cooldown: 4, scene: 'stage',
    title: 'Talent show',
    text: 'The care home is putting on a talent show, and the activities coordinator is looking directly at you.',
    choices: [
      { label: 'Sing a song', tags: ['social'], run: (x) => { x.train('singing', 2); x.mods({ happiness: 6, confidence: 3 }); return 'Your voice wobbled and the room sang along. Standing ovation, slowly.'; } },
      { label: 'Tell jokes', tags: ['impulsive'], run: (x) => { x.train('comedy', 3); x.mods({ happiness: 5, popularity: 3 }); return 'Your jokes were from 1952. They killed.'; } },
      { label: 'Heckle lovingly', tags: ['cautious'], run: (x) => { x.mods({ happiness: 3 }); return 'Arthur did a magic trick. You announced the card before he did.'; } },
    ],
  },
  {
    id: 'ag_nearDeath', cat: 'elder', minAge: 65, weight: (x) => (x.stat('health') < 30 ? 1 : 0), once: true, scene: 'reincarnation',
    title: 'The light',
    text: 'In the hospital, your heart stopped for a minute. You remember warmth, a light and a voice that said "not yet".',
    choices: [
      { label: 'Live differently now', tags: ['cautious'], scene: 'calm', run: (x) => { x.mods({ wisdom: 6, happiness: 5, stress: -8, faith: 3 }); x.remember('nearDeath', 'Had a near-death experience', 60); return 'Small things stopped bothering you. Big things, like sunsets, bother you in the best way.'; } },
      { label: 'Tell everyone you love them', tags: ['social'], scene: 'family', run: (x) => { for (const r of x.rels('spouse', 'partner', 'child', 'grandchild', 'sibling', 'bestFriend').slice(0, 6)) x.relMod(r.npcId, 6, 4); x.mods({ happiness: 6 }); x.remember('nearDeath', 'Had a near-death experience', 60); return 'Some were embarrassed. All of them hugged you back.'; } },
      { label: 'Joke about it', tags: ['impulsive'], run: (x) => { x.train('humor', 2); x.mods({ happiness: 4 }); x.remember('nearDeath', 'Had a near-death experience', 60); return '"The afterlife has a waiting room too, apparently." The nurse snorted.'; } },
    ],
  },
  {
    id: 'ag_lastWishes', cat: 'elder', minAge: 78, weight: 0.5, once: true, scene: 'retirement',
    title: 'Last wishes',
    text: 'Your family asks, carefully, if there is anything you still want to do, see or say.',
    choices: [
      { label: 'See the sea once more', tags: ['cautious'], scene: 'beach', run: (x) => { pay(x, 300); x.mods({ happiness: 8, stress: -6 }); return 'Shoes off, toes in the cold water, the whole family around you. Perfect.'; } },
      { label: 'Gather everyone', tags: ['social'], scene: 'familyDinner', run: (x) => { for (const r of x.rels('child', 'grandchild', 'sibling').slice(0, 8)) x.relMod(r.npcId, 5, 3); x.mods({ happiness: 8, loneliness: -10 }); return 'A long table, every face you love, and far too much cake.'; } },
      { label: 'Make peace with someone', tags: ['help'], scene: 'reunion', run: (x) => { x.mods({ wisdom: 4, karma: 4, happiness: 5 }); return 'An old feud ended with two cups of tea and a long silence.'; } },
    ],
  },
  {
    id: 'ag_funeralPlans', cat: 'elder', minAge: 70, weight: 0.4, once: true, scene: 'funeral',
    title: 'Planning the send-off',
    text: 'You decide to plan your own funeral, because nobody else will get the music right.',
    choices: [
      { label: 'Make it a party', tags: ['impulsive'], scene: 'party', run: (x) => { x.mods({ happiness: 5 }); x.train('humor', 2); return 'Dress code: bright colours. Playlist: upbeat. Speeches: under five minutes, strictly.'; } },
      { label: 'Keep it simple', tags: ['cautious'], scene: 'graveVisit', run: (x) => { pay(x, 1500); x.mods({ stress: -4, wisdom: 2 }); return 'A plain stone, a tree, a good poem. Nothing more is needed.'; } },
      { label: (x) => (x.year >= 2030 ? 'Become a tree' : 'Leave instructions for a scattering'), scene: 'gardening', run: (x) => { x.mods({ wisdom: 3, happiness: 3 }); return 'Back to the earth, near the place you were happiest.'; } },
    ],
  },
  {
    id: 'ag_facingMortality', cat: 'elder', minAge: 75, weight: 0.6, cooldown: 6, scene: 'calm',
    title: 'Thinking of the end',
    text: 'You catch yourself thinking about how much time is left. The thought is not as frightening as you expected.',
    choices: [
      { label: 'Find peace in it', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 5, anxiety: -6, stress: -5 }); return 'A good life, well lived. The rest is gratitude.'; } },
      { label: 'Laugh at it', tags: ['impulsive'], run: (x) => { x.train('humor', 2); x.mods({ happiness: 5, anxiety: -4 }); return '"At my age I do not buy green bananas." You say it to every grocer.'; } },
      { label: (x) => (x.stat('faith') >= 40 ? 'Turn to your faith' : 'Talk it through with someone'), tags: ['help'], scene: 'holy', run: (x) => { x.mods({ faith: 3, anxiety: -6, loneliness: -3 }); return 'Not answers, exactly, but company in the questions.'; } },
    ],
  },
  {
    id: 'ag_hospice', cat: 'elder', minAge: 70, weight: (x) => (x.stat('health') < 20 ? 1.4 : 0), cooldown: 3, scene: 'nursingHome',
    title: 'Comfort care',
    text: 'The doctors talk softly about comfort now, not cures. The room has flowers and a window onto the garden.',
    choices: [
      { label: 'Have family close', tags: ['social'], scene: 'family', run: (x) => { for (const r of x.rels('spouse', 'partner', 'child', 'grandchild').slice(0, 6)) x.relMod(r.npcId, 6, 4); x.mods({ loneliness: -12, happiness: 6, pain: -6 }); return 'Hands held, stories told, a lot of quiet love in a small room.'; } },
      { label: 'Listen to your favourite music', tags: ['cautious'], scene: 'music', run: (x) => { x.mods({ happiness: 5, pain: -4, stress: -6 }); return 'Every song a memory. You hum along and drift.'; } },
      { label: 'Ask for your faith leader', tags: ['help'], scene: 'holy', run: (x) => { x.mods({ faith: 5, anxiety: -8 }); return 'A calm voice, an old prayer, and a deep sense of being held.'; } },
    ],
  },
  {
    id: 'ag_centenarian', cat: 'elder', minAge: 99, weight: (x) => (x.age >= 99 ? 4 : 0), once: true, scene: 'birthday',
    title: 'One hundred',
    text: (x) => (x.year >= 1900 ? 'A letter of congratulations from the head of state arrives for your hundredth birthday. Reporters want your secret.' : 'The whole village gathers. Nobody has ever met anyone this old.'),
    choices: [
      { label: 'Credit clean living', tags: ['cautious'], run: (x) => { x.mods({ happiness: 8, fame: 3 }); return '"Early nights and vegetables." Nobody believed you. You winked.'; } },
      { label: 'Credit a daily vice', tags: ['impulsive'], run: (x) => { x.mods({ happiness: 8, fame: 5 }); x.story('puff', `Centenarian credits ${x.pick(['a daily whisky', 'chocolate cake', 'never apologising', 'spite'])} for long life`, 70); return 'Your quote went everywhere. The cake people sent you a year\'s supply.'; } },
      { label: 'Credit the people you love', tags: ['social'], scene: 'family', run: (x) => { x.mods({ happiness: 10, loneliness: -8 }); return 'Five generations in one room, singing badly. That is the secret.'; } },
    ],
  },
  {
    id: 'ag_drivingLicence', cat: 'elder', minAge: 78, years: [1920, 2060], weight: 0.6, once: true, scene: 'car',
    title: 'Car keys',
    text: 'You clipped a bin, a hedge and very nearly a postman. Your children want to talk about the car.',
    choices: [
      { label: 'Hand over the keys', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 3, happiness: -3, loneliness: 2 }); return 'It stung. Your bus pass has opened up a lively new social life, though.'; } },
      { label: 'Retake the test', tags: ['ambitious'], run: (x) => { if (check(x, x.stat('smarts') + x.stat('dexterity') / 2, 70)) { x.mods({ confidence: 5 }); return 'Passed! You drove home at exactly the speed limit, smugly.'; } x.mods({ happiness: -4 }); return 'Failed on the reversing. Fair enough. Keys handed over.'; } },
      { label: 'Refuse outright', tags: ['impulsive'], run: (x) => { const c = x.rels('child')[0]; if (c) x.relMod(c.npcId, -4); x.mods({ ego: 2 }); return 'A family stand-off. The car mysteriously developed a flat battery.'; } },
    ],
  },
  {
    id: 'ag_adviceSought', cat: 'elder', minAge: 65, weight: 0.5, cooldown: 4, scene: 'grandparents',
    title: 'Words of wisdom',
    text: 'A young person at the bus stop asks what you wish you had known at their age.',
    choices: [
      { label: 'Give sincere advice', tags: ['help'], run: (x) => { x.train('mentoring', 2); x.mods({ wisdom: 2, happiness: 4, karma: 2 }); return '"Worry less, call your mother, and be kind; nobody remembers the rest." They wrote it down.'; } },
      { label: 'Give terrible advice', tags: ['impulsive'], run: (x) => { x.train('humor', 2); x.mods({ happiness: 4 }); return '"Never trust a man with two first names." They nodded gravely.'; } },
      { label: 'Ask them for advice', tags: ['social'], run: (x) => { x.mods({ smarts: 1, loneliness: -3 }); return 'They taught you three new words. You will use them wrong at dinner.'; } },
    ],
  },
  {
    id: 'ag_kidsTheseDays', cat: 'elder', minAge: 65, weight: 0.4, cooldown: 5, scene: 'aging',
    title: 'Kids these days',
    text: (x) => `Young people are ${x.year >= 2000 ? 'staring at screens' : x.year >= 1950 ? 'dancing to that noisy music' : 'wearing such scandalous hats'}. You feel a rant coming on.`,
    choices: [
      { label: 'Rant to the neighbours', tags: ['impulsive'], run: (x) => { x.mods({ ego: 2, popularity: -1 }); return 'Your parents said the same about you. You chose not to remember this.'; } },
      { label: 'Try it yourself', tags: ['social'], scene: 'party', run: (x) => { x.mods({ happiness: 5, confidence: 2 }); return 'You tried it. Grudgingly, it is quite fun. Do not tell anyone.'; } },
      { label: 'Remember being young', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 3, empathy: 2 }); return 'Every generation is frightened of the next and then turns out fine.'; } },
    ],
  },
  {
    id: 'ag_earlyRiser', cat: 'senior', minAge: 62, weight: 0.4, once: true, scene: 'calm',
    title: '5 a.m. club',
    text: 'You now wake at five without an alarm, which you used to consider a medical emergency.',
    choices: [
      { label: 'Watch the sunrise', tags: ['cautious'], run: (x) => { x.mods({ happiness: 4, stress: -4 }); return 'The world belongs to you and the birds for an hour. You see why old people love this.'; } },
      { label: 'Early swim', tags: ['ambitious'], scene: 'beach', run: (x) => { x.train('swimming', 3); x.mods({ fitness: 3 }); return 'The cold water crowd welcomed you with thermos tea and loud opinions.'; } },
      { label: 'Phone a sleeping relative', tags: ['impulsive'], run: (x) => { x.mods({ happiness: 2 }); return '"Were you asleep?" You know they were. Revenge for their teenage years.'; } },
    ],
  },
  {
    id: 'ag_parkChess', cat: 'senior', minAge: 60, weight: 0.4, cooldown: 5, scene: 'friends',
    title: 'Park chess',
    text: 'An old man in the park has beaten everyone at chess for eleven years. He nods at the empty seat.',
    choices: [
      { label: 'Sit down and play', tags: ['ambitious'], run: (x) => { x.train('logic', 3); if (check(x, x.stat('smarts'), 70)) { x.mods({ ego: 4, happiness: 5 }); return 'Checkmate in thirty moves. The whole park went silent. He shook your hand.'; } x.mods({ happiness: 2, loneliness: -4 }); return 'Lost horribly. Came back tomorrow. It is a friendship now.'; } },
      { label: 'Watch and learn', tags: ['cautious'], run: (x) => { x.train('logic', 1); x.mods({ loneliness: -3 }); return 'He narrates his moves like a war general. It is better than television.'; } },
      { label: 'Challenge him to dominoes', tags: ['social'], run: (x) => { x.mods({ happiness: 3, loneliness: -4 }); return 'Turns out he is terrible at dominoes. A rivalry is born.'; } },
    ],
  },
  {
    id: 'ag_teaDance', cat: 'senior', minAge: 60, weight: 0.4, cooldown: 5, scene: 'dance',
    title: 'Afternoon dance',
    text: 'The community hall runs an afternoon dance. The band is old, the floor is sprung and the cakes are home-made.',
    choices: [
      { label: 'Dance every dance', tags: ['social'], run: (x) => { x.train('dance', 3); x.mods({ fitness: 2, happiness: 6, loneliness: -6 }); return 'You waltzed with five people and a mop. Glorious.'; } },
      { label: 'Run the cake stall', tags: ['help'], scene: 'cooking', run: (x) => { x.train('baking', 3); x.mods({ popularity: 3, happiness: 4 }); return 'Your lemon drizzle sold out in nine minutes. Legendary.'; } },
      { label: 'Sit and tap your foot', tags: ['cautious'], run: (x) => { x.mods({ happiness: 3 }); return 'The music took you right back. You hummed all the way home.'; } },
    ],
  },
  {
    id: 'ag_gardenElder', cat: 'senior', minAge: 60, weight: 0.4, cooldown: 4, scene: 'gardening',
    title: 'Allotment',
    text: 'A plot has come free at the allotments. The waiting list was four years long.',
    choices: [
      { label: 'Grow vegetables', tags: ['cautious'], run: (x) => { x.train('farming', 3); x.mods({ fitness: 2, happiness: 5, stress: -4 }); return 'Your marrows are enormous. A rival is suspicious of your methods.'; } },
      { label: 'Grow flowers', run: (x) => { x.mods({ happiness: 6, creativity: 2 }); return 'Sweet peas and dahlias. You give armfuls away to strangers.'; } },
      { label: 'Enter the village show', tags: ['ambitious'], scene: 'festival', run: (x) => { x.mods({ ego: 3, popularity: 2 }); return x.chance(0.4) ? 'First prize for your onions! You framed the rosette.' : 'Second to the rival. This is war.'; } },
    ],
  },
  {
    id: 'ag_familyTree', cat: 'senior', minAge: 55, weight: 0.35, once: true, scene: 'library',
    title: 'Family tree',
    text: 'You start digging into your ancestors. It turns out your great-grandmother was quite a character.',
    choices: [
      { label: 'Dig deeper', tags: ['ambitious'], run: (x) => { x.train('history', 4); x.mods({ smarts: 2, happiness: 4 }); return `Records from ${x.countryName}, a ship's manifest, and a scandal involving a goat. Wonderful.`; } },
      { label: (x) => (x.year >= 2010 ? 'Take a DNA test' : 'Write to distant cousins'), tags: ['social'], run: (x) => { x.mods({ loneliness: -4, happiness: 3 }); return 'You have forty-seven new cousins. One sends Christmas cards in July.'; } },
      { label: 'Leave the dead in peace', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 1 }); return 'Some mysteries are best left as stories.'; } },
    ],
  },
  {
    id: 'ag_oldPhotos', cat: 'senior', minAge: 55, weight: 0.4, cooldown: 6, scene: 'reading',
    title: 'Old photographs',
    text: 'A shoebox of old photographs. Everyone in them is so young, and some are long gone.',
    choices: [
      { label: 'Label them for the family', tags: ['help'], run: (x) => { x.mods({ wisdom: 2, happiness: 3 }); return 'Names, dates, and the occasional note: "Do NOT ask about this hat."'; } },
      { label: 'Have a good cry', tags: ['cautious'], run: (x) => { x.mods({ depression: -2, empathy: 2 }); return 'Happy tears, mostly. What a lot of life there has been.'; } },
      { label: 'Share them online', tags: ['social'], when: (x) => x.year >= 2008, scene: 'internet', run: (x) => { x.mods({ loneliness: -4, popularity: 2 }); return 'Old schoolmates found you. The comments section is now a reunion.'; } },
    ],
  },
  {
    id: 'ag_siblingReconnect', cat: 'senior', minAge: 55, weight: 0.4, cooldown: 8, scene: 'reunion',
    bind: (x) => { const s = x.rels('sibling').sort((a, b) => a.affinity - b.affinity)[0]; return s ? { npcId: s.npcId } : null; },
    title: 'Old siblings',
    text: (x) => `You and ${who(x)} have not really talked in years. Neither of you remembers exactly why.`,
    choices: [
      { label: 'Call them', tags: ['help'], run: (x) => { x.relMod(npcId(x), 12, 8); x.mods({ happiness: 5, loneliness: -5 }); return `${who(x)} answered on the second ring. "I was going to call you." You talked for three hours.`; } },
      { label: 'Send a photo from childhood', tags: ['cautious'], scene: 'loveLetter', run: (x) => { x.relMod(npcId(x), 7, 4); x.mods({ happiness: 3 }); return 'Two kids in terrible haircuts. The reply was just: "Lunch?"'; } },
      { label: 'Leave it', run: (x) => { x.mods({ loneliness: 2 }); return 'Maybe next year. There may not be many next years.'; } },
    ],
  },
  {
    id: 'ag_heirloom', cat: 'elder', minAge: 65, weight: (x) => (x.rels('child', 'grandchild').length ? 0.4 : 0), once: true, scene: 'jewelry',
    bind: (x) => { const r = x.rels('grandchild', 'child').sort((a, b) => b.affinity - a.affinity)[0]; return r ? { npcId: r.npcId } : null; },
    title: 'The heirloom',
    text: (x) => `You have a ${x.pick(['pocket watch', 'ring', 'brooch', 'carved box'])} that has been in the family for generations. It is time to pass it on to ${who(x)}.`,
    choices: [
      { label: 'Give it with its story', tags: ['help'], run: (x) => { x.relMod(npcId(x), 10, 6); x.mods({ happiness: 6 }); return `${who(x)} listened to every word, then promised to tell the story to their own children.`; } },
      { label: 'Hide it in a treasure hunt', tags: ['impulsive'], run: (x) => { x.relMod(npcId(x), 8); x.mods({ happiness: 5, creativity: 2 }); return 'Six clues around the house. They found it under the third stair, laughing.'; } },
      { label: 'Keep it a little longer', tags: ['cautious'], run: (x) => { x.mods({ happiness: 1 }); return 'Not yet. You like to hold it while you watch the evening news.'; } },
    ],
  },
  {
    id: 'ag_spiritualElder', cat: 'elder', minAge: 70, weight: 0.4, cooldown: 6, scene: 'holy',
    title: 'Big questions',
    text: 'You find yourself drawn back to the faith of your childhood, or to questions it never answered.',
    choices: [
      { label: 'Return to services', tags: ['social'], run: (x) => { x.mods({ faith: 6, loneliness: -5 }); x.train('prayer', 2); return 'The old hymns, the old pews, and new friends in the back row.'; } },
      { label: 'Read widely', tags: ['cautious'], scene: 'library', run: (x) => { x.train('philosophy', 3); x.mods({ wisdom: 4 }); return 'Every tradition, every century, asking the same questions. Comforting.'; } },
      { label: 'Find awe in nature', scene: 'stargazing', run: (x) => { x.mods({ happiness: 4, stress: -5 }); return 'A night sky full of stars is all the cathedral you need.'; } },
    ],
  },
  {
    id: 'ag_lastJourney', cat: 'elder', minAge: 75, weight: 0.4, once: true, scene: 'travel',
    title: 'Where you began',
    text: 'You want to go back, one more time, to the town where you were born.',
    choices: [
      { label: 'Go with family', tags: ['social'], scene: 'roadTrip', run: (x) => { pay(x, 800); const c = x.rels('child', 'grandchild')[0]; if (c) x.relMod(c.npcId, 6); x.mods({ happiness: 7 }); return 'You pointed out every corner: "That is where I fell off a wall. That is where I met your grandmother."'; } },
      { label: 'Go alone', tags: ['cautious'], run: (x) => { pay(x, 500); x.mods({ wisdom: 4, happiness: 4 }); return 'The old house had a new red door. A child waved from the window. Life goes on.'; } },
      { label: 'Visit in your mind', run: (x) => { x.mods({ happiness: 2 }); return 'You closed your eyes and walked the streets as they were. Perfect, as memory always is.'; } },
    ],
  },
  {
    id: 'ag_livingAlone', cat: 'elder', minAge: 70, weight: (x) => (!x.lover() && !x.flag('inCare') ? 0.6 : 0), cooldown: 5, scene: 'lonely',
    title: 'Table for one',
    text: 'You still set two cups out sometimes, from habit. The house is very quiet.',
    choices: [
      { label: 'Join a lunch club', tags: ['social'], scene: 'restaurant', run: (x) => { x.mods({ loneliness: -10, happiness: 4 }); return 'Tuesday lunches with eight loud strangers who became friends.'; } },
      { label: 'Adopt an older cat', tags: ['help'], scene: 'petCat', run: (x) => { x.mods({ loneliness: -8, happiness: 5 }); return 'You visited the shelter and met a grumpy old tom. You are a perfect match.'; } },
      { label: 'Enjoy the quiet', tags: ['cautious'], scene: 'reading', run: (x) => { x.mods({ stress: -4 }); return 'Books, radio, your own schedule. Solitude, chosen, can be sweet.'; } },
    ],
  },
  {
    id: 'ag_pneumonia', cat: 'elder', minAge: 72, weight: (x) => (x.stat('health') < 55 ? 0.6 : 0.25), cooldown: 5, scene: 'hospital',
    title: 'Chest infection',
    text: 'A cold has gone to your chest and the doctor uses the word "pneumonia" in a careful voice.',
    choices: [
      { label: 'Go into hospital', tags: ['help'], run: (x) => { pay(x, 1500); x.mods({ health: x.year >= 1945 ? -2 : -8 }); return x.year >= 1945 ? 'Antibiotics and oxygen. You charmed every nurse on the ward.' : 'Weeks of mustard poultices and broth. You came through.'; } },
      { label: 'Recover at home', tags: ['cautious'], scene: 'sick', run: (x) => { x.mods({ health: -6, loneliness: -2 }); return 'Your family took turns at your bedside. Slowly, you mended.'; } },
    ],
  },
  {
    id: 'ag_seniorGames', cat: 'senior', minAge: 65, years: [1980, 2300], weight: (x) => (x.stat('fitness') >= 45 ? 0.5 : 0), cooldown: 5, scene: 'sports',
    title: 'Senior games',
    text: 'The over-65 games are recruiting. There is a 100-metre dash and a very competitive bowls tournament.',
    choices: [
      { label: 'Enter the sprint', tags: ['ambitious'], run: (x) => { x.train('running', 3); if (check(x, x.stat('fitness'), 60)) { x.mods({ happiness: 7, confidence: 5 }); return 'Gold medal, age group 65 to 69. You wear it to the shops.'; } x.mods({ pain: 4, happiness: 3 }); return 'Fourth, and a pulled hamstring. Totally worth it.'; } },
      { label: 'Join the bowls team', tags: ['social'], run: (x) => { x.mods({ loneliness: -6, happiness: 4 }); return 'Your team is called "The Rolling Stones". Nobody else finds this funny.'; } },
      { label: 'Volunteer as a judge', tags: ['help'], scene: 'volunteer', run: (x) => { x.mods({ karma: 2, ego: 2 }); return 'You disqualified your neighbour for a false start. Justice.'; } },
    ],
  },
  {
    id: 'ag_newFriendElder', cat: 'elder', minAge: 70, weight: (x) => (x.stat('loneliness') >= 40 ? 0.6 : 0.2), cooldown: 6, scene: 'friends',
    title: 'Never too old',
    text: 'At the library, someone your age is reaching for the same book. You both laugh.',
    choices: [
      { label: 'Suggest a coffee', tags: ['social'], run: (x) => { x.mods({ loneliness: -10, happiness: 5 }); return 'Coffee became lunch became a weekly ritual. New friends at your age are a gift.'; } },
      { label: 'Start a book club', tags: ['ambitious'], scene: 'reading', run: (x) => { x.mods({ loneliness: -8, popularity: 3 }); return 'Six members, mostly there for the biscuits and the gossip. Perfect.'; } },
      { label: 'Let them have the book', tags: ['cautious'], run: (x) => { x.mods({ karma: 1 }); return 'They thanked you warmly. You might see them again next week.'; } },
    ],
  },
  {
    id: 'ag_grandkidWedding', cat: 'elder', minAge: 68, weight: (x) => (x.rels('grandchild').some((r) => { const n = x.npc(r.npcId); return !!n && x.npcAge(n) >= 22; }) ? 0.4 : 0), cooldown: 8, scene: 'wedding',
    bind: (x) => { const r = x.rels('grandchild').find((g) => { const n = x.npc(g.npcId); return !!n && x.npcAge(n) >= 22; }); return r ? { npcId: r.npcId } : null; },
    title: 'A grandchild weds',
    text: (x) => `${who(x)} is getting married, and they have asked you to say a few words.`,
    choices: [
      { label: 'Give a heartfelt speech', tags: ['social'], run: (x) => { x.relMod(npcId(x), 8, 4); x.train('publicSpeaking', 2); x.mods({ happiness: 8 }); return 'Not a dry eye in the house, including the caterers.'; } },
      { label: 'Tell embarrassing stories', tags: ['impulsive'], scene: 'party', run: (x) => { x.relMod(npcId(x), 4); x.mods({ happiness: 7 }); return 'The bathtub story brought the house down. The groom wants details.'; } },
      { label: 'Dance with the couple', tags: ['cautious'], scene: 'dance', run: (x) => { x.relMod(npcId(x), 6); x.mods({ happiness: 7, fitness: 1 }); return 'You led the first dance after theirs. Your hip held. Mostly.'; } },
    ],
  },
  {
    id: 'ag_stillWorking', cat: 'elder', minAge: 72, weight: (x) => (x.employed ? 0.6 : 0), cooldown: 5, scene: 'office',
    title: 'Still at it',
    text: 'You are the oldest person at work by twenty years. Younger colleagues keep asking when you will retire.',
    choices: [
      { label: 'Never, it keeps me young', tags: ['ambitious'], run: (x) => { x.mods({ confidence: 3, professionalRep: 2 }); return 'Purpose is the best medicine. Also, the office has good biscuits.'; } },
      { label: 'Go part time', tags: ['cautious'], run: (x) => { x.mods({ stress: -6, happiness: 3 }); return 'Three days a week. Long weekends, every weekend.'; } },
      { label: 'Retire at last', tags: ['cautious'], scene: 'retirement', run: (x) => { x.c.retired = true; x.mods({ stress: -12, happiness: 5 }); x.remember('retired', 'Retired at last', 35); return 'They threw you a party and gave you a bench with your name on it. Lovely and a little ominous.'; } },
    ],
  },
  {
    id: 'ag_forgottenName', cat: 'senior', minAge: 60, weight: 0.5, cooldown: 4, scene: 'aging',
    title: 'Whatshisname',
    text: 'You meet an old acquaintance in the street and their name has completely left the building.',
    choices: [
      { label: 'Bluff warmly', tags: ['social'], run: (x) => { x.train('charm', 1); x.mods({ happiness: 2 }); return '"Hello, you!" Ten minutes of chat, zero names. A masterpiece.'; } },
      { label: 'Confess you forgot', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 1, loneliness: -2 }); return '"Oh thank goodness, I forgot yours too!" You both laughed for ages.'; } },
      { label: 'Run for it', tags: ['impulsive'], run: (x) => { x.mods({ fitness: 1, anxiety: 2 }); return 'You hid in a shoe shop. Bought shoes. Expensive escape.'; } },
    ],
  },
  {
    id: 'ag_mirrorNinety', cat: 'elder', minAge: 88, weight: 0.5, once: true, scene: 'aging',
    title: 'Ninety years',
    text: 'In the mirror you see an old person with your eyes. Inside, you still feel about twenty-five.',
    choices: [
      { label: 'Wink at them', tags: ['impulsive'], run: (x) => { x.mods({ happiness: 5 }); return 'The old person winked back. Cheeky. You like them.'; } },
      { label: 'Count your blessings', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 4, happiness: 4 }); return 'Ninety years of mornings. Each one was a gift, even the Mondays.'; } },
      { label: 'Tell a grandchild', tags: ['social'], scene: 'grandparents', run: (x) => { const g = grandkid(x); if (g) x.relMod(g.npcId, 5); x.mods({ happiness: 4 }); return '"You never stop feeling young inside." They did not believe you. They will.'; } },
    ],
  },
  {
    id: 'ag_retirementHobby', cat: 'senior', minAge: 60, weight: (x) => (x.c.retired ? 0.6 : 0.2), cooldown: 5, scene: 'painting',
    title: 'Late talent',
    text: 'You pick up a paintbrush for the first time in fifty years. It feels surprisingly natural.',
    choices: [
      { label: 'Paint every day', tags: ['ambitious'], run: (x) => { x.train('painting', 6); x.mods({ creativity: 5, happiness: 5 }); return 'Mostly ducks. Very good ducks. A café wants to hang them.'; } },
      { label: 'Join an art group', tags: ['social'], run: (x) => { x.train('painting', 4); x.mods({ loneliness: -6, happiness: 4 }); return 'Wednesday mornings, watercolours and cheerful bickering about perspective.'; } },
      { label: 'Gift your paintings', tags: ['help'], run: (x) => { x.mods({ karma: 2, happiness: 4 }); return 'Everyone you know now owns a duck. They are touched, and slightly overwhelmed.'; } },
    ],
  },
  {
    id: 'ag_cardiacRehab', cat: 'chain', triggered: true, scene: 'gym',
    title: 'Cardiac rehab',
    text: 'A year after your heart scare, the rehab nurse wants to see how you are doing on the treadmill.',
    choices: [
      { label: 'Give it your all', tags: ['ambitious'], run: (x) => { x.mods({ fitness: 4, health: 4, confidence: 3 }); return 'Your heart is stronger than it was before the scare. The nurse high-fived you.'; } },
      { label: 'Steady and careful', tags: ['cautious'], run: (x) => { x.mods({ fitness: 2, health: 3 }); return 'Slow and steady, which is exactly what the doctor ordered.'; } },
      { label: 'Skip the session', tags: ['impulsive'], run: (x) => { x.mods({ health: -3 }); return 'You went for a fry-up instead. Your cardiologist sighed down the phone.'; } },
    ],
  },
  {
    id: 'ag_heartCheckup', cat: 'chain', triggered: true, scene: 'checkup',
    title: 'Heart check',
    text: 'Three years on, the cardiologist reviews your scans with a little smile.',
    choices: [
      { label: 'Celebrate sensibly', tags: ['cautious'], run: (x) => { x.mods({ happiness: 5, anxiety: -5 }); return 'Your heart is in good shape. You celebrated with fruit salad. Mostly.'; } },
      { label: 'Thank the people who helped', tags: ['social'], scene: 'family', run: (x) => { x.mods({ happiness: 5, loneliness: -3 }); for (const r of x.rels('spouse', 'partner', 'child').slice(0, 3)) x.relMod(r.npcId, 4); return 'You made a speech at dinner. Everyone pretended not to cry.'; } },
    ],
  },
];

export const AGING_CHAINS: ChainDef[] = [
  {
    id: 'ag_heartRecovery',
    name: 'Second chance',
    desc: 'Surviving a heart scare starts a long road of rehab and check-ups.',
    steps: [
      { delay: 1, eventId: 'ag_cardiacRehab' },
      { delay: 3, eventId: 'ag_heartCheckup' },
    ],
  },
];
