import type { ChainDef, ChoiceDef, ChoiceTag, EventDef, Text } from './types';
import type { Ctx } from '../ctx';
import { fmtYear } from '../ctx';
import { eraCostFactor } from '../systems/finance';

// ------------------------------------------------------------------ local helpers

/** Modern dollars scaled to era money (never below 1). */
const cost = (x: Ctx, n: number): number => Math.max(1, Math.round(n * eraCostFactor(x.year)));

/** Build a choice compactly. */
const ch = (label: string, tags: ChoiceTag[], run: (x: Ctx) => string, scene?: string, when?: (x: Ctx) => boolean): ChoiceDef => ({
  label,
  tags,
  run,
  ...(scene ? { scene } : {}),
  ...(when ? { when } : {}),
});

/** Pay an era-scaled price; returns the cost or 0 when unaffordable. */
const pay = (x: Ctx, n: number): number => {
  const c = cost(x, n);
  return x.spend(c) ? c : 0;
};

const inCountry = (...ids: string[]) => (x: Ctx): boolean => ids.includes(x.c.countryId);

const EURO = ['gb', 'fr', 'de', 'it', 'es', 'ru', 'gr', 'ch'];
const europe = (x: Ctx): boolean => EURO.includes(x.c.countryId);

/** Lands under Roman rule (roughly). */
const roman = (x: Ctx): boolean => {
  const id = x.c.countryId;
  if (id === 'it') return x.year <= 476;
  if (['fr', 'es', 'gr', 'eg'].includes(id)) return x.year >= -50 && x.year <= 450;
  if (id === 'gb') return x.year >= 50 && x.year <= 409;
  return false;
};

const western = (x: Ctx): boolean => ['us', 'gb', 'fr', 'de', 'it', 'es', 'ch', 'au', 'gr'].includes(x.c.countryId);

// ================================================================== ANCIENT (-800..499)
const ANCIENT: EventDef[] = [
  {
    id: 'er_bathhouse', cat: 'era', minAge: 10, years: [-200, 450], when: roman, weight: 1.2, scene: 'spa',
    title: 'At the baths', text: 'The public baths are steaming, loud and full of people who know everyone\'s business.',
    choices: [
      ch('Soak in the hot pool', ['cautious'], (x) => { x.mods({ stress: -6, happiness: 3 }); return 'You emerge pink, wrinkled and briefly at peace with the empire.'; }),
      ch('Trade gossip', ['social'], (x) => { x.train('gossip', 3); x.mods({ popularity: 2 }); return 'You learn which senator owes money to which baker.'; }),
      ch('Wrestle in the exercise yard', ['impulsive'], (x) => { x.train('wrestling', 3); x.mods({ fitness: 2, pain: 2 }); return 'Oiled, sanded and thrown twice. Character building.'; }, 'fight'),
    ],
  },
  {
    id: 'er_gladiators', cat: 'era', minAge: 8, years: [-260, 404], when: roman, weight: 1.2, scene: 'sports',
    title: 'Games in the arena', text: 'A magistrate is paying for gladiator games to win votes. The whole town is going.',
    choices: [
      ch('Cheer for the underdog', ['social'], (x) => { x.mods({ happiness: 3 }); return x.chance(0.4) ? 'Against all odds, he walked out alive. The crowd went wild.' : 'The underdog stayed the underdog. You cheered anyway.'; }),
      ch('Bet on the favourite', ['impulsive'], (x) => { const b = cost(x, 40); if (x.chance(0.55)) { x.money(b); return `The favourite won and so did you: ${x.fmt(b)}.`; } x.money(-b); return `The favourite slipped. So did ${x.fmt(b)} of yours.`; }, 'casino'),
      ch('Leave before the bloodshed', ['cautious', 'help'], (x) => { x.mods({ empathy: 3, popularity: -1 }); return 'Your neighbours call you soft. You sleep well.'; }),
    ],
  },
  {
    id: 'er_breadDole', cat: 'era', minAge: 12, years: [-120, 450], when: inCountry('it'), weight: (x) => (x.c.money < cost(x, 5000) ? 1.5 : 0.4), scene: 'volunteer',
    title: 'The grain dole', text: 'Your name is on the list for the free grain ration, handed out under the colonnades.',
    choices: [
      ch('Collect your grain', ['cautious'], (x) => { x.money(cost(x, 30)); x.mods({ health: 1 }); return 'Bread for the month, courtesy of the state. Rome keeps its people fed and quiet.'; }),
      ch('Give it to a widow', ['help'], (x) => { x.mods({ karma: 4, empathy: 2, happiness: 2 }); return 'She blessed you by three different gods, just to be safe.'; }),
      ch('Sell your token', ['ambitious'], (x) => { x.money(cost(x, 50)); x.mods({ karma: -1 }); return 'A baker paid well for it. Your stomach complained all week.'; }),
    ],
  },
  {
    id: 'er_oracle', cat: 'era', minAge: 14, years: [-800, 390], when: inCountry('gr', 'it', 'eg', 'ir'), cooldown: 8, scene: 'tarot',
    title: 'The oracle', text: 'After a long journey, you stand before the oracle. The smoke smells of laurel and nerves.',
    choices: [
      ch('Ask about love', ['social'], (x) => { x.mods({ romanticCynicism: -2 }); return x.pick(['"You will love what you first fear." You fear many things.', '"The gate opens twice." No further details were offered.']); }),
      ch('Ask about wealth', ['ambitious'], (x) => { x.mods({ ego: 1 }); return x.pick(['"A great fortune will be lost." Whose, she did not say.', '"Gold follows the patient." You were not patient on the way home.']); }),
      ch('Ask how to live well', ['cautious'], (x) => { x.mods({ wisdom: 4, faith: 2 }); return '"Know yourself." It took you years to realise that was the whole answer.'; }),
    ],
  },
  {
    id: 'er_chariotRace', cat: 'era', minAge: 8, years: [-300, 500], when: roman, scene: 'sports',
    title: 'Chariot races', text: 'The Greens and the Blues are racing today, and the factions hate each other like family.',
    choices: [
      ch('Shout for the Greens', ['social'], (x) => { x.mods({ happiness: 3, popularity: 1 }); return x.chance(0.5) ? 'The Greens won. Strangers hugged you.' : 'The Greens crashed on the last turn. Strangers blamed you.'; }),
      ch('Bet on the Blues', ['impulsive'], (x) => { const b = cost(x, 30); if (x.chance(0.45)) { x.money(b * 2); return `The Blues took it by a nose. You won ${x.fmt(b * 2)}.`; } x.money(-b); return 'The Blues lost a wheel and your stake with it.'; }, 'casino'),
      ch('Watch the crowd instead', ['cautious'], (x) => { x.mods({ wisdom: 2 }); return 'Thousands of people screaming about horses. Empires are built on less.'; }),
    ],
  },
  {
    id: 'er_agora', cat: 'era', minAge: 12, years: [-600, 300], when: inCountry('gr', 'it', 'eg'), scene: 'study',
    title: 'Philosophers in the square', text: 'A barefoot man in the market is asking passers-by what justice is, and refusing every answer.',
    choices: [
      ch('Argue with him', ['ambitious'], (x) => { x.train('philosophy', 4); x.mods({ smarts: 2, ego: -2 }); return 'Three hours later you were sure of nothing. It felt wonderful.'; }),
      ch('Mock him', ['impulsive'], (x) => { x.train('humor', 2); x.mods({ popularity: 2, wisdom: -1 }); return 'The crowd laughed. He asked what laughter was.'; }),
      ch('Ask about the good life', ['cautious'], (x) => { x.mods({ wisdom: 4, happiness: 2 }); return 'He said to live simply and question everything. You bought fewer sandals.'; }),
    ],
  },
  {
    id: 'er_templeOffering', cat: 'era', minAge: 10, years: [-800, 400], when: (x) => !['cn', 'jp', 'in'].includes(x.c.countryId), scene: 'ritual',
    title: 'Festival offering', text: (x) => `It is a feast day in ${x.countryName}. Everyone brings something to the temple.`,
    choices: [
      ch('Offer a goat', ['ambitious'], (x) => { const c = pay(x, 120); if (!c) return 'You could not afford a goat. The gods may have to wait.'; x.mods({ faith: 3, divineFavor: 3 }); return 'The priest read the entrails and smiled. That is good, apparently.'; }),
      ch('Offer honey cakes', ['cautious'], (x) => { pay(x, 10); x.mods({ faith: 2, happiness: 1 }); return 'Modest, sincere and delicious. Probably the gods\' favourite kind.'; }),
      ch('Skip it this year', ['impulsive'], (x) => { x.mods({ faith: -2, sin: 1 }); return 'Your mother noticed. The gods may not have, but your mother did.'; }),
    ],
  },
  {
    id: 'er_census', cat: 'era', minAge: 18, years: [-500, 499], cooldown: 8, scene: 'office',
    title: 'The census', text: 'Officials have come to count every person, field and animal for the tax rolls.',
    choices: [
      ch('Declare everything', ['cautious'], (x) => { x.money(-cost(x, 60)); x.mods({ karma: 2 }); return 'The scribe wrote you down, every goat and grandmother of you.'; }),
      ch('Forget a field', ['impulsive'], (x) => { if (x.chance(0.75)) { x.money(cost(x, 60)); return 'The field stayed off the books. It felt like a small rebellion.'; } x.money(-cost(x, 200)); x.mods({ stress: 5 }); return 'A neighbour mentioned the field. The fine was memorable.'; }),
      ch('Slip the scribe a coin', ['ambitious'], (x) => { x.money(-cost(x, 20)); x.mods({ corruption: 2 }); return 'Your farm shrank on paper by exactly the amount you paid.'; }, 'bribe'),
    ],
  },
  {
    id: 'er_aqueduct', cat: 'era', minAge: 14, years: [-300, 450], when: roman, once: true, scene: 'construction',
    title: 'The new aqueduct', text: 'Engineers are bringing fresh water from the hills on a line of stone arches.',
    choices: [
      ch('Work on the arches', ['ambitious'], (x) => { x.train('masonry', 4); x.money(cost(x, 300)); x.mods({ fitness: 2 }); return 'Hard work, fair pay, and a thing that will outlast you by centuries.'; }),
      ch('Tap the pipe secretly', ['impulsive'], (x) => { if (x.chance(0.7)) { x.mods({ happiness: 3 }); return 'Your private fountain is the envy of the street.'; } x.money(-cost(x, 150)); return 'The water inspector found your pipe. He was not amused.'; }),
      ch('Just enjoy the water', ['cautious'], (x) => { x.mods({ health: 3, happiness: 2 }); return 'Clean water, every day. You stop getting sick quite so often.'; }),
    ],
  },
  {
    id: 'er_storyteller', cat: 'era', minAge: 6, years: [-800, 499], scene: 'theater',
    title: 'A wandering storyteller', text: 'A traveller by the fire is reciting a story of heroes, monsters and gods behaving badly.',
    choices: [
      ch('Listen until dawn', ['cautious'], (x) => { x.mods({ creativity: 3, happiness: 2 }); x.train('history', 2); return 'You could recite whole passages for the rest of your life.'; }),
      ch('Tell a story of your own', ['social'], (x) => { x.train('poetry', 3); x.mods({ confidence: 3, popularity: 2 }); return 'Your monster had three heads. The crowd demanded a fourth.'; }),
      ch('Pay him for a song', ['help'], (x) => { pay(x, 5); x.mods({ happiness: 3, karma: 1 }); return 'He sang about a sea voyage. You dreamed about the sea for weeks.'; }),
    ],
  },
  {
    id: 'er_saturnalia', cat: 'era', minAge: 6, years: [-200, 400], when: roman, cooldown: 4, scene: 'party',
    title: 'Saturnalia', text: 'For a few days in December the rules are off: masters serve dinner and everyone wears a felt cap.',
    choices: [
      ch('Give little gifts', ['help'], (x) => { pay(x, 15); x.mods({ happiness: 3, popularity: 2 }); return 'Clay figurines and candles for everyone. Cheap, cheerful, very Roman.'; }),
      ch('Gamble with dice', ['impulsive'], (x) => { const b = cost(x, 25); if (x.chance(0.5)) { x.money(b); return `Dice are legal this week, and they liked you: +${x.fmt(b)}.`; } x.money(-b); return 'The dice were legal. Your luck was not.'; }, 'casino'),
      ch('Stay sober and watch', ['cautious'], (x) => { x.mods({ wisdom: 2, discipline: 2 }); return 'You saw a magistrate dance on a table. You will never forget it.'; }),
    ],
  },
  {
    id: 'er_alexandriaScrolls', cat: 'era', minAge: 12, years: [-280, 390], when: inCountry('eg', 'gr'), scene: 'library',
    title: 'The great library', text: 'Scholars are copying every scroll they can lay their hands on, including some borrowed from ships in the harbour.',
    choices: [
      ch('Copy scrolls for pay', ['cautious'], (x) => { x.train('literacy', 4); x.money(cost(x, 100)); return 'Your handwriting improved. Your eyesight did not.'; }),
      ch('Debate the astronomers', ['ambitious'], (x) => { x.train('astronomy', 4); x.mods({ smarts: 3 }); return 'They insisted the earth was round and measurable. You went home and stared at shadows.'; }),
      ch('Pocket a scroll', ['impulsive'], (x) => { x.mods({ sin: 2, smarts: 1 }); return x.chance(0.7) ? 'A treatise on bees, now yours forever.' : 'A librarian took it back with a look you still remember.'; }),
    ],
  },
  {
    id: 'er_ancientMarket', cat: 'era', minAge: 8, years: [-800, 499], scene: 'shopping',
    title: 'Market day', text: 'Spices, pottery, olives, gossip and a man selling a cure for everything.',
    choices: [
      ch('Haggle hard', ['ambitious'], (x) => { x.train('negotiation', 3); x.money(cost(x, 10)); return 'You got the price down by a third and the merchant\'s respect up by a little.'; }),
      ch('Buy exotic spices', ['impulsive'], (x) => { if (!pay(x, 40)) return 'One sniff of pepper was all you could afford.'; x.mods({ happiness: 3 }); x.train('cooking', 2); return 'Your dinners became the talk of the street.'; }),
      ch('Try the miracle cure', ['impulsive'], (x) => { pay(x, 5); x.mods({ health: x.chance(0.3) ? 1 : -2 }); return 'It tasted of vinegar and regret.'; }, 'sick'),
    ],
  },
];

// ================================================================== MEDIEVAL (500..1399)
const MEDIEVAL: EventDef[] = [
  {
    id: 'er_fairDay', cat: 'era', minAge: 6, years: [800, 1500], when: europe, scene: 'festival',
    title: 'The great fair', text: 'Merchants, jugglers and a dancing bear have arrived for the yearly fair.',
    choices: [
      ch('Buy ribbons and cloth', ['impulsive'], (x) => { pay(x, 20); x.mods({ looks: 1, happiness: 3 }); return 'You looked very fine at church that Sunday.'; }, 'shopping'),
      ch('Sell your produce', ['ambitious'], (x) => { x.money(cost(x, 80)); x.train('sales', 2); return 'Your cheeses sold out by noon.'; }),
      ch('Watch the mummers', ['social'], (x) => { x.mods({ happiness: 4 }); return 'A man in a dragon costume chased the children. You laughed until it hurt.'; }, 'theater'),
    ],
  },
  {
    id: 'er_joust', cat: 'era', minAge: 8, years: [1100, 1550], when: europe, scene: 'joust',
    title: 'The tournament', text: 'Knights in painted armour are jousting for a lady\'s favour and, mostly, for prize money.',
    choices: [
      ch('Cheer from the stands', ['social'], (x) => { x.mods({ happiness: 3 }); return 'A lance shattered right in front of you. You kept a splinter for years.'; }),
      ch('Bet on the local knight', ['impulsive'], (x) => { const b = cost(x, 30); if (x.chance(0.5)) { x.money(b); return `He unhorsed a famous champion. You won ${x.fmt(b)}.`; } x.money(-b); return 'He fell off before the lances met. So did your savings.'; }, 'casino'),
      ch('Serve as a squire', ['ambitious'], (x) => { x.train('horsemanship', 4); x.mods({ fitness: 2, confidence: 2 }); if (x.chance(0.2)) { x.mods({ health: -4, pain: 4 }); return 'A loose horse kicked you. You learned a lot, mostly about horses.'; } return 'You polished armour and learned how fear smells.'; }, undefined, (x) => x.age >= 12 && x.age <= 30),
    ],
  },
  {
    id: 'er_feudalLevy', cat: 'era', minAge: 16, maxAge: 50, years: [800, 1450], when: europe, cooldown: 6, scene: 'war',
    title: 'The lord\'s summons', text: 'Your lord is calling up men for his campaign. Every household must send someone or pay.',
    choices: [
      ch('Answer the summons', ['ambitious'], (x) => { x.train('weaponsTraining', 4); if (x.chance(0.25)) { x.mods({ health: -10, trauma: 6 }); return 'You came home with a limp and stories you never told.'; } x.money(cost(x, 150)); x.mods({ confidence: 3 }); return 'Forty days of marching, one skirmish, and a share of the loot.'; }),
      ch('Pay the fee instead', ['cautious'], (x) => { if (!pay(x, 200)) { x.mods({ stress: 6 }); return 'You could not pay. The reeve wrote your name in a different column.'; } return 'Coin went to war in your place. It came back with nobody.'; }),
      ch('Hide in the woods', ['impulsive'], (x) => { if (x.chance(0.6)) { x.mods({ stress: 4 }); return 'You ate acorns for a week. The army left without you.'; } x.money(-cost(x, 100)); x.mods({ popularity: -4 }); return 'Found, fined and mocked by every child in the village.'; }),
    ],
  },
  {
    id: 'er_monastery', cat: 'era', minAge: 8, years: [600, 1500], when: europe, scene: 'holy',
    title: 'At the monastery gate', text: 'The monks hand out bread to the poor and treat the sick in their infirmary.',
    choices: [
      ch('Ask for alms', ['cautious'], (x) => { x.money(cost(x, 10)); x.mods({ ego: -2, health: 1 }); return 'Brown bread and a blessing. Both helped.'; }, 'volunteer', (x) => x.c.money < cost(x, 3000)),
      ch('Help in the infirmary', ['help'], (x) => { x.train('herbalism', 4); x.mods({ karma: 4, empathy: 3 }); return 'You learned which herbs soothe a fever and which ones just smell nice.'; }, 'volunteer'),
      ch('Learn letters from a monk', ['ambitious'], (x) => { x.train('literacy', 5); x.mods({ smarts: 2 }); return 'Brother Anselm taught you to read. Rare, precious and slightly suspicious.'; }, 'library'),
    ],
  },
  {
    id: 'er_pilgrimage', cat: 'travel', minAge: 14, years: [800, 1550], when: europe, cooldown: 12, scene: 'travel',
    title: 'Pilgrimage', text: 'Pilgrims are setting off to a famous shrine, with scallop shells and walking sticks.',
    choices: [
      ch('Walk the whole road', ['ambitious'], (x) => { x.mods({ faith: 6, fitness: 3, health: -2, wisdom: 3 }); x.remember('pilgrimage', 'Walked a pilgrimage road', 40); return 'Blisters, saints, strangers and one night you will never forget under the stars.'; }, 'hiking'),
      ch('Buy a holy relic', ['impulsive'], (x) => { pay(x, 60); x.mods({ faith: 2 }); return 'A saint\'s finger bone, certified. The saint apparently had eleven fingers.'; }),
      ch('Pray at home', ['cautious'], (x) => { x.mods({ faith: 2 }); return 'God, you reasoned, is also local.'; }),
    ],
  },
  {
    id: 'er_mysteryPlay', cat: 'era', minAge: 6, years: [1000, 1580], when: europe, scene: 'theater',
    title: 'The guild play', text: 'The town guilds are staging Bible stories on wagons. The carpenters are doing Noah, obviously.',
    choices: [
      ch('Play the devil', ['impulsive'], (x) => { x.train('acting', 4); x.mods({ popularity: 3, confidence: 3 }); return 'You stomped, roared and set off a firecracker. Children loved you.'; }, 'stage'),
      ch('Watch with the crowd', ['social'], (x) => { x.mods({ happiness: 3, faith: 1 }); return 'Noah\'s ark leaked real water. Theatre!'; }),
      ch('Heckle the actors', ['impulsive'], (x) => { x.train('humor', 2); x.mods({ popularity: -1 }); return 'Pontius Pilate threw a turnip at you. Fair.'; }),
    ],
  },
  {
    id: 'er_tithe', cat: 'era', minAge: 18, years: [600, 1600], when: europe, cooldown: 5, scene: 'farm',
    title: 'Tithe day', text: 'A tenth of your harvest is due to the church. The tithe barn is already full.',
    choices: [
      ch('Pay in full', ['cautious'], (x) => { x.money(-cost(x, 50)); x.mods({ faith: 2, karma: 1 }); return 'Every tenth sheaf, counted by a very thorough priest.'; }),
      ch('Hide a few sheaves', ['impulsive'], (x) => { if (x.chance(0.7)) { x.mods({ sin: 2 }); return 'Your family ate a little better that winter.'; } x.money(-cost(x, 100)); return 'The priest counted twice. The penance was public.'; }),
      ch('Argue it is unfair', ['ambitious'], (x) => { x.train('persuasion', 3); x.mods({ popularity: 2, faith: -2 }); return 'The village agreed with you, quietly, after dark.'; }),
    ],
  },
  {
    id: 'er_manorFeast', cat: 'era', minAge: 8, years: [700, 1450], when: europe, scene: 'familyDinner',
    title: 'The lord\'s feast', text: 'At harvest\'s end, the lord of the manor feeds the whole village in his hall.',
    choices: [
      ch('Eat until you burst', ['impulsive'], (x) => { x.mods({ happiness: 4, health: -1 }); return 'Roast goose, frumenty, and a pudding the size of a cart wheel.'; }),
      ch('Save bread for later', ['help'], (x) => { x.mods({ karma: 2, discipline: 2 }); return 'Your family ate well for three days.'; }),
      ch('Sing for the hall', ['social'], (x) => { x.train('singing', 3); x.mods({ popularity: 3 }); return 'The lord threw you a silver penny. The cook threw you a wink.'; }, 'music'),
    ],
  },
  {
    id: 'er_wolves', cat: 'era', minAge: 10, years: [500, 1500], when: europe, cooldown: 6, scene: 'blizzard',
    title: 'Wolves in winter', text: 'A hard winter has brought wolves to the edge of the village. Sheep are going missing.',
    choices: [
      ch('Bring the flock inside', ['cautious'], (x) => { x.mods({ stress: 2 }); return 'Sheep in the kitchen all winter. Nobody was eaten, which counts as a win.'; }),
      ch('Join the hunt', ['ambitious'], (x) => { x.train('weaponsTraining', 3); if (x.chance(0.2)) { x.mods({ health: -6 }); return 'You got the wolf. The wolf got your leg first.'; } x.mods({ confidence: 4, popularity: 3 }); return 'You came home with a pelt and a story that grew every year.'; }, 'fight'),
      ch('Light fires all night', ['help'], (x) => { x.mods({ energy: -4, karma: 1 }); return 'Eyes glowed in the dark, but nothing crossed the fire line.'; }, 'camping'),
    ],
  },
  {
    id: 'er_troubadour', cat: 'era', minAge: 10, years: [1100, 1350], when: inCountry('fr', 'es', 'it'), scene: 'serenade',
    title: 'The troubadour', text: 'A travelling poet is singing about impossible love to a courtyard of swooning listeners.',
    choices: [
      ch('Learn his lute tunes', ['ambitious'], (x) => { x.train('music', 4); x.mods({ creativity: 2 }); return 'Three songs, five blisters, one new passion.'; }, 'music'),
      ch('Write your own verses', ['social'], (x) => { x.train('poetry', 4); x.mods({ creativity: 3 }); return 'Your rhymes were rough but your feelings were enormous.'; }),
      ch('Pay him to move on', ['impulsive'], (x) => { pay(x, 5); x.mods({ romanticCynicism: 2 }); return 'Nobody needs that much longing before breakfast.'; }),
    ],
  },
  {
    id: 'er_lordsMill', cat: 'era', minAge: 16, years: [800, 1450], when: europe, scene: 'farm',
    title: 'The lord\'s mill', text: 'You must grind your grain at the lord\'s mill, and the miller keeps a generous share.',
    choices: [
      ch('Pay the miller', ['cautious'], (x) => { x.money(-cost(x, 15)); return 'The miller smiled. Millers always smile.'; }),
      ch('Grind at home in secret', ['impulsive'], (x) => { if (x.chance(0.7)) { x.money(cost(x, 15)); x.mods({ fitness: 1 }); return 'A hand quern under the floorboards. Rebellion, one handful at a time.'; } x.money(-cost(x, 60)); return 'The bailiff smashed your quern and fined you for the pleasure.'; }),
      ch('Rally the neighbours', ['ambitious'], (x) => { x.train('leadership', 3); x.mods({ popularity: 3, stress: 3 }); return 'The miller lowered his cut. For a month.'; }, 'riot'),
    ],
  },
  {
    id: 'er_scriptorium', cat: 'era', minAge: 12, years: [600, 1450], when: europe, scene: 'library',
    title: 'Gold on vellum', text: 'In the scriptorium, monks are painting a gospel book with gold leaf and crushed beetles.',
    choices: [
      ch('Grind the pigments', ['help'], (x) => { x.train('painting', 3); x.mods({ creativity: 2 }); return 'Your fingers were blue for a month. The book is still glowing.'; }, 'painting'),
      ch('Draw a rude doodle in the margin', ['impulsive'], (x) => { x.train('humor', 2); x.mods({ happiness: 3, sin: 1 }); return 'A snail fighting a knight. Scholars will discuss it for centuries.'; }),
      ch('Copy a page carefully', ['cautious'], (x) => { x.train('literacy', 3); x.mods({ discipline: 3 }); return 'One page took a week. You understood what patience is for.'; }),
    ],
  },
  {
    id: 'er_guildCharter', cat: 'era', minAge: 16, years: [1100, 1600], when: europe, scene: 'meeting',
    title: 'Joining a guild', text: 'The town guild will take you on, if you pay the fee and swear its oaths.',
    choices: [
      ch('Pay and swear', ['ambitious'], (x) => { if (!pay(x, 150)) return 'You could not raise the fee. The masters shrugged.'; x.train('artisanship', 4); x.mods({ professionalRep: 4 }); x.setFlag('er_guild', true); return 'You have a trade, a banner and a seat at the guild feast.'; }),
      ch('Work outside the guild', ['impulsive'], (x) => { x.money(cost(x, 60)); x.mods({ stress: 3 }); return 'Cheaper than guild work, so customers came. So did the guild\'s men.'; }),
      ch('Stay on the land', ['cautious'], (x) => { x.train('farming', 2); return 'Cities, you decided, are for other people.'; }, 'farm'),
    ],
  },
];

