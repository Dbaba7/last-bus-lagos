import { ACTION_LABELS, DEFAULT_BINDINGS, PRESETS, keyName, type Action, type Preferences, type Quality } from '../settings.js';
import type { InputController } from '../input.js';
type Row = { kind: 'range'; key: keyof Preferences; label: string; hint?: string; min: number; max: number; step: number; format: (v: number) => string; id?: string }
  | { kind: 'switch'; key: keyof Preferences; label: string; hint?: string }
  | { kind: 'select'; key: keyof Preferences | 'controls'; label: string; hint?: string; options: [string, string][]; id?: string }
  | { kind: 'title'; label: string } | { kind: 'binds' };
const pct = (v: number) => `${Math.round(v * 100)}%`;
const TABS: Record<string, Row[]> = {
  Controls: [
    { kind: 'select', key: 'controls', label: 'Input device', options: [['mouse', 'Keyboard and mouse'], ['touch', 'Touch (Android alpha)']], id: 'controls' },
    { kind: 'range', key: 'sensitivityX', label: 'Horizontal sensitivity', min: 0.1, max: 4, step: 0.05, format: v => v.toFixed(2), id: 'sensitivity' },
    { kind: 'range', key: 'sensitivityY', label: 'Vertical sensitivity', min: 0.1, max: 4, step: 0.05, format: v => v.toFixed(2), id: 'sensitivity-y' },
    { kind: 'range', key: 'aimMultiplier', label: 'Aim-down-sights multiplier', hint: 'Scales sensitivity while aiming', min: 0.3, max: 1.5, step: 0.05, format: v => `×${v.toFixed(2)}` },
    { kind: 'switch', key: 'invertY', label: 'Invert vertical look' },
    { kind: 'switch', key: 'toggleAim', label: 'Toggle aim', hint: 'Off: hold right mouse button' },
    { kind: 'switch', key: 'toggleCrouch', label: 'Toggle crouch' },
    { kind: 'switch', key: 'toggleSprint', label: 'Toggle sprint' },
    { kind: 'title', label: 'Key bindings' }, { kind: 'binds' }
  ],
  Gameplay: [
    { kind: 'select', key: 'difficulty', label: 'Story and bot difficulty', hint: 'Changes enemy reaction time, accuracy, damage and aggression', options: [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']] },
    { kind: 'range', key: 'fov', label: 'Field of view', hint: 'Horizontal degrees', min: 70, max: 110, step: 1, format: v => `${v}°` },
    { kind: 'range', key: 'hudScale', label: 'HUD scale', min: 0.8, max: 1.25, step: 0.05, format: pct },
    { kind: 'switch', key: 'diagnostics', label: 'Performance overlay', hint: 'Frame time, position and network details. F3 toggles in game' }
  ],
  Video: [
    { kind: 'select', key: 'quality', label: 'Quality preset', options: [['low', 'Low — fastest'], ['medium', 'Medium — balanced'], ['high', 'High — full detail']], id: 'quality' },
    { kind: 'select', key: 'shadows', label: 'Sun shadows', options: [['off', 'Off'], ['low', 'Low (2048)'], ['high', 'High (4096)']] },
    { kind: 'range', key: 'renderScale', label: 'Render scale', hint: 'Lower values render fewer pixels', min: 0.5, max: 1, step: 0.05, format: pct },
    { kind: 'switch', key: 'postEffects', label: 'Post effects', hint: 'Anti-aliasing and bloom' }
  ],
  Audio: [
    { kind: 'range', key: 'master', label: 'Master volume', min: 0, max: 1, step: 0.05, format: pct, id: 'volume' },
    { kind: 'range', key: 'effects', label: 'Weapons and effects', min: 0, max: 1, step: 0.05, format: pct },
    { kind: 'range', key: 'ambience', label: 'City ambience', min: 0, max: 1, step: 0.05, format: pct },
    { kind: 'range', key: 'music', label: 'Music', min: 0, max: 1, step: 0.05, format: pct },
    { kind: 'range', key: 'dialogue', label: 'Dialogue and radio', min: 0, max: 1, step: 0.05, format: pct },
    { kind: 'switch', key: 'matureLanguage', label: 'Mature language', hint: 'Strong language in story dialogue. Off uses cleaner alternative lines' },
    { kind: 'switch', key: 'licensedMusic', label: 'Licensed music', hint: 'Off always plays original music, for streaming and video' }
  ],
  Comfort: [
    { kind: 'range', key: 'cameraShake', label: 'Camera shake and weapon sway', min: 0, max: 1, step: 0.05, format: pct },
    { kind: 'range', key: 'headBob', label: 'Weapon bob', min: 0, max: 1, step: 0.05, format: pct },
    { kind: 'select', key: 'subtitleSize', label: 'Subtitle size', options: [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']] }
  ]
};
/** Builds the settings dialog. Every control writes the preference and calls `changed`, which applies it to the real system. */
export class SettingsView {
  private tab = 'Controls'; private listening?: Action;
  constructor(private tabs: HTMLElement, private body: HTMLElement, private pref: Preferences, private input: InputController, private changed: (key: string) => void, private controlMode: () => string) {
    tabs.innerHTML = Object.keys(TABS).map(t => `<button role="tab" data-tab="${t}" aria-selected="${t === this.tab}">${t}</button>`).join('');
    tabs.onclick = e => { const t = (e.target as HTMLElement).closest('[data-tab]') as HTMLElement | null; if (t) { this.tab = t.dataset.tab!; this.render(); } };
    this.render();
  }
  render() {
    for (const b of this.tabs.querySelectorAll('button')) b.setAttribute('aria-selected', String(b.dataset.tab === this.tab));
    this.body.innerHTML = TABS[this.tab].map(row => this.row(row)).join('');
    for (const el of this.body.querySelectorAll<HTMLInputElement>('input[type=range]')) el.oninput = () => { (this.pref as unknown as Record<string, number>)[el.dataset.key!] = Number(el.value); (el.nextElementSibling as HTMLElement).textContent = (TABS[this.tab].find(r => 'key' in r && r.key === el.dataset.key) as Extract<Row, { kind: 'range' }>).format(Number(el.value)); this.changed(el.dataset.key!); };
    for (const el of this.body.querySelectorAll<HTMLButtonElement>('.switch')) el.onclick = () => { const key = el.dataset.key as keyof Preferences; (this.pref as unknown as Record<string, boolean>)[key] = !this.pref[key]; el.setAttribute('aria-checked', String(this.pref[key])); this.changed(key); };
    for (const el of this.body.querySelectorAll<HTMLSelectElement>('select')) el.onchange = () => {
      const key = el.dataset.key!; if (key !== 'controls') (this.pref as unknown as Record<string, string>)[key] = el.value;
      if (key === 'quality') Object.assign(this.pref, PRESETS[el.value as Quality]);
      this.changed(key === 'controls' ? `controls:${el.value}` : key); if (key === 'quality') this.render();
    };
    for (const el of this.body.querySelectorAll<HTMLButtonElement>('.bind')) el.onclick = () => this.capture(el.dataset.action as Action, Number(el.dataset.slot));
    const reset = this.body.querySelector<HTMLButtonElement>('#reset-binds'); if (reset) reset.onclick = () => { this.pref.bindings = structuredClone(DEFAULT_BINDINGS); this.changed('bindings'); this.render(); };
  }
  private row(row: Row) {
    if (row.kind === 'title') return `<div class="section-title">${row.label}</div>`;
    if (row.kind === 'binds') return (Object.keys(ACTION_LABELS) as Action[]).map(a => `<div class="setting"><label>${ACTION_LABELS[a]}</label><div class="control">${[0, 1].map(i => `<button class="bind ${this.listening === a ? 'listening' : ''}" data-action="${a}" data-slot="${i}">${this.pref.bindings[a][i] ? keyName(this.pref.bindings[a][i]) : '—'}</button>`).join('')}</div></div>`).join('')
      + `<div class="setting"><label>Fixed keys<small>Left mouse fires, right mouse aims, Esc pauses. Ctrl shortcuts can close the browser tab, so crouch defaults to C.</small></label><div class="control"><button class="btn" id="reset-binds">Reset defaults</button></div></div>`;
    const hint = row.hint ? `<small>${row.hint}</small>` : '';
    if (row.kind === 'range') { const v = this.pref[row.key] as number; return `<div class="setting"><label for="${row.id ?? row.key}">${row.label}${hint}</label><div class="control"><input type="range" id="${row.id ?? row.key}" data-key="${row.key}" min="${row.min}" max="${row.max}" step="${row.step}" value="${v}"><output>${row.format(v)}</output></div></div>`; }
    if (row.kind === 'switch') return `<div class="setting"><label>${row.label}${hint}</label><div class="control"><button class="switch" role="switch" data-key="${row.key}" aria-checked="${!!this.pref[row.key]}" aria-label="${row.label}"></button></div></div>`;
    const value = row.key === 'controls' ? this.controlMode() : String(this.pref[row.key]);
    return `<div class="setting"><label for="${row.id ?? row.key}">${row.label}${hint}</label><div class="control"><select class="input" id="${row.id ?? row.key}" data-key="${row.key}">${row.options.map(([v, l]) => `<option value="${v}" ${v === value ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>`;
  }
  /** Waits for the next key or mouse button; Escape cancels. A key already used elsewhere is moved, never duplicated. */
  private capture(action: Action, slot: number) {
    this.listening = action; this.render();
    this.input.capture = code => {
      this.input.capture = undefined; this.listening = undefined;
      if (code && code !== 'Mouse0' && code !== 'Mouse2') {
        for (const other of Object.keys(this.pref.bindings) as Action[]) this.pref.bindings[other] = this.pref.bindings[other].filter(c => c !== code);
        const list = [...this.pref.bindings[action]]; list[slot] = code; this.pref.bindings[action] = list.filter(Boolean).slice(0, 2); this.changed('bindings');
      }
      this.render();
    };
  }
}
