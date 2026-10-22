import type { ChainDef, EventDef } from './types';
import type { Ctx } from '../ctx';
import type { Gender, RelType } from '../types';
import { fmtYear } from '../ctx';
import { makeNpc } from '../systems/npcs';
import { dropOut } from '../systems/education';
import { bindRel, check, npcId, poor, rich, who } from './helpers';

/**
 * Growing up and learning: early childhood, school (6–17), teen life,
 * higher education and pre-modern schooling. Prefix `sc_`.
 * Teen events stay innocent: crushes, dances, a first kiss at most.
 */

// ------------------------------------------------------------------ local helpers
const prog = (x: Ctx): string => x.c.education.enrolled?.programId ?? '';
const inSchool = (x: Ctx) => prog(x) === 'primary' || prog(x) === 'secondary';
const HIGHER = ['university', 'communityCollege', 'online', 'law', 'medical', 'phd', 'mba', 'militaryAcademy', 'seminary'];
const inHigher = (x: Ctx) => HIGHER.includes(prog(x));
const inUni = (x: Ctx) => ['university', 'law', 'medical', 'phd', 'mba'].includes(prog(x));
/** Adjust school grades, clamped to 0–100. */
const gr = (x: Ctx, d: number) => {
  const e = x.c.education;
  e.grades = Math.max(0, Math.min(100, e.grades + d));
};
/** A new classmate of roughly the same age. */
const peer = (x: Ctx, type: RelType, affinity = 40, trust = 30) => {
  const n = makeNpc(x, { age: Math.max(4, x.age + x.int(-1, 1)), career: null });
  x.addRel(n.id, type, { affinity, trust });
  return n;
};
/** A new adult (teacher, master, tutor). */
const elder = (x: Ctx, type: RelType, affinity = 40, trust = 40) => {
  const n = makeNpc(x, { age: x.int(28, 62) });
  x.addRel(n.id, type, { affinity, trust });
  return n;
};
const board = (x: Ctx) => (x.year < 1800 ? 'wax tablet' : x.year < 2000 ? 'blackboard' : 'smartboard');
const ride = (x: Ctx) => (x.year < 1890 ? 'pony' : x.year < 1990 ? 'bicycle' : x.year < 2100 ? 'bike' : 'hoverboard');
const fair = (x: Ctx) => (x.year < 1850 ? 'market fair' : 'county fair');
const teacherWord = (x: Ctx) => (x.year < 500 ? 'magister' : x.year < 1700 ? 'schoolmaster' : 'teacher');

const EARLY: EventDef[] = [
  // ================================================================== early childhood (3–8)
  {
    id: 'sc_monsterBed', cat: 'childhood', minAge: 3, maxAge: 8, once: true, scene: 'ghost',
    title: 'Under the bed', text: 'Something under your bed is breathing. You are almost sure of it.',
    choices: [
      { label: 'Check with a torch', tags: ['ambitious'], run: (x) => { x.mods({ confidence: 4, anxiety: -2 }); return 'It was a sock. A menacing sock, but a sock.'; } },
      { label: 'Run to your parents', tags: ['cautious'], scene: 'family', run: (x) => { x.mods({ anxiety: 1, happiness: 2 }); return 'You slept wedged between two snoring adults, perfectly safe.'; } },
      { label: 'Offer it a biscuit', tags: ['social'], run: (x) => { x.mods({ creativity: 4, empathy: 2 }); return 'The biscuit was gone by morning. The dog looked guilty.'; } },
    ],
  },
  {
    id: 'sc_imaginaryPal', cat: 'childhood', minAge: 3, maxAge: 7, once: true, scene: 'familyDinner',
    title: 'Captain Biscuit', text: 'Your imaginary friend, Captain Biscuit, demands his own chair at dinner.',
    choices: [
      { label: 'Insist on the chair', tags: ['impulsive'], run: (x) => { x.mods({ creativity: 4, confidence: 2 }); return 'Your father solemnly passed the Captain the peas.'; } },
      { label: 'Let him sit on your lap', tags: ['help'], run: (x) => { x.mods({ creativity: 2, happiness: 2 }); return 'A reasonable compromise. The Captain was gracious about it.'; } },
      { label: 'Retire the Captain', tags: ['cautious'], run: (x) => { x.mods({ creativity: -1, wisdom: 1 }); return 'He left for sea. You still wave at boats sometimes.'; } },
    ],
  },
  {
    id: 'sc_firstDay', cat: 'school', minAge: 5, maxAge: 7, once: true, weight: 3, scene: 'classroom',
    when: (x) => inSchool(x),
    title: 'First day of school', text: (x) => `A huge building, a ${teacherWord(x)} with a kind smile, and a hook with your name on it.`,
    choices: [
      { label: 'March in bravely', tags: ['ambitious'], run: (x) => { x.mods({ confidence: 4, happiness: 2 }); return 'You did not look back once. Your mother cried in the car park enough for both of you.'; } },
      { label: 'Cling to a leg', tags: ['cautious'], scene: 'family', run: (x) => { x.mods({ anxiety: 3 }); return 'It took two adults and a promise of ice cream to detach you.'; } },
      { label: 'Find someone to play with', tags: ['social'], scene: 'friends', run: (x) => { const n = peer(x, 'friend', 55, 40); x.mod('popularity', 3); return `You and ${n.firstName} agreed to be best friends by snack time.`; } },
    ],
  },
  {
    id: 'sc_showAndTell', cat: 'school', minAge: 5, maxAge: 9, once: true, scene: 'classroom',
    when: (x) => inSchool(x),
    title: 'Show and tell', text: 'It is your turn to bring something interesting to class.',
    choices: [
      { label: 'Bring the family pet', tags: ['impulsive'], when: (x) => x.c.pets.length > 0, scene: 'pet', run: (x) => { x.mods({ popularity: 5 }); return 'It escaped, toured the classroom and became a legend.'; } },
      { label: 'Bring a strange rock', tags: ['cautious'], run: (x) => { x.mods({ smarts: 2 }); x.train('science', 2); return 'You talked about the rock for eleven minutes. The rock was riveting.'; } },
      { label: "Bring grandpa's medal", tags: ['social'], run: (x) => { x.mods({ popularity: 3, empathy: 2 }); return 'Everyone wanted to hold it. Grandpa told the story at dinner three times.'; } },
      { label: 'Wing it', tags: ['impulsive'], run: (x) => { x.mods({ charisma: 2 }); x.train('publicSpeaking', 2); return 'You showed the class your belly button. Bold. Unforgettable.'; } },
    ],
  },
  {
    id: 'sc_lostTooth', cat: 'childhood', minAge: 5, maxAge: 8, once: true, weight: 2, scene: 'dentist',
    title: 'A wobbly tooth', text: 'Your front tooth has been hanging by a thread for days. Today it came out in an apple.',
    choices: [
      { label: 'Put it under the pillow', tags: ['cautious'], run: (x) => { x.money(Math.max(1, Math.round(2 * (x.year < 1900 ? 0.1 : 1)))); x.mods({ happiness: 3 }); return 'In the morning there was a coin, and no tooth. The system works.'; } },
      { label: 'Keep it in a jar', run: (x) => { x.mods({ creativity: 1 }); return 'Your collection of body parts disturbs the adults.'; } },
      { label: 'Sell it to a classmate', tags: ['ambitious'], run: (x) => { x.money(1); x.train('sales', 2); return 'A bargain at one sweet. You are a natural.'; } },
    ],
  },
  {
    id: 'sc_lostAtFair', cat: 'childhood', minAge: 4, maxAge: 9, once: true, scene: 'amusement',
    title: 'Lost at the fair', text: (x) => `You turned around at the ${fair(x)} and your family had vanished into the crowd.`,
    choices: [
      { label: 'Stay exactly where you are', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 2, anxiety: 1 }); return 'They found you within ten minutes, exactly where you were told to wait.'; } },
      { label: 'Ask a stall keeper for help', tags: ['help', 'social'], run: (x) => { x.mods({ confidence: 3 }); return 'The toffee-apple lady announced you over the noise. You got a free toffee apple.'; } },
      { label: 'Go exploring', tags: ['impulsive'], scene: 'police', run: (x) => { x.mods({ riskTolerance: 3, anxiety: 3 }); return 'You saw a two-headed calf and a juggler before a watchman returned you, sticky and thrilled.'; } },
    ],
  },
  {
    id: 'sc_thunder', cat: 'childhood', minAge: 3, maxAge: 8, once: true, scene: 'storm',
    title: 'The big storm', text: 'Thunder shakes the windows. The sky is angry and you are very small.',
    choices: [
      { label: 'Count between the flash and the boom', tags: ['cautious'], run: (x) => { x.mods({ smarts: 2, anxiety: -1 }); x.train('science', 1); return 'Seven seconds. The storm is far away. Science is a comfort.'; } },
      { label: 'Hide under the covers', run: (x) => { x.mods({ anxiety: 2 }); return 'You built a fort no thunder could breach.'; } },
      { label: "Climb into your parents' bed", tags: ['social'], scene: 'family', run: (x) => { x.mods({ happiness: 2 }); return 'You kicked everyone all night and slept beautifully.'; } },
    ],
  },
  {
    id: 'sc_wallMural', cat: 'childhood', minAge: 3, maxAge: 7, once: true, scene: 'painting',
    title: 'The mural', text: (x) => `You have drawn a magnificent horse on the wall with ${x.year < 1900 ? 'a lump of charcoal' : 'crayons'}.`,
    choices: [
      { label: 'Confess proudly', tags: ['help'], run: (x) => { x.mods({ discipline: 2, creativity: 2 }); return 'You scrubbed it off yourself. It was a very good horse.'; } },
      { label: 'Blame the dog', tags: ['impulsive'], run: (x) => { x.mods({ karma: -1 }); x.train('deception', 1); return 'Nobody believed the dog could draw. You were sent to bed.'; } },
      { label: 'Add your signature', tags: ['ambitious'], run: (x) => { x.mods({ creativity: 4, ego: 2 }); x.train('art', 2); return 'Your mother framed the bit with the signature before painting over the rest.'; } },
    ],
  },
  {
    id: 'sc_learnRide', cat: 'childhood', minAge: 4, maxAge: 9, once: true, scene: 'sports',
    title: (x) => (x.year < 1890 ? 'Your first pony ride' : 'Learning to ride'), text: (x) => `An adult is holding the back of your ${ride(x)}. They promise not to let go.`,
    choices: [
      { label: 'Tell them to let go', tags: ['ambitious'], run: (x) => { x.mods({ fitness: 3, confidence: 4 }); return x.chance(0.6) ? 'You wobbled, then flew. Freedom tastes like wind.' : 'You flew briefly, then met a hedge.'; } },
      { label: 'Go slowly', tags: ['cautious'], run: (x) => { x.mods({ fitness: 2, discipline: 1 }); return 'It took all summer, but you never fell once.'; } },
      { label: 'Give up and walk', run: (x) => { x.mods({ confidence: -2 }); return 'Walking is also a perfectly good way of getting places.'; } },
    ],
  },
  {
    id: 'sc_swimLesson', cat: 'childhood', minAge: 4, maxAge: 9, once: true, scene: 'beach',
    title: 'Swimming lessons', text: 'The water is cold, deep and full of other children screaming happily.',
    choices: [
      { label: 'Jump straight in', tags: ['impulsive'], run: (x) => { x.mods({ fitness: 3, riskTolerance: 2 }); x.train('swimming', 4); return 'You swallowed half the pool but came up grinning.'; } },
      { label: 'Cling to the edge', tags: ['cautious'], run: (x) => { x.train('swimming', 1); x.mod('anxiety', 1); return 'You and the edge have an understanding now.'; } },
      { label: 'Float like a starfish', run: (x) => { x.train('swimming', 2); x.mods({ happiness: 2 }); return 'Lying on the water looking at the sky is your new favourite thing.'; } },
    ],
  },
  {
    id: 'sc_bedtimeStory', cat: 'childhood', minAge: 3, maxAge: 8, scene: 'reading', cooldown: 4,
    title: 'One more story', text: 'The bedtime story ended on a cliffhanger. Your eyes are wide open.',
    choices: [
      { label: 'Beg for one more', tags: ['social'], scene: 'family', run: (x) => { x.mods({ happiness: 3 }); return 'One more turned into three. Everyone fell asleep in your bed.'; } },
      { label: 'Read ahead in secret', tags: ['ambitious'], run: (x) => { x.mods({ smarts: 2 }); x.train('literacy', 3); return 'You read by moonlight until the dragon was defeated.'; } },
      { label: 'Make up the ending', tags: ['impulsive'], run: (x) => { x.mods({ creativity: 3 }); x.train('writing', 2); return 'In your version the dragon opens a bakery.'; } },
    ],
  },
  {
    id: 'sc_toyShare', cat: 'childhood', minAge: 3, maxAge: 7, once: true, scene: 'playground',
    title: 'Mine!', text: 'Another child wants to play with your favourite toy.',
    choices: [
      { label: 'Share it', tags: ['help'], scene: 'friends', run: (x) => { const n = peer(x, 'friend', 45, 35); x.mods({ empathy: 3, karma: 1 }); return `${n.firstName} became your friend on the spot.`; } },
      { label: 'Hold on tight', tags: ['cautious'], run: (x) => { x.mods({ ego: 2, empathy: -1 }); return 'You won the toy and lost the afternoon.'; } },
      { label: 'Trade for something better', tags: ['ambitious'], run: (x) => { x.train('negotiation', 2); return 'You walked away with two marbles and a shiny button. Ruthless.'; } },
    ],
  },
  {
    id: 'sc_pickyEater', cat: 'childhood', minAge: 3, maxAge: 9, once: true, scene: 'familyDinner',
    title: 'The green thing', text: 'There is a green vegetable on your plate and nobody is leaving until it is gone.',
    choices: [
      { label: 'Eat it bravely', tags: ['cautious'], run: (x) => { x.mods({ health: 2, discipline: 2 }); return 'It was not terrible. You will never admit it.'; } },
      { label: 'Feed it to the dog', tags: ['impulsive'], run: (x) => { x.train('deception', 1); return x.chance(0.5) ? 'The dog was an excellent accomplice.' : 'The dog spat it out at your father\'s feet.'; } },
      { label: 'Negotiate', tags: ['ambitious'], run: (x) => { x.train('negotiation', 2); return 'Three bites for dessert. A historic accord.'; } },
    ],
  },
  {
    id: 'sc_giftBringer', cat: 'childhood', minAge: 5, maxAge: 9, once: true, scene: 'family',
    title: 'Suspicious handwriting', text: 'The note from the midwinter gift-bringer is in your mother\'s handwriting.',
    choices: [
      { label: 'Keep the secret', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 2, happiness: 1 }); return 'The gifts kept coming. You are not stupid.'; } },
      { label: 'Announce your discovery', tags: ['impulsive'], run: (x) => { x.mods({ smarts: 2, happiness: -2 }); return 'Your little cousin burst into tears. Truth has a cost.'; } },
      { label: 'Set a trap', tags: ['ambitious'], run: (x) => { x.mods({ creativity: 3 }); x.train('engineering', 1); return 'You caught your father in a string-and-bell trap at midnight. He blamed elves.'; } },
    ],
  },
  {
    id: 'sc_snowDay', cat: 'childhood', minAge: 5, maxAge: 12, scene: 'blizzard', cooldown: 3,
    when: (x) => inSchool(x),
    title: 'Snow day', text: 'School is closed. The whole world is white and silent.',
    choices: [
      { label: 'Build a snow fort', tags: ['ambitious'], run: (x) => { x.mods({ creativity: 2, fitness: 1, happiness: 3 }); return 'It had two towers and a moat of slush.'; } },
      { label: 'Start a snowball war', tags: ['impulsive'], scene: 'friends', run: (x) => { x.mods({ popularity: 3, happiness: 4 }); return 'You fought the whole street to a glorious, frozen draw.'; } },
      { label: 'Stay in by the fire', tags: ['cautious'], scene: 'reading', run: (x) => { x.mods({ happiness: 2 }); x.train('literacy', 1); return 'A blanket, a book and something hot to drink. Perfect.'; } },
    ],
  },
  {
    id: 'sc_goldfish', cat: 'school', minAge: 5, maxAge: 9, once: true, scene: 'funeral',
    when: (x) => inSchool(x) && x.year >= 1850,
    title: 'The class goldfish', text: 'It was your weekend to look after the class goldfish. It is floating upside down.',
    choices: [
      { label: 'Hold a funeral', tags: ['help'], run: (x) => { x.mods({ empathy: 3, happiness: -1 }); return 'You gave a moving eulogy. Your father dug the hole.'; } },
      { label: 'Replace it secretly', tags: ['impulsive'], scene: 'pet', run: (x) => { x.mods({ karma: -1 }); x.train('deception', 2); return 'Nobody noticed that Goldie came back slightly bigger and orange-er.'; } },
      { label: 'Tell the truth on Monday', tags: ['cautious'], scene: 'classroom', run: (x) => { x.mods({ karma: 2, discipline: 2 }); return 'The class held a minute of silence. You felt honest and terrible.'; } },
    ],
  },
  {
    id: 'sc_letters', cat: 'school', minAge: 4, maxAge: 7, once: true, scene: 'classroom',
    title: 'Learning letters', text: (x) => `The ${teacherWord(x)} draws a big curly letter on the ${board(x)}.`,
    choices: [
      { label: 'Practise until it is perfect', tags: ['ambitious'], run: (x) => { x.train('literacy', 4); x.mods({ discipline: 2 }); return 'Your letters marched across the page like soldiers.'; } },
      { label: 'Sing the alphabet loudly', tags: ['social'], scene: 'music', run: (x) => { x.train('literacy', 2); x.train('singing', 1); return 'Every letter was correct, and so loud.'; } },
      { label: 'Draw a cat instead', tags: ['impulsive'], scene: 'painting', run: (x) => { x.mods({ creativity: 2 }); x.train('art', 1); return 'The cat was excellent. The letters can wait.'; } },
    ],
  },
  {
    id: 'sc_dressUp', cat: 'childhood', minAge: 3, maxAge: 8, once: true, scene: 'theater',
    title: 'The dressing-up box', text: 'You found the dressing-up box. Today you will become someone else.',
    choices: [
      { label: 'Be a knight', tags: ['violent'], run: (x) => { x.mods({ confidence: 3, aggression: 1 }); return 'You knighted the cat. The cat did not consent.'; } },
      { label: 'Be a doctor', tags: ['help'], run: (x) => { x.mods({ empathy: 2 }); x.train('medicine', 1); return 'Every teddy in the house has been bandaged.'; } },
      { label: 'Be a monarch', tags: ['ambitious'], run: (x) => { x.mods({ ego: 3, charisma: 2 }); return 'You ruled the living room with an iron spoon.'; } },
    ],
  },
  {
    id: 'sc_napTime', cat: 'childhood', minAge: 3, maxAge: 6, once: true, scene: 'calm',
    title: 'Nap time', text: 'Everyone else is asleep on their mats. You are not even slightly tired.',
    choices: [
      { label: 'Pretend to sleep', tags: ['cautious'], run: (x) => { x.mods({ discipline: 2 }); return 'You pretended so well that you fell asleep.'; } },
      { label: 'Whisper to your neighbour', tags: ['social'], scene: 'friends', run: (x) => { x.mods({ popularity: 2, discipline: -1 }); return 'Giggling is contagious. Nap time was cancelled.'; } },
      { label: 'Explore the room', tags: ['impulsive'], run: (x) => { x.mods({ riskTolerance: 2 }); return 'You found the biscuit cupboard. A whole new world.'; } },
    ],
  },
  {
    id: 'sc_monkeyBars', cat: 'childhood', minAge: 4, maxAge: 9, once: true, scene: 'playground',
    title: 'Monkey bars', text: 'You are halfway across the monkey bars and your arms have stopped working.',
    choices: [
      { label: 'Push through', tags: ['ambitious'], run: (x) => { if (x.chance(0.6)) { x.mods({ fitness: 3, confidence: 3 }); return 'You made it! A small crowd cheered.'; } x.mods({ health: -2 }); return 'You dropped and scraped both knees. Badges of honour.'; } },
      { label: 'Drop carefully', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 1 }); return 'Discretion is the better part of monkey bars.'; } },
      { label: 'Ask for a boost', tags: ['social'], run: (x) => { x.mods({ popularity: 1 }); return 'A bigger kid helped you across. You will remember the kindness.'; } },
    ],
  },
  {
    id: 'sc_whyPhase', cat: 'childhood', minAge: 3, maxAge: 6, once: true, scene: 'family',
    title: 'But why?', text: 'You have asked "why" forty-one times today. The adults are fraying.',
    choices: [
      { label: 'Ask a forty-second time', tags: ['impulsive'], run: (x) => { x.mods({ smarts: 3 }); return '"Because I said so." The universe has no further answers.'; } },
      { label: 'Find the answer yourself', tags: ['ambitious'], scene: 'reading', run: (x) => { x.mods({ smarts: 2, discipline: 2 }); x.train('science', 1); return 'You learned why the sky is blue and told everyone at dinner.'; } },
      { label: 'Give them a break', tags: ['help'], run: (x) => { x.mods({ empathy: 2 }); return 'Your mother looked at you with enormous gratitude.'; } },
    ],
  },
  {
    id: 'sc_kidParty', cat: 'childhood', minAge: 5, maxAge: 10, once: true, scene: 'birthday',
    title: 'Birthday party', text: 'Your parents say you can have a party this year. Who do you invite?',
    choices: [
      { label: 'The whole class', tags: ['social'], run: (x) => { x.mods({ popularity: 5, stress: 2 }); return 'Thirty children, one cake and a pony that bit someone. A triumph.'; } },
      { label: 'Just your best friend', tags: ['cautious'], scene: 'friends', run: (x) => { x.mods({ happiness: 4 }); return 'Two of you, a whole cake and a blanket fort. Perfection.'; } },
      { label: 'Nobody: ask for a gift instead', tags: ['ambitious'], run: (x) => { x.mods({ loneliness: 2 }); x.money(5); return 'You got the thing you wanted. It was quiet.'; } },
    ],
  },
  {
    id: 'sc_mudPie', cat: 'childhood', minAge: 3, maxAge: 7, once: true, scene: 'cooking',
    bind: bindRel('sibling'),
    title: 'Mud pie bakery', text: (x) => `You have opened a mud-pie bakery. ${who(x)} is your first customer.`,
    choices: [
      { label: 'Insist they take a bite', tags: ['impulsive'], run: (x) => { x.relMod(npcId(x), -3); x.mods({ happiness: 2 }); return 'They took a bite. Everyone got told off.'; } },
      { label: 'Give it away free', tags: ['help'], run: (x) => { x.relMod(npcId(x), 4); return 'Your sibling politely "ate" it and declared you a master chef.'; } },
      { label: 'Charge a button', tags: ['ambitious'], run: (x) => { x.train('sales', 1); return 'Your first sale. The economy of the sandbox is booming.'; } },
    ],
  },
  {
    id: 'sc_zooTrip', cat: 'school', minAge: 5, maxAge: 11, once: true, years: [1830, 2300], scene: 'zoo',
    when: (x) => inSchool(x),
    title: 'Trip to the zoo', text: 'Your class is at the zoo. Everyone has a partner and a packed lunch.',
    choices: [
      { label: 'Stare down the gorilla', tags: ['impulsive'], run: (x) => { x.mods({ confidence: 2 }); return 'The gorilla blinked first. Probably out of boredom.'; } },
      { label: 'Read every sign', tags: ['ambitious'], run: (x) => { x.mods({ smarts: 2 }); x.train('biology', 2); return 'You now know more about penguins than the zookeeper.'; } },
      { label: 'Trade lunches with your partner', tags: ['social'], scene: 'friends', run: (x) => { x.mods({ popularity: 2 }); return 'Your soggy sandwich for their crisps. Diplomacy.'; } },
    ],
  },
  {
    id: 'sc_stuckTree', cat: 'childhood', minAge: 5, maxAge: 10, once: true, scene: 'hiking',
    title: 'Up a tree', text: 'Climbing up the big oak was easy. Climbing down is another matter.',
    choices: [
      { label: 'Climb down slowly', tags: ['cautious'], run: (x) => { x.mods({ dexterity: 2, confidence: 2 }); x.train('climbing', 2); return 'One branch at a time. You made it.'; } },
      { label: 'Jump', tags: ['impulsive'], scene: 'hospital', run: (x) => { x.mods({ health: -4, riskTolerance: 3 }); return 'A broken wrist and a cast everyone signed. Worth it.'; } },
      { label: 'Shout for help', tags: ['social'], run: (x) => { x.mods({ popularity: -1 }); return 'A neighbour fetched a ladder and told the whole street.'; } },
    ],
  },
  {
    id: 'sc_newSchool', cat: 'school', minAge: 6, maxAge: 15, once: true, weight: 0.6, scene: 'moving',
    when: (x) => inSchool(x),
    title: 'The new kid', text: 'Your family moved. Tomorrow you start at a school where nobody knows your name.',
    choices: [
      { label: 'Reinvent yourself', tags: ['ambitious'], run: (x) => { x.mods({ confidence: 3, charisma: 2 }); return 'New school, new you. Nobody here knows about the pudding incident.'; } },
      { label: 'Keep your head down', tags: ['cautious'], scene: 'lonely', run: (x) => { x.mods({ loneliness: 4, discipline: 1 }); return 'The first month was lonely. Then someone saved you a seat.'; } },
      { label: 'Sit with the loudest table', tags: ['social'], scene: 'friends', run: (x) => { const n = peer(x, 'friend', 45, 30); x.mod('popularity', 3); return `${n.firstName} slid over and made room. You were in.`; } },
    ],
  },
];

