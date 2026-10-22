import { memo, type ReactNode } from 'react';
import type { Pet } from '../../engine';

/** Darken or lighten a hex colour by a factor (−1..1). */
function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)));
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

const Eyes = ({ y = 30, dx = 7, r = 2.6, dead = false }: { y?: number; dx?: number; r?: number; dead?: boolean }) =>
  dead ? (
    <g stroke="#2a1f1c" strokeWidth={1.6} strokeLinecap="round">
      <path d={`M${32 - dx - 2} ${y - 2} l4 4 m0 -4 l-4 4`} />
      <path d={`M${32 + dx - 2} ${y - 2} l4 4 m0 -4 l-4 4`} />
    </g>
  ) : (
    <g>
      <circle cx={32 - dx} cy={y} r={r} fill="#1f1714" />
      <circle cx={32 + dx} cy={y} r={r} fill="#1f1714" />
      <circle cx={32 - dx + 0.9} cy={y - 0.9} r={r * 0.35} fill="#fff" />
      <circle cx={32 + dx + 0.9} cy={y - 0.9} r={r * 0.35} fill="#fff" />
    </g>
  );

function face(species: string, c: string, dead: boolean): ReactNode {
  const dark = shade(c, -0.35);
  const light = shade(c, 0.45);
  switch (species) {
    case 'dog':
      return (
        <g>
          <ellipse cx={17} cy={30} rx={6} ry={13} fill={dark} transform="rotate(18 17 30)" />
          <ellipse cx={47} cy={30} rx={6} ry={13} fill={dark} transform="rotate(-18 47 30)" />
          <ellipse cx={32} cy={33} rx={15} ry={16} fill={c} />
          <ellipse cx={32} cy={41} rx={9} ry={7} fill={light} />
          <ellipse cx={32} cy={37} rx={3.6} ry={2.6} fill="#2a1f1c" />
          <path d="M32 40 v3 M28 44 q4 3 8 0" stroke="#2a1f1c" strokeWidth={1.4} fill="none" strokeLinecap="round" />
          {!dead && <path d="M30 45 q2 6 4 0 z" fill="#ff7b8a" />}
          <Eyes y={29} dx={7} dead={dead} />
        </g>
      );
    case 'cat':
      return (
        <g>
          <path d="M16 26 L19 9 L29 20 Z M48 26 L45 9 L35 20 Z" fill={c} />
          <path d="M19 22 L20.5 13 L26 19 Z M45 22 L43.5 13 L38 19 Z" fill="#ffb3c1" />
          <ellipse cx={32} cy={34} rx={16} ry={14} fill={c} />
          <path d="M32 37 l-2.5 -2 h5 z" fill="#ff8fa3" />
          <path d="M32 37 v2 M29 41 q3 2 3 -2 q0 4 3 2" stroke="#2a1f1c" strokeWidth={1.2} fill="none" strokeLinecap="round" />
          <g stroke={shade(c, 0.7)} strokeWidth={0.9} strokeLinecap="round">
            <path d="M22 37 h-9 M22 39 l-8 3 M42 37 h9 M42 39 l8 3" />
          </g>
          {dead ? <Eyes y={31} dx={7} dead /> : (
            <g>
              <ellipse cx={25} cy={31} rx={3} ry={3.6} fill="#9be564" />
              <ellipse cx={39} cy={31} rx={3} ry={3.6} fill="#9be564" />
              <ellipse cx={25} cy={31} rx={1} ry={3} fill="#1f1714" />
              <ellipse cx={39} cy={31} rx={1} ry={3} fill="#1f1714" />
            </g>
          )}
        </g>
      );
    case 'horse':
      return (
        <g>
          <path d="M22 14 L25 4 L29 14 Z M42 14 L39 4 L35 14 Z" fill={c} />
          <path d="M20 16 q12 -8 24 0 q4 14 0 30 q-4 12 -12 12 q-8 0 -12 -12 q-4 -16 0 -30 z" fill={c} />
          <path d="M26 10 q6 -6 12 0 q-2 12 -6 22 q-4 -10 -6 -22 z" fill={dark} />
          <ellipse cx={32} cy={50} rx={9} ry={6} fill={light} />
          <ellipse cx={28.5} cy={51} rx={1.5} ry={2} fill="#2a1f1c" />
          <ellipse cx={35.5} cy={51} rx={1.5} ry={2} fill="#2a1f1c" />
          <Eyes y={28} dx={9} dead={dead} />
        </g>
      );
    case 'parrot':
    case 'falcon': {
      const beak = species === 'parrot' ? '#ffd166' : '#3a3a3a';
      return (
        <g>
          <ellipse cx={32} cy={34} rx={15} ry={17} fill={c} />
          {species === 'parrot' && <path d="M24 16 q8 -10 16 0 q-8 -4 -16 0 z" fill={shade(c, 0.3)} />}
          <ellipse cx={32} cy={42} rx={9} ry={8} fill={species === 'parrot' ? shade(c, 0.5) : light} />
          <path d="M32 32 q8 2 6 10 q-2 -3 -6 -3 z" fill={beak} />
          <path d="M32 32 q-3 4 0 7" fill={shade(beak, -0.3)} />
          <circle cx={24} cy={29} r={5} fill="#fff" />
          <circle cx={40} cy={29} r={5} fill="#fff" />
          <Eyes y={29} dx={8} r={2.4} dead={dead} />
        </g>
      );
    }
    case 'rabbit':
      return (
        <g>
          <ellipse cx={24} cy={14} rx={5} ry={14} fill={c} />
          <ellipse cx={40} cy={14} rx={5} ry={14} fill={c} />
          <ellipse cx={24} cy={14} rx={2.4} ry={10} fill="#ffb3c1" />
          <ellipse cx={40} cy={14} rx={2.4} ry={10} fill="#ffb3c1" />
          <ellipse cx={32} cy={38} rx={15} ry={14} fill={c} />
          <ellipse cx={27} cy={44} rx={5} ry={4} fill={light} />
          <ellipse cx={37} cy={44} rx={5} ry={4} fill={light} />
          <path d="M32 40 l-2 -2 h4 z" fill="#ff8fa3" />
          <rect x={30} y={45} width={4} height={4} rx={1} fill="#fff" />
          <Eyes y={34} dx={7} dead={dead} />
        </g>
      );
    case 'hamster':
      return (
        <g>
          <circle cx={19} cy={22} r={6} fill={c} />
          <circle cx={45} cy={22} r={6} fill={c} />
          <circle cx={19} cy={22} r={3} fill="#ffb3c1" />
          <circle cx={45} cy={22} r={3} fill="#ffb3c1" />
          <ellipse cx={32} cy={36} rx={19} ry={17} fill={c} />
          <ellipse cx={21} cy={41} rx={7} ry={6} fill={light} />
          <ellipse cx={43} cy={41} rx={7} ry={6} fill={light} />
          <circle cx={32} cy={38} r={2} fill="#ff8fa3" />
          <Eyes y={31} dx={8} r={2.4} dead={dead} />
        </g>
      );
    case 'fish':
      return (
        <g>
          <circle cx={20} cy={18} r={2.5} fill="none" stroke="#ffffff" strokeOpacity={0.8} />
          <circle cx={15} cy={26} r={1.6} fill="none" stroke="#ffffff" strokeOpacity={0.8} />
          <path d="M44 32 l12 -10 v20 z" fill={dark} />
          <ellipse cx={30} cy={32} rx={17} ry={12} fill={c} />
          <path d="M28 20 q6 -6 10 2 z" fill={dark} />
          <path d="M34 26 q4 6 0 12" stroke={light} strokeWidth={1.5} fill="none" />
          <circle cx={22} cy={30} r={3} fill="#fff" />
          {dead ? <path d="M20 28 l4 4 m0 -4 l-4 4" stroke="#2a1f1c" strokeWidth={1.4} /> : <circle cx={22} cy={30} r={1.6} fill="#1f1714" />}
          <path d="M14 34 q2 2 4 0" stroke="#2a1f1c" strokeWidth={1.2} fill="none" />
        </g>
      );
    case 'turtle':
      return (
        <g>
          <ellipse cx={32} cy={44} rx={20} ry={11} fill={dark} />
          <ellipse cx={32} cy={42} rx={17} ry={9} fill={c} />
          <path d="M22 42 h20 M32 34 v16 M26 36 l12 12 M38 36 l-12 12" stroke={dark} strokeWidth={1.2} />
          <ellipse cx={32} cy={24} rx={10} ry={9} fill={light} />
          <Eyes y={23} dx={4.5} r={1.8} dead={dead} />
          <path d="M28 28 q4 2 8 0" stroke="#2a1f1c" strokeWidth={1.1} fill="none" />
        </g>
      );
    case 'snake':
    case 'lizard':
      return (
        <g>
          {species === 'snake' ? (
            <path d="M12 52 q10 -10 24 -4 q14 6 16 -8 q2 -12 -12 -12" stroke={c} strokeWidth={9} fill="none" strokeLinecap="round" />
          ) : (
            <g>
              <path d="M10 52 q14 -8 30 -6" stroke={c} strokeWidth={8} fill="none" strokeLinecap="round" />
              <path d="M18 50 l-4 6 M30 47 l-2 7" stroke={dark} strokeWidth={3} strokeLinecap="round" />
            </g>
          )}
          <ellipse cx={36} cy={26} rx={14} ry={10} fill={c} />
          <path d="M26 22 q10 -6 20 0" stroke={dark} strokeWidth={1.5} fill="none" />
          <Eyes y={24} dx={6} r={2.4} dead={dead} />
          {species === 'snake' && !dead && <path d="M48 30 l6 2 l-2 -3 l3 -1 z" fill="#e63946" />}
        </g>
      );
    case 'ferret':
      return (
        <g>
          <circle cx={20} cy={22} r={5} fill={c} />
          <circle cx={44} cy={22} r={5} fill={c} />
          <ellipse cx={32} cy={34} rx={14} ry={15} fill={light} />
          <path d="M19 30 q13 -6 26 0 q-3 6 -13 6 q-10 0 -13 -6 z" fill={dark} />
          <ellipse cx={32} cy={42} rx={6} ry={5} fill={shade(c, 0.6)} />
          <path d="M32 40 l-2 -2 h4 z" fill="#ff8fa3" />
          <Eyes y={31} dx={7} r={2.4} dead={dead} />
        </g>
      );
    case 'pig':
      return (
        <g>
          <path d="M17 18 L22 10 L27 20 Z M47 18 L42 10 L37 20 Z" fill={dark} />
          <circle cx={32} cy={34} r={17} fill={c} />
          <ellipse cx={32} cy={40} rx={8} ry={6} fill={shade(c, -0.15)} />
          <ellipse cx={29} cy={40} rx={1.6} ry={2.4} fill="#7a3b3b" />
          <ellipse cx={35} cy={40} rx={1.6} ry={2.4} fill="#7a3b3b" />
          <Eyes y={29} dx={8} r={2.2} dead={dead} />
        </g>
      );
    case 'monkey':
      return (
        <g>
          <circle cx={15} cy={32} r={7} fill={c} />
          <circle cx={49} cy={32} r={7} fill={c} />
          <circle cx={15} cy={32} r={4} fill={light} />
          <circle cx={49} cy={32} r={4} fill={light} />
          <circle cx={32} cy={32} r={17} fill={c} />
          <path d="M20 32 q0 -12 12 -10 q12 -2 12 10 q0 14 -12 14 q-12 0 -12 -14 z" fill={light} />
          <path d="M28 40 q4 3 8 0" stroke="#2a1f1c" strokeWidth={1.3} fill="none" />
          <Eyes y={30} dx={6} r={2.4} dead={dead} />
        </g>
      );
    case 'robodog':
      return (
        <g>
          <rect x={14} y={14} width={8} height={14} rx={3} fill={dark} />
          <rect x={42} y={14} width={8} height={14} rx={3} fill={dark} />
          <rect x={16} y={20} width={32} height={30} rx={9} fill={c} />
          <rect x={20} y={25} width={24} height={11} rx={5} fill="#12161f" />
          {dead ? (
            <path d="M24 28 l4 4 m0 -4 l-4 4 M36 28 l4 4 m0 -4 l-4 4" stroke="#ff5d73" strokeWidth={1.6} />
          ) : (
            <g fill="#4cc9f0">
              <circle cx={26} cy={30.5} r={2.6} />
              <circle cx={38} cy={30.5} r={2.6} />
            </g>
          )}
          <rect x={27} y={41} width={10} height={4} rx={2} fill={dark} />
          <circle cx={32} cy={12} r={2} fill="#4cc9f0" />
          <path d="M32 14 v6" stroke={dark} strokeWidth={1.5} />
        </g>
      );
    default:
      return <circle cx={32} cy={34} r={16} fill={c} />;
  }
}

