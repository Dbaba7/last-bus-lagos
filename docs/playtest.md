# First friends playtest

Updated 12 October 2026. The user is in Toronto and has two friends in Nigeria. The budget is currently zero. A GitHub account is available; no hosting account, source repository or deployment has been created for this game. The first release is for a small friends playtest.

## Immediate layout issue

The user reported that controls below Play were clipped in Microsoft Edge on a 1920 × 1080 display at 125% Windows scaling. Replaced the absolutely positioned menu content/footer with a responsive grid, height-aware heading sizes and a scrollable menu fallback. Modal panels fit the available viewport and scroll internally.

The user refreshed and confirmed that all controls are visible. Automated installed Edge 155.0.4283.45 checks covered 1920×1080, 1536×864, 1536×760, 1366×768, 1280×720, 1024×576 and 800×450 CSS viewports at device scale 1.25. The old layout clipped at the shortest viewport; the user's exact original failure was not reproduced at 1536×864 in headless automation. This is UI verification, not a complete physical-device gameplay certification. Reports/screenshots are in ignored artifacts/layout-before* and artifacts/layout-after*.

## Hosting recommendation

Start with one **Render Free web service** on a free Hobby workspace, serving both the client and the persistent Node room server. This is a proposal, not a completed deployment. Use the supplied provider subdomain; no domain or database purchase is needed for this prototype. The user can sign in to [Render](https://dashboard.render.com/) with the existing GitHub account. Keep the source repository private.

Render supports [WebSockets](https://render.com/docs/websocket). Its [free service](https://render.com/docs/free) sleeps after 15 minutes without incoming traffic and usually takes about a minute to wake. It has monthly limits and may restart; a restart ends this game's in-memory rooms. Free is suitable for trying the game with friends, with actual performance still to be measured on that shared CPU. Without a payment method, exceeding the included bandwidth suspends free services instead of billing overage; monitor the account's included usage.

If reliable availability becomes worth paying for, Render's smallest paid web compute is currently **US$7/month**, before usage extras and tax. Its free Hobby workspace does not require the paid Pro workspace for that upgrade. [Current pricing](https://render.com/pricing). Railway's Hobby option has a lower **US$5/month minimum**, including that amount of usage; additional usage can increase the bill. [Railway pricing](https://docs.railway.com/pricing/plans). These are not claims of the globally cheapest hosting or guaranteed capacity.

Frankfurt is an initial region candidate for the Toronto–Nigeria group, not a measured latency winner. Compare the players' actual pings; Virginia is another available candidate. [Render regions](https://render.com/docs/regions). A region change requires creating a replacement service. Do not enable multiple replicas: this prototype currently keeps rooms in one server process. Larger single-server plans provide an early upgrade path; running several servers requires additional matchmaking/routing work.

## Responsibilities

| Item | User | Assistant |
| --- | --- | --- |
| Hosting | Sign in to the free hosting account and connect the intended GitHub account | Prepare a private source repository and deployment configuration once authorized; verify HTTPS/WSS and health |
| Two-device check | Join from a PC with one friend on another PC | Supply the URL and invitation flow; investigate any connection or rendering failures |
| Three-player trial | Play with both friends using a private room | Review problems and tune the game from observations |
| Four-player balance | Invite the brother if he has a PC, when available | Assess 2-versus-2 spawns, routes and encounter balance |
| Browsers | Use normal Edge on the user's PC; friends record Chrome/Edge/Firefox and display settings | Automate available browsers and fix reported differences |
| Containers | No Docker installation needed for native Node hosting | Keep container validation separate; test it if that deployment method is selected |
| Latency | Record ping and examples of delayed/missing hits from both countries | Measure server work/network effects; decide whether bounded server rewind is justified |

Private rooms can start at two players. Three players can check functionality but create a 2-versus-1 match: rotate teams and do not treat that as balanced-match evidence. Public matchmaking still requires four players. Phones do not replace desktop keyboard-and-mouse testers. Unlisted room invitations restrict joining that room; the hosting URL itself is publicly reachable, with no site-wide login gate currently implemented.

## First session: about 20–30 minutes

1. Open the hosted page before the agreed start so a sleeping free server can wake. Use **Create private room**, share its invitation, and start when the players are ready.
2. Confirm all menu/HUD controls fit each PC. Record browser, display resolution, Windows scaling, browser zoom and network type.
3. Play a complete match and rematch. Both weapons, reload, respawn, scores and returning to the lobby should work. Briefly leave and rejoin.
4. Hold Tab and note each player's typical ping. Try stationary and moving targets at similar distances. Report delayed damage, apparent misses, rubber-banding or being hit after reaching cover with the approximate time and a short clip if convenient.
5. Listen for both weapons and footsteps using headphones. Ask the Nigerian players which signs, props or environmental details feel convincing or distracting.
6. For each bug, send the screen involved, what was clicked/pressed, what happened and what was expected. The next development pass should address those observations before recruiting more players.

Current-state hitscan checks targets when input reaches the server. A delayed shot can therefore miss a moving target that appeared lined up on the shooter's screen. Server rewind would consult recent target history, with validation and a bounded window; it is an engineering feature to assess after the cross-region test, not something testers must configure.

## 13 October 2026 scope update

Nigeria is the target market; the Toronto player is helping test. Android Chrome is now first priority. One Nigerian tester uses an S25 Ultra; another has an unspecified iPhone about 3–4 years old. Touch controls are implemented as an alpha, so phones can now participate in exploratory tests; the earlier desktop-only tester guidance is superseded. Follow mobile.md before treating any phone as verified. Seek a budget Android tester later.

Render account is signed in and private repository Qudios/last-bus-lagos exists. Start with Frankfurt, prioritizing Nigerian players. Actual hosting, repository upload and permission/deployment status are recorded in RESUME.md. No paid resources are authorized.
