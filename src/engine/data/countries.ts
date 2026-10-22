import type { Regime } from '../types';

export type Culture =
  | 'anglo'
  | 'french'
  | 'german'
  | 'italian'
  | 'latin'
  | 'spanish'
  | 'portuguese'
  | 'slavic'
  | 'chinese'
  | 'japanese'
  | 'indian'
  | 'arabic'
  | 'persian'
  | 'greek'
  | 'yoruba'
  | 'southAfrican';

export interface CountryDef {
  id: string;
  /** [untilYear, name] pairs; the last entry applies to all later years. */
  names: [number, string][];
  availableFrom: number;
  culture: Culture;
  /** Culture override for early eras, e.g. Latin names in Roman Italy. */
  earlyCulture?: [number, Culture];
  /** Baseline economic opportunity 0..100 in the modern era. */
  economy: number;
  stability: number;
  lifespanModifier: number;
  legalSystem: 'commonLaw' | 'civilLaw' | 'religiousLaw' | 'mixed' | 'customary';
  /** Countries extradite only within the same bloc. */
  bloc: 'west' | 'east' | 'gulf' | 'south';
  deathPenalty: boolean;
  sentencing: number;
  judicialCorruption: number;
  taxHaven: boolean;
  /** Year recreational cannabis becomes legal, if ever. */
  cannabisFrom?: number;
  religions: [number, [string, number][]][];
  regimes: [number, Regime][];
}

