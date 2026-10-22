import { Ctx, viewActions, type GameState } from '../../engine';
import { LAW_BY_ID, OFFICE_BY_ID } from '../../engine/data/politics';
import { countryName } from '../../engine/data/countries';
import { ActionList, Bar, Empty, KV, Pill, Section, type Api } from '../components';

export function PowerPanel({ s, api }: { s: GameState; api: Api }) {
  const x = new Ctx(s);
  const c = s.char;
  const P = c.politics;
  const M = c.media;
  return (
    <>
      <div className="grid two">
        <Section title="Reputation">
          <Bar id="fame" value={x.stat('fame')} />
          <Bar id="publicImage" value={x.stat('publicImage')} />
          <Bar id="professionalRep" value={x.stat('professionalRep')} />
          <Bar id="streetCred" value={x.stat('streetCred')} />
          <Bar id="criminalRep" value={x.stat('criminalRep')} />
          <Bar id="politicalApproval" value={x.stat('politicalApproval')} />
          <Bar id="spiritualAuthority" value={x.stat('spiritualAuthority')} />
          <Bar id="infamy" value={x.stat('infamy')} />
          <KV
            rows={[
              ['Media era', `${x.media.name} (scandals spread ×${x.media.spread})`],
              ...(x.year >= 2006 ? ([['Followers', M.followers.toLocaleString('en-US')]] as [string, string][]) : []),
              ['PR firm', M.prFirm ? 'Retained' : 'None'],
              ['Cancelled', M.cancelled ? `Yes — severity ${M.cancelled.severity}` : 'No'],
            ]}
          />
        </Section>
        <Section title="Politics">
          <KV
            rows={[
              ['Regime', x.w.regime],
              ['Ruler', x.w.ruler],
              ['Office', P.office ? `${OFFICE_BY_ID[P.office]?.name} of ${countryName(P.officeCountry ?? c.countryId, x.year)}` : 'None'],
              ['Term left', P.office ? (P.dictator ? 'Indefinite' : `${P.term} yrs`) : '—'],
              ['Party', P.party ?? 'None'],
              ['Elections won / lost', `${P.electionsWon} / ${P.electionsLost}`],
              ['Cabinet', P.cabinet.length ? P.cabinet.map((id) => x.name(id)).join(', ') : '—'],
            ]}
          />
          {P.dictator && <p className="notice" style={{ marginTop: 8 }}>You rule by decree. Coups are a constant threat when stability falls.</p>}
          {P.laws.length > 0 && (
            <>
              <h3>Your laws</h3>
              <div className="row">
                {P.laws.map((l) => (
                  <Pill key={l}>{LAW_BY_ID[l]?.name ?? l}</Pill>
                ))}
              </div>
            </>
          )}
          <h3>Actions</h3>
          <ActionList actions={viewActions(s, 'politics')} api={api} />
        </Section>
      </div>
      <div className="grid two">
        <Section title="Headlines">
          {M.stories.length ? (
            <div className="list">
              {M.stories.slice(0, 12).map((st, i) => (
                <div key={i} className="small">
                  <span className="faint">{st.year}</span> · <em>{st.outlet}</em>: {st.headline} {st.planted && <Pill>planted</Pill>}
                </div>
              ))}
            </div>
          ) : (
            <Empty>Nobody writes about you. Yet.</Empty>
          )}
          <h3>Secrets</h3>
          {M.secrets.length ? (
            <div className="list">
              {M.secrets.map((sec) => (
                <div key={sec.id} className="small">
                  {sec.text} <span className="muted">(age {sec.age}, severity {sec.severity})</span> {sec.exposed ? <Pill tone="bad">Exposed</Pill> : <Pill>Hidden</Pill>}
                </div>
              ))}
            </div>
          ) : (
            <Empty>No secrets. Remarkable.</Empty>
          )}
        </Section>
        <Section title="Media actions">
          <ActionList actions={viewActions(s, 'media')} api={api} empty="Become famous first." />
        </Section>
      </div>
    </>
  );
}
