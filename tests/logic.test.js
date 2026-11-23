import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, LEVELS, hazardX, setPaused, startLevel, update } from '../logic.js';

const idle = { x: 0, z: 0 };
const epsilon = 1 / 120;
const running = () => { const state = createRun(); startLevel(state); return state; };
const putAt = (state, x, s) => Object.assign(state, { x, s, vx: 0, speed: 0 });
function collect(state, i) {
  const { x, s } = LEVELS[state.level].shards[i];
  putAt(state, x, s);
  return update(state, idle, epsilon);
}
function enterPortal(state) {
  putAt(state, 0, LEVELS[state.level].size);
  return update(state, idle, epsilon);
}

test('starts with three lives and the first sector requirements', () => {
  const state = createRun();
  assert.equal(state.mode, 'ready');
  assert.equal(state.lives, 3);
  assert.equal(state.score, 0);
  assert.equal(state.time, LEVELS[0].time);
  update(state, idle, 1);
  assert.equal(state.time, LEVELS[0].time);
  startLevel(state);
  assert.equal(state.mode, 'playing');
});

test('credits a shard once, multiplies a chain, and caps the multiplier at five', () => {
  const state = running();
  assert.equal(collect(state, 0)[0].points, 100);
  assert.deepEqual(collect(state, 0), []);
  assert.equal(collect(state, 1)[0].points, 200);
  for (let i = 2; i < 6; i++) collect(state, i);
  assert.equal(state.shards, 6);
  assert.equal(state.combo, 5);
  assert.equal(state.score, 2000);
  putAt(state, -8, 10);
  update(state, idle, 4);
  assert.equal(state.combo, 0);
});

test('throttle boosts forward and reverses once held', () => {
  const state = running();
  for (let i = 0; i < 120; i++) update(state, { x: 1, z: 1 }, epsilon);
  assert.ok(state.x > 5 && state.s > 13);
  const forward = state.s;
  for (let i = 0; i < 120; i++) update(state, { x: 0, z: -1 }, epsilon);
  assert.ok(state.s < forward);
});

test('damages lives, breaks the chain, briefly shields, and loses at zero lives', () => {
  const state = running();
  collect(state, 0);
  const hazard = LEVELS[0].hazards[0];
  function collide() {
    putAt(state, hazardX(hazard, state.elapsed), hazard.s);
    return update(state, idle, epsilon).map(event => event.type);
  }
  assert.deepEqual(collide(), ['hit']);
  assert.equal(state.lives, 2);
  assert.equal(state.combo, 0);
  assert.deepEqual(collide(), []);
  for (let i = 0; i < 2; i++) {
    putAt(state, -8, 0);
    update(state, idle, 1.6);
    assert.deepEqual(collide(), i === 0 ? ['hit'] : ['hit', 'lost']);
  }
  assert.equal(state.lives, 0);
  assert.equal(state.mode, 'lost');
  assert.equal(state.loss, 'lives');
});

test('pause freezes the timer; an expired timer beats a charged portal', () => {
  const state = running();
  for (let i = 0; i < LEVELS[0].need; i++) collect(state, i);
  putAt(state, 0, LEVELS[0].size);
  state.time = .2;
  setPaused(state, true);
  assert.deepEqual(update(state, idle, 1), []);
  assert.equal(state.time, .2);
  setPaused(state, false);
  assert.deepEqual(update(state, idle, .2), [{ type: 'lost' }]);
  assert.equal(state.mode, 'lost');
  assert.equal(state.loss, 'time');
  assert.equal(state.time, 0);
});

test('locks uncharged portals, advances harder sectors, and wins the three-sector run', () => {
  const state = running();
  assert.deepEqual(enterPortal(state), [{ type: 'locked' }]);
  assert.deepEqual(enterPortal(state), []);
  for (let level = 0; level < LEVELS.length; level++) {
    const spec = LEVELS[level];
    assert.equal(state.level, level);
    assert.equal(state.shards, 0);
    for (let i = 0; i < spec.need; i++) collect(state, i);
    putAt(state, 8, spec.size);
    assert.deepEqual(update(state, idle, epsilon), []);
    const before = state.score;
    const [clear] = enterPortal(state);
    assert.equal(clear.type, level < 2 ? 'cleared' : 'won');
    assert.equal(state.score, before + Math.ceil(state.time) * 15 + 300);
    startLevel(state);
    if (level < 2) {
      assert.ok(LEVELS[state.level].need > spec.need);
      assert.ok(LEVELS[state.level].hazards.length > spec.hazards.length);
      assert.equal(state.time, LEVELS[state.level].time);
      assert.equal(state.lives, 3);
    }
  }
  assert.equal(state.mode, 'won');
  assert.equal(createRun().mode, 'ready');
});
