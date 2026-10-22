import { useState } from 'react';
import { careerView, Ctx, fmtMoney, viewActions, type GameState } from '../../engine';
import { CAREER_CAT_NAMES, careerTitle, type CareerCat } from '../../engine/data/careers';
import { currentTitle } from '../../engine/systems/careers';
import { educationLabel, availablePrograms } from '../../engine/systems/education';
import { PROGRAM_BY_ID } from '../../engine/data/programs';
import { ActionList, Empty, KV, Pill, Section, type Api } from '../components';
import { CAREER_CAT_ICON } from '../art/icons';
import { Briefcase } from 'lucide-react';

export function CareerPanel({ s, api }: { s: GameState; api: Api }) {
  const x = new Ctx(s);
  const c = s.char;
  const cs = c.career;
  const [cat, setCat] = useState<CareerCat | 'eligible'>('eligible');
  const jobs = careerView(s);
  const def = cs ? jobs.find((j) => j.def.id === cs.careerId)?.def : undefined;
  const shown = jobs.filter((j) => (cat === 'eligible' ? j.eligible && j.def.id !== cs?.careerId : j.def.cat === cat));
  const cats = [...new Set(jobs.map((j) => j.def.cat))];
  return (
    <>
      <div className="grid two">
        <Section title="Occupation">
          {cs && def ? (
            <>
              <KV
                rows={[
                  ['Title', currentTitle(x)],
                  ['Career', `${def.name} (${CAREER_CAT_NAMES[def.cat]})`],
                  ['Employer', cs.employer],
                  ['Salary', `${fmtMoney(cs.salary)}/yr`],
                  ['Performance', `${Math.round(cs.performance)}/100`],
                  ['Years in role', cs.yearsInRole],
                  ['Work ethic', cs.workEthic],
                ]}
              />
              <h3>Ladder</h3>
              <div className="list">
                {def.ladder.map((_, i) => {
                  const lvl = i + 1;
                  const title = careerTitle(def, lvl, !!cs.branch);
                  return (
                    <div key={lvl} className="small" style={{ opacity: lvl <= cs.level ? 1 : 0.5, fontWeight: lvl === cs.level ? 700 : 400 }}>
                      {lvl}. {title}
                      {lvl === cs.level ? ' ← you' : ''}
                    </div>
                  );
                })}
              </div>
              {def.branch && (
                <p className="small muted" style={{ marginTop: 8 }}>
                  Branch at level {def.branch.at}: <strong>{def.branch.name}</strong> — {def.branch.desc} {cs.branch ? <Pill tone="accent">Taken</Pill> : null}
                </p>
              )}
            </>
          ) : (
            <Empty>{c.retired ? 'You are retired.' : c.age < 14 ? 'Too young to work.' : 'You are not working.'}</Empty>
          )}
          <h3>Actions</h3>
          <ActionList actions={viewActions(s, 'career').filter((a) => a.id !== 'apply')} api={api} />
        </Section>
        <Section title="Education">
          <KV
            rows={[
              ['Highest level', educationLabel(x)],
              ['Currently', c.education.enrolled ? `${PROGRAM_BY_ID[c.education.enrolled.programId]?.name} (${c.education.enrolled.yearsLeft} yrs left)` : 'Not enrolled'],
              ['Grades', Math.round(c.education.grades)],
              ['Completed', c.education.completed.map((p) => PROGRAM_BY_ID[p]?.name ?? p).join(', ') || '—'],
            ]}
          />
          <h3>Actions</h3>
          <ActionList actions={viewActions(s, 'education')} api={api} />
          <h3>Programs this era</h3>
          <div className="list">
            {availablePrograms(x).map(({ p, ok }) => (
              <div key={p.id} className="small">
                <strong>{p.name}</strong> <span className="muted">— {p.desc}</span> {ok === true ? <Pill tone="good">Open</Pill> : <span className="faint">({ok})</span>}
              </div>
            ))}
          </div>
        </Section>
      </div>
      <Section
        title="Job market"
        right={
          <select value={cat} onChange={(e) => setCat(e.target.value as CareerCat | 'eligible')} aria-label="Career category">
            <option value="eligible">Jobs you qualify for</option>
            {cats.map((k) => (
              <option key={k} value={k}>
                {CAREER_CAT_NAMES[k]}
              </option>
            ))}
          </select>
        }
      >
        {shown.length ? (
          <div className="list">
            {shown.map(({ def: d, eligible, reason }) => {
              const JobIcon = CAREER_CAT_ICON[d.cat] ?? Briefcase;
              return (
              <div key={d.id} className={`item ${eligible ? '' : 'disabled'}`}>
                <div className="spread">
                  <div className="row" style={{ flexWrap: 'nowrap', minWidth: 0 }}>
                    <span className="mini-icon" aria-hidden>
                      <JobIcon size={16} />
                    </span>
                    <span>
                      <strong>{d.name}</strong> <span className="muted small">· starts as {d.ladder[0]} · {fmtMoney(d.salary)}/yr</span>
                    </span>
                  </div>
                  <button className="btn" disabled={!eligible || c.ap < 1 || !!s.queue.length} onClick={() => api.act('apply', d.id)}>
                    Apply
                  </button>
                </div>
                <div className="small muted">{d.desc}</div>
                {d.combo && <div className="small" style={{ color: 'var(--major)' }}>Secret path: {d.combo}</div>}
                {!eligible && reason && <div className="reason small" style={{ color: 'var(--warn)' }}>{reason}</div>}
              </div>
              );
            })}
          </div>
        ) : (
          <Empty>No openings here.</Empty>
        )}
      </Section>
      {c.careerHistory.length > 0 && (
        <Section title="Work history">
          <div className="list">
            {c.careerHistory.map((h, i) => (
              <div key={i} className="small">
                Age {h.fromAge}–{h.toAge}: {h.title} <span className="muted">({h.reason})</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}