const PRIMARY: EventDef[] = [
  // ================================================================== school days (6–12)
  {
    id: 'sc_spellingBee', cat: 'school', minAge: 7, maxAge: 13, once: true, years: [1850, 2300], scene: 'stage',
    when: (x) => inSchool(x),
    title: 'Spelling bee', text: 'You have reached the final round. The word is "onomatopoeia".',
    choices: [
      { label: 'Spell it slowly', tags: ['cautious'], run: (x) => { if (x.chance(0.35 + x.skill('literacy') / 200 + x.stat('smarts') / 300)) { x.mods({ confidence: 5, popularity: 2 }); gr(x, 4); x.remember('spellingChamp', 'Won the school spelling bee', 20); return 'O-N-O-M-A-T-O-P-O-E-I-A. The hall erupted. You are the champion.'; } x.mods({ confidence: -2 }); return 'You missed one vowel. A vowel! It still haunts you.'; } },
      { label: 'Ask for it in a sentence', tags: ['social'], run: (x) => { x.mods({ charisma: 2 }); x.train('literacy', 2); return '"The bee went buzz." It did not help, but the audience laughed.'; } },
      { label: 'Freeze', run: (x) => { x.mods({ anxiety: 3 }); return 'You stood there until the bell rang. Second place, by default.'; } },
    ],
  },
  {
    id: 'sc_scienceFair', cat: 'school', minAge: 8, maxAge: 16, once: true, years: [1900, 2300], scene: 'lab',
    when: (x) => inSchool(x),
    title: 'Science fair', text: 'The science fair is in two weeks. Everyone else is making a baking-soda volcano.',
    choices: [
      { label: 'Make a volcano too', tags: ['cautious'], run: (x) => { x.train('chemistry', 2); return 'Your volcano erupted on cue. Honourable mention, along with eleven other volcanoes.'; } },
      { label: 'Attempt something ambitious', tags: ['ambitious'], scene: 'invention', run: (x) => { x.train('science', 5); x.train('engineering', 3); x.mods({ stress: 4, smarts: 3 }); if (check(x, x.stat('smarts'), 55)) { x.setFlag('sc_scienceStar', true); x.chain('sc_scienceArc', 1); x.mods({ confidence: 5 }); return 'Your homemade weather station won first prize. The judges want you at regionals.'; } return 'It caught fire during judging. Memorable, if not prize-winning.'; } },
      { label: 'Let a parent build it', tags: ['impulsive'], scene: 'family', run: (x) => { x.mods({ karma: -1 }); return 'The judges complimented "your" hydraulic welding. You said nothing.'; } },
    ],
  },
  {
    id: 'sc_schoolPlay', cat: 'school', minAge: 6, maxAge: 12, once: true, scene: 'theater',
    when: (x) => inSchool(x),
    title: 'The school play', text: 'The cast list is up. You have been cast as Tree Number Three.',
    choices: [
      { label: 'Be the best tree ever', tags: ['ambitious'], run: (x) => { x.train('acting', 3); x.mods({ discipline: 2 }); return 'You rustled with conviction. A parent wept.'; } },
      { label: 'Ad-lib some lines', tags: ['impulsive'], run: (x) => { x.train('comedy', 2); x.mods({ popularity: 3, charisma: 2 }); return 'Trees do not normally talk. Yours stole the show.'; } },
      { label: 'Help backstage', tags: ['help'], run: (x) => { x.train('teamwork', 3); return 'You ran the curtain like a professional. Nobody saw you; everybody needed you.'; } },
    ],
  },
  {
    id: 'sc_lunchTrade', cat: 'school', minAge: 6, maxAge: 13, cooldown: 4, scene: 'friends',
    when: (x) => inSchool(x),
    title: 'Lunch trade', text: 'A classmate eyes your lunch. They have something much better.',
    choices: [
      { label: 'Drive a hard bargain', tags: ['ambitious'], run: (x) => { x.train('negotiation', 2); x.mods({ happiness: 1 }); return 'Your apple for their chocolate cake. Market conditions were favourable.'; } },
      { label: 'Share yours freely', tags: ['help'], run: (x) => { x.mods({ empathy: 2, popularity: 2 }); return 'They were hungry. Lunch tastes better shared.'; } },
      { label: 'Guard your lunch', tags: ['cautious'], run: (x) => { x.mods({ health: 1 }); return 'You ate every bite of your own lunch, in silence, like a dragon.'; } },
    ],
  },
  {
    id: 'sc_classClown', cat: 'school', minAge: 7, maxAge: 16, once: true, scene: 'classroom',
    when: (x) => inSchool(x),
    title: 'Class clown', text: 'The lesson is dull, and you have a joke that would bring the house down.',
    choices: [
      { label: 'Tell the joke', tags: ['impulsive', 'social'], run: (x) => { x.train('comedy', 3); x.mods({ popularity: 4, discipline: -2 }); gr(x, -2); return x.chance(0.5) ? 'The class roared. Even the teacher almost smiled.' : 'The class roared. The teacher did not. Detention.'; } },
      { label: 'Save it for break', tags: ['cautious'], run: (x) => { x.mods({ discipline: 2 }); return 'It killed at break. Timing is everything.'; } },
      { label: 'Write it on a note', run: (x) => { x.train('writing', 1); return 'The note was intercepted and read aloud. The joke did not survive the teacher\'s voice.'; } },
    ],
  },
  {
    id: 'sc_detention', cat: 'school', minAge: 9, maxAge: 17, cooldown: 4, scene: 'classroom',
    when: (x) => inSchool(x) && (x.stat('discipline') < 45 || x.chance(0.3)),
    title: 'Detention', text: 'An hour after school in a silent room with a ticking clock and three other troublemakers.',
    choices: [
      { label: 'Do your homework', tags: ['cautious'], scene: 'study', run: (x) => { gr(x, 2); x.mods({ discipline: 2 }); return 'The most productive hour of your week, oddly.'; } },
      { label: 'Befriend the others', tags: ['social'], scene: 'friends', run: (x) => { const n = peer(x, 'friend', 45, 35); x.mods({ streetCred: 2 }); return `${n.firstName} and you bonded over a shared contempt for the clock.`; } },
      { label: 'Sneak out', tags: ['impulsive'], run: (x) => { x.mods({ riskTolerance: 3, discipline: -2 }); return x.chance(0.4) ? 'You got caught at the gate. Two more detentions.' : 'You were gone in a breath. Legendary.'; } },
    ],
  },
  {
    id: 'sc_bullyLunch', cat: 'school', minAge: 7, maxAge: 14, once: true, scene: 'fight', violent: true,
    when: (x) => inSchool(x),
    title: 'Lunch money', text: 'An older kid corners you behind the gym and demands your lunch money.',
    choices: [
      { label: 'Stand your ground', tags: ['violent'], run: (x) => { const n = peer(x, 'bully', 10, 5); if (check(x, x.stat('fitness') + x.stat('confidence') / 2, 70)) { x.mods({ confidence: 6, popularity: 3 }); return `${n.firstName} backed off. Nobody tried again.`; } x.mods({ health: -3, confidence: -2 }); return `${n.firstName} took the money and your dignity. You took a black eye home.`; } },
      { label: 'Tell a teacher', tags: ['cautious', 'help'], scene: 'classroom', run: (x) => { peer(x, 'bully', 10, 5); x.mods({ wisdom: 2 }); return x.chance(0.5) ? 'The bully was suspended for a week.' : 'The teacher shrugged. Telling did not help, this time.'; } },
      { label: 'Hand it over', run: (x) => { const n = peer(x, 'bully', 15, 5); x.money(-1); x.mods({ anxiety: 3 }); x.remember('bullied', `Paid ${n.firstName} to be left alone`, 20, n.id); return 'You ate nothing that day. It happened again on Thursday.'; } },
    ],
  },
  {
    id: 'sc_bestFriend', cat: 'school', minAge: 6, maxAge: 14, once: true, weight: 1.5, scene: 'friends',
    when: (x) => !x.rels('bestFriend').length,
    title: 'Best friends', text: 'There is a kid in your class who laughs at exactly the same things you do.',
    choices: [
      { label: 'Make a friendship pact', tags: ['social'], run: (x) => { const n = peer(x, 'bestFriend', 70, 60); x.mods({ happiness: 6, loneliness: -6 }); x.remember('bestFriendPact', `Made a lifelong pact with ${n.firstName}`, 30, n.id); return `You and ${n.firstName} spat on your palms and shook. Lifelong.`; } },
      { label: 'Play it cool', tags: ['cautious'], run: (x) => { const n = peer(x, 'friend', 50, 40); return `${n.firstName} and you are friends. Maybe, eventually, more than that.`; } },
      { label: 'Start a secret club', tags: ['ambitious'], scene: 'ritual', run: (x) => { const n = peer(x, 'bestFriend', 65, 55); x.mods({ creativity: 3 }); return `Membership: two. Password: "badger". President: disputed with ${n.firstName}.`; } },
    ],
  },
  {
    id: 'sc_museumTrip', cat: 'school', minAge: 7, maxAge: 15, once: true, years: [1800, 2300], scene: 'museum',
    when: (x) => inSchool(x),
    title: 'Museum trip', text: 'Your class files past a dinosaur skeleton, clipboards in hand.',
    choices: [
      { label: 'Fill in every question', tags: ['ambitious'], run: (x) => { x.train('history', 3); gr(x, 2); return 'You found every answer and two mistakes on the labels.'; } },
      { label: 'Touch the exhibit', tags: ['impulsive'], scene: 'police', run: (x) => { x.mods({ riskTolerance: 2 }); return 'An alarm went off and a guard escorted your class out. Infamous.'; } },
      { label: 'Get lost in a gallery', run: (x) => { x.mods({ creativity: 3, wisdom: 1 }); x.train('art', 1); return 'You stood in front of one painting for an hour. Something changed.'; } },
    ],
  },
  {
    id: 'sc_timesTables', cat: 'school', minAge: 7, maxAge: 10, once: true, scene: 'exam',
    when: (x) => inSchool(x),
    title: 'Times tables', text: 'The seven times table is the final boss of primary school.',
    choices: [
      { label: 'Drill it nightly', tags: ['ambitious'], run: (x) => { x.train('mathematics', 4); gr(x, 3); x.mods({ discipline: 2 }); return 'Seven eights are fifty-six. You will know this on your deathbed.'; } },
      { label: 'Make up a song', tags: ['impulsive'], scene: 'music', run: (x) => { x.train('mathematics', 2); x.mods({ creativity: 2 }); return 'The song was catchy. The whole class sings it now.'; } },
      { label: 'Count on your fingers', tags: ['cautious'], run: (x) => { x.train('mathematics', 1); return 'Slow but reliable. You ran out of fingers at seven nines.'; } },
    ],
  },
  {
    id: 'sc_readAloud', cat: 'school', minAge: 6, maxAge: 11, once: true, scene: 'classroom',
    when: (x) => inSchool(x),
    title: 'Reading aloud', text: 'The teacher calls on you to read the next page aloud to the whole class.',
    choices: [
      { label: 'Do the voices', tags: ['impulsive'], run: (x) => { x.train('acting', 2); x.mods({ popularity: 3 }); return 'Your villain voice got a round of applause.'; } },
      { label: 'Read carefully', tags: ['cautious'], run: (x) => { x.train('literacy', 2); gr(x, 1); return 'Not one stumble. The teacher nodded approvingly.'; } },
      { label: 'Ask someone else to go', tags: ['social'], run: (x) => { x.mods({ anxiety: 2 }); return 'Your face burned, but the moment passed.'; } },
    ],
  },
  {
    id: 'sc_parentTeacher', cat: 'school', minAge: 7, maxAge: 16, cooldown: 5, scene: 'meeting',
    when: (x) => inSchool(x) && x.aliveParents().length > 0,
    title: 'Parents\' evening', text: (x) => `Your parents are meeting your ${teacherWord(x)}. Your grades are ${x.c.education.grades >= 65 ? 'good' : x.c.education.grades >= 40 ? 'middling' : 'a problem'}.`,
    choices: [
      { label: 'Wait anxiously outside', tags: ['cautious'], run: (x) => { x.mods({ anxiety: 2 }); return x.c.education.grades >= 60 ? 'They came out beaming. You got pizza.' : 'They came out with that look. Long car ride home.'; } },
      { label: 'Go in with them', tags: ['ambitious'], run: (x) => { x.mods({ confidence: 2 }); x.train('persuasion', 2); return 'You spun every weakness as "growth potential". Your father was impressed.'; } },
      { label: 'Intercept the letter', tags: ['impulsive'], run: (x) => { x.mods({ karma: -2 }); x.train('deception', 2); return x.chance(0.5) ? 'They never got the invitation. You live to fight another term.' : 'The school phoned. You were grounded for a fortnight.'; } },
    ],
  },
  {
    id: 'sc_reportCard', cat: 'school', minAge: 7, maxAge: 17, cooldown: 3, scene: 'exam',
    when: (x) => inSchool(x),
    title: 'Report card', text: (x) => `Your report says: "${x.c.education.grades >= 70 ? 'A pleasure to teach.' : x.c.education.grades >= 45 ? 'Capable of more.' : 'Seems to believe school is optional.'}"`,
    choices: [
      { label: 'Show it proudly', tags: ['social'], when: (x) => x.c.education.grades >= 55, scene: 'family', run: (x) => { x.mods({ happiness: 4, confidence: 2 }); return 'It went on the fridge. You walked past it often.'; } },
      { label: 'Promise to do better', tags: ['cautious'], run: (x) => { x.mods({ discipline: 3 }); gr(x, 3); return 'You made a timetable. You followed it for nearly a month.'; } },
      { label: 'Forge a signature', tags: ['impulsive'], run: (x) => { x.train('forgery', 3); x.mods({ karma: -2 }); return x.chance(0.3) ? 'The signature had too many loops. Your mother does not do loops.' : 'Flawless. Possibly a worrying talent.'; } },
    ],
  },
  {
    id: 'sc_sportsDay', cat: 'school', minAge: 6, maxAge: 12, once: true, scene: 'sports',
    when: (x) => inSchool(x),
    title: 'Sports day', text: 'The egg-and-spoon race. Your parents are in the crowd. The egg looks fragile.',
    choices: [
      { label: 'Sprint', tags: ['ambitious'], run: (x) => { x.mods({ fitness: 2 }); return x.chance(0.4) ? 'Gold! The egg survived. A ribbon is yours.' : 'You crossed the line first with an empty spoon. Disqualified.'; } },
      { label: 'Walk carefully', tags: ['cautious'], run: (x) => { x.mods({ discipline: 2 }); return 'Last place, egg intact. Your father cheered like you had won.'; } },
      { label: 'Glue the egg on', tags: ['impulsive'], run: (x) => { x.train('deception', 2); return 'You won and were stripped of the title in a ruling still disputed today.'; } },
    ],
  },
  {
    id: 'sc_instrument', cat: 'school', minAge: 7, maxAge: 13, once: true, scene: 'music',
    when: (x) => inSchool(x) || rich(x),
    title: (x) => (x.year < 1900 ? 'Lute lessons' : x.year < 1960 ? 'Piano lessons' : 'The recorder'), text: 'Everyone in your class must learn an instrument. Your family has heard enough already.',
    choices: [
      { label: 'Practise every day', tags: ['ambitious'], run: (x) => { x.train('music', 5); x.mods({ discipline: 3 }); return 'By spring you could play a tune that made the dog stop howling.'; } },
      { label: 'Practise in the shed', tags: ['help'], run: (x) => { x.train('music', 3); x.mods({ empathy: 1 }); return 'The family is grateful. The chickens are not.'; } },
      { label: 'Quietly lose it', tags: ['impulsive'], run: (x) => { x.mods({ creativity: -1 }); return 'It was found behind the radiator three years later.'; } },
    ],
  },
  {
    id: 'sc_teacherPet', cat: 'school', minAge: 7, maxAge: 15, once: true, scene: 'classroom',
    when: (x) => inSchool(x) && x.c.education.grades >= 55,
    title: 'Teacher\'s pet', text: 'Your teacher keeps choosing you for errands. The class has noticed.',
    choices: [
      { label: 'Embrace it', tags: ['ambitious'], run: (x) => { const t = elder(x, 'mentor', 55, 50); gr(x, 3); x.mods({ popularity: -3 }); return `${t.firstName} wrote you a glowing reference. The class called you a suck-up.`; } },
      { label: 'Fumble a task on purpose', tags: ['social'], run: (x) => { x.mods({ popularity: 2 }); return 'You dropped the register in a puddle. Order was restored.'; } },
      { label: 'Share the errands', tags: ['help'], run: (x) => { x.mods({ empathy: 2, popularity: 1 }); return 'You nominated a shy kid. They glowed all week.'; } },
    ],
  },
  {
    id: 'sc_strictTeacher', cat: 'school', minAge: 8, maxAge: 16, once: true, scene: 'classroom',
    when: (x) => inSchool(x),
    title: 'The dreaded teacher', text: (x) => `Your new ${teacherWord(x)} has never smiled. ${x.year < 1960 ? 'A cane hangs by the board.' : 'Rumour says they once failed a whole class.'}`,
    choices: [
      { label: 'Earn their respect', tags: ['ambitious'], run: (x) => { x.mods({ discipline: 4 }); gr(x, 4); return 'At the end of the year they nodded at you. Once. It meant everything.'; } },
      { label: 'Keep your head down', tags: ['cautious'], run: (x) => { x.mods({ anxiety: 2 }); return 'You survived the year invisible. A strategy as old as school.'; } },
      { label: 'Make them laugh', tags: ['impulsive'], run: (x) => { if (x.chance(0.3)) { x.mods({ popularity: 6 }); return 'A tiny snort escaped them. The class saw. You are a legend.'; } x.mods({ discipline: -1 }); gr(x, -3); return 'They did not laugh. They wrote your name down instead.'; } },
    ],
  },
  {
    id: 'sc_homeworkDog', cat: 'school', minAge: 7, maxAge: 15, once: true, scene: 'pet',
    when: (x) => inSchool(x),
    title: 'The dog ate it', text: 'Your homework is due today. It does not exist. You do own a dog, though.',
    choices: [
      { label: 'Blame the dog', tags: ['impulsive'], run: (x) => { x.train('deception', 2); return x.chance(0.3) ? 'You produced a chewed corner as evidence. The teacher was moved.' : '"Of course it did." An extra assignment for you.'; } },
      { label: 'Admit it', tags: ['cautious'], scene: 'classroom', run: (x) => { x.mods({ karma: 2 }); gr(x, -1); return 'Honesty earned you a one-day extension. Who knew?'; } },
      { label: 'Do it on the bus', tags: ['ambitious'], run: (x) => { gr(x, 1); x.mods({ stress: 2 }); return 'Scrawled, wobbly, and handed in. A pass is a pass.'; } },
    ],
  },
  {
    id: 'sc_schoolPhoto', cat: 'school', minAge: 6, maxAge: 16, once: true, years: [1880, 2300], scene: 'fame',
    when: (x) => inSchool(x),
    title: 'Picture day', text: 'Picture day. You woke up with hair that defies physics.',
    choices: [
      { label: 'Smile anyway', tags: ['social'], run: (x) => { x.mods({ confidence: 2 }); return 'The photo is terrible and your grandmother loves it most of all.'; } },
      { label: 'Pull a face', tags: ['impulsive'], run: (x) => { x.mods({ popularity: 2 }); return 'Your crossed eyes are now preserved in the school archive forever.'; } },
      { label: 'Fix it with water', tags: ['cautious'], run: (x) => { x.mods({ looks: 1 }); return 'A drenched, flattened, respectable child gazes out of the photo.'; } },
    ],
  },
  {
    id: 'sc_classPet', cat: 'school', minAge: 6, maxAge: 11, once: true, years: [1900, 2300], scene: 'pet',
    when: (x) => inSchool(x),
    title: 'Hamster weekend', text: 'You get to take the class hamster home for the weekend. It has a reputation for escaping.',
    choices: [
      { label: 'Guard it closely', tags: ['cautious'], run: (x) => { x.mods({ discipline: 2, empathy: 2 }); return 'Mr Whiskers returned on Monday safe, fat and smug.'; } },
      { label: 'Let it explore', tags: ['impulsive'], run: (x) => { x.mods({ stress: 3 }); return 'He was found two days later inside the piano. Everyone was very relieved.'; } },
      { label: 'Build it an obstacle course', tags: ['ambitious'], run: (x) => { x.train('engineering', 2); x.mods({ creativity: 3 }); return 'Mr Whiskers completed it in record time. You filmed nothing, sadly.'; } },
    ],
  },
  {
    id: 'sc_playgroundCraze', cat: 'school', minAge: 7, maxAge: 12, once: true, scene: 'friends',
    when: (x) => inSchool(x),
    title: 'Playground craze', text: (x) => `Everyone is obsessed with ${x.year < 1900 ? 'marbles' : x.year < 1960 ? 'conkers' : x.year < 1990 ? 'yo-yos' : x.year < 2030 ? 'trading cards' : 'holo-pets'}. You are behind.`,
    choices: [
      { label: 'Become the champion', tags: ['ambitious'], run: (x) => { x.mods({ popularity: 4, ego: 2 }); return 'Within a month you ruled the playground economy.'; } },
      { label: 'Trade cleverly', tags: ['social'], run: (x) => { x.train('negotiation', 2); x.train('sales', 1); return 'You traded your way to the rarest one in school.'; } },
      { label: 'Ignore it', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 1, popularity: -1 }); return 'It was banned by the head teacher in three weeks anyway.'; } },
    ],
  },
  {
    id: 'sc_rumour', cat: 'school', minAge: 9, maxAge: 17, once: true, scene: 'scandal',
    when: (x) => inSchool(x),
    title: 'The rumour', text: 'Someone is spreading a ridiculous rumour about you. It is everywhere by lunchtime.',
    choices: [
      { label: 'Confront the source', tags: ['violent'], scene: 'argument', run: (x) => { const n = peer(x, 'rival', 15, 5); x.mods({ confidence: 3 }); return `${n.firstName} denied it, then admitted it, then cried. It stopped.`; } },
      { label: 'Laugh it off', tags: ['social'], run: (x) => { x.mods({ popularity: 2, resilience: 3 }); return 'Your shrug was so convincing that the rumour simply died.'; } },
      { label: 'Tell a trusted adult', tags: ['cautious', 'help'], scene: 'family', run: (x) => { x.mods({ anxiety: -2 }); return 'It got sorted quietly. Grown-ups are occasionally useful.'; } },
    ],
  },
  {
    id: 'sc_choirSolo', cat: 'school', minAge: 7, maxAge: 15, once: true, scene: 'concert',
    when: (x) => inSchool(x) || x.c.religionId !== '',
    title: 'The solo', text: 'The choir needs someone to sing the first verse alone.',
    choices: [
      { label: 'Volunteer', tags: ['ambitious'], run: (x) => { x.train('singing', 4); if (x.chance(0.5 + x.skill('singing') / 200)) { x.mods({ confidence: 5, popularity: 3 }); return 'Your voice rose clear and true. Someone\'s grandmother wept.'; } x.mods({ confidence: -2 }); return 'Your voice cracked on the high note, loudly, for ever.'; } },
      { label: 'Stay in the back row', tags: ['cautious'], run: (x) => { x.train('singing', 2); return 'You mouthed half the words and nobody minded.'; } },
      { label: 'Nominate your friend', tags: ['help'], run: (x) => { x.mods({ empathy: 2 }); return 'They were wonderful. You cheered loudest.'; } },
    ],
  },
  {
    id: 'sc_penPal', cat: 'school', minAge: 8, maxAge: 15, once: true, years: [1870, 2010], scene: 'reading',
    when: (x) => inSchool(x),
    title: 'Pen pal', text: 'Your class has been paired with children in a faraway country. A letter arrives with foreign stamps.',
    choices: [
      { label: 'Write back pages', tags: ['social'], run: (x) => { const n = peer(x, 'friend', 50, 45); x.train('writing', 3); x.train('languages', 2); return `You and ${n.firstName} wrote for years. You still have every letter.`; } },
      { label: 'Send a drawing', tags: ['impulsive'], run: (x) => { x.train('art', 2); return 'They sent one back of a camel. The exchange was artistic.'; } },
      { label: 'Never reply', tags: ['cautious'], run: (x) => { x.mods({ empathy: -1 }); return 'Somewhere, a child checked the post for months.'; } },
    ],
  },
  {
    id: 'sc_libraryCard', cat: 'school', minAge: 6, maxAge: 13, once: true, years: [1850, 2300], scene: 'library',
    title: 'Library card', text: 'You have your very own library card. The shelves go up to the ceiling.',
    choices: [
      { label: 'Read everything', tags: ['ambitious'], run: (x) => { x.train('literacy', 5); x.mods({ smarts: 3, wisdom: 2 }); return 'You worked your way along a whole shelf by summer\'s end.'; } },
      { label: 'Only the scary ones', tags: ['impulsive'], scene: 'ghost', run: (x) => { x.train('literacy', 3); x.mods({ creativity: 3, anxiety: 1 }); return 'You slept with the light on for a year. No regrets.'; } },
      { label: 'Befriend the librarian', tags: ['social'], run: (x) => { const t = elder(x, 'mentor', 55, 50); x.train('literacy', 3); return `${t.firstName} saved you the new arrivals before anyone else saw them.`; } },
    ],
  },
  {
    id: 'sc_friendMoves', cat: 'school', minAge: 7, maxAge: 16, once: true, scene: 'moving',
    bind: bindRel('bestFriend', 'friend'),
    when: (x) => x.age < 18,
    title: 'Moving away', text: (x) => `${who(x)} is moving to another town. The removal van is already outside.`,
    choices: [
      { label: 'Promise to write', tags: ['help'], scene: 'loveLetter', run: (x) => { x.relMod(npcId(x), 6, 4); x.mods({ happiness: -3 }); return 'You wrote every week for a year, then every year for a lifetime.'; } },
      { label: 'Give them your treasure', tags: ['social'], run: (x) => { x.relMod(npcId(x), 10, 6); x.mods({ empathy: 3, happiness: -2 }); return 'You gave them your lucky stone. They gave you a terrible drawing. Even trade.'; } },
      { label: 'Refuse to say goodbye', tags: ['impulsive'], scene: 'lonely', run: (x) => { x.relMod(npcId(x), -4); x.mods({ loneliness: 5, happiness: -4 }); return 'You hid in your room as the van drove off. You regret it still.'; } },
    ],
  },
  {
    id: 'sc_chessClub', cat: 'school', minAge: 8, maxAge: 17, once: true, scene: 'gaming',
    when: (x) => inSchool(x),
    title: 'Chess club', text: 'The chess club meets on Thursdays. Its four members look up hopefully.',
    choices: [
      { label: 'Join and study openings', tags: ['ambitious'], run: (x) => { x.train('logic', 4); x.mods({ smarts: 2, popularity: -1 }); return 'You learned the Sicilian and lost your free Thursdays forever.'; } },
      { label: 'Challenge the champion', tags: ['impulsive'], run: (x) => { x.train('logic', 2); return check(x, x.stat('smarts'), 65) ? 'Checkmate in twenty-two. The champion asked for a rematch, shakily.' : 'Mate in four. Humbling.'; } },
      { label: 'Come for the biscuits', tags: ['social'], run: (x) => { const n = peer(x, 'friend', 45, 40); return `You never got good, but ${n.firstName} became a friend.`; } },
    ],
  },
  {
    id: 'sc_headLice', cat: 'school', minAge: 5, maxAge: 11, once: true, scene: 'sick',
    when: (x) => inSchool(x),
    title: 'The note home', text: 'A note has come home: there are head lice in your class. Your scalp itches just reading it.',
    choices: [
      { label: 'Submit to the fine comb', tags: ['cautious'], run: (x) => { x.mods({ discipline: 1 }); return 'An hour under the comb. You were clean. Your dignity was not.'; } },
      { label: 'Hide the note', tags: ['impulsive'], run: (x) => { x.mods({ health: -1, looks: -1 }); return 'Two weeks later the whole family had them. You were not thanked.'; } },
      { label: 'Ask for a short haircut', tags: ['ambitious'], run: (x) => { x.mods({ looks: x.chance(0.5) ? 2 : -2 }); return 'A bold new look. Opinions are divided.'; } },
    ],
  },
  // ------------------------------------------------------------------ science fair chain (triggered)
  {
    id: 'sc_scienceRegional', cat: 'school', triggered: true, scene: 'lab',
    title: 'Regional science fair', text: 'Your project is up against hundreds from across the region. A judge is approaching.',
    choices: [
      { label: 'Explain with confidence', tags: ['ambitious'], run: (x) => { x.train('publicSpeaking', 3); if (check(x, x.stat('smarts') + x.stat('charisma') / 3, 70)) { x.setFlag('sc_scienceRegionalWin', true); x.mods({ confidence: 5, professionalRep: 2 }); return 'First place in the region. Your photo is in the local paper.'; } x.mods({ confidence: 1 }); return 'Third place and a firm handshake. Not bad at all.'; } },
      { label: 'Let the work speak', tags: ['cautious'], run: (x) => { x.train('science', 3); return 'The judge read every page and left a thoughtful note: "Keep going."'; } },
      { label: 'Spy on the competition', tags: ['impulsive'], run: (x) => { x.mods({ karma: -1 }); x.train('science', 2); return 'The kid next to you had built a working laser. You felt very small.'; } },
    ],
  },
  {
    id: 'sc_scienceNational', cat: 'school', triggered: true, scene: 'invention',
    when: (x) => !!x.flag('sc_scienceRegionalWin'),
    title: 'The national stage', text: 'Your old project grew into something real. You have been invited to the national youth science prize.',
    choices: [
      { label: 'Present it', tags: ['ambitious'], scene: 'stage', run: (x) => { x.train('science', 5); if (x.chance(0.35)) { x.mods({ fame: 4, confidence: 6 }); x.money(Math.round(2000 * (x.year < 1950 ? 0.15 : 1))); x.remember('scienceNational', 'Won a national youth science prize', 40); x.story('puff', `Teenage prodigy wins national science prize`, 1); return 'You won. A scholarship, a trophy and a terrifying handshake with a minister.'; } x.mods({ confidence: 3 }); return 'Finalist. A professor slipped you her card afterwards.'; } },
      { label: 'Give the credit to your team', tags: ['help'], run: (x) => { x.mods({ empathy: 3, karma: 2 }); x.train('teamwork', 3); return 'Everyone who helped got a mention. The organisers loved it.'; } },
      { label: 'Decline politely', tags: ['cautious'], run: (x) => { x.mods({ stress: -3 }); return 'You had exams. There will be other stages.'; } },
    ],
  },
];

