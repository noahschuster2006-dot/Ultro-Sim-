import type { Ctx } from '../ctx';
import { moneyOk, optOf, price, type ActionDef, type ActionOption } from './common';
import { loseItem } from '../systems/possessions';

/**
 * The Going Out app: nights out, culture, the outdoors, sport, hobbies at home,
 * trips and era specials. Every outing rolls a good / ok / bad outcome from a
 * relevant stat plus luck, so the same evening can go very differently.
 */

type Mods = Parameters<Ctx['mods']>[0];
type Line = string | ((x: Ctx) => string);
type Tier = 'good' | 'ok' | 'bad';

interface Outing {
  id: string;
  label: string | ((x: Ctx) => string);
  group: string;
  desc: string;
  scene: ActionDef['scene'];
  years?: [number, number];
  minAge?: number;
  maxAge?: number;
  /** Modern dollars; scaled by era. Children under 16 go on their parents' dime. */
  cost?: number;
  ap?: number;
  when?: (x: Ctx) => true | string | false;
  /** 0..100: how well this tends to go for you. */
  score?: (x: Ctx) => number;
  train?: [string, number][];
  mods?: Mods;
  good: Line[];
  ok: Line[];
  bad: Line[];
  goodMods?: Mods;
  badMods?: Mods;
  /** Extra effects; may return a sentence to append. */
  after?: (x: Ctx, t: Tier) => string | void;
}

const say = (x: Ctx, l: Line): string => (typeof l === 'function' ? l(x) : l);

function tierOf(x: Ctx, score: number): Tier {
  const v = Math.max(0, Math.min(100, score)) * 0.6 + x.int(0, 55);
  return v >= 64 ? 'good' : v < 30 ? 'bad' : 'ok';
}

const costOf = (x: Ctx, o: { cost?: number }): number => (o.cost && x.c.age >= 16 ? price(x, o.cost) : 0);

function outing(o: Outing): ActionDef {
  return {
    id: o.id,
    cat: 'activity',
    label: o.label,
    desc: o.desc,
    group: o.group,
    ap: o.ap ?? 1,
    scene: o.scene,
    avail: (x) => {
      if (x.c.legal.prison) return false;
      if (o.years && (x.year < o.years[0] || x.year > o.years[1])) return false;
      if (o.maxAge !== undefined && x.c.age > o.maxAge) return false;
      if (o.minAge !== undefined && x.c.age < o.minAge) return `Age ${o.minAge}+`;
      if (o.when) {
        const w = o.when(x);
        if (w !== true) return w;
      }
      const c = costOf(x, o);
      return c ? moneyOk(x, c) : true;
    },
    run: (x) => {
      const c = costOf(x, o);
      if (c && !x.spend(c)) return `You cannot afford it (${x.fmt(c)}).`;
      if (o.mods) x.mods(o.mods);
      for (const [sk, n] of o.train ?? []) x.train(sk, n);
      const t = tierOf(x, o.score ? o.score(x) : 50);
      if (t === 'good' && o.goodMods) x.mods(o.goodMods);
      if (t === 'bad' && o.badMods) x.mods(o.badMods);
      let text = say(x, x.pick(o[t]));
      const extra = o.after?.(x, t);
      if (extra) text += ' ' + extra;
      return text;
    },
  };
}

const st = (x: Ctx, ...ids: Parameters<Ctx['stat']>[0][]): number => ids.reduce((s, id) => s + x.stat(id), 0) / ids.length;
const sk = (x: Ctx, id: string, boost = 0): number => 30 + x.skill(id) * 0.7 + boost;
const owns = (x: Ctx, ...types: string[]): boolean => types.some((t) => x.hasItem(t));

// ---------------------------------------------------------------- Nightlife
const NIGHTLIFE: ActionDef[] = [
  outing({
    id: 'le_tavern', label: 'Go to the tavern', group: 'Nightlife', scene: 'bar', years: [-800, 1949], minAge: 14, cost: 15,
    desc: 'Ale, gossip and a fire. Somebody always starts singing.',
    score: (x) => st(x, 'charisma', 'happiness'), mods: { stress: -3, loneliness: -3 }, train: [['gossip', 2]],
    good: ['You won a round of dice, a round of ale and the respect of a one-eyed sailor.', 'The whole tavern sang your song by midnight. Nobody remembers the words but you.'],
    ok: ['Warm ale, cold stew, and a long story about someone\'s goat.', 'You nursed one cup all night and heard three marriages discussed in detail.'],
    bad: ['A man swore you looked at his cup wrong. You left before he finished the thought.', 'The ale was mostly water. The water was mostly not.'],
    goodMods: { happiness: 5, popularity: 2 }, badMods: { health: -2, happiness: -2 },
  }),
  outing({
    id: 'le_nightclub', label: 'Hit a nightclub', group: 'Nightlife', scene: 'party', years: [1950, 2300], minAge: 18, cost: 60,
    desc: 'Queue, bass, sweat, and a bathroom full of new best friends.',
    score: (x) => st(x, 'looks', 'confidence', 'charisma'), mods: { stress: -4, energy: -6 }, train: [['dance', 2]],
    good: ['The DJ played your song and you owned the floor like rent was due.', 'You got waved past the queue. You will be telling this story for weeks.'],
    ok: ['Loud, dark and fun. Your ears are still at the party.', 'You danced, you sweated, you lost a jacket. A fair trade.'],
    bad: ['The bouncer looked at your shoes and said "not tonight".', 'Someone spilled a sticky blue drink down your back at 11:02.'],
    goodMods: { happiness: 7, popularity: 3, loneliness: -4 }, badMods: { happiness: -3, confidence: -2 },
  }),
  outing({
    id: 'le_karaoke', label: 'Karaoke night', group: 'Nightlife', scene: 'karaoke', years: [1980, 2300], cost: 25,
    desc: 'Hold a microphone. Commit to the key change.',
    score: (x) => sk(x, 'singing', x.stat('confidence') * 0.3), train: [['singing', 3], ['vocalPerformance', 1]], mods: { stress: -4 },
    good: ['Your power ballad brought a stranger to tears and the bartender to applause.', 'You nailed the key change. People filmed it for the right reasons.'],
    ok: ['You sang a duet with a stranger and both of you forgot the second verse.', 'Respectable. Nobody cheered, nobody threw anything.'],
    bad: ['You chose a song with a three-minute rap section. You did not know the rap section.', 'Your voice cracked like a teenage boy on the big note.'],
    goodMods: { happiness: 6, confidence: 3, popularity: 2 }, badMods: { confidence: -3, happiness: 1 },
  }),
  outing({
    id: 'le_barCrawl', label: 'Bar crawl', group: 'Nightlife', scene: 'bar', years: [1850, 2300], minAge: 18, cost: 80,
    desc: 'Five bars, one night, questionable navigation.',
    score: (x) => st(x, 'health', 'charisma') - x.stat('aggression') * 0.2, mods: { health: -2, stress: -5, energy: -8 },
    good: ['Bar four had a piano and bar five had your new best friends.', 'You crawled, you conquered, you got a free kebab out of it.'],
    ok: ['You made it to bar three before your feet filed a complaint.', 'A blurry, cheerful night. Your wallet is less cheerful.'],
    bad: ['You woke up holding a traffic cone and a strong sense of regret.', 'You lost your friends at bar two and your dignity at bar three.'],
    goodMods: { happiness: 6, loneliness: -5 }, badMods: { health: -3, happiness: -3 },
  }),
  outing({
    id: 'le_wine', label: 'Wine tasting', group: 'Nightlife', scene: 'bar', minAge: 18, cost: 70,
    desc: 'Swirl, sniff, pretend to taste blackcurrant.',
    score: (x) => st(x, 'smarts', 'wisdom'), train: [['viticulture', 2], ['etiquette', 1]], mods: { stress: -4 },
    good: ['You said "notes of leather" and the sommelier nodded at you with respect.', 'You found a bottle you actually love, and it was cheap.'],
    ok: ['They all tasted like wine, but the cheese was excellent.', 'You learned that "spitting" is classy here. You did not spit.'],
    bad: ['You drank the spittoon. Do not ask how.', 'You called a vintage "juicy" and the room went quiet.'],
    goodMods: { happiness: 4, wisdom: 1 }, badMods: { publicImage: -1 },
  }),
  outing({
    id: 'le_jazzClub', label: 'Jazz club', group: 'Nightlife', scene: 'concert', years: [1920, 1975], minAge: 16, cost: 30,
    desc: 'A smoky basement, a trumpet and a lot of nodding.',
    score: (x) => st(x, 'creativity', 'charisma'), mods: { stress: -5 }, train: [['music', 1]],
    good: ['The trumpeter played a solo that rearranged your soul.', 'You were invited to sit in on tambourine. You were magnificent.'],
    ok: ['Cool cats, warm drinks. You snapped on the right beats mostly.', 'Smoky, mellow and very late.'],
    bad: ['The band played a twenty-minute solo on a single note. Art, apparently.', 'A police raid ended the night just as the drummer got going.'],
    goodMods: { happiness: 5, creativity: 2 },
  }),
  outing({
    id: 'le_rave', label: 'Go to a rave', group: 'Nightlife', scene: 'party', years: [1988, 2300], minAge: 18, cost: 40,
    desc: 'A warehouse, a map drawn on a flyer and a sunrise.',
    score: (x) => st(x, 'energy', 'riskTolerance'), mods: { energy: -12, stress: -6 },
    good: ['You danced until the sunrise came through the roof and hugged a hundred strangers.', 'The bass dropped and so did all your worries.'],
    ok: ['Lasers, smoke, a long walk home. Pretty good.', 'You lost your hearing and found your rhythm.'],
    bad: ['The rave was raided before you got past the car park.', 'You spent four hours looking for your friend and one hour dancing.'],
    goodMods: { happiness: 7, loneliness: -5 }, badMods: { happiness: -2, anxiety: 2 },
  }),
  outing({
    id: 'le_comedy', label: 'Comedy club', group: 'Nightlife', scene: 'stage', years: [1950, 2300], minAge: 16, cost: 25,
    desc: 'Two-drink minimum. Do not sit in the front row.',
    score: (x) => sk(x, 'humor', x.stat('confidence') * 0.2), train: [['humor', 2]], mods: { stress: -5 },
    good: ['You laughed so hard you snorted, and the comedian made it the best bit of the night.', 'The headliner was brilliant and you stole three jokes for work.'],
    ok: ['A few big laughs, a few tumbleweeds.', 'One comic was great, one was doing therapy out loud.'],
    bad: ['You sat in the front row. You became the act.', 'The comic asked what you do for a living. It went badly.'],
    goodMods: { happiness: 6 }, badMods: { confidence: -2 },
  }),
  outing({
    id: 'le_pubQuiz', label: 'Pub quiz', group: 'Nightlife', scene: 'bar', years: [1970, 2300], minAge: 16, cost: 10,
    desc: 'Team name: something punny. Prize: a meat raffle.',
    score: (x) => x.stat('smarts'), train: [['history', 1]], mods: { loneliness: -3 },
    good: (['Your team won by one point thanks to your weird knowledge of capital cities.', 'You knew the answer about medieval cheese. Champions!']),
    ok: ['Fourth place out of nine. Respectable.', 'You knew everything except the music round. Nobody knows the music round.'],
    bad: ['Last place, and the team name "Quiz Khalifa" did not help.', 'You argued with the quizmaster about the answer and were wrong.'],
    goodMods: { happiness: 5, confidence: 2 },
    after: (x, t) => {
      if (t !== 'good') return;
      const n = price(x, 40);
      x.money(n);
      return `The bar tab of ${x.fmt(n)} is yours.`;
    },
  }),
];

