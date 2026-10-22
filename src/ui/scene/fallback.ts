import type { SceneId } from './ids';

/**
 * A related scene to play if a scene is ever missing a drawing, so a gap can
 * never leave an event without an animation.
 */
export const SCENE_FALLBACK: Partial<Record<SceneId, SceneId>> = {
  date: 'love', kiss: 'love', dance: 'party', flirt: 'love', romance: 'love', nightTogether: 'love', proposal: 'wedding',
  honeymoon: 'travel', jealousy: 'heartbreak', affair: 'heartbreak', argument: 'fight', makeup: 'love', loveLetter: 'love',
  datingApp: 'love', serenade: 'love', anniversary: 'wedding', pregnancy: 'birth', babyShower: 'birth', lonely: 'heartbreak',
  stargazing: 'love', valentine: 'love', breakupText: 'heartbreak', blindDate: 'love', familyDinner: 'family', playground: 'family',
  grandparents: 'family', reunion: 'friends',
  gym: 'sports', yoga: 'calm', cinema: 'party', concert: 'party', reading: 'study', shopping: 'moneyDown', restaurant: 'party',
  cooking: 'family', beach: 'travel', camping: 'travel', hiking: 'travel', fishing: 'calm', gardening: 'calm', painting: 'study',
  music: 'party', gaming: 'friends', karaoke: 'party', spa: 'calm', amusement: 'party', museum: 'study', bar: 'party',
  volunteer: 'holy', theater: 'fame', zoo: 'pet', picnic: 'friends', roadTrip: 'car', skiing: 'sports',
  office: 'promotion', meeting: 'promotion', interview: 'promotion', classroom: 'study', exam: 'study', library: 'study',
  lab: 'study', factory: 'promotion', farm: 'family', construction: 'house', surgery: 'hospital', stage: 'fame', newsroom: 'scandal',
  startup: 'rocket', stocks: 'moneyUp', bribe: 'crime', laundering: 'moneyUp', carChase: 'police', smuggling: 'crime',
  gangMeeting: 'crime', petCat: 'pet', petHorse: 'pet', petBird: 'pet', vet: 'pet', jewelry: 'moneyUp', luxury: 'moneyUp',
  gadget: 'hacker', taxes: 'moneyDown',
  sick: 'hospital', dentist: 'hospital', checkup: 'hospital', rehab: 'calm', aging: 'calm', nursingHome: 'family', dementia: 'ghost',
  graveVisit: 'funeral', retirement: 'calm', moving: 'house', heatwave: 'fire', blizzard: 'storm', volcano: 'explosion',
  meteor: 'explosion', eclipse: 'ufo', famine: 'plague', refugees: 'travel', invention: 'study', moonLanding: 'rocket',
  internet: 'hacker', parade: 'fireworks', royalBall: 'coronation', joust: 'sports', duel: 'fight', tarot: 'curse',
  angel: 'holy', reincarnation: 'holy', seance: 'ghost', festival: 'fireworks',
};
