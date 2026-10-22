import type { EraId, TechEra } from '../types';

export interface EraDef {
  id: EraId;
  name: string;
  from: number;
  to: number;
  /** Feeds the life-expectancy formula's country modifier. */
  lifespanModifier: number;
  /** Probability that a newborn dies in infancy. */
  infantMortality: number;
  careerGates: string;
  keyEvents: string;
}

export const ERAS: EraDef[] = [
  {
    id: 'ancient',
    name: 'Ancient',
    from: -800,
    to: 499,
    lifespanModifier: -22,
    infantMortality: 0.25,
    careerGates: 'Warrior, Gladiator, Senator, Emperor, Philosopher, Scribe',
    keyEvents: 'Empire expansion, plague, barbarian invasions, religious conversions',
  },
  {
    id: 'medieval',
    name: 'Medieval',
    from: 500,
    to: 1399,
    lifespanModifier: -20,
    infantMortality: 0.22,
    careerGates: 'Knight, Serf, Lord, King, Bishop, Merchant, Guild assassin',
    keyEvents: 'Crusades, Black Death, feudal wars, Inquisition, peasant revolts',
  },
  {
    id: 'renaissance',
    name: 'Renaissance',
    from: 1400,
    to: 1699,
    lifespanModifier: -17,
    infantMortality: 0.2,
    careerGates: 'Explorer, Merchant prince, Artist, Scientist, Inquisitor, Privateer',
    keyEvents: 'Age of Discovery, Reformation, witch trials, colonialism',
  },
  {
    id: 'industrial',
    name: 'Industrial',
    from: 1700,
    to: 1899,
    lifespanModifier: -12,
    infantMortality: 0.15,
    careerGates: 'Factory owner, Worker organizer, Robber baron, Outlaw, Railroad tycoon, Suffragette',
    keyEvents: 'Revolutions, abolition of slavery, industrial accidents, colonial wars',
  },
  {
    id: 'modernEarly',
    name: 'Early modern',
    from: 1900,
    to: 1949,
    lifespanModifier: -6,
    infantMortality: 0.07,
    careerGates: 'Bootlegger, War profiteer, Resistance fighter, Radio host',
    keyEvents: 'World Wars, Prohibition, Great Depression, the Holocaust, the atomic bomb',
  },
  {
    id: 'coldWar',
    name: 'Cold War',
    from: 1950,
    to: 1989,
    lifespanModifier: -2,
    infantMortality: 0.03,
    careerGates: 'Spy, Nuclear scientist, Civil rights activist, Cult leader, Drug kingpin',
    keyEvents: 'Korea and Vietnam, the space race, social revolutions, drug wars, the Berlin Wall',
  },
  {
    id: 'digital',
    name: 'Digital age',
    from: 1990,
    to: 2009,
    lifespanModifier: 0,
    infantMortality: 0.01,
    careerGates: 'Tech entrepreneur, Hacker, Reality TV star',
    keyEvents: 'Gulf War, 9/11, the dot-com crash, the 2008 financial crisis',
  },
  {
    id: 'socialMedia',
    name: 'Social media era',
    from: 2010,
    to: 2024,
    lifespanModifier: 1,
    infantMortality: 0.006,
    careerGates: 'Influencer, Crypto trader, Content creator, Controversy commentator',
    keyEvents: 'Arab Spring, COVID-19, crypto boom and bust, polarization, AI emergence',
  },
  {
    id: 'nearFuture',
    name: 'Near future',
    from: 2025,
    to: 2300,
    lifespanModifier: 3,
    infantMortality: 0.004,
    careerGates: 'AI trainer, Biotech engineer, Climate refugee coordinator, Space colonist',
    keyEvents: 'AI disruption, climate crisis, autonomous weapons, genetic engineering',
  },
];

export function eraOf(year: number): EraDef {
  return ERAS.find((e) => year >= e.from && year <= e.to) ?? (year < ERAS[0].from ? ERAS[0] : ERAS[ERAS.length - 1]);
}

export function techEraOf(year: number): TechEra {
  if (year < 1760) return 'preIndustrial';
  if (year < 1945) return 'industrial';
  if (year < 1955) return 'postWar';
  if (year < 1990) return 'coldWar';
  if (year < 2010) return 'digital';
  if (year < 2027) return 'socialMedia';
  return 'ai';
}

export const TECH_ERA_NAMES: Record<TechEra, string> = {
  preIndustrial: 'Pre-industrial',
  industrial: 'Industrial',
  postWar: 'Post-war',
  coldWar: 'Cold War',
  digital: 'Digital',
  socialMedia: 'Social media',
  ai: 'AI era',
};

export interface MediaEra {
  id: string;
  name: string;
  outlets: string[];
  /** How fast scandals spread (multiplier on story volume). */
  spread: number;
  /** How hard it is to repair a reputation (multiplier on recovery cost). */
  repair: number;
}

export function mediaEraOf(year: number): MediaEra {
  if (year < 1450) return { id: 'oral', name: 'Word of mouth', outlets: ['Town crier', 'Market gossip', 'Tavern talk'], spread: 0.3, repair: 0.6 };
  if (year < 1900) return { id: 'print', name: 'Pamphlets & broadsheets', outlets: ['Broadsheet', 'Pamphlet', 'Town crier', 'Gazette'], spread: 0.5, repair: 0.8 };
  if (year < 1950) return { id: 'radio', name: 'Newspapers & radio', outlets: ['The Daily Herald', 'Evening Standard', 'National Radio', 'Newsreel'], spread: 0.8, repair: 1 };
  if (year < 1990) return { id: 'tv', name: 'TV & tabloids', outlets: ['Network News', 'The Sunday Tabloid', 'Late-night TV', 'Morning Paper'], spread: 1, repair: 1.1 };
  if (year < 2010) return { id: 'web', name: 'Internet news', outlets: ['Online news portal', 'Celebrity blog', 'Cable news', 'Forum threads'], spread: 1.4, repair: 1.3 };
  return { id: 'social', name: 'Social media', outlets: ['X/Twitter', 'TikTok', 'Instagram', 'Podcast circuit', 'YouTube commentary'], spread: 2, repair: 1.6 };
}
