import type { Ctx } from '../ctx';
import type { NPC, Relationship, RelType } from '../types';
import { type ActionDef, moneyOk, optOf, price, targetOf } from './common';
import { makeNpc } from '../systems/npcs';

// ------------------------------------------------------------------ helpers

interface Target {
  id: string;
  r: Relationship;
  n: NPC;
  age: number;
}

const FRIENDS: RelType[] = ['friend', 'bestFriend'];
const PALS: RelType[] = ['friend', 'bestFriend', 'colleague', 'acquaintance'];
const FOES: RelType[] = ['rival', 'enemy', 'nemesis'];

function tgt(x: Ctx, arg: string | undefined, types: RelType[]): Target | null {
  const id = targetOf(arg);
  const r = x.rel(id);
  const n = x.npc(id);
  if (!id || !r || !n || !n.alive || !types.includes(r.type)) return null;
  return { id, r, n, age: x.npcAge(n) };
}

function onPal(types: RelType[], o: { min?: number; youMin?: number; from?: number; to?: number; extra?: (x: Ctx, t: Target) => true | string | false } = {}) {
  return (x: Ctx, arg?: string): true | string | false => {
    if (x.c.legal.prison) return false;
    if (o.from !== undefined && x.year < o.from) return false;
    if (o.to !== undefined && x.year > o.to) return false;
    if (o.youMin !== undefined && x.age < o.youMin) return false;
    const t = tgt(x, arg, types);
    if (!t) return false;
    if (o.min !== undefined && t.age < o.min) return false;
    return o.extra ? o.extra(x, t) : true;
  };
}

const cost = (x: Ctx, n: number): number => price(x, n);
const friends = (x: Ctx): Relationship[] => x.rels('friend', 'bestFriend');

function warmFriends(x: Ctx, lo: number, hi: number): number {
  const all = friends(x);
  for (const r of all) x.relMod(r.npcId, x.int(lo, hi), 1);
  return all.length;
}

/** A new acquaintance about your age (adults stay adults, kids meet kids). */
function newFace(x: Ctx, type: RelType = 'acquaintance', affinity = 45): NPC {
  const age = x.age < 18 ? Math.max(5, Math.min(17, x.age + x.int(-1, 1))) : Math.max(18, x.age + x.int(-8, 8));
  const n = makeNpc(x, { age });
  x.addRel(n.id, type, { affinity, trust: 40 });
  return n;
}

const sociable = (x: Ctx, min = 5): true | false => (x.c.legal.prison || x.age < min ? false : true);

// ------------------------------------------------------------------ clubs by era

interface Club {
  value: string;
  label: string;
  scene: string;
  skill: string;
  from?: number;
  to?: number;
  minAge?: number;
  line: string;
}

const CLUBS: Club[] = [
  { value: 'symposium', label: 'A philosophers\' symposium', scene: 'study', skill: 'philosophy', to: 500, minAge: 16, line: 'You argued about virtue until dawn and drank far too much watered wine.' },
  { value: 'temple', label: 'A temple choir', scene: 'holy', skill: 'singing', to: 1500, line: 'Your voice cracked on the high note. The gods were forgiving; the choirmaster was not.' },
  { value: 'guild', label: 'A craft guild', scene: 'factory', skill: 'artisanship', from: 1000, to: 1850, minAge: 14, line: 'The guild welcomed you with a long oath and a longer feast.' },
  { value: 'archery', label: 'An archery society', scene: 'sports', skill: 'archery', from: 1200, to: 1900, line: 'You hit the target once and the club secretary twice.' },
  { value: 'salon', label: 'A literary salon', scene: 'reading', skill: 'writing', from: 1650, to: 1940, minAge: 16, line: 'Witty people said witty things and you nodded at the right moments.' },
  { value: 'chess', label: 'A chess club', scene: 'gaming', skill: 'logic', from: 1800, line: 'An eight-year-old beat you in eleven moves. You have never been more motivated.' },
  { value: 'football', label: 'A football club', scene: 'sports', skill: 'football', from: 1870, line: 'You mostly ran in the wrong direction, enthusiastically.' },
  { value: 'bowling', label: 'A bowling league', scene: 'sports', skill: 'ballSports', from: 1900, minAge: 12, line: 'Your team, the Gutter Kings, lived up to its name.' },
  { value: 'scouts', label: 'The scouts', scene: 'camping', skill: 'selfDefense', from: 1908, minAge: 7, line: 'You earned a badge for knots and another for not crying in the rain.' },
  { value: 'book', label: 'A book club', scene: 'reading', skill: 'writing', from: 1950, minAge: 12, line: 'Nobody finished the book. The wine was finished promptly.' },
  { value: 'running', label: 'A running club', scene: 'sports', skill: 'running', from: 1970, minAge: 12, line: 'Five kilometres at dawn with people who are far too cheerful.' },
  { value: 'drama', label: 'An amateur dramatics society', scene: 'theater', skill: 'acting', from: 1880, minAge: 8, line: 'You were cast as Second Villager and stole the show with one line.' },
  { value: 'hackerspace', label: 'A hackerspace', scene: 'hacker', skill: 'programming', from: 2005, minAge: 12, line: 'You soldered a blinking badge and made three nerdy friends for life.' },
  { value: 'esports', label: 'An esports team', scene: 'gaming', skill: 'gameDesign', from: 2015, minAge: 10, line: 'Your team lost in the quarter-finals to a squad of twelve-year-olds.' },
  { value: 'zerog', label: 'A zero-G dance troupe', scene: 'dance', skill: 'dance', from: 2150, minAge: 12, line: 'You floated, spun and only collided with the ceiling twice.' },
];
const clubsFor = (x: Ctx): Club[] => CLUBS.filter((c) => (c.from === undefined || x.year >= c.from) && (c.to === undefined || x.year <= c.to));

