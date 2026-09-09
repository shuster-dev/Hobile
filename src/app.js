/* Hobile V1 - original mobile-first tactical FPS prototype. */
(() => {
  'use strict';

  if (!window.THREE) {
    document.body.innerHTML = '<div style="padding:24px;color:white;font-family:sans-serif">Hobile could not load the 3D engine. Check your internet connection and reload.</div>';
    return;
  }

  const THREE = window.THREE;
  const $ = (id) => document.getElementById(id);

  const canvas = $('gameCanvas');
  const menu = $('menu');
  const hud = $('hud');
  const deathScreen = $('deathScreen');
  const playButton = $('playButton');
  const restartButton = $('restartButton');
  const rotateNotice = $('rotateNotice');
  const scoreValue = $('scoreValue');
  const aliveValue = $('aliveValue');
  const hpValue = $('hpValue');
  const magValue = $('magValue');
  const reserveValue = $('reserveValue');
  const reloadLabel = $('reloadLabel');
  const hitmarker = $('hitmarker');
  const damageFlash = $('damageFlash');
  const deathStats = $('deathStats');
  const toast = $('toast');
  const joystickZone = $('joystickZone');
  const joystickBase = $('joystickBase');
  const joystickKnob = $('joystickKnob');
  const lookZone = $('lookZone');
  const fireButton = $('fireButton');
  const reloadButton = $('reloadButton');
  const jumpButton = $('jumpButton');

  const CONFIG = Object.freeze({
    eyeHeight: 1.62,
    radius: 0.34,
    moveSpeed: 4.7,
    airControl: 0.42,
    jumpSpeed: 5.2,
    gravity: 14.5,
    lookSensitivityTouch: 0.0030,
    lookSensitivityMouse: 0.0022,
    maxPitch: Math.PI * 0.46,
    maxDpr: 1.5,
    weapon: {
      name: 'VX-7',
      magazine: 24,
      reserve: 96,
      damage: 30,
      headshotDamage: 78,
      fireInterval: 0.115,
      reloadTime: 1.55,
      range: 70,
      spreadStanding: 0.004,
      spreadMoving: 0.013,
      recoilKick: 0.012,
    }
  });

  let scene, camera, renderer, clock;
  let worldGroup, weaponGroup, muzzleFlash;
  let initialized = false;
  let gameStarted = false;
  let isDead = false;
  let score = 0;
  let bots = [];
  let colliders = [];
  let raycaster;
  let toastTimer = 0;
  let hitTimer = 0;
  let damageTimer = 0;
  let weaponBob = 0;
  let recoilVisual = 0;

  const player = {
    position: new THREE.Vector3(0, CONFIG.eyeHeight, 10),
    velocity: new THREE.Vector3(),
    yaw: Math.PI,
    pitch: 0,
    hp: 100,
    grounded: true,
    mag: CONFIG.weapon.magazine,
    reserve: CONFIG.weapon.reserve,
    reloading: false,
    reloadEndsAt: 0,
    lastShotAt: -999,
  };

  const input = {
    moveX: 0,
    moveY: 0,
    fireHeld: false,
    keys: new Set(),
  };

  const tempV3 = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const nextPos = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);

  function init() {
    if (initialized) return;
    initialized = true;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x8da4ac);
    scene.fog = new THREE.Fog(0x8da4ac, 24, 68);

    camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 90);
    camera.rotation.order = 'YXZ';

    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, CONFIG.maxDpr));
    renderer.setSize(innerWidth, innerHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    clock = new THREE.Clock();
    raycaster = new THREE.Raycaster();
    raycaster.far = CONFIG.weapon.range;

    const hemi = new THREE.HemisphereLight(0xe7fbff, 0x3f4d46, 2.25);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2d6, 1.1);
    sun.position.set(-10, 18, 8);
    scene.add(sun);

    worldGroup = new THREE.Group();
    scene.add(worldGroup);
    buildMap();
    buildWeapon();
    setupControls();
    updateOrientationNotice();
    addEventListener('resize', onResize, { passive: true });
    addEventListener('orientationchange', () => setTimeout(onResize, 150), { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) input.fireHeld = false;
    });

    animate();
  }

  function makeMaterial(color, roughness = 1) {
    return new THREE.MeshLambertMaterial({ color });
  }

  function addBox(x, y, z, sx, sy, sz, color, solid = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), makeMaterial(color));
    mesh.position.set(x, y, z);
    worldGroup.add(mesh);
    if (solid) colliders.push({ minX: x - sx / 2, maxX: x + sx / 2, minZ: z - sz / 2, maxZ: z + sz / 2, minY: y - sy / 2, maxY: y + sy / 2, mesh });
    return mesh;
  }

  function buildMap() {
    colliders = [];
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(46, 46), makeMaterial(0x65726c));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    worldGroup.add(floor);

    const grid = new THREE.GridHelper(46, 23, 0x77857e, 0x77857e);
    grid.position.y = 0.012;
    grid.material.opacity = 0.24;
    grid.material.transparent = true;
    worldGroup.add(grid);

    // Outer training-yard walls.
    addBox(0, 1.8, -22, 46, 3.6, 1, 0x5a625e);
    addBox(0, 1.8, 22, 46, 3.6, 1, 0x5a625e);
    addBox(-22, 1.8, 0, 1, 3.6, 46, 0x5a625e);
    addBox(22, 1.8, 0, 1, 3.6, 46, 0x5a625e);

    // Original arena layout: cover lanes, center block and asymmetric side rooms.
    addBox(0, 1.35, 0, 5.4, 2.7, 5.4, 0x59686d);
    addBox(-9, 1.15, 2, 4.2, 2.3, 1.3, 0x7d7060);
    addBox(-11.5, 1.15, -7, 1.4, 2.3, 6.8, 0x6a756f);
    addBox(-4.8, 0.8, -10.2, 5.8, 1.6, 1.4, 0x866d57);
    addBox(8, 1.25, -7.5, 5, 2.5, 1.4, 0x6d777c);
    addBox(11.5, 1.25, 4, 1.4, 2.5, 7.4, 0x6d777c);
    addBox(6.3, 0.85, 9.5, 5.2, 1.7, 1.6, 0x866d57);
    addBox(-13.8, 0.55, 11, 2.6, 1.1, 2.6, 0x8a765e);
    addBox(14, 0.55, -14, 2.6, 1.1, 2.6, 0x8a765e);

    // Decorative pillars, non-complex geometry.
    const poleMat = makeMaterial(0x37434a);
    for (const [x, z] of [[-17,-16],[17,-16],[-17,16],[17,16]]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.16,5,8), poleMat);
      pole.position.set(x,2.5,z); worldGroup.add(pole);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.1,.18,.5), makeMaterial(0xd6d0a8));
      lamp.position.set(x,4.4,z); worldGroup.add(lamp);
    }
  }

  function buildWeapon() {
    weaponGroup = new THREE.Group();
    const dark = makeMaterial(0x1d2428);
    const accent = makeMaterial(0x65746f);
    const grip = makeMaterial(0x2d3537);

    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.16, 0.62), dark);
    receiver.position.set(0.20, -0.19, -0.56); weaponGroup.add(receiver);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,0.56,8), accent);
    barrel.rotation.x = Math.PI / 2; barrel.position.set(0.20,-0.17,-1.12); weaponGroup.add(barrel);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.13,0.15,0.32), grip);
    stock.position.set(.20,-.18,-.19); weaponGroup.add(stock);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(.09,.26,.16), accent);
    mag.position.set(.20,-.34,-.56); mag.rotation.x = -.12; weaponGroup.add(mag);
    const sight = new THREE.Mesh(new THREE.BoxGeometry(.08,.06,.12), accent);
    sight.position.set(.20,-.075,-.68); weaponGroup.add(sight);

    muzzleFlash = new THREE.Mesh(new THREE.SphereGeometry(0.065, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffcf72 }));
    muzzleFlash.position.set(.20,-.17,-1.43); muzzleFlash.visible = false; weaponGroup.add(muzzleFlash);
    camera.add(weaponGroup);
    scene.add(camera);
  }

  function spawnBots() {
    bots.forEach(bot => scene.remove(bot.group));
    bots = [];
    const spawns = [
      [-12, -13, 0.6], [10, -14, 2.5], [15, 10, 3.5], [-14, 7, 5.2], [5, 14, 4.2], [12, 0, 3.1]
    ];
    for (let i = 0; i < spawns.length; i++) createBot(i, spawns[i]);
    aliveValue.textContent = String(bots.length);
  }

  function createBot(index, [x, z, phase]) {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x7a3935 });
    const vestMat = new THREE.MeshLambertMaterial({ color: 0x273238 });
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xb88462 });
    const legs = new THREE.Mesh(new THREE.BoxGeometry(.5,.72,.34), vestMat);
    legs.position.y = .36;
    const body = new THREE.Mesh(new THREE.BoxGeometry(.62,.72,.38), bodyMat);
    body.position.y = 1.02;
    const head = new THREE.Mesh(new THREE.SphereGeometry(.22, 8, 6), skinMat);
    head.position.y = 1.58;
    group.add(legs, body, head);
    group.position.set(x, 0, z);
    scene.add(group);

    const bot = {
      index, group, body, head, hp: 100, alive: true, phase,
      baseX: x, baseZ: z, nextShotAt: 0, lastMoveUpdate: 0,
      hitMeshes: [body, head],
    };
    body.userData = { bot, hitPart: 'body' };
    head.userData = { bot, hitPart: 'head' };
    legs.userData = { bot, hitPart: 'body' };
    bots.push(bot);
  }

  function resetGame() {
    score = 0;
    isDead = false;
    player.position.set(0, CONFIG.eyeHeight, 10);
    player.velocity.set(0, 0, 0);
    player.yaw = Math.PI;
    player.pitch = 0;
    player.hp = 100;
    player.mag = CONFIG.weapon.magazine;
    player.reserve = CONFIG.weapon.reserve;
    player.reloading = false;
    player.lastShotAt = -999;
    input.fireHeld = false;
    spawnBots();
    updateHud();
    deathScreen.classList.add('hidden');
    hud.classList.remove('hidden');
    menu.classList.add('hidden');
    gameStarted = true;
    showToast('TRAINING STARTED');
  }

  async function startGame() {
    init();
    resetGame();
    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    } catch (_) {}
  }

  function updateHud() {
    scoreValue.textContent = String(score);
    hpValue.textContent = String(Math.max(0, Math.ceil(player.hp)));
    magValue.textContent = String(player.mag);
    reserveValue.textContent = String(player.reserve);
    reloadLabel.classList.toggle('hidden', !player.reloading);
    aliveValue.textContent = String(bots.reduce((n,b) => n + (b.alive ? 1 : 0), 0));
  }

  function showToast(message, duration = 1.4) {
    toast.textContent = message;
    toast.classList.remove('hidden');
    toastTimer = duration;
  }

  function setupControls() {
    playButton.addEventListener('click', startGame);
    restartButton.addEventListener('click', resetGame);

    let joyPointer = null;
    let joyOriginX = 0, joyOriginY = 0;
    const joyRadius = 42;

    joystickZone.addEventListener('pointerdown', (e) => {
      if (!gameStarted || isDead || joyPointer !== null) return;
      joyPointer = e.pointerId;
      joystickZone.setPointerCapture(e.pointerId);
      const rect = joystickZone.getBoundingClientRect();
      joyOriginX = Math.min(Math.max(e.clientX, rect.left + 62), rect.right - 62);
      joyOriginY = Math.min(Math.max(e.clientY, rect.top + 62), rect.bottom - 62);
      joystickBase.style.left = `${joyOriginX - rect.left - 58}px`;
      joystickBase.style.top = `${joyOriginY - rect.top - 58}px`;
      joystickBase.style.bottom = 'auto';
      updateJoystick(e.clientX, e.clientY);
    });
    joystickZone.addEventListener('pointermove', (e) => { if (e.pointerId === joyPointer) updateJoystick(e.clientX, e.clientY); });
    const releaseJoy = (e) => {
      if (e.pointerId !== joyPointer) return;
      joyPointer = null; input.moveX = 0; input.moveY = 0;
      joystickKnob.style.transform = 'translate(0px,0px)';
    };
    joystickZone.addEventListener('pointerup', releaseJoy);
    joystickZone.addEventListener('pointercancel', releaseJoy);

    function updateJoystick(x, y) {
      const dx = x - joyOriginX, dy = y - joyOriginY;
      const len = Math.hypot(dx, dy) || 1;
      const scale = Math.min(1, joyRadius / len);
      const px = dx * scale, py = dy * scale;
      input.moveX = px / joyRadius;
      input.moveY = -py / joyRadius;
      joystickKnob.style.transform = `translate(${px}px,${py}px)`;
    }

    let lookPointer = null, lastLookX = 0, lastLookY = 0;
    lookZone.addEventListener('pointerdown', (e) => {
      if (!gameStarted || isDead || lookPointer !== null) return;
      lookPointer = e.pointerId; lastLookX = e.clientX; lastLookY = e.clientY;
      lookZone.setPointerCapture(e.pointerId);
    });
    lookZone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== lookPointer) return;
      const dx = e.clientX - lastLookX, dy = e.clientY - lastLookY;
      lastLookX = e.clientX; lastLookY = e.clientY;
      applyLook(dx, dy, CONFIG.lookSensitivityTouch);
    });
    const releaseLook = (e) => { if (e.pointerId === lookPointer) lookPointer = null; };
    lookZone.addEventListener('pointerup', releaseLook);
    lookZone.addEventListener('pointercancel', releaseLook);

    const fireDown = (e) => { e.preventDefault(); if (!isDead) { input.fireHeld = true; fireButton.classList.add('pressed'); tryShoot(performance.now()/1000); } };
    const fireUp = (e) => { e.preventDefault(); input.fireHeld = false; fireButton.classList.remove('pressed'); };
    fireButton.addEventListener('pointerdown', fireDown);
    fireButton.addEventListener('pointerup', fireUp);
    fireButton.addEventListener('pointercancel', fireUp);
    reloadButton.addEventListener('pointerdown', (e) => { e.preventDefault(); beginReload(performance.now()/1000); });
    jumpButton.addEventListener('pointerdown', (e) => { e.preventDefault(); jump(); });

    addEventListener('keydown', (e) => {
      input.keys.add(e.code);
      if (e.code === 'KeyR') beginReload(performance.now()/1000);
      if (e.code === 'Space') jump();
    });
    addEventListener('keyup', (e) => input.keys.delete(e.code));

    canvas.addEventListener('mousedown', (e) => {
      if (!gameStarted || isDead || e.button !== 0) return;
      if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
      input.fireHeld = true;
      tryShoot(performance.now()/1000);
    });
    addEventListener('mouseup', () => input.fireHeld = false);
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === canvas && gameStarted && !isDead) applyLook(e.movementX, e.movementY, CONFIG.lookSensitivityMouse);
    });

    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  }

  function applyLook(dx, dy, sensitivity) {
    player.yaw -= dx * sensitivity;
    player.pitch -= dy * sensitivity;
    player.pitch = THREE.MathUtils.clamp(player.pitch, -CONFIG.maxPitch, CONFIG.maxPitch);
  }

  function jump() {
    if (!gameStarted || isDead || !player.grounded) return;
    player.velocity.y = CONFIG.jumpSpeed;
    player.grounded = false;
  }

  function beginReload(now) {
    if (!gameStarted || isDead || player.reloading || player.mag >= CONFIG.weapon.magazine || player.reserve <= 0) return;
    player.reloading = true;
    player.reloadEndsAt = now + CONFIG.weapon.reloadTime;
    updateHud();
  }

  function completeReload() {
    const needed = CONFIG.weapon.magazine - player.mag;
    const moved = Math.min(needed, player.reserve);
    player.mag += moved; player.reserve -= moved; player.reloading = false;
    updateHud();
  }

  function tryShoot(now) {
    if (!gameStarted || isDead || player.reloading) return;
    if (now - player.lastShotAt < CONFIG.weapon.fireInterval) return;
    if (player.mag <= 0) { beginReload(now); return; }

    player.lastShotAt = now;
    player.mag--;
    updateHud();
    muzzleFlash.visible = true;
    setTimeout(() => { if (muzzleFlash) muzzleFlash.visible = false; }, 35);

    const moving = Math.hypot(input.moveX, input.moveY) > .18 || input.keys.has('KeyW') || input.keys.has('KeyA') || input.keys.has('KeyS') || input.keys.has('KeyD');
    const spread = moving ? CONFIG.weapon.spreadMoving : CONFIG.weapon.spreadStanding;
    const sx = (Math.random() - .5) * spread;
    const sy = (Math.random() - .5) * spread;

    camera.updateMatrixWorld(true);
    const origin = camera.getWorldPosition(new THREE.Vector3());
    const dir = new THREE.Vector3(sx, sy, -1).normalize().applyQuaternion(camera.quaternion);
    raycaster.set(origin, dir);

    const targets = [];
    for (const bot of bots) if (bot.alive) targets.push(...bot.group.children);
    const botHits = raycaster.intersectObjects(targets, false);
    const wallHits = raycaster.intersectObjects(colliders.map(c => c.mesh), false);
    const botHit = botHits[0];
    const wallDist = wallHits[0]?.distance ?? Infinity;

    if (botHit && botHit.distance < wallDist) {
      const bot = botHit.object.userData.bot;
      if (bot?.alive) {
        const headshot = botHit.object.userData.hitPart === 'head';
        damageBot(bot, headshot ? CONFIG.weapon.headshotDamage : CONFIG.weapon.damage, headshot);
      }
    }

    player.pitch = THREE.MathUtils.clamp(player.pitch + CONFIG.weapon.recoilKick * (0.72 + Math.random()*.5), -CONFIG.maxPitch, CONFIG.maxPitch);
    recoilVisual = Math.min(.08, recoilVisual + .035);
  }

  function damageBot(bot, damage, headshot) {
    bot.hp -= damage;
    hitmarker.classList.add('show'); hitTimer = .11;
    if (bot.hp <= 0) {
      bot.alive = false;
      bot.group.visible = false;
      score += headshot ? 150 : 100;
      showToast(headshot ? 'HEADSHOT +150' : 'TARGET DOWN +100', .9);
      updateHud();
      if (!bots.some(b => b.alive)) setTimeout(() => { if (!isDead) { spawnBots(); showToast('NEW WAVE'); } }, 900);
    }
  }

  function playerDamage(amount) {
    if (isDead) return;
    player.hp -= amount;
    damageFlash.classList.add('show'); damageTimer = .13;
    updateHud();
    if (player.hp <= 0) killPlayer();
  }

  function killPlayer() {
    isDead = true;
    input.fireHeld = false;
    gameStarted = false;
    hud.classList.add('hidden');
    deathStats.textContent = `Score ${score}`;
    deathScreen.classList.remove('hidden');
    document.exitPointerLock?.();
  }

  function updateMovement(dt) {
    let mx = input.moveX, my = input.moveY;
    if (input.keys.has('KeyA')) mx -= 1;
    if (input.keys.has('KeyD')) mx += 1;
    if (input.keys.has('KeyW')) my += 1;
    if (input.keys.has('KeyS')) my -= 1;
    const mag = Math.hypot(mx, my);
    if (mag > 1) { mx /= mag; my /= mag; }

    forward.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    right.set(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
    const speed = CONFIG.moveSpeed * (player.grounded ? 1 : CONFIG.airControl);
    tempV3.copy(forward).multiplyScalar(my).addScaledVector(right, mx).multiplyScalar(speed * dt);

    nextPos.copy(player.position);
    nextPos.x += tempV3.x;
    if (!collidesAt(nextPos.x, player.position.z)) player.position.x = nextPos.x;
    nextPos.copy(player.position); nextPos.z += tempV3.z;
    if (!collidesAt(player.position.x, nextPos.z)) player.position.z = nextPos.z;

    if (!player.grounded || player.velocity.y !== 0) {
      player.velocity.y -= CONFIG.gravity * dt;
      player.position.y += player.velocity.y * dt;
      if (player.position.y <= CONFIG.eyeHeight) {
        player.position.y = CONFIG.eyeHeight; player.velocity.y = 0; player.grounded = true;
      }
    }

    const moving = mag > .05;
    weaponBob += dt * (moving ? 9 : 3);
    const bobAmount = moving && player.grounded ? .008 : .002;
    weaponGroup.position.x = Math.sin(weaponBob) * bobAmount;
    weaponGroup.position.y = Math.abs(Math.cos(weaponBob)) * bobAmount - recoilVisual;
    recoilVisual = THREE.MathUtils.damp(recoilVisual, 0, 16, dt);
  }

  function collidesAt(x, z) {
    const r = CONFIG.radius;
    for (const c of colliders) {
      if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) return true;
    }
    return false;
  }

  function updateBots(now, dt) {
    for (const bot of bots) {
      if (!bot.alive) continue;
      const t = now * .55 + bot.phase;
      const targetX = bot.baseX + Math.sin(t) * 1.1;
      const targetZ = bot.baseZ + Math.cos(t * .8) * .65;
      bot.group.position.x = THREE.MathUtils.damp(bot.group.position.x, targetX, 2.4, dt);
      bot.group.position.z = THREE.MathUtils.damp(bot.group.position.z, targetZ, 2.4, dt);

      const dx = player.position.x - bot.group.position.x;
      const dz = player.position.z - bot.group.position.z;
      const distance = Math.hypot(dx, dz);
      bot.group.rotation.y = Math.atan2(dx, dz);

      if (distance < 19 && now >= bot.nextShotAt && hasLineOfSight(bot)) {
        bot.nextShotAt = now + 1.0 + Math.random() * .9;
        const hitChance = THREE.MathUtils.clamp(.72 - distance * .022, .28, .67);
        if (Math.random() < hitChance) playerDamage(7 + Math.random() * 8);
      }
    }
  }

  function hasLineOfSight(bot) {
    const origin = new THREE.Vector3(bot.group.position.x, 1.35, bot.group.position.z);
    const target = new THREE.Vector3(player.position.x, 1.35, player.position.z);
    const dist = origin.distanceTo(target);
    const dir = target.sub(origin).normalize();
    raycaster.set(origin, dir); raycaster.far = dist;
    const hit = raycaster.intersectObjects(colliders.map(c => c.mesh), false)[0];
    raycaster.far = CONFIG.weapon.range;
    return !hit || hit.distance > dist - .25;
  }

  function updateCamera() {
    camera.position.copy(player.position);
    camera.rotation.y = player.yaw;
    camera.rotation.x = player.pitch;
  }

  function animate() {
    requestAnimationFrame(animate);
    if (!initialized) return;
    const dt = Math.min(clock.getDelta(), .04);
    const now = performance.now() / 1000;

    if (gameStarted && !isDead) {
      if (player.reloading && now >= player.reloadEndsAt) completeReload();
      if (input.fireHeld) tryShoot(now);
      updateMovement(dt);
      updateBots(now, dt);
      updateCamera();
    }

    if (toastTimer > 0 && (toastTimer -= dt) <= 0) toast.classList.add('hidden');
    if (hitTimer > 0 && (hitTimer -= dt) <= 0) hitmarker.classList.remove('show');
    if (damageTimer > 0 && (damageTimer -= dt) <= 0) damageFlash.classList.remove('show');
    renderer.render(scene, camera);
  }

  function onResize() {
    if (!initialized) return;
    const w = innerWidth, h = innerHeight;
    camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, CONFIG.maxDpr));
    renderer.setSize(w, h, false);
    updateOrientationNotice();
  }

  function updateOrientationNotice() {
    const portrait = innerHeight > innerWidth * 1.06;
    rotateNotice.classList.toggle('hidden', !portrait);
  }

  // Initialize the render scene behind the menu so first PLAY feels instant.
  init();
})();
