import type { ChainDef, EventDef } from './types';
import { LIFE_EVENTS } from './life';
import { ADULT_EVENTS } from './adult';
import { CRIME_CHAINS, CRIME_EVENTS } from './crime';
import { RELATIONSHIP_EVENTS } from './relationships';
import { HEALTH_EVENTS } from './health';
import { SPIRIT_CHAINS, SPIRIT_EVENTS } from './spirit';
import { WORLD_EVENTS } from './world';
import { MEDIA_EVENTS } from './media';
import { CAREER_EVENTS } from './career';
import { DYNASTY_CHAINS, DYNASTY_EVENTS } from './dynasty';
import { POSSESSION_EVENTS } from './possessions';
import { ROMANCE_CHAINS, ROMANCE_EVENTS } from './romance';
import { FAMILY_CHAINS, FAMILY_EVENTS } from './family';
import { SCHOOL_CHAINS, SCHOOL_EVENTS } from './school';
import { WORK_CHAINS, WORK_EVENTS } from './work';
import { LEISURE_CHAINS, LEISURE_EVENTS } from './leisure';
import { ERAS_CHAINS, ERAS_EVENTS } from './eras';
import { AGING_CHAINS, AGING_EVENTS } from './aging';
import { FORTUNE_CHAINS, FORTUNE_EVENTS } from './fortune';

export const ALL_EVENTS: EventDef[] = [
  ...LIFE_EVENTS,
  ...ADULT_EVENTS,
  ...CRIME_EVENTS,
  ...RELATIONSHIP_EVENTS,
  ...HEALTH_EVENTS,
  ...SPIRIT_EVENTS,
  ...WORLD_EVENTS,
  ...MEDIA_EVENTS,
  ...CAREER_EVENTS,
  ...DYNASTY_EVENTS,
  ...POSSESSION_EVENTS,
  ...ROMANCE_EVENTS,
  ...FAMILY_EVENTS,
  ...SCHOOL_EVENTS,
  ...WORK_EVENTS,
  ...LEISURE_EVENTS,
  ...ERAS_EVENTS,
  ...AGING_EVENTS,
  ...FORTUNE_EVENTS,
];

export const ALL_CHAINS: ChainDef[] = [
  ...CRIME_CHAINS,
  ...SPIRIT_CHAINS,
  ...DYNASTY_CHAINS,
  ...ROMANCE_CHAINS,
  ...FAMILY_CHAINS,
  ...SCHOOL_CHAINS,
  ...WORK_CHAINS,
  ...LEISURE_CHAINS,
  ...ERAS_CHAINS,
  ...AGING_CHAINS,
  ...FORTUNE_CHAINS,
];
