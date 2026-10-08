/**
 * The guide for the first ten minutes (shared/tutorial.js), drawn: one line
 * at the top, a ring on the thing to touch, a hand that shows the gesture —
 * dragging on the left to walk, sweeping on the right to look — and an arrow
 * over the wild creature to go to. Each step is done by doing it; the server
 * keeps which are done, so a reload or a second phone carries on from there.
 *
 * It watches rather than intercepts: the game tells it what happened
 * (`event`), and once a frame (`tick`) it checks the two steps that are
 * measured (how far you walked, how far the camera turned) and puts the
 * ring and the hand where they belong.
 */
import { Vector3 } from 'three';
import { TUTORIAL, nextStep } from '../shared/tutorial.js';

const $ = (s) => document.querySelector(s);

export class Coach {
  constructor(game) {
    this.game = game;
    this.walked = 0;
    this.turned = 0;
    this.lastPos = null;
    this.lastYaw = null;
    this.shownAt = 0;
    this.current = null;
    this.sent = new Set();
    this.build();
  }

  build() {
    const host = $('#app') || document.body;
    this.el = document.createElement('div');
    this.el.id = 'coach';
    this.el.className = 'hidden';
    this.el.setAttribute('role', 'status');
    this.el.innerHTML = '<div class="coach-bubble"><span class="coach-ico" aria-hidden="true"></span><span class="coach-text"></span><span class="coach-n"></span><button type="button" class="coach-skip">דלג</button></div>';
    this.ring = document.createElement('div');
    this.ring.id = 'coach-ring';
    this.ring.className = 'hidden';
    this.hand = document.createElement('div');
    this.hand.id = 'coach-hand';
    this.hand.className = 'hidden';
    this.hand.textContent = '👆';
    this.arrow = document.createElement('div');
    this.arrow.id = 'coach-arrow';
    this.arrow.className = 'hidden';
    this.arrow.textContent = '⬇';
    host.append(this.el, this.ring, this.hand, this.arrow);
    this.el.querySelector('.coach-skip').onclick = () => {
      if (!this.el.querySelector('.coach-skip').dataset.armed) {
        const b = this.el.querySelector('.coach-skip');
        b.dataset.armed = '1', b.textContent = 'לדלג על כל המדריך?';
        setTimeout(() => { b.dataset.armed = '', b.textContent = 'דלג'; }, 3000);
        return;
      }
      this.game.net.send('tutorial', { skip: true });
      this.tut = { ...(this.tut || {}), skipped: true };
      this.hide();
    };
  }

  /** The state from the server (profile.tutorial, or the 'tutorial' reply). */
  set(tut) {
    this.tut = tut ? { steps: [...(tut.steps || [])], done: !!tut.done, skipped: !!tut.skipped } : null;
    for (const id of this.tut?.steps || []) this.sent.add(id);
  }

  /** Something happened that may finish a step. */
  event(id) {
    if (!this.tut || this.tut.done || this.tut.skipped || this.sent.has(id)) return;
    if (!TUTORIAL.some((s) => s.id === id)) return;
    this.sent.add(id);
    this.tut.steps.push(id);
    this.game.net.send('tutorial', { did: id });
    this.flash();
  }

  flash() {
    this.el.classList.remove('done-flash');
    void this.el.offsetWidth;
    this.el.classList.add('done-flash');
  }

  hide() {
    for (const n of [this.el, this.ring, this.hand, this.arrow]) n.classList.add('hidden');
    this.current = null;
  }

