# Hobile V1 test notes

Automated checks completed in the build environment:

- `node --check src/app.js` passed.
- Static HTTP serving confirmed for `index.html`, `src/app.js` and `styles/main.css`.
- Local file references in `index.html` were verified to exist.

A full headless Chromium gameplay smoke test could not be completed in this environment because the runtime cannot reliably reach the external Three.js CDN used by the browser build. Therefore V1 still needs the intended real-device Safari test after deployment.

This limitation is why the README explicitly identifies Three.js as the only remote runtime dependency.