// ================================================================== RENAISSANCE (1400..1699)
const RENAISSANCE: EventDef[] = [
  {
    id: 'er_patron', cat: 'era', minAge: 16, years: [1420, 1690], when: inCountry('it', 'fr', 'es', 'gb', 'de'), scene: 'painting',
    title: 'A wealthy patron', text: 'A banker with more money than taste wants a portrait that makes him look like a Roman emperor.',
    choices: [
      ch('Flatter him on canvas', ['ambitious'], (x) => { x.train('painting', 3); x.money(cost(x, 800)); x.mods({ professionalRep: 2, ego: 1 }); return 'You gave him a jawline he never had. He paid double.'; }),
      ch('Paint him honestly', ['impulsive'], (x) => { x.train('painting', 5); x.mods({ creativity: 3 }); return x.chance(0.4) ? 'He was furious. Two centuries later, critics called it a masterpiece.' : 'He hung it in a dark corridor and never paid in full.'; }),
      ch('Politely decline', ['cautious'], (x) => { x.mods({ wisdom: 1 }); return 'Your integrity remains intact. Your purse remains empty.'; }),
    ],
  },
  {
    id: 'er_maskedBall', cat: 'era', minAge: 16, years: [1450, 1699], when: inCountry('it', 'fr', 'es', 'gb'), scene: 'royalBall',
    title: 'The masked ball', text: 'Behind velvet masks, everyone is someone else tonight, and the music is very loud.',
    choices: [
      ch('Dance with a stranger', ['impulsive'], (x) => { x.train('dance', 3); x.mods({ happiness: 4, loneliness: -3 }); return 'You never learned who they were. You still think about that dance.'; }, 'dance'),
      ch('Gossip behind a fan', ['social'], (x) => { x.train('gossip', 3); x.mods({ popularity: 2 }); return 'You learned three secrets and invented a fourth.'; }),
      ch('Slip away early', ['cautious'], (x) => { x.mods({ stress: -2 }); return 'Masks hide faces and also very bad intentions. You went home.'; }),
    ],
  },
  {
    id: 'er_pamphlet', cat: 'era', minAge: 14, years: [1500, 1699], when: europe, scene: 'newsroom',
    title: 'Pamphlet wars', text: 'Cheap printed pamphlets are everywhere, each calling the other side the Antichrist.',
    choices: [
      ch('Write your own', ['ambitious'], (x) => { x.train('writing', 4); x.mods({ fame: 2 }); if (x.chance(0.2)) { x.money(-cost(x, 200)); x.mods({ stress: 6 }); return 'The authorities did not care for your opinions, and fined you to prove it.'; } return 'Your pamphlet sold out. Someone wrote one attacking it. You have arrived.'; }),
      ch('Read every side', ['cautious'], (x) => { x.train('literacy', 3); x.mods({ wisdom: 3 }); return 'Everyone was certain. Everyone was angry. You learned a lot.'; }, 'reading'),
      ch('Use them as kindling', ['impulsive'], (x) => { x.mods({ happiness: 1 }); return 'Theology burns surprisingly well.'; }, 'fire'),
    ],
  },
  {
    id: 'er_voyage', cat: 'travel', minAge: 16, maxAge: 45, years: [1490, 1699], when: inCountry('es', 'gb', 'fr', 'it'), cooldown: 10, scene: 'travel',
    title: 'Ships for the New World', text: 'A captain is hiring hands for a voyage across the ocean. The pay is good. The odds are not.',
    choices: [
      ch('Sign on', ['impulsive', 'ambitious'], (x) => { x.train('sailing', 5); if (x.chance(0.25)) { x.mods({ health: -12, trauma: 5 }); return 'Scurvy, storms and a coast you barely saw. You came back thinner and older.'; } x.money(cost(x, 1500)); x.remember('voyage', 'Crossed the ocean on a sailing ship', 45); return 'You saw a new continent and came home with silver and stories.'; }),
      ch('Invest in the cargo', ['ambitious'], (x) => { const s = cost(x, 400); if (!x.spend(s)) return 'You could not raise a stake.'; if (x.chance(0.45)) { x.money(s * 3); return `The ship came back loaded. You tripled your money: ${x.fmt(s * 3)}.`; } return 'The ship never came back. Neither did your money.'; }, 'moneyUp'),
      ch('Stay on dry land', ['cautious'], (x) => { x.mods({ stress: -1 }); return 'Wiser, poorer, and very much alive.'; }),
    ],
  },
  {
    id: 'er_holyOffice', cat: 'era', minAge: 14, years: [1480, 1700], when: inCountry('es', 'it', 'mx', 'co'), cooldown: 10, scene: 'court',
    title: 'A neighbour denounced', text: 'Officers of the Inquisition have taken your neighbour for questioning about heresy. Others are being asked what they know.',
    choices: [
      ch('Speak for their good character', ['help'], (x) => { x.mods({ karma: 6, stress: 8 }); if (x.chance(0.3)) { x.mods({ fear: 6 }); return 'They released your neighbour, and wrote your name down too.'; } return 'Your words were noted. Your neighbour came home, shaken but free.'; }),
      ch('Stay silent', ['cautious'], (x) => { x.mods({ stress: 4, sin: 1 }); return 'Silence kept you safe. It also kept you awake.'; }),
      ch('Hide their books for them', ['help', 'impulsive'], (x) => { x.mods({ karma: 4, heat: 4 }); x.secret('er_hiddenBooks', 'Hid forbidden books during the Inquisition', 40); return 'The books sat under your floor for years. Nobody ever knew.'; }),
    ],
  },
  {
    id: 'er_witchHysteria', cat: 'era', minAge: 14, years: [1450, 1700], when: (x) => ['de', 'gb', 'fr', 'ch', 'es'].includes(x.c.countryId) || (x.c.countryId === 'us' && x.year >= 1640), cooldown: 12, scene: 'court',
    title: 'Accusations', text: 'After a bad harvest, fear has turned into accusations. An old woman who sells herbs has been named a witch.',
    choices: [
      ch('Speak in her defence', ['help'], (x) => { x.mods({ karma: 8, empathy: 3, stress: 8, popularity: -3 }); x.remember('er_witchDefence', 'Defended a woman accused of witchcraft', 50); return x.chance(0.4) ? 'Your testimony helped. She was released, and you were shunned for a while.' : 'You spoke up. It was not enough. You will carry that, and you were right to try.'; }),
      ch('Keep your head down', ['cautious'], (x) => { x.mods({ stress: 5, depression: 2 }); return 'You stayed safe while fear did its work. It does not feel like safety.'; }),
      ch('Name someone else', ['impulsive'], (x) => { x.mods({ sin: 10, karma: -10, paranoia: 4 }); x.secret('er_falseAccuser', 'Falsely accused a neighbour during the witch hunts', 70); return 'The mob turned elsewhere. You know exactly what you did.'; }),
    ],
  },
  {
    id: 'er_printShop', cat: 'era', minAge: 10, years: [1450, 1600], when: europe, once: true, scene: 'invention',
    title: 'The printing press', text: 'A printer has set up shop in town. Books that took monks a year now take him a week.',
    choices: [
      ch('Apprentice at the press', ['ambitious'], (x) => { x.train('literacy', 5); x.train('artisanship', 2); return 'Ink to the elbows, and you can read backwards now.'; }, 'library'),
      ch('Buy a printed book', ['impulsive'], (x) => { if (!pay(x, 100)) return 'One book cost more than a cow. You looked at it lovingly.'; x.mods({ smarts: 2, happiness: 2 }); return 'Your very own book. You read it until the binding gave up.'; }, 'reading'),
      ch('Distrust the devil\'s machine', ['cautious'], (x) => { x.mods({ faith: 1, wisdom: -1 }); return 'Your grandchildren will find this funny.'; }),
    ],
  },
  {
    id: 'er_anatomy', cat: 'era', minAge: 14, years: [1540, 1699], when: inCountry('it', 'fr', 'gb', 'de'), scene: 'lab',
    title: 'The anatomy lesson', text: 'A professor is dissecting an executed criminal in a wooden theatre packed with students.',
    choices: [
      ch('Take notes', ['ambitious'], (x) => { x.train('medicine', 4); x.mods({ smarts: 2 }); return 'The body is a machine, he said. You started seeing gears everywhere.'; }),
      ch('Sketch what you see', ['social'], (x) => { x.train('art', 3); x.train('biology', 2); return 'Your drawings were better than the professor\'s. He borrowed them.'; }, 'painting'),
      ch('Faint politely', ['cautious'], (x) => { x.mods({ ego: -2 }); return 'You woke up in the arms of a medical student who knew exactly what had happened.'; }),
    ],
  },
  {
    id: 'er_coffeehouse', cat: 'era', minAge: 16, years: [1650, 1800], when: inCountry('gb', 'fr', 'it', 'de'), scene: 'bar',
    title: 'The coffee house', text: 'A new kind of place: for a penny, you get a bitter black drink and all the arguments you can handle.',
    choices: [
      ch('Debate politics', ['ambitious'], (x) => { x.train('publicSpeaking', 3); x.mods({ confidence: 2 }); return 'You argued until closing and made a lifelong enemy and two friends.'; }),
      ch('Read the news sheets', ['cautious'], (x) => { x.mods({ smarts: 2, wisdom: 1 }); return 'Shipping lists, scandals and a poem about a dog. All the news.'; }, 'reading'),
      ch('Buy shares in a voyage', ['impulsive'], (x) => { const s = cost(x, 300); if (!x.spend(s)) return 'You could not afford a share.'; if (x.chance(0.5)) { x.money(Math.round(s * 2.2)); return 'The ship came home. Your coffee tasted sweeter.'; } return 'The ship did not. Your coffee tasted of ash.'; }, 'stocks'),
    ],
  },
  {
    id: 'er_tulipFever', cat: 'era', minAge: 18, years: [1630, 1640], when: europe, once: true, scene: 'stocks',
    title: 'Tulip fever', text: 'People are paying a fortune for single tulip bulbs. A cousin swears prices can only rise.',
    choices: [
      ch('Buy a rare bulb', ['impulsive'], (x) => { const s = cost(x, 2000); if (!x.spend(s)) return 'You could not afford even a modest bulb.'; if (x.chance(0.3)) { x.money(s * 3); return 'You sold just before the crash. Pure, undeserved luck.'; } x.mods({ stress: 6 }); return 'The market collapsed overnight. You own a very expensive flower.'; }),
      ch('Sell to the fools', ['ambitious'], (x) => { x.money(cost(x, 500)); x.train('sales', 2); return 'You sold your garden tulips for absurd money. No regrets.'; }),
      ch('Plant onions', ['cautious'], (x) => { x.mods({ wisdom: 3 }); return 'Onions: never a bubble, always edible.'; }, 'gardening'),
    ],
  },
  {
    id: 'er_tobacco', cat: 'era', minAge: 16, years: [1560, 1699], when: europe, once: true, scene: 'bar',
    title: 'The new leaf', text: 'Sailors have brought home a dried leaf from across the ocean that people set on fire and inhale.',
    choices: [
      ch('Try a pipe', ['impulsive'], (x) => { x.mods({ happiness: 2, health: -2 }); x.setFlag('er_smoker', true); return 'You coughed, then liked it, then could not stop.'; }),
      ch('Trade in it', ['ambitious'], (x) => { x.money(cost(x, 400)); return 'Everyone wanted some. You were happy to sell.'; }, 'moneyUp'),
      ch('Refuse the filthy habit', ['cautious'], (x) => { x.mods({ health: 1 }); return 'Your lungs will thank you in forty years.'; }),
    ],
  },
  {
    id: 'er_plagueTown', cat: 'era', minAge: 8, years: [1400, 1699], when: europe, cooldown: 15, weight: 0.6, scene: 'plague',
    title: 'Plague returns', text: 'Red crosses are being painted on doors. The plague has come back to town.',
    choices: [
      ch('Shut yourself in', ['cautious'], (x) => { x.mods({ stress: 6, loneliness: 4 }); return 'Weeks of silence and vinegar-soaked bread. You survived.'; }),
      ch('Flee to the country', ['impulsive'], (x) => { pay(x, 50); x.mods({ stress: 3 }); return x.chance(0.85) ? 'Fresh air and fear. You made it.' : 'You brought it with you. A fever followed you for weeks.'; }, 'refugees'),
      ch('Nurse the sick', ['help'], (x) => { x.train('medicine', 3); x.mods({ karma: 8, empathy: 4 }); if (x.chance(0.3)) { x.mods({ health: -15 }); return 'You caught it and somehow lived. Not everyone you nursed did.'; } return 'You held hands nobody else would. Some of them lived.'; }, 'sick'),
    ],
  },
  {
    id: 'er_playhouse', cat: 'era', minAge: 8, years: [1576, 1642], when: inCountry('gb'), scene: 'theater',
    title: 'At the playhouse', text: 'There is a new play at the round wooden theatre on the south bank, with ghosts, kings and a very loud sword fight.',
    choices: [
      ch('Stand in the pit', ['social'], (x) => { pay(x, 2); x.mods({ happiness: 4 }); return 'You threw nutshells at the villain and cried at the end.'; }),
      ch('Pay for a cushion', ['cautious'], (x) => { pay(x, 10); x.mods({ happiness: 3, ego: 1 }); return 'Gentry seats. You saw everything, including the playwright mouthing the lines.'; }),
      ch('Ask to join the company', ['ambitious'], (x) => { x.train('acting', 4); x.mods({ confidence: 3 }); return 'You got a small part: the third servant of the second lord. A start.'; }, 'stage'),
    ],
  },
  {
    id: 'er_telescope', cat: 'era', minAge: 12, years: [1610, 1699], when: europe, once: true, scene: 'stargazing',
    title: 'Through the spyglass', text: 'A scholar lets you look through his tube of lenses. The moon has mountains.',
    choices: [
      ch('Look at everything', ['impulsive'], (x) => { x.train('astronomy', 4); x.mods({ happiness: 3, wisdom: 2 }); return 'Jupiter has little moons. The universe got bigger in one night.'; }),
      ch('Ask what it means for heaven', ['cautious'], (x) => { x.mods({ faith: -2, wisdom: 3 }); return 'He told you to keep your voice down.'; }),
      ch('Build your own', ['ambitious'], (x) => { x.train('engineering', 3); x.train('physics', 2); return 'Your lenses were cloudy, but you saw a comet before anyone else in town.'; }, 'invention'),
    ],
  },
];

