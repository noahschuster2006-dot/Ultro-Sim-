import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Sparkles } from 'lucide-react';
import { ACTIONS, ageUp, choose, continueAs, Ctx, currentEvent, performAction, type GameState } from '../engine';
import type { Stats } from '../engine/data/stats';
import { clearSave, downloadSave, loadGame, recordDynasty, saveGame } from './storage';
import type { Api } from './components';
import { look, playerSpec } from './art/Avatar';
import { ACTION_CAT_ICON, ACTION_ICON, EVENT_CAT_ICON } from './art/icons';
import { music } from './audio/music';
import { sfx } from './audio/sfx';
import { moodFor, playScene, playYear } from './fx';
import { usePrefs } from './prefs';
import { sceneBus } from './scene/bus';
import { sceneForAction, sceneForEvent, sceneForOutcome } from './scene/classify';
import type { SceneId } from './scene/ids';
import { Stage } from './scene/Stage';
import { APP_BY_ID, type AppId } from './phone/apps';
import { HomeScreen } from './phone/HomeScreen';
import { Memorial } from './phone/Memorial';
import { AppHeader, Banner, ControlBar, EventSheet, NewsTicker } from './phone/Overlays';
import { Phone, StatusBar } from './phone/Phone';
import { HallScreen, LockScreen, NewLifeScreen } from './phone/Setup';
import { wallpaper } from './phone/wallpaper';

type Screen = 'lock' | 'new' | 'hall' | 'game';

interface Note {
  icon: (typeof EVENT_CAT_ICON)[string];
  title: string;
  text: string;
  key: number;
}

/** Phones and small windows: the phone fills the screen and must dip to reveal scenes. */
const SMALL_SCREEN = '(max-width: 560px), (max-height: 520px) and (max-width: 900px)';

function useSmallScreen(): boolean {
  return useSyncExternalStore(
    (fn) => {
      const mq = window.matchMedia(SMALL_SCREEN);
      mq.addEventListener('change', fn);
      return () => mq.removeEventListener('change', fn);
    },
    () => window.matchMedia(SMALL_SCREEN).matches,
    () => false,
  );
}

function useMusicState() {
  return useSyncExternalStore(
    (fn) => music.subscribe(fn),
    () => music.state,
    () => music.state,
  );
}

function saveSummary(s: GameState | null): string | null {
  if (!s) return null;
  const y = s.world.year;
  return `${s.char.firstName} ${s.char.lastName}, age ${s.char.age} · ${y < 0 ? `${-y} BC` : y}${s.phase !== 'alive' ? ' · deceased' : ''}`;
}

const DEFAULT_SKIN = { skin: '#d9a074', shirt: '#2f3b55' };

// Development helper: play any scene from the browser console, e.g. __scene('aliens').
if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __scene: typeof playScene }).__scene = playScene;

