import type { FamilyStatus, Gender } from '../types';
import type { StatId } from './stats';

export type CareerCat =
  | 'medical'
  | 'legal'
  | 'military'
  | 'lawEnforcement'
  | 'business'
  | 'tech'
  | 'science'
  | 'education'
  | 'creative'
  | 'entertainment'
  | 'sports'
  | 'trades'
  | 'service'
  | 'government'
  | 'politics'
  | 'religion'
  | 'criminal'
  | 'royalty'
  | 'frontier'
  | 'secret';

export type CareerTag =
  | 'criminal'
  | 'military'
  | 'political'
  | 'religious'
  | 'royal'
  | 'fame'
  | 'sports'
  | 'physical'
  | 'secret'
  | 'medical'
  | 'legal'
  | 'creative'
  | 'tech'
  | 'academic'
  | 'police'
  | 'manual'
  | 'business'
  | 'diplomatic';

export interface CareerBranch {
  at: number;
  name: string;
  desc: string;
  /** Titles for levels `at`..10. */
  ladder: string[];
  trains: string[];
  salaryMult: number;
  effects?: Partial<Record<StatId, number>>;
}

export interface CareerDef {
  id: string;
  name: string;
  cat: CareerCat;
  years: [number, number];
  desc: string;
  /** Any one of these completed programs qualifies. Omitted = no requirement. */
  edu?: string[];
  min?: Partial<Record<StatId, number>>;
  max?: Partial<Record<StatId, number>>;
  skills?: Record<string, number>;
  /** Any one of these past careers qualifies. */
  prior?: string[];
  minAge?: number;
  maxStartAge?: number;
  family?: FamilyStatus[];
  countries?: string[];
  minHeight?: number;
  maxHeight?: number;
  capital?: number;
  needsWar?: boolean;
  /** Not applied for: reached through succession, election or a secret path. */
  special?: 'succession' | 'election' | 'combo' | 'pact';
  /** Traditionally restricted to one gender while social norms are low. */
  trad?: Gender;
  salary: number;
  growth: number;
  ladder: string[];
  trains: string[];
  tags: CareerTag[];
  heat?: number;
  injury?: number;
  fame?: number;
  yearly?: Partial<Record<StatId, number>>;
  branch?: CareerBranch;
  combo?: string;
}

const trade = (n: string) => [`Apprentice ${n}`, `Journeyman ${n}`, n, `Skilled ${n}`, `Senior ${n}`, `Head ${n}`, `Master ${n}`, 'Workshop Owner', 'Guild Master', `Legendary ${n}`];
const art = (n: string) => [`Aspiring ${n}`, `Struggling ${n}`, `Working ${n}`, `Recognized ${n}`, `Acclaimed ${n}`, `Celebrated ${n}`, `Famous ${n}`, `Iconic ${n}`, `Master ${n}`, `Immortal ${n}`];

const MALE: Gender = 'male';

