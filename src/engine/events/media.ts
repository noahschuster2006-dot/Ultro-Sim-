import type { EventDef } from './types';
import { check, npcId, who } from './helpers';
import { apologize } from '../systems/media';
import { leaveOffice, takeOffice } from '../systems/politics';
import { OFFICE_BY_ID } from '../data/politics';
import { countryName } from '../data/countries';
import { CAREER_BY_ID } from '../data/careers';
import { startCareer, endCareer } from '../systems/careers';
import { injure } from '../systems/body';
import { trauma } from '../systems/mind';
import { makeNpc } from '../systems/npcs';
import { openCase, imprison } from '../systems/legal';
import { die } from '../systems/dynasty';

/** Fame, the press, politics and power. */
export const MEDIA_EVENTS: EventDef[] = [
  // ------------------------------------------------------------------ fame & press
  {
    id: 'cancelled', cat: 'media', triggered: true,
    title: 'Cancelled', text: (x) => `The internet has turned on you. Severity ${x.p.severity}/10. Sponsors are pulling out.`,
    choices: [
      { label: 'Issue a genuine apology', tags: ['help'], run: (x) => apologize(x) },
      { label: 'Deny and fight', tags: ['impulsive'], run: (x) => { const M = x.c.media; if (x.chance(0.3 + x.stat('charisma') / 300)) { if (M.cancelled) M.cancelled.years = 3; x.mods({ fame: 6, ego: 4, infamy: 3 }); x.c.flags.survivedCancel = true; return 'Your fans rallied. You came out more famous — and more divisive.'; } x.mods({ publicImage: -10, fame: -6 }); return 'Every denial added fuel.'; } },
      { label: 'Disappear for a while', tags: ['cautious'], run: (x) => { x.mods({ fame: -10, loneliness: 6 }); const M = x.c.media; if (M.cancelled) M.cancelled.years += 1; return 'You log off and go quiet.'; } },
      { label: 'Reinvent your image', tags: ['ambitious'], run: (x) => { x.spend(Math.min(Math.max(0, x.c.money), 100000)); x.c.media.prFirm = true; x.mods({ publicImage: 6 }); return 'A PR firm, a charity gala, a new haircut.'; } },
      { label: 'Buy the media company', when: (x) => x.c.money > 20000000, run: (x) => { x.spend(15000000); x.c.assets.push({ id: x.uid('a'), typeId: 'mediaCompany', name: 'Media group', countryId: x.c.countryId, boughtYear: x.year, purchasePrice: 15000000, value: 15000000, mortgage: 0, rentedOut: false, condition: 90, level: 1, front: false, seized: false, meta: {} }); if (x.c.media.cancelled) x.c.media.cancelled.years = 3; x.c.flags.survivedCancel = true; return 'You bought the outlet that started it. The story changes overnight.'; } },
    ],
  },
  {
    id: 'm_paparazzi', cat: 'media', minAge: 14, cooldown: 2, weight: (x) => (x.stat('fame') > 50 ? 2 : 0),
    title: 'Paparazzi', text: 'Photographers swarm you outside a restaurant.',
    choices: [
      { label: 'Smile and wave', tags: ['social'], run: (x) => { x.mods({ publicImage: 3, fame: 1 }); return 'Tomorrow\'s front page: you, looking great.'; } },
      { label: 'Smash a camera', tags: ['violent', 'impulsive'], run: (x) => { x.mods({ publicImage: -8, infamy: 4 }); x.story('gossip', `${x.c.firstName} ${x.c.lastName} attacks photographer`, -20); openCase(x, 'assault', { mult: 0.6 }); return 'The video is everywhere.'; } },
      { label: 'Hire security', when: (x) => x.c.money > 50000, run: (x) => { x.spend(50000); x.mod('anxiety', -4); return 'A wall of muscle follows you now.'; } },
    ],
  },
  {
    id: 'm_stalker', cat: 'media', minAge: 16, cooldown: 6, violent: true, weight: (x) => (x.stat('fame') > 60 ? 1 : 0),
    title: 'Stalker', text: 'Someone has been sending letters. Then they were in your garden.',
    bind: (x) => ({ npcId: makeNpc(x, { age: x.int(20, 55), aggression: 70, karma: -20 }).id }),
    choices: [
      { label: 'Get a restraining order', tags: ['cautious'], run: (x) => { x.addRel(npcId(x), 'enemy', { affinity: 30, trust: 0, meta: { stalker: true } }); x.mods({ anxiety: 6, paranoia: 4 }); return 'Paper protection.'; } },
      { label: 'Confront them', tags: ['violent'], run: (x) => { if (check(x, x.stat('fitness') + x.skill('selfDefense'), 60)) return 'You scared them off for good.'; trauma(x, 12, 'violence'); return `They attacked you: ${injure(x, true)}`; } },
      { label: 'Move house', run: (x) => { x.spend(Math.min(Math.max(0, x.c.money), 30000)); x.mods({ stress: 4 }); return 'A gated community. A new alarm code.'; } },
    ],
  },
  {
    id: 'm_endorsement', cat: 'media', minAge: 14, cooldown: 2, weight: (x) => (x.stat('fame') > 35 ? 1.5 : 0),
    title: 'Endorsement deal', text: 'A brand wants your face on its products.',
    choices: [
      { label: 'Sign the deal', tags: ['ambitious'], run: (x) => { const pay = Math.round(x.stat('fame') * x.stat('fame') * x.int(40, 120)); x.money(pay); x.mods({ fame: 3 }); if (x.chance(0.15)) { x.secret('badSponsor', 'Endorsing a company that exploited workers', 4); return `${x.fmt(pay)} — though the company has some skeletons.`; } return `${x.fmt(pay)} for a photo shoot.`; } },
      { label: 'Decline — protect your image', tags: ['cautious'], run: (x) => { x.mod('publicImage', 2); return 'Authenticity is priceless. Supposedly.'; } },
    ],
  },
  {
    id: 'm_tabloidLie', cat: 'media', minAge: 16, cooldown: 3, weight: (x) => (x.stat('fame') > 40 ? 1.2 : 0),
    title: 'Fake news', text: 'A tabloid printed a completely invented story about your love life.',
    choices: [
      { label: 'Sue for defamation', tags: ['ambitious'], run: (x) => { x.c.legal.lawsuits.push({ id: x.uid('suit'), kind: 'defamation', role: 'plaintiff', otherParty: x.pick(x.media.outlets), amount: x.int(100000, 2000000), strength: 70, years: 0 }); return 'Your lawyers are drafting.'; } },
      { label: 'Laugh it off publicly', tags: ['social'], run: (x) => { if (check(x, x.skill('humor') + x.stat('charisma'), 60)) { x.mods({ publicImage: 5 }); return 'Your joke about it went viral.'; } return 'Nobody believes your denial.'; } },
      { label: 'Ignore it', tags: ['cautious'], run: () => 'Tomorrow\'s fish-and-chip paper.' },
    ],
  },
  {
    id: 'm_awardShow', cat: 'media', minAge: 16, cooldown: 3, weight: (x) => (x.c.career && ['creative', 'entertainment', 'sports'].includes(CAREER_BY_ID[x.c.career.careerId]?.cat ?? '') && x.c.career.level >= 5 ? 1.5 : 0),
    title: 'Nominated', text: 'You have been nominated for the top award in your field.',
    auto: (x) => { if (check(x, (x.c.career?.performance ?? 50) + x.stat('fame') / 2, 75)) { x.mods({ fame: 10, professionalRep: 10, ego: 5, happiness: 10 }); x.remember('award', 'Won the top award in my field', 55); return 'You won! Your speech made headlines.'; } x.mods({ fame: 3 }); return 'You lost to a rival. You clapped graciously on camera.'; },
  },
  {
    id: 'm_talkShow', cat: 'media', minAge: 16, cooldown: 3, weight: (x) => (x.stat('fame') > 45 && x.year > 1950 ? 1 : 0),
    title: 'Late night', text: 'A popular talk show wants you on.',
    choices: [
      { label: 'Be charming', tags: ['social'], run: (x) => { if (check(x, x.stat('charisma') + x.skill('humor'), 60)) { x.mods({ fame: 5, publicImage: 5 }); return 'You killed. The clip is everywhere.'; } x.mods({ publicImage: -4 }); return 'Awkward silence. Memes ensued.'; } },
      { label: 'Plug your project', tags: ['ambitious'], run: (x) => { if (x.c.career) x.c.career.performance += 6; return 'Sales spike the next day.'; } },
    ],
  },
  // ------------------------------------------------------------------ politics & power
  {
    id: 'reelection', cat: 'politics', triggered: true,
    title: 'Election day', text: (x) => `Your term as ${OFFICE_BY_ID[x.p.officeId as string]?.name ?? 'an official'} is up. Approval: ${Math.round(x.stat('politicalApproval'))}.`,
    choices: [
      { label: 'Run again', tags: ['ambitious'], run: (x) => { const o = OFFICE_BY_ID[x.p.officeId as string]; if (!o) return ''; const p = x.stat('politicalApproval') / 110 + x.stat('charisma') / 500 + 0.08; if (x.chance(Math.min(0.9, p))) { x.c.politics.term = o.term; x.c.politics.electionsWon++; x.mods({ happiness: 6 }); return 'Re-elected!'; } x.c.politics.electionsLost++; leaveOffice(x, 'Lost re-election'); x.mods({ happiness: -10 }); return 'The voters have spoken. You lost.'; } },
      { label: 'Retire from politics', tags: ['cautious'], run: (x) => { leaveOffice(x, 'Retired from politics'); x.mods({ stress: -15, happiness: 4 }); return 'You leave office with your dignity.'; } },
      { label: 'Rig the election', tags: ['impulsive'], when: (x) => x.stat('corruption') > 30 || x.stat('fear') > 40, run: (x) => { const o = OFFICE_BY_ID[x.p.officeId as string]; x.mods({ karma: -10, corruption: 8 }); if (x.chance(0.6)) { x.c.politics.term = o?.term ?? 4; x.secret('riggedElection', 'Rigging an election', 9); return 'A landslide. Some districts reported 104% turnout.'; } openCase(x, 'briberyOfficial', { label: 'Election fraud', mult: 1.5 }); leaveOffice(x, 'Election fraud exposed'); return 'Election fraud exposed. Investigators are coming.'; } },
    ],
  },
  {
    id: 'impeachment', cat: 'politics', triggered: true,
    title: 'Impeachment', text: 'The legislature has begun impeachment proceedings against you.',
    choices: [
      { label: 'Fight it', tags: ['ambitious'], run: (x) => { if (check(x, x.stat('politicalApproval') + x.skill('negotiation') + x.stat('charisma') / 2, 70)) { x.mods({ politicalApproval: 4 }); return 'The vote failed. You survive — wounded.'; } leaveOffice(x, 'Impeached'); x.mods({ publicImage: -15, infamy: 8 }); x.remember('impeached', 'Was impeached and removed', 60); return 'Removed from office in disgrace.'; } },
      { label: 'Resign', tags: ['cautious'], run: (x) => { leaveOffice(x, 'Resigned'); x.mods({ publicImage: -5 }); return 'You resign before the vote.'; } },
      { label: 'Declare emergency powers', tags: ['impulsive'], when: (x) => x.c.politics.office === 'headOfGovernment', run: (x) => { x.c.politics.dictator = true; x.w.regimeOverride = 'autocracy'; x.mods({ fear: 20, karma: -15, politicalApproval: -10 }); x.remember('dictator', 'Seized emergency powers to avoid impeachment', 85); return 'The legislature is dissolved. You rule by decree.'; } },
    ],
  },
  {
    id: 'coup_against_you', cat: 'politics', triggered: true, violent: true,
    title: 'Tanks in the square', text: 'The generals are moving against you.',
    choices: [
      { label: 'Rally loyal troops', tags: ['violent'], run: (x) => { if (check(x, x.stat('fear') + x.stat('politicalApproval'), 70)) { x.mods({ fear: 10 }); return 'The coup was crushed. The plotters were shot.'; } leaveOffice(x, 'Overthrown'); x.c.politics.dictator = false; x.w.regimeOverride = 'junta'; if (x.chance(0.4)) { die(x, 'execution by the junta', 'execution'); return 'You were executed by the new regime.'; } imprison(x, 20, 'Crimes against the state', 'supermax'); return 'Overthrown and imprisoned.'; } },
      { label: 'Flee into exile', tags: ['cautious'], run: (x) => { leaveOffice(x, 'Fled into exile'); x.c.politics.dictator = false; x.w.regimeOverride = 'junta'; x.mods({ loneliness: 10 }); return 'You escape with suitcases of cash.'; } },
    ],
  },
  {
    id: 'war_outcome', cat: 'politics', triggered: true,
    title: 'The war you started', text: (x) => `The war with ${countryName(x.p.target as string, x.year)} has reached its decisive moment.`,
    choices: [
      { label: 'Push for total victory', tags: ['violent', 'ambitious'], run: (x) => { if (check(x, x.w.economy + x.skill('militaryStrategy') + x.stat('politicalApproval') / 2, 90)) { x.mods({ politicalApproval: 15, fame: 15 }); x.w.econShock += 8; x.remember('wonWar', `Won the war with ${countryName(x.p.target as string, x.year)}`, 80); return 'Victory! Parades in every city.'; } x.mods({ politicalApproval: -20 }); x.w.stabShock -= 15; return 'A bloody stalemate. The nation turns on you.'; } },
      { label: 'Negotiate peace', tags: ['help'], run: (x) => { x.w.procWar = null; const t = x.s.world.contexts[x.p.target as string]; if (t) t.procWar = null; x.mods({ politicalApproval: 4, karma: 6 }); return 'A treaty is signed.'; } },
    ],
  },
  {
    id: 'rebellion', cat: 'politics', triggered: true, violent: true,
    title: 'Rebellion', text: 'Peasants and provincial nobles have risen against your rule.',
    choices: [
      { label: 'Crush it', tags: ['violent'], run: (x) => { x.mods({ fear: 12, karma: -10 }); if (x.chance(0.6)) return 'The rebellion is drowned in blood.'; x.c.assets = x.c.assets.filter((a) => a.typeId !== 'territory'); return 'The rebels won. You lost the province.'; } },
      { label: 'Negotiate reforms', tags: ['help'], run: (x) => { x.mods({ karma: 5, politicalApproval: 6 }); x.w.stabShock += 10; return 'Concessions buy peace.'; } },
    ],
  },
  {
    id: 'royal_succession', cat: 'politics', minAge: 16, once: true, weight: (x) => (x.c.flags.royalHeir && ((x.c.flags.lineOfSuccession as number) ?? 2) <= 1 && !['monarch', 'emperor'].includes(x.c.career?.careerId ?? '') ? (x.age > 25 ? 2.5 : 0.8) : 0),
    title: 'The crown', text: 'The old sovereign has died. The crown passes to you.',
    choices: [
      { label: 'Accept the crown', tags: ['ambitious'], run: (x) => { const empire = x.w.regime === 'empire' && x.year <= CAREER_BY_ID.emperor.years[1]; const def = empire ? CAREER_BY_ID.emperor : CAREER_BY_ID.monarch; startCareer(x, def, 2); x.w.ruler = `${empire ? (x.c.gender === 'female' ? 'Empress' : 'Emperor') : x.c.gender === 'female' ? 'Queen' : 'King'} ${x.c.firstName}`; x.w.rulerSince = x.year; x.c.assets.push({ id: x.uid('a'), typeId: 'territory', name: 'The royal realm', countryId: x.c.countryId, boughtYear: x.year, purchasePrice: 0, value: 0, mortgage: 0, rentedOut: false, condition: 100, level: 3, front: false, seized: false, meta: {} }); x.mods({ fame: 25, ego: 8 }); x.remember('crowned', `Crowned ${def.name.toLowerCase()} of ${x.countryName}`, 90); return 'Long live the sovereign!'; } },
      { label: 'Abdicate', tags: ['cautious'], run: (x) => { x.c.flags.lineOfSuccession = 99; x.mods({ happiness: 8, fame: 5 }); return 'You give up the throne for a quieter life.'; } },
    ],
  },
  {
    id: 'pol_lobbyist', cat: 'politics', minAge: 21, cooldown: 2, weight: (x) => (x.c.politics.office ? 2 : 0),
    title: 'A generous donor', text: 'A lobbyist offers a large donation if you vote their way.',
    choices: [
      { label: 'Take the money', tags: ['impulsive'], run: (x) => { x.money(x.int(50000, 500000)); x.mods({ corruption: 8, karma: -6 }); x.secret('bribes', 'Taking bribes from lobbyists', 7); return 'Quid pro quo, quietly.'; } },
      { label: 'Refuse and report it', tags: ['help'], run: (x) => { x.mods({ politicalApproval: 5, karma: 4 }); return 'An honest politician. Rarer than unicorns.'; } },
    ],
  },
  {
    id: 'pol_debate', cat: 'politics', minAge: 21, cooldown: 2, weight: (x) => (x.c.politics.office ? 1.5 : 0),
    title: 'The debate', text: 'A televised debate against your fiercest opponent.',
    choices: [
      { label: 'Go on the attack', tags: ['impulsive'], run: (x) => (check(x, x.stat('charisma') + x.skill('publicSpeaking'), 70) ? (x.mod('politicalApproval', 8), 'You destroyed them.') : (x.mod('politicalApproval', -6), 'You came across as a bully.')) },
      { label: 'Stay on message', tags: ['cautious'], run: (x) => { x.mod('politicalApproval', 2); return 'Solid, if boring.'; } },
    ],
  },
  {
    id: 'pol_assassination', cat: 'politics', minAge: 25, cooldown: 6, violent: true, weight: (x) => (x.c.politics.office && (x.stat('fame') > 50 || x.c.politics.dictator) ? 0.6 : x.c.career?.careerId === 'monarch' ? 0.4 : 0),
    title: 'Shots fired', text: 'A gunman opens fire at your rally.',
    auto: (x) => { trauma(x, 18, 'violence'); if (x.chance(0.25)) { if (x.chance(0.3) && x.stat('divineFavor') < 75) { die(x, 'an assassin\'s bullet', 'murder'); return 'You did not survive.'; } x.log(`You were hit: ${injure(x, true)}`, 'bad'); } x.mods({ politicalApproval: 12, fame: 8 }); return 'You survived. Your approval soars.'; },
  },
  {
    id: 'pol_cabinetBetrayal', cat: 'politics', minAge: 25, cooldown: 4, weight: (x) => (x.c.politics.cabinet.length ? 1 : 0),
    bind: (x) => ({ npcId: x.pick(x.c.politics.cabinet) }),
    title: 'Palace intrigue', text: (x) => `Your minister ${who(x)} is plotting with the opposition.`,
    choices: [
      { label: 'Fire them', run: (x) => { x.c.politics.cabinet = x.c.politics.cabinet.filter((c) => c !== npcId(x)); x.addRel(npcId(x), 'enemy', { affinity: 10 }); return 'Out by morning.'; } },
      { label: 'Feed them false information', tags: ['ambitious'], run: (x) => { x.train('manipulation', 6); x.mod('politicalApproval', 4); return 'The opposition walked straight into your trap.'; } },
    ],
  },
  {
    id: 'pol_appointmentOffer', cat: 'politics', minAge: 30, cooldown: 6, weight: (x) => (!x.c.politics.office && x.stat('professionalRep') > 60 ? 0.6 : 0),
    title: 'A call from the capital', text: 'The government wants you for a senior appointed post.',
    choices: [
      { label: 'Accept', tags: ['ambitious'], run: (x) => { x.c.flags.held_nationalLegislator = true; takeOffice(x, OFFICE_BY_ID.cabinetMinister); return 'You are sworn in as a minister.'; } },
      { label: 'Decline', tags: ['cautious'], run: () => 'Politics is a dirty business.' },
    ],
  },
  // ------------------------------------------------------------------ finances
  {
    id: 'bankruptcy', cat: 'adult', triggered: true,
    title: 'Drowning in debt', text: (x) => `You owe ${x.fmt(x.c.debt)} and have nothing left.`,
    choices: [
      { label: 'Declare bankruptcy', run: (x) => { x.c.debt = 0; x.c.assets = x.c.assets.filter((a) => a.typeId === 'familyEstate'); x.c.flags.lastBankruptcy = x.age; x.mods({ happiness: -10, professionalRep: -8, stress: -10 }); x.remember('bankrupt', 'Went bankrupt', 40); return 'A clean slate, and a ruined credit score.'; } },
      { label: 'Borrow from a loan shark', tags: ['impulsive'], run: (x) => { const shark = makeNpc(x, { age: x.int(35, 60), karma: -50, criminal: 70, aggression: 70 }); const amt = Math.round(x.c.debt * 0.5); x.c.debt -= amt; x.addRel(shark.id, 'debtHolder', { affinity: 30, trust: 10, meta: { debt: Math.round(amt * 1.5) } }); x.mods({ anxiety: 10 }); return `${shark.firstName} "${x.pick(['the Knife', 'Smiley', 'Two-Times'])}" covered half your debt. He wants it back with interest.`; } },
      { label: 'Negotiate a payment plan', tags: ['cautious'], run: (x) => { x.c.debt = Math.round(x.c.debt * 0.8); x.mods({ stress: 4 }); return 'Years of payments ahead.'; } },
    ],
  },
  {
    id: 'pol_taxAudit', cat: 'adult', minAge: 25, cooldown: 6, years: [1914, 99999], weight: (x) => (x.netWorth() > 1000000 ? 0.8 : 0.1) + (x.c.crime.dirtyMoney > 0 ? 0.5 : 0),
    title: 'Tax audit', text: 'The tax authority wants to examine your finances.',
    choices: [
      { label: 'Cooperate fully', tags: ['cautious'], run: (x) => { if (x.c.crime.dirtyMoney > 50000 && x.chance(0.4)) { openCase(x, 'taxEvasion', { mult: 1.2 }); return 'They found unexplained income.'; } return 'All clear.'; } },
      { label: 'Hire an expensive accountant', when: (x) => x.c.money > 30000, run: (x) => { x.spend(30000); return 'Creative accounting, legally.'; } },
    ],
  },
  {
    id: 'm_fanMail', cat: 'media', minAge: 12, cooldown: 4, weight: (x) => (x.stat('fame') > 25 ? 0.7 : 0),
    title: 'A letter from a fan', text: 'A fan writes that your work got them through the hardest year of their life.',
    auto: (x) => { x.mods({ happiness: 6, karma: 1 }); return 'You read it three times.'; },
  },
  {
    id: 'm_leakedSecret', cat: 'media', minAge: 18, cooldown: 4, weight: (x) => (x.c.media.secrets.some((s) => !s.exposed) && x.stat('fame') > 30 ? 1.2 : 0),
    bind: (x) => { const s = x.c.media.secrets.find((q) => !q.exposed); return s ? { secret: s.id } : null; },
    title: 'A journalist calls', text: (x) => `An investigative journalist is asking questions about ${x.c.media.secrets.find((s) => s.id === x.p.secret)?.text.toLowerCase() ?? 'your past'}.`,
    choices: [
      { label: 'Bribe them', when: (x) => x.c.money > 40000, run: (x) => { x.spend(40000); if (x.chance(0.65)) { x.c.media.secrets = x.c.media.secrets.filter((s) => s.id !== x.p.secret); x.mod('corruption', 3); return 'The story was spiked.'; } return 'They published — and added the bribe.'; } },
      { label: 'Get ahead of it', tags: ['help'], run: (x) => { const s = x.c.media.secrets.find((q) => q.id === x.p.secret); if (s) { s.exposed = true; x.mods({ publicImage: -s.severity * 2, karma: 3 }); } return 'You told the story yourself. It hurt less.'; } },
      { label: 'Threaten them', tags: ['violent'], run: (x) => { x.mods({ karma: -6, fear: 4 }); if (x.chance(0.5)) return 'They backed off.'; const s = x.c.media.secrets.find((q) => q.id === x.p.secret); if (s) { s.exposed = true; s.severity++; } x.story('expose', `${x.c.firstName} ${x.c.lastName} threatened reporter`, -40); return 'They published the threat too.'; } },
    ],
  },
  {
    id: 'm_comeback', cat: 'media', minAge: 30, once: true, weight: (x) => (x.c.flags.survivedCancel || x.hasMemory('scandal') ? 1 : 0),
    title: 'The comeback', text: 'A producer pitches a redemption documentary about your fall and rise.',
    choices: [
      { label: 'Do it', tags: ['ambitious'], run: (x) => { x.mods({ fame: 10, publicImage: 10 }); x.money(x.int(50000, 400000)); return 'Audiences love a redemption arc.'; } },
      { label: 'Let the past stay past', tags: ['cautious'], run: () => 'Some stories are better left untold.' },
    ],
  },
  {
    id: 'm_quitFame', cat: 'media', minAge: 25, once: true, weight: (x) => (x.stat('fame') > 70 && x.stat('anxiety') > 50 ? 1 : 0),
    title: 'Walk away?', text: 'Fame is eating you alive.',
    choices: [
      { label: 'Leave the spotlight', tags: ['cautious'], run: (x) => { if (x.c.career && CAREER_BY_ID[x.c.career.careerId]?.tags.includes('fame')) endCareer(x, 'Left the spotlight'); x.mods({ anxiety: -15, fame: -15, happiness: 8 }); return 'You buy a farm. The paparazzi lose interest within a year.'; } },
      { label: 'Keep going', tags: ['ambitious'], run: (x) => { x.mods({ stress: 6 }); return 'The show must go on.'; } },
    ],
  },
];
