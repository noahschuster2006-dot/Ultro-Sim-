import type { EventDef } from './types';
import { bindRel, check, has, npcId, poor, rich, who } from './helpers';
import { commitCrime } from '../systems/legal';
import { expose } from '../systems/addiction';
import { trauma } from '../systems/mind';
import { injure } from '../systems/body';
import { linkNpcs, makeNpc } from '../systems/npcs';
import { addCurse } from '../systems/spirit';
import { enroll } from '../systems/education';
import { HOBBIES } from '../data/occult';
import { countriesAvailable, countryName } from '../data/countries';
import { birthChild } from '../systems/relationships';
import { marry } from '../systems/relationships';

/** Birth, childhood (2–12) and teen (13–17) events. */
export const LIFE_EVENTS: EventDef[] = [
  // ------------------------------------------------------------------ infancy & triggered family events
  {
    id: 'younger_sibling', cat: 'birth', triggered: true,
    title: 'A new sibling', text: 'Your parents bring home a new baby.',
    auto: (x) => {
      const parents = x.rels('parent').map((r) => r.npcId);
      const sib = makeNpc(x, { age: 0, lastName: x.c.lastName, career: null, religionId: x.c.religionId, parentIds: parents });
      for (const p of parents) {
        x.npc(p)?.childIds.push(sib.id);
        linkNpcs(x, p, sib.id, 'family');
      }
      x.addRel(sib.id, 'sibling', { affinity: 60, trust: 60 });
      x.mod('confidence', -2);
      return `Meet ${sib.firstName}. You are no longer the baby of the family.`;
    },
  },
  {
    id: 'c_firstWords', cat: 'childhood', minAge: 1, maxAge: 2, once: true, weight: 4,
    title: 'First words', text: 'You said your first word today.',
    auto: (x) => {
      x.mod('smarts', 2);
      return x.pick(['"Mama!"', '"Dada!"', '"No!"', '"Mine!"', '"Dog!"']);
    },
  },
  {
    id: 'c_tantrum', cat: 'childhood', minAge: 2, maxAge: 5, weight: 2,
    title: 'Tantrum', text: 'You were denied a sweet at the market. Your face turns red.',
    choices: [
      { label: 'Scream until they give in', tags: ['impulsive'], run: (x) => { x.mods({ aggression: 2, discipline: -2 }); return x.chance(0.5) ? 'It worked. You learned something dangerous.' : 'You were carried out under one arm.'; } },
      { label: 'Sulk quietly', tags: ['cautious'], run: (x) => { x.mods({ discipline: 1, happiness: -1 }); return 'You sulked with dignity.'; } },
    ],
  },
  {
    id: 'c_imaginaryFriend', cat: 'childhood', minAge: 3, maxAge: 7, once: true, weight: 1.5,
    title: 'Imaginary friend', text: 'Your imaginary friend whispers about things that have not happened yet.',
    choices: [
      { label: 'Listen closely', run: (x) => { x.mods({ paranormal: 8, creativity: 3 }); x.remember('spiritChild', 'Had an imaginary friend who knew the future', 15); return 'Last week it predicted grandpa would fall. He did.'; } },
      { label: 'Tell it to go away', tags: ['cautious'], run: (x) => { x.mod('anxiety', 2); return 'It went quiet. Mostly.'; } },
    ],
  },
  {
    id: 'c_pet', cat: 'childhood', minAge: 4, maxAge: 12, once: true, weight: 1.5,
    title: 'A stray animal', text: 'A scruffy stray follows you home.',
    choices: [
      { label: 'Beg to keep it', run: (x) => { x.mods({ happiness: 8, empathy: 4, loneliness: -6 }); x.c.flags.pet = true; return 'Your parents relented. You have a best friend.'; } },
      { label: 'Chase it away', run: (x) => { x.mods({ empathy: -2 }); return 'It slunk back into the alleys.'; } },
    ],
  },
  {
    id: 'c_childhoodIllness', cat: 'health', minAge: 1, maxAge: 12, weight: (x) => (x.year < 1950 ? 2.5 : 0.6),
    title: 'Childhood fever', text: (x) => `You came down with ${x.year < 1900 ? 'a terrible fever' : 'a bad flu'}.`,
    auto: (x) => {
      const hit = x.year < 1900 ? x.int(8, 25) : x.int(3, 10);
      x.mods({ health: -hit, immunity: 3 });
      return hit > 18 ? 'For a week nobody knew if you would live.' : 'You recovered after a miserable week.';
    },
  },
  // ------------------------------------------------------------------ school & bullying
  {
    id: 'c_schoolBully', cat: 'childhood', minAge: 6, maxAge: 13, weight: (x) => 1.5 + (x.stat('popularity') < 40 ? 1.5 : 0), violent: true,
    title: 'The bully', text: (x) => `A bigger kid, ${who(x)}, has been taking your lunch money for weeks.`,
    bind: (x) => ({ npcId: makeNpc(x, { age: x.age + x.int(1, 3), career: null, aggression: 75, karma: -30 }).id }),
    choices: [
      { label: 'Fight back', tags: ['violent', 'impulsive'], run: (x) => {
        x.addRel(npcId(x), 'bully', { affinity: 15, trust: 5 });
        if (check(x, x.stat('fitness') + x.skill('streetFighting'), 60)) { x.mods({ confidence: 8, streetCred: 5, aggression: 3 }); x.remember('stoodUp', 'Stood up to a bully', 20); return 'You bloodied their nose. They never bothered you again.'; }
        x.mods({ health: -6, confidence: -5 }); trauma(x, 5, 'violence'); return 'You lost badly. Everyone saw.';
      } },
      { label: 'Tell a teacher', tags: ['cautious', 'help'], run: (x) => { x.addRel(npcId(x), 'bully', { affinity: 10, trust: 5 }); x.mods({ popularity: -4, anxiety: 2 }); return x.chance(0.5) ? 'The bully was expelled.' : 'Nothing happened, except now you are a snitch.'; } },
      { label: 'Endure it silently', run: (x) => { x.addRel(npcId(x), 'bully', { affinity: 10, trust: 5 }); trauma(x, 8, 'abuse'); x.mods({ anxiety: 6, confidence: -4 }); x.remember('bullied', `Was bullied by ${x.name(npcId(x))}`, 25, npcId(x)); return x.stat('resilience') > 55 ? 'It hardened you.' : 'It hollowed you out.'; } },
      { label: 'Try to befriend them', tags: ['social'], run: (x) => { if (check(x, x.stat('charisma'), 55)) { x.addRel(npcId(x), 'friend', { affinity: 50, trust: 40 }); x.train('persuasion', 4); return 'Somehow it worked. You are now friends with your tormentor.'; } x.addRel(npcId(x), 'bully'); x.mod('confidence', -3); return 'They laughed in your face.'; } },
    ],
  },
  {
    id: 'c_bullyOthers', cat: 'childhood', minAge: 7, maxAge: 14, weight: (x) => 1 + x.stat('aggression') / 40,
    title: 'An easy target', text: 'Your friends are picking on the new kid. They look at you.',
    choices: [
      { label: 'Join in', tags: ['violent'], run: (x) => { x.mods({ popularity: 5, empathy: -5, karma: -5, aggression: 3 }); x.remember('wasBully', 'Bullied a weaker kid', 15); return 'You laughed loudest of all.'; } },
      { label: 'Defend the new kid', tags: ['help'], run: (x) => { x.mods({ popularity: -3, empathy: 4, karma: 5, confidence: 2 }); const n = makeNpc(x, { age: x.age, career: null }); x.addRel(n.id, 'friend', { affinity: 70, trust: 70 }); x.remember('defended', `Defended ${n.firstName} from bullies`, 20, n.id); return `You made a loyal friend: ${n.firstName}.`; } },
      { label: 'Walk away', tags: ['cautious'], run: () => 'You kept your head down.' },
    ],
  },
  {
    id: 'c_exam', cat: 'childhood', minAge: 7, maxAge: 17, cooldown: 2, weight: (x) => (x.c.education.enrolled ? 2 : 0),
    title: 'Big exam', text: 'A major exam is coming up.',
    choices: [
      { label: 'Study hard', tags: ['ambitious'], run: (x) => { x.mods({ smarts: 3, discipline: 2, stress: 3 }); x.c.education.grades = Math.min(100, x.c.education.grades + 8); return 'You aced it.'; } },
      { label: 'Coast', run: (x) => { x.c.education.grades = Math.max(0, x.c.education.grades - 3); return 'A forgettable grade.'; } },
      { label: 'Cheat', tags: ['impulsive'], run: (x) => { x.mods({ karma: -3, riskTolerance: 2 }); if (x.chance(0.3)) { x.c.education.grades -= 15; x.mod('popularity', -3); return 'Caught! A zero and a call to your parents.'; } x.c.education.grades += 6; x.train('deception', 3); return 'Nobody noticed.'; } },
    ],
  },
  {
    id: 'c_eliteTutoring', cat: 'childhood', minAge: 5, maxAge: 12, once: true, weight: (x) => (rich(x) ? 3 : 0),
    title: 'Private tutors', text: 'Your parents offer to hire the finest private tutors.',
    choices: [
      { label: 'Accept', tags: ['ambitious'], run: (x) => { x.c.education.tutored = true; x.mods({ smarts: 6, discipline: 3, happiness: -2 }); x.train('literacy', 8); x.train('languages', 5); return 'Your evenings are now Latin declensions and long division.'; } },
      { label: 'Refuse — you want to play', run: (x) => { x.mods({ happiness: 3 }); return 'Your parents sigh.'; } },
    ],
  },
  {
    id: 'c_gifted', cat: 'childhood', minAge: 6, maxAge: 11, once: true, weight: (x) => (x.stat('smarts') > 72 ? 3 : 0),
    title: 'Gifted', text: 'Testing shows you are exceptionally gifted.',
    choices: [
      { label: 'Join the gifted program', tags: ['ambitious'], run: (x) => { x.mods({ smarts: 6, popularity: -4, stress: 3 }); x.train('mathematics', 6); return 'You skip a grade. Older kids eye you warily.'; } },
      { label: 'Stay with your friends', run: (x) => { x.mods({ popularity: 3 }); return 'You stayed put.'; } },
    ],
  },
  {
    id: 'c_hobby', cat: 'childhood', minAge: 5, maxAge: 13, cooldown: 4, weight: (x) => (x.c.hobbies.length < 2 ? 3 : 0.5),
    title: 'A new interest', text: 'Something catches your attention. What do you throw yourself into?',
    choices: HOBBIES.map((h) => ({
      label: h.name,
      when: (x) => x.year >= h.fromYear && !x.c.hobbies.includes(h.id),
      run: (x) => {
        x.c.hobbies.push(h.id);
        for (const sk of h.skills) x.train(sk, 8);
        if (h.id === 'sports' || h.id === 'martialArts') x.mod('fitness', 4);
        if (h.id === 'streetLife') x.mods({ streetCred: 5, riskTolerance: 4 });
        if (h.id === 'faith') x.mod('faith', 6);
        if (h.id === 'gaming') x.mods({ happiness: 4, fitness: -2 });
        x.remember(`hobby_${h.id}`, `Fell in love with ${h.name.toLowerCase()}`, 12);
        return `You spend every spare hour on ${h.name.toLowerCase()}.`;
      },
    })),
  },
  {
    id: 'c_sportsInjury', cat: 'childhood', minAge: 9, maxAge: 16, once: true, weight: (x) => (x.c.hobbies.includes('sports') ? 1.5 : 0),
    title: 'Injury on the field', text: 'You went down hard in a match and something popped.',
    choices: [
      { label: 'Quit sports for good', tags: ['cautious'], run: (x) => { x.c.hobbies = x.c.hobbies.filter((h) => h !== 'sports'); x.c.flags.athleticRegret = true; x.remember('quitSports', 'Quit sports after an injury', 20); return 'You hung up your boots. Sometimes you wonder what might have been.'; } },
      { label: 'Rehab and come back', tags: ['ambitious'], run: (x) => { x.mods({ willpower: 5, discipline: 3 }); if (x.chance(0.2)) return `It never healed right: ${injure(x, false, 'badBones')}`; return 'You came back stronger.'; } },
    ],
  },
  // ------------------------------------------------------------------ crime & danger in the neighborhood
  {
    id: 'c_witnessCrime', cat: 'childhood', minAge: 6, maxAge: 13, weight: (x) => x.w.crimeRate / 30,
    title: 'You saw something', text: 'From your window you watch a man being robbed in the street.',
    choices: [
      { label: 'Tell the police', tags: ['help'], run: (x) => { x.mods({ karma: 4, anxiety: 2 }); x.c.flags.policeContact = true; return 'An officer took your statement and gave you a sticker.'; } },
      { label: 'Stay silent', tags: ['cautious'], run: (x) => { x.mod('streetCred', 2); return 'Snitches get stitches. Everyone knows that.'; } },
      { label: 'Run out to help', tags: ['impulsive', 'help'], run: (x) => { x.mods({ karma: 6, confidence: 4 }); if (x.chance(0.2)) { x.mod('health', -8); return 'The robber shoved you aside. You still helped the man up.'; } return 'The robber fled. The man pressed a coin into your hand.'; } },
    ],
  },
  {
    id: 'c_witnessMurder', cat: 'childhood', minAge: 6, maxAge: 12, once: true, violent: true, weight: (x) => (x.w.crimeRate > 50 || x.w.war !== 'none' ? 0.6 : 0.1),
    title: 'Something you cannot unsee', text: 'You witnessed a killing. Nobody knows you saw it.',
    choices: [
      { label: 'Tell a trusted adult', tags: ['help'], run: (x) => { trauma(x, 15, 'violence'); x.mod('resilience', 3); return 'They held you while you cried. It helped, a little.'; } },
      { label: 'Bury it deep', run: (x) => { trauma(x, 25, 'violence'); x.c.flags.unprocessedViolence = true; x.mods({ aggression: 5, empathy: -3 }); x.remember('sawMurder', 'Saw a murder as a child and told no one', 45); return 'You never spoke of it. It speaks to you at night.'; } },
    ],
  },
  {
    id: 'c_gangRecruit', cat: 'childhood', minAge: 10, maxAge: 15, weight: (x) => (poor(x) ? 1 : 0.2) * (x.w.crimeRate / 40),
    title: 'The corner boys', text: 'Older kids from the block offer you $20 to watch for police.',
    choices: [
      { label: 'Take the money', tags: ['impulsive'], run: (x) => { x.money(20); x.mods({ streetCred: 8, karma: -3, riskTolerance: 4 }); x.train('streetwise', 8); x.c.flags.criminalContact = true; x.remember('lookout', 'Worked as a lookout for a street crew', 20); return 'Easy money. They say there is more where that came from.'; } },
      { label: 'Say no', tags: ['cautious'], run: (x) => { x.mod('discipline', 2); return 'They shrugged and found another kid.'; } },
    ],
  },
  {
    id: 'c_childLabor', cat: 'childhood', minAge: 7, maxAge: 14, weight: (x) => (x.year >= 1760 && x.year < 1920 && poor(x) ? 3 : x.c.flags.noSchooling ? 2 : 0),
    title: 'Put to work', text: (x) => (x.year >= 1760 ? 'Your family needs the money. You are sent to the mill.' : 'Your family needs another pair of hands in the fields.'),
    choices: [
      { label: 'Work hard', run: (x) => { x.money(x.int(40, 150)); x.mods({ discipline: 4, health: -3, happiness: -3 }); x.train(x.year >= 1760 ? 'mechanics' : 'farming', 6); if (x.chance(0.08)) return `A machine caught your hand: ${injure(x, false, 'lostFingers')}`; return 'Twelve-hour days. You bring home every penny.'; } },
      { label: 'Steal from the boss', tags: ['impulsive'], run: (x) => { const r = commitCrime(x, 'shoplift'); return r.text; } },
    ],
  },
  // ------------------------------------------------------------------ family & home
  {
    id: 'c_parentsDivorce', cat: 'childhood', minAge: 3, maxAge: 16, once: true, weight: (x) => (x.year > 1960 ? 1.5 : 0.3) * (x.c.familyHealth === 'loving' ? 0.4 : 1.5),
    when: (x) => x.rels('parent').length === 2,
    title: 'Divorce', text: 'Your parents sit you down. They are splitting up.',
    choices: [
      { label: 'Side with mom', run: (x) => { const [a, b] = x.rels('parent'); x.relMod(a.npcId, 8); x.relMod(b.npcId, -12); trauma(x, 8, 'loss'); return 'You moved out with her.'; } },
      { label: 'Side with dad', run: (x) => { const [a, b] = x.rels('parent'); x.relMod(b.npcId, 8); x.relMod(a.npcId, -12); trauma(x, 8, 'loss'); return 'You stayed with him.'; } },
      { label: 'Refuse to choose', tags: ['cautious'], run: (x) => { trauma(x, 6, 'loss'); x.mod('resilience', 3); return 'You split your weeks between two houses.'; } },
    ],
  },
  {
    id: 'c_parentJailed', cat: 'childhood', minAge: 3, maxAge: 16, once: true, weight: (x) => (poor(x) ? 0.6 : 0.15) + (x.s.dynasty.reputation.criminal > 60 ? 1 : 0),
    bind: bindRel('parent'),
    title: 'A parent arrested', text: (x) => `Police took ${who(x)} away in handcuffs.`,
    auto: (x) => {
      trauma(x, 12, 'loss');
      x.relMod(npcId(x), -5);
      x.c.flags.distrustAuthority = true;
      x.mods({ streetCred: 3, anxiety: 5 });
      const n = x.npc(npcId(x));
      if (n) n.notes.push(`Imprisoned when ${x.c.firstName} was ${x.age}`);
      x.remember('parentJailed', `${who(x)} went to prison`, 30, npcId(x));
      return 'You learned early that the police are not your friends.';
    },
  },
  {
    id: 'c_domesticViolence', cat: 'childhood', minAge: 3, maxAge: 17, violent: true, weight: (x) => (x.c.familyHealth === 'abusive' ? 4 : x.c.familyHealth === 'alcoholic' ? 2 : 0),
    bind: bindRel('parent'),
    title: 'Shouting downstairs', text: (x) => `${who(x)} is drunk and violent again.`,
    choices: [
      { label: 'Hide in your room', tags: ['cautious'], run: (x) => { trauma(x, 8, 'abuse'); x.mod('anxiety', 4); return 'You put a pillow over your head.'; } },
      { label: 'Step between them', tags: ['violent', 'help'], run: (x) => { trauma(x, 6, 'abuse'); x.mods({ confidence: 4, aggression: 4, health: -5 }); x.relMod(npcId(x), -15); return 'You took a blow meant for someone else.'; } },
      { label: 'Tell a teacher', tags: ['help'], run: (x) => { trauma(x, 4, 'abuse'); x.relMod(npcId(x), -20); if (x.year > 1970 && x.chance(0.5)) { x.c.familyHealth = 'absent'; return 'Social services got involved. Things are quieter now.'; } return 'The teacher said it was a family matter.'; } },
    ],
  },
  {
    id: 'c_familyRuin', cat: 'childhood', minAge: 3, maxAge: 17, once: true, weight: (x) => (x.w.economy < 35 ? 2 : 0.2) * (x.c.familyStatus === 'destitute' ? 0 : 1),
    title: 'Ruin', text: 'Your parents lost everything. The house is being repossessed.',
    auto: (x) => {
      const order = ['destitute', 'poor', 'working', 'middle', 'wealthy', 'aristocracy', 'royalty'] as const;
      const i = order.indexOf(x.c.familyStatus);
      if (i > 0 && x.c.familyStatus !== 'royalty') x.c.familyStatus = order[i - 1];
      trauma(x, 10, 'ruin');
      x.remember('familyRuin', 'Watched my family lose everything', 30);
      return `Your family is now ${x.c.familyStatus}.`;
    },
  },
  {
    id: 'c_emigrate', cat: 'childhood', minAge: 2, maxAge: 16, once: true, weight: (x) => (x.w.war !== 'none' || x.w.stability < 30 ? 1.5 : 0.15),
    title: 'Leaving home', text: (x) => (x.w.war !== 'none' ? 'War is coming. Your family packs what it can carry.' : 'Your parents announce the family is emigrating.'),
    bind: (x) => {
      const opts = countriesAvailable(x.year).filter((c) => c.id !== x.c.countryId);
      const target = x.weighted(opts, (c) => (x.s.world.contexts[c.id]?.stability ?? 50) + (x.s.world.contexts[c.id]?.economy ?? 50));
      return target ? { country: target.id } : null;
    },
    choices: [
      { label: (x) => `Go with them to ${countryName(x.p.country as string, x.year)}`, run: (x) => {
        x.c.countryId = x.p.country as string;
        x.mods({ loneliness: 10, resilience: 4, anxiety: 4 });
        x.train('languages', 10);
        x.remember('emigrated', `Emigrated to ${countryName(x.c.countryId, x.year)} as a child`, 35);
        return 'A new language, a new school, a new life.';
      } },
    ],
  },
  {
    id: 'c_siblingRivalry', cat: 'childhood', minAge: 5, maxAge: 17, weight: (x) => (has(x, 'sibling') ? 1.5 : 0),
    bind: bindRel('sibling'),
    title: 'Sibling rivalry', text: (x) => `${who(x)} always seems to get the praise.`,
    choices: [
      { label: 'Outshine them', tags: ['ambitious'], run: (x) => { x.mods({ discipline: 3, confidence: check(x, x.stat('smarts'), 50) ? 4 : -4 }); x.relMod(npcId(x), -5); return 'The competition made you sharper.'; } },
      { label: 'Team up instead', tags: ['social'], run: (x) => { x.relMod(npcId(x), 12, 8); return 'Together you were unstoppable.'; } },
      { label: 'Sabotage them', tags: ['impulsive'], run: (x) => { x.relMod(npcId(x), -20, -15); x.mods({ karma: -4, aggression: 2 }); x.remember('sabotagedSibling', `Sabotaged ${who(x)}`, 15, npcId(x)); return 'They know it was you. They will remember.'; } },
    ],
  },
  {
    id: 'c_protector', cat: 'childhood', minAge: 5, maxAge: 14, once: true,
    when: (x) => x.rels('sibling').some((r) => x.npcAge(x.npc(r.npcId)!) > x.age + 2),
    bind: (x) => { const r = x.rels('sibling').find((q) => x.npcAge(x.npc(q.npcId)!) > x.age + 2); return r ? { npcId: r.npcId } : null; },
    title: 'Big sibling', text: (x) => `When the neighborhood kids came for you, ${who(x)} stepped in.`,
    auto: (x) => { x.relMod(npcId(x), 15, 15); x.mods({ anxiety: -4, confidence: 3 }); x.c.flags.protected = true; return 'Nobody touches you now.'; },
  },
  {
    id: 'c_favoritism', cat: 'childhood', minAge: 6, maxAge: 16, once: true, weight: (x) => (x.rels('sibling').length >= 2 ? 1 : 0),
    bind: bindRel('sibling'),
    title: 'The favorite', text: (x) => `It is obvious your parents love ${who(x)} more.`,
    auto: (x) => { x.mods({ confidence: -5, loneliness: 4 }); x.relMod(npcId(x), -8); return 'You stop expecting much from them.'; },
  },
  {
    id: 'c_grandparentStory', cat: 'childhood', minAge: 6, maxAge: 14, once: true, weight: (x) => (has(x, 'grandparent') ? 1.5 : 0),
    bind: bindRel('grandparent'),
    title: 'Family history', text: (x) => `${who(x)} tells you stories about the ${x.s.dynasty.name} family.`,
    auto: (x) => {
      x.mods({ wisdom: 3, happiness: 2 });
      x.relMod(npcId(x), 8);
      const D = x.s.dynasty;
      if (D.members.length) {
        const m = x.pick(D.members);
        return `They tell you about ${m.name}, who was ${m.title.toLowerCase()} and died of ${m.cause}.`;
      }
      return 'They talk about hard winters and harder people.';
    },
  },
  {
    id: 'c_warChildhood', cat: 'childhood', minAge: 3, maxAge: 16, violent: true, weight: (x) => (x.w.war === 'world' || x.w.war === 'major' ? 3 : 0),
    title: 'The war comes home', text: (x) => (x.year > 1900 ? 'Sirens wail. Bombs fall on the city.' : 'Soldiers march through your village, taking what they want.'),
    choices: [
      { label: 'Shelter with your family', tags: ['cautious'], run: (x) => { trauma(x, 12, 'combat'); return 'You survived the night. Not everyone on your street did.'; } },
      { label: 'Run messages for the defenders', tags: ['ambitious'], run: (x) => { trauma(x, 15, 'combat'); x.mods({ resilience: 5, confidence: 4, karma: 3 }); x.remember('warChild', 'Ran messages during the war as a child', 30); return 'You saw too much, too young. But you were brave.'; } },
    ],
  },
  {
    id: 'c_royalEducation', cat: 'childhood', minAge: 6, maxAge: 14, once: true, weight: (x) => (x.c.familyStatus === 'royalty' ? 5 : 0),
    title: 'Court education', text: 'Tutors drill you in etiquette, history and statecraft.',
    choices: [
      { label: 'Excel', tags: ['ambitious'], run: (x) => { x.train('etiquette', 12); x.train('diplomacy', 8); x.train('history', 8); x.mods({ discipline: 4 }); return 'The court whispers that you would make a fine ruler.'; } },
      { label: 'Rebel against the stuffiness', tags: ['impulsive'], run: (x) => { x.mods({ creativity: 4, popularity: 4, publicImage: -3 }); return 'The tabloids love you. The court does not.'; } },
    ],
  },
  // ------------------------------------------------------------------ faith & the supernatural
  {
    id: 'c_religiousSchool', cat: 'childhood', minAge: 6, maxAge: 11, once: true, weight: (x) => (x.c.religionId !== 'none' ? 1.5 : 0),
    title: 'Religious school', text: 'Your parents want you to attend religious instruction.',
    choices: [
      { label: 'Embrace it', run: (x) => {
        x.mods({ faith: 12, discipline: 3 });
        x.train('scripture', 8);
        const mentor = makeNpc(x, { age: x.int(35, 65), career: 'cleric', careerLevel: 4, religionId: x.c.religionId, karma: x.chance(0.85) ? 40 : -50 });
        x.addRel(mentor.id, 'mentor', { affinity: 60, trust: 60 });
        x.remember('religiousMentor', `Mentored by ${x.name(mentor)}`, 20, mentor.id);
        if (mentor.karma < 0) x.c.flags.badClergy = mentor.id;
        return `${mentor.firstName} ${mentor.lastName} takes a special interest in you.`;
      } },
      { label: 'Daydream through it', run: (x) => { x.mod('faith', 2); return 'You learned the songs, not the meaning.'; } },
    ],
  },
  {
    id: 'c_questionFaith', cat: 'childhood', minAge: 9, maxAge: 16, once: true, weight: (x) => (x.c.religionId !== 'none' ? 1 : 0),
    title: 'Big questions', text: 'You start wondering whether any of it is true.',
    choices: [
      { label: 'Keep questioning', run: (x) => { x.mods({ faith: -12, smarts: 2 }); x.train('logic', 5); return 'You read everything you can find.'; } },
      { label: 'Seek answers in prayer', run: (x) => { x.mods({ faith: 8 }); x.train('prayer', 5); return 'A calm settles over you.'; } },
    ],
  },
  {
    id: 'c_nearDeath', cat: 'spiritual', minAge: 4, maxAge: 10, once: true, weight: 0.35,
    title: 'Near-death experience', text: 'You nearly drowned. For a moment, everything went white.',
    choices: [
      { label: 'You saw a light', run: (x) => { x.mods({ faith: 15, divineFavor: 5 }); x.remember('nde', 'Saw the light in a near-death experience', 40); return 'You came back certain there is something beyond.'; } },
      { label: 'You saw… others', run: (x) => { x.mods({ paranormal: 18, anxiety: 4 }); x.remember('nde', 'Saw spirits in a near-death experience', 40); return 'Since then, you sometimes see them in mirrors.'; } },
    ],
  },
  {
    id: 'c_apparition', cat: 'spiritual', minAge: 4, maxAge: 13, once: true, weight: (x) => 0.3 + x.stat('paranormal') / 30,
    title: 'The figure on the stairs', text: 'A pale woman stands at the top of the stairs. She points at the cellar.',
    choices: [
      { label: 'Go down to the cellar', tags: ['impulsive'], run: (x) => { x.mods({ paranormal: 10, trauma: 3 }); if (x.chance(0.4)) { x.money(x.int(50, 800)); return 'Behind a loose brick: a tin of old coins.'; } return 'Nothing but dust. And the feeling of being watched.'; } },
      { label: 'Tell your parents', tags: ['help'], run: (x) => { x.mod('paranormal', 4); return 'They said you were dreaming. You were not.'; } },
    ],
  },
  {
    id: 'c_cursed', cat: 'spiritual', minAge: 6, maxAge: 14, once: true, weight: (x) => (x.year < 1900 ? 0.5 : 0.15),
    title: 'The old woman', text: 'You knocked over a strange old woman\'s basket. She hisses words you do not understand.',
    choices: [
      { label: 'Apologize and help her', tags: ['help'], run: (x) => { x.mods({ karma: 4 }); return 'She softens and presses a charm into your hand.'; } },
      { label: 'Laugh and run', tags: ['impulsive'], run: (x) => { if (x.chance(0.5)) { addCurse(x, 'misfortune', 1, 'An old woman\'s curse'); return 'Ever since, things keep going wrong.'; } return 'Nothing happens. Probably.'; } },
    ],
  },
  {
    id: 'c_parentOccult', cat: 'spiritual', minAge: 8, maxAge: 16, once: true, weight: (x) => (x.rels('parent').some((r) => (x.npc(r.npcId)?.karma ?? 0) < -30) ? 1.5 : 0.1),
    bind: bindRel('parent'),
    title: 'Candles in the basement', text: (x) => `You find ${who(x)} chanting in the basement, surrounded by candles and chalk symbols.`,
    choices: [
      { label: 'Ask to join', run: (x) => { x.c.spiritual.rituals++; x.train('ritual', 10); x.mods({ sin: 4, paranormal: 10, karma: -3 }); x.remember('occultChild', 'Was taught occult rituals by a parent', 35); return 'They smile strangely and hand you a candle.'; } },
      { label: 'Back away quietly', tags: ['cautious'], run: (x) => { x.mods({ anxiety: 6 }); x.relMod(npcId(x), -8, -10); return 'You never look at them the same way.'; } },
    ],
  },
  // ------------------------------------------------------------------ teen: relationships & identity
  {
    id: 't_crush', cat: 'teen', minAge: 13, maxAge: 17, cooldown: 2, weight: (x) => (x.partner() || x.c.sexuality === 'asexual' ? 0.2 : 2),
    title: 'A crush', text: 'Someone at school keeps catching your eye.',
    choices: [
      { label: 'Ask them out', tags: ['impulsive'], run: (x) => {
        const gender = x.c.sexuality === 'gay' ? x.c.gender : x.c.sexuality === 'bisexual' ? x.pick(['male', 'female'] as const) : x.c.gender === 'male' ? 'female' : 'male';
        const n = makeNpc(x, { age: x.age + x.int(-1, 1), career: null, gender: gender === 'nonbinary' ? 'female' : gender });
        if (check(x, x.stat('charisma') * 0.5 + x.stat('looks') * 0.5, 50)) {
          x.addRel(n.id, 'partner', { affinity: 65, trust: 55, attraction: 70, meta: { teen: true } });
          x.mods({ happiness: 10, confidence: 5 });
          x.remember('firstLove', `First love: ${x.name(n)}`, 30, n.id);
          if (n.gender === x.c.gender && x.w.socialNorms < 50) x.queue('lgbt_consequence', { npcId: n.id });
          return `${n.firstName} said yes! Your first relationship.`;
        }
        x.mods({ confidence: -6, happiness: -4 });
        return `${n.firstName} said no. In front of everyone.`;
      } },
      { label: 'Admire from afar', tags: ['cautious'], run: (x) => { x.mod('creativity', 2); return 'You wrote terrible poetry about them.'; } },
    ],
  },
  {
    id: 't_heartbreak', cat: 'teen', minAge: 13, maxAge: 19, weight: (x) => (x.rels('partner').some((r) => r.meta.teen) ? 2.5 : 0),
    bind: (x) => { const r = x.rels('partner').find((q) => q.meta.teen); return r ? { npcId: r.npcId } : null; },
    title: 'Heartbreak', text: (x) => `${who(x)} dumped you.`,
    choices: [
      { label: 'Cry it out', run: (x) => { x.addRel(npcId(x), 'ex', { affinity: 30 }); x.mods({ happiness: -10, romanticCynicism: 6 }); trauma(x, 3, 'loss'); return 'It felt like the end of the world. It was not.'; } },
      { label: 'Act like you do not care', run: (x) => { x.addRel(npcId(x), 'ex', { affinity: 25 }); x.mods({ romanticCynicism: 10, confidence: 2 }); return 'You built your first wall.'; } },
      { label: 'Beg them back', tags: ['impulsive'], run: (x) => { if (x.chance(0.3)) { x.relMod(npcId(x), 10); return 'They took you back. For now.'; } x.addRel(npcId(x), 'ex', { affinity: 20 }); x.mods({ confidence: -8, romanticCynicism: 8 }); return 'Humiliating.'; } },
    ],
  },
  {
    id: 't_pregnancy', cat: 'teen', minAge: 15, maxAge: 18, once: true, weight: (x) => (x.rels('partner').some((r) => x.npc(r.npcId)?.gender !== x.c.gender) && x.c.gender !== 'nonbinary' ? 0.5 : 0),
    bind: (x) => { const r = x.rels('partner').find((q) => x.npc(q.npcId)?.gender !== x.c.gender); return r ? { npcId: r.npcId } : null; },
    title: 'Two pink lines', text: (x) => (x.c.gender === 'female' ? 'You are pregnant.' : `${who(x)} is pregnant.`),
    choices: [
      { label: 'Keep the baby', run: (x) => { const kid = birthChild(x, npcId(x)); x.mods({ stress: 15, happiness: 4 }); x.c.flags.teenParent = true; x.c.education.grades -= 15; return `${kid.firstName} was born. Your life just changed forever.`; } },
      { label: 'Place the baby for adoption', run: (x) => { x.mods({ stress: 8, depression: 6 }); x.remember('gaveUpChild', 'Placed a baby for adoption as a teenager', 55); x.c.flags.adoptedOutChild = x.year; return 'You signed the papers and held the baby once.'; } },
      { label: 'End the pregnancy', when: (x) => x.w.socialNorms >= 55, run: (x) => { x.mods({ stress: 6 }); x.remember('teenPregnancy', 'Faced a teen pregnancy', 30); return 'A hard, private decision. You kept going.'; } },
    ],
  },
  {
    id: 't_abusiveRelationship', cat: 'teen', minAge: 14, maxAge: 25, once: true, weight: (x) => (x.partner() ? 0.5 : 0),
    bind: bindRel('partner'),
    title: 'Controlling', text: (x) => `${who(x)} checks your phone, picks your friends and loses their temper when you go out.`,
    choices: [
      { label: 'Leave them', tags: ['cautious'], run: (x) => { x.addRel(npcId(x), 'ex', { affinity: 10 }); x.mods({ resilience: 6, confidence: 4 }); trauma(x, 6, 'abuse'); return 'It was terrifying. It was the right call.'; } },
      { label: 'Stay — they will change', run: (x) => { trauma(x, 12, 'abuse'); x.mods({ confidence: -8, anxiety: 6 }); x.relMod(npcId(x), -10); return 'They did not change.'; } },
    ],
  },
  {
    id: 't_comingOut', cat: 'teen', minAge: 13, maxAge: 22, once: true, weight: (x) => (x.c.sexuality === 'gay' || x.c.sexuality === 'bisexual' ? 3 : 0),
    title: 'Who you are', text: (x) => (x.w.socialNorms < 40 ? 'You are attracted to people the world says you should not love. In this era that can be dangerous.' : 'You know who you are. Do you tell your family?'),
    choices: [
      { label: 'Come out', tags: ['impulsive'], run: (x) => {
        const norms = x.w.socialNorms;
        x.c.flags.out = true;
        if (norms > 65) { x.mods({ happiness: 10, confidence: 8, anxiety: -6 }); return 'Your family hugged you. Some things are easier now.'; }
        if (norms > 40) { for (const p of x.rels('parent')) x.relMod(p.npcId, x.chance(0.5) ? -15 : 5); x.mods({ confidence: 5, anxiety: 2 }); return 'Some family members took it well. Others did not.'; }
        for (const p of x.rels('parent')) x.relMod(p.npcId, -30);
        x.mods({ popularity: -15, anxiety: 10 });
        trauma(x, 10, 'abuse');
        if (norms < 25 && x.chance(0.3)) { x.c.flags.persecuted = true; return 'Word spread. You were beaten in the street, and the authorities shrugged.'; }
        return 'Your family is ashamed. You are sent to "talk to someone."';
      } },
      { label: 'Stay closeted', tags: ['cautious'], run: (x) => { x.mods({ anxiety: 6, loneliness: 6 }); x.secret('closeted', 'Your sexuality', x.w.socialNorms < 40 ? 5 : 2); return 'You kept it to yourself.'; } },
    ],
  },
  {
    id: 'lgbt_consequence', cat: 'relationship', triggered: true,
    title: 'Whispers', text: (x) => (x.w.socialNorms < 30 ? `Neighbors whisper about you and ${who(x)}. In this era, the law can punish love like yours.` : `People gossip about you and ${who(x)}.`),
    choices: [
      { label: 'Be open and proud', tags: ['impulsive'], run: (x) => { x.mods({ confidence: 6, publicImage: x.w.socialNorms > 60 ? 3 : -8 }); if (x.w.socialNorms < 25 && x.chance(0.35)) { x.c.legal.record.push({ crime: 'Indecency (historical law)', age: x.age, years: 0, countryId: x.c.countryId }); x.mods({ happiness: -10 }); return 'You were arrested under laws that should never have existed.'; } return 'You refuse to hide.'; } },
      { label: 'Be discreet', tags: ['cautious'], run: (x) => { x.mods({ anxiety: 4 }); return 'You meet in secret.'; } },
      { label: 'End it', run: (x) => { x.addRel(npcId(x), 'ex', { affinity: 30 }); x.mods({ happiness: -10, romanticCynicism: 6 }); return 'You ended it, and hated yourself for it.'; } },
    ],
  },
  {
    id: 't_party', cat: 'teen', minAge: 14, maxAge: 21, cooldown: 2, weight: 2,
    title: 'The party', text: (x) => `There is a party at ${x.pick(['a senior\'s house', 'the quarry', 'the old warehouse'])}. Everyone is drinking${x.year > 1960 ? ' and someone brought pills' : ''}.`,
    choices: [
      { label: 'Drink with everyone', tags: ['social'], run: (x) => { const a = expose(x, 'alcohol', 0.6); x.mods({ popularity: 5, happiness: 4 }); return a ? 'You are drinking more than you meant to these days.' : 'A great night. A terrible morning.'; } },
      { label: 'Try the pills', tags: ['impulsive'], when: (x) => x.year > 1960, run: (x) => { const a = expose(x, 'stimulants', 0.9); x.mods({ popularity: 3, mania: 10 }); if (x.chance(0.08)) { x.mod('health', -15); return 'You woke up in hospital.'; } return a ? 'You crave that feeling.' : 'You danced until sunrise.'; } },
      { label: 'Stay sober', tags: ['cautious'], run: (x) => { const resist = x.stat('willpower') + x.skill('charm'); if (resist > 60) { x.mod('willpower', 3); return 'You had fun anyway and drove everyone home.'; } x.mod('popularity', -4); return 'Peer pressure made it awkward. You left early.'; } },
      { label: 'Stay home', run: (x) => { x.mod('loneliness', 2); return 'You heard all about it on Monday.'; } },
    ],
  },
  {
    id: 't_firstCrime', cat: 'teen', minAge: 12, maxAge: 17, cooldown: 2, weight: (x) => 1 + x.stat('riskTolerance') / 50 + (x.c.flags.criminalContact ? 1 : 0),
    title: 'A dare', text: 'Your friends dare you to do something stupid.',
    choices: [
      { label: 'Shoplift', tags: ['impulsive'], run: (x) => commitCrime(x, 'shoplift').text },
      { label: 'Spray-paint the school', tags: ['impulsive'], run: (x) => commitCrime(x, 'vandalism').text },
      { label: 'Steal a car for a joyride', tags: ['impulsive'], when: (x) => x.year >= 1915, run: (x) => commitCrime(x, 'carTheft').text },
      { label: 'Hack the school grading system', tags: ['impulsive'], when: (x) => x.year >= 1990 && x.skill('programming') > 10, run: (x) => { const r = commitCrime(x, 'identityTheft'); x.c.education.grades = Math.min(100, x.c.education.grades + 20); return r.text; } },
      { label: 'Refuse', tags: ['cautious'], run: (x) => { x.mods({ popularity: -2, willpower: 2 }); return 'They called you a coward. You slept well.'; } },
    ],
  },
  {
    id: 't_fight', cat: 'teen', minAge: 12, maxAge: 19, violent: true, weight: (x) => 0.8 + x.stat('aggression') / 40 + (x.c.flags.unprocessedViolence ? 1.5 : 0), memory: { sawMurder: 2 },
    title: 'Trouble after school', text: 'Someone from a rival school wants to fight you.',
    choices: [
      { label: 'Fight', tags: ['violent', 'impulsive'], run: (x) => { x.train('streetFighting', 6); if (check(x, x.stat('fitness') + x.skill('streetFighting'), 60)) { x.mods({ streetCred: 6, confidence: 4, aggression: 3 }); if (x.chance(0.25)) return commitCrime(x, 'assault').text + ' You won the fight, but someone filmed it.'; return 'You won. Word gets around.'; } x.mods({ health: -8, confidence: -4 }); return 'You lost and limped home.'; } },
      { label: 'Talk your way out', tags: ['social'], run: (x) => { if (check(x, x.stat('charisma') + x.skill('persuasion'), 55)) { x.train('persuasion', 4); return 'By the end you were sharing a soda.'; } x.mod('health', -4); return 'Talking did not work.'; } },
      { label: 'Walk away', tags: ['cautious'], run: (x) => { x.mod('streetCred', -3); return 'Discretion is the better part of valor.'; } },
    ],
  },
  {
    id: 't_academicTrack', cat: 'teen', minAge: 14, maxAge: 16, once: true, weight: (x) => (x.c.education.enrolled ? 4 : 0),
    title: 'Choosing a path', text: 'Your school counselor asks what track you want.',
    choices: [
      { label: 'Elite academic track', tags: ['ambitious'], run: (x) => { x.c.flags.studyHard = true; x.mods({ smarts: 4, stress: 6, discipline: 3 }); return 'Advanced classes, late nights, big dreams.'; } },
      { label: 'Vocational track', run: (x) => { x.train('mechanics', 8); x.train('construction', 6); x.c.flags.vocational = true; return 'You learn to fix things with your hands.'; } },
      { label: 'Coast', run: (x) => { x.mods({ happiness: 3 }); return 'You do the minimum.'; } },
      { label: 'Drop out', tags: ['impulsive'], run: (x) => { const en = x.c.education.enrolled; x.c.education.enrolled = null; x.c.education.droppedOut = true; x.mods({ riskTolerance: 6, creativity: 3 }); x.c.flags.dropout = true; x.remember('dropout', 'Dropped out of school', 25); return en ? 'You walked out and never came back. The world is your school now.' : 'You quit.'; } },
    ],
  },
  {
    id: 't_radicalization', cat: 'teen', minAge: 14, maxAge: 22, once: true, weight: (x) => (x.stat('loneliness') > 40 || x.stat('happiness') < 40 ? 1.5 : 0.3),
    title: 'Belonging', text: (x) => (x.year >= 2005 ? 'An online community finally makes you feel understood. They have an enemy, and a plan.' : 'A charismatic group offers you purpose, brotherhood and an enemy to blame.'),
    choices: [
      { label: 'Political extremists', tags: ['impulsive'], run: (x) => { x.c.flags.radical = 'political'; x.train('propaganda', 10); x.mods({ confidence: 6, empathy: -6, heat: 6, aggression: 5 }); x.chain('radical', 3, { kind: 'political' }); x.remember('radicalized', 'Joined political extremists', 40); return 'For the first time you feel like you matter.'; } },
      { label: 'Religious extremists', tags: ['impulsive'], run: (x) => { x.c.flags.radical = 'religious'; x.train('scripture', 10); x.mods({ faith: 15, empathy: -6, heat: 6 }); x.chain('radical', 3, { kind: 'religious' }); x.remember('radicalized', 'Joined religious extremists', 40); return 'Certainty is intoxicating.'; } },
      { label: 'A street gang', tags: ['violent'], run: (x) => { x.c.flags.radical = 'gang'; x.c.flags.criminalContact = true; x.train('streetFighting', 10); x.mods({ streetCred: 15, criminalRep: 8, karma: -5 }); x.chain('radical', 3, { kind: 'gang' }); x.remember('radicalized', 'Joined a street gang', 40); return 'You were jumped in. They are your family now.'; } },
      { label: 'A cult', run: (x) => { x.c.flags.radical = 'cult'; x.mods({ faith: 10, loneliness: -15, smarts: -2 }); x.chain('radical', 3, { kind: 'cult' }); x.remember('radicalized', 'Joined a cult', 40); return 'They love you. They want everything you have.'; } },
      { label: 'Walk away', tags: ['cautious'], run: (x) => { x.mod('wisdom', 3); return 'Something about it felt wrong.'; } },
    ],
  },
  {
    id: 't_clique', cat: 'teen', minAge: 13, maxAge: 16, once: true, weight: 3,
    title: 'Where you sit at lunch', text: 'Every table is a tribe.',
    choices: [
      { label: 'The popular kids', tags: ['social'], when: (x) => x.stat('looks') > 50 || x.stat('charisma') > 55, run: (x) => { x.mods({ popularity: 15, confidence: 5 }); x.train('charm', 6); return 'You are in. Staying in is a full-time job.'; } },
      { label: 'The athletes', when: (x) => x.stat('fitness') > 50, run: (x) => { x.mods({ popularity: 8, fitness: 4 }); x.train('ballSports', 6); return 'Practice every day.'; } },
      { label: 'The nerds', run: (x) => { x.mods({ smarts: 4, popularity: -3 }); x.train(x.year > 1980 ? 'programming' : 'mathematics', 6); return 'You argue about things that matter.'; } },
      { label: 'The rebels', run: (x) => { x.mods({ streetCred: 6, riskTolerance: 5, discipline: -2 }); x.c.flags.criminalContact = x.chance(0.4) || !!x.c.flags.criminalContact; return 'Skipping class behind the gym.'; } },
      { label: 'Nobody — you are an outcast', run: (x) => { x.mods({ popularity: -10, creativity: 6, loneliness: 8 }); x.c.flags.outcast = true; return 'Lonely, but your notebooks are full of ideas.'; } },
    ],
  },
  {
    id: 't_outcastMentor', cat: 'teen', minAge: 13, maxAge: 18, once: true, weight: (x) => (x.c.flags.outcast ? 3 : 0),
    title: 'An unlikely mentor', text: 'A reclusive teacher notices you eating lunch alone and invites you to their workshop.',
    auto: (x) => { const m = makeNpc(x, { age: x.int(45, 70), career: x.year > 1800 ? 'teacher' : 'scribe', careerLevel: 6, karma: 40, smarts: 85 }); x.addRel(m.id, 'mentor', { affinity: 70, trust: 70 }); x.mods({ smarts: 4, wisdom: 4, loneliness: -10 }); x.remember('outcastMentor', `Found a mentor in ${x.name(m)}`, 30, m.id); return `${m.firstName} ${m.lastName} changes how you see the world.`; },
  },
  {
    id: 't_firstJob', cat: 'teen', minAge: 14, maxAge: 17, once: true, weight: (x) => (x.year > 1900 ? 1.5 : 0),
    title: 'Part-time job', text: 'The corner store needs help on weekends.',
    choices: [
      { label: 'Take it', run: (x) => { x.money(x.int(800, 2500)); x.mods({ discipline: 4 }); x.train('sales', 5); return 'Your first paycheck.'; } },
      { label: 'Enjoy your youth', run: (x) => { x.mod('happiness', 3); return 'Plenty of time for work later.'; } },
    ],
  },
  {
    id: 't_tryouts', cat: 'teen', minAge: 13, maxAge: 17, cooldown: 2, weight: (x) => (x.c.hobbies.includes('sports') || x.stat('fitness') > 55 ? 1.5 : 0.3),
    title: 'Team tryouts', text: 'Tryouts for the school team are this week.',
    choices: [
      { label: 'Give it everything', tags: ['ambitious'], run: (x) => { x.train('ballSports', 6); x.train('running', 4); if (check(x, x.stat('fitness') + x.skill('ballSports') / 2, 65)) { x.mods({ popularity: 8, fitness: 4, confidence: 5 }); x.c.flags.varsity = true; return 'You made the team!'; } x.mod('confidence', -4); return 'Cut on the last day.'; } },
      { label: 'Skip it', run: () => 'Maybe next year.' },
    ],
  },
  {
    id: 't_cyberbullying', cat: 'teen', minAge: 12, maxAge: 18, years: [2006, 99999], weight: (x) => (x.stat('popularity') < 45 ? 1.5 : 0.5),
    title: 'Group chat', text: 'Someone made a group chat mocking you. Screenshots are everywhere.',
    choices: [
      { label: 'Report it', tags: ['help'], run: (x) => { x.mod('anxiety', 4); return x.chance(0.5) ? 'The school shut it down.' : 'Nothing happened.'; } },
      { label: 'Clap back publicly', tags: ['impulsive'], run: (x) => { if (check(x, x.stat('charisma') + x.skill('humor'), 60)) { x.mods({ popularity: 8, confidence: 4 }); return 'Your reply went viral. You won.'; } x.mods({ popularity: -6, anxiety: 6 }); return 'It got worse.'; } },
      { label: 'Log off', tags: ['cautious'], run: (x) => { x.mods({ anxiety: 3, loneliness: 3 }); return 'You stayed offline for a month.'; } },
    ],
  },
  {
    id: 't_viral', cat: 'teen', minAge: 13, maxAge: 19, years: [2008, 99999], once: true, weight: 0.6,
    title: 'Viral', text: 'A video of you went viral overnight.',
    choices: [
      { label: 'Ride the wave', tags: ['ambitious'], run: (x) => { x.mods({ fame: 12, ego: 6 }); x.c.media.followers += x.int(20000, 500000); x.train('branding', 6); return 'Brands are already in your DMs.'; } },
      { label: 'Delete everything', tags: ['cautious'], run: (x) => { x.mods({ fame: 3, anxiety: 2 }); return 'The internet forgets. Mostly.'; } },
    ],
  },
  {
    id: 't_teenDepression', cat: 'mental', minAge: 13, maxAge: 19, weight: (x) => (x.stat('depression') > 45 ? 2.5 : 0),
    title: 'Grey days', text: 'Everything feels heavy. Getting out of bed is hard.',
    choices: [
      { label: 'Talk to someone you trust', tags: ['help'], run: (x) => { x.mods({ depression: -12, loneliness: -6 }); const p = x.rels('parent', 'bestFriend', 'friend', 'sibling')[0]; if (p) x.relMod(p.npcId, 8, 8); return 'Saying it out loud helped more than you expected.'; } },
      { label: 'See a counselor', tags: ['help'], when: (x) => x.year >= 1950, run: (x) => { x.mods({ depression: -15, anxiety: -6 }); x.c.mental.therapy = x.chance(0.4) || x.c.mental.therapy; return 'The counselor gave you tools that work.'; } },
      { label: 'Hide it', run: (x) => { x.mods({ depression: 6, loneliness: 4 }); return 'Nobody noticed. That was the problem.'; } },
    ],
  },
  {
    id: 't_successionPlot', cat: 'teen', minAge: 14, maxAge: 30, once: true, weight: (x) => (x.c.familyStatus === 'royalty' && has(x, 'sibling') ? 3 : 0),
    bind: bindRel('sibling'),
    title: 'The succession', text: (x) => `Courtiers whisper that ${who(x)} is plotting to be named heir in your place.`,
    choices: [
      { label: 'Strike first', tags: ['violent', 'ambitious'], run: (x) => { x.relMod(npcId(x), -40, -40); x.mods({ karma: -10, fear: 10, sin: 5 }); x.c.flags.lineOfSuccession = 1; x.remember('successionWar', `Outmaneuvered ${who(x)} for the throne`, 50, npcId(x)); if (x.chance(0.3)) { const n = x.npc(npcId(x)); if (n) { n.alive = false; n.deathYear = x.year; n.causeOfDeath = 'a hunting accident'; } return `${who(x)} died in a convenient hunting accident. You are first in line.`; } return 'You exposed their plot. They are banished from court.'; } },
      { label: 'Win the court with charm', tags: ['social'], run: (x) => { if (check(x, x.stat('charisma') + x.skill('diplomacy'), 65)) { x.c.flags.lineOfSuccession = 1; return 'The nobles rally to you.'; } x.c.flags.lineOfSuccession = 2; return 'The court is split.'; } },
      { label: 'Renounce your claim', tags: ['cautious'], run: (x) => { x.c.flags.lineOfSuccession = 99; x.mods({ happiness: 5, karma: 5 }); return 'You step aside. The relief is enormous.'; } },
    ],
  },
  {
    id: 't_arrangedMarriage', cat: 'teen', minAge: 15, maxAge: 22, once: true, weight: (x) => (rich(x) && x.year < 1920 && !x.spouse() ? 3 : rich(x) && x.c.familyStatus !== 'wealthy' ? 0.5 : 0),
    title: 'An arranged match', text: 'Your family has arranged a marriage to cement an alliance with a powerful house.',
    bind: (x) => ({ npcId: makeNpc(x, { gender: x.c.gender === 'male' ? 'female' : 'male', age: x.age + x.int(-2, 8), wealth: x.int(1000000, 20000000), sexuality: 'straight' }).id }),
    choices: [
      { label: 'Accept for the family', run: (x) => { x.addRel(npcId(x), 'partner', { affinity: 40, trust: 40, compatibility: 50 }); const t = marry(x, npcId(x), { prenup: true, lavish: true }); for (const p of x.rels('parent')) x.relMod(p.npcId, 10); x.mods({ happiness: -3 }); x.s.dynasty.reputation.political += 3; return `${t} Love may come later. Or not.`; } },
      { label: 'Refuse', tags: ['impulsive'], run: (x) => { for (const p of x.rels('parent')) x.relMod(p.npcId, -25); x.mods({ confidence: 6 }); x.remember('refusedMarriage', 'Refused an arranged marriage', 25); return 'Your father did not speak to you for a year.'; } },
    ],
  },
  {
    id: 't_apprenticed', cat: 'teen', minAge: 12, maxAge: 15, once: true, weight: (x) => (x.year < 1880 && !x.c.education.enrolled && !rich(x) ? 3 : 0),
    title: 'Apprenticed', text: 'Your parents arrange for you to be apprenticed to a local master.',
    choices: [
      { label: 'Go willingly', run: (x) => { const r = enroll(x, 'apprenticeship', false); return r.text; } },
      { label: 'Run off to find your own way', tags: ['impulsive'], run: (x) => { x.mods({ riskTolerance: 5, streetCred: 4 }); x.train('streetwise', 6); return 'You took to the roads.'; } },
    ],
  },
  {
    id: 't_scholarship', cat: 'teen', minAge: 16, maxAge: 18, once: true, weight: (x) => (x.stat('smarts') > 70 && !rich(x) && x.year > 1900 ? 2.5 : 0),
    title: 'Scholarship offer', text: 'A university offers you a full scholarship.',
    choices: [
      { label: 'Accept', tags: ['ambitious'], run: (x) => { x.c.flags.scholarship = true; x.mods({ happiness: 10, confidence: 6 }); return 'Tuition covered. The future opens up.'; } },
      { label: 'Decline — family needs you to work', run: (x) => { x.mods({ karma: 3, happiness: -5 }); return 'You stay home and work.'; } },
    ],
  },
  {
    id: 't_runaway', cat: 'teen', minAge: 13, maxAge: 17, once: true, weight: (x) => (['abusive', 'neglectful', 'alcoholic'].includes(x.c.familyHealth) ? 1.5 : 0.1),
    title: 'Run away?', text: 'You cannot take one more night in that house.',
    choices: [
      { label: 'Run away', tags: ['impulsive'], run: (x) => { x.mods({ streetCred: 10, riskTolerance: 8, health: -6, happiness: 4 }); x.train('streetwise', 10); x.c.flags.criminalContact = true; x.c.flags.runaway = true; for (const p of x.rels('parent')) x.relMod(p.npcId, -20); x.remember('ranAway', 'Ran away from home', 40); return 'The streets are cold, but nobody hits you here.'; } },
      { label: 'Endure until you turn 18', tags: ['cautious'], run: (x) => { trauma(x, 6, 'abuse'); x.mod('willpower', 4); return 'Counting down the days.'; } },
    ],
  },
  {
    id: 't_tattoo', cat: 'teen', minAge: 16, maxAge: 30, once: true, weight: (x) => (x.year > 1950 ? 0.8 : 0.2),
    title: 'Ink', text: 'Your friends are getting tattoos.',
    choices: [
      { label: 'Get a big visible one', tags: ['impulsive'], run: (x) => { x.c.bio.cosmetics.push({ id: 'tattoo', name: 'Visible tattoo', age: x.age }); x.mods({ streetCred: 4, confidence: 3 }); return 'Corporate interviews may be harder now.'; } },
      { label: 'Something small and hidden', run: (x) => { x.c.bio.cosmetics.push({ id: 'tattooSmall', name: 'Hidden tattoo', age: x.age }); return 'A secret only you (and lovers) know.'; } },
      { label: 'No thanks', tags: ['cautious'], run: () => 'Your skin stays blank.' },
    ],
  },
  {
    id: 't_driving', cat: 'teen', minAge: 16, maxAge: 18, once: true, years: [1920, 99999], weight: 2,
    title: 'Driving test', text: 'Time for your driving test.',
    auto: (x) => (check(x, x.stat('smarts') / 2 + x.stat('dexterity') / 2, 45) ? (x.c.flags.license = true, 'You passed!') : 'You failed. Next time.'),
  },
  {
    id: 't_volunteer', cat: 'teen', minAge: 13, maxAge: 25, cooldown: 4, weight: 0.8,
    title: 'Volunteer?', text: 'A local shelter needs volunteers.',
    choices: [
      { label: 'Sign up', tags: ['help'], run: (x) => { x.mods({ karma: 5, empathy: 4, happiness: 3 }); x.train('empathyListening', 5); x.remember('helpedSomeone', 'Volunteered at a shelter', 15); return 'It changed how you see people.'; } },
      { label: 'Too busy', run: () => 'Maybe another time.' },
    ],
  },
];
