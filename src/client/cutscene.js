// The story's scenes (shared/saga.js SCENES), played over the world.
//
// The HUD goes, black bars come in, the camera leaves your shoulder and takes
// the shots the script asks for — close on you, round you, up at the rift,
// over your shoulder at her projection — while the lines come up one at a
// time at the bottom. Tap for the next line (or let it run); "skip" ends it.
// A scene plays once: the server remembers it (sceneSeen), so it does not
// come back on the next device either, and the quest log can play it again.
import { SCENES, SPEAKERS, VILLAIN } from '../shared/saga.js';
import { audio } from './gfx/battle.js';
import { vibrate } from './audio.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class Cutscene {
  constructor(game) {
    this.game = game;
    this.playing = null;
    this.rolling = false;
  }

  /** A scene on screen — its lines, or the credits after them. */
  get active() { return !!this.playing || this.rolling; }

  /** Play scene `id`; `onDone` when it ends (watched or skipped). */
  play(id, { onDone, credits = null } = {}) {
    const lines = SCENES[id];
    if (!lines?.length || this.active) { onDone?.(); return false; }
    const w = this.game.world, me = w.selfPosition?.();
    if (!me) { onDone?.(); return false; }
    const yaw = w.camYaw || 0, f = { x: Math.sin(yaw), z: Math.cos(yaw) };
    // her projection stands a few steps ahead, out of anything solid
    const holo = { x: me.x + f.x * 4.2, z: me.z + f.z * 4.2 };
    const basis = { p: { x: me.x, y: w.heightAt(me.x, me.z), z: me.z }, f, holo };
    const host = document.createElement('div');
    host.id = 'cutscene';
    host.innerHTML = `
      <div class="cs-dark"></div><div class="cs-flash"></div>
      <div class="cs-bar top"></div><div class="cs-bar bottom"></div>
      <button class="cs-skip" type="button">דלג ⏭</button>
      <div class="cs-line" role="button" tabindex="0" aria-live="polite"><b class="who"></b><p class="text"></p><span class="next">▸</span></div>`;
    document.body.appendChild(host);
    document.body.classList.add('cinematic');
    requestAnimationFrame(() => host.classList.add('on'));
    this.playing = { id, lines, i: -1, host, basis, onDone, credits, timer: 0, typing: 0, music: audio.currentTrack };
    // the sky as it was before this scene changes it
    const fx = lines.flatMap((l) => l.fx || []);
    fx.includes('tear') && w.saga.setRift('calm', 0);
    fx.includes('seal') && w.saga.setRift('torn', 0);
    audio.playMusic('saga');
    const next = () => this.next();
    host.querySelector('.cs-line').onclick = next;
    host.querySelector('.cs-line').onkeydown = (e) => { (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), next()); };
    host.querySelector('.cs-skip').onclick = (e) => { e.stopPropagation(); this.end(); };
    this._key = (e) => { if (e.key === 'Escape') this.end(); else if (e.key === 'Enter' || e.key === ' ') next(); };
    window.addEventListener('keydown', this._key);
    setTimeout(next, 450);
    return true;
  }

  next() {
    const P = this.playing;
    if (!P) return;
    // a tap while the line is still coming up shows all of it
    if (P.typing) { this.finishTyping(); return; }
    P.i += 1;
    if (P.i >= P.lines.length) { this.end(); return; }
    const L = P.lines[P.i], who = SPEAKERS[L.who] || SPEAKERS.narrator, w = this.game.world;
    const name = L.who === 'you' ? (this.game.profile?.name || 'אתה') : L.who === 'vesper' ? `${VILLAIN.he} · ${VILLAIN.title}` : who.he;
    const box = P.host.querySelector('.cs-line');
    box.classList.toggle('narration', L.who === 'narrator');
    box.style.setProperty('--who', who.color || '#fff');
    box.querySelector('.who').textContent = name ? `${who.icon ? `${who.icon} ` : ''}${name}` : '';
    const holoPos = w.saga.holoAt();
    P.basis.holo = holoPos ? { x: holoPos.x, z: holoPos.z } : P.basis.holo;
    const dur = Math.max(5, L.he.length * 0.075 + 2.5);
    w.cinemaShot(L.shot || 'orbit', P.basis, dur);
    for (const f of L.fx || []) this.effect(f);
    this.type(L.he);
    clearTimeout(P.timer);
    // nobody tapping: it moves on by itself, a little after the line is read
    P.timer = setTimeout(() => this.playing === P && !P.typing && this.next(), (L.he.length * 0.06 + 4.2) * 1000);
    if (L.roll) P.roll = true;
  }

  type(text) {
    const P = this.playing, el = P.host.querySelector('.text');
    let n = 0;
    el.textContent = '';
    clearInterval(P.typing);
    P.typing = setInterval(() => {
      n += 2;
      el.textContent = text.slice(0, n);
      if (n >= text.length) this.finishTyping();
    }, 28);
    P.full = text;
  }

  finishTyping() {
    const P = this.playing;
    if (!P) return;
    clearInterval(P.typing); P.typing = 0;
    P.host.querySelector('.text').textContent = P.full || '';
    clearTimeout(P.timer);
    P.timer = setTimeout(() => this.playing === P && this.next(), ((P.full || '').length * 0.05 + 3.6) * 1000);
  }

  effect(f) {
    const w = this.game.world, P = this.playing, me = P.basis.p;
    if (f === 'pulse') { w.saga.pulse(1); audio.sfx('evolveCharge'); }
    else if (f === 'shake') { w.shakeCamera(1.3); vibrate([40, 30, 80]); audio.sfx('hurt'); }
    else if (f === 'flash') { const el = P.host.querySelector('.cs-flash'); el.classList.remove('go'); void el.offsetWidth; el.classList.add('go'); audio.sfx('evolveBurst'); }
    else if (f === 'dark') P.host.classList.add('cold');
    else if (f === 'holo-in') { w.saga.showHolo(P.basis.holo, me); audio.sfx('buff'); }
    else if (f === 'holo-out') { w.saga.hideHolo(); audio.sfx('uiBack'); }
    else if (f === 'tear') { w.saga.setRift('torn', 3.5); w.saga.pulse(1.4); w.shakeCamera(2.2); audio.sfx('bossRoar'); vibrate([80, 40, 160]); }
    else if (f === 'seal') { w.saga.setRift('sealed', 4.5); w.saga.pulse(1.2); audio.sfx('evolveBurst'); setTimeout(() => this.playing === P && this.effect('flash'), 3600); }
  }

  end() {
    const P = this.playing;
    if (!P) return;
    clearTimeout(P.timer); clearInterval(P.typing);
    window.removeEventListener('keydown', this._key);
    this.playing = null;
    const w = this.game.world;
    w.saga.hideHolo();
    const finish = () => {
      this.rolling = false;
      w.cinemaEnd();
      P.host.classList.remove('on');
      setTimeout(() => P.host.remove(), 450);
      document.body.classList.remove('cinematic');
      audio.playMusic(P.music || this.game.zone?.id || 'verdant_meadow');
      P.onDone?.();
    };
    if (P.roll && P.credits) this.rolling = true, this.roll(P.host, P.credits, finish);
    else finish();
  }

  /** The end of the story: the credits go up over the quiet sky. */
  roll(host, credits, done) {
    host.querySelector('.cs-line').classList.add('hidden');
    const r = document.createElement('div');
    r.className = 'cs-roll';
    r.innerHTML = `<div class="inner">${credits.map((c) => c.h ? `<h2>${esc(c.h)}</h2>` : c.big ? `<p class="big">${esc(c.big)}</p>` : `<p>${esc(c.t)}</p>`).join('')}</div>`;
    host.appendChild(r);
    audio.sfx('victory');
    const stop = () => { clearTimeout(t); r.remove(); done(); };
    const t = setTimeout(stop, 26000);
    host.querySelector('.cs-skip').onclick = (e) => { e.stopPropagation(); stop(); };
    r.onclick = stop;
  }
}
