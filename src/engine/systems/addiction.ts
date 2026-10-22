import type { Ctx } from '../ctx';
import { ADDICTION_BY_KIND } from '../data/conditions';
import type { Addiction, AddictionKind } from '../types';
import { diagnose } from './body';
import { onset } from './mind';

export function addictionOf(x: Ctx, kind: AddictionKind): Addiction | undefined {
  return x.c.addictions.find((a) => a.kind === kind);
}

/**
 * Exposure to a substance or behavior. Early experimentation at low severity
 * may never become addiction; at severity 2+ the addiction mechanics engage.
 */
export function expose(x: Ctx, kind: AddictionKind, amount: number): string | null {
  let a = addictionOf(x, kind);
  if (!a) {
    a = { kind, severity: 0, active: false, yearsClean: 0, inRecovery: false, everActive: false };
    x.c.addictions.push(a);
  }
  const p = x.c.bio.predisposition.addiction;
  const susceptibility = (0.6 + p * 1.5 + (x.c.traits.includes('addictive') ? 0.5 : 0)) * (1.2 - x.stat('willpower') / 125) * (x.c.age < 18 ? 1.3 : 1);
  a.severity = Math.min(5, Math.round((a.severity + amount * susceptibility) * 100) / 100);
  if (a.inRecovery && amount > 0.2) {
    a.inRecovery = false;
    a.yearsClean = 0;
  }
  if (!a.active && a.severity >= 2) {
    a.active = true;
    a.everActive = true;
    const def = ADDICTION_BY_KIND[kind];
    x.log(`⚠️ You are now addicted: ${def.name}.`, 'bad');
    x.remember('addiction', `Became addicted (${def.name})`, 40);
    return def.name;
  }
  return null;
}

/** Yearly addiction progression, costs, effects, withdrawal and relapse. */
export function addictionTick(x: Ctx): void {
  const c = x.c;
  for (const a of c.addictions) {
    const def = ADDICTION_BY_KIND[a.kind];
    if (!a.active) {
      if (a.inRecovery) {
        a.yearsClean++;
        a.severity = Math.max(0, a.severity - 0.5);
        if (a.yearsClean >= 5 && a.severity < 0.5) a.inRecovery = false;
      }
      // Relapse.
      if (a.everActive && a.severity > 0.3) {
        const relapseP = 0.08 * (0.5 + x.stat('stress') / 60) * (1.2 - x.stat('willpower') / 120) * (a.yearsClean > 3 ? 0.5 : 1);
        if (x.chance(relapseP)) {
          a.active = true;
          a.inRecovery = false;
          a.yearsClean = 0;
          a.severity = Math.max(a.severity, 2);
          x.log(`💔 Relapse: ${def.name} has its grip on you again.`, 'bad');
          x.mods({ happiness: -10, willpower: -5 });
        }
      } else {
        a.severity = Math.max(0, a.severity - 0.2);
      }
      continue;
    }
    // Active addiction.
    const sev = a.severity;
    const cost = Math.round(def.cost * sev);
    if (cost > 0 && !x.spend(cost)) {
      c.debt += Math.max(0, cost - Math.max(0, c.money));
      c.money = Math.max(0, c.money - cost);
      x.mods({ stress: 6, anxiety: 4 });
    }
    a.severity = Math.min(5, a.severity + 0.3);
    switch (a.kind) {
      case 'alcohol':
        x.mods({ happiness: sev < 2 ? 1 : -sev, health: -sev * 1.3, looks: -0.5 });
        if (c.career) c.career.performance = Math.max(0, c.career.performance - sev * 2);
        break;
      case 'stimulants':
        x.mods({ mania: sev * 4, paranoia: sev * 2.5, health: -sev * 1.5, anxiety: sev });
        if (sev >= 4.5) onset(x, 'psychosis');
        break;
      case 'opioids':
        x.mods({ health: -sev * 2.2, happiness: sev < 3 ? 2 : -sev, energy: -sev * 2, pain: -10 });
        if (c.career) c.career.performance = Math.max(0, c.career.performance - sev * 3);
        break;
      case 'gambling': {
        const loss = Math.round(Math.max(0, c.money) * (0.04 * sev) + sev * 1500);
        if (!x.spend(loss)) c.debt += loss;
        x.mods({ stress: sev * 2, anxiety: sev });
        if (sev >= 4.5 && c.debt > 50000) c.flags.bankruptcyPending = true;
        break;
      }
      case 'sex':
        for (const r of x.rels('spouse', 'partner')) r.trust = Math.max(0, r.trust - sev * 3);
        if (sev >= 3) x.secret('sexAddiction', 'A string of compulsive affairs', 3);
        if (sev >= 3 && x.chance(0.04)) diagnose(x, 'hiv');
        break;
      case 'power':
        x.mods({ paranoia: sev * 2, karma: -sev, ego: sev * 1.5, empathy: -sev });
        break;
      case 'violence':
        x.mods({ aggression: sev * 2, karma: -sev, empathy: -sev });
        break;
    }
  }
}

/** Attempt recovery through one of the addiction's recovery paths. */
export function attemptRecovery(x: Ctx, kind: AddictionKind, optionId: string): { ok: boolean; text: string } {
  const a = addictionOf(x, kind);
  const def = ADDICTION_BY_KIND[kind];
  const opt = def.recoveryOptions.find((o) => o.id === optionId);
  if (!a || !a.active || !opt) return { ok: false, text: 'Nothing to recover from.' };
  if (!x.spend(opt.cost)) return { ok: false, text: `You cannot afford ${opt.name} (${x.fmt(opt.cost)}).` };
  const supportBonus = Math.min(0.2, x.rels('spouse', 'partner', 'bestFriend', 'parent').filter((r) => r.affinity > 60).length * 0.05);
  const p = opt.power + x.stat('willpower') / 300 + supportBonus - (a.severity - 2) * 0.05;
  // Withdrawal hits regardless.
  if (kind === 'opioids' || kind === 'alcohol') x.mods({ health: -8, anxiety: 10 });
  if (kind === 'stimulants') x.mod('depression', 15);
  if (kind === 'power') x.mod('depression', 10);
  if (kind === 'violence') x.mod('aggression', 5);
  if (kind === 'alcohol' && a.severity >= 4 && opt.id === 'cold' && x.chance(0.15)) {
    x.mod('health', -20);
    x.log('Withdrawal seizure! You were rushed to hospital.', 'bad');
  }
  if (x.chance(p)) {
    a.active = false;
    a.inRecovery = true;
    a.yearsClean = 0;
    a.severity = Math.max(0, a.severity - 1.5);
    x.mods({ happiness: 8, willpower: 6, health: 5 });
    x.remember('recovery', `Got clean from ${def.name.toLowerCase()} through ${opt.name.toLowerCase()}`, 35);
    return { ok: true, text: `${opt.name} worked. You are in recovery from ${def.name.toLowerCase()} — one day at a time.` };
  }
  x.mods({ happiness: -6, willpower: -3 });
  return { ok: false, text: `${opt.name} did not stick this time. The withdrawal was brutal.` };
}
