import type { Ctx } from '../ctx';
import type { Item, Pet } from '../types';
import { ITEM_BY_ID, itemName, type ItemType } from '../data/items';
import { PET_BY_ID, type PetType } from '../data/pets';
import { eraCostFactor } from './finance';

/** Era-scaled price of an item or pet. */
export function itemPrice(x: Ctx, t: ItemType): number {
  return Math.round(t.price * eraCostFactor(x.year));
}

export function petPrice(x: Ctx, t: PetType): number {
  return Math.round(t.cost * eraCostFactor(x.year));
}

export function hasLand(x: Ctx): boolean {
  return x.c.assets.some((a) => !a.seized && ['house', 'familyEstate', 'privateIsland', 'territory'].includes(a.typeId));
}

export function itemEligibility(x: Ctx, t: ItemType): true | string {
  if (x.year < t.years[0] || x.year > t.years[1]) return 'Not available in this era';
  if (x.c.legal.prison) return 'Not from a cell';
  if ((t.minAge ?? 0) > x.c.age) return `Age ${t.minAge}+`;
  if (x.c.money < itemPrice(x, t)) return `Costs ${x.fmt(itemPrice(x, t))}`;
  return true;
}

export function petEligibility(x: Ctx, t: PetType): true | string {
  if (x.year < t.years[0] || x.year > t.years[1]) return 'Not available in this era';
  if (x.c.legal.prison) return 'Not from a cell';
  if (x.c.age < 6) return 'Too young';
  if (t.needsLand && !hasLand(x) && x.c.age >= 18) return 'Needs a house with land';
  if (x.c.money < petPrice(x, t) && x.c.age >= 18) return `Costs ${x.fmt(petPrice(x, t))}`;
  return true;
}

/** Buy an item. Children's purchases are paid by their parents (if they agree). */
export function buyItem(x: Ctx, typeId: string, opts: { gift?: boolean; name?: string } = {}): string {
  const t = ITEM_BY_ID[typeId];
  if (!t) return 'There is no such thing for sale.';
  const price = itemPrice(x, t);
  if (!opts.gift) {
    if (!x.spend(price)) return `You cannot afford it (${x.fmt(price)}).`;
  }
  const item: Item = {
    id: x.uid('it'),
    typeId,
    name: opts.name ?? itemName(t, x.year),
    boughtYear: x.year,
    value: Math.round(price * (t.cat === 'fashion' ? 0.5 : 0.85)),
    condition: 100,
    meta: {},
  };
  x.c.items.push(item);
  x.mods({ happiness: t.joy, looks: t.looks ?? 0, fame: t.fame ?? 0 });
  if (t.flashy && x.famous) x.story('gossip', `${x.c.firstName} ${x.c.lastName} shows off a new ${item.name.toLowerCase()}`, 1);
  return opts.gift ? `You were given a ${item.name.toLowerCase()}.` : `You bought a ${item.name.toLowerCase()} for ${x.fmt(price)}.`;
}

export function sellItem(x: Ctx, itemId: string): string {
  const it = x.c.items.find((i) => i.id === itemId);
  if (!it) return 'You no longer own that.';
  const amount = Math.round(it.value * (0.6 + it.condition / 250));
  x.c.items = x.c.items.filter((i) => i !== it);
  x.money(amount);
  return `You sold your ${it.name.toLowerCase()} for ${x.fmt(amount)}.`;
}

/** Remove an item without payment (stolen, lost, destroyed, given away). */
export function loseItem(x: Ctx, itemId: string): Item | undefined {
  const it = x.c.items.find((i) => i.id === itemId);
  if (it) x.c.items = x.c.items.filter((i) => i !== it);
  return it;
}

