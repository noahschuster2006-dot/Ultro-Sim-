import { useState, useSyncExternalStore } from 'react';
import type { GameState } from '../../engine';
import { music } from '../audio/music';
import { sfx } from '../audio/sfx';
import { uiPrefs, usePrefs } from '../prefs';

function Toggle({ label, desc, on, set }: { label: string; desc?: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <label className="setting">
      <span>
        <span className="setting-label">{label}</span>
        {desc && <span className="tiny muted setting-desc">{desc}</span>}
      </span>
      <input type="checkbox" className="switch" checked={on} onChange={(e) => set(e.target.checked)} />
    </label>
  );
}

export function SettingsApp({ s, onMenuAction }: { s: GameState; onMenuAction: (a: 'download' | 'abandon') => void }) {
  const p = usePrefs();
  const [, bump] = useState(0);
  const m = useSyncExternalStore((fn) => music.subscribe(fn), () => music.state, () => music.state);
  return (
    <div>
      <div className="settings-group">
        <Toggle label="Background scenes" desc="Animations play behind the phone when something happens." on={p.scenes} set={(v) => uiPrefs.set({ scenes: v })} />
        <Toggle label="Lower the phone for scenes" desc="On small screens, the phone dips so you can see what is happening." on={p.dipPhone} set={(v) => uiPrefs.set({ dipPhone: v })} />
        <Toggle label="Reduce motion" desc="No camera shake and calmer transitions." on={p.reducedMotion} set={(v) => uiPrefs.set({ reducedMotion: v })} />
      </div>
      <div className="settings-group">
        <Toggle
          label="Music"
          on={!m.muted}
          set={(v) => {
            music.unlock();
            music.setMuted(!v);
            if (v) music.play();
          }}
        />
        <label className="setting">
          <span className="setting-label">Music volume</span>
          <input type="range" min={0} max={100} value={Math.round(m.volume * 100)} onChange={(e) => music.setVolume(Number(e.target.value) / 100)} aria-label="Music volume" />
        </label>
        <Toggle label="Sound effects" on={!sfx.state.muted} set={(v) => {
            sfx.setMuted(!v);
            bump((n) => n + 1);
          }} />
      </div>
      <div className="settings-group">
        <div className="setting">
          <span className="setting-label">Seed</span>
          <span className="muted">{s.seed}</span>
        </div>
        <div className="setting">
          <span className="setting-label">Autosave</span>
          <span className="muted small">after every action, on this device</span>
        </div>
        <button className="setting link" onClick={() => onMenuAction('download')}>
          Download save file
        </button>
        <button className="setting link danger" onClick={() => onMenuAction('abandon')}>
          Abandon this life
        </button>
      </div>
    </div>
  );
}
