const makeLevel = (name, region, color, accent, size, time, need, pickup, hazards) => ({
  name, region, color, accent, size, time, need,
  shards: pickup.map(([x, s]) => ({ x, s })),
  hazards: hazards.map(([x, s, travel = 0], i) => ({ x, s, travel, phase: i * 1.7 }))
});

export const LEVELS = [
  makeLevel('Lumen Shoals', 'THE OUTER RIM', 0x72fbdc, 0x9e86ff, 162, 34, 5,
    [[0,16],[-3,30],[-4.5,44],[2,59],[5.5,76],[3,100],[-4.5,119],[0,140]],
    [[0,54],[-1.7,65],[-3.4,89],[-4.2,104],[4,126]]),
  makeLevel('Amethyst Run', 'THE FRACTURED BELT', 0xc69aff, 0x65a8ff, 210, 38, 6,
    [[2,16],[5,31],[-3,48],[-6,62],[0,82],[4.5,98],[6,121],[-2,143],[-5,166],[2,186]],
    [[-2,24,1.2],[3,44],[0,69,2.5],[-5,91],[1.2,116,2.9],[5,138],[-3,158,2],[-5,184],[0,194]]),
  makeLevel('Solstice Rift', 'THE LAST LIGHT', 0xffac7d, 0xf173cb, 256, 42, 7,
    [[-3,15],[-6,33],[1.5,48],[5,66],[6,83],[-3,103],[-5,119],[2,140],[6,160],[1,180],[-5,201],[0,227]],
    [[0,24,2.2],[-3,51,1.4],[0,70,3],[2,95,3.5],[6,115],[-2,132,3.5],[0,153,3],[5,175,2],[0,198,2.7],[-5,219,1.2],[3,236,2]])
];

export const TRACK_EDGE = 8.4;
export const PORTAL_RADIUS = 3.2;
export const SHARD_RADIUS = 1.22;
export const HAZARD_RADIUS = 1.15;

function setupLevel(state) {
  const level = LEVELS[state.level];
  Object.assign(state, {
    x: 0, s: 0, vx: 0, speed: 0, time: level.time, elapsed: 0, shield: 0,
    combo: 0, comboTime: 0, taken: level.shards.map(() => false), shards: 0, portalHint: false
  });
}

export function createRun() {
  const state = { level: 0, score: 0, lives: 3, mode: 'ready', loss: '' };
  setupLevel(state);
  return state;
}

export function setPaused(state, paused) {
  if (paused && state.mode === 'playing') state.mode = 'paused';
  if (!paused && state.mode === 'paused') state.mode = 'playing';
}

export function startLevel(state) {
  if (state.mode === 'ready') state.mode = 'playing';
  else if (state.mode === 'cleared') {
    state.level++;
    setupLevel(state);
    state.mode = 'playing';
  }
}

export function hazardX(hazard, elapsed) {
  return hazard.x + hazard.travel * Math.sin(elapsed * 2 + hazard.phase);
}

const clamp = (v, min, max) => Math.max(min, Math.min(v, max));
const approaches = (value, target, rate, dt) => value + (target - value) * (1 - Math.exp(-rate * dt));
const within = (state, x, s, radius) => Math.hypot(state.x - x, state.s - s) <= radius;

export function update(state, input, dt) {
  const events = [];
  if (state.mode !== 'playing' || dt <= 0) return events;
  const level = LEVELS[state.level];
  state.time = Math.max(0, state.time - dt);
  if (state.time === 0) {
    state.mode = 'lost';
    state.loss = 'time';
    return [{ type: 'lost' }];
  }
  state.elapsed += dt;
  state.shield = Math.max(0, state.shield - dt);
  state.comboTime = Math.max(0, state.comboTime - dt);
  if (!state.comboTime) state.combo = 0;
  state.vx = approaches(state.vx, 13 * input.x, 9, dt);
  state.x = clamp(state.x + state.vx * dt, -TRACK_EDGE, TRACK_EDGE);
  const cruise = 12 + state.level * 1.5;
  const throttle = input.z > 0 ? cruise + 8 : input.z < 0 ? -7 : cruise;
  state.speed = approaches(state.speed, throttle, 4.5, dt);
  state.s = clamp(state.s + state.speed * dt, 0, level.size);

  level.shards.forEach((shard, i) => {
    if (!state.taken[i] && within(state, shard.x, shard.s, SHARD_RADIUS)) {
      state.taken[i] = true;
      state.shards++;
      state.combo = Math.min(5, state.combo + 1);
      state.comboTime = 4;
      const points = 100 * state.combo;
      state.score += points;
      events.push({ type: 'shard', ...shard, points, combo: state.combo });
      if (state.shards === level.need) events.push({ type: 'charged' });
    }
  });

  if (state.shield === 0 && level.hazards.some(hazard =>
    within(state, hazardX(hazard, state.elapsed), hazard.s, HAZARD_RADIUS))) {
    state.lives--;
    state.shield = 1.55;
    state.combo = 0;
    state.comboTime = 0;
    events.push({ type: 'hit', x: state.x, s: state.s });
    if (!state.lives) {
      state.mode = 'lost';
      state.loss = 'lives';
      return [...events, { type: 'lost' }];
    }
  }

  if (state.s >= level.size - 0.8 && Math.abs(state.x) <= PORTAL_RADIUS) {
    if (state.shards >= level.need) {
      const bonus = Math.ceil(state.time) * 15 + state.lives * 100;
      state.score += bonus;
      state.mode = state.level === LEVELS.length - 1 ? 'won' : 'cleared';
      events.push({ type: state.mode, bonus });
    } else if (!state.portalHint) {
      state.portalHint = true;
      events.push({ type: 'locked' });
    }
  } else if (state.s < level.size - 5) {
    state.portalHint = false;
  }
  return events;
}
