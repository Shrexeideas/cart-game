import test from 'node:test';
import assert from 'node:assert/strict';
import {
  stepCartDynamics,
  evaluateBayPose,
  type CasterState,
} from './cartPhysicsMath';
import { LEVELS, generateRandomLevel } from './levels';

test('caster steering exhibits delayed response and swivel lag', () => {
  const state: CasterState = {
    leftAngle: 0,
    rightAngle: 0,
    steerSmoothed: 0,
    wobblePhase: 0,
  };
  const handling = LEVELS[0].handling;
  const input = { forward: true, backward: false, left: true, right: false, brake: false };

  // First tiny step: steerSmoothed does NOT snap immediately to 1.0
  stepCartDynamics(state, 0, 0, 2, 0, input, handling, 0.016, {
    wobbleActive: false,
    reverseDriftActive: false,
    curbSnagActive: false,
  });
  assert.ok(state.steerSmoothed > 0 && state.steerSmoothed < 0.25, 'steering should ramp smoothly');

  // After multiple steps, casters swivel further
  for (let i = 0; i < 30; i++) {
    stepCartDynamics(state, 0, 0, 2, 0, input, handling, 0.016, {
      wobbleActive: false,
      reverseDriftActive: false,
      curbSnagActive: false,
    });
  }
  assert.ok(state.steerSmoothed > 0.85, 'steering should converge after sustained hold');
  assert.ok(state.leftAngle > 0.3, 'front caster should swivel toward steer direction');
});

test('reversing introduces caster swing and instability torque', () => {
  const state: CasterState = {
    leftAngle: 0,
    rightAngle: 0,
    steerSmoothed: 0,
    wobblePhase: 0,
  };
  const handling = LEVELS[2].handling; // Terrible Wheels level
  const input = { forward: false, backward: true, left: true, right: false, brake: false };

  let lastOut = stepCartDynamics(state, 0, 0, -2.5, 0.6, input, handling, 0.016, {
    wobbleActive: false,
    reverseDriftActive: true,
    curbSnagActive: false,
  });
  for (let i = 0; i < 20; i++) {
    lastOut = stepCartDynamics(state, 0, 0, -2.5, 0.6, input, handling, 0.016, {
      wobbleActive: false,
      reverseDriftActive: true,
      curbSnagActive: false,
    });
  }
  assert.ok(lastOut.signedForwardSpeed < 0, 'signed forward speed should be negative when reversing');
  assert.ok(Math.abs(state.leftAngle) > 0.6, 'casters should swing wide in reverse');
});

test('bay pose evaluation scores centered parallel alignment near 100%', () => {
  const bay = LEVELS[0].bay;
  const perfect = evaluateBayPose(bay.x, bay.z, bay.yaw, bay);
  assert.equal(perfect.inBounds, true);
  assert.equal(perfect.angleErrorDeg, 0);
  assert.ok(perfect.alignmentPct >= 98);

  // Opposite parallel direction (180 degrees) is also valid parallel parking
  const flipped = evaluateBayPose(bay.x, bay.z, bay.yaw + Math.PI, bay);
  assert.equal(flipped.inBounds, true);
  assert.ok(flipped.angleErrorDeg < 0.01);

  // Crooked crab parking outside bounds
  const crab = evaluateBayPose(bay.x + 1.8, bay.z + 1.5, bay.yaw + 0.7, bay);
  assert.equal(crab.inBounds, false);
  assert.ok(crab.alignmentPct < 50);
});

test('random level generator creates deterministic valid layouts for a seed', () => {
  const lvlA = generateRandomLevel(4242);
  const lvlB = generateRandomLevel(4242);
  assert.deepEqual(lvlA, lvlB);
  assert.ok(lvlA.obstacles.length >= 3);
  assert.ok(lvlA.movingActors.length >= 1);
  assert.ok(lvlA.bay.width > 1.4 && lvlA.bay.length > 2.0);
});
