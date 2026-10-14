// Draws every person and animal with simple shapes.
// Every sprite is drawn facing right; the caller flips it when needed.
const Sprites = (function () {
  const NAMED = [
    ['light pink', '#fbd0da'], ['light tan', '#d8bf94'], ['black', '#2b2b30'],
    ['white', '#f5f5f5'], ['gray', '#8e9099'], ['brown', '#8a5a35'],
    ['blue', '#4a86e8'], ['red', '#d94a45'], ['tan', '#cda877'],
    ['yellow', '#f2cf4a'], ['pink', '#f2a0b5']
  ];

  function baseColor(name) {
    const n = (name || '').toLowerCase();
    for (const pair of NAMED) if (n.indexOf(pair[0]) !== -1) return pair[1];
    return '#9a9a9a';
  }

  function parse(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  // Lighter (positive) or darker (negative). Only give it "#rrggbb" colors.
  function shade(hex, amt) {
    const c = parse(hex);
    const t = amt < 0 ? 0 : 255;
    const p = Math.abs(amt);
    return 'rgb(' + Math.round(c[0] + (t - c[0]) * p) + ',' +
      Math.round(c[1] + (t - c[1]) * p) + ',' + Math.round(c[2] + (t - c[2]) * p) + ')';
  }

  function dark(hex) {
    const c = parse(hex);
    return c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11 < 70;
  }

  // ----- tiny drawing helpers -----
  function ell(ctx, x, y, rx, ry, fill, rot) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
  }
  function circ(ctx, x, y, r, fill) { ell(ctx, x, y, r, r, fill, 0); }
  function poly(ctx, pts, fill) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }
  function stroke(ctx, x1, y1, x2, y2, color, w) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  function eye(ctx, x, y, c) { circ(ctx, x, y, 1, dark(c) ? '#ffffff' : '#111111'); }

  function legs4(ctx, xs, y0, len, sw, color, w) {
    for (let i = 0; i < xs.length; i++) {
      const s = i % 2 === 0 ? sw : -sw;
      stroke(ctx, xs[i], y0, xs[i] + s * 3, y0 + len, color, w);
    }
  }

  // ----- animals (name = color name, sw = walking swing from -1 to 1) -----
  function bird(ctx, name, sw) {
    const c = baseColor(name);
    stroke(ctx, -1, 4, -1 + sw * 2, 8, '#d98a2b', 1.3);
    stroke(ctx, 2, 4, 2 - sw * 2, 8, '#d98a2b', 1.3);
    poly(ctx, [[-6, -1], [-13, -4], [-11, 1.5]], shade(c, -0.25));
    ell(ctx, 0, 0, 7.5, 5, c);
    ell(ctx, -1, 0.5, 4.8, 3, shade(c, -0.2), -0.3);
    circ(ctx, 6, -4, 3.7, c);
    poly(ctx, [[9, -5], [13, -3.8], [9, -2.8]], '#f0a030');
    eye(ctx, 7.3, -4.9, c);
  }

  function rat(ctx, name, sw) {
    const c = baseColor(name);
    ctx.beginPath();
    ctx.moveTo(-8, 1);
    ctx.quadraticCurveTo(-14, 4, -17, -2);
    ctx.strokeStyle = '#e8a4a4';
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.stroke();
    stroke(ctx, -4, 3, -4 + sw * 2.4, 6.5, shade(c, -0.3), 1.8);
    stroke(ctx, 4, 3, 4 - sw * 2.4, 6.5, shade(c, -0.3), 1.8);
    ell(ctx, 0, 0, 8.5, 4.6, c);
    ell(ctx, 8, 0.5, 4.6, 3.2, c);
    circ(ctx, 6.2, -3, 2.2, '#e8a4a4');
    circ(ctx, 12.3, 1, 1.1, '#d9798c');
    eye(ctx, 9.4, -0.7, c);
  }

  function squirrel(ctx, name, sw) {
    const c = baseColor(name);
    ell(ctx, -8, -7, 4.6, 9, shade(c, -0.08), 0.45);
    ell(ctx, -8, -7, 2.4, 6.5, shade(c, 0.18), 0.45);
    stroke(ctx, -3, 4, -3 + sw * 2.4, 6.5, shade(c, -0.3), 2);
    stroke(ctx, 3, 4, 3 - sw * 2.4, 6.5, shade(c, -0.3), 2);
    ell(ctx, 0, 0, 7.5, 5, c);
    ell(ctx, 1, 2, 4, 2.6, shade(c, 0.35));
    circ(ctx, 7, -3.5, 3.9, c);
    poly(ctx, [[5.5, -6], [6.5, -10], [8.4, -6.3]], c);
    circ(ctx, 10.4, -3, 1, '#222222');
    eye(ctx, 8.2, -4.4, c);
  }

  function chicken(ctx, name, sw) {
    const c = baseColor(name);
    stroke(ctx, -1, 6, -1 + sw * 3, 11, '#e0a030', 1.6);
    stroke(ctx, 3, 6, 3 - sw * 3, 11, '#e0a030', 1.6);
    poly(ctx, [[-8, -2], [-15, -10], [-11, 1]], shade(c, -0.22));
    ell(ctx, 0, 0, 9.5, 7, c);
    ell(ctx, -1, 1, 5.5, 3.8, shade(c, -0.15), -0.25);
    circ(ctx, 8, -8, 4.2, c);
    circ(ctx, 7.6, -12.6, 2, '#d63a3a');
    circ(ctx, 10, -12, 1.6, '#d63a3a');
    poly(ctx, [[11.5, -9], [15.5, -7.8], [11.5, -6.6]], '#f0a030');
    ell(ctx, 11, -5.3, 1.2, 2, '#d63a3a');
    eye(ctx, 9.2, -8.8, c);
  }

  function pig(ctx, name, sw) {
    const c = baseColor(name);
    legs4(ctx, [-9, -4, 5, 10], 6, 5, sw, shade(c, -0.25), 3);
    ctx.beginPath();
    ctx.arc(-15, -2, 2.4, 0, Math.PI * 1.7);
    ctx.strokeStyle = shade(c, -0.2);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ell(ctx, 0, 0, 14.5, 8.8, c);
    ell(ctx, 13, 0.5, 7, 6.4, c);
    poly(ctx, [[9.5, -5], [12.5, -11], [15.5, -5.5]], shade(c, -0.14));
    ell(ctx, 19.2, 1.8, 3.6, 3.1, shade(c, -0.14));
    circ(ctx, 18.4, 1.6, 0.8, '#7a3d4c');
    circ(ctx, 20.4, 1.6, 0.8, '#7a3d4c');
    eye(ctx, 14.5, -2.4, c);
  }

  function sheep(ctx, name, sw) {
    const c = baseColor(name);
    const head = dark(c) ? '#6a6a70' : shade(c, -0.62);
    legs4(ctx, [-8, -3, 5, 10], 6, 6, sw, dark(c) ? '#6a6a70' : '#3a3a3f', 2.4);
    const blobs = [[-9, -3, 6], [9, -4, 6], [0, -7, 6.5], [-5, 3, 6.5], [6, 3, 6.5], [-1, 0, 8]];
    for (const p of blobs) circ(ctx, p[0], p[1], p[2], shade(c, -0.12));
    for (const p of blobs) circ(ctx, p[0] + 0.3, p[1] - 0.3, p[2] - 1.3, c);
    ell(ctx, 13.5, -1, 4.2, 4.8, head);
    ell(ctx, 10.5, -4.5, 3.2, 1.6, head, -0.5);
    circ(ctx, 15, -2.4, 0.9, '#ffffff');
  }

  function cow(ctx, name, sw) {
    const split = (name || '').toLowerCase().indexOf('black and white') !== -1;
    const c = split ? '#f5f5f5' : baseColor(name);
    legs4(ctx, [-11, -6, 7, 12], 6, 6, sw, split ? '#2b2b30' : shade(c, -0.3), 3);
    stroke(ctx, -15, -3, -18, 6, shade(c, -0.25), 2);
    ell(ctx, 0, 0, 16.5, 9.5, c);
    if (split) {
      ell(ctx, -6, -3, 5.5, 4.2, '#222222', 0.3);
      ell(ctx, 5, 2, 4.8, 4, '#222222', -0.3);
      ell(ctx, -1, 6, 3.2, 2.4, '#222222');
    }
    ell(ctx, -2, 8, 3.2, 2, '#f2b8b8');
    ell(ctx, 16.5, -2, 6.2, 5.5, c);
    ell(ctx, 13, -5.5, 3.2, 1.7, split ? '#222222' : shade(c, -0.15), -0.5);
    ell(ctx, 20.5, 0, 3.4, 3.1, '#f2b8b8');
    poly(ctx, [[14, -7], [13, -11], [16, -7.5]], '#e8e0c8');
    eye(ctx, 17.5, -3.6, c);
  }

  function horse(ctx, name, sw) {
    const c = baseColor(name);
    const mane = shade(c, -0.42);
    legs4(ctx, [-12, -8, 9, 13], 6, 9, sw, shade(c, -0.22), 2.8);
    poly(ctx, [[-16, -4], [-25, 8], [-21, 9], [-15, 1]], mane);
    ell(ctx, 0, 0, 17.5, 8.8, c);
    poly(ctx, [[10, -5], [15, -17], [21, -15], [17, -2]], c);
    poly(ctx, [[15, -17], [20, -21], [29, -14.5], [27, -11], [20, -12.5]], c);
    poly(ctx, [[10, -6], [14, -19.5], [17, -18.5], [13, -4]], mane);
    poly(ctx, [[19, -20], [20.5, -24], [22, -20]], c);
    eye(ctx, 23, -17, c);
    circ(ctx, 28, -13.5, 0.9, shade(c, -0.4));
  }

  function goat(ctx, name, sw) {
    const c = baseColor(name);
    legs4(ctx, [-7, -3, 5, 9], 5, 6, sw, shade(c, -0.28), 2.2);
    poly(ctx, [[-10, -3], [-13, -9], [-8, -5]], c);
    ell(ctx, 0, 0, 11, 7, c);
    poly(ctx, [[7, -3], [10, -9], [13, -3]], c);
    ell(ctx, 12.5, -6.5, 4, 3.6, c);
    ell(ctx, 16, -5.5, 2.7, 2.2, shade(c, -0.12));
    poly(ctx, [[14, -3.5], [15.5, 3], [12, -2]], shade(c, -0.2));
    stroke(ctx, 11, -9, 7.5, -15, '#d8d0b8', 2);
    stroke(ctx, 12.5, -9, 9.5, -14, '#d8d0b8', 2);
    ell(ctx, 9.5, -6.5, 3, 1.4, shade(c, -0.12), 0.5);
    eye(ctx, 13.8, -7.3, c);
  }

  // ----- people -----
  const OUTFITS = {
    'black suit':      { top: '#1c1c22', legs: '#1c1c22', tie: '#c0392b' },
    'green t-shirt':   { top: '#43a85c', legs: '#3b5a8c', bare: true },
    'pink dress':      { top: '#f48fb1', dress: true, bare: true },
    'blue jacket':     { top: '#3d6fd6', legs: '#2b2f3a' },
    'red hoodie':      { top: '#d9433f', legs: '#3a3a44', hood: true },
    'gray coat':       { top: '#8c8f98', legs: '#3a3a44', long: true },
    'yellow sundress': { top: '#f6cf4a', dress: true, bare: true },
    'purple sweater':  { top: '#8e5bc7', legs: '#2f3547' }
  };
  const SEEKER_OUTFIT = { top: '#7b1f24', legs: '#26262c', hat: true };
  const SKINS = ['#f2c9a0', '#e0a878', '#c68642', '#8d5524', '#f5d5b8'];
  const HAIRS = ['#2b1d12', '#5a3a1e', '#c9a05a', '#1a1a1a', '#8a3b1e', '#b8b8b8'];

  function human(ctx, name, sw, id, outfit) {
    const o = outfit || OUTFITS[(name || '').toLowerCase()] || { top: '#6b7bd6', legs: '#2f3547' };
    const skin = SKINS[id % SKINS.length];
    const hair = HAIRS[Math.floor(id / 7) % HAIRS.length];
    const style = Math.floor(id / 53) % 3;
    const swing = sw * 3.2;

    // legs
    if (o.dress) {
      stroke(ctx, -2.4, 9, -2.4 + swing, 15, skin, 3);
      stroke(ctx, 2.4, 9, 2.4 - swing, 15, skin, 3);
    } else {
      stroke(ctx, -2.6, 4, -2.6 + swing, 15, o.legs, 4.4);
      stroke(ctx, 2.6, 4, 2.6 - swing, 15, o.legs, 4.4);
    }
    // arms
    const armColor = o.bare ? skin : o.top;
    stroke(ctx, -7.6, -6.5, -7.6 - swing * 0.5, 3, armColor, 3.4);
    stroke(ctx, 7.6, -6.5, 7.6 + swing * 0.5, 3, armColor, 3.4);
    circ(ctx, -7.6 - swing * 0.5, 3.4, 1.9, skin);
    circ(ctx, 7.6 + swing * 0.5, 3.4, 1.9, skin);
    // body
    if (o.dress) poly(ctx, [[-6, -8], [6, -8], [5.5, 0], [9.5, 10], [-9.5, 10], [-5.5, 0]], o.top);
    else if (o.long) poly(ctx, [[-6.5, -8], [6.5, -8], [7.5, 10], [-7.5, 10]], o.top);
    else poly(ctx, [[-6.5, -8], [6.5, -8], [6, 4.5], [-6, 4.5]], o.top);
    if (o.tie) poly(ctx, [[0, -8], [1.6, -6], [0.8, 0], [-0.8, 0], [-1.6, -6]], o.tie);
    // head and hair
    if (o.hood) circ(ctx, 0, -11.5, 7.2, shade(o.top, -0.18));
    if (style === 1 && !o.hood) poly(ctx, [[-5.6, -14], [5.6, -14], [5.9, -5.5], [-5.9, -5.5]], hair);
    circ(ctx, 0, -13, 5.2, skin);
    if (!o.hood) {
      ctx.beginPath();
      ctx.arc(0, -13, 5.5, Math.PI, 0);
      ctx.closePath();
      ctx.fillStyle = hair;
      ctx.fill();
      if (style === 2) circ(ctx, 0, -19.5, 2.6, hair);
    }
    circ(ctx, -2, -12.6, 0.8, '#222222');
    circ(ctx, 2, -12.6, 0.8, '#222222');
    if (o.hat) {
      ell(ctx, 0, -17.6, 8, 2.2, '#3b2a1a');
      poly(ctx, [[-4.6, -17.8], [4.6, -17.8], [4, -23.5], [-4, -23.5]], '#3b2a1a');
      stroke(ctx, -4.4, -19.2, 4.4, -19.2, '#a82a2a', 1.6);
    }
  }

  // ----- sizes: top = height above center, ground = distance down to the feet, w = half width -----
  const DIMS = {
    human:    { top: 25, ground: 16, w: 10 },
    seeker:   { top: 25, ground: 16, w: 10 },
    bird:     { top: 10, ground: 8,  w: 8 },
    rat:      { top: 6,  ground: 7,  w: 10 },
    squirrel: { top: 15, ground: 7,  w: 9 },
    chicken:  { top: 14, ground: 11, w: 10 },
    pig:      { top: 10, ground: 11, w: 15 },
    sheep:    { top: 14, ground: 12, w: 14 },
    cow:      { top: 11, ground: 12, w: 17 },
    horse:    { top: 24, ground: 15, w: 20 },
    goat:     { top: 16, ground: 11, w: 12 },
    unknown:  { top: 14, ground: 10, w: 10 }
  };

  const DRAWERS = { bird, rat, squirrel, chicken, pig, sheep, cow, horse, goat };

  function dims(entity) { return DIMS[entity] || DIMS.unknown; }

  function begin(ctx, x, y, d, moving, ph, f, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = alpha;
    ell(ctx, 0, d.ground - 1, d.w + 2, 3.2, 'rgba(0,0,0,0.22)');
    ctx.translate(0, -(moving ? Math.abs(Math.cos(ph)) * 1.3 : 0));
    if (f < 0) ctx.scale(-1, 1);
  }

  // A hider or an NPC (they are drawn exactly the same way)
  function draw(ctx, entity, colorName, id, x, y, f, moving, ph) {
    const d = dims(entity);
    const sw = moving ? Math.sin(ph) : 0;
    begin(ctx, x, y, d, moving, ph, f, 1);
    if (entity === 'human') {
      human(ctx, colorName, sw, id);
    } else if (DRAWERS[entity]) {
      DRAWERS[entity](ctx, colorName, sw, id);
    } else {
      circ(ctx, 0, 0, 10, '#9a9a9a');
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('?', 0, 4);
    }
    ctx.restore();
  }

  // The seeker: a ranger with a gun. "aim" is an angle, or null to point the way they face.
  function drawSeeker(ctx, x, y, f, moving, ph, aim, ghost) {
    const d = DIMS.seeker;
    const sw = moving ? Math.sin(ph) : 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = ghost ? 0.4 : 1;
    ell(ctx, 0, d.ground - 1, d.w + 2, 3.2, 'rgba(0,0,0,0.22)');
    ctx.translate(0, -(moving ? Math.abs(Math.cos(ph)) * 1.3 : 0));

    ctx.save();
    if (f < 0) ctx.scale(-1, 1);
    human(ctx, '', sw, 7, SEEKER_OUTFIT);
    ctx.restore();

    const ang = (aim === null || aim === undefined) ? (f < 0 ? Math.PI : 0) : aim;
    ctx.save();
    ctx.translate(0, -2);
    ctx.rotate(ang);
    if (Math.abs(ang) > Math.PI / 2) ctx.scale(1, -1);
    ctx.fillStyle = '#2b2b2f';
    ctx.fillRect(4, -1.6, 15, 3.2);
    ctx.fillRect(4, 0.5, 4, 5);
    ctx.restore();

    ctx.restore();
  }

  return { draw, drawSeeker, dims };
})();