// ================================================================== INDUSTRIAL (1700..1899)
const INDUSTRIAL: EventDef[] = [
  {
    id: 'er_railway', cat: 'era', minAge: 8, years: [1830, 1899], when: (x) => western(x) || ['ru', 'in', 'jp', 'mx', 'za', 'br'].includes(x.c.countryId), once: true, scene: 'travel',
    title: 'The railway arrives', text: 'A smoking iron monster now runs through the valley at the terrifying speed of thirty miles an hour.',
    choices: [
      ch('Ride it', ['impulsive'], (x) => { pay(x, 10); x.mods({ happiness: 5 }); x.remember('er_firstTrain', 'First train ride', 30); return 'Fields blurred past. You arrived somewhere new before lunch.'; }),
      ch('Buy railway shares', ['ambitious'], (x) => { const s = cost(x, 1000); if (!x.spend(s)) return 'You could not afford shares. Everyone else seemed to.'; x.chain('er_railMania', 3, { stake: s }); return `You bought ${x.fmt(s)} of railway shares. The prospectus was very confident.`; }, 'stocks'),
      ch('Protest the noise', ['cautious'], (x) => { x.mods({ stress: 2 }); return 'The cows stopped giving milk, you claimed. The railway did not care.'; }),
    ],
  },
  {
    id: 'er_railReckoning', cat: 'era', triggered: true, scene: 'stocks',
    title: 'Railway shares', text: 'The railway boom has turned into a scramble. Your shares are either gold or wallpaper.',
    choices: [
      ch('Sell now', ['cautious'], (x) => { const s = Number(x.p.stake) || cost(x, 1000); const back = Math.round(s * x.float(0.4, 1.6)); x.money(back); return `You got out with ${x.fmt(back)}.`; }),
      ch('Hold on', ['impulsive'], (x) => { const s = Number(x.p.stake) || cost(x, 1000); if (x.chance(0.4)) { x.money(s * 3); return `Your line became a main line. You made ${x.fmt(s * 3)}.`; } x.mods({ stress: 6 }); return 'Your railway was never built. The shares make lovely wallpaper.'; }),
    ],
  },
  {
    id: 'er_factory', cat: 'era', minAge: 14, years: [1760, 1899], when: (x) => western(x) || ['ru', 'jp'].includes(x.c.countryId), cooldown: 5, scene: 'factory',
    title: 'The mill bell', text: 'The new mill pays in coin, not in turnips. The shifts are fourteen hours and the looms never stop.',
    choices: [
      ch('Take the work', ['ambitious'], (x) => { x.money(cost(x, 600)); x.mods({ health: -3, fitness: -1, stress: 5 }); return 'Steady wages, cotton in your lungs, and a clock that owns your days.'; }),
      ch('Organise the workers', ['help'], (x) => { x.train('leadership', 4); x.mods({ karma: 3, popularity: 3 }); if (x.chance(0.35)) { x.mods({ stress: 8 }); return 'You were dismissed and blacklisted. The others got a shorter day.'; } return 'The owner gave in to a ten-minute dinner break. History moves in minutes.'; }, 'riot'),
      ch('Stay on the farm', ['cautious'], (x) => { x.train('farming', 2); return 'Poorer, but you still see the sun.'; }, 'farm'),
    ],
  },
  {
    id: 'er_choleraPump', cat: 'era', minAge: 10, years: [1830, 1899], when: (x) => western(x) || ['ru', 'in', 'eg'].includes(x.c.countryId), cooldown: 10, scene: 'plague',
    title: 'The street pump', text: 'Cholera is back in the crowded streets. People blame bad air, but one doctor thinks it is the water.',
    choices: [
      ch('Drink from the pump', ['impulsive'], (x) => { if (x.chance(0.3)) { x.mods({ health: -15 }); return 'Days of terrible sickness. You were one of the lucky ones.'; } return 'The water tasted fine. That proved nothing.'; }, 'sick'),
      ch('Boil all your water', ['cautious'], (x) => { x.mods({ health: 2 }); return 'Your neighbours laughed. Your neighbours got sick.'; }),
      ch('Help the doctor map cases', ['help'], (x) => { x.train('science', 4); x.train('dataAnalysis', 2); x.mods({ karma: 4, smarts: 2 }); return 'Dots on a map, clustered around one pump. You helped prove something.'; }, 'lab'),
    ],
  },
  {
    id: 'er_suffrageMarch', cat: 'era', minAge: 14, years: [1866, 1928], when: inCountry('gb', 'us', 'au', 'de', 'fr'), cooldown: 6, scene: 'parade',
    title: 'Votes for women', text: 'Suffragists are marching through town with sashes and banners. Some onlookers jeer.',
    choices: [
      ch('March with them', ['help'], (x) => { x.mods({ karma: 4, confidence: 3, politicalApproval: 2 }); return 'Your feet ached and your heart was full.'; }),
      ch('Donate to the cause', ['help'], (x) => { pay(x, 50); x.mods({ karma: 3 }); return 'Your coins became leaflets. The leaflets became votes, eventually.'; }),
      ch('Watch from the pavement', ['cautious'], (x) => { x.mods({ wisdom: 1 }); return 'History marched past. You saw it go.'; }),
    ],
  },
  {
    id: 'er_telegram', cat: 'era', minAge: 14, years: [1850, 1930], scene: 'office',
    title: 'Send a telegram', text: 'Words can now cross the country in minutes along a copper wire. Every word costs money.',
    choices: [
      ch('Send a short one', ['cautious'], (x) => { pay(x, 5); x.mods({ loneliness: -2 }); return '"ARRIVED SAFE STOP LOVE STOP" Poetry at a price.'; }),
      ch('Learn Morse code', ['ambitious'], (x) => { x.train('electrical', 3); x.mods({ smarts: 2 }); return 'Dots and dashes in your dreams. A job at the telegraph office is open.'; }),
      ch('Write a long one anyway', ['impulsive'], (x) => { pay(x, 40); x.mods({ happiness: 2 }); return 'The clerk counted the words with visible joy.'; }),
    ],
  },
  {
    id: 'er_gaslight', cat: 'era', minAge: 10, years: [1812, 1899], when: (x) => western(x) || x.c.countryId === 'ru', once: true, scene: 'invention',
    title: 'Gaslight', text: 'Gas lamps now light the streets and the parlour. Night has become a choice, not a fact.',
    choices: [
      ch('Read late into the night', ['cautious'], (x) => { x.mods({ smarts: 2, energy: -2 }); return 'You finished three novels in a week.'; }, 'reading'),
      ch('Stay out after dark', ['impulsive'], (x) => { x.mods({ happiness: 3 }); return 'Theatres, music halls, and walks under the hissing lamps.'; }, 'bar'),
      ch('Worry about explosions', ['cautious'], (x) => { x.mods({ anxiety: 2 }); return 'You check the taps every night. Twice.'; }),
    ],
  },
  {
    id: 'er_pennyDreadful', cat: 'era', minAge: 8, years: [1830, 1900], when: inCountry('gb', 'us', 'au'), scene: 'reading',
    title: 'Penny dreadful', text: 'A new instalment of a lurid serial about a demon barber is out, for one penny.',
    choices: [
      ch('Buy every issue', ['impulsive'], (x) => { pay(x, 3); x.mods({ happiness: 3, creativity: 2 }); return 'You read it by candlelight and did not sleep for a week.'; }),
      ch('Write your own serial', ['ambitious'], (x) => { x.train('writing', 4); x.money(cost(x, 50)); return 'A villain, a fog, a trapdoor. The publisher paid by the word.'; }),
      ch('Read something improving', ['cautious'], (x) => { x.mods({ smarts: 2, happiness: -1 }); return 'A sermon on thrift. It was not dreadful, only dull.'; }),
    ],
  },
  {
    id: 'er_greatExhibition', cat: 'travel', minAge: 8, years: [1851, 1900], when: (x) => western(x), cooldown: 15, scene: 'museum',
    title: 'The great exhibition', text: 'A palace of glass and iron is showing the wonders of the world: engines, diamonds and a stuffed elephant.',
    choices: [
      ch('See every hall', ['impulsive'], (x) => { pay(x, 10); x.mods({ happiness: 4, smarts: 2 }); return 'Steam hammers, silk looms, a giant diamond. Your feet gave out before your wonder did.'; }),
      ch('Study the machines', ['ambitious'], (x) => { x.train('engineering', 4); return 'You sketched a pump design on your sleeve and never forgot it.'; }, 'invention'),
      ch('Take the family', ['help'], (x) => { pay(x, 25); x.mods({ happiness: 3, loneliness: -3 }); return 'The children talked about the elephant for a year.'; }, 'family'),
    ],
  },
  {
    id: 'er_photograph', cat: 'era', minAge: 4, years: [1845, 1910], scene: 'gadget',
    title: 'Sitting for a photograph', text: 'A photographer is making portraits. You must hold perfectly still for a very long time.',
    choices: [
      ch('Look serious', ['cautious'], (x) => { pay(x, 20); x.remember('er_portrait', `Had a photograph taken in ${fmtYear(x.year)}`, 25); return 'Your descendants will think you never smiled. You did, just not for that long.'; }),
      ch('Try to smile', ['impulsive'], (x) => { pay(x, 20); x.mods({ happiness: 2 }); return 'The result was a blur with teeth.'; }),
      ch('Buy a camera yourself', ['ambitious'], (x) => { if (!pay(x, 400)) return 'Far too expensive. Maybe one day.'; x.train('photography', 5); return 'Glass plates, chemicals, stained fingers. A new obsession.'; }, undefined, (x) => x.age >= 16),
    ],
  },
  {
    id: 'er_raggedSchool', cat: 'era', minAge: 7, maxAge: 13, years: [1780, 1880], when: (x) => western(x), scene: 'classroom',
    title: 'Mill or school', text: 'The mill is hiring children to crawl under the machines. A charity school down the road teaches reading for free.',
    choices: [
      ch('Go to school', ['cautious'], (x) => { x.train('literacy', 5); x.mods({ smarts: 3 }); return 'Chalk, slates and a teacher who believed in you.'; }),
      ch('Work at the mill', ['help'], (x) => { x.money(cost(x, 80)); x.mods({ health: -4, happiness: -3 }); return 'Your pennies helped feed your family. Your childhood paid for it.'; }, 'factory'),
      ch('Run off to play', ['impulsive'], (x) => { x.mods({ happiness: 4 }); return 'You spent the day by the river. It was the best day of the year.'; }, 'playground'),
    ],
  },
  {
    id: 'er_bicycle', cat: 'era', minAge: 10, years: [1868, 1910], when: (x) => western(x), scene: 'sports',
    title: 'Bicycle craze', text: 'Everyone wants a bicycle. Doctors warn of "bicycle face". Nobody listens.',
    choices: [
      ch('Buy one', ['impulsive'], (x) => { if (!pay(x, 150)) return 'Too dear. You borrowed a friend\'s and fell off.'; x.train('cycling', 4); x.mods({ fitness: 3, happiness: 4 }); return 'Freedom on two wheels. You rode to the next town for no reason.'; }),
      ch('Join a cycling club', ['social'], (x) => { x.train('cycling', 3); x.mods({ popularity: 3, loneliness: -3 }); return 'Matching caps, Sunday rides and fierce opinions about tyres.'; }, 'friends'),
      ch('Stick to walking', ['cautious'], (x) => { x.mods({ fitness: 1 }); return 'Your face stayed perfectly ordinary.'; }),
    ],
  },
  {
    id: 'er_salon', cat: 'era', minAge: 16, years: [1720, 1789], when: inCountry('fr', 'gb', 'de'), scene: 'friends',
    title: 'The salon', text: 'A clever hostess gathers writers, scientists and scandalous wits every Tuesday afternoon.',
    choices: [
      ch('Talk philosophy', ['ambitious'], (x) => { x.train('philosophy', 4); x.mods({ smarts: 2 }); return 'Reason, liberty and a great deal of cake.'; }),
      ch('Be witty', ['social'], (x) => { x.train('humor', 3); x.mods({ popularity: 4, charisma: 2 }); return 'Your joke about the king was repeated all over town. Carefully.'; }),
      ch('Listen and learn', ['cautious'], (x) => { x.mods({ wisdom: 3 }); return 'You heard ideas that would one day topple thrones.'; }),
    ],
  },
  {
    id: 'er_vaccination', cat: 'era', minAge: 2, years: [1800, 1899], cooldown: 30, scene: 'checkup',
    title: 'The cowpox scratch', text: 'A doctor is offering vaccination against smallpox, using matter from cowpox blisters.',
    choices: [
      ch('Roll up your sleeve', ['cautious'], (x) => { x.mods({ immunity: 8, health: 2 }); return 'A scratch, a small sore, and protection from a terrible disease.'; }),
      ch('Refuse the cow stuff', ['impulsive'], (x) => { x.mods({ immunity: -2 }); return 'A cartoonist drew vaccinated people sprouting cow heads. You believed it.'; }),
      ch('Help the doctor', ['help'], (x) => { x.train('medicine', 3); x.mods({ karma: 3 }); return 'You held a hundred trembling hands that day.'; }, 'surgery', (x) => x.age >= 14),
    ],
  },
];

// ================================================================== MODERN EARLY (1900..1949)
const MODERN_EARLY: EventDef[] = [
  {
    id: 'er_motorCar', cat: 'era', minAge: 10, years: [1905, 1940], when: (x) => western(x), once: true, scene: 'car',
    title: 'The motor car', text: 'A neighbour has bought a motor car. It is loud, black, and frightens every horse in the county.',
    choices: [
      ch('Buy one too', ['impulsive', 'ambitious'], (x) => { if (!pay(x, 3000)) return 'It cost more than a house. You settled for admiring it.'; x.train('autoRepair', 3); x.mods({ happiness: 5, ego: 2 }); return 'Goggles, gloves and a breakdown every ten miles. Bliss.'; }, undefined, (x) => x.age >= 18),
      ch('Beg for a ride', ['social'], (x) => { x.mods({ happiness: 4 }); return 'Twenty miles an hour with the wind in your face. You screamed with joy.'; }),
      ch('Stick with the horse', ['cautious'], (x) => { x.train('horsemanship', 1); return 'Your horse never runs out of petrol. It does run out of patience.'; }, 'petHorse'),
    ],
  },
  {
    id: 'er_pictureHouse', cat: 'era', minAge: 6, years: [1905, 1949], scene: 'cinema',
    title: 'The picture house', text: (x) => (x.year < 1929 ? 'A silent film is showing, with a pianist hammering away beneath the screen.' : 'The new talking pictures are showing tonight, in glorious black and white.'),
    choices: [
      ch('Go every Saturday', ['impulsive'], (x) => { pay(x, 2); x.mods({ happiness: 4 }); return 'Cowboys, comedians and newsreels. Your week revolves around it.'; }),
      ch('Take someone special', ['social'], (x) => { pay(x, 4); x.mods({ loneliness: -4, happiness: 3 }); return 'You missed most of the film. You were busy being nervous.'; }, undefined, (x) => x.age >= 16),
      ch('Dream of acting', ['ambitious'], (x) => { x.train('acting', 3); x.mods({ creativity: 2 }); return 'You practised dramatic faces in the mirror for a month.'; }),
    ],
  },
  {
    id: 'er_radioSerial', cat: 'era', minAge: 5, years: [1925, 1955], scene: 'gadget',
    title: 'The wireless', text: 'The whole family gathers around the radio for the evening serial and the news.',
    choices: [
      ch('Never miss an episode', ['cautious'], (x) => { x.mods({ happiness: 3, loneliness: -2 }); return 'Cliffhanger every Friday. You lived for Mondays.'; }, 'family'),
      ch('Build a crystal set', ['ambitious'], (x) => { x.train('electronicsRepair', 4); x.mods({ smarts: 2 }); return 'A coil, a cat\'s whisker and music from the air.'; }, 'invention'),
      ch('Sing along to the dance band', ['social'], (x) => { x.train('singing', 2); x.mods({ happiness: 3 }); return 'The neighbours banged on the wall. You sang louder.'; }, 'music'),
    ],
  },
  {
    id: 'er_speakeasy', cat: 'era', minAge: 18, years: [1920, 1933], when: inCountry('us'), scene: 'bar',
    title: 'The speakeasy', text: 'Alcohol is banned, but behind an unmarked door, a band is playing and the gin is flowing.',
    choices: [
      ch('Give the password', ['impulsive'], (x) => { pay(x, 10); x.mods({ happiness: 4, health: -1 }); if (x.chance(0.12)) { x.mods({ stress: 6 }); return 'The police raided it. You escaped through the kitchen with a stranger\'s hat.'; } return 'Jazz, bathtub gin and a night that ended at dawn.'; }, 'party'),
      ch('Run liquor for the owner', ['ambitious'], (x) => { x.money(cost(x, 800)); x.mods({ criminalRep: 3, heat: 4 }); return 'Crates in the truck, cash in your pocket, sweat on your neck.'; }, 'smuggling'),
      ch('Stay dry', ['cautious'], (x) => { x.mods({ health: 1 }); return 'You went home to a glass of milk and a clear head.'; }),
    ],
  },
  {
    id: 'er_soupLine', cat: 'era', minAge: 8, years: [1930, 1939], when: (x) => western(x), cooldown: 3, weight: 1.4, scene: 'volunteer',
    title: 'The soup line', text: 'Hundreds of people are queuing for soup and bread outside the church. Many wear their only good suit.',
    choices: [
      ch('Join the queue', ['cautious'], (x) => { x.mods({ ego: -3, health: 1 }); x.money(cost(x, 20)); return 'Thin soup and quiet dignity. Nobody looked anybody in the eye.'; }, undefined, (x) => x.c.money < cost(x, 5000)),
      ch('Ladle the soup', ['help'], (x) => { x.mods({ karma: 5, empathy: 3 }); return 'You served four hundred bowls and heard four hundred stories.'; }),
      ch('Donate what you can', ['help'], (x) => { pay(x, 100); x.mods({ karma: 4 }); return 'A sack of potatoes became dinner for a whole street.'; }, undefined, (x) => x.c.money > cost(x, 2000)),
    ],
  },
  {
    id: 'er_rationBook', cat: 'era', minAge: 8, years: [1940, 1949], when: inCountry('gb', 'us', 'de', 'fr', 'it', 'jp', 'ru', 'au'), cooldown: 3, weight: 1.4, scene: 'cooking',
    title: 'Ration books', text: 'Meat, sugar, butter and tea are all rationed. Your ration book is the most valuable thing you own.',
    choices: [
      ch('Make do and mend', ['cautious'], (x) => { x.train('cooking', 3); x.mods({ discipline: 2 }); return 'Carrot cake, mock banana and a pie made of mostly hope.'; }),
      ch('Buy on the black market', ['impulsive'], (x) => { if (!pay(x, 80)) return 'You could not afford the spiv\'s prices.'; x.mods({ happiness: 3, sin: 1 }); return 'Real butter, from a man in a long coat who knew nothing.'; }, 'bribe'),
      ch('Dig for victory', ['help'], (x) => { x.train('farming', 3); x.mods({ health: 2, karma: 1 }); return 'Your lawn became a vegetable patch. The potatoes were glorious.'; }, 'gardening'),
    ],
  },
  {
    id: 'er_danceHall', cat: 'era', minAge: 16, years: [1920, 1949], scene: 'dance',
    title: 'The dance hall', text: (x) => (x.year < 1935 ? 'The band is playing the Charleston and everyone is kicking their heels.' : 'The swing band is in full flight and the floor is packed.'),
    choices: [
      ch('Dance all night', ['impulsive'], (x) => { x.train('dance', 4); x.mods({ happiness: 5, fitness: 2 }); return 'You wore a hole in your shoes. Worth it.'; }),
      ch('Ask someone to dance', ['social'], (x) => { x.mods({ confidence: 3, loneliness: -3 }); return x.chance(0.6) ? 'They said yes. You stepped on their feet only twice.' : 'They said no. You danced with your friend instead and had a better time.'; }),
      ch('Hold up the wall', ['cautious'], (x) => { x.mods({ loneliness: 2 }); return 'You watched, tapped your foot, and promised yourself next time.'; }, 'lonely'),
    ],
  },
  {
    id: 'er_barnstormers', cat: 'era', minAge: 8, years: [1912, 1939], scene: 'travel',
    title: 'The flying circus', text: 'A biplane has landed in a farmer\'s field. Pilots are doing loops and selling five-minute rides.',
    choices: [
      ch('Buy a ride', ['impulsive'], (x) => { pay(x, 15); x.mods({ happiness: 6 }); x.remember('er_firstFlight', 'First time in an aeroplane', 30); return 'The fields looked like a quilt. You have never forgotten it.'; }),
      ch('Ask to learn to fly', ['ambitious'], (x) => { x.train('aircraftMaintenance', 3); x.mods({ riskTolerance: 3 }); return 'The pilot let you hold the stick for ten terrifying seconds.'; }),
      ch('Watch from the ground', ['cautious'], (x) => { x.mods({ happiness: 2 }); return 'One plane flew upside down. Your hat flew off.'; }),
    ],
  },
  {
    id: 'er_partyLine', cat: 'era', minAge: 10, years: [1905, 1955], when: inCountry('us', 'gb', 'au', 'ch'), scene: 'gadget',
    title: 'The party line', text: 'Your telephone shares a line with five other houses. If you pick up quietly, you can hear everything.',
    choices: [
      ch('Listen in', ['impulsive'], (x) => { x.train('gossip', 3); x.mods({ sin: 1 }); return 'The doctor\'s wife is planning to leave. You know before the doctor does.'; }),
      ch('Hang up politely', ['cautious'], (x) => { x.mods({ karma: 1 }); return 'Some secrets should stay on the line.'; }),
      ch('Make a long call', ['social'], (x) => { pay(x, 5); x.mods({ loneliness: -3 }); return 'Four neighbours sighed loudly in the background.'; }),
    ],
  },
  {
    id: 'er_blackout', cat: 'era', minAge: 4, years: [1939, 1945], when: inCountry('gb', 'de', 'fr', 'ru', 'jp', 'it'), cooldown: 2, weight: 1.3, scene: 'war',
    title: 'Air raid', text: 'The sirens are wailing again. The windows are blacked out and the planes are close.',
    choices: [
      ch('Run to the shelter', ['cautious'], (x) => { x.mods({ anxiety: 4, stress: 4 }); return 'A night underground, singing songs with strangers until the all-clear.'; }),
      ch('Volunteer as a warden', ['help'], (x) => { x.mods({ karma: 5, trauma: 3, confidence: 3 }); return 'You pulled a family out of the rubble. You will never forget their faces.'; }, 'fire', (x) => x.age >= 16),
      ch('Stay in bed', ['impulsive'], (x) => { if (x.chance(0.12)) { x.mods({ health: -12, trauma: 6 }); return 'The house next door was hit. You were lucky. Others were not.'; } x.mods({ stress: 3 }); return 'The bombs fell elsewhere tonight.'; }),
    ],
  },
  {
    id: 'er_evacuee', cat: 'era', minAge: 4, maxAge: 14, years: [1939, 1944], when: inCountry('gb', 'de', 'jp'), once: true, scene: 'moving',
    title: 'Evacuated', text: 'With a gas mask box and a label on your coat, you are being sent to the countryside to live with strangers.',
    choices: [
      ch('Make the best of it', ['cautious'], (x) => { x.mods({ resilience: 4, loneliness: 3 }); x.train('farming', 2); return 'You learned to milk a cow and missed your mother every night.'; }, 'farm'),
      ch('Befriend the farm children', ['social'], (x) => { x.mods({ happiness: 3, loneliness: -3 }); return 'Friends for life, made in a hayloft.'; }, 'friends'),
      ch('Try to walk home', ['impulsive'], (x) => { x.mods({ stress: 5 }); return 'A policeman found you ten miles down the road and bought you a bun.'; }),
    ],
  },
  {
    id: 'er_bobbedHair', cat: 'era', minAge: 16, years: [1920, 1930], when: (x) => western(x), once: true, scene: 'shopping',
    title: 'The bob', text: 'Short hair, short skirts and loud opinions are the fashion. Your aunt is scandalised in advance.',
    choices: [
      ch('Go modern', ['impulsive'], (x) => { x.mods({ looks: 2, confidence: 3, happiness: 3 }); return 'You looked in the mirror and saw a whole new century.'; }),
      ch('Keep it traditional', ['cautious'], (x) => { x.mods({ popularity: -1 }); return 'Your aunt approved. Nobody else noticed.'; }),
      ch('Open a salon', ['ambitious'], (x) => { x.train('fashionDesign', 2); x.money(cost(x, 400)); return 'Everyone wanted the cut, and you had the scissors.'; }, 'moneyUp'),
    ],
  },
  {
    id: 'er_letterFront', cat: 'era', minAge: 6, years: [1914, 1945], when: (x) => (x.year <= 1918 || x.year >= 1939) && ['gb', 'fr', 'de', 'it', 'ru', 'us', 'au', 'jp'].includes(x.c.countryId), cooldown: 3, scene: 'loveLetter',
    title: 'Letters from the front', text: 'A letter has arrived from a relative at the front. Parts of it are blacked out by the censor.',
    choices: [
      ch('Write back every week', ['help'], (x) => { x.train('writing', 2); x.mods({ empathy: 2, loneliness: -2 }); return 'You sent news of the dog, the garden and nothing sad.'; }),
      ch('Send a parcel', ['help'], (x) => { pay(x, 20); x.mods({ karma: 2 }); return 'Socks, chocolate and a photograph. It arrived months later, crushed but welcome.'; }),
      ch('Read between the lines', ['cautious'], (x) => { x.mods({ anxiety: 3, wisdom: 2 }); return 'They said they were fine. Their handwriting said otherwise.'; }, 'lonely'),
    ],
  },
];

