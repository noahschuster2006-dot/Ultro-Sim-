import type { Ctx } from '../ctx';
import type { Pet } from '../types';
import { ITEM_BY_ID, ITEM_CATS, itemName, itemsAvailable, type ItemCat } from '../data/items';
import { PET_BY_ID, petsAvailable } from '../data/pets';
import { adoptPet, buyItem, itemEligibility, itemPrice, petAge, petEligibility, petPrice, rehomePet, sellItem } from '../systems/possessions';
import { moneyOk, optOf, price, targetOf, type ActionDef, type ActionOption } from './common';

/**
 * The Shop app (buy, sell, haggle, maintain), the Pets app (adopt) and the
 * per-pet actions you see when you tap one of your animals.
 */

// ---------------------------------------------------------------- Shop
const CAT_SCENE: Record<ItemCat, string> = {
  vehicle: 'car', jewelry: 'jewelry', fashion: 'shopping', tech: 'gadget', art: 'museum', instrument: 'music', home: 'shopping', luxury: 'luxury',
};
const CAT_QUIP: Record<ItemCat, string[]> = {
  vehicle: ['You drove it home the long way, twice.', 'You polished it before you even got it home.', 'You honked at nobody, just to hear it.'],
  jewelry: ['It catches the light every time you gesture, so you gesture a lot now.', 'You keep checking it is still there.', 'Strangers compliment it. You pretend to be modest.'],
  fashion: ['You walked out wearing it and threw the old one away.', 'The mirror and you are on very good terms now.', 'You will wear it everywhere until someone notices.'],
  tech: ['The unboxing alone was a religious experience.', 'You read the whole manual. Twice.', 'It already knows more about you than your mother.'],
  art: ['You moved it around the room for an hour to find the right light.', 'Guests will be made to look at it. Slowly.', 'You stand in front of it with your chin in your hand now.'],
  instrument: ['The first note sounded like hope.', 'The neighbours have not met it yet. They will.', 'You played one chord and called it a song.'],
  home: ['Home feels a little more like a home.', 'You invited people round just to show it off.', 'You use it every day. Mostly.'],
  luxury: ['Money cannot buy happiness, but this is very close.', 'You felt rich in your bones.', 'You told everyone, then pretended you had not.'],
};

function catItems(x: Ctx, cat: ItemCat) {
  return itemsAvailable(x.year).filter((t) => t.cat === cat);
}

function itemOptions(x: Ctx, cat?: ItemCat): ActionOption[] {
  return itemsAvailable(x.year)
    .filter((t) => !cat || t.cat === cat)
    .map((t) => {
      const ok = itemEligibility(x, t);
      return { value: t.id, label: `${itemName(t, x.year)} (${x.fmt(itemPrice(x, t))})`, disabled: ok === true ? undefined : ok };
    });
}

function buyAction(cat: ItemCat, name: string): ActionDef {
  return {
    id: `sh_buy_${cat}`,
    cat: 'shop',
    label: `Buy ${name.toLowerCase()}`,
    desc: `Browse ${name.toLowerCase()} fit for the age you live in.`,
    group: 'Buy',
    ap: 1,
    scene: CAT_SCENE[cat],
    avail: (x) => (x.c.legal.prison ? false : catItems(x, cat).length ? (x.c.age < 6 ? 'Too young to shop' : true) : false),
    options: (x) => itemOptions(x, cat),
    run: (x, arg) => {
      const t = ITEM_BY_ID[optOf(arg) ?? ''];
      if (!t || t.cat !== cat) return 'You browsed for an hour and bought nothing.';
      const ok = itemEligibility(x, t);
      if (ok !== true) return ok;
      return `${buyItem(x, t.id)} ${x.pick(CAT_QUIP[cat])}`;
    },
  };
}

const ownedOptions = (x: Ctx, filter?: (cat: ItemCat | undefined) => boolean): ActionOption[] =>
  x.c.items
    .filter((i) => !filter || filter(ITEM_BY_ID[i.typeId]?.cat))
    .map((i) => ({ value: i.id, label: `${i.name} (worth ~${x.fmt(i.value)})` }));

