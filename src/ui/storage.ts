import { deserialize, serialize, type GameState } from '../engine';

const SAVE_KEY = 'lifesim-ultra:save';
const HALL_KEY = 'lifesim-ultra:hall';

export interface HallEntry {
  dynasty: string;
  generations: number;
  prestige: number;
  founded: number;
  ended: number;
  wealth: number;
  legends: number;
}

export function saveGame(s: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, serialize(s));
  } catch {
    /* storage may be full or blocked */
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? deserialize(raw) : null;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

export function loadHall(): HallEntry[] {
  try {
    const raw = localStorage.getItem(HALL_KEY);
    return raw ? (JSON.parse(raw) as HallEntry[]) : [];
  } catch {
    return [];
  }
}

/** Record or update a dynasty in the local Hall of Dynasties leaderboard. */
export function recordDynasty(s: GameState): void {
  try {
    const hall = loadHall().filter((h) => !(h.dynasty === s.dynasty.name && h.founded === s.dynasty.foundedYear));
    hall.push({
      dynasty: s.dynasty.name,
      generations: s.dynasty.members.length,
      prestige: s.dynasty.prestige,
      founded: s.dynasty.foundedYear,
      ended: s.world.year,
      wealth: s.dynasty.totalWealth,
      legends: s.dynasty.members.filter((m) => m.legendary).length,
    });
    hall.sort((a, b) => b.prestige - a.prestige);
    localStorage.setItem(HALL_KEY, JSON.stringify(hall.slice(0, 25)));
  } catch {
    /* ignore */
  }
}

export function downloadSave(s: GameState): void {
  const blob = new Blob([serialize(s)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lifesim-${s.dynasty.name}-${s.world.year}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
