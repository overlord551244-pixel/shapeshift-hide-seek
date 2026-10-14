// Item icons (drawn with shapes) and the text that describes each item
const Icons = (function () {
  const INFO = {
    gun: {
      name: 'Gun', type: 'locked',
      text: 'Left-click to shoot. Shooting an NPC costs you a heart. Locked in slot 1.',
      stats: 'Reload time is set by the host'
    },
    runningShoes: {
      name: 'Running Shoes', type: 'passive',
      text: 'Walk and run 40% faster for the whole round.',
      stats: 'Passive'
    },
    enhancedEyes: {
      name: 'Enhanced Eyesight', type: 'passive',
      text: 'Your field of view is 80% larger, so you see more of the map.',
      stats: 'Passive'
    },
    radarScanner: {
      name: 'Radar Scanner', type: 'active',
      text: 'Plant a scanner on the ground. Its circle turns green when a hider is inside it.',
      stats: 'Lasts 30s \u00B7 Place every 20s'
    },
    invisibilityCloak: {
      name: 'Invisibility Cloak', type: 'active',
      text: 'Hiders cannot see you while it is active.',
      stats: 'Lasts 12s \u00B7 10s cooldown after'
    },
    compass: {
      name: 'Compass', type: 'active',
      text: 'A compass appears over you and points toward the nearest hider.',
      stats: 'Lasts 3.5s \u00B7 Cooldown 16s'
    },
    beartrap: {
      name: 'Beartrap', type: 'active',
      text: 'Place a trap. A hider who steps on it is stuck for 4s and you get an arrow to them. NPCs never trigger it.',
      stats: 'Place every 12s \u00B7 Max 8 on the map'
    },
    slingshot: {
      name: 'Slingshot', type: 'active',
      text: 'Press its key to hold it, then click to fire a rock. A hit stuns the seeker for 3s. The seeker cannot see you holding it.',
      stats: 'Cooldown 10s \u00B7 Limited range'
    },
    smokeBomb: {
      name: 'Smoke Bomb', type: 'active',
      text: 'Release a big cloud of smoke around yourself.',
      stats: 'Lasts 7s \u00B7 Cooldown 26s'
    },
    inkBomb: {
      name: 'Ink Bomb', type: 'active',
      text: 'Place an ink can. A seeker who walks onto it gets their screen covered in ink. The seeker sees it only faintly.',
      stats: 'Max 2 cans \u00B7 Oldest despawns'
    }
  };

  function rr(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function circle(g, x, y, r, fill) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fillStyle = fill;
    g.fill();
  }

  // Fills a polygon with the current fill color
  function poly(g, pts) {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
    g.fill();
  }

  // Every icon is drawn in a 32 x 32 box centered on (0, 0)
  const DRAW = {
    gun(g) {
      g.fillStyle = '#3d414b';
      rr(g, -15, -9, 26, 8, 2);
      g.fill();
      g.fillStyle = '#5a5f6b';
      g.fillRect(-15, -9, 26, 2.5);
      g.fillStyle = '#2a2d34';
      poly(g, [[-2, -1], [8, -1], [6, 13], [-3, 13]]);
      g.strokeStyle = '#2a2d34';
      g.lineWidth = 1.6;
      g.beginPath();
      g.arc(-6, 0.5, 4.5, 0, Math.PI);
      g.stroke();
    },

    runningShoes(g) {
      g.fillStyle = '#e5533d';
      poly(g, [[-12, -9], [-3, -9], [-1, -3], [8, -1], [14, 5], [14, 8], [-12, 8]]);
      g.fillStyle = '#f6f6f6';
      g.fillRect(-12, 6, 26, 4);
      g.strokeStyle = '#ffffff';
      g.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.moveTo(-1 + i * 3.5, -4 + i * 1.4);
        g.lineTo(2 + i * 3.5, -6 + i * 1.4);
        g.stroke();
      }
      g.strokeStyle = '#8b95a7';
      g.lineWidth = 1.6;
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.moveTo(-15.5, -3 + i * 4.5);
        g.lineTo(-13.5, -3 + i * 4.5);
        g.stroke();
      }
    },

    enhancedEyes(g) {
      g.fillStyle = '#ffffff';
      g.strokeStyle = '#2b2f3a';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(-15, 0);
      g.quadraticCurveTo(0, -14, 15, 0);
      g.quadraticCurveTo(0, 14, -15, 0);
      g.closePath();
      g.fill();
      g.stroke();
      circle(g, 0, 0, 6, '#3b7de0');
      circle(g, 0, 0, 2.8, '#101010');
      circle(g, -1.8, -2, 1.3, '#ffffff');
    },

    radarScanner(g) {
      g.strokeStyle = '#2fbf71';
      g.lineWidth = 2;
      for (const r of [13, 8.5, 4]) {
        g.beginPath();
        g.arc(0, 0, r, 0, Math.PI * 2);
        g.stroke();
      }
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(9.5, -9.5);
      g.stroke();
      circle(g, 6, -4, 1.8, '#e5533d');
    },

    invisibilityCloak(g) {
      g.setLineDash([3, 2.5]);
      g.strokeStyle = '#5b4b8a';
      g.lineWidth = 2;
      g.fillStyle = 'rgba(120,100,190,0.35)';
      g.beginPath();
      g.arc(0, -8, 5.5, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.beginPath();
      g.moveTo(-5, -3);
      g.lineTo(5, -3);
      g.lineTo(13, 13);
      g.lineTo(-13, 13);
      g.closePath();
      g.fill();
      g.stroke();
      g.setLineDash([]);
    },

    compass(g) {
      circle(g, 0, 0, 13, '#f6ecd0');
      g.strokeStyle = '#b8860b';
      g.lineWidth = 2.5;
      g.beginPath();
      g.arc(0, 0, 13, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = '#d93a2b';
      poly(g, [[0, -10], [3.2, 0], [-3.2, 0]]);
      g.fillStyle = '#6b7280';
      poly(g, [[0, 10], [3.2, 0], [-3.2, 0]]);
      circle(g, 0, 0, 1.6, '#222222');
    },

    beartrap(g) {
      g.fillStyle = '#c2c2c2';
      g.strokeStyle = '#4b4f58';
      g.lineWidth = 2;
      g.beginPath();
      g.ellipse(0, 2, 13, 9, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.beginPath();
      g.moveTo(-12, 2);
      for (let i = 0; i < 6; i++) {
        g.lineTo(-10 + i * 4, -5);
        g.lineTo(-8 + i * 4, 2);
      }
      g.stroke();
      circle(g, 0, 2, 2.6, '#4b4f58');
    },

    slingshot(g) {
      g.strokeStyle = '#8a5a28';
      g.lineWidth = 3.2;
      g.beginPath();
      g.moveTo(0, 14);
      g.lineTo(0, 2);
      g.moveTo(0, 2);
      g.lineTo(-8, -11);
      g.moveTo(0, 2);
      g.lineTo(8, -11);
      g.stroke();
      g.strokeStyle = '#2b2f3a';
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(-8, -11);
      g.quadraticCurveTo(0, -3, 8, -11);
      g.stroke();
      circle(g, 0, -5.5, 3.4, '#777777');
    },

    smokeBomb(g) {
      circle(g, 0, 6, 8, '#35383f');
      circle(g, -2.5, 3.5, 2, '#575b66');
      g.strokeStyle = '#c9a66b';
      g.lineWidth = 1.8;
      g.beginPath();
      g.moveTo(3, -1);
      g.quadraticCurveTo(7, -5, 5, -9);
      g.stroke();
      circle(g, 5, -10, 2.2, '#f2b134');
      g.globalAlpha = 0.75;
      circle(g, -9, -8, 4.5, '#9aa0ab');
      circle(g, -4, -12, 4, '#b5bac4');
      circle(g, 11, -3, 3.4, '#9aa0ab');
      g.globalAlpha = 1;
    },

    inkBomb(g) {
      g.fillStyle = '#16181d';
      rr(g, -8, -9, 16, 22, 2);
      g.fill();
      g.fillStyle = '#454a55';
      rr(g, -8, -9, 16, 5, 2);
      g.fill();
      g.fillStyle = '#ffffff';
      g.fillRect(-4, 1, 8, 5);
      g.fillStyle = '#16181d';
      g.beginPath();
      g.moveTo(11, 0);
      g.quadraticCurveTo(15, 6, 11, 9);
      g.quadraticCurveTo(7, 6, 11, 0);
      g.fill();
    }
  };

  // Draws an icon centered at (cx, cy), "size" pixels wide
  function draw(g, key, cx, cy, size) {
    const fn = DRAW[key];
    if (!fn) return;
    g.save();
    g.translate(cx, cy);
    g.scale(size / 32, size / 32);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.lineWidth = 2;
    fn(g);
    g.restore();
  }

  // A small canvas element with the icon on a light background (for menus)
  function canvas(key, px) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const c = document.createElement('canvas');
    c.width = px * dpr;
    c.height = px * dpr;
    c.style.width = px + 'px';
    c.style.height = px + 'px';
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    g.fillStyle = '#e9ecf2';
    rr(g, 0, 0, px, px, px * 0.22);
    g.fill();
    draw(g, key, px / 2, px / 2, px * 0.78);
    return c;
  }

  return { INFO, draw, canvas };
})();