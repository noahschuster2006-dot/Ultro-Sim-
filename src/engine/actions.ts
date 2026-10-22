import { Ctx } from './ctx';
import type { AddictionKind, GameState, Upbringing } from './types';
import { ENGINE_ERRORS, prepareQueue } from './events/engine';
import { ADDICTION_BY_KIND, CHRONIC_BY_ID } from './data/conditions';
import { CRIMES } from './data/underworld';
import { COUNTRIES, canExtradite, countryName, countriesAvailable, RELIGIONS } from './data/countries';
import { assetName } from './data/assets';
import { LAWS, OFFICES } from './data/politics';
import { SOCIETY_BY_ID } from './data/occult';
import { CAREER_BY_ID } from './data/careers';
import { PROGRAM_BY_ID } from './data/programs';
import { attemptRecovery, expose } from './systems/addiction';
import { therapyAvailable, therapyCost, medicationAvailable } from './systems/mind';
import { diagnose } from './systems/body';
import { practiceSkill } from './systems/skills';
import { applyForJob, careerEligibility, endCareer, promote, retire } from './systems/careers';
import { dropOut, enroll, programEligibility } from './systems/education';
import { adopt, argue, askForMoney, befriend, breakUp, canConceive, divorce, findLove, findMentor, giveGift, propose, reconcile, setUpbringing, spendTime, takeProtege, tryForBaby } from './systems/relationships';
import { commitCrime, enterWitnessProtection, escapePrison, fileLawsuit, fleeTo, joinPrisonGang, release } from './systems/legal';
import { LAUNDER_METHODS, DRUGS, OPS, SUPPLY_STAGES, canJoinOrg, drugName, joinOrg, launder, launderAvailable, repatriateOffshore, scaleOperation, shutOperation, startOperation } from './systems/underworld';
import { assetEligibility, buyAsset, developAsset, listingPrice, mortgageAvailable, renovate, sellAsset, toggleRent, availableAssets } from './systems/assets';
import { appointCrony, campaign, declareWar, imposeSanctions, joinParty, leaveOffice, officeEligibility, passLaw, runForOffice, stageCoup } from './systems/politics';
import { apologize, buryStory, giveInterview, plantStory, socialPost } from './systems/media';
import { exorcism, foundReligion, joinSociety, performRitual, pray } from './systems/spirit';
import { eraCostFactor } from './systems/finance';
import { ripple } from './systems/npcs';

import { adult, free, freeAdult, moneyOk, price, type ActionCat, type ActionDef, type ActionOption } from './acts/common';
import { ROMANCE_ACTIONS } from './acts/romance';
import { FAMILY_ACTIONS } from './acts/family';
import { SOCIAL_ACTIONS } from './acts/social';
import { LEISURE_ACTIONS } from './acts/leisure';
import { SHOP_ACTIONS } from './acts/shop';
import { SELFCARE_ACTIONS } from './acts/selfcare';

export type { ActionCat, ActionDef, ActionOption } from './acts/common';