interface Out {
  value: string;
  label: string;
  scene: string;
  cost: number;
  from?: number;
  to?: number;
  line: string;
}

const NIGHTS: Out[] = [
  { value: 'pub', label: 'A pub crawl', scene: 'bar', cost: 60, line: 'Six pubs, one kebab and a friendship bracelet you do not remember buying.' },
  { value: 'dancing', label: 'Dancing', scene: 'party', cost: 50, from: 1900, line: 'You danced until your shoes gave up before you did.' },
  { value: 'karaoke', label: 'Karaoke', scene: 'karaoke', cost: 40, from: 1985, line: 'Your power ballad brought a stranger to tears, possibly of pain.' },
  { value: 'gig', label: 'A gig', scene: 'concert', cost: 70, from: 1955, line: 'Ears ringing, voice gone, completely happy.' },
  { value: 'feast', label: 'A feast at the inn', scene: 'restaurant', cost: 40, to: 1800, line: 'Roast boar, bad songs and a bard who would not stop.' },
];
const nightsFor = (x: Ctx): Out[] => NIGHTS.filter((c) => (c.from === undefined || x.year >= c.from) && (c.to === undefined || x.year <= c.to));

const VOLUNTEER: Out[] = [
  { value: 'kitchen', label: 'Serve at a soup kitchen', scene: 'volunteer', cost: 0, line: 'You ladled four hundred bowls and learned forty names.' },
  { value: 'trees', label: 'Plant trees', scene: 'volunteer', cost: 0, from: 1900, line: 'Muddy knees, blistered hands and a hillside that will be a forest one day.' },
  { value: 'shelter', label: 'Walk shelter dogs', scene: 'pet', cost: 0, from: 1900, line: 'A one-eyed terrier chose you. You are now in trouble.' },
  { value: 'elders', label: 'Visit lonely elders', scene: 'nursingHome', cost: 0, line: 'Mrs. Petrova beat you at cards and told you about her three husbands.' },
  { value: 'tutor', label: 'Tutor kids', scene: 'classroom', cost: 0, from: 1850, line: 'A kid finally understood long division and punched the air.' },
];
const volunteerFor = (x: Ctx): Out[] => VOLUNTEER.filter((c) => c.from === undefined || x.year >= c.from);

// ------------------------------------------------------------------ general (social)

