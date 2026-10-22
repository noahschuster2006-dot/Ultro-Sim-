import type { ChainDef, EventDef } from './types';
import type { Ctx } from '../ctx';
import type { Params } from '../types';
import { check, npcId, who, whoFull } from './helpers';
import { eraCostFactor } from '../systems/finance';
import { makeNpc } from '../systems/npcs';
import type { NpcOpts } from '../systems/npcs';
import { commitCrime, openCase, release } from '../systems/legal';
import { canJoinOrg, joinOrg } from '../systems/underworld';
import { addBlessing, addCurse, breakCurse } from '../systems/spirit';
import { injure } from '../systems/body';
import { trauma } from '../systems/mind';

/*
 * Fortune: money, fame, power, crime and the law, and the unseen.
 * Windfalls and swindles, paparazzi and petitions, juries and cellmates,
 * omens, hauntings and the odd miracle.
 */

/** Modern dollars to era money. */
const $ = (x: Ctx, n: number): number => Math.max(1, Math.round(n * eraCostFactor(x.year)));

/** How news travels in this era. */
function crier(x: Ctx): string {
  if (x.year < 1450) return 'the town crier';
  if (x.year < 1800) return 'the broadsheets';
  if (x.year < 1925) return 'the newspapers';
  if (x.year < 1955) return 'the radio';
  if (x.year < 2006) return 'the evening news';
  return 'social media';
}

/** Already living on the wrong side of the law. */
function crook(x: Ctx): boolean {
  const n = Object.values(x.c.crime.committed).reduce((a, b) => a + b, 0);
  return !!x.c.crime.orgName || x.stat('criminalRep') >= 15 || n >= 2;
}

/** A brand-new person, not yet in your contacts. */
function stranger(x: Ctx, o: NpcOpts = {}): Params {
  const n = makeNpc(x, { age: x.int(25, 65), ...o });
  return { npcId: n.id };
}

/** Bind an existing relation, or invent a stranger if there is none. */
function relOrStranger(x: Ctx, types: Parameters<Ctx['rels']>, o: NpcOpts = {}): Params {
  const r = x.rels(...types);
  return r.length ? { npcId: x.pick(r).npcId } : stranger(x, o);
}

function shop(x: Ctx): string {
  if (x.year < 1800) return 'market stall';
  if (x.year < 1950) return 'corner shop';
  return 'store';
}


// ==================================================================== MONEY
const MONEY: EventDef[] = [
  {
    id: 'fo_strangerWill', cat: 'assets', minAge: 18, weight: 0.4, once: true, scene: 'moneyUp',
    bind: (x) => stranger(x, { age: x.int(70, 95) }),
    title: "A stranger's will",
    text: (x) => `A lawyer's letter: ${whoFull(x)}, whom you never met, has left you ${x.fmt($(x, 60000))} "for the kindness at the station".`,
    choices: [
      { label: 'Take the money', tags: ['impulsive'], scene: 'moneyUp', run: (x) => { const a = x.money($(x, 60000)); x.mods({ happiness: 8 }); return `You pocketed ${x.fmt(a)} and still cannot remember the station.`; } },
      { label: 'Find out who they were', tags: ['cautious'], run: (x) => { const a = x.money($(x, 60000)); x.mods({ empathy: 4, wisdom: 3 }); x.remember('strangerWill', `Inherited from a stranger, ${whoFull(x)}`, 40); return `You helped an old ${x.npc(npcId(x))?.gender === 'female' ? 'woman' : 'man'} with a suitcase once. It was worth ${x.fmt(a)}.`; } },
      { label: 'Give it to their family', tags: ['help'], run: (x) => { x.mods({ karma: 10, happiness: 3 }); x.mod('divineFavor', 3); return 'The niece cried, then asked if you were single. You left quickly.'; } },
    ],
  },
  {
    id: 'fo_fairDice', cat: 'assets', minAge: 16, years: [-800, 1700], weight: 0.8, scene: 'casino',
    title: 'Dice at the fair',
    text: () => `A man at the fair offers triple your stake if you roll higher than him. His dice look suspiciously clean.`,
    choices: [
      { label: `Bet a week's wages`, tags: ['impulsive'], run: (x) => { const s = $(x, 300); if (!x.spend(s)) return 'You had nothing to stake, which saved you.'; if (x.chance(0.3)) { x.money(s * 3); x.mods({ happiness: 5 }); return 'You rolled a twelve and he looked genuinely betrayed.'; } x.mods({ happiness: -3 }); return 'His dice rolled sixes three times in a row. Remarkable dice.'; } },
      { label: 'Swap his dice', tags: ['ambitious'], when: (x) => x.stat('dexterity') > 40, run: (x) => { if (check(x, x.stat('dexterity') + x.skill('pickpocketing'), 70)) { x.money($(x, 900)); x.train('pickpocketing', 3); return 'You cheated the cheater, and he could not complain.'; } x.mods({ health: -4 }); return 'He noticed. His large friend noticed too.'; } },
      { label: 'Watch the marks instead', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 2 }); return 'You learned more about people in an hour than in a year of church.'; } },
    ],
  },
  {
    id: 'fo_lotteryTicket', cat: 'assets', minAge: 18, years: [1700, 2300], weight: 0.8, cooldown: 4, scene: 'casino',
    title: (x) => (x.year >= 1975 ? 'Scratch card' : 'Lottery ticket'),
    text: (x) => (x.year >= 1975 ? `The cashier slides a scratch card across with your change. "Feeling lucky?"` : `A ticket-seller is hawking shares in the state lottery outside the post office.`),
    choices: [
      { label: 'Buy one', tags: ['impulsive'], run: (x) => { if (!x.spend($(x, 5))) return 'You could not spare it.'; const r = x.r(); if (r < 0.002) { const a = x.money($(x, 2000000)); x.mods({ happiness: 25 }); x.story('puff', 'Local winner hits the jackpot', 30); x.remember('jackpot', 'Won the lottery jackpot', 85); return `JACKPOT. ${x.fmt(a)}. You sat down on the pavement and laughed.`; } if (r < 0.06) { const a = x.money($(x, 500)); x.mods({ happiness: 5 }); return `You won ${x.fmt(a)} and immediately felt like a genius.`; } return 'Nothing. A small, familiar sorrow.'; } },
      { label: 'Buy twenty', tags: ['impulsive', 'ambitious'], run: (x) => { if (!x.spend($(x, 100))) return 'Your wallet vetoed that.'; if (x.chance(0.04)) { const a = x.money($(x, 25000)); x.mods({ happiness: 12 }); return `One of them paid ${x.fmt(a)}. You will never stop buying twenty now.`; } x.mods({ happiness: -3 }); return 'Twenty losers. You kept one as a bookmark of shame.'; } },
      { label: 'Save the money', tags: ['cautious'], run: (x) => { x.mods({ discipline: 2 }); return 'You did the maths and felt smug for the rest of the day.'; } },
    ],
  },
  {
    id: 'fo_spanishPrisoner', cat: 'assets', minAge: 20, years: [1500, 1994], weight: 0.6, once: true, scene: 'loveLetter',
    title: 'A desperate letter',
    text: (x) => `A letter claims a nobleman is imprisoned abroad with a fortune. Send ${x.fmt($(x, 2000))} for his bribes and he will share it all with you.`,
    choices: [
      { label: 'Send the money', tags: ['impulsive'], run: (x) => { if (!x.spend($(x, 2000))) return 'You could not raise it, which was the luckiest poverty of your life.'; x.mods({ happiness: -6, romanticCynicism: 3 }); x.remember('scammed', 'Fell for a prisoner swindle', 30); return 'A second letter asked for more. The nobleman remains, conveniently, imprisoned.'; } },
      { label: 'Report it', tags: ['cautious', 'help'], run: (x) => { x.mods({ karma: 2, wisdom: 2 }); return 'The constable sighed. "Third one this week."'; } },
      { label: 'Write back with a story', tags: ['social'], run: (x) => { x.train('writing', 3); x.mods({ happiness: 4 }); return 'You claimed to be a duke with your own imprisoned duke. The correspondence lasted a year.'; } },
    ],
  },
  {
    id: 'fo_princeEmail', cat: 'assets', minAge: 18, years: [1995, 2300], weight: 0.6, cooldown: 6, scene: 'hacker',
    title: 'Urgent: confidential',
    text: (x) => `An email from a "royal family accountant" needs your bank details to move ${x.fmt($(x, 15000000))}. Your cut: 30%.`,
    choices: [
      { label: 'Reply with details', tags: ['impulsive'], run: (x) => { const loss = Math.min(x.c.money, $(x, 4000)); x.spend(loss); x.mods({ happiness: -6 }); x.remember('scammed', 'Fell for an email scam', 30); return `Your account lost ${x.fmt(loss)} overnight. The accountant is no longer replying.`; } },
      { label: 'Delete it', tags: ['cautious'], run: (x) => { x.train('cybersecurity', 1); return 'Delete. The prince will have to find another friend.'; } },
      { label: 'Scam-bait them', tags: ['social'], run: (x) => { x.mods({ happiness: 5 }); x.train('deception', 3); return 'You kept a scammer busy for weeks sending photos of fake passports drawn in crayon.'; } },
    ],
  },
  {
    id: 'fo_bankCall', cat: 'assets', minAge: 30, years: [2010, 2300], weight: 0.7, cooldown: 5, scene: 'gadget',
    title: 'Your bank calling',
    text: () => `"This is fraud prevention. Your account is compromised. Please read me the code we just texted you."`,
    choices: [
      { label: 'Read the code', tags: ['impulsive'], run: (x) => { const loss = Math.min(x.c.money, $(x, 6000)); x.spend(loss); x.mods({ anxiety: 6, happiness: -5 }); return `The "fraud team" was the fraud. ${x.fmt(loss)} gone in nine seconds.`; } },
      { label: 'Hang up and call the bank', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 2 }); x.train('cybersecurity', 2); return 'The real bank thanked you and froze nothing. Correctly paranoid.'; } },
      { label: 'Play along', tags: ['social'], when: (x) => x.stat('confidence') > 50, run: (x) => { x.mods({ happiness: 4 }); return 'You pretended your phone was a toaster. He hung up first.'; } },
    ],
  },
  {
    id: 'fo_cryptoTip', cat: 'assets', minAge: 18, years: [2010, 2030], weight: 0.9, once: true, scene: 'stocks',
    title: 'Magic internet money',
    text: (x) => `A friend swears an obscure digital coin is the future. ${x.year < 2015 ? 'It costs less than a sandwich.' : 'It has a dog on the logo.'}`,
    choices: [
      { label: 'Buy a little', tags: ['ambitious'], run: (x) => { const s = $(x, 500); if (!x.spend(s)) return 'Broke, and therefore immune.'; x.setFlag('fo_crypto', s); x.train('cryptoTrading', 3); x.chain('fo_cryptoChain', 0, {}); return 'You bought some. You forgot the password within a week.'; } },
      { label: 'Go all in', tags: ['impulsive'], run: (x) => { const s = Math.round(x.c.money * 0.5); if (s <= 0 || !x.spend(s)) return 'There was no "in" to go all of.'; x.setFlag('fo_crypto', s); x.mods({ riskTolerance: 5, anxiety: 5 }); x.chain('fo_cryptoChain', 0, {}); return 'Half your savings, converted into a feeling.'; } },
      { label: 'Laugh at your friend', tags: ['cautious'], run: (x) => { x.remember('cryptoSkeptic', 'Laughed at a crypto tip', 20); return 'You laughed. History may or may not laugh back.'; } },
    ],
  },
  {
    id: 'fo_cryptoReckoning', cat: 'assets', triggered: true, scene: 'stocks',
    title: 'The coin moves',
    text: () => `Your coin has done something dramatic overnight. The forums are screaming.`,
    choices: [
      { label: 'Cash out now', tags: ['cautious'], run: (x) => { const s = Number(x.flag('fo_crypto') ?? 0); x.setFlag('fo_crypto', 0); if (!s) return 'You had already lost the wallet. Story of the decade.'; if (x.chance(0.55)) { const a = x.money(Math.round(s * x.float(3, 40))); x.mods({ happiness: 12 }); return `You sold for ${x.fmt(a)} and became unbearable at parties.`; } const a = x.money(Math.round(s * 0.2)); x.mods({ happiness: -8 }); return `You salvaged ${x.fmt(a)}. The dog on the logo seemed to smirk.`; } },
      { label: 'HODL', tags: ['impulsive'], run: (x) => { const s = Number(x.flag('fo_crypto') ?? 0); x.setFlag('fo_crypto', 0); if (x.chance(0.3)) { const a = x.money(Math.round(s * x.float(20, 120))); x.mods({ happiness: 20 }); x.remember('cryptoRich', 'Got rich on crypto', 70); return `Diamond hands. ${x.fmt(a)}. You bought a ridiculous watch.`; } x.mods({ happiness: -12, stress: 8 }); return 'It went to zero. You now explain blockchains to nobody who asked.'; } },
      { label: 'Find the lost password', tags: ['ambitious'], run: (x) => { const s = Number(x.flag('fo_crypto') ?? 0); x.setFlag('fo_crypto', 0); if (x.chance(0.25)) { const a = x.money(Math.round(s * 15)); return `It was your first pet's name backwards. ${x.fmt(a)}.`; } x.mods({ stress: 10 }); return 'You tried four thousand passwords. The coins are now a sad legend.'; } },
    ],
  },
  {
    id: 'fo_shipVenture', cat: 'assets', minAge: 20, years: [-800, 1850], weight: 0.7, cooldown: 6, scene: 'smuggling',
    title: 'A share in a ship',
    text: (x) => `A merchant is selling shares in a voyage to distant ports. ${x.fmt($(x, 5000))} buys a tenth of the cargo.`,
    choices: [
      { label: 'Buy a share', tags: ['ambitious'], run: (x) => { if (!x.spend($(x, 5000))) return 'You could not afford even a rope on that ship.'; x.train('investing', 3); if (x.chance(0.5)) { const a = x.money($(x, x.int(9000, 20000))); x.mods({ happiness: 8 }); return `The ship came home low in the water with spices. Your share: ${x.fmt(a)}.`; } x.mods({ happiness: -8 }); return 'The ship was lost off a cape nobody can pronounce.'; } },
      { label: 'Ask about the captain', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 2 }); return 'The captain had sunk twice. You kept your money and your dignity.'; } },
      { label: 'Sail with it', tags: ['impulsive'], scene: 'travel', when: (x) => x.age < 40, run: (x) => { x.mods({ happiness: 6, fitness: 3 }); x.money($(x, 1500)); x.train('sailing', 6); return 'You came back tanned, scarred and slightly richer.'; } },
    ],
  },
  {
    id: 'fo_barberTip', cat: 'assets', minAge: 21, years: [1900, 2300], weight: 0.8, cooldown: 5, scene: 'stocks',
    title: 'A hot tip',
    text: () => `Your barber, mid-trim, leans in: a little company is "about to explode". Even the shoeshine boy is buying.`,
    choices: [
      { label: 'Buy shares', tags: ['impulsive'], run: (x) => { const s = $(x, 3000); if (!x.spend(s)) return 'No spare cash, so the tip stayed a tip.'; x.train('stockTrading', 2); if (x.chance(0.35)) { const a = x.money(s * 3); return `It exploded upwards. ${x.fmt(a)}. You tipped the barber generously.`; } x.mods({ happiness: -5 }); return 'It exploded, as promised, just not upwards.'; } },
      { label: 'Research it first', tags: ['cautious'], run: (x) => { x.train('investing', 3); x.mods({ smarts: 1 }); return 'The company made umbrellas for dogs. You passed.'; } },
      { label: 'Ask for a shorter cut', tags: ['social'], run: (x) => { x.mods({ looks: 1 }); return 'You left with a good haircut and no opinions about the market.'; } },
    ],
  },
  {
    id: 'fo_debtCollector', cat: 'assets', minAge: 18, weight: (x) => (x.c.debt > 0 ? 2 : 0), cooldown: 3, scene: 'taxes',
    title: 'The collector',
    text: (x) => `A debt collector ${x.year < 1900 ? 'raps at the door with a ledger' : x.year < 1990 ? 'phones every morning at seven' : 'texts, calls and emails, sometimes all at once'}. You owe ${x.fmt(x.c.debt)}.`,
    choices: [
      { label: 'Pay what you can', tags: ['cautious'], run: (x) => { const pay = Math.min(x.c.money, x.c.debt, Math.max($(x, 500), Math.round(x.c.money * 0.3))); x.spend(pay); x.c.debt -= pay; x.mods({ stress: -3 }); return `You paid ${x.fmt(pay)}. The calls got slightly politer.`; } },
      { label: 'Negotiate it down', tags: ['social'], run: (x) => { if (check(x, x.skill('negotiation') + x.stat('charisma') / 2, 50)) { x.c.debt = Math.round(x.c.debt * 0.6); x.train('negotiation', 4); return 'You settled for sixty cents on the dollar. Practically a victory parade.'; } x.mods({ stress: 4 }); return 'They had heard every sad story. Yours was not even top ten.'; } },
      { label: 'Change your name', tags: ['impulsive'], run: (x) => { x.mods({ stress: 6, anxiety: 4 }); return 'You answered the door with a fake moustache. It did not help.'; } },
    ],
  },
  {
    id: 'fo_friendLoan', cat: 'assets', minAge: 20, weight: 1, cooldown: 5, scene: 'friends',
    bind: (x) => { const r = x.rels('friend', 'bestFriend', 'sibling'); return r.length ? { npcId: x.pick(r).npcId } : null; },
    title: 'Can you spot me?',
    text: (x) => `${who(x)} needs ${x.fmt($(x, 2500))} "just until next month". ${who(x)} has said "next month" before.`,
    choices: [
      { label: 'Lend it', tags: ['help'], run: (x) => { if (!x.spend($(x, 2500))) return 'You did not have it, and said so.'; x.relMod(npcId(x), 8, 4); x.chain('fo_loanChain', 0, { npcId: npcId(x), amt: $(x, 2500) }); return `${who(x)} hugged you and swore on a grandmother.`; } },
      { label: 'Give it as a gift', tags: ['help'], when: (x) => x.c.money > $(x, 25000), run: (x) => { x.spend($(x, 2500)); x.relMod(npcId(x), 14, 8); x.mods({ karma: 4 }); return 'No strings, no awkwardness. The friendship got stronger.'; } },
      { label: 'Say no', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), -6); return `${who(x)} said "no worries" in a tone that was mostly worries.`; } },
    ],
  },
  {
    id: 'fo_loanReturn', cat: 'assets', triggered: true, scene: 'friends',
    title: 'About that loan',
    text: (x) => `It has been a while since you lent ${who(x)} ${x.fmt(Number(x.p.amt ?? 0))}.`,
    choices: [
      { label: 'Wait and see', tags: ['cautious'], run: (x) => { const amt = Number(x.p.amt ?? 0); if (x.chance(0.5)) { x.money(amt); x.relMod(npcId(x), 6, 6); return `${who(x)} paid it back with a bottle of something nice. Faith in humanity: restored.`; } x.relMod(npcId(x), -4, -10); return `${who(x)} bought a new ${x.year < 1910 ? 'horse' : 'car'}. The loan was never mentioned.`; } },
      { label: 'Ask directly', tags: ['social'], run: (x) => { const amt = Number(x.p.amt ?? 0); if (x.chance(0.6)) { x.money(amt); return `${who(x)} went red and paid you on the spot.`; } x.relMod(npcId(x), -10, -10); return `${who(x)} called you petty and stopped returning messages.`; } },
      { label: 'Forgive the debt', tags: ['help'], run: (x) => { x.mods({ karma: 5, happiness: 2 }); x.relMod(npcId(x), 8, 6); return 'You let it go. It weighed less than the resentment would have.'; } },
    ],
  },
  {
    id: 'fo_audit', cat: 'assets', minAge: 25, years: [1913, 2300], weight: (x) => (x.c.money > $(x, 50000) ? 1 : 0.2), cooldown: 6, scene: 'taxes',
    title: 'Audit notice',
    text: () => `A thick envelope from the tax office. They would like to see receipts. All of them. Since forever.`,
    choices: [
      { label: 'Hire an accountant', tags: ['cautious'], run: (x) => { const fee = $(x, 2500); x.spend(Math.min(fee, x.c.money)); x.mods({ stress: -2 }); return 'Your accountant found deductions you did not know existed. You owe nothing.'; } },
      { label: 'Do it yourself', tags: ['ambitious'], run: (x) => { x.train('accounting', 4); if (check(x, x.skill('accounting') + x.stat('smarts') / 2, 55)) return 'Shoebox by shoebox, you survived the audit.'; const fine = Math.min(x.c.money, $(x, 4000)); x.spend(fine); x.mods({ stress: 6 }); return `You misfiled one thing. It cost ${x.fmt(fine)}.`; } },
      { label: 'Hide some income', tags: ['impulsive'], run: (x) => { if (x.chance(0.5)) { x.money($(x, 3000)); x.mods({ sin: 2 }); return 'Nobody noticed. You felt clever and slightly sick.'; } openCase(x, 'taxEvasion'); x.mods({ stress: 10 }); return 'The auditor noticed. Now it is a case file.'; } },
    ],
  },
  {
    id: 'fo_taxCollector', cat: 'assets', minAge: 18, years: [-800, 1912], weight: 0.8, cooldown: 5, scene: 'taxes',
    title: 'The tax collector',
    text: (x) => `The ${x.year < 500 ? "governor's publican" : "lord's tax collector"} has arrived with a scale, a ledger and two bored soldiers.`,
    choices: [
      { label: 'Pay in full', tags: ['cautious'], run: (x) => { const t = Math.min(x.c.money, $(x, 800)); x.spend(t); return `You paid ${x.fmt(t)}. The soldiers looked almost disappointed.`; } },
      { label: 'Hide the good silver', tags: ['impulsive'], run: (x) => { if (x.chance(0.6)) { x.mods({ happiness: 3 }); return 'The silver spent the day in the well bucket. Nobody looked.'; } const t = Math.min(x.c.money, $(x, 1600)); x.spend(t); return `They found it. Double tax: ${x.fmt(t)}.`; } },
      { label: 'Bribe the collector', tags: ['ambitious'], scene: 'bribe', run: (x) => { const b = Math.min(x.c.money, $(x, 250)); x.spend(b); x.train('bribery', 3); x.mods({ corruption: 2 }); return 'Your assessment shrank wonderfully.'; } },
    ],
  },
  {
    id: 'fo_bankruptcy', cat: 'assets', minAge: 22, weight: (x) => (x.c.debt > Math.max(x.c.money * 3, $(x, 20000)) ? 2 : 0), once: true, scene: 'moneyDown',
    title: 'Underwater',
    text: (x) => `You owe ${x.fmt(x.c.debt)} and have ${x.fmt(x.c.money)}. The numbers no longer even pretend to work.`,
    choices: [
      { label: 'Declare bankruptcy', tags: ['cautious'], run: (x) => { x.c.debt = 0; x.c.money = Math.min(x.c.money, $(x, 1000)); x.mods({ happiness: -8, stress: -15, publicImage: -5 }); x.remember('bankrupt', 'Declared bankruptcy', 60); return 'The judge stamped it. The weight lifted, and so did your credit rating, off a cliff.'; } },
      { label: 'Work it off', tags: ['ambitious'], run: (x) => { x.mods({ stress: 10, discipline: 5 }); x.setFlag('fo_grinding', x.age); return 'Three jobs and no weekends. You are going to claw out of this.'; } },
      { label: 'Ask family for help', tags: ['social'], when: (x) => x.aliveParents().length > 0, scene: 'family', run: (x) => { const p = x.aliveParents()[0]; x.c.debt = Math.round(x.c.debt * 0.5); x.relMod(p.id, -3, 4); x.mods({ ego: -5 }); return `${x.first(p.id)} paid half. Thanksgiving will be awkward forever.`; } },
    ],
  },
  {
    id: 'fo_foundPurse', cat: 'assets', minAge: 8, weight: 1, cooldown: 6, scene: 'moneyUp',
    title: (x) => (x.year < 1900 ? 'A dropped purse' : 'A lost wallet'),
    text: (x) => `On the ${x.year < 1900 ? 'cobbles' : 'pavement'}: a ${x.year < 1900 ? 'purse' : 'wallet'} with ${x.fmt($(x, 300))} inside and the owner's address.`,
    choices: [
      { label: 'Return it', tags: ['help'], run: (x) => { x.mods({ karma: 5, happiness: 3 }); if (x.chance(0.3)) { x.money($(x, 100)); return 'The owner insisted on a reward and a cup of tea.'; } return 'The owner thanked you with tears. Nice.'; } },
      { label: 'Keep the cash', tags: ['impulsive'], run: (x) => { x.money($(x, 300)); x.mods({ karma: -4, sin: 2 }); return 'You kept the money and posted the empty wallet back. Half a good deed.'; } },
      { label: 'Hand it to the authorities', tags: ['cautious'], scene: 'police', run: (x) => { x.mods({ karma: 3 }); return 'The officer looked at you like you were a rare bird.'; } },
    ],
  },
  {
    id: 'fo_buriedHoard', cat: 'assets', minAge: 10, weight: 0.25, once: true, scene: 'gardening',
    title: 'Something clinks',
    text: () => `Digging in the garden, your spade hits a clay pot full of very old coins.`,
    choices: [
      { label: 'Sell them quietly', tags: ['impulsive'], run: (x) => { const a = x.money($(x, x.int(5000, 30000))); x.mods({ happiness: 10 }); return `A dealer paid ${x.fmt(a)} and asked no questions.`; } },
      { label: 'Call the experts', tags: ['cautious', 'help'], scene: 'museum', run: (x) => { const a = x.money($(x, x.int(3000, 15000))); x.mods({ fame: 4, karma: 3 }); x.story('puff', 'Ancient hoard found in garden', 25); return `The museum gave you a finder's fee of ${x.fmt(a)} and a plaque with your name spelt wrong.`; } },
      { label: 'Bury them again', tags: ['cautious'], run: (x) => { x.mods({ paranormal: 3, happiness: 2 }); return 'Someone hid them for a reason. Now you know a secret nobody else does.'; } },
    ],
  },
  {
    id: 'fo_charityBox', cat: 'assets', minAge: 14, weight: 1, cooldown: 4, scene: 'volunteer',
    title: 'Rattling tin',
    text: (x) => `A volunteer rattles a collection tin for ${x.pick(['orphans', 'flood victims', 'the hospital', 'retired donkeys'])}.`,
    choices: [
      { label: 'Give generously', tags: ['help'], run: (x) => { const g = Math.min(x.c.money, $(x, 200)); x.spend(g); x.mods({ karma: 4, happiness: 3 }); return 'A sticker for your coat and a warm feeling for your soul.'; } },
      { label: 'Drop a coin', tags: ['cautious'], run: (x) => { x.spend($(x, 2)); x.mods({ karma: 1 }); return 'Clink. Your conscience accepts the minimum payment.'; } },
      { label: 'Pretend to be on the phone', tags: ['impulsive'], run: (x) => { x.mods({ karma: -1 }); return x.year < 1900 ? 'You pretended to be deeply interested in a pigeon.' : 'You held an animated conversation with nobody.'; } },
    ],
  },
  {
    id: 'fo_partnerVanished', cat: 'assets', minAge: 25, weight: (x) => (x.rels('businessPartner').length ? 1.5 : 0.2), once: true, scene: 'moneyDown',
    bind: (x) => relOrStranger(x, ['businessPartner']),
    title: 'Gone',
    text: (x) => `${whoFull(x)}, your partner in a little venture, has vanished. So has the shared account.`,
    choices: [
      { label: 'Hire an investigator', tags: ['ambitious'], run: (x) => { if (!x.spend($(x, 3000))) return 'You could not afford to look.'; if (x.chance(0.4)) { x.money($(x, 8000)); return `They found ${who(x)} on a beach with half your money. You got the half back.`; } return 'The trail ended at a port. The sea keeps secrets.'; } },
      { label: 'Go to the police', tags: ['cautious'], scene: 'police', run: (x) => { x.mods({ stress: 4 }); x.relMod(npcId(x), -40, -60); return 'They filed a report. They also filed it under "unlikely".'; } },
      { label: 'Write it off', tags: ['cautious'], run: (x) => { x.mods({ happiness: -6, wisdom: 4, romanticCynicism: 3 }); x.money(-Math.min(x.c.money, $(x, 4000))); return 'Expensive lesson. You frame the empty bank statement.'; } },
    ],
  },
  {
    id: 'fo_pyramid', cat: 'assets', minAge: 20, years: [1920, 2300], weight: 0.8, cooldown: 8, scene: 'meeting',
    bind: (x) => relOrStranger(x, ['friend', 'acquaintance', 'colleague']),
    title: 'An opportunity',
    text: (x) => `${who(x)} wants to tell you about an "exciting business opportunity" involving ${x.year < 1980 ? 'cosmetics door to door' : 'essential oils and your entire contact list'}.`,
    choices: [
      { label: 'Buy the starter kit', tags: ['impulsive'], run: (x) => { if (!x.spend($(x, 1500))) return 'Too broke to be fleeced.'; x.mods({ happiness: -4 }); x.relMod(npcId(x), 3); return 'You now own a garage full of product and no friends who will answer the phone.'; } },
      { label: 'Recruit people under you', tags: ['ambitious'], run: (x) => { x.train('sales', 4); if (x.chance(0.25)) { x.money($(x, 6000)); x.mods({ karma: -4 }); return 'You made money. Your recruits did not. You try not to think about it.'; } x.mods({ popularity: -5 }); return 'Your cousins muted you.'; } },
      { label: 'Politely decline', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), -2); return `${who(x)} called you "not a visionary". You can live with that.`; } },
    ],
  },
  {
    id: 'fo_bankRun', cat: 'assets', minAge: 20, years: [1800, 2300], weight: (x) => (x.w.economy < 40 ? 1.5 : 0.2), cooldown: 10, scene: 'riot',
    title: 'Run on the bank',
    text: () => `A queue snakes around the bank. Rumour says it is about to fail.`,
    choices: [
      { label: 'Join the queue', tags: ['cautious'], run: (x) => { if (x.chance(0.6)) { x.mods({ stress: 4 }); return 'Six hours later you held your savings in a paper bag, sweating.'; } const loss = Math.round(x.c.money * 0.3); x.c.money -= loss; x.mods({ happiness: -10 }); return `The doors shut before you reached them. ${x.fmt(loss)} gone.`; } },
      { label: 'Trust the bank', tags: ['impulsive'], run: (x) => { if (x.chance(0.5)) return 'The bank survived. You felt like the only adult in town.'; const loss = Math.round(x.c.money * 0.5); x.c.money -= loss; x.mods({ happiness: -14 }); trauma(x, 6, 'ruin'); return `It failed. Half your savings, ${x.fmt(loss)}, simply evaporated.`; } },
      { label: 'Sell coffee to the queue', tags: ['ambitious'], run: (x) => { const a = x.money($(x, 200)); x.train('entrepreneurship', 3); return `Panic is thirsty work. You made ${x.fmt(a)}.`; } },
    ],
  },
  {
    id: 'fo_bigTip', cat: 'assets', minAge: 16, weight: (x) => (x.employed ? 0.8 : 0), cooldown: 5, scene: 'moneyUp',
    title: 'Generous stranger',
    text: (x) => `An eccentric customer leaves you a tip of ${x.fmt($(x, 1000))} and a note: "Do something silly with it."`,
    choices: [
      { label: 'Do something silly', tags: ['impulsive'], scene: 'party', run: (x) => { x.money($(x, 1000)); x.spend($(x, 1000)); x.mods({ happiness: 10 }); return 'You hired a brass band for a Tuesday. Worth every coin.'; } },
      { label: 'Save it', tags: ['cautious'], run: (x) => { x.money($(x, 1000)); x.mods({ discipline: 2 }); return 'Into savings. The note went on the fridge.'; } },
      { label: 'Pass it on', tags: ['help'], run: (x) => { x.mods({ karma: 6, happiness: 5 }); return 'You tipped a waitress the whole lot. She screamed in the car park.'; } },
    ],
  },
  {
    id: 'fo_atticPainting', cat: 'assets', minAge: 18, weight: 0.3, once: true, scene: 'painting',
    title: 'Ugly painting',
    text: () => `In the attic: a dusty, ugly painting of a sad horse. There is a faint signature in the corner.`,
    choices: [
      { label: 'Get it appraised', tags: ['cautious'], scene: 'museum', run: (x) => { if (x.chance(0.2)) { const a = x.money($(x, x.int(80000, 400000))); x.mods({ happiness: 15 }); x.story('puff', 'Attic horse is lost masterpiece', 30); return `A lost masterpiece. ${x.fmt(a)} at auction. The horse looks less sad now.`; } return 'The appraiser said it was "a painting". You thanked him for his expertise.'; } },
      { label: 'Hang it up', tags: ['social'], run: (x) => { x.mods({ happiness: 3 }); return 'Guests stare at it. It stares back.'; } },
      { label: 'Burn it', tags: ['impulsive'], scene: 'fire', run: (x) => { x.mods({ paranormal: 2 }); return 'It burned with a faint neigh. You did not sleep well.'; } },
    ],
  },
  {
    id: 'fo_loanShark', cat: 'assets', minAge: 18, weight: (x) => (x.c.money < $(x, 500) ? 1.2 : 0), cooldown: 8, scene: 'gangMeeting',
    title: 'Easy money',
    text: (x) => `A friendly man with a gold tooth offers ${x.fmt($(x, 5000))}, no paperwork. "Pay me back whenever. Ish."`,
    choices: [
      { label: 'Take it', tags: ['impulsive'], run: (x) => { x.money($(x, 5000)); x.setFlag('fo_shark', $(x, 9000)); x.chain('fo_sharkChain', 0, {}); x.mods({ stress: 4 }); return 'The money felt light. The handshake felt heavy.'; } },
      { label: 'Walk away', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 2 }); return 'He smiled and said he would be around. They always are.'; } },
    ],
  },
  {
    id: 'fo_sharkCollects', cat: 'crime', triggered: true, scene: 'gangMeeting',
    title: 'Whenever-ish',
    text: (x) => `The gold-tooth man is back, with a larger friend. The loan has grown to ${x.fmt(Number(x.flag('fo_shark') ?? 0))}.`,
    choices: [
      { label: 'Pay it all', tags: ['cautious'], when: (x) => x.c.money >= Number(x.flag('fo_shark') ?? 0), run: (x) => { x.spend(Number(x.flag('fo_shark') ?? 0)); x.setFlag('fo_shark', 0); x.mods({ stress: -8 }); return 'Paid. The large friend looked almost disappointed.'; } },
      { label: 'Beg for time', tags: ['cautious'], run: (x) => { if (!Number(x.flag('fo_shark') ?? 0)) return 'You owe nothing. They nod and leave.'; x.setFlag('fo_shark', Math.round(Number(x.flag('fo_shark')) * 1.4)); x.mods({ stress: 10, fear: 8 }); return 'They gave you time. Time, it turns out, has interest.'; } },
      { label: 'Fight them', tags: ['violent'], scene: 'fight', run: (x) => { if (check(x, x.stat('fitness') + x.skill('streetFighting'), 85)) { x.mods({ streetCred: 6 }); x.setFlag('fo_shark', 0); return 'You won, somehow. They decided you were more trouble than you were worth.'; } x.log(injure(x, true), 'bad'); x.mods({ fear: 10 }); return 'You lost. They took your watch as "a deposit".'; } },
    ],
  },
  {
    id: 'fo_sharkFinal', cat: 'crime', triggered: true, scene: 'gangMeeting',
    title: 'Last call',
    text: (x) => (Number(x.flag('fo_shark') ?? 0) > 0 ? `A note under the door: "${x.fmt(Number(x.flag('fo_shark')))}. Friday."` : 'The gold-tooth man nods at you in the street, all friendly. You are square.'),
    choices: [
      { label: 'Pay up', tags: ['cautious'], run: (x) => { const owe = Number(x.flag('fo_shark') ?? 0); if (!owe) return 'Nothing to pay. You buy yourself a celebratory pastry.'; const p = Math.min(owe, x.c.money); x.spend(p); x.setFlag('fo_shark', 0); if (p < owe) { x.c.debt += owe - p; return 'You paid what you had. The rest became a debt with very firm reminders.'; } return 'Paid in full. You never borrow from a smile again.'; } },
      { label: 'Skip town', tags: ['impulsive'], scene: 'moving', run: (x) => { x.setFlag('fo_shark', 0); x.mods({ stress: 6, anxiety: 6 }); return 'You moved across the country. You still check every gold tooth.'; } },
    ],
  },
  {
    id: 'fo_counterfeitNote', cat: 'assets', minAge: 14, years: [1600, 2300], weight: 0.6, cooldown: 6, scene: 'moneyDown',
    title: 'Funny money',
    text: (x) => `The ${x.year < 1900 ? 'coin' : 'banknote'} in your change feels wrong. The king's face is cross-eyed.`,
    choices: [
      { label: 'Pass it on', tags: ['impulsive'], run: (x) => { if (x.chance(0.8)) { x.mods({ karma: -2 }); return 'You bought bread with it. The baker will pass it on too. Circle of life.'; } openCase(x, 'counterfeiting', { mult: 0.3 }); return 'The shopkeeper called the constable. Awkward.'; } },
      { label: 'Report it', tags: ['help', 'cautious'], scene: 'police', run: (x) => { x.mods({ karma: 2 }); return 'You lost the money and gained a small speech about vigilance.'; } },
      { label: 'Frame it', tags: ['social'], run: (x) => { x.mods({ happiness: 2 }); return 'The cross-eyed king now hangs above your desk.'; } },
    ],
  },
  {
    id: 'fo_benefactor', cat: 'assets', minAge: 16, maxAge: 24, weight: (x) => (x.stat('smarts') > 60 ? 0.6 : 0.15), once: true, scene: 'graduation',
    title: 'Anonymous benefactor',
    text: () => `A letter with no return address: someone wishes to pay for your education. They sign it only "a friend of your grandmother".`,
    choices: [
      { label: 'Accept gratefully', tags: ['cautious'], run: (x) => { x.money($(x, 20000)); x.mods({ happiness: 8 }); x.remember('benefactor', 'An anonymous benefactor paid for school', 50); return 'The money arrived each term like clockwork. You never found out who.'; } },
      { label: 'Try to find them', tags: ['ambitious'], run: (x) => { x.money($(x, 20000)); x.mods({ happiness: 4, paranoia: 2 }); return 'Every clue led to a grandmother who died before you were born. Hm.'; } },
      { label: 'Refuse it', tags: ['impulsive'], run: (x) => { x.mods({ ego: 4, discipline: 3 }); return 'You wanted to do it yourself. Admirable. Expensive.'; } },
    ],
  },
  {
    id: 'fo_goldRush', cat: 'assets', minAge: 18, maxAge: 50, years: [1848, 1900], weight: 0.8, once: true, scene: 'travel',
    title: 'Gold fever',
    text: () => `Gold has been found out west. Half the town has already left with a pan and a dream.`,
    choices: [
      { label: 'Go prospecting', tags: ['impulsive', 'ambitious'], scene: 'roadTrip', run: (x) => { x.train('mining', 8); x.mods({ fitness: 4, health: -3 }); if (x.chance(0.15)) { const a = x.money($(x, x.int(40000, 150000))); x.remember('goldRush', 'Struck gold', 70); return `You struck a vein. ${x.fmt(a)} and a beard you will never fully lose.`; } return 'You found mud, blisters and one shiny rock that was not gold.'; } },
      { label: 'Sell shovels', tags: ['ambitious'], run: (x) => { const a = x.money($(x, x.int(5000, 20000))); x.train('entrepreneurship', 5); return `Gold is uncertain. Shovels are not. ${x.fmt(a)}.`; } },
      { label: 'Stay home', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 2 }); return 'The town was quiet and the rent went down. Not bad.'; } },
    ],
  },
  {
    id: 'fo_tulipMania', cat: 'assets', minAge: 18, years: [1630, 1640], weight: 2, once: true, scene: 'gardening',
    title: 'Tulip fever',
    text: () => `A single tulip bulb is selling for the price of a house. Everyone is certain prices will only go up.`,
    choices: [
      { label: 'Buy bulbs', tags: ['impulsive'], run: (x) => { const s = Math.round(x.c.money * 0.4); x.spend(s); if (x.chance(0.3)) { x.money(s * 3); return 'You sold just before the crash and nobody believed your timing.'; } x.mods({ happiness: -10 }); return 'The market collapsed. You own the most expensive onions in history.'; } },
      { label: 'Grow your own', tags: ['ambitious'], run: (x) => { x.train('farming', 4); x.money($(x, 1200)); return 'Your striped tulips paid for a winter coat.'; } },
      { label: 'Call it madness', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 4 }); return 'You were right, and insufferable about it for decades.'; } },
    ],
  },
  {
    id: 'fo_bubbleShares', cat: 'assets', minAge: 18, weight: (x) => ((x.year >= 1718 && x.year <= 1721) || (x.year >= 1926 && x.year <= 1929) || (x.year >= 1997 && x.year <= 2000) || (x.year >= 2005 && x.year <= 2007) ? 2 : 0), cooldown: 10, scene: 'stocks',
    title: 'Everyone is getting rich',
    text: (x) => `${x.year < 1800 ? 'Shares in a trading company to the South Seas' : x.year < 1950 ? 'Stocks bought on margin' : x.year < 2003 ? 'Shares in websites with no profits' : 'Houses flipped twice in a year'} are making your neighbours rich on paper.`,
    choices: [
      { label: 'Get in', tags: ['impulsive'], run: (x) => { const s = Math.round(x.c.money * 0.5); x.spend(s); x.setFlag('fo_bubble', s); x.mods({ riskTolerance: 4 }); x.queue('fo_bubblePops', {}); return 'You are now, on paper, a genius.'; } },
      { label: 'A small flutter', tags: ['cautious'], run: (x) => { const a = x.money($(x, x.int(-1500, 3000))); return a >= 0 ? `You made ${x.fmt(a)} and got out early.` : `You lost ${x.fmt(-a)}. A cheap lesson.`; } },
      { label: 'Stay out', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 3 }); return 'You missed the party. You also missed the hangover.'; } },
    ],
  },
  {
    id: 'fo_bubblePops', cat: 'assets', triggered: true, scene: 'moneyDown',
    title: 'The bubble pops',
    text: () => `Overnight, the thing everyone was certain about becomes the thing nobody admits buying.`,
    choices: [
      { label: 'Sell in panic', tags: ['impulsive'], run: (x) => { const s = Number(x.flag('fo_bubble') ?? 0); x.setFlag('fo_bubble', 0); const a = x.money(Math.round(s * 0.25)); x.mods({ happiness: -10 }); trauma(x, 5, 'ruin'); return `You salvaged ${x.fmt(a)}. The rest became a story you tell as a warning.`; } },
      { label: 'Hold and pray', tags: ['cautious'], run: (x) => { const s = Number(x.flag('fo_bubble') ?? 0); x.setFlag('fo_bubble', 0); if (x.chance(0.35)) { const a = x.money(Math.round(s * 1.2)); return `Years later it recovered. ${x.fmt(a)}, and grey hair.`; } x.mods({ happiness: -12, faith: 2 }); return 'Prayer did not cover margin calls.'; } },
    ],
  },
  {
    id: 'fo_crowdfund', cat: 'assets', minAge: 18, years: [2009, 2300], weight: 0.7, cooldown: 6, scene: 'startup',
    title: 'Back this project',
    text: () => `A crowdfunding page for a self-stirring mug promises backers "lifetime glory and a mug".`,
    choices: [
      { label: 'Back it big', tags: ['impulsive'], run: (x) => { if (!x.spend($(x, 500))) return 'Not this month.'; if (x.chance(0.3)) { x.mods({ happiness: 6 }); return 'Two years late, the mug arrived. It stirs. Glory achieved.'; } return 'The founders posted an apology video from a beach.'; } },
      { label: 'Back it small', tags: ['cautious'], run: (x) => { x.spend($(x, 25)); return 'You got a thank-you email and a lingering sense of hope.'; } },
      { label: 'Make your own', tags: ['ambitious'], run: (x) => { x.train('entrepreneurship', 4); x.train('marketing', 3); if (x.chance(0.2)) { const a = x.money($(x, 20000)); return `Your self-buttering toast campaign raised ${x.fmt(a)}.`; } return 'Your campaign raised enough for one prototype and a lot of feelings.'; } },
    ],
  },
  {
    id: 'fo_pickpocketed', cat: 'crime', minAge: 12, weight: 0.8, cooldown: 4, scene: 'crime',
    title: 'Lighter pockets',
    text: () => `In the crowd someone bumps you, apologises charmingly, and disappears. So does your money.`,
    choices: [
      { label: 'Chase them', tags: ['impulsive'], scene: 'carChase', run: (x) => { if (check(x, x.stat('fitness'), 55)) { x.mods({ confidence: 4 }); return 'You caught them by the collar. They returned it with a bow.'; } const l = Math.min(x.c.money, $(x, 200)); x.spend(l); return `They were faster. ${x.fmt(l)} gone.`; } },
      { label: 'Shout "thief!"', tags: ['social'], run: (x) => { const l = Math.min(x.c.money, $(x, 200)); if (x.chance(0.4)) return 'The crowd tackled them. Civic spirit lives.'; x.spend(l); return 'Everyone checked their own pockets instead.'; } },
      { label: 'Let it go', tags: ['cautious'], run: (x) => { const l = Math.min(x.c.money, $(x, 200)); x.spend(l); x.mods({ paranoia: 2 }); return 'You now walk with one hand on your pocket like a nervous magician.'; } },
    ],
  },
  {
    id: 'fo_luckyPenny', cat: 'assets', minAge: 6, weight: 0.6, cooldown: 8, scene: 'moneyUp',
    title: 'Heads up',
    text: () => `A shiny coin, heads up, glinting on the ground in front of you.`,
    choices: [
      { label: 'Pick it up', tags: ['impulsive'], run: (x) => { x.money($(x, 1)); x.mods({ happiness: 2 }); if (x.chance(0.15)) addBlessing(x, 'fortune', 1, 'a lucky coin'); return 'All day long you had good luck. Or at least you noticed it more.'; } },
      { label: 'Leave it for a child', tags: ['help'], run: (x) => { x.mods({ karma: 1 }); return 'A child found it and yelled like they had found a dragon egg.'; } },
    ],
  },
  {
    id: 'fo_pawnshop', cat: 'assets', minAge: 18, years: [1300, 2300], weight: (x) => (x.c.money < $(x, 1000) ? 0.8 : 0.1), cooldown: 5, scene: 'jewelry',
    title: 'The pawnbroker',
    text: () => `Rent is due. The pawnbroker eyes your grandmother's watch with professional disinterest.`,
    choices: [
      { label: 'Pawn it', tags: ['cautious'], run: (x) => { const a = x.money($(x, 400)); x.mods({ happiness: -3 }); return `${x.fmt(a)}. You promise the watch you will come back.`; } },
      { label: 'Haggle hard', tags: ['ambitious'], run: (x) => { const a = x.money($(x, check(x, x.skill('negotiation') + x.stat('charisma') / 2, 50) ? 700 : 300)); x.train('negotiation', 3); return `You walked out with ${x.fmt(a)} and his grudging respect.`; } },
      { label: 'Keep it', tags: ['cautious'], run: (x) => { x.mods({ stress: 4, happiness: 2 }); return 'Some things are worth more than rent. Your landlord disagrees.'; } },
    ],
  },
  {
    id: 'fo_insuranceTemptation', cat: 'crime', minAge: 20, years: [1900, 2300], weight: 0.6, cooldown: 8, scene: 'car',
    title: 'Small dent, big claim',
    text: () => `Someone bumped your car in the car park. A tiny dent. Your neighbour says you could claim "neck pain" for a fortune.`,
    choices: [
      { label: 'Claim the dent', tags: ['cautious'], run: (x) => { x.money($(x, 300)); return 'Fixed for free. Honest and boring.'; } },
      { label: 'Claim the neck', tags: ['impulsive'], run: (x) => { if (x.chance(0.6)) { x.money($(x, 9000)); x.mods({ sin: 3, karma: -4 }); return 'You wore a neck brace for months, including to the beach.'; } openCase(x, 'fraud', { mult: 0.5 }); return 'An investigator photographed you doing cartwheels.'; } },
      { label: 'Let it go', tags: ['help'], run: (x) => { x.mods({ karma: 2 }); return 'It is a dent. Life is full of dents.'; } },
    ],
  },
];

