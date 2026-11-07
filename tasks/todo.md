# LAST BUS: LAGOS — Sol 6.1 task checklist

Status: core implementation and substantial local verification completed on 11 October 2026. Read docs/release-verification.md for passing evidence, limitations and external release gates. Checked criteria have local evidence; unchecked criteria are not automatically missing implementation. Public deployment, physical-device/human validation and remaining QA are still open.

48 of 60 per-task acceptance criteria have evidence; checkpoint boxes are separate. This is a checklist count, not an estimate that 80% of the effort is complete. The user chose to finish the local build first and defer public hosting.

For every task: run the relevant focused checks plus typecheck/build when executable code changes, inspect affected runtime behavior, and record evidence in `docs/dev-log.md`. Run lint once configured. Commands below must first be established in T01–T03; do not report them as existing or passing during planning. Aim for 1–5 primary files per task; split further if needed. No implementation-time estimate is a delivery promise.

## M0 — Establish the workspace

### T01 — Pin the toolchain

**Description:** Reinspect the repository and establish the smallest reproducible npm workspace. Record package versions, Node requirements, maintenance/license checks, and why this combination was chosen.

**Acceptance criteria:**
- [x] Workspace contains only needed setup files and one lockfile; selected packages have compatible runtime/peer requirements.
- [x] Clean install and root typecheck/build entry points work; no secrets or unused scaffolding are added.

**Verification:** Inspect registry metadata and official versioned docs; perform clean install and initial build/typecheck. Record exact versions and output.

**Dependencies:** None. **Scope:** M, configuration only.

**Likely files:** root `package.json`, `package-lock.json`, base TypeScript configuration, workspace package manifests, `docs/compatibility.md`. Treat repeated minimal manifests as setup; subdivide if substantial configuration is needed.

### T02 — Render the browser scene

**Description:** Bootstrap Babylon.js through Vite and expose an actual ground plane, camera, and capability/error display.

**Acceptance criteria:**
- [x] Browser renders the scene from the dev command and production build.
- [ ] Resize and renderer disposal work; unsupported WebGL2 produces an actionable message.

**Verification:** Run client build, open rendered scene, resize viewport, inspect console; exercise capability failure.

**Dependencies:** T01. **Scope:** M.

**Likely files:** `apps/client/index.html`, `vite.config.ts`, `src/main.ts`, `src/game/createScene.ts`, `src/styles.css`.

### T03 — Prove a server connection

**Description:** Start a Colyseus server and connect two independent SDK clients to one minimal room. Establish test/dev scripts and protocol-version handling.

**Acceptance criteria:**
- [x] Two independent connections observe the same server-generated state; incompatible protocol is rejected.
- [x] Root dev command starts both processes; production server starts and exposes a health check.

**Verification:** Run an actual two-client integration smoke test, client/server production builds, and health request. Record the chosen schema/SDK APIs.

**Dependencies:** T01–T02. **Scope:** M.

**Likely files:** `apps/server/src/index.ts`, `src/rooms/GameRoom.ts`, `packages/shared/src/protocol.ts`, `tests/integration/connection.test.ts`, root scripts.

### Checkpoint C0 — Architecture works

- [x] T01–T03 evidence recorded; installed renderer and networking packages work together.
- [x] Build/typecheck pass and independent connections are demonstrated.
- [x] No framework switch without a concrete failure and recorded replacement decision.

## M1 — A locally playable FPS

### T04 — Establish shared collision

**Description:** Describe a tiny test range as static collision boxes and implement the pure swept player-box solver.

**Acceptance criteria:**
- [x] Floors, walls, corners, ceilings, and arena bounds prevent penetration at sprint speed.
- [x] Client visuals use the same level data as collision; valid spawn placement is checked.

**Verification:** Focused solver tests for corner slide, thin wall, floor/ceiling contact and overlap recovery; inspect rendered collider alignment.

**Dependencies:** T02. **Scope:** M.

**Likely files:** `packages/shared/src/world/level.ts`, `world/collision.ts`, `world/collision.test.ts`, `apps/client/src/world/buildLevel.ts`.

### T05 — Move and aim

**Description:** Connect keyboard/pointer input, fixed-step movement, and first-person camera to the range.