const BACK: Record<string, string> = {
  fish: '#bfe6ff',
  turtle: '#d9f2d0',
  snake: '#e9f5d6',
  lizard: '#f5ecd0',
  robodog: '#dfe7f2',
};

/** Procedural portrait for a pet, by species and coat colour. */
export const PetAvatar = memo(function PetAvatar({ pet, size = 40 }: { pet: Pick<Pet, 'id' | 'species' | 'color' | 'alive' | 'name'>; size?: number }) {
  const dead = !pet.alive;
  const id = `pet-${pet.id}`;
  return (
    <svg className="avatar-svg" width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={pet.name}>
      <defs>
        <clipPath id={`${id}-c`}>
          <circle cx={32} cy={32} r={32} />
        </clipPath>
        <filter id={`${id}-g`}>
          <feColorMatrix type="saturate" values="0.05" />
        </filter>
      </defs>
      <g clipPath={`url(#${id}-c)`} filter={dead ? `url(#${id}-g)` : undefined}>
        <circle cx={32} cy={32} r={32} fill={BACK[pet.species] ?? '#fff1d6'} />
        {face(pet.species, pet.color, dead)}
        {dead && <ellipse cx={32} cy={8} rx={10} ry={2.6} fill="none" stroke="#f6d36b" strokeWidth={2} />}
      </g>
    </svg>
  );
});
