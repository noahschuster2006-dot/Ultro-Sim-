import type { AddictionKind } from '../types';

export interface MentalConditionDef {
  id: string;
  name: string;
  triggers: string;
  effect: string;
  treatment: string;
}

/** The clinical layer: each condition has triggers, gameplay effects and treatments. */
export const MENTAL_CONDITIONS: MentalConditionDef[] = [
  { id: 'ptsd', name: 'PTSD', triggers: 'Combat, assault, witnessing violence, disasters (trauma 60+ after a violent event)', effect: 'Flashback events, anxiety spikes, insomnia, aggression; hides calm choices', treatment: 'Trauma therapy (1970+), support groups, faith; medication softens symptoms' },
  { id: 'depression', name: 'Major depression', triggers: 'Loss, isolation, chronic stress, genetic risk (depression 65+ sustained)', effect: 'Happiness recovery halved, work performance down, ambitious choices hidden; crisis events above 70', treatment: 'Therapy, antidepressants (1955+), exercise, social support' },
  { id: 'anxietyDisorder', name: 'Generalized anxiety disorder', triggers: 'Financial ruin, stress, unstable childhood (anxiety 65+ sustained)', effect: 'Fewer choices per event, health and happiness drain', treatment: 'Therapy, medication (1955+), meditation, exercise' },
  { id: 'panic', name: 'Panic disorder', triggers: 'Anxiety above 80', effect: 'Panic-attack events; public-facing careers suffer', treatment: 'Therapy, medication, breathing practice' },
  { id: 'bipolar', name: 'Bipolar disorder', triggers: 'Mania spikes plus depression history, genetic predisposition', effect: 'Manic stat boosts followed by crashes; impulsive spending', treatment: 'Mood stabilizers (lithium, 1949+), therapy' },
  { id: 'psychosis', name: 'Paranoid psychosis', triggers: 'Paranoia 85+, stimulant abuse', effect: 'Neutral events read as threats, relationships decay, violent misreads', treatment: 'Antipsychotics (1952+), hospitalization, sobriety' },
  { id: 'npd', name: 'Narcissistic personality', triggers: 'Ego above 90 from fame and power', effect: 'Refuses help, grandiose choices, relationships decay', treatment: 'Long-term therapy (low success), humbling life events' },
  { id: 'insomnia', name: 'Chronic insomnia', triggers: 'Stress 75+', effect: 'Health and energy drain, worse decisions', treatment: 'Therapy, routine, medication' },
  { id: 'grief', name: 'Complicated grief', triggers: 'Losing a spouse, child or parent', effect: 'Depression rises yearly, lifespan shortens', treatment: 'Grief counselling, faith, family support' },
  { id: 'burnout', name: 'Burnout', triggers: 'High-stress career for years (stress 80+)', effect: 'Performance collapses, cynicism', treatment: 'Time off, career change, therapy' },
];

export const MENTAL_BY_ID: Record<string, MentalConditionDef> = Object.fromEntries(MENTAL_CONDITIONS.map((m) => [m.id, m]));

export interface AddictionDef {
  kind: AddictionKind;
  name: string;
  entry: string;
  stages: [string, string, string, string, string];
  withdrawal: string;
  recovery: string;
  /** Annual cost per severity point. */
  cost: number;
  recoveryOptions: { id: string; name: string; cost: number; fromYear: number; power: number }[];
}