// ---------------------------------------------------------------- Culture
const CULTURE: ActionDef[] = [
  outing({
    id: 'le_cinema', label: (x) => (x.year < 1928 ? 'See a picture show' : 'Go to the cinema'), group: 'Culture', scene: 'cinema', years: [1905, 2300], cost: 15,
    desc: 'Popcorn, darkness and somebody else\'s problems for two hours.',
    score: (x) => x.stat('happiness'), mods: { stress: -4 },
    good: ['The film was so good you sat through the credits in silence.', 'You cried, you laughed, you bought the soundtrack.'],
    ok: ['Decent film. Better popcorn.', 'The plot fell apart, but the explosions were very sincere.'],
    bad: ['The person behind you narrated the whole film.', 'Two and a half hours of a man looking sad at the sea.'],
    goodMods: { happiness: 5, creativity: 1 },
  }),
  outing({
    id: 'le_driveIn', label: 'Drive-in movie', group: 'Culture', scene: 'cinema', years: [1933, 1995], minAge: 10, cost: 15,
    desc: 'A film under the stars with a crackling car speaker.',
    when: (x) => (owns(x, 'usedCar', 'familyCar', 'sportsCar', 'luxuryCar', 'electricCar') || x.c.age < 16 ? true : 'Needs a car'),
    score: (x) => x.stat('happiness'), mods: { stress: -4, loneliness: -2 },
    good: ['A warm night, a fizzy drink and the best monster movie ever made.', 'The stars and the screen were both showing.'],
    ok: ['The speaker crackled through the love scene. Fair enough.', 'You watched half the film and half the clouds.'],
    bad: ['Your battery died in the third act.', 'Rain. All of it. Windscreen wipers did their best.'],
    goodMods: { happiness: 5 },
  }),
  outing({
    id: 'le_theatre', label: 'See a play', group: 'Culture', scene: 'theater', years: [-600, 2300], cost: 40,
    desc: (`Tragedy, comedy, or a musical about a historical accountant.`),
    score: (x) => st(x, 'smarts', 'empathy'), train: [['acting', 1]], mods: { stress: -3, wisdom: 1 },
    good: [(x) => (x.year < 0 ? 'The chorus wailed, the masks gleamed and you wept for a king you had never met.' : 'A standing ovation. You were standing first.'), 'The lead actor made eye contact during the big speech. You will never recover.'],
    ok: ['The second act dragged, but the costumes were glorious.', 'You understood about two thirds of it. Enough to nod.'],
    bad: ['You dozed off and snored during the death scene.', 'The understudy forgot every line and improvised a new ending.'],
    goodMods: { happiness: 5, empathy: 2, creativity: 1 },
  }),
  outing({
    id: 'le_opera', label: 'Night at the opera', group: 'Culture', scene: 'theater', years: [1600, 2300], minAge: 12, cost: 120,
    desc: 'Four hours, one tragic soprano, zero spoilers.',
    score: (x) => st(x, 'smarts', 'creativity'), mods: { stress: -3 }, train: [['etiquette', 2], ['music', 1]],
    after: (x) => { x.mod('publicImage', 1); },
    good: ['The soprano hit a note that rattled your bones and your opinions.', 'You did not understand a word of Italian and still sobbed in the third act.'],
    ok: ['Everyone died, as is traditional. Lovely sets.', 'You clapped at the wrong time once. Only once.'],
    bad: ['Your opera glasses fogged up and so did your patience.', 'Four hours. Five, counting the interval queue for the toilets.'],
    goodMods: { happiness: 5, wisdom: 2 },
  }),
  outing({
    id: 'le_concert', label: (x) => (x.year < 1900 ? 'Attend a recital' : 'Go to a concert'), group: 'Culture', scene: 'concert', cost: 70,
    desc: 'Live music: the closest thing to magic you can buy a ticket for.',
    score: (x) => st(x, 'happiness', 'energy'), mods: { stress: -5 }, train: [['music', 1]],
    good: [(x) => (x.year < 1900 ? 'The quartet played so beautifully that a duke wept into his wig.' : 'The band played your favourite song as the encore and the crowd lost its mind.'), 'You caught a guitar pick and kept it like a holy relic.'],
    ok: ['Good set, bad sound mix, great memories.', 'You saw most of it between two very tall heads.'],
    bad: ['The headliner cancelled. The support act was a man with a kazoo.', 'Your seat was behind a pillar. You saw the pillar perform.'],
    goodMods: { happiness: 7, loneliness: -3 },
  }),
  outing({
    id: 'le_festival', label: 'Music festival', group: 'Culture', scene: 'concert', years: [1969, 2300], minAge: 14, cost: 250, ap: 1,
    desc: 'Three days of mud, music and portable toilets.',
    score: (x) => st(x, 'energy', 'health', 'charisma'), mods: { stress: -6, energy: -10 },
    good: ['Sunset, your favourite band and a field full of strangers singing along.', 'You made five friends, lost one boot and found yourself.'],
    ok: ['Muddy and wonderful. You will smell like a field until Tuesday.', 'Great music, terrible tent placement.'],
    bad: ['It rained for three days. You saw one band through a poncho.', 'Your tent was pitched next to a man with a didgeridoo and no sleep schedule.'],
    goodMods: { happiness: 8, loneliness: -6 }, badMods: { health: -2 },
  }),
  outing({
    id: 'le_museum', label: 'Visit a museum', group: 'Culture', scene: 'museum', years: [1683, 2300], cost: 15,
    desc: 'Old things in glass boxes, and a gift shop.',
    score: (x) => x.stat('smarts'), train: [['history', 3], ['art', 1]], mods: { stress: -2, wisdom: 1 },
    good: ['You stood in front of one painting for an hour and left a slightly different person.', 'The dinosaur hall made you feel tiny in a good way.'],
    ok: ['Lots of pots. Some of them very old pots.', 'You read every placard in room one and none in room nine.'],
    bad: ['You set off an alarm by leaning too close to a vase.', 'A school trip of forty children followed you room by room.'],
    goodMods: { smarts: 2, happiness: 3 },
  }),
  outing({
    id: 'le_gallery', label: 'Gallery opening', group: 'Culture', scene: 'museum', years: [1850, 2300], minAge: 16, cost: 0,
    desc: 'Free wine, small cheese, big opinions.',
    score: (x) => st(x, 'charisma', 'creativity'), train: [['art', 2], ['networking', 2]],
    good: ['You said something clever about negative space and an artist hugged you.', 'Free wine, a famous painter and a business card you will actually use.'],
    ok: ['You stared at a red square and pretended it moved you. It kind of did.', 'Nice wine. Odd art. Excellent people-watching.'],
    bad: ['You mistook a fire extinguisher for an installation and praised it loudly.', 'You leaned on a sculpture. It was the sculpture.'],
    goodMods: { happiness: 4, popularity: 2 }, badMods: { publicImage: -1 },
  }),
  outing({
    id: 'le_zoo', label: (x) => (x.year < 1850 ? 'Visit the menagerie' : 'Go to the zoo'), group: 'Culture', scene: 'zoo', years: [1800, 2300], cost: 25,
    desc: 'Lions, penguins, and a gift shop of plush lions and penguins.',
    score: (x) => x.stat('happiness'), mods: { stress: -3, happiness: 2 }, train: [['biology', 1]],
    good: ['A baby elephant sprayed you with water and you have never felt more chosen.', 'The penguins were fed while you watched. Pure chaos, pure joy.'],
    ok: ['The lions slept, the monkeys were rude, the ice cream was great.', 'You saw a giraffe eat a whole tree. Respect.'],
    bad: ['A goat at the petting zoo ate your ticket and your sleeve.', 'Every animal was hiding. You saw some excellent rocks.'],
    goodMods: { happiness: 4 },
  }),
  outing({
    id: 'le_aquarium', label: 'Visit the aquarium', group: 'Culture', scene: 'zoo', years: [1853, 2300], cost: 25,
    desc: 'Blue light, jellyfish and a shark that knows what it did.',
    score: (x) => x.stat('happiness'), mods: { stress: -5, anxiety: -2 }, train: [['biology', 1]],
    good: ['You watched the jellyfish for twenty minutes and your shoulders finally dropped.', 'A manta ray swam over your head like a living cathedral.'],
    ok: ['Lots of fish. Some of them looked at you.', 'You learned an octopus can open jars. Feeling competitive.'],
    bad: ['The octopus tank was empty. Rumour says he escaped.', 'A child tapped on every glass while chanting "Nemo".'],
    goodMods: { happiness: 4 },
  }),
  outing({
    id: 'le_planetarium', label: 'Planetarium show', group: 'Culture', scene: 'stargazing', years: [1923, 2300], cost: 15,
    desc: 'Lie back. The universe is projected for you.',
    score: (x) => x.stat('smarts'), mods: { stress: -3, wisdom: 1 }, train: [['astronomy', 3]],
    good: ['The dome went dark and the Milky Way appeared. You forgot your rent for an hour.', 'You learned how many stars there are and decided your problems are small.'],
    ok: ['Lovely show, but the reclining seats made you very sleepy.', 'You now know where Orion\'s belt is. Again.'],
    bad: ['You fell asleep at the Big Bang and woke at the heat death of the universe.', 'The projector broke and the universe was replaced by a screensaver.'],
    goodMods: { happiness: 3, smarts: 1 },
  }),
  outing({
    id: 'le_lecture', label: 'Attend a public lecture', group: 'Culture', scene: 'classroom', years: [-500, 2300], minAge: 12, cost: 5,
    desc: (`A learned person talks; you nod thoughtfully.`),
    score: (x) => st(x, 'smarts', 'discipline'), mods: { wisdom: 1 }, train: [['philosophy', 2], ['science', 1]],
    good: [(x) => (x.year < 400 ? 'The philosopher answered your question and the whole agora turned to look at you.' : 'You asked a question so good the speaker said "great question" and meant it.'), 'You filled four pages with notes and one with ideas of your own.'],
    ok: ['Interesting, if long. You remember the jokes.', 'The slides were better than the speaker.'],
    bad: ['Two hours on the history of the comma.', 'You asked a question that was really a speech. Everybody noticed.'],
    goodMods: { smarts: 2, wisdom: 1 },
  }),
  outing({
    id: 'le_poetry', label: (x) => (x.year < 1900 ? 'Literary salon' : 'Poetry night'), group: 'Culture', scene: 'reading', years: [1650, 2300], minAge: 14, cost: 5,
    desc: 'Read a verse aloud, or snap politely at others.',
    score: (x) => sk(x, 'poetry', x.stat('creativity') * 0.2), train: [['poetry', 3], ['publicSpeaking', 1]],
    good: ['You read your poem and the room went silent in the good way.', 'A stranger asked for a copy of your verse. You framed the moment.'],
    ok: ['You heard eleven poems about the sea. One was great.', 'Polite snapping. Your stanza landed somewhere in the middle.'],
    bad: ['You rhymed "heart" with "fart" and it was not intentional.', 'Your hands shook so hard the paper sounded like applause.'],
    goodMods: { creativity: 3, confidence: 3 }, badMods: { confidence: -2 },
  }),
  outing({
    id: 'le_comicCon', label: 'Fan convention', group: 'Culture', scene: 'festival', years: [1970, 2300], minAge: 10, cost: 90,
    desc: 'Costumes, queues and people who love things loudly.',
    score: (x) => st(x, 'creativity', 'happiness'), mods: { loneliness: -4, stress: -3 },
    good: ['Your costume won a prize and fourteen photos with strangers.', 'You met the actor who voiced your childhood. They said your name back.'],
    ok: ['Long queues, short autographs, great people.', 'You bought a sword you have nowhere to hang.'],
    bad: ['Someone else wore the same costume, but better.', 'You queued four hours for an autograph and the pen ran dry.'],
    goodMods: { happiness: 6, popularity: 1 },
  }),
  outing({
    id: 'le_library', label: 'Spend a day at the library', group: 'Culture', scene: 'library', years: [-300, 2300], cost: 0,
    desc: 'Free knowledge, aggressive shushing.',
    score: (x) => st(x, 'smarts', 'discipline'), mods: { stress: -2 }, train: [['literacy', 2], ['history', 1]],
    good: ['You found a book that answered a question you did not know you had.', 'Quiet hours, a pile of books and a brand-new obsession.'],
    ok: ['You read, you napped behind a shelf, you read some more.', 'The librarian nodded at you. It felt like an award.'],
    bad: ['You were shushed for turning pages too loudly.', 'The only copy you wanted was out until next year.'],
    goodMods: { smarts: 2, wisdom: 1 },
  }),
];


