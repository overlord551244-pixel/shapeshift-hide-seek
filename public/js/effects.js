// Item visuals: things drawn in the world (traps, radar, smoke...) and on the screen (hotbar, ink)
const Effects = (function () {
  let inkUntil = 0;
  let inkTotal = 6000;
  let inkBlobs = [];
  let stunUntil = 0;
  let trapUntil = 0;
  let trapTotal = 4000;
  const parts = [];

  // Smoke tuning: raise SMOKE_PUFF_ALPHA for thicker smoke, lower it for thinner
  const SMOKE_PUFF_ALPHA = 0.3;
  const SMOKE_SPACING = 52;
  const smokeCache = new Map();

  // Blindness: the part of the screen a blinded hider can still see (0.05 = 5%)
  const BLIND_VISIBLE_FRACTION = 0.05;

  function rnd(seed) {
    const x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  }

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function reset() {
    inkUntil = 0;
    stunUntil = 0;
    trapUntil = 0;
    inkBlobs = [];
    parts.length = 0;
    smokeCache.clear();
  }

  function ink(seconds) {
    inkTotal = seconds * 1000;
    inkUntil = performance.now() + inkTotal;
    inkBlobs = [];
    for (let i = 0; i < 45; i++) {
      inkBlobs.push({
        x: Math.random(), y: Math.random(),
        r: 0.05 + Math.random() * 0.12,
        sq: 0.6 + Math.random() * 0.5,
        rot: Math.random() * Math.PI
      });
    }
  }

  function stun(seconds) { stunUntil = performance.now() + seconds * 1000; }

  function trap(seconds) {
    trapTotal = seconds * 1000;
    trapUntil = performance.now() + trapTotal;
  }

  // A puff of smoke where something disappeared
  function burst(x, y) {
    const now = performance.now();
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 25 + Math.random() * 70;
      parts.push({
        x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20,
        born: now, life: 450 + Math.random() * 350,
        size: 3 + Math.random() * 5
      });
    }
  }

  function drawParts(ctx, now) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      const t = now - p.born;
      if (t >= p.life) { parts.splice(i, 1); continue; }
      const k = t / p.life;
      const s = (t / 1000) * (1 - k * 0.5);
      ctx.beginPath();
      ctx.arc(p.x + p.vx * s, p.y + p.vy * s, p.size * (1 + k), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(205,205,210,' + (0.8 * (1 - k)) + ')';
      ctx.fill();
    }
  }

  // ---------- Confusion Ray: scrambled colors ----------
  // Wraps the game's drawing surface. Every color the game draws with gets swapped
  // for a random one. Black and white are left alone so shadows and outlines still read.

  const COLOR_RE = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/;

  function parseColor(css) {
    if (css.charAt(0) === '#') {
      let h = css.slice(1);
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      if (h.length !== 6) return null;
      const n = parseInt(h, 16);
      if (isNaN(n)) return null;
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
    }
    const m = COLOR_RE.exec(css);
    if (!m) return null;
    return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
  }

  function hrand(h, k) {
    const x = Math.sin(h * 12.9898 + k * 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  function hslToRgb(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0;
    let g = 0;
    let b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
  }

  function scramble(c, seed, salt) {
    const l = (Math.max(c.r, c.g, c.b) + Math.min(c.r, c.g, c.b)) / 510;
    if (l < 0.12 || l > 0.94) return [c.r, c.g, c.b];
    const h = c.r * 961 + c.g * 31 + c.b + salt * 7919 + seed * 13;
    const light = Math.min(0.82, Math.max(0.18, l + (hrand(h, 3) - 0.5) * 0.3));
    return hslToRgb(hrand(h, 1) * 360, 0.5 + hrand(h, 2) * 0.45, light);
  }

  // Returns { ctx, seed, setSalt }. Draw with "ctx"; call setSalt(id) before drawing something
  // so that thing gets its own random colors (use 0 for the background and scenery).
  function recolor(real, seed) {
    let salt = 0;
    const cache = new Map();
    const bound = new Map();

    function map(css) {
      const c = parseColor(css);
      if (!c) return css;
      const key = salt + ':' + c.r + ',' + c.g + ',' + c.b;
      let rgb = cache.get(key);
      if (!rgb) {
        rgb = scramble(c, seed, salt);
        cache.set(key, rgb);
      }
      return c.a >= 1
        ? 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')'
        : 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + c.a + ')';
    }

    const proxy = new Proxy(real, {
      get(target, prop) {
        const v = target[prop];
        if (typeof v !== 'function') return v;
        let f = bound.get(prop);
        if (!f) {
          f = v.bind(target);
          bound.set(prop, f);
        }
        return f;
      },
      set(target, prop, value) {
        if ((prop === 'fillStyle' || prop === 'strokeStyle') && typeof value === 'string') value = map(value);
        target[prop] = value;
        return true;
      }
    });

    return { ctx: proxy, seed: seed, setSalt: function (n) { salt = n; } };
  }

  // ---------- World layer: things on the ground ----------

  function drawTrap(ctx, t, now) {
    if (t.caught) {   // red pulse around a trap that is holding someone
      ctx.beginPath();
      ctx.arc(t.x, t.y, 15 + Math.sin(now / 150) * 2.5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(220,0,0,0.7)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.globalAlpha = t.a === undefined ? 1 : t.a;
    ctx.fillStyle = '#c2c2c2';
    ctx.strokeStyle = t.caught ? '#d00000' : '#555555';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(t.x, t.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.moveTo(t.x + Math.cos(a) * 6, t.y + Math.sin(a) * 6);
      ctx.lineTo(t.x + Math.cos(a) * 11, t.y + Math.sin(a) * 11);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawCan(ctx, c) {
    ctx.globalAlpha = c.a;
    ctx.fillStyle = '#000000';
    ctx.fillRect(c.x - 7, c.y - 9, 14, 18);
    ctx.fillStyle = '#444444';
    ctx.fillRect(c.x - 7, c.y - 9, 14, 4);
    ctx.globalAlpha = 1;
  }

  function drawRadar(ctx, rd, now) {
    ctx.beginPath();
    ctx.arc(rd.x, rd.y, rd.r, 0, Math.PI * 2);
    ctx.fillStyle = rd.hit ? 'rgba(0,200,0,0.25)' : 'rgba(220,0,0,0.18)';
    ctx.fill();
    ctx.strokeStyle = rd.hit ? 'rgba(0,150,0,0.9)' : 'rgba(200,0,0,0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // rotating sweep
    const ang = (now / 900) % (Math.PI * 2);
    ctx.beginPath();
    ctx.moveTo(rd.x, rd.y);
    ctx.arc(rd.x, rd.y, rd.r, ang - 0.6, ang);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(rd.x, rd.y);
    ctx.lineTo(rd.x + Math.cos(ang) * rd.r, rd.y + Math.sin(ang) * rd.r);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // the scanner itself, with a little timer bar
    ctx.fillStyle = '#333333';
    ctx.fillRect(rd.x - 6, rd.y - 6, 12, 12);
    ctx.fillStyle = '#888888';
    ctx.fillRect(rd.x - 20, rd.y - 20, 40, 5);
    ctx.fillStyle = '#22cc22';
    ctx.fillRect(rd.x - 20, rd.y - 20, 40 * rd.left, 5);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(rd.x - 20, rd.y - 20, 40, 5);
  }

  function under(ctx, state, now) {
    for (const t of state.traps || []) drawTrap(ctx, t, now);
    for (const c of state.cans || []) drawCan(ctx, c);
    for (const rd of state.radars || []) drawRadar(ctx, rd, now);
  }

  // ---------- World layer: smoke ----------

  // Builds the puffs for one smoke cloud once, then reuses them every frame.
  // They sit on a tight overlapping grid inside the radius, so no gaps are left.
  function smokePuffs(sm) {
    let list = smokeCache.get(sm.id);
    if (list) return list;
    list = [];
    const R = sm.r * 0.92;
    const S = SMOKE_SPACING;
    const rows = Math.ceil(R / (S * 0.866)) + 1;
    const cols = Math.ceil(R / S) + 2;
    for (let layer = 0; layer < 2; layer++) {
      for (let row = -rows; row <= rows; row++) {
        const y0 = row * S * 0.866;
        const off = ((row & 1) ? S / 2 : 0) + layer * (S / 2);
        for (let col = -cols; col <= cols; col++) {
          const seed = sm.id * 977 + layer * 311 + row * 53 + col * 7;
          const x = col * S + off + (rnd(seed + 1) - 0.5) * S * 0.7;
          const y = y0 + (rnd(seed + 2) - 0.5) * S * 0.7;
          if (Math.hypot(x, y) > R) continue;
          const appear = rnd(seed + 3) * 0.2;           // when it starts to appear
          const fadeStart = 0.78 + rnd(seed + 4) * 0.1; // when it starts to disappear
          list.push({
            x: x, y: y,
            rad: 46 + rnd(seed + 5) * 26,
            gray: 138 + Math.floor(rnd(seed + 6) * 36),
            appear: appear,
            gone: fadeStart + 0.12,
            ph: rnd(seed + 7) * 6.28
          });
        }
      }
    }
    smokeCache.set(sm.id, list);
    return list;
  }

  // Each puff fades in more and more, stays, then fades out less and less
  function drawSmoke(ctx, sm, age) {
    const t = Math.min(1, age / sm.life);
    const puffs = smokePuffs(sm);
    for (let i = 0; i < puffs.length; i++) {
      const p = puffs[i];
      const a = Math.min((t - p.appear) / 0.1, (p.gone - t) / 0.12, 1);
      if (a <= 0) continue;
      const px = sm.x + p.x + Math.sin(age * 0.6 + p.ph) * 6;
      const py = sm.y + p.y + Math.cos(age * 0.5 + p.ph) * 6;
      const g = p.gray;

      ctx.fillStyle = 'rgba(' + g + ',' + g + ',' + g + ',' + (a * SMOKE_PUFF_ALPHA).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(px, py, p.rad, 0, Math.PI * 2);
      ctx.fill();

      const l = g + 22;
      ctx.fillStyle = 'rgba(' + l + ',' + l + ',' + l + ',' + (a * SMOKE_PUFF_ALPHA * 0.6).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(px, py, p.rad * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---------- World layer: things in the air ----------

  function drawCompass(ctx, x, y, angle) {
    ctx.beginPath();
    ctx.arc(x, y, 34, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(246,236,208,0.55)';
    ctx.fill();
    ctx.strokeStyle = '#bb8800';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.textAlign = 'center';
    if (angle === null) {
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('?', x, y + 5);
      ctx.textAlign = 'left';
      return;
    }
    const tx = x + Math.cos(angle) * 30;
    const ty = y + Math.sin(angle) * 30;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(tx, ty);
    ctx.strokeStyle = '#dd2200';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx - Math.cos(angle - 0.5) * 10, ty - Math.sin(angle - 0.5) * 10);
    ctx.lineTo(tx - Math.cos(angle + 0.5) * 10, ty - Math.sin(angle + 0.5) * 10);
    ctx.closePath();
    ctx.fillStyle = '#dd2200';
    ctx.fill();
    ctx.textAlign = 'left';
  }

  function trail(ctx, x, y, a, len, color, width) {
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(a) * len, y - Math.sin(a) * len);
    ctx.lineTo(x, y);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // The purple pulse that spreads out when the seeker fires the Confusion Ray
  function drawRay(ctx, ry, age) {
    const k = Math.min(1, age / 0.9);
    const fade = 1 - k;
    ctx.beginPath();
    ctx.arc(ry.x, ry.y, ry.r * k, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(155,89,182,' + (0.2 * fade).toFixed(3) + ')';
    ctx.fill();
    ctx.strokeStyle = 'rgba(190,120,230,' + (0.9 * fade).toFixed(3) + ')';
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ry.x, ry.y, ry.r * k * 0.7, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(220,170,255,' + (0.6 * fade).toFixed(3) + ')';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  function over(ctx, state, age, info, ref, now) {
    for (const b of state.bullets || []) {
      const bx = b.x + Math.cos(b.a) * info.bulletSpeed * age;
      const by = b.y + Math.sin(b.a) * info.bulletSpeed * age;
      trail(ctx, bx, by, b.a, 16, 'rgba(255,200,0,0.5)', 3);
      ctx.beginPath();
      ctx.arc(bx, by, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffcc00';
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    for (const k of state.rocks || []) {
      const kx = k.x + Math.cos(k.a) * info.rockSpeed * age;
      const ky = k.y + Math.sin(k.a) * info.rockSpeed * age;
      trail(ctx, kx, ky, k.a, 12, 'rgba(120,120,120,0.45)', 3);
      ctx.beginPath();
      ctx.arc(kx, ky, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#777777';
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    if (smokeCache.size > 30) smokeCache.clear();   // old clouds; they are rebuilt identically if needed
    for (const sm of state.smokes || []) drawSmoke(ctx, sm, sm.age + age);

    for (const ry of state.rays || []) drawRay(ctx, ry, ry.age + age);

    if (state.compass && ref) drawCompass(ctx, ref.x, ref.y, state.compass.angle);

    // Shimmering ring while the cloak is active
    const cloak = (state.hotbar || []).find((h) => h.key === 'invisibilityCloak');
    if (cloak && cloak.activeLeft > 0 && ref) {
      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.lineDashOffset = -now / 40;
      ctx.beginPath();
      ctx.arc(ref.x, ref.y, 24 + Math.sin(now / 200) * 2, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(160,130,255,0.75)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // Stars spinning over a stunned seeker
    if (now < stunUntil && ref) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillStyle = '#ffd23f';
      for (let i = 0; i < 3; i++) {
        const a = now / 200 + i * 2.09;
        ctx.fillText('\u2605', ref.x + Math.cos(a) * 15, ref.y - 34 + Math.sin(a) * 4);
      }
      ctx.textAlign = 'left';
    }

    drawParts(ctx, now);
  }

  // ---------- Screen layer ----------

  function slotList(state, vw, vh) {
    const slots = [];
    if (state.role === 'seeker') slots.push({ gun: true });
    (state.hotbar || []).forEach((h, i) => slots.push({ item: h, index: i }));
    const size = vw < 520 ? 46 : 58;
    const gap = 8;
    const total = slots.length * size + Math.max(0, slots.length - 1) * gap;
    let x = (vw - total) / 2;
    const y = vh - size - 16;
    slots.forEach((s, i) => {
      s.x = x; s.y = y; s.w = size; s.h = size; s.num = i + 1;
      x += size + gap;
    });
    return slots;
  }

  function slotAt(state, vw, vh, mx, my) {
    for (const s of slotList(state, vw, vh)) {
      if (mx >= s.x && mx <= s.x + s.w && my >= s.y && my <= s.y + s.h) return s;
    }
    return null;
  }

  function wrap(ctx, text, maxW) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && line) {
        lines.push(line);
        line = w;
      } else {
        line = t;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function tooltip(ctx, s, vw) {
    const info = Icons.INFO[s.gun ? 'gun' : s.item.key];
    if (!info) return;
    const W = 230;
    const pad = 10;
    ctx.font = '12px sans-serif';
    const lines = wrap(ctx, info.text, W - pad * 2);
    const H = 38 + lines.length * 15 + (info.stats ? 16 : 0);
    let x = s.x + s.w / 2 - W / 2;
    x = Math.max(8, Math.min(vw - W - 8, x));
    const y = s.y - H - 8;

    ctx.fillStyle = 'rgba(20,24,32,0.96)';
    rr(ctx, x, y, W, H, 10);
    ctx.fill();
    ctx.strokeStyle = '#3b4660';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(info.name, x + pad, y + pad + 11);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#c3cbda';
    for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], x + pad, y + pad + 30 + i * 15);
    if (info.stats) {
      ctx.fillStyle = '#8fb0ff';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(info.stats, x + pad, y + pad + 32 + lines.length * 15);
    }
  }

  function hotbar(ctx, state, vw, vh, mouse) {
    let hover = null;

    for (const s of slotList(state, vw, vh)) {
      const isHover = !!mouse && mouse.x >= s.x && mouse.x <= s.x + s.w && mouse.y >= s.y && mouse.y <= s.y + s.h;
      if (isHover) hover = s;

      ctx.fillStyle = state.alive ? 'rgba(236,238,243,0.94)' : 'rgba(180,180,180,0.6)';
      rr(ctx, s.x, s.y, s.w, s.h, 10);
      ctx.fill();

      let key = 'gun';
      let sub = '';
      let overlay = 0;
      let overlayColor = '';
      let timeText = '';
      let holding = false;
      let ready = false;
      let passive = false;

      if (s.gun) {
        const c = state.cooldown;
        if (c && c.left > 0 && c.total > 0) {
          overlay = Math.min(1, c.left / c.total);
          overlayColor = 'rgba(0,0,0,0.45)';
          timeText = c.left.toFixed(1);
        }
      } else {
        const h = s.item;
        key = h.key;
        holding = h.holding;
        if (h.type === 'passive') {
          passive = true;
          sub = 'passive';
        } else if (h.activeLeft > 0) {
          overlay = h.activeTotal ? Math.min(1, h.activeLeft / h.activeTotal) : 1;
          overlayColor = 'rgba(0,170,0,0.4)';
          timeText = h.activeLeft.toFixed(1);
        } else if (h.cdLeft > 0) {
          overlay = h.cdTotal ? Math.min(1, h.cdLeft / h.cdTotal) : 1;
          overlayColor = 'rgba(0,0,0,0.45)';
          timeText = h.cdLeft.toFixed(1);
        } else {
          ready = true;
          if (h.key === 'slingshot') sub = h.holding ? 'held' : 'tap';
        }
      }

      Icons.draw(ctx, key, s.x + s.w / 2, s.y + s.h / 2 - 5, s.w * 0.56);

      if (overlay > 0) {
        ctx.save();
        rr(ctx, s.x, s.y, s.w, s.h, 10);
        ctx.clip();
        ctx.fillStyle = overlayColor;
        ctx.fillRect(s.x, s.y + s.h * (1 - overlay), s.w, s.h * overlay);
        ctx.restore();
      }

      let border = '#222222';
      let width = 2;
      if (holding) { border = '#0066ff'; width = 4; }
      else if (ready) { border = '#2fbf71'; width = 3; }
      else if (passive) { border = '#6b7280'; }
      ctx.strokeStyle = border;
      ctx.lineWidth = width + (isHover ? 1 : 0);
      rr(ctx, s.x, s.y, s.w, s.h, 10);
      ctx.stroke();

      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.font = 'bold 10px sans-serif';
      if (timeText) ctx.fillText(timeText, s.x + s.w / 2, s.y + s.h - 5);
      else if (sub) ctx.fillText(sub, s.x + s.w / 2, s.y + s.h - 5);
      ctx.textAlign = 'left';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(String(s.num), s.x + 5, s.y + 13);
    }

    if (hover) tooltip(ctx, hover, vw);
  }

  // Arrow or marker pointing at a hider caught in a beartrap
  function trapAlert(ctx, a, vw, vh, cam) {
    const sx = (a.x - cam.x) * cam.scale;
    const sy = (a.y - cam.y) * cam.scale;
    const m = 34;
    ctx.fillStyle = '#dd0000';
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px sans-serif';
    if (sx > m && sx < vw - m && sy > m && sy < vh - m) {
      ctx.fillText('TRAP \u25BC', sx, sy - 22);
    } else {
      const cx = vw / 2;
      const cy = vh / 2;
      const dx = sx - cx;
      const dy = sy - cy;
      const k = Math.min((vw / 2 - m) / Math.max(1, Math.abs(dx)), (vh / 2 - m) / Math.max(1, Math.abs(dy)));
      const px = cx + dx * k;
      const py = cy + dy * k;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(Math.atan2(dy, dx));
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-8, -9);
      ctx.lineTo(-8, 9);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.fillText('TRAP', px, py - 16);
    }
    ctx.textAlign = 'left';
  }

  function drawInk(ctx, vw, vh, now) {
    if (now >= inkUntil) return;
    const a = Math.min(1, ((inkUntil - now) / inkTotal) * 1.6);
    ctx.fillStyle = 'rgba(10,10,10,' + (a * 0.92) + ')';
    for (const b of inkBlobs) {
      ctx.beginPath();
      ctx.ellipse(b.x * vw, b.y * vh, b.r * vh, b.r * vh * b.sq, b.rot, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Blindness: the whole screen goes black except a small circle around the hider.
  // "center" is where the hider's character is on the screen.
  function drawBlind(ctx, blind, vw, vh, center) {
    const cx = center ? center.x : vw / 2;
    const cy = center ? center.y : vh / 2;
    const r = Math.sqrt((BLIND_VISIBLE_FRACTION * vw * vh) / Math.PI);

    // fades in quickly and fades out at the end
    const a = Math.max(0, Math.min(1, (blind.total - blind.left) / 0.25, blind.left / 0.4));

    const g = ctx.createRadialGradient(cx, cy, r * 0.82, cx, cy, r);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,' + a.toFixed(3) + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vw, vh);
  }

  // Everything drawn on top of the world, in screen coordinates.
  // "center" is where the player's own character is on the screen.
  function screen(ctx, state, vw, vh, now, cam, mouse, center) {
    if (state.role === 'seeker' && state.alive && cam) {
      for (const a of state.trapAlerts || []) trapAlert(ctx, a, vw, vh, cam);
    }

    if (state.blind) drawBlind(ctx, state.blind, vw, vh, center);

    hotbar(ctx, state, vw, vh, mouse);
    drawInk(ctx, vw, vh, now);

    if (now < stunUntil) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillStyle = '#ffb347';
      ctx.fillText('STUNNED ' + ((stunUntil - now) / 1000).toFixed(1) + 's', vw / 2, 90);
      ctx.textAlign = 'left';
    }

    if (now < trapUntil) {
      const left = (trapUntil - now) / 1000;
      const w = 200;
      const x = vw / 2 - w / 2;
      ctx.textAlign = 'center';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillStyle = '#ff6b6b';
      ctx.fillText('STUCK IN A BEARTRAP ' + left.toFixed(1) + 's', vw / 2, 90);
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(x, 100, w, 8);
      ctx.fillStyle = '#ff6b6b';
      ctx.fillRect(x, 100, w * Math.max(0, left / (trapTotal / 1000)), 8);
    }

    // A hider hit by the Confusion Ray sees which effect they have
    if (state.confusion) {
      const c = state.confusion;
      const what = c.type === 'invert' ? 'Your controls are inverted!'
        : c.type === 'flip' ? 'Your screen is upside down!'
        : 'Your colors are scrambled!';
      ctx.textAlign = 'center';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillStyle = '#d58cff';
      ctx.fillText('CONFUSED! ' + what, vw / 2, 130);
      ctx.font = 'bold 14px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(c.left.toFixed(1) + 's', vw / 2, 150);
      ctx.textAlign = 'left';
    }

    // A hider hit by Blindness sees a countdown (drawn over the black)
    if (state.blind) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillStyle = '#ff9a9a';
      ctx.fillText('BLINDED! ' + state.blind.left.toFixed(1) + 's', vw / 2, 190);
      ctx.textAlign = 'left';
    }
  }

  return { reset, ink, stun, trap, burst, recolor, under, over, slotAt, hotbar, screen };
})();
