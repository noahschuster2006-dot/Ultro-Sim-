import { useState } from 'react';
import { Ctx, type GameState } from '../../engine';
import { SKILL_BY_ID, SKILL_CATEGORIES, SKILL_COMBOS, UNLOCK_LEVEL, type SkillCategory } from '../../engine/data/skills';
import { CAREER_BY_ID } from '../../engine/data/careers';
import { visibleSkills } from '../../engine/systems/skills';
import { Pill, Section, type Api } from '../components';
import { SKILL_CAT_ICON } from '../art/icons';

export function SkillsPanel({ s, api }: { s: GameState; api: Api }) {
  const x = new Ctx(s);
  const [cat, setCat] = useState<SkillCategory>('academic');
  const skills = visibleSkills(x).filter((k) => k.cat === cat);
  const canAct = s.char.ap >= 1 && !s.queue.length && s.phase === 'alive' && s.char.age >= 4;
  return (
    <>
      <Section title="Skill tree" right={<span className="muted small">{visibleSkills(x).length} visible nodes · unlock at {UNLOCK_LEVEL}</span>}>
        <div className="tabs">
          {SKILL_CATEGORIES.map((c) => (
            <button key={c.id} className={`tab ${cat === c.id ? 'active' : ''}`} onClick={() => setCat(c.id)}>
              {(() => {
                const I = SKILL_CAT_ICON[c.id];
                return I ? <I size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} /> : null;
              })()}
              {c.name}
            </button>
          ))}
        </div>
        <div className="skill-grid">
          {skills.map((k) => {
            const lvl = x.skill(k.id);
            const unlocked = x.skillUnlocked(k.id);
            const st = s.char.skills[k.id];
            const rusty = st && s.char.age - st.lastUsedAge > 3 && st.level > 10;
            return (
              <div key={k.id} className={`skill ${unlocked ? '' : 'locked'}`}>
                <div className="spread">
                  <strong>{k.name}</strong>
                  <span>{Math.round(lvl)}</span>
                </div>
                <div className="track" style={{ height: 5, margin: '4px 0' }}>
                  <div className="fill" style={{ width: `${lvl}%`, background: 'var(--accent-2)' }} />
                </div>
                <div className="tiny muted">
                  {k.prereq ? `Needs ${SKILL_BY_ID[k.prereq]?.name ?? k.prereq} ${UNLOCK_LEVEL}` : 'Root skill'}
                  {rusty ? ' · rusty' : ''}
                </div>
                <button className="btn" style={{ marginTop: 6, padding: '4px 10px' }} disabled={!canAct || !unlocked} onClick={() => api.act('practice', k.id)}>
                  Practice
                </button>
              </div>
            );
          })}
        </div>
      </Section>
      <Section title="Secret skill combinations">
        <div className="list">
          {SKILL_COMBOS.map((combo) => {
            const done = !!s.char.flags[`combo_${combo.id}`];
            return (
              <div key={combo.id} className="item">
                <div className="spread">
                  <strong>{done ? combo.name : '???'}</strong>
                  {done ? <Pill tone="good">Unlocked</Pill> : <Pill>Locked</Pill>}
                </div>
                <div className="small muted">
                  {done
                    ? combo.perk
                    : `Requires: ${Object.entries(combo.need)
                        .map(([k, v]) => `${SKILL_BY_ID[k]?.name ?? k} ${v} (${Math.round(x.skill(k))})`)
                        .join(' + ')}`}
                </div>
                {done && combo.career && <div className="small">Opens: {CAREER_BY_ID[combo.career]?.name}</div>}
              </div>
            );
          })}
        </div>
      </Section>
    </>
  );
}
