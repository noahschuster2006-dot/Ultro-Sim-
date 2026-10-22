import { useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Baby, Check, ChevronLeft, Crown, Dices, Eye, Gem, GraduationCap, Landmark, Lock, Music, Palette, Rocket, Trophy, VenetianMask, Footprints, Swords, Users } from 'lucide-react';
import { newGame, type FamilyHealth, type FamilyStatus, type GameState, type Gender, type Sexuality } from '../../engine';
import { ERAS } from '../../engine/data/eras';
import { countriesAvailable, countryName, RELIGIONS } from '../../engine/data/countries';
import { TRAITS } from '../../engine/data/occult';
import { newSeed } from '../../engine/rng';
import { loadHall } from '../storage';
import { AppIcon } from './apps';
import { yearLabel } from './Phone';
import { sfx } from '../audio/sfx';

const ERA_CHIPS: { label: string; year: number }[] = [
  { label: 'Rome', year: -50 },
  { label: 'Medieval', year: 1180 },
  { label: 'Black Death', year: 1340 },
  { label: 'Renaissance', year: 1490 },
  { label: 'Industrial', year: 1840 },
  { label: 'Belle Époque', year: 1895 },
  { label: 'Jazz Age', year: 1920 },
  { label: 'Baby boom', year: 1950 },
  { label: 'Cold War', year: 1965 },
  { label: 'Digital', year: 1990 },
  { label: 'Social media', year: 2008 },
  { label: 'Today', year: 2026 },
  { label: 'Near future', year: 2040 },
];

interface Form {
  year: number;
  country: string;
  gender: 'random' | Gender;
  sexuality: 'random' | Sexuality;
  first: string;
  last: string;
  status: 'random' | FamilyStatus;
  health: 'random' | FamilyHealth;
  religion: string;
  siblings: 'random' | 'none' | 'few' | 'many';
  traits: string[];
  dementia: boolean;
  mature: boolean;
  seed: string;
}

const BLANK: Form = {
  year: 1990,
  country: 'random',
  gender: 'random',
  sexuality: 'random',
  first: '',
  last: '',
  status: 'random',
  health: 'random',
  religion: 'random',
  siblings: 'random',
  traits: [],
  dementia: false,
  mature: true,
  seed: '',
};

interface Scenario {
  id: string;
  name: string;
  desc: string;
  icon: LucideIcon;
  from: string;
  to: string;
  patch: Partial<Form>;
}

const SCENARIOS: Scenario[] = [
  { id: 'random', name: 'Surprise me', desc: 'Everything left to fate.', icon: Dices, from: '#9fb3c8', to: '#52627a', patch: {} },
  { id: 'royal', name: 'Royal heir', desc: 'Born into a royal house, raised with love.', icon: Crown, from: '#ffe08a', to: '#d49a12', patch: { status: 'royalty', health: 'loving', siblings: 'few' } },
  { id: 'street', name: 'Street kid', desc: 'Destitute, no one at home, many mouths to feed.', icon: Footprints, from: '#c9b8a6', to: '#6e5a48', patch: { status: 'destitute', health: 'absent', siblings: 'many', traits: ['resilient'] } },
  { id: 'prodigy', name: 'Prodigy', desc: 'Middle class, doting parents, a scholar’s mind.', icon: GraduationCap, from: '#9fd0ff', to: '#3478e0', patch: { status: 'middle', health: 'overprotective', siblings: 'none', traits: ['scholarly'] } },
  { id: 'oldMoney', name: 'Old money', desc: 'Aristocracy, a shrewd head, one sibling to outshine.', icon: Gem, from: '#d9c3ff', to: '#7c4ddb', patch: { status: 'aristocracy', health: 'neglectful', siblings: 'few', traits: ['shrewd'] } },
  { id: 'athlete', name: 'Born athlete', desc: 'Working-class grit and a body built for sport.', icon: Trophy, from: '#9ef0c1', to: '#18a35c', patch: { status: 'working', health: 'loving', traits: ['athletic', 'resilient'] } },
  { id: 'artist', name: 'Tortured artist', desc: 'Gifted, sensitive and prone to dark moods.', icon: Palette, from: '#ffb3c7', to: '#d63c6b', patch: { traits: ['artistic', 'melancholic'] } },
  { id: 'trouble', name: 'Born trouble', desc: 'A hard home and a quick temper.', icon: VenetianMask, from: '#8d93a8', to: '#2a2e3b', patch: { status: 'poor', health: 'alcoholic', traits: ['aggressive', 'riskTaker'] } },
  { id: 'seer', name: 'Second sight', desc: 'Devout, and you see things others do not.', icon: Eye, from: '#c5b2ff', to: '#4b2aa0', patch: { traits: ['paranormal', 'devout'] } },
  { id: 'bigFamily', name: 'Big family', desc: 'Loving, crowded, never a quiet moment.', icon: Users, from: '#ffd59e', to: '#f08a24', patch: { status: 'working', health: 'loving', siblings: 'many', traits: ['empathetic'] } },
  { id: 'roman', name: 'Roman citizen', desc: 'Italy, 50 BC. The Republic is dying.', icon: Landmark, from: '#f3c79a', to: '#b5651d', patch: { year: -50, country: 'it' } },
  { id: 'knight', name: 'Medieval squire', desc: 'England, 1180. Swords, plague and kings.', icon: Swords, from: '#b7c9a8', to: '#4f6b3a', patch: { year: 1180, country: 'gb', gender: 'male' } },
  { id: 'jazz', name: 'Jazz Age', desc: 'The United States, 1920. Prohibition starts now.', icon: Music, from: '#ffcf7a', to: '#c2185b', patch: { year: 1920, country: 'us' } },
  { id: 'future', name: 'Tomorrow', desc: '2040. AI, climate and the first lunar bases.', icon: Rocket, from: '#7ff0ff', to: '#5b3bdc', patch: { year: 2040 } },
  { id: 'newborn', name: 'Only child', desc: 'Wealthy, loving parents, no rivals for attention.', icon: Baby, from: '#ffc9e0', to: '#e05597', patch: { status: 'wealthy', health: 'loving', siblings: 'none' } },
];

