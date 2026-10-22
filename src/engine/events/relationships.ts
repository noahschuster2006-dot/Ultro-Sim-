import type { EventDef } from './types';
import { bindRel, check, npcId, who, whoFull } from './helpers';
import { attraction, compatibility, divorce, marry, onLoss, startDating } from '../systems/relationships';
import { commitCrime, openCase } from '../systems/legal';
import { injure } from '../systems/body';
import { trauma } from '../systems/mind';
import { makeNpc, npcTitle, ripple } from '../systems/npcs';
import { expose } from '../systems/addiction';
import type { Ctx } from '../ctx';

function candidateLabel(x: Ctx, key: string): string {
  const id = x.p[key] as string;
  const n = x.npc(id);
  if (!n) return 'Nobody';
  return `${n.firstName} ${n.lastName}, ${x.npcAge(n)} — ${npcTitle(x, n)} (looks ${Math.round(n.looks)}, attraction ${attraction(x, n)}, compatibility ${compatibility(x, n)})`;
}

/** Romance, family, friendship, betrayal and loss. */
export const RELATIONSHIP_EVENTS: EventDef[] = [
  {
    id: 'romance_candidates', cat: 'relationship', triggered: true,
    title: (x) => (x.p.via === 'arranged' ? 'Introductions' : 'Someone new'), text: 'Three people catch your interest. Who do you pursue?',
    choices: [
      { label: (x) => candidateLabel(x, 'a'), run: (x) => startDating(x, x.p.a as string) },
      { label: (x) => candidateLabel(x, 'b'), run: (x) => startDating(x, x.p.b as string) },
      { label: (x) => candidateLabel(x, 'c'), run: (x) => startDating(x, x.p.c as string) },
      { label: 'None of them', tags: ['cautious'], run: () => 'You decided to stay single for now.' },
    ],
  },
  {
    id: 'wedding', cat: 'relationship', triggered: true,
    title: 'The wedding', text: (x) => `You and ${who(x)} are getting married. What kind of wedding?`,
    choices: [
      { label: 'Small and simple', tags: ['cautious'], run: (x) => marry(x, npcId(x), { prenup: false, lavish: false }) },
      { label: 'Lavish celebration', tags: ['impulsive'], run: (x) => marry(x, npcId(x), { prenup: false, lavish: true }) },
      { label: 'Simple, with a prenup', when: (x) => x.netWorth() > 250000, run: (x) => { x.relMod(npcId(x), -6, -6); return marry(x, npcId(x), { prenup: true, lavish: false }); } },
      { label: 'Lavish, with a prenup', when: (x) => x.netWorth() > 250000, run: (x) => { x.relMod(npcId(x), -6, -6); return marry(x, npcId(x), { prenup: true, lavish: true }); } },
    ],
  },
  {
    id: 'affair_discovered', cat: 'relationship', triggered: true,
    title: 'Discovered', text: (x) => `${x.first(x.p.spouse as string)} found out about your affair with ${x.first(x.p.lover as string)}.`,
    choices: [
      { label: 'Beg for forgiveness', tags: ['help'], run: (x) => { const sp = x.p.spouse as string; const r = x.rel(sp); const lover = x.rel(x.p.lover as string); if (lover) lover.type = 'ex'; if (r && x.chance(r.affinity / 140 + x.stat('charisma') / 400)) { r.trust = Math.max(0, r.trust - 35); r.affinity -= 15; return 'They took you back. Trust will take years to rebuild.'; } return divorce(x, sp); } },
      { label: 'Leave your spouse for your lover', tags: ['impulsive'], run: (x) => { const t = divorce(x, x.p.spouse as string); const lover = x.rel(x.p.lover as string); if (lover) lover.type = 'partner'; return `${t} You moved in with ${x.first(x.p.lover as string)}.`; } },
      { label: 'Propose an open relationship', when: (x) => x.w.socialNorms > 60, run: (x) => { const r = x.rel(x.p.spouse as string); if (r && x.chance(0.25)) { r.meta.open = true; const lover = x.rel(x.p.lover as string); if (lover) lover.type = 'partner'; return 'Against all odds, they agreed. Polyamory it is.'; } return divorce(x, x.p.spouse as string); } },
    ],
  },
  {
    id: 'spouse_divorce', cat: 'relationship', triggered: true,
    title: 'Divorce papers', text: (x) => `${who(x)} wants a divorce.`,
    choices: [
      { label: 'Fight for the marriage', tags: ['help'], run: (x) => { const r = x.rel(npcId(x)); if (r && x.chance(0.35 + x.skill('conflictResolution') / 200)) { r.affinity += 25; return 'Counseling helped. You are trying again.'; } return divorce(x, npcId(x)); } },
      { label: 'Let them go', run: (x) => divorce(x, npcId(x)) },
    ],
  },
  {
    id: 'betrayal', cat: 'relationship', triggered: true,
    title: 'Betrayal', text: (x) => {
      const k = x.p.kind;
      if (k === 'businessPartner') return `${who(x)} has been embezzling from your business.`;
      if (k === 'coConspirator' || k === 'handler' || k === 'cellmate') return `${who(x)} has been talking to the police.`;
      if (k === 'spouse' || k === 'partner') return `${who(x)} has been cheating on you.`;
      if (k === 'mentor') return `${who(x)} published your work under their own name.`;
      return `${who(x)} has been spreading your secrets.`;
    },
    auto: (x) => {
      const k = x.p.kind;
      const r = x.rel(npcId(x));
      if (r) {
        r.trust = 0;
        r.affinity = Math.min(r.affinity, 10);
        if (!['spouse', 'partner'].includes(r.type)) r.type = 'enemy';
      }
      trauma(x, 10, 'betrayal');
      x.mods({ paranoia: 8 });
      x.remember('betrayed', `Betrayed by ${whoFull(x)}`, 40, npcId(x));
      if (k === 'businessPartner') { const loss = Math.round(Math.max(0, x.c.money) * 0.2); x.c.money -= loss; return `They stole ${x.fmt(loss)}.`; }
      if (k === 'coConspirator' || k === 'handler' || k === 'cellmate') { for (const kase of x.c.legal.cases) kase.evidence = Math.min(100, kase.evidence + 25); openCase(x, 'extortion', { label: 'Informant testimony' }); return 'Your cases just got a lot stronger.'; }
      if (k === 'spouse' || k === 'partner') { x.mods({ romanticCynicism: 12, happiness: -12 }); return 'You saw the messages.'; }
      if (k === 'mentor') { x.mod('professionalRep', -6); return 'They took the credit for your best work.'; }
      x.c.media.secrets.forEach((s) => { if (!s.exposed && x.chance(0.5)) s.exposed = true; });
      return 'Things you told in confidence are now public knowledge.';
    },
  },
  {
    id: 'enemy_strikes', cat: 'relationship', triggered: true, violent: true,
    title: 'Your enemy moves', text: (x) => `${whoFull(x)} has not forgotten. They are coming for you.`,
    choices: [
      { label: 'Strike back first', tags: ['violent', 'impulsive'], run: (x) => { const r = commitCrime(x, 'assault', npcId(x)); return r.text; } },
      { label: 'Make peace', tags: ['help', 'social'], run: (x) => { if (check(x, x.stat('charisma') + x.stat('empathy') / 2 + x.skill('conflictResolution'), 70)) { x.addRel(npcId(x), 'acquaintance', { affinity: 40, trust: 25 }); x.mods({ karma: 5 }); return 'A grudging truce.'; } return 'They spat at your feet.'; } },
      { label: 'Endure what comes', tags: ['cautious'], run: (x) => {
        const n = x.npc(npcId(x));
        const roll = x.r();
        if (n && (n.criminal ?? 0) > 40 && roll < 0.3) { trauma(x, 10, 'violence'); return `They had you beaten: ${injure(x, true)}`; }
        if (roll < 0.6) { x.mods({ publicImage: -6, professionalRep: -4 }); x.story('gossip', `Rumors swirl around ${x.c.firstName} ${x.c.lastName}`, -15); return 'They spread vicious rumors about you.'; }
        if (roll < 0.8 && x.c.career) { x.c.career.performance -= 15; return 'They sabotaged you at work.'; }
        x.c.legal.lawsuits.push({ id: x.uid('suit'), kind: 'defamation', role: 'defendant', otherParty: x.name(npcId(x)), amount: x.int(10000, 150000), strength: 50, years: 0 });
        return 'They sued you.';
      } },
    ],
  },
  {
    id: 'npc_death', cat: 'relationship', triggered: true,
    title: (x) => `${who(x)} has died`, text: (x) => `${whoFull(x)} died of ${x.npc(npcId(x))?.causeOfDeath ?? 'unknown causes'}.`,
    choices: [
      { label: 'Grieve openly', tags: ['help'], run: (x) => { onLoss(x, npcId(x)); x.mods({ depression: -3, wisdom: 2 }); return 'You let yourself cry. Friends brought food.'; } },
      { label: 'Throw yourself into work', run: (x) => { onLoss(x, npcId(x)); x.mods({ stress: 5 }); if (x.c.career) x.c.career.performance += 5; return 'Busy hands, aching heart.'; } },
      { label: 'Numb the pain', tags: ['impulsive'], run: (x) => { onLoss(x, npcId(x)); x.mods({ depression: 5 }); expose(x, 'alcohol', 1); return 'The bottle helps. Until it does not.'; } },
    ],
  },
  {
    id: 'parent_inheritance', cat: 'relationship', triggered: true,
    title: 'The will', text: (x) => `${who(x)}'s estate has been settled.`,
    auto: (x) => { const amt = Math.round((x.p.amount as number) || 0); if (amt > 0) x.money(amt); return amt > 0 ? `You inherited ${x.fmt(amt)}.` : 'They left nothing but debts and memories.'; },
  },
  // ------------------------------------------------------------------ random relationship events
  {
    id: 'r_friendInNeed', cat: 'relationship', minAge: 12, cooldown: 3, weight: (x) => (x.rels('friend', 'bestFriend').length ? 1.5 : 0),
    bind: bindRel('friend', 'bestFriend'),
    title: 'A friend in need', text: (x) => `${who(x)} is going through a hard time and asks for help.`,
    choices: [
      { label: 'Be there for them', tags: ['help'], run: (x) => { x.relMod(npcId(x), 15, 12); x.mods({ karma: 3, empathy: 2 }); x.remember('helpedSomeone', `Supported ${whoFull(x)} through a crisis`, 15, npcId(x)); return 'They will never forget it.'; } },
      { label: 'Lend them money', when: (x) => x.c.money > 3000, run: (x) => { const amt = Math.min(x.c.money, x.int(1000, 10000)); x.spend(amt); x.relMod(npcId(x), 12, 8); const r = x.rel(npcId(x)); if (r) r.meta.owesYou = amt; return `You lent ${x.fmt(amt)}.`; } },
      { label: 'Too busy', run: (x) => { x.relMod(npcId(x), -12, -8); return 'They noticed.'; } },
    ],
  },
  {
    id: 'r_newFriend', cat: 'relationship', minAge: 6, cooldown: 2, weight: (x) => (x.rels('friend', 'bestFriend').length < 3 ? 1.5 : 0.4),
    title: 'A kindred spirit', text: 'You hit it off with someone new.',
    choices: [
      { label: 'Make plans to hang out', tags: ['social'], run: (x) => { const npc = makeNpc(x, { age: Math.max(6, x.age < 18 ? x.age : x.age + x.int(-6, 6)) }); x.addRel(npc.id, 'friend', { affinity: 60, trust: 50 }); x.mod('loneliness', -6); return `${npc.firstName} is your new friend.`; } },
      { label: 'Keep to yourself', tags: ['cautious'], run: () => 'Maybe another time.' },
    ],
  },
  {
    id: 'r_jealousPartner', cat: 'relationship', minAge: 16, cooldown: 4, weight: (x) => (x.partner() && x.rels('friend', 'bestFriend').length ? 0.8 : 0),
    bind: (x) => { const p = x.partner(); return p ? { npcId: p.npcId } : null; },
    title: 'Jealousy', text: (x) => `${who(x)} is jealous of how much time you spend with your friends.`,
    choices: [
      { label: 'Reassure them', tags: ['help'], run: (x) => { x.relMod(npcId(x), 6, 6); return 'They calm down.'; } },
      { label: 'Spend less time with friends', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), 8); for (const r of x.rels('friend')) x.relMod(r.npcId, -6); x.mod('loneliness', 4); return 'Your friends drift away.'; } },
      { label: 'Tell them to deal with it', tags: ['impulsive'], run: (x) => { x.relMod(npcId(x), -12, -6); return 'A cold war at home.'; } },
    ],
  },
  {
    id: 'r_polyProposal', cat: 'relationship', minAge: 20, once: true, years: [1965, 99999], weight: (x) => (x.partner() && x.w.socialNorms > 65 ? 0.4 : 0),
    bind: (x) => { const p = x.partner(); return p ? { npcId: p.npcId } : null; },
    title: 'An open question', text: (x) => `${who(x)} asks whether you would consider an open relationship.`,
    choices: [
      { label: 'Agree', run: (x) => { const r = x.rel(npcId(x)); if (r) r.meta.open = true; x.mods({ romanticCynicism: -3 }); return 'You redefine what commitment means to you both.'; } },
      { label: 'Decline', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), -4); return 'They accept it — for now.'; } },
    ],
  },
  {
    id: 'r_siblingMoney', cat: 'relationship', minAge: 20, cooldown: 4, weight: (x) => (x.rels('sibling').length && x.c.money > 10000 ? 1 : 0),
    bind: bindRel('sibling'),
    title: 'Family money', text: (x) => `${who(x)} needs money to avoid losing their home.`,
    choices: [
      { label: 'Give it to them', tags: ['help'], run: (x) => { const amt = Math.min(x.c.money, x.int(5000, 40000)); x.spend(amt); x.relMod(npcId(x), 20, 15); x.mods({ karma: 4 }); return `You gave ${x.fmt(amt)}.`; } },
      { label: 'Lend it with interest', run: (x) => { const amt = Math.min(x.c.money, x.int(5000, 40000)); x.spend(amt); x.relMod(npcId(x), 5); const r = x.rel(npcId(x)); if (r) r.meta.owesYou = Math.round(amt * 1.1); return 'Family is family. Business is business.'; } },
      { label: 'Refuse', run: (x) => { x.relMod(npcId(x), -18, -10); return 'Thanksgiving will be awkward.'; } },
    ],
  },
  {
    id: 'r_parentSick', cat: 'relationship', minAge: 25, cooldown: 5, weight: (x) => (x.aliveParents().some((p) => x.npcAge(p) > 65) ? 1.5 : 0),
    bind: (x) => { const p = x.aliveParents().filter((q) => x.npcAge(q) > 65); return p.length ? { npcId: x.pick(p).id } : null; },
    title: 'Aging parent', text: (x) => `${who(x)} can no longer live alone.`,
    choices: [
      { label: 'Move them in with you', tags: ['help'], run: (x) => { x.relMod(npcId(x), 15, 10); x.mods({ stress: 8, karma: 5 }); return 'Exhausting and precious.'; } },
      { label: 'Pay for a care home', when: (x) => x.c.money > 30000, run: (x) => { x.spend(30000); x.relMod(npcId(x), 4); return 'They are well looked after.'; } },
      { label: 'Leave it to your siblings', run: (x) => { x.relMod(npcId(x), -10); for (const r of x.rels('sibling')) x.relMod(r.npcId, -10); return 'Resentment simmers.'; } },
    ],
  },
  {
    id: 'r_childTrouble', cat: 'relationship', minAge: 30, cooldown: 3, weight: (x) => (x.rels('child').some((r) => { const n = x.npc(r.npcId)!; const a = x.npcAge(n); return a >= 12 && a <= 25 && ((n.criminal ?? 0) > 20 || n.karma < -10); }) ? 2 : 0),
    bind: (x) => { const r = x.rels('child').find((q) => { const n = x.npc(q.npcId)!; const a = x.npcAge(n); return a >= 12 && a <= 25 && ((n.criminal ?? 0) > 20 || n.karma < -10); }); return r ? { npcId: r.npcId } : null; },
    title: 'Trouble at home', text: (x) => `${who(x)} was picked up by police for ${x.pick(['shoplifting', 'fighting', 'dealing', 'vandalism'])}.`,
    choices: [
      { label: 'Tough love', run: (x) => { const n = x.npc(npcId(x))!; n.criminal = Math.max(0, (n.criminal ?? 0) - 10); n.karma += 5; x.relMod(npcId(x), -8); return 'Grounded until they are thirty.'; } },
      { label: 'Sit down and really listen', tags: ['help'], run: (x) => { const n = x.npc(npcId(x))!; n.criminal = Math.max(0, (n.criminal ?? 0) - 15); n.karma += 8; x.relMod(npcId(x), 12, 10); return 'For the first time in years, they opened up.'; } },
      { label: 'Teach them to not get caught', tags: ['impulsive'], run: (x) => { const n = x.npc(npcId(x))!; n.criminal = (n.criminal ?? 0) + 15; n.upbringing = 'criminal'; x.relMod(npcId(x), 8); x.mods({ karma: -4 }); return 'The family business, passed down.'; } },
    ],
  },
  {
    id: 'r_childSuccess', cat: 'relationship', minAge: 35, cooldown: 4, weight: (x) => (x.rels('child').some((r) => (x.npc(r.npcId)?.career?.level ?? 0) >= 6) ? 1.5 : 0),
    bind: (x) => { const r = x.rels('child').find((q) => (x.npc(q.npcId)?.career?.level ?? 0) >= 6); return r ? { npcId: r.npcId } : null; },
    title: 'Proud parent', text: (x) => `${who(x)} is now ${npcTitle(x, x.npc(npcId(x))!)}.`,
    auto: (x) => { x.mods({ happiness: 8 }); x.relMod(npcId(x), 4); x.s.dynasty.prestige += 2; return 'You brag to anyone who will listen.'; },
  },
  {
    id: 'r_childWedding', cat: 'relationship', minAge: 40, cooldown: 3, weight: (x) => (x.rels('child').some((r) => x.npc(r.npcId)?.spouseId && !x.c.flags[`wedding_${r.npcId}`]) ? 2 : 0),
    bind: (x) => { const r = x.rels('child').find((q) => x.npc(q.npcId)?.spouseId && !x.c.flags[`wedding_${q.npcId}`]); return r ? { npcId: r.npcId } : null; },
    title: 'A wedding in the family', text: (x) => `${who(x)} married ${x.first(x.npc(npcId(x))?.spouseId)}.`,
    choices: [
      { label: 'Pay for the wedding', when: (x) => x.c.money > 20000, run: (x) => { x.c.flags[`wedding_${npcId(x)}`] = true; x.spend(20000); x.relMod(npcId(x), 15); return 'A beautiful day.'; } },
      { label: 'Give a heartfelt speech', tags: ['social'], run: (x) => { x.c.flags[`wedding_${npcId(x)}`] = true; x.relMod(npcId(x), 8); return 'Not a dry eye in the house.'; } },
      { label: 'Disapprove of the match', run: (x) => { x.c.flags[`wedding_${npcId(x)}`] = true; x.relMod(npcId(x), -20); return 'You sat stone-faced through the ceremony.'; } },
    ],
  },
  {
    id: 'r_nemesisRise', cat: 'relationship', minAge: 25, cooldown: 5, weight: (x) => (x.rels('nemesis', 'enemy').some((r) => (x.npc(r.npcId)?.career?.level ?? 0) >= 7 || (x.npc(r.npcId)?.fame ?? 0) > 40) ? 1.5 : 0),
    bind: (x) => { const r = x.rels('nemesis', 'enemy').find((q) => (x.npc(q.npcId)?.career?.level ?? 0) >= 7 || (x.npc(q.npcId)?.fame ?? 0) > 40); return r ? { npcId: r.npcId } : null; },
    title: 'Your nemesis rises', text: (x) => `${whoFull(x)} is now ${npcTitle(x, x.npc(npcId(x))!)}. They have power now — and a long memory.`,
    choices: [
      { label: 'Dig up dirt on them', run: (x) => { x.mods({ karma: -3 }); if (x.chance(0.5)) { const n = x.npc(npcId(x)); if (n) n.fame = Math.max(0, n.fame - 20); return 'You leaked it. Their star dims.'; } return 'They are clean. Annoyingly.'; } },
      { label: 'Extend an olive branch', tags: ['help'], run: (x) => { if (x.chance(0.4)) { x.addRel(npcId(x), 'acquaintance', { affinity: 40 }); return 'They accepted, warily.'; } return 'They let you know they remember everything.'; } },
      { label: 'Watch your back', tags: ['cautious'], run: (x) => { x.mod('paranoia', 5); return 'You install a few more locks.'; } },
    ],
  },
  {
    id: 'r_debtCollector', cat: 'relationship', minAge: 18, cooldown: 3, weight: (x) => (x.rels('debtHolder', 'blackmailer').length ? 2 : 0),
    bind: bindRel('debtHolder', 'blackmailer'),
    title: 'Pay up', text: (x) => (x.rel(npcId(x))?.type === 'blackmailer' ? `${who(x)} wants more money to keep your secret.` : `${who(x)} wants the money you owe them.`),
    choices: [
      { label: 'Pay', when: (x) => x.c.money > 5000, run: (x) => { const amt = Math.min(x.c.money, (x.rel(npcId(x))?.meta.debt as number) || x.int(5000, 30000)); x.spend(amt); const r = x.rel(npcId(x)); if (r?.type === 'debtHolder') { r.type = 'acquaintance'; r.meta.debt = 0; } return `You paid ${x.fmt(amt)}.`; } },
      { label: 'Refuse', tags: ['impulsive'], run: (x) => { const r = x.rel(npcId(x)); if (r?.type === 'blackmailer') { const s = x.c.media.secrets.find((q) => !q.exposed); if (s) s.exposed = true; x.mods({ publicImage: -10 }); return 'They went to the press.'; } r && (r.type = 'enemy'); return 'They will not forget this.'; } },
      { label: 'Threaten them', tags: ['violent'], run: (x) => { if (check(x, x.stat('fear') + x.skill('intimidation'), 55)) { const r = x.rel(npcId(x)); if (r) r.type = 'enemy'; x.mod('fear', 4); return 'They backed off.'; } return commitCrime(x, 'extortion').text; } },
    ],
  },
  {
    id: 'r_mentorAdvice', cat: 'relationship', minAge: 16, cooldown: 3, weight: (x) => (x.rels('mentor').length ? 1.2 : 0),
    bind: bindRel('mentor'),
    title: 'Mentor\'s counsel', text: (x) => `${who(x)} offers to open some doors for you.`,
    choices: [
      { label: 'Accept the introduction', tags: ['ambitious'], run: (x) => { x.mods({ professionalRep: 6 }); if (x.c.career) x.c.career.performance += 8; x.train('networking', 6); x.relMod(npcId(x), 4); return 'Doors open.'; } },
      { label: 'Ask for life advice instead', run: (x) => { x.mods({ wisdom: 5 }); x.relMod(npcId(x), 8); return 'What they told you stayed with you for life.'; } },
    ],
  },
  {
    id: 'r_protegeLoyal', cat: 'relationship', minAge: 40, cooldown: 4, weight: (x) => (x.rels('protege').length ? 1.2 : 0),
    bind: bindRel('protege'),
    title: 'Your protégé', text: (x) => `${who(x)} has outgrown you and wants to strike out on their own.`,
    choices: [
      { label: 'Give them your blessing', tags: ['help'], run: (x) => { x.relMod(npcId(x), 15, 15); x.mods({ wisdom: 3, karma: 3 }); const r = x.rel(npcId(x)); if (r) r.type = 'friend'; x.remember('helpedSomeone', `Launched ${whoFull(x)}'s career`, 20, npcId(x)); return 'They promise never to forget who made them.'; } },
      { label: 'Insist they stay', run: (x) => { x.relMod(npcId(x), -15, -15); return 'They stay, resentfully. Watch them.'; } },
    ],
  },
  {
    id: 'r_inLaws', cat: 'relationship', minAge: 20, cooldown: 4, weight: (x) => (x.rels('inLaw').length ? 1 : 0),
    bind: bindRel('inLaw'),
    title: 'In-laws', text: (x) => `${who(x)} criticizes how you run your household — again.`,
    choices: [
      { label: 'Bite your tongue', tags: ['cautious'], run: (x) => { x.mods({ stress: 3 }); x.relMod(npcId(x), 3); return 'You count to ten. Then to a hundred.'; } },
      { label: 'Tell them off', tags: ['impulsive'], run: (x) => { x.relMod(npcId(x), -20); const sp = x.spouse(); if (sp) x.relMod(sp.npcId, -6); return 'Your spouse is caught in the middle.'; } },
    ],
  },
  {
    id: 'r_neglectedChild', cat: 'relationship', minAge: 25, cooldown: 3, weight: (x) => (x.rels('child').some((r) => r.affinity < 35 && x.npcAge(x.npc(r.npcId)!) < 18) ? 2 : 0),
    bind: (x) => { const r = x.rels('child').find((q) => q.affinity < 35 && x.npcAge(x.npc(q.npcId)!) < 18); return r ? { npcId: r.npcId } : null; },
    title: 'A child left behind', text: (x) => `${who(x)}'s teacher calls. They have been acting out and asking whether you even care.`,
    choices: [
      { label: 'Clear your schedule for them', tags: ['help'], run: (x) => { x.relMod(npcId(x), 20, 15); const n = x.npc(npcId(x)); if (n) { n.upbringing = n.upbringing === 'neglected' ? 'balanced' : n.upbringing; n.favor = (n.favor ?? 0) + 2; } if (x.c.career) x.c.career.performance -= 5; return 'It is not too late.'; } },
      { label: 'Send money instead', run: (x) => { x.spend(Math.min(Math.max(0, x.c.money), 2000)); x.relMod(npcId(x), 2); return 'They wanted you, not a check.'; } },
    ],
  },
  {
    id: 'r_reconnectEx', cat: 'relationship', minAge: 25, cooldown: 8, weight: (x) => (x.rels('ex').length && !x.partner() ? 0.8 : 0),
    bind: bindRel('ex'),
    title: 'An old flame', text: (x) => `You ran into ${who(x)}. The old spark is still there.`,
    choices: [
      { label: 'Rekindle it', tags: ['impulsive'], run: (x) => { const r = x.rel(npcId(x)); if (r && x.chance(0.5)) { r.type = 'partner'; r.affinity = 60; return 'Second chances.'; } return 'They are with someone else now.'; } },
      { label: 'Leave the past in the past', tags: ['cautious'], run: (x) => { x.mod('wisdom', 2); return 'A warm hello, a clean goodbye.'; } },
    ],
  },
  {
    id: 'r_familyFeud', cat: 'relationship', minAge: 18, cooldown: 6, weight: (x) => (x.rels('sibling').length >= 2 ? 0.8 : 0),
    bind: bindRel('sibling'),
    title: 'Family feud', text: (x) => `${who(x)} and your other siblings are not speaking. Everyone wants you to take a side.`,
    choices: [
      { label: `Mediate`, tags: ['help', 'social'], run: (x) => { if (check(x, x.skill('conflictResolution') + x.stat('empathy'), 60)) { for (const r of x.rels('sibling')) x.relMod(r.npcId, 8); return 'You brokered a family peace.'; } return 'They are all mad at you now.'; } },
      { label: (x) => `Side with ${who(x)}`, run: (x) => { x.relMod(npcId(x), 15); for (const r of x.rels('sibling')) if (r.npcId !== npcId(x)) x.relMod(r.npcId, -12); return 'Battle lines drawn.'; } },
      { label: 'Stay out of it', tags: ['cautious'], run: () => 'You skip the holidays this year.' },
    ],
  },
  {
    id: 'r_marriedInto', cat: 'relationship', minAge: 20, cooldown: 6, violent: true, weight: (x) => (x.c.relationships.some((r) => r.meta.inherited && ['rival', 'enemy'].includes(r.type)) ? 1.2 : 0),
    bind: (x) => { const r = x.c.relationships.find((q) => q.meta.inherited && ['rival', 'enemy'].includes(q.type) && x.npc(q.npcId)?.alive); return r ? { npcId: r.npcId } : null; },
    title: 'Old blood', text: (x) => `${whoFull(x)} — an enemy of your spouse's family — has decided the feud includes you.`,
    choices: [
      { label: 'Meet them face to face', tags: ['social'], run: (x) => { if (check(x, x.stat('charisma') + x.skill('diplomacy'), 65)) { x.addRel(npcId(x), 'acquaintance', { affinity: 40 }); return 'You ended a feud older than you.'; } ripple(x, npcId(x), -10, 'Family feud'); return 'The feud deepens.'; } },
      { label: 'Defend your new family', tags: ['violent'], run: (x) => commitCrime(x, 'assault', npcId(x)).text },
    ],
  },
];
