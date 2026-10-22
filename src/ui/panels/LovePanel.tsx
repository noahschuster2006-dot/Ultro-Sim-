import { useState } from 'react';
import { Ctx, viewActions, type GameState } from '../../engine';
import { npcTitle } from '../../engine/systems/npcs';
import { relationshipLabel } from '../../engine/systems/relationships';
import { Avatar, npcSpec } from '../art/Avatar';
import { ActionList, Empty, Pill, Section, type Api } from '../components';

/** The Love app: your partner(s), what you can do together, and ways to meet someone. */
export function LovePanel({ s, api }: { s: GameState; api: Api }) {
  const x = new Ctx(s);
  const lovers = x.lovers().filter((r) => s.npcs[r.npcId]?.alive);
  const exes = x.rels('ex').filter((r) => s.npcs[r.npcId]?.alive).slice(0, 6);
  const [sel, setSel] = useState<string | null>(lovers[0]?.npcId ?? null);
  const current = sel && lovers.some((r) => r.npcId === sel) ? sel : lovers[0]?.npcId;
  const npc = current ? s.npcs[current] : undefined;
  const rel = current ? x.rel(current) : undefined;
  return (
    <>
      {s.char.age < 18 ? (
        <Section title="Not yet">
          <Empty>Love, dating and everything that comes with it unlock at 18. For now: crushes, notes passed in class and nervous school dances.</Empty>
        </Section>
      ) : lovers.length ? (
        <Section title={lovers.length > 1 ? 'Your loves' : 'Your love'}>
          <div className="lover-row">
            {lovers.map((r) => {
              const n = s.npcs[r.npcId];
              return (
                <button key={r.npcId} className={`lover ${r.npcId === current ? 'active' : ''}`} onClick={() => setSel(r.npcId)}>
                  <Avatar a={npcSpec(s, n, r.affinity)} size={64} />
                  <span className="lover-name">{n.firstName}</span>
                  <Pill tone={r.type === 'affair' ? 'bad' : 'accent'}>{relationshipLabel(r)}</Pill>
                </button>
              );
            })}
          </div>
          {npc && rel && (
            <>
              <div className="small muted" style={{ marginTop: 8 }}>
                {npc.firstName} {npc.lastName}, {x.npcAge(npc)} · {npcTitle(x, npc)}
              </div>
              <div className="love-meters">
                <Meter label="Love" value={rel.affinity} color="#ff4f7b" />
                <Meter label="Trust" value={rel.trust} color="#4cc9f0" />
                <Meter label="Spark" value={rel.attraction} color="#ffb02e" />
              </div>
              <h3>Together</h3>
              <ActionList actions={viewActions(s, 'rel', npc.id)} api={api} arg={npc.id} compact grouped />
            </>
          )}
        </Section>
      ) : (
        <Section title="Single">
          <Empty>Nobody special right now. That can change tonight.</Empty>
        </Section>
      )}
      {s.char.age >= 18 && (
        <Section title="Meet someone">
          <ActionList actions={[...viewActions(s, 'romance'), ...viewActions(s, 'social').filter((a) => a.id === 'findLove')]} api={api} grouped />
        </Section>
      )}
      {exes.length > 0 && (
        <Section title="Exes">
          <div className="list">
            {exes.map((r) => {
              const n = s.npcs[r.npcId];
              return (
                <div key={r.npcId} className="item small contact">
                  <Avatar a={npcSpec(s, n, r.affinity)} size={34} />
                  <span>
                    {n.firstName} {n.lastName} <span className="muted">· {x.npcAge(n)} · {npcTitle(x, n)}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </Section>
      )}
    </>
  );
}

function Meter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="meter">
      <span>{label}</span>
      <div className="track" style={{ height: 6 }}>
        <div className="fill" style={{ width: `${Math.max(2, Math.min(100, value))}%`, background: color, borderRadius: 6 }} />
      </div>
    </div>
  );
}
