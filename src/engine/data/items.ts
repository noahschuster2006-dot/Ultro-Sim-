/** Things you can buy and own: vehicles, jewellery, gadgets, art, instruments, luxuries. */
export type ItemCat = 'vehicle' | 'jewelry' | 'fashion' | 'tech' | 'art' | 'instrument' | 'home' | 'luxury';

export interface ItemType {
  id: string;
  /** [untilYear, name] pairs; the last entry applies to all later years. */
  names: [number, string][];
  cat: ItemCat;
  years: [number, number];
  /** Price in modern dollars (scaled by era). */
  price: number;
  /** Yearly upkeep in modern dollars (fuel, insurance, tuning). */
  upkeep: number;
  /** Fraction of value lost per year (negative for things that appreciate). */
  depreciation: number;
  /** Happiness on purchase. */
  joy: number;
  /** Small lasting effects while owned. */
  looks?: number;
  fame?: number;
  /** Status symbol: thieves and tabloids notice. */
  flashy?: boolean;
  /** Minimum age to buy. */
  minAge?: number;
  desc: string;
}

export const ITEM_CATS: { id: ItemCat; name: string }[] = [
  { id: 'vehicle', name: 'Vehicles' },
  { id: 'jewelry', name: 'Jewellery' },
  { id: 'fashion', name: 'Fashion' },
  { id: 'tech', name: 'Gadgets' },
  { id: 'art', name: 'Art & collectibles' },
  { id: 'instrument', name: 'Instruments' },
  { id: 'home', name: 'Home & hobbies' },
  { id: 'luxury', name: 'Luxury' },
];