const GENERAL: ActionDef[] = [
  {
    id: 'so_party',
    cat: 'social',
    label: 'Host a party',
    desc: 'Your place, your playlist, your carpet.',
    group: 'Hosting',
    ap: 1,
    scene: (o) => (o === 'dinner' ? 'familyDinner' : 'party'),
    avail: (x) => (sociable(x, 12) ? true : false),
    options: (x) => [
      { value: 'dinner', label: `Dinner party (${x.fmt(cost(x, 120))})`, disabled: x.c.money < cost(x, 120) ? 'Cannot afford' : undefined },
      { value: 'house', label: `House party (${x.fmt(cost(x, 250))})`, disabled: x.c.money < cost(x, 250) ? 'Cannot afford' : undefined },
      { value: 'costume', label: `Costume party (${x.fmt(cost(x, 400))})`, disabled: x.c.money < cost(x, 400) ? 'Cannot afford' : undefined },
    ],
    run: (x, arg) => {
      const o = optOf(arg) ?? 'house';
      const c = cost(x, o === 'dinner' ? 120 : o === 'house' ? 250 : 400);
      if (!x.spend(c)) return 'You cannot afford that.';
      x.train('hospitality', 2);
      warmFriends(x, 3, 7);
      x.mods({ happiness: 4, loneliness: -6, popularity: 2 });
      if (x.chance(0.4)) newFace(x, 'acquaintance', 50);
      if (x.chance(0.2)) {
        x.mods({ stress: 4 });
        return o === 'dinner' ? 'Two guests discovered they had dated the same person. Dessert was electric.' : 'The neighbours called the police at 2 a.m. The police stayed for a drink.';
      }
      if (o === 'dinner') return 'Good food, better conversation, and nobody left before midnight.';
      if (o === 'costume') return 'Three people came as the same pirate. A fourth came as you. It was uncanny.';
      return 'The kitchen became the dance floor. Someone fell asleep in the bath. A legendary night.';
    },
  },
  {
    id: 'so_club',
    cat: 'social',
    label: 'Join a club',
    desc: 'Find your people.',
    group: 'Community',
    ap: 1,
    scene: (o) => CLUBS.find((c) => c.value === o)?.scene ?? 'friends',
    avail: (x) => (sociable(x, 7) ? true : false),
    options: (x) => clubsFor(x).map((c) => ({ value: c.value, label: c.label, disabled: c.minAge && x.age < c.minAge ? `Age ${c.minAge}+` : x.flag(`club_${c.value}`) ? 'Already a member' : undefined })),
    run: (x, arg) => {
      const c = clubsFor(x).find((k) => k.value === optOf(arg)) ?? clubsFor(x)[0];
      if (!c) return 'There are no clubs around.';
      x.setFlag(`club_${c.value}`, x.year);
      x.train(c.skill, 4);
      x.mods({ loneliness: -6, happiness: 3 });
      const n = newFace(x, 'friend', 55);
      return `${c.line} You hit it off with ${n.firstName}.`;
    },
  },
  {
    id: 'so_nightOut',
    cat: 'social',
    label: 'Night out with friends',
    desc: 'Tell no one about the photos.',
    group: 'Going out',
    ap: 1,
    scene: (o) => NIGHTS.find((c) => c.value === o)?.scene ?? 'bar',
    avail: (x) => (x.age < 18 || x.c.legal.prison ? false : friends(x).length ? true : 'You need friends to go out with'),
    options: (x) => nightsFor(x).map((c) => ({ value: c.value, label: `${c.label} (${x.fmt(cost(x, c.cost))})`, disabled: x.c.money < cost(x, c.cost) ? 'Cannot afford' : undefined })),
    run: (x, arg) => {
      const c = nightsFor(x).find((k) => k.value === optOf(arg)) ?? NIGHTS[0];
      if (!x.spend(cost(x, c.cost))) return 'You cannot afford that.';
      warmFriends(x, 3, 8);
      x.mods({ happiness: 5, stress: -5, loneliness: -5, health: -1 });
      if (x.chance(0.15)) {
        x.mods({ publicImage: -1 });
        return 'You woke up with a traffic cone, a new tattoo idea and no memory of either.';
      }
      return c.line;
    },
  },
  {
    id: 'so_gameNight',
    cat: 'social',
    label: 'Host a game night',
    desc: 'Snacks, dice and betrayal.',
    group: 'Hosting',
    ap: 1,
    scene: 'gaming',
    avail: (x) => (sociable(x, 8) ? (friends(x).length ? true : 'You need friends to invite') : false),
    run: (x) => {
      warmFriends(x, 2, 6);
      x.mods({ happiness: 3, stress: -3 });
      x.train('logic', 1);
      const g = x.year < 1600 ? 'knucklebones' : x.year < 1935 ? 'whist' : x.year < 1985 ? 'Monopoly' : x.year < 2030 ? 'a co-op video game' : 'a holographic strategy game';
      return x.chance(0.3) ? `${g} night ended three friendships for one week each.` : `${g} until 2 a.m. You lost spectacularly and had the best time.`;
    },
  },
  {
    id: 'so_volunteer',
    cat: 'social',
    label: 'Volunteer',
    desc: 'Give an afternoon away.',
    group: 'Community',
    ap: 1,
    scene: (o) => VOLUNTEER.find((c) => c.value === o)?.scene ?? 'volunteer',
    avail: (x) => (sociable(x, 10) ? true : false),
    options: (x) => volunteerFor(x).map((c) => ({ value: c.value, label: c.label })),
    run: (x, arg) => {
      const c = volunteerFor(x).find((k) => k.value === optOf(arg)) ?? VOLUNTEER[0];
      x.mods({ karma: 3, happiness: 3, empathy: 2, loneliness: -3, publicImage: 1 });
      x.train('empathyListening', 1);
      if (x.chance(0.3)) newFace(x, 'friend', 55);
      return c.line;
    },
  },
  {
    id: 'so_groupChat',
    cat: 'social',
    label: 'Start a group chat',
    desc: 'Notifications: 487.',
    group: 'Online',
    ap: 1,
    scene: 'friends',
    avail: (x) => (x.year < 2010 || x.age < 10 || x.c.legal.prison ? false : friends(x).length >= 2 ? true : 'You need at least two friends'),
    run: (x) => {
      warmFriends(x, 1, 4);
      x.mods({ loneliness: -4, stress: 1 });
      return x.pick(['The group chat now has a name, an emoji, and 300 messages about where to get pizza.', 'You accidentally sent a message meant for the group chat to your boss. It was about your boss.', 'Someone posted a baby photo of you. The chat has never been more active.']);
    },
  },
  {
    id: 'so_festival',
    cat: 'social',
    label: (x) => (x.year < 1900 ? 'Go to the fair' : 'Go to a festival'),
    desc: 'Lanterns, music and questionable food.',
    group: 'Going out',
    ap: 1,
    scene: 'festival',
    avail: (x) => (sociable(x, 6) ? moneyOk(x, cost(x, 50)) : false),
    run: (x) => {
      x.spend(cost(x, 50));
      warmFriends(x, 1, 4);
      x.mods({ happiness: 5, stress: -4 });
      if (x.chance(0.3)) {
        const n = newFace(x, 'friend', 55);
        return `You lost your group, found ${n.firstName} instead, and spent the night dancing with strangers who became friends.`;
      }
      return x.pick(['You ate something fried on a stick and regret nothing.', 'You won a goldfish and named it after a philosopher.']);
    },
  },
  {
    id: 'so_neighbours',
    cat: 'social',
    label: 'Meet the neighbours',
    desc: 'Knock with a cake.',
    group: 'Community',
    ap: 1,
    scene: 'friends',
    avail: (x) => (sociable(x, 8) ? true : false),
    run: (x) => {
      const n = newFace(x, 'acquaintance', 50);
      x.mods({ loneliness: -2 });
      if (x.chance(0.2)) {
        x.relMod(n.id, -15);
        return `${n.firstName} next door accepted the cake and then complained about your hedge.`;
      }
      return x.pick([`${n.firstName} next door turned out to be delightful and owns a ladder. Perfect neighbour.`, `${n.firstName} invited you in and showed you their collection of antique spoons. For an hour.`]);
    },
  },
  {
    id: 'so_quiz',
    cat: 'social',
    label: 'Pub quiz',
    desc: 'Your team name is a pun.',
    group: 'Going out',
    ap: 1,
    scene: 'bar',
    avail: (x) => (x.year < 1975 || x.age < 18 || x.c.legal.prison ? false : true),
    run: (x) => {
      x.train('history', 1);
      warmFriends(x, 1, 4);
      const win = x.chance(0.15 + x.stat('smarts') / 250);
      if (win) {
        x.money(cost(x, 50));
        return 'Your team won on the tiebreaker: the height of a giraffe. You knew it. You are a legend.';
      }
      return 'You came fourth out of five and won the prize for best team name: "Quiz Akabusi".';
    },
  },
  {
    id: 'so_reconnect',
    cat: 'social',
    label: 'Reconnect with an old friend',
    desc: 'It has been too long.',
    group: 'Community',
    ap: 1,
    scene: 'reunion',
    avail: (x) => (sociable(x, 16) ? (x.rels('friend', 'acquaintance', 'bestFriend').some((r) => r.affinity < 45) ? true : false) : false),
    run: (x) => {
      const r = x.pick(x.rels('friend', 'acquaintance', 'bestFriend').filter((q) => q.affinity < 45));
      if (!r) return 'Everyone is already in touch.';
      x.relMod(r.npcId, x.int(10, 20), 5);
      if (r.type === 'acquaintance' && r.affinity > 50) r.type = 'friend';
      x.mods({ loneliness: -5, happiness: 3 });
      return `You and ${x.first(r.npcId)} picked up exactly where you left off, which was mid-argument about a film.`;
    },
  },
  {
    id: 'so_birthday',
    cat: 'social',
    label: 'Throw yourself a birthday party',
    desc: 'You are the guest of honour.',
    group: 'Hosting',
    ap: 1,
    scene: 'birthday',
    avail: (x) => (sociable(x, 6) ? moneyOk(x, cost(x, 100)) : false),
    run: (x) => {
      x.spend(cost(x, 100));
      const n = warmFriends(x, 2, 6);
      x.mods({ happiness: n ? 5 : -2, loneliness: n ? -5 : 4 });
      if (!n) return 'You blew out the candles alone and ate the whole cake. Next year will be different.';
      return x.pick(['Your friends sang badly, the cake leaned like a tower in Pisa, and it was perfect.', 'Someone hired a magician. The magician was terrible. Everyone agreed it was the best part.']);
    },
  },
  {
    id: 'so_meetup',
    cat: 'social',
    label: 'Go to a meetup',
    desc: 'Strangers with one shared obsession.',
    group: 'Online',
    ap: 1,
    scene: 'friends',
    avail: (x) => (x.year < 2002 || x.age < 16 || x.c.legal.prison ? false : true),
    run: (x) => {
      const topic = x.pick(['sourdough', 'retro synthesizers', 'urban foraging', 'board-game design', 'competitive birdwatching']);
      x.mods({ loneliness: -3 });
      if (x.chance(0.6)) {
        const n = newFace(x, 'friend', 55);
        return `At the ${topic} meetup you met ${n.firstName}, who is even more obsessed than you.`;
      }
      return `The ${topic} meetup was three people and a very enthusiastic organiser. You stayed for the free biscuits.`;
    },
  },
];

