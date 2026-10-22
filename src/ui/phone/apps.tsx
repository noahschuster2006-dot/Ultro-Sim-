import type { LucideIcon } from 'lucide-react';
import { BookOpen, Briefcase, Castle, ChartColumn, Heart, HeartPulse, Music, Newspaper, PawPrint, Settings, ShoppingBag, Sparkles, Star, Target, Ticket, Users, VenetianMask, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';
import type { GameState } from '../../engine';
import type { Stats } from '../../engine/data/stats';
import type { Api } from '../components';
import { LifePanel } from '../panels/LifePanel';
import { StatsPanel } from '../panels/StatsPanel';
import { BodyMindPanel } from '../panels/BodyMindPanel';
import { PeoplePanel } from '../panels/PeoplePanel';
import { CareerPanel } from '../panels/CareerPanel';
import { SkillsPanel } from '../panels/SkillsPanel';
import { MoneyPanel } from '../panels/MoneyPanel';
import { CrimePanel } from '../panels/CrimePanel';
import { PowerPanel } from '../panels/PowerPanel';
import { SpiritPanel } from '../panels/SpiritPanel';
import { WorldPanel } from '../panels/WorldPanel';
import { DynastyPanel } from '../panels/DynastyPanel';
import { LovePanel } from '../panels/LovePanel';
import { GoingOutPanel } from '../panels/GoingOutPanel';
import { ShopPanel } from '../panels/ShopPanel';
import { PetsPanel } from '../panels/PetsPanel';
import { MusicApp } from './MusicApp';
import { SettingsApp } from './SettingsApp';

export type AppId = 'life' | 'stats' | 'body' | 'people' | 'love' | 'career' | 'skills' | 'money' | 'shop' | 'pets' | 'goingOut' | 'crime' | 'power' | 'spirit' | 'world' | 'dynasty' | 'music' | 'settings';

export interface AppCtx {
  s: GameState;
  api: Api;
  prev: Stats | null;
  onMenuAction: (a: 'download' | 'abandon') => void;
}

export interface AppDef {
  id: AppId;
  name: string;
  /** Longer title shown in the app's header. */
  title: string;
  icon: LucideIcon;
  from: string;
  to: string;
  render: (c: AppCtx) => ReactNode;
  /** Red badge: a number, or true for a dot. */
  badge?: (s: GameState) => number | boolean;
}

function thisYear(s: GameState, tone?: string): number {
  return s.char.log.filter((e) => e.age === s.char.age && (!tone || e.tone === tone)).length;
}

export const APPS: AppDef[] = [
  { id: 'life', name: 'Journal', title: 'Life story', icon: BookOpen, from: '#ffcf70', to: '#ff8a3d', render: ({ s }) => <LifePanel s={s} />, badge: (s) => thisYear(s) },
  { id: 'people', name: 'People', title: 'People', icon: Users, from: '#6fe3a1', to: '#1fae68', render: ({ s, api }) => <PeoplePanel s={s} api={api} /> },
  { id: 'love', name: 'Love', title: 'Love', icon: Heart, from: '#ff9ec4', to: '#e8336d', render: ({ s, api }) => <LovePanel s={s} api={api} />, badge: (s) => s.char.relationships.some((r) => r.type === 'affair' && (r.meta.suspicion as number) > 50) },
  { id: 'goingOut', name: 'Going Out', title: 'Going out', icon: Ticket, from: '#ffe08a', to: '#e8a317', render: ({ s, api }) => <GoingOutPanel s={s} api={api} /> },
  { id: 'shop', name: 'Shop', title: 'Shop', icon: ShoppingBag, from: '#d9c3ff', to: '#7c4ddb', render: ({ s, api }) => <ShopPanel s={s} api={api} /> },
  { id: 'pets', name: 'Pets', title: 'Pets', icon: PawPrint, from: '#c9e7a4', to: '#5a9e2f', render: ({ s, api }) => <PetsPanel s={s} api={api} />, badge: (s) => s.char.pets.some((p) => p.alive && p.health < 30) },
  { id: 'career', name: 'Work', title: 'Career & school', icon: Briefcase, from: '#8fb2ff', to: '#3d63e6', render: ({ s, api }) => <CareerPanel s={s} api={api} /> },
  { id: 'money', name: 'Bank', title: 'Money & assets', icon: Wallet, from: '#7ee8d0', to: '#139a83', render: ({ s, api }) => <MoneyPanel s={s} api={api} />, badge: (s) => s.char.money < 0 || s.char.debt > Math.max(1, s.char.money) * 2 },
  { id: 'stats', name: 'Stats', title: 'All 47 stats', icon: ChartColumn, from: '#c3a6ff', to: '#7d52f0', render: ({ s, prev }) => <StatsPanel s={s} prev={prev} /> },
  { id: 'body', name: 'Health', title: 'Body & mind', icon: HeartPulse, from: '#ff9aa8', to: '#ec3b5a', render: ({ s, api }) => <BodyMindPanel s={s} api={api} />, badge: (s) => s.char.stats.health < 30 || s.char.bio.chronic.some((c) => !c.managed) },
  { id: 'skills', name: 'Skills', title: 'Skill tree', icon: Target, from: '#ffd36b', to: '#e8a317', render: ({ s, api }) => <SkillsPanel s={s} api={api} /> },
  { id: 'crime', name: 'Shady', title: 'Crime & law', icon: VenetianMask, from: '#7c8299', to: '#2b2f3d', render: ({ s, api }) => <CrimePanel s={s} api={api} />, badge: (s) => !!s.char.legal.prison || s.char.stats.evidence > 60 },
  { id: 'power', name: 'Fame', title: 'Fame & power', icon: Star, from: '#ffb3e1', to: '#e0459b', render: ({ s, api }) => <PowerPanel s={s} api={api} /> },
  { id: 'spirit', name: 'Spirit', title: 'Spirit & the unseen', icon: Sparkles, from: '#b9a0ff', to: '#4a2a9e', render: ({ s, api }) => <SpiritPanel s={s} api={api} /> },
  { id: 'world', name: 'News', title: 'The world', icon: Newspaper, from: '#9fdcff', to: '#2386d6', render: ({ s }) => <WorldPanel s={s} />, badge: (s) => thisYear(s, 'world') },
  { id: 'dynasty', name: 'Dynasty', title: 'Dynasty', icon: Castle, from: '#f6d77a', to: '#b8861b', render: ({ s, api }) => <DynastyPanel s={s} api={api} /> },
  { id: 'music', name: 'Music', title: 'Music', icon: Music, from: '#ff8fa3', to: '#f0324f', render: () => <MusicApp /> },
  { id: 'settings', name: 'Settings', title: 'Settings', icon: Settings, from: '#c9ced9', to: '#7b8394', render: ({ s, onMenuAction }) => <SettingsApp s={s} onMenuAction={onMenuAction} /> },
];

export const APP_BY_ID = Object.fromEntries(APPS.map((a) => [a.id, a])) as Record<AppId, AppDef>;

/** Apps pinned to the dock at the bottom of the home screen. */
export const DOCK: AppId[] = ['life', 'people', 'love', 'money'];

export function AppIcon({ app, size = 56, badge }: { app: Pick<AppDef, 'icon' | 'from' | 'to'>; size?: number; badge?: number | boolean }) {
  const Icon = app.icon;
  return (
    <span className="app-icon" style={{ width: size, height: size, background: `linear-gradient(145deg, ${app.from}, ${app.to})` }}>
      <Icon size={size * 0.5} strokeWidth={2.1} color="#fff" aria-hidden />
      {badge ? <span className="badge">{typeof badge === 'number' ? (badge > 99 ? '99+' : badge) : ''}</span> : null}
    </span>
  );
}
