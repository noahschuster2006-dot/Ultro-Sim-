import type { Ctx } from '../ctx';
import { CRIME_BY_ID, PRISON_GANGS, PRISON_TIERS } from '../data/underworld';
import { COUNTRY_BY_ID, canExtradite, countryName } from '../data/countries';
import { CAREER_BY_ID } from '../data/careers';
import type { CrimeCase, PrisonTier } from '../types';
import { endCareer } from './careers';
import { injure } from './body';
import { trauma } from './mind';
import { makeNpc, ripple } from './npcs';
import { firstName } from './naming';

export function updateEvidenceStat(x: Ctx): void {
  const open = x.c.legal.cases.filter((k) => k.status !== 'closed');
  x.set('evidence', open.length ? Math.max(...open.map((k) => k.evidence)) : 0);
}

/** Every crime generates a case with evidence 0–100 that decays over time. */
export function openCase(x: Ctx, crimeId: string, o: { victimId?: string; mult?: number; witnesses?: number; label?: string } = {}): CrimeCase {
  const def = CRIME_BY_ID[crimeId];
  const skill = def.skill ? x.skill(def.skill) : 0;
  let ev = def.evidence * (1 - skill / 160) * x.float(0.6, 1.35) * (1 + x.stat('heat') / 250) * (o.mult ?? 1);
  if (x.c.flags.mobCounsel) ev *= 0.85;
  const witnesses: string[] = [];
  const wn = o.witnesses ?? (x.chance(0.4) ? x.int(1, 2) : 0);
  for (let i = 0; i < wn; i++) {
    const w = makeNpc(x, { age: x.int(18, 70), career: null });
    witnesses.push(w.id);
    ev += 8;
  }
  // Fear silences witnesses.
  ev -= x.stat('fear') / 8;
  const k: CrimeCase = {
    id: x.uid('case'),
    crimeId,
    label: o.label ?? def.name,
    evidence: Math.max(3, Math.min(100, Math.round(ev))),
    severity: def.severity,
    age: x.age,
    year: x.year,
    countryId: x.c.countryId,
    witnesses,
    physical: !!def.physical,
    federal: !!def.federal,
    victimId: o.victimId,
    status: 'open',
  };
  x.c.legal.cases.push(k);
  x.mod('heat', def.heat);
  updateEvidenceStat(x);
  return k;
}

export interface CrimeResult {
  ok: boolean;
  caught: boolean;
  text: string;
  caseId?: string;
}

/** Player-initiated crime: success roll, payout, karma, evidence. */
export function commitCrime(x: Ctx, crimeId: string, victimId?: string): CrimeResult {
  const def = CRIME_BY_ID[crimeId];
  const c = x.c;
  if (!def) return { ok: false, caught: false, text: 'Unknown crime.' };
  const skill = def.skill ? x.skill(def.skill) : 0;
  let p = def.success + skill / 180 + (crimeId === 'pickpocket' ? x.stat('dexterity') / 400 : 0) + (def.violent ? x.stat('fitness') / 500 : 0);
  if (x.curse('misfortune')) p -= 0.1;
  p = Math.max(0.05, Math.min(0.95, p));
  const ok = x.chance(p);
  if (def.skill) x.train(def.skill, ok ? 5 : 3);
  x.mods({ karma: def.karma, sin: def.sin, riskTolerance: ok ? 2 : 0 });
  c.crime.committed[crimeId] = (c.crime.committed[crimeId] ?? 0) + 1;
  if (c.age < 18) c.flags.teenCrime = true;
  x.remember(`crime_${crimeId}`, `Committed ${def.name.toLowerCase()}${victimId ? ` against ${x.name(victimId)}` : ''}`, 10 + def.severity * 5, victimId);
  x.remember('crime', `Committed ${def.name.toLowerCase()}`, 8 + def.severity * 4, victimId);
  let text: string;
  if (ok) {
    const payout = def.payout[1] > 0 ? x.int(def.payout[0], def.payout[1]) : 0;
    if (payout > 0) {
      if (payout > 20000) c.crime.dirtyMoney += payout;
      else x.money(payout);
    }
    x.mods({ streetCred: def.severity * 1.5, criminalRep: def.severity, happiness: payout > 0 ? 3 : 0 });
    text = payout > 0 ? `${def.name} succeeded. You got away with ${x.fmt(payout)}${payout > 20000 ? ' (dirty money — launder it)' : ''}.` : `${def.name}: done.`;
  } else {
    text = `${def.name} went wrong.`;
  }
  if (def.violent) {
    x.mod('aggression', 3);
    x.mod('empathy', -2);
    if (victimId) {
      x.relMod(victimId, -40, -40);
      const allies = ripple(x, victimId, -25, def.name);
      if (allies.length) text += ` ${allies.length} of their friends and family now hate you.`;
    }
    if (crimeId === 'murder' && victimId) {
      const v = x.s.npcs[victimId];
      if (v && ok) {
        v.alive = false;
        v.deathYear = x.year;
        v.causeOfDeath = 'murder';
        trauma(x, 25, 'violence');
        x.secret(`murder_${victimId}`, `The murder of ${x.name(victimId)}`, 10);
        text = `You killed ${x.name(victimId)}.`;
      }
    }
    if (!ok && x.chance(0.3)) {
      text += ` You were hurt: ${injure(x, true)}`;
    }
  }
  const k = openCase(x, crimeId, { victimId, mult: ok ? 1 : 1.6 });
  // Botched crimes can mean being caught on the spot.
  const caughtNow = !ok && x.chance(0.35 + def.severity * 0.03);
  if (caughtNow) {
    k.evidence = Math.max(k.evidence, 75);
    updateEvidenceStat(x);
    x.queue('legal_arrest', { caseId: k.id }, true);
    text += ' Police caught you in the act!';
  }
  return { ok, caught: caughtNow, text, caseId: k.id };
}