// ================================================================== COLD WAR (1950..1989)
const COLD_WAR: EventDef[] = [
  {
    id: 'er_firstTV', cat: 'era', minAge: 4, years: [1950, 1968], once: true, scene: 'gadget',
    title: 'The television set', text: 'A wooden box with a tiny grey screen has arrived. The neighbours have come round to stare at it.',
    choices: [
      ch('Watch everything', ['impulsive'], (x) => { x.mods({ happiness: 4, fitness: -1 }); return 'Westerns, quiz shows and the test card. All of it magic.'; }),
      ch('Host the neighbours', ['social'], (x) => { x.mods({ popularity: 4, loneliness: -3 }); return 'Your living room became the street\'s cinema.'; }, 'familyDinner'),
      ch('Limit it to the news', ['cautious'], (x) => { x.mods({ smarts: 1 }); return 'The children called you a tyrant.'; }),
    ],
  },
  {
    id: 'er_rockAndRoll', cat: 'era', minAge: 12, maxAge: 30, years: [1954, 1966], scene: 'concert',
    title: 'Rock and roll', text: 'A new sound with loud guitars and swinging hips is on the radio. Parents are horrified.',
    choices: [
      ch('Dance to it', ['impulsive'], (x) => { x.train('dance', 3); x.mods({ happiness: 5 }); return 'Your parents called it jungle noise. You called it freedom.'; }, 'dance'),
      ch('Start a band', ['ambitious'], (x) => { x.train('music', 4); x.mods({ creativity: 3, popularity: 2 }); return 'Three chords, a garage and dreams the size of a stadium.'; }, 'music'),
      ch('Stick with crooners', ['cautious'], (x) => { x.mods({ popularity: -1 }); return 'Smooth, tasteful and slightly out of date.'; }),
    ],
  },
  {
    id: 'er_duckCover', cat: 'era', minAge: 5, maxAge: 14, years: [1951, 1965], when: inCountry('us'), once: true, scene: 'classroom',
    title: 'Duck and cover', text: 'At school, a cartoon turtle teaches you to hide under your desk if you see a bright flash.',
    choices: [
      ch('Practise seriously', ['cautious'], (x) => { x.mods({ anxiety: 3, discipline: 1 }); return 'You fell asleep listening for sirens for a year.'; }),
      ch('Ask if a desk really helps', ['ambitious'], (x) => { x.mods({ smarts: 2, wisdom: 1 }); return 'The teacher did not have a good answer.'; }),
      ch('Giggle under the desk', ['social'], (x) => { x.mods({ happiness: 2 }); return 'Your friend made turtle noises. Detention for both of you.'; }),
    ],
  },
  {
    id: 'er_moonBroadcast', cat: 'era', minAge: 3, years: [1969, 1969], once: true, weight: 6, scene: 'moonLanding',
    title: 'Men on the moon', text: 'Half the world is watching a blurry broadcast as astronauts step onto the moon.',
    choices: [
      ch('Stay up to watch', ['impulsive'], (x) => { x.mods({ happiness: 6, wisdom: 2 }); x.remember('er_moonLanding', 'Watched the moon landing live', 45); return 'A grainy boot on grey dust. You will tell people where you were for the rest of your life.'; }),
      ch('Watch with the neighbours', ['social'], (x) => { x.mods({ happiness: 5, loneliness: -4 }); x.remember('er_moonLanding', 'Watched the moon landing with the neighbours', 45); return 'Forty people around one set, cheering at a crackle.'; }, 'party'),
      ch('Go outside and look up', ['cautious'], (x) => { x.mods({ wisdom: 3, happiness: 3 }); return 'You could not see them, but you knew they were there.'; }, 'stargazing'),
    ],
  },
  {
    id: 'er_civilRightsMarch', cat: 'era', minAge: 12, years: [1955, 1968], when: inCountry('us'), cooldown: 4, scene: 'parade',
    title: 'The march', text: 'People of all ages are marching for equal rights, in their Sunday best, singing.',
    choices: [
      ch('March with them', ['help'], (x) => { x.mods({ karma: 6, confidence: 3, stress: 4 }); x.remember('er_civilRights', 'Marched for civil rights', 50); return 'Hostile crowds, police dogs, and a feeling of being part of something right.'; }),
      ch('Organise rides and food', ['help'], (x) => { x.train('logistics', 3); x.mods({ karma: 4 }); return 'Movements run on sandwiches and carpools. You made both happen.'; }, 'volunteer'),
      ch('Stay home', ['cautious'], (x) => { x.mods({ wisdom: 1 }); return 'You watched it on the news, and wondered later why you were not there.'; }),
    ],
  },
  {
    id: 'er_falloutShelter', cat: 'era', minAge: 18, years: [1955, 1966], when: inCountry('us', 'ch', 'gb'), once: true, scene: 'construction',
    title: 'The fallout shelter', text: 'Brochures say every family should build a fallout shelter. Your neighbour is digging one in his yard.',
    choices: [
      ch('Build one', ['cautious'], (x) => { if (!pay(x, 2500)) return 'You could not afford one. You stocked the cellar with tins instead.'; x.mods({ anxiety: 2 }); return 'Canned peaches, a radio and bunk beds. It became the best wine cellar on the street.'; }),
      ch('Mock the whole idea', ['impulsive'], (x) => { x.train('humor', 2); return 'If it comes, you said, you will be at the barbecue.'; }),
      ch('Join a peace group', ['help'], (x) => { x.mods({ karma: 3, politicalApproval: 1 }); return 'Badges, marches and very long meetings about disarmament.'; }, 'parade'),
    ],
  },
  {
    id: 'er_driveIn', cat: 'era', minAge: 16, years: [1950, 1980], when: inCountry('us', 'au', 'za'), scene: 'cinema',
    title: 'The drive-in', text: 'A double feature at the drive-in: a monster movie and a beach movie. Speakers hang on the car window.',
    choices: [
      ch('Bring a date', ['social'], (x) => { pay(x, 6); x.mods({ happiness: 4, loneliness: -3 }); return 'You could not tell anyone what either film was about.'; }, 'date', (x) => x.age >= 18),
      ch('Bring the whole gang', ['social'], (x) => { pay(x, 4); x.mods({ happiness: 4, popularity: 2 }); return 'Six people in one car and two in the trunk to save money.'; }, 'friends'),
      ch('Watch from the hill for free', ['impulsive'], (x) => { x.mods({ happiness: 2 }); return 'No sound, but you invented much better dialogue.'; }),
    ],
  },
  {
    id: 'er_disco', cat: 'era', minAge: 16, years: [1974, 1982], scene: 'party',
    title: 'Disco fever', text: 'The mirror ball is spinning and the floor lights up under your platform shoes.',
    choices: [
      ch('Own the dance floor', ['impulsive'], (x) => { x.train('dance', 4); x.mods({ happiness: 5, popularity: 3 }); return 'Polyester, sweat and glory. Your knees will remember.'; }),
      ch('Wear the white suit', ['ambitious'], (x) => { pay(x, 120); x.mods({ looks: 2, ego: 3 }); return 'Every head turned. One of them was laughing, but most were not.'; }),
      ch('Say disco is dead', ['cautious'], (x) => { x.mods({ popularity: -1 }); return 'You were early. It was dead by 1980. You were still annoying about it.'; }),
    ],
  },
  {
    id: 'er_walkman', cat: 'era', minAge: 8, years: [1979, 1992], once: true, scene: 'gadget',
    title: 'Music on the move', text: 'A pocket cassette player with foam headphones means your music goes wherever you go.',
    choices: [
      ch('Buy one', ['impulsive'], (x) => { if (!pay(x, 150)) return 'Too expensive. You borrowed your cousin\'s and broke it.'; x.mods({ happiness: 4 }); return 'Your life finally had a soundtrack.'; }),
      ch('Make mixtapes', ['social'], (x) => { x.train('music', 2); x.mods({ creativity: 3, loneliness: -2 }); return 'Recording off the radio, finger on pause, hoping the DJ shuts up.'; }, 'music'),
      ch('Rewind with a pencil', ['cautious'], (x) => { x.mods({ discipline: 1 }); return 'Thrifty. Saves the batteries. Very 1980s.'; }),
    ],
  },
  {
    id: 'er_arcade', cat: 'era', minAge: 8, maxAge: 35, years: [1978, 1992], scene: 'gaming',
    title: 'The arcade', text: 'The arcade is beeping, flashing and eating coins. Someone has the high score on every machine.',
    choices: [
      ch('Chase the high score', ['ambitious'], (x) => { pay(x, 10); x.train('gameDesign', 1); x.mods({ happiness: 4 }); return x.chance(0.3) ? 'Three letters at the top of the board. Your initials. Immortality.' : 'So close. So many coins.'; }),
      ch('Watch the experts', ['cautious'], (x) => { x.mods({ happiness: 2 }); return 'You learned the ghost patterns by heart.'; }),
      ch('Hang out with friends', ['social'], (x) => { x.mods({ loneliness: -4, popularity: 2 }); return 'Nobody played much. Everybody talked a lot.'; }, 'friends'),
    ],
  },
  {
    id: 'er_festival69', cat: 'era', minAge: 16, maxAge: 35, years: [1965, 1975], when: (x) => western(x), cooldown: 5, scene: 'concert',
    title: 'Music festival', text: 'Three days of music, mud and flowers in a farmer\'s field. Everyone is talking about peace.',
    choices: [
      ch('Go for all three days', ['impulsive'], (x) => { x.mods({ happiness: 6, health: -2 }); x.remember('er_festival', 'Went to a legendary music festival', 30); return 'You lost your shoes, found new friends and heard the best set of your life.'; }),
      ch('Volunteer at the gate', ['help'], (x) => { x.mods({ karma: 2, happiness: 3 }); return 'The fences fell on day one. You gave up and danced.'; }),
      ch('Stay home', ['cautious'], () => { return 'You bought the live album later and pretended you were there.'; }),
    ],
  },
  {
    id: 'er_aerobics', cat: 'era', minAge: 16, years: [1980, 1990], scene: 'gym',
    title: 'Aerobics craze', text: 'Leotards, leg warmers and a workout video that promises "feel the burn".',
    choices: [
      ch('Do it every morning', ['ambitious'], (x) => { x.mods({ fitness: 4, happiness: 2 }); return 'Your downstairs neighbours learned the routine by sound.'; }),
      ch('Join a class', ['social'], (x) => { pay(x, 30); x.mods({ fitness: 3, loneliness: -3 }); return 'The instructor had the energy of a nuclear reactor.'; }),
      ch('Watch from the sofa', ['cautious'], (x) => { x.mods({ happiness: 1 }); return 'Exercise by observation. Results pending.'; }),
    ],
  },
  {
    id: 'er_packageHoliday', cat: 'travel', minAge: 6, years: [1958, 1989], when: inCountry('gb', 'de', 'fr', 'ch', 'it'), cooldown: 4, scene: 'beach',
    title: 'Package holiday', text: 'For the first time, ordinary families can fly south for two weeks in the sun.',
    choices: [
      ch('Book the beach hotel', ['impulsive'], (x) => { if (!pay(x, 600)) return 'Too dear this year. The local seaside will do.'; x.mods({ happiness: 6, stress: -6, looks: 1 }); return 'Sunburn, paella and a souvenir donkey.'; }),
      ch('Learn a few phrases', ['ambitious'], (x) => { x.train('languages', 3); x.mods({ happiness: 3 }); return 'You ordered two beers and a bus timetable with confidence.'; }),
      ch('Stay home and save', ['cautious'], (x) => { x.money(cost(x, 100)); return 'Your neighbours\' slideshow felt very long.'; }),
    ],
  },
  {
    id: 'er_videoRental', cat: 'era', minAge: 8, years: [1981, 2005], scene: 'cinema',
    title: 'Video night', text: 'The video shop is packed on a Friday. The new release is out, but only two copies.',
    choices: [
      ch('Grab the new release', ['impulsive'], (x) => { pay(x, 4); x.mods({ happiness: 3 }); return 'You forgot to rewind it. The late fee followed you for years.'; }),
      ch('Pick a strange old film', ['cautious'], (x) => { pay(x, 2); x.mods({ creativity: 2 }); return 'It was terrible in a wonderful way.'; }),
      ch('Host a movie night', ['social'], (x) => { pay(x, 10); x.mods({ loneliness: -4, popularity: 2 }); return 'Popcorn, blankets and arguing about the ending.'; }, 'friends'),
    ],
  },
];

// ================================================================== DIGITAL (1990..2009)
const DIGITAL: EventDef[] = [
  {
    id: 'er_dialUp', cat: 'era', minAge: 8, years: [1994, 2006], once: true, scene: 'internet',
    title: 'Dial-up', text: 'The modem screeches, whistles and hisses. You are on the internet, and nobody can use the phone.',
    choices: [
      ch('Explore chat rooms', ['social'], (x) => { x.mods({ loneliness: -3, happiness: 3 }); return 'You spent the night talking to a stranger about a band nobody else liked.'; }),
      ch('Build a homepage', ['ambitious'], (x) => { x.train('webDevelopment', 4); x.mods({ creativity: 2 }); return 'Flaming text, a visitor counter and an "under construction" sign. Perfect.'; }),
      ch('Log off for the phone', ['cautious'], (x) => { x.mods({ karma: 1 }); return 'Your mother finally got through to your aunt. Peace returned.'; }),
    ],
  },
  {
    id: 'er_y2k', cat: 'era', minAge: 6, years: [1999, 1999], once: true, weight: 6, scene: 'hacker',
    title: 'The millennium bug', text: 'Experts warn that computers might fail at midnight on New Year\'s Eve. Some people are stockpiling tins.',
    choices: [
      ch('Fix code for big money', ['ambitious'], (x) => { x.train('programming', 4); x.money(cost(x, 8000)); return 'You patched date fields for months. Midnight came, nothing happened, and you got paid.'; }, 'office', (x) => x.age >= 18),
      ch('Stockpile just in case', ['cautious'], (x) => { pay(x, 300); x.mods({ anxiety: 2 }); return 'You ate beans until March.'; }),
      ch('Party like it is 1999', ['impulsive'], (x) => { x.mods({ happiness: 6 }); x.remember('er_millennium', 'Saw in the new millennium', 30); return 'The lights stayed on. The fireworks were glorious.'; }, 'fireworks'),
    ],
  },
  {
    id: 'er_launchParty', cat: 'era', minAge: 20, years: [1997, 2001], when: inCountry('us', 'gb', 'de', 'fr', 'au', 'in', 'ch'), scene: 'party',
    title: 'Launch party', text: 'A website that sells something nobody needs is throwing a launch party with an ice sculpture and a live band.',
    choices: [
      ch('Network like mad', ['ambitious'], (x) => { x.train('networking', 4); x.mods({ professionalRep: 2 }); return 'You collected forty business cards. Thirty companies were gone within a year.'; }),
      ch('Enjoy the free bar', ['impulsive'], (x) => { x.mods({ happiness: 4, health: -1 }); return 'Their venture capital, your champagne.'; }),
      ch('Ask about the business model', ['cautious'], (x) => { x.mods({ wisdom: 3 }); return 'Nobody could answer. You kept your savings in an index fund.'; }),
    ],
  },
  {
    id: 'er_firstMobile', cat: 'era', minAge: 12, years: [1995, 2006], once: true, scene: 'gadget',
    title: 'Your first mobile', text: 'A chunky mobile phone with an aerial, a tiny screen and a game about a snake.',
    choices: [
      ch('Master the snake game', ['impulsive'], (x) => { x.mods({ happiness: 3 }); return 'Your thumbs became legends.'; }, 'gaming'),
      ch('Text everyone', ['social'], (x) => { pay(x, 30); x.mods({ loneliness: -3, popularity: 2 }); return 'C U L8R. Your spelling never fully recovered.'; }),
      ch('Keep it for emergencies', ['cautious'], (x) => { x.mods({ discipline: 1 }); return 'It stayed in a drawer, fully charged, for eleven years.'; }),
    ],
  },
  {
    id: 'er_mp3', cat: 'era', minAge: 12, maxAge: 40, years: [1999, 2006], scene: 'hacker',
    title: 'Free music', text: 'A file-sharing program lets you download any song in the world. It also downloads viruses.',
    choices: [
      ch('Download everything', ['impulsive'], (x) => { x.mods({ happiness: 3 }); if (x.chance(0.2)) { x.mods({ stress: 4 }); return 'One "song" was a virus. Your computer now speaks only in pop-ups.'; } return 'Four thousand songs, half of them mislabelled.'; }),
      ch('Burn the perfect mix CD', ['social'], (x) => { x.train('music', 1); x.mods({ creativity: 2, loneliness: -2 }); return 'Track listing in silver pen. A small act of love.'; }),
      ch('Keep buying CDs', ['cautious'], (x) => { pay(x, 20); x.mods({ karma: 1 }); return 'Liner notes, cases that crack, and a clear conscience.'; }, 'shopping'),
    ],
  },
  {
    id: 'er_internetCafe', cat: 'era', minAge: 12, years: [1996, 2008], scene: 'internet',
    title: 'Internet café', text: 'Rows of beige computers, cold coffee and an hourly rate.',
    choices: [
      ch('Play networked games', ['social'], (x) => { pay(x, 5); x.mods({ happiness: 4 }); return 'You and ten strangers shouting through a wall of monitors. Bliss.'; }, 'gaming'),
      ch('Email faraway friends', ['help'], (x) => { pay(x, 3); x.mods({ loneliness: -4 }); return 'An email from across the world, arriving in seconds. Still unbelievable.'; }),
      ch('Learn to touch-type', ['ambitious'], (x) => { x.train('programming', 1); x.mods({ smarts: 1 }); return 'Home row, eyes up. A skill for the rest of your life.'; }, 'office'),
    ],
  },
  {
    id: 'er_digitalPet', cat: 'era', minAge: 6, maxAge: 16, years: [1996, 2001], once: true, scene: 'gadget',
    title: 'Digital pet', text: 'Everyone at school has a tiny egg-shaped pet that beeps when it is hungry, even during lessons.',
    choices: [
      ch('Care for it devotedly', ['help'], (x) => { x.mods({ discipline: 2, empathy: 2 }); return 'It lived to a ripe digital old age. You were proud.'; }),
      ch('Sneak it into class', ['impulsive'], (x) => { x.mods({ happiness: 2 }); return 'Confiscated. It died in the teacher\'s drawer.'; }, 'classroom'),
      ch('Ignore it', ['cautious'], (x) => { x.mods({ empathy: -1 }); return 'It became a small pixel ghost. You felt oddly guilty.'; }, 'ghost'),
    ],
  },
  {
    id: 'er_realityTV', cat: 'era', minAge: 18, maxAge: 40, years: [2000, 2012], scene: 'fame',
    title: 'Reality show audition', text: 'A reality show is casting "ordinary people with big personalities". The queue goes round the block.',
    choices: [
      ch('Audition', ['ambitious', 'impulsive'], (x) => { if (x.chance(0.15)) { x.mods({ fame: 10, popularity: 5, stress: 6 }); return 'You got on. Eight weeks of cameras, tears and one legendary argument about toast.'; } x.mods({ confidence: -1 }); return 'You did not get past the first round. Probably for the best.'; }),
      ch('Vote by phone every week', ['social'], (x) => { pay(x, 20); x.mods({ happiness: 2 }); return 'Your favourite won. You feel partly responsible.'; }),
      ch('Mock it loudly', ['cautious'], (x) => { x.train('humor', 1); return 'You watched every episode, ironically.'; }),
    ],
  },
  {
    id: 'er_topFriends', cat: 'era', minAge: 13, maxAge: 30, years: [2004, 2009], scene: 'internet',
    title: 'Top friends', text: 'Your social profile lets you rank your top eight friends publicly. Someone will be hurt.',
    choices: [
      ch('Rank them honestly', ['impulsive'], (x) => { x.mods({ popularity: -2, happiness: 1 }); return 'Number nine has not spoken to you since.'; }),
      ch('Put only family', ['cautious'], (x) => { x.mods({ karma: 1 }); return 'Diplomatic. Nobody believes your grandmother is your best friend.'; }, 'family'),
      ch('Code a glittery profile', ['ambitious'], (x) => { x.train('webDevelopment', 3); x.mods({ creativity: 2 }); return 'Autoplay music and a sparkly background. A masterpiece of its time.'; }),
    ],
  },
  {
    id: 'er_blog', cat: 'era', minAge: 14, years: [2002, 2012], scene: 'office',
    title: 'Start a blog', text: 'Everyone is starting a blog. Strangers might read your thoughts. Or nobody might.',
    choices: [
      ch('Write every day', ['ambitious'], (x) => { x.train('writing', 4); x.mods({ creativity: 2 }); return x.chance(0.15) ? 'A post went viral. Ten thousand readers, briefly.' : 'Three loyal readers. One is your mum.'; }),
      ch('Post your feelings', ['impulsive'], (x) => { x.mods({ stress: -3, publicImage: -1 }); return 'Cathartic, until a coworker found it.'; }),
      ch('Just read others', ['cautious'], (x) => { x.mods({ smarts: 1 }); return 'You found a whole community of people who also love vintage kettles.'; }, 'reading'),
    ],
  },
  {
    id: 'er_boxSet', cat: 'era', minAge: 12, years: [2000, 2012], scene: 'cinema',
    title: 'The box set', text: 'A friend has lent you a DVD box set of a gritty drama everyone says is the best thing ever made.',
    choices: [
      ch('Watch it all in a weekend', ['impulsive'], (x) => { x.mods({ happiness: 4, fitness: -1, energy: -3 }); return 'You emerged on Monday, pale and changed.'; }),
      ch('One episode a night', ['cautious'], (x) => { x.mods({ discipline: 2, happiness: 3 }); return 'Savoured, like a good wine.'; }),
      ch('Discuss it with friends', ['social'], (x) => { x.mods({ loneliness: -3 }); return 'Hours of theories. Most of them wrong.'; }, 'friends'),
    ],
  },
  {
    id: 'er_textMessage', cat: 'era', minAge: 13, maxAge: 40, years: [2000, 2009], scene: 'gadget',
    title: 'Text limit', text: 'You have used up your monthly texts by the fourteenth. Every message now costs money.',
    choices: [
      ch('Keep texting anyway', ['impulsive'], (x) => { pay(x, 40); x.mods({ loneliness: -2 }); return 'The bill arrived. Your parents had words.'; }),
      ch('Ring instead', ['social'], (x) => { x.mods({ loneliness: -3 }); return 'An actual conversation. Strange, but nice.'; }),
      ch('Go silent until the reset', ['cautious'], (x) => { x.mods({ discipline: 2 }); return 'Sixteen days of mystery. People thought you were deep.'; }),
    ],
  },
];

