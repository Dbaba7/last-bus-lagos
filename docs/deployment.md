# Deployment

Deploy one always-running Node 24 process with WebSocket upgrade support. The supplied image serves both `dist/client` and the room server on `PORT` (default 2567). A static-only host cannot run the room server. No deployment account, domain, paid infrastructure or public URL has been created for this project.

## Container recipe

```sh
docker build -t lastbus-lagos:0.1 .
docker run --rm -p 2567:2567 -e ALLOWED_ORIGINS=http://localhost:2567 lastbus-lagos:0.1
```

Then open http://localhost:2567. The multi-stage image builds with Node 24, prunes development packages and runs as the unprivileged `node` user. `/ready` drives its health check. Docker is not installed in the current execution environment, so this recipe is prepared but the container itself has not been run. The compiled Node entry point is tested separately.

For public hosting, set `ALLOWED_ORIGINS` to the exact HTTPS client origin(s), comma-separated. Terminate TLS at the host's proxy and forward HTTP and WebSocket upgrades to the private Node port. Keep connections open for matches; use an idle timeout comfortably above the five-second WebSocket heartbeat (for example 60 seconds or more). Turn off any platform sleep behavior that would stop active rooms.

When exactly one trusted reverse proxy is the only network path to the private Node port, set `TRUST_PROXY=1` for per-client HTTP rate accounting. Otherwise use an appropriate trusted address setting or leave it unset. Do not expose the Node port directly while trusting arbitrary forwarded addresses. Origin checks are configured separately from proxy trust.

## Split client and server

Build with `VITE_SERVER_URL=https://your-game-server.example` and upload `dist/client` to the chosen static host. Allow that host's exact origin on the Node server. Vite's URL is compiled into the browser bundle and must not contain secrets. The SDK upgrades to secure WebSockets from the HTTPS endpoint. Room links use a fragment at the root page, so there is no room-path rewrite requirement.

The client defaults to its own origin when that variable is absent. There is no hard-coded production localhost endpoint. Serve hashed `/assets/` files with long immutable caching and `index.html` without stale caching; preserve the dependency notices. Configure gzip/Brotli at the public proxy/static host to obtain the compressed transfer sizes measured by the build.

## Release procedure

1. Use `npm ci`, `npm run licenses`, `npm run build`, `npm run lint` and relevant automated suites. Save their reports with the release identifier.
2. Choose an existing authorized hosting destination and region. Measure latency from intended Nigerian players before deciding on a region; do not infer latency from geography alone.
3. Deploy the same client/server protocol version together. Check `/health` and `/ready`, origin denial and successful WebSocket upgrade through HTTPS/WSS.
4. From two physical devices, create/share a private invitation, move, exchange damage, finish a complete match and rematch. Check disconnect/rejoin and server restart behavior. Conduct the 4–8-human balance/audio session separately.
5. Record actual URL, browser/device/network details, frame pacing and errors in `release-verification.md` before marking online release complete.

## Operational limits and rollback

Rooms, reservations and invitations are in memory. A process restart intentionally ends them; there is no match persistence or cross-process room discovery. Use one process/replica. The configured cap is 64 rooms, but load evidence currently covers one eight-player room. Rate/payload/input/backpressure limits are admission defenses, not a hosting-capacity guarantee.

SIGTERM uses Colyseus shutdown and switches readiness false. Stop new traffic before replacing an instance; players in that process will need to join a new room. Roll back client and server to the same tested release and invalidate cached HTML. Keep content-hashed older assets available long enough for existing pages to finish loading, or require refresh during a coordinated maintenance restart.

External requirements still needed: a hosting destination/account and domain/TLS route, approval for any new spend, and devices/participants for the public validation. These are separate from locally passing tests.

## Render free playtest configuration (13 October 2026)

`render.yaml` defines one Free native Node web service in Frankfurt. Nigeria is the priority; Frankfurt is a starting choice among Render's offered regions, not a measured latency winner. No database, paid plan, domain or multiple replicas are needed. Auto-deploy is off so pushing source does not interrupt an active playtest.

- Repository: private `Qudios/last-bus-lagos`, default branch `main`.
- Build: `npm ci --include=dev && npm run build && npm prune --omit=dev`.
- Start: `ALLOWED_ORIGINS="$RENDER_EXTERNAL_URL" npm run start:server`.
- Environment: `NODE_VERSION=24`, `NODE_ENV=production`.
- Health path: `/ready`. Render supplies `PORT`; the server binds `0.0.0.0`.
- The start command scopes browser origins to the service's actual Render URL, using the documented `RENDER_EXTERNAL_URL` variable. Add an explicit allowlist if a custom domain is introduced later. Do not use a wildcard.
- Grant Render access only to this private repository when connecting GitHub. Account login alone does not establish repository access.

Deployment is not verified until HTTPS, WSS room create/join, match/rematch and recovery are checked on the actual hosted URL. Free instances may sleep/restart and all rooms are in memory. A private invitation is unlisted room access, not a site-wide authentication gate.

References: https://render.com/docs/free, https://render.com/docs/regions, https://render.com/docs/environment-variables, https://render.com/docs/blueprint-spec.
