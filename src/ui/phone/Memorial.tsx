import { useState } from 'react';
import { fmtMoney, heirCandidates, type GameState } from '../../engine';
import { Avatar, npcSpec, playerSpec } from '../art/Avatar';
import { DynastyPanel } from '../panels/DynastyPanel';
import { yearLabel } from './Phone';
import { sfx } from '../audio/sfx';

/** The memorial screen shown when a life ends: obituary, afterlife cards, estate and heirs. */
export function Memorial({ s, onContinue, onNewLife }: { s: GameState; onContinue: (id: string) => void; onNewLife: () => void }) {
  const d = s.death!;
  const [revealed, setRevealed] = useState(0);
  const heirs = heirCandidates(s);
  return (
    <div className="setup memorial">
      <div className="app-body">
        <div className="memorial-head">
          <Avatar a={{ ...playerSpec(s), dead: true }} size={96} />
          <h1>{d.name}</h1>
          <p className="muted small">
            {yearLabel(d.year - d.age)} – {yearLabel(d.year)} · died aged {d.age} of {d.cause}
          </p>
          {d.legendary && <span className="pill accent">Legendary</span>}
        </div>
        <div className="card">
          <h2>Obituary</h2>
          <p className="small">{d.obituary}</p>
        </div>
        <div className="card">
          <div className="spread">
            <h2>Afterlife reading</h2>
            {revealed < 3 && (
              <button
                className="btn"
                onClick={() => {
                  setRevealed((r) => r + 1);
                  sfx.play('magic');
                }}
              >
                Turn a card
              </button>
            )}
          </div>
          <div className="tarot-row">
            {d.cards.map((c, i) => (
              <div key={c.title} className={`tarot-card ${i < revealed ? 'flipped' : ''}`}>
                <div className="tarot-inner">
                  <div className="tarot-back">✦</div>
                  <div className="tarot-front">
                    <h4>{c.title}</h4>
                    <p className="tiny">{c.text}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h2>Estate</h2>
          <p className="small muted">
            Net worth at death {fmtMoney(d.estate)}. After debts and the 30% lost to taxes, lawyers and time, {fmtMoney(d.inheritancePool)} passes on. Prestige +{d.prestigeGained}.
          </p>
          {heirs.length ? (
            <div className="list">
              {d.heirs.map((h) => {
                const n = s.npcs[h.npcId];
                return (
                  <div key={h.npcId} className="item heir">
                    {n && <Avatar a={npcSpec(s, n, 70)} size={44} />}
                    <div className="heir-text">
                      <strong>{h.name}</strong>
                      <div className="tiny muted">
                        {h.relation}, age {h.age} · inherits {fmtMoney(h.share)}
                      </div>
                    </div>
                    <button className="btn primary" onClick={() => onContinue(h.npcId)}>
                      Play
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="notice">There is no heir. House {s.dynasty.name} ends here.</p>
          )}
          <button className="btn ghost" style={{ marginTop: 10, width: '100%' }} onClick={onNewLife}>
            Start a new dynasty
          </button>
        </div>
        <div style={{ marginTop: 12 }}>
          <DynastyPanel s={s} />
        </div>
      </div>
    </div>
  );
}
