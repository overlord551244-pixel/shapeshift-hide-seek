const { MAPS, SEEKER_ITEMS, HIDER_ITEMS } = require('./config');
const lobbyLib = require('./lobby');
const game = require('./game');

let io = null;
function init(socketServer) { io = socketServer; game.init(socketServer); }

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function broadcastLobby(lobby) {
  io.to(lobby.code).emit('lobbyUpdate', lobbyLib.toPublic(lobby));
}

// ---------- Starting a round ----------

function startRound(socketId) {
  const lobby = lobbyLib.getLobby(socketId);
  if (!lobby || lobby.hostId !== socketId) return { error: 'Only the host can start.' };
  if (lobby.state !== 'lobby') return { error: 'A round is already running.' };
  if (lobby.players.size < 2) return { error: 'You need at least 2 players.' };

  const s = lobby.settings;
  const map = MAPS[lobby.map];
  const ids = shuffle([...lobby.players.keys()]);

  // Always leave at least one hider
  const seekerCount = Math.max(1, Math.min(Math.floor(s.seekerCount), ids.length - 1));
  const seekerIds = ids.slice(0, seekerCount);
  const hiderIds = ids.slice(seekerCount);

  const round = {
    phase: 'prep',
    seekers: new Set(seekerIds),   // seekers still in the game
    hiders: new Set(hiderIds),     // hiders still alive
    choices: new Map(),            // hider id -> { entity, color }
    items: new Map(),              // player id -> [item keys]
    hearts: new Map(),             // seeker id -> hearts left
    seekerSlots: Math.max(0, Math.floor(s.seekerItemSlots)),   // item slots (the gun is extra)
    hiderSlots: Math.max(0, Math.floor(s.hiderItemSlots)),
    endsAt: Date.now() + s.prepTime * 1000,
    lastSent: -1,
    timer: null,
    world: null,
    alarm: null
  };
  for (const id of seekerIds) round.hearts.set(id, Math.floor(s.seekerHearts));

  lobby.round = round;
  lobby.state = 'prep';
  game.createWorld(lobby);

  const entities = {};
  for (const [key, def] of Object.entries(map.entities)) entities[key] = def.colors;

  for (const id of lobby.players.keys()) {
    const isSeeker = round.seekers.has(id);
    io.to(id).emit('roundStart', {
      role: isSeeker ? 'seeker' : 'hider',
      map: lobby.map,
      mapName: map.name,
      prepTime: s.prepTime,
      hearts: isSeeker ? round.hearts.get(id) : null,
      entities: isSeeker ? null : entities,
      itemOptions: Object.keys(isSeeker ? SEEKER_ITEMS : HIDER_ITEMS),
      itemSlots: isSeeker ? round.seekerSlots : round.hiderSlots
    });
  }

  broadcastLobby(lobby);
  round.timer = setInterval(() => tick(lobby), 250);
  tick(lobby);
  return { ok: true };
}

// ---------- Timer ----------

function tick(lobby) {
  const r = lobby.round;
  if (!r) return;

  const now = Date.now();
  const secondsLeft = Math.max(0, Math.ceil((r.endsAt - now) / 1000));
  if (secondsLeft !== r.lastSent) {
    r.lastSent = secondsLeft;
    io.to(lobby.code).emit('timer', { phase: r.phase, secondsLeft });
  }

  // The alarm rings near the end of the hunt, then waits, then rings again
  if (r.phase === 'hunt' && r.alarm && now >= r.alarm.nextAt && now < r.endsAt) {
    const s = lobby.settings;
    r.alarm.until = now + s.alarmDuration * 1000;
    r.alarm.nextAt = r.alarm.until + s.alarmCooldown * 1000;
    io.to(lobby.code).emit('alarm', { seconds: s.alarmDuration });
  }

  if (now >= r.endsAt) {
    if (r.phase === 'prep') endPrep(lobby);
    else if (r.phase === 'hunt') endRound(lobby, 'hiders', 'Time ran out. The hiders survived!');
  }
}

// ---------- Preparation choices ----------