  /** Once a frame. */
  tick() {
    const g = this.game, mode = g.mode === 'battle' ? 'battle' : g.mode === 'world' ? 'world' : null;
    const busy = !mode || g.ui.openPanelId || document.body.classList.contains('ceremony') || g.cutscene?.active || g.transitioning;
    const step = !busy && this.tut && nextStep(this.tut, mode);
    if (!step) return this.hide();
    if (this.current !== step.id) {
      this.current = step.id, this.shownAt = performance.now();
      this.el.querySelector('.coach-ico').textContent = step.icon;
      this.el.querySelector('.coach-text').textContent = step.he;
      this.el.querySelector('.coach-n').textContent = `${(this.tut.steps || []).length + 1}/${TUTORIAL.length}`;
      this.el.classList.toggle('in-battle', mode === 'battle');
      this.el.classList.remove('hidden');
    }
    // the measured steps: walking a few metres, turning the camera a little
    if (mode === 'world') {
      const p = g.world.selfPosition?.();
      if (p && this.lastPos) this.walked += Math.min(2, Math.hypot(p.x - this.lastPos.x, p.z - this.lastPos.z));
      p && (this.lastPos = { x: p.x, z: p.z });
      const yaw = g.world.camYaw;
      if (this.lastYaw != null) this.turned += Math.abs(yaw - this.lastYaw);
      this.lastYaw = yaw;
      step.id === 'move' && this.walked > 4 && this.event('move');
      // nobody is held up on the camera: after a while it moves on by itself
      step.id === 'look' && (this.turned > 0.9 || performance.now() - this.shownAt > 25000) && this.event('look');
    }
    this.point(step, mode);
  }

  /** The ring, the hand and the arrow for this step. */
  point(step, mode) {
    const g = this.game;
    let ring = null, hand = null, arrow = null;
    const rectOf = (sel) => { const n = $(sel); if (!n || n.classList.contains('hidden') || !n.offsetParent) return null; const r = n.getBoundingClientRect(); return r.width ? r : null; };
    if (step.id === 'move') hand = { kind: 'drag', x: innerWidth * 0.2, y: innerHeight * 0.78 };
    else if (step.id === 'look') hand = { kind: 'swipe', x: innerWidth * 0.62, y: innerHeight * 0.48 };
    else if (step.id === 'talk' || step.id === 'fight') {
      // near enough to the one to talk to (or fight): the big button
      const label = $('#btn-action')?.textContent || '';
      if ((step.id === 'talk' && label === 'דבר') || (step.id === 'fight' && label === 'קרב')) ring = rectOf('#btn-action');
      if (step.id === 'fight' && !ring) {
        // an arrow over the nearest wild creature
        const p = g.world.selfPosition?.(), near = p && g.nearestWild?.(p), w = near && g.worldState()?.wilds?.get(near.id);
        const at = w && g.world.project?.(new Vector3(w.x, (g.world.heightAt?.(w.x, w.z) || 0) + 1.6, w.z));
        at?.visible && (arrow = at);
      }
    } else if (step.id === 'attack') ring = rectOf('#battle-skills');
    else if (step.id === 'capture') {
      const b = [...document.querySelectorAll('#battle-trainer button')].find((x) => x.textContent.includes('כדור'));
      b && (ring = b.getBoundingClientRect());
    } else if (step.id === 'base') ring = rectOf('[data-panel="base"]');

    this.ring.classList.toggle('hidden', !ring);
    if (ring) Object.assign(this.ring.style, { left: `${ring.left - 6}px`, top: `${ring.top - 6}px`, width: `${ring.width + 12}px`, height: `${ring.height + 12}px` });
    this.hand.classList.toggle('hidden', !hand && !ring);
    this.hand.className = `${hand ? hand.kind : ring ? 'tap' : ''}${!hand && !ring ? ' hidden' : ''}`;
    if (hand) Object.assign(this.hand.style, { left: `${hand.x}px`, top: `${hand.y}px` });
    else if (ring) Object.assign(this.hand.style, { left: `${ring.left + ring.width * 0.55}px`, top: `${ring.top + ring.height * 0.6}px` });
    this.arrow.classList.toggle('hidden', !arrow);
    if (arrow) Object.assign(this.arrow.style, { left: `${arrow.x}px`, top: `${arrow.y}px` });
  }
}