const SECONDARY: EventDef[] = [
  // ================================================================== secondary school academics (10–17)
  {
    id: 'sc_bigTest', cat: 'school', minAge: 10, maxAge: 17, cooldown: 3, scene: 'exam',
    when: (x) => inSchool(x),
    title: 'Test tomorrow', text: 'There is a big test tomorrow. You have not opened the book.',
    choices: [
      { label: 'Cram all night', tags: ['ambitious'], scene: 'study', run: (x) => { x.mods({ energy: -10, stress: 4 }); const ok = check(x, x.stat('smarts') + x.stat('discipline') / 3, 60); gr(x, ok ? 5 : 1); return ok ? 'Bleary-eyed and triumphant: a solid B.' : 'You knew everything at 3am and nothing at 9am.'; } },
      { label: 'Sleep and hope', tags: ['cautious'], run: (x) => { const ok = x.chance(0.3 + x.stat('smarts') / 200); gr(x, ok ? 2 : -4); return ok ? 'Turns out you absorbed more in class than you thought.' : 'Well rested, deeply unprepared.'; } },
      { label: 'Write answers on your arm', tags: ['impulsive'], run: (x) => { x.mods({ karma: -2 }); x.train('deception', 2); if (x.chance(0.3)) { gr(x, -10); x.mods({ popularity: -2 }); return 'You sweated and the ink ran. The teacher read your forearm aloud.'; } gr(x, 5); return 'Nobody checked your sleeve. A hollow victory.'; } },
    ],
  },
  {
    id: 'sc_answerKey', cat: 'school', minAge: 13, maxAge: 18, once: true, scene: 'bribe',
    when: (x) => inSchool(x),
    title: 'The answer key', text: (x) => `A classmate is selling the answers to the final exam for ${x.fmt(Math.round(40 * (x.year < 1950 ? 0.1 : 1)))}.`,
    choices: [
      { label: 'Buy them', tags: ['impulsive'], run: (x) => { const cost = Math.round(40 * (x.year < 1950 ? 0.1 : 1)); if (!x.spend(cost)) return 'You could not afford them. Perhaps that was a mercy.'; x.mods({ karma: -4 }); if (x.chance(0.25)) { gr(x, -20); x.remember('caughtCheating', 'Caught cheating on a final exam', 30); return 'The whole ring was caught. Your name was on the list.'; } gr(x, 10); return 'An A. It tastes of nothing.'; } },
      { label: 'Report it', tags: ['help', 'cautious'], scene: 'meeting', run: (x) => { x.mods({ karma: 3, popularity: -4 }); peer(x, 'enemy', 5, 0); return 'The exam was rewritten overnight. Somebody knows it was you.'; } },
      { label: 'Study instead', tags: ['ambitious'], scene: 'study', run: (x) => { gr(x, 4); x.mods({ discipline: 3 }); return 'You earned every mark. Half the class failed the new paper.'; } },
    ],
  },
  {
    id: 'sc_groupProject', cat: 'school', minAge: 11, maxAge: 22, cooldown: 4, scene: 'meeting',
    when: (x) => inSchool(x) || inHigher(x),
    title: 'Group project', text: 'Four people in your group. One works, one vanishes, one argues, and one is you.',
    choices: [
      { label: 'Do it all yourself', tags: ['ambitious'], run: (x) => { gr(x, 4); x.mods({ stress: 5 }); x.train('management', 2); return 'A perfect project, a shared grade, and a burning sense of injustice.'; } },
      { label: 'Delegate firmly', tags: ['social'], run: (x) => { x.train('leadership', 3); gr(x, 2); return 'You assigned tasks and checked in daily. It actually worked.'; } },
      { label: 'Tell the teacher', tags: ['cautious'], scene: 'classroom', run: (x) => { gr(x, 1); x.mods({ popularity: -1 }); return 'Marks were split fairly. The vanisher has not forgiven you.'; } },
    ],
  },
  {
    id: 'sc_tryouts', cat: 'school', minAge: 11, maxAge: 17, once: true, years: [1870, 2300], scene: 'sports',
    when: (x) => inSchool(x),
    title: 'Team tryouts', text: 'Tryouts for the school team are today. The coach has a clipboard and no mercy.',
    choices: [
      { label: 'Give it everything', tags: ['ambitious'], run: (x) => { if (check(x, x.stat('fitness') + x.skill('ballSports') / 2, 55)) { x.train('ballSports', 5); x.mods({ popularity: 5, fitness: 3, confidence: 4 }); x.setFlag('sc_onTeam', true); return 'Your name is on the list. Training starts at dawn.'; } x.mods({ confidence: -3 }); return 'Not this year. The coach said "next year" like they meant it.'; } },
      { label: 'Try out for manager', tags: ['cautious'], run: (x) => { x.train('management', 2); x.mods({ popularity: 2 }); return 'You now control the kit, the schedule and the oranges. Real power.'; } },
      { label: 'Skip it', run: (x) => { x.mods({ happiness: -1 }); return 'You watched from the bleachers and wondered.'; } },
    ],
  },
  {
    id: 'sc_debate', cat: 'school', minAge: 12, maxAge: 18, once: true, scene: 'stage',
    when: (x) => inSchool(x),
    title: 'The debate', text: 'You have been told to argue a side you disagree with in front of the school.',
    choices: [
      { label: 'Argue it brilliantly', tags: ['ambitious'], run: (x) => { x.train('persuasion', 4); x.train('publicSpeaking', 3); return check(x, x.stat('charisma') + x.stat('smarts') / 2, 65) ? 'You won. You also slightly changed your own mind.' : 'You lost, but the judges praised your nerve.'; } },
      { label: 'Use humour', tags: ['social'], run: (x) => { x.train('humor', 3); x.mods({ popularity: 3 }); return 'You lost the argument and won the room.'; } },
      { label: 'Refuse on principle', tags: ['cautious'], run: (x) => { x.mods({ ego: 2, wisdom: 1 }); return 'The teacher sighed and gave you an essay instead.'; } },
    ],
  },
  {
    id: 'sc_studentCouncil', cat: 'school', minAge: 12, maxAge: 17, once: true, years: [1900, 2300], scene: 'election',
    when: (x) => inSchool(x),
    title: 'Student council', text: 'Elections for class president are next week. Your friends are begging you to run.',
    choices: [
      { label: 'Promise longer lunches', tags: ['impulsive'], run: (x) => { x.train('propaganda', 2); if (x.chance(0.5 + x.stat('popularity') / 200)) { x.mods({ popularity: 5, ego: 3 }); x.setFlag('sc_president', true); return 'Landslide. Lunch stayed exactly the same length.'; } return 'You lost to a kid who promised a chocolate fountain.'; } },
      { label: 'Run a serious campaign', tags: ['ambitious'], run: (x) => { x.train('leadership', 3); x.train('publicSpeaking', 2); if (check(x, x.stat('charisma'), 50)) { x.mods({ confidence: 5 }); x.setFlag('sc_president', true); return 'You won and got a recycling bin installed. A legacy.'; } return 'You lost narrowly. The speech was good, though.'; } },
      { label: 'Manage a friend\'s campaign', tags: ['help'], run: (x) => { x.train('marketing', 3); return 'Your posters won it for them. The kingmaker, at fourteen.'; } },
    ],
  },
  {
    id: 'sc_schoolPaper', cat: 'school', minAge: 12, maxAge: 18, once: true, years: [1880, 2300], scene: 'newsroom',
    when: (x) => inSchool(x),
    title: 'The scoop', text: 'Writing for the school paper, you discover the canteen has been serving the same stew for nine days.',
    choices: [
      { label: 'Publish the exposé', tags: ['ambitious'], scene: 'scandal', run: (x) => { x.train('writing', 4); x.mods({ popularity: 4, confidence: 3 }); return '"STEWGATE" sold out. The canteen now has a menu board.'; } },
      { label: 'Ask the cooks first', tags: ['help'], run: (x) => { x.train('writing', 2); x.mods({ empathy: 3 }); return 'Their budget had been cut. You wrote about that instead, and it got fixed.'; } },
      { label: 'Write about the chess club', tags: ['cautious'], run: (x) => { x.train('writing', 2); return 'The chess club was thrilled. Nobody else read it.'; } },
    ],
  },
  {
    id: 'sc_yearbook', cat: 'school', minAge: 15, maxAge: 18, once: true, years: [1900, 2300], scene: 'fame',
    when: (x) => inSchool(x),
    title: 'Most likely to…', text: 'The yearbook superlatives are out. You have been voted "Most likely to…"',
    auto: (x) => {
      const s = x.stat('popularity') > 60 ? 'be famous' : x.stat('smarts') > 65 ? 'cure a disease' : x.stat('aggression') > 55 ? 'be arrested' : x.stat('creativity') > 60 ? 'write a novel' : 'be late to their own wedding';
      x.mods({ ego: 1 });
      return `"…${s}." You will be reminded of this at every reunion.`;
    },
  },
  {
    id: 'sc_olympiad', cat: 'school', minAge: 12, maxAge: 18, once: true, years: [1900, 2300], scene: 'exam',
    when: (x) => inSchool(x) && x.stat('smarts') >= 55,
    title: 'Maths olympiad', text: 'You have been picked for the maths olympiad. Problem six has no obvious way in.',
    choices: [
      { label: 'Stare until it cracks', tags: ['ambitious'], run: (x) => { x.train('mathematics', 5); x.train('logic', 3); if (check(x, x.stat('smarts'), 70)) { x.mods({ confidence: 6 }); x.remember('olympiad', 'Medalled at the maths olympiad', 30); return 'At minute 170 it opened like a flower. Silver medal.'; } return 'You solved four of six. Respectable, and humbling.'; } },
      { label: 'Secure the easy marks', tags: ['cautious'], run: (x) => { x.train('mathematics', 3); gr(x, 2); return 'A tidy bronze. Strategy is its own kind of genius.'; } },
      { label: 'Make friends with rivals', tags: ['social'], run: (x) => { const n = peer(x, 'friend', 50, 45); x.train('mathematics', 2); return `${n.firstName} from another school still sends you puzzles decades later.`; } },
    ],
  },
  {
    id: 'sc_overnightTrip', cat: 'school', minAge: 10, maxAge: 17, once: true, years: [1900, 2300], scene: 'camping',
    when: (x) => inSchool(x),
    title: 'School trip', text: 'The class is away for three nights. The teachers are already exhausted.',
    choices: [
      { label: 'Raid the snack stash', tags: ['impulsive'], run: (x) => { x.mods({ popularity: 4, discipline: -2 }); return 'A midnight feast for twenty. You were caught at 2am with a torch and no shame.'; } },
      { label: 'Tell ghost stories', tags: ['social'], scene: 'ghost', run: (x) => { x.train('writing', 1); x.mods({ creativity: 3, popularity: 2 }); return 'Three kids slept with the lights on. Masterpiece.'; } },
      { label: 'Actually go to sleep', tags: ['cautious'], run: (x) => { x.mods({ energy: 5 }); return 'You were the only one awake for the hike. The view was yours alone.'; } },
    ],
  },
  {
    id: 'sc_labAccident', cat: 'school', minAge: 12, maxAge: 18, once: true, years: [1890, 2300], scene: 'lab',
    when: (x) => inSchool(x),
    title: 'Chemistry class', text: 'Your lab partner reaches for the wrong bottle. You see it happening in slow motion.',
    choices: [
      { label: 'Grab their wrist', tags: ['help'], run: (x) => { x.mods({ karma: 2 }); x.train('chemistry', 2); const n = peer(x, 'friend', 55, 50); return `You stopped ${n.firstName} just in time. The teacher went pale and gave you both an A.`; } },
      { label: 'Duck', tags: ['cautious'], scene: 'explosion', run: (x) => { x.mods({ anxiety: 2 }); return 'A loud bang, a purple cloud, eyebrows singed. The fire alarm was a nice touch.'; } },
      { label: 'Let it happen, for science', tags: ['impulsive'], scene: 'explosion', run: (x) => { x.train('chemistry', 3); x.mods({ health: -2, riskTolerance: 3 }); return 'Now you know exactly what that does. So does the ceiling.'; } },
    ],
  },
  {
    id: 'sc_dissection', cat: 'school', minAge: 12, maxAge: 17, once: true, years: [1900, 2300], scene: 'lab',
    when: (x) => inSchool(x),
    title: 'Dissection day', text: 'A preserved frog lies on the tray in front of you. It looks disappointed.',
    choices: [
      { label: 'Scalpel, please', tags: ['ambitious'], run: (x) => { x.train('biology', 4); x.train('surgery', 1); return 'Steady hands. Your teacher muttered something about medical school.'; } },
      { label: 'Feel faint', tags: ['cautious'], scene: 'sick', run: (x) => { x.mods({ empathy: 2 }); return 'You spent the lesson in the nurse\'s office with a biscuit.'; } },
      { label: 'Refuse on moral grounds', tags: ['help'], run: (x) => { x.mods({ empathy: 3, ego: 1 }); x.train('biology', 1); return 'You wrote an essay on frogs instead. It was passionate.'; } },
    ],
  },
  {
    id: 'sc_essayContest', cat: 'school', minAge: 11, maxAge: 18, once: true, scene: 'library',
    when: (x) => inSchool(x),
    title: 'Essay contest', text: 'There is a prize for the best essay on "What I will become."',
    choices: [
      { label: 'Write from the heart', tags: ['social'], run: (x) => { x.train('writing', 4); if (check(x, x.skill('writing') + x.stat('creativity'), 70)) { x.money(Math.round(100 * (x.year < 1950 ? 0.1 : 1))); x.mods({ confidence: 4 }); return 'You won. Your mother read it aloud at three different dinners.'; } return 'No prize, but the teacher wrote "beautiful" in the margin.'; } },
      { label: 'Write what judges want', tags: ['ambitious'], run: (x) => { x.train('writing', 2); x.train('persuasion', 2); return 'Second place for an essay about becoming "a pillar of civic virtue".'; } },
      { label: 'Submit a poem instead', tags: ['impulsive'], scene: 'reading', run: (x) => { x.train('poetry', 3); x.mods({ creativity: 3 }); return 'Disqualified, then quietly published in the school magazine.'; } },
    ],
  },
  {
    id: 'sc_artClass', cat: 'school', minAge: 8, maxAge: 17, once: true, scene: 'painting',
    when: (x) => inSchool(x),
    title: 'Art class', text: 'The assignment is a self-portrait. You stare into the mirror for a long time.',
    choices: [
      { label: 'Paint it honestly', tags: ['cautious'], run: (x) => { x.train('painting', 3); x.mods({ wisdom: 2 }); return 'It looks more like you than you expected. A little uncomfortable.'; } },
      { label: 'Go abstract', tags: ['impulsive'], run: (x) => { x.train('art', 3); x.mods({ creativity: 4 }); return 'Three triangles and a scream. The teacher hung it in the hall.'; } },
      { label: 'Paint someone else', tags: ['social'], run: (x) => { x.train('painting', 2); x.mods({ empathy: 2 }); return 'You painted your grandmother instead. She keeps it by her bed.'; } },
    ],
  },
  {
    id: 'sc_dodgeball', cat: 'school', minAge: 9, maxAge: 16, once: true, years: [1900, 2300], scene: 'gym',
    when: (x) => inSchool(x),
    title: 'Dodgeball', text: 'You are the last one standing on your team. Five balls are pointed at you.',
    choices: [
      { label: 'Catch one', tags: ['ambitious'], run: (x) => { if (check(x, x.stat('fitness') + x.stat('dexterity'), 100)) { x.mods({ popularity: 6, confidence: 5 }); return 'You caught it one-handed. Your whole team came back in. Hero.'; } x.mods({ health: -1 }); return 'You caught it with your face.'; } },
      { label: 'Dodge everything', tags: ['cautious'], run: (x) => { x.mods({ fitness: 2, dexterity: 2 }); return 'You dodged for three glorious minutes before a sneaky one got your foot.'; } },
      { label: 'Surrender dramatically', tags: ['social'], run: (x) => { x.train('acting', 1); x.mods({ popularity: 2 }); return 'You fell to your knees and begged. It was the best death of the term.'; } },
    ],
  },
  {
    id: 'sc_substitute', cat: 'school', minAge: 8, maxAge: 17, once: true, scene: 'classroom',
    when: (x) => inSchool(x),
    title: 'Substitute teacher', text: 'A nervous substitute teacher has arrived. The class smells blood.',
    choices: [
      { label: 'Lead the chaos', tags: ['impulsive'], run: (x) => { x.mods({ popularity: 3, karma: -2, discipline: -2 }); return 'Everyone swapped names. The register is now fiction.'; } },
      { label: 'Help them out', tags: ['help'], run: (x) => { x.mods({ karma: 2, empathy: 3 }); return 'You showed them where everything was. They mouthed "thank you" at the bell.'; } },
      { label: 'Read quietly', tags: ['cautious'], scene: 'reading', run: (x) => { x.train('literacy', 2); return 'You finished a whole novel while the room burned around you.'; } },
    ],
  },
  {
    id: 'sc_mentorTeacher', cat: 'school', minAge: 11, maxAge: 18, once: true, scene: 'classroom',
    when: (x) => inSchool(x) && !x.rels('mentor').length,
    title: 'Someone believes in you', text: (x) => `Your ${teacherWord(x)} kept you behind. Not for trouble: "You have a real gift, you know."`,
    choices: [
      { label: 'Ask for extra work', tags: ['ambitious'], run: (x) => { const t = elder(x, 'mentor', 60, 60); gr(x, 6); x.mods({ confidence: 5, smarts: 2 }); x.remember('mentorTeacher', `${t.firstName} told you that you had a gift`, 35, t.id); return `${t.firstName} lent you books from their own shelves. You devoured them.`; } },
      { label: 'Shrug it off', tags: ['cautious'], run: (x) => { x.mods({ confidence: 1 }); return 'You said "thanks" and left quickly. But you thought about it for years.'; } },
      { label: 'Ask what gift', tags: ['social'], run: (x) => { const t = elder(x, 'mentor', 50, 50); x.mods({ wisdom: 2 }); return `"Curiosity," ${t.firstName} said. "Most people lose it by now."`; } },
    ],
  },
  {
    id: 'sc_truant', cat: 'school', minAge: 12, maxAge: 17, cooldown: 3, scene: 'friends',
    when: (x) => inSchool(x),
    title: 'Skip school?', text: 'It is a perfect sunny day. Your friends are skipping class and going to the river.',
    choices: [
      { label: 'Go with them', tags: ['impulsive', 'social'], scene: 'beach', run: (x) => { x.mods({ happiness: 5, popularity: 3, discipline: -2 }); gr(x, -3); return x.chance(0.3) ? 'A neighbour spotted you and phoned your parents. Worth it? Mostly.' : 'The best day of the year, and nobody ever found out.'; } },
      { label: 'Go to class', tags: ['cautious'], scene: 'classroom', run: (x) => { gr(x, 2); x.mods({ discipline: 2, happiness: -1 }); return 'You stared out of the window all afternoon. Responsible and wistful.'; } },
      { label: 'Forge a sick note', tags: ['ambitious'], run: (x) => { x.train('forgery', 2); x.mods({ karma: -1, happiness: 3 }); return 'Officially you had a "tummy bug". Officially.'; } },
    ],
  },
  {
    id: 'sc_marchingBand', cat: 'school', minAge: 12, maxAge: 17, once: true, years: [1880, 2300], scene: 'parade',
    when: (x) => inSchool(x),
    title: 'Marching band', text: 'The band needs a drummer for the homecoming parade, and the drummer has a broken arm.',
    choices: [
      { label: 'Take the drum', tags: ['ambitious'], run: (x) => { x.train('music', 4); x.mods({ popularity: 3, fitness: 1 }); return 'You marched, you drummed, you only walked into one tuba.'; } },
      { label: 'Carry the banner', tags: ['cautious'], run: (x) => { x.train('teamwork', 2); return 'The banner was spelled right. Your work here is done.'; } },
      { label: 'Twirl the baton', tags: ['impulsive'], run: (x) => { x.train('dance', 2); x.mods({ dexterity: 2 }); return 'It went higher than anyone expected and landed in a tree.'; } },
    ],
  },
  {
    id: 'sc_woodshop', cat: 'school', minAge: 11, maxAge: 17, once: true, years: [1880, 2300], scene: 'construction',
    when: (x) => inSchool(x),
    title: 'Woodwork class', text: 'The project is a birdhouse. You have a saw, a plank and enormous ambitions.',
    choices: [
      { label: 'Build a bird mansion', tags: ['ambitious'], run: (x) => { x.train('carpentry', 4); x.mods({ creativity: 2 }); return 'Three storeys and a porch. No bird has been brave enough to move in.'; } },
      { label: 'Follow the instructions', tags: ['cautious'], run: (x) => { x.train('carpentry', 3); x.mods({ discipline: 1 }); return 'A sensible birdhouse. A sensible bird lives there now.'; } },
      { label: 'Make a weapon instead', tags: ['violent'], run: (x) => { x.train('carpentry', 1); x.mods({ aggression: 1 }); return 'Confiscated. The teacher admired the craftsmanship, privately.'; } },
    ],
  },
  {
    id: 'sc_homeEc', cat: 'school', minAge: 11, maxAge: 16, once: true, years: [1900, 2300], scene: 'cooking',
    when: (x) => inSchool(x),
    title: 'Cookery class', text: 'Today you are baking scones. The oven is old and has opinions.',
    choices: [
      { label: 'Follow the recipe exactly', tags: ['cautious'], run: (x) => { x.train('baking', 3); return 'Perfect scones. Your family ate them all before you got home.'; } },
      { label: 'Add a secret ingredient', tags: ['impulsive'], run: (x) => { x.train('cooking', 2); x.mods({ creativity: 2 }); return x.chance(0.5) ? 'Cheese and chilli. The teacher asked for the recipe.' : 'Mustard was a mistake. A memorable mistake.'; } },
      { label: 'Help the struggling table', tags: ['help'], run: (x) => { x.train('baking', 2); x.mods({ empathy: 2, popularity: 2 }); return 'You saved four scones and one reputation.'; } },
    ],
  },
  {
    id: 'sc_exchangeStudent', cat: 'school', minAge: 12, maxAge: 17, once: true, years: [1950, 2300], scene: 'familyDinner',
    when: (x) => inSchool(x),
    title: 'Exchange student', text: 'An exchange student is staying with your family for a month. They speak very little of your language.',
    choices: [
      { label: 'Teach them slang', tags: ['impulsive'], run: (x) => { const n = peer(x, 'friend', 55, 45); x.train('languages', 2); return `${n.firstName} now says "cheers, mate" to everyone, including your grandmother.`; } },
      { label: 'Learn their language', tags: ['ambitious'], run: (x) => { const n = peer(x, 'friend', 60, 50); x.train('languages', 5); return `By the end you were arguing with ${n.firstName} in two languages.`; } },
      { label: 'Show them your town', tags: ['social', 'help'], scene: 'friends', run: (x) => { const n = peer(x, 'bestFriend', 65, 55); x.mods({ empathy: 3 }); return `${n.firstName} cried at the airport. So did you.`; } },
    ],
  },
  {
    id: 'sc_examStress', cat: 'school', minAge: 14, maxAge: 18, once: true, years: [1850, 2300], scene: 'exam',
    when: (x) => inSchool(x) && x.stat('stress') > 35,
    title: 'Exam season', text: 'Final exams are a month away. Your chest is tight and you cannot sleep.',
    choices: [
      { label: 'Talk to someone', tags: ['help', 'cautious'], scene: 'calm', run: (x) => { x.mods({ stress: -8, anxiety: -4 }); return 'A school counsellor helped you build a plan. Breathing got easier.'; } },
      { label: 'Study twelve hours a day', tags: ['ambitious'], scene: 'study', run: (x) => { gr(x, 6); x.mods({ stress: 6, health: -2 }); return 'Top grades and a twitch in your left eye.'; } },
      { label: 'Take walks between sessions', tags: ['cautious'], scene: 'hiking', run: (x) => { gr(x, 3); x.mods({ stress: -3, fitness: 1 }); return 'Balanced, steady, sane. The rarest outcome of exam season.'; } },
    ],
  },
  {
    id: 'sc_headOffice', cat: 'school', minAge: 9, maxAge: 17, once: true, scene: 'office',
    when: (x) => inSchool(x),
    title: 'Sent to the head', text: 'You have been sent to the head teacher\'s office. You are not entirely sure why.',
    choices: [
      { label: 'Plead innocence', tags: ['cautious'], run: (x) => { x.train('persuasion', 2); return x.chance(0.6) ? 'It was a case of mistaken identity. You were released with an apology.' : 'They had a photograph. Detention.'; } },
      { label: 'Take the blame for a friend', tags: ['help'], run: (x) => { x.mods({ karma: 3, popularity: 4 }); return 'A week of detention, and a friend for life.'; } },
      { label: 'Charm your way out', tags: ['social'], run: (x) => { x.train('charm', 3); return check(x, x.stat('charisma'), 55) ? 'You left with a warning and a biscuit.' : 'They have met charmers before. Two detentions.'; } },
    ],
  },
  {
    id: 'sc_hallFight', cat: 'school', minAge: 11, maxAge: 17, once: true, scene: 'fight', violent: true,
    when: (x) => inSchool(x),
    title: 'Fight in the corridor', text: 'Two kids are scrapping in the corridor and a crowd is chanting.',
    choices: [
      { label: 'Break it up', tags: ['help'], run: (x) => { x.train('conflictResolution', 3); x.mods({ karma: 2 }); return x.chance(0.6) ? 'You stepped between them and it fizzled out.' : 'You caught an elbow for your trouble, but it stopped.'; } },
      { label: 'Fetch a teacher', tags: ['cautious'], scene: 'classroom', run: (x) => { x.mods({ wisdom: 1 }); return 'A teacher arrived, the crowd scattered, and nobody saw you go.'; } },
      { label: 'Join the chanting', tags: ['impulsive', 'social'], run: (x) => { x.mods({ aggression: 2, karma: -1 }); return 'Half the crowd got detention, including you.'; } },
    ],
  },
  {
    id: 'sc_tutorPeer', cat: 'school', minAge: 11, maxAge: 18, once: true, scene: 'study',
    when: (x) => inSchool(x) && x.c.education.grades >= 60,
    title: 'Can you help?', text: 'A classmate who is failing asks if you could help them study.',
    choices: [
      { label: 'Tutor them weekly', tags: ['help'], run: (x) => { const n = peer(x, 'friend', 60, 55); x.train('mentoring', 4); x.mods({ empathy: 3 }); return `${n.firstName} passed. They told everyone it was because of you.`; } },
      { label: 'Charge for it', tags: ['ambitious'], run: (x) => { x.money(Math.round(30 * (x.year < 1950 ? 0.1 : 1))); x.train('mentoring', 2); x.train('entrepreneurship', 1); return 'Your first business. Four clients by the end of term.'; } },
      { label: 'Say you are busy', tags: ['cautious'], run: (x) => { x.mods({ empathy: -1 }); return 'They found someone else. It still sits with you a little.'; } },
    ],
  },
];

