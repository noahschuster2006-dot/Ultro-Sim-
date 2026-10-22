import type { ChainDef, EventDef } from './types';
import { check } from './helpers';
import { ASSET_BY_ID } from '../data/assets';
import { trauma } from '../systems/mind';
import { injure } from '../systems/body';
import { openCase } from '../systems/legal';
import { addBlessing, addCurse } from '../systems/spirit';
import { makeNpc } from '../systems/npcs';
import type { Ctx } from '../ctx';
import { fmtYear } from '../ctx';

function asset(x: Ctx) {
  return x.c.assets.find((a) => a.id === x.p.assetId);
}

/** Property incidents, dynasty legacy and secret endgame events. */
export const DYNASTY_EVENTS: EventDef[] = [
  // ------------------------------------------------------------------ assets
  {
    id: 'nightclub_incident', cat: 'assets', triggered: true, violent: true,
    title: 'Trouble at the club', text: (x) => `A brawl at ${asset(x)?.name.toLowerCase() ?? 'your club'} ended with someone in hospital.`,
    choices: [
      { label: 'Pay off the victim', when: (x) => x.c.money > 20000, run: (x) => { x.spend(20000); return 'An NDA and a check.'; } },
      { label: 'Hire tougher security', run: (x) => { x.spend(Math.min(Math.max(0, x.c.money), 15000)); x.mod('fear', 3); return 'Bouncers built like refrigerators.'; } },
      { label: 'Ignore it', tags: ['impulsive'], run: (x) => { const a = asset(x); if (a && x.chance(0.4)) { a.condition -= 20; a.value = Math.round(a.value * 0.85); return 'The licensing board suspended you for a month.'; } return 'It blew over.'; } },
    ],
  },
  {
    id: 'food_scandal', cat: 'assets', triggered: true,
    title: 'Food poisoning', text: (x) => `Dozens of customers got sick at ${asset(x)?.name.toLowerCase() ?? 'your restaurant'}.`,
    choices: [
      { label: 'Recall and apologize', tags: ['help'], run: (x) => { const a = asset(x); if (a) a.value = Math.round(a.value * 0.9); x.mods({ publicImage: 2, karma: 3 }); return 'Expensive, but customers respected it.'; } },
      { label: 'Blame a supplier', run: (x) => { const a = asset(x); if (a) a.value = Math.round(a.value * 0.8); x.mods({ karma: -3 }); return 'The supplier sued you.'; } },
    ],
  },
  {
    id: 'tenant_trouble', cat: 'assets', triggered: true,
    title: 'Tenant trouble', text: (x) => `The tenants at your ${asset(x)?.name.toLowerCase() ?? 'property'} stopped paying rent and trashed the place.`,
    choices: [
      { label: 'Evict them', run: (x) => { const a = asset(x); if (a) a.condition = Math.max(10, a.condition - 25); x.mods({ karma: -3, stress: 3 }); return 'Lawyers, locksmiths, and a lot of repairs.'; } },
      { label: 'Work out a payment plan', tags: ['help'], run: (x) => { x.mods({ karma: 4 }); return 'They were going through a hard time. They paid most of it back.'; } },
    ],
  },
  {
    id: 'war_crimes_exposure', cat: 'assets', triggered: true,
    title: 'Your weapons, their war crimes', text: 'Journalists traced weapons used in an atrocity back to your factory.',
    choices: [
      { label: 'Deny everything', run: (x) => { x.mods({ publicImage: -10, karma: -6 }); if (x.chance(0.3)) { const a = asset(x); if (a) a.seized = true; x.w.sanctions = 5; return 'International sanctions hit. Your factory was seized.'; } return 'The story faded.'; } },
      { label: 'Halt exports to the region', tags: ['help'], run: (x) => { const a = asset(x); if (a) a.value = Math.round(a.value * 0.8); x.mods({ karma: 5 }); return 'Profits fall. Your conscience improves.'; } },
    ],
  },
  {
    id: 'a_gentrification', cat: 'assets', minAge: 25, cooldown: 6, weight: (x) => (x.c.assets.some((a) => ['studio', 'apartmentComplex', 'commercial'].includes(a.typeId)) ? 0.8 : 0),
    title: 'The neighborhood changes', text: 'Artists and coffee shops are moving into the area around your property.',
    choices: [
      { label: 'Raise rents', tags: ['ambitious'], run: (x) => { for (const a of x.c.assets.filter((q) => ['studio', 'apartmentComplex', 'commercial'].includes(q.typeId))) a.value = Math.round(a.value * 1.25); x.mods({ karma: -4 }); return 'Values soar. Long-time residents are priced out.'; } },
      { label: 'Keep rents fair', tags: ['help'], run: (x) => { for (const a of x.c.assets.filter((q) => ['studio', 'apartmentComplex', 'commercial'].includes(q.typeId))) a.value = Math.round(a.value * 1.1); x.mods({ karma: 5 }); return 'You are the only landlord people like.'; } },
    ],
  },
  {
    id: 'a_takeover', cat: 'assets', minAge: 25, cooldown: 6, weight: (x) => (x.c.assets.some((a) => ['restaurant', 'nightclub', 'casino', 'mediaCompany'].includes(a.typeId)) ? 0.6 : 0),
    bind: (x) => { const a = x.c.assets.find((q) => ['restaurant', 'nightclub', 'casino', 'mediaCompany'].includes(q.typeId)); return a ? { assetId: a.id } : null; },
    title: 'An offer you can\'t refuse', text: (x) => `A rival wants to buy ${asset(x)?.name.toLowerCase() ?? 'your business'} for 1.4× its value.${x.p.mob ? ' The "offer" comes from the mob.' : ''}`,
    choices: [
      { label: 'Sell', run: (x) => { const a = asset(x); if (!a) return ''; x.money(Math.round(a.value * 1.4 - a.mortgage)); x.c.assets = x.c.assets.filter((q) => q !== a); return 'A tidy profit.'; } },
      { label: 'Refuse', tags: ['impulsive'], run: (x) => { if (x.chance(0.25)) { const a = asset(x); if (a) { a.condition = 20; a.value = Math.round(a.value * 0.6); } return 'A week later, a suspicious fire.'; } return 'They backed off.'; } },
    ],
  },
  {
    id: 'a_fire', cat: 'assets', minAge: 18, cooldown: 8, weight: (x) => (x.c.assets.filter((a) => ASSET_BY_ID[a.typeId]?.cat === 'property').length ? 0.3 + (x.curse('misfortune') ? 0.5 : 0) : 0),
    bind: (x) => { const a = x.c.assets.find((q) => ASSET_BY_ID[q.typeId]?.cat === 'property'); return a ? { assetId: a.id } : null; },
    title: 'Fire!', text: (x) => `${asset(x)?.name ?? 'Your property'} caught fire.`,
    auto: (x) => { const a = asset(x); if (a) { a.condition = 15; a.value = Math.round(a.value * 0.5); } if (x.chance(0.15)) return `You were inside: ${injure(x, false)}`; return x.year > 1900 ? 'Insurance will cover some of it.' : 'There is no insurance.'; },
  },
  // ------------------------------------------------------------------ dynasty
  {
    id: 'd_nameRecognition', cat: 'dynasty', minAge: 16, cooldown: 8, weight: (x) => (x.s.dynasty.milestones.includes('remembered') || Object.values(x.s.dynasty.reputation).some((v) => v > 70) ? 1.5 : 0),
    title: 'Your name precedes you', text: (x) => { const r = x.s.dynasty.reputation; const top = (Object.entries(r) as [string, number][]).sort((a, b) => b[1] - a[1])[0]; return `"A ${x.c.lastName}?" a stranger says. "Your family is known for its ${top[0]} power."`; },
    auto: (x) => { const r = x.s.dynasty.reputation; if (r.criminal > 70) { x.mods({ heat: 6, fear: 6, streetCred: 6 }); return 'Police watch you. Gangsters nod with respect.'; } if (r.social > 70) { x.mods({ publicImage: 6 }); return 'Doors open.'; } if (r.political > 70) { x.mod('politicalApproval', 6); return 'Party officials take your calls.'; } x.mod('confidence', 4); return 'You stand a little taller.'; },
  },
  {
    id: 'd_estateDispute', cat: 'dynasty', minAge: 20, cooldown: 10, weight: (x) => (x.c.assets.some((a) => a.typeId === 'familyEstate') && x.rels('sibling').length ? 1 : 0),
    title: 'The family estate', text: 'Your siblings demand their share of the family estate.',
    choices: [
      { label: 'Buy them out', when: (x) => x.c.money > 400000, run: (x) => { x.spend(400000); for (const r of x.rels('sibling')) x.relMod(r.npcId, 10); return 'The estate is yours alone.'; } },
      { label: 'Refuse — it stays intact', run: (x) => { for (const r of x.rels('sibling')) x.relMod(r.npcId, -20); x.s.dynasty.prestige += 2; return 'The estate survives. Your siblings do not speak to you.'; } },
      { label: 'Sell and split', run: (x) => { const e = x.c.assets.find((a) => a.typeId === 'familyEstate'); if (e) { x.money(Math.round(e.value / (x.rels('sibling').length + 1))); x.c.assets = x.c.assets.filter((a) => a !== e); x.s.dynasty.estateAssetId = null; } x.s.dynasty.prestige -= 10; return 'Generations of history, sold to a developer.'; } },
    ],
  },
  {
    id: 'd_ancestorGhost', cat: 'dynasty', minAge: 10, cooldown: 12, weight: (x) => (x.s.dynasty.members.length && x.stat('paranormal') > 30 ? 1 : 0),
    title: 'An ancestor appears', text: (x) => `The ghost of ${x.pick(x.s.dynasty.members).name} stands at the foot of your bed.`,
    choices: [
      { label: 'Listen', run: (x) => { const m = x.s.dynasty.members[x.s.dynasty.members.length - 1]; x.mods({ wisdom: 5, paranormal: 5 }); return m.afterlife === 'hell' ? '"Do not make my mistakes," it whispers, smelling of smoke.' : '"I am proud of you," it says, and fades.'; } },
      { label: 'Flee the room', tags: ['cautious'], run: (x) => { x.mod('anxiety', 6); return 'You sleep with the lights on for a month.'; } },
    ],
  },
  {
    id: 'd_legendDescendant', cat: 'dynasty', minAge: 16, cooldown: 15, weight: (x) => (x.s.world.legends.some((l) => l.dynasty !== x.s.dynasty.name) ? 0.4 : 0),
    title: 'Echoes of a legend', text: (x) => { const l = x.pick(x.s.world.legends); return `You meet a descendant of ${l.name}, ${l.title}. Their family still lives in that shadow.`; },
    auto: (x) => { const n = makeNpc(x, { age: x.age + x.int(-5, 5) }); x.addRel(n.id, 'friend', { affinity: 55 }); x.mod('wisdom', 2); return `${n.firstName} and you compare notes on carrying famous names.`; },
  },
  {
    id: 'd_ancientBloodline', cat: 'secret', minAge: 16, cooldown: 10, secret: true, weight: (x) => (x.s.dynasty.generation >= 50 ? 2 : 0),
    title: 'Ancient blood', text: (x) => `Strange people seek you out. They say the ${x.s.dynasty.name} bloodline is older than kingdoms, and that something old remembers it.`,
    choices: [
      { label: 'Accept the bloodline\'s power', run: (x) => { addBlessing(x, 'protection', 1, 'Ancient bloodline'); x.mods({ paranormal: 20, fame: 6 }); return 'Your dreams are full of your ancestors\' voices.'; } },
      { label: 'Reject it', run: (x) => { x.mods({ wisdom: 4 }); return 'You are your own person. The voices go quiet.'; } },
    ],
  },
  {
    id: 'legend_rise', cat: 'chain', triggered: true,
    title: 'The legend begins', text: (x) => `Bards, journalists and historians are all writing about the ${x.s.dynasty.name} dynasty.`,
    auto: (x) => { x.mods({ fame: 15 }); x.s.dynasty.prestige += 20; return 'Your family is becoming myth.'; },
  },
  {
    id: 'legend_trial', cat: 'chain', triggered: true,
    title: 'The weight of legend', text: 'Rivals of every kind want to topple the legendary dynasty — and you are its face.',
    choices: [
      { label: 'Defend the family name at any cost', tags: ['ambitious'], run: (x) => { x.mods({ stress: 10, fear: 10 }); x.s.dynasty.prestige += 15; return 'The dynasty holds.'; } },
      { label: 'Step out of the shadow', run: (x) => { x.mods({ happiness: 10 }); x.s.dynasty.prestige -= 5; return 'You live a life that is yours alone.'; } },
    ],
  },
  {
    id: 'legend_apotheosis', cat: 'chain', triggered: true,
    title: 'Myth', text: (x) => `Children in faraway lands tell stories of the ${x.s.dynasty.name}s. The dynasty is now legend.`,
    auto: (x) => { x.s.world.legends.push({ name: `the ${x.s.dynasty.name} dynasty`, dynasty: x.s.dynasty.name, year: x.year, kind: 'fame', title: 'legendary bloodline' }); x.s.dynasty.prestige += 50; return 'Whatever happens now, you will be remembered.'; },
  },
  // ------------------------------------------------------------------ secret endgame events
  {
    id: 'x_abyss', cat: 'secret', minAge: 16, once: true, secret: true, weight: (x) => (x.stat('karma') <= -95 ? 5 : 0),
    title: 'The abyss stares back', text: 'Your karma has reached the bottom. Something vast and patient turns its attention to you.',
    choices: [
      { label: 'Become its herald', run: (x) => { x.mods({ fear: 40, paranormal: 30, sin: 20 }); x.train('soulHarvesting', 15); x.remember('herald', 'Became the herald of something below', 95); return 'Animals flee from you. Lights dim when you enter rooms.'; } },
      { label: 'Repent with everything you have', tags: ['help'], run: (x) => { x.mods({ karma: 40, faith: 20, happiness: -10 }); x.spend(Math.max(0, x.c.money) * 0.8); x.remember('repented', 'Repented from the very bottom', 95); return 'You give everything away. Something lets you go.'; } },
    ],
  },
  {
    id: 'x_livingSaint', cat: 'secret', minAge: 16, once: true, secret: true, weight: (x) => (x.stat('karma') >= 95 ? 5 : 0),
    title: 'A living saint', text: 'People bring you their sick. Some of them get better.',
    auto: (x) => { x.mods({ divineFavor: 30, spiritualAuthority: 30, fame: 15 }); x.train('miracleWorking', 20); addBlessing(x, 'vitality', 1, 'Sainthood'); x.remember('saint', 'Was called a living saint', 95); return 'Pilgrims gather outside your door.'; },
  },
  {
    id: 'x_perfectBeing', cat: 'secret', minAge: 20, once: true, secret: true, weight: (x) => (['happiness', 'health', 'smarts', 'looks', 'fitness', 'wisdom', 'charisma', 'discipline'].every((k) => x.stat(k as never) >= 88) ? 5 : 0),
    title: 'Peak human', text: 'Scientists ask to study you. You are, by every measure, extraordinary.',
    auto: (x) => { x.mods({ fame: 25, ego: 10 }); x.s.dynasty.traitPool.push('scholarly', 'athletic', 'charismatic'); x.remember('peak', 'Was studied as a peak human', 90); return 'Your descendants will inherit some of it.'; },
  },
  {
    id: 'x_globalSyndicate', cat: 'secret', minAge: 25, once: true, secret: true, weight: (x) => (x.c.crime.orgRank >= 6 ? 5 : 0),
    title: 'The shadow government', text: 'Every criminal empire on Earth now answers to you. Presidents take your calls.',
    choices: [
      { label: 'Buy a nation', tags: ['ambitious'], run: (x) => { x.mods({ politicalApproval: 30, corruption: 30, fear: 20 }); x.w.regimeOverride = 'autocracy'; x.w.ruler = `Puppet ruler (owned by ${x.c.firstName} ${x.c.lastName})`; return 'You now own a country. Officially, you own nothing.'; } },
      { label: 'Vanish into legend', run: (x) => { x.c.crime.orgRank = 6; x.set('heat', 0); x.mods({ infamy: 20 }); return 'Nobody can find you. Everybody fears you.'; } },
    ],
  },
  {
    id: 'x_curseFree', cat: 'secret', minAge: 20, once: true, secret: true, weight: (x) => (((x.c.flags.cursesBroken as number) || 0) >= 2 && x.s.dynasty.curses.length === 0 ? 5 : 0),
    title: 'The bloodline is clean', text: 'Every curse on your family has been broken.',
    auto: (x) => { addBlessing(x, 'fortune', 2, 'A cleansed bloodline'); x.s.dynasty.blessings.push({ id: 'fortune', level: 2, source: 'A cleansed bloodline' }); x.mods({ happiness: 15 }); return 'Your descendants will be born free.'; },
  },
  {
    id: 'x_timeCapsule', cat: 'secret', minAge: 30, once: true, secret: true, weight: (x) => (x.s.dynasty.generation >= 3 && x.s.dynasty.members.length >= 2 ? 0.6 : 0),
    title: 'A time capsule', text: (x) => `Renovating the old house, you find a box left by ${x.s.dynasty.members[0].name}, generation 1.`,
    auto: (x) => { const f = x.s.dynasty.members[0]; x.money(x.int(1000, 50000)); x.mods({ wisdom: 4, happiness: 4 }); return `A letter: "To whoever carries our name in ${fmtYear(x.year)}: I was ${f.title.toLowerCase()}. Do better than me." Old coins wrapped in cloth.`; },
  },
  {
    id: 'x_doppelganger', cat: 'secret', minAge: 18, once: true, secret: true, weight: (x) => (x.stat('paranormal') >= 70 ? 1 : 0),
    title: 'Doppelgänger', text: 'You see yourself across the street. It smiles and walks away.',
    choices: [
      { label: 'Follow it', tags: ['impulsive'], run: (x) => { if (x.chance(0.5)) { addCurse(x, 'madness', 1, 'The doppelgänger'); return 'It led you somewhere you cannot describe. You came back different.'; } x.train('spiritMediumship', 10); return 'It vanished into a crowd. You understand something new about reality.'; } },
      { label: 'Look away', tags: ['cautious'], run: (x) => { x.mod('anxiety', 5); return 'When you looked back, it was gone.'; } },
    ],
  },
  {
    id: 'x_lastWitness', cat: 'secret', minAge: 100, once: true, secret: true, weight: 3,
    title: 'The last witness', text: (x) => `You are the last person alive who remembers ${x.year - x.age + 10}.`,
    auto: (x) => { x.mods({ fame: 10, wisdom: 6 }); x.story('profile', `The last witness to a vanished world`, 30); return 'Historians record every word you say.'; },
  },
  {
    id: 'x_rivalDynasty', cat: 'secret', minAge: 20, cooldown: 20, secret: true, weight: (x) => (x.s.dynasty.enemies.filter((e) => e.generation <= x.s.dynasty.generation - 2).length ? 1.5 : 0),
    bind: (x) => { const e = x.s.dynasty.enemies.find((q) => q.generation <= x.s.dynasty.generation - 2); return e ? { name: e.name, reason: e.reason } : null; },
    title: 'An old blood feud', text: (x) => `Descendants of ${x.p.name} have not forgotten: ${x.p.reason}. Generations later, they want revenge.`,
    choices: [
      { label: 'End the feud with a gesture', tags: ['help'], run: (x) => { x.s.dynasty.enemies = x.s.dynasty.enemies.filter((e) => e.name !== x.p.name); x.mods({ karma: 8, wisdom: 4 }); return 'Two families, finally at peace.'; } },
      { label: 'Prepare for war', tags: ['violent'], run: (x) => { const n = makeNpc(x, { age: x.age + x.int(-5, 5), karma: -30, aggression: 65 }); x.addRel(n.id, 'nemesis', { affinity: 0, trust: 0, meta: { feud: true } }); return `${n.firstName} ${n.lastName} is now your nemesis.`; } },
    ],
  },
  {
    id: 'x_heirConflict', cat: 'dynasty', minAge: 55, cooldown: 8, weight: (x) => (x.rels('child').filter((r) => x.npcAge(x.npc(r.npcId)!) >= 18).length >= 2 && x.netWorth() > 1000000 ? 1 : 0),
    title: 'Succession', text: 'Your children are already fighting over who will inherit the family empire.',
    choices: [
      { label: 'Name a single heir', run: (x) => { const kids = x.rels('child').sort((a, b) => b.affinity - a.affinity); if (!x.c.will) x.c.will = { shares: {}, charity: 0, trustFund: false }; kids.forEach((k, i) => (x.c.will!.shares[k.npcId] = i === 0 ? 80 : Math.round(20 / Math.max(1, kids.length - 1)))); for (const k of kids.slice(1)) x.relMod(k.npcId, -15); return `${x.first(kids[0].npcId)} is your heir. The others are bitter.`; } },
      { label: 'Split it equally', tags: ['help'], run: (x) => { const kids = x.rels('child'); if (!x.c.will) x.c.will = { shares: {}, charity: 0, trustFund: false }; for (const k of kids) x.c.will.shares[k.npcId] = Math.round(100 / kids.length); return 'Fair, if not efficient.'; } },
      { label: 'Make them compete for it', tags: ['impulsive'], run: (x) => { for (const k of x.rels('child')) { const n = x.npc(k.npcId); if (n) n.ambition = Math.min(100, n.ambition + 10); } x.mods({ karma: -3 }); return 'Your children become rivals.'; } },
    ],
  },
  {
    id: 'x_famousAncestorShadow', cat: 'dynasty', minAge: 16, once: true, weight: (x) => (x.s.dynasty.members.some((m) => m.legendary) ? 1.5 : 0),
    title: 'In their shadow', text: (x) => { const m = x.s.dynasty.members.find((q) => q.legendary)!; return `Everyone compares you to ${m.name}.`; },
    choices: [
      { label: 'Embrace the legacy', tags: ['ambitious'], run: (x) => { x.mods({ fame: 6, stress: 4 }); return 'You wear the name like armor.'; } },
      { label: 'Forge your own path', run: (x) => { x.mods({ confidence: 6, creativity: 4 }); return 'You will be known for your own deeds.'; } },
    ],
  },
  {
    id: 'x_heirBattle', cat: 'dynasty', minAge: 18, maxAge: 40, once: true, weight: (x) => (x.c.flags.familyOrg ? 2 : 0),
    title: 'The family business', text: (x) => `${x.c.flags.familyOrg} sends word: your parent's seat at the table is waiting for you.`,
    choices: [
      { label: 'Take your seat', tags: ['ambitious'], run: (x) => { x.c.crime.orgName = x.c.flags.familyOrg as string; x.c.crime.orgRank = 2; x.c.crime.orgLoyalty = 60; x.mods({ criminalRep: 20, streetCred: 15 }); x.chain('mafia', 2, {}); return 'Blood is blood.'; } },
      { label: 'Walk away from it', tags: ['cautious'], run: (x) => { x.c.flags.familyOrg = false; x.mods({ karma: 4, paranoia: 4 }); return 'They let you go — for now.'; } },
    ],
  },
  {
    id: 'x_injuredPride', cat: 'dynasty', minAge: 25, cooldown: 10, violent: true, weight: (x) => (x.s.dynasty.reputation.criminal > 75 ? 0.8 : 0),
    title: 'Vendetta', text: 'An old rival of your bloodline tries to kill you on your doorstep.',
    auto: (x) => { trauma(x, 12, 'violence'); if (check(x, x.stat('fitness') + x.stat('fear') / 2, 60)) { openCase(x, 'murder', { label: 'Self-defense killing', mult: 0.5 }); return 'You survived. Your attacker did not.'; } return `You survived: ${injure(x, true)}`; },
  },
];

export const DYNASTY_CHAINS: ChainDef[] = [
  {
    id: 'dynastyLegend',
    name: 'Dynasty legend',
    desc: 'Generation 20 with immense wealth and prestige: the bloodline becomes myth.',
    steps: [
      { delay: 0, eventId: 'legend_rise' },
      { delay: 4, eventId: 'legend_trial' },
      { delay: 6, eventId: 'legend_apotheosis' },
    ],
  },
];
