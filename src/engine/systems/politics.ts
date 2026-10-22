import type { Ctx } from '../ctx';
import { LAWS, LAW_BY_ID, OFFICES, OFFICE_BY_ID, type OfficeDef } from '../data/politics';
import { CAREER_BY_ID } from '../data/careers';
import { PARTY_NAMES } from '../data/names';
import { countryName } from '../data/countries';
import { startCareer, endCareer } from './careers';
import { rulerTitle } from './world';
import { expose } from './addiction';
import { imprison } from './legal';

export function democratic(x: Ctx): boolean {
  return x.w.regime === 'democracy';
}

export function officeEligibility(x: Ctx, o: OfficeDef): true | string {
  const c = x.c;
  const P = c.politics;
  if (c.legal.prison) return 'You are in prison';
  if (P.office === o.id) return 'You already hold this office';
  if (!democratic(x) && !o.appointed) return `${countryName(c.countryId, x.year)} does not hold free elections (${x.w.regime})`;
  if (c.age < o.minAge) return `Minimum age ${o.minAge}`;
  if (o.needsOffice && !o.needsOffice.some((id) => P.office === id || c.flags[`held_${id}`])) return `Requires prior office: ${o.needsOffice.map((id) => OFFICE_BY_ID[id].name).join(' / ')}`;
  if (x.stat('politicalApproval') < o.minApproval) return `Requires political approval ${o.minApproval}+`;
  if (o.campaignCost && c.money < o.campaignCost) return `Campaign costs ${x.fmt(o.campaignCost)}`;
  if (o.appointed && !P.party) return 'Requires party membership';
  if (c.countryId !== c.birthCountryId && o.tier >= 4) return 'Must be native-born';
  if (x.w.socialNorms < 30 && c.gender === 'female') return 'Women cannot hold office in this era';
  return true;
}

export function joinParty(x: Ctx): string {
  if (x.c.politics.party) return `You are already in ${x.c.politics.party}.`;
  x.c.politics.party = x.pick(PARTY_NAMES);
  x.mod('politicalApproval', 4);
  return `You joined ${x.c.politics.party}.`;
}

export function campaign(x: Ctx): string {
  x.train('publicSpeaking', 4);
  x.mods({ politicalApproval: 3 + x.stat('charisma') / 30, fame: 1, stress: 2 });
  return 'You knocked on doors and shook hands.';
}

/** Run for office. Win probability weighs approval, charisma, fame, money and scandal. */
export function runForOffice(x: Ctx, officeId: string): string {
  const o = OFFICE_BY_ID[officeId];
  if (!o) return 'Unknown office.';
  const e = officeEligibility(x, o);
  if (e !== true) return e;
  const c = x.c;
  x.spend(o.campaignCost);
  const scandals = c.media.secrets.filter((s) => s.exposed).length;
  let p = x.stat('politicalApproval') / 140 + x.stat('charisma') / 400 + x.stat('fame') / 500 + x.skill('publicSpeaking') / 500 + x.skill('propaganda') / 600;
  if (c.spiritual.societies.includes('compassLodge')) p += 0.08;
  if (c.politics.party) p += 0.05;
  if (c.politics.office) p += 0.06;
  p -= scandals * 0.05 + x.stat('infamy') / 300;
  if (o.appointed) p = 0.25 + x.stat('politicalApproval') / 200 + x.stat('corruption') / 300;
  p = Math.max(0.05, Math.min(0.9, p));
  if (!x.chance(p)) {
    c.politics.electionsLost++;
    x.mods({ happiness: -8, politicalApproval: -4, confidence: -4 });
    return o.appointed ? `You were passed over for ${o.name}.` : `You lost the race for ${o.name}.`;
  }
  takeOffice(x, o);
  return o.appointed ? `You were appointed ${o.name}!` : `You won! You are now ${o.name}.`;
}

