import { BRAND, CAMPAIGN, MATCH_OPTIONS } from '@lastbus/shared';
export const RIFLE_ICON = '<svg viewBox="0 0 120 36" aria-hidden="true"><path d="M2 14h20l4-3h44l2-3h6v3h28v4h10v4H90l-4 3h-8l-6 13h-9l3-13H52l-4 9h-8l3-9H26l-6 5H6l-4-2z"/></svg>';
export const PISTOL_ICON = '<svg viewBox="0 0 120 36" aria-hidden="true"><path d="M38 6h46v4h4v6H62l-2 4h-6l-6 14H36l6-14-4-2z"/></svg>';
/** Touch control icons, drawn for Last Bus on a 24×24 grid in the current text colour. */
const svg = (body: string) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
export const ICON = {
  bullet: svg('<g transform="rotate(40 12 12)" fill="currentColor" stroke="none"><path d="M12 1.8c1.9 1.7 2.8 3.8 2.8 6.4H9.2c0-2.6.9-4.7 2.8-6.4z"/><rect x="9.2" y="9" width="5.6" height="10" rx=".5" opacity=".82"/><rect x="8.6" y="19.6" width="6.8" height="2" rx=".5"/></g>'),
  aim: svg('<circle cx="12" cy="12" r="7"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>'),
  crouch: svg('<circle cx="13" cy="4.5" r="2"/><path d="M12.5 7.5l-2.5 5 4 2.5-1 5.5"/><path d="M10 12.5l-4 1.5v5"/><path d="M12 8.5l4 2.5 2.5-1.5"/>'),
  jump: svg('<path d="M6 13l6-6 6 6"/><path d="M6 19l6-6 6 6"/>'),
  reload: svg('<path d="M19 12a7 7 0 1 1-2.05-4.95"/><path d="M19.5 3.5v4.5H15"/><rect x="10.5" y="9" width="3" height="6" rx=".6" fill="currentColor" stroke="none"/>'),
  use: svg('<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12"/><path d="M11 11V4.5a1.5 1.5 0 0 1 3 0V11"/><path d="M14 11V6a1.5 1.5 0 0 1 3 0v7c0 4-2.5 7-6 7-2.5 0-3.8-1.2-5.2-3.4L4 13.2a1.5 1.5 0 0 1 2.6-1.5L8 14"/>'),
  sprint: svg('<circle cx="15" cy="4.5" r="2"/><path d="M8 9l4-2 3 3 3 1"/><path d="M12 7l-2 6 4 3v5"/><path d="M10 13l-3 4H3"/>'),
  pause: svg('<path d="M8.5 5v14M15.5 5v14" stroke-width="3"/>'),
  scores: svg('<path d="M4 6h16M4 12h16M4 18h10"/>'),
  chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 14l5-5 5 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};
