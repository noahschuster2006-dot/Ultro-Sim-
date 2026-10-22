import { Ctx, viewActions, type GameState } from '../../engine';
import { bmi, bmiCategory, bodyDescriptor } from '../../engine/systems/body';
import { ADDICTION_BY_KIND, CHRONIC_BY_ID, MENTAL_BY_ID, MENTAL_CONDITIONS } from '../../engine/data/conditions';
import { ActionList, Empty, KV, Pill, Section, type Api } from '../components';
import { TRAIT_BY_ID } from '../../engine/data/occult';

export function BodyMindPanel({ s, api }: { s: GameState; api: Api }) {
  const x = new Ctx(s);
  const c = s.char;
  const b = c.bio;
  return (
    <>
      <div className="grid two">
        <Section title="Body">
          <p className="small muted">You are {bodyDescriptor(x)}.</p>
          <KV
            rows={[
              ['Height', `${Math.round(b.heightCm)} cm`],
              ['Weight', `${Math.round(b.weightKg)} kg`],
              ['BMI', `${bmi(c)} (${bmiCategory(c)})`],
              ['Body type', b.bodyType],
              ['Diet', c.diet],
              ['Exercise', ['sedentary', 'light', 'regular', 'athlete'][c.exercise]],
              ['Lifestyle', c.lifestyle],
            ]}
          />
          <h3>Traits</h3>
          <div className="row">{c.traits.length ? c.traits.map((t) => <span key={t} title={TRAIT_BY_ID[t]?.desc}><Pill>{TRAIT_BY_ID[t]?.name ?? t}</Pill></span>) : <Empty>No notable traits.</Empty>}</div>
          <h3>Chronic conditions</h3>
          {b.chronic.length ? (
            <div className="list">
              {b.chronic.map((ch) => (
                <div key={ch.id} className="item spread">
                  <span>
                    {CHRONIC_BY_ID[ch.id]?.name ?? ch.id} <span className="muted small">severity {ch.severity}</span>
                  </span>
                  {ch.managed ? <Pill tone="good">Treated</Pill> : <Pill tone="bad">Untreated</Pill>}
                </div>
              ))}
            </div>
          ) : (
            <Empty>None.</Empty>
          )}
          <h3>Injuries & modifications</h3>
          {b.injuries.length || b.cosmetics.length ? (
            <div className="row">
              {b.injuries.map((i, k) => (
                <Pill key={`i${k}`} tone="bad">
                  {i.name} ({i.age})
                </Pill>
              ))}
              {b.cosmetics.map((m, k) => (
                <Pill key={`m${k}`}>{m.name}</Pill>
              ))}
            </div>
          ) : (
            <Empty>Unmarked.</Empty>
          )}
        </Section>
        <Section title="Mind">
          <KV
            rows={[
              ['Therapy', c.mental.therapy ? 'Yes' : 'No'],
              ['Medication', c.mental.medication ? 'Yes' : 'No'],
              ['Support group', c.mental.supportGroup ? 'Yes' : 'No'],
              ['Crises survived', c.mental.crises],
            ]}
          />
          <h3>Conditions</h3>
          {c.mental.conditions.length ? (
            <div className="list">
              {c.mental.conditions.map((m) => {
                const def = MENTAL_BY_ID[m.id];
                return (
                  <div key={m.id} className="item">
                    <strong>{def?.name ?? m.id}</strong> <span className="muted small">since age {m.onsetAge}</span>
                    <div className="small muted">{def?.effect}</div>
                    <div className="small">Treatment: {def?.treatment}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty>No diagnosed conditions.</Empty>
          )}
          <h3>Addictions</h3>
          {c.addictions.filter((a) => a.severity > 0.2 || a.active).length ? (
            <div className="list">
              {c.addictions
                .filter((a) => a.severity > 0.2 || a.active)
                .map((a) => {
                  const def = ADDICTION_BY_KIND[a.kind];
                  const stage = def.stages[Math.max(0, Math.min(4, Math.ceil(a.severity) - 1))];
                  return (
                    <div key={a.kind} className="item">
                      <div className="spread">
                        <strong>{def.name}</strong>
                        {a.active ? <Pill tone="bad">Active · {a.severity.toFixed(1)}/5</Pill> : a.inRecovery ? <Pill tone="good">Recovery · {a.yearsClean}y clean</Pill> : <Pill>Exposure {a.severity.toFixed(1)}</Pill>}
                      </div>
                      <div className="small muted">{stage}</div>
                      {a.active && <div className="small">Withdrawal: {def.withdrawal}. Recovery: {def.recovery}.</div>}
                    </div>
                  );
                })}
            </div>
          ) : (
            <Empty>No addictions.</Empty>
          )}
          {x.stat('depression') >= 60 && (
            <p className="notice" style={{ marginTop: 10 }}>
              If you are struggling in real life, please reach out to someone you trust or a local crisis line (in the US, call or text 988).
            </p>
          )}
        </Section>
      </div>
      <Section title="Health & mind actions">
        <ActionList actions={[...viewActions(s, 'health'), ...viewActions(s, 'mind')]} api={api} />
      </Section>
      <Section title="Self-care">
        <ActionList actions={viewActions(s, 'selfcare')} api={api} grouped empty="Nothing to pamper yourself with right now." />
      </Section>
      <Section title="Lifestyle">
        <ActionList actions={viewActions(s, 'lifestyle')} api={api} />
      </Section>
      <Section title="Mental health reference">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Condition</th>
                <th>Triggers</th>
                <th>Gameplay effect</th>
                <th>Treatment</th>
              </tr>
            </thead>
            <tbody>
              {MENTAL_CONDITIONS.map((m) => (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td>{m.triggers}</td>
                  <td>{m.effect}</td>
                  <td>{m.treatment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}
