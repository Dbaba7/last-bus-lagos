# Release verification — updated 12 October 2026

**Status: playable local prototype; not a publicly verified release.**

## Implemented and demonstrated

| Area | Evidence |
| --- | --- |
| Browser FPS | Rendered arena, pointer lock, keyboard movement, collision, firing/reload/switch and settings in Chromium |
| Server authority | Independent network clients demonstrate damage, one-time kills, ammo, team scores and three-second respawn |
| Both weapons | Rifle combat plus sidearm trigger/equip/reload rules; actual-server held-trigger test prevents sidearm autofire |
| Rooms | Browser public Play, private invitations between independent browser contexts, host start, eight seats/ninth rejection, new public room for ninth join |
| Match loop | Actual four-minute match with shared results/rematch; browser-fired elimination through eight-player results/rematch with shortened server-test timing |
| Recovery | Actual reconnect, 15-second expiry, abandonment, late join, host transfer and leaving during a scheduled reconnect |
| Browser recovery/settings | Saved/clamped/corrupt preferences; high/low quality and resize; unavailable matchmaking/retry; invalid invite; denied pointer lock/retry; lost lock/focus clears fire/movement; disabled-WebGL guidance |
| Hardening | Invalid/spoofed inputs, oversized socket payload, malformed invitation body, HTTP origin denial and request/message rate limits |
| Build/setup | Typecheck, strict unused-symbol lint, production build and fresh temporary install/build/lint/unit verification |
| Dependencies | Latest install audit: zero reported vulnerabilities after switching the server build to direct esbuild 0.28.2 |

**19 unit tests and all 11 integration tests passed**. Browser, latency, full-match and soak scripts are additional checks, not included in that count. A fresh temporary install, build, lint and all unit tests passed after the final gameplay fix; the install audit reported zero vulnerabilities.

Concurrent browser testing exposed a real input-limiter bug: excess valid packets accumulated negative token debt and malformed-message penalties. The corrected server discards excess valid inputs without those penalties while retaining one-input-per-tick authority. Its targeted 300-packet regression and both concurrent browser suites passed. A subsequent full browser journey used **two independent browser contexts plus six SDK clients**, verified a browser-fired elimination, eight-player results, rematch and return to menu in both browsers, with no browser errors. Match timing is shortened only in the test server.

The final public/private browser check found and fixed same-tab invitation navigation: changing the URL fragment now opens the join dialog from the menu. During an active room it preserves the connection and explains how to switch rooms. Production build/typecheck, lint and the expanded browser check passed after this final UI change; the clean-install run immediately preceded it.

The full-duration match/rematch report records 251.438 seconds. The soak records **1,800.007 seconds, eight actual SDK connections, eight rounds and zero rejected inputs**. It uses fixed clients and repeated matches; join/leave churn is tested separately, not throughout the soak. This is not proof against every memory leak.

Reports and screenshots are in ignored `artifacts/`: browser-report, browser-combat-report, browser-recovery-report, multiplayer-full, latency-report, load-report and soak-report JSON files. Preserve timestamps/build identity. Retained failure screenshots are not passing evidence. The soak predates the final input-limiter fix; targeted and concurrent-browser regressions cover that fix, not a newly claimed full soak.

## Remaining release gates

12 October follow-up: the user selected a free-first friends playtest, with one player in Toronto and two in Nigeria, and has a GitHub account. [Playtest steps and responsibilities](playtest.md) record the hosting recommendation and next inputs. No online deployment has occurred. The desktop clipping issue was fixed and the user confirmed the lower menu controls are visible in Edge at 1920×1080 / 125% scaling. Installed Edge automation also checked seven viewport sizes; full physical gameplay remains separate.

- **Online playtest deployment:** the user now wants a free-first friends playtest. Render Free is recommended; account connection and deployment remain pending. Public HTTPS/WSS and internet play have not been verified; local production mode is not equivalent.
- **Two physical devices and 4–8 humans:** map balance, aiming/audio feel, cultural/art review and intended-player regional latency remain unverified.
- **Browser/device matrix:** Chromium automation, including unsupported WebGL and pointer denial, passed. Installed Edge layout automation and user confirmation of the menu fix are recorded. Full physical Chrome/Edge gameplay, Firefox and Safari remain unverified.
- **Container runtime:** Dockerfile and instructions exist; Docker was unavailable, so container execution/restart is not claimed. Compiled Node production hosting was tested.
- **Latency fairness:** current-state hitscan is implemented; rewind is not. Higher latency worsens the measured moving-target result.

Refresh during a full room, interruption during every combat phase, long browser-session resource retention, and the complete renderer/input failure matrix remain broader QA. The original task checklist retains unchecked criteria where its full evidence is absent.

Most remaining work is release validation, host configuration and playtest-driven tuning, not another full implementation. No defensible exact percentage can be assigned before those external checks.

## Android alpha update — 13 October 2026

Added touch input, input-mode settings, mobile HUD, landscape entry guard and focus/orientation reset. 28 unit tests pass including nine input cases. Live Edge touch-mode checks confirmed quick pistol fire, reload, score/pause flow, landscape control fit and portrait guidance. These are desktop-browser checks, not physical Android certification. See mobile.md. The remaining human/device/regional network gates still apply; no public HTTPS/WSS verification is implied.
