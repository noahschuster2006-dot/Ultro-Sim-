import type { Ctx } from '../ctx';
import { moneyOk, optOf, price, type ActionDef } from './common';

/** The Health app's self-care tab: grooming, check-ups, habits and small kindnesses to yourself. */

type Mods = Parameters<Ctx['mods']>[0];

interface Care {
  id: string;
  label: string | ((x: Ctx) => string);
  group: string;
  desc: string;
  scene: ActionDef['scene'];
  years?: [number, number];
  minAge?: number;
  /** Modern dollars, scaled by era; under-16s are paid for. */
  cost?: number;
  when?: (x: Ctx) => true | string | false;
  options?: ActionDef['options'];
  run: (x: Ctx, opt?: string) => string;
}

const costOf = (x: Ctx, n?: number): number => (n && x.c.age >= 16 ? price(x, n) : 0);

function care(o: Care): ActionDef {
  return {
    id: o.id,
    cat: 'selfcare',
    label: o.label,
    desc: o.desc,
    group: o.group,
    ap: 1,
    scene: o.scene,
    options: o.options,
    avail: (x) => {
      if (o.years && (x.year < o.years[0] || x.year > o.years[1])) return false;
      if (o.minAge !== undefined && x.c.age < o.minAge) return x.c.age < 4 ? false : `Age ${o.minAge}+`;
      if (o.cost && x.c.legal.prison) return false;
      if (o.when) {
        const w = o.when(x);
        if (w !== true) return w;
      }
      const c = costOf(x, o.cost);
      return c ? moneyOk(x, c) : true;
    },
    run: (x, arg) => {
      const c = costOf(x, o.cost);
      if (c && !x.spend(c)) return `You cannot afford it (${x.fmt(c)}).`;
      return o.run(x, optOf(arg));
    },
  };
}

/** good / ok / bad by a stat-ish score plus luck. */
function luck(x: Ctx, score: number): 'good' | 'ok' | 'bad' {
  const v = Math.max(0, Math.min(100, score)) * 0.5 + x.int(0, 60);
  return v >= 65 ? 'good' : v < 28 ? 'bad' : 'ok';
}

function outcome(x: Ctx, score: number, lines: { good: string[]; ok: string[]; bad: string[] }, m: { base?: Mods; good?: Mods; ok?: Mods; bad?: Mods } = {}): string {
  if (m.base) x.mods(m.base);
  const t = luck(x, score);
  if (t === 'good' && m.good) x.mods(m.good);
  if (t === 'ok' && m.ok) x.mods(m.ok);
  if (t === 'bad' && m.bad) x.mods(m.bad);
  return x.pick(lines[t]);
}

const literate = (x: Ctx): true | string => (x.year < 1450 && x.skill('literacy') < 20 ? 'You cannot write' : true);

