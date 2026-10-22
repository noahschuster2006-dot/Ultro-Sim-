import type { ChainDef, EventDef } from './types';
import { check, npcId, who } from './helpers';
import { acceptPact, addBlessing, addCurse, breakCurse, joinSociety, sellSoul } from '../systems/spirit';
import { PACTS, SOCIETY_BY_ID, CURSE_BY_ID } from '../data/occult';
import { RELIGION_BY_ID, religionWeights } from '../data/countries';
import { trauma } from '../systems/mind';
import { makeNpc } from '../systems/npcs';
import { commitCrime } from '../systems/legal';
import type { Ctx } from '../ctx';

function pactName(x: Ctx): string {
  return PACTS.find((p) => p.id === x.p.pactId)?.name ?? 'a pact';
}

/** Faith, the supernatural, curses, pacts and secret societies. */
export const SPIRIT_EVENTS: EventDef[] = [
  {
    id: 'pact_offer', cat: 'spiritual', triggered: true,
    title: 'A visitor at midnight', text: (x) => `A well-dressed stranger who casts no shadow offers you ${pactName(x)}: ${PACTS.find((p) => p.id === x.p.pactId)?.boon ?? ''}`,
    choices: [
      { label: 'Accept — a family member pays', tags: ['impulsive'], run: (x) => acceptPact(x, x.p.pactId as string, 'family') },
      { label: 'Accept — 20 years of your life', tags: ['impulsive'], run: (x) => acceptPact(x, x.p.pactId as string, 'years') },
      { label: 'Accept — curse your bloodline', tags: ['impulsive'], run: (x) => acceptPact(x, x.p.pactId as string, 'curse') },
      { label: 'Sell your soul for everything', tags: ['impulsive', 'ambitious'], when: (x) => x.c.spiritual.pacts.length >= 1, run: (x) => sellSoul(x) },
      { label: 'Refuse', tags: ['cautious'], run: (x) => { x.mods({ karma: 5, faith: 4 }); return 'The stranger smiles. "We will meet again."'; } },
    ],
  },
  {
    id: 'society_invite', cat: 'spiritual', triggered: true,
    title: (x) => `An invitation: ${SOCIETY_BY_ID[x.p.societyId as string]?.name ?? 'a society'}`,
    text: (x) => { const s = SOCIETY_BY_ID[x.p.societyId as string]; return s ? `A sealed envelope. ${s.kind}. Benefit: ${s.benefit} Cost: ${s.cost}` : ''; },
    choices: [
      { label: 'Swear the oath', run: (x) => joinSociety(x, x.p.societyId as string) },
      { label: 'Burn the letter', tags: ['cautious'], run: (x) => { x.c.spiritual.invites = x.c.spiritual.invites.filter((i) => i !== x.p.societyId); return 'Some doors are better left closed.'; } },
    ],
  },
  {
    id: 'society_demand', cat: 'spiritual', triggered: true,
    title: 'The society calls', text: (x) => `${SOCIETY_BY_ID[x.p.societyId as string]?.name ?? 'The society'} requires a sacrifice of you: your public reputation or a relationship.`,
    choices: [
      { label: 'Sacrifice your reputation', run: (x) => { x.mods({ publicImage: -15, professionalRep: -8 }); x.mods({ fame: 3 }); x.money(x.int(50000, 500000)); return 'A scandal appears from nowhere. Your accounts, however, swell.'; } },
      { label: 'Sacrifice a friendship', run: (x) => { const r = x.rels('bestFriend', 'friend')[0]; if (r) { r.type = 'enemy'; r.affinity = 0; } x.money(x.int(50000, 500000)); return 'Your friend received anonymous evidence of your worst moments.'; } },
      { label: 'Defy them', tags: ['impulsive'], run: (x) => { x.c.spiritual.societies = x.c.spiritual.societies.filter((s) => s !== x.p.societyId); x.mods({ paranoia: 15 }); const sec = x.c.media.secrets.find((s) => s.id === `society_${x.p.societyId}`); if (sec) sec.exposed = true; return 'You are expelled. Your membership is leaked to the press.'; } },
    ],
  },
  {
    id: 's_crisisOfFaith', cat: 'spiritual', minAge: 16, cooldown: 6, weight: (x) => (x.stat('faith') > 50 && (x.hasMemory('loss_child') || x.hasMemory('loss_spouse') || x.stat('trauma') > 50) ? 2 : 0.3),
    title: 'Crisis of faith', text: 'How could a loving god allow this?',
    choices: [
      { label: 'Hold on to your faith', run: (x) => { x.mods({ faith: 6, resilience: 4 }); x.train('prayer', 4); return 'Your faith is scarred, but stronger.'; } },
      { label: 'Let it go', run: (x) => { x.mods({ faith: -25, smarts: 1 }); return 'The sky is just the sky now.'; } },
      { label: 'Seek a new path', run: (x) => { const opts = Object.values(RELIGION_BY_ID).filter((r) => r.id !== x.c.religionId && r.id !== 'none' && r.from <= x.year && (r.to === undefined || r.to >= x.year)); if (!opts.length) return 'There is nowhere else to turn.'; const r = x.pick(opts); x.c.religionId = r.id; x.mods({ faith: 10 }); x.remember('converted', `Converted to ${r.name}`, 30); return `You converted to ${r.name}.`; } },
    ],
  },
  {
    id: 's_miracleWitness', cat: 'spiritual', minAge: 8, cooldown: 10, weight: (x) => (x.stat('divineFavor') >= 50 ? 1.5 : 0.1),
    title: 'A miracle', text: 'A stranger you prayed for rises from a hospital bed doctors said they would never leave.',
    auto: (x) => { x.mods({ faith: 10, spiritualAuthority: 6, fame: 2 }); x.train('miracleWorking', 6); x.remember('miracleWitness', 'Witnessed a miracle', 45); return 'Word spreads that your prayers work.'; },
  },
  {
    id: 's_haunted', cat: 'spiritual', minAge: 10, cooldown: 8, weight: (x) => 0.2 + x.stat('paranormal') / 50,
    title: 'Something in the house', text: 'Doors open on their own. Cold spots. Whispering.',
    choices: [
      { label: 'Call an exorcist', when: (x) => x.c.money > 3000, run: (x) => { x.spend(3000); x.mods({ faith: 3 }); return x.chance(0.6) ? 'Quiet returns.' : 'The exorcist fled in the night.'; } },
      { label: 'Try to communicate', tags: ['impulsive'], run: (x) => { x.train('spiritMediumship', 8); x.mods({ paranormal: 8, anxiety: 4 }); if (x.chance(0.3)) { const D = x.s.dynasty; const m = D.members.length ? x.pick(D.members) : null; return m ? `It is ${m.name}. They say: "${x.pick(['Beware your brother.', 'The money is under the floor.', 'Forgive me.', 'The curse is not finished.'])}"` : 'A child\'s voice. It wants to go home.'; } return 'It answered. You wish it had not.'; } },
      { label: 'Move out', tags: ['cautious'], run: (x) => { x.mods({ stress: 4 }); return 'Not your problem anymore.'; } },
    ],
  },
  {
    id: 's_possession', cat: 'spiritual', minAge: 12, cooldown: 12, violent: true, weight: (x) => (x.stat('karma') < -50 || x.c.spiritual.rituals > 2 ? 0.6 : 0.03),
    title: 'Lost time', text: 'You wake covered in scratches, in a place you do not remember going.',
    choices: [
      { label: 'Seek an exorcism', tags: ['help'], run: (x) => { x.spend(Math.min(Math.max(0, x.c.money), 8000)); if (check(x, x.stat('faith') + x.stat('willpower'), 80)) { x.mods({ faith: 8, trauma: 6 }); return 'Three nights of prayer. Whatever it was is gone.'; } x.mods({ trauma: 12, paranormal: 10 }); return 'It laughed at the priest.'; } },
      { label: 'Embrace it', tags: ['impulsive'], run: (x) => { x.mods({ paranormal: 15, sin: 10, karma: -10, fear: 8 }); x.train('demonology', 8); return 'It offers power. You say yes.'; } },
    ],
  },
  {
    id: 's_pilgrimage', cat: 'spiritual', minAge: 16, cooldown: 8, weight: (x) => (x.c.spiritual.curses.length || x.stat('faith') > 60 ? 1 : 0.2),
    title: 'Pilgrimage', text: 'Pilgrims are setting out for a holy site. They say miracles happen there.',
    choices: [
      { label: 'Join them', run: (x) => { x.spend(Math.min(Math.max(0, x.c.money), 2500)); x.mods({ faith: 10, wisdom: 4, happiness: 5, stress: -10 }); const c = x.c.spiritual.curses.find((q) => q.id === 'infertility' || q.id === 'misfortune'); if (c && x.stat('divineFavor') >= 40 && x.chance(0.5)) { breakCurse(x, c.id); return 'At the shrine, something lifts from your shoulders.'; } return 'Weeks of walking. You return changed.'; } },
      { label: 'Not this year', run: () => 'Perhaps next spring.' },
    ],
  },
  {
    id: 's_persecution', cat: 'spiritual', minAge: 10, cooldown: 6, violent: true, weight: (x) => { const dom = x.w.religionDominance; const majority = [...religionWeights(x.c.countryId, x.year)].sort((a, b) => b[1] - a[1])[0]?.[0]; return (dom === 'theocracy' || dom === 'stateReligion') && x.c.religionId !== majority && x.w.socialNorms < 45 ? 1.2 : 0; },
    title: 'Persecution', text: 'Officials are rounding up people of your faith.',
    choices: [
      { label: 'Worship in secret', tags: ['cautious'], run: (x) => { x.mods({ faith: 5, anxiety: 8 }); x.secret('secretFaith', 'Practicing a forbidden faith', 4); return 'Candles behind blackout curtains.'; } },
      { label: 'Publicly renounce it', run: (x) => { x.mods({ faith: -15, sin: 4 }); return 'You are safe. You cannot look at yourself.'; } },
      { label: 'Stand firm', tags: ['impulsive'], run: (x) => { x.mods({ faith: 10, spiritualAuthority: 8, heat: 15 }); trauma(x, 10, 'abuse'); if (x.chance(0.2)) { x.c.legal.record.push({ crime: 'Heresy', age: x.age, years: 1, countryId: x.c.countryId }); return 'You were imprisoned for your beliefs. Your courage inspires others.'; } return 'They beat you. You did not recant.'; } },
      { label: 'Flee', run: (x) => { x.mods({ loneliness: 8 }); x.c.flags.refugee = true; return 'You leave with what you can carry.'; } },
    ],
  },
  {
    id: 's_reformation', cat: 'spiritual', minAge: 25, once: true, weight: (x) => (x.stat('spiritualAuthority') > 50 && x.s.world.institutions.some((i) => i.religionId === x.c.religionId && i.corruption > 55) ? 2 : 0),
    title: 'Reformation', text: 'The institution you serve is rotten with corruption. Followers look to you.',
    choices: [
      { label: 'Lead a reformation', tags: ['ambitious'], run: (x) => { const inst = x.s.world.institutions.find((i) => i.religionId === x.c.religionId); if (inst) { inst.corruption -= 25; inst.schismRisk += 30; } x.mods({ fame: 15, spiritualAuthority: 15, heat: 10 }); x.remember('reformer', 'Led a religious reformation', 70); x.s.dynasty.reputation.spiritual += 8; return 'You nail your demands to the door. History will remember.'; } },
      { label: 'Corrupt it further from within', run: (x) => { x.money(x.int(100000, 2000000)); x.mods({ karma: -12, sin: 8, corruption: 10 }); return 'Tithes flow into accounts only you control.'; } },
      { label: 'Stay quiet', tags: ['cautious'], run: () => 'Not your fight.' },
    ],
  },
  {
    id: 's_holyWar', cat: 'spiritual', minAge: 30, once: true, weight: (x) => ((x.c.politics.office === 'headOfGovernment' || x.c.career?.careerId === 'monarch') && x.stat('faith') > 70 ? 1.5 : 0),
    title: 'Holy war', text: 'Clerics urge you to declare a holy war against the unbelievers.',
    choices: [
      { label: 'Declare holy war', tags: ['violent', 'ambitious'], run: (x) => { x.w.procWar = { name: 'holy war', years: x.int(3, 8), level: 'major' }; x.mods({ spiritualAuthority: 20, karma: -15, sin: 10, politicalApproval: 8 }); x.remember('holyWar', 'Declared a holy war', 80); return 'The faithful march.'; } },
      { label: 'Refuse', run: (x) => { x.mods({ karma: 6, spiritualAuthority: -10 }); return 'The clergy will not forget.'; } },
    ],
  },
  {
    id: 's_cultRecruit', cat: 'spiritual', minAge: 18, maxAge: 60, cooldown: 10, weight: (x) => (x.stat('loneliness') > 50 || x.stat('depression') > 50 ? 0.8 : 0.1),
    title: 'The retreat', text: 'A warm, smiling group invites you to a weekend retreat. Everyone is so kind.',
    bind: (x) => ({ npcId: makeNpc(x, { age: x.int(40, 65), career: 'cultLeader', careerLevel: 5, karma: -40 }).id }),
    choices: [
      { label: 'Join them', tags: ['impulsive'], run: (x) => { x.addRel(npcId(x), 'mentor', { affinity: 80, trust: 75 }); const tithe = Math.round(Math.max(0, x.c.money) * 0.5); x.c.money -= tithe; x.mods({ loneliness: -20, happiness: 8, smarts: -2 }); x.c.flags.cult = npcId(x); x.remember('joinedCult', `Joined ${who(x)}'s movement`, 40, npcId(x)); return `You hand over ${x.fmt(tithe)}. You have found your family.`; } },
      { label: 'Leave early', tags: ['cautious'], run: (x) => { x.mod('wisdom', 3); return 'Something about the locked doors felt wrong.'; } },
    ],
  },
  {
    id: 's_cultEscape', cat: 'spiritual', minAge: 18, cooldown: 3, weight: (x) => (x.c.flags.cult ? 2 : 0),
    title: 'The compound', text: 'The leader now wants your house, your savings and your children.',
    choices: [
      { label: 'Escape', tags: ['help'], run: (x) => { const id = x.c.flags.cult as string; x.c.flags.cult = false; const r = x.rel(id); if (r) r.type = 'enemy'; trauma(x, 12, 'abuse'); x.mods({ wisdom: 6 }); return 'You ran in the night. Deprogramming takes years.'; } },
      { label: 'Give everything', run: (x) => { x.c.money = 0; for (const a of x.c.assets.filter((q) => q.typeId === 'house')) a.seized = true; x.mods({ faith: 10, smarts: -3 }); return 'You are all in.'; } },
      { label: 'Take over the cult', tags: ['ambitious'], when: (x) => x.stat('charisma') > 65, run: (x) => { x.c.spiritual.foundedReligion = 'the Compound'; x.c.spiritual.followers = x.int(50, 400); x.mods({ ego: 10, sin: 5 }); x.c.flags.cult = false; return 'The leader "retired". The followers are yours now.'; } },
    ],
  },
  {
    id: 's_prophecy', cat: 'spiritual', minAge: 12, cooldown: 6, weight: (x) => (x.skill('prophecy') > 20 || x.stat('paranormal') > 50 ? 1.5 : 0),
    title: 'A vision', text: 'You see fire and a falling crown. You know it is the future.',
    choices: [
      { label: 'Proclaim it publicly', tags: ['ambitious'], run: (x) => { x.train('prophecy', 6); if (x.w.stability < 45) { x.mods({ spiritualAuthority: 12, fame: 8 }); return 'Months later, it comes true. People kneel when you pass.'; } x.mods({ publicImage: -5, paranoia: 3 }); return 'Nothing happens. People mock you.'; } },
      { label: 'Write it down and wait', tags: ['cautious'], run: (x) => { x.train('prophecy', 4); return 'The notebook fills.'; } },
    ],
  },
  {
    id: 's_curseSource', cat: 'spiritual', minAge: 20, cooldown: 10, weight: (x) => (x.c.spiritual.curses.length ? 1.5 : 0),
    bind: (x) => { const c = x.c.spiritual.curses[0]; return c ? { curse: c.id } : null; },
    title: 'The curse explained', text: (x) => `An old seer tells you where the ${CURSE_BY_ID[x.p.curse as string]?.name ?? 'curse'} began — and how it might end: ${CURSE_BY_ID[x.p.curse as string]?.breakPath ?? ''}`,
    choices: [
      { label: 'Begin the quest to break it', tags: ['ambitious'], run: (x) => { x.chain('curseBreak', 1, { curse: x.p.curse as string }); return 'You set out to break what was laid on your blood.'; } },
      { label: 'Accept your fate', run: (x) => { x.mods({ wisdom: 2, depression: 3 }); return 'Some burdens are carried, not broken.'; } },
    ],
  },
  {
    id: 'curse_trial', cat: 'chain', triggered: true,
    title: 'The trial of the curse', text: (x) => `To lift the ${CURSE_BY_ID[x.p.curse as string]?.name ?? 'curse'}, you must make a real sacrifice.`,
    choices: [
      { label: 'Give away a quarter of your wealth', tags: ['help'], run: (x) => { const amt = Math.round(Math.max(0, x.netWorth()) * 0.25); x.c.money = Math.max(0, x.c.money - amt); x.mods({ karma: 15 }); x.c.flags.curseSacrifice = true; return `You gave away ${x.fmt(amt)}.`; } },
      { label: 'A year of penance and non-violence', tags: ['cautious'], run: (x) => { x.mods({ karma: 10, aggression: -10, faith: 8 }); x.c.flags.curseSacrifice = true; return 'A year of silence and service.'; } },
      { label: 'Abandon the quest', run: (x) => { x.endChain('curseBreak'); return 'The curse settles back in, heavier.'; } },
    ],
  },
  {
    id: 'curse_end', cat: 'chain', triggered: true,
    title: 'Breaking point', text: 'An exorcist, a shrine and your sacrifice. Tonight it ends — one way or another.',
    auto: (x) => { const id = x.p.curse as string; if (x.c.flags.curseSacrifice && x.chance(0.75)) { breakCurse(x, id); x.s.dynasty.curses = x.s.dynasty.curses.filter((c) => c.id !== id); x.bump('cursesBroken'); return 'The curse on your bloodline is broken.'; } trauma(x, 6, 'disaster'); return 'It was not enough. The curse holds.'; },
  },
  {
    id: 's_ancestorBlessing', cat: 'spiritual', minAge: 10, once: true, weight: (x) => (x.s.dynasty.members.some((m) => m.afterlife === 'heaven' || m.afterlife === 'transcendence') ? 0.8 : 0),
    title: 'An ancestor watches', text: (x) => `You dream of ${x.pick(x.s.dynasty.members.filter((m) => m.afterlife === 'heaven' || m.afterlife === 'transcendence')).name}. They place a hand on your head.`,
    auto: (x) => { addBlessing(x, x.pick(['fortune', 'vitality', 'wisdom', 'protection']), 1, 'An ancestor'); x.mods({ faith: 5 }); return 'You wake feeling protected.'; },
  },
  {
    id: 's_occultBook', cat: 'spiritual', minAge: 14, once: true, weight: (x) => (x.year < 1950 ? 0.3 : 0.15) + (x.stat('paranormal') > 30 ? 0.5 : 0),
    title: 'The forbidden book', text: 'In an estate sale you find a leather book bound in something that is not leather.',
    choices: [
      { label: 'Study it', tags: ['impulsive'], run: (x) => { x.train('ritual', 10); x.train('demonology', 8); x.mods({ paranormal: 10, sin: 5 }); x.c.spiritual.rituals++; return 'The words rearrange themselves when you look away.'; } },
      { label: 'Burn it', tags: ['cautious'], run: (x) => { x.mods({ karma: 3 }); return 'It screamed as it burned.'; } },
      { label: 'Sell it to a collector', run: (x) => { x.money(x.int(5000, 60000)); return 'The collector paid in cash and left quickly.'; } },
    ],
  },
  {
    id: 's_templeCorruption', cat: 'spiritual', minAge: 20, cooldown: 5, weight: (x) => (x.c.career?.careerId === 'cleric' || x.c.career?.careerId === 'televangelist' ? 1.5 : 0),
    title: 'The collection plate', text: 'Nobody audits the donations.',
    choices: [
      { label: 'Skim', tags: ['impulsive'], run: (x) => { const r = commitCrime(x, 'embezzlement'); x.mods({ sin: 6 }); x.secret('skimming', 'Embezzling church donations', 6); return r.text; } },
      { label: 'Fund a soup kitchen', tags: ['help'], run: (x) => { x.mods({ karma: 8, spiritualAuthority: 6 }); return 'The hungry are fed.'; } },
    ],
  },
  {
    id: 's_confession', cat: 'spiritual', minAge: 14, cooldown: 4, weight: (x) => (x.stat('sin') > 40 && x.stat('faith') > 40 ? 1.5 : 0),
    title: 'Confession', text: 'The weight of your sins presses on you.',
    choices: [
      { label: 'Confess everything', tags: ['help'], run: (x) => { x.mods({ sin: -20, karma: 5, anxiety: -6 }); return 'Absolution, or something like it.'; } },
      { label: 'Carry it', run: (x) => { x.mods({ anxiety: 3 }); return 'You keep your secrets.'; } },
    ],
  },
  {
    id: 's_ritualGoneWrong', cat: 'spiritual', minAge: 14, cooldown: 4, weight: (x) => (x.c.spiritual.rituals > 0 ? 0.8 : 0),
    title: 'The circle breaks', text: 'During a ritual, the chalk circle smudges.',
    auto: (x) => { if (x.chance(0.4)) { addCurse(x, x.pick(['madness', 'misfortune', 'violence']), 1, 'A ritual gone wrong'); return 'Something got out.'; } x.mods({ paranormal: 6 }); return 'You closed the circle just in time.'; },
  },
];

export const SPIRIT_CHAINS: ChainDef[] = [
  {
    id: 'curseBreak',
    name: 'Breaking the curse',
    desc: 'A quest chain to lift a curse from your bloodline.',
    steps: [
      { delay: 0, eventId: 'curse_trial' },
      { delay: 1, eventId: 'curse_end' },
    ],
  },
];
