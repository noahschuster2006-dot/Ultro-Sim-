import { Ctx, type GameState, type LogEntry } from '../engine';
import { music, type Mood } from './audio/music';
import { sfx, type Sfx } from './audio/sfx';
import { sceneBus } from './scene/bus';
import { sceneForLog } from './scene/classify';
import type { SceneId } from './scene/ids';

/** The sound that accompanies each scene. */
const SCENE_SFX: Partial<Record<SceneId, Sfx>> = {
  aliens: 'alien',
  ufo: 'alien',
  war: 'explosion',
  explosion: 'explosion',
  quake: 'explosion',
  fire: 'sting',
  storm: 'sting',
  flood: 'sting',
  plague: 'dark',
  hospital: 'bad',
  police: 'siren',
  prison: 'lock',
  court: 'sting',
  escape: 'sting',
  crime: 'sting',
  fight: 'bad',
  riot: 'sting',
  election: 'cheer',
  scandal: 'sting',
  moneyUp: 'cash',
  moneyDown: 'bad',
  casino: 'cash',
  hacker: 'notify',
  rocket: 'cheer',
  robots: 'dark',
  funeral: 'death',
  birth: 'birth',
  love: 'heart',
  wedding: 'bell',
  heartbreak: 'bad',
  friends: 'good',
  party: 'cheer',
  family: 'good',
  graduation: 'cheer',
  promotion: 'good',
  fired: 'bad',
  sports: 'cheer',
  study: 'good',
  holy: 'magic',
  demonic: 'dark',
  ghost: 'dark',
  curse: 'dark',
  ritual: 'dark',
  travel: 'good',
  drugs: 'magic',
  calm: 'magic',
  birthday: 'ageUp',
  fireworks: 'cheer',
  fame: 'cheer',
  coronation: 'bell',
  pet: 'good',
  house: 'cash',
  car: 'good',
};

/** Rough drama ranking used to pick which of several things that happened gets shown. */
const DRAMA: Partial<Record<SceneId, number>> = {
  aliens: 100,
  ufo: 80,
  war: 90,
  explosion: 88,
  quake: 86,
  plague: 84,
  flood: 82,
  storm: 80,
  fire: 80,
  riot: 78,
  funeral: 76,
  coronation: 74,
  police: 72,
  prison: 70,
  court: 66,
  escape: 66,
  birth: 64,
  wedding: 64,
  moneyDown: 62,
  moneyUp: 60,
  rocket: 60,
  robots: 58,
  election: 56,
  scandal: 54,
  fireworks: 52,
  heartbreak: 50,
  demonic: 50,
  ghost: 48,
  holy: 46,
  fame: 46,
  graduation: 44,
  promotion: 42,
  fired: 42,
};

/** Play a scene with its sound. `key` makes it play only once (e.g. per event uid). */
export function playScene(id: SceneId | null | undefined, key?: string): void {
  if (!id) return;
  const before = sceneBus.playing;
  sceneBus.play(id, key);
  if (before !== id) {
    const s = SCENE_SFX[id];
    if (s) sfx.play(s);
    if ((DRAMA[id] ?? 0) >= 70) music.duck(2.5);
  }
}

/** After an age-up, pick the most dramatic one or two things the year brought and show them. */
export function playYear(s: GameState, newEntries: LogEntry[], hasEvent: boolean): void {
  if (!s.char.alive || s.phase !== 'alive') {
    playScene('funeral', `death:${s.char.id}`);
    return;
  }
  const picks: { id: SceneId; score: number }[] = [];
  for (const e of newEntries) {
    if (e.tone !== 'world' && e.tone !== 'major' && e.tone !== 'bad' && e.tone !== 'good') continue;
    const id = sceneForLog(e.text);
    if (!id) continue;
    const base = DRAMA[id] ?? 30;
    const score = base + (e.tone === 'world' ? 5 : e.tone === 'major' ? 8 : 0);
    if (!picks.some((p) => p.id === id)) picks.push({ id, score });
  }
  picks.sort((a, b) => b.score - a.score);
  const limit = hasEvent ? 1 : 2;
  const chosen = picks.filter((p) => p.score >= 40 || !hasEvent).slice(0, limit);
  for (const p of chosen) playScene(p.id, `year:${s.char.id}:${s.char.age}:${p.id}`);
  if (!chosen.length && !hasEvent && [1, 5, 10, 13, 16, 18, 21, 30, 40, 50, 60, 65, 70, 75, 80, 90, 100].includes(s.char.age)) {
    playScene('birthday', `bday:${s.char.id}:${s.char.age}`);
  }
}

/** Background-music mood for the current state of the life. */
export function moodFor(s: GameState): Mood {
  if (s.phase !== 'alive') return 'sad';
  const c = s.char;
  const x = new Ctx(s);
  if (c.spiritual.pacts.length || c.spiritual.curses.length >= 2) return 'mystic';
  if (c.legal.prison || c.stats.heat > 70 || c.stats.evidence > 60) return 'tense';
  if (x.w && (x.w.war === 'major' || x.w.war === 'world')) return 'epic';
  if (c.stats.depression > 60 || c.stats.happiness < 30) return 'sad';
  if (c.politics.office || c.stats.fame > 70) return 'epic';
  if (c.stats.happiness > 62) return 'upbeat';
  return 'calm';
}
