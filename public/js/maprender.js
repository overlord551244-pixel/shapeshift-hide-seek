// Draws the map: ground, buildings, trees and other scenery.
// The server sends the layout. The art for each map is in /js/maps/<name>.js
const MapRender = (function () {
  const styles = {};
  const requested = {};
  const disturbances = [];   // places where someone pushed through corn (used by the Corn Maze)
  let cur = null;            // the map we are drawing right now

  // ---------- helpers the map art files can use ----------

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Lighter (positive) or darker (negative). Only give it "#rrggbb" colors.
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    const t = amt < 0 ? 0 : 255;
    const p = Math.abs(amt);
    return 'rgb(' + Math.round(c[0] + (t - c[0]) * p) + ',' +
      Math.round(c[1] + (t - c[1]) * p) + ',' + Math.round(c[2] + (t - c[2]) * p) + ')';
  }

  // The same number every time for the same input (0 to 1)
  function hash(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // ---------- shapes every map can use ----------

  const BUILTIN = {
    fill(ctx, o) {
      if (o.c) {
        ctx.fillStyle = o.c;
        if (o.r) {
          rr(ctx, o.x, o.y, o.w, o.h, o.r);
          ctx.fill();
        } else {
          ctx.fillRect(o.x, o.y, o.w, o.h);
        }
      }
      if (o.s) {
        ctx.strokeStyle = o.s;
        ctx.lineWidth = o.sw || 2;
        ctx.strokeRect(o.x, o.y, o.w, o.h);
      }
    },
    ellipse(ctx, o) {
      ctx.fillStyle = o.c;
      ctx.beginPath();
      ctx.ellipse(o.x + o.w / 2, o.y + o.h / 2, o.w / 2, o.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    },
    dash(ctx, o) {
      ctx.save();
      ctx.setLineDash([28, 22]);
      ctx.strokeStyle = o.c || '#e8c547';
      ctx.lineWidth = o.lw || 4;
      ctx.beginPath();
      ctx.moveTo(o.x1, o.y1);
      ctx.lineTo(o.x2, o.y2);
      ctx.stroke();
      ctx.restore();
    }
  };

  // ---------- corn lookup (the Corn Maze uses this) ----------

  function makeGrid(width, height, rects, cell) {
    if (!rects || !rects.length) return null;
    const cols = Math.ceil(width / cell);
    const rows = Math.ceil(height / cell);
    const cells = new Array(cols * rows).fill(null);
    for (const r of rects) {
      const c0 = Math.max(0, Math.floor(r[0] / cell));
      const c1 = Math.min(cols - 1, Math.floor((r[0] + r[2]) / cell));
      const r0 = Math.max(0, Math.floor(r[1] / cell));
      const r1 = Math.min(rows - 1, Math.floor((r[1] + r[3]) / cell));
      for (let cy = r0; cy <= r1; cy++) {
        for (let cx = c0; cx <= c1; cx++) {
          const i = cy * cols + cx;
          if (!cells[i]) cells[i] = [];
          cells[i].push(r);
        }
      }
    }
    return { cell: cell, cols: cols, rows: rows, cells: cells };
  }

  function inCorn(x, y) {
    if (!cur || !cur.corn) return false;
    const g = cur.corn;
    const cx = Math.floor(x / g.cell);
    const cy = Math.floor(y / g.cell);
    if (cx < 0 || cy < 0 || cx >= g.cols || cy >= g.rows) return false;
    const list = g.cells[cy * g.cols + cx];
    if (!list) return false;
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      if (x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3]) return true;
    }
    return false;
  }

  function disturb(x, y, now) {
    disturbances.push({ x: x, y: y, t: now });
    while (disturbances.length && now - disturbances[0].t > 1200) disturbances.shift();
  }

  // ---------- loading ----------

  function register(key, style) { styles[key] = style; }

  function ensureStyle(key) {
    if (styles[key] || requested[key]) return;
    requested[key] = true;
    const s = document.createElement('script');
    s.src = '/js/maps/' + key + '.js';
    document.head.appendChild(s);   // if the file doesn't exist, the map is drawn with plain shapes
  }

  function load(key, data) {
    cur = null;
    disturbances.length = 0;
    if (!data) return;
    cur = {
      key: key,
      data: data,
      objects: (data.objects || []).slice().sort((a, b) => a.y - b.y),
      corn: makeGrid(data.width, data.height, data.zones && data.zones.corn, 200)
    };
    ensureStyle(key);
  }

  function has() { return !!cur; }

  // The layout the server sent for the map we are on
  function data() { return cur ? cur.data : null; }

  // ---------- drawing ----------

  // Paint the ground. cam = { x, y, w, h } in world units.
  function drawGround(ctx, cam, now) {
    if (!cur) return;
    const style = styles[cur.key];
    const kinds = style ? style.kinds : null;
    const items = cur.data.ground;
    for (let i = 0; i < items.length; i++) {
      const o = items[i];
      if (o.x > cam.x + cam.w || o.x + o.w < cam.x || o.y > cam.y + cam.h || o.y + o.h < cam.y) continue;
      const fn = (kinds && kinds[o.k]) || BUILTIN[o.k];
      if (fn) fn(ctx, o, now);
    }
  }

  // Scenery near the camera (already sorted from top to bottom)
  function visible(cam) {
    if (!cur) return [];
    const out = [];
    const list = cur.objects;
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      const r = o.r || 80;
      if (o.x < cam.x - r || o.x > cam.x + cam.w + r || o.y < cam.y - r || o.y > cam.y + cam.h + r) continue;
      out.push(o);
    }
    return out;
  }

  function drawObject(ctx, o, now) {
    const style = cur ? styles[cur.key] : null;
    const fn = style && style.kinds[o.k];
    if (fn) fn(ctx, o, now);
  }

  return {
    register, load, has, data, drawGround, visible, drawObject,
    inCorn, disturb, disturbances, rr, shade, hash
  };
})();