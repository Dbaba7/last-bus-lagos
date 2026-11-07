# LAST BUS: LAGOS

A browser first-person shooter set in Ojuelegba Junction, a fictional Lagos crossroads under a concrete flyover at dusk. It has three modes:

- **Story — Dead Air, Chapter 01: "Signal Lost".** A solo mission with eight objectives, enemy AI, checkpoints, failure and retry, radio dialogue with subtitles, and a results screen. Chapters 02 and 03 are listed as *in development* and cannot be started.
  Four in-engine cutscenes (intro, relay reboot, finding Femi, the last bus) play with letterboxing; hold Space or press Enter or Esc to skip. Recorded dialogue is optional: see [docs/voice-script.md](docs/voice-script.md) and drop the MP3s into `apps/client/src/voice/`.
- **Multiplayer — Street Wars, Police vs Bandits.** Up to eight players with server-authoritative combat. Public rooms start at four loaded players; private rooms get an invitation link, and hosts can set match length and elimination limit. Players can switch teams in the lobby.
- **Training range.** Six targets at measured distances, or three AI bots. It runs entirely offline, and bots are always labelled as bots.

This is a locally verified build. Public hosting and physical-device testing are still release requirements. See [release evidence](docs/release-verification.md).

## Play locally

Use **Node 24.x** and npm. From this directory:

```sh
npm ci
npm run dev
```

Open **http://localhost:5173**. Story and training need no server; multiplayer uses the game server on port 2567, which `npm run dev` starts too.

**Controls (rebindable in Settings → Controls):** WASD move, mouse aim, left click fire, right click aim down sights (hold or toggle), Shift sprint, Space jump, C crouch, R reload, E interact (hold), 1 / 2 or mouse wheel switch weapons, Tab scores, Esc pause. Crouch defaults to C because Ctrl+W closes browser tabs.

The settings screen covers separate horizontal and vertical sensitivity, an aiming multiplier, FOV, invert Y, hold-or-toggle aim, crouch and sprint, key bindings, quality presets, shadow resolution, render scale, post effects, five audio buses, camera shake, weapon bob, subtitle size, HUD scale, story difficulty and an optional performance overlay (F3). Preferences and campaign progress are saved in localStorage when it is available.

Android touch controls are still supported as an alpha (joystick, drag to aim, Fire, plus AIM / CROUCH / USE buttons). The game is now PC-first; touch has not been re-verified on hardware since this upgrade.

In development builds only: F4 draws collision boxes and spawn points, F8 restarts the mission, and F9 skips the current objective. `window.lastBusDev` exposes walkthrough hooks used by `scripts/visual-tour.mjs`. None of these exist in production builds.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Client with live updates and persistent game server; restart after server edits |
| `npm run build` | Typecheck; production client in `dist/client`, server in `dist/server` |
| `npm run typecheck` | Strict TypeScript validation |
| `npm run lint` | TypeScript strict unused-symbol checks; this is not ESLint |
| `npm test` | Pure simulation, collision, weapon and prediction tests |
| `npm run test:integration` | Starts isolated local servers; capacity, authority and lifecycle checks |
| `npm run test:multiplayer` | Two actual clients: input navigation, combat, respawn, short match/rematch |
| `npm run test:latency` | Actual TCP/WebSocket delay profiles and connection recovery |
| `npm run test:soak` | Eight-client, 30-minute server soak; `SOAK_SECONDS` overrides duration |
| `npm run test:e2e` | Two-browser menu/practice/invitation checks; requires `npm run dev` |
| `npm run test:browser-combat` | Build first; production client, browser-fired combat, eight-player room, results/rematch |
| `npm run test:browser-recovery` | Older settings/recovery script; **not yet updated** for the 0.2 settings layout |
| `npm run voice:script` | Regenerate `docs/voice-script.md` (the ElevenLabs recording script) from the mission data |
| `node scripts/visual-tour.mjs` | Dev-only screenshot walkthrough of menus and story beats into `artifacts/tour`; requires `npm run dev` |
| `npm run verify:clean` | Fresh temporary install, build, lint and unit tests; keeps directory for inspection |
| `npm run licenses` | Refresh bundled runtime dependency notices after dependency changes |
| `npm run start:server` | Run compiled server, also serving the production client |

Browser checks use Playwright Chromium. Install its matching browser with `npx playwright install chromium`, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to an existing compatible Chromium. Tests write screenshots and JSON reports into ignored `artifacts/`. `SMOKE_FULL_MATCH=1` runs the multiplayer smoke with the real four-minute timer. On PowerShell set variables with `$env:SMOKE_FULL_MATCH='1'` before the command.

The game uses ports 5173/2567. Isolated tests use 2570–2578; don't run duplicate copies of a test concurrently. `GAME_URL` points browser smoke/recovery at another local server (for example `http://127.0.0.1:2580`). Browser automation tests pointer lock and DOM input, but does not replace human aiming, listening or map-balance testing.

## Production

The production server can serve both the static client and WebSocket endpoint from one origin. After building, a local production check on PowerShell is:

```powershell
$env:NODE_ENV='production'
$env:PORT='2567'
$env:ALLOWED_ORIGINS='http://localhost:2567'
npm run start:server
```

Open http://localhost:2567. Reset these environment variables or use a fresh terminal before development. The production client defaults to its own origin; for a separate static host, set `VITE_SERVER_URL` to the public HTTPS game-server URL **before building**. Vite variables are public, never secrets.

See [deployment](docs/deployment.md) for container/TLS/proxy configuration, health checks, rollback and the public release checklist. A static host alone cannot run this multiplayer server.

## Project map

- `packages/shared/src`: rules, map, collision with step-up, input contract, weapons (designed recoil, deterministic spread, falloff, headshots) and the deterministic match simulation.
- `packages/shared/src/story`: navigation grid, enemy AI, campaign and mission data, and the story/training sessions. These are pure TypeScript and covered by headless tests.
- `apps/server/src`: Colyseus rooms, authoritative input queues, schema synchronization, origin/rate controls and HTTP endpoints.
- `apps/client/src`: the app shell (`main.ts`), input and bindings, settings and synthesized audio. `render/` holds procedural textures, batched static geometry, characters, the first-person viewmodel and effects. `world.ts` dresses the map from the collision boxes, and `ui/` holds the screen markup and the settings view.
- `tests`: deterministic unit tests and actual-server/browser scenarios. Test drivers never appear as players in normal game startup.
- `tasks/source-brief.txt`: preserved original request; `tasks/plan.md`: original target plan.

Read [architecture](docs/architecture.md), [networking](docs/networking.md), [assets](docs/assets.md), [compatibility](docs/compatibility.md), [development log](docs/dev-log.md) and [resume notes](docs/RESUME.md).

Keep gameplay rules in the shared package and treat all client messages as untrusted. Change the protocol version when incompatible contracts or map geometry change. Run the checks relevant to a change and update the evidence; don't mark online or human verification complete using localhost automation.