const SHOP: ActionDef[] = [
  ...ITEM_CATS.map((c) => buyAction(c.id, c.name)),
  {
    id: 'sh_sell', cat: 'shop', label: 'Sell something', group: 'Sell', ap: 1,
    desc: 'Turn a possession back into money.',
    scene: 'moneyUp',
    avail: (x) => (x.c.legal.prison ? false : x.c.items.length ? (x.c.age < 12 ? 'Too young to sell' : true) : 'You own nothing to sell'),
    options: (x) => ownedOptions(x),
    run: (x, arg) => {
      const it = x.item(optOf(arg));
      if (!it) return 'You no longer own that.';
      const wistful = x.chance(0.3) ? ' You miss it already.' : '';
      return sellItem(x, it.id) + wistful;
    },
  },
  {
    id: 'sh_haggle', cat: 'shop', label: 'Haggle for a bargain', group: 'Buy', ap: 1,
    desc: 'Pick anything for sale and try to talk the price down.',
    scene: 'shopping',
    avail: (x) => (x.c.legal.prison ? false : x.c.age < 12 ? 'Age 12+' : true),
    options: (x) => itemOptions(x),
    run: (x, arg) => {
      const t = ITEM_BY_ID[optOf(arg) ?? ''];
      if (!t) return 'You haggled with the air. The air won.';
      const ok = itemEligibility(x, t);
      if (ok !== true) return ok;
      x.train('negotiation', 2);
      const roll = x.skill('negotiation') * 0.5 + x.stat('charisma') * 0.3 + x.int(0, 40);
      const base = buyItem(x, t.id);
      if (roll > 60) {
        const back = Math.round(itemPrice(x, t) * x.float(0.1, 0.3));
        x.money(back);
        x.mod('confidence', 2);
        return `${base} You haggled ${x.fmt(back)} off and the seller called you a bandit, fondly.`;
      }
      if (roll < 25) {
        x.mod('confidence', -1);
        return `${base} The seller raised the price twice while you "negotiated". You paid the first one, at least.`;
      }
      return `${base} You got a free bag thrown in. Victory, of a kind.`;
    },
  },
  {
    id: 'sh_window', cat: 'shop', label: (x) => (x.year < 1850 ? 'Wander the market' : x.year < 2000 ? 'Window shopping' : 'Scroll online shops'), group: 'Browse', ap: 1,
    desc: 'Look, touch, put it back. Free.',
    scene: 'shopping',
    avail: (x) => (x.c.legal.prison ? false : true),
    run: (x) => {
      x.mods({ stress: -2, happiness: 2 });
      return x.pick([
        'You tried on a hat that cost more than your rent and walked out with dignity.',
        'You added nine things to a wish list and bought none of them.',
        'A salesperson almost had you. Almost.',
        'You looked at everything and touched the expensive things gently.',
      ]);
    },
  },
  {
    id: 'sh_flea', cat: 'shop', label: (x) => (x.year < 1900 ? 'Rummage at the rag market' : 'Hunt a flea market'), group: 'Browse', ap: 1,
    desc: 'Junk, treasures, and junk that thinks it is a treasure.',
    scene: 'shopping',
    avail: (x) => (x.c.legal.prison ? false : x.c.age < 10 ? 'Age 10+' : moneyOk(x, price(x, 40))),
    run: (x) => {
      x.spend(price(x, 40));
      const roll = x.stat('wisdom') * 0.3 + x.skill('art') * 0.4 + x.int(0, 60);
      if (roll > 70) {
        const pool = itemsAvailable(x.year).filter((t) => (t.cat === 'art' || t.cat === 'jewelry') && t.price < 20000);
        if (pool.length) {
          const t = x.pick(pool);
          buyItem(x, t.id, { gift: true });
          x.mod('happiness', 4);
          return `Under a pile of doilies you found ${itemName(t, x.year).toLowerCase()} for pocket change. A real one.`;
        }
      }
      if (roll < 30) return 'You bought a lamp shaped like a duck. Nobody knows why, including you.';
      x.mod('happiness', 2);
      return x.pick(['You came home with an old map and a story about the seller.', 'A chipped teacup, a brass key and no regrets.']);
    },
  },
  {
    id: 'sh_auction', cat: 'shop', label: 'Bid at an auction', group: 'Buy', ap: 1,
    desc: 'Raise a paddle, hold your nerve.',
    scene: 'luxury',
    avail: (x) => (x.c.legal.prison || x.year < 1650 ? false : x.c.age < 18 ? 'Age 18+' : true),
    options: (x) =>
      itemsAvailable(x.year)
        .filter((t) => t.cat === 'art' || t.cat === 'luxury' || t.cat === 'jewelry')
        .map((t) => {
          const est = Math.round(itemPrice(x, t) * 0.8);
          return { value: t.id, label: `${itemName(t, x.year)} (estimate ${x.fmt(est)})`, disabled: x.c.money < est ? `Needs ${x.fmt(est)}` : undefined };
        }),
    run: (x, arg) => {
      const t = ITEM_BY_ID[optOf(arg) ?? ''];
      if (!t) return 'You scratched your nose and nearly bought a vase.';
      const full = itemPrice(x, t);
      const paid = Math.round(full * x.float(0.55, 1.45));
      if (x.c.money < paid) {
        x.mod('happiness', -2);
        return `The bidding climbed to ${x.fmt(paid)}. You lowered your paddle and your pride.`;
      }
      x.spend(paid);
      buyItem(x, t.id, { gift: true });
      x.mod('fame', t.fame ? 1 : 0);
      return paid < full
        ? `Sold, to you, for ${x.fmt(paid)}. A steal. The room muttered.`
        : `You won ${itemName(t, x.year).toLowerCase()} for ${x.fmt(paid)}. A bidding war is a kind of victory.`;
    },
  },
  {
    id: 'sh_repair', cat: 'shop', label: 'Repair or service something', group: 'Maintain', ap: 1,
    desc: 'Fix wear and tear on vehicles and gadgets.',
    scene: (_opt, res) => (res.includes('drives') ? 'car' : 'gadget'),
    avail: (x) => (x.c.legal.prison ? false : x.c.items.some((i) => i.condition < 100) ? true : 'Everything is in perfect shape'),
    options: (x) =>
      x.c.items
        .filter((i) => i.condition < 100)
        .map((i) => {
          const cost = Math.round(i.value * 0.1 + price(x, 50));
          return { value: i.id, label: `${i.name}: ${Math.round(i.condition)}% (${x.fmt(cost)})`, disabled: x.c.money < cost ? `Costs ${x.fmt(cost)}` : undefined };
        }),
    run: (x, arg) => {
      const it = x.item(optOf(arg));
      if (!it) return 'You no longer own that.';
      const cost = Math.round(it.value * 0.1 + price(x, 50));
      if (!x.spend(cost)) return `You cannot afford it (${x.fmt(cost)}).`;
      it.condition = Math.min(100, it.condition + x.int(35, 70));
      it.value = Math.round(it.value * 1.05);
      const vehicle = ITEM_BY_ID[it.typeId]?.cat === 'vehicle';
      return vehicle
        ? `Your ${it.name.toLowerCase()} drives like new. The mechanic said "who did this to it" and charged ${x.fmt(cost)}.`
        : `Your ${it.name.toLowerCase()} works again for ${x.fmt(cost)}. The repairer blew dust out of it dramatically.`;
    },
  },
  {
    id: 'sh_appraise', cat: 'shop', label: 'Get something appraised', group: 'Maintain', ap: 1,
    desc: 'Find out what your treasures are really worth.',
    scene: 'jewelry',
    avail: (x) => (x.c.legal.prison ? false : x.c.items.some((i) => ['art', 'jewelry', 'luxury'].includes(ITEM_BY_ID[i.typeId]?.cat ?? '')) ? true : 'Nothing worth appraising'),
    options: (x) => ownedOptions(x, (c) => c === 'art' || c === 'jewelry' || c === 'luxury'),
    run: (x, arg) => {
      const it = x.item(optOf(arg));
      if (!it) return 'You no longer own that.';
      const roll = x.r();
      if (roll < 0.15) {
        it.value = Math.round(it.value * x.float(2, 4));
        x.mods({ happiness: 6 });
        return `The appraiser went pale. Your ${it.name.toLowerCase()} is worth ${x.fmt(it.value)}.`;
      }
      if (roll < 0.3) {
        it.value = Math.round(it.value * 0.3);
        x.mods({ happiness: -4 });
        return `"A very good copy," said the appraiser kindly. It is worth ${x.fmt(it.value)}.`;
      }
      it.value = Math.round(it.value * x.float(0.95, 1.2));
      return `Your ${it.name.toLowerCase()} is worth about ${x.fmt(it.value)}. Solid, if unspectacular.`;
    },
  },
  {
    id: 'sh_garageSale', cat: 'shop', label: (x) => (x.year < 1950 ? 'Hold a jumble sale' : 'Hold a garage sale'), group: 'Sell', ap: 1,
    desc: 'Sell off all your cheap clutter in one afternoon.',
    scene: 'moneyUp',
    avail: (x) => (x.c.legal.prison ? false : x.c.age < 10 ? 'Age 10+' : x.c.items.some((i) => i.value < price(x, 500)) ? true : 'No clutter to sell'),
    run: (x) => {
      const junk = x.c.items.filter((i) => i.value < price(x, 500));
      let total = 0;
      for (const i of junk) total += Math.round(i.value * x.float(0.4, 0.8));
      x.c.items = x.c.items.filter((i) => !junk.includes(i));
      x.money(total);
      x.mods({ stress: -3 });
      return `You sold ${junk.length} thing${junk.length === 1 ? '' : 's'} for ${x.fmt(total)}. A child haggled you down on everything.`;
    },
  },
  {
    id: 'sh_spree', cat: 'shop', label: 'Go on a shopping spree', group: 'Browse', ap: 1,
    desc: 'Retail therapy. The receipts are the side effects.',
    scene: 'shopping',
    avail: (x) => (x.c.legal.prison ? false : x.c.age < 16 ? 'Age 16+' : moneyOk(x, price(x, 600))),
    run: (x) => {
      const spent = price(x, x.int(300, 600));
      x.spend(spent);
      x.mods({ happiness: 6, stress: -4, looks: 1 });
      if (x.chance(0.25)) {
        x.mod('happiness', -4);
        return `You spent ${x.fmt(spent)} and felt amazing for about forty minutes.`;
      }
      return x.pick([`Bags on both arms, ${x.fmt(spent)} lighter, ten feet taller.`, `You spent ${x.fmt(spent)} on things you absolutely needed, such as a third scarf.`]);
    },
  },
];