// ---------------------------------------------------------------- Looking good
const LOOKS: ActionDef[] = [
  care({
    id: 'sc_haircut', label: (x) => (x.year < 1900 ? 'Visit the barber' : 'Get a haircut'), group: 'Looking good', scene: 'spa', cost: 30, minAge: 3,
    desc: 'A trim, a new style, or a brave mistake.',
    run: (x) => outcome(x, x.stat('looks'), {
      good: ['The new cut takes years off you. Strangers are holding doors open.', 'You keep touching it in reflections. It is that good.'],
      ok: ['A perfectly fine haircut. Nobody noticed, which is the point.', 'Shorter. Definitely shorter.'],
      bad: [x.year < 1900 ? 'The barber also offered to pull a tooth. You should have let him do that instead.' : 'You said "just a trim". They heard "reinvent me".', 'One side is shorter than the other. Hats are your friend now.'],
    }, { good: { looks: 3, confidence: 3 }, ok: { looks: 1 }, bad: { looks: -2, confidence: -2 } }),
  }),
  care({
    id: 'sc_skincare', label: (x) => (x.year < 1850 ? 'Anoint with oils' : 'Skincare routine'), group: 'Looking good', scene: 'spa', cost: 20, minAge: 12,
    desc: (`Cleanse, moisturise, believe.`),
    run: (x) => outcome(x, x.stat('discipline'), {
      good: ['You are glowing. Someone asked if you had been on holiday.', 'Your skin is so smooth you keep touching your own face.'],
      ok: ['Your face feels clean and slightly expensive.', 'Ten steps, five minutes, mild results.'],
      bad: [x.year < 1850 ? 'The fashionable lead powder made you look like a frightened ghost.' : 'A new serum gave you a rash shaped like a small country.', 'You broke out the day before a big event. Classic.'],
    }, { base: { stress: -2 }, good: { looks: 3 }, ok: { looks: 1 }, bad: { looks: -2 } }),
  }),
  care({
    id: 'sc_manicure', label: 'Get a manicure', group: 'Looking good', scene: 'spa', years: [1900, 2300], cost: 35, minAge: 10,
    desc: 'Tiny brushes, big confidence.',
    run: (x) => outcome(x, 50, {
      good: ['Perfect nails. You find excuses to point at things.', 'The colour is so good you got three compliments by lunch.'],
      ok: ['Neat and tidy. You smudged one getting your keys out.', 'Shiny, short, sensible.'],
      bad: ['You chipped one in the doorway on your way out.', 'The nail artist talked about their ex the whole time.'],
    }, { base: { stress: -2 }, good: { looks: 2, confidence: 2 }, ok: { looks: 1 } }),
  }),
  care({
    id: 'sc_whiten', label: 'Whiten your teeth', group: 'Looking good', scene: 'dentist', years: [1990, 2300], cost: 300, minAge: 16,
    desc: 'A brighter smile, a slightly sensitive one.',
    run: (x) => outcome(x, 55, {
      good: ['Your smile could guide ships into harbour.', 'People keep saying you look well-rested.'],
      ok: ['Two shades whiter and a twinge with ice cream.', 'A subtle glow-up. You notice it, anyway.'],
      bad: ['Too white. You look like a game-show host.', 'Every cold drink feels like a lightning bolt.'],
    }, { good: { looks: 3, confidence: 3 }, ok: { looks: 1 }, bad: { pain: 3 } }),
  }),
  care({
    id: 'sc_tan', label: 'Tanning session', group: 'Looking good', scene: 'beach', years: [1978, 2035], cost: 25, minAge: 18,
    desc: 'A bronzed glow with a side of warnings.',
    run: (x) => outcome(x, 50, {
      good: ['You look like you just got back from somewhere expensive.', 'Golden. Glowing. Smug.'],
      ok: ['A light tan and a lingering smell of coconut.', 'Slightly browner, slightly warmer.'],
      bad: ['You are orange. Not tanned. Orange.', 'Stripes. Somehow, stripes.'],
    }, { base: { health: -1 }, good: { looks: 2 }, bad: { looks: -2, confidence: -2 } }),
  }),
  care({
    id: 'sc_glasses', label: (x) => (x.year < 1950 ? 'Get spectacles' : 'Sort out your eyesight'), group: 'Looking good', scene: 'checkup', years: [1290, 2300], minAge: 6,
    desc: 'See the world in sharper focus.',
    options: (x) => {
      const opts = [
        { value: 'spectacles', label: x.year < 1900 ? `Spectacles (${x.fmt(price(x, 150))})` : `Glasses (${x.fmt(price(x, 150))})`, cost: 150, from: 1290 },
        { value: 'contacts', label: `Contact lenses (${x.fmt(price(x, 300))})`, cost: 300, from: 1950 },
        { value: 'laser', label: `Laser eye surgery (${x.fmt(price(x, 3000))})`, cost: 3000, from: 1995 },
        { value: 'smart', label: `Smart lenses with a display (${x.fmt(price(x, 2000))})`, cost: 2000, from: 2040 },
      ];
      return opts.filter((o) => x.year >= o.from).map((o) => ({ value: o.value, label: o.label, disabled: x.c.age >= 16 && x.c.money < price(x, o.cost) ? `Costs ${x.fmt(price(x, o.cost))}` : o.value === 'laser' && x.c.age < 18 ? 'Age 18+' : undefined }));
    },
    when: (x) => (x.c.legal.prison ? false : true),
    run: (x, opt) => {
      const cost = { spectacles: 150, contacts: 300, laser: 3000, smart: 2000 }[opt ?? 'spectacles'] ?? 150;
      const c = costOf(x, cost);
      if (c && !x.spend(c)) return `You cannot afford it (${x.fmt(c)}).`;
      x.setFlag('eyewear', opt ?? 'spectacles');
      x.mods({ stress: -2, smarts: 1 });
      if (opt === 'laser') { x.mods({ happiness: 6, looks: 1 }); return 'The laser hummed, you smelled something odd, and then you could read road signs from a mile away.'; }
      if (opt === 'contacts') { x.mod('happiness', 3); return 'It took you forty minutes to get the first lens in. Worth it.'; }
      if (opt === 'smart') { x.mods({ happiness: 4, smarts: 2 }); return 'Your new lenses display the weather, your messages and, unasked, a stranger\'s rating.'; }
      x.mods({ happiness: 3, looks: x.chance(0.5) ? 1 : -1 });
      return x.year < 1700 ? 'With your new spectacles you discovered that trees have individual leaves. People call you "scholar" now.' : 'Trees have leaves! Individual leaves! Nobody told you.';
    },
  }),
];