export function takeOffice(x: Ctx, o: OfficeDef): void {
  const c = x.c;
  const P = c.politics;
  if (P.office) c.flags[`held_${P.office}`] = true;
  P.office = o.id;
  P.officeCountry = c.countryId;
  P.term = o.term;
  P.electionsWon++;
  c.flags[`held_${o.id}`] = true;
  const pol = CAREER_BY_ID.politician;
  if (c.career?.careerId !== 'politician') startCareer(x, pol, o.level);
  else c.career.level = o.level;
  c.career!.salary = o.salary;
  x.mods({ fame: 4 + o.tier * 2, happiness: 10, ego: o.tier, politicalApproval: 5 });
  x.remember('elected', `Became ${o.name}`, 30 + o.tier * 8);
  if (o.grantsTerritory && !c.assets.some((a) => a.typeId === 'territory')) {
    c.assets.push({ id: x.uid('a'), typeId: 'territory', name: `Governorship of ${countryName(c.countryId, x.year)} province`, countryId: c.countryId, boughtYear: x.year, purchasePrice: 0, value: 0, mortgage: 0, rentedOut: false, condition: 100, level: 1, front: false, seized: false, meta: {} });
  }
  if (o.headOfState) {
    const ctx = x.w;
    ctx.ruler = `${rulerTitle(ctx.regime, c.gender === 'female' ? 'female' : 'male')} ${c.firstName} ${c.lastName}`;
    ctx.rulerSince = x.year;
    x.s.dynasty.institutions.push({ kind: 'party', name: P.party ?? 'the ruling party' });
  }
  if (o.tier >= 4) x.secret('campaignFinance', 'Irregular campaign donations', 3);
}

export function leaveOffice(x: Ctx, reason: string): void {
  const c = x.c;
  const P = c.politics;
  if (!P.office) return;
  c.flags[`held_${P.office}`] = true;
  P.office = null;
  P.term = 0;
  P.dictator = false;
  c.assets = c.assets.filter((a) => a.typeId !== 'territory');
  if (c.career?.careerId === 'politician') endCareer(x, reason);
  x.log(`🏛️ You left office (${reason}).`, 'major');
}

export function passLaw(x: Ctx, lawId: string): string {
  const c = x.c;
  const law = LAW_BY_ID[lawId];
  const o = c.politics.office ? OFFICE_BY_ID[c.politics.office] : undefined;
  if (!law || !o) return 'You hold no office.';
  if (o.tier < law.minTier) return `Requires a higher office.`;
  const ctx = x.w;
  if (ctx.policies.includes(lawId)) return 'That law is already on the books.';
  if (law.autocratic && ctx.regime === 'democracy' && x.stat('politicalApproval') < 60 && !c.politics.dictator) {
    if (x.chance(0.6)) {
      x.mods({ politicalApproval: -10 });
      return 'The legislature and courts blocked your power grab.';
    }
  }
  ctx.policies.push(lawId);
  ctx.econShock += law.economy * 2;
  ctx.stabShock += law.stability * 2;
  ctx.crimeShock += law.crime;
  ctx.normsShift += law.norms;
  if (lawId === 'prohibitionLaw') ctx.prohibition = true;
  if (lawId === 'legalizeCannabis') ctx.cannabisLegal = true;
  c.politics.laws.push(lawId);
  x.mods({ politicalApproval: law.approval, karma: law.karma });
  if (law.autocratic) {
    expose(x, 'power', 0.8);
    if (lawId === 'abolishTermLimits' || lawId === 'emergencyPowers') c.politics.dictator = true;
    if (c.politics.dictator) ctx.regimeOverride = 'autocracy';
  }
  x.remember('law', `Passed ${law.name}`, 20 + o.tier * 3);
  return `${law.name} is now law. ${law.desc}`;
}

export function declareWar(x: Ctx, targetId: string): string {
  const c = x.c;
  if (c.politics.office !== 'headOfGovernment' && c.career?.careerId !== 'monarch' && c.career?.careerId !== 'emperor') return 'Only a head of state can declare war.';
  if (targetId === c.countryId) return 'You cannot declare war on yourself.';
  const mine = x.w;
  const theirs = x.s.world.contexts[targetId];
  if (!theirs) return 'That country does not exist yet.';
  const name = `war with ${countryName(targetId, x.year)}`;
  mine.procWar = { name, years: x.int(2, 6), level: 'major' };
  theirs.procWar = { name: `war with ${countryName(c.countryId, x.year)}`, years: mine.procWar.years, level: 'major' };
  c.politics.wars.push(targetId);
  x.mods({ politicalApproval: 10, karma: -10, sin: 5, stress: 10 });
  x.s.world.chronicle.push({ year: x.year, countryId: c.countryId, title: 'War declared', text: `${c.firstName} ${c.lastName} declares war on ${countryName(targetId, x.year)}.` });
  x.remember('declaredWar', `Declared war on ${countryName(targetId, x.year)}`, 70);
  x.queue('war_outcome', { target: targetId });
  return `You declared war on ${countryName(targetId, x.year)}. The nation rallies — for now.`;
}