export function adoptPet(x: Ctx, species: string, opts: { name?: string; breed?: string; free?: boolean } = {}): string {
  const t = PET_BY_ID[species];
  if (!t) return 'No such animal.';
  const price = petPrice(x, t);
  if (!opts.free && x.c.age >= 18 && !x.spend(price)) return `You cannot afford it (${x.fmt(price)}).`;
  const pet: Pet = {
    id: x.uid('pet'),
    species,
    name: opts.name ?? x.pick(t.names),
    breed: opts.breed ?? x.pick(t.breeds),
    color: x.pick(t.colors),
    birthYear: x.year - x.int(0, Math.min(3, Math.floor(t.lifespan / 4))),
    alive: true,
    health: x.int(70, 100),
    bond: x.int(30, 60),
    training: x.int(0, 30),
    meta: {},
  };
  x.c.pets.push(pet);
  x.mods({ happiness: 5 + t.joy, stress: -3 });
  return `You brought home ${pet.name}, ${aOrAnLocal(pet.breed)} ${pet.breed}.`;
}

function aOrAnLocal(w: string): string {
  return /^[aeiou]/i.test(w) ? 'an' : 'a';
}

export function petAge(x: Ctx, p: Pet): number {
  return Math.max(0, x.year - p.birthYear);
}

/** Living pets, optionally of one species. */
export function livingPets(x: Ctx, species?: string): Pet[] {
  return x.c.pets.filter((p) => p.alive && (!species || p.species === species));
}

export function rehomePet(x: Ctx, petId: string): string {
  const p = x.c.pets.find((q) => q.id === petId && q.alive);
  if (!p) return 'That pet is not with you.';
  x.c.pets = x.c.pets.filter((q) => q !== p);
  x.mods({ happiness: -6, karma: p.bond > 60 ? -2 : 0 });
  return `${p.name} went to a new home. The house feels emptier.`;
}

/** Yearly upkeep, wear and ageing for possessions and pets. */
export function possessionsTick(x: Ctx): void {
  const c = x.c;
  const f = eraCostFactor(x.year);
  let upkeep = 0;
  for (const it of c.items) {
    const t = ITEM_BY_ID[it.typeId];
    if (!t) continue;
    it.value = Math.max(0, Math.round(it.value * (1 - t.depreciation)));
    if (t.cat === 'vehicle' || t.cat === 'tech') it.condition = Math.max(0, it.condition - x.int(3, 9));
    upkeep += t.upkeep * f;
    if (t.looks) x.mod('looks', t.looks * 0.15);
    if (t.fame) x.mod('fame', t.fame * 0.1);
  }
  for (const p of c.pets) {
    if (!p.alive) continue;
    const t = PET_BY_ID[p.species];
    if (!t) continue;
    upkeep += t.upkeep * f;
    const age = petAge(x, p);
    x.mods({ happiness: t.joy * 0.5 * (0.5 + p.bond / 100), stress: -1, loneliness: -1.5 });
    p.bond = Math.min(100, p.bond + 2);
    if (age > t.lifespan * 0.7) p.health -= x.int(4, 14);
    else p.health += x.int(-4, 5);
    p.health = Math.max(0, Math.min(100, p.health));
    const old = Math.max(0, age - t.lifespan * 0.8) / (t.lifespan * 0.4);
    if (p.health <= 0 || x.chance(Math.min(0.6, old * 0.5 + 0.004))) {
      p.alive = false;
      p.deathYear = x.year;
      x.queue('pet_death', { petId: p.id });
    }
  }
  if (upkeep > 0 && c.age >= 18) {
    x.money(-Math.round(upkeep));
  }
  // Old pets are remembered but do not clutter the list forever.
  c.pets = c.pets.filter((p) => p.alive || (p.deathYear ?? x.year) >= x.year - 30);
  // Flashy things attract thieves where crime is high.
  const flashy = c.items.filter((i) => ITEM_BY_ID[i.typeId]?.flashy);
  if (flashy.length && !c.legal.prison && x.chance(Math.min(0.12, (x.w?.crimeRate ?? 30) / 900))) {
    x.queue('item_stolen', { itemId: x.pick(flashy).id });
  }
  // Vehicles that are worn out break down.
  const wreck = c.items.find((i) => ITEM_BY_ID[i.typeId]?.cat === 'vehicle' && i.condition < 25);
  if (wreck && x.chance(0.3)) x.queue('vehicle_breakdown', { itemId: wreck.id });
}
