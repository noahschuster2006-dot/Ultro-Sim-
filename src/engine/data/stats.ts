/**
 * The 47-dimensional stat model. Every stat is tracked independently, has a
 * range, belongs to one of 8 categories, and is touched by the passive
 * cross-stat feedback rules in systems/stats.ts.
 */
export const STAT_CATEGORIES = [
  { id: 'vital', name: 'Vital', desc: 'The four classic bars plus physical fitness.' },
  { id: 'mind', name: 'Mind', desc: 'Mental-health state. Most of these are bad when high.' },
  { id: 'character', name: 'Character', desc: 'Personality traits that weight events and choices.' },
  { id: 'social', name: 'Social', desc: 'How you relate to people around you.' },
  { id: 'reputation', name: 'Reputation', desc: 'Separate public narratives, each moved by different actions.' },
  { id: 'spirit', name: 'Spirit', desc: 'Karma, faith and the supernatural layer.' },
  { id: 'underworld', name: 'Underworld', desc: 'Police attention and criminal leverage.' },
  { id: 'body', name: 'Body', desc: 'Physiology beyond raw health.' },
] as const;

export type StatCategory = (typeof STAT_CATEGORIES)[number]['id'];

export interface StatDef {
  id: string;
  name: string;
  cat: StatCategory;
  min: number;
  max: number;
  /** True when a high value is harmful (drawn red in the UI). */
  bad?: boolean;
  desc: string;
}

