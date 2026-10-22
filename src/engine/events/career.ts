import type { EventDef } from './types';
import { check, npcId, who } from './helpers';
import { CAREERS, CAREER_BY_ID, careerTitle, type CareerCat, type CareerDef } from '../data/careers';
import { promote, endCareer, currentTitle } from '../systems/careers';
import { injure } from '../systems/body';
import { trauma } from '../systems/mind';
import { makeNpc } from '../systems/npcs';
import { commitCrime, openCase } from '../systems/legal';
import type { Ctx } from '../ctx';

function inCareer(x: Ctx, id: string): boolean {
  return x.c.career?.careerId === id;
}

function nextTitle(x: Ctx, def: CareerDef): string {
  const lvl = Math.min(10, (x.c.career?.level ?? 1) + 1);
  return careerTitle(def, lvl, !!x.c.career?.branch);
}

interface Flavor {
  brk: string;
  crisis: string;
  ethical: string;
  corner: string;
  apex: string;
  bold: string;
  legacy: string;
}

/** Category flavor for the per-career templated events. {c} = career name, {t} = current title, {n} = next title. */
const FLAVOR: Record<CareerCat, Flavor> = {
  medical: { brk: 'A patient everyone else gave up on is wheeled in. Save them and you become the {n} everyone talks about.', crisis: 'A colleague\'s mistake nearly killed a patient. The family is asking questions.', ethical: 'Report the error honestly', corner: 'Help cover it up', apex: 'You are offered the chance to pioneer a radical new procedure.', bold: 'Perform it on a dying patient', legacy: 'Spend years in careful trials' },
  legal: { brk: 'A headline case lands on your desk. Win it and you are the next {n}.', crisis: 'Your client quietly confesses they are guilty — and that they will do it again.', ethical: 'Follow your ethical duty', corner: 'Keep quiet and win anyway', apex: 'A landmark case could change the law of the land.', bold: 'Argue it before the highest court', legacy: 'Mentor the next generation instead' },
  military: { brk: 'Your unit is chosen for a high-profile operation. Success means promotion to {n}.', crisis: 'Your commander orders something that may be a war crime.', ethical: 'Refuse the order', corner: 'Follow orders', apex: 'You are given command of a decisive campaign.', bold: 'Launch a daring offensive', legacy: 'Fight a careful war that saves lives' },
  lawEnforcement: { brk: 'You are first on scene at a major case. Crack it and make {n}.', crisis: 'Your partner has been skimming from evidence lockers.', ethical: 'Report your partner', corner: 'Look the other way', apex: 'You can take down the biggest crime figure in the city.', bold: 'Run a risky undercover sting', legacy: 'Build an airtight case over years' },
  business: { brk: 'A huge deal is within reach. Close it and you are the next {n}.', crisis: 'You discover the books have been cooked — and your signature is on them.', ethical: 'Blow the whistle', corner: 'Help hide it', apex: 'You could orchestrate the merger of the decade.', bold: 'Pull off a hostile takeover', legacy: 'Build something that lasts' },
  tech: { brk: 'Your side project is going viral inside the company. Ship it and become {n}.', crisis: 'A data breach exposes millions of users. Leadership wants to delay disclosure.', ethical: 'Disclose immediately', corner: 'Delay and patch quietly', apex: 'You have a chance to build the defining product of the era.', bold: 'Bet the company on it', legacy: 'Open-source it for the world' },
  science: { brk: 'Your experiment produces an astonishing result. Publish it and become {n}.', crisis: 'Your landmark data will not replicate. Your grant renewal is due.', ethical: 'Retract and start over', corner: 'Massage the data', apex: 'You are on the verge of a world-changing discovery.', bold: 'Race to publish first', legacy: 'Share it freely with rivals' },
  education: { brk: 'Your students win a national competition. The district wants you as {n}.', crisis: 'A student confides that they are being abused at home.', ethical: 'Report it to the authorities', corner: 'Stay out of family business', apex: 'You could reshape education for an entire region.', bold: 'Push radical reforms', legacy: 'Quietly change one life at a time' },
  creative: { brk: 'A major patron or label notices your work. This could make you a {n}.', crisis: 'You discover your hit was "inspired" — very closely — by an unknown artist.', ethical: 'Credit them publicly', corner: 'Say nothing', apex: 'You feel your masterpiece forming.', bold: 'Sacrifice everything to finish it', legacy: 'Make something for future generations' },
  entertainment: { brk: 'You are offered a career-making role. Nail it and become {n}.', crisis: 'A powerful producer makes an inappropriate proposition and implies your career depends on it.', ethical: 'Refuse and report them publicly', corner: 'Refuse quietly and stay silent', apex: 'The role of a lifetime is offered to you.', bold: 'Go all in, method style', legacy: 'Use your platform for a cause' },
  sports: { brk: 'The championship comes down to you. Win and you are the next {n}.', crisis: 'Your coach offers performance-enhancing drugs that will not show up on tests.', ethical: 'Refuse', corner: 'Take them', apex: 'One last shot at immortality.', bold: 'Play through the injury', legacy: 'Retire on top' },
  trades: { brk: 'A huge contract needs a skilled hand. Deliver it and become {n}.', crisis: 'The boss wants you to skip safety steps to finish faster.', ethical: 'Do it by the book', corner: 'Cut the corners', apex: 'You can open your own business and train apprentices.', bold: 'Expand aggressively', legacy: 'Build a business your kids inherit' },
  service: { brk: 'A regular turns out to be someone powerful who offers you a step up to {n}.', crisis: 'Your manager is stealing tips from the whole staff.', ethical: 'Confront them with the team', corner: 'Take a cut to stay quiet', apex: 'You could buy the place.', bold: 'Buy it with borrowed money', legacy: 'Make it a place staff love to work' },
  government: { brk: 'A minister notices your memo. A step up to {n} is possible.', crisis: 'A contract is being steered to a minister\'s cousin.', ethical: 'Leak the documents', corner: 'Rubber-stamp it', apex: 'You could quietly run the machinery of the state.', bold: 'Bend the bureaucracy to your will', legacy: 'Make government work for ordinary people' },
  politics: { brk: 'A rousing speech goes viral. Party bosses talk about you as a future {n}.', crisis: 'Your campaign is offered illegal foreign money.', ethical: 'Refuse and report it', corner: 'Take the money', apex: 'The movement could sweep the nation.', bold: 'Seize the moment', legacy: 'Build a movement that outlives you' },
  religion: { brk: 'Your sermons draw crowds. The hierarchy considers you for {n}.', crisis: 'You learn a senior cleric has been abusing his position.', ethical: 'Report him to authorities', corner: 'Protect the institution', apex: 'You could lead your faith into a new era.', bold: 'Call for sweeping reform', legacy: 'Serve the poor and let your example speak' },
  criminal: { brk: 'A score bigger than anything you have done. Pull it off and you are {n}.', crisis: 'A rookie on your crew is getting sloppy and drawing police attention.', ethical: 'Cut them loose gently', corner: 'Make an example of them', apex: 'You can become the undisputed power in the underworld.', bold: 'Wipe out your rivals', legacy: 'Go legitimate while you can' },
  royalty: { brk: 'A foreign power proposes an alliance that would make you {n}.', crisis: 'Famine strikes your lands. Nobles want taxes raised anyway.', ethical: 'Open the granaries', corner: 'Raise taxes', apex: 'History will judge your reign by what you do now.', bold: 'Expand your realm by conquest', legacy: 'Build cathedrals, schools and roads' },
  frontier: { brk: 'An uncharted opportunity opens. Lead it and become {n}.', crisis: 'Supplies are running out. Someone has to decide who goes without.', ethical: 'Share equally, including yourself', corner: 'Save yourself first', apex: 'You could lead the expedition that defines an age.', bold: 'Push into the unknown', legacy: 'Map the way for those who follow' },
  secret: { brk: 'Word of your rare skills spreads in certain circles. You could become {n}.', crisis: 'Someone has discovered what you really do.', ethical: 'Come clean', corner: 'Silence them', apex: 'Your hidden art reaches its peak.', bold: 'Use it without restraint', legacy: 'Pass it on to a single worthy successor' },
};

