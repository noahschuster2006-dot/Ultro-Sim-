export interface SocietyDef {
  id: string;
  name: string;
  kind: string;
  fromYear: number;
  benefit: string;
  cost: string;
  /** Short invite condition description shown in the UI. */
  invite: string;
}

export const SOCIETIES: SocietyDef[] = [
  { id: 'compassLodge', name: 'The Compass Lodge', kind: 'Fraternal lodge', fromYear: 1717, benefit: 'Powerful business and political network: career and election bonuses.', cost: 'Loyalty oaths; dues; members expect favors.', invite: 'Wealth, professional reputation or political office.' },
  { id: 'ninefoldEye', name: 'The Ninefold Eye', kind: 'Secret cabal', fromYear: 1776, benefit: 'Forbidden knowledge and global influence: world events bend toward you.', cost: 'Sacrifice of public reputation or a relationship when called upon.', invite: 'Fame 70+ or extreme wealth.' },
  { id: 'ashenCoven', name: 'The Ashen Coven', kind: 'Infernal coven', fromYear: -800, benefit: 'Ritual abilities; demonic pact offers come faster.', cost: 'Blood oaths, sin, exposure risk.', invite: 'Karma below −40 and ritual knowledge.' },
  { id: 'antlerOrder', name: 'Order of the Antler', kind: 'Shamanic order', fromYear: -800, benefit: 'Spirit-walking, healing rites, paranormal insight.', cost: 'Long retreats; mainstream careers suffer.', invite: 'Paranormal sensitivity 40+.' },
];

export const SOCIETY_BY_ID: Record<string, SocietyDef> = Object.fromEntries(SOCIETIES.map((s) => [s.id, s]));

export interface PactDef {
  id: string;
  name: string;
  boon: string;
}

export const PACTS: PactDef[] = [
  { id: 'wealth', name: 'Pact of Gold', boon: 'A fortune appears: $5,000,000 and money gains doubled for a decade.' },
  { id: 'fame', name: 'Pact of the Spotlight', boon: 'Fame +60 and adoring crowds.' },
  { id: 'beauty', name: 'Pact of the Mirror', boon: 'Looks set to 100; you stop aging visibly.' },
  { id: 'power', name: 'Pact of Dominion', boon: 'Rivals fall; political approval and criminal rep surge.' },
  { id: 'longevity', name: 'Pact of Years', boon: 'Health restored to 100; disease cured.' },
  { id: 'vengeance', name: 'Pact of Ruin', boon: 'Your greatest enemy is destroyed.' },
];

export const PACT_COSTS = [
  { id: 'family', name: 'Lose a family member' },
  { id: 'years', name: 'Reduce your life by 20 years' },
  { id: 'curse', name: 'A permanent curse on your dynasty' },
];

export interface CurseDef {
  id: string;
  name: string;
  effect: string;
  breakPath: string;
}

export const CURSES: CurseDef[] = [
  { id: 'poverty', name: 'Curse of Poverty', effect: 'All wealth gains halved.', breakPath: 'A great act of charity (give away 25% of your wealth) or exorcism.' },
  { id: 'violence', name: 'Curse of Blood', effect: 'Violent events 3× more likely.', breakPath: 'A redemption arc: years of non-violence and atonement.' },
  { id: 'infertility', name: 'Curse of the Barren Line', effect: 'No children without divine intervention.', breakPath: 'Divine favor 50+ and a pilgrimage, or exorcism.' },
  { id: 'madness', name: 'Curse of Madness', effect: 'Mental-health stats decay twice as fast.', breakPath: 'Exorcism or a sacrificial act.' },
  { id: 'misfortune', name: 'Curse of Misfortune', effect: 'Accidents and bad luck follow you.', breakPath: 'Exorcism.' },
];

export const CURSE_BY_ID: Record<string, CurseDef> = Object.fromEntries(CURSES.map((c) => [c.id, c]));

