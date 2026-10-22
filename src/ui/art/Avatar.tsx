import { memo } from 'react';
import type { Character, GameState, Gender, NPC } from '../../engine';

/**
 * Procedural cartoon portraits. Every person gets a stable face from their id:
 * skin tone from where they were born, hair colour from their family name (so
 * relatives resemble each other), and age, mood and circumstance on top.
 */
export interface AvatarSpec {
  seed: string;
  family: string;
  gender: Gender;
  age: number;
  countryId: string;
  looks?: number;
  /** -1 (miserable) .. 1 (delighted) */
  mood?: number;
  dead?: boolean;
  crown?: boolean;
  prison?: boolean;
  /** The year being lived in: drives era clothing. */
  year?: number;
  /** Wealthy people dress up (ruffs, laurels, circlets, ties). */
  rich?: boolean;
}

type Era = 'ancient' | 'medieval' | 'early' | 'industrial' | 'modern' | 'future';

function eraOfYear(y: number): Era {
  if (y < 500) return 'ancient';
  if (y < 1500) return 'medieval';
  if (y < 1800) return 'early';
  if (y < 1930) return 'industrial';
  if (y < 2030) return 'modern';
  return 'future';
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function picker(seed: string) {
  let a = hash(seed) || 1;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    pick: <T,>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)],
    weighted: <T,>(xs: readonly [T, number][]): T => {
      const total = xs.reduce((a2, [, w]) => a2 + w, 0);
      let r = next() * total;
      for (const [v, w] of xs) {
        r -= w;
        if (r <= 0) return v;
      }
      return xs[xs.length - 1][0];
    },
  };
}

const SKIN = ['#fde3cf', '#f6d0b1', '#eab68f', '#d9a074', '#c08457', '#9c6640', '#7a4a2a', '#5a3520'];

/** Skin-tone weights (indexes into SKIN) by country of birth. */
const SKIN_BY_COUNTRY: Record<string, [number, number][]> = {
  us: [[0, 3], [1, 3], [2, 2], [3, 2], [4, 1.5], [5, 1.5], [6, 1], [7, 0.6]],
  gb: [[0, 4], [1, 3], [2, 1], [4, 0.6], [5, 0.6], [6, 0.4]],
  fr: [[0, 3], [1, 3], [2, 1.5], [4, 0.7], [5, 0.6], [6, 0.5]],
  de: [[0, 4], [1, 3], [2, 1], [3, 0.4]],
  it: [[1, 3], [2, 3], [3, 1]],
  es: [[1, 3], [2, 3], [3, 1.2]],
  ru: [[0, 4], [1, 3], [2, 0.8]],
  cn: [[1, 3], [2, 3], [3, 1]],
  jp: [[0, 2], [1, 3], [2, 2]],
  in: [[3, 2], [4, 3], [5, 3], [6, 1]],
  br: [[1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 1.5]],
  mx: [[2, 2], [3, 3], [4, 2], [5, 1]],
  co: [[2, 2], [3, 3], [4, 2], [5, 1], [6, 0.6]],
  ng: [[5, 2], [6, 3], [7, 3]],
  eg: [[3, 2], [4, 3], [5, 1.5]],
  sa: [[3, 2], [4, 3], [5, 1]],
  ir: [[2, 2], [3, 3], [4, 1.5]],
  gr: [[1, 2], [2, 3], [3, 1.5]],
  au: [[0, 3], [1, 3], [2, 1.5], [4, 0.8], [6, 0.6]],
  ch: [[0, 3], [1, 3], [2, 1]],
  za: [[1, 1.2], [3, 1], [5, 2], [6, 2.5], [7, 2]],
  ky: [[1, 1], [3, 1], [5, 2], [6, 2]],
};

const HAIR = ['#1b1210', '#2f1d14', '#4a2e1c', '#6b4226', '#8a5a2b', '#b3743b', '#d9a85e', '#e8c97a', '#a8401f'];
const HAIR_BY_TONE: [number, number][][] = [
  [[1, 2], [2, 2], [3, 2], [4, 2], [5, 1.5], [6, 1.5], [7, 1.2], [8, 0.8]],
  [[0, 2], [1, 3], [2, 3], [3, 2], [4, 1], [6, 0.6], [8, 0.4]],
  [[0, 4], [1, 3], [2, 1.5], [3, 0.5]],
];

