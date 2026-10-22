import type { Ctx } from '../ctx';
import type { Item, Params, Pet } from '../types';
import type { ChainDef, EventDef } from './types';
import { ITEM_BY_ID, type ItemCat } from '../data/items';
import { PET_BY_ID } from '../data/pets';
import { adoptPet, loseItem, petAge } from '../systems/possessions';
import { eraCostFactor } from '../systems/finance';
import { fmtYear } from '../ctx';

/* ------------------------------------------------------------------ helpers */

/** Modern dollars to era money. */
const cost = (x: Ctx, n: number): number => Math.max(1, Math.round(n * eraCostFactor(x.year)));
const clamp = (v: number): number => Math.max(0, Math.min(100, Math.round(v)));
/** Pay a bill in modern dollars; children's bills are covered by their parents. */
function pay(x: Ctx, n: number): boolean {
  if (x.age < 18) return true;
  return x.spend(cost(x, n));
}

/** Bind a random living pet of a species. */
function petOf(...species: string[]) {
  return (x: Ctx): Params | null => {
    const p = x.c.pets.filter((q) => q.alive && species.includes(q.species));
    return p.length ? { petId: x.pick(p).id } : null;
  };
}
function anyPet(x: Ctx): Params | null {
  const p = x.pets();
  return p.length ? { petId: x.pick(p).id } : null;
}
/** Bind an elderly pet (past 70% of its lifespan). */
function oldPetOf(...species: string[]) {
  return (x: Ctx): Params | null => {
    const p = x.c.pets.filter((q) => q.alive && species.includes(q.species) && petAge(x, q) >= (PET_BY_ID[q.species]?.lifespan ?? 12) * 0.7);
    return p.length ? { petId: x.pick(p).id } : null;
  };
}
function pt(x: Ctx): Pet {
  return x.pet(x.p.petId as string) ?? { id: '', species: 'dog', name: 'your pet', breed: 'mutt', color: '#888888', birthYear: x.year, alive: true, health: 50, bond: 50, training: 0, meta: {} };
}
const nm = (x: Ctx): string => pt(x).name;
function petMod(x: Ctx, d: { bond?: number; training?: number; health?: number }): void {
  const p = pt(x);
  if (d.bond) p.bond = clamp(p.bond + d.bond);
  if (d.training) p.training = clamp(p.training + d.training);
  if (d.health) p.health = clamp(p.health + d.health);
}

/** Bind an owned item matching a predicate. */
function itemBind(pred: (typeId: string, cat: ItemCat) => boolean) {
  return (x: Ctx): Params | null => {
    const its = x.c.items.filter((i) => {
      const t = ITEM_BY_ID[i.typeId];
      return !!t && pred(i.typeId, t.cat);
    });
    return its.length ? { itemId: x.pick(its).id } : null;
  };
}
const ofTypes = (...ids: string[]) => itemBind((id) => ids.includes(id));
const CARS = ['usedCar', 'familyCar', 'sportsCar', 'luxuryCar', 'electricCar'];
function itm(x: Ctx): Item | undefined {
  return x.item(x.p.itemId as string);
}
const iname = (x: Ctx): string => (itm(x)?.name ?? 'thing').toLowerCase();
function itemValue(x: Ctx, f: number): void {
  const i = itm(x);
  if (i) i.value = Math.max(0, Math.round(i.value * f));
}
function wear(x: Ctx, d: number): void {
  const i = itm(x);
  if (i) i.condition = clamp(i.condition + d);
}
/** Little helper for children in the house. */
const smallKids = (x: Ctx) => x.children().filter((n) => n.alive && x.npcAge(n) <= 3);

/* ------------------------------------------------------------------ pets */

const PET_EVENTS: EventDef[] = [
  {
    id: 'le_dogTrick', cat: 'pets', scene: 'pet', weight: 1.4, cooldown: 4, bind: petOf('dog'),
    title: 'New trick',
    text: (x) => `${nm(x)} sits, stares at you and lifts one paw, as if waiting for you to name the trick.`,
    choices: [
      { label: 'Teach "play dead"', tags: ['ambitious'], run: (x) => { if (x.chance(0.4 + pt(x).training / 200)) { petMod(x, { training: 12, bond: 5 }); x.mods({ happiness: 5 }); return `${nm(x)} flops over with real theatrical commitment. Guests now demand encores.`; } petMod(x, { bond: 3 }); return `${nm(x)} learned "play dead" means "roll over and wait for belly rubs".`; } },
      { label: 'Shake on it', tags: ['cautious'], run: (x) => { petMod(x, { bond: 6, training: 3 }); x.mods({ happiness: 3 }); return 'A firm handshake. You feel you have entered into a contract involving biscuits.'; } },
      { label: 'Film it for friends', tags: ['social'], when: (x) => x.year >= 1950, run: (x) => { petMod(x, { bond: 2 }); x.mods({ happiness: 3, popularity: 2 }); return `${nm(x)} refused to do it on camera, then did it perfectly the moment you stopped filming.`; } },
    ],
  },
  {
    id: 'le_dogShoes', cat: 'pets', scene: 'pet', weight: 1.2, cooldown: 4, bind: petOf('dog'),
    title: 'The shoe incident',
    text: (x) => `You come home to find ${nm(x)} lying in a nest of what used to be your best shoes, tail thumping.`,
    choices: [
      { label: 'Scold them', tags: ['cautious'], run: (x) => { petMod(x, { training: 6, bond: -4 }); x.mods({ stress: 2 }); return `${nm(x)} gave you the guiltiest eyes in history and slept by your feet all night.`; } },
      { label: 'Laugh it off', tags: ['impulsive'], run: (x) => { petMod(x, { bond: 4, training: -3 }); x.mods({ happiness: 2 }); return 'They were going out of fashion anyway. Probably.'; } },
      { label: 'Buy a chew toy', tags: ['help'], run: (x) => { if (!pay(x, 20)) return 'You could not even afford a chew toy. The slippers are next.'; petMod(x, { bond: 5, training: 2 }); return 'The rubber bone survived three days. Your shoes survived longer.'; } },
    ],
  },
  {
    id: 'le_dogEscape', cat: 'pets', scene: 'pet', weight: 1, cooldown: 5, bind: petOf('dog'),
    title: 'Under the fence',
    text: (x) => `There is a fresh hole under the fence and no sign of ${nm(x)}.`,
    choices: [
      { label: 'Search the streets', tags: ['help'], run: (x) => { x.mods({ stress: 3, fitness: 2 }); if (x.chance(0.8)) { petMod(x, { bond: 6 }); return `You found ${nm(x)} at the butcher's back door, looking extremely pleased with life.`; } pt(x).meta.lost = true; petMod(x, { health: -15 }); return `${nm(x)} came home two days later, thin, muddy and unrepentant.`; } },
      { label: 'Put up posters', tags: ['cautious'], when: (x) => x.year >= 1850, run: (x) => { x.mods({ stress: 2 }); petMod(x, { bond: 3 }); return `A neighbour rang: ${nm(x)} had wandered into their kitchen and eaten a whole roast.`; } },
      { label: 'Wait at home', run: (x) => { x.mods({ stress: 4 }); petMod(x, { bond: -2 }); return `${nm(x)} scratched at the door at midnight as if nothing had happened.`; } },
    ],
  },
  {
    id: 'le_dogPark', cat: 'pets', scene: 'friends', weight: 1, cooldown: 4, minAge: 16, bind: petOf('dog'),
    title: 'Dog park friends',
    text: (x) => `${nm(x)} has fallen madly in love with another dog at the park. Its owner is waving at you.`,
    choices: [
      { label: 'Go and chat', tags: ['social'], run: (x) => { x.mods({ happiness: 3, loneliness: -5 }); petMod(x, { bond: 3 }); return 'You now know their dog\'s full medical history and nothing about their name.'; } },
      { label: 'Arrange regular walks', tags: ['social'], run: (x) => { x.mods({ happiness: 4, loneliness: -8, fitness: 2 }); x.setFlag('dogWalkBuddy', true); return 'Tuesdays and Thursdays. The dogs never miss one; neither, it turns out, do you.'; } },
      { label: 'Call your dog back', tags: ['cautious'], run: (x) => { petMod(x, { training: 3, bond: -1 }); return `${nm(x)} came back, slowly, sulking all the way home.`; } },
    ],
  },
  {
    id: 'le_dogAteThing', cat: 'pets', scene: 'vet', weight: 1, cooldown: 5, bind: petOf('dog'),
    title: 'What did you eat?',
    text: (x) => `${nm(x)} looks queasy, and a bar of chocolate wrapper lies suspiciously empty on the floor.`,
    choices: [
      { label: 'Rush to the vet', tags: ['help'], scene: 'vet', run: (x) => { if (!pay(x, 400)) { petMod(x, { health: -20 }); return 'You could not pay the vet. A long, worried night followed, but they pulled through.'; } petMod(x, { health: 5, bond: 4 }); return `The vet sorted it out, and ${nm(x)} has been banned from the sweets cupboard for life.`; } },
      { label: 'Watch and wait', tags: ['cautious'], run: (x) => { if (x.chance(0.6)) return `${nm(x)} was fine by morning and immediately looked for more chocolate.`; petMod(x, { health: -25 }); x.mods({ stress: 5 }); return 'A rough few days. You will never leave sweets out again.'; } },
    ],
  },
  {
    id: 'le_dogShow', cat: 'pets', scene: 'pet', weight: (x) => x.year >= 1860 ? 0.8 : 0, cooldown: 5, minAge: 8, bind: petOf('dog'),
    title: 'Best in show?',
    text: (x) => `The town dog show is this weekend. ${nm(x)} the ${pt(x).breed} has been practising standing still. Badly.`,
    choices: [
      { label: 'Enter and groom', tags: ['ambitious'], run: (x) => { if (!pay(x, 60)) return 'You could not afford the entry fee.'; const s = pt(x).training + x.int(0, 60); if (s > 90) { pt(x).meta.champion = true; petMod(x, { bond: 6 }); x.mods({ happiness: 8, popularity: 2 }); return `${nm(x)} won a rosette and walked out like royalty.`; } x.mods({ happiness: 2 }); return `${nm(x)} sniffed the judge somewhere unforgivable. Honourable mention for enthusiasm.`; } },
      { label: 'Enter the fun category', tags: ['social'], run: (x) => { x.mods({ happiness: 5 }); petMod(x, { bond: 4 }); return `${nm(x)} won "Waggiest Tail". It is framed on the wall.`; } },
      { label: 'Just watch', tags: ['cautious'], run: (x) => { x.mods({ happiness: 2 }); return 'Lovely day out. Your dog is, objectively, better than all of them.'; } },
    ],
  },
  {
    id: 'le_dogHero', cat: 'pets', scene: 'pet', weight: 0.5, once: true, bind: petOf('dog'),
    title: 'Good dog',
    text: (x) => `${nm(x)} will not stop barking at the back door at three in the morning.`,
    choices: [
      { label: 'Get up and check', tags: ['cautious'], scene: 'fire', run: (x) => { petMod(x, { bond: 10 }); x.mods({ happiness: 6 }); x.remember('dogHero', `${nm(x)} saved the house one night`, 30); return x.chance(0.5) ? `Smoke was curling from the stove. ${nm(x)} saved the house, and gets steak for a month.` : `A burglar was halfway through the window. One look at ${nm(x)} and he was gone.`; } },
      { label: 'Tell them to hush', tags: ['impulsive'], run: (x) => { petMod(x, { bond: -3 }); if (x.chance(0.5)) { x.mods({ stress: 4 }); return 'In the morning the garden shed had been cleared out. Your dog said nothing, loudly.'; } return 'Probably a fox. Probably.'; } },
    ],
  },
  {
    id: 'le_dogNeighbour', cat: 'pets', scene: 'argument', weight: 1, cooldown: 5, minAge: 18, bind: petOf('dog'),
    title: 'Noise complaint',
    text: (x) => `The neighbour knocks: ${nm(x)} barks every time you leave, and has done for hours.`,
    choices: [
      { label: 'Apologise with cake', tags: ['help', 'social'], run: (x) => { x.mods({ happiness: 1 }); petMod(x, { training: 2 }); return 'The cake worked. The barking continued, but now they forgive it.'; } },
      { label: 'Hire a trainer', tags: ['cautious'], run: (x) => { if (!pay(x, 300)) return 'You could not afford a trainer. The feud simmers.'; petMod(x, { training: 15 }); return `Six sessions later, ${nm(x)} merely sighs dramatically when you leave.`; } },
      { label: 'Tell them to get earplugs', tags: ['violent'], run: (x) => { x.mods({ stress: 3, karma: -1 }); return 'Cold war declared. Their bins are now positioned against you.'; } },
    ],
  },
  {
    id: 'le_dogBaby', cat: 'pets', scene: 'family', weight: 3, once: true, minAge: 18, bind: (x) => { const p = x.pets('dog'); const k = smallKids(x); return p.length && k.length ? { petId: x.pick(p).id, npcId: k[0].id } : null; },
    title: 'Meet the baby',
    text: (x) => `${nm(x)} is sniffing the new arrival, ${x.first(x.p.npcId as string)}, with total seriousness.`,
    choices: [
      { label: 'Let them get acquainted', tags: ['help'], run: (x) => { petMod(x, { bond: 6 }); x.relMod(x.p.npcId as string, 3); x.mods({ happiness: 6 }); return `${nm(x)} has appointed themself bodyguard and sleeps by the cot every night.`; } },
      { label: 'Keep them apart', tags: ['cautious'], run: (x) => { petMod(x, { bond: -5 }); return `${nm(x)} sulked by the nursery door for a week, then quietly won you over.`; } },
    ],
  },
  {
    id: 'le_petPartner', cat: 'pets', scene: 'pet', weight: 1.5, cooldown: 6, minAge: 18,
    bind: (x) => { const l = x.lover(); const p = x.pets(); return l && p.length ? { petId: x.pick(p).id, npcId: l.npcId } : null; },
    title: 'Pet politics',
    text: (x) => `${nm(x)} has decided ${x.first(x.p.npcId as string)} is either the best person alive or a mortal enemy. Possibly both.`,
    choices: [
      { label: 'Side with your pet', tags: ['impulsive'], run: (x) => { petMod(x, { bond: 6 }); x.relMod(x.p.npcId as string, -3); return `${x.first(x.p.npcId as string)} has noted that you chose the animal. It will come up again.`; } },
      { label: 'Broker a peace treaty', tags: ['help', 'social'], run: (x) => { petMod(x, { bond: 2 }); x.relMod(x.p.npcId as string, 4); return 'Treats were exchanged. A grudging truce now holds on the sofa.'; } },
      { label: 'Let them sort it out', tags: ['cautious'], run: (x) => { if (x.chance(0.5)) { x.relMod(x.p.npcId as string, 3); return `By winter ${nm(x)} was sleeping on ${x.first(x.p.npcId as string)}'s side of the bed. Traitor.`; } x.relMod(x.p.npcId as string, -2); return 'They still glare at each other across the kitchen.'; } },
    ],
  },
  {
    id: 'le_dogOld', cat: 'pets', scene: 'aging', weight: 2, cooldown: 6, bind: oldPetOf('dog'),
    title: 'Grey muzzle',
    text: (x) => `${nm(x)} is ${petAge(x, pt(x))} now, grey around the muzzle, and the stairs have become a negotiation.`,
    choices: [
      { label: 'Buy a soft bed downstairs', tags: ['help'], run: (x) => { pay(x, 80); petMod(x, { health: 6, bond: 5 }); x.mods({ happiness: 2 }); return 'They sigh with deep contentment every time they climb in.'; } },
      { label: 'One last beach trip', tags: ['impulsive'], scene: 'beach', run: (x) => { petMod(x, { bond: 8 }); x.mods({ happiness: 6 }); x.remember('oldDogBeach', `A last beach day with ${nm(x)}`, 20); return `${nm(x)} chased waves like a puppy, then slept the whole way home.`; } },
      { label: 'See the vet about joints', tags: ['cautious'], scene: 'vet', run: (x) => { if (!pay(x, 300)) return 'The vet bill was beyond you. You carry them up the stairs instead.'; petMod(x, { health: 12 }); return 'New medicine. There is a bit of spring back in their step.'; } },
    ],
  },
  {
    id: 'le_dogClass', cat: 'pets', scene: 'pet', weight: (x) => x.year >= 1920 ? 1 : 0, cooldown: 6, bind: petOf('dog'),
    title: 'Obedience school',
    text: (x) => `A sign at the park offers puppy obedience classes. ${nm(x)} is currently eating a stick the size of a broom.`,
    choices: [
      { label: 'Sign up', tags: ['ambitious'], run: (x) => { if (!pay(x, 150)) return 'You could not afford the classes.'; petMod(x, { training: 18, bond: 4 }); x.train('animalHusbandry', 3); return `${nm(x)} graduated second in class, beaten only by a terrifyingly focused poodle.`; } },
      { label: 'Train them yourself', tags: ['cautious'], run: (x) => { petMod(x, { training: 8, bond: 6 }); x.train('animalHusbandry', 4); x.mods({ discipline: 1 }); return 'Slow progress, lots of treats, a great deal of mutual respect.'; } },
      { label: 'They are perfect as they are', tags: ['impulsive'], run: (x) => { petMod(x, { bond: 3 }); return 'The stick was finished by sunset. A triumph of a kind.'; } },
    ],
  },
  {
    id: 'le_strayDog', cat: 'pets', scene: 'pet', weight: (x) => x.pets('dog').length ? 0.3 : 0.8, cooldown: 8, minAge: 8,
    title: 'A dog at the door',
    text: 'A skinny, muddy dog has been sitting on your doorstep since dawn, wagging hopefully whenever the door opens.',
    choices: [
      { label: 'Take them in', tags: ['help'], scene: 'pet', run: (x) => { x.mods({ karma: 2 }); return `${adoptPet(x, 'dog', { free: true, breed: 'mutt' })} Nobody ever came looking for them.`; } },
      { label: 'Feed them and find the owner', tags: ['cautious'], run: (x) => { x.mods({ karma: 1, happiness: 2 }); return 'A tearful family turned up two streets away. They brought you a pie.'; } },
      { label: 'Shoo them away', run: (x) => { x.mods({ karma: -1 }); return 'The dog trotted off. You thought about it all evening.'; } },
    ],
  },
  // cats
  {
    id: 'le_catGift', cat: 'pets', scene: 'petCat', weight: 1.2, cooldown: 4, bind: petOf('cat'),
    title: 'A little present',
    text: (x) => `${nm(x)} has left a "gift" from the garden on your pillow and is watching you for applause.`,
    choices: [
      { label: 'Praise the hunter', tags: ['social'], run: (x) => { petMod(x, { bond: 6 }); return `${nm(x)} purred like an engine. Tomorrow, sadly, there will be two.`; } },
      { label: 'Tidy up quietly', tags: ['cautious'], run: (x) => { petMod(x, { bond: 1 }); return 'You disposed of the tribute. You suspect you have offended a monarch.'; } },
      { label: 'Buy a bell collar', tags: ['help'], run: (x) => { pay(x, 10); petMod(x, { bond: -3 }); x.mods({ karma: 1 }); return 'The local birds rejoice. The cat plots.'; } },
    ],
  },
  {
    id: 'le_catCurtains', cat: 'pets', scene: 'petCat', weight: 1, cooldown: 4, bind: petOf('cat'),
    title: 'Curtain climber',
    text: (x) => `${nm(x)} is halfway up the curtains, staring at you with no plan for coming down.`,
    choices: [
      { label: 'Rescue them', tags: ['help'], run: (x) => { petMod(x, { bond: 4 }); x.mods({ health: -1 }); return 'You were rewarded with scratches and, later, deep purring forgiveness.'; } },
      { label: 'Buy a scratching post', tags: ['cautious'], run: (x) => { pay(x, 50); petMod(x, { training: 6 }); return 'The post is ignored. The cat now sleeps in its box.'; } },
      { label: 'Let them figure it out', run: (x) => { petMod(x, { training: 2 }); return 'The curtains came down. So did the rail. The cat landed perfectly.'; } },
    ],
  },
  {
    id: 'le_catMissing', cat: 'pets', scene: 'petCat', weight: 0.9, cooldown: 6, bind: petOf('cat'),
    title: 'Gone walkabout',
    text: (x) => `${nm(x)} has not come home for three nights. The food bowl is untouched.`,
    choices: [
      { label: 'Search the neighbourhood', tags: ['help'], run: (x) => { x.mods({ stress: 3 }); petMod(x, { bond: 5 }); return x.chance(0.5) ? `You found ${nm(x)} shut in a neighbour's shed, furious and fine.` : `It turns out ${nm(x)} has a second family three doors down, who call them "Biscuit".`; } },
      { label: 'Rattle the treat tin', tags: ['cautious'], run: (x) => { petMod(x, { bond: 2 }); return `On the fourth night, ${nm(x)} strolled in at the sound of the tin as if they had never left.`; } },
    ],
  },
  {
    id: 'le_catBox', cat: 'pets', scene: 'petCat', weight: 1, cooldown: 4, bind: petOf('cat'),
    title: 'The box',
    text: (x) => `You bought ${nm(x)} an expensive cat bed. ${nm(x)} has chosen the cardboard box it came in.`,
    choices: [
      { label: 'Accept defeat', tags: ['cautious'], run: (x) => { petMod(x, { bond: 3 }); x.mods({ happiness: 2 }); return 'The box is now a permanent feature of the living room.'; } },
      { label: 'Put the bed inside the box', tags: ['ambitious'], run: (x) => { petMod(x, { bond: 5 }); x.mods({ happiness: 3, creativity: 1 }); return 'Diplomacy. Engineering. The cat accepts the compromise.'; } },
    ],
  },
  {
    id: 'le_catKeyboard', cat: 'pets', scene: 'petCat', weight: 1, cooldown: 4, years: [1980, 2300], minAge: 14, bind: petOf('cat'),
    title: 'Keyboard warrior',
    text: (x) => `${nm(x)} walked across your keyboard and sent something to someone important.`,
    choices: [
      { label: 'Send an apology', tags: ['cautious'], run: (x) => { x.mods({ stress: 2 }); return 'They replied: "Is your cat okay? It sounded upset about the quarterly figures."'; } },
      { label: 'Pretend you meant it', tags: ['impulsive'], run: (x) => { x.mods({ confidence: 2 }); return 'Nobody questioned "jjjjjjjjjjkkkk". It was, apparently, very persuasive.'; } },
      { label: 'Post the screenshot', tags: ['social'], run: (x) => { x.mods({ happiness: 3, popularity: 1 }); petMod(x, { bond: 1 }); return `Strangers loved it. ${nm(x)} remains indifferent to fame.`; } },
    ],
  },
  {
    id: 'le_catOld', cat: 'pets', scene: 'aging', weight: 2, cooldown: 6, bind: oldPetOf('cat'),
    title: 'Old cat, warm spot',
    text: (x) => `${nm(x)} spends most days following the patch of sunlight across the floor. They are ${petAge(x, pt(x))}, which is ancient.`,
    choices: [
      { label: 'Move their bed into the sun', tags: ['help'], run: (x) => { petMod(x, { bond: 6, health: 4 }); return 'You have been promoted to "acceptable human".'; } },
      { label: 'Book a senior checkup', tags: ['cautious'], scene: 'vet', run: (x) => { if (!pay(x, 200)) return 'The checkup was beyond your budget this year.'; petMod(x, { health: 10 }); return 'The vet says the heart is strong and the attitude is stronger.'; } },
      { label: 'Spend a lazy day together', tags: ['social'], run: (x) => { petMod(x, { bond: 5 }); x.mods({ happiness: 4, stress: -4 }); return 'You both napped. It was the best day of the month.'; } },
    ],
  },
  {
    id: 'le_strayCat', cat: 'pets', scene: 'petCat', weight: (x) => x.pets('cat').length ? 0.3 : 0.8, cooldown: 8, minAge: 8,
    title: 'Kitten in the rain',
    text: 'A tiny wet kitten is crying under a parked cart outside your door.',
    choices: [
      { label: 'Bring it inside', tags: ['help'], run: (x) => { x.mods({ karma: 2 }); return `${adoptPet(x, 'cat', { free: true })} It has ruled the house ever since.`; } },
      { label: 'Take it to a shelter', tags: ['cautious'], when: (x) => x.year >= 1870, run: (x) => { x.mods({ karma: 1 }); return 'The shelter found it a home within the week. You still think about its little face.'; } },
      { label: 'Leave it be', run: (x) => { x.mods({ karma: -1 }); return 'By morning it was gone. You hope someone kinder found it.'; } },
    ],
  },
  {
    id: 'le_catKittens', cat: 'pets', scene: 'petCat', weight: 0.4, cooldown: 10, minAge: 10, bind: petOf('cat'),
    title: 'Surprise kittens',
    text: (x) => `${nm(x)} has been getting rounder, and this morning there are five kittens in your laundry basket.`,
    choices: [
      { label: 'Keep one', tags: ['impulsive'], run: (x) => { x.mods({ happiness: 5 }); return `${adoptPet(x, 'cat', { free: true })} The others went to friends who owed you favours.`; } },
      { label: 'Find homes for them all', tags: ['help', 'social'], run: (x) => { x.mods({ happiness: 3, karma: 1 }); return 'Every kitten went to a good home. You now have photo updates for life.'; } },
    ],
  },
  // horses
  {
    id: 'le_horseRace', cat: 'pets', scene: 'petHorse', weight: 1, cooldown: 4, minAge: 12, bind: petOf('horse'),
    title: 'Village race',
    text: (x) => `There is a race across the meadows at the fair. ${nm(x)} is stamping as if they already know.`,
    choices: [
      { label: 'Ride to win', tags: ['ambitious', 'impulsive'], run: (x) => { x.train('horsemanship', 4); if (x.chance(0.25 + pt(x).training / 250 + x.skill('horsemanship') / 300)) { x.money(cost(x, 300)); x.mods({ happiness: 8, popularity: 3 }); petMod(x, { bond: 6 }); pt(x).meta.champion = true; return `You and ${nm(x)} crossed the line first, mud-spattered and grinning, and took ${x.fmt(cost(x, 300))} in prize money.`; } x.mods({ happiness: 2 }); return 'Fourth place, and the fastest-looking fourth place anyone had seen.'; } },
      { label: 'Ride for fun', tags: ['cautious'], run: (x) => { x.train('horsemanship', 2); petMod(x, { bond: 4 }); x.mods({ happiness: 4 }); return 'You finished somewhere in the middle, laughing the whole way.'; } },
    ],
  },
  {
    id: 'le_horseThrown', cat: 'pets', scene: 'petHorse', weight: 0.8, cooldown: 6, minAge: 10, bind: petOf('horse'),
    title: 'Thrown',
    text: (x) => `A pheasant burst out of a hedge, ${nm(x)} reared, and you are suddenly looking at the sky.`,
    choices: [
      { label: 'Get straight back on', tags: ['ambitious'], run: (x) => { x.mods({ health: -3, pain: 4, confidence: 3, resilience: 2 }); petMod(x, { training: 4, bond: 3 }); return 'Sore all over, but you finished the ride, and the horse respected it.'; } },
      { label: 'Walk them home', tags: ['cautious'], run: (x) => { x.mods({ health: -2, pain: 3 }); petMod(x, { bond: 4 }); return `A long walk side by side. ${nm(x)} nuzzled your bruised shoulder the whole way.`; } },
      { label: 'Sell the beast', tags: ['impulsive'], scene: 'moneyUp', run: (x) => { const p = pt(x); x.c.pets = x.c.pets.filter((q) => q !== p); x.money(cost(x, 1500)); x.mods({ happiness: -3 }); return `${p.name} went to a farmer for ${x.fmt(cost(x, 1500))}. You regretted it by the next morning.`; } },
    ],
  },
  {
    id: 'le_horseLame', cat: 'pets', scene: 'vet', weight: 0.8, cooldown: 5, bind: petOf('horse'),
    title: 'Lame',
    text: (x) => `${nm(x)} is favouring a front leg. The farrier shakes his head.`,
    choices: [
      { label: 'Pay for proper treatment', tags: ['help'], run: (x) => { if (!pay(x, 900)) { petMod(x, { health: -15 }); return 'You could not pay. Rest and poultices did what they could.'; } petMod(x, { health: 12, bond: 4 }); return `Months of rest and care. ${nm(x)} trots sound again.`; } },
      { label: 'Rest them in the paddock', tags: ['cautious'], run: (x) => { petMod(x, { health: 4 }); return 'A long summer of grazing. They are mostly fine, if a touch lazier.'; } },
    ],
  },
  {
    id: 'le_horseShow', cat: 'pets', scene: 'petHorse', weight: (x) => x.year >= 1700 ? 0.8 : 0, cooldown: 5, minAge: 10, bind: petOf('horse'),
    title: 'Show jumping',
    text: (x) => `The county show has a jumping round, and ${nm(x)} cleared the paddock fence twice this week unprompted.`,
    choices: [
      { label: 'Enter the open class', tags: ['ambitious'], run: (x) => { if (!pay(x, 120)) return 'The entry fee was beyond you.'; x.train('horsemanship', 5); if (x.chance(0.3 + pt(x).training / 200)) { x.mods({ happiness: 8, fame: 1, popularity: 3 }); return 'A clear round and a red rosette. The crowd gasped at the final wall.'; } x.mods({ happiness: 1 }); return `${nm(x)} stopped dead at the water jump and you did not.`; } },
      { label: 'Watch from the rail', tags: ['cautious'], run: (x) => { x.mods({ happiness: 2 }); return 'You spent the day judging every horse against yours. Yours won, in your head.'; } },
    ],
  },
  {
    id: 'le_horseBolt', cat: 'pets', scene: 'petHorse', weight: 0.7, cooldown: 6, bind: petOf('horse'),
    title: 'The gate was open',
    text: (x) => `Someone left the gate open and ${nm(x)} is galloping down the high road.`,
    choices: [
      { label: 'Chase on foot', tags: ['impulsive'], run: (x) => { x.mods({ fitness: 2, stress: 3 }); petMod(x, { bond: 2 }); return `You found ${nm(x)} two miles away, eating someone's prize roses.`; } },
      { label: 'Borrow a horse and follow', tags: ['ambitious'], run: (x) => { x.train('horsemanship', 3); petMod(x, { bond: 4 }); return 'A proper chase. You caught them at the river and both stood there panting.'; } },
      { label: 'Wait; they always come back', tags: ['cautious'], run: (x) => { petMod(x, { training: -3 }); return 'At dusk they ambled home, muddy and very pleased with themselves.'; } },
    ],
  },
  // birds
  {
    id: 'le_parrotWord', cat: 'pets', scene: 'petBird', weight: 1.4, cooldown: 4, bind: petOf('parrot'),
    title: 'Polly said what?',
    text: (x) => `At a very polite dinner, ${nm(x)} loudly repeats something you said about a guest last week.`,
    choices: [
      { label: 'Blame the previous owner', tags: ['cautious'], run: (x) => { x.mods({ stress: 2 }); return 'Nobody believed you. The parrot repeated it again, with your exact laugh.'; } },
      { label: 'Laugh and own it', tags: ['social'], run: (x) => { x.mods({ popularity: x.chance(0.5) ? 2 : -2, happiness: 2 }); return 'The guest laughed too, eventually. It is now a famous story.'; } },
      { label: 'Cover the cage', run: (x) => { petMod(x, { bond: -3 }); return `${nm(x)} sulked under the cloth, whistling a funeral march.`; } },
    ],
  },
  {
    id: 'le_parrotEscape', cat: 'pets', scene: 'petBird', weight: 0.8, cooldown: 5, bind: petOf('parrot'),
    title: 'Open window',
    text: (x) => `${nm(x)} has flown out of the window and is sitting in the tallest tree on the street, shouting your name.`,
    choices: [
      { label: 'Climb up', tags: ['impulsive'], run: (x) => { if (x.chance(0.6)) { petMod(x, { bond: 6 }); x.mods({ fitness: 1 }); return 'You coaxed them onto your arm high in the branches. Neighbours applauded.'; } x.mods({ health: -3, pain: 3 }); return 'You slipped and bruised everything. The parrot flew home on its own.'; } },
      { label: 'Wave their favourite fruit', tags: ['cautious'], run: (x) => { petMod(x, { bond: 3, training: 3 }); return 'Two hours and one mango later, they landed on your head.'; } },
    ],
  },
  {
    id: 'le_parrotSing', cat: 'pets', scene: 'petBird', weight: 1, cooldown: 5, bind: petOf('parrot'),
    title: 'Song bird',
    text: (x) => `${nm(x)} has learned the first lines of a popular song and performs it at dawn every day.`,
    choices: [
      { label: 'Teach them the rest', tags: ['ambitious'], run: (x) => { petMod(x, { training: 8, bond: 4 }); x.train('singing', 2); return 'You now perform duets. The neighbours have opinions.'; } },
      { label: 'Teach them a new word', tags: ['social'], run: (x) => { petMod(x, { training: 5 }); x.mods({ happiness: 3 }); return `${nm(x)} learned "hello" and "dinner", then invented a third word that sounds like the kettle.`; } },
    ],
  },
  {
    id: 'le_falconHunt', cat: 'pets', scene: 'petBird', weight: 1, cooldown: 4, bind: petOf('falcon'),
    title: 'Out on the moor',
    text: (x) => `It is a clear, cold morning, perfect for flying ${nm(x)}.`,
    choices: [
      { label: 'Fly them free', tags: ['ambitious'], run: (x) => { x.train('animalHusbandry', 3); if (x.chance(0.4 + pt(x).training / 200)) { petMod(x, { bond: 6, training: 5 }); x.mods({ happiness: 6 }); return `${nm(x)} stooped from a great height and came back to your glove like a thunderbolt.`; } petMod(x, { bond: -2 }); x.mods({ stress: 3 }); return 'They vanished over the hill and returned at sunset, unimpressed by your whistling.'; } },
      { label: 'Practice on the lure', tags: ['cautious'], run: (x) => { petMod(x, { training: 6, bond: 3 }); return 'Patient, repetitive, deeply satisfying.'; } },
      { label: 'Show them off to nobles', tags: ['social'], when: (x) => x.year < 1800, run: (x) => { x.mods({ popularity: 3, publicImage: 2 }); return 'A lord asked to buy your bird. You said no, which impressed him more.'; } },
    ],
  },
  {
    id: 'le_falconLost', cat: 'pets', scene: 'petBird', weight: 0.4, cooldown: 8, bind: petOf('falcon'),
    title: 'Empty sky',
    text: (x) => `${nm(x)} rode a thermal up and out of sight two days ago.`,
    choices: [
      { label: 'Search with the lure', tags: ['help'], run: (x) => { if (x.chance(0.6)) { petMod(x, { bond: 8 }); return `Three valleys away, ${nm(x)} heard the whistle and came down to you.`; } const p = pt(x); p.alive = false; p.deathYear = x.year; x.mods({ happiness: -6 }); return `You never saw ${p.name} again. You still look up at every hawk.`; } },
      { label: 'Let them go wild', tags: ['cautious'], run: (x) => { const p = pt(x); x.c.pets = x.c.pets.filter((q) => q !== p); x.mods({ happiness: -3, wisdom: 2 }); return 'Perhaps they were only ever borrowed.'; } },
    ],
  },
];