/** Gender of a classmate the character might innocently have a crush on. */
const crushGender = (x: Ctx): Gender => {
  const g = x.c.gender;
  const other: Gender = g === 'male' ? 'female' : g === 'female' ? 'male' : x.pick(['male', 'female']);
  if (x.c.sexuality === 'gay') return g === 'nonbinary' ? x.pick(['male', 'female']) : g;
  if (x.c.sexuality === 'bisexual') return x.pick(['male', 'female']);
  return other;
};
/** A same-age classmate for innocent teen crushes (kept as 'friend', never a partner). */
const crushOn = (x: Ctx) => {
  const n = makeNpc(x, { age: Math.max(13, Math.min(17, x.age + x.int(-1, 1))), gender: crushGender(x), career: null });
  x.addRel(n.id, 'friend', { affinity: 45, trust: 30 });
  return n;
};
const canCrush = (x: Ctx) => x.c.sexuality !== 'asexual';
const era$ = (x: Ctx, n: number) => Math.max(1, Math.round(n * (x.year < 1900 ? 0.05 : x.year < 1950 ? 0.12 : x.year < 1980 ? 0.35 : 1)));

const TEEN: EventDef[] = [
  // ================================================================== teen life (13–17): innocent
  {
    id: 'sc_crush', cat: 'teen', minAge: 13, maxAge: 17, once: true, weight: 2, scene: 'loveLetter',
    when: canCrush,
    title: 'A crush', text: 'Someone in your class laughed at your joke today, and now you cannot stop thinking about them.',
    choices: [
      { label: 'Pass them a note', tags: ['impulsive'], run: (x) => { const n = crushOn(x); x.setFlag('sc_crushId', n.id); if (x.chance(0.5)) { x.relMod(n.id, 10, 5); x.mods({ happiness: 6, confidence: 3 }); return `${n.firstName} wrote back: "Me too." You floated home.`; } x.mods({ confidence: -3 }); return `${n.firstName} read it, went pink, and said nothing for a week.`; } },
      { label: 'Admire from afar', tags: ['cautious'], scene: 'lonely', run: (x) => { const n = crushOn(x); x.mods({ creativity: 2 }); return `You filled a notebook with ${n.firstName}'s initials and never said a word.`; } },
      { label: 'Tell your best friend', tags: ['social'], scene: 'friends', run: (x) => { const n = crushOn(x); x.mods({ happiness: 2 }); return `By lunchtime, half the school knew you liked ${n.firstName}. Friendship is a double-edged sword.`; } },
    ],
  },
  {
    id: 'sc_schoolDance', cat: 'teen', minAge: 13, maxAge: 17, once: true, years: [1900, 2300], scene: 'dance',
    when: (x) => inSchool(x),
    title: 'The school dance', text: 'Paper streamers, a gym that smells of floor polish, and everyone pretending not to look at each other.',
    choices: [
      { label: 'Ask someone to dance', tags: ['ambitious'], when: canCrush, run: (x) => { const n = crushOn(x); if (x.chance(0.5 + x.stat('confidence') / 300)) { x.relMod(n.id, 8, 4); x.mods({ confidence: 5, happiness: 5 }); return `${n.firstName} said yes. You stepped on their foot twice. Best night ever.`; } x.mods({ confidence: -3 }); return `${n.firstName} said they were "resting". You danced with the punch bowl.`; } },
      { label: 'Dance with your friends', tags: ['social'], scene: 'party', run: (x) => { x.mods({ happiness: 5, popularity: 2 }); x.train('dance', 2); return 'You did every silly dance there is. Nobody cared who watched.'; } },
      { label: 'Hold up the wall', tags: ['cautious'], scene: 'lonely', run: (x) => { x.mods({ loneliness: 2 }); return 'You and the wall had a long, meaningful evening together.'; } },
    ],
  },
  {
    id: 'sc_firstKiss', cat: 'teen', minAge: 15, maxAge: 17, once: true, scene: 'kiss',
    when: (x) => canCrush(x) && !!x.flag('sc_crushId') && !!x.npc(String(x.flag('sc_crushId'))),
    bind: (x) => ({ npcId: String(x.flag('sc_crushId')) }),
    title: 'Walking home', text: (x) => `${who(x)} walks you home after school. At the gate, neither of you says goodbye.`,
    choices: [
      { label: 'A quick first kiss', tags: ['impulsive'], run: (x) => { x.relMod(npcId(x), 10, 6); x.mods({ happiness: 8, confidence: 4 }); x.remember('firstKiss', `First kiss with ${x.first(npcId(x))}, at the garden gate`, 35, npcId(x)); return 'Brief, clumsy and perfect. You both ran inside, grinning.'; } },
      { label: 'Hold hands a moment', tags: ['cautious'], scene: 'friends', run: (x) => { x.relMod(npcId(x), 6, 6); x.mods({ happiness: 5 }); return 'Your hands were sweaty. Neither of you let go for a whole minute.'; } },
      { label: 'Say "see you tomorrow"', tags: ['social'], run: (x) => { x.relMod(npcId(x), 2); return 'You said it, then said it again, then walked into the gatepost.'; } },
    ],
  },
  {
    id: 'sc_crushOther', cat: 'teen', minAge: 13, maxAge: 17, once: true, scene: 'heartbreak',
    when: (x) => canCrush(x) && !!x.flag('sc_crushId'),
    title: 'Someone else', text: 'You find out that your crush likes someone else. Someone with better hair.',
    choices: [
      { label: 'Wish them well', tags: ['help'], scene: 'calm', run: (x) => { x.mods({ empathy: 3, wisdom: 2, happiness: -2 }); return 'It stung for a month. Then it was just a story.'; } },
      { label: 'Write sad poetry', tags: ['impulsive'], scene: 'reading', run: (x) => { x.train('poetry', 3); x.mods({ creativity: 3, happiness: -2 }); return 'Eleven poems, each worse than the last, all deeply felt.'; } },
      { label: 'Throw yourself into hobbies', tags: ['ambitious'], scene: 'gym', run: (x) => { x.mods({ fitness: 2, discipline: 2 }); return 'Heartbreak made you very good at basketball.'; } },
    ],
  },
  {
    id: 'sc_smokeOffer', cat: 'teen', minAge: 13, maxAge: 17, once: true, scene: 'friends',
    title: 'Behind the bike shed', text: (x) => `The cool kids are passing around ${x.year < 1900 ? 'a clay pipe' : x.year < 2010 ? 'a cigarette' : 'a vape'}. It comes to you.`,
    choices: [
      { label: 'Say no thanks', tags: ['cautious'], run: (x) => { x.mods({ willpower: 3, health: 1 }); return 'Someone muttered "lame". Your lungs thanked you.'; } },
      { label: 'Try it', tags: ['impulsive', 'social'], run: (x) => { x.mods({ popularity: 2, health: -1, riskTolerance: 2 }); return 'You coughed until you saw stars. Very cool. Extremely cool.'; } },
      { label: 'Walk away', tags: ['help'], run: (x) => { x.mods({ confidence: 2 }); return 'You found better friends by the library. They had snacks.'; } },
    ],
  },
  {
    id: 'sc_houseParty', cat: 'teen', minAge: 15, maxAge: 17, once: true, years: [1950, 2300], scene: 'party',
    title: 'House party', text: 'A classmate\'s parents are away. Half the school is in their living room and someone brought drinks.',
    choices: [
      { label: 'Stick to lemonade', tags: ['cautious'], run: (x) => { x.mods({ popularity: 1, willpower: 2 }); return 'You were the one who remembered everything the next day. Useful.'; } },
      { label: 'Drink with everyone', tags: ['impulsive'], scene: 'sick', run: (x) => { x.mods({ popularity: 3, health: -3, happiness: 2 }); return 'You remember the start and the end. The middle was apparently a speech on a table.'; } },
      { label: 'Help clean up', tags: ['help'], run: (x) => { x.mods({ karma: 2, empathy: 2 }); return 'The host nearly cried with gratitude. The vase was saved.'; } },
      { label: 'Leave early', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 2 }); return 'The police arrived an hour later. You were already in bed.'; } },
    ],
  },
  {
    id: 'sc_curfew', cat: 'teen', minAge: 13, maxAge: 17, cooldown: 3, scene: 'family',
    when: (x) => x.aliveParents().length > 0,
    title: 'Past curfew', text: 'It is an hour past curfew. Every light in your house is on.',
    choices: [
      { label: 'Apologise immediately', tags: ['cautious'], run: (x) => { x.mods({ discipline: 2 }); return 'One week grounded. A fair sentence, reluctantly accepted.'; } },
      { label: 'Climb in the window', tags: ['impulsive'], run: (x) => { x.train('burglary', 1); return x.chance(0.4) ? 'Your mother was sitting on your bed in the dark. Chilling.' : 'Perfect landing. Nobody suspected a thing.'; } },
      { label: 'Argue about freedom', tags: ['ambitious'], scene: 'argument', run: (x) => { x.train('persuasion', 2); x.mods({ stress: 3 }); return 'You won the argument and lost the month. Grounded.'; } },
    ],
  },
  {
    id: 'sc_partTimeJob', cat: 'teen', minAge: 14, maxAge: 17, once: true, years: [1850, 2300], scene: 'restaurant',
    when: (x) => !x.employed,
    title: 'Your first job', text: (x) => `The ${x.year < 1920 ? 'grocer' : x.year < 1960 ? 'soda fountain' : 'burger place'} down the road is hiring weekend help.`,
    choices: [
      { label: 'Take the job', tags: ['ambitious'], run: (x) => { x.money(era$(x, 600)); x.train('hospitality', 3); x.mods({ discipline: 3, energy: -3 }); return 'Your first wages. You looked at them for a long time.'; } },
      { label: 'Do a paper round instead', tags: ['cautious'], scene: 'sports', run: (x) => { x.money(era$(x, 300)); x.mods({ fitness: 3, discipline: 2 }); return 'Up at five, every day, in all weather. You know every dog on the route.'; } },
      { label: 'Start your own hustle', tags: ['impulsive'], scene: 'startup', run: (x) => { x.train('entrepreneurship', 3); x.money(era$(x, x.chance(0.5) ? 800 : 100)); return 'Washing cars, mowing lawns, selling sweets: an empire, of sorts.'; } },
    ],
  },
  {
    id: 'sc_babysitting', cat: 'teen', minAge: 13, maxAge: 17, once: true, scene: 'playground',
    title: 'Babysitting', text: 'The neighbours need someone to mind their three children for the evening.',
    choices: [
      { label: 'Run a tight ship', tags: ['cautious'], run: (x) => { x.money(era$(x, 40)); x.train('leadership', 2); return 'In bed by eight. The parents booked you for every Saturday.'; } },
      { label: 'Let them run wild', tags: ['impulsive'], run: (x) => { x.money(era$(x, 20)); x.mods({ happiness: 3 }); return 'Pillow forts, ice cream for dinner. Loved by the children; not rehired.'; } },
      { label: 'Teach them a card trick', tags: ['social'], run: (x) => { x.money(era$(x, 40)); x.mods({ charisma: 2, empathy: 2 }); return 'The youngest now thinks you are a wizard.'; } },
    ],
  },
  {
    id: 'sc_drivingLesson', cat: 'teen', minAge: 15, maxAge: 18, once: true, scene: 'car',
    title: (x) => (x.year < 1910 ? 'Taking the reins' : 'Driving lessons'), text: (x) => (x.year < 1910 ? 'Your father hands you the reins of the cart. The horse looks unconvinced.' : x.year >= 2060 ? 'The car can drive itself, but the law still says you must learn the manual override.' : 'A parent sits in the passenger seat, gripping the dashboard.'),
    choices: [
      { label: 'Go slow and careful', tags: ['cautious'], run: (x) => { x.mods({ discipline: 2, confidence: 2 }); return 'Smooth, steady and boring. Your instructor nearly fell asleep.'; } },
      { label: 'Put your foot down', tags: ['impulsive'], scene: 'carChase', run: (x) => { x.mods({ riskTolerance: 3, stress: 2 }); x.train('getawayDriving', 1); return x.chance(0.4) ? 'You clipped a hedge and a mailbox. Lesson over.' : 'Exhilarating. Your parent has new grey hairs.'; } },
      { label: 'Practise parking for hours', tags: ['ambitious'], run: (x) => { x.mods({ dexterity: 2 }); return 'You can now park anything anywhere. A quiet superpower.'; } },
    ],
  },
  {
    id: 'sc_drivingTest', cat: 'teen', minAge: 16, maxAge: 19, once: true, years: [1930, 2080], scene: 'car',
    title: 'The driving test', text: 'The examiner has a clipboard and the face of someone who has seen many crashes.',
    choices: [
      { label: 'Drive perfectly', tags: ['cautious'], run: (x) => { if (check(x, x.stat('discipline') + x.stat('dexterity') / 2, 55)) { x.mods({ confidence: 5, happiness: 4 }); x.setFlag('driverLicence', true); return 'Passed! Freedom has a set of keys.'; } x.mods({ confidence: -3 }); return 'Failed for not checking a mirror. You will check every mirror forever.'; } },
      { label: 'Chat to the examiner', tags: ['social'], run: (x) => { x.train('charm', 2); return x.chance(0.5) ? 'Passed. You talked about their dog the entire time.' : 'They wrote "talkative" and "failed" on the same line.'; } },
      { label: 'Panic on the roundabout', tags: ['impulsive'], run: (x) => { x.mods({ anxiety: 2 }); return 'You went round four times. The examiner laughed for the first time in years. Failed, kindly.'; } },
    ],
  },
  {
    id: 'sc_groupChat', cat: 'teen', minAge: 13, maxAge: 18, once: true, years: [2005, 2300], scene: 'internet',
    title: 'The screenshot', text: 'Something you typed in a private group chat has been screenshotted and shared with the whole year.',
    choices: [
      { label: 'Apologise publicly', tags: ['help'], run: (x) => { x.mods({ popularity: -2, karma: 2, wisdom: 3 }); return 'It blew over in a week. You now type as if everyone is reading. They are.'; } },
      { label: 'Find the leaker', tags: ['violent'], scene: 'argument', run: (x) => { const n = peer(x, 'rival', 15, 5); x.mods({ aggression: 2 }); return `It was ${n.firstName}. The feud lasted until graduation.`; } },
      { label: 'Log off for a while', tags: ['cautious'], scene: 'calm', run: (x) => { x.mods({ stress: -4, anxiety: -2 }); return 'Two weeks offline. The world kept turning, quieter.'; } },
    ],
  },
  {
    id: 'sc_viral', cat: 'teen', minAge: 13, maxAge: 19, once: true, years: [2008, 2300], scene: 'fame',
    title: 'Gone viral', text: 'A silly video of you went viral overnight. Strangers are quoting it back to you.',
    choices: [
      { label: 'Lean into it', tags: ['ambitious'], run: (x) => { x.mods({ fame: 4, popularity: 4, ego: 3 }); x.train('socialMediaManipulation', 2); return 'You made a follow-up. It did half as well. Fame is cruel.'; } },
      { label: 'Ask for it to come down', tags: ['cautious'], run: (x) => { x.mods({ anxiety: 2, popularity: 1 }); return 'It stayed up. It will probably outlive you.'; } },
      { label: 'Laugh with everyone', tags: ['social'], run: (x) => { x.mods({ popularity: 3, resilience: 3 }); return 'Being in on the joke made it yours.'; } },
    ],
  },
  {
    id: 'sc_onlineMean', cat: 'teen', minAge: 13, maxAge: 18, once: true, years: [2005, 2300], scene: 'internet',
    title: 'Anonymous comments', text: 'An anonymous account keeps leaving cruel comments on everything you post.',
    choices: [
      { label: 'Block and report', tags: ['cautious'], run: (x) => { x.mods({ anxiety: -2, wisdom: 2 }); return 'The account vanished. You decided its opinion never counted.'; } },
      { label: 'Tell a parent', tags: ['help'], scene: 'family', run: (x) => { x.mods({ stress: -3 }); return 'Your parent took it to the school. It stopped within days.'; } },
      { label: 'Fire back', tags: ['impulsive'], run: (x) => { x.mods({ stress: 4, aggression: 2 }); return 'It turned into a war. Nobody won, everyone watched.'; } },
    ],
  },
  {
    id: 'sc_friendConfides', cat: 'teen', minAge: 13, maxAge: 18, once: true, scene: 'friends',
    bind: bindRel('bestFriend', 'friend'),
    title: 'A friend\'s secret', text: (x) => `${who(x)} tells you, very quietly, that they think they might be gay. ${x.w.socialNorms < 40 ? 'In this place and time, it could cost them dearly.' : 'They are still terrified.'}`,
    choices: [
      { label: 'Tell them nothing changes', tags: ['help'], run: (x) => { x.relMod(npcId(x), 12, 15); x.mods({ empathy: 4, karma: 3 }); x.remember('trustedFriend', `${x.first(npcId(x))} trusted you with who they are`, 25, npcId(x)); return 'They let out a breath they had held for years. You hugged.'; } },
      { label: 'Promise to keep it safe', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), 8, 12); x.mods({ empathy: 2 }); return 'You never told a soul. It was not yours to tell.'; } },
      { label: 'Ask how you can help', tags: ['social'], run: (x) => { x.relMod(npcId(x), 10, 10); x.mods({ wisdom: 2 }); return 'Mostly they needed someone to know. Now someone does.'; } },
    ],
  },
  {
    id: 'sc_findingWords', cat: 'teen', minAge: 13, maxAge: 18, once: true, scene: 'library',
    weight: (x) => (x.c.sexuality === 'gay' || x.c.sexuality === 'bisexual' || x.c.gender === 'nonbinary' ? 2 : 0),
    title: 'Finding the words', text: (x) => (x.year < 1970 ? 'Tucked in a poetry book in the library, you find verses that describe exactly how you feel.' : x.year < 2005 ? 'There is a quiet club that meets after school in Room 12. You walk past it every day.' : 'You find an online forum full of people your age who feel just like you.'),
    choices: [
      { label: 'Read every word', tags: ['cautious'], scene: 'reading', run: (x) => { x.mods({ loneliness: -5, confidence: 3, resilience: 3 }); return 'You are not the only one. You never were.'; } },
      { label: 'Find your people', tags: ['social'], scene: 'friends', when: (x) => x.year >= 1970, run: (x) => { const n = peer(x, 'friend', 55, 55); x.mods({ loneliness: -8, happiness: 5 }); return `${n.firstName} saved you a seat. Belonging feels like warm bread.`; } },
      { label: 'Keep it to yourself for now', run: (x) => { x.mods({ anxiety: x.w.socialNorms < 40 ? 3 : 1 }); return 'Not yet. Some things you hold close until the world is ready, or you are.'; } },
    ],
  },
  {
    id: 'sc_subculture', cat: 'teen', minAge: 13, maxAge: 17, once: true, years: [1950, 2300], scene: 'concert',
    title: 'Finding your tribe', text: (x) => `You have discovered ${x.year < 1965 ? 'rock and roll' : x.year < 1980 ? 'punk' : x.year < 1995 ? 'grunge' : x.year < 2010 ? 'emo' : x.year < 2040 ? 'hyperpop' : 'neuro-wave'}. It feels like it was made for you.`,
    choices: [
      { label: 'Change your whole look', tags: ['impulsive'], scene: 'shopping', run: (x) => { x.mods({ confidence: 4, creativity: 3 }); return 'Your parents have asked "is it a phase?" eleven times. It is a lifestyle.'; } },
      { label: 'Go to a show', tags: ['social'], run: (x) => { x.mods({ happiness: 6 }); x.train('music', 1); return 'Loud, sweaty, transcendent. You lost your voice and found yourself.'; } },
      { label: 'Keep it private', tags: ['cautious'], scene: 'music', run: (x) => { x.mods({ creativity: 2 }); return 'Headphones on, world off. It is yours alone.'; } },
    ],
  },
  {
    id: 'sc_bigArgument', cat: 'teen', minAge: 14, maxAge: 17, once: true, scene: 'argument',
    when: (x) => x.aliveParents().length > 0,
    title: 'Your future', text: 'Your parents have decided what you will be when you grow up. You have other plans.',
    choices: [
      { label: 'Stand your ground', tags: ['ambitious'], run: (x) => { x.mods({ confidence: 4, stress: 3 }); for (const p of x.rels('parent')) x.relMod(p.npcId, -4); return 'Doors were slammed. Years later, they admitted you were right.'; } },
      { label: 'Hear them out', tags: ['cautious'], scene: 'familyDinner', run: (x) => { x.mods({ wisdom: 3 }); for (const p of x.rels('parent')) x.relMod(p.npcId, 3); return 'They had reasons. So did you. You found something in between.'; } },
      { label: 'Agree, then do your own thing', tags: ['impulsive'], run: (x) => { x.train('deception', 2); return 'A tactical yes. Your real plans are in a notebook under the bed.'; } },
    ],
  },
  {
    id: 'sc_garageBand', cat: 'teen', minAge: 13, maxAge: 18, once: true, years: [1955, 2300], scene: 'music',
    title: 'The band', text: 'Your friends are starting a band. They need someone, anyone, to play something.',
    choices: [
      { label: 'Play guitar', tags: ['ambitious'], run: (x) => { x.train('music', 4); x.mods({ popularity: 3 }); return 'Three chords and the truth. Mostly three chords.'; } },
      { label: 'Sing', tags: ['impulsive'], scene: 'concert', run: (x) => { x.train('singing', 4); x.mods({ confidence: 4 }); return 'Your first gig was at a birthday party. Someone\'s gran threw a rose.'; } },
      { label: 'Be the manager', tags: ['social'], run: (x) => { x.train('marketing', 2); x.train('negotiation', 2); return 'You booked them a gig at the church fête. Payment: sandwiches.'; } },
    ],
  },
  {
    id: 'sc_diary', cat: 'teen', minAge: 12, maxAge: 17, once: true, scene: 'reading',
    bind: bindRel('sibling'),
    title: 'The diary', text: (x) => `You catch ${who(x)} reading your diary out loud to their friends.`,
    choices: [
      { label: 'Chase them', tags: ['violent'], scene: 'fight', run: (x) => { x.relMod(npcId(x), -6); x.mods({ fitness: 1, aggression: 2 }); return 'A chase through three rooms and a garden. The diary survived. Barely.'; } },
      { label: 'Read theirs back', tags: ['impulsive'], run: (x) => { x.relMod(npcId(x), -3); x.mods({ popularity: 1 }); return 'Mutually assured destruction. A tense peace followed.'; } },
      { label: 'Tell a parent', tags: ['cautious'], scene: 'family', run: (x) => { x.relMod(npcId(x), -2); return 'They were grounded. You bought a lock.'; } },
    ],
  },
  {
    id: 'sc_prom', cat: 'teen', minAge: 16, maxAge: 18, once: true, years: [1930, 2300], scene: 'dance',
    when: (x) => inSchool(x),
    title: (x) => (x.year < 1970 ? 'The senior formal' : 'Prom night'), text: 'The big end-of-school dance is in a week, and everyone is asking who you are going with.',
    choices: [
      { label: 'Go with your crush', tags: ['ambitious'], when: (x) => canCrush(x) && !!x.flag('sc_crushId') && !!x.npc(String(x.flag('sc_crushId'))), run: (x) => { const id = String(x.flag('sc_crushId')); x.relMod(id, 8, 6); x.mods({ happiness: 6 }); return `${x.first(id)} said yes. You held hands for the slow song and remember every second.`; } },
      { label: 'Go with a group of friends', tags: ['social'], scene: 'party', run: (x) => { x.mods({ happiness: 5, popularity: 3 }); return 'You arrived in a pack, danced like fools and ate chips at midnight.'; } },
      { label: 'Skip it', tags: ['cautious'], scene: 'gaming', run: (x) => { x.mods({ happiness: 1 }); return 'You stayed home with a film and pizza. No regrets. A few.'; } },
    ],
  },
  {
    id: 'sc_spot', cat: 'teen', minAge: 13, maxAge: 17, once: true, scene: 'sick',
    title: 'The spot', text: 'A spot the size of a small planet has appeared on your nose. On the morning of a big day.',
    choices: [
      { label: 'Leave it alone', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 1 }); return 'Nobody noticed. Everyone is too busy with their own spots.'; } },
      { label: 'Attack it', tags: ['impulsive'], run: (x) => { x.mods({ looks: -1 }); return 'You made it much worse. Lesson learned. Again.'; } },
      { label: 'Own it', tags: ['social'], run: (x) => { x.mods({ confidence: 3 }); return 'You named it Gerald and introduced it to everyone. Gerald was popular.'; } },
    ],
  },
  {
    id: 'sc_growthSpurt', cat: 'teen', minAge: 12, maxAge: 16, once: true, scene: 'sports',
    title: 'Growth spurt', text: 'You grew ten centimetres over the summer. Nothing fits, and you keep hitting your head.',
    auto: (x) => { x.mods({ fitness: 2, looks: 2, dexterity: -2 }); return 'Your trousers are now three-quarter length. Your coordination will catch up eventually.'; },
  },
  {
    id: 'sc_summerCamp', cat: 'teen', minAge: 10, maxAge: 16, once: true, years: [1900, 2300], scene: 'camping',
    when: (x) => !poor(x),
    title: 'Summer camp', text: 'Two weeks in the woods with canoes, campfire songs and a counsellor who takes it all very seriously.',
    choices: [
      { label: 'Win the canoe race', tags: ['ambitious'], scene: 'sports', run: (x) => { x.mods({ fitness: 3, confidence: 3 }); x.train('sailing', 2); return 'Your cabin carried you on their shoulders. A golden afternoon.'; } },
      { label: 'Make lifelong friends', tags: ['social'], scene: 'friends', run: (x) => { const n = peer(x, 'friend', 60, 50); x.mods({ happiness: 5, loneliness: -4 }); return `You and ${n.firstName} cried at the bus. You still send each other postcards.`; } },
      { label: 'Learn the wilderness', tags: ['cautious'], scene: 'hiking', run: (x) => { x.train('herbalism', 2); x.mods({ wisdom: 2 }); return 'You can now light a fire, tie six knots and identify edible berries.'; } },
    ],
  },
  {
    id: 'sc_dare', cat: 'teen', minAge: 13, maxAge: 17, once: true, scene: 'shopping',
    title: 'The dare', text: 'Your friends dare you to pocket something from the corner shop.',
    choices: [
      { label: 'Refuse', tags: ['cautious'], run: (x) => { x.mods({ willpower: 3, karma: 2 }); return 'They called you a coward for a day. You did not care for long.'; } },
      { label: 'Do it', tags: ['impulsive'], scene: 'police', run: (x) => { x.train('shoplifting', 2); x.mods({ karma: -3, riskTolerance: 3 }); if (x.chance(0.35)) { x.mods({ popularity: -2 }); return 'The shopkeeper grabbed your collar and phoned your parents. Mortifying.'; } x.mods({ streetCred: 2 }); return 'A chocolate bar you did not even want. It tasted of guilt.'; } },
      { label: 'Buy it and pretend', tags: ['social'], run: (x) => { x.money(-1); x.train('deception', 2); return 'You paid quietly and emerged a "legend". Your secret is safe.'; } },
    ],
  },
  {
    id: 'sc_meteorShower', cat: 'teen', minAge: 12, maxAge: 17, once: true, scene: 'meteor',
    title: 'Sneaking out', text: 'There is a meteor shower tonight. Your friends are meeting on the hill at midnight.',
    choices: [
      { label: 'Sneak out', tags: ['impulsive'], scene: 'friends', run: (x) => { x.mods({ happiness: 6, riskTolerance: 2 }); x.train('astronomy', 1); return 'Forty shooting stars. You made a wish on every one.'; } },
      { label: 'Ask permission', tags: ['cautious'], scene: 'family', run: (x) => { x.mods({ happiness: 4 }); return 'Your father said yes, then came along with a flask of cocoa. Embarrassing and lovely.'; } },
      { label: 'Watch from your window', run: (x) => { x.mods({ creativity: 2 }); return 'You saw three. That was enough to feel very small and very lucky.'; } },
    ],
  },
  {
    id: 'sc_volunteerTeen', cat: 'teen', minAge: 13, maxAge: 18, once: true, scene: 'volunteer',
    title: 'Volunteering', text: 'Your school wants every student to volunteer for twenty hours this year.',
    choices: [
      { label: 'Help at the animal shelter', tags: ['help'], scene: 'pet', run: (x) => { x.mods({ empathy: 4, happiness: 3 }); return 'You walked forty dogs and cried over every adoption.'; } },
      { label: 'Read to the elderly', tags: ['social'], scene: 'nursingHome', run: (x) => { x.mods({ empathy: 3, wisdom: 3 }); return 'Mrs Albright corrected your pronunciation and told you about the war.'; } },
      { label: 'Do the bare minimum', tags: ['cautious'], run: (x) => { x.mods({ karma: -1 }); return 'Twenty hours of folding leaflets very slowly.'; } },
    ],
  },
  {
    id: 'sc_bffFight', cat: 'teen', minAge: 12, maxAge: 18, once: true, scene: 'argument',
    bind: bindRel('bestFriend'),
    title: 'Falling out', text: (x) => `You and ${who(x)} have had a huge fight over something that seemed enormous at the time.`,
    choices: [
      { label: 'Apologise first', tags: ['help'], scene: 'makeup', run: (x) => { x.relMod(npcId(x), 8, 6); x.mods({ wisdom: 2 }); return 'They were about to apologise too. You both laughed until you cried.'; } },
      { label: 'Wait for them', tags: ['cautious'], run: (x) => { x.relMod(npcId(x), -3); x.mods({ loneliness: 3 }); return 'Two weeks of silence, then a note slipped into your locker. Repaired.'; } },
      { label: 'Make new friends', tags: ['impulsive'], scene: 'friends', run: (x) => { x.relMod(npcId(x), -10); peer(x, 'friend', 45, 35); return 'You moved on. Some days you wonder if you should not have.'; } },
    ],
  },
  {
    id: 'sc_careersDay', cat: 'school', minAge: 14, maxAge: 17, once: true, years: [1920, 2300], scene: 'interview',
    when: (x) => inSchool(x),
    title: 'Careers day', text: 'A careers adviser asks what you want to do with your life. You have eight minutes to decide.',
    choices: [
      { label: 'Something with people', tags: ['social'], run: (x) => { x.mods({ empathy: 2 }); return 'The computer suggested "funeral director". You are reconsidering.'; } },
      { label: 'Something that pays', tags: ['ambitious'], run: (x) => { x.train('economics', 1); return 'They gave you a leaflet about accountancy. It was very thin.'; } },
      { label: 'Something creative', tags: ['impulsive'], run: (x) => { x.mods({ creativity: 2 }); return '"Have you considered a back-up plan?" You have not.'; } },
    ],
  },
];