const SHIRTS = ['#5b8def', '#ef6b6b', '#45c48a', '#f2b544', '#a47cf3', '#3fb7c8', '#ef8fbd', '#6d7a91', '#f08a4b', '#2f3b55'];
const BACKS = ['#ffd9e0', '#d9ecff', '#dff7e8', '#fff1c9', '#ece0ff', '#d6f5f3', '#ffe4d1', '#e4e8f0'];

type HairStyle = 'buzz' | 'short' | 'side' | 'curly' | 'long' | 'bob' | 'bun' | 'pony' | 'afro' | 'bald' | 'tuft' | 'braids' | 'mohawk' | 'topknot' | 'spiky' | 'pigtails' | 'locs';

/** Every random choice for a portrait, made in a fixed order so it is stable. */
export function look(a: AvatarSpec) {
  const p = picker(a.seed);
  const fam = picker(`${a.family}:${a.countryId}`);
  const skinIdx = fam.weighted(SKIN_BY_COUNTRY[a.countryId] ?? SKIN_BY_COUNTRY.us);
  // A little individual variation on top of the family tone.
  const skin = SKIN[Math.max(0, Math.min(SKIN.length - 1, skinIdx + (p.next() < 0.2 ? (p.next() < 0.5 ? -1 : 1) : 0)))];
  const toneGroup = skinIdx <= 2 ? 0 : skinIdx <= 4 ? 1 : 2;
  let hair = HAIR[fam.weighted(HAIR_BY_TONE[toneGroup])];
  const grayRoll = p.next();
  if (a.age >= 75) hair = '#e9e9ee';
  else if (a.age >= 58) hair = '#b9bcc6';
  else if (a.age >= 48 && grayRoll < 0.4) hair = '#8d8f99';
  const female = a.gender === 'female';
  const nb = a.gender === 'nonbinary';
  const baby = a.age < 3;
  const kid = a.age < 13;
  const femaleStyles: HairStyle[] = toneGroup === 2 ? ['afro', 'bun', 'long', 'pony', 'bob', 'curly', 'braids', 'locs'] : ['long', 'bob', 'bun', 'pony', 'long', 'curly', 'braids', 'topknot'];
  const maleStyles: HairStyle[] = toneGroup === 2 ? ['buzz', 'short', 'afro', 'curly', 'buzz', 'locs', 'spiky'] : ['short', 'side', 'buzz', 'curly', 'short', 'side', 'spiky', 'mohawk', 'topknot'];
  let styleRoll = female ? p.pick(femaleStyles) : nb ? p.pick<HairStyle>(['bob', 'side', 'curly', 'short', 'pony', 'mohawk', 'spiky']) : p.pick(maleStyles);
  // Punk and spiky hair are a modern thing.
  if ((styleRoll === 'mohawk' || styleRoll === 'spiky') && (a.year ?? 2000) < 1950) styleRoll = 'short';
  if (female && kid && styleRoll === 'pony' && a.age >= 3) styleRoll = 'pigtails';
  let style: HairStyle = baby ? 'tuft' : styleRoll;
  const baldRoll = p.next();
  if (!female && !baby && a.age >= 55 && baldRoll < 0.35) style = 'bald';
  const shirtPick = p.pick(SHIRTS);
  const shirt = a.prison ? '#f08a24' : shirtPick;
  const backPick = p.pick(BACKS);
  const back = a.dead ? '#d6d8de' : backPick;
  const glassesRoll = p.next();
  const glasses = !baby && glassesRoll < (a.age > 45 ? 0.35 : 0.15);
  const beardRoll = p.next();
  const beardKind = p.pick(['full', 'stache', 'stubble'] as const);
  const beard = !female && !nb && a.age >= 20 && beardRoll < 0.3 ? beardKind : null;
  // Rolls added later stay at the end so existing faces keep their looks.
  const earringRoll = p.next();
  const earrings = !baby && (female ? earringRoll < 0.45 : earringRoll < 0.08);
  const frecklesRoll = p.next();
  const freckles = skinIdx <= 2 && frecklesRoll < 0.18;
  const outfitRoll = p.next();
  const era = eraOfYear(a.year ?? 2000);
  return { skin, hair, toneGroup, female, nb, baby, kid, style, shirt, back, glasses, beard, earrings, freckles, outfitRoll, era };
}

