import { useSyncExternalStore } from 'react';
import { Disc3, Pause, Play, Shuffle, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { music, TRACKS } from '../audio/music';
import { sfx } from '../audio/sfx';

const MOOD_LABEL: Record<string, string> = { calm: 'Calm', upbeat: 'Upbeat', tense: 'Tense', sad: 'Blue', epic: 'Epic', mystic: 'Mystic' };

function useMusic() {
  return useSyncExternalStore(
    (fn) => music.subscribe(fn),
    () => music.state,
    () => music.state,
  );
}

export function MusicApp() {
  const st = useMusic();
  const track = TRACKS.find((t) => t.id === st.trackId) ?? TRACKS[0];
  const playing = st.playing && !st.muted;
  return (
    <div className="music-app">
      <div className={`album ${playing ? 'spin' : ''}`} aria-hidden>
        <Disc3 size={120} strokeWidth={1.2} />
      </div>
      <div className="now">
        <div className="track-name">{track?.name ?? 'Nothing playing'}</div>
        <div className="muted small">
          LifeSim Radio · {MOOD_LABEL[track?.mood ?? 'calm']} · {st.pinned ? 'your pick' : 'follows your mood'}
        </div>
      </div>
      <div className="transport">
        <button
          className="round"
          aria-label={st.pinned ? 'Let the music follow your mood' : 'Shuffle'}
          onClick={() => {
            music.unlock();
            music.pin(null);
          }}
          title="Follow my mood"
        >
          <Shuffle size={20} />
        </button>
        <button
          className="round big"
          aria-label={playing ? 'Pause' : 'Play'}
          onClick={() => {
            music.unlock();
            if (playing) music.stop();
            else {
              music.setMuted(false);
              music.play(st.trackId ?? undefined);
            }
          }}
        >
          {playing ? <Pause size={30} /> : <Play size={30} />}
        </button>
        <button
          className="round"
          aria-label="Next track"
          onClick={() => {
            music.unlock();
            music.next();
          }}
        >
          <SkipForward size={20} />
        </button>
      </div>
      <label className="slider-row">
        {st.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        <input type="range" min={0} max={100} value={Math.round(st.volume * 100)} onChange={(e) => music.setVolume(Number(e.target.value) / 100)} aria-label="Music volume" />
      </label>
      <h3>Stations</h3>
      <div className="list">
        {TRACKS.map((t) => (
          <button
            key={t.id}
            className={`item clickable track ${t.id === st.trackId ? 'active' : ''}`}
            onClick={() => {
              music.unlock();
              music.setMuted(false);
              music.pin(t.id);
              music.play(t.id);
              sfx.play('tap');
            }}
          >
            <span>
              <strong>{t.name}</strong>
              <span className="muted small"> · {MOOD_LABEL[t.mood]} · {t.bpm} bpm</span>
            </span>
            {t.id === st.trackId && playing ? <span className="eq" aria-hidden><i /><i /><i /></span> : null}
          </button>
        ))}
      </div>
      <p className="tiny faint" style={{ marginTop: 12 }}>
        Every track is composed live in your browser with the Web Audio API. There are no recordings, so the music is free to use and works offline.
      </p>
    </div>
  );
}
