import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  buildNavGrid,
  findGridPath,
  resolveCircleObstacles,
} from './npcNavigation';
import {
  generateParkingChallenge,
  getDailyChallengeSeed,
  verifyRouteExists,
} from './parkingGenerator';
import { evaluateBayPose } from './cartPhysicsMath';
import { getLevelById, LEVELS } from './levels';
import { computeOwnerReaction } from './ownerLogic';
import {
  OWNER_LEG_LENGTH,
  OWNER_RUN_STRIDE_LENGTH,
  OWNER_WALK_STRIDE_LENGTH,
  StoreOwnerCharacter,
  buildStoreOwner,
} from './ownerModel';
import {
  PEDESTRIAN_LEG_LENGTH,
  PEDESTRIAN_WALK_STRIDE_LENGTH,
  PedestrianCharacter,
  buildPedestrian,
} from './pedestrianModel';
import { computePlaybackTimeScale } from './characterAnimation';
import type { ObstacleSpec, ParkingScenarioType } from './types';

test('Owner A* navigation routes cleanly around solid parked cars and walls without clipping', () => {
  const obstacles: ObstacleSpec[] = [
    { id: 'car_wall_1', kind: 'car', x: 0, z: 0, yaw: 0, width: 2.0, length: 4.4, height: 1.5 },
    { id: 'car_wall_2', kind: 'car', x: 0, z: 4.6, yaw: 0, width: 2.0, length: 4.4, height: 1.5 },
  ];
  const grid = buildNavGrid(obstacles, 0.42, 0.65, true);
  const path = findGridPath(grid, -4.5, 2.0, 4.5, 2.0);

  assert.equal(path.found, true);
  assert.equal(path.blocked, false);
  assert.ok(path.waypoints.length >= 2, 'path should route around car barrier');

  // Verify no waypoint penetrates inside either car obstacle
  for (const wp of path.waypoints) {
    const resolved = resolveCircleObstacles(wp.x, wp.z, 0.35, obstacles, [], true);
    assert.equal(resolved.collided, false, `waypoint (${wp.x}, ${wp.z}) should be collision-free`);
  }
});

test('resolveCircleObstacles prevents clipping through cars and respects open-front corral', () => {
  const car: ObstacleSpec = {
    id: 'c1',
    kind: 'car',
    x: 2,
    z: 2,
    yaw: 0,
    width: 1.9,
    length: 4.1,
    height: 1.45,
  };
  const insideCar = resolveCircleObstacles(2.1, 2.1, 0.38, [car], [], true);
  assert.equal(insideCar.collided, true);
  // Push-out should leave position outside car X bounds
  assert.ok(
    Math.abs(insideCar.x - car.x) >= car.width / 2 + 0.35 ||
      Math.abs(insideCar.z - car.z) >= car.length / 2 + 0.35
  );

  const corral: ObstacleSpec = {
    id: 'corral1',
    kind: 'corral',
    x: 8,
    z: 8,
    yaw: 0,
    width: 2.4,
    length: 3.4,
    height: 1.1,
  };
  // Center inside open corral bay should NOT be treated as solid block
  const insideOpenCorral = resolveCircleObstacles(8, 8.3, 0.34, [corral], [], true);
  assert.equal(insideOpenCorral.collided, false);
});

test('A* navigation reports blocked=true when destination is completely walled off', () => {
  const boxWall: ObstacleSpec[] = [
    { id: 'w1', kind: 'barrier', x: 0, z: 12, yaw: 0, width: 5, length: 0.6, height: 1.2 },
    { id: 'w2', kind: 'barrier', x: 0, z: 16, yaw: 0, width: 5, length: 0.6, height: 1.2 },
    { id: 'w3', kind: 'barrier', x: -2.4, z: 14, yaw: Math.PI / 2, width: 4.4, length: 0.6, height: 1.2 },
    { id: 'w4', kind: 'barrier', x: 2.4, z: 14, yaw: Math.PI / 2, width: 4.4, length: 0.6, height: 1.2 },
  ];
  const grid = buildNavGrid(boxWall, 0.42, 0.65, true);
  const path = findGridPath(grid, -8, 14, 0, 14);
  assert.equal(path.found, false);
  assert.equal(path.blocked, true);
});

test('parkingGenerator creates valid reachable challenges for all 7 scenarios and avoids recent bays', () => {
  const scenarios: ParkingScenarioType[] = [
    'easy',
    'normal',
    'tight',
    'awkward',
    'reverse',
    'chaos',
    'impossible',
  ];

  const recent: string[] = [];
  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i];
    const lvl = generateParkingChallenge({
      seed: 9000 + i * 31,
      scenario,
      recentBayIds: recent,
    });

    assert.ok(lvl.bayId);
    assert.ok(!recent.includes(lvl.bayId!), 'should not repeat recent bay');
    recent.push(lvl.bayId!);

    assert.ok(
      verifyRouteExists(lvl.obstacles, lvl.spawn.x, lvl.spawn.z, lvl.bay.x, lvl.bay.z, 0.56),
      `route should exist for scenario ${scenario}`
    );

    if (scenario === 'reverse') {
      assert.equal(lvl.bay.requireReverse, true);
    }
  }

  // Daily challenge seed determinism
  const d1 = getDailyChallengeSeed(new Date('2026-05-01T10:00:00Z'));
  const d2 = getDailyChallengeSeed(new Date('2026-05-01T22:00:00Z'));
  assert.equal(d1, d2);
});