function Face({ a }: { a: AvatarSpec }) {
  const { skin, hair, female, baby, kid, style, shirt, back, glasses, beard, earrings, freckles, outfitRoll, era } = look(a);
  const mood = a.dead ? 0 : a.mood ?? 0.3;
  const headR = baby ? 17 : kid ? 15.5 : 14.5;
  const cy = baby ? 31 : kid ? 29 : 28;
  const eyeY = cy + (baby ? 2 : 1);
  const mouthY = cy + (baby ? 9 : 8);
  const blush = (a.looks ?? 50) > 65 || kid;

  const hairBack = () => {
    switch (style) {
      case 'long':
        return <path d={`M${32 - headR - 2} ${cy} Q${32 - headR - 4} ${cy + 20} ${32 - headR + 2} ${cy + 22} L${32 + headR - 2} ${cy + 22} Q${32 + headR + 4} ${cy + 20} ${32 + headR + 2} ${cy} Z`} fill={hair} />;
      case 'afro':
        return <circle cx={32} cy={cy - 4} r={headR + 7} fill={hair} />;
      case 'bun':
        return <circle cx={32} cy={cy - headR - 3} r={6} fill={hair} />;
      case 'pony':
        return <path d={`M${32 + headR - 3} ${cy - 6} q10 4 6 20 q-5 -6 -8 -10 z`} fill={hair} />;
      case 'braids':
        return (
          <g fill={hair}>
            {[-1, 1].map((side) => (
              <g key={side}>
                {[0, 1, 2, 3].map((k) => (
                  <ellipse key={k} cx={32 + side * (headR - 1)} cy={cy + 4 + k * 5} rx={3} ry={3.2} />
                ))}
              </g>
            ))}
          </g>
        );
      case 'locs':
        return (
          <g stroke={hair} strokeWidth={3.2} strokeLinecap="round">
            {[-13, -9, -5, 5, 9, 13].map((dx) => (
              <path key={dx} d={`M${32 + dx} ${cy - 6} q${dx / 6} 12 ${dx / 4} 22`} fill="none" />
            ))}
          </g>
        );
      case 'pigtails':
        return (
          <g fill={hair}>
            <circle cx={32 - headR - 2} cy={cy - 2} r={5} />
            <circle cx={32 + headR + 2} cy={cy - 2} r={5} />
          </g>
        );
      case 'topknot':
        return <circle cx={32} cy={cy - headR - 4} r={5} fill={hair} />;
      case 'curly':
        return (
          <g fill={hair}>
            {[-12, -6, 0, 6, 12].map((dx) => (
              <circle key={dx} cx={32 + dx} cy={cy - headR + 3 - Math.abs(dx) * -0.1} r={6} />
            ))}
          </g>
        );
      default:
        return null;
    }
  };

  const hairFront = () => {
    const top = cy - headR;
    switch (style) {
      case 'bald':
        return <path d={`M${32 - headR + 1} ${cy - 2} q-1 -5 2 -8 M${32 + headR - 1} ${cy - 2} q1 -5 -2 -8`} stroke={hair} strokeWidth={3} fill="none" strokeLinecap="round" />;
      case 'tuft':
        return <path d={`M30 ${top + 1} q2 -6 5 -4 q-3 1 -2 4`} fill={hair} />;
      case 'mohawk':
        return <path d={`M28 ${cy - 4} L30 ${top - 8} L32 ${top - 3} L34 ${top - 9} L36 ${cy - 4} Z`} fill={hair} />;
      case 'spiky':
        return (
          <path
            d={`M${32 - headR} ${cy - 1} L${32 - headR + 2} ${top - 2} L${26} ${top + 2} L${28} ${top - 5} L${32} ${top + 1} L${35} ${top - 6} L${37} ${top + 2} L${41} ${top - 3} L${32 + headR} ${cy - 1} Q32 ${top + 6} ${32 - headR} ${cy - 1} Z`}
            fill={hair}
          />
        );
      case 'buzz':
        return <path d={`M${32 - headR} ${cy - 2} A${headR} ${headR} 0 0 1 ${32 + headR} ${cy - 2} Q32 ${top + 4} ${32 - headR} ${cy - 2} Z`} fill={hair} opacity={0.9} />;
      case 'side':
        return <path d={`M${32 - headR - 1} ${cy + 1} Q${32 - headR} ${top - 3} 34 ${top - 1} Q${32 + headR + 2} ${top} ${32 + headR + 1} ${cy + 1} Q${32 + 4} ${top + 7} ${32 - headR - 1} ${cy + 1} Z`} fill={hair} />;
      case 'afro':
        return <path d={`M${32 - headR} ${cy - 1} Q32 ${top + 6} ${32 + headR} ${cy - 1} Q${32 + headR} ${top - 2} 32 ${top - 2} Q${32 - headR} ${top - 2} ${32 - headR} ${cy - 1} Z`} fill={hair} />;
      case 'curly':
      case 'locs':
        return <path d={`M${32 - headR} ${cy - 1} Q32 ${top + 5} ${32 + headR} ${cy - 1} Q${32 + headR} ${top - 1} 32 ${top - 1} Q${32 - headR} ${top - 1} ${32 - headR} ${cy - 1} Z`} fill={hair} />;
      case 'long':
      case 'bob':
      case 'pony':
      case 'bun':
      case 'braids':
      case 'pigtails':
      case 'topknot':
        return (
          <path
            d={`M${32 - headR - 1} ${cy + (style === 'bob' ? 9 : 4)} Q${32 - headR - 2} ${top - 3} 32 ${top - 2} Q${32 + headR + 2} ${top - 3} ${32 + headR + 1} ${cy + (style === 'bob' ? 9 : 4)} L${32 + headR - 2} ${cy - 1} Q${36} ${top + 6} ${30} ${top + 4} Q${32 - headR + 4} ${top + 8} ${32 - headR + 2} ${cy - 1} Z`}
            fill={hair}
          />
        );
      default:
        return <path d={`M${32 - headR} ${cy} Q${32 - headR} ${top - 2} 32 ${top - 2} Q${32 + headR} ${top - 2} ${32 + headR} ${cy} Q${32 + 6} ${top + 5} ${32 - headR} ${cy} Z`} fill={hair} />;
    }
  };

  const mouth = () => {
    if (a.dead) return <path d={`M28 ${mouthY} h8`} stroke="#5b4a48" strokeWidth={1.6} strokeLinecap="round" />;
    if (mood > 0.55) return <path d={`M26.5 ${mouthY - 1} Q32 ${mouthY + 6} 37.5 ${mouthY - 1} Z`} fill="#7a2f2f" />;
    if (mood > 0.15) return <path d={`M27.5 ${mouthY} Q32 ${mouthY + 4} 36.5 ${mouthY}`} stroke="#6b3434" strokeWidth={1.7} fill="none" strokeLinecap="round" />;
    if (mood > -0.3) return <path d={`M28.5 ${mouthY + 1} h7`} stroke="#6b3434" strokeWidth={1.7} strokeLinecap="round" />;
    return <path d={`M27.5 ${mouthY + 2.5} Q32 ${mouthY - 1.5} 36.5 ${mouthY + 2.5}`} stroke="#6b3434" strokeWidth={1.7} fill="none" strokeLinecap="round" />;
  };

  const eyes = () =>
    a.dead ? (
      <g stroke="#3a2c2a" strokeWidth={1.6} strokeLinecap="round">
        <path d={`M24.5 ${eyeY - 1.5} l3 3 m0 -3 l-3 3`} />
        <path d={`M36.5 ${eyeY - 1.5} l3 3 m0 -3 l-3 3`} />
      </g>
    ) : (
      <g>
        <ellipse cx={26} cy={eyeY} rx={baby ? 2.1 : 1.8} ry={baby ? 2.4 : 2.2} fill="#231a18" />
        <ellipse cx={38} cy={eyeY} rx={baby ? 2.1 : 1.8} ry={baby ? 2.4 : 2.2} fill="#231a18" />
        <circle cx={26.6} cy={eyeY - 0.8} r={0.6} fill="#fff" />
        <circle cx={38.6} cy={eyeY - 0.8} r={0.6} fill="#fff" />
        {(female || baby) && (
          <g stroke="#231a18" strokeWidth={0.9} strokeLinecap="round">
            <path d={`M24 ${eyeY - 2} l-1 -1.2 M39.9 ${eyeY - 2} l1 -1.2`} />
          </g>
        )}
        {!baby && (
          <g stroke={a.age >= 58 ? '#9a9aa2' : hair} strokeWidth={1.4} strokeLinecap="round" fill="none">
            <path d={mood < -0.3 ? `M23.5 ${eyeY - 5} l5 1.5` : `M23.5 ${eyeY - 4.5} q2.5 -1.5 5 0`} />
            <path d={mood < -0.3 ? `M40.5 ${eyeY - 5} l-5 1.5` : `M35.5 ${eyeY - 4.5} q2.5 -1.5 5 0`} />
          </g>
        )}
      </g>
    );

  const bodyTop = cy + headR - 2;
  return (
    <g filter={a.dead ? 'url(#av-gray)' : undefined}>
      <circle cx={32} cy={32} r={32} fill={back} />
      {hairBack()}
      {/* body */}
      <path d={`M${baby ? 14 : 10} 64 Q${baby ? 14 : 10} ${bodyTop + 6} 32 ${bodyTop + 4} Q${baby ? 50 : 54} ${bodyTop + 6} ${baby ? 50 : 54} 64 Z`} fill={shirt} />
      {a.prison && (
        <g stroke="#c96a12" strokeWidth={1.6}>
          <path d={`M12 ${bodyTop + 12} H52 M11 ${bodyTop + 17} H53`} />
        </g>
      )}
      {!baby && !a.prison && <Outfit era={era} rich={!!a.rich} female={female} kid={kid} roll={outfitRoll} shirt={shirt} top={bodyTop} />}
      {/* neck */}
      <rect x={28.5} y={cy + headR - 5} width={7} height={7} rx={2} fill={skin} />
      <rect x={28.5} y={cy + headR - 1} width={7} height={2} fill="rgba(0,0,0,0.08)" />
      {/* ears */}
      <ellipse cx={32 - headR + 0.5} cy={cy + 2} rx={2.6} ry={3.4} fill={skin} />
      <ellipse cx={32 + headR - 0.5} cy={cy + 2} rx={2.6} ry={3.4} fill={skin} />
      {/* head */}
      <ellipse cx={32} cy={cy} rx={headR} ry={headR + (baby ? 0 : 1)} fill={skin} />
      {beard === 'full' && <path d={`M${32 - headR + 2} ${cy + 2} Q${32 - headR + 3} ${cy + headR + 2} 32 ${cy + headR + 2} Q${32 + headR - 3} ${cy + headR + 2} ${32 + headR - 2} ${cy + 2} Q${32 + 6} ${mouthY + 6} 32 ${mouthY + 5} Q${32 - 6} ${mouthY + 6} ${32 - headR + 2} ${cy + 2} Z`} fill={hair} opacity={0.95} />}
      {beard === 'stubble' && <ellipse cx={32} cy={mouthY + 2} rx={9} ry={5} fill={hair} opacity={0.22} />}
      {hairFront()}
      {eyes()}
      {/* nose */}
      <path d={`M32 ${eyeY + 2} q-1.6 3.4 0.4 4`} stroke="rgba(0,0,0,0.22)" strokeWidth={1.2} fill="none" strokeLinecap="round" />
      {blush && !a.dead && (
        <g fill="#ff7a8a" opacity={0.28}>
          <ellipse cx={23.5} cy={mouthY - 2} rx={2.6} ry={1.6} />
          <ellipse cx={40.5} cy={mouthY - 2} rx={2.6} ry={1.6} />
        </g>
      )}
      {mouth()}
      {beard === 'stache' && <path d={`M27 ${mouthY - 1.5} Q32 ${mouthY - 4.5} 37 ${mouthY - 1.5} Q32 ${mouthY - 2.2} 27 ${mouthY - 1.5} Z`} fill={hair} />}
      {a.age >= 62 && !a.dead && (
        <g stroke="rgba(0,0,0,0.18)" strokeWidth={0.8} fill="none" strokeLinecap="round">
          <path d={`M21.5 ${eyeY + 1} l-1.5 1 M42.5 ${eyeY + 1} l1.5 1`} />
          <path d={`M25 ${mouthY - 3} q-1 2 0 4 M39 ${mouthY - 3} q1 2 0 4`} />
        </g>
      )}
      {glasses && (
        <g stroke="#2a2a33" strokeWidth={1.2} fill="rgba(255,255,255,0.15)">
          <circle cx={26} cy={eyeY} r={4} />
          <circle cx={38} cy={eyeY} r={4} />
          <path d={`M30 ${eyeY} h4`} />
        </g>
      )}
      {!baby && !a.crown && !a.dead && era === 'ancient' && a.rich && (
        <g fill="#6aa84f">
          {[-12, -8, -4, 4, 8, 12].map((dx) => (
            <ellipse key={dx} cx={32 + dx} cy={cy - headR + 3 + Math.abs(dx) * 0.25} rx={2.6} ry={1.4} transform={`rotate(${dx * 3} ${32 + dx} ${cy - headR + 3})`} />
          ))}
        </g>
      )}
      {!baby && !a.crown && era === 'medieval' && a.rich && <path d={`M${32 - headR + 1} ${cy - 7} Q32 ${cy - 11} ${32 + headR - 1} ${cy - 7}`} stroke="#e2b93b" strokeWidth={2} fill="none" />}
      {!baby && !kid && !a.crown && era === 'industrial' && !a.rich && !female && outfitRoll < 0.45 && (
        <path d={`M${32 - headR - 1} ${cy - 6} Q32 ${cy - headR - 9} ${32 + headR + 1} ${cy - 6} Q${32 + headR + 6} ${cy - 5} ${32 + headR + 3} ${cy - 3} L${32 - headR - 1} ${cy - 4} Z`} fill="#5b5248" />
      )}
      {earrings && !a.dead && (
        <g fill="#f5c542">
          <circle cx={32 - headR + 0.5} cy={cy + 6} r={1.4} />
          <circle cx={32 + headR - 0.5} cy={cy + 6} r={1.4} />
        </g>
      )}
      {freckles && !a.dead && (
        <g fill="#b9774f" opacity={0.55}>
          {[[-7, 0], [-5, 1.5], [-8.5, 1.8], [7, 0], [5, 1.5], [8.5, 1.8]].map(([dx, dy], i) => (
            <circle key={i} cx={32 + dx} cy={mouthY - 4 + dy} r={0.6} />
          ))}
        </g>
      )}
      {a.crown && (
        <path d={`M21 ${cy - headR + 1} L21 ${cy - headR - 9} L26.5 ${cy - headR - 3} L32 ${cy - headR - 11} L37.5 ${cy - headR - 3} L43 ${cy - headR - 9} L43 ${cy - headR + 1} Z`} fill="#f5c542" stroke="#c99a1d" strokeWidth={1} />
      )}
      {a.dead && <ellipse cx={32} cy={cy - headR - 5} rx={11} ry={3} fill="none" stroke="#f6d36b" strokeWidth={2} />}
    </g>
  );
}

