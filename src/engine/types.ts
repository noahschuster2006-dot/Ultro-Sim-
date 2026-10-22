import type { StatId, Stats } from './data/stats';

export type Gender = 'male' | 'female' | 'nonbinary';
export type Sexuality = 'straight' | 'gay' | 'bisexual' | 'asexual';
export type FamilyStatus = 'destitute' | 'poor' | 'working' | 'middle' | 'wealthy' | 'aristocracy' | 'royalty';
export type FamilyHealth = 'abusive' | 'alcoholic' | 'neglectful' | 'absent' | 'loving' | 'overprotective';
export type LifeStage = 'infant' | 'child' | 'teen' | 'youngAdult' | 'adult' | 'midlife' | 'senior' | 'elder';
export type EraId =
  | 'ancient'
  | 'medieval'
  | 'renaissance'
  | 'industrial'
  | 'modernEarly'
  | 'coldWar'
  | 'digital'
  | 'socialMedia'
  | 'nearFuture';
export type TechEra = 'preIndustrial' | 'industrial' | 'postWar' | 'coldWar' | 'digital' | 'socialMedia' | 'ai';
export type WarStatus = 'none' | 'regional' | 'major' | 'world';
export type Regime = 'monarchy' | 'democracy' | 'autocracy' | 'theocracy' | 'junta' | 'empire';
export type ReligionDominance = 'theocracy' | 'stateReligion' | 'pluralism' | 'secular';
export type Tone = 'good' | 'bad' | 'neutral' | 'major' | 'world';

// ---------------------------------------------------------------- World

export interface WorldContext {
  economy: number;
  stability: number;
  war: WarStatus;
  warName?: string;
  socialNorms: number;
  religionDominance: ReligionDominance;
  crimeRate: number;
  healthCrisis: boolean;
  healthCrisisName?: string;
  prohibition: boolean;
  cannabisLegal: boolean;
  regime: Regime;
  ruler: string;
  /** Years remaining in an arms embargo or sanctions regime. */
  sanctions: number;
  /** Procedural shocks layered on top of the country baseline; they decay. */
  econShock: number;
  stabShock: number;
  crimeShock: number;
  /** Cumulative permanent shift to social norms from history and laws. */
  normsShift: number;
  procWar: { name: string; years: number; level: WarStatus } | null;
  procPandemic: { name: string; years: number } | null;
  regimeOverride: Regime | null;
  baseRegime: Regime;
  /** Laws passed in this country (by the player or the world engine). */
  policies: string[];
  rulerSince: number;
}

export interface ChronicleEntry {
  year: number;
  countryId: string | null;
  title: string;
  text: string;
}

export interface ReligiousInstitution {
  religionId: string;
  name: string;
  influence: number;
  wealth: number;
  corruption: number;
  schismRisk: number;
}

export interface Legend {
  name: string;
  dynasty: string;
  year: number;
  kind: 'fame' | 'infamy';
  title: string;
}

export interface WorldChain {
  id: string;
  countryId: string;
  step: number;
  dueYear: number;
}

export interface WorldState {
  year: number;
  contexts: Record<string, WorldContext>;
  chronicle: ChronicleEntry[];
  activeHistorical: string[];
  institutions: ReligiousInstitution[];
  legends: Legend[];
  chains: WorldChain[];
}

// ---------------------------------------------------------------- Body & mind

export interface ChronicCondition {
  id: string;
  severity: number;
  diagnosedAge: number;
  managed: boolean;
  inherited?: boolean;
}

export interface Injury {
  id: string;
  name: string;
  age: number;
  combat: boolean;
}

export interface Cosmetic {
  id: string;
  name: string;
  age: number;
}

export interface Biology {
  heightCm: number;
  weightKg: number;
  bodyType: 'ectomorph' | 'mesomorph' | 'endomorph';
  chronic: ChronicCondition[];
  injuries: Injury[];
  cosmetics: Cosmetic[];
  /** Permanent stat ceilings from injuries (e.g. a limp caps fitness at 90). */
  caps: Partial<Record<StatId, number>>;
  /** Genetic predispositions, 0..1 extra risk multipliers. */
  predisposition: {
    addiction: number;
    depression: number;
    anxiety: number;
    heart: number;
    cancer: number;
    diabetes: number;
    dementia: number;
    bipolar: number;
  };
  steroidYears: number;
}

export interface MentalCondition {
  id: string;
  severity: number;
  onsetAge: number;
}

export interface MentalState {
  conditions: MentalCondition[];
  therapy: boolean;
  medication: boolean;
  supportGroup: boolean;
  crises: number;
  /** Opt-in dementia progression; 0 = none, 1..5 stages. */
  dementiaStage: number;
}

