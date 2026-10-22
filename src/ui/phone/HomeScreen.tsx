import { Ctx, fmtMoney, STAGE_NAMES, type GameState } from '../../engine';
import { currentTitle } from '../../engine/systems/careers';
import { eraOf } from '../../engine/data/eras';
import { Avatar, playerSpec } from '../art/Avatar';
import { APPS, AppIcon, DOCK, type AppDef, type AppId } from './apps';
import { yearLabel } from './Phone';

function Ring({ value, label, color }: { value: number; label: string; color: string }) {
  const r = 17;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="ring" title={`${label} ${Math.round(v)}`}>
      <svg viewBox="0 0 44 44" width={46} height={46} aria-hidden>
        <circle cx={22} cy={22} r={r} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={5} />
        <circle cx={22} cy={22} r={r} fill="none" stroke={color} strokeWidth={5} strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} transform="rotate(-90 22 22)" />
      </svg>
      <span className="ring-val">{Math.round(v)}</span>
      <span className="ring-label">{label}</span>
    </div>
  );
}

function Tile({ app, s, onOpen }: { app: AppDef; s: GameState; onOpen: (id: AppId) => void }) {
  const badge = app.badge?.(s);
  return (
    <button className="app-tile" onClick={() => onOpen(app.id)} aria-label={app.name}>
      <AppIcon app={app} badge={badge} />
      <span className="app-name">{app.name}</span>
    </button>
  );
}

export function HomeScreen({ s, onOpen }: { s: GameState; onOpen: (id: AppId) => void }) {
  const x = new Ctx(s);
  const c = s.char;
  const st = c.stats;
  const grid = APPS.filter((a) => !DOCK.includes(a.id));
  return (
    <div className="home">
      <div className="widget profile" onClick={() => onOpen('stats')} role="button" tabIndex={0} aria-label="Your profile">
        <Avatar a={playerSpec(s)} size={64} title={`${c.firstName} ${c.lastName}`} />
        <div className="profile-text">
          <div className="profile-name">
            {c.firstName} {c.lastName}
          </div>
          <div className="profile-sub">
            {c.age} · {STAGE_NAMES[x.stage]} · {currentTitle(x)}
          </div>
          <div className="profile-sub">
            {x.countryName} · {yearLabel(x.year)} · {eraOf(x.year).name}
          </div>
        </div>
        <div className={`profile-money ${c.money < 0 ? 'neg' : ''}`}>
          {fmtMoney(c.money)}
          {c.debt > 0 && <span className="debt">debt {fmtMoney(c.debt)}</span>}
        </div>
      </div>
      <div className="widget rings">
        <Ring value={st.happiness} label="Happy" color="#ffd166" />
        <Ring value={st.health} label="Health" color="#ff5d73" />
        <Ring value={st.smarts} label="Smarts" color="#4cc9f0" />
        <Ring value={st.looks} label="Looks" color="#c77dff" />
        <Ring value={st.fitness} label="Fit" color="#06d6a0" />
      </div>
      <div className="app-grid">
        {grid.map((a) => (
          <Tile key={a.id} app={a} s={s} onOpen={onOpen} />
        ))}
      </div>
      <div className="dock">
        {DOCK.map((id) => {
          const a = APPS.find((p) => p.id === id)!;
          return <Tile key={id} app={a} s={s} onOpen={onOpen} />;
        })}
      </div>
    </div>
  );
}
