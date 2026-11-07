# LAST BUS: LAGOS — progress file (updated 1 November 2026, prologue Milestones 0–4 done, Chapter 1 polished)

Read `docs/HANDOFF-2026-10-31.md` first in any new session: it says where things stand, what was agreed and exactly what comes next. This file says what exists and how to run and verify it. Older history: `docs/HANDOFF-2026-10-29.md`, the creative direction in `docs/story-bible.md`, and the recording list in `docs/voice-script.md`.

## Project at a glance
- **Stack:** TypeScript npm workspaces on Node 24.
  - Client: Vite + Babylon.js 9 (`apps/client`).
  - Server: Colyseus 0.18 (`apps/server`).
  - Shared rules and simulation: `packages/shared`.
  - Everything visual and audible is procedural: low-poly vertex-coloured models and synthesized sound. The only imported assets are the voice recordings.
- **Repo:** the folder `C:\Users\danie\Desktop\last bus\last-bus-lagos-main` is **not a git repo**, and nothing has been committed.
- **Run:** `npm run dev` (client http://localhost:5173, server :2567). In the Claude desktop app, use `preview_start` with the `dev` configuration from `.claude/launch.json`.
- **Protocol:** `VERSION = 'lagos-3'` in `packages/shared/src/config.ts`. Bump it when the input contract, snapshot fields or map geometry change.

## Verify (all must stay green)
- `npm run lint`, `npm test` (116 unit tests), `npm run test:integration` (11) and `npm run test:multiplayer` (smoke match) must all pass. So must `npm run build`.
- Visual tour: with the dev server running, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE="C:/Program Files/Google/Chrome/Application/chrome.exe"` and run `node scripts/visual-tour.mjs`. Screenshots go to `artifacts/tour`.
  - `TOUR=traversal,chapter1,ending,chapter2` picks sections.
  - The tour uses dev hooks on `window.lastBusDev`: teleport, skip, clearEnemies, god, inspect, look, drive, cinema, phone, unlockAll.
- Responsive audit: `node scripts/responsive-audit.mjs` (10 sizes × 14 screens). Seven known notes remain, all tall scrollable dialogs or the sideways settings tab bar on small screens; they are expected.

## What is built
- **Traversal (shared physics):**
  - Vault, mantle, ladder and drainpipe climbing, and slide, all inside `movePlayer`. The server simulates them and prediction replays them.
  - `Box.traverse` flags control what can be crossed, and out-of-bounds is tested.
  - Feel: first-person hands, camera dip and roll, sounds, and a context hint.
- **Cutscene director** (`apps/client/src/cinema.ts`):
  - Shots support ease, blend, push-in (`fovTo`), handheld shake and roll.
  - Timed cues cover: actors (walk, turn, pose, gesture), props (the last bus and its door), fade, grade, letterbox, shake, tumble, sound, sting, duck, overlapping lines and FX.
  - Skipping still applies every state cue.
  - Renderer side: colour grades, dusk/night mood, city state (dead, restored, blackout) and pooled `Spectacle` FX (`render/spectacle.ts`).
- **Chapter 1 "Signal Lost"** (`packages/shared/src/story/campaign.ts`):
  - Nine objectives: the original eight, plus walking back to the south checkpoint at night.
  - Scenes: intro, relay, femi, the outro (Femi's question, the bus departure, Control's "Return to the south checkpoint") and the sky sequence (lights, streak, radio, blast, Unit Seven).
  - Ends with title cards; stats are saved to the campaign screen.
  - **Fully voiced:** 50 recordings in `apps/client/src/voice/`.
- **Chapter 2 "Third Mainland", opening only** (`story/chapter2.ts`, the `shelter` map in `packages/shared/src/world.ts`):
  - Waking up, the window scene, searching for equipment, the phone message, the authorisation and the doorway.
  - The bridge lines `b1`–`b13` are written but the bridge map isn't built.
  - 47 lines are still to record (see `docs/voice-script.md`).
- **Settings:** Mature language (Audio tab, default on), plus everything from the 0.2 release.
- **Fixed on 29 October:** menu and dialog scrolling. Pages now take pointer events (`styles.css`), and tall modals align to the top and scroll.

## Work log for 30 October (the four known problems, now done)
1. ~~**The first voice line often doesn't play**~~ **Fixed 30 October (phase 1).**
   - `voice.ts` now has one priority queue (`VoiceQueue`) that fetches and decodes six recordings at a time. It starts downloading at page load with the default mission's opening lines first; decoding waits for the first menu gesture (`loadVoices`), so no audio context is created early.
   - `launch()` creates the session, then `sceneVoices()` holds the loading screen ("Loading dialogue… n/3") until the opening scene's lines are decoded, capped at 8 s for stalled networks. `tick()` does nothing while `busy`, so the scene can't start behind the loading screen.
   - Safety net: `onVoice` fills the shared `voiceSeconds` object live, and if the current shot's line arrives within the first 2.5 s (or 60%) of the shot, `Director.lateLine()` restarts the line's timing and it is spoken. Camera progress is now accumulated, so a shot that grows mid-way slows down instead of jumping back.
   - Shot and `say` lengths now use the recording actually played (`<key>-clean` when Mature language is off).
   - Tests: three new unit tests (late line, late-line window, queue ordering/batching/waiting). Browser check: `node scripts/voice-cold-check.mjs` (fresh profile, cache disabled; `DELAY=ms` makes each recording arrive late, `RUNS=n`). i1 was heard in every run at no delay, 4 s, 6 s and 6.5 s per file; at 6 s one run hit the 8 s cap and the late-line retry caught i1 0.8 s into the shot.
2. ~~**Act 1 cutscenes are often too dark or look improper.**~~ **Fixed 30 October (phase 2).**
   - **Light rig** (`renderer.ts` `lightRig`): two directional lights during cutscenes only. The key sits 40° to one side of the camera and 30° up; the rim comes from behind the subject on the other side (warm at dusk, cool at night). Both grow with the night blend. They carry `includeOnlyWithLayerMask = CAST_LAYER` and every character mesh has that layer bit (`characters.ts`), so they light the cast only; world materials keep their 4-light budget and character materials get 6.
   - **Exposure floor:** during a cutscene the exposure is at least `1.12 + 0.3 × night`, or the scene's / shot's own `exposure`. Shots and scenes can also set `light: { key, rim, side }` (multipliers; `side` puts the key left or right). Both fields are new on `Shot` and `Cutscene` in `campaign.ts`.
   - **Gentler night:** `cold`, `night`, `restored` and `aftermath` grades are brighter with less vignette and desaturation; the night mood's sun/sky lights went from 0.32/0.36 to 0.45/0.48.
   - **Reframed shots** (Chapter 1): intro 3 (now a front three-quarter push-in on Ada), relay 2 (the camera was inside the yard car), femi 2 (Ada's head was cut off), outro 1, 2, 3, 5, 6, 7 and 8, and sky 2, 3, 6 and 7. Close-ups now sit about 2–2.5 m away with the head top at roughly 80–88% of the visible frame. Outro 8 used to stare into the Kola Printing wall 8 m away.
   - **Roll:** measured on every outro and sky shot: the camera roll is exactly 0 except the intentional blast tumble (sky 9). The leaning lines in outro close-ups are the bus's raked pillars.
   - **Guard test:** `story.test.ts` now fails if any cutscene camera (start, middle, end) is within 0.2 m of a collision box or has geometry within 20 m blocking its look point (boxes the mission removes are ignored).
   - **Tools:** `scripts/scene-preview.mjs` screenshots every Chapter 1 shot in about a minute through the dev hook `lastBusDev.play(scene, shot, flags)` (`SCENES=`, `AT=`, `OUT=`). `scripts/visual-tour.mjs` takes `TOUR_OUT=dir`. Before/after sheets: `artifacts/before-after/phase2-*.png` (left before, right after).
3. ~~**Detail pass wanted on every model**~~ **Done 30 October (phase 3).** Still one merged mesh per bone and batched static geometry.
   - **Characters** (`render/characters.ts`): a `Look` is picked per actor (`lookFor`) and drives `face`, `hairParts`, `torsoParts` and `hand`.
     - Faces: jaw and chin, ears, nose and nostrils, eye whites and irises, brows and two lips. Eyelids (`lids`) and an open mouth (`mouth`) are tiny separate meshes, enabled only while blinking (every 2–5.5 s) or talking, so they normally cost no draw call. `Pose.talk` makes the speaker's mouth move during their recorded line in cutscenes (`stagedActors` in `main.ts`).
     - Bodies: chest, belly and shoulders are flattened ellipsoids (the old round capsule hid the vest), a tapered neck and a collar ring, hands with palm, four fingers and thumb, belts and buckles, cargo pockets, boots with shafts or trainers with white soles.
     - Ada (`variant: 'ada'`): cornrows into a bun with a red tie, gold studs, a low-profile carrier, gold pips and a name tape. Femi (`variant: 'femi'`, also for the escort NPC): wire glasses, a plaster on his temple, rolled sleeves, a buttoned shirt with a pen and an ID lanyard. Police: vest with pouches, radio, badge, grey lettering panels, shoulder flash, peaked cap or helmet. STATIC: hoodie, open jacket, vest (bare arms, gold chain) or tee; crop, afro, locs, shaved or short hair; beanie, cap (either way), hood or bandana; beards, shades and a scarf mask; the knotted red scarf on all of them.
   - **Weapons** (`render/models.ts` `weaponParts`): trigger guards, gas block, slant brake, steel butt plate and a magazine base on both detail levels. The first-person (`high`) set adds rivets, the selector lever, the rear sight leaf, the front sight hood, the cleaning rod, sling swivels, wood grain, edge wear and mag ribs on the AK-26, and the ejection port, hammer, takedown lever, rail, sight dots, grip texture and edge wear on the K9. First-person gloves have wrapped fingers and the left wrist has a watch.
   - **Ojuelegba** (`world.ts`): `nightLights` puts additive light pools and halos under every street lamp, over each shopfront (security lamps every ~12 m) and under the flyover; `ambientLight(night)` (called by the renderer each frame) scales them with the night blend and city state (dim at dusk, full when restored, off in the blackout). A third of the dark windows (`glassNight`) light up in the restored city. Also new: puddles, ~170 pieces of kerbside litter, service wires from each pole to the buildings, stocked shelves with hanging snacks and crates or chairs in open shop bays (lit ones have a tube and a warm spill), small-business signs, grime streaks under sills, and danfo wipers, grab rail, mud flaps, rust, roof cargo and rear stickers.
   - **Shelter** (`damage()`): cracks, water stains, peeled plaster with brick, a ceiling panel hanging by its cable, rubble, dust, broken tiles, paper, an overturned chair, blankets, a first-aid kit and water, notices, and a cool pool under the tube.
   - **Performance:** per-shot draw calls went up 8–15 (new materials), and every Chapter 1 shot stays at 120–230. Phone-like run (844×390 at 2×, CPU throttled 4×, desktop GPU): 60 fps median at the south checkpoint, the junction and the park; p95 33 ms at the first two. Light cones were tried and removed; they looked like hard triangles close up.
   - **Dev hooks:** `lastBusDev.stage(cutscene)` plays any cast and shot (used for a character lineup). Before/after sheets: `artifacts/before-after/phase3-*.png`.
4. ~~**Sound effects pass**~~ **Done 30 October (phase 4).** Everything is still synthesized in `audio.ts`; the five buses, ducking and the public API are unchanged.
   - **Space:** a shared send feeds a procedural convolution reverb (impulse rebuilt from noise, early reflections and decay) and a darker slapback delay; both return into the effects bus. `environment('street' | 'interior')` switches them; `ambience()` picks the space from the mood (the shelter is interior). `route()` takes a `send` level, and far sounds send more, so a distant shot is mostly echo.
   - **Master chain:** glue compressor, then a fast limiter and a tanh soft clip, so the blast and a point-blank pistol no longer overshoot. `peak()` reads the output for checks.
   - **Gunfire:** supersonic crack, body, sub thump, the action cycling and a long tail, with small random variation per shot.
   - **Footsteps by surface:** `step` (concrete), `step-dirt`, `step-wood`, `step-tile` and `step-metal`, each a heel thud plus a surface layer, with kit rattle at a run. `surfaceUnder()` in `main.ts` uses the box underfoot (`surfaceOf`) or the ground layout (road, paving and plazas are hard, open ground is earth, the shelter hall is tiled), for remote players too.
   - **Foley:** reloads (catch, slide, seat, latch, spring), weapon switch rustle and rattle, vault hand slap, mantle, ladder and pipe ring, slide scrape, landing with gear rattle.
   - **Ambience:** wind and a crowd murmur (restored) on top of the beds; weighted random events per mood: danfo horns, dogs, birds, insects and okada/car pass-bys that move across the listener with a Doppler drop (dusk); more horns, pass-bys, music and sirens (restored); drips, sirens and a distant helicopter (shelter).
   - **Cutscenes:** sub-bass sky rumble with crackle, a rising whoosh with Doppler fall, a layered blast with rolling echoes and debris, a big glass shatter with falling shards, a metal-grinding crash, multiple danfo horns and an alarm, two-siren wail, beating tinnitus, the danfo door on its track and the last bus revving through two gears as it pulls away.
   - **Check:** `node scripts/audio-check.mjs` plays every effect and cutscene sound with music, ambience and dialogue muted and prints each output peak. Last run: everything audible, nothing clipped (rifle 0.91, blast 0.94); static, ringing and breath show 0 because they play on the muted dialogue bus. Dev hooks: `lastBusDev.sfx(kind, cine?)`, `peak()`, `mix(bus, level)`.
   - Not verified: how it sounds on phone speakers. Listen in the game; the levels are easy to adjust in `play()` and `cine()`.
## In progress: *The Passenger* prologue (approved plan; next is Milestone 5, voice)
Femi's playable prologue, then Ada's new opening at the start of Signal Lost. The full plan was agreed in session; milestones are 0 escape spike, 1 campaign plumbing, 2 Ada's opening, 3 cinematics and the Danfo Park walk, 3A ambience and radio, 4 bus interior and photo, 5 voice, 6 polish, 7 licence and soundtrack.

**Milestone 4, bus interior and photo: done. The explosion and a Chapter 1 polish pass went in alongside it (1 November).**
- **The set** (`render/bus.ts`): the inside of Danfo 247, visual-only, offstage at z = 300, nose to +x, side door on the -z side. Built the first time a scene looks at it. Real window holes, with a painted street strip outside each side that scrolls, so the view shifts with the camera. Bus coordinates in scenes use `IN(along, across)` and `AT(along, up, across)` in `prologue.ts`.
- **Cheap on purpose:** while the camera is inside, `renderer.ts` switches the whole arena off, so interior shots cost 21 to 87 draw calls. The old street pictures cost up to 265.
- **New state cues, all safe to skip:** `{ cabin: 'rolling' | 'slowing' | 'stopped' | 'open' | 'attacked' | 'text' }` and `{ phone: 'off' | 'photo' | 'sending' | 'failing' | 'dead' | 'message' }`. The phone is a DOM overlay (`#cinema-phone`, `showPhone`). It shows "IMG_0247" on a grey square, never the picture and never a recipient.
- **The ride, now 17 shots:** p8 to p18 are inside the bus. The Sergeant sits directly behind Femi, so he could be the figure in the Chapter 2 photo, or not. Femi takes the photo (shutter sound and flash), it sticks on "Sending…", the Sergeant hands over the second phone and gets off. p11 stays on the Signal 9 billboard on purpose.
- **18:40:** jam is 6 shots: Femi's phone, the billboard flickering into NO SIGNAL, the dead radio and the slap, the POS fault, everyone lifting a phone, "All the bands". The song is heard for about 53 s in real time and dies 1.8 s after 18:40.
- **The attack:** the door is forced from inside the bus too, the bag is taken, the phone is left on the floor by the seat where Ada finds it, and in `hide` it lights up with Femi's own message. Femi wears the bag (`CineActor.bag`) until then, and the cue `{ actor, bag: false }` takes it.
- **Timestamp:** `drawDanfoPhoto` now says 18:37.
- **Explosion** (`render/spectacle.ts`, `sky` in `campaign.ts`, now 13 shots): the old blast was a white screen, because the fireball was hidden behind the flyover. Now it's a particle system per job, each one draw call: fireball, smoke stem and mushroom cap, streak trail, dust wall, rubble, ash and sparks. A rooftop crane shot shows the sky. In order: the streak (now landing as the blast goes off), one second of silence on Ada, light with no sound, the fireball and cap, the dust wall crossing the city, the city blacking out as it passes, Ada bracing, "GET DOWN!", windows going in a line down the street, the boom landing with the dust about seven seconds after the light, a tumble, then Ada on the ground with embers before black. The blast lights the city from the north (`blastT`), dust thickens the fog (`dust`), and `pressure`, `alarms` and `deafen` are new sounds. `deafen` is a lowpass on the master that recovers over six seconds. Draw calls stay around 125 to 170, with one frame at 260 in the dust.
- **Chapter 1 polish:** the tension score no longer plays under Ada's 18:31 scene. The street now comes back in sound as well as light at the end of the outro. Every Chapter 1 shot was reviewed on contact sheets; 119 to 240 draws.
- **Bug note:** Babylon particle size gradients replace the size rather than scale it, so they hold absolute sizes in `blob()`.
- **Tools:** `node scripts/shot-frames.mjs <scene> <shot> <folder> [frames] [gap]` saves a time-lapse of one shot (`VIEW=844x390`, `MISSION=`, `FLAGS=`). `node --import tsx scripts/recording-list.ts` regenerates `docs/recording-list.md`.
- **Tests:** 116 unit tests. New ones cover the set staying offstage, the bag and phone surviving a skip, the Sergeant being off the bus, 18:40's timing, the streak landing with the blast, and the sound arriving with the dust.
- **Not verified:** nobody has heard any of this or played it by hand, and it hasn't run on a real phone. The 4x CPU run averaged 19 fps while the check polled it, at 1280x720, which isn't comparable with the earlier phone-like figure. Launch took 8.6 s at 4x slowdown, with no baseline to compare it to. In the jam, the radio stays clear over the exterior shots, deliberately, because the break-up is the point of them.
- **audio-check note:** one run was aborted when the page navigated away mid-run, and the two repeats passed. The game has no reload code. One radio-check run was spoiled by the PC sleeping and passed when repeated.

**Milestone 3A, ambience and radio: done. The song is still the generated placeholder, and the news and advert are subtitles until `p8` and `p11` are recorded.**
- **Ambience** (`audio.ts`): each mood is now a table of levels for named layers (`MOODS`, `BEDS`), and every layer fades on its own, so moods crossfade and a shared layer never restarts. Saying the same mood again does nothing. `dusk` keeps its old values. New moods: `live` (heavier traffic, murmur, synthesized crowd, hawkers, bells, close events), `ride` (that from inside a bus, with the engine), `hush` (traffic thinning, engine, a low hum) and `still` (near silence, quieter than `dusk`). The escape then rises into `dusk`.
- **Who decides the mood:** `moodFor()` in `soundtrack.ts` from the story's flags, plus the new `ambience` cue in scenes. It's a state cue, so a skip still lands it.
- **Soundtrack** (`soundtrack.ts`): `TRACKS` as data, with a `radio-song` slot that has no file and no licence. A file only plays if the track is `licensed`, its file is in `src/music/` (in `.gitignore`) and the Licensed music setting is on; otherwise, or if it fails to load, the placeholder plays silently. The placeholder is an original 90-second groove, seeded, rendered a bar at a time at 16 kHz into a WAV blob on the prologue's loading screen and played through the same audio element a real file would use.
- **Radio:** `Radio` holds what the radio should be doing; `flush()` applies it each frame, so a skip only plays where the cues ended up. A station already on is never restarted. Chain: tape → speaker filter → drive → dropouts → cabin echo → dashboard position → Music bus. Station speech and static use a matching chain to the Dialogue bus, so Music at 0 (or a streamer) loses the song but not the story. The cue is `{ radio: 'play' | 'stop', station?, level?, signal?, muffled?, seconds? }`; `signal` runs 1 clean to 0 hiss and drives buzz, static, drive, dropouts and pitch wobble together. `Line.station` marks broadcast lines (`p8`, `p11`).
- **The 18:40 sequence** is staged to the table in the handoff. Measured in real time: 49 s of song, dying 1.8 s after 18:40 (written length 46 s, guarded by a unit test).
- **Danfo 247's dead radio** hisses from the `danfo` objective until the relay is back (`dead-radio` flag, `deadRadio()`): −73 dB beside the bus, −83 dB 20 m away.
- **Bugs fixed:** `endCinema` restored the city from story flags between queued scenes, and `live` was already off, so the ride played in the dead city. Now only the last queued scene hands the world back. `live` and `jam` are now state effects that survive a skip. The frozen crowd used to stay on into Signal Lost after Ada's opening. The radio's waveshaper curve is odd-length, because an even one adds DC.
- **Measured** (output, mid band): `live` −39, `ride` −47, `hush` −52, `still` −58, `dusk` −51 dB; song −40 dB with its highs 16 dB below its mids, and a further 30 dB down when muffled. The break-up peaks about twice the song's level.
- **Tools:** `node scripts/radio-check.mjs` logs the ride to the stop in real time (`THROTTLE=4` slows the CPU). `node scripts/sound-states.mjs` checks leaving mid-song, skipping everything, retrying, Ada's opening, the hiss by distance, the setting and the placeholder's cost (1.7 s at 6× slowdown, on the loading screen only). `audio-check.mjs` now also measures every mood and the radio. Dev hooks: `sound`, `probe`, `ambience`, `radio`, `score`.
- **Not verified:** none of this has been heard. The crowd and hawkers are the biggest risk: synthesized speech rarely convinces, so a short recorded pack may be better. The passengers' laugh at +2 s isn't in; it needs a recording.
- **Smoke test note:** the multiplayer smoke test failed once in five runs here, timing out on the 35-second match while the machine was busy. The server code wasn't changed; the other four passed.

**Milestone 3, prologue cinematics: done, subtitles only until `p1`–`p24` are recorded.**
- **Sequence** (`story/prologue.ts`): `opening` (black, then the park, "Prologue · The Passenger"); a playable walk through Danfo Park with the Sergeant behind you, past the last bus, about 11–20 s; `boarding` ("Plan changed." "Command." "Which command?"); `ride`; `jam` (18:40); `stop`; the escape; `hide`, in the exact spot Ada finds him; the Chapter 01 card; Ada's opening.
- **The attack:** STATIC stop the bus, force the door and climb aboard. Femi fights past them down the step and loses the laptop bag, so `f1` and "Blood on the step" hold, and the hunters don't start on top of the player.
- **Danfo 247 moves:** `Arena.movers` now holds `last-bus` and `danfo-247`. Its door stays forced in Signal Lost (`danfo-forced` flag). It parks facing east, so it leaves the park, cuts away, and arrives from the west, which also covers the 13-minute ride. It has no collision while parked at the park, so the player can walk through it if they circle round.
- **The network has a face:** `fx: 'live'` and `fx: 'jam'`, and `Arena.setRelay` now also switches Signal 9's two billboards to NO SIGNAL. They come back when Ada restores Relay 07. There's a new billboard on the north side.
- **World:** STATIC's mark (a flat line with one spike, style `spray`) on walls and pillars, which Chapter 1 inherits; the POS table with "NETWORK DEY TODAY"; a Signal 9 poster under a "planned maintenance" notice; a frozen crowd, one draw call, shown with `live`.
- **Bystanders:** `Mission.bystanders` appear while `live` is set, only within 20 m, to stay on budget. Variants added: `sergeant` (dark jacket over a police-blue shirt, deliberately ambiguous) and `trader`. Femi's plaster is now its own mesh, hidden by `clean` until the attack. Femi has his own first-person hands.
- **New session actions:** `place` moves the player between objectives, `pace` sets the player's speed, `notice` shows a notice. `Mission.parked`, `Cutscene.props` and a prop `place` cue position vehicles. Grace now runs from when a hunter spawns.
- **Bug fixed:** world state used to sync in the same tick a cutscene was queued, so a scene could start with the story's later state already applied. It now waits until queued scenes finish, which also makes the outro's and sky scene's own changes land on time. Tour screenshots of those scenes are worth comparing.
- **Tools:** `MISSION=the-passenger node scripts/scene-preview.mjs`. Budget: 140–275 draws per shot, with the busiest shots a little over the 250 target.

**Milestone 2, Ada's opening: done, subtitles only until `h1`–`h13` are recorded.**
- **The scene:** `checkpoint` in `campaign.ts` plays before `intro`, 18 shots at the south checkpoint from 18:31. Ada catches the bribe under the mat, "I asked a question in a meeting", the Corporal looks away at "who signs off the outages", Control orders all units to the Stadium traffic stop, she fakes a flat tyre (a cut to the van's perfectly good tyre on "…Is it flat?"), the Corporal goes, and she stands alone at the barricade. At 18:40 the street dims and her radio dies on the existing `a16` ("…Control?"), then black into `i1`.
- **It answers the plan's three points:** she doesn't blindly follow orders (the flat), people want this quiet (the question, the Corporal's reaction, Control's warning), and she's committed to Femi without having met him (h13). `f1` still works.
- **Fixes:** the stalled-car hole is gone from the briefing. The Corporal uses the `UNIT_SEVEN` voice, so his later radio lines land harder.
- **New systems:** a `caption` cue (`#cinema-caption`) for place and time cards; `CineActor.speaker`, so any staged actor's mouth moves on their lines; `CineActor.folder`, Ada's case file under her arm; `live` and `jam` effects, with `cityState()` restoring the street if a scene is skipped; a `civilian` look, so the driver is no longer a Femi clone; wheel hubs on the police vans.
- **Voice loading:** the loading screen now waits for every queued opening scene, not just the first, so `i1` is still ready. Confirmed with slow voice files.
- **Left for later:** the street's sound is still the dead-junction ambience until Milestone 3A, and the 18:40 change is mostly the signs dimming until the relay and billboard work in Milestone 3.
- **Recording:** 13 new lines, 60 still to record overall (`docs/voice-script.md`).

**Milestone 1, campaign plumbing: done.**
- Chapter 01 is now titled Signal Lost and holds `['the-passenger', 'signal-lost']`. `Mission.prologue` means no briefing, no saved checkpoint and never needed to unlock anything. Retries inside the prologue still use its gates.
- `chapterDone` and `openingMission` in `campaign.ts` decide unlocks and where a chapter opens: a newcomer on the prologue, a saved checkpoint on its mission, otherwise the next unfinished mission. Saves need no migration, because the prologue never counts towards unlocks.
- `Mission.ending.continue` runs straight into the next mission on black after the cards (the "Chapter 01 · Signal Lost" card, then the intro). On a replay, if the player has already finished that mission or holds a checkpoint in it, they go back to the campaign screen instead, and that checkpoint is untouched.
- The mission card has a Prologue / Signal Lost switch. The prologue shows its tips instead of an objectives list, and the `?mission=` dev link is gone.
- Browser checks, all with no page errors: new player through to i1 in the intro; an older save with Signal Lost finished (lands on Signal Lost, Chapter 2 open); a Signal Lost checkpoint surviving a prologue replay. New tests: `tests/unit/campaign.test.ts`. Scripts that start Signal Lost now pick it on the card, since a new profile opens on the prologue.

**Milestone 0, escape spike: passed. You played it after the rework and called it fair (30 October).**
- **First playtest (30 October):** "enemies just charge me", unreadable on every level. Measured with a hesitant bot: hunters appeared 7 m away, already 60% aware, sprinting and faster than Femi, and caught a first-time player at about 4 s with no warning. The first version was tuned against bots that never hesitate.
- **Mission:** `packages/shared/src/story/prologue.ts`. Six stages: off the road, through Unity Electricals' side door, under the flyover, across the junction, into Kola Printing Press, send the message. The direct line is only 36 m, so the 63 m route is a chain of gates. No new collision, so multiplayer is unchanged and `VERSION` stays `lagos-3`.
- **Fair-pursuit rules, all opt-in through `Mission.pursuit` (`Senses` in `ai.ts`):**
  - Nobody can notice anyone for the first 3 s of a session (`grace`), including after a retry.
  - Hunters are never faster than Femi: he moves at 72%, they move at 62%, 67% or 72% by difficulty.
  - On seeing him a hunter stops and shouts for 0.9 s (`windup`), then charges. Investigating is at a walk.
  - They give up 2.5 s after losing sight (`lose`), search for 4 s (`search`) and go back to their route. Shouts carry 11 m (`shout`).
  - The first grab can be shaken off except on Hard. Every group spawns whole; recorded barks stay off.
  - The opening has no charge: one sweeper (`sweep-a`) starts walking Femi's route after 9 s.
- **Warnings:** a ring fills over a hunter as it notices, an amber ? while it searches, a red ! when it has him, pinned to the edge of the view if it's off screen or behind (`alarms()` in `main.ts`). Hunters within 20 m show on the compass on every level. `noticed` and `spotted` are new synthesized cues.
- **General fix:** patrols now really pause 2.5 s at each stop. Before, a leg longer than 2.5 s meant no pause at all. This also applies to Signal Lost's patrols.
- **Bot results:** standing still is safe for at least 10 s on every level. A straight sprint finishes in about 16 s on Easy and Normal and is grabbed sending the message on Hard. A patient bot reaches the press on every level. Every grab comes after a marker and the shout (`tests/unit/pursuit.test.ts`).
- **Risk to check:** it may now be too easy for a sprinter on Normal. Fairness came first; tighten only after a playtest.
- `p24` is the hunter's shout, added after the plan's script, so the prologue has 24 lines.

## Still open
- Gameplay (non-cutscene) radio lines don't get the late-line retry; their length is fixed when they're queued. They're rarely affected, because by then every recording has decoded.
- The ~14° outro roll report is still unreproduced: measured roll is 0 on every outro and sky shot.
- Not checked on real phones: frame rate (the throttled desktop run held 60 fps), or how the new sound mix plays on phone speakers.
- Chapter 2's bridge map is still to build (see the handoff doc).

## Conventions
- Story content is data in `campaign.ts` and `chapter2.ts`. Line keys double as voice file names, so never rename existing keys. New lines get new keys. `clean` holds the clean wording, and its recording is named `<key>-clean`.
- After adding lines, run `npm run voice:script`.
- Positions use `P(x, z, y)` for the ground and `C(x, y, z)` for cameras.
- Tests live in `tests/unit/*.test.ts`. Add tests for any gameplay or physics change; do visual changes through the tour screenshots.
- Code style is dense TypeScript with short doc comments explaining *why*. Match the surrounding code.