// ---------------------------------------------------------------- Outdoors
const OUTDOORS: ActionDef[] = [
  outing({
    id: 'le_hike', label: 'Go hiking', group: 'Outdoors', scene: 'hiking', minAge: 6,
    desc: 'A trail, a view and legs that file a complaint tomorrow.',
    score: (x) => st(x, 'fitness', 'health'), mods: { fitness: 2, stress: -5, depression: -2 }, train: [['climbing', 1], ['running', 1]],
    good: ['You reached the summit just as the clouds parted. Worth every blister.', 'A deer crossed the path, looked at you, and approved.'],
    ok: ['Nice views, sore calves, one very good sandwich.', 'You took the long trail by accident. You are fitter now, technically.'],
    bad: ['You got lost for three hours and found the car park by smell.', 'It rained the moment you were furthest from shelter.'],
    goodMods: { happiness: 5, health: 1 }, badMods: { health: -2, happiness: -2 },
  }),
  outing({
    id: 'le_camp', label: 'Go camping', group: 'Outdoors', scene: 'camping', minAge: 6, cost: 40,
    desc: 'Sleep on the ground on purpose.',
    score: (x) => st(x, 'fitness', 'resilience'), mods: { stress: -6, loneliness: -2 }, train: [['fishing', 1]],
    good: ['Perfect marshmallows, a crackling fire and a sky full of stars.', 'You heard an owl at 3am and felt part of something old.'],
    ok: ['A root found your spine all night, but the sunrise was lovely.', 'Burnt sausages, good stories.'],
    bad: ['A raccoon stole your food and looked proud of it.', 'Your tent was not, as advertised, waterproof.'],
    goodMods: { happiness: 6, depression: -3 }, badMods: { health: -1, happiness: -2 },
  }),
  outing({
    id: 'le_fish', label: 'Go fishing', group: 'Outdoors', scene: 'fishing', minAge: 5,
    desc: 'Patience with a hook on the end.',
    score: (x) => sk(x, 'fishing', x.stat('discipline') * 0.2), mods: { stress: -6, anxiety: -2 }, train: [['fishing', 3]],
    good: ['You landed a fish so big you had to describe it with your whole arms.', 'Three bites, three catches. Dinner sorted, ego inflated.'],
    ok: ['You caught one small fish and let it go with a stern warning.', 'No fish, but the quiet did you a world of good.'],
    bad: ['You caught a boot, then your own sleeve.', 'You fell in. The fish watched.'],
    goodMods: { happiness: 5 },
    after: (x, t) => {
      if (t !== 'good' || x.c.age < 14) return;
      const n = price(x, 30);
      x.money(n);
      return `You sold the extra catch for ${x.fmt(n)}.`;
    },
  }),
  outing({
    id: 'le_beach', label: 'Day at the beach', group: 'Outdoors', scene: 'beach', years: [1750, 2300], cost: 10,
    desc: 'Sun, sand, and sand in places sand should not be.',
    score: (x) => st(x, 'happiness', 'looks'), mods: { stress: -6, happiness: 3 },
    good: ['Warm water, cold drinks and a nap in perfect shade.', 'You built a sandcastle that drew a small crowd.'],
    ok: ['Nice day. You will be finding sand until spring.', 'A seagull stole a chip. You let it go.'],
    bad: ['You fell asleep and woke up the colour of a lobster.', 'Jellyfish. One. That was enough.'],
    goodMods: { happiness: 4, looks: 1 }, badMods: { health: -2, looks: -1 },
  }),
  outing({
    id: 'le_seaBathe', label: 'Sea bathing', group: 'Outdoors', scene: 'beach', years: [-800, 1749],
    desc: 'A brisk dip the physicians swear by.',
    score: (x) => st(x, 'health', 'fitness'), mods: { stress: -4 }, train: [['swimming', 2]],
    good: ['The cold water slapped the gloom right out of you.', 'You floated on your back and watched the gulls like a philosopher.'],
    ok: ['Bracing. Very bracing. Mostly bracing.', 'You splashed about in your undergarments. Very healthful.'],
    bad: ['A wave knocked you over and took your dignity out to sea.', 'You caught a chill and a lecture from your mother.'],
    goodMods: { health: 2, happiness: 3 }, badMods: { health: -2 },
  }),
  outing({
    id: 'le_ski', label: 'Go skiing', group: 'Outdoors', scene: 'skiing', years: [1880, 2300], minAge: 5, cost: 200,
    desc: 'Glide down a mountain, ideally upright.',
    score: (x) => sk(x, 'skiing', x.stat('fitness') * 0.3), mods: { stress: -4, fitness: 2 }, train: [['skiing', 4]],
    good: ['You carved down the black run like a postcard come to life.', 'Fresh powder, blue sky, hot chocolate. Perfect.'],
    ok: ['You fell eleven times and laughed nine of them.', 'The nursery slope and you have reached an understanding.'],
    bad: ['You took out a ski instructor and a small child. Everyone is fine. Mostly.', 'You spent the day in the lodge with a twisted knee and a mug.'],
    goodMods: { happiness: 7 }, badMods: { health: -5, pain: 4 },
  }),
  outing({
    id: 'le_skate', label: 'Ice skating', group: 'Outdoors', scene: 'skiing', minAge: 4, cost: 10,
    desc: 'A frozen pond or a rink, and a lot of flailing.',
    score: (x) => st(x, 'fitness', 'dexterity'), mods: { stress: -3 }, train: [['dance', 1]],
    good: ['You did a spin. On purpose. People clapped.', 'Gliding under lights with music playing. Magic.'],
    ok: ['You clung to the wall for two laps, then let go. Growth.', 'Cold, wobbly, fun.'],
    bad: ['You found the hardest part of the ice with your tailbone.', 'A ten-year-old lapped you four times.'],
    goodMods: { happiness: 5 }, badMods: { pain: 4, health: -1 },
  }),
  outing({
    id: 'le_sled', label: 'Sledding', group: 'Outdoors', scene: 'skiing', maxAge: 15,
    desc: 'The steepest hill in town, a tray and no fear.',
    score: (x) => x.stat('riskTolerance') + 20, mods: { happiness: 4, stress: -3 },
    good: ['Fastest run of the day. Your cheeks will never be warm again.', 'You and your friends built a jump. It was glorious.'],
    ok: ['Snow down the back of your coat, but worth it.', 'Up the hill, down the hill, up the hill. Perfect day.'],
    bad: ['You hit a tree, gently. The tree won.', 'Your sled went home without you.'],
    goodMods: { happiness: 4, loneliness: -3 }, badMods: { pain: 3 },
  }),
  outing({
    id: 'le_picnic', label: 'Picnic in the park', group: 'Outdoors', scene: 'picnic', cost: 15,
    desc: 'Sandwiches on a blanket, ants on the sandwiches.',
    score: (x) => x.stat('happiness'), mods: { stress: -4, loneliness: -2 },
    good: ['Sunshine, strawberries and a nap under a tree. Bliss.', 'A dog joined your picnic and you have no regrets.'],
    ok: ['Ants. Many ants. Lovely day otherwise.', 'The sandwiches were warm, the drinks were warm, you were warm.'],
    bad: ['It rained the second you unpacked the cake.', 'A wasp claimed the jam. You surrendered the jam.'],
    goodMods: { happiness: 4 },
  }),
  outing({
    id: 'le_stargaze', label: 'Stargazing', group: 'Outdoors', scene: 'stargazing', minAge: 5,
    desc: 'Lie on a hill and look up.',
    score: (x) => sk(x, 'astronomy', owns(x, 'telescope') ? 25 : 0), mods: { stress: -5, wisdom: 1 }, train: [['astronomy', 2]],
    good: [(x) => (owns(x, 'telescope') ? 'Through your telescope you saw the rings of Saturn and said "oh" out loud.' : 'A shooting star crossed the whole sky. You made a wish and kept it secret.'), 'You found every constellation your grandmother taught you.'],
    ok: ['Clouds came and went. The moon was gorgeous anyway.', 'You saw a satellite and called it a shooting star. Close enough.'],
    bad: ['Cloudy. All night. You looked at the inside of a cloud.', 'Mosquitoes found you before the stars did.'],
    goodMods: { happiness: 5, depression: -2 },
  }),
  outing({
    id: 'le_birdwatch', label: 'Bird-watching', group: 'Outdoors', scene: 'hiking', minAge: 6,
    desc: 'Binoculars, a notebook and a lot of standing still.',
    score: (x) => st(x, 'discipline', 'wisdom'), mods: { stress: -5, anxiety: -2 }, train: [['biology', 1]],
    good: ['You spotted a rare heron and your heart nearly gave out.', 'A robin landed on your boot. You did not breathe for a minute.'],
    ok: ['Pigeons, mostly. Some very handsome pigeons.', 'You heard a bird you could not see. It is still mocking you.'],
    bad: ['A gull stole your lunch and your will to bird.', 'You stood in a bog for three hours to see one sparrow.'],
    goodMods: { happiness: 4 },
  }),
  outing({
    id: 'le_climb', label: (x) => (x.year < 1990 ? 'Rock climbing' : 'Climbing wall'), group: 'Outdoors', scene: 'hiking', years: [1850, 2300], minAge: 8, cost: 25,
    desc: 'Up is the only direction that matters.',
    score: (x) => sk(x, 'climbing', x.stat('fitness') * 0.3), mods: { fitness: 2, stress: -3 }, train: [['climbing', 4]],
    good: ['You topped out on a route you had failed for weeks. Fist in the air.', 'Your fingers found every hold like they had a map.'],
    ok: ['Halfway up, then a dignified descent.', 'Your forearms now have opinions about gravity.'],
    bad: ['You froze two metres up and asked to be lowered like a cat from a tree.', 'You slipped and the rope caught you. Your pride did not survive.'],
    goodMods: { confidence: 3, happiness: 4 }, badMods: { pain: 2, confidence: -1 },
  }),
  outing({
    id: 'le_surf', label: 'Go surfing', group: 'Outdoors', scene: 'beach', years: [1950, 2300], minAge: 10, cost: 40,
    desc: 'Paddle, wait, stand, fall. Repeat.',
    score: (x) => st(x, 'fitness', 'dexterity'), mods: { fitness: 2, stress: -5 }, train: [['swimming', 2]],
    good: ['You caught a long, clean wave and rode it all the way in.', 'Locals nodded at you. Locals never nod.'],
    ok: ['You stood up twice. For a full second each.', 'Mostly paddling, a little standing, a lot of salt water.'],
    bad: ['Your board hit you in the face. Twice.', 'A wave folded you like laundry.'],
    goodMods: { happiness: 6, confidence: 2 }, badMods: { pain: 3 },
  }),
  outing({
    id: 'le_scuba', label: 'Scuba diving', group: 'Outdoors', scene: 'beach', years: [1950, 2300], minAge: 12, cost: 150,
    desc: 'Breathe underwater with fish judging you.',
    score: (x) => sk(x, 'diving', x.stat('fitness') * 0.2), mods: { stress: -5 }, train: [['diving', 4]],
    good: ['A turtle swam beside you for a whole minute like an old friend.', 'Coral, colour and silence. Another planet.'],
    ok: ['Murky water but you saw a crab with attitude.', 'Your mask leaked. The fish were nice though.'],
    bad: ['You surfaced too fast and spent the evening with a headache and a lecture.', 'You panicked at ten metres and found out you can scream into a regulator.'],
    goodMods: { happiness: 7 }, badMods: { anxiety: 3 },
  }),
  outing({
    id: 'le_sail', label: 'Go sailing', group: 'Outdoors', scene: 'luxury', minAge: 10, cost: 80,
    desc: 'Wind, water and shouting about ropes.',
    when: (x) => (owns(x, 'sailboat', 'yacht') || x.c.age >= 16 ? true : 'Needs a boat or an adult'),
    score: (x) => sk(x, 'sailing'), mods: { stress: -5 }, train: [['sailing', 4]],
    good: ['Perfect wind. You flew across the bay with spray in your face.', 'Dolphins followed the boat. You will never shut up about it.'],
    ok: ['You learned the names of five ropes. Each one is a "sheet". Why.', 'Gentle sailing, mild seasickness.'],
    bad: ['The boom swung round and introduced itself to your head.', 'The wind died. You paddled home with a bucket.'],
    goodMods: { happiness: 6 }, badMods: { pain: 2 },
  }),
  outing({
    id: 'le_balloon', label: 'Hot-air balloon ride', group: 'Outdoors', scene: 'travel', years: [1783, 2300], minAge: 10, cost: 300,
    desc: 'Float over the world in a picnic basket.',
    score: (x) => 60 - x.stat('anxiety') * 0.3, mods: { stress: -4 },
    good: ['At sunrise the whole valley glowed below you. You forgot to take a picture.', 'The silence up there was the loudest thing you ever heard.'],
    ok: ['Lovely view, chilly ears, bumpy landing.', 'You landed in a farmer\'s field. He offered tea.'],
    bad: ['You landed in a cow pasture. The cows had questions.', 'You spent the whole flight crouched in the basket.'],
    goodMods: { happiness: 7 }, badMods: { anxiety: 3 },
  }),
];