const PET_EVENTS_2: EventDef[] = [
  {
    id: 'le_rabbitCables', cat: 'pets', scene: 'house', weight: 1.2, cooldown: 4, years: [1890, 2300], bind: petOf('rabbit'),
    title: 'Chewed through',
    text: (x) => `The lamp has stopped working. ${nm(x)} is sitting next to the cable, chewing innocently on nothing.`,
    choices: [
      { label: 'Rabbit-proof the house', tags: ['cautious'], run: (x) => { pay(x, 60); petMod(x, { health: 3 }); return 'Every cable is now in a plastic tube. The rabbit is studying the tubes.'; } },
      { label: 'Give them hay and cardboard', tags: ['help'], run: (x) => { petMod(x, { bond: 5 }); return `${nm(x)} built a fort out of the cardboard and has stopped eating the furniture. Mostly.`; } },
    ],
  },
  {
    id: 'le_rabbitHop', cat: 'pets', scene: 'family', weight: 0.8, cooldown: 5, years: [1970, 2300], bind: petOf('rabbit'),
    title: 'Rabbit show jumping',
    text: (x) => `Someone at the pet shop says ${nm(x)} has "jumper's legs" and should try the rabbit hopping club.`,
    choices: [
      { label: 'Join the club', tags: ['social'], run: (x) => { x.mods({ happiness: 4, loneliness: -4 }); petMod(x, { training: 10, bond: 4 }); return x.chance(0.4) ? `${nm(x)} cleared every tiny fence and won a ribbon bigger than their head.` : `${nm(x)} sat in the middle of the course and washed their ears. The crowd loved it.`; } },
      { label: 'Build a course in the garden', tags: ['ambitious'], run: (x) => { x.train('carpentry', 2); petMod(x, { training: 6, bond: 6 }); return 'Your garden now looks like a very small racecourse.'; } },
    ],
  },
  {
    id: 'le_hamsterEscape', cat: 'pets', scene: 'house', weight: 1.2, cooldown: 3, bind: petOf('hamster'),
    title: 'Great escape',
    text: (x) => `The cage door is open and ${nm(x)} is somewhere in the house.`,
    choices: [
      { label: 'Lay a trail of seeds', tags: ['cautious'], run: (x) => { petMod(x, { bond: 2 }); return `You found ${nm(x)} asleep in a slipper the next morning, cheeks full of seeds.`; } },
      { label: 'Tear the house apart', tags: ['impulsive'], run: (x) => { x.mods({ stress: 3 }); petMod(x, { bond: 1 }); return `Three hours, every cushion moved. ${nm(x)} was in the cage all along, behind the wheel.`; } },
    ],
  },
  {
    id: 'le_hamsterWheel', cat: 'pets', scene: 'house', weight: 1, cooldown: 4, bind: petOf('hamster'),
    title: 'Night shift',
    text: (x) => `${nm(x)} runs on the squeaky wheel from midnight until dawn. You have not slept in a week.`,
    choices: [
      { label: 'Oil the wheel', tags: ['cautious'], run: (x) => { x.mods({ stress: -3, energy: 4 }); return 'Silence. Blessed silence. You can hear yourself think again.'; } },
      { label: 'Move the cage downstairs', tags: ['help'], run: (x) => { x.mods({ stress: -2 }); petMod(x, { bond: -1 }); return `${nm(x)} ran a personal best that night, to an empty kitchen.`; } },
      { label: 'Admire their stamina', run: (x) => { x.mods({ stress: 2, happiness: 1 }); return 'You estimate they have run to the next town and back. Inspiring, really.'; } },
    ],
  },
  {
    id: 'le_fishTank', cat: 'pets', scene: 'calm', weight: 1, cooldown: 4, bind: petOf('fish'),
    title: 'Cloudy water',
    text: (x) => `The tank has gone green and ${nm(x)} is swimming slower than usual.`,
    choices: [
      { label: 'Do a full clean', tags: ['help'], run: (x) => { petMod(x, { health: 12 }); x.mods({ happiness: 2 }); return `Sparkling water, new plants. ${nm(x)} zooms round like a tiny torpedo.`; } },
      { label: 'Buy a bigger tank', tags: ['ambitious'], run: (x) => { if (!pay(x, 250)) return 'A bigger tank cost more than you had.'; petMod(x, { health: 15, bond: 4 }); x.mods({ stress: -3 }); return 'You now spend a slightly worrying amount of time watching it.'; } },
      { label: 'Add a snail to clean it', tags: ['cautious'], run: (x) => { petMod(x, { health: 6 }); return 'The snail is named Gary and is now the real star of the tank.'; } },
    ],
  },
  {
    id: 'le_fishMeditate', cat: 'pets', scene: 'calm', weight: 0.8, cooldown: 5, bind: petOf('fish'),
    title: 'Aquarium therapy',
    text: (x) => `After a terrible day you find yourself sitting in the dark watching ${nm(x)} drift through the bubbles.`,
    choices: [
      { label: 'Stay a while', tags: ['cautious'], run: (x) => { x.mods({ stress: -6, anxiety: -3, happiness: 2 }); return 'An hour passed. You felt like a person again.'; } },
      { label: 'Talk to the fish', tags: ['social'], run: (x) => { x.mods({ stress: -4, loneliness: -3 }); return `${nm(x)} is an excellent listener and has never once interrupted.`; } },
    ],
  },
  {
    id: 'le_turtleWander', cat: 'pets', scene: 'gardening', weight: 0.9, cooldown: 6, bind: petOf('turtle'),
    title: 'Slow getaway',
    text: (x) => `${nm(x)} has escaped the garden. Given the speed involved, this took real planning.`,
    choices: [
      { label: 'Search the hedges', tags: ['help'], run: (x) => { petMod(x, { bond: 3 }); return `Found under the neighbour's rhubarb, ${x.int(10, 40)} metres away. A record.`; } },
      { label: 'Paint a tag on the shell', tags: ['cautious'], run: (x) => { x.mods({ happiness: 2 }); return `A neighbour returned ${nm(x)} a week later with a note: "Yours, I believe."`; } },
    ],
  },
  {
    id: 'le_snakeLoose', cat: 'pets', scene: 'house', weight: 0.9, cooldown: 5, minAge: 12, bind: petOf('snake'),
    title: 'Where is the snake?',
    text: (x) => `The vivarium lid is ajar. ${nm(x)} the ${pt(x).breed} is nowhere to be seen.`,
    choices: [
      { label: 'Warn the neighbours', tags: ['cautious', 'help'], run: (x) => { x.mods({ popularity: -2, stress: 3 }); return `The neighbours found ${nm(x)} in their airing cupboard. They are not speaking to you.`; } },
      { label: 'Search quietly', tags: ['impulsive'], run: (x) => { if (x.chance(0.7)) { petMod(x, { bond: 2 }); return `${nm(x)} was coiled behind the warm boiler, enjoying a holiday.`; } x.mods({ stress: 6 }); x.setFlag('snakeScare', true); return 'A week later your neighbour screamed. You moved your schedule to avoid them for a while.'; } },
    ],
  },
  {
    id: 'le_snakeShed', cat: 'pets', scene: 'house', weight: 0.8, cooldown: 4, bind: petOf('snake', 'lizard'),
    title: 'A perfect shed',
    text: (x) => `${nm(x)} has shed a flawless skin, every scale intact.`,
    choices: [
      { label: 'Take it to show-and-tell', tags: ['social'], when: (x) => x.age < 14, run: (x) => { x.mods({ popularity: 4, happiness: 3 }); return 'The class screamed, then queued to touch it. You were a legend until lunch.'; } },
      { label: 'Keep it in a frame', tags: ['impulsive'], run: (x) => { x.mods({ happiness: 2, creativity: 1 }); return 'Guests either love it or leave early.'; } },
      { label: 'Check their humidity', tags: ['cautious'], run: (x) => { petMod(x, { health: 6 }); x.train('biology', 1); return 'Everything is perfect. You have become a humidity enthusiast.'; } },
    ],
  },
  {
    id: 'le_lizardLamp', cat: 'pets', scene: 'vet', weight: 0.9, cooldown: 5, years: [1950, 2300], bind: petOf('lizard'),
    title: 'Cold-blooded crisis',
    text: (x) => `The heat lamp blew in the night and ${nm(x)} is sluggish and grumpy.`,
    choices: [
      { label: 'Emergency lamp run', tags: ['help'], run: (x) => { pay(x, 40); petMod(x, { health: 8, bond: 3 }); return `You drove across town for a bulb. ${nm(x)} basked with visible gratitude.`; } },
      { label: 'Warm them on your chest', tags: ['impulsive'], run: (x) => { petMod(x, { bond: 8, health: 2 }); return `${nm(x)} slept on you until morning. A strange but genuine bond.`; } },
    ],
  },
  {
    id: 'le_ferretSocks', cat: 'pets', scene: 'house', weight: 1.1, cooldown: 4, bind: petOf('ferret'),
    title: 'The sock thief',
    text: (x) => `You have found ${nm(x)}'s secret stash under the sofa: eleven socks, a key and a teaspoon.`,
    choices: [
      { label: 'Reclaim your things', tags: ['cautious'], run: (x) => { petMod(x, { bond: -2 }); return `${nm(x)} watched you take everything back, then began a new collection immediately.`; } },
      { label: 'Let them keep the hoard', tags: ['impulsive'], run: (x) => { petMod(x, { bond: 5 }); x.mods({ happiness: 2 }); return 'You now buy socks in bulk. It is cheaper than war.'; } },
      { label: 'Play the tunnel game', tags: ['social'], run: (x) => { petMod(x, { bond: 6, training: 2 }); x.mods({ happiness: 4 }); return `${nm(x)} did the excited sideways war dance for an hour.`; } },
    ],
  },
  {
    id: 'le_pigTruffle', cat: 'pets', scene: 'farm', weight: 1, cooldown: 5, bind: petOf('pig'),
    title: 'Nose for treasure',
    text: (x) => `${nm(x)} is rooting frantically under an old oak and refuses to move.`,
    choices: [
      { label: 'Dig where they dig', tags: ['ambitious'], run: (x) => { if (x.chance(0.35)) { const v = cost(x, 600); x.money(v); x.mods({ happiness: 5 }); return `Truffles. A whole cluster. A restaurant paid ${x.fmt(v)}.`; } return 'An old boot and a lot of mud. The pig seemed satisfied.'; } },
      { label: 'Pull them away', tags: ['cautious'], run: (x) => { petMod(x, { bond: -2 }); return 'It took two people and a bucket of apples.'; } },
    ],
  },
  {
    id: 'le_pigFair', cat: 'pets', scene: 'farm', weight: 0.8, cooldown: 5, bind: petOf('pig'),
    title: 'Prize pig',
    text: (x) => `The county fair has a "best pig" contest. ${nm(x)} is enormous, clean-ish and charming.`,
    choices: [
      { label: 'Enter the contest', tags: ['ambitious'], run: (x) => { if (x.chance(0.4)) { x.mods({ happiness: 6, popularity: 2 }); pt(x).meta.champion = true; return `${nm(x)} won a blue ribbon and wore it all the way home.`; } x.mods({ happiness: 2 }); return `${nm(x)} rolled in the judge's path. Second place, and a lot of laughs.`; } },
      { label: 'Just give them a bath', tags: ['help'], run: (x) => { petMod(x, { bond: 4, health: 3 }); return 'A clean pig is a happy pig, for about ninety seconds.'; } },
    ],
  },
  {
    id: 'le_monkeyMischief', cat: 'pets', scene: 'zoo', weight: 1.1, cooldown: 4, bind: petOf('monkey'),
    title: 'Monkey business',
    text: (x) => `${nm(x)} has opened every cupboard, tried on your hat and stolen a guest's spectacles.`,
    choices: [
      { label: 'Trade a banana for the glasses', tags: ['cautious'], run: (x) => { petMod(x, { training: 4 }); return 'The trade was accepted on the third banana. Hard bargainer.'; } },
      { label: 'Laugh with the guest', tags: ['social'], run: (x) => { x.mods({ happiness: 3, popularity: 1 }); return 'The guest now tells everyone about your house.'; } },
      { label: 'Consider a sanctuary', tags: ['help'], when: (x) => x.year >= 1960, run: (x) => { const p = pt(x); x.c.pets = x.c.pets.filter((q) => q !== p); x.mods({ happiness: -3, karma: 3 }); return `${p.name} went to a sanctuary with others of their kind. It was the right thing, and it hurt.`; } },
    ],
  },
  {
    id: 'le_monkeyCrowd', cat: 'pets', scene: 'friends', weight: (x) => x.year < 1950 ? 0.9 : 0.3, cooldown: 6, minAge: 14, bind: petOf('monkey'),
    title: 'Street audience',
    text: (x) => `${nm(x)} dances on your shoulder at the market and a crowd gathers, coins in hand.`,
    choices: [
      { label: 'Pass the hat', tags: ['ambitious'], run: (x) => { const v = cost(x, 40); x.money(v); x.mods({ happiness: 3 }); return `${x.fmt(v)} in coins, and an offer from a travelling show.`; } },
      { label: 'Head home', tags: ['cautious'], run: (x) => { petMod(x, { bond: 2 }); return 'Your monkey bowed to the crowd anyway. Pure showbusiness.'; } },
    ],
  },
  {
    id: 'le_robodogUpdate', cat: 'pets', scene: 'robots', weight: 1.2, cooldown: 3, bind: petOf('robodog'),
    title: 'Firmware update',
    text: (x) => `${nm(x)} is asking permission to install version ${x.int(4, 19)}.${x.int(0, 9)}, which "improves personality".`,
    choices: [
      { label: 'Install it', tags: ['impulsive'], run: (x) => { if (x.chance(0.7)) { petMod(x, { training: 10, bond: 2 }); return `${nm(x)} now fetches the paper and offers stock tips.`; } petMod(x, { bond: -8 }); return `${nm(x)} rebooted with a French accent and no memory of you. Rolling back took a week.`; } },
      { label: 'Keep the old version', tags: ['cautious'], run: (x) => { petMod(x, { bond: 4 }); return 'Same quirks, same squeaky bark. You would not change it.'; } },
    ],
  },
  {
    id: 'le_robodogHack', cat: 'pets', scene: 'hacker', weight: 0.6, cooldown: 6, bind: petOf('robodog'),
    title: 'Who is watching?',
    text: (x) => `${nm(x)}'s eyes flash a colour you have never seen, and its camera follows you around the room.`,
    choices: [
      { label: 'Factory reset', tags: ['cautious'], run: (x) => { petMod(x, { bond: -10, training: -10 }); x.mods({ paranoia: -2 }); return 'Clean and safe, but it has to learn your name all over again.'; } },
      { label: 'Trace the intruder', tags: ['ambitious'], run: (x) => { x.train('cybersecurity', 4); x.mods({ paranoia: 3 }); return 'A bored teenager three countries away. You changed every password you own.'; } },
      { label: 'Ignore it', tags: ['impulsive'], run: (x) => { x.mods({ paranoia: 4 }); return 'It is probably fine. You now change in the bathroom.'; } },
    ],
  },
  // any pet
  {
    id: 'le_petFamous', cat: 'pets', scene: 'fame', weight: 0.8, cooldown: 8, years: [2008, 2300], minAge: 12, bind: anyPet,
    title: 'Pet influencer',
    text: (x) => `A photo of ${nm(x)} looking deeply disappointed has gone viral overnight.`,
    choices: [
      { label: 'Start an account for them', tags: ['ambitious'], run: (x) => { x.mods({ fame: 2, happiness: 4 }); x.train('socialMediaManipulation', 2); if (x.chance(0.3)) { const v = cost(x, 3000); x.money(v); return `A pet food brand paid ${x.fmt(v)} for one sponsored post. ${nm(x)} remains unimpressed.`; } return `${nm(x)} has more followers than you. It stings.`; } },
      { label: 'Let it fade', tags: ['cautious'], run: (x) => { x.mods({ happiness: 2 }); return 'Three days of fame, then back to normal. Probably for the best.'; } },
    ],
  },
  {
    id: 'le_petSitter', cat: 'pets', scene: 'pet', weight: 0.8, cooldown: 5, minAge: 18, bind: anyPet,
    title: 'Who feeds the pet?',
    text: (x) => `You are away for a fortnight and need someone to look after ${nm(x)}.`,
    choices: [
      { label: 'Ask a friend', tags: ['social'], run: (x) => { const f = x.rels('friend', 'bestFriend'); if (f.length) { x.relMod(x.pick(f).npcId, 2); return `Your friend sent daily photos and returned ${nm(x)} slightly spoiled.`; } return 'Nobody was free. You took them with you, which was an adventure.'; } },
      { label: 'Pay a professional', tags: ['cautious'], run: (x) => { if (!pay(x, 300)) return 'Too expensive. You cut the trip short.'; petMod(x, { health: 2 }); return 'Immaculate care, a printed report, and a pet who no longer wants you.'; } },
      { label: 'Ask the teenager next door', tags: ['impulsive'], run: (x) => { if (x.chance(0.6)) return 'They were brilliant and now want to be a vet.'; petMod(x, { health: -6, bond: -2 }); return 'They forgot on day three. Your pet has filed a complaint.'; } },
    ],
  },
  {
    id: 'le_petBlessing', cat: 'pets', scene: 'holy', weight: 0.6, cooldown: 10, years: [1230, 2300], bind: anyPet,
    title: 'Blessing of the animals',
    text: (x) => `The local church is blessing animals on the feast of St Francis. Half the town is queuing with ${PET_BY_ID[pt(x).species]?.plural ?? 'animals'} and goats.`,
    choices: [
      { label: 'Join the queue', tags: ['social'], run: (x) => { x.mods({ faith: 2, happiness: 3 }); petMod(x, { health: 3 }); return `${nm(x)} was sprinkled with holy water and looked deeply offended.`; } },
      { label: 'Watch the chaos', tags: ['cautious'], run: (x) => { x.mods({ happiness: 3 }); return 'A goat ate the vicar\'s notes. A good morning all round.'; } },
    ],
  },
  {
    id: 'le_petBirthday', cat: 'pets', scene: 'birthday', weight: 0.7, cooldown: 6, years: [1900, 2300], bind: anyPet,
    title: 'Pet birthday',
    text: (x) => `It is ${nm(x)}'s birthday, or near enough. You are considering a party.`,
    choices: [
      { label: 'Throw a party', tags: ['social', 'impulsive'], scene: 'party', run: (x) => { pay(x, 50); petMod(x, { bond: 4 }); x.mods({ happiness: 5 }); return `Party hats, a cake made of tuna and carrot, and a guest list of three. ${nm(x)} slept through it.`; } },
      { label: 'A special treat', tags: ['help'], run: (x) => { petMod(x, { bond: 5 }); x.mods({ happiness: 2 }); return 'One perfect treat, eaten in under a second.'; } },
    ],
  },
  {
    id: 'le_petVet', cat: 'pets', scene: 'vet', weight: 0.9, cooldown: 4, years: [1800, 2300], bind: anyPet,
    title: 'Annual checkup',
    text: (x) => `${nm(x)} is due a checkup and has, somehow, already worked out what the carrier means.`,
    choices: [
      { label: 'Go to the vet', tags: ['cautious', 'help'], run: (x) => { if (!pay(x, 150)) return 'You could not afford the visit this year.'; petMod(x, { health: 10, bond: -2 }); return x.chance(0.3) ? 'The vet caught a small problem early. Worth every penny.' : `Healthy, a little overweight, and ${nm(x)} bit the thermometer.`; } },
      { label: 'Skip it this year', tags: ['impulsive'], run: (x) => { petMod(x, { health: -5 }); return 'Probably fine. You feel faintly guilty when they sneeze.'; } },
    ],
  },
  {
    id: 'le_petSick', cat: 'pets', scene: 'vet', weight: (x) => x.pets().some((p) => p.health < 40) ? 3 : 0, cooldown: 3,
    bind: (x) => { const p = x.pets().filter((q) => q.health < 40); return p.length ? { petId: x.pick(p).id } : null; },
    title: 'Not eating',
    text: (x) => `${nm(x)} has stopped eating and lies by the fire all day.`,
    choices: [
      { label: 'Pay for treatment', tags: ['help'], run: (x) => { if (!pay(x, 1200)) { petMod(x, { health: 5 }); return 'You could not pay for the full treatment. You did what you could at home.'; } petMod(x, { health: 30, bond: 5 }); return `Surgery, medicine and a cone of shame. ${nm(x)} is eating again.`; } },
      { label: 'Nurse them at home', tags: ['cautious'], run: (x) => { petMod(x, { health: x.int(0, 20), bond: 6 }); x.mods({ stress: 3 }); return 'Nights on the kitchen floor with a blanket and a spoon of broth.'; } },
      { label: 'Say a gentle goodbye', tags: ['cautious'], scene: 'graveVisit', when: (x) => x.year >= 1900, run: (x) => { const p = pt(x); p.alive = false; p.deathYear = x.year; x.mods({ happiness: -8, depression: 2 }); x.remember('petLoss', `Let ${p.name} go peacefully`, 15); return `You held ${p.name} until the end. It was peaceful.`; } },
    ],
  },
  {
    id: 'le_injuredBird', cat: 'pets', scene: 'petBird', weight: 0.5, cooldown: 10, minAge: 7,
    title: 'Broken wing',
    text: 'A small bird with a hurt wing is hopping in circles in the garden.',
    choices: [
      { label: 'Nurse it in a shoebox', tags: ['help'], run: (x) => { x.mods({ karma: 2, empathy: 2, happiness: 3 }); x.train('animalHusbandry', 2); return x.chance(0.6) ? 'Three weeks later it flew out of your hands into the hedge. You cried a bit.' : 'You did everything right. It just was not strong enough. You buried it under the roses.'; } },
      { label: 'Keep it as a pet', tags: ['impulsive'], when: (x) => x.year >= 1500, run: (x) => adoptPet(x, 'parrot', { free: true, breed: 'rescued songbird' }) },
      { label: 'Leave it to nature', run: (x) => { x.mods({ karma: -1 }); return 'Nature took its course. You took the long way round the garden for a week.'; } },
    ],
  },
];

