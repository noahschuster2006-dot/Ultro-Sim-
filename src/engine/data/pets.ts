/** Pets you can keep. Years gate what is plausible (no hamsters in Rome). */
export interface PetType {
  id: string;
  name: string;
  /** Plural for text: "dogs". */
  plural: string;
  years: [number, number];
  /** Adoption price in modern dollars (scaled by era). */
  cost: number;
  /** Yearly upkeep in modern dollars. */
  upkeep: number;
  /** Typical lifespan in years. */
  lifespan: number;
  /** Happiness per year while you own it. */
  joy: number;
  breeds: string[];
  colors: string[];
  /** Names that suit the animal. */
  names: string[];
  /** Exotic or prestige animals add a little fame. */
  prestige?: number;
  /** Needs land: only if you own a house or estate. */
  needsLand?: boolean;
}

export const PET_TYPES: PetType[] = [
  {
    id: 'dog', name: 'Dog', plural: 'dogs', years: [-3000, 9999], cost: 600, upkeep: 1500, lifespan: 13, joy: 4,
    breeds: ['mutt', 'beagle', 'labrador', 'golden retriever', 'german shepherd', 'poodle', 'dachshund', 'greyhound', 'collie', 'terrier', 'husky', 'bulldog'],
    colors: ['#c8913f', '#3b2a1e', '#f1e4c8', '#8a5a2b', '#1c1c1c', '#d9c3a1', '#a9a9a9'],
    names: ['Rex', 'Biscuit', 'Luna', 'Max', 'Bella', 'Scout', 'Duke', 'Daisy', 'Buddy', 'Pepper', 'Argos', 'Fido'],
  },
  {
    id: 'cat', name: 'Cat', plural: 'cats', years: [-3000, 9999], cost: 200, upkeep: 900, lifespan: 15, joy: 3,
    breeds: ['tabby', 'siamese', 'persian', 'maine coon', 'black cat', 'calico', 'sphynx', 'ragdoll', 'tuxedo cat'],
    colors: ['#d98e3f', '#2a2a2a', '#f4efe6', '#8d8d8d', '#e2c79c', '#5b4636'],
    names: ['Mittens', 'Shadow', 'Cleo', 'Whiskers', 'Nala', 'Socks', 'Bastet', 'Pumpkin', 'Oliver', 'Mochi'],
  },
  {
    id: 'horse', name: 'Horse', plural: 'horses', years: [-2000, 9999], cost: 4000, upkeep: 6000, lifespan: 28, joy: 4, prestige: 1, needsLand: true,
    breeds: ['arabian', 'thoroughbred', 'mustang', 'clydesdale', 'shetland pony', 'andalusian', 'appaloosa'],
    colors: ['#6b4226', '#2b1d14', '#d9c8a9', '#8b5a2b', '#f2f2f2', '#4a4a4a'],
    names: ['Thunder', 'Bucephalus', 'Star', 'Maple', 'Shadowfax', 'Duchess', 'Blaze', 'Comet'],
  },
  {
    id: 'parrot', name: 'Parrot', plural: 'parrots', years: [-500, 9999], cost: 900, upkeep: 500, lifespan: 40, joy: 3, prestige: 0.5,
    breeds: ['macaw', 'african grey', 'cockatoo', 'budgie', 'cockatiel', 'lovebird'],
    colors: ['#e63946', '#2a9d8f', '#f4a261', '#4895ef', '#90be6d', '#ffd166'],
    names: ['Polly', 'Kiwi', 'Captain', 'Sunny', 'Mango', 'Rio', 'Pickles'],
  },
  {
    id: 'rabbit', name: 'Rabbit', plural: 'rabbits', years: [500, 9999], cost: 80, upkeep: 400, lifespan: 9, joy: 2,
    breeds: ['lop', 'dutch', 'lionhead', 'rex', 'angora'],
    colors: ['#f4efe6', '#a07850', '#5b4636', '#d9d9d9', '#2a2a2a'],
    names: ['Thumper', 'Clover', 'Bun', 'Hazel', 'Peter', 'Cotton'],
  },
  {
    id: 'hamster', name: 'Hamster', plural: 'hamsters', years: [1930, 9999], cost: 25, upkeep: 150, lifespan: 3, joy: 2,
    breeds: ['syrian', 'dwarf', 'roborovski'],
    colors: ['#d9a05b', '#f4efe6', '#8d8d8d'],
    names: ['Nibbles', 'Peanut', 'Hammy', 'Gizmo', 'Squeak'],
  },
  {
    id: 'fish', name: 'Goldfish', plural: 'goldfish', years: [1000, 9999], cost: 15, upkeep: 100, lifespan: 10, joy: 1,
    breeds: ['goldfish', 'koi', 'betta', 'guppy', 'angelfish'],
    colors: ['#ff8c1a', '#ffffff', '#e63946', '#4895ef', '#ffd166'],
    names: ['Bubbles', 'Goldie', 'Finn', 'Nemo', 'Sushi'],
  },
  {
    id: 'turtle', name: 'Tortoise', plural: 'tortoises', years: [-1000, 9999], cost: 150, upkeep: 200, lifespan: 60, joy: 1,
    breeds: ['box turtle', 'red-eared slider', 'greek tortoise', 'sulcata tortoise'],
    colors: ['#6a8d4e', '#8b6b3e', '#4f6b3a'],
    names: ['Sheldon', 'Methuselah', 'Speedy', 'Leonardo', 'Myrtle'],
  },
  {
    id: 'snake', name: 'Snake', plural: 'snakes', years: [1960, 9999], cost: 250, upkeep: 300, lifespan: 20, joy: 1, prestige: 0.3,
    breeds: ['corn snake', 'ball python', 'king snake', 'boa'],
    colors: ['#d9622b', '#5b4636', '#2a2a2a', '#c9b458'],
    names: ['Noodle', 'Kaa', 'Slinky', 'Medusa', 'Hiss'],
  },
  {
    id: 'lizard', name: 'Lizard', plural: 'lizards', years: [1970, 9999], cost: 200, upkeep: 300, lifespan: 12, joy: 1,
    breeds: ['bearded dragon', 'leopard gecko', 'iguana', 'chameleon'],
    colors: ['#c9a25a', '#7fb069', '#e9c46a', '#4f772d'],
    names: ['Spike', 'Rango', 'Ziggy', 'Godzilla', 'Pascal'],
  },
  {
    id: 'falcon', name: 'Falcon', plural: 'falcons', years: [-1500, 1800], cost: 3000, upkeep: 1500, lifespan: 15, joy: 3, prestige: 2,
    breeds: ['peregrine falcon', 'gyrfalcon', 'saker falcon', 'goshawk'],
    colors: ['#6b5b4b', '#d8d2c4', '#3a3a3a'],
    names: ['Talon', 'Arrow', 'Horus', 'Swift', 'Gale'],
  },
  {
    id: 'ferret', name: 'Ferret', plural: 'ferrets', years: [-500, 9999], cost: 200, upkeep: 500, lifespan: 8, joy: 2,
    breeds: ['sable ferret', 'albino ferret', 'cinnamon ferret'],
    colors: ['#6b4f3a', '#f4efe6', '#b5835a'],
    names: ['Bandit', 'Slinky', 'Ziggy', 'Weasley'],
  },
  {
    id: 'pig', name: 'Pot-bellied pig', plural: 'pigs', years: [1980, 9999], cost: 500, upkeep: 800, lifespan: 15, joy: 2, needsLand: true,
    breeds: ['pot-bellied pig', 'kunekune'],
    colors: ['#f2b5a7', '#2a2a2a', '#d9a07b'],
    names: ['Wilbur', 'Truffle', 'Hamlet', 'Babe'],
  },
  {
    id: 'monkey', name: 'Monkey', plural: 'monkeys', years: [1500, 2010], cost: 5000, upkeep: 3000, lifespan: 25, joy: 3, prestige: 1.5,
    breeds: ['capuchin', 'marmoset', 'squirrel monkey'],
    colors: ['#6b4226', '#c9a27a', '#3b2a1e'],
    names: ['George', 'Abu', 'Bubbles', 'Coco'],
  },
  {
    id: 'robodog', name: 'Robot dog', plural: 'robot dogs', years: [2030, 9999], cost: 3000, upkeep: 300, lifespan: 20, joy: 2, prestige: 0.5,
    breeds: ['companion unit', 'guardian model', 'pocket model'],
    colors: ['#c9d1d9', '#2b2f3a', '#4cc9f0'],
    names: ['Byte', 'Unit 7', 'Sparky', 'Chip', 'Pixel'],
  },
];

export const PET_BY_ID: Record<string, PetType> = Object.fromEntries(PET_TYPES.map((p) => [p.id, p]));

export function petsAvailable(year: number): PetType[] {
  return PET_TYPES.filter((p) => year >= p.years[0] && year <= p.years[1]);
}