export const CAREERS: CareerDef[] = [
  // ------------------------------------------------------------------ Medical (8)
  {
    id: 'doctor', name: 'Physician', cat: 'medical', years: [1850, 99999], edu: ['medical'], min: { smarts: 60 }, trad: MALE,
    desc: 'Diagnose and treat patients. Long training, reliable prestige.',
    salary: 62000, growth: 1.2, tags: ['medical'], trains: ['medicine', 'biology', 'empathyListening'], yearly: { stress: 4, karma: 1 },
    ladder: ['Medical Intern', 'Resident', 'Junior Doctor', 'Physician', 'Senior Physician', 'Attending Physician', 'Consultant', 'Department Head', 'Chief of Medicine', 'Chief Medical Officer'],
    branch: { at: 6, name: 'Research medicine', desc: 'Leave the wards for the laboratory.', ladder: ['Clinical Researcher', 'Principal Investigator', 'Professor of Medicine', 'Institute Director', 'Nobel-tipped Pioneer'], trains: ['science', 'pharmacology'], salaryMult: 0.9, effects: { professionalRep: 6 } },
  },
  {
    id: 'surgeon', name: 'Surgeon', cat: 'medical', years: [1870, 99999], edu: ['medical'], min: { smarts: 70, dexterity: 55 }, trad: MALE,
    desc: 'High stakes, high pay, steady hands required.',
    salary: 75000, growth: 1.25, tags: ['medical'], trains: ['surgery', 'medicine'], yearly: { stress: 7 },
    ladder: ['Surgical Intern', 'Surgical Resident', 'Chief Resident', 'Junior Surgeon', 'Surgeon', 'Senior Surgeon', 'Attending Surgeon', 'Chief of Surgery', 'Renowned Surgeon', 'Pioneering Surgeon'],
    branch: { at: 7, name: 'Celebrity cosmetic practice', desc: 'Trade trauma wards for the rich and famous.', ladder: ['Cosmetic Surgeon', 'Surgeon to the Stars', 'Clinic Empire Owner', 'Beauty Mogul'], trains: ['surgery', 'branding'], salaryMult: 1.6, effects: { fame: 8, karma: -3 } },
  },
  {
    id: 'nurse', name: 'Nurse', cat: 'medical', years: [1860, 99999], edu: ['university', 'communityCollege'], trad: 'female',
    desc: 'The backbone of every hospital.',
    salary: 36000, growth: 1.12, tags: ['medical'], trains: ['medicine', 'empathyListening'], yearly: { stress: 4, karma: 2, empathy: 1 },
    ladder: ['Nursing Assistant', 'Student Nurse', 'Registered Nurse', 'Charge Nurse', 'Nurse Practitioner', 'Senior Practitioner', 'Nurse Manager', 'Director of Nursing', 'Chief Nursing Officer', 'Nursing Pioneer'],
  },
  {
    id: 'paramedic', name: 'Paramedic', cat: 'medical', years: [1960, 99999], edu: ['communityCollege', 'tradeSchool'], min: { fitness: 35 },
    desc: 'First on the scene when the worst happens.',
    salary: 34000, growth: 1.1, tags: ['medical', 'physical'], trains: ['medicine', 'selfDefense'], injury: 0.02, yearly: { stress: 5, trauma: 2, karma: 2 },
    ladder: ['EMT Trainee', 'EMT', 'Paramedic', 'Senior Paramedic', 'Flight Paramedic', 'Field Supervisor', 'Operations Manager', 'Deputy Chief', 'Chief of EMS', 'EMS Legend'],
  },
  {
    id: 'psychiatrist', name: 'Psychiatrist', cat: 'medical', years: [1900, 99999], edu: ['medical'], min: { smarts: 65 },
    desc: 'Treat the mind with medicine and talk.',
    salary: 80000, growth: 1.15, tags: ['medical'], trains: ['psychology', 'medicine', 'empathyListening'], yearly: { wisdom: 2 },
    ladder: ['Psychiatry Intern', 'Psychiatry Resident', 'Psychiatrist', 'Senior Psychiatrist', 'Clinic Lead', 'Consultant Psychiatrist', 'Hospital Director', 'Professor of Psychiatry', 'Leading Authority', 'Father/Mother of a School'],
  },
  {
    id: 'therapist', name: 'Therapist', cat: 'medical', years: [1920, 99999], edu: ['university'], min: { empathy: 45 },
    desc: 'Talk therapy, private practice, quiet good.',
    salary: 42000, growth: 1.12, tags: ['medical'], trains: ['psychology', 'empathyListening', 'conflictResolution'], yearly: { wisdom: 2, karma: 1 },
    ladder: ['Trainee Counselor', 'Counselor', 'Therapist', 'Licensed Therapist', 'Senior Therapist', 'Clinical Supervisor', 'Practice Owner', 'Bestselling Therapist', 'Renowned Therapist', 'Legendary Healer of Minds'],
  },
  {
    id: 'barberSurgeon', name: 'Barber-surgeon', cat: 'medical', years: [500, 1800], min: { dexterity: 35 },
    desc: 'Haircuts, bloodletting and amputations — all under one roof.',
    salary: 4000, growth: 1.15, tags: ['medical', 'manual'], trains: ['surgery', 'herbalism'], yearly: { stress: 2 },
    ladder: ['Barber Apprentice', 'Barber', 'Bloodletter', 'Barber-Surgeon', 'Master Barber-Surgeon', 'Army Surgeon', 'Guild Warden', 'Royal Barber', 'Surgeon to the King', 'Legendary Sawbones'],
  },
  {
    id: 'plagueDoctor', name: 'Plague doctor', cat: 'medical', years: [1300, 1720], min: { smarts: 40 },
    desc: 'Beaked mask, herbs and courage. Paid by the town when plague strikes.',
    salary: 9000, growth: 1.15, tags: ['medical'], trains: ['medicine', 'herbalism'], injury: 0.02, yearly: { trauma: 3, karma: 2, immunity: -2 },
    ladder: ['Plague Orderly', 'Plague Doctor', 'Town Plague Doctor', 'Senior Plague Doctor', 'City Physician', 'Pest-House Master', 'Physician to the Guilds', 'Royal Physician', 'Famed Plague Healer', 'Conqueror of Pestilence'],
  },

  // ------------------------------------------------------------------ Legal (4)
  {
    id: 'corporateLawyer', name: 'Corporate lawyer', cat: 'legal', years: [1800, 99999], edu: ['law'], min: { smarts: 60 }, trad: MALE,
    desc: 'Billable hours and boardrooms.',
    salary: 72000, growth: 1.25, tags: ['legal', 'business'], trains: ['law', 'negotiation', 'internationalLaw'], yearly: { stress: 5 },
    ladder: ['Law Clerk', 'Junior Associate', 'Associate', 'Senior Associate', 'Junior Partner', 'Partner', 'Senior Partner', 'Managing Partner', 'Name Partner', 'Legal Titan'],
  },
  {
    id: 'defenseAttorney', name: 'Defense attorney', cat: 'legal', years: [1850, 99999], edu: ['law'], min: { smarts: 55 },
    desc: 'Everyone deserves a defense. Some pay better than others.',
    salary: 52000, growth: 1.22, tags: ['legal'], trains: ['criminalLaw', 'persuasion', 'publicSpeaking'], yearly: { stress: 4 },
    ladder: ['Public Defender', 'Staff Attorney', 'Defense Attorney', 'Senior Defender', 'Trial Specialist', 'Partner', 'Star Litigator', 'Celebrity Defender', 'Dream Team Lead', 'Legend of the Bar'],
  },
  {
    id: 'prosecutor', name: 'Prosecutor', cat: 'legal', years: [1850, 99999], edu: ['law'], min: { smarts: 55 }, trad: MALE,
    desc: 'Put criminals away. A classic stepping stone into politics.',
    salary: 56000, growth: 1.18, tags: ['legal', 'political'], trains: ['criminalLaw', 'publicSpeaking', 'interrogation'], yearly: { stress: 4, politicalApproval: 1 },
    ladder: ['Assistant Prosecutor', 'Deputy DA', 'Prosecutor', 'Senior Prosecutor', 'Chief Deputy', 'District Attorney', 'State Attorney', 'Deputy Attorney General', 'Attorney General', 'Legendary Crusader'],
  },
  {
    id: 'judge', name: 'Judge', cat: 'legal', years: [1700, 99999], edu: ['law', 'university'], min: { smarts: 60, professionalRep: 35 }, minAge: 35, trad: MALE,
    desc: 'Rule from the bench. Bribes are offered, careers are made.',
    salary: 95000, growth: 1.12, tags: ['legal', 'political'], trains: ['law', 'criminalLaw', 'logic'], yearly: { wisdom: 2 },
    ladder: ['Magistrate', 'Municipal Judge', 'District Judge', 'Circuit Judge', 'Senior Judge', 'Appellate Judge', 'Chief Appellate Judge', 'High Court Justice', 'Supreme Court Justice', 'Chief Justice'],
  },

  // ------------------------------------------------------------------ Military (6)
  {
    id: 'soldier', name: 'Soldier', cat: 'military', years: [-800, 99999], min: { fitness: 35 }, minAge: 17, maxStartAge: 35, trad: MALE,
    desc: 'Enlist. Peacetime pays steady; war pays in scars.',
    salary: 26000, growth: 1.1, tags: ['military', 'physical'], trains: ['weaponsTraining', 'selfDefense', 'teamwork'], injury: 0.03, yearly: { discipline: 2, fitness: 2 },
    ladder: ['Recruit', 'Private', 'Corporal', 'Sergeant', 'Staff Sergeant', 'Sergeant First Class', 'Master Sergeant', 'Sergeant Major', 'Command Sergeant Major', 'War Hero'],
  },
  {
    id: 'militaryOfficer', name: 'Military officer', cat: 'military', years: [1700, 99999], edu: ['militaryAcademy', 'university'], min: { fitness: 40, smarts: 50 }, minAge: 20, trad: MALE,
    desc: 'Command troops. Generals start coups.',
    salary: 40000, growth: 1.18, tags: ['military', 'political'], trains: ['militaryStrategy', 'leadership', 'tacticalShooting'], injury: 0.015, yearly: { discipline: 2 },
    ladder: ['Second Lieutenant', 'First Lieutenant', 'Captain', 'Major', 'Lieutenant Colonel', 'Colonel', 'Brigadier General', 'Major General', 'General', 'Field Marshal'],
  },
  {
    id: 'specialForces', name: 'Special forces operator', cat: 'military', years: [1940, 99999], min: { fitness: 70, smarts: 50, willpower: 50 }, prior: ['soldier', 'militaryOfficer'], maxStartAge: 32, trad: MALE,
    desc: 'The tip of the spear. Requires prior service.',
    salary: 52000, growth: 1.15, tags: ['military', 'physical'], trains: ['tacticalShooting', 'hostageRescue', 'martialArts'], injury: 0.06, yearly: { trauma: 3, fitness: 2 },
    ladder: ['Selection Candidate', 'Operator', 'Senior Operator', 'Team Sergeant', 'Assault Team Leader', 'Troop Commander', 'Squadron Commander', 'Unit Commander', 'Special Operations Chief', 'Ghost Legend'],
  },
  {
    id: 'fighterPilot', name: 'Fighter pilot', cat: 'military', years: [1915, 99999], edu: ['militaryAcademy'], min: { fitness: 55, smarts: 60, dexterity: 55 }, maxStartAge: 30, trad: MALE,
    desc: 'Top of the class, top of the sky.',
    salary: 50000, growth: 1.15, tags: ['military'], trains: ['tacticalShooting', 'militaryStrategy'], injury: 0.03, yearly: { mania: 1, confidence: 2 },
    ladder: ['Flight Cadet', 'Pilot Officer', 'Wingman', 'Flight Lead', 'Ace', 'Squadron Leader', 'Wing Commander', 'Group Captain', 'Air Marshal', 'Legendary Ace'],
  },
  {
    id: 'knight', name: 'Knight', cat: 'military', years: [800, 1550], family: ['aristocracy', 'royalty', 'wealthy'], min: { fitness: 45 }, trad: MALE,
    desc: 'Sworn sword of a lord. Tournaments, crusades, chivalry.',
    salary: 15000, growth: 1.2, tags: ['military', 'physical'], trains: ['swordsmanship', 'horsemanship', 'cavalryTactics'], injury: 0.05, yearly: { faith: 1, fitness: 2 },
    ladder: ['Page', 'Squire', 'Knight Bachelor', 'Knight', 'Knight Banneret', 'Knight Commander', 'Baron', 'Lord Marshal', 'Grand Master', 'Legendary Paladin'],
  },
  {
    id: 'warrior', name: 'Warrior', cat: 'military', years: [-800, 1100], min: { fitness: 40 }, trad: MALE,
    desc: 'Spear, shield and glory in the old wars.',
    salary: 5000, growth: 1.2, tags: ['military', 'physical'], trains: ['swordsmanship', 'streetFighting', 'archery'], injury: 0.06, yearly: { aggression: 2, fitness: 2 },
    ladder: ['Spear-bearer', 'Shieldman', 'Warrior', 'Veteran', 'Champion', 'Captain', 'War-chief', 'Warlord', 'High Warlord', 'Hero of Song'],
  },

  // ------------------------------------------------------------------ Law & order (6)
  {
    id: 'policeOfficer', name: 'Police officer', cat: 'lawEnforcement', years: [1830, 99999], edu: ['secondary'], min: { fitness: 30 }, trad: MALE,
    desc: 'Patrol, arrests and the occasional bribe envelope.',
    salary: 38000, growth: 1.12, tags: ['police', 'physical'], trains: ['selfDefense', 'tacticalShooting', 'interrogation'], injury: 0.02, yearly: { stress: 4 },
    ladder: ['Cadet', 'Patrol Officer', 'Senior Officer', 'Sergeant', 'Lieutenant', 'Captain', 'Major', 'Deputy Chief', 'Chief of Police', 'Commissioner'],
    branch: { at: 5, name: 'Internal affairs', desc: 'Police the police. Few friends, many enemies.', ladder: ['IA Investigator', 'IA Lieutenant', 'IA Captain', 'Head of Internal Affairs', 'Inspector General', 'Incorruptible Legend'], trains: ['interrogation', 'law'], salaryMult: 1.05, effects: { karma: 3, paranoia: 3 } },
  },
  {
    id: 'detective', name: 'Detective', cat: 'lawEnforcement', years: [1850, 99999], prior: ['policeOfficer'], min: { smarts: 55 },
    desc: 'Homicide, vice, cold cases.',
    salary: 52000, growth: 1.14, tags: ['police'], trains: ['interrogation', 'psychology', 'logic'], yearly: { stress: 5, paranoia: 1 },
    ladder: ['Detective Trainee', 'Detective', 'Detective Second Grade', 'Detective First Grade', 'Senior Detective', 'Detective Sergeant', 'Detective Lieutenant', 'Head of Homicide', 'Chief of Detectives', 'Legendary Sleuth'],
  },
  {
    id: 'federalAgent', name: 'Federal agent', cat: 'lawEnforcement', years: [1910, 99999], edu: ['university', 'law'], min: { smarts: 60, fitness: 40 },
    desc: 'National crimes, national stakes.',
    salary: 60000, growth: 1.15, tags: ['police'], trains: ['interrogation', 'tacticalShooting', 'cybersecurity'], yearly: { stress: 4 },
    ladder: ['Trainee Agent', 'Special Agent', 'Senior Special Agent', 'Supervisory Agent', 'Assistant Agent in Charge', 'Special Agent in Charge', 'Section Chief', 'Assistant Director', 'Deputy Director', 'Director'],
  },
  {
    id: 'spy', name: 'Intelligence officer', cat: 'lawEnforcement', years: [1920, 99999], edu: ['university'], min: { smarts: 65, charisma: 50 },
    desc: 'Lies for your country. Trust no one.',
    salary: 64000, growth: 1.16, tags: ['police', 'political', 'diplomatic'], trains: ['deception', 'languages', 'disguise', 'interrogation'], yearly: { paranoia: 3, stress: 3 },
    ladder: ['Analyst', 'Field Trainee', 'Field Officer', 'Case Officer', 'Senior Case Officer', 'Station Chief', 'Division Chief', 'Deputy Director of Operations', 'Spymaster', 'Shadow Legend'],
  },
  {
    id: 'inquisitor', name: 'Inquisitor', cat: 'lawEnforcement', years: [1230, 1834], edu: ['seminary', 'university'], min: { faith: 60 }, countries: ['es', 'it', 'fr', 'de', 'mx', 'co'], trad: MALE,
    desc: 'Root out heresy. Your conscience is your own business.',
    salary: 12000, growth: 1.2, tags: ['religious', 'police'], trains: ['theology', 'interrogation', 'intimidation'], yearly: { sin: 3, fear: 3, karma: -2 },
    ladder: ['Notary of the Holy Office', 'Familiar', 'Assistant Inquisitor', 'Inquisitor', 'Senior Inquisitor', 'Tribunal Prosecutor', 'Chief Inquisitor', 'Inquisitor of the Realm', 'Grand Inquisitor', 'Dread Grand Inquisitor'],
  },
  {
    id: 'firefighter', name: 'Firefighter', cat: 'lawEnforcement', years: [1850, 99999], min: { fitness: 50 },
    desc: 'Run into burning buildings for a living.',
    salary: 40000, growth: 1.11, tags: ['physical'], trains: ['teamwork', 'strengthTraining'], injury: 0.03, yearly: { karma: 2, publicImage: 1, stress: 3 },
    ladder: ['Probationary Firefighter', 'Firefighter', 'Engineer', 'Senior Firefighter', 'Lieutenant', 'Captain', 'Battalion Chief', 'Deputy Chief', 'Fire Chief', 'Fire Commissioner'],
  },

  // ------------------------------------------------------------------ Business (10)
  {
    id: 'accountant', name: 'Accountant', cat: 'business', years: [1880, 99999], edu: ['university'], min: { smarts: 50 },
    desc: 'Balance books — or cook them.',
    salary: 48000, growth: 1.14, tags: ['business'], trains: ['accounting', 'bookkeeping', 'auditing'], yearly: { stress: 2 },
    ladder: ['Junior Bookkeeper', 'Staff Accountant', 'Accountant', 'Senior Accountant', 'Audit Manager', 'Controller', 'Finance Director', 'Partner', 'Chief Financial Officer', 'Legendary Number-Cruncher'],
  },
  {
    id: 'banker', name: 'Banker', cat: 'business', years: [1400, 99999], edu: ['university', 'mba'], min: { smarts: 55 }, trad: MALE,
    desc: 'Lend, invest, and launder (allegedly).',
    salary: 58000, growth: 1.22, tags: ['business'], trains: ['investing', 'economics', 'negotiation'], yearly: { stress: 4, karma: -1 },
    ladder: ['Teller', 'Loan Officer', 'Analyst', 'Associate', 'Vice President', 'Director', 'Managing Director', 'Head of Investment Banking', 'Bank President', 'Banking Dynast'],
  },
  {
    id: 'corporateExecutive', name: 'Corporate executive', cat: 'business', years: [1900, 99999], edu: ['mba', 'university'], min: { smarts: 50, charisma: 45 }, minAge: 21, trad: MALE,
    desc: 'Climb the corporate ladder to the corner office.',
    salary: 55000, growth: 1.28, tags: ['business'], trains: ['management', 'executiveLeadership', 'corporateStrategy'], yearly: { stress: 5, ego: 1 },
    ladder: ['Management Trainee', 'Analyst', 'Manager', 'Senior Manager', 'Director', 'Senior Director', 'Vice President', 'Senior VP', 'Chief Operating Officer', 'Chief Executive Officer'],
  },
  {
    id: 'hedgeFundManager', name: 'Hedge fund manager', cat: 'business', years: [1970, 99999], edu: ['mba'], min: { smarts: 70 },
    desc: 'Two and twenty. Make it rain or blow up.',
    salary: 110000, growth: 1.35, tags: ['business'], trains: ['hedgeFundStrategy', 'stockTrading', 'economics'], yearly: { stress: 7, ego: 2, mania: 1 },
    ladder: ['Junior Analyst', 'Analyst', 'Senior Analyst', 'Portfolio Manager', 'Senior PM', 'Partner', 'Chief Investment Officer', 'Fund Founder', 'Billionaire Manager', 'Market God'],
  },
  {
    id: 'cryptoTrader', name: 'Crypto trader', cat: 'business', years: [2010, 99999], min: { riskTolerance: 45 },
    desc: 'Volatility is a feature. Wealth can triple or vanish each year.',
    salary: 30000, growth: 1.3, tags: ['business', 'tech'], trains: ['cryptoTrading', 'blockchain'], yearly: { stress: 6, mania: 2 },
    ladder: ['Retail Degen', 'Day Trader', 'Swing Trader', 'Whale-in-training', 'Fund Trader', 'Desk Lead', 'Fund Partner', 'Crypto Whale', 'Protocol Founder', 'Crypto Legend'],
  },
  {
    id: 'merchant', name: 'Merchant', cat: 'business', years: [-800, 1900],
    desc: 'Buy low, sell high, travel far.',
    salary: 6000, growth: 1.25, tags: ['business'], trains: ['sales', 'negotiation', 'logistics'], yearly: { stress: 2 },
    ladder: ['Peddler', 'Market Trader', 'Merchant', 'Shop Owner', 'Trading House Partner', 'Master Merchant', 'Guild Merchant', 'Merchant Lord', 'Trade Magnate', 'Legendary Merchant'],
  },
  {
    id: 'merchantPrince', name: 'Merchant prince', cat: 'business', years: [1350, 1750], family: ['wealthy', 'aristocracy'], capital: 30000, countries: ['it', 'es', 'gb', 'fr', 'de', 'ch'],
    desc: 'Banking dynasties, trade fleets, patronage of artists.',
    salary: 40000, growth: 1.3, tags: ['business', 'political'], trains: ['investing', 'diplomacy', 'logistics'], yearly: { fame: 1, corruption: 1 },
    ladder: ['Heir to the Counting House', 'Factor', 'Partner', 'Head of House', 'Banker to Princes', 'Patron of the Arts', 'Merchant Prince', 'Lord of Commerce', 'Kingmaker', 'Medici-like Legend'],
  },
  {
    id: 'robberBaron', name: 'Robber baron', cat: 'business', years: [1850, 1930], skills: { entrepreneurship: 30 }, capital: 50000, countries: ['us', 'gb', 'de', 'au'],
    desc: 'Railroads, steel, oil — and crushed unions.',
    salary: 60000, growth: 1.35, tags: ['business', 'political'], trains: ['corporateStrategy', 'intimidation', 'propertyDevelopment'], yearly: { karma: -3, corruption: 2, fame: 1 },
    ladder: ['Speculator', 'Company Founder', 'Industrialist', 'Rail Magnate', 'Trust Builder', 'Monopolist', 'Captain of Industry', 'Titan', 'Robber Baron', 'Gilded Age Legend'],
  },
  {
    id: 'factoryOwner', name: 'Factory owner', cat: 'business', years: [1760, 1960], capital: 25000,
    desc: 'Smokestacks and shift whistles. Workers may organize.',
    salary: 30000, growth: 1.25, tags: ['business'], trains: ['management', 'mechanics', 'supplyChain'], yearly: { stress: 3, karma: -1 },
    ladder: ['Workshop Proprietor', 'Mill Owner', 'Factory Owner', 'Manufacturer', 'Industrial Employer', 'Multi-plant Owner', 'Manufacturing Magnate', 'Industrial Baron', 'Tycoon', 'Industrial Dynast'],
  },
  {
    id: 'warProfiteer', name: 'War profiteer', cat: 'business', years: [1900, 1955], needsWar: true, capital: 15000, skills: { negotiation: 20 },
    desc: 'Supply both sides. Only available while your country is at war.',
    salary: 50000, growth: 1.35, tags: ['business', 'criminal'], trains: ['armsDealing', 'logistics', 'negotiation'], heat: 3, yearly: { karma: -4, sin: 2 },
    ladder: ['Supplier', 'Contractor', 'Quartermaster Partner', 'Munitions Broker', 'Army Contractor', 'Arms Magnate', 'Shadow Supplier', 'Merchant of Death', 'Kingmaker of Wars', 'Infamous Profiteer'],
  },

  // ------------------------------------------------------------------ Tech (5)
  {
    id: 'softwareEngineer', name: 'Software engineer', cat: 'tech', years: [1960, 99999], edu: ['university', 'online', 'communityCollege'], skills: { programming: 15 },
    desc: 'Ship code. Equity might be worth something one day.',
    salary: 68000, growth: 1.2, tags: ['tech'], trains: ['programming', 'appDevelopment', 'webDevelopment'], yearly: { stress: 3 },
    ladder: ['Intern', 'Junior Developer', 'Software Engineer', 'Senior Engineer', 'Staff Engineer', 'Principal Engineer', 'Engineering Manager', 'Director of Engineering', 'VP of Engineering', 'Chief Technology Officer'],
    branch: { at: 5, name: 'Founder track', desc: 'Leave to build a startup. Pay drops, upside explodes.', ladder: ['Startup Founder', 'Funded Founder', 'Series B CEO', 'Unicorn Founder', 'Tech Titan', 'Visionary Billionaire'], trains: ['entrepreneurship', 'ventureCapital'], salaryMult: 0.8, effects: { riskTolerance: 4, fame: 4 } },
  },
  {
    id: 'gameDeveloper', name: 'Game developer', cat: 'tech', years: [1975, 99999], edu: ['university', 'online'], skills: { programming: 10 },
    desc: 'Crunch, launches and the occasional cult hit.',
    salary: 55000, growth: 1.17, tags: ['tech', 'creative'], trains: ['gameDesign', 'programming', 'art'], yearly: { stress: 4, creativity: 1 },
    ladder: ['QA Tester', 'Junior Developer', 'Game Developer', 'Senior Developer', 'Lead Designer', 'Creative Director', 'Studio Head', 'Industry Veteran', 'Auteur Designer', 'Gaming Legend'],
  },
  {
    id: 'cybersecurityAnalyst', name: 'Cybersecurity analyst', cat: 'tech', years: [1995, 99999], edu: ['university', 'online'], skills: { programming: 15 },
    desc: 'Catch hackers — or learn exactly how they work.',
    salary: 70000, growth: 1.18, tags: ['tech'], trains: ['cybersecurity', 'penetrationTesting', 'hacking'], yearly: { paranoia: 1 },
    ladder: ['SOC Analyst', 'Security Analyst', 'Security Engineer', 'Senior Security Engineer', 'Penetration Tester', 'Red Team Lead', 'Security Architect', 'Director of Security', 'Chief Information Security Officer', 'Cyber Legend'],
  },
  {
    id: 'aiResearcher', name: 'AI researcher', cat: 'tech', years: [2012, 99999], edu: ['phd'], min: { smarts: 75 },
    desc: 'Build the minds that may replace everyone else.',
    salary: 140000, growth: 1.22, tags: ['tech', 'academic'], trains: ['aiDevelopment', 'machineLearning', 'mathematics'], yearly: { stress: 3 },
    ladder: ['Research Intern', 'Research Engineer', 'Research Scientist', 'Senior Research Scientist', 'Staff Scientist', 'Research Lead', 'Lab Director', 'Chief Scientist', 'AI Pioneer', 'Architect of Minds'],
  },
  {
    id: 'aiTrainer', name: 'AI trainer', cat: 'tech', years: [2025, 99999], edu: ['secondary', 'university', 'online'],
    desc: 'Teach models taste. The near future runs on this job.',
    salary: 45000, growth: 1.15, tags: ['tech'], trains: ['aiDevelopment', 'writing', 'logic'],
    ladder: ['Data Labeler', 'AI Trainer', 'Senior Trainer', 'Domain Expert Trainer', 'Evaluation Lead', 'Alignment Specialist', 'Training Program Manager', 'Head of Model Behavior', 'Chief Alignment Officer', 'Shepherd of Machines'],
  },

  // ------------------------------------------------------------------ Science & academia (8)
  {
    id: 'scientist', name: 'Scientist', cat: 'science', years: [1700, 99999], edu: ['university', 'phd'], min: { smarts: 65 }, trad: MALE,
    desc: 'Grants, papers and the occasional breakthrough.',
    salary: 52000, growth: 1.15, tags: ['academic'], trains: ['science', 'physics', 'chemistry'], yearly: { wisdom: 1 },
    ladder: ['Lab Assistant', 'Research Assistant', 'Junior Scientist', 'Scientist', 'Senior Scientist', 'Principal Investigator', 'Lab Director', 'Institute Director', 'Nobel Laureate', 'Scientific Immortal'],
  },
  {
    id: 'professor', name: 'Professor', cat: 'science', years: [1100, 99999], edu: ['phd', 'university'], min: { smarts: 65 }, trad: MALE,
    desc: 'Tenure, lectures and academic feuds.',
    salary: 50000, growth: 1.13, tags: ['academic'], trains: ['philosophy', 'mentoring', 'publicSpeaking'], yearly: { wisdom: 2 },
    ladder: ['Teaching Assistant', 'Lecturer', 'Assistant Professor', 'Associate Professor', 'Professor', 'Department Chair', 'Dean', 'Provost', 'University President', 'Emeritus Legend'],
  },
  {
    id: 'astronaut', name: 'Astronaut', cat: 'science', years: [1961, 99999], edu: ['university', 'militaryAcademy', 'phd'], min: { smarts: 75, fitness: 65 }, maxStartAge: 45, trad: MALE,
    desc: 'Leave the planet. Become a household name.',
    salary: 80000, growth: 1.12, tags: ['academic', 'fame'], trains: ['physics', 'engineering', 'teamwork'], fame: 6, injury: 0.01,
    ladder: ['Astronaut Candidate', 'Astronaut', 'Mission Specialist', 'Flight Engineer', 'Pilot', 'Mission Commander', 'Station Commander', 'Chief Astronaut', 'Space Agency Director', 'Hero of Space'],
  },
  {
    id: 'nuclearScientist', name: 'Nuclear scientist', cat: 'science', years: [1942, 99999], edu: ['phd'], min: { smarts: 75 },
    desc: 'Power plants and bombs. Spies will come knocking.',
    salary: 85000, growth: 1.15, tags: ['academic'], trains: ['physics', 'engineering', 'mathematics'], yearly: { paranoia: 1 },
    ladder: ['Research Fellow', 'Physicist', 'Reactor Physicist', 'Senior Physicist', 'Program Lead', 'Lab Division Head', 'Lab Director', 'National Science Advisor', 'Father/Mother of the Bomb', 'Atomic Legend'],
  },
  {
    id: 'biotechEngineer', name: 'Biotech engineer', cat: 'science', years: [2025, 99999], edu: ['university', 'phd'], min: { smarts: 65 },
    desc: 'Edit genes, grow organs, ask forgiveness later.',
    salary: 90000, growth: 1.2, tags: ['academic', 'tech'], trains: ['biology', 'chemistry', 'pharmacology'],
    ladder: ['Lab Technician', 'Bioengineer', 'Gene Editor', 'Senior Bioengineer', 'Program Lead', 'Head of Synthetic Biology', 'Chief Science Officer', 'Biotech Founder', 'Longevity Pioneer', 'Architect of Life'],
  },
  {
    id: 'philosopher', name: 'Philosopher', cat: 'science', years: [-600, 99999], min: { smarts: 60 },
    desc: 'Question everything; get paid occasionally.',
    salary: 8000, growth: 1.2, tags: ['academic'], trains: ['philosophy', 'logic', 'publicSpeaking'], yearly: { wisdom: 3 },
    ladder: ['Student of Wisdom', 'Wandering Thinker', 'Philosopher', 'Teacher of Philosophy', 'Head of a Circle', 'Court Philosopher', 'Founder of a School', 'Sage', 'Great Philosopher', 'Immortal Thinker'],
  },
  {
    id: 'alchemist', name: 'Alchemist', cat: 'science', years: [700, 1750], min: { smarts: 50 },
    desc: 'Transmute lead, brew elixirs, flirt with heresy.',
    salary: 7000, growth: 1.2, tags: ['academic'], trains: ['chemistry', 'mysticism', 'herbalism'], injury: 0.02, yearly: { paranormal: 1 },
    ladder: ['Apprentice Alchemist', 'Alchemist', 'Adept', 'Distiller of Essences', 'Master Alchemist', 'Court Alchemist', 'Keeper of Secrets', 'Philosopher of Fire', 'Seeker of the Stone', 'Legendary Magus'],
  },
  {
    id: 'scribe', name: 'Scribe', cat: 'science', years: [-800, 1600], min: { smarts: 45 },
    desc: 'Literacy is power in an illiterate world.',
    salary: 4000, growth: 1.18, tags: ['academic'], trains: ['literacy', 'writing', 'languages'], yearly: { wisdom: 1 },
    ladder: ['Copyist', 'Scribe', 'Senior Scribe', 'Notary', 'Clerk of the Court', 'Royal Scribe', 'Keeper of Records', 'Chancellor\'s Secretary', 'Royal Chancellor', 'Legendary Chronicler'],
  },

  // ------------------------------------------------------------------ Education (1)
  {
    id: 'teacher', name: 'Teacher', cat: 'education', years: [1800, 99999], edu: ['university'],
    desc: 'Shape young minds. Summers off, budgets never.',
    salary: 38000, growth: 1.1, tags: ['academic'], trains: ['mentoring', 'publicSpeaking', 'literacy'], yearly: { karma: 1, stress: 3 },
    ladder: ['Student Teacher', 'Substitute Teacher', 'Teacher', 'Senior Teacher', 'Head of Department', 'Vice Principal', 'Principal', 'District Superintendent', 'Education Commissioner', 'Beloved Educator'],
  },

  // ------------------------------------------------------------------ Creative (7)
  {
    id: 'painter', name: 'Painter', cat: 'creative', years: [-800, 99999],
    desc: 'Starve now, be priceless after death.',
    salary: 9000, growth: 1.3, tags: ['creative', 'fame'], trains: ['painting', 'art'], fame: 2, yearly: { creativity: 2 },
    ladder: art('Painter'),
    branch: { at: 6, name: 'Court patronage', desc: 'Paint for kings and popes. Comfort over freedom.', ladder: ['Court Painter', 'Painter to the Crown', 'Royal Academician', 'Master of the Royal Academy', 'Old Master'], trains: ['painting', 'etiquette'], salaryMult: 1.5 },
  },
  {
    id: 'musician', name: 'Musician', cat: 'creative', years: [-800, 99999], skills: { music: 10 },
    desc: 'Gigs, tours, maybe a record deal.',
    salary: 12000, growth: 1.35, tags: ['creative', 'fame'], trains: ['instrumentMastery', 'composition', 'music'], fame: 3, yearly: { creativity: 2 },
    ladder: ['Busker', 'Session Player', 'Gigging Musician', 'Signed Artist', 'Touring Musician', 'Charting Artist', 'Headliner', 'Superstar', 'Icon', 'Rock & Roll Immortal'],
  },
  {
    id: 'singer', name: 'Pop singer', cat: 'creative', years: [1900, 99999], skills: { singing: 15 },
    desc: 'Voice, image, label politics.',
    salary: 14000, growth: 1.4, tags: ['creative', 'fame'], trains: ['singing', 'vocalPerformance', 'dance'], fame: 5, yearly: { ego: 1 },
    ladder: ['Open-mic Singer', 'Backup Singer', 'Lounge Singer', 'Signed Singer', 'Rising Star', 'Chart-topper', 'Pop Star', 'Global Superstar', 'Pop Royalty', 'Pop Legend'],
  },
  {
    id: 'writer', name: 'Writer', cat: 'creative', years: [-800, 99999], skills: { writing: 15 },
    desc: 'Novels, memoirs, screenplays — the long game.',
    salary: 9000, growth: 1.3, tags: ['creative', 'fame'], trains: ['writing', 'poetry', 'screenwriting'], fame: 2, yearly: { wisdom: 1, creativity: 1 },
    ladder: ['Aspiring Writer', 'Freelancer', 'Published Author', 'Midlist Author', 'Acclaimed Author', 'Bestselling Author', 'Award-winning Author', 'Literary Giant', 'Nobel Laureate', 'Immortal of Letters'],
  },
  {
    id: 'bard', name: 'Bard', cat: 'creative', years: [500, 1650], skills: { music: 10 },
    desc: 'Sing the deeds of lords for bread and wine.',
    salary: 3000, growth: 1.25, tags: ['creative', 'fame'], trains: ['music', 'poetry', 'humor'], fame: 2,
    ladder: ['Wandering Minstrel', 'Tavern Singer', 'Bard', 'Troubadour', 'Court Minstrel', 'Master Bard', 'Bard of the Realm', 'Royal Poet', 'Laureate', 'Voice of the Age'],
  },
  {
    id: 'fashionDesigner', name: 'Fashion designer', cat: 'creative', years: [1850, 99999], skills: { tailoring: 15 },
    desc: 'Runways, collections, eponymous labels.',
    salary: 30000, growth: 1.3, tags: ['creative', 'fame'], trains: ['fashionDesign', 'tailoring', 'branding'], fame: 2,
    ladder: ['Design Intern', 'Assistant Designer', 'Designer', 'Senior Designer', 'Head Designer', 'Creative Director', 'Label Founder', 'Fashion House Head', 'Fashion Icon', 'Legend of Couture'],
  },
  {
    id: 'chef', name: 'Chef', cat: 'creative', years: [1700, 99999], skills: { cooking: 10 },
    desc: 'Kitchens are brutal. Stars are forever.',
    salary: 30000, growth: 1.2, tags: ['creative', 'manual'], trains: ['cooking', 'hauteCuisine', 'baking'], yearly: { stress: 4 },
    ladder: ['Dishwasher', 'Line Cook', 'Chef de Partie', 'Sous Chef', 'Head Chef', 'Executive Chef', 'Restaurateur', 'Starred Chef', 'Celebrity Chef', 'Culinary Legend'],
  },

  // ------------------------------------------------------------------ Entertainment & media (8)
  {
    id: 'actor', name: 'Actor', cat: 'entertainment', years: [-500, 99999], min: { looks: 30 },
    desc: 'Auditions, rejection, then maybe everything.',
    salary: 15000, growth: 1.4, tags: ['creative', 'fame'], trains: ['acting', 'methodActing', 'charm'], fame: 5, yearly: { ego: 1 },
    ladder: ['Extra', 'Bit-part Actor', 'Working Actor', 'Supporting Actor', 'Lead Actor', 'Leading Star', 'Award Nominee', 'A-list Star', 'Award Winner', 'Screen Legend'],
  },
  {
    id: 'filmDirector', name: 'Film director', cat: 'entertainment', years: [1900, 99999], skills: { cinematography: 15 },
    desc: 'Vision, budgets and egos to manage.',
    salary: 35000, growth: 1.35, tags: ['creative', 'fame'], trains: ['filmDirection', 'cinematography', 'leadership'], fame: 4,
    ladder: ['Production Assistant', 'Assistant Director', 'Indie Director', 'Feature Director', 'Studio Director', 'Acclaimed Director', 'Blockbuster Director', 'Auteur', 'Oscar Winner', 'Cinema Legend'],
  },
  {
    id: 'journalist', name: 'Journalist', cat: 'entertainment', years: [1700, 99999], edu: ['university', 'secondary'], min: { smarts: 50 },
    desc: 'Break stories, topple the powerful, receive threats.',
    salary: 32000, growth: 1.15, tags: ['fame'], trains: ['writing', 'interrogation', 'publicSpeaking'], fame: 2, yearly: { stress: 3 },
    ladder: ['Stringer', 'Cub Reporter', 'Reporter', 'Staff Writer', 'Senior Correspondent', 'Investigative Reporter', 'Bureau Chief', 'Editor', 'Editor-in-Chief', 'Media Legend'],
    branch: { at: 5, name: 'Broadcast anchor', desc: 'Go in front of the camera.', ladder: ['Field Correspondent', 'Weekend Anchor', 'Evening Anchor', 'Prime-time Anchor', 'Network Face', 'Most Trusted Voice'], trains: ['publicSpeaking', 'charm'], salaryMult: 1.4, effects: { fame: 6 } },
  },
  {
    id: 'influencer', name: 'Influencer', cat: 'entertainment', years: [2008, 99999], min: { looks: 45 },
    desc: 'Brand deals, follower counts, cancellation risk.',
    salary: 8000, growth: 1.55, tags: ['fame'], trains: ['branding', 'socialMediaManipulation', 'photography'], fame: 5, yearly: { ego: 2, anxiety: 1 },
    ladder: ['Nano-influencer', 'Micro-influencer', 'Rising Creator', 'Influencer', 'Brand Ambassador', 'Macro-influencer', 'Celebrity Influencer', 'Mega-influencer', 'Platform Icon', 'Internet Royalty'],
  },
  {
    id: 'contentCreator', name: 'Streamer & content creator', cat: 'entertainment', years: [2010, 99999],
    desc: 'Go live daily. The algorithm giveth and taketh.',
    salary: 6000, growth: 1.5, tags: ['fame', 'tech'], trains: ['humor', 'cinematography', 'branding'], fame: 4, yearly: { stress: 3, loneliness: 1 },
    ladder: ['Hobby Streamer', 'Affiliate', 'Partner', 'Full-time Creator', 'Rising Channel', 'Featured Creator', 'Top Streamer', 'Platform Star', 'Creator Mogul', 'Streaming Legend'],
  },
  {
    id: 'realityTvStar', name: 'Reality TV star', cat: 'entertainment', years: [1995, 99999], min: { looks: 55 }, maxStartAge: 40,
    desc: 'Manufactured drama, very real fame.',
    salary: 20000, growth: 1.4, tags: ['fame'], trains: ['acting', 'gossip', 'branding'], fame: 7, yearly: { ego: 2, publicImage: -1 },
    ladder: ['Contestant', 'Fan Favorite', 'Season Regular', 'Breakout Star', 'Spin-off Lead', 'Franchise Star', 'Talk-show Fixture', 'Reality Royalty', 'Household Name', 'Reality Legend'],
  },
  {
    id: 'model', name: 'Model', cat: 'entertainment', years: [1900, 99999], min: { looks: 72 }, minHeight: 170, maxStartAge: 28,
    desc: 'Height and looks gated. Short careers, big money.',
    salary: 25000, growth: 1.4, tags: ['fame'], trains: ['charm', 'branding', 'dance'], fame: 4, yearly: { anxiety: 2, ego: 1 },
    ladder: ['Catalog Model', 'Commercial Model', 'Fashion Model', 'Runway Model', 'Campaign Face', 'Cover Model', 'Supermodel', 'Brand Muse', 'Fashion Icon', 'Legendary Supermodel'],
  },
  {
    id: 'controversyCommentator', name: 'Controversy commentator', cat: 'entertainment', years: [2015, 99999], special: 'combo', combo: 'Survive a cancellation in the social media era.',
    desc: 'Turn your cancellation into a brand.',
    salary: 30000, growth: 1.4, tags: ['fame', 'secret'], trains: ['publicSpeaking', 'propaganda', 'branding'], fame: 4, yearly: { ego: 2, karma: -1, infamy: 1 },
    ladder: ['Cancelled Nobody', 'Podcast Guest', 'Podcaster', 'Contrarian Voice', 'Culture-war Pundit', 'Movement Figure', 'Bestselling Grievance Author', 'Media Empire Founder', 'Political Kingmaker', 'Cancel-proof Legend'],
  },

  // ------------------------------------------------------------------ Sports (6)
  {
    id: 'gladiator', name: 'Gladiator', cat: 'sports', years: [-264, 440], countries: ['it', 'gr', 'es', 'fr', 'gb', 'eg'], min: { fitness: 45 }, maxStartAge: 30,
    desc: 'Fight in the arena. The crowd decides your fate.',
    salary: 6000, growth: 1.35, tags: ['sports', 'physical', 'fame'], trains: ['swordsmanship', 'streetFighting', 'stageCombat'], injury: 0.12, fame: 5, yearly: { aggression: 2, trauma: 2 },
    ladder: ['Tiro', 'Novicius', 'Gladiator', 'Veteran', 'Crowd Favorite', 'Primus Palus', 'Champion of the Arena', 'Freed Champion', 'Lanista', 'Legend of the Colosseum'],
  },
  {
    id: 'footballer', name: 'Footballer', cat: 'sports', years: [1880, 99999], min: { fitness: 62 }, skills: { ballSports: 15 }, maxStartAge: 23,
    desc: 'Academy to Ballon d\'Or. Knees permitting.',
    salary: 30000, growth: 1.45, tags: ['sports', 'physical', 'fame'], trains: ['ballSports', 'football', 'running'], injury: 0.06, fame: 4,
    ladder: ['Academy Player', 'Reserve Player', 'First-team Squad', 'Starter', 'Club Star', 'International', 'Captain', 'Superstar', 'Ballon d\'Or Winner', 'GOAT Contender'],
  },
  {
    id: 'basketballPlayer', name: 'Basketball player', cat: 'sports', years: [1900, 99999], min: { fitness: 60 }, minHeight: 188, maxStartAge: 23,
    desc: 'Height-gated. Draft day changes everything.',
    salary: 40000, growth: 1.45, tags: ['sports', 'physical', 'fame'], trains: ['ballSports', 'basketball', 'running'], injury: 0.05, fame: 4,
    ladder: ['Prospect', 'Draft Pick', 'Rookie', 'Rotation Player', 'Starter', 'All-Star', 'Franchise Player', 'MVP', 'Champion', 'Hall of Famer'],
  },
  {
    id: 'boxer', name: 'Boxer', cat: 'sports', years: [1850, 99999], min: { fitness: 55 }, skills: { boxing: 15 }, maxStartAge: 28,
    desc: 'Glory and brain damage in equal measure.',
    salary: 15000, growth: 1.45, tags: ['sports', 'physical', 'fame'], trains: ['boxing', 'strengthTraining'], injury: 0.1, fame: 4, yearly: { aggression: 2 },
    ladder: ['Amateur', 'Golden Gloves', 'Pro Debutant', 'Journeyman', 'Contender', 'Ranked Contender', 'Title Challenger', 'World Champion', 'Undisputed Champion', 'Boxing Immortal'],
  },
  {
    id: 'mmaFighter', name: 'MMA fighter', cat: 'sports', years: [1995, 99999], min: { fitness: 60 }, skills: { mma: 15 }, maxStartAge: 30,
    desc: 'Every discipline, every risk.',
    salary: 18000, growth: 1.45, tags: ['sports', 'physical', 'fame'], trains: ['mma', 'grappling', 'martialArts'], injury: 0.1, fame: 4, yearly: { aggression: 2 },
    ladder: ['Amateur Fighter', 'Regional Pro', 'Prospect', 'Signed Fighter', 'Ranked Fighter', 'Top Contender', 'Champion', 'Two-division Champion', 'Pound-for-pound King', 'MMA Legend'],
  },
  {
    id: 'trackAthlete', name: 'Track athlete', cat: 'sports', years: [-776, 99999], min: { fitness: 60 }, skills: { running: 15 }, maxStartAge: 25,
    desc: 'Olympic dreams — ancient or modern.',
    salary: 15000, growth: 1.35, tags: ['sports', 'physical', 'fame'], trains: ['running', 'marathon', 'ultraEndurance'], injury: 0.04, fame: 3,
    ladder: ['Club Runner', 'Regional Champion', 'National Qualifier', 'National Champion', 'International Athlete', 'Medalist', 'Olympic Finalist', 'Olympic Champion', 'World Record Holder', 'Olympic Legend'],
  },

  // ------------------------------------------------------------------ Trades (9)
  {
    id: 'mechanic', name: 'Mechanic', cat: 'trades', years: [1890, 99999],
    desc: 'Grease, engines, honest money.',
    salary: 30000, growth: 1.12, tags: ['manual'], trains: ['mechanics', 'autoRepair'], injury: 0.01,
    ladder: trade('Mechanic'),
  },
  {
    id: 'constructionWorker', name: 'Construction worker', cat: 'trades', years: [-800, 99999], min: { fitness: 35 },
    desc: 'Build the world with your hands.',
    salary: 28000, growth: 1.12, tags: ['manual', 'physical'], trains: ['construction', 'carpentry', 'masonry'], injury: 0.03, yearly: { fitness: 1 },
    ladder: ['Laborer', 'Hod Carrier', 'Builder', 'Skilled Builder', 'Crew Lead', 'Site Foreman', 'Site Manager', 'Contractor', 'Construction Company Owner', 'Master Builder'],
  },
  {
    id: 'electrician', name: 'Electrician', cat: 'trades', years: [1890, 99999], edu: ['tradeSchool', 'apprenticeship'],
    desc: 'Licensed, in demand, occasionally shocked.',
    salary: 38000, growth: 1.13, tags: ['manual'], trains: ['electrical', 'electronicsRepair'], injury: 0.015,
    ladder: trade('Electrician'),
  },
  {
    id: 'blacksmith', name: 'Blacksmith', cat: 'trades', years: [-800, 1920], min: { fitness: 40 },
    desc: 'Every village needs a forge.',
    salary: 5000, growth: 1.18, tags: ['manual', 'physical'], trains: ['blacksmithing', 'metalworking'], injury: 0.02, yearly: { fitness: 1 },
    ladder: trade('Blacksmith'),
  },
  {
    id: 'farmer', name: 'Farmer', cat: 'trades', years: [-800, 99999],
    desc: 'Weather, harvests and the bank manager.',
    salary: 7000, growth: 1.2, tags: ['manual'], trains: ['farming', 'animalHusbandry'], injury: 0.01, yearly: { fitness: 1 },
    ladder: ['Farmhand', 'Tenant Farmer', 'Smallholder', 'Farmer', 'Prosperous Farmer', 'Landowner', 'Estate Farmer', 'Agribusiness Owner', 'Agricultural Baron', 'Land Dynast'],
  },
  {
    id: 'fisherman', name: 'Fisher', cat: 'trades', years: [-800, 99999],
    desc: 'The sea gives and the sea takes.',
    salary: 6000, growth: 1.18, tags: ['manual'], trains: ['fishing', 'sailing'], injury: 0.03,
    ladder: ['Deckhand', 'Fisher', 'Boat Hand', 'Boat Owner', 'Skipper', 'Fleet Captain', 'Fleet Owner', 'Harbor Master', 'Seafood Magnate', 'Old Salt of Legend'],
  },
  {
    id: 'miner', name: 'Miner', cat: 'trades', years: [-800, 99999], min: { fitness: 40 },
    desc: 'Dangerous work deep underground.',
    salary: 9000, growth: 1.15, tags: ['manual', 'physical'], trains: ['mining', 'strengthTraining'], injury: 0.05, yearly: { health: -1 },
    ladder: ['Mine Boy', 'Hewer', 'Miner', 'Experienced Miner', 'Shot Firer', 'Pit Deputy', 'Overman', 'Mine Manager', 'Mine Owner', 'Mining Baron'],
  },
  {
    id: 'factoryWorker', name: 'Factory worker', cat: 'trades', years: [1760, 99999],
    desc: 'Shift work. Unions are optional — for now.',
    salary: 22000, growth: 1.1, tags: ['manual'], trains: ['mechanics', 'teamwork'], injury: 0.03, yearly: { stress: 2 },
    ladder: ['Line Worker', 'Machine Operator', 'Skilled Operator', 'Senior Operator', 'Shift Lead', 'Line Supervisor', 'Floor Manager', 'Plant Manager', 'Regional Manager', 'Shop-floor Legend'],
  },
  {
    id: 'serf', name: 'Serf', cat: 'trades', years: [500, 1861], family: ['destitute', 'poor', 'working'], countries: ['gb', 'fr', 'de', 'ru', 'it', 'es'],
    desc: 'Bound to the land and your lord.',
    salary: 1500, growth: 1.15, tags: ['manual'], trains: ['farming', 'animalHusbandry'], injury: 0.02, yearly: { happiness: -1 },
    ladder: ['Cottar', 'Serf', 'Villein', 'Senior Villein', 'Reeve', 'Bailiff', 'Freeholder', 'Yeoman', 'Steward', 'Landed Freeman'],
  },

  // ------------------------------------------------------------------ Service & transport (6)
  {
    id: 'retailClerk', name: 'Retail clerk', cat: 'service', years: [1850, 99999],
    desc: 'Customers are always right. Mostly wrong.',
    salary: 22000, growth: 1.08, tags: [], trains: ['sales', 'etiquette'], yearly: { stress: 2 },
    ladder: ['Stock Clerk', 'Cashier', 'Sales Associate', 'Senior Associate', 'Shift Supervisor', 'Assistant Manager', 'Store Manager', 'District Manager', 'Regional Director', 'Retail Executive'],
  },
  {
    id: 'waiter', name: 'Waiter', cat: 'service', years: [1800, 99999],
    desc: 'Tips, regulars, and stories.',
    salary: 20000, growth: 1.08, tags: [], trains: ['charm', 'etiquette'], yearly: { stress: 2 },
    ladder: ['Busser', 'Server', 'Waiter', 'Senior Waiter', 'Head Waiter', 'Maître d\'', 'Restaurant Manager', 'General Manager', 'Hospitality Director', 'Legendary Host'],
  },
  {
    id: 'janitor', name: 'Janitor', cat: 'service', years: [1850, 99999],
    desc: 'Invisible, essential, overhearing everything.',
    salary: 21000, growth: 1.06, tags: ['manual'], trains: ['plumbing', 'mechanics'],
    ladder: ['Cleaner', 'Janitor', 'Custodian', 'Senior Custodian', 'Head Custodian', 'Facilities Supervisor', 'Facilities Manager', 'Director of Facilities', 'Cleaning Company Owner', 'Custodial Legend'],
  },
  {
    id: 'truckDriver', name: 'Truck driver', cat: 'service', years: [1920, 99999],
    desc: 'Long hauls, lonely roads, opportunities for "extra cargo".',
    salary: 36000, growth: 1.08, tags: ['manual'], trains: ['logistics', 'getawayDriving'], injury: 0.02, yearly: { loneliness: 2 },
    ladder: ['Delivery Driver', 'Trucker', 'Long-haul Trucker', 'Senior Driver', 'Owner-Operator', 'Fleet Lead', 'Dispatcher', 'Logistics Manager', 'Trucking Company Owner', 'King of the Road'],
  },
  {
    id: 'shipCaptain', name: 'Ship captain', cat: 'service', years: [-800, 99999], skills: { sailing: 25 },
    desc: 'Command a vessel. Cargo may be negotiable.',
    salary: 25000, growth: 1.18, tags: ['manual'], trains: ['sailing', 'leadership', 'logistics'], injury: 0.02,
    ladder: ['Cabin Hand', 'Able Seaman', 'Boatswain', 'Third Mate', 'Second Mate', 'First Mate', 'Captain', 'Senior Captain', 'Commodore', 'Legend of the Seas'],
  },
  {
    id: 'servant', name: 'Domestic servant', cat: 'service', years: [-800, 99999],
    desc: 'Serve a great household. Hear every secret.',
    salary: 3000, growth: 1.15, tags: [], trains: ['etiquette', 'cooking'], yearly: { happiness: -1 },
    ladder: ['Scullery Hand', 'Housemaid/Footman', 'Valet', 'Senior Servant', 'Head Housekeeper', 'Under-Butler', 'Butler', 'Steward of the House', 'Majordomo', 'Legendary Majordomo'],
  },

  // ------------------------------------------------------------------ Government (3)
  {
    id: 'civilServant', name: 'Civil servant', cat: 'government', years: [1850, 99999], edu: ['university', 'secondary'],
    desc: 'Pensions, procedures and power behind the throne.',
    salary: 38000, growth: 1.1, tags: ['political'], trains: ['law', 'management', 'economics'],
    ladder: ['Clerk', 'Administrative Officer', 'Executive Officer', 'Senior Officer', 'Principal', 'Assistant Secretary', 'Deputy Director', 'Director General', 'Permanent Secretary', 'Cabinet Secretary'],
  },
  {
    id: 'diplomat', name: 'Diplomat', cat: 'government', years: [1600, 99999], edu: ['university'], min: { charisma: 55, smarts: 55 },
    desc: 'Embassies, treaties and diplomatic immunity.',
    salary: 52000, growth: 1.14, tags: ['political', 'diplomatic'], trains: ['diplomacy', 'languages', 'etiquette'], yearly: { wisdom: 1 },
    ladder: ['Attaché', 'Third Secretary', 'Second Secretary', 'First Secretary', 'Counsellor', 'Minister-Counsellor', 'Deputy Ambassador', 'Ambassador', 'Foreign Minister', 'Elder Statesman'],
  },
  {
    id: 'taxCollector', name: 'Tax collector', cat: 'government', years: [-800, 1900],
    desc: 'Everyone hates you. Skimming is tempting.',
    salary: 5000, growth: 1.2, tags: ['political'], trains: ['bookkeeping', 'intimidation'], yearly: { publicImage: -1, corruption: 1 },
    ladder: ['Assessor', 'Collector', 'District Collector', 'Senior Collector', 'Tax Farmer', 'Provincial Receiver', 'Treasurer', 'Royal Treasurer', 'Master of Coin', 'Infamous Tax Lord'],
  },

  // ------------------------------------------------------------------ Politics (6)
  {
    id: 'politician', name: 'Politician', cat: 'politics', years: [-500, 99999], special: 'election', minAge: 21,
    desc: 'Run for office through the Politics panel. Each office is a rung.',
    salary: 30000, growth: 1.15, tags: ['political', 'fame'], trains: ['publicSpeaking', 'negotiation', 'leadership'], fame: 3, yearly: { stress: 4, ego: 1 },
    ladder: ['Campaign Volunteer', 'City Councillor', 'Mayor', 'State Legislator', 'National Legislator', 'Governor', 'Cabinet Minister', 'Deputy Leader', 'Head of Government', 'Elder Statesman'],
  },
  {
    id: 'romanSenator', name: 'Roman senator', cat: 'politics', years: [-509, 476], countries: ['it'], family: ['wealthy', 'aristocracy', 'royalty'], minAge: 25, trad: MALE,
    desc: 'The cursus honorum — from quaestor to consul.',
    salary: 30000, growth: 1.25, tags: ['political', 'fame'], trains: ['oratory', 'law', 'militaryStrategy'], fame: 3, yearly: { corruption: 1 },
    ladder: ['Military Tribune', 'Quaestor', 'Aedile', 'Praetor', 'Senator', 'Consul', 'Proconsul', 'Censor', 'Princeps Senatus', 'Father of the Fatherland'],
  },
  {
    id: 'activist', name: 'Activist', cat: 'politics', years: [1800, 99999],
    desc: 'March, organize, get arrested for the right reasons.',
    salary: 12000, growth: 1.18, tags: ['political'], trains: ['publicSpeaking', 'oratory', 'networking'], fame: 2, yearly: { karma: 2, heat: 1 },
    ladder: ['Volunteer', 'Organizer', 'Campaigner', 'Movement Spokesperson', 'Chapter Leader', 'National Organizer', 'Movement Leader', 'Icon of the Cause', 'Conscience of a Nation', 'Legendary Activist'],
  },
  {
    id: 'laborOrganizer', name: 'Worker organizer', cat: 'politics', years: [1820, 99999], prior: ['factoryWorker', 'miner', 'constructionWorker', 'truckDriver'],
    desc: 'Unionize the shop floor. Bosses hire thugs.',
    salary: 18000, growth: 1.15, tags: ['political'], trains: ['oratory', 'negotiation', 'leadership'], injury: 0.02, yearly: { karma: 1, heat: 1 },
    ladder: ['Shop Steward', 'Union Rep', 'Local Organizer', 'Local President', 'Regional Organizer', 'Strike Leader', 'National Executive', 'Union President', 'Labor Federation Head', 'Labor Legend'],
  },
  {
    id: 'suffragette', name: 'Suffragette', cat: 'politics', years: [1865, 1930], trad: 'female', countries: ['gb', 'us', 'au', 'fr', 'de'],
    desc: 'Fight for the vote. Hunger strikes and prison cells.',
    salary: 6000, growth: 1.2, tags: ['political'], trains: ['oratory', 'publicSpeaking'], fame: 2, yearly: { karma: 2, heat: 2 },
    ladder: ['Supporter', 'Canvasser', 'Organizer', 'Speaker', 'Branch Secretary', 'Militant Leader', 'National Committee', 'Movement Leader', 'Victorious Leader', 'Suffrage Legend'],
  },
  {
    id: 'resistanceFighter', name: 'Resistance fighter', cat: 'politics', years: [1939, 1945], needsWar: true, countries: ['fr', 'it', 'gr', 'de', 'ru', 'cn'],
    desc: 'Sabotage the occupier. Capture means death.',
    salary: 2000, growth: 1.2, tags: ['military', 'political'], trains: ['tacticalShooting', 'disguise', 'evasion'], injury: 0.08, yearly: { karma: 3, trauma: 3, heat: 3 },
    ladder: ['Courier', 'Lookout', 'Saboteur', 'Fighter', 'Cell Member', 'Cell Leader', 'Network Chief', 'Regional Commander', 'Liberation Hero', 'National Legend'],
  },

  // ------------------------------------------------------------------ Religion (5)
  {
    id: 'cleric', name: 'Clergy', cat: 'religion', years: [-800, 99999], edu: ['seminary', 'monastery'], min: { faith: 50 },
    desc: 'Lead a congregation; climb an ancient hierarchy.',
    salary: 18000, growth: 1.18, tags: ['religious'], trains: ['scripture', 'preaching', 'prayer'], yearly: { faith: 2, spiritualAuthority: 2 },
    ladder: ['Novice', 'Acolyte', 'Cleric', 'Senior Cleric', 'Dean', 'Bishop', 'Archbishop', 'Cardinal', 'Primate', 'Head of the Faith'],
    branch: { at: 5, name: 'Mystic path', desc: 'Renounce the politics of the hierarchy for direct experience of the divine.', ladder: ['Hermit', 'Mystic', 'Abbot of the Mountain', 'Living Saint', 'Prophet of the Age', 'Venerated Saint'], trains: ['mysticism', 'miracleWorking'], salaryMult: 0.5, effects: { divineFavor: 4, wisdom: 3 } },
  },
  {
    id: 'monk', name: 'Monk / nun', cat: 'religion', years: [-500, 99999], edu: ['monastery'], min: { faith: 45 },
    desc: 'Silence, prayer, copied manuscripts, brewed ale.',
    salary: 1000, growth: 1.1, tags: ['religious'], trains: ['meditation', 'scripture', 'herbalism'], yearly: { faith: 2, wisdom: 2, stress: -4, happiness: 1 },
    ladder: ['Postulant', 'Novice', 'Brother/Sister', 'Senior Monastic', 'Cellarer', 'Sub-prior', 'Prior', 'Abbot/Abbess', 'Head of Order', 'Saint of the Order'],
  },
  {
    id: 'missionary', name: 'Missionary', cat: 'religion', years: [100, 99999], min: { faith: 55 },
    desc: 'Spread the faith in distant lands.',
    salary: 8000, growth: 1.12, tags: ['religious'], trains: ['evangelism', 'languages', 'preaching'], injury: 0.02, yearly: { faith: 1, karma: 1 },
    ladder: ['Lay Volunteer', 'Missionary', 'Field Missionary', 'Mission Founder', 'Mission Superior', 'Regional Superior', 'Bishop of Missions', 'Apostle to the Nations', 'Martyr-candidate', 'Saint of the Missions'],
  },
  {
    id: 'televangelist', name: 'Televangelist', cat: 'religion', years: [1950, 99999], min: { charisma: 60, faith: 30 },
    desc: 'Megachurches, private jets, prayer-line donations.',
    salary: 40000, growth: 1.4, tags: ['religious', 'fame'], trains: ['evangelism', 'publicSpeaking', 'manipulation'], fame: 4, yearly: { ego: 2, sin: 1 },
    ladder: ['Radio Preacher', 'Local Pastor', 'Revival Preacher', 'TV Preacher', 'Megachurch Pastor', 'Network Evangelist', 'Prosperity Mogul', 'Religious Empire Head', 'Kingmaker of the Faithful', 'Televangelist Legend'],
  },
  {
    id: 'shaman', name: 'Shaman', cat: 'religion', years: [-800, 99999], min: { paranormal: 20 },
    desc: 'Walk between worlds; heal the village.',
    salary: 2000, growth: 1.2, tags: ['religious'], trains: ['trance', 'herbalism', 'healingRites'], yearly: { paranormal: 2, spiritualAuthority: 1 },
    ladder: ['Seer\'s Apprentice', 'Herb-gatherer', 'Healer', 'Shaman', 'Spirit-walker', 'Elder Shaman', 'Keeper of Rites', 'Voice of the Ancestors', 'Great Shaman', 'Legend of the Spirit World'],
  },

  // ------------------------------------------------------------------ Criminal (13)
  {
    id: 'thief', name: 'Thief', cat: 'criminal', years: [-800, 99999],
    desc: 'Pockets, houses, then vaults.',
    salary: 9000, growth: 1.3, tags: ['criminal'], trains: ['pickpocketing', 'burglary', 'lockpicking'], heat: 6, yearly: { karma: -2, sin: 1, riskTolerance: 1 },
    ladder: ['Pickpocket', 'Cutpurse', 'Burglar', 'Cat Burglar', 'Safecracker', 'Crew Member', 'Heist Planner', 'Master Thief', 'Gentleman Thief', 'Legendary Phantom'],
  },
  {
    id: 'drugDealer', name: 'Drug dealer', cat: 'criminal', years: [1900, 99999],
    desc: 'Corners, re-ups and rival crews.',
    salary: 15000, growth: 1.35, tags: ['criminal'], trains: ['drugDistribution', 'streetwise', 'intimidation'], heat: 9, injury: 0.03, yearly: { karma: -2, sin: 1, paranoia: 1 },
    ladder: ['Lookout', 'Runner', 'Corner Boy', 'Street Dealer', 'Crew Chief', 'Block Supplier', 'Mid-level Distributor', 'Area Boss', 'Regional Supplier', 'Street King'],
  },
  {
    id: 'hitman', name: 'Hitman', cat: 'criminal', years: [1900, 99999], min: { criminalRep: 30, aggression: 45 }, skills: { marksmanship: 20 },
    desc: 'Contracts. No questions. Physical evidence everywhere.',
    salary: 40000, growth: 1.35, tags: ['criminal'], trains: ['assassinationTechnique', 'marksmanship', 'disguise'], heat: 14, yearly: { karma: -6, sin: 4, trauma: 2, empathy: -2 },
    ladder: ['Enforcer', 'Leg Breaker', 'Contract Killer', 'Professional', 'Trusted Professional', 'Cleaner', 'Family Assassin', 'International Contractor', 'Ghost', 'Mythical Assassin'],
  },
  {
    id: 'conArtist', name: 'Con artist', cat: 'criminal', years: [-800, 99999], min: { charisma: 50 },
    desc: 'Charm is a weapon. Marks are everywhere.',
    salary: 14000, growth: 1.35, tags: ['criminal'], trains: ['deception', 'fraud', 'forgery'], heat: 5, yearly: { karma: -2, sin: 1 },
    ladder: ['Hustler', 'Three-card Grifter', 'Short Con Artist', 'Confidence Man/Woman', 'Long Con Artist', 'Impostor', 'Ponzi Architect', 'Society Swindler', 'Master Grifter', 'Legendary Con'],
  },
  {
    id: 'smuggler', name: 'Smuggler', cat: 'criminal', years: [-800, 99999],
    desc: 'Art, animals, diamonds, refugees — every border has a price.',
    salary: 16000, growth: 1.3, tags: ['criminal'], trains: ['borderSmuggling', 'sailing', 'logistics'], heat: 7, yearly: { riskTolerance: 1 },
    ladder: ['Mule', 'Courier', 'Runner', 'Smuggler', 'Route Owner', 'Network Operator', 'Smuggling Captain', 'Cross-border Boss', 'Smuggling Kingpin', 'Legend of the Routes'],
  },
  {
    id: 'armsDealer', name: 'Arms dealer', cat: 'criminal', years: [1850, 99999], min: { criminalRep: 40 }, skills: { negotiation: 20 },
    desc: 'Wars are good for business.',
    salary: 50000, growth: 1.35, tags: ['criminal', 'diplomatic'], trains: ['armsDealing', 'negotiation', 'forgery'], heat: 10, yearly: { karma: -4, sin: 2 },
    ladder: ['Gun Runner', 'Broker', 'Trafficker', 'Licensed Front', 'International Broker', 'Warlord Supplier', 'Embargo Breaker', 'Merchant of Death', 'Global Arms Baron', 'Lord of War'],
  },
  {
    id: 'hacker', name: 'Black-hat hacker', cat: 'criminal', years: [1985, 99999], skills: { programming: 30 },
    desc: 'Ransomware, bank fraud and dark-web markets.',
    salary: 30000, growth: 1.4, tags: ['criminal', 'tech'], trains: ['hacking', 'identityTheft', 'cybersecurity'], heat: 6, yearly: { paranoia: 2, loneliness: 1 },
    ladder: ['Script Kiddie', 'Carder', 'Hacker', 'Malware Author', 'Ransomware Affiliate', 'Crew Leader', 'APT Operator', 'Dark-web Kingpin', 'State-level Threat', 'Legendary Ghost'],
  },
  {
    id: 'bootlegger', name: 'Bootlegger', cat: 'criminal', years: [1920, 1933], countries: ['us'],
    desc: 'Prohibition made you rich. Repeal will end it.',
    salary: 25000, growth: 1.4, tags: ['criminal'], trains: ['drugManufacturing', 'getawayDriving', 'bribery'], heat: 7, yearly: { corruption: 2 },
    ladder: ['Rum Runner', 'Moonshiner', 'Still Operator', 'Speakeasy Supplier', 'Speakeasy Owner', 'Import Boss', 'Liquor Baron', 'Outfit Boss', 'King of Booze', 'Prohibition Legend'],
  },
  {
    id: 'outlaw', name: 'Outlaw', cat: 'criminal', years: [1850, 1912], countries: ['us', 'au', 'mx'],
    desc: 'Robbing trains on the frontier. Wanted posters with your face.',
    salary: 12000, growth: 1.35, tags: ['criminal', 'fame'], trains: ['marksmanship', 'horsemanship', 'evasion'], heat: 10, injury: 0.06, fame: 3,
    ladder: ['Horse Thief', 'Cattle Rustler', 'Road Agent', 'Stagecoach Robber', 'Bank Robber', 'Train Robber', 'Gang Leader', 'Most Wanted', 'Living Legend', 'Folk Hero Outlaw'],
  },
  {
    id: 'pirate', name: 'Pirate / privateer', cat: 'criminal', years: [-800, 1850],
    desc: 'Letters of marque or the black flag.',
    salary: 10000, growth: 1.35, tags: ['criminal', 'fame'], trains: ['sailing', 'swordsmanship', 'marksmanship'], heat: 8, injury: 0.06, fame: 2,
    ladder: ['Powder Monkey', 'Deckhand', 'Gunner', 'Boatswain', 'Quartermaster', 'First Mate', 'Captain', 'Commodore of Pirates', 'Pirate Lord', 'Pirate King'],
  },
  {
    id: 'counterfeiter', name: 'Counterfeiter', cat: 'criminal', years: [1600, 99999], skills: { forgery: 10 },
    desc: 'Print money, literally.',
    salary: 18000, growth: 1.3, tags: ['criminal'], trains: ['counterfeiting', 'forgery', 'art'], heat: 6,
    ladder: ['Printer\'s Assistant', 'Coin Clipper', 'Forger', 'Counterfeiter', 'Master Printer', 'Supernote Artisan', 'Network Supplier', 'Shadow Mint', 'Currency Kingpin', 'Legendary Forger'],
  },
  {
    id: 'drugKingpin', name: 'Drug kingpin', cat: 'criminal', years: [1970, 99999], min: { criminalRep: 55 }, skills: { drugDistribution: 40 },
    desc: 'Cartel-scale supply chains. Everyone wants you dead or extradited.',
    salary: 250000, growth: 1.35, tags: ['criminal', 'fame'], trains: ['cartelLogistics', 'moneyLaundering', 'intimidation'], heat: 18, injury: 0.04, fame: 2, yearly: { paranoia: 3, karma: -5, sin: 3 },
    ladder: ['Supplier', 'Trafficker', 'Plaza Boss', 'Lieutenant', 'Cartel Captain', 'Cartel Underboss', 'Cartel Boss', 'Narco Lord', 'Billionaire Narco', 'Narco Legend'],
  },
  {
    id: 'guildAssassin', name: 'Guild assassin', cat: 'criminal', years: [900, 1650], min: { dexterity: 45 },
    desc: 'The guild trains you; the guild owns you.',
    salary: 8000, growth: 1.3, tags: ['criminal'], trains: ['assassinationTechnique', 'disguise', 'knifeFighting'], heat: 8, yearly: { karma: -4, sin: 3 },
    ladder: ['Initiate', 'Novice Blade', 'Shadow', 'Assassin', 'Master Assassin', 'Guild Lieutenant', 'Hand of the Guild', 'Guild Elder', 'Grandmaster', 'Myth in the Dark'],
  },

  // ------------------------------------------------------------------ Royalty & nobility (3)
  {
    id: 'monarch', name: 'Monarch', cat: 'royalty', years: [-800, 99999], family: ['royalty'], special: 'succession',
    desc: 'Inherited through succession. Rule well or be overthrown.',
    salary: 500000, growth: 1.15, tags: ['royal', 'political', 'fame'], trains: ['leadership', 'diplomacy', 'etiquette'], fame: 6, yearly: { ego: 2, stress: 3 },
    ladder: ['Heir Apparent', 'Crowned Monarch', 'Established Monarch', 'Seasoned Monarch', 'Powerful Monarch', 'Great Monarch', 'Conqueror', 'Monarch of Legend', 'Sovereign "the Great"', 'Immortal Sovereign'],
  },
  {
    id: 'emperor', name: 'Emperor', cat: 'royalty', years: [-27, 1950], family: ['royalty'], special: 'succession',
    desc: 'Reserved for royal heirs of empires. Coups are an occupational hazard.',
    salary: 1500000, growth: 1.15, tags: ['royal', 'political', 'fame'], trains: ['militaryStrategy', 'leadership', 'manipulation'], fame: 8, yearly: { ego: 3, paranoia: 2 },
    ladder: ['Imperial Heir', 'Co-Emperor', 'Emperor', 'August Emperor', 'Conquering Emperor', 'Emperor of Many Peoples', 'Restorer of the Empire', 'God-Emperor', 'Emperor of Legend', 'Immortal Emperor'],
  },
  {
    id: 'lord', name: 'Lord / lady of the manor', cat: 'royalty', years: [700, 1950], family: ['aristocracy', 'royalty'],
    desc: 'Manage estates, tenants and alliances.',
    salary: 60000, growth: 1.2, tags: ['royal', 'political'], trains: ['management', 'etiquette', 'diplomacy'], yearly: { ego: 1 },
    ladder: ['Landed Heir', 'Lord of the Manor', 'Baron', 'Viscount', 'Earl', 'Marquess', 'Duke', 'Grand Duke', 'Prince-Elector', 'Legendary Lord'],
  },

  // ------------------------------------------------------------------ Frontier (3)
  {
    id: 'explorer', name: 'Explorer', cat: 'frontier', years: [1400, 1930], min: { fitness: 45 }, skills: { sailing: 10 },
    desc: 'Map the unknown. Return famous or not at all.',
    salary: 10000, growth: 1.3, tags: ['fame', 'physical'], trains: ['sailing', 'astronomy', 'leadership', 'mountaineering'], injury: 0.06, fame: 4,
    ladder: ['Expedition Hand', 'Navigator', 'Scout', 'Expedition Officer', 'Captain-Explorer', 'Expedition Leader', 'Royal Explorer', 'Discoverer', 'Admiral of the Ocean Sea', 'Immortal Explorer'],
  },
  {
    id: 'climateCoordinator', name: 'Climate refugee coordinator', cat: 'frontier', years: [2028, 99999], edu: ['university'],
    desc: 'Resettle the displaced as coastlines vanish.',
    salary: 50000, growth: 1.14, tags: ['political', 'diplomatic'], trains: ['logistics', 'diplomacy', 'languages'], yearly: { karma: 3, stress: 4 },
    ladder: ['Field Volunteer', 'Caseworker', 'Camp Coordinator', 'Regional Coordinator', 'Program Director', 'Country Director', 'Agency Deputy', 'High Commissioner', 'Global Envoy', 'Hero of the Displaced'],
  },
  {
    id: 'spaceColonist', name: 'Space colonist', cat: 'frontier', years: [2045, 99999], min: { fitness: 55, smarts: 60 },
    desc: 'Build humanity\'s first off-world settlements.',
    salary: 95000, growth: 1.18, tags: ['physical', 'fame'], trains: ['engineering', 'robotics', 'farming'], injury: 0.04, fame: 3,
    ladder: ['Colony Trainee', 'Habitat Technician', 'Colonist', 'Senior Colonist', 'Module Chief', 'Dome Administrator', 'Colony Council Member', 'Colony Governor', 'Founder of Worlds', 'Legend of Mars'],
  },

  // ------------------------------------------------------------------ Secret careers (10)
  {
    id: 'mobLawyer', name: 'Defense attorney to the mob', cat: 'secret', years: [1880, 99999], special: 'combo', edu: ['law'], skills: { law: 40, racketeering: 25 },
    combo: 'Criminal + Law: defend the underworld. Halves heat across your criminal network.',
    desc: 'Consigliere with a bar card.',
    salary: 150000, growth: 1.3, tags: ['legal', 'criminal', 'secret'], trains: ['criminalLaw', 'racketeering', 'moneyLaundering'], heat: 2, yearly: { karma: -3, corruption: 2 },
    ladder: ['Mob-connected Associate', 'Family Counsel', 'Trusted Counsel', 'Consigliere', 'Fixer', 'Untouchable Litigator', 'Syndicate General Counsel', 'Kingmaker of Verdicts', 'Shadow Attorney General', 'Legend of the Underworld Bar'],
  },
  {
    id: 'cyberlawSpecialist', name: 'Cyberlaw specialist', cat: 'secret', years: [1995, 99999], special: 'combo', skills: { hacking: 40, law: 40 },
    combo: 'Hacking + Law: the rarest expert witness in tech trials.',
    desc: 'Testify, litigate and quietly consult for both sides.',
    salary: 130000, growth: 1.25, tags: ['legal', 'tech', 'secret'], trains: ['cybersecurity', 'internationalLaw', 'hacking'],
    ladder: ['Tech Counsel', 'Cyber Litigator', 'Expert Witness', 'Senior Cyber Counsel', 'Practice Head', 'Government Advisor', 'International Cyber Envoy', 'Architect of Cyber Treaties', 'Digital Rights Icon', 'Legend of Cyberlaw'],
  },
  {
    id: 'cyberwarfareSpecialist', name: 'Cyberwarfare specialist', cat: 'secret', years: [1998, 99999], special: 'combo', skills: { hacking: 50, militaryStrategy: 30 },
    combo: 'Hacking + Military strategy: state-sponsored offensive operations.',
    desc: 'Take down power grids for your country.',
    salary: 120000, growth: 1.25, tags: ['military', 'tech', 'secret'], trains: ['hacking', 'penetrationTesting', 'botnets'], yearly: { paranoia: 2 },
    ladder: ['Cyber Operator', 'Offensive Analyst', 'Exploit Developer', 'Operations Lead', 'Cyber Unit Commander', 'Cyber Command Deputy', 'Director of Cyber Operations', 'Cyber General', 'Digital Warlord', 'Ghost in the Machine'],
  },
  {
    id: 'occultSurgeon', name: 'Occult surgeon', cat: 'secret', years: [1700, 99999], special: 'combo', skills: { demonology: 40, medicine: 50 },
    combo: 'Demonology + Medicine: forbidden operations for desperate patients.',
    desc: 'Transplant curses, graft vitality, extend lives at terrible cost.',
    salary: 200000, growth: 1.3, tags: ['medical', 'secret'], trains: ['surgery', 'demonology', 'necromancy'], yearly: { sin: 4, karma: -4, paranormal: 3 },
    ladder: ['Fringe Practitioner', 'Occult Physician', 'Curse Surgeon', 'Vitality Grafter', 'Master of Black Medicine', 'Physician to the Damned', 'Lifespan Broker', 'Surgeon of Souls', 'Death-cheater', 'Legend of Forbidden Medicine'],
  },
  {
    id: 'propagandaMinister', name: 'Propaganda minister', cat: 'secret', years: [1900, 99999], special: 'combo', skills: { acting: 40, propaganda: 30 }, prior: ['politician', 'journalist', 'actor'],
    combo: 'Acting + Politics: write the national story.',
    desc: 'Control the narrative of an entire nation.',
    salary: 90000, growth: 1.25, tags: ['political', 'secret', 'fame'], trains: ['propaganda', 'socialMediaManipulation', 'deception'], yearly: { karma: -3, corruption: 2 },
    ladder: ['Press Aide', 'Communications Director', 'Spin Doctor', 'Ministry Official', 'Deputy Minister', 'Minister of Information', 'Architect of Narrative', 'Voice of the Regime', 'Myth-maker', 'Legendary Propagandist'],
  },
  {
    id: 'cultLeader', name: 'Cult leader', cat: 'secret', years: [1800, 99999], special: 'combo', min: { charisma: 75 }, skills: { manipulation: 35 },
    combo: 'Criminal instincts + towering charisma (or faith + charisma): followers will give you everything.',
    desc: 'Compounds, tithes and absolute devotion.',
    salary: 60000, growth: 1.35, tags: ['religious', 'criminal', 'secret', 'fame'], trains: ['manipulation', 'preaching', 'propaganda'], heat: 4, fame: 2, yearly: { ego: 3, sin: 2, paranoia: 2 },
    ladder: ['Self-help Guru', 'Retreat Leader', 'Movement Founder', 'Spiritual Teacher', 'Prophet of the Compound', 'Messiah Figure', 'Leader of Thousands', 'Living God', 'Worldwide Movement Head', 'Infamous Cult Legend'],
  },
  {
    id: 'demonLord', name: 'Demon lord', cat: 'secret', years: [-800, 99999], special: 'pact',
    combo: 'Sell your soul. Locks you onto this path and into damnation.',
    desc: 'Total infernal power. Everything you touch corrupts.',
    salary: 500000, growth: 1.25, tags: ['secret', 'religious'], trains: ['demonology', 'soulHarvesting', 'curseCraft'], fame: 2, yearly: { sin: 6, karma: -8, fear: 4, paranormal: 4 },
    ladder: ['Damned Servant', 'Infernal Agent', 'Soul Broker', 'Hellbound Lord', 'Archfiend\'s Hand', 'Duke of Hell', 'Prince of Darkness', 'Archdemon', 'Demon Emperor', 'Adversary Incarnate'],
  },
  {
    id: 'doubleAgent', name: 'Double agent', cat: 'secret', years: [1920, 99999], special: 'combo', prior: ['spy'], min: { criminalRep: 30 },
    combo: 'Spy + underworld ties: serve two masters.',
    desc: 'Sell secrets to both sides. Every handler is a threat.',
    salary: 120000, growth: 1.3, tags: ['police', 'criminal', 'secret'], trains: ['deception', 'disguise', 'manipulation'], heat: 6, yearly: { paranoia: 4, stress: 4 },
    ladder: ['Turned Asset', 'Mole', 'Double Agent', 'Deep-cover Mole', 'Source of Sources', 'Network Betrayer', 'Kingmaker of Secrets', 'Phantom', 'Most Wanted by Two Nations', 'Legend of Betrayal'],
  },
  {
    id: 'exorcist', name: 'Exorcist', cat: 'secret', years: [-800, 99999], special: 'combo', skills: { exorcism: 40 }, min: { faith: 60 },
    combo: 'Mastered exorcism: called in when prayer is not enough.',
    desc: 'Cast out what should not be.',
    salary: 25000, growth: 1.2, tags: ['religious', 'secret'], trains: ['exorcism', 'spiritWarding', 'prayer'], injury: 0.02, yearly: { trauma: 2, faith: 2, divineFavor: 1 },
    ladder: ['Assistant Exorcist', 'Exorcist', 'Senior Exorcist', 'Diocesan Exorcist', 'Chief Exorcist', 'Breaker of Curses', 'Hammer of Demons', 'Exorcist of Nations', 'Living Ward', 'Legendary Exorcist'],
  },
  {
    id: 'prophet', name: 'Prophet', cat: 'secret', years: [-800, 99999], special: 'combo', skills: { prophecy: 45 }, min: { spiritualAuthority: 40 },
    combo: 'Mastered prophecy: your visions draw followers.',
    desc: 'Speak for the divine. Be revered or burned.',
    salary: 15000, growth: 1.35, tags: ['religious', 'secret', 'fame'], trains: ['prophecy', 'preaching', 'mysticism'], fame: 3, yearly: { faith: 3, paranoia: 1 },
    ladder: ['Visionary', 'Seer', 'Oracle', 'Prophet', 'Voice in the Wilderness', 'Prophet of Nations', 'Founder of a Faith', 'Holy Prophet', 'Messenger of the Divine', 'Eternal Prophet'],
  },
];

export const CAREER_BY_ID: Record<string, CareerDef> = Object.fromEntries(CAREERS.map((c) => [c.id, c]));

export const CAREER_CAT_NAMES: Record<CareerCat, string> = {
  medical: 'Medical',
  legal: 'Legal',
  military: 'Military',
  lawEnforcement: 'Law & order',
  business: 'Business & finance',
  tech: 'Technology',
  science: 'Science & academia',
  education: 'Education',
  creative: 'Creative arts',
  entertainment: 'Entertainment & media',
  sports: 'Sports',
  trades: 'Trades & labor',
  service: 'Service & transport',
  government: 'Government',
  politics: 'Politics & activism',
  religion: 'Religion',
  criminal: 'Criminal',
  royalty: 'Royalty & nobility',
  frontier: 'Frontier',
  secret: 'Secret',
};

export function careerTitle(def: CareerDef, level: number, branchTaken: boolean): string {
  const lv = Math.max(1, Math.min(10, level));
  if (branchTaken && def.branch && lv >= def.branch.at) {
    return def.branch.ladder[Math.min(def.branch.ladder.length - 1, lv - def.branch.at)];
  }
  return def.ladder[lv - 1];
}
