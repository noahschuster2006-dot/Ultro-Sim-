import { useState } from 'react';
import { Ctx, fmtMoney, fmtYear, viewActions, type GameState, type Relationship } from '../../engine';
import { npcTitle } from '../../engine/systems/npcs';
import { relationshipLabel } from '../../engine/systems/relationships';
import { RELIGION_BY_ID } from '../../engine/data/countries';
import { ActionList, Empty, KV, Pill, Section, type Api } from '../components';
import { Avatar, npcSpec } from '../art/Avatar';
import { REL_ICON } from '../art/icons';
import { User } from 'lucide-react';

const GROUPS: { title: string; types: Relationship['type'][] }[] = [
  { title: 'Family', types: ['parent', 'grandparent', 'sibling', 'spouse', 'child', 'grandchild', 'inLaw'] },
  { title: 'Love', types: ['partner', 'affair', 'ex'] },
  { title: 'Friends & mentors', types: ['bestFriend', 'friend', 'mentor', 'protege', 'acquaintance'] },
  { title: 'Work & business', types: ['boss', 'colleague', 'businessPartner'] },
  { title: 'Underworld', types: ['coConspirator', 'handler', 'informant', 'cellmate', 'debtHolder', 'blackmailer'] },
  { title: 'Enemies', types: ['rival', 'enemy', 'nemesis', 'bully'] },
];

export function PeoplePanel({ s, api }: { s: GameState; api: Api }) {
  const x = new Ctx(s);
  const [sel, setSel] = useState<string | null>(null);
  const living = s.char.relationships.filter((r) => s.npcs[r.npcId]?.alive);
  const selRel = sel ? x.rel(sel) : undefined;
  const npc = sel ? s.npcs[sel] : undefined;
  return (
    <div className="grid two">
      <div>
        {GROUPS.map((g) => {
          const rels = living.filter((r) => g.types.includes(r.type));
          if (!rels.length) return null;
          return (
            <Section key={g.title} title={g.title}>
              <div className="list">
                {rels.map((r) => {
                  const n = s.npcs[r.npcId];
                  const RelIcon = REL_ICON[r.type] ?? User;
                  return (
                    <div
                      key={r.npcId}
                      className={`item clickable contact ${sel === r.npcId ? 'active' : ''}`}
                      onClick={() => {
                        setSel(r.npcId);
                        requestAnimationFrame(() => {
                          // Scroll only the phone screen, never the page around it.
                          const el = document.getElementById('person-detail');
                          const sc = el?.closest('.screen-content');
                          if (el && sc) sc.scrollTo({ top: sc.scrollTop + el.getBoundingClientRect().top - sc.getBoundingClientRect().top - 70, behavior: 'smooth' });
                        });
                      }}
                    >
                      <Avatar a={npcSpec(s, n, r.affinity)} size={46} />
                      <div className="contact-body">
                        <div className="spread">
                          <strong>
                            {n.firstName} {n.lastName}
                          </strong>
                          <Pill>
                            <RelIcon size={11} /> {relationshipLabel(r)}
                          </Pill>
                        </div>
                        <div className="small muted">
                          {x.npcAge(n)} · {npcTitle(x, n)}
                        </div>
                        <div className="track" style={{ height: 5, marginTop: 6 }} title={`Affinity ${Math.round(r.affinity)}`}>
                          <div className="fill" style={{ width: `${r.affinity}%`, background: r.affinity > 60 ? 'var(--good)' : r.affinity > 30 ? 'var(--warn)' : 'var(--bad)', height: '100%', borderRadius: 6 }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>
          );
        })}
        {!living.length && (
          <Section title="Nobody">
            <Empty>You are alone in the world.</Empty>
          </Section>
        )}
        <Section title="Family time">
          <ActionList actions={viewActions(s, 'family')} api={api} grouped empty="No family plans available right now." />
        </Section>
        <Section title="Meet people">
          <ActionList actions={viewActions(s, 'social')} api={api} grouped />
        </Section>
      </div>
      <div id="person-detail">
        {npc && selRel ? (
          <Section title={`${npc.firstName} ${npc.lastName}`} right={<Pill tone="accent">{relationshipLabel(selRel)}</Pill>}>
            <div className="person-hero">
              <Avatar a={npcSpec(s, npc, selRel.affinity)} size={88} />
            </div>
            <KV
              rows={[
                ['Age', x.npcAge(npc)],
                ['Occupation', npcTitle(x, npc)],
                ['Affinity', Math.round(selRel.affinity)],
                ['Trust', Math.round(selRel.trust)],
                ...(selRel.attraction ? ([['Attraction', Math.round(selRel.attraction)]] as [string, number][]) : []),
                ['Looks', Math.round(npc.looks)],
                ['Smarts', Math.round(npc.smarts)],
                ['Religion', RELIGION_BY_ID[npc.religionId]?.name ?? npc.religionId],
                ['Wealth', fmtMoney(npc.wealth)],
                ...(npc.spouseName ? ([['Married to', npc.spouseName]] as [string, string][]) : []),
                ...(selRel.type === 'child' && npc.upbringing ? ([['Upbringing', npc.upbringing]] as [string, string][]) : []),
              ]}
            />
            {npc.notes.length > 0 && (
              <>
                <h3>Their life</h3>
                <ul className="small" style={{ paddingLeft: 18, margin: 0 }}>
                  {npc.notes.slice(-6).map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </>
            )}
            {npc.links.length > 0 && (
              <>
                <h3>Their connections</h3>
                <div className="row">
                  {npc.links.slice(0, 8).map((l) => {
                    const o = s.npcs[l.npcId];
                    return o ? (
                      <Pill key={l.npcId} tone={l.kind === 'enemy' ? 'bad' : undefined}>
                        {o.firstName} {o.lastName} · {l.kind}
                      </Pill>
                    ) : null;
                  })}
                </div>
              </>
            )}
            <h3>Interact</h3>
            <ActionList actions={viewActions(s, 'rel', npc.id)} api={api} arg={npc.id} compact grouped />
          </Section>
        ) : (
          <Section title="Select someone">
            <Empty>Pick a person to see their life and interact with them. Every NPC has their own career, ambitions and rivalries that advance whether you watch or not.</Empty>
          </Section>
        )}
        <Section title="Remembered dead">
          {s.char.relationships.filter((r) => s.npcs[r.npcId] && !s.npcs[r.npcId].alive).length ? (
            <div className="list">
              {s.char.relationships
                .filter((r) => s.npcs[r.npcId] && !s.npcs[r.npcId].alive)
                .map((r) => {
                  const n = s.npcs[r.npcId];
                  return (
                    <div key={r.npcId} className="item small contact">
                      <Avatar a={npcSpec(s, n)} size={34} />
                      <span>
                        {n.firstName} {n.lastName} <span className="muted">· {relationshipLabel(r)} · died {fmtYear(n.deathYear ?? 0)} of {n.causeOfDeath}</span>
                      </span>
                    </div>
                  );
                })}
            </div>
          ) : (
            <Empty>No losses yet.</Empty>
          )}
        </Section>
      </div>
    </div>
  );
}
