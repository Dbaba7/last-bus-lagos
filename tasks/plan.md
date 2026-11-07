# LAST BUS: LAGOS — implementation plan for Sol 6.1

Prepared 10 October 2026. Original planning artifact. Implementation was subsequently authorized, paused, and resumed; the local prototype is now implemented with substantial test evidence. See `docs/RESUME.md` for the current state and evidence; the historical starting assessment below describes the planning session.

## 1. Starting point and instructions

The workspace is an empty Git repository on `master`, with no commits, application files, package manifests, or existing tests. No applicable `AGENTS.md` was found in the workspace or its ancestor directories. Preserve this assessment as a starting observation; inspect again when implementation begins.

The founder's immediate request is to plan without implementing. This overrides the attached master prompt's instructions to begin coding immediately. This plan is a future implementation handoff, not authorization to start now.

Read these files together:

- `tasks/source-brief.txt`: the original supplied product brief, preserved verbatim.
- `tasks/plan.md`: architecture, gameplay decisions, milestones, risks, and release criteria.
- `tasks/todo.md`: ordered work items with dependencies and verification.
- `tasks/sol-6.1-handoff.md`: instructions the founder can give Sol 6.1 when ready to implement.

The first implementation deliverable is a locally playable first-person shooting range. The next is two independent clients moving, shooting, taking damage, and respawning through an authoritative server. A local range is a development milestone, never evidence of completed multiplayer.

## 2. Release scope

Ship one desktop-browser FPS prototype: STREET WARS Team Deathmatch, one fictional Lagos-inspired arena called Ojuelegba Junction, two weapons, guest nicknames, 4–8 players, public quick play, private invitations, HUD, scoreboard, results, and rematches. Chrome and Edge are primary; Firefox is included in compatibility testing. Keyboard and mouse are required.

The simple leaderboard is the real match scoreboard and final results, sorted by eliminations, then fewer deaths, then stable player ID. Persistent global rankings are deferred alongside accounts, progression, monetization, cosmetics, bots, additional maps, shotgun, mobile controls, vehicles, advanced movement, and battle royale. Do not fabricate players, scores, loading percentages, or network activity.

### Initial configurable rules

These are proposed tuning defaults, not playtested balance claims. Centralize and validate them; the server supplies the effective configuration to clients.

| Setting | Initial decision |
|---|---|
| Capacity | 8 total, at most 4 per team |
| Public start threshold | 4 connected, loaded players with both teams represented |
| Private start threshold | Host may start with 2 loaded players on opposing teams; target experience remains 4–8 |
| Duration / score limit | 240 seconds / 30 team eliminations |
| Countdown / results | 5 seconds / at least 10 seconds before next round |
| Respawn | 3 seconds; 1 second protection, removed on firing |
| Health / friendly fire | 100 health; friendly fire disabled; teammates block shots but take no damage |
| Walk / sprint / jump | 5 m/s / 7.5 m/s / 6 m/s initial vertical velocity; gravity 18 m/s² |
| Standing body | Upright collision box, approximately 0.7 m wide and 1.8 m high; eye height 1.6 m |
| Rifle | Automatic, 25 damage, 600 rounds/minute, 30-round magazine, 90 reserve, 1.8-second reload, 0.35-second equip |
| Sidearm | Semi-automatic, 34 damage, maximum 300 rounds/minute, 12-round magazine, 48 reserve, 1.2-second reload, 0.2-second equip |
| Damage model | Body hits only initially; hitscan with finite range; no penetration, headshots, or damage falloff |
| Input / simulation / snapshots | 30 input frames/second; 30 fixed simulation ticks/second with two movement substeps; 20 snapshots/second |
| Interpolation | Start with a 100 ms remote-player buffer; measure before tuning |
| Reconnect / stale input | 15-second reconnect window; clear held actions after 150 ms without fresh input |

