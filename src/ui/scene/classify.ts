import { isSceneId, type SceneId } from './ids';

/**
 * Decides which background scene (if any) fits something that just happened.
 * Pure functions over ids and text so they can be tested in Node.
 */

/** Hand-picked scenes for specific events, checked before any keyword rule. */
const EVENT_SCENE: Record<string, SceneId> = {
  w_alienInvasion: 'aliens',
  w_ufoSighting: 'ufo',
  w_abduction: 'ufo',
  legal_arrest: 'police',
  impeachment: 'court',
  coup_against_you: 'riot',
  w_blackDeath: 'plague',
  w_goldRush: 'moneyUp',
  w_climate: 'storm',
  w_neuralImplant: 'robots',
  w_spyRecruit: 'crime',
  wp_assassin: 'fight',
  bankruptcy: 'moneyDown',
  legend_rise: 'fame',
  legend_apotheosis: 'coronation',
  c_parentOccult: 'ritual',
  c_apparition: 'ghost',
  c_cursed: 'curse',
  s_possession: 'demonic',
  ad_homeless: 'moneyDown',
  w_crisis2008: 'moneyDown',
  w_wildWest: 'fight',
  c_witnessCrime: 'crime',
  t_cyberbullying: 'scandal',
  t_successionPlot: 'coronation',
  sn_retirement: 'calm',
  radical_escalation: 'explosion',
  pol_taxAudit: 'court',
  c_royalEducation: 'study',
  w_royalCourt: 'coronation',
};

