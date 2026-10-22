import type { Ctx } from '../ctx';
import type { NPC, Relationship, RelType } from '../types';
import { type ActionDef, type ActionOption, freeAdult, moneyOk, optOf, price, targetOf } from './common';
import { attractedTo, attraction, breakUp, compatibility, divorce, propose, startDating } from '../systems/relationships';
import { makeNpc } from '../systems/npcs';

// ------------------------------------------------------------------ helpers

interface Target {
  id: string;
  r: Relationship;
  n: NPC;
  age: number;
}

const LOVERS: RelType[] = ['spouse', 'partner', 'affair'];
const STEADY: RelType[] = ['spouse', 'partner'];

function tgt(x: Ctx, arg: string | undefined, types: RelType[]): Target | null {
  const id = targetOf(arg);
  const r = x.rel(id);
  const n = x.npc(id);
  if (!id || !r || !n || !n.alive || !types.includes(r.type)) return null;
  return { id, r, n, age: x.npcAge(n) };
}

/** Per-person romance availability: you and they are adults, you are free, and they are the right kind of person. */
function onLover(types: RelType[], extra?: (x: Ctx, t: Target) => true | string | false) {
  return (x: Ctx, arg?: string): true | string | false => {
    if (x.age < 18 || x.c.legal.prison) return false;
    const t = tgt(x, arg, types);
    if (!t || t.age < 18) return false;
    return extra ? extra(x, t) : true;
  };
}

/** Dating-market availability: adult, free, interested, and single. */
function single(x: Ctx): true | string | false {
  const a = freeAdult(x);
  if (a !== true) return a;
  if (x.c.sexuality === 'asexual') return 'Not looking for romance';
  if (x.lover()) return 'You are already seeing someone';
  return true;
}

const cost = (x: Ctx, n: number): number => price(x, n);
const costOk = (x: Ctx, n: number): true | string => moneyOk(x, cost(x, n));

function bond(x: Ctx, t: Target): number {
  return (t.r.affinity + t.r.compatibility) / 200 + x.stat('charisma') / 500 - x.stat('romanticCynicism') / 600;
}

/** Someone your character is attracted to, always an adult. */
function prospect(x: Ctx, spread = 6, wealth?: number): NPC {
  const c = x.c;
  let gender: NPC['gender'] = c.gender === 'male' ? 'female' : 'male';
  if (c.sexuality === 'gay') gender = c.gender === 'nonbinary' ? x.pick(['male', 'female'] as const) : c.gender;
  if (c.sexuality === 'bisexual') gender = x.pick(['male', 'female'] as const);
  return makeNpc(x, {
    gender,
    age: Math.max(18, x.age + x.int(-spread, spread)),
    sexuality: c.sexuality === 'straight' || c.sexuality === 'asexual' ? 'straight' : c.sexuality,
    wealth,
  });
}

/** Meet someone; on a spark, start dating. Returns the outcome. */
function meet(x: Ctx, n: NPC, spark: number, how: string): string {
  const p = spark + attraction(x, n) / 400 + x.skill('seduction') / 400 + x.stat('confidence') / 500;
  if (!x.chance(Math.min(0.85, Math.max(0.05, p)))) {
    x.addRel(n.id, 'acquaintance', { affinity: x.int(30, 50), trust: 40 });
    x.mods({ confidence: -1 });
    return `${how} ${n.firstName} was lovely, but there was no spark. You swapped polite goodbyes.`;
  }
  const res = startDating(x, n.id);
  x.train('charm', 1);
  if (x.rel(n.id)?.type === 'partner' || x.rel(n.id)?.type === 'affair') return `${how} ${res}`;
  x.addRel(n.id, 'acquaintance', { affinity: x.int(35, 55), trust: 40 });
  return `${how} ${res}`;
}

/** An affair or illicit evening may be seen. */
function caught(x: Ctx, t: Target, p: number): string {
  if (t.r.type !== 'affair') return '';
  const disc = Number(t.r.meta.discretion ?? 50);
  if (!x.chance(Math.max(0.02, p * (1.3 - disc / 100)))) return '';
  const main = x.lover();
  if (main) {
    x.relMod(main.npcId, -25, -35);
    return ` Unfortunately, ${x.first(main.npcId)} found a receipt that did not add up.`;
  }
  x.mods({ publicImage: -3 });
  return ' A neighbour definitely saw you.';
}

function sinIfAffair(x: Ctx, t: Target): void {
  if (t.r.type === 'affair') x.mods({ karma: -1, sin: 1, stress: 2 });
}

// ------------------------------------------------------------------ date venues

interface Venue {
  value: string;
  label: string | ((y: number) => string);
  cost: number;
  scene: string;
  from?: number;
  to?: number;
  line: string;
}

const VENUES: Venue[] = [
  { value: 'walk', label: 'A moonlit walk', cost: 0, scene: 'romance', line: 'You walked until the streets ran out and kept talking anyway.' },
  { value: 'picnic', label: 'A picnic', cost: 20, scene: 'picnic', line: 'The ants were uninvited, but everything else was perfect.' },
  { value: 'amphi', label: 'The amphitheatre', cost: 25, scene: 'theater', to: 400, line: 'You held hands through the tragedy and laughed through the satire.' },
  { value: 'tavern', label: 'Supper at the tavern', cost: 30, scene: 'bar', to: 1850, line: 'The stew was suspicious; the company was not.' },
  { value: 'fair', label: 'The market fair', cost: 15, scene: 'festival', from: 800, to: 1850, line: 'You won a ribbon at the ring toss and gave it away at once.' },
  { value: 'ball', label: 'A grand ball', cost: 200, scene: 'royalBall', from: 1600, to: 1914, line: 'You danced every quadrille and ignored every chaperone.' },
  { value: 'theatre', label: 'The theatre', cost: 80, scene: 'theater', from: 1580, line: 'Neither of you remembers the play.' },
  { value: 'restaurant', label: 'A fancy restaurant', cost: 150, scene: 'date', from: 1850, line: 'Candles, a good bottle and a waiter who knew when to vanish.' },
  { value: 'dancehall', label: 'The dance hall', cost: 30, scene: 'dance', from: 1900, to: 1970, line: 'The band played late and you both stepped on each other gracefully.' },
  { value: 'movies', label: (y) => (y < 1950 ? 'The picture house' : 'The movies'), cost: 30, scene: 'cinema', from: 1910, line: 'You shared the armrest, which in this economy is commitment.' },
  { value: 'drivein', label: 'The drive-in', cost: 25, scene: 'cinema', from: 1950, to: 1990, line: 'You missed most of the film. The popcorn survived.' },
  { value: 'disco', label: 'A disco', cost: 40, scene: 'party', from: 1974, to: 1986, line: 'You owned the dance floor for one entire song.' },
  { value: 'concert', label: 'A concert', cost: 120, scene: 'concert', from: 1960, line: 'You screamed the chorus together and lost your voices happily.' },
  { value: 'karaoke', label: 'Karaoke', cost: 40, scene: 'karaoke', from: 1990, line: 'Your duet was a crime, but a romantic one.' },
  { value: 'escape', label: 'An escape room', cost: 60, scene: 'amusement', from: 2012, line: 'You escaped with ten seconds to spare and a new respect for each other.' },
  { value: 'vr', label: 'A virtual-reality date', cost: 80, scene: 'gadget', from: 2035, line: 'You rode a dragon over a fake Paris and held very real hands.' },
  { value: 'orbital', label: 'Dinner in orbit', cost: 3000, scene: 'rocket', from: 2150, line: 'Earth rose over the dessert course. Hard to top.' },
];

