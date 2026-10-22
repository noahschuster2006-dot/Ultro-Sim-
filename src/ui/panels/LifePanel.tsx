import { useState } from 'react';
import type { GameState, LogEntry } from '../../engine';

function yearLabel(y: number): string {
  return y < 0 ? `${-y} BC` : String(y);
}

export function LifePanel({ s }: { s: GameState }) {
  const [filter, setFilter] = useState<'all' | 'me' | 'world'>('all');
  const groups = (() => {
    const out: { age: number; year: number; entries: LogEntry[] }[] = [];
    for (const e of s.char.log) {
      if (filter === 'me' && e.tone === 'world') continue;
      if (filter === 'world' && e.tone !== 'world') continue;
      const last = out[out.length - 1];
      if (last && last.age === e.age) last.entries.push(e);
      else out.push({ age: e.age, year: e.year, entries: [e] });
    }
    return out.reverse();
  })();
  return (
    <div className="card">
      <div className="spread" style={{ marginBottom: 10 }}>
        <h2>Life story</h2>
        <div className="row">
          {(['all', 'me', 'world'] as const).map((f) => (
            <button key={f} className={`tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'all' ? 'Everything' : f === 'me' ? 'My life' : 'The world'}
            </button>
          ))}
        </div>
      </div>
      <div className="log">
        {groups.map((g) => (
          <div key={`${g.age}-${g.year}`} className="log-year">
            <div className="yh">
              Age {g.age} <span className="faint small">· {yearLabel(g.year)}</span>
            </div>
            {g.entries.map((e, i) => (
              <div key={i} className={`log-entry ${e.tone}`}>
                {e.text}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
