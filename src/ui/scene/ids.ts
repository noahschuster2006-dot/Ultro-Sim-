/**
 * Every background scene that can play behind the phone, with what it shows.
 * Each group is drawn in its own file (see the comment above each list).
 * Group A (world, danger, crime, money) lives in scenesWorld.ts;
 * group B (people, feelings, life milestones, spirit) lives in scenesLife.ts.
 */
export const WORLD_SCENES = [
  'aliens', // UFO fleet invades: saucers, tractor beams, lasers, city lights flicker, then they leave
  'ufo', // a single saucer drifts across a night sky and beams briefly
  'war', // explosions, smoke, tracers / arrows (pre-1600) and marching soldiers
  'explosion', // one big blast with flash, shockwave and debris
  'fire', // a building on fire, flames and rising smoke
  'storm', // dark clouds, heavy rain, lightning flashes
  'quake', // shaking skyline, cracks, falling dust and debris
  'flood', // rising water and rain over the skyline
  'plague', // sickly green haze, drifting germ particles
  'hospital', // ambulance lights, heartbeat monitor line
  'police', // red/blue strobes, police car / lantern-bearing watchmen pre-1850
  'prison', // bars slide shut across the view, cold grey
  'court', // columns, a gavel slams with an impact ring
  'escape', // searchlights sweep, a figure runs and climbs out
  'crime', // masked figure with a sack of loot under a searchlight
  'fight', // two figures brawl, impact bursts
  'riot', // crowd with raised fists, torches, flags, smoke (revolutions, protests, coups)
  'election', // podium, flags, crowd cheering, ballots/confetti
  'scandal', // newspapers / phones swirling with headlines and flashes
  'moneyUp', // banknotes and coins raining, gold sparkle
  'moneyDown', // red crashing chart line, papers blowing away
  'casino', // dice tumbling, chips, slot symbols
  'hacker', // green code rain
  'rocket', // rocket launch with exhaust plume
  'robots', // marching robot silhouettes with glowing eyes
] as const;

export const LIFE_SCENES = [
  'funeral', // rain, grey, tombstone, candles, a mourner
  'birth', // soft pastel glow, floating stars and hearts, a cradle
  'love', // two figures, sunset, hearts floating up
  'wedding', // flower arch, two figures, confetti, bells
  'heartbreak', // a heart cracks in two under rain
  'friends', // two or three friends laughing together (speech bubbles, coffee/park)
  'party', // disco lights, dancing silhouettes, confetti
  'family', // warm house windows, family figures together
  'graduation', // caps thrown into the air
  'promotion', // rising arrow, office skyline, confetti
  'fired', // a figure carrying a box out in the rain
  'sports', // a runner / stadium lights, cheering
  'study', // chalkboard formulas, books, light bulb
  'holy', // golden rays through clouds, a dove
  'demonic', // red sky, flames, glowing sigil, horned shadow
  'ghost', // mist and a translucent ghost floating
  'curse', // purple fog swirling around a watching eye
  'ritual', // hooded figures around candles (secret societies)
  'travel', // plane (or sailing ship pre-1900) crossing the sky
  'drugs', // psychedelic swirling colours
  'calm', // zen sunset with ripples (meditation, therapy, recovery)
  'birthday', // balloons rising and a cake glow
  'fireworks', // fireworks bursting
  'fame', // spotlights, camera flashes, red carpet
  'coronation', // a crown descending in light, trumpet banners
  'pet', // a happy dog wagging its tail
  'house', // a house with a SOLD sign and keys
  'car', // a car speeding past (horse carriage pre-1900)
] as const;

