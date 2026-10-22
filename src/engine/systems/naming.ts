import { NAMES } from '../data/names';
import { cultureOf } from '../data/countries';
import { pick, type RngHolder } from '../rng';
import type { Gender } from '../types';

export function firstName(h: RngHolder, countryId: string, year: number, gender: Gender): string {
  const pool = NAMES[cultureOf(countryId, year)];
  if (gender === 'nonbinary') return pick(h, [...pool.male, ...pool.female]);
  return pick(h, gender === 'male' ? pool.male : pool.female);
}

export function lastName(h: RngHolder, countryId: string, year: number): string {
  return pick(h, NAMES[cultureOf(countryId, year)].last);
}

export function fullName(h: RngHolder, countryId: string, year: number, gender: Gender): string {
  return `${firstName(h, countryId, year, gender)} ${lastName(h, countryId, year)}`;
}