**Acceptance criteria:**
- [x] Walk/sprint/jump/gravity, acceleration/braking, mouse-look and sensitivity work; diagonal input is normalized.
- [ ] Fixed-duration movement remains consistent at 30/60/144 rendering FPS; focus/pointer-lock loss clears controls.

**Verification:** Replay identical inputs in movement tests; manually inspect aiming, jump, collision, Escape and pointer-lock retry.

**Dependencies:** T04. **Scope:** M.

**Likely files:** shared `simulation/movement.ts`, `movement.test.ts`, client `input/InputController.ts`, `game/PlayerController.ts`, `game/CameraController.ts`.

### T06 — Shoot the local range

**Description:** Add the rifle, shared weapon rules, world-obstructed ray hits on target dummies, and minimal combat feedback.

**Acceptance criteria:**
- [x] Rifle obeys fire cadence, ammo and reload rules; walls block target hits; targets lose health and can be reset.
- [x] Crosshair, ammo, muzzle/recoil and hit/elimination feedback make the range playable; local-only mode is clearly labeled.

**Verification:** Weapon/raycast tests for empty magazine, wall obstruction, cooldown and reload; manually play the range.

**Dependencies:** T05. **Scope:** M.

**Likely files:** shared `config/weapons.ts`, `simulation/weapons.ts`, `simulation/weapons.test.ts`, client `game/LocalRange.ts`, `ui/CombatHud.ts`.

### Checkpoint C1 — First playable deliverable

- [x] T04–T06 build and focused tests pass; actual FPS camera, movement, collision and firing have been inspected.
- [x] A new developer can launch and play the range from documented commands.
- [ ] No polished landing page or art expansion precedes the multiplayer milestone.

## M2 — Real multiplayer

### T07 — Move through the server

**Description:** Replace local range authority with server-owned player simulation using the shared world and bounded input contract.

**Acceptance criteria:**
- [x] Two independent browsers join one room and see server-owned player transforms.
- [x] Teleport/invalid-number inputs and input floods cannot increase movement speed; gravity continues without input.

**Verification:** Actual-server integration tests for input validation, queue limits and movement rate; two-browser movement check.

**Dependencies:** T03, T05. **Scope:** M.

**Likely files:** shared `protocol.ts`, server `rooms/GameRoom.ts`, `simulation/players.ts`, client `network/GameConnection.ts`, `tests/integration/movement.test.ts`.

### T08 — Predict and reconcile movement

**Description:** Use one verified prediction path for the local player and snapshot interpolation for remote players.

**Acceptance criteria:**
- [x] Local movement responds immediately and reconciles using acknowledged full movement state plus remaining inputs.
- [x] Remote motion interpolates; respawns/life changes reset buffers; stalls cannot produce unbounded extrapolation.

**Verification:** Replay/reconciliation tests and instrumented 80/150 ms RTT sessions; capture correction distance and confirm no repeated side effects.

**Dependencies:** T07. **Scope:** M.

**Likely files:** client `network/Prediction.ts`, `network/Interpolation.ts`, `game/PlayerController.ts`, server player schema, `tests/integration/prediction.test.ts`.

### T09 — Validate multiplayer shots

**Description:** Route rifle fire intent through authoritative ammo/cooldown and nearest-obstruction hit resolution.

**Acceptance criteria:**
- [x] Health, accepted shot, ammo and damage come from the server; hit markers require confirmation.
- [x] Duplicate/stale/invalid shots, blocked rays, firing while dead/reloading, and cooldown bypasses are rejected.

**Verification:** Integration tests using adversarial SDK messages; two browsers hit and miss moving players, including behind cover.

**Dependencies:** T06, T08. **Scope:** M.

**Likely files:** shared `simulation/raycast.ts`, server `simulation/combat.ts`, client `game/WeaponPresenter.ts`, `ui/CombatHud.ts`, `tests/integration/combat.test.ts`.

### Checkpoint C2a — Multiplayer authority

- [x] T07–T09 pass under local and controlled latency conditions.
- [x] Evidence shows two actual connections, server-owned movement, wall occlusion, and validated damage.
- [ ] Remaining reconciliation/hit-registration problems are reproduced before adding content.

### T10 — Eliminate and respawn

**Description:** Assign balanced teams and implement one-time elimination, scoring, life IDs and safe respawn.

**Acceptance criteria:**
- [x] Death grants one elimination/team point, disables actions and respawns after the configured delay with reset loadout.
- [x] Friendly fire, spawn protection, dead inputs and previous-life actions follow the plan; scores agree across clients.