const CORE_ACTIONS: ActionDef[] = [
  // ------------------------------------------------------------------ health & body
  { id: 'workout', cat: 'health', label: 'Work out', desc: 'Fitness, strength, a little happiness.', ap: 1, avail: (x) => (x.c.age >= 8 ? true : 'Too young'), run: (x) => { x.mods({ fitness: 3, happiness: 1, stress: -2, energy: -1 }); x.train('strengthTraining', 4); return 'You worked up a sweat.'; } },
  { id: 'doctor', cat: 'health', label: 'Visit the doctor', desc: 'Restores some health; may catch conditions early.', ap: 1, avail: (x) => moneyOk(x, price(x, 300)), run: (x) => {
    x.spend(price(x, 300));
    x.mod('health', x.year < 1850 ? 2 : 6);
    const p = x.c.bio.predisposition;
    if (x.year >= 1900 && x.c.age > 35) {
      const risk = (Object.entries(p) as [string, number][]).sort((a, b) => b[1] - a[1])[0];
      if (risk && risk[1] > 0.2 && x.chance(0.3)) {
        const map: Record<string, string> = { heart: 'hypertension', diabetes: 'diabetes', cancer: 'cancer' };
        const id = map[risk[0]];
        if (id && diagnose(x, id)) { const ch = x.c.bio.chronic.find((q) => q.id === id); if (ch) ch.managed = x.c.money >= (CHRONIC_BY_ID[id]?.cost ?? 0); return `Early detection: ${CHRONIC_BY_ID[id].name}. Treatment started.`; }
      }
    }
    return x.year < 1850 ? 'The physician applied leeches. You feel… somewhat better.' : 'A clean bill of health, mostly.';
  } },
  { id: 'treat', cat: 'health', label: 'Treat a condition', ap: 0, avail: (x) => (x.c.bio.chronic.some((c) => !c.managed) ? true : false), options: (x) => x.c.bio.chronic.filter((c) => !c.managed).map((c) => ({ value: c.id, label: `${CHRONIC_BY_ID[c.id]?.name ?? c.id} (${x.fmt(CHRONIC_BY_ID[c.id]?.cost ?? 0)}/yr)`, disabled: x.c.money < (CHRONIC_BY_ID[c.id]?.cost ?? 0) ? 'Cannot afford' : undefined })), run: (x, arg) => { const ch = x.c.bio.chronic.find((c) => c.id === arg); if (!ch) return 'Nothing to treat.'; ch.managed = true; return `You started treatment for ${CHRONIC_BY_ID[ch.id]?.name ?? ch.id}.`; } },
  { id: 'meditate', cat: 'mind', label: 'Meditate', desc: 'Calms anxiety and stress.', ap: 1, avail: (x) => (x.c.age >= 10 ? true : 'Too young'), run: (x) => { x.mods({ stress: -6, anxiety: -4, wisdom: 0.5 }); x.train('meditation', 4); return 'Breath in, breath out.'; } },
  { id: 'therapy', cat: 'mind', label: (x) => (x.c.mental.therapy ? 'Stop therapy' : 'Start therapy'), desc: 'Treats trauma, anxiety and depression. Costs per year.', ap: 0, avail: (x) => (therapyAvailable(x.year) ? (x.c.mental.therapy || x.c.money >= therapyCost(x.year) ? true : `Costs ${x.fmt(therapyCost(x.year))}/yr`) : 'Therapy does not exist yet'), run: (x) => { x.c.mental.therapy = !x.c.mental.therapy; return x.c.mental.therapy ? 'You booked a weekly session.' : 'You stopped therapy.'; } },
  { id: 'medication', cat: 'mind', label: (x) => (x.c.mental.medication ? 'Stop psychiatric medication' : 'Start psychiatric medication'), ap: 0, avail: (x) => (medicationAvailable(x.year) ? true : 'Not invented yet'), run: (x) => { x.c.mental.medication = !x.c.mental.medication; return x.c.mental.medication ? 'You started medication.' : 'You stopped medication.'; } },
  { id: 'supportGroup', cat: 'mind', label: (x) => (x.c.mental.supportGroup ? 'Leave support group' : 'Join a support group'), ap: 0, avail: (x) => (x.c.age >= 13 ? true : 'Too young'), run: (x) => { x.c.mental.supportGroup = !x.c.mental.supportGroup; return x.c.mental.supportGroup ? 'Folding chairs and honesty.' : 'You stopped going.'; } },
  { id: 'recover', cat: 'mind', label: 'Seek addiction recovery', ap: 1, avail: (x) => (x.c.addictions.some((a) => a.active) ? true : false), options: (x) => x.c.addictions.filter((a) => a.active).flatMap((a) => ADDICTION_BY_KIND[a.kind].recoveryOptions.filter((o) => x.year >= o.fromYear).map((o) => ({ value: `${a.kind}:${o.id}`, label: `${ADDICTION_BY_KIND[a.kind].name}: ${o.name}${o.cost ? ` (${x.fmt(o.cost)})` : ''}`, disabled: x.c.money < o.cost ? 'Cannot afford' : undefined }))), run: (x, arg) => { const [kind, opt] = (arg ?? '').split(':'); return attemptRecovery(x, kind as AddictionKind, opt).text; } },
  { id: 'party', cat: 'lifestyle', label: 'Go out partying', ap: 1, avail: (x) => (x.c.age >= 14 ? free(x) : 'Too young'), run: (x) => { x.mods({ happiness: 5, popularity: 2, stress: -4, loneliness: -4 }); const a = expose(x, 'alcohol', 0.35); return a ? 'Another blurry night. You are drinking too much.' : 'A great night out.'; } },
  { id: 'drugs', cat: 'lifestyle', label: 'Use drugs', ap: 1, avail: (x) => (x.c.age >= 13 ? true : 'Too young'), options: (x) => [{ value: 'stimulants', label: x.year < 1880 ? 'Coca leaves' : 'Stimulants' }, { value: 'opioids', label: x.year < 1898 ? 'Opium' : 'Opioids' }], run: (x, arg) => { const kind = (arg === 'opioids' ? 'opioids' : 'stimulants') as AddictionKind; x.mods(kind === 'stimulants' ? { mania: 12, happiness: 4 } : { happiness: 6, pain: -10 }); const a = expose(x, kind, 0.8); if (x.chance(0.04)) { x.mod('health', -25); return 'You overdosed and woke up in hospital.'; } return a ? 'You need it now.' : 'You got high.'; } },
  { id: 'gamble', cat: 'lifestyle', label: 'Gamble', ap: 1, avail: (x) => (x.c.age >= 18 ? (x.c.money > 100 ? true : 'No money') : 'Adults only'), run: (x) => { const stake = Math.max(50, Math.round(x.c.money * 0.1)); const win = x.chance(0.45); x.money(win ? stake : -stake); expose(x, 'gambling', win ? 0.5 : 0.3); return win ? `You won ${x.fmt(stake)}.` : `You lost ${x.fmt(stake)}.`; } },
  { id: 'vacation', cat: 'lifestyle', label: 'Take a vacation', ap: 1, avail: (x) => (x.c.age >= 18 ? (free(x) === true ? moneyOk(x, price(x, 3000)) : false) : 'Adults only'), run: (x) => { x.spend(price(x, 3000)); x.mods({ happiness: 8, stress: -12, wisdom: 1 }); return 'Sun, rest and terrible souvenirs.'; } },
  { id: 'diet', cat: 'lifestyle', label: 'Change diet', ap: 0, options: () => [{ value: 'healthy', label: 'Healthy' }, { value: 'balanced', label: 'Balanced' }, { value: 'poor', label: 'Cheap & poor' }, { value: 'excessive', label: 'Excessive' }], run: (x, arg) => { x.c.diet = (arg as typeof x.c.diet) ?? 'balanced'; return `Diet set to ${x.c.diet}.`; } },
  { id: 'exercise', cat: 'lifestyle', label: 'Set exercise habit', ap: 0, options: () => [{ value: '0', label: 'Sedentary' }, { value: '1', label: 'Light' }, { value: '2', label: 'Regular' }, { value: '3', label: 'Athlete' }], run: (x, arg) => { x.c.exercise = Number(arg) || 0; return `Exercise level set to ${['sedentary', 'light', 'regular', 'athlete'][x.c.exercise]}.`; } },
  { id: 'lifestyleLevel', cat: 'lifestyle', label: 'Set lifestyle', ap: 0, avail: adult, options: (x) => (['frugal', 'modest', 'comfortable', 'lavish'] as const).map((v) => ({ value: v, label: `${v[0].toUpperCase()}${v.slice(1)} (${x.fmt(Math.round({ frugal: 6000, modest: 15000, comfortable: 32000, lavish: 110000 }[v] * eraCostFactor(x.year)))}/yr)` })), run: (x, arg) => { x.c.lifestyle = (arg as typeof x.c.lifestyle) ?? 'modest'; return `Lifestyle set to ${x.c.lifestyle}.`; } },
  { id: 'liveWithParents', cat: 'lifestyle', label: (x) => (x.c.flags.livingWithParents ? 'Move out of your parents\' house' : 'Move back in with your parents'), ap: 0, avail: (x) => (x.c.age >= 18 && x.aliveParents().length ? free(x) : false), run: (x) => { x.c.flags.livingWithParents = !x.c.flags.livingWithParents; return x.c.flags.livingWithParents ? 'Your childhood bedroom awaits.' : 'Independence!'; } },
  { id: 'emigrate', cat: 'lifestyle', label: 'Emigrate', desc: 'Move to another country. Language and culture shock.', ap: 2, avail: (x) => (x.c.age >= 18 ? (free(x) === true ? (x.c.legal.interpolNotice ? 'An Interpol notice blocks travel' : moneyOk(x, price(x, 5000))) : false) : 'Adults only'), options: (x) => countriesAvailable(x.year).filter((c) => c.id !== x.c.countryId).map((c) => ({ value: c.id, label: countryName(c.id, x.year) })), run: (x, arg) => { if (!arg) return ''; x.spend(price(x, 5000)); if (x.c.career && !CAREER_BY_ID[x.c.career.careerId]?.tags.includes('criminal')) endCareer(x, 'Emigrated'); x.c.countryId = arg; x.mods({ loneliness: 10 }); x.train('languages', 8); x.remember('emigrated', `Emigrated to ${countryName(arg, x.year)}`, 35); return `You moved to ${countryName(arg, x.year)}.`; } },
  { id: 'cosmetic', cat: 'health', label: 'Cosmetic modification', ap: 1, avail: (x) => (x.c.age >= 16 ? free(x) : 'Too young'), options: (x) => [{ value: 'tattoo', label: 'Visible tattoo' }, { value: 'piercing', label: 'Piercing' }, ...(x.year >= 1930 ? [{ value: 'surgery', label: `Plastic surgery (${x.fmt(15000)})`, disabled: x.c.money < 15000 ? 'Cannot afford' : undefined }] : []), ...(x.year >= 1950 ? [{ value: 'steroids', label: 'Steroids' }] : [])], run: (x, arg) => {
    if (arg === 'tattoo') { x.c.bio.cosmetics.push({ id: 'tattoo', name: 'Visible tattoo', age: x.age }); x.mods({ streetCred: 3 }); return 'Fresh ink. Corporate jobs may be harder.'; }
    if (arg === 'piercing') { x.c.bio.cosmetics.push({ id: 'piercing', name: 'Piercing', age: x.age }); x.mod('confidence', 2); return 'A new piercing.'; }
    if (arg === 'surgery') { x.spend(15000); x.c.bio.cosmetics.push({ id: 'surgery', name: 'Plastic surgery', age: x.age }); if (x.chance(0.12)) { x.mods({ looks: -8, health: -10 }); return 'Complications. It went badly.'; } x.mod('looks', x.int(8, 16)); return 'Your new face looks great.'; }
    if (arg === 'steroids') { x.c.bio.steroidYears = Math.max(1, x.c.bio.steroidYears); x.c.bio.cosmetics.push({ id: 'steroids', name: 'Steroid use', age: x.age }); x.mods({ fitness: 12, aggression: 5 }); x.secret('steroids', 'Steroid use', 3); return 'Gains. Rage. Heart strain.'; }
    return '';
  } },
  // ------------------------------------------------------------------ skills
  { id: 'practice', cat: 'skills', label: 'Practice a skill', ap: 1, avail: (x) => (x.c.age >= 4 ? true : 'Too young'), run: (x, arg) => practiceSkill(x, arg ?? '') },
  // ------------------------------------------------------------------ education
  { id: 'enroll', cat: 'education', label: 'Enroll', ap: 1, avail: (x) => (x.c.education.enrolled ? 'Already enrolled' : true), options: (x) => Object.values(PROGRAM_BY_ID).filter((p) => p.kind !== 'school' && x.year >= p.fromYear).map((p) => { const ok = programEligibility(x, p); return { value: p.id, label: `${p.name} (${p.years}y${p.cost ? `, ${x.fmt(p.cost)}/yr` : ', free'})`, disabled: ok === true ? undefined : ok }; }), run: (x, arg) => enroll(x, arg ?? '', false).text },
  { id: 'enrollLoan', cat: 'education', label: 'Enroll with student loans', ap: 1, avail: (x) => (x.c.education.enrolled ? false : x.year >= 1958 ? true : false), options: (x) => Object.values(PROGRAM_BY_ID).filter((p) => p.kind !== 'school' && p.cost > 0 && x.year >= p.fromYear).map((p) => { const ok = programEligibility(x, p); return { value: p.id, label: `${p.name} (${x.fmt(p.cost * p.years)} total)`, disabled: ok === true ? undefined : ok }; }), run: (x, arg) => enroll(x, arg ?? '', true).text },
  { id: 'studyHard', cat: 'education', label: (x) => (x.c.flags.studyHard ? 'Stop studying so hard' : 'Study harder'), desc: 'Better grades and skills, more stress.', ap: 0, avail: (x) => (x.c.education.enrolled ? true : false), run: (x) => { x.c.flags.studyHard = !x.c.flags.studyHard; return x.c.flags.studyHard ? 'You hit the books.' : 'You ease off.'; } },
  { id: 'dropOut', cat: 'education', label: 'Drop out', ap: 0, avail: (x) => (x.c.education.enrolled ? true : false), run: (x) => dropOut(x) },
  // ------------------------------------------------------------------ career
  { id: 'apply', cat: 'career', label: 'Apply for a job', ap: 1, avail: (x) => (x.c.age >= 14 ? free(x) : 'Too young'), run: (x, arg) => applyForJob(x, arg ?? '').text },
  { id: 'workEthic', cat: 'career', label: 'Work ethic', ap: 0, avail: (x) => (x.c.career ? true : false), options: () => [{ value: 'slack', label: 'Slack off' }, { value: 'normal', label: 'Normal' }, { value: 'hard', label: 'Work hard (−1 action/yr)' }], run: (x, arg) => { if (x.c.career) x.c.career.workEthic = (arg as 'slack' | 'normal' | 'hard') ?? 'normal'; return `Work ethic: ${arg}.`; } },
  { id: 'askPromotion', cat: 'career', label: 'Ask for a promotion', ap: 1, avail: (x) => (x.c.career && !CAREER_BY_ID[x.c.career.careerId]?.special ? (x.c.career.level < 10 ? true : 'Already at the top') : false), run: (x) => { const cs = x.c.career!; if (cs.performance > 65 && cs.yearsInRole >= 1 && x.chance(0.3 + (cs.performance - 65) / 80)) { const t = promote(x); return `Promoted to ${t}!`; } cs.performance -= 3; return 'Not yet, they said.'; } },
  { id: 'network', cat: 'career', label: 'Network', desc: 'Build connections in your field.', ap: 1, avail: freeAdult, run: (x) => { x.train('networking', 5); x.mods({ professionalRep: 2 }); if (x.c.career) x.c.career.performance += 3; return 'You traded business cards and war stories.'; } },
  { id: 'quit', cat: 'career', label: 'Quit your job', ap: 0, avail: (x) => (x.c.career && !['monarch', 'emperor', 'politician'].includes(x.c.career.careerId) ? true : false), run: (x) => { endCareer(x, 'Quit'); x.mods({ happiness: 3, stress: -6 }); return 'You quit.'; } },
  { id: 'retire', cat: 'career', label: 'Retire', ap: 0, avail: (x) => (x.c.career && x.c.age >= 55 ? true : false), run: (x) => retire(x) },
  { id: 'mentor', cat: 'career', label: 'Find a mentor', ap: 1, avail: (x) => (x.c.age >= 14 ? free(x) : false), run: (x) => findMentor(x) },
  { id: 'protege', cat: 'career', label: 'Take a protégé', ap: 1, avail: freeAdult, run: (x) => takeProtege(x) },
  // ------------------------------------------------------------------ social
  { id: 'findLove', cat: 'social', label: 'Look for love', ap: 1, avail: (x) => (x.c.age >= 14 ? free(x) : 'Too young'), options: (x) => [{ value: 'social', label: x.year >= 2010 ? 'Dating apps & friends' : 'Socialize and meet people' }, ...(['aristocracy', 'royalty', 'wealthy'].includes(x.c.familyStatus) || x.year < 1900 ? [{ value: 'arranged', label: 'Ask family to arrange a match' }] : [])], run: (x, arg) => findLove(x, (arg as 'social' | 'arranged') ?? 'social') },
  { id: 'befriend', cat: 'social', label: 'Make a friend', ap: 1, avail: (x) => (x.c.age >= 5 ? true : false), run: (x) => befriend(x) },
  { id: 'baby', cat: 'social', label: 'Try for a baby', ap: 1, avail: (x) => (x.c.age >= 16 ? (canConceive(x) === true ? true : (canConceive(x) as string)) : false), run: (x) => tryForBaby(x) },
  { id: 'adopt', cat: 'social', label: 'Adopt a child', ap: 1, avail: (x) => (x.c.age >= 21 ? free(x) : false), run: (x) => adopt(x) },
  // ------------------------------------------------------------------ per-relationship
  { id: 'rel_time', cat: 'rel', label: 'Spend time together', ap: 1, run: (x, arg) => spendTime(x, arg ?? '') },
  { id: 'rel_gift', cat: 'rel', label: 'Give a gift', ap: 1, options: (x) => [100, 1000, 10000, 100000].map((v) => ({ value: String(v), label: x.fmt(v), disabled: x.c.money < v ? 'Cannot afford' : undefined })), run: (x, arg) => { const [id, amt] = (arg ?? '').split('|'); return giveGift(x, id, Number(amt) || 100); } },
  { id: 'rel_argue', cat: 'rel', label: 'Argue', ap: 1, run: (x, arg) => argue(x, arg ?? '') },
  { id: 'rel_reconcile', cat: 'rel', label: 'Try to reconcile', ap: 1, avail: (x, arg) => ((x.rel(arg)?.affinity ?? 100) < 45 ? true : false), run: (x, arg) => reconcile(x, arg ?? '') },
  { id: 'rel_money', cat: 'rel', label: 'Ask for money', ap: 1, avail: (x, arg) => (['parent', 'grandparent', 'sibling', 'spouse', 'friend', 'bestFriend'].includes(x.rel(arg)?.type ?? '') ? true : false), run: (x, arg) => askForMoney(x, arg ?? '') },
  { id: 'rel_propose', cat: 'rel', label: 'Propose', ap: 1, avail: (x, arg) => (x.rel(arg)?.type === 'partner' ? true : false), run: (x, arg) => propose(x, arg ?? '') },
  { id: 'rel_breakup', cat: 'rel', label: 'Break up', ap: 0, avail: (x, arg) => (['partner', 'affair'].includes(x.rel(arg)?.type ?? '') ? true : false), run: (x, arg) => breakUp(x, arg ?? '') },
  { id: 'rel_divorce', cat: 'rel', label: 'Divorce', ap: 0, avail: (x, arg) => (x.rel(arg)?.type === 'spouse' ? true : false), run: (x, arg) => divorce(x, arg ?? '') },
  { id: 'rel_upbringing', cat: 'rel', label: 'Set upbringing focus', ap: 0, avail: (x, arg) => (x.rel(arg)?.type === 'child' && x.npcAge(x.npc(arg)!) < 18 ? true : false), options: () => (['balanced', 'academic', 'athletic', 'criminal', 'spiritual'] as Upbringing[]).map((u) => ({ value: u, label: u[0].toUpperCase() + u.slice(1) })), run: (x, arg) => { const [id, focus] = (arg ?? '').split('|'); return setUpbringing(x, id, focus as Upbringing); } },
  { id: 'rel_sue', cat: 'rel', label: 'Sue them', ap: 1, avail: (x, arg) => (x.c.age >= 18 && ['enemy', 'nemesis', 'rival', 'ex', 'boss', 'businessPartner', 'debtHolder', 'blackmailer'].includes(x.rel(arg)?.type ?? '') ? true : false), options: () => [{ value: 'defamation', label: 'Defamation' }, { value: 'assault', label: 'Assault' }, { value: 'contract', label: 'Breach of contract' }], run: (x, arg) => { const [id, kind] = (arg ?? '').split('|'); return fileLawsuit(x, kind as 'defamation', id); } },
  { id: 'rel_smear', cat: 'rel', label: 'Plant a smear story', ap: 1, avail: (x, arg) => (x.c.age >= 18 && ['enemy', 'nemesis', 'rival'].includes(x.rel(arg)?.type ?? '') ? moneyOk(x, 25000) : false), run: (x, arg) => plantStory(x, arg) },
  { id: 'rel_cabinet', cat: 'rel', label: 'Appoint to your cabinet', ap: 1, avail: (x, arg) => (x.c.politics.office && !x.c.politics.cabinet.includes(arg ?? '') && ['friend', 'bestFriend', 'sibling', 'child', 'spouse', 'businessPartner'].includes(x.rel(arg)?.type ?? '') ? true : false), run: (x, arg) => appointCrony(x, arg ?? '') },
  { id: 'rel_attack', cat: 'rel', label: 'Attack', ap: 1, avail: (x, arg) => (x.c.age >= 8 && arg && x.npc(arg) && x.npcAge(x.npc(arg)!) >= 10 ? true : false), run: (x, arg) => commitCrime(x, 'assault', arg).text },
  { id: 'rel_murder', cat: 'rel', label: 'Murder', desc: 'Kills them. Creates enemies among their allies and a case that never fully goes cold.', ap: 1, avail: (x, arg) => (x.c.age >= 14 && x.s.settings.matureThemes && arg && x.npc(arg) && x.npcAge(x.npc(arg)!) >= 14 ? true : false), run: (x, arg) => { const r = commitCrime(x, 'murder', arg); if (r.ok) ripple(x, arg ?? '', -20, 'Murder'); return r.text; } },
  // ------------------------------------------------------------------ crime
  { id: 'crime', cat: 'crime', label: 'Commit a crime', ap: 1, avail: (x) => (x.c.age >= 8 ? free(x) : false), options: (x) => CRIMES.filter((c) => !['murder', 'assault', 'prisonEscape', 'witnessIntimidation', 'drugPossession', 'moneyLaundering', 'briberyOfficial', 'taxEvasion'].includes(c.id) && x.year >= c.fromYear).map((c) => ({ value: c.id, label: c.name, disabled: x.c.age < c.minAge ? `Age ${c.minAge}+` : c.id === 'embezzlement' && !x.c.career ? 'Requires a job' : undefined })), run: (x, arg) => commitCrime(x, arg ?? '').text },
  { id: 'joinOrg', cat: 'crime', label: 'Join a criminal organization', ap: 1, avail: (x) => (x.c.legal.prison ? false : canJoinOrg(x)), run: (x) => joinOrg(x) },
  { id: 'startOp', cat: 'crime', label: 'Start an operation', ap: 1, avail: (x) => (x.c.age >= 16 ? free(x) : false), options: (x) => [
    ...DRUGS.filter((d) => x.year >= d.fromYear).flatMap((d) => SUPPLY_STAGES.map((st) => ({ value: `drugs:${d.id}:${st.id}`, label: `${drugName(d.id, x.year)} — ${st.name}` }))),
    ...OPS.filter((o) => x.year >= o.fromYear).flatMap((o) => o.products.filter((p) => !p.fromYear || x.year >= p.fromYear).map((p) => ({ value: `${o.id}:${p.id}`, label: `${o.name}: ${p.name}` }))),
  ], run: (x, arg) => { const parts = (arg ?? '').split(':'); return parts[0] === 'drugs' ? startOperation(x, 'drugs', parts[1], parts[2]) : startOperation(x, parts[0], parts[1]); } },
  { id: 'scaleOp', cat: 'crime', label: 'Scale an operation', ap: 1, avail: (x) => (x.c.crime.operations.length ? free(x) : false), options: (x) => x.c.crime.operations.flatMap((o) => [{ value: `${o.id}:1`, label: `Expand ${o.kind} (${o.product}) to level ${o.scale + 1}`, disabled: o.scale >= 5 ? 'Maxed' : undefined }, { value: `${o.id}:-1`, label: `Scale down ${o.kind} (${o.product})`, disabled: o.scale <= 1 ? 'Minimum' : undefined }]), run: (x, arg) => { const [id, d] = (arg ?? '').split(':'); return scaleOperation(x, id, Number(d)); } },
  { id: 'shutOp', cat: 'crime', label: 'Shut down an operation', ap: 0, avail: (x) => (x.c.crime.operations.length ? true : false), options: (x) => x.c.crime.operations.map((o) => ({ value: o.id, label: `${o.kind}: ${o.product}${o.stage !== 'run' ? ` (${o.stage})` : ''}` })), run: (x, arg) => shutOperation(x, arg ?? '') },
  { id: 'launder', cat: 'crime', label: 'Launder money', ap: 1, amount: true, avail: (x) => (x.c.crime.dirtyMoney > 0 ? free(x) : false), options: (x) => LAUNDER_METHODS.filter((m) => x.year >= m.fromYear).map((m) => { const ok = launderAvailable(x, m); return { value: m.id, label: `${m.name} — ${Math.round(m.cost * 100)}% fee, layer ${m.layer}`, disabled: ok === true ? undefined : ok }; }), run: (x, arg, amount) => launder(x, arg ?? 'cash', amount ?? x.c.crime.dirtyMoney) },
  { id: 'repatriate', cat: 'crime', label: 'Bring offshore money home', ap: 0, amount: true, avail: (x) => (x.c.crime.offshore > 0 ? true : false), run: (x, _arg, amount) => repatriateOffshore(x, amount ?? x.c.crime.offshore) },
  { id: 'bribePolice', cat: 'crime', label: 'Pay off the police', desc: 'Reduces heat.', ap: 1, avail: (x) => (x.stat('heat') > 10 ? (x.c.money + x.c.crime.dirtyMoney >= 10000 ? free(x) : 'Costs $10K') : false), run: (x) => { if (x.c.crime.dirtyMoney >= 10000) x.c.crime.dirtyMoney -= 10000; else x.spend(10000); x.train('bribery', 5); if (x.chance(0.75 + x.skill('bribery') / 400)) { x.mods({ heat: -20, corruption: 5 }); return 'Patrols suddenly avoid your street.'; } x.mod('heat', 10); return 'The officer was a straight arrow. Heat increased.'; } },
  { id: 'flee', cat: 'crime', label: 'Flee the country', ap: 2, avail: (x) => (x.c.age >= 16 && !x.c.legal.prison ? (x.c.legal.cases.some((k) => k.status === 'open') || x.c.legal.fugitive ? moneyOk(x, 15000) : false) : false), options: (x) => COUNTRIES.filter((c) => c.availableFrom <= x.year && c.id !== x.c.countryId).map((c) => ({ value: c.id, label: `${countryName(c.id, x.year)}${canExtradite(x.c.countryId, c.id) ? ' (extradites)' : ' — no extradition'}`, disabled: x.c.legal.interpolNotice && canExtradite(x.c.countryId, c.id) ? 'Interpol notice' : undefined })), run: (x, arg) => fleeTo(x, arg ?? '') },
  { id: 'witnessProtection', cat: 'crime', label: 'Testify & enter witness protection', ap: 1, avail: (x) => (x.c.crime.orgName && !x.c.legal.prison ? true : false), run: (x) => enterWitnessProtection(x) },
  // ------------------------------------------------------------------ prison
  { id: 'p_workout', cat: 'prison', label: 'Work out in the yard', ap: 1, avail: (x) => (x.c.legal.prison ? true : false), run: (x) => { x.mods({ fitness: 3 }); x.train('strengthTraining', 4); x.c.legal.prison!.rank += 2; return 'Push-ups and respect.'; } },
  { id: 'p_behave', cat: 'prison', label: 'Keep your head down', desc: 'Raises good behavior for parole.', ap: 1, avail: (x) => (x.c.legal.prison ? true : false), run: (x) => { x.c.legal.prison!.goodBehavior = Math.min(100, x.c.legal.prison!.goodBehavior + 12); x.mod('discipline', 2); return 'A model prisoner.'; } },
  { id: 'p_study', cat: 'prison', label: 'Study in the library', ap: 1, avail: (x) => (x.c.legal.prison ? true : false), run: (x) => { x.train('law', 5); x.train('literacy', 4); x.mod('smarts', 1); x.c.legal.prison!.goodBehavior += 4; return 'Books, the only escape.'; } },
  { id: 'p_gang', cat: 'prison', label: 'Join a prison gang', ap: 1, avail: (x) => (x.c.legal.prison && !x.c.legal.prison.gang ? true : false), run: (x) => joinPrisonGang(x) },
  { id: 'p_bribeGuard', cat: 'prison', label: 'Bribe a guard', ap: 1, avail: (x) => (x.c.legal.prison ? (x.c.money + x.c.crime.dirtyMoney >= 2000 ? true : 'Costs $2K') : false), run: (x) => { if (x.c.money >= 2000) x.spend(2000); else x.c.crime.dirtyMoney -= 2000; x.c.legal.prison!.guardFavor += 20; return 'Better food, fewer searches.'; } },
  { id: 'p_appeal', cat: 'prison', label: 'File an appeal', ap: 1, avail: (x) => (x.c.legal.prison && x.c.legal.prison.tier !== 'deathRow' ? (x.c.legal.prison.appeals > 0 ? moneyOk(x, 20000) : 'No appeals left') : false), run: (x) => { const P = x.c.legal.prison!; x.spend(20000); P.appeals--; if (x.chance(0.18 + x.skill('criminalLaw') / 300)) { if (x.chance(0.3)) { release(x, 'Conviction overturned'); x.c.legal.record.pop(); return 'Conviction overturned! You walk free.'; } P.sentence = Math.max(P.served + 1, Math.round(P.sentence * 0.6)); return 'Your sentence was reduced.'; } return 'Appeal denied.'; } },
  { id: 'p_escape', cat: 'prison', label: 'Attempt escape', ap: 1, avail: (x) => (x.c.legal.prison ? true : false), run: (x) => escapePrison(x) },
  // ------------------------------------------------------------------ assets
  { id: 'buy', cat: 'assets', label: 'Buy', ap: 1, avail: freeAdult, run: (x, arg) => buyAsset(x, arg ?? '') },
  { id: 'buyMortgage', cat: 'assets', label: 'Buy with a mortgage', ap: 1, avail: freeAdult, run: (x, arg) => buyAsset(x, arg ?? '', { mortgage: true }) },
  { id: 'buyDirty', cat: 'assets', label: 'Buy with dirty cash', ap: 1, avail: (x) => (x.c.crime.dirtyMoney > 0 ? freeAdult(x) : false), run: (x, arg) => buyAsset(x, arg ?? '', { dirty: true }) },
  { id: 'invest', cat: 'assets', label: 'Invest', ap: 1, amount: true, avail: freeAdult, run: (x, arg, amount) => buyAsset(x, arg ?? 'stocks', { amount: amount ?? 1000 }) },
  { id: 'sell', cat: 'assets', label: 'Sell', ap: 0, avail: free, run: (x, arg) => sellAsset(x, arg ?? '') },
  { id: 'sellPart', cat: 'assets', label: 'Sell half', ap: 0, avail: free, run: (x, arg) => sellAsset(x, arg ?? '', 0.5) },
  { id: 'develop', cat: 'assets', label: 'Develop / expand', ap: 1, avail: free, run: (x, arg) => developAsset(x, arg ?? '') },
  { id: 'renovate', cat: 'assets', label: 'Renovate', ap: 1, avail: free, run: (x, arg) => renovate(x, arg ?? '') },
  { id: 'rent', cat: 'assets', label: 'Toggle renting out', ap: 0, avail: free, run: (x, arg) => toggleRent(x, arg ?? '') },
  // ------------------------------------------------------------------ politics
  { id: 'joinParty', cat: 'politics', label: 'Join a political party', ap: 1, avail: (x) => (x.c.age >= 16 && !x.c.politics.party ? free(x) : false), run: (x) => joinParty(x) },
  { id: 'campaign', cat: 'politics', label: 'Campaign & canvass', desc: 'Builds political approval.', ap: 1, avail: (x) => (x.c.age >= 16 ? free(x) : false), run: (x) => campaign(x) },
  { id: 'runOffice', cat: 'politics', label: 'Run for office', ap: 2, avail: freeAdult, options: (x) => OFFICES.map((o) => { const ok = officeEligibility(x, o); return { value: o.id, label: `${o.name}${o.campaignCost ? ` (campaign ${x.fmt(o.campaignCost)})` : ' (appointment)'}`, disabled: ok === true ? undefined : ok }; }), run: (x, arg) => runForOffice(x, arg ?? '') },
  { id: 'passLaw', cat: 'politics', label: 'Pass legislation', ap: 1, avail: (x) => (x.c.politics.office ? true : false), options: (x) => LAWS.map((l) => ({ value: l.id, label: `${l.name} — ${l.desc}`, disabled: x.w.policies.includes(l.id) ? 'Already law' : undefined })), run: (x, arg) => passLaw(x, arg ?? '') },
  { id: 'declareWar', cat: 'politics', label: 'Declare war', ap: 1, avail: (x) => (x.c.politics.office === 'headOfGovernment' || ['monarch', 'emperor'].includes(x.c.career?.careerId ?? '') ? true : false), options: (x) => Object.keys(x.s.world.contexts).filter((id) => id !== x.c.countryId).map((id) => ({ value: id, label: countryName(id, x.year) })), run: (x, arg) => declareWar(x, arg ?? '') },
  { id: 'sanctions', cat: 'politics', label: 'Impose sanctions', ap: 1, avail: (x) => (x.c.politics.office === 'headOfGovernment' || x.c.politics.office === 'cabinetMinister' || x.c.career?.careerId === 'monarch' ? true : false), options: (x) => Object.keys(x.s.world.contexts).filter((id) => id !== x.c.countryId).map((id) => ({ value: id, label: countryName(id, x.year) })), run: (x, arg) => imposeSanctions(x, arg ?? '') },
  { id: 'coup', cat: 'politics', label: 'Stage a coup', ap: 2, avail: (x) => ((x.c.career?.careerId === 'militaryOfficer' && x.c.career.level >= 7) || x.c.crime.orgRank >= 4 || (x.c.politics.office && !x.c.politics.dictator) ? free(x) : false), run: (x) => stageCoup(x) },
  { id: 'resign', cat: 'politics', label: 'Resign from office', ap: 0, avail: (x) => (x.c.politics.office ? true : false), run: (x) => { leaveOffice(x, 'Resigned'); return 'You resigned.'; } },
  // ------------------------------------------------------------------ media
  { id: 'interview', cat: 'media', label: 'Give an interview', ap: 1, avail: (x) => (x.stat('fame') >= 20 ? free(x) : false), run: (x) => giveInterview(x) },
  { id: 'post', cat: 'media', label: 'Post on social media', ap: 1, avail: (x) => (x.year >= 2006 && x.c.age >= 13 ? true : false), run: (x) => socialPost(x) },
  { id: 'plantSelf', cat: 'media', label: 'Plant a puff piece about yourself', ap: 1, avail: (x) => (x.c.age >= 18 ? (free(x) === true ? moneyOk(x, 25000) : false) : false), run: (x) => plantStory(x) },
  { id: 'bury', cat: 'media', label: 'Bribe editors to bury a story', ap: 1, avail: (x) => (x.c.media.secrets.some((s) => !s.exposed) ? moneyOk(x, 40000) : false), run: (x) => buryStory(x) },
  { id: 'prFirm', cat: 'media', label: (x) => (x.c.media.prFirm ? 'Fire your PR firm' : 'Hire a PR firm ($60K/yr)'), ap: 0, avail: (x) => (x.year >= 1920 && x.c.age >= 18 ? true : false), run: (x) => { x.c.media.prFirm = !x.c.media.prFirm; return x.c.media.prFirm ? 'Your image is now managed by professionals.' : 'You are on your own.'; } },
  { id: 'apologize', cat: 'media', label: 'Issue a public apology', ap: 1, avail: (x) => (x.c.media.cancelled ? true : false), run: (x) => apologize(x) },
  // ------------------------------------------------------------------ spirit
  { id: 'pray', cat: 'spirit', label: 'Pray', ap: 1, run: (x) => pray(x) },
  { id: 'worship', cat: 'spirit', label: 'Attend worship', ap: 1, avail: (x) => (x.c.religionId !== 'none' ? free(x) : 'You have no religion'), run: (x) => { x.mods({ faith: 3, loneliness: -3, karma: 1, spiritualAuthority: 0.5 }); x.train('scripture', 3); return 'Song, sermon and community.'; } },
  { id: 'ritual', cat: 'spirit', label: 'Perform a ritual', ap: 1, avail: (x) => (x.c.age >= 12 ? true : false), run: (x) => performRitual(x) },
  { id: 'exorcism', cat: 'spirit', label: 'Seek an exorcism', ap: 1, avail: (x) => (x.c.spiritual.curses.length ? true : false), run: (x) => exorcism(x) },
  { id: 'foundReligion', cat: 'spirit', label: 'Found a religion', ap: 2, avail: (x) => (x.c.age >= 21 && !x.c.spiritual.foundedReligion ? free(x) : false), run: (x) => foundReligion(x) },
  { id: 'joinSociety', cat: 'spirit', label: 'Join a secret society', ap: 0, avail: (x) => (x.c.spiritual.invites.length ? true : false), options: (x) => x.c.spiritual.invites.map((id) => ({ value: id, label: SOCIETY_BY_ID[id]?.name ?? id })), run: (x, arg) => joinSociety(x, arg ?? '') },
  { id: 'convert', cat: 'spirit', label: 'Convert religion', ap: 1, options: (x) => RELIGIONS.filter((r) => r.id !== x.c.religionId && r.from <= x.year && (r.to === undefined || r.to >= x.year)).map((r) => ({ value: r.id, label: r.name })), run: (x, arg) => { x.c.religionId = arg ?? 'none'; x.mods({ faith: arg === 'none' ? -20 : 5 }); x.remember('converted', `Converted to ${RELIGIONS.find((r) => r.id === arg)?.name ?? arg}`, 25); return `You are now ${RELIGIONS.find((r) => r.id === arg)?.name ?? arg}.`; } },
  { id: 'charity', cat: 'spirit', label: 'Give to charity', ap: 1, amount: true, avail: (x) => (x.c.money > 0 ? true : false), run: (x, _a, amount) => { const amt = Math.min(x.c.money, Math.max(1, Math.round(amount ?? 100))); x.spend(amt); x.mods({ karma: Math.min(25, 1 + Math.log10(amt) * 2), happiness: 2, publicImage: amt > 100000 ? 4 : 0 }); x.remember('helpedSomeone', `Gave ${x.fmt(amt)} to charity`, Math.min(30, 5 + Math.log10(amt) * 3)); if (x.curse('poverty') && amt >= x.netWorth() * 0.25) { x.c.spiritual.curses = x.c.spiritual.curses.filter((c) => c.id !== 'poverty'); return `You gave ${x.fmt(amt)}. The curse of poverty lifts.`; } return `You gave ${x.fmt(amt)}.`; } },
  // ------------------------------------------------------------------ estate
  { id: 'will', cat: 'estate', label: 'Write or change your will', ap: 0, avail: adult, options: (x) => [
    { value: 'equal', label: 'Equal shares to my children' },
    { value: 'favorite', label: 'Most to my closest child' },
    { value: 'eldest', label: 'Everything to my eldest' },
    { value: 'charity', label: 'Leave 25% to charity' },
    { value: 'clear', label: 'Tear up the will' },
  ].map((o) => ({ ...o, disabled: o.value !== 'charity' && o.value !== 'clear' && !x.rels('child').length ? 'No children' : undefined })), run: (x, arg) => {
    const kids = x.rels('child');
    if (arg === 'clear') { x.c.will = null; return 'There is no will. Expect a fight.'; }
    if (!x.c.will) x.c.will = { shares: {}, charity: 0, trustFund: false };
    const w = x.c.will;
    if (arg === 'charity') { w.charity = 0.25; x.mod('karma', 4); return '25% of your estate will go to charity.'; }
    w.shares = {};
    if (arg === 'equal') for (const k of kids) w.shares[k.npcId] = Math.round(100 / kids.length);
    if (arg === 'favorite') { const sorted = [...kids].sort((a, b) => b.affinity - a.affinity); sorted.forEach((k, i) => (w.shares[k.npcId] = i === 0 ? 70 : Math.round(30 / Math.max(1, sorted.length - 1)))); }
    if (arg === 'eldest') { const eldest = [...kids].sort((a, b) => (x.npc(a.npcId)?.birthYear ?? 0) - (x.npc(b.npcId)?.birthYear ?? 0))[0]; if (eldest) w.shares[eldest.npcId] = 100; }
    return 'Your will has been updated.';
  } },
  { id: 'memoir', cat: 'estate', label: 'Write your memoir', ap: 2, avail: (x) => (x.c.age >= 40 ? free(x) : false), run: (x) => { x.train('writing', 6); const fame = x.stat('fame'); const pay = Math.round(fame * fame * x.int(20, 80)); x.money(pay); x.mods({ fame: 3, wisdom: 3 }); const secrets = x.c.media.secrets.filter((s) => !s.exposed && x.chance(0.3)); for (const s of secrets) s.exposed = true; return `Your memoir earned ${x.fmt(pay)}.${secrets.length ? ' A few secrets slipped onto the page.' : ''}`; } },
];

