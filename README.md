# LifeSim Ultra

**Play it:** https://noahschuster2006-dot.github.io/Ultro-Sim-/ (GitHub Pages, served from `docs/index.html`, a single self-contained offline build). You can also download `docs/index.html` and open it in any browser.

A generational life simulator that runs in the browser. You live one life at a time, in any era from ancient Rome to the near future, and then continue the bloodline as one of your heirs. The world keeps changing on its own while you play: governments rise and fall, economies crash, wars start, and new technologies appear.

The game is a deterministic TypeScript simulation engine (`src/engine`) with a React UI on top (`src/ui`). The engine has no dependency on the UI. It runs headless in Node for the tests and for the balance simulator.

## Love, family and everyday life

- **Romance for adults.** 211 romance events and 44 romance actions: meeting people the way each era did (matchmakers, personal ads, dating apps), dates, jealousy, exes, moving in, proposals, weddings, honeymoons, married life, affairs and open relationships, breakups and late-life love. Intimacy is always implied, never shown. Romance is 18+ only, and tests check that.
- **Family, school, work, leisure, history.** Hundreds of new events about parenting and ageing parents, growing up and school, every career category, hobbies, travel, daily life in every era and every country, health and ageing, money, fame, crime and the supernatural.
- **Pets and possessions.** 15 kinds of pet with their own portraits, from dogs and falcons to robot dogs; they age, bond with you and need care. 58 things to buy, from chariots to private jets, that cost upkeep, wear out and can be stolen.

## The phone

You play the whole game on a phone held in your hands, seen in first person.

- **Every category is an app** on the home screen, each with its own icon: Journal, People, Love, Bank, Going Out, Shop, Pets, Work, Stats, Health, Skills, Shady (crime and law), Fame, Spirit, News, Dynasty, Music and Settings. App icons show red badges when something needs attention, such as being in prison, an unmanaged illness or this year's news.
- **The status bar is your life.** The clock shows the in-game year, the battery shows your health, and the signal bars follow the media era (no bars in the age of word of mouth).
- **Events arrive as alert sheets** with a category icon and a portrait of the person involved. Action results arrive as push notifications.
- **Everyone has a face.** Procedural portraits (`src/ui/art/Avatar.tsx`) are built from each person's id. Skin tone comes from where they were born and hair colour from their family name, so relatives look alike. They age, go grey, wear glasses, frown when they dislike you, wear a crown if royal or a jumpsuit if imprisoned, and turn grey with a halo when they die.
- **The world behind the phone.** A full-screen canvas (`src/ui/scene`) draws the surroundings, slightly out of focus. When something happens, a short animation plays there and the focus pulls to the background: an alien invasion, a war, a police raid, a market crash, a wedding, a funeral, a night out with friends: 164 scenes in all, and every event and action has one (a test enforces it), with era-aware variants (swords and arrows instead of tanks, a sailing ship instead of a plane, a carriage instead of a car). On small screens the phone dips so you can see the scene, and a tap brings it back. A classifier (`scene/classify.ts`) maps events, choice outcomes, player actions and world news to scenes.
- **Music.** Nine original Sims-style background tracks and 20 sound effects are synthesized live with the Web Audio API (`src/ui/audio`). There are no audio files, so it is all free to use and works offline. The music follows your mood (calm, upbeat, tense, sad, epic, mystic), or you can pick a station in the Music app.
- **New-life presets.** A one-tap scenario row (Royal heir, Street kid, Prodigy, Old money, Born athlete, Tortured artist, Born trouble, Second sight, Big family, Roman citizen, Medieval squire, Jazz Age, Tomorrow, Only child), plus individual settings: era, country, gender, sexuality (straight, gay, bisexual, asexual), names, family wealth, home life, family faith, siblings, up to three personality traits, and options.

## Quick start

```bash
npm install
npm run dev         # play at http://localhost:5173
npm test            # 27 tests: content integrity, determinism, formulas, presets, scene classifier, multi-life autoplay
npm run simulate    # headless stress run: many lives across eras (args: runs generations)
npm run content     # print the real content counts
npm run build       # typecheck + production build into dist/
npm run build:single  # one self-contained offline file: dist/lifesim-ultra.html
```

The game autosaves to `localStorage` after every action. From the in-game menu you can also download the save as JSON. A seed plus the same sequence of choices always reproduces the same life.

## How a year plays

