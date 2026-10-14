const { DEFAULT_SETTINGS, MAPS } = require('./config');

const MAX_PLAYERS = 12;

// Allowed [min, max] for each host setting. Anything outside gets clamped.
const LIMITS = {
  prepTime: [5, 60],
  roundTime: [30, 900],
  seekerCount: [1, 4],
  seekerHearts: [1, 30],
  seekerSpeedMultiplier: [0.5, 3],
  gunCooldown: [0.5, 10],
  seekerItemSlots: [0, 6],
  hiderItemSlots: [0, 3],
  alarmTime: [0, 300],
  alarmDuration: [1, 10],
  alarmCooldown: [1, 60],
  baseSpeed: [60, 300],
  sprintMultiplier: [1, 3],
  cornSlowdown: [0, 0.9]
};

const lobbies = new Map();      // code -> lobby
const playerLobby = new Map();  // socket id -> lobby code

function makeCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code;
  do {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += letters[Math.floor(Math.random() * letters.length)];
    }
  } while (lobbies.has(code));
  return code;
}

function cleanName(name) {
  const n = String(name || '').trim().slice(0, 16);
  return n || 'Player';
}

function createLobby(socketId, name) {
  const code = makeCode();
  const lobby = {
    code,
    hostId: socketId,
    map: 'city',
    state: 'lobby',
    settings: { ...DEFAULT_SETTINGS },
    players: new Map(),
    round: null
  };
  lobby.players.set(socketId, { id: socketId, name: cleanName(name) });
  lobbies.set(code, lobby);
  playerLobby.set(socketId, code);
  return lobby;
}

function joinLobby(socketId, code, name) {
  code = String(code || '').trim().toUpperCase();
  const lobby = lobbies.get(code);
  if (!lobby) return { error: 'Lobby not found.' };
  if (lobby.state !== 'lobby') return { error: 'That game already started.' };
  if (lobby.players.size >= MAX_PLAYERS) return { error: 'Lobby is full.' };

  lobby.players.set(socketId, { id: socketId, name: cleanName(name) });
  playerLobby.set(socketId, code);
  return { lobby };
}

// Returns the lobby (so the server can update everyone), or null if it was deleted
function leaveLobby(socketId) {
  const code = playerLobby.get(socketId);
  if (!code) return null;
  playerLobby.delete(socketId);

  const lobby = lobbies.get(code);
  if (!lobby) return null;

  lobby.players.delete(socketId);
  if (lobby.players.size === 0) {
    if (lobby.round && lobby.round.timer) clearInterval(lobby.round.timer);
    lobbies.delete(code);
    return null;
  }
  // If the host left, the next player becomes host
  if (lobby.hostId === socketId) {
    lobby.hostId = lobby.players.keys().next().value;
  }
  return lobby;
}

function getLobby(socketId) {
  return lobbies.get(playerLobby.get(socketId)) || null;
}

function getLobbyCode(socketId) {
  return playerLobby.get(socketId) || null;
}

function updateSettings(socketId, changes) {
  const lobby = lobbies.get(playerLobby.get(socketId));
  if (!lobby || lobby.hostId !== socketId || lobby.state !== 'lobby') return null;
  if (!changes || typeof changes !== 'object') return null;

  for (const key of Object.keys(changes)) {
    if (!LIMITS[key]) continue;
    const value = Number(changes[key]);
    if (Number.isNaN(value)) continue;
    const [min, max] = LIMITS[key];
    lobby.settings[key] = Math.min(max, Math.max(min, value));
  }
  return lobby;
}

function setMap(socketId, mapKey) {
  const lobby = lobbies.get(playerLobby.get(socketId));
  if (!lobby || lobby.hostId !== socketId || lobby.state !== 'lobby') return null;
  if (!MAPS[mapKey]) return null;
  lobby.map = mapKey;
  return lobby;
}

// What we send to players (no internal stuff)
function toPublic(lobby) {
  return {
    code: lobby.code,
    hostId: lobby.hostId,
    map: lobby.map,
    state: lobby.state,
    settings: lobby.settings,
    maxPlayers: MAX_PLAYERS,
    maps: Object.entries(MAPS).map(([key, m]) => ({ key, name: m.name })),
    players: [...lobby.players.values()]
  };
}

module.exports = {
  createLobby, joinLobby, leaveLobby, getLobbyCode, getLobby,
  updateSettings, setMap, toPublic
};