const finishingSecondary = (x: Ctx) => prog(x) === 'secondary' && (x.c.education.enrolled?.yearsLeft ?? 9) <= 2;

const HIGHER_ED: EventDef[] = [
  // ================================================================== leaving school
  {
    id: 'sc_collegeApps', cat: 'school', minAge: 16, maxAge: 19, once: true, weight: 2, years: [1900, 2300], scene: 'interview',
    when: (x) => finishingSecondary(x),
    title: 'Applications', text: 'Application forms cover your desk. Each one asks you to describe yourself in five hundred words.',
    choices: [
      { label: 'Aim for the dream school', tags: ['ambitious'], run: (x) => { x.setFlag('sc_applied', 'dream'); x.mods({ stress: 5 }); x.train('writing', 2); return 'You rewrote your essay nine times. The final one made your mother cry.'; } },
      { label: 'Apply somewhere safe', tags: ['cautious'], run: (x) => { x.setFlag('sc_applied', 'safe'); x.mods({ stress: 1 }); return 'Sensible choices, sensibly submitted. Now you wait.'; } },
      { label: 'Ask a teacher for help', tags: ['social', 'help'], run: (x) => { x.setFlag('sc_applied', 'dream'); x.train('writing', 3); x.mods({ stress: 2 }); return 'Your teacher crossed out every adjective. The essay is now excellent.'; } },
      { label: 'Do not apply', run: (x) => { x.mods({ stress: -3 }); return 'You will find your own path, whatever the forms say.'; } },
    ],
  },
  {
    id: 'sc_acceptance', cat: 'school', minAge: 16, maxAge: 20, once: true, weight: 4, scene: 'reading',
    when: (x) => !!x.flag('sc_applied'),
    title: 'The envelope', text: (x) => (x.year < 2000 ? 'A thick envelope with a university crest lies on the doormat.' : 'An email lands with the subject line "Your admission decision".'),
    choices: [
      { label: 'Open it alone', tags: ['cautious'], run: (x) => { const ok = x.flag('sc_applied') === 'safe' || check(x, x.c.education.grades, 65); x.setFlag('sc_accepted', ok); x.mods(ok ? { happiness: 8, confidence: 5 } : { happiness: -5, resilience: 3 }); return ok ? 'Accepted. You read it four times to be sure.' : '"We regret to inform you." You sat with it a long while.'; } },
      { label: 'Open it with family', tags: ['social'], scene: 'family', run: (x) => { const ok = x.flag('sc_applied') === 'safe' || check(x, x.c.education.grades, 65); x.setFlag('sc_accepted', ok); x.mods(ok ? { happiness: 10 } : { happiness: -3 }); return ok ? 'The kitchen erupted. Someone spilled the tea. Nobody cared.' : 'A rejection, softened by three hugs and a cake that was meant to celebrate.'; } },
      { label: 'Let a friend open it', tags: ['impulsive'], scene: 'friends', run: (x) => { const ok = x.flag('sc_applied') === 'safe' || check(x, x.c.education.grades, 65); x.setFlag('sc_accepted', ok); x.mods(ok ? { happiness: 8 } : { happiness: -4 }); return ok ? 'They screamed before you did. It was a good scream.' : 'They read it silently and hugged you. You knew.'; } },
    ],
  },
  {
    id: 'sc_graduation', cat: 'school', minAge: 16, maxAge: 19, once: true, weight: 3, scene: 'graduation',
    when: (x) => prog(x) === 'secondary' && (x.c.education.enrolled?.yearsLeft ?? 9) <= 1,
    title: 'Graduation day', text: 'Caps, gowns, folding chairs and a head teacher who will not stop talking. School is over.',
    choices: [
      { label: 'Give the speech', tags: ['ambitious'], when: (x) => x.c.education.grades >= 80, scene: 'stage', run: (x) => { x.train('publicSpeaking', 4); x.mods({ confidence: 6, popularity: 3 }); x.remember('valedictorian', 'Gave the graduation speech', 35); return 'You quoted a poet and made a joke about the canteen. Standing ovation.'; } },
      { label: 'Throw your cap highest', tags: ['impulsive'], run: (x) => { x.mods({ happiness: 6 }); return 'It never came down. Probably still up there.'; } },
      { label: 'Find your family', tags: ['social'], scene: 'family', run: (x) => { x.mods({ happiness: 5 }); for (const p of x.rels('parent')) x.relMod(p.npcId, 4); return 'Your parents held you a beat longer than usual.'; } },
      { label: 'Thank your teachers', tags: ['help'], scene: 'classroom', run: (x) => { x.mods({ empathy: 3, karma: 2 }); return 'One of them teared up. You were never the easy one.'; } },
    ],
  },
  {
    id: 'sc_gapYear', cat: 'youngAdult', minAge: 17, maxAge: 20, once: true, years: [1960, 2300], scene: 'travel',
    when: (x) => x.c.education.completed.includes('secondary') && !x.c.education.enrolled,
    title: 'Gap year?', text: 'Everyone else is rushing into the next thing. You could take a year to see the world first.',
    choices: [
      { label: 'Backpack across continents', tags: ['impulsive'], run: (x) => { if (!x.spend(era$(x, 3000))) return 'You could not afford it. You backpacked across your county instead.'; x.train('languages', 3); x.mods({ wisdom: 4, happiness: 6 }); return 'You came home thinner, wiser and with a tattoo you will explain one day.'; } },
      { label: 'Work and save', tags: ['cautious'], scene: 'office', run: (x) => { x.money(era$(x, 5000)); x.mods({ discipline: 3 }); return 'A year of shifts and a healthy savings account.'; } },
      { label: 'Volunteer abroad', tags: ['help'], scene: 'volunteer', run: (x) => { x.mods({ empathy: 5, karma: 3 }); x.train('languages', 2); return 'You built a schoolhouse and learned how little you knew.'; } },
    ],
  },
  // ================================================================== higher education
  {
    id: 'sc_roommate', cat: 'youngAdult', minAge: 17, maxAge: 25, once: true, scene: 'friends',
    when: (x) => inHigher(x) && prog(x) !== 'online',
    title: 'The roommate', text: 'Your new roommate has brought a lizard, a drum kit and no sense of time.',
    choices: [
      { label: 'Embrace the chaos', tags: ['social'], run: (x) => { const n = peer(x, 'bestFriend', 60, 50); x.mods({ happiness: 4, stress: 2 }); return `${n.firstName} became your best friend. The lizard became the dorm mascot.`; } },
      { label: 'Draw up house rules', tags: ['cautious'], run: (x) => { const n = peer(x, 'friend', 40, 40); x.train('negotiation', 2); return `${n.firstName} signed the contract. Drumming is now limited to Tuesdays.`; } },
      { label: 'Request a transfer', tags: ['impulsive'], run: (x) => { x.mods({ loneliness: 2 }); return 'Your new roommate is silent and tidy. You miss the lizard.'; } },
    ],
  },
  {
    id: 'sc_freshersFair', cat: 'youngAdult', minAge: 17, maxAge: 23, once: true, scene: 'festival',
    when: (x) => inHigher(x),
    title: 'Clubs fair', text: 'A hall full of stalls: rowing, chess, debating, juggling, a society devoted to cheese.',
    choices: [
      { label: 'Sign up for everything', tags: ['impulsive'], run: (x) => { x.mods({ popularity: 3, energy: -5 }); return 'Twenty-three mailing lists. You attended two meetings, both for cheese.'; } },
      { label: 'Join the debating society', tags: ['ambitious'], scene: 'stage', run: (x) => { x.train('oratory', 3); x.train('persuasion', 2); return 'Your first debate was a disaster. Your fifth was a triumph.'; } },
      { label: 'Join a sports club', tags: ['social'], scene: 'sports', run: (x) => { const n = peer(x, 'friend', 50, 40); x.mods({ fitness: 3 }); return `You found a team, a routine and ${n.firstName}, who lends you socks.`; } },
    ],
  },
  {
    id: 'sc_homesick', cat: 'youngAdult', minAge: 17, maxAge: 22, once: true, scene: 'lonely',
    when: (x) => inHigher(x) && prog(x) !== 'online',
    title: 'Homesick', text: 'It is the third week. Everyone else seems to have found friends. You miss your own bed.',
    choices: [
      { label: 'Call home', tags: ['cautious'], scene: 'family', run: (x) => { x.mods({ loneliness: -3, happiness: 2 }); return 'Your mother put the dog on. It helped more than you will admit.'; } },
      { label: 'Knock on a neighbour\'s door', tags: ['social'], scene: 'friends', run: (x) => { const n = peer(x, 'friend', 50, 40); x.mods({ loneliness: -6, confidence: 2 }); return `${n.firstName} had been hoping someone would knock. Tea until two in the morning.`; } },
      { label: 'Throw yourself into work', tags: ['ambitious'], scene: 'library', run: (x) => { gr(x, 3); x.mods({ loneliness: 2 }); return 'Top marks and a library card worn to the edges.'; } },
    ],
  },
  {
    id: 'sc_major', cat: 'youngAdult', minAge: 17, maxAge: 24, once: true, scene: 'library',
    when: (x) => inUni(x),
    title: 'Choosing a major', text: 'You must declare a subject. Your parents have opinions; so does your heart.',
    choices: [
      { label: 'Follow your passion', tags: ['impulsive'], run: (x) => { x.mods({ happiness: 5, creativity: 3 }); x.train('philosophy', 2); return 'Ancient poetry. Your father asked what the job is. You are still working on that.'; } },
      { label: 'Pick the practical one', tags: ['cautious'], scene: 'office', run: (x) => { x.train('economics', 3); x.mods({ discipline: 2 }); return 'Accounting. Solid, sensible, and your heart sighs only occasionally.'; } },
      { label: 'Double major', tags: ['ambitious'], scene: 'study', run: (x) => { x.train('science', 2); x.train('writing', 2); x.mods({ stress: 6 }); return 'Two subjects, no sleep, enormous pride.'; } },
    ],
  },
  {
    id: 'sc_allNighter', cat: 'youngAdult', minAge: 17, maxAge: 30, cooldown: 2, scene: 'study',
    when: (x) => inHigher(x),
    title: 'The all-nighter', text: (x) => `An essay is due at nine. It is midnight. You have ${x.year < 1950 ? 'a candle, a pot of tea' : x.year < 2000 ? 'a typewriter, three coffees' : 'a laptop, three energy drinks'} and a title.`,
    choices: [
      { label: 'Write through the night', tags: ['ambitious'], run: (x) => { x.mods({ energy: -12, stress: 4 }); gr(x, 3); x.train('writing', 2); return 'Handed in at 8:59. Your best work, apparently.'; } },
      { label: 'Ask for an extension', tags: ['cautious'], run: (x) => { x.train('persuasion', 1); return x.chance(0.6) ? 'Granted, with a weary look. You slept.' : 'Denied. You submitted half an essay and an apology.'; } },
      { label: 'Go to the party anyway', tags: ['impulsive'], scene: 'party', run: (x) => { x.mods({ happiness: 4 }); gr(x, -5); return 'Great night. Terrible grade. A classic trade.'; } },
    ],
  },
  {
    id: 'sc_finals', cat: 'youngAdult', minAge: 18, maxAge: 30, cooldown: 2, scene: 'exam',
    when: (x) => inHigher(x),
    title: 'Finals week', text: 'Finals week. The library is full of ghosts in hoodies, and you are one of them.',
    choices: [
      { label: 'Form a study group', tags: ['social'], scene: 'library', run: (x) => { x.train('teamwork', 2); gr(x, 4); return 'Four brains, one whiteboard, many snacks. Everyone passed.'; } },
      { label: 'Lock yourself away', tags: ['ambitious'], run: (x) => { gr(x, 6); x.mods({ stress: 6, loneliness: 2 }); return 'Top of the year. You have not seen the sun in nine days.'; } },
      { label: 'Pace yourself', tags: ['cautious'], scene: 'calm', run: (x) => { gr(x, 2); x.mods({ stress: -2 }); return 'Steady revision, eight hours of sleep, a respectable result.'; } },
    ],
  },
  {
    id: 'sc_thesis', cat: 'youngAdult', minAge: 20, maxAge: 35, once: true, scene: 'library',
    when: (x) => inUni(x) && (x.c.education.enrolled?.yearsLeft ?? 9) <= 1,
    title: 'The thesis', text: 'Your thesis is due in a month. It currently consists of a title and a crisis.',
    choices: [
      { label: 'Write a page a day', tags: ['cautious'], run: (x) => { gr(x, 4); x.mods({ discipline: 4 }); x.train('writing', 3); return 'Thirty pages, thirty days. It holds together beautifully.'; } },
      { label: 'Chase a bold idea', tags: ['ambitious'], scene: 'invention', run: (x) => { x.train('science', 3); if (check(x, x.stat('smarts') + x.stat('creativity') / 2, 75)) { gr(x, 8); x.mods({ professionalRep: 3 }); return 'Your examiner called it "genuinely original". You framed the comment.'; } gr(x, -2); return 'Ambitious and unfinished. You passed, just.'; } },
      { label: 'Lean on your supervisor', tags: ['social'], run: (x) => { const t = elder(x, 'mentor', 50, 50); gr(x, 3); return `${t.firstName} returned every draft covered in red ink. It got much better.`; } },
    ],
  },
  {
    id: 'sc_studyAbroad', cat: 'youngAdult', minAge: 18, maxAge: 25, once: true, years: [1950, 2300], scene: 'travel',
    when: (x) => inUni(x),
    title: 'Study abroad', text: 'There is one place left on the exchange programme for next term.',
    choices: [
      { label: 'Go', tags: ['impulsive'], run: (x) => { x.train('languages', 5); x.mods({ wisdom: 3, happiness: 5 }); peer(x, 'friend', 55, 45); return 'Six months of new food, new words and a homesickness for a place you just left.'; } },
      { label: 'Stay and focus', tags: ['cautious'], scene: 'library', run: (x) => { gr(x, 3); return 'You got ahead. You also wondered, sometimes, what you missed.'; } },
      { label: 'Give your place to a friend', tags: ['help'], run: (x) => { x.mods({ karma: 3, empathy: 2 }); return 'They sent you a postcard every week. You kept them all.'; } },
    ],
  },
  {
    id: 'sc_studentDebt', cat: 'youngAdult', minAge: 18, maxAge: 30, once: true, years: [1965, 2300], scene: 'moneyDown',
    when: (x) => inUni(x),
    title: 'The loan statement', text: (x) => `Your student loan statement arrived. It says ${x.fmt(era$(x, 24000))} and is still climbing.`,
    choices: [
      { label: 'Get a part-time job', tags: ['ambitious'], scene: 'restaurant', run: (x) => { x.money(era$(x, 3000)); x.mods({ energy: -6, stress: 3 }); return 'Lectures by day, pulling pints by night. You are very tired and slightly less broke.'; } },
      { label: 'Budget strictly', tags: ['cautious'], scene: 'cooking', run: (x) => { x.train('bookkeeping', 3); x.mods({ discipline: 3 }); return 'You now know forty ways to cook lentils.'; } },
      { label: 'Ignore it', tags: ['impulsive'], run: (x) => { x.c.debt += era$(x, 2000); x.mods({ stress: 2 }); return 'Future you can deal with it. Future you is furious.'; } },
    ],
  },
  {
    id: 'sc_campusProtest', cat: 'youngAdult', minAge: 17, maxAge: 28, once: true, years: [1900, 2300], scene: 'riot',
    when: (x) => inHigher(x),
    title: 'Campus protest', text: 'Students are occupying the main hall in protest. Banners hang from the windows.',
    choices: [
      { label: 'Join the occupation', tags: ['impulsive', 'social'], run: (x) => { x.mods({ politicalApproval: 2, confidence: 3 }); x.train('propaganda', 2); if (x.chance(0.25)) { x.mods({ heat: 2 }); return 'Three days, one sleeping bag and a brief, polite arrest.'; } return 'Three days of speeches and shared soup. The university agreed to talks.'; } },
      { label: 'Write about it', tags: ['ambitious'], scene: 'newsroom', run: (x) => { x.train('writing', 3); return 'Your article ran in the student paper and was quoted by a real one.'; } },
      { label: 'Keep studying', tags: ['cautious'], scene: 'library', run: (x) => { gr(x, 2); return 'History happened down the corridor while you revised.'; } },
    ],
  },
  {
    id: 'sc_secretSociety', cat: 'youngAdult', minAge: 18, maxAge: 25, once: true, scene: 'ritual',
    when: (x) => inUni(x) && (rich(x) || x.stat('popularity') > 55),
    title: 'A black envelope', text: 'A black envelope under your door: midnight, the old boathouse, tell no one.',
    choices: [
      { label: 'Attend', tags: ['ambitious'], run: (x) => { x.train('networking', 4); x.mods({ popularity: 3 }); x.secret('sc_society', 'Member of a secret university society', 2); return 'Candles, robes and a judge\'s son reciting Latin. You are in, for life.'; } },
      { label: 'Bring a friend', tags: ['social'], run: (x) => { x.mods({ riskTolerance: 2 }); return 'You were both turned away at the door. The friend still teases you.'; } },
      { label: 'Burn the envelope', tags: ['cautious'], run: (x) => { x.mods({ wisdom: 2 }); return 'Some doors are better left closed. You will never know.'; } },
    ],
  },
  {
    id: 'sc_professor', cat: 'youngAdult', minAge: 17, maxAge: 30, once: true, scene: 'meeting',
    when: (x) => inHigher(x),
    title: 'A harsh mark', text: 'A professor has failed your best essay with one comment: "No."',
    choices: [
      { label: 'Argue your case', tags: ['ambitious'], run: (x) => { x.train('persuasion', 3); if (check(x, x.stat('charisma') + x.stat('smarts') / 2, 65)) { gr(x, 5); return 'You walked them through it. They changed the mark and added: "Fine."'; } return 'They listened politely and said "No" again, in person.'; } },
      { label: 'Ask how to improve', tags: ['cautious'], run: (x) => { const t = elder(x, 'mentor', 45, 45); gr(x, 3); return `${t.firstName} spent an hour with you. Your next essay got a "Yes."`; } },
      { label: 'Complain to the dean', tags: ['impulsive'], scene: 'office', run: (x) => { x.mods({ ego: 2 }); return 'The dean was the professor\'s spouse. Bad move.'; } },
    ],
  },
  {
    id: 'sc_dormFire', cat: 'youngAdult', minAge: 17, maxAge: 25, once: true, years: [1950, 2300], scene: 'fire',
    when: (x) => inHigher(x) && prog(x) !== 'online',
    title: 'The 3am alarm', text: 'The fire alarm goes off at 3am. Someone tried to make toast in a kettle.',
    choices: [
      { label: 'Grab your laptop and run', tags: ['cautious'], run: (x) => { x.mods({ energy: -3 }); return 'You stood in the snow in pyjamas with your entire degree under your arm.'; } },
      { label: 'Wake the heavy sleepers', tags: ['help'], run: (x) => { x.mods({ karma: 2, popularity: 2 }); return 'You banged on every door. The building now calls you "Captain".'; } },
      { label: 'Ignore it', tags: ['impulsive'], run: (x) => { x.mods({ riskTolerance: 2 }); return 'It was nothing, this time. The warden gave you a long lecture.'; } },
    ],
  },
  {
    id: 'sc_lecture', cat: 'youngAdult', minAge: 17, maxAge: 28, once: true, scene: 'classroom',
    when: (x) => inHigher(x),
    title: 'Lecture hall', text: 'You fell asleep in a three-hundred-seat lecture and woke up as the professor asked you a question.',
    choices: [
      { label: 'Bluff confidently', tags: ['impulsive'], run: (x) => { x.train('deception', 2); return check(x, x.stat('charisma'), 55) ? 'You said "it depends on context" and the professor nodded. Magic.' : 'You answered a question from a different course. Laughter.'; } },
      { label: 'Admit you dozed', tags: ['cautious'], run: (x) => { x.mods({ popularity: 1 }); return '"Honest, at least." Even the professor smiled.'; } },
      { label: 'Ask them to repeat it', tags: ['social'], run: (x) => { x.mods({ wisdom: 1 }); return 'You bought three seconds and a whispered answer from the seat behind.'; } },
    ],
  },
  {
    id: 'sc_aiEssay', cat: 'youngAdult', minAge: 16, maxAge: 30, once: true, years: [2023, 2300], scene: 'hacker',
    when: (x) => inSchool(x) || inHigher(x),
    title: 'Let the machine write it?', text: 'An AI could write your essay in thirty seconds. The deadline is in three hours.',
    choices: [
      { label: 'Write it yourself', tags: ['cautious'], scene: 'study', run: (x) => { x.train('writing', 3); gr(x, 2); return 'Slower, clumsier and entirely yours.'; } },
      { label: 'Use it to brainstorm', tags: ['ambitious'], run: (x) => { x.train('aiDevelopment', 1); x.train('writing', 1); gr(x, 2); return 'It gave you ten ideas. Nine were bad. The tenth was a start.'; } },
      { label: 'Submit what it writes', tags: ['impulsive'], run: (x) => { x.mods({ karma: -2 }); if (x.chance(0.4)) { gr(x, -15); return 'It cited a book that does not exist. Academic misconduct hearing.'; } gr(x, 3); return 'A B-minus. Bland, but nobody noticed.'; } },
    ],
  },
  {
    id: 'sc_researchAssistant', cat: 'youngAdult', minAge: 18, maxAge: 30, once: true, years: [1880, 2300], scene: 'lab',
    when: (x) => inUni(x) && x.c.education.grades >= 60,
    title: 'Research assistant', text: 'A professor offers you a paid place in their lab for the summer.',
    choices: [
      { label: 'Accept eagerly', tags: ['ambitious'], run: (x) => { const t = elder(x, 'mentor', 55, 55); x.train('science', 4); x.money(era$(x, 2500)); return `${t.firstName} put your name on a paper. Third author, but still.`; } },
      { label: 'Negotiate the pay', tags: ['social'], run: (x) => { x.train('negotiation', 2); x.money(era$(x, 3200)); x.train('science', 2); return 'A little more money and a little less warmth. Fair.'; } },
      { label: 'Take the summer off', tags: ['cautious'], scene: 'beach', run: (x) => { x.mods({ happiness: 4, stress: -4 }); return 'Sun, sleep and a book a week. Sometimes rest is the right answer.'; } },
    ],
  },
  {
    id: 'sc_rowing', cat: 'youngAdult', minAge: 17, maxAge: 25, once: true, years: [1820, 2300], scene: 'sports',
    when: (x) => inUni(x),
    title: 'Dawn on the river', text: 'The rowing coach wants you on the river at five every morning.',
    choices: [
      { label: 'Commit to the crew', tags: ['ambitious'], run: (x) => { x.mods({ fitness: 5, discipline: 4, energy: -4 }); x.train('teamwork', 3); return 'Mist on the water and eight oars in perfect time. You were made for this.'; } },
      { label: 'Cox instead', tags: ['social'], run: (x) => { x.train('leadership', 3); return 'You shout, they row. It is the best job on the boat.'; } },
      { label: 'Stay in bed', tags: ['cautious'], run: (x) => { x.mods({ energy: 3 }); return 'The coach still glares at you in the dining hall.'; } },
    ],
  },
  {
    id: 'sc_unionPresident', cat: 'youngAdult', minAge: 18, maxAge: 26, once: true, years: [1900, 2300], scene: 'election',
    when: (x) => inUni(x),
    title: 'Union president', text: 'Friends want you to run for student union president. The incumbent is a smug future politician.',
    choices: [
      { label: 'Run', tags: ['ambitious'], run: (x) => { x.train('leadership', 3); x.train('publicSpeaking', 2); if (x.chance(0.4 + x.stat('charisma') / 250)) { x.mods({ popularity: 6, politicalApproval: 3 }); x.remember('unionPresident', 'Elected student union president', 30); return 'You won by forty votes. Your first act: a better coffee machine.'; } return 'You lost, gracefully. The future politician remembered you.'; } },
      { label: 'Run a joke candidate', tags: ['impulsive'], run: (x) => { x.mods({ popularity: 5 }); x.train('comedy', 2); return 'Your candidate, a goose, came second. Democracy.'; } },
      { label: 'Stay out of it', tags: ['cautious'], run: () => 'Student politics is still politics. You chose peace.' },
    ],
  },
  {
    id: 'sc_scholarship', cat: 'youngAdult', minAge: 17, maxAge: 26, once: true, scene: 'moneyUp',
    when: (x) => inHigher(x) && x.c.education.grades >= 75,
    title: 'Scholarship', text: 'Your grades caught someone\'s eye. A scholarship committee wants to meet you.',
    choices: [
      { label: 'Prepare thoroughly', tags: ['cautious'], scene: 'interview', run: (x) => { x.money(era$(x, 6000)); x.mods({ confidence: 4 }); return 'They gave you the full award. You called home from a payphone in tears.'; } },
      { label: 'Be yourself', tags: ['social'], scene: 'interview', run: (x) => { const ok = x.chance(0.6); if (ok) x.money(era$(x, 6000)); return ok ? 'They loved your story about the goose. Awarded.' : 'They chose someone more polished. Next year.'; } },
      { label: 'Recommend a poorer friend', tags: ['help'], run: (x) => { x.mods({ karma: 4, empathy: 3 }); return 'They got it instead. They have never forgotten.'; } },
    ],
  },
  {
    id: 'sc_dropOutStartup', cat: 'youngAdult', minAge: 18, maxAge: 26, once: true, years: [1975, 2300], scene: 'startup',
    when: (x) => inHigher(x),
    title: 'Drop out?', text: 'A classmate has a brilliant idea and wants you to quit university to build it in a garage.',
    choices: [
      { label: 'Drop out', tags: ['impulsive', 'ambitious'], run: (x) => { const t = dropOut(x); x.train('entrepreneurship', 4); peer(x, 'businessPartner', 55, 50); x.mods({ riskTolerance: 4 }); return `${t} The garage smells of solder and hope.`; } },
      { label: 'Help on weekends', tags: ['cautious'], run: (x) => { x.train('entrepreneurship', 2); x.mods({ energy: -4 }); return 'You kept your studies and a small stake in the idea. Hedged.'; } },
      { label: 'Wish them luck', tags: ['social'], run: (x) => { x.mods({ wisdom: 1 }); return 'Years later you will check their company\'s valuation, often.'; } },
    ],
  },
  {
    id: 'sc_uniGraduation', cat: 'youngAdult', minAge: 20, maxAge: 40, once: true, weight: 3, scene: 'graduation',
    when: (x) => inUni(x) && (x.c.education.enrolled?.yearsLeft ?? 9) <= 1,
    title: 'Commencement', text: 'Your name is read out, slightly mispronounced. You cross the stage in a gown that does not fit.',
    choices: [
      { label: 'Shake hands with style', tags: ['social'], run: (x) => { x.mods({ happiness: 6, confidence: 3 }); return 'A firm grip, a perfect photo, and you only tripped on the way down.'; } },
      { label: 'Wave to your family', tags: ['help'], scene: 'family', run: (x) => { x.mods({ happiness: 6 }); for (const p of x.rels('parent')) x.relMod(p.npcId, 4); return 'Your family made a banner. It was embarrassingly large.'; } },
      { label: 'Worry about jobs', tags: ['cautious'], scene: 'interview', run: (x) => { x.mods({ stress: 3, discipline: 2 }); return 'You were already updating your CV during the speeches.'; } },
    ],
  },
  {
    id: 'sc_conference', cat: 'youngAdult', minAge: 21, maxAge: 40, once: true, years: [1850, 2300], scene: 'stage',
    when: (x) => prog(x) === 'phd',
    title: 'Your first conference', text: 'You are presenting your research to a room of experts. One of them wrote your textbook.',
    choices: [
      { label: 'Present boldly', tags: ['ambitious'], run: (x) => { x.train('publicSpeaking', 3); x.mods({ professionalRep: 3, confidence: 3 }); return 'The textbook author asked a question. You had an answer. Ascension.'; } },
      { label: 'Read from your notes', tags: ['cautious'], run: (x) => { x.train('publicSpeaking', 1); return 'Monotone but accurate. Two people took notes, one dozed.'; } },
      { label: 'Network at the coffee break', tags: ['social'], scene: 'meeting', run: (x) => { x.train('networking', 4); return 'You left with eleven business cards and a job lead.'; } },
    ],
  },
  {
    id: 'sc_cadaver', cat: 'youngAdult', minAge: 20, maxAge: 40, once: true, scene: 'surgery',
    when: (x) => prog(x) === 'medical',
    title: 'Anatomy lab', text: 'Your first day in the anatomy lab. A donor has given their body so you can learn.',
    choices: [
      { label: 'Thank the donor silently', tags: ['help'], run: (x) => { x.mods({ empathy: 4, wisdom: 3 }); x.train('medicine', 3); return 'You never forgot that gift. It made you a gentler doctor.'; } },
      { label: 'Focus on the work', tags: ['ambitious'], run: (x) => { x.train('surgery', 3); x.train('biology', 2); return 'Steady hands, sharp eyes. The instructor took note.'; } },
      { label: 'Step outside a moment', tags: ['cautious'], scene: 'calm', run: (x) => { x.mods({ anxiety: 2 }); x.train('medicine', 1); return 'Fresh air, then back in. Half the class did the same.'; } },
    ],
  },
  {
    id: 'sc_mootCourt', cat: 'youngAdult', minAge: 20, maxAge: 40, once: true, scene: 'court',
    when: (x) => prog(x) === 'law',
    title: 'Moot court', text: 'A mock trial in front of real judges. Your opponent is the best in the year.',
    choices: [
      { label: 'Argue aggressively', tags: ['violent'], run: (x) => { x.train('law', 3); x.train('intimidation', 2); return check(x, x.stat('charisma'), 60) ? 'You won. The judges called you "relentless". It was a compliment.' : 'You lost and were told to "lower your voice, counsel".'; } },
      { label: 'Know the case cold', tags: ['cautious'], run: (x) => { x.train('law', 4); x.train('criminalLaw', 2); return 'You cited a precedent nobody else had found. Victory.'; } },
      { label: 'Charm the bench', tags: ['social'], run: (x) => { x.train('persuasion', 3); return 'The judges laughed at your opening. Laughter is half the battle.'; } },
    ],
  },
  {
    id: 'sc_seminaryDoubt', cat: 'youngAdult', minAge: 17, maxAge: 40, once: true, scene: 'holy',
    when: (x) => prog(x) === 'seminary' || prog(x) === 'monastery',
    title: 'A night of doubt', text: 'Alone in the chapel at night, you are no longer sure of the things you came here to learn.',
    choices: [
      { label: 'Pray through it', tags: ['cautious'], run: (x) => { x.mods({ faith: 5, resilience: 3 }); x.train('prayer', 3); return 'By dawn the doubt had not gone, but it had become a companion.'; } },
      { label: 'Talk to your elder', tags: ['social'], run: (x) => { const t = elder(x, 'mentor', 55, 55); x.mods({ wisdom: 4 }); return `${t.firstName} smiled. "Faith without doubt is just habit."`; } },
      { label: 'Read the heretics', tags: ['impulsive'], scene: 'library', run: (x) => { x.train('philosophy', 3); x.mods({ faith: -3, smarts: 2 }); return 'Dangerous books, brilliantly argued. Your teachers would be horrified.'; } },
    ],
  },
  {
    id: 'sc_drill', cat: 'youngAdult', minAge: 17, maxAge: 25, once: true, scene: 'gym',
    when: (x) => prog(x) === 'militaryAcademy',
    title: 'Drill sergeant', text: 'The drill sergeant is nose-to-nose with you, shouting about your boots.',
    choices: [
      { label: 'Stand rigid', tags: ['cautious'], run: (x) => { x.mods({ discipline: 5, willpower: 3 }); return 'You did not blink. The sergeant moved on, disappointed.'; } },
      { label: 'Polish them all night', tags: ['ambitious'], run: (x) => { x.mods({ discipline: 3, energy: -4 }); return 'Mirror-bright. The sergeant found a speck anyway.'; } },
      { label: 'Crack a smile', tags: ['impulsive'], run: (x) => { x.mods({ fitness: 3 }); return 'Fifty press-ups in the rain. Worth it, nearly.'; } },
    ],
  },
  {
    id: 'sc_onlineCourse', cat: 'youngAdult', minAge: 16, maxAge: 60, once: true, scene: 'internet',
    when: (x) => prog(x) === 'online',
    title: 'Lecture in pyjamas', text: 'Your online lecture is playing. So is a video of a cat in a box, in the next tab.',
    choices: [
      { label: 'Close the tab', tags: ['cautious'], run: (x) => { gr(x, 3); x.mods({ discipline: 3 }); return 'You took real notes. The cat will still be in the box tomorrow.'; } },
      { label: 'Watch at double speed later', tags: ['impulsive'], scene: 'gaming', run: (x) => { gr(x, -1); return 'The professor sounds like a chipmunk. You remember almost none of it.'; } },
      { label: 'Join the class forum', tags: ['social'], run: (x) => { peer(x, 'friend', 45, 40); gr(x, 2); return 'Classmates from six countries. One of them explains it better than the lecturer.'; } },
    ],
  },
];

