import type { Ctx } from '../ctx';
import { CURSE_BY_ID, PACTS, PACT_COSTS, SOCIETIES, SOCIETY_BY_ID } from '../data/occult';
import { RELIGION_BY_ID } from '../data/countries';
import { CAREER_BY_ID } from '../data/careers';
import { startCareer } from './careers';
import { lifespan } from './body';

export function addCurse(x: Ctx, id: string, level: number, source: string): void {
  const ex = x.c.spiritual.curses.find((c) => c.id === id);
  if (ex) ex.level = Math.min(5, ex.level + level);
  else x.c.spiritual.curses.push({ id, level, source });
  x.log(`🕯️ A curse settles on you: ${CURSE_BY_ID[id]?.name ?? id}.`, 'bad');
  x.remember('cursed', `Cursed: ${CURSE_BY_ID[id]?.name ?? id}`, 45);
}

export function breakCurse(x: Ctx, id: string): void {
  x.c.spiritual.curses = x.c.spiritual.curses.filter((c) => c.id !== id);
  x.log(`✨ The ${CURSE_BY_ID[id]?.name ?? id} is broken.`, 'major');
  x.remember('curseBroken', `Broke the ${CURSE_BY_ID[id]?.name ?? id}`, 55);
}

export function addBlessing(x: Ctx, id: string, level: number, source: string): void {
  const ex = x.c.spiritual.blessings.find((b) => b.id === id);
  if (ex) ex.level = Math.min(5, ex.level + level);
  else x.c.spiritual.blessings.push({ id, level, source });
}

/**
 * The spiritual layer: divine favor accumulates from karma and faith, demonic
 * pact offers come to the deeply sinful, curses bite, societies recruit.
 */
export function spiritTick(x: Ctx): void {
  const c = x.c;
  const S = c.spiritual;
  const karma = x.stat('karma');
  const faith = x.stat('faith');
  // Divine favor.
  if (karma > 70 && faith > 60) x.mod('divineFavor', (karma - 70) / 10 + (faith - 60) / 10 + 1);
  else x.mod('divineFavor', -1);
  const df = x.stat('divineFavor');
  if (df >= 25 && x.chance(0.25)) {
    const boon = x.pick([
      () => { x.money(x.int(200, 3000)); return 'You found money on the street — exactly what you needed.'; },
      () => { x.mod('health', 4); return 'A cough cleared up overnight. Coincidence?'; },
      () => { x.mod('happiness', 4); return 'A stranger said exactly the words you needed to hear.'; },
    ]);
    x.log(`✨ ${boon()}`, 'good');
  }
  if (df >= 100 && x.chance(0.5)) {
    const upcoming = c.chains.slice(0, 3).map((ch) => ch.chainId);
    S.visions = upcoming.length ? upcoming.map((id) => `A vision warns of what is coming (${id.replace(/_/g, ' ')}).`) : ['A vision shows your descendants prospering.'];
    x.log('👁️ You received a prophetic vision. (See the Spirit panel.)', 'major');
  }
  // Faith drifts with the society around you.
  const dom = x.w.religionDominance;
  const target = c.religionId === 'none' ? 10 : dom === 'theocracy' ? 70 : dom === 'stateReligion' ? 60 : dom === 'pluralism' ? 45 : 32;
  x.mod('faith', (target - faith) * 0.03);
  x.mod('sin', -0.5);
  if (c.career && CAREER_BY_ID[c.career.careerId]?.tags.includes('religious')) x.mod('spiritualAuthority', 1);
  else x.mod('spiritualAuthority', -0.5);

  // Demonic pact offers.
  if (karma < -70 && S.rituals >= 1 && S.pacts.length < 3 && !S.soulSold && x.chance(c.spiritual.societies.includes('ashenCoven') ? 0.5 : 0.25) && !x.queued('pact_offer')) {
    const avail = PACTS.filter((p) => !S.pacts.some((q) => q.id === p.id));
    if (avail.length) x.queue('pact_offer', { pactId: x.pick(avail).id });
  }
  // Curse effects.
  if (x.curse('misfortune') && x.chance(0.2)) {
    x.mod('health', -6);
    x.log('Misfortune strikes again: a freak accident.', 'bad');
  }
  // Society invites.
  for (const soc of SOCIETIES) {
    if (S.societies.includes(soc.id) || S.invites.includes(soc.id) || x.year < soc.fromYear || c.age < 21) continue;
    const ok =
      (soc.id === 'compassLodge' && (x.netWorth() > 2000000 || x.stat('professionalRep') > 70 || !!c.politics.office)) ||
      (soc.id === 'ninefoldEye' && (x.stat('fame') >= 70 || x.netWorth() > 50000000)) ||
      (soc.id === 'ashenCoven' && karma < -40 && x.skill('ritual') >= 15) ||
      (soc.id === 'antlerOrder' && x.stat('paranormal') >= 40);
    if (ok && x.chance(0.3)) {
      S.invites.push(soc.id);
      x.queue('society_invite', { societyId: soc.id });
      break;
    }
  }
  // Society membership.
  for (const id of S.societies) {
    if (id === 'compassLodge') {
      x.spend(5000);
      x.mods({ professionalRep: 1, politicalApproval: 1 });
    }
    if (id === 'ninefoldEye' && x.chance(0.15)) x.queue('society_demand', { societyId: id });
    if (id === 'ashenCoven') x.mods({ sin: 2, paranormal: 1 });
    if (id === 'antlerOrder') x.mods({ paranormal: 2, wisdom: 1 });
  }
  // A founded religion grows or withers.
  if (S.foundedReligion) {
    const growth = (x.stat('charisma') + x.stat('spiritualAuthority') - 80) / 100;
    S.followers = Math.max(0, Math.round(S.followers * (1 + growth * x.float(0.2, 0.8)) + x.int(0, 50)));
    x.money(S.followers * 40);
    x.mod('spiritualAuthority', S.followers > 1000 ? 2 : 0.5);
    if (S.followers > 5000) x.mod('fame', 1);
  }
}