export function App() {
  const game = useRef<GameState | null>(null);
  const [saved, setSaved] = useState(() => saveSummary(loadGame()));
  const [screen, setScreen] = useState<Screen>('lock');
  const [app, setApp] = useState<AppId | null>(null);
  const [, setTick] = useState(0);
  const [note, setNote] = useState<Note | null>(null);
  const [news, setNews] = useState<{ headlines: string[]; key: number } | null>(null);
  const [playing, setPlaying] = useState<SceneId | null>(null);
  const prefs = usePrefs();
  const musicState = useMusicState();
  const small = useSmallScreen();
  const prev = useRef<Stats | null>(null);
  const phoneRef = useRef<HTMLDivElement>(null);
  const noteTimer = useRef<number | undefined>(undefined);

  useEffect(() => sceneBus.onPlaying(setPlaying), []);

  // Browsers only allow audio after a user gesture: start the music on the first tap.
  useEffect(() => {
    const once = () => {
      music.unlock();
      if (!music.state.muted) music.play();
      window.removeEventListener('pointerdown', once);
      window.removeEventListener('keydown', once);
    };
    window.addEventListener('pointerdown', once);
    window.addEventListener('keydown', once);
    return () => {
      window.removeEventListener('pointerdown', once);
      window.removeEventListener('keydown', once);
    };
  }, []);

  useEffect(() => () => window.clearTimeout(noteTimer.current), []);

  const refresh = useCallback(() => {
    const s = game.current;
    if (s) {
      saveGame(s);
      if (s.phase !== 'alive') recordDynasty(s);
      music.setMood(moodFor(s));
    }
    setTick((t) => t + 1);
  }, []);

  const notify = useCallback((icon: Note['icon'], title: string, text: string) => {
    setNote({ icon, title, text, key: Date.now() });
    window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => setNote(null), 4200);
  }, []);

  const goHome = useCallback(() => {
    setApp((a) => {
      if (a) sfx.play('back');
      return null;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') goHome();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goHome]);

  const startLife = (s: GameState) => {
    game.current = s;
    prev.current = null;
    setApp(null);
    setScreen('game');
    sfx.play('birth');
    playScene('birth', `born:${s.char.id}`);
    refresh();
  };

  const resume = () => {
    const s = loadGame();
    if (!s) {
      setSaved(null);
      return;
    }
    game.current = s;
    prev.current = null;
    setApp(null);
    setScreen('game');
    sfx.play('open');
    refresh();
  };

  const leaveLife = (s: GameState) => {
    recordDynasty(s);
    clearSave();
    setSaved(null);
    game.current = null;
    setApp(null);
    setScreen('lock');
    sfx.play('lock');
  };

  const openApp = (id: AppId) => {
    sfx.play('open');
    setApp(id);
  };

  const s = game.current;

  const api: Api = {
    act: (id, arg, amount) => {
      if (!s) return;
      const r = performAction(s, id, arg, amount);
      const def = ACTIONS.find((a) => a.id === id);
      const current = app ? APP_BY_ID[app] : null;
      const icon = { icon: ACTION_ICON[id] ?? (def ? ACTION_CAT_ICON[def.cat] : undefined) ?? Sparkles, from: current?.from ?? '#9fb3c8', to: current?.to ?? '#52627a' };
      const label = def ? (typeof def.label === 'string' ? def.label : def.label(new Ctx(s), arg)) : 'LifeSim';
      if (r.text) notify(icon, label, r.text);
      if (r.ok) {
        playScene(sceneForAction(id, arg, r.text ?? '', r.scene, def?.cat), `act:${id}:${Date.now()}`);
      } else sfx.play('bad');
      refresh();
    },
  };

  const onAgeUp = () => {
    if (!s) return;
    prev.current = { ...s.char.stats };
    const before = s.char.log.length;
    const r = ageUp(s);
    if (!r.ok) {
      if (r.reason) notify(EVENT_CAT_ICON.adult, 'Not yet', r.reason);
      sfx.play('bad');
      refresh();
      return;
    }
    sfx.play('ageUp');
    setApp(null);
    const ev = s.phase === 'alive' ? currentEvent(s) : null;
    const fresh = s.char.log.slice(before);
    playYear(s, fresh, !!ev);
    // World news is only logged when it hits the home country (or the whole world): run it as breaking news.
    const headlines = fresh.filter((e) => e.tone === 'world').map((e) => e.text.replace(/^🌍\s*/, ''));
    if (headlines.length) {
      setNews({ headlines, key: Date.now() });
      sfx.play('sting');
    }
    refresh();
  };

  const ev = s && screen === 'game' && s.phase === 'alive' ? currentEvent(s) : null;

  // Every event that reaches the screen gets its scene once.
  useEffect(() => {
    if (!ev) return;
    playScene(sceneForEvent(ev.eventId, ev.cat, ev.title, ev.text, ev.scene), `ev:${ev.uid}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ev?.uid]);

  const onChoose = (index: number) => {
    if (!s || !ev) return;
    const res = choose(s, ev.uid, index);
    sfx.play('tap');
    if (res?.outcome) notify(EVENT_CAT_ICON[ev.cat] ?? EVENT_CAT_ICON.world, res.title || 'Outcome', res.outcome);
    const sc = sceneForOutcome(ev.eventId, res?.choice ?? '', res?.outcome ?? '', res?.scene);
    if (sc) playScene(sc, `out:${ev.uid}`);
    if (s.phase !== 'alive') playScene('funeral', `death:${s.char.id}`);
    refresh();
  };

  const onMenuAction = (a: 'download' | 'abandon') => {
    if (!s) return;
    if (a === 'download') downloadSave(s);
    else if (window.confirm('Abandon this life and return to the lock screen? Your save will be deleted.')) leaveLife(s);
  };

  const colors = useMemo(() => (s ? look(playerSpec(s)) : DEFAULT_SKIN), [s, s?.char.id, s?.char.age, !!s?.char.legal.prison]);

  const env = s
    ? {
        year: s.world.year,
        night: (() => {
          const h = new Date().getHours();
          return h >= 19 || h < 6;
        })(),
        prison: !!s.char.legal.prison,
        mood: s.char.stats.happiness / 100,
        wealth: Math.max(0, Math.min(1, Math.log10(Math.max(1, s.char.money)) / 7)),
      }
    : { year: 2026, night: true, prison: false, mood: 0.6, wealth: 0.4 };

  const dip = !!playing && prefs.scenes && prefs.dipPhone && screen === 'game';
  const alive = !!s && s.phase === 'alive';
  const openDef = app ? APP_BY_ID[app] : null;

  let content: React.ReactNode;
  if (screen === 'lock' || (screen === 'game' && !s)) {
    content = <LockScreen saveName={saved} onResume={resume} onNew={() => setScreen('new')} onHall={() => setScreen('hall')} />;
  } else if (screen === 'new') {
    content = <NewLifeScreen onStart={startLife} onBack={() => setScreen('lock')} />;
  } else if (screen === 'hall') {
    content = <HallScreen onBack={() => setScreen('lock')} />;
  } else if (s && !alive) {
    content = (
      <Memorial
        s={s}
        onContinue={(id) => {
          continueAs(s, id);
          prev.current = null;
          setApp(null);
          playScene('family', `heir:${id}`);
          refresh();
        }}
        onNewLife={() => leaveLife(s)}
      />
    );
  } else if (s && openDef) {
    content = (
      <div className="app-view" key={openDef.id}>
        <AppHeader app={openDef} onBack={goHome} />
        <div className="app-body">{openDef.render({ s, api, prev: prev.current, onMenuAction })}</div>
      </div>
    );
  } else if (s) {
    content = <HomeScreen s={s} onOpen={openApp} />;
  }

  const onWallpaper = screen === 'lock' || (screen === 'game' && !!s && alive && !openDef);

  return (
    <div className={`game-world ${playing ? 'scene-on' : ''} ${prefs.reducedMotion ? 'calm' : ''}`}>
      <Stage env={env} phoneEl={phoneRef} />
      <div className="vignette" aria-hidden />
      <Phone
        ref={phoneRef}
        dip={dip}
        skin={colors.skin}
        sleeve={colors.shirt}
        overlay={
          <>
            {ev && <EventSheet ev={ev} s={s!} queued={s!.queue.length} onChoose={onChoose} />}
            {/* Held back while the phone is lowered for a scene, so the headline is never missed. */}
            {news && screen === 'game' && alive && !dip && <NewsTicker key={news.key} headlines={news.headlines} onDone={() => setNews(null)} />}
            {note && <Banner key={note.key} app={note.icon} title={note.title} text={note.text} onClose={() => setNote(null)} />}
            {dip && small && (
              <button className="dip-catch" onClick={() => sceneBus.skip()} aria-label="Skip animation">
                Tap to pick up your phone
              </button>
            )}
          </>
        }
      >
        <div className={`screen-bg ${onWallpaper ? '' : 'plain'}`} style={onWallpaper ? { background: wallpaper(screen === 'game' ? s : null) } : undefined} />
        <StatusBar year={screen === 'game' && s ? s.world.year : null} health={screen === 'game' && alive ? s!.char.stats.health : null} musicOn={musicState.playing && !musicState.muted} light={onWallpaper} />
        <div className="screen-content">{content}</div>
        {screen === 'game' && alive && <ControlBar s={s!} onHome={goHome} onAgeUp={onAgeUp} atHome={!openDef} />}
        <button className="home-indicator" onClick={goHome} aria-label="Home" />
      </Phone>
    </div>
  );
}
