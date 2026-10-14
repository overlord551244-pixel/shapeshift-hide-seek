// How the Corn Maze looks
(function () {
  const R = MapRender;
  const hash = R.hash;

  const CORN_ALPHA = 0.86;   // lower this (like 0.6) to see people inside the corn more clearly
  const RUSTLE_MS = 1200;    // how long the rustle effect lasts

  let cornPat = null;
  let dirtPat = null;

  // One corn plant seen from above: six leaves and a golden tassel in the middle
  function plant(g, x, y, rot, leafA, leafB) {
    for (let i = 0; i < 6; i++) {
      g.save();
      g.translate(x, y);
      g.rotate(rot + (i * Math.PI) / 3);
      g.fillStyle = i % 2 ? leafA : leafB;
      g.beginPath();
      g.ellipse(11, 0, 12, 3.6, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.18)';
      g.lineWidth = 0.8;
      g.beginPath();
      g.moveTo(2, 0);
      g.lineTo(22, 0);
      g.stroke();
      g.restore();
    }
    g.fillStyle = '#d9bd4f';
    g.beginPath();
    g.arc(x, y, 2.6, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#f1dc8a';
    g.beginPath();
    g.arc(x - 0.8, y - 0.8, 1.2, 0, Math.PI * 2);
    g.fill();
  }

  // A small tile of corn that repeats across all the walls
  function cornPattern(ctx) {
    if (cornPat) return cornPat;
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const g = c.getContext('2d');
    g.scale(2, 2);   // the tile is 64 x 64 world units, drawn at double detail
    g.fillStyle = '#2f5f1b';
    g.fillRect(0, 0, 64, 64);
    const spots = [[12, 12, 0.2], [44, 10, 1.1], [28, 30, 0.6], [58, 34, 1.7], [10, 50, 2.3], [40, 54, 0.9]];
    for (const s of spots) {
      for (const dx of [-64, 0, 64]) {
        for (const dy of [-64, 0, 64]) plant(g, s[0] + dx, s[1] + dy, s[2], '#4d8f2b', '#5fa835');
      }
    }
    const p = ctx.createPattern(c, 'repeat');
    try {
      if (p.setTransform && typeof DOMMatrix !== 'undefined') p.setTransform(new DOMMatrix([0.5, 0, 0, 0.5, 0, 0]));
    } catch (e) { /* older browsers just show the corn a bit blurrier */ }
    cornPat = p;
    return p;
  }

  // A tile of dry dirt for the paths
  function dirtPattern(ctx) {
    if (dirtPat) return dirtPat;
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#c9aa6b';
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 70; i++) {
      const x = 6 + hash(i * 3.1) * 116;
      const y = 6 + hash(i * 5.7 + 1) * 116;
      const r = 1 + hash(i * 2.3) * 2.6;
      g.fillStyle = hash(i * 7.9) < 0.5 ? '#b99a5a' : '#d8bd82';
      g.fillRect(x, y, r * 1.6, r);
    }
    g.strokeStyle = '#d9c27f';
    g.lineWidth = 1.2;
    for (let i = 0; i < 14; i++) {
      const x = 10 + hash(i * 4.4 + 9) * 100;
      const y = 10 + hash(i * 6.1 + 2) * 100;
      const a = hash(i * 1.9) * Math.PI;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * 9, y + Math.sin(a) * 9);
      g.stroke();
    }
    dirtPat = ctx.createPattern(c, 'repeat');
    return dirtPat;
  }

  // Leaves that flash up where something is pushing through the corn
  function rustle(ctx, now) {
    const list = R.disturbances;
    for (let n = 0; n < list.length; n++) {
      const d = list[n];
      const k = (now - d.t) / RUSTLE_MS;
      if (k < 0 || k >= 1) continue;
      for (let i = 0; i < 7; i++) {
        const a = hash(d.x * 0.37 + d.y * 0.19 + i * 7.7) * Math.PI * 2;
        const rr = 4 + hash(d.x * 0.11 + d.y * 0.53 + i * 3.3) * 22;
        const sway = Math.sin(now / 45 + i * 2.1) * 3.2 * (1 - k);
        const px = d.x + Math.cos(a) * rr + sway;
        const py = d.y + Math.sin(a) * rr - Math.abs(sway) * 0.5;
        ctx.globalAlpha = (1 - k) * 0.9;
        for (let j = 0; j < 4; j++) {
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(a + j * 1.57 + sway * 0.12);
          ctx.fillStyle = j % 2 ? '#a6dc5a' : '#8fcf4a';
          ctx.beginPath();
          ctx.ellipse(6, 0, 7, 2.4, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        ctx.fillStyle = '#e8d070';
        ctx.beginPath();
        ctx.arc(px, py, 1.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  const kinds = {
    // the dry dirt under everything
    dirt(ctx, o) {
      ctx.fillStyle = dirtPattern(ctx);
      ctx.fillRect(o.x, o.y, o.w, o.h);
    },

    // The corn walls, drawn on top of everyone so it covers anyone standing in it
    cornlayer(ctx, o, now) {
      const d = R.data();
      if (!d || !d.zones || !d.zones.corn) return;
      const rects = d.zones.corn;

      // work out which part of the world is on screen
      const m = ctx.getTransform();
      const vx0 = -m.e / m.a - 20;
      const vy0 = -m.f / m.d - 20;
      const vx1 = vx0 + ctx.canvas.width / m.a + 40;
      const vy1 = vy0 + ctx.canvas.height / m.d + 40;

      ctx.save();
      ctx.globalAlpha = CORN_ALPHA;
      ctx.fillStyle = cornPattern(ctx);
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        if (r[0] > vx1 || r[0] + r[2] < vx0 || r[1] > vy1 || r[1] + r[3] < vy0) continue;
        ctx.fillRect(r[0], r[1], r[2], r[3]);
      }
      ctx.restore();

      rustle(ctx, now);
    },

    // A round hay bale
    hay(ctx, o) {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(o.x + 3, o.y + 14, 18, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d9b84a';
      ctx.beginPath();
      ctx.arc(o.x, o.y, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#b8942c';
      ctx.lineWidth = 2;
      for (const rad of [11, 6]) {
        ctx.beginPath();
        ctx.arc(o.x, o.y, rad, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.strokeStyle = '#8a6a1f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(o.x, o.y, 16, 0, Math.PI * 2);
      ctx.stroke();
    },

    // A little pile of pumpkins
    pumpkins(ctx, o) {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(o.x + 2, o.y + 10, 20, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      const spots = [[-10, 3, 9], [9, 5, 8.5], [0, -5, 8]];
      for (const s of spots) {
        const px = o.x + s[0];
        const py = o.y + s[1];
        ctx.fillStyle = '#e8892b';
        ctx.beginPath();
        ctx.ellipse(px, py, s[2] + 1.5, s[2], 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#b8651a';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(px, py, s[2] * 0.45, s[2], 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#4a7a2a';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(px, py - s[2] + 1);
        ctx.lineTo(px + 1.5, py - s[2] - 3);
        ctx.stroke();
      }
    },

    scarecrow(ctx, o) {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(o.x + 3, o.y + 2, 12, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#6b4a2e';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(o.x, o.y);
      ctx.lineTo(o.x, o.y - 52);
      ctx.moveTo(o.x - 22, o.y - 38);
      ctx.lineTo(o.x + 22, o.y - 38);
      ctx.stroke();
      ctx.fillStyle = '#4a6fa5';
      ctx.beginPath();
      ctx.moveTo(o.x - 9, o.y - 40);
      ctx.lineTo(o.x + 9, o.y - 40);
      ctx.lineTo(o.x + 7, o.y - 16);
      ctx.lineTo(o.x - 7, o.y - 16);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#e0c25a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(o.x - 22, o.y - 38);
      ctx.lineTo(o.x - 27, o.y - 32);
      ctx.moveTo(o.x + 22, o.y - 38);
      ctx.lineTo(o.x + 27, o.y - 32);
      ctx.stroke();
      ctx.fillStyle = '#e6d3a3';
      ctx.beginPath();
      ctx.arc(o.x, o.y - 50, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#222222';
      ctx.fillRect(o.x - 3, o.y - 52, 2, 2);
      ctx.fillRect(o.x + 2, o.y - 52, 2, 2);
      ctx.fillStyle = '#5b3d1d';
      ctx.fillRect(o.x - 12, o.y - 58, 24, 4);
      ctx.fillRect(o.x - 7, o.y - 68, 14, 11);
    }
  };

  R.register('cornMaze', { kinds: kinds });
})();