**Verification:** Duplicate lethal-hit, stale-life, protected-spawn, friendly-fire and respawn integration tests; two-browser repeat kills.

**Dependencies:** T09. **Scope:** M.

**Likely files:** server `simulation/lifecycle.ts`, `simulation/teams.ts`, player schema, client `game/PlayerPresenter.ts`, `tests/integration/respawn.test.ts`.

### T11 — Add the sidearm

**Description:** Introduce the second weapon with authoritative switching, semi-auto trigger edges, independent ammo and distinct feedback.

**Acceptance criteria:**
- [x] Both weapons are usable and meaningfully different; holding sidearm fire cannot become automatic.
- [x] Switching/reloading/death cannot create ammo, bypass cooldown or replay a shot; fast sidearm equip is apparent.

**Verification:** Shared weapon and server action tests, held-trigger/release cases, repeated switching/reload cancellation; manual feel/audio check.

**Dependencies:** T10. **Scope:** M.

**Likely files:** shared weapon definitions/rules/tests, server `simulation/combat.ts`, client `game/WeaponPresenter.ts`.

### T12 — Establish the latency policy

**Description:** Measure current-state hit registration and decide whether the documented bounded rewind path is needed.

**Acceptance criteria:**
- [x] Repeatable moving-target results exist for local/80/150/250 ms RTT; selected policy and limitations are documented.
- [x] If enabled, rewind is capped and tested against future timestamps, wall shots, respawn boundaries and invalid history; otherwise its flag stays off.

**Verification:** Real-server latency scenarios with measured RTT; regression tests for selected hit strategy. Do not label HTTP throttling as WebSocket impairment without proof.

**Dependencies:** T10–T11. **Scope:** M.

**Likely files:** server `simulation/hitHistory.ts` if needed, `simulation/combat.ts`, `tests/integration/latency.test.ts`, `docs/networking.md`.

### Checkpoint C2b — Playable network combat

- [ ] T10–T12 validated with two independent browsers and both weapons.
- [x] Client cannot award health/ammo/kills; elimination, respawn and team scores converge.
- [x] Latency policy is explicit; critical rubber-banding and hit errors are resolved or block this gate.

## M3 — One complete match

### T13 — Run the match state machine

**Description:** Implement waiting, countdown, active, results and next-round transitions on server time.

**Acceptance criteria:**
- [x] Configured player thresholds, duration and kill limit drive phases; actions outside active play are rejected.
- [x] Countdown cancellation, timer draw, stable lethal-shot order and abandoned-team behavior follow the plan.

**Verification:** Fake-clock state-machine tests plus actual-server short-match scenarios; run one full-duration match.

**Dependencies:** T10. **Scope:** M.

**Likely files:** shared `config/match.ts`, server `simulation/match.ts`, `rooms/GameRoom.ts`, match schema, `tests/integration/match.test.ts`.

### T14 — Present live match state

**Description:** Add scores, timer, kill feed, announcements and a Tab scoreboard from authoritative data.

**Acceptance criteria:**
- [x] HUD and scoreboard accurately show both teams, kills/deaths and measured ping where available.
- [x] Joining mid-match reconstructs current phase and scores without duplicating old transient events.

**Verification:** Compare both browser displays with server state across kill, respawn, late join and timer expiry; inspect HUD at multiple viewport sizes.

**Dependencies:** T13. **Scope:** M.

**Likely files:** client `ui/MatchHud.ts`, `ui/Scoreboard.ts`, `ui/KillFeed.ts`, `network/GameConnection.ts`, HUD styles.

### T15 — Finish and rematch

**Description:** Freeze accurate round results and implement another round or safe return to the menu.

**Acceptance criteria:**
- [x] Results show the actual winner/draw/abandonment and final leaderboard; late events cannot alter it.
- [x] Rematch resets scores, lives, ammo, timers and event buffers without creating another connection or leaking listeners.

**Verification:** Three consecutive matches including score win and time win/draw; compare results across clients and verify complete reset.

**Dependencies:** T14. **Scope:** M.

**Likely files:** server `simulation/match.ts`, client `ui/ResultsScreen.ts`, `ui/AppState.ts`, `tests/integration/rematch.test.ts`.

### Checkpoint C3 — Complete gameplay loop