// ---------------------------------------------------------------- Sport
const SPORT: ActionDef[] = [
  outing({
    id: 'le_gym', label: 'Hit the gym', group: 'Sport', scene: 'gym', years: [1950, 2300], minAge: 13, cost: 20,
    desc: 'Lift heavy things, put them back down.',
    score: (x) => sk(x, 'strengthTraining', x.stat('discipline') * 0.2), mods: { fitness: 3, stress: -3, health: 1 }, train: [['strengthTraining', 3]],
    good: ['New personal best. You made a noise you are not proud of.', 'You caught yourself in the mirror and, honestly, nice.'],
    ok: ['Solid session. Mostly the leg press and your phone.', 'You did the warm-up, the workout and a lot of drinking from the fountain.'],
    bad: ['You pulled something you cannot name.', 'Every machine was taken by a man doing curls in the squat rack.'],
    goodMods: { looks: 1, confidence: 2 }, badMods: { pain: 4 },
  }),
  outing({
    id: 'le_gymnasium', label: 'Train at the gymnasium', group: 'Sport', scene: 'sports', years: [-800, 500], minAge: 12,
    desc: 'Wrestling, running and discus under the olive trees.',
    score: (x) => sk(x, 'wrestling', x.stat('fitness') * 0.3), mods: { fitness: 3, stress: -3 }, train: [['wrestling', 3], ['running', 2]],
    good: ['You threw a champion in the sand and the old men nodded.', 'Your discus flew so far a philosopher stopped mid-sentence.'],
    ok: ['Oil, sand, sweat. A respectable day.', 'You ran laps while a man lectured on virtue. Both did you good.'],
    bad: ['A wrestler three times your size used you to make a point.', 'You dropped the discus on your own foot.'],
    goodMods: { confidence: 3, popularity: 1 }, badMods: { pain: 4 },
  }),
  outing({
    id: 'le_yoga', label: 'Yoga class', group: 'Sport', scene: 'yoga', years: [1950, 2300], minAge: 10, cost: 15,
    desc: 'Breathe in, bend, try not to fall on the person next to you.',
    score: (x) => sk(x, 'yoga', x.stat('discipline') * 0.2), mods: { stress: -6, anxiety: -3, fitness: 1 }, train: [['yoga', 3], ['meditation', 1]],
    good: ['You held a pose you thought was a myth. The teacher said "beautiful".', 'In final rest you felt your whole body exhale.'],
    ok: ['You are flexible like a door. But a calmer door.', 'The breathing helped. The pose called "pigeon" did not.'],
    bad: ['You fell out of tree pose and into a stranger.', 'You fell asleep in final rest and snored.'],
    goodMods: { happiness: 4, depression: -2 },
  }),
  outing({
    id: 'le_swim', label: 'Go swimming', group: 'Sport', scene: 'beach', minAge: 4, cost: 8,
    desc: 'Laps, or floating like a starfish. Your call.',
    score: (x) => sk(x, 'swimming', x.stat('fitness') * 0.2), mods: { fitness: 2, stress: -4, health: 1 }, train: [['swimming', 3]],
    good: ['You swam forty lengths and felt like a dolphin with a mortgage.', 'You finally nailed the tumble turn.'],
    ok: ['Ten lengths, one cramp, decent shower.', 'You floated a lot. Floating counts.'],
    bad: ['You swallowed half the pool.', 'A child did a cannonball right on your head.'],
    goodMods: { happiness: 4 },
  }),
  outing({
    id: 'le_teamSport', label: (x) => (x.year < 1860 ? 'Join a village ball game' : 'Play a team sport'), group: 'Sport', scene: 'sports', minAge: 6,
    desc: 'Kick, throw or hit something with your mates.',
    score: (x) => sk(x, 'ballSports', x.stat('fitness') * 0.3), mods: { fitness: 3, loneliness: -4, stress: -3 }, train: [['ballSports', 3], ['teamwork', 2]],
    good: ['You scored the winner and were carried off the field.', 'Perfect pass, perfect goal, perfect pint after.'],
    ok: ['Lost narrowly, played well, very muddy.', 'You touched the ball four times. Two were good.'],
    bad: [(x) => (x.year < 1860 ? 'Two villages, one pig bladder and a broken nose. Yours.' : 'You scored an own goal. Your teammates are still pretending it was fine.'), 'You twisted an ankle in the first five minutes.'],
    goodMods: { happiness: 6, popularity: 3, confidence: 2 }, badMods: { pain: 4, health: -1 },
  }),
  outing({
    id: 'le_run', label: 'Go for a run', group: 'Sport', scene: 'sports', minAge: 8,
    desc: 'Free, healthy and miserable for the first ten minutes.',
    score: (x) => sk(x, 'running', x.stat('fitness') * 0.3), mods: { fitness: 3, stress: -4, health: 1, depression: -1 }, train: [['running', 3]],
    good: ['Runner\'s high hit at mile three. You felt immortal.', 'New personal best. You told everyone.'],
    ok: ['You ran, you walked, you ran again.', 'A steady run, a red face and a smug afternoon.'],
    bad: ['A stitch the size of a fist. You walked home.', 'A dog chased you. Fastest mile ever, zero joy.'],
    goodMods: { happiness: 4 }, badMods: { pain: 2 },
  }),
  outing({
    id: 'le_marathon', label: 'Run a marathon', group: 'Sport', scene: 'sports', years: [1896, 2300], minAge: 16, cost: 80, ap: 2,
    desc: '26.2 miles. On purpose.',
    when: (x) => (x.stat('fitness') >= 45 ? true : 'Not fit enough yet'),
    score: (x) => sk(x, 'marathon', x.stat('fitness') * 0.4), mods: { fitness: 3, energy: -15 }, train: [['marathon', 6], ['running', 3]],
    good: ['You crossed the line with your arms in the air and tears on your face.', 'You beat your target time and a man dressed as a rhino.'],
    ok: ['You finished. Your legs have filed for divorce.', 'You walked the last four miles, but you finished.'],
    bad: ['You hit the wall at mile 20, and the wall hit back.', 'A man in a giant banana costume overtook you at mile 25.'],
    goodMods: { happiness: 10, confidence: 6, willpower: 3 }, badMods: { pain: 8, health: -3 },
    after: (x, t) => { if (t !== 'bad' && !x.hasMemory('le_marathon')) x.remember('le_marathon', `Finished a marathon at ${x.c.age}.`, 35); },
  }),
  outing({
    id: 'le_tennis', label: 'Play tennis', group: 'Sport', scene: 'sports', years: [1875, 2300], minAge: 8, cost: 15,
    desc: 'Love means nothing. Neither does your backhand.',
    score: (x) => sk(x, 'tennis', x.stat('fitness') * 0.2), mods: { fitness: 2, stress: -3 }, train: [['tennis', 3]],
    good: ['You served an ace and acted like you meant it.', 'Straight sets. You were gracious, mostly.'],
    ok: ['Long rallies, short tempers, good fun.', 'You lost, but your forehand made a guest appearance.'],
    bad: ['You served into your own partner\'s back.', 'You lost to a seventy-year-old in a sun visor.'],
    goodMods: { happiness: 5, confidence: 2 },
  }),
  outing({
    id: 'le_golf', label: 'Play golf', group: 'Sport', scene: 'sports', years: [1750, 2300], minAge: 10, cost: 60,
    desc: 'A good walk, spoiled.',
    score: (x) => st(x, 'discipline', 'dexterity'), mods: { stress: -2 }, train: [['networking', 2]],
    good: ['A hole in one. The bar tab is your problem now.', 'You closed a deal on the 9th hole and a birdie on the 10th.'],
    ok: ['You lost six balls and found four other people\'s.', 'Pleasant walk. Some golf happened.'],
    bad: ['You hit a duck. The duck is fine. You are not.', 'Your club flew further than your ball.'],
    goodMods: { happiness: 5, professionalRep: 2 }, badMods: { stress: 3 },
  }),
  outing({
    id: 'le_bowling', label: 'Go bowling', group: 'Sport', scene: 'sports', years: [1900, 2300], minAge: 5, cost: 15,
    desc: 'Rented shoes and a heavy ball.',
    score: (x) => st(x, 'dexterity', 'happiness'), mods: { stress: -3, loneliness: -3 },
    good: ['Three strikes in a row. You did a little dance. Everyone saw.', 'You won the game and a fizzy drink.'],
    ok: ['Two gutters, one strike, a lot of nachos.', 'Middle of the scoreboard and happy there.'],
    bad: ['The ball went backwards. Somehow.', 'You bowled a 23. The kids\' lane bumpers were mocking you.'],
    goodMods: { happiness: 5 },
  }),
  outing({
    id: 'le_cycle', label: 'Bike ride', group: 'Sport', scene: 'roadTrip', years: [1870, 2300], minAge: 5,
    desc: 'Two wheels, one long road.',
    when: (x) => (owns(x, 'bicycle', 'motorcycle') || x.c.age < 16 ? true : 'Needs a bicycle'),
    score: (x) => sk(x, 'cycling', x.stat('fitness') * 0.3), mods: { fitness: 2, stress: -4 }, train: [['cycling', 3]],
    good: ['Downhill, wind in your face, shouting for joy.', 'Sixty miles and a cake stop. Perfect.'],
    ok: ['Uphill both ways, somehow.', 'A pleasant ride with one flat tyre.'],
    bad: ['You went over the handlebars into a hedge.', 'A bus passed close enough to read your thoughts.'],
    goodMods: { happiness: 5 }, badMods: { pain: 4, health: -1 },
  }),
  outing({
    id: 'le_martial', label: 'Martial arts class', group: 'Sport', scene: 'fight', minAge: 6, cost: 20,
    desc: 'Bow, kick, bow again.',
    score: (x) => sk(x, 'martialArts', x.stat('discipline') * 0.3), mods: { fitness: 2, discipline: 1, stress: -3 }, train: [['martialArts', 3], ['selfDefense', 2]],
    good: ['You broke the board on the first try. The sensei raised one eyebrow. High praise.', 'You earned a new belt. You tied it wrong, but you earned it.'],
    ok: ['You sparred, got a bruise, gave a bruise.', 'Lots of stretching and shouting "hai".'],
    bad: ['You got kicked in the face by a twelve-year-old.', 'The board did not break. Your hand nearly did.'],
    goodMods: { confidence: 4 }, badMods: { pain: 4 },
  }),
  outing({
    id: 'le_dance', label: 'Dance class', group: 'Sport', scene: 'dance', minAge: 5, cost: 15,
    desc: (`Learn the steps. Step on fewer feet.`),
    score: (x) => sk(x, 'dance'), mods: { fitness: 2, stress: -4, loneliness: -2 }, train: [['dance', 3]],
    good: ['The teacher picked you to demonstrate. You did not fall.', 'Something clicked and suddenly you were dancing, not counting.'],
    ok: ['One-two-three, one-two-three, oops.', 'Your hips are learning. Your feet are still at the beginner level.'],
    bad: ['You turned left. The whole class turned right.', 'You stepped on your partner\'s foot so hard they left early.'],
    goodMods: { happiness: 5, confidence: 2 },
  }),
  outing({
    id: 'le_archery', label: 'Archery practice', group: 'Sport', scene: 'sports', minAge: 8, cost: 10,
    desc: 'Draw, breathe, release.',
    score: (x) => sk(x, 'archery', x.stat('discipline') * 0.2), mods: { stress: -3 }, train: [['archery', 3]],
    good: ['Bullseye. The arrow is still humming.', 'Five arrows in the gold. Robin Hood would want your number.'],
    ok: ['Most arrows hit the target. One hit a different target.', 'Steady improvement and a sore forearm.'],
    bad: ['Your arrow vanished into the trees. So did your confidence.', 'You slapped your own arm with the bowstring.'],
    goodMods: { confidence: 3, happiness: 3 },
  }),
];