/* ------------------------------------------------------------------ possessions */

const ITEM_EVENTS: EventDef[] = [
  {
    id: 'le_carWontStart', cat: 'possessions', scene: 'car', weight: 1.3, cooldown: 4, bind: ofTypes(...CARS),
    title: "Won't start",
    text: (x) => `It is raining, you are late, and your ${iname(x)} makes a sad clicking noise instead of starting.`,
    choices: [
      { label: 'Call a mechanic', tags: ['cautious'], run: (x) => { if (!x.spend(cost(x, 250))) return 'You could not afford the call-out. You took the bus, damp and furious.'; wear(x, 15); return 'A loose battery lead. Ten seconds of work, one large invoice.'; } },
      { label: 'Pop the bonnet yourself', tags: ['ambitious'], run: (x) => { x.train('autoRepair', 3); if (x.chance(0.3 + x.skill('autoRepair') / 150)) { wear(x, 10); x.mods({ confidence: 3 }); return 'You jiggled something with total confidence and it roared to life.'; } x.mods({ stress: 3 }); return 'You stared at the engine. The engine stared back. You were very late.'; } },
      { label: 'Kick the tyre', tags: ['violent', 'impulsive'], run: (x) => { x.mods({ pain: 2, stress: -1 }); return x.chance(0.2) ? 'Inexplicably, it started. You will never tell anyone why.' : 'Your toe hurts now, as well as your pride.'; } },
    ],
  },
  {
    id: 'le_speeding', cat: 'possessions', scene: 'police', weight: 1, cooldown: 4, years: [1905, 2300], minAge: 16, bind: ofTypes('sportsCar', 'luxuryCar', 'motorcycle', 'familyCar', 'usedCar', 'electricCar'),
    title: 'Blue lights',
    text: (x) => `The open road was empty, your ${iname(x)} was humming, and now there are lights in the mirror.`,
    choices: [
      { label: 'Pull over politely', tags: ['cautious'], run: (x) => { const f = cost(x, 150); x.money(-f); return `A ${x.fmt(f)} fine and a lecture about "the conditions". You nodded throughout.`; } },
      { label: 'Charm your way out', tags: ['social'], run: (x) => { if (x.chance(0.2 + x.stat('charisma') / 250)) { x.mods({ confidence: 3 }); return 'A warning, a smile, and a reminder to "drive like your mother is watching".'; } const f = cost(x, 250); x.money(-f); return `Your charm bounced off. ${x.fmt(f)}, plus points.`; } },
      { label: 'Floor it', tags: ['impulsive', 'violent'], scene: 'carChase', run: (x) => { if (x.chance(0.3)) { x.mods({ heat: 5, riskTolerance: 3 }); return 'You lost them on the back roads. Your heart did not slow down until morning.'; } const f = cost(x, 1500); x.money(-f); x.mods({ heat: 3, stress: 6 }); x.setFlag('licenceSuspended', true); return `Caught at the next junction. ${x.fmt(f)} and a suspended licence.`; } },
    ],
  },
  {
    id: 'le_fenderBender', cat: 'possessions', scene: 'car', weight: 1, cooldown: 5, years: [1905, 2300], minAge: 16, bind: ofTypes(...CARS),
    title: 'Fender bender',
    text: (x) => `A gentle bump in the car park. Your ${iname(x)} and a stranger's car are now touching bumpers.`,
    choices: [
      { label: 'Swap details', tags: ['cautious'], run: (x) => { wear(x, -8); x.money(-cost(x, 300)); return 'Insurance forms, an excess payment and a mildly awkward handshake.'; } },
      { label: 'Settle it in cash', tags: ['social'], run: (x) => { const v = cost(x, 200); x.money(-v); wear(x, -5); return `${x.fmt(v)} and the stranger turned out to be your new dentist. Small world.`; } },
      { label: 'Drive off', tags: ['impulsive'], run: (x) => { x.mods({ karma: -2, heat: 2, stress: 3 }); wear(x, -5); return 'Nobody followed you. You looked over your shoulder for a month.'; } },
    ],
  },
  {
    id: 'le_carSnow', cat: 'possessions', scene: 'blizzard', weight: 0.8, cooldown: 5, years: [1905, 2300], bind: ofTypes(...CARS),
    title: 'Snowed in',
    text: (x) => `Your ${iname(x)} is under a metre of snow and you have somewhere to be.`,
    choices: [
      { label: 'Dig it out', tags: ['ambitious'], run: (x) => { x.mods({ fitness: 2, pain: 2 }); return 'Two hours of shovelling. The plough came past ten minutes later and buried it again.'; } },
      { label: 'Stay home', tags: ['cautious'], scene: 'lonely', run: (x) => { x.mods({ stress: -3, happiness: 2 }); return 'A snow day: soup, blankets and nothing at all.'; } },
    ],
  },
  {
    id: 'le_classicCar', cat: 'possessions', scene: 'moneyUp', weight: 2, cooldown: 6,
    bind: (x) => { const c = x.c.items.filter((i) => CARS.includes(i.typeId) && x.year - i.boughtYear >= 25); return c.length ? { itemId: x.pick(c).id } : null; },
    title: 'A classic now',
    text: (x) => `A collector stops you in the street: your old ${iname(x)} from ${fmtYear(itm(x)?.boughtYear ?? x.year)} is apparently a classic.`,
    choices: [
      { label: 'Sell to the collector', tags: ['ambitious'], run: (x) => { const i = loseItem(x, x.p.itemId as string); const v = cost(x, x.int(15000, 45000)); x.money(v); return `${x.fmt(v)} for ${i ? 'a car' : 'it'} you once nearly scrapped. You watched it go with a lump in your throat.`; } },
      { label: 'Restore it properly', tags: ['help'], run: (x) => { if (!x.spend(cost(x, 6000))) return 'Restoration costs more than you have. It stays charmingly rusty.'; wear(x, 60); const i = itm(x); if (i) i.value += cost(x, 15000); x.mods({ happiness: 6 }); return 'New chrome, old soul. You take it out every sunny Sunday.'; } },
      { label: 'Not for sale', tags: ['cautious'], run: (x) => { x.mods({ happiness: 3 }); return 'Some things are worth more than money. The collector left his card anyway.'; } },
    ],
  },
  {
    id: 'le_motorcycleClub', cat: 'possessions', scene: 'roadTrip', weight: 0.9, cooldown: 5, years: [1910, 2300], minAge: 18, bind: ofTypes('motorcycle'),
    title: 'Riding club',
    text: 'A group of riders at the petrol station admire your bike and invite you on a weekend run.',
    choices: [
      { label: 'Ride with them', tags: ['social', 'impulsive'], run: (x) => { x.mods({ happiness: 6, loneliness: -6, riskTolerance: 2 }); x.setFlag('bikeClub', true); return 'Two days of open road, roadside cafés and stories. You have a nickname now.'; } },
      { label: 'Ride alone', tags: ['cautious'], run: (x) => { x.mods({ happiness: 3, stress: -4 }); return 'Just you, the bike and the coast road at sunset.'; } },
    ],
  },
  {
    id: 'le_bicycleFlat', cat: 'possessions', scene: 'roadTrip', weight: 1, cooldown: 4, bind: ofTypes('bicycle'),
    title: 'Flat tyre',
    text: 'Five miles from home, your bicycle tyre gives a long, sad hiss.',
    choices: [
      { label: 'Patch it at the roadside', tags: ['cautious'], run: (x) => { x.train('mechanics', 2); return 'Spit, glue and patience. It held all the way home.'; } },
      { label: 'Walk it home', run: (x) => { x.mods({ fitness: 2, stress: 1 }); return 'A long walk. You noticed things you had cycled past for years.'; } },
      { label: 'Flag down a passing cart', tags: ['social'], when: (x) => x.year < 1940, run: (x) => { x.mods({ happiness: 2 }); return 'A farmer gave you and the bicycle a lift, sharing apples and gossip.'; } },
      { label: 'Flag down a lift', tags: ['social'], when: (x) => x.year >= 1940, run: (x) => { x.mods({ happiness: 2 }); return 'A kind stranger with a roof rack. Faith in humanity, restored.'; } },
    ],
  },
  {
    id: 'le_carriageWheel', cat: 'possessions', scene: 'car', weight: 1, cooldown: 5, bind: ofTypes('carriage', 'cart', 'chariot'),
    title: 'Broken wheel',
    text: (x) => `A spoke snaps on a rutted road, and your ${iname(x)} lurches into a ditch.`,
    choices: [
      { label: 'Send for the wheelwright', tags: ['cautious'], run: (x) => { x.money(-cost(x, 120)); wear(x, 20); return 'A long wait at a roadside inn, but the wheel is better than new.'; } },
      { label: 'Lash it together', tags: ['ambitious'], run: (x) => { x.train('carpentry', 3); if (x.chance(0.5)) return 'Rope, a branch and prayer got you home.'; wear(x, -15); return 'It held for a mile. Then it did not.'; } },
    ],
  },
  {
    id: 'le_chariotRace', cat: 'possessions', scene: 'sports', weight: 1, cooldown: 4, years: [-800, 550], minAge: 16, bind: ofTypes('chariot'),
    title: 'The chariot races',
    text: 'The games are coming. Amateur charioteers may race before the professionals.',
    choices: [
      { label: 'Race for glory', tags: ['ambitious', 'impulsive'], run: (x) => { x.train('horsemanship', 4); if (x.chance(0.3)) { x.mods({ fame: 3, popularity: 5, happiness: 8 }); return 'You took the final turn on one wheel and won. The crowd chanted your name.'; } x.mods({ health: -4, pain: 4 }); wear(x, -20); return 'A wheel came off on the third lap. You walked away bruised, the chariot did not.'; } },
      { label: 'Watch from the stands', tags: ['cautious'], run: (x) => { x.mods({ happiness: 4 }); return 'The Greens won. You were for the Blues. You will not forget it.'; } },
    ],
  },
  {
    id: 'le_regatta', cat: 'possessions', scene: 'luxury', weight: 1, cooldown: 4, years: [1750, 2300], bind: ofTypes('sailboat'),
    title: 'Regatta',
    text: 'The summer regatta is on, and the wind is exactly right.',
    choices: [
      { label: 'Race to win', tags: ['ambitious'], run: (x) => { x.train('sailing', 4); if (x.chance(0.3 + x.skill('sailing') / 200)) { x.mods({ happiness: 8, popularity: 3 }); return 'You rounded the last buoy first and someone sprayed you with champagne.'; } x.mods({ happiness: 2 }); return 'Becalmed in the middle of the bay. You worked on your tan instead.'; } },
      { label: 'Cruise and picnic', tags: ['social'], run: (x) => { x.mods({ happiness: 5, stress: -5 }); return 'Sandwiches, sun and the race far in the distance.'; } },
    ],
  },
  {
    id: 'le_yachtParty', cat: 'possessions', scene: 'luxury', weight: 1.2, cooldown: 3, minAge: 18, bind: ofTypes('yacht'),
    title: 'Yacht party',
    text: 'Everyone you have ever met suddenly wants to know when your yacht is next going out.',
    choices: [
      { label: 'Throw the party of the year', tags: ['social', 'impulsive'], scene: 'party', run: (x) => { x.money(-cost(x, 20000)); x.mods({ popularity: 6, happiness: 6, fame: 1 }); if (x.famous) x.story('gossip', `Champagne and drama aboard ${x.c.firstName}'s yacht`, 1); return x.chance(0.3) ? 'Someone fell overboard (they were fine), and it made the party legendary.' : 'Sunset, music, champagne. People will talk about it for years.'; } },
      { label: 'Sail with close friends', tags: ['cautious'], run: (x) => { x.mods({ happiness: 5, stress: -6 }); for (const r of x.rels('bestFriend', 'friend').slice(0, 3)) x.relMod(r.npcId, 4); return 'Quiet coves, swimming off the deck, nobody checking their messages.'; } },
      { label: 'Charter it out', tags: ['ambitious'], scene: 'moneyUp', run: (x) => { const v = cost(x, 15000); x.money(v); wear(x, -10); return `${x.fmt(v)} for a week, and a strange stain in the master cabin.`; } },
    ],
  },
  {
    id: 'le_privateJet', cat: 'possessions', scene: 'travel', weight: 1, cooldown: 4, minAge: 18, bind: ofTypes('privateJet'),
    title: 'Wheels up',
    text: 'Your private jet is fuelled and the pilot asks, "Where to?"',
    choices: [
      { label: 'Lunch in another country', tags: ['impulsive'], run: (x) => { x.money(-cost(x, 30000)); x.mods({ happiness: 6, ego: 3 }); return 'You ate a sandwich in a different time zone and flew home for dinner.'; } },
      { label: 'Fly a sick friend to treatment', tags: ['help'], run: (x) => { x.money(-cost(x, 20000)); x.mods({ karma: 4, happiness: 4 }); return 'They held your hand the whole flight. Of everything you own, this was its best use.'; } },
      { label: 'Sell it', tags: ['cautious'], scene: 'moneyUp', run: (x) => { const i = loseItem(x, x.p.itemId as string); const v = Math.round((i?.value ?? 0) * 0.8); x.money(v); x.mods({ ego: -3 }); return `Sold for ${x.fmt(v)}. You fly first class now, like a peasant.`; } },
    ],
  },
  {
    id: 'le_flyingCar', cat: 'possessions', scene: 'car', weight: 1, cooldown: 4, bind: ofTypes('flyingCar'),
    title: 'Sky traffic',
    text: (x) => `The aerial lane over the city is jammed, and your ${iname(x)} hovers among a thousand others.`,
    choices: [
      { label: 'Take the restricted lane', tags: ['impulsive'], run: (x) => { if (x.chance(0.5)) { x.mods({ happiness: 3 }); return 'You zipped home in minutes. A drone photographed you, but nothing came of it.'; } x.money(-cost(x, 800)); return 'An automated fine arrived before you landed.'; } },
      { label: 'Land and walk', tags: ['cautious'], run: (x) => { x.mods({ fitness: 1, stress: -2 }); return 'Walking. On the ground. Like an ancestor. Strangely lovely.'; } },
    ],
  },
  {
    id: 'le_electricCharge', cat: 'possessions', scene: 'car', weight: 1, cooldown: 4, years: [2010, 2300], bind: ofTypes('electricCar'),
    title: 'Two percent',
    text: 'Your battery is at 2% and the only charger for miles is occupied by someone eating a three-course meal in their car.',
    choices: [
      { label: 'Knock on the window', tags: ['social'], run: (x) => { x.mods({ stress: 2 }); return x.chance(0.5) ? 'They moved, apologised and gave you a breadstick.' : 'They pointed at their soup and kept eating.'; } },
      { label: 'Wait it out', tags: ['cautious'], run: (x) => { x.mods({ stress: 3, wisdom: 1 }); return 'Forty minutes. You read an entire article about patience.'; } },
      { label: 'Gamble on the next one', tags: ['impulsive'], run: (x) => { if (x.chance(0.5)) return 'You arrived at 0%, rolling silently into the bay like a ghost.'; x.money(-cost(x, 200)); return 'Tow truck. Expensive tow truck.'; } },
    ],
  },
  {
    id: 'le_lostRing', cat: 'possessions', scene: 'jewelry', weight: 1.2, cooldown: 6, bind: ofTypes('goldRing', 'diamondRing', 'signetRing'),
    title: 'The ring is gone',
    text: (x) => `Your ${iname(x)} is not on your finger. You last remember it while washing up.`,
    choices: [
      { label: 'Take the sink apart', tags: ['ambitious'], run: (x) => { x.train('plumbing', 2); if (x.chance(0.7)) { x.mods({ happiness: 4 }); return 'It was in the U-bend, glinting at you like it had been waiting.'; } loseItem(x, x.p.itemId as string); x.mods({ happiness: -5 }); return 'A flooded kitchen and no ring.'; } },
      { label: 'Retrace your steps', tags: ['cautious'], run: (x) => { if (x.chance(0.5)) return 'It was in your coat pocket. You have no idea how.'; loseItem(x, x.p.itemId as string); x.mods({ happiness: -4 }); return 'Gone. Somewhere out there, someone found a very lucky day.'; } },
      { label: 'Let it go', run: (x) => { loseItem(x, x.p.itemId as string); x.mods({ happiness: -3, wisdom: 2 }); return 'Things come and go. You are surprised how much you mind.'; } },
    ],
  },
  {
    id: 'le_watchAppraisal', cat: 'possessions', scene: 'jewelry', weight: 0.9, cooldown: 6, bind: ofTypes('luxuryWatch', 'watch'),
    title: 'Watch this',
    text: (x) => `A jeweller squints at your ${iname(x)} and asks, very casually, where you got it.`,
    choices: [
      { label: 'Get it appraised', tags: ['cautious'], run: (x) => { const i = itm(x); if (x.chance(0.3) && i) { i.value *= 3; x.mods({ happiness: 5 }); return `Rare movement, limited run. It is worth ${x.fmt(i.value)}.`; } if (x.chance(0.3) && i) { i.value = Math.round(i.value * 0.1); x.mods({ happiness: -3 }); return 'A convincing fake. You feel personally betrayed by your own wrist.'; } return 'Exactly what you paid. The jeweller seemed disappointed for you.'; } },
      { label: 'Sell it to him', tags: ['impulsive'], scene: 'moneyUp', run: (x) => { const i = loseItem(x, x.p.itemId as string); const v = Math.round((i?.value ?? 0) * 1.2); x.money(v); return `${x.fmt(v)} on the spot. You suspect he got a bargain.`; } },
    ],
  },
  {
    id: 'le_tiaraLoan', cat: 'possessions', scene: 'museum', weight: 0.8, cooldown: 8, bind: ofTypes('tiara', 'necklace'),
    title: 'Museum request',
    text: (x) => `A museum wants to borrow your ${iname(x)} for an exhibition on jewellery through the ages.`,
    choices: [
      { label: 'Lend it', tags: ['help', 'social'], run: (x) => { x.mods({ publicImage: 3, happiness: 3 }); itemValue(x, 1.15); return 'Your name is on a little card under the glass. You visited six times.'; } },
      { label: 'Refuse', tags: ['cautious'], run: (x) => { x.mods({ happiness: 1 }); return 'It stays in your drawer, sparkling for nobody.'; } },
      { label: 'Wear it to the opening', tags: ['impulsive'], scene: 'fame', run: (x) => { x.mods({ looks: 2, popularity: 3, fame: 1 }); return 'You wore it, then handed it over. Everyone remembers the entrance.'; } },
    ],
  },
  {
    id: 'le_furCoat', cat: 'possessions', scene: 'riot', weight: 1, cooldown: 6, years: [1980, 2300], minAge: 18, bind: ofTypes('furCoat'),
    title: 'Fur flying',
    text: 'Outside the theatre, protesters spot your fur coat and start chanting.',
    choices: [
      { label: 'Walk past with dignity', tags: ['cautious'], run: (x) => { x.mods({ stress: 3, publicImage: -2 }); return 'You did not look back. Someone got a photo.'; } },
      { label: 'Donate it afterwards', tags: ['help'], run: (x) => { loseItem(x, x.p.itemId as string); x.mods({ karma: 3, publicImage: 2 }); return 'It went to a shelter that lines animal beds with old coats. Fitting.'; } },
      { label: 'Argue with them', tags: ['violent'], scene: 'argument', run: (x) => { x.mods({ stress: 5, publicImage: -3, aggression: 2 }); return 'Nobody changed their mind. Everyone lost their evening.'; } },
    ],
  },
  {
    id: 'le_sneakerResale', cat: 'possessions', scene: 'shopping', weight: 1, cooldown: 6, years: [1985, 2300], bind: ofTypes('sneakers'),
    title: 'Hype',
    text: 'The trainers you bought on a whim are now a limited edition that collectors are fighting over.',
    choices: [
      { label: 'Sell them', tags: ['ambitious'], scene: 'moneyUp', run: (x) => { loseItem(x, x.p.itemId as string); const v = cost(x, x.int(400, 1500)); x.money(v); return `${x.fmt(v)} for shoes. The world is extraordinary.`; } },
      { label: 'Keep them boxed', tags: ['cautious'], run: (x) => { itemValue(x, 2); return 'They live in their box, unworn, appreciating quietly.'; } },
      { label: 'Wear them out', tags: ['impulsive'], run: (x) => { x.mods({ happiness: 3, looks: 1 }); wear(x, -20); return 'A collector at the bus stop looked at you like you had kicked a puppy.'; } },
    ],
  },
  {
    id: 'le_wardrobe', cat: 'possessions', scene: 'shopping', weight: 0.9, cooldown: 6, minAge: 16, bind: ofTypes('wardrobe', 'fineClothes'),
    title: 'Nothing to wear',
    text: 'Your wardrobe is bursting, and yet you have nothing to wear.',
    choices: [
      { label: 'Clear it out', tags: ['cautious'], run: (x) => { x.mods({ stress: -4, happiness: 3, karma: 1 }); return 'Three bags to charity. You feel lighter, and found money in an old pocket.'; } },
      { label: 'Go shopping', tags: ['impulsive'], run: (x) => { x.money(-cost(x, 400)); x.mods({ happiness: 3, looks: 1 }); return 'You bought more clothes. The problem remains, now better dressed.'; } },
      { label: 'Restyle the old stuff', tags: ['ambitious'], run: (x) => { x.train('tailoring', 3); x.mods({ creativity: 2, happiness: 2 }); return 'A needle, some scissors, and your grandparent\'s old jacket became your favourite thing.'; } },
    ],
  },
  {
    id: 'le_gadgetDead', cat: 'possessions', scene: 'gadget', weight: 1.2, cooldown: 4, bind: ofTypes('radio', 'tv', 'computer', 'gameConsole', 'smartphone', 'phonograph', 'camera'),
    title: 'It just died',
    text: (x) => `Your ${iname(x)} made a small popping sound and now does nothing at all.`,
    choices: [
      { label: 'Get it repaired', tags: ['cautious'], run: (x) => { if (!x.spend(cost(x, 120))) return 'The repair cost more than you had. It sits on a shelf, accusingly.'; wear(x, 40); return 'A tiny part, replaced by a man who sighed a lot. Good as new.'; } },
      { label: 'Fix it yourself', tags: ['ambitious'], run: (x) => { x.train('electronicsRepair', 4); if (x.chance(0.4)) { wear(x, 30); return 'You fixed it. You are unbearable about it.'; } loseItem(x, x.p.itemId as string); return 'You now have a pile of parts and a deep respect for engineers.'; } },
      { label: 'Buy a new one', tags: ['impulsive'], run: (x) => { const i = itm(x); if (!i) return 'Nothing to replace.'; const t = ITEM_BY_ID[i.typeId]; if (!x.spend(cost(x, t?.price ?? 300))) return 'You could not afford a replacement.'; i.condition = 100; i.boughtYear = x.year; return 'Shiny and new. The old one goes in the drawer of old things.'; } },
    ],
  },
  {
    id: 'le_phoneDropped', cat: 'possessions', scene: 'gadget', weight: 1.2, cooldown: 3, years: [2007, 2300], bind: ofTypes('smartphone'),
    title: 'Face down',
    text: 'Your phone slipped out of your hand and landed face down on the pavement. You turn it over slowly.',
    choices: [
      { label: 'Look', tags: ['impulsive'], run: (x) => { if (x.chance(0.5)) { x.mods({ happiness: 3 }); return 'Not a scratch. You feel briefly invincible.'; } wear(x, -30); x.mods({ stress: 3 }); return 'A spider-web of cracks. You will use it like this for two years.'; } },
      { label: 'Buy a case finally', tags: ['cautious'], run: (x) => { x.money(-cost(x, 30)); wear(x, -10); return 'A small crack in the corner, and a case shaped like a cartoon cat.'; } },
    ],
  },
  {
    id: 'le_tvBroadcast', cat: 'possessions', scene: 'family', weight: 1.2, cooldown: 6, years: [1950, 1995], bind: ofTypes('tv', 'radio'),
    title: 'Everyone at yours',
    text: (x) => `The big broadcast is tonight, and you are the only one on the street with a ${iname(x)}.`,
    choices: [
      { label: 'Open the doors', tags: ['social', 'help'], run: (x) => { x.mods({ popularity: 5, happiness: 5, loneliness: -6 }); return 'Twenty people in your front room, someone brought sandwiches, and everyone cheered at once.'; } },
      { label: 'Family only', tags: ['cautious'], run: (x) => { x.mods({ happiness: 3 }); for (const r of x.rels('child', 'spouse', 'parent').slice(0, 4)) x.relMod(r.npcId, 2); return 'Just you and yours, crowded round the glow.'; } },
    ],
  },
  {
    id: 'le_homeRobot', cat: 'possessions', scene: 'robots', weight: 1.1, cooldown: 4, bind: ofTypes('homeRobot'),
    title: 'Robot rebellion',
    text: (x) => `Your ${iname(x)} has reorganised the kitchen "for efficiency". You cannot find a single spoon.`,
    choices: [
      { label: 'Reset its preferences', tags: ['cautious'], run: (x) => { x.mods({ stress: -1 }); return 'It complied, but placed the spoons back with what felt like sarcasm.'; } },
      { label: 'Learn the new system', tags: ['ambitious'], run: (x) => { x.mods({ discipline: 2, wisdom: 1 }); return 'It is, annoyingly, much better.'; } },
      { label: 'Give it a name', tags: ['social'], run: (x) => { x.mods({ happiness: 3, loneliness: -3 }); return 'You named it Gerald. Gerald seems happier. Can Gerald be happier?'; } },
    ],
  },
  {
    id: 'le_vrLost', cat: 'possessions', scene: 'gaming', weight: 1, cooldown: 4, bind: ofTypes('vrHeadset'),
    title: 'Lost in VR',
    text: 'You put the headset on for twenty minutes. It is now dark outside and you have missed two meals.',
    choices: [
      { label: 'Set a timer', tags: ['cautious'], run: (x) => { x.mods({ discipline: 2 }); return 'The timer works. Mostly. You snooze it twice.'; } },
      { label: 'Go back in', tags: ['impulsive'], run: (x) => { x.mods({ happiness: 3, fitness: -1, loneliness: 3 }); return 'You climbed a virtual mountain and forgot the real one in your laundry pile.'; } },
      { label: 'Invite friends in', tags: ['social'], run: (x) => { x.mods({ happiness: 4, loneliness: -4 }); return 'Your friends\' avatars are ridiculous. So is yours. Best night in ages.'; } },
    ],
  },
  {
    id: 'le_cameraPhotos', cat: 'possessions', scene: 'museum', weight: 1, cooldown: 5, years: [1850, 2300], bind: ofTypes('camera'),
    title: 'One great photo',
    text: 'Out of hundreds of blurry shots, one of your photographs is genuinely beautiful.',
    choices: [
      { label: 'Enter a competition', tags: ['ambitious'], run: (x) => { x.train('photography', 4); if (x.chance(0.3)) { x.money(cost(x, 500)); x.mods({ happiness: 6, confidence: 4 }); return 'First prize. It was printed in the paper with your name in tiny letters.'; } return 'No prize, but a judge wrote "lovely light" on your entry.'; } },
      { label: 'Frame it at home', tags: ['cautious'], run: (x) => { x.train('photography', 2); x.mods({ happiness: 3 }); return 'Visitors always ask about it.'; } },
    ],
  },
  {
    id: 'le_paintingAppraisal', cat: 'possessions', scene: 'museum', weight: 1.1, cooldown: 8, bind: ofTypes('painting', 'masterpiece', 'portrait'),
    title: 'Real or fake?',
    text: (x) => `An expert visiting a friend lingers in front of your ${iname(x)}, frowning in a way that could mean anything.`,
    choices: [
      { label: 'Get it authenticated', tags: ['cautious'], run: (x) => { x.money(-cost(x, 500)); const i = itm(x); if (!i) return 'It has gone missing.'; const r = x.r(); if (r < 0.25) { i.value = Math.round(i.value * 8); x.mods({ happiness: 8 }); return `An unknown early work by a celebrated painter. It is now worth ${x.fmt(i.value)}.`; } if (r < 0.5) { i.value = Math.round(i.value * 0.05); x.mods({ happiness: -4 }); return 'A clever forgery. You still like it, which is somehow worse.'; } return 'Genuine, and worth roughly what you paid. A relief and a disappointment.'; } },
      { label: 'Never ask', tags: ['impulsive'], run: (x) => { x.mods({ happiness: 2, wisdom: 1 }); return 'It is beautiful. That is all you need to know.'; } },
    ],
  },
  {
    id: 'le_collectorOffer', cat: 'possessions', scene: 'moneyUp', weight: 1, cooldown: 6, bind: ofTypes('masterpiece', 'sculpture', 'rareBook', 'stamps', 'comics', 'heirloomSword', 'wineCellar'),
    title: 'An offer',
    text: (x) => `A collector writes with an offer for your ${iname(x)}: generous, and only open for a week.`,
    choices: [
      { label: 'Accept', tags: ['ambitious'], run: (x) => { const i = loseItem(x, x.p.itemId as string); const v = Math.round((i?.value ?? cost(x, 1000)) * x.float(1.2, 1.8)); x.money(v); x.mods({ happiness: 3 }); return `Sold for ${x.fmt(v)}. The shelf looks strangely empty.`; } },
      { label: 'Hold out for more', tags: ['impulsive'], run: (x) => { if (x.chance(0.4)) { const i = loseItem(x, x.p.itemId as string); const v = Math.round((i?.value ?? cost(x, 1000)) * 2.2); x.money(v); return `They came back with ${x.fmt(v)}. Your nerves of steel paid off.`; } return 'The collector bought someone else\'s instead. You pretend you are relieved.'; } },
      { label: 'Refuse', tags: ['cautious'], run: (x) => { x.mods({ happiness: 2 }); itemValue(x, 1.05); return 'Some things are not for sale. It is worth a bit more to you now, somehow.'; } },
    ],
  },
  {
    id: 'le_sculptureBroken', cat: 'possessions', scene: 'party', weight: 0.8, cooldown: 8, minAge: 18, bind: ofTypes('sculpture'),
    title: 'Party casualty',
    text: (x) => `A guest backing up for a photo knocks your ${iname(x)} off its plinth. Time slows.`,
    choices: [
      { label: 'Dive for it', tags: ['impulsive'], run: (x) => { if (x.chance(0.4)) { x.mods({ happiness: 4, popularity: 2 }); return 'You caught it inches from the floor. The room burst into applause.'; } itemValue(x, 0.3); return 'You caught half of it.'; } },
      { label: 'Stay gracious', tags: ['help', 'social'], run: (x) => { itemValue(x, 0.4); x.mods({ popularity: 3, karma: 1 }); return 'You told them it was "more interesting now". They will love you forever.'; } },
      { label: 'Send them the bill', tags: ['cautious'], run: (x) => { const v = cost(x, 2000); x.money(v); itemValue(x, 0.3); x.mods({ popularity: -3 }); return `They paid ${x.fmt(v)} and stopped coming to your parties.`; } },
    ],
  },
  {
    id: 'le_rareBook', cat: 'possessions', scene: 'library', weight: 0.9, cooldown: 8, bind: ofTypes('rareBook', 'library'),
    title: 'Notes in the margin',
    text: 'Leafing through an old volume, you find handwritten notes in the margins, and a pressed flower.',
    choices: [
      { label: 'Research the handwriting', tags: ['ambitious'], run: (x) => { x.train('history', 4); if (x.chance(0.25)) { itemValue(x, 4); x.mods({ happiness: 6 }); return 'The notes belong to a famous thinker. Scholars now write to you.'; } x.mods({ happiness: 2 }); return 'A long-dead schoolteacher who disagreed with every chapter. You adore them.'; } },
      { label: 'Add your own note', tags: ['social'], run: (x) => { x.mods({ creativity: 2, happiness: 2 }); return 'You wrote a reply, for whoever finds it next.'; } },
    ],
  },
  {
    id: 'le_stampsError', cat: 'possessions', scene: 'jewelry', weight: 0.9, cooldown: 8, bind: ofTypes('stamps', 'comics'),
    title: 'A printing error',
    text: (x) => `Something in your ${iname(x)} has a printing mistake. Collectors go wild for mistakes.`,
    choices: [
      { label: 'Take it to a dealer', tags: ['ambitious'], run: (x) => { if (x.chance(0.4)) { itemValue(x, 5); x.mods({ happiness: 7 }); return 'An authentic rarity. The dealer had to sit down.'; } return 'A common error. Very common. The dealer was kind about it.'; } },
      { label: 'Keep it secret', tags: ['cautious'], run: (x) => { x.mods({ happiness: 2 }); return 'You check on it sometimes, like a dragon checking its gold.'; } },
    ],
  },
  {
    id: 'le_heirloom', cat: 'possessions', scene: 'family', weight: 1, cooldown: 10, bind: ofTypes('heirloomSword', 'signetRing', 'portrait'),
    title: 'Family heirloom',
    text: (x) => `A young relative asks about the ${iname(x)} and the stories that come with it.`,
    choices: [
      { label: 'Tell the whole story', tags: ['social'], run: (x) => { x.mods({ happiness: 4, wisdom: 2 }); x.remember('heirloomStory', 'Told the family story of an heirloom', 10); return 'You exaggerated the heroic parts. That is tradition.'; } },
      { label: 'Promise it to them', tags: ['help'], run: (x) => { x.mods({ happiness: 3, karma: 1 }); x.setFlag('heirloomPromised', true); return 'Their eyes went wide. You have made someone very patient.'; } },
      { label: 'Have it valued', tags: ['ambitious'], run: (x) => { const i = itm(x); if (i && x.chance(0.4)) { i.value = Math.round(i.value * 3); return `Worth ${x.fmt(i.value)}. Suddenly everyone is interested in family history.`; } return 'Sentimental value only. Which is, of course, the best kind.'; } },
    ],
  },
  {
    id: 'le_wineVintage', cat: 'possessions', scene: 'restaurant', weight: 1, cooldown: 6, minAge: 18, bind: ofTypes('wineCellar'),
    title: 'The special bottle',
    text: 'In the back of the cellar you find a dusty bottle from a legendary year.',
    choices: [
      { label: 'Open it tonight', tags: ['impulsive', 'social'], run: (x) => { itemValue(x, 0.9); x.mods({ happiness: 6 }); for (const r of x.rels('spouse', 'partner', 'bestFriend').slice(0, 2)) x.relMod(r.npcId, 4); return 'It tasted like a sunny afternoon a century ago. Worth every penny.'; } },
      { label: 'Save it for a big day', tags: ['cautious'], run: (x) => { x.mods({ happiness: 1 }); return 'It goes back on the rack. Some day will be big enough.'; } },
      { label: 'Auction it', tags: ['ambitious'], scene: 'moneyUp', run: (x) => { const v = cost(x, x.int(2000, 12000)); x.money(v); return `A collector in a cravat paid ${x.fmt(v)} for one bottle of grape juice.`; } },
    ],
  },
  {
    id: 'le_pianoTuning', cat: 'possessions', scene: 'music', weight: 1, cooldown: 5, bind: ofTypes('piano', 'lute', 'violin', 'guitar'),
    title: 'Out of tune',
    text: (x) => `Your ${iname(x)} sounds like it is being played underwater.`,
    choices: [
      { label: 'Hire a tuner', tags: ['cautious'], run: (x) => { x.money(-cost(x, 150)); wear(x, 20); x.mods({ happiness: 2 }); return 'The tuner played a little piece afterwards and you nearly cried.'; } },
      { label: 'Tune it by ear', tags: ['ambitious'], run: (x) => { x.train('music', 3); return x.skill('music') > 30 ? 'Near perfect. You feel like a wizard.' : 'Different. Not better. Different.'; } },
      { label: 'Play it anyway', tags: ['impulsive'], run: (x) => { x.train('music', 1); x.mods({ happiness: 2 }); return 'You call it "experimental". Guests call a taxi.'; } },
    ],
  },
  {
    id: 'le_violinHistory', cat: 'possessions', scene: 'music', weight: 0.6, once: true, bind: ofTypes('violin'),
    title: 'A label inside',
    text: 'Peering through the f-hole of your violin, you spot a faded label with an old maker\'s name.',
    choices: [
      { label: 'Get it examined', tags: ['cautious'], run: (x) => { if (x.chance(0.15)) { itemValue(x, 30); x.mods({ happiness: 10 }); return 'A genuine old master instrument. Insurance alone costs more than your car.'; } x.mods({ happiness: 1 }); return 'Labels like that were put in thousands of factory violins. Still sounds lovely.'; } },
      { label: 'Play something worthy of it', tags: ['social'], run: (x) => { x.train('instrumentMastery', 3); x.mods({ happiness: 3 }); return 'You played better than you have ever played. Maybe it was the label.'; } },
    ],
  },
  {
    id: 'le_drumsNeighbours', cat: 'possessions', scene: 'music', weight: 1, cooldown: 4, bind: ofTypes('drums', 'synth', 'guitar'),
    title: 'Too loud',
    text: (x) => `A note under your door: "PLEASE stop the ${iname(x)} after 10pm. We are begging."`,
    choices: [
      { label: 'Soundproof the room', tags: ['help'], run: (x) => { x.money(-cost(x, 800)); x.mods({ happiness: 3 }); return 'Egg boxes, foam and rugs. The neighbours sent a thank-you card.'; } },
      { label: 'Invite them to listen', tags: ['social'], run: (x) => { x.train('music', 2); return x.chance(0.5) ? 'One of them plays bass. You have a band now.' : 'They listened politely and asked again about 10pm.'; } },
      { label: 'Play louder', tags: ['violent', 'impulsive'], run: (x) => { x.mods({ karma: -1, stress: 2 }); x.train('music', 3); return 'Your technique improved. Your relationship with the street did not.'; } },
    ],
  },
  {
    id: 'le_hotTub', cat: 'possessions', scene: 'spa', weight: 1, cooldown: 5, minAge: 18, bind: ofTypes('hotTub'),
    title: 'Hot tub night',
    text: 'The hot tub is bubbling, the stars are out and your phone is buzzing with friends asking if they can come over.',
    choices: [
      { label: 'Invite everyone', tags: ['social'], scene: 'party', run: (x) => { x.mods({ happiness: 5, popularity: 3, loneliness: -5 }); return 'Nine people in a tub built for six. Someone brought a ukulele.'; } },
      { label: 'A quiet soak', tags: ['cautious'], run: (x) => { x.mods({ stress: -7, pain: -3 }); return 'Steam, silence and stars.'; } },
    ],
  },
  {
    id: 'le_poolHustler', cat: 'possessions', scene: 'bar', weight: 0.9, cooldown: 5, minAge: 16, bind: ofTypes('poolTable', 'chessSet'),
    title: 'Friendly game?',
    text: (x) => `A friend of a friend sees your ${iname(x)} and suggests a game "for a little money".`,
    choices: [
      { label: 'Play for money', tags: ['impulsive'], scene: 'casino', run: (x) => { const v = cost(x, 100); if (x.chance(0.4)) { x.money(v); return `You won ${x.fmt(v)}. They suddenly remembered an appointment.`; } x.money(-v * 2); return `They lost the first game, then won the next three. Classic. ${x.fmt(v * 2)} down.`; } },
      { label: 'Play for fun', tags: ['social'], run: (x) => { x.mods({ happiness: 3 }); return 'They are clearly a professional. They let you win one, kindly.'; } },
    ],
  },
  {
    id: 'le_telescopeComet', cat: 'possessions', scene: 'stargazing', weight: 0.9, cooldown: 6, bind: ofTypes('telescope'),
    title: 'Something new',
    text: 'Through your telescope you spot a faint smudge that is not on any of your charts.',
    choices: [
      { label: 'Report it', tags: ['ambitious'], run: (x) => { x.train('astronomy', 4); if (x.chance(0.2)) { x.mods({ fame: 2, happiness: 8 }); x.remember('comet', 'Discovered a comet', 30); return 'A new comet, and it carries your name. Somewhere up there, forever.'; } return 'Already catalogued, last week, by a twelve-year-old.'; } },
      { label: 'Just watch', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 2, stress: -4 }); return 'You watched until dawn, feeling very small and perfectly fine.'; } },
    ],
  },
  {
    id: 'le_racehorseDerby', cat: 'possessions', scene: 'petHorse', weight: 1.1, cooldown: 3, minAge: 18, bind: ofTypes('racehorse'),
    title: 'Race day',
    text: 'Your racehorse is entered in a big race. The trainer is optimistic, which worries you.',
    choices: [
      { label: 'Back your own horse', tags: ['impulsive'], scene: 'casino', run: (x) => { const b = cost(x, 2000); x.money(-b); if (x.chance(0.25)) { x.money(b * 6); x.mods({ happiness: 10, fame: 1 }); return `Won by a nose. You collected ${x.fmt(b * 6)} and lost your voice.`; } return 'Fifth. The horse looked happy, at least.'; } },
      { label: 'Just enjoy the day', tags: ['social'], run: (x) => { x.mods({ happiness: 4 }); if (x.chance(0.2)) { x.money(cost(x, 10000)); return `A place finish and ${x.fmt(cost(x, 10000))} in prize money.`; } return 'Big hats, bad weather, a respectable sixth.'; } },
      { label: 'Sell to a syndicate', tags: ['cautious'], scene: 'moneyUp', run: (x) => { const i = loseItem(x, x.p.itemId as string); const v = Math.round((i?.value ?? 0) * 1.3); x.money(v); return `Sold for ${x.fmt(v)}. You still watch its races.`; } },
    ],
  },
  {
    id: 'le_spaceTicket', cat: 'possessions', scene: 'rocket', weight: 1.5, cooldown: 3, bind: ofTypes('spaceTicket'),
    title: 'Launch window',
    text: 'Your space ticket finally has a launch date. The medical forms are thirty pages long.',
    choices: [
      { label: 'Go to space', tags: ['ambitious', 'impulsive'], scene: 'rocket', run: (x) => { loseItem(x, x.p.itemId as string); x.mods({ happiness: 15, wisdom: 4, fame: 1 }); x.remember('space', 'Saw the Earth from orbit', 60); return 'You saw the whole planet, blue and thin-skinned, and came back a slightly different person.'; } },
      { label: 'Postpone again', tags: ['cautious'], run: (x) => { x.mods({ anxiety: 2 }); return 'Next year. Definitely next year.'; } },
      { label: 'Sell the seat', tags: ['cautious'], scene: 'moneyUp', run: (x) => { const i = loseItem(x, x.p.itemId as string); const v = Math.round((i?.value ?? 0) * 1.1); x.money(v); return `A billionaire\'s nephew paid ${x.fmt(v)}. You watched the launch from your sofa.`; } },
    ],
  },
  {
    id: 'le_homeGym', cat: 'possessions', scene: 'gym', weight: 1, cooldown: 4, bind: ofTypes('homeGym'),
    title: 'Clothes horse',
    text: 'Your home gym has become an expensive place to dry laundry.',
    choices: [
      { label: 'Commit to a routine', tags: ['ambitious'], run: (x) => { x.mods({ fitness: 5, discipline: 3, happiness: 2 }); x.train('strengthTraining', 3); return 'Six weeks straight. You are insufferable about it.'; } },
      { label: 'Sell it', tags: ['cautious'], scene: 'moneyUp', run: (x) => { const i = loseItem(x, x.p.itemId as string); const v = Math.round((i?.value ?? 0) * 0.6); x.money(v); return `Gone for ${x.fmt(v)} to someone with the same dream.`; } },
      { label: 'Keep drying laundry', run: (x) => { x.mods({ happiness: 1 }); return 'It really is an excellent drying rack.'; } },
    ],
  },
];

