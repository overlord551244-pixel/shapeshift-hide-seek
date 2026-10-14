const lobbyLib = require('./lobby');
const world = require('./world');
const { SEEKER_ITEMS, HIDER_ITEMS } = require('./config');

// Extra numbers for the items (the main ones live in config.js)
const T = {
  radarRadius: 396,     // 80% bigger than before (was 220)
  trapRadius: 18,
  slingRange: 450,
  slingSpeed: 520,
  slingHit: 16,
  smokeRadius: 234,     // 80% bigger than before (was 130)
  inkRadius: 18,
  inkPlaceCooldown: 2
};

let io = null;
function init(socketServer) { io = socketServer; }

function cfgFor(key) { return SEEKER_ITEMS[key] || HIDER_ITEMS[key] || {}; }

function stateOf(p, key) {
  if (!p.itemState) p.itemState = {};
  if (!p.itemState[key]) p.itemState[key] = { readyAt: 0, activeUntil: 0, holding: false };
  return p.itemState[key];
}

function isAlive(r, p) {
  return p.role === 'seeker' ? r.seekers.has(p.sid) : r.hiders.has(p.sid);
}

function cloaked(p, now) {
  return p.role === 'seeker' && stateOf(p, 'invisibilityCloak').activeUntil > now;
}

function holdingSling(p) {
  return p.role === 'hider' && !!(p.itemState && p.itemState.slingshot && p.itemState.slingshot.holding);
}

// Keeps at most "max" things per owner. The oldest one despawns first.
function limitOwned(list, owner, max) {
  const mine = list.filter((o) => o.owner === owner);
  while (mine.length >= max) {
    const oldest = mine.shift();
    list.splice(list.indexOf(oldest), 1);
  }
}

// ---------- Using items ----------

function useItem(socketId, index) {
  const lobby = lobbyLib.getLobby(socketId);
  const r = lobby && lobby.round;
  const w = r && r.world;
  const p = w && w.players.get(socketId);
  if (!p || r.phase !== 'hunt' || !p.spawned || !isAlive(r, p)) return;
  if (!Number.isInteger(index)) return;

  const now = Date.now();
  if (p.role === 'seeker' && now < p.frozenUntil) return;   // stunned seekers can't do anything

  const key = (r.items.get(socketId) || [])[index];
  if (!key) return;
  const st = stateOf(p, key);
  const cfg = cfgFor(key);

  switch (key) {
    case 'radarScanner': {
      if (now < st.readyAt) return;
      st.readyAt = now + cfg.cooldown * 1000;
      w.radars.push({
        id: ++w.idc, x: p.x, y: p.y, owner: socketId,
        expiresAt: now + cfg.duration * 1000, total: cfg.duration * 1000, hit: false
      });
      return;
    }
    case 'invisibilityCloak': {
      if (now < st.readyAt) return;
      st.activeUntil = now + cfg.duration * 1000;
      st.readyAt = st.activeUntil + cfg.cooldown * 1000;   // cooldown starts after the 12s
      return;
    }
    case 'compass': {
      if (now < st.readyAt) return;
      st.activeUntil = now + cfg.duration * 1000;
      st.readyAt = now + cfg.cooldown * 1000;
      return;
    }
    case 'beartrap': {
      if (now < st.readyAt) return;
      st.readyAt = now + cfg.cooldown * 1000;
      limitOwned(w.traps, socketId, cfg.maxPlaced);
      w.traps.push({ id: ++w.idc, x: p.x, y: p.y, owner: socketId, victim: null, releaseAt: 0 });
      return;
    }
    case 'slingshot': {
      st.holding = !st.holding;   // pressing the key picks it up or puts it away
      return;
    }
    case 'smokeBomb': {
      if (now < st.readyAt) return;
      st.readyAt = now + cfg.cooldown * 1000;
      st.activeUntil = now + cfg.duration * 1000;
      w.smokes.push({ id: ++w.idc, x: p.x, y: p.y, r: T.smokeRadius, born: now, endAt: st.activeUntil });
      return;
    }
    case 'inkBomb': {
      if (now < st.readyAt) return;
      st.readyAt = now + T.inkPlaceCooldown * 1000;
      limitOwned(w.cans, socketId, cfg.maxPlaced);
      w.cans.push({ id: ++w.idc, x: p.x, y: p.y, owner: socketId });
      return;
    }
    default:
      return;   // passive items do nothing when clicked
  }
}

