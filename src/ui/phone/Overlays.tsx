import { ChevronLeft, LayoutGrid } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import type { EventView, GameState } from '../../engine';
import { Avatar, npcSpec } from '../art/Avatar';
import { PetAvatar } from '../art/PetAvatar';
import { PET_BY_ID } from '../../engine/data/pets';
import { EVENT_CAT_ICON } from '../art/icons';
import { relationshipLabel } from '../../engine/systems/relationships';
import { AppIcon, type AppDef } from './apps';
import { yearLabel } from './Phone';

const CAT_LABEL: Record<string, string> = {
  romance: 'Love',
  family: 'Family',
  school: 'School',
  work: 'Work',
  leisure: 'Free time',
  pets: 'Pets',
  possessions: 'Your things',
  travel: 'Travel',
  era: 'Daily life',
  birth: 'Birth',
  childhood: 'Childhood',
  teen: 'Teen years',
  youngAdult: 'Young adult',
  adult: 'Adult life',
  midlife: 'Midlife',
  senior: 'Later life',
  elder: 'Old age',
  career: 'Work',
  crime: 'Underworld',
  legal: 'Law',
  relationship: 'Relationships',
  health: 'Health',
  mental: 'Mind',
  spiritual: 'Spirit',
  media: 'Media',
  politics: 'Politics',
  world: 'World news',
  assets: 'Property',
  dynasty: 'Dynasty',
  secret: 'Secret',
  chain: 'Story',
};

/** An event, presented as an alert that slides up over the phone screen. */
export function EventSheet({ ev, s, queued, onChoose }: { ev: EventView; s: GameState; queued: number; onChoose: (index: number) => void }) {
  const tone = EVENT_CAT_ICON[ev.chain ? 'chain' : ev.cat] ?? EVENT_CAT_ICON.world;
  const npc = ev.npcId ? s.npcs[ev.npcId] : undefined;
  const rel = npc ? s.char.relationships.find((r) => r.npcId === npc.id) : undefined;
  const pet = ev.petId ? s.char.pets.find((p) => p.id === ev.petId) : undefined;
  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-labelledby="event-title">
      <div className="sheet" key={ev.uid}>
        <div className="sheet-head">
          <AppIcon app={tone} size={34} />
          <span className="sheet-cat">
            {CAT_LABEL[ev.cat] ?? ev.cat} · age {s.char.age} · {yearLabel(s.world.year)}
          </span>
          {queued > 1 && <span className="pill">{queued - 1} more</span>}
        </div>
        {ev.chain && <div className="pill accent" style={{ marginBottom: 6 }}>Story: {ev.chain}</div>}
        <h2 id="event-title">{ev.title}</h2>
        {npc && (
          <div className="sheet-person">
            <Avatar a={npcSpec(s, npc, rel?.affinity)} size={44} />
            <div>
              <strong>
                {npc.firstName} {npc.lastName}
              </strong>
              <div className="tiny muted">{rel ? relationshipLabel(rel) : 'someone you know'}</div>
            </div>
          </div>
        )}
        {pet && (
          <div className="sheet-person">
            <PetAvatar pet={pet} size={44} />
            <div>
              <strong>{pet.name}</strong>
              <div className="tiny muted">your {pet.breed} ({PET_BY_ID[pet.species]?.name.toLowerCase() ?? pet.species})</div>
            </div>
          </div>
        )}
        <p className="sheet-text">{ev.text}</p>
        {ev.distortions.map((d) => (
          <p key={d} className="distortion">
            {d}
          </p>
        ))}
        <div className="sheet-choices">
          {ev.choices.map((c) => (
            <button key={c.index} className="sheet-choice" onClick={() => onChoose(c.index)}>
              <span>{c.label}</span>
              {c.hint && <span className="tiny muted">{c.hint}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** A push-notification banner at the top of the screen. */
export function Banner({ app, title, text, onClose }: { app: Pick<AppDef, 'icon' | 'from' | 'to'>; title: string; text: string; onClose: () => void }) {
  return (
    <div className="banner" role="status" onClick={onClose}>
      <AppIcon app={app} size={34} />
      <div className="banner-body">
        <div className="banner-top">
          <strong>{title}</strong>
          <span className="tiny muted">now</span>
        </div>
        <div className="banner-text">{text}</div>
      </div>
    </div>
  );
}

/** Header of an open app with a back button. */
export function AppHeader({ app, onBack, right }: { app: AppDef; onBack: () => void; right?: ReactNode }) {
  return (
    <div className="app-header">
      <button className="back" onClick={onBack} aria-label="Back to home screen">
        <ChevronLeft size={22} /> Home
      </button>
      <div className="app-header-title">
        <AppIcon app={app} size={28} />
        <h1>{app.title}</h1>
      </div>
      {right}
    </div>
  );
}

/** The bar along the bottom of the screen: home, age up, and remaining actions. */
export function ControlBar({ s, onHome, onAgeUp, atHome }: { s: GameState; onHome: () => void; onAgeUp: () => void; atHome: boolean }) {
  const c = s.char;
  return (
    <div className="control-bar">
      <button className="ctl-home" onClick={onHome} aria-label="Home screen" disabled={atHome}>
        <LayoutGrid size={20} />
      </button>
      <button className="age-up" onClick={onAgeUp} disabled={!!s.queue.length}>
        <span className="age-up-main">Age up → {c.age + 1}</span>
        <span className="age-up-sub">{c.ap > 0 ? `${c.ap} action${c.ap > 1 ? 's' : ''} left this year` : 'No actions left'}</span>
      </button>
      <span className="ap-dots" title="Actions left this year" aria-label={`${c.ap} of ${c.apMax} actions left`}>
        {Array.from({ length: c.apMax }, (_, i) => (
          <i key={i} className={i < c.ap ? '' : 'used'} />
        ))}
      </span>
    </div>
  );
}

/** A news-broadcast ticker that slides across the bottom of the phone when big news breaks at home. */
export function NewsTicker({ headlines, onDone }: { headlines: string[]; onDone: () => void }) {
  const text = headlines.join('   •   ');
  // Long headlines scroll for longer, so every word gets read.
  const secs = Math.max(7, Math.min(22, 4 + text.length / 11));
  return (
    <div className="news-ticker" role="status" aria-live="polite" style={{ '--ticker-secs': `${secs}s` } as CSSProperties} onAnimationEnd={(e) => e.animationName === 'tickerOut' && onDone()} onClick={onDone}>
      <span className="news-label">
        <span className="news-dot" aria-hidden />
        BREAKING NEWS
      </span>
      <span className="news-track">
        <span className="news-text">{text}</span>
      </span>
    </div>
  );
}