// ---------------------------------------------------------------- At home
const HOME: ActionDef[] = [
  outing({
    id: 'le_read', label: 'Read a book', group: 'At home', scene: 'reading', minAge: 5,
    desc: 'Disappear into someone else\'s life for a while.',
    when: (x) => (x.year < 1450 && x.skill('literacy') < 20 && x.c.age >= 10 ? 'You cannot read' : true),
    score: (x) => x.stat('smarts'), mods: { stress: -4, smarts: 1 }, train: [['literacy', 2], ['writing', 1]],
    good: ['You finished it at 2am and lay awake thinking about the ending.', 'A sentence in chapter four said exactly what you have always felt.'],
    ok: ['A pleasant read. You remember the cover.', 'Half a book and a long nap on top of it.'],
    bad: ['The twist was obvious from page three.', 'You read the same page six times and gave up.'],
    goodMods: { happiness: 4, wisdom: 2, empathy: 1 },
  }),
  outing({
    id: 'le_paint', label: 'Paint something', group: 'At home', scene: 'painting', minAge: 4, cost: 10,
    desc: 'Brush, canvas, and the eternal battle with hands.',
    score: (x) => sk(x, 'painting', x.stat('creativity') * 0.3), mods: { stress: -4, creativity: 2 }, train: [['painting', 3], ['art', 1]],
    good: ['You painted the light just right. You stared at it like a stranger had made it.', 'A friend asked to buy it. You said no. Then yes.'],
    ok: ['A decent landscape. The trees look like broccoli, but confident broccoli.', 'You painted a bowl of fruit. The fruit looks worried.'],
    bad: ['It was meant to be a horse.', 'You knocked water into the palette and painted everything brown.'],
    goodMods: { happiness: 5, confidence: 2 },
  }),
  outing({
    id: 'le_instrument', label: (x) => (owns(x, 'piano') ? 'Play the piano' : owns(x, 'guitar') ? 'Play the guitar' : owns(x, 'violin') ? 'Play the violin' : owns(x, 'lute') ? 'Play the lute' : 'Play an instrument'), group: 'At home', scene: 'music', minAge: 5,
    desc: 'Practice makes, eventually, music.',
    score: (x) => sk(x, 'music', owns(x, 'piano', 'guitar', 'violin', 'lute', 'drums', 'synth') ? 10 : 0), mods: { stress: -4, creativity: 1 }, train: [['music', 3], ['instrumentMastery', 1]],
    good: ['You played the hard bit without stopping. The neighbours went quiet to listen.', 'You wrote a little melody that will not leave your head.'],
    ok: ['Scales, scales and one nice tune at the end.', 'You played well enough to annoy the cat only slightly.'],
    bad: ['A string snapped and so did you.', 'The neighbour banged on the wall in four-four time.'],
    goodMods: { happiness: 5, confidence: 2 },
  }),
  outing({
    id: 'le_feast', label: 'Cook a feast', group: 'At home', scene: 'cooking', minAge: 10, cost: 60,
    desc: 'Invite people, cook too much, accept compliments.',
    score: (x) => sk(x, 'cooking'), mods: { loneliness: -5 }, train: [['cooking', 4]],
    good: ['Everyone went back for thirds. Someone asked for the recipe; you said it was a family secret.', 'The roast was perfect and the gravy was legendary.'],
    ok: ['A few burnt edges, many happy faces.', 'Dinner was late but delicious, like a rock star.'],
    bad: ['The smoke alarm became the evening\'s entertainment.', 'You salted the cake. Not the salted caramel cake. Just the cake.'],
    goodMods: { happiness: 6, popularity: 2 }, badMods: { happiness: -2 },
  }),
  outing({
    id: 'le_bake', label: 'Bake something', group: 'At home', scene: 'cooking', minAge: 6, cost: 10,
    desc: 'Flour everywhere, joy everywhere.',
    score: (x) => sk(x, 'baking'), mods: { stress: -4 }, train: [['baking', 3]],
    good: ['Your bread rose like a proud soufflé. You took photos.', 'Your cookies vanished in four minutes. A record.'],
    ok: ['Slightly flat, very tasty.', 'You ate half the dough. The cake came out small.'],
    bad: ['You used salt instead of sugar. Your family was very polite about it.', 'The middle is raw and the edges are charcoal.'],
    goodMods: { happiness: 5 },
  }),
  outing({
    id: 'le_garden', label: 'Tend the garden', group: 'At home', scene: 'gardening', minAge: 5,
    desc: 'Dirt under the nails, peace in the head.',
    score: (x) => sk(x, 'farming', x.stat('discipline') * 0.2), mods: { stress: -5, health: 1 }, train: [['farming', 2], ['herbalism', 1]],
    good: ['Your tomatoes came in like a parade. The neighbours are jealous.', 'The roses you planted years ago finally bloomed.'],
    ok: ['You pulled weeds and a few things that were not weeds.', 'Quiet hours, sore back, good soil.'],
    bad: ['Slugs ate everything. They left one leaf as a message.', 'You dug up the neighbour\'s cable.'],
    goodMods: { happiness: 4, depression: -2 },
  }),
  outing({
    id: 'le_chess', label: (x) => (x.year < 600 ? 'Play a board game' : 'Play chess'), group: 'At home', scene: 'gaming', minAge: 5,
    desc: 'Outthink someone across a board.',
    score: (x) => st(x, 'smarts', 'discipline') + (owns(x, 'chessSet') ? 5 : 0), mods: { stress: -2 }, train: [['logic', 3], ['militaryStrategy', 1]],
    good: ['Checkmate in twelve moves. You tried not to look smug. You failed.', 'You sacrificed your queen on purpose and it worked.'],
    ok: ['A long draw. You both claim moral victory.', 'You won one, lost one, argued about the third.'],
    bad: ['You lost to a child who was also eating a sandwich.', 'You knocked the board over "by accident" while losing.'],
    goodMods: { smarts: 2, confidence: 2 }, badMods: { ego: -2 },
  }),
  outing({
    id: 'le_boardGames', label: 'Board game night', group: 'At home', scene: 'gaming', years: [1930, 2300], minAge: 6, cost: 10,
    desc: 'Snacks, rules disputes, family feuds.',
    score: (x) => st(x, 'smarts', 'charisma'), mods: { loneliness: -5, stress: -2 }, train: [['negotiation', 1]],
    good: ['You won with a trade so audacious it will be discussed for years.', 'Everybody laughed until midnight. Nobody flipped the board.'],
    ok: ['Three hours, one game, several snacks.', 'You lost but owned the most expensive street.'],
    bad: ['Monopoly. Nobody is speaking to each other now.', 'Someone found the missing dice in the dip.'],
    goodMods: { happiness: 5 },
  }),
  outing({
    id: 'le_puzzle', label: 'Do a jigsaw puzzle', group: 'At home', scene: 'gaming', years: [1760, 2300], minAge: 5, cost: 10,
    desc: 'A thousand pieces of sky.',
    score: (x) => st(x, 'discipline', 'smarts'), mods: { stress: -5, anxiety: -2 },
    good: ['The last piece clicked in and you felt like a god.', 'You finished in one long, calm sitting.'],
    ok: ['You completed the edges. The sky remains a mystery.', 'Half done. It lives on the table now.'],
    bad: ['One piece is missing. One. You searched for an hour.', 'The cat walked across it.'],
    goodMods: { happiness: 4 },
  }),
  outing({
    id: 'le_write', label: (x) => (x.c.age < 13 ? 'Write a story' : 'Write in your notebook'), group: 'At home', scene: 'reading', minAge: 7,
    desc: 'Put words in a row and see what happens.',
    when: (x) => (x.year < 1450 && x.skill('literacy') < 20 ? 'You cannot write' : true),
    score: (x) => sk(x, 'writing', x.stat('creativity') * 0.3), mods: { stress: -3, creativity: 2 }, train: [['writing', 3], ['poetry', 1]],
    good: ['You wrote three pages that felt like they came from somewhere else.', 'A character you made up started talking back. That is the good sign.'],
    ok: ['A few decent lines in a sea of crossed-out ones.', 'You wrote the opening sentence nine times.'],
    bad: ['You stared at the blank page until it stared back.', 'You reread last week\'s pages and burned them.'],
    goodMods: { happiness: 4, creativity: 2 },
  }),
  outing({
    id: 'le_videoGames', label: 'Play video games', group: 'At home', scene: 'gaming', years: [1975, 2300], minAge: 4,
    desc: 'One more level. Then bed. Then one more level.',
    when: (x) => (owns(x, 'gameConsole', 'computer', 'smartphone', 'vrHeadset') || x.c.age < 18 ? true : 'Needs a console or computer'),
    score: (x) => sk(x, 'gameDesign', x.stat('dexterity') * 0.3), mods: { stress: -5, fitness: -1 },
    good: ['You beat the final boss on the first try and screamed at 1am.', 'You found a secret level nobody online talks about.'],
    ok: ['Four hours vanished. You do not regret them.', 'You lost, rage-quit, came back, won.'],
    bad: ['A twelve-year-old online insulted your mother in fluent profanity.', 'Your save file corrupted. Forty hours, gone.'],
    goodMods: { happiness: 6 }, badMods: { stress: 4, aggression: 1 },
  }),
  outing({
    id: 'le_arcade', label: 'Hit the arcade', group: 'At home', scene: 'gaming', years: [1971, 2300], minAge: 6, cost: 10,
    desc: 'A pocket full of coins and blinking lights.',
    score: (x) => x.stat('dexterity'), mods: { stress: -3 },
    good: ['Your initials are now on the high-score table. Forever. Probably.', 'You won enough tickets for a plastic spider. Worth it.'],
    ok: ['You spent all your coins in twenty minutes and had a lovely time.', 'The claw machine took your money and gave you hope.'],
    bad: ['The claw dropped the bear right at the chute.', 'A machine ate your last coin and gave nothing back.'],
    goodMods: { happiness: 5 },
  }),
  outing({
    id: 'le_stream', label: 'Binge a show', group: 'At home', scene: 'cinema', years: [2010, 2300], minAge: 6,
    desc: '"Are you still watching?" Yes. Yes I am.',
    score: (x) => x.stat('happiness'), mods: { stress: -5, energy: 3, fitness: -1 },
    good: ['A perfect season with a perfect ending. You want to tell everyone.', 'You found your new favourite show and texted three friends about it.'],
    ok: ['Eight episodes. You remember the theme tune.', 'Good show, bad sleep.'],
    bad: ['The finale ruined everything. You are writing a strongly worded post.', 'Spoiled by a meme on episode two.'],
    goodMods: { happiness: 5 }, badMods: { happiness: -2 },
  }),
  outing({
    id: 'le_vr', label: 'VR adventure', group: 'At home', scene: 'gaming', years: [2025, 2300], minAge: 8, cost: 20,
    desc: 'Strap a world to your face.',
    score: (x) => st(x, 'dexterity', 'happiness') + (owns(x, 'vrHeadset') ? 10 : 0), mods: { stress: -4 },
    good: ['You climbed a virtual Everest and your real legs shook at the top.', 'You fought a dragon in your living room and won.'],
    ok: ['Amazing visuals, mild motion sickness.', 'You explored the ocean floor and bumped into the real sofa.'],
    bad: ['You punched the television. The television lost.', 'You got so motion sick you lay on the floor in reality.'],
    goodMods: { happiness: 6 }, badMods: { health: -1 },
  }),
  outing({
    id: 'le_craft', label: 'Craft afternoon', group: 'At home', scene: 'painting', minAge: 5, cost: 10,
    desc: 'Knitting, pottery, whittling: make a thing with your hands.',
    score: (x) => st(x, 'dexterity', 'creativity'), mods: { stress: -5, anxiety: -2 }, train: [['artisanship', 3], ['tailoring', 1]],
    good: ['You made a bowl. It holds things. You are a god of small things.', 'Your scarf is long, warm and nearly symmetrical.'],
    ok: ['A lopsided mug full of love.', 'You knitted something. Its purpose remains unclear.'],
    bad: ['You glued yourself to the table.', 'The pottery wheel threw the clay at you.'],
    goodMods: { happiness: 4, creativity: 2 },
  }),
];

