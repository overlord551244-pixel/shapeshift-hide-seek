// Loads every map file it finds in this folder (city.js, farm.js, mall.js, cornMaze.js)
const fs = require('fs');
const path = require('path');
const util = require('./util');

const BODY = 9;        // how far from a wall a player's center has to stay
const NPC_CORN = 18;   // NPCs keep this far from corn, so they walk down the middle of the paths
const NAMES = ['city', 'farm', 'mall', 'cornMaze'];
const built = {};

function finish(def) {
  def.solids = def.solids || [];
  def.zones = def.zones || {};
  def.ground = def.ground || [];
  def.objects = def.objects || [];
  const corn = def.zones.corn || [];
  def.solidGrid = util.makeGrid(def.width, def.height, def.solids, BODY, 200);
  def.cornGrid = util.makeGrid(def.width, def.height, corn, 0, 200);
  def.cornPadGrid = util.makeGrid(def.width, def.height, corn, NPC_CORN, 200);
  // This is the part sent to the players so they can draw the map
  def.client = {
    width: def.width,
    height: def.height,
    ground: def.ground,
    objects: def.objects,
    zones: def.zones
  };
  return def;
}

for (const name of NAMES) {
  const file = path.join(__dirname, name + '.js');
  if (fs.existsSync(file)) built[name] = finish(require(file).build());
}

console.log('Maps loaded: ' + (Object.keys(built).join(', ') || 'none'));

function get(name) { return built[name] || null; }

module.exports = { get };