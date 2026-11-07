I'm continuing work on LAST BUS: LAGOS, a browser FPS in C:\Users\danie\Desktop\last bus\last-bus-lagos-main
(TypeScript, Vite + Babylon.js 9 client, Colyseus server, shared simulation package; not a git repo, so don't commit).

Read these first, in order:
1. docs/HANDOFF-2026-10-31.md — where things stand, how I work, the story canon, open decisions, the full plan for
   every remaining milestone, the tools and what will trip you up (start here)
2. docs/PROGRESS.md — how to run and verify, and the detail of everything built
3. docs/story-bible.md — creative direction
4. packages/shared/src/story/prologue.ts and campaign.ts — the prologue, Ada's opening (`checkpoint`) and Chapter 1
5. apps/client/src/audio.ts, apps/client/src/main.ts (syncWorld, startCinema, endCinema, the live flag),
   apps/client/src/cinema.ts and apps/client/src/settings.ts — what Milestone 3A touches

We are building The Passenger, a playable prologue before Chapter 1. Milestones 0, 1, 2 and 3 are done.
Start Milestone 3A (ambience and radio) now, following docs/HANDOFF-2026-10-31.md: crossfading ambience, the live
street mood, the soundtrack module with a licence-safe placeholder, the radio chain and cue, the "Licensed music"
setting, and the staged 18:40 collapse from ordinary Lagos into near silence.

Rules:
- Do not embed or redistribute copyrighted music. "Ojuelegba" stays out of the project until it's licensed; use the
  generated placeholder, and don't put lyrics on screen.
- Don't rename existing voice keys or touch my recordings in apps/client/src/voice/.
- Keep the story's mysteries intact: who paid for the jammer, what's on the drive, the witness list, whether the
  Sergeant is a traitor, and who received Femi's photo.
- Keep the build and all tests green after each milestone (npm run lint, npm test, npm run test:integration,
  npm run test:multiplayer, npm run build), and update docs/PROGRESS.md at the end of each one.
- Verify in the real game, not only in tests: run scripts/prologue-flow.mjs, scripts/audio-check.mjs and the tour
  (PLAYWRIGHT_CHROMIUM_EXECUTABLE="C:/Program Files/Google/Chrome/Application/chrome.exe"), and look at the results.
  You can't hear audio, so say plainly what you could only measure and what I need to check by ear.
- Keep it phone-friendly: 150–250 draw calls, 6–8 animated characters on screen, and no heavy audio decoding.
- Stop after each milestone, tell me what changed and what wasn't verified, and ask before starting the next one.

Start with a short plan for Milestone 3A, then implement it.
