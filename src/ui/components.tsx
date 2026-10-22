import { useState, type ReactNode } from 'react';
import type { ActionView } from '../engine';
import { actionIconFor } from './art/icons';
import { STAT_BY_ID, type StatId } from '../engine/data/stats';

export interface Api {
  act: (id: string, arg?: string, amount?: number) => void;
}

export function Bar({ id, value, delta, label }: { id: StatId; value: number; delta?: number; label?: string }) {
  const def = STAT_BY_ID[id];
  const pct = ((value - def.min) / (def.max - def.min)) * 100;
  const good = def.bad ? 100 - pct : pct;
  const color = id === 'karma' ? (value >= 0 ? 'var(--good)' : 'var(--bad)') : good > 66 ? 'var(--good)' : good > 33 ? 'var(--warn)' : 'var(--bad)';
  const d = delta ? Math.round(delta) : 0;
  const better = def.bad ? d < 0 : d > 0;
  return (
    <div className="bar" title={def.desc}>
      <div className="label">
        <span>
          {label ?? def.name}
          {d !== 0 && <span className={`delta ${better ? 'up' : 'down'}`}>{d > 0 ? `+${d}` : d}</span>}
        </span>
        <span>{Math.round(value)}</span>
      </div>
      <div className="track">
        <div className="fill" style={{ width: `${Math.max(2, pct)}%`, background: color }} />
      </div>
    </div>
  );
}

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="card">
      <div className="spread" style={{ marginBottom: 8 }}>
        <h2>{title}</h2>
        {right}
      </div>
      {children}
    </div>
  );
}

export function Pill({ children, tone }: { children: ReactNode; tone?: 'good' | 'bad' | 'accent' }) {
  return <span className={`pill ${tone ?? ''}`}>{children}</span>;
}

export function KV({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <dl className="kv">
      {rows.map(([k, v], i) => (
        <div key={i} style={{ display: 'contents' }}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** One player action with optional option picker and amount input. */
export function ActionRow({ a, api, arg, compact }: { a: ActionView; api: Api; arg?: string; compact?: boolean }) {
  const firstOk = a.options?.find((o) => !o.disabled)?.value ?? a.options?.[0]?.value ?? '';
  const [opt, setOpt] = useState(firstOk);
  const [amount, setAmount] = useState('');
  const selected = a.options?.find((o) => o.value === opt);
  const optDisabled = !!selected?.disabled;
  const run = () => {
    const packed = a.options ? (arg ? `${arg}|${opt}` : opt) : arg;
    api.act(a.id, packed, a.amount ? Number(amount) || undefined : undefined);
  };
  const Icon = actionIconFor(a);
  return (
    <div className={`action ${a.enabled ? '' : 'off'}`}>
      <span className="action-icon" aria-hidden>
        <Icon size={18} />
      </span>
      <div className="meta">
        <div style={{ fontWeight: 600 }}>
          {a.label} {a.ap > 0 && <span className="faint tiny">· {a.ap} action{a.ap > 1 ? 's' : ''}</span>}
        </div>
        {!compact && a.desc && <div className="muted small">{a.desc}</div>}
        {a.reason && <div className="reason">{a.reason}</div>}
        {selected?.disabled && <div className="reason">{selected.disabled}</div>}
      </div>
      <div className="controls">
        {a.options && (
          <select value={opt} onChange={(e) => setOpt(e.target.value)} aria-label={`${a.label} option`}>
            {a.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
                {o.disabled ? ` — ${o.disabled}` : ''}
              </option>
            ))}
          </select>
        )}
        {a.amount && <input type="number" min={0} placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: 120 }} aria-label="Amount" />}
        <button className="btn" disabled={!a.enabled || optDisabled || (!!a.options && !opt)} onClick={run}>
          Go
        </button>
      </div>
    </div>
  );
}

export function ActionList({ actions, api, arg, empty, compact, grouped }: { actions: ActionView[]; api: Api; arg?: string; empty?: string; compact?: boolean; grouped?: boolean }) {
  if (!actions.length) return <div className="muted small">{empty ?? 'Nothing to do here right now.'}</div>;
  const row = (a: ActionView) => <ActionRow key={`${a.id}:${arg ?? ''}:${a.options?.length ?? 0}`} a={a} api={api} arg={arg} compact={compact} />;
  if (!grouped || !actions.some((a) => a.group)) return <div className="list">{actions.map(row)}</div>;
  // Keep the order groups first appear in.
  const groups: [string, ActionView[]][] = [];
  for (const a of actions) {
    const g = a.group ?? 'More';
    const hit = groups.find(([k]) => k === g);
    if (hit) hit[1].push(a);
    else groups.push([g, [a]]);
  }
  return (
    <div className="list">
      {groups.map(([g, list]) => (
        <div key={g} className="action-group">
          <h3>{g}</h3>
          <div className="list">{list.map(row)}</div>
        </div>
      ))}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="muted small">{children}</div>;
}