// ---------------------------------------------------------------- Kids and giving back
const EXTRA: ActionDef[] = [
  outing({
    id: 'le_playground', label: 'Go to the playground', group: 'Outdoors', scene: 'playground', minAge: 2, maxAge: 10, years: [1880, 2300],
    desc: 'Swings, slides and the sandbox economy.',
    score: (x) => x.stat('happiness'), mods: { fitness: 1, loneliness: -3 },
    good: ['You went down the big slide head first. A legend was born.', 'You made a best friend in the sandbox in eleven seconds.'],
    ok: ['Swings, slide, swings again. Perfect.', 'You traded a shiny stone for a slightly shinier stone.'],
    bad: ['You scraped your knee and cried until you got a sticker.', 'A bigger kid hogged the swing all afternoon.'],
    goodMods: { happiness: 5 }, badMods: { pain: 2 },
  }),
  outing({
    id: 'le_hideSeek', label: 'Play hide and seek', group: 'Outdoors', scene: 'friends', minAge: 3, maxAge: 12,
    desc: 'Count to twenty. No peeking.',
    score: (x) => x.stat('smarts'), mods: { happiness: 3, loneliness: -3 },
    good: ['You hid so well that everyone gave up and you won by default.', 'You found everybody in four minutes. A detective is born.'],
    ok: ['You hid behind a curtain with your feet showing. Classic.', 'Fun until someone went home without saying.'],
    bad: ['You hid so well everyone forgot and went in for dinner.', 'You hid in a cupboard and fell asleep.'],
    goodMods: { happiness: 3 },
  }),
  outing({
    id: 'le_sleepover', label: 'Have a sleepover', group: 'At home', scene: 'friends', minAge: 6, maxAge: 15,
    desc: 'Snacks, stories and absolutely no sleeping.',
    score: (x) => st(x, 'charisma', 'happiness'), mods: { loneliness: -6, energy: -5 },
    good: ['You stayed up till 3am telling ghost stories and laughing into pillows.', 'Pillow fight champion. Undisputed.'],
    ok: ['Popcorn, a film and a whispered secret or two.', 'You fell asleep first and woke up with a drawn-on moustache.'],
    bad: ['Someone cried and wanted to go home at 10pm.', 'You got caught by a parent at 1am. Lights out, forever.'],
    goodMods: { happiness: 6, popularity: 2 },
  }),
  outing({
    id: 'le_volunteer', label: 'Volunteer', group: 'Culture', scene: 'volunteer', minAge: 10,
    desc: 'Give a day to someone who needs it.',
    score: (x) => st(x, 'empathy', 'charisma'), mods: { karma: 3, empathy: 2, loneliness: -3, depression: -2 }, train: [['empathyListening', 2], ['teamwork', 1]],
    good: [(x) => (x.year < 1800 ? 'You ladled soup at the almshouse and an old woman blessed your whole family.' : 'You served two hundred meals and remembered most of the names.'), 'A kid you helped with reading finished a whole book and hugged you.'],
    ok: ['You planted thirty trees. Your back will remember every one.', 'You sorted donations for hours. Many socks. Many, many socks.'],
    bad: ['You dropped a tray of soup on the coordinator.', 'You mostly got in the way, but they thanked you anyway.'],
    goodMods: { happiness: 6, publicImage: 2 },
  }),
];

