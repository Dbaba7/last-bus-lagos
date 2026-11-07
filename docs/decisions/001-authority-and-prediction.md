# ADR-001: Shared simulation with server authority

**Status:** Accepted for prototype. **Date:** 2026-10-11.

## Context

The brief requires real multiplayer, a lightweight browser client and understandable infrastructure. A physics engine on only one side would introduce movement disagreement. Multiple prediction systems would make that disagreement harder to investigate.

## Decision

Use Babylon.js for procedural rendering, Colyseus 0.18 rooms/schema transport, and a small shared fixed-step simulation. Keep one explicit sequence/ack predictor and bounded input queue, rather than combining it with Colyseus InputHandle prediction. The shared state includes velocity, grounded/life state and weapon timing; a deterministic replay regression and actual socket-delay tests exercise the chosen contract.

Keep current-state hitscan for this prototype. Tests through 0/80/150/250 ms added RTT show moving-target damage and score convergence, while time to kill worsens at higher latency. Do not add a claimed rewind window without history, collision and respawn-boundary validation. Revisit bounded server rewind before competitive release if human latency sessions confirm unfair misses.

## Alternatives

- Colyseus InputHandle prediction: viable future migration, but would replace this path rather than run alongside it.
- General rigid-body physics: more geometry freedom, unnecessary complexity for a flat static arena.
- Peer authority: simpler hosting but fails the server-owned health/ammo/score requirement.
- A serverless static-site backend: does not host this persistent Node room process without an architectural change.

## Consequences

Static boxes constrain map design but make client/server replay reproducible. The network contract and custom predictor need explicit tests. Current-state hits deliberately favor consistency over unverified lag compensation and have measurable high-latency limitations. No hosting-provider migration or paid service was introduced.