// ================================================================== SOCIAL MEDIA (2010..2024)
const SOCIAL_MEDIA: EventDef[] = [
  {
    id: 'er_influencerOffer', cat: 'era', minAge: 16, years: [2012, 2030], scene: 'fame',
    title: 'Sponsored post', text: 'A brand offers to pay you to post about a detox tea that tastes like lawn clippings.',
    choices: [
      ch('Take the money', ['ambitious'], (x) => { x.money(cost(x, 500)); x.mods({ publicImage: -1 }); x.train('branding', 2); return 'Ring light, fake smile, real cash.'; }, 'moneyUp'),
      ch('Post an honest review', ['impulsive'], (x) => { x.mods({ popularity: 3, publicImage: 2 }); return 'Your followers loved the honesty. The brand did not.'; }),
      ch('Decline politely', ['cautious'], (x) => { x.mods({ karma: 1 }); return 'Your integrity remains unsponsored.'; }),
    ],
  },
  {
    id: 'er_screenTime', cat: 'era', minAge: 12, years: [2014, 2035], cooldown: 4, scene: 'gadget',
    title: 'Screen time report', text: 'Your phone reports you spent seven hours a day on it last week. It sounds proud.',
    choices: [
      ch('Delete the apps', ['cautious'], (x) => { x.mods({ anxiety: -3, happiness: 2, discipline: 3 }); return 'Two days of twitching, then you read a whole book.'; }, 'reading'),
      ch('Scroll on', ['impulsive'], (x) => { x.mods({ anxiety: 3, loneliness: 2 }); return 'You saw everyone\'s holidays and felt vaguely worse.'; }),
      ch('Go for a walk instead', ['help'], (x) => { x.mods({ fitness: 2, stress: -3 }); return 'Trees. Remember trees?'; }, 'hiking'),
    ],
  },
  {
    id: 'er_lockdown', cat: 'era', minAge: 4, years: [2020, 2021], once: true, weight: 6, scene: 'lonely',
    title: 'Lockdown', text: 'Everyone is told to stay home. The streets are silent and the supermarket is out of flour.',
    choices: [
      ch('Bake sourdough', ['cautious'], (x) => { x.train('baking', 4); x.mods({ happiness: 2 }); return 'You named your starter. It became the most reliable member of the household.'; }, 'cooking'),
      ch('Video-call quizzes', ['social'], (x) => { x.mods({ loneliness: -4 }); return 'You are on mute. You are still on mute.'; }, 'friends'),
      ch('Help elderly neighbours', ['help'], (x) => { x.mods({ karma: 5, empathy: 3 }); return 'You left groceries on doorsteps and got waves through windows.'; }, 'volunteer'),
    ],
  },
  {
    id: 'er_viralPost', cat: 'era', minAge: 13, years: [2010, 2040], cooldown: 6, weight: 0.7, scene: 'scandal',
    title: 'You went viral', text: 'A silly video you posted has a million views. Strangers are making remixes.',
    choices: [
      ch('Ride the wave', ['ambitious'], (x) => { x.mods({ fame: 6, popularity: 4, stress: 3 }); return 'Brand deals, a talk show and your face as a meme forever.'; }, 'fame'),
      ch('Delete it', ['cautious'], (x) => { x.mods({ anxiety: -1 }); return 'Too late. The internet keeps everything.'; }),
      ch('Make a sequel', ['impulsive'], (x) => { x.mods({ fame: 2, ego: 3 }); return 'The sequel flopped. The original keeps going.'; }),
    ],
  },
  {
    id: 'er_rideshare', cat: 'era', minAge: 18, years: [2012, 2035], scene: 'car',
    title: 'Driving for an app', text: 'An app lets you drive strangers around in your own car for money. The rating system is merciless.',
    choices: [
      ch('Sign up and drive', ['ambitious'], (x) => { x.money(cost(x, 2000)); x.mods({ stress: 3 }); return 'Four point nine stars and a back seat full of opinions.'; }),
      ch('Just use it for rides', ['cautious'], (x) => { pay(x, 30); x.mods({ happiness: 1 }); return 'Your driver told you his whole life story. Five stars.'; }),
      ch('Chat with every driver', ['social'], (x) => { x.mods({ empathy: 2, loneliness: -2 }); return 'An engineer, a poet and a former mayor. The city talks.'; }),
    ],
  },
  {
    id: 'er_oldPost', cat: 'era', minAge: 18, years: [2014, 2035], cooldown: 8, weight: 0.6, scene: 'scandal',
    title: 'An old post', text: 'Someone has dug up a careless joke you posted ten years ago. It is spreading.',
    choices: [
      ch('Apologise sincerely', ['cautious'], (x) => { x.mods({ publicImage: 2, ego: -2, wisdom: 2 }); return 'Most people accepted it. You meant it.'; }),
      ch('Double down', ['impulsive'], (x) => { x.mods({ publicImage: -5, ego: 2, stress: 5 }); return 'A long weekend of being the main character. Not in a good way.'; }),
      ch('Log off for a week', ['cautious'], (x) => { x.mods({ stress: -2 }); return 'The internet found someone else by Wednesday.'; }, 'calm'),
    ],
  },
  {
    id: 'er_deliveryApps', cat: 'era', minAge: 16, years: [2014, 2040], scene: 'restaurant',
    title: 'Delivery apps', text: 'You can now summon any food to your door in thirty minutes. Your bank statement is mostly noodles.',
    choices: [
      ch('Order again', ['impulsive'], (x) => { pay(x, 40); x.mods({ happiness: 2, fitness: -1 }); return 'The rider knows your dog\'s name.'; }),
      ch('Learn to cook', ['ambitious'], (x) => { x.train('cooking', 4); x.money(cost(x, 50)); return 'Your first curry was edible. Your second was good.'; }, 'cooking'),
      ch('Tip the rider well', ['help'], (x) => { pay(x, 10); x.mods({ karma: 2 }); return 'He was riding through a storm. It was the least you could do.'; }),
    ],
  },
  {
    id: 'er_binge', cat: 'era', minAge: 12, years: [2013, 2040], scene: 'cinema',
    title: 'Are you still watching?', text: 'The streaming service has asked if you are still watching. It is 3 a.m.',
    choices: [
      ch('Yes. One more.', ['impulsive'], (x) => { x.mods({ energy: -5, happiness: 2 }); return 'Six more. The sun came up.'; }),
      ch('Go to bed', ['cautious'], (x) => { x.mods({ health: 1, discipline: 2 }); return 'The cliffhanger haunted your dreams.'; }),
      ch('Text a friend about it', ['social'], (x) => { x.mods({ loneliness: -2 }); return 'They were also awake. Of course they were.'; }),
    ],
  },
  {
    id: 'er_nft', cat: 'era', minAge: 18, years: [2021, 2022], once: true, weight: 2, scene: 'stocks',
    title: 'Digital art craze', text: 'People are paying fortunes for cartoon apes as "digital ownership tokens".',
    choices: [
      ch('Buy one', ['impulsive'], (x) => { const s = cost(x, 3000); if (!x.spend(s)) return 'You could not afford the ape. Perhaps a lesser ape.'; if (x.chance(0.2)) { x.money(s * 4); return 'You flipped it within a week. Fourfold. You still do not understand why.'; } return 'Its value fell ninety-eight percent. You own a very expensive picture of a monkey.'; }),
      ch('Mint your own art', ['ambitious'], (x) => { x.train('art', 2); x.money(cost(x, x.chance(0.3) ? 800 : 0)); return 'A few sales, a lot of strange messages.'; }, 'painting'),
      ch('Screenshot one', ['cautious'], (x) => { x.train('humor', 2); return 'Free art. Revolutionary.'; }),
    ],
  },
  {
    id: 'er_podcast', cat: 'era', minAge: 16, years: [2015, 2040], scene: 'newsroom',
    title: 'Start a podcast', text: 'You and a friend have two microphones and opinions about everything.',
    choices: [
      ch('Launch it', ['ambitious'], (x) => { x.train('publicSpeaking', 3); x.mods({ fame: x.chance(0.1) ? 6 : 1 }); return 'Episode one: forty minutes of setting up the microphones.'; }),
      ch('Interview interesting people', ['social'], (x) => { x.train('networking', 3); x.mods({ wisdom: 2 }); return 'A beekeeper, a judge and a retired spy. Brilliant listening.'; }),
      ch('Just listen to others', ['cautious'], (x) => { x.mods({ smarts: 2 }); return 'Your commute became a university.'; }),
    ],
  },
  {
    id: 'er_climateStrike', cat: 'era', minAge: 10, maxAge: 30, years: [2018, 2030], cooldown: 4, scene: 'parade',
    title: 'Climate strike', text: 'Students are walking out of class to protest for climate action. Handmade signs fill the square.',
    choices: [
      ch('Walk out', ['help'], (x) => { x.mods({ karma: 3, confidence: 3, politicalApproval: 1 }); return 'Your sign said "THERE IS NO PLANET B". It rained. You stayed.'; }),
      ch('Organise a local march', ['ambitious'], (x) => { x.train('leadership', 3); x.train('publicSpeaking', 2); return 'Two hundred people and a megaphone that worked half the time.'; }),
      ch('Stay in class', ['cautious'], (x) => { x.mods({ smarts: 1 }); return 'You studied environmental science instead. Also a form of protest.'; }, 'classroom'),
    ],
  },
  {
    id: 'er_selfie', cat: 'travel', minAge: 12, years: [2012, 2040], scene: 'travel',
    title: 'The perfect shot', text: 'At a famous landmark, a hundred people are elbowing each other for the same photo.',
    choices: [
      ch('Fight for the spot', ['impulsive'], (x) => { x.mods({ popularity: 1, stress: 2 }); return 'Two hundred likes. Zero memories of the actual place.'; }),
      ch('Put the phone away', ['cautious'], (x) => { x.mods({ happiness: 3, wisdom: 2 }); return 'You actually looked at it. It was beautiful.'; }),
      ch('Take photos for strangers', ['help'], (x) => { x.mods({ karma: 2, loneliness: -2 }); return 'You became the unofficial photographer of six families.'; }, 'friends'),
    ],
  },
];

// ================================================================== NEAR FUTURE (2025..2300)
const NEAR_FUTURE: EventDef[] = [
  {
    id: 'er_aiAssistant', cat: 'era', minAge: 12, years: [2025, 2300], cooldown: 5, scene: 'robots',
    title: 'Your AI assistant', text: 'Your AI assistant offers to handle your emails, your calendar and, if you like, your small talk.',
    choices: [
      ch('Let it run your life', ['impulsive'], (x) => { x.mods({ stress: -4, discipline: -2 }); return 'Everything was on time. You forgot how to write a birthday card.'; }),
      ch('Learn how it works', ['ambitious'], (x) => { x.train('machineLearning', 3); x.mods({ smarts: 2 }); return 'You understood it better. It did not seem to mind.'; }, 'lab'),
      ch('Keep it on a short leash', ['cautious'], (x) => { x.mods({ wisdom: 2 }); return 'Reminders only. Your thoughts stay your own.'; }),
    ],
  },
  {
    id: 'er_climateMigrants', cat: 'era', minAge: 16, years: [2035, 2300], cooldown: 6, scene: 'refugees',
    title: 'Climate migration', text: 'Families from regions now too hot or too flooded to live in are arriving in your town.',
    choices: [
      ch('Host a family', ['help'], (x) => { x.mods({ karma: 6, empathy: 4, stress: 3 }); return 'A crowded flat, shared meals and new friends for life.'; }, 'familyDinner'),
      ch('Donate to the relief fund', ['help'], (x) => { pay(x, 200); x.mods({ karma: 3 }); return 'Your money became tents, water and schoolbooks.'; }),
      ch('Plan your own move north', ['cautious'], (x) => { x.mods({ anxiety: 3 }); return 'You looked up property prices in places that used to be cold.'; }, 'moving'),
    ],
  },
  {
    id: 'er_geneClinic', cat: 'era', minAge: 18, years: [2040, 2300], cooldown: 10, scene: 'lab',
    title: 'The gene clinic', text: 'A clinic offers to edit your genes: disease risks out, perhaps a few upgrades in.',
    choices: [
      ch('Edit out disease risks', ['cautious'], (x) => { if (!pay(x, 5000)) return 'Too expensive for now. Your insurer said maybe next decade.'; x.mods({ health: 6, immunity: 5 }); return 'Three injections and a mild fever. Your risk profile looks like a newborn\'s.'; }),
      ch('Get cosmetic tweaks', ['impulsive'], (x) => { if (!pay(x, 8000)) return 'Vanity is expensive. You could not afford it.'; x.mods({ looks: 5, ego: 3 }); return 'Brighter eyes and better skin. Also a slight glow nobody can explain.'; }),
      ch('Refuse on principle', ['cautious'], (x) => { x.mods({ faith: 1, wisdom: 2 }); return 'You are one hundred percent original. Limited edition.'; }),
    ],
  },
  {
    id: 'er_lunarHoliday', cat: 'travel', minAge: 12, years: [2060, 2300], cooldown: 10, scene: 'moonLanding',
    title: 'Holiday on the moon', text: 'A week at a lunar resort: low gravity, Earthrise from the dome, and very expensive coffee.',
    choices: [
      ch('Book it', ['impulsive'], (x) => { if (!pay(x, 25000)) return 'Too far, too expensive. You watched the resort cams instead.'; x.mods({ happiness: 8, wisdom: 3 }); x.remember('er_moon', 'Holidayed on the moon', 50); return 'You jumped six metres and cried at the sight of Earth.'; }, 'rocket'),
      ch('Win it in a lottery', ['impulsive'], (x) => { if (x.chance(0.05)) { x.mods({ happiness: 8 }); return 'You actually won. The moon is grey, silent and perfect.'; } return 'You did not win. The moon stays up there.'; }, 'casino'),
      ch('Stay on Earth', ['cautious'], (x) => { x.mods({ stress: -1 }); return 'Earth has beaches. The moon does not.'; }, 'beach'),
    ],
  },
  {
    id: 'er_neuralImplant', cat: 'era', minAge: 18, years: [2045, 2300], cooldown: 10, scene: 'robots',
    title: 'Neural implant', text: 'A tiny implant promises perfect memory, instant translation and thoughts you can text.',
    choices: [
      ch('Get the implant', ['impulsive', 'ambitious'], (x) => { if (!pay(x, 10000)) return 'Not affordable yet. You watched the ads with envy.'; x.train('neuralInterfaces', 5); x.mods({ smarts: 4, anxiety: 2 }); if (x.chance(0.1)) { x.mods({ paranoia: 5 }); return 'It works brilliantly, apart from the ads that play in your dreams.'; } return 'You remember every name now. It is slightly terrifying.'; }, 'surgery'),
      ch('Wait for version two', ['cautious'], (x) => { x.mods({ wisdom: 2 }); return 'Version one had a firmware recall. You smiled.'; }),
      ch('Join a no-implant group', ['social'], (x) => { x.mods({ loneliness: -3, popularity: 1 }); return 'Board games, paper notes and smug conversation.'; }, 'friends'),
    ],
  },
  {
    id: 'er_robotHelper', cat: 'era', minAge: 18, years: [2040, 2300], cooldown: 8, scene: 'robots',
    title: 'Robot helper', text: 'A household robot can cook, clean and sing lullabies in forty languages. It is on sale.',
    choices: [
      ch('Buy one', ['impulsive'], (x) => { if (!pay(x, 6000)) return 'Too expensive. You fold your own laundry, like an ancestor.'; x.mods({ stress: -4, happiness: 3 }); return 'It named itself Gerald. Gerald is a great cook.'; }),
      ch('Program it yourself', ['ambitious'], (x) => { x.train('robotics', 4); return 'You taught it to make perfect pancakes and tell bad jokes.'; }),
      ch('Keep doing chores', ['cautious'], (x) => { x.mods({ discipline: 2, fitness: 1 }); return 'Chores are meditation, you insist.'; }),
    ],
  },
  {
    id: 'er_vrConcert', cat: 'era', minAge: 10, years: [2030, 2300], scene: 'concert',
    title: 'Virtual concert', text: 'A sold-out concert inside a virtual world. Twenty million avatars, one stage, front row for everyone.',
    choices: [
      ch('Dance in VR', ['impulsive'], (x) => { x.mods({ happiness: 4, fitness: 1 }); return 'You knocked over a lamp in the real world. Worth it.'; }),
      ch('Go with friends', ['social'], (x) => { x.mods({ loneliness: -4, happiness: 3 }); return 'Your avatars hugged during the encore.'; }, 'friends'),
      ch('Go to a real gig instead', ['cautious'], (x) => { pay(x, 60); x.mods({ happiness: 4 }); return 'Sticky floors, real sweat, ringing ears. Authentic.'; }),
    ],
  },
  {
    id: 'er_labMeat', cat: 'era', minAge: 8, years: [2030, 2300], once: true, scene: 'restaurant',
    title: 'Lab-grown steak', text: 'The restaurant\'s steak was grown in a vat. No animals were harmed. The waiter insists it is delicious.',
    choices: [
      ch('Try it', ['impulsive'], (x) => { pay(x, 30); x.mods({ happiness: 2, karma: 1 }); return 'Honestly? Indistinguishable. Slightly suspicious.'; }),
      ch('Order the vegetables', ['cautious'], (x) => { x.mods({ health: 1 }); return 'The vegetables were also grown in a vat, it turns out.'; }),
      ch('Invest in the company', ['ambitious'], (x) => { const s = cost(x, 1000); if (!x.spend(s)) return 'You could not afford a stake.'; if (x.chance(0.5)) { x.money(s * 2); return 'Vat meat went global. You doubled your money.'; } return 'The company was eaten by a bigger company.'; }, 'stocks'),
    ],
  },
  {
    id: 'er_basicIncome', cat: 'era', minAge: 18, years: [2040, 2300], once: true, scene: 'election',
    title: 'Basic income vote', text: (x) => `With automation taking jobs, ${x.countryName} is voting on a universal basic income.`,
    choices: [
      ch('Vote yes', ['help'], (x) => { x.mods({ karma: 2, stress: -2 }); return 'A small monthly payment arrived. Many people started businesses, or painting.'; }),
      ch('Vote no', ['cautious'], (x) => { x.mods({ discipline: 1 }); return 'You worried about the cost. The debate went on for years.'; }),
      ch('Campaign for it', ['ambitious'], (x) => { x.train('publicSpeaking', 3); x.mods({ politicalApproval: 3 }); return 'You knocked on four hundred doors. Most were answered by robots.'; }, 'parade'),
    ],
  },
  {
    id: 'er_seaWall', cat: 'era', minAge: 14, years: [2040, 2300], cooldown: 8, scene: 'flood',
    title: 'The sea wall', text: 'The town is voting on a giant sea wall. Without it, the harbour district will be underwater in twenty years.',
    choices: [
      ch('Volunteer to build', ['help'], (x) => { x.train('construction', 3); x.mods({ karma: 3, fitness: 2 }); return 'Concrete, sweat and a wall with your initials hidden in it.'; }, 'construction'),
      ch('Sell the beach house', ['cautious'], (x) => { x.money(cost(x, 500)); return 'You sold just before prices sank. Literally.'; }, 'house'),
      ch('Argue for retreat', ['ambitious'], (x) => { x.train('persuasion', 2); x.mods({ popularity: -2, wisdom: 2 }); return 'You said the sea always wins. People did not like it, but they listened.'; }),
    ],
  },
  {
    id: 'er_deepfakeCall', cat: 'era', minAge: 16, years: [2026, 2300], cooldown: 6, scene: 'hacker',
    title: 'A familiar voice', text: 'A relative calls in a panic asking for money right now. Their voice is perfect. Something feels off.',
    choices: [
      ch('Send the money', ['impulsive', 'help'], (x) => { const s = cost(x, 1000); x.money(-Math.min(s, Math.max(0, x.c.money))); x.mods({ stress: 6 }); return 'It was a voice clone. The real relative was at the cinema.'; }, 'moneyDown'),
      ch('Ask a family question', ['cautious'], (x) => { x.mods({ wisdom: 2, confidence: 2 }); return 'The voice did not know the dog\'s name. You hung up.'; }),
      ch('Report the scam', ['help'], (x) => { x.mods({ karma: 2 }); return 'The police thanked you. The voice called your neighbour next.'; }, 'police'),
    ],
  },
  {
    id: 'er_griefBot', cat: 'era', minAge: 18, years: [2032, 2300], cooldown: 15, when: (x) => x.aliveParents().length < 2, scene: 'ghost',
    title: 'A digital echo', text: 'A company offers to build a talking echo of a lost loved one from their messages and videos.',
    choices: [
      ch('Try it once', ['impulsive'], (x) => { pay(x, 100); x.mods({ depression: -2, trauma: 1 }); return 'It sounded just like them. You cried, then turned it off.'; }),
      ch('Keep your real memories', ['cautious'], (x) => { x.mods({ wisdom: 3, resilience: 2 }); return 'You looked at old photos instead. They were enough.'; }, 'graveVisit'),
      ch('Talk to a grief counsellor', ['help'], (x) => { x.mods({ depression: -3, stress: -2 }); return 'A real human, a box of tissues, and slow healing.'; }, 'calm'),
    ],
  },
];

// ================================================================== COUNTRY FLAVOUR

/** A country-locked event: fires only in `country`, within `years`. */
const cx = (id: string, country: string, years: [number, number], scene: string, title: string, text: Text, choices: ChoiceDef[], extra: Partial<EventDef> = {}): EventDef => ({
  id, cat: 'era', minAge: 6, years, when: inCountry(country), weight: 1.5, scene, title, text, choices, ...extra,
});