/* ------------------------------------------------------------------ hobbies and leisure */

const HOBBY_EVENTS: EventDef[] = [
  {
    id: 'le_pickupGame', cat: 'leisure', scene: 'sports', weight: 1, cooldown: 3, minAge: 10, maxAge: 60,
    title: 'Pickup game',
    text: (x) => x.year < 1850 ? 'The village lads are kicking a pig\'s bladder between two churches and need one more player.' : 'A pickup game in the park is one player short. Someone points at you.',
    choices: [
      { label: 'Play hard', tags: ['ambitious'], run: (x) => { x.train('ballSports', 3); x.mods({ fitness: 3 }); if (x.chance(0.2)) { x.mods({ health: -4, pain: 5 }); return 'You scored, celebrated, and twisted your ankle doing it.'; } x.mods({ happiness: 4 }); return 'You scored the winner and pretended it was planned.'; } },
      { label: 'Play for fun', tags: ['social'], run: (x) => { x.train('ballSports', 2); x.mods({ happiness: 4, loneliness: -3 }); return 'Nobody kept score after the first ten minutes. Perfect.'; } },
      { label: 'Keep score instead', tags: ['cautious'], run: (x) => { x.mods({ happiness: 1 }); return 'You were the most respected referee in the history of the park.'; } },
    ],
  },
  {
    id: 'le_marathon', cat: 'leisure', scene: 'sports', weight: 0.8, cooldown: 5, years: [1896, 2300], minAge: 18, maxAge: 75,
    title: 'The marathon',
    text: 'Entries for the city marathon close tomorrow. Your trainers are giving you a look.',
    choices: [
      { label: 'Train and run it', tags: ['ambitious'], run: (x) => { x.train('marathon', 5); x.train('running', 3); if (x.stat('fitness') > 45 || x.chance(0.4)) { x.mods({ fitness: 5, happiness: 8, confidence: 4, willpower: 3 }); x.remember('marathon', 'Ran a marathon', 25); return 'You crossed the line in a foil blanket, sobbing happily, legs made of wood.'; } x.mods({ pain: 6, happiness: 2 }); return 'You walked the last ten miles. You still finished. Medal on the fridge.'; } },
      { label: 'Run for charity', tags: ['help'], run: (x) => { x.mods({ karma: 3, fitness: 3, happiness: 5 }); return 'Your friends sponsored you generously, mostly to see you in the giant banana costume.'; } },
      { label: 'Cheer from the side', tags: ['cautious'], run: (x) => { x.mods({ happiness: 3 }); return 'You handed out orange slices and felt part of something.'; } },
    ],
  },
  {
    id: 'le_bandAudition', cat: 'leisure', scene: 'music', weight: 0.9, cooldown: 5, years: [1955, 2300], minAge: 14, maxAge: 45,
    title: 'Band wanted',
    text: 'A card in the music shop window: "Band needs a member. Must own instrument. No egos."',
    choices: [
      { label: 'Audition', tags: ['ambitious'], run: (x) => { x.train('music', 3); if (x.chance(0.3 + x.skill('music') / 150)) { x.setFlag('inBand', true); x.mods({ happiness: 6, loneliness: -6, confidence: 3 }); return 'You are in. The band is called something terrible and you love it.'; } return 'They chose the drummer\'s cousin. There is always nepotism.'; } },
      { label: 'Start your own band', tags: ['social', 'ambitious'], run: (x) => { x.train('music', 2); x.mods({ happiness: 4, creativity: 3 }); return 'Three practices, one gig in a pub, a thousand arguments about the name.'; } },
      { label: 'Practice alone a bit longer', tags: ['cautious'], run: (x) => { x.train('music', 3); return 'Another year in the bedroom. You are getting genuinely good.'; } },
    ],
  },
  {
    id: 'le_openMic', cat: 'leisure', scene: 'stage', weight: 0.9, cooldown: 4, years: [1950, 2300], minAge: 16,
    title: 'Open mic night',
    text: 'The café is running an open mic. The sign-up sheet has one empty line left.',
    choices: [
      { label: 'Sing something', tags: ['impulsive'], run: (x) => { x.train('singing', 3); if (x.chance(0.3 + x.skill('singing') / 120)) { x.mods({ happiness: 7, confidence: 5, popularity: 3 }); return 'The room went quiet in the good way. Someone asked for your name.'; } x.mods({ happiness: -1, confidence: -2 }); return 'You started in the wrong key and never found the right one.'; } },
      { label: 'Try stand-up', tags: ['social'], run: (x) => { x.train('comedy', 4); return x.chance(0.4) ? 'Your bit about your landlord killed. You are hooked.' : 'Five minutes of silence, one cough, and a sympathetic clap.'; } },
      { label: 'Watch and clap', tags: ['cautious'], run: (x) => { x.mods({ happiness: 3 }); return 'A nervous teenager sang beautifully and you clapped until your hands hurt.'; } },
    ],
  },
  {
    id: 'le_streetArt', cat: 'leisure', scene: 'painting', weight: 0.9, cooldown: 4, minAge: 10,
    title: 'Paint the town',
    text: 'You have been sketching every day. A local shop owner asks if you would paint their wall.',
    choices: [
      { label: 'Paint a mural', tags: ['ambitious'], run: (x) => { x.train('painting', 4); x.mods({ creativity: 3, happiness: 5, popularity: 2 }); return 'It took a month. Tourists now take photos in front of it.'; } },
      { label: 'Ask for payment', tags: ['cautious'], run: (x) => { x.train('painting', 3); const v = cost(x, 400); x.money(v); return `${x.fmt(v)} and free coffee for life. A professional artist at last.`; } },
      { label: 'Say you are not ready', run: (x) => { x.mods({ confidence: -1 }); return 'Someone else painted it. It is fine. Yours would have been better.'; } },
    ],
  },
  {
    id: 'le_artFair', cat: 'leisure', scene: 'painting', weight: (x) => x.skill('painting') > 15 || x.skill('art') > 15 ? 1.5 : 0.3, cooldown: 4, minAge: 16,
    title: 'Art fair stall',
    text: 'You have rented a tiny stall at the art fair with twelve of your paintings.',
    choices: [
      { label: 'Price them high', tags: ['ambitious'], run: (x) => { if (x.chance(0.25 + x.skill('painting') / 200)) { const v = cost(x, 1500); x.money(v); x.mods({ confidence: 5, happiness: 6 }); return `A collector bought three. ${x.fmt(v)}, and a card from a gallery.`; } return 'Everyone admired them. Nobody bought one.'; } },
      { label: 'Price them to sell', tags: ['social'], run: (x) => { const v = cost(x, 400); x.money(v); x.mods({ happiness: 4 }); return `Sold out by lunch for ${x.fmt(v)}. Your art now hangs in a dozen kitchens.`; } },
      { label: 'Give one to a child who loved it', tags: ['help'], run: (x) => { x.mods({ karma: 2, happiness: 5 }); return 'Their face was the best review you will ever get.'; } },
    ],
  },
  {
    id: 'le_giantVeg', cat: 'leisure', scene: 'gardening', weight: 1, cooldown: 4, minAge: 25,
    title: 'Giant marrow',
    text: 'Your marrow is the size of a small child, and the village show is next week.',
    choices: [
      { label: 'Guard it overnight', tags: ['ambitious'], run: (x) => { x.train('farming', 3); if (x.chance(0.4)) { x.mods({ happiness: 8, popularity: 2 }); return 'First prize. Your photo is in the parish newsletter, beside the marrow.'; } return 'Beaten by an obvious cheat who used a hosepipe of feed. You know what you saw.'; } },
      { label: 'Cook it', tags: ['impulsive'], scene: 'cooking', run: (x) => { x.train('cooking', 2); x.mods({ happiness: 3 }); return 'Marrow soup for forty. Everyone was very polite about it.'; } },
    ],
  },
  {
    id: 'le_hobbyRival', cat: 'leisure', scene: 'jealousy', weight: 0.8, cooldown: 8, minAge: 30,
    title: 'Garden rivalry',
    text: 'Your neighbour has begun growing roses directly visible from your window. Bigger roses. Redder roses.',
    choices: [
      { label: 'Declare war', tags: ['ambitious', 'violent'], scene: 'gardening', run: (x) => { x.train('farming', 4); x.mods({ stress: 3, happiness: 3, aggression: 1 }); x.setFlag('gardenRival', true); return 'Fertiliser, books, late nights. Your roses are now visible from space.'; } },
      { label: 'Ask for their secret', tags: ['social', 'help'], scene: 'gardening', run: (x) => { x.train('farming', 3); x.mods({ happiness: 4, loneliness: -4 }); return 'Coffee grounds and talking to them. You are now best friends, sort of.'; } },
      { label: 'Close the curtains', tags: ['cautious'], run: (x) => { x.mods({ happiness: -1 }); return 'Out of sight, mostly out of mind.'; } },
    ],
  },
  {
    id: 'le_gardenPests', cat: 'leisure', scene: 'gardening', weight: 0.9, cooldown: 4, minAge: 16,
    title: 'Slugs',
    text: 'Overnight, something has eaten every lettuce you planted, leaving only a shimmering trail.',
    choices: [
      { label: 'Beer traps', tags: ['cautious'], run: (x) => { x.train('farming', 2); return 'The slugs died happy. The lettuces came back.'; } },
      { label: 'Torch patrol at midnight', tags: ['ambitious'], run: (x) => { x.mods({ energy: -3, happiness: 2 }); x.train('farming', 2); return 'You collected two hundred slugs in a bucket and felt like a general.'; } },
      { label: 'Grow something they hate', tags: ['help'], run: (x) => { x.train('herbalism', 2); x.mods({ wisdom: 1 }); return 'A border of herbs. The slugs went next door. Sorry, next door.'; } },
    ],
  },
  {
    id: 'le_cookOff', cat: 'leisure', scene: 'cooking', weight: 1, cooldown: 4, minAge: 14,
    title: 'The cook-off',
    text: (x) => `The neighbourhood ${x.year >= 1900 ? 'chili' : 'pie'} contest needs entries, and you have a family recipe.`,
    choices: [
      { label: 'Use the family recipe', tags: ['cautious'], run: (x) => { x.train('cooking', 3); if (x.chance(0.35 + x.skill('cooking') / 200)) { x.mods({ happiness: 7, popularity: 3 }); return 'First place. Your grandmother would be insufferable about it.'; } return 'Third place, beaten by a man who added chocolate. Heresy.'; } },
      { label: 'Experiment wildly', tags: ['impulsive'], run: (x) => { x.train('cooking', 3); x.mods({ creativity: 2 }); return x.chance(0.4) ? 'Your mango and smoked pepper creation won "most daring" and a cult following.' : 'One judge needed a glass of milk and a lie down.'; } },
      { label: 'Judge instead', tags: ['social'], run: (x) => { x.mods({ happiness: 4, health: -1 }); return 'Twenty-two bowls. You did not need dinner for three days.'; } },
    ],
  },
  {
    id: 'le_dinnerParty', cat: 'leisure', scene: 'familyDinner', weight: 1, cooldown: 4, minAge: 20,
    title: 'Dinner party',
    text: 'Eight guests arrive in an hour. The main course is still frozen solid.',
    choices: [
      { label: 'Improvise', tags: ['impulsive'], scene: 'cooking', run: (x) => { x.train('cooking', 3); x.mods({ creativity: 2 }); return x.chance(0.6) ? 'Pasta with whatever was in the cupboard. Guests asked for the recipe.' : 'Toast, three ways. People were kind.'; } },
      { label: 'Order in and plate it', tags: ['cautious'], when: (x) => x.year >= 1950, run: (x) => { x.money(-cost(x, 150)); x.mods({ stress: -2 }); return 'Nobody knew. You accepted the compliments with a straight face.'; } },
      { label: 'Confess and laugh', tags: ['social'], run: (x) => { x.mods({ popularity: 2, happiness: 3 }); return 'You all went to the pub. Best dinner party you have thrown.'; } },
    ],
  },
  {
    id: 'le_sourdough', cat: 'leisure', scene: 'cooking', weight: 0.9, cooldown: 5, minAge: 14,
    title: 'The starter',
    text: 'A friend gives you a jar of bubbling sourdough starter and says it is older than both of you.',
    choices: [
      { label: 'Feed it every day', tags: ['cautious'], run: (x) => { x.train('baking', 4); x.mods({ discipline: 2, happiness: 3 }); return 'You named it. It has outlived two of your houseplants.'; } },
      { label: 'Bake for the whole street', tags: ['help', 'social'], run: (x) => { x.train('baking', 3); x.mods({ popularity: 3, happiness: 4 }); return 'Warm loaves on every doorstep. The street smells like a hug.'; } },
      { label: 'Forget it in the fridge', run: (x) => { x.mods({ happiness: -1 }); return 'It developed a personality and some kind of moral code. You threw it out.'; } },
    ],
  },
  {
    id: 'le_fishingBig', cat: 'leisure', scene: 'fishing', weight: 1, cooldown: 3, minAge: 8,
    title: 'The big one',
    text: 'Your line goes tight and the rod bends double. This is the one you will talk about forever.',
    choices: [
      { label: 'Fight it slowly', tags: ['cautious'], run: (x) => { x.train('fishing', 4); if (x.chance(0.5 + x.skill('fishing') / 200)) { x.mods({ happiness: 7 }); return `A monster. You have the photo, and every year it gets ${x.int(2, 4)} inches bigger.`; } x.mods({ happiness: -1 }); return 'The line snapped. It was "this big". Nobody believes you.'; } },
      { label: 'Yank it in', tags: ['impulsive'], run: (x) => { x.train('fishing', 2); return x.chance(0.3) ? 'Somehow it worked. A fine fish for supper.' : 'You fell in the river. The fish did not.'; } },
      { label: 'Let it go', tags: ['help'], run: (x) => { x.mods({ karma: 1, wisdom: 1, happiness: 2 }); return 'You saw its eye for a second, then it was gone. That was enough.'; } },
    ],
  },
  {
    id: 'le_fishingLicence', cat: 'leisure', scene: 'fishing', weight: 0.7, cooldown: 5, years: [1870, 2300], minAge: 14,
    title: 'Licence please',
    text: 'A warden strolls along the bank checking fishing licences. Yours is in a drawer at home. Probably.',
    choices: [
      { label: 'Admit it', tags: ['cautious'], run: (x) => { x.money(-cost(x, 80)); return 'A small fine and a tip about where the big trout lurk. Fair trade.'; } },
      { label: 'Bluff', tags: ['impulsive'], run: (x) => { if (x.chance(0.4)) return 'You described the licence in such detail that he moved on.'; x.money(-cost(x, 200)); return 'Fined twice: once for fishing, once for the story.'; } },
    ],
  },
  {
    id: 'le_hikeLost', cat: 'leisure', scene: 'hiking', weight: 0.8, cooldown: 4, minAge: 14, maxAge: 75,
    title: 'Off the trail',
    text: 'The mist comes down and the path you were following has simply vanished.',
    choices: [
      { label: 'Follow the stream down', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 2, fitness: 2 }); return 'Wet feet, but it led you to a village and a very welcome pub.'; } },
      { label: 'Push on to the top', tags: ['ambitious'], run: (x) => { x.train('mountaineering', 3); if (x.chance(0.6)) { x.mods({ happiness: 6, confidence: 3 }); return 'You broke through the cloud at the summit into blazing sunshine.'; } x.mods({ health: -4, stress: 5 }); return 'A cold night under a rock. You walked down at dawn, humbled.'; } },
      { label: 'Wait for it to clear', tags: ['cautious'], run: (x) => { x.mods({ stress: 2 }); return 'Two hours of sandwiches and fog, then the valley appeared below like a gift.'; } },
    ],
  },
  {
    id: 'le_summit', cat: 'leisure', scene: 'hiking', weight: 0.7, cooldown: 6, minAge: 16, maxAge: 70,
    title: 'Summit fever',
    text: 'There is a mountain you have looked at your whole life. This summer, you could climb it.',
    choices: [
      { label: 'Climb it', tags: ['ambitious'], run: (x) => { x.train('mountaineering', 4); x.train('climbing', 2); x.mods({ fitness: 4, happiness: 7 }); x.remember('summit', 'Stood on top of the mountain', 20); return 'From the top you could see your whole life, small and lovely.'; } },
      { label: 'Hire a guide', tags: ['cautious'], run: (x) => { x.money(-cost(x, 300)); x.train('mountaineering', 3); x.mods({ happiness: 6 }); return 'The guide told you stories all the way up. You will remember them longer than the view.'; } },
      { label: 'Admire it from below', run: (x) => { x.mods({ happiness: 1 }); return 'It will still be there next year. Probably.'; } },
    ],
  },
  {
    id: 'le_campingBear', cat: 'leisure', scene: 'camping', weight: 0.7, cooldown: 5, minAge: 10,
    title: 'Something outside',
    text: 'In the middle of the night, something large is sniffing around your camp.',
    choices: [
      { label: 'Make yourself big and loud', tags: ['violent'], run: (x) => { x.mods({ confidence: 3, stress: 4 }); return 'You roared. It ran. It was a very startled deer.'; } },
      { label: 'Stay silent in the tent', tags: ['cautious'], run: (x) => { x.mods({ stress: 5, anxiety: 2 }); return 'In the morning the food bag was shredded and you were not. A fair trade.'; } },
    ],
  },
  {
    id: 'le_campingRain', cat: 'leisure', scene: 'camping', weight: 0.9, cooldown: 4, minAge: 8,
    title: 'Washed out',
    text: 'The forecast said "light showers". Your tent is now a small boat.',
    choices: [
      { label: 'Make the best of it', tags: ['social'], run: (x) => { x.mods({ happiness: 3, resilience: 2 }); return 'Card games under a tarp, soggy marshmallows, and the best stories of the year.'; } },
      { label: 'Retreat to a guesthouse', tags: ['cautious'], run: (x) => { x.money(-cost(x, 100)); x.mods({ stress: -2 }); return 'Dry sheets. Hot water. You have never been so grateful.'; } },
    ],
  },
  {
    id: 'le_campfire', cat: 'leisure', scene: 'camping', weight: 0.9, cooldown: 4, minAge: 8,
    title: 'Campfire stories',
    text: 'Everyone around the campfire has told a story. Now they are looking at you.',
    choices: [
      { label: 'Tell a ghost story', tags: ['social'], run: (x) => { x.train('acting', 1); x.mods({ happiness: 4, popularity: 2 }); return 'Someone screamed at exactly the right moment. A masterpiece.'; } },
      { label: 'Tell a true one', tags: ['cautious'], run: (x) => { x.mods({ empathy: 2, loneliness: -4 }); return 'It got quiet. A friend squeezed your shoulder. Nobody forgot it.'; } },
      { label: 'Start a sing-song', tags: ['impulsive'], scene: 'music', run: (x) => { x.train('singing', 2); x.mods({ happiness: 4 }); return 'Badly sung, enthusiastically harmonised, ending in laughter.'; } },
    ],
  },
  {
    id: 'le_boardGames', cat: 'leisure', scene: 'gaming', weight: 1, cooldown: 3, years: [-800, 1970], minAge: 6,
    title: (x) => x.year < 1500 ? 'Game night' : 'Cards by the fire',
    text: (x) => x.year < 1000 ? 'Friends gather around a board scratched into a table, rattling knucklebones.' : 'Long winter evening; someone gets out a pack of cards and a chessboard.',
    choices: [
      { label: 'Play to win', tags: ['ambitious'], run: (x) => { x.mods({ smarts: 1, ego: 2 }); x.train('logic', 2); return x.chance(0.5) ? 'You won and did a little dance. Nobody will play with you again until spring.' : 'You lost to a seven-year-old. Repeatedly.'; } },
      { label: 'Play for fun', tags: ['social'], run: (x) => { x.mods({ happiness: 4, loneliness: -4 }); return 'Lots of laughing and a long argument about the rules.'; } },
      { label: 'Teach the young ones', tags: ['help'], run: (x) => { x.mods({ happiness: 3, wisdom: 1 }); return 'They beat you by the end of the evening, which was the point.'; } },
    ],
  },
  {
    id: 'le_parkChess', cat: 'leisure', scene: 'friends', weight: 0.8, cooldown: 5, years: [1800, 2300], minAge: 12,
    title: 'Chess in the park',
    text: 'An old man at the park chess tables taps the empty seat opposite him.',
    choices: [
      { label: 'Sit down', tags: ['social'], run: (x) => { x.train('logic', 3); x.mods({ wisdom: 2, loneliness: -4 }); return 'He beat you in eleven moves, then taught you why. You come back every week.'; } },
      { label: 'Play for stakes', tags: ['impulsive'], scene: 'casino', run: (x) => { const v = cost(x, 20); x.money(-v); return `He took your ${x.fmt(v)} with a smile. You were hustled by a man in slippers.`; } },
      { label: 'Walk on', tags: ['cautious'], run: () => 'He shrugged and went back to his pigeons.' },
    ],
  },
  {
    id: 'le_videoGames', cat: 'leisure', scene: 'gaming', weight: 1.2, cooldown: 3, years: [1975, 2300], minAge: 6,
    title: 'One more level',
    text: 'It is 3am. You have been saying "one more level" since dinner.',
    choices: [
      { label: 'Finish the game', tags: ['impulsive'], run: (x) => { x.mods({ happiness: 5, energy: -6, stress: -2 }); return 'The credits rolled at dawn. You felt like you had lived another life.'; } },
      { label: 'Go to bed', tags: ['cautious'], run: (x) => { x.mods({ discipline: 2, energy: 3 }); return 'You dreamed in pixels.'; } },
      { label: 'Stream it', tags: ['social'], when: (x) => x.year >= 2010, run: (x) => { x.mods({ popularity: 1, happiness: 3 }); return 'Seven viewers, one of them your aunt. She is very supportive.'; } },
    ],
  },
  {
    id: 'le_esports', cat: 'leisure', scene: 'gaming', weight: (x) => x.year >= 2005 ? 0.7 : 0, cooldown: 4, years: [2005, 2300], minAge: 13, maxAge: 35,
    title: 'Local tournament',
    text: 'There is a gaming tournament at the community centre with a real cash prize.',
    choices: [
      { label: 'Enter', tags: ['ambitious'], run: (x) => { x.train('gameDesign', 1); if (x.chance(0.25)) { const v = cost(x, 1000); x.money(v); x.mods({ happiness: 8, confidence: 5 }); return `You won ${x.fmt(v)} and a trophy shaped like a controller.`; } x.mods({ happiness: 2 }); return 'Knocked out in round two by a twelve-year-old who was very polite about it.'; } },
      { label: 'Watch the finals', tags: ['social'], run: (x) => { x.mods({ happiness: 3, loneliness: -3 }); return 'The crowd went wild at a move you did not even understand.'; } },
    ],
  },
  {
    id: 'le_bookClub', cat: 'leisure', scene: 'reading', weight: 1, cooldown: 4, years: [1800, 2300], minAge: 16,
    title: 'Book club',
    text: 'It is book club night. You read about a third of the book, and only the beginning.',
    choices: [
      { label: 'Bluff confidently', tags: ['impulsive'], run: (x) => { x.train('deception', 1); return x.chance(0.5) ? 'You said "the themes really resonated" and nodded. Nobody suspected.' : 'Someone asked about the twist. There was a twist?'; } },
      { label: 'Confess and listen', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 2, loneliness: -3 }); return 'Everyone admitted they had not finished it either. Mostly it is a wine club.'; } },
      { label: 'Host next month', tags: ['social'], run: (x) => { x.mods({ popularity: 2, happiness: 3 }); x.train('literacy', 2); return 'You chose a short book. Visionary leadership.'; } },
    ],
  },
  {
    id: 'le_karaoke', cat: 'leisure', scene: 'karaoke', weight: 1, cooldown: 3, years: [1980, 2300], minAge: 16,
    title: 'Karaoke night',
    text: 'Your friends have put your name down for karaoke. The song choice was not yours.',
    choices: [
      { label: 'Commit completely', tags: ['impulsive', 'social'], run: (x) => { x.train('singing', 2); x.mods({ happiness: 6, popularity: 3, confidence: 2 }); return 'You did the power ballad with your eyes closed and one fist raised. Legend.'; } },
      { label: 'Drag a friend up', tags: ['social'], run: (x) => { const f = x.rels('friend', 'bestFriend'); if (f.length) x.relMod(x.pick(f).npcId, 4); x.mods({ happiness: 4 }); return 'A duet of terrible harmony and great joy.'; } },
      { label: 'Refuse firmly', tags: ['cautious'], run: (x) => { x.mods({ popularity: -1 }); return 'They chanted your name for a while. You held your ground.'; } },
    ],
  },
  {
    id: 'le_silentFilm', cat: 'leisure', scene: 'cinema', weight: 1.1, cooldown: 3, years: [1905, 1929], minAge: 6,
    title: 'Picture house',
    text: 'The new picture house is showing a film with a train that seems to drive right out of the screen.',
    choices: [
      { label: 'Front row', tags: ['impulsive'], run: (x) => { x.mods({ happiness: 6 }); return 'Half the audience ducked. You laughed until the piano player glared at you.'; } },
      { label: 'Go every week', tags: ['social'], run: (x) => { x.money(-cost(x, 10)); x.mods({ happiness: 4 }); x.setFlag('filmFan', true); return 'You know every comedian\'s pratfall by heart.'; } },
    ],
  },
  {
    id: 'le_cinema', cat: 'leisure', scene: 'cinema', weight: 1.1, cooldown: 3, years: [1930, 2300], minAge: 6,
    title: 'Movie night',
    text: 'There is a much-hyped new film out and everyone is talking about it.',
    choices: [
      { label: 'Opening night', tags: ['impulsive'], run: (x) => { x.mods({ happiness: 5 }); return x.chance(0.5) ? 'The audience cheered at the end. You walked out buzzing.' : 'All hype. You defended it loudly anyway.'; } },
      { label: 'Wait for reviews', tags: ['cautious'], run: (x) => { x.mods({ happiness: 2 }); return 'Someone spoiled the ending at work. You saw it anyway.'; } },
      { label: 'Go alone', tags: ['cautious'], scene: 'cinema', run: (x) => { x.mods({ happiness: 3, stress: -3 }); return 'Your own armrests, your own popcorn. Bliss.'; } },
    ],
  },
  {
    id: 'le_driveIn', cat: 'leisure', scene: 'cinema', weight: 1, cooldown: 4, years: [1933, 1985], minAge: 16,
    title: 'Drive-in',
    text: 'The drive-in is showing a monster double bill.',
    choices: [
      { label: 'Pile friends in the car', tags: ['social'], run: (x) => { x.mods({ happiness: 5, loneliness: -5 }); return 'Six people, one car, buckets of popcorn and screaming at the rubber monster.'; } },
      { label: 'Go with family', tags: ['help'], run: (x) => { x.mods({ happiness: 4 }); return 'The kids fell asleep in the back before the second film. Perfect.'; } },
    ],
  },
  {
    id: 'le_concertFront', cat: 'leisure', scene: 'concert', weight: 1, cooldown: 3, years: [1955, 2300], minAge: 13,
    title: 'Front row',
    text: 'Your favourite band is in town. Tickets are expensive and nearly gone.',
    choices: [
      { label: 'Buy the good seats', tags: ['impulsive'], run: (x) => { if (!pay(x, 250)) return 'Sold out at your price. You listened from the car park.'; x.mods({ happiness: 8 }); return x.chance(0.2) ? 'The singer pointed straight at you. You will be talking about it at your funeral.' : 'You lost your voice and a shoe, and it was perfect.'; } },
      { label: 'Cheap seats with friends', tags: ['social'], run: (x) => { pay(x, 60); x.mods({ happiness: 6, loneliness: -4 }); return 'Tiny figures on a distant stage. Didn\'t matter. You sang every word.'; } },
      { label: 'Listen at home', tags: ['cautious'], scene: 'music', run: (x) => { x.mods({ happiness: 1 }); return 'You played the album very loudly and imagined it.'; } },
    ],
  },
  {
    id: 'le_symphony', cat: 'leisure', scene: 'concert', weight: 0.8, cooldown: 4, years: [1700, 2300], minAge: 12,
    title: 'The orchestra',
    text: 'You have tickets to the symphony. Everyone else seems to know when to clap.',
    choices: [
      { label: 'Clap between movements', tags: ['impulsive'], run: (x) => { x.mods({ happiness: 2 }); return 'Two hundred heads turned. The conductor smiled, kindly. You will never do it again.'; } },
      { label: 'Close your eyes and listen', tags: ['cautious'], run: (x) => { x.mods({ happiness: 5, stress: -5, wisdom: 1 }); return 'Somewhere in the slow movement you forgot every worry you had.'; } },
    ],
  },
  {
    id: 'le_theatre', cat: 'leisure', scene: 'theater', weight: 1, cooldown: 4, minAge: 10,
    title: (x) => x.year < 1600 ? 'Players in town' : 'Opening night',
    text: (x) => x.year < 1600 ? 'A troupe of travelling players has set up a stage of carts in the square.' : 'The local theatre is opening a new play and your friend has a small part.',
    choices: [
      { label: 'Cheer loudly', tags: ['social'], run: (x) => { x.mods({ happiness: 4 }); const f = x.rels('friend', 'bestFriend'); if (f.length) x.relMod(x.pick(f).npcId, 3); return 'You started a standing ovation that nobody else joined. Worth it.'; } },
      { label: 'Volunteer backstage', tags: ['help'], run: (x) => { x.train('acting', 2); x.mods({ happiness: 3 }); return 'You pulled a rope at the wrong time and invented a new ending.'; } },
      { label: 'Audition next time', tags: ['ambitious'], run: (x) => { x.train('acting', 3); x.mods({ confidence: 2 }); return 'You got the role of "Tree Number Two". It is a start.'; } },
    ],
  },
  {
    id: 'le_understudy', cat: 'leisure', scene: 'theater', weight: (x) => x.skill('acting') > 10 ? 1.2 : 0.2, cooldown: 6, minAge: 14,
    title: 'You\'re on',
    text: 'The lead in the amateur play has lost their voice. The director looks at you, the understudy, with desperate hope.',
    choices: [
      { label: 'Step into the light', tags: ['ambitious'], scene: 'stage', run: (x) => { x.train('acting', 5); if (x.chance(0.5 + x.skill('acting') / 200)) { x.mods({ confidence: 6, happiness: 8, popularity: 3 }); return 'You knew every line. The local paper called you "a revelation".'; } x.mods({ confidence: -3 }); return 'You forgot the second act and improvised a sword fight. Mixed reviews.'; } },
      { label: 'Hold the script on stage', tags: ['cautious'], run: (x) => { x.train('acting', 2); x.mods({ happiness: 3 }); return 'Not glamorous, but the show went on. Everyone hugged you after.'; } },
    ],
  },
  {
    id: 'le_museum', cat: 'leisure', scene: 'museum', weight: 0.9, cooldown: 4, years: [1750, 2300], minAge: 6,
    title: 'Rainy day museum',
    text: 'Rain all day. The museum is warm, free and full of dinosaurs.',
    choices: [
      { label: 'See everything', tags: ['ambitious'], run: (x) => { x.train('history', 2); x.mods({ smarts: 1, happiness: 3 }); return 'Six hours, sore feet, and a head full of extinct animals.'; } },
      { label: 'Find one thing and stay', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 2, happiness: 3, stress: -3 }); return 'One painting, forty minutes. You saw something new in it every time.'; } },
      { label: 'Touch something you shouldn\'t', tags: ['impulsive'], run: (x) => { x.mods({ happiness: 2 }); return 'An alarm, a guard, a lecture. Worth it to know what a fossil feels like.'; } },
    ],
  },
  {
    id: 'le_amusementPark', cat: 'leisure', scene: 'amusement', weight: 1, cooldown: 3, years: [1890, 2300], minAge: 5,
    title: 'Rollercoaster',
    text: (x) => `The new rollercoaster at the ${x.year < 1950 ? 'pleasure gardens' : 'theme park'} has a loop. You are next in the queue.`,
    choices: [
      { label: 'Front seat, hands up', tags: ['impulsive'], run: (x) => { x.mods({ happiness: 7, riskTolerance: 2 }); return 'You screamed the whole way and immediately queued again.'; } },
      { label: 'Back out at the last second', tags: ['cautious'], run: (x) => { x.mods({ confidence: -1, happiness: 2 }); return 'You held the bags and won a giant bear at the hoopla instead.'; } },
      { label: 'Ride with a nervous friend', tags: ['help', 'social'], run: (x) => { const f = x.rels('friend', 'bestFriend', 'sibling', 'child'); if (f.length) x.relMod(x.pick(f).npcId, 5); x.mods({ happiness: 5 }); return 'They squeezed your hand so hard it went numb. They loved it.'; } },
    ],
  },
  {
    id: 'le_gymRival', cat: 'leisure', scene: 'gym', weight: 0.9, cooldown: 4, years: [1950, 2300], minAge: 16, maxAge: 70,
    title: 'Gym rival',
    text: 'Someone at the gym always uses the machine you want, right when you want it, and always lifts slightly more.',
    choices: [
      { label: 'Out-lift them', tags: ['ambitious'], run: (x) => { x.train('strengthTraining', 4); x.mods({ fitness: 4 }); if (x.chance(0.15)) { x.mods({ health: -4, pain: 6 }); return 'You lifted more. Then your back filed a formal complaint.'; } return 'You beat them by one rep. They nodded. Respect earned.'; } },
      { label: 'Ask them to train together', tags: ['social'], run: (x) => { x.train('strengthTraining', 3); x.mods({ fitness: 3, loneliness: -4 }); return 'They are lovely. You now argue about protein together.'; } },
      { label: 'Change your schedule', tags: ['cautious'], run: (x) => { x.mods({ fitness: 2 }); return 'Mornings. You hate mornings. But the machine is free.'; } },
    ],
  },
  {
    id: 'le_newYearGym', cat: 'leisure', scene: 'gym', weight: 1, cooldown: 5, years: [1960, 2300], minAge: 18,
    title: 'New year, new you',
    text: 'It is January. You are standing in a gym with a twelve-month membership and a lot of hope.',
    choices: [
      { label: 'Go three times a week', tags: ['ambitious'], run: (x) => { if (!pay(x, 400)) return 'The membership was beyond you. You bought a skipping rope.'; if (x.chance(0.4 + x.stat('discipline') / 200)) { x.mods({ fitness: 7, happiness: 4, discipline: 2 }); return 'You actually kept it up. Who are you?'; } x.mods({ fitness: 1 }); return 'You went eleven times. In March you went to cancel and they made it very difficult.'; } },
      { label: 'Take a class', tags: ['social'], scene: 'yoga', run: (x) => { pay(x, 200); x.mods({ fitness: 4, loneliness: -3 }); return 'The instructor shouts encouragement. You shout back. It works.'; } },
      { label: 'Walk instead', tags: ['cautious'], run: (x) => { x.mods({ fitness: 3, stress: -2 }); return 'Free, outdoors, and nobody grunting nearby.'; } },
    ],
  },
  {
    id: 'le_yoga', cat: 'leisure', scene: 'yoga', weight: 0.9, cooldown: 4, years: [1960, 2300], minAge: 14,
    title: 'Downward dog',
    text: 'At your first yoga class, the instructor says to "breathe into your hips". You are not sure how.',
    choices: [
      { label: 'Give it a real go', tags: ['cautious'], run: (x) => { x.train('yoga', 4); x.mods({ stress: -6, fitness: 2 }); return 'You fell over twice and left feeling ten years younger.'; } },
      { label: 'Try the hardest pose', tags: ['impulsive'], run: (x) => { x.train('yoga', 2); if (x.chance(0.5)) return 'You held it! For one second. Everyone saw.'; x.mods({ pain: 3 }); return 'Your hamstring made a noise like a banjo.'; } },
      { label: 'Fall asleep in the final rest', tags: ['cautious'], scene: 'calm', run: (x) => { x.mods({ stress: -5, energy: 4 }); return 'You snored a little. The teacher said that is "very common".'; } },
    ],
  },
  {
    id: 'le_spaDay', cat: 'leisure', scene: 'spa', weight: 0.8, cooldown: 4, years: [1880, 2300], minAge: 16,
    title: 'Spa day',
    text: 'A friend has a spare voucher for a spa day: steam rooms, robes and cucumber water.',
    choices: [
      { label: 'Book the works', tags: ['impulsive'], run: (x) => { pay(x, 150); x.mods({ stress: -10, looks: 1, happiness: 5 }); return 'A massage so good you briefly forgot your own name.'; } },
      { label: 'Just the pool', tags: ['cautious'], run: (x) => { x.mods({ stress: -6 }); return 'You floated and thought about absolutely nothing.'; } },
      { label: 'Gossip in the sauna', tags: ['social'], run: (x) => { x.train('gossip', 2); x.mods({ stress: -4, happiness: 3 }); return 'Two hours in a hot box learning everyone\'s secrets. Very relaxing.'; } },
    ],
  },
  {
    id: 'le_romanBaths', cat: 'leisure', scene: 'spa', weight: 1.2, cooldown: 3, years: [-300, 450], minAge: 12,
    title: 'At the baths',
    text: 'The public baths are steaming and full of gossip, politicians and a man selling sausages.',
    choices: [
      { label: 'Hot pool, cold pool, repeat', tags: ['cautious'], run: (x) => { x.mods({ stress: -6, health: 2 }); return 'You emerged pink, soft and philosophical.'; } },
      { label: 'Talk politics', tags: ['social'], run: (x) => { x.train('oratory', 2); x.mods({ popularity: 2 }); return 'A senator agreed with you and then forgot your name.'; } },
      { label: 'Buy a sausage', tags: ['impulsive'], run: (x) => { x.mods({ happiness: 3 }); return 'Best sausage in the empire. You eat it in the warm pool, a true Roman.'; } },
    ],
  },
];