// ---------------------------------------------------------------- Pets app
const SPECIES_SCENE: Record<string, string> = { dog: 'pet', cat: 'petCat', horse: 'petHorse', parrot: 'petBird', falcon: 'petBird', robodog: 'gadget' };
const speciesScene = (species: string): string => SPECIES_SCENE[species] ?? 'pet';
/** Set by run(); the scene function cannot see the pet itself. */
let lastPetScene: string | undefined;

const PETS_APP: ActionDef[] = [
  {
    id: 'sh_adopt', cat: 'pets', label: 'Get a pet', group: 'Adopt', ap: 1,
    desc: 'Choose an animal that suits the age you live in.',
    scene: (opt) => speciesScene(opt ?? 'dog'),
    avail: (x) => (x.c.legal.prison ? false : x.c.age < 6 ? 'Too young' : true),
    options: (x) =>
      petsAvailable(x.year).map((t) => {
        const ok = petEligibility(x, t);
        return { value: t.id, label: `${t.name}${x.c.age >= 18 ? ` (${x.fmt(petPrice(x, t))})` : ''}`, disabled: ok === true ? undefined : ok };
      }),
    run: (x, arg) => {
      const t = PET_BY_ID[optOf(arg) ?? ''];
      if (!t) return 'You looked at animals for an hour and went home alone.';
      const ok = petEligibility(x, t);
      if (ok !== true) return ok;
      if (x.c.age < 18 && x.chance(0.35)) return `Your parents said no to the ${t.name.toLowerCase()}. You will bring it up at every meal.`;
      const res = adoptPet(x, t.id);
      if (t.prestige) x.mod('fame', t.prestige);
      return res + ' ' + x.pick(['It was love at first sniff.', 'It already has a favourite chair. Yours.', 'You spent the evening just watching it exist.']);
    },
  },
  {
    id: 'sh_shelter', cat: 'pets', label: 'Adopt from a shelter', group: 'Adopt', ap: 1,
    desc: 'An older animal who really needs a home. Free, with a small donation.',
    scene: (_o, res) => (res.includes('cat') ? 'petCat' : 'pet'),
    avail: (x) => (x.c.legal.prison || x.year < 1824 ? false : x.c.age < 10 ? 'Age 10+' : true),
    run: (x) => {
      const species = x.chance(0.55) ? 'dog' : 'cat';
      const res = adoptPet(x, species, { free: true });
      const p = x.c.pets[x.c.pets.length - 1];
      if (p) { p.birthYear = x.year - x.int(3, 8); p.bond = x.int(20, 40); }
      if (x.c.age >= 18) x.spend(price(x, 50));
      x.mods({ karma: 3, empathy: 2 });
      return `${res} The staff cried a little when you left. So did you.`;
    },
  },
  {
    id: 'sh_petSit', cat: 'pets', label: 'Pet-sit for neighbours', group: 'Other', ap: 1,
    desc: 'Mind someone else\'s animals for a little money.',
    scene: 'pet',
    avail: (x) => (x.c.legal.prison ? false : x.c.age < 10 ? 'Age 10+' : true),
    run: (x) => {
      const n = price(x, x.int(40, 150));
      x.money(n);
      x.train('animalHusbandry', 2);
      x.mods({ loneliness: -2, happiness: 2 });
      return x.pick([
        `You walked a very old dog very slowly and earned ${x.fmt(n)}.`,
        `The cat ignored you for three days and you got ${x.fmt(n)} anyway.`,
        `The parrot learned your name and one word you should not have said. ${x.fmt(n)} earned.`,
      ]);
    },
  },
  {
    id: 'sh_shelterVolunteer', cat: 'pets', label: 'Volunteer at an animal shelter', group: 'Other', ap: 1,
    desc: 'Walk dogs, scoop litter, fall in love daily.',
    scene: 'volunteer',
    avail: (x) => (x.c.legal.prison || x.year < 1824 ? false : x.c.age < 12 ? 'Age 12+' : true),
    run: (x) => {
      x.mods({ karma: 2, empathy: 2, happiness: 4, stress: -3, loneliness: -3 });
      x.train('animalHusbandry', 2);
      return x.pick(['You walked twelve dogs. Eleven were good. One was a genius at escaping.', 'A shy cat finally came out to sit on your lap.', 'You cleaned more cages than you thought existed.']);
    },
  },
  {
    id: 'sh_farmVisit', cat: 'pets', label: 'Visit a petting farm', group: 'Other', ap: 1,
    desc: 'Goats, lambs and an aggressive duck.',
    scene: 'farm',
    avail: (x) => (x.c.legal.prison ? false : true),
    run: (x) => {
      x.mods({ happiness: 4, stress: -3 });
      return x.pick(['A lamb fell asleep on your lap.', 'A goat ate your map. You are lost forever, happily.', 'A duck chased you around the pond. It was personal.']);
    },
  },
];