// Hider fires the slingshot (left-click while holding it)
function sling(socketId, angle) {
  const lobby = lobbyLib.getLobby(socketId);
  const r = lobby && lobby.round;
  const w = r && r.world;
  const p = w && w.players.get(socketId);
  if (!p || p.role !== 'hider' || r.phase !== 'hunt' || !p.spawned || !r.hiders.has(socketId)) return;

  const a = Number(angle);
  if (!Number.isFinite(a)) return;
  if (!(r.items.get(socketId) || []).includes('slingshot')) return;

  const st = stateOf(p, 'slingshot');
  const now = Date.now();
  if (!st.holding || now < st.readyAt) return;

  st.readyAt = now + HIDER_ITEMS.slingshot.cooldown * 1000;
  w.rocks.push({ id: ++w.idc, x: p.x, y: p.y, a, dist: 0, owner: socketId });
}

// ---------- Runs every game tick ----------

function step(w, dt, now) {
  const r = w.round;
  const aliveHiders = [];
  const aliveSeekers = [];
  for (const p of w.players.values()) {
    if (!p.spawned) continue;
    if (p.role === 'hider' && r.hiders.has(p.sid)) aliveHiders.push(p);
    if (p.role === 'seeker' && r.seekers.has(p.sid)) aliveSeekers.push(p);
  }

  // Radar scanners: expire, and check if a real hider is inside
  w.radars = w.radars.filter((rd) => now < rd.expiresAt);
  for (const rd of w.radars) {
    rd.hit = aliveHiders.some((h) => Math.hypot(h.x - rd.x, h.y - rd.y) <= T.radarRadius);
  }

  // Beartraps: only real players get stuck, NPCs never do
  const keepTraps = [];
  for (const t of w.traps) {
    if (t.victim) {
      if (now >= t.releaseAt) continue;   // released, so the trap is used up
      keepTraps.push(t);
      continue;
    }
    for (const h of aliveHiders) {
      if (now < h.frozenUntil) continue;
      if (Math.hypot(h.x - t.x, h.y - t.y) <= T.trapRadius) {
        const stuck = SEEKER_ITEMS.beartrap.stuckTime;
        t.victim = h.sid;
        t.releaseAt = now + stuck * 1000;
        h.frozenUntil = t.releaseAt;
        io.to(h.sid).emit('trapped', { seconds: stuck });
        break;
      }
    }
    keepTraps.push(t);
  }
  w.traps = keepTraps;

  // Rocks from slingshots
  const stun = HIDER_ITEMS.slingshot.stunTime;
  const keepRocks = [];
  for (const k of w.rocks) {
    const move = T.slingSpeed * dt;
    const nx = k.x + Math.cos(k.a) * move;
    const ny = k.y + Math.sin(k.a) * move;
    if (world.isBlocked(w.mapKey, nx, ny)) continue;

    let hit = null;
    for (const s of aliveSeekers) {
      if (Math.hypot(s.x - nx, s.y - ny) <= T.slingHit) { hit = s; break; }
    }
    if (hit) {
      hit.frozenUntil = Math.max(hit.frozenUntil, now + stun * 1000);
      io.to(hit.sid).emit('stunned', { seconds: stun });
      io.to(k.owner).emit('rockHit');
      continue;
    }
    k.x = nx;
    k.y = ny;
    k.dist += move;
    if (k.dist < T.slingRange) keepRocks.push(k);
  }
  w.rocks = keepRocks;

  // Smoke clouds expire
  w.smokes = w.smokes.filter((s) => now < s.endAt);

  // Ink cans: a seeker walking over one gets inked
  w.cans = w.cans.filter((c) => {
    for (const s of aliveSeekers) {
      if (Math.hypot(s.x - c.x, s.y - c.y) <= T.inkRadius) {
        io.to(s.sid).emit('inked', { seconds: HIDER_ITEMS.inkBomb.screenInkTime });
        return false;
      }
    }
    return true;
  });
}

