// All default game settings. The host can override the "settings" values per lobby.

const DEFAULT_SETTINGS = {
  // Round timing (seconds)
  prepTime: 20,
  roundTime: 180,

  // Players
  seekerCount: 1,

  // Seeker
  seekerHearts: 8,
  seekerSpeedMultiplier: 1.2,   // relative to hider/NPC walk speed
  gunCooldown: 2.5,             // seconds between shots
  seekerItemSlots: 2,           // item slots besides the gun (the gun is always slot 1)

  // Hiders
  hiderItemSlots: 1,

  // Alarm: rings near the end of the hunt and shows the seeker where every hider is
  alarmTime: 45,                // seconds left when it first rings (0 turns the alarm off)
  alarmDuration: 2,             // how long each ring lasts
  alarmCooldown: 8,             // pause between rings

  // Movement
  baseSpeed: 140,               // pixels per second, shared by hiders and NPCs
  sprintMultiplier: 1.6,        // players only (NPCs never sprint)
  cornSlowdown: 0.75            // Corn Maze: 75% slower inside corn walls
};

// Seeker items. Times are in seconds, percentages as multipliers.
const SEEKER_ITEMS = {
  runningShoes:   { type: 'passive', speedBonus: 1.4 },
  enhancedEyes:   { type: 'passive', fovBonus: 1.8 },
  radarScanner:   { type: 'active', duration: 30, cooldown: 20 },
  invisibilityCloak: { type: 'active', duration: 12, cooldown: 10 },
  compass:        { type: 'active', duration: 3, cooldown: 16 },
  beartrap:       { type: 'active', cooldown: 12, maxPlaced: 8, stuckTime: 4, color: '#c2c2c2', hiderOpacity: 0.05 }
};

// Hider items
const HIDER_ITEMS = {
  slingshot: { type: 'active', cooldown: 10, stunTime: 3 },
  smokeBomb: { type: 'active', duration: 9, cooldown: 26 },
  inkBomb:   { type: 'active', maxPlaced: 2, seekerOpacity: 0.05, screenInkTime: 6 }
};

// Maps and the entities that exist on each one (with their color options)
const MAPS = {
  city: {
    name: 'City',
    population: 'high',
    entities: {
      human:    { colors: ['black suit', 'green t-shirt', 'pink dress', 'blue jacket', 'red hoodie', 'gray coat'] },
      bird:     { colors: ['black', 'white', 'gray', 'blue', 'red'] },
      rat:      { colors: ['black', 'gray', 'brown', 'white'] },
      squirrel: { colors: ['gray', 'brown', 'light tan'] }
    }
  },
  farm: {
    name: 'Farm',
    population: 'medium',
    entities: {
      chicken: { colors: ['white', 'brown', 'yellow'] },
      pig:     { colors: ['pink', 'light pink', 'brown'] },
      sheep:   { colors: ['white', 'black', 'gray', 'brown'] },
      cow:     { colors: ['black and white', 'brown', 'white'] },
      horse:   { colors: ['tan', 'brown', 'white'] },
      goat:    { colors: ['white', 'gray', 'brown'] }
    }
  },
  mall: {
    name: 'Mall',
    population: 'high',
    entities: {
      human: { colors: ['black suit', 'green t-shirt', 'pink dress', 'blue jacket', 'red hoodie', 'gray coat', 'yellow sundress', 'purple sweater'] }
    }
  },
  cornMaze: {
    name: 'Corn Maze',
    population: 'medium',
    humanHeavy: true,   // more humans than animals
    entities: {
      human:    { colors: ['black suit', 'green t-shirt', 'pink dress', 'blue jacket', 'red hoodie', 'gray coat'] },
      bird:     { colors: ['black', 'white', 'gray', 'blue', 'red'] },
      squirrel: { colors: ['gray', 'brown', 'light tan'] }
    }
  }
};

module.exports = { DEFAULT_SETTINGS, SEEKER_ITEMS, HIDER_ITEMS, MAPS };