export const ACTIONS: ActionDef[] = [...CORE_ACTIONS, ...ROMANCE_ACTIONS, ...FAMILY_ACTIONS, ...SOCIAL_ACTIONS, ...LEISURE_ACTIONS, ...SHOP_ACTIONS, ...SELFCARE_ACTIONS];

export const ACTION_BY_ID: Record<string, ActionDef> = Object.fromEntries(ACTIONS.map((a) => [a.id, a]));

export interface ActionView {
  id: string;
  cat: ActionCat;
  label: string;
  desc?: string;
  group?: string;
  ap: number;
  enabled: boolean;
  reason?: string;
  options?: ActionOption[];
  amount?: boolean;
}

/** Reasons that only mean "you are too young (or old) for this": such actions are hidden, not shown disabled. */
const AGE_LOCK = /^(too young|too old|adults only|kids only|age \d+\+)/i;

export function isAgeLocked(reason: string | undefined): boolean {
  return !!reason && AGE_LOCK.test(reason);
}

export function viewActions(s: GameState, cat: ActionCat, arg?: string): ActionView[] {
  const x = new Ctx(s);
  const out: ActionView[] = [];
  for (const a of ACTIONS) {
    if (a.cat !== cat) continue;
    const av = a.avail ? a.avail(x, arg) : true;
    if (av === false || (typeof av === 'string' && isAgeLocked(av))) continue;
    const apOk = x.c.ap >= a.ap;
    const options = a.options ? a.options(x, arg).filter((o) => !isAgeLocked(o.disabled)) : undefined;
    // Every choice is age-locked: hide the whole action.
    if (options && options.length === 0) continue;
    out.push({
      id: a.id,
      cat: a.cat,
      label: typeof a.label === 'function' ? a.label(x, arg) : a.label,
      desc: a.desc,
      group: a.group,
      ap: a.ap,
      enabled: av === true && apOk && s.phase === 'alive' && !s.queue.length,
      reason: av !== true ? av : !apOk ? 'No actions left this year' : undefined,
      options,
      amount: a.amount,
    });
  }
  return out;
}