// ---------------------------------------------------------------- Body
const BODY: ActionDef[] = [
  care({
    id: 'sc_checkup', label: (x) => (x.year < 1850 ? 'Consult a physician' : x.year >= 2025 ? 'Full-body scan' : 'Get a check-up'), group: 'Body', cost: 120, minAge: 1,
    scene: 'checkup',
    desc: 'Make sure all the parts are still attached and working.',
    run: (x) => {
      if (x.year < 1850) {
        const leeches = x.chance(0.5);
        x.mods(leeches ? { health: x.int(-3, 1), pain: 2 } : { anxiety: -1 });
        return leeches ? 'The physician declared an excess of blood and applied leeches. You feel lighter, mostly in the wallet.' : 'The physician studied your urine by candlelight and pronounced you "phlegmatic". Fair.';
      }
      x.mods({ anxiety: -2, health: 2 });
      if (x.year >= 2025) {
        if (x.chance(0.2)) { x.mods({ anxiety: 3 }); return 'The scanner found a harmless cyst and a scarier bill. You are fine.'; }
        return 'The machine scanned every cell and said, in a soothing voice, "excellent". You will take it.';
      }
      if (x.stat('health') < 40) { x.mod('anxiety', 2); return 'The doctor frowned at your numbers and said "we need to talk about lifestyle". You nodded and ate a biscuit on the way home.'; }
      return x.pick(['Blood pressure good, reflexes good, the doctor\'s jokes less good.', 'A clean bill of health and a lollipop, which you did not refuse.']);
    },
  }),
  care({
    id: 'sc_dentist', label: (x) => (x.year < 1850 ? 'Have a tooth pulled' : 'Go to the dentist'), group: 'Body', scene: 'dentist', cost: 120, minAge: 3,
    desc: 'Open wide.',
    run: (x) => {
      if (x.year < 1850) {
        x.mods({ pain: x.int(5, 12), health: 2 });
        return x.pick(['The barber-surgeon pulled the tooth with pliers and a knee on your chest. The ache is gone. So is your faith in humanity.', 'A travelling tooth-drawer pulled the wrong one, then the right one. Two for one.']);
      }
      return outcome(x, x.stat('discipline'), {
        good: ['No cavities. The dentist called you "a joy". You will frame it.', 'Sparkling report. You flossed all the way home.'],
        ok: ['One small filling and a long lecture about flossing.', 'A scale and polish. Your mouth feels like a new car.'],
        bad: ['A root canal. You heard the drill in your dreams.', 'Three fillings. The dentist sighed like a disappointed parent.'],
      }, { base: { health: 1 }, good: { looks: 1, happiness: 2 }, bad: { pain: 6 } });
    },
  }),
  care({
    id: 'sc_eyeExam', label: 'Eye exam', group: 'Body', scene: 'checkup', years: [1850, 2300], cost: 60, minAge: 4,
    desc: 'Read the bottom line, if you can.',
    run: (x) => {
      x.mods({ anxiety: -1 });
      if (x.c.age > 40 && x.chance(0.5)) return 'Your arms are no longer long enough to read menus. The optician confirmed it gently.';
      return x.pick(['Perfect vision. You read the tiny copyright line just to show off.', 'Slightly short-sighted. You knew. You were squinting at the clock.', 'You guessed half the letters. The optician was not fooled.']);
    },
  }),
  care({
    id: 'sc_massage', label: 'Get a massage', group: 'Body', scene: 'spa', cost: 80, minAge: 14,
    desc: 'Knots out, sighs in.',
    run: (x) => outcome(x, 55, {
      good: ['The masseur found a knot you have been carrying since school. It is gone.', 'You melted. You may have drooled. No regrets.'],
      ok: ['Relaxing, apart from the panpipe music.', 'Your shoulders came down an inch.'],
      bad: ['It was so firm you are now bruised in places you did not know you had.', 'They talked the whole time about pyramid schemes.'],
    }, { base: { stress: -6, pain: -4 }, good: { stress: -4, happiness: 4 }, bad: { pain: 3 } }),
  }),
  care({
    id: 'sc_spa', label: (x) => (x.year < 1850 ? 'Take the waters at a spa town' : 'Spa day'), group: 'Body', scene: 'spa', years: [1600, 2300], cost: 200, minAge: 14,
    desc: 'Robes, steam and cucumber water.',
    run: (x) => outcome(x, 60, {
      good: [x.year < 1850 ? 'You drank the foul-smelling spring water and, astonishingly, feel marvellous.' : 'Steam room, pool, nap, repeat. You are now a different, softer person.', 'You forgot your phone existed for six hours.'],
      ok: ['Fluffy robe, mediocre lunch, wonderful pool.', 'Relaxing enough. The mud wrap was a bit much.'],
      bad: ['The sauna was full of men discussing their investments.', 'You slipped on a wet floor and lost your calm and your slipper.'],
    }, { base: { stress: -8, anxiety: -3, health: 1 }, good: { happiness: 6, looks: 1 }, bad: { pain: 2 } }),
  }),
  care({
    id: 'sc_sauna', label: (x) => (x.year < 1900 ? 'Sweat in a bathhouse' : 'Sit in a sauna'), group: 'Body', scene: 'spa', cost: 15, minAge: 12,
    desc: 'Sweat it out.',
    run: (x) => outcome(x, x.stat('health'), {
      good: ['Twenty minutes of heat and you feel scrubbed clean, inside and out.', 'You sat next to a wise old man who explained life in four sentences.'],
      ok: ['Hot. Very hot. Then less hot. Good.', 'You lasted ten minutes and called it a win.'],
      bad: ['You stood up too fast and saw stars.', 'Someone poured water on the stones like they had a grudge.'],
    }, { base: { stress: -5, health: 1 }, bad: { health: -1 } }),
  }),
  care({
    id: 'sc_coldPlunge', label: (x) => (x.year < 1950 ? 'Bathe in an icy river' : 'Cold plunge'), group: 'Body', scene: 'beach', minAge: 12,
    desc: 'Get into freezing water. On purpose.',
    run: (x) => outcome(x, x.stat('willpower'), {
      good: ['Two minutes of icy water and you are awake for a week. A hero, briefly.', 'You did not scream. Internally, you screamed.'],
      ok: ['You lasted thirty seconds and made a noise like a kettle.', 'Brutal, bracing, oddly brilliant.'],
      bad: ['You got in, got out and got a cold.', 'Your lungs forgot how to work for a second.'],
    }, { base: { stress: -4, willpower: 2, depression: -2 }, good: { immunity: 2, happiness: 4 }, bad: { health: -2 } }),
  }),
  care({
    id: 'sc_stretch', label: 'Morning stretches', group: 'Body', scene: 'yoga', minAge: 6,
    desc: 'Reach for the ceiling, touch your toes, groan.',
    run: (x) => {
      x.mods({ pain: -3, stress: -2, fitness: 1 });
      return x.c.age > 50 ? x.pick(['Everything creaked like an old ship. Then it felt wonderful.', 'You touched your toes. Well, your shins. Progress.']) : x.pick(['You feel two inches taller.', 'A satisfying crack from your back, and the day can begin.']);
    },
  }),
  care({
    id: 'sc_taiChi', label: 'Tai chi in the park', group: 'Body', scene: 'yoga', years: [1700, 2300], minAge: 8,
    desc: 'Slow movements, quick calm.',
    run: (x) => {
      x.train('martialArts', 1);
      x.train('meditation', 1);
      return outcome(x, x.stat('discipline'), {
        good: ['A group of elders let you join. You moved like water, mostly.', 'You found a slow rhythm and your head went quiet.'],
        ok: ['You followed along a beat behind, like a polite echo.', 'Peaceful, if slightly confusing.'],
        bad: ['You did the whole routine facing the wrong way.', 'A pigeon was more graceful than you today.'],
      }, { base: { stress: -5, anxiety: -2, fitness: 1 }, good: { happiness: 3, wisdom: 1 } });
    },
  }),
  care({
    id: 'sc_acupuncture', label: 'Acupuncture', group: 'Body', scene: 'calm', years: [-100, 2300], cost: 70, minAge: 16,
    desc: 'Tiny needles, big claims.',
    run: (x) => outcome(x, 50, {
      good: ['You felt a warm tingle and an old ache finally let go.', 'You fell asleep looking like a hedgehog and woke up calm.'],
      ok: ['Relaxing, if you do not look at the needles.', 'Hard to say if it worked. The nap was nice.'],
      bad: ['One needle found a nerve. You said a word not for polite company.', 'You fainted at the sight of the needles. Before they started.'],
    }, { base: { stress: -3 }, good: { pain: -6 }, bad: { pain: 2 } }),
  }),
  care({
    id: 'sc_float', label: 'Float tank', group: 'Body', scene: 'spa', years: [1975, 2300], cost: 60, minAge: 16,
    desc: 'Salt water, total darkness, your own thoughts.',
    run: (x) => outcome(x, 60 - x.stat('anxiety') * 0.4, {
      good: ['You floated in silence and lost track of where you end.', 'An hour in the dark and you came out new.'],
      ok: ['You spent forty minutes thinking about your to-do list. Then ten minutes of peace.', 'Salty, quiet, odd. Pleasant enough.'],
      bad: ['Salt got in your eye and you could not find the button in the dark.', 'Your thoughts were very loud in there.'],
    }, { base: { stress: -5 }, good: { anxiety: -4, happiness: 3 }, bad: { anxiety: 2 } }),
  }),
  care({
    id: 'sc_bath', label: 'Long hot bath', group: 'Body', scene: 'spa', years: [1850, 2300], minAge: 4,
    desc: 'Bubbles, a book and a locked door.',
    run: (x) => {
      x.mods({ stress: -4, pain: -2, happiness: 2 });
      return x.pick(['You stayed until your fingers turned to raisins.', 'Bubbles to the chin, nobody needing anything. Heaven.', 'You fell asleep and woke up in cold soup.']);
    },
  }),
];

