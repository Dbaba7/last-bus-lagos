# Architecture

The client and authoritative server share one pure TypeScript simulation. Babylon.js only renders it; it is not a second source of collision truth. Colyseus provides rooms, seat reservations, WebSocket transport and binary schema patches. There is no account service or database.

## Simulation boundary

`Simulation.step` advances one 1/30-second tick. Movement has two swept axis-separated substeps against the same level boxes used to build visible cover. Players are upright 0.7 × 1.8 metre boxes. Diagonal movement is normalized. Gravity, acceleration, sprint, grounded jumping, weapon cooldown, finite reserve, reload and equip timing all run on the server. Player-to-player collision is disabled; walls, buses and other cover are solid. Slopes, stairs, climbing and moving rigid bodies are outside this prototype.

Only the server consumes ammo, resolves body hitscan against the closest world/player intersection, applies damage and awards eliminations. Teammates block a ray but take no damage. Spawn protection lasts one second and ends when the protected player fires. Death disables actions; a fresh life with full loadout begins after three seconds. Stable session-ID ordering determines same-tick shot resolution.

The phase sequence is WAITING → COUNTDOWN → ACTIVE → RESULTS → WAITING. Public rooms require four loaded players and opposing teams; private rooms require two and a host request. Teams cap at four through balanced assignment and the eight-player room cap. A missing team abandons a match after 15 seconds. Results are copied, not live references. Departed participants with a kill/death remain in the final rows; scoreless departures are omitted. Rematch resets scores/loadouts and retains the connection.

## Client boundary

Movement and weapon presentation respond immediately through one sequence/ack prediction path. Authoritative snapshots replace simulation state; unacknowledged inputs replay through the shared solver. Replay has no audio/event side effects. Camera smoothing only changes presentation and snaps for life changes or corrections over two metres. Remote players interpolate 100 ms behind server time and hold their latest pose when history runs out; there is no unbounded extrapolation.

Local online muzzle/audio is predicted once. Server shot events provide world tracers, and confirmed hit/kill events provide hit markers and scores. Predicted presentation never awards damage. Practice runs the same simulation locally with clearly labeled target players.

The scene and audio context are reused across rooms. Actor meshes, tracer meshes, histories and scheduled audio sources are bounded and cleaned when no longer needed. Static meshes merge by material and shadow role. The settings layer stores only sensitivity, volume and quality in localStorage; storage failure uses safe defaults.

## Operations and trust

Rooms and invitations live in one Node process and disappear on restart. The room cap is 64 as an admission guard, not a tested 64-room capacity claim. Deploy one process until distributed presence and routing are deliberately implemented. The production image serves the static build and persistent server together; a separate client host remains optional.

See [network contract](networking.md) and [decisions](decisions/001-authority-and-prediction.md) for API details and tradeoffs. This is basic server authority and abuse resistance, not comprehensive anti-cheat: modified clients can still automate aim or read the positions distributed to their room.