export const COUNTRIES: CountryDef[] = [
  {
    id: 'us',
    names: [[1775, 'the Thirteen Colonies'], [99999, 'the United States']],
    availableFrom: 1607,
    culture: 'anglo',
    economy: 78,
    stability: 70,
    lifespanModifier: 0,
    legalSystem: 'commonLaw',
    bloc: 'west',
    deathPenalty: true,
    sentencing: 1.4,
    judicialCorruption: 15,
    taxHaven: false,
    cannabisFrom: 2014,
    religions: [[99999, [['christianity', 70], ['none', 22], ['judaism', 3], ['islam', 2], ['buddhism', 2], ['hinduism', 1]]]],
    regimes: [[1775, 'monarchy'], [99999, 'democracy']],
  },
  {
    id: 'gb',
    names: [[409, 'Roman Britannia'], [1706, 'the Kingdom of England'], [99999, 'the United Kingdom']],
    availableFrom: -500,
    culture: 'anglo',
    earlyCulture: [409, 'latin'],
    economy: 72,
    stability: 78,
    lifespanModifier: 1,
    legalSystem: 'commonLaw',
    bloc: 'west',
    deathPenalty: false,
    sentencing: 1,
    judicialCorruption: 10,
    taxHaven: false,
    religions: [[600, [['paganism', 80], ['christianity', 20]]], [1950, [['christianity', 90], ['none', 8], ['judaism', 2]]], [99999, [['christianity', 50], ['none', 40], ['islam', 6], ['hinduism', 2], ['judaism', 2]]]],
    regimes: [[1688, 'monarchy'], [99999, 'democracy']],
  },
  {
    id: 'fr',
    names: [[486, 'Roman Gaul'], [1791, 'the Kingdom of France'], [99999, 'France']],
    availableFrom: -500,
    culture: 'french',
    earlyCulture: [486, 'latin'],
    economy: 72,
    stability: 72,
    lifespanModifier: 2,
    legalSystem: 'civilLaw',
    bloc: 'west',
    deathPenalty: false,
    sentencing: 0.9,
    judicialCorruption: 12,
    taxHaven: false,
    religions: [[500, [['paganism', 60], ['christianity', 40]]], [1950, [['christianity', 92], ['none', 6], ['judaism', 2]]], [99999, [['christianity', 50], ['none', 38], ['islam', 9], ['judaism', 3]]]],
    regimes: [[1791, 'monarchy'], [1870, 'empire'], [99999, 'democracy']],
  },
  {
    id: 'de',
    names: [[961, 'Germania'], [1805, 'the Holy Roman Empire'], [1870, 'the German Confederation'], [99999, 'Germany']],
    availableFrom: -500,
    culture: 'german',
    economy: 76,
    stability: 74,
    lifespanModifier: 1,
    legalSystem: 'civilLaw',
    bloc: 'west',
    deathPenalty: false,
    sentencing: 0.8,
    judicialCorruption: 8,
    taxHaven: false,
    cannabisFrom: 2024,
    religions: [[700, [['paganism', 80], ['christianity', 20]]], [1950, [['christianity', 92], ['judaism', 4], ['none', 4]]], [99999, [['christianity', 52], ['none', 40], ['islam', 6], ['judaism', 2]]]],
    regimes: [[1918, 'empire'], [1932, 'democracy'], [1945, 'autocracy'], [99999, 'democracy']],
  },
  {
    id: 'it',
    names: [[-28, 'the Roman Republic'], [476, 'the Roman Empire'], [1860, 'the Italian States'], [99999, 'Italy']],
    availableFrom: -800,
    culture: 'italian',
    earlyCulture: [476, 'latin'],
    economy: 66,
    stability: 60,
    lifespanModifier: 3,
    legalSystem: 'civilLaw',
    bloc: 'west',
    deathPenalty: false,
    sentencing: 1,
    judicialCorruption: 25,
    taxHaven: false,
    religions: [[380, [['romanPaganism', 85], ['christianity', 10], ['judaism', 5]]], [1950, [['christianity', 96], ['judaism', 2], ['none', 2]]], [99999, [['christianity', 78], ['none', 18], ['islam', 4]]]],
    regimes: [[-28, 'democracy'], [476, 'empire'], [1860, 'monarchy'], [1922, 'monarchy'], [1945, 'autocracy'], [99999, 'democracy']],
  },
  {
    id: 'es',
    names: [[475, 'Roman Hispania'], [1478, 'the Crowns of Castile and Aragon'], [99999, 'Spain']],
    availableFrom: -500,
    culture: 'spanish',
    earlyCulture: [475, 'latin'],
    economy: 64,
    stability: 66,
    lifespanModifier: 3,
    legalSystem: 'civilLaw',
    bloc: 'west',
    deathPenalty: false,
    sentencing: 0.9,
    judicialCorruption: 18,
    taxHaven: false,
    religions: [[711, [['romanPaganism', 30], ['christianity', 70]]], [1492, [['christianity', 55], ['islam', 40], ['judaism', 5]]], [1980, [['christianity', 97], ['none', 3]]], [99999, [['christianity', 62], ['none', 34], ['islam', 4]]]],
    regimes: [[1936, 'monarchy'], [1975, 'autocracy'], [99999, 'democracy']],
  },
  {
    id: 'ru',
    names: [[1239, 'Kievan Rus'], [1546, 'the Grand Duchy of Moscow'], [1720, 'the Tsardom of Russia'], [1917, 'the Russian Empire'], [1991, 'the Soviet Union'], [99999, 'Russia']],
    availableFrom: 862,
    culture: 'slavic',
    economy: 50,
    stability: 50,
    lifespanModifier: -5,
    legalSystem: 'civilLaw',
    bloc: 'east',
    deathPenalty: false,
    sentencing: 1.3,
    judicialCorruption: 55,
    taxHaven: false,
    religions: [[988, [['paganism', 100]]], [1917, [['christianity', 95], ['islam', 5]]], [1991, [['none', 70], ['christianity', 25], ['islam', 5]]], [99999, [['christianity', 70], ['none', 20], ['islam', 10]]]],
    regimes: [[1917, 'monarchy'], [1991, 'autocracy'], [99999, 'autocracy']],
  },
  {
    id: 'cn',
    names: [[220, 'Han China'], [1911, 'Imperial China'], [1948, 'the Republic of China'], [99999, "the People's Republic of China"]],
    availableFrom: -800,
    culture: 'chinese',
    economy: 62,
    stability: 66,
    lifespanModifier: 0,
    legalSystem: 'civilLaw',
    bloc: 'east',
    deathPenalty: true,
    sentencing: 1.5,
    judicialCorruption: 40,
    taxHaven: false,
    religions: [[1949, [['folk', 50], ['buddhism', 40], ['none', 10]]], [99999, [['none', 70], ['buddhism', 18], ['folk', 8], ['christianity', 3], ['islam', 1]]]],
    regimes: [[1911, 'empire'], [1948, 'junta'], [99999, 'autocracy']],
  },
  {
    id: 'jp',
    names: [[1184, 'Yamato Japan'], [1867, 'Shogunate Japan'], [1946, 'the Empire of Japan'], [99999, 'Japan']],
    availableFrom: 300,
    culture: 'japanese',
    economy: 74,
    stability: 82,
    lifespanModifier: 5,
    legalSystem: 'civilLaw',
    bloc: 'west',
    deathPenalty: true,
    sentencing: 1.1,
    judicialCorruption: 8,
    taxHaven: false,
    religions: [[99999, [['shinto', 50], ['buddhism', 40], ['none', 8], ['christianity', 2]]]],
    regimes: [[1867, 'monarchy'], [1946, 'empire'], [99999, 'democracy']],
  },
  {
    id: 'in',
    names: [[184, 'the Maurya realms'], [1525, 'the Indian kingdoms'], [1857, 'Mughal India'], [1946, 'British India'], [99999, 'India']],
    availableFrom: -500,
    culture: 'indian',
    economy: 48,
    stability: 58,
    lifespanModifier: -3,
    legalSystem: 'commonLaw',
    bloc: 'south',
    deathPenalty: true,
    sentencing: 1.1,
    judicialCorruption: 40,
    taxHaven: false,
    religions: [[1200, [['hinduism', 75], ['buddhism', 25]]], [99999, [['hinduism', 79], ['islam', 15], ['christianity', 3], ['sikhism', 2], ['buddhism', 1]]]],
    regimes: [[1857, 'monarchy'], [1946, 'empire'], [99999, 'democracy']],
  },
  {
    id: 'br',
    names: [[1821, 'Colonial Brazil'], [1888, 'the Empire of Brazil'], [99999, 'Brazil']],
    availableFrom: 1500,
    culture: 'portuguese',
    economy: 50,
    stability: 52,
    lifespanModifier: -2,
    legalSystem: 'civilLaw',
    bloc: 'south',
    deathPenalty: false,
    sentencing: 1,
    judicialCorruption: 45,
    taxHaven: false,
    religions: [[99999, [['christianity', 88], ['none', 9], ['folk', 3]]]],
    regimes: [[1888, 'monarchy'], [1963, 'democracy'], [1984, 'junta'], [99999, 'democracy']],
  },
  {
    id: 'mx',
    names: [[1520, 'the Aztec Empire'], [1820, 'New Spain'], [99999, 'Mexico']],
    availableFrom: 1428,
    culture: 'spanish',
    economy: 50,
    stability: 45,
    lifespanModifier: -2,
    legalSystem: 'civilLaw',
    bloc: 'west',
    deathPenalty: false,
    sentencing: 1,
    judicialCorruption: 55,
    taxHaven: false,
    religions: [[1520, [['folk', 100]]], [99999, [['christianity', 90], ['none', 8], ['folk', 2]]]],
    regimes: [[1520, 'empire'], [1820, 'monarchy'], [99999, 'democracy']],
  },
  {
    id: 'co',
    names: [[1818, 'New Granada'], [99999, 'Colombia']],
    availableFrom: 1538,
    culture: 'spanish',
    economy: 44,
    stability: 40,
    lifespanModifier: -2,
    legalSystem: 'civilLaw',
    bloc: 'west',
    deathPenalty: false,
    sentencing: 1,
    judicialCorruption: 55,
    taxHaven: false,
    religions: [[99999, [['christianity', 92], ['none', 7], ['folk', 1]]]],
    regimes: [[1818, 'monarchy'], [99999, 'democracy']],
  },
  {
    id: 'ng',
    names: [[1899, 'the Oyo Empire'], [1959, 'Colonial Nigeria'], [99999, 'Nigeria']],
    availableFrom: 1400,
    culture: 'yoruba',
    economy: 35,
    stability: 38,
    lifespanModifier: -12,
    legalSystem: 'mixed',
    bloc: 'south',
    deathPenalty: true,
    sentencing: 1.1,
    judicialCorruption: 60,
    taxHaven: false,
    religions: [[1800, [['folk', 70], ['islam', 30]]], [99999, [['christianity', 46], ['islam', 50], ['folk', 4]]]],
    regimes: [[1899, 'monarchy'], [1959, 'empire'], [1998, 'junta'], [99999, 'democracy']],
  },
  {
    id: 'eg',
    names: [[-31, 'Ptolemaic Egypt'], [640, 'Roman Egypt'], [1916, 'Egypt under the sultans'], [99999, 'Egypt']],
    availableFrom: -800,
    culture: 'arabic',
    economy: 42,
    stability: 45,
    lifespanModifier: -5,
    legalSystem: 'mixed',
    bloc: 'gulf',
    deathPenalty: true,
    sentencing: 1.3,
    judicialCorruption: 50,
    taxHaven: false,
    religions: [[400, [['egyptianPaganism', 70], ['christianity', 30]]], [900, [['christianity', 60], ['islam', 40]]], [99999, [['islam', 90], ['christianity', 10]]]],
    regimes: [[1952, 'monarchy'], [99999, 'autocracy']],
  },
  {
    id: 'sa',
    names: [[1931, 'Arabia'], [99999, 'Saudi Arabia']],
    availableFrom: -800,
    culture: 'arabic',
    economy: 66,
    stability: 64,
    lifespanModifier: -1,
    legalSystem: 'religiousLaw',
    bloc: 'gulf',
    deathPenalty: true,
    sentencing: 1.8,
    judicialCorruption: 35,
    taxHaven: false,
    religions: [[620, [['paganism', 80], ['judaism', 10], ['christianity', 10]]], [99999, [['islam', 100]]]],
    regimes: [[99999, 'monarchy']],
  },
  {
    id: 'ir',
    names: [[650, 'Persia'], [1934, 'the Persian realm'], [99999, 'Iran']],
    availableFrom: -800,
    culture: 'persian',
    economy: 45,
    stability: 48,
    lifespanModifier: -2,
    legalSystem: 'religiousLaw',
    bloc: 'east',
    deathPenalty: true,
    sentencing: 1.6,
    judicialCorruption: 45,
    taxHaven: false,
    religions: [[650, [['zoroastrianism', 100]]], [99999, [['islam', 98], ['zoroastrianism', 1], ['christianity', 1]]]],
    regimes: [[1978, 'monarchy'], [99999, 'theocracy']],
  },
  {
    id: 'gr',
    names: [[-147, 'Ancient Greece'], [1452, 'Byzantine Greece'], [1829, 'Ottoman Greece'], [99999, 'Greece']],
    availableFrom: -800,
    culture: 'greek',
    economy: 52,
    stability: 58,
    lifespanModifier: 2,
    legalSystem: 'civilLaw',
    bloc: 'west',
    deathPenalty: false,
    sentencing: 0.9,
    judicialCorruption: 25,
    taxHaven: false,
    religions: [[400, [['greekPaganism', 90], ['christianity', 10]]], [99999, [['christianity', 92], ['none', 6], ['islam', 2]]]],
    regimes: [[-147, 'democracy'], [1829, 'empire'], [1973, 'monarchy'], [99999, 'democracy']],
  },
  {
    id: 'au',
    names: [[1900, 'the Colony of New South Wales'], [99999, 'Australia']],
    availableFrom: 1788,
    culture: 'anglo',
    economy: 76,
    stability: 82,
    lifespanModifier: 3,
    legalSystem: 'commonLaw',
    bloc: 'west',
    deathPenalty: false,
    sentencing: 1,
    judicialCorruption: 8,
    taxHaven: false,
    religions: [[99999, [['christianity', 55], ['none', 38], ['islam', 3], ['buddhism', 2], ['hinduism', 2]]]],
    regimes: [[1900, 'monarchy'], [99999, 'democracy']],
  },
  {
    id: 'ch',
    names: [[1797, 'the Old Swiss Confederacy'], [99999, 'Switzerland']],
    availableFrom: 1291,
    culture: 'german',
    economy: 86,
    stability: 92,
    lifespanModifier: 4,
    legalSystem: 'civilLaw',
    bloc: 'west',
    deathPenalty: false,
    sentencing: 0.7,
    judicialCorruption: 5,
    taxHaven: true,
    religions: [[99999, [['christianity', 65], ['none', 30], ['islam', 5]]]],
    regimes: [[99999, 'democracy']],
  },
  {
    id: 'za',
    names: [[1909, 'the Cape Colony'], [1960, 'the Union of South Africa'], [99999, 'South Africa']],
    availableFrom: 1652,
    culture: 'southAfrican',
    economy: 46,
    stability: 44,
    lifespanModifier: -8,
    legalSystem: 'mixed',
    bloc: 'south',
    deathPenalty: false,
    sentencing: 1.1,
    judicialCorruption: 40,
    taxHaven: false,
    religions: [[99999, [['christianity', 80], ['folk', 10], ['none', 8], ['islam', 2]]]],
    regimes: [[1909, 'empire'], [1993, 'autocracy'], [99999, 'democracy']],
  },
  {
    id: 'ky',
    names: [[99999, 'the Cayman Islands']],
    availableFrom: 1670,
    culture: 'anglo',
    economy: 80,
    stability: 85,
    lifespanModifier: 2,
    legalSystem: 'commonLaw',
    bloc: 'west',
    deathPenalty: false,
    sentencing: 1,
    judicialCorruption: 20,
    taxHaven: true,
    religions: [[99999, [['christianity', 85], ['none', 15]]]],
    regimes: [[99999, 'monarchy']],
  },
];

