import { createRun, LEVELS, setPaused, startLevel, update } from './logic.js';
import { createView } from './view.js';

const $ = id => document.getElementById(id);
const canvas = $('world');
const flight = $('flight');
const primary = $('primary');
const pause = $('pause');
const mute = $('mute');
const signal = $('signal');
const routeDots = [...document.querySelectorAll('.route i')];
const touchButtons = [...document.querySelectorAll('.touch button')];
const originalHeading = $('heading').innerHTML;
const originalMessage = $('message').textContent;

const keys = new Set();
const pointers = new Map();
const keyMap = {
  arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right',
  arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down'
};
let state = createRun();
let muted = false;
let audio;
let view;
let lastFrame;
let visualTime = 0;
let accumulator = 0;
let signalTime = 0;
let best = 0;
try { best = Number(localStorage.getItem('spark-drift.best')) || 0; } catch {}
const format = number => number.toLocaleString('en-US');

const audioNotes = {
  launch: [[330, 0, .12], [495, .075, .25]],
  shard: [[550, 0, .1], [825, .08, .21]],
  charged: [[392, 0, .14], [587, .09, .2], [784, .18, .36]],
  hit: [[124, 0, .23], [96, .075, .2]],
  locked: [[220, 0, .14], [165, .09, .2]],
  cleared: [[523, 0, .15], [659, .13, .18], [784, .26, .35]],
  won: [[523, 0, .23], [659, .13, .22], [784, .26, .33], [1047, .4, .55]],
  lost: [[280, 0, .19], [221, .13, .24], [146, .26, .35]]
};

function unlockAudio() {
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') audio.resume().catch(() => {});
  } catch {}
}

function sound(type, combo = 1) {
  if (muted || !audio || audio.state !== 'running' || !audioNotes[type]) return;
  for (const [note, offset, duration] of audioNotes[type]) {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const start = audio.currentTime + offset;
    oscillator.type = type === 'hit' ? 'triangle' : 'sine';
    oscillator.frequency.value = note * (type === 'shard' ? 1 + (combo - 1) * .11 : 1);
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(.1, start + .017);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + .01);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
}

function updateBest() {
  if (state.score <= best) return;
  best = state.score;
  try { localStorage.setItem('spark-drift.best', String(best)); } catch {}
}

function write(id, value) {
  const target = $(id);
  const text = String(value);
  if (target.textContent !== text) target.textContent = text;
}

function clearInput() {
  keys.clear();
  pointers.clear();
  touchButtons.forEach(button => button.classList.remove('active'));
}

function syncMode(focus = true) {
  const mode = state.mode;
  const level = LEVELS[state.level];
  flight.dataset.mode = mode;
  $('panel').hidden = mode === 'playing';
  $('telemetry').hidden = mode !== 'playing';
  $('touch').hidden = mode !== 'playing';
  signal.hidden = true;
  signalTime = 0;
  pause.disabled = !['playing', 'paused'].includes(mode);
  pause.textContent = mode === 'paused' ? 'Resume' : 'Pause';
  $('how').hidden = mode !== 'ready';
  $('restart').hidden = !['paused', 'cleared'].includes(mode);
  if (mode !== 'playing') clearInput();
  const copy = {
    paused: ['FLIGHT ON HOLD', 'Run paused', 'Time and danger are on hold. Resume when you’re ready.', 'Resume flight'],
    cleared: ['SECTOR ' + (state.level + 1) + ' CLEARED', 'Portal crossed', level.name + ' is clear. Next up: ' + (LEVELS[state.level + 1]?.name ?? '') + '.', 'Fly next sector'],
    won: ['MISSION COMPLETE / 3 OF 3', 'Sky restored', 'All three portals are lit. The last spark made it home.', 'Fly again'],
    lost: ['MISSION FAILED', 'Signal lost', state.loss === 'time' ? 'Time ran out before you crossed the charged portal.' : 'All three lives are lost. Give the island route another run.', 'Try again']
  };
  if (copy[mode]) {
    const [label, title, description, button] = copy[mode];
    write('eyebrow', label);
    write('heading', title);
    write('message', description + (mode !== 'paused' ? ' Score: ' + format(state.score) + '.' : ''));
    primary.textContent = button;
  } else if (mode === 'ready') {
    write('eyebrow', 'SOLO ARCADE FLIGHT');
    $('heading').innerHTML = originalHeading;
    write('message', originalMessage);
    primary.innerHTML = 'Launch run <span aria-hidden="true">↗</span>';
  }
  write('best', format(best));
  write('sector', 'SECTOR 0' + (state.level + 1) + ' / ' + level.region);
  write('region', level.name);
  write('route-label', state.mode === 'playing' ? 'ROUTE' : 'FLIGHT PLAN');
  write('route-name', level.name);
  routeDots.forEach((dot, i) => dot.classList.toggle('active', i <= state.level));
  if (focus && mode !== 'playing') $('heading').focus({ preventScroll: true });
  if (focus && mode === 'playing') pause.focus({ preventScroll: true });
}