// ==================================================================== FAME
const celeb = (w: number) => (x: Ctx): number => (x.stat('fame') >= 30 ? w : 0);
const known = (w: number) => (x: Ctx): number => (x.stat('fame') >= 12 ? w : 0);

const FAME: EventDef[] = [
  {
    id: 'fo_paparazzi', cat: 'media', minAge: 16, years: [1900, 2300], weight: celeb(1.5), cooldown: 3, scene: 'fame',
    title: 'Flashbulbs',
    text: (x) => `A photographer leaps out from behind a ${x.year < 1960 ? 'lamppost' : 'parked van'} as you leave ${x.pick(['the pharmacy', 'a cheap diner', 'the dentist', 'a pet shop'])}.`,
    choices: [
      { label: 'Smile and wave', tags: ['social'], run: (x) => { x.mods({ publicImage: 3, fame: 1 }); return 'The photo ran with the caption "Down to earth!" You were buying foot cream.'; } },
      { label: 'Hide your face', tags: ['cautious'], run: (x) => { x.mods({ stress: 3 }); x.story('gossip', 'Star hides from cameras: what are they hiding?', -5); return 'The headline asked what you were hiding. Foot cream. You were hiding foot cream.'; } },
      { label: 'Grab the camera', tags: ['violent', 'impulsive'], scene: 'fight', run: (x) => { x.mods({ publicImage: -8, aggression: 3 }); x.story('scandal', 'Star attacks photographer!', -20); if (x.chance(0.4)) openCase(x, 'assault', { mult: 0.4 }); return 'You smashed the camera. The other six cameras got lovely shots of you smashing it.'; } },
    ],
  },
  {
    id: 'fo_fanMail', cat: 'media', minAge: 12, weight: known(1.2), cooldown: 3, scene: 'loveLetter',
    title: 'Fan mail',
    text: (x) => (x.year < 2000 ? `A sack of letters arrives. One contains a drawing of you as a heroic badger.` : `Your messages are full of fans. One has made a video edit of you set to dramatic music.`),
    choices: [
      { label: 'Answer every one', tags: ['help', 'social'], run: (x) => { x.mods({ popularity: 4, publicImage: 3, energy: -6 }); return 'Your hand cramped, but somewhere a teenager framed your reply.'; } },
      { label: 'Hire someone to answer', tags: ['cautious'], run: (x) => { x.spend($(x, 300)); x.mods({ publicImage: 1 }); return 'Your assistant signs your name better than you do.'; } },
      { label: 'Keep the badger drawing', tags: ['social'], run: (x) => { x.mods({ happiness: 5 }); return 'It hangs in your hallway. Guests ask. You answer proudly.'; } },
    ],
  },
  {
    id: 'fo_stalker', cat: 'media', minAge: 18, weight: celeb(0.7), cooldown: 8, scene: 'jealousy',
    bind: (x) => stranger(x, { age: x.int(20, 55) }),
    title: 'Too devoted',
    text: (x) => `The same face keeps appearing: outside your home, at your shows, in the back of photos. ${who(x)} sends you letters about "our future".`,
    choices: [
      { label: 'Get a restraining order', tags: ['cautious'], scene: 'court', run: (x) => { x.spend(Math.min(x.c.money, $(x, 2000))); x.mods({ anxiety: 4, stress: -4 }); return 'The court granted it. You still check the windows, but less.'; } },
      { label: 'Hire security', tags: ['cautious'], when: (x) => x.c.money > $(x, 30000), run: (x) => { x.spend($(x, 15000)); x.mods({ anxiety: -4 }); return 'A large calm person now follows you everywhere. It is oddly soothing.'; } },
      { label: 'Speak to them kindly', tags: ['help'], run: (x) => { if (x.chance(0.5)) { x.mods({ empathy: 4 }); return `${who(x)} cried, apologised and got help. The letters stopped.`; } x.mods({ anxiety: 10, paranoia: 6 }); return 'They took it as a sign. The letters doubled.'; } },
    ],
  },
  {
    id: 'fo_endorsement', cat: 'media', minAge: 18, years: [1880, 2300], weight: celeb(1.2), cooldown: 4, scene: 'fame',
    title: 'Endorsement deal',
    text: (x) => `A company will pay ${x.fmt($(x, 250000))} for your face on their ${x.pick(x.year < 1950 ? ['tonic', 'cigarettes', 'hair pomade', 'corn flakes'] : ['energy drink', 'diet tea', 'sports car', 'luxury watch', 'mattress'])}.`,
    choices: [
      { label: 'Sign the deal', tags: ['ambitious'], scene: 'moneyUp', run: (x) => { const a = x.money($(x, 250000)); x.mods({ fame: 3, publicImage: -1 }); return `${x.fmt(a)} to smile at a product you have never tried. Showbusiness.`; } },
      { label: 'Test the product first', tags: ['cautious'], run: (x) => { if (x.chance(0.3)) { x.mods({ publicImage: 5, wisdom: 2 }); return 'It was terrible. You declined, and later it was recalled. Bullet dodged.'; } x.money($(x, 250000)); return 'It was actually fine. You signed with a clear conscience.'; } },
      { label: 'Demand double', tags: ['ambitious'], run: (x) => { if (check(x, x.skill('negotiation') + x.stat('fame') / 2, 60)) { const a = x.money($(x, 500000)); return `They blinked first. ${x.fmt(a)}.`; } x.mods({ ego: -3 }); return 'They hired someone cheaper with better teeth.'; } },
    ],
  },
  {
    id: 'fo_crierNews', cat: 'media', minAge: 10, years: [-800, 1449], weight: 0.5, cooldown: 10, scene: 'newsroom',
    title: 'Heard in the square',
    text: () => `The town crier rings his bell and announces, to your horror, the story of you being chased through the market by a goose.`,
    choices: [
      { label: 'Take a bow', tags: ['social'], scene: 'stage', run: (x) => { x.mods({ fame: 3, popularity: 5, happiness: 3 }); return 'The crowd cheered. For a week you were "the Goose One". It could be worse.'; } },
      { label: 'Correct the record', tags: ['ambitious'], run: (x) => { x.train('publicSpeaking', 3); x.mods({ fame: 2 }); return 'You explained it was a swan. Everyone agreed this was funnier.'; } },
      { label: 'Hide indoors', tags: ['cautious'], run: (x) => { x.mods({ confidence: -3 }); return 'You stayed in until a scandal about a miller replaced you.'; } },
    ],
  },
  {
    id: 'fo_ballad', cat: 'media', minAge: 16, years: [1450, 1800], weight: known(1), cooldown: 8, scene: 'serenade',
    title: 'A ballad about you',
    text: () => `A broadsheet ballad about you is being sung in every tavern. The rhymes are awful and the facts are worse.`,
    choices: [
      { label: 'Sing along', tags: ['social'], scene: 'bar', run: (x) => { x.mods({ fame: 4, popularity: 4 }); return 'You joined in on the chorus and became a legend for a night.'; } },
      { label: 'Pay for a better verse', tags: ['ambitious'], run: (x) => { x.spend($(x, 100)); x.mods({ publicImage: 5 }); return 'The new verse rhymes "valiant" with "battalion". Close enough.'; } },
      { label: 'Ban it', tags: ['impulsive'], run: (x) => { x.mods({ fame: 6, publicImage: -4 }); return 'Nothing makes a song more popular than trying to ban it.'; } },
    ],
  },
  {
    id: 'fo_paperPhoto', cat: 'media', minAge: 10, years: [1880, 1960], weight: 0.6, cooldown: 10, scene: 'newsroom',
    title: 'In the paper',
    text: () => `The local newspaper prints your photograph on page three. You are in the background of a story about a prize marrow, mid-sneeze.`,
    choices: [
      { label: 'Buy ten copies', tags: ['social'], run: (x) => { x.spend($(x, 5)); x.mods({ happiness: 4, fame: 1 }); return 'Your mother framed it. Your sneeze is now heritage.'; } },
      { label: 'Write to the editor', tags: ['ambitious'], run: (x) => { x.train('writing', 3); x.mods({ fame: 2 }); return 'Your stern letter was printed and became more famous than the marrow.'; } },
    ],
  },
  {
    id: 'fo_radioContest', cat: 'media', minAge: 12, years: [1925, 1995], weight: 0.6, cooldown: 8, scene: 'gadget',
    title: 'Caller number nine',
    text: () => `The radio announces a prize for the ninth caller who can name the song. You know the song.`,
    choices: [
      { label: 'Dash to the telephone', tags: ['impulsive'], run: (x) => { if (x.chance(0.3)) { x.money($(x, 1000)); x.mods({ happiness: 8, fame: 2 }); return 'You were caller nine! You screamed live on air and won a toaster and cash.'; } return 'Caller eight. The universe is cruel.'; } },
      { label: 'Let someone else win', tags: ['cautious'], run: (x) => { x.mods({ happiness: 1 }); return 'You hummed along instead. A pleasant, prizeless afternoon.'; } },
    ],
  },
  {
    id: 'fo_tvBackground', cat: 'media', minAge: 8, years: [1955, 2010], weight: 0.5, cooldown: 10, scene: 'newsroom',
    title: 'On television',
    text: () => `A TV crew is filming in the street. The reporter is doing a serious piece about potholes.`,
    choices: [
      { label: 'Wave behind the reporter', tags: ['impulsive'], run: (x) => { x.mods({ fame: 2, happiness: 4 }); return 'You were on the six o\'clock news, waving like a maniac behind a pothole.'; } },
      { label: 'Give an interview', tags: ['social'], run: (x) => { x.train('publicSpeaking', 2); x.mods({ fame: 3 }); return 'Your passionate pothole speech was replayed on a blooper show.'; } },
      { label: 'Walk on by', tags: ['cautious'], run: () => 'You remained a private citizen. Restful.' },
    ],
  },
  {
    id: 'fo_viralVideo', cat: 'media', minAge: 13, years: [2006, 2300], weight: 0.6, cooldown: 8, scene: 'internet',
    title: 'You went viral',
    text: (x) => `A video of you ${x.pick(['dancing badly at a wedding', 'arguing with a seagull', 'falling into a fountain with total dignity', 'singing in a car'])} has millions of views.`,
    choices: [
      { label: 'Lean in', tags: ['ambitious', 'social'], scene: 'fame', run: (x) => { x.mods({ fame: 10, popularity: 6 }); x.train('socialMediaManipulation', 3); if (x.chance(0.4)) x.money($(x, 5000)); return 'You made a follow-up. Brands called. Your grandmother is confused but proud.'; } },
      { label: 'Ask for it to be removed', tags: ['cautious'], run: (x) => { x.mods({ fame: 4, anxiety: 4 }); return 'Removing it made it more viral. The internet has rules.'; } },
      { label: 'Log off for a month', tags: ['cautious'], scene: 'calm', run: (x) => { x.mods({ stress: -6, fame: 2 }); return 'When you returned, everyone had moved on to a man and his cursed parrot.'; } },
    ],
  },
  {
    id: 'fo_meme', cat: 'media', minAge: 16, years: [2010, 2300], weight: 0.4, once: true, scene: 'internet',
    title: 'You are a meme',
    text: () => `A photo of your face reacting to something has become a meme. It means "mild disappointment" in nine languages.`,
    choices: [
      { label: 'License your face', tags: ['ambitious'], scene: 'moneyUp', run: (x) => { const a = x.money($(x, 15000)); x.mods({ fame: 6 }); return `Your disappointment earned ${x.fmt(a)}. Ironically delightful.`; } },
      { label: 'Embrace it', tags: ['social'], run: (x) => { x.mods({ happiness: 5, fame: 5 }); return 'You did the face at parties on request. You were a big hit.'; } },
      { label: 'Grow a disguise beard', tags: ['cautious'], run: (x) => { x.mods({ fame: 2, looks: -1 }); return 'Strangers still recognise the eyebrows.'; } },
    ],
  },
  {
    id: 'fo_talkShow', cat: 'media', minAge: 18, years: [1950, 2300], weight: celeb(1.1), cooldown: 4, scene: 'stage',
    title: 'Late-night couch',
    text: () => `A late-night talk show wants you on the couch. The host is famous for asking awkward questions.`,
    choices: [
      { label: 'Tell a wild story', tags: ['social', 'impulsive'], run: (x) => { if (check(x, x.stat('charisma') + x.skill('comedy'), 60)) { x.mods({ fame: 6, popularity: 6 }); return 'The audience howled. The clip trended for days.'; } x.mods({ publicImage: -4 }); x.story('gossip', 'Awkward interview has fans cringing', -8); return 'The story went nowhere. The silence was broadcast nationally.'; } },
      { label: 'Plug your project', tags: ['ambitious'], run: (x) => { x.mods({ fame: 3, professionalRep: 3 }); return 'Professional and polished. Nobody remembers it, but sales rose.'; } },
      { label: 'Decline', tags: ['cautious'], run: (x) => { x.mods({ stress: -2 }); return 'You stayed home in slippers. A worthy choice.'; } },
    ],
  },
  {
    id: 'fo_awardNom', cat: 'media', minAge: 18, weight: celeb(0.8), cooldown: 5, scene: 'fame',
    title: 'Nominated',
    text: () => `You have been nominated for a big award. The ceremony is next year and the campaign starts now.`,
    choices: [
      { label: 'Campaign hard', tags: ['ambitious'], run: (x) => { x.spend(Math.min(x.c.money, $(x, 20000))); x.setFlag('fo_awardOdds', 0.55); x.chain('fo_awardChain', 0, {}); return 'Lunches, handshakes and a suspicious amount of flattery.'; } },
      { label: 'Stay humble', tags: ['cautious'], run: (x) => { x.setFlag('fo_awardOdds', 0.35); x.mods({ publicImage: 3 }); x.chain('fo_awardChain', 0, {}); return '"It is an honour just to be nominated." You almost mean it.'; } },
      { label: 'Boycott the awards', tags: ['impulsive'], run: (x) => { x.mods({ fame: 4, professionalRep: -4, ego: 3 }); x.story('profile', 'Nominee boycotts awards in protest', 5); return 'Your boycott letter made more news than the winner.'; } },
    ],
  },
  {
    id: 'fo_awardNight', cat: 'media', triggered: true, scene: 'fame',
    title: 'And the winner is...',
    text: () => `The envelope is opening. The camera is pointed at your face, waiting for a reaction either way.`,
    choices: [
      { label: 'Prepare a speech', tags: ['ambitious'], run: (x) => { if (x.chance(Number(x.flag('fo_awardOdds') ?? 0.4))) { x.mods({ fame: 10, professionalRep: 8, happiness: 12 }); x.remember('awardWin', 'Won a major award', 75); x.story('puff', 'A deserved win', 25); return 'You won! Your speech thanked everyone and also, somehow, a cat.'; } x.mods({ happiness: -5, ego: -4 }); return 'You lost, and the camera caught your face doing complicated maths.'; } },
      { label: 'Expect to lose', tags: ['cautious'], run: (x) => { if (x.chance(Number(x.flag('fo_awardOdds') ?? 0.4))) { x.mods({ fame: 10, happiness: 15 }); x.remember('awardWin', 'Won a major award', 75); return 'You won with no speech. Your stunned "oh no" became iconic.'; } x.mods({ happiness: -1 }); return 'You lost gracefully and enjoyed the free dessert.'; } },
    ],
  },
  {
    id: 'fo_tabloidRumour', cat: 'media', minAge: 18, years: [1800, 2300], weight: celeb(1.2), cooldown: 3, scene: 'scandal',
    title: 'Rumour has it',
    text: (x) => `A tabloid claims you are secretly ${x.pick(['a robot', 'twins', 'broke', 'royalty in hiding', 'feuding with your own mother', 'afraid of spoons'])}.`,
    choices: [
      { label: 'Deny it loudly', tags: ['impulsive'], run: (x) => { x.mods({ fame: 2 }); x.story('gossip', 'Star denies bizarre rumour', -3); return 'Your denial convinced everyone it was true.'; } },
      { label: 'Ignore it', tags: ['cautious'], run: (x) => { x.mods({ stress: 2 }); return 'It faded in a week. Rumours are mayflies.'; } },
      { label: 'Sue for libel', tags: ['ambitious'], scene: 'court', run: (x) => { if (!x.spend($(x, 10000))) return 'Lawyers cost money. You let it go.'; if (x.chance(0.5)) { const a = x.money($(x, 60000)); x.mods({ publicImage: 4 }); return `You won ${x.fmt(a)} and a printed apology in tiny letters.`; } return 'The judge found the rumour "plausibly satirical". You lost.'; } },
    ],
  },
  {
    id: 'fo_celebFeud', cat: 'media', minAge: 18, weight: celeb(0.9), cooldown: 6, scene: 'argument',
    bind: (x) => stranger(x, { age: x.age + x.int(-10, 10) < 18 ? 25 : x.age + x.int(-10, 10), fame: 60 }),
    title: 'Celebrity feud',
    text: (x) => `${whoFull(x)}, also famous, mocked you in an interview. Everyone is waiting for your response.`,
    choices: [
      { label: 'Fire back', tags: ['impulsive'], run: (x) => { x.addRel(npcId(x), 'rival', { affinity: -30 }); x.mods({ fame: 6, publicImage: -3 }); return `The feud sold ${x.year < 1950 ? 'newspapers' : 'clicks'} for months. You both secretly loved it.`; } },
      { label: 'Kill them with kindness', tags: ['help', 'social'], run: (x) => { x.addRel(npcId(x), 'acquaintance', { affinity: 10 }); x.mods({ publicImage: 6 }); return `You sent flowers. ${who(x)} looked petty, and you looked saintly.`; } },
      { label: 'Ignore it', tags: ['cautious'], run: (x) => { x.mods({ ego: -1 }); return 'No reaction. The story died. Mature, and slightly boring.'; } },
    ],
  },
  {
    id: 'fo_fadingFame', cat: 'media', minAge: 35, weight: (x) => (x.stat('fame') >= 25 && x.stat('fame') < 65 ? 0.8 : 0), cooldown: 8, scene: 'lonely',
    title: 'The calls stopped',
    text: () => `Your agent takes three days to call back. A young person at the café does not recognise you, and you are horrified that you noticed.`,
    choices: [
      { label: 'Plan a comeback', tags: ['ambitious'], run: (x) => { if (x.chance(0.4)) { x.mods({ fame: 8, happiness: 6 }); return 'The comeback worked. Nostalgia is a powerful drug.'; } x.mods({ fame: -2, happiness: -4 }); return 'The comeback was reviewed as "brave". Ouch.'; } },
      { label: 'Enjoy the quiet', tags: ['cautious'], scene: 'calm', run: (x) => { x.mods({ fame: -4, happiness: 5, stress: -6, wisdom: 3 }); return 'You discovered gardening and an inner peace no spotlight ever gave you.'; } },
      { label: 'Do a reality show', tags: ['impulsive'], when: (x) => x.year >= 1995, run: (x) => { x.mods({ fame: 6, publicImage: -6 }); x.money($(x, 40000)); return 'You ate a bug on camera. Fame returned, smelling slightly of bug.'; } },
    ],
  },
  {
    id: 'fo_fameForGood', cat: 'media', minAge: 18, weight: celeb(0.9), cooldown: 6, scene: 'volunteer',
    title: 'Use the spotlight',
    text: (x) => `A charity for ${x.pick(['sick children', 'clean water', 'refugees', 'literacy', 'animal shelters'])} asks if you would lend them your name.`,
    choices: [
      { label: 'Become their ambassador', tags: ['help'], run: (x) => { x.mods({ publicImage: 8, karma: 6, happiness: 4 }); x.story('humanitarian', 'Star champions forgotten cause', 20); return 'Donations tripled. For once, the cameras did some good.'; } },
      { label: 'Donate quietly', tags: ['help', 'cautious'], run: (x) => { const g = Math.min(x.c.money, $(x, 20000)); x.spend(g); x.mods({ karma: 8 }); return 'No press release. Just a cheque and a good night\'s sleep.'; } },
      { label: 'Only for the photo op', tags: ['ambitious'], run: (x) => { x.mods({ publicImage: 3, karma: -2 }); if (x.chance(0.3)) { x.story('expose', 'Star\'s charity visit lasted eleven minutes', -10); return 'A journalist timed your visit. Eleven minutes.'; } return 'Great photo. Somewhat hollow feeling.'; } },
    ],
  },
  {
    id: 'fo_lookalike', cat: 'media', minAge: 18, weight: celeb(0.6), once: true, scene: 'fame',
    bind: (x) => stranger(x, { age: x.age < 22 ? 22 : x.age, gender: x.c.gender }),
    title: 'Your double',
    text: (x) => `${whoFull(x)} makes a living as your lookalike, opening supermarkets and getting free drinks in your name.`,
    choices: [
      { label: 'Hire them as a decoy', tags: ['ambitious'], run: (x) => { x.addRel(npcId(x), 'acquaintance', { affinity: 20 }); x.mods({ stress: -4 }); return 'Your double now distracts photographers while you buy groceries in peace.'; } },
      { label: 'Send a cease-and-desist', tags: ['cautious'], run: (x) => { x.mods({ publicImage: -1 }); return `${who(x)} switched to being someone else's double. You felt oddly jealous.`; } },
      { label: 'Swap places for a day', tags: ['impulsive'], run: (x) => { x.mods({ happiness: 8 }); return 'Nobody noticed. Not even your family. That was a little hurtful.'; } },
    ],
  },
  {
    id: 'fo_autograph', cat: 'media', minAge: 18, weight: celeb(1), cooldown: 3, scene: 'fame',
    title: 'Just one autograph',
    text: () => `You are late and running. A small child holds up a pen and a crumpled napkin, trembling.`,
    choices: [
      { label: 'Stop and sign', tags: ['help'], run: (x) => { x.mods({ publicImage: 2, happiness: 3, karma: 1 }); return 'The child gasped. You were late. Worth it.'; } },
      { label: 'Sign and draw a doodle', tags: ['social'], run: (x) => { x.mods({ publicImage: 3, happiness: 4 }); return 'You drew a lopsided dragon. Twenty years later it sold at auction.'; } },
      { label: 'Keep running', tags: ['cautious'], run: (x) => { x.mods({ publicImage: -2 }); return 'The child\'s face haunted your entire meeting.'; } },
    ],
  },
  {
    id: 'fo_memoir', cat: 'media', minAge: 35, weight: celeb(0.7), once: true, scene: 'reading',
    title: 'Memoir offer',
    text: (x) => `A publisher offers ${x.fmt($(x, 300000))} for your memoir. They would like "the juicy bits".`,
    choices: [
      { label: 'Tell everything', tags: ['impulsive'], run: (x) => { const a = x.money($(x, 300000)); x.mods({ fame: 6 }); for (const r of x.rels('ex', 'sibling').slice(0, 3)) x.relMod(r.npcId, -10); return `A bestseller. ${x.fmt(a)}. Several people are no longer speaking to you.`; } },
      { label: 'Write it tastefully', tags: ['cautious'], run: (x) => { const a = x.money($(x, 120000)); x.train('writing', 6); return `Reviewers called it "gentle". It earned ${x.fmt(a)}.`; } },
      { label: 'Use a ghostwriter', tags: ['ambitious'], run: (x) => { const a = x.money($(x, 200000)); return `You read your own book and learned some surprising things about yourself. ${x.fmt(a)}.`; } },
    ],
  },
  {
    id: 'fo_realityShow', cat: 'media', minAge: 18, years: [1998, 2300], weight: known(0.8), once: true, scene: 'fame',
    title: 'Reality TV',
    text: () => `A producer wants you on a reality show: a house, twelve strangers, hidden cameras and a hot tub.`,
    choices: [
      { label: 'Sign up', tags: ['impulsive'], run: (x) => { x.mods({ fame: 12, publicImage: -5, stress: 6 }); x.money($(x, 30000)); return 'The edit made you the villain. Villains get the best book deals.'; } },
      { label: 'Ask about the edit', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 2 }); return 'The producer laughed for a very long time. You declined.'; } },
      { label: 'Pitch your own show', tags: ['ambitious'], run: (x) => { if (x.chance(0.25)) { x.money($(x, 100000)); x.mods({ fame: 8 }); return 'Your show about restoring old bicycles became a cosy hit.'; } return 'They said your idea was "too wholesome". You took it as a compliment.'; } },
    ],
  },
  {
    id: 'fo_redCarpetTrip', cat: 'media', minAge: 18, years: [1920, 2300], weight: celeb(0.7), cooldown: 8, scene: 'fame',
    title: 'Red carpet tumble',
    text: () => `Walking the red carpet, your heel catches. You are going down, and two hundred cameras are watching.`,
    choices: [
      { label: 'Turn it into a dance', tags: ['social', 'impulsive'], scene: 'dance', run: (x) => { if (check(x, x.stat('dexterity') + x.skill('dance'), 55)) { x.mods({ fame: 5, popularity: 6 }); return 'A perfect roll into a pose. Fashion magazines called it "a moment".'; } x.mods({ fame: 4, publicImage: -2 }); return 'It was not a dance. It was a fall with extra steps.'; } },
      { label: 'Laugh it off', tags: ['social'], run: (x) => { x.mods({ publicImage: 4 }); return 'Your laugh was so genuine that people liked you more.'; } },
    ],
  },
  {
    id: 'fo_portrait', cat: 'media', minAge: 20, years: [1300, 1860], weight: (x) => (x.stat('fame') >= 20 || x.c.money > $(x, 50000) ? 0.8 : 0), cooldown: 15, scene: 'painting',
    title: 'Sitting for a portrait',
    text: () => `A fashionable painter will immortalise you in oils. The question is how honestly.`,
    choices: [
      { label: 'Flatter me', tags: ['ambitious'], run: (x) => { x.spend($(x, 3000)); x.mods({ ego: 4, publicImage: 3 }); return 'Your portrait has a jawline you have never possessed. It is perfect.'; } },
      { label: 'Paint me as I am', tags: ['cautious'], run: (x) => { x.spend($(x, 3000)); x.mods({ wisdom: 3 }); return 'Honest and unflattering. Your grandchildren will treasure it.'; } },
      { label: 'Include the dog', tags: ['social'], when: (x) => x.pets().length > 0, scene: 'pet', run: (x) => { x.spend($(x, 3500)); x.mods({ happiness: 5 }); return 'The dog looks nobler than you. Everyone agrees.'; } },
    ],
  },
  {
    id: 'fo_minstrelMock', cat: 'media', minAge: 18, years: [-800, 1500], weight: known(0.8), cooldown: 10, scene: 'serenade',
    title: 'A mocking song',
    text: () => `A travelling minstrel is singing a song mocking you in every inn on the road.`,
    choices: [
      { label: 'Pay him to stop', tags: ['cautious'], run: (x) => { x.spend($(x, 80)); return 'He stopped. Then started a song about how you paid him to stop.'; } },
      { label: 'Challenge him to a rhyme-off', tags: ['social', 'ambitious'], scene: 'stage', run: (x) => { if (check(x, x.skill('poetry') + x.stat('charisma'), 60)) { x.mods({ fame: 5, popularity: 5 }); return 'You out-rhymed him in front of a whole inn. He left town.'; } x.mods({ popularity: -3 }); return 'He rhymed your name with "cabbage". You never recovered.'; } },
      { label: 'Have him thrown out', tags: ['violent'], run: (x) => { x.mods({ publicImage: -4, fear: 3 }); return 'He left, and the song got a new, angrier verse.'; } },
    ],
  },
  {
    id: 'fo_oldPost', cat: 'media', minAge: 18, years: [2015, 2300], weight: celeb(0.9), cooldown: 6, scene: 'scandal',
    title: 'Something you wrote',
    text: () => `A post you wrote twelve years ago has resurfaced. It was meant as a joke. It has not aged well.`,
    choices: [
      { label: 'Apologise sincerely', tags: ['cautious', 'help'], run: (x) => { x.mods({ publicImage: -2, wisdom: 3 }); return 'A real apology, no excuses. Most people accepted it.'; } },
      { label: 'Double down', tags: ['impulsive'], run: (x) => { x.mods({ publicImage: -10, fame: 4, infamy: 5 }); x.story('scandal', 'Star refuses to apologise for old post', -15); return 'You made it worse, and also more famous. Sponsors left.'; } },
      { label: 'Log off and wait', tags: ['cautious'], run: (x) => { x.mods({ publicImage: -4, stress: 4 }); return 'It blew over. Mostly.'; } },
    ],
  },
  {
    id: 'fo_influencerFreebies', cat: 'media', minAge: 16, years: [2012, 2300], weight: known(1), cooldown: 4, scene: 'shopping',
    title: 'Free stuff',
    text: () => `A box arrives: free sneakers, skincare and a branded water bottle. "Would love a post!!"`,
    choices: [
      { label: 'Post an honest review', tags: ['cautious'], run: (x) => { x.mods({ publicImage: 3, popularity: 2 }); return 'Your followers trusted you more. The brand did not send another box.'; } },
      { label: 'Gush about everything', tags: ['ambitious'], run: (x) => { x.money($(x, 800)); x.mods({ fame: 2, publicImage: -1 }); return 'The bottle leaks. You called it "life-changing". Paid partnership.'; } },
      { label: 'Donate the lot', tags: ['help'], run: (x) => { x.mods({ karma: 3 }); return 'A shelter now has the best-moisturised volunteers in town.'; } },
    ],
  },
  {
    id: 'fo_heroMoment', cat: 'media', minAge: 16, weight: 0.3, once: true, scene: 'fame',
    title: 'Somebody help!',
    text: () => `A child has slipped into the river by the bridge. People are shouting. Nobody is moving.`,
    choices: [
      { label: 'Jump in', tags: ['help', 'impulsive'], run: (x) => { if (check(x, x.stat('fitness') + x.skill('swimming'), 50)) { x.mods({ fame: 12, publicImage: 15, karma: 12, happiness: 10 }); x.story('humanitarian', `Local hero pulls child from river`, 30); x.remember('hero', 'Saved a child from a river', 80); return `You pulled the child out. By morning ${crier(x)} called you a hero.`; } x.mods({ health: -8, karma: 8 }); return 'A boatman got the child out, then had to get you out too. Still brave.'; } },
      { label: 'Throw something that floats', tags: ['cautious', 'help'], run: (x) => { x.mods({ karma: 8, publicImage: 6, fame: 4 }); return 'Your quick thinking and a barrel saved the day.'; } },
      { label: 'Run for help', tags: ['cautious'], run: (x) => { x.mods({ karma: 3 }); return 'Help came. The child was fine. You never quite forgave yourself for not jumping.'; } },
    ],
  },
  {
    id: 'fo_hometownDay', cat: 'media', minAge: 25, weight: celeb(0.6), once: true, scene: 'parade',
    title: 'Hometown honour',
    text: () => `Your hometown wants to name a day after you, with a parade and a slightly wonky statue.`,
    choices: [
      { label: 'Ride in the parade', tags: ['social'], run: (x) => { x.mods({ happiness: 10, ego: 4, publicImage: 4 }); return 'Your old teacher waved from the crowd. You cried a little.'; } },
      { label: 'Ask for a library instead', tags: ['help'], scene: 'library', run: (x) => { x.mods({ karma: 6, publicImage: 6 }); x.spend(Math.min(x.c.money, $(x, 20000))); return 'They built a library with your name on it. Better than a statue.'; } },
      { label: 'Approve the statue', tags: ['ambitious'], run: (x) => { x.mods({ ego: 6 }); return 'The statue looks like you if you were a potato. You love it anyway.'; } },
    ],
  },
  {
    id: 'fo_gossipColumn', cat: 'media', minAge: 18, years: [1890, 2005], weight: known(1), cooldown: 4, scene: 'newsroom',
    title: 'The gossip columnist',
    text: () => `A powerful gossip columnist corners you at a party and wants "a little something" for tomorrow's column.`,
    choices: [
      { label: 'Feed them a rival', tags: ['ambitious'], run: (x) => { x.mods({ sin: 2, publicImage: 1 }); x.story('gossip', 'Insiders whisper about a rising star\'s drinking', -5); return 'You gave them a juicy morsel about someone else. You are now owed a favour.'; } },
      { label: 'Charm them', tags: ['social'], run: (x) => { x.mods({ publicImage: 4 }); x.story('puff', 'Most charming guest of the season', 10); return 'Tomorrow\'s column called you "simply delicious".'; } },
      { label: 'No comment', tags: ['cautious'], run: (x) => { x.story('gossip', 'Mysterious star stays silent', -2); return 'They wrote about your mysterious silence instead.'; } },
    ],
  },
  {
    id: 'fo_charityGala', cat: 'media', minAge: 21, weight: (x) => (x.stat('fame') >= 30 || x.c.money > $(x, 500000) ? 0.9 : 0), cooldown: 4, scene: 'royalBall',
    title: 'Charity gala',
    text: () => `A black-tie charity gala, with an auction, a string quartet and several people you secretly cannot stand.`,
    choices: [
      { label: 'Bid on something absurd', tags: ['impulsive', 'help'], run: (x) => { const g = Math.min(x.c.money, $(x, 50000)); x.spend(g); x.mods({ karma: 4, publicImage: 5 }); return `You paid ${x.fmt(g)} for a signed tennis ball. For the children.`; } },
      { label: 'Network', tags: ['ambitious', 'social'], run: (x) => { x.train('networking', 5); x.mods({ professionalRep: 3 }); return 'You collected eleven cards and one genuine friend.'; } },
      { label: 'Hide by the canapés', tags: ['cautious'], run: (x) => { x.mods({ happiness: 3 }); return 'You ate forty tiny pastries and spoke to nobody. Perfect night.'; } },
    ],
  },
  {
    id: 'fo_fanConvention', cat: 'media', minAge: 18, years: [1970, 2300], weight: celeb(0.7), cooldown: 5, scene: 'party',
    title: 'Fan convention',
    text: () => `A fan convention invites you as a special guest. There will be people in costumes of you.`,
    choices: [
      { label: 'Go and sign all day', tags: ['social'], run: (x) => { const a = x.money($(x, 20000)); x.mods({ popularity: 5, energy: -8 }); return `${x.fmt(a)} for signatures and one deeply strange conversation with yourself.`; } },
      { label: 'Judge the costume contest', tags: ['social'], run: (x) => { x.mods({ happiness: 6 }); return 'The winner\'s costume of you was more convincing than you.'; } },
      { label: 'Decline', tags: ['cautious'], run: () => 'You stayed home. Somewhere, a cardboard cutout of you stood in for you.' },
    ],
  },
  {
    id: 'fo_prematureObit', cat: 'media', minAge: 60, years: [1800, 2300], weight: celeb(0.5), once: true, scene: 'newsroom',
    title: 'Reports of your death',
    text: (x) => `${crier(x)[0].toUpperCase()}${crier(x).slice(1)} announced your death this morning. You are eating toast.`,
    choices: [
      { label: 'Read your obituary', tags: ['cautious'], scene: 'reading', run: (x) => { x.mods({ wisdom: 4, happiness: 3 }); return 'It was very kind. You had no idea people felt that way.'; } },
      { label: 'Make a witty statement', tags: ['social'], run: (x) => { x.mods({ fame: 6, popularity: 5 }); x.story('profile', 'Not dead, just busy', 15); return 'Your one-liner about being "alive but resting my eyes" was quoted for years.'; } },
      { label: 'Attend your own wake', tags: ['impulsive'], scene: 'funeral', run: (x) => { x.mods({ happiness: 6 }); return 'You stood at the back and heard everything. Mostly nice. Mostly.'; } },
    ],
  },
  {
    id: 'fo_waxFigure', cat: 'media', minAge: 20, years: [1835, 2300], weight: celeb(0.5), once: true, scene: 'museum',
    title: 'Wax you',
    text: () => `A wax museum wants to make a figure of you. They need to measure your nostrils.`,
    choices: [
      { label: 'Agree', tags: ['social'], run: (x) => { x.mods({ ego: 5, fame: 3 }); return 'Wax you is taller and has better skin. You visit it on bad days.'; } },
      { label: 'Demand approval', tags: ['ambitious'], run: (x) => { x.mods({ ego: 3 }); return 'You sent back the nose four times. The sculptor quit.'; } },
      { label: 'Refuse', tags: ['cautious'], run: () => 'They made one anyway, of someone who looks a bit like you.' },
    ],
  },
  {
    id: 'fo_addressLeak', cat: 'media', minAge: 18, years: [1995, 2300], weight: celeb(0.6), cooldown: 10, scene: 'hacker',
    title: 'Doxxed',
    text: () => `Your home address has been posted online. Strangers are taking selfies at your gate.`,
    choices: [
      { label: 'Move house', tags: ['cautious'], scene: 'moving', run: (x) => { x.spend(Math.min(x.c.money, $(x, 15000))); x.mods({ stress: 6 }); return 'A new house, a new gate, and an unlisted everything.'; } },
      { label: 'Hand out lemonade', tags: ['social', 'help'], run: (x) => { x.mods({ publicImage: 6, popularity: 4 }); return 'The selfies now include you and a jug. Disarming.'; } },
      { label: 'Call the police', tags: ['cautious'], scene: 'police', run: (x) => { x.mods({ anxiety: 3 }); return 'They added a patrol. The selfie-takers moved on to a ferret influencer.'; } },
    ],
  },
  {
    id: 'fo_filmCameo', cat: 'media', minAge: 16, years: [1920, 2300], weight: celeb(0.7), cooldown: 6, scene: 'cinema',
    title: 'Cameo',
    text: () => `A director wants you in a brief cameo playing "yourself, but confused".`,
    choices: [
      { label: 'Do it', tags: ['social'], run: (x) => { x.mods({ fame: 4 }); x.train('acting', 3); x.money($(x, 10000)); return 'Eight seconds of screen time. Critics called it "the best part".'; } },
      { label: 'Ask for more lines', tags: ['ambitious'], run: (x) => { if (check(x, x.skill('acting') + x.stat('charisma') / 2, 55)) { x.mods({ fame: 7 }); return 'They expanded the role. You stole the film.'; } return 'They cut you entirely. Your mother still watches for your elbow.'; } },
      { label: 'Decline', tags: ['cautious'], run: () => 'They cast a lookalike. Nobody could tell.' },
    ],
  },
  {
    id: 'fo_spottedWith', cat: 'media', minAge: 18, weight: celeb(0.9), cooldown: 4, scene: 'scandal',
    title: 'Spotted together',
    text: (x) => `${crier(x)[0].toUpperCase()}${crier(x).slice(1)} has photos of you laughing with an attractive stranger. The headline: "NEW LOVE?"`,
    choices: [
      { label: 'Laugh it off', tags: ['social'], run: (x) => { const l = x.lover(); if (l) x.relMod(l.npcId, -2, -3); return 'It was your accountant. Your partner was mildly amused, mostly.'; } },
      { label: 'Issue a statement', tags: ['cautious'], run: (x) => { x.mods({ publicImage: 1 }); return 'Your statement was so dull the story died of boredom.'; } },
      { label: 'Say nothing, smile', tags: ['impulsive'], run: (x) => { x.mods({ fame: 4 }); const l = x.lover(); if (l) x.relMod(l.npcId, -6, -8); return 'The mystery kept you in the headlines for a week, and on the sofa for two.'; } },
    ],
  },
];