// ---------------------------------------------------------------- Habits
const HABITS: ActionDef[] = [
  care({
    id: 'sc_sleep', label: 'Fix your sleep schedule', group: 'Habits', scene: 'calm', minAge: 8,
    desc: 'Same bedtime, no screens, a dark room.',
    run: (x) => outcome(x, x.stat('discipline'), {
      good: ['Eight hours a night for a month. You feel like you were upgraded.', 'You woke up before the alarm, refreshed. Is this what adults feel like?'],
      ok: ['Better most nights. Weekends remain a lawless zone.', 'You went to bed earlier and lay awake earlier.'],
      bad: [x.year >= 2008 ? 'You put your phone down at ten, then picked it up at ten-oh-two.' : 'You went to bed on time and stared at the ceiling until dawn.', 'Your body clock has made it clear who is in charge.'],
    }, { base: { energy: 5 }, good: { health: 3, stress: -5, energy: 10, smarts: 1 }, ok: { stress: -2 } }),
  }),
  care({
    id: 'sc_mealPrep', label: 'Meal prep for the week', group: 'Habits', scene: 'cooking', years: [1950, 2300], cost: 40, minAge: 14,
    desc: 'Seven boxes, seven identical lunches, one smug feeling.',
    run: (x) => {
      x.train('cooking', 2);
      return outcome(x, x.stat('discipline'), {
        good: ['A week of healthy lunches, all eaten. You are a functioning adult.', 'You saved money, ate well and still had leftovers.'],
        ok: ['You ate four boxes and ordered takeaway on Friday.', 'Chicken and rice, five times. Your taste buds are on strike.'],
        bad: ['By Wednesday the boxes had developed their own culture.', 'You forgot them all in the fridge at work.'],
      }, { base: { health: 1 }, good: { health: 3, fitness: 1, discipline: 2 } });
    },
  }),
  care({
    id: 'sc_detox', label: 'Digital detox', group: 'Habits', scene: 'hiking', years: [2010, 2300], minAge: 12,
    desc: 'A weekend without screens.',
    run: (x) => outcome(x, x.stat('willpower'), {
      good: ['You read a book, saw a sunset and remembered your own thoughts.', 'Two days offline. Nothing happened. Everything happened.'],
      ok: ['You checked your phone only twice. Okay, nine times.', 'You twitched for the first day, then it was lovely.'],
      bad: ['You lasted two hours, then "just checked the weather" for three.', 'You missed a group chat drama and will never fully recover.'],
    }, { base: { anxiety: -2 }, good: { stress: -7, happiness: 5, depression: -3 }, bad: { anxiety: 2 } }),
  }),
  care({
    id: 'sc_journal', label: 'Keep a journal', group: 'Habits', scene: 'reading', minAge: 8, when: literate,
    desc: 'Write down what happened, and what it meant.',
    run: (x) => {
      x.train('writing', 2);
      return outcome(x, x.stat('wisdom'), {
        good: ['Writing it down made the problem small enough to hold.', 'You reread last year\'s pages and saw how far you have come.'],
        ok: ['Three pages about lunch. Still therapeutic.', 'You wrote "today was fine" and somehow it helped.'],
        bad: ['You wrote one line and fell asleep on the pen.', 'You found an old entry about an ex and closed the book quickly.'],
      }, { base: { stress: -3 }, good: { wisdom: 2, depression: -3, anxiety: -3 } });
    },
  }),
  care({
    id: 'sc_gratitude', label: 'Write a gratitude list', group: 'Habits', scene: 'calm', minAge: 6,
    desc: 'Three good things, every night.',
    run: (x) => {
      x.mods({ happiness: 3, depression: -2, romanticCynicism: -1 });
      const n = x.c.pets.find((p) => p.alive);
      const thing = n ? n.name : x.lover() ? x.first(x.lover()!.npcId) : x.pick(['warm socks', 'a good sandwich', 'the smell of rain', 'a friend who calls']);
      return x.pick([`At the top of the list: ${thing}. Hard to argue with that.`, `You wrote ten things. Number one was ${thing}. Number ten was "this list".`]);
    },
  }),
  care({
    id: 'sc_breathe', label: 'Breathing exercises', group: 'Habits', scene: 'calm', minAge: 6,
    desc: 'In for four, hold for four, out for four.',
    run: (x) => {
      x.mods({ anxiety: -4, stress: -3 });
      return x.pick(['Your heart slowed down. The world did not, but you did.', 'Four rounds in, you remembered you have a body.', 'You got dizzy, laughed and felt much better.']);
    },
  }),
  care({
    id: 'sc_natureWalk', label: 'Walk in nature', group: 'Habits', scene: 'hiking', minAge: 4, when: (x) => (x.c.legal.prison ? false : true),
    desc: 'Trees are the cheapest therapists.',
    run: (x) => {
      x.mods({ stress: -5, depression: -2, fitness: 1 });
      return x.pick(['A long walk under old trees. Your thoughts finally sorted themselves.', 'You noticed seventeen kinds of green.', 'A fox crossed your path and you both paused politely.']);
    },
  }),
  care({
    id: 'sc_water', label: (x) => (x.year < 1900 ? 'Drink less ale, more water' : 'Drink more water'), group: 'Habits', scene: 'calm', minAge: 6,
    desc: 'A radical health trend.',
    run: (x) => {
      x.mods({ health: 2, energy: 3, looks: 0.5 });
      return x.year < 1850 ? 'You drank from the well instead of the cask. Your stomach had opinions about the well.' : x.pick(['You drank eight glasses and spent the day finding toilets.', 'Your skin glows, your head clears, your bladder files a complaint.']);
    },
  }),
  care({
    id: 'sc_nap', label: 'Take a power nap', group: 'Habits', scene: 'calm', minAge: 2,
    desc: 'Twenty minutes. Not two hours. Twenty minutes.',
    run: (x) => {
      if (x.chance(0.3)) { x.mods({ energy: 2 }); return 'Twenty minutes became three hours. You woke up unsure of the year.'; }
      x.mods({ energy: 8, stress: -2 });
      return 'You woke refreshed, faintly smug and with a crease on your face.';
    },
  }),
  care({
    id: 'sc_cutSugar', label: (x) => (x.year < 1650 ? 'Cut back on sweets' : 'Cut back on sugar and caffeine'), group: 'Habits', scene: 'calm', minAge: 10,
    desc: 'A small sacrifice for a better you.',
    run: (x) => outcome(x, x.stat('willpower'), {
      good: ['Two weeks clean. Your energy is steady and your mood less of a rollercoaster.', 'You walked past a bakery without stopping. You are basically a monk.'],
      ok: ['Mostly successful, apart from a mysterious emergency biscuit.', 'You cut back, then cut back in again.'],
      bad: ['You lasted until 3pm on day one.', 'Withdrawal headache. You were very rude to a printer.'],
    }, { good: { health: 3, fitness: 1, willpower: 2 }, bad: { stress: 2 } }),
  }),
  care({
    id: 'sc_brainTrain', label: (x) => (x.year < 2008 ? 'Do the crossword' : 'Brain-training puzzles'), group: 'Habits', scene: 'study', years: [1913, 2300], minAge: 8,
    desc: 'Keep the old grey cells busy.',
    run: (x) => {
      x.train('logic', 2);
      x.mods({ smarts: 1, stress: -1 });
      return x.pick(['You solved it in record time and announced it to the room.', 'One clue defeated you all day. It was "egg".', 'Your streak is now 40 days. You will never break it.']);
    },
  }),
  care({
    id: 'sc_herbal', label: 'Brew an herbal remedy', group: 'Habits', scene: 'cooking', minAge: 12,
    desc: 'Chamomile, ginger, folk wisdom.',
    run: (x) => {
      x.train('herbalism', 2);
      return outcome(x, x.skill('herbalism') + 30, {
        good: ['Your brew settled your stomach and your nerves.', 'Grandmother\'s recipe, perfectly made. You slept like a stone.'],
        ok: ['It tasted like a lawn, but a soothing lawn.', 'Warm, earthy and mildly helpful.'],
        bad: ['You picked the wrong leaf. You spent the night regretting it.', 'It tasted so bad it cured you of wanting cures.'],
      }, { base: { stress: -2 }, good: { health: 2, anxiety: -2 }, bad: { health: -2 } });
    },
  }),
];

export const SELFCARE_ACTIONS: ActionDef[] = [...LOOKS, ...BODY, ...HABITS];
