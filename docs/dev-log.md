# Development log

## 12 October 2026

- Fixed the user-reported desktop menu clipping: menu content, map card and footer now share a responsive grid; heading size responds to viewport height and short windows allow scrolling. Modal widths/heights are bounded by their available viewport.
- Verified menu control visibility/reachability and settings scrolling in installed Microsoft Edge 155.0.4283.45 at seven viewport sizes, using scale factor 1.25. The user confirmed all lower menu options are now visible on a 1920×1080 display at 125% scaling. The original failure was reproduced at a shorter viewport, not at the exact effective resolution in headless Edge.
- Production build/typecheck passed. The existing browser smoke also passed using installed Edge: practice/fire/reload/sidearm, two-context public matchmaking, invitations, authoritative movement/ammo and same-tab link behavior; no browser errors. This is headless Edge automation, separate from the user's physical menu confirmation.
- Recorded a free-first friends playtest plan in playtest.md: Toronto plus two friends in Nigeria; three players suffice for a functional private trial, with a fourth PC player needed for 2-versus-2 balance. Render Free is recommended but no hosting or repository was provisioned.

## 10 October 2026

Preserved the brief and created the plan/checklist/handoff. Began implementation after the user's explicit instruction. Built the shared simulation, Colyseus rooms, Babylon arena and browser flows. Initial checks: 14 unit tests, three server tests and browser smoke. Paused at the user's request and stopped owned processes.

## 11 October 2026

- Fixed repeated ready messages resetting life/loadout; added pure and server regressions.
- Added shared movement/weapon prediction and immediate local shot feedback, with no repeated audiovisual side effects from replay or confirmations.
- Added positional remote footsteps, soft synthesized ambience, listener-relative stereo and bounded audio cleanup.
- Verified real-client damage/elimination/respawn, full four-minute match, results and rematch.
- Verified reconnect/expiry, abandonment, late join, host transfer and public capacity. Fixed leaving during a pending SDK retry; guarded discarded-room callbacks.
- Expanded to 19 passing unit tests for collision edges, combat protection, departed score rows and prediction replay.
- Expanded to eleven passing integration tests across three suites, including online sidearm behavior, origin/body/payload/rate boundaries, survival of other clients and congestion bursts. The final full suite passed.
- Measured actual TCP/WebSocket delay at added 0/80/150/250 ms RTT, with jitter and socket destruction/recovery. Retained current-state hitscan and documented its limitation.
- Completed a 30-minute, eight-client/eight-round soak without crash or rejected input. Saved tick/memory/traffic samples. Churn is a separate integration check.
- Verified the compiled production server and browser-fired combat through results/rematch. Traced a concurrent-browser disconnect to valid input bursts accumulating negative token debt and malformed-input penalties. Fixed overflow to drop valid packets without either penalty; the targeted burst regression and both concurrent suites passed.
- Extended the eight-player journey to two independent browsers and six SDK clients. Both browsers observed the winner/results, rematch reset and return to menu, without browser errors.
- Added a browser recovery check for preference persistence/corruption/clamping, graphics presets/resize, failed matchmaking and retry, invalid invitations, pointer-lock denial/retry, clearing controls on lock/focus loss and a real disabled-WebGL launch. All passed.
- Expanded public matchmaking to two browser contexts. This exposed same-tab invitation URLs being ignored after the initial page load. Added hash-change handling that opens the join dialog from the menu and preserves an existing active room with guidance. Build/typecheck, lint and the full expanded browser check passed after the fix.
- Added same-origin production hosting, Dockerfile, environment/proxy settings, readiness and rollback instructions. Docker runtime unavailable, so container execution is unverified.
- Replaced the unused tsup wrapper and its vulnerable older development esbuild with direct esbuild 0.28.2. Audit reported zero vulnerabilities. Fresh temporary install/build/lint/19-unit-test checks passed. Verification folders retained for inspection.
- Generated runtime dependency notices and wrote architecture/ADR, protocol, assets, compatibility, performance and deployment docs.

## Commands and limits

Used build, lint, unit/integration suites, multiplayer smoke/full-match, latency, soak, browser smoke/combat, clean-install verification, npm audit and cold-load scripts. Exact reproduction commands are in README.

Windows commands used bundled Node 24 without changing global Node. Local networking tests used the environment's normal approved elevated execution. One test launch was not executed because automatic approval review hit the usage limit; it was retried normally after the user continued and passed.

No public hosting, paid service, remote Git repository, commit, account system or persistent database was created. Public/device/human gates remain explicit. Reports in ignored artifacts preserve their own timestamps/build identity.

The user chose to finish the local build first; public hosting is deferred. Latest clean-install evidence is retained at `C:\Users\tbnco\AppData\Local\Temp\lastbus-clean-TWkSa0` (install, build/typecheck, lint, 19 unit tests, zero reported audit vulnerabilities). The 30-minute soak was collected before the final input-limiter change; no second full soak is claimed.

## 13 October 2026 — Nigeria-first Android touch alpha

The user's priority changed from desktop-first testing to Nigerian mobile users, Android first. Added touch controls, landscape guard, pause/capture cleanup, input-mode setting, Low default on coarse pointers, and compact HUD/safe-area layout. Reused the existing authoritative input protocol. Fixed a quick-tap fire bug: a down/up inside one simulation tick now emits one fire pulse, needed because the server derives sidearm trigger edges from fire. Cancelled gestures do not emit that pulse.