- [x] T13–T15 pass from waiting to results and into the next round.
- [x] A full four-minute match and early score-limit ending are verified.
- [x] Departures, late joins and ties have explicit tested outcomes.

## M4 — Ojuelegba Junction

### T16 — Build a balanced arena blockout

**Description:** Replace the test range with compact three-route combat geometry and team spawn candidates.

**Acceptance criteria:**
- [ ] Both spawn zones have exits; routes, flanks and cover avoid direct spawn-to-spawn sightlines and inaccessible areas.
- [ ] Shared map version/collision agrees on server and client; safe spawn selection handles occupied/exposed candidates.

**Verification:** Collision/spawn tests, full route traversal, two-team cover/visibility inspection and timed encounters.

**Dependencies:** T04, T15. **Scope:** M.

**Likely files:** shared `world/ojuelegba.ts`, server `simulation/spawns.ts`, client `world/buildLevel.ts`, `tests/integration/spawns.test.ts`, `docs/map.md`.

### T17 — Add Lagos visual identity

**Description:** Build reusable original storefront, market and danfo-inspired props, materials and lighting around validated cover.

**Acceptance criteria:**
- [x] Map reads as a fictional Lagos-inspired arena with original signs, cohesive colors and recognizable landmarks.
- [x] Collision-relevant cover remains readable; assets are local, attributed and licensed/original.

**Verification:** Capture gameplay views from all routes/spawns, inspect cover and team silhouettes, review asset register and measured draw calls.

**Dependencies:** T16. **Scope:** M; split prop groups if necessary.

**Likely files:** client `world/PropFactory.ts`, `world/Materials.ts`, `world/Lighting.ts`, local asset manifest, `docs/assets.md`.

### T18 — Complete gameplay audio

**Description:** Finish positional weapon/footstep/respawn sounds, UI/match cues and subtle ambience with bounded source use.

**Acceptance criteria:**
- [ ] Required cues play at appropriate distance and volume with distinguishable weapons and no duplicate predicted/confirmed sound.
- [x] Audio starts after a user gesture, respects volume, and releases sources on exit.

**Verification:** Two-player listening tests at near/far positions, volume/mute/rejoin checks, and asset license review.

**Dependencies:** T11, T17. **Scope:** M.

**Likely files:** client `audio/AudioManager.ts`, `audio/SoundLibrary.ts`, gameplay presentation hooks, local sound assets, `docs/assets.md`.

### Checkpoint C4 — Arena quality

- [ ] T16–T18 preserve combat/collision and visual performance.
- [ ] Routes, spawns, teams and audio cues are readable in actual gameplay.
- [ ] Schedule the human 4–8-player balance session for release verification; do not invent playtest feedback.

## M5 — Complete product flow

### T19 — Deliver public quick play

**Description:** Add guest nickname entry and Play that joins or creates a compatible public room.

**Acceptance criteria:**
- [x] A guest can reach a waiting/active room through Play with real occupancy and balanced assignment.
- [x] Capacity races, no available rooms and version mismatch produce safe bounded retries or understandable errors.

**Verification:** Concurrent joins with independent SDK clients; browser menu-to-game flow; full-room test with a ninth client.

**Dependencies:** T15. **Scope:** M.

**Likely files:** server `matchmaking.ts`, `rooms/GameRoom.ts`, client `ui/MainMenu.ts`, `network/GameConnection.ts`, `tests/integration/matchmaking.test.ts`.

### T20 — Deliver private invitations

**Description:** Create unlisted guest rooms, copy invitation links, accept codes/links and expose host start controls.

**Acceptance criteria:**
- [x] Independent clients join the same private room using its generated token; it is absent from public discovery.
- [x] Invalid/full/expired invites and host departure are handled; only eligible host actions start a private round.

**Verification:** Copy/paste URL between independent browsers; invitation lookup limits, host transfer and start-authorization integration tests.

**Dependencies:** T19. **Scope:** M.

**Likely files:** server `invitations.ts`, `rooms/GameRoom.ts`, client `ui/Lobby.ts`, `network/roomLinks.ts`, `tests/integration/privateRooms.test.ts`.

### T21 — Recover connection failures

**Description:** Implement bounded in-memory reconnect, seat reservation, stale-input clearing and retry/menu recovery.