export const Avatar = memo(function Avatar({ a, size = 40, className, title }: { a: AvatarSpec; size?: number; className?: string; title?: string }) {
  const id = `${a.seed}-${a.age}-${a.dead ? 1 : 0}`;
  return (
    <svg className={`avatar-svg ${className ?? ''}`} width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={title ?? 'portrait'} data-k={id}>
      <defs>
        <clipPath id={`av-c-${id}`}>
          <circle cx={32} cy={32} r={32} />
        </clipPath>
        <filter id="av-gray">
          <feColorMatrix type="saturate" values="0.05" />
        </filter>
      </defs>
      <g clipPath={`url(#av-c-${id})`}>
        <Face a={a} />
      </g>
    </svg>
  );
});

/** Portrait spec for the player character. */
export function playerSpec(s: GameState): AvatarSpec {
  const c: Character = s.char;
  const st = c.stats;
  const mood = (st.happiness - 50) / 50 - Math.max(0, st.depression - 50) / 100;
  return {
    seed: c.id,
    family: c.lastName,
    gender: c.gender,
    age: c.age,
    countryId: c.birthCountryId ?? c.countryId,
    looks: st.looks,
    mood,
    dead: !c.alive,
    crown: c.familyStatus === 'royalty' || c.career?.careerId === 'monarch' || c.career?.careerId === 'emperor' || c.politics.dictator,
    prison: !!c.legal.prison,
    year: s.world.year,
    rich: ['wealthy', 'aristocracy', 'royalty'].includes(c.familyStatus) || c.money > 1_000_000,
  };
}

