const { rng } = require('./util');

const W = 3600;
const H = 3600;
const N = 23;                 // rooms across and down
const PW = 90;                // path width
const WT = 60;                // corn wall thickness
const P = PW + WT;
const TOTAL = N * P + WT;     // the whole maze is 3510 wide
const OX = (W - TOTAL) / 2;   // gap between the maze and the map edge
const OY = (H - TOTAL) / 2;
const S = 2 * N + 1;          // the maze is a grid of blocks: odd = path, even = wall

// Where block number k starts and how big it is (walls are thin, paths are wide)
function pos(k) { return Math.floor(k / 2) * P + (k % 2 === 1 ? WT : 0); }
function size(k) { return k % 2 === 1 ? PW : WT; }

function build() {
  const rand = rng(20261015);
  const solids = [];    // things you can't walk through: [x, y, w, h]
  const ground = [];
  const objects = [];
  const corn = [];      // corn walls: you CAN walk through these, but slowly

  // ----- carve the maze -----

  const B = [];   // B[row][col] is true where there is corn
  for (let r = 0; r < S; r++) B.push(new Array(S).fill(true));
  const seen = [];
  for (let j = 0; j < N; j++) seen.push(new Array(N).fill(false));

  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const stack = [[0, 0]];
  seen[0][0] = true;
  B[1][1] = false;
  while (stack.length) {
    const cell = stack[stack.length - 1];
    const ci = cell[0];
    const cj = cell[1];
    const opts = [];
    for (const d of DIRS) {
      const ni = ci + d[0];
      const nj = cj + d[1];
      if (ni >= 0 && nj >= 0 && ni < N && nj < N && !seen[nj][ni]) opts.push([ni, nj, d[0], d[1]]);
    }
    if (!opts.length) {
      stack.pop();
      continue;
    }
    const o = opts[Math.floor(rand() * opts.length)];
    B[2 * cj + 1 + o[3]][2 * ci + 1 + o[2]] = false;   // knock out the wall between
    B[2 * o[1] + 1][2 * o[0] + 1] = false;
    seen[o[1]][o[0]] = true;
    stack.push([o[0], o[1]]);
  }

  // open a few extra gaps so there are loops
  for (let r = 1; r < S - 1; r++) {
    for (let c = 1; c < S - 1; c++) {
      const between = (r % 2 === 1 && c % 2 === 0) || (r % 2 === 0 && c % 2 === 1);
      if (between && B[r][c] && rand() < 0.07) B[r][c] = false;
    }
  }

  // an open clearing in the middle
  const MID = (N - 1) / 2;
  for (let r = 2 * (MID - 1) + 1; r <= 2 * (MID + 1) + 1; r++) {
    for (let c = 2 * (MID - 1) + 1; c <= 2 * (MID + 1) + 1; c++) B[r][c] = false;
  }

  // ----- turn the corn blocks into a small number of rectangles -----

  const live = new Map();
  for (let r = 0; r < S; r++) {
    let c = 0;
    while (c < S) {
      if (!B[r][c]) { c++; continue; }
      let c2 = c;
      while (c2 + 1 < S && B[r][c2 + 1]) c2++;
      const x0 = OX + pos(c);
      const x1 = OX + pos(c2) + size(c2);
      const key = x0 + '_' + x1;
      const prev = live.get(key);
      if (prev && prev.lastRow === r - 1) {
        prev.rect[3] += size(r);
        prev.lastRow = r;
      } else {
        const rect = [x0, OY + pos(r), x1 - x0, size(r)];
        corn.push(rect);
        live.set(key, { rect: rect, lastRow: r });
      }
      c = c2 + 1;
    }
  }
  // corn all around the edge of the map
  corn.push([0, 0, W, OY]);
  corn.push([0, H - OY, W, OY]);
  corn.push([0, OY, OX, H - 2 * OY]);
  corn.push([W - OX, OY, OX, H - 2 * OY]);

  // ----- the ground -----

  ground.push({ k: 'dirt', x: 0, y: 0, w: W, h: H });

  // ----- props -----

  function hay(x, y) {
    objects.push({ k: 'hay', x: Math.round(x), y: Math.round(y), r: 40 });
    solids.push([Math.round(x) - 16, Math.round(y) - 16, 32, 32]);
  }
  function pumpkins(x, y) {
    objects.push({ k: 'pumpkins', x: Math.round(x), y: Math.round(y), r: 40 });
    solids.push([Math.round(x) - 14, Math.round(y) - 10, 28, 20]);
  }
  function scarecrow(x, y) {
    objects.push({ k: 'scarecrow', x: Math.round(x), y: Math.round(y), r: 60 });
    solids.push([Math.round(x) - 8, Math.round(y) - 8, 16, 16]);
  }

  // the clearing
  const CC = W / 2;
  scarecrow(CC, CC);
  hay(CC - 150, CC - 150);
  hay(CC + 150, CC - 150);
  hay(CC - 150, CC + 150);
  hay(CC + 150, CC + 150);

  // dead ends: some get a prop pushed up against the closed end
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      if (Math.abs(i - MID) <= 1 && Math.abs(j - MID) <= 1) continue;
      const open = [];
      if (!B[2 * j][2 * i + 1]) open.push([0, -1]);
      if (!B[2 * j + 2][2 * i + 1]) open.push([0, 1]);
      if (!B[2 * j + 1][2 * i]) open.push([-1, 0]);
      if (!B[2 * j + 1][2 * i + 2]) open.push([1, 0]);
      if (open.length !== 1 || rand() > 0.55) continue;
      const cx = OX + WT + i * P + PW / 2 - open[0][0] * 20;
      const cy = OY + WT + j * P + PW / 2 - open[0][1] * 20;
      const pick = rand();
      if (pick < 0.45) hay(cx, cy);
      else if (pick < 0.75) pumpkins(cx, cy);
      else scarecrow(cx, cy);
    }
  }

  // This invisible object is drawn last, so the corn covers anyone standing in it
  objects.push({ k: 'cornlayer', x: W / 2, y: H + 5000, r: 1000000 });

  return { width: W, height: H, solids: solids, ground: ground, objects: objects, zones: { corn: corn }, npcs: 110 };
}

module.exports = { build };