export interface CrimeDef {
  id: string;
  name: string;
  fromYear: number;
  toYear?: number;
  minAge: number;
  /** Evidence generated before skill/luck adjustments. */
  evidence: number;
  severity: number;
  sentence: [number, number];
  federal?: boolean;
  violent?: boolean;
  physical?: boolean;
  karma: number;
  sin: number;
  heat: number;
  payout: [number, number];
  skill?: string;
  /** Chance the crime succeeds before skill bonuses. */
  success: number;
  capital?: boolean;
}

export const CRIMES: CrimeDef[] = [
  { id: 'shoplift', name: 'Shoplifting', fromYear: -800, minAge: 8, evidence: 25, severity: 1, sentence: [0, 1], karma: -2, sin: 1, heat: 3, payout: [20, 300], skill: 'shoplifting', success: 0.7 },
  { id: 'pickpocket', name: 'Pickpocketing', fromYear: -800, minAge: 8, evidence: 20, severity: 1, sentence: [0, 1], karma: -3, sin: 1, heat: 3, payout: [10, 600], skill: 'pickpocketing', success: 0.6 },
  { id: 'vandalism', name: 'Vandalism', fromYear: -800, minAge: 10, evidence: 20, severity: 1, sentence: [0, 1], karma: -2, sin: 1, heat: 2, payout: [0, 0], success: 0.85 },
  { id: 'carTheft', name: 'Car theft', fromYear: 1910, minAge: 13, evidence: 35, severity: 3, sentence: [1, 4], karma: -4, sin: 2, heat: 8, payout: [2000, 15000], skill: 'carTheft', success: 0.55 },
  { id: 'burglary', name: 'Burglary', fromYear: -800, minAge: 12, evidence: 40, severity: 3, sentence: [1, 6], karma: -5, sin: 2, heat: 8, payout: [500, 20000], skill: 'burglary', success: 0.55 },
  { id: 'assault', name: 'Assault', fromYear: -800, minAge: 10, evidence: 45, severity: 3, sentence: [0, 4], violent: true, karma: -6, sin: 3, heat: 8, payout: [0, 0], skill: 'streetFighting', success: 0.7 },
  { id: 'armedRobbery', name: 'Armed robbery', fromYear: -800, minAge: 15, evidence: 50, severity: 5, sentence: [4, 12], violent: true, karma: -10, sin: 4, heat: 15, payout: [1000, 40000], skill: 'intimidation', success: 0.5 },
  { id: 'bankRobbery', name: 'Bank robbery', fromYear: 1800, minAge: 18, evidence: 60, severity: 7, sentence: [8, 20], federal: true, violent: true, karma: -12, sin: 5, heat: 25, payout: [50000, 600000], skill: 'heistPlanning', success: 0.35 },
  { id: 'fraud', name: 'Fraud', fromYear: -800, minAge: 16, evidence: 35, severity: 4, sentence: [1, 8], karma: -6, sin: 3, heat: 6, payout: [5000, 120000], skill: 'fraud', success: 0.55 },
  { id: 'embezzlement', name: 'Embezzlement', fromYear: -800, minAge: 18, evidence: 40, severity: 5, sentence: [2, 10], federal: true, karma: -6, sin: 3, heat: 6, payout: [20000, 400000], skill: 'accounting', success: 0.5 },
  { id: 'cyberFraud', name: 'Ransomware / bank fraud', fromYear: 1995, minAge: 14, evidence: 30, severity: 5, sentence: [2, 12], federal: true, karma: -6, sin: 3, heat: 8, payout: [10000, 900000], skill: 'hacking', success: 0.45 },
  { id: 'identityTheft', name: 'Identity theft', fromYear: 1970, minAge: 14, evidence: 30, severity: 3, sentence: [1, 6], federal: true, karma: -5, sin: 2, heat: 5, payout: [2000, 50000], skill: 'identityTheft', success: 0.55 },
  { id: 'drugPossession', name: 'Drug possession', fromYear: 1914, minAge: 12, evidence: 30, severity: 1, sentence: [0, 2], karma: 0, sin: 1, heat: 3, payout: [0, 0], success: 1 },
  { id: 'arson', name: 'Arson', fromYear: -800, minAge: 12, evidence: 45, severity: 6, sentence: [3, 15], violent: true, physical: true, karma: -10, sin: 4, heat: 15, payout: [0, 0], success: 0.7 },
  { id: 'extortion', name: 'Extortion', fromYear: -800, minAge: 16, evidence: 40, severity: 5, sentence: [2, 10], karma: -8, sin: 3, heat: 10, payout: [5000, 80000], skill: 'extortion', success: 0.55 },
  { id: 'briberyOfficial', name: 'Bribing an official', fromYear: -800, minAge: 18, evidence: 30, severity: 4, sentence: [1, 6], federal: true, karma: -4, sin: 2, heat: 4, payout: [0, 0], skill: 'bribery', success: 0.6 },
  { id: 'taxEvasion', name: 'Tax evasion', fromYear: 1800, minAge: 18, evidence: 30, severity: 4, sentence: [1, 6], federal: true, karma: -3, sin: 1, heat: 4, payout: [0, 0], skill: 'accounting', success: 0.6 },
  { id: 'smuggling', name: 'Smuggling', fromYear: -800, minAge: 15, evidence: 40, severity: 5, sentence: [2, 12], federal: true, karma: -4, sin: 2, heat: 10, payout: [5000, 120000], skill: 'borderSmuggling', success: 0.5 },
  { id: 'counterfeiting', name: 'Counterfeiting', fromYear: 1600, minAge: 16, evidence: 40, severity: 5, sentence: [3, 12], federal: true, karma: -4, sin: 2, heat: 8, payout: [5000, 100000], skill: 'counterfeiting', success: 0.5 },
  { id: 'drugDealing', name: 'Drug dealing', fromYear: 1914, minAge: 13, evidence: 40, severity: 4, sentence: [2, 10], karma: -5, sin: 2, heat: 10, payout: [1000, 30000], skill: 'drugDistribution', success: 0.65 },
  { id: 'weaponsTrafficking', name: 'Weapons trafficking', fromYear: 1850, minAge: 18, evidence: 45, severity: 7, sentence: [5, 20], federal: true, karma: -10, sin: 4, heat: 16, payout: [20000, 400000], skill: 'armsDealing', success: 0.45 },
  { id: 'moneyLaundering', name: 'Money laundering', fromYear: 1920, minAge: 18, evidence: 35, severity: 5, sentence: [2, 12], federal: true, karma: -3, sin: 1, heat: 6, payout: [0, 0], skill: 'moneyLaundering', success: 0.7 },
  { id: 'witnessIntimidation', name: 'Witness intimidation', fromYear: -800, minAge: 16, evidence: 35, severity: 5, sentence: [2, 8], violent: true, karma: -8, sin: 3, heat: 8, payout: [0, 0], skill: 'intimidation', success: 0.6 },
  { id: 'murder', name: 'Murder', fromYear: -800, minAge: 12, evidence: 65, severity: 10, sentence: [20, 60], violent: true, physical: true, karma: -40, sin: 20, heat: 35, payout: [0, 0], skill: 'assassinationTechnique', success: 0.75, capital: true },
  { id: 'prisonEscape', name: 'Prison escape', fromYear: -800, minAge: 12, evidence: 90, severity: 4, sentence: [2, 5], karma: -2, sin: 1, heat: 30, payout: [0, 0], success: 0.2 },
];

