export type AssetCat = 'property' | 'business' | 'luxury' | 'criminal' | 'political' | 'investment';

export interface AssetDef {
  id: string;
  name: string;
  cat: AssetCat;
  fromYear: number;
  toYear?: number;
  /** [untilYear, name] era-appropriate names. */
  eraNames?: [number, string][];
  price: [number, number];
  /** Annual income as a fraction of value when operated / rented. */
  yield: number;
  appreciation: number;
  volatility: number;
  /** Annual upkeep as a fraction of value. */
  upkeep: number;
  /** Fixed annual cost on top of upkeep. */
  fixedCost?: number;
  acquire: string;
  income: string;
  risk: string;
  rentable?: boolean;
  developable?: boolean;
  /** Dirty money this asset can launder each year, as a fraction of value. */
  launder?: number;
  /** Requirements to buy. */
  needs?: { fame?: number; criminalRep?: number; license?: boolean; capitalOnly?: boolean; skills?: Record<string, number> };
  notForSale?: boolean;
  heat?: number;
}

export const ASSETS: AssetDef[] = [
  {
    id: 'studio', name: 'Studio apartment', cat: 'property', fromYear: -800, eraNames: [[1850, 'Rented garret room']],
    price: [60000, 180000], yield: 0.06, appreciation: 0.03, volatility: 0.06, upkeep: 0.01,
    acquire: 'Buy / rent', income: 'Rental yield 4–8%/yr', risk: 'Tenant damage, vacancy', rentable: true,
  },
  {
    id: 'house', name: 'Single-family home', cat: 'property', fromYear: -800, eraNames: [[1700, 'Cottage'], [1900, 'Townhouse']],
    price: [160000, 700000], yield: 0.045, appreciation: 0.035, volatility: 0.07, upkeep: 0.012,
    acquire: 'Buy / mortgage', income: 'Appreciation + rental', risk: 'Maintenance, tax', rentable: true, developable: true,
  },
  {
    id: 'apartmentComplex', name: 'Apartment complex', cat: 'property', fromYear: 1880, eraNames: [[1940, 'Tenement block']],
    price: [1500000, 9000000], yield: 0.075, appreciation: 0.03, volatility: 0.08, upkeep: 0.02,
    acquire: 'Buy / develop', income: 'Multi-unit rental income', risk: 'Management cost, eviction events', rentable: true, developable: true,
  },
  {
    id: 'commercial', name: 'Commercial property', cat: 'property', fromYear: -800, eraNames: [[1800, 'Warehouse & market stalls']],
    price: [800000, 6000000], yield: 0.085, appreciation: 0.025, volatility: 0.1, upkeep: 0.015,
    acquire: 'Buy / develop', income: 'Commercial tenants (higher yield)', risk: 'Business failure, zoning', rentable: true, developable: true,
  },
  {
    id: 'nightclub', name: 'Nightclub', cat: 'business', fromYear: -800, eraNames: [[1700, 'Tavern'], [1920, 'Music hall']],
    price: [400000, 2500000], yield: 0.18, appreciation: 0.01, volatility: 0.15, upkeep: 0.05,
    acquire: 'Buy / build', income: 'High cash flow', risk: 'Crime events, licensing, violence', launder: 0.4, developable: true,
  },
  {
    id: 'restaurant', name: 'Restaurant chain', cat: 'business', fromYear: 1765, eraNames: [[1900, 'Eating house']],
    price: [300000, 900000], yield: 0.12, appreciation: 0.02, volatility: 0.12, upkeep: 0.04,
    acquire: 'Build / franchise', income: 'Scales with locations and management', risk: 'Food safety scandal, competition', launder: 0.25, developable: true,
  },
  {
    id: 'drugFront', name: 'Front business', cat: 'criminal', fromYear: 1900, eraNames: [[1950, 'Laundry front'], [99999, 'Car wash front']],
    price: [150000, 450000], yield: 0.05, appreciation: 0.01, volatility: 0.05, upkeep: 0.03,
    acquire: 'Criminal path only', income: 'Money laundering, drug income', risk: 'Police investigation, heat++', launder: 1.2, heat: 3,
    needs: { criminalRep: 25 },
  },
  {
    id: 'casino', name: 'Casino', cat: 'business', fromYear: 1638, eraNames: [[1930, 'Gambling house']],
    price: [5000000, 40000000], yield: 0.22, appreciation: 0.02, volatility: 0.15, upkeep: 0.05,
    acquire: 'Buy (requires license or criminal rep)', income: 'Massive cash flow', risk: 'Mafia competition, gambling debts', launder: 0.5,
    needs: { license: true },
  },
  {
    id: 'privateIsland', name: 'Private island', cat: 'luxury', fromYear: 1700,
    price: [15000000, 90000000], yield: 0, appreciation: 0.02, volatility: 0.05, upkeep: 0, fixedCost: 1200000,
    acquire: 'Extreme wealth only', income: 'None (luxury)', risk: 'Costs $1M+/yr maintenance',
  },
  {
    id: 'territory', name: 'Political territory', cat: 'political', fromYear: -800,
    price: [0, 0], yield: 0, appreciation: 0, volatility: 0, upkeep: 0,
    acquire: 'Career gate only (monarch / governor)', income: 'Tax income from population', risk: 'Rebellion, invasion, economic collapse', notForSale: true,
  },
  {
    id: 'techStartup', name: 'Tech startup', cat: 'business', fromYear: 1970,
    price: [100000, 2000000], yield: 0, appreciation: 0, volatility: 0, upkeep: 0.25,
    acquire: 'Tech skills + capital', income: 'Equity (massive upside, long wait)', risk: 'Failure rate 90%',
    needs: { skills: { programming: 25 } },
  },
  {
    id: 'mediaCompany', name: 'Media company', cat: 'business', fromYear: 1700, eraNames: [[1900, 'Printing house & gazette'], [1950, 'Newspaper & radio group'], [1995, 'TV network'], [99999, 'Digital media group']],
    price: [5000000, 50000000], yield: 0.08, appreciation: 0.02, volatility: 0.12, upkeep: 0.03,
    acquire: 'Fame 60+, capital', income: 'Influence + income', risk: 'Censorship, political attacks',
    needs: { fame: 60 },
  },
  {
    id: 'armsManufacturing', name: 'Arms manufacturer', cat: 'business', fromYear: 1850,
    price: [10000000, 60000000], yield: 0.1, appreciation: 0.02, volatility: 0.2, upkeep: 0.03,
    acquire: 'Military or criminal connection', income: 'War-era bonuses', risk: 'International sanctions, war-crimes exposure',
  },
  {
    id: 'crypto', name: 'Crypto holdings', cat: 'investment', fromYear: 2010,
    price: [1000, 1000], yield: 0, appreciation: 0.15, volatility: 0.8, upkeep: 0,
    acquire: 'Modern era only — buy any amount', income: 'Volatile: ±80% per year', risk: 'Exchange collapses, hacks',
  },
  {
    id: 'stocks', name: 'Stock portfolio', cat: 'investment', fromYear: 1700,
    price: [1000, 1000], yield: 0.02, appreciation: 0.06, volatility: 0.18, upkeep: 0.002,
    acquire: 'Buy any amount', income: 'Dividends + market growth', risk: 'Crashes track the world economy',
  },
  {
    id: 'familyEstate', name: 'Family estate', cat: 'property', fromYear: -800,
    price: [2000000, 2000000], yield: 0.03, appreciation: 0.03, volatility: 0.04, upkeep: 0.01,
    acquire: 'Dynasty milestone (generation 5)', income: 'Persistent across generations', risk: 'Inheritance disputes', notForSale: true,
  },
];

export const ASSET_BY_ID: Record<string, AssetDef> = Object.fromEntries(ASSETS.map((a) => [a.id, a]));

export function assetName(def: AssetDef, year: number): string {
  if (def.eraNames) for (const [until, n] of def.eraNames) if (year <= until) return n;
  return def.name;
}
