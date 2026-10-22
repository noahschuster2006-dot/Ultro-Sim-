import type { EventDef } from './types';
import { PET_BY_ID } from '../data/pets';
import { ITEM_BY_ID } from '../data/items';
import { adoptPet, loseItem, petAge } from '../systems/possessions';
import { eraCostFactor } from '../systems/finance';

/** Events the possessions system queues: a pet dies, something is stolen, a vehicle breaks down. */
export const POSSESSION_EVENTS: EventDef[] = [
  {
    id: 'pet_death', cat: 'pets', triggered: true, scene: 'graveVisit',
    title: (x) => `Goodbye, ${x.pet(x.p.petId as string)?.name ?? 'old friend'}`,
    text: (x) => {
      const p = x.pet(x.p.petId as string);
      if (!p) return 'Your pet has died.';
      const t = PET_BY_ID[p.species];
      return `${p.name}, your ${p.breed}, died at ${petAge(x, p)}. ${p.bond > 70 ? 'The house is unbearably quiet.' : 'You miss the little routines.'}${t?.id === 'robodog' ? ' The repair shop says the core cannot be rebooted.' : ''}`;
    },
    choices: [
      { label: 'Bury them in the garden', scene: 'graveVisit', run: (x) => { x.mods({ happiness: -6, depression: 2 }); x.remember('petLoss', 'Buried a beloved pet', 15); return 'You marked the spot with a stone and their old collar.'; } },
      { label: 'Hold a little funeral with family', tags: ['social'], scene: 'funeral', run: (x) => { x.mods({ happiness: -4 }); for (const r of x.rels('child', 'spouse', 'partner')) x.relMod(r.npcId, 3); return 'Everyone shared a favourite story. There were tears and, eventually, laughter.'; } },
      {
        label: 'Adopt another one soon', tags: ['impulsive'], scene: 'pet',
        when: (x) => !!x.pet(x.p.petId as string) && (PET_BY_ID[x.pet(x.p.petId as string)!.species]?.years[1] ?? 0) >= x.year,
        run: (x) => { const p = x.pet(x.p.petId as string)!; x.mods({ happiness: -2 }); return `${adoptPet(x, p.species)} Nobody could replace ${p.name}, but the new one is trying.`; },
      },
    ],
  },
  {
    id: 'item_stolen', cat: 'possessions', triggered: true, scene: 'crime',
    title: 'Robbed',
    text: (x) => { const it = x.item(x.p.itemId as string); return it ? `Your ${it.name.toLowerCase()} is gone. Someone must have been watching.` : 'Someone broke in.'; },
    when: (x) => !!x.item(x.p.itemId as string),
    choices: [
      { label: 'Report it to the police', tags: ['cautious'], scene: 'police', run: (x) => { const it = x.item(x.p.itemId as string); if (!it) return 'It turned up after all.'; if (x.chance(0.25)) return `The police recovered your ${it.name.toLowerCase()} from a pawn shop.`; loseItem(x, it.id); x.mods({ happiness: -4 }); return 'They took a statement. You never saw it again.'; } },
      { label: 'Claim on insurance', when: (x) => x.year >= 1700, scene: 'taxes', run: (x) => { const it = loseItem(x, x.p.itemId as string); if (!it) return 'Nothing to claim.'; const pay = Math.round(it.value * 0.7); x.money(pay); x.mods({ happiness: -2 }); return `The insurer paid ${x.fmt(pay)} after weeks of forms.`; } },
      { label: 'Track the thief down yourself', tags: ['violent', 'impulsive'], scene: 'carChase', run: (x) => { const it = x.item(x.p.itemId as string); if (!it) return 'It was misplaced, not stolen.'; if (x.chance(0.3 + x.stat('streetCred') / 300)) { x.mods({ happiness: 4, aggression: 2 }); return `You found the fence and got your ${it.name.toLowerCase()} back. Nobody argued.`; } loseItem(x, it.id); x.mods({ happiness: -5, stress: 4 }); return 'The trail went cold in a part of town you should not have been in.'; } },
    ],
  },
  {
    id: 'vehicle_breakdown', cat: 'possessions', triggered: true, scene: 'car',
    title: 'Broken down',
    text: (x) => { const it = x.item(x.p.itemId as string); return it ? `Your ${it.name.toLowerCase()} gave out at the worst possible moment.` : 'Your ride gave out.'; },
    when: (x) => !!x.item(x.p.itemId as string),
    choices: [
      { label: 'Pay for proper repairs', scene: 'construction', run: (x) => { const it = x.item(x.p.itemId as string); if (!it) return 'Nothing to fix.'; const t = ITEM_BY_ID[it.typeId]; const cost = Math.round((t?.price ?? 5000) * 0.15 * Math.max(0.2, eraCostFactor(x.year))); if (!x.spend(cost)) return 'You could not afford the repairs. It sits on blocks.'; it.condition = 85; return `${x.fmt(cost)} later, it runs like new.`; } },
      { label: 'Fix it yourself', tags: ['cautious'], run: (x) => { const it = x.item(x.p.itemId as string); if (!it) return 'Nothing to fix.'; x.train('mechanics', 4); if (x.chance(0.5)) { it.condition = 60; return 'Grease to the elbows, but it starts. Mostly.'; } it.condition = Math.max(0, it.condition - 10); return 'You made it worse. There is a part left over.'; } },
      { label: 'Sell it for scrap', scene: 'moneyDown', run: (x) => { const it = loseItem(x, x.p.itemId as string); if (!it) return 'It is already gone.'; const pay = Math.round(it.value * 0.3); x.money(pay); return `The scrapyard gave you ${x.fmt(pay)}.`; } },
    ],
  },
];
