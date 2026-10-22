import type { EventDef } from './types';
import { bindRel, check, npcId, who } from './helpers';
import { makeNpc } from '../systems/npcs';
import { trauma, onset } from '../systems/mind';
import { diagnose, injure } from '../systems/body';
import { expose } from '../systems/addiction';
import { endCareer, retire } from '../systems/careers';
import { CAREER_BY_ID } from '../data/careers';
import { countriesAvailable, countryName } from '../data/countries';

/** Young adult, adult, mid-life, senior and elder events. */
export const ADULT_EVENTS: EventDef[] = [
  // ------------------------------------------------------------------ young adult (18–29)
  {
    id: 'ya_roommate', cat: 'youngAdult', minAge: 18, maxAge: 26, once: true, weight: 1.2,
    title: 'Roommate from hell', text: 'Your new roommate eats your food and never pays rent on time.',
    choices: [
      { label: 'Confront them', tags: ['impulsive'], run: (x) => { x.mods({ stress: 2, confidence: 2 }); return x.chance(0.5) ? 'They paid up, sheepishly.' : 'They moved out in the night with your TV.'; } },
      { label: 'Make friends with them', tags: ['social'], run: (x) => { const n = makeNpc(x, { age: x.age }); x.addRel(n.id, 'friend', { affinity: 60 }); return `You and ${n.firstName} became close.`; } },
    ],
  },
  {
    id: 'ya_livingAtHome', cat: 'youngAdult', minAge: 18, maxAge: 24, once: true, weight: (x) => (x.aliveParents().length ? 2 : 0),
    title: 'Move out?', text: 'Your parents ask whether you plan to stay at home.',
    choices: [
      { label: 'Stay and save money', tags: ['cautious'], run: (x) => { x.c.flags.livingWithParents = true; x.mods({ confidence: -2 }); return 'Cheap rent, zero privacy.'; } },
      { label: 'Move out', tags: ['ambitious'], run: (x) => { x.c.flags.livingWithParents = false; x.mods({ confidence: 4, happiness: 3 }); return 'Your own place at last.'; } },
    ],
  },
  {
    id: 'ya_conscription', cat: 'world', minAge: 18, maxAge: 30, cooldown: 4, weight: (x) => (x.w.war !== 'none' && x.c.gender !== 'female' && !x.c.career?.careerId.match(/soldier|Officer|specialForces|fighterPilot/) ? 4 : 0),
    title: 'Draft notice', text: (x) => `You have been drafted to fight in the ${x.w.warName ?? 'war'}.`,
    choices: [
      { label: 'Serve', run: (x) => { x.queue('combat_deployment', {}, false); const def = CAREER_BY_ID.soldier; if (x.c.career) endCareer(x, 'Drafted'); x.c.career = { careerId: def.id, level: 2, yearsInRole: 0, yearsInCareer: 0, performance: 55, salary: def.salary, employer: `the armed forces of ${x.countryName}`, workEthic: 'normal' }; x.mods({ discipline: 4 }); return 'You shipped out within the month.'; } },
      { label: 'Dodge the draft', tags: ['impulsive'], run: (x) => { if (x.chance(0.4)) { x.c.legal.record.push({ crime: 'Draft evasion', age: x.age, years: 1, countryId: x.c.countryId }); x.mods({ publicImage: -6 }); return 'Caught. A year in a military stockade.'; } x.mods({ karma: -2, anxiety: 4 }); return 'You disappeared into the countryside.'; } },
      { label: 'Flee abroad', tags: ['cautious'], when: (x) => x.year > 1900, run: (x) => { const opts = countriesAvailable(x.year).filter((c) => x.s.world.contexts[c.id]?.war === 'none' && c.id !== x.c.countryId); if (!opts.length) return 'There is nowhere to go.'; const t = x.pick(opts); x.c.countryId = t.id; x.mods({ loneliness: 10 }); x.remember('fledDraft', `Fled the draft to ${countryName(t.id, x.year)}`, 30); return `You crossed into ${countryName(t.id, x.year)}.`; } },
      { label: 'Conscientious objector', tags: ['cautious'], when: (x) => x.stat('faith') > 50 || x.stat('karma') > 40, run: (x) => { x.mods({ karma: 4, publicImage: -4 }); return 'You served as a medic instead.'; } },
    ],
  },
  {
    id: 'combat_deployment', cat: 'world', triggered: true, violent: true,
    title: 'The front', text: (x) => `Your unit is sent into heavy fighting${x.w.warName ? ` (${x.w.warName})` : ''}.`,
    choices: [
      { label: 'Lead from the front', tags: ['ambitious', 'violent'], run: (x) => { trauma(x, 20, 'combat'); x.train('tacticalShooting', 6); x.train('leadership', 4); if (x.chance(0.3)) x.log(`Wounded: ${injure(x, true)}`, 'bad'); if (x.chance(0.35)) { x.mods({ fame: 10, publicImage: 10, professionalRep: 10 }); x.c.flags.warHero = true; x.remember('warHero', 'Decorated for valor in combat', 60); if (x.hasSkillCombo({ poetry: 30, militaryStrategy: 30 })) x.mod('fame', 10); return 'You were decorated for valor. A war hero.'; } return 'You came back. Most of your squad did too.'; } },
      { label: 'Keep your head down', tags: ['cautious'], run: (x) => { trauma(x, 12, 'combat'); if (x.chance(0.15)) x.log(`Wounded: ${injure(x, true)}`, 'bad'); return 'You survived by being careful and lucky.'; } },
      { label: 'Desert', tags: ['impulsive'], run: (x) => { if (x.chance(0.5)) { x.c.legal.record.push({ crime: 'Desertion', age: x.age, years: 3, countryId: x.c.countryId }); x.mods({ publicImage: -15 }); x.c.flags.dishonorable = true; x.remember('deserted', 'Deserted in wartime and was caught', 50); return 'Caught. Dishonorable discharge and military prison.'; } x.c.flags.deserter = true; x.mods({ anxiety: 10, karma: -3 }); return 'You slipped away in the chaos.'; } },
    ],
  },
  {
    id: 'ya_quarterLife', cat: 'youngAdult', minAge: 24, maxAge: 30, once: true, weight: 1.5,
    title: 'Quarter-life crisis', text: 'Is this it? Everyone else seems further ahead.',
    choices: [
      { label: 'Travel the world', tags: ['impulsive'], run: (x) => { const cost = Math.min(Math.max(0, x.c.money), 8000); x.spend(cost); x.mods({ happiness: 10, wisdom: 4, stress: -10 }); x.train('languages', 6); return 'You came back with stories and no savings.'; } },
      { label: 'Double down on work', tags: ['ambitious'], run: (x) => { if (x.c.career) x.c.career.performance += 10; x.mods({ stress: 6, discipline: 3 }); return 'You put your head down.'; } },
      { label: 'See a therapist', tags: ['help'], when: (x) => x.year > 1920, run: (x) => { x.mods({ anxiety: -8, depression: -6, wisdom: 2 }); return 'Turns out everyone feels this way.'; } },
    ],
  },
  {
    id: 'ya_startBusiness', cat: 'youngAdult', minAge: 19, maxAge: 45, cooldown: 6, weight: (x) => (x.stat('riskTolerance') > 45 || x.c.flags.dropout ? 1.2 : 0.4),
    title: 'A business idea', text: 'You have an idea that could make you rich.',
    choices: [
      { label: 'Go all in', tags: ['ambitious', 'impulsive'], run: (x) => {
        const stake = Math.max(5000, Math.round(Math.max(0, x.c.money) * 0.6));
        if (!x.spend(Math.min(stake, Math.max(0, x.c.money)))) return 'You have nothing to invest.';
        x.train('entrepreneurship', 8);
        const second = x.hasMemory('businessFailed') ? 0.1 : 0;
        if (x.chance(0.4 + x.skill('entrepreneurship') / 300 + second)) {
          const gain = Math.round(stake * x.float(1.5, 6));
          x.money(gain);
          x.mods({ confidence: 8, professionalRep: 6 });
          const emp = makeNpc(x, { age: x.int(20, 40) });
          x.addRel(emp.id, 'colleague', { affinity: 55, trust: 50 });
          x.remember('businessSuccess', 'Built a successful business', 35);
          return `It worked! You turned ${x.fmt(stake)} into ${x.fmt(gain)}.`;
        }
        x.c.debt += Math.round(stake * 0.4);
        x.mods({ happiness: -10, stress: 10 });
        x.remember('businessFailed', 'A business failed', 25);
        return 'It failed within a year. You learned a lot — and owe a lot.';
      } },
      { label: 'Find a business partner', tags: ['social'], run: (x) => { const p = makeNpc(x, { age: x.age + x.int(-5, 10), wealth: x.int(20000, 300000) }); x.addRel(p.id, 'businessPartner', { affinity: 60, trust: 55 }); x.train('negotiation', 4); return `You partnered with ${p.firstName} ${p.lastName}.`; } },
      { label: 'Forget it', tags: ['cautious'], run: () => 'It stays an idea.' },
    ],
  },
  // ------------------------------------------------------------------ adult (30–44)
  {
    id: 'ad_houseOffer', cat: 'adult', minAge: 25, maxAge: 55, cooldown: 8, weight: (x) => (x.c.money > 40000 && !x.c.assets.some((a) => a.typeId === 'house') ? 1.5 : 0),
    title: 'Dream home', text: 'You found the perfect house.',
    choices: [
      { label: 'Make an offer', tags: ['ambitious'], run: (x) => { const price = Math.round(x.int(180, 520) * 1000 * (x.year < 1950 ? 0.4 : 1)); const down = Math.round(price * 0.2); if (!x.spend(down)) return 'The bank laughed at your down payment.'; x.c.assets.push({ id: x.uid('a'), typeId: 'house', name: x.year < 1900 ? 'Townhouse' : 'Single-family home', countryId: x.c.countryId, boughtYear: x.year, purchasePrice: price, value: price, mortgage: price - down, rentedOut: false, condition: 85, level: 1, front: false, seized: false, meta: {} }); x.mods({ happiness: 10 }); x.remember('boughtHome', 'Bought a home', 25); return `It's yours, with a ${x.fmt(price - down)} mortgage.`; } },
      { label: 'Keep renting', tags: ['cautious'], run: () => 'Maybe next year.' },
    ],
  },
  {
    id: 'ad_affairTemptation', cat: 'adult', minAge: 25, maxAge: 65, cooldown: 5, weight: (x) => (x.spouse() ? 0.8 + x.stat('riskTolerance') / 100 : 0), memory: { affair: 1.5 },
    title: 'Temptation', text: (x) => `A charming ${x.c.career ? 'colleague' : 'neighbor'}, ${who(x)}, has been flirting with you for months.`,
    bind: (x) => ({ npcId: makeNpc(x, { age: x.age + x.int(-10, 5), gender: x.c.gender === 'male' ? 'female' : 'male', looks: x.int(60, 90) }).id }),
    choices: [
      { label: 'Start an affair', tags: ['impulsive'], run: (x) => { const sub = x.c.career && x.c.career.level >= 6; x.addRel(npcId(x), 'affair', { affinity: 65, trust: 40, meta: { discretion: x.int(30, 70), subordinate: !!sub } }); x.secret(`affair_${npcId(x)}`, `An affair with ${x.name(npcId(x))}`, sub ? 7 : 5); x.mods({ happiness: 6, karma: -5, sin: 4 }); x.remember('affair', `Had an affair with ${x.name(npcId(x))}`, 35, npcId(x)); expose(x, 'sex', 0.4); return sub ? 'A secret affair with a subordinate. HR would call this harassment.' : 'A secret affair begins.'; } },
      { label: 'Shut it down', tags: ['cautious'], run: (x) => { x.mods({ karma: 2, willpower: 3 }); const sp = x.spouse(); if (sp) x.relMod(sp.npcId, 3, 3); return 'You went home and hugged your spouse a little tighter.'; } },
    ],
  },
  {
    id: 'ad_promotionPolitics', cat: 'career', minAge: 25, maxAge: 60, cooldown: 4, weight: (x) => (x.c.career && x.c.career.level >= 3 && x.c.career.level < 9 ? 1.5 : 0),
    title: 'Office politics', text: 'A rival is angling for the promotion you want.',
    bind: (x) => ({ npcId: makeNpc(x, { age: x.age + x.int(-5, 5), career: x.c.career!.careerId, careerLevel: x.c.career!.level }).id }),
    choices: [
      { label: 'Outwork them', tags: ['ambitious'], run: (x) => { x.c.career!.performance += 12; x.mods({ stress: 5 }); x.addRel(npcId(x), 'rival', { affinity: 30 }); return 'Your numbers speak for themselves.'; } },
      { label: 'Undermine them', tags: ['impulsive'], run: (x) => { x.mods({ karma: -5 }); x.addRel(npcId(x), 'rival', { affinity: 10, trust: 5 }); if (check(x, x.skill('manipulation') + x.stat('charisma') / 2, 50)) { x.c.career!.performance += 15; return 'Their reputation is in tatters. Nobody suspects you.'; } x.c.career!.performance -= 15; x.mod('professionalRep', -8); return 'It backfired. Everyone knows what you did.'; } },
      { label: 'Ally with them', tags: ['social'], run: (x) => { x.addRel(npcId(x), 'friend', { affinity: 60, trust: 55 }); x.train('networking', 5); return 'You agreed to lift each other up.'; } },
    ],
  },
  {
    id: 'ad_bossBetrayal', cat: 'career', minAge: 22, maxAge: 65, cooldown: 6, weight: (x) => (x.c.career?.bossId && x.npc(x.c.career.bossId)?.alive ? 0.7 : 0),
    bind: (x) => (x.c.career?.bossId ? { npcId: x.c.career.bossId } : null),
    title: 'Credit stolen', text: (x) => `${who(x)} presented your project to the board as their own.`,
    choices: [
      { label: 'Expose them', tags: ['impulsive'], run: (x) => { x.relMod(npcId(x), -30, -30); if (x.chance(0.45)) { x.mods({ professionalRep: 8 }); x.c.career!.performance += 10; return 'The board believed you. Your boss is on thin ice.'; } x.c.career!.performance -= 15; return 'It was your word against theirs. You lost.'; } },
      { label: 'Let it go', tags: ['cautious'], run: (x) => { x.mods({ happiness: -4, stress: 4 }); x.relMod(npcId(x), 5); return 'They owe you one. They will never pay.'; } },
      { label: 'Start looking for another job', run: (x) => { x.mod('professionalRep', 2); return 'You quietly polish your résumé.'; } },
    ],
  },
  {
    id: 'ad_bullyIsBoss', cat: 'relationship', minAge: 25, maxAge: 60, once: true, secret: true,
    when: (x) => !!x.c.career && x.rels('bully').length > 0,
    bind: bindRel('bully'),
    title: 'A familiar face', text: (x) => `Your new manager is ${x.name(npcId(x))} — the kid who bullied you in school.`,
    memory: { bullied: 4 },
    choices: [
      { label: 'Confront the past', tags: ['impulsive'], run: (x) => { if (x.chance(0.5)) { x.addRel(npcId(x), 'friend', { affinity: 55, trust: 45 }); x.mods({ wisdom: 4, trauma: -8 }); return 'They apologized. They had a hard home life too.'; } x.relMod(npcId(x), -20); x.c.career!.performance -= 10; return 'They smirked. Nothing has changed.'; } },
      { label: 'Be professional', tags: ['cautious'], run: (x) => { x.addRel(npcId(x), 'boss', { affinity: 40 }); return 'You keep it strictly business.'; } },
      { label: 'Get your revenge', tags: ['violent'], run: (x) => { x.mods({ karma: -6 }); x.relMod(npcId(x), -30); x.secret('revengeOnBoss', 'Sabotaged your boss over a childhood grudge', 3); return 'You leaked their expense reports. They were fired.'; } },
    ],
  },
  {
    id: 'ad_friendBecomesBoss', cat: 'relationship', minAge: 25, maxAge: 60, once: true,
    when: (x) => !!x.c.career && x.rels('bestFriend', 'friend').some((r) => x.npc(r.npcId)?.career?.careerId === x.c.career?.careerId),
    bind: (x) => { const r = x.rels('bestFriend', 'friend').find((q) => x.npc(q.npcId)?.career?.careerId === x.c.career?.careerId); return r ? { npcId: r.npcId } : null; },
    title: 'Your friend, your boss', text: (x) => `${who(x)} was just promoted to run your team.`,
    choices: [
      { label: 'Ask for special treatment', tags: ['impulsive'], run: (x) => { if (x.chance(0.5)) { x.c.career!.performance += 12; return 'They looked out for you.'; } x.relMod(npcId(x), -15); return 'They refused, awkwardly. The friendship cooled.'; } },
      { label: 'Keep friendship and work separate', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), 5, 5); return 'You both appreciated it.'; } },
    ],
  },
  {
    id: 'ad_exMarriesSibling', cat: 'relationship', minAge: 22, maxAge: 70, once: true, secret: true,
    when: (x) => x.rels('ex').length > 0 && x.rels('sibling').length > 0,
    bind: (x) => { const ex = x.rels('ex')[0]; const sib = x.rels('sibling')[0]; return ex && sib ? { npcId: ex.npcId, sib: sib.npcId } : null; },
    title: 'Family wedding', text: (x) => `Your ex, ${who(x)}, is marrying your sibling ${x.first(x.p.sib as string)}.`,
    choices: [
      { label: 'Give a gracious toast', tags: ['social'], run: (x) => { x.mods({ karma: 4, wisdom: 3 }); x.relMod(x.p.sib as string, 10); return 'Everyone cried. Some for the right reasons.'; } },
      { label: 'Object at the ceremony', tags: ['impulsive'], run: (x) => { x.relMod(x.p.sib as string, -40); x.mods({ publicImage: -5 }); x.remember('objectedWedding', 'Objected at a sibling\'s wedding', 30); return 'The wedding went ahead without you.'; } },
      { label: 'Skip it', run: (x) => { x.relMod(x.p.sib as string, -10); return 'You sent a gift.'; } },
    ],
  },
  {
    id: 'ad_burnout', cat: 'adult', minAge: 28, maxAge: 60, cooldown: 5, weight: (x) => (x.stat('stress') > 65 && x.c.career ? 2 : 0),
    title: 'Running on empty', text: 'You have not had a real day off in years.',
    choices: [
      { label: 'Take a sabbatical', tags: ['cautious'], run: (x) => { x.mods({ stress: -25, happiness: 8 }); if (x.c.career) x.c.career.performance -= 10; return 'You remembered who you are.'; } },
      { label: 'Push through', tags: ['ambitious'], run: (x) => { x.mods({ stress: 8 }); if (x.chance(0.4)) onset(x, 'burnout'); return 'Coffee is a food group now.'; } },
    ],
  },
  // ------------------------------------------------------------------ midlife (45–64)
  {
    id: 'ml_crisis', cat: 'midlife', minAge: 40, maxAge: 55, once: true, weight: 3,
    title: 'Midlife', text: 'You wake up and realize more of your life is behind you than ahead.',
    choices: [
      { label: 'Quit and chase meaning', tags: ['impulsive'], run: (x) => { if (x.c.career) endCareer(x, 'Midlife reinvention'); x.mods({ happiness: 8, wisdom: 6, stress: -15 }); x.c.flags.reinvention = true; x.remember('reinvention', 'Walked away from my career to find meaning', 40); return 'Terrifying. Exhilarating.'; } },
      { label: 'Rekindle a youthful dream', run: (x) => { const h = x.c.hobbies[0]; if (h) x.train(h === 'music' ? 'music' : h === 'sports' ? 'running' : 'art', 15); x.mods({ happiness: 10, creativity: 6 }); if (x.c.flags.athleticRegret) { x.c.flags.athleticRegret = false; x.mod('happiness', 6); return 'You laced up your old boots. The regret finally fades.'; } return 'You dusted off something you loved at seventeen.'; } },
      { label: 'Buy a sports car', tags: ['impulsive'], when: (x) => x.year > 1920, run: (x) => { x.spend(Math.min(Math.max(0, x.c.money), 60000)); x.mods({ happiness: 6, ego: 4 }); return 'It is red. It is fast. It is very much a cliché.'; } },
      { label: 'Recommit to your family', tags: ['social'], run: (x) => { for (const r of x.rels('spouse', 'child')) x.relMod(r.npcId, 12, 6); x.mods({ happiness: 6 }); return 'Family dinners every Sunday from now on.'; } },
    ],
  },
  {
    id: 'ml_plateau', cat: 'midlife', minAge: 40, maxAge: 60, cooldown: 6, weight: (x) => (x.c.career && x.c.career.yearsInRole > 5 ? 1.5 : 0),
    title: 'Plateau', text: 'You have been in the same role for years. Younger people keep getting promoted over you.',
    choices: [
      { label: 'Pivot to a new field', tags: ['ambitious'], run: (x) => { x.mods({ stress: 5, happiness: 3 }); x.c.flags.pivoting = true; return 'Time to use everything you know somewhere new.'; } },
      { label: 'Become a mentor', tags: ['help'], run: (x) => { const p = makeNpc(x, { age: x.int(22, 30), career: x.c.career?.careerId ?? null, careerLevel: 1 }); x.addRel(p.id, 'protege', { affinity: 65, trust: 60 }); x.train('mentoring', 8); x.mods({ wisdom: 4, happiness: 4 }); return `You take ${p.firstName} under your wing.`; } },
      { label: 'Accept it', tags: ['cautious'], run: (x) => { x.mods({ stress: -5 }); return 'There is peace in enough.'; } },
    ],
  },
  {
    id: 'ml_forcedOut', cat: 'midlife', minAge: 50, maxAge: 66, cooldown: 8, weight: (x) => (x.c.career && x.c.career.performance < 50 ? 1.2 : 0.2),
    title: 'Pushed out', text: 'HR schedules a meeting. They are "restructuring."',
    choices: [
      { label: 'Take the package', run: (x) => { const pay = Math.round((x.c.career?.salary ?? 30000) * 1.5); x.money(pay); retire(x); return `You left with ${x.fmt(pay)}. Reinvention or decline — your choice.`; } },
      { label: 'Fight it', tags: ['impulsive'], run: (x) => { if (x.chance(0.35)) { x.c.legal.lawsuits.push({ id: x.uid('suit'), kind: 'contract', role: 'plaintiff', otherParty: x.c.career?.employer ?? 'your employer', amount: x.int(50000, 300000), strength: 55, years: 0 }); return 'You lawyered up.'; } if (x.c.career) endCareer(x, 'Pushed out'); return 'You lost and lost the job.'; } },
    ],
  },
  {
    id: 'ml_healthScare', cat: 'health', minAge: 40, maxAge: 75, cooldown: 5, weight: (x) => (x.stat('health') < 60 || x.c.diet === 'excessive' ? 1.5 : 0.5),
    title: 'Chest pains', text: 'A sharp pain in your chest sends you to the doctor.',
    choices: [
      { label: 'Overhaul your lifestyle', tags: ['cautious'], run: (x) => { x.c.diet = 'healthy'; x.c.exercise = Math.max(2, x.c.exercise); x.mods({ health: 8, willpower: 4 }); x.remember('wakeUpCall', 'Changed my life after a health scare', 30); return 'Salads and morning walks. You feel better already.'; } },
      { label: 'Ignore it', tags: ['impulsive'], run: (x) => { if (x.chance(0.35)) { diagnose(x, 'heartDisease'); return 'It was not nothing.'; } return 'It went away. This time.'; } },
      { label: 'Pray on it', when: (x) => x.stat('faith') > 50, run: (x) => { x.mods({ faith: 3, anxiety: -4 }); return 'Your faith steadies you.'; } },
    ],
  },
  {
    id: 'ml_estatePlanning', cat: 'midlife', minAge: 50, maxAge: 90, once: true, weight: (x) => (x.netWorth() > 50000 ? 2 : 0.4),
    title: 'Estate planning', text: 'Your lawyer suggests writing a will before it is too late.',
    choices: [
      { label: 'Write a will (open the Estate panel)', tags: ['cautious'], run: (x) => { if (!x.c.will) x.c.will = { shares: {}, charity: 0, trustFund: false }; const kids = x.rels('child'); for (const k of kids) x.c.will.shares[k.npcId] = Math.round(100 / kids.length); return 'A will now exists. You can adjust shares in the Estate panel.'; } },
      { label: 'Not yet', run: () => 'Plenty of time. Probably.' },
    ],
  },
  {
    id: 'ml_secretChild', cat: 'dynasty', minAge: 45, maxAge: 90, once: true, secret: true,
    when: (x) => x.hasMemory('affair') && !x.hasMemory('secretChildRevealed'),
    title: 'A knock at the door', text: 'A young adult stands on your doorstep. They have your eyes.',
    bind: (x) => { const m = x.memory('affair'); const kid = makeNpc(x, { age: Math.max(18, x.age - (m?.age ?? x.age - 20)), lastName: x.c.lastName, career: undefined, dynasty: true }); kid.parentIds = [x.c.id]; return { npcId: kid.id }; },
    choices: [
      { label: 'Welcome them into the family', tags: ['help'], run: (x) => { x.addRel(npcId(x), 'child', { affinity: 45, trust: 35, meta: { secret: true } }); x.remember('secretChildRevealed', `Met my secret child ${who(x)}`, 50, npcId(x)); const sp = x.spouse(); if (sp) x.relMod(sp.npcId, -30, -30); x.mods({ karma: 5 }); return 'Your spouse is furious. Your new child is grateful.'; } },
      { label: 'Pay them to stay quiet', run: (x) => { const amt = 50000; if (!x.spend(amt)) return 'You could not afford their silence.'; x.addRel(npcId(x), 'blackmailer', { affinity: 15, trust: 5, meta: { secret: true } }); x.secret('secretChild', 'A child born of an affair', 6); x.mods({ karma: -4 }); return 'They took the money. They will be back.'; } },
      { label: 'Deny everything', run: (x) => { x.addRel(npcId(x), 'enemy', { affinity: 5, trust: 0 }); x.secret('secretChild', 'A child you denied', 6); x.mods({ karma: -8 }); return 'They left in tears, swearing you would regret it.'; } },
    ],
  },
  {
    id: 'ml_societalImpact', cat: 'midlife', minAge: 45, maxAge: 80, cooldown: 10, weight: (x) => (x.c.politics.laws.length || x.c.crime.orgRank >= 3 || x.c.spiritual.foundedReligion ? 2 : 0),
    title: 'Ripples', text: (x) => (x.c.politics.laws.length ? 'A study shows the law you passed years ago now affects millions.' : x.c.crime.orgRank >= 3 ? 'The network you built now runs without you — and it is more dangerous than ever.' : 'The faith you founded now has enough followers to sway elections.'),
    auto: (x) => {
      if (x.c.politics.laws.length) { x.mods({ politicalApproval: 6, wisdom: 4 }); return 'Your legacy is real.'; }
      if (x.c.crime.orgRank >= 3) { x.mods({ criminalRep: 6, heat: 6, karma: -3 }); return 'It answers to you — for now.'; }
      x.mods({ spiritualAuthority: 8, fame: 4 });
      return 'Politicians court your blessing.';
    },
  },
  // ------------------------------------------------------------------ senior (65–84)
  {
    id: 'sn_grandchild', cat: 'senior', minAge: 45, maxAge: 100, cooldown: 3, weight: (x) => (x.rels('grandchild').length ? 2 : 0),
    bind: bindRel('grandchild'),
    title: 'Grandparent days', text: (x) => `${who(x)} wants to spend the weekend with you.`,
    choices: [
      { label: 'Teach them your skills', tags: ['help'], run: (x) => { x.relMod(npcId(x), 15, 10); const n = x.npc(npcId(x)); if (n) { n.smarts = Math.min(100, n.smarts + 3); if (x.stat('wisdom') > 50) n.karma += 3; } x.mods({ happiness: 8, wisdom: 2 }); return 'They hang on your every word.'; } },
      { label: 'Spoil them rotten', run: (x) => { x.spend(Math.min(Math.max(0, x.c.money), 2000)); x.relMod(npcId(x), 20, 5); x.mod('happiness', 6); return 'Ice cream for dinner. You are the best grandparent ever.'; } },
      { label: 'Too tired', run: (x) => { x.relMod(npcId(x), -6); return 'Maybe next weekend.'; } },
    ],
  },
  {
    id: 'sn_custody', cat: 'senior', minAge: 50, maxAge: 95, once: true,
    when: (x) => x.rels('child').some((r) => x.npc(r.npcId)?.spouseName === undefined && x.npc(r.npcId)?.notes.some((n) => n.includes('divorce'))),
    title: 'Custody fight', text: 'Your child\'s divorce has become a custody war over your grandchildren.',
    choices: [
      { label: 'Fund the lawyers', run: (x) => { x.spend(Math.min(Math.max(0, x.c.money), 40000)); return 'You spared no expense.'; } },
      { label: 'Stay neutral', tags: ['cautious'], run: () => 'You refuse to take sides.' },
    ],
  },
  {
    id: 'sn_oldRival', cat: 'senior', minAge: 55, maxAge: 95, once: true, weight: (x) => (x.rels('rival', 'enemy', 'nemesis').length ? 3 : 0),
    bind: bindRel('rival', 'enemy', 'nemesis'),
    title: 'An old rival', text: (x) => `${x.name(npcId(x))} — your rival of decades — asks to meet one last time.`,
    choices: [
      { label: 'Reconcile', tags: ['help'], run: (x) => { x.addRel(npcId(x), 'acquaintance', { affinity: 55, trust: 40 }); x.mods({ karma: 8, happiness: 8, wisdom: 4 }); x.remember('oldRivalResolved', `Made peace with ${x.name(npcId(x))}`, 45, npcId(x)); return 'Two old fools, laughing at what they once fought over.'; } },
      { label: 'Final confrontation', tags: ['violent'], run: (x) => { if (check(x, x.stat('charisma') + x.stat('fear') / 2 + x.stat('wisdom') / 2, 60)) { x.mods({ ego: 6, happiness: 6 }); x.remember('oldRivalDefeated', `Finally defeated ${x.name(npcId(x))}`, 45, npcId(x)); const n = x.npc(npcId(x)); if (n) n.fame = Math.max(0, n.fame - 20); return 'You won. They know it. Everyone knows it.'; } x.mods({ happiness: -8, ego: -6 }); return 'They bested you one last time.'; } },
      { label: 'Ignore them', run: () => 'Some doors should stay closed.' },
    ],
  },
  {
    id: 'sn_lifeReviewChild', cat: 'dynasty', minAge: 50, maxAge: 110, once: true, secret: true,
    when: (x) => x.hasMemory('gaveUpChild', 25),
    title: 'A letter', text: 'A letter arrives from someone who was placed for adoption decades ago. They have found you.',
    memory: { gaveUpChild: 5 },
    choices: [
      { label: 'Meet them', tags: ['help'], run: (x) => { const kid = makeNpc(x, { age: x.age - (x.memory('gaveUpChild')?.age ?? x.age - 30), lastName: x.c.lastName, dynasty: true }); x.addRel(kid.id, 'child', { affinity: 55, trust: 45, meta: { reunited: true } }); x.mods({ happiness: 15, trauma: -10 }); x.remember('reunited', `Reunited with ${kid.firstName}`, 60, kid.id); return `You hold ${kid.firstName}'s hands and the years fall away.`; } },
      { label: 'You cannot face it', run: (x) => { x.mods({ depression: 8 }); return 'The letter sits unanswered in a drawer.'; } },
    ],
  },
  {
    id: 'sn_lifeReviewCrime', cat: 'dynasty', minAge: 50, maxAge: 110, once: true, secret: true,
    when: (x) => x.c.memories.some((m) => m.tag.startsWith('crime_') && x.age - m.age >= 30),
    bind: (x) => { const m = x.c.memories.find((q) => q.tag.startsWith('crime_') && x.age - q.age >= 30); return m ? { what: m.text } : null; },
    title: 'The past returns', text: (x) => `A podcast is investigating a cold case. It is about the time you ${String(x.p.what).toLowerCase().replace(/^committed /, 'committed ')}.`,
    choices: [
      { label: 'Confess', tags: ['help'], run: (x) => { x.mods({ karma: 12, sin: -10, publicImage: -10 }); x.remember('confessed', 'Confessed to an old crime', 50); return 'The weight you carried for decades is gone. The press is brutal, but you sleep.'; } },
      { label: 'Stay silent', tags: ['cautious'], run: (x) => { x.mods({ anxiety: 8, paranoia: 6 }); if (x.chance(0.3)) { x.secret('coldCase', String(x.p.what), 6); return 'The host keeps digging.'; } return 'The trail goes cold again.'; } },
    ],
  },
  {
    id: 'sn_lifeReviewHelped', cat: 'dynasty', minAge: 50, maxAge: 110, once: true, secret: true,
    when: (x) => x.hasMemory('helpedSomeone', 25) || x.hasMemory('defended', 25),
    title: 'A debt repaid', text: 'A wealthy stranger tracks you down. Decades ago, you helped them when nobody else would.',
    memory: { helpedSomeone: 4, defended: 4 },
    auto: (x) => { const gift = x.int(20000, 500000); x.money(gift); x.mods({ happiness: 15, karma: 5 }); x.story('humanitarian', `Billionaire credits childhood kindness for success`, 20); return `They credit you with their success, and insist you accept ${x.fmt(gift)}.`; },
  },
  {
    id: 'sn_retirement', cat: 'senior', minAge: 60, maxAge: 80, cooldown: 5, weight: (x) => (x.c.career && !CAREER_BY_ID[x.c.career.careerId]?.tags.includes('royal') ? 2.5 : 0),
    title: 'Retirement', text: 'Colleagues keep asking when you will retire.',
    choices: [
      { label: 'Retire', run: (x) => retire(x) },
      { label: 'Keep working', tags: ['ambitious'], run: (x) => { x.mods({ stress: 2 }); return 'They will carry you out feet first.'; } },
    ],
  },
  {
    id: 'sn_lossCascade', cat: 'senior', minAge: 65, maxAge: 120, cooldown: 3, weight: 1,
    title: 'Funerals', text: 'Another friend from your youth has died. The funerals come more often now.',
    auto: (x) => { x.mods({ happiness: -5, loneliness: 5, wisdom: 2 }); trauma(x, 3, 'loss'); return 'You are running out of people who remember who you were.'; },
  },
  {
    id: 'sn_elderWisdom', cat: 'senior', minAge: 70, maxAge: 120, cooldown: 3, weight: (x) => (x.stat('karma') > 50 && (x.rels('child').length || x.rels('grandchild').length) ? 2 : 0),
    title: 'Elder wisdom', text: 'Your family gathers to ask your advice.',
    auto: (x) => {
      for (const r of x.rels('child', 'grandchild')) {
        const n = x.npc(r.npcId);
        if (!n) continue;
        n.smarts = Math.min(100, n.smarts + 2);
        n.karma = Math.min(100, n.karma + 3);
        r.affinity = Math.min(100, r.affinity + 5);
      }
      x.s.dynasty.prestige += 2;
      x.mods({ happiness: 6, wisdom: 2 });
      return 'Your descendants carry your wisdom forward.';
    },
  },
  {
    id: 'sn_dementiaFog', cat: 'mental', minAge: 68, maxAge: 120, cooldown: 2, weight: (x) => (x.c.mental.dementiaStage > 0 ? 3 : 0),
    bind: bindRel('child', 'spouse', 'grandchild', 'sibling'),
    title: 'Who are you?', text: (x) => `You look at ${who(x)} and, for a long moment, cannot remember their name.`,
    choices: [
      { label: 'Laugh it off', run: (x) => { x.relMod(npcId(x), -3); return 'They laughed too. Their eyes did not.'; } },
      { label: 'Ask them to help you remember', tags: ['help'], run: (x) => { x.relMod(npcId(x), 6); x.mod('happiness', 2); return 'They tell you stories about your own life.'; } },
      { label: 'Move into assisted care', tags: ['cautious'], run: (x) => { x.spend(Math.min(Math.max(0, x.c.money), 40000)); x.mods({ health: 4, loneliness: 6 }); return 'You lose some independence, gain some safety.'; } },
    ],
  },
  // ------------------------------------------------------------------ elder (85+)
  {
    id: 'el_finalReckoning', cat: 'elder', minAge: 75, maxAge: 130, cooldown: 4, weight: (x) => (x.c.memories.length >= 3 ? 2.5 : 0),
    bind: (x) => { const m = x.c.memories.filter((q) => q.significance >= 25); const pick = m.length ? x.pick(m) : x.c.memories[0]; return pick ? { mem: pick.text, sig: pick.significance } : null; },
    title: 'Final reckoning', text: (x) => `Lying awake, you keep returning to it: ${String(x.p.mem).toLowerCase()}.`,
    choices: [
      { label: 'Reconcile with it', tags: ['help'], run: (x) => { x.mods({ karma: 6, sin: -5, happiness: 4 }); x.bump('reckonings'); return 'You reach out, apologize, make what amends you can.'; } },
      { label: 'Accept it', tags: ['cautious'], run: (x) => { x.mods({ happiness: 8, wisdom: 3 }); x.bump('reckonings'); return 'It happened. It was yours. You let it rest.'; } },
      { label: 'Deny it ever mattered', run: (x) => { x.mods({ happiness: -6 }); return 'The memory does not believe you.'; } },
    ],
  },
  {
    id: 'el_supercentenarian', cat: 'elder', minAge: 100, maxAge: 130, cooldown: 2, weight: 4,
    title: 'Living history', text: (x) => `At ${x.age}, you are one of the oldest people in ${x.countryName}. Reporters want to know your secret.`,
    choices: [
      { label: 'Share your secret', tags: ['social'], run: (x) => { x.mods({ fame: 8, happiness: 6 }); x.story('profile', `${x.c.firstName} ${x.c.lastName} turns ${x.age}`, 25); return `"${x.pick(['A glass of wine every night', 'Never holding a grudge', 'Outliving my enemies', 'Walking every single day', 'Spite'])}," you tell them.`; } },
      { label: 'Write your final memoir', run: (x) => { x.train('writing', 6); x.mods({ wisdom: 4, fame: 4 }); x.money(x.int(5000, 50000)); return 'You are the last person alive who remembers a whole era.'; } },
      { label: 'Receive the head of state', when: (x) => x.age >= 105, run: (x) => { x.mods({ fame: 10, publicImage: 10 }); return `${x.w.ruler} visits to shake your hand.`; } },
    ],
  },
  {
    id: 'el_legendStatus', cat: 'dynasty', minAge: 75, maxAge: 130, once: true, weight: (x) => (x.stat('fame') >= 80 || x.stat('infamy') >= 80 ? 4 : 0),
    title: 'Legend', text: 'Biographies are being written. Schoolchildren know your name.',
    auto: (x) => { x.s.dynasty.prestige += 15; x.mods({ ego: 5, happiness: 5 }); x.remember('legend', 'Became a legend in my own lifetime', 70); return 'Future generations of your family will live in your shadow — or your light.'; },
  },
  // ------------------------------------------------------------------ general adult life
  {
    id: 'ad_lottery', cat: 'adult', minAge: 18, maxAge: 110, cooldown: 10, weight: 0.3, years: [1700, 99999],
    title: 'Lottery ticket', text: 'You found an old lottery ticket in your coat.',
    auto: (x) => { if (x.chance(0.02)) { const won = x.int(1000000, 50000000); x.money(won); x.mods({ happiness: 20 }); x.remember('lottery', `Won ${x.fmt(won)} in the lottery`, 60); return `JACKPOT! You won ${x.fmt(won)}.`; } if (x.chance(0.2)) { x.money(x.int(10, 500)); return 'A small win.'; } return 'Nothing.'; },
  },
  {
    id: 'ad_mugged', cat: 'adult', minAge: 15, maxAge: 100, cooldown: 4, violent: true, weight: (x) => x.w.crimeRate / 40,
    title: 'Mugged', text: 'A figure with a knife steps out of an alley.',
    choices: [
      { label: 'Hand over your wallet', tags: ['cautious'], run: (x) => { const lost = Math.min(Math.max(0, x.c.money), x.int(20, 800)); x.c.money -= lost; trauma(x, 4, 'violence'); return `You lost ${x.fmt(lost)}. You are alive.`; } },
      { label: 'Fight back', tags: ['violent', 'impulsive'], run: (x) => { if (check(x, x.stat('fitness') + x.skill('martialArts') + x.skill('selfDefense'), 70)) { x.mods({ confidence: 6, streetCred: 4 }); return 'You disarmed them. They ran.'; } x.log(`You were stabbed: ${injure(x, true)}`, 'bad'); trauma(x, 12, 'violence'); return 'A bad decision. You survived it.'; } },
      { label: 'Run', run: (x) => (check(x, x.stat('fitness'), 45) ? 'You got away.' : (x.mod('health', -6), 'They caught you.')) },
    ],
  },
  {
    id: 'ad_accident', cat: 'health', minAge: 16, maxAge: 110, cooldown: 4, weight: (x) => 0.5 + (x.curse('misfortune') ? 1.5 : 0) + (x.stat('riskTolerance') > 70 ? 0.5 : 0),
    title: 'Accident', text: (x) => (x.year > 1910 ? 'A car ran a red light and slammed into you.' : 'A runaway cart knocked you into the mud.'),
    auto: (x) => { if (x.chance(0.4)) return `Hospitalized: ${injure(x, false)}`; x.mod('health', -x.int(5, 15)); return 'Bruised and shaken, but whole.'; },
  },
  {
    id: 'ad_inheritanceParent', cat: 'relationship', triggered: true,
    title: 'An inheritance', text: (x) => `${who(x)}'s will has been read.`,
    auto: (x) => { const amt = Math.round(Math.max(0, (x.p.amount as number) || 0)); if (amt > 0) x.money(amt); return amt > 0 ? `You inherited ${x.fmt(amt)}.` : 'There was nothing left.'; },
  },
  {
    id: 'ad_lostWallet', cat: 'adult', minAge: 10, maxAge: 100, cooldown: 6, weight: 0.6,
    title: 'Found wallet', text: 'You find a wallet stuffed with cash on the sidewalk.',
    choices: [
      { label: 'Return it', tags: ['help'], run: (x) => { x.mods({ karma: 6 }); x.remember('helpedSomeone', 'Returned a lost wallet', 10); if (x.chance(0.3)) { x.money(x.int(50, 500)); return 'The grateful owner gave you a reward.'; } return 'The owner wept with relief.'; } },
      { label: 'Keep the cash', tags: ['impulsive'], run: (x) => { x.money(x.int(50, 900)); x.mods({ karma: -4, sin: 1 }); return 'Finders keepers.'; } },
    ],
  },
  {
    id: 'ad_homeless', cat: 'adult', minAge: 18, maxAge: 100, cooldown: 3, weight: (x) => (x.c.money <= 0 && x.c.debt > 10000 && !x.c.career ? 3 : 0),
    title: 'Rock bottom', text: 'You have lost your home. You are sleeping in shelters.',
    choices: [
      { label: 'Ask family for help', tags: ['help'], run: (x) => { const r = x.rels('parent', 'sibling', 'child').sort((a, b) => b.affinity - a.affinity)[0]; if (r && r.affinity > 45) { x.money(x.int(2000, 15000)); x.relMod(r.npcId, -5); return `${x.first(r.npcId)} took you in.`; } return 'Nobody answered.'; } },
      { label: 'Hustle on the streets', tags: ['impulsive'], run: (x) => { x.mods({ streetCred: 6, health: -6 }); x.c.flags.criminalContact = true; x.money(x.int(200, 2000)); return 'You survive by any means necessary.'; } },
      { label: 'Find a shelter program', tags: ['cautious'], run: (x) => { x.mods({ happiness: 4, discipline: 3 }); return 'A caseworker helps you get back on your feet.'; } },
    ],
  },
  {
    id: 'ad_immigrate', cat: 'youngAdult', minAge: 18, maxAge: 50, cooldown: 10, weight: (x) => (x.w.economy < 35 || x.w.stability < 35 || x.w.war !== 'none' ? 1.2 : 0.2),
    title: 'A new life abroad?', text: 'Life at home is hard. People talk about opportunities elsewhere.',
    bind: (x) => { const opts = countriesAvailable(x.year).filter((c) => c.id !== x.c.countryId); const t = x.weighted(opts, (c) => (x.s.world.contexts[c.id]?.economy ?? 50) * 2 + (x.s.world.contexts[c.id]?.stability ?? 50)); return t ? { country: t.id } : null; },
    choices: [
      { label: (x) => `Emigrate to ${countryName(x.p.country as string, x.year)}`, tags: ['ambitious'], run: (x) => { x.c.countryId = x.p.country as string; if (x.c.career) endCareer(x, 'Emigrated'); x.mods({ loneliness: 12, resilience: 4 }); x.train('languages', 10); x.remember('emigrated', `Emigrated to ${countryName(x.c.countryId, x.year)}`, 40); if (x.stat('smarts') < 40 && x.chance(0.4)) return 'The language barrier is brutal. You start over at the bottom.'; return 'You arrive with one suitcase and enormous hope.'; } },
      { label: 'Stay', tags: ['cautious'], run: () => 'Home is home.' },
    ],
  },
  {
    id: 'ad_charity', cat: 'adult', minAge: 25, maxAge: 110, cooldown: 4, weight: (x) => (x.c.money > 200000 ? 1.5 : 0),
    title: 'A worthy cause', text: 'A charity asks for a major donation.',
    choices: [
      { label: 'Donate generously', tags: ['help'], run: (x) => { const d = Math.round(x.c.money * 0.1); x.spend(d); x.mods({ karma: Math.min(20, 3 + Math.log10(d) * 2), publicImage: 6, happiness: 5 }); if (x.famous) x.story('humanitarian', `${x.c.firstName} ${x.c.lastName} donates ${x.fmt(d)}`, 25); x.remember('helpedSomeone', `Donated ${x.fmt(d)} to charity`, 20); if (x.curse('poverty') && d > x.netWorth() * 0.08) { x.c.spiritual.curses = x.c.spiritual.curses.filter((q) => q.id !== 'poverty'); return 'Your generosity breaks the curse of poverty on your family.'; } return `You gave ${x.fmt(d)}.`; } },
      { label: 'Found your own charity', tags: ['ambitious', 'help'], when: (x) => x.c.money > 1000000, run: (x) => { const d = Math.round(x.c.money * 0.2); x.spend(d); x.mods({ karma: 20, publicImage: 12, fame: 6 }); x.s.dynasty.institutions.push({ kind: 'company', name: `the ${x.c.lastName} Foundation` }); x.s.dynasty.reputation.social += 5; x.remember('foundation', `Founded the ${x.c.lastName} Foundation`, 55); return `The ${x.c.lastName} Foundation is born. Tax benefits included.`; } },
      { label: 'Decline', run: () => 'You have your own priorities.' },
    ],
  },
  {
    id: 'ad_memoir', cat: 'adult', minAge: 40, maxAge: 110, once: true, weight: (x) => (x.stat('fame') > 40 ? 2 : 0),
    title: 'Memoir deal', text: 'A publisher offers a fortune for your memoir.',
    choices: [
      { label: 'Tell everything', tags: ['impulsive'], run: (x) => { x.money(x.int(200000, 2000000)); x.mods({ fame: 10 }); const secrets = x.c.media.secrets.filter((s) => !s.exposed); for (const s of secrets) s.exposed = true; if (secrets.length) { x.mods({ publicImage: -5 * secrets.length, infamy: 3 * secrets.length }); return `A bestseller. Your ${secrets.length} secret(s) are now public.`; } return 'A bestseller.'; } },
      { label: 'A sanitized version', run: (x) => { x.money(x.int(50000, 400000)); x.mod('fame', 4); return 'Critics called it "carefully curated."'; } },
      { label: 'Decline', tags: ['cautious'], run: () => 'Some stories die with you.' },
    ],
  },
  {
    id: 'ad_plasticSurgery', cat: 'health', minAge: 25, maxAge: 75, cooldown: 6, years: [1930, 99999], weight: (x) => (x.stat('looks') < 50 || x.stat('fame') > 40 ? 0.8 : 0.2),
    title: 'A little work', text: 'A surgeon promises to take ten years off your face.',
    choices: [
      { label: 'Go under the knife', tags: ['impulsive'], run: (x) => { if (!x.spend(15000)) return 'Not in your budget.'; x.c.bio.cosmetics.push({ id: 'surgery', name: 'Plastic surgery', age: x.age }); if (x.chance(0.12)) { x.mods({ looks: -10, health: -8 }); return 'Complications. You look worse — and feel it.'; } x.mods({ looks: x.int(8, 18), confidence: 5 }); return 'Nobody can tell. Everyone can tell.'; } },
      { label: 'Age gracefully', tags: ['cautious'], run: (x) => { x.mod('wisdom', 1); return 'Wrinkles are a map of where you have been.'; } },
    ],
  },
  {
    id: 'ad_steroids', cat: 'health', minAge: 17, maxAge: 50, once: true, years: [1950, 99999], weight: (x) => (x.c.career && CAREER_BY_ID[x.c.career.careerId]?.tags.includes('sports') ? 2 : x.c.exercise >= 2 ? 0.6 : 0),
    title: 'The gym guy', text: 'A trainer offers you something that will "speed up your gains."',
    choices: [
      { label: 'Start a cycle', tags: ['impulsive'], run: (x) => { x.c.bio.steroidYears = 1; x.c.bio.cosmetics.push({ id: 'steroids', name: 'Steroid use', age: x.age }); x.mods({ fitness: 15, aggression: 6, looks: 3 }); x.secret('steroids', 'Steroid use', x.c.career && CAREER_BY_ID[x.c.career.careerId]?.tags.includes('sports') ? 6 : 2); return 'You are bigger, stronger, angrier. Your heart is working harder.'; } },
      { label: 'Stay natural', tags: ['cautious'], run: (x) => { x.mod('willpower', 2); return 'Slow and steady.'; } },
    ],
  },
  {
    id: 'ad_reunion', cat: 'adult', minAge: 28, maxAge: 70, cooldown: 10, weight: 0.8,
    title: 'Class reunion', text: 'Your old classmates gather. Everyone compares lives.',
    auto: (x) => {
      const nw = x.netWorth();
      if (nw > 1000000 || (x.c.career && x.c.career.level >= 7)) { x.mods({ ego: 4, happiness: 4 }); return 'You were the success story of the night.'; }
      if (x.c.legal.record.length) { x.mod('publicImage', -2); return 'People whispered about your record.'; }
      x.mod('happiness', 2);
      return 'Everyone is fatter, balder and kinder than you remember.';
    },
  },
  {
    id: 'ad_jury', cat: 'adult', minAge: 21, maxAge: 75, cooldown: 10, years: [1700, 99999], weight: 0.4,
    title: 'Jury duty', text: 'You are on the jury in a murder trial. You think the defendant may be innocent.',
    choices: [
      { label: 'Hold out for acquittal', tags: ['help'], run: (x) => { x.mods({ karma: 4, confidence: 3 }); return 'Twelve angry jurors. You turned them one by one.'; } },
      { label: 'Go along with the majority', tags: ['cautious'], run: (x) => { x.mod('karma', -1); return 'Guilty. You will always wonder.'; } },
    ],
  },
  {
    id: 'ad_identityTheftVictim', cat: 'adult', minAge: 18, maxAge: 100, cooldown: 8, years: [1990, 99999], weight: 0.5,
    title: 'Identity stolen', text: 'Someone opened credit cards in your name.',
    auto: (x) => { const loss = x.int(500, 9000); x.c.debt += loss; x.mods({ stress: 6, paranoia: 3 }); return `${x.fmt(loss)} of fraudulent debt. Weeks on hold with the bank.`; },
  },
  {
    id: 'ad_neighborFeud', cat: 'adult', minAge: 25, maxAge: 95, cooldown: 8, weight: 0.6,
    title: 'Neighbor feud', text: 'Your neighbor\'s tree fell on your fence and they refuse to pay.',
    bind: (x) => ({ npcId: makeNpc(x, { age: x.age + x.int(-10, 15) }).id }),
    choices: [
      { label: 'Sue them', run: (x) => { x.addRel(npcId(x), 'rival', { affinity: 20 }); x.c.legal.lawsuits.push({ id: x.uid('suit'), kind: 'contract', role: 'plaintiff', otherParty: x.name(npcId(x)), amount: x.int(2000, 15000), strength: 60, years: 0 }); return 'See you in court.'; } },
      { label: 'Let it go', tags: ['cautious'], run: (x) => { x.addRel(npcId(x), 'acquaintance', { affinity: 45 }); x.mod('karma', 2); return 'You fixed it yourself.'; } },
      { label: 'Escalate', tags: ['violent'], run: (x) => { x.addRel(npcId(x), 'enemy', { affinity: 5 }); x.mods({ aggression: 3, stress: 4 }); return 'You "accidentally" ran over their mailbox. War is declared.'; } },
    ],
  },
  {
    id: 'ad_wealthyMarriageOffer', cat: 'relationship', minAge: 20, maxAge: 60, once: true, weight: (x) => (!x.partner() && x.stat('looks') > 70 ? 1 : 0),
    title: 'A wealthy admirer', text: (x) => `${x.name(npcId(x))} is old, very rich and very interested in you.`,
    bind: (x) => ({ npcId: makeNpc(x, { age: x.age + x.int(20, 40), gender: x.c.gender === 'male' ? 'female' : 'male', wealth: x.int(5000000, 80000000) }).id }),
    choices: [
      { label: 'Marry for money', tags: ['impulsive'], run: (x) => { x.addRel(npcId(x), 'spouse', { affinity: 40, trust: 35, meta: { forMoney: true } }); const n = x.npc(npcId(x)); if (n) n.spouseId = x.c.id; x.mods({ happiness: 4, karma: -2, publicImage: -3 }); x.money(Math.round((n?.wealth ?? 0) * 0.05)); x.remember('marriedForMoney', 'Married for money', 40, npcId(x)); return 'A lavish wedding. Their children hate you already.'; } },
      { label: 'Decline', run: () => 'Money cannot buy you.' },
    ],
  },
  {
    id: 'ad_charityScam', cat: 'adult', minAge: 25, maxAge: 100, cooldown: 8, weight: (x) => (x.c.money > 50000 ? 0.4 : 0),
    title: 'Investment opportunity', text: 'A smooth-talking advisor promises 30% annual returns, guaranteed.',
    choices: [
      { label: 'Invest', tags: ['impulsive'], run: (x) => { const amt = Math.round(x.c.money * 0.3); x.spend(amt); if (x.chance(0.15)) { x.money(amt * 2); return 'Astonishingly, it paid off.'; } x.mods({ happiness: -10, paranoia: 4 }); x.remember('scammed', 'Lost money to a Ponzi scheme', 25); return `It was a Ponzi scheme. ${x.fmt(amt)} gone.`; } },
      { label: 'Walk away', tags: ['cautious'], run: (x) => { x.mod('wisdom', 2); return 'If it sounds too good to be true…'; } },
    ],
  },
];