const venuesFor = (x: Ctx): Venue[] => VENUES.filter((v) => (v.from === undefined || x.year >= v.from) && (v.to === undefined || x.year <= v.to));
const venueLabel = (v: Venue, y: number): string => (typeof v.label === 'function' ? v.label(y) : v.label);

interface Trip {
  value: string;
  label: string;
  cost: number;
  scene: string;
  from?: number;
  line: string;
}

const GETAWAYS: Trip[] = [
  { value: 'inn', label: 'A countryside inn', cost: 300, scene: 'romance', line: 'Rain on the roof, a fire in the grate and nowhere to be.' },
  { value: 'sea', label: 'The seaside', cost: 600, scene: 'beach', line: 'Sandy, sunburnt and absurdly happy.' },
  { value: 'city', label: 'A city break', cost: 900, scene: 'travel', from: 1850, line: 'You got lost on purpose and found a café you will talk about for years.' },
  { value: 'abroad', label: 'Somewhere abroad', cost: 2500, scene: 'travel', from: 1955, line: 'New language, new food, same favourite person.' },
  { value: 'cabin', label: 'A mountain cabin', cost: 700, scene: 'camping', from: 1900, line: 'No signal, plenty of blankets, and the night was long.' },
  { value: 'moon', label: 'A lunar resort', cost: 40000, scene: 'moonLanding', from: 2120, line: 'Low gravity, high romance.' },
];
const tripsFor = (x: Ctx): Trip[] => GETAWAYS.filter((t) => t.from === undefined || x.year >= t.from);

function costOpts<T extends { value: string; label: string | ((y: number) => string); cost: number }>(x: Ctx, list: T[]): ActionOption[] {
  return list.map((v) => {
    const c = cost(x, v.cost);
    const label = typeof v.label === 'function' ? v.label(x.year) : v.label;
    return { value: v.value, label: c > 0 ? `${label} (${x.fmt(c)})` : label, disabled: x.c.money < c ? 'Cannot afford' : undefined };
  });
}

// ------------------------------------------------------------------ general (Love app)