/** Love, intimacy (always tasteful, fade-to-black), family. Drawn in scenesRomance.ts. */
export const ROMANCE_SCENES = [
  'date', // candlelit dinner for two at a restaurant table, wine glasses, a waiter, soft glow
  'kiss', // two silhouettes leaning in for a kiss under a streetlamp or the moon, a little burst of hearts
  'dance', // a couple slow-dancing under string lights, music notes drifting
  'flirt', // one figure winks at another across a bar or café, sparkles and a small heart
  'romance', // a couple walking hand in hand along a beach at sunset
  'nightTogether', // fade to black, nothing shown: a house at night, a window light switches off, hearts drift out, the moon smiles
  'proposal', // one figure on one knee, a ring box opens with a sparkle, the partner's hands fly to their face
  'honeymoon', // a tropical bungalow over the water, palm trees, sunset, two figures in a hammock
  'jealousy', // a figure peeking from behind a wall at a happy couple, green aura, steam from the ears
  'affair', // two figures in trench coats meeting secretly under a streetlamp, a third silhouette watching from a window
  'argument', // a couple arguing, a storm cloud over their heads, jagged speech bubbles
  'makeup', // a couple hugging as the rain stops and a rainbow appears, hearts
  'loveLetter', // envelopes with heart seals fluttering through the air, one opening
  'datingApp', // a giant phone showing profile cards swiping left and right, then a big MATCH burst
  'serenade', // a figure with a guitar or lute beneath a balcony, roses, music notes, partner leaning out
  'anniversary', // two champagne glasses clinking, a cake with candles, sparkles
  'pregnancy', // a couple with hands on a pregnant belly, soft glow, a tiny heartbeat line and floating baby socks
  'babyShower', // pastel balloons, wrapped gifts, a stork flying past with a bundle
  'lonely', // a single figure at a rainy window at night holding a cup of tea
  'stargazing', // a couple lying on a hill under a starry sky, a shooting star
  'valentine', // giant heart balloons rising, roses and a box of chocolates
  'breakupText', // a phone showing a message with a cracking heart, a figure walking away in the rain
  'blindDate', // two figures at a table with question marks and nervous sweat drops, then a shy heart
  'familyDinner', // a big family table with food, figures raising glasses
  'playground', // a parent pushing a child on a swing, a slide and a sandbox
  'grandparents', // an elderly couple on a porch swing with grandchildren playing nearby
  'reunion', // two figures running toward each other and hugging, sparkles
] as const;

/** Leisure and outings. Drawn in scenesLeisure.ts. */
export const LEISURE_SCENES = [
  'gym', // weights, a treadmill, a figure lifting a barbell with sweat drops
  'yoga', // a figure in a yoga pose on a mat at sunrise, leaves drifting
  'cinema', // dark theatre, glowing screen, popcorn, silhouettes of audience heads
  'concert', // a stage with a band and coloured lights, crowd hands up
  'reading', // a cozy armchair and lamp, an open book with letters floating up
  'shopping', // storefronts, a figure carrying many shopping bags, price tags fluttering
  'restaurant', // a chef presenting a dish under a cloche, steam, plates (dining out)
  'cooking', // a kitchen stove, a pan flipping food, steam and sizzle
  'beach', // sand, umbrella, waves, sun and a beach ball
  'camping', // a tent and campfire with sparks in a night forest, marshmallows
  'hiking', // a mountain trail, a figure with a backpack, a summit flag
  'fishing', // a figure on a dock with a rod, a bobber, a fish jumping
  'gardening', // garden beds, flowers growing up, a watering can
  'painting', // an easel with a canvas being painted, a palette
  'music', // a figure playing guitar or piano with music notes floating (practice and performing for fun)
  'gaming', // a glowing screen with a controller and pixel effects; a board game before the 1970s
  'karaoke', // a microphone, lyrics on a screen, a spotlight, singers
  'spa', // a hot tub with bubbles, cucumber slices, towels, steam
  'amusement', // a rollercoaster loop and a Ferris wheel with screaming riders
  'museum', // a gallery with framed art and a dinosaur skeleton, visitors
  'bar', // a pub or tavern counter, mugs clinking, a bartender
  'volunteer', // a soup kitchen or tree planting, helping hands, hearts
  'theater', // stage curtains opening, actors bowing, roses thrown
  'zoo', // an elephant and a giraffe, children watching
  'picnic', // a blanket and basket in a park, sandwiches, butterflies
  'roadTrip', // a car (or wagon before 1900) on a winding road through mountains, map pins
  'skiing', // a snowy slope, a skier spraying snow, pine trees
] as const;