export const ADDICTIONS: AddictionDef[] = [
  {
    kind: 'alcohol', name: 'Alcohol', entry: 'Social events, grief, celebration',
    stages: ['Social drinking lifts the mood', 'Hangovers start costing workdays', 'Performance declines; secrets pile up', 'Health damage, blackouts', 'Liver failure risk'],
    withdrawal: 'Shakes, anxiety, seizure risk', recovery: 'AA, rehab, willpower checks', cost: 1500,
    recoveryOptions: [{ id: 'aa', name: 'Support meetings (AA)', cost: 0, fromYear: 1935, power: 0.35 }, { id: 'rehab', name: 'Residential rehab', cost: 30000, fromYear: 1950, power: 0.55 }, { id: 'cold', name: 'Quit through willpower', cost: 0, fromYear: -800, power: 0.2 }],
  },
  {
    kind: 'stimulants', name: 'Cocaine / stimulants', entry: 'Fame events, criminal career, all-nighters',
    stages: ['Confidence boost', 'Mania triggers', 'Paranoia creeps in', 'Heart strain, burning money', 'Psychosis'],
    withdrawal: 'Severe depression crash', recovery: 'Rehab (expensive), cold turkey', cost: 8000,
    recoveryOptions: [{ id: 'rehab', name: 'Luxury rehab', cost: 60000, fromYear: 1950, power: 0.55 }, { id: 'cold', name: 'Cold turkey', cost: 0, fromYear: -800, power: 0.18 }],
  },
  {
    kind: 'opioids', name: 'Heroin / opioids', entry: 'Injury or chronic pain treatment, criminal path',
    stages: ['Euphoria and pain relief', 'Tolerance builds', 'Total life neglect', 'Overdose risk', 'Overdose risk severe'],
    withdrawal: 'Physically dangerous, multi-week', recovery: 'Methadone, rehab, long recovery', cost: 9000,
    recoveryOptions: [{ id: 'methadone', name: 'Methadone program', cost: 4000, fromYear: 1964, power: 0.45 }, { id: 'rehab', name: 'Rehab', cost: 35000, fromYear: 1950, power: 0.45 }, { id: 'cold', name: 'Cold turkey', cost: 0, fromYear: -800, power: 0.1 }],
  },
  {
    kind: 'gambling', name: 'Gambling', entry: 'Casino events, financial desperation',
    stages: ['Excitement', 'Chasing losses', 'Compulsion', 'Debt spiral', 'Bankruptcy'],
    withdrawal: 'Psychological, no physical', recovery: 'Gamblers Anonymous, financial counselling', cost: 6000,
    recoveryOptions: [{ id: 'ga', name: 'Gamblers Anonymous', cost: 0, fromYear: 1957, power: 0.35 }, { id: 'counselling', name: 'Financial counselling', cost: 3000, fromYear: 1950, power: 0.3 }, { id: 'cold', name: 'Self-exclusion', cost: 0, fromYear: -800, power: 0.2 }],
  },
  {
    kind: 'sex', name: 'Sex addiction', entry: 'Fame, relationship instability',
    stages: ['Thrill-seeking', 'Relationship damage', 'STI risk', 'Scandal exposure risk', 'Career destruction'],
    withdrawal: 'Psychological', recovery: 'Therapy, relationship repair', cost: 2000,
    recoveryOptions: [{ id: 'therapy', name: 'Specialist therapy', cost: 8000, fromYear: 1950, power: 0.4 }, { id: 'cold', name: 'Willpower', cost: 0, fromYear: -800, power: 0.2 }],
  },
  {
    kind: 'power', name: 'Power addiction', entry: 'Political or criminal career peak',
    stages: ['Rational decisions', 'Need for control', 'Paranoia', 'Authoritarianism', 'Complete moral collapse'],
    withdrawal: 'Existential crisis on loss of power', recovery: 'Forced removal from power, spiritual path', cost: 0,
    recoveryOptions: [{ id: 'spiritual', name: 'Spiritual retreat', cost: 5000, fromYear: -800, power: 0.3 }, { id: 'stepDown', name: 'Step down voluntarily', cost: 0, fromYear: -800, power: 0.5 }],
  },
  {
    kind: 'violence', name: 'Violence', entry: 'Combat career, trauma, criminal path',
    stages: ['Adrenaline need', 'Escalation', 'Seeking fights', 'Serial violence', 'Mass-casualty risk'],
    withdrawal: 'Restlessness, rage events', recovery: 'Therapy, isolation, faith path', cost: 0,
    recoveryOptions: [{ id: 'therapy', name: 'Anger therapy', cost: 6000, fromYear: 1950, power: 0.35 }, { id: 'faith', name: 'Faith path', cost: 0, fromYear: -800, power: 0.3 }, { id: 'isolation', name: 'Isolate yourself', cost: 0, fromYear: -800, power: 0.2 }],
  },
];

export const ADDICTION_BY_KIND: Record<AddictionKind, AddictionDef> = Object.fromEntries(ADDICTIONS.map((a) => [a.kind, a])) as Record<AddictionKind, AddictionDef>;

export interface ChronicDef {
  id: string;
  name: string;
  /** Annual treatment cost when managed. */
  cost: number;
  /** Annual health loss when unmanaged, per severity. */
  drain: number;
  mortality: number;
  fromYear?: number;
}

export const CHRONIC: ChronicDef[] = [
  { id: 'diabetes', name: 'Type 2 diabetes', cost: 4000, drain: 2, mortality: 0.01 },
  { id: 'heartDisease', name: 'Heart disease', cost: 6000, drain: 3, mortality: 0.03 },
  { id: 'hypertension', name: 'Hypertension', cost: 1000, drain: 1, mortality: 0.01 },
  { id: 'cancer', name: 'Cancer', cost: 40000, drain: 6, mortality: 0.12 },
  { id: 'hiv', name: 'HIV', cost: 15000, drain: 4, mortality: 0.06, fromYear: 1980 },
  { id: 'copd', name: 'COPD', cost: 3000, drain: 2, mortality: 0.02 },
  { id: 'liverDisease', name: 'Liver disease', cost: 8000, drain: 4, mortality: 0.05 },
  { id: 'arthritis', name: 'Arthritis', cost: 1500, drain: 1, mortality: 0 },
  { id: 'asthma', name: 'Asthma', cost: 800, drain: 1, mortality: 0.003 },
  { id: 'sickleCell', name: 'Sickle-cell disease', cost: 6000, drain: 2, mortality: 0.01 },
  { id: 'huntington', name: "Huntington's disease", cost: 10000, drain: 3, mortality: 0.03 },
  { id: 'dementia', name: 'Dementia', cost: 25000, drain: 2, mortality: 0.04 },
  { id: 'tuberculosis', name: 'Tuberculosis', cost: 3000, drain: 5, mortality: 0.08 },
];

export const CHRONIC_BY_ID: Record<string, ChronicDef> = Object.fromEntries(CHRONIC.map((c) => [c.id, c]));

export const INJURIES: { id: string; name: string; caps: Record<string, number>; desc: string }[] = [
  { id: 'limp', name: 'Permanent limp', caps: { fitness: 90 }, desc: 'fitness −10 permanently' },
  { id: 'oneEye', name: 'Blind in one eye', caps: { dexterity: 85, looks: 92 }, desc: 'depth perception gone' },
  { id: 'hearingLoss', name: 'Hearing loss', caps: { charisma: 92 }, desc: 'conversations are harder' },
  { id: 'badBones', name: 'Badly healed fracture', caps: { fitness: 92, dexterity: 92 }, desc: 'aches when it rains' },
  { id: 'facialScar', name: 'Facial scar', caps: { looks: 88 }, desc: 'people stare' },
  { id: 'brainInjury', name: 'Traumatic brain injury', caps: { smarts: 85 }, desc: 'memory and focus suffer' },
  { id: 'lostFingers', name: 'Lost fingers', caps: { dexterity: 75 }, desc: 'fine work is hard' },
  { id: 'spinal', name: 'Spinal injury', caps: { fitness: 60 }, desc: 'mobility permanently reduced' },
];