function fill(s: string, x: Ctx, def: CareerDef): string {
  return s.replace('{c}', def.name.toLowerCase()).replace('{t}', currentTitle(x)).replace('{n}', nextTitle(x, def));
}

function templated(def: CareerDef): EventDef[] {
  const f = FLAVOR[def.cat];
  const risky = def.tags.includes('criminal') || def.cat === 'military' || def.cat === 'lawEnforcement';
  return [
    {
      id: `cr_${def.id}_break`, cat: 'career', minAge: 14, cooldown: 4,
      when: (x) => inCareer(x, def.id) && (x.c.career?.level ?? 10) < 10,
      weight: 1.3,
      title: `${def.name}: the big break`,
      text: (x) => fill(f.brk, x, def),
      choices: [
        { label: 'Seize it', tags: ['ambitious'], run: (x) => {
          const cs = x.c.career!;
          x.mods({ stress: 5 });
          if (check(x, cs.performance / 2 + x.stat('discipline') / 2 + (def.trains[0] ? x.skill(def.trains[0]) / 2 : 0), 55)) {
            const t = promote(x);
            if (def.fame) x.mod('fame', def.fame);
            x.remember(`break_${def.id}`, `Big break as ${t}`, 30);
            return `It paid off. You are now ${t}.`;
          }
          cs.performance = Math.max(0, cs.performance - 12);
          if (risky && x.chance(0.25)) return `It went badly wrong: ${injure(x, def.cat === 'military')}`;
          return 'You fell short. People noticed.';
        } },
        { label: 'Let someone else take the risk', tags: ['cautious'], run: (x) => { x.c.career!.performance += 2; return 'Steady wins the race. Sometimes.'; } },
      ],
    },
    {
      id: `cr_${def.id}_crisis`, cat: 'career', minAge: 14, cooldown: 5,
      when: (x) => inCareer(x, def.id),
      weight: 1,
      title: `${def.name}: a crisis of conscience`,
      text: (x) => fill(f.crisis, x, def),
      choices: [
        { label: f.ethical, tags: ['help'], run: (x) => {
          x.mods({ karma: 8, professionalRep: x.chance(0.5) ? 4 : -4 });
          if (x.chance(0.3)) { x.c.career!.performance -= 15; return 'Doing the right thing cost you professionally. You can live with that.'; }
          x.remember('integrity', `Chose integrity as ${currentTitle(x)}`, 25);
          return 'It was hard. It was right.';
        } },
        { label: f.corner, tags: ['impulsive'], run: (x) => {
          x.mods({ karma: -8, sin: 3 });
          x.c.career!.performance += 8;
          x.secret(`career_${def.id}`, `What you did as ${currentTitle(x).toLowerCase()}`, def.tags.includes('criminal') ? 3 : 5);
          if (def.tags.includes('criminal') && f.corner.includes('example')) return commitCrime(x, 'assault').text;
          if (x.chance(0.15)) { openCase(x, def.tags.includes('medical') || def.cat === 'business' ? 'fraud' : 'briberyOfficial', { mult: 0.8 }); return 'It worked — but someone kept records.'; }
          return 'Nobody will know. You will.';
        } },
      ],
    },
    {
      id: `cr_${def.id}_apex`, cat: 'career', minAge: 25, once: true,
      when: (x) => inCareer(x, def.id) && (x.c.career?.level ?? 0) >= 8,
      weight: 3,
      title: `${def.name}: the defining moment`,
      text: (x) => fill(f.apex, x, def),
      choices: [
        { label: f.bold, tags: ['ambitious', 'impulsive'], run: (x) => {
          x.mods({ stress: 8 });
          if (check(x, x.c.career!.performance + x.stat('riskTolerance') / 2, 80)) {
            if (x.c.career!.level < 10) promote(x);
            x.mods({ fame: 10 + (def.fame ?? 0) * 2, professionalRep: 12, ego: 6 });
            if (def.tags.includes('criminal')) x.mods({ criminalRep: 15, fear: 12, heat: 15 });
            x.money(x.c.career!.salary);
            x.remember('careerApex', `The defining triumph of my career as ${currentTitle(x)}`, 70);
            x.s.dynasty.prestige += 5;
            return `A triumph. You are remembered as ${currentTitle(x)}.`;
          }
          x.c.career!.performance -= 25;
          x.mods({ publicImage: -8, happiness: -8 });
          if (risky && x.chance(0.3)) trauma(x, 12, 'violence');
          return 'It collapsed spectacularly. Your enemies are delighted.';
        } },
        { label: f.legacy, tags: ['help'], run: (x) => {
          x.mods({ karma: 8, wisdom: 6, publicImage: 6, happiness: 6 });
          x.s.dynasty.prestige += 3;
          x.remember('careerLegacy', `Built a lasting legacy as ${currentTitle(x)}`, 55);
          const p = makeNpc(x, { age: x.int(20, 30), career: def.id, careerLevel: 2 });
          x.addRel(p.id, 'protege', { affinity: 75, trust: 70 });
          return `Quieter, but lasting. ${p.firstName} ${p.lastName} will carry your work forward.`;
        } },
      ],
    },
  ];
}