/** Portrait spec for an NPC at the current world year. */
export function npcSpec(s: GameState, n: NPC, affinity?: number): AvatarSpec {
  return {
    seed: n.id,
    family: n.lastName,
    gender: n.gender,
    age: Math.max(0, (n.alive ? s.world.year : n.deathYear ?? s.world.year) - n.birthYear),
    countryId: n.countryId,
    looks: n.looks,
    mood: affinity === undefined ? 0.35 : (affinity - 45) / 45,
    dead: !n.alive,
    year: n.alive ? s.world.year : n.deathYear ?? s.world.year,
    rich: n.wealth > 1_000_000,
  };
}

/** Era clothing drawn over the shoulders. */
function Outfit({ era, rich, female, kid, roll, shirt, top }: { era: Era; rich: boolean; female: boolean; kid: boolean; roll: number; shirt: string; top: number }) {
  const neck = top + 4;
  switch (era) {
    case 'ancient':
      // A cream toga with a coloured sash over one shoulder.
      return (
        <g>
          <path d={`M10 64 Q10 ${top + 6} 32 ${top + 4} Q54 ${top + 6} 54 64 Z`} fill="#efe6d2" />
          <path d={`M18 ${top + 8} L46 64 L38 64 L14 ${top + 14} Z`} fill={shirt} opacity={0.9} />
        </g>
      );
    case 'medieval':
      return (
        <g stroke="rgba(0,0,0,0.25)" strokeWidth={1.1} fill="none">
          <path d={`M28 ${neck} L32 ${neck + 9} L36 ${neck}`} />
          <path d={`M29.5 ${neck + 3} l5 2 m-5 2 l5 2`} />
        </g>
      );
    case 'early':
      return rich ? (
        <g fill="#fbfbf6" stroke="rgba(0,0,0,0.12)" strokeWidth={0.6}>
          {[-9, -6, -3, 0, 3, 6, 9].map((dx) => (
            <ellipse key={dx} cx={32 + dx} cy={neck + 1} rx={3} ry={2.4} />
          ))}
        </g>
      ) : (
        <g>
          <path d={`M24 ${neck} L32 ${neck + 12} L40 ${neck}`} fill="#f3eadb" />
          <circle cx={32} cy={neck + 15} r={0.9} fill="#d8b24a" />
          <circle cx={32} cy={neck + 19} r={0.9} fill="#d8b24a" />
        </g>
      );
    case 'industrial':
      if (female) return <path d={`M27 ${neck - 1} Q32 ${neck + 6} 37 ${neck - 1} L36 ${neck + 4} Q32 ${neck + 8} 28 ${neck + 4} Z`} fill="#fbfbf6" />;
      return (
        <g>
          <path d={`M22 64 L22 ${neck + 4} L32 ${neck + 14} L42 ${neck + 4} L42 64 Z`} fill="rgba(0,0,0,0.22)" />
          <path d={`M27 ${neck} L32 ${neck + 6} L37 ${neck}`} fill="#fbfbf6" />
          {rich ? <path d={`M29 ${neck + 3} l3 2 l3 -2 l-1 3 l1 3 l-3 -2 l-3 2 l1 -3 z`} fill="#222" /> : <circle cx={32} cy={neck + 9} r={0.9} fill="#d8d8d8" />}
        </g>
      );
    case 'future':
      return (
        <g>
          <path d={`M14 ${top + 12} Q32 ${top + 4} 50 ${top + 12}`} stroke="#4cc9f0" strokeWidth={1.6} fill="none" />
          <path d={`M14 ${top + 12} Q32 ${top + 4} 50 ${top + 12}`} stroke="#4cc9f0" strokeWidth={4} opacity={0.25} fill="none" />
        </g>
      );
    default: {
      // Modern: a tie for the rich, a hoodie or a collar otherwise.
      if (rich && !female && !kid && roll < 0.6)
        return (
          <g>
            <path d={`M26 ${neck} L32 ${neck + 5} L38 ${neck}`} fill="#fbfbf6" />
            <path d={`M32 ${neck + 4} l-2 3 l2 12 l2 -12 z`} fill="#a4161a" />
          </g>
        );
      if (roll < 0.3)
        return (
          <g stroke="rgba(255,255,255,0.75)" strokeWidth={1.1} strokeLinecap="round">
            <path d={`M29 ${neck + 2} v7 M35 ${neck + 2} v7`} />
          </g>
        );
      return <path d={`M27 ${neck} L32 ${neck + 6} L37 ${neck}`} fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth={1.4} />;
    }
  }
}
