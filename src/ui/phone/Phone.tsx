import { forwardRef, type ReactNode } from 'react';
import { BatteryFull, BatteryLow, BatteryMedium, Music2, Signal, SignalLow, SignalMedium, Wifi } from 'lucide-react';
import { mediaEraOf } from '../../engine/data/eras';

export function yearLabel(y: number): string {
  return y < 0 ? `${-y} BC` : String(y);
}

/** Status bar: the "clock" shows the in-game year, the battery is your health. */
export function StatusBar({ year, health, musicOn, light }: { year: number | null; health: number | null; musicOn: boolean; light?: boolean }) {
  const now = new Date();
  const clock = year === null ? `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}` : yearLabel(year);
  const media = year === null ? 'social' : mediaEraOf(year).id;
  const bars = media === 'oral' ? 0 : media === 'print' ? 1 : media === 'radio' || media === 'tv' ? 2 : 3;
  const SignalIcon = bars <= 1 ? SignalLow : bars === 2 ? SignalMedium : Signal;
  const BatteryIcon = health === null || health > 66 ? BatteryFull : health > 30 ? BatteryMedium : BatteryLow;
  const battColor = health === null ? undefined : health > 50 ? undefined : health > 25 ? '#ffcc4d' : '#ff5a5a';
  return (
    <div className={`status-bar ${light ? 'light' : ''}`}>
      <span className="clock-group">
        <span className="clock">{clock}</span>
        {musicOn && <Music2 size={12} aria-label="Music on" />}
      </span>
      <span className="status-icons">
        <SignalIcon size={15} aria-hidden style={{ opacity: bars === 0 ? 0.35 : 1 }} />
        {bars >= 3 && <Wifi size={15} aria-hidden />}
        {health !== null && <span className="batt-pct">{Math.round(health)}%</span>}
        <BatteryIcon size={20} aria-label={health === null ? 'Battery' : `Health ${Math.round(health)}%`} color={battColor} />
      </span>
    </div>
  );
}

export interface PhoneProps {
  children: ReactNode;
  dip: boolean;
  /** Skin tone of the hands holding the phone. */
  skin: string;
  sleeve: string;
  overlay?: ReactNode;
}

/** The phone body, held in two hands on large screens. */
export const Phone = forwardRef<HTMLDivElement, PhoneProps>(function Phone({ children, dip, skin, sleeve, overlay }, ref) {
  return (
    <div className={`phone-wrap ${dip ? 'dip' : ''}`}>
      <Hands skin={skin} sleeve={sleeve} layer="back" />
      <div className="phone" ref={ref}>
        <div className="phone-screen">
          <div className="island" aria-hidden />
          {children}
          {overlay}
        </div>
        <span className="btn-side power" aria-hidden />
        <span className="btn-side vol-up" aria-hidden />
        <span className="btn-side vol-down" aria-hidden />
      </div>
      <Hands skin={skin} sleeve={sleeve} layer="front" />
    </div>
  );
});

/**
 * Stylised hands. The back layer (palms and fingers wrapping the sides) sits
 * behind the phone; the front layer is just the thumbs resting on the bezel.
 */
function Hands({ skin, sleeve, layer }: { skin: string; sleeve: string; layer: 'back' | 'front' }) {
  const shade = 'rgba(0,0,0,0.16)';
  if (layer === 'front') {
    return (
      <svg className="hands hands-front" viewBox="0 0 600 400" preserveAspectRatio="xMidYMax meet" aria-hidden>
        {/* left thumb */}
        <path d="M58 270 C 70 236, 100 214, 118 206 C 128 202, 134 212, 128 222 C 116 240, 100 262, 92 300 Z" fill={skin} />
        <path d="M118 206 C 128 202, 134 212, 128 222 C 124 216, 120 212, 112 211 Z" fill="rgba(255,255,255,0.18)" />
        {/* right thumb */}
        <path d="M542 270 C 530 236, 500 214, 482 206 C 472 202, 466 212, 472 222 C 484 240, 500 262, 508 300 Z" fill={skin} />
        <path d="M482 206 C 472 202, 466 212, 472 222 C 476 216, 480 212, 488 211 Z" fill="rgba(255,255,255,0.18)" />
      </svg>
    );
  }
  return (
    <svg className="hands hands-back" viewBox="0 0 600 400" preserveAspectRatio="xMidYMax meet" aria-hidden>
      {/* sleeves */}
      <path d="M-40 400 L 20 300 C 40 280, 90 290, 110 320 L 120 400 Z" fill={sleeve} />
      <path d="M640 400 L 580 300 C 560 280, 510 290, 490 320 L 480 400 Z" fill={sleeve} />
      {/* left palm, with fingertips curling round the phone's left edge */}
      <path d="M20 320 C 30 260, 70 230, 112 228 L 126 236 C 128 270, 120 330, 110 380 L 40 400 Z" fill={skin} />
      {[132, 160, 188].map((y) => (
        <g key={`l${y}`}>
          <ellipse cx={130} cy={y} rx={17} ry={11} fill={skin} />
          <path d={`M116 ${y - 3} q -3 4 0 7`} stroke={shade} strokeWidth={2} fill="none" strokeLinecap="round" />
        </g>
      ))}
      {/* right palm and fingertips */}
      <path d="M580 320 C 570 260, 530 230, 488 228 L 474 236 C 472 270, 480 330, 490 380 L 560 400 Z" fill={skin} />
      {[132, 160, 188].map((y) => (
        <g key={`r${y}`}>
          <ellipse cx={470} cy={y} rx={17} ry={11} fill={skin} />
          <path d={`M484 ${y - 3} q 3 4 0 7`} stroke={shade} strokeWidth={2} fill="none" strokeLinecap="round" />
        </g>
      ))}
    </svg>
  );
}