export function hasImmunity(x: Ctx): boolean {
  const c = x.c;
  if (c.career?.careerId === 'diplomat' && c.career.level >= 4 && c.countryId !== c.birthCountryId) return true;
  if (c.politics.office === 'headOfGovernment' || c.career?.careerId === 'monarch' || c.career?.careerId === 'emperor') return true;
  return false;
}

/** Yearly legal simulation: evidence decay, investigations, arrests, parole, lawsuits. */
export function legalTick(x: Ctx): void {
  const c = x.c;
  const L = c.legal;
  if (L.prison) {
    prisonTick(x);
    return;
  }
  const policeEff = (100 - x.w.crimeRate) / 10;
  const crackdown = x.w.policies.includes('crackdown') ? 1.5 : 1;
  for (const k of L.cases) {
    if (k.status === 'closed') continue;
    k.evidence -= k.physical ? 3 : 8;
    if (x.stat('heat') > 35 && x.chance(0.4 * crackdown)) k.evidence += x.stat('heat') / 9;
    const liveWitnesses = k.witnesses.filter((w) => x.s.npcs[w]?.alive).length;
    if (liveWitnesses && x.chance(0.2)) k.evidence += 4 * liveWitnesses;
    k.evidence = Math.max(0, Math.min(100, Math.round(k.evidence)));
    // Murder never fully goes cold; other cases do.
    if (k.evidence <= 4 && k.crimeId !== 'murder') {
      k.status = 'closed';
    }
  }
  L.cases = L.cases.filter((k) => k.status !== 'closed' || x.age - k.age < 3);
  x.mod('heat', -(4 + policeEff) / (crackdown > 1 ? 1.5 : 1));
  updateEvidenceStat(x);

  // Arrests.
  const worst = L.cases.filter((k) => k.status === 'open').sort((a, b) => b.evidence - a.evidence)[0];
  if (worst && worst.evidence > 60 && !x.queued('legal_arrest')) {
    const abroad = c.countryId !== worst.countryId;
    const safe = abroad && !canExtradite(worst.countryId, c.countryId);
    if (hasImmunity(x)) {
      if (x.chance(0.3)) x.log('Investigators wanted to arrest you, but you enjoy immunity.', 'neutral');
    } else if (!safe && x.chance((worst.evidence - 50) / 45)) {
      x.queue('legal_arrest', { caseId: worst.id }, true);
    }
  }
  if (L.parole > 0) L.parole--;
  if (L.probation > 0) L.probation--;
  if (L.fugitive && !L.cases.some((k) => k.status === 'open' && k.evidence > 30)) {
    L.fugitive = false;
    L.interpolNotice = false;
    x.log('Your old cases have gone cold. You are no longer a fugitive.', 'good');
  }

  // Civil lawsuits.
  for (const suit of [...L.lawsuits]) {
    suit.years++;
    if (suit.years >= 1 && x.chance(0.6)) {
      const myStrength = (suit.role === 'plaintiff' ? suit.strength : 100 - suit.strength) + L.lawyer * 10 + x.skill('law') / 5;
      const win = x.chance(Math.max(0.1, Math.min(0.9, myStrength / 100)));
      L.lawsuits = L.lawsuits.filter((l) => l !== suit);
      if (win) {
        if (suit.role === 'plaintiff') x.money(suit.amount);
        x.log(`⚖️ You won the ${suit.kind} lawsuit ${suit.role === 'plaintiff' ? `against ${suit.otherParty} and were awarded ${x.fmt(suit.amount)}` : `brought by ${suit.otherParty}`}.`, 'good');
        x.mod('happiness', 5);
      } else {
        if (suit.role === 'defendant') {
          if (!x.spend(suit.amount)) {
            c.debt += suit.amount - Math.max(0, c.money);
            c.money = 0;
          }
        }
        x.log(`⚖️ You lost the ${suit.kind} lawsuit ${suit.role === 'plaintiff' ? `against ${suit.otherParty}` : `and owe ${suit.otherParty} ${x.fmt(suit.amount)}`}.`, 'bad');
        x.mods({ happiness: -6, stress: 5 });
      }
    }
  }

  // Witness protection.
  const wp = L.witnessProtection;
  if (wp) {
    wp.years++;
    wp.threat = Math.max(0, wp.threat - 5);
    if (x.chance(wp.threat / 250)) x.queue('wp_assassin');
  }
}

