const { rng } = require('./util');

const W = 4000;
const H = 3000;

function build() {
  const rand = rng(20261014);
  const solids = [];   // things you can't walk through: [x, y, w, h]
  const ground = [];   // painted on the ground, in order
  const objects = [];  // fences, trees, tractors...: drawn in front of or behind people
  const keep = [];     // areas where random trees must not grow
  const treePts = [];

  function reserve(x, y, w, h, m) { keep.push([x - m, y - m, w + 2 * m, h + 2 * m]); }

  function free(x, y) {
    for (const k of keep) {
      if (x > k[0] && x < k[0] + k[2] && y > k[1] && y < k[1] + k[3]) return false;
    }
    return true;
  }

  function fill(x, y, w, h, c, extra) {
    ground.push(Object.assign({ k: 'fill', x: x, y: y, w: w, h: h, c: c }, extra || {}));
  }

  function oval(x, y, w, h, c) {
    ground.push({ k: 'ellipse', x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), c: c });
  }

  // A round thing made of stacked slabs, so the collision matches the shape
  function ellipseSolids(cx, cy, rx, ry, n) {
    const bh = (2 * ry) / n;
    for (let i = 0; i < n; i++) {
      const yc = cy - ry + (i + 0.5) * bh;
      const t = (yc - cy) / ry;
      const hw = rx * Math.sqrt(Math.max(0, 1 - t * t));
      solids.push([Math.round(cx - hw), Math.round(yc - bh / 2), Math.round(2 * hw), Math.round(bh) + 1]);
    }
  }

  // ----- little builders -----

  function tree(x, y, apples) {
    const tx = Math.round(x);
    const ty = Math.round(y);
    const o = {
      k: 'tree', x: tx, y: ty,
      s: Math.round((0.85 + rand() * 0.45) * 100) / 100,
      v: Math.floor(rand() * 4), r: 90
    };
    if (apples) o.a = 1;
    objects.push(o);
    solids.push([tx - 6, ty - 5, 12, 10]);
    treePts.push([tx, ty]);
  }

  // Plants trees in random open spots inside a box
  function scatter(count, x0, y0, x1, y1) {
    let placed = 0;
    for (let i = 0; i < count * 25 && placed < count; i++) {
      const x = x0 + rand() * (x1 - x0);
      const y = y0 + rand() * (y1 - y0);
      if (!free(x, y)) continue;
      let ok = true;
      for (const p of treePts) {
        if (Math.hypot(p[0] - x, p[1] - y) < 90) { ok = false; break; }
      }
      if (!ok) continue;
      tree(x, y, false);
      placed++;
    }
  }

  function rock(x, y, s) {
    const hw = Math.round(13 * s);
    const hh = Math.round(10 * s);
    objects.push({ k: 'rock', x: Math.round(x), y: Math.round(y), s: s, r: 30 });
    solids.push([Math.round(x) - hw, Math.round(y) - hh, hw * 2, hh * 2]);
  }

  function hay(x, y, round) {
    objects.push({ k: 'hay', x: x, y: y, v: round ? 1 : 0, r: 40 });
    if (round) solids.push([x - 16, y - 16, 32, 32]);
    else solids.push([x - 14, y - 12, 28, 24]);
  }

  function trough(x, y) {
    objects.push({ k: 'trough', x: x, y: y, r: 40 });
    solids.push([x - 24, y - 8, 48, 16]);
  }

  function tractor(x, y, dir) {
    objects.push({ k: 'tractor', x: x, y: y, f: dir, r: 80 });
    solids.push([x - 48, y - 28, 96, 56]);
    reserve(x - 48, y - 28, 96, 56, 40);
  }

  // A fence along one straight side. The gap (if any) is where the gate is.
  function fenceRun(x1, y1, x2, y2, gap0, gap1) {
    const horiz = y1 === y2;
    const from = horiz ? x1 : y1;
    const len = (horiz ? x2 : y2) - from;
    const n = Math.max(1, Math.round(len / 40));
    const step = len / n;
    for (let i = 0; i < n; i++) {
      const pos = from + (i + 0.5) * step;
      if (gap0 !== null && pos > gap0 && pos < gap1) continue;
      const p = Math.round(pos);
      const sl = Math.round(step) + 1;
      if (horiz) {
        objects.push({ k: 'fence', x: p, y: y1, v: 0, r: 40 });
        solids.push([p - Math.round(step / 2), y1 - 4, sl, 8]);
      } else {
        objects.push({ k: 'fence', x: x1, y: p, v: 1, r: 40 });
        solids.push([x1 - 4, p - Math.round(step / 2), 8, sl]);
      }
    }
  }

  // A fenced pen with one gate. "side" is where the gate is, "at" is where along that side.
  function pen(x0, y0, x1, y1, side, at) {
    const g = 58;
    const gap = (s) => (side === s ? [at - g, at + g] : [null, null]);
    fenceRun(x0, y0, x1, y0, gap('top')[0], gap('top')[1]);
    fenceRun(x0, y1, x1, y1, gap('bottom')[0], gap('bottom')[1]);
    fenceRun(x0, y0, x0, y1, gap('left')[0], gap('left')[1]);
    fenceRun(x1, y0, x1, y1, gap('right')[0], gap('right')[1]);
    reserve(x0, y0, x1 - x0, y1 - y0, 50);
  }

  // ===== the ground, painted from bottom to top =====

  fill(0, 0, W, H, '#86bb52');

  for (let i = 0; i < 22; i++) {
    oval(rand() * W - 200, rand() * H - 100, 400 + rand() * 500, 220 + rand() * 200, 'rgba(170,215,110,0.35)');
  }
  for (let i = 0; i < 12; i++) {
    oval(rand() * W - 200, rand() * H - 100, 350 + rand() * 450, 200 + rand() * 180, 'rgba(90,150,60,0.18)');
  }

  // dirt roads and the yard in front of the barn
  fill(0, 1440, W, 120, '#cbb68a');
  fill(1940, 540, 120, H - 540, '#cbb68a');
  fill(1320, 560, 120, 880, '#cbb68a');
  fill(1700, 540, 600, 220, '#c2ad7e');
  reserve(0, 1440, W, 120, 40);
  reserve(1940, 540, 120, H - 540, 40);
  reserve(1320, 560, 120, 880, 30);
  reserve(1700, 540, 600, 220, 30);

  // crop fields (you can walk through them)
  const FIELDS = [
    [220, 1660, 780, 640, 1],
    [1050, 1660, 750, 640, 0],
    [220, 2380, 780, 520, 2],
    [1050, 2380, 750, 520, 3],
    [2200, 1660, 800, 640, 4],
    [2200, 2380, 800, 520, 0]
  ];
  for (const f of FIELDS) {
    ground.push({ k: 'field', x: f[0], y: f[1], w: f[2], h: f[3], c: f[4] });
    reserve(f[0], f[1], f[2], f[3], 20);
  }
  objects.push({ k: 'scarecrow', x: 600, y: 1990, r: 60 });
  solids.push([592, 1982, 16, 16]);
  hay(620, 2620, true);
  hay(1350, 2660, true);

  // pond
  ground.push({ k: 'water', x: 3150, y: 1750, w: 450, h: 300 });
  ellipseSolids(3375, 1900, 225, 150, 7);
  reserve(3150, 1750, 450, 300, 60);

  // pen floors
  fill(300, 300, 480, 400, '#7a5a3a');                         // pigs: mud
  oval(330, 420, 150, 90, '#5f432a');
  oval(560, 520, 170, 100, '#5f432a');
  oval(420, 590, 110, 60, '#6a4c30');
  fill(880, 340, 240, 260, '#c9b27a');                         // chickens: straw
  fill(300, 780, 420, 320, '#b8a47a');                         // goats: rocky dirt
  oval(3300, 340, 450, 520, '#b99a6b');                        // horses: dirt track
  oval(3345, 390, 360, 420, '#86bb52');

  // the pens themselves
  pen(300, 300, 780, 700, 'bottom', 540);
  pen(880, 340, 1120, 600, 'bottom', 1000);
  pen(2450, 300, 3100, 760, 'left', 530);
  pen(3250, 300, 3800, 900, 'bottom', 3525);
  pen(300, 780, 720, 1100, 'right', 940);
  pen(2450, 860, 3150, 1300, 'left', 1080);

  trough(420, 360);
  trough(660, 360);
  trough(2800, 360);
  trough(3330, 330);
  trough(420, 860);
  trough(2800, 930);
  trough(2900, 930);

  rock(400, 1010, 1.2);
  rock(610, 940, 1);
  rock(500, 880, 0.8);

  objects.push({ k: 'coop', x: 1000, y: 450, r: 100 });
  solids.push([955, 420, 90, 30]);

  // ===== buildings =====

  ground.push({ k: 'barn', x: 1840, y: 300, w: 320, h: 200, f: 40 });
  solids.push([1840, 300, 320, 240]);
  reserve(1840, 300, 320, 240, 50);

  ground.push({ k: 'house', x: 1250, y: 330, w: 260, h: 170, f: 30, c: '#e8dcc0' });
  solids.push([1250, 330, 260, 200]);
  reserve(1250, 330, 260, 200, 50);

  objects.push({ k: 'silo', x: 2240, y: 520, r: 170 });
  solids.push([2206, 506, 68, 28]);
  reserve(2200, 480, 80, 60, 40);

  // ===== things lying around =====

  tractor(1560, 700, 1);
  tractor(2600, 2340, -1);

  for (const b of [[1760, 600], [1800, 604], [1780, 574], [2230, 612], [2264, 606]]) hay(b[0], b[1], false);

  // ===== trees =====

  reserve(3100, 2220, 700, 700, 0);
  for (let x = 3150; x <= 3750; x += 100) {
    for (let y = 2300; y <= 2850; y += 100) tree(x, y, true);
  }

  scatter(14, 40, 40, 200, 2960);      // left edge
  scatter(14, 3840, 40, 3960, 2960);   // right edge
  scatter(10, 200, 40, 3800, 200);     // top edge
  scatter(10, 200, 2920, 3800, 2980);  // bottom edge
  scatter(16, 100, 100, 3900, 2900);   // anywhere else that is open

  return { width: W, height: H, solids: solids, ground: ground, objects: objects, zones: {}, npcs: 85 };
}

module.exports = { build };