const GENERAL: ActionDef[] = [
  {
    id: 'ro_datingApp',
    cat: 'romance',
    label: 'Swipe on a dating app',
    desc: 'Profiles, photos and a little thumb exercise.',
    group: 'Meet someone',
    ap: 1,
    scene: 'datingApp',
    avail: (x) => (x.year < 2009 ? false : single(x)),
    options: () => [
      { value: 'casual', label: 'Swipe on the sofa' },
      { value: 'effort', label: 'Rewrite your profile first' },
    ],
    run: (x, arg) => {
      const effort = optOf(arg) === 'effort';
      if (effort) x.train('writing', 1);
      const n = prospect(x, 7);
      if (x.chance(0.2)) {
        x.mods({ romanticCynicism: 2, happiness: -1 });
        return x.pick(['Three matches, two ghosts and one person who only wanted to sell you crypto.', 'You matched with your dentist. You both unmatched in silence.', 'An hour of swiping left you with sore thumbs and zero conversations.']);
      }
      return meet(x, n, effort ? 0.2 : 0.1, `It's a match! Coffee with`);
    },
  },
  {
    id: 'ro_personalAd',
    cat: 'romance',
    label: 'Place a personal ad',
    desc: 'A few lines in the newspaper. Choose every word carefully.',
    group: 'Meet someone',
    ap: 1,
    scene: 'loveLetter',
    avail: (x) => (x.year < 1900 || x.year > 2008 ? false : single(x) === true ? costOk(x, 15) : single(x)),
    run: (x) => {
      x.spend(cost(x, 15));
      x.train('writing', 1);
      if (x.chance(0.25 - x.skill('writing') / 600)) {
        x.mods({ happiness: -2 });
        return 'Your ad ran next to a lost-goat notice. Only the goat owner wrote back.';
      }
      return meet(x, prospect(x, 8), 0.1, 'A letter arrived in careful handwriting. You met');
    },
  },
  {
    id: 'ro_matchmaker',
    cat: 'romance',
    label: (x) => (x.year < 1900 ? 'Visit the matchmaker' : 'Hire a matchmaker'),
    desc: 'A professional with opinions about your posture.',
    group: 'Meet someone',
    ap: 1,
    scene: 'blindDate',
    avail: (x) => (single(x) === true ? costOk(x, 400) : single(x)),
    run: (x) => {
      x.spend(cost(x, 400));
      const rich = ['aristocracy', 'royalty', 'wealthy'].includes(x.c.familyStatus);
      const n = prospect(x, 5, rich ? x.int(200000, 5000000) : undefined);
      return meet(x, n, 0.25, `The matchmaker sighed at your shoes and introduced you to`);
    },
  },
  {
    id: 'ro_singlesNight',
    cat: 'romance',
    label: 'Go to a singles night',
    desc: 'Name tags, cheap wine, brave faces.',
    group: 'Meet someone',
    ap: 1,
    scene: 'party',
    avail: (x) => (x.year < 1960 ? false : single(x)),
    run: (x) => {
      x.mods({ loneliness: -2 });
      if (x.stat('confidence') < 30 && x.chance(0.4)) return 'You spent the night guarding the snack table. The crisps were excellent.';
      return meet(x, prospect(x), 0.12, 'Your name tag said "Hello!" and so did');
    },
  },
  {
    id: 'ro_speedDating',
    cat: 'romance',
    label: 'Try speed dating',
    desc: 'Seven minutes per soulmate.',
    group: 'Meet someone',
    ap: 1,
    scene: 'date',
    avail: (x) => (x.year < 1998 ? false : single(x) === true ? costOk(x, 40) : single(x)),
    run: (x) => {
      x.spend(cost(x, 40));
      x.train('charm', 2);
      const best = [prospect(x), prospect(x), prospect(x)].sort((a, b) => attraction(x, b) - attraction(x, a))[0];
      return meet(x, best, 0.15, 'Twelve dates in ninety minutes. The bell rang too soon with');
    },
  },
  {
    id: 'ro_flirtBar',
    cat: 'romance',
    label: (x) => (x.year < 1700 ? 'Flirt at the tavern' : 'Flirt at a bar'),
    desc: 'A look across the room. Risky if you are already spoken for.',
    group: 'Meet someone',
    ap: 1,
    scene: 'flirt',
    avail: (x) => {
      const a = freeAdult(x);
      if (a !== true) return a;
      return x.c.sexuality === 'asexual' ? 'Not looking for romance' : true;
    },
    run: (x) => {
      x.train('seduction', 2);
      const n = prospect(x);
      const p = 0.25 + x.stat('looks') / 400 + x.stat('charisma') / 400 + x.skill('seduction') / 300;
      if (!x.chance(Math.min(0.8, p))) {
        x.mods({ confidence: -2 });
        return x.pick([`Your best line made ${n.firstName} laugh, but not in the good way.`, `You winked at ${n.firstName}. ${n.firstName} asked if you had something in your eye.`, 'You bought a drink for someone whose partner then arrived. Large partner.']);
      }
      x.mods({ confidence: 3, happiness: 2 });
      const main = x.lover();
      if (main) {
        if (x.chance(0.45)) {
          x.addRel(n.id, 'affair', { affinity: 55, trust: 40, attraction: attraction(x, n), compatibility: compatibility(x, n), meta: { discretion: 50 } });
          x.secret(`affair_${n.id}`, `An affair with ${x.name(n)}`, 5);
          x.mods({ karma: -4, sin: 3 });
          return `One drink with ${n.firstName} turned into a secret. ${x.first(main.npcId)} thinks you were working late.`;
        }
        x.addRel(n.id, 'acquaintance', { affinity: 45 });
        return `${n.firstName} slipped you their number. You put it in your pocket and felt guilty all the way home.`;
      }
      return meet(x, n, 0.3, `${n.firstName} laughed at your joke. You walked them home.`);
    },
  },
  {
    id: 'ro_blindDate',
    cat: 'romance',
    label: 'Agree to a blind date',
    desc: 'A friend swears you will love them.',
    group: 'Meet someone',
    ap: 1,
    scene: 'blindDate',
    avail: (x) => (x.year < 1900 ? false : single(x)),
    run: (x) => {
      const n = prospect(x);
      if (x.chance(0.2)) {
        x.mods({ happiness: -2 });
        return `${n.firstName} spent the entire meal describing their ex. You learned a lot about Gary.`;
      }
      return meet(x, n, 0.18, 'Your friend was right, for once. You hit it off with');
    },
  },
  {
    id: 'ro_ball',
    cat: 'romance',
    label: 'Attend the season ball',
    desc: 'Gloves, gowns and a dance card to fill.',
    group: 'Meet someone',
    ap: 1,
    scene: 'royalBall',
    avail: (x) => (x.year < 1600 || x.year > 1914 ? false : single(x) === true ? costOk(x, 250) : single(x)),
    run: (x) => {
      x.spend(cost(x, 250));
      x.train('dance', 2);
      x.train('etiquette', 2);
      const rich = ['aristocracy', 'royalty', 'wealthy'].includes(x.c.familyStatus);
      return meet(x, prospect(x, 5, rich ? x.int(100000, 3000000) : undefined), 0.15, 'Your dance card filled, and one name appeared twice:');
    },
  },
  {
    id: 'ro_penPal',
    cat: 'romance',
    label: 'Write to a pen pal',
    desc: 'Romance at the speed of the post.',
    group: 'Meet someone',
    ap: 1,
    scene: 'loveLetter',
    avail: (x) => (x.year < 1750 || x.year > 2005 ? false : single(x)),
    run: (x) => {
      x.train('writing', 2);
      x.mods({ loneliness: -3 });
      const n = prospect(x, 8);
      if (x.chance(0.5)) {
        x.addRel(n.id, 'friend', { affinity: 55, trust: 50 });
        return `Letters with ${n.firstName} became the best part of your month. Friends, for now.`;
      }
      return meet(x, n, 0.15, 'After forty letters you finally met');
    },
  },
  {
    id: 'ro_chatRoom',
    cat: 'romance',
    label: 'Flirt in a chat room',
    desc: 'A/S/L? The dial-up tone of destiny.',
    group: 'Meet someone',
    ap: 1,
    scene: 'internet',
    avail: (x) => (x.year < 1995 || x.year > 2008 ? false : single(x)),
    run: (x) => {
      const n = prospect(x, 6);
      if (x.chance(0.25)) return 'Your soulmate "xXDarkAngelXx" turned out to be a bored fifty-year-old named Keith. You logged off forever.';
      return meet(x, n, 0.12, 'After a month of midnight messages, you met in real life:');
    },
  },
  {
    id: 'ro_valentine',
    cat: 'romance',
    label: "Celebrate Valentine's Day",
    desc: 'Roses, chocolates and inflated prices.',
    group: 'Together',
    ap: 1,
    scene: 'valentine',
    avail: (x) => {
      const a = freeAdult(x);
      if (a !== true) return a;
      if (x.year < 1800) return false;
      const l = x.lover();
      return l && x.npc(l.npcId) && x.npcAge(x.npc(l.npcId)!) >= 18 ? costOk(x, 60) : 'You need a partner';
    },
    run: (x) => {
      const l = x.lover();
      if (!l) return 'Your date is a box of chocolates. It never disappoints.';
      x.spend(cost(x, 60));
      const good = x.chance(0.5 + l.affinity / 250);
      x.relMod(l.npcId, good ? 7 : 2, 2);
      x.mods({ happiness: good ? 5 : 1 });
      return good ? `${x.first(l.npcId)} got you the exact same card. Clearly meant to be.` : `Every restaurant was booked, so you shared takeaway on the floor. ${x.first(l.npcId)} called it the best one yet.`;
    },
  },
  {
    id: 'ro_getOverEx',
    cat: 'romance',
    label: 'Get over an ex',
    desc: 'Delete the photos. Keep the lessons.',
    group: 'Heart',
    ap: 1,
    scene: 'lonely',
    avail: (x) => {
      const a = freeAdult(x);
      if (a !== true) return a;
      return x.rels('ex').length ? true : false;
    },
    run: (x) => {
      x.mods({ romanticCynicism: -4, happiness: 3, depression: -2, resilience: 2 });
      const ex = x.pick(x.rels('ex'));
      ex.affinity = Math.max(0, ex.affinity - 5);
      return x.pick([`You boxed up ${x.first(ex.npcId)}'s hoodie and finally drove it to a charity shop.`, `You stopped checking what ${x.first(ex.npcId)} was up to. Mostly.`, `A long cry, a long walk and a very long bath. ${x.first(ex.npcId)} feels like a chapter now, not the book.`]);
    },
  },
  {
    id: 'ro_enjoySingle',
    cat: 'romance',
    label: 'Enjoy being single',
    desc: 'The whole bed, the whole pizza, the whole evening.',
    group: 'Heart',
    ap: 1,
    scene: 'calm',
    avail: (x) => {
      const a = freeAdult(x);
      if (a !== true) return a;
      return x.lovers().length ? false : true;
    },
    run: (x) => {
      x.mods({ happiness: 4, confidence: 3, loneliness: x.chance(0.5) ? -3 : 2, romanticCynicism: -1 });
      return x.pick(['You took yourself to dinner and had excellent company.', 'You starfished across the whole bed and regretted nothing.', 'You learned to cook one perfect dish for one perfect person: you.']);
    },
  },
  {
    id: 'ro_radioHearts',
    cat: 'romance',
    label: 'Call a lonely-hearts show',
    desc: 'Pour your heart out on the radio.',
    group: 'Meet someone',
    ap: 1,
    scene: 'lonely',
    avail: (x) => (x.year < 1935 || x.year > 2005 ? false : single(x)),
    run: (x) => {
      x.mods({ loneliness: -2 });
      if (x.chance(0.4)) {
        x.mods({ publicImage: -1 });
        return 'Half the town heard you describe your ideal date. Your mother called the station to correct you.';
      }
      return meet(x, prospect(x, 8), 0.12, 'A listener rang in, charmed by your voice:');
    },
  },
];