// ==================================================================== POWER
const players = (w: number) => (x: Ctx): number => (x.stat('politicalApproval') >= 20 || x.stat('professionalRep') >= 55 || x.stat('fame') >= 40 ? w : 0.1 * w);

const POWER: EventDef[] = [
  {
    id: 'fo_petition', cat: 'politics', minAge: 16, years: [1600, 2300], weight: 1, cooldown: 4, scene: 'meeting',
    title: 'Sign here, please',
    text: (x) => `A neighbour with a clipboard wants signatures to ${x.pick(['save the old oak tree', 'stop a new tannery', 'build a bridge', 'ban drums after nine', 'get a streetlight on the corner'])}.`,
    choices: [
      { label: 'Sign it', tags: ['social'], run: (x) => { x.mods({ politicalApproval: 1, popularity: 1 }); return 'Your name joined three hundred others. Democracy, in ink.'; } },
      { label: 'Lead the campaign', tags: ['ambitious', 'help'], run: (x) => { x.train('leadership', 3); x.train('publicSpeaking', 2); if (x.chance(0.5)) { x.mods({ politicalApproval: 5, happiness: 5 }); return 'The council caved. You won! The neighbourhood owes you drinks.'; } x.mods({ stress: 5 }); return 'The council ignored you. You learned how power really works.'; } },
      { label: 'Start a counter-petition', tags: ['impulsive'], run: (x) => { x.mods({ popularity: -3, ego: 2 }); return 'Your counter-petition gathered four signatures, two of them yours.'; } },
    ],
  },
  {
    id: 'fo_townMeeting', cat: 'politics', minAge: 18, weight: 0.9, cooldown: 4, scene: 'meeting',
    title: (x) => (x.year < 500 ? 'The forum' : x.year < 1700 ? 'The village moot' : 'Town meeting'),
    text: () => `The town is arguing about where to put the new well, road or rubbish heap. Everyone wants it near someone else.`,
    choices: [
      { label: 'Give a rousing speech', tags: ['ambitious', 'social'], scene: 'election', run: (x) => { if (check(x, x.skill('oratory') + x.stat('charisma'), 70)) { x.mods({ politicalApproval: 6, popularity: 4 }); x.train('oratory', 4); return 'They applauded. Someone said you should run for something.'; } x.train('oratory', 2); return 'Mid-speech, a goat wandered in. Nobody remembers your point.'; } },
      { label: 'Broker a compromise', tags: ['help'], run: (x) => { x.train('conflictResolution', 4); x.mods({ politicalApproval: 3, wisdom: 2 }); return 'Everyone was equally unhappy, which is the definition of fairness.'; } },
      { label: 'Sit at the back', tags: ['cautious'], run: () => 'You ate a pie and watched grown adults shout about drainage. Good theatre.' },
    ],
  },
  {
    id: 'fo_campaignVolunteer', cat: 'politics', minAge: 16, years: [1820, 2300], weight: (x) => (x.w.regime === 'democracy' ? 1 : 0), cooldown: 4, scene: 'election',
    title: 'Knock on doors',
    text: () => `A local candidate needs volunteers to knock on doors and hand out leaflets in the rain.`,
    choices: [
      { label: 'Volunteer', tags: ['help', 'social'], run: (x) => { x.train('networking', 3); x.train('persuasion', 2); x.mods({ politicalApproval: 3, fitness: 1 }); return 'Two hundred doors, three dogs, one surprising conversation about bins.'; } },
      { label: 'Donate instead', tags: ['cautious'], run: (x) => { x.spend(Math.min(x.c.money, $(x, 200))); x.mods({ politicalApproval: 1 }); return 'Your name is now on a mailing list forever.'; } },
      { label: 'Run yourself one day', tags: ['ambitious'], run: (x) => { x.setFlag('fo_politicalDream', true); x.mods({ confidence: 3 }); return 'Watching the candidate, you thought: I could do that. Better, even.'; } },
    ],
  },
  {
    id: 'fo_bribeOffer', cat: 'politics', minAge: 22, weight: players(1), cooldown: 4, scene: 'bribe',
    title: 'A thick envelope',
    text: (x) => `A smiling contractor slides an envelope across the table: ${x.fmt($(x, 40000))} "for your consideration" on an upcoming decision.`,
    choices: [
      { label: 'Take it', tags: ['impulsive'], run: (x) => { x.money($(x, 40000)); x.mods({ corruption: 8, sin: 4 }); x.secret('fo_bribe', 'Took a contractor\'s bribe', 45); if (x.chance(0.2)) openCase(x, 'briberyOfficial', { mult: 0.6 }); return 'The envelope fit perfectly in your coat. So did the guilt.'; } },
      { label: 'Refuse politely', tags: ['cautious'], run: (x) => { x.mods({ karma: 3 }); return 'He smiled and said he understood. He did not.'; } },
      { label: 'Report him', tags: ['help'], scene: 'police', run: (x) => { x.mods({ publicImage: 6, karma: 5, politicalApproval: 4 }); x.story('puff', 'Official reports bribery attempt', 15); return 'He was arrested. You have made an enemy and a headline.'; } },
    ],
  },
  {
    id: 'fo_streetProtest', cat: 'politics', minAge: 15, weight: (x) => (x.w.stability < 55 ? 1.4 : 0.4), cooldown: 3, scene: 'riot',
    title: 'Crowds in the street',
    text: (x) => `Thousands are marching against ${x.pick(['the new taxes', 'the war', 'the price of bread', 'corruption', 'the curfew'])}. Your street is full of banners.`,
    choices: [
      { label: 'March with them', tags: ['social', 'impulsive'], run: (x) => { x.mods({ happiness: 4, politicalApproval: 2 }); if (x.w.regime !== 'democracy' && x.chance(0.25)) { x.mods({ fear: 8, trauma: 3 }); return 'Soldiers broke up the march. You ran, heart pounding, and made it home.'; } return 'You chanted until you were hoarse. You felt part of something big.'; } },
      { label: 'Bring water to marchers', tags: ['help'], scene: 'volunteer', run: (x) => { x.mods({ karma: 4, empathy: 2 }); return 'A thousand thank-yous and one sunburn.'; } },
      { label: 'Stay inside', tags: ['cautious'], run: (x) => { x.mods({ anxiety: 2 }); return 'You watched from the window, torn between fear and envy.'; } },
    ],
  },
  {
    id: 'fo_favourOwed', cat: 'politics', minAge: 25, weight: players(0.8), cooldown: 6, scene: 'gangMeeting',
    bind: (x) => stranger(x, { age: x.int(45, 75), wealth: 2000000 }),
    title: 'A favour returned',
    text: (x) => `${whoFull(x)}, who once helped you without being asked, now asks for something small: a word in the right ear.`,
    choices: [
      { label: 'Do the favour', tags: ['help'], run: (x) => { x.addRel(npcId(x), 'acquaintance', { affinity: 25, trust: 20 }); x.mods({ corruption: 2 }); return `${who(x)} smiled. Favours are a currency, and you just got richer.`; } },
      { label: 'Refuse', tags: ['cautious'], run: (x) => { x.addRel(npcId(x), 'rival', { affinity: -25 }); x.mods({ karma: 2 }); return `${who(x)} said "I see." Two words, very cold.`; } },
      { label: 'Ask what is in it for you', tags: ['ambitious'], run: (x) => { x.money($(x, 10000)); x.addRel(npcId(x), 'acquaintance', { affinity: 5 }); x.mods({ corruption: 4 }); return 'A small fee, a big secret, and a dangerous new friend.'; } },
    ],
  },
  {
    id: 'fo_patron', cat: 'politics', minAge: 16, maxAge: 45, years: [-800, 1900], weight: (x) => (x.stat('creativity') > 55 || x.stat('smarts') > 65 ? 0.9 : 0.15), once: true, scene: 'royalBall',
    bind: (x) => stranger(x, { age: x.int(40, 70), wealth: 5000000 }),
    title: 'A noble patron',
    text: (x) => `${whoFull(x)}, a wealthy noble, offers to support you. In return, you will dedicate your work to them and attend their very long dinners.`,
    choices: [
      { label: 'Accept patronage', tags: ['ambitious'], run: (x) => { x.addRel(npcId(x), 'mentor', { affinity: 20, trust: 15 }); x.money($(x, 15000)); x.mods({ professionalRep: 5 }); return 'You now have a stipend and a dinner seat next to a very old bishop.'; } },
      { label: 'Negotiate freedom', tags: ['cautious'], run: (x) => { x.addRel(npcId(x), 'acquaintance', { affinity: 10 }); x.money($(x, 8000)); x.train('negotiation', 3); return 'Less money, more freedom. You can skip the dinners. Most of them.'; } },
      { label: 'Refuse', tags: ['impulsive'], run: (x) => { x.mods({ ego: 4 }); return 'You stayed poor and independent. Poets will approve, eventually.'; } },
    ],
  },
  {
    id: 'fo_palaceLetter', cat: 'politics', minAge: 18, years: [-800, 1918], weight: (x) => (['monarchy', 'empire'].includes(x.w.regime) ? 0.7 : 0), cooldown: 8, scene: 'royalBall',
    title: 'Palace intrigue',
    text: () => `A courtier presses a sealed letter into your hand. "For the Duchess. Only her. Speak of this to no one."`,
    choices: [
      { label: 'Deliver it', tags: ['cautious'], run: (x) => { if (x.chance(0.7)) { x.money($(x, 3000)); x.mods({ politicalApproval: 3 }); return 'The Duchess read it, smiled very slowly, and paid you in gold.'; } x.mods({ fear: 6, stress: 6 }); return 'Guards intercepted you. You claimed it was a recipe. They half believed you.'; } },
      { label: 'Read it first', tags: ['ambitious'], run: (x) => { x.secret('fo_palacePlot', 'Knows of a plot at court', 40); x.mods({ paranoia: 4 }); return 'It was a plan to poison the chancellor\'s soup. You now know too much.'; } },
      { label: 'Take it to the King\'s men', tags: ['help'], scene: 'coronation', run: (x) => { if (x.chance(0.6)) { x.mods({ politicalApproval: 8 }); x.money($(x, 5000)); return 'A plot foiled. The crown remembers its friends.'; } x.mods({ fear: 10 }); return 'The King\'s men were in on it. You left court rather quickly.'; } },
    ],
  },
  {
    id: 'fo_voteBuying', cat: 'politics', minAge: 18, years: [1800, 2300], weight: (x) => (x.w.regime === 'democracy' && x.w.stability < 60 ? 0.8 : 0.1), cooldown: 6, scene: 'bribe',
    title: 'Your vote, for sale',
    text: (x) => `A party worker offers ${x.fmt($(x, 100))} and a ${x.year < 1950 ? 'bottle of gin' : 'bag of rice'} for your vote.`,
    choices: [
      { label: 'Take it and vote freely', tags: ['impulsive'], run: (x) => { x.money($(x, 100)); x.mods({ happiness: 2 }); return 'You took the gift and voted for the other lot. Delicious.'; } },
      { label: 'Refuse', tags: ['cautious'], run: (x) => { x.mods({ karma: 2 }); return 'Your vote is not for sale. Not at that price, anyway.'; } },
      { label: 'Report the fraud', tags: ['help'], run: (x) => { x.mods({ karma: 3, politicalApproval: 2 }); return 'The election board thanked you and did very little.'; } },
    ],
  },
  {
    id: 'fo_strike', cat: 'politics', minAge: 18, years: [1850, 2300], weight: (x) => (x.employed ? 0.8 : 0), cooldown: 6, scene: 'riot',
    title: 'Strike vote',
    text: () => `Your workplace is voting on a strike for better pay. The boss is watching who raises their hand.`,
    choices: [
      { label: 'Vote to strike', tags: ['social'], run: (x) => { if (x.chance(0.6)) { x.money($(x, 2000)); x.mods({ happiness: 5 }); return 'Three cold weeks on the picket line, then a raise.'; } x.mods({ stress: 6 }); x.money(-Math.min(x.c.money, $(x, 1000))); return 'The strike dragged on and broke. You lost wages and a little hope.'; } },
      { label: 'Lead the union', tags: ['ambitious', 'help'], run: (x) => { x.train('leadership', 4); x.train('negotiation', 4); x.mods({ politicalApproval: 4, professionalRep: -2 }); return 'You stood on a crate and spoke. People listened. Management made a note.'; } },
      { label: 'Keep your head down', tags: ['cautious'], run: (x) => { x.mods({ popularity: -2 }); return 'You worked through it. Some of your colleagues will not forget.'; } },
    ],
  },
  {
    id: 'fo_warBonds', cat: 'politics', minAge: 16, years: [1914, 1975], weight: (x) => (x.w.war ? 1.2 : 0), cooldown: 3, scene: 'parade',
    title: 'Buy bonds!',
    text: () => `Posters everywhere urge you to buy war bonds. A brass band plays outside the bank.`,
    choices: [
      { label: 'Buy plenty', tags: ['help'], run: (x) => { const s = Math.min(x.c.money, $(x, 1000)); x.spend(s); x.setFlag('fo_bonds', s); x.mods({ politicalApproval: 2, karma: 1 }); return 'Patriotic and quietly reassuring. They will pay out one day.'; } },
      { label: 'Buy one', tags: ['cautious'], run: (x) => { x.spend($(x, 50)); return 'One bond, framed, as proof of your patriotism.'; } },
      { label: 'Buy none', tags: ['impulsive'], run: (x) => { x.mods({ popularity: -1 }); return 'The band played a little louder as you walked past.'; } },
    ],
  },
  {
    id: 'fo_guildSeat', cat: 'politics', minAge: 30, weight: (x) => (x.stat('professionalRep') >= 40 ? 0.8 : 0), once: true, scene: 'meeting',
    title: (x) => (x.year < 1800 ? 'A seat on the guild' : 'A seat on the board'),
    text: (x) => `You are invited to sit on the ${x.year < 1800 ? 'guild council' : 'local school board'}. Unpaid, important and full of meetings.`,
    choices: [
      { label: 'Accept', tags: ['ambitious', 'help'], run: (x) => { x.mods({ politicalApproval: 5, professionalRep: 4, stress: 4 }); x.train('management', 3); return 'You now have strong opinions about the minutes.'; } },
      { label: 'Decline', tags: ['cautious'], run: () => 'You kept your evenings. Priceless.' },
    ],
  },
  {
    id: 'fo_informOnNeighbour', cat: 'politics', minAge: 18, weight: (x) => (['autocracy', 'junta', 'theocracy'].includes(x.w.regime) ? 1 : 0), cooldown: 6, scene: 'interview',
    bind: (x) => stranger(x),
    title: 'A quiet word',
    text: (x) => `A man from the ministry wants to know about your neighbour ${whoFull(x)}. "Any unusual visitors? Any jokes about the leaders?"`,
    choices: [
      { label: 'Say you know nothing', tags: ['cautious', 'help'], run: (x) => { x.mods({ fear: 5, karma: 3 }); return 'He wrote "uncooperative" in a notebook. You heard the pen scratch for a week.'; } },
      { label: 'Tell him something', tags: ['impulsive'], run: (x) => { x.mods({ sin: 6, karma: -8, depression: 3 }); x.secret('fo_informer', 'Informed on a neighbour', 50); return `${who(x)} was taken away at dawn. You did not look out the window.`; } },
      { label: 'Warn your neighbour', tags: ['help'], run: (x) => { x.addRel(npcId(x), 'friend', { affinity: 30, trust: 40 }); x.mods({ karma: 6, fear: 4 }); return `${who(x)} left the city that night and pressed your hand without a word.`; } },
    ],
  },
  {
    id: 'fo_corruptionFiles', cat: 'politics', minAge: 18, years: [1900, 2300], weight: 0.4, once: true, scene: 'newsroom',
    title: 'Damning papers',
    text: () => `Through pure chance you come across documents showing the mayor's brother has won every council contract for a decade.`,
    choices: [
      { label: 'Leak them to the press', tags: ['help', 'impulsive'], scene: 'scandal', run: (x) => { x.mods({ karma: 6, fame: 3, fear: 4 }); x.story('expose', 'Council contracts scandal', 0); return 'The mayor resigned. Your car tyres were slashed. Even trade.'; } },
      { label: 'Blackmail the mayor', tags: ['ambitious'], run: (x) => { if (x.chance(0.6)) { x.money($(x, 50000)); x.mods({ corruption: 8, sin: 5 }); return 'An envelope arrives monthly. You sleep a little worse.'; } openCase(x, 'extortion'); return 'The mayor called the police first. Bold.'; } },
      { label: 'Shred them', tags: ['cautious'], run: (x) => { x.mods({ anxiety: 3 }); return 'Some battles are not yours. You shred them and pretend not to know.'; } },
    ],
  },
  {
    id: 'fo_heckle', cat: 'politics', minAge: 16, years: [1800, 2300], weight: 0.6, cooldown: 6, scene: 'election',
    title: 'Campaign rally',
    text: () => `A politician is promising the moon at a rally. You happen to know he voted against moons last year.`,
    choices: [
      { label: 'Heckle him', tags: ['impulsive'], run: (x) => { if (check(x, x.skill('humor') + x.stat('confidence'), 60)) { x.mods({ fame: 3, popularity: 4 }); return 'Your heckle got the biggest laugh of the night. Even he chuckled.'; } x.mods({ publicImage: -2 }); return 'Security walked you out to polite applause.'; } },
      { label: 'Ask a sharp question', tags: ['ambitious'], run: (x) => { x.train('publicSpeaking', 2); x.mods({ politicalApproval: 3 }); return 'He dodged it. Everyone noticed him dodge it.'; } },
      { label: 'Enjoy the free sausages', tags: ['cautious'], run: (x) => { x.mods({ happiness: 3 }); return 'Politics comes and goes. Free sausages are eternal.'; } },
    ],
  },
  {
    id: 'fo_lobbyistDinner', cat: 'politics', minAge: 25, years: [1880, 2300], weight: players(0.8), cooldown: 5, scene: 'restaurant',
    title: 'Dinner on them',
    text: () => `A lobbyist takes you to the best restaurant in town. Over dessert, they mention a bill they would love you to "think about".`,
    choices: [
      { label: 'Listen with interest', tags: ['ambitious'], run: (x) => { x.money($(x, 15000)); x.mods({ corruption: 5 }); x.train('networking', 3); return 'A "consulting fee" arrived. You consulted very hard on dessert.'; } },
      { label: 'Pay your share', tags: ['cautious'], run: (x) => { x.spend($(x, 150)); x.mods({ karma: 2 }); return 'You split the bill. The lobbyist looked at you like a rare fish.'; } },
      { label: 'Order everything', tags: ['impulsive'], run: (x) => { x.mods({ happiness: 6, health: -1 }); return 'You ate like a king and promised nothing. A perfect evening.'; } },
    ],
  },
  {
    id: 'fo_endorseCandidate', cat: 'politics', minAge: 21, years: [1850, 2300], weight: (x) => (x.stat('fame') >= 35 && x.w.regime === 'democracy' ? 0.9 : 0), cooldown: 5, scene: 'election',
    title: 'Your endorsement',
    text: () => `A candidate begs for your public endorsement. Half your fans will love it. The other half will not.`,
    choices: [
      { label: 'Endorse them', tags: ['social'], run: (x) => { x.mods({ politicalApproval: 6, popularity: -3, fame: 2 }); return 'Your fans split into two furious camps. Engagement was enormous.'; } },
      { label: 'Stay neutral', tags: ['cautious'], run: () => 'Both sides called you a coward. Neutrality is a lonely place.' },
      { label: 'Endorse yourself', tags: ['ambitious', 'impulsive'], run: (x) => { x.setFlag('fo_politicalDream', true); x.mods({ fame: 4, ego: 5 }); return 'You announced you were "seriously considering" running. Pundits gasped.'; } },
    ],
  },
  {
    id: 'fo_curfew', cat: 'politics', minAge: 14, weight: (x) => (x.w.stability < 35 ? 1.2 : 0), cooldown: 4, scene: 'police',
    title: 'Curfew',
    text: () => `Soldiers patrol the streets after dark. Anyone outside after eight will be arrested. Your friend lives three streets away and needs medicine.`,
    choices: [
      { label: 'Sneak the medicine over', tags: ['help', 'impulsive'], run: (x) => { if (check(x, x.skill('evasion') + x.stat('dexterity'), 55)) { x.mods({ karma: 6, confidence: 3 }); return 'You crept through backyards and made it. Your friend squeezed your hand.'; } openCase(x, 'vandalism', { mult: 0.3, label: 'Curfew violation' }); x.mods({ fear: 6 }); return 'A patrol caught you. They took the medicine and your name.'; } },
      { label: 'Wait for morning', tags: ['cautious'], run: (x) => { x.mods({ anxiety: 5 }); return 'You did not sleep. In the morning you ran over. Your friend was alright.'; } },
    ],
  },
  {
    id: 'fo_stewardLoan', cat: 'politics', minAge: 25, years: [-800, 1800], weight: (x) => (x.c.money > $(x, 20000) ? 0.7 : 0), cooldown: 8, scene: 'royalBall',
    title: "The Duke's steward",
    text: (x) => `The Duke's steward requests a "loan" of ${x.fmt($(x, 10000))} for His Grace's hunting season. Repayment, he implies, is unlikely but the favour is real.`,
    choices: [
      { label: 'Lend gladly', tags: ['ambitious'], run: (x) => { x.spend($(x, 10000)); x.mods({ politicalApproval: 8 }); x.setFlag('fo_dukeFavour', true); return 'The Duke now nods at you in church. That nod is worth something.'; } },
      { label: 'Plead poverty', tags: ['cautious'], run: (x) => { x.mods({ politicalApproval: -3 }); return 'The steward eyed your new boots and said nothing. Loudly.'; } },
      { label: 'Lend half', tags: ['social'], run: (x) => { x.spend($(x, 5000)); x.mods({ politicalApproval: 3 }); return 'Half a loan, half a favour. Diplomacy.'; } },
    ],
  },
  {
    id: 'fo_tribuneVote', cat: 'politics', minAge: 18, years: [-500, 400], weight: 0.7, cooldown: 5, scene: 'election',
    title: 'The assembly votes',
    text: () => `The assembly gathers to vote on a grain law. A senator's freedman offers you free bread for a year if you vote his way.`,
    choices: [
      { label: 'Take the bread', tags: ['impulsive'], run: (x) => { x.money($(x, 600)); x.mods({ corruption: 2 }); return 'A year of free bread. Your conscience is well fed.'; } },
      { label: 'Vote your conscience', tags: ['cautious'], run: (x) => { x.mods({ karma: 2, politicalApproval: 2 }); return 'You voted as you thought right. The law passed anyway.'; } },
      { label: 'Speak in the forum', tags: ['ambitious'], run: (x) => { x.train('oratory', 5); x.mods({ fame: 2, politicalApproval: 4 }); return 'Your speech drew a crowd and a glare from the senator.'; } },
    ],
  },
  {
    id: 'fo_landGrab', cat: 'politics', minAge: 25, weight: (x) => (x.c.items.length > 0 ? 0.5 : 0.1), cooldown: 10, scene: 'construction',
    title: 'They want your land',
    text: (x) => `A developer with friends on the council wants to build ${x.year < 1850 ? 'a canal' : x.year < 1950 ? 'a railway yard' : 'a shopping centre'} right where you live. They offer ${x.fmt($(x, 80000))}.`,
    choices: [
      { label: 'Sell up', tags: ['cautious'], scene: 'moving', run: (x) => { const a = x.money($(x, 80000)); x.mods({ happiness: -2 }); return `You took ${x.fmt(a)} and watched bulldozers eat your garden.`; } },
      { label: 'Fight them', tags: ['ambitious'], scene: 'court', run: (x) => { x.spend(Math.min(x.c.money, $(x, 8000))); if (x.chance(0.4)) { x.mods({ politicalApproval: 5, happiness: 6 }); return 'You won. The development moved. Your neighbours call you "the Wall".'; } const a = x.money($(x, 50000)); return `They used compulsory purchase. You got ${x.fmt(a)} and a bitter memory.`; } },
      { label: 'Hold out for more', tags: ['impulsive'], run: (x) => { if (x.chance(0.5)) { const a = x.money($(x, 200000)); return `They blinked. ${x.fmt(a)}. You moved somewhere nicer.`; } x.mods({ stress: 6 }); return 'They built around you. Your house is now in a car park.'; } },
    ],
  },
  {
    id: 'fo_undergroundCell', cat: 'politics', minAge: 18, maxAge: 60, weight: (x) => (x.w.stability < 40 && x.w.regime !== 'democracy' ? 0.9 : 0), once: true, scene: 'ritual',
    title: 'The meeting in the cellar',
    text: () => `A friend invites you to a cellar where people whisper about overthrowing the regime by candlelight.`,
    choices: [
      { label: 'Join them', tags: ['impulsive', 'ambitious'], run: (x) => { x.setFlag('fo_resistance', true); x.mods({ politicalApproval: 4, fear: 6, happiness: 3 }); x.secret('fo_resistance', 'Member of an underground resistance', 55); return 'You swore an oath on a pamphlet. Your heart has never beaten faster.'; } },
      { label: 'Print their leaflets', tags: ['help'], run: (x) => { x.mods({ karma: 3, fear: 4 }); x.secret('fo_leaflets', 'Printed illegal leaflets', 40); return 'Your ink-stained fingers are now a liability and a point of pride.'; } },
      { label: 'Walk away', tags: ['cautious'], run: (x) => { x.mods({ anxiety: 3 }); return 'You climbed out of the cellar and promised yourself to forget the faces.'; } },
    ],
  },
  {
    id: 'fo_monumentFund', cat: 'politics', minAge: 20, weight: 0.5, cooldown: 8, scene: 'construction',
    title: 'A statue for the town',
    text: () => `The town wants a statue of its founder, a man mainly remembered for losing a duel to a goose. They need donations.`,
    choices: [
      { label: 'Donate generously', tags: ['help'], run: (x) => { x.spend(Math.min(x.c.money, $(x, 1000))); x.mods({ politicalApproval: 3, publicImage: 2 }); return 'Your name is carved on the plinth, slightly below the goose.'; } },
      { label: 'Propose the goose instead', tags: ['social', 'impulsive'], run: (x) => { x.mods({ popularity: 6, happiness: 4 }); return 'The town voted for the goose. It is now a tourist attraction.'; } },
      { label: 'Ignore it', tags: ['cautious'], run: () => 'The statue went up anyway. Pigeons enjoy it.' },
    ],
  },
  {
    id: 'fo_pollster', cat: 'politics', minAge: 18, years: [1936, 2300], weight: 0.5, cooldown: 6, scene: 'gadget',
    title: 'Opinion poll',
    text: () => `A pollster wants your opinion on the government, the economy and, inexplicably, cheese.`,
    choices: [
      { label: 'Answer honestly', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 1 }); return 'Your opinions are now 0.001% of a statistic. Democracy.'; } },
      { label: 'Give absurd answers', tags: ['impulsive'], run: (x) => { x.mods({ happiness: 3 }); return 'Next week\'s headline: "Shock rise in support for abolishing Tuesdays".'; } },
    ],
  },
  {
    id: 'fo_courtAudience', cat: 'politics', minAge: 18, years: [-800, 1900], weight: (x) => (x.stat('fame') > 25 || x.c.money > $(x, 200000) ? 0.6 : 0), once: true, scene: 'coronation',
    title: 'Summoned to court',
    text: () => `You are summoned before the ruler. Courtiers watch to see whether you will grovel, flatter or blunder.`,
    choices: [
      { label: 'Flatter shamelessly', tags: ['ambitious'], run: (x) => { x.train('etiquette', 4); x.mods({ politicalApproval: 6 }); return 'You compared the ruler to the sun. The ruler agreed.'; } },
      { label: 'Speak frankly', tags: ['impulsive'], run: (x) => { if (x.chance(0.4)) { x.mods({ politicalApproval: 10, fame: 4 }); return 'The ruler laughed and called you the only honest person at court.'; } x.mods({ politicalApproval: -8, fear: 8 }); return 'The silence afterwards was the longest of your life. You were dismissed.'; } },
      { label: 'Bring a lavish gift', tags: ['cautious'], scene: 'jewelry', run: (x) => { x.spend(Math.min(x.c.money, $(x, 20000))); x.mods({ politicalApproval: 7 }); return 'The gift was accepted. You were invited to the next hunt.'; } },
    ],
  },
];

