// Map sizes, collisions, speed zones and spawn points.
// The maps themselves are in the server/maps folder.
const maps = require('./maps');

const MARGIN = 24;

// Used only for a map that has no map file
const FALLBACK_SIZES = {
  city:     { width: 4000, height: 3000 },
  farm:     { width: 4000, height: 3000 },
  mall:     { width: 3200, height: 2200 },
  cornMaze: { width: 3600, height: 3600 }
};
const NPC_COUNTS = { high: 130, medium: 70, low: 40 };

function def(mapKey) { return maps.get(mapKey); }

function getSize(mapKey) {
  const d = def(mapKey);
  if (d) return { width: d.width, height: d.height };
  return FALLBACK_SIZES[mapKey] || { width: 3000, height: 3000 };
}

function clamp(mapKey, x, y) {
  const s = getSize(mapKey);
  return {
    x: Math.min(s.width - MARGIN, Math.max(MARGIN, x)),
    y: Math.min(s.height - MARGIN, Math.max(MARGIN, y))
  };
}

// True if nobody can stand here (walls, buildings, trees, cars...)
function isBlocked(mapKey, x, y) {
  const d = def(mapKey);
  return d ? d.solidGrid.test(x, y) : false;
}

function inCorn(mapKey, x, y) {
  const d = def(mapKey);
  return d ? d.cornGrid.test(x, y) : false;
}

// NPCs can't enter solid things, and they stay out of the corn (and a little way back from it)
function npcBlocked(mapKey, x, y) {
  const d = def(mapKey);
  if (!d) return false;
  return d.solidGrid.test(x, y) || d.cornPadGrid.test(x, y);
}

// Players are slower inside corn (the host sets how much)
function speedZone(mapKey, x, y, settings) {
  if (inCorn(mapKey, x, y)) {
    const slow = settings && typeof settings.cornSlowdown === 'number' ? settings.cornSlowdown : 0.75;
    return Math.max(0.05, 1 - slow);
  }
  return 1;
}

// The seeker appears near the middle of the map, on open ground
function seekerSpawn(mapKey) {
  const s = getSize(mapKey);
  const cx = s.width / 2;
  const cy = s.height / 2;
  for (let ring = 0; ring < 40; ring++) {
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const dist = ring * 12 + Math.random() * 12;
      const x = cx + Math.cos(a) * dist;
      const y = cy + Math.sin(a) * dist;
      if (!npcBlocked(mapKey, x, y)) return { x: x, y: y };
    }
  }
  return { x: cx, y: cy };
}

function randomSpawn(mapKey) {
  const s = getSize(mapKey);
  for (let i = 0; i < 300; i++) {
    const x = MARGIN + Math.random() * (s.width - 2 * MARGIN);
    const y = MARGIN + Math.random() * (s.height - 2 * MARGIN);
    if (!npcBlocked(mapKey, x, y)) return { x: x, y: y };
  }
  return seekerSpawn(mapKey);
}

function npcCount(mapKey, mapDef) {
  const d = def(mapKey);
  if (d && d.npcs) return d.npcs;
  return NPC_COUNTS[mapDef.population] || 40;
}

// What gets sent to the players so they can draw the map
function clientData(mapKey) {
  const d = def(mapKey);
  return d ? d.client : null;
}

module.exports = {
  getSize, clamp, isBlocked, inCorn, npcBlocked, speedZone,
  randomSpawn, seekerSpawn, npcCount, clientData
};