export interface Verdict {
  convicted: boolean;
  years: number;
  death: boolean;
  text: string;
}

/**
 * Trial outcome. Affected by lawyer quality, fame, evidence, judicial
 * corruption, jury intimidation and secret skill combos.
 */
export function tryCase(x: Ctx, caseId: string, lawyer: number, plea: boolean, bribeJudge: boolean, intimidateJury: boolean): Verdict {
  const c = x.c;
  const k = c.legal.cases.find((q) => q.id === caseId);
  if (!k) return { convicted: false, years: 0, death: false, text: 'The case evaporated.' };
  const def = CRIME_BY_ID[k.crimeId];
  const country = COUNTRY_BY_ID[k.countryId] ?? COUNTRY_BY_ID[c.countryId];
  c.legal.lawyer = lawyer;
  let p = 0.25 + (k.evidence - 45) / 55;
  p -= lawyer * 0.1;
  p -= x.stat('fame') / 450;
  p += x.stat('infamy') / 450;
  if (x.flag('mobCounsel') || c.career?.careerId === 'mobLawyer') p -= 0.15;
  if (x.flag('combo_cyberlaw') && ['cyberFraud', 'identityTheft'].includes(k.crimeId)) p -= 0.25;
  if (x.skill('criminalLaw') > 30) p -= x.skill('criminalLaw') / 400;
  let note = '';
  if (bribeJudge) {
    if (x.chance(country.judicialCorruption / 100 + x.stat('corruption') / 300)) {
      p -= 0.4;
      x.mod('corruption', 6);
      note += ' The judge was very understanding.';
    } else {
      p += 0.2;
      openCase(x, 'briberyOfficial', { mult: 1.3 });
      note += ' The judge reported your bribe attempt!';
    }
  }
  if (intimidateJury) {
    if (x.chance(0.3 + x.stat('fear') / 200)) {
      p -= 0.35;
      note += ' Several jurors seemed terrified.';
    } else {
      p += 0.15;
      openCase(x, 'witnessIntimidation');
      note += ' Jury tampering was discovered.';
    }
    x.mods({ karma: -6, sin: 3 });
  }
  p = Math.max(0.03, Math.min(0.97, p));
  const convicted = plea || x.chance(p);
  k.status = 'closed';
  updateEvidenceStat(x);
  if (!convicted) {
    x.mods({ happiness: 12, heat: -15, riskTolerance: 3 });
    x.remember('acquitted', `Acquitted of ${def.name.toLowerCase()}`, 30);
    return { convicted: false, years: 0, death: false, text: `Not guilty!${note}` };
  }
  const priors = c.legal.record.length;
  let years = x.float(def.sentence[0], def.sentence[1]) * country.sentencing * (1 + priors * 0.25) * (plea ? 0.5 : 1);
  if (x.era.id === 'ancient' || x.era.id === 'medieval') years *= 1.2;
  years = Math.round(years);
  let death = false;
  if (def.capital && country.deathPenalty && !plea && x.chance(0.3 + x.stat('infamy') / 300)) death = true;
  if (x.year < 1800 && def.capital && !plea && x.chance(0.6)) death = true;
  if (c.age < 18) {
    years = Math.min(years, Math.max(1, 18 - c.age + 1));
    death = false;
    c.legal.juvenileRecord = true;
  }
  c.legal.record.push({ crime: def.name, age: c.age, years, countryId: k.countryId });
  x.mods({ publicImage: -15, professionalRep: -20, happiness: -15, infamy: def.severity * 2 });
  if (x.famous) x.story('allegation', `${c.firstName} ${c.lastName} convicted of ${def.name.toLowerCase()}`, -40);
  if (years <= 0 && !death) {
    c.legal.probation = 2;
    return { convicted: true, years: 0, death: false, text: `Guilty. You got probation.${note}` };
  }
  imprison(x, death ? 99 : years, def.name, death ? 'deathRow' : undefined, k.federal);
  return { convicted: true, years, death, text: death ? `Guilty. You have been sentenced to death.${note}` : `Guilty. Sentenced to ${years} year${years === 1 ? '' : 's'}.${note}` };
}