const COUNTRY_A: EventDef[] = [
  // ---- United States
  cx('er_us_countyFair', 'us', [1810, 2300], 'festival', 'The county fair', 'Prize pigs, a Ferris wheel and a pie contest with a dangerously competitive reputation.', [
    ch('Enter the pie contest', ['ambitious'], (x) => { x.train('baking', 3); if (x.chance(0.3)) { x.mods({ popularity: 4, ego: 2 }); return 'Blue ribbon. The reigning champion has not spoken to you since.'; } return 'Honourable mention. Your crust was "brave".'; }),
    ch('Ride everything', ['impulsive'], (x) => { pay(x, 15); x.mods({ happiness: 4 }); return 'Corn dog, then the spinning ride. In the wrong order.'; }, 'amusement'),
    ch('Show your livestock', ['cautious'], (x) => { x.train('animalHusbandry', 3); return 'Your calf behaved beautifully, apart from eating a judge\'s notes.'; }, 'farm'),
  ]),
  cx('er_us_july4', 'us', [1777, 2300], 'fireworks', 'Fourth of July', (x) => `Flags, parades and fireworks: ${x.countryName} is celebrating its independence.`, [
    ch('Host a barbecue', ['social'], (x) => { pay(x, 60); x.mods({ happiness: 4, popularity: 3 }); return 'Burnt burgers, cold drinks and a neighbour who brought too many sparklers.'; }, 'familyDinner'),
    ch('March in the parade', ['ambitious'], (x) => { x.mods({ popularity: 2, happiness: 3 }); return 'You threw candy to children and waved like a celebrity.'; }, 'parade'),
    ch('Watch from a quiet hill', ['cautious'], (x) => { x.mods({ stress: -3, happiness: 2 }); return 'The whole town lit up below you.'; }),
  ], { cooldown: 5 }),
  cx('er_us_route66', 'us', [1930, 1985], 'roadTrip', 'Route 66', 'The old highway runs from Chicago to the Pacific, past diners, motels and giant fibreglass dinosaurs.', [
    ch('Drive it end to end', ['impulsive'], (x) => { if (!pay(x, 400)) return 'Gas money ran short. You made it as far as the next state.'; x.mods({ happiness: 6, stress: -5 }); x.remember('er_route66', 'Drove the old highway to the Pacific', 30); return 'Desert sunsets, neon motels and pie at every stop.'; }, undefined, (x) => x.age >= 16),
    ch('Work at a roadside diner', ['ambitious'], (x) => { x.money(cost(x, 600)); x.train('hospitality', 3); return 'You served coffee to truckers, families and one very lost movie star.'; }, 'restaurant'),
    ch('Wave at the cars', ['cautious'], (x) => { x.mods({ happiness: 1 }); return 'Every licence plate a different story.'; }),
  ]),
  // ---- Britain
  cx('er_gb_bonfireNight', 'gb', [1606, 2300], 'fireworks', 'Bonfire Night', 'A huge bonfire, a straw effigy and fireworks to remember a foiled plot to blow up Parliament.', [
    ch('Build the bonfire', ['help'], (x) => { x.mods({ popularity: 2, happiness: 3 }); return 'The tallest bonfire in the county. Your eyebrows survived, mostly.'; }, 'fire'),
    ch('Write your name with a sparkler', ['impulsive'], (x) => { x.mods({ happiness: 3 }); return 'You managed the first three letters before it burnt out.'; }),
    ch('Mind the dog indoors', ['cautious'], (x) => { x.mods({ empathy: 2 }); return 'The dog trembled through the bangs on your lap.'; }, 'pet'),
  ], { cooldown: 5 }),
  cx('er_gb_seaside', 'gb', [1850, 2300], 'beach', 'Day at the seaside', 'Grey skies, a pier, donkey rides and fish and chips eaten in a windbreak.', [
    ch('Swim in the cold sea', ['impulsive'], (x) => { x.mods({ fitness: 2, happiness: 3 }); return 'You could not feel your toes for an hour. Bracing.'; }),
    ch('Go on the pier', ['social'], (x) => { pay(x, 15); x.mods({ happiness: 4 }); return 'Slot machines, candyfloss and a fortune teller who said you would travel.'; }, 'amusement'),
    ch('Shelter with a flask of tea', ['cautious'], (x) => { x.mods({ stress: -3 }); return 'Rain on the windbreak, tea in your hand. Peak contentment.'; }),
  ]),
  cx('er_gb_solstice', 'gb', [-500, 300], 'ritual', 'Midsummer at the stones', 'At the great stone circle, the sun rises exactly between the stones on midsummer morning.', [
    ch('Join the ritual', ['social'], (x) => { x.mods({ faith: 3, happiness: 3 }); return 'Drums, fires and the sun appearing just where the ancestors promised.'; }),
    ch('Ask how they moved the stones', ['ambitious'], (x) => { x.train('engineering', 2); x.mods({ smarts: 1 }); return 'Nobody knew. Everybody had a theory.'; }),
    ch('Sleep through it', ['cautious'], (x) => { x.mods({ energy: 3 }); return 'The sun rose without you. It managed.'; }),
  ]),
  // ---- France
  cx('er_fr_cafe', 'fr', [1700, 2300], 'restaurant', 'Café terrace', 'You can sit for three hours over one coffee, and nobody will rush you.', [
    ch('Argue about philosophy', ['social'], (x) => { x.train('philosophy', 2); x.mods({ smarts: 1, happiness: 2 }); return 'Existence, freedom and whether the croissants were better last year.'; }),
    ch('Write in a notebook', ['ambitious'], (x) => { x.train('writing', 3); x.mods({ creativity: 2 }); return 'Three pages, one good sentence. A productive afternoon.'; }),
    ch('Just watch the street', ['cautious'], (x) => { x.mods({ stress: -3 }); return 'Lovers, pigeons and a waiter with magnificent disdain.'; }),
  ]),
  cx('er_fr_bastilleDay', 'fr', [1880, 2300], 'parade', 'Bastille Day', 'A military parade, fire brigade dances and fireworks over the rooftops.', [
    ch('Dance at the fire station ball', ['social'], (x) => { x.train('dance', 2); x.mods({ happiness: 4 }); return 'An accordion, a crowd and a firefighter who could really waltz.'; }, 'dance'),
    ch('Watch the parade', ['cautious'], (x) => { x.mods({ happiness: 2 }); return 'Jets trailing blue, white and red. You felt it in your chest.'; }),
    ch('Picnic for the fireworks', ['impulsive'], (x) => { pay(x, 20); x.mods({ happiness: 3 }); return 'Cheese, wine and an explosion of colour.'; }, 'fireworks'),
  ], { cooldown: 5 }),
  cx('er_fr_vendange', 'fr', [-500, 2300], 'farm', 'Grape harvest', 'The grapes are ready and every pair of hands is needed in the vineyards.', [
    ch('Pick all week', ['help'], (x) => { x.train('viticulture', 4); x.money(cost(x, 300)); x.mods({ fitness: 2 }); return 'Purple hands, aching back and a harvest feast to remember.'; }),
    ch('Tread the grapes', ['impulsive'], (x) => { x.mods({ happiness: 4 }); return 'Barefoot in a vat, laughing. The wine was fine. Probably.'; }, 'party'),
    ch('Learn to taste wine', ['ambitious'], (x) => { x.train('viticulture', 2); x.mods({ ego: 1 }); return '"Notes of blackberry and wet stone." You were guessing.'; }, 'bar', (x) => x.age >= 16),
  ], { minAge: 10 }),
  // ---- Germany
  cx('er_de_beerFest', 'de', [1810, 2300], 'festival', 'Beer festival', 'Giant tents, brass bands, pretzels the size of your head, and litre mugs.', [
    ch('Drink a litre', ['impulsive'], (x) => { x.mods({ happiness: 4, health: -1 }); return 'You stood on a bench and sang songs you did not know.'; }, 'bar'),
    ch('Eat roast chicken', ['cautious'], (x) => { pay(x, 20); x.mods({ happiness: 3 }); return 'Crispy, salty, perfect. You came for the beer and stayed for the chicken.'; }),
    ch('Dance with strangers', ['social'], (x) => { x.mods({ loneliness: -4, popularity: 2 }); return 'An oompah polka with a family from the next valley.'; }, 'dance'),
  ], { minAge: 16 }),
  cx('er_de_christmasMarket', 'de', [1400, 2300], 'festival', 'Christmas market', 'Wooden stalls, hot spiced wine, gingerbread hearts and carols in the frosty square.', [
    ch('Buy handmade ornaments', ['impulsive'], (x) => { pay(x, 30); x.mods({ happiness: 3 }); return 'A carved angel that will hang on every tree you ever own.'; }, 'shopping'),
    ch('Sing in the choir', ['social'], (x) => { x.train('singing', 3); x.mods({ happiness: 3 }); return 'Your breath fogged with every note.'; }),
    ch('Help at a charity stall', ['help'], (x) => { x.mods({ karma: 3 }); return 'You sold eighty mugs of cocoa for the orphanage.'; }, 'volunteer'),
  ], { cooldown: 4 }),
  cx('er_de_autobahn', 'de', [1955, 2300], 'car', 'The autobahn', 'A stretch of motorway with no speed limit. Your car is willing, if you are.', [
    ch('Floor it', ['impulsive'], (x) => { x.mods({ happiness: 4, riskTolerance: 2 }); if (x.chance(0.1)) { x.mods({ health: -8 }); return 'A sudden jam, a hard stop, a bruised chest. Lesson learned.'; } return 'The trees became a green blur. Your heart pounded.'; }),
    ch('Stay in the right lane', ['cautious'], (x) => { x.mods({ stress: -1 }); return 'Porsches flashed past you like comets.'; }),
    ch('Check the engine first', ['ambitious'], (x) => { x.train('autoRepair', 2); return 'A loose belt, fixed. German precision rubbed off on you.'; }),
  ], { minAge: 18 }),
  // ---- Italy
  cx('er_it_carnival', 'it', [1200, 2300], 'royalBall', 'Carnival in Venice', 'Masks, capes and gondolas. For a few weeks, nobody knows who anyone is.', [
    ch('Buy a beautiful mask', ['impulsive'], (x) => { pay(x, 80); x.mods({ happiness: 4, looks: 1 }); return 'Gold leaf and feathers. You felt like a mystery.'; }, 'shopping'),
    ch('Join a masked dance', ['social'], (x) => { x.train('dance', 2); x.mods({ happiness: 4, loneliness: -3 }); return 'You danced with a duke, or possibly a fishmonger.'; }),
    ch('Watch from a bridge', ['cautious'], (x) => { x.mods({ happiness: 2 }); return 'Lanterns on the water and laughter echoing off the canals.'; }),
  ], { minAge: 12 }),
  cx('er_it_passeggiata', 'it', [1850, 2300], 'friends', 'The evening stroll', 'At dusk, the whole town puts on its best clothes and slowly walks up and down the main street.', [
    ch('Dress up and stroll', ['social'], (x) => { x.mods({ popularity: 2, looks: 1, happiness: 2 }); return 'You nodded at forty people and heard twelve pieces of news.'; }),
    ch('Get a gelato', ['impulsive'], (x) => { pay(x, 4); x.mods({ happiness: 3 }); return 'Pistachio. Obviously.'; }),
    ch('Sit with the old men', ['cautious'], (x) => { x.mods({ wisdom: 2 }); return 'They judged everyone\'s shoes and shared fifty years of gossip.'; }),
  ]),
  cx('er_it_palio', 'it', [1650, 2300], 'sports', 'The Palio', 'In Siena\'s main square, riders from rival neighbourhoods race bareback for ninety chaotic seconds.', [
    ch('Cheer for your district', ['social'], (x) => { x.mods({ happiness: 4, popularity: 2 }); return x.chance(0.3) ? 'Your district won! Strangers wept on your shoulder.' : 'Your horse finished without its rider. Proud, but sad.'; }),
    ch('Help groom the horse', ['help'], (x) => { x.train('horsemanship', 3); return 'The horse is blessed in church before the race. You held the bridle.'; }, 'petHorse'),
    ch('Watch from a balcony', ['cautious'], (x) => { pay(x, 50); x.mods({ happiness: 3 }); return 'The square boiled with noise below you.'; }),
  ], { cooldown: 4 }),
  // ---- Spain
  cx('er_es_bulls', 'es', [1800, 2300], 'festival', 'The fiesta', 'Pamplona is in its famous festival: white clothes, red scarves and bulls running through the streets at dawn.', [
    ch('Run with the bulls', ['impulsive'], (x) => { if (x.chance(0.15)) { x.mods({ health: -10, pain: 6 }); return 'A bull disagreed with your route. A bruised hip and a great story.'; } x.mods({ happiness: 5, riskTolerance: 3 }); return 'Three minutes of pure terror. You have never felt more alive.'; }, undefined, (x) => x.age >= 18),
    ch('Watch from a balcony', ['cautious'], (x) => { x.mods({ happiness: 3 }); return 'Safely above the chaos, wine in hand.'; }),
    ch('Dance all night in the square', ['social'], (x) => { x.mods({ happiness: 4, energy: -4 }); return 'Brass bands, sangria and friends whose names you never learned.'; }, 'party'),
  ], { minAge: 14 }),
  cx('er_es_flamenco', 'es', [1800, 2300], 'dance', 'Flamenco night', 'In a smoky courtyard, a singer\'s voice cracks with sorrow and a dancer stamps out the rhythm.', [
    ch('Learn the steps', ['ambitious'], (x) => { x.train('dance', 4); return 'Stamp, turn, glare. You nailed the glare.'; }),
    ch('Clap the rhythm', ['social'], (x) => { x.train('music', 2); x.mods({ happiness: 3 }); return 'Twelve beats, accents on the right ones. The guitarist nodded at you.'; }),
    ch('Just listen', ['cautious'], (x) => { x.mods({ empathy: 2, happiness: 2 }); return 'You did not understand the words. You understood everything.'; }),
  ]),
  cx('er_es_tomatina', 'es', [1946, 2300], 'festival', 'Tomato fight', 'A small town holds a giant food fight every August with tonnes of ripe tomatoes.', [
    ch('Dive in', ['impulsive'], (x) => { x.mods({ happiness: 5 }); return 'You were pink for two days. Your skin has never been softer.'; }),
    ch('Wear goggles and strategise', ['ambitious'], (x) => { x.mods({ happiness: 4, confidence: 2 }); return 'You hit everyone and nobody hit you. Briefly.'; }),
    ch('Watch from a doorway', ['cautious'], (x) => { x.mods({ happiness: 2 }); return 'You got hit anyway. There is no escape.'; }),
  ], { minAge: 12, cooldown: 6 }),
  // ---- Russia
  cx('er_ru_banya', 'ru', [900, 2300], 'spa', 'The banya', 'A scorching steam bath, a beating with birch branches, then a roll in the snow.', [
    ch('Go all the way', ['impulsive'], (x) => { x.mods({ health: 2, stress: -5, happiness: 3 }); return 'Steam, birch, snow, repeat. You emerged reborn.'; }),
    ch('Stay in the cool room', ['cautious'], (x) => { x.mods({ stress: -3 }); return 'Tea and pickled cucumbers. Equally Russian.'; }),
    ch('Talk business in the steam', ['social'], (x) => { x.train('networking', 2); x.mods({ professionalRep: 1 }); return 'Half the deals in town are made here. You made one too.'; }),
  ], { minAge: 10 }),
  cx('er_ru_dacha', 'ru', [1930, 2300], 'gardening', 'Summer at the dacha', 'Every weekend the city empties as families head for their little country cottages and vegetable plots.', [
    ch('Grow potatoes', ['cautious'], (x) => { x.train('farming', 3); x.money(cost(x, 50)); return 'Enough potatoes to last the winter, and then some.'; }),
    ch('Pick mushrooms in the forest', ['impulsive'], (x) => { x.train('herbalism', 2); x.mods({ happiness: 3 }); return 'A full basket. Your grandmother checked every one.'; }, 'hiking'),
    ch('Help fix the roof', ['help'], (x) => { x.train('carpentry', 3); return 'Now it only leaks in one spot.'; }, 'construction'),
  ]),
  cx('er_ru_queue', 'ru', [1960, 1991], 'shopping', 'The queue', 'A line has formed outside the shop. Nobody knows what is being sold, but you join anyway.', [
    ch('Join and wait', ['cautious'], (x) => { x.mods({ stress: 3 }); return x.pick(['Two hours later: toilet paper. A triumph.', 'Two hours later: nothing left. The shelves were bare.']); }),
    ch('Trade on the side', ['ambitious'], (x) => { x.money(cost(x, 50)); x.mods({ heat: 2 }); return 'You knew a man who knew a man who had jeans.'; }, 'bribe'),
    ch('Save places for neighbours', ['help'], (x) => { x.mods({ karma: 2, popularity: 2 }); return 'You stood for four families. They brought you tea.'; }),
  ]),
  cx('er_ru_maslenitsa', 'ru', [900, 2300], 'festival', 'Pancake week', 'Before Lent, everyone eats pancakes for a week and burns a straw figure of winter.', [
    ch('Eat stacks of pancakes', ['impulsive'], (x) => { x.mods({ happiness: 4 }); return 'With sour cream, jam and caviar. You lost count at twenty.'; }, 'cooking'),
    ch('Climb the greased pole', ['ambitious'], (x) => { x.mods({ fitness: 2, popularity: 3 }); return x.chance(0.3) ? 'You reached the prize at the top: a pair of boots!' : 'Halfway up. Gravity won.'; }),
    ch('Ask forgiveness of friends', ['help'], (x) => { x.mods({ karma: 2, stress: -3 }); return 'On Forgiveness Sunday, you made peace with two old friends.'; }, 'reunion'),
  ]),
  // ---- China
  cx('er_cn_newYear', 'cn', [-800, 2300], 'festival', 'Lunar New Year', 'Red lanterns, firecrackers, dumplings and the whole family under one roof.', [
    ch('Make dumplings together', ['social'], (x) => { x.train('cooking', 2); x.mods({ loneliness: -4, happiness: 3 }); return 'You hid a coin in one dumpling. Your grandmother found it, again.'; }, 'familyDinner'),
    ch('Set off firecrackers', ['impulsive'], (x) => { x.mods({ happiness: 4 }); return 'Bang! The evil spirits are definitely gone now.'; }, 'fireworks'),
    ch('Give red envelopes', ['help'], (x) => { pay(x, 50); x.mods({ karma: 2, popularity: 2 }); return 'The children bowed very politely, then ran off to count.'; }, undefined, (x) => x.age >= 18),
  ], { cooldown: 4 }),
  cx('er_cn_exam', 'cn', [605, 1905], 'exam', 'The imperial examination', 'Candidates are locked in tiny cells for days, writing essays on the classics. Success means a post in government.', [
    ch('Sit the exam', ['ambitious'], (x) => { x.train('literacy', 3); x.train('philosophy', 2); if (x.chance(0.15 + x.stat('smarts') / 400)) { x.mods({ professionalRep: 8, ego: 4 }); x.remember('er_jinshi', 'Passed the imperial examination', 60); return 'You passed! Your family set off fireworks for a week.'; } x.mods({ stress: 6 }); return 'You failed, like almost everyone. You will try again.'; }),
    ch('Study another year', ['cautious'], (x) => { x.train('literacy', 3); x.mods({ discipline: 3 }); return 'Lamplight, ink and the classics by heart.'; }, 'study'),
    ch('Become a merchant instead', ['impulsive'], (x) => { x.train('sales', 3); x.money(cost(x, 200)); return 'Less prestige, more silver.'; }, 'shopping'),
  ], { minAge: 16, cooldown: 3 }),
  cx('er_cn_teahouse', 'cn', [700, 2300], 'restaurant', 'The teahouse', 'Storytellers, songbirds in cages and an old man who refills your cup from a metre away.', [
    ch('Listen to the storyteller', ['cautious'], (x) => { x.train('history', 2); x.mods({ happiness: 3 }); return 'Generals, ghosts and a fox spirit. You came back the next day.'; }),
    ch('Play a game of xiangqi', ['ambitious'], (x) => { x.train('logic', 3); return x.chance(0.4) ? 'You beat the old champion. A crowd gathered.' : 'The old champion beat you in nine moves.'; }, 'gaming'),
    ch('Share gossip', ['social'], (x) => { x.train('gossip', 2); x.mods({ loneliness: -3 }); return 'Everyone knows everything at the teahouse.'; }, 'friends'),
  ]),
  cx('er_cn_midAutumn', 'cn', [700, 2300], 'stargazing', 'Mid-Autumn moon', 'Families gather under the full moon with mooncakes and lanterns.', [
    ch('Share mooncakes', ['social'], (x) => { x.mods({ happiness: 3, loneliness: -3 }); return 'Lotus paste and salted egg yolk. Dense, sweet, perfect.'; }, 'familyDinner'),
    ch('Write a moon poem', ['ambitious'], (x) => { x.train('poetry', 3); return 'Your poem compared the moon to a lost friend. Everyone sighed.'; }),
    ch('Light a lantern', ['cautious'], (x) => { x.mods({ stress: -3 }); return 'A rabbit lantern, glowing all night.'; }, 'festival'),
  ], { cooldown: 4 }),
];