test('evaluateBayPose enforces exact facing direction when requireReverse is true', () => {
  const reverseBay = { x: 0, z: 0, yaw: Math.PI / 2, width: 1.8, length: 2.7, requireReverse: true };
  const aligned = evaluateBayPose(0, 0, Math.PI / 2, reverseBay);
  assert.equal(aligned.inBounds, true);

  const wrongWay = evaluateBayPose(0, 0, -Math.PI / 2, reverseBay);
  assert.equal(wrongWay.inBounds, false);
  assert.ok(wrongWay.angleErrorDeg > 170);
});

test('ownerLogic supports new crash_car, escaped, and blocked triggers', () => {
  const carHit = computeOwnerReaction('crash_car', 55, [], 1);
  assert.equal(carHit.shouldApproach, true);
  assert.ok(carHit.dialogue.length > 5);

  const escaped = computeOwnerReaction('escaped', 75, [], 2);
  assert.equal(escaped.anim, 'point');
  assert.equal(escaped.shouldApproach, true);

  const blocked = computeOwnerReaction('blocked', 60, [], 0);
  assert.equal(blocked.anim, 'angry_gesture');
  assert.equal(blocked.shouldApproach, false);
});

test('sequential rounds always relocate parking target, vary orientation, and remain reachable', () => {
  let prev = {
    x: LEVELS[0].bay.x,
    z: LEVELS[0].bay.z,
    yaw: LEVELS[0].bay.yaw,
    bayId: LEVELS[0].bayId,
  };
  const recent: string[] = [];
  const uniqueYaws = new Set<number>();

  for (let round = 2; round <= 8; round++) {
    const levelId = round <= 6 ? round : 7;
    const lvl = getLevelById(levelId, 5000 + round * 997, recent, prev, true);
    const distFromPrev = Math.hypot(lvl.bay.x - prev.x, lvl.bay.z - prev.z);

    assert.ok(distFromPrev >= 8.0, `Round ${round} bay should move >=8m (got ${distFromPrev.toFixed(2)}m)`);
    assert.notEqual(lvl.bayId, prev.bayId, `Round ${round} bayId should differ from previous`);
    assert.ok(
      verifyRouteExists(lvl.obstacles, lvl.spawn.x, lvl.spawn.z, lvl.bay.x, lvl.bay.z, 0.56),
      `Round ${round} target must be reachable`
    );

    uniqueYaws.add(Number(lvl.bay.yaw.toFixed(2)));
    if (lvl.bayId) recent.unshift(lvl.bayId);
    prev = { x: lvl.bay.x, z: lvl.bay.z, yaw: lvl.bay.yaw, bayId: lvl.bayId };
  }

  assert.ok(uniqueYaws.size >= 3, `Expected >=3 distinct bay orientations across rounds, got ${uniqueYaws.size}`);
});