export function imposeSanctions(x: Ctx, targetId: string): string {
  const c = x.c;
  const o = c.politics.office ? OFFICE_BY_ID[c.politics.office] : undefined;
  if ((!o || o.tier < 6) && c.career?.careerId !== 'monarch') return 'Requires cabinet rank or head of state.';
  const t = x.s.world.contexts[targetId];
  if (!t) return 'Unknown country.';
  t.sanctions = 5;
  t.econShock -= 8;
  x.w.econShock -= 2;
  x.mod('politicalApproval', 2);
  return `Sanctions imposed on ${countryName(targetId, x.year)}. Smugglers and arms dealers take note.`;
}

export function appointCrony(x: Ctx, npcId: string): string {
  const c = x.c;
  if (!c.politics.office || OFFICE_BY_ID[c.politics.office].tier < 5) return 'Requires governor rank or higher.';
  if (c.politics.cabinet.includes(npcId)) return 'Already appointed.';
  c.politics.cabinet.push(npcId);
  x.relMod(npcId, 15, 10);
  x.mods({ corruption: 4, politicalApproval: -1 });
  return `You appointed ${x.name(npcId)} to your cabinet.`;
}

export function stageCoup(x: Ctx): string {
  const c = x.c;
  const officer = c.career?.careerId === 'militaryOfficer' && c.career.level >= 7;
  const boss = c.crime.orgRank >= 4;
  if (!officer && !boss && !c.politics.office) return 'You need an army: senior military rank, a crime empire, or high office.';
  const ctx = x.w;
  const p = 0.15 + (100 - ctx.stability) / 200 + (officer ? 0.15 : 0) + x.stat('fear') / 400;
  if (x.chance(p)) {
    ctx.regimeOverride = 'junta';
    if (c.politics.office) c.flags[`held_${c.politics.office}`] = true;
    c.politics.office = 'headOfGovernment';
    c.politics.dictator = true;
    c.politics.term = 99;
    const pol = CAREER_BY_ID.politician;
    startCareer(x, pol, 9);
    ctx.ruler = `General ${c.firstName} ${c.lastName}`;
    ctx.rulerSince = x.year;
    x.mods({ fear: 30, politicalApproval: -10, fame: 30, karma: -20, ego: 15 });
    x.remember('coup', 'Seized power in a coup', 90);
    x.s.world.chronicle.push({ year: x.year, countryId: c.countryId, title: 'Coup', text: `${c.firstName} ${c.lastName} seizes power.` });
    return 'The coup succeeded. You rule by force.';
  }
  if (x.chance(0.6)) {
    if (c.politics.office) leaveOffice(x, 'Failed coup');
    imprison(x, x.int(10, 25), 'Treason', undefined, true);
    return 'The coup failed. You were arrested and convicted of treason.';
  }
  x.mods({ heat: 30, paranoia: 15 });
  return 'The coup failed. You escaped — for now.';
}

/** Yearly politics: approval drift, terms, re-elections, impeachments, coups. */
export function politicsTick(x: Ctx): void {
  const c = x.c;
  const P = c.politics;
  if (!P.office) {
    x.mod('politicalApproval', (30 - x.stat('politicalApproval')) * 0.05);
    return;
  }
  const o = OFFICE_BY_ID[P.office];
  const w = x.s.world.contexts[P.officeCountry ?? c.countryId] ?? x.w;
  x.mod('politicalApproval', (w.economy - 50) / 12 + (w.stability - 50) / 25 + x.float(-4, 3) - (w.war !== 'none' && P.wars.length ? 3 : 0));
  x.train('negotiation', 2);
  x.mod('corruption', x.stat('karma') < 0 ? 1 : 0);
  if (o.tier >= 5) {
    const pa = c.addictions.find((a) => a.kind === 'power');
    if (!pa || pa.severity < 2) expose(x, 'power', 0.4);
  }
  P.term--;
  const approval = x.stat('politicalApproval');
  const scandal = c.media.secrets.some((s) => s.exposed && s.age >= c.age - 2);
  if (approval < 20 && (scandal || x.stat('corruption') > 50) && o.tier >= 2 && !P.dictator && !x.queued('impeachment')) x.queue('impeachment');
  if (P.dictator && w.stability < 30 && x.chance(0.15)) x.queue('coup_against_you');
  if (P.term <= 0 && !P.dictator) {
    if (x.queued('reelection')) return;
    x.queue('reelection', { officeId: o.id });
  }
}

export { LAWS, OFFICES };