// ==================================================================== CRIME & LAW
const crooked = (w: number) => (x: Ctx): number => (crook(x) ? w : 0);
const jailed = (w: number) => (x: Ctx): number => (x.inPrison ? w : 0);
const PR = (x: Ctx) => x.c.legal.prison!;

const CRIME: EventDef[] = [
  // --------------------------------------------------------- temptations
  {
    id: 'fo_openRegister', cat: 'crime', minAge: 14, weight: 0.8, cooldown: 5, scene: 'crime',
    title: 'Open till',
    text: (x) => `The ${shop(x)} keeper has stepped into the back. The till is open, full of money, and nobody is looking.`,
    choices: [
      { label: 'Grab a handful', tags: ['impulsive'], run: (x) => { const r = commitCrime(x, 'shoplift'); if (r.ok) x.money($(x, 150)); return r.ok ? 'You walked out calmly with your heart going like a drum.' : r.text; } },
      { label: 'Call out to them', tags: ['help', 'cautious'], run: (x) => { x.mods({ karma: 2 }); return 'The shopkeeper thanked you and gave you a free sweet. Honesty tastes of liquorice.'; } },
      { label: 'Just buy your thing', tags: ['cautious'], run: () => 'You waited, paid and left. A small, invisible victory.' },
    ],
  },
  {
    id: 'fo_wrongChange', cat: 'crime', minAge: 10, weight: 0.8, cooldown: 4, scene: 'shopping',
    title: 'Too much change',
    text: (x) => `The flustered cashier hands you ${x.fmt($(x, 40))} too much change.`,
    choices: [
      { label: 'Point it out', tags: ['help'], run: (x) => { x.mods({ karma: 2 }); return 'She sighed with relief. Her till would have been short.'; } },
      { label: 'Pocket it', tags: ['impulsive'], run: (x) => { x.money($(x, 40)); x.mods({ karma: -2 }); return 'A tiny windfall with a tiny aftertaste.'; } },
    ],
  },
  {
    id: 'fo_keysInIgnition', cat: 'crime', minAge: 16, years: [1910, 2040], weight: 0.6, cooldown: 6, scene: 'car',
    title: 'Keys left in',
    text: () => `A gleaming car is parked with the engine running and nobody in sight.`,
    choices: [
      { label: 'Take it for a spin', tags: ['impulsive'], scene: 'carChase', run: (x) => { const r = commitCrime(x, 'carTheft'); return r.ok ? 'You drove to the coast and back, then parked it exactly where it was. Mostly.' : r.text; } },
      { label: 'Turn it off and wait', tags: ['help'], run: (x) => { x.mods({ karma: 3 }); return 'The owner came running out of a bakery and nearly kissed you.'; } },
      { label: 'Walk on', tags: ['cautious'], run: () => 'Not your car, not your problem.' },
    ],
  },
  {
    id: 'fo_fallenTruck', cat: 'crime', minAge: 18, weight: 0.7, cooldown: 5, scene: 'smuggling',
    bind: (x) => stranger(x, { criminal: 60 }),
    title: 'Fell off a cart',
    text: (x) => `${who(x)} is selling ${x.year < 1950 ? 'bolts of silk' : x.year < 2000 ? 'video recorders' : 'brand-new phones'} at a tenth of the price. They "fell off the back of a ${x.year < 1920 ? 'cart' : 'lorry'}".`,
    choices: [
      { label: 'Buy one', tags: ['impulsive'], run: (x) => { x.spend($(x, 50)); x.mods({ sin: 1 }); if (x.chance(0.3)) return 'It was a box of bricks. Expertly weighted.'; return 'A bargain with a faint smell of crime.'; } },
      { label: 'Buy the lot to resell', tags: ['ambitious'], run: (x) => { if (!x.spend($(x, 1000))) return 'Too pricey even at crime prices.'; x.train('fencingGoods', 4); if (x.chance(0.7)) { x.money($(x, 2500)); return 'You resold the lot at a tidy profit. A career is calling.'; } openCase(x, 'smuggling', { mult: 0.5, label: 'Handling stolen goods' }); return 'One of your buyers was a policeman\'s wife.'; } },
      { label: 'Decline', tags: ['cautious'], run: () => '"Your loss," they shrugged. Was it, though?' },
    ],
  },
  {
    id: 'fo_insiderTip', cat: 'crime', minAge: 22, years: [1900, 2300], weight: (x) => (x.employed && x.stat('professionalRep') > 30 ? 0.6 : 0), cooldown: 8, scene: 'stocks',
    title: 'Overheard',
    text: () => `At work you overhear that a big merger will be announced on Monday. The share price will jump.`,
    choices: [
      { label: 'Buy shares now', tags: ['impulsive', 'ambitious'], run: (x) => { const s = Math.min(x.c.money, $(x, 10000)); x.spend(s); if (x.chance(0.75)) { x.money(s * 2); x.mods({ sin: 3 }); x.secret('fo_insider', 'Traded on inside information', 40); return 'Monday came. You doubled your money and checked the door all week.'; } openCase(x, 'fraud', { label: 'Insider trading' }); x.money(Math.round(s * 1.5)); return 'You made money, and the regulator made a file.'; } },
      { label: 'Tip off a friend', tags: ['social'], run: (x) => { x.mods({ sin: 2 }); return 'Your friend made a fortune and bought you a very nice lunch.'; } },
      { label: 'Forget you heard it', tags: ['cautious'], run: (x) => { x.mods({ karma: 2 }); return 'You resisted. Monday, the price jumped, and so did your blood pressure.'; } },
    ],
  },
  {
    id: 'fo_shopliftDare', cat: 'crime', minAge: 13, maxAge: 19, weight: 0.6, once: true, scene: 'shopping',
    title: 'Double dare',
    text: () => `Your friends dare you to steal something from the shop. Anything. They are all watching.`,
    choices: [
      { label: 'Do it', tags: ['impulsive'], run: (x) => { const r = commitCrime(x, 'shoplift'); x.mods({ popularity: r.ok ? 4 : -2 }); return r.ok ? 'You came out with a single lemon. Legendary, somehow.' : r.text; } },
      { label: 'Refuse', tags: ['cautious'], run: (x) => { x.mods({ confidence: 3, popularity: -2 }); return 'They called you boring. They also secretly respected you.'; } },
      { label: 'Buy it and pretend', tags: ['social'], run: (x) => { x.spend($(x, 2)); x.mods({ popularity: 3 }); return 'You bought it, hid the receipt and looked like a rebel. Genius.'; } },
    ],
  },
  // --------------------------------------------------------- victim
  {
    id: 'fo_burgled', cat: 'crime', minAge: 18, weight: (x) => 0.3 + x.w.crimeRate / 150, cooldown: 8, scene: 'crime',
    title: 'Burgled',
    text: () => `You come home to a broken window and drawers turned out. Someone has been through everything.`,
    choices: [
      { label: 'Call the police', tags: ['cautious'], scene: 'police', run: (x) => { const l = Math.min(x.c.money, $(x, 1500)); x.spend(l); x.mods({ anxiety: 5 }); if (x.chance(0.25)) { x.money(l); return 'They caught the thief selling your candlesticks. Everything back!'; } return `They took notes and ${x.fmt(l)} of your things stayed gone.`; } },
      { label: 'Ask around the streets', tags: ['ambitious'], run: (x) => { x.train('streetwise', 4); if (x.chance(0.4)) return 'The local grapevine returned your grandmother\'s ring for a small fee.'; x.mods({ stress: 4 }); return 'Nobody knew anything, loudly.'; } },
      { label: 'Change the locks', tags: ['cautious'], scene: 'house', run: (x) => { x.mods({ anxiety: -2, happiness: 3 }); x.spend($(x, 300)); return 'New locks, a bolt and a recording of a large dog barking on a loop.'; } },
    ],
  },
  {
    id: 'fo_mugged', cat: 'crime', minAge: 14, violent: true, weight: (x) => 0.2 + x.w.crimeRate / 200, cooldown: 8, scene: 'fight',
    title: 'Dark alley',
    text: () => `A figure steps out of the shadows. "Your money. Now." You can see the glint of a blade.`,
    choices: [
      { label: 'Hand it over', tags: ['cautious'], run: (x) => { const l = Math.min(x.c.money, $(x, 200)); x.spend(l); x.mods({ anxiety: 6, fear: 4 }); trauma(x, 4, 'violence'); return 'You handed it over. You were shaking for an hour, but you were safe.'; } },
      { label: 'Fight back', tags: ['violent'], run: (x) => { if (check(x, x.stat('fitness') + x.skill('selfDefense') + x.skill('streetFighting'), 90)) { x.mods({ confidence: 6, streetCred: 4 }); return 'You disarmed them and they fled. Your hands did not stop shaking all night.'; } x.log(injure(x, true), 'bad'); trauma(x, 8, 'violence'); return 'It went badly. They took your money and left you on the ground.'; } },
      { label: 'Run', tags: ['cautious'], run: (x) => { if (check(x, x.stat('fitness'), 50)) return 'You ran like never before and made it to a lit street.'; const l = Math.min(x.c.money, $(x, 200)); x.spend(l); x.mods({ fear: 5 }); return 'They caught your coat. You lost your wallet but nothing more.'; } },
    ],
  },
  {
    id: 'fo_carStolen', cat: 'crime', minAge: 18, years: [1910, 2300], weight: (x) => (x.c.items.length ? 0.4 : 0), cooldown: 10, scene: 'carChase',
    title: 'Where did I park?',
    text: () => `You walk to where you parked. There is nothing there but a puddle and some broken glass.`,
    choices: [
      { label: 'Report it', tags: ['cautious'], scene: 'police', run: (x) => { if (x.chance(0.4)) return 'It turned up two weeks later, clean, with a new air freshener.'; x.mods({ stress: 6 }); return 'It was never found. You take the bus now and resent everyone.'; } },
      { label: 'Track it yourself', tags: ['ambitious'], run: (x) => { if (x.chance(0.3)) { x.mods({ confidence: 5 }); return 'You found it outside a chop shop and drove it off under their noses.'; } return 'You spent a weekend looking at every car in the city.'; } },
    ],
  },
  {
    id: 'fo_identityStolen', cat: 'crime', minAge: 18, years: [1990, 2300], weight: 0.5, cooldown: 10, scene: 'hacker',
    title: 'Not you',
    text: () => `Your statement shows you bought a jet ski, three wigs and a llama in another country. You did not.`,
    choices: [
      { label: 'Call the bank', tags: ['cautious'], run: (x) => { x.mods({ stress: 6 }); return 'Six hours on hold and the charges were reversed. The llama remains a mystery.'; } },
      { label: 'Freeze everything', tags: ['cautious'], run: (x) => { x.train('cybersecurity', 3); x.mods({ stress: 3 }); return 'Safe, sensible and annoying for months.'; } },
      { label: 'Find the thief online', tags: ['ambitious'], run: (x) => { x.train('hacking', 3); if (x.chance(0.3)) { x.mods({ fame: 2 }); return 'You traced them and handed a neat dossier to the police. Detective energy.'; } return 'The trail went cold in a forum full of llama photos.'; } },
    ],
  },
  {
    id: 'fo_shellGame', cat: 'crime', minAge: 14, weight: 0.6, cooldown: 6, scene: 'casino',
    title: 'Find the pea',
    text: () => `A street hustler shuffles three cups. A man in the crowd just won twice. It looks so easy.`,
    choices: [
      { label: 'Play', tags: ['impulsive'], run: (x) => { const l = Math.min(x.c.money, $(x, 100)); x.spend(l); x.mods({ wisdom: 2 }); return 'The "lucky winner" was his cousin. The pea was in his sleeve.'; } },
      { label: 'Watch his hands', tags: ['cautious'], run: (x) => { x.train('streetwise', 3); x.train('pickpocketing', 1); return 'You spotted the palm. You now see cons everywhere.'; } },
      { label: 'Expose him', tags: ['help', 'social'], run: (x) => { x.mods({ karma: 2, popularity: 2 }); if (x.chance(0.3)) x.mods({ health: -3 }); return 'You shouted "It\'s in his sleeve!" The crowd scattered. So did he.'; } },
    ],
  },
  // --------------------------------------------------------- organised crime
  {
    id: 'fo_mobOffer', cat: 'crime', minAge: 17, maxAge: 45, weight: (x) => (!x.c.crime.orgName && (x.stat('streetCred') > 15 || x.w.crimeRate > 60) ? 0.8 : 0), cooldown: 8, scene: 'gangMeeting',
    title: 'A job offer',
    text: () => `A well-dressed man buys you a drink. "My employer likes people who keep their mouths shut. The pay is very good."`,
    choices: [
      { label: 'Take the job', tags: ['ambitious', 'impulsive'], run: (x) => { const ok = canJoinOrg(x); if (ok !== true) return `He looked you over and said: "${ok}". Maybe later.`; return joinOrg(x); } },
      { label: 'Do one small errand', tags: ['impulsive'], run: (x) => { x.money($(x, 2000)); x.mods({ criminalRep: 3, sin: 2 }); return 'You drove a parcel across town and did not look inside. You got paid.'; } },
      { label: 'Politely decline', tags: ['cautious'], run: (x) => { x.mods({ fear: 2 }); return '"Your choice," he said, and paid for your drink. That was the scary part.'; } },
    ],
  },
  {
    id: 'fo_protection', cat: 'crime', minAge: 20, weight: (x) => (x.employed && x.w.crimeRate > 40 ? 0.6 : 0.1), cooldown: 6, scene: 'gangMeeting',
    title: 'Protection money',
    text: (x) => `Two men visit your workplace. "Nice place. Shame if something happened to it." ${x.fmt($(x, 300))} a month keeps things nice.`,
    choices: [
      { label: 'Pay up', tags: ['cautious'], run: (x) => { x.spend(Math.min(x.c.money, $(x, 1200))); x.mods({ stress: 3 }); return 'Nothing happened to the place. Funny that.'; } },
      { label: 'Go to the police', tags: ['help'], scene: 'police', run: (x) => { if (x.chance(0.5)) { x.mods({ karma: 3 }); return 'The police raided the gang. Your neighbours bought you a cake.'; } x.mods({ fear: 8 }); return 'The police did nothing. Somebody broke your windows that night.'; } },
      { label: 'Stand up to them', tags: ['violent'], scene: 'fight', run: (x) => { if (check(x, x.stat('fitness') + x.stat('confidence'), 100)) { x.mods({ streetCred: 6 }); return 'You stared them down. They decided to try the bakery instead.'; } x.log(injure(x, true), 'bad'); return 'They did not like that. You paid anyway, with a black eye.'; } },
    ],
  },
  {
    id: 'fo_holdPackage', cat: 'crime', minAge: 18, weight: crooked(1), cooldown: 4, scene: 'gangMeeting',
    title: 'Hold this',
    text: () => `Someone you work with in the shadows asks you to keep a heavy package at your place for a week. Do not open it.`,
    choices: [
      { label: 'Keep it', tags: ['cautious'], run: (x) => { x.money($(x, 3000)); x.mods({ criminalRep: 3, stress: 3 }); if (x.chance(0.15)) openCase(x, 'smuggling', { mult: 0.6 }); return 'A week of side-eyeing a box. Then it was gone and you were richer.'; } },
      { label: 'Open it', tags: ['impulsive'], run: (x) => { x.mods({ paranoia: 4 }); x.secret('fo_package', 'Knows what was in the package', 35); return 'You looked. You wish you had not. You taped it back very carefully.'; } },
      { label: 'Refuse', tags: ['cautious'], run: (x) => { x.mods({ criminalRep: -2 }); return '"Fine," they said, and found someone less nervous.'; } },
    ],
  },
  {
    id: 'fo_mobDebt', cat: 'crime', minAge: 18, weight: (x) => (x.c.crime.orgName && x.c.money < $(x, 5000) ? 0.8 : 0), cooldown: 6, scene: 'gangMeeting',
    title: 'You owe the family',
    text: (x) => `The boss reminds you that a shipment you handled came up short. You owe the family ${x.fmt($(x, 15000))}.`,
    choices: [
      { label: 'Pay with dirty money', tags: ['cautious'], when: (x) => x.c.crime.dirtyMoney >= $(x, 15000), run: (x) => { x.c.crime.dirtyMoney -= $(x, 15000); x.c.crime.orgLoyalty = Math.min(100, x.c.crime.orgLoyalty + 5); return 'Paid. The boss pinched your cheek. Terrifying.'; } },
      { label: 'Work it off', tags: ['ambitious'], run: (x) => { x.mods({ criminalRep: 5, stress: 8, heat: 6 }); x.c.crime.orgLoyalty = Math.min(100, x.c.crime.orgLoyalty + 3); return 'Six months of dangerous errands. You are square, and much older inside.'; } },
      { label: 'Blame someone else', tags: ['impulsive'], run: (x) => { if (x.chance(0.5)) { x.mods({ sin: 4 }); return 'Someone else took the fall. You do not ask where they went.'; } x.log(injure(x, true), 'bad'); x.c.crime.orgLoyalty = Math.max(0, x.c.crime.orgLoyalty - 15); return 'The boss knew. The lesson was painful and brief.'; } },
    ],
  },
  {
    id: 'fo_heistCrew', cat: 'crime', minAge: 18, weight: crooked(0.8), cooldown: 5, scene: 'gangMeeting',
    title: 'One last job',
    text: (x) => `A crew is planning to hit ${x.year < 1800 ? "a merchant's strongroom" : x.year < 1950 ? 'a bank vault' : 'an armoured truck'}. They need one more person they can trust.`,
    choices: [
      { label: 'Plan it carefully', tags: ['ambitious'], scene: 'crime', run: (x) => { x.train('heistPlanning', 5); const r = commitCrime(x, x.year >= 1800 ? 'bankRobbery' : 'burglary'); if (r.ok) { x.c.crime.dirtyMoney += $(x, 60000); x.mods({ criminalRep: 8 }); return `Clean as a whistle. Your cut: ${x.fmt($(x, 60000))} in dirty cash.`; } return r.text; } },
      { label: 'Drive the getaway', tags: ['impulsive'], scene: 'carChase', run: (x) => { x.train('getawayDriving', 5); if (check(x, x.skill('getawayDriving') + x.stat('dexterity'), 60)) { x.c.crime.dirtyMoney += $(x, 30000); x.mods({ criminalRep: 5 }); return 'You lost the pursuit in six minutes flat.'; } openCase(x, 'armedRobbery', { mult: 1.2 }); return 'A roadblock. The crew scattered. Your name is in a file.'; } },
      { label: 'Sit this one out', tags: ['cautious'], run: (x) => { if (x.chance(0.4)) return 'The crew got caught. You watched the news with enormous relief.'; return 'The job went fine without you. They bought nicer cars than yours.'; } },
    ],
  },
  {
    id: 'fo_longCon', cat: 'crime', minAge: 20, weight: crooked(0.8), cooldown: 5, scene: 'bribe',
    bind: (x) => stranger(x, { age: x.int(50, 75), wealth: 3000000 }),
    title: 'The mark',
    text: (x) => `${whoFull(x)} is rich, lonely and loves the idea of investing in a ${x.year < 1900 ? 'silver mine' : x.year < 2000 ? 'Florida swamp development' : 'revolutionary battery startup'} that does not exist.`,
    choices: [
      { label: 'Run the con', tags: ['ambitious'], run: (x) => { x.train('fraud', 5); x.train('deception', 3); const r = commitCrime(x, 'fraud', npcId(x)); if (r.ok) { x.money($(x, 80000)); x.mods({ sin: 5, karma: -6 }); return `${who(x)} signed the cheque with a smile. You did not look at the smile for long.`; } return r.text; } },
      { label: 'Scale it down', tags: ['cautious'], run: (x) => { if (x.chance(0.7)) { x.money($(x, 15000)); x.mods({ sin: 2 }); return 'A small taste. Small enough that no one calls the police.'; } openCase(x, 'fraud', { mult: 0.6 }); return 'Even small lies have long legs.'; } },
      { label: 'Let them be', tags: ['help'], run: (x) => { x.mods({ karma: 4 }); x.addRel(npcId(x), 'friend', { affinity: 20 }); return `You had tea with ${who(x)} instead. Their stories were worth more than the money.`; } },
    ],
  },
  {
    id: 'fo_snitchOffer', cat: 'crime', minAge: 18, weight: (x) => (crook(x) && x.c.legal.cases.length ? 1 : crook(x) ? 0.3 : 0), cooldown: 6, scene: 'interview',
    title: 'Off the record',
    text: () => `A detective buys you a coffee. "We know what you are. Give us someone bigger and your troubles go away."`,
    choices: [
      { label: 'Become an informant', tags: ['cautious'], run: (x) => { for (const k of x.c.legal.cases) k.evidence = Math.max(0, k.evidence - 30); x.mods({ fear: 8, paranoia: 8, heat: -15 }); x.secret('fo_informant', 'Secretly informs for the police', 70); return 'Your cases cooled. Your nights got longer.'; } },
      { label: 'Feed them lies', tags: ['ambitious'], run: (x) => { x.train('deception', 4); if (x.chance(0.5)) { x.mods({ heat: -8 }); return 'You sent them chasing ghosts. Masterful.'; } x.mods({ heat: 12 }); return 'They checked. Now they are angry and interested.'; } },
      { label: 'Say nothing', tags: ['cautious'], run: (x) => { x.mods({ streetCred: 4 }); return 'You finished the coffee and left. The detective laughed. "We will talk again."'; } },
    ],
  },
  {
    id: 'fo_rivalCrew', cat: 'crime', minAge: 18, violent: true, weight: (x) => (x.c.crime.orgName ? 0.9 : 0), cooldown: 5, scene: 'gangMeeting',
    title: 'Rival crew',
    text: () => `A rival crew has been selling on your corners. The boss wants it handled, one way or another.`,
    choices: [
      { label: 'Negotiate a border', tags: ['cautious'], run: (x) => { x.train('negotiation', 4); if (x.chance(0.6)) { x.mods({ criminalRep: 4 }); return 'You drew a line on a napkin. Both sides signed. Gangland diplomacy.'; } return 'They laughed at the napkin.'; } },
      { label: 'Run them off', tags: ['violent'], scene: 'fight', run: (x) => { const r = commitCrime(x, 'assault'); if (r.ok) { x.c.crime.territory += 1; x.mods({ criminalRep: 6, streetCred: 6 }); return 'They left, and the corners were yours again.'; } return r.text; } },
      { label: 'Ally with them', tags: ['ambitious'], run: (x) => { x.c.crime.orgLoyalty = Math.max(0, x.c.crime.orgLoyalty - 10); x.money($(x, 10000)); return 'A secret deal. Profitable, and very dangerous if the boss finds out.'; } },
    ],
  },
  {
    id: 'fo_counterfeitPress', cat: 'crime', minAge: 20, years: [1600, 2300], weight: crooked(0.6), cooldown: 8, scene: 'laundering',
    title: 'Printing money',
    text: () => `An old engraver offers to sell you his counterfeiting plates. "Best work of my life. Shame to waste it."`,
    choices: [
      { label: 'Buy the plates', tags: ['ambitious'], run: (x) => { if (!x.spend($(x, 8000))) return 'He wanted real money for fake money. Ironic, and unaffordable.'; x.train('counterfeiting', 6); const r = commitCrime(x, 'counterfeiting'); if (r.ok) x.c.crime.dirtyMoney += $(x, 40000); return r.ok ? 'Your first batch was perfect. Even the king looked handsome.' : r.text; } },
      { label: 'Turn him in', tags: ['help'], scene: 'police', run: (x) => { x.mods({ heat: -5, criminalRep: -4 }); return 'The police were grateful. The underworld was not.'; } },
      { label: 'Pass', tags: ['cautious'], run: () => 'Some crimes are too much hard work.' },
    ],
  },
  {
    id: 'fo_launderOffer', cat: 'crime', minAge: 20, weight: (x) => (x.c.crime.dirtyMoney > $(x, 10000) ? 1 : 0), cooldown: 4, scene: 'laundering',
    bind: (x) => stranger(x, { criminal: 50 }),
    title: 'Clean sheets',
    text: (x) => `${whoFull(x)}, who owns ${x.year < 1950 ? 'a laundry' : x.year < 2010 ? 'a car wash' : 'a chain of nail salons'}, offers to clean some of your dirty money for a 25% cut.`,
    choices: [
      { label: 'Deal', tags: ['ambitious'], scene: 'laundering', run: (x) => { const a = Math.min(x.c.crime.dirtyMoney, $(x, 40000)); x.c.crime.dirtyMoney -= a; x.money(Math.round(a * 0.75)); x.train('moneyLaundering', 4); if (x.chance(0.1)) openCase(x, 'moneyLaundering'); return `${x.fmt(Math.round(a * 0.75))} came back sparkling clean.`; } },
      { label: 'Haggle to 15%', tags: ['social'], run: (x) => { const a = Math.min(x.c.crime.dirtyMoney, $(x, 20000)); if (check(x, x.skill('negotiation'), 40)) { x.c.crime.dirtyMoney -= a; x.money(Math.round(a * 0.85)); return 'Fifteen percent. A professional discount.'; } return 'They walked. Dirty money stays dirty.'; } },
      { label: 'Decline', tags: ['cautious'], run: () => 'You do not trust anyone with your shame.' },
    ],
  },
  // --------------------------------------------------------- legal
  {
    id: 'fo_juryDuty', cat: 'legal', minAge: 21, years: [1700, 2300], weight: 0.6, cooldown: 8, scene: 'court',
    title: 'Jury duty',
    text: () => `You have been called for jury duty. The defendant looks terrified. The evidence is thin, but the other eleven jurors want to go home.`,
    choices: [
      { label: 'Hold out for the truth', tags: ['help'], run: (x) => { x.train('conflictResolution', 3); x.mods({ karma: 5, stress: 4 }); x.remember('juror', 'Held out on a jury', 30); return 'Three days of arguing. The defendant walked free and nodded at you.'; } },
      { label: 'Go with the majority', tags: ['cautious'], run: (x) => { x.mods({ wisdom: -1 }); x.remember('juror', 'Sat on a jury', 20); return 'Guilty, in time for lunch. You think about it sometimes.'; } },
      { label: 'Claim a conflict', tags: ['impulsive'], run: () => 'You claimed you were related to the judge. You were excused, suspiciously.' },
    ],
  },
  {
    id: 'fo_juryApproach', cat: 'legal', minAge: 21, years: [1700, 2300], weight: (x) => (x.hasMemory('juror') ? 0.6 : 0), once: true, scene: 'bribe',
    title: 'A visitor',
    text: (x) => `During another trial you sit on, a stranger at your gate offers ${x.fmt($(x, 20000))} if the verdict goes "the right way".`,
    choices: [
      { label: 'Report it to the judge', tags: ['help', 'cautious'], scene: 'court', run: (x) => { x.mods({ karma: 6, publicImage: 3 }); return 'A mistrial and a new case for jury tampering. Justice, slowly.'; } },
      { label: 'Take the money', tags: ['impulsive'], run: (x) => { x.money($(x, 20000)); x.mods({ sin: 6, corruption: 5 }); x.secret('fo_juryBribe', 'Took a bribe as a juror', 60); return 'You voted their way. The money felt heavier than it should.'; } },
      { label: 'Close the gate', tags: ['cautious'], run: (x) => { x.mods({ anxiety: 3 }); return 'You said nothing and voted honestly. You checked the locks twice.'; } },
    ],
  },
  {
    id: 'fo_treeDispute', cat: 'legal', minAge: 20, weight: 0.7, cooldown: 6, scene: 'argument',
    bind: (x) => relOrStranger(x, ['acquaintance']),
    title: 'The neighbour\'s tree',
    text: (x) => `Your neighbour ${whoFull(x)} says your tree drops leaves on their property and is threatening to sue.`,
    choices: [
      { label: 'Trim the tree', tags: ['cautious', 'help'], scene: 'gardening', run: (x) => { x.spend($(x, 200)); x.relMod(npcId(x), 6); return 'The tree looks sad. The neighbour looks smug. Peace reigns.'; } },
      { label: 'See you in court', tags: ['impulsive'], scene: 'court', run: (x) => { x.spend(Math.min(x.c.money, $(x, 3000))); x.relMod(npcId(x), -20); if (x.chance(0.5)) return 'You won. The judge called it "the dullest case of my career".'; x.spend(Math.min(x.c.money, $(x, 2000))); return 'You lost. The tree came down and you paid for the saw.'; } },
      { label: 'Invite them for dinner', tags: ['social'], scene: 'restaurant', run: (x) => { x.relMod(npcId(x), 12, 8); return 'Over wine they admitted they just felt lonely. The tree stays.'; } },
    ],
  },
  {
    id: 'fo_slipLawsuit', cat: 'legal', minAge: 22, years: [1850, 2300], weight: (x) => (x.c.money > $(x, 30000) ? 0.6 : 0.1), cooldown: 8, scene: 'court',
    title: 'Slip and sue',
    text: (x) => `A delivery man slipped on your front step and is suing you for ${x.fmt($(x, 50000))}. His lawyer advertises on buses.`,
    choices: [
      { label: 'Settle quietly', tags: ['cautious'], run: (x) => { const a = Math.min(x.c.money, $(x, 12000)); x.spend(a); return `You settled for ${x.fmt(a)}. The step now has a rail.`; } },
      { label: 'Fight it', tags: ['ambitious'], run: (x) => { x.spend(Math.min(x.c.money, $(x, 5000))); if (x.chance(0.55)) return 'The court found he was dancing at the time. Case dismissed.'; const a = Math.min(x.c.money, $(x, 30000)); x.spend(a); return `You lost ${x.fmt(a)}. The bus lawyer waved at you.`; } },
      { label: 'Hire a private eye', tags: ['ambitious'], run: (x) => { x.spend(Math.min(x.c.money, $(x, 2000))); if (x.chance(0.5)) return 'Photos showed him water-skiing the next week. Case dropped.'; return 'The detective mostly photographed pigeons. You settled.'; } },
    ],
  },
  {
    id: 'fo_fineprint', cat: 'legal', minAge: 18, weight: 0.6, cooldown: 6, scene: 'office',
    title: 'Fine print',
    text: (x) => `You are about to sign a ${x.year < 1900 ? 'lease for a market stall' : 'contract for a new flat'}. The fine print is very fine.`,
    choices: [
      { label: 'Read every word', tags: ['cautious'], run: (x) => { x.train('law', 2); x.mods({ wisdom: 2 }); return 'Clause 41 gave the landlord your firstborn goat. You crossed it out.'; } },
      { label: 'Just sign', tags: ['impulsive'], run: (x) => { if (x.chance(0.3)) { x.spend(Math.min(x.c.money, $(x, 2000))); return 'Hidden fees appeared like mushrooms after rain.'; } return 'It was fine. This time.'; } },
      { label: 'Get a lawyer to check', tags: ['cautious'], run: (x) => { x.spend($(x, 300)); return 'The lawyer found three traps and one typo that made it legally a poem.'; } },
    ],
  },
  {
    id: 'fo_witness', cat: 'legal', minAge: 16, weight: 0.5, cooldown: 8, scene: 'crime',
    bind: (x) => stranger(x, { criminal: 70, aggression: 60 }),
    title: 'You saw it',
    text: (x) => `You witnessed ${whoFull(x)} rob a shopkeeper. The police want a statement. ${who(x)}'s friends are watching you.`,
    choices: [
      { label: 'Testify', tags: ['help'], scene: 'court', run: (x) => { x.mods({ karma: 6, fear: 5 }); x.addRel(npcId(x), 'enemy', { affinity: -40 }); x.chain('fo_witnessChain', 0, { npcId: npcId(x) }); return 'Your testimony put them away. The courtroom was very quiet as you left.'; } },
      { label: 'Give an anonymous tip', tags: ['cautious', 'help'], run: (x) => { x.mods({ karma: 3 }); return 'You called from a payphone with a terrible accent. It worked.'; } },
      { label: 'See nothing', tags: ['cautious'], run: (x) => { x.mods({ karma: -3, depression: 2 }); return 'You saw nothing. The shopkeeper\'s face stays with you.'; } },
    ],
  },
  {
    id: 'fo_witnessThreat', cat: 'legal', triggered: true, scene: 'jealousy',
    title: 'A message',
    text: (x) => `A note through your door: "${x.first(npcId(x))} gets out soon. Remember who talked."`,
    choices: [
      { label: 'Tell the police', tags: ['cautious'], scene: 'police', run: (x) => { x.mods({ fear: 4 }); return 'They put a patrol car outside for a month. Nothing happened. Probably.'; } },
      { label: 'Move away', tags: ['cautious'], scene: 'moving', run: (x) => { x.mods({ stress: 6, anxiety: -2 }); return 'New town, new street, new locks.'; } },
      { label: 'Stand your ground', tags: ['impulsive'], run: (x) => { x.mods({ confidence: 4, anxiety: 6 }); return 'You stayed. You will not be scared out of your own home.'; } },
    ],
  },
  {
    id: 'fo_mistakenIdentity', cat: 'legal', minAge: 18, years: [1850, 2300], weight: 0.3, cooldown: 15, scene: 'police',
    title: 'Wrong person',
    text: () => `Police grab you on the street. You match the description of a wanted forger: "medium height, has a face".`,
    choices: [
      { label: 'Stay calm and explain', tags: ['cautious'], run: (x) => { x.mods({ stress: 6 }); return 'Eight hours in a cell, then a mumbled apology. Your face is cleared.'; } },
      { label: 'Demand a lawyer', tags: ['ambitious'], run: (x) => { x.spend(Math.min(x.c.money, $(x, 500))); if (x.chance(0.4)) { x.money($(x, 10000)); return 'Your lawyer turned it into a wrongful arrest settlement.'; } return 'Released in an hour. The lawyer\'s bill arrived in thirty minutes.'; } },
      { label: 'Make a run for it', tags: ['impulsive'], scene: 'carChase', run: (x) => { openCase(x, 'assault', { mult: 0.4, label: 'Resisting arrest' }); return 'Running made you look guilty. Now you are wanted for running.'; } },
    ],
  },
  {
    id: 'fo_willDispute', cat: 'legal', minAge: 25, weight: (x) => (x.hasMemory('inheritance') || x.rels('sibling').length ? 0.4 : 0), cooldown: 10, scene: 'court',
    bind: (x) => relOrStranger(x, ['sibling', 'inLaw']),
    title: 'Contesting the will',
    text: (x) => `${whoFull(x)} is contesting a family will, claiming the old house should be theirs alone.`,
    choices: [
      { label: 'Split it fairly', tags: ['help'], run: (x) => { x.relMod(npcId(x), 8, 5); x.money($(x, 20000)); return 'Half each. Nobody happy, nobody bitter. Mostly.'; } },
      { label: 'Fight in court', tags: ['ambitious'], run: (x) => { x.spend(Math.min(x.c.money, $(x, 10000))); x.relMod(npcId(x), -30, -30); if (x.chance(0.5)) { x.money($(x, 60000)); return 'You won the house and lost a relative.'; } return 'The lawyers got the house, more or less.'; } },
      { label: 'Let them have it', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), 15, 10); x.mods({ karma: 4 }); return 'Peace was worth more than bricks. Probably.'; } },
    ],
  },
  {
    id: 'fo_smallClaims', cat: 'legal', minAge: 20, years: [1800, 2300], weight: 0.5, cooldown: 6, scene: 'court',
    bind: (x) => stranger(x),
    title: 'Small claims',
    text: (x) => `${whoFull(x)} never paid you the ${x.fmt($(x, 1500))} for work you did. You could take them to small claims court.`,
    choices: [
      { label: 'Take them to court', tags: ['ambitious'], run: (x) => { if (x.chance(0.65)) { x.money($(x, 1500)); x.train('law', 2); return 'You won. The judge was crisp and brilliant. You want to be her.'; } return 'They produced a receipt you have never seen. You lost.'; } },
      { label: 'Send a firm letter', tags: ['cautious'], run: (x) => { if (x.chance(0.4)) { x.money($(x, 1500)); return 'Your letter used the word "forthwith". It worked.'; } return 'No reply. You frame the letter instead.'; } },
      { label: 'Write it off', tags: ['cautious'], run: (x) => { x.mods({ stress: -1 }); return 'Life is short. Debts are long. You let it go.'; } },
    ],
  },
  {
    id: 'fo_stolenWork', cat: 'legal', minAge: 18, years: [1800, 2300], weight: (x) => (x.stat('creativity') > 50 ? 0.6 : 0.1), cooldown: 8, scene: 'court',
    title: 'Stolen idea',
    text: (x) => `Your ${x.pick(['song', 'design', 'story', 'invention'])} has turned up under someone else's name, making them a lot of money.`,
    choices: [
      { label: 'Sue for copyright', tags: ['ambitious'], run: (x) => { x.spend(Math.min(x.c.money, $(x, 8000))); if (x.chance(0.5)) { const a = x.money($(x, 90000)); x.mods({ professionalRep: 4 }); return `You proved it was yours. ${x.fmt(a)} in damages.`; } return 'You could not prove the date. Lesson learned: post it to yourself.'; } },
      { label: 'Go public', tags: ['social'], scene: 'scandal', run: (x) => { x.mods({ fame: 4 }); x.story('allegation', 'Creator accuses rival of theft', 5); return 'The public took your side. The thief looked very small.'; } },
      { label: 'Make something better', tags: ['cautious'], run: (x) => { x.mods({ creativity: 4, resilience: 3 }); return 'You poured the anger into new work. It was better.'; } },
    ],
  },
  {
    id: 'fo_noiseFeud', cat: 'legal', minAge: 18, weight: 0.6, cooldown: 6, scene: 'argument',
    bind: (x) => stranger(x),
    title: 'Noise complaint',
    text: (x) => `${whoFull(x)} next door practises the ${x.year < 1900 ? 'bagpipes' : 'drums'} at midnight. Every night.`,
    choices: [
      { label: 'Knock and ask nicely', tags: ['social'], run: (x) => { x.addRel(npcId(x), 'acquaintance', { affinity: 5 }); return 'They apologised. They now practise at 11:45, which is technically progress.'; } },
      { label: 'Report to the authorities', tags: ['cautious'], run: (x) => { x.addRel(npcId(x), 'rival', { affinity: -10 }); return 'A warning was issued. Now they glare at you over the hedge.'; } },
      { label: 'Fight noise with noise', tags: ['impulsive'], scene: 'music', run: (x) => { x.train('music', 3); x.mods({ happiness: 3 }); return 'You bought a trumpet. The street declared war. You are learning fast.'; } },
    ],
  },
  // --------------------------------------------------------- prison life
  {
    id: 'fo_pr_cellmate', cat: 'legal', prison: true, minAge: 14, weight: jailed(1.5), cooldown: 2, scene: 'prison',
    bind: (x) => stranger(x, { age: x.int(19, 60), gender: x.c.gender, criminal: 70 }),
    title: 'New cellmate',
    text: (x) => `Your new cellmate ${whoFull(x)} sizes you up silently, then asks if you play ${x.year < 1900 ? 'dice' : 'chess'}.`,
    choices: [
      { label: 'Play', tags: ['social'], run: (x) => { x.addRel(npcId(x), 'cellmate', { affinity: 20, trust: 10 }); x.mods({ loneliness: -6 }); return `${who(x)} cheats terribly and laughs about it. You might survive this place.`; } },
      { label: 'Set boundaries', tags: ['cautious'], run: (x) => { x.addRel(npcId(x), 'cellmate', { affinity: 0, trust: 5 }); x.mods({ confidence: 2 }); return 'Top bunk is yours. The truce holds.'; } },
      { label: 'Ask what they did', tags: ['impulsive'], run: (x) => { x.addRel(npcId(x), 'cellmate', { affinity: -10 }); x.mods({ fear: 3 }); return 'They stared until you looked away. You never asked again.'; } },
    ],
  },
  {
    id: 'fo_pr_yard', cat: 'legal', prison: true, minAge: 14, violent: true, weight: jailed(1.2), cooldown: 2, scene: 'prison',
    title: 'Yard politics',
    text: () => `In the yard, the groups keep to their own corners. A tattooed leader beckons you over to his bench.`,
    choices: [
      { label: 'Join his crew', tags: ['ambitious'], run: (x) => { const P = PR(x); P.gang = P.gang ?? 'the Bench'; P.rank += 1; x.mods({ streetCred: 5, fear: -4 }); return 'You have protection now. You also have obligations.'; } },
      { label: 'Stay neutral', tags: ['cautious'], run: (x) => { x.mods({ anxiety: 3 }); return 'You nodded respectfully and kept walking. Neutral is lonely, but safe-ish.'; } },
      { label: 'Stand your ground', tags: ['violent'], scene: 'fight', run: (x) => { if (check(x, x.stat('fitness') + x.skill('streetFighting'), 85)) { x.mods({ streetCred: 10 }); return 'You did not back down. Word travelled. They left you alone.'; } x.log(injure(x, true), 'bad'); PR(x).goodBehavior = Math.max(0, PR(x).goodBehavior - 10); return 'It ended in the infirmary and solitary.'; } },
    ],
  },
  {
    id: 'fo_pr_letter', cat: 'legal', prison: true, weight: jailed(1.2), cooldown: 1, scene: 'loveLetter',
    bind: (x) => { const r = x.rels('parent', 'sibling', 'child', 'friend', 'bestFriend', 'spouse', 'partner'); return r.length ? { npcId: x.pick(r).npcId } : null; },
    title: 'Mail call',
    text: (x) => `A letter from ${whoFull(x)}. You recognise the handwriting before the name.`,
    choices: [
      { label: 'Write back honestly', tags: ['help'], run: (x) => { x.relMod(npcId(x), 8, 6); x.mods({ loneliness: -8, happiness: 4 }); return 'Four pages. You said things you never said outside.'; } },
      { label: 'Pretend all is fine', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), 3); x.mods({ stress: 2 }); return '"The food is great!" you wrote. It is not.'; } },
      { label: 'Leave it unopened', tags: ['impulsive'], scene: 'lonely', run: (x) => { x.mods({ loneliness: 6, depression: 3 }); return 'It sits on your shelf. You cannot face it yet.'; } },
    ],
  },
  {
    id: 'fo_pr_parole', cat: 'legal', prison: true, weight: (x) => (x.inPrison && PR(x).served >= PR(x).sentence / 3 && PR(x).sentence - PR(x).served >= 1 ? 1.5 : 0), cooldown: 2, scene: 'court',
    title: 'Parole hearing',
    text: (x) => `The parole board shuffles your file. ${PR(x).goodBehavior > 50 ? 'Your record inside is good.' : 'Your record inside is... colourful.'}`,
    choices: [
      { label: 'Show genuine remorse', tags: ['cautious'], run: (x) => { if (x.chance(0.3 + PR(x).goodBehavior / 200)) { release(x, 'Released on parole', 2); x.mods({ happiness: 15 }); return 'Granted. You walked out into a sky that seemed impossibly big.'; } x.mods({ depression: 4 }); return 'Denied. "Come back in two years."'; } },
      { label: 'Talk up your plans', tags: ['ambitious'], run: (x) => { if (check(x, x.stat('charisma') + PR(x).goodBehavior / 2, 75)) { release(x, 'Released on parole', 3); return 'Your plan for a bakery won them over. Now you have to open a bakery.'; } return 'They found your plans "unrealistic". Denied.'; } },
      { label: 'Argue your innocence', tags: ['impulsive'], run: (x) => { x.mods({ ego: 2 }); return 'The board does not like being told they are wrong. Denied.'; } },
    ],
  },
  {
    id: 'fo_pr_job', cat: 'legal', prison: true, weight: jailed(1.2), cooldown: 3, scene: 'prison',
    title: 'Prison job',
    text: () => `A job opens up. Pay is pennies, but it fills the days.`,
    choices: [
      { label: 'Kitchen', tags: ['social'], scene: 'cooking', run: (x) => { x.train('cooking', 6); PR(x).goodBehavior += 5; return 'You stir vats of porridge and learn who likes extra.'; } },
      { label: 'Library', tags: ['cautious'], scene: 'library', run: (x) => { x.train('literacy', 4); x.mods({ smarts: 2 }); PR(x).goodBehavior += 5; return 'Quiet, warm, and full of escape that is legal.'; } },
      { label: 'Laundry', tags: ['ambitious'], scene: 'laundering', run: (x) => { PR(x).guardFavor += 4; x.mods({ fitness: 2 }); return 'Hot work, but you hear every secret that passes through the sheets.'; } },
    ],
  },
  {
    id: 'fo_pr_contraband', cat: 'legal', prison: true, weight: jailed(1), cooldown: 2, scene: 'bribe',
    title: 'Contraband',
    text: () => `A guard offers to bring in "anything you like" for a price: snacks, a radio, or worse.`,
    choices: [
      { label: 'Just some snacks', tags: ['cautious'], run: (x) => { x.spend(Math.min(x.c.money, $(x, 50))); x.mods({ happiness: 4 }); PR(x).guardFavor += 3; return 'Chocolate never tasted this good.'; } },
      { label: 'Run a smuggling line', tags: ['ambitious'], run: (x) => { x.train('borderSmuggling', 3); if (x.chance(0.6)) { x.c.crime.dirtyMoney += $(x, 3000); x.mods({ streetCred: 5 }); return 'You became the cell-block shopkeeper. Business is booming.'; } PR(x).goodBehavior = Math.max(0, PR(x).goodBehavior - 20); return 'A shakedown found your stash. Solitary for a month.'; } },
      { label: 'Refuse', tags: ['cautious'], run: (x) => { PR(x).goodBehavior += 3; return 'The guard shrugged. You keep your nose clean.'; } },
    ],
  },
  {
    id: 'fo_pr_riot', cat: 'legal', prison: true, violent: true, weight: jailed(0.5), cooldown: 5, scene: 'riot',
    title: 'Lockdown',
    text: () => `Shouting, alarms, smoke. A riot has broken out on your wing.`,
    choices: [
      { label: 'Barricade your cell', tags: ['cautious'], run: (x) => { x.mods({ fear: 6 }); trauma(x, 3, 'violence'); return 'You waited it out under your bunk. It was the longest night.'; } },
      { label: 'Protect an old inmate', tags: ['help'], run: (x) => { x.mods({ karma: 6, streetCred: 4 }); PR(x).goodBehavior += 10; return 'You got an old man to safety. The guards noticed.'; } },
      { label: 'Join in', tags: ['violent', 'impulsive'], scene: 'fight', run: (x) => { x.log(injure(x, true), 'bad'); PR(x).sentence += 1; return 'They added a year to your sentence and a scar to your collection.'; } },
    ],
  },
  {
    id: 'fo_pr_class', cat: 'legal', prison: true, weight: jailed(1), cooldown: 3, scene: 'classroom',
    title: 'Education program',
    text: () => `A volunteer teacher runs classes in the chapel. Nobody expects much from the students.`,
    choices: [
      { label: 'Sign up', tags: ['ambitious'], run: (x) => { x.mods({ smarts: 4, wisdom: 3, confidence: 3 }); x.train('literacy', 4); PR(x).goodBehavior += 8; return 'You passed the course. The teacher cried a little at the ceremony.'; } },
      { label: 'Teach others to read', tags: ['help'], when: (x) => x.stat('smarts') > 50, run: (x) => { x.mods({ karma: 6, happiness: 5 }); x.train('mentoring', 4); PR(x).goodBehavior += 10; return 'A man of fifty read his grandson\'s letter alone for the first time.'; } },
      { label: 'Skip it', tags: ['cautious'], run: () => 'You stayed in your cell and counted ceiling cracks. Again.' },
    ],
  },
  {
    id: 'fo_pr_visit', cat: 'legal', prison: true, weight: jailed(1), cooldown: 2, scene: 'reunion',
    bind: (x) => { const r = x.rels('parent', 'sibling', 'child', 'spouse', 'partner', 'bestFriend'); return r.length ? { npcId: x.pick(r).npcId } : null; },
    title: 'Visiting day',
    text: (x) => `${whoFull(x)} sits across the table under the guard's eye. Thirty minutes.`,
    choices: [
      { label: 'Talk about the future', tags: ['help'], run: (x) => { x.relMod(npcId(x), 8, 5); x.mods({ happiness: 5, depression: -3 }); return 'You made plans. Little ones. They kept you going for months.'; } },
      { label: 'Apologise', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), 10, 8); x.mods({ empathy: 3 }); return 'You said sorry. They held your hand across the table until the guard coughed.'; } },
      { label: 'Ask them not to come again', tags: ['impulsive'], scene: 'lonely', run: (x) => { x.relMod(npcId(x), -5); x.mods({ loneliness: 8 }); return 'You could not bear them seeing you here. They cried in the car.'; } },
    ],
  },
  {
    id: 'fo_pr_snitch', cat: 'legal', prison: true, weight: jailed(0.8), cooldown: 3, scene: 'interview',
    title: 'The warden\'s offer',
    text: () => `The warden calls you in. Tell him who is running drugs on the wing, and he will put in a good word with the parole board.`,
    choices: [
      { label: 'Give him a name', tags: ['ambitious'], run: (x) => { PR(x).goodBehavior += 20; x.mods({ fear: 10, paranoia: 6 }); return 'The board will hear good things. The wing will hear other things.'; } },
      { label: 'Stay silent', tags: ['cautious'], run: (x) => { x.mods({ streetCred: 5 }); return 'You said nothing. Inside, silence is a kind of currency.'; } },
      { label: 'Give him a fake name', tags: ['impulsive'], run: (x) => { if (x.chance(0.5)) { PR(x).goodBehavior += 5; return 'He wasted a week chasing nobody. You found it very funny.'; } PR(x).goodBehavior = Math.max(0, PR(x).goodBehavior - 15); return 'The warden checked. He was not amused.'; } },
    ],
  },
  {
    id: 'fo_pr_talent', cat: 'legal', prison: true, weight: jailed(0.6), cooldown: 4, scene: 'stage',
    title: 'Talent night',
    text: () => `The prison holds a talent night in the gym. The audience is tough.`,
    choices: [
      { label: 'Sing', tags: ['social'], scene: 'karaoke', run: (x) => { if (check(x, x.skill('singing') + x.stat('confidence'), 60)) { x.mods({ happiness: 8, streetCred: 3 }); return 'The hardest man on the block wiped away a tear.'; } x.mods({ happiness: 2 }); return 'You were bad, but brave. They clapped for brave.'; } },
      { label: 'Do stand-up', tags: ['impulsive'], run: (x) => { x.train('comedy', 4); x.mods({ popularity: 4 }); return 'Your joke about the porridge brought the house down.'; } },
      { label: 'Watch', tags: ['cautious'], run: (x) => { x.mods({ happiness: 3 }); return 'A juggler with four oranges. Unforgettable.'; } },
    ],
  },
  {
    id: 'fo_pr_garden', cat: 'legal', prison: true, weight: jailed(0.8), cooldown: 3, scene: 'gardening',
    title: 'The prison garden',
    text: () => `There is a scrap of dirt behind the kitchen where inmates are allowed to grow vegetables.`,
    choices: [
      { label: 'Plant tomatoes', tags: ['cautious'], run: (x) => { x.train('farming', 4); x.mods({ stress: -6, happiness: 4 }); PR(x).goodBehavior += 4; return 'The first red tomato felt like a small miracle.'; } },
      { label: 'Plant flowers', tags: ['help'], run: (x) => { x.mods({ depression: -4, karma: 2 }); return 'Nobody can eat them, and everyone stops to look.'; } },
    ],
  },
  {
    id: 'fo_pr_lawbooks', cat: 'legal', prison: true, weight: jailed(0.8), cooldown: 3, scene: 'library',
    title: 'Jailhouse lawyer',
    text: () => `An old inmate who knows the law books by heart offers to help you file an appeal.`,
    choices: [
      { label: 'Study with him', tags: ['ambitious'], run: (x) => { x.train('law', 6); x.train('criminalLaw', 4); PR(x).appeals += 1; if (x.chance(0.15)) { PR(x).sentence = Math.max(PR(x).served + 1, PR(x).sentence - 2); return 'Your appeal found a procedural error. Two years off!'; } return 'The appeal was denied, but you now quote statutes at dinner.'; } },
      { label: 'Pay him to write it', tags: ['cautious'], run: (x) => { x.spend(Math.min(x.c.money, $(x, 100))); if (x.chance(0.1)) { PR(x).sentence = Math.max(PR(x).served + 1, PR(x).sentence - 1); return 'A year off your sentence. You bought him a lot of stamps.'; } return 'Denied. He said "next time" with professional calm.'; } },
    ],
  },
  {
    id: 'fo_pr_chaplain', cat: 'legal', prison: true, weight: jailed(0.8), cooldown: 3, scene: 'holy',
    title: 'The chaplain',
    text: () => `The prison chaplain sits with you. "No sermon. Just company, if you want it."`,
    choices: [
      { label: 'Talk', tags: ['help'], run: (x) => { x.mods({ faith: 5, depression: -4, loneliness: -4 }); return 'You talked about your mother for an hour. Something loosened.'; } },
      { label: 'Pray together', tags: ['cautious'], run: (x) => { x.mods({ faith: 8, sin: -3 }); x.train('prayer', 3); return 'You had forgotten the words. They came back.'; } },
      { label: 'Send them away', tags: ['impulsive'], run: (x) => { x.mods({ loneliness: 3 }); return 'The chaplain nodded and left a book on your bunk.'; } },
    ],
  },
];