export function imprison(x: Ctx, years: number, label: string, tier?: PrisonTier, federal = false): void {
  const c = x.c;
  const t: PrisonTier = tier ?? (years <= 1 ? 'county' : federal ? 'federal' : years >= 30 && c.stats.infamy > 50 ? 'supermax' : 'state');
  if (c.career) endCareer(x, 'Imprisoned');
  if (c.education.enrolled && c.education.enrolled.programId !== 'online') c.education.enrolled = null;
  c.legal.prison = { tier: t, sentence: years, served: 0, countryId: c.countryId, gang: null, rank: 10, guardFavor: 20, escapeAttempts: 0, goodBehavior: 50, appeals: t === 'deathRow' ? 3 : 1, crimeLabel: label };
  c.legal.arrests++;
  const cell = makeNpc(x, { age: x.int(20, 55), career: null, karma: -30, criminal: 60, gender: c.gender === 'female' ? 'female' : 'male' });
  x.addRel(cell.id, 'cellmate', { affinity: 40, trust: 30 });
  x.remember('prison', `Sent to ${PRISON_TIERS.find((p) => p.id === t)?.name ?? 'prison'} for ${label.toLowerCase()}`, 60);
  trauma(x, 12, 'abuse');
  if (x.partner() && x.chance(0.3)) x.queue('prison_partner_leaves', { npcId: x.partner()!.npcId });
}

function prisonTick(x: Ctx): void {
  const c = x.c;
  const P = c.legal.prison!;
  const tierDef = PRISON_TIERS.find((t) => t.id === P.tier)!;
  P.served++;
  x.mods({ happiness: -6, health: -2, fitness: 0, stress: 4, streetCred: 2, criminalRep: 1 });
  x.train('streetwise', 3);
  if (x.chance(0.4)) x.train('lockpicking', 2);
  if (!P.gang && x.chance(tierDef.violence)) {
    x.log('You were attacked in the yard.', 'bad');
    if (x.chance(0.4)) x.log(`Injury: ${injure(x, true)}`, 'bad');
    else x.mod('health', -10);
    trauma(x, 8, 'violence');
  } else if (P.gang && x.chance(tierDef.violence / 2)) {
    x.log(`${P.gang} went to war with a rival crew. You fought for them.`, 'bad');
    x.mods({ aggression: 3, streetCred: 4 });
  }
  if (P.tier === 'deathRow') {
    if (P.served >= 2 && !x.queued('death_row_appeal')) x.queue('death_row_appeal', {}, true);
    return;
  }
  if (P.served >= P.sentence) {
    release(x, 'Sentence served');
    return;
  }
  if (P.served >= Math.ceil(P.sentence / 3) && P.goodBehavior >= 55 && P.sentence > 1 && !c.flags[`paroleHeard_${P.served}`] && x.chance(0.6)) {
    c.flags[`paroleHeard_${P.served}`] = true;
    x.queue('parole_hearing', {}, true);
  }
}

export function release(x: Ctx, reason: string, parole = 0): void {
  const c = x.c;
  const P = c.legal.prison;
  if (!P) return;
  c.legal.prison = null;
  c.legal.parole = parole;
  for (const r of c.relationships) if (r.type === 'cellmate') r.type = 'acquaintance';
  x.log(`🔓 Released from prison (${reason}).`, 'major');
  x.mods({ happiness: 15 });
  x.remember('released', `Released from prison after ${P.served} years`, 30);
}