export type AddictionKind = 'alcohol' | 'stimulants' | 'opioids' | 'gambling' | 'sex' | 'power' | 'violence';

export interface Addiction {
  kind: AddictionKind;
  /** 0..5. Mechanics start tracking (active) at 2+. */
  severity: number;
  active: boolean;
  yearsClean: number;
  inRecovery: boolean;
  everActive: boolean;
}

// ---------------------------------------------------------------- Education & career

export interface EducationState {
  enrolled: { programId: string; yearsLeft: number; yearsDone: number } | null;
  completed: string[];
  grades: number;
  droppedOut: boolean;
  tutored: boolean;
}

export interface CareerState {
  careerId: string;
  level: number;
  yearsInRole: number;
  yearsInCareer: number;
  performance: number;
  salary: number;
  employer: string;
  bossId?: string;
  branch?: boolean;
  workEthic: 'slack' | 'normal' | 'hard';
}

export interface CareerHistoryEntry {
  careerId: string;
  title: string;
  fromAge: number;
  toAge: number;
  reason: string;
}

export interface SkillState {
  level: number;
  peak: number;
  lastUsedAge: number;
}

// ---------------------------------------------------------------- Relationships & NPCs

export type RelType =
  | 'parent'
  | 'sibling'
  | 'child'
  | 'grandchild'
  | 'grandparent'
  | 'spouse'
  | 'partner'
  | 'ex'
  | 'affair'
  | 'bestFriend'
  | 'friend'
  | 'acquaintance'
  | 'mentor'
  | 'protege'
  | 'colleague'
  | 'boss'
  | 'rival'
  | 'enemy'
  | 'nemesis'
  | 'debtHolder'
  | 'blackmailer'
  | 'informant'
  | 'businessPartner'
  | 'coConspirator'
  | 'inLaw'
  | 'bully'
  | 'cellmate'
  | 'handler';

// ---------------------------------------------------------------- Pets & possessions

export interface Pet {
  id: string;
  /** Key into PET_TYPES. */
  species: string;
  name: string;
  /** Breed or variety, e.g. "beagle", "tabby". */
  breed: string;
  /** Coat colour, used by the portrait. */
  color: string;
  birthYear: number;
  alive: boolean;
  deathYear?: number;
  health: number;
  /** How bonded the pet is to you, 0..100. */
  bond: number;
  /** Obedience / training, 0..100. */
  training: number;
  /** Free-form flags for events (e.g. lost, champion, injured). */
  meta: Record<string, number | string | boolean>;
}

export interface Item {
  id: string;
  /** Key into ITEM_TYPES. */
  typeId: string;
  name: string;
  boughtYear: number;
  /** Current resale value. */
  value: number;
  /** 0..100; vehicles and gadgets wear out. */
  condition: number;
  meta: Record<string, number | string | boolean>;
}

export interface Relationship {
  npcId: string;
  type: RelType;
  affinity: number;
  trust: number;
  attraction: number;
  compatibility: number;
  history: number;
  since: number;
  /** Tracks discretion for affairs, debts owed, secrets held, etc. */
  meta: Record<string, number | string | boolean>;
}

export type NpcLinkKind = 'ally' | 'enemy' | 'family' | 'spouse' | 'colleague' | 'gang';

export interface NpcLink {
  npcId: string;
  kind: NpcLinkKind;
}

export type Upbringing = 'balanced' | 'academic' | 'athletic' | 'criminal' | 'spiritual' | 'neglected';

export interface NPC {
  id: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  sexuality: Sexuality;
  birthYear: number;
  alive: boolean;
  deathYear?: number;
  causeOfDeath?: string;
  countryId: string;
  religionId: string;
  smarts: number;
  looks: number;
  health: number;
  karma: number;
  ambition: number;
  aggression: number;
  charisma: number;
  loyalty: number;
  fame: number;
  wealth: number;
  career: { careerId: string; level: number } | null;
  education: string[];
  traits: string[];
  links: NpcLink[];
  spouseId?: string;
  spouseName?: string;
  childIds: string[];
  parentIds: string[];
  notes: string[];
  /** Fields used for the player's children / heirs. */
  upbringing?: Upbringing;
  favor?: number;
  heightCm?: number;
  inherited?: { traits: string[]; predisposition?: Partial<Biology['predisposition']>; geneticsBonus?: number };
  dynasty?: boolean;
  criminal?: number;
}

// ---------------------------------------------------------------- Assets & underworld

export interface Asset {
  id: string;
  typeId: string;
  name: string;
  countryId: string;
  boughtYear: number;
  purchasePrice: number;
  value: number;
  mortgage: number;
  rentedOut: boolean;
  condition: number;
  level: number;
  front: boolean;
  seized: boolean;
  /** Equity multiplier / free-form per asset class state. */
  meta: Record<string, number | string | boolean>;
  dynastyEstate?: boolean;
}