export const ITEM_TYPES: ItemType[] = [
  // ---------------------------------------------------------------- vehicles
  { id: 'chariot', names: [[9999, 'Chariot']], cat: 'vehicle', years: [-2000, 400], price: 6000, upkeep: 800, depreciation: 0.08, joy: 6, fame: 1, flashy: true, minAge: 16, desc: 'Two wheels, two horses, all eyes on you.' },
  { id: 'cart', names: [[9999, 'Ox cart']], cat: 'vehicle', years: [-3000, 1900], price: 400, upkeep: 150, depreciation: 0.05, joy: 2, minAge: 14, desc: 'Slow, sturdy and useful at market.' },
  { id: 'carriage', names: [[9999, 'Horse-drawn carriage']], cat: 'vehicle', years: [1500, 1925], price: 9000, upkeep: 1500, depreciation: 0.06, joy: 6, fame: 1, flashy: true, minAge: 16, desc: 'Lacquered doors and a coachman who knows the city.' },
  { id: 'bicycle', names: [[1890, 'Velocipede'], [9999, 'Bicycle']], cat: 'vehicle', years: [1870, 9999], price: 400, upkeep: 40, depreciation: 0.1, joy: 3, minAge: 6, desc: 'Freedom on two wheels.' },
  { id: 'motorcycle', names: [[9999, 'Motorcycle']], cat: 'vehicle', years: [1903, 9999], price: 9000, upkeep: 900, depreciation: 0.12, joy: 6, minAge: 16, desc: 'Loud, fast and a little dangerous.' },
  { id: 'usedCar', names: [[9999, 'Used car']], cat: 'vehicle', years: [1915, 9999], price: 6000, upkeep: 1600, depreciation: 0.15, joy: 4, minAge: 16, desc: 'It runs. Mostly.' },
  { id: 'familyCar', names: [[1990, 'Family sedan'], [9999, 'Family SUV']], cat: 'vehicle', years: [1920, 9999], price: 28000, upkeep: 2200, depreciation: 0.13, joy: 5, minAge: 17, desc: 'Room for everyone and the groceries.' },
  { id: 'sportsCar', names: [[9999, 'Sports car']], cat: 'vehicle', years: [1950, 9999], price: 120000, upkeep: 6000, depreciation: 0.14, joy: 10, looks: 2, fame: 2, flashy: true, minAge: 17, desc: 'Zero to sixty before anyone finishes their sentence.' },
  { id: 'luxuryCar', names: [[1940, 'Chauffeured limousine'], [9999, 'Luxury sedan']], cat: 'vehicle', years: [1910, 9999], price: 90000, upkeep: 5000, depreciation: 0.12, joy: 8, fame: 1, flashy: true, minAge: 17, desc: 'Leather, silence and a badge everyone recognises.' },
  { id: 'electricCar', names: [[9999, 'Electric car']], cat: 'vehicle', years: [2010, 9999], price: 45000, upkeep: 900, depreciation: 0.12, joy: 6, minAge: 16, desc: 'Silent, quick and smug.' },
  { id: 'flyingCar', names: [[9999, 'Flying car']], cat: 'vehicle', years: [2045, 9999], price: 400000, upkeep: 12000, depreciation: 0.1, joy: 14, fame: 3, flashy: true, minAge: 18, desc: 'Traffic is somebody else’s problem now.' },
  { id: 'sailboat', names: [[9999, 'Sailboat']], cat: 'vehicle', years: [-1000, 9999], price: 30000, upkeep: 3000, depreciation: 0.07, joy: 7, minAge: 16, desc: 'Weekends on the water.' },
  { id: 'yacht', names: [[9999, 'Yacht']], cat: 'vehicle', years: [1880, 9999], price: 4000000, upkeep: 300000, depreciation: 0.08, joy: 18, fame: 4, flashy: true, minAge: 18, desc: 'A floating party with a crew of twelve.' },
  { id: 'privateJet', names: [[9999, 'Private jet']], cat: 'vehicle', years: [1960, 9999], price: 20000000, upkeep: 1500000, depreciation: 0.06, joy: 20, fame: 6, flashy: true, minAge: 18, desc: 'Never queue at an airport again.' },

  // ---------------------------------------------------------------- jewellery
  { id: 'goldRing', names: [[9999, 'Gold ring']], cat: 'jewelry', years: [-3000, 9999], price: 900, upkeep: 0, depreciation: -0.01, joy: 3, looks: 1, desc: 'Simple, shining, forever.' },
  { id: 'diamondRing', names: [[9999, 'Diamond ring']], cat: 'jewelry', years: [1400, 9999], price: 6000, upkeep: 0, depreciation: 0.02, joy: 5, looks: 1, flashy: true, desc: 'The traditional way to ask a very big question.' },
  { id: 'necklace', names: [[1500, 'Gold torque'], [9999, 'Pearl necklace']], cat: 'jewelry', years: [-3000, 9999], price: 3000, upkeep: 0, depreciation: 0, joy: 4, looks: 2, desc: 'Catches the light, and the eye.' },
  { id: 'watch', names: [[1920, 'Pocket watch'], [2014, 'Wristwatch'], [9999, 'Smartwatch']], cat: 'jewelry', years: [1600, 9999], price: 400, upkeep: 0, depreciation: 0.15, joy: 2, desc: 'Never late again. Probably.' },
  { id: 'luxuryWatch', names: [[1920, 'Gold pocket watch'], [9999, 'Swiss luxury watch']], cat: 'jewelry', years: [1700, 9999], price: 25000, upkeep: 300, depreciation: -0.02, joy: 6, fame: 1, flashy: true, minAge: 16, desc: 'Tells time and tells everyone you have money.' },
  { id: 'tiara', names: [[9999, 'Diamond tiara']], cat: 'jewelry', years: [1700, 9999], price: 250000, upkeep: 2000, depreciation: -0.02, joy: 10, looks: 3, fame: 3, flashy: true, minAge: 16, desc: 'For balls, coronations and very good photographs.' },
  { id: 'signetRing', names: [[9999, 'Family signet ring']], cat: 'jewelry', years: [-500, 9999], price: 2500, upkeep: 0, depreciation: -0.01, joy: 3, desc: 'Seals letters and remembers ancestors.' },

  // ---------------------------------------------------------------- fashion
  { id: 'fineClothes', names: [[500, 'Fine toga'], [1500, 'Embroidered tunic'], [1900, 'Tailored suit of clothes'], [9999, 'Designer outfit']], cat: 'fashion', years: [-3000, 9999], price: 1500, upkeep: 0, depreciation: 0.4, joy: 4, looks: 3, desc: 'Dress for the life you want.' },
  { id: 'wardrobe', names: [[1900, 'Wardrobe of the latest fashions'], [9999, 'Designer wardrobe']], cat: 'fashion', years: [1600, 9999], price: 15000, upkeep: 2000, depreciation: 0.4, joy: 7, looks: 5, fame: 1, flashy: true, minAge: 14, desc: 'Never wear the same thing twice.' },
  { id: 'furCoat', names: [[9999, 'Fur coat']], cat: 'fashion', years: [-3000, 2020], price: 8000, upkeep: 100, depreciation: 0.1, joy: 4, looks: 2, flashy: true, minAge: 16, desc: 'Warm, heavy and controversial.' },
  { id: 'sneakers', names: [[9999, 'Limited-edition sneakers']], cat: 'fashion', years: [1985, 9999], price: 900, upkeep: 0, depreciation: -0.05, joy: 5, looks: 1, minAge: 10, desc: 'Never worn. Never.' },

  // ---------------------------------------------------------------- gadgets
  { id: 'phonograph', names: [[9999, 'Phonograph']], cat: 'tech', years: [1880, 1960], price: 700, upkeep: 20, depreciation: 0.08, joy: 5, desc: 'Music in your parlour, any time you like.' },
  { id: 'radio', names: [[9999, 'Radio set']], cat: 'tech', years: [1922, 9999], price: 300, upkeep: 10, depreciation: 0.1, joy: 3, desc: 'News, dramas and dance bands from the air.' },
  { id: 'camera', names: [[1990, 'Camera'], [9999, 'Digital camera']], cat: 'tech', years: [1888, 9999], price: 600, upkeep: 50, depreciation: 0.2, joy: 3, desc: 'Capture the moments worth keeping.' },
  { id: 'tv', names: [[1975, 'Television set'], [2005, 'Colour TV'], [9999, 'Big-screen TV']], cat: 'tech', years: [1948, 9999], price: 900, upkeep: 50, depreciation: 0.2, joy: 4, desc: 'The whole world, in the living room.' },
  { id: 'computer', names: [[1995, 'Home computer'], [9999, 'Gaming PC']], cat: 'tech', years: [1977, 9999], price: 1800, upkeep: 100, depreciation: 0.3, joy: 5, desc: 'Work, play and a thousand open tabs.' },
  { id: 'gameConsole', names: [[9999, 'Game console']], cat: 'tech', years: [1977, 9999], price: 500, upkeep: 60, depreciation: 0.3, joy: 6, minAge: 5, desc: 'Just one more level.' },
  { id: 'smartphone', names: [[9999, 'Smartphone']], cat: 'tech', years: [2007, 9999], price: 1000, upkeep: 600, depreciation: 0.35, joy: 4, minAge: 8, desc: 'The world in your pocket, and it never stops buzzing.' },
  { id: 'vrHeadset', names: [[9999, 'VR headset']], cat: 'tech', years: [2016, 9999], price: 700, upkeep: 50, depreciation: 0.35, joy: 5, minAge: 10, desc: 'Other worlds, strapped to your face.' },
  { id: 'homeRobot', names: [[9999, 'Home robot']], cat: 'tech', years: [2030, 9999], price: 15000, upkeep: 800, depreciation: 0.2, joy: 7, minAge: 18, desc: 'It cooks, it cleans, it judges you silently.' },
  { id: 'telescope', names: [[9999, 'Telescope']], cat: 'tech', years: [1610, 9999], price: 900, upkeep: 20, depreciation: 0.05, joy: 4, desc: 'Moons, rings and the long silence between them.' },

  // ---------------------------------------------------------------- art & collectibles
  { id: 'painting', names: [[9999, 'Oil painting']], cat: 'art', years: [-500, 9999], price: 20000, upkeep: 200, depreciation: -0.04, joy: 5, fame: 1, minAge: 16, desc: 'An original by a promising artist.' },
  { id: 'masterpiece', names: [[9999, 'Old Master painting']], cat: 'art', years: [1600, 9999], price: 5000000, upkeep: 30000, depreciation: -0.05, joy: 12, fame: 4, flashy: true, minAge: 18, desc: 'Museum quality. Insurance quality.' },
  { id: 'sculpture', names: [[9999, 'Marble sculpture']], cat: 'art', years: [-3000, 9999], price: 40000, upkeep: 300, depreciation: -0.03, joy: 5, fame: 1, minAge: 16, desc: 'A figure carved for eternity.' },
  { id: 'rareBook', names: [[1450, 'Illuminated manuscript'], [9999, 'Rare first edition']], cat: 'art', years: [-500, 9999], price: 12000, upkeep: 50, depreciation: -0.04, joy: 4, minAge: 12, desc: 'Gilt edges and the smell of centuries.' },
  { id: 'stamps', names: [[9999, 'Stamp collection']], cat: 'art', years: [1850, 9999], price: 800, upkeep: 20, depreciation: -0.02, joy: 3, minAge: 8, desc: 'A world of tiny portraits.' },
  { id: 'comics', names: [[9999, 'Vintage comic collection']], cat: 'art', years: [1945, 9999], price: 1500, upkeep: 20, depreciation: -0.04, joy: 4, minAge: 8, desc: 'Bagged, boarded and beloved.' },
  { id: 'wineCellar', names: [[9999, 'Wine cellar']], cat: 'art', years: [-500, 9999], price: 60000, upkeep: 2000, depreciation: -0.05, joy: 6, minAge: 21, desc: 'Vintages that improve while you sleep.' },
  { id: 'heirloomSword', names: [[9999, 'Ancestral sword']], cat: 'art', years: [-1000, 9999], price: 8000, upkeep: 100, depreciation: -0.02, joy: 4, minAge: 14, desc: 'Hung above the fireplace, full of stories.' },

  // ---------------------------------------------------------------- instruments
  { id: 'lute', names: [[9999, 'Lute']], cat: 'instrument', years: [-500, 1750], price: 600, upkeep: 30, depreciation: 0.05, joy: 4, desc: 'The troubadour’s favourite.' },
  { id: 'guitar', names: [[1930, 'Guitar'], [9999, 'Electric guitar']], cat: 'instrument', years: [1600, 9999], price: 700, upkeep: 50, depreciation: 0.05, joy: 4, minAge: 6, desc: 'Three chords and the truth.' },
  { id: 'piano', names: [[1800, 'Harpsichord'], [9999, 'Grand piano']], cat: 'instrument', years: [1600, 9999], price: 15000, upkeep: 300, depreciation: 0.02, joy: 6, fame: 1, minAge: 5, desc: 'The centre of every party worth attending.' },
  { id: 'violin', names: [[9999, 'Violin']], cat: 'instrument', years: [1550, 9999], price: 2500, upkeep: 100, depreciation: -0.01, joy: 4, minAge: 5, desc: 'Weeps and sings in the right hands.' },
  { id: 'drums', names: [[9999, 'Drum kit']], cat: 'instrument', years: [1920, 9999], price: 1500, upkeep: 50, depreciation: 0.08, joy: 5, minAge: 8, desc: 'Your neighbours have opinions.' },
  { id: 'synth', names: [[9999, 'Synthesizer']], cat: 'instrument', years: [1970, 9999], price: 2500, upkeep: 60, depreciation: 0.1, joy: 5, minAge: 10, desc: 'Every sound ever imagined, and some that shouldn’t be.' },

  // ---------------------------------------------------------------- home & hobbies
  { id: 'library', names: [[9999, 'Home library']], cat: 'home', years: [-500, 9999], price: 6000, upkeep: 100, depreciation: 0, joy: 4, desc: 'Floor-to-ceiling shelves and a rolling ladder.' },
  { id: 'poolTable', names: [[9999, 'Billiards table']], cat: 'home', years: [1850, 9999], price: 4000, upkeep: 50, depreciation: 0.03, joy: 4, minAge: 12, desc: 'Felt, chalk and friendly rivalry.' },
  { id: 'hotTub', names: [[9999, 'Hot tub']], cat: 'home', years: [1970, 9999], price: 9000, upkeep: 800, depreciation: 0.08, joy: 6, minAge: 18, desc: 'Bubbles, stars and long conversations.' },
  { id: 'homeGym', names: [[9999, 'Home gym']], cat: 'home', years: [1950, 9999], price: 5000, upkeep: 100, depreciation: 0.1, joy: 3, desc: 'No excuses now.' },
  { id: 'chessSet', names: [[9999, 'Carved chess set']], cat: 'home', years: [600, 9999], price: 300, upkeep: 0, depreciation: 0, joy: 2, minAge: 6, desc: 'A war you can win before dinner.' },

  // ---------------------------------------------------------------- luxury
  { id: 'racehorse', names: [[9999, 'Thoroughbred racehorse']], cat: 'luxury', years: [1700, 9999], price: 250000, upkeep: 60000, depreciation: 0.05, joy: 10, fame: 3, flashy: true, minAge: 18, desc: 'A long shot with a pedigree.' },
  { id: 'spaceTicket', names: [[9999, 'Ticket to orbit']], cat: 'luxury', years: [2025, 9999], price: 450000, upkeep: 0, depreciation: 1, joy: 20, fame: 4, flashy: true, minAge: 18, desc: 'Ten minutes of weightlessness and the whole planet in the window.' },
  { id: 'portrait', names: [[1900, 'Commissioned portrait'], [9999, 'Commissioned portrait photograph']], cat: 'luxury', years: [-500, 9999], price: 10000, upkeep: 0, depreciation: -0.01, joy: 6, fame: 1, minAge: 16, desc: 'You, immortalised for your descendants.' },
];

export const ITEM_BY_ID: Record<string, ItemType> = Object.fromEntries(ITEM_TYPES.map((i) => [i.id, i]));

export function itemName(t: ItemType, year: number): string {
  for (const [until, name] of t.names) if (year <= until) return name;
  return t.names[t.names.length - 1][1];
}

export function itemsAvailable(year: number): ItemType[] {
  return ITEM_TYPES.filter((i) => year >= i.years[0] && year <= i.years[1]);
}