// ---------------------------------------------------------------- Era specials
const ERA: ActionDef[] = [
  outing({
    id: 'le_baths', label: 'Visit the public baths', group: 'Era specials', scene: 'spa', years: [-200, 530], cost: 3,
    desc: 'Hot pool, cold pool, gossip pool.',
    score: (x) => st(x, 'charisma', 'happiness'), mods: { stress: -6, health: 2 }, train: [['gossip', 2], ['networking', 1]],
    good: ['A senator in the next tub told you a secret worth a fortune.', 'Hot, cold, hot, massage. You emerged reborn and slightly pink.'],
    ok: ['You soaked, you scraped, you heard about everyone\'s divorce.', 'Pleasant, steamy and full of strangers.'],
    bad: ['A thief stole your sandals while you soaked.', 'The water looked suspiciously like soup.'],
    goodMods: { happiness: 5, popularity: 1 }, badMods: { happiness: -2 },
  }),
  outing({
    id: 'le_arena', label: 'Watch the games at the arena', group: 'Era specials', scene: 'fight', years: [-264, 404], minAge: 8, cost: 2,
    desc: 'Bread, circuses and a very loud crowd.',
    score: (x) => x.stat('happiness'), mods: { stress: -3, empathy: -1 },
    good: ['The crowd roared, the emperor waved and you caught a free loaf.', 'Your favourite fighter won and the crowd chanted his name for an hour.'],
    ok: ['Long day, hard seats, a lot of shouting.', 'You cheered when everyone cheered. Mostly for the bread.'],
    bad: ['Your seat was in the sun all day. You are now a tomato.', 'Someone threw a turnip at the referee and hit you.'],
    goodMods: { happiness: 5 },
  }),
  outing({
    id: 'le_chariotRace', label: 'Chariot races', group: 'Era specials', scene: 'sports', years: [-600, 560], minAge: 8, cost: 2,
    desc: 'Blues against Greens. Pick a side. For life.',
    score: (x) => x.stat('riskTolerance'), mods: { stress: -3 },
    good: ['Your team won by a nose and you hugged a stranger who smelled of fish.', 'You bet a coin on the outsider and doubled it.'],
    ok: ['Seven laps of dust and noise. Wonderful.', 'Your team came third. You will never forgive the charioteer.'],
    bad: ['A Blues fan punched you for wearing green.', 'You lost a week\'s wage on a horse that stopped to graze.'],
    goodMods: { happiness: 5 }, badMods: { pain: 2 },
  }),
  {
    id: 'le_joust', cat: 'activity', label: 'Jousting tournament', group: 'Era specials', ap: 1,
    desc: 'Watch knights unhorse each other, or ride in yourself.',
    scene: 'joust',
    avail: (x) => (x.c.legal.prison || x.year < 1050 || x.year > 1600 ? false : true),
    options: (x) => [
      { value: 'watch', label: 'Watch from the stands' },
      { value: 'ride', label: 'Ride in the lists', disabled: x.c.age < 16 ? 'Age 16+' : x.skill('horsemanship') < 15 ? 'Needs horsemanship' : undefined },
    ],
    run: (x, arg) => {
      if (optOf(arg) === 'ride' && x.c.age >= 16 && x.skill('horsemanship') >= 15) {
        x.train('horsemanship', 3); x.train('weaponsTraining', 2);
        const score = x.skill('horsemanship') * 0.6 + x.stat('fitness') * 0.3 + x.int(0, 40);
        if (score > 60) { x.mods({ fame: 4, confidence: 5, happiness: 6 }); x.money(price(x, 300)); return `You broke your lance clean on the champion's shield and won a purse of ${x.fmt(price(x, 300))}.`; }
        if (score < 35) { x.mods({ health: -8, pain: 10, confidence: -4 }); return 'You met the ground at speed. The crowd said "ooh" in perfect harmony.'; }
        x.mods({ fame: 1, happiness: 3 }); return 'Three passes, two splintered lances, one draw. Your arm is numb and proud.';
      }
      x.mods({ stress: -3, happiness: 3 });
      return x.pick(['A knight dedicated his ride to someone in your row. Everyone claimed it was them.', 'Lances splintered, horses thundered and you got a free pie.', 'A favourite was unhorsed into the mud and the crowd went wild.']);
    },
  },
  outing({
    id: 'le_fair', label: 'Go to the fair', group: 'Era specials', scene: 'festival', years: [800, 1850], cost: 3,
    desc: 'Jugglers, pies, a dancing bear and a man selling miracle tonic.',
    score: (x) => x.stat('happiness'), mods: { stress: -3, loneliness: -3 },
    good: ['You won a pig in a wrestling contest. You do not know what to do with a pig.', 'A juggler taught you three balls. You can do two and a half.'],
    ok: ['You ate four pies and watched a puppet show about the Devil.', 'Noise, mud, honey cakes. Excellent.'],
    bad: ['You bought a miracle tonic. It was mostly turnip.', 'A pickpocket relieved you of your coin and your good mood.'],
    goodMods: { happiness: 5 }, badMods: { happiness: -2 },
  }),
  outing({
    id: 'le_maskedBall', label: 'Masked ball', group: 'Era specials', scene: 'royalBall', years: [1500, 1910], minAge: 16, cost: 150,
    desc: 'Chandeliers, waltzes and nobody is who they seem.',
    score: (x) => st(x, 'charisma', 'looks') + x.skill('dance') * 0.2, mods: { stress: -3 }, train: [['etiquette', 3], ['dance', 2]],
    good: ['You danced with a mysterious stranger who turned out to be a duchess.', 'Your mask was the talk of the ball. Three invitations arrived the next morning.'],
    ok: ['You waltzed, you gossiped, you lost a glove.', 'Lovely music, endless curtsies, sore feet.'],
    bad: ['You recognised your own cousin flirting behind a mask. You will never unsee it.', 'Your mask slipped mid-bow into the punch bowl.'],
    goodMods: { happiness: 6, popularity: 3, publicImage: 2 }, badMods: { publicImage: -2 },
  }),
  outing({
    id: 'le_coffeehouse', label: 'Visit a coffeehouse', group: 'Era specials', scene: 'friends', years: [1650, 1900], minAge: 14, cost: 2,
    desc: 'A penny for coffee and all the arguments you can handle.',
    score: (x) => st(x, 'smarts', 'charisma'), mods: { loneliness: -3 }, train: [['philosophy', 2], ['economics', 1]],
    good: ['You won a debate about the price of tea and gained two admirers.', 'A merchant overheard your idea and wants to invest.'],
    ok: ['Strong coffee, strong opinions.', 'You read the news sheets twice and argued about both.'],
    bad: ['You were jittery for two days.', 'You argued politics with a man who turned out to be a magistrate.'],
    goodMods: { happiness: 4, smarts: 1 },
  }),
  outing({
    id: 'le_horseRaces', label: 'A day at the races', group: 'Era specials', scene: 'petHorse', years: [1700, 2300], minAge: 16, cost: 50,
    desc: 'Big hats, small jockeys, risky tips.',
    score: (x) => st(x, 'riskTolerance', 'wisdom') + x.skill('horsemanship') * 0.2, mods: { stress: -3 },
    good: ['Your outsider romped home at twenty to one.', 'You won a tidy sum on a horse named after your grandmother.'],
    ok: ['You won one race and lost three. Broke even on joy.', 'Splendid hats, mediocre betting.'],
    bad: ['Your horse is probably still running.', 'A "sure thing" from a man in the bar was not.'],
    goodMods: { happiness: 6 }, badMods: { happiness: -3 },
    after: (x, t) => {
      if (t !== 'good') return;
      const n = price(x, x.int(100, 600));
      x.money(n);
      return `You pocketed ${x.fmt(n)}.`;
    },
  }),
  outing({
    id: 'le_circus', label: 'Go to the circus', group: 'Era specials', scene: 'stage', years: [1770, 2300], cost: 20,
    desc: 'Acrobats, clowns, and a tent that smells of sawdust.',
    score: (x) => x.stat('happiness'), mods: { stress: -4 },
    good: ['A trapeze artist did a triple and you forgot to breathe.', 'You were picked from the crowd and the clown let you win.'],
    ok: ['Clowns, candy floss, a slightly sad elephant.', 'Good show, very loud trumpet.'],
    bad: ['A clown honked his horn directly into your ear.', 'The fire juggler dropped one. Everyone moved quickly.'],
    goodMods: { happiness: 6 },
  }),
  outing({
    id: 'le_amusement', label: 'Amusement park', group: 'Era specials', scene: 'amusement', years: [1890, 2300], minAge: 4, cost: 60,
    desc: 'Scream on purpose and eat fried things.',
    score: (x) => x.stat('riskTolerance') + 10, mods: { stress: -5 },
    good: ['Front row of the biggest coaster. You screamed for joy the whole way.', 'You won a giant teddy bear and carried it all day like a trophy.'],
    ok: ['Two hours of queues, two minutes of terror. Classic.', 'Candy floss, a ghost train and sticky hands.'],
    bad: ['You threw up on the teacups.', 'The Ferris wheel stopped with you at the top for forty minutes.'],
    goodMods: { happiness: 7 }, badMods: { health: -1 },
  }),
  outing({
    id: 'le_waterPark', label: 'Water park', group: 'Era specials', scene: 'amusement', years: [1977, 2300], minAge: 4, cost: 40,
    desc: 'Slides, wave pools and chlorine for days.',
    score: (x) => x.stat('riskTolerance') + 10, mods: { stress: -5, fitness: 1 },
    good: ['The steepest slide, eyes open. You feel immortal.', 'The wave pool was perfect and your cheeks hurt from grinning.'],
    ok: ['Long queues, good slides, burnt shoulders.', 'Your swimsuit and the big slide had a disagreement.'],
    bad: ['You got stuck halfway down a tube slide.', 'The lazy river was not lazy. It was a traffic jam.'],
    goodMods: { happiness: 6 },
  }),
  outing({
    id: 'le_escapeRoom', label: 'Escape room', group: 'Era specials', scene: 'gaming', years: [2010, 2300], minAge: 10, cost: 35,
    desc: 'Sixty minutes, one locked door and too many padlocks.',
    score: (x) => st(x, 'smarts', 'discipline'), mods: { loneliness: -4 }, train: [['logic', 2], ['teamwork', 2]],
    good: ['You escaped with four minutes left and a photo for the leaderboard.', 'You solved the final riddle while everyone else argued.'],
    ok: ['Two hints, one argument, just in time.', 'You did not escape, but you found every key.'],
    bad: ['You spent forty minutes trying to open a decorative drawer.', 'You were "rescued" by the staff after an hour, with sympathy.'],
    goodMods: { happiness: 5, confidence: 2 },
  }),
  outing({
    id: 'le_laserTag', label: (x) => (x.year < 1990 ? 'Laser tag' : 'Laser tag or paintball'), group: 'Era specials', scene: 'sports', years: [1984, 2300], minAge: 8, cost: 30,
    desc: 'Run, hide, zap your friends.',
    score: (x) => st(x, 'dexterity', 'fitness'), mods: { stress: -4, fitness: 1 }, train: [['marksmanship', 1], ['teamwork', 1]],
    good: ['Top of the scoreboard. You did a slow-motion victory walk.', 'You tagged the birthday kid and the birthday kid\'s dad.'],
    ok: ['You hid behind a barrel and hit nobody, but felt very tactical.', 'Sweaty and fun.'],
    bad: ['Tagged in the first ten seconds. You spent the rest blinking.', 'You took a paintball to the knuckle and saw colours.'],
    goodMods: { happiness: 5 }, badMods: { pain: 2 },
  }),
  outing({
    id: 'le_watchMatch', label: 'Watch a big match', group: 'Era specials', scene: 'sports', years: [1870, 2300], minAge: 5, cost: 50,
    desc: 'Stadium lights, terrible pies, collective emotion.',
    score: (x) => x.stat('happiness'), mods: { stress: -3, loneliness: -4 },
    good: ['A last-minute winner. You hugged strangers and lost your voice.', 'You caught the ball in the stands and the cameras found you.'],
    ok: ['A nil-nil draw. The pie was the highlight.', 'Noisy, cold, glorious.'],
    bad: ['Your team lost to a team you have never heard of.', 'You got splashed with beer by the goal celebration.'],
    goodMods: { happiness: 6 }, badMods: { happiness: -3 },
  }),
  outing({
    id: 'le_carnival', label: (x) => `Carnival in ${x.countryName}`, group: 'Era specials', scene: 'festival', cost: 20,
    desc: 'Costumes, parades and dancing in the street.',
    score: (x) => st(x, 'charisma', 'happiness'), mods: { stress: -5, loneliness: -4 }, train: [['dance', 1]],
    good: ['You danced behind a parade float until sunrise.', 'Your costume made a child scream with delight. The good scream.'],
    ok: ['Glitter in your hair for a week. Worth it.', 'You followed the band for three streets and lost your shoes.'],
    bad: ['Your costume fell apart halfway through the parade.', 'It rained on the parade, as the song warns.'],
    goodMods: { happiness: 6 },
  }),
  outing({
    id: 'le_speakeasy', label: 'Sneak into a speakeasy', group: 'Era specials', scene: 'bar', years: [1920, 1933], minAge: 18, cost: 30,
    desc: 'Knock twice, say the password, keep your voice down.',
    score: (x) => st(x, 'charisma', 'riskTolerance'), mods: { stress: -4 }, train: [['streetwise', 2]],
    good: ['A hot band, cold gin and a gangster who bought your drinks.', 'You learned the password to three more clubs.'],
    ok: ['Bathtub gin. It tasted like a bathtub.', 'Swing music, low lights, sore feet.'],
    bad: ['The place was raided. You left through the coal chute.', 'The gin made you see two of everything.'],
    goodMods: { happiness: 6, streetCred: 2 }, badMods: { health: -3 },
    after: (x, t) => { if (t === 'bad' && x.chance(0.3)) { x.mod('criminalRep', 1); return 'Your name ended up in a policeman\'s notebook.'; } },
  }),
  outing({
    id: 'le_teaDance', label: 'Tea dance', group: 'Era specials', scene: 'dance', years: [1890, 1945], minAge: 14, cost: 10,
    desc: 'A string trio, cucumber sandwiches and a foxtrot.',
    score: (x) => sk(x, 'dance', x.stat('charisma') * 0.2), mods: { stress: -3, loneliness: -3 }, train: [['dance', 2], ['etiquette', 1]],
    good: ['You foxtrotted like a film star and everybody watched.', 'Lovely music, lovely sandwiches, lovely afternoon.'],
    ok: ['Polite dancing, polite conversation.', 'You trod on one foot. Only one.'],
    bad: ['You sneezed into the cucumber sandwiches.', 'Your dance card stayed blank all afternoon.'],
    goodMods: { happiness: 5 },
  }),
  outing({
    id: 'le_rollerDisco', label: 'Roller disco', group: 'Era specials', scene: 'party', years: [1975, 1992], minAge: 8, cost: 10,
    desc: 'Glitter ball, roller skates, flared trousers.',
    score: (x) => st(x, 'dexterity', 'confidence'), mods: { stress: -4, fitness: 1 },
    good: ['You skated backwards to the disco hit of the summer.', 'Couples skate, then solo skate, then you were a star.'],
    ok: ['You went round and round. Mostly upright.', 'Great music, wobbly ankles.'],
    bad: ['You took out a conga line.', 'You fell, and four people fell over you.'],
    goodMods: { happiness: 6 }, badMods: { pain: 3 },
  }),
  outing({
    id: 'le_holoConcert', label: 'Hologram concert', group: 'Era specials', scene: 'concert', years: [2050, 2300], minAge: 6, cost: 80,
    desc: 'Every legend who ever lived, live again, in light.',
    score: (x) => x.stat('happiness'), mods: { stress: -5 },
    good: ['A hologram of a long-dead singer looked right at you. Spooky, perfect.', 'The light show reached into the crowd and you held a star.'],
    ok: ['Impressive, if a bit glitchy around the hair.', 'The ghost of rock and roll was 90 percent there.'],
    bad: ['The hologram crashed mid-song and showed a loading bar.', 'A firmware update interrupted the encore.'],
    goodMods: { happiness: 6 },
  }),
  outing({
    id: 'le_zeroG', label: 'Zero-g club', group: 'Era specials', scene: 'party', years: [2080, 2300], minAge: 18, cost: 200,
    desc: 'A dancefloor with no floor.',
    score: (x) => st(x, 'dexterity', 'fitness'), mods: { stress: -6 },
    good: ['You did a backflip that lasted ten seconds. Applause from every direction.', 'You danced on the ceiling. Literally.'],
    ok: ['You floated, spun, bumped into a stranger. Lovely.', 'Disorienting and delightful.'],
    bad: ['You drifted into a corner and could not get out for a whole song.', 'Zero-g and dinner were a poor combination.'],
    goodMods: { happiness: 7 }, badMods: { health: -1 },
  }),
];