// ------------------------------------------------------------------ per partner / spouse / affair

const PER: ActionDef[] = [
  {
    id: 'ro_askOut',
    cat: 'rel',
    label: (x) => (x.lover() ? 'Start an affair' : 'Ask them out'),
    desc: 'Tell them how you feel.',
    group: 'Romance',
    ap: 1,
    scene: (_o, res) => (/affair/.test(res) ? 'affair' : /dating/.test(res) ? 'kiss' : 'heartbreak'),
    avail: (x, arg) => {
      if (x.age < 18 || x.c.legal.prison || x.c.sexuality === 'asexual') return false;
      const t = tgt(x, arg, ['friend', 'bestFriend', 'acquaintance', 'colleague', 'boss', 'ex', 'rival']);
      if (!t || t.age < 18 || !attractedTo(x, t.n)) return false;
      return true;
    },
    run: (x, arg) => {
      const t = tgt(x, arg, ['friend', 'bestFriend', 'acquaintance', 'colleague', 'boss', 'ex', 'rival'])!;
      const prev = t.r.type;
      const keep = { affinity: t.r.affinity, trust: t.r.trust };
      if (!x.chance(Math.min(0.85, 0.25 + t.r.affinity / 250 + x.stat('confidence') / 600))) {
        x.relMod(t.id, -6);
        x.mods({ confidence: -3, happiness: -3 });
        return `${t.n.firstName} said they valued you "as a ${prev === 'colleague' ? 'colleague' : 'friend'}". Ouch.`;
      }
      const res = startDating(x, t.id);
      const now = x.rel(t.id);
      if (now && now.type === prev) Object.assign(now, keep);
      if (prev === 'colleague' && now && now.type !== prev) x.mods({ professionalRep: -1 });
      return res;
    },
  },
  {
    id: 'ro_dateNight',
    cat: 'rel',
    label: 'Date night',
    desc: 'Choose somewhere special.',
    group: 'Romance',
    ap: 1,
    scene: (o) => VENUES.find((v) => v.value === o)?.scene ?? 'date',
    avail: onLover(LOVERS),
    options: (x) => costOpts(x, venuesFor(x)),
    run: (x, arg) => {
      const t = tgt(x, arg, LOVERS)!;
      const v = venuesFor(x).find((w) => w.value === optOf(arg)) ?? VENUES[0];
      if (!x.spend(cost(x, v.cost))) return 'You cannot afford that.';
      const good = x.chance(Math.min(0.92, 0.35 + bond(x, t)));
      x.relMod(t.id, good ? x.int(6, 12) : 2, good ? 3 : 0);
      x.mods({ happiness: good ? 5 : 1, stress: -3, loneliness: -4 });
      sinIfAffair(x, t);
      const extra = caught(x, t, 0.12);
      if (!good) return `${venueLabel(v, x.year)} with ${t.n.firstName}: pleasant, but you both checked the time.${extra}`;
      return `${venueLabel(v, x.year)} with ${t.n.firstName}. ${v.line}${extra}`;
    },
  },
  {
    id: 'ro_getaway',
    cat: 'rel',
    label: 'Romantic getaway',
    desc: 'Just the two of you, somewhere else.',
    group: 'Romance',
    ap: 2,
    scene: (o) => GETAWAYS.find((v) => v.value === o)?.scene ?? 'romance',
    avail: onLover(LOVERS),
    options: (x) => costOpts(x, tripsFor(x)),
    run: (x, arg) => {
      const t = tgt(x, arg, LOVERS)!;
      const v = tripsFor(x).find((w) => w.value === optOf(arg)) ?? GETAWAYS[0];
      if (!x.spend(cost(x, v.cost))) return 'You cannot afford that.';
      x.relMod(t.id, x.int(8, 16), 5);
      x.mods({ happiness: 8, stress: -8 });
      sinIfAffair(x, t);
      if (x.chance(0.15)) return `${v.label} with ${t.n.firstName}: it rained the whole time, so you played cards and fell a little more in love.${caught(x, t, 0.25)}`;
      return `${v.label} with ${t.n.firstName}. ${v.line}${caught(x, t, 0.25)}`;
    },
  },
  {
    id: 'ro_cookDinner',
    cat: 'rel',
    label: 'Cook them dinner',
    desc: 'Love, apron optional.',
    group: 'Romance',
    ap: 1,
    scene: (_o, res) => (/smoke|burn/.test(res) ? 'cooking' : 'date'),
    avail: onLover(LOVERS),
    run: (x, arg) => {
      const t = tgt(x, arg, LOVERS)!;
      x.train('cooking', 3);
      const ok = x.chance(0.35 + x.skill('cooking') / 150);
      if (!ok) {
        x.relMod(t.id, 3);
        return `You set off the smoke alarm, burned the risotto and ordered in. ${t.n.firstName} said it was the thought that counted.`;
      }
      x.relMod(t.id, x.int(6, 11), 2);
      x.mods({ happiness: 3 });
      return x.pick([`${t.n.firstName} asked for seconds and then for the recipe.`, `Candles, your one good dish and ${t.n.firstName} doing the washing up without being asked. Bliss.`]);
    },
  },
  {
    id: 'ro_loveLetter',
    cat: 'rel',
    label: (x) => (x.year >= 2000 ? 'Write a love note' : 'Write a love letter'),
    desc: 'Say it on paper.',
    group: 'Romance',
    ap: 1,
    scene: 'loveLetter',
    avail: onLover(LOVERS),
    run: (x, arg) => {
      const t = tgt(x, arg, LOVERS)!;
      x.train('writing', 2);
      x.train('poetry', 1);
      const p = 0.4 + (x.skill('writing') + x.skill('poetry')) / 250;
      if (!x.chance(p)) {
        x.relMod(t.id, 3);
        return `You rhymed "${t.n.firstName}" with "lasagne". ${t.n.firstName} kept it anyway.`;
      }
      x.relMod(t.id, x.int(7, 12), 4);
      if (t.r.type === 'affair' && x.chance(0.15)) {
        const main = x.lover();
        if (main) {
          x.relMod(main.npcId, -20, -30);
          return `Beautiful letter. Terrible hiding place. ${x.first(main.npcId)} found the draft.`;
        }
      }
      return `${t.n.firstName} read it twice and keeps it in a drawer by the bed.`;
    },
  },
  {
    id: 'ro_serenade',
    cat: 'rel',
    label: 'Serenade them',
    desc: 'Under the window, ideally the right one.',
    group: 'Romance',
    ap: 1,
    scene: 'serenade',
    avail: onLover(LOVERS),
    run: (x, arg) => {
      const t = tgt(x, arg, LOVERS)!;
      x.train('singing', 2);
      const p = 0.3 + (x.skill('singing') + x.skill('music')) / 200 + x.stat('confidence') / 400;
      if (!x.chance(p)) {
        x.relMod(t.id, 2);
        x.mods({ confidence: -2 });
        return `A neighbour threw a shoe. ${t.n.firstName} threw a rose. Mixed reviews.`;
      }
      x.relMod(t.id, x.int(8, 14), 3);
      x.mods({ happiness: 4 });
      return `${t.n.firstName} leaned out of the window, laughing, and sang the last verse with you.${caught(x, t, 0.3)}`;
    },
  },
  {
    id: 'ro_surpriseGift',
    cat: 'rel',
    label: 'Surprise gift',
    desc: 'Something just because.',
    group: 'Romance',
    ap: 1,
    scene: (o) => (o === 'jewel' ? 'jewelry' : o === 'handmade' ? 'painting' : 'valentine'),
    avail: onLover(LOVERS),
    options: (x) => [
      { value: 'flowers', label: `Flowers (${x.fmt(cost(x, 40))})`, disabled: x.c.money < cost(x, 40) ? 'Cannot afford' : undefined },
      { value: 'handmade', label: 'Something handmade' },
      { value: 'jewel', label: `Jewellery (${x.fmt(cost(x, 1200))})`, disabled: x.c.money < cost(x, 1200) ? 'Cannot afford' : undefined },
    ],
    run: (x, arg) => {
      const t = tgt(x, arg, LOVERS)!;
      const o = optOf(arg);
      if (o === 'jewel') {
        if (!x.spend(cost(x, 1200))) return 'You cannot afford that.';
        x.relMod(t.id, x.int(10, 16), 3);
        return `${t.n.firstName} gasped, then pretended not to have gasped.`;
      }
      if (o === 'handmade') {
        x.train('artisanship', 2);
        const ok = x.chance(0.4 + x.stat('creativity') / 200);
        x.relMod(t.id, ok ? x.int(7, 12) : 4, 2);
        return ok ? `You made ${t.n.firstName} a little wooden bird. It now lives on their desk forever.` : `Your handmade mug leaks, but ${t.n.firstName} uses it for pens and smiles every time.`;
      }
      if (!x.spend(cost(x, 40))) return 'You cannot afford that.';
      x.relMod(t.id, x.int(4, 8), 1);
      return x.chance(0.1) ? `${t.n.firstName} turned out to be allergic. Lovely sneezing, though.` : `${t.n.firstName} put them in water and smiled at them all week.`;
    },
  },
  {
    id: 'ro_slowDance',
    cat: 'rel',
    label: 'Slow dance in the kitchen',
    desc: 'No music required.',
    group: 'Romance',
    ap: 1,
    scene: 'dance',
    avail: onLover(LOVERS),
    run: (x, arg) => {
      const t = tgt(x, arg, LOVERS)!;
      x.train('dance', 1);
      x.relMod(t.id, x.int(5, 10), 2);
      x.mods({ happiness: 4, stress: -4 });
      const tune = x.year >= 1920 ? (x.year >= 2000 ? 'a song on your phone' : 'a song on the radio') : 'a song you hummed yourselves';
      return `You swayed to ${tune} while the pasta boiled over. Worth it.`;
    },
  },
  {
    id: 'ro_stargaze',
    cat: 'rel',
    label: 'Go stargazing',
    desc: 'A blanket, a hill, the whole sky.',
    group: 'Romance',
    ap: 1,
    scene: 'stargazing',
    avail: onLover(LOVERS),
    run: (x, arg) => {
      const t = tgt(x, arg, LOVERS)!;
      x.train('astronomy', 1);
      x.relMod(t.id, x.int(6, 11), 3);
      x.mods({ happiness: 4, stress: -5, wisdom: 1 });
      return x.chance(0.3) ? `A shooting star crossed the sky. You both wished for the same thing and refused to say what.` : `${t.n.firstName} named a constellation after you. It looks a bit like a spoon.`;
    },
  },
  {
    id: 'ro_night',
    cat: 'rel',
    label: 'Spend the night together',
    desc: 'The door closes. The rest is yours.',
    group: 'Romance',
    ap: 1,
    scene: 'nightTogether',
    avail: onLover(LOVERS),
    run: (x, arg) => {
      const t = tgt(x, arg, LOVERS)!;
      x.relMod(t.id, x.int(5, 10), 2);
      x.mods({ happiness: 6, stress: -6, loneliness: -6 });
      sinIfAffair(x, t);
      const extra = caught(x, t, 0.15);
      return `${x.pick(['The night was long, and the morning came too soon.', 'You woke up together to rain on the window and no plans at all.', 'The candles burned down. Neither of you noticed.'])}${extra}`;
    },
  },
  {
    id: 'ro_breakfastBed',
    cat: 'rel',
    label: 'Breakfast in bed',
    desc: 'Crumbs are a small price.',
    group: 'Romance',
    ap: 1,
    scene: 'cooking',
    avail: onLover(STEADY),
    run: (x, arg) => {
      const t = tgt(x, arg, STEADY)!;
      x.train('cooking', 1);
      x.relMod(t.id, x.int(4, 9), 2);
      return x.chance(0.2) ? `You spilled orange juice on the duvet. ${t.n.firstName} laughed so hard it was worth it.` : `${t.n.firstName} woke to pancakes and coffee and declared you a national treasure.`;
    },
  },
  {
    id: 'ro_movieNight',
    cat: 'rel',
    label: 'Movie night in',
    desc: 'Sofa, blanket, arguments about what to watch.',
    group: 'Romance',
    ap: 1,
    scene: 'cinema',
    avail: onLover(STEADY, (x) => (x.year >= 1955 ? true : false)),
    run: (x, arg) => {
      const t = tgt(x, arg, STEADY)!;
      x.relMod(t.id, x.int(3, 8), 1);
      x.mods({ stress: -4, happiness: 2 });
      return x.pick([`You spent forty minutes choosing and ${t.n.firstName} fell asleep in ten.`, `${t.n.firstName} cried at the dog film. You pretended you had not.`, 'You watched a terrible horror film and slept with the lights on. Together.']);
    },
  },
  {
    id: 'ro_kissRain',
    cat: 'rel',
    label: 'Kiss them in the rain',
    desc: 'Cinematic. Possibly cold.',
    group: 'Romance',
    ap: 1,
    scene: 'kiss',
    avail: onLover(LOVERS),
    run: (x, arg) => {
      const t = tgt(x, arg, LOVERS)!;
      x.relMod(t.id, x.int(5, 10), 1);
      x.mods({ happiness: 4 });
      if (x.chance(0.2)) {
        x.mods({ health: -2 });
        return `Unbelievably romantic. You both caught a cold. ${t.n.firstName} still calls it worth it.`;
      }
      return `A downpour, an awning and ${t.n.firstName}. You will remember this one.${caught(x, t, 0.2)}`;
    },
  },
  {
    id: 'ro_apologize',
    cat: 'rel',
    label: 'Apologise properly',
    desc: 'Not "sorry you feel that way". A real one.',
    group: 'Romance',
    ap: 1,
    scene: (_o, res) => (/rainbow|forgive|hug/.test(res) ? 'makeup' : 'argument'),
    avail: onLover(LOVERS, (_x, t) => (t.r.affinity < 70 ? true : false)),
    run: (x, arg) => {
      const t = tgt(x, arg, LOVERS)!;
      x.train('conflictResolution', 2);
      x.mods({ ego: -2 });
      const p = 0.4 + x.skill('conflictResolution') / 200 + x.stat('empathy') / 300;
      if (x.chance(p)) {
        x.relMod(t.id, x.int(8, 15), 6);
        return `You said it plainly and meant it. ${t.n.firstName} pulled you into a hug and forgave you.`;
      }
      x.relMod(t.id, 2);
      return `${t.n.firstName} accepted the apology, but not the tone. Try again tomorrow.`;
    },
  },
  {
    id: 'ro_suspicious',
    cat: 'rel',
    label: 'Ask where they really were',
    desc: 'Trust, but verify. Or don\'t.',
    group: 'Romance',
    ap: 1,
    scene: 'jealousy',
    avail: onLover(STEADY),
    run: (x, arg) => {
      const t = tgt(x, arg, STEADY)!;
      const cheating = x.c.relationships.some((r) => r.type === 'affair' && r.npcId === t.id) || (t.r.meta.cheating === true);
      if (cheating || (t.r.trust < 35 && x.chance(0.3))) {
        x.relMod(t.id, -12, -15);
        x.mods({ stress: 6, paranoia: 3 });
        return `${t.n.firstName} stammered something about a book club. There is no book club.`;
      }
      x.relMod(t.id, -5, -6);
      x.mods({ paranoia: 1 });
      return `${t.n.firstName} was at the dentist. They have the receipt and now a grudge.`;
    },
  },
  {
    id: 'ro_meetParents',
    cat: 'rel',
    label: 'Meet their parents',
    desc: 'Dress nicely. Avoid politics.',
    group: 'Romance',
    ap: 1,
    scene: 'familyDinner',
    avail: onLover(['partner'], (_x, t) => (t.r.meta.metParents ? false : true)),
    run: (x, arg) => {
      const t = tgt(x, arg, ['partner'])!;
      t.r.meta.metParents = true;
      x.train('etiquette', 2);
      const p = 0.45 + x.skill('etiquette') / 200 + x.stat('charisma') / 300;
      if (x.chance(p)) {
        x.relMod(t.id, x.int(6, 10), 4);
        return `${t.n.firstName}'s mother sent you home with leftovers. That is basically adoption.`;
      }
      x.relMod(t.id, -3);
      x.mods({ stress: 4 });
      return `You called ${t.n.firstName}'s father by the wrong name. Twice. Dessert was quiet.`;
    },
  },
  {
    id: 'ro_moveIn',
    cat: 'rel',
    label: 'Move in together',
    desc: 'Merge sofas, books and opinions about dishes.',
    group: 'Romance',
    ap: 1,
    scene: 'moving',
    avail: onLover(['partner'], (x, t) => (t.r.meta.cohabit ? false : x.year < 1960 && x.w.socialNorms < 50 ? 'Scandalous before marriage here' : true)),
    run: (x, arg) => {
      const t = tgt(x, arg, ['partner'])!;
      if (!x.chance(0.4 + t.r.affinity / 200)) {
        x.relMod(t.id, -4);
        return `${t.n.firstName} said "not yet". You both pretended it was fine.`;
      }
      t.r.meta.cohabit = true;
      x.relMod(t.id, 8, 5);
      x.mods({ happiness: 5, loneliness: -8 });
      x.remember('movedIn', `Moved in with ${x.name(t.n)}`, 15, t.id);
      return `You moved in with ${t.n.firstName}. The first fight was about where the spoons go. You won.`;
    },
  },
  {
    id: 'ro_danceLessons',
    cat: 'rel',
    label: 'Take dance lessons together',
    desc: 'Learn to lead, or at least to follow.',
    group: 'Romance',
    ap: 1,
    scene: 'dance',
    avail: onLover(STEADY, (x) => costOk(x, 120)),
    run: (x, arg) => {
      const t = tgt(x, arg, STEADY)!;
      x.spend(cost(x, 120));
      x.train('dance', 4);
      x.relMod(t.id, x.int(4, 9), 2);
      x.mods({ fitness: 1 });
      const style = x.year < 1900 ? 'the waltz' : x.year < 1950 ? 'the foxtrot' : x.year < 2000 ? 'salsa' : 'tango';
      return `Six weeks of ${style}. You both still count out loud, but now in unison.`;
    },
  },
  {
    id: 'ro_anniversary',
    cat: 'rel',
    label: 'Celebrate your anniversary',
    desc: 'Another year of putting up with each other.',
    group: 'Romance',
    ap: 1,
    scene: 'anniversary',
    avail: onLover(STEADY, (x, t) => (x.age - t.r.since >= 1 ? true : false)),
    run: (x, arg) => {
      const t = tgt(x, arg, STEADY)!;
      const yrs = Math.max(1, x.age - t.r.since);
      if (x.chance(0.12)) {
        x.relMod(t.id, -6);
        return `You booked dinner for the wrong date. ${t.n.firstName} will mention this at year ${yrs + 10}.`;
      }
      x.relMod(t.id, x.int(6, 12), 3);
      x.mods({ happiness: 5 });
      return `${yrs} year${yrs === 1 ? '' : 's'} with ${t.n.firstName}. You clinked glasses and told the story of how you met, slightly differently, as always.`;
    },
  },
  {
    id: 'ro_renewVows',
    cat: 'rel',
    label: 'Renew your vows',
    desc: 'Same person, new promises.',
    group: 'Marriage',
    ap: 1,
    scene: 'wedding',
    avail: onLover(['spouse'], (x, t) => (x.age - t.r.since < 5 ? false : t.r.meta.renewed === x.year ? false : costOk(x, 2500))),
    run: (x, arg) => {
      const t = tgt(x, arg, ['spouse'])!;
      x.spend(cost(x, 2500));
      t.r.meta.renewed = x.year;
      x.relMod(t.id, x.int(10, 18), 8);
      x.mods({ happiness: 8 });
      x.remember('renewedVows', `Renewed vows with ${x.name(t.n)}`, 25, t.id);
      return `You said "I do" again to ${t.n.firstName}. You both meant it more this time.`;
    },
  },
  {
    id: 'ro_honeymoon2',
    cat: 'rel',
    label: 'Second honeymoon',
    desc: 'Like the first, with better luggage.',
    group: 'Marriage',
    ap: 2,
    scene: 'honeymoon',
    avail: onLover(['spouse'], (x, t) => (x.age - t.r.since < 3 ? false : costOk(x, 3000))),
    run: (x, arg) => {
      const t = tgt(x, arg, ['spouse'])!;
      x.spend(cost(x, 3000));
      x.relMod(t.id, x.int(10, 18), 5);
      x.mods({ happiness: 10, stress: -10 });
      return `Sun, sea and ${t.n.firstName} in a hammock. You did not check the news once.`;
    },
  },
  {
    id: 'ro_couplesTherapy',
    cat: 'rel',
    label: 'Couples therapy',
    desc: 'A professional referee.',
    group: 'Marriage',
    ap: 1,
    scene: 'calm',
    avail: onLover(STEADY, (x) => (x.year < 1950 ? false : costOk(x, 200))),
    run: (x, arg) => {
      const t = tgt(x, arg, STEADY)!;
      x.spend(cost(x, 200));
      x.train('empathyListening', 3);
      x.train('conflictResolution', 2);
      const p = 0.45 + t.r.compatibility / 250 + x.stat('empathy') / 300;
      if (x.chance(p)) {
        x.relMod(t.id, x.int(10, 18), 10);
        x.mods({ stress: -5 });
        return `The therapist made you both say one kind thing. ${t.n.firstName} said five. You went for ice cream after.`;
      }
      x.relMod(t.id, -3, 2);
      return 'You spent the session arguing about who talks more. Progress is slow, but it is progress.';
    },
  },
  {
    id: 'ro_talkKids',
    cat: 'rel',
    label: 'Talk about having kids',
    desc: 'The big conversation.',
    group: 'Marriage',
    ap: 1,
    scene: (_o, res) => (/same page|both want/.test(res) ? 'love' : 'argument'),
    avail: onLover(STEADY),
    run: (x, arg) => {
      const t = tgt(x, arg, STEADY)!;
      const wants = t.r.meta.wantsKids ?? (x.chance(0.7) ? 'yes' : 'no');
      t.r.meta.wantsKids = wants;
      if (wants === 'yes') {
        x.relMod(t.id, 6, 4);
        return x.children().length ? `${t.n.firstName} wants more. You both want more. The house will be loud.` : `You both want kids. You were on the same page down to the name of the imaginary dog.`;
      }
      x.relMod(t.id, -5, 2);
      x.mods({ stress: 4 });
      return `${t.n.firstName} is not sure they ever want children. It was a long, honest, difficult evening.`;
    },
  },
  {
    id: 'ro_openRelationship',
    cat: 'rel',
    label: 'Suggest an open relationship',
    desc: 'Rules, honesty and a lot of talking.',
    group: 'Marriage',
    ap: 1,
    scene: (_o, res) => (/agreed/.test(res) ? 'love' : 'argument'),
    avail: onLover(STEADY, (x, t) => (x.year < 1965 || x.w.socialNorms < 60 ? false : t.r.meta.open ? false : true)),
    run: (x, arg) => {
      const t = tgt(x, arg, STEADY)!;
      const p = 0.15 + t.r.trust / 300 + x.stat('charisma') / 600;
      if (x.chance(p)) {
        t.r.meta.open = true;
        x.relMod(t.id, 2, 5);
        return `After a very long talk, ${t.n.firstName} agreed. There is now a shared spreadsheet of rules.`;
      }
      x.relMod(t.id, -15, -12);
      x.mods({ stress: 6 });
      return `${t.n.firstName} went very quiet, then very loud. You slept on the sofa.`;
    },
  },
  {
    id: 'ro_propose',
    cat: 'rel',
    label: 'Propose with a plan',
    desc: 'Make it a story they will tell forever.',
    group: 'Marriage',
    ap: 1,
    scene: (_o, res) => (/yes/.test(res) ? 'proposal' : 'heartbreak'),
    avail: onLover(['partner'], (x) => (x.spouse() ? false : true)),
    options: (x) => [
      { value: 'dinner', label: `Over dinner (${x.fmt(cost(x, 150))})`, disabled: x.c.money < cost(x, 150) ? 'Cannot afford' : undefined },
      { value: 'stars', label: 'Under the stars' },
      { value: 'public', label: x.year >= 2005 ? 'With a flash mob' : 'In the town square', disabled: undefined },
      { value: 'heirloom', label: 'With a family ring' },
    ],
    run: (x, arg) => {
      const t = tgt(x, arg, ['partner'])!;
      const o = optOf(arg);
      let bonus = 0;
      let lead = '';
      if (o === 'dinner') {
        if (!x.spend(cost(x, 150))) return 'You cannot afford that.';
        bonus = 4;
        lead = 'You hid the ring in dessert and nearly let the waiter eat it.';
      } else if (o === 'stars') {
        bonus = 6;
        lead = 'On a hilltop under a sky full of stars, you got down on one knee.';
      } else if (o === 'public') {
        bonus = t.r.affinity > 75 ? 8 : -10;
        lead = x.year >= 2005 ? 'Forty strangers burst into dance, and then you knelt.' : 'In front of the whole square, you knelt on the cobbles.';
      } else {
        bonus = 5;
        lead = "You offered your grandmother's ring, still in its velvet box.";
      }
      x.relMod(t.id, bonus);
      const res = propose(x, t.id);
      if (/said no/.test(res)) x.mods({ publicImage: o === 'public' ? -3 : 0 });
      return `${lead} ${res}`;
    },
  },
  {
    id: 'ro_rekindle',
    cat: 'rel',
    label: 'Rekindle things',
    desc: 'Some doors are worth knocking on twice.',
    group: 'Romance',
    ap: 1,
    scene: (_o, res) => (/again|back/.test(res) ? 'reunion' : 'heartbreak'),
    avail: (x, arg) => {
      if (x.age < 18 || x.c.legal.prison) return false;
      const t = tgt(x, arg, ['ex']);
      if (!t || t.age < 18 || x.lover() || t.n.spouseId) return false;
      return true;
    },
    run: (x, arg) => {
      const t = tgt(x, arg, ['ex'])!;
      if (!x.chance(0.15 + t.r.affinity / 150)) {
        x.relMod(t.id, -4);
        x.mods({ happiness: -3, romanticCynicism: 2 });
        return `${t.n.firstName} said it was nice to hear from you, which is ex for "no".`;
      }
      x.addRel(t.id, 'partner', { affinity: Math.max(55, t.r.affinity + 15), trust: Math.max(40, t.r.trust) });
      x.mods({ happiness: 6 });
      return `Coffee turned into dinner, dinner turned into old jokes. You and ${t.n.firstName} are back together, again.`;
    },
  },
  {
    id: 'ro_rendezvous',
    cat: 'rel',
    label: 'Meet in secret',
    desc: 'Different hotel. Different name. Same thrill.',
    group: 'Affair',
    ap: 1,
    scene: 'affair',
    avail: onLover(['affair']),
    run: (x, arg) => {
      const t = tgt(x, arg, ['affair'])!;
      t.r.meta.discretion = Math.min(100, Number(t.r.meta.discretion ?? 50) + 5);
      x.relMod(t.id, x.int(5, 10), 2);
      x.mods({ happiness: 3, stress: 4, sin: 1 });
      x.train('deception', 2);
      return `You and ${t.n.firstName} met at a station café in sunglasses, like amateurs in a spy film.${caught(x, t, 0.1)}`;
    },
  },
  {
    id: 'ro_endAffair',
    cat: 'rel',
    label: 'End the affair',
    desc: 'Walk away before it all comes out.',
    group: 'Affair',
    ap: 1,
    scene: (_o) => 'breakupText',
    avail: onLover(['affair']),
    run: (x, arg) => {
      const t = tgt(x, arg, ['affair'])!;
      breakUp(x, t.id);
      x.mods({ stress: -6, karma: 2 });
      if (t.r.affinity > 70 && x.chance(0.35)) {
        x.addRel(t.id, 'enemy', { affinity: 10, trust: 5 });
        return `${t.n.firstName} did not take it well and threatened to tell everyone. You will be checking the post for a while.`;
      }
      return x.year >= 2000 ? `You sent ${t.n.firstName} a long message and deleted the thread. It hurt, and it was right.` : `You told ${t.n.firstName} it was over on a cold bench. Neither of you looked back.`;
    },
  },
  {
    id: 'ro_confess',
    cat: 'rel',
    label: 'Confess the affair',
    desc: 'Tell your partner the truth about this one.',
    group: 'Affair',
    ap: 1,
    scene: 'argument',
    avail: onLover(['affair'], (x) => (x.lover() ? true : false)),
    run: (x, arg) => {
      const t = tgt(x, arg, ['affair'])!;
      const main = x.lover()!;
      const mainName = x.first(main.npcId);
      x.c.media.secrets = x.c.media.secrets.filter((s) => s.id !== `affair_${t.id}`);
      breakUp(x, t.id);
      x.mods({ karma: 3, stress: 8 });
      x.relMod(main.npcId, -30, -40);
      const fresh = x.rel(main.npcId)!;
      if (fresh.affinity < 25 && x.chance(0.6)) {
        const out = main.type === 'spouse' ? divorce(x, main.npcId) : breakUp(x, main.npcId);
        return `You told ${mainName} everything about ${t.n.firstName}. ${mainName} packed a bag that night. ${out}`;
      }
      return `You told ${mainName} everything about ${t.n.firstName}. There was shouting, then silence, then the beginnings of honesty.`;
    },
  },
  {
    id: 'ro_leaveFor',
    cat: 'rel',
    label: 'Leave your partner for them',
    desc: 'Choose the secret over the safe.',
    group: 'Affair',
    ap: 1,
    scene: 'heartbreak',
    avail: onLover(['affair'], (x) => (x.lover() ? true : false)),
    run: (x, arg) => {
      const t = tgt(x, arg, ['affair'])!;
      const main = x.lover()!;
      const mainName = x.first(main.npcId);
      const out = main.type === 'spouse' ? divorce(x, main.npcId) : breakUp(x, main.npcId);
      x.c.media.secrets = x.c.media.secrets.filter((s) => s.id !== `affair_${t.id}`);
      x.addRel(t.id, 'partner', { affinity: Math.min(100, t.r.affinity + 10), trust: t.r.trust });
      x.mods({ karma: -3, stress: 6 });
      return `You left ${mainName} for ${t.n.firstName}. ${out} The new life starts in a borrowed flat.`;
    },
  },
];

export const ROMANCE_ACTIONS: ActionDef[] = [...GENERAL, ...PER];