/** Every screen and overlay. Text that depends on state is filled in by main.ts from real data only. */
export function markup() {
  return `
  <section id="menu" class="screen" aria-label="Main menu">
    <div class="vignette"></div>
    <div class="logo"><div class="mark">${BRAND.title}</div><div class="city">${BRAND.city}</div><p>Police and Bandits fight for Ojuelegba Junction while the city's networks go dark. Play the story, take it online, or warm up on the range.</p></div>
    <nav class="nav" id="main-nav" aria-label="Main">
      <button class="nav-item" data-screen="story" id="nav-story"><span class="num">01</span><strong>Story</strong><span class="go">→</span><small>${CAMPAIGN.title} · Chapter 01 · Solo campaign</small></button>
      <button class="nav-item" data-screen="multiplayer" id="nav-multiplayer"><span class="num">02</span><strong>Multiplayer</strong><span class="go">→</span><small>Street Wars · Police vs Bandits · up to 8 players</small></button>
      <button class="nav-item" data-screen="training" id="nav-training"><span class="num">03</span><strong>Training range</strong><span class="go">→</span><small>Targets at measured distances, or bots</small></button>
      <button class="nav-item" data-screen="settings" id="nav-settings"><span class="num">04</span><strong>Settings</strong><span class="go">→</span><small>Controls, key bindings, video, audio, comfort</small></button>
    </nav>
    <aside class="feature" id="feature"></aside>
    <footer class="menu-foot"><span class="hints"><span><kbd>↑</kbd> <kbd>↓</kbd> Select</span><span><kbd>Enter</kbd> Open</span><span><kbd>Esc</kbd> Back</span><span>Headphones recommended</span></span><span id="build-label"></span></footer>
  </section>
  <header class="topbar" id="topbar">
    <div class="callsign"><label for="nickname">CALLSIGN</label><input id="nickname" maxlength="20" autocomplete="off" spellcheck="false"></div>
    <div class="top-right"><span id="server-status" class="tag"><span class="dot"></span>Checking server…</span><button id="settings-top" class="btn" aria-label="Settings">SETTINGS</button></div>
  </header>
  <section id="screen-story" class="page" hidden aria-label="Story">
    <div class="page-head"><div><button class="link back" data-back>← Main menu</button><div class="eyebrow">Story campaign</div><h1>${CAMPAIGN.title}</h1></div><p class="muted" style="max-width:460px;margin:0">${CAMPAIGN.premise}</p></div>
    <div class="grid">
      <div class="chapters" id="chapter-list"></div>
      <div class="card accent" id="mission-card"></div>
    </div>
  </section>
  <section id="screen-multiplayer" class="page" hidden aria-label="Multiplayer">
    <div class="page-head"><div><button class="link back" data-back>← Main menu</button><div class="eyebrow">Online</div><h1>Multiplayer</h1></div><span id="server-status-mp" class="tag"><span class="dot"></span>Checking server…</span></div>
    <div class="grid">
      <div>
        <button class="mode-card" id="play"><span><strong>Quick match</strong><small>Join a public Street Wars room. The match starts when four players have loaded on both teams.</small></span><span class="go">→</span></button>
        <button class="mode-card" id="create"><span><strong>Create private room</strong><small>Get an invitation link for friends. The host starts once both teams have a player.</small></span><span class="go">+</span></button>
        <form id="join-form" class="card" style="margin-top:6px"><h3>Join with an invitation</h3><p>Paste the invitation link or code you were sent.</p><div class="row"><input id="room-code" class="input" style="flex:1" required placeholder="Invitation link or code" autocomplete="off"><button class="btn primary" type="submit">Join</button></div></form>
      </div>
      <div class="card accent"><div class="eyebrow">Mode</div><h2>Street Wars</h2><div class="versus"><span class="p">Police</span><i>vs</i><span class="b">Bandits</span></div><p>Team elimination on ${BRAND.map}. Four minutes or thirty eliminations by default; private hosts can change both. Every shot, hit and kill is decided by the server.</p><div class="field"><span>Map</span><div class="tag">${BRAND.map} · the only map in this build</div></div><button class="link" id="join-open">Have a code? Use the form on the left</button></div>
    </div>
  </section>
  <section id="screen-training" class="page" hidden aria-label="Training range">
    <div class="page-head"><div><button class="link back" data-back>← Main menu</button><div class="eyebrow">Offline · local only</div><h1>Training range</h1></div><p class="muted" style="max-width:420px;margin:0">Runs entirely on this device. Targets and bots are labelled and never counted as online players.</p></div>
    <div class="grid"><div>
      <button class="mode-card" id="practice"><span><strong>Target practice</strong><small>Six targets down Ojuelegba Road from 10 to 49 metres. They respawn three seconds after they drop.</small></span><span class="go">→</span></button>
      <button class="mode-card" id="bots"><span><strong>Bot skirmish</strong><small>Three bots hunt you across the junction using the story AI. Uses the story difficulty setting.</small></span><span class="go">→</span></button>
    </div><div class="card"><h3>Controls</h3><div id="control-summary"></div></div></div>
  </section>
  <div id="briefing" class="modal" hidden><div class="briefing"><div class="story"><div class="eyebrow" id="brief-chapter"></div><h2 id="brief-title"></h2><div class="stamp" id="brief-stamp"></div><div id="brief-text" style="margin-top:18px"></div></div><div><div class="section-title">Intel</div><ul id="brief-intel"></ul><div class="section-title">Objectives</div><ul id="brief-objectives"></ul><div class="stack" style="margin-top:26px"><button class="btn primary wide" id="brief-start">Begin mission <span class="key">ENTER</span></button><button class="link" id="brief-cancel">← Back to campaign</button></div></div></div></div>
  <div id="loading" class="modal" hidden><div class="dialog"><div class="eyebrow">Loading</div><h2 id="loading-title">One moment</h2><p id="loading-text">Preparing the junction…</p><div class="loading-bar"></div></div></div>
  <div id="lobby" class="modal" hidden><div class="dialog wide">
    <div class="eyebrow" id="lobby-type">Street Wars</div><div class="row" style="justify-content:space-between;align-items:flex-end"><h2 id="lobby-title">Waiting at the junction</h2><span id="lobby-countdown" class="countdown" hidden></span></div>
    <p id="lobby-caption"></p><div id="roster" class="slots"></div>
    <div id="match-settings" class="row" hidden><label class="field" style="flex:1"><span>Match length</span><select id="opt-duration" class="input">${MATCH_OPTIONS.duration.map(d => `<option value="${d}">${d / 60} minutes</option>`).join('')}</select></label><label class="field" style="flex:1"><span>Elimination limit</span><select id="opt-kills" class="input">${MATCH_OPTIONS.killLimit.map(k => `<option value="${k}">${k}</option>`).join('')}</select></label></div>
    <div id="invite-box" class="field" hidden><span>Room invitation</span><div class="invite"><input id="invite-link" class="input" readonly aria-label="Room invitation link"><button id="copy-invite" class="btn">Copy</button></div></div>
    <div class="row" style="margin-top:16px"><button id="start-match" class="btn primary" hidden>Start match →</button><button id="switch-team" class="btn">Switch team</button><button id="leave-lobby" class="link">← Leave room</button></div>
  </div></div>
  <div id="hud" hidden><div class="hud-scale">
    <div class="compass" id="compass"></div>
    <div class="objective" id="objective" hidden></div>
    <div class="scorebar" id="scorebar" hidden><div class="side police"><small id="score0-label">POLICE</small><b id="score0">0</b></div><div class="clock"><b id="timer">04:00</b><small id="limit"></small></div><div class="side bandits"><b id="score1">0</b><small id="score1-label">BANDITS</small></div></div>
    <div id="markers"></div><div id="feed" class="kill-feed"></div><div id="notice" class="notice" hidden></div>
    <div id="crosshair"><i></i><i></i><i></i><i></i><b></b></div><div id="hit-marker"><i></i><i></i><i></i><i></i></div><div id="indicators"></div><div id="traverse-hint" hidden></div>
    <div id="prompt" class="prompt" hidden><span class="ring" id="prompt-ring"><kbd id="prompt-key">E</kbd></span><span id="prompt-text"></span></div>
    <div id="subtitle" class="subtitle" hidden></div>
    <div class="location" id="location">${BRAND.map.toUpperCase()}</div>
    <div class="vitals" id="vitals"><strong id="health">100</strong><div class="track"><small>HEALTH</small><div class="segs" id="health-segs">${'<i class="on"></i>'.repeat(10)}</div></div></div>
    <div class="weapon"><div class="ammo"><strong id="ammo">30</strong><span>/ <span id="reserve">90</span></span></div><div class="name"><span id="weapon-icon">${RIFLE_ICON}</span><span id="weapon-name">AK-26</span></div><div class="state" id="weapon-status"></div><div class="slots-mini"><span id="slot-1">1 RIFLE</span><span id="slot-2">2 SIDEARM</span></div></div>
    <div id="net-label"></div><pre id="diagnostics" class="diagnostics" hidden></pre>
    <div id="death" class="death" hidden><div class="eyebrow">Eliminated</div><h2 id="death-title">Down</h2><p id="respawn-label" class="muted"></p></div>
  </div><div id="damage"></div></div>
  <div id="fade"></div>
  <div id="phone" class="modal" hidden><div class="phone"><div class="phone-top"><b id="phone-from"></b><span id="phone-time"></span></div><canvas id="phone-photo" width="360" height="240"></canvas><div id="phone-body"></div><button id="phone-close" class="btn primary wide">Put the phone away <span class="key">ENTER</span></button></div></div><div id="chapter-card" class="chapter-card" hidden></div>
  <div id="cinema" hidden><div class="cinema-bar top"></div><div id="cinema-caption" aria-live="polite"></div><div id="cinema-flash"></div><div id="cinema-phone" hidden><div class="cp-top"><span id="cp-bars"><i></i><i></i><i></i><i></i></span><b id="cp-net"></b></div><div id="cp-body"></div><div id="cp-status"></div></div><div class="cinema-bar bottom"><p id="cinema-line"></p><p id="cinema-extra"></p><span class="cinema-skip"><span><kbd>CLICK</kbd> next line · Hold <kbd>SPACE</kbd> to skip scene</span><i id="cinema-skip"></i></span></div></div>
  <div id="pause" class="modal" hidden><div class="dialog"><div class="eyebrow" id="pause-tag">Paused</div><h2 id="pause-title">Paused</h2><p id="pause-caption"></p><p class="rotate-hint">Turn your phone sideways to play.</p><div class="stack" id="pause-actions">
    <button id="resume" class="btn primary wide">Resume <span class="key">CLICK</span></button>
    <button id="pause-settings" class="btn wide">Settings</button>
    <button id="pause-checkpoint" class="btn wide" hidden>Restart from checkpoint</button>
    <button id="pause-restart" class="btn wide" hidden>Restart mission</button>
    <button id="leave-game" class="btn danger wide">Leave</button></div></div></div>
  <div id="scoreboard" class="modal" hidden><div class="dialog wide"><button id="scores-close" class="link" hidden>Close ×</button><div class="eyebrow">Street Wars</div><h2>Scoreboard</h2><div id="score-table"></div></div></div>
  <div id="results" class="modal" hidden><div class="dialog wide"><div class="eyebrow">Match complete</div><h2 id="result-title">Match complete</h2><div id="result-score" class="result-score"></div><div id="results-table"></div><p id="result-caption"></p><div class="row"><button id="return-lobby" class="btn primary" disabled>Lobby</button><button id="leave-results" class="link">← Main menu</button></div></div></div>
  <div id="mission-end" class="modal" hidden><div class="dialog wide"><div class="eyebrow" id="end-tag">Mission complete</div><h2 id="end-title"></h2><p id="end-text"></p><div class="stats" id="end-stats"></div><div class="row"><button id="end-primary" class="btn primary">Replay mission</button><button id="end-secondary" class="btn">Restart mission</button><button id="end-menu" class="link">← Campaign</button></div></div></div>
  <div id="confirm" class="modal" hidden><div class="dialog"><div class="eyebrow">Confirm</div><h2 id="confirm-title">Are you sure?</h2><p id="confirm-text"></p><div class="row"><button id="confirm-yes" class="btn danger">Yes</button><button id="confirm-no" class="btn">Cancel</button></div></div></div>
  <div id="settings" class="modal" hidden><div class="settings" role="dialog" aria-label="Settings"><header><div><div class="eyebrow">Preferences stay on this device</div><h2>Settings</h2></div><button class="btn" id="settings-close">Done</button></header><nav class="tabs" role="tablist" id="settings-tabs"></nav><div class="tab-body" id="settings-body"></div></div></div>
  <div id="status" class="status" role="status" aria-live="polite"></div>
  <div id="rotate" aria-live="polite"><div class="phone"></div><h2>Turn your phone sideways</h2><p>Last Bus is played in landscape. The game is paused until you rotate.</p></div>
  <div id="touch-controls" aria-label="Touch game controls" hidden>
    <div id="touch-look" aria-label="Drag to aim"></div>
    <div class="touch-top"><button id="touch-pause" class="tc small" aria-label="Pause game">${ICON.pause}</button><button id="touch-scores" class="tc small" aria-label="Scores">${ICON.scores}</button></div>
    <div id="touch-move" aria-label="Movement joystick"><i class="chev up">${ICON.chevron}</i><i class="chev right">${ICON.chevron}</i><i class="chev down">${ICON.chevron}</i><i class="chev left">${ICON.chevron}</i><span id="touch-knob"></span></div>
    <button id="touch-sprint" class="tc" aria-pressed="false" aria-label="Sprint">${ICON.sprint}</button>
    <button id="touch-fire-left" class="tc fire" aria-label="Fire (left hand)">${ICON.bullet}</button>
    <button id="touch-fire" class="tc fire big" aria-label="Fire and drag to aim">${ICON.bullet}</button>
    <button id="touch-aim" class="tc" aria-pressed="false" aria-label="Aim down sights">${ICON.aim}</button>
    <button id="touch-crouch" class="tc" aria-pressed="false" aria-label="Crouch">${ICON.crouch}</button>
    <button id="touch-jump" class="tc" aria-label="Jump">${ICON.jump}</button>
    <button id="touch-reload" class="tc" aria-label="Reload">${ICON.reload}</button>
    <button id="touch-use" class="tc use" aria-label="Interact">${ICON.use}<small>HOLD</small></button>
    <div class="touch-tray"><button id="touch-rifle" class="slot" aria-label="Rifle">${RIFLE_ICON}<b id="touch-ammo-rifle">30/90</b></button><button id="touch-sidearm" class="slot" aria-label="Pistol">${PISTOL_ICON}<b id="touch-ammo-sidearm">12/48</b></button></div>
    <div id="radar" class="radar" aria-hidden="true"><span class="ring"></span><span class="north">N</span><span class="me"></span></div>
  </div>`;
}
