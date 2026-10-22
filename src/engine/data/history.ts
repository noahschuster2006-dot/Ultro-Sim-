import type { WarStatus } from '../types';

/**
 * Historically placed world events. While active they pin parts of each
 * affected country's world context; the procedural world engine fills the
 * gaps between anchors and generates the near future.
 */
export interface HistoricalEvent {
  id: string;
  name: string;
  from: number;
  to: number;
  /** 'global' or a list of country ids. */
  scope: 'global' | string[];
  war?: WarStatus;
  economy?: number;
  stability?: number;
  crime?: number;
  healthCrisis?: boolean;
  prohibition?: boolean;
  /** One-off permanent shift to social norms when the event starts. */
  norms?: number;
  /** Draft risk for military-age characters while active. */
  draft?: boolean;
  start: string;
  end?: string;
}

export const HISTORY: HistoricalEvent[] = [
  // Ancient
  { id: 'romanExpansion', name: 'Roman expansion', from: -264, to: -146, scope: ['it', 'es', 'gr', 'eg'], war: 'major', draft: true, start: 'The legions march: Rome wars with Carthage and the Greek kingdoms for mastery of the Mediterranean.' },
  { id: 'romanCivilWars', name: 'Roman civil wars', from: -49, to: -30, scope: ['it', 'gr', 'eg', 'es'], war: 'major', stability: -30, draft: true, start: 'Caesar crosses the Rubicon. The Republic tears itself apart.', end: 'Octavian stands alone; the Republic becomes an Empire.' },
  { id: 'antoninePlague', name: 'Antonine Plague', from: 165, to: 180, scope: 'global', healthCrisis: true, economy: -15, start: 'A plague brought back by returning legions sweeps the known world.', end: 'The Antonine Plague finally burns out.' },
  { id: 'christianization', name: 'Christianization of Rome', from: 313, to: 392, scope: ['it', 'gr', 'eg', 'es', 'fr', 'gb'], norms: 3, start: 'The emperor legalizes Christianity; temples and churches compete for souls.', end: 'Christianity becomes the state religion of Rome.' },
  { id: 'barbarianInvasions', name: 'Barbarian invasions', from: 376, to: 476, scope: ['it', 'fr', 'es', 'gb', 'de'], war: 'major', stability: -35, economy: -20, draft: true, start: 'Goths cross the Danube. The frontier collapses.', end: 'The last Western emperor is deposed. Rome has fallen.' },
  { id: 'justinianPlague', name: 'Plague of Justinian', from: 541, to: 549, scope: 'global', healthCrisis: true, economy: -20, stability: -10, start: 'Bubonic plague erupts in Constantinople and spreads along trade routes.', end: 'The Plague of Justinian recedes, leaving empty cities.' },
  // Medieval
  { id: 'islamicConquests', name: 'Early Islamic conquests', from: 632, to: 750, scope: ['eg', 'sa', 'ir', 'es'], war: 'major', start: 'Arab armies pour out of Arabia, toppling Persia and taking Egypt.', end: 'The great conquests settle into a vast caliphate.' },
  { id: 'vikingAge', name: 'Viking raids', from: 793, to: 1066, scope: ['gb', 'fr', 'de', 'ru'], war: 'regional', crime: 15, start: 'Longships appear off the coast. Monasteries burn.', end: 'The Norman conquest ends the age of raiders.' },
  { id: 'crusades', name: 'The Crusades', from: 1096, to: 1291, scope: ['fr', 'gb', 'de', 'it', 'eg', 'gr'], war: 'major', draft: true, start: 'The Pope calls for holy war. Knights take the cross for the East.', end: 'Acre falls. The crusader states are gone.' },
  { id: 'mongols', name: 'Mongol invasions', from: 1206, to: 1300, scope: ['cn', 'ru', 'ir'], war: 'major', stability: -30, economy: -15, start: 'The Mongol hordes ride out of the steppe.', end: 'The Mongol empire fractures into khanates.' },
  { id: 'hundredYears', name: "Hundred Years' War", from: 1337, to: 1453, scope: ['fr', 'gb'], war: 'major', draft: true, start: 'England claims the French throne. A century of war begins.', end: "The Hundred Years' War ends with England driven from France." },
  { id: 'blackDeath', name: 'The Black Death', from: 1347, to: 1351, scope: 'global', healthCrisis: true, economy: -30, stability: -20, start: 'The Black Death arrives. A third of the population will not survive.', end: 'The Black Death subsides. Labor is scarce; wages rise.' },
  { id: 'peasantsRevolt', name: "Peasants' Revolt", from: 1381, to: 1381, scope: ['gb'], stability: -25, start: 'Peasants march on London demanding an end to serfdom.' },
  // Renaissance
  { id: 'inquisition', name: 'Spanish Inquisition', from: 1478, to: 1834, scope: ['es', 'mx', 'co'], norms: -5, start: 'The Inquisition is established to root out heresy.', end: 'The Spanish Inquisition is finally abolished.' },
  { id: 'discovery', name: 'Age of Discovery', from: 1492, to: 1600, scope: ['es', 'gb', 'fr', 'it'], economy: 10, start: 'Ships return from across the ocean with tales of new continents.' },
  { id: 'conquest', name: 'Conquest of the Americas', from: 1519, to: 1540, scope: ['mx', 'co'], war: 'major', stability: -50, healthCrisis: true, start: 'Spanish conquistadors and smallpox arrive together.', end: 'The old empires of the Americas lie in ruins.' },
  { id: 'reformation', name: 'The Reformation', from: 1517, to: 1555, scope: ['de', 'ch', 'gb', 'fr'], stability: -10, norms: 3, start: 'A monk nails his theses to a church door. Christendom splits.', end: 'The Peace of Augsburg lets princes choose their faith.' },
  { id: 'witchTrials', name: 'Witch trials', from: 1580, to: 1692, scope: ['de', 'gb', 'fr', 'ch', 'us'], norms: -4, start: 'Witch-hunting fever grips the land. Accusations fly.', end: 'The last great witch trials end in shame.' },
  { id: 'thirtyYears', name: "Thirty Years' War", from: 1618, to: 1648, scope: ['de', 'fr', 'es', 'ch'], war: 'major', economy: -25, draft: true, start: 'Religious war engulfs central Europe.', end: 'The Peace of Westphalia redraws Europe.' },
  { id: 'englishCivilWar', name: 'English Civil War', from: 1642, to: 1651, scope: ['gb'], war: 'major', stability: -40, draft: true, start: 'King and Parliament go to war.', end: 'The King is executed; Cromwell rules.' },
  { id: 'piracy', name: 'Golden Age of Piracy', from: 1650, to: 1730, scope: ['gb', 'es', 'fr', 'ky', 'co', 'mx'], crime: 20, start: 'Pirates rule the Caribbean shipping lanes.', end: 'Navies hang the last great pirate captains.' },
  // Industrial
  { id: 'americanRevolution', name: 'American Revolution', from: 1775, to: 1783, scope: ['us', 'gb'], war: 'major', draft: true, start: 'Shots at Lexington. The colonies rise against the Crown.', end: 'The United States wins its independence.' },
  { id: 'frenchRevolution', name: 'French Revolution', from: 1789, to: 1799, scope: ['fr'], stability: -50, norms: 8, start: 'The Bastille falls. Liberty, equality, fraternity — and the guillotine.', end: 'Napoleon seizes power.' },
  { id: 'napoleonic', name: 'Napoleonic Wars', from: 1803, to: 1815, scope: ['fr', 'gb', 'de', 'es', 'it', 'ru'], war: 'major', draft: true, start: 'Napoleon marches across Europe.', end: 'Waterloo. Napoleon is exiled for good.' },
  { id: 'abolitionGB', name: 'Abolition of slavery (Britain)', from: 1833, to: 1833, scope: ['gb', 'za', 'au', 'ky', 'in'], norms: 6, start: 'Parliament abolishes slavery across the British Empire.' },
  { id: 'revolutions1848', name: 'Revolutions of 1848', from: 1848, to: 1849, scope: ['fr', 'de', 'it', 'ch'], stability: -25, norms: 5, start: 'Barricades go up in capitals across Europe.' },
  { id: 'goldRush', name: 'Gold rush', from: 1848, to: 1855, scope: ['us', 'au'], economy: 15, crime: 15, start: 'Gold is discovered. Fortune-seekers flood west.' },
  { id: 'usCivilWar', name: 'American Civil War', from: 1861, to: 1865, scope: ['us'], war: 'major', stability: -40, draft: true, norms: 8, start: 'Southern states secede. Brother fights brother.', end: 'The Union wins. Slavery is abolished in the United States.' },
  { id: 'meiji', name: 'Meiji Restoration', from: 1868, to: 1889, scope: ['jp'], economy: 15, norms: 5, start: 'The Shogunate falls; Japan races to industrialize.' },
  { id: 'wildWest', name: 'The Wild West', from: 1865, to: 1895, scope: ['us'], crime: 25, start: 'Outlaws, railroads and cattle drives define the frontier.' },
  { id: 'scramble', name: 'Scramble for Africa', from: 1881, to: 1914, scope: ['ng', 'za', 'eg'], stability: -30, war: 'regional', start: 'European powers carve up the continent.' },
  // Early modern
  { id: 'suffrage', name: "Women's suffrage", from: 1903, to: 1928, scope: ['gb', 'us', 'au', 'de', 'fr'], norms: 10, start: 'Suffragettes march for the vote.', end: 'Women win the vote.' },
  { id: 'ww1', name: 'World War I', from: 1914, to: 1918, scope: ['gb', 'fr', 'de', 'ru', 'it', 'us', 'au', 'in', 'za', 'jp'], war: 'world', economy: -15, draft: true, start: 'An archduke is shot in Sarajevo. The world goes to war.', end: 'The armistice is signed. Ten million soldiers are dead.' },
  { id: 'russianRevolution', name: 'Russian Revolution', from: 1917, to: 1922, scope: ['ru'], stability: -60, war: 'major', start: 'The Tsar abdicates; the Bolsheviks seize power.', end: 'The Soviet Union is founded.' },
  { id: 'spanishFlu', name: 'Spanish flu', from: 1918, to: 1920, scope: 'global', healthCrisis: true, economy: -10, start: 'An influenza pandemic kills tens of millions worldwide.', end: 'The Spanish flu pandemic ends.' },
  { id: 'prohibition', name: 'Prohibition', from: 1920, to: 1933, scope: ['us'], prohibition: true, crime: 25, start: 'Alcohol is banned. Speakeasies and bootleggers thrive.', end: 'Prohibition is repealed.' },
  { id: 'greatDepression', name: 'The Great Depression', from: 1929, to: 1939, scope: 'global', economy: -40, stability: -15, crime: 15, start: 'The stock market crashes. Banks fail. Breadlines form.', end: 'The Depression finally lifts.' },
  { id: 'spanishCivilWar', name: 'Spanish Civil War', from: 1936, to: 1939, scope: ['es'], war: 'major', stability: -50, draft: true, start: 'Spain descends into civil war.', end: 'Franco wins. A dictatorship begins.' },
  { id: 'ww2', name: 'World War II', from: 1939, to: 1945, scope: ['gb', 'fr', 'de', 'ru', 'it', 'us', 'jp', 'cn', 'au', 'in', 'za'], war: 'world', economy: -10, draft: true, start: 'Germany invades Poland. The Second World War begins.', end: 'The war ends after atomic bombs fall on Hiroshima and Nagasaki.' },
  { id: 'holocaust', name: 'The Holocaust', from: 1941, to: 1945, scope: ['de'], norms: -20, start: 'Nazi Germany begins the systematic murder of six million Jews and millions of others.', end: 'The camps are liberated. The world confronts the Holocaust.' },
  { id: 'partition', name: 'Partition of India', from: 1947, to: 1948, scope: ['in'], stability: -40, start: 'India wins independence; partition brings mass migration and violence.' },
  // Cold War
  { id: 'chineseCivilWar', name: 'Chinese Civil War', from: 1945, to: 1949, scope: ['cn'], war: 'major', stability: -40, start: 'Nationalists and Communists fight for China.', end: "The People's Republic of China is proclaimed." },
  { id: 'korea', name: 'Korean War', from: 1950, to: 1953, scope: ['us', 'cn', 'gb'], war: 'regional', draft: true, start: 'War breaks out on the Korean peninsula.', end: 'An armistice divides Korea.' },
  { id: 'civilRights', name: 'Civil rights movement', from: 1954, to: 1968, scope: ['us'], norms: 12, start: 'Activists march against segregation.', end: 'Landmark civil rights laws pass.' },
  { id: 'spaceRace', name: 'Space race', from: 1957, to: 1969, scope: ['us', 'ru'], economy: 5, start: 'Sputnik beeps overhead. The space race is on.', end: 'Humans walk on the Moon.' },
  { id: 'berlinWall', name: 'Berlin Wall', from: 1961, to: 1989, scope: ['de'], stability: -5, start: 'A wall divides Berlin overnight.', end: 'The Berlin Wall falls.' },
  { id: 'vietnam', name: 'Vietnam War', from: 1965, to: 1973, scope: ['us', 'au'], war: 'regional', draft: true, stability: -10, start: 'American combat troops land in Vietnam.', end: 'The last combat troops come home from Vietnam.' },
  { id: 'counterculture', name: 'Counterculture', from: 1966, to: 1972, scope: ['us', 'gb', 'fr', 'de', 'au'], norms: 10, start: 'Free love, protest and psychedelia reshape the culture.' },
  { id: 'oilCrisis', name: 'Oil crisis', from: 1973, to: 1975, scope: 'global', economy: -20, start: 'An oil embargo quadruples prices.' },
  { id: 'cocaineEra', name: 'Cocaine boom', from: 1975, to: 1993, scope: ['co', 'us', 'mx'], crime: 30, start: 'Colombian cocaine floods north. Cartels grow rich and violent.', end: 'The great cartels are broken up.' },
  { id: 'iranRevolution', name: 'Iranian Revolution', from: 1978, to: 1979, scope: ['ir'], stability: -50, norms: -15, start: 'The Shah falls; an Islamic Republic is declared.' },
  { id: 'aids', name: 'AIDS crisis', from: 1981, to: 1996, scope: 'global', healthCrisis: false, norms: -3, start: 'A mysterious immune disease begins killing young people.' },
  // Digital
  { id: 'sovietCollapse', name: 'Collapse of the USSR', from: 1991, to: 1993, scope: ['ru'], stability: -45, economy: -35, crime: 30, start: 'The Soviet Union dissolves. Oligarchs and gangsters fill the void.' },
  { id: 'gulfWar', name: 'Gulf War', from: 1990, to: 1991, scope: ['us', 'gb', 'sa', 'eg'], war: 'regional', start: 'A coalition goes to war to liberate Kuwait.' },
  { id: 'apartheidEnd', name: 'End of apartheid', from: 1994, to: 1994, scope: ['za'], norms: 20, start: 'South Africa holds its first free elections.' },
  { id: 'dotcom', name: 'Dot-com crash', from: 2000, to: 2002, scope: ['us', 'gb', 'de', 'jp'], economy: -20, start: 'The internet bubble bursts.' },
  { id: 'nineEleven', name: 'September 11 attacks', from: 2001, to: 2001, scope: ['us'], stability: -15, start: 'Terrorists hijack airliners and strike New York and Washington.' },
  { id: 'warOnTerror', name: 'War on terror', from: 2001, to: 2014, scope: ['us', 'gb', 'au'], war: 'regional', start: 'Troops deploy to Afghanistan, then Iraq.', end: 'Major combat operations wind down.' },
  { id: 'financialCrisis', name: 'Global financial crisis', from: 2008, to: 2010, scope: 'global', economy: -30, start: 'Lehman Brothers collapses. The global financial system seizes up.' },
  // Social media
  { id: 'arabSpring', name: 'Arab Spring', from: 2010, to: 2012, scope: ['eg', 'sa'], stability: -35, start: 'Protests organized online topple governments.' },
  { id: 'cryptoBoom', name: 'Crypto mania', from: 2017, to: 2018, scope: 'global', start: 'Bitcoin goes parabolic. Everyone is suddenly a crypto investor.' },
  { id: 'covid', name: 'COVID-19 pandemic', from: 2020, to: 2022, scope: 'global', healthCrisis: true, economy: -20, stability: -10, start: 'A novel coronavirus spreads worldwide. Lockdowns begin.', end: 'The COVID-19 emergency phase ends.' },
  { id: 'ukraineWar', name: 'War in Ukraine', from: 2022, to: 2025, scope: ['ru'], war: 'major', economy: -15, start: 'Russia launches a full-scale invasion of Ukraine.' },
  { id: 'aiEmergence', name: 'AI emergence', from: 2022, to: 2026, scope: 'global', economy: 5, start: 'Generative AI goes mainstream overnight.' },
];