const COUNTRY_B: EventDef[] = [
  // ---- Japan
  cx('er_jp_hanami', 'jp', [800, 2300], 'picnic', 'Cherry blossoms', 'The cherry trees are in full bloom. For one week, everyone picnics beneath the pink petals.', [
    ch('Picnic under the trees', ['social'], (x) => { x.mods({ happiness: 4, loneliness: -3 }); return 'Petals fell into your cup. Nobody minded.'; }),
    ch('Write a haiku', ['ambitious'], (x) => { x.train('poetry', 3); return 'Five, seven, five. The blossoms fall anyway.'; }),
    ch('Walk alone at night', ['cautious'], (x) => { x.mods({ wisdom: 2, stress: -3 }); return 'Lanterns under the blossoms. Beauty that does not last, which is the point.'; }, 'calm'),
  ], { cooldown: 4 }),
  cx('er_jp_onsen', 'jp', [300, 2300], 'spa', 'Hot spring', 'A mountain hot spring inn: steaming outdoor baths, snow on the rocks, and a monkey watching from a tree.', [
    ch('Soak until sunset', ['cautious'], (x) => { x.mods({ stress: -6, health: 2 }); return 'Your worries dissolved like salt in the steam.'; }),
    ch('Try the multi-course dinner', ['impulsive'], (x) => { pay(x, 100); x.mods({ happiness: 4 }); return 'Fourteen tiny courses, each more beautiful than the last.'; }, 'restaurant'),
    ch('Chat with the innkeeper', ['social'], (x) => { x.train('languages', 1); x.mods({ wisdom: 1 }); return 'Her family has run the inn for nineteen generations.'; }),
  ]),
  cx('er_jp_bulletTrain', 'jp', [1964, 2300], 'travel', 'The bullet train', 'The sleek train glides across the country at astonishing speed, and arrives to the second.', [
    ch('Ride it for fun', ['impulsive'], (x) => { pay(x, 120); x.mods({ happiness: 4 }); return 'Mount Fuji flashed by. Your coffee did not even ripple.'; }),
    ch('Buy a station lunch box', ['cautious'], (x) => { pay(x, 10); x.mods({ happiness: 3 }); return 'Each station has its own speciality. You plan trips around them now.'; }, 'restaurant'),
    ch('Study the engineering', ['ambitious'], (x) => { x.train('engineering', 3); return 'Aerodynamic noses inspired by a kingfisher\'s beak. Brilliant.'; }, 'invention'),
  ]),
  // ---- India
  cx('er_in_diwali', 'in', [-500, 2300], 'festival', 'Festival of lights', 'Every doorway glows with oil lamps. There are sweets, new clothes and fireworks.', [
    ch('Light lamps at home', ['cautious'], (x) => { x.mods({ happiness: 3, faith: 2 }); return 'Rows of little flames chasing away the dark.'; }),
    ch('Visit relatives with sweets', ['social'], (x) => { pay(x, 20); x.mods({ loneliness: -4, popularity: 2 }); return 'You ate sweets in nine houses. You may never eat again.'; }, 'familyDinner'),
    ch('Draw a rangoli', ['ambitious'], (x) => { x.train('art', 3); x.mods({ creativity: 2 }); return 'Coloured powder in a perfect lotus. The neighbours took photos.'; }, 'painting'),
  ], { cooldown: 4 }),
  cx('er_in_monsoon', 'in', [-500, 2300], 'storm', 'The monsoon', 'After weeks of crushing heat, the monsoon rains arrive in a roar.', [
    ch('Dance in the rain', ['impulsive'], (x) => { x.mods({ happiness: 5 }); return 'Soaked to the bone and laughing with the whole street.'; }),
    ch('Plant the rice', ['help'], (x) => { x.train('farming', 3); x.mods({ fitness: 2 }); return 'Knee-deep in mud, row after row. The harvest will be good.'; }, 'farm'),
    ch('Read by the window', ['cautious'], (x) => { x.mods({ stress: -3 }); return 'Hot tea, fried snacks and the rain drumming on the roof.'; }, 'reading'),
  ]),
  cx('er_in_cricket', 'in', [1880, 2300], 'sports', 'Street cricket', 'A game on a dusty lane with a taped ball, a plank for a bat and a crowd of very serious umpires.', [
    ch('Bat', ['ambitious'], (x) => { x.train('ballSports', 3); return x.chance(0.4) ? 'Six! Straight over the rooftops. The ball is lost forever.' : 'Out first ball. You blame the plank.'; }),
    ch('Bowl', ['impulsive'], (x) => { x.train('ballSports', 3); x.mods({ fitness: 1 }); return 'Your spin bowling confused even you.'; }),
    ch('Commentate loudly', ['social'], (x) => { x.train('publicSpeaking', 2); x.mods({ popularity: 2 }); return '"What a shot, what a shot!" The neighbours joined in.'; }),
  ], { minAge: 6, maxAge: 60 }),
  cx('er_in_holi', 'in', [300, 2300], 'festival', 'Holi', 'The festival of colours: everyone throws coloured powder and water, and nobody stays clean.', [
    ch('Join the colour fight', ['impulsive'], (x) => { x.mods({ happiness: 5, loneliness: -3 }); return 'You were green for three days. It was worth it.'; }),
    ch('Make sweets for the guests', ['help'], (x) => { x.train('cooking', 2); x.mods({ popularity: 2 }); return 'Your sweets vanished in minutes.'; }, 'cooking'),
    ch('Watch from the roof', ['cautious'], (x) => { x.mods({ happiness: 2 }); return 'A sea of colour below. Then a balloon found you.'; }),
  ], { cooldown: 4 }),
  // ---- Brazil
  cx('er_br_carnival', 'br', [1850, 2300], 'parade', 'Carnival', 'Samba schools in feathers and sequins, drums shaking the street, and dancing until sunrise.', [
    ch('Dance in a samba school', ['ambitious'], (x) => { x.train('dance', 4); x.mods({ happiness: 5, fitness: 2 }); return 'Months of rehearsal for one glorious hour.'; }, 'dance'),
    ch('Follow a street party', ['impulsive'], (x) => { x.mods({ happiness: 5, energy: -5 }); return 'You followed a brass band across half the city.'; }, 'party'),
    ch('Sew costumes', ['help'], (x) => { x.train('tailoring', 3); x.money(cost(x, 150)); return 'A million sequins, sewn by hand. Your fingers will remember.'; }),
  ], { cooldown: 4 }),
  cx('er_br_streetFootball', 'br', [1910, 2300], 'sports', 'Beach football', 'A barefoot game on the sand. Everyone here plays like a professional.', [
    ch('Show off your tricks', ['impulsive'], (x) => { x.train('football', 3); x.mods({ popularity: 2 }); return 'A bicycle kick! It missed by a mile but looked amazing.'; }),
    ch('Play as a team', ['social'], (x) => { x.train('football', 3); x.mods({ loneliness: -3 }); return 'Pass, pass, goal. Coconut water for everyone.'; }),
    ch('Referee', ['cautious'], (x) => { x.train('conflictResolution', 2); return 'You were yelled at by twenty people. Character building.'; }),
  ], { maxAge: 60 }),
  cx('er_br_amazon', 'br', [1500, 2300], 'hiking', 'Into the rainforest', 'A boat trip up the great river: pink dolphins, howler monkeys and trees taller than churches.', [
    ch('Go deep with a guide', ['ambitious'], (x) => { pay(x, 100); x.train('biology', 3); x.mods({ wisdom: 3, happiness: 3 }); return 'Your guide named every bird by its song.'; }),
    ch('Swim in the river', ['impulsive'], (x) => { x.mods({ happiness: 3, riskTolerance: 2 }); return 'Something brushed your leg. You did not ask what.'; }, 'beach'),
    ch('Stay on the boat', ['cautious'], (x) => { x.mods({ stress: -2 }); return 'Hammocks, rain on the roof, and the forest breathing.'; }),
  ], { minAge: 10, cat: 'travel' }),
  // ---- Mexico
  cx('er_mx_muertos', 'mx', [1600, 2300], 'festival', 'Day of the Dead', 'Families build altars with marigolds, candles, sugar skulls and the favourite foods of those they have lost.', [
    ch('Build an altar', ['help'], (x) => { x.mods({ faith: 2, depression: -2 }); return 'Photos, marigolds and your grandfather\'s favourite cigarettes.'; }, 'graveVisit'),
    ch('Paint your face', ['social'], (x) => { x.train('art', 2); x.mods({ happiness: 3 }); return 'A beautiful skull with flowers for eyes.'; }, 'parade'),
    ch('Spend the night at the cemetery', ['cautious'], (x) => { x.mods({ wisdom: 3, loneliness: -2 }); return 'Music, candles and stories. Death felt less lonely.'; }, 'graveVisit'),
  ], { cooldown: 4 }),
  cx('er_mx_chinampa', 'mx', [1428, 1520], 'farm', 'The floating gardens', 'In the lake city of Tenochtitlan, crops grow on floating garden plots between canals.', [
    ch('Tend the gardens', ['cautious'], (x) => { x.train('farming', 3); return 'Maize, beans and squash, grown on water. Clever ancestors.'; }),
    ch('Trade at the great market', ['ambitious'], (x) => { x.train('negotiation', 3); x.money(cost(x, 50)); return 'You traded cacao beans for feathers, obsidian and gossip.'; }, 'shopping'),
    ch('Paddle the canals', ['impulsive'], (x) => { x.mods({ happiness: 3 }); return 'Temples shining in the sun and the lake full of birds.'; }, 'fishing'),
  ]),
  cx('er_mx_lucha', 'mx', [1933, 2300], 'sports', 'Lucha libre', 'Masked wrestlers fly off the ropes while grandmothers scream insults at the villain.', [
    ch('Scream at the villain', ['impulsive'], (x) => { x.mods({ happiness: 4, stress: -3 }); return 'He pointed at you. You pointed back. Magnificent.'; }),
    ch('Buy a mask', ['social'], (x) => { pay(x, 10); x.mods({ happiness: 2 }); return 'Gold and green. You wore it home.'; }, 'shopping'),
    ch('Train as a luchador', ['ambitious'], (x) => { x.train('wrestling', 3); x.train('acrobatics', 2); return 'You learned to fall properly. Mostly.'; }, 'gym', (x) => x.age >= 16 && x.age <= 35),
  ]),
  // ---- Colombia
  cx('er_co_coffee', 'co', [1850, 2300], 'farm', 'Coffee harvest', 'The ripe red coffee cherries must be picked by hand on the steep green hillsides.', [
    ch('Pick with the family', ['help'], (x) => { x.train('farming', 3); x.money(cost(x, 200)); return 'Baskets of red cherries and a view of the clouds below you.'; }),
    ch('Learn to roast', ['ambitious'], (x) => { x.train('artisanship', 3); return 'A shade too dark and it is ruined. You found the perfect shade.'; }, 'cooking'),
    ch('Drink a fresh cup', ['cautious'], (x) => { x.mods({ happiness: 3, energy: 4 }); return 'From the bush to your cup. Unbeatable.'; }),
  ]),
  cx('er_co_flowers', 'co', [1957, 2300], 'parade', 'Flower festival', 'Farmers parade through Medellín carrying enormous flower arrangements on their backs.', [
    ch('Carry a flower board', ['ambitious'], (x) => { x.mods({ fitness: 2, popularity: 3 }); return 'Heavy, beautiful and applauded by a whole city.'; }),
    ch('Watch the parade', ['social'], (x) => { x.mods({ happiness: 4 }); return 'Orchids everywhere. The air smelled like a garden.'; }),
    ch('Help arrange flowers', ['help'], (x) => { x.train('design', 2); return 'Ten thousand petals in perfect patterns.'; }, 'gardening'),
  ], { cooldown: 4 }),
  cx('er_co_vallenato', 'co', [1900, 2300], 'music', 'Vallenato night', 'An accordion, a drum and a scraper play stories of love and loss until dawn.', [
    ch('Dance', ['social'], (x) => { x.train('dance', 2); x.mods({ happiness: 4 }); return 'You danced until the accordion player begged for a break.'; }, 'dance'),
    ch('Learn the accordion', ['ambitious'], (x) => { x.train('instrumentMastery', 3); return 'You can play one song. Badly. Loudly.'; }),
    ch('Listen to the stories', ['cautious'], (x) => { x.mods({ empathy: 2 }); return 'A song about a lost cow made you cry.'; }),
  ]),
  // ---- Nigeria
  cx('er_ng_durbar', 'ng', [1400, 2300], 'parade', 'The Durbar', 'Horsemen in brilliant robes gallop toward the emir in a thundering salute.', [
    ch('Ride in the procession', ['ambitious'], (x) => { x.train('horsemanship', 3); x.mods({ popularity: 3 }); return 'You galloped, reined in at the last second, and saluted. The crowd roared.'; }, 'petHorse', (x) => x.age >= 14),
    ch('Cheer the horsemen', ['social'], (x) => { x.mods({ happiness: 4 }); return 'Drums, trumpets and dust. Unforgettable.'; }),
    ch('Sell food to the crowd', ['help'], (x) => { x.money(cost(x, 60)); return 'Suya and kola nuts sold out by noon.'; }, 'shopping'),
  ], { cooldown: 4 }),
  cx('er_ng_nollywood', 'ng', [1992, 2300], 'cinema', 'Nollywood shoot', 'A film crew is shooting a drama on your street and needs extras right now.', [
    ch('Be an extra', ['impulsive'], (x) => { x.train('acting', 2); x.mods({ happiness: 3 }); return 'You played "Shocked Neighbour #3". Your family watched it ten times.'; }),
    ch('Ask for a speaking role', ['ambitious'], (x) => { x.train('acting', 3); x.mods({ fame: x.chance(0.2) ? 4 : 0, confidence: 2 }); return 'One line: "But he is your brother!" You delivered it with fire.'; }, 'stage'),
    ch('Sell them lunch', ['help'], (x) => { x.money(cost(x, 50)); return 'Jollof rice for the whole crew. The director asked you back.'; }, 'cooking'),
  ]),
  cx('er_ng_market', 'ng', [1400, 2300], 'shopping', 'The great market', 'A sprawling market of fabrics, spices, yams, and traders who could sell sand in the desert.', [
    ch('Haggle for cloth', ['ambitious'], (x) => { x.train('negotiation', 3); pay(x, 20); return 'Beautiful wax print at half the first price. Both sides happy.'; }),
    ch('Set up a stall', ['ambitious'], (x) => { x.train('sales', 3); x.money(cost(x, 80)); return 'You learned the rhythm of the market by the end of the week.'; }),
    ch('Buy street food', ['impulsive'], (x) => { pay(x, 3); x.mods({ happiness: 3 }); return 'Puff-puff, hot and sweet.'; }, 'restaurant'),
  ]),
  // ---- Egypt
  cx('er_eg_nileFlood', 'eg', [-800, 1970], 'flood', 'The Nile rises', 'The river floods as it does every year, leaving rich black soil across the fields.', [
    ch('Plant in the new mud', ['cautious'], (x) => { x.train('farming', 3); x.money(cost(x, 80)); return 'The best harvest in years. The river gives.'; }, 'farm'),
    ch('Measure the flood', ['ambitious'], (x) => { x.train('mathematics', 3); return 'You read the marks on the river stairs and predicted the harvest. The officials were impressed.'; }),
    ch('Move the animals to high ground', ['help'], (x) => { x.mods({ karma: 2, fitness: 1 }); return 'Goats, donkeys and one very stubborn camel, all safe.'; }),
  ]),
  cx('er_eg_pyramids', 'eg', [-800, 2300], 'museum', 'At the pyramids', 'The great pyramids stand on the edge of the desert, older than almost anything.', [
    ch('Climb inside a passage', ['impulsive'], (x) => { x.mods({ happiness: 3, anxiety: 1 }); return 'Hot, narrow and silent. You felt very small and very lucky.'; }),
    ch('Ride a camel around them', ['social'], (x) => { pay(x, 15); x.mods({ happiness: 4 }); return 'The camel had opinions. The view had none, only grandeur.'; }, 'travel'),
    ch('Study the hieroglyphs', ['ambitious'], (x) => { x.train('history', 3); return 'Names of kings, gods and a workers\' complaint about bread.'; }, 'study'),
  ], { minAge: 8 }),
  cx('er_eg_cafe', 'eg', [1800, 2300], 'bar', 'Coffee house in Cairo', 'Backgammon boards clatter, water pipes bubble and old men argue about football and politics.', [
    ch('Play backgammon', ['ambitious'], (x) => { x.train('logic', 2); return x.chance(0.5) ? 'You won three games. The old man demanded a rematch.' : 'He beat you with a smile and a speed you cannot explain.'; }, 'gaming'),
    ch('Listen to the radio singer', ['cautious'], (x) => { x.mods({ happiness: 3, empathy: 1 }); return 'A song that lasted an hour and felt like a lifetime.'; }),
    ch('Debate the news', ['social'], (x) => { x.train('persuasion', 2); x.mods({ loneliness: -2 }); return 'Nobody agreed. Everybody enjoyed it.'; }),
  ], { minAge: 14 }),
  // ---- Arabia
  cx('er_sa_caravan', 'sa', [-800, 1930], 'travel', 'The caravan', 'A camel caravan is leaving for the coast, loaded with incense, dates and cloth.', [
    ch('Join the caravan', ['ambitious'], (x) => { x.money(cost(x, 300)); x.mods({ fitness: 2, health: -2 }); return 'Weeks of sand, stars and silence. You came back richer.'; }),
    ch('Navigate by the stars', ['cautious'], (x) => { x.train('astronomy', 3); return 'The old guide taught you to read the sky like a map.'; }, 'stargazing'),
    ch('Trade at the oasis', ['social'], (x) => { x.train('negotiation', 2); x.money(cost(x, 80)); return 'Fresh water, dates and good bargains under the palms.'; }, 'shopping'),
  ], { minAge: 14 }),
  cx('er_sa_hajj', 'sa', [630, 2300], 'holy', 'Pilgrims arrive', 'Pilgrims from every corner of the world have come to Mecca. Your town is full of travellers.', [
    ch('Perform the pilgrimage', ['cautious'], (x) => { x.mods({ faith: 8, wisdom: 3, health: -1 }); x.remember('er_hajj', 'Performed the pilgrimage to Mecca', 60); return 'Millions in white, all equal before God. You were changed.'; }, undefined, (x) => x.c.religionId === 'islam'),
    ch('Help the pilgrims', ['help'], (x) => { x.mods({ karma: 5 }); return 'Water, directions and kindness for tired travellers.'; }, 'volunteer'),
    ch('Earn from the crowds', ['ambitious'], (x) => { x.money(cost(x, 200)); return 'Lodging, food and rides. A good season.'; }),
  ], { minAge: 14, cooldown: 6 }),
  cx('er_sa_desertCamp', 'sa', [1960, 2300], 'camping', 'Desert camping', 'A weekend in the dunes: tents, a fire, cardamom coffee and a sky full of stars.', [
    ch('Drive up the dunes', ['impulsive'], (x) => { x.mods({ happiness: 4, riskTolerance: 2 }); return 'Over the crest and down the other side, screaming.'; }, 'roadTrip'),
    ch('Tell stories by the fire', ['social'], (x) => { x.mods({ loneliness: -4 }); return 'Your uncle\'s story about the jinn kept everyone awake.'; }),
    ch('Watch the stars', ['cautious'], (x) => { x.mods({ wisdom: 2, stress: -4 }); return 'So many stars the sky looked crowded.'; }, 'stargazing'),
  ]),
  // ---- Persia / Iran
  cx('er_ir_nowruz', 'ir', [-800, 2300], 'festival', 'Nowruz', 'The Persian New Year arrives with spring: sprouted wheat, painted eggs and leaping over bonfires.', [
    ch('Jump over the fire', ['impulsive'], (x) => { x.mods({ happiness: 4 }); return '"My yellow to you, your red to me." Winter\'s troubles burned away.'; }, 'fire'),
    ch('Set the festive table', ['help'], (x) => { x.mods({ happiness: 3, loneliness: -3 }); return 'Seven symbolic items, a goldfish and a mirror. Perfect.'; }, 'familyDinner'),
    ch('Visit the elders', ['social'], (x) => { x.mods({ karma: 2, wisdom: 1 }); return 'Tea, pastries and gentle questions about your marriage plans.'; }, 'grandparents'),
  ], { cooldown: 4 }),
  cx('er_ir_poetry', 'ir', [1300, 2300], 'reading', 'Fortune from a poet', 'Your family opens a book of a beloved Persian poet at random, seeking advice from the verses.', [
    ch('Take the verse seriously', ['cautious'], (x) => { x.mods({ wisdom: 3, faith: 1 }); return 'The verse spoke of patience and wine. You took the first part to heart.'; }),
    ch('Learn the poem by heart', ['ambitious'], (x) => { x.train('poetry', 4); return 'You will recite it at weddings for the rest of your life.'; }),
    ch('Laugh at the coincidence', ['social'], (x) => { x.mods({ happiness: 2 }); return 'It was about a lovesick nightingale. Your aunt looked at you knowingly.'; }),
  ]),
  cx('er_ir_bazaar', 'ir', [-500, 2300], 'shopping', 'The grand bazaar', 'Under the vaulted brick roof: carpets, saffron, copper pots and merchants serving endless tea.', [
    ch('Buy a carpet', ['impulsive'], (x) => { if (!pay(x, 500)) return 'You drank six glasses of tea and could not afford a single rug.'; x.mods({ happiness: 3 }); return 'Hand-knotted over two years. It will outlive your grandchildren.'; }),
    ch('Apprentice with a weaver', ['ambitious'], (x) => { x.train('artisanship', 3); return 'Knot by knot, you learned patience.'; }),
    ch('Just drink the tea', ['cautious'], (x) => { x.mods({ stress: -2, loneliness: -2 }); return 'Free tea and three hours of conversation.'; }),
  ]),
  // ---- Greece
  cx('er_gr_olympics', 'gr', [-776, 393], 'sports', 'The Olympic games', 'Athletes from all over the Greek world gather at Olympia. A sacred truce is in place.', [
    ch('Compete in the footrace', ['ambitious'], (x) => { x.train('running', 4); if (x.chance(0.08)) { x.mods({ fame: 10, ego: 5 }); x.remember('er_olympia', 'Won at Olympia', 80); return 'You won! An olive crown and free meals for life in your home city.'; } return 'You finished in the middle. Still: Olympia.'; }, undefined, (x) => x.age >= 14 && x.age <= 35),
    ch('Watch the wrestling', ['social'], (x) => { x.mods({ happiness: 4 }); return 'No rules except no biting and no eye-gouging. Mostly followed.'; }),
    ch('Sell figs to the crowd', ['help'], (x) => { x.money(cost(x, 50)); return 'Forty thousand hungry spectators. A good week.'; }, 'shopping'),
  ], { cooldown: 4 }),
  cx('er_gr_symposium', 'gr', [-600, -100], 'party', 'The symposium', 'Couches, watered wine, music and a long argument about the nature of love.', [
    ch('Make a speech on love', ['ambitious'], (x) => { x.train('oratory', 3); x.train('philosophy', 2); return 'Your speech was applauded, then dismantled by an old man with questions.'; }),
    ch('Play the lyre', ['social'], (x) => { x.train('music', 3); x.mods({ popularity: 2 }); return 'Your song was mostly in tune. The wine helped.'; }, 'music'),
    ch('Drink the wine unwatered', ['impulsive'], (x) => { x.mods({ happiness: 3, health: -1, popularity: -1 }); return 'Barbaric, said everyone. You agreed the next morning.'; }),
  ], { minAge: 18 }),
  cx('er_gr_easter', 'gr', [600, 2300], 'festival', 'Easter night', 'At midnight, the church lights candle after candle, and the whole town walks home with flames.', [
    ch('Carry the flame home', ['cautious'], (x) => { x.mods({ faith: 3, happiness: 2 }); return 'You protected it from the wind all the way home and marked a cross above the door.'; }, 'holy'),
    ch('Crack red eggs', ['social'], (x) => { x.mods({ happiness: 3 }); return 'Your egg beat everyone\'s. Good luck for a year.'; }, 'familyDinner'),
    ch('Roast the lamb', ['help'], (x) => { x.train('cooking', 3); return 'Six hours turning the spit. Everyone said it was the best yet.'; }, 'cooking'),
  ], { cooldown: 4 }),
  cx('er_gr_ferry', 'gr', [1950, 2300], 'travel', 'Island hopping', 'A ferry is leaving for the islands: white houses, blue domes and a sea the colour of ink.', [
    ch('Island-hop for a week', ['impulsive'], (x) => { if (!pay(x, 300)) return 'Only enough for a day trip. The sea was beautiful anyway.'; x.mods({ happiness: 6, stress: -6 }); return 'Octopus, sunsets and swims in water so clear you could see your toes.'; }, 'beach'),
    ch('Visit your grandparents\' village', ['help'], (x) => { x.mods({ loneliness: -4, karma: 2 }); return 'Everyone knew who you were before you said a word.'; }, 'grandparents'),
    ch('Work a summer season', ['ambitious'], (x) => { x.train('hospitality', 3); x.money(cost(x, 800)); return 'Long hours serving tourists, nights swimming under the stars.'; }),
  ], { minAge: 12 }),
  // ---- Australia
  cx('er_au_outback', 'au', [1830, 2300], 'roadTrip', 'The outback', 'Red earth to the horizon, a roadhouse every few hundred kilometres and kangaroos at dusk.', [
    ch('Drive into the red centre', ['impulsive'], (x) => { pay(x, 200); x.mods({ happiness: 5, wisdom: 2 }); return 'The great red rock glowed at sunset. You fell silent.'; }),
    ch('Work on a cattle station', ['ambitious'], (x) => { x.train('animalHusbandry', 3); x.train('horsemanship', 2); x.money(cost(x, 600)); return 'Dust, flies and the best sunrises of your life.'; }, 'farm'),
    ch('Carry extra water', ['cautious'], (x) => { x.mods({ wisdom: 1 }); return 'You did not need it. Someone else did.'; }),
  ], { minAge: 16 }),
  cx('er_au_surf', 'au', [1915, 2300], 'beach', 'Surf\'s up', 'Big waves, a lifesaver\'s flag and a friend with a spare board.', [
    ch('Paddle out', ['impulsive'], (x) => { x.train('swimming', 2); x.mods({ fitness: 2, happiness: 4 }); return x.chance(0.4) ? 'You stood up! For three glorious seconds.' : 'The ocean washed you around like laundry.'; }),
    ch('Swim between the flags', ['cautious'], (x) => { x.train('swimming', 2); return 'Safe, fun and sunburnt.'; }),
    ch('Join the lifesavers', ['help'], (x) => { x.train('swimming', 3); x.mods({ karma: 3, fitness: 2 }); return 'Red and yellow cap, whistle, and one real rescue all summer.'; }),
  ], { minAge: 8 }),
  cx('er_au_christmasBbq', 'au', [1850, 2300], 'heatwave', 'Christmas in summer', 'It is Christmas Day and thirty-eight degrees. Someone is wearing a Santa hat and board shorts.', [
    ch('Throw prawns on the barbie', ['social'], (x) => { pay(x, 40); x.mods({ happiness: 4, loneliness: -3 }); return 'Prawns, pavlova and backyard cricket.'; }, 'familyDinner'),
    ch('Go to the beach', ['impulsive'], (x) => { x.mods({ happiness: 3 }); return 'Santa arrived on a surfboard.'; }, 'beach'),
    ch('Roast a turkey anyway', ['cautious'], (x) => { x.train('cooking', 2); x.mods({ stress: 2 }); return 'Tradition, and a kitchen like a furnace.'; }, 'cooking'),
  ], { cooldown: 4 }),
  // ---- Switzerland
  cx('er_ch_cowParade', 'ch', [1300, 2300], 'farm', 'The cows come down', 'In autumn, the herds come down from the alpine pastures wearing flowers and enormous bells.', [
    ch('Lead a cow', ['help'], (x) => { x.train('animalHusbandry', 2); x.mods({ happiness: 3 }); return 'Your cow wore a crown of flowers and an expression of great dignity.'; }),
    ch('Taste the alpine cheese', ['impulsive'], (x) => { pay(x, 15); x.mods({ happiness: 3 }); return 'A summer of mountain grass, in cheese form.'; }, 'restaurant'),
    ch('Play the alphorn', ['ambitious'], (x) => { x.train('instrumentMastery', 2); return 'A long, low note echoed across the valley. A cow answered.'; }, 'music'),
  ], { cooldown: 4 }),
  cx('er_ch_bank', 'ch', [1934, 2300], 'bribe', 'A discreet bank', 'A soft-spoken banker explains that his bank asks very few questions and keeps very good secrets.', [
    ch('Open a modest account', ['cautious'], (x) => { x.train('investing', 2); return 'Your savings now live in a vault under a mountain. Very calming.'; }, 'stocks'),
    ch('Ask about secret accounts', ['ambitious'], (x) => { x.train('offshoreBanking', 3); x.mods({ corruption: 2 }); return 'He smiled, and slid a form across the desk without a word.'; }),
    ch('Report a dodgy client', ['help'], (x) => { x.mods({ karma: 3, professionalRep: 2 }); return 'Your manager was not pleased. The regulators were.'; }, 'police'),
  ], { minAge: 18 }),
  cx('er_ch_ski', 'ch', [1890, 2300], 'skiing', 'The ski slopes', 'Fresh snow, blue sky and a mountain railway to the top.', [
    ch('Take the black run', ['impulsive'], (x) => { x.train('skiing', 3); if (x.chance(0.12)) { x.mods({ health: -6, pain: 5 }); return 'A spectacular fall. Your knee will tell you about it when it rains.'; } x.mods({ happiness: 5 }); return 'You flew down. Nobody saw. It counts anyway.'; }),
    ch('Ski school', ['cautious'], (x) => { x.train('skiing', 4); return 'Snowplough, snowplough, parallel turn! Then a five-year-old overtook you.'; }),
    ch('Fondue in the hut', ['social'], (x) => { pay(x, 40); x.mods({ happiness: 4 }); return 'If you drop your bread in the pot, you buy the next round.'; }, 'restaurant'),
  ], { minAge: 6 }),
  // ---- South Africa
  cx('er_za_braai', 'za', [1700, 2300], 'familyDinner', 'The braai', 'Wood fire, sizzling boerewors and everyone with an opinion on how to grill it properly.', [
    ch('Take charge of the fire', ['ambitious'], (x) => { x.train('cooking', 3); x.mods({ ego: 2 }); return 'Perfect coals. Everyone said so, eventually.'; }),
    ch('Bring a salad', ['cautious'], (x) => { x.mods({ popularity: 1 }); return 'Nobody ate the salad. Classic.'; }),
    ch('Talk until sunset', ['social'], (x) => { x.mods({ loneliness: -5, happiness: 3 }); return 'Hours of stories under a huge sky.'; }, 'friends'),
  ]),
  cx('er_za_diamonds', 'za', [1867, 1914], 'construction', 'Diamond fields', 'Diamonds have been found in the dry country. Thousands are digging a hole into the earth by hand.', [
    ch('Stake a claim', ['ambitious', 'impulsive'], (x) => { x.mods({ fitness: 2, health: -3 }); if (x.chance(0.08)) { const m = cost(x, 20000); x.money(m); return `A gleaming stone in your sieve: ${x.fmt(m)}.`; } return 'Months of digging. Dust, debt and no diamonds.'; }),
    ch('Sell supplies to diggers', ['cautious'], (x) => { x.money(cost(x, 800)); return 'Shovels, water and bread. The surest fortune on the fields.'; }, 'shopping'),
    ch('Stay away', ['cautious'], (x) => { x.mods({ wisdom: 2 }); return 'The fever passed you by.'; }),
  ], { minAge: 16 }),
  cx('er_za_rugby', 'za', [1900, 2300], 'sports', 'Rugby test', 'A big rugby match against a rival nation. The whole country is holding its breath.', [
    ch('Watch at the stadium', ['impulsive'], (x) => { pay(x, 40); x.mods({ happiness: 4 }); return x.chance(0.5) ? 'A last-minute try! Strangers hugged you.' : 'A narrow loss. The ride home was silent.'; }),
    ch('Watch with friends', ['social'], (x) => { x.mods({ loneliness: -4 }); return 'Shouting at the screen together is the true national sport.'; }, 'friends'),
    ch('Play a club game', ['ambitious'], (x) => { x.train('ballSports', 3); x.mods({ fitness: 2, pain: 2 }); return 'Muddy, bruised and very proud.'; }, undefined, (x) => x.age >= 12 && x.age <= 40),
  ]),
  // ---- Cayman Islands
  cx('er_ky_turtles', 'ky', [1670, 1970], 'smuggling', 'Turtling season', 'The island\'s schooners are setting out to catch sea turtles, the old lifeblood of the islands.', [
    ch('Crew a schooner', ['ambitious'], (x) => { x.train('sailing', 4); x.money(cost(x, 300)); return 'Months at sea, salt in everything. You came home brown and proud.'; }, 'travel'),
    ch('Build boats', ['cautious'], (x) => { x.train('carpentry', 3); return 'Island boats, built by hand from island wood.'; }, 'construction'),
    ch('Fish close to shore', ['cautious'], (x) => { x.train('fishing', 3); return 'Snapper for dinner and time to watch the sunset.'; }, 'fishing'),
  ], { minAge: 14 }),
  cx('er_ky_offshore', 'ky', [1966, 2300], 'office', 'Offshore boom', 'Banks and trust companies are opening offices on the island. Thousands of companies are registered at one address.', [
    ch('Work for a bank', ['ambitious'], (x) => { x.train('accounting', 3); x.money(cost(x, 1500)); return 'Air-conditioned office, good salary, many confidential folders.'; }),
    ch('Ask about the shell companies', ['cautious'], (x) => { x.train('shellCompanies', 2); x.mods({ wisdom: 1 }); return 'Your boss suggested you ask fewer questions.'; }),
    ch('Stay in the dive shop', ['impulsive'], (x) => { x.train('diving', 2); x.mods({ happiness: 3 }); return 'Less money, more stingrays.'; }, 'beach'),
  ], { minAge: 18 }),
  cx('er_ky_dive', 'ky', [1960, 2300], 'beach', 'The reef', 'The water is so clear you can see the reef fifty metres down. Stingrays glide over the sandbar.', [
    ch('Learn to dive', ['ambitious'], (x) => { x.train('diving', 4); x.mods({ happiness: 4 }); return 'A turtle swam right past your mask.'; }),
    ch('Feed the stingrays', ['impulsive'], (x) => { x.mods({ happiness: 3 }); return 'They felt like wet velvet and ate the squid politely.'; }, 'zoo'),
    ch('Join a reef clean-up', ['help'], (x) => { x.mods({ karma: 3 }); return 'Two bags of plastic out of paradise.'; }, 'volunteer'),
  ], { minAge: 10 }),
];