export const CRIME_BY_ID: Record<string, CrimeDef> = Object.fromEntries(CRIMES.map((c) => [c.id, c]));

export interface DrugDef {
  id: string;
  name: string;
  fromYear: number;
  toYear?: number;
  /** Street price per unit in modern dollars. */
  price: number;
  risk: number;
  addiction: 'stimulants' | 'opioids' | 'alcohol' | null;
  eraName?: [number, string][];
}

/** Six drug types with supply chains. */
export const DRUGS: DrugDef[] = [
  { id: 'cannabis', name: 'Cannabis', fromYear: 1900, price: 10, risk: 0.6, addiction: null },
  { id: 'cocaine', name: 'Cocaine', fromYear: 1890, price: 80, risk: 1.3, addiction: 'stimulants' },
  { id: 'heroin', name: 'Heroin', fromYear: -800, price: 100, risk: 1.5, addiction: 'opioids', eraName: [[1898, 'Opium']] },
  { id: 'meth', name: 'Methamphetamine', fromYear: 1950, price: 60, risk: 1.3, addiction: 'stimulants' },
  { id: 'mdma', name: 'MDMA', fromYear: 1985, price: 25, risk: 0.9, addiction: null },
  { id: 'liquor', name: 'Bootleg liquor', fromYear: -800, price: 15, risk: 0.8, addiction: 'alcohol' },
];

export const DRUG_BY_ID: Record<string, DrugDef> = Object.fromEntries(DRUGS.map((d) => [d.id, d]));

export interface SupplyStage {
  id: string;
  name: string;
  margin: number;
  risk: number;
  skill: string;
  baseIncome: number;
}

export const SUPPLY_STAGES: SupplyStage[] = [
  { id: 'production', name: 'Production', margin: 0.2, risk: 0.6, skill: 'drugManufacturing', baseIncome: 40000 },
  { id: 'transport', name: 'Transport', margin: 0.35, risk: 1.2, skill: 'borderSmuggling', baseIncome: 70000 },
  { id: 'distribution', name: 'Distribution', margin: 0.3, risk: 0.9, skill: 'cartelLogistics', baseIncome: 60000 },
  { id: 'street', name: 'Street sales', margin: 0.5, risk: 1.0, skill: 'drugDistribution', baseIncome: 25000 },
];