// ==================================================================== SPIRIT
const cursed = (x: Ctx): string | undefined => x.c.spiritual.curses[0]?.id;

const SPIRIT: EventDef[] = [
  {
    id: 'fo_blackCat', cat: 'spiritual', minAge: 6, weight: 0.8, cooldown: 5, scene: 'petCat',
    title: 'Black cat',
    text: () => `A black cat crosses your path, stops, and stares at you as if you owe it money.`,
    choices: [
      { label: 'Turn back', tags: ['cautious'], run: (x) => { x.mods({ paranoia: 1 }); return 'You took the long way round. Nothing bad happened, which proves it worked.'; } },
      { label: 'Pet it', tags: ['social'], scene: 'petCat', run: (x) => { x.mods({ happiness: 4 }); if (x.chance(0.2)) addBlessing(x, 'fortune', 1, 'a black cat'); return 'It purred like an engine. Luck, it turns out, is soft.'; } },
      { label: 'Spit over your shoulder', tags: ['impulsive'], run: (x) => { x.mods({ faith: 1 }); return 'You hit a man\'s shoe. That was the bad luck.'; } },
    ],
  },
  {
    id: 'fo_comet', cat: 'spiritual', minAge: 8, weight: 0.4, cooldown: 15, scene: 'meteor',
    title: 'A sign in the sky',
    text: (x) => `A great comet hangs over the land. ${x.year < 1700 ? 'Priests say it foretells the death of kings.' : 'Astronomers say it is ice. Your aunt says otherwise.'}`,
    choices: [
      { label: 'Pray for protection', tags: ['cautious'], scene: 'holy', run: (x) => { x.mods({ faith: 4 }); x.train('prayer', 2); return 'You prayed. The comet went away. Correlation is comforting.'; } },
      { label: 'Stay up and watch', tags: ['social'], scene: 'stargazing', run: (x) => { x.mods({ wisdom: 2, happiness: 4 }); x.train('astronomy', 2); return 'You watched it all night and felt very small in a good way.'; } },
      { label: 'Sell comet charms', tags: ['ambitious'], run: (x) => { const a = x.money($(x, 400)); x.mods({ karma: -2 }); return `Fear is a market. You made ${x.fmt(a)} selling painted pebbles.`; } },
    ],
  },
  {
    id: 'fo_ravens', cat: 'spiritual', minAge: 12, weight: 0.5, cooldown: 8, scene: 'curse',
    title: 'Three ravens',
    text: () => `Three ravens have sat on your roof for three days. Neighbours cross the street to avoid your gate.`,
    choices: [
      { label: 'Feed them', tags: ['help'], run: (x) => { x.mods({ paranormal: 3 }); if (x.chance(0.3)) { x.money($(x, 50)); return 'They brought you a shiny coin. Ravens pay their debts.'; } return 'They ate and watched you, approving.'; } },
      { label: 'Call a priest', tags: ['cautious'], scene: 'holy', run: (x) => { x.spend($(x, 30)); x.mods({ faith: 3 }); return 'Holy water on the roof. The ravens moved next door. Sorry, next door.'; } },
      { label: 'Shoo them off', tags: ['impulsive'], run: (x) => { if (x.chance(0.2)) addCurse(x, 'misfortune', 1, 'offended ravens'); return 'They left with a croak that sounded like a promise.'; } },
    ],
  },
  {
    id: 'fo_hauntedHome', cat: 'spiritual', minAge: 18, weight: 0.4, cooldown: 12, scene: 'ghost',
    title: 'Footsteps upstairs',
    text: () => `Every night at three, footsteps cross the empty attic. Tonight, a voice hums a lullaby.`,
    choices: [
      { label: 'Go up with a candle', tags: ['impulsive'], run: (x) => { x.mods({ paranormal: 6, fear: 4 }); return 'Nothing there but a rocking chair, rocking. You went back to bed very fast.'; } },
      { label: 'Speak to it kindly', tags: ['help'], run: (x) => { x.mods({ paranormal: 5, empathy: 3 }); x.train('spiritMediumship', 3); return 'You said it could rest now. The humming stopped. You felt someone leave, gently.'; } },
      { label: 'Move out', tags: ['cautious'], scene: 'moving', run: (x) => { x.spend(Math.min(x.c.money, $(x, 3000))); x.mods({ stress: 4 }); return 'The new house is quiet. Almost too quiet.'; } },
    ],
  },
  {
    id: 'fo_ghostParent', cat: 'spiritual', minAge: 25, weight: (x) => (x.aliveParents().length < 2 ? 0.35 : 0), once: true, scene: 'ghost',
    title: 'A familiar shape',
    text: () => `At the end of the hallway stands a figure you would know anywhere: your late parent, smiling as if nothing has changed.`,
    choices: [
      { label: 'Say what you never said', tags: ['help'], scene: 'reunion', run: (x) => { x.mods({ depression: -6, trauma: -4, happiness: 6, paranormal: 5 }); x.remember('ghostParent', 'Spoke to a late parent\'s ghost', 60); return 'You said it all. The figure nodded and faded like breath on glass.'; } },
      { label: 'Ask for advice', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 6, paranormal: 4 }); return '"Eat more vegetables," it said. Then it was gone. Typical.'; } },
      { label: 'Turn on the lights', tags: ['cautious'], run: (x) => { x.mods({ anxiety: 3 }); return 'Nobody there. Just a coat on a hook. Just a coat.'; } },
    ],
  },
  {
    id: 'fo_seance', cat: 'spiritual', minAge: 18, years: [1840, 2300], weight: 0.6, cooldown: 6, scene: 'seance',
    title: 'Séance',
    text: () => `A society hostess holds a séance. A famous medium will contact the dead, for a modest donation.`,
    choices: [
      { label: 'Hold hands and believe', tags: ['social'], run: (x) => { x.spend($(x, 50)); x.mods({ paranormal: 5, happiness: 3 }); return 'The table rose an inch. Somebody\'s knee, surely. Surely?'; } },
      { label: 'Expose the trick', tags: ['ambitious'], run: (x) => { if (check(x, x.stat('smarts'), 55)) { x.mods({ fame: 2, popularity: -2 }); return 'You found the wires under the table. The hostess never invited you again.'; } x.mods({ paranormal: 6, fear: 4 }); return 'There were no wires. The voice knew your childhood nickname.'; } },
      { label: 'Ask about the future', tags: ['impulsive'], run: (x) => { x.mods({ anxiety: 3, paranormal: 3 }); return `The spirit said: "Beware the ${x.pick(['water', 'tall man', 'month of March', 'cheese'])}." You have been wary ever since.`; } },
    ],
  },
  {
    id: 'fo_oracle', cat: 'spiritual', minAge: 16, years: [-800, 400], weight: 0.7, cooldown: 6, scene: 'tarot',
    title: 'The oracle',
    text: () => `You travel to consult the oracle. Smoke curls from a crack in the rock, and the priestess speaks in riddles.`,
    choices: [
      { label: 'Ask about wealth', tags: ['ambitious'], run: (x) => { x.spend($(x, 100)); x.mods({ faith: 2 }); if (x.chance(0.4)) addBlessing(x, 'fortune', 1, 'the oracle'); return '"A great fortune will be lost," she said. Yours or someone else\'s? She would not say.'; } },
      { label: 'Ask about love', tags: ['social'], run: (x) => { x.spend($(x, 100)); x.mods({ happiness: 2 }); return '"Seek the one who laughs at goats." You now watch everyone near goats.'; } },
      { label: 'Ask about death', tags: ['impulsive'], run: (x) => { x.mods({ anxiety: 4, wisdom: 4 }); return '"Not today," she said. Then she laughed for a long time.'; } },
    ],
  },
  {
    id: 'fo_tarot', cat: 'spiritual', minAge: 16, years: [1450, 2300], weight: 0.8, cooldown: 4, scene: 'tarot',
    title: 'The cards',
    text: () => `A fortune teller in a velvet tent offers to read your cards. She shuffles before you can answer.`,
    choices: [
      { label: 'Draw three', tags: ['impulsive'], run: (x) => { x.spend($(x, 20)); const c = x.pick(['the Tower', 'the Sun', 'Death (which means change, she insists)', 'the Lovers', 'the Fool', 'the Wheel of Fortune']); x.mods({ paranormal: 2 }); if (c === 'the Sun' || c === 'the Wheel of Fortune') { x.mods({ happiness: 5, confidence: 3 }); } return `You drew ${c}. She nodded gravely and charged extra.`; } },
      { label: 'Read her cards', tags: ['social'], run: (x) => { x.train('divination', 3); x.mods({ happiness: 4 }); return 'You read her future instead. She was rattled. You were right about the cat.'; } },
      { label: 'Walk past', tags: ['cautious'], run: () => '"You will regret that!" she called. Prophecy or sales technique?' },
    ],
  },
  {
    id: 'fo_palmReader', cat: 'spiritual', minAge: 14, weight: 0.6, cooldown: 6, scene: 'tarot',
    title: 'Your palm',
    text: () => `An old woman grabs your hand at the market and traces your lifeline. Her eyebrows go up.`,
    choices: [
      { label: 'Ask what she sees', tags: ['impulsive'], run: (x) => { x.spend($(x, 10)); x.mods({ paranormal: 2 }); return x.chance(0.5) ? '"A long life and three great loves." You walked home lighter.' : '"A short line, but a bright one." You are choosing to hear the bright part.'; } },
      { label: 'Pull your hand back', tags: ['cautious'], run: (x) => { x.mods({ anxiety: 1 }); return 'She shrugged. "It is your line, not mine."'; } },
    ],
  },
  {
    id: 'fo_astrologer', cat: 'spiritual', minAge: 18, weight: 0.5, cooldown: 8, scene: 'stargazing',
    title: 'Written in the stars',
    text: (x) => `${x.year < 1700 ? 'The court astrologer' : x.year < 1990 ? 'The newspaper horoscope' : 'An astrology app'} warns that the planets are aligned against you this month.`,
    choices: [
      { label: 'Stay home all month', tags: ['cautious'], run: (x) => { x.mods({ stress: -2, loneliness: 3 }); return 'Nothing went wrong, because nothing happened at all.'; } },
      { label: 'Defy the stars', tags: ['impulsive'], run: (x) => { x.mods({ confidence: 3 }); return x.chance(0.5) ? 'You stubbed your toe and blamed Mercury.' : 'Best month in years. Take that, Saturn.'; } },
      { label: 'Study astrology', tags: ['ambitious'], run: (x) => { x.train('astrology', 5); return 'You can now cast a chart and ruin any dinner party.'; } },
    ],
  },
  {
    id: 'fo_miracleHealing', cat: 'spiritual', minAge: 10, weight: (x) => (x.stat('health') < 35 ? 0.5 : 0), cooldown: 10, scene: 'angel',
    title: 'A healing touch',
    text: () => `A wandering healer lays a hand on your forehead and says your body remembers how to be well.`,
    choices: [
      { label: 'Believe', tags: ['cautious'], scene: 'holy', run: (x) => { if (x.chance(0.3 + x.stat('faith') / 300)) { x.mods({ health: 20, faith: 8 }); x.remember('miracle', 'Was healed by a stranger', 70); return 'The fever broke that night. Doctors cannot explain it.'; } x.mods({ faith: 2, happiness: 3 }); return 'Nothing changed in your body, but something did in your heart.'; } },
      { label: 'Pay the healer', tags: ['impulsive'], run: (x) => { x.spend(Math.min(x.c.money, $(x, 500))); x.mods({ health: 3 }); return 'You felt slightly better. So did the healer\'s purse.'; } },
      { label: 'Stick with the doctor', tags: ['cautious'], scene: 'checkup', run: (x) => { x.mods({ health: 4 }); return 'The doctor\'s medicine worked, slowly and unmiraculously.'; } },
    ],
  },
  {
    id: 'fo_weepingStatue', cat: 'spiritual', minAge: 10, weight: 0.4, cooldown: 12, scene: 'holy',
    title: 'The weeping statue',
    text: () => `A statue in the village shrine has begun to weep. Pilgrims are arriving by the hundred.`,
    choices: [
      { label: 'Kneel and pray', tags: ['cautious'], run: (x) => { x.mods({ faith: 6, divineFavor: 2 }); return 'Whatever the statue was doing, you felt seen.'; } },
      { label: 'Investigate', tags: ['ambitious'], run: (x) => { if (x.chance(0.5)) { x.mods({ smarts: 2, faith: -3 }); return 'A leaky gutter. You told nobody. The village needed this.'; } x.mods({ faith: 6, paranormal: 4 }); return 'There was no gutter. There was no explanation at all.'; } },
      { label: 'Sell candles to pilgrims', tags: ['ambitious'], run: (x) => { const a = x.money($(x, 800)); x.mods({ sin: 1 }); return `Miracles are thirsty work. ${x.fmt(a)} in candles and lemonade.`; } },
    ],
  },
  {
    id: 'fo_angelStranger', cat: 'spiritual', minAge: 8, weight: (x) => (x.stat('karma') > 60 ? 0.5 : 0.15), cooldown: 15, scene: 'angel',
    title: 'A kind stranger',
    text: () => `Stranded and lost in a storm, a stranger with very calm eyes appears, walks you home, and is gone when you turn to thank them.`,
    choices: [
      { label: 'Believe it was an angel', tags: ['cautious'], run: (x) => { x.mods({ faith: 8, happiness: 6 }); x.remember('angel', 'Was helped by an angel', 60); return 'There were no footprints in the snow but yours.'; } },
      { label: 'Pay the kindness forward', tags: ['help'], run: (x) => { x.mods({ karma: 6, empathy: 3 }); return 'The next stranded person you saw, you walked home. It felt like a relay.'; } },
      { label: 'Look for them', tags: ['ambitious'], run: (x) => { x.mods({ paranormal: 3 }); return 'Nobody in town matched. The innkeeper crossed himself when you described them.'; } },
    ],
  },
  {
    id: 'fo_cult', cat: 'spiritual', minAge: 18, maxAge: 60, weight: (x) => (x.stat('loneliness') > 50 || x.stat('depression') > 50 ? 0.8 : 0.2), once: true, scene: 'ritual',
    title: 'The Brightening',
    text: () => `Smiling people in white invite you to dinner. They call themselves the Brightening, and they say they have been waiting for you.`,
    choices: [
      { label: 'Join them', tags: ['impulsive', 'social'], run: (x) => { x.setFlag('fo_cult', 1); x.mods({ loneliness: -15, happiness: 8 }); x.chain('fo_cultChain', 0, {}); return 'They hugged you at the door. For the first time in years you felt wanted.'; } },
      { label: 'Just go to dinner', tags: ['cautious'], scene: 'familyDinner', run: (x) => { x.mods({ loneliness: -4 }); return 'Lovely soup. Slightly too much eye contact. You did not go back.'; } },
      { label: 'Decline', tags: ['cautious'], run: () => 'They said they would leave a seat for you. Always.' },
    ],
  },
  {
    id: 'fo_cultDeeper', cat: 'spiritual', triggered: true, scene: 'ritual',
    title: 'The inner circle',
    text: (x) => `The Brightening wants you in the inner circle. The price: your savings, ${x.fmt(Math.round(x.c.money * 0.5))}, and no more contact with "the dim" (your family).`,
    choices: [
      { label: 'Give everything', tags: ['impulsive'], run: (x) => { x.spend(Math.round(x.c.money * 0.5)); x.setFlag('fo_cult', 2); x.mods({ faith: 10, loneliness: 6 }); for (const r of x.rels('parent', 'sibling').slice(0, 3)) x.relMod(r.npcId, -15); return 'You signed it all over. The robes are very comfortable.'; } },
      { label: 'Ask questions', tags: ['cautious'], run: (x) => { x.setFlag('fo_cult', 1); x.mods({ wisdom: 4, paranoia: 3 }); return 'Your questions were met with smiles that did not reach the eyes.'; } },
      { label: 'Leave now', tags: ['cautious'], run: (x) => { x.setFlag('fo_cult', 0); x.mods({ resilience: 6, loneliness: 6 }); return 'You walked out. Nobody stopped you. That frightened you most of all.'; } },
    ],
  },
  {
    id: 'fo_cultBreak', cat: 'spiritual', triggered: true, scene: 'reunion',
    title: 'A knock at the door',
    text: (x) => (Number(x.flag('fo_cult') ?? 0) > 0 ? 'Your sibling is at the gate of the compound, holding a photo of you as a child. They are crying.' : 'An old flyer for the Brightening blows past. The compound was raided last week, the papers say.'),
    choices: [
      { label: 'Go home with them', tags: ['help'], run: (x) => { if (!Number(x.flag('fo_cult') ?? 0)) { x.mods({ wisdom: 3 }); return 'You threw the flyer away, very glad you are where you are.'; } x.setFlag('fo_cult', 0); x.mods({ happiness: 8, trauma: 4 }); x.remember('cultSurvivor', 'Left the Brightening', 65); return 'You walked out into the sun. It took years, but you came all the way back.'; } },
      { label: 'Stay with the Brightening', tags: ['impulsive'], when: (x) => Number(x.flag('fo_cult') ?? 0) > 0, run: (x) => { x.mods({ depression: 6, faith: 4 }); x.setFlag('fo_cult', 3); return 'You closed the gate. The leader called you "a true light". It did not feel like light.'; } },
    ],
  },
  {
    id: 'fo_curseMerchant', cat: 'spiritual', minAge: 16, weight: 0.4, cooldown: 12, scene: 'curse',
    title: 'A muttered curse',
    text: () => `You haggled a pedlar woman down to almost nothing. She takes the coins, spits, and mutters something under her breath while looking at you.`,
    choices: [
      { label: 'Pay her properly', tags: ['help'], run: (x) => { x.spend($(x, 40)); x.mods({ karma: 3 }); return 'She smiled and unsaid it with a wave. You think.'; } },
      { label: 'Laugh it off', tags: ['impulsive'], run: (x) => { if (x.chance(0.35)) { addCurse(x, 'misfortune', 1, 'a pedlar woman'); return 'That week you lost a shoe, a hat and an argument with a goose.'; } return 'Nothing happened. Superstition, clearly. Clearly.'; } },
      { label: 'Ask a priest to bless you', tags: ['cautious'], scene: 'holy', run: (x) => { x.mods({ faith: 3 }); return 'Blessed and covered. The priest charged nothing, which felt like a miracle itself.'; } },
    ],
  },
  {
    id: 'fo_evilEye', cat: 'spiritual', minAge: 10, weight: (x) => (x.stat('looks') > 70 || x.c.money > $(x, 200000) ? 0.6 : 0.15), cooldown: 10, scene: 'curse',
    title: 'The evil eye',
    text: () => `An envious neighbour praises your good fortune a little too much. Your grandmother insists you have been given the evil eye.`,
    choices: [
      { label: 'Hang a blue charm', tags: ['cautious'], run: (x) => { x.spend($(x, 10)); x.mods({ anxiety: -2 }); return 'A blue glass eye now watches the watchers. Grandmother approves.'; } },
      { label: 'Do grandmother\'s ritual', tags: ['social'], scene: 'ritual', run: (x) => { x.train('ritual', 2); x.mods({ happiness: 3 }); return 'Oil, water, a prayer and a smack on the head. You feel cleansed, and slightly concussed.'; } },
      { label: 'Ignore it', tags: ['impulsive'], run: (x) => { if (x.chance(0.25)) addCurse(x, 'misfortune', 1, 'the evil eye'); return 'You ignored it. Your grandmother wrote your name in a special notebook.'; } },
    ],
  },
  {
    id: 'fo_elderBlessing', cat: 'spiritual', minAge: 5, weight: (x) => (x.stat('karma') > 55 ? 0.5 : 0.2), cooldown: 15, scene: 'holy',
    title: 'An old blessing',
    text: () => `An ancient woman you helped across the road holds your face in both hands and says a blessing in a language you do not know.`,
    choices: [
      { label: 'Bow your head', tags: ['cautious'], run: (x) => { addBlessing(x, x.pick(['vitality', 'protection', 'wisdom']), 1, 'an old woman\'s blessing'); x.mods({ faith: 3, happiness: 4 }); return 'You felt warm for days, like you had swallowed a little sun.'; } },
      { label: 'Ask what it means', tags: ['social'], run: (x) => { x.mods({ wisdom: 3 }); return '"It means: be good, and eat," she said. Universal wisdom.'; } },
    ],
  },
  {
    id: 'fo_wishingWell', cat: 'spiritual', minAge: 5, weight: 0.6, cooldown: 6, scene: 'calm',
    title: 'Wishing well',
    text: () => `An old wishing well, its bottom glinting with centuries of coins.`,
    choices: [
      { label: 'Wish for love', tags: ['social'], run: (x) => { x.spend($(x, 1)); x.mods({ happiness: 2 }); return 'Plink. The water rippled in a heart shape. Or a blob. Probably a heart.'; } },
      { label: 'Wish for money', tags: ['ambitious'], run: (x) => { x.spend($(x, 1)); if (x.chance(0.1)) { x.money($(x, 500)); return 'The next day you found money in an old coat. Coincidence? You say no.'; } return 'Plink. The well kept your coin and its counsel.'; } },
      { label: 'Fish out some coins', tags: ['impulsive'], run: (x) => { x.money($(x, 15)); x.mods({ karma: -2 }); if (x.chance(0.25)) addCurse(x, 'misfortune', 1, 'robbing a wishing well'); return 'You took other people\'s wishes. They felt cold and damp in your pocket.'; } },
    ],
  },
  {
    id: 'fo_pastLife', cat: 'spiritual', minAge: 14, weight: 0.4, cooldown: 15, scene: 'reincarnation',
    title: 'Déjà vu',
    text: (x) => `Visiting an old ${x.pick(['harbour', 'castle', 'farmhouse', 'battlefield', 'market square'])} for the first time, you know exactly where everything is. You remember a name that is not yours.`,
    choices: [
      { label: 'Follow the memory', tags: ['impulsive'], run: (x) => { x.mods({ paranormal: 6, wisdom: 4 }); x.remember('pastLife', 'Remembered a past life', 55); return 'Behind a loose stone, exactly where you knew it would be: a child\'s carved wooden horse.'; } },
      { label: 'Research the name', tags: ['ambitious'], scene: 'library', run: (x) => { x.mods({ smarts: 2, paranormal: 3 }); x.train('history', 4); return 'The name belonged to someone who died here two hundred years ago. You had their laugh.'; } },
      { label: 'Shake it off', tags: ['cautious'], run: (x) => { x.mods({ anxiety: 2 }); return 'Brains do strange things. You had a strong coffee and moved on.'; } },
    ],
  },
  {
    id: 'fo_childPastLife', cat: 'spiritual', minAge: 3, maxAge: 7, weight: 0.3, once: true, scene: 'reincarnation',
    title: 'Before I was little',
    text: () => `At dinner you announce, very seriously, that "before I was little" you were a sailor with a red beard and a parrot.`,
    choices: [
      { label: 'Tell them more', tags: ['social'], run: (x) => { x.mods({ paranormal: 4, creativity: 3 }); x.remember('pastLife', 'Remembered being a sailor as a small child', 40); return 'You described a ship in perfect nautical detail. Your parents went quiet.'; } },
      { label: 'Ask for a parrot now', tags: ['impulsive'], run: (x) => { x.mods({ happiness: 2 }); return 'The answer was no. The parrot remains a past-life privilege.'; } },
    ],
  },
  {
    id: 'fo_pilgrimage', cat: 'spiritual', minAge: 18, weight: (x) => (x.stat('faith') > 40 || x.stat('sin') > 40 ? 0.6 : 0.15), cooldown: 15, scene: 'refugees',
    title: 'The long walk',
    text: () => `A group of pilgrims is setting off on a months-long walk to a holy shrine. They have room for one more.`,
    choices: [
      { label: 'Walk with them', tags: ['social'], scene: 'hiking', run: (x) => { x.spend(Math.min(x.c.money, $(x, 600))); x.mods({ faith: 10, fitness: 5, sin: -8, happiness: 6 }); x.mod('divineFavor', 5); x.remember('pilgrim', 'Walked a pilgrimage', 55); return 'Blistered feet, new friends and a peace you could not buy.'; } },
      { label: 'Ride ahead in comfort', tags: ['ambitious'], scene: 'travel', run: (x) => { x.spend(Math.min(x.c.money, $(x, 3000))); x.mods({ faith: 4, sin: -3 }); return 'You arrived first and felt the shrine was slightly less impressed with you.'; } },
      { label: 'Send a donation', tags: ['cautious'], run: (x) => { x.spend($(x, 100)); x.mods({ faith: 1 }); return 'The pilgrims promised to pray for you. You hope they mean it.'; } },
    ],
  },
  {
    id: 'fo_faithDoubt', cat: 'spiritual', minAge: 16, weight: (x) => (x.stat('faith') > 45 ? 0.5 : 0), cooldown: 10, scene: 'lonely',
    title: 'Silence',
    text: () => `You pray, and for the first time it feels like talking into an empty room.`,
    choices: [
      { label: 'Keep praying anyway', tags: ['cautious'], scene: 'holy', run: (x) => { x.mods({ faith: 4, resilience: 4 }); x.train('prayer', 3); return 'Weeks later, the silence felt less empty. Maybe it was listening all along.'; } },
      { label: 'Talk to a wise elder', tags: ['social'], run: (x) => { x.mods({ wisdom: 5 }); return '"Doubt is just faith doing push-ups," they said. You laughed, and that helped.'; } },
      { label: 'Let go of it', tags: ['impulsive'], run: (x) => { x.mods({ faith: -12, anxiety: 3, wisdom: 2 }); return 'You stopped going. It felt like freedom and grief at once.'; } },
    ],
  },
  {
    id: 'fo_preacher', cat: 'spiritual', minAge: 14, weight: 0.5, cooldown: 8, scene: 'holy',
    title: 'A street preacher',
    text: () => `A fiery preacher in the square is promising salvation, damnation and a free pamphlet, in that order.`,
    choices: [
      { label: 'Listen properly', tags: ['cautious'], run: (x) => { x.mods({ faith: 4 }); return 'Underneath the shouting was something tender. You kept the pamphlet.'; } },
      { label: 'Debate him', tags: ['ambitious'], run: (x) => { x.train('theology', 3); x.train('publicSpeaking', 2); x.mods({ popularity: 2 }); return 'A crowd gathered. Both of you enjoyed it more than you admitted.'; } },
      { label: 'Heckle', tags: ['impulsive'], run: (x) => { x.mods({ sin: 1, happiness: 2 }); return 'He promised you a special place in the fire. You promised to bring marshmallows.'; } },
    ],
  },
  {
    id: 'fo_shadowWhisper', cat: 'spiritual', minAge: 18, weight: (x) => (x.stat('sin') > 30 || x.stat('aggression') > 60 ? 0.5 : 0), cooldown: 10, scene: 'demonic',
    title: 'The whisper',
    text: () => `Late at night a soft voice from the corner of the room offers to make the people who wronged you "very sorry". It asks for nothing. Yet.`,
    choices: [
      { label: 'Say yes', tags: ['impulsive', 'violent'], run: (x) => { x.mods({ sin: 10, paranormal: 8, karma: -8 }); const r = x.rels('enemy', 'rival', 'nemesis'); if (r.length) x.relMod(r[0].npcId, -10); return 'The next week your rival broke a leg. You feel sick, and a little powerful.'; } },
      { label: 'Pray it away', tags: ['cautious'], scene: 'holy', run: (x) => { x.mods({ faith: 6, divineFavor: 2 }); x.train('spiritWarding', 3); return 'You prayed until dawn. The corner was only a corner again.'; } },
      { label: 'Ask what it is', tags: ['social'], run: (x) => { x.mods({ paranormal: 6, fear: 6 }); return '"A friend," it said. Friends do not smell of burnt matches.'; } },
    ],
  },
  {
    id: 'fo_crossroads', cat: 'spiritual', minAge: 18, weight: (x) => (x.stat('riskTolerance') > 55 ? 0.4 : 0.1), once: true, scene: 'demonic',
    title: 'Dice at the crossroads',
    text: () => `At a midnight crossroads a gentleman in a dark coat offers you one roll of the dice. Win, and luck follows you. Lose, and it does not.`,
    choices: [
      { label: 'Roll', tags: ['impulsive'], scene: 'casino', run: (x) => { if (x.chance(0.5)) { addBlessing(x, 'fortune', 2, 'the crossroads'); x.mods({ paranormal: 6 }); return 'Double six. He tipped his hat and was gone. Your luck has been strange ever since.'; } addCurse(x, 'misfortune', 2, 'the crossroads'); return 'Snake eyes. He smiled with too many teeth.'; } },
      { label: 'Ask him to roll first', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 4 }); return 'He laughed. "Clever." And then there was nobody there at all.'; } },
      { label: 'Walk home fast', tags: ['cautious'], run: (x) => { x.mods({ fear: 4 }); return 'You did not look back. You could hear dice rattling behind you for a mile.'; } },
    ],
  },
  {
    id: 'fo_cursedMirror', cat: 'spiritual', minAge: 18, weight: 0.3, once: true, scene: 'curse',
    title: 'The antique mirror',
    text: () => `You buy an antique mirror for almost nothing. At night your reflection blinks a moment after you do.`,
    choices: [
      { label: 'Cover it with a sheet', tags: ['cautious'], run: (x) => { x.mods({ anxiety: 3 }); return 'Covered. You sometimes hear tapping. You do not uncover it.'; } },
      { label: 'Smash it', tags: ['impulsive', 'violent'], run: (x) => { addCurse(x, 'misfortune', 1, 'a broken mirror'); return 'Seven years of bad luck, they say. You hope it is a rough average.'; } },
      { label: 'Sell it on', tags: ['ambitious'], run: (x) => { x.money($(x, 300)); x.mods({ karma: -2 }); return 'Someone else\'s problem now. You hope they blink fast.'; } },
    ],
  },
  {
    id: 'fo_exorcistOffer', cat: 'spiritual', minAge: 16, weight: (x) => (cursed(x) ? 1.2 : 0), cooldown: 4, scene: 'ritual',
    title: 'One who can lift it',
    text: (x) => `A wandering exorcist says she can see the shadow of a curse on you, and can lift it for ${x.fmt($(x, 3000))}.`,
    choices: [
      { label: 'Pay her', tags: ['cautious'], run: (x) => { const id = cursed(x); if (!x.spend($(x, 3000))) return 'You could not afford her. She left a sprig of rosemary out of pity.'; if (id && x.chance(0.55)) { breakCurse(x, id); return 'Smoke, chanting, and a sudden lightness. It is gone.'; } return 'She chanted, took the money and left. The shadow stayed.'; } },
      { label: 'Do penance instead', tags: ['help'], scene: 'volunteer', run: (x) => { x.mods({ karma: 6, sin: -6 }); const id = cursed(x); if (id && x.chance(0.3)) { breakCurse(x, id); return 'A year of good deeds, and one morning the weight was simply gone.'; } return 'Good deeds did not lift it yet. They did make you better.'; } },
      { label: 'Send her away', tags: ['impulsive'], run: () => '"It will get heavier," she said. Cheerful woman.' },
    ],
  },
  {
    id: 'fo_holyWell', cat: 'spiritual', minAge: 10, weight: (x) => (x.stat('health') < 60 ? 0.5 : 0.2), cooldown: 10, scene: 'calm',
    title: 'The holy spring',
    text: () => `Locals swear the spring in the woods cures any ailment. The water is freezing and smells faintly of eggs.`,
    choices: [
      { label: 'Bathe in it', tags: ['impulsive'], run: (x) => { x.mods({ health: x.chance(0.4) ? 10 : 2, faith: 3 }); return 'You screamed at the cold. Afterwards you felt astonishingly alive.'; } },
      { label: 'Bottle some', tags: ['ambitious'], run: (x) => { const a = x.money($(x, 300)); return `You sold "healing water" for ${x.fmt(a)}. It definitely smelled healing.`; } },
      { label: 'Leave an offering', tags: ['help'], run: (x) => { x.mods({ faith: 2, karma: 1 }); return 'You tied a ribbon to the branch with a thousand others.'; } },
    ],
  },
  {
    id: 'fo_propheticDream', cat: 'spiritual', minAge: 10, weight: 0.4, cooldown: 10, scene: 'stargazing',
    title: 'The dream',
    text: (x) => `You dream of ${x.pick(['a burning barn', 'a flood', 'a stranger at the door', 'your friend falling'])}, vivid as daylight. You wake certain it was a warning.`,
    choices: [
      { label: 'Act on it', tags: ['help'], run: (x) => { if (x.chance(0.4)) { x.mods({ paranormal: 8, fame: 1 }); x.train('prophecy', 4); return 'It happened, almost exactly. Because you warned people, nobody was hurt.'; } x.mods({ popularity: -2 }); return 'Nothing happened. People now call you "the dreamer", not kindly.'; } },
      { label: 'Write it down', tags: ['cautious'], scene: 'reading', run: (x) => { x.mods({ paranormal: 3 }); x.train('divination', 2); return 'Your dream journal is getting thick and a little unsettling.'; } },
      { label: 'Ignore it', tags: ['cautious'], run: () => 'Just cheese before bed. Probably.' },
    ],
  },
  {
    id: 'fo_poltergeist', cat: 'spiritual', minAge: 8, weight: 0.3, cooldown: 12, scene: 'ghost',
    title: 'Things move',
    text: () => `Cups slide across the table. Doors slam with no wind. Your shoes are on the roof again.`,
    choices: [
      { label: 'Call an exorcist', tags: ['cautious'], scene: 'ritual', run: (x) => { x.spend(Math.min(x.c.money, $(x, 400))); x.train('exorcism', 1); return 'Bell, book, candle. The cups stayed still. Your shoes stayed on the ground.'; } },
      { label: 'Set ground rules', tags: ['social'], run: (x) => { x.mods({ paranormal: 6, happiness: 2 }); return '"Not the good china," you said firmly. It listened. Mostly.'; } },
      { label: 'Invite a ghost hunter', tags: ['ambitious'], run: (x) => { x.mods({ fame: 3, paranormal: 4 }); return `Your house featured on ${crier(x)}. The ghost did not perform on camera.`; } },
    ],
  },
  {
    id: 'fo_spiritBoard', cat: 'spiritual', minAge: 12, years: [1890, 2300], weight: 0.5, cooldown: 8, scene: 'seance',
    title: 'The talking board',
    text: () => `At a sleepover, someone brings out a talking board. The pointer is moving. Nobody admits to pushing.`,
    choices: [
      { label: 'Ask its name', tags: ['impulsive'], run: (x) => { x.mods({ paranormal: 4, fear: 3 }); return 'It spelled your full name. Including the middle one nobody knows.'; } },
      { label: 'Push it yourself', tags: ['social'], run: (x) => { x.mods({ happiness: 4, popularity: 3 }); return 'You spelled "BOO" and three people screamed. A classic.'; } },
      { label: 'Say goodbye properly', tags: ['cautious'], run: (x) => { x.mods({ anxiety: -1 }); return 'You moved it to GOODBYE. Just in case. Everyone respected that.'; } },
    ],
  },
  {
    id: 'fo_deathOmen', cat: 'spiritual', minAge: 55, weight: 0.4, cooldown: 10, scene: 'graveVisit',
    title: 'An owl at noon',
    text: () => `An owl sits on your windowsill in broad daylight and hoots three times. Your neighbour goes pale.`,
    choices: [
      { label: 'Put your affairs in order', tags: ['cautious'], scene: 'office', run: (x) => { x.mods({ stress: -6, wisdom: 4 }); return 'You wrote a will and called old friends. Whatever comes, you are ready.'; } },
      { label: 'Make peace with someone', tags: ['help'], run: (x) => { const r = x.rels('enemy', 'rival', 'ex'); if (r.length) { x.relMod(r[0].npcId, 20, 10); return `You called ${x.first(r[0].npcId)}. The old anger melted on the phone line.`; } x.mods({ happiness: 3 }); return 'You had no enemies left to forgive. That is a good life.'; } },
      { label: 'Feed the owl', tags: ['social'], run: (x) => { x.mods({ happiness: 3 }); return 'The owl ate, nodded and left. Perhaps it was just hungry.'; } },
    ],
  },
  {
    id: 'fo_amulet', cat: 'spiritual', minAge: 12, weight: 0.5, cooldown: 10, scene: 'jewelry',
    title: 'Protective amulet',
    text: (x) => `A travelling seller swears this ${x.year < 1500 ? 'bronze amulet' : 'silver pendant'} was blessed by a holy hermit. ${x.fmt($(x, 150))}.`,
    choices: [
      { label: 'Buy it', tags: ['cautious'], run: (x) => { if (!x.spend($(x, 150))) return 'Too dear. Faith on a budget.'; if (x.chance(0.3)) addBlessing(x, 'protection', 1, 'an amulet'); x.mods({ anxiety: -3 }); return 'You wear it always. You feel safer, and maybe you are.'; } },
      { label: 'Ask for the hermit\'s name', tags: ['ambitious'], run: (x) => { x.mods({ wisdom: 2 }); return 'The hermit, it turns out, was the seller\'s uncle Kevin.'; } },
    ],
  },
  {
    id: 'fo_skywatchers', cat: 'spiritual', minAge: 18, years: [1950, 2300], weight: 0.4, cooldown: 10, scene: 'ufo',
    title: 'The skywatchers',
    text: () => `A group meets on a hill every Friday to await the visitors who will "take the worthy to the stars". They have snacks.`,
    choices: [
      { label: 'Join a vigil', tags: ['social'], scene: 'stargazing', run: (x) => { x.mods({ happiness: 4, loneliness: -4, paranormal: 3 }); if (x.chance(0.1)) { x.mods({ paranormal: 10 }); return 'A light moved across the sky in a way no plane moves. The hill went silent.'; } return 'No visitors, but lovely stars and surprisingly good sandwiches.'; } },
      { label: 'Ask about the worthy', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 2 }); return 'Being worthy requires a membership fee. You declined the stars.'; } },
    ],
  },
  {
    id: 'fo_silentRetreat', cat: 'spiritual', minAge: 18, weight: (x) => (x.stat('stress') > 55 ? 0.6 : 0.2), cooldown: 8, scene: 'calm',
    title: 'Silent retreat',
    text: () => `A monastery offers a ten-day silent retreat. No talking, no news, just bells and bread.`,
    choices: [
      { label: 'Go', tags: ['cautious'], scene: 'yoga', run: (x) => { x.spend(Math.min(x.c.money, $(x, 500))); x.mods({ stress: -15, wisdom: 4, anxiety: -6 }); x.train('meditation', 6); return 'On day six you cried for no reason. On day ten you felt brand new.'; } },
      { label: 'Go and break the silence', tags: ['impulsive'], run: (x) => { x.mods({ stress: -4, happiness: 3 }); return 'You lasted four hours, then sneezed so loudly a monk laughed. You are both banned.'; } },
      { label: 'Not now', tags: ['cautious'], run: () => 'The emails will not answer themselves. Sadly.' },
    ],
  },
  {
    id: 'fo_hermit', cat: 'spiritual', minAge: 15, weight: 0.4, cooldown: 12, scene: 'hiking',
    title: 'The hermit',
    text: () => `Deep in the hills you meet a hermit who has not spoken to anyone in years. He offers you tea in a cracked cup.`,
    choices: [
      { label: 'Ask the meaning of life', tags: ['ambitious'], run: (x) => { x.mods({ wisdom: 6 }); return '"Drink your tea while it is hot," he said. It took you twenty years to understand.'; } },
      { label: 'Sit in silence with him', tags: ['cautious'], run: (x) => { x.mods({ stress: -8, wisdom: 3 }); x.train('meditation', 3); return 'You watched the clouds for an hour. Best conversation you ever had.'; } },
      { label: 'Bring him supplies', tags: ['help'], run: (x) => { x.mods({ karma: 4 }); return 'He accepted the bread and refused the newspaper. "Nothing new," he said.'; } },
    ],
  },
  {
    id: 'fo_heavyConscience', cat: 'spiritual', minAge: 16, weight: (x) => (x.stat('sin') > 35 ? 0.8 : 0), cooldown: 6, scene: 'holy',
    title: 'A heavy heart',
    text: () => `The things you have done weigh on you. You find yourself outside a place of worship at dusk.`,
    choices: [
      { label: 'Go in and confess', tags: ['cautious'], run: (x) => { x.mods({ sin: -10, faith: 5, depression: -3 }); return 'You said it out loud. The words left you lighter than you came.'; } },
      { label: 'Make amends instead', tags: ['help'], scene: 'volunteer', run: (x) => { x.spend(Math.min(x.c.money, $(x, 1000))); x.mods({ sin: -8, karma: 8 }); return 'You repaid what you could to whom you could. It was a start.'; } },
      { label: 'Walk on', tags: ['impulsive'], run: (x) => { x.mods({ depression: 3 }); return 'You walked on. The weight walked with you.'; } },
    ],
  },
  {
    id: 'fo_sacredGrove', cat: 'spiritual', minAge: 10, years: [-800, 1200], weight: 0.6, cooldown: 6, scene: 'ritual',
    title: 'The sacred grove',
    text: () => `In the old grove, people leave offerings for the spirits of the trees before the harvest.`,
    choices: [
      { label: 'Leave honey and bread', tags: ['help'], run: (x) => { x.mods({ faith: 3 }); if (x.chance(0.3)) addBlessing(x, 'fertility', 1, 'the grove spirits'); return 'The wind moved the leaves like a sigh of approval.'; } },
      { label: 'Dance at the bonfire', tags: ['social'], scene: 'festival', run: (x) => { x.mods({ happiness: 8, popularity: 3 }); return 'You danced until dawn and woke up with leaves in your hair.'; } },
      { label: 'Steal an offering', tags: ['impulsive'], run: (x) => { x.mods({ sin: 3 }); if (x.chance(0.4)) addCurse(x, 'misfortune', 1, 'the grove spirits'); return 'The honey was delicious. The trees watched you eat it.'; } },
    ],
  },
  {
    id: 'fo_spiritAnimal', cat: 'spiritual', minAge: 10, weight: 0.4, cooldown: 15, scene: 'hiking',
    title: 'The white stag',
    text: () => `On a misty path, a white stag steps out of the trees, looks right at you, and does not run.`,
    choices: [
      { label: 'Follow it', tags: ['impulsive'], run: (x) => { x.mods({ paranormal: 5, happiness: 6 }); if (x.chance(0.3)) { x.money($(x, 200)); return 'It led you to a clearing, and to a lost purse with no name inside.'; } return 'It led you deep into the woods, then vanished. You found your way home changed.'; } },
      { label: 'Bow to it', tags: ['cautious'], run: (x) => { x.mods({ faith: 3, wisdom: 2 }); return 'It bowed back. Nobody will ever believe you.'; } },
      { label: 'Draw it', tags: ['social'], scene: 'painting', run: (x) => { x.train('art', 3); x.mods({ creativity: 3 }); return 'Your sketch is the best thing you have ever made.'; } },
    ],
  },
  {
    id: 'fo_doppelganger', cat: 'spiritual', minAge: 16, weight: 0.25, once: true, scene: 'ghost',
    title: 'Your double',
    text: () => `Across a busy street, you see yourself: same clothes, same walk. They turn, see you, and smile.`,
    choices: [
      { label: 'Chase them', tags: ['impulsive'], run: (x) => { x.mods({ paranoia: 6, paranormal: 6 }); return 'You lost them in the crowd. A shopkeeper said "back so soon?"'; } },
      { label: 'Look away', tags: ['cautious'], run: (x) => { x.mods({ anxiety: 4 }); return 'When you looked back there was nobody. Your heart pounded all the way home.'; } },
      { label: 'Wave', tags: ['social'], run: (x) => { x.mods({ paranormal: 4, happiness: 2 }); return 'They waved back. It was surprisingly comforting.'; } },
    ],
  },
  {
    id: 'fo_saintsFeast', cat: 'spiritual', minAge: 5, weight: 0.6, cooldown: 4, scene: 'festival',
    title: 'Feast day',
    text: () => `It is the feast of the local patron saint. Processions, music, sweets and an effigy of the saint that looks nothing like a person.`,
    choices: [
      { label: 'Carry the effigy', tags: ['social'], scene: 'parade', run: (x) => { x.mods({ faith: 3, popularity: 3, fitness: 1 }); return 'Your shoulder ached for a week. A great honour.'; } },
      { label: 'Eat everything', tags: ['impulsive'], run: (x) => { x.mods({ happiness: 6, health: -1 }); return 'You tried every sweet. The saint would understand.'; } },
      { label: 'Light a candle quietly', tags: ['cautious'], scene: 'holy', run: (x) => { x.mods({ faith: 4, stress: -3 }); return 'In the noise you found a pocket of quiet. You lit a candle for someone.'; } },
    ],
  },
  {
    id: 'fo_luckyCharm', cat: 'spiritual', minAge: 8, weight: 0.4, cooldown: 12, scene: 'moneyUp',
    title: 'Four-leaf clover',
    text: () => `Sitting in the grass, your eye falls on a perfect four-leaf clover.`,
    choices: [
      { label: 'Press it in a book', tags: ['cautious'], scene: 'reading', run: (x) => { x.mods({ happiness: 3 }); if (x.chance(0.25)) addBlessing(x, 'fortune', 1, 'a four-leaf clover'); return 'You will find it again in thirty years and smile.'; } },
      { label: 'Give it to someone', tags: ['help'], run: (x) => { x.mods({ karma: 3, happiness: 3 }); return 'Their face lit up. Luck shared is luck doubled.'; } },
    ],
  },
  {
    id: 'fo_eclipse', cat: 'spiritual', minAge: 6, weight: 0.3, cooldown: 15, scene: 'eclipse',
    title: 'The sun goes dark',
    text: (x) => `At midday, the sun is swallowed. ${x.year < 1700 ? 'People wail that the world is ending.' : 'People gather with special glasses and nervous laughter.'}`,
    choices: [
      { label: 'Pray', tags: ['cautious'], scene: 'holy', run: (x) => { x.mods({ faith: 4 }); return 'The sun returned. Prayer works, or astronomy does. Either way.'; } },
      { label: 'Watch in wonder', tags: ['social'], run: (x) => { x.mods({ happiness: 6, wisdom: 2 }); x.train('astronomy', 2); return 'The birds went silent and the air went cold. You will never forget it.'; } },
      { label: 'Predict the next one', tags: ['ambitious'], when: (x) => x.stat('smarts') > 65, run: (x) => { x.train('astronomy', 5); x.mods({ fame: 3 }); return 'You calculated the next eclipse. When it came, people called you a sorcerer.'; } },
    ],
  },
];

