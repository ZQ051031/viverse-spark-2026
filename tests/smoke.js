import assert from 'node:assert/strict';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { LEVELS } from '../logic.js';
import { serve } from './server.js';

const { server, url } = await serve();
const prefix = url + '/viverse-spark-2026/';
const problems = [];
const fetched = new Set();
let browser;
const snapshot = page => page.evaluate(() => window.__sparkDrift.snapshot());

async function shot(page, name) {
  if (process.env.SHOTS_DIR) await page.screenshot({ path: join(process.env.SHOTS_DIR, name + '.png') });
}

function monitor(page) {
  page.on('response', response => {
    if (response.status() >= 400) problems.push(response.status() + ' ' + response.url());
    if (response.url().startsWith(prefix)) fetched.add(response.url().slice(prefix.length).split('?')[0]);
  });
  page.on('console', message => { if (message.type() === 'error') problems.push(message.text()); });
  page.on('pageerror', error => problems.push(error.message));
  page.on('requestfailed', request => problems.push(request.url() + ': ' + request.failure()?.errorText));
  page.on('request', request => { if (!request.url().startsWith(url + '/')) problems.push('External asset: ' + request.url()); });
}

async function open(page) {
  monitor(page);
  assert.equal((await page.goto(prefix + '?debug')).status(), 200);
  await page.locator('canvas[data-rendered="true"]').waitFor();
  const canvas = page.locator('#world');
  const size = await canvas.evaluate(element => [element.width, element.height]);
  assert.ok(size[0] > 0 && size[1] > 0);
}

async function flySector(page, spec, portalX) {
  const result = await page.evaluate(({ shards, size, portalX }) => new Promise(resolve => {
    const held = new Set();
    function hold(key, enabled) {
      if (enabled === held.has(key)) return;
      if (enabled) held.add(key);
      else held.delete(key);
      window.dispatchEvent(new KeyboardEvent(enabled ? 'keydown' : 'keyup', { key }));
    }
    function fly() {
      const state = window.__sparkDrift.snapshot();
      if (state.mode !== 'playing') {
        for (const key of held) hold(key, false);
        resolve(state);
        return;
      }
      const next = shards.find(({ s }, i) => !state.taken[i] && s > state.s - .7);
      const target = next?.x ?? (state.s < size - 20 ? portalX : portalX * .85);
      const error = target - state.x - state.vx * .08;
      hold('ArrowLeft', error < -.21);
      hold('ArrowRight', error > .21);
      requestAnimationFrame(fly);
    }
    fly();
  }), { shards: spec.shards, size: spec.size, portalX });
  return result;
}

try {
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader']
  });
  const mobile = await browser.newPage({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await open(mobile);
  await mobile.getByRole('button', { name: 'Launch run' }).tap();
  const left = await mobile.getByRole('button', { name: 'Steer left' }).boundingBox();
  assert.ok(left, 'touch controls are visible on phones');
  const session = await mobile.context().newCDPSession(mobile);
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart', touchPoints: [{ x: left.x + left.width / 2, y: left.y + left.height / 2 }]
  });
  await mobile.waitForFunction(() => window.__sparkDrift.snapshot().x < -0.55);
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await shot(mobile, 'mobile');
  await mobile.close();
  console.log('PASS mobile canvas and held touch steering');

  const page = await browser.newPage({ viewport: { width: 1200, height: 750 } });
  await open(page);
  await shot(page, 'start');
  await page.getByRole('button', { name: 'Launch run' }).click();
  const first = page.waitForFunction(() => window.__sparkDrift.snapshot().shards > 0);
  await first;
  await shot(page, 'gameplay');
  await page.keyboard.press('Escape');
  await page.getByRole('heading', { name: 'Run paused' }).waitFor();
  const paused = await snapshot(page);
  assert.equal(paused.mode, 'paused');
  await page.keyboard.press('m');
  assert.equal(await page.getByRole('button', { name: 'Sound off' }).getAttribute('aria-pressed'), 'true');
  assert.equal((await snapshot(page)).time, paused.time);
  await page.getByRole('button', { name: 'Resume flight' }).click();
  for (const [i, level] of LEVELS.entries()) {
    const state = await flySector(page, level, [0, 2.7, -2.7][i]);
    assert.equal(state.mode, i === LEVELS.length - 1 ? 'won' : 'cleared',
      level.name + ': ' + JSON.stringify(state));
    assert.ok(state.shards >= level.need);
    console.log('PASS ' + level.name + ': ' + state.shards + ' shards, ' + state.lives + ' lives, ' + state.score + ' score');
    if (state.mode === 'cleared') await page.getByRole('button', { name: 'Fly next sector' }).click();
  }
  await page.getByRole('heading', { name: 'Sky restored' }).waitFor();
  const winningScore = (await snapshot(page)).score;
  assert.equal(await page.evaluate(() => Number(localStorage.getItem('spark-drift.best'))), winningScore);
  await shot(page, 'win');

  await page.getByRole('button', { name: 'Fly again' }).click();
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => window.__sparkDrift.snapshot().x > 8);
  await page.keyboard.up('ArrowRight');
  await page.getByRole('heading', { name: 'Signal lost' }).waitFor({ timeout: 95_000 });
  assert.equal((await snapshot(page)).loss, 'time');
  await shot(page, 'game-over');
  await page.getByRole('button', { name: 'Try again' }).click();
  const restarted = await snapshot(page);
  assert.equal(restarted.mode, 'playing');
  assert.equal(restarted.level, 0);
  assert.equal(restarted.lives, 3);
  assert.equal(restarted.score, 0);
  await page.reload();
  await page.locator('canvas[data-rendered="true"]').waitFor();
  assert.equal(await page.locator('#best').textContent(), winningScore.toLocaleString('en-US'));
  for (const path of ['style.css', 'spark.svg', 'game.js', 'view.js', 'logic.js', 'vendor/three.module.min.js', 'vendor/three.core.min.js']) {
    assert.ok(fetched.has(path), 'Expected asset was not requested: ' + path);
  }
  assert.deepEqual(problems, []);
  console.log('PASS desktop canvas, collect, pause/mute, full win, timeout loss, restart, and persisted best');
  console.log('PASS all expected local assets fetched; no failed requests, external assets, or browser errors');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