// ================================================================== NATURAL PHENOMENA (any era)
const premodern = (x: Ctx): boolean => x.year < 1750;

const NATURE: EventDef[] = [
  {
    id: 'er_eclipse', cat: 'world', minAge: 4, cooldown: 15, weight: 0.5, scene: 'eclipse',
    title: 'The sun goes dark', text: (x) => (premodern(x) ? 'At midday the sun is being eaten by a black disc. Birds fall silent and people wail in the streets.' : 'A total solar eclipse is crossing your region. Everyone has special glasses.'),
    choices: [
      ch('Watch in awe', ['cautious'], (x) => { x.mods({ wisdom: 3, happiness: 3 }); x.remember('er_eclipse', `Saw a total eclipse in ${fmtYear(x.year)}`, 30); return 'Stars at noon, a ring of fire, then the sun came back. You will never forget it.'; }),
      ch('Pray it ends', ['cautious'], (x) => { x.mods({ faith: 3, anxiety: 2 }); return 'It ended. The priests took the credit.'; }, 'holy', premodern),
      ch('Predict the next one', ['ambitious'], (x) => { x.train('astronomy', 4); x.mods({ smarts: 2 }); return 'Your calculations were close. Close enough to impress the neighbours.'; }),
    ],
  },
  {
    id: 'er_comet', cat: 'world', minAge: 4, cooldown: 20, weight: 0.4, scene: 'meteor',
    title: 'A comet appears', text: (x) => (premodern(x) ? 'A blazing star with a long tail hangs in the night sky. Everyone says it is an omen.' : 'A bright comet is visible to the naked eye for weeks. Astronomers are thrilled.'),
    choices: [
      ch('Call it a good omen', ['social'], (x) => { x.mods({ happiness: 3, faith: 1 }); return 'Your optimism was contagious. The harvest was fine.'; }),
      ch('Fear the worst', ['cautious'], (x) => { x.mods({ anxiety: 4 }); return 'You buried your silver in the garden. Just in case.'; }),
      ch('Sketch its path', ['ambitious'], (x) => { x.train('astronomy', 3); return 'Night after night, its tail grew. You kept the drawings.'; }, 'stargazing'),
    ],
  },
  {
    id: 'er_meteorShower', cat: 'world', minAge: 6, cooldown: 6, weight: 0.5, scene: 'stargazing',
    title: 'Shooting stars', text: 'On a clear night, shooting stars streak across the sky every few seconds.',
    choices: [
      ch('Make a wish', ['impulsive'], (x) => { x.mods({ happiness: 3 }); return 'You wished. You will not say what. It might still come true.'; }),
      ch('Count them with friends', ['social'], (x) => { x.mods({ loneliness: -3, happiness: 2 }); return 'Sixty-three. Your friend claims sixty-five. You will argue forever.'; }, 'friends'),
      ch('Look for a fallen stone', ['ambitious'], (x) => { if (x.chance(0.05)) { x.money(cost(x, 2000)); return 'A real meteorite, warm and black. A collector paid handsomely.'; } return 'You found many rocks. All of them from Earth.'; }, 'hiking'),
    ],
  },
  {
    id: 'er_ashWinter', cat: 'world', minAge: 4, cooldown: 30, weight: 0.25, scene: 'volcano',
    title: 'The year without summer', text: 'A distant volcano has filled the sky with ash. The sun is dim, the summer is cold and crops are failing.',
    choices: [
      ch('Store what food you can', ['cautious'], (x) => { x.money(-cost(x, 100)); x.mods({ stress: 4 }); return 'A thin, careful winter. You made it through.'; }, 'famine'),
      ch('Share with neighbours', ['help'], (x) => { x.money(-cost(x, 150)); x.mods({ karma: 6, popularity: 3 }); return 'Less for you, but the whole street survived.'; }, 'volunteer'),
      ch('Paint the strange sunsets', ['ambitious'], (x) => { x.train('painting', 3); x.mods({ creativity: 3 }); return 'Fiery orange skies, every evening. Your paintings were eerie and beautiful.'; }, 'painting'),
    ],
  },
  {
    id: 'er_heatwave', cat: 'world', minAge: 4, cooldown: 4, weight: (x) => (x.year > 2020 ? 1 : 0.4), scene: 'heatwave',
    title: 'Heatwave', text: (x) => (x.year > 2020 ? 'The thermometer has broken records three days in a row. Pavements are melting.' : 'A scorching heat has settled over the land. Wells are low and tempers short.'),
    choices: [
      ch('Check on elderly neighbours', ['help'], (x) => { x.mods({ karma: 4, empathy: 2 }); return 'You brought water and fans. One of them really needed it.'; }, 'volunteer'),
      ch('Head for the water', ['impulsive'], (x) => { x.mods({ happiness: 3 }); return 'The whole town was in the river. Glorious.'; }, 'beach'),
      ch('Stay in the shade', ['cautious'], (x) => { x.mods({ health: 1, energy: -2 }); return 'You did nothing for a week, sensibly.'; }),
    ],
  },
  {
    id: 'er_blizzard', cat: 'world', minAge: 4, cooldown: 4, weight: (x) => (['ru', 'ch', 'de', 'us', 'jp', 'cn', 'gb', 'fr'].includes(x.c.countryId) ? 0.6 : 0), scene: 'blizzard',
    title: 'Snowed in', text: 'A blizzard has buried everything. The doors will not open and the roads are gone.',
    choices: [
      ch('Dig out the neighbours', ['help'], (x) => { x.mods({ fitness: 2, karma: 3, popularity: 2 }); return 'Your back ached. Their gratitude warmed you.'; }),
      ch('Build a snow fort', ['impulsive'], (x) => { x.mods({ happiness: 4 }); return 'An impressive fort with a working door. Briefly.'; }),
      ch('Ration the firewood', ['cautious'], (x) => { x.mods({ stress: 3, discipline: 2 }); return 'A cold, careful week. The thaw came just in time.'; }),
    ],
  },
  {
    id: 'er_aurora', cat: 'world', minAge: 4, cooldown: 10, weight: (x) => (['ru', 'gb', 'ch', 'de', 'us'].includes(x.c.countryId) ? 0.4 : 0), scene: 'stargazing',
    title: 'Lights in the sky', text: 'Curtains of green and red light are dancing across the northern sky.',
    choices: [
      ch('Stay out all night', ['impulsive'], (x) => { x.mods({ happiness: 5, wisdom: 2 }); return 'The sky shimmered until dawn. You could not look away.'; }),
      ch('Wake the family', ['social'], (x) => { x.mods({ loneliness: -3, happiness: 3 }); return 'Everyone in blankets on the doorstep, gasping.'; }, 'family'),
      ch('Wonder what it means', ['cautious'], (x) => { x.mods({ faith: 2, paranormal: 1 }); return premodern(x) ? 'The old women said the dead were dancing.' : 'Solar winds, said the radio. Magic, said your heart.'; }),
    ],
  },
  {
    id: 'er_locusts', cat: 'world', minAge: 6, cooldown: 12, weight: (x) => (['eg', 'sa', 'ir', 'in', 'ng', 'cn', 'za'].includes(x.c.countryId) ? 0.5 : 0), scene: 'famine',
    title: 'Locust swarm', text: 'A dark cloud on the horizon turns out to be locusts. Billions of them.',
    choices: [
      ch('Bang pots to scare them', ['impulsive'], (x) => { x.mods({ stress: 4 }); return x.chance(0.3) ? 'The noise saved half your field.' : 'The locusts did not care about pots.'; }),
      ch('Harvest early', ['cautious'], (x) => { x.money(-cost(x, 50)); return 'You saved most of the crop, unripe but safe.'; }, 'farm'),
      ch('Cook the locusts', ['ambitious'], (x) => { x.train('cooking', 2); x.mods({ health: 1 }); return 'Roasted with salt. Crunchy revenge.'; }, 'cooking'),
    ],
  },
  {
    id: 'er_riverFlood', cat: 'world', minAge: 4, cooldown: 6, weight: 0.4, scene: 'flood',
    title: 'The river bursts', text: 'Days of rain and the river has burst its banks. Water is rising in the streets.',
    choices: [
      ch('Sandbag the street', ['help'], (x) => { x.mods({ fitness: 2, karma: 3 }); return 'Your street stayed dry. The next one was not so lucky.'; }, 'construction'),
      ch('Save your belongings', ['cautious'], (x) => { x.money(-cost(x, 100)); x.mods({ stress: 4 }); return 'You carried what you could upstairs. The rest was ruined.'; }),
      ch('Row people to safety', ['help', 'impulsive'], (x) => { x.mods({ karma: 6, confidence: 3, fame: 1 }); return 'You rowed nine people and a goat to higher ground.'; }, 'fishing', (x) => x.age >= 14),
    ],
  },
  {
    id: 'er_drought', cat: 'world', minAge: 4, cooldown: 8, weight: 0.4, scene: 'famine',
    title: 'Drought', text: 'No rain for months. The fields are cracked and the river is a trickle.',
    choices: [
      ch('Dig a deeper well', ['ambitious'], (x) => { x.mods({ fitness: 2 }); return x.chance(0.6) ? 'Water at last, cool and clean.' : 'Dry dust all the way down.'; }, 'construction'),
      ch('Pray for rain', ['cautious'], (x) => { x.mods({ faith: 3 }); return x.chance(0.4) ? 'The rain came a week later. Coincidence, probably.' : 'The sky stayed blue and empty.'; }, 'holy'),
      ch('Share your water', ['help'], (x) => { x.mods({ karma: 5, health: -1 }); return 'A thirsty family never forgot it.'; }),
    ],
  },
  {
    id: 'er_tremor', cat: 'world', minAge: 4, cooldown: 8, weight: (x) => (['jp', 'ir', 'gr', 'it', 'mx', 'co', 'cn', 'us'].includes(x.c.countryId) ? 0.5 : 0), scene: 'quake',
    title: 'The ground shakes', text: 'A sharp tremor rattles the house. Plates fall, dogs bark, then it stops.',
    choices: [
      ch('Get outside fast', ['cautious'], (x) => { x.mods({ anxiety: 3 }); return 'Everyone in the street in their nightclothes. Nobody hurt.'; }),
      ch('Check on neighbours', ['help'], (x) => { x.mods({ karma: 3 }); return 'A cracked wall, a frightened child, and tea for everyone.'; }),
      ch('Prepare an emergency kit', ['cautious'], (x) => { pay(x, 30); x.mods({ wisdom: 2 }); return 'Water, candles and a whistle. You feel slightly braver.'; }),
    ],
  },
  {
    id: 'er_hurricane', cat: 'world', minAge: 4, cooldown: 5, weight: (x) => (['ky', 'us', 'mx', 'co', 'jp', 'cn', 'in', 'au'].includes(x.c.countryId) ? 0.6 : 0), scene: 'storm',
    title: 'The great storm', text: (x) => (x.year >= 1950 ? 'A hurricane warning has been issued. The storm will make landfall tonight.' : 'The sky turned green and the old sailors say a great storm is coming.'),
    choices: [
      ch('Board up and stay', ['cautious'], (x) => { x.mods({ stress: 6 }); if (x.chance(0.2)) { x.money(-cost(x, 1000)); return 'The roof partly went. You did not.'; } return 'A terrifying night of howling wind. The house held.'; }),
      ch('Evacuate inland', ['cautious'], (x) => { pay(x, 50); x.mods({ stress: 3 }); return 'A long drive, a shelter cot, and home still standing when you returned.'; }, 'refugees'),
      ch('Help at the shelter', ['help'], (x) => { x.mods({ karma: 5, empathy: 3 }); return 'Blankets, soup and a radio playing all night.'; }, 'volunteer'),
    ],
  },
  {
    id: 'er_frostFair', cat: 'world', minAge: 4, years: [1600, 1814], when: inCountry('gb'), cooldown: 15, weight: 0.5, scene: 'blizzard',
    title: 'Frost fair', text: 'The Thames has frozen solid. Booths, skittles, printing presses and an ox roast have set up on the ice.',
    choices: [
      ch('Skate across the river', ['impulsive'], (x) => { x.mods({ happiness: 5 }); return 'You skated under a bridge where boats should be. Magic.'; }, 'skiing'),
      ch('Print your name on the ice', ['social'], (x) => { pay(x, 2); x.remember('er_frostFair', 'Visited a frost fair on the frozen Thames', 25); return 'A souvenir card: printed on the river itself.'; }),
      ch('Sell hot gin', ['ambitious'], (x) => { x.money(cost(x, 100)); return 'Freezing customers, endless trade.'; }, 'bar'),
    ],
  },
  {
    id: 'er_wildfire', cat: 'world', minAge: 4, cooldown: 6, weight: (x) => (['au', 'us', 'gr', 'br', 'es'].includes(x.c.countryId) ? (x.year > 2000 ? 0.8 : 0.3) : 0), scene: 'fire',
    title: 'Bushfire smoke', text: 'The sky has turned orange and ash is falling like snow. A fire is burning in the hills.',
    choices: [
      ch('Evacuate early', ['cautious'], (x) => { x.mods({ stress: 5 }); return 'You left with the dog and the photos. The fire turned before it reached you.'; }, 'refugees'),
      ch('Volunteer with the fire crews', ['help'], (x) => { x.mods({ karma: 6, fitness: 2, trauma: 2 }); return 'Long nights, black faces, and a town saved.'; }, undefined, (x) => x.age >= 18),
      ch('Stay and defend the house', ['impulsive'], (x) => { if (x.chance(0.2)) { x.mods({ health: -8 }); return 'The smoke was worse than you thought. You were lucky.'; } return 'Hoses, wet towels and a long night. The house survived.'; }),
    ],
  },
  {
    id: 'er_murmuration', cat: 'world', minAge: 4, cooldown: 8, weight: 0.3, scene: 'calm',
    title: 'Birds at dusk', text: 'Thousands of starlings are twisting together in the evening sky, like smoke with a mind of its own.',
    choices: [
      ch('Stop and watch', ['cautious'], (x) => { x.mods({ stress: -4, happiness: 3 }); return 'Ten minutes of pure wonder. Then they were gone.'; }),
      ch('Try to describe it', ['ambitious'], (x) => { x.train('poetry', 2); return 'You wrote three pages and still did not get it right.'; }),
      ch('Point it out to strangers', ['social'], (x) => { x.mods({ loneliness: -2 }); return 'A crowd of strangers stood together, silent.'; }),
    ],
  },
  {
    id: 'er_dustStorm', cat: 'world', minAge: 4, cooldown: 6, weight: (x) => (['sa', 'eg', 'ir', 'au', 'cn'].includes(x.c.countryId) || (x.c.countryId === 'us' && x.year >= 1930 && x.year <= 1940) ? 0.6 : 0), scene: 'famine',
    title: 'Dust storm', text: 'A wall of dust rolls across the land and turns day into night.',
    choices: [
      ch('Seal the windows', ['cautious'], (x) => { x.mods({ stress: 2 }); return 'Wet cloths in every gap. Dust got in anyway.'; }),
      ch('Shelter the animals', ['help'], (x) => { x.mods({ karma: 2 }); return 'The goats were grateful, in a goatish way.'; }, 'farm'),
      ch('Go out in it', ['impulsive'], (x) => { x.mods({ health: -2 }); return 'Sand in your teeth for a week. A foolish adventure.'; }),
    ],
  },
  {
    id: 'er_hailstorm', cat: 'world', minAge: 4, cooldown: 6, weight: 0.3, scene: 'storm',
    title: 'Hailstones', text: 'Hailstones the size of walnuts are hammering the roofs and shredding the gardens.',
    choices: [
      ch('Save the garden', ['help'], (x) => { x.mods({ pain: 2 }); return 'You saved the tomatoes. Your head has bumps.'; }, 'gardening'),
      ch('Collect the biggest one', ['impulsive'], (x) => { x.mods({ happiness: 2 }); return 'You kept it in the cold cellar until spring.'; }),
      ch('Wait it out', ['cautious'], () => { return 'Ten minutes of thunderous noise, then silence and a white lawn.'; }),
    ],
  },
  {
    id: 'er_doubleRainbow', cat: 'world', minAge: 4, cooldown: 10, weight: 0.3, scene: 'calm',
    title: 'Double rainbow', text: 'After a storm, a perfect double rainbow arches across the whole sky.',
    choices: [
      ch('Chase the end', ['impulsive'], (x) => { x.mods({ happiness: 3, fitness: 1 }); return 'No gold. Excellent exercise.'; }),
      ch('Call it a sign', ['cautious'], (x) => { x.mods({ faith: 2, happiness: 2 }); return 'You made an important decision that week. It worked out.'; }, 'holy'),
      ch('Share the moment', ['social'], (x) => { x.mods({ loneliness: -3 }); return 'Everyone on the street was smiling at the same thing.'; }, 'friends'),
    ],
  },
  {
    id: 'er_smog', cat: 'world', minAge: 4, years: [1850, 2300], cooldown: 6, weight: (x) => ((x.year < 1960 && ['gb', 'us', 'de'].includes(x.c.countryId)) || (x.year > 1990 && ['cn', 'in', 'mx'].includes(x.c.countryId)) ? 0.6 : 0), scene: 'plague',
    title: 'Smog', text: 'A thick, choking smog has settled on the city. You cannot see across the street.',
    choices: [
      ch('Stay indoors', ['cautious'], (x) => { x.mods({ health: 1, loneliness: 2 }); return 'Three days of indoor games and stale air.'; }),
      ch('Wear a mask and go out', ['impulsive'], (x) => { x.mods({ health: -2 }); return 'Your handkerchief turned black by noon.'; }),
      ch('Campaign for clean air', ['help'], (x) => { x.train('publicSpeaking', 2); x.mods({ karma: 3 }); return 'Petitions, letters, meetings. Slowly, the air began to change.'; }, 'parade'),
    ],
  },
  {
    id: 'er_bloodMoon', cat: 'world', minAge: 4, cooldown: 8, weight: 0.4, scene: 'eclipse',
    title: 'Blood moon', text: 'During a lunar eclipse, the full moon turns a deep coppery red.',
    choices: [
      ch('Hold a moon party', ['social'], (x) => { x.mods({ happiness: 3, loneliness: -3 }); return 'Blankets on the roof and a red moon overhead.'; }, 'stargazing'),
      ch('Read the omens', ['cautious'], (x) => { x.train('astrology', 2); x.mods({ paranormal: 2 }); return 'The signs were mixed. They usually are.'; }, 'tarot'),
      ch('Explain it to the children', ['help'], (x) => { x.train('astronomy', 2); x.mods({ empathy: 1 }); return 'Earth\'s shadow and every sunset in the world at once. They were amazed.'; }),
    ],
  },
];

export const ERAS_EVENTS: EventDef[] = [...ANCIENT, ...MEDIEVAL, ...RENAISSANCE, ...INDUSTRIAL, ...MODERN_EARLY, ...COLD_WAR, ...DIGITAL, ...SOCIAL_MEDIA, ...NEAR_FUTURE, ...COUNTRY_A, ...COUNTRY_B, ...NATURE];

export const ERAS_CHAINS: ChainDef[] = [
  { id: 'er_railMania', name: 'Railway mania', desc: 'You bought railway shares at the height of the boom.', steps: [{ delay: 3, eventId: 'er_railReckoning' }] },
];

