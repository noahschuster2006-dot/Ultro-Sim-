import type { EventDef } from './types';
import { bindRel, check, npcId, who } from './helpers';
import { expose, addictionOf, attemptRecovery } from '../systems/addiction';
import { onset, trauma, therapyAvailable, medicationAvailable } from '../systems/mind';
import { diagnose, injure, bmiCategory } from '../systems/body';
import { CHRONIC_BY_ID } from '../data/conditions';
import { ADDICTION_BY_KIND } from '../data/conditions';
import type { Ctx } from '../ctx';

function untreatedChronic(x: Ctx) {
  return x.c.bio.chronic.find((c) => !c.managed);
}

/** Physical health, mental health and addiction events. */
export const HEALTH_EVENTS: EventDef[] = [
  // ------------------------------------------------------------------ mental health
  {
    id: 'mental_crisis', cat: 'mental', minAge: 12, cooldown: 2, weight: (x) => (x.stat('depression') >= 70 ? 6 : 0),
    title: 'The darkest stretch', text: 'Everything feels hopeless and you cannot see a way forward. You do not have to carry this alone.',
    choices: [
      { label: 'Reach out to someone you trust', tags: ['help'], run: (x) => {
        x.c.mental.crises++;
        const r = x.rels('bestFriend', 'spouse', 'partner', 'parent', 'sibling', 'friend').sort((a, b) => b.affinity - a.affinity)[0];
        x.mods({ depression: -18, loneliness: -12, anxiety: -6 });
        if (r) { x.relMod(r.npcId, 10, 15); return `${x.first(r.npcId)} came over that night and stayed. Saying it out loud was the first step.`; }
        return 'An old acquaintance answered the phone and listened for hours.';
      } },
      { label: (x) => (x.year >= 1960 ? 'Call a crisis line' : 'Go to the church or temple'), tags: ['help'], run: (x) => { x.c.mental.crises++; x.mods({ depression: -15, anxiety: -8 }); if (x.year < 1960) x.mod('faith', 6); x.remember('crisisSupport', 'Got through a mental-health crisis with help', 40); return x.year >= 1960 ? 'A calm voice talked with you until the worst passed, and helped you find a doctor.' : 'A cleric sat with you until dawn.'; } },
      { label: 'Go to a doctor or hospital', tags: ['help'], when: (x) => x.year >= 1900, run: (x) => { x.c.mental.crises++; if (therapyAvailable(x.year)) x.c.mental.therapy = true; if (medicationAvailable(x.year)) x.c.mental.medication = true; x.mods({ depression: -22, anxiety: -6 }); return 'You were admitted for a short stay. Treatment has started.'; } },
      { label: 'Keep it to yourself', run: (x) => { x.c.mental.crises++; x.mods({ loneliness: 6 }); onset(x, 'depression'); return 'You got through the night. Please do not keep carrying this alone — the Mind panel has treatment options.'; } },
    ],
  },
  {
    id: 'panic_attack', cat: 'mental', minAge: 10, cooldown: 2, weight: (x) => (x.stat('anxiety') >= 80 ? 4 : 0),
    title: 'Panic attack', text: 'Your heart pounds, your chest tightens, you are sure you are dying.',
    choices: [
      { label: 'Breathe through it', tags: ['cautious'], run: (x) => { x.mods({ anxiety: -5, resilience: 2 }); x.train('meditation', 3); return 'In for four, hold for seven, out for eight.'; } },
      { label: 'Go to the emergency room', run: (x) => { x.spend(Math.min(Math.max(0, x.c.money), 1500)); x.mods({ anxiety: -8 }); return 'Not a heart attack. The doctor suggests therapy.'; } },
      { label: 'Drink to calm down', tags: ['impulsive'], run: (x) => { expose(x, 'alcohol', 0.5); x.mod('anxiety', -4); return 'It works. That is the problem.'; } },
    ],
  },
  {
    id: 'ptsd_flashback', cat: 'mental', minAge: 10, cooldown: 2, weight: (x) => (x.c.mental.conditions.some((m) => m.id === 'ptsd') ? 3 : 0),
    title: 'Flashback', text: 'A car backfires and suddenly you are back there.',
    choices: [
      { label: 'Start trauma therapy', tags: ['help'], when: (x) => therapyAvailable(x.year), run: (x) => { x.c.mental.therapy = true; x.mods({ trauma: -10 }); return 'You start the slow work of healing.'; } },
      { label: 'Join a veterans or survivors group', tags: ['help'], run: (x) => { x.c.mental.supportGroup = true; x.mods({ trauma: -6, loneliness: -6 }); return 'People who understand without explanation.'; } },
      { label: 'Push it down', run: (x) => { x.mods({ aggression: 3, anxiety: 4 }); return 'You snap at everyone for a week.'; } },
    ],
  },
  {
    id: 'manic_episode', cat: 'mental', minAge: 14, cooldown: 2, weight: (x) => (x.stat('mania') >= 65 ? 3 : 0),
    title: 'Electric', text: 'You have not slept in three days and you have never felt more brilliant.',
    choices: [
      { label: 'Launch a grand plan', tags: ['impulsive', 'ambitious'], run: (x) => { const spend = Math.min(Math.max(0, x.c.money), x.int(5000, 50000)); x.spend(spend); x.mods({ creativity: 6, confidence: 6 }); return x.chance(0.25) ? 'Somehow it worked. People call you a visionary.' : `You spent ${x.fmt(spend)} on a plan that made sense at 4 a.m.`; } },
      { label: 'Ask someone to check on you', tags: ['help', 'cautious'], run: (x) => { x.mods({ mania: -20 }); if (medicationAvailable(x.year)) x.c.mental.medication = true; return 'A doctor recognizes the pattern.'; } },
    ],
  },
  {
    id: 'paranoid_misread', cat: 'mental', minAge: 14, cooldown: 2, weight: (x) => (x.stat('paranoia') >= 70 ? 3 : 0),
    bind: bindRel('friend', 'bestFriend', 'spouse', 'partner', 'sibling', 'colleague'),
    title: 'Whispers', text: (x) => `You saw ${who(x)} whispering on the phone. They hung up when you walked in.`,
    choices: [
      { label: 'Confront them', tags: ['impulsive'], run: (x) => { x.relMod(npcId(x), -18, -15); return 'They were planning your birthday party. Now they are hurt.'; } },
      { label: 'Secretly follow them', tags: ['impulsive'], run: (x) => { x.relMod(npcId(x), -8, -8); x.mod('paranoia', 4); return 'You found nothing. You are not reassured.'; } },
      { label: 'Ask yourself if this is real', tags: ['cautious'], run: (x) => { x.mods({ paranoia: -8, wisdom: 2 }); return 'It was nothing. You are learning to notice the spiral.'; } },
    ],
  },
  {
    id: 'ego_trip', cat: 'mental', minAge: 18, cooldown: 3, weight: (x) => (x.stat('ego') >= 85 ? 2.5 : 0),
    title: 'Above it all', text: 'Everyone around you is an idiot. Why does nobody see how important you are?',
    choices: [
      { label: 'Demand recognition', tags: ['impulsive'], run: (x) => { for (const r of x.c.relationships) r.affinity = Math.max(0, r.affinity - 3); x.mods({ publicImage: -4 }); if (x.stat('ego') > 90) onset(x, 'npd'); return 'You made a scene. People are tired of you.'; } },
      { label: 'Listen to criticism', tags: ['help'], run: (x) => { x.mods({ ego: -12, wisdom: 4 }); return 'It stung. It was true.'; } },
    ],
  },
  {
    id: 'therapy_breakthrough', cat: 'mental', minAge: 12, cooldown: 4, weight: (x) => (x.c.mental.therapy ? 1.5 : 0),
    title: 'Breakthrough', text: 'In therapy, you finally connect a pattern in your life to where it started.',
    auto: (x) => { x.mods({ trauma: -12, anxiety: -8, depression: -8, wisdom: 4, resilience: 3 }); x.c.flags.unprocessedViolence = false; return 'Something unknots.'; },
  },
  {
    id: 'insomnia_nights', cat: 'mental', minAge: 16, cooldown: 3, weight: (x) => (x.stat('stress') > 70 ? 1.5 : 0),
    title: '3 a.m.', text: 'Another night staring at the ceiling.',
    choices: [
      { label: 'Sleeping pills', when: (x) => x.year > 1920, run: (x) => { x.mods({ energy: 6 }); if (x.chance(0.15)) expose(x, 'opioids', 0.5); return 'Sleep, chemically.'; } },
      { label: 'Fix your routine', tags: ['cautious'], run: (x) => { x.mods({ stress: -8, energy: 4, discipline: 2 }); return 'No screens, same bedtime. It slowly works.'; } },
      { label: 'Work through the night', tags: ['ambitious'], run: (x) => { if (x.c.career) x.c.career.performance += 4; x.mods({ health: -3, stress: 3 }); return 'Productive. Unsustainable.'; } },
    ],
  },
  // ------------------------------------------------------------------ addiction
  {
    id: 'add_intervention', cat: 'health', minAge: 14, cooldown: 3, weight: (x) => (x.c.addictions.some((a) => a.active && a.severity >= 3) && x.rels('parent', 'spouse', 'sibling', 'bestFriend', 'child').length ? 2.5 : 0),
    bind: (x) => { const a = x.c.addictions.find((q) => q.active && q.severity >= 3); return a ? { kind: a.kind } : null; },
    title: 'Intervention', text: (x) => `Your family sits you down. They are worried about your ${ADDICTION_BY_KIND[x.p.kind as keyof typeof ADDICTION_BY_KIND].name.toLowerCase()} problem.`,
    choices: [
      { label: 'Agree to treatment', tags: ['help'], run: (x) => { const def = ADDICTION_BY_KIND[x.p.kind as keyof typeof ADDICTION_BY_KIND]; const opt = def.recoveryOptions.filter((o) => x.year >= o.fromYear).sort((a, b) => b.power - a.power).find((o) => x.c.money >= o.cost) ?? def.recoveryOptions[def.recoveryOptions.length - 1]; return attemptRecovery(x, def.kind, opt.id).text; } },
      { label: 'Storm out', tags: ['impulsive'], run: (x) => { for (const r of x.rels('parent', 'spouse', 'sibling', 'bestFriend', 'child')) x.relMod(r.npcId, -10, -10); return 'You do not have a problem. You can stop whenever you want.'; } },
    ],
  },
  {
    id: 'add_overdoseScare', cat: 'health', minAge: 14, cooldown: 2, weight: (x) => (x.c.addictions.some((a) => a.active && (a.kind === 'opioids' || a.kind === 'stimulants') && a.severity >= 3) ? 2 : 0),
    title: 'Overdose', text: 'You woke up in an ambulance. A paramedic says you were not breathing.',
    choices: [
      { label: 'This is the wake-up call', tags: ['help'], run: (x) => { const a = x.c.addictions.find((q) => q.active && (q.kind === 'opioids' || q.kind === 'stimulants'))!; const def = ADDICTION_BY_KIND[a.kind]; const opt = def.recoveryOptions.filter((o) => x.year >= o.fromYear && x.c.money >= o.cost).sort((p, q) => q.power - p.power)[0] ?? def.recoveryOptions[def.recoveryOptions.length - 1]; x.mod('health', -10); return attemptRecovery(x, a.kind, opt.id).text; } },
      { label: 'Use again next week', tags: ['impulsive'], run: (x) => { x.mods({ health: -12 }); const a = x.c.addictions.find((q) => q.active && (q.kind === 'opioids' || q.kind === 'stimulants')); if (a) a.severity = Math.min(5, a.severity + 0.5); return 'You know where this road ends.'; } },
    ],
  },
  {
    id: 'add_painkillers', cat: 'health', minAge: 16, cooldown: 4, years: [1900, 99999], weight: (x) => (x.stat('pain') > 35 ? 2 : 0),
    title: 'Chronic pain', text: 'Your doctor offers a prescription for strong painkillers.',
    choices: [
      { label: 'Take them as needed', run: (x) => { x.mod('pain', -20); const a = expose(x, 'opioids', 0.9); return a ? 'The pain is gone. So is your control.' : 'Relief, finally.'; } },
      { label: 'Physical therapy instead', tags: ['cautious'], run: (x) => { x.spend(Math.min(Math.max(0, x.c.money), 3000)); x.mods({ pain: -12, fitness: 2 }); return 'Slow and painful, but it works.'; } },
    ],
  },
  {
    id: 'add_gamblingSpiral', cat: 'health', minAge: 18, cooldown: 2, weight: (x) => ((addictionOf(x, 'gambling')?.active ? 2.5 : 0) + (x.c.assets.some((a) => a.typeId === 'casino') ? 0.3 : 0)),
    title: 'Chasing losses', text: 'You are down big. One more bet would win it all back.',
    choices: [
      { label: 'Bet the house', tags: ['impulsive'], run: (x) => { const stake = Math.max(1000, Math.round(Math.max(0, x.c.money) * 0.5)); if (x.chance(0.35)) { x.money(stake); expose(x, 'gambling', 0.4); return `You won ${x.fmt(stake)}! The rush is incredible.`; } x.c.money -= Math.min(Math.max(0, x.c.money), stake); x.c.debt += Math.max(0, stake - Math.max(0, x.c.money)); expose(x, 'gambling', 0.3); return 'Lost. Everything.'; } },
      { label: 'Walk away', tags: ['cautious'], run: (x) => { x.mods({ willpower: 4 }); const a = addictionOf(x, 'gambling'); if (a) a.severity = Math.max(0, a.severity - 0.4); return 'The hardest walk of your life.'; } },
    ],
  },
  {
    id: 'add_casino', cat: 'health', minAge: 18, cooldown: 4, years: [1700, 99999], weight: 0.5,
    title: 'Casino night', text: 'Friends drag you to a casino.',
    choices: [
      { label: 'Play the tables', tags: ['impulsive'], run: (x) => { const net = x.int(-2000, 2500); x.money(net); expose(x, 'gambling', net > 0 ? 0.6 : 0.3); return net > 0 ? `You won ${x.fmt(net)}. You want to come back.` : `You lost ${x.fmt(-net)}.`; } },
      { label: 'Just watch', tags: ['cautious'], run: () => 'Free drinks, no losses.' },
    ],
  },
  {
    id: 'add_fameDrugs', cat: 'health', minAge: 16, cooldown: 3, weight: (x) => (x.stat('fame') > 45 ? 1.2 : 0),
    title: 'The afterparty', text: 'Backstage, someone offers you a line.',
    choices: [
      { label: 'Why not', tags: ['impulsive'], run: (x) => { const a = expose(x, 'stimulants', 1); x.mods({ mania: 15, confidence: 4 }); if (x.chance(0.15)) x.secret('drugs', 'Drug use', 4); return a ? 'You need it to perform now.' : 'You felt like a god until sunrise.'; } },
      { label: 'Decline', tags: ['cautious'], run: (x) => { x.mod('willpower', 2); return 'You went home early and slept.'; } },
    ],
  },
  {
    id: 'add_violenceEscalation', cat: 'health', minAge: 16, cooldown: 3, violent: true, weight: (x) => (addictionOf(x, 'violence')?.active ? 2 : 0),
    title: 'The itch', text: 'You have not been in a fight in months and you feel like you will explode.',
    choices: [
      { label: 'Go looking for trouble', tags: ['violent', 'impulsive'], run: (x) => { expose(x, 'violence', 0.4); x.mods({ karma: -4 }); if (x.chance(0.4)) return `It ended badly: ${injure(x, true)}`; return 'The release is brief.'; } },
      { label: 'Hit the heavy bag instead', tags: ['cautious'], run: (x) => { x.train('boxing', 5); x.mods({ aggression: -3 }); const a = addictionOf(x, 'violence'); if (a) a.severity = Math.max(0, a.severity - 0.3); return 'Sweat, not blood.'; } },
    ],
  },
  {
    id: 'add_social', cat: 'health', minAge: 18, cooldown: 4, weight: (x) => (x.stat('stress') > 55 || x.hasMemory('loss_spouse') || x.hasMemory('loss_child') ? 1 : 0.3),
    title: 'One drink', text: 'It has been a brutal week. A drink would take the edge off.',
    choices: [
      { label: 'Have a few', run: (x) => { const a = expose(x, 'alcohol', 0.45); x.mods({ stress: -6 }); return a ? 'A few became a habit.' : 'Better.'; } },
      { label: 'Go for a run instead', tags: ['cautious'], run: (x) => { x.mods({ stress: -5, fitness: 1 }); return 'Endorphins, no hangover.'; } },
    ],
  },
  // ------------------------------------------------------------------ physical health
  {
    id: 'h_diagnosisChoice', cat: 'health', minAge: 1, cooldown: 2, weight: (x) => (untreatedChronic(x) ? 3 : 0),
    bind: (x) => { const ch = untreatedChronic(x); return ch ? { cond: ch.id } : null; },
    title: 'Treatment options', text: (x) => `Your ${CHRONIC_BY_ID[x.p.cond as string]?.name.toLowerCase() ?? 'condition'} needs a decision. Treatment costs ${x.fmt(CHRONIC_BY_ID[x.p.cond as string]?.cost ?? 0)}/yr.`,
    choices: [
      { label: 'Start treatment', when: (x) => x.c.money >= (CHRONIC_BY_ID[x.p.cond as string]?.cost ?? 0), run: (x) => { const ch = x.c.bio.chronic.find((c) => c.id === x.p.cond); if (ch) ch.managed = true; x.mods({ anxiety: -4 }); return 'You are under a doctor\'s care.'; } },
      { label: 'Try alternative medicine', run: (x) => { x.spend(Math.min(Math.max(0, x.c.money), 1500)); x.mod('faith', 2); return x.chance(0.1) ? 'Somehow you feel better.' : 'Expensive tea.'; } },
      { label: 'Pray for healing', when: (x) => x.stat('faith') > 40, run: (x) => { x.mod('faith', 3); if (x.stat('divineFavor') >= 75 && x.chance(0.4)) { x.c.bio.chronic = x.c.bio.chronic.filter((c) => c.id !== x.p.cond); x.mod('divineFavor', -30); return 'A miracle. It is simply gone.'; } return 'You find peace, if not a cure.'; } },
      { label: 'Ignore it', tags: ['impulsive'], run: () => 'It can wait. It will not.' },
    ],
  },
  {
    id: 'h_obesityWarning', cat: 'health', minAge: 18, cooldown: 4, weight: (x) => (bmiCategory(x.c) === 'obese' ? 2 : 0),
    title: 'Doctor\'s orders', text: 'Your doctor warns that your weight is putting your life at risk.',
    choices: [
      { label: 'Diet and exercise', tags: ['cautious'], run: (x) => { x.c.diet = 'healthy'; x.c.exercise = Math.max(2, x.c.exercise); x.mods({ willpower: 3 }); return 'You start small. You keep going.'; } },
      { label: 'Weight-loss surgery', when: (x) => x.year > 1970 && x.c.money > 20000, run: (x) => { x.spend(20000); x.c.bio.weightKg = Math.round(x.c.bio.weightKg * 0.75); if (x.chance(0.08)) { x.mod('health', -12); return 'Complications, but the weight came off.'; } return 'The weight melts away.'; } },
      { label: 'Ignore it', run: () => 'You change doctors.' },
    ],
  },
  {
    id: 'h_pandemic', cat: 'health', minAge: 0, cooldown: 1, weight: (x) => (x.w.healthCrisis ? 4 : 0),
    title: (x) => x.w.healthCrisisName ?? 'Epidemic', text: (x) => (x.year < 1900 ? 'Sickness spreads through your town. Carts collect the dead each morning.' : 'Cases are rising. Hospitals are filling up.'),
    choices: [
      { label: 'Isolate', tags: ['cautious'], run: (x) => { x.mods({ loneliness: 8, happiness: -3 }); if (x.chance(0.15)) { x.mod('health', -10); return 'You caught it anyway.'; } return 'You stayed safe.'; } },
      { label: 'Carry on as normal', tags: ['impulsive'], run: (x) => { if (x.chance(0.45)) { const hit = x.int(10, x.year < 1900 ? 50 : 30) * (1 - x.stat('immunity') / 200) * (x.age > 65 ? 1.6 : 1); x.mod('health', -hit); return hit > 25 ? 'You got very sick and barely survived.' : 'You got sick, but recovered.'; } return 'You dodged it.'; } },
      { label: 'Help care for the sick', tags: ['help'], run: (x) => { x.mods({ karma: 8, faith: 2 }); if (x.chance(0.5)) x.mod('health', -x.int(10, 30)); x.remember('helpedSomeone', 'Nursed the sick during an epidemic', 30); return 'Heroic, and dangerous.'; } },
      { label: 'Get vaccinated', when: (x) => x.year >= 1950, run: (x) => { x.mod('immunity', 10); return 'Sore arm, peace of mind.'; } },
    ],
  },
  {
    id: 'h_sportsInjuryPro', cat: 'health', minAge: 16, cooldown: 3, weight: (x) => (x.c.exercise >= 3 ? 0.8 : 0),
    title: 'Overtraining', text: 'You pushed too hard in training.',
    auto: (x) => (x.chance(0.3) ? `Injury: ${injure(x, false)}` : (x.mod('fitness', -3), 'A strained muscle. Two weeks off.')),
  },
  {
    id: 'h_geneticTest', cat: 'health', minAge: 25, once: true, years: [2005, 99999], weight: 0.6,
    title: 'Genetic test', text: 'A consumer DNA test reveals your health risks.',
    auto: (x) => {
      const p = x.c.bio.predisposition;
      const top = Object.entries(p).sort((a, b) => b[1] - a[1])[0];
      x.c.flags.knowsGenetics = true;
      if (x.c.flags.huntington) { x.mods({ anxiety: 15 }); return 'You carry the gene for Huntington\'s disease.'; }
      return top && top[1] > 0.15 ? `Elevated risk: ${top[0]}. Forewarned is forearmed.` : 'Nothing alarming. Good genes.';
    },
  },
  {
    id: 'h_marathon', cat: 'health', minAge: 18, maxAge: 70, cooldown: 5, weight: (x) => (x.c.exercise >= 2 ? 0.8 : 0.2),
    title: 'The marathon', text: 'A friend dares you to run a marathon.',
    choices: [
      { label: 'Train and run it', tags: ['ambitious'], run: (x) => { x.train('marathon', 10); x.train('running', 6); if (check(x, x.stat('fitness'), 50)) { x.mods({ fitness: 5, confidence: 6, happiness: 6 }); return 'You crossed the finish line in tears.'; } x.mods({ fitness: 2 }); return 'You hit the wall at mile 20 and walked it in. Still counts.'; } },
      { label: 'No thanks', run: () => 'Running is for people being chased.' },
    ],
  },
  {
    id: 'h_hivRisk', cat: 'health', minAge: 18, cooldown: 6, years: [1980, 99999], weight: (x) => (addictionOf(x, 'sex')?.active || addictionOf(x, 'opioids')?.active ? 0.5 : 0),
    title: 'A test result', text: 'A former partner calls. You should get tested.',
    auto: (x) => (x.chance(0.3) ? (diagnose(x, 'hiv'), x.year > 1996 ? 'Positive. With modern treatment, it is manageable.' : 'Positive. In this era, it is a death sentence.') : 'Negative. A lucky break.'),
  },
  {
    id: 'h_trauma_disaster', cat: 'health', minAge: 4, cooldown: 10, violent: true, weight: 0.3,
    title: 'Disaster', text: (x) => x.pick(['An earthquake flattens your neighborhood.', 'A flood sweeps through town.', 'Fire tears through your building.']),
    auto: (x) => { trauma(x, 15, 'disaster'); const home = x.c.assets.find((a) => ['house', 'studio'].includes(a.typeId)); if (home) { home.condition = Math.max(10, home.condition - 50); home.value = Math.round(home.value * 0.7); } x.mod('health', -x.int(0, 15)); return home ? 'Your home was badly damaged.' : 'You lost almost everything you owned.'; },
  },
  {
    id: 'h_bonusVisit', cat: 'health', minAge: 30, cooldown: 5, weight: (x) => (x.partner() ? 0.5 : 0),
    bind: bindRel('spouse', 'partner'),
    title: 'Check-up', text: (x) => `${who(x)} nags you into seeing a doctor for the first time in years.`,
    auto: (x) => { if (x.chance(0.3)) { const ids = ['hypertension', 'diabetes'].filter((id) => !x.c.bio.chronic.some((c) => c.id === id)); if (ids.length) { diagnose(x, x.pick(ids)); const ch = x.c.bio.chronic[x.c.bio.chronic.length - 1]; ch.managed = true; return 'Caught early. You are being treated.'; } } x.relMod(npcId(x), 4); x.mod('health', 2); return 'A clean bill of health.'; },
  },
];
