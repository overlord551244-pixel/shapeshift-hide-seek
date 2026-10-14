// The Mall: 7 shops along the top, 7 along the bottom, two department stores in the middle,
// and a big hall with a fountain, kiosks and a food court.

const W = 3200;
const H = 2200;
const T = 60;          // thickness of the outer wall
const PITCH = 440;     // width of each shop in the top and bottom rows
const WALL_T = 40;     // thickness of the shop front walls
const DOOR = 130;      // width of a shop door
const N_FRONT = 500;   // the top shops' front wall runs from y = 500 to 540
const S_FRONT = 1660;  // the bottom shops' front wall runs from y = 1660 to 1700
const PCX = 1600;      // the fountain
const PCY = 1100;

// Floor style: 0 = wood, 1 = carpet, 2 = tile. "v" picks the color of the goods on the shelves.
const NORTH = [
  { n: 'Sneaker Spot', c: '#e2cfa8', f: 0, s: '#d94a45', v: 0 },
  { n: 'Book Nook',    c: '#b9a07a', f: 0, s: '#7a4a2b', v: 0 },
  { n: 'Gadget Hub',   c: '#dfe3ea', f: 2, s: '#2f6fd6', v: 1 },
  { n: 'Toy Town',     c: '#f3dca0', f: 1, s: '#e58a2b', v: 3 },
  { n: 'Fashion Fix',  c: '#ecd4dc', f: 1, s: '#c2478a', v: 2 },
  { n: 'Sweet Treats', c: '#f6e3ea', f: 2, s: '#e8629a', v: 2 },
  { n: 'Pet Pals',     c: '#d6e6c8', f: 1, s: '#43a85c', v: 3 }
];
const SOUTH = [
  { n: 'Music Box',   c: '#c4b8dc', f: 1, s: '#7a4ac2', v: 1 },
  { n: 'Style Co.',   c: '#e6e0d0', f: 0, s: '#2b2f3a', v: 0 },
  { n: 'Home Goods',  c: '#e2d6c0', f: 0, s: '#8a5a35', v: 3 },
  { n: 'Sports Zone', c: '#cfe0ee', f: 2, s: '#2f8fd6', v: 1 },
  { n: 'Game Den',    c: '#b9bfd9', f: 1, s: '#3a3f8f', v: 1 },
  { n: 'Bean Bar',    c: '#d9c3a3', f: 0, s: '#6b4a2e', v: 0 },
  { n: 'Pizza Place', c: '#f0d5c0', f: 2, s: '#d9472b', v: 2 }
];
const BIG = [
  { n: 'Grand Emporium', c: '#d6dcec', f: 2, s: '#2f4a8a', v: 1 },
  { n: 'Fresh Market',   c: '#dcebd2', f: 2, s: '#2e8b57', v: 3 }
];

