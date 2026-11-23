import * as T from './vendor/three.module.min.js';
import { hazardX, PORTAL_RADIUS } from './logic.js';

const rand = seed => () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};

export function createView(canvas, reducedMotion) {
  const renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  const scene = new T.Scene();
  scene.fog = new T.FogExp2(0x252047, .012);
  scene.add(new T.HemisphereLight(0xe2d8ff, 0x372b6d, 2.2));
  const sun = new T.DirectionalLight(0xffc6bc, 2.55);
  sun.position.set(18, 23, -16);
  scene.add(sun);

  const camera = new T.PerspectiveCamera(53, 1, .2, 180);
  const ship = new T.Group();
  scene.add(ship);
  const basic = (color, extra) => new T.MeshBasicMaterial({ color, ...extra });
  const gem = new T.OctahedronGeometry(1);
  const material = (color, extra) => new T.MeshStandardMaterial({ color, flatShading: true, roughness: .78, ...extra });
  const sphere = new T.SphereGeometry(1, 20, 15);
  const point = new T.PointLight(0x6cffe4, 9, 13);
  ship.add(point);
  const mesh = (geometry, mat, parent, x, y, z, sx = 1, sy = sx, sz = sx) => {
    const item = new T.Mesh(geometry, mat);
    item.position.set(x, y, z);
    item.scale.set(sx, sy, sz);
    parent.add(item);
    return item;
  };
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = 64;
  const ctx = glowCanvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 1, 32, 32, 32);
  gradient.addColorStop(0, '#fffffffa');
  gradient.addColorStop(.22, '#ffffffba');
  gradient.addColorStop(.55, '#ffffff32');
  gradient.addColorStop(1, '#ffffff00');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const glowMap = new T.CanvasTexture(glowCanvas);
  const glow = (parent, color, size, opacity) => {
    const sprite = new T.Sprite(new T.SpriteMaterial({
      map: glowMap, color, opacity, transparent: true, depthWrite: false, blending: T.AdditiveBlending
    }));
    sprite.scale.set(size, size, 1);
    parent.add(sprite);
    return sprite;
  };
  const core = mesh(gem, basic(0xe7fff7), ship, 0, 0, 0, .46, .57, .77);
  const shell = mesh(gem, basic(0x6cffe4, { wireframe: true }), ship, 0, 0, 0, 1.05, .52, 1.23);
  glow(ship, 0x57ffd2, 4, .7);
  const ring = new T.TorusGeometry(1, .032, 7, 44);
  const orbit = mesh(ring, basic(0xaafbf3), ship, 0, 0, 0, .84, .84, .84);
  orbit.rotation.x = Math.PI / 2;

  const trailCount = 30;
  const trailPositions = new Float32Array(trailCount * 3);
  const trailGeometry = new T.BufferGeometry();
  trailGeometry.setAttribute('position', new T.BufferAttribute(trailPositions, 3));
  const trail = new T.Points(trailGeometry, new T.PointsMaterial({
    color: 0x7ffcda, size: .44, map: glowMap, transparent: true, depthWrite: false, opacity: .8,
    blending: T.AdditiveBlending
  }));
  trail.frustumCulled = false;
  scene.add(trail);

  const sky = new T.Group();
  scene.add(sky);
  const starRand = rand(2948);
  const positions = [];
  for (let i = 0; i < 780; i++) positions.push((starRand() - .5) * 180, starRand() * 68 - 19, -starRand() * 108 - 35);
  const starGeometry = new T.BufferGeometry();
  starGeometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  sky.add(new T.Points(starGeometry, new T.PointsMaterial({
    color: 0xd9cef9, size: .29, map: glowMap, opacity: .83, transparent: true, depthWrite: false, fog: false
  })));
  const moon = new T.Group();
  moon.position.set(27, 14, -81);
  sky.add(moon);
  mesh(sphere, material(0xdd77a0, { fog: false, emissive: 0x57224a, emissiveIntensity: .66 }), moon, 0, 0, 0, 8);
  glow(moon, 0xcb5d9c, 28, .57);
  const moonRing = mesh(ring, basic(0xf7b9c7, { fog: false, transparent: true, opacity: .57 }), moon, 0, 0, 0, 11);
  moonRing.rotation.set(-.94, .37, -.46);

  let terrain, shardViews, hazardViews, portal, portalRing, portalCore, portalGlow;
  let level, width = 0, height = 0;
  let cameraX = 0;
  const sparks = [];
  const fxRand = rand(4535);

  function disposeGroup(group) {
    const geometries = new Set();
    const materials = new Set();
    group.traverse(item => {
      if (item.geometry && ![gem, ring, sphere].includes(item.geometry)) geometries.add(item.geometry);
      if (item.material) (Array.isArray(item.material) ? item.material : [item.material]).forEach(mat => materials.add(mat));
    });
    geometries.forEach(g => g.dispose());
    materials.forEach(m => m.dispose());
    scene.remove(group);
  }

  function load(next, state) {
    if (terrain) disposeGroup(terrain);
    terrain = new T.Group();
    scene.add(terrain);
    level = next;
    shardViews = [];
    hazardViews = [];
    sparks.length = 0;
    cameraX = state.x;
    for (let i = 0; i < trailCount; i++) trailPositions.set([state.x, .1, -state.s], i * 3);
    const random = rand(1746 + state.level * 125);
    const dirt = [material(0x322855), material(0x3d305c), material(0x51416f), material(0x6d5687)];
    const top = [material(0x5b527b), material(0x78638c), material(0x5a436d)];
    const track = material(0x202642, { emissive: 0x181126 });
    const trim = basic(next.color, { transparent: true, opacity: .63 });
    const crystal = material(next.accent, { emissive: next.accent, emissiveIntensity: .23 });
    const box = new T.BoxGeometry(1, 1, 1);
    const rockVertices = Array.from({ length: 7 }, () => []);

    function island(x, y, z, radius, depth) {
      const points = [0, 0, 0, 0, -depth, 0];
      const faces = [];
      const n = 7;
      for (let j = 0; j < n; j++) {
        const angle = j * Math.PI * 2 / n + .15 * random();
        const r = radius * (.76 + random() * .32);
        points.push(Math.cos(angle) * r, -random() * .3, Math.sin(angle) * r);
        points.push(Math.cos(angle) * r * .68, -depth * (.35 + random() * .32), Math.sin(angle) * r * .68);
      }
      for (let j = 0; j < n; j++) {
        const a = 2 + j * 2, b = 2 + ((j + 1) % n) * 2;
        faces.push([0, b, a, 4 + j % 3], [a, b, a+1, j % 4], [b, b+1, a+1, (j+1) % 4], [a+1, b+1, 1, j % 4]);
      }
      faces.forEach(([a, b, c, mat]) => {
        for (const index of [a, b, c]) {
          rockVertices[mat].push(points[index * 3] + x, points[index * 3 + 1] + y, points[index * 3 + 2] + z);
        }
      });
    }

    for (let s = 0; s <= next.size + 7; s += 6) {
      mesh(box, track, terrain, 0, -1.68, -s, 18.6, .48, 5.53);
      for (const side of [-1, 1]) {
        mesh(box, trim, terrain, side * 8.9, -1.41, -s, .1, .044, 4.65);
        if (s % 12 === 0) {
          mesh(box, track, terrain, side * 9.1, -.64, -s, .34, 1.55, .34);
          mesh(box, trim, terrain, side * 9.1, .15, -s, .39, .09, .39);
        }
      }
      mesh(box, trim, terrain, 0, -1.428, -s, .08, .025, .66);
    }

    for (let s = 2; s < next.size + 40; s += 12) {
      island((random() - .5) * 3, -1.86, -s, 7.8 + random() * 2, 6.5);
      for (const side of [-1, 1]) {
        const x = side * (13 + random() * 7);
        const y = -2.4 + (random() - .4) * 5;
        const z = -s + (random() - .5) * 10;
        const size = 2.4 + random() * 4.5;
        island(x, y, z, size, 4 + random() * 5);
        for (let i = 0; i < 3; i++) {
          const growth = mesh(gem, crystal, terrain, x + (random() - .5) * size, y + .73, z + (random() - .5) * size, .33 + random() * .35, .8 + random() * 1.7, .5);
          growth.rotation.z = (random() - .5) * .65;
        }
        if (s % 24 === 2) island(side * (26 + random() * 10), -7 + random() * 12, z - 7, 5 + random() * 5, 6 + random() * 9);
      }
    }

    [...dirt, ...top].forEach((mat, i) => {
      const shape = new T.BufferGeometry();
      shape.setAttribute('position', new T.Float32BufferAttribute(rockVertices[i], 3));
      shape.computeVertexNormals();
      mesh(shape, mat, terrain, 0, 0, 0);
    });

    const shardMaterial = basic(next.color);
    const shardRing = new T.TorusGeometry(1, .035, 6, 22);
    next.shards.forEach(({ x, s }) => {
      const group = new T.Group();
      group.position.set(x, .12, -s);
      terrain.add(group);
      const jewel = mesh(gem, shardMaterial, group, 0, 0, 0, .45, .88, .45);
      mesh(gem, basic(0xf1fff9), jewel, 0, 0, 0, .51, 1.22, .51);
      mesh(shardRing, shardMaterial, group, 0, -.35, 0, .88).rotation.x = Math.PI / 2;
      glow(group, next.color, 3.7, .64);
      shardViews.push({ group, jewel });
    });
    const hazardMetal = material(0x65374e, { emissive: 0xe35479, emissiveIntensity: .35 });
    const hazardLight = basic(0xff8f8e);
    next.hazards.forEach(({ x, s, travel }) => {
      const group = new T.Group();
      group.position.set(x, .1, -s);
      terrain.add(group);
      const body = mesh(gem, hazardMetal, group, 0, 0, 0, 1.04, 1.23, 1.04);
      mesh(gem, basic(0xffa29c, { wireframe: true }), body, 0, 0, 0, 1.19, 1.16, 1.19);
      mesh(ring, hazardLight, group, 0, -.63, 0, 1.16).rotation.x = Math.PI / 2;
      glow(group, 0xff605d, 4, .44);
      if (travel) mesh(box, hazardLight, terrain, x, -1.33, -s, travel * 2, .036, .06);
      hazardViews.push({ group, body });
    });

    portal = new T.Group();
    portal.position.set(0, 1.12, -next.size);
    terrain.add(portal);
    mesh(new T.TorusGeometry(PORTAL_RADIUS, .27, 8, 44), track, portal, 0, 0, 0);
    portalRing = mesh(new T.TorusGeometry(PORTAL_RADIUS, .095, 8, 44), basic(0xc490ff), portal, 0, 0, .33);
    portalCore = mesh(new T.CircleGeometry(PORTAL_RADIUS - .24, 44), basic(0xc490ff, {
      side: T.DoubleSide, opacity: .17, transparent: true, depthWrite: false
    }), portal, 0, 0, .02);
    portalGlow = glow(portal, 0xba80ff, 12, .37);
    const gateMarks = new T.BoxGeometry(.19, .53, .14);
    for (let i = 0; i < 16; i++) {
      const a = i * Math.PI / 8;
      mesh(gateMarks, trim, portal, Math.sin(a) * 3.65, Math.cos(a) * 3.65, .19).rotation.z = -a;
    }
  }

  function burst(event) {
    if (reducedMotion) return;
    for (let i = 0; i < 12; i++) {
      const mat = basic(event.type === 'shard' ? level.color : 0xffa095, { transparent: true });
      const particle = mesh(gem, mat, terrain, event.x, 0, -event.s, .09 + fxRand() * .07);
      sparks.push({ particle, dx: (fxRand() - .5) * 6, dy: (fxRand() - .42) * 6, dz: (fxRand() - .5) * 6, life: .55 });
    }
  }

  function draw(state, visualTime, dt) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w !== width || h !== height) {
      width = w; height = h;
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
      renderer.setSize(w, h, false);
      camera.aspect = w / (h || 1);
      camera.fov = camera.aspect < 1 ? 65 : 53;
      camera.updateProjectionMatrix();
    }
    const intro = state.mode === 'ready';
    const narrow = (width / height) < 1;
    const menuOffset = intro && !narrow ? 8.5 : 0;
    cameraX += (state.x - cameraX) * Math.min(1, dt * 5);
    const drift = intro && !reducedMotion ? .6 * Math.sin(visualTime * .35) : 0;
    const focusX = narrow ? cameraX * .42 : cameraX - menuOffset;
    camera.position.set(focusX + drift, narrow ? 21 : 12.2, -state.s + (narrow ? 19 : 12.8));
    camera.lookAt(focusX, -.55, -state.s - (narrow ? 10.5 : 14.5));
    sky.position.z = -state.s;
    const bob = reducedMotion ? 0 : Math.sin(visualTime * 3) * .11;
    ship.position.set(state.x, .13 + bob, -state.s);
    ship.rotation.set(state.speed * .008, -state.vx * .029, -state.vx * .031);
    core.rotation.y = visualTime * .8;
    shell.rotation.y = -.65 * visualTime;
    orbit.rotation.y = .4 * Math.sin(visualTime * 2);
    shell.material.color.setHex(state.shield > 0 ? 0xffa295 : 0x6cffe4);

    trail.visible = !reducedMotion && state.mode === 'playing';
    if (trail.visible) {
      trailPositions.copyWithin(3, 0, (trailCount - 1) * 3);
      trailPositions.set([ship.position.x + .11 * Math.sin(visualTime * 35), ship.position.y, ship.position.z + .35]);
      trailGeometry.attributes.position.needsUpdate = true;
    }
    shardViews.forEach(({ group, jewel }, i) => {
      group.visible = !state.taken[i];
      group.position.y = .17 + (reducedMotion ? 0 : .19 * Math.sin(visualTime * 2.5 + i));
      jewel.rotation.y = visualTime * 1.5 + i;
    });
    hazardViews.forEach(({ group, body }, i) => {
      group.position.x = hazardX(level.hazards[i], state.elapsed);
      body.rotation.set(.17 * visualTime, visualTime * .85 + i, .2);
    });
    const open = state.shards >= level.need;
    portalRing.material.color.setHex(open ? 0x72fbdc : 0xc490ff);
    portalCore.material.color.copy(portalRing.material.color);
    portalCore.material.opacity = open ? .38 : .15;
    portalGlow.material.color.copy(portalRing.material.color);
    sparks.forEach(fx => {
      fx.life -= dt;
      fx.particle.position.x += fx.dx * dt;
      fx.particle.position.y += fx.dy * dt;
      fx.particle.position.z += fx.dz * dt;
      fx.particle.material.opacity = Math.max(0, fx.life * 1.8);
    });
    for (let i = sparks.length - 1; i >= 0; i--) {
      if (sparks[i].life > 0) continue;
      const { particle } = sparks[i];
      terrain.remove(particle);
      particle.material.dispose();
      sparks.splice(i, 1);
    }
    renderer.render(scene, camera);
    canvas.dataset.rendered = 'true';
  }

  return { load, draw, burst };
}