const TRADES: { id: string; name: string; skill: string }[] = [
  { id: 'smith', name: 'blacksmith', skill: 'blacksmithing' },
  { id: 'baker', name: 'baker', skill: 'baking' },
  { id: 'carpenter', name: 'carpenter', skill: 'carpentry' },
  { id: 'mason', name: 'stonemason', skill: 'masonry' },
  { id: 'tailor', name: 'tailor', skill: 'tailoring' },
  { id: 'brewer', name: 'brewer', skill: 'brewing' },
];
const trade = (x: Ctx) => TRADES.find((t) => t.id === x.p.trade) ?? TRADES[0];

const PREMODERN: EventDef[] = [
  // ================================================================== ancient learning
  {
    id: 'sc_ludus', cat: 'school', minAge: 6, maxAge: 11, once: true, years: [-800, 500], scene: 'classroom',
    title: 'The ludus', text: (x) => `${fmtYear(x.year)}. Under an awning by the forum, the magister scratches letters into a wax tablet and eyes his rod.`,
    choices: [
      { label: 'Copy every letter', tags: ['cautious'], run: (x) => { x.train('literacy', 4); x.mods({ discipline: 3 }); return 'Your stylus marched neatly across the wax. The magister grunted, which is praise.'; } },
      { label: 'Watch the street instead', tags: ['impulsive'], scene: 'parade', run: (x) => { x.mods({ creativity: 2 }); x.train('streetwise', 1); return 'A chariot, a goat and a senator\'s litter. Better than letters.'; } },
      { label: 'Help the slow boy beside you', tags: ['help'], run: (x) => { x.train('literacy', 2); x.mods({ empathy: 3 }); return 'You both got the letters right. The magister pretended not to notice.'; } },
    ],
  },
  {
    id: 'sc_rhetor', cat: 'school', minAge: 12, maxAge: 18, once: true, years: [-300, 500], scene: 'stage',
    when: (x) => !poor(x),
    title: 'School of rhetoric', text: 'The rhetor sets you a declamation: argue for a father who disinherited his son, then against him.',
    choices: [
      { label: 'Declaim with passion', tags: ['ambitious'], run: (x) => { x.train('oratory', 5); x.train('persuasion', 2); return 'Your classmates stamped their feet. The rhetor said you might one day plead in the Senate house.'; } },
      { label: 'Memorise the masters', tags: ['cautious'], scene: 'reading', run: (x) => { x.train('literacy', 3); x.train('history', 3); return 'You can recite whole speeches of the great orators. Useful at dinner, insufferable at home.'; } },
      { label: 'Argue both sides at once', tags: ['impulsive'], run: (x) => { x.train('philosophy', 3); x.mods({ creativity: 3 }); return 'The rhetor called it sophistry. He also gave you the prize.'; } },
    ],
  },
  {
    id: 'sc_greekTutor', cat: 'school', minAge: 7, maxAge: 15, once: true, years: [-500, 500], scene: 'reading',
    when: (x) => rich(x),
    title: 'The Greek tutor', text: 'Your family has bought the services of a learned Greek tutor. He sighs at your accent.',
    choices: [
      { label: 'Learn Homer by heart', tags: ['ambitious'], run: (x) => { const t = elder(x, 'mentor', 50, 50); x.train('languages', 4); x.train('poetry', 2); return `${t.firstName} wept at your recitation of the death of Hector. Progress.`; } },
      { label: 'Ask about the stars', tags: ['social'], scene: 'eclipse', run: (x) => { elder(x, 'mentor', 55, 50); x.train('astronomy', 3); x.mods({ wisdom: 2 }); return 'He forgot the grammar lesson and spoke of the heavens until dark.'; } },
      { label: 'Run off to the races', tags: ['impulsive'], scene: 'sports', run: (x) => { x.mods({ happiness: 3, discipline: -2 }); return 'The Greens won. Your father was told. You were not allowed out for a month.'; } },
    ],
  },
  {
    id: 'sc_palaestra', cat: 'school', minAge: 12, maxAge: 18, once: true, years: [-800, 400], scene: 'sports',
    title: 'The palaestra', text: 'Oiled, dusty and sore, you face a bigger youth in the wrestling ground.',
    choices: [
      { label: 'Grapple bravely', tags: ['violent'], run: (x) => { x.train('wrestling', 4); x.mods({ fitness: 3 }); return x.chance(0.45) ? 'You threw him in the dust. The trainer nodded slowly.' : 'You ate a lot of sand, with dignity.'; } },
      { label: 'Study his feet', tags: ['cautious'], run: (x) => { x.train('wrestling', 2); x.train('logic', 1); return 'You noticed he always stepped left. Next time, he will not see it coming.'; } },
      { label: 'Run the stadion instead', tags: ['ambitious'], run: (x) => { x.train('running', 4); x.mods({ fitness: 3 }); return 'Swift as Hermes, said the trainer. Mostly he meant it.'; } },
    ],
  },
  {
    id: 'sc_scribeSchool', cat: 'school', minAge: 8, maxAge: 15, once: true, years: [-800, -100], scene: 'library',
    title: 'Scribal school', text: 'The master scribe gives you a tablet to copy. One wrong mark and you start again.',
    choices: [
      { label: 'Copy it perfectly', tags: ['cautious'], run: (x) => { x.train('literacy', 4); x.train('bookkeeping', 2); return 'Perfect. Your hand is steady and your future is secure: someone must count the grain.'; } },
      { label: 'Add a little flourish', tags: ['impulsive'], scene: 'painting', run: (x) => { x.train('art', 2); x.mods({ creativity: 3 }); return 'The master frowned, then kept your tablet.'; } },
      { label: 'Ask what the words mean', tags: ['ambitious'], run: (x) => { x.train('history', 3); x.mods({ smarts: 2 }); return 'An old king\'s boasting. You found it very funny.'; } },
    ],
  },
  // ================================================================== medieval learning
  {
    id: 'sc_monasterySchool', cat: 'school', minAge: 7, maxAge: 14, once: true, years: [500, 1500], scene: 'holy',
    when: (x) => !rich(x) || x.chance(0.5),
    title: 'The monastery school', text: 'Your family sends you to the brothers to learn Latin, psalms and silence.',
    choices: [
      { label: 'Learn the psalms', tags: ['cautious'], run: (x) => { x.train('scripture', 4); x.train('literacy', 3); x.mods({ faith: 3 }); return 'Your voice rose with the brothers at matins. It felt like belonging.'; } },
      { label: 'Sneak into the library', tags: ['ambitious'], scene: 'library', run: (x) => { x.train('literacy', 4); x.mods({ smarts: 3 }); return 'You found a book of herbs and a book of monsters. You read both twice.'; } },
      { label: 'Steal apples from the orchard', tags: ['impulsive'], scene: 'gardening', run: (x) => { x.mods({ sin: 1, happiness: 2 }); return 'Brother Anselm caught you and made you weed it for a week. He shared the apples, though.'; } },
    ],
  },
  {
    id: 'sc_illuminate', cat: 'school', minAge: 10, maxAge: 18, once: true, years: [600, 1500], scene: 'painting',
    when: (x) => prog(x) === 'monastery' || x.hasMemory('monasterySchool') || x.chance(0.4),
    title: 'Gold leaf', text: 'You are trusted with a single capital letter in a great book. The gold leaf trembles on your breath.',
    choices: [
      { label: 'Paint with care', tags: ['cautious'], run: (x) => { x.train('painting', 4); x.mods({ discipline: 3 }); return 'A small, perfect letter. It will outlive everyone you know.'; } },
      { label: 'Draw a snail knight in the margin', tags: ['impulsive'], run: (x) => { x.train('art', 3); x.mods({ creativity: 4 }); return 'Readers will giggle at your snail for six hundred years.'; } },
      { label: 'Ask to learn the inks', tags: ['ambitious'], run: (x) => { x.train('chemistry', 2); x.train('artisanship', 2); return 'Oak galls, lapis and secret recipes. You are now dangerous with a mortar.'; } },
    ],
  },
  {
    id: 'sc_cathedralSchool', cat: 'school', minAge: 12, maxAge: 19, once: true, years: [800, 1400], scene: 'classroom',
    title: 'The disputation', text: 'At the cathedral school, the master orders a formal disputation: how many angels can a question hold?',
    choices: [
      { label: 'Argue by the rules', tags: ['cautious'], run: (x) => { x.train('logic', 4); x.train('theology', 2); return 'Major premise, minor premise, conclusion. The master tapped his staff twice: approval.'; } },
      { label: 'Question the question', tags: ['impulsive'], run: (x) => { x.train('philosophy', 3); x.mods({ ego: 2 }); return 'Gasps. You were sent out, and two students followed you.'; } },
      { label: 'Quote the Fathers', tags: ['ambitious'], scene: 'library', run: (x) => { x.train('scripture', 3); x.train('literacy', 2); return 'You buried your opponent under citations. He is still digging.'; } },
    ],
  },
  {
    id: 'sc_squire', cat: 'school', minAge: 12, maxAge: 18, once: true, years: [900, 1500], scene: 'joust',
    when: (x) => rich(x) && x.c.gender !== 'female',
    title: 'Squire', text: 'You serve a knight now: polish his armour, tend his horse, and pray he does not get you killed.',
    choices: [
      { label: 'Train at arms', tags: ['violent'], run: (x) => { x.train('swordsmanship', 4); x.train('horsemanship', 2); x.mods({ fitness: 3 }); return 'Bruised daily, you can now stay in the saddle for a full charge.'; } },
      { label: 'Learn courtesy', tags: ['social'], scene: 'royalBall', run: (x) => { x.train('etiquette', 4); x.mods({ charisma: 2 }); return 'You can carve a swan and bow to a duchess without falling over.'; } },
      { label: 'Care for the horses', tags: ['help'], scene: 'petHorse', run: (x) => { x.train('animalHusbandry', 3); x.train('horsemanship', 3); return 'The destrier, who bites everyone, lets you scratch his nose.'; } },
    ],
  },
  {
    id: 'sc_page', cat: 'school', minAge: 7, maxAge: 13, once: true, years: [900, 1650], scene: 'royalBall',
    when: (x) => rich(x),
    title: 'Page at court', text: 'You have been placed in a great household to learn manners. Today you serve wine at the high table.',
    choices: [
      { label: 'Pour without spilling', tags: ['cautious'], run: (x) => { x.train('etiquette', 3); x.mods({ dexterity: 2 }); return 'Not a drop spilled. A lady noticed and asked your name.'; } },
      { label: 'Eavesdrop', tags: ['impulsive'], run: (x) => { x.train('gossip', 3); x.mods({ wisdom: 1 }); return 'You now know which baron owes money to which bishop.'; } },
      { label: 'Befriend the other pages', tags: ['social'], scene: 'friends', run: (x) => { const n = peer(x, 'friend', 55, 45); x.train('networking', 2); return `${n.firstName} will be a lord one day. He remembers who shared their bread.`; } },
    ],
  },
  {
    id: 'sc_medievalUni', cat: 'youngAdult', minAge: 14, maxAge: 25, once: true, years: [1088, 1650], scene: 'classroom',
    when: (x) => inUni(x),
    title: 'Town and gown', text: 'You sit on straw while a master reads Aristotle aloud in Latin. Outside, townsfolk are jeering at students.',
    choices: [
      { label: 'Copy the lecture', tags: ['cautious'], run: (x) => { x.train('philosophy', 3); x.train('literacy', 2); gr(x, 3); return 'Your notes are so good other students pay to copy them.'; } },
      { label: 'Join the brawl', tags: ['violent'], scene: 'fight', run: (x) => { x.mods({ health: -3, popularity: 3 }); x.train('streetFighting', 2); return 'A tavern war over the price of wine. The king will hear of it.'; } },
      { label: 'Sing in the tavern', tags: ['social'], scene: 'bar', run: (x) => { x.train('singing', 2); x.mods({ happiness: 4 }); return 'Bawdy student songs till dawn. Latin was never so useful.'; } },
    ],
  },
  {
    id: 'sc_imperialExam', cat: 'school', minAge: 15, maxAge: 40, once: true, years: [600, 1905], scene: 'exam',
    when: (x) => x.stat('smarts') > 45 && x.skill('literacy') > 10,
    title: 'The great examination', text: 'You are sealed in a tiny cell for three days with brushes, ink and the classics. Your family\'s hopes sit with you.',
    choices: [
      { label: 'Write with perfect form', tags: ['cautious'], run: (x) => { x.train('literacy', 4); x.train('philosophy', 2); if (check(x, x.stat('smarts') + x.stat('discipline') / 2, 85)) { x.mods({ professionalRep: 6, confidence: 5 }); x.remember('passedExam', 'Passed the great examination', 45); return 'Your name is posted on the wall of successful candidates. Your village will feast for a week.'; } return 'You failed, like most. You may try again in three years.'; } },
      { label: 'Write something original', tags: ['impulsive'], run: (x) => { x.mods({ creativity: 4 }); x.train('writing', 3); return 'One examiner loved it; two did not. A failure you are oddly proud of.'; } },
      { label: 'Sleep, then write', tags: ['ambitious'], scene: 'calm', run: (x) => { x.mods({ energy: 5 }); x.train('literacy', 2); return x.chance(0.3) ? 'Rested and clear, you passed in the middle of the list.' : 'Rested, clear and narrowly failed. The next cell snored all night.'; } },
    ],
  },
  {
    id: 'sc_harvestBreak', cat: 'childhood', minAge: 8, maxAge: 15, once: true, years: [-800, 1960], scene: 'farm',
    when: (x) => !rich(x),
    title: 'Harvest time', text: 'Your family needs every hand for the harvest. Lessons will have to wait.',
    choices: [
      { label: 'Work the fields', tags: ['help'], run: (x) => { x.train('farming', 4); x.mods({ fitness: 3, smarts: -1 }); return 'Blistered hands and a full barn. Your father clapped you on the back.'; } },
      { label: 'Read in the hay at lunch', tags: ['ambitious'], scene: 'reading', run: (x) => { x.train('farming', 2); x.train('literacy', 2); return 'You found a way to have both. The book smells of hay forever.'; } },
      { label: 'Beg to stay in school', tags: ['social'], scene: 'classroom', run: (x) => { gr(x, 2); x.mods({ stress: 2 }); return 'They let you go half days. Your little sister picked up the slack.'; } },
    ],
  },
  {
    id: 'sc_apprenticeTaken', cat: 'school', minAge: 11, maxAge: 15, once: true, weight: 2, years: [-800, 1880], scene: 'construction',
    when: (x) => !rich(x) && !inSchool(x) && !x.inChain('sc_apprenticeArc'),
    bind: (x) => ({ trade: x.pick(TRADES).id }),
    title: 'Apprenticed', text: (x) => `Your parents have found you a place with a master ${trade(x).name}. Seven years of sweeping, fetching and learning.`,
    choices: [
      { label: 'Work hard', tags: ['ambitious'], run: (x) => { const t = trade(x); elder(x, 'mentor', 45, 40); x.train(t.skill, 6); x.mods({ discipline: 3 }); x.chain('sc_apprenticeArc', 3, { trade: t.id }); return `Up before the master, last to bed. The ${t.name}'s trade begins to make sense in your hands.`; } },
      { label: 'Charm the master\'s family', tags: ['social'], scene: 'familyDinner', run: (x) => { const t = trade(x); elder(x, 'mentor', 55, 50); x.train(t.skill, 3); x.chain('sc_apprenticeArc', 3, { trade: t.id }); return 'The master\'s wife slips you extra bread. The master pretends not to see.'; } },
      { label: 'Run away', tags: ['impulsive'], scene: 'refugees', run: (x) => { x.mods({ riskTolerance: 4, streetCred: 2 }); x.train('streetwise', 3); return 'You lasted three days in the city before hunger brought you home. Your father said nothing, loudly.'; } },
    ],
  },
  {
    id: 'sc_journeyman', cat: 'school', triggered: true, scene: 'roadTrip',
    title: 'Journeyman', text: (x) => `Your apprenticeship is done. As a journeyman ${trade(x).name}, custom says you must travel and work for other masters.`,
    choices: [
      { label: 'Walk to distant cities', tags: ['ambitious'], scene: 'travel', run: (x) => { x.train(trade(x).skill, 5); x.mods({ wisdom: 3 }); x.train('languages', 1); return 'Three cities, three masters, three new tricks of the trade.'; } },
      { label: 'Stay near home', tags: ['cautious'], run: (x) => { x.train(trade(x).skill, 3); x.money(era$(x, 800)); return 'Steady work and a little coin saved. Your mother is relieved.'; } },
      { label: 'Join a brotherhood of craftsmen', tags: ['social'], scene: 'ritual', run: (x) => { x.train(trade(x).skill, 3); x.train('networking', 3); peer(x, 'friend', 50, 50); return 'Secret handshakes and shared lodgings. A family of the trade.'; } },
    ],
  },
  {
    id: 'sc_masterpiece', cat: 'school', triggered: true, scene: 'invention',
    title: 'The masterpiece', text: (x) => `To become a master ${trade(x).name}, you must present a masterpiece to the guild.`,
    choices: [
      { label: 'Make something traditional', tags: ['cautious'], run: (x) => { x.train(trade(x).skill, 4); if (check(x, x.skill(trade(x).skill) + x.stat('discipline') / 2, 50)) { x.mods({ professionalRep: 6, confidence: 5 }); x.remember('guildMaster', `Admitted to the guild as a master ${trade(x).name}`, 40); return 'The guild masters turned it over in silence, then shook your hand. Master.'; } return 'Not yet, they said. Another year.'; } },
      { label: 'Make something daring', tags: ['ambitious'], run: (x) => { x.mods({ creativity: 4 }); if (x.chance(0.45)) { x.mods({ professionalRep: 8, fame: 2 }); return 'They had never seen the like. Your work is talked of in three towns.'; } x.mods({ ego: -3 }); return 'Too strange for the old men. They sent you back to your bench.'; } },
      { label: 'Gift it to your old master', tags: ['help'], run: (x) => { x.mods({ karma: 3, professionalRep: 3 }); return 'The old master put it in his window with a sign: "My apprentice made this."'; } },
    ],
  },
  // ================================================================== early-modern learning
  {
    id: 'sc_hornbook', cat: 'school', minAge: 4, maxAge: 8, once: true, years: [1450, 1800], scene: 'reading',
    title: 'The hornbook', text: 'A paddle of wood with the alphabet under a thin sheet of horn. Your first book.',
    choices: [
      { label: 'Learn every letter', tags: ['ambitious'], run: (x) => { x.train('literacy', 4); return 'By midsummer you could read the shop signs, then the Bible, then everything.'; } },
      { label: 'Use it as a bat', tags: ['impulsive'], scene: 'sports', run: (x) => { x.mods({ fitness: 1, discipline: -1 }); return 'Excellent for hitting pebbles. Less excellent for learning.'; } },
      { label: 'Teach your little brother', tags: ['help'], scene: 'family', run: (x) => { x.train('literacy', 2); x.train('mentoring', 2); return 'He learned A, B and C, and to call you "teacher".'; } },
    ],
  },
  {
    id: 'sc_printedBook', cat: 'school', minAge: 8, maxAge: 18, once: true, years: [1450, 1560], scene: 'invention',
    title: 'A printed book', text: 'A travelling merchant shows you a book made by a press, not a scribe. Every letter identical.',
    choices: [
      { label: 'Spend your savings on it', tags: ['impulsive'], scene: 'reading', run: (x) => { x.money(-era$(x, 10)); x.train('literacy', 3); x.mods({ smarts: 2 }); return 'It is the most precious thing you own. You read it until the binding gives.'; } },
      { label: 'Ask how it is made', tags: ['ambitious'], run: (x) => { x.train('engineering', 2); x.mods({ creativity: 2 }); return 'Lead type, ink and a wine press. The world is about to change.'; } },
      { label: 'Call it devilry', tags: ['cautious'], scene: 'holy', run: (x) => { x.mods({ faith: 2 }); return 'The merchant shrugged and sold it to someone else. History did not wait.'; } },
    ],
  },
  {
    id: 'sc_latinGrammar', cat: 'school', minAge: 9, maxAge: 16, once: true, years: [1300, 1900], scene: 'study',
    when: (x) => inSchool(x),
    title: 'Latin grammar', text: 'Amo, amas, amat. The grammar master demands every declension by Friday.',
    choices: [
      { label: 'Chant until it sticks', tags: ['cautious'], run: (x) => { x.train('languages', 4); gr(x, 3); return 'You recite conjugations in your sleep. Your roommate has complained.'; } },
      { label: 'Translate rude poems', tags: ['impulsive'], scene: 'reading', run: (x) => { x.train('languages', 3); x.train('poetry', 1); x.mods({ popularity: 3 }); return 'The ancient poets were surprisingly rude. Your translations were passed around.'; } },
      { label: 'Argue Latin is dead', tags: ['ambitious'], run: (x) => { x.train('persuasion', 2); return '"So are you, on Friday," said the master. A fair point.'; } },
    ],
  },
  {
    id: 'sc_governess', cat: 'school', minAge: 5, maxAge: 13, once: true, years: [1600, 1910], scene: 'reading',
    when: (x) => rich(x),
    title: 'The new governess', text: 'Your new governess has arrived with a trunk of books and a very straight back.',
    choices: [
      { label: 'Be a model pupil', tags: ['cautious'], run: (x) => { const t = elder(x, 'mentor', 55, 50); x.train('literacy', 3); x.train('etiquette', 2); gr(x, 3); return `${t.firstName} smiled for the first time in October. You consider it a triumph.`; } },
      { label: 'Put a frog in her bed', tags: ['impulsive'], scene: 'ghost', run: (x) => { x.mods({ discipline: -2, happiness: 3 }); return 'She screamed, then laughed, then made you write lines until midnight.'; } },
      { label: 'Ask her about the world', tags: ['social'], run: (x) => { const t = elder(x, 'mentor', 60, 55); x.train('history', 3); x.mods({ wisdom: 2 }); return `${t.firstName} had been to India and Russia. Lessons became adventures.`; } },
    ],
  },
  {
    id: 'sc_finishingSchool', cat: 'school', minAge: 14, maxAge: 19, once: true, years: [1750, 1965], scene: 'royalBall',
    when: (x) => rich(x),
    title: 'Finishing school', text: 'Deportment, French and how to walk with a book balanced on your head. You are being "finished".',
    choices: [
      { label: 'Master the book walk', tags: ['ambitious'], run: (x) => { x.train('etiquette', 4); x.mods({ looks: 1, charisma: 2 }); return 'Three books, a flight of stairs, no hands. The headmistress applauded.'; } },
      { label: 'Start a secret debating club', tags: ['impulsive'], scene: 'meeting', run: (x) => { x.train('persuasion', 3); x.mods({ confidence: 3 }); return 'Politics after lights out. Several girls left more dangerous than they arrived.'; } },
      { label: 'Write home miserable letters', tags: ['cautious'], scene: 'loveLetter', run: (x) => { x.train('writing', 2); x.mods({ loneliness: 2 }); return 'Your mother wrote back: "Chin up, and keep it level."'; } },
    ],
  },
  {
    id: 'sc_grandTour', cat: 'youngAdult', minAge: 17, maxAge: 24, once: true, years: [1660, 1840], scene: 'travel',
    when: (x) => rich(x),
    title: 'The Grand Tour', text: 'Your family sends you abroad with a tutor to see the ruins, galleries and courts of the continent.',
    choices: [
      { label: 'Sketch every ruin', tags: ['cautious'], scene: 'painting', run: (x) => { x.train('art', 4); x.train('history', 3); return 'Three fat sketchbooks of columns. Your family hangs them in the hall.'; } },
      { label: 'Gamble in Venice', tags: ['impulsive'], scene: 'casino', run: (x) => { const ok = x.chance(0.4); x.money(ok ? era$(x, 2000) : -era$(x, 2000)); return ok ? 'You won a small fortune and a masked admirer\'s compliments.' : 'You lost a small fortune and your tutor\'s respect.'; } },
      { label: 'Study at a foreign academy', tags: ['ambitious'], scene: 'library', run: (x) => { x.train('languages', 4); x.train('philosophy', 2); return 'You came home fluent and full of radical ideas.'; } },
    ],
  },
  {
    id: 'sc_dameSchool', cat: 'school', minAge: 4, maxAge: 8, once: true, years: [1600, 1880], scene: 'classroom',
    when: (x) => !rich(x),
    title: 'The dame school', text: 'For a penny a week, an old widow teaches the village children their letters in her kitchen.',
    choices: [
      { label: 'Sit by the fire and learn', tags: ['cautious'], run: (x) => { x.train('literacy', 3); return 'She smelled of peppermint and was never wrong about spelling.'; } },
      { label: 'Help with her chores', tags: ['help'], scene: 'cooking', run: (x) => { x.train('literacy', 1); x.train('cooking', 2); x.mods({ empathy: 2 }); return 'She taught you to read and to make a decent stew. Both useful.'; } },
      { label: 'Play with her cat', tags: ['impulsive'], scene: 'petCat', run: (x) => { x.mods({ happiness: 3 }); return 'The cat learned nothing. Neither did you. Both of you were content.'; } },
    ],
  },
  {
    id: 'sc_oneRoom', cat: 'school', minAge: 6, maxAge: 13, once: true, years: [1800, 1945], scene: 'classroom',
    when: (x) => inSchool(x),
    title: 'One-room schoolhouse', text: 'Twenty children, ages five to fifteen, one teacher and a pot-bellied stove. It is your turn to bring the firewood.',
    choices: [
      { label: 'Bring extra wood', tags: ['help'], run: (x) => { x.mods({ fitness: 1, karma: 2 }); return 'The room was cosy all day. The teacher let you ring the bell.'; } },
      { label: 'Help teach the little ones', tags: ['social'], run: (x) => { x.train('mentoring', 3); x.train('literacy', 1); return 'The six-year-olds adored you. Teaching, you discover, is learning twice.'; } },
      { label: 'Forget the wood', tags: ['impulsive'], scene: 'blizzard', run: (x) => { x.mods({ popularity: -2 }); return 'Everyone wore mittens to write. You will not forget again.'; } },
    ],
  },
  {
    id: 'sc_slate', cat: 'school', minAge: 6, maxAge: 12, once: true, years: [1800, 1920], scene: 'exam',
    when: (x) => inSchool(x),
    title: 'Recitation', text: 'The whole class stands to recite. The teacher points at you with her pointer.',
    choices: [
      { label: 'Recite perfectly', tags: ['ambitious'], run: (x) => { x.train('literacy', 2); x.train('publicSpeaking', 2); gr(x, 3); return 'Every word in place. A gold star chalked on your slate.'; } },
      { label: 'Mumble along', tags: ['cautious'], run: () => 'Hidden in the chorus, you survived another morning.' },
      { label: 'Spit on your slate to erase it', tags: ['impulsive'], run: (x) => { x.mods({ popularity: 2, discipline: -1 }); return 'Disgusting, effective, and punished by a rap on the knuckles.'; } },
    ],
  },
  {
    id: 'sc_sundaySchool', cat: 'school', minAge: 7, maxAge: 15, once: true, years: [1780, 1960], scene: 'holy',
    when: (x) => poor(x) || !inSchool(x),
    title: 'Sunday school', text: 'You work all week, but on Sundays the chapel teaches working children to read.',
    choices: [
      { label: 'Never miss a Sunday', tags: ['ambitious'], run: (x) => { x.train('literacy', 4); x.mods({ faith: 2 }); return 'You learned to read from the only book they had. It was enough to start.'; } },
      { label: 'Sing loudest', tags: ['social'], scene: 'concert', run: (x) => { x.train('singing', 2); x.mods({ happiness: 3 }); return 'The hymns were the best part of your week, every week.'; } },
      { label: 'Sleep in instead', tags: ['cautious'], scene: 'calm', run: (x) => { x.mods({ energy: 5 }); return 'Your only rest day. Reading can wait, perhaps forever.'; } },
    ],
  },
  {
    id: 'sc_mechanicsInstitute', cat: 'youngAdult', minAge: 14, maxAge: 25, once: true, years: [1820, 1914], scene: 'library',
    when: (x) => !rich(x),
    title: 'Evening lectures', text: 'After twelve hours at work, the Mechanics\' Institute offers a lecture on electricity. Admission: a penny.',
    choices: [
      { label: 'Attend every week', tags: ['ambitious'], scene: 'invention', run: (x) => { x.train('science', 4); x.train('electrical', 2); x.mods({ energy: -4, smarts: 2 }); return 'Sparks jumped between brass balls. You walked home dazzled.'; } },
      { label: 'Borrow the books', tags: ['cautious'], run: (x) => { x.train('literacy', 3); x.train('engineering', 2); return 'You read by candlelight and fell asleep on Faraday.'; } },
      { label: 'Go to the pub instead', tags: ['social'], scene: 'bar', when: (x) => x.age >= 18, run: (x) => { x.mods({ happiness: 3 }); return 'The pub was warmer. The lectures were not going anywhere. Neither were you.'; } },
    ],
  },
  {
    id: 'sc_sampler', cat: 'childhood', minAge: 7, maxAge: 13, once: true, years: [1600, 1900], scene: 'gardening',
    title: 'The sampler', text: 'You are stitching your first sampler: the alphabet, a verse and your name, in tiny cross-stitch.',
    choices: [
      { label: 'Stitch it perfectly', tags: ['cautious'], run: (x) => { x.train('tailoring', 4); x.mods({ discipline: 2 }); return 'It will hang on a wall for two hundred years. Someone will buy it at auction.'; } },
      { label: 'Add a dragon', tags: ['impulsive'], run: (x) => { x.train('art', 2); x.mods({ creativity: 4 }); return 'A small green dragon is eating the letter Q. Your mother has questions.'; } },
      { label: 'Stitch a verse you wrote', tags: ['ambitious'], scene: 'reading', run: (x) => { x.train('poetry', 2); x.train('tailoring', 2); return 'Your own words, in thread. Your grandmother cried a little.'; } },
    ],
  },
];

