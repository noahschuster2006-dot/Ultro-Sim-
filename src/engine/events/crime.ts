import type { ChainDef, EventDef } from './types';
import { check, npcId, who } from './helpers';
import { commitCrime, enterWitnessProtection, escapePrison, fleeTo, joinPrisonGang, openCase, release, tryCase, updateEvidenceStat } from '../systems/legal';
import { injure } from '../systems/body';
import { trauma } from '../systems/mind';
import { makeNpc, ripple } from '../systems/npcs';
import { canExtradite, COUNTRY_BY_ID, countriesAvailable } from '../data/countries';
import { die } from '../systems/dynasty';
import { orgRankName } from '../systems/underworld';
import { CAREER_BY_ID } from '../data/careers';
import { startCareer } from '../systems/careers';
import type { Ctx } from '../ctx';

function caseOf(x: Ctx) {
  return x.c.legal.cases.find((k) => k.id === x.p.caseId);
}

function trial(x: Ctx, lawyer: number, plea: boolean, bribe: boolean, jury: boolean, cost: number): string {
  if (cost && !x.spend(cost)) return 'You could not afford that defense.';
  const v = tryCase(x, x.p.caseId as string, lawyer, plea, bribe, jury);
  return v.text;
}

/** Crime opportunities, the legal system and prison life. */
export const CRIME_EVENTS: EventDef[] = [
  // ------------------------------------------------------------------ arrests & trials
  {
    id: 'legal_arrest', cat: 'legal', triggered: true,
    title: 'Under arrest', text: (x) => `Police are at your door about the ${caseOf(x)?.label.toLowerCase() ?? 'crime'}. Evidence: ${Math.round(caseOf(x)?.evidence ?? 0)}/100.`,
    choices: [
      { label: 'Go quietly', tags: ['cautious'], run: (x) => { const k = caseOf(x); if (!k) return 'They let you go.'; k.status = 'charged'; x.c.legal.arrests++; x.queue('legal_trial', { caseId: k.id }, true); return 'You were booked and held for trial.'; } },
      { label: 'Resist arrest', tags: ['violent', 'impulsive'], run: (x) => { const k = caseOf(x); if (!k) return ''; x.c.legal.arrests++; if (check(x, x.stat('fitness') + x.skill('streetFighting'), 80)) { x.c.legal.fugitive = true; openCase(x, 'assault', { mult: 1.5 }); x.mods({ streetCred: 8, heat: 20 }); return 'You fought your way out. Now you are a fugitive.'; } x.log(injure(x, true), 'bad'); openCase(x, 'assault', { mult: 2 }); k.status = 'charged'; x.queue('legal_trial', { caseId: k.id }, true); return 'They beat you down. Assaulting an officer has been added to the charges.'; } },
      { label: 'Flee the country', tags: ['impulsive'], when: (x) => x.c.money >= 15000 || x.c.crime.dirtyMoney >= 15000, run: (x) => {
        const safe = countriesAvailable(x.year).filter((c) => c.id !== x.c.countryId && !canExtradite(x.c.countryId, c.id));
        if (!safe.length || !x.chance(0.55 + x.skill('evasion') / 200)) { const k = caseOf(x); if (k) { k.status = 'charged'; x.queue('legal_trial', { caseId: k.id }, true); } return 'Stopped at the border.'; }
        if (x.c.money < 15000) { x.c.crime.dirtyMoney -= 15000; x.c.money += 15000; }
        return fleeTo(x, x.pick(safe).id);
      } },
      { label: 'Bribe the officers', tags: ['impulsive'], when: (x) => x.c.money >= 5000, run: (x) => { const k = caseOf(x); const country = COUNTRY_BY_ID[x.c.countryId]; x.spend(Math.min(x.c.money, 5000 + (k?.severity ?? 1) * 5000)); if (x.chance(country.judicialCorruption / 100 + x.stat('corruption') / 200 + x.skill('bribery') / 300)) { if (k) k.evidence = Math.max(0, k.evidence - 45); updateEvidenceStat(x); x.mods({ corruption: 6 }); x.train('bribery', 6); return 'Evidence goes missing from the locker. The officers have short memories.'; } if (k) { k.status = 'charged'; x.queue('legal_trial', { caseId: k.id }, true); } openCase(x, 'briberyOfficial', { mult: 1.5 }); return 'The officer was honest. Bribery charges added.'; } },
    ],
  },
  {
    id: 'legal_trial', cat: 'legal', triggered: true, prison: true,
    title: 'The trial', text: (x) => { const k = caseOf(x); return `You stand trial for ${k?.label.toLowerCase() ?? 'your crimes'}. The prosecution's evidence is ${k && k.evidence > 80 ? 'overwhelming' : k && k.evidence > 60 ? 'strong' : 'circumstantial'}.${x.c.legal.record.length ? ` You have ${x.c.legal.record.length} prior conviction(s).` : ''}`; },
    choices: [
      { label: 'Take a plea deal', hint: 'Guaranteed conviction, half the sentence', tags: ['cautious'], run: (x) => trial(x, 0, true, false, false, 0) },
      { label: 'Public defender', tags: ['cautious'], run: (x) => trial(x, 0, false, false, false, 0) },
      { label: 'Hire a good lawyer ($40K)', when: (x) => x.c.money >= 40000, run: (x) => trial(x, 1, false, false, false, 40000) },
      { label: 'Elite legal team ($300K)', tags: ['ambitious'], when: (x) => x.c.money >= 300000, run: (x) => trial(x, 2, false, false, false, 300000) },
      { label: 'Celebrity dream team ($1.5M)', tags: ['ambitious'], when: (x) => x.c.money >= 1500000, run: (x) => trial(x, 3, false, false, false, 1500000) },
      { label: 'Elite team + bribe the judge ($600K)', tags: ['impulsive'], when: (x) => x.c.money >= 600000, run: (x) => trial(x, 2, false, true, false, 600000) },
      { label: 'Have your people lean on the jury', tags: ['violent'], when: (x) => x.stat('criminalRep') >= 40 || x.c.crime.orgRank >= 2, run: (x) => trial(x, 1, false, false, true, 0) },
    ],
  },
  {
    id: 'parole_hearing', cat: 'legal', triggered: true, prison: true,
    title: 'Parole hearing', text: (x) => `After ${x.c.legal.prison?.served} years, the parole board will hear your case.`,
    choices: [
      { label: 'Show genuine remorse', tags: ['help'], run: (x) => { const P = x.c.legal.prison; if (!P) return ''; if (check(x, P.goodBehavior + x.stat('charisma') / 2 + x.stat('karma') / 4, 70)) { release(x, 'Paroled', 3); return 'Parole granted. Three years of check-ins.'; } return 'Denied. "Come back in a year."'; } },
      { label: 'Bribe a board member', tags: ['impulsive'], when: (x) => x.c.money + x.c.crime.dirtyMoney > 30000, run: (x) => { if (x.c.money >= 30000) x.spend(30000); else x.c.crime.dirtyMoney -= 30000; if (x.chance(0.45)) { release(x, 'Paroled', 3); x.mod('corruption', 5); return 'Parole granted, mysteriously.'; } x.c.legal.prison!.sentence += 2; return 'The board member reported you. Two years added.'; } },
      { label: 'Refuse to grovel', run: (x) => { x.mods({ ego: 3 }); return 'You will serve your time on your own terms.'; } },
    ],
  },
  {
    id: 'death_row_appeal', cat: 'legal', triggered: true, prison: true,
    title: 'Death row', text: (x) => `Your appeals are running out (${x.c.legal.prison?.appeals ?? 0} left).`,
    choices: [
      { label: 'File an appeal', tags: ['ambitious'], when: (x) => (x.c.legal.prison?.appeals ?? 0) > 0, run: (x) => {
        const P = x.c.legal.prison!;
        P.appeals--;
        const p = 0.18 + x.c.legal.lawyer * 0.08 + (x.stat('fame') > 50 ? 0.1 : 0) + (x.w.socialNorms > 70 ? 0.1 : 0);
        if (x.chance(p)) {
          if (x.chance(0.25)) { release(x, 'Exonerated'); x.mods({ happiness: 25 }); x.remember('exonerated', 'Exonerated from death row', 80); return 'Exonerated! New evidence cleared your name.'; }
          P.tier = 'state'; P.sentence = 40; P.served = 0;
          x.remember('commuted', 'Death sentence commuted to life', 70);
          return 'Your sentence was commuted to life in prison.';
        }
        return 'Appeal denied.';
      } },
      { label: 'Make your peace', tags: ['cautious'], when: (x) => (x.c.legal.prison?.appeals ?? 0) <= 0, run: (x) => { x.mods({ faith: 10, karma: 5, sin: -10 }); die(x, 'execution by the state', 'execution'); return 'The sentence was carried out.'; } },
      { label: 'Defiance to the last', when: (x) => (x.c.legal.prison?.appeals ?? 0) <= 0, run: (x) => { x.mods({ infamy: 10 }); die(x, 'execution by the state', 'execution'); return 'Your last words became infamous.'; } },
    ],
  },
  {
    id: 'prison_partner_leaves', cat: 'relationship', triggered: true, prison: true,
    title: 'Visiting hours', text: (x) => `${who(x)} has stopped visiting. A letter arrives.`,
    auto: (x) => { const r = x.rel(npcId(x)); if (r) { r.type = 'ex'; r.affinity = Math.min(r.affinity, 30); } x.mods({ happiness: -12, romanticCynicism: 8 }); trauma(x, 6, 'loss'); return 'They cannot wait for you. It is over.'; },
  },
  // ------------------------------------------------------------------ prison life
  {
    id: 'p_yardFight', cat: 'legal', prison: true, violent: true, weight: 2.5, cooldown: 1,
    title: 'The yard', text: 'A shot-caller wants to test the new inmate.',
    choices: [
      { label: 'Fight', tags: ['violent'], run: (x) => { const P = x.c.legal.prison!; if (check(x, x.stat('fitness') + x.skill('streetFighting') + x.skill('martialArts') / 2, 70)) { P.rank += 15; x.mods({ streetCred: 8, fear: 6 }); return 'You won. Respect earned.'; } x.log(injure(x, true), 'bad'); P.rank -= 5; return 'You were beaten badly.'; } },
      { label: 'Pay protection', when: (x) => x.c.money > 2000, run: (x) => { x.spend(2000); x.c.legal.prison!.rank += 3; return 'Commissary goods buy peace.'; } },
      { label: 'Ask a gang for protection', run: (x) => joinPrisonGang(x) },
    ],
  },
  {
    id: 'p_contraband', cat: 'legal', prison: true, weight: 1.5, cooldown: 2,
    title: 'Contraband', text: 'A guard offers to smuggle in phones and drugs — for a cut.',
    choices: [
      { label: 'Run a contraband business', tags: ['ambitious'], run: (x) => { const P = x.c.legal.prison!; P.guardFavor += 15; x.c.crime.dirtyMoney += x.int(5000, 40000); x.mods({ criminalRep: 5, corruption: 3 }); P.goodBehavior -= 10; if (x.chance(0.2)) { P.sentence += 2; return 'A shakedown found your stash. Two more years.'; } return 'Business is booming behind bars.'; } },
      { label: 'Report the guard', tags: ['help'], run: (x) => { x.c.legal.prison!.goodBehavior += 15; x.mods({ streetCred: -10 }); return 'The warden is grateful. The inmates are not.'; } },
      { label: 'Stay out of it', tags: ['cautious'], run: () => 'You keep your head down.' },
    ],
  },
  {
    id: 'p_study', cat: 'legal', prison: true, weight: 1.5, cooldown: 2,
    title: 'Prison library', text: 'The prison library has a correspondence program.',
    choices: [
      { label: 'Study law', run: (x) => { x.train('law', 10); x.train('criminalLaw', 8); x.c.legal.prison!.goodBehavior += 8; return 'Jailhouse lawyer in the making.'; } },
      { label: 'Read everything', run: (x) => { x.mods({ smarts: 4, wisdom: 4 }); x.train('literacy', 8); x.train('philosophy', 6); return 'Books are the only way out of here.'; } },
      { label: 'Find religion', run: (x) => { x.mods({ faith: 15, karma: 5 }); x.train('scripture', 8); x.c.legal.prison!.goodBehavior += 10; return 'The chaplain says you have changed. Maybe you have.'; } },
    ],
  },
  {
    id: 'p_riot', cat: 'legal', prison: true, violent: true, weight: (x) => (x.c.legal.prison?.tier === 'state' || x.c.legal.prison?.tier === 'supermax' ? 0.8 : 0.3), cooldown: 4,
    title: 'Riot', text: 'The cell block erupts. Guards are taken hostage.',
    choices: [
      { label: 'Lead the riot', tags: ['violent', 'impulsive'], run: (x) => { const P = x.c.legal.prison!; P.rank += 20; P.sentence += x.int(3, 8); x.mods({ fear: 10, infamy: 6 }); trauma(x, 8, 'violence'); if (P.tier === 'state') P.tier = 'supermax'; return 'They will tell stories about you. From supermax.'; } },
      { label: 'Protect a guard', tags: ['help'], run: (x) => { const P = x.c.legal.prison!; P.goodBehavior += 25; P.guardFavor += 25; x.mods({ karma: 6, streetCred: -8 }); return 'The warden recommends you for early release.'; } },
      { label: 'Barricade your cell', tags: ['cautious'], run: (x) => { trauma(x, 4, 'violence'); return 'You waited it out.'; } },
    ],
  },
  {
    id: 'p_escapePlan', cat: 'legal', prison: true, weight: (x) => (x.c.legal.prison && x.c.legal.prison.sentence - x.c.legal.prison.served > 5 ? 1 : 0.2), cooldown: 3,
    title: 'Escape plan', text: (x) => `${x.c.legal.prison?.gang ? 'Your crew' : 'Your cellmate'} has a plan to break out.`,
    choices: [
      { label: 'Go for it', tags: ['impulsive'], run: (x) => escapePrison(x) },
      { label: 'Stay put', tags: ['cautious'], run: (x) => { x.c.legal.prison!.goodBehavior += 5; return 'Not worth the risk.'; } },
    ],
  },
  {
    id: 'p_snitch', cat: 'legal', prison: true, weight: (x) => (x.c.crime.orgName ? 1.2 : 0.4), cooldown: 4,
    title: 'An offer from the feds', text: 'Federal agents offer to cut your sentence if you inform on your associates.',
    choices: [
      { label: 'Inform', run: (x) => { const P = x.c.legal.prison!; P.sentence = Math.max(P.served + 1, Math.round(P.sentence * 0.5)); x.mods({ streetCred: -20 }); if (x.c.crime.orgName) { x.s.dynasty.enemies.push({ name: x.c.crime.orgName, reason: 'Snitched in prison', generation: x.s.dynasty.generation }); x.c.crime.orgName = null; x.c.crime.orgRank = 0; } if (x.chance(0.3)) { x.log(injure(x, true), 'bad'); return 'Word got out. They shanked you in the shower. Your sentence was halved.'; } return 'Your sentence was halved. You sleep with one eye open.'; } },
      { label: 'Stay loyal', run: (x) => { x.mods({ streetCred: 6, criminalRep: 4 }); x.c.crime.orgLoyalty += 10; return 'You are no rat.'; } },
    ],
  },
  {
    id: 'p_cellmateBond', cat: 'legal', prison: true, once: true, weight: 1,
    bind: (x) => { const r = x.rels('cellmate')[0]; return r ? { npcId: r.npcId } : null; },
    title: 'Cellmate', text: (x) => `Late at night, ${who(x)} tells you their life story.`,
    choices: [
      { label: 'Become friends', tags: ['social'], run: (x) => { x.addRel(npcId(x), 'friend', { affinity: 70, trust: 60 }); x.c.flags.criminalContact = true; x.train('streetwise', 5); return 'A friend for life. They know people on the outside.'; } },
      { label: 'Keep your distance', tags: ['cautious'], run: () => 'Trust no one in here.' },
    ],
  },
  {
    id: 'p_solitary', cat: 'legal', prison: true, weight: (x) => (x.c.legal.prison && x.c.legal.prison.goodBehavior < 35 ? 1.5 : 0.2), cooldown: 3,
    title: 'Solitary', text: 'You were thrown in the hole.',
    auto: (x) => { x.mods({ anxiety: 12, paranoia: 8, happiness: -8 }); trauma(x, 6, 'abuse'); return 'Thirty days in a concrete box. Something in you broke a little.'; },
  },
  // ------------------------------------------------------------------ criminal opportunities
  {
    id: 'cr_heistOffer', cat: 'crime', minAge: 18, cooldown: 4, weight: (x) => (x.stat('criminalRep') > 25 || x.skill('burglary') > 25 ? 1.5 : 0),
    title: 'The big score', text: 'A crew is planning a heist and needs someone with your skills.',
    choices: [
      { label: 'Join the crew', tags: ['impulsive', 'ambitious'], run: (x) => { const r = commitCrime(x, x.year >= 1800 ? 'bankRobbery' : 'armedRobbery'); x.train('heistPlanning', 6); const n = makeNpc(x, { age: x.int(25, 50), karma: -40, criminal: 60 }); x.addRel(n.id, 'coConspirator', { affinity: 55, trust: 45 }); return r.text; } },
      { label: 'Plan it yourself', tags: ['ambitious'], when: (x) => x.skill('heistPlanning') >= 20, run: (x) => { const r = commitCrime(x, 'bankRobbery'); if (r.ok) x.c.crime.dirtyMoney += x.int(50000, 300000); return r.text; } },
      { label: 'Pass', tags: ['cautious'], run: () => 'Too hot.' },
    ],
  },
  {
    id: 'cr_fence', cat: 'crime', minAge: 14, cooldown: 3, weight: (x) => (x.c.flags.criminalContact ? 1 : 0),
    title: 'Hot goods', text: 'A fence offers to move stolen goods through you for a cut.',
    choices: [
      { label: 'Do it', tags: ['impulsive'], run: (x) => { x.train('fencingGoods', 6); x.money(x.int(500, 5000)); x.mods({ karma: -2, criminalRep: 3 }); if (x.chance(0.2)) openCase(x, 'burglary', { label: 'Receiving stolen goods' }); return 'Easy money.'; } },
      { label: 'Refuse', tags: ['cautious'], run: () => 'Not your business.' },
    ],
  },
  {
    id: 'cr_witness', cat: 'crime', minAge: 14, cooldown: 2, weight: (x) => (x.c.legal.cases.some((k) => k.status === 'open' && k.witnesses.some((w) => x.npc(w)?.alive)) ? 3 : 0),
    bind: (x) => { const k = x.c.legal.cases.find((q) => q.status === 'open' && q.witnesses.some((w) => x.npc(w)?.alive)); const w = k?.witnesses.find((q) => x.npc(q)?.alive); return k && w ? { caseId: k.id, npcId: w } : null; },
    title: 'The witness', text: (x) => `${x.name(npcId(x))} saw what you did and is talking to detectives.`,
    choices: [
      { label: 'Bribe them', when: (x) => x.c.money >= 10000, run: (x) => { x.spend(10000); const k = caseOf(x); if (x.chance(0.7) && k) { k.witnesses = k.witnesses.filter((w) => w !== npcId(x)); k.evidence -= 15; updateEvidenceStat(x); return 'They suddenly cannot remember anything.'; } openCase(x, 'witnessIntimidation'); return 'They took the money and told the police.'; } },
      { label: 'Intimidate them', tags: ['violent'], run: (x) => { const k = caseOf(x); x.mods({ karma: -5, fear: 4 }); if (check(x, x.stat('fear') + x.skill('intimidation'), 50) && k) { k.witnesses = k.witnesses.filter((w) => w !== npcId(x)); k.evidence -= 20; updateEvidenceStat(x); return 'They moved out of state.'; } openCase(x, 'witnessIntimidation'); return 'They went straight to the police.'; } },
      { label: 'Make them disappear', tags: ['violent', 'impulsive'], run: (x) => { const r = commitCrime(x, 'murder', npcId(x)); const k = caseOf(x); if (r.ok && k) { k.witnesses = k.witnesses.filter((w) => w !== npcId(x)); k.evidence -= 20; updateEvidenceStat(x); } return r.text; } },
      { label: 'Let it play out', tags: ['cautious'], run: () => 'You hope they are a bad witness.' },
    ],
  },
  {
    id: 'cr_informant', cat: 'crime', minAge: 16, cooldown: 6, weight: (x) => (x.c.crime.orgName || x.stat('criminalRep') > 30 ? 0.8 : 0),
    title: 'A quiet word', text: 'A detective offers to make your case go away if you become an informant.',
    choices: [
      { label: 'Become an informant', run: (x) => { const h = makeNpc(x, { age: x.int(30, 55), career: 'detective', careerLevel: 5 }); x.addRel(h.id, 'handler', { affinity: 45, trust: 40 }); for (const k of x.c.legal.cases) k.evidence = Math.max(0, k.evidence - 30); updateEvidenceStat(x); x.c.flags.informant = true; x.secret('informant', 'Informing for the police', 8); x.mods({ paranoia: 10 }); return 'Your cases are cooling. If your crew finds out, you are dead.'; } },
      { label: 'Tell them to get lost', run: (x) => { x.mods({ streetCred: 3, heat: 5 }); return 'They will be watching you now.'; } },
    ],
  },
  {
    id: 'cr_corruptCop', cat: 'crime', minAge: 16, cooldown: 4, weight: (x) => (x.stat('heat') > 30 && x.w.crimeRate > 45 ? 1.2 : 0),
    title: 'Shakedown', text: 'A crooked cop knows what you have been doing and wants a monthly envelope.',
    choices: [
      { label: 'Pay up', when: (x) => x.c.money + x.c.crime.dirtyMoney > 5000, run: (x) => { if (x.c.crime.dirtyMoney >= 5000) x.c.crime.dirtyMoney -= 5000; else x.spend(5000); x.mods({ heat: -15, corruption: 5 }); const cop = makeNpc(x, { age: x.int(30, 55), career: 'policeOfficer', careerLevel: 5, karma: -30 }); x.addRel(cop.id, 'coConspirator', { affinity: 45, trust: 30 }); return 'You have a friend on the force now.'; } },
      { label: 'Refuse', run: (x) => { x.mod('heat', 15); return 'They promise to make your life difficult.'; } },
      { label: 'Record the conversation', tags: ['cautious'], run: (x) => { x.secret('dirtyCopTape', 'A recording of a corrupt cop', 2); x.mods({ heat: -5 }); return 'Leverage, for a rainy day.'; } },
    ],
  },
  {
    id: 'cr_contractKill', cat: 'crime', minAge: 18, cooldown: 3, weight: (x) => (x.c.career?.careerId === 'hitman' || x.c.career?.careerId === 'guildAssassin' ? 3 : x.stat('criminalRep') > 50 && x.stat('aggression') > 55 ? 0.6 : 0), violent: true,
    title: 'A contract', text: (x) => `Someone wants ${who(x)} dead. The fee is ${x.fmt(x.p.fee as number)}.`,
    bind: (x) => ({ npcId: makeNpc(x, { age: x.int(25, 70), wealth: x.int(50000, 5000000) }).id, fee: x.int(20, 250) * 1000 }),
    choices: [
      { label: 'Take the contract', tags: ['violent'], run: (x) => { const r = commitCrime(x, 'murder', npcId(x)); if (r.ok) { x.c.crime.dirtyMoney += x.p.fee as number; x.train('assassinationTechnique', 6); x.mods({ criminalRep: 6, fear: 6 }); } return r.text + (r.ok ? ` ${x.fmt(x.p.fee as number)} wired to your account.` : ''); } },
      { label: 'Warn the target', tags: ['help'], run: (x) => { x.mods({ karma: 10, criminalRep: -10 }); x.addRel(npcId(x), 'friend', { affinity: 80, trust: 70 }); x.remember('helpedSomeone', `Saved ${x.name(npcId(x))} from a hit`, 35, npcId(x)); return 'They fled the country. Your employer is not pleased.'; } },
      { label: 'Decline', tags: ['cautious'], run: () => 'Not this one.' },
    ],
  },
  {
    id: 'cr_cartelOffer', cat: 'crime', minAge: 18, cooldown: 6, years: [1970, 99999], weight: (x) => (x.skill('drugDistribution') > 30 && x.stat('criminalRep') > 40 ? 1.2 : 0),
    title: 'The cartel calls', text: 'A cartel wants you to run their distribution in your region.',
    choices: [
      { label: 'Accept', tags: ['ambitious'], run: (x) => { const def = CAREER_BY_ID.drugKingpin; if (x.stat('criminalRep') >= 55 && x.skill('drugDistribution') >= 40) { startCareer(x, def); return 'You are now a drug kingpin. Every agency wants your head.'; } x.c.crime.operations.push({ id: x.uid('op'), kind: 'drugs', product: 'cocaine', stage: 'distribution', scale: 2, years: 0, lastIncome: 0 }); x.mods({ criminalRep: 8, heat: 10 }); return 'You now run their distribution network.'; } },
      { label: 'Decline', tags: ['cautious'], run: (x) => { x.mod('paranoia', 4); return 'They do not like being told no.'; } },
    ],
  },
  {
    id: 'cr_armsWar', cat: 'crime', minAge: 20, cooldown: 4, weight: (x) => (x.skill('armsDealing') > 20 && Object.values(x.s.world.contexts).some((c) => c.war !== 'none') ? 1.5 : 0),
    title: 'A war needs guns', text: 'Rebels in a war zone will pay triple for rifles. You will need forged end-user certificates.',
    choices: [
      { label: 'Forge the papers and ship', tags: ['ambitious'], run: (x) => { const ok = check(x, x.skill('forgery') + x.skill('armsDealing'), 60); x.mods({ karma: -10, sin: 4 }); if (ok) { x.c.crime.dirtyMoney += x.int(200000, 1500000); x.mod('criminalRep', 8); return 'The shipment landed. Interpol has your photo now.'; } openCase(x, 'weaponsTrafficking', { mult: 1.4 }); x.c.legal.interpolNotice = true; return 'The papers did not pass. Interpol issued a red notice.'; } },
      { label: 'Too dangerous', tags: ['cautious'], run: () => 'You let someone else take that risk.' },
    ],
  },
  {
    id: 'cr_bootleg', cat: 'crime', minAge: 16, cooldown: 3, weight: (x) => (x.w.prohibition ? 2 : 0),
    title: 'Prohibition money', text: 'Everyone wants a drink and nobody can legally sell one.',
    choices: [
      { label: 'Start a still', tags: ['ambitious'], run: (x) => { x.c.crime.operations.push({ id: x.uid('op'), kind: 'drugs', product: 'liquor', stage: 'production', scale: 1, years: 0, lastIncome: 0 }); x.train('brewing', 8); x.mods({ criminalRep: 4 }); return 'Bathtub gin, coming right up.'; } },
      { label: 'Open a speakeasy', when: (x) => x.c.money > 20000, run: (x) => { x.spend(20000); x.c.crime.operations.push({ id: x.uid('op'), kind: 'drugs', product: 'liquor', stage: 'street', scale: 2, years: 0, lastIncome: 0 }); x.mods({ fame: 3, corruption: 3 }); return 'A password at the door, jazz inside.'; } },
      { label: 'Stay dry', tags: ['cautious'], run: () => 'Law-abiding, for now.' },
    ],
  },
  {
    id: 'cr_hackJob', cat: 'crime', minAge: 14, cooldown: 3, years: [1995, 99999], weight: (x) => (x.skill('hacking') > 20 ? 1.5 : 0),
    title: 'Dark web gig', text: 'Someone on a dark web forum offers crypto for a job.',
    choices: [
      { label: 'Ransomware a hospital', tags: ['impulsive'], run: (x) => { x.mods({ karma: -12 }); return commitCrime(x, 'cyberFraud').text + ' Patients were diverted while systems were down.'; } },
      { label: 'Steal a corporation\'s secrets', run: (x) => commitCrime(x, 'cyberFraud').text },
      { label: 'Report the forum to authorities', tags: ['help'], run: (x) => { x.mods({ karma: 5 }); x.train('cybersecurity', 6); return 'A white-hat move. You learned a lot.'; } },
    ],
  },
  {
    id: 'cr_launderingOffer', cat: 'crime', minAge: 20, cooldown: 4, weight: (x) => (x.c.crime.dirtyMoney > 100000 ? 2 : 0),
    title: 'A friendly banker', text: 'A private banker in a tax haven offers to clean your money, no questions asked.',
    choices: [
      { label: 'Accept (20% fee)', run: (x) => { const amt = Math.round(x.c.crime.dirtyMoney * 0.6); x.c.crime.dirtyMoney -= amt; x.c.crime.offshore += Math.round(amt * 0.8); x.train('offshoreBanking', 8); x.mod('corruption', 3); return `${x.fmt(amt * 0.8)} now sits in a numbered account.`; } },
      { label: 'Too risky', tags: ['cautious'], run: () => 'You keep it in the mattress.' },
    ],
  },
  {
    id: 'cr_gangConfront', cat: 'crime', minAge: 15, cooldown: 3, violent: true, weight: (x) => (x.c.crime.orgName && x.c.crime.orgRank <= 2 ? 1.5 : x.c.flags.radical === 'gang' ? 1 : 0),
    title: 'Rival crew', text: 'A rival crew jumped one of your people.',
    choices: [
      { label: 'Retaliate', tags: ['violent'], run: (x) => { const r = commitCrime(x, 'assault'); x.mods({ streetCred: 6 }); if (x.chance(0.3)) { trauma(x, 8, 'violence'); x.log(injure(x, true), 'bad'); } return r.text; } },
      { label: 'Negotiate', tags: ['social'], run: (x) => { if (check(x, x.stat('charisma') + x.skill('negotiation'), 60)) { x.mods({ criminalRep: 4 }); return 'A truce, for now.'; } x.mods({ streetCred: -4 }); return 'They read it as weakness.'; } },
    ],
  },
  {
    id: 'rival_war', cat: 'crime', triggered: true, violent: true,
    title: 'Turf war', text: (x) => `${x.p.rival} is moving on your territory. Bodies are dropping.`,
    choices: [
      { label: 'Go to war', tags: ['violent', 'ambitious'], run: (x) => { const win = check(x, x.stat('fear') + x.c.crime.orgRank * 10 + x.skill('militaryStrategy') / 2, 65); x.mods({ heat: 20, karma: -8 }); openCase(x, 'murder', { label: 'Gangland killings', mult: 0.7 }); if (win) { x.c.crime.territory += x.int(2, 6); x.mods({ criminalRep: 10, fear: 10 }); return 'You won the war. The streets are yours.'; } x.c.crime.territory = Math.max(0, x.c.crime.territory - x.int(2, 5)); if (x.chance(0.3)) x.log(injure(x, true), 'bad'); trauma(x, 12, 'violence'); return 'You lost ground — and nearly your life.'; } },
      { label: 'Cut a deal', tags: ['social'], run: (x) => { x.c.crime.territory = Math.max(0, x.c.crime.territory - 1); x.mod('criminalRep', -3); return 'You split the territory.'; } },
      { label: 'Call in corrupt police', when: (x) => x.stat('corruption') > 30, run: (x) => { x.mods({ corruption: 4 }); return 'Raids hit your rivals the next week.'; } },
    ],
  },
  {
    id: 'wp_assassin', cat: 'crime', triggered: true, violent: true,
    title: 'They found you', text: 'A car has been parked outside your new house for three days.',
    choices: [
      { label: 'Relocate again', tags: ['cautious'], run: (x) => { const wp = x.c.legal.witnessProtection; if (wp) wp.threat = Math.max(0, wp.threat - 30); x.mods({ stress: 10, loneliness: 6 }); return 'New town, new name, same fear.'; } },
      { label: 'Confront them', tags: ['violent'], run: (x) => { if (check(x, x.stat('fitness') + x.skill('tacticalShooting'), 70)) { x.mods({ fear: 6 }); trauma(x, 10, 'violence'); return 'You survived. They did not.'; } die(x, 'a mob hit', 'murder'); return 'They were better.'; } },
      { label: 'Leave witness protection', run: (x) => { x.c.legal.witnessProtection = null; x.mods({ paranoia: 10 }); return 'You are on your own now.'; } },
    ],
  },
  // ------------------------------------------------------------------ mafia consequence chain
  {
    id: 'mafia_loyalty', cat: 'chain', triggered: true,
    title: 'Loyalty test', text: (x) => `${x.name(x.p.handler as string)} hands you a package and an address. "Don't open it."`,
    choices: [
      { label: 'Deliver it', run: (x) => { x.c.crime.orgLoyalty += 15; x.mods({ criminalRep: 5 }); return 'Whatever it was, the family is pleased.'; } },
      { label: 'Open it', tags: ['impulsive'], run: (x) => { x.c.crime.orgLoyalty -= 10; x.mods({ paranoia: 5 }); return 'Cash and a severed finger. They know you looked.'; } },
      { label: 'Go to the police', tags: ['help'], run: (x) => enterWitnessProtection(x) },
    ],
  },
  {
    id: 'mafia_job', cat: 'chain', triggered: true,
    title: 'First real job', text: 'The family wants a shopkeeper who stopped paying "taught a lesson."',
    choices: [
      { label: 'Break his windows', run: (x) => { const r = commitCrime(x, 'extortion'); x.c.crime.orgLoyalty += 10; return r.text; } },
      { label: 'Break his legs', tags: ['violent'], run: (x) => { const r = commitCrime(x, 'assault'); x.c.crime.orgLoyalty += 18; x.mods({ fear: 6 }); return r.text; } },
      { label: 'Pay his debt yourself', tags: ['help'], when: (x) => x.c.money > 5000, run: (x) => { x.spend(5000); x.mods({ karma: 5 }); x.c.crime.orgLoyalty -= 5; return 'The family took the money and looked at you strangely.'; } },
    ],
  },
  {
    id: 'mafia_turf', cat: 'chain', triggered: true, violent: true,
    title: 'Turf war', text: 'A rival family declares war. You are on the front line.',
    choices: [
      { label: 'Fight for the family', tags: ['violent'], run: (x) => { trauma(x, 15, 'violence'); x.mods({ criminalRep: 10, fear: 8 }); x.c.crime.orgLoyalty += 10; x.c.crime.territory += 2; openCase(x, 'murder', { label: 'Gangland shooting', mult: 0.6 }); if (x.chance(0.25)) x.log(injure(x, true), 'bad'); return 'You made your bones.'; } },
      { label: 'Hide until it blows over', tags: ['cautious'], run: (x) => { x.c.crime.orgLoyalty -= 15; return 'Some people noticed your absence.'; } },
    ],
  },
  {
    id: 'mafia_feds', cat: 'chain', triggered: true,
    title: 'Federal investigation', text: 'A federal task force is building a racketeering case against the whole family.',
    auto: (x) => { x.mods({ heat: 25, paranoia: 10 }); openCase(x, 'extortion', { label: 'Racketeering (RICO)', mult: 1.2 }); return 'Wiretaps, surveillance vans, subpoenas. Everyone is suspicious of everyone.'; },
  },
  {
    id: 'mafia_family', cat: 'chain', triggered: true,
    title: 'They know where you live', text: 'A rival family leaves a dead canary on your doorstep. Your loved ones are not safe.',
    choices: [
      { label: 'Send your family away', tags: ['cautious'], run: (x) => { for (const r of x.rels('spouse', 'child')) x.relMod(r.npcId, -8); x.mods({ loneliness: 10 }); return 'They are safe. You are alone.'; } },
      { label: 'Strike first', tags: ['violent'], run: (x) => { const r = commitCrime(x, 'murder'); x.mods({ fear: 10 }); return r.text; } },
      { label: 'Get out of the life', tags: ['help'], run: (x) => enterWitnessProtection(x) },
    ],
  },
  {
    id: 'mafia_power', cat: 'chain', triggered: true,
    when: (x) => !!x.c.crime.orgName,
    title: 'Power struggle', text: (x) => `The boss is old and sick. ${x.c.crime.orgName} needs new leadership.`,
    choices: [
      { label: 'Make your move', tags: ['ambitious', 'violent'], run: (x) => { if (check(x, x.stat('criminalRep') + x.stat('fear') / 2 + x.c.crime.orgLoyalty / 2, 85)) { x.c.crime.orgRank = Math.max(x.c.crime.orgRank, 4); x.mods({ fear: 15, ego: 10 }); x.remember('crimeBoss', `Took control of ${x.c.crime.orgName}`, 75); return `You are now ${orgRankName(x.c.crime.orgRank)}.`; } x.c.crime.orgLoyalty -= 30; x.log(injure(x, true), 'bad'); return 'The coup failed. You are lucky to be alive.'; } },
      { label: 'Back the boss\'s chosen heir', run: (x) => { x.c.crime.orgLoyalty += 20; x.c.crime.orgRank = Math.min(6, x.c.crime.orgRank + 1); return 'Loyalty is rewarded.'; } },
    ],
  },
  {
    id: 'mafia_informant', cat: 'chain', triggered: true,
    title: 'A rat in the family', text: 'Someone is talking to the feds. Suspicion falls everywhere — including on you.',
    choices: [
      { label: 'Find the rat', tags: ['violent'], run: (x) => { const c = x.rels('coConspirator', 'handler', 'friend')[0]; if (c) { x.addRel(c.npcId, 'enemy', { affinity: 0 }); ripple(x, c.npcId, -20, 'Accused of being a rat'); } x.mods({ fear: 6, paranoia: 8 }); x.c.crime.orgLoyalty += 10; return 'You found them. The family handled it.'; } },
      { label: 'You are the rat', when: (x) => !!x.c.flags.informant, run: (x) => enterWitnessProtection(x) },
      { label: 'Lie low', tags: ['cautious'], run: (x) => { x.mods({ paranoia: 10 }); return 'You trust no one.'; } },
    ],
  },
  {
    id: 'mafia_reckoning', cat: 'chain', triggered: true,
    title: 'Final reckoning', text: 'Decades in the life. The feds, rivals and your own people are all closing in.',
    choices: [
      { label: 'Retire to a non-extradition country', when: (x) => x.c.crime.offshore + x.c.money > 500000, run: (x) => { const safe = countriesAvailable(x.year).filter((c) => !canExtradite(x.c.countryId, c.id)); if (!safe.length) return 'Nowhere left to run.'; x.c.crime.orgName = null; return fleeTo(x, x.pick(safe).id) + ' You live out your days on a sunny veranda.'; } },
      { label: 'Go out in a blaze of glory', tags: ['violent'], run: (x) => { x.mods({ infamy: 20 }); die(x, 'a hail of police bullets', 'murder'); return 'Legends do not surrender.'; } },
      { label: 'Turn state\'s evidence', run: (x) => enterWitnessProtection(x) },
      { label: 'Hold on to power', tags: ['ambitious'], run: (x) => { x.mods({ paranoia: 15, heat: 20 }); return 'You tighten your grip. Sleep becomes a luxury.'; } },
    ],
  },
  // ------------------------------------------------------------------ radicalization chain
  {
    id: 'radical_escalation', cat: 'chain', triggered: true,
    title: 'Escalation', text: (x) => `The ${x.p.kind === 'gang' ? 'gang' : 'movement'} wants you to prove your commitment.`,
    choices: [
      { label: 'Do what they ask', tags: ['violent', 'impulsive'], run: (x) => { const r = commitCrime(x, x.p.kind === 'gang' ? 'armedRobbery' : 'arson'); x.mods({ empathy: -5 }); return r.text; } },
      { label: 'Find an excuse', tags: ['cautious'], run: (x) => { x.mods({ anxiety: 5 }); return 'They noticed your hesitation.'; } },
    ],
  },
  {
    id: 'radical_crackdown', cat: 'chain', triggered: true,
    title: 'Crackdown', text: 'Police raid the group\'s meeting place. Members are arrested.',
    auto: (x) => { x.mods({ heat: 20, paranoia: 8 }); if (x.chance(0.35)) openCase(x, 'arson', { label: 'Conspiracy', mult: 0.8 }); return 'You were not there — this time.'; },
  },
  {
    id: 'radical_deradicalize', cat: 'chain', triggered: true,
    title: 'Doubt', text: 'An old friend reaches out. They say they miss who you used to be.',
    choices: [
      { label: 'Leave the movement', tags: ['help'], run: (x) => { x.c.flags.radical = false; x.mods({ empathy: 8, karma: 8, wisdom: 6, loneliness: 8 }); x.remember('deradicalized', 'Walked away from extremism', 50); return 'It is the hardest thing you have ever done. Your old friends will not forgive it.'; } },
      { label: 'Double down', tags: ['impulsive'], run: (x) => { x.mods({ empathy: -6, heat: 10, infamy: 6 }); return 'You cut the friend off. The cause is everything.'; } },
    ],
  },
  // ------------------------------------------------------------------ civil law
  {
    id: 'lg_classAction', cat: 'legal', minAge: 25, cooldown: 6, weight: (x) => (x.c.assets.some((a) => ['restaurant', 'nightclub', 'casino', 'apartmentComplex', 'techStartup', 'armsManufacturing', 'mediaCompany'].includes(a.typeId)) ? 1 : 0),
    title: 'Class action', text: 'Customers have filed a class-action lawsuit against your business.',
    choices: [
      { label: 'Settle', tags: ['cautious'], run: (x) => { const amt = x.int(50000, 500000); if (!x.spend(amt)) x.c.debt += amt; return `Settled for ${x.fmt(amt)}.`; } },
      { label: 'Fight it in court', tags: ['ambitious'], run: (x) => { x.c.legal.lawsuits.push({ id: x.uid('suit'), kind: 'classAction', role: 'defendant', otherParty: 'the class of plaintiffs', amount: x.int(200000, 3000000), strength: 50, years: 0 }); return 'Your lawyers are confident. Lawyers always are.'; } },
    ],
  },
  {
    id: 'lg_patent', cat: 'legal', minAge: 25, cooldown: 6, years: [1880, 99999], weight: (x) => (x.c.assets.some((a) => a.typeId === 'techStartup') || x.c.career?.careerId === 'scientist' ? 0.8 : 0),
    title: 'Patent dispute', text: 'A rival claims your invention infringes their patent.',
    choices: [
      { label: 'Countersue', tags: ['ambitious'], run: (x) => { x.c.legal.lawsuits.push({ id: x.uid('suit'), kind: 'patent', role: 'plaintiff', otherParty: 'a rival firm', amount: x.int(100000, 2000000), strength: 50 + x.skill('law') / 4, years: 0 }); return 'It will take years.'; } },
      { label: 'License it', tags: ['cautious'], run: (x) => { x.spend(Math.min(Math.max(0, x.c.money), 50000)); return 'An expensive peace.'; } },
    ],
  },
  {
    id: 'lg_suedAssault', cat: 'legal', minAge: 18, cooldown: 5, weight: (x) => ((x.c.crime.committed.assault ?? 0) > 0 ? 1 : 0),
    title: 'Served papers', text: 'Someone you hurt is suing you for damages.',
    auto: (x) => { x.c.legal.lawsuits.push({ id: x.uid('suit'), kind: 'assault', role: 'defendant', otherParty: 'a former victim', amount: x.int(20000, 200000), strength: 60, years: 0 }); return 'Civil court, where the burden of proof is lower.'; },
  },
  {
    id: 'lg_juvenileSealed', cat: 'legal', minAge: 18, maxAge: 19, once: true, weight: (x) => (x.c.legal.juvenileRecord ? 5 : 0),
    title: 'Sealed record', text: 'Your juvenile record can be sealed now that you are an adult.',
    choices: [
      { label: 'Apply to seal it', tags: ['cautious'], run: (x) => { if (x.chance(0.7)) { x.c.legal.juvenileRecord = false; x.c.legal.record = x.c.legal.record.filter((r) => r.age >= 18); return 'Sealed. A clean slate.'; } return 'Denied — your offenses were too serious.'; } },
      { label: 'Wear it with pride', run: (x) => { x.mod('streetCred', 4); return 'It is part of who you are.'; } },
    ],
  },
];

export const CRIME_CHAINS: ChainDef[] = [
  {
    id: 'mafia',
    name: 'The Family',
    desc: 'Joining organized crime sets off decades of consequences.',
    steps: [
      { delay: 1, eventId: 'mafia_loyalty' },
      { delay: 2, eventId: 'mafia_job' },
      { delay: 3, eventId: 'mafia_turf' },
      { delay: 3, eventId: 'mafia_feds' },
      { delay: 3, eventId: 'mafia_family' },
      { delay: 4, eventId: 'mafia_power' },
      { delay: 3, eventId: 'mafia_informant' },
      { delay: 6, eventId: 'mafia_reckoning' },
    ],
  },
  {
    id: 'radical',
    name: 'Radicalization',
    desc: 'Extremist movements demand escalating commitment before a deradicalization choice.',
    steps: [
      { delay: 0, eventId: 'radical_escalation' },
      { delay: 3, eventId: 'radical_crackdown' },
      { delay: 4, eventId: 'radical_deradicalize' },
    ],
  },
];