Reload consumes available reserve at completion; switching cancels reload without granting ammunition. Switching cannot reset a weapon's fire cooldown. Death cancels pending actions. Respawn resets both weapons and health. Sprint disables shooting; requesting fire exits sprint. Jump requires grounded state and a new press. Holding sidearm fire generates one shot until release and another press. Rifle recoil is stronger than sidearm recoil and is applied consistently to the server shot direction and local feedback.

### Match and room edge cases

- Server phases: `WAITING → COUNTDOWN → ACTIVE → RESULTS → WAITING`. Only the server transitions phases. Cancel countdown if eligible players fall below the threshold.
- Public teams are balanced on entry. Private host starts the match but cannot override damage, scores, or capacity. Transfer host to the longest-connected eligible member when necessary.
- Late joiners during `ACTIVE` join the smaller team and spawn after loading. Capacity includes temporarily reserved reconnect seats. Joining during `RESULTS` waits for the next round.
- Team membership remains stable during a match. No mid-match auto-transfer. If a team has no connected players for 15 seconds, end the match as abandoned; do not invent score or award an unearned win.
- Resolve accepted shots in a documented stable order within a tick. End immediately when the kill limit is reached. At time expiry, the higher score wins; equal scores produce a draw. No overtime.
- Results are an immutable snapshot of the finished round. Public rooms start another countdown after results when enough loaded players remain. Private rooms return to host-controlled waiting. Leaving results returns the individual to the main menu safely.
- Voluntary leave releases the slot. A dropped connection reserves its slot for 15 seconds, clears input, and leaves a vulnerable body until death or expiry; it cannot shoot. Reconnect retains the existing score and life/death state. No disconnect-based healing or invulnerability.
- Keep reconnect credentials in memory only. Refresh starts a fresh guest connection after the old seat is released; explain the temporary reservation if the room is full. Do not promise identity continuity across reloads or server restarts.
- Escape, focus loss, and pointer-lock loss clear input immediately. The settings overlay does not pause the online match or protect the player.

## 3. Architecture and compatibility gate

Use TypeScript, Babylon.js, Vite, Node.js, and Colyseus unless the initial compatibility spike demonstrates a specific blocker. Prefer npm workspaces and a single lockfile. Use ordinary HTML/CSS with small TypeScript UI controllers; a separate UI framework is unnecessary for this prototype.

| Area | Responsibility |
|---|---|
| `apps/client` | Babylon rendering, camera, input, prediction, interpolation, audio, menus, HUD, local preferences |
| `apps/server` | Colyseus rooms, authoritative simulation, action validation, combat, match rules, matchmaking, health checks |
| `packages/shared` | Pure movement/collision/math, level definitions, gameplay configuration, protocol contracts and validation |
| `tests` | Cross-package integration, browser flow, malicious-client, and multiplayer smoke scenarios |
| `docs` | Setup, architecture, protocol, assets, test evidence, performance, deployment, development log |

Create modules as their feature is implemented. Do not generate a tree of empty files. Shared code must run in Node without DOM, canvas, Babylon engine initialization, or browser globals. Rendering must not become the server's collision implementation.

### Research notes and what remains unproven

