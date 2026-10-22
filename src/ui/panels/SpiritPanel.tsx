import { Ctx, viewActions, type GameState } from '../../engine';
import { BLESSING_BY_ID, CURSE_BY_ID, SOCIETY_BY_ID } from '../../engine/data/occult';
import { RELIGION_BY_ID } from '../../engine/data/countries';
import { religionName } from '../../engine/systems/spirit';
import { ActionList, Bar, Empty, KV, Pill, Section, type Api } from '../components';

export function SpiritPanel({ s, api }: { s: GameState; api: Api }) {
  const x = new Ctx(s);
  const S = s.char.spiritual;
  const df = x.stat('divineFavor');
  const tier = df >= 100 ? 'Prophetic visions' : df >= 75 ? 'Miracles' : df >= 50 ? 'Answered prayers' : df >= 25 ? 'Minor coincidences' : 'None yet';
  const inst = s.world.institutions.find((i) => i.religionId === s.char.religionId);
  return (
    <>
      <div className="grid two">
        <Section title="Soul">
          <Bar id="karma" value={x.stat('karma')} />
          <Bar id="faith" value={x.stat('faith')} />
          <Bar id="sin" value={x.stat('sin')} />
          <Bar id="divineFavor" value={df} />
          <Bar id="paranormal" value={x.stat('paranormal')} />
          <KV
            rows={[
              ['Religion', religionName(x)],
              ['Divine favor tier', tier],
              ['Rituals performed', S.rituals],
              ['Soul', S.soulSold ? 'Sold' : 'Your own'],
              ...(S.foundedReligion ? ([['Your followers', S.followers.toLocaleString('en-US')]] as [string, string][]) : []),
              ...(inst ? ([[`${RELIGION_BY_ID[inst.religionId]?.name} institution`, `influence ${Math.round(inst.influence)}, corruption ${Math.round(inst.corruption)}`]] as [string, string][]) : []),
            ]}
          />
          <p className="small muted" style={{ marginTop: 8 }}>
            Karma above 70 and faith above 60 accumulate divine favor. Karma below −70 plus a completed ritual brings pact offers.
          </p>
        </Section>
        <Section title="Supernatural">
          <h3>Curses</h3>
          {S.curses.length ? (
            S.curses.map((c) => (
              <div key={c.id} className="item small">
                <strong>{CURSE_BY_ID[c.id]?.name ?? c.id}</strong> <Pill tone="bad">Level {c.level}</Pill>
                <div className="muted">{CURSE_BY_ID[c.id]?.effect}</div>
                <div>Break it: {CURSE_BY_ID[c.id]?.breakPath}</div>
              </div>
            ))
          ) : (
            <Empty>No curses.</Empty>
          )}
          <h3>Blessings</h3>
          {S.blessings.length ? (
            <div className="row">
              {S.blessings.map((b) => (
                <span key={b.id} title={BLESSING_BY_ID[b.id]?.effect}>
                  <Pill tone="good">{BLESSING_BY_ID[b.id]?.name ?? b.id}</Pill>
                </span>
              ))}
            </div>
          ) : (
            <Empty>No blessings.</Empty>
          )}
          <h3>Pacts</h3>
          {S.pacts.length ? (
            S.pacts.map((p) => (
              <div key={p.id} className="small">
                {p.name} (age {p.age}) — cost: {p.cost}
              </div>
            ))
          ) : (
            <Empty>No pacts. Yet.</Empty>
          )}
          <h3>Secret societies</h3>
          {S.societies.length || S.invites.length ? (
            <div className="row">
              {S.societies.map((id) => (
                <Pill key={id} tone="accent">
                  {SOCIETY_BY_ID[id]?.name}
                </Pill>
              ))}
              {S.invites.map((id) => (
                <Pill key={id}>Invited: {SOCIETY_BY_ID[id]?.name}</Pill>
              ))}
            </div>
          ) : (
            <Empty>No society has noticed you.</Empty>
          )}
          {S.visions.length > 0 && (
            <>
              <h3>Visions</h3>
              {S.visions.map((v, i) => (
                <div key={i} className="small" style={{ color: 'var(--major)' }}>
                  {v}
                </div>
              ))}
            </>
          )}
        </Section>
      </div>
      <Section title="Spiritual actions">
        <ActionList actions={viewActions(s, 'spirit')} api={api} />
      </Section>
    </>
  );
}
