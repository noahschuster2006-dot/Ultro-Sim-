import { Ctx, fmtMoney, fmtYear, viewActions, type GameState } from '../../engine';
import { ITEM_BY_ID, ITEM_CATS } from '../../engine/data/items';
import { ITEM_CAT_ICON, ITEM_ICON } from '../art/icons';
import { ActionList, Empty, Section, type Api } from '../components';
import { Package } from 'lucide-react';

/** The Shop app: buy and sell things, and see what you own. */
export function ShopPanel({ s, api }: { s: GameState; api: Api }) {
  const x = new Ctx(s);
  const items = s.char.items;
  return (
    <>
      <Section title="Your things" right={<span className="muted small">{items.length ? fmtMoney(items.reduce((a, i) => a + i.value, 0)) : ''}</span>}>
        {items.length ? (
          <div className="list">
            {ITEM_CATS.map((cat) => {
              const mine = items.filter((i) => ITEM_BY_ID[i.typeId]?.cat === cat.id);
              if (!mine.length) return null;
              return (
                <div key={cat.id}>
                  <h3>{cat.name}</h3>
                  <div className="list">
                    {mine.map((i) => {
                      const Icon = ITEM_ICON[i.typeId] ?? ITEM_CAT_ICON[cat.id] ?? Package;
                      const def = ITEM_BY_ID[i.typeId];
                      return (
                        <div key={i.id} className="item contact">
                          <span className="mini-icon item-icon" aria-hidden>
                            <Icon size={16} />
                          </span>
                          <div className="contact-body">
                            <div className="spread">
                              <strong>{i.name}</strong>
                              <span className="small">{fmtMoney(i.value)}</span>
                            </div>
                            <div className="tiny muted">
                              Since {fmtYear(i.boughtYear)}
                              {def && (def.cat === 'vehicle' || def.cat === 'tech') ? ` · condition ${Math.round(i.condition)}%` : ''}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty>You don't own anything worth listing yet.</Empty>
        )}
      </Section>
      <Section title="Shop" right={<span className="muted small">{fmtMoney(x.c.money)} to spend</span>}>
        <ActionList actions={viewActions(s, 'shop')} api={api} grouped />
      </Section>
    </>
  );
}