export interface ActionResult {
  ok: boolean;
  text: string;
  /** Background-scene hint from the action definition (UI only). */
  scene?: string;
}

/** Perform a player-authored action. Costs action points; may queue events. */
export function performAction(s: GameState, id: string, arg?: string, amount?: number): ActionResult {
  const a = ACTION_BY_ID[id];
  if (!a) return { ok: false, text: 'Unknown action.' };
  if (s.phase !== 'alive') return { ok: false, text: 'This life is over.' };
  prepareQueue(s);
  if (s.queue.length) return { ok: false, text: 'Resolve the pending event first.' };
  const x = new Ctx(s);
  const target = arg?.split('|')[0];
  const av = a.avail ? a.avail(x, target) : true;
  if (av !== true) return { ok: false, text: av === false ? 'Not available.' : av };
  if (x.c.ap < a.ap) return { ok: false, text: 'No actions left this year. Age up.' };
  x.c.ap -= a.ap;
  let text: string;
  try {
    text = a.run(x, arg, amount);
  } catch (err) {
    ENGINE_ERRORS.push(`action ${id}: ${(err as Error).message}`);
    text = 'Something went wrong.';
  }
  if (text && s.char.alive) x.log(text, 'neutral');
  prepareQueue(s);
  const opt = arg?.includes('|') ? arg.split('|')[1] : arg;
  const scene = typeof a.scene === 'function' ? a.scene(opt, text) : a.scene;
  return { ok: true, text, scene };
}

export function marketView(s: GameState) {
  const x = new Ctx(s);
  return availableAssets(x).map((def) => {
    const ok = assetEligibility(x, def);
    return {
      id: def.id,
      name: assetName(def, x.year),
      cat: def.cat,
      price: listingPrice(x, def),
      income: def.income,
      risk: def.risk,
      acquire: def.acquire,
      investment: def.cat === 'investment',
      mortgage: mortgageAvailable(x, def),
      eligible: ok === true,
      reason: ok === true ? undefined : ok,
    };
  });
}

export function careerView(s: GameState) {
  const x = new Ctx(s);
  return Object.values(CAREER_BY_ID)
    .filter((d) => x.year >= d.years[0] && x.year <= d.years[1])
    .map((d) => {
      const ok = careerEligibility(x, d);
      return { def: d, eligible: ok === true, reason: ok === true ? undefined : ok };
    })
    .filter((v) => v.def.cat !== 'secret' || v.eligible || x.c.career?.careerId === v.def.id);
}

