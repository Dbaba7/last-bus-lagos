import { InputController } from './input.js';

export class TouchControls {
  private releases: (() => void)[] = [];
  constructor(private input: InputController, private root: HTMLElement, onScores: () => void) {
    const el = (id: string) => root.querySelector<HTMLElement>(`#${id}`)!;
    const stick = el('touch-move'), knob = el('touch-knob'), sprint = el('touch-sprint');
    let centreX = 0, centreY = 0, radius = 1;
    const move = (e: PointerEvent) => {
      const x = (e.clientX - centreX) / radius, z = (centreY - e.clientY) / radius;
      const length = Math.max(1, Math.hypot(x, z));
      input.move(Math.abs(x) < 0.08 ? 0 : x, Math.abs(z) < 0.08 ? 0 : z);
      knob.style.transform = `translate(${x / length * radius}px, ${-z / length * radius}px)`;
    };
    this.bind(stick, e => {
      const rect = stick.getBoundingClientRect(); centreX = rect.left + rect.width / 2; centreY = rect.top + rect.height / 2; radius = rect.width * 0.36; move(e);
    }, move, () => { input.move(0, 0); knob.style.transform = ''; });
    // Each captured pointer owns one control, so movement survives an aim/fire
    // finger leaving its original bounds or lifting independently.
    const aim = (id: string, fire: boolean) => {
      let x = 0, y = 0;
      this.bind(el(id), e => { x = e.clientX; y = e.clientY; if (fire) input.fire(true); }, e => {
        input.look(e.clientX - x, e.clientY - y); x = e.clientX; y = e.clientY;
      }, cancelled => { if (fire) input.fire(false, cancelled); });
    };
    aim('touch-look', false); aim('touch-fire', true); aim('touch-fire-left', true);
    for (const action of ['jump', 'reload', 'rifle', 'sidearm'] as const) el(`touch-${action}`).onclick = () => input.action(action);
    for (const action of ['aim', 'crouch'] as const) { const button = el(`touch-${action}`); button.onclick = () => { if (!input.active || !input.action(action)) return; button.setAttribute('aria-pressed', String(button.getAttribute('aria-pressed') !== 'true')); }; }
    this.bind(el('touch-use'), () => input.holdInteract(true), () => {}, () => input.holdInteract(false));
    sprint.onclick = () => { if (!input.active) return; const pressed = sprint.getAttribute('aria-pressed') !== 'true'; sprint.setAttribute('aria-pressed', String(pressed)); input.sprint(pressed); };
    el('touch-pause').onclick = () => input.pause(); el('touch-scores').onclick = onScores;
    root.addEventListener('contextmenu', e => e.preventDefault());
    input.onClear = () => { for (const release of this.releases) release(); for (const id of ['touch-sprint', 'touch-aim', 'touch-crouch']) el(id).setAttribute('aria-pressed', 'false'); };
    const orientation = window.matchMedia('(orientation: portrait)');
    orientation.addEventListener('change', () => { if (input.touchMode) input.pause(); });
  }
  sync() { this.root.hidden = !this.input.touchMode || !this.input.enabled || !this.input.active; }
  private bind(element: HTMLElement, down: (e: PointerEvent) => void, move: (e: PointerEvent) => void, up: (cancelled: boolean) => void) {
    let pointer: number | undefined;
    const release = (cancelled = true) => {
      const id = pointer; pointer = undefined; element.classList.remove('pressed'); up(cancelled);
      if (id !== undefined && element.hasPointerCapture(id)) element.releasePointerCapture(id);
    };
    this.releases.push(release);
    element.addEventListener('pointerdown', e => {
      if (pointer !== undefined || !this.input.enabled || !this.input.active || e.button !== 0) return;
      e.preventDefault(); pointer = e.pointerId; element.setPointerCapture(pointer); element.classList.add('pressed'); down(e);
    });
    element.addEventListener('pointermove', e => { if (e.pointerId === pointer) { e.preventDefault(); move(e); } });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) element.addEventListener(name, e => { if ((e as PointerEvent).pointerId === pointer) release(name !== 'pointerup'); });
  }
}