export interface OpKind {
  id: string;
  name: string;
  fromYear: number;
  products: { id: string; name: string; karma: number; mult: number; fromYear?: number }[];
  skill: string;
  baseIncome: number;
  risk: number;
  minRank: number;
  desc: string;
}

export const OPS: OpKind[] = [
  {
    id: 'weapons', name: 'Weapons trafficking', fromYear: 1850, skill: 'armsDealing', baseIncome: 120000, risk: 1.4, minRank: 2,
    desc: 'Source from corrupt militaries, supply rebels and gangs. War creates demand; embargoes create margin.',
    products: [{ id: 'smallArms', name: 'Small arms to gangs', karma: -6, mult: 1 }, { id: 'rebels', name: 'Rifles to rebel groups', karma: -8, mult: 1.6 }, { id: 'embargo', name: 'Embargo-busting shipments', karma: -10, mult: 2.4 }],
  },
  {
    id: 'cyber', name: 'Cybercrime', fromYear: 1995, skill: 'hacking', baseIncome: 90000, risk: 0.8, minRank: 0,
    desc: 'Ransomware, bank fraud, identity theft, corporate espionage, crypto theft, deepfakes.',
    products: [
      { id: 'ransomware', name: 'Ransomware campaign', karma: -6, mult: 1.4 },
      { id: 'bankFraud', name: 'Bank fraud', karma: -4, mult: 1 },
      { id: 'idTheft', name: 'Identity theft ring', karma: -4, mult: 0.7 },
      { id: 'espionage', name: 'Corporate espionage', karma: -3, mult: 1.3 },
      { id: 'cryptoTheft', name: 'Crypto exchange theft', karma: -4, mult: 2, fromYear: 2013 },
      { id: 'deepfakes', name: 'Deepfake extortion', karma: -7, mult: 1.2, fromYear: 2018 },
    ],
  },
  {
    id: 'smuggling', name: 'Smuggling network', fromYear: -800, skill: 'borderSmuggling', baseIncome: 70000, risk: 1, minRank: 1,
    desc: 'Every border has a price. Humanitarian smuggling pays little but saves lives.',
    products: [
      { id: 'refugees', name: 'Humanitarian refugee crossings', karma: 6, mult: 0.3 },
      { id: 'art', name: 'Stolen art', karma: -3, mult: 1.2 },
      { id: 'animals', name: 'Endangered animals', karma: -8, mult: 0.9 },
      { id: 'diamonds', name: 'Blood diamonds', karma: -9, mult: 1.6 },
      { id: 'nuclear', name: 'Nuclear materials', karma: -25, mult: 8, fromYear: 1960 },
    ],
  },
  {
    id: 'extortion', name: 'Protection racket', fromYear: -800, skill: 'extortion', baseIncome: 50000, risk: 0.9, minRank: 1,
    desc: 'Shops pay you so nothing happens to their windows.',
    products: [{ id: 'shops', name: 'Neighborhood shops', karma: -5, mult: 1 }, { id: 'docks', name: 'Docks and unions', karma: -6, mult: 1.6 }],
  },
  {
    id: 'gambling', name: 'Illegal gambling', fromYear: -800, skill: 'racketeering', baseIncome: 60000, risk: 0.7, minRank: 1,
    desc: 'Card rooms, numbers rackets and fixed fights.',
    products: [{ id: 'numbers', name: 'Numbers racket', karma: -3, mult: 1 }, { id: 'fixedFights', name: 'Fixed fights', karma: -4, mult: 1.4 }],
  },
];

export const OP_BY_ID: Record<string, OpKind> = Object.fromEntries(OPS.map((o) => [o.id, o]));

/** Criminal organization hierarchy, street level to global syndicate. */
export const ORG_RANKS = ['Street level', 'Mid level', 'Underboss', 'Boss', 'Crime family head', 'Cartel leader', 'Global syndicate head'];

export const PRISON_TIERS: { id: string; name: string; escape: number; violence: number; desc: string }[] = [
  { id: 'county', name: 'County jail', escape: 0.25, violence: 0.1, desc: 'Short stays and awaiting trial.' },
  { id: 'state', name: 'State prison', escape: 0.15, violence: 0.2, desc: 'Gangs run the yard.' },
  { id: 'federal', name: 'Federal prison', escape: 0.1, violence: 0.12, desc: 'White-collar wings and cartel lieutenants.' },
  { id: 'supermax', name: 'Supermax', escape: 0.02, violence: 0.3, desc: '23 hours a day in a concrete box.' },
  { id: 'deathRow', name: 'Death row', escape: 0.01, violence: 0.15, desc: 'Appeals are all that stand between you and execution.' },
];

export const PRISON_GANGS = ['the Brotherhood', 'the Kings', 'La Familia', 'the Syndicate', 'the Disciples', 'the Old Guard'];