function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map(([v, l]) => (
        <button key={v} role="radio" aria-checked={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="set-row">
      <span className="set-label">{label}</span>
      <span className="set-control">{children}</span>
    </div>
  );
}

/** Lock screen: the first thing you see. */
export function LockScreen({ saveName, onResume, onNew, onHall }: { saveName: string | null; onResume: () => void; onNew: () => void; onHall: () => void }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="lock">
      <div className="lock-top">
        <Lock size={18} aria-hidden />
        <div className="lock-date">{now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
        <div className="lock-time">
          {now.getHours()}:{String(now.getMinutes()).padStart(2, '0')}
        </div>
        <div className="lock-brand">LifeSim Ultra</div>
      </div>
      <div className="lock-notes">
        {saveName && (
          <button className="lock-note" onClick={onResume}>
            <AppIcon app={{ icon: Baby, from: '#6fe3a1', to: '#1fae68' }} size={34} />
            <span>
              <strong>Continue your life</strong>
              <span className="tiny">{saveName}</span>
            </span>
          </button>
        )}
        <button className="lock-note" onClick={onNew}>
          <AppIcon app={{ icon: Dices, from: '#ffcf70', to: '#ff8a3d' }} size={34} />
          <span>
            <strong>Start a new life</strong>
            <span className="tiny">Any era from Rome to 2040. Pick your presets or leave it to fate.</span>
          </span>
        </button>
        <button className="lock-note" onClick={onHall}>
          <AppIcon app={{ icon: Trophy, from: '#f6d77a', to: '#b8861b' }} size={34} />
          <span>
            <strong>Hall of Dynasties</strong>
            <span className="tiny">Bloodlines you have played on this device.</span>
          </span>
        </button>
      </div>
      <div className="lock-hint">Tap a notification to begin</div>
    </div>
  );
}

export function HallScreen({ onBack }: { onBack: () => void }) {
  const hall = useMemo(() => loadHall(), []);
  return (
    <div className="setup">
      <div className="app-header">
        <button className="back" onClick={onBack}>
          <ChevronLeft size={22} /> Back
        </button>
        <div className="app-header-title">
          <h1>Hall of Dynasties</h1>
        </div>
      </div>
      <div className="app-body">
        {hall.length === 0 ? (
          <p className="muted small">No dynasties yet. Every life you finish is recorded here on this device.</p>
        ) : (
          <div className="list">
            {hall.map((h, i) => (
              <div key={`${h.dynasty}-${h.founded}`} className="item">
                <div className="spread">
                  <strong>
                    #{i + 1} House {h.dynasty}
                    {h.legends ? ` ★${h.legends}` : ''}
                  </strong>
                  <span className="pill accent">{h.prestige} prestige</span>
                </div>
                <div className="small muted">
                  {h.generations} generation{h.generations === 1 ? '' : 's'} · {yearLabel(h.founded)}–{yearLabel(h.ended)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Settings-style new-life form with one-tap scenarios. */
export function NewLifeScreen({ onStart, onBack }: { onStart: (s: GameState) => void; onBack: () => void }) {
  const [f, setF] = useState<Form>(BLANK);
  const [scenario, setScenario] = useState('random');
  const set = (patch: Partial<Form>) => setF((old) => ({ ...old, ...patch }));
  const countries = useMemo(() => countriesAvailable(f.year), [f.year]);
  const era = ERAS.find((e) => f.year >= e.from && f.year <= e.to) ?? ERAS[ERAS.length - 1];
  const religions = RELIGIONS.filter((r) => r.from <= f.year && (r.to === undefined || r.to >= f.year));

  const applyScenario = (sc: Scenario) => {
    setScenario(sc.id);
    sfx.play('tap');
    setF((old) => ({ ...BLANK, year: sc.patch.year ?? old.year, country: sc.patch.country ?? (sc.patch.year !== undefined ? 'random' : old.country), dementia: old.dementia, mature: old.mature, ...sc.patch }));
  };

  const toggleTrait = (id: string) => {
    setScenario('custom');
    setF((old) => {
      if (old.traits.includes(id)) return { ...old, traits: old.traits.filter((t) => t !== id) };
      if (old.traits.length >= 3) return old;
      return { ...old, traits: [...old.traits, id] };
    });
  };

  const start = () => {
    const seed = f.seed.trim() ? Number(f.seed) >>> 0 || [...f.seed].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7) : newSeed();
    const s = newGame({
      seed,
      year: f.year,
      countryId: f.country === 'random' || !countries.some((c) => c.id === f.country) ? undefined : f.country,
      gender: f.gender === 'random' ? undefined : f.gender,
      sexuality: f.sexuality === 'random' ? undefined : f.sexuality,
      firstName: f.first.trim() || undefined,
      lastName: f.last.trim() || undefined,
      familyStatus: f.status === 'random' ? undefined : f.status,
      familyHealth: f.health === 'random' ? undefined : f.health,
      religionId: f.religion === 'random' || !religions.some((r) => r.id === f.religion) ? undefined : f.religion,
      siblings: f.siblings === 'random' ? undefined : f.siblings,
      traits: f.traits.length ? f.traits : undefined,
      settings: { dementiaPath: f.dementia, matureThemes: f.mature },
    });
    onStart(s);
  };

  const touch = (patch: Partial<Form>) => {
    setScenario('custom');
    set(patch);
  };

  return (
    <div className="setup">
      <div className="app-header">
        <button className="back" onClick={onBack}>
          <ChevronLeft size={22} /> Lock
        </button>
        <div className="app-header-title">
          <h1>New life</h1>
        </div>
      </div>
      <div className="app-body">
        <h3 className="group-title">Quick start</h3>
        <div className="scenarios">
          {SCENARIOS.map((sc) => (
            <button key={sc.id} className={`scenario ${scenario === sc.id ? 'on' : ''}`} onClick={() => applyScenario(sc)} title={sc.desc}>
              <AppIcon app={sc} size={44} />
              <span className="scenario-name">{sc.name}</span>
            </button>
          ))}
        </div>
        <p className="tiny muted scenario-desc">{SCENARIOS.find((s) => s.id === scenario)?.desc ?? 'Custom life.'}</p>

        <h3 className="group-title">When</h3>
        <div className="group">
          <div className="chips">
            {ERA_CHIPS.map((p) => (
              <button key={p.year} className={`chip ${p.year === f.year ? 'on' : ''}`} onClick={() => touch({ year: p.year })}>
                {p.label}
              </button>
            ))}
          </div>
          <Row label="Birth year">
            <input type="number" value={f.year} min={-800} max={2200} onChange={(e) => touch({ year: Math.max(-800, Math.min(2200, Number(e.target.value) || 0)) })} aria-label="Birth year" />
          </Row>
          <p className="tiny muted set-note">
            {era.name}. Careers: {era.careerGates}.
          </p>
        </div>

        <h3 className="group-title">Where</h3>
        <div className="group">
          <Row label="Country">
            <select value={f.country} onChange={(e) => touch({ country: e.target.value })} aria-label="Country">
              <option value="random">Random</option>
              {countries.map((c) => (
                <option key={c.id} value={c.id}>
                  {countryName(c.id, f.year)}
                </option>
              ))}
            </select>
          </Row>
        </div>

        <h3 className="group-title">Who</h3>
        <div className="group">
          <div className="set-block">
            <span className="set-label">Gender</span>
            <Seg label="Gender" value={f.gender} onChange={(v) => touch({ gender: v })} options={[['random', 'Random'], ['female', 'Female'], ['male', 'Male'], ['nonbinary', 'Nonbinary']]} />
          </div>
          <div className="set-block">
            <span className="set-label">Sexuality</span>
            <Seg label="Sexuality" value={f.sexuality} onChange={(v) => touch({ sexuality: v })} options={[['random', 'Random'], ['straight', 'Straight'], ['gay', 'Gay'], ['bisexual', 'Bi'], ['asexual', 'Ace']]} />
          </div>
          <Row label="First name">
            <input placeholder="Random" value={f.first} onChange={(e) => touch({ first: e.target.value })} aria-label="First name" />
          </Row>
          <Row label="Family name">
            <input placeholder="Random" value={f.last} onChange={(e) => touch({ last: e.target.value })} aria-label="Family name" />
          </Row>
        </div>

        <h3 className="group-title">Family</h3>
        <div className="group">
          <Row label="Wealth">
            <select value={f.status} onChange={(e) => touch({ status: e.target.value as Form['status'] })} aria-label="Family wealth">
              <option value="random">Random</option>
              {(['destitute', 'poor', 'working', 'middle', 'wealthy', 'aristocracy', 'royalty'] as const).map((v) => (
                <option key={v} value={v}>
                  {v[0].toUpperCase() + v.slice(1)}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Home life">
            <select value={f.health} onChange={(e) => touch({ health: e.target.value as Form['health'] })} aria-label="Home life">
              <option value="random">Random</option>
              <option value="loving">Loving</option>
              <option value="overprotective">Overprotective</option>
              <option value="absent">Absent parents</option>
              <option value="neglectful">Neglectful</option>
              <option value="alcoholic">Alcoholic parent</option>
              <option value="abusive">Abusive</option>
            </select>
          </Row>
          <Row label="Faith">
            <select value={f.religion} onChange={(e) => touch({ religion: e.target.value })} aria-label="Family faith">
              <option value="random">Typical for the country</option>
              {religions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </Row>
          <div className="set-block">
            <span className="set-label">Siblings</span>
            <Seg label="Siblings" value={f.siblings} onChange={(v) => touch({ siblings: v })} options={[['random', 'Random'], ['none', 'None'], ['few', 'A few'], ['many', 'Many']]} />
          </div>
        </div>

        <h3 className="group-title">Personality · pick up to 3</h3>
        <div className="group">
          <div className="chips">
            {TRAITS.map((t) => (
              <button key={t.id} className={`chip ${f.traits.includes(t.id) ? 'on' : ''}`} onClick={() => toggleTrait(t.id)} title={t.desc} disabled={!f.traits.includes(t.id) && f.traits.length >= 3}>
                {f.traits.includes(t.id) && <Check size={13} />} {t.name}
              </button>
            ))}
          </div>
          <p className="tiny muted set-note">{f.traits.length ? f.traits.map((id) => TRAITS.find((t) => t.id === id)?.desc).join(' ') : 'No picks: you may be born with a random trait.'}</p>
        </div>

        <h3 className="group-title">Options</h3>
        <div className="group">
          <label className="setting">
            <span className="setting-label">Dementia path in old age</span>
            <input type="checkbox" className="switch" checked={f.dementia} onChange={(e) => set({ dementia: e.target.checked })} />
          </label>
          <label className="setting">
            <span className="setting-label">Mature themes</span>
            <input type="checkbox" className="switch" checked={f.mature} onChange={(e) => set({ mature: e.target.checked })} />
          </label>
          <Row label="Seed">
            <input placeholder="Random" value={f.seed} onChange={(e) => set({ seed: e.target.value })} aria-label="Seed" />
          </Row>
        </div>
        <button className="be-born" onClick={start}>
          Be born
        </button>
      </div>
    </div>
  );
}
