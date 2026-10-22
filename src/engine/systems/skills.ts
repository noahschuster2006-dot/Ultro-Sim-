import type { Ctx } from '../ctx';
import { CAREER_BY_ID } from '../data/careers';
import { SKILLS, SKILL_BY_ID, SKILL_COMBOS, type SkillDef } from '../data/skills';

/** Skills degrade if unused for 3+ years, but never below 40% of their peak. */
export function skillTick(x: Ctx): void {
  for (const [id, st] of Object.entries(x.c.skills)) {
    if (x.age - st.lastUsedAge > 3 && st.level > 10) {
      st.level = Math.max(st.peak * 0.4, Math.round((st.level - 1.5) * 10) / 10);
    }
    if (!SKILL_BY_ID[id]) delete x.c.skills[id];
  }
  for (const combo of SKILL_COMBOS) {
    const key = `combo_${combo.id}`;
    if (!x.c.flags[key] && x.hasSkillCombo(combo.need)) {
      x.c.flags[key] = true;
      if (combo.id === 'mobCounsel') x.c.flags.mobCounsel = true;
      const career = combo.career ? CAREER_BY_ID[combo.career] : undefined;
      x.log(`🔓 Secret skill combo unlocked — ${combo.name}: ${combo.perk}${career ? ` (New career: ${career.name})` : ''}`, 'major');
      x.remember('combo', `Unlocked the ${combo.name} combo`, 30);
    }
  }
}

export function skillVisible(x: Ctx, def: SkillDef): boolean {
  if (def.fromYear && x.year < def.fromYear) return false;
  if (!def.hidden) return true;
  if (x.skill(def.id) > 0) return true;
  if (def.id === 'miracleWorking') return x.stat('divineFavor') >= 25;
  if (def.id === 'prophecy') return x.stat('paranormal') >= 30 || x.stat('divineFavor') >= 40;
  return x.stat('karma') <= -40 || x.c.spiritual.rituals > 0 || x.stat('paranormal') >= 40;
}

export function visibleSkills(x: Ctx): SkillDef[] {
  return SKILLS.filter((s) => skillVisible(x, s));
}

export function practiceSkill(x: Ctx, id: string): string {
  const def = SKILL_BY_ID[id];
  if (!def) return 'Unknown skill.';
  if (!x.skillUnlocked(id)) return `${def.name} is locked — train its prerequisite first.`;
  const before = x.skill(id);
  x.train(id, x.int(6, 10));
  const after = x.skill(id);
  if (def.cat === 'athletic' || def.cat === 'combat') x.mods({ fitness: 1.5, energy: -1 });
  if (def.cat === 'spiritual') x.mods({ faith: 1, paranormal: def.hidden ? 2 : 0.5 });
  if (def.hidden && ['demonology', 'necromancy', 'soulHarvesting', 'curseCraft'].includes(id)) x.mods({ sin: 3, karma: -3 });
  return `You practiced ${def.name.toLowerCase()} (${Math.round(before)} → ${Math.round(after)}).`;
}

export function topSkills(x: Ctx, n = 5): { def: SkillDef; level: number }[] {
  return Object.entries(x.c.skills)
    .filter(([id]) => SKILL_BY_ID[id])
    .map(([id, st]) => ({ def: SKILL_BY_ID[id], level: st.level }))
    .sort((a, b) => b.level - a.level)
    .slice(0, n);
}
