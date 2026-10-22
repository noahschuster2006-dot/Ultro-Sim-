import { Ctx, type GameState } from '../../engine';
import { countryName, religionWeights } from '../../engine/data/countries';
import { eraOf, techEraOf, TECH_ERA_NAMES, mediaEraOf } from '../../engine/data/eras';
import { HISTORY } from '../../engine/data/history';
import { Empty, KV, Pill, Section } from '../components';

function meter(v: number) {
  return (
    <span className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
      <span className="track" style={{ width: 70, height: 6, display: 'inline-block' }}>
        <span className="fill" style={{ display: 'block', width: `${v}%`, background: v > 60 ? 'var(--good)' : v > 35 ? 'var(--warn)' : 'var(--bad)' }} />
      </span>
      {Math.round(v)}
    </span>
  );
}

export function WorldPanel({ s }: { s: GameState }) {
  const x = new Ctx(s);
  const w = x.w;
  const year = x.year;
  const active = HISTORY.filter((h) => s.world.activeHistorical.includes(h.id));
  return (
    <>
      <div className="grid two">
        <Section title={x.countryName.charAt(0).toUpperCase() + x.countryName.slice(1)} right={<Pill tone="accent">{eraOf(year).name}</Pill>}>
          <KV
            rows={[
              ['Year', year < 0 ? `${-year} BC` : year],
              ['Technology', TECH_ERA_NAMES[techEraOf(year)]],
              ['Media', mediaEraOf(year).name],
              ['Regime', w.regime],
              ['Ruler', w.ruler],
              ['Economy', meter(w.economy)],
              ['Political stability', meter(w.stability)],
              ['Social norms', meter(w.socialNorms)],
              ['Crime rate', meter(w.crimeRate)],
              ['War', w.war === 'none' ? 'Peace' : `${w.war} — ${w.warName ?? ''}`],
              ['Health crisis', w.healthCrisis ? w.healthCrisisName ?? 'Yes' : 'None'],
              ['Religion', w.religionDominance],
              ['Prohibition', w.prohibition ? 'Yes' : 'No'],
              ['Cannabis legal', w.cannabisLegal ? 'Yes' : 'No'],
              ...(w.sanctions ? ([['Sanctions', `${w.sanctions} yrs`]] as [string, string][]) : []),
            ]}
          />
          {w.policies.length > 0 && (
            <p className="small muted" style={{ marginTop: 6 }}>
              Laws in force: {w.policies.join(', ')}
            </p>
          )}
        </Section>
        <Section title="History in motion">
          {active.length ? (
            <div className="list">
              {active.map((h) => (
                <div key={h.id} className="item small">
                  <strong>{h.name}</strong> <span className="muted">({h.from}–{h.to})</span>
                  <div className="muted">{h.start}</div>
                </div>
              ))}
            </div>
          ) : (
            <Empty>No great historical upheavals right now.</Empty>
          )}
          {s.world.legends.length > 0 && (
            <>
              <h3>Legends</h3>
              {s.world.legends.map((l, i) => (
                <div key={i} className="small">
                  ★ {l.name}, {l.title} ({l.year})
                </div>
              ))}
            </>
          )}
          <h3>Faiths</h3>
          {s.world.institutions.filter((i) => i.religionId === s.char.religionId || religionWeights(s.char.countryId, year).some(([r]) => r === i.religionId)).map((i) => (
            <div key={i.religionId} className="small">
              {i.name}: influence {Math.round(i.influence)}, wealth {Math.round(i.wealth)}, corruption {Math.round(i.corruption)}, schism risk {Math.round(i.schismRisk)}
            </div>
          ))}
        </Section>
      </div>
      <Section title="The world">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Country</th>
                <th>Regime</th>
                <th>Economy</th>
                <th>Stability</th>
                <th>Norms</th>
                <th>Crime</th>
                <th>War</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(s.world.contexts).map(([id, c]) => (
                <tr key={id} style={id === s.char.countryId ? { fontWeight: 700 } : undefined}>
                  <td>{countryName(id, year)}</td>
                  <td>{c.regime}</td>
                  <td>{Math.round(c.economy)}</td>
                  <td>{Math.round(c.stability)}</td>
                  <td>{Math.round(c.socialNorms)}</td>
                  <td>{Math.round(c.crimeRate)}</td>
                  <td>{c.war === 'none' ? '—' : c.war}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <Section title="Chronicle">
        {s.world.chronicle.length ? (
          <div className="list">
            {[...s.world.chronicle]
              .reverse()
              .slice(0, 60)
              .map((e, i) => (
                <div key={i} className="small">
                  <span className="faint">{e.year}</span> · <strong>{e.title}</strong>
                  {e.countryId ? ` (${countryName(e.countryId, e.year)})` : ''}: {e.text}
                </div>
              ))}
          </div>
        ) : (
          <Empty>The chronicle is empty — history is just getting started.</Empty>
        )}
      </Section>
    </>
  );
}
