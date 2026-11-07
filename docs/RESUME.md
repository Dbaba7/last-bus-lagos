# LAST BUS: LAGOS — current handoff

**28 October 2026 — 0.2 upgrade landed locally (see dev-log).** Teams are Police vs Bandits, Story Mode chapter 1 is playable, and the protocol is `lagos-2`. The notes below this line predate 0.2; their hosting and device status is unchanged.

Updated 13 October 2026. Implementation is authorized and active. Nigeria is the priority market; the Toronto user is helping test. Android Chrome first. Public release and real mobile hardware are not verified.

## Current state

Shared authoritative TypeScript simulation, Vite/Babylon client, Colyseus server, both weapons, public/private rooms, complete match/respawn/results/rematch, procedural art/audio and test/deployment tooling exist. Desktop menu clipping was fixed and user-confirmed in Edge at 1920×1080 / 125% Windows scaling.

Android touch alpha is implemented: independent joystick/aim/fire capture, fire-drag aiming, action buttons, sprint toggle, scores/pause, landscape guard and input clearing on rotation/focus loss. Coarse pointers default to touch and Low graphics. Settings can change input mode. A short-tap regression was fixed by preserving a one-frame fire pulse; cancellation discards it. No aim assist or server rewind. Read mobile.md.

28 unit tests, production build and strict unused-symbol checks pass on the final code. The first sandbox unit retries failed on Vitest generated temporary-module access (ENOENT); all 28 passed outside the sandbox. Live Edge touch-mode checks covered small landscape layouts, pistol firing, reload, scores/pause, portrait guidance and return to menu. These are desktop-pointer checks, not physical Android multitouch evidence.

Earlier evidence remains dated: 11 server integration tests; concurrent browser public/private and eight-player combat/rematch; full four-minute match; TCP latency profiles; 30-minute eight-client soak before the last input limiter fix; clean-install verification. See release-verification.md for limits. Docker was unavailable and is unverified.

## Hosting / user handoff

The private repository https://github.com/Qudios/last-bus-lagos contains all 72 project files on main. Initial source commit ef127ccbb99265f976bb6e8a521a6b0c0654c36d was approved explicitly by the user after an automatic approval-review block; a follow-up records this status and quotes the Render YAML off value. Confirm the remote head before further updates. The original local repository still has no commit/remote; do not overwrite local files to force synchronization.

Render account is signed in. No web service, public URL or paid resource has been provisioned. `render.yaml` and deployment.md specify one Free native Node service in Frankfurt, manual deploys, Node24, `/ready` health, same-origin HTTP/WSS. Frankfurt is an initial Nigeria-first choice among Render regions, not a measured winner. Do not add replicas: rooms live in one process.

The user has programming experience and offered to handle routine dashboard work to conserve usage. Give concise exact settings and let the user connect Render to only Qudios/last-bus-lagos. No broad/all-repository grant or paid resources are authorized. Wait for the hosted URL or concrete error to verify HTTPS/WSS and debug. Do not spend tools navigating routine setup on the user's behalf unless asked.

## Next validation

1. User deploys the free service with the supplied settings and shares its URL.
2. Verify health, production client, private room create/join, full match/rematch and reconnection over public HTTPS/WSS.
3. S25 Ultra + Android Chrome: real simultaneous touch, complete match, rotation, background/resume, audio. Record Nigerian city/network/ping. Another tester has an unspecified iPhone roughly 3–4 years old; Safari is exploratory, not certified.
4. Seek a budget Android phone; flagship performance does not establish broad market compatibility. Human balance/art/audio review and 4–8-player testing remain.

## Local runtime

Node24: C:\Users\tbnco\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe
npm CLI: C:\Users\tbnco\nodejs\node_modules\npm\bin\npm-cli.js
Prepend the Node24 directory to PATH; leave global Node25 alone. `npm run dev` serves client5173/server2567. Restart for server edits. Current session is 5899, started 13 October; session IDs may not survive a later chat. LAN IPs change. Read README for origins.

Browser UI interaction in this chat uses CUA. The selected Edge browser id is 3. Temporary viewport overrides were reset and the manually selected touch preference was restored to mouse after QA. Current local preview: http://localhost:5173.
