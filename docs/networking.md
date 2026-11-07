# Network contract and latency policy

Protocol/map version: `lagos-1`, defined in shared configuration. Room type: `street_wars`. Client options are `version`, guest `name`, and optionally `private: true` when creating or `invite` when joining. Private creation generates a 128-bit random token; it is never derived from a room ID. Private rooms are excluded from matchmaking. Invitations use a URL fragment and a POST lookup; do not publish a private link unless the room should be shared.

## Messages

| Direction | Message | Meaning |
| --- | --- | --- |
| Client → server | `input` | Full `InputFrame` defined in `packages/shared/src/protocol.ts` |
| Client → server | `ready` | Loaded; idempotent, cannot heal/rearm/respawn repeatedly |
| Client → server | `start` | Private host asks to begin an eligible waiting round |
| Client → server | `pong` | Echo the current server nonce for measured ping |
| Server → client | Schema state | Phase/time/scores/config, player transforms/lives/ammo/stats and frozen results |
| Server → client | `event` | Transient shot/hit/kill/reload/respawn/phase; numbered with round ID |
| Server → client | `invite`, `notice`, `ping` | Invitation, user-readable room notice, RTT probe |

Inputs contain sequence, round/life, x/z axes, yaw/pitch, held sprint/fire, jump/reload/switch and a trigger field. The server derives the semi-auto trigger edge itself. It rejects nonfinite/out-of-range values, extra fields, invalid sequences and unknown weapon names. It never accepts client position, damage, health, ammo or score. Body hits only; no headshot multiplier.

Input and simulation rate: 30 Hz; schema patch rate: 20 Hz. At most one queued frame runs per tick. Eight pending frames are retained; overflow drops the backlog and the client reconciles. Fresh held input can persist for 150 ms; discrete actions never repeat from that grace period. A token bucket permits 60 input packets/second with an initial burst of 90. Room actions allow a burst of ten and refill one per six seconds. Repeated malformed messages disconnect the offender. Incoming WebSocket payloads cap at 2048 bytes; server output has a separate 256 KiB backlog guard.

Well-formed packets exceeding the input bucket are discarded without negative token debt or a malformed-message penalty. Congestion can deliver legitimate browser traffic in bursts. The fixed simulation rate still prevents a burst from increasing movement speed; malformed shapes and invalid sequence numbers still count toward disconnect. A 300-packet actual-server regression checks bounded movement, connection survival and prompt acceptance of the next normal input.

## Recovery

An unexpected drop clears input and reserves the slot for 15 seconds. The disconnected body remains vulnerable and cannot fire. Reconnection retains its session, stats and life/death state. If the reservation expires, the player is removed. Host control transfers to a connected player. Voluntary leave releases the seat; refreshing creates a new guest session rather than persisting reconnection secrets in storage.

The client uses SDK reconnect attempts and clears controls/mouse lock during interruption. A pinned-SDK workaround prevents an already scheduled retry from reopening a room after the player leaves. Leaving waits at most 1.5 seconds for acknowledgement before closing locally; the server's reservation cleanup still applies after an outage.

## HTTP

- `GET /health`: `{ ok, version, rooms }`.
- `GET /ready`: HTTP 200 while accepting operation, 503 during shutdown.
- `POST /api/invite`, JSON `{ token }`: `{ roomId }` or 404. Request limit 1 KiB.
- Colyseus owns `/matchmake/*` and room WebSocket routes.
- Matchmaking/invitation HTTP requests cap at 240/minute per observed address. Static asset downloads are excluded. Configure `TRUST_PROXY` only for the actual trusted proxy path.

Origins are checked on HTTP and WebSocket upgrades. This is a browser origin restriction, not guest identity authentication; non-browser clients can omit Origin. There is no claim to prevent aim bots, wall-information cheats or distributed denial of service.

## Measured policy

`npm run test:latency` forwards actual ordered TCP bytes with delay in both directions, so WebSocket state, input and pings are affected. The 150 ms profile adds up to ±30 ms total jitter. The 250 ms profile destroys sockets and checks automatic recovery. This is not HTTP-only browser throttling.

Initial local run: measured median pings 32/95/171/264 ms for configured added RTT 0/80/150/250 ms; moving-target elimination took 495/743/871/1050 ms and 5/7/8/11 shots respectively. The test deliberately reads delayed target state and drives real input; it is a reproducible scenario, not a statistical fairness study. Movement correction p95 was approximately 0.167 m, max 0.50 m. Current-state hitscan remains enabled; **rewind is not implemented**. Human moving-target sessions, especially with asymmetric network paths, remain necessary before competitive release.