28 unit tests passed outside the Windows sandbox; sandbox runs had temporary generated-module ENOENT failures, not assertion failures in the final version. Build and unused-symbol checks are required on the final tree. Live Edge touch-mode layout, pistol firing/reload, scores/pause and portrait guard were exercised. Physical Android/iPhone and Nigerian latency remain unverified. See mobile.md.

Created private GitHub repository Qudios/last-bus-lagos. Added a Free/Frankfurt Render blueprint with one Node process and manual deployments. Repository upload, GitHub-to-Render access, hosting and live HTTPS/WSS verification are tracked in RESUME.md; do not infer deployment from the blueprint.

Final local checks on 13 October: build, strict unused-symbol check and all 28 unit tests pass. The user will handle routine Render dashboard configuration to conserve assistant usage; hosting remains pending until a URL is supplied and verified.


## 28 October 2026 — 0.2 upgrade: Story Mode, Police vs Bandits, rebuilt presentation

Protocol bumped to `lagos-2` (new input fields, snapshot fields and map geometry).

- **Rules (shared):** teams renamed Police (0) and Bandits (1); winners are `POLICE` / `BANDITS`. Added crouch (1.2 m body, cannot stand under low ceilings), aim-down-sights movement and spread, reduced air control, separate deceleration and a 0.45 m step-up for kerbs and stairs. Weapons gained designed recoil patterns with recovery, deterministic per-shot spread shared by prediction and server, damage falloff and head hits. Story options add no auto-respawn, health regeneration and difficulty damage scaling. Private hosts can set duration and kill limit from fixed lists, and players can switch teams while waiting; both are validated server-side.
- **Map:** Ojuelegba Junction rebuilt at 80 × 64 m. The south half is authored, and the north half is rotated with its own names and dressing. It has a flyover with pillars, kerbed pavements, two walk-through shops, a stair-and-balcony overlook on each side, a mechanic yard and a Signal 9 telecom yard, plazas with a police checkpoint and a danfo park, real building and fence boundaries, and trees with collision. Visuals are built from the same boxes.
- **Rendering:** procedural tileable textures with normal maps; static geometry batched per material; one 4096² sign atlas; dusk lighting; a shadow map baked once from static casters; ACES tone mapping, FXAA and bloom; a sky dome; ambient animation. Characters are articulated, vertex-coloured rigs with procedural gait, strafe, crouch, aim, reload, flinch and death, and distinct Police, Bandit (red scarf) and civilian looks. The first-person arms are attached to the weapon, with ADS, sprint, equip and reload choreography and spring recoil. Pooled tracers, impacts, decals and brass.
- **Audio:** fully synthesized, on five buses with HRTF spatialization, layered weapon, reload, footstep, confirmation and radio sounds, and layered dusk ambience.
- **Story:** nav grid with A* and cover points; enemy agent states; line-of-sight-only perception, hearing and ally alerts; reaction delays and settling aim error; burst fire. Mission data drives objectives, encounters, checkpoints, dialogue and an escorted NPC. Retrying rebuilds the session from the checkpoint.
- **UI:** new menu, story, multiplayer, training and tabbed settings screens, briefing, loading, lobby slots, mode-aware pause with confirmations, mission-end and match results. The HUD has a compass, objective marker, dynamic crosshair, hit markers, damage direction, prompts and subtitles.

Checks run: typecheck and strict unused-symbol lint; 47 unit tests including a scripted run of the whole mission; 11 integration tests; the two-client multiplayer smoke; the browser e2e on the dev build (six scenarios, zero console errors); the browser combat test on the production build (six assertions, zero errors; the first attempt failed and an immediate re-run passed, so it may be timing-sensitive). Headless Chrome on the development PC ran story with 19 actors at a median 16.6 ms and p95 22 ms per frame. Not run this pass: latency profiles, the 30-minute soak, `test:browser-recovery` (still written for the 0.1 settings layout), Docker, real Android or iPhone hardware, and internet multiplayer.

## 28 October 2026 — playtest fixes: invisible enemies, cutscenes, voice

- **Fixed:** enemies and other players could render as empty air. `Character.dispose()` freed materials, and every character shares one body material, so the first removed actor (a body cleaned up after 8 s, a retry, or leaving training) destroyed it for everyone. Disposal now frees only the actor's own name tag. This also affected multiplayer whenever a player left. Verified headlessly: enemies spawned after earlier bodies were cleaned up are visible.
- **Cutscenes:** mission data declares camera shots (from, to, look, lookTo, seconds, line, fov), and objectives trigger them through a `cutscene` action. The client letterboxes the screen, hides the HUD, shows the player's own body and does not step the session while a cutscene plays. Hold Space, or press Enter or Esc, to skip. Checkpoint retries skip cutscenes that would repeat. Femi stays seated until he first walks.
- **Voice:** lines have stable keys, and enemy call-outs now have keys too. MP3s in `apps/client/src/voice/` are bundled with `import.meta.glob`, so missing files never cause requests. Subtitles stay up for the length of the recording. CONTROL lines go through a handset-style radio filter. `npm run voice:script` generates `docs/voice-script.md`. Decoding a real recording has not been tested (no audio encoder on the development PC); an invalid file falls back to subtitles with a warning.
