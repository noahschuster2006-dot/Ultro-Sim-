export interface OfficeDef {
  id: string;
  name: string;
  tier: number;
  minAge: number;
  campaignCost: number;
  salary: number;
  term: number;
  /** Career ladder level that this office corresponds to (politician career). */
  level: number;
  needsOffice?: string[];
  minApproval: number;
  headOfState?: boolean;
  grantsTerritory?: boolean;
  appointed?: boolean;
}

export const OFFICES: OfficeDef[] = [
  { id: 'cityCouncil', name: 'City councillor', tier: 1, minAge: 18, campaignCost: 5000, salary: 30000, term: 4, level: 2, minApproval: 20 },
  { id: 'mayor', name: 'Mayor', tier: 2, minAge: 21, campaignCost: 60000, salary: 95000, term: 4, level: 3, minApproval: 35 },
  { id: 'stateLegislator', name: 'State legislator', tier: 3, minAge: 21, campaignCost: 90000, salary: 80000, term: 4, level: 4, minApproval: 35 },
  { id: 'nationalLegislator', name: 'National legislator', tier: 4, minAge: 25, campaignCost: 600000, salary: 175000, term: 6, level: 5, needsOffice: ['mayor', 'stateLegislator', 'cityCouncil'], minApproval: 45 },
  { id: 'governor', name: 'Governor', tier: 5, minAge: 30, campaignCost: 2500000, salary: 190000, term: 4, level: 6, needsOffice: ['mayor', 'stateLegislator', 'nationalLegislator'], minApproval: 50, grantsTerritory: true },
  { id: 'cabinetMinister', name: 'Cabinet minister', tier: 6, minAge: 30, campaignCost: 0, salary: 210000, term: 4, level: 7, needsOffice: ['nationalLegislator', 'governor'], minApproval: 45, appointed: true },
  { id: 'headOfGovernment', name: 'Head of government', tier: 8, minAge: 35, campaignCost: 12000000, salary: 400000, term: 4, level: 9, needsOffice: ['governor', 'nationalLegislator', 'cabinetMinister'], minApproval: 55, headOfState: true },
];

export const OFFICE_BY_ID: Record<string, OfficeDef> = Object.fromEntries(OFFICES.map((o) => [o.id, o]));

export interface LawDef {
  id: string;
  name: string;
  minTier: number;
  desc: string;
  approval: number;
  economy: number;
  stability: number;
  crime: number;
  norms: number;
  karma: number;
  autocratic?: boolean;
}

export const LAWS: LawDef[] = [
  { id: 'taxCut', name: 'Cut taxes', minTier: 3, desc: 'Popular now, deficits later.', approval: 6, economy: 3, stability: 0, crime: 0, norms: 0, karma: 0 },
  { id: 'taxHike', name: 'Raise taxes on the rich', minTier: 3, desc: 'Fund services; donors abandon you.', approval: -2, economy: -1, stability: 2, crime: -1, norms: 1, karma: 2 },
  { id: 'healthcare', name: 'Universal healthcare', minTier: 4, desc: 'Expensive, life-extending, polarizing.', approval: 2, economy: -2, stability: 3, crime: -1, norms: 2, karma: 5 },
  { id: 'crackdown', name: 'Crime crackdown', minTier: 2, desc: 'Police powers up. Criminals feel the heat.', approval: 4, economy: 0, stability: 2, crime: -8, norms: -2, karma: 0 },
  { id: 'legalizeCannabis', name: 'Legalize cannabis', minTier: 4, desc: 'Collapses the black-market cannabis trade.', approval: 1, economy: 1, stability: 0, crime: -3, norms: 3, karma: 1 },
  { id: 'censorship', name: 'Media censorship', minTier: 6, desc: 'Silence critics. Stories about you get buried.', approval: -4, economy: -1, stability: 3, crime: 0, norms: -5, karma: -5, autocratic: true },
  { id: 'infrastructure', name: 'Infrastructure bill', minTier: 2, desc: 'Roads, rails and ribbon-cuttings.', approval: 4, economy: 4, stability: 1, crime: 0, norms: 0, karma: 1 },
  { id: 'welfare', name: 'Expand welfare', minTier: 3, desc: 'Lift the poor; anger the frugal.', approval: 2, economy: -1, stability: 3, crime: -3, norms: 1, karma: 4 },
  { id: 'deregulation', name: 'Deregulate business', minTier: 4, desc: 'Boom now, scandal later.', approval: 1, economy: 5, stability: -1, crime: 2, norms: 0, karma: -2 },
  { id: 'militaryBuildup', name: 'Military buildup', minTier: 6, desc: 'Arms manufacturers celebrate.', approval: 2, economy: 1, stability: 2, crime: 0, norms: -1, karma: -1 },
  { id: 'civilRights', name: 'Civil rights act', minTier: 4, desc: 'Expand rights and protections.', approval: 0, economy: 1, stability: -1, crime: 0, norms: 8, karma: 6 },
  { id: 'prohibitionLaw', name: 'Prohibition', minTier: 8, desc: 'Ban alcohol. Bootleggers rejoice.', approval: -3, economy: -2, stability: -2, crime: 10, norms: -2, karma: 0 },
  { id: 'emergencyPowers', name: 'Emergency powers', minTier: 8, desc: 'Rule by decree. Cements power.', approval: -6, economy: 0, stability: 4, crime: -2, norms: -6, karma: -6, autocratic: true },
  { id: 'abolishTermLimits', name: 'Abolish term limits', minTier: 8, desc: 'Why leave? The path to dictatorship.', approval: -10, economy: 0, stability: -5, crime: 0, norms: -4, karma: -8, autocratic: true },
];

export const LAW_BY_ID: Record<string, LawDef> = Object.fromEntries(LAWS.map((l) => [l.id, l]));
