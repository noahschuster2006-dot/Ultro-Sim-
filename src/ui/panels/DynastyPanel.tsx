import { DYNASTY_MILESTONES, fmtMoney, fmtYear, viewActions, type GameState } from '../../engine';
import { CURSE_BY_ID, TRAIT_BY_ID } from '../../engine/data/occult';
import { ActionList, Empty, KV, Pill, Section, type Api } from '../components';

const REP_NAMES: Record<string, string> = { criminal: 'Criminal', political: 'Political', social: 'Social', spiritual: 'Spiritual', scholarly: 'Scholarly', business: 'Business' };

export function DynastyPanel({ s, api }: { s: GameState; api?: Api }) {
  const D = s.dynasty;
  return (
    <>
      <div className="grid two">
        <Section title={`The ${D.name} dynasty`} right={<Pill tone="accent">Generation {D.generation}</Pill>}>
          <KV
            rows={[
              ['Founded', fmtYear(D.foundedYear)],
              ['Prestige', D.prestige],
              ['Total wealth passed down', fmtMoney(D.totalWealth)],
              ['Crest', D.crest ?? '— (unlocks at generation 3)'],
              ['Motto', D.motto ? `“${D.motto}”` : '—'],
            ]}
          />
          <h3>Reputation</h3>
          {Object.entries(D.reputation).map(([k, v]) => (
            <div key={k} className="bar">
              <div className="label">
                <span>{REP_NAMES[k]}</span>
                <span>{Math.round(v)}</span>
              </div>
              <div className="track" style={{ height: 8 }}>
                <div className="fill" style={{ width: `${v}%`, background: v > 80 || v < 20 ? 'var(--major)' : 'var(--accent-2)' }} />
              </div>
            </div>
          ))}
          <p className="small muted">Extremes (above 80 or below 20) change how the world treats every new heir from birth.</p>
          <h3>Bloodline traits</h3>
          <div className="row">{D.traitPool.length ? D.traitPool.map((t) => <Pill key={t}>{TRAIT_BY_ID[t]?.name ?? t}</Pill>) : <Empty>None yet.</Empty>}</div>
          <h3>Bloodline curses & blessings</h3>
          <div className="row">
            {D.curses.map((c) => (
              <Pill key={c.id} tone="bad">
                {CURSE_BY_ID[c.id]?.name ?? c.id} ({c.level})
              </Pill>
            ))}
            {D.blessings.map((b) => (
              <Pill key={b.id} tone="good">
                {b.id} ({b.level})
              </Pill>
            ))}
            {!D.curses.length && !D.blessings.length && <Empty>Clean blood.</Empty>}
          </div>
        </Section>
        <Section title="Milestones">
          <div className="list">
            {DYNASTY_MILESTONES.map((m) => (
              <div key={m.id} className="small">
                {D.milestones.includes(m.id) ? '✅' : '⬜'} Gen {m.gen}: {m.name}
              </div>
            ))}
          </div>
          <h3>Family enemies</h3>
          {D.enemies.length ? (
            D.enemies.map((e, i) => (
              <div key={i} className="small">
                {e.name} — {e.reason} (gen {e.generation})
              </div>
            ))
          ) : (
            <Empty>None.</Empty>
          )}
          <h3>Family allies</h3>
          {D.allies.length ? (
            D.allies.map((e, i) => (
              <div key={i} className="small">
                {e.name} — {e.reason}
              </div>
            ))
          ) : (
            <Empty>None.</Empty>
          )}
          {D.institutions.length > 0 && (
            <>
              <h3>Institutions</h3>
              <div className="row">
                {D.institutions.map((i, k) => (
                  <Pill key={k}>{i.name}</Pill>
                ))}
              </div>
            </>
          )}
        </Section>
      </div>
      <Section title="Ancestors">
        {D.members.length ? (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Gen</th>
                  <th>Name</th>
                  <th>Lived</th>
                  <th>Known as</th>
                  <th>Death</th>
                  <th>Net worth</th>
                  <th>Afterlife</th>
                </tr>
              </thead>
              <tbody>
                {D.members.map((m) => (
                  <tr key={m.id}>
                    <td>{m.generation}</td>
                    <td>
                      {m.name}
                      {m.legendary ? ' ★' : ''}
                    </td>
                    <td>
                      {fmtYear(m.birthYear)}–{fmtYear(m.deathYear)} ({m.age})
                    </td>
                    <td>{m.title}</td>
                    <td>{m.cause}</td>
                    <td>{fmtMoney(m.netWorth)}</td>
                    <td>{m.afterlife}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>You are the founder. Everything starts with you.</Empty>
        )}
      </Section>
      {api && (
        <Section title="Estate planning">
          {s.char.will ? (
            <p className="small muted">
              Will on file: {Object.entries(s.char.will.shares).map(([id, v]) => `${s.npcs[id]?.firstName ?? '?'} ${v}%`).join(', ') || 'no named heirs'}
              {s.char.will.charity ? ` · ${Math.round(s.char.will.charity * 100)}% to charity` : ''}
            </p>
          ) : (
            <p className="small muted">No will. Without one, siblings are likely to contest the estate.</p>
          )}
          <ActionList actions={viewActions(s, 'estate')} api={api} />
        </Section>
      )}
    </>
  );
}