**Acceptance criteria:**
- [x] Drop/reconnect within the grace period preserves authoritative life/score without duplicate players or healing.
- [ ] Expiry, refresh, voluntary leave and server restart follow the plan, release resources and leave usable UI.

**Verification:** Disconnect during movement, reload, death and results; restart server; refresh full room; inspect seat/listener cleanup and no stuck controls.

**Dependencies:** T20. **Scope:** M.

**Likely files:** server `rooms/GameRoom.ts`, client `network/GameConnection.ts`, `ui/ConnectionStatus.ts`, `ui/AppState.ts`, `tests/integration/reconnect.test.ts`.

### Checkpoint C5a — Join, share, recover

- [ ] T19–T21 flow works across independent clients without fake server state.
- [x] Invitations stay out of public listing/logs; room capacity and host authority are tested.
- [ ] Failures always reach retry, waiting or menu states within a bounded time.

### T22 — Persist usable settings

**Description:** Add sensitivity, volume, graphics presets, documented controls and pause/settings behavior.

**Acceptance criteria:**
- [x] Preferences persist, malformed values fall back safely and no credentials enter browser storage.
- [x] Pointer-lock loss pauses input only; presets preserve gameplay cover and collision; keyboard controls are documented.

**Verification:** Change/reload settings, corrupt preference values, lose focus/lock during firing, and inspect all quality presets.

**Dependencies:** T18, T21. **Scope:** M.

**Likely files:** client `settings/SettingsStore.ts`, `ui/SettingsScreen.ts`, `game/QualityPresets.ts`, input/audio hooks, settings styles.

### T23 — Finish presentation states

**Description:** Apply one visual system to menu, lobby, loading, HUD, errors and results using the actual game environment as background.

**Acceptance criteria:**
- [ ] Every required screen has a functioning next action, focus state and clear feedback; no dead decorative buttons.
- [x] Loading reflects actual stages/known asset progress; menu and overlays remain readable at common desktop sizes.

**Verification:** Walk every application state including slow load, pointer denial, unsupported renderer and unavailable server; inspect screenshots and keyboard navigation.

**Dependencies:** T22. **Scope:** M; split independent screen groups if needed.

**Likely files:** client `ui/AppState.ts`, `ui/MainMenu.ts`, `ui/LoadingScreen.ts`, `styles.css`, `ui/ResultsScreen.ts`.

### T24 — Automate the complete user journey

**Description:** Create repeatable browser checks for Play and invitation entry through results/rematch, including failure recovery.

**Acceptance criteria:**
- [x] Two independent browser contexts traverse public/private joining and complete a real server-driven match flow.
- [x] Console/network failures are captured; pointer-lock/manual limitations are documented without shipping a test backdoor.

**Verification:** Run `npm run test:e2e`; manually cover aim/lock/audio where automation cannot; save failure artifacts and successful evidence.

**Dependencies:** T23. **Scope:** M.

**Likely files:** `playwright.config.ts`, `tests/e2e/roomFlow.spec.ts`, `tests/e2e/recovery.spec.ts`, test harness, `docs/testing.md`.

### Checkpoint C5b — Complete product

- [ ] T22–T24 pass; open → Play/create → share/join → match → results → rematch works.
- [x] Required controls, settings, status and error paths are inspected in the rendered product.
- [x] No unresolved critical console, control or network errors.

## M6 — Stabilize and prepare release

### T25 — Harden untrusted boundaries

**Description:** Exercise and fix malformed gameplay/room messages, payload floods, name rendering and version/access boundaries.

**Acceptance criteria:**
- [x] Invalid numbers, spoofed stats, duplicated action IDs, oversized payloads and illegal transitions cannot mutate authority or crash a room.
- [x] Invite/origin/rate/connection restrictions are enforced; public logs and client builds contain no secrets.

**Verification:** Actual-server malicious-client tests and transport-limit scenarios; review rendered nickname escaping and redacted logs.

**Dependencies:** T24. **Scope:** M; patch affected boundaries in separate focused changes if broad.

**Likely files:** shared protocol validator, server connection guards, room validation hooks, `tests/integration/abuse.test.ts`, `docs/security.md`.

### T26 — Exercise multiplayer and browsers

**Description:** Run capacity, long-lived matches, disconnect churn, network profiles and supported-browser verification.