// ---------------------------------------------------------------- Travel
interface Dest {
  id: string;
  name: string;
  years: [number, number];
  cost: number;
  scene: string;
  line: string;
  train?: [string, number][];
  mods?: Mods;
}

const DESTS: Dest[] = [
  { id: 'athens', name: 'Athens', years: [-800, 2300], cost: 1500, scene: 'travel', line: 'You climbed to the Acropolis and argued with a philosopher on the way down.', train: [['philosophy', 2]] },
  { id: 'olympia', name: 'the Olympic Games', years: [-776, 393], cost: 800, scene: 'sports', line: 'You watched naked runners race for an olive wreath and found it very moving.' },
  { id: 'alexandria', name: 'Alexandria', years: [-331, 640], cost: 1200, scene: 'library', line: 'You saw the lighthouse and spent three days lost in the great library.', train: [['science', 2], ['history', 2]], mods: { smarts: 2 } },
  { id: 'pyramids', name: (`the Pyramids`), years: [-2500, 2300], cost: 2500, scene: 'travel', line: 'The pyramids made every building you have ever seen look shy.', train: [['history', 2]] },
  { id: 'rome', name: 'Rome', years: [-500, 2300], cost: 1500, scene: 'travel', line: 'Every street in Rome was older than your whole family tree.', train: [['history', 1], ['art', 1]] },
  { id: 'constantinople', name: 'Constantinople', years: [330, 1453], cost: 1500, scene: 'travel', line: 'You stood under the dome of Hagia Sophia and forgot how to speak.', mods: { faith: 2 } },
  { id: 'santiago', name: 'a pilgrimage to Santiago', years: [900, 2300], cost: 600, scene: 'hiking', line: 'Five hundred miles on foot, a scallop shell on your hat and a lighter soul.', mods: { faith: 4, sin: -3, fitness: 3, karma: 2 } },
  { id: 'jerusalem', name: 'a pilgrimage to Jerusalem', years: [300, 1700], cost: 2000, scene: 'holy', line: 'You knelt at the holy places and wept with strangers from a hundred lands.', mods: { faith: 6, sin: -5, divineFavor: 2 } },
  { id: 'venice', name: 'Venice for Carnival', years: [1100, 2300], cost: 1800, scene: 'festival', line: 'Masks, gondolas and a palace party you were not technically invited to.' },
  { id: 'grandTour', name: 'the Grand Tour of Europe', years: [1660, 1840], cost: 8000, scene: 'travel', line: 'Paris, Florence, Rome: you came home with a sunburn, three portraits and an accent.', train: [['languages', 3], ['art', 2], ['etiquette', 2]], mods: { publicImage: 3 } },
  { id: 'seaside', name: 'a seaside resort', years: [1750, 2300], cost: 400, scene: 'beach', line: 'Promenades, sea air and a donkey that refused to move.' },
  { id: 'paris', name: 'Paris', years: [1700, 2300], cost: 1800, scene: 'travel', line: 'You ate a croissant by the Seine and became insufferable about it.', train: [['languages', 2]] },
  { id: 'niagara', name: 'Niagara Falls', years: [1830, 2300], cost: 900, scene: 'travel', line: 'The roar of the falls was louder than your thoughts. Bliss.' },
  { id: 'alps', name: 'the Swiss Alps', years: [1860, 2300], cost: 2500, scene: 'skiing', line: 'Clean air, cowbells and cheese that should be illegal.', mods: { health: 2 } },
  { id: 'nile', name: 'a Nile cruise', years: [1870, 2300], cost: 3000, scene: 'travel', line: 'You drifted past temples older than memory with a gin in your hand.', train: [['history', 2]] },
  { id: 'safari', name: 'a safari', years: [1900, 2300], cost: 5000, scene: 'zoo', line: 'A lion yawned twenty feet away and you understood your place in the food chain.' },
  { id: 'roadTrip', name: 'a road trip', years: [1920, 2300], cost: 700, scene: 'roadTrip', line: 'Gas stations, terrible snacks and a sunset you will remember forever.' },
  { id: 'vegas', name: 'Las Vegas', years: [1950, 2300], cost: 1500, scene: 'casino', line: 'What happened in Vegas stays in Vegas. Your wallet is also staying there.' },
  { id: 'themePark', name: 'a theme park resort', years: [1955, 2300], cost: 2500, scene: 'amusement', line: 'You met a giant mouse and queued for most of a week. Magical.' },
  { id: 'hawaii', name: 'Hawaii', years: [1959, 2300], cost: 3000, scene: 'beach', line: 'Volcanoes, beaches and a lei that smelled like happiness.' },
  { id: 'tokyo', name: 'Tokyo', years: [1964, 2300], cost: 3500, scene: 'travel', line: 'Neon, noodles and a toilet more advanced than your car.', train: [['languages', 1]] },
  { id: 'backpack', name: 'backpacking through Asia', years: [1970, 2300], cost: 2000, scene: 'hiking', line: 'Night buses, temples and a bracelet with your new best friend\'s name on it.', mods: { wisdom: 3 } },
  { id: 'machuPicchu', name: 'Machu Picchu', years: [1950, 2300], cost: 3500, scene: 'hiking', line: 'You reached the lost city at dawn and a llama photobombed your picture.' },
  { id: 'antarctica', name: 'an Antarctic cruise', years: [1970, 2300], cost: 12000, scene: 'blizzard', line: 'A penguin walked up, looked at you, and walked off unimpressed.' },
  { id: 'iceland', name: 'Iceland', years: [2000, 2300], cost: 3500, scene: 'stargazing', line: 'The Northern Lights danced over a hot spring and you cried a little.' },
  { id: 'cityBreak', name: 'a cheap city break', years: [1995, 2300], cost: 400, scene: 'travel', line: 'A two-day blitz of museums, bars and one regrettable kebab.' },
  { id: 'underwater', name: 'an underwater hotel', years: [2040, 2300], cost: 15000, scene: 'beach', line: 'You fell asleep with a shark gliding past the bedroom window.' },
  { id: 'arctic', name: 'the ice-free Arctic coast', years: [2070, 2300], cost: 4000, scene: 'beach', line: 'A beach where glaciers used to be. Lovely, and a little haunting.' },
];
const DEST_BY_ID: Record<string, Dest> = Object.fromEntries(DESTS.map((d) => [d.id, d]));

function destOk(x: Ctx, d: Dest): true | string {
  if (x.year < d.years[0] || x.year > d.years[1]) return 'Not in this era';
  return moneyOk(x, price(x, d.cost));
}

const TRAVEL: ActionDef[] = [
  {
    id: 'le_trip', cat: 'activity', label: 'Take a trip', group: 'Travel', ap: 1,
    desc: 'Pick a destination fit for the age you live in.',
    scene: (opt) => DEST_BY_ID[opt ?? '']?.scene ?? 'travel',
    avail: (x) => (x.c.legal.prison ? false : x.c.age < 16 ? 'Age 16+' : true),
    options: (x): ActionOption[] =>
      DESTS.filter((d) => x.year >= d.years[0] && x.year <= d.years[1]).map((d) => {
        const ok = destOk(x, d);
        return { value: d.id, label: `${d.name[0].toUpperCase()}${d.name.slice(1)} (${x.fmt(price(x, d.cost))})`, disabled: ok === true ? undefined : ok };
      }),
    run: (x, arg) => {
      const d = DEST_BY_ID[optOf(arg) ?? ''];
      if (!d) return 'You packed a bag and went nowhere.';
      const ok = destOk(x, d);
      if (ok !== true) return ok;
      x.spend(price(x, d.cost));
      x.mods({ stress: -8, happiness: 5, depression: -2, ...(d.mods ?? {}) });
      for (const [s, n] of d.train ?? []) x.train(s, n);
      x.train('languages', 1);
      if (!x.hasMemory(`trip_${d.id}`)) x.remember(`trip_${d.id}`, `Travelled to ${d.name} at ${x.c.age}.`, 25);
      const t = tierOf(x, st(x, 'happiness', 'charisma'));
      const tail = t === 'good'
        ? x.pick([' Best trip of your life.', ' You came home with a tan and a new outlook.', ' You made a friend you will write to for years.'])
        : t === 'bad'
          ? x.pick([' Your luggage took a different trip.', ' You were ill for two of the days.', ' It rained the whole time, which was a choice.'])
          : '';
      if (t === 'good') x.mods({ happiness: 4, loneliness: -3 });
      if (t === 'bad') x.mods({ happiness: -4, health: -1 });
      return d.line + tail;
    },
  },
  {
    id: 'le_space', cat: 'activity', label: 'Space tourism', group: 'Travel', ap: 1,
    desc: 'Leave the planet for a while. Bring a sick bag.',
    scene: 'rocket',
    avail: (x) => (x.c.legal.prison || x.year < 2030 ? false : x.c.age < 18 ? 'Age 18+' : x.stat('health') < 30 ? 'Not healthy enough' : true),
    options: (x) => SPACE.filter((o) => x.year >= o.from).map((o) => {
      const cost = price(x, o.cost);
      const ticket = o.id === 'suborbital' && x.hasItem('spaceTicket');
      return { value: o.id, label: `${o.name} (${ticket ? 'ticket in hand' : x.fmt(cost)})`, disabled: ticket ? undefined : x.c.money < cost ? `Costs ${x.fmt(cost)}` : undefined };
    }),
    run: (x, arg) => {
      const o = SPACE.find((s) => s.id === optOf(arg));
      if (!o || x.year < o.from) return 'The launch was scrubbed. Your knees are relieved.';
      const ticket = o.id === 'suborbital' ? x.c.items.find((i) => i.typeId === 'spaceTicket') : undefined;
      if (ticket) loseItem(x, ticket.id);
      else if (!x.spend(price(x, o.cost))) return `You cannot afford it (${x.fmt(price(x, o.cost))}).`;
      x.mods({ happiness: 12, wisdom: 4, stress: -5, fame: o.fame });
      if (!x.hasMemory('le_space')) x.remember('le_space', `Went to space at ${x.c.age}.`, 60);
      if (x.chance(0.15)) { x.mod('health', -4); return `${o.line} Also, you were sick in zero-g, which is a team sport.`; }
      return o.line;
    },
  },
];

const SPACE = [
  { id: 'suborbital', name: 'Suborbital hop', from: 2030, cost: 250000, fame: 2, line: 'Four minutes of weightlessness and the curve of the Earth. You came back changed.' },
  { id: 'orbital', name: 'Orbital hotel stay', from: 2040, cost: 3000000, fame: 5, line: 'Sixteen sunrises a day from a window with no up or down.' },
  { id: 'moon', name: 'Lunar flyby', from: 2055, cost: 15000000, fame: 10, line: 'You saw the far side of the Moon. It does not care about you, and that is freeing.' },
  { id: 'lunarBase', name: 'Holiday at a lunar base', from: 2080, cost: 6000000, fame: 6, line: 'You bounced across the Moon in a suit and wrote your name in the dust.' },
  { id: 'mars', name: 'Mars expedition', from: 2120, cost: 20000000, fame: 12, line: 'Red dust, blue sunsets and a very long way home.' },
];

export const LEISURE_ACTIONS: ActionDef[] = [...NIGHTLIFE, ...CULTURE, ...OUTDOORS, ...SPORT, ...HOME, ...EXTRA, ...ERA, ...TRAVEL];