export type OperationKind = 'drugs' | 'weapons' | 'cyber' | 'smuggling' | 'extortion' | 'gambling' | 'bootlegging';

export interface Operation {
  id: string;
  kind: OperationKind;
  product: string;
  stage: string;
  scale: number;
  years: number;
  lastIncome: number;
}

export interface CrimeState {
  orgName: string | null;
  orgRank: number;
  orgLoyalty: number;
  territory: number;
  operations: Operation[];
  rivalOrgs: string[];
  dirtyMoney: number;
  offshore: number;
  committed: Record<string, number>;
  /** Placement/layering/integration progress for the current dirty pool. */
  launderStage: number;
}

export interface CrimeCase {
  id: string;
  crimeId: string;
  label: string;
  evidence: number;
  severity: number;
  age: number;
  year: number;
  countryId: string;
  witnesses: string[];
  physical: boolean;
  federal: boolean;
  victimId?: string;
  status: 'open' | 'charged' | 'closed';
}

export type PrisonTier = 'county' | 'state' | 'federal' | 'supermax' | 'deathRow';

export interface PrisonState {
  tier: PrisonTier;
  sentence: number;
  served: number;
  countryId: string;
  gang: string | null;
  rank: number;
  guardFavor: number;
  escapeAttempts: number;
  goodBehavior: number;
  appeals: number;
  crimeLabel: string;
}

export interface Lawsuit {
  id: string;
  kind: 'defamation' | 'assault' | 'contract' | 'classAction' | 'patent' | 'divorce' | 'malpractice';
  role: 'plaintiff' | 'defendant';
  otherParty: string;
  amount: number;
  strength: number;
  years: number;
}

export interface LegalState {
  record: { crime: string; age: number; years: number; countryId: string }[];
  juvenileRecord: boolean;
  cases: CrimeCase[];
  prison: PrisonState | null;
  parole: number;
  probation: number;
  lawsuits: Lawsuit[];
  interpolNotice: boolean;
  fugitive: boolean;
  witnessProtection: { years: number; threat: number; formerName: string } | null;
  lawyer: number;
  arrests: number;
}

// ---------------------------------------------------------------- Media, spirit, politics

export type StoryKind =
  | 'puff'
  | 'expose'
  | 'gossip'
  | 'allegation'
  | 'scandal'
  | 'humanitarian'
  | 'threat'
  | 'obituary'
  | 'profile';

export interface Story {
  year: number;
  age: number;
  kind: StoryKind;
  outlet: string;
  headline: string;
  sentiment: number;
  planted?: boolean;
}

export interface Secret {
  id: string;
  text: string;
  severity: number;
  age: number;
  exposed: boolean;
}

export interface MediaState {
  stories: Story[];
  secrets: Secret[];
  cancelled: { severity: number; years: number } | null;
  followers: number;
  prFirm: boolean;
}

export interface Pact {
  id: string;
  name: string;
  boon: string;
  cost: string;
  age: number;
}

export interface Curse {
  id: string;
  level: number;
  source: string;
}

export interface Blessing {
  id: string;
  level: number;
  source: string;
}

export interface SpiritualState {
  pacts: Pact[];
  soulSold: boolean;
  curses: Curse[];
  blessings: Blessing[];
  rituals: number;
  societies: string[];
  invites: string[];
  foundedReligion: string | null;
  followers: number;
  miraclesUsed: number;
  visions: string[];
}

export interface PoliticalState {
  office: string | null;
  officeCountry: string | null;
  term: number;
  party: string | null;
  cabinet: string[];
  laws: string[];
  wars: string[];
  electionsWon: number;
  electionsLost: number;
  dictator: boolean;
  coupRisk: number;
}

export interface Memory {
  age: number;
  year: number;
  tag: string;
  text: string;
  significance: number;
  npcId?: string;
}

export interface ActiveChain {
  chainId: string;
  step: number;
  dueAge: number;
  params: Record<string, string | number>;
}

export interface LogEntry {
  age: number;
  year: number;
  text: string;
  tone: Tone;
}

export interface WillState {
  shares: Record<string, number>;
  charity: number;
  trustFund: boolean;
}