// ---------------------------------------------------------------- Per-pet actions
function petOf(x: Ctx, arg?: string): Pet | undefined {
  const id = targetOf(arg);
  return x.c.pets.find((p) => p.id === id && p.alive);
}

const clamp = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));

interface PetActSpec {
  id: string;
  label: string | ((x: Ctx, arg?: string) => string);
  desc: string;
  group: string;
  only?: string[];
  except?: string[];
  cost?: number;
  minAge?: number;
  years?: [number, number];
  scene?: string;
  options?: (x: Ctx, arg?: string) => ActionOption[];
  run: (x: Ctx, p: Pet, opt?: string) => string;
}

function petAct(o: PetActSpec): ActionDef {
  return {
    id: o.id,
    cat: 'pet',
    label: o.label,
    desc: o.desc,
    group: o.group,
    ap: 1,
    scene: () => o.scene ?? lastPetScene ?? 'pet',
    avail: (x, arg) => {
      const p = petOf(x, arg);
      if (!p) return false;
      if (o.only && !o.only.includes(p.species)) return false;
      if (o.except && o.except.includes(p.species)) return false;
      if (o.years && (x.year < o.years[0] || x.year > o.years[1])) return false;
      if (x.c.legal.prison) return 'You are in prison';
      if (o.minAge && x.c.age < o.minAge) return `Age ${o.minAge}+`;
      if (o.cost && x.c.age >= 18) return moneyOk(x, price(x, o.cost));
      return true;
    },
    options: o.options,
    run: (x, arg) => {
      const p = petOf(x, arg);
      if (!p) return 'That pet is not with you.';
      lastPetScene = o.scene ?? speciesScene(p.species);
      if (o.cost && x.c.age >= 18 && !x.spend(price(x, o.cost))) return `You cannot afford it (${x.fmt(price(x, o.cost))}).`;
      const opt = arg?.includes('|') ? optOf(arg) : undefined;
      const text = o.run(x, p, opt);
      p.bond = clamp(p.bond);
      p.training = clamp(p.training);
      p.health = clamp(p.health);
      return text;
    },
  };
}

