import { Game } from './game.js';

const game = new Game();
game.boot();
window.__hobile = game;

// A new build went up while this page was open: say so, and let the player
// pick the moment (never mid-fight by surprise). The page and version.json
// are never cached (server/index.js); the scripts are, by their hashed names.
const mine = window.HOBILE_BUNDLE?.version;
if (mine) {
  let shown = false;
  const check = () => {
    if (shown || document.hidden) return;
    fetch('./version.json', { cache: 'no-store' }).then((r) => r.ok ? r.json() : null).then((v) => {
      if (!v?.version || v.version === mine || shown) return;
      shown = true;
      const bar = document.createElement('div');
      bar.className = 'update-bar';
      bar.setAttribute('role', 'status');
      bar.innerHTML = '<span>יש גרסה חדשה של המשחק</span>';
      const go = document.createElement('button');
      go.className = 'btn small primary';
      go.textContent = 'עדכן עכשיו';
      go.onclick = () => {
        // a new service worker first, so the reload is served the new build
        navigator.serviceWorker?.getRegistration?.().then((reg) => reg?.update?.()).catch(() => {}).finally(() => location.reload());
      };
      const later = document.createElement('button');
      later.className = 'btn small ghost';
      later.textContent = 'אחר כך';
      later.onclick = () => bar.remove();
      bar.append(go, later);
      document.body.appendChild(bar);
    }).catch(() => {});
  };
  setInterval(check, 3 * 60_000);
  document.addEventListener('visibilitychange', check);
}
