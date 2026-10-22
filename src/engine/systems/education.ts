import type { Ctx } from '../ctx';
import { PROGRAMS, PROGRAM_BY_ID, type ProgramDef } from '../data/programs';

const ELITE = new Set(['middle', 'wealthy', 'aristocracy', 'royalty']);

export function programEligibility(x: Ctx, p: ProgramDef): true | string {
  const c = x.c;
  if (x.year < p.fromYear) return 'Does not exist yet';
  if (c.legal.prison && p.id !== 'online') return 'You are in prison';
  if (c.education.enrolled) return 'Already enrolled';
  if (c.education.completed.includes(p.id)) return 'Already completed';
  if (c.age < p.minAge) return `Minimum age ${p.minAge}`;
  if (p.requires && !p.requires.every((r) => c.education.completed.includes(r))) {
    // Before mass schooling, wealthy families could send children to university without a diploma.
    const bypass = p.id === 'university' && x.year < 1880 && ELITE.has(c.familyStatus);
    if (!bypass) return `Requires ${p.requires.map((r) => PROGRAM_BY_ID[r]?.name ?? r).join(', ')}`;
  }
  for (const [k, v] of Object.entries(p.min ?? {})) if (x.stat(k as keyof typeof c.stats) < (v as number)) return `Requires ${k} ${v}+`;
  if (p.eliteUntil && x.year < p.eliteUntil && !ELITE.has(c.familyStatus) && c.money < p.cost * p.years + 5000) return 'Only the privileged attend in this era';
  if (p.kind === 'criminal' && !c.flags.criminalContact && x.stat('streetCred') < 20) return 'You need an underworld contact';
  if (p.id === 'university' && x.w.socialNorms < 30 && c.gender === 'female') return 'Universities do not admit women in this era';
  return true;
}

export function canBorrow(x: Ctx): boolean {
  return x.year >= 1958;
}

export function enroll(x: Ctx, id: string, loan: boolean): { ok: boolean; text: string } {
  const p = PROGRAM_BY_ID[id];
  if (!p) return { ok: false, text: 'Unknown program.' };
  const e = programEligibility(x, p);
  if (e !== true) return { ok: false, text: e };
  const c = x.c;
  const total = p.cost * p.years;
  const familyPays = c.age < 23 && ['wealthy', 'aristocracy', 'royalty'].includes(c.familyStatus);
  if (!familyPays && total > 0 && !loan && c.money < p.cost) return { ok: false, text: `You cannot afford ${p.name} (${x.fmt(p.cost)}/yr).` };
  if (loan && !canBorrow(x)) return { ok: false, text: 'Student loans do not exist yet.' };
  c.education.enrolled = { programId: id, yearsLeft: p.years, yearsDone: 0 };
  c.flags.eduLoan = loan && !familyPays;
  c.flags.eduFamilyPays = familyPays;
  x.remember('enrolled', `Enrolled in ${p.name}`, 15);
  return { ok: true, text: `You enrolled in ${p.name}.${familyPays ? ' Your family is paying.' : loan ? ' Student loans will cover tuition.' : ''}` };
}

export function dropOut(x: Ctx): string {
  const c = x.c;
  const en = c.education.enrolled;
  if (!en) return 'You are not enrolled.';
  const p = PROGRAM_BY_ID[en.programId];
  c.education.enrolled = null;
  if (p.kind === 'school') c.education.droppedOut = true;
  x.mods({ happiness: 3, discipline: -3 });
  x.remember('droppedOut', `Dropped out of ${p.name}`, 25);
  x.mod('riskTolerance', 4);
  return `You dropped out of ${p.name}.`;
}

/** Automatic childhood schooling, tuition, grades and graduation. */
export function educationTick(x: Ctx): string[] {
  const c = x.c;
  const out: string[] = [];
  const ed = c.education;
  // Automatic enrollment in primary / secondary when available.
  if (!ed.enrolled && !c.legal.prison) {
    for (const id of ['primary', 'secondary']) {
      const p = PROGRAM_BY_ID[id];
      if (c.age === p.minAge && !ed.completed.includes(id) && !ed.droppedOut) {
        if (programEligibility(x, p) === true) {
          ed.enrolled = { programId: id, yearsLeft: p.years, yearsDone: 0 };
          out.push(`You started ${p.name.toLowerCase()}.`);
        } else if (id === 'primary') {
          c.flags.noSchooling = true;
          out.push('There is no school for children like you. You start working with your family instead.');
        }
      }
    }
  }
  const en = ed.enrolled;
  if (!en) return out;
  const p = PROGRAM_BY_ID[en.programId];
  // Tuition.
  if (p.cost > 0 && !c.flags.eduFamilyPays) {
    if (c.flags.eduLoan) c.debt += p.cost;
    else if (!x.spend(p.cost)) {
      if (canBorrow(x)) {
        c.debt += p.cost;
        c.flags.eduLoan = true;
      } else {
        ed.enrolled = null;
        out.push(`You could not pay tuition and had to leave ${p.name}.`);
        return out;
      }
    }
  }
  const study = (c.flags.studyHard as boolean) ? 10 : 0;
  ed.grades = Math.max(0, Math.min(100, ed.grades * 0.6 + (x.stat('smarts') * 0.5 + x.stat('discipline') * 0.3 + study + x.float(-10, 10)) * 0.4 + (c.education.tutored ? 4 : 0)));
  for (const sk of p.trains) x.train(sk, 3 + ed.grades / 25 + (study ? 2 : 0));
  x.mod('smarts', 0.8 + study / 10);
  if (study) x.mods({ stress: 3, discipline: 1 });
  en.yearsLeft--;
  en.yearsDone++;
  if (en.yearsLeft <= 0) {
    ed.enrolled = null;
    if (ed.grades < 25 && p.kind !== 'school' && x.chance(0.5)) {
      out.push(`You failed to graduate from ${p.name}.`);
      x.mods({ happiness: -8, confidence: -6 });
    } else {
      ed.completed.push(p.id);
      const honors = ed.grades > 85 ? ' with honors' : '';
      out.push(`🎓 You graduated from ${p.name}${honors}.`);
      x.mods({ happiness: 8, confidence: 5, professionalRep: p.kind === 'graduate' ? 6 : 2 });
      x.remember('graduated', `Graduated from ${p.name}${honors}`, p.kind === 'school' ? 10 : 25);
      if (p.id === 'militaryAcademy') c.flags.owesService = 4;
    }
  }
  return out;
}

export function educationLabel(x: Ctx): string {
  const done = x.c.education.completed;
  const order = ['phd', 'medical', 'law', 'mba', 'university', 'militaryAcademy', 'seminary', 'communityCollege', 'online', 'tradeSchool', 'apprenticeship', 'monastery', 'criminalApprenticeship', 'secondary', 'primary'];
  for (const id of order) if (done.includes(id)) return PROGRAM_BY_ID[id].name;
  return 'No formal education';
}

export function availablePrograms(x: Ctx): { p: ProgramDef; ok: true | string }[] {
  return PROGRAMS.filter((p) => p.kind !== 'school' && x.year >= p.fromYear).map((p) => ({ p, ok: programEligibility(x, p) }));
}
