// How the Mall map looks
(function () {
  const R = MapRender;
  const shade = R.shade;
  const rr = R.rr;
  const hash = R.hash;

  const GOODS = ['#d94a45', '#3d6fd6', '#f2cf4a', '#43a85c', '#e58a2b', '#a85cc7', '#f5f5f5'];
  const SHELF = ['#c9b08a', '#9fb4cf', '#d4a1b0', '#aecb98'];
  const AWNING = ['#d94a45', '#3d6fd6', '#43a85c'];

  function goods(seed) { return GOODS[Math.floor(hash(seed) * GOODS.length)]; }

  const kinds = {
    // ===== things painted on the ground =====

    // Faint tile lines over the whole floor
    tiles(ctx, o) {
      ctx.strokeStyle = 'rgba(120,100,70,0.12)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = o.x; x <= o.x + o.w; x += o.s) {
        ctx.moveTo(x, o.y);
        ctx.lineTo(x, o.y + o.h);
      }
      for (let y = o.y; y <= o.y + o.h; y += o.s) {
        ctx.moveTo(o.x, y);
        ctx.lineTo(o.x + o.w, y);
      }
      ctx.stroke();
    },

    // The floor inside a shop: wood planks (0), carpet (1) or tiles (2)
    storefloor(ctx, o) {
      ctx.fillStyle = o.c;
      ctx.fillRect(o.x, o.y, o.w, o.h);

      if (o.f === 0) {
        ctx.strokeStyle = 'rgba(90,60,30,0.2)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let y = o.y + 26; y < o.y + o.h; y += 26) {
          ctx.moveTo(o.x, y);
          ctx.lineTo(o.x + o.w, y);
        }
        let row = 0;
        for (let y = o.y; y < o.y + o.h; y += 26) {
          const off = (row % 2) * 45;
          for (let x = o.x + off + 60; x < o.x + o.w; x += 120) {
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + 26);
          }
          row++;
        }
        ctx.stroke();
      } else if (o.f === 1) {
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        let row = 0;
        for (let y = o.y + 10; y < o.y + o.h; y += 20) {
          const off = (row % 2) * 10;
          for (let x = o.x + 10 + off; x < o.x + o.w; x += 20) ctx.fillRect(x, y, 3, 3);
          row++;
        }
      } else {
        ctx.strokeStyle = 'rgba(0,0,0,0.09)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let x = o.x + 60; x < o.x + o.w; x += 60) {
          ctx.moveTo(x, o.y);
          ctx.lineTo(x, o.y + o.h);
        }
        for (let y = o.y + 60; y < o.y + o.h; y += 60) {
          ctx.moveTo(o.x, y);
          ctx.lineTo(o.x + o.w, y);
        }
        ctx.stroke();
      }
    },

    wall(ctx, o) {
      ctx.fillStyle = '#5a5f70';
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.fillStyle = '#7f8497';
      if (o.w >= o.h) ctx.fillRect(o.x, o.y, o.w, Math.min(6, o.h / 2));
      else ctx.fillRect(o.x, o.y, Math.min(6, o.w / 2), o.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 2;
      ctx.strokeRect(o.x + 1, o.y + 1, o.w - 2, o.h - 2);
    },

    // The shop name on its front wall
    sign(ctx, o) {
      ctx.save();
      rr(ctx, o.x, o.y, o.w, o.h, 6);
      ctx.fillStyle = o.c;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(o.t, o.x + o.w / 2, o.y + o.h / 2 + 1);
      ctx.restore();
    },

    // ===== scenery that people walk in front of or behind =====

    shelf(ctx, o) {
      const x0 = o.x - o.w / 2;
      const y0 = o.y - 36;

      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      ctx.fillRect(x0 + 3, o.y - 4, o.w, 10);

      // tall back panel with goods
      ctx.fillStyle = '#7d8391';
      ctx.fillRect(x0, y0 - 24, o.w, 24);
      const n = Math.floor(o.w / 12);
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = goods(o.x * 0.13 + o.y * 0.7 + i * 3.1);
        ctx.fillRect(x0 + 3 + i * 12, y0 - 20, 9, 7);
        ctx.fillStyle = goods(o.x * 0.29 + o.y * 0.3 + i * 5.3);
        ctx.fillRect(x0 + 3 + i * 12, y0 - 10, 9, 7);
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x0, y0 - 24, o.w, 24);

      // the shelf itself
      ctx.fillStyle = SHELF[o.v % SHELF.length];
      ctx.fillRect(x0, y0, o.w, 36);
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = goods(o.x * 0.41 + o.y * 0.17 + i * 7.7);
        ctx.fillRect(x0 + 3 + i * 12, y0 + 5, 9, 10);
        ctx.fillStyle = goods(o.x * 0.53 + o.y * 0.23 + i * 2.9);
        ctx.fillRect(x0 + 3 + i * 12, y0 + 21, 9, 10);
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x0, y0 + 18);
      ctx.lineTo(x0 + o.w, y0 + 18);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x0, y0, o.w, 36);
    },

    counter(ctx, o) {
      const x0 = o.x - o.w / 2;
      const y0 = o.y - 30;

      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      ctx.fillRect(x0 + 3, o.y - 2, o.w, 9);

      ctx.fillStyle = '#5e3c20';
      ctx.fillRect(x0, y0, o.w, 30);
      ctx.fillStyle = '#a97848';
      ctx.fillRect(x0, y0, o.w, 20);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(x0, y0, o.w, 4);

      // cash register
      ctx.fillStyle = '#2f3440';
      ctx.fillRect(x0 + 20, y0 + 3, 26, 14);
      ctx.fillStyle = '#7fd6ff';
      ctx.fillRect(x0 + 23, y0 + 5, 20, 7);

      // things on the counter
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = goods(o.x * 0.7 + o.y * 0.3 + i * 4.1);
        ctx.fillRect(x0 + o.w - 30 - i * 18, y0 + 6, 12, 9);
      }

      ctx.strokeStyle = '#3d2814';
      ctx.lineWidth = 2;
      ctx.strokeRect(x0, y0, o.w, 30);
    },

    // A small stand with a striped awning
    kiosk(ctx, o) {
      const x0 = o.x - 45;
      const y0 = o.y - 40;
      const col = AWNING[o.v % AWNING.length];

      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(x0 + 4, o.y - 2, 90, 9);

      // counter
      ctx.fillStyle = '#f3efe4';
      ctx.fillRect(x0, y0 + 10, 90, 30);
      ctx.fillStyle = col;
      ctx.fillRect(x0, y0 + 30, 90, 10);
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = goods(o.x * 0.31 + o.y * 0.2 + i * 6.3);
        ctx.fillRect(x0 + 8 + i * 13, y0 + 14, 9, 11);
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x0, y0 + 10, 90, 30);

      // posts
      ctx.strokeStyle = '#8a8f9c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x0 + 3, y0 - 6);
      ctx.lineTo(x0 + 3, y0 + 12);
      ctx.moveTo(x0 + 87, y0 - 6);
      ctx.lineTo(x0 + 87, y0 + 12);
      ctx.stroke();

      // striped awning
      for (let i = 0; i < 9; i++) {
        ctx.fillStyle = i % 2 === 0 ? col : '#ffffff';
        ctx.fillRect(x0 - 5 + i * 11.1, y0 - 34, 11.2, 28);
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x0 - 5, y0 - 34, 100, 28);
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

    // A potted palm
    planter(ctx, o, now) {
      const sway = Math.sin(now / 900 + o.x * 0.01) * 0.04;
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.ellipse(o.x + 4, o.y - 2, 20, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      const angles = [-1.0, -0.5, 0, 0.5, 1.0];
      for (let i = 0; i < angles.length; i++) {
        ctx.save();
        ctx.translate(o.x, o.y - 30);
        ctx.rotate(angles[i] + sway);
        ctx.fillStyle = i % 2 ? '#3f8f4a' : '#4aa05a';
        ctx.beginPath();
        ctx.ellipse(0, -24, 7, 26, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.fillStyle = '#b5654a';
      rr(ctx, o.x - 16, o.y - 32, 32, 32, 4);
      ctx.fill();
      ctx.fillStyle = '#cd7d60';
      ctx.fillRect(o.x - 18, o.y - 34, 36, 8);
      ctx.strokeStyle = '#7a3f2a';
      ctx.lineWidth = 2;
      rr(ctx, o.x - 16, o.y - 32, 32, 32, 4);
      ctx.stroke();
    },

    // A round food-court table with four chairs
    table(ctx, o) {
      const cx = o.x;
      const cy = o.y - 26;

      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.ellipse(cx + 4, cy + 8, 34, 28, 0, 0, Math.PI * 2);
      ctx.fill();

      const spots = [[0, -38], [38, 0], [0, 38], [-38, 0]];
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = goods(o.x * 0.5 + o.y * 0.2 + i * 9.1);
        ctx.beginPath();
        ctx.arc(cx + spots[i][0], cy + spots[i][1], 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.fillStyle = '#efe8d8';
      ctx.beginPath();
      ctx.arc(cx, cy, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#b8ad94';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = '#d94a45';
      ctx.beginPath();
      ctx.arc(cx - 8, cy - 5, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3d6fd6';
      ctx.beginPath();
      ctx.arc(cx + 9, cy + 6, 4.5, 0, Math.PI * 2);
      ctx.fill();
    },

    fountain(ctx, o, now) {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.ellipse(o.x + 5, o.y + 8, 96, 88, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#cfc6b2';
      ctx.beginPath();
      ctx.arc(o.x, o.y, 90, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e6dfce';
      ctx.beginPath();
      ctx.arc(o.x, o.y, 80, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4f9bd6';
      ctx.beginPath();
      ctx.arc(o.x, o.y, 72, 0, Math.PI * 2);
      ctx.fill();

      // ripples spreading out
      for (let i = 0; i < 4; i++) {
        const ph = ((now / 1800) + i / 4) % 1;
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.55 * (1 - ph)) + ')';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(o.x, o.y, 14 + ph * 56, 0, Math.PI * 2);
        ctx.stroke();
      }

      // middle bowl
      ctx.fillStyle = '#d6cdb9';
      ctx.beginPath();
      ctx.arc(o.x, o.y, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6bb3e6';
      ctx.beginPath();
      ctx.arc(o.x, o.y, 27, 0, Math.PI * 2);
      ctx.fill();

      // top
      ctx.fillStyle = '#d6cdb9';
      ctx.beginPath();
      ctx.arc(o.x, o.y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#eaf6ff';
      ctx.beginPath();
      ctx.arc(o.x, o.y, 7, 0, Math.PI * 2);
      ctx.fill();

      // water spraying out and falling
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const ph = ((now / 900) + i * 0.13) % 1;
        const rad = 10 + ph * 40;
        ctx.fillStyle = 'rgba(235,248,255,' + (1 - ph * 0.6) + ')';
        ctx.beginPath();
        ctx.arc(o.x + Math.cos(a) * rad, o.y + Math.sin(a) * rad - Math.sin(ph * Math.PI) * 18, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  R.register('mall', { kinds: kinds });
})();