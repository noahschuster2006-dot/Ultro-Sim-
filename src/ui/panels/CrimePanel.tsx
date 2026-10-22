import { Ctx, fmtMoney, viewActions, type GameState } from '../../engine';
import { ORG_RANKS, PRISON_TIERS } from '../../engine/data/underworld';
import { drugName, operationIncome, orgRankName } from '../../engine/systems/underworld';
import { canExtradite, countryName } from '../../engine/data/countries';
import { ActionList, Bar, Empty, KV, Pill, Section, type Api } from '../components';

export function CrimePanel({ s, api }: { s: GameState; api: Api }) {
  const x = new Ctx(s);
  const c = s.char;
  const L = c.legal;
  const P = L.prison;
  return (
    <>
      {P && (
        <Section title="Prison" right={<Pill tone="bad">{PRISON_TIERS.find((t) => t.id === P.tier)?.name}</Pill>}>
          <KV
            rows={[
              ['Crime', P.crimeLabel],
              ['Sentence', P.tier === 'deathRow' ? 'Death' : `${P.served} of ${P.sentence} years`],
              ['Gang', P.gang ?? 'None'],
              ['Yard rank', Math.round(P.rank)],
              ['Good behavior', Math.round(P.goodBehavior)],
              ['Guard favor', Math.round(P.guardFavor)],
              ['Appeals left', P.appeals],
            ]}
          />
          <p className="small muted">{PRISON_TIERS.find((t) => t.id === P.tier)?.desc}</p>
          <ActionList actions={viewActions(s, 'prison')} api={api} />
        </Section>
      )}
      <div className="grid two">
        <Section title="Police & evidence">
          <Bar id="heat" value={x.stat('heat')} />
          <Bar id="evidence" value={x.stat('evidence')} />
          <Bar id="criminalRep" value={x.stat('criminalRep')} />
          <Bar id="streetCred" value={x.stat('streetCred')} />
          <Bar id="fear" value={x.stat('fear')} />
          <Bar id="corruption" value={x.stat('corruption')} />
          <KV
            rows={[
              ['Arrests', L.arrests],
              ['Convictions', L.record.length],
              ['Juvenile record', L.juvenileRecord ? 'Yes' : 'No'],
              ['Fugitive', L.fugitive ? 'Yes' : 'No'],
              ['Interpol red notice', L.interpolNotice ? 'Yes' : 'No'],
              ['Parole / probation', `${L.parole} / ${L.probation} yrs`],
              ['Witness protection', L.witnessProtection ? `Yes (was ${L.witnessProtection.formerName})` : 'No'],
            ]}
          />
          <h3>Open cases</h3>
          {L.cases.filter((k) => k.status !== 'closed').length ? (
            <div className="list">
              {L.cases
                .filter((k) => k.status !== 'closed')
                .map((k) => (
                  <div key={k.id} className="item small">
                    <div className="spread">
                      <strong>{k.label}</strong>
                      <Pill tone={k.evidence > 60 ? 'bad' : undefined}>Evidence {Math.round(k.evidence)}</Pill>
                    </div>
                    <div className="muted">
                      Age {k.age} · {countryName(k.countryId, x.year)}
                      {k.physical ? ' · physical evidence' : ''}
                      {k.witnesses.length ? ` · ${k.witnesses.filter((w) => s.npcs[w]?.alive).length} witness(es)` : ''}
                      {k.countryId !== c.countryId ? (canExtradite(k.countryId, c.countryId) ? ' · extraditable' : ' · out of reach') : ''}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <Empty>No open cases. Evidence above 60 triggers arrests; above 80 means conviction is likely.</Empty>
          )}
          {L.record.length > 0 && (
            <>
              <h3>Record</h3>
              {L.record.map((r, i) => (
                <div key={i} className="small">
                  Age {r.age}: {r.crime} ({r.years} yrs, {countryName(r.countryId, x.year)})
                </div>
              ))}
            </>
          )}
          {L.lawsuits.length > 0 && (
            <>
              <h3>Lawsuits</h3>
              {L.lawsuits.map((l) => (
                <div key={l.id} className="small">
                  {l.kind} — you are the {l.role} vs {l.otherParty} for {fmtMoney(l.amount)}
                </div>
              ))}
            </>
          )}
        </Section>
        <Section title="The organization">
          {c.crime.orgName ? (
            <>
              <KV
                rows={[
                  ['Organization', c.crime.orgName],
                  ['Rank', orgRankName(c.crime.orgRank)],
                  ['Loyalty', Math.round(c.crime.orgLoyalty)],
                  ['Territory', `${c.crime.territory} blocks`],
                  ['Rivals', c.crime.rivalOrgs.join(', ') || '—'],
                ]}
              />
              <div className="row" style={{ marginTop: 8 }}>
                {ORG_RANKS.map((r, i) => (
                  <Pill key={r} tone={i === c.crime.orgRank ? 'accent' : undefined}>
                    {r}
                  </Pill>
                ))}
              </div>
            </>
          ) : (
            <Empty>You are not in an organization.</Empty>
          )}
          <h3>Operations</h3>
          {c.crime.operations.length ? (
            <div className="list">
              {c.crime.operations.map((o) => (
                <div key={o.id} className="item small">
                  <div className="spread">
                    <strong>{o.kind === 'drugs' ? `${drugName(o.product, x.year)} · ${o.stage}` : `${o.kind} · ${o.product}`}</strong>
                    <Pill>Scale {o.scale}</Pill>
                  </div>
                  <div className="muted">
                    Last year {fmtMoney(o.lastIncome)} · projected {fmtMoney(operationIncome(x, o))}/yr · running {o.years} yrs
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty>No operations. Demand responds to the world: war drives arms prices, prohibition makes bootleggers rich, legalization collapses cannabis margins.</Empty>
          )}
          <KV
            rows={[
              ['Dirty money', fmtMoney(c.crime.dirtyMoney)],
              ['Offshore', fmtMoney(c.crime.offshore)],
              ['Laundering stage reached', ['None', 'Placement', 'Layering', 'Integration'][c.crime.launderStage]],
            ]}
          />
        </Section>
      </div>
      {!P && (
        <Section title="Underworld actions">
          {!s.settings.matureThemes && <p className="small muted">Mature themes are off: the murder action is hidden.</p>}
          <ActionList actions={viewActions(s, 'crime')} api={api} />
        </Section>
      )}
    </>
  );
}
