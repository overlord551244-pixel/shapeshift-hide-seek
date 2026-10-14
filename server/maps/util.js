// Helpers used by the map files

// A random number generator that gives the same numbers every time for the same seed,
// so a map looks identical every time the server starts
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A lookup grid so "is this point inside any rectangle?" stays fast.
// Each rect is [x, y, width, height]. "pad" grows every rectangle on all sides.
function makeGrid(width, height, rects, pad, cell) {
  const cols = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  const cells = new Array(cols * rows).fill(null);

  for (const r of rects) {
    const x0 = r[0] - pad;
    const y0 = r[1] - pad;
    const x1 = r[0] + r[2] + pad;
    const y1 = r[1] + r[3] + pad;
    const c0 = Math.max(0, Math.floor(x0 / cell));
    const c1 = Math.min(cols - 1, Math.floor(x1 / cell));
    const r0 = Math.max(0, Math.floor(y0 / cell));
    const r1 = Math.min(rows - 1, Math.floor(y1 / cell));
    for (let cy = r0; cy <= r1; cy++) {
      for (let cx = c0; cx <= c1; cx++) {
        const i = cy * cols + cx;
        if (!cells[i]) cells[i] = [];
        cells[i].push([x0, y0, x1, y1]);
      }
    }
  }

  return {
    test(x, y) {
      const cx = Math.floor(x / cell);
      const cy = Math.floor(y / cell);
      if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return false;
      const list = cells[cy * cols + cx];
      if (!list) return false;
      for (let i = 0; i < list.length; i++) {
        const b = list[i];
        if (x > b[0] && x < b[2] && y > b[1] && y < b[3]) return true;
      }
      return false;
    }
  };
}

module.exports = { rng, makeGrid };