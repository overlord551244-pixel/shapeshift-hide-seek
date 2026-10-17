// The real game view: camera, smooth movement, characters, controls and HUD
(function () {
  const canvas = $('view');
  const rawCtx = canvas.getContext('2d');
  let ctx = rawCtx;   // swapped for a color-scrambling version while a Confusion Ray effect is on you

  const BASE_H = 600;      // how many world units tall the view is
  const MAX_W = 1100;      // widest view allowed (keeps wide monitors fair)
  const EYES_ZOOM = 1.8;   // Enhanced Eyesight shows 80% more
  const SLING_RANGE = 450; // must match slingRange in server/items.js

  // Plain ground, used for any map that has no map art yet
  const GROUND = {
    city:     { base: '#7d838b', line: '#70767e', size: 200 },
    farm:     { base: '#86bb52', line: '#7aaf48', size: 200 },
    mall:     { base: '#e7ddcc', line: '#d4c8b3', size: 100 },
    cornMaze: { base: '#cdb85a', line: '#bda74d', size: 200 }
  };

  const KEYMAP = {
    KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'sprint', ShiftRight: 'sprint'
  };

  let VW = 800, VH = 500, DPR = 1;
  let info = { width: 4000, height: 3000, map: 'city', bulletSpeed: 900, rockSpeed: 520 };
  let state = null;
  let stateAt = 0;
  let myItems = [];
  let lastMe = null;
  let lastFrame = performance.now();
  let playerScreen = { x: 400, y: 250 };
  let rc = null;            // the color scrambler, while a Confusion Ray "colors" effect is on
  let flipBuf = null;       // scratch canvas used to turn the view upside down
  let flipCtx = null;
  const ents = new Map();   // smoothed position of everything on the map
  const mouse = { x: 400, y: 250 };
  const keys = { up: false, down: false, left: false, right: false, sprint: false };

  // ---------- Canvas size ----------
  function resize() {
    const r = canvas.getBoundingClientRect();
    DPR = Math.min(2, window.devicePixelRatio || 1);
    VW = Math.max(240, Math.round(r.width));
    VH = Math.max(240, Math.round(r.height));
    canvas.width = Math.round(VW * DPR);
    canvas.height = Math.round(VH * DPR);
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
  window.addEventListener('resize', resize);
  resize();

  // ---------- Keyboard ----------
  function typing(e) {
    const t = e.target;
    return !!t && t.tagName === 'INPUT' && (t.type === 'text' || t.type === 'number');
  }

  function sendKeys() { socket.emit('input', Object.assign({}, keys)); }

  function setKey(e, down) {
    const k = KEYMAP[e.code];
    if (!k || !state || typing(e)) return;
    e.preventDefault();
    if (keys[k] === down) return;
    keys[k] = down;
    sendKeys();
  }

  window.addEventListener('keydown', (e) => {
    if (typing(e)) return;
    const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
    if (m) {
      if (e.repeat || !state || !state.alive) return;
      const idx = Number(m[1]) - (state.role === 'seeker' ? 2 : 1);
      if (idx >= 0 && idx < (state.hotbar || []).length) socket.emit('useItem', idx);
      return;
    }
    setKey(e, true);
  });
  window.addEventListener('keyup', (e) => setKey(e, false));
  window.addEventListener('blur', () => {
    for (const k of Object.keys(keys)) keys[k] = false;
    sendKeys();
  });

  // ---------- Mouse ----------
  function setMouse(e) {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  }

  // True while a Confusion Ray has turned this player's view upside down
  function isFlipped() {
    return !!(state && state.confusion && state.confusion.type === 'flip');
  }

  // The direction (in the world) from the player toward the mouse
  function aimAngle() {
    const mx = isFlipped() ? VW - mouse.x : mouse.x;
    const my = isFlipped() ? VH - mouse.y : mouse.y;
    return Math.atan2(my - playerScreen.y, mx - playerScreen.x);
  }

  canvas.addEventListener('mousemove', setMouse);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    setMouse(e);
    if (!state || !state.alive) return;

    const slot = Effects.slotAt(state, VW, VH, mouse.x, mouse.y);
    if (slot) {
      if (slot.index !== undefined) socket.emit('useItem', slot.index);
      return;
    }
    if (state.role === 'seeker') socket.emit('shoot', aimAngle());
    else if ((state.hotbar || []).some((h) => h.holding)) socket.emit('sling', aimAngle());
  });

  // ---------- Server messages ----------
  socket.on('worldInfo', (w) => {
    info = w;
    MapRender.load(w.map, w.mapData);
  });

  socket.on('locked', (d) => { myItems = d.items || []; });

  socket.on('roundStart', () => {
    state = null;
    lastMe = null;
    myItems = [];
    rc = null;
    ents.clear();
    Effects.reset();
    for (const k of Object.keys(keys)) keys[k] = false;
  });

  socket.on('roundEnd', () => {
    state = null;
    ents.clear();
    for (const k of Object.keys(keys)) keys[k] = false;
  });

  socket.on('state', (s) => {
    state = s;
    stateAt = performance.now();
    const seen = new Set();

    function take(o, kind) {
      seen.add(o.id);
      let d = ents.get(o.id);
      if (!d) {
        d = { id: o.id, x: o.x, y: o.y, ph: 0, lastMove: 0, lastRustle: 0 };
        ents.set(o.id, d);
      }
      d.tx = o.x;
      d.ty = o.y;
      d.f = o.f;
      d.e = o.e || null;
      d.c = o.c || null;
      d.sl = !!o.sl;
      d.g = !!o.g;
      d.kind = kind;
    }
    for (const o of s.entities) take(o, 'ent');
    for (const o of s.seekers) take(o, 'seeker');

    // Anything that vanished (a shot NPC or a caught hider) goes out in a puff of smoke
    for (const id of Array.from(ents.keys())) {
      if (seen.has(id)) continue;
      const d = ents.get(id);
      if (d.kind === 'ent') Effects.burst(d.x, d.y);
      ents.delete(id);
    }

    const aiming = s.role === 'seeker' || (s.hotbar || []).some((h) => h.holding);
    canvas.style.cursor = aiming ? 'crosshair' : 'default';
  });

  socket.on('shotResult', (d) => {
    if (d.result === 'npc') toast('That was an NPC! You lost a heart.', 'bad');
    else if (d.result === 'hider') toast('You caught a hider!', 'good');
  });
  socket.on('trapped', (d) => {
    toast('You are stuck in a beartrap for ' + d.seconds + 's!', 'bad');
    Effects.trap(d.seconds);
  });
  socket.on('rockHit', () => toast('Your rock hit the seeker!', 'good'));
  socket.on('stunned', (d) => Effects.stun(d.seconds));
  socket.on('inked', (d) => Effects.ink(d.seconds));

  // ---------- Drawing ----------
  function drawGround(camX, camY, viewW, viewH, now) {
    ctx.fillStyle = '#0b0d12';
    ctx.fillRect(camX - 10, camY - 10, viewW + 20, viewH + 20);

    if (MapRender.has()) {
      MapRender.drawGround(ctx, { x: camX, y: camY, w: viewW, h: viewH }, now);
    } else {
      // plain grid for maps without art
      const g = GROUND[info.map] || GROUND.city;
      ctx.fillStyle = g.base;
      ctx.fillRect(0, 0, info.width, info.height);
      ctx.strokeStyle = g.line;
      ctx.lineWidth = 2;
      ctx.beginPath();
      const top = Math.max(0, camY);
      const bottom = Math.min(info.height, camY + viewH);
      const left = Math.max(0, camX);
      const right = Math.min(info.width, camX + viewW);
      for (let x = Math.ceil(left / g.size) * g.size; x <= right; x += g.size) {
        ctx.moveTo(x, top);
        ctx.lineTo(x, bottom);
      }
      for (let y = Math.ceil(top / g.size) * g.size; y <= bottom; y += g.size) {
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
      }
      ctx.stroke();
    }

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, info.width, info.height);
  }

  // The little slingshot shown next to a hider who is holding one (other hiders only)
  function drawSling(d) {
    const dm = Sprites.dims(d.e);
    const x = d.x + dm.w + 3;
    const y = d.y - 2;
    ctx.strokeStyle = '#7a4a10';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(x, y + 6);
    ctx.lineTo(x, y);
    ctx.lineTo(x - 3.5, y - 6);
    ctx.moveTo(x, y);
    ctx.lineTo(x + 3.5, y - 6);
    ctx.stroke();
  }

  // Dashed aim line for a hider holding the slingshot (grayed out while it reloads)
  function drawSlingAim(ref, aim) {
    if (state.role !== 'hider' || !state.alive) return;
    const sl = (state.hotbar || []).find((h) => h.key === 'slingshot');
    if (!sl || !sl.holding) return;

    const ex = ref.x + Math.cos(aim) * SLING_RANGE;
    const ey = ref.y + Math.sin(aim) * SLING_RANGE;
    ctx.save();
    ctx.setLineDash([8, 8]);
    ctx.strokeStyle = sl.cdLeft > 0 ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ref.x, ref.y);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(ex, ey, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawEntity(d, now, aim) {
    const moving = now - d.lastMove < 140;
    if (d.kind === 'seeker') {
      Sprites.drawSeeker(ctx, d.x, d.y, d.f, moving, d.ph, d.id === state.youId ? aim : null, d.g);
    } else {
      Sprites.draw(ctx, d.e, d.c, d.id, d.x, d.y, d.f, moving, d.ph);
      if (d.sl) drawSling(d);
    }
  }

  function drawSelfMarker(d, now) {
    const dm = Sprites.dims(d.kind === 'seeker' ? 'seeker' : d.e);
    ctx.beginPath();
    ctx.ellipse(d.x, d.y + dm.ground - 1, dm.w + 6, 5.5, 0, 0, Math.PI * 2);
    ctx.strokeStyle = '#5b8cff';
    ctx.lineWidth = 2;
    ctx.stroke();

    const ay = d.y - dm.top - 12 + Math.sin(now / 220) * 2;
    ctx.beginPath();
    ctx.moveTo(d.x, ay + 6);
    ctx.lineTo(d.x - 5, ay - 2);
    ctx.lineTo(d.x + 5, ay - 2);
    ctx.closePath();
    ctx.fillStyle = '#5b8cff';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Turns everything drawn so far upside down (a 180 degree turn), before the HUD is drawn
  function flipWorld() {
    if (!flipBuf || flipBuf.width !== canvas.width || flipBuf.height !== canvas.height) {
      flipBuf = document.createElement('canvas');
      flipBuf.width = canvas.width;
      flipBuf.height = canvas.height;
      flipCtx = flipBuf.getContext('2d');
    }
    flipCtx.setTransform(1, 0, 0, 1, 0, 0);
    flipCtx.globalCompositeOperation = 'copy';
    flipCtx.drawImage(canvas, 0, 0);

    rawCtx.save();
    rawCtx.setTransform(-1, 0, 0, -1, canvas.width, canvas.height);
    rawCtx.globalCompositeOperation = 'copy';
    rawCtx.drawImage(flipBuf, 0, 0);
    rawCtx.restore();
  }

  function heart(x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.3);
    ctx.bezierCurveTo(x - s * 1.1, y - s * 0.5, x - s * 0.5, y - s * 1.2, x, y - s * 0.5);
    ctx.bezierCurveTo(x + s * 0.5, y - s * 1.2, x + s * 1.1, y - s * 0.5, x, y + s * 0.3);
    ctx.fillStyle = '#ff4d6a';
    ctx.fill();
    ctx.strokeStyle = '#7a1020';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function drawHearts(n) {
    if (n <= 10) {
      for (let i = 0; i < n; i++) heart(24 + i * 24, 30, 10);
    } else {
      heart(24, 30, 10);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('\u00D7 ' + n, 42, 36);
    }
  }

  function centerText(text, y, color, size) {
    ctx.textAlign = 'center';
    ctx.font = 'bold ' + (size || 18) + 'px sans-serif';
    ctx.fillStyle = color;
    ctx.fillText(text, VW / 2, y);
    ctx.textAlign = 'left';
  }

  function frame(now) {
    requestAnimationFrame(frame);
    ctx = rawCtx;
    const dt = Math.min(0.1, (now - lastFrame) / 1000);
    lastFrame = now;

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, VW, VH);
    if (!state) return;

    // Smooth everything toward where the server says it is
    const k = 1 - Math.exp(-dt * 16);
    for (const d of ents.values()) {
      const ox = d.x;
      const oy = d.y;
      d.x += (d.tx - d.x) * k;
      d.y += (d.ty - d.y) * k;
      const moved = Math.hypot(d.x - ox, d.y - oy);
      d.ph += moved * 0.16;
      if (moved > 0.25) {
        d.lastMove = now;
        // Anyone pushing through corn makes it rustle
        if (now - d.lastRustle > 120 && MapRender.inCorn(d.x, d.y)) {
          d.lastRustle = now;
          MapRender.disturb(d.x, d.y, now);
        }
      }
    }

    const meD = ents.get(state.youId);
    if (meD) lastMe = { x: meD.x, y: meD.y };
    const ref = lastMe;

    // A seeker who hasn't spawned yet just waits
    if (!ref) {
      ctx.fillStyle = '#10131a';
      ctx.fillRect(0, 0, VW, VH);
      centerText('Get ready, seeker!', VH / 2 - 10, '#ffffff', 26);
      centerText('You will spawn when preparation ends.', VH / 2 + 22, '#9aa5b8', 15);
      Effects.hotbar(ctx, state, VW, VH, mouse);
      return;
    }

    // Camera
    const eyes = state.role === 'seeker' && myItems.indexOf('enhancedEyes') !== -1;
    const scale = Math.max(VH / BASE_H, VW / MAX_W) / (eyes ? EYES_ZOOM : 1);
    const viewW = VW / scale;
    const viewH = VH / scale;
    let camX = ref.x - viewW / 2;
    let camY = ref.y - viewH / 2;
    camX = info.width > viewW ? Math.min(Math.max(camX, 0), info.width - viewW) : (info.width - viewW) / 2;
    camY = info.height > viewH ? Math.min(Math.max(camY, 0), info.height - viewH) : (info.height - viewH) / 2;

    playerScreen = { x: (ref.x - camX) * scale, y: (ref.y - camY) * scale };
    const aim = aimAngle();

    // A hider hit by the Confusion Ray: colors get scrambled, or the screen gets flipped below
    const conf = state.confusion || null;
    if (conf && conf.type === 'colors') {
      if (!rc || rc.seed !== conf.seed) rc = Effects.recolor(rawCtx, conf.seed);
      ctx = rc.ctx;
    }

    // World
    ctx.setTransform(DPR * scale, 0, 0, DPR * scale, -camX * scale * DPR, -camY * scale * DPR);
    drawGround(camX, camY, viewW, viewH, now);
    Effects.under(ctx, state, now);

    // People and scenery are drawn together, from the top of the screen to the bottom,
    // so someone standing behind a tree is partly hidden by it
    const list = [];
    for (const d of ents.values()) {
      if (d.x < camX - 90 || d.x > camX + viewW + 90 || d.y < camY - 90 || d.y > camY + viewH + 90) continue;
      list.push({ sy: d.y + Sprites.dims(d.kind === 'seeker' ? 'seeker' : d.e).ground, ent: d });
    }
    if (MapRender.has()) {
      for (const o of MapRender.visible({ x: camX, y: camY, w: viewW, h: viewH })) list.push({ sy: o.y, obj: o });
    }
    list.sort((a, b) => a.sy - b.sy);
    for (const it of list) {
      if (it.ent) {
        if (rc && ctx !== rawCtx) rc.setSalt(it.ent.id);   // every character gets its own random colors
        drawEntity(it.ent, now, aim);
      } else {
        if (rc && ctx !== rawCtx) rc.setSalt(0);
        MapRender.drawObject(ctx, it.obj, now);
      }
    }
    if (rc && ctx !== rawCtx) rc.setSalt(0);

    if (meD && state.alive) drawSelfMarker(meD, now);
    drawSlingAim(ref, aim);
    Effects.over(ctx, state, Math.min(0.15, (now - stateAt) / 1000), info, ref, now);

    // Back to normal drawing for everything on top of the world
    ctx = rawCtx;
    if (conf && conf.type === 'flip') flipWorld();

    // Screen
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (!state.alive) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(0, 0, VW, VH);
    }

    if (state.role === 'seeker' && state.alive && meD) {
      drawHearts(state.hearts);
      // aim line and crosshair
      ctx.beginPath();
      ctx.moveTo(playerScreen.x + Math.cos(aim) * 26, playerScreen.y + Math.sin(aim) * 26);
      ctx.lineTo(playerScreen.x + Math.cos(aim) * 70, playerScreen.y + Math.sin(aim) * 70);
      ctx.strokeStyle = 'rgba(255,60,60,0.7)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, 8, 0, Math.PI * 2);
      ctx.moveTo(mouse.x - 13, mouse.y);
      ctx.lineTo(mouse.x - 4, mouse.y);
      ctx.moveTo(mouse.x + 4, mouse.y);
      ctx.lineTo(mouse.x + 13, mouse.y);
      ctx.moveTo(mouse.x, mouse.y - 13);
      ctx.lineTo(mouse.x, mouse.y - 4);
      ctx.moveTo(mouse.x, mouse.y + 4);
      ctx.lineTo(mouse.x, mouse.y + 13);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.stroke();
    }

    // Where the player's character appears on the screen (turned around when the view is flipped)
    const center = (conf && conf.type === 'flip')
      ? { x: VW - playerScreen.x, y: VH - playerScreen.y }
      : playerScreen;

    Effects.screen(ctx, state, VW, VH, now, { x: camX, y: camY, scale: scale }, mouse, center);

    if (!state.alive) {
      centerText(
        state.role === 'seeker' ? 'You ran out of hearts!' : 'You were caught! Waiting for the round to end...',
        50, '#ff7b8a', 20
      );
    }
  }
  requestAnimationFrame(frame);
})();