// ------------------------------------------------------------------ per friend / colleague / rival

const SPORTS = (x: Ctx): { value: string; label: string }[] => [
  { value: 'run', label: 'Go for a run' },
  ...(x.year >= 1880 ? [{ value: 'tennis', label: 'Tennis' }] : []),
  ...(x.year >= 1870 ? [{ value: 'football', label: 'Kick a ball about' }] : [{ value: 'wrestle', label: 'Wrestling' }]),
  ...(x.year >= 1900 ? [{ value: 'swim', label: 'Swimming' }] : []),
  ...(x.year >= 1990 ? [{ value: 'climb', label: 'Climbing wall' }] : []),
];

const PER: ActionDef[] = [
  {
    id: 'so_drink',
    cat: 'rel',
    label: (x) => (x.age < 18 ? 'Grab a milkshake' : x.year < 1650 ? 'Share a jug of ale' : 'Grab a drink'),
    desc: 'Catch up properly.',
    group: 'Hang out',
    ap: 1,
    scene: (_o, res) => (/milkshake/.test(res) ? 'friends' : 'bar'),
    avail: onPal(PALS, { youMin: 10, min: 10 }),
    run: (x, arg) => {
      const t = tgt(x, arg, PALS)!;
      x.relMod(t.id, x.int(4, 9), 2);
      x.mods({ happiness: 3, stress: -3, loneliness: -3 });
      if (x.age < 18 || t.age < 18) return `You and ${t.n.firstName} split a milkshake and solved the world's problems.`;
      if (t.r.type === 'acquaintance' && t.r.affinity >= 55) {
        t.r.type = 'friend';
        return `One drink with ${t.n.firstName} became four. You are officially friends now.`;
      }
      return x.pick([`${t.n.firstName} told you a secret after the third round. You will take it to the grave.`, `You and ${t.n.firstName} closed the bar and got chips on the way home.`, `${t.n.firstName} cried about their job, you cried about yours. Cheers.`]);
    },
  },
  {
    id: 'so_helpMove',
    cat: 'rel',
    label: 'Help them move',
    desc: 'The ultimate test of friendship.',
    group: 'Favours',
    ap: 1,
    scene: 'moving',
    avail: onPal(FRIENDS, { youMin: 16, min: 18 }),
    run: (x, arg) => {
      const t = tgt(x, arg, FRIENDS)!;
      x.relMod(t.id, x.int(8, 14), 6);
      x.mods({ fitness: 1, stress: 2 });
      return x.chance(0.3) ? `The sofa would not fit through the door. Two hours, one saw and a lot of swearing later, it did.` : `${t.n.firstName} paid you in pizza and eternal gratitude. Mostly pizza.`;
    },
  },
  {
    id: 'so_askFavour',
    cat: 'rel',
    label: 'Ask a favour',
    desc: 'Spend some of that goodwill.',
    group: 'Favours',
    ap: 1,
    scene: (_o, res) => (/no/.test(res) ? 'argument' : 'friends'),
    avail: onPal(['friend', 'bestFriend', 'colleague'], { youMin: 12 }),
    options: () => [
      { value: 'cover', label: 'Cover for you' },
      { value: 'intro', label: 'Introduce you to someone useful' },
      { value: 'lift', label: 'Give you a lift' },
    ],
    run: (x, arg) => {
      const t = tgt(x, arg, ['friend', 'bestFriend', 'colleague'])!;
      const o = optOf(arg);
      const p = 0.3 + t.r.affinity / 160;
      if (!x.chance(p)) {
        x.relMod(t.id, -4);
        return `${t.n.firstName} said no, and seemed a bit put out you asked.`;
      }
      x.relMod(t.id, -2);
      if (o === 'intro') {
        x.train('networking', 3);
        x.mods({ professionalRep: 2 });
        newFace(x, 'acquaintance', 50);
        return `${t.n.firstName} introduced you to someone who knows someone. Doors are opening.`;
      }
      if (o === 'cover') {
        x.mods({ stress: -4 });
        return `${t.n.firstName} told everyone you had a dentist appointment. You owe them one.`;
      }
      return `${t.n.firstName} drove you there and sang along to the radio the whole way.`;
    },
  },
  {
    id: 'so_gossip',
    cat: 'rel',
    label: 'Gossip',
    desc: 'Did you hear about...',
    group: 'Hang out',
    ap: 1,
    scene: (_o, res) => (/spread|back to/.test(res) ? 'scandal' : 'friends'),
    avail: onPal(PALS, { youMin: 8, min: 8 }),
    run: (x, arg) => {
      const t = tgt(x, arg, PALS)!;
      x.train('gossip', 2);
      x.relMod(t.id, x.int(3, 7), -1);
      x.mods({ karma: -1, happiness: 2 });
      if (x.chance(0.15)) {
        x.mods({ popularity: -3 });
        return `What you told ${t.n.firstName} got back to the person you were talking about. Awkward Christmas.`;
      }
      return x.pick([`You and ${t.n.firstName} spent an hour dissecting a mutual friend's new haircut. Delicious.`, `${t.n.firstName} had the real story about the office romance. You gasped audibly.`]);
    },
  },
  {
    id: 'so_sport',
    cat: 'rel',
    label: 'Play sport together',
    desc: 'Friendly competition. Mostly friendly.',
    group: 'Hang out',
    ap: 1,
    scene: 'sports',
    avail: onPal(PALS, { youMin: 6, min: 6 }),
    options: (x) => SPORTS(x),
    run: (x, arg) => {
      const t = tgt(x, arg, PALS)!;
      const o = optOf(arg) ?? 'run';
      const skill = o === 'tennis' ? 'tennis' : o === 'football' ? 'football' : o === 'swim' ? 'swimming' : o === 'climb' ? 'climbing' : o === 'wrestle' ? 'wrestling' : 'running';
      x.train(skill, 3);
      x.mods({ fitness: 2, health: 1, stress: -3 });
      x.relMod(t.id, x.int(3, 8), 1);
      const win = x.chance(0.3 + x.stat('fitness') / 200);
      return win ? `You beat ${t.n.firstName} and were insufferable about it for a week.` : `${t.n.firstName} won easily and bought you a drink out of pity.`;
    },
  },
  {
    id: 'so_roadTrip',
    cat: 'rel',
    label: 'Road trip',
    desc: 'Snacks, bad music, no plan.',
    group: 'Adventures',
    ap: 2,
    scene: 'roadTrip',
    avail: onPal(FRIENDS, { youMin: 18, min: 18, extra: (x) => moneyOk(x, cost(x, 300)) }),
    run: (x, arg) => {
      const t = tgt(x, arg, FRIENDS)!;
      x.spend(cost(x, 300));
      x.relMod(t.id, x.int(10, 16), 5);
      x.mods({ happiness: 7, stress: -6 });
      if (t.r.type === 'friend' && t.r.affinity >= 85) {
        t.r.type = 'bestFriend';
        return `Somewhere between the breakdown and the diner at 3 a.m., ${t.n.firstName} became your best friend.`;
      }
      return x.year < 1910 ? `You and ${t.n.firstName} took a wagon to the coast. The horse was the real hero.` : `You and ${t.n.firstName} got lost, got a flat tyre and got the best story of your lives.`;
    },
  },
  {
    id: 'so_introduce',
    cat: 'rel',
    label: 'Introduce them to someone',
    desc: 'Play matchmaker. What could go wrong?',
    group: 'Favours',
    ap: 1,
    scene: (_o, res) => (/wedding|dating|hit it off/.test(res) ? 'love' : 'blindDate'),
    avail: onPal(FRIENDS, { youMin: 18, min: 18, extra: (_x, t) => (t.n.spouseId ? false : true) }),
    run: (x, arg) => {
      const t = tgt(x, arg, FRIENDS)!;
      x.train('networking', 1);
      if (x.chance(0.4)) {
        x.relMod(t.id, x.int(8, 14), 4);
        return `${t.n.firstName} and your other friend hit it off instantly. You are already planning your wedding speech.`;
      }
      if (x.chance(0.4)) {
        x.relMod(t.id, -4);
        return `${t.n.firstName} described the date as "like interviewing a wall". Matchmaking privileges revoked.`;
      }
      x.relMod(t.id, 2);
      return `${t.n.firstName} and their date became friends instead. Not the plan, but nice.`;
    },
  },
  {
    id: 'so_bestFriend',
    cat: 'rel',
    label: 'Ask to be best friends',
    desc: 'Make it official.',
    group: 'Hang out',
    ap: 1,
    scene: 'friends',
    avail: onPal(['friend'], { youMin: 5, extra: (_x, t) => (t.r.affinity >= 65 ? true : false) }),
    run: (x, arg) => {
      const t = tgt(x, arg, ['friend'])!;
      if (x.chance(0.35 + t.r.affinity / 200)) {
        t.r.type = 'bestFriend';
        x.relMod(t.id, 8, 6);
        x.mods({ happiness: 5, loneliness: -6 });
        return x.age < 13 ? `${t.n.firstName} said yes and you swapped friendship bracelets on the spot.` : `${t.n.firstName} said "I thought we already were". Best friends it is.`;
      }
      x.relMod(t.id, -3);
      return `${t.n.firstName} said they don't really "do" best friends. Fine. FINE.`;
    },
  },
  {
    id: 'so_coffee',
    cat: 'rel',
    label: (x) => (x.year < 1650 ? 'Share a meal' : 'Get coffee'),
    desc: 'Twenty minutes that turns into two hours.',
    group: 'Hang out',
    ap: 1,
    scene: 'friends',
    avail: onPal(PALS, { youMin: 14, min: 14 }),
    run: (x, arg) => {
      const t = tgt(x, arg, PALS)!;
      x.relMod(t.id, x.int(3, 7), 2);
      x.mods({ stress: -2, loneliness: -2 });
      if (t.r.type === 'acquaintance' && t.r.affinity >= 55) {
        t.r.type = 'friend';
        return `Coffee with ${t.n.firstName} became a standing date. You are friends now.`;
      }
      return x.pick([`${t.n.firstName} talked about their sourdough starter for forty minutes. You let them.`, `You and ${t.n.firstName} stayed until the café stacked the chairs around you.`]);
    },
  },
  {
    id: 'so_lend',
    cat: 'rel',
    label: 'Lend them money',
    desc: 'You may never see it again.',
    group: 'Favours',
    ap: 1,
    scene: 'moneyDown',
    avail: onPal(['friend', 'bestFriend', 'colleague'], { youMin: 16, min: 16 }),
    options: (x) => [50, 500, 5000].map((v) => ({ value: String(v), label: x.fmt(cost(x, v)), disabled: x.c.money < cost(x, v) ? 'Cannot afford' : undefined })),
    run: (x, arg) => {
      const t = tgt(x, arg, ['friend', 'bestFriend', 'colleague'])!;
      const amt = cost(x, Number(optOf(arg)) || 50);
      if (!x.spend(amt)) return 'You cannot afford that.';
      t.n.wealth += amt;
      x.relMod(t.id, x.int(6, 12), 5);
      if (x.chance(0.4 + t.n.karma / 300)) {
        x.money(amt);
        return `${t.n.firstName} paid you back in full, with a thank-you card. A rare and beautiful thing.`;
      }
      x.mods({ karma: 2 });
      return `${t.n.firstName} swore they would pay you back "next month". Which month was not specified.`;
    },
  },
  {
    id: 'so_celebrate',
    cat: 'rel',
    label: 'Celebrate their birthday',
    desc: 'Cake, candles and an embarrassing song.',
    group: 'Hang out',
    ap: 1,
    scene: 'birthday',
    avail: onPal(FRIENDS, { youMin: 5 }),
    run: (x, arg) => {
      const t = tgt(x, arg, FRIENDS)!;
      x.relMod(t.id, x.int(6, 11), 3);
      x.mods({ happiness: 3 });
      return x.chance(0.3) ? `You organised a surprise party. ${t.n.firstName} screamed, dropped their keys and then hugged everyone.` : `You turned up with a lopsided cake and ${t.n.firstName} declared it the best one they ever had.`;
    },
  },
  {
    id: 'so_support',
    cat: 'rel',
    label: 'Be there for them',
    desc: 'They are going through something.',
    group: 'Hang out',
    ap: 1,
    scene: 'calm',
    avail: onPal(FRIENDS, { youMin: 8 }),
    run: (x, arg) => {
      const t = tgt(x, arg, FRIENDS)!;
      x.train('empathyListening', 3);
      x.relMod(t.id, x.int(8, 14), 8);
      x.mods({ empathy: 2, karma: 2 });
      return x.pick([`You just listened. ${t.n.firstName} said it was exactly what they needed.`, `You turned up with soup and stayed for the whole box set. ${t.n.firstName} will not forget it.`]);
    },
  },
  {
    id: 'so_hike',
    cat: 'rel',
    label: 'Go hiking together',
    desc: 'Mountains, blisters, views.',
    group: 'Adventures',
    ap: 1,
    scene: (_o, res) => (/tent|camp/.test(res) ? 'camping' : 'hiking'),
    avail: onPal(PALS, { youMin: 12, min: 12 }),
    run: (x, arg) => {
      const t = tgt(x, arg, PALS)!;
      x.train('mountaineering', 1);
      x.relMod(t.id, x.int(5, 10), 3);
      x.mods({ fitness: 2, stress: -5, health: 1 });
      return x.chance(0.4) ? `You and ${t.n.firstName} camped under the stars. The tent collapsed at 3 a.m. You laughed until sunrise.` : `You and ${t.n.firstName} reached the summit just as the clouds parted. Neither of you said anything for a while.`;
    },
  },
  {
    id: 'so_karaoke',
    cat: 'rel',
    label: 'Karaoke duet',
    desc: 'A power ballad, obviously.',
    group: 'Hang out',
    ap: 1,
    scene: 'karaoke',
    avail: onPal(FRIENDS, { youMin: 12, min: 12, from: 1985 }),
    run: (x, arg) => {
      const t = tgt(x, arg, FRIENDS)!;
      x.train('singing', 2);
      x.relMod(t.id, x.int(4, 9), 2);
      x.mods({ happiness: 4, confidence: 2 });
      return `You and ${t.n.firstName} murdered a power ballad. The crowd demanded an encore, or possibly an apology.`;
    },
  },
  {
    id: 'so_study',
    cat: 'rel',
    label: 'Study together',
    desc: 'Flashcards and snacks.',
    group: 'Hang out',
    ap: 1,
    scene: 'study',
    avail: onPal(FRIENDS, { youMin: 8, min: 8, extra: (x, t) => (x.age <= 25 && t.age <= 25 ? true : false) }),
    run: (x, arg) => {
      const t = tgt(x, arg, FRIENDS)!;
      x.mod('smarts', x.chance(0.6) ? 1 : 0);
      x.relMod(t.id, x.int(3, 7), 1);
      return x.chance(0.4) ? `You and ${t.n.firstName} studied for ten minutes and then made a very detailed plan for a band.` : `You quizzed each other until ${t.n.firstName} could recite the periodic table backwards.`;
    },
  },
  {
    id: 'so_lunch',
    cat: 'rel',
    label: 'Lunch together',
    desc: 'Out of the office for one glorious hour.',
    group: 'Work friends',
    ap: 1,
    scene: 'restaurant',
    avail: onPal(['colleague', 'boss'], { youMin: 16 }),
    run: (x, arg) => {
      const t = tgt(x, arg, ['colleague', 'boss'])!;
      x.relMod(t.id, x.int(4, 8), 2);
      x.train('networking', 1);
      if (t.r.type === 'boss') x.mods({ professionalRep: 1 });
      if (t.r.type === 'colleague' && t.r.affinity >= 70 && x.chance(0.4)) {
        t.r.type = 'friend';
        return `Lunch with ${t.n.firstName} ran an hour over. You are proper friends now, not just work friends.`;
      }
      return `You and ${t.n.firstName} found the one good sandwich place near the office and swore each other to secrecy.`;
    },
  },
  {
    id: 'so_ventBoss',
    cat: 'rel',
    label: 'Complain about the boss',
    desc: 'Bonding through shared suffering.',
    group: 'Work friends',
    ap: 1,
    scene: (_o, res) => (/overheard|heard/.test(res) ? 'scandal' : 'friends'),
    avail: onPal(['colleague'], { youMin: 16, extra: (x) => (x.employed ? true : false) }),
    run: (x, arg) => {
      const t = tgt(x, arg, ['colleague'])!;
      x.relMod(t.id, x.int(5, 9), 3);
      x.mods({ stress: -4 });
      if (x.chance(0.12)) {
        x.mods({ professionalRep: -4, stress: 6 });
        return 'The boss was in the toilet cubicle and heard everything. Your next review will be interesting.';
      }
      return `You and ${t.n.firstName} did a devastating impression of the boss's email sign-off. Therapeutic.`;
    },
  },
  {
    id: 'so_challenge',
    cat: 'rel',
    label: 'Challenge them',
    desc: 'Settle it once and for all.',
    group: 'Rivals',
    ap: 1,
    scene: (o) => (o === 'duel' ? 'duel' : o === 'debate' ? 'meeting' : o === 'chess' ? 'gaming' : 'sports'),
    avail: onPal(FOES, { youMin: 10, min: 10 }),
    options: (x) => [
      { value: 'race', label: 'A race' },
      { value: 'chess', label: x.year < 600 ? 'A board game' : 'Chess' },
      { value: 'debate', label: 'A public debate' },
      ...(x.year >= 1500 && x.year <= 1860 && x.age >= 18 ? [{ value: 'duel', label: 'A duel at first blood' }] : []),
    ],
    run: (x, arg) => {
      const t = tgt(x, arg, FOES)!;
      const o = optOf(arg) ?? 'race';
      const stat = o === 'race' ? x.stat('fitness') : o === 'chess' ? x.stat('smarts') : o === 'debate' ? x.stat('charisma') : x.skill('fencing') + x.stat('fitness') / 2;
      const win = x.chance(0.2 + stat / 160);
      x.mods({ ego: win ? 4 : -3, popularity: win ? 2 : -1 });
      if (o === 'race') x.train('running', 2);
      if (o === 'debate') x.train('publicSpeaking', 2);
      if (o === 'duel') {
        x.train('fencing', 3);
        if (!win) x.mods({ health: -8, pain: 6 });
        x.relMod(t.id, win ? 5 : -5, win ? 5 : 0);
        return win ? `At dawn your blade nicked ${t.n.firstName}'s sleeve. Honour satisfied; respect, grudgingly, earned.` : `${t.n.firstName} drew first blood from your arm. You will wear the scar and the shame.`;
      }
      x.relMod(t.id, win ? 3 : -4);
      return win ? `You beat ${t.n.firstName} fair and square. They demanded a rematch before you finished gloating.` : `${t.n.firstName} won and did a little dance. You will remember that dance forever.`;
    },
  },
  {
    id: 'so_rivalPrank',
    cat: 'rel',
    label: 'Prank your rival',
    desc: 'Harmless. Mostly.',
    group: 'Rivals',
    ap: 1,
    scene: (_o, res) => (/caught|blamed/.test(res) ? 'argument' : 'friends'),
    avail: onPal(FOES, { youMin: 8, min: 8 }),
    run: (x, arg) => {
      const t = tgt(x, arg, FOES)!;
      x.train('comedy', 1);
      const pr = x.year < 1900 ? 'filled their boots with porridge' : x.year < 1990 ? 'wrapped their car in newspaper' : 'set their autocorrect to change every "the" to "potato"';
      if (x.chance(0.3 - x.skill('deception') / 400)) {
        x.relMod(t.id, -10);
        x.mods({ popularity: -2 });
        return `You ${pr}, but you got caught. ${t.n.firstName} is plotting something worse.`;
      }
      x.relMod(t.id, -3);
      x.mods({ happiness: 4, popularity: 1 });
      return `You ${pr}. ${t.n.firstName} has no idea who did it. Everyone else does.`;
    },
  },
  {
    id: 'so_truce',
    cat: 'rel',
    label: 'Offer a truce',
    desc: 'Life is too short for this.',
    group: 'Rivals',
    ap: 1,
    scene: (_o, res) => (/hand|truce/.test(res) ? 'reunion' : 'argument'),
    avail: onPal(FOES, { youMin: 8 }),
    run: (x, arg) => {
      const t = tgt(x, arg, FOES)!;
      x.train('conflictResolution', 2);
      x.train('diplomacy', 1);
      const p = 0.2 + t.r.affinity / 150 + x.skill('conflictResolution') / 250 + x.stat('empathy') / 400 - (t.r.type === 'nemesis' ? 0.2 : 0);
      if (x.chance(Math.max(0.05, p))) {
        x.addRel(t.id, 'acquaintance', { affinity: Math.max(40, t.r.affinity + 20), trust: Math.max(35, t.r.trust + 10) });
        x.mods({ stress: -6, karma: 3 });
        return `${t.n.firstName} shook your hand. The truce holds; you even laughed about the old days.`;
      }
      x.relMod(t.id, -2);
      x.mods({ ego: -2 });
      return `${t.n.firstName} laughed in your face. Fine. The war continues.`;
    },
  },
  {
    id: 'so_rumour',
    cat: 'rel',
    label: 'Spread a rumour about them',
    desc: 'Petty? Yes. Satisfying? Also yes.',
    group: 'Rivals',
    ap: 1,
    scene: 'scandal',
    avail: onPal(FOES, { youMin: 10 }),
    run: (x, arg) => {
      const t = tgt(x, arg, FOES)!;
      x.train('gossip', 2);
      x.mods({ karma: -3 });
      if (x.chance(0.25)) {
        x.mods({ popularity: -4, publicImage: -2 });
        x.relMod(t.id, -10);
        return `The rumour was traced back to you within a day. ${t.n.firstName} now looks like the victim.`;
      }
      x.relMod(t.id, -6);
      x.mods({ popularity: 1 });
      return `By Friday, everyone "knew" ${t.n.firstName} had been banned from a buffet. You said nothing. Very loudly.`;
    },
  },
  {
    id: 'so_inviteOut',
    cat: 'rel',
    label: 'Invite them out',
    desc: 'Turn an acquaintance into a friend.',
    group: 'Hang out',
    ap: 1,
    scene: 'friends',
    avail: onPal(['acquaintance', 'colleague'], { youMin: 6 }),
    run: (x, arg) => {
      const t = tgt(x, arg, ['acquaintance', 'colleague'])!;
      if (x.chance(0.35 + x.stat('charisma') / 250 + t.r.affinity / 300)) {
        x.addRel(t.id, 'friend', { affinity: Math.max(55, t.r.affinity + 10) });
        x.mods({ loneliness: -4, happiness: 2 });
        return `${t.n.firstName} said yes, and by the end of the night you were finishing each other's jokes.`;
      }
      x.relMod(t.id, 1);
      return `${t.n.firstName} was busy. Washing their hair. For the third week running.`;
    },
  },
  {
    id: 'so_videoGames',
    cat: 'rel',
    label: (x) => (x.year < 1975 ? 'Play board games' : 'Play video games together'),
    desc: 'One more round.',
    group: 'Hang out',
    ap: 1,
    scene: 'gaming',
    avail: onPal(FRIENDS, { youMin: 6, min: 6 }),
    run: (x, arg) => {
      const t = tgt(x, arg, FRIENDS)!;
      x.relMod(t.id, x.int(3, 8), 1);
      x.mods({ happiness: 3, stress: -3 });
      return x.chance(0.3) ? `${t.n.firstName} rage-quit and then came back five minutes later as if nothing happened.` : `You and ${t.n.firstName} played until the sun came up. Your eyes are square now.`;
    },
  },
];

export const SOCIAL_ACTIONS: ActionDef[] = [...GENERAL, ...PER];
