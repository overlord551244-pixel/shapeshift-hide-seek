// How the Farm map looks
(function () {
  const R = MapRender;
  const shade = R.shade;
  const rr = R.rr;
  const hash = R.hash;

  const GREENS = ['#3f8f4a', '#4aa05a', '#357f43', '#5bb067'];
  const CANOPY_ALPHA = 0.9;   // lower this (like 0.5) to see people through the leaves

  // How each kind of crop is drawn: row color, thickness, and dash pattern
  const CROPS = [
    { row: '#d9b84a', w: 11, dash: [10, 5] },    // wheat
    { row: '#58a847', w: 12, dash: [16, 6] },    // leafy greens
    { row: '#e8892b', w: 12, dash: [12, 26] },   // pumpkins
    { row: '#8fc96a', w: 14, dash: [16, 16] },   // cabbage
    { row: '#f2c332', w: 12, dash: [10, 24] }    // sunflowers
  ];

  function wheel(ctx, x, y, r) {
    ctx.fillStyle = '#1b1b1f';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#cfa94a';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6b6b70';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  const kinds = {
    // ===== things painted on the ground =====

    field(ctx, o) {
      ctx.fillStyle = '#7a5230';
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.strokeStyle = '#5e3d22';
      ctx.lineWidth = 4;
      ctx.strokeRect(o.x + 2, o.y + 2, o.w - 4, o.h - 4);
      const c = CROPS[o.c % CROPS.length];
      ctx.save();
      ctx.lineCap = 'round';
      ctx.setLineDash(c.dash);
      ctx.strokeStyle = c.row;
      ctx.lineWidth = c.w;
      for (let y = o.y + 16; y < o.y + o.h - 8; y += 26) {
        ctx.beginPath();
        ctx.moveTo(o.x + 14, y);
        ctx.lineTo(o.x + o.w - 14, y);
        ctx.stroke();
      }
      ctx.restore();
    },

    water(ctx, o, now) {
      const cx = o.x + o.w / 2;
      const cy = o.y + o.h / 2;
      ctx.fillStyle = '#d8c9a0';
      ctx.beginPath();
      ctx.ellipse(cx, cy, o.w / 2 + 10, o.h / 2 + 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4f9bd6';
      ctx.beginPath();
      ctx.ellipse(cx, cy, o.w / 2, o.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 3; i++) {
        const ph = ((now / 2400) + i / 3) % 1;
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.45 * (1 - ph)) + ')';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, (o.w / 2 - 12) * (0.2 + ph * 0.8), (o.h / 2 - 12) * (0.2 + ph * 0.8), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    },

    barn(ctx, o) {
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      ctx.fillRect(o.x + 12, o.y + 14, o.w, o.h + o.f);

      // front wall with planks and the big doors
      ctx.fillStyle = '#a83232';
      ctx.fillRect(o.x, o.y + o.h, o.w, o.f);
      ctx.fillStyle = '#8c2626';
      for (let x = o.x + 10; x < o.x + o.w - 4; x += 16) ctx.fillRect(x, o.y + o.h, 3, o.f);
      const dw = Math.min(90, o.w * 0.3);
      const dx = o.x + o.w / 2 - dw / 2;
      const dy = o.y + o.h + 4;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(dx - 4, dy - 2, dw + 8, o.f - 2);
      ctx.fillStyle = '#7d2020';
      ctx.fillRect(dx, dy + 2, dw, o.f - 6);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(dx + dw / 2, dy + 2);
      ctx.lineTo(dx + dw / 2, dy + o.f - 4);
      ctx.moveTo(dx, dy + 2);
      ctx.lineTo(dx + dw / 2, dy + o.f - 4);
      ctx.moveTo(dx + dw / 2, dy + 2);
      ctx.lineTo(dx, dy + o.f - 4);
      ctx.moveTo(dx + dw, dy + 2);
      ctx.lineTo(dx + dw / 2, dy + o.f - 4);
      ctx.moveTo(dx + dw / 2, dy + 2);
      ctx.lineTo(dx + dw, dy + o.f - 4);
      ctx.stroke();

      // roof
      ctx.fillStyle = '#7e2a2a';
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(o.x, o.y, o.w, o.h / 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = o.x + 20; x < o.x + o.w; x += 20) {
        ctx.moveTo(x, o.y);
        ctx.lineTo(x, o.y + o.h);
      }
      ctx.stroke();
      ctx.strokeStyle = '#4d1717';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(o.x, o.y + o.h / 2);
      ctx.lineTo(o.x + o.w, o.y + o.h / 2);
      ctx.stroke();
      ctx.lineWidth = 4;
      ctx.strokeRect(o.x + 2, o.y + 2, o.w - 4, o.h - 4);
    },

    house(ctx, o) {
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      ctx.fillRect(o.x + 10, o.y + 12, o.w, o.h + o.f);

      // front wall
      ctx.fillStyle = o.c;
      ctx.fillRect(o.x, o.y + o.h, o.w, o.f);
      ctx.fillStyle = '#4a6a8a';
      ctx.fillRect(o.x + o.w * 0.2 - 9, o.y + o.h + 6, 18, 14);
      ctx.fillRect(o.x + o.w * 0.8 - 9, o.y + o.h + 6, 18, 14);
      ctx.fillStyle = '#6b4a2e';
      ctx.fillRect(o.x + o.w / 2 - 8, o.y + o.h + o.f - 22, 16, 22);

      // roof
      ctx.fillStyle = '#6b4f3a';
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(o.x, o.y, o.w, o.h / 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.16)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let y = o.y + 14; y < o.y + o.h; y += 14) {
        ctx.moveTo(o.x, y);
        ctx.lineTo(o.x + o.w, y);
      }
      ctx.stroke();
      ctx.strokeStyle = '#3e2c1f';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(o.x, o.y + o.h / 2);
      ctx.lineTo(o.x + o.w, o.y + o.h / 2);
      ctx.stroke();
      ctx.lineWidth = 4;
      ctx.strokeRect(o.x + 2, o.y + 2, o.w - 4, o.h - 4);
      ctx.fillStyle = '#8a4a3a';
      ctx.fillRect(o.x + o.w * 0.74, o.y + 16, 24, 30);
      ctx.fillStyle = '#2b2b2b';
      ctx.fillRect(o.x + o.w * 0.74 + 5, o.y + 21, 14, 20);
    },

    // ===== scenery that people walk in front of or behind =====

    fence(ctx, o) {
      const x = o.x;
      const y = o.y;
      ctx.fillStyle = 'rgba(0,0,0,0.14)';
      if (o.v) ctx.fillRect(x - 2, y - 18, 6, 40);
      else ctx.fillRect(x - 20, y, 40, 4);

      ctx.strokeStyle = '#a37a4a';
      ctx.lineWidth = 3;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      if (o.v) {
        ctx.moveTo(x - 2, y - 36);
        ctx.lineTo(x - 2, y + 4);
        ctx.moveTo(x + 2, y - 28);
        ctx.lineTo(x + 2, y + 12);
      } else {
        ctx.moveTo(x - 20, y - 16);
        ctx.lineTo(x + 20, y - 16);
        ctx.moveTo(x - 20, y - 8);
        ctx.lineTo(x + 20, y - 8);
      }
      ctx.stroke();

      ctx.fillStyle = '#7a5530';
      ctx.fillRect(x - (o.v ? 3 : 22), y - 22, 6, 24);
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

      if (o.a) {   // apples
        ctx.fillStyle = '#d93a2b';
        for (let i = 0; i < 6; i++) {
          const ax = o.x + (hash(o.x * 3 + o.y + i) - 0.5) * 44 * s;
          const ay = o.y - 30 * s - hash(o.y * 5 + o.x + i) * 28 * s;
          ctx.beginPath();
          ctx.arc(ax, ay, 2.6 * s, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },

    rock(ctx, o) {
      const s = o.s || 1;
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(o.x + 3, o.y + 6 * s, 15 * s, 6 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8c8f96';
      ctx.beginPath();
      ctx.ellipse(o.x, o.y, 13 * s, 10 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#a9acb3';
      ctx.beginPath();
      ctx.ellipse(o.x - 3 * s, o.y - 3 * s, 7 * s, 5 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    },

    hay(ctx, o) {
      if (o.v === 1) {   // round bale
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
        for (const r of [11, 6]) {
          ctx.beginPath();
          ctx.arc(o.x, o.y, r, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.strokeStyle = '#8a6a1f';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(o.x, o.y, 16, 0, Math.PI * 2);
        ctx.stroke();
        return;
      }
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(o.x - 13, o.y + 8, 32, 6);
      ctx.fillStyle = '#e6c960';
      ctx.fillRect(o.x - 14, o.y - 12, 28, 12);
      ctx.fillStyle = '#c9a43a';
      ctx.fillRect(o.x - 14, o.y, 28, 12);
      ctx.strokeStyle = 'rgba(138,106,31,0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = -10; i <= 10; i += 5) {
        ctx.moveTo(o.x + i, o.y - 12);
        ctx.lineTo(o.x + i, o.y + 12);
      }
      ctx.stroke();
      ctx.strokeStyle = '#8a6a1f';
      ctx.lineWidth = 2;
      ctx.strokeRect(o.x - 14, o.y - 12, 28, 24);
    },

    trough(ctx, o) {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(o.x - 22, o.y + 5, 48, 6);
      ctx.fillStyle = '#7a5530';
      rr(ctx, o.x - 24, o.y - 8, 48, 16, 3);
      ctx.fill();
      ctx.fillStyle = '#4f9bd6';
      ctx.fillRect(o.x - 20, o.y - 5, 40, 8);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(o.x - 16, o.y - 4, 14, 2);
      ctx.strokeStyle = '#4a3219';
      ctx.lineWidth = 2;
      rr(ctx, o.x - 24, o.y - 8, 48, 16, 3);
      ctx.stroke();
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
    },

    coop(ctx, o) {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(o.x - 40, o.y + 2, 96, 10);
      ctx.fillStyle = '#b9854f';
      ctx.fillRect(o.x - 45, o.y - 36, 90, 36);
      ctx.strokeStyle = '#8a6030';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = o.x - 35; x < o.x + 45; x += 10) {
        ctx.moveTo(x, o.y - 36);
        ctx.lineTo(x, o.y);
      }
      ctx.stroke();
      ctx.fillStyle = '#5a3a1e';
      ctx.fillRect(o.x - 9, o.y - 26, 18, 26);
      ctx.fillStyle = '#f2e3a8';
      ctx.fillRect(o.x + 22, o.y - 26, 14, 12);
      ctx.fillStyle = '#a33a2a';
      ctx.beginPath();
      ctx.moveTo(o.x - 54, o.y - 36);
      ctx.lineTo(o.x + 54, o.y - 36);
      ctx.lineTo(o.x + 42, o.y - 72);
      ctx.lineTo(o.x - 42, o.y - 72);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#6e241a';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(o.x, o.y - 72);
      ctx.lineTo(o.x, o.y - 36);
      ctx.stroke();
    },

    silo(ctx, o) {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(o.x + 16, o.y + 6, 46, 14, 0, 0, Math.PI * 2);
      ctx.fill();

      const top = o.y - 130;
      ctx.fillStyle = '#c8ccd4';
      ctx.fillRect(o.x - 36, top, 72, 130);
      ctx.beginPath();
      ctx.ellipse(o.x, o.y, 36, 12, 0, 0, Math.PI);
      ctx.fill();
      // lighting down the side
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(o.x - 24, top, 12, 130);
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(o.x + 14, top, 22, 130);
      // metal bands
      ctx.strokeStyle = '#9aa1ad';
      ctx.lineWidth = 2;
      for (let y = top + 22; y < o.y - 6; y += 24) {
        ctx.beginPath();
        ctx.moveTo(o.x - 36, y);
        ctx.quadraticCurveTo(o.x, y + 8, o.x + 36, y);
        ctx.stroke();
      }
      // dome
      ctx.fillStyle = '#8a94a6';
      ctx.beginPath();
      ctx.ellipse(o.x, top, 36, 14, 0, Math.PI, 0);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(o.x, top, 36, 12, 0, 0, Math.PI);
      ctx.fillStyle = '#b3bac6';
      ctx.fill();
      ctx.fillStyle = '#8a94a6';
      ctx.fillRect(o.x - 3, top - 20, 6, 8);
    },

    tractor(ctx, o) {
      ctx.save();
      ctx.translate(o.x, o.y);
      if (o.f < 0) ctx.scale(-1, 1);

      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.ellipse(6, 28, 56, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      wheel(ctx, -26, 11, 17);
      wheel(ctx, 34, 18, 10);

      // engine hood
      ctx.fillStyle = '#3f9a4b';
      rr(ctx, -6, -14, 52, 24, 5);
      ctx.fill();
      ctx.strokeStyle = '#2a6e34';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = '#2a6e34';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = 38; x <= 46; x += 4) {
        ctx.moveTo(x, -9);
        ctx.lineTo(x, 5);
      }
      ctx.stroke();

      // exhaust pipe
      ctx.fillStyle = '#4a4a50';
      ctx.fillRect(28, -34, 5, 22);

      // cab
      ctx.fillStyle = '#3f9a4b';
      rr(ctx, -40, -36, 36, 36, 4);
      ctx.fill();
      ctx.strokeStyle = '#2a6e34';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#bfe0f2';
      rr(ctx, -36, -32, 28, 18, 3);
      ctx.fill();
      ctx.fillStyle = '#2a6e34';
      rr(ctx, -44, -41, 44, 6, 2);
      ctx.fill();

      ctx.restore();
    }
  };

  R.register('farm', { kinds: kinds });
})();