const HOBBY_EVENTS_2: EventDef[] = [
  {
    id: 'le_beachDay', cat: 'leisure', scene: 'beach', weight: 1, cooldown: 3, years: [1850, 2300], minAge: 4,
    title: 'Beach day',
    text: 'The sun is out, the sea is cold, and the sand is already in everything.',
    choices: [
      { label: 'Swim out to the buoy', tags: ['ambitious'], run: (x) => { x.train('swimming', 3); x.mods({ fitness: 3, happiness: 4 }); return 'Freezing, glorious, and you touched it. Victory.'; } },
      { label: 'Build a sandcastle', tags: ['social'], run: (x) => { x.mods({ happiness: 5, creativity: 2 }); return 'Moat, towers, a seaweed flag. The tide took it at four, as tradition demands.'; } },
      { label: 'Nap in the sun', tags: ['impulsive'], run: (x) => { x.mods({ stress: -5, health: -1 }); return 'You woke up the colour of a lobster, with a perfect sunglasses outline.'; } },
    ],
  },
  {
    id: 'le_skiTrip', cat: 'leisure', scene: 'skiing', weight: 0.8, cooldown: 4, years: [1930, 2300], minAge: 8, maxAge: 75,
    title: 'On the slopes',
    text: 'Fresh snow overnight. The black run is open and calling your name.',
    choices: [
      { label: 'Take the black run', tags: ['impulsive', 'ambitious'], run: (x) => { x.train('skiing', 4); if (x.chance(0.4 + x.skill('skiing') / 150)) { x.mods({ happiness: 8, confidence: 4 }); return 'You flew. Possibly the best two minutes of your life.'; } x.mods({ health: -6, pain: 7 }); x.setFlag('skiInjury', true); return 'A spectacular tumble and a knee brace for six weeks. You will be back.'; } },
      { label: 'Stick to the blues', tags: ['cautious'], run: (x) => { x.train('skiing', 3); x.mods({ happiness: 5 }); return 'Gentle turns, pine trees, a hot chocolate at every lift.'; } },
      { label: 'Après-ski only', tags: ['social'], scene: 'bar', when: (x) => x.age >= 18, run: (x) => { x.mods({ happiness: 5, loneliness: -4 }); return 'You never clipped in once. You did learn three drinking songs in German.'; } },
    ],
  },
  {
    id: 'le_musicFestival', cat: 'leisure', scene: 'concert', weight: 0.9, cooldown: 4, years: [1969, 2300], minAge: 16, maxAge: 55,
    title: 'Festival weekend',
    text: 'Three days, forty bands, one muddy field.',
    choices: [
      { label: 'Go all in', tags: ['impulsive', 'social'], run: (x) => { pay(x, 300); x.mods({ happiness: 8, energy: -8, loneliness: -6 }); return 'You lost your tent, found new friends, and saw a band that changed your life at 2am.'; } },
      { label: 'Day ticket only', tags: ['cautious'], run: (x) => { pay(x, 90); x.mods({ happiness: 5 }); return 'All the best bands, none of the portable toilets at dawn.'; } },
      { label: 'Volunteer for a free ticket', tags: ['help'], scene: 'volunteer', run: (x) => { x.mods({ happiness: 5, karma: 1 }); return 'Litter-picking at dawn, headliners at night. Not bad.'; } },
    ],
  },
  {
    id: 'le_harvestFair', cat: 'leisure', scene: 'festival', weight: 1.1, cooldown: 3, years: [-800, 1900], minAge: 6,
    title: 'Harvest fair',
    text: 'The harvest is in and the whole village has turned out: dancing, cider, and a greasy pole with a ham on top.',
    choices: [
      { label: 'Climb for the ham', tags: ['ambitious', 'impulsive'], run: (x) => { x.train('climbing', 2); if (x.chance(0.3)) { x.mods({ happiness: 8, popularity: 4 }); return 'You reached the top to a roar. That ham fed you for a week.'; } x.mods({ happiness: 3 }); return 'You slid down in front of everyone. Very greasy. Very funny.'; } },
      { label: 'Dance till dawn', tags: ['social'], scene: 'dance', run: (x) => { x.train('dance', 2); x.mods({ happiness: 6, loneliness: -5 }); return 'A fiddler, a bonfire, and every partner in the village.'; } },
      { label: 'Enter the pie contest', tags: ['cautious'], scene: 'cooking', run: (x) => { x.train('baking', 2); x.mods({ happiness: 3 }); return 'Second place. The baker\'s wife has won for thirty years running.'; } },
    ],
  },
  {
    id: 'le_tavernSong', cat: 'leisure', scene: 'bar', weight: 1, cooldown: 3, years: [-800, 1920], minAge: 16,
    title: 'Tavern night',
    text: 'The tavern is packed and loud. A fiddler strikes up, and the whole room starts to sing.',
    choices: [
      { label: 'Stand on a table and lead', tags: ['impulsive', 'social'], run: (x) => { x.train('singing', 2); x.mods({ happiness: 6, popularity: 3 }); return 'You knew most of the words. You invented the rest. Nobody noticed.'; } },
      { label: 'Buy a round', tags: ['social'], run: (x) => { x.money(-cost(x, 40)); x.mods({ popularity: 4, happiness: 3 }); return 'Instant friends, all of them called something like "Big Tom".'; } },
      { label: 'Nurse one drink by the fire', tags: ['cautious'], run: (x) => { x.mods({ stress: -4 }); return 'Warm, quiet, and you heard three excellent stories without telling one.'; } },
    ],
  },
  {
    id: 'le_speakeasy', cat: 'leisure', scene: 'bar', weight: (x) => x.c.countryId === 'us' ? 2 : 0, cooldown: 3, years: [1920, 1933], minAge: 18,
    title: 'Speakeasy',
    text: 'A plain door in an alley, a sliding peephole, and a voice: "Password?"',
    choices: [
      { label: '"Swordfish"', tags: ['impulsive'], run: (x) => { if (x.chance(0.5)) { x.mods({ happiness: 7 }); return 'Jazz, bathtub gin and a dance floor. You stumbled out at sunrise.'; } return 'The door slammed. Wrong password, wrong week.'; } },
      { label: 'Bribe the doorman', tags: ['social'], scene: 'bribe', run: (x) => { x.money(-cost(x, 50)); x.mods({ happiness: 6, streetCred: 2 }); return 'Inside, a trumpet player was making the best music you have ever heard.'; } },
      { label: 'Walk away', tags: ['cautious'], run: (x) => { x.mods({ happiness: -1 }); return 'Two nights later, the place was raided. Good instinct.'; } },
    ],
  },
  {
    id: 'le_nightclub', cat: 'leisure', scene: 'party', weight: 1, cooldown: 3, years: [1970, 2300], minAge: 18, maxAge: 50,
    title: 'Big night out',
    text: 'It is Friday, the club has a queue around the block, and your friends are already inside.',
    choices: [
      { label: 'Dance until close', tags: ['impulsive', 'social'], run: (x) => { x.mods({ happiness: 7, energy: -6, fitness: 1 }); return 'You danced for five hours and ate chips at dawn on the kerb.'; } },
      { label: 'One drink then home', tags: ['cautious'], run: (x) => { x.mods({ happiness: 3, energy: 2 }); return 'Home by midnight, smugly fresh the next morning.'; } },
      { label: 'Skip the queue', tags: ['ambitious'], run: (x) => { if (x.stat('looks') > 60 || x.famous) { x.mods({ ego: 3, happiness: 5 }); return 'The bouncer waved you through. You did not look back.'; } x.mods({ confidence: -2 }); return 'Sent to the back of the line. In front of everyone.'; } },
    ],
  },
  {
    id: 'le_pubQuiz', cat: 'leisure', scene: 'bar', weight: 1, cooldown: 3, years: [1975, 2300], minAge: 18,
    title: 'Pub quiz',
    text: 'Your quiz team is tied for first with one question left: a sports question. None of you know sports.',
    choices: [
      { label: 'Trust your gut', tags: ['impulsive'], run: (x) => { if (x.chance(0.4)) { x.mods({ happiness: 7 }); return 'Correct! You won a voucher and the eternal hatred of "Quizteama Aguilera".'; } return 'Wrong. Second place. A tin of biscuits.'; } },
      { label: 'Phone a friend', tags: ['cautious'], when: (x) => x.year >= 2005, run: (x) => { x.mods({ karma: -2 }); return x.chance(0.5) ? 'You won and were disqualified in the same minute.' : 'Nobody saw. You won. The guilt tastes like biscuits.'; } },
      { label: 'Write a funny answer', tags: ['social'], run: (x) => { x.mods({ happiness: 4, popularity: 2 }); return 'The quizmaster read it aloud. Zero points, huge laugh.'; } },
    ],
  },
  {
    id: 'le_pokerNight', cat: 'leisure', scene: 'casino', weight: 0.9, cooldown: 3, years: [1830, 2300], minAge: 18,
    title: 'Friendly poker',
    text: 'Friday poker with friends. Small stakes, big egos.',
    choices: [
      { label: 'Bluff big', tags: ['impulsive'], run: (x) => { const v = cost(x, 60); if (x.chance(0.3 + x.skill('deception') / 200)) { x.money(v * 2); x.mods({ ego: 2 }); return `They folded. You never show your cards. ${x.fmt(v * 2)} richer.`; } x.money(-v); return 'They called. You had nothing. They will never let you forget it.'; } },
      { label: 'Play it safe', tags: ['cautious'], run: (x) => { x.money(cost(x, x.int(-20, 30))); x.mods({ happiness: 3 }); return 'Roughly even, and lots of terrible jokes.'; } },
      { label: 'Host next week', tags: ['social'], run: (x) => { x.mods({ popularity: 2, loneliness: -4 }); return 'You bought proper chips and a green tablecloth. It is serious now.'; } },
    ],
  },
  {
    id: 'le_horseRaces', cat: 'leisure', scene: 'casino', weight: 0.9, cooldown: 3, years: [1700, 2300], minAge: 18,
    title: 'A day at the races',
    text: 'A horse called "Your Lucky Day" is running at 33 to 1.',
    choices: [
      { label: 'Bet on the name', tags: ['impulsive'], run: (x) => { const b = cost(x, 50); x.money(-b); if (x.chance(0.07)) { x.money(b * 33); x.mods({ happiness: 12 }); return `It won by a nose! ${x.fmt(b * 33)}. You screamed until you lost your voice.`; } return 'It finished last. It may still be running.'; } },
      { label: 'Bet on the favourite', tags: ['cautious'], run: (x) => { const b = cost(x, 50); if (x.chance(0.4)) { x.money(Math.round(b * 0.5)); return 'The favourite won. You made enough for a sandwich.'; } x.money(-b); return 'The favourite stumbled. Nothing is safe.'; } },
      { label: 'Just watch', tags: ['social'], scene: 'petHorse', run: (x) => { x.mods({ happiness: 3 }); return 'Thundering hooves, bright silks and a hat competition you nearly won.'; } },
    ],
  },
  {
    id: 'le_diceGame', cat: 'leisure', scene: 'casino', weight: 1, cooldown: 3, years: [-800, 1700], minAge: 16,
    title: 'Dice in the yard',
    text: 'Soldiers are rolling dice behind the stables and invite you to join.',
    choices: [
      { label: 'Roll', tags: ['impulsive'], run: (x) => { const v = cost(x, 20); if (x.chance(0.45)) { x.money(v); x.mods({ happiness: 3 }); return 'Three sixes. The soldiers checked your dice twice.'; } x.money(-v); return 'You lost your coins and nearly your boots.'; } },
      { label: 'Watch for cheats', tags: ['cautious'], run: (x) => { x.train('streetwise', 2); return 'One die always rolled four. You said nothing and kept your purse.'; } },
    ],
  },
  {
    id: 'le_lottery', cat: 'leisure', scene: 'moneyUp', weight: 0.6, cooldown: 4, years: [1960, 2300], minAge: 18,
    title: 'Lottery ticket',
    text: 'You bought a scratchcard on impulse. Three boxes uncovered, two matching.',
    choices: [
      { label: 'Scratch the last box', tags: ['impulsive'], run: (x) => { if (x.chance(0.08)) { const v = cost(x, x.int(500, 5000)); x.money(v); x.mods({ happiness: 8 }); return `A match! ${x.fmt(v)}. You bought a round and told nobody else.`; } return 'Nothing. It is always nothing, which is the point, somehow.'; } },
      { label: 'Frame the near miss', tags: ['cautious'], run: (x) => { x.mods({ happiness: 1, wisdom: 1 }); return 'A reminder that the house always wins. And a souvenir of hope.'; } },
    ],
  },
  {
    id: 'le_gladiators', cat: 'leisure', scene: 'sports', weight: 1.2, cooldown: 3, years: [-260, 430], minAge: 8,
    title: 'At the games',
    text: 'The arena is roaring. Today the crowd will decide a fallen fighter\'s fate with their thumbs.',
    choices: [
      { label: 'Call for mercy', tags: ['help'], run: (x) => { x.mods({ karma: 2, empathy: 2 }); return 'Enough of the crowd agreed. The fighter limped out alive and saluted the stands.'; } },
      { label: 'Cheer with the crowd', tags: ['social'], run: (x) => { x.mods({ happiness: 3, popularity: 1 }); return 'You lost yourself in the noise. Later it felt strange.'; } },
      { label: 'Leave early', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 2 }); return 'You bought bread on the way home and felt cleaner for it.'; } },
    ],
  },
  {
    id: 'le_tournament', cat: 'leisure', scene: 'joust', weight: 1.2, cooldown: 3, years: [1100, 1550], minAge: 8,
    title: 'The tournament',
    text: 'Knights from three counties are jousting in the meadow, banners flapping, crowds roaring.',
    choices: [
      { label: 'Cheer for the underdog', tags: ['social'], run: (x) => { x.mods({ happiness: 5 }); return x.chance(0.4) ? 'The poor knight in patched armour won. The crowd lost its mind.' : 'He was knocked into the mud in the first pass. Noble effort.'; } },
      { label: 'Bet on the champion', tags: ['impulsive'], scene: 'casino', run: (x) => { const v = cost(x, 30); if (x.chance(0.6)) { x.money(v); return `The champion won as expected. ${x.fmt(v)} for your trouble.`; } x.money(-v); return 'A lance shattered and so did your wager.'; } },
      { label: 'Sneak into the pavilions', tags: ['ambitious'], run: (x) => { x.mods({ popularity: 2 }); return 'You helped a squire with a buckle and got to hold a real lance.'; } },
    ],
  },
  {
    id: 'le_hobbyPays', cat: 'leisure', scene: 'startup', weight: (x) => x.year >= 2000 ? 0.8 : 0.3, cooldown: 6, minAge: 16,
    title: 'Hobby to business',
    text: (x) => x.year >= 2000 ? 'People online keep asking to buy the things you make in your spare time.' : 'A shopkeeper asks if you would sell the things you make in your spare time.',
    choices: [
      { label: 'Start selling', tags: ['ambitious'], run: (x) => { x.train('entrepreneurship', 3); const v = cost(x, x.int(500, 4000)); x.money(v); x.mods({ happiness: 5, stress: 3 }); return `${x.fmt(v)} in the first year. Your hobby now has spreadsheets.`; } },
      { label: 'Give them away', tags: ['help'], run: (x) => { x.mods({ karma: 2, happiness: 4 }); return 'Your work is in a dozen homes. Nobody pays, everybody smiles.'; } },
      { label: 'Keep it a hobby', tags: ['cautious'], run: (x) => { x.mods({ stress: -3, happiness: 2 }); return 'The moment it pays, it becomes work. You protect the joy.'; } },
    ],
  },
  {
    id: 'le_knitting', cat: 'leisure', scene: 'reading', weight: 0.8, cooldown: 4, minAge: 10,
    title: 'The jumper',
    text: 'You have been knitting a jumper for a loved one for two years. It has one arm.',
    choices: [
      { label: 'Finish it this winter', tags: ['ambitious'], run: (x) => { x.train('tailoring', 3); x.mods({ discipline: 2, happiness: 4 }); return 'Two arms, slightly different lengths. They wear it every Christmas.'; } },
      { label: 'Join a knitting circle', tags: ['social'], run: (x) => { x.train('tailoring', 2); x.train('gossip', 2); x.mods({ loneliness: -6 }); return 'Needles clicking, tea flowing, every secret in town shared.'; } },
      { label: 'Call it a scarf', tags: ['impulsive'], run: (x) => { x.mods({ happiness: 2, creativity: 1 }); return 'It is now the world\'s most unusual scarf. They love it.'; } },
    ],
  },
  {
    id: 'le_birdwatching', cat: 'leisure', scene: 'hiking', weight: 0.7, cooldown: 4, years: [1850, 2300], minAge: 10,
    title: 'A rare bird',
    text: 'Word goes round the birdwatching club: a rare migrant has been seen at the marshes.',
    choices: [
      { label: 'Go at dawn', tags: ['ambitious'], run: (x) => { x.train('biology', 2); if (x.chance(0.5)) { x.mods({ happiness: 7 }); return 'There it was, for eleven seconds. You shook so much you missed the photo.'; } return 'Six hours in a hide. Many ducks. No rare bird.'; } },
      { label: 'Wait for photos', tags: ['cautious'], run: (x) => { x.mods({ happiness: 1 }); return 'It was lovely in the photos. You feel a bit left out.'; } },
    ],
  },
  {
    id: 'le_danceClass', cat: 'leisure', scene: 'dance', weight: 0.9, cooldown: 4, years: [1700, 2300], minAge: 18,
    title: 'Dance lessons',
    text: (x) => `A ${x.year < 1900 ? 'dancing master' : 'salsa class'} is starting at the community hall. Partners are rotated every song.`,
    choices: [
      { label: 'Sign up', tags: ['social'], run: (x) => { x.train('dance', 4); x.mods({ fitness: 2, happiness: 5, loneliness: -5 }); return 'You stepped on eleven feet and laughed with every owner.'; } },
      { label: 'Practise at home first', tags: ['cautious'], run: (x) => { x.train('dance', 2); return 'You and the coat stand are now very good together.'; } },
    ],
  },
  {
    id: 'le_cyclingClub', cat: 'leisure', scene: 'roadTrip', weight: 0.8, cooldown: 4, years: [1890, 2300], minAge: 12, maxAge: 75,
    title: 'Sunday ride',
    text: 'The cycling club is heading out for a sixty-mile ride, with a café stop halfway.',
    choices: [
      { label: 'Keep up with the fast group', tags: ['ambitious'], run: (x) => { x.train('cycling', 4); x.mods({ fitness: 4 }); return x.stat('fitness') > 50 ? 'You stayed on the wheel all the way. Legs of iron.' : 'Dropped on the first hill. You caught them at the café, eventually.'; } },
      { label: 'Ride for the cake', tags: ['social'], run: (x) => { x.train('cycling', 2); x.mods({ happiness: 5, loneliness: -4 }); return 'Slow pace, great chat, an enormous scone.'; } },
    ],
  },
  {
    id: 'le_openWater', cat: 'leisure', scene: 'beach', weight: 0.7, cooldown: 5, minAge: 12, maxAge: 75,
    title: 'Cold water club',
    text: 'A group swims in the river every morning, all year round. They say it changes your life.',
    choices: [
      { label: 'Jump in', tags: ['impulsive'], run: (x) => { x.train('swimming', 3); x.mods({ stress: -6, immunity: 3, happiness: 4 }); return 'The cold knocked the breath out of you, then the joy came rushing in.'; } },
      { label: 'Wade in slowly', tags: ['cautious'], run: (x) => { x.train('swimming', 1); x.mods({ stress: -3 }); return 'Ankles, knees, waist, a lot of loud breathing. Next week, shoulders.'; } },
      { label: 'Hold the towels', run: (x) => { x.mods({ happiness: 1 }); return 'You hand out flasks of tea and feel brave by proxy.'; } },
    ],
  },
  {
    id: 'le_tennisClub', cat: 'leisure', scene: 'sports', weight: 0.8, cooldown: 4, years: [1875, 2300], minAge: 10, maxAge: 80,
    title: 'Club doubles',
    text: 'The tennis club needs a doubles partner for the summer tournament.',
    choices: [
      { label: 'Play to win', tags: ['ambitious'], run: (x) => { x.train('tennis', 4); if (x.chance(0.3)) { x.mods({ happiness: 7 }); return 'You won the club trophy. Your name is on the board in gold.'; } return 'Semi-final, lost on a disputed line call. You are still disputing it.'; } },
      { label: 'Just enjoy it', tags: ['social'], run: (x) => { x.train('tennis', 2); x.mods({ happiness: 4, loneliness: -3 }); return 'Strawberries, sunshine and plenty of double faults.'; } },
    ],
  },
  {
    id: 'le_golf', cat: 'leisure', scene: 'sports', weight: 0.7, cooldown: 4, years: [1850, 2300], minAge: 16,
    title: 'A round of golf',
    text: 'Your colleagues have invited you to a round of golf. You have never held a club.',
    choices: [
      { label: 'Fake confidence', tags: ['impulsive'], run: (x) => { x.mods({ ego: -2, happiness: 3 }); return x.chance(0.1) ? 'A hole in one. Pure luck. You will never admit it.' : 'You lost nine balls and found a new respect for gophers.'; } },
      { label: 'Take lessons first', tags: ['cautious'], run: (x) => { pay(x, 200); x.train('ballSports', 2); return 'By the day you were merely bad, not dangerous.'; } },
      { label: 'Talk business on the course', tags: ['ambitious'], run: (x) => { x.train('networking', 3); x.mods({ professionalRep: 2 }); return 'Terrible golf, excellent connections.'; } },
    ],
  },
  {
    id: 'le_bowling', cat: 'leisure', scene: 'friends', weight: 0.8, cooldown: 4, years: [1900, 2300], minAge: 6,
    title: 'Bowling night',
    text: 'Bowling alley, borrowed shoes, and a friend who takes it far too seriously.',
    choices: [
      { label: 'Go for a strike', tags: ['ambitious'], run: (x) => { x.mods({ happiness: 4 }); return x.chance(0.3) ? 'Strike! You did a little dance. The serious friend glared.' : 'Gutter, gutter, then one lonely pin.'; } },
      { label: 'Granny-style throws', tags: ['impulsive', 'social'], run: (x) => { x.mods({ happiness: 5, loneliness: -3 }); return 'You won using the worst technique ever seen. Total chaos.'; } },
    ],
  },
  {
    id: 'le_climbingWall', cat: 'leisure', scene: 'hiking', weight: 0.7, cooldown: 4, years: [1975, 2300], minAge: 8, maxAge: 65,
    title: 'Climbing wall',
    text: 'The climbing gym has a new overhanging route that nobody your size has finished.',
    choices: [
      { label: 'Try it', tags: ['ambitious'], run: (x) => { x.train('climbing', 4); x.mods({ fitness: 3 }); if (x.chance(0.3)) { x.mods({ happiness: 6, confidence: 4 }); return 'You topped it and the room clapped. Your forearms may never recover.'; } return 'Fell off at the last hold four times. You will be back.'; } },
      { label: 'Practise the easy routes', tags: ['cautious'], run: (x) => { x.train('climbing', 2); x.mods({ fitness: 2, happiness: 2 }); return 'Steady progress, chalk everywhere, and good company.'; } },
    ],
  },
  {
    id: 'le_escapeRoom', cat: 'leisure', scene: 'friends', weight: 0.8, cooldown: 4, years: [2010, 2300], minAge: 12,
    title: 'Escape room',
    text: 'Sixty minutes, one locked room, and five friends who all think they are in charge.',
    choices: [
      { label: 'Take command', tags: ['ambitious'], run: (x) => { x.train('leadership', 2); return x.chance(0.5) ? 'Escaped with four seconds left. You will be insufferable for a month.' : 'You confidently solved the wrong puzzle for forty minutes.'; } },
      { label: 'Quietly solve it', tags: ['cautious'], run: (x) => { x.train('logic', 2); x.mods({ happiness: 4 }); return 'While everyone argued, you opened the final lock. Nobody noticed you did it.'; } },
    ],
  },
  {
    id: 'le_poetryReading', cat: 'leisure', scene: 'stage', weight: 0.6, cooldown: 5, minAge: 14,
    title: 'Poetry night',
    text: 'You have written a poem. It is personal. The reading starts in ten minutes.',
    choices: [
      { label: 'Read it', tags: ['impulsive'], run: (x) => { x.train('poetry', 3); x.mods({ confidence: 4, happiness: 4 }); return x.chance(0.5) ? 'Silence, then the snapping of fingers. Someone was crying, in a good way.' : 'Your voice shook all the way through. You did it anyway.'; } },
      { label: 'Keep it in your pocket', tags: ['cautious'], run: (x) => { x.train('poetry', 1); return 'You will read it someday. It is getting better in there.'; } },
    ],
  },
  {
    id: 'le_volunteerGarden', cat: 'leisure', scene: 'volunteer', weight: 0.8, cooldown: 4, minAge: 12,
    title: 'Community garden',
    text: 'The empty lot on the corner is becoming a community garden, and they need hands.',
    choices: [
      { label: 'Dig in every weekend', tags: ['help'], run: (x) => { x.train('farming', 2); x.mods({ karma: 3, happiness: 5, loneliness: -5 }); return 'By summer there were tomatoes, a bench, and neighbours who knew your name.'; } },
      { label: 'Donate seeds', tags: ['cautious'], run: (x) => { x.mods({ karma: 1, happiness: 2 }); return 'Your sunflowers are the tallest thing on the street.'; } },
    ],
  },
  {
    id: 'le_zooTrip', cat: 'leisure', scene: 'zoo', weight: 0.8, cooldown: 4, years: [1830, 2300], minAge: 4,
    title: 'Day at the zoo',
    text: 'The zoo has a new baby elephant and the whole city wants to see it.',
    choices: [
      { label: 'Queue for the elephant', tags: ['cautious'], run: (x) => { x.mods({ happiness: 5 }); return 'It sneezed hay all over a man in a suit. Best day ever.'; } },
      { label: 'Find the quiet animals', tags: ['impulsive'], run: (x) => { x.mods({ happiness: 4, wisdom: 1 }); return 'You spent an hour with a sleepy sloth. Deep kinship.'; } },
      { label: 'Adopt an animal', tags: ['help'], when: (x) => x.year >= 1970, run: (x) => { x.money(-cost(x, 60)); x.mods({ karma: 2, happiness: 3 }); return 'You now sponsor a penguin and receive its newsletter.'; } },
    ],
  },
  {
    id: 'le_picnic', cat: 'leisure', scene: 'picnic', weight: 0.9, cooldown: 3, minAge: 4,
    title: 'Picnic',
    text: 'The first warm day of the year. A blanket, a basket, and the whole afternoon free.',
    choices: [
      { label: 'Invite everyone', tags: ['social'], run: (x) => { x.mods({ happiness: 5, loneliness: -5 }); for (const r of x.rels('friend', 'bestFriend', 'sibling').slice(0, 3)) x.relMod(r.npcId, 2); return 'Too much food, a lost frisbee and a wasp that nobody will forget.'; } },
      { label: 'Read under a tree', tags: ['cautious'], scene: 'reading', run: (x) => { x.mods({ stress: -5, happiness: 3 }); return 'You finished a whole book and an entire pork pie.'; } },
    ],
  },
  {
    id: 'le_jigsaw', cat: 'leisure', scene: 'reading', weight: 0.8, cooldown: 4, years: [1900, 2300], minAge: 8,
    title: 'One piece missing',
    text: 'After three weeks, your 2,000-piece jigsaw is finished except for one piece of sky.',
    choices: [
      { label: 'Search the whole house', tags: ['ambitious'], run: (x) => { x.mods({ stress: 3 }); return x.chance(0.6) ? 'It was in the dog\'s bed. Of course it was.' : 'Never found. The hole in the sky haunts you.'; } },
      { label: 'Accept imperfection', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 2, happiness: 2 }); return 'Life has a gap in the clouds. So does your jigsaw. Fine.'; } },
    ],
  },
  {
    id: 'le_kiteFestival', cat: 'leisure', scene: 'festival', weight: 0.7, cooldown: 4, minAge: 5,
    title: 'Kite festival',
    text: 'The sky above the hill is full of kites: dragons, fish and one enormous octopus.',
    choices: [
      { label: 'Build your own kite', tags: ['ambitious'], run: (x) => { x.train('design', 2); x.mods({ creativity: 2, happiness: 4 }); return x.chance(0.5) ? 'It flew! Higher than the octopus!' : 'It flew for nine seconds, then nosedived into a hedge.'; } },
      { label: 'Kite battle', tags: ['impulsive', 'social'], run: (x) => { x.mods({ happiness: 5 }); return 'Lines crossed, strings cut, a small child became your sworn enemy.'; } },
    ],
  },
  {
    id: 'le_sportsInjury', cat: 'leisure', scene: 'checkup', weight: (x) => x.skill('running') + x.skill('ballSports') + x.skill('tennis') > 20 ? 1 : 0.2, cooldown: 5, minAge: 16, maxAge: 75,
    title: 'Pulled something',
    text: 'You stretched for the ball and felt something in your leg go "twang".',
    choices: [
      { label: 'Rest it properly', tags: ['cautious'], run: (x) => { x.mods({ pain: 3, fitness: -2 }); return 'Six weeks off. You healed well and lectured everyone about stretching.'; } },
      { label: 'Play through it', tags: ['impulsive'], run: (x) => { x.mods({ pain: 8, health: -4 }); return 'Brave. Stupid. Three months off instead of one.'; } },
      { label: 'See a physio', tags: ['help'], run: (x) => { pay(x, 200); x.mods({ pain: 2 }); return 'Exercises with a rubber band. Humbling, but you are back faster than ever.'; } },
    ],
  },
  {
    id: 'le_fantasyLeague', cat: 'leisure', scene: 'gaming', weight: 0.7, cooldown: 4, years: [2000, 2300], minAge: 16,
    title: 'Fantasy league',
    text: 'You are top of the office fantasy sports league with one week to go.',
    choices: [
      { label: 'Agonise over the lineup', tags: ['ambitious'], run: (x) => { x.mods({ stress: 3 }); if (x.chance(0.5)) { x.mods({ happiness: 6 }); return 'Champion! A plastic trophy now dominates your desk.'; } return 'Your star player sprained an ankle in the warm-up. Second place.'; } },
      { label: 'Trash-talk your rival', tags: ['social'], run: (x) => { x.mods({ happiness: 3, popularity: 1 }); return 'Your memes were legendary. Your result was not.'; } },
    ],
  },
];