// ---------- What each player is allowed to see ----------

function r1(x) { return Math.round(x * 10) / 10; }

function hotbar(w, p, now) {
  const list = w.round.items.get(p.sid) || [];
  return list.map((key) => {
    const cfg = cfgFor(key);
    const st = stateOf(p, key);
    return {
      key,
      type: cfg.type,
      cdLeft: r1(Math.max(0, (st.readyAt - now) / 1000)),
      cdTotal: key === 'inkBomb' ? T.inkPlaceCooldown : (cfg.cooldown || 0),
      activeLeft: r1(Math.max(0, (st.activeUntil - now) / 1000)),
      activeTotal: cfg.duration || 0,
      holding: key === 'slingshot' && st.holding
    };
  });
}

function extras(w, p, now) {
  const r = w.round;
  const out = {
    rocks: w.rocks.map((k) => ({ id: k.id, x: Math.round(k.x), y: Math.round(k.y), a: Math.round(k.a * 100) / 100 })),
    smokes: w.smokes.map((s) => ({
      id: s.id, x: Math.round(s.x), y: Math.round(s.y), r: s.r,
      age: (now - s.born) / 1000, life: (s.endAt - s.born) / 1000
    })),
    hotbar: hotbar(w, p, now)
  };

  if (p.role === 'seeker') {
    // Seekers see radars (their own), beartraps clearly, and ink cans faintly
    out.radars = w.radars
      .filter((rd) => rd.owner === p.sid)
      .map((rd) => ({
        id: rd.id, x: Math.round(rd.x), y: Math.round(rd.y), r: T.radarRadius,
        left: Math.max(0, (rd.expiresAt - now) / rd.total), hit: rd.hit
      }));
    out.traps = w.traps.map((t) => ({ id: t.id, x: Math.round(t.x), y: Math.round(t.y), caught: !!t.victim }));
    out.trapAlerts = w.traps
      .filter((t) => t.victim && r.hiders.has(t.victim))
      .map((t) => ({ x: Math.round(t.x), y: Math.round(t.y) }));
    out.cans = w.cans.map((c) => ({ id: c.id, x: Math.round(c.x), y: Math.round(c.y), a: HIDER_ITEMS.inkBomb.seekerOpacity }));

    // Compass: points at the nearest real hider while active
    if (stateOf(p, 'compass').activeUntil > now) {
      let best = null;
      for (const h of w.players.values()) {
        if (h.role !== 'hider' || !h.spawned || !r.hiders.has(h.sid)) continue;
        const d = Math.hypot(h.x - p.x, h.y - p.y);
        if (!best || d < best.d) best = { d, h };
      }
      out.compass = { angle: best ? Math.atan2(best.h.y - p.y, best.h.x - p.x) : null };
    }
  } else {
    // Hiders see beartraps faintly and ink cans clearly
    out.traps = w.traps.map((t) => ({ id: t.id, x: Math.round(t.x), y: Math.round(t.y), a: SEEKER_ITEMS.beartrap.hiderOpacity }));
    out.cans = w.cans.map((c) => ({ id: c.id, x: Math.round(c.x), y: Math.round(c.y), a: 1 }));
  }
  return out;
}

module.exports = { T, init, useItem, sling, step, extras, cloaked, holdingSling };