function build() {
  const solids = [];   // things you can't walk through: [x, y, w, h]
  const ground = [];   // painted on the ground, in order
  const objects = [];  // shelves, kiosks, plants...: drawn in front of or behind people

  // ----- little builders -----

  function fill(x, y, w, h, c, extra) {
    ground.push(Object.assign({ k: 'fill', x: x, y: y, w: w, h: h, c: c }, extra || {}));
  }

  function wall(x, y, w, h) {
    ground.push({ k: 'wall', x: x, y: y, w: w, h: h });
    solids.push([x, y, w, h]);
  }

  function sign(x, y, w, h, text, color) {
    ground.push({ k: 'sign', x: x, y: y, w: w, h: h, t: text, c: color });
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

  // "bottom" is where the object meets the floor. People standing lower than that are drawn in front.
  function shelf(cx, bottom, w, v) {
    objects.push({ k: 'shelf', x: cx, y: bottom, w: w, v: v, r: w / 2 + 70 });
    solids.push([cx - w / 2, bottom - 36, w, 36]);
  }

  function counter(cx, bottom, w) {
    objects.push({ k: 'counter', x: cx, y: bottom, w: w, r: w / 2 + 50 });
    solids.push([cx - w / 2, bottom - 30, w, 30]);
  }

  function kiosk(cx, bottom, v) {
    objects.push({ k: 'kiosk', x: cx, y: bottom, v: v, r: 120 });
    solids.push([cx - 45, bottom - 40, 90, 40]);
  }

  function planter(cx, bottom) {
    objects.push({ k: 'planter', x: cx, y: bottom, r: 90 });
    solids.push([cx - 16, bottom - 32, 32, 32]);
  }

  function bench(cx, cy, vertical) {
    const w = vertical ? 16 : 46;
    const h = vertical ? 46 : 16;
    objects.push({ k: 'bench', x: cx, y: cy, v: vertical ? 1 : 0, r: 40 });
    solids.push([cx - w / 2, cy - h / 2, w, h]);
  }

  function table(cx, cy) {
    objects.push({ k: 'table', x: cx, y: cy + 26, r: 80 });
    solids.push([cx - 26, cy - 26, 52, 52]);
  }

  // ===== the floor =====

  fill(0, 0, W, H, '#e9e1d2');
  ground.push({ k: 'tiles', x: T, y: T, w: W - 2 * T, h: H - 2 * T, s: 100 });

  // the plaza around the fountain
  ground.push({ k: 'ellipse', x: PCX - 300, y: PCY - 300, w: 600, h: 600, c: '#ddd3bd' });
  ground.push({ k: 'ellipse', x: PCX - 260, y: PCY - 260, w: 520, h: 520, c: '#efe7d6' });
  ground.push({ k: 'ellipse', x: PCX - 130, y: PCY - 130, w: 260, h: 260, c: '#e3d9c3' });

  // patches of light from the skylights
  for (let x = 240; x < 2900; x += 520) {
    fill(x, 730, 260, 70, 'rgba(255,255,255,0.35)', { s: 'rgba(255,255,255,0.5)', sw: 2 });
    fill(x, 1400, 260, 70, 'rgba(255,255,255,0.35)', { s: 'rgba(255,255,255,0.5)', sw: 2 });
  }

  // ===== the outer wall =====

  wall(0, 0, W, T);
  wall(0, H - T, W, T);
  wall(0, T, T, H - 2 * T);
  wall(W - T, T, T, H - 2 * T);

  // ===== the top and bottom rows of shops =====

  function frontWall(y) {
    let x = T;
    for (let i = 0; i < 7; i++) {
      const c = T + PITCH * i + PITCH / 2;
      wall(x, y, c - DOOR / 2 - x, WALL_T);
      x = c + DOOR / 2;
    }
    wall(x, y, W - T - x, WALL_T);
  }
  frontWall(N_FRONT);
  frontWall(S_FRONT);

  // walls between the shops
  for (let k = 1; k <= 6; k++) {
    const bx = T + PITCH * k;
    wall(bx - 10, T, 20, N_FRONT + WALL_T - T);
    wall(bx - 10, S_FRONT, 20, H - T - S_FRONT);
  }

  // dir = 1 for the top row (shop back wall at the top), -1 for the bottom row
  function shopRow(list, frontY, dir) {
    const back = dir > 0 ? T : H - T;
    const floorY = dir > 0 ? T : frontY + WALL_T;
    const floorH = dir > 0 ? frontY - T : H - T - (frontY + WALL_T);

    for (let i = 0; i < 7; i++) {
      const bx = T + PITCH * i;
      const cx = bx + PITCH / 2;
      const s = list[i];

      ground.push({ k: 'storefloor', x: bx, y: floorY, w: PITCH, h: floorH, c: s.c, f: s.f });
      fill(cx - DOOR / 2, frontY, DOOR, WALL_T, '#7a6552');                       // doormat
      sign(bx + 14, frontY + 6, 134, 28, s.n, s.s);                                 // name sign
      fill(bx + 295, frontY + 8, 125, 24, 'rgba(170,215,240,0.9)', { s: '#3a3f4a', sw: 2 });   // display window

      // checkout counter against the back wall, then two rows of shelves
      counter(cx, dir > 0 ? back + 30 : back, 280);
      for (const off of [150, 280]) {
        const bottom = dir > 0 ? back + off + 36 : back - off;
        shelf(bx + 75, bottom, 130, s.v);
        shelf(bx + 365, bottom, 130, s.v);
      }
    }
  }
  shopRow(NORTH, N_FRONT, 1);
  shopRow(SOUTH, S_FRONT, -1);

  // ===== the two department stores in the middle (the right one mirrors the left one) =====

  function bigStore(mirror, theme) {
    const mx = (x, w) => (mirror ? W - (x + w) : x);
    const wallM = (x, y, w, h) => wall(mx(x, w), y, w, h);
    const cxM = (x) => (mirror ? W - x : x);

    ground.push({ k: 'storefloor', x: mx(180, 620), y: 860, w: 620, h: 500, c: theme.c, f: theme.f });

    fill(mx(400, 140), 820, 140, 40, '#7a6552');   // doormat (top door)
    fill(mx(792, 36), 1028, 36, 140, '#7a6552');   // doormat (side door)

    wallM(160, 820, 240, 40);                      // top wall, left of the door
    wallM(540, 820, 280, 40);                      // top wall, right of the door
    wallM(160, 1360, 660, 20);                     // bottom wall
    wallM(160, 820, 20, 560);                      // outer side wall
    wallM(800, 820, 20, 208);                      // inner side wall, above the door
    wallM(800, 1168, 20, 212);                     // inner side wall, below the door

    sign(mx(560, 240), 826, 240, 28, theme.n, theme.s);
    fill(mx(180, 200), 830, 200, 20, 'rgba(170,215,240,0.9)', { s: '#3a3f4a', sw: 2 });

    // four rows of racks, and a counter along the bottom wall
    for (const bottom of [908, 1028, 1148, 1268]) {
      shelf(cxM(345), bottom, 150, theme.v);
      shelf(cxM(595), bottom, 150, theme.v);
    }
    counter(cxM(490), 1360, 300);
  }
  bigStore(false, BIG[0]);
  bigStore(true, BIG[1]);

  // ===== the main hall =====

  // fountain
  objects.push({ k: 'fountain', x: PCX, y: PCY, r: 140 });
  ellipseSolids(PCX, PCY, 82, 82, 8);

  bench(PCX - 160, PCY, true);
  bench(PCX + 160, PCY, true);
  bench(PCX, PCY - 160, false);
  bench(PCX, PCY + 160, false);

  planter(PCX - 270, 900);
  planter(PCX + 270, 900);
  planter(PCX - 270, 1300);
  planter(PCX + 270, 1300);

  // plants along the shop fronts
  for (let k = 1; k <= 6; k++) {
    const bx = T + PITCH * k;
    planter(bx, 580);
    planter(bx, 1652);
  }

  // kiosks
  kiosk(860, 700, 0);
  kiosk(1600, 700, 1);
  kiosk(2340, 700, 2);
  kiosk(860, 1540, 1);
  kiosk(2340, 1540, 0);

  // food court
  for (const x of [1220, 1600, 1980]) {
    table(x, 1420);
    table(x, 1540);
  }

  return { width: W, height: H, solids: solids, ground: ground, objects: objects, zones: {}, npcs: 160 };
}

module.exports = { build };