export const COUNTRY_BY_ID: Record<string, CountryDef> = Object.fromEntries(COUNTRIES.map((c) => [c.id, c]));

export function countryName(id: string, year: number): string {
  const c = COUNTRY_BY_ID[id];
  if (!c) return id;
  for (const [until, name] of c.names) if (year <= until) return name;
  return c.names[c.names.length - 1][1];
}

/** "the United States" -> "The United States" for sentence starts. */
export function countryNameCap(id: string, year: number): string {
  const n = countryName(id, year);
  return n.charAt(0).toUpperCase() + n.slice(1);
}

export function countriesAvailable(year: number): CountryDef[] {
  return COUNTRIES.filter((c) => c.availableFrom <= year);
}

export function cultureOf(id: string, year: number): Culture {
  const c = COUNTRY_BY_ID[id];
  if (c.earlyCulture && year <= c.earlyCulture[0]) return c.earlyCulture[1];
  return c.culture;
}

export function religionWeights(id: string, year: number): [string, number][] {
  const c = COUNTRY_BY_ID[id];
  for (const [until, w] of c.religions) if (year <= until) return w;
  return c.religions[c.religions.length - 1][1];
}

export function baseRegime(id: string, year: number): Regime {
  const c = COUNTRY_BY_ID[id];
  for (const [until, r] of c.regimes) if (year <= until) return r;
  return c.regimes[c.regimes.length - 1][1];
}