export function pray(x: Ctx): string {
  x.mods({ faith: 2.5, stress: -3, sin: -1 });
  x.train('prayer', 4);
  const df = x.stat('divineFavor');
  if (df >= 75 && x.c.bio.chronic.length && x.chance(0.25)) {
    const cured = x.c.bio.chronic.shift()!;
    x.mod('divineFavor', -30);
    x.remember('miracleHealing', 'Healed by a miracle', 60);
    return `A miracle! Your ${cured.id.replace(/([A-Z])/g, ' $1').toLowerCase()} is gone. Doctors cannot explain it.`;
  }
  if (df >= 50 && x.chance(0.5)) {
    x.pick([() => x.mod('happiness', 8), () => x.mod('health', 6), () => x.money(x.int(1000, 10000))])();
    return 'Your prayer was answered.';
  }
  return 'You prayed and felt a little calmer.';
}

export function performRitual(x: Ctx): string {
  if (x.skill('ritual') < 10 && x.stat('paranormal') < 20) return 'You do not know how. (Ritual skill 10+ or paranormal sensitivity 20+)';
  x.c.spiritual.rituals++;
  x.train('ritual', 5);
  x.mods({ paranormal: 4, sin: 2, karma: x.stat('karma') < 0 ? -4 : 0 });
  if (x.stat('karma') < -40) x.train('demonology', 3);
  if (x.chance(0.12)) {
    x.mods({ trauma: 6, paranoia: 6 });
    return 'Something answered the ritual. You have not slept properly since.';
  }
  return x.stat('karma') < -60 ? 'The candles guttered black. Something is listening to you now.' : 'The ritual left the room smelling of smoke and something older.';
}

export function exorcism(x: Ctx): string {
  const cost = 8000;
  const curse = x.c.spiritual.curses[0];
  if (!curse) return 'You have no curse to break.';
  const self = x.skill('exorcism') >= 30;
  if (!self && !x.spend(cost)) return `An exorcist charges ${x.fmt(cost)}.`;
  const p = 0.35 + (self ? x.skill('exorcism') / 200 : 0.1) + x.stat('faith') / 300 - curse.level * 0.05;
  if (x.chance(p)) {
    breakCurse(x, curse.id);
    return `The exorcism worked. The ${CURSE_BY_ID[curse.id]?.name ?? curse.id} is broken.`;
  }
  x.mods({ trauma: 4, faith: -3 });
  return 'The exorcism failed. The curse clings on.';
}

