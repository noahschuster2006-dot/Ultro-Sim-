import { useState } from 'react';
import { Ctx, fmtYear, viewActions, type GameState } from '../../engine';
import { PET_BY_ID } from '../../engine/data/pets';
import { petAge } from '../../engine/systems/possessions';
import { PetAvatar } from '../art/PetAvatar';
import { ActionList, Empty, KV, Pill, Section, type Api } from '../components';

/** The Pets app: your animals, caring for them, and adopting new ones. */
export function PetsPanel({ s, api }: { s: GameState; api: Api }) {
  const x = new Ctx(s);
  const living = s.char.pets.filter((p) => p.alive);
  const gone = s.char.pets.filter((p) => !p.alive);
  const [sel, setSel] = useState<string | null>(null);
  const pet = living.find((p) => p.id === sel) ?? living[0];
  return (
    <>
      {living.length ? (
        <Section title="Your pets">
          <div className="lover-row">
            {living.map((p) => (
              <button key={p.id} className={`lover ${p.id === pet?.id ? 'active' : ''}`} onClick={() => setSel(p.id)}>
                <PetAvatar pet={p} size={64} />
                <span className="lover-name">{p.name}</span>
                <Pill>{PET_BY_ID[p.species]?.name ?? p.species}</Pill>
              </button>
            ))}
          </div>
          {pet && (
            <>
              <KV
                rows={[
                  ['Breed', pet.breed],
                  ['Age', petAge(x, pet)],
                  ['Health', Math.round(pet.health)],
                  ['Bond', Math.round(pet.bond)],
                  ['Training', Math.round(pet.training)],
                ]}
              />
              <h3>With {pet.name}</h3>
              <ActionList actions={viewActions(s, 'pet', pet.id)} api={api} arg={pet.id} compact grouped />
            </>
          )}
        </Section>
      ) : (
        <Section title="No pets">
          <Empty>An empty house. Every era has had its dogs, cats and stranger companions.</Empty>
        </Section>
      )}
      <Section title="Adopt">
        <ActionList actions={viewActions(s, 'pets')} api={api} grouped />
      </Section>
      {gone.length > 0 && (
        <Section title="Remembered">
          <div className="list">
            {gone.map((p) => (
              <div key={p.id} className="item small contact">
                <PetAvatar pet={p} size={34} />
                <span>
                  {p.name} <span className="muted">· {p.breed} · {fmtYear(p.birthYear)}–{fmtYear(p.deathYear ?? x.year)}</span>
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}