export function canExtradite(from: string, to: string): boolean {
  if (from === to) return true;
  return COUNTRY_BY_ID[from].bloc === COUNTRY_BY_ID[to].bloc;
}

export interface ReligionDef {
  id: string;
  name: string;
  adjective: string;
  clergy: string;
  institution: string;
  from: number;
  to?: number;
}

export const RELIGIONS: ReligionDef[] = [
  { id: 'christianity', name: 'Christianity', adjective: 'Christian', clergy: 'priest', institution: 'the Christian Church', from: 30 },
  { id: 'islam', name: 'Islam', adjective: 'Muslim', clergy: 'imam', institution: 'the Islamic clergy', from: 610 },
  { id: 'judaism', name: 'Judaism', adjective: 'Jewish', clergy: 'rabbi', institution: 'the rabbinate', from: -1200 },
  { id: 'hinduism', name: 'Hinduism', adjective: 'Hindu', clergy: 'pandit', institution: 'the temple councils', from: -1500 },
  { id: 'buddhism', name: 'Buddhism', adjective: 'Buddhist', clergy: 'monk', institution: 'the Sangha', from: -500 },
  { id: 'shinto', name: 'Shinto', adjective: 'Shinto', clergy: 'kannushi', institution: 'the shrine associations', from: -300 },
  { id: 'sikhism', name: 'Sikhism', adjective: 'Sikh', clergy: 'granthi', institution: 'the gurdwara committees', from: 1500 },
  { id: 'zoroastrianism', name: 'Zoroastrianism', adjective: 'Zoroastrian', clergy: 'mobed', institution: 'the fire temples', from: -1000 },
  { id: 'romanPaganism', name: 'Roman paganism', adjective: 'pagan', clergy: 'pontifex', institution: 'the Roman priesthood', from: -800, to: 500 },
  { id: 'greekPaganism', name: 'Greek paganism', adjective: 'pagan', clergy: 'oracle-priest', institution: 'the temple cults', from: -800, to: 500 },
  { id: 'egyptianPaganism', name: 'Egyptian religion', adjective: 'Egyptian', clergy: 'temple priest', institution: 'the temple priesthood', from: -3000, to: 500 },
  { id: 'paganism', name: 'Old folk paganism', adjective: 'pagan', clergy: 'druid', institution: 'the old groves', from: -3000 },
  { id: 'folk', name: 'Folk religion', adjective: 'traditional', clergy: 'elder', institution: 'the ancestral shrines', from: -3000 },
  { id: 'none', name: 'No religion', adjective: 'secular', clergy: 'none', institution: '', from: -3000 },
];

export const RELIGION_BY_ID: Record<string, ReligionDef> = Object.fromEntries(RELIGIONS.map((r) => [r.id, r]));
