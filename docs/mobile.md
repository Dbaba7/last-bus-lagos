# Android touch alpha

Updated 13 October 2026. Nigeria is the target market; the Toronto user is a tester. Android Chrome is the first mobile target. The first known Android tester has a Samsung S25 Ultra. Another tester has an unidentified iPhone roughly 3–4 years old. Network type is not yet known. An S25 Ultra does not represent budget Android performance.

## Implemented

- Independent pointer capture for move, look and fire. Multiple fingers can act together; dragging Fire also aims.
- Analog movement, sprint toggle, jump, reload, rifle/pistol selection, scores and pause.
- Shared input-frame protocol, prediction and authoritative server validation. No mobile-only combat authority or aim assist.
- Short fire taps survive until the next simulation tick; cancellation discards an unsent tap.
- Pause and release captures on blur, hidden tab or orientation change. Respawn clears held actions. Resume is deliberate. Gameplay requires landscape; menus remain usable in portrait.
- Coarse-pointer devices default to touch controls and Low graphics when no saved preference exists. A Settings control selector supports hybrid devices and manual fallback. Display-safe insets and dynamic viewport height keep controls inside the visible area.

## Evidence and limits

28 unit tests pass, including nine new input cases: concurrent move/aim/fire, unrelated pointer release, cancellation/capture loss, one-shot actions, quick-tap server firing, focus/visibility/rotation clearing, portrait entry, pitch clamps and desktop input/denied pointer lock.

Live Edge checks used the touch mode at requested 800×360 and 568×320 landscape viewport overrides and 360×800 portrait. This browser profile uses 90% zoom, so the CSS viewport is larger than the override (for example 889×400). Controls fit the observed viewport; short presses reduced pistol ammo, reload replenished it, score/menu return worked, and portrait entry showed rotation guidance. Browser checks used mouse/pointer simulation, not a physical multitouch phone. Screenshot: ignored artifacts/android-touch-preview.png.

Still pending: real Android Chrome multitouch, S25 Ultra full match/rematch, low-end Android frame rate/heat/battery, Nigerian carrier/Wi-Fi latency, iPhone Safari audio and pointer behavior. Do not label mobile generally verified or infer low-end performance from the S25 Ultra.

## First phone session

1. On Android Chrome, open the playtest URL in landscape. Check that Touch and Low graphics are selected; start local Practice first.
2. Use two thumbs to move and aim; then move while dragging Fire. Check jump, reload, both weapons, sprint toggle and scores. No held action should remain after lifting fingers.
3. Rotate, switch tabs, lock/unlock the screen, then resume. Verify controls reset and audio returns.
4. Join a private room with another device; play a full match and rematch. Note ping from Scores, frame stutter, delayed shots and any overlap with browser bars/notches.
5. Report phone model, browser, mobile network/Wi-Fi, city, graphics setting and approximate session length. Repeat on a budget Android phone before claiming broad Nigerian-market readiness.

The iPhone friend can try the same flow as exploratory QA after Android. No separate app install is required. Do not assume Safari is tested from Chromium results.
