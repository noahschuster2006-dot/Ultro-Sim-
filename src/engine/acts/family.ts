import type { Ctx } from '../ctx';
import type { NPC, Relationship, RelType } from '../types';
import { type ActionDef, free, moneyOk, optOf, price, targetOf } from './common';

// ------------------------------------------------------------------ helpers

interface Target {
  id: string;
  r: Relationship;
  n: NPC;
  age: number;
}

const KIN: RelType[] = ['parent', 'sibling', 'child', 'grandchild', 'grandparent', 'spouse'];

function tgt(x: Ctx, arg: string | undefined, types: RelType[]): Target | null {
  const id = targetOf(arg);
  const r = x.rel(id);
  const n = x.npc(id);
  if (!id || !r || !n || !n.alive || !types.includes(r.type)) return null;
  return { id, r, n, age: x.npcAge(n) };
}

/** Per-relative availability by relationship type, their age range and your age range. */
function onKin(types: RelType[], o: { min?: number; max?: number; youMin?: number; youMax?: number; from?: number; to?: number; extra?: (x: Ctx, t: Target) => true | string | false } = {}) {
  return (x: Ctx, arg?: string): true | string | false => {
    if (x.c.legal.prison) return false;
    if (o.from !== undefined && x.year < o.from) return false;
    if (o.to !== undefined && x.year > o.to) return false;
    if (o.youMin !== undefined && x.age < o.youMin) return false;
    if (o.youMax !== undefined && x.age > o.youMax) return false;
    const t = tgt(x, arg, types);
    if (!t) return false;
    if (o.min !== undefined && t.age < o.min) return false;
    if (o.max !== undefined && t.age > o.max) return false;
    return o.extra ? o.extra(x, t) : true;
  };
}

const kin = (x: Ctx): Relationship[] => x.rels(...KIN);
const cost = (x: Ctx, n: number): number => price(x, n);

/** Nudge every living relative's affinity. */
function warmAll(x: Ctx, lo: number, hi: number): number {
  const all = kin(x);
  for (const r of all) x.relMod(r.npcId, x.int(lo, hi), 1);
  return all.length;
}

function hasKin(x: Ctx, need = 1): true | string | false {
  if (x.c.legal.prison) return false;
  return kin(x).length >= need ? true : 'No family around';
}

function boost(n: NPC, key: 'smarts' | 'health' | 'looks', by: number): void {
  n[key] = Math.max(0, Math.min(100, n[key] + by));
}

const kids = (x: Ctx): Relationship[] => x.rels('child', 'grandchild').filter((r) => x.npcAge(x.npc(r.npcId)!) < 18);

// ------------------------------------------------------------------ general (Family time)

interface Trip {
  value: string;
  label: string;
  cost: number;
  scene: string;
  from?: number;
  to?: number;
  line: string;
}

const VACATIONS: Trip[] = [
  { value: 'country', label: 'The countryside', cost: 150, scene: 'picnic', line: 'Cows, rain and one perfect sunny afternoon everyone will remember.' },
  { value: 'sea', label: 'The seaside', cost: 400, scene: 'beach', from: 1750, line: 'Sandcastles, sunburn and ice cream for dinner.' },
  { value: 'pilgrimage', label: 'A pilgrimage', cost: 200, scene: 'holy', to: 1800, line: 'Sore feet, holy sights and a lot of family singing on the road.' },
  { value: 'camp', label: 'A camping trip', cost: 120, scene: 'camping', from: 1900, line: 'The tent leaked, the marshmallows burned and everyone loved it.' },
  { value: 'park', label: 'A theme park', cost: 900, scene: 'amusement', from: 1955, line: 'Someone threw up on the teacups. Still a triumph.' },
  { value: 'abroad', label: 'A trip abroad', cost: 3000, scene: 'travel', from: 1960, line: 'Passports, a lost suitcase and the best meal of your lives.' },
  { value: 'ski', label: 'A ski holiday', cost: 2500, scene: 'skiing', from: 1950, line: 'Everyone fell over constantly and laughed every time.' },
  { value: 'orbit', label: 'An orbital resort', cost: 60000, scene: 'rocket', from: 2150, line: 'The kids pressed their faces to the window at Earth all week.' },
];
const vacationsFor = (x: Ctx): Trip[] => VACATIONS.filter((v) => (v.from === undefined || x.year >= v.from) && (v.to === undefined || x.year <= v.to));
const tripCost = (x: Ctx, v: Trip): number => cost(x, v.cost) * Math.max(1, Math.min(6, 1 + kin(x).filter((r) => ['spouse', 'child', 'partner'].includes(r.type)).length));

