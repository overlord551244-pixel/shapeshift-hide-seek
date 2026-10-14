const lobbyLib = require('./lobby');
const world = require('./world');

const BULLET_SPEED = 900;   // pixels per second
const BULLET_RANGE = 800;   // pixels before a bullet disappears
const HIT_RADIUS = 14;      // how close to an entity counts as a hit

let io = null;
function init(socketServer) { io = socketServer; }

// Seeker clicked to fire. "angle" is the direction in radians.
function shoot(socketId, angle) {
  const lobby = lobbyLib.getLobby(socketId);
  const r = lobby && lobby.round;
  const w = r && r.world;
  const p = w && w.players.get(socketId);
  if (!p || p.role !== 'seeker' || !p.spawned) return;
  if (r.phase !== 'hunt' || !r.seekers.has(socketId)) return;

  const a = Number(angle);
  if (!Number.isFinite(a)) return;

  const now = Date.now();
  if (now < p.frozenUntil) return;   // stunned
  const cooldown = lobby.settings.gunCooldown * 1000;
  if (now - (p.lastShot || 0) < cooldown) return;
  p.lastShot = now;

  w.bullets.push({
    id: ++w.bulletCounter,
    x: p.x + Math.cos(a) * 16,
    y: p.y + Math.sin(a) * 16,
    a,
    dist: 0,
    owner: socketId
  });
}

// Closest point on a bullet's path to an entity: returns how far along (t) and distance squared
function nearest(px, py, x, y, dx, dy) {
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - x) * dx + (py - y) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = x + dx * t;
  const cy = y + dy * t;
  return { t, d2: (px - cx) * (px - cx) + (py - cy) * (py - cy) };
}

function findHit(w, x, y, dx, dy) {
  const r = w.round;
  let best = null;

  function consider(kind, ref) {
    const n = nearest(ref.x, ref.y, x, y, dx, dy);
    if (n.d2 <= HIT_RADIUS * HIT_RADIUS && (!best || n.t < best.t)) {
      best = { t: n.t, kind, ref };
    }
  }

  for (const npc of w.npcs) consider('npc', npc);
  for (const p of w.players.values()) {
    if (p.role === 'hider' && r.hiders.has(p.sid)) consider('hider', p);
  }
  return best;
}

// Runs every game tick
function step(w, dt) {
  const round = require('./round');   // loaded here to avoid a circular require
  const r = w.round;
  const keep = [];

  for (const b of w.bullets) {
    const move = BULLET_SPEED * dt;
    const dx = Math.cos(b.a) * move;
    const dy = Math.sin(b.a) * move;

    // Did it hit a wall first? (walls arrive in Section 11)
    let wallT = null;
    const samples = Math.max(1, Math.ceil(move / 8));
    for (let i = 1; i <= samples; i++) {
      if (world.isBlocked(w.mapKey, b.x + (dx * i) / samples, b.y + (dy * i) / samples)) {
        wallT = i / samples;
        break;
      }
    }

    const hit = findHit(w, b.x, b.y, dx, dy);

    if (hit && (wallT === null || hit.t <= wallT)) {
      if (hit.kind === 'npc') {
        const i = w.npcs.indexOf(hit.ref);
        if (i >= 0) w.npcs.splice(i, 1);
        io.to(b.owner).emit('shotResult', { result: 'npc' });
        round.loseHeart(w.lobby, b.owner);
      } else {
        io.to(b.owner).emit('shotResult', { result: 'hider' });
        round.eliminateHider(w.lobby, hit.ref.sid);
      }
      if (w.lobby.round !== r) return;   // the round ended
      continue;                          // bullet is used up
    }

    if (wallT !== null) continue;        // hit a wall

    b.x += dx;
    b.y += dy;
    b.dist += move;
    if (b.dist < BULLET_RANGE) keep.push(b);
  }

  w.bullets = keep;
}

module.exports = { init, shoot, step, BULLET_SPEED };