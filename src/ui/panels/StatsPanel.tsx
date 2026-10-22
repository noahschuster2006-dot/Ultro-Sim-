import { Ctx, type GameState } from '../../engine';
import { STAT_CATEGORIES, STAT_DEFS, type StatId, type Stats } from '../../engine/data/stats';
import { lifespan } from '../../engine/systems/body';
import { Bar, KV, Section } from '../components';
import { STAT_CAT_ICON } from '../art/icons';

export function StatsPanel({ s, prev }: { s: GameState; prev: Stats | null }) {
  const x = new Ctx(s);
  const L = lifespan(x);
  const f = (n: number) => (n >= 0 ? `+${n.toFixed(1)}` : n.toFixed(1));
  return (
    <>
      <Section title="All 47 stats">
        <div className="grid three">
          {STAT_CATEGORIES.map((cat) => (
            <div key={cat.id}>
              <h3 title={cat.desc}>
                {(() => {
                  const I = STAT_CAT_ICON[cat.id];
                  return I ? <I size={14} style={{ verticalAlign: '-2px', marginRight: 5 }} /> : null;
                })()}
                {cat.name}
              </h3>
              {STAT_DEFS.filter((d) => d.cat === cat.id).map((d) => (
                <Bar key={d.id} id={d.id as StatId} value={s.char.stats[d.id]} delta={prev ? s.char.stats[d.id] - prev[d.id] : 0} />
              ))}
            </div>
          ))}
        </div>
      </Section>
      <Section title="Life expectancy">
        <p className="small muted">The bible formula, live: base 72 + genetics + country/era, adjusted by average health and happiness, wealth, addictions, chronic conditions and combat injuries, plus a hidden roll set at birth.</p>
        <KV
          rows={[
            ['Base (72 + genetics + country & era)', L.base.toFixed(0)],
            ['Average health', f(L.health)],
            ['Average happiness', f(L.happiness)],
            ['Wealth percentile', f(L.wealth)],
            ['Active addictions', f(L.addiction)],
            ['Chronic conditions', f(L.chronic)],
            ['Combat injuries', f(L.combat)],
            ['Traits, pacts & blessings', f(L.other)],
            ['Fate (rolled at birth)', f(L.random)],
            [<strong key="l">Expected lifespan</strong>, <strong key="v">{L.final}</strong>],
          ]}
        />
      </Section>
    </>
  );
}