function syncStats() {
  const level = LEVELS[state.level];
  write('shards', state.shards + ' / ' + level.need);
  write('timer', Math.ceil(state.time) + 's');
  $('timer').classList.toggle('urgent', state.time < 9);
  write('lives', state.lives + ' / 3');
  write('score', format(state.score));
  $('progress-fill').style.width = (Math.min(1, state.s / level.size) * 100) + '%';
  $('combo').hidden = state.mode !== 'playing' || !state.combo;
  write('combo-value', '×' + state.combo);
  $('combo-fill').style.width = (state.comboTime / 4 * 100) + '%';
}

function notice(message, time = 2.1) {
  signal.hidden = false;
  write('signal', message);
  signalTime = time;
}

function resetRun() {
  state = createRun();
  view.load(LEVELS[0], state);
}

function go() {
  unlockAudio();
  if (state.mode === 'playing') return;
  if (state.mode === 'paused') {
    togglePause();
    return;
  }
  if (['won', 'lost'].includes(state.mode)) resetRun();
  const previous = state.level;
  startLevel(state);
  if (previous !== state.level) view.load(LEVELS[state.level], state);
  syncMode();
  syncStats();
  sound('launch');
  notice('Collect ' + LEVELS[state.level].need + ' shards, then cross the portal.');
}

function togglePause() {
  if (!['playing', 'paused'].includes(state.mode)) return;
  setPaused(state, state.mode === 'playing');
  syncMode();
}

function toggleMute() {
  muted = !muted;
  mute.setAttribute('aria-pressed', String(muted));
  mute.textContent = muted ? 'Sound off' : 'Sound on';
  if (muted) audio?.suspend().catch(() => {});
  else unlockAudio();
}

function listen() {
  primary.addEventListener('click', go);
  $('restart').addEventListener('click', () => { resetRun(); go(); });
  pause.addEventListener('click', togglePause);
  mute.addEventListener('click', toggleMute);

  window.addEventListener('keydown', event => {
    const key = event.key.toLowerCase();
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (keyMap[key] && state.mode === 'playing') {
      keys.add(key);
      event.preventDefault();
    }
    if (event.repeat) return;
    if (key === 'escape' || key === 'p') togglePause();
    if (key === 'm') toggleMute();
    if (key === 'enter' && !event.target.closest?.('button') && state.mode !== 'playing') go();
  });
  window.addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));
  window.addEventListener('blur', clearInput);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.mode === 'playing') togglePause();
  });

  for (const button of touchButtons) {
    const direction = button.dataset.key;
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, direction);
      button.classList.add('active');
    });
    const release = event => {
      pointers.delete(event.pointerId);
      if (![...pointers.values()].includes(direction)) button.classList.remove('active');
    };
    for (const name of ['lostpointercapture', 'pointerup', 'pointercancel']) button.addEventListener(name, release);
  }
}

function input() {
  const active = new Set([...pointers.values(), ...Array.from(keys, key => keyMap[key])]);
  return {
    x: Number(active.has('right')) - Number(active.has('left')),
    z: Number(active.has('up')) - Number(active.has('down'))
  };
}

function frame(now) {
  const dt = Math.min(.1, (now - (lastFrame ?? now)) / 1000);
  lastFrame = now;
  const step = 1 / 120;
  if (state.mode === 'playing') {
    accumulator += dt;
    const controls = input();
    while (accumulator >= step && state.mode === 'playing') {
      accumulator -= step;
      for (const event of update(state, controls, step)) {
        sound(event.type, event.combo);
        if (event.type === 'shard' || event.type === 'hit') view.burst(event);
        if (event.type === 'shard') notice('+' + event.points + ' · Shard recovered', .85);
        if (event.type === 'charged') notice('Portal charged! Steer into the ring at the end.', 3);
        if (event.type === 'hit') notice('Impact! ' + state.lives + ' lives left.');
        if (event.type === 'locked') notice('Portal locked. Hold ↓ / S to reverse for more shards.', 4);
        if (['cleared', 'won', 'lost'].includes(event.type)) {
          updateBest();
          syncMode();
          syncStats();
        }
      }
    }
    if (signalTime > 0) {
      signalTime -= dt;
      if (signalTime <= 0) signal.hidden = true;
    }
    syncStats();
  } else {
    accumulator = 0;
  }
  if (state.mode !== 'paused' && !reducedMotion) visualTime += dt;
  view.draw(state, visualTime, state.mode === 'paused' ? 0 : dt);
  requestAnimationFrame(frame);
}

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
try {
  if (!canvas.getContext('webgl2', { alpha: true, antialias: true, powerPreference: 'high-performance' })) {
    throw new Error('WebGL 2 unavailable');
  }
  view = createView(canvas, reducedMotion);
  view.load(LEVELS[0], state);
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    if (state.mode === 'playing') togglePause();
    write('message', 'The renderer stopped. Reload the page to relaunch the game.');
    primary.disabled = true;
    $('restart').hidden = true;
    pause.disabled = true;
  });
  syncMode(false);
  listen();
  if (new URLSearchParams(location.search).has('debug')) {
    window.__sparkDrift = Object.freeze({ snapshot: () => structuredClone(state) });
  }
  requestAnimationFrame(frame);
} catch (error) {
  write('message', 'Spark Drift needs WebGL 2. Try an up-to-date browser with hardware acceleration enabled.');
  write('eyebrow', 'RENDERER UNAVAILABLE');
  primary.disabled = true;
  mute.disabled = true;
  console.error(error);
}