/** Ordered keyword rules; the first match wins. Checked against titles first, then text. */
const RULES: [RegExp, SceneId][] = [
  [/\balien|extraterrestrial|mothership|invaders from/i, 'aliens'],
  [/\bufos?\b|abduct|flying saucer|lights in the sky/i, 'ufo'],
  [/coronation|crowned|ascends? the throne|ascended the throne|new (king|queen|monarch)/i, 'coronation'],
  [/nuclear|atomic|explosion|explodes|bombing|\bbombs?\b|\bblast\b|terror attack/i, 'explosion'],
  [/heart attack|\bstroke\b|ambulance|emergency room|\bsurgery\b/i, 'hospital'],
  [/\bwars?\b|warfare|invasion|invade|\bbattle\b|siege|conscript|\bdrafted\b|front line|soldiers|crusade|legion|\barmy\b|\blevy\b|conquest|conquer/i, 'war'],
  [/wildfire|\bfire\b|\barson\b|burn(s|ed|ing)? down|\bblaze\b|inferno/i, 'fire'],
  [/hurricane|tornado|typhoon|\bstorms?\b|lightning|cyclone|blizzard|climate disaster/i, 'storm'],
  [/earthquake|\bquake|tremor/i, 'quake'],
  [/\bflood|tsunami|sea level|monsoon/i, 'flood'],
  [/plague|pestilence|pandemic|epidemic|smallpox|cholera|influenza|\bflu\b|\bvirus|outbreak|black death|covid|contagion|quarantine/i, 'plague'],
  [/\bcoup\b|revolution|\briots?\b|protest|uprising|rebellion|revolt|insurrection|\bstrike!|general strike|mutiny|overthrow|resistance/i, 'riot'],
  [/\barrest|\bpolice\b|\braid(ed)?\b|\bcops?\b|detective|interpol|manhunt|sting operation|the feds/i, 'police'],
  [/\bescape|breakout|jailbreak|fugitive|on the run/i, 'escape'],
  [/\bprison|\bjail|\bcell\b|cellmate|inmate|\bparole|behind bars|\bguards?\b|solitary|the yard|death row/i, 'prison'],
  [/\btrial\b|\bcourt\b|\bjudge|\bjury\b|lawsuit|\bsued\b|served papers|verdict|\bappeal(s|ed)?\b|testif|subpoena|impeach/i, 'court'],
  [/\bheist|robbery|\brob\b|burglar|\bsteal|\bstole|\btheft|\bloot|smuggl|cartel|mafia|\bmob\b|syndicate|drug deal|racket|extort|witness(ed)? (a )?(crime|murder)|something you cannot unsee/i, 'crime'],
  [/\bhack|cyber|ransomware|data breach|crypto|blockchain|algorithm/i, 'hacker'],
  [/rocket|space ?(race|station|program|colony|flight)|\bmoon\b|\bmars\b|\borbit|satellite|lunar|astronaut/i, 'rocket'],
  [/\bai\b|artificial intelligence|\brobots?\b|automation|androids?\b|neural (interface|implant)/i, 'robots'],
  [/funeral|\bdied\b|\bdies\b|death of|passed away|\bgrave\b|\bmourn|\bwidow|\bkilled\b|murdered|\bburied\b|obituary|deathbed|last goodbye/i, 'funeral'],
  [/wedding|\bmarried|\bmarry|\bpropos(e|al)|\bengaged\b|engagement|\bvows\b|\belope/i, 'wedding'],
  [/divorce|break ?up|broke up|\bdumped|heartbreak|\bcheat(ed|ing)?\b|left you|walked out/i, 'heartbreak'],
  [/birthday/i, 'birthday'],
  [/\bborn\b|\bbirth\b|newborn|pregnan|\bbaby\b|\badopt(ed|ion)?\b|\btwins\b|first words/i, 'birth'],
  [/graduat|diploma|\bdegree\b|valedictorian|commencement/i, 'graduation'],
  [/\bfired\b|laid off|layoff|redundan|lost (your|the) job|unemploy|\bdemot|\bsacked|pushed out|forced out/i, 'fired'],
  [/\bpromot|\braise\b|\bhired\b|new job|big break|\bawards?\b|\bprize\b|knighted|top of your field|pay rise|part-time job/i, 'promotion'],
  [/\bfight|\bbrawl|\bassault|\battack(ed)?\b|\bbull(y|ies|ied)\b|\bpunch|\bmugg|beat(en)? up|\bduel\b|ambush|gladiator|\bthe games\b/i, 'fight'],
  [/election|campaign|\bvotes?\b|\bvoting\b|ballot|parliament|\bsenate|\bdebate|referendum|candidate|\bpolls\b/i, 'election'],
  [/scandal|\bleak(ed|s)?\b|tabloid|\bcancel(led|ed)?\b|expos[eé]|paparazzi|rumou?rs?\b|headline|\bsmear|blackmail/i, 'scandal'],
  [/market crash|stock crash|\bcrash(es|ed)?\b.*(market|stocks|economy)|recession|hard times|depression hits|bankrupt|foreclos|bank run|inflation|rationing|debt collector|\bevict|drowning in debt|ponzi/i, 'moneyDown'],
  [/lottery|jackpot|windfall|\binherit(ance|ed)?\b|\bbonus\b|\bboom\b|\bfortune\b|\bipo\b|buyout|treasure|\bgold\b|struck oil|payday|the will\b/i, 'moneyUp'],
  [/casino|gambl|\bbets?\b|\bpoker\b|\bdice\b|horse race|\bslots?\b/i, 'casino'],
  [/\bdemon|\bdevil|\bpacts?\b|satan|\bhell\b|your soul|possess(ed|ion)|exorc|infernal|lost time|the abyss/i, 'demonic'],
  [/\bghosts?\b|haunt|s[eé]ance|apparition|poltergeist|paranormal|figure on the stairs|something in the house|doppelg/i, 'ghost'],
  [/\bcurse|\bhex\b|\bwitch|\bomens?\b|evil eye|bad luck|the old woman/i, 'curse'],
  [/secret society|\ba society\b|the society|\bcults?\b|\britual|\blodge\b|brotherhood|\binitiation|order of|freemason|illuminati|\boccult|forbidden book|candles in the basement|the compound|shadow government|ancient blood/i, 'ritual'],
  [/miracle|\bangels?\b|\bdivine|\bgods?\b|\bprayers?\b|pilgrim|\bsaint|blessing|\bholy\b|\bchurch|\btemple|mosque|synagogue|\bvisions?\b|revelation|\bfaith\b|\bconvert|baptis|confession|inquisition|holy office/i, 'holy'],
  [/overdose|\baddict|relapse|withdrawal|psychedel|\blsd\b|cocaine|heroin|\bdrugs?\b|opium|absinthe/i, 'drugs'],
  [/therapy|meditat|\bretreat\b|\brecover(y|ed)\b|\bsober|\brehab\b|mindful|burnout|running on empty|breakdown|\bgrief\b|quarter-life|midlife/i, 'calm'],
  [/hospital|diagnos|cancer|injur|accident|illness|disease|\bfever|broken (arm|leg|bone)|\bsick\b|transplant|the doctor/i, 'hospital'],
  [/\bpart(y|ies)\b|nightclub|\bclub\b|festival|\bfeast|celebrat|\brave\b|\bprom\b|\bdanc(e|ing)\b|carnival|\bgala\b|\bball\b/i, 'party'],
  [/\bfame\b|\bfamous|celebrity|\bviral\b|stardom|spotlight|red carpet|\bfans?\b|influencer|followers|talk show|legend/i, 'fame'],
  [/fireworks|new year|independence day|victory day|armistice|end of the war|peace treaty|liberation/i, 'fireworks'],
  [/\btravel|\btrip\b|vacation|abroad|emigrat|immigra|journey|voyage|\bflight\b|moved to|leaving home|expedition|strangers from the sea/i, 'travel'],
  [/\bpets?\b|\bdogs?\b|puppy|kitten|\bcats?\b|\bstray\b/i, 'pet'],
  [/\bhouses?\b|mortgage|apartment|real estate|mansion|landlord|\btenant|dream home|move out/i, 'house'],
  [/\bcars?\b|\bdriving|driver'?s licen|road trip|carriage|motorcycle/i, 'car'],
  [/\bsports?\b|\bteam\b|\brace\b|marathon|olympi|tournament|athlet|champion|\bleague\b|\bgym\b|varsity|tryout|on the field/i, 'sports'],
  [/\bschool|\bexams?\b|\btests?\b|\bstud(y|ies|ying)\b|classroom|classmates?|teacher|homework|universit|college|\btutor|spelling bee|science fair|apprentic|scholarship|library|gifted/i, 'study'],
  [/\bfriends?\b|friendship|\bbuddy|sleepover|playdate|reunion|hang(ing)? out|companion|where you sit/i, 'friends'],
  [/romance|\bcrush|\bdate\b|\bdating\b|\bkiss|\bflirt|attract|\baffair|\blove|soulmate|sweetheart|courting|girlfriend|boyfriend/i, 'love'],
  [/\bfamily|\bmother|\bfather|\bmom\b|\bdad\b|\bparents?\b|sibling|\bbrother\b|\bsister|grand(ma|pa|mother|father|child)|\bsons?\b|daughter|cousin|thanksgiving|christmas|at home/i, 'family'],
];

const CAT_FALLBACK: Record<string, SceneId> = {
  birth: 'birth',
  crime: 'crime',
  legal: 'court',
  health: 'hospital',
  mental: 'calm',
  spiritual: 'holy',
  media: 'scandal',
  politics: 'election',
  relationship: 'love',
  career: 'promotion',
  dynasty: 'family',
  assets: 'house',
  secret: 'ritual',
};

/** Last resort per category, so no event is ever without a scene. */
const CAT_DEFAULT: Record<string, SceneId> = {
  romance: 'love',
  family: 'family',
  school: 'classroom',
  work: 'office',
  leisure: 'friends',
  pets: 'pet',
  possessions: 'shopping',
  travel: 'travel',
  era: 'festival',
  birth: 'birth',
  childhood: 'playground',
  teen: 'friends',
  youngAdult: 'party',
  adult: 'family',
  midlife: 'calm',
  senior: 'aging',
  elder: 'grandparents',
  career: 'office',
  crime: 'crime',
  legal: 'court',
  relationship: 'love',
  health: 'hospital',
  mental: 'calm',
  spiritual: 'holy',
  media: 'newsroom',
  politics: 'election',
  world: 'newsroom',
  assets: 'house',
  dynasty: 'family',
  secret: 'ritual',
  chain: 'ritual',
};

export function sceneForText(text: string): SceneId | null {
  for (const [re, id] of RULES) if (re.test(text)) return id;
  return null;
}

/**
 * Scene for an event as it appears on the phone. Never empty: an explicit
 * hint on the event wins, then hand-picked ids, keyword rules and finally the
 * event's category.
 */
export function sceneForEvent(eventId: string, cat: string, title: string, text: string, hint?: string): SceneId {
  if (isSceneId(hint)) return hint;
  if (EVENT_SCENE[eventId]) return EVENT_SCENE[eventId];
  if (/^cr_.+_crisis$/.test(eventId)) return 'meeting';
  if (/^cr_.+_(break|apex)$/.test(eventId)) return 'promotion';
  return sceneForText(title) ?? sceneForText(text) ?? CAT_FALLBACK[cat] ?? CAT_DEFAULT[cat] ?? 'family';
}

/**
 * Scene for the outcome of a choice. Only strong, concrete outcomes animate;
 * a neutral "you thought about it" should not.
 */
const OUTCOME_RULES: [RegExp, SceneId][] = [
  [/\barrest(ed)?\b|handcuff|taken into custody|police (came|arrive)/i, 'police'],
  [/sentenced|prison|jail|behind bars/i, 'prison'],
  [/escaped|broke out/i, 'escape'],
  [/\bdied\b|killed|did not survive|funeral|passed away/i, 'funeral'],
  [/married|said yes|wedding|vows/i, 'wedding'],
  [/broke up|divorce|dumped|left you|heart ?broken/i, 'heartbreak'],
  [/\bborn\b|baby|newborn|adopted/i, 'birth'],
  [/hospital|injur|surgery|wounded|broke (your|a) /i, 'hospital'],
  [/fought|fight|punch|brawl|beat (him|her|them) up|beaten|attacked/i, 'fight'],
  [/explo|blew up|bomb/i, 'explosion'],
  [/fire|burned/i, 'fire'],
  [/won .*(election|seat|office)|elected/i, 'election'],
  [/promot|hired|raise|award/i, 'promotion'],
  [/fired|laid off|lost your job/i, 'fired'],
  [/jackpot|won \S*\s*\$|windfall|fortune|you (made|earned|won) [^.]*(\$|£|€|¥|₹|money|gold|coins)/i, 'moneyUp'],
  [/lost (everything|it all|\S*\s*(\$|£|€|money|savings))|bankrupt|wiped out/i, 'moneyDown'],
  [/viral|famous|headlines|fans|spotlight/i, 'fame'],
  [/scandal|exposed|leaked/i, 'scandal'],
  [/love|kiss|romance|sparks/i, 'love'],
  [/party|danced|celebrat/i, 'party'],
  [/friends?\b|laughed together|bonded/i, 'friends'],
  [/pray|blessed|miracle|divine/i, 'holy'],
  [/demon|soul|pact/i, 'demonic'],
  [/ghost|spirit/i, 'ghost'],
  [/abducted|beamed up|aliens?\b/i, 'ufo'],
  [/got away with|stole|looted|the score/i, 'crime'],
  [/flew|sailed|travelled|traveled|journey/i, 'travel'],
  [/graduat/i, 'graduation'],
];

export function sceneForOutcome(eventId: string, choiceLabel: string, outcome: string, hint?: string): SceneId | null {
  if (isSceneId(hint)) return hint;
  if (eventId === 'w_alienInvasion') {
    if (/fight/i.test(choiceLabel)) return 'war';
    if (/greet/i.test(choiceLabel)) return 'ufo';
    if (/loot/i.test(choiceLabel)) return 'crime';
    return null;
  }
  const s = `${choiceLabel}. ${outcome}`;
  for (const [re, id] of OUTCOME_RULES) if (re.test(s)) return id;
  return null;
}

/** Scene for a player action that succeeded. An explicit hint from the action wins. */
export function sceneForAction(actionId: string, arg: string | undefined, resultText: string, hint?: string, cat?: string): SceneId {
  if (isSceneId(hint)) return hint;
  return actionScene(actionId, arg, resultText) ?? ACTION_CAT_DEFAULT[cat ?? ''] ?? 'friends';
}

/** Every action category has a scene, so no action is ever silent. */
const ACTION_CAT_DEFAULT: Record<string, SceneId> = {
  health: 'checkup',
  mind: 'calm',
  lifestyle: 'shopping',
  social: 'friends',
  rel: 'friends',
  career: 'office',
  education: 'classroom',
  skills: 'study',
  crime: 'crime',
  legal: 'court',
  prison: 'prison',
  assets: 'house',
  politics: 'election',
  media: 'newsroom',
  spirit: 'holy',
  estate: 'family',
  romance: 'date',
  family: 'familyDinner',
  activity: 'friends',
  shop: 'shopping',
  pets: 'pet',
  pet: 'pet',
  selfcare: 'spa',
};

function actionScene(actionId: string, arg: string | undefined, resultText: string): SceneId | null {
  const a = (arg ?? '').split('|').pop() ?? '';
  switch (actionId) {
    case 'workout':
    case 'exercise':
    case 'p_workout':
      return 'sports';
    case 'doctor':
      return 'checkup';
    case 'treat':
    case 'cosmetic':
      return 'hospital';
    case 'diet':
      return 'cooking';
    case 'retire':
      return 'retirement';
    case 'quit':
    case 'dropOut':
    case 'resign':
      return 'fired';
    case 'workEthic':
      return 'office';
    case 'liveWithParents':
      return 'family';
    case 'lifestyleLevel':
      return 'shopping';
    case 'will':
      return 'taxes';
    case 'memoir':
      return 'reading';
    case 'witnessProtection':
      return 'moving';
    case 'shutOp':
      return 'gangMeeting';
    case 'p_behave':
      return 'prison';
    case 'rel_upbringing':
      return 'playground';
    case 'rel_cabinet':
      return 'meeting';
    case 'rel_money':
      return 'moneyUp';
    case 'apologize':
      return 'newsroom';
    case 'meditate':
    case 'therapy':
    case 'supportGroup':
    case 'recover':
    case 'medication':
      return 'calm';
    case 'party':
      return 'party';
    case 'drugs':
      return 'drugs';
    case 'gamble':
      return /won|jackpot/i.test(resultText) ? 'moneyUp' : 'casino';
    case 'vacation':
    case 'emigrate':
    case 'flee':
    case 'repatriate':
      return 'travel';
    case 'enroll':
    case 'enrollLoan':
      return 'classroom';
    case 'studyHard':
    case 'p_study':
      return 'study';
    case 'apply':
      return /hired|got the job|start/i.test(resultText) ? 'promotion' : null;
    case 'askPromotion':
      return /promot|raise/i.test(resultText) ? 'promotion' : null;
    case 'network':
    case 'befriend':
    case 'rel_time':
    case 'mentor':
    case 'protege':
    case 'rel_reconcile':
      return 'friends';
    case 'findLove':
    case 'rel_gift':
      return 'love';
    case 'rel_propose':
      return /yes|accepted|engaged/i.test(resultText) ? 'wedding' : 'heartbreak';
    case 'rel_breakup':
    case 'rel_divorce':
      return 'heartbreak';
    case 'baby':
    case 'adopt':
      return 'birth';
    case 'rel_argue':
    case 'rel_attack':
    case 'p_gang':
      return 'fight';
    case 'rel_murder':
      return 'crime';
    case 'rel_sue':
    case 'p_appeal':
      return 'court';
    case 'rel_smear':
    case 'plantSelf':
    case 'bury':
    case 'prFirm':
      return 'scandal';
    case 'crime': {
      if (/assault|murder|witnessIntimidation/.test(a)) return 'fight';
      if (/arson/.test(a)) return 'fire';
      if (/cyber|identity|fraud|embezzle|tax|counterfeit|launder/.test(a)) return 'hacker';
      if (/carTheft/.test(a)) return 'car';
      return 'crime';
    }
    case 'joinOrg':
    case 'startOp':
    case 'scaleOp':
    case 'buyDirty':
      return 'crime';
    case 'launder':
    case 'invest':
    case 'sell':
    case 'sellPart':
      return 'moneyUp';
    case 'bribePolice':
    case 'p_bribeGuard':
      return 'police';
    case 'p_escape':
      return /escape|free|over the wall|made it/i.test(resultText) ? 'escape' : 'prison';
    case 'buy':
    case 'buyMortgage':
    case 'rent':
    case 'renovate':
    case 'develop':
      if (a === 'casino') return 'casino';
      if (a === 'crypto') return 'hacker';
      if (a === 'stocks') return 'moneyUp';
      if (a === 'nightclub') return 'party';
      if (a === 'privateIsland') return 'travel';
      if (a === 'familyEstate') return 'coronation';
      if (a === 'techStartup') return 'rocket';
      return 'house';
    case 'joinParty':
    case 'campaign':
    case 'runOffice':
    case 'passLaw':
      return 'election';
    case 'declareWar':
      return 'war';
    case 'coup':
      return 'riot';
    case 'interview':
    case 'post':
      return 'fame';
    case 'pray':
    case 'worship':
    case 'convert':
    case 'foundReligion':
    case 'charity':
      return 'holy';
    case 'ritual':
      return 'demonic';
    case 'exorcism':
      return 'ghost';
    case 'joinSociety':
      return 'ritual';
    case 'practice':
      return /sport|football|soccer|tennis|swim|run|box|martial|climb|chess/i.test(a) ? 'sports' : 'study';
    default:
      return null;
  }
}

/** Scenes for what the world did this year (log entries tagged 'world' or 'major'). */
export function sceneForLog(text: string): SceneId | null {
  return sceneForText(text);
}
