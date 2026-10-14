// Temporary test view (replaced by the real game screen in Section 8)
(function () {
  const canvas = document.getElementById('view');
  const ctx = canvas.getContext('2d');
  const CW = canvas.width;
  const CH = canvas.height;

  let worldInfo = { width: 4000, height: 3000, bulletSpeed: 900, rockSpeed: 520 };
  let state = null;
  let stateAt = 0;
  let lastMe = null;
  let myItems = [];
  let notice = '';
  let noticeUntil = 0;
  let inkUntil = 0;
  let inkTotal = 6000;
  let inkBlobs = [];
  let stunUntil = 0;
  const disp = new Map();   // smoothed positions
  const mouse = { x: CW / 2 + 50, y: CH / 2 };
  const keys = { up: false, down: false, left: false, right: false, sprint: false };

  const KEYMAP = {
    KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'sprint', ShiftRight: 'sprint'
  };

  const LABELS = {
    runningShoes: 'Shoes', enhancedEyes: 'Eyes', radarScanner: 'Radar',
    invisibilityCloak: 'Cloak', compass: 'Compass', beartrap: 'Trap',
    slingshot: 'Sling', smokeBomb: 'Smoke', inkBomb: 'Ink'
  };

  function colorOf(name) {
    if (!name) return '#aaa';
    const n = name.toLowerCase();
    const table = [
      ['light pink', '#ffd0dc'], ['pink', '#f7a'], ['black', '#222'], ['white', '#f2f2f2'],
      ['gray', '#888'], ['brown', '#8b5a2b'], ['yellow', '#fd4'], ['blue', '#48f'],
      ['red', '#e44'], ['green', '#4a4'], ['tan', '#d2b48c'], ['purple', '#a5c']
    ];
    for (const [word, hex] of table) if (n.includes(word)) return hex;
    return '#aaa';
  }

  function smooth(id, x, y) {
    let d = disp.get(id);
    if (!d) { d = { x, y }; disp.set(id, d); }
    d.x += (x - d.x) * 0.25;
    d.y += (y - d.y) * 0.25;
    return d;
  }

  function rnd(seed) {
    const x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  }

  function showNotice(text) {
    notice = text;
    noticeUntil = performance.now() + 2500;
  }

  // ----- Hotbar layout (seeker: gun in slot 1, items after; hider: items only) -----
  function slotList() {
    if (!state) return [];
    const slots = [];
    if (state.role === 'seeker') slots.push({ gun: true });
    (state.hotbar || []).forEach((h, i) => slots.push({ item: h, index: i }));
    const size = 54, gap = 8;
    const total = slots.length * size + Math.max(0, slots.length - 1) * gap;
    let x = (CW - total) / 2;
    const y = CH - size - 22;
    slots.forEach((s, i) => {
      s.x = x; s.y = y; s.w = size; s.h = size; s.num = i + 1;
      x += size + gap;
    });
    return slots;
  }

  // ----- Keyboard -----
  function sendKeys() { socket.emit('input', { ...keys }); }

  function setKey(e, down) {
    const k = KEYMAP[e.code];
    if (!k || !state) return;
    if (e.target && e.target.tagName === 'INPUT') return;
    e.preventDefault();
    if (keys[k] === down) return;
    keys[k] = down;
    sendKeys();
  }

  window.addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT') return;
    const m = /^Digit([1-9])$/.exec(e.code);
    if (m) {
      if (e.repeat || !state || !state.alive) return;
      const idx = Number(m[1]) - (state.role === 'seeker' ? 2 : 1);
      if (idx >= 0 && idx < state.hotbar.length) socket.emit('useItem', idx);
      return;
    }
    setKey(e, true);
  });
  window.addEventListener('keyup', (e) => setKey(e, false));
  window.addEventListener('blur', () => {
    for (const k of Object.keys(keys)) keys[k] = false;
    sendKeys();
  });

  // ----- Mouse -----
  function updateMouse(e) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) * CW) / rect.width;
    mouse.y = ((e.clientY - rect.top) * CH) / rect.height;
  }
  canvas.addEventListener('mousemove', updateMouse);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('mousedown', (e) => {
    updateMouse(e);
    if (!state || !state.alive) return;

    for (const s of slotList()) {
      if (mouse.x >= s.x && mouse.x <= s.x + s.w && mouse.y >= s.y && mouse.y <= s.y + s.h) {
        if (s.item) socket.emit('useItem', s.index);
        return;
      }
    }

    const angle = Math.atan2(mouse.y - CH / 2, mouse.x - CW / 2);
    if (state.role === 'seeker') socket.emit('shoot', angle);
    else if (state.hotbar.some((h) => h.holding)) socket.emit('sling', angle);
  });

  // ----- Server messages -----
  socket.on('worldInfo', (w) => { worldInfo = w; });
  socket.on('state', (s) => { state = s; stateAt = performance.now(); });
  socket.on('locked', (d) => { myItems = d.items || []; });
  socket.on('roundStart', () => {
    state = null;
    lastMe = null;
    myItems = [];
    notice = '';
    inkUntil = 0;
    stunUntil = 0;
    disp.clear();
    for (const k of Object.keys(keys)) keys[k] = false;
  });
  socket.on('roundEnd', () => { state = null; });
  socket.on('shotResult', (d) => {
    if (d.result === 'npc') showNotice('That was an NPC! You lost a heart.');
    else if (d.result === 'hider') showNotice('You caught a hider!');
  });
  socket.on('trapped', (d) => showNotice('You are stuck in a beartrap for ' + d.seconds + 's!'));
  socket.on('rockHit', () => showNotice('Your rock hit the seeker!'));
  socket.on('stunned', (d) => { stunUntil = performance.now() + d.seconds * 1000; });
  socket.on('inked', (d) => {
    inkTotal = d.seconds * 1000;
    inkUntil = performance.now() + inkTotal;
    inkBlobs = [];
    for (let i = 0; i < 40; i++) {
      inkBlobs.push({
        x: Math.random() * CW, y: Math.random() * CH,
        rx: 25 + Math.random() * 60, ry: 20 + Math.random() * 50,
        rot: Math.random() * Math.PI
      });
    }
  });

  // ----- Drawing pieces (world coordinates) -----
  function drawGround() {
    ctx.fillStyle = '#e8f0d8';
    ctx.fillRect(0, 0, worldInfo.width, worldInfo.height);
    ctx.strokeStyle = '#c9d6b0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let gx = 0; gx <= worldInfo.width; gx += 200) { ctx.moveTo(gx, 0); ctx.lineTo(gx, worldInfo.height); }
    for (let gy = 0; gy <= worldInfo.height; gy += 200) { ctx.moveTo(0, gy); ctx.lineTo(worldInfo.width, gy); }
    ctx.stroke();
  }

  function drawTrap(t) {
    ctx.globalAlpha = t.a === undefined ? 1 : t.a;
    ctx.fillStyle = '#c2c2c2';
    ctx.strokeStyle = t.caught ? '#d00' : '#555';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(t.x, t.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(t.x - 9, t.y); ctx.lineTo(t.x + 9, t.y);
    ctx.moveTo(t.x, t.y - 9); ctx.lineTo(t.x, t.y + 9);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawCan(c) {
    ctx.globalAlpha = c.a;
    ctx.fillStyle = '#000';
    ctx.fillRect(c.x - 7, c.y - 9, 14, 18);
    ctx.fillStyle = '#444';
    ctx.fillRect(c.x - 7, c.y - 9, 14, 4);
    ctx.globalAlpha = 1;
  }

  function drawRadar(rd) {
    ctx.beginPath();
    ctx.arc(rd.x, rd.y, rd.r, 0, Math.PI * 2);
    ctx.fillStyle = rd.hit ? 'rgba(0,200,0,0.25)' : 'rgba(220,0,0,0.18)';
    ctx.fill();
    ctx.strokeStyle = rd.hit ? 'rgba(0,150,0,0.9)' : 'rgba(200,0,0,0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // the scanner itself, with a little timer bar
    ctx.fillStyle = '#333';
    ctx.fillRect(rd.x - 6, rd.y - 6, 12, 12);
    ctx.fillStyle = '#888';
    ctx.fillRect(rd.x - 20, rd.y - 20, 40, 5);
    ctx.fillStyle = '#2c2';
    ctx.fillRect(rd.x - 20, rd.y - 20, 40 * rd.left, 5);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(rd.x - 20, rd.y - 20, 40, 5);
  }

  // Smoke particles fade in more and more, then out
  function drawSmoke(sm) {
    const t = Math.min(1, sm.age / sm.life);
    for (let i = 0; i < 36; i++) {
      const base = sm.id * 131 + i * 7;
      const start = rnd(base + 1) * 0.35;
      const end = 0.65 + rnd(base + 2) * 0.35;
      const fade = 0.12;
      if (t <= start || t >= end) continue;
      const a = Math.min(1, (t - start) / fade, (end - t) / fade);
      const ang = rnd(base + 3) * Math.PI * 2;
      const dist = Math.sqrt(rnd(base + 4)) * sm.r * 0.75;
      const px = sm.x + Math.cos(ang) * dist + Math.sin(sm.age * 0.6 + i) * 6;
      const py = sm.y + Math.sin(ang) * dist + Math.cos(sm.age * 0.5 + i) * 6;
      ctx.beginPath();
      ctx.arc(px, py, 28 + rnd(base + 5) * 26, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(150,150,150,' + (a * 0.5) + ')';
      ctx.fill();
    }
  }

  function drawCompass(x, y, angle) {
    ctx.beginPath();
    ctx.arc(x, y, 34, 0, Math.PI * 2);
    ctx.strokeStyle = '#b80';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#000';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    if (angle === null) { ctx.fillText('?', x, y + 4); ctx.textAlign = 'left'; return; }
    const tipX = x + Math.cos(angle) * 30, tipY = y + Math.sin(angle) * 30;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(tipX, tipY);
    ctx.strokeStyle = '#d20';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX - Math.cos(angle - 0.5) * 10, tipY - Math.sin(angle - 0.5) * 10);
    ctx.lineTo(tipX - Math.cos(angle + 0.5) * 10, tipY - Math.sin(angle + 0.5) * 10);
    ctx.closePath();
    ctx.fillStyle = '#d20';
    ctx.fill();
    ctx.textAlign = 'left';
  }

  // ----- Drawing pieces (screen coordinates) -----
  function centerText(text, y, color) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = color || '#000';
    ctx.fillText(text, CW / 2, y);
    ctx.textAlign = 'left';
  }

  function drawTrapAlert(a, ref, zoom) {
    const dx = (a.x - ref.x) * zoom;
    const dy = (a.y - ref.y) * zoom;
    const halfW = CW / 2 - 30, halfH = CH / 2 - 30;
    ctx.fillStyle = '#d00';
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px sans-serif';
    if (Math.abs(dx) < halfW && Math.abs(dy) < halfH) {
      ctx.fillText('TRAP! \u25BC', CW / 2 + dx, CH / 2 + dy - 22);
    } else {
      const scale = Math.min(halfW / Math.max(1, Math.abs(dx)), halfH / Math.max(1, Math.abs(dy)));
      const px = CW / 2 + dx * scale, py = CH / 2 + dy * scale;
      const ang = Math.atan2(dy, dx);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-8, 9);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.fillText('TRAP', px, py - 14);
    }
    ctx.textAlign = 'left';
  }

  function drawHotbar() {
    for (const s of slotList()) {
      ctx.fillStyle = state.alive ? 'rgba(235,235,235,0.92)' : 'rgba(180,180,180,0.6)';
      ctx.fillRect(s.x, s.y, s.w, s.h);

      let label = 'Gun', sub = '', overlay = 0, overlayColor = '', timeText = '', holding = false;
      if (s.gun) {
        const c = state.cooldown;
        if (c && c.left > 0 && c.total > 0) {
          overlay = Math.min(1, c.left / c.total);
          overlayColor = 'rgba(0,0,0,0.45)';
          timeText = c.left.toFixed(1);
        }
      } else {
        const h = s.item;
        label = LABELS[h.key] || h.key;
        holding = h.holding;
        if (h.type === 'passive') {
          sub = 'passive';
        } else if (h.activeLeft > 0) {
          overlay = h.activeTotal ? Math.min(1, h.activeLeft / h.activeTotal) : 1;
          overlayColor = 'rgba(0,170,0,0.4)';
          timeText = h.activeLeft.toFixed(1);
        } else if (h.cdLeft > 0) {
          overlay = h.cdTotal ? Math.min(1, h.cdLeft / h.cdTotal) : 1;
          overlayColor = 'rgba(0,0,0,0.45)';
          timeText = h.cdLeft.toFixed(1);
        } else if (h.key === 'slingshot') {
          sub = h.holding ? 'held' : 'tap';
        }
      }

      if (overlay > 0) {
        ctx.fillStyle = overlayColor;
        ctx.fillRect(s.x, s.y + s.h * (1 - overlay), s.w, s.h * overlay);
      }
      ctx.strokeStyle = holding ? '#06f' : '#222';
      ctx.lineWidth = holding ? 4 : 2;
      ctx.strokeRect(s.x, s.y, s.w, s.h);

      ctx.fillStyle = '#000';
      ctx.textAlign = 'center';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(label, s.x + s.w / 2, s.y + s.h / 2 + 2);
      ctx.font = '10px sans-serif';
      if (sub) ctx.fillText(sub, s.x + s.w / 2, s.y + s.h - 6);
      if (timeText) ctx.fillText(timeText, s.x + s.w / 2, s.y + s.h - 6);
      ctx.textAlign = 'left';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(String(s.num), s.x + 4, s.y + 12);
    }
  }

  function drawInk(now) {
    if (now >= inkUntil) return;
    const a = Math.min(1, ((inkUntil - now) / inkTotal) * 1.6);
    ctx.fillStyle = 'rgba(10,10,10,' + a * 0.92 + ')';
    for (const b of inkBlobs) {
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, b.rx, b.ry, b.rot, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ----- Main draw -----
  function draw() {
    requestAnimationFrame(draw);
    ctx.clearRect(0, 0, CW, CH);
    if (!state) return;
    const now = performance.now();

    const meEnt = state.entities.find((e) => e.id === state.youId) ||
                  state.seekers.find((s) => s.id === state.youId);

    let ref = null;
    if (meEnt) {
      const me = smooth(meEnt.id, meEnt.x, meEnt.y);
      lastMe = { x: me.x, y: me.y };
      ref = lastMe;
    } else if (lastMe) {
      ref = lastMe;   // caught or out: keep watching from where you were
    }

    if (!ref) {
      ctx.fillStyle = '#000';
      ctx.font = '16px sans-serif';
      ctx.fillText('Seeker spawns when preparation ends...', 20, 30);
      drawHotbar();
      return;
    }

    // Enhanced Eyesight: 80% larger field of view
    const zoom = (state.role === 'seeker' && myItems.includes('enhancedEyes')) ? 1 / 1.8 : 1;
    const halfW = CW / 2 / zoom + 40;
    const halfH = CH / 2 / zoom + 40;
    const seen = (x, y) => Math.abs(x - ref.x) < halfW && Math.abs(y - ref.y) < halfH;

    ctx.save();
    ctx.translate(CW / 2, CH / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-ref.x, -ref.y);

    drawGround();
    for (const t of state.traps || []) drawTrap(t);
    for (const c of state.cans || []) drawCan(c);
    for (const rd of state.radars || []) drawRadar(rd);

    // NPCs and hiders (they look identical on purpose)
    for (const e of state.entities) {
      const d = smooth(e.id, e.x, e.y);
      if (!seen(d.x, d.y)) continue;

      ctx.beginPath();
      ctx.arc(d.x, d.y, 11, 0, Math.PI * 2);
      ctx.fillStyle = colorOf(e.c);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#000';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(e.e ? e.e[0].toUpperCase() : '?', d.x, d.y - 15);

      if (e.sl) {   // only other hiders get to see a held slingshot
        ctx.fillStyle = '#7a4a10';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText('Y', d.x + 15, d.y + 4);
      }
      if (e.id === state.youId) {
        ctx.beginPath();
        ctx.arc(d.x, d.y, 17, 0, Math.PI * 2);
        ctx.strokeStyle = '#06f';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#000';
        ctx.font = '10px sans-serif';
        ctx.fillText('YOU', d.x, d.y + 28);
      }
    }

    // Seekers (red squares, see-through while cloaked)
    for (const s of state.seekers) {
      const d = smooth(s.id, s.x, s.y);
      ctx.globalAlpha = s.g ? 0.4 : 1;
      ctx.fillStyle = '#d22';
      ctx.fillRect(d.x - 11, d.y - 11, 22, 22);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(d.x - 11, d.y - 11, 22, 22);
      ctx.fillStyle = '#000';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(s.id === state.youId ? 'YOU (seeker)' : 'SEEKER', d.x, d.y - 16);
      ctx.globalAlpha = 1;
    }

    // Bullets and rocks (nudged forward between updates so they look smooth)
    const age = (now - stateAt) / 1000;
    for (const b of state.bullets) {
      const bx = b.x + Math.cos(b.a) * worldInfo.bulletSpeed * age;
      const by = b.y + Math.sin(b.a) * worldInfo.bulletSpeed * age;
      ctx.beginPath();
      ctx.arc(bx, by, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#fc0';
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    for (const k of state.rocks || []) {
      const kx = k.x + Math.cos(k.a) * worldInfo.rockSpeed * age;
      const ky = k.y + Math.sin(k.a) * worldInfo.rockSpeed * age;
      ctx.beginPath();
      ctx.arc(kx, ky, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#777';
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    for (const sm of state.smokes || []) {
      sm.age += age;   // keep the animation moving between server updates
      drawSmoke(sm);
      sm.age -= age;
    }

    if (state.compass && meEnt) drawCompass(ref.x, ref.y, state.compass.angle);

    ctx.restore();
    ctx.textAlign = 'left';

    // Seeker-only: arrows to caught hiders, hearts, aim line
    if (state.role === 'seeker' && state.alive) {
      for (const a of state.trapAlerts || []) drawTrapAlert(a, ref, zoom);

      ctx.beginPath();
      ctx.moveTo(CW / 2, CH / 2);
      const ang = Math.atan2(mouse.y - CH / 2, mouse.x - CW / 2);
      ctx.lineTo(CW / 2 + Math.cos(ang) * 60, CH / 2 + Math.sin(ang) * 60);
      ctx.strokeStyle = 'rgba(200,0,0,0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#000';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('Hearts: ' + state.hearts, 10, 22);
    }

    drawHotbar();
    drawInk(now);

    if (!state.alive) {
      centerText(state.role === 'seeker' ? 'You ran out of hearts!' : 'You were caught! Waiting for the round to end...', 40, '#b00');
    }
    if (now < stunUntil) centerText('STUNNED! ' + ((stunUntil - now) / 1000).toFixed(1) + 's', 100, '#c60');
    if (now < noticeUntil) centerText(notice, 70, '#005');

    ctx.fillStyle = '#000';
    ctx.font = '11px sans-serif';
    ctx.fillText('WASD: move   Shift: sprint   Click: shoot / use slot   Number keys: items', 10, CH - 6);
  }
  draw();
})();