export function foundReligion(x: Ctx): string {
  const S = x.c.spiritual;
  if (S.foundedReligion) return 'You already lead a faith.';
  if (x.stat('charisma') < 60 || (x.stat('spiritualAuthority') < 25 && x.c.career?.careerId !== 'cultLeader' && x.skill('prophecy') < 30)) return 'You need charisma 60+ and spiritual authority 25+ (or a prophetic gift).';
  const name = `the Church of ${x.pick(['the Inner Light', 'the New Dawn', 'the Seventh Seal', 'the Living Flame', 'Eternal Harmony', 'the Open Sky'])}`;
  S.foundedReligion = name;
  S.followers = x.int(10, 60);
  x.mods({ fame: 5, spiritualAuthority: 10, ego: 6 });
  x.remember('foundedReligion', `Founded ${name}`, 65);
  x.s.dynasty.institutions.push({ kind: 'church', name });
  return `You founded ${name}. ${S.followers} believers follow you.`;
}

export function joinSociety(x: Ctx, id: string): string {
  const S = x.c.spiritual;
  if (!S.invites.includes(id)) return 'You have not been invited.';
  S.invites = S.invites.filter((i) => i !== id);
  S.societies.push(id);
  const soc = SOCIETY_BY_ID[id];
  x.remember('society', `Joined ${soc.name}`, 35);
  if (id === 'ashenCoven') x.mods({ sin: 5, karma: -5 });
  if (id === 'ninefoldEye') x.mods({ paranoia: 5 });
  x.secret(`society_${id}`, `Membership of ${soc.name}`, id === 'ashenCoven' ? 7 : 3);
  return `You swore the oaths of ${soc.name}.`;
}

export function acceptPact(x: Ctx, pactId: string, costId: string): string {
  const c = x.c;
  const pact = PACTS.find((p) => p.id === pactId);
  const cost = PACT_COSTS.find((p) => p.id === costId);
  if (!pact || !cost) return 'The demon is not amused.';
  c.spiritual.pacts.push({ id: pact.id, name: pact.name, boon: pact.boon, cost: cost.name, age: c.age });
  x.mods({ sin: 15, karma: -15, paranormal: 10 });
  switch (pact.id) {
    case 'wealth':
      x.money(5000000);
      c.flags.pactGoldUntil = c.age + 10;
      break;
    case 'fame':
      x.mod('fame', 60);
      break;
    case 'beauty':
      x.set('looks', 100);
      c.flags.pactBeauty = true;
      break;
    case 'power':
      x.mods({ politicalApproval: 30, criminalRep: 30, fear: 30 });
      break;
    case 'longevity':
      x.set('health', 100);
      c.bio.chronic = [];
      break;
    case 'vengeance': {
      const foe = x.rels('nemesis', 'enemy', 'rival')[0];
      if (foe) {
        const n = x.npc(foe.npcId)!;
        n.alive = false;
        n.deathYear = x.year;
        n.causeOfDeath = 'something no coroner could name';
      }
      break;
    }
  }
  let costText = '';
  if (cost.id === 'family') {
    const fam = x.rels('parent', 'sibling', 'child', 'spouse').map((r) => x.npc(r.npcId)!).filter(Boolean);
    if (fam.length) {
      const victim = x.pick(fam);
      victim.alive = false;
      victim.deathYear = x.year;
      victim.causeOfDeath = 'a sudden, inexplicable death';
      costText = ` ${victim.firstName} died that same night.`;
      x.mods({ trauma: 20, depression: 15 });
    }
  } else if (cost.id === 'years') {
    c.flags.pactYears = ((c.flags.pactYears as number) || 0) + 1;
    costText = ` Your expected lifespan is now ${lifespan(x).final}.`;
  } else {
    const curse = x.pick(['poverty', 'violence', 'infertility', 'madness']);
    x.s.dynasty.curses.push({ id: curse, level: 3, source: pact.name });
    addCurse(x, curse, 1, pact.name);
    costText = ` Your bloodline now bears the ${CURSE_BY_ID[curse].name}.`;
  }
  x.remember('pact', `Made the ${pact.name}`, 75);
  return `The pact is sealed: ${pact.boon}${costText}`;
}

export function sellSoul(x: Ctx): string {
  const c = x.c;
  c.spiritual.soulSold = true;
  x.mods({ sin: 40, karma: -50, fear: 40, fame: 20, paranormal: 30 });
  x.money(10000000);
  startCareer(x, CAREER_BY_ID.demonLord, 3);
  x.remember('soulSold', 'Sold your soul', 100);
  return 'You sold your soul. Power floods through you. You are now on the demon lord path — and damnation awaits.';
}

export function religionName(x: Ctx): string {
  if (x.c.spiritual.foundedReligion) return x.c.spiritual.foundedReligion;
  return RELIGION_BY_ID[x.c.religionId]?.name ?? 'None';
}