/** Career events: branch choices, cross-career workplace events and per-career templates. */
export const CAREER_EVENTS: EventDef[] = [
  {
    id: 'career_branch', cat: 'career', triggered: true,
    title: 'A fork in the road', text: (x) => { const def = CAREER_BY_ID[x.p.careerId as string]; return def?.branch ? `Your career as ${def.name.toLowerCase()} could branch: ${def.branch.name} — ${def.branch.desc}` : 'A new opportunity.'; },
    choices: [
      { label: (x) => `Take the ${CAREER_BY_ID[x.p.careerId as string]?.branch?.name ?? 'new'} track`, tags: ['ambitious'], run: (x) => { if (x.c.career && x.c.career.careerId === x.p.careerId) x.c.career.branch = true; return `You are now ${currentTitle(x)}.`; } },
      { label: 'Stay on the traditional ladder', tags: ['cautious'], run: () => 'You stay the course.' },
    ],
  },
  {
    id: 'cw_raise', cat: 'career', minAge: 16, cooldown: 3, weight: (x) => (x.c.career && x.c.career.performance > 60 ? 1.2 : 0),
    title: 'Ask for a raise?', text: 'You have been crushing it. Time to ask for more money?',
    choices: [
      { label: 'Ask boldly', tags: ['ambitious'], run: (x) => { if (check(x, x.c.career!.performance / 2 + x.stat('confidence') / 2 + x.skill('negotiation'), 60)) { x.c.career!.salary = Math.round(x.c.career!.salary * 1.12); x.money(x.c.career!.salary * 0.08); return 'Granted. A 12% bump.'; } x.c.career!.performance -= 5; return 'Denied. Awkward.'; } },
      { label: 'Wait for them to notice', tags: ['cautious'], run: () => 'They did not notice.' },
    ],
  },
  {
    id: 'cw_poached', cat: 'career', minAge: 20, cooldown: 4, weight: (x) => (x.c.career && x.stat('professionalRep') > 50 && !CAREER_BY_ID[x.c.career.careerId]?.tags.includes('royal') ? 1 : 0),
    title: 'Headhunted', text: 'A rival firm offers you a better title and 30% more money.',
    choices: [
      { label: 'Jump ship', tags: ['ambitious'], run: (x) => { const cs = x.c.career!; cs.salary = Math.round(cs.salary * 1.3); cs.yearsInRole = 0; if (x.chance(0.5)) promote(x); x.relMod(cs.bossId, -15); return `You are now ${currentTitle(x)} somewhere new.`; } },
      { label: 'Use it to negotiate', run: (x) => { if (x.chance(0.6)) { x.c.career!.salary = Math.round(x.c.career!.salary * 1.15); return 'Your boss matched — mostly.'; } return 'Your boss called your bluff.'; } },
      { label: 'Stay loyal', tags: ['cautious'], run: (x) => { x.relMod(x.c.career?.bossId, 8, 8); return 'Loyalty, noted.'; } },
    ],
  },
  {
    id: 'cw_harassmentWitness', cat: 'career', minAge: 18, cooldown: 6, weight: (x) => (x.c.career && x.year > 1960 ? 0.6 : 0),
    title: 'Something is wrong', text: 'You witness a senior colleague harassing a junior employee.',
    choices: [
      { label: 'Report it', tags: ['help'], run: (x) => { x.mods({ karma: 6 }); if (x.chance(0.4)) { x.c.career!.performance -= 8; return 'HR protected the senior colleague. You are now "difficult".'; } x.mods({ professionalRep: 4 }); return 'An investigation followed. Things changed.'; } },
      { label: 'Support the victim privately', tags: ['help'], run: (x) => { const v = makeNpc(x, { age: x.int(20, 30) }); x.addRel(v.id, 'friend', { affinity: 70, trust: 70 }); x.mod('karma', 3); return 'You helped them document everything.'; } },
      { label: 'Stay out of it', tags: ['cautious'], run: (x) => { x.mod('karma', -2); return 'Not your business. It bothers you anyway.'; } },
    ],
  },
  {
    id: 'cw_sideHustle', cat: 'career', minAge: 18, cooldown: 5, weight: 0.6,
    title: 'Side hustle', text: 'A friend suggests a side business on weekends.',
    choices: [
      { label: 'Go for it', tags: ['ambitious'], run: (x) => { x.train('entrepreneurship', 5); x.mods({ stress: 4 }); if (x.chance(0.45)) { const m = x.int(3000, 40000); x.money(m); return `It made ${x.fmt(m)} this year.`; } return 'It barely broke even.'; } },
      { label: 'Rest on weekends', tags: ['cautious'], run: (x) => { x.mods({ stress: -3 }); return 'You need the downtime.'; } },
    ],
  },
  {
    id: 'cw_workAccident', cat: 'career', minAge: 14, cooldown: 4, weight: (x) => (x.c.career && (CAREER_BY_ID[x.c.career.careerId]?.injury ?? 0) > 0.02 ? 1.2 : 0),
    title: 'On-the-job accident', text: 'Something went badly wrong at work.',
    choices: [
      { label: 'Sue your employer', run: (x) => { x.log(injure(x, false), 'bad'); x.c.legal.lawsuits.push({ id: x.uid('suit'), kind: 'contract', role: 'plaintiff', otherParty: x.c.career?.employer ?? 'your employer', amount: x.int(20000, 400000), strength: 60, years: 0 }); return 'Your lawyer smells a settlement.'; } },
      { label: 'Tough it out', run: (x) => { x.mods({ health: -8, pain: 10 }); x.c.career!.performance += 4; return 'Back to work the next day.'; } },
    ],
  },
  {
    id: 'cw_insiderTip', cat: 'career', minAge: 21, cooldown: 6, years: [1900, 99999], weight: (x) => (x.c.career && ['business', 'legal', 'tech'].includes(CAREER_BY_ID[x.c.career.careerId]?.cat ?? '') ? 0.8 : 0),
    title: 'Insider information', text: 'You learn about a merger before it is announced.',
    choices: [
      { label: 'Trade on it', tags: ['impulsive'], run: (x) => { const m = x.int(10000, 300000); x.money(m); x.mods({ karma: -4 }); if (x.chance(0.25)) { openCase(x, 'fraud', { label: 'Insider trading', mult: 1.2 }); return `You made ${x.fmt(m)}. Regulators noticed.`; } return `You made ${x.fmt(m)} overnight.`; } },
      { label: 'Keep it confidential', tags: ['cautious'], run: (x) => { x.mod('karma', 2); return 'Integrity, unrewarded.'; } },
    ],
  },
  {
    id: 'cw_mentorship', cat: 'career', minAge: 35, cooldown: 6, weight: (x) => (x.c.career && x.c.career.level >= 6 ? 0.8 : 0),
    title: 'A bright young hire', text: (x) => `${who(x)} reminds you of yourself at their age.`,
    bind: (x) => ({ npcId: makeNpc(x, { age: x.int(21, 28), career: x.c.career!.careerId, careerLevel: 1 }).id }),
    choices: [
      { label: 'Take them under your wing', tags: ['help'], run: (x) => { x.addRel(npcId(x), 'protege', { affinity: 70, trust: 65 }); x.train('mentoring', 6); x.mods({ wisdom: 3 }); return 'Teaching sharpens you too.'; } },
      { label: 'See them as a threat', run: (x) => { x.addRel(npcId(x), 'rival', { affinity: 30 }); return 'You keep them at arm\'s length.'; } },
    ],
  },
  {
    id: 'cw_frontlineMedic', cat: 'career', minAge: 20, cooldown: 2, weight: (x) => (x.c.career && CAREER_BY_ID[x.c.career.careerId]?.cat === 'medical' && x.w.healthCrisis ? 3 : 0),
    title: 'The front line', text: 'The epidemic is overwhelming the hospital. You are needed around the clock.',
    choices: [
      { label: 'Work every shift', tags: ['help'], run: (x) => { x.mods({ karma: 10, stress: 12, publicImage: 6 }); trauma(x, 8, 'disaster'); x.c.career!.performance += 15; if (x.chance(0.3)) x.mod('health', -20); x.remember('frontline', 'Worked the front line of an epidemic', 45); return 'They call you a hero. You just want to sleep.'; } },
      { label: 'Protect yourself', tags: ['cautious'], run: (x) => { x.mods({ karma: -2 }); return 'You keep reasonable hours. Some colleagues resent it.'; } },
    ],
  },
  {
    id: 'cw_deployment', cat: 'career', minAge: 17, cooldown: 2, violent: true, weight: (x) => (x.c.career && CAREER_BY_ID[x.c.career.careerId]?.tags.includes('military') && x.w.war !== 'none' ? 3 : 0),
    title: 'Deployment', text: (x) => `You are deployed to the front${x.w.warName ? ` of the ${x.w.warName}` : ''}.`,
    choices: [
      { label: 'Volunteer for the dangerous mission', tags: ['ambitious', 'violent'], run: (x) => { trauma(x, 18, 'combat'); if (x.chance(0.3)) x.log(injure(x, true), 'bad'); if (x.chance(0.5)) { promote(x); x.mods({ fame: 6 }); x.c.flags.warHero = true; return 'Mission accomplished. Medals and promotion.'; } return 'You survived. Barely.'; } },
      { label: 'Do your duty', run: (x) => { trauma(x, 10, 'combat'); if (x.chance(0.15)) x.log(injure(x, true), 'bad'); return 'You did what was asked.'; } },
      { label: 'Request a desk posting', tags: ['cautious'], run: (x) => { x.c.career!.performance -= 10; return 'You serve behind the lines.'; } },
    ],
  },
  {
    id: 'cw_policeCorruption', cat: 'career', minAge: 20, cooldown: 4, weight: (x) => (x.c.career && CAREER_BY_ID[x.c.career.careerId]?.tags.includes('police') ? 1.2 : 0),
    title: 'An envelope', text: 'A local crime boss sends an envelope thick with cash. "For your trouble."',
    choices: [
      { label: 'Take it', tags: ['impulsive'], run: (x) => { x.money(x.int(5000, 50000)); x.mods({ corruption: 10, karma: -6 }); x.secret('dirtyCop', 'Taking bribes as a police officer', 8); const boss = makeNpc(x, { age: x.int(35, 60), karma: -60, criminal: 80 }); x.addRel(boss.id, 'coConspirator', { affinity: 50, trust: 30 }); return 'You are on the payroll now.'; } },
      { label: 'Arrest the courier', tags: ['help'], run: (x) => { x.c.career!.performance += 10; x.mods({ karma: 5 }); const boss = makeNpc(x, { age: x.int(35, 60), karma: -60, criminal: 80 }); x.addRel(boss.id, 'enemy', { affinity: 5 }); return 'You made a powerful enemy.'; } },
    ],
  },
  {
    id: 'cw_doping', cat: 'career', minAge: 16, cooldown: 3, weight: (x) => (x.c.career && CAREER_BY_ID[x.c.career.careerId]?.tags.includes('sports') && x.c.media.secrets.some((s) => s.id === 'steroids') ? 1.5 : 0),
    title: 'Random drug test', text: 'Officials show up for an unannounced drug test.',
    auto: (x) => { if (x.chance(0.5)) { const s = x.c.media.secrets.find((q) => q.id === 'steroids'); if (s) s.exposed = true; x.mods({ publicImage: -20, fame: 5, professionalRep: -25 }); endCareer(x, 'Banned for doping'); x.remember('doping', 'Banned for doping', 50); return 'Positive. You are banned from competition.'; } return 'Clean — this time.'; },
  },
  {
    id: 'cw_royalDuty', cat: 'career', minAge: 16, cooldown: 2, weight: (x) => (x.c.career && CAREER_BY_ID[x.c.career.careerId]?.tags.includes('royal') ? 1.5 : 0),
    title: 'Affairs of state', text: 'Petitioners line the throne room. A province demands lower taxes; the treasury is empty.',
    choices: [
      { label: 'Lower taxes', tags: ['help'], run: (x) => { x.mods({ politicalApproval: 8, karma: 3 }); x.w.stabShock += 4; x.c.money -= Math.min(x.c.money, 100000); return 'The people cheer. The treasurer weeps.'; } },
      { label: 'Hold firm', tags: ['cautious'], run: (x) => { x.mods({ politicalApproval: -3 }); return 'Order, at a cost.'; } },
      { label: 'Raise taxes on the nobles', tags: ['impulsive'], run: (x) => { x.money(200000); x.mods({ fear: 4 }); x.w.stabShock -= 4; return 'The nobles grumble and sharpen their knives.'; } },
    ],
  },
  ...CAREERS.flatMap(templated),
];