const GENERAL: ActionDef[] = [
  {
    id: 'fa_dinner',
    cat: 'family',
    label: 'Family dinner',
    desc: 'Everyone at one table. Nobody mentions politics.',
    group: 'Together',
    ap: 1,
    scene: 'familyDinner',
    avail: (x) => hasKin(x),
    run: (x) => {
      warmAll(x, 2, 6);
      x.mods({ happiness: 3, loneliness: -5 });
      if (x.chance(0.2)) {
        x.mods({ stress: 3 });
        return 'Someone brought up the inheritance. The gravy went cold during the silence.';
      }
      return x.pick(['Three conversations at once, two second helpings and one embarrassing story about you as a baby.', 'Everyone fought over the last potato. It was perfect.', 'Nobody looked at a screen for a whole hour. A modern miracle.']);
    },
  },
  {
    id: 'fa_vacation',
    cat: 'family',
    label: 'Family vacation',
    desc: 'Pack the car. Forget something important.',
    group: 'Together',
    ap: 2,
    scene: (o) => VACATIONS.find((v) => v.value === o)?.scene ?? 'travel',
    avail: (x) => (x.age < 18 ? false : hasKin(x)),
    options: (x) => vacationsFor(x).map((v) => {
      const c = tripCost(x, v);
      return { value: v.value, label: `${v.label} (${x.fmt(c)})`, disabled: x.c.money < c ? 'Cannot afford' : undefined };
    }),
    run: (x, arg) => {
      const v = vacationsFor(x).find((t) => t.value === optOf(arg)) ?? VACATIONS[0];
      if (!x.spend(tripCost(x, v))) return 'You cannot afford that.';
      warmAll(x, 5, 10);
      x.mods({ happiness: 8, stress: -8 });
      x.remember('familyTrip', `Family trip: ${v.label.toLowerCase()} in ${x.year}`, 12);
      return `${v.label}: ${v.line}`;
    },
  },
  {
    id: 'fa_gameNight',
    cat: 'family',
    label: 'Family game night',
    desc: 'Friendships have ended over less.',
    group: 'Together',
    ap: 1,
    scene: 'gaming',
    avail: (x) => hasKin(x),
    run: (x) => {
      warmAll(x, 2, 5);
      x.mods({ happiness: 3, stress: -2 });
      const game = x.year < 1600 ? 'dice' : x.year < 1935 ? 'cards' : x.year < 1980 ? 'a board game' : x.year < 2030 ? 'a video game' : 'a holo-game';
      return x.chance(0.3) ? `Family ${game} night ended with a flipped table and a lifetime ban for Uncle Jim.` : `You played ${game} until midnight. Someone definitely cheated, and it might have been you.`;
    },
  },
  {
    id: 'fa_holiday',
    cat: 'family',
    label: 'Host a holiday gathering',
    desc: 'Twenty relatives, one oven.',
    group: 'Together',
    ap: 1,
    scene: (_o, res) => (/argu|storm/.test(res) ? 'argument' : 'festival'),
    avail: (x) => (x.age < 18 ? false : hasKin(x) === true ? moneyOk(x, cost(x, 200)) : hasKin(x)),
    run: (x) => {
      x.spend(cost(x, 200));
      x.train('cooking', 2);
      x.train('hospitality', 2);
      if (x.chance(0.25)) {
        warmAll(x, -3, 2);
        x.mods({ stress: 8 });
        return 'Two cousins argued about money, a grandparent stormed out, and the dog ate the centrepiece.';
      }
      warmAll(x, 4, 9);
      x.mods({ happiness: 6, stress: 3 });
      return 'The house was full, loud and warm. You found glitter in your hair for a month.';
    },
  },
  {
    id: 'fa_callHome',
    cat: 'family',
    label: (x) => (x.year < 1900 ? 'Write home' : x.year < 2010 ? 'Call home' : 'Video call home'),
    desc: 'They worry. Tell them you are eating vegetables.',
    group: 'Keep in touch',
    ap: 1,
    scene: (_o, res) => (/letter/.test(res) ? 'loveLetter' : 'family'),
    avail: (x) => (x.age < 16 || x.c.legal.prison ? false : x.rels('parent', 'grandparent').length ? true : false),
    run: (x) => {
      for (const r of x.rels('parent', 'grandparent')) x.relMod(r.npcId, x.int(3, 7), 2);
      x.mods({ loneliness: -4, happiness: 2 });
      if (x.year < 1900) return 'Your letter home was three pages of news and one line asking for money.';
      if (x.year >= 2010 && x.chance(0.4)) return 'Twenty minutes of looking at someone\'s forehead and a ceiling fan, but they said they love you.';
      return x.pick(['Your mother asked if you were eating properly. You lied.', 'They put you on speaker so the whole family could shout hello at once.']);
    },
  },
  {
    id: 'fa_visitRelatives',
    cat: 'family',
    label: 'Visit relatives',
    desc: 'Aunts, cousins and the good biscuits.',
    group: 'Keep in touch',
    ap: 1,
    scene: 'roadTrip',
    avail: (x) => (x.age < 16 ? false : hasKin(x)),
    run: (x) => {
      warmAll(x, 1, 5);
      x.mods({ loneliness: -3 });
      return x.pick(['Your great-aunt pinched your cheek and asked when you were getting married. Again.', 'A long drive, a short visit and a boot full of homemade jam.', 'You met a cousin you never knew existed. You have the same nose.']);
    },
  },
  {
    id: 'fa_portrait',
    cat: 'family',
    label: (x) => (x.year < 1850 ? 'Commission a family portrait' : 'Family photo'),
    desc: 'Everyone look this way. No, this way.',
    group: 'Together',
    ap: 1,
    scene: (_o, res) => (/painter/.test(res) ? 'painting' : 'family'),
    avail: (x) => (x.age < 18 ? false : hasKin(x) === true ? moneyOk(x, cost(x, x.year < 1850 ? 600 : 80)) : hasKin(x)),
    run: (x) => {
      x.spend(cost(x, x.year < 1850 ? 600 : 80));
      warmAll(x, 1, 4);
      x.remember('familyPhoto', `A family portrait in ${x.year}`, 8);
      if (x.year < 1850) return 'The painter made everyone sit still for six hours. You look stern and slightly hungry in it forever.';
      return 'Somebody blinked in every single shot. You framed the one where the dog is in focus.';
    },
  },
  {
    id: 'fa_reunion',
    cat: 'family',
    label: 'Organise a family reunion',
    desc: 'Matching T-shirts optional, chaos guaranteed.',
    group: 'Together',
    ap: 2,
    scene: 'reunion',
    avail: (x) => (x.age < 30 ? false : hasKin(x, 2) === true ? moneyOk(x, cost(x, 800)) : hasKin(x, 2)),
    run: (x) => {
      x.spend(cost(x, 800));
      x.train('leadership', 2);
      warmAll(x, 4, 10);
      x.mods({ happiness: 6, loneliness: -8 });
      x.remember('familyReunion', `Organised a family reunion in ${x.year}`, 15);
      return 'Four generations, one park, two barbecues and a cousin who proposed during the tug-of-war.';
    },
  },
  {
    id: 'fa_familyTree',
    cat: 'family',
    label: 'Research the family tree',
    desc: 'Royalty? Horse thieves? Let\'s find out.',
    group: 'Heritage',
    ap: 1,
    scene: (_o) => 'library',
    avail: (x) => (x.age < 12 || x.c.legal.prison || x.year < 1500 ? false : true),
    run: (x) => {
      x.train('history', 3);
      x.mods({ wisdom: 1 });
      const finds = ['a great-great-grandfather who was hanged for stealing a goose', 'a distant cousin who once met a queen', 'a long line of very stubborn bakers', 'a mysterious ancestor who vanished and reappeared rich', 'that your surname was a spelling mistake at a port office'];
      return `${x.year >= 1995 ? 'Hours online' : 'Weeks in the archives'} revealed ${x.pick(finds)}.`;
    },
  },
  {
    id: 'fa_picnic',
    cat: 'family',
    label: 'Family picnic',
    desc: 'Sandwiches and wasps.',
    group: 'Together',
    ap: 1,
    scene: 'picnic',
    avail: (x) => hasKin(x),
    run: (x) => {
      warmAll(x, 2, 6);
      x.mods({ happiness: 3, stress: -3 });
      return x.chance(0.3) ? 'A goose stole the cake. The family has talked of nothing else since.' : 'A blanket, a basket and an afternoon that felt longer than it was, in the best way.';
    },
  },
  {
    id: 'fa_movieNight',
    cat: 'family',
    label: 'Family movie night',
    desc: 'Popcorn and a fight over the remote.',
    group: 'Together',
    ap: 1,
    scene: 'cinema',
    avail: (x) => (x.year < 1955 ? false : hasKin(x)),
    run: (x) => {
      warmAll(x, 2, 5);
      x.mods({ stress: -3 });
      return x.pick(['Everyone fell asleep before the end except the youngest, who now knows the ending of everything.', 'You watched the same cartoon for the ninth time. You can recite it now.']);
    },
  },
  {
    id: 'fa_garden',
    cat: 'family',
    label: 'Plant a family garden',
    desc: 'Dirt under every fingernail.',
    group: 'Together',
    ap: 1,
    scene: 'gardening',
    avail: (x) => (x.age < 16 ? false : kids(x).length ? free(x) : false),
    run: (x) => {
      x.train('farming', 2);
      for (const r of kids(x)) x.relMod(r.npcId, x.int(3, 7), 1);
      x.mods({ happiness: 3, fitness: 1 });
      return 'The kids planted the seeds upside down. The tomatoes came up anyway.';
    },
  },
  {
    id: 'fa_tradition',
    cat: 'family',
    label: 'Start a family tradition',
    desc: 'Something silly, done every year forever.',
    group: 'Heritage',
    ap: 1,
    scene: 'festival',
    avail: (x) => (x.age < 20 || x.flag('fa_tradition') ? false : hasKin(x)),
    run: (x) => {
      const tr = x.pick(['pancakes shaped like the year', 'an annual sock-swap', 'a midsummer water fight', 'reading the same terrible poem every New Year', 'a family walk up the same hill']);
      x.setFlag('fa_tradition', tr);
      warmAll(x, 3, 8);
      x.remember('familyTradition', `Started a family tradition: ${tr}`, 15);
      return `You started a tradition: ${tr}. The grandchildren will think it is ancient.`;
    },
  },
  {
    id: 'fa_chores',
    cat: 'family',
    label: 'Make a chore chart',
    desc: 'Democracy, but with dishes.',
    group: 'Household',
    ap: 1,
    scene: 'family',
    avail: (x) => (x.age < 20 ? false : kids(x).some((r) => x.npcAge(x.npc(r.npcId)!) >= 5) ? free(x) : false),
    run: (x) => {
      x.train('management', 1);
      x.mods({ stress: -3 });
      for (const r of kids(x)) x.relMod(r.npcId, x.int(-3, 2));
      return 'The chart lasted three days before someone negotiated a trade involving the cat litter.';
    },
  },
];

