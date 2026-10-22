import type { FamilyStatus } from '../types';
import type { StatId } from './stats';

export interface ProgramDef {
  id: string;
  name: string;
  years: number;
  fromYear: number;
  /** Annual tuition in modern dollars. */
  cost: number;
  minAge: number;
  requires?: string[];
  min?: Partial<Record<StatId, number>>;
  family?: FamilyStatus[];
  /** Skills trained each enrolled year. */
  trains: string[];
  kind: 'school' | 'higher' | 'vocational' | 'religious' | 'military' | 'criminal' | 'graduate';
  desc: string;
  /** Before this year only middle-class+ families can access it. */
  eliteUntil?: number;
}

export const PROGRAMS: ProgramDef[] = [
  { id: 'primary', name: 'Primary school', years: 6, fromYear: -800, cost: 0, minAge: 6, trains: ['literacy', 'mathematics'], kind: 'school', desc: 'Reading, writing, sums.', eliteUntil: 1870 },
  { id: 'secondary', name: 'Secondary school', years: 6, fromYear: -800, cost: 0, minAge: 12, requires: ['primary'], trains: ['literacy', 'mathematics', 'science', 'history'], kind: 'school', desc: 'High school. Gateway to almost everything.', eliteUntil: 1920 },
  { id: 'university', name: 'University', years: 4, fromYear: 1088, cost: 16000, minAge: 17, requires: ['secondary'], min: { smarts: 45 }, trains: ['logic', 'science', 'writing', 'economics'], kind: 'higher', desc: 'Four years, a network for life.', eliteUntil: 1900 },
  { id: 'communityCollege', name: 'Community college', years: 2, fromYear: 1920, cost: 4000, minAge: 17, requires: ['secondary'], trains: ['mathematics', 'writing', 'bookkeeping'], kind: 'higher', desc: 'Cheap, practical, flexible.' },
  { id: 'tradeSchool', name: 'Trade school', years: 2, fromYear: 1880, cost: 6000, minAge: 16, trains: ['mechanics', 'electrical', 'construction'], kind: 'vocational', desc: 'Learn a skilled trade fast.' },
  { id: 'apprenticeship', name: 'Apprenticeship', years: 3, fromYear: -800, cost: 0, minAge: 12, trains: ['artisanship', 'metalworking', 'carpentry', 'mechanics'], kind: 'vocational', desc: 'Learn by doing under a master.' },
  { id: 'militaryAcademy', name: 'Military academy', years: 4, fromYear: 1800, cost: 0, minAge: 17, requires: ['secondary'], min: { smarts: 50, fitness: 45 }, trains: ['militaryStrategy', 'leadership', 'weaponsTraining'], kind: 'military', desc: 'Officer training. Free — but you owe service.' },
  { id: 'seminary', name: 'Seminary', years: 4, fromYear: 300, cost: 3000, minAge: 17, min: { faith: 40 }, trains: ['theology', 'scripture', 'preaching'], kind: 'religious', desc: 'Train for the clergy.' },
  { id: 'monastery', name: 'Monastery', years: 3, fromYear: -500, cost: 0, minAge: 14, min: { faith: 30 }, trains: ['meditation', 'scripture', 'herbalism', 'literacy'], kind: 'religious', desc: 'Withdraw from the world. Learn silence.' },
  { id: 'online', name: 'Online degree', years: 3, fromYear: 1998, cost: 3000, minAge: 16, trains: ['programming', 'writing', 'marketing'], kind: 'higher', desc: 'Learn from your bedroom.' },
  { id: 'criminalApprenticeship', name: 'Criminal apprenticeship', years: 2, fromYear: -800, cost: 0, minAge: 13, trains: ['lockpicking', 'streetwise', 'fraud', 'evasion'], kind: 'criminal', desc: 'A mentor from the underworld teaches you the trade.' },
  { id: 'law', name: 'Law school', years: 3, fromYear: 1850, cost: 45000, minAge: 20, requires: ['university'], min: { smarts: 60 }, trains: ['law', 'criminalLaw', 'publicSpeaking'], kind: 'graduate', desc: 'Gate to lawyer, judge and prosecutor.' },
  { id: 'medical', name: 'Medical school', years: 4, fromYear: 1850, cost: 50000, minAge: 20, requires: ['university'], min: { smarts: 65 }, trains: ['medicine', 'biology', 'surgery'], kind: 'graduate', desc: 'Gate to physician, surgeon and psychiatrist.' },
  { id: 'phd', name: 'Doctorate (PhD)', years: 5, fromYear: 1820, cost: 0, minAge: 21, requires: ['university'], min: { smarts: 65 }, trains: ['science', 'physics', 'philosophy', 'mathematics'], kind: 'graduate', desc: 'Five years of research and poverty.' },
  { id: 'mba', name: 'MBA', years: 2, fromYear: 1910, cost: 60000, minAge: 22, requires: ['university'], min: { smarts: 50 }, trains: ['management', 'corporateStrategy', 'networking'], kind: 'graduate', desc: 'The executive fast-track.' },
];

export const PROGRAM_BY_ID: Record<string, ProgramDef> = Object.fromEntries(PROGRAMS.map((p) => [p.id, p]));

export const EDU_ORDER = ['none', 'primary', 'secondary', 'tradeSchool', 'communityCollege', 'university', 'mba', 'law', 'medical', 'phd'];