export const STAT_DEFS = [
  // Vital (5)
  { id: 'happiness', name: 'Happiness', cat: 'vital', min: 0, max: 100, desc: 'Overall life satisfaction. Feeds lifespan.' },
  { id: 'health', name: 'Health', cat: 'vital', min: 0, max: 100, desc: 'Physical health. At 0 you die.' },
  { id: 'smarts', name: 'Smarts', cat: 'vital', min: 0, max: 100, desc: 'Intelligence and learning speed.' },
  { id: 'looks', name: 'Looks', cat: 'vital', min: 0, max: 100, desc: 'Physical attractiveness.' },
  { id: 'fitness', name: 'Fitness', cat: 'vital', min: 0, max: 100, desc: 'Strength and endurance; gates sports and combat.' },
  // Mind (8)
  { id: 'anxiety', name: 'Anxiety', cat: 'mind', min: 0, max: 100, bad: true, desc: 'Above 60 hides choices; above 80 triggers panic attacks.' },
  { id: 'depression', name: 'Depression', cat: 'mind', min: 0, max: 100, bad: true, desc: 'Slows happiness recovery; above 70 triggers a crisis arc with intervention paths.' },
  { id: 'trauma', name: 'Trauma', cat: 'mind', min: 0, max: 100, bad: true, desc: 'Accumulates from violence and loss; untreated it cascades into PTSD.' },
  { id: 'mania', name: 'Mania', cat: 'mind', min: 0, max: 100, bad: true, desc: 'Temporary boosts that crash hard. Pushes impulsive choices.' },
  { id: 'paranoia', name: 'Paranoia', cat: 'mind', min: 0, max: 100, bad: true, desc: 'You misread neutral events as threats.' },
  { id: 'ego', name: 'Ego', cat: 'mind', min: 0, max: 100, bad: true, desc: 'Above 80 you refuse help; above 90 narcissism unlocks.' },
  { id: 'stress', name: 'Stress', cat: 'mind', min: 0, max: 100, bad: true, desc: 'Erodes health and fuels anxiety.' },
  { id: 'wisdom', name: 'Wisdom', cat: 'mind', min: 0, max: 100, desc: 'Grows with age and reflection; elders pass it down.' },
  // Character (7)
  { id: 'empathy', name: 'Empathy', cat: 'character', min: 0, max: 100, desc: 'Compassion. Bullying and violence erode it.' },
  { id: 'aggression', name: 'Aggression', cat: 'character', min: 0, max: 100, bad: true, desc: 'Weights violent choices and events.' },
  { id: 'discipline', name: 'Discipline', cat: 'character', min: 0, max: 100, desc: 'Study, training and career performance.' },
  { id: 'creativity', name: 'Creativity', cat: 'character', min: 0, max: 100, desc: 'Arts, entrepreneurship, invention.' },
  { id: 'riskTolerance', name: 'Risk tolerance', cat: 'character', min: 0, max: 100, desc: 'Raised by getting away with things.' },
  { id: 'willpower', name: 'Willpower', cat: 'character', min: 0, max: 100, desc: 'Resists addiction, peer pressure and temptation.' },
  { id: 'resilience', name: 'Resilience', cat: 'character', min: 0, max: 100, desc: 'Softens trauma and speeds recovery.' },
  // Social (5)
  { id: 'charisma', name: 'Charisma', cat: 'social', min: 0, max: 100, desc: 'Persuasion, leadership, elections.' },
  { id: 'popularity', name: 'Popularity', cat: 'social', min: 0, max: 100, desc: 'Which peer groups accept you.' },
  { id: 'confidence', name: 'Confidence', cat: 'social', min: 0, max: 100, desc: 'Self-belief; sibling rivalry and success shape it.' },
  { id: 'loneliness', name: 'Loneliness', cat: 'social', min: 0, max: 100, bad: true, desc: 'Isolation slowly feeds depression.' },
  { id: 'romanticCynicism', name: 'Romantic cynicism', cat: 'social', min: 0, max: 100, bad: true, desc: 'Heartbreak scars; lowers romantic success.' },
  // Reputation (7)
  { id: 'fame', name: 'Fame', cat: 'reputation', min: 0, max: 100, desc: 'How many people know your name.' },
  { id: 'publicImage', name: 'Public image', cat: 'reputation', min: 0, max: 100, desc: 'Whether the public likes what it knows.' },
  { id: 'professionalRep', name: 'Professional rep', cat: 'reputation', min: 0, max: 100, desc: 'Standing in your field.' },
  { id: 'streetCred', name: 'Street cred', cat: 'reputation', min: 0, max: 100, desc: 'Respect on the street.' },
  { id: 'criminalRep', name: 'Criminal rep', cat: 'reputation', min: 0, max: 100, desc: 'Standing in the underworld.' },
  { id: 'politicalApproval', name: 'Political approval', cat: 'reputation', min: 0, max: 100, desc: 'Electability and approval in office.' },
  { id: 'infamy', name: 'Infamy', cat: 'reputation', min: 0, max: 100, bad: true, desc: 'Notoriety for bad deeds.' },
  // Spirit (6)
  { id: 'karma', name: 'Karma', cat: 'spirit', min: -100, max: 100, desc: 'Moral balance. Poles unlock miracles or pacts.' },
  { id: 'faith', name: 'Faith', cat: 'spirit', min: 0, max: 100, desc: 'Religious conviction.' },
  { id: 'sin', name: 'Sin', cat: 'spirit', min: 0, max: 100, bad: true, desc: 'Accumulated transgressions; shapes the afterlife.' },
  { id: 'divineFavor', name: 'Divine favor', cat: 'spirit', min: 0, max: 100, desc: 'Karma 70+ and faith 60+ accumulate it. 25/50/75/100 thresholds.' },
  { id: 'spiritualAuthority', name: 'Spiritual authority', cat: 'spirit', min: 0, max: 100, desc: 'Standing in religious institutions.' },
  { id: 'paranormal', name: 'Paranormal sensitivity', cat: 'spirit', min: 0, max: 100, desc: 'Unlocks hidden spiritual event chains.' },
  // Underworld (4)
  { id: 'heat', name: 'Heat', cat: 'underworld', min: 0, max: 100, bad: true, desc: 'Police attention. Decays with time.' },
  { id: 'evidence', name: 'Evidence', cat: 'underworld', min: 0, max: 100, bad: true, desc: 'Worst open case. 60+ arrest risk, 80+ conviction.' },
  { id: 'fear', name: 'Fear', cat: 'underworld', min: 0, max: 100, desc: 'How much people fear you. Silences witnesses.' },
  { id: 'corruption', name: 'Corruption', cat: 'underworld', min: 0, max: 100, bad: true, desc: 'Officials you own — and that own you.' },
  // Body (5)
  { id: 'immunity', name: 'Immunity', cat: 'body', min: 0, max: 100, desc: 'Resistance to illness and pandemics.' },
  { id: 'energy', name: 'Energy', cat: 'body', min: 0, max: 100, desc: 'Daily vitality; declines with age.' },
  { id: 'pain', name: 'Chronic pain', cat: 'body', min: 0, max: 100, bad: true, desc: 'From injuries and conditions; opioid entry point.' },
  { id: 'fertility', name: 'Fertility', cat: 'body', min: 0, max: 100, desc: 'Chance of conceiving.' },
  { id: 'dexterity', name: 'Dexterity', cat: 'body', min: 0, max: 100, desc: 'Fine motor control: surgery, pickpocketing, music.' },
] as const satisfies readonly StatDef[];

export type StatId = (typeof STAT_DEFS)[number]['id'];
export type Stats = Record<StatId, number>;

export const STAT_IDS: StatId[] = STAT_DEFS.map((s) => s.id);
export const STAT_BY_ID: Record<StatId, StatDef> = Object.fromEntries(STAT_DEFS.map((s) => [s.id, s])) as Record<StatId, StatDef>;

export function emptyStats(): Stats {
  const s = {} as Stats;
  for (const d of STAT_DEFS) s[d.id] = 0;
  return s;
}