/** Work, school, money, possessions and pets. Drawn in scenesWork.ts. */
export const WORK_SCENES = [
  'office', // a desk with papers and a computer (quill before 1850, typewriter before 1980), a figure typing, a clock ticking
  'meeting', // a conference table, a chart on the wall, figures nodding
  'interview', // two chairs facing each other, a résumé, a handshake
  'classroom', // a teacher at the board, students at desks raising hands
  'exam', // a test paper with a big grade, a pencil, a ticking clock
  'library', // tall shelves, a rolling ladder, books floating
  'lab', // a scientist with bubbling beakers and a microscope, a eureka spark
  'factory', // an assembly line, turning gears, smokestacks
  'farm', // fields, a tractor (an ox and plough before 1920), a barn, crops growing
  'construction', // a crane and a building frame rising, hard hats
  'surgery', // an operating room with bright lights, masked figures, a heart monitor
  'stage', // a performer under a spotlight bowing to applause (professional performance)
  'newsroom', // a news desk with a camera and a BREAKING banner (town crier before 1600)
  'startup', // a garage with a laptop, a rocket doodle, a money plant growing
  'stocks', // a trading floor with screens of tickers moving up and down
  'bribe', // an envelope of cash slid across a table, a shady handshake
  'laundering', // a washing machine spinning banknotes
  'carChase', // a police car chasing a getaway car with speed lines (horses before 1910)
  'smuggling', // a boat at night with crates, a lighthouse beam sweeping
  'gangMeeting', // shadowy figures around a table under a hanging lamp, cigar smoke
  'petCat', // a cat curled up with a yarn ball, purring hearts
  'petHorse', // a horse galloping across a meadow
  'petBird', // a parrot on a perch, feathers, a speech bubble
  'vet', // a vet clinic, a pet on the table getting a bandage, a heart
  'jewelry', // rings and a necklace sparkling in a display case
  'luxury', // a yacht on the water with champagne and sun glare
  'gadget', // unboxing a new gadget that glows (radio, TV, computer or phone for the era)
  'taxes', // giant paper forms, a calculator, sweat drops
] as const;

/** Health, ageing, nature, history, culture and the unseen. Drawn in scenesEra.ts. */
export const ERA_SCENES = [
  'sick', // a figure in bed with a thermometer, tissues and a bowl of soup
  'dentist', // a giant tooth, a dentist chair, a sparkle
  'checkup', // a doctor with a stethoscope and clipboard, a heart icon
  'rehab', // a circle of chairs, supportive hands, a sunrise
  'aging', // a clock face spinning, leaves falling, a figure turning grey
  'nursingHome', // elderly figures in a garden with a nurse and a wheelchair
  'dementia', // faded photographs drifting into fog
  'graveVisit', // a figure placing flowers at a grave in autumn
  'retirement', // a rocking chair on a porch at sunset, a gold watch
  'moving', // a moving truck (a cart before 1910) with boxes, a new front door
  'heatwave', // a scorching sun, heat shimmer, cracked ground
  'blizzard', // a snowstorm, howling wind, buried cars or carts
  'volcano', // an eruption with lava and ash clouds
  'meteor', // a fiery meteor streaking across the sky, a distant flash
  'eclipse', // the sun covered by the moon, a corona, people looking up
  'famine', // dry fields, empty bowls, dust blowing
  'refugees', // a line of figures walking with bundles across a landscape
  'invention', // a giant light bulb flickering on, gears and sparks
  'moonLanding', // an astronaut planting a flag on the moon, Earth in the sky
  'internet', // a globe wrapped in glowing network lines and data packets
  'parade', // a marching band, floats and confetti
  'royalBall', // chandeliers, nobles waltzing in gowns
  'joust', // knights on horses charging with lances, banners
  'duel', // two figures with swords or pistols at dawn in the mist
  'tarot', // a fortune teller with a crystal ball, cards flipping
  'angel', // an angel with wings descending in a column of light
  'reincarnation', // a spiral of light, a soul orb rising into the stars
  'seance', // candles around a table, joined hands, a spectral glow
  'festival', // a cultural festival: lanterns, a dragon dance, coloured powder
] as const;

export type WorldSceneId = (typeof WORLD_SCENES)[number];
export type LifeSceneId = (typeof LIFE_SCENES)[number];
export type RomanceSceneId = (typeof ROMANCE_SCENES)[number];
export type LeisureSceneId = (typeof LEISURE_SCENES)[number];
export type WorkSceneId = (typeof WORK_SCENES)[number];
export type EraSceneId = (typeof ERA_SCENES)[number];
export type SceneId = WorldSceneId | LifeSceneId | RomanceSceneId | LeisureSceneId | WorkSceneId | EraSceneId;

export const ALL_SCENES: readonly SceneId[] = [...WORLD_SCENES, ...LIFE_SCENES, ...ROMANCE_SCENES, ...LEISURE_SCENES, ...WORK_SCENES, ...ERA_SCENES];

export function isSceneId(s: string | undefined | null): s is SceneId {
  return !!s && (ALL_SCENES as readonly string[]).includes(s);
}
