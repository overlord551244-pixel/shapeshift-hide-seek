const { MAPS, SEEKER_ITEMS } = require('./config');
const world = require('./world');
const lobbyLib = require('./lobby');
const combat = require('./combat');
const items = require('./items');

const TICK_RATE = 30;   // simulation steps per second
const SEND_RATE = 15;   // snapshots sent to players per second

let io = null;
let loopTimer = null;
const worlds = new Set();

function init(socketServer) {
  io = socketServer;
  combat.init(socketServer);
  items.init(socketServer);
  if (!loopTimer) loopTimer = setInterval(loop, 1000 / TICK_RATE);
}

function rand(min, max) { return min + Math.random() * (max - min); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// Random ids so nobody can tell players from NPCs by their id
function newId(w) {
  let id;
  do { id = 1 + Math.floor(Math.random() * 1000000); } while (w.usedIds.has(id));
  w.usedIds.add(id);
  return id;
}

// Which entity an NPC is. Humans get a bigger share on maps that have them.
function pickEntityKey(mapDef) {
  const keys = Object.keys(mapDef.entities);
  if (keys.length === 1) return keys[0];
  if (keys.includes('human')) {
    const share = mapDef.humanHeavy ? 0.65 : 0.4;
    if (Math.random() < share) return 'human';
    return pick(keys.filter((k) => k !== 'human'));
  }
  return pick(keys);
}

// ---------- Creating the world ----------

function createWorld(lobby) {
  const r = lobby.round;
  const mapDef = MAPS[lobby.map];
  const w = {
    lobby, round: r, mapKey: lobby.map,
    usedIds: new Set(), npcs: [], players: new Map(),
    bullets: [], bulletCounter: 0,
    radars: [], traps: [], cans: [], rocks: [], smokes: [], idc: 0,
    last: Date.now(), sendAcc: 0
  };

  const count = world.npcCount(w.mapKey, mapDef);
  for (let i = 0; i < count; i++) {
    const key = pickEntityKey(mapDef);
    const pos = world.randomSpawn(w.mapKey);
    w.npcs.push({
      id: newId(w), x: pos.x, y: pos.y, tx: pos.x, ty: pos.y,
      entity: key, color: pick(mapDef.entities[key].colors),
      pause: rand(0, 3), fx: 1
    });
  }

  for (const sid of r.hiders) addPlayer(w, sid, 'hider');
  for (const sid of r.seekers) addPlayer(w, sid, 'seeker');

  r.world = w;
  worlds.add(w);

  const size = world.getSize(w.mapKey);
  io.to(lobby.code).emit('worldInfo', {
    width: size.width, height: size.height, map: w.mapKey,
    bulletSpeed: combat.BULLET_SPEED,
    rockSpeed: items.T.slingSpeed,
    mapData: world.clientData(w.mapKey)
  });
}

function addPlayer(w, sid, role) {
  const pos = role === 'hider' ? world.randomSpawn(w.mapKey) : { x: 0, y: 0 };
  w.players.set(sid, {
    id: newId(w), sid, role,
    x: pos.x, y: pos.y, fx: 1,
    spawned: role === 'hider',           // seekers appear when prep ends
    input: { up: false, down: false, left: false, right: false, sprint: false },
    frozenUntil: 0,                      // stun and beartrap use this
    lastShot: 0,
    itemState: {}
  });
}

// Called when the prep time is over
function spawnSeekers(lobby) {
  const w = lobby.round && lobby.round.world;
  if (!w) return;
  for (const p of w.players.values()) {
    if (p.role !== 'seeker') continue;
    const pos = world.seekerSpawn(w.mapKey);
    p.x = pos.x;
    p.y = pos.y;
    p.spawned = true;
  }
}

function setInput(socketId, input) {
  const lobby = lobbyLib.getLobby(socketId);
  const w = lobby && lobby.round && lobby.round.world;
  const p = w && w.players.get(socketId);
  if (!p || !input || typeof input !== 'object') return;
  p.input = {
    up: !!input.up, down: !!input.down,
    left: !!input.left, right: !!input.right,
    sprint: !!input.sprint
  };
}

// ---------- Movement ----------

// Moves in small steps so fast movement can't jump through a thin wall.
// "blocked" decides which places can't be entered.
function moveEntity(mapKey, e, dx, dy, blocked) {
  const dist = Math.hypot(dx, dy);
  const n = Math.max(1, Math.ceil(dist / 6));
  const sx = dx / n;
  const sy = dy / n;
  for (let i = 0; i < n; i++) {
    const a = world.clamp(mapKey, e.x + sx, e.y);
    if (!blocked(mapKey, a.x, a.y)) e.x = a.x;
    const b = world.clamp(mapKey, e.x, e.y + sy);
    if (!blocked(mapKey, b.x, b.y)) e.y = b.y;
  }
}

// Hiders walk at baseSpeed (same as every NPC). Seekers are faster.
function speedFor(w, p) {
  const s = w.lobby.settings;
  let speed = s.baseSpeed;
  if (p.role === 'seeker') {
    speed *= s.seekerSpeedMultiplier;
    const list = w.round.items.get(p.sid) || [];
    if (list.includes('runningShoes')) speed *= SEEKER_ITEMS.runningShoes.speedBonus;
  }
  if (p.input.sprint) speed *= s.sprintMultiplier;   // sprint is relative to own walk speed
  speed *= world.speedZone(w.mapKey, p.x, p.y, s);   // slower inside corn
  return speed;
}

function stepPlayer(w, p, dt, now) {
  const r = w.round;
  if (!p.spawned) return;
  if (p.role === 'hider' && !r.hiders.has(p.sid)) return;
  if (p.role === 'seeker' && !r.seekers.has(p.sid)) return;
  if (now < p.frozenUntil) return;

  let ix = (p.input.right ? 1 : 0) - (p.input.left ? 1 : 0);
  let iy = (p.input.down ? 1 : 0) - (p.input.up ? 1 : 0);
  if (!ix && !iy) return;

  const len = Math.hypot(ix, iy);   // keeps diagonal movement from being faster
  ix /= len;
  iy /= len;
  const speed = speedFor(w, p);
  moveEntity(w.mapKey, p, ix * speed * dt, iy * speed * dt, world.isBlocked);
  if (ix) p.fx = ix > 0 ? 1 : -1;
}

// ---------- NPCs ----------

// True if an NPC can walk from one point to the other without hitting anything
function lineClear(w, x0, y0, x1, y1) {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(1, Math.ceil(dist / 8));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    if (world.npcBlocked(w.mapKey, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
  }
  return true;
}

// Picks somewhere to walk that is in a straight clear line. Returns false if it found nothing.
function pickTarget(w, n) {
  for (let i = 0; i < 16; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = rand(70, 420);
    const t = world.clamp(w.mapKey, n.x + Math.cos(angle) * dist, n.y + Math.sin(angle) * dist);
    if (Math.hypot(t.x - n.x, t.y - n.y) < 50) continue;
    if (lineClear(w, n.x, n.y, t.x, t.y)) {
      n.tx = t.x;
      n.ty = t.y;
      return true;
    }
  }
  n.tx = n.x;
  n.ty = n.y;
  return false;
}

function stepNpc(w, n, dt) {
  // Standing still for a moment
  if (n.pause > 0) {
    n.pause -= dt;
    if (n.pause <= 0 && !pickTarget(w, n)) n.pause = rand(0.2, 0.6);   // nowhere to go yet, so wait a bit
    return;
  }
  // Randomly stop in their tracks mid-walk
  if (Math.random() < dt * 0.15) {
    n.pause = rand(0.4, 2);
    return;
  }

  const dx = n.tx - n.x;
  const dy = n.ty - n.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 6) {
    n.pause = rand(0.5, 4);
    return;
  }

  const speed = w.lobby.settings.baseSpeed;   // same speed as a walking hider
  const step = Math.min(dist, speed * dt);
  const ox = n.x;
  const oy = n.y;
  moveEntity(w.mapKey, n, (dx / dist) * step, (dy / dist) * step, world.npcBlocked);
  if (Math.abs(dx) > 1) n.fx = dx > 0 ? 1 : -1;
  if (n.x === ox && n.y === oy) n.pause = rand(0.1, 0.4);   // bumped into something, so pick a new way
}

// ---------- Main loop ----------

function loop() {
  const now = Date.now();
  for (const w of worlds) {
    if (w.lobby.round !== w.round || w.lobby.players.size === 0) {
      worlds.delete(w);   // round ended or lobby gone
      continue;
    }
    const dt = Math.min(0.1, (now - w.last) / 1000);
    w.last = now;

    for (const p of w.players.values()) stepPlayer(w, p, dt, now);
    for (const n of w.npcs) stepNpc(w, n, dt);
    items.step(w, dt, now);
    combat.step(w, dt);

    if (w.lobby.round !== w.round) {   // a shot may have ended the round
      worlds.delete(w);
      continue;
    }

    w.sendAcc += dt;
    if (w.sendAcc >= 1 / SEND_RATE) {
      w.sendAcc = 0;
      sendState(w, now);
    }
  }
}

function byId(a, b) { return a.id - b.id; }

function sendState(w, now) {
  const r = w.round;

  // Everything is sorted by id so the list order can't give players away
  const forSeekers = [];   // what seekers see
  const forHiders = [];    // hiders also see who is holding a slingshot

  for (const n of w.npcs) {
    const o = { id: n.id, x: Math.round(n.x), y: Math.round(n.y), e: n.entity, c: n.color, f: n.fx };
    forSeekers.push(o);
    forHiders.push(o);
  }
  for (const p of w.players.values()) {
    if (p.role !== 'hider' || !r.hiders.has(p.sid)) continue;
    const ch = r.choices.get(p.sid) || {};
    const o = { id: p.id, x: Math.round(p.x), y: Math.round(p.y), e: ch.entity || null, c: ch.color || null, f: p.fx };
    forSeekers.push(o);
    forHiders.push(items.holdingSling(p) ? Object.assign({}, o, { sl: 1 }) : o);
  }
  forSeekers.sort(byId);
  forHiders.sort(byId);

  const seekersAll = [];
  for (const p of w.players.values()) {
    if (p.role !== 'seeker' || !p.spawned || !r.seekers.has(p.sid)) continue;
    const o = { id: p.id, x: Math.round(p.x), y: Math.round(p.y), f: p.fx };
    if (items.cloaked(p, now)) o.g = 1;   // ghost: invisible to hiders
    seekersAll.push(o);
  }
  const seekersVisibleToHiders = seekersAll.filter((s) => !s.g);

  const bullets = w.bullets.map((b) => ({
    id: b.id, x: Math.round(b.x), y: Math.round(b.y), a: Math.round(b.a * 100) / 100
  }));

  // While the alarm rings, every living hider is shown to the seeker
  const ringing = !!(r.alarm && r.alarm.until > now);
  let pings = null;
  if (ringing) {
    pings = [];
    for (const p of w.players.values()) {
      if (p.role === 'hider' && p.spawned && r.hiders.has(p.sid)) {
        pings.push({ id: p.id, x: Math.round(p.x), y: Math.round(p.y) });
      }
    }
    pings.sort(byId);
  }

  for (const [sid, p] of w.players) {
    if (!w.lobby.players.has(sid)) continue;
    const isSeeker = p.role === 'seeker';
    const alive = isSeeker ? r.seekers.has(sid) : r.hiders.has(sid);

    const msg = {
      entities: isSeeker ? forSeekers : forHiders,
      seekers: isSeeker ? seekersAll : seekersVisibleToHiders,
      bullets,
      youId: p.id, role: p.role, phase: r.phase, alive
    };

    // Only the seeker gets their own hearts and gun reload
    if (isSeeker) {
      const total = w.lobby.settings.gunCooldown;
      msg.hearts = r.hearts.get(sid);
      msg.cooldown = {
        total,
        left: Math.max(0, ((p.lastShot || 0) + total * 1000 - now) / 1000)
      };
    }

    if (ringing) {
      msg.alarm = {
        left: Math.round((r.alarm.until - now) / 100) / 10,
        total: w.lobby.settings.alarmDuration
      };
      if (isSeeker) msg.pings = pings;
    }

    Object.assign(msg, items.extras(w, p, now));
    io.to(sid).emit('state', msg);
  }
}

module.exports = {
  init, createWorld, spawnSeekers, setInput,
  shoot: combat.shoot,
  useItem: items.useItem,
  sling: items.sling
};