1. **Spend action points.** You get 1–7 per year depending on age, job and work ethic (adults get 6–7). They go on dates, nights out, hobbies, shopping, pets, family time, studying, working out, crime, politics, praying and more (384 player actions).
2. **Age up.** The world ticks first, then every life system, then consequence chains, then random events, then mortality.
3. **Resolve events.** Events with choices show up as cards. Your mental state can hide or distort the options you see: anxiety removes options, depression hides ambitious ones, ego blocks asking for help, mania pushes impulsive choices, and dementia (opt-in) narrows everything.
4. **Die, read your afterlife cards, settle the estate, and continue as an heir.**

## Content, measured

These are the numbers `npm run content` prints. They are not the design document's targets.

| | Design target | Built |
| --- | --- | --- |
| Careers | 127 | **127**: 1,270 ladder rungs, 7 branch tracks, 10 secret careers |
| Stats | 47 across 8 categories | **47 across 8 categories** |
| Skill nodes | 200+ | **224** in 10 categories, plus 10 secret combos |
| Events | 2,400+ | **2,263** definitions: 1,882 hand-authored plus 381 per-career templates (big break, crisis of conscience, defining moment for each career). 5,979 choices in total, 22 multi-year consequence chains. |
| Generational depth | Unlimited | Unlimited. Dynasty milestones run from generation 2 to 100. |

Also built: 9 eras, 22 countries with era-appropriate names, 14 religions, 64 historically placed world events plus procedural ones, 16 asset classes, 25 crimes, 6 drug types with 4-stage supply chains, 5 other criminal operation types, 10 mental-health conditions, 7 addictions, 13 chronic conditions, 15 education programs, 7 political offices, 14 laws, 4 secret societies, 6 demonic pacts, 5 curses, 18 inheritable traits, and 4 multi-step consequence chains.

**The event count is 2,263 against a target of 2,400+.** The engine is data-driven, so adding events means adding entries to `src/engine/events/*.ts`. No engine changes are needed.

## Systems and where they live

| Design system | Implementation |
| --- | --- |
| Dual-timeline world engine | `systems/world.ts` and `data/history.ts`. Each country has its own economy, stability, war status, social norms, religion dominance, crime rate, health crisis, regime and ruler. Historical anchors run from the Punic Wars to the war in Ukraine. Procedural recessions, booms, wars, coups, revolutions and pandemics fill the gaps. Near-future events cover AI automation, climate disasters, fusion, gene editing and lunar bases. World event chains include crash → unemployment → populism → recovery. |
| Eras and technology | `data/eras.ts`. Careers, assets, skills, crimes, drugs, laws and education are all gated by year. Media eras run from word of mouth to social media, and scandals spread faster in later eras. |
| Dynasty reputation engine | `systems/dynasty.ts`. Six reputation dimensions shape how every heir is treated from birth. Inheritance passes on 70% of the estate after debts, with will contests, favoritism, curses (−1 level per generation), blessings (−0.5), traits, family enemies and allies, institutional memory, and milestones from generation 2 to 100. |
| Mental health | `systems/mind.ts` and `data/conditions.ts`. 8 mental stats feed into each other. Conditions have triggers, effects and treatments, including PTSD, depression, GAD, panic, bipolar, psychosis, NPD, insomnia, grief and burnout. Therapy, medication, faith and support networks each help in different ways, and availability depends on the era. Choice distortion is in `distortChoices`. |
| Addiction | `systems/addiction.ts`. Seven addictions. Severity is tracked from 0 to 5, and the addiction becomes active at 2+. Covers costs, withdrawal, relapse, and the recovery paths from the design table. |
| Body and biology | `systems/body.ts`. Height (genetics and nutrition), weight that drifts toward a set point driven by diet and exercise, BMI, chronic disease onset and management, permanent injury ceilings, cosmetics, steroids, and fertility. Also contains the **life expectancy formula from the design document, implemented exactly**, with a live breakdown on the Stats tab. |
| Underground economy | `systems/underworld.ts`. A 7-tier criminal organization hierarchy. Drug supply chains (production → transport → distribution → street). Weapons, cyber, smuggling, extortion and gambling operations. Demand reacts to the world: war multiplies arms prices, prohibition makes bootleg liquor pay 4×, cannabis legalization collapses that market. Laundering runs placement → layering → integration, with financial-intelligence tracing. |
| Legal system | `systems/legal.ts`. Every crime opens a case with evidence from 0 to 100. Evidence decays, and witnesses can be bribed, intimidated or silenced. Arrests start above 60 evidence. Trials depend on lawyer tier, fame, judge bribery and jury intimidation, with plea deals available. Prisons run in tiers from county jail to death row, with gangs, parole, appeals and escapes. Also covers extradition blocs, Interpol notices, diplomatic immunity, civil suits and witness protection. |
| Media and public narrative | `systems/media.ts`. Era-appropriate outlets, story types, planting and burying stories, PR firms, secrets that leak, and cancel culture from 2012 onward with all five recovery paths. |
| Property and assets | `systems/assets.ts` and `data/assets.ts`. All 14 asset classes from the table, plus a stock portfolio and the family estate. Includes mortgages, renting, development, fronts for laundering, seizure by juntas, startup exits and failures, and crypto swings. |
| Relationship graph | `systems/npcs.ts` and `systems/relationships.ts`. Every NPC has stats, a career, ambitions and links to other NPCs, and advances on their own every year. Harming someone ripples two hops out to their allies and family. Marrying into a family brings its enemies with it. Also covers betrayal probability, romance (attraction, compatibility, connection), affairs, polyamory, era-dependent consequences for LGBTQ+ relationships, children with upbringing focus, and neglect. |
| Skill tree | `data/skills.ts` and `systems/skills.ts`. Prerequisite unlocking, decay when unused, era locks, and secret combos (Criminal + Law, Hacking + Military, Demonology + Medicine, and others) that open secret careers. |
| Politics | `systems/politics.ts`. Elections, appointments, approval, re-election, impeachment, legislation that changes the world context, war, sanctions, cabinets, coups, dictatorship and royal succession. |
| Spiritual layer | `systems/spirit.ts`. Divine favor thresholds at 25, 50, 75 and 100 (a miracle can save you from death once). Demonic pacts with real costs, up to 3. Selling your soul locks you onto the demon-lord path. Covers curses and how to break them, secret societies, founding a religion, randomized religious institutions with schisms, and the 3-card afterlife reading. |
| Event engine | `events/engine.ts`. Conditions, weights, cooldowns, memory-weighted events (the 50 most significant memories), consequence chains (mafia, radicalization, curse-breaking, dynasty legend), world-reactive pools, secret events, and a check at resolution time so stale events "pass". |

## Architecture

```
src/engine/
  types.ts          serializable game state (plain JSON)
  rng.ts            seeded RNG (state lives in the save)
  ctx.ts            the helper every system and event uses
  data/             careers, stats, skills, eras, countries, history, assets, ...
  systems/          one module per system (world, body, mind, legal, ...)
  events/           event engine + pools (life, adult, crime, career, ...)
  sim.ts            ageUp(): the yearly loop
  actions.ts        player actions (data-driven, rendered generically)
src/ui/
  App.tsx           game controller: phone screens, scenes, music
  phone/            phone frame, home screen, apps, lock screen, setup, memorial
  panels/           the content of each app
  art/              procedural portraits and icon mappings
  scene/            background canvas: drawing kit, scenes, backdrop, classifier
  audio/            Web Audio music and sound effects
scripts/            autoplay bot, stress simulator, content report
tests/              node:test suites
```

## Deliberate departures from the design document

- **No self-harm outcome.** The "suicidal ideation" mechanic is a crisis event where every option is a way of getting support (a trusted person, a crisis line or doctor, hospital care). Choosing "keep it to yourself" lets the crisis recur. When depression is high, the Body & Mind tab shows a real-world resources line. Suicide is not a death type.
- **No human-trafficking skill node.** The criminal tree has "Syndicate logistics" in that slot. Humanitarian refugee smuggling is included, as the design specifies.
- **Slavery is history, not a career.** Abolition and other events appear in the chronicle, but there is no playable "slave" career ladder.
- **Generation 100 "mythic status".** This milestone refers to other players' dynasties, which needs a server. Here it is a local **Hall of Dynasties** leaderboard stored on your device.
- **Real religions, neutral institutions.** Characters can belong to real faiths. The institutions' influence, wealth and corruption are rolled randomly for each world, not hard-coded about real organizations.

## Determinism and saves

All randomness flows through `GameState.rng` (mulberry32). Text shown for an event is generated once, when the event is first prepared, so rendering never consumes randomness. A save is `JSON.stringify(state)`, and `deserialize` checks the version field.
