import { viewActions, type GameState } from '../../engine';
import { ActionList, Section, type Api } from '../components';

/** The Going Out app: everything to do with your free time, grouped. */
export function GoingOutPanel({ s, api }: { s: GameState; api: Api }) {
  return (
    <Section title="What's on">
      <ActionList actions={viewActions(s, 'activity')} api={api} grouped empty="Nothing open to you right now." />
    </Section>
  );
}