/** One event per school subject: a moment where that subject clicks, or does not. */
const SUBJECTS: { id: string; name: string; skill: string; scene: string; text: string; years?: [number, number]; minAge?: number; fun: string; win: string }[] = [
  { id: 'maths', name: 'Maths', skill: 'mathematics', scene: 'exam', text: 'Fractions, then algebra, then letters pretending to be numbers.', fun: 'You turned the equations into a treasure hunt.', win: 'Something clicked. Numbers started to feel like a language.' },
  { id: 'history', name: 'History', skill: 'history', scene: 'museum', text: 'Your teacher tells the story of a fallen empire as if they were there.', fun: 'You acted out the battle with pencils. Your side won this time.', win: 'You realised the past is just people, making choices, like you.' },
  { id: 'biology', name: 'Biology', skill: 'biology', scene: 'lab', text: 'Under the microscope, a drop of pond water is full of strange swimming creatures.', years: [1700, 2300], fun: 'You named every creature after a teacher.', win: 'A whole hidden world. You looked at every puddle differently after.' },
  { id: 'chemistry', name: 'Chemistry', skill: 'chemistry', scene: 'lab', text: 'Two clear liquids, one beaker, and a sudden bloom of brilliant blue.', years: [1800, 2300], minAge: 12, fun: 'You made the teacher\'s demonstration fizz twice as high.', win: 'The periodic table stopped being a poster and became a map.' },
  { id: 'physics', name: 'Physics', skill: 'physics', scene: 'invention', text: 'Your teacher drops a feather and a hammer in a vacuum tube. They land together.', years: [1700, 2300], minAge: 12, fun: 'You dropped everything off the balcony "for science". Grounded.', win: 'The universe has rules. You want to know all of them.' },
  { id: 'geography', name: 'Geography', skill: 'history', scene: 'travel', text: 'A huge map is unrolled across the desks. Your town is a speck.', years: [1500, 2300], fun: 'You drew sea monsters in all the empty oceans.', win: 'You memorised every capital and promised yourself you would see some.' },
  { id: 'literature', name: 'Literature', skill: 'writing', scene: 'reading', text: 'The set book is long, old and, unexpectedly, about you.', fun: 'Your essay argued the villain was right. Bold. B-plus.', win: 'You finished it in one night and needed a day to recover.' },
  { id: 'languages', name: 'Languages', skill: 'languages', scene: 'classroom', text: 'A foreign language: new sounds, new words, and verbs that refuse to behave.', fun: 'You only learned the swear words, but in perfect accent.', win: 'You dreamed in the new language for the first time.' },
  { id: 'music', name: 'Music', skill: 'music', scene: 'music', text: 'Music class. Everyone gets an instrument; yours is the triangle.', fun: 'You played the triangle like a rock star. The class went wild.', win: 'You heard the harmony inside the noise, and could not unhear it.' },
  { id: 'art', name: 'Art', skill: 'art', scene: 'painting', text: 'Clay, paint and a teacher who says "there are no mistakes, only discoveries".', fun: 'You made a lopsided pot. It holds pencils and memories.', win: 'You lost track of time completely. That is how you knew.' },
  { id: 'pe', name: 'PE', skill: 'running', scene: 'sports', text: 'Cross-country running, in the rain, uphill, both ways.', years: [1850, 2300], fun: 'You took a "shortcut" through a farm and were chased by geese.', win: 'Your lungs burned, then something opened up. You love running now.' },
  { id: 'computing', name: 'Computing', skill: 'programming', scene: 'hacker', text: 'Your first program: make the computer say hello.', years: [1975, 2300], minAge: 9, fun: 'Your program said something much ruder. Detention, and respect.', win: 'You made the machine obey. It felt like a superpower.' },
  { id: 'scripture', name: 'Scripture', skill: 'scripture', scene: 'holy', text: 'Scripture lessons: old stories of floods, kings and wanderers.', fun: 'You asked where the dinosaurs went. The teacher changed the subject.', win: 'The old stories stuck with you, and so did their questions.' },
  { id: 'economics', name: 'Economics', skill: 'economics', scene: 'stocks', text: 'Supply, demand, and a lesson where the class runs a pretend market.', years: [1900, 2300], minAge: 13, fun: 'You cornered the pretend market in pretend bananas.', win: 'Money suddenly made sense, and so did the news.' },
  { id: 'drama', name: 'Drama', skill: 'acting', scene: 'theater', text: 'Drama class. Today you must improvise a scene as a lost penguin.', years: [1900, 2300], fun: 'Your penguin had a tragic backstory. The class was in tears of laughter.', win: 'For ten minutes you were someone else entirely. You want that again.' },
  { id: 'astronomy', name: 'Astronomy', skill: 'astronomy', scene: 'eclipse', text: 'The class takes turns at a telescope pointed at the moon.', years: [1650, 2300], fun: 'You claimed you saw a moon person waving. Three kids believed you.', win: 'Craters, mountains, shadows. The sky became a place, not a ceiling.' },
  { id: 'philosophy', name: 'Philosophy', skill: 'philosophy', scene: 'library', text: 'The teacher asks: "How do you know you are not dreaming right now?"', minAge: 14, fun: 'You pinched the person next to you to check. They were not dreaming.', win: 'You could not stop asking questions. Your parents could not stop sighing.' },
  { id: 'civics', name: 'Civics', skill: 'law', scene: 'court', text: 'Your class holds a mock trial about a stolen bicycle.', years: [1880, 2300], minAge: 11, fun: 'As defence lawyer you blamed the bicycle. Hung jury.', win: 'Rules, rights, fairness. You argued until the bell, and beyond.' },
  { id: 'cookery', name: 'Cookery', skill: 'cooking', scene: 'cooking', text: 'The task is soup. The pot is enormous. The class is twelve.', years: [1900, 2300], fun: 'You added every spice in the cupboard. Edible, technically.', win: 'Your soup was so good the teacher took some home.' },
  { id: 'robotics', name: 'Robotics', skill: 'robotics', scene: 'robots', text: 'Robotics club. Your little machine must cross the table without falling off.', years: [1995, 2300], minAge: 10, fun: 'Your robot drove straight off the table, beeping triumphantly.', win: 'It crossed, turned and waved its gripper. You may have cried.' },
];