**Acceptance criteria:**
- [ ] Eight independent clients sustain matches; the ninth is rejected gracefully; 30-minute soak shows no leaked rooms or divergent scores.
- [ ] Chrome/Edge/Firefox results and human 4–8-player map feedback are recorded honestly, including unavailable checks.

**Verification:** `npm run test:multiplayer`, network shaping evidence, manual browser/input/audio checks and a human playtest; preserve hardware/session details.

**Dependencies:** T25. **Scope:** M, test/evidence work.

**Likely files:** `tests/multiplayer/smoke.ts`, `tests/multiplayer/soak.ts`, `docs/testing.md`, `docs/playtest.md`.

### T27 — Measure and fix bottlenecks

**Description:** Profile the actual game against the plan's rendering/load/server/network budgets and fix the highest-impact problems.

**Acceptance criteria:**
- [x] Repeatable report includes cold load, compressed transfer, frame-time percentiles, tick work, traffic and memory trend on identified hardware.
- [x] Measured regressions are addressed; remaining target misses are explicit, with matching before/after conditions.

**Verification:** Profile full-room combat and cold load at both connection speeds; rerun only affected checks after optimization, then the release smoke.

**Dependencies:** T26. **Scope:** M per bottleneck; split fixes as needed.

**Likely files:** `docs/performance.md`, a small measurement harness, and up to three measured hot spots in rendering/networking.

### Checkpoint C6a — Stable candidate

- [ ] T25–T27 pass applicable gates; critical failures fixed and relevant checks rerun.
- [x] Real measurements distinguish hardware/latency limits from defects.
- [x] Missing human/device evidence stays unchecked and visible.

### T28 — Package the production build

**Description:** Prepare the static build, persistent server container, environment examples, health/readiness and deployment/rollback instructions.

**Acceptance criteria:**
- [ ] A clean local production build/container serves multiplayer using documented configuration; no implicit production localhost endpoint.
- [x] Environment, HTTPS/WSS upgrades/timeouts, shutdown, origin rules and paired client/server rollback are documented.

**Verification:** Clean production build/start, health and WebSocket tests, container restart and shutdown checks; inspect frontend configuration for secrets.

**Dependencies:** T27. **Scope:** M.

**Likely files:** `apps/server/Dockerfile`, environment examples, production scripts/configuration, `docs/deployment.md`, server health/shutdown hooks.

### T29 — Verify online deployment

**Description:** Deploy the completed candidate to authorized static and persistent-server hosting and verify real online play.

**Acceptance criteria:**
- [ ] Public HTTPS client connects to the actual WSS server; private URL works on two physical devices through a complete match/rematch.
- [ ] Restart recovery, health visibility and measured intended-player latency are recorded with actual deployed URLs and versions.

**Verification:** Production two-device match, restart/rejoin and region-latency checks. If hosting credentials/budget or devices are unavailable, mark this task blocked with the specific missing input; never substitute localhost evidence.

**Dependencies:** T28; authorized deployment destination and access, approval for any new paid provisioning, two devices.

**Scope:** M, operations and evidence.

**Likely files:** selected host configuration, `docs/deployment.md`, `docs/release-verification.md`.

### T30 — Finish the developer handoff

**Description:** Verify reproducible setup, reconcile task/source-brief requirements and report the tested release honestly.

**Acceptance criteria:**
- [x] README covers development/build/server/test commands, controls, configuration and deployment; architectural decisions and assets are documented.
- [x] Source definition of done is mapped to evidence; remaining blockers/limitations are explicit and no unrun test is marked passed.

**Verification:** Follow setup from a clean checkout/install; run build/typecheck/lint, applicable unit/integration/e2e/multiplayer suites, and verify the release evidence matches the actual build.

**Dependencies:** T28; final release sign-off additionally requires T29 and all critical test evidence.

**Scope:** M.

**Likely files:** `README.md`, `docs/architecture.md`, `docs/release-verification.md`, `docs/dev-log.md`, this checklist.

### Checkpoint C6b — Release definition of done

- [ ] All critical criteria in the source brief and plan have evidence.
- [ ] Real production multiplayer, both weapons, room sharing, complete matches and rematches work on tested browsers/devices.
- [ ] Build/checks pass, performance is measured, setup is reproducible and no critical errors remain.
- [x] Final report separates completed functionality, tests actually run, online URLs, measured limits and outstanding issues.
- [x] Any unavailable external validation remains an explicit release blocker, never a fabricated completion.