/* ------------------------------------------------------------------ travel */

const TRAVEL_EVENTS: EventDef[] = [
  {
    id: 'le_pilgrimage', cat: 'travel', scene: 'holy', weight: 1, cooldown: 8, years: [-800, 1600], minAge: 16, maxAge: 65,
    title: 'Pilgrimage',
    text: 'Pilgrims are setting out for a distant shrine. Walking it is said to wash away a lifetime of sins.',
    choices: [
      { label: 'Walk the whole way', tags: ['ambitious'], scene: 'hiking', run: (x) => { x.mods({ faith: 6, sin: -8, fitness: 4, wisdom: 3, health: -3 }); x.remember('pilgrimage', 'Walked a pilgrimage', 25); return 'Blisters, rain, strangers who became brothers and sisters. You arrived changed.'; } },
      { label: 'Ride in comfort', tags: ['cautious'], run: (x) => { x.money(-cost(x, 600)); x.mods({ faith: 3, sin: -3 }); return 'The shrine was glorious. The walkers looked at your horse with some judgement.'; } },
      { label: 'Buy a holy relic instead', tags: ['impulsive'], run: (x) => { x.money(-cost(x, 100)); x.mods({ faith: 1 }); return 'A splinter of the True Cross. The seller had a sack of them.'; } },
    ],
  },
  {
    id: 'le_grandTour', cat: 'travel', scene: 'travel', weight: (x) => x.c.money > cost(x, 20000) ? 1.5 : 0.1, cooldown: 15, years: [1660, 1840], minAge: 17, maxAge: 30,
    title: 'The Grand Tour',
    text: 'Young people of means are expected to see Paris, the Alps and the ruins of Rome before settling down.',
    choices: [
      { label: 'See everything', tags: ['ambitious'], run: (x) => { x.money(-cost(x, 15000)); x.train('languages', 5); x.train('art', 3); x.mods({ wisdom: 4, smarts: 2, happiness: 6 }); x.remember('grandTour', 'Took the Grand Tour', 30); return 'Two years of paintings, ruins and questionable wine. You came home insufferably cultured.'; } },
      { label: 'Stay in Venice', tags: ['impulsive'], run: (x) => { x.money(-cost(x, 8000)); x.mods({ happiness: 8, creativity: 3 }); return 'You never made it to Rome. Venice was simply too beautiful to leave.'; } },
      { label: 'Stay home and save', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 1 }); return 'Your friends came back with sketchbooks and stories. You kept your fortune.'; } },
    ],
  },
  {
    id: 'le_oceanVoyage', cat: 'travel', scene: 'travel', weight: 0.8, cooldown: 8, years: [1840, 1960], minAge: 12,
    title: 'Crossing the ocean',
    text: 'You have a ticket on a great steamship. Seven days at sea, with a band on the deck.',
    choices: [
      { label: 'Dance every night', tags: ['social'], scene: 'dance', run: (x) => { x.mods({ happiness: 7, loneliness: -6 }); return 'You danced with half the passengers and learned to sleep through foghorns.'; } },
      { label: 'Watch the sea', tags: ['cautious'], run: (x) => { x.mods({ stress: -6, wisdom: 2 }); return 'Whales on the third day. You did not tell anyone in case it was a dream.'; } },
      { label: 'Sneak into first class', tags: ['impulsive'], run: (x) => { if (x.chance(0.5)) { x.mods({ happiness: 6 }); return 'Caviar, chandeliers, and nobody asked for your ticket.'; } x.mods({ confidence: -2 }); return 'Escorted back below by a steward with no sense of humour.'; } },
    ],
  },
  {
    id: 'le_seasick', cat: 'travel', scene: 'storm', weight: 0.7, cooldown: 6, minAge: 8,
    title: 'Rough seas',
    text: 'The ship is pitching in a storm and your stomach has decided to leave without you.',
    choices: [
      { label: 'Stay on deck', tags: ['cautious'], run: (x) => { x.mods({ health: -2, resilience: 2 }); return 'Fresh air, the horizon, and a sailor\'s ginger. You survived.'; } },
      { label: 'Hide in your bunk', run: (x) => { x.mods({ health: -3, happiness: -3 }); return 'Two days of misery. Land never looked so beautiful.'; } },
    ],
  },
  {
    id: 'le_trainJourney', cat: 'travel', scene: 'travel', weight: 0.8, cooldown: 5, years: [1840, 2300], minAge: 10,
    title: 'The long train',
    text: 'A sleeper train across the country: two days, one tiny cabin, and an ever-changing view.',
    choices: [
      { label: 'Spend it in the dining car', tags: ['social'], run: (x) => { x.mods({ happiness: 5, loneliness: -5 }); return 'You played cards with a retired spy and a nun. Both cheated.'; } },
      { label: 'Read and watch', tags: ['cautious'], scene: 'reading', run: (x) => { x.mods({ stress: -6, wisdom: 2 }); return 'Mountains, then plains, then sea. You finished two books.'; } },
    ],
  },
  {
    id: 'le_stranger', cat: 'travel', scene: 'friends', weight: 0.6, cooldown: 12, minAge: 16,
    title: 'A stranger\'s advice',
    text: (x) => `An old traveller on the ${x.year < 1840 ? 'coach' : x.year < 1950 ? 'train' : 'plane'} asks where you are going, and then, what you are running from.`,
    choices: [
      { label: 'Tell the truth', tags: ['social'], run: (x) => { x.mods({ wisdom: 4, stress: -4 }); x.remember('stranger', 'A stranger\'s advice on a journey', 25); x.chain('le_strangerChain', 3, {}); return 'They listened all the way, then said one sentence you will remember for the rest of your life.'; } },
      { label: 'Laugh it off', tags: ['cautious'], run: (x) => { x.mods({ happiness: 1 }); return 'They smiled as if they already knew. You thought about it for days.'; } },
      { label: 'Ask about their life', tags: ['help'], run: (x) => { x.mods({ empathy: 3, wisdom: 2 }); return 'Eight decades of stories, ending with "do not wait". You promised you would not.'; } },
    ],
  },
  {
    id: 'le_strangerLetter', cat: 'travel', scene: 'loveLetter', triggered: true,
    title: 'A letter from far away',
    text: 'A letter arrives from the traveller you met years ago. They remembered you.',
    choices: [
      { label: 'Write back', tags: ['social'], run: (x) => { x.mods({ happiness: 5, loneliness: -5 }); return 'You became pen pals. Their handwriting got shakier, their advice sharper.'; } },
      { label: 'Visit them', tags: ['impulsive'], scene: 'travel', run: (x) => { x.money(-cost(x, 500)); x.mods({ happiness: 7, wisdom: 3 }); return 'You arrived unannounced. They wept, then put the kettle on.'; } },
    ],
  },
  {
    id: 'le_roadTrip', cat: 'travel', scene: 'roadTrip', weight: 1, cooldown: 4, years: [1920, 2300], minAge: 17,
    title: 'Road trip',
    text: 'A free week, a full tank and a map with no plan.',
    choices: [
      { label: 'Drive west', tags: ['impulsive'], run: (x) => { x.money(-cost(x, 400)); x.mods({ happiness: 7, stress: -5 }); return 'Diners, motels, a two-headed calf museum. Best week in years.'; } },
      { label: 'Bring friends', tags: ['social'], run: (x) => { x.money(-cost(x, 200)); x.mods({ happiness: 6, loneliness: -6 }); for (const r of x.rels('friend', 'bestFriend').slice(0, 2)) x.relMod(r.npcId, 4); return 'One argument about the radio, a hundred songs sung at full volume.'; } },
      { label: 'Visit family on the way', tags: ['help'], run: (x) => { for (const r of x.rels('parent', 'sibling', 'grandparent').slice(0, 3)) x.relMod(r.npcId, 3); x.mods({ happiness: 4 }); return 'You stayed in old bedrooms and ate food made with love and too much butter.'; } },
    ],
  },
  {
    id: 'le_backpacking', cat: 'travel', scene: 'hiking', weight: 1, cooldown: 8, years: [1965, 2300], minAge: 18, maxAge: 35,
    title: 'Backpacking',
    text: 'Your friends are going backpacking for three months with one bag each and almost no money.',
    choices: [
      { label: 'Go', tags: ['impulsive', 'social'], scene: 'travel', run: (x) => { x.money(-cost(x, 3000)); x.train('languages', 3); x.mods({ happiness: 8, wisdom: 3, confidence: 3 }); x.remember('backpacking', 'Backpacked around the world', 25); return 'Night buses, beach huts, a bracelet you still wear. You came back a bit braver.'; } },
      { label: 'Go alone instead', tags: ['ambitious'], scene: 'travel', run: (x) => { x.money(-cost(x, 2500)); x.mods({ resilience: 4, confidence: 5, loneliness: 3 }); return 'Lonely at first, then the best company you ever kept: yourself.'; } },
      { label: 'Stay and work', tags: ['cautious'], run: (x) => { x.money(cost(x, 2000)); return 'Their photos were incredible. Your savings account is also incredible.'; } },
    ],
  },
  {
    id: 'le_hostel', cat: 'travel', scene: 'friends', weight: 0.8, cooldown: 5, years: [1950, 2300], minAge: 18, maxAge: 40,
    title: 'Hostel dorm',
    text: 'Twelve beds, one bathroom, a snorer in every corner and a guitar somewhere.',
    choices: [
      { label: 'Join the common room', tags: ['social'], run: (x) => { x.mods({ happiness: 5, loneliness: -6 }); x.train('languages', 2); return 'Friends from six countries by midnight, all promising to visit.'; } },
      { label: 'Upgrade to a private room', tags: ['cautious'], run: (x) => { x.money(-cost(x, 80)); x.mods({ energy: 5 }); return 'Silence. Your own sink. Pure luxury.'; } },
    ],
  },
  {
    id: 'le_lostLuggage', cat: 'travel', scene: 'travel', weight: 0.8, cooldown: 5, years: [1930, 2300], minAge: 16,
    title: 'Lost luggage',
    text: 'The carousel stops. Your suitcase is not on it.',
    choices: [
      { label: 'File a claim calmly', tags: ['cautious'], run: (x) => { x.mods({ stress: 3 }); return 'It arrived three days later, having apparently had a better holiday than you.'; } },
      { label: 'Buy a new wardrobe', tags: ['impulsive'], scene: 'shopping', run: (x) => { x.money(-cost(x, 300)); x.mods({ happiness: 3 }); return 'Local clothes, local style. You came home looking like a different person.'; } },
      { label: 'Make a scene', tags: ['violent'], scene: 'argument', run: (x) => { x.mods({ stress: 5 }); return 'The desk agent remained serene. Your bag remained lost.'; } },
    ],
  },
  {
    id: 'le_missedFlight', cat: 'travel', scene: 'travel', weight: 0.8, cooldown: 5, years: [1955, 2300], minAge: 16,
    title: 'Final call',
    text: 'You are running through the airport as they announce the final call for your flight.',
    choices: [
      { label: 'Sprint', tags: ['impulsive'], run: (x) => { x.mods({ fitness: 1 }); if (x.chance(0.5)) return 'You made it with the door closing behind you, sweating and triumphant.'; x.money(-cost(x, 300)); x.mods({ stress: 5 }); return 'The gate closed as you arrived. The next flight is tomorrow.'; } },
      { label: 'Accept fate', tags: ['cautious'], run: (x) => { x.money(-cost(x, 200)); x.mods({ stress: 1, wisdom: 1 }); return 'A night in an airport hotel, a terrible sandwich and an unexpectedly good book.'; } },
    ],
  },
  {
    id: 'le_jetlag', cat: 'travel', scene: 'sick', weight: 0.6, cooldown: 5, years: [1960, 2300], minAge: 16,
    title: 'Jet lag',
    text: 'It is 4am, you are wide awake and starving, in a city where everything is closed.',
    choices: [
      { label: 'Explore the empty streets', tags: ['impulsive'], run: (x) => { x.mods({ happiness: 3 }); return 'Bakers loading ovens, street sweepers singing. You saw the city nobody else sees.'; } },
      { label: 'Force yourself to sleep', tags: ['cautious'], run: (x) => { x.mods({ energy: -3 }); return 'You stared at the ceiling until 7am, then slept through lunch.'; } },
    ],
  },
  {
    id: 'le_foodPoisoning', cat: 'travel', scene: 'sick', weight: 0.7, cooldown: 5, minAge: 12,
    title: 'Something you ate',
    text: 'That street food smelled incredible. Six hours later, your stomach disagrees.',
    choices: [
      { label: 'Ride it out', tags: ['cautious'], run: (x) => { x.mods({ health: -4, happiness: -3 }); return 'Two days lost to the hotel bathroom. You regret nothing. Almost nothing.'; } },
      { label: 'Find a pharmacy', tags: ['help'], run: (x) => { x.money(-cost(x, 30)); x.mods({ health: -2 }); x.train('languages', 1); return 'You mimed your symptoms to a pharmacist. Unforgettable for both of you.'; } },
    ],
  },
  {
    id: 'le_souvenir', cat: 'travel', scene: 'shopping', weight: 0.8, cooldown: 4, minAge: 8,
    title: 'The souvenir',
    text: 'A market stall is selling something you absolutely do not need and absolutely want.',
    choices: [
      { label: 'Haggle hard', tags: ['ambitious'], run: (x) => { x.train('negotiation', 2); x.money(-cost(x, 20)); return 'You got it for half price. The seller seemed delighted, which worries you.'; } },
      { label: 'Buy gifts for everyone', tags: ['help'], run: (x) => { x.money(-cost(x, 100)); for (const r of x.rels('friend', 'bestFriend', 'sibling', 'parent', 'child').slice(0, 4)) x.relMod(r.npcId, 2); return 'Fridge magnets for all. They are in a drawer at every house you know.'; } },
      { label: 'Take a photo instead', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 1 }); return 'Memories weigh nothing in your luggage.'; } },
    ],
  },
  {
    id: 'le_touristTrap', cat: 'travel', scene: 'travel', weight: 0.7, cooldown: 5, years: [1850, 2300], minAge: 16,
    title: 'Tourist trap',
    text: 'A friendly man offers you a "special local tour" and a remarkable price.',
    choices: [
      { label: 'Go with him', tags: ['impulsive'], run: (x) => { if (x.chance(0.4)) { x.mods({ happiness: 6 }); return 'He was genuine. A family lunch, a secret beach, a friend for life.'; } x.money(-cost(x, 150)); return 'The tour ended at his cousin\'s carpet shop. You now own a carpet.'; } },
      { label: 'Politely decline', tags: ['cautious'], run: (x) => { x.train('streetwise', 1); return 'He wished you a pleasant day and approached the next tourist within seconds.'; } },
    ],
  },
  {
    id: 'le_passportLost', cat: 'travel', scene: 'police', weight: 0.5, cooldown: 8, years: [1920, 2300], minAge: 18,
    title: 'Passport gone',
    text: 'You pat your pocket. Your passport is not in it. You are a long way from home.',
    choices: [
      { label: 'Go to the embassy', tags: ['cautious'], run: (x) => { x.money(-cost(x, 200)); x.mods({ stress: 5 }); return 'Forms, photos, a queue of other unlucky people. Home a week late.'; } },
      { label: 'Retrace your steps', tags: ['ambitious'], run: (x) => { if (x.chance(0.5)) { x.mods({ happiness: 4 }); return 'A café owner had kept it behind the counter, with a pastry on top.'; } x.money(-cost(x, 200)); x.mods({ stress: 6 }); return 'Gone for good. Embassy it is.'; } },
    ],
  },
  {
    id: 'le_cruise', cat: 'travel', scene: 'luxury', weight: 0.8, cooldown: 6, years: [1960, 2300], minAge: 18,
    title: 'All-you-can-eat cruise',
    text: 'A week-long cruise: twelve restaurants, a casino and a waterslide.',
    choices: [
      { label: 'Eat at every buffet', tags: ['impulsive'], run: (x) => { x.money(-cost(x, 1500)); x.mods({ happiness: 6, fitness: -2 }); return 'You gained four pounds and a lifetime of shrimp knowledge.'; } },
      { label: 'Do every excursion', tags: ['ambitious'], scene: 'beach', run: (x) => { x.money(-cost(x, 2000)); x.mods({ happiness: 6, wisdom: 1 }); return 'Six islands, six beaches, slightly too many sunburnt shoulders.'; } },
      { label: 'Hit the ship casino', tags: ['impulsive'], scene: 'casino', run: (x) => { x.money(-cost(x, 1500)); const w = cost(x, x.int(-500, 800)); x.money(w); return w > 0 ? `You won ${x.fmt(w)} at blackjack and tipped the dealer too much.` : 'The house won. The house always floats.'; } },
    ],
  },
  {
    id: 'le_safari', cat: 'travel', scene: 'zoo', weight: 0.6, cooldown: 10, years: [1950, 2300], minAge: 10,
    title: 'Safari',
    text: 'At dawn, the jeep rolls to a stop beside a lioness and her cubs.',
    choices: [
      { label: 'Stay perfectly still', tags: ['cautious'], run: (x) => { x.mods({ happiness: 8, wisdom: 3 }); x.remember('safari', 'Saw lions in the wild', 20); return 'She looked straight at you, unbothered, and you felt very small and very lucky.'; } },
      { label: 'Take a hundred photos', tags: ['impulsive'], run: (x) => { x.train('photography', 2); x.mods({ happiness: 6 }); return 'Ninety-nine blurry, one perfect. It hangs above your bed.'; } },
    ],
  },
  {
    id: 'le_wonders', cat: 'travel', scene: 'travel', weight: 0.7, cooldown: 10, years: [-800, 400], minAge: 16, maxAge: 60,
    title: 'A wonder of the world',
    text: 'Merchants are sailing to Egypt, and you could see the great pyramids with your own eyes.',
    choices: [
      { label: 'Join the voyage', tags: ['ambitious'], run: (x) => { x.money(-cost(x, 2000)); x.mods({ wisdom: 4, happiness: 7 }); x.remember('pyramids', 'Saw the pyramids', 25); return 'The guides said they were built by giants. You were inclined to believe it.'; } },
      { label: 'Hear about it later', tags: ['cautious'], run: (x) => { x.mods({ happiness: 1 }); return 'The merchants came back with exaggerated tales. The pyramids grew taller each time.'; } },
    ],
  },
  {
    id: 'le_silkRoad', cat: 'travel', scene: 'roadTrip', weight: 0.6, cooldown: 10, years: [-200, 1450], minAge: 18, maxAge: 55,
    title: 'The caravan',
    text: 'A caravan heading east will take one more traveller, if you can pay your share and keep up.',
    choices: [
      { label: 'Go east', tags: ['ambitious', 'impulsive'], run: (x) => { x.money(-cost(x, 1000)); x.train('languages', 4); x.train('negotiation', 3); if (x.chance(0.6)) { x.money(cost(x, 3000)); x.mods({ wisdom: 4, happiness: 6 }); return 'Silk, spices and tales. You came back richer in every sense.'; } x.mods({ health: -6, stress: 6 }); return 'Bandits, a sandstorm and sickness. You came back alive, which counts.'; } },
      { label: 'Stay and trade locally', tags: ['cautious'], run: (x) => { x.train('negotiation', 2); return 'You sold the caravan water and bread. A smaller fortune, but a sure one.'; } },
    ],
  },
  {
    id: 'le_takingWaters', cat: 'travel', scene: 'spa', weight: 0.8, cooldown: 6, years: [1700, 1910], minAge: 30,
    title: 'Taking the waters',
    text: 'Your doctor recommends a season at the spa town to "take the waters" for your constitution.',
    choices: [
      { label: 'Go for the season', tags: ['cautious'], run: (x) => { x.money(-cost(x, 1500)); x.mods({ health: 4, stress: -6, popularity: 2 }); return 'The water tasted of eggs and rust. The balls and gossip were superb.'; } },
      { label: 'Stay home', tags: ['impulsive'], run: (x) => { x.mods({ happiness: 1 }); return 'You saved a fortune and felt about the same.'; } },
    ],
  },
  {
    id: 'le_familyVacation', cat: 'travel', scene: 'beach', weight: (x) => x.children().length ? 1 : 0, cooldown: 4, years: [1900, 2300], minAge: 25, maxAge: 65,
    title: 'Family holiday',
    text: 'The family holiday: four hours in the car, three toilet stops, two arguments and "are we there yet" every ten minutes.',
    choices: [
      { label: 'Plan every day', tags: ['ambitious'], run: (x) => { x.money(-cost(x, 1500)); x.mods({ stress: 3, happiness: 4 }); for (const c of x.children().slice(0, 4)) x.relMod(c.id, 3); return 'Itinerary fully completed. Everyone exhausted. Photos: magnificent.'; } },
      { label: 'Go with the flow', tags: ['social'], run: (x) => { x.money(-cost(x, 1000)); x.mods({ happiness: 6, stress: -3 }); for (const c of x.children().slice(0, 4)) x.relMod(c.id, 4); return 'Rock pools, ice cream, one rainy day of cards. The kids will remember it forever.'; } },
      { label: 'Stay home, camp in the garden', tags: ['cautious'], scene: 'camping', run: (x) => { x.mods({ happiness: 4 }); for (const c of x.children().slice(0, 4)) x.relMod(c.id, 3); return 'A tent, a torch and stories. Somehow the best holiday of all.'; } },
    ],
  },
  {
    id: 'le_soloTrip', cat: 'travel', scene: 'travel', weight: 0.7, cooldown: 6, years: [1900, 2300], minAge: 20,
    title: 'Table for one',
    text: 'You have booked a trip alone for the first time. Dinner on night one: a table for one.',
    choices: [
      { label: 'Enjoy your own company', tags: ['cautious'], run: (x) => { x.mods({ confidence: 4, happiness: 5, loneliness: -2 }); return 'You ordered dessert first. Nobody could stop you.'; } },
      { label: 'Talk to the next table', tags: ['social'], run: (x) => { x.mods({ happiness: 5, loneliness: -5 }); return 'They adopted you for the week. You still send each other birthday cards.'; } },
    ],
  },
  {
    id: 'le_timeshare', cat: 'travel', scene: 'meeting', weight: 0.6, cooldown: 8, years: [1975, 2300], minAge: 25,
    title: 'Free breakfast',
    text: 'You accepted a free breakfast at the resort. It has turned into a three-hour timeshare pitch.',
    choices: [
      { label: 'Sign up', tags: ['impulsive'], run: (x) => { x.money(-cost(x, 8000)); x.mods({ stress: 3 }); return 'You now own two weeks a year in a flat you will never visit.'; } },
      { label: 'Walk out', tags: ['cautious'], run: (x) => { x.mods({ confidence: 2 }); return 'You took a croissant for the road. Victory.'; } },
      { label: 'Ask endless questions', tags: ['social'], run: (x) => { x.mods({ happiness: 3 }); return 'After four hours the salesman gave up and bought you lunch.'; } },
    ],
  },
  {
    id: 'le_northernLights', cat: 'travel', scene: 'stargazing', weight: 0.6, cooldown: 10, minAge: 10,
    title: 'Northern lights',
    text: 'You have travelled north in the cold, and tonight the forecast is promising.',
    choices: [
      { label: 'Wait up all night', tags: ['ambitious'], run: (x) => { if (x.chance(0.6)) { x.mods({ happiness: 8, wisdom: 2 }); x.remember('aurora', 'Saw the northern lights', 20); return 'Green curtains rippled across the sky. You forgot you were cold.'; } x.mods({ health: -1 }); return 'Clouds all night. You saw your own breath and a very confused moose.'; } },
      { label: 'Go to bed', tags: ['cautious'], run: (x) => { x.mods({ happiness: -1 }); return 'Of course they appeared at 3am. Everyone has photos except you.'; } },
    ],
  },
  {
    id: 'le_airportSecurity', cat: 'travel', scene: 'police', weight: 0.6, cooldown: 6, years: [2002, 2300], minAge: 16,
    title: 'Security check',
    text: 'The scanner beeps. Then beeps again. Everyone in the queue looks at you.',
    choices: [
      { label: 'Cooperate cheerfully', tags: ['cautious'], run: (x) => { x.mods({ stress: 2 }); return 'It was your belt. Then your watch. Then a single coin in your sock.'; } },
      { label: 'Make a joke', tags: ['impulsive'], run: (x) => { x.mods({ stress: 6 }); return 'Security did not laugh. Forty-five minutes in a small room.'; } },
    ],
  },
  {
    id: 'le_spaceTourism', cat: 'travel', scene: 'rocket', weight: (x) => x.c.money > cost(x, 100000) ? 1 : 0.2, cooldown: 10, years: [2030, 2300], minAge: 18, maxAge: 80,
    title: 'Orbital holiday',
    text: 'Orbital hotels now take tourists. Three nights, zero gravity, sunrise every ninety minutes.',
    choices: [
      { label: 'Book it', tags: ['impulsive', 'ambitious'], run: (x) => { if (!x.spend(cost(x, 80000))) return 'Even with savings, it was out of reach. Maybe in ten years.'; x.mods({ happiness: 12, wisdom: 4 }); x.remember('orbit', 'Holidayed in orbit', 40); return 'You floated by the window watching storms crawl over continents. Earth looked fragile and precious.'; } },
      { label: 'Watch the launch instead', tags: ['cautious'], run: (x) => { x.mods({ happiness: 3 }); return 'A bright line climbing into the dawn. One day.'; } },
    ],
  },
  {
    id: 'le_lunarHotel', cat: 'travel', scene: 'moonLanding', weight: (x) => x.c.money > cost(x, 300000) ? 1 : 0.1, cooldown: 12, years: [2070, 2300], minAge: 18, maxAge: 85,
    title: 'Honeymoon on the moon?',
    text: 'A lunar hotel has opened with a view of the Earth rising over grey hills.',
    choices: [
      { label: 'Go to the moon', tags: ['impulsive'], run: (x) => { if (!x.spend(cost(x, 250000))) return 'You could not afford it. You looked up at it all evening instead.'; x.mods({ happiness: 14, wisdom: 5 }); x.remember('moon', 'Stood on the moon', 50); return 'You bounced across the regolith laughing like a child. Earthrise made you cry.'; } },
      { label: 'Wait for prices to fall', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 1 }); return 'They say that every year. It is still the moon.'; } },
    ],
  },
  {
    id: 'le_hiddenBeach', cat: 'travel', scene: 'beach', weight: 0.7, cooldown: 6, years: [1900, 2300], minAge: 16,
    title: 'Secret beach',
    text: 'A local tells you about a beach that is not in any guidebook, down a cliff path.',
    choices: [
      { label: 'Find it', tags: ['ambitious'], run: (x) => { x.mods({ happiness: 7, fitness: 1 }); return 'Turquoise water, white sand and not a single other person. You promise to keep the secret.'; } },
      { label: 'Post its location', tags: ['impulsive'], when: (x) => x.year >= 2008, run: (x) => { x.mods({ popularity: 2, karma: -2 }); return 'By next summer there were deckchairs, a car park and a beach bar.'; } },
      { label: 'Stay at the main beach', tags: ['cautious'], run: (x) => { x.mods({ happiness: 3 }); return 'Crowded, noisy, perfectly nice.'; } },
    ],
  },
  {
    id: 'le_languageMixup', cat: 'travel', scene: 'restaurant', weight: 0.7, cooldown: 5, years: [1700, 2300], minAge: 12,
    title: 'Lost in translation',
    text: 'You confidently ordered dinner in the local language. The waiter is trying very hard not to laugh.',
    choices: [
      { label: 'Eat whatever arrives', tags: ['impulsive'], run: (x) => { x.mods({ happiness: 4 }); return x.chance(0.5) ? 'It was the best thing you have ever eaten. You have no idea what it was.' : 'Twelve boiled eggs. You ate four, with dignity.'; } },
      { label: 'Ask for help', tags: ['cautious', 'social'], run: (x) => { x.train('languages', 3); return 'The waiter taught you the right words, and the kitchen sent out a free dessert.'; } },
    ],
  },
];

export const LEISURE_EVENTS: EventDef[] = [...PET_EVENTS, ...PET_EVENTS_2, ...ITEM_EVENTS, ...HOBBY_EVENTS, ...HOBBY_EVENTS_2, ...TRAVEL_EVENTS];

export const LEISURE_CHAINS: ChainDef[] = [
  { id: 'le_strangerChain', name: 'The traveller', desc: 'A stranger from a journey writes years later.', steps: [{ delay: 3, eventId: 'le_strangerLetter' }] },
];