export const BLESSINGS: { id: string; name: string; effect: string }[] = [
  { id: 'fortune', name: 'Blessing of Fortune', effect: 'Money gains +25%.' },
  { id: 'vitality', name: 'Blessing of Vitality', effect: 'Health decays slower; lifespan +3.' },
  { id: 'fertility', name: 'Blessing of Abundance', effect: 'Children come easily and healthy.' },
  { id: 'wisdom', name: 'Blessing of Wisdom', effect: 'Smarts and wisdom grow faster.' },
  { id: 'protection', name: 'Blessing of Protection', effect: 'Violent events are less likely to hurt you.' },
];

export const BLESSING_BY_ID: Record<string, { id: string; name: string; effect: string }> = Object.fromEntries(BLESSINGS.map((b) => [b.id, b]));

export const TRAITS: { id: string; name: string; desc: string; dynasty?: string }[] = [
  { id: 'aggressive', name: 'Aggressive', desc: 'Starts with high aggression; violent events weigh more.', dynasty: 'criminal' },
  { id: 'empathetic', name: 'Empathetic', desc: 'Empathy and karma grow faster.' },
  { id: 'cunning', name: 'Cunning', desc: 'Criminal and social skills train faster.', dynasty: 'criminal' },
  { id: 'scholarly', name: 'Scholarly', desc: 'Learning speed bonus.', dynasty: 'scholarly' },
  { id: 'athletic', name: 'Athletic', desc: 'Fitness potential bonus.' },
  { id: 'charismatic', name: 'Charismatic', desc: 'Charisma bonus; people like you.', dynasty: 'political' },
  { id: 'devout', name: 'Devout', desc: 'Faith comes naturally.', dynasty: 'spiritual' },
  { id: 'riskTaker', name: 'Risk-taker', desc: 'High risk tolerance from birth.' },
  { id: 'addictive', name: 'Addictive personality', desc: 'Addiction susceptibility up.' },
  { id: 'melancholic', name: 'Melancholic', desc: 'Depression predisposition.' },
  { id: 'anxious', name: 'Anxious', desc: 'Anxiety predisposition.' },
  { id: 'resilient', name: 'Resilient', desc: 'Trauma hits softer.' },
  { id: 'shrewd', name: 'Shrewd', desc: 'Business skills train faster; better returns.', dynasty: 'business' },
  { id: 'artistic', name: 'Artistic', desc: 'Creative skills train faster.' },
  { id: 'longLived', name: 'Long-lived', desc: 'Genetics add years to life.' },
  { id: 'frail', name: 'Frail', desc: 'Health predispositions are worse.' },
  { id: 'beautiful', name: 'Striking looks', desc: 'Looks bonus.' },
  { id: 'paranormal', name: 'Second sight', desc: 'Paranormal sensitivity from birth.' },
];

export const TRAIT_BY_ID: Record<string, { id: string; name: string; desc: string; dynasty?: string }> = Object.fromEntries(TRAITS.map((t) => [t.id, t]));

export const HOBBIES: { id: string; name: string; skills: string[]; fromYear: number }[] = [
  { id: 'sports', name: 'Sports', skills: ['ballSports', 'running'], fromYear: -800 },
  { id: 'music', name: 'Music', skills: ['music', 'singing'], fromYear: -800 },
  { id: 'art', name: 'Art', skills: ['art', 'design'], fromYear: -800 },
  { id: 'reading', name: 'Reading', skills: ['literacy', 'history'], fromYear: -800 },
  { id: 'gaming', name: 'Video games', skills: ['gameDesign', 'programming'], fromYear: 1975 },
  { id: 'streetLife', name: 'Street life', skills: ['streetwise', 'streetFighting'], fromYear: -800 },
  { id: 'cooking', name: 'Cooking', skills: ['cooking', 'baking'], fromYear: -800 },
  { id: 'building', name: 'Building things', skills: ['construction', 'mechanics'], fromYear: -800 },
  { id: 'martialArts', name: 'Martial arts', skills: ['martialArts', 'selfDefense'], fromYear: -800 },
  { id: 'acting', name: 'Theatre', skills: ['acting', 'dance'], fromYear: -800 },
  { id: 'coding', name: 'Coding', skills: ['programming', 'webDevelopment'], fromYear: 1980 },
  { id: 'faith', name: 'Religious study', skills: ['scripture', 'prayer'], fromYear: -800 },
];
