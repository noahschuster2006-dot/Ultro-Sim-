import type { GameState } from '../../engine';
import { eraLook } from '../scene/kit';

const ERA_WALL: Record<string, [string, string, string]> = {
  ancient: ['#f4b26b', '#c2553a', '#4a1f3d'],
  medieval: ['#7aa37a', '#2f5d50', '#1b2433'],
  early: ['#e7c48d', '#9c5b3c', '#2c1e2f'],
  industrial: ['#b7c4cf', '#56708a', '#232b3a'],
  modern: ['#7f7fff', '#c055d6', '#1f1846'],
  future: ['#36e0e0', '#5a3bdc', '#0c0b2a'],
};

/** Home-screen wallpaper: era colours, greyed in prison, dimmer when the character is unhappy. */
export function wallpaper(s: GameState | null): string {
  if (!s) return 'radial-gradient(120% 80% at 20% 10%, #ff9a8b 0%, transparent 55%), radial-gradient(120% 80% at 90% 30%, #7f7fff 0%, transparent 55%), linear-gradient(160deg, #2b1f5c, #0d0b22)';
  if (s.char.legal.prison) return 'radial-gradient(120% 70% at 50% 0%, #6c7380 0%, transparent 60%), linear-gradient(170deg, #3d424c, #15171c)';
  const [a, b, c] = ERA_WALL[eraLook(s.world.year)];
  const sad = s.char.stats.happiness < 35;
  const dim = sad ? 'linear-gradient(rgba(10,12,20,0.35), rgba(10,12,20,0.35)), ' : '';
  return `${dim}radial-gradient(110% 70% at 15% 5%, ${a} 0%, transparent 60%), radial-gradient(120% 80% at 95% 35%, ${b} 0%, transparent 60%), linear-gradient(165deg, ${b}, ${c})`;
}
