# Tested toolchain

The root lockfile is the reproducibility source. Node **24.19.0**, npm workspace layout, Windows x64 were used locally. `engines` deliberately limits Node to 24.x; the machine's unrelated default Node 25 installation was left unchanged.

| Package | Locked direct version |
| --- | --- |
| Babylon core | 9.30.0 |
| Colyseus core / ws transport | 0.18.18 / 0.18.4 |
| Colyseus SDK / schema | 0.18.5 / 5.0.36 |
| Express | 5.1.0 |
| Vite / TypeScript | 8.3.4 / 7.0.2 |
| Vitest / Playwright / tsx | 5.0.3 / 1.62.1 / 4.23.15 |
| esbuild (server bundler) | 0.28.2 |

These versions were selected and exercised together, not assumed compatible from package names. Schema 5 uses `schema({ field: t.number().default(0) })`; old primitive-string examples do not apply. Colyseus 0.18 drop/reconnect/leave callbacks were verified against its installed declarations and actual independent clients. The SDK reconnect-cancellation workaround is documented beside `closeRoom.ts`.

The client uses selective Babylon module imports, including the shadow-generator scene component, to avoid importing the full engine barrel. Vite targets ES2022; the intended platform is a current desktop browser with WebGL and keyboard/mouse. Chromium has been automated. Firefox, Safari, physical Edge and GPU-specific behavior are not yet verified; do not advertise them as tested.

12 October update: installed Microsoft Edge 155.0.4283.45 passed headless menu/settings checks at seven viewport sizes and the practice/public/private browser smoke. The user confirmed the fixed menu fits a physical 1920×1080 display at 125% Windows scaling in Edge. This does not certify a complete physical-device match or the other browsers.

The initial tsup wrapper pinned a vulnerable older esbuild development dependency. The final server build calls pinned esbuild 0.28.2 directly, preserving the same bundled shared simulation and external runtime dependencies while removing that wrapper and its unused packages. No esbuild development HTTP server is used.

Tests used an existing Chromium binary through `PLAYWRIGHT_CHROMIUM_EXECUTABLE`, because the installed Playwright package's default browser revision was absent. Fresh setups should install the matching browser. WebGL inspection identified ANGLE on Intel UHD Graphics through Direct3D 11; the flag allowing SwiftShader did not force software rendering. Headless automation still does not establish physical-display gaming performance.

13 October update: Android-first touch gameplay is implemented as an alpha. It uses standard pointer events, landscape controls and Low default graphics on coarse-pointer devices. See mobile.md for the exact tests and limitations. Neither physical Android nor iPhone Safari has been certified. The earlier desktop-only platform scope is superseded by this Android-first target.