export const FORTUNE_EVENTS: EventDef[] = [...MONEY, ...FAME, ...POWER, ...CRIME, ...SPIRIT];

export const FORTUNE_CHAINS: ChainDef[] = [
  { id: 'fo_loanChain', name: 'The loan', desc: 'A friend borrowed money.', steps: [{ delay: 2, eventId: 'fo_loanReturn' }] },
  { id: 'fo_sharkChain', name: 'Gold tooth', desc: 'You borrowed from a loan shark.', steps: [{ delay: 1, eventId: 'fo_sharkCollects' }, { delay: 1, eventId: 'fo_sharkFinal' }] },
  { id: 'fo_awardChain', name: 'Awards season', desc: 'You were nominated for an award.', steps: [{ delay: 1, eventId: 'fo_awardNight' }] },
  { id: 'fo_witnessChain', name: 'The witness', desc: 'You testified against a criminal.', steps: [{ delay: 3, eventId: 'fo_witnessThreat' }] },
  { id: 'fo_cultChain', name: 'The Brightening', desc: 'You joined a group in white.', steps: [{ delay: 1, eventId: 'fo_cultDeeper' }, { delay: 2, eventId: 'fo_cultBreak' }] },
  { id: 'fo_cryptoChain', name: 'To the moon', desc: 'You bought a strange coin.', steps: [{ delay: 3, eventId: 'fo_cryptoReckoning' }] },
];