export function escapePrison(x: Ctx): string {
  const c = x.c;
  const P = c.legal.prison;
  if (!P) return 'You are not in prison.';
  const tierDef = PRISON_TIERS.find((t) => t.id === P.tier)!;
  P.escapeAttempts++;
  const p = tierDef.escape + x.skill('lockpicking') / 400 + x.skill('evasion') / 400 + P.guardFavor / 400 + (P.gang ? 0.05 : 0);
  if (x.chance(p)) {
    c.legal.prison = null;
    c.legal.fugitive = true;
    openCase(x, 'prisonEscape', { mult: 1 });
    x.mods({ happiness: 20, riskTolerance: 6, infamy: 8 });
    x.remember('escaped', 'Escaped from prison', 55);
    if (x.famous) x.story('allegation', `Manhunt after ${c.firstName} ${c.lastName} escapes prison`, -30);
    return 'You escaped! You are now a fugitive. Consider fleeing the country.';
  }
  P.sentence += x.int(2, 5);
  P.goodBehavior = Math.max(0, P.goodBehavior - 30);
  if (P.tier === 'state' && P.escapeAttempts >= 2) P.tier = 'supermax';
  x.mods({ health: -8, happiness: -10 });
  return `The escape failed. Years added to your sentence${P.tier === 'supermax' ? ' and you were transferred to supermax' : ''}.`;
}

/** Flee abroad. Countries in a different extradition bloc are safe havens. */
export function fleeTo(x: Ctx, countryId: string): string {
  const c = x.c;
  const cost = 15000;
  if (!x.spend(cost)) return `You need ${x.fmt(cost)} to disappear abroad.`;
  const from = c.countryId;
  c.countryId = countryId;
  c.legal.fugitive = c.legal.cases.some((k) => k.status === 'open' && k.evidence > 25);
  if (c.legal.fugitive && c.legal.cases.some((k) => k.status === 'open' && k.severity >= 5)) c.legal.interpolNotice = true;
  if (c.career && !CAREER_BY_ID[c.career.careerId]?.tags.includes('criminal')) endCareer(x, 'Fled the country');
  const safe = !canExtradite(from, countryId);
  x.remember('fled', `Fled to ${countryName(countryId, x.year)}`, 40);
  x.mods({ stress: 10, loneliness: 10 });
  return `You slipped across the border into ${countryName(countryId, x.year)}.${safe ? ' There is no extradition treaty — you are safe from your old cases.' : ' They extradite to your home country. Keep your head down.'}`;
}

/** Testify against your criminal organization in exchange for a new identity. */
export function enterWitnessProtection(x: Ctx): string {
  const c = x.c;
  if (!c.crime.orgName) return 'You have nobody to testify against.';
  const formerName = `${c.firstName} ${c.lastName}`;
  for (const k of c.legal.cases) k.status = 'closed';
  updateEvidenceStat(x);
  const org = c.crime.orgName;
  x.s.dynasty.enemies.push({ name: org, reason: `${formerName} testified against them`, generation: x.s.dynasty.generation });
  for (const r of c.relationships) if (r.type === 'coConspirator' || r.type === 'handler') r.type = 'enemy';
  c.crime.orgName = null;
  c.crime.orgRank = 0;
  c.crime.operations = [];
  c.firstName = firstName(x.s, c.countryId, c.birthYear, c.gender);
  if (c.career) endCareer(x, 'Witness protection');
  c.legal.witnessProtection = { years: 0, threat: 60, formerName };
  c.legal.fugitive = false;
  c.legal.interpolNotice = false;
  x.set('heat', 0);
  x.mods({ criminalRep: -60, streetCred: -40, karma: 10, paranoia: 15, loneliness: 15 });
  x.remember('witnessProtection', `Testified against ${org} and entered witness protection`, 70);
  x.endChain('mafia');
  return `You testified against ${org}. You are now ${c.firstName} ${c.lastName}, with a new life — and ${org} wants you dead.`;
}

export function joinPrisonGang(x: Ctx): string {
  const P = x.c.legal.prison;
  if (!P) return 'You are not in prison.';
  if (P.gang) return `You already run with ${P.gang}.`;
  P.gang = x.pick(PRISON_GANGS);
  x.mods({ streetCred: 6, criminalRep: 4, karma: -3 });
  x.c.flags.criminalContact = true;
  return `You were jumped into ${P.gang}. They have your back now — and you have theirs.`;
}

export function fileLawsuit(x: Ctx, kind: 'defamation' | 'assault' | 'contract', npcId: string): string {
  const n = x.npc(npcId);
  if (!n) return 'Nobody to sue.';
  const cost = 5000;
  if (!x.spend(cost)) return `Lawyers want ${x.fmt(cost)} up front.`;
  const amount = Math.round(x.int(10000, 120000) * (1 + n.wealth / 500000));
  x.c.legal.lawsuits.push({ id: x.uid('suit'), kind, role: 'plaintiff', otherParty: x.name(n), amount, strength: x.int(30, 75), years: 0 });
  x.relMod(npcId, -30, -30);
  return `You sued ${x.name(n)} for ${kind}, seeking ${x.fmt(amount)}.`;
}
