import { useState } from 'react';
import { Ctx, fmtMoney, fmtYear, marketView, type GameState } from '../../engine';
import { ASSET_BY_ID, ASSETS } from '../../engine/data/assets';
import { assetIncomeEstimate } from '../../engine/systems/assets';
import { livingCost } from '../../engine/systems/finance';
import { countryName } from '../../engine/data/countries';
import { Empty, KV, Pill, Section, type Api } from '../components';
import { ASSET_ICON } from '../art/icons';
import { House } from 'lucide-react';

export function MoneyPanel({ s, api }: { s: GameState; api: Api }) {
  const x = new Ctx(s);
  const c = s.char;
  const [amount, setAmount] = useState<Record<string, string>>({});
  const market = marketView(s);
  const busy = !!s.queue.length || s.phase !== 'alive';
  return (
    <>
      <Section title="Finances">
        <KV
          rows={[
            ['Cash', fmtMoney(c.money)],
            ['Debt', fmtMoney(c.debt)],
            ['Dirty money', fmtMoney(c.crime.dirtyMoney)],
            ['Offshore', fmtMoney(c.crime.offshore)],
            ['Net worth', fmtMoney(x.netWorth())],
            ['Living costs', `${fmtMoney(livingCost(x))}/yr (${c.lifestyle})`],
            ['Salary', c.career ? `${fmtMoney(c.career.salary)}/yr` : '—'],
          ]}
        />
      </Section>
      <Section title="Your assets">
        {c.assets.length ? (
          <div className="list">
            {c.assets.map((a) => {
              const def = ASSET_BY_ID[a.typeId];
              const AssetIcon = ASSET_ICON[a.typeId] ?? House;
              return (
                <div key={a.id} className="item">
                  <div className="spread">
                    <div>
                      <span className="mini-icon" aria-hidden>
                        <AssetIcon size={16} />
                      </span>{' '}
                      <strong>{a.name}</strong> <span className="muted small">· {countryName(a.countryId, x.year)} · bought {fmtYear(a.boughtYear)}</span>
                    </div>
                    <div className="row">
                      {a.seized && <Pill tone="bad">Seized</Pill>}
                      {a.front && <Pill tone="accent">Front</Pill>}
                      {a.rentedOut && <Pill tone="good">Rented</Pill>}
                      {a.level > 1 && <Pill>Level {a.level}</Pill>}
                    </div>
                  </div>
                  <div className="small">
                    Value {fmtMoney(a.value)}
                    {a.mortgage ? ` · mortgage ${fmtMoney(a.mortgage)}` : ''} · condition {Math.round(a.condition)}% · est. income {fmtMoney(assetIncomeEstimate(a))}/yr
                  </div>
                  <div className="small muted">Risk: {def?.risk}</div>
                  {!a.seized && !def?.notForSale && (
                    <div className="row" style={{ marginTop: 6 }}>
                      {def?.cat === 'investment' ? (
                        <button className="btn" disabled={busy} onClick={() => api.act('sellPart', a.id)}>
                          Sell half
                        </button>
                      ) : null}
                      <button className="btn" disabled={busy} onClick={() => api.act('sell', a.id)}>
                        Sell
                      </button>
                      {def?.rentable && (
                        <button className="btn" disabled={busy} onClick={() => api.act('rent', a.id)}>
                          {a.rentedOut ? 'Stop renting' : 'Rent out'}
                        </button>
                      )}
                      {def?.developable && (
                        <button className="btn" disabled={busy || c.ap < 1} onClick={() => api.act('develop', a.id)}>
                          Develop ({fmtMoney(a.value * 0.25)})
                        </button>
                      )}
                      {def?.cat !== 'investment' && (
                        <button className="btn" disabled={busy || c.ap < 1} onClick={() => api.act('renovate', a.id)}>
                          Renovate ({fmtMoney(a.value * 0.05)})
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <Empty>You own nothing.</Empty>
        )}
      </Section>
      <Section title="Market" right={<span className="muted small">Prices follow the world economy ({Math.round(x.w.economy)}/100)</span>}>
        <div className="list">
          {market.map((m) => (
            <div key={m.id} className={`item ${m.eligible ? '' : 'disabled'}`}>
              <div className="spread">
                <div>
                  <strong>{m.name}</strong> {!m.investment && <span className="muted small">· {fmtMoney(m.price)}</span>}
                </div>
                <div className="row">
                  {m.investment ? (
                    <>
                      <input type="number" min={1000} placeholder="Amount" value={amount[m.id] ?? ''} onChange={(e) => setAmount({ ...amount, [m.id]: e.target.value })} style={{ width: 120 }} aria-label={`Invest in ${m.name}`} />
                      <button className="btn" disabled={busy || !m.eligible || c.ap < 1} onClick={() => api.act('invest', m.id, Number(amount[m.id]) || 1000)}>
                        Invest
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="btn" disabled={busy || !m.eligible || c.ap < 1 || c.money < m.price} onClick={() => api.act('buy', m.id)}>
                        Buy
                      </button>
                      {m.mortgage && (
                        <button className="btn" disabled={busy || !m.eligible || c.ap < 1 || c.money < m.price * 0.2} onClick={() => api.act('buyMortgage', m.id)}>
                          Mortgage (20% down)
                        </button>
                      )}
                      {c.crime.dirtyMoney > 0 && (
                        <button className="btn" disabled={busy || !m.eligible || c.ap < 1 || c.crime.dirtyMoney < m.price} onClick={() => api.act('buyDirty', m.id)}>
                          Dirty cash
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="small muted">
                {m.income} · Risk: {m.risk} · Acquire: {m.acquire}
              </div>
              {!m.eligible && m.reason && <div className="small" style={{ color: 'var(--warn)' }}>{m.reason}</div>}
            </div>
          ))}
        </div>
      </Section>
      <Section title="Asset classes">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Acquire</th>
                <th>Income</th>
                <th>Risk</th>
              </tr>
            </thead>
            <tbody>
              {ASSETS.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td>{a.acquire}</td>
                  <td>{a.income}</td>
                  <td>{a.risk}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}