const SUBJECT_EVENTS: EventDef[] = SUBJECTS.map((s) => ({
  id: `sc_subj_${s.id}`, cat: 'school', minAge: s.minAge ?? 8, maxAge: 17, once: true, weight: 0.7, scene: s.scene,
  ...(s.years ? { years: s.years } : {}),
  when: (x: Ctx) => inSchool(x),
  title: s.name, text: s.text,
  choices: [
    { label: 'Throw yourself in', tags: ['ambitious'], run: (x: Ctx) => { x.train(s.skill, 4); gr(x, 2); if (check(x, x.stat('smarts') + x.stat('discipline') / 2, 60)) { x.mods({ confidence: 3 }); return s.win; } return 'You worked hard and got there, slowly. It counts.'; } },
    { label: 'Have some fun with it', tags: ['impulsive'], run: (x: Ctx) => { x.train(s.skill, 2); x.mods({ creativity: 2, happiness: 2 }); return s.fun; } },
    { label: 'Help a classmate', tags: ['help', 'social'], run: (x: Ctx) => { x.train(s.skill, 2); x.train('mentoring', 1); x.mods({ empathy: 2 }); return 'Explaining it to them made you understand it better yourself.'; } },
  ],
} as EventDef));

export const SCHOOL_EVENTS: EventDef[] = [...EARLY, ...PRIMARY, ...SECONDARY, ...TEEN, ...HIGHER_ED, ...PREMODERN, ...SUBJECT_EVENTS];

export const SCHOOL_CHAINS: ChainDef[] = [
  {
    id: 'sc_scienceArc', name: 'Young scientist', desc: 'A science-fair project that keeps growing.',
    steps: [{ delay: 1, eventId: 'sc_scienceRegional' }, { delay: 3, eventId: 'sc_scienceNational' }],
  },
  {
    id: 'sc_apprenticeArc', name: 'Apprentice to master', desc: 'From sweeping the workshop floor to presenting a masterpiece to the guild.',
    steps: [{ delay: 3, eventId: 'sc_journeyman' }, { delay: 3, eventId: 'sc_masterpiece' }],
  },
];