const kind = (p: Pet): string => PET_BY_ID[p.species]?.name.toLowerCase() ?? 'pet';

const PLAY_LINES: Record<string, string[]> = {
  dog: ['{n} brought the ball back eleven times and asked for a twelfth.', '{n} did zoomies around the garden until falling over with joy.'],
  cat: ['{n} attacked the string with the focus of a professional assassin.', '{n} pretended not to care, then played for an hour.'],
  horse: ['{n} cantered circles round the paddock and showed off for you.', '{n} nosed your pockets for apples. Found them.'],
  parrot: ['{n} danced on your shoulder to a song only parrots know.', '{n} said "hello" in your exact voice. Unsettling and wonderful.'],
  robodog: ['{n} ran a play subroutine and wagged its LED tail at 60 hertz.', '{n} fetched the ball and calculated your throw angle out loud.'],
  fish: ['{n} followed your finger along the glass. A meaningful connection.', '{n} blew a bubble. You chose to take it personally.'],
  snake: ['{n} wound round your arm and tasted the air with interest.', '{n} explored your sleeve like a small, judgmental scarf.'],
  turtle: ['{n} took a slow lap of the lawn. Tremendous effort.', '{n} ate a strawberry with dignity.'],
};

const PET_ACTIONS: ActionDef[] = [
  petAct({
    id: 'sh_petPlay', label: 'Play together', desc: 'Toys, games and undivided attention.', group: 'Care',
    run: (x, p) => {
      p.bond += x.int(4, 9);
      x.mods({ happiness: 4, stress: -3, loneliness: -2 });
      const lines = PLAY_LINES[p.species] ?? ['{n} played with you until both of you needed a nap.', '{n} seemed delighted to have your full attention.'];
      return x.pick(lines).replace('{n}', p.name);
    },
  }),
  petAct({
    id: 'sh_petWalk', label: 'Go for a walk', desc: 'Fresh air for both of you.', group: 'Care', only: ['dog', 'robodog', 'pig', 'ferret'],
    run: (x, p) => {
      p.bond += x.int(3, 7); p.health += x.int(1, 4);
      x.mods({ fitness: 2, stress: -4, loneliness: -2 });
      if (x.chance(0.15)) { x.mod('loneliness', -3); return `${p.name} introduced you to a neighbour you had never spoken to. You talked for an hour.`; }
      return x.pick([`${p.name} sniffed every single lamppost like a detective.`, `${p.name} pulled you towards a puddle with great purpose.`, `You and ${p.name} walked until the sun went down.`]);
    },
  }),
  petAct({
    id: 'sh_petRide', label: 'Go for a ride', desc: 'Saddle up and head out.', group: 'Care', only: ['horse'],
    run: (x, p) => {
      x.train('horsemanship', 3);
      p.bond += x.int(3, 7); p.health += 2;
      x.mods({ fitness: 2, stress: -5 });
      if (x.skill('horsemanship') + x.int(0, 50) < 25) { x.mods({ pain: 4, health: -2 }); return `${p.name} stopped dead at a stream. You did not.`; }
      return x.pick([`You and ${p.name} galloped across the meadow like a painting.`, `${p.name} found a perfect rhythm and so did your heart.`]);
    },
  }),
  petAct({
    id: 'sh_petTrain', label: 'Train', desc: 'Commands, manners and patience.', group: 'Training', except: ['fish', 'turtle', 'snake'],
    run: (x, p) => {
      x.train('animalHusbandry', 2);
      const gain = x.int(3, 8) + Math.round(x.stat('discipline') / 20);
      if (x.chance(0.2)) { p.training += 1; return `${p.name} learned to look at you while doing the exact opposite.`; }
      p.training += gain; p.bond += 2;
      return p.species === 'robodog'
        ? `${p.name} downloaded the obedience module and now sits on command, slightly too fast.`
        : x.pick([`${p.name} finally sits when asked. Most of the time.`, `${p.name} came when called, and looked proud of it.`, `${p.name} understood "stay". You are both stunned.`]);
    },
  }),
  petAct({
    id: 'sh_petTrick', label: 'Teach a trick', desc: 'Show off later.', group: 'Training', except: ['fish', 'turtle', 'snake'],
    options: () => [
      { value: 'paw', label: 'Shake hands' },
      { value: 'roll', label: 'Roll over' },
      { value: 'dead', label: 'Play dead' },
      { value: 'speak', label: 'Speak' },
      { value: 'spin', label: 'Spin in a circle' },
    ],
    run: (x, p, opt) => {
      const trick = { paw: 'shake hands', roll: 'roll over', dead: 'play dead', speak: 'speak', spin: 'spin in a circle' }[opt ?? 'paw'] ?? 'do a trick';
      const chance = (p.training + p.bond) / 200 + (p.species === 'dog' || p.species === 'parrot' || p.species === 'robodog' ? 0.2 : -0.1);
      if (x.chance(Math.max(0.1, Math.min(0.9, chance)))) {
        p.training += 5; p.bond += 3;
        x.mods({ happiness: 5 });
        p.meta[`trick_${opt ?? 'paw'}`] = true;
        return p.species === 'cat'
          ? `${p.name} learned to ${trick}. Once. For a treat. Never again in front of guests.`
          : `${p.name} learned to ${trick} and now does it whenever anyone looks at a biscuit.`;
      }
      p.training += 1;
      return `You spent an hour teaching ${p.name} to ${trick}. ${p.name} taught you patience instead.`;
    },
  }),
  petAct({
    id: 'sh_petTalk', label: 'Teach words', desc: 'A parrot is only as polite as its teacher.', group: 'Training', only: ['parrot'],
    run: (x, p) => {
      p.training += x.int(3, 7); p.bond += 3;
      x.mods({ happiness: 3 });
      return x.pick([`${p.name} now says "good morning" at 4am.`, `${p.name} learned your laugh and uses it sarcastically.`, `${p.name} learned the doorbell sound and uses it daily.`]);
    },
  }),
  petAct({
    id: 'sh_petHunt', label: 'Fly the falcon', desc: 'Hunt the old way.', group: 'Training', only: ['falcon'],
    run: (x, p) => {
      x.train('animalHusbandry', 3);
      p.bond += 4; p.training += 3;
      x.mods({ stress: -3, popularity: 1 });
      return x.chance(0.6) ? `${p.name} stooped from the clouds and returned to your glove like a king's messenger.` : `${p.name} spent the afternoon on a church roof, ignoring you magnificently.`;
    },
  }),
  petAct({
    id: 'sh_petGroom', label: 'Groom', desc: 'Brushing, bathing, claw trimming.', group: 'Care', except: ['fish', 'robodog'], cost: 30,
    run: (x, p) => {
      p.bond += x.int(1, 5); p.health += 2;
      x.mods({ stress: -2 });
      if (p.species === 'cat' && x.chance(0.4)) return `${p.name} accepted the bath and will never forgive you for it.`;
      return x.pick([`${p.name} looks like a show winner now, and knows it.`, `${p.name} shed enough fur to build a second ${kind(p)}.`, `${p.name} smells like flowers, briefly.`]);
    },
  }),
  petAct({
    id: 'sh_petTreat', label: 'Give a treat', desc: 'Spoil them a little.', group: 'Care',
    run: (x, p) => {
      p.bond += x.int(2, 5);
      if (x.chance(0.15)) p.health -= 2;
      x.mods({ happiness: 2 });
      return p.species === 'robodog' ? `${p.name} accepted a fresh battery with a happy beep.` : `${p.name} inhaled the treat and looked at you like you invented food.`;
    },
  }),
  petAct({
    id: 'sh_petCuddle', label: 'Cuddle', desc: 'The best medicine there is.', group: 'Care', except: ['fish', 'snake', 'lizard', 'turtle'],
    run: (x, p) => {
      p.bond += x.int(2, 6);
      x.mods({ stress: -5, loneliness: -4, depression: -2, anxiety: -2 });
      return x.pick([`${p.name} fell asleep on your chest and you did not move for two hours.`, `You told ${p.name} your problems. ${p.name} listened better than most people.`]);
    },
  }),
  petAct({
    id: 'sh_petVet', label: (x) => (x.year < 1760 ? 'See the animal doctor' : 'Take to the vet'), desc: 'A check-up, shots and a stern lecture about weight.', group: 'Health', cost: 150, scene: 'vet',
    run: (x, p) => {
      const t = PET_BY_ID[p.species];
      const age = petAge(x, p);
      const old = t ? age > t.lifespan * 0.7 : false;
      if (p.species === 'robodog') { p.health += x.int(20, 40); return `The technician updated ${p.name}'s firmware and replaced a squeaky joint.`; }
      if (x.year < 1760) { p.health += x.int(0, 15); return `The animal doctor rubbed ${p.name} with herbs and charged you for the privilege.`; }
      p.health += x.int(15, 35); p.bond -= 2;
      if (old) return `The vet said ${p.name} is getting on, gave some pills and a kind look. Cherish the time.`;
      if (x.chance(0.2)) return `${p.name} is perfectly healthy but needs to "lose a little weight". ${p.name} disagrees.`;
      return x.pick([`${p.name} got a clean bill of health and a lollipop-sized treat.`, `${p.name} hid under the table for the whole visit, then got a gold star.`]);
    },
  }),
  petAct({
    id: 'sh_petShow', label: 'Enter a show', desc: 'Compete for rosettes and bragging rights.', group: 'Training', years: [1859, 2300], cost: 60, except: ['fish', 'snake', 'turtle'],
    run: (x, p) => {
      const score = p.training * 0.5 + p.health * 0.3 + p.bond * 0.2 + x.int(-15, 25);
      if (score > 70) {
        const n = price(x, 300);
        x.money(n);
        x.mods({ happiness: 7, fame: 1, popularity: 2 });
        p.meta.showWins = Number(p.meta.showWins ?? 0) + 1;
        return `${p.name} won Best in Show and a prize of ${x.fmt(n)}. You cried more than ${p.name} did.`;
      }
      if (score < 40) { x.mods({ happiness: -2 }); return `${p.name} sat down in the ring and refused to move. The judges were not charmed.`; }
      x.mods({ happiness: 3 });
      return `${p.name} got a third-place rosette and ate a bit of it.`;
    },
  }),
  petAct({
    id: 'sh_petPhoto', label: 'Post a photo online', desc: 'Pets are the internet\'s real stars.', group: 'Fun', years: [2005, 2300],
    run: (x, p) => {
      if (x.chance(0.08 + p.training / 1000)) {
        x.mods({ fame: 3, popularity: 4, happiness: 6 });
        return `A photo of ${p.name} wearing a tiny hat went viral. ${p.name} has more followers than you now.`;
      }
      x.mods({ happiness: 2 });
      return x.pick([`${p.name} got 41 likes. Your aunt commented "beautiful!!!".`, `Your photo of ${p.name} looked like a blurry potato. Still adorable.`]);
    },
  }),
  petAct({
    id: 'sh_petBirthday', label: 'Throw a pet birthday', desc: 'A cake, a party hat and guests who mostly want cake.', group: 'Fun', cost: 40,
    run: (x, p) => {
      p.bond += 4;
      x.mods({ happiness: 5, loneliness: -3 });
      return `${p.name} turned ${petAge(x, p)}. The party hat lasted four seconds; the cake lasted less.`;
    },
  }),
  petAct({
    id: 'sh_petCostume', label: 'Dress them up', desc: 'A costume they did not consent to.', group: 'Fun', except: ['fish', 'snake', 'turtle', 'lizard'],
    run: (x, p) => {
      p.bond -= 2;
      x.mods({ happiness: 4 });
      return x.pick([`${p.name} dressed as a pumpkin looked deeply betrayed and extremely cute.`, `${p.name} wore the little jumper for three minutes and then ate it.`]);
    },
  }),
  petAct({
    id: 'sh_petTank', label: 'Clean the tank', desc: 'Fresh water, fresh start.', group: 'Care', only: ['fish', 'turtle', 'snake', 'lizard'], cost: 15,
    run: (x, p) => {
      p.health += x.int(5, 15); p.bond += 2;
      x.mods({ stress: -2 });
      return x.pick([`${p.name}'s home sparkles. ${p.name} seemed to approve, in a quiet way.`, `You scrubbed the glass and ${p.name} watched you like a landlord.`]);
    },
  }),
  petAct({
    id: 'sh_rehome', label: 'Rehome', desc: 'Find them a new family.', group: 'Health', scene: 'lonely',
    run: (x, p) => rehomePet(x, p.id),
  }),
];

export const SHOP_ACTIONS: ActionDef[] = [...SHOP, ...PETS_APP, ...PET_ACTIONS];