// ------------------------------------------------------------------ per relative

const PER: ActionDef[] = [
  {
    id: 'fa_bedtimeStory',
    cat: 'rel',
    label: 'Read a bedtime story',
    desc: 'One more chapter. Just one.',
    group: 'Parenting',
    ap: 1,
    scene: 'reading',
    avail: onKin(['child', 'grandchild'], { min: 2, max: 10, youMin: 14 }),
    run: (x, arg) => {
      const t = tgt(x, arg, ['child', 'grandchild'])!;
      x.relMod(t.id, x.int(5, 10), 3);
      boost(t.n, 'smarts', 1);
      x.mods({ happiness: 3, stress: -2 });
      return x.pick([`${t.n.firstName} fell asleep three pages in. You finished the book anyway.`, `${t.n.firstName} demanded the dragon voice. Again. And again.`, `You made up a story about a brave sock. ${t.n.firstName} now asks for it every night.`]);
    },
  },
  {
    id: 'fa_homework',
    cat: 'rel',
    label: 'Help with homework',
    desc: 'You will discover you have forgotten fractions.',
    group: 'Parenting',
    ap: 1,
    scene: 'study',
    avail: onKin(['child', 'grandchild', 'sibling'], { min: 6, max: 17, youMin: 12, from: 1850 }),
    run: (x, arg) => {
      const t = tgt(x, arg, ['child', 'grandchild', 'sibling'])!;
      x.train('mathematics', 1);
      const good = x.chance(0.3 + x.stat('smarts') / 150);
      if (good) {
        boost(t.n, 'smarts', 2);
        x.relMod(t.id, x.int(4, 8), 2);
        return `You explained it so well ${t.n.firstName} got top marks. You may have been more excited than they were.`;
      }
      x.relMod(t.id, 1);
      x.mods({ ego: -2 });
      return `You confidently taught ${t.n.firstName} the wrong method. The teacher left a note.`;
    },
  },
  {
    id: 'fa_teachBike',
    cat: 'rel',
    label: (x) => (x.year < 1880 ? 'Teach them to ride a pony' : 'Teach them to ride a bike'),
    desc: 'Run alongside. Let go. Pray.',
    group: 'Parenting',
    ap: 1,
    scene: (_o) => 'playground',
    avail: onKin(['child', 'grandchild'], { min: 4, max: 10, youMin: 16, extra: (_x, t) => (t.r.meta.rides ? false : true) }),
    run: (x, arg) => {
      const t = tgt(x, arg, ['child', 'grandchild'])!;
      t.r.meta.rides = true;
      x.relMod(t.id, x.int(6, 12), 3);
      x.mods({ happiness: 5 });
      x.remember('taughtRide', `Taught ${t.n.firstName} to ride`, 12, t.id);
      return x.chance(0.3) ? `${t.n.firstName} wobbled straight into a hedge, climbed out and went again. By evening they were unstoppable.` : `You let go and ${t.n.firstName} did not notice for a whole block. Then they did, and screamed with joy.`;
    },
  },
  {
    id: 'fa_teachDrive',
    cat: 'rel',
    label: (x) => (x.year < 1910 ? 'Teach them to drive the cart' : 'Teach them to drive'),
    desc: 'Mirror, signal, gasp.',
    group: 'Parenting',
    ap: 1,
    scene: 'car',
    avail: onKin(['child', 'grandchild', 'sibling'], { min: 15, max: 25, youMin: 21, extra: (_x, t) => (t.r.meta.drives ? false : true) }),
    run: (x, arg) => {
      const t = tgt(x, arg, ['child', 'grandchild', 'sibling'])!;
      x.mods({ stress: 5 });
      if (x.chance(0.25)) {
        x.money(-cost(x, 300));
        x.relMod(t.id, 2);
        return `${t.n.firstName} reversed into the only post in the empty car park. The bumper will remember.`;
      }
      t.r.meta.drives = true;
      x.relMod(t.id, x.int(5, 10), 3);
      return `${t.n.firstName} made a perfect turn and you only gripped the dashboard twice.`;
    },
  },
  {
    id: 'fa_recital',
    cat: 'rel',
    label: 'Attend their recital',
    desc: 'Front row. Phone down.',
    group: 'Parenting',
    ap: 1,
    scene: 'theater',
    avail: onKin(['child', 'grandchild', 'sibling'], { min: 5, max: 18 }),
    run: (x, arg) => {
      const t = tgt(x, arg, ['child', 'grandchild', 'sibling'])!;
      x.relMod(t.id, x.int(6, 11), 3);
      x.mods({ happiness: 4 });
      return x.pick([`${t.n.firstName} played the recorder like it owed them money. You gave a standing ovation.`, `${t.n.firstName} was Tree Number Three and the best tree you have ever seen.`, `${t.n.firstName} spotted you in the crowd and waved mid-song. Your heart melted.`]);
    },
  },
  {
    id: 'fa_pocketMoney',
    cat: 'rel',
    label: 'Give pocket money',
    desc: 'Teach them the value of money. Or sweets.',
    group: 'Parenting',
    ap: 1,
    scene: 'moneyDown',
    avail: onKin(['child', 'grandchild'], { min: 5, max: 17, youMin: 18 }),
    options: (x) => [5, 20, 100].map((v) => ({ value: String(v), label: x.fmt(cost(x, v)), disabled: x.c.money < cost(x, v) ? 'Cannot afford' : undefined })),
    run: (x, arg) => {
      const t = tgt(x, arg, ['child', 'grandchild'])!;
      const amt = cost(x, Number(optOf(arg)) || 5);
      if (!x.spend(amt)) return 'You cannot afford that.';
      t.n.wealth += amt;
      t.n.favor = (t.n.favor ?? 0) + 1;
      x.relMod(t.id, Math.min(10, 2 + Math.round(Math.log10(Math.max(10, amt)) * 2)));
      return x.chance(0.4) ? `${t.n.firstName} spent it all on sweets within the hour. Character building.` : `${t.n.firstName} put it in a jar labelled "FUTURE". You are oddly proud.`;
    },
  },
  {
    id: 'fa_heartToHeart',
    cat: 'rel',
    label: 'Have a heart-to-heart',
    desc: 'The real conversation.',
    group: 'Family',
    ap: 1,
    scene: 'calm',
    avail: onKin(['child', 'grandchild', 'parent', 'sibling', 'grandparent'], { min: 10, youMin: 10 }),
    run: (x, arg) => {
      const t = tgt(x, arg, ['child', 'grandchild', 'parent', 'sibling', 'grandparent'])!;
      x.train('empathyListening', 2);
      const p = 0.4 + x.stat('empathy') / 200 + t.r.trust / 300;
      if (x.chance(p)) {
        x.relMod(t.id, x.int(8, 14), 8);
        x.mods({ happiness: 3, loneliness: -4 });
        return `${t.n.firstName} told you something they had never told anyone. You listened, and it changed things between you.`;
      }
      x.relMod(t.id, 1, 1);
      return `You tried. ${t.n.firstName} said "I'm fine" eleven times. Maybe next time.`;
    },
  },
  {
    id: 'fa_playground',
    cat: 'rel',
    label: 'Take them to the playground',
    desc: 'Push the swing. Higher!',
    group: 'Parenting',
    ap: 1,
    scene: 'playground',
    avail: onKin(['child', 'grandchild', 'sibling'], { min: 1, max: 9, youMin: 12, from: 1880 }),
    run: (x, arg) => {
      const t = tgt(x, arg, ['child', 'grandchild', 'sibling'])!;
      x.relMod(t.id, x.int(5, 9), 2);
      boost(t.n, 'health', 1);
      x.mods({ happiness: 3, fitness: 1 });
      return `${t.n.firstName} went down the slide forty times and wanted forty more.`;
    },
  },
  {
    id: 'fa_coachTeam',
    cat: 'rel',
    label: 'Coach their team',
    desc: 'Orange slices at half time.',
    group: 'Parenting',
    ap: 1,
    scene: 'sports',
    avail: onKin(['child', 'grandchild'], { min: 6, max: 16, youMin: 21, from: 1880 }),
    run: (x, arg) => {
      const t = tgt(x, arg, ['child', 'grandchild'])!;
      x.train('leadership', 2);
      x.train('ballSports', 2);
      boost(t.n, 'health', 1);
      const win = x.chance(0.45);
      x.relMod(t.id, x.int(4, 9), 2);
      return win ? `Your team of tiny chaos won the league. ${t.n.firstName} scored and pointed at you.` : `Your team lost 9-0 and celebrated like champions anyway. ${t.n.firstName} got Player of the Match for enthusiasm.`;
    },
  },
  {
    id: 'fa_teachCook',
    cat: 'rel',
    label: 'Teach them to cook',
    desc: 'Pass down the family recipe.',
    group: 'Parenting',
    ap: 1,
    scene: 'cooking',
    avail: onKin(['child', 'grandchild'], { min: 8, youMin: 18 }),
    run: (x, arg) => {
      const t = tgt(x, arg, ['child', 'grandchild'])!;
      x.train('cooking', 1);
      x.relMod(t.id, x.int(5, 9), 2);
      return x.chance(0.35) ? `${t.n.firstName} added chilli instead of paprika. The family now calls it "the incident".` : `${t.n.firstName} nailed the family recipe on the first try. You are both slightly annoyed and very proud.`;
    },
  },
  {
    id: 'fa_payTuition',
    cat: 'rel',
    label: 'Pay for their education',
    desc: 'Invest in their future.',
    group: 'Parenting',
    ap: 1,
    scene: 'graduation',
    avail: onKin(['child', 'grandchild'], { min: 16, max: 26, youMin: 30, from: 1800, extra: (x, t) => (t.r.meta.tuition ? false : moneyOk(x, cost(x, 20000))) }),
    run: (x, arg) => {
      const t = tgt(x, arg, ['child', 'grandchild'])!;
      if (!x.spend(cost(x, 20000))) return 'You cannot afford that.';
      t.r.meta.tuition = true;
      boost(t.n, 'smarts', 5);
      t.n.favor = (t.n.favor ?? 0) + 3;
      x.relMod(t.id, x.int(10, 16), 5);
      return `You covered ${t.n.firstName}'s fees. They hugged you so hard your back clicked.`;
    },
  },
  {
    id: 'fa_bake',
    cat: 'rel',
    label: 'Bake together',
    desc: 'Flour on every surface.',
    group: 'Grandkids',
    ap: 1,
    scene: 'cooking',
    avail: onKin(['grandchild', 'child'], { min: 3, max: 14, youMin: 16 }),
    run: (x, arg) => {
      const t = tgt(x, arg, ['grandchild', 'child'])!;
      x.train('baking', 2);
      x.relMod(t.id, x.int(5, 10), 2);
      x.mods({ happiness: 4 });
      return x.pick([`${t.n.firstName} ate half the dough before it reached the oven. The other half was excellent.`, `You made biscuits shaped like dinosaurs. ${t.n.firstName} named every one before eating it.`]);
    },
  },
  {
    id: 'fa_oldDays',
    cat: 'rel',
    label: 'Tell them about the old days',
    desc: 'Back in my day...',
    group: 'Grandkids',
    ap: 1,
    scene: 'grandparents',
    avail: onKin(['grandchild', 'child'], { min: 5, youMin: 50 }),
    run: (x, arg) => {
      const t = tgt(x, arg, ['grandchild', 'child'])!;
      x.relMod(t.id, x.int(3, 8), 2);
      x.mods({ wisdom: 1, happiness: 2 });
      const then = x.year - (x.age - 10);
      return x.chance(0.3) ? `${t.n.firstName} asked if you had dinosaurs in ${then}. You said only one: your old teacher.` : `You told ${t.n.firstName} what ${then} was really like. They listened like it was a fairy tale.`;
    },
  },
  {
    id: 'fa_spoil',
    cat: 'rel',
    label: 'Spoil them rotten',
    desc: 'The privilege of grandparents.',
    group: 'Grandkids',
    ap: 1,
    scene: 'shopping',
    avail: onKin(['grandchild'], { max: 17, extra: (x) => moneyOk(x, cost(x, 150)) }),
    run: (x, arg) => {
      const t = tgt(x, arg, ['grandchild'])!;
      x.spend(cost(x, 150));
      t.n.favor = (t.n.favor ?? 0) + 2;
      x.relMod(t.id, x.int(7, 12), 1);
      const parent = x.rels('child').find((r) => x.npc(r.npcId)?.alive);
      if (parent && x.chance(0.4)) x.relMod(parent.npcId, -3);
      return `Toys, sweets and a late bedtime. ${t.n.firstName}'s parents are furious; ${t.n.firstName} thinks you are a god.`;
    },
  },
  {
    id: 'fa_visitParent',
    cat: 'rel',
    label: 'Visit them',
    desc: 'Bring biscuits.',
    group: 'Family',
    ap: 1,
    scene: 'family',
    avail: onKin(['parent', 'grandparent'], { youMin: 18 }),
    run: (x, arg) => {
      const t = tgt(x, arg, ['parent', 'grandparent'])!;
      x.relMod(t.id, x.int(5, 10), 2);
      x.mods({ loneliness: -4, happiness: 2 });
      return x.pick([`${t.n.firstName} fed you until you could not move and then packed leftovers.`, `${t.n.firstName} showed you every photo on the mantelpiece. Again. You did not mind.`, `${t.n.firstName} had a list of jobs waiting by the door. You fixed the shelf.`]);
    },
  },
  {
    id: 'fa_doctor',
    cat: 'rel',
    label: 'Take them to the doctor',
    desc: 'Make them go. They will not go alone.',
    group: 'Family',
    ap: 1,
    scene: 'checkup',
    avail: (x, arg) => {
      if (x.c.legal.prison || x.age < 16) return false;
      const t = tgt(x, arg, ['parent', 'grandparent', 'child', 'grandchild', 'spouse', 'sibling']);
      if (!t) return false;
      const elderly = ['parent', 'grandparent', 'spouse', 'sibling'].includes(t.r.type) && t.age >= 60;
      const young = ['child', 'grandchild'].includes(t.r.type) && t.age < 14;
      if (!elderly && !young) return false;
      return moneyOk(x, cost(x, 80));
    },
    run: (x, arg) => {
      const t = tgt(x, arg, ['parent', 'grandparent', 'child', 'grandchild', 'spouse', 'sibling'])!;
      x.spend(cost(x, 80));
      const heal = t.n.health < 50 ? x.int(5, 12) : x.int(1, 4);
      boost(t.n, 'health', heal);
      x.relMod(t.id, x.int(4, 8), 4);
      if (t.n.health < 40) return `The doctor caught something early in ${t.n.firstName}. You may have just bought them years.`;
      return t.age < 14 ? `${t.n.firstName} was brave for the injection and got a sticker. You got one too.` : `${t.n.firstName} grumbled the whole way there and thanked you the whole way home.`;
    },
  },
  {
    id: 'fa_askAdvice',
    cat: 'rel',
    label: 'Ask for their advice',
    desc: 'They have been here before.',
    group: 'Family',
    ap: 1,
    scene: 'calm',
    avail: onKin(['parent', 'grandparent', 'sibling'], { min: 18, youMin: 10 }),
    run: (x, arg) => {
      const t = tgt(x, arg, ['parent', 'grandparent', 'sibling'])!;
      x.relMod(t.id, x.int(3, 7), 3);
      const wise = x.chance(0.35 + t.n.smarts / 200);
      if (wise) {
        x.mods({ wisdom: 2, stress: -4, anxiety: -2 });
        return `${t.n.firstName} said exactly the right thing in very few words. You wrote it down.`;
      }
      x.mods({ stress: -1 });
      return `${t.n.firstName}'s advice was to "just buy a house". Helpful as always.`;
    },
  },
  {
    id: 'fa_moveIn',
    cat: 'rel',
    label: 'Move them in with you',
    desc: 'The spare room becomes their room.',
    group: 'Family',
    ap: 1,
    scene: 'moving',
    avail: onKin(['parent', 'grandparent'], { min: 65, youMin: 25, extra: (_x, t) => (t.r.meta.livesWithYou ? false : true) }),
    run: (x, arg) => {
      const t = tgt(x, arg, ['parent', 'grandparent'])!;
      t.r.meta.livesWithYou = true;
      x.relMod(t.id, x.int(8, 14), 5);
      boost(t.n, 'health', 3);
      x.mods({ stress: 5, karma: 3 });
      if (x.lover()) x.relMod(x.lover()!.npcId, -4);
      return `${t.n.firstName} moved in with three suitcases and forty opinions about your kitchen.`;
    },
  },
  {
    id: 'fa_thank',
    cat: 'rel',
    label: 'Thank them for everything',
    desc: 'Say it while you can.',
    group: 'Family',
    ap: 1,
    scene: 'reunion',
    avail: onKin(['parent', 'grandparent'], { youMin: 20 }),
    run: (x, arg) => {
      const t = tgt(x, arg, ['parent', 'grandparent'])!;
      x.relMod(t.id, x.int(8, 14), 5);
      x.mods({ happiness: 4 });
      x.remember('thankedParent', `Thanked ${x.name(t.n)} for everything`, 12, t.id);
      return `${t.n.firstName} waved it away, said it was nothing, then cried in the kitchen when they thought you had gone.`;
    },
  },
  {
    id: 'fa_fixHouse',
    cat: 'rel',
    label: 'Fix up their house',
    desc: 'Leaky taps and wobbly banisters.',
    group: 'Family',
    ap: 1,
    scene: 'construction',
    avail: onKin(['parent', 'grandparent'], { min: 55, youMin: 18 }),
    run: (x, arg) => {
      const t = tgt(x, arg, ['parent', 'grandparent'])!;
      x.train('carpentry', 2);
      x.train('plumbing', 1);
      x.relMod(t.id, x.int(5, 9), 2);
      return x.chance(0.3) ? `You fixed the tap and somehow broke the toilet. ${t.n.firstName} called a professional and told you it was lovely.` : `New railing, new tap, and ${t.n.firstName} told every neighbour about it.`;
    },
  },
  {
    id: 'fa_techHelp',
    cat: 'rel',
    label: (x) => (x.year < 2005 ? 'Fix their computer' : 'Fix their phone'),
    desc: 'Have you tried turning it off and on?',
    group: 'Family',
    ap: 1,
    scene: 'gadget',
    avail: onKin(['parent', 'grandparent'], { min: 55, youMin: 12, from: 1990 }),
    run: (x, arg) => {
      const t = tgt(x, arg, ['parent', 'grandparent'])!;
      x.train('electronicsRepair', 1);
      x.relMod(t.id, x.int(3, 7), 2);
      x.mods({ stress: 2 });
      return x.pick([`${t.n.firstName} had forty-three toolbars installed. You removed them all. They will be back.`, `The "broken" screen was simply switched off. ${t.n.firstName} swore you to secrecy.`, `You set up a video call so ${t.n.firstName} can see the grandkids. They hold the phone to their ear anyway.`]);
    },
  },
  {
    id: 'fa_prank',
    cat: 'rel',
    label: 'Prank them',
    desc: 'Sibling law demands it.',
    group: 'Siblings',
    ap: 1,
    scene: (_o, res) => (/revenge|furious/.test(res) ? 'argument' : 'friends'),
    avail: onKin(['sibling'], { min: 5, youMin: 5 }),
    run: (x, arg) => {
      const t = tgt(x, arg, ['sibling'])!;
      x.train('comedy', 1);
      const pr = x.pick(['salt in the sugar bowl', 'a rubber spider in the shoe', 'swapping every photo in their room with a picture of a goat', 'cling film over the toilet']);
      if (x.chance(0.3)) {
        x.relMod(t.id, -6);
        return `${pr[0].toUpperCase()}${pr.slice(1)}. ${t.n.firstName} was furious and has sworn revenge. Sleep lightly.`;
      }
      x.relMod(t.id, x.int(2, 6));
      x.mods({ happiness: 3 });
      return `${pr[0].toUpperCase()}${pr.slice(1)}. ${t.n.firstName} laughed despite themselves.`;
    },
  },
  {
    id: 'fa_reminisce',
    cat: 'rel',
    label: 'Reminisce about childhood',
    desc: 'Remember when...',
    group: 'Siblings',
    ap: 1,
    scene: 'family',
    avail: onKin(['sibling', 'parent', 'grandparent'], { min: 14, youMin: 16 }),
    run: (x, arg) => {
      const t = tgt(x, arg, ['sibling', 'parent', 'grandparent'])!;
      x.relMod(t.id, x.int(4, 9), 2);
      x.mods({ happiness: 3, loneliness: -3 });
      return x.pick([`You and ${t.n.firstName} remembered the same story completely differently. Both of you are certain.`, `${t.n.firstName} still has the scar from your "harmless" experiment. You both laughed until you cried.`, `You found an old photo album and lost an afternoon to it with ${t.n.firstName}.`]);
    },
  },
  {
    id: 'fa_siblingTrip',
    cat: 'rel',
    label: 'Sibling road trip',
    desc: 'Like when you were kids, but you drive.',
    group: 'Siblings',
    ap: 2,
    scene: 'roadTrip',
    avail: onKin(['sibling'], { min: 18, youMin: 18, extra: (x) => moneyOk(x, cost(x, 300)) }),
    run: (x, arg) => {
      const t = tgt(x, arg, ['sibling'])!;
      x.spend(cost(x, 300));
      x.relMod(t.id, x.int(8, 15), 4);
      x.mods({ happiness: 6, stress: -5 });
      return `A thousand miles with ${t.n.firstName}, one argument about the radio and a lifetime of new in-jokes.`;
    },
  },
  {
    id: 'fa_siblingRivalry',
    cat: 'rel',
    label: 'Settle an old score',
    desc: 'Arm wrestle. Best of three.',
    group: 'Siblings',
    ap: 1,
    scene: 'sports',
    avail: onKin(['sibling'], { min: 10, youMin: 10 }),
    run: (x, arg) => {
      const t = tgt(x, arg, ['sibling'])!;
      const win = x.chance(0.3 + x.stat('fitness') / 200);
      x.relMod(t.id, x.int(-2, 5));
      x.mods({ ego: win ? 3 : -2 });
      return win ? `You beat ${t.n.firstName} at last. You will mention it at every family dinner until you die.` : `${t.n.firstName} won. Again. Some things never change.`;
    },
  },
  {
    id: 'fa_listenStories',
    cat: 'rel',
    label: 'Listen to their stories',
    desc: 'They have been waiting for someone to ask.',
    group: 'Family',
    ap: 1,
    scene: 'grandparents',
    avail: onKin(['grandparent', 'parent'], { min: 60 }),
    run: (x, arg) => {
      const t = tgt(x, arg, ['grandparent', 'parent'])!;
      x.relMod(t.id, x.int(6, 11), 3);
      x.mods({ wisdom: 2, happiness: 2 });
      x.train('history', 1);
      return x.pick([`${t.n.firstName} told you about the love before your grandparent. You had no idea.`, `${t.n.firstName} described ${x.year - t.age + 15} like it was yesterday. You took notes.`, `${t.n.firstName} told the same story twice, and it was better the second time.`]);
    },
  },
  {
    id: 'fa_cards',
    cat: 'rel',
    label: 'Play cards with them',
    desc: 'They will cheat. Let them.',
    group: 'Family',
    ap: 1,
    scene: 'gaming',
    avail: onKin(['grandparent', 'parent', 'grandchild'], { min: 6, youMin: 6, from: 1400 }),
    run: (x, arg) => {
      const t = tgt(x, arg, ['grandparent', 'parent', 'grandchild'])!;
      x.relMod(t.id, x.int(3, 7), 1);
      x.mods({ stress: -2 });
      return x.chance(0.6) ? `${t.n.firstName} won every hand and swore it was luck. It was not luck.` : `You won for once and ${t.n.firstName} demanded a rematch until midnight.`;
    },
  },
  {
    id: 'fa_babysit',
    cat: 'rel',
    label: 'Offer to babysit',
    desc: 'Give them a night off.',
    group: 'Family',
    ap: 1,
    scene: 'playground',
    avail: onKin(['sibling', 'child'], { min: 20, youMin: 14, extra: (x, t) => (Object.values(x.s.npcs).some((n) => n.alive && n.parentIds?.includes(t.id) && x.npcAge(n) < 12) ? true : false) }),
    run: (x, arg) => {
      const t = tgt(x, arg, ['sibling', 'child'])!;
      x.relMod(t.id, x.int(6, 11), 4);
      x.mods({ stress: 3, happiness: 2 });
      return x.pick([`${t.n.firstName} came home to sleeping children and a spotless kitchen. You are now the favourite.`, `The kids convinced you bedtime was midnight. ${t.n.firstName} knows. ${t.n.firstName} forgives.`]);
    },
  },
];

export const FAMILY_ACTIONS: ActionDef[] = [...GENERAL, ...PER];