The current Node release page lists Node 24 as LTS; select a supported Node 24 patch after checking package engines. Vite currently documents minimum versions 20.19+ or 22.12+, while Colyseus recommends Node LTS. Recheck this combination at implementation time and record exact versions. These documentation checks do not prove an installed combination works. Sources: [Node releases](https://nodejs.org/en/about/previous-releases), [Vite setup](https://vite.dev/guide/), [Colyseus setup](https://docs.colyseus.io/getting-started).

Current Colyseus documentation describes the 0.18 netcode APIs, including fixed timestep input processing. Its repository lists `@colyseus/sdk` for TypeScript clients. Avoid copying older examples that assume earlier SDK names or loop APIs. Pin compatible server, schema, and SDK versions and use documentation for that exact line. Prefer its supported prediction machinery once the spike confirms the required collision state can be replayed. Do not run a second competing reconciliation system. Sources: [Colyseus repository](https://github.com/colyseus/colyseus), [fixed timestep inputs](https://docs.colyseus.io/netcode/server-input), [prediction and reconciliation](https://docs.colyseus.io/netcode/client-prediction).

Babylon.js supports WebGL and WebGPU. Use the standard Babylon.js engine with WebGL2 as the prototype baseline; treat WebGPU as future work. Its repository declares Apache-2.0, and Colyseus declares MIT. During the spike, inspect published versions, recent releases, runtime requirements, and direct/transitive license notices for the entire selected dependency set, including audio/fonts/assets. Sources: [Babylon.js repository](https://github.com/BabylonJS/Babylon.js), [Babylon.js license](https://github.com/BabylonJS/Babylon.js/blob/master/license.md).

The spike passes only after the installed client renders a scene, the server boots, two independent client connections exchange schema state, a production build succeeds, and the runtime/version record is written. This is a compatibility check, not a substitute for the later playable milestones.

## 4. Movement, collision, and world ownership

Start with a deliberately constrained collision model: static axis-aligned boxes and flat floors, with an upright player box. Use shared swept collision, contact separation, sliding, grounded detection, and bounded iteration. Normalize diagonal input. Integrate acceleration, braking, gravity, and jumping with fixed steps. Do not introduce slopes, climbable stairs, moving vehicles, rigid bodies, or player pushing in this release. Art can be richer than its simplified collision proxies.

This choice keeps the same rules usable in the browser and headless server without adding an engine-specific physics dependency. Test wall corners, thin barriers at sprint speed, ceilings, simultaneous floor/wall contact, arena boundaries, spawn overlap, and out-of-bounds recovery early. If the basic solver fails the movement gate, choose one proven shared headless physics solution through a recorded decision; do not maintain different physics rules on the two sides.

One versioned level definition owns collider IDs, positions, sizes, spawn zones, and art tags. Generate the client geometry and server world from it. Include protocol, map, and configuration versions in the join handshake; refuse incompatible clients with an actionable update message. Non-colliding decorative geometry must not look like solid combat cover.

Predict only the local player's movement. Reconcile from the acknowledged authoritative position, velocity, grounded state, and life ID, then replay outstanding inputs through the shared simulation. Correct the simulation immediately; smooth only the rendered camera for small corrections. Snap on respawn, teleport recovery, and large errors. Remote players interpolate snapshots, with capped extrapolation followed by a network warning if updates stall. Disable player-to-player physical collision initially to avoid unstable pushing and prediction divergence.

## 5. Networking and authoritative combat

### Contracts to define before multiplayer implementation

| Direction | Contract |
|---|---|
| Join request | Nickname, protocol/map version, room access details; never an authoritative player ID |
| Client input | Sequence, round/life ID, bounded movement axes, yaw/pitch, held sprint/fire, and discrete jump/reload/switch/trigger actions |
| Server state | Tick/time, round/phase/deadlines, effective config, team scores, player IDs/teams/transforms/health/weapons/stats, input acknowledgement |
| Server events | Unique event ID, round ID, shot accepted/rejected, confirmed hit, elimination, respawn, match result |
| Errors | Stable code and understandable message for full, missing, expired, incompatible, throttled, disconnected, or unavailable rooms |

Use framework input sequence/ack support where it meets the contract, rather than adding redundant counters. Deduplicate discrete actions and cosmetic events. Do not replay audio, muzzle flashes, kills, or damage notifications during movement reconciliation.

Process at most the allowed input time per player per server tick. Extra packets cannot grant extra movement. Bound queue depth, drop/reject stale or impossible sequences, and resync after backlog rather than fast-forwarding a cheating client's movement. Keep gravity and timers advancing without packets. Missing input may briefly retain held movement, but never repeat jump/reload/switch edges; clear all held actions after the stale-input timeout. Server time determines every cooldown and phase deadline.

### Hit registration sequence

1. Receive fire intent; verify phase, connection, life ID, owned/equipped weapon, reload/equip state, cooldown, and ammunition.
2. Derive origin from the server player's eye position and direction from sanitized aim plus authoritative recoil. The client supplies neither damage nor the final target.
3. Raycast against the shared solid world and eligible player hitboxes. Nearest obstruction wins. A teammate blocks the ray without damage. Ignore the shooter. Reject wall-obstructed, out-of-range, stale-life, and duplicate shots.
4. Consume ammo and advance cooldown on accepted shots, including misses. Apply damage once, produce an elimination only on the alive-to-dead transition, and update team/player stats atomically.
5. Send authoritative results. The client may show immediate firing animation/audio and provisional ammo but displays a hit marker only after server confirmation.

Begin with current-server-state hitscan to prove correctness. At the networking quality gate, measure moving-target accuracy under latency. If needed, add one bounded rewind path, initially capped at 150 ms, using server-recorded target history and an estimate derived from acknowledged inputs and measured connection timing. Reject future or excessive rewind claims, never rewind across life/round boundaries, and check static wall occlusion. Keep a disabled-by-default flag until these tests pass. The release report must identify whether compensation is enabled and its measured limitations. Framework reference: [Colyseus lag compensation](https://docs.colyseus.io/netcode/lag-compensation).

### Validation and connection safeguards

Validate finite numeric values, enum ranges, text lengths, allowed message shapes, transition legality, and action rates. Reject unsupported message types and arbitrary position/health/damage assignments. Start with at most 1 KiB for an individual gameplay input, 64 pending input frames, 60 incoming input packets/second with a small bounded burst allowance, and 10 room operations/minute per connection. These are configurable limits to load-test, not guarantees against attacks. Configure transport payload limits separately so legitimate state snapshots are not accidentally rejected.

Use a server-assigned guest ID and plain-text nickname of 1–20 characters. Never inject nickname HTML. Apply origin checks, connection limits, invite-lookup throttling, and per-connection enforcement; IP limits must accommodate shared household/carrier networks. Log counts and reasons for suspicious actions without reconnect tokens or unnecessary personal data. Keep debug/admin tools inaccessible on public production routes.

Private rooms are unlisted invitation rooms, not account-secured spaces. Use an unguessable server-generated invite token in the URL fragment; a join-code field accepts the same token. Exclude tokens from public metadata, logs, and referrers. No passwords, account database, or persistent sessions are required.

## 6. Arena, presentation, and browser flow

Build a roughly 60 × 45 m blockout, then tune using actual traversal and encounters. Provide two protected spawn areas with multiple exits, a central bus junction, a market flank, and a service-lane flank. Break direct spawn-to-spawn views. Start with ground-level combat and jumpable low obstacles. Balance routes before decorative art.

Select spawn points by valid clearance, enemy distance, and line-of-sight exposure. If all are contested, select the least exposed valid point and apply the configured short protection. Never spawn inside geometry or silently extend protection indefinitely.

Use modular storefronts, concrete balconies, original painted signs, market stalls, yellow danfo-inspired stationary minibuses, utility silhouettes, road markings, and warm street materials. Use fictional shop names and review wording for cultural accuracy. Avoid claiming a real street reconstruction. Use clear team colors plus labels/shapes; enemy readability takes precedence over visual density. Keep original/procedural or licensed assets local, and maintain an asset/license register.

Menu art comes from the actual arena. Implement Play, Create Private Room, Join Room, Settings, and control help with real actions. Maintain explicit connection/loading/game/result states with timeouts and recovery paths. Public Play joins a compatible non-full public room or creates one. Provide actual occupancy; never fake availability. Required UI includes all states listed in the source brief, including waiting, reconnecting, loading, failure, pause/settings, and return/rematch.

HUD: crosshair, health, current weapon, magazine/reserve ammo, team scores, timer, kill feed, hit/damage feedback, match announcements, scoreboard, and measured ping when available. Results show authoritative totals and team outcome. Keep menus keyboard-operable with visible focus. Document WASD, mouse, Shift, Space, R, 1/2, Tab, and Escape. Persist sensitivity, volume, and graphics settings locally; optional FOV is clamped. Audio unlock and pointer lock occur from a user gesture, with clear retry UI on denial.

Create distinct original firing/reload effects, footsteps, confirmations, death/respawn, UI, match cues, and quiet ambience. Positional audio should communicate distance. Cap simultaneous sources and dispose of them on room exit. Low/Medium/High presets alter resolution scale, shadows, and effects without changing simulation or hiding collision-relevant cover.

## 7. Milestones and delivery gates

| Milestone | Tasks | Runnable outcome and exit gate |
|---|---|---|
| M0 — establish | T01–T03 | Version-pinned workspace, documented commands, rendered scene and two-connection schema spike |
| M1 — local FPS | T04–T06 | Walk, sprint, jump, collide, aim, shoot/reload rifle, hit/eliminate targets; inspect the rendered game |
| M2 — real multiplayer | T07–T12 | Two independent browsers share an authoritative arena; movement, combat, respawns, teams, scores, and two weapons verified |
| M3 — full match | T13–T15 | Countdown through four-minute match, score/time victory or draw, accurate results, and another round |
| M4 — Lagos arena | T16–T18 | Balanced routes, safe spawns, Lagos identity, readable teams, sound, collision parity |
| M5 — product flow | T19–T24 | Public Play and private sharing, complete menu/HUD/settings, disconnect/reconnect and error recovery |
| M6 — stabilization | T25–T30 | Abuse checks, multiplayer/browser/load evidence, measured optimization, release packaging and online verification |

Each task is a focused slice with roughly 1–5 primary files. If actual work becomes larger, subdivide it in `todo.md` before implementing. Checkpoints after every two or three tasks require evidence and a runnable build. They are engineering gates, not repeated requests for permission after the founder authorizes implementation.

Sequential execution is the default. If agents are later used under the source brief's permission, the lead owns shared types, configuration, dependency versions, and integration. Delegate only stable, bounded work such as art in client/world, UI in client/ui, or independent test scenarios. Establish file ownership first; do not concurrently edit room state or movement/protocol definitions. Parallel work is optional and does not relax dependency gates.

## 8. Verification and evidence

Define these root commands during implementation; they do not exist yet:

- `npm run dev`: start client and server together.
- `npm run build`, `npm run typecheck`, `npm run lint`.
- `npm test`: deterministic shared/server unit tests.
- `npm run test:integration`: actual server with independent SDK clients.
- `npm run test:e2e`: browser menus, room sharing, and result flows.
- `npm run test:multiplayer`: repeatable two/eight-client combat and lifecycle smoke tests.
- `npm run start:server`: compiled production server.

Use Vitest or a similarly small compatible runner for gameplay/server tests and Playwright where browser automation is available. Test real boundaries: forged fire inputs, duplicate elimination, denied ammo, clock advancement, wall occlusion, bad spawn, capacity races, stale life inputs, and inconsistent versions. Automated clients are test instruments and must never appear as real population. Do not use a build or unit test as evidence that pointer lock or real multiplayer worked.

Verify browser UI with independent browser contexts and verify final online play with at least two physical devices. Use eight independent clients for room load/capacity tests; also conduct a human 4–8-player gameplay session for map balance. If people/devices are unavailable, record the exact missing evidence and do not claim those gates passed. Manual camera, aim, audio, and actual rendering inspection is required. Browser automation limitations are documented rather than hidden with production debug bypasses.

Test these network conditions: local, 80 ms RTT, 150 ms RTT with ±30 ms jitter, and degraded 250 ms RTT with brief disconnections. Use a documented proxy or OS network shaper and verify the effective WebSocket impairment; HTTP-only throttling is insufficient evidence. At 150 ms, verify responsive local input, eventual state convergence, score agreement, and moving-target hits. At 250 ms, test understandable degradation and recovery rather than promise competitive fairness.

### Proposed performance budgets

Record actual CPU, GPU, RAM, OS, browser/version, display resolution, server hardware/region, build hash, players, and network conditions. Initially evaluate 1080p Low/Medium on an available mid-range PC; identify its exact hardware before making any claim.

| Measure | Initial target to measure |
|---|---|
| Client frame pacing | Median frame time ≤16.7 ms, p95 ≤25 ms during an 8-player match; investigate recurring >50 ms spikes |
| Critical first-play transfer | ≤10 MiB compressed, aiming for ≤5 MiB through procedural content and selective imports |
| Cold-cache playable load | ≤8 seconds at 20 Mbps and 80 ms RTT; also record the result at 5 Mbps |
| Server tick work | p95 <10 ms for one full room at the 33.3 ms tick budget; no accumulating tick backlog |
| Per-client traffic | Aim ≤50 KiB/s downstream and ≤10 KiB/s upstream; record protocol overhead |
| Soak | 30 minutes of repeated matches/join/leave; no crash, leaked room, or monotonically growing retained resources |

These are proposed acceptance targets, not measured results. If missed, profile and fix the largest bottleneck; record remaining deviations without quietly changing the baseline. Include latency, correction frequency/distance, hit-registration samples, memory trend, draw calls, and asset sizes. Optimize from evidence: repeated geometry/materials, shadow budgets, effect pooling, payload frequency, and disposal.

## 9. Deployment and operations

Build a static client and one persistent Node server process for the first release. Use a host that supports long-lived WebSockets and stays awake during matches. Do not add Redis, a database, autoscaling, or multiple server processes until needed. The framework's [deployment guide](https://docs.colyseus.io/deployment) is the starting reference; a static host alone cannot execute the multiplayer server.

Document `PORT`, allowed client origins, public server endpoint, environment mode, room/connection limits, and public client configuration separately from server secrets. Production uses HTTPS/WSS, correct WebSocket upgrades and idle timeouts, and SPA fallback for room URLs. No production fallback to localhost. Provide health/readiness endpoints, graceful shutdown, bounded room creation, structured error/tick logs, and a compatible client/server rollback procedure.

Prepare a reproducible production container and deployment guide, test locally, and use existing authorized hosting if available. The founder must supply a deployment destination/account and approve any new spend before paid provisioning. Prepare the full release candidate before that question blocks progress. Select the server region by measured latency from intended Nigerian players; do not guess a region based solely on geographic labels.

An online release gate requires a production client connecting to the actual deployed server over WSS, private link sharing between devices, a complete match, and a rematch. A local container test is useful but does not satisfy this gate.

## 10. Risks, decisions, and release definition

| Risk | Response / gate |
|---|---|
| SDK/server version drift | Pin one tested version set; compile/render/connect spike before building gameplay around APIs |
| Shared movement diverges | One solver and map; fixed-step replay, collision edge tests, correction measurements |
| FPS feels unfair at latency | Test early in M2; document current-state hits; add bounded rewind only with history validation tests |
| Art invalidates collision/readability | Shared proxies, cover checks, route playtest, frame capture at each environment change |
| Low room population | Honest waiting state, share invitation, explicit two-player private start; no fake players |
| Browser denies audio or pointer lock | Gesture-based activation, clear retry path, focus-loss input reset |
| WebSocket backlog or server load | Bounded queues/rates, backpressure, tick metrics, eight-client load tests |
| Incomplete external access | Finish local packaging; record deployment/device test as blocked, never passed |

No founder answer is needed to prepare or begin the local implementation once authorized. Later external inputs are hosting access/budget, available benchmark hardware, and participants/devices for final human testing. The plan supplies defaults for ordinary engineering and gameplay choices.

Release only when all critical source-brief requirements are verified: supported-browser loading, collision/movement, both weapons, server-owned damage/ammo/score, independent clients, safe disconnects, correct match completion, public/private joining and sharing, complete results/rematch, understandable failures, successful builds/checks, actual online connection, repeatable setup, and recorded performance. No known critical gameplay, network, or console failures may remain.

For each milestone, append evidence to `docs/dev-log.md`: implementation summary, exact commands, runtime/manual checks, results, limitations, and next task. Update `tasks/todo.md` only when its criteria are demonstrated. Keep separate labels for implemented, verified locally, and verified online. Unexecuted checks remain unchecked.
