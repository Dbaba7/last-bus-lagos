# Performance measurements

Collected locally on 11 October 2026. Prototype measurements, not a promise for every PC or connection.

## Environment

Intel Core i5-12450H, 12 logical CPUs, 15.69 GiB RAM, Windows 10.0.26200 x64, Node 24.19.0, Chromium 153.0.8010.12. WebGL reported ANGLE on Intel UHD Graphics / Direct3D 11. Earlier notes assumed software rendering from a Chromium flag; inspecting the actual renderer corrected that assumption. These are headless tests, not physical-display input-latency measurements.

| Measurement | Result | Scope |
| --- | --- | --- |
| Cold load at 20 Mbps / 80 ms HTTP latency | 1.92 s | Ready menu, fresh browser context |
| Cold load at 5 Mbps / 80 ms | 4.28 s | Same production static build |
| First ready-menu transfer | 1,668,365 bytes | Uncompressed local responses |
| All built JS/CSS assets | About 1.93 MB raw / 0.49 MB gzip | Includes lazy chunks; gzip calculated |
| Eight-player scene | 140 meshes / 100 draw calls in captured view | One browser plus seven SDK clients, 1920 × 1080 viewport, Medium scaling |
| Isolated combat frame intervals | Median 7.0 ms / p95 9.8 ms | Brief scripted route, early two-player and later eight-player samples |
| Latest two-browser/eight-player journey | Median 11.8 ms / p95 15.0 ms; 100 draw calls | Host at 1920 × 1080, second browser at 1280 × 800; Medium; six SDK peers |
| Concurrent browser-suite intervals | One two-player run had p95 34.6 ms | Competing browser workloads; exceeds proposed 25 ms budget |
| Server tick work during 30-minute soak | Highest sampled rolling p95 1.502 ms; final p95 0.956 ms | One eight-player room at 30 Hz |
| Traffic per client during soak | About 2.04 KiB/s down / 2.33 KiB/s up | Application bytes, excludes TCP/TLS/IP overhead |
| Soak memory | Heap 21.25–36.86 MB, final 32.68 MB; RSS 94.99 → 118.51 MB | GC-managed process; does not prove leak freedom |

Selective Babylon imports reduced the initial approximately 6.9 MB main chunk to about 1.25 MB raw / 0.319 MB gzip. Static meshes merge by material/shadow role. The original cumulative draw-call diagnostic was corrected; discard its old values as frame metrics.

The soak completed eight rounds and reached 53,919 ticks at its last telemetry sample. It began before the final client cleanup/build-packaging and input-limiter changes; those changes have focused verification, not a newly claimed full soak. Its clients remain connected throughout, rather than continuous join/leave churn.

The cold-load report stores its exact asset hash. Later client edits change hashes and small byte counts; retain each measurement with its own build identity.

The proposed physical-play target remains median ≤16.7 ms and p95 ≤25 ms. Brief isolated headless runs meet it; simultaneous workloads did not consistently meet it. No physical 1080p eight-human benchmark or minimum supported GPU has been established.

Use `npm run test:soak`, `npm run test:latency`, and `node scripts/load-test.mjs` (production server on localhost:2580). Cold-load shaping affects HTTP; the latency suite's TCP proxy affects actual WebSocket bytes.
