// How the City map looks
(function () {
  const R = MapRender;
  const shade = R.shade;
  const rr = R.rr;
  const hash = R.hash;

  const GREENS = ['#3f8f4a', '#4aa05a', '#357f43', '#5bb067'];
  const CANOPY_ALPHA = 0.9;   // lower this (like 0.5) to see people through the leaves

  const kinds = {
    // A building: roof on top, front wall with windows underneath
    building(ctx, o) {
      const wall = shade(o.c, -0.38);

      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      ctx.fillRect(o.x + 10, o.y + 12, o.w, o.h + o.f);

      ctx.fillStyle = wall;
      ctx.fillRect(o.x, o.y + o.h, o.w, o.f);

      const hasDoor = o.w >= 150;
      const n = Math.max(1, Math.floor(o.w / 38));
      const gap = o.w / n;
      for (let i = 0; i < n; i++) {
        if (hasDoor && n % 2 === 1 && i === (n - 1) / 2) continue;   // leave room for the door
        ctx.fillStyle = hash(o.n * 31 + i) < 0.35 ? '#ffe9a3' : '#2f3b52';
        ctx.fillRect(o.x + i * gap + gap / 2 - 8, o.y + o.h + 7, 16, 11);
      }
      if (hasDoor) {
        ctx.fillStyle = '#3b2a1a';
        ctx.fillRect(o.x + o.w / 2 - 7, o.y + o.h + o.f - 16, 14, 16);
      }

      ctx.fillStyle = o.c;
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.strokeStyle = shade(o.c, -0.3);
      ctx.lineWidth = 3;
      ctx.strokeRect(o.x + 1.5, o.y + 1.5, o.w - 3, o.h - 3);
      ctx.strokeStyle = shade(o.c, 0.18);
      ctx.lineWidth = 2;
      ctx.strokeRect(o.x + 8, o.y + 8, o.w - 16, o.h - 16);

      const units = 1 + Math.floor(hash(o.n) * 3);
      for (let i = 0; i < units; i++) {
        const ux = o.x + 16 + hash(o.n * 7 + i) * Math.max(1, o.w - 60);
        const uy = o.y + 16 + hash(o.n * 13 + i) * Math.max(1, o.h - 52);
        ctx.fillStyle = shade(o.c, -0.2);
        ctx.fillRect(ux, uy, 26, 20);
        ctx.fillStyle = shade(o.c, 0.3);
        ctx.fillRect(ux + 3, uy + 3, 20, 3);
      }
    },

    // Zebra crossing
    cross(ctx, o) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      if (o.d === 'v') {
        for (let x = o.x; x + 10 <= o.x + o.w; x += 20) ctx.fillRect(x, o.y, 10, o.h);
      } else {
        for (let y = o.y; y + 10 <= o.y + o.h; y += 20) ctx.fillRect(o.x, y, o.w, 10);
      }
    },

    // The park pond
    water(ctx, o, now) {
      ctx.fillStyle = '#d3d8de';
      rr(ctx, o.x - 6, o.y - 6, o.w + 12, o.h + 12, 36);
      ctx.fill();
      ctx.fillStyle = '#4f9bd6';
      rr(ctx, o.x, o.y, o.w, o.h, 30);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const yy = o.y + 20 + i * ((o.h - 40) / 3);
        const sh = Math.sin(now / 700 + i * 1.7) * 8;
        ctx.beginPath();
        ctx.moveTo(o.x + 30 + sh, yy);
        ctx.quadraticCurveTo(o.x + o.w / 2 + sh, yy - 6, o.x + o.w - 30 + sh, yy);
        ctx.stroke();
      }
    },

    tree(ctx, o) {
      const s = o.s || 1;
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(o.x + 4, o.y + 2, 22 * s, 7 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#6b4a2b';
      ctx.fillRect(o.x - 4 * s, o.y - 24 * s, 8 * s, 26 * s);

      // The leaves are one shape, so the see-through is even
      const g = GREENS[o.v % GREENS.length];
      ctx.globalAlpha = CANOPY_ALPHA;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(o.x + 26 * s, o.y - 42 * s);
      ctx.arc(o.x, o.y - 42 * s, 26 * s, 0, Math.PI * 2);
      ctx.moveTo(o.x - 15 * s + 17 * s, o.y - 30 * s);
      ctx.arc(o.x - 15 * s, o.y - 30 * s, 17 * s, 0, Math.PI * 2);
      ctx.moveTo(o.x + 15 * s + 17 * s, o.y - 30 * s);
      ctx.arc(o.x + 15 * s, o.y - 30 * s, 17 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = shade(g, 0.18);
      ctx.beginPath();
      ctx.arc(o.x - 6 * s, o.y - 48 * s, 10 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    },

    bench(ctx, o) {
      const w = o.v ? 16 : 46;
      const h = o.v ? 46 : 16;
      const x = o.x - w / 2;
      const y = o.y - h / 2;
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(x + 3, y + 4, w, h);
      ctx.fillStyle = '#8a5a35';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#5e3c20';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (o.v) {
        ctx.moveTo(x + 5.5, y);
        ctx.lineTo(x + 5.5, y + h);
        ctx.moveTo(x + 10.5, y);
        ctx.lineTo(x + 10.5, y + h);
      } else {
        ctx.moveTo(x, y + 5.5);
        ctx.lineTo(x + w, y + 5.5);
        ctx.moveTo(x, y + 10.5);
        ctx.lineTo(x + w, y + 10.5);
      }
      ctx.stroke();
      ctx.strokeStyle = '#3d2814';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
    },

    // A parked car, seen from above
    car(ctx, o) {
      const w = o.v ? 32 : 64;
      const h = o.v ? 64 : 32;
      const x = o.x - w / 2;
      const y = o.y - h / 2;

      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      rr(ctx, x + 3, y + 5, w, h, 8);
      ctx.fill();

      ctx.fillStyle = '#17181c';
      if (o.v) {
        ctx.fillRect(x - 2, y + 8, 5, 14);
        ctx.fillRect(x + w - 3, y + 8, 5, 14);
        ctx.fillRect(x - 2, y + h - 22, 5, 14);
        ctx.fillRect(x + w - 3, y + h - 22, 5, 14);
      } else {
        ctx.fillRect(x + 8, y - 2, 14, 5);
        ctx.fillRect(x + w - 22, y - 2, 14, 5);
        ctx.fillRect(x + 8, y + h - 3, 14, 5);
        ctx.fillRect(x + w - 22, y + h - 3, 14, 5);
      }

      ctx.fillStyle = o.c;
      rr(ctx, x, y, w, h, 8);
      ctx.fill();
      ctx.strokeStyle = shade(o.c, -0.4);
      ctx.lineWidth = 2;
      ctx.stroke();

      const glass = '#9fc6e8';
      const roof = shade(o.c, -0.15);
      if (o.v) {
        ctx.fillStyle = glass;
        rr(ctx, x + 4, y + h * 0.55, w - 8, h * 0.2, 3);
        ctx.fill();
        rr(ctx, x + 5, y + h * 0.12, w - 10, h * 0.12, 3);
        ctx.fill();
        ctx.fillStyle = roof;
        rr(ctx, x + 4, y + h * 0.27, w - 8, h * 0.26, 3);
        ctx.fill();
      } else {
        ctx.fillStyle = glass;
        rr(ctx, x + w * 0.55, y + 4, w * 0.2, h - 8, 3);
        ctx.fill();
        rr(ctx, x + w * 0.12, y + 5, w * 0.12, h - 10, 3);
        ctx.fill();
        ctx.fillStyle = roof;
        rr(ctx, x + w * 0.27, y + 4, w * 0.26, h - 8, 3);
        ctx.fill();
      }
    },

    lamp(ctx, o) {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(o.x + 3, o.y + 1, 6, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3a3d45';
      ctx.fillRect(o.x - 1.5, o.y - 44, 3, 44);
      ctx.fillRect(o.x - 1.5, o.y - 46, 12, 3);
      ctx.fillStyle = '#ffe9a3';
      ctx.beginPath();
      ctx.arc(o.x + 9, o.y - 42, 4, 0, Math.PI * 2);
      ctx.fill();
    },

    fountain(ctx, o, now) {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.ellipse(o.x + 4, o.y + 6, 48, 42, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c9ced6';
      ctx.beginPath();
      ctx.arc(o.x, o.y, 44, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4f9bd6';
      ctx.beginPath();
      ctx.arc(o.x, o.y, 36, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 3; i++) {
        const ph = ((now / 1400) + i / 3) % 1;
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.6 * (1 - ph)) + ')';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(o.x, o.y, 6 + ph * 28, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = '#c9ced6';
      ctx.beginPath();
      ctx.arc(o.x, o.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e9f3fb';
      ctx.beginPath();
      ctx.arc(o.x, o.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  R.register('city', { kinds: kinds });
})();