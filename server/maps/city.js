const { rng } = require('./util');

const W = 4000;
const H = 3000;
const VX = [500, 1500, 2500, 3500];   // centers of the vertical roads
const HY = [500, 1500, 2500];         // centers of the horizontal roads
const RW = 160;                       // road width
const SW = 36;                        // sidewalk width
const FACADE = 28;                    // front wall drawn under each roof
const GAP = 54;                       // alley between buildings

const ROOFS = ['#8d99ae', '#a3a7b5', '#b08968', '#9c6b5a', '#7c8ea6', '#8a9a7b', '#a8a2c0', '#c1a57b'];
const CARS = ['#d94a45', '#3d6fd6', '#f2cf4a', '#e9e9ec', '#2b2b30', '#43a85c', '#8c8f98', '#e58a2b'];

// The stretches of ground between the roads
function spans(centers, total) {
  const out = [];
  let start = 0;
  for (const c of centers) {
    out.push([start, c - RW / 2]);
    start = c + RW / 2;
  }
  out.push([start, total]);
  return out;
}

function build() {
  const rand = rng(20261013);
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const solids = [];   // things you can't walk through: [x, y, w, h]
  const ground = [];   // painted on the ground, in order
  const objects = []; // trees, cars, benches... drawn in front of or behind people

  const colsX = spans(VX, W);   // 5 columns of blocks
  const rowsY = spans(HY, H);   // 4 rows of blocks
  const PARK = { x0: colsX[2][0], x1: colsX[2][1], y0: rowsY[1][0], y1: rowsY[1][1] };
  const PCX = (PARK.x0 + PARK.x1) / 2;
  const PCY = (PARK.y0 + PARK.y1) / 2;
  const pw = PARK.x1 - PARK.x0;
  const ph = PARK.y1 - PARK.y0;

  // ----- little builders -----

  function tree(x, y) {
    const tx = Math.round(x);
    const ty = Math.round(y);
    objects.push({
      k: 'tree', x: tx, y: ty,
      s: Math.round((0.85 + rand() * 0.45) * 100) / 100,
      v: Math.floor(rand() * 4), r: 90
    });
    solids.push([tx - 6, ty - 5, 12, 10]);
  }

  function bench(x, y, vertical) {
    const w = vertical ? 16 : 46;
    const h = vertical ? 46 : 16;
    objects.push({ k: 'bench', x: Math.round(x), y: Math.round(y), v: vertical ? 1 : 0, r: 40 });
    solids.push([Math.round(x - w / 2), Math.round(y - h / 2), w, h]);
  }

  function car(cx, cy, vertical) {
    const w = vertical ? 32 : 64;
    const h = vertical ? 64 : 32;
    objects.push({ k: 'car', x: Math.round(cx), y: Math.round(cy), v: vertical ? 1 : 0, c: pick(CARS), r: 50 });
    solids.push([Math.round(cx - w / 2), Math.round(cy - h / 2), w, h]);
  }

  // A small empty lot with grass, two trees and a bench
  function pocket(x, y, w, h) {
    ground.push({ k: 'fill', x: x, y: y, w: w, h: h, c: '#7cb85a' });
    ground.push({ k: 'fill', x: x + 8, y: y + 8, w: w - 16, h: h - 16, c: '#6fae4f' });
    tree(x + w * 0.3, y + h * 0.7);
    tree(x + w * 0.72, y + h * 0.45);
    bench(x + w / 2, y + h - 14, false);
  }

  // ----- streets -----

  ground.push({ k: 'fill', x: 0, y: 0, w: W, h: H, c: '#a9adb5' });   // sidewalk everywhere
  for (const c of VX) ground.push({ k: 'fill', x: c - RW / 2, y: 0, w: RW, h: H, c: '#4a4d55' });
  for (const c of HY) ground.push({ k: 'fill', x: 0, y: c - RW / 2, w: W, h: RW, c: '#4a4d55' });

  // lane markings between the intersections
  for (const c of VX) {
    for (const s of rowsY) {
      ground.push({ k: 'dash', x: c - 3, y: s[0], w: 6, h: s[1] - s[0], x1: c, y1: s[0], x2: c, y2: s[1] });
    }
  }
  for (const c of HY) {
    for (const s of colsX) {
      ground.push({ k: 'dash', x: s[0], y: c - 3, w: s[1] - s[0], h: 6, x1: s[0], y1: c, x2: s[1], y2: c });
    }
  }

  // crosswalks on all four sides of every intersection
  const half = RW / 2;
  for (const cx of VX) {
    for (const cy of HY) {
      ground.push({ k: 'cross', x: cx - half + 10, y: cy - half - 36, w: RW - 20, h: 26, d: 'v' });
      ground.push({ k: 'cross', x: cx - half + 10, y: cy + half + 10, w: RW - 20, h: 26, d: 'v' });
      ground.push({ k: 'cross', x: cx - half - 36, y: cy - half + 10, w: 26, h: RW - 20, d: 'h' });
      ground.push({ k: 'cross', x: cx + half + 10, y: cy - half + 10, w: 26, h: RW - 20, d: 'h' });
    }
  }

  // ----- the park in the middle -----

  ground.push({ k: 'fill', x: PARK.x0, y: PARK.y0, w: pw, h: ph, c: '#6fae4f' });
  ground.push({ k: 'fill', x: PARK.x0, y: PCY - 25, w: pw, h: 50, c: '#dccfa8' });
  ground.push({ k: 'fill', x: PCX - 25, y: PARK.y0, w: 50, h: ph, c: '#dccfa8' });
  ground.push({ k: 'ellipse', x: PCX - 95, y: PCY - 95, w: 190, h: 190, c: '#e6dcbc' });

  const POND = [PCX + 180, PCY - 300, 190, 120];
  ground.push({ k: 'water', x: POND[0], y: POND[1], w: POND[2], h: POND[3] });
  solids.push(POND.slice());

  objects.push({ k: 'fountain', x: PCX, y: PCY, r: 70 });
  solids.push([PCX - 40, PCY - 40, 80, 80]);

  const placed = [];
  function parkSpot(x, y) {
    if (Math.abs(x - PCX) < 55 || Math.abs(y - PCY) < 55) return false;   // keep the paths clear
    if (Math.hypot(x - PCX, y - PCY) < 130) return false;                    // keep the plaza clear
    if (x > POND[0] - 40 && x < POND[0] + POND[2] + 40 && y > POND[1] - 40 && y < POND[1] + POND[3] + 70) return false;
    for (const p of placed) if (Math.hypot(p[0] - x, p[1] - y) < 80) return false;
    return true;
  }
  for (let i = 0; i < 600 && placed.length < 28; i++) {
    const x = PARK.x0 + 50 + rand() * (pw - 100);
    const y = PARK.y0 + 60 + rand() * (ph - 90);
    if (parkSpot(x, y)) {
      placed.push([x, y]);
      tree(x, y);
    }
  }
  for (const dx of [-300, -180, 180, 300]) {
    bench(PCX + dx, PCY - 42, false);
    bench(PCX + dx, PCY + 42, false);
  }
  for (const dy of [-300, -180, 180, 300]) {
    bench(PCX - 42, PCY + dy, true);
    bench(PCX + 42, PCY + dy, true);
  }

  // ----- curb lines around every block -----

  for (const cs of colsX) {
    for (const rs of rowsY) {
      ground.push({ k: 'fill', x: cs[0], y: rs[0], w: cs[1] - cs[0], h: rs[1] - rs[0], c: null, s: '#cfd2d8', sw: 6 });
    }
  }

  // ----- buildings (and a few empty lots) -----

  for (let ci = 0; ci < colsX.length; ci++) {
    for (let ri = 0; ri < rowsY.length; ri++) {
      if (ci === 2 && ri === 1) continue;   // that's the park
      const ix0 = colsX[ci][0] + SW;
      const ix1 = colsX[ci][1] - SW;
      const iy0 = rowsY[ri][0] + SW;
      const iy1 = rowsY[ri][1] - SW;
      const nc = Math.max(1, Math.round((ix1 - ix0) / 260));
      const nr = Math.max(1, Math.round((iy1 - iy0) / 260));
      const cw = ((ix1 - ix0) - GAP * (nc - 1)) / nc;
      const chh = ((iy1 - iy0) - GAP * (nr - 1)) / nr;

      for (let a = 0; a < nc; a++) {
        for (let b = 0; b < nr; b++) {
          const bx = Math.round(ix0 + a * (cw + GAP));
          const by = Math.round(iy0 + b * (chh + GAP));
          const bw = Math.round(cw);
          const bh = Math.round(chh);
          if (rand() < 0.08) {
            pocket(bx, by, bw, bh);
            continue;
          }
          ground.push({ k: 'building', x: bx, y: by, w: bw, h: bh - FACADE, f: FACADE, c: pick(ROOFS), n: Math.floor(rand() * 1000) });
          solids.push([bx, by, bw, bh]);
        }
      }
    }
  }

  // ----- street trees and lamp posts -----

  for (let ci = 0; ci < colsX.length; ci++) {
    for (let ri = 0; ri < rowsY.length; ri++) {
      const x0 = colsX[ci][0];
      const x1 = colsX[ci][1];
      const y0 = rowsY[ri][0];
      const y1 = rowsY[ri][1];
      if (!(ci === 2 && ri === 1)) {
        for (let x = x0 + 70; x < x1 - 50; x += 190) {
          if (rand() < 0.5) tree(x, y0 + SW / 2 + 6);
        }
      }
      objects.push({ k: 'lamp', x: Math.round(x0 + 14), y: Math.round(y0 + 16), r: 50 });
      objects.push({ k: 'lamp', x: Math.round(x1 - 14), y: Math.round(y1 - 8), r: 50 });
    }
  }

  // ----- parked cars along the curbs -----

  for (const c of VX) {
    for (const s of rowsY) {
      for (let y = s[0] + 100; y < s[1] - 100; y += 100 + rand() * 40) {
        if (rand() < 0.4) car(c - RW / 2 + 28, y, true);
        if (rand() < 0.4) car(c + RW / 2 - 28, y, true);
      }
    }
  }
  for (const c of HY) {
    for (const s of colsX) {
      for (let x = s[0] + 100; x < s[1] - 100; x += 110 + rand() * 40) {
        if (rand() < 0.4) car(x, c - RW / 2 + 28, false);
        if (rand() < 0.4) car(x, c + RW / 2 - 28, false);
      }
    }
  }

  return { width: W, height: H, solids: solids, ground: ground, objects: objects, zones: {}, npcs: 150 };
}

module.exports = { build };