import type { EventDef } from './types';
import { check, poor } from './helpers';
import { injure } from '../systems/body';
import { trauma } from '../systems/mind';
import { endCareer, startCareer } from '../systems/careers';
import { buyAsset } from '../systems/assets';
import { commitCrime } from '../systems/legal';
import { CAREER_BY_ID } from '../data/careers';
import { expose } from '../systems/addiction';

const activeHist = (id: string) => (x: Parameters<NonNullable<EventDef['when']>>[0]) => x.s.world.activeHistorical.includes(id);

/** World-reactive and era-locked events: the world shapes the life. */
export const WORLD_EVENTS: EventDef[] = [
  // ------------------------------------------------------------------ economy
  {
    id: 'w_depression', cat: 'world', minAge: 6, cooldown: 2, weight: (x) => (x.w.economy < 25 ? 3 : 0),
    title: 'Hard times', text: (x) => (x.year >= 1929 && x.year <= 1939 ? 'Breadlines stretch around the block. Banks have failed.' : 'The economy has collapsed. Work is scarce.'),
    choices: [
      { label: 'Tighten your belt', tags: ['cautious'], run: (x) => { x.c.lifestyle = 'frugal'; x.mods({ happiness: -4, discipline: 2 }); return 'Soup, patched clothes and patience.'; } },
      { label: 'Take any work you can find', run: (x) => { x.money(x.int(200, 3000)); x.mods({ fitness: 1, stress: 4 }); return 'Odd jobs keep the lights on.'; } },
      { label: 'Turn to crime', tags: ['impulsive'], run: (x) => commitCrime(x, x.pick(['burglary', 'shoplift', 'fraud'])).text },
      { label: 'Buy assets while they are cheap', tags: ['ambitious'], when: (x) => x.c.money > 100000, run: (x) => { x.mods({ ego: 2 }); return buyAsset(x, 'stocks', { amount: Math.round(x.c.money * 0.4) }); } },
    ],
  },
  {
    id: 'w_boom', cat: 'world', minAge: 18, cooldown: 4, weight: (x) => (x.w.economy > 75 ? 1.5 : 0),
    title: 'Boom times', text: 'Everyone is getting rich. Your neighbor quit his job to day-trade.',
    choices: [
      { label: 'Invest heavily', tags: ['impulsive'], run: (x) => buyAsset(x, 'stocks', { amount: Math.max(1000, Math.round(Math.max(0, x.c.money) * 0.5)) }) },
      { label: 'Stay prudent', tags: ['cautious'], run: () => 'You remember that booms end.' },
    ],
  },
  {
    id: 'w_crisis2008', cat: 'world', minAge: 18, once: true, years: [2008, 2009], weight: 3,
    title: 'The crash', text: 'Lehman Brothers has collapsed. Your savings and pension are in freefall.',
    choices: [
      { label: 'Sell everything', tags: ['cautious'], run: (x) => { for (const a of x.c.assets.filter((q) => q.typeId === 'stocks')) a.value = Math.round(a.value * 0.6); x.mods({ stress: 8 }); return 'You locked in the losses.'; } },
      { label: 'Buy the dip', tags: ['ambitious'], when: (x) => x.c.money > 10000, run: (x) => { x.mods({ riskTolerance: 4 }); return buyAsset(x, 'stocks', { amount: Math.round(x.c.money * 0.3) }) + ' It will take years, but it pays off.'; } },
      { label: 'Do nothing', run: (x) => { x.mods({ anxiety: 6 }); return 'You stop opening the statements.'; } },
    ],
  },
  {
    id: 'w_dotcom', cat: 'world', minAge: 18, once: true, years: [1996, 2000], weight: 2,
    title: 'Dot-com fever', text: 'A startup offers you stock options instead of salary. Pets.com is worth billions.',
    choices: [
      { label: 'Join the startup', tags: ['impulsive', 'ambitious'], run: (x) => { if (x.chance(0.15)) { const m = x.int(500000, 20000000); x.money(m); x.remember('dotcom', 'Got rich in the dot-com boom', 50); return `You cashed out before the crash: ${x.fmt(m)}.`; } x.mods({ stress: 6 }); return 'The options were worthless by 2001.'; } },
      { label: 'Keep your stable job', tags: ['cautious'], run: () => 'You will tell your grandkids you were wise.' },
    ],
  },
  {
    id: 'w_cryptoMania', cat: 'world', minAge: 16, cooldown: 4, years: [2013, 2030], weight: (x) => (x.s.world.activeHistorical.includes('cryptoBoom') ? 3 : 0.6),
    title: 'Crypto mania', text: 'Your barber just told you to buy a coin with a dog on it.',
    choices: [
      { label: 'Buy in', tags: ['impulsive'], run: (x) => buyAsset(x, 'crypto', { amount: Math.max(1000, Math.round(Math.max(0, x.c.money) * 0.3)) }) },
      { label: 'Pass', tags: ['cautious'], run: () => 'Tulips, all over again.' },
    ],
  },
  {
    id: 'w_aiDisruption', cat: 'world', minAge: 18, cooldown: 4, years: [2024, 99999], weight: (x) => (x.c.career && ['service', 'business', 'legal', 'tech', 'creative'].includes(CAREER_BY_ID[x.c.career.careerId]?.cat ?? '') ? 1.5 : 0),
    title: 'Automated', text: 'Your employer announces an AI system will handle most of your job.',
    choices: [
      { label: 'Retrain as an AI trainer', tags: ['ambitious'], run: (x) => { const def = CAREER_BY_ID.aiTrainer; if (x.year >= def.years[0]) { startCareer(x, def); return 'If you cannot beat them, teach them.'; } x.train('aiDevelopment', 8); return 'You start learning how these systems work.'; } },
      { label: 'Fight for your job', run: (x) => { if (x.c.career) x.c.career.performance += 10; x.mods({ stress: 6 }); return 'You prove you add something a machine cannot — for now.'; } },
      { label: 'Take the buyout', run: (x) => { const pay = (x.c.career?.salary ?? 30000) * 0.8; x.money(pay); endCareer(x, 'Automated'); return `${x.fmt(pay)} and a handshake.`; } },
    ],
  },
  {
    id: 'w_climate', cat: 'world', minAge: 6, cooldown: 5, years: [2028, 99999], violent: true, weight: 1.2,
    title: 'Climate disaster', text: (x) => x.pick(['A superstorm floods your city.', 'Wildfires burn to the edge of town.', 'A month of 45°C heat cripples the power grid.']),
    choices: [
      { label: 'Evacuate', tags: ['cautious'], run: (x) => { x.mods({ stress: 6 }); const h = x.c.assets.find((a) => a.typeId === 'house'); if (h) { h.value = Math.round(h.value * 0.75); return 'You are safe. Your home lost a quarter of its value.'; } return 'You are safe.'; } },
      { label: 'Stay and help neighbors', tags: ['help'], run: (x) => { x.mods({ karma: 6 }); trauma(x, 8, 'disaster'); if (x.chance(0.2)) return `You were hurt: ${injure(x, false)}`; return 'You pulled three people from the water.'; } },
      { label: 'Relocate permanently inland', run: (x) => { x.mods({ loneliness: 6 }); for (const a of x.c.assets.filter((q) => q.typeId === 'house')) a.value = Math.round(a.value * 0.6); return 'You sold at a loss and moved somewhere higher.'; } },
    ],
  },
  {
    id: 'w_geneEditing', cat: 'world', minAge: 25, maxAge: 50, once: true, years: [2030, 99999], weight: (x) => (x.partner() ? 1.5 : 0),
    title: 'Designer baby', text: 'Clinics now offer embryo editing for intelligence and health.',
    choices: [
      { label: 'Edit your future children', tags: ['ambitious'], when: (x) => x.c.money > 80000, run: (x) => { x.spend(80000); x.c.flags.geneEdited = true; x.mods({ karma: -2 }); return 'Your children will be healthier and sharper than you. Critics call it eugenics.'; } },
      { label: 'Leave it to nature', tags: ['cautious'], run: () => 'Your kids will be gloriously random.' },
    ],
  },
  {
    id: 'w_neuralImplant', cat: 'world', minAge: 18, maxAge: 80, once: true, years: [2035, 99999], weight: 1,
    title: 'Neural interface', text: 'A neural implant promises to double your learning speed.',
    choices: [
      { label: 'Get the implant', tags: ['impulsive'], when: (x) => x.c.money > 50000, run: (x) => { x.spend(50000); x.mods({ smarts: 10 }); x.train('neuralInterfaces', 15); if (x.chance(0.1)) { x.mods({ paranoia: 15, anxiety: 10 }); return 'Sometimes you hear the server farm thinking.'; } return 'Information flows straight into your head.'; } },
      { label: 'Stay organic', tags: ['cautious'], run: () => 'You prefer your own thoughts.' },
    ],
  },
  {
    id: 'w_marsLottery', cat: 'world', minAge: 20, maxAge: 50, once: true, years: [2045, 99999], weight: 0.8,
    title: 'Mars colony lottery', text: 'You were selected for the next colony ship to Mars.',
    choices: [
      { label: 'Go', tags: ['impulsive', 'ambitious'], run: (x) => { const def = CAREER_BY_ID.spaceColonist; startCareer(x, def); x.mods({ fame: 10, loneliness: 15 }); x.remember('mars', 'Left Earth for Mars', 80); return 'You watch Earth shrink to a blue dot.'; } },
      { label: 'Stay on Earth', tags: ['cautious'], run: () => 'Someone else takes your seat.' },
    ],
  },
  // ------------------------------------------------------------------ war & politics
  {
    id: 'w_rationing', cat: 'world', minAge: 4, cooldown: 2, weight: (x) => (x.w.war === 'world' ? 3 : 0),
    title: 'Rationing', text: 'Sugar, butter and meat are rationed. The black market thrives.',
    choices: [
      { label: 'Make do', tags: ['cautious'], run: (x) => { x.mods({ health: -1, discipline: 2 }); return 'Victory gardens and powdered eggs.'; } },
      { label: 'Trade on the black market', tags: ['impulsive'], run: (x) => { x.money(x.int(200, 4000)); x.mods({ karma: -2, criminalRep: 2 }); x.train('streetwise', 4); return 'Nylon stockings and cigarettes are better than money.'; } },
      { label: 'Donate to the war effort', tags: ['help'], run: (x) => { x.spend(Math.min(Math.max(0, x.c.money), 500)); x.mods({ karma: 3, publicImage: 2 }); return 'Pots and pans for the factories.'; } },
    ],
  },
  {
    id: 'w_refugees', cat: 'world', minAge: 10, cooldown: 4, weight: (x) => (x.w.war !== 'none' || x.w.stability < 30 ? 1.5 : 0),
    title: 'Refugees', text: 'Families fleeing the fighting arrive in your town with nothing.',
    choices: [
      { label: 'Shelter a family', tags: ['help'], run: (x) => { x.mods({ karma: 8, stress: 3 }); x.spend(Math.min(Math.max(0, x.c.money), 2000)); x.remember('helpedSomeone', 'Sheltered a refugee family', 25); return 'They will never forget your kindness.'; } },
      { label: 'Smuggle people to safety', tags: ['help', 'impulsive'], when: (x) => x.age >= 18, run: (x) => { x.mods({ karma: 10 }); x.train('borderSmuggling', 6); if (x.chance(0.25)) return commitCrime(x, 'smuggling').text + ' But you saved lives.'; return 'You moved twelve people across the border by night.'; } },
      { label: 'Ignore them', run: () => 'Not your problem.' },
    ],
  },
  {
    id: 'w_revolution', cat: 'world', minAge: 15, cooldown: 5, violent: true, weight: (x) => (x.w.stability < 25 ? 2.5 : 0),
    title: 'Revolution', text: 'The streets are full. The regime is tottering.',
    choices: [
      { label: 'Join the revolutionaries', tags: ['impulsive', 'violent'], run: (x) => { x.mods({ heat: 15, fame: 3, karma: 2 }); trauma(x, 8, 'violence'); if (x.chance(0.4)) { x.w.regimeOverride = 'democracy'; x.w.stabShock += 15; x.remember('revolutionary', 'Fought in a revolution that won', 60); return 'The regime fell. You were there.'; } if (x.chance(0.3)) return `You were wounded: ${injure(x, true)}`; return 'The crackdown was brutal. You escaped.'; } },
      { label: 'Support the regime', run: (x) => { x.mods({ politicalApproval: 4, karma: -2 }); return 'You stand with order.'; } },
      { label: 'Keep your head down', tags: ['cautious'], run: () => 'You wait to see who wins.' },
      { label: 'Flee the country', run: (x) => { x.mods({ loneliness: 8 }); x.c.flags.refugee = true; return 'You join the line at the border.'; } },
    ],
  },
  {
    id: 'w_purge', cat: 'world', minAge: 18, cooldown: 4, weight: (x) => (x.w.regimeOverride === 'junta' && (x.stat('fame') > 30 || x.c.politics.office || x.netWorth() > 2000000) ? 2 : 0),
    title: 'The purge', text: 'The junta is arresting anyone with influence.',
    choices: [
      { label: 'Pledge loyalty publicly', tags: ['cautious'], run: (x) => { x.mods({ karma: -4, publicImage: -4 }); return 'You keep your freedom and lose some self-respect.'; } },
      { label: 'Speak out', tags: ['impulsive'], run: (x) => { x.mods({ karma: 8, fame: 6, heat: 25 }); if (x.chance(0.4)) { x.c.legal.record.push({ crime: 'Sedition', age: x.age, years: 3, countryId: x.c.countryId }); return 'You were arrested and held without trial.'; } return 'You became a symbol of resistance.'; } },
      { label: 'Move your money abroad', when: (x) => x.c.money > 100000, run: (x) => { const amt = Math.round(x.c.money * 0.7); x.c.money -= amt; x.c.crime.offshore += Math.round(amt * 0.9); return 'Your wealth is safe in Switzerland.'; } },
    ],
  },
  {
    id: 'w_spyRecruit', cat: 'world', minAge: 22, maxAge: 50, once: true, years: [1947, 1991], weight: (x) => (x.stat('smarts') > 60 ? 1.2 : 0.2),
    title: 'A man in a raincoat', text: 'A stranger in a café knows a great deal about you. He works for a foreign intelligence service.',
    choices: [
      { label: 'Become a double agent', tags: ['impulsive'], run: (x) => { x.c.flags.foreignAsset = true; x.money(x.int(5000, 40000)); x.mods({ paranoia: 10 }); x.secret('spy', 'Selling secrets to a foreign power', 9); return 'Dead drops, microfilm, constant fear.'; } },
      { label: 'Report him', tags: ['help'], run: (x) => { x.mods({ politicalApproval: 4 }); const def = CAREER_BY_ID.spy; if (x.c.education.completed.includes('university') && x.chance(0.5)) { startCareer(x, def); return 'Your own intelligence service is impressed. They recruit you.'; } return 'Agents thank you for your service.'; } },
      { label: 'Walk away', tags: ['cautious'], run: () => 'You finish your coffee and never return.' },
    ],
  },
  {
    id: 'w_nuclearDrill', cat: 'world', minAge: 5, maxAge: 16, once: true, years: [1950, 1989], weight: 1,
    title: 'Duck and cover', text: 'At school you practice hiding under your desk from atomic bombs.',
    auto: (x) => { x.mods({ anxiety: 4 }); return 'You have nightmares about mushroom clouds.'; },
  },
  {
    id: 'w_civilRights', cat: 'world', minAge: 15, once: true, when: activeHist('civilRights'), weight: 2,
    title: 'The march', text: 'Activists are marching for civil rights. Police dogs wait at the bridge.',
    choices: [
      { label: 'March with them', tags: ['help', 'impulsive'], run: (x) => { x.mods({ karma: 8, heat: 6 }); x.train('oratory', 4); if (x.chance(0.3)) { trauma(x, 8, 'violence'); return 'You were beaten and jailed overnight. You would do it again.'; } x.remember('civilRightsMarch', 'Marched for civil rights', 45); return 'History was made. You were part of it.'; } },
      { label: 'Watch from the sidelines', run: () => 'You will think about this day for a long time.' },
    ],
  },
  {
    id: 'w_counterculture', cat: 'world', minAge: 15, maxAge: 35, once: true, when: activeHist('counterculture'), weight: 2,
    title: 'The festival', text: 'Half a million people in a muddy field. Music, love, and pharmaceuticals.',
    choices: [
      { label: 'Turn on, tune in', tags: ['impulsive'], run: (x) => { x.mods({ happiness: 10, creativity: 6, paranormal: 4 }); if (x.chance(0.3)) expose(x, 'stimulants', 0.6); return 'You saw the universe. It was paisley.'; } },
      { label: 'Stay home', tags: ['cautious'], run: () => 'You watched it on the news.' },
    ],
  },
  {
    id: 'w_nineEleven', cat: 'world', minAge: 18, maxAge: 35, once: true, years: [2001, 2002], when: (x) => x.c.countryId === 'us', weight: 3,
    title: 'After the towers fell', text: 'Recruiters are everywhere. The country wants to fight back.',
    choices: [
      { label: 'Enlist', run: (x) => { startCareer(x, CAREER_BY_ID.soldier); x.mods({ karma: 2 }); return 'You ship out to basic training.'; } },
      { label: 'Volunteer at home', tags: ['help'], run: (x) => { x.mods({ karma: 4 }); return 'You give blood and help where you can.'; } },
    ],
  },
  {
    id: 'w_covidRemote', cat: 'world', minAge: 18, maxAge: 70, once: true, years: [2020, 2021], weight: (x) => (x.c.career ? 2 : 0),
    title: 'Working from home', text: 'The office is closed indefinitely. Your commute is now 10 steps.',
    auto: (x) => { x.mods({ loneliness: 8, stress: -3, fitness: -3 }); return 'Sweatpants are business attire now.'; },
  },
  // ------------------------------------------------------------------ the truth is out there
  {
    id: 'w_ufoSighting', cat: 'world', minAge: 6, cooldown: 15, years: [1900, 99999], weight: (x) => 0.12 + x.stat('paranormal') / 300,
    title: 'Lights in the sky', text: 'Three silent lights hover over the town, then shoot away faster than anything you have ever seen.',
    choices: [
      { label: 'Film it', tags: ['impulsive'], when: (x) => x.year >= 1950, run: (x) => { x.mods({ paranormal: 8 }); if (x.chance(0.3)) { x.mods({ fame: 6 }); return 'Your footage goes viral. Half the internet calls it a hoax.'; } return 'The video is just blurry dots. Nobody believes you.'; } },
      { label: 'Report it to the authorities', tags: ['cautious'], run: (x) => { x.mods({ paranoia: 4 }); return 'Two men in dark suits visit the next day and take your statement — and your notes.'; } },
      { label: 'Pretend you saw nothing', run: (x) => { x.mod('anxiety', 2); return 'You sleep with the curtains closed for a week.'; } },
    ],
  },
  {
    id: 'w_alienInvasion', cat: 'world', minAge: 8, once: true, years: [1950, 99999], violent: true, weight: (x) => (x.year >= 2027 ? 0.08 : 0.02),
    title: 'They came from the sky', text: 'Enormous ships blot out the sun. Beams of light carve through the city. The broadcasts say this is not a drill.',
    choices: [
      { label: 'Fight back with the resistance', tags: ['violent', 'ambitious'], run: (x) => {
        trauma(x, 20, 'combat');
        x.train('tacticalShooting', 8);
        x.s.world.chronicle.push({ year: x.year, countryId: null, title: 'Alien invasion', text: 'Extraterrestrial ships attack cities worldwide before withdrawing as suddenly as they came.' });
        if (x.chance(0.35)) { x.mods({ fame: 20, publicImage: 15, confidence: 10 }); x.remember('alienHero', 'Fought off the alien invasion', 85); return 'You brought down a ship. The world knows your name.'; }
        if (x.chance(0.3)) return `You survived, barely: ${injure(x, true)}`;
        return 'The ships withdrew as suddenly as they came. Nobody knows why.';
      } },
      { label: 'Hide in a bunker with your family', tags: ['cautious'], run: (x) => { trauma(x, 10, 'disaster'); for (const r of x.rels('parent', 'spouse', 'child', 'sibling')) x.relMod(r.npcId, 8, 8); x.remember('alienSurvivor', 'Survived the alien invasion underground', 60); return 'Three days in the dark, holding each other. When you emerged, the sky was empty.'; } },
      { label: 'Walk out and greet them', tags: ['impulsive'], run: (x) => { x.mods({ paranormal: 25, smarts: 6, paranoia: 10 }); x.remember('abducted', 'Taken aboard an alien ship', 90); return 'Light. Weightlessness. You wake up in a field a week later, knowing things no human should know.'; } },
      { label: 'Loot the abandoned stores', tags: ['impulsive'], run: (x) => { x.money(x.int(2000, 40000)); x.mods({ karma: -6 }); return 'While the world ended, you stocked up on electronics.'; } },
    ],
  },
  {
    id: 'w_abduction', cat: 'secret', minAge: 12, once: true, secret: true, years: [1900, 99999], weight: (x) => (x.stat('paranormal') >= 60 ? 0.4 : 0),
    title: 'Missing time', text: 'You were driving home. Then it was four hours later and you were standing in a field, your clothes on backwards.',
    choices: [
      { label: 'Tell everyone', tags: ['impulsive'], run: (x) => { x.mods({ fame: 5, publicImage: -8, paranormal: 10 }); return 'You are now a regular on late-night conspiracy radio.'; } },
      { label: 'Keep it to yourself', tags: ['cautious'], run: (x) => { x.mods({ anxiety: 8, paranormal: 8 }); x.secret('abduction', 'An alien abduction', 2); return 'Some nights you dream of a cold metal table.'; } },
    ],
  },
  // ------------------------------------------------------------------ era-locked history
  {
    id: 'w_crusade', cat: 'world', minAge: 16, maxAge: 45, once: true, when: activeHist('crusades'), weight: (x) => (x.c.gender !== 'female' ? 2 : 0.5),
    title: 'Take the cross', text: 'The Pope calls for a crusade. Salvation is promised to those who go.',
    choices: [
      { label: 'Take the cross', tags: ['impulsive', 'violent'], run: (x) => { x.mods({ faith: 10, sin: -10 }); trauma(x, 18, 'combat'); x.train('swordsmanship', 10); if (x.chance(0.35)) return `You returned scarred: ${injure(x, true)}`; if (x.chance(0.3)) { x.money(x.int(5000, 60000)); return 'You returned with loot from the East.'; } return 'You saw Jerusalem. You saw horrors.'; } },
      { label: 'Stay home', tags: ['cautious'], run: () => 'Someone has to plant the fields.' },
    ],
  },
  {
    id: 'w_blackDeath', cat: 'world', minAge: 0, cooldown: 1, when: activeHist('blackDeath'), weight: 4,
    title: 'The pestilence', text: 'Bodies are piled in the streets. Bells toll all day.',
    choices: [
      { label: 'Flee to the countryside', tags: ['cautious'], run: (x) => { if (x.chance(0.2)) { x.mod('health', -40); return 'The plague followed you.'; } return 'You escaped, for now.'; } },
      { label: 'Stay and pray', run: (x) => { x.mod('faith', 8); if (x.chance(0.35)) { x.mod('health', -45); return 'The buboes came. You survived — barely.'; } return 'God spared you.'; } },
      { label: 'Join the flagellants', tags: ['impulsive'], run: (x) => { x.mods({ faith: 12, health: -10, sin: -8 }); return 'Whipping yourself in the streets to atone for the world.'; } },
    ],
  },
  {
    id: 'w_witchHunt', cat: 'world', minAge: 15, cooldown: 6, when: activeHist('witchTrials'), weight: (x) => (x.c.gender === 'female' ? 1.5 : 0.5) + x.stat('paranormal') / 50,
    title: 'Accused', text: 'A neighbor has accused you of witchcraft.',
    choices: [
      { label: 'Plead innocence', tags: ['cautious'], run: (x) => { if (check(x, x.stat('charisma') + x.stat('publicImage') / 2, 60)) return 'The magistrate dismissed the charge.'; trauma(x, 15, 'abuse'); if (x.chance(0.25)) { x.c.legal.record.push({ crime: 'Witchcraft', age: x.age, years: 0, countryId: x.c.countryId }); x.mods({ publicImage: -20 }); return 'You survived the trial, but your name is ruined.'; } return 'They swam you. You floated. Somehow you escaped.'; } },
      { label: 'Accuse someone else', tags: ['impulsive'], run: (x) => { x.mods({ karma: -15, sin: 8 }); x.remember('accusedOther', 'Accused someone else of witchcraft to save myself', 40); return 'Another woman burned. You lived.'; } },
      { label: 'Flee town', run: (x) => { x.mods({ loneliness: 10 }); return 'You left everything behind.'; } },
    ],
  },
  {
    id: 'w_inquisition', cat: 'world', minAge: 15, cooldown: 8, when: activeHist('inquisition'), weight: (x) => (x.c.religionId !== 'christianity' ? 2 : 0.4),
    title: 'The Holy Office', text: 'Inquisitors are questioning your family about their faith.',
    choices: [
      { label: 'Convert publicly', tags: ['cautious'], run: (x) => { x.c.religionId = 'christianity'; x.mods({ faith: -5, sin: 4 }); return 'You go to Mass. You keep your old prayers in your heart.'; } },
      { label: 'Refuse', tags: ['impulsive'], run: (x) => { trauma(x, 20, 'abuse'); x.mods({ faith: 10 }); if (x.chance(0.3)) { x.c.legal.record.push({ crime: 'Heresy', age: x.age, years: 3, countryId: x.c.countryId }); return 'Years in the Inquisition\'s cells.'; } return 'You were tortured, and released.'; } },
      { label: 'Bribe the inquisitor', when: (x) => x.c.money > 3000, run: (x) => { x.spend(3000); x.mod('corruption', 3); return 'Even holy men have prices.'; } },
    ],
  },
  {
    id: 'w_goldRush', cat: 'world', minAge: 16, maxAge: 50, once: true, when: activeHist('goldRush'), weight: 2,
    title: 'Gold!', text: 'Gold has been discovered. Everyone is heading west.',
    choices: [
      { label: 'Go prospecting', tags: ['impulsive'], run: (x) => { x.train('mining', 10); if (x.chance(0.12)) { const g = x.int(20000, 400000); x.money(g); x.remember('goldStrike', 'Struck gold', 55); return `You struck it rich: ${x.fmt(g)}!`; } x.mods({ health: -6 }); return 'Mud, fever and nothing. The shopkeepers got rich.'; } },
      { label: 'Sell shovels to the miners', tags: ['ambitious'], run: (x) => { x.money(x.int(3000, 30000)); x.train('sales', 6); return 'The surest gold is selling to gold-seekers.'; } },
      { label: 'Stay put', tags: ['cautious'], run: () => 'Fool\'s gold, you say.' },
    ],
  },
  {
    id: 'w_wildWest', cat: 'world', minAge: 16, cooldown: 5, violent: true, when: activeHist('wildWest'), weight: 1.2,
    title: 'High noon', text: 'A drunk gunslinger calls you out in the street.',
    choices: [
      { label: 'Draw', tags: ['violent', 'impulsive'], run: (x) => { x.train('marksmanship', 6); if (check(x, x.skill('marksmanship') + x.stat('dexterity'), 75)) { x.mods({ fame: 6, fear: 8 }); return 'You were faster. The town buys you drinks.'; } return `You lost: ${injure(x, true)}`; } },
      { label: 'Walk away', tags: ['cautious'], run: (x) => { x.mod('streetCred', -3); return 'Cowardice keeps you alive.'; } },
    ],
  },
  {
    id: 'w_factoryAccident', cat: 'world', minAge: 8, cooldown: 4, years: [1760, 1920], weight: (x) => (x.c.career && ['factoryWorker', 'miner'].includes(x.c.career.careerId) ? 2 : x.c.flags.noSchooling ? 0.5 : 0),
    title: 'The machines', text: 'A boiler explodes on the factory floor.',
    auto: (x) => { trauma(x, 8, 'disaster'); if (x.chance(0.4)) return `You were caught in it: ${injure(x, false)}`; return 'You helped carry out the injured. The owner docked everyone\'s pay for lost time.'; },
  },
  {
    id: 'w_strike', cat: 'world', minAge: 16, cooldown: 5, years: [1830, 1990], weight: (x) => (x.c.career && ['factoryWorker', 'miner', 'constructionWorker', 'truckDriver'].includes(x.c.career.careerId) ? 1.5 : 0),
    title: 'Strike!', text: 'The union calls a strike. The bosses hire strikebreakers.',
    choices: [
      { label: 'Walk the picket line', tags: ['help'], run: (x) => { x.mods({ karma: 4, streetCred: 4 }); if (x.chance(0.25)) { trauma(x, 6, 'violence'); return 'Company thugs broke the line with clubs.'; } if (x.chance(0.5)) { if (x.c.career) x.c.career.salary = Math.round(x.c.career.salary * 1.15); return 'The bosses caved. A raise for everyone.'; } return 'The strike failed. Some never got their jobs back.'; } },
      { label: 'Cross the line', run: (x) => { x.mods({ karma: -3, streetCred: -8 }); return '"Scab," they spit at you.'; } },
      { label: 'Organize the strike', tags: ['ambitious'], run: (x) => { const def = CAREER_BY_ID.laborOrganizer; x.train('oratory', 6); if (x.year <= def.years[1]) { startCareer(x, def); return 'You become the voice of the workers.'; } return 'You lead them to victory.'; } },
    ],
  },
  {
    id: 'w_suffrage', cat: 'world', minAge: 18, once: true, when: activeHist('suffrage'), weight: (x) => (x.c.gender === 'female' ? 2 : 0.5),
    title: 'Votes for women', text: 'Suffragettes are chaining themselves to railings and smashing windows.',
    choices: [
      { label: 'Join the movement', tags: ['help', 'impulsive'], run: (x) => { x.mods({ karma: 6, heat: 6 }); x.train('oratory', 5); x.remember('suffragist', 'Fought for women\'s suffrage', 40); if (x.chance(0.25)) return 'Arrested and force-fed in prison. You did not break.'; return 'You marched. The tide is turning.'; } },
      { label: 'Stay out of politics', run: () => 'Others will fight this battle.' },
    ],
  },
  {
    id: 'w_resistance', cat: 'world', minAge: 16, maxAge: 50, once: true, years: [1940, 1945], when: (x) => ['fr', 'it', 'gr', 'de', 'ru', 'cn'].includes(x.c.countryId), weight: 2,
    title: 'The resistance', text: 'A neighbor whispers: the resistance needs couriers.',
    choices: [
      { label: 'Join the resistance', tags: ['impulsive', 'help'], run: (x) => { const def = CAREER_BY_ID.resistanceFighter; startCareer(x, def); x.mods({ karma: 8 }); return 'Coded messages hidden in bicycle handlebars.'; } },
      { label: 'Collaborate with the occupiers', run: (x) => { x.money(x.int(2000, 20000)); x.mods({ karma: -15, sin: 6 }); x.secret('collaborator', 'Collaborated with the occupation', 9); return 'Comfort, at a terrible price.'; } },
      { label: 'Survive quietly', tags: ['cautious'], run: () => 'You keep your head down and your family alive.' },
    ],
  },
  {
    id: 'w_conquest', cat: 'world', minAge: 6, cooldown: 3, violent: true, when: activeHist('conquest'), weight: 2.5,
    title: 'Strangers from the sea', text: 'Armored strangers and a terrible sickness arrive together.',
    choices: [
      { label: 'Fight', tags: ['violent'], run: (x) => { trauma(x, 15, 'combat'); if (x.chance(0.4)) return `Wounded: ${injure(x, true)}`; return 'You fought, and survived.'; } },
      { label: 'Flee to the mountains', tags: ['cautious'], run: (x) => { x.mods({ health: -5 }); return 'The mountains shelter you.'; } },
    ],
  },
  {
    id: 'w_gladiatorGames', cat: 'world', minAge: 10, cooldown: 4, years: [-264, 440], when: (x) => x.c.countryId === 'it', weight: 1,
    title: 'The games', text: 'The emperor is holding games in the arena.',
    choices: [
      { label: 'Bet on a gladiator', tags: ['impulsive'], run: (x) => { const net = x.int(-500, 700); x.money(net); return net > 0 ? 'Your gladiator won!' : 'Your gladiator lost. So did you.'; } },
      { label: 'Volunteer to fight', tags: ['violent', 'ambitious'], when: (x) => x.age >= 17, run: (x) => { startCareer(x, CAREER_BY_ID.gladiator); return 'The crowd roars your name.'; } },
    ],
  },
  {
    id: 'w_explorer', cat: 'world', minAge: 16, maxAge: 40, once: true, when: activeHist('discovery'), weight: 1.5,
    title: 'Ships to the New World', text: 'Captains seek crew for voyages across the ocean.',
    choices: [
      { label: 'Sign on', tags: ['impulsive', 'ambitious'], run: (x) => { x.train('sailing', 12); if (x.chance(0.25)) return `Scurvy and storms: ${injure(x, false)}`; if (x.chance(0.3)) { x.money(x.int(5000, 50000)); x.mod('fame', 4); return 'You returned with gold and stories.'; } return 'Months at sea. You saw a new world.'; } },
      { label: 'Stay ashore', tags: ['cautious'], run: () => 'The sea is for madmen.' },
    ],
  },
  {
    id: 'w_feudalLevy', cat: 'world', minAge: 16, maxAge: 45, cooldown: 4, years: [500, 1500], weight: (x) => (x.c.gender !== 'female' && poor(x) && x.w.war !== 'none' ? 2 : 0),
    title: 'Your lord calls', text: 'Your lord demands every able man join his levy.',
    choices: [
      { label: 'Answer the call', tags: ['violent'], run: (x) => { trauma(x, 12, 'combat'); x.train('weaponsTraining', 8); if (x.chance(0.3)) return `You came home maimed: ${injure(x, true)}`; return 'You marched, you fought, you came home.'; } },
      { label: 'Hide in the woods', tags: ['cautious'], run: (x) => { if (x.chance(0.3)) { x.c.legal.record.push({ crime: 'Desertion', age: x.age, years: 0, countryId: x.c.countryId }); return 'Caught and flogged.'; } return 'Nobody came looking.'; } },
    ],
  },
  {
    id: 'w_royalCourt', cat: 'world', minAge: 16, cooldown: 4, years: [-800, 1900], weight: (x) => (['aristocracy', 'royalty'].includes(x.c.familyStatus) ? 1.5 : 0),
    title: 'Intrigue at court', text: 'A powerful duke seeks your support against the royal chancellor.',
    choices: [
      { label: 'Back the duke', tags: ['ambitious'], run: (x) => { if (x.chance(0.5)) { x.mods({ politicalApproval: 10, fame: 4 }); return 'The chancellor falls. You rise.'; } x.mods({ politicalApproval: -10, heat: 10 }); return 'The plot failed. You are watched now.'; } },
      { label: 'Warn the chancellor', run: (x) => { x.mods({ politicalApproval: 6, karma: 2 }); return 'The chancellor owes you.'; } },
      { label: 'Stay neutral', tags: ['cautious'], run: () => 'Neutrality is a kind of safety.' },
    ],
  },
];