export interface Character {
  id: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  sexuality: Sexuality;
  birthYear: number;
  age: number;
  alive: boolean;
  causeOfDeath?: string;
  deathType?: DeathType;
  countryId: string;
  birthCountryId: string;
  religionId: string;
  familyStatus: FamilyStatus;
  familyHealth: FamilyHealth;
  generation: number;
  stats: Stats;
  money: number;
  debt: number;
  lifestyle: 'frugal' | 'modest' | 'comfortable' | 'lavish';
  diet: 'poor' | 'balanced' | 'healthy' | 'excessive';
  exercise: number;
  bio: Biology;
  mental: MentalState;
  addictions: Addiction[];
  education: EducationState;
  career: CareerState | null;
  careerHistory: CareerHistoryEntry[];
  retired: boolean;
  skills: Record<string, SkillState>;
  hobbies: string[];
  relationships: Relationship[];
  assets: Asset[];
  pets: Pet[];
  items: Item[];
  legal: LegalState;
  crime: CrimeState;
  media: MediaState;
  spiritual: SpiritualState;
  politics: PoliticalState;
  traits: string[];
  memories: Memory[];
  chains: ActiveChain[];
  flags: Record<string, number | string | boolean>;
  eventHistory: Record<string, number>;
  totals: { happiness: number; health: number; years: number };
  lifespan: { geneticsBonus: number; offset: number };
  will: WillState | null;
  ap: number;
  apMax: number;
  log: LogEntry[];
}

export type DeathType =
  | 'peaceful'
  | 'hospital'
  | 'murder'
  | 'accident'
  | 'execution'
  | 'martyrdom'
  | 'overdose'
  | 'organFailure'
  | 'combat'
  | 'disease'
  | 'prison'
  | 'infancy';

// ---------------------------------------------------------------- Dynasty

export type DynastyRepKey = 'criminal' | 'political' | 'social' | 'spiritual' | 'scholarly' | 'business';

export interface DynastyMember {
  id: string;
  name: string;
  generation: number;
  birthYear: number;
  deathYear: number;
  age: number;
  cause: string;
  deathType: DeathType;
  title: string;
  netWorth: number;
  fame: number;
  infamy: number;
  karma: number;
  afterlife: AfterlifeTrack;
  epitaph: string;
  legendary: boolean;
  countryId: string;
}

export type AfterlifeTrack = 'heaven' | 'reincarnation' | 'purgatory' | 'hell' | 'transcendence';

export interface Dynasty {
  id: string;
  name: string;
  foundedYear: number;
  generation: number;
  reputation: Record<DynastyRepKey, number>;
  prestige: number;
  totalWealth: number;
  members: DynastyMember[];
  curses: Curse[];
  blessings: Blessing[];
  enemies: { npcId?: string; name: string; reason: string; generation: number }[];
  allies: { npcId?: string; name: string; reason: string; generation: number }[];
  institutions: { kind: 'party' | 'church' | 'crimeOrg' | 'company'; name: string }[];
  milestones: string[];
  crest: string | null;
  motto: string | null;
  estateAssetId: string | null;
  traitPool: string[];
  /** Narrative carry-over from the last afterlife reading. */
  omen: AfterlifeTrack | null;
}

// ---------------------------------------------------------------- Events & game state

export type Params = Record<string, string | number | boolean | undefined>;

export interface PendingEvent {
  uid: string;
  eventId: string;
  params: Params;
  age: number;
  /** Indices into the event's choices that the player can see this time. */
  visible: number[];
  /** Notes about how the character's mind distorted the choice list. */
  distortions: string[];
  chainId?: string;
  prepared?: boolean;
  /** Cached at preparation so rendering never consumes randomness. */
  title?: string;
  text?: string;
  labels?: string[];
  hints?: (string | undefined)[];
}

export interface ResolvedEvent {
  title: string;
  text: string;
  choice?: string;
  outcome: string;
  age: number;
  /** Background-scene hint for the outcome (UI only; the engine never reads it). */
  scene?: string;
}

export interface Settings {
  dementiaPath: boolean;
  matureThemes: boolean;
}

export interface GameState {
  version: number;
  seed: number;
  rng: number;
  nextId: number;
  phase: 'alive' | 'dead' | 'over';
  world: WorldState;
  dynasty: Dynasty;
  char: Character;
  npcs: Record<string, NPC>;
  queue: PendingEvent[];
  recent: ResolvedEvent[];
  settings: Settings;
  /** Filled when the character dies; consumed by the legacy screen. */
  death: DeathReport | null;
}

export interface AfterlifeCard {
  title: string;
  text: string;
}

export interface DeathReport {
  name: string;
  age: number;
  year: number;
  cause: string;
  deathType: DeathType;
  obituary: string;
  afterlife: AfterlifeTrack;
  cards: AfterlifeCard[];
  estate: number;
  inheritancePool: number;
  heirs: { npcId: string; name: string; age: number; share: number; relation: string }[];
  prestigeGained: number;
  legendary: boolean;
  milestones: string[];
}