test('Owner AnimationMixer calibrates walk/run timeScale to movement speed and prevents foot sliding', () => {
  const rig = buildStoreOwner(new THREE.CanvasTexture());
  const owner = rig.character ?? new StoreOwnerCharacter(rig);
  assert.ok(owner.mixer instanceof THREE.AnimationMixer);

  const walkSpeed = 1.05;
  const runSpeed = 2.35;
  const dt = 0.016;

  // Let blend settle cleanly onto walk
  for (let i = 0; i < 60; i++) {
    owner.update('walk', 'neutral', walkSpeed, dt);
  }
  const walkScale = owner.getPlaybackTimeScale('walk');
  assert.ok(
    Math.abs(walkScale - computePlaybackTimeScale(walkSpeed, OWNER_WALK_STRIDE_LENGTH)) < 1e-6,
    `Expected walk timeScale=${walkSpeed / OWNER_WALK_STRIDE_LENGTH}, got ${walkScale}`
  );
  // Natural human walk cadence (~1.7 - 2.4 steps/s -> 0.85 - 1.25 cycles/s)
  assert.ok(walkScale > 0.8 && walkScale < 1.25, `Unexpected walk cadence timeScale=${walkScale}`);

  // Measure planted foot horizontal displacement over the mid-stance window (left foot on ground)
  owner.actions.walk.time = 0.05;
  owner.mixer.update(0);
  const soleLocal = new THREE.Vector3(0, -OWNER_LEG_LENGTH, 0);
  const pStart = soleLocal.clone().applyMatrix4(rig.leftLegPivot.matrixWorld);
  rig.root.updateMatrixWorld(true);
  pStart.copy(soleLocal).applyMatrix4(rig.leftLegPivot.matrixWorld);

  const stanceWindowSec = 0.35;
  const steps = 20;
  for (let i = 0; i < steps; i++) {
    owner.update('walk', 'neutral', walkSpeed, stanceWindowSec / steps);
  }
  rig.root.updateMatrixWorld(true);
  const pEnd = soleLocal.clone().applyMatrix4(rig.leftLegPivot.matrixWorld);

  // Planted foot sweeps backward (-Z) at exact walkSpeed (zero asphalt slip) and stays grounded (y ~ 0.01m)
  const footBackwardTravel = pStart.z - pEnd.z;
  const expectedTravel = walkSpeed * stanceWindowSec;
  assert.ok(
    Math.abs(footBackwardTravel - expectedTravel) < 0.025,
    `Owner foot slide detected: swept ${footBackwardTravel.toFixed(3)}m vs expected ${expectedTravel.toFixed(3)}m`
  );
  assert.ok(
    pEnd.y >= 0.0 && pEnd.y <= 0.03,
    `Owner planted sole should stay flush on ground, got y=${pEnd.y.toFixed(4)}m`
  );

  // Run cadence scales smoothly above walk cadence without exceeding human sprint limits
  for (let i = 0; i < 60; i++) {
    owner.update('run', 'furious', runSpeed, dt);
  }
  const runScale = owner.getPlaybackTimeScale('run');
  assert.ok(
    Math.abs(runScale - computePlaybackTimeScale(runSpeed, OWNER_RUN_STRIDE_LENGTH)) < 1e-6
  );
  assert.ok(runScale > walkScale && runScale < 1.65, `Unexpected run timeScale=${runScale}`);

  // Idle stops leg swing and keeps breathing sway calm
  for (let i = 0; i < 60; i++) {
    owner.update('idle', 'neutral', 0, dt);
  }
  assert.equal(owner.getPlaybackTimeScale('walk'), 0);
  assert.ok(Math.abs(rig.torsoPivot.rotation.x) < 0.03);
});

test('Pedestrian AnimationMixer matches walk and push_walk timeScale to movement speed without foot sliding', () => {
  const pedRig = buildPedestrian(new THREE.CanvasTexture(), 0x06b6d4);
  const ped = pedRig.character ?? new PedestrianCharacter(pedRig);
  assert.ok(ped.mixer instanceof THREE.AnimationMixer);

  const pedSpeed = 1.15;
  const dt = 0.016;
  for (let i = 0; i < 60; i++) {
    ped.update(pedSpeed, dt, false);
  }
  const walkScale = ped.getPlaybackTimeScale('walk');
  assert.ok(
    Math.abs(walkScale - computePlaybackTimeScale(pedSpeed, PEDESTRIAN_WALK_STRIDE_LENGTH)) < 1e-6
  );
  assert.ok(walkScale > 0.9 && walkScale < 1.35, `Unexpected ped walk timeScale=${walkScale}`);

  // Check zero foot sliding during left-leg stance phase
  ped.actions.walk.time = 0.05;
  ped.mixer.update(0);
  pedRig.root.updateMatrixWorld(true);
  const soleLocal = new THREE.Vector3(0, -PEDESTRIAN_LEG_LENGTH, 0);
  const pStart = soleLocal.clone().applyMatrix4(pedRig.leftLeg.matrixWorld);

  const stanceWindowSec = 0.35;
  for (let i = 0; i < 20; i++) {
    ped.update(pedSpeed, stanceWindowSec / 20, false);
  }
  pedRig.root.updateMatrixWorld(true);
  const pEnd = soleLocal.clone().applyMatrix4(pedRig.leftLeg.matrixWorld);

  const footBackwardTravel = pStart.z - pEnd.z;
  const expectedTravel = pedSpeed * stanceWindowSec;
  assert.ok(
    Math.abs(footBackwardTravel - expectedTravel) < 0.025,
    `Pedestrian foot slide detected: swept ${footBackwardTravel.toFixed(3)}m vs expected ${expectedTravel.toFixed(3)}m`
  );
  assert.ok(
    pEnd.y >= -0.005 && pEnd.y <= 0.025,
    `Pedestrian planted sole should stay grounded, got y=${pEnd.y.toFixed(4)}m`
  );

  // Pushing a cart switches to push_walk with arms reaching forward and identical zero-slip timeScale
  for (let i = 0; i < 60; i++) {
    ped.update(1.0, dt, true);
  }
  assert.equal(ped.activeState, 'push_walk');
  assert.ok(
    Math.abs(ped.getPlaybackTimeScale('push_walk') - 1.0 / PEDESTRIAN_WALK_STRIDE_LENGTH) < 1e-6
  );
  assert.ok(pedRig.leftArm.rotation.x < -0.8, 'Pushing shopper should hold arms forward on handlebar');
});