function chooseEntity(socketId, entity, color) {
  const lobby = lobbyLib.getLobby(socketId);
  const r = lobby && lobby.round;
  if (!r || r.phase !== 'prep' || !r.hiders.has(socketId)) return;

  const def = MAPS[lobby.map].entities[entity];
  if (!def) return;                                   // entity must exist on this map
  if (color && !def.colors.includes(color)) return;   // color must belong to that entity

  r.choices.set(socketId, { entity, color: color || null });
}

function pickItems(socketId, items) {
  const lobby = lobbyLib.getLobby(socketId);
  const r = lobby && lobby.round;
  if (!r || r.phase !== 'prep' || !Array.isArray(items)) return;

  const isSeeker = r.seekers.has(socketId);
  if (!isSeeker && !r.hiders.has(socketId)) return;

  const allowed = isSeeker ? SEEKER_ITEMS : HIDER_ITEMS;
  const slots = isSeeker ? r.seekerSlots : r.hiderSlots;

  const clean = [...new Set(items)].filter((k) => allowed[k]).slice(0, slots);
  r.items.set(socketId, clean);
}

// ---------- Prep is over: lock everything in ----------

function endPrep(lobby) {
  const r = lobby.round;
  const map = MAPS[lobby.map];

  r.phase = 'hunt';
  lobby.state = 'hunt';
  game.spawnSeekers(lobby);

  for (const id of r.hiders) {
    const c = r.choices.get(id) || {};
    if (!c.entity) c.entity = pick(Object.keys(map.entities));
    if (!c.color) c.color = pick(map.entities[c.entity].colors);
    r.choices.set(id, c);
    io.to(id).emit('locked', { entity: c.entity, color: c.color, items: r.items.get(id) || [] });
  }
  for (const id of r.seekers) {
    io.to(id).emit('locked', { items: r.items.get(id) || [] });
  }

  r.endsAt = Date.now() + lobby.settings.roundTime * 1000;
  r.lastSent = -1;

  // Plan the alarm: it first rings when "alarmTime" seconds are left (0 means no alarm)
  const alarmTime = lobby.settings.alarmTime;
  r.alarm = alarmTime > 0 ? { nextAt: r.endsAt - alarmTime * 1000, until: 0 } : null;

  io.to(lobby.code).emit('huntStart', { roundTime: lobby.settings.roundTime });
  broadcastLobby(lobby);
}

// ---------- Win conditions ----------

function checkWin(lobby) {
  const r = lobby.round;
  if (!r) return;
  if (r.hiders.size === 0) {
    endRound(lobby, 'seekers', 'All hiders were found!');
  } else if (r.seekers.size === 0) {
    endRound(lobby, 'hiders', 'No seekers left. The hiders win!');
  }
}

// Called when a seeker shoots a real player
function eliminateHider(lobby, hiderId) {
  const r = lobby.round;
  if (!r || r.phase !== 'hunt' || !r.hiders.has(hiderId)) return;
  r.hiders.delete(hiderId);
  io.to(lobby.code).emit('hiderCaught', { id: hiderId });
  checkWin(lobby);
}

// Called when a seeker shoots an NPC
function loseHeart(lobby, seekerId) {
  const r = lobby.round;
  if (!r || r.phase !== 'hunt' || !r.seekers.has(seekerId)) return;
  const left = r.hearts.get(seekerId) - 1;
  r.hearts.set(seekerId, left);
  io.to(seekerId).emit('hearts', { hearts: left });   // only that seeker sees their hearts
  if (left <= 0) {
    r.seekers.delete(seekerId);
    io.to(seekerId).emit('seekerOut');
    checkWin(lobby);
  }
}

function playerLeft(lobby, socketId) {
  const r = lobby.round;
  if (!r) return;
  r.seekers.delete(socketId);
  r.hiders.delete(socketId);
  r.choices.delete(socketId);
  r.items.delete(socketId);
  r.hearts.delete(socketId);
  checkWin(lobby);
}

function endRound(lobby, winner, reason) {
  const r = lobby.round;
  if (!r) return;
  clearInterval(r.timer);
  lobby.round = null;
  lobby.state = 'lobby';
  io.to(lobby.code).emit('roundEnd', { winner, reason });
  broadcastLobby(lobby);
}

module.exports = {
  init, startRound, chooseEntity, pickItems,
  eliminateHider, loseHeart, playerLeft
};