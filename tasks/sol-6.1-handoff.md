# Handoff prompt for Sol 6.1

Historical planning handoff. Implementation has since been authorized and built. Start with docs/RESUME.md and docs/release-verification.md rather than restarting T01.

This prompt is for a future implementation session. Creating this document did not authorize implementation in the planning session.

Copy the following into Sol 6.1 when ready to build in this workspace:

> Implement LAST BUS: LAGOS using the approved plan in `tasks/plan.md`, the ordered checklist in `tasks/todo.md`, and the original requirements in `tasks/source-brief.txt`.
>
> First inspect the repository and applicable agent instructions again. Preserve existing changes. The planning assessment found an empty Git repository; do not assume it is still empty. Read the plan and checklist before installing packages or editing application code.
>
> Execute T01 onward in dependency order. Your first playable deliverable is M1: an actual first-person range with movement, collision, aiming, rifle firing, reloading and target hits. Then prioritize M2: real server-authoritative multiplayer with two independent clients and two functional weapons. Continue through the complete match, Lagos arena, public/private room flow, stabilization and deployment gates. Do not stop at a menu or label a local shooting range as completed multiplayer.
>
> Keep TypeScript, Babylon.js, Vite, Node.js and Colyseus unless the compatibility spike proves a concrete blocker. Verify current package metadata, licenses and matching SDK/server/schema APIs, pin the working set, and record it. Follow the shared collision, authoritative input/combat, match edge-case and reconnect decisions in the plan. Choose simple implementation details independently; record material deviations with reasons and evidence.
>
> Work in small runnable slices. Create files when needed, avoid empty scaffolding, and subdivide tasks that become too broad. Do not introduce accounts, persistent rankings, bots, extra maps, advanced movement or monetization. Use the real match scoreboard as the initial leaderboard. Keep game branding and tuning configurable.
>
> Run the task's relevant checks and actual runtime flow before marking it complete. At each checkpoint update `tasks/todo.md` and `docs/dev-log.md` with what changed, exact commands, observed results, limitations and next work. Do not fabricate tests, performance, player counts, screenshots or deployed URLs. Distinguish independent SDK/browser clients from physical-device and human playtests. Keep unexecuted checks unchecked.
>
> Once authorized to implement, proceed through ordinary engineering checkpoints without repeatedly asking for approval. Use sequential work by default. If using the source brief's optional multi-agent workflow, define stable contracts and file ownership first; the lead owns shared code and integration. Never have multiple agents rewrite the same foundation.
>
> Finish everything possible locally and prepare a concrete production candidate before requesting missing hosting credentials or new paid-service approval. Do not provision paid infrastructure without approval. Actual online validation requires the deployed HTTPS/WSS path and two physical devices; mark missing access or test participants as specific blockers rather than claiming release completion.
>
> End with a concise report of playable features, how to run them, tests actually executed, measured performance, actual deployed URLs if available, and remaining blockers. Link the relevant files and evidence.
