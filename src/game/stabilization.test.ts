import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  type CasterState,
  stepCartDynamics,
} from './cartPhysicsMath';
import {
  OWNER_LEG_LENGTH,
  OWNER_WALK_STRIDE_LENGTH,
  StoreOwnerCharacter,
  buildStoreOwner,
} from './ownerModel';
import { computePlaybackTimeScale } from './characterAnimation';
import {
  DEFAULT_DRIFT_CONFIG,
  computeDriftPhysicsAdjustment,
  computeSlipAngleDeg,
  createInitialDriftTelemetry,
  stepDriftDetector,
} from './cartDrift';
import {
  EMBED_NAMESPACE,
  EMBED_PROTOCOL_VERSION,
  normalizeHttpOrigin,
  parseInboundEmbedCommand,
  resolveEmbedConfig,
} from './embedBridge';
import { computeOwnerReaction } from './ownerLogic';
import type { CartHandlingProfile, InputState } from './types';

const FLAT_HANDLING: CartHandlingProfile = {
  pushForce: 15.5,
  reverseForce: 10.5,
  maxSpeed: 5.4,
  steerTorque: 10.5,
  casterLagRate: 6.2,
  lateralGrip: 4.8,
  badWheelPull: 0.45,
  wobbleAmplitude: 0.55,
  reverseInstability: 0.5,
  slopeX: 0,
  slopeZ: 0,
};

const IDLE_INPUT: InputState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  brake: false,
};

test('stepCartDynamics eliminates idle vibration and creep on level ground while preserving slope roll', () => {
  const caster: CasterState = { leftAngle: 0.05, rightAngle: -0.04, steerSmoothed: 0, wobblePhase: 1.2 };
  const idleOut = stepCartDynamics(
    caster,
    0.4,
    0.015,
    0.01,
    0.008,
    IDLE_INPUT,
    FLAT_HANDLING,
    1 / 60,
    { wobbleActive: false, reverseDriftActive: false, curbSnagActive: false }
  );

  // Near-rest on level ground should resist tiny residual velocity rather than injecting wobble torque
  assert.ok(idleOut.torqueY * 0.008 < 0, 'angular damping should oppose tiny residual angular velocity at rest');
  assert.ok(Math.abs(idleOut.torqueY) < 0.1, `stationary torque should stay calm, got ${idleOut.torqueY}`);
  assert.ok(Math.hypot(idleOut.forceX, idleOut.forceZ) < 0.25, 'stationary force should not push cart forward');

  // With significant ramp slope, gravity roll remains active
  const slopedHandling: CartHandlingProfile = { ...FLAT_HANDLING, slopeX: 0.35, slopeZ: 0.2 };
  const slopeOut = stepCartDynamics(
    caster,
    0,
    0,
    0,
    0,
    IDLE_INPUT,
    slopedHandling,
    1 / 60,
    { wobbleActive: false, reverseDriftActive: false, curbSnagActive: false }
  );
  assert.ok(slopeOut.forceX > 4.0, 'sloped asphalt should still pull cart downhill');
});

test('Owner supports angry_walk, turn, and shocked states with velocity-synced cadence and zero foot slip', () => {
  const rig = buildStoreOwner(new THREE.CanvasTexture());
  const owner = rig.character ?? new StoreOwnerCharacter(rig);

  // Stage 1-2 car crash triggers shocked reaction
  const crash1 = computeOwnerReaction('crash_car', 20, [], 0);
  assert.equal(crash1.anim, 'shocked');

  // Angry walk scales identically to walk stride length and preserves zero foot slip
  const angrySpeed = 1.32;
  const dt = 0.016;
  for (let i = 0; i < 60; i++) {
    owner.update('angry_walk', 'angry', angrySpeed, dt);
  }
  const angryScale = owner.getPlaybackTimeScale('angry_walk');
  assert.ok(
    Math.abs(angryScale - computePlaybackTimeScale(angrySpeed, OWNER_WALK_STRIDE_LENGTH)) < 1e-6
  );

  owner.actions.angry_walk.time = 0.05;
  owner.mixer.update(0);
  rig.root.updateMatrixWorld(true);
  const soleLocal = new THREE.Vector3(0, -OWNER_LEG_LENGTH, 0);
  const pStart = soleLocal.clone().applyMatrix4(rig.leftLegPivot.matrixWorld);

  const stanceWindowSec = 0.32;
  for (let i = 0; i < 20; i++) {
    owner.update('angry_walk', 'angry', angrySpeed, stanceWindowSec / 20);
  }
  rig.root.updateMatrixWorld(true);
  const pEnd = soleLocal.clone().applyMatrix4(rig.leftLegPivot.matrixWorld);

  const footBackwardTravel = pStart.z - pEnd.z;
  const expectedTravel = angrySpeed * stanceWindowSec;
  assert.ok(
    Math.abs(footBackwardTravel - expectedTravel) < 0.025,
    `angry_walk foot slip: swept ${footBackwardTravel.toFixed(3)}m vs ${expectedTravel.toFixed(3)}m`
  );

  // Turn and shocked reactions settle cleanly at 1.0x cadence without freezing
  for (let i = 0; i < 30; i++) {
    owner.update('turn', 'annoyed', 0, dt);
  }
  assert.equal(owner.getPlaybackTimeScale('turn'), 1);

  for (let i = 0; i < 30; i++) {
    owner.update('shocked', 'shocked', 0, dt);
  }
  assert.equal(owner.getPlaybackTimeScale('shocked'), 1);
});

test('cartDrift module is inert when disabled and detects drift + multipliers when enabled', () => {
  assert.equal(DEFAULT_DRIFT_CONFIG.enabled, false);

  const init = createInitialDriftTelemetry();
  const inert = stepDriftDetector(
    init,
    { forward: true, left: true, right: false, brake: true },
    { signedForwardSpeed: 4.2, lateralSpeed: 2.1, angularVelocityY: 1.5 },
    DEFAULT_DRIFT_CONFIG,
    1 / 60
  );
  assert.equal(inert.active, false);
  assert.equal(inert.state, 'none');
  const inertAdj = computeDriftPhysicsAdjustment(inert, DEFAULT_DRIFT_CONFIG);
  assert.equal(inertAdj.rearLateralGripMultiplier, 1);
  assert.equal(inertAdj.steerTorqueMultiplier, 1);
  assert.equal(inertAdj.trailingFrictionMultiplier, 1);

  const slip = computeSlipAngleDeg(3.0, 3.0);
  assert.ok(Math.abs(slip - 45) < 0.2);

  const enabledCfg = { ...DEFAULT_DRIFT_CONFIG, enabled: true };
  let tel = init;
  for (let i = 0; i < 35; i++) {
    tel = stepDriftDetector(
      tel,
      { forward: true, left: true, right: false, brake: false },
      { signedForwardSpeed: 3.6, lateralSpeed: 1.8, angularVelocityY: 1.9 },
      enabledCfg,
      1 / 60
    );
  }
  assert.equal(tel.active, true);
  assert.equal(tel.state, 'drifting');
  assert.ok(tel.accumulatedDriftScore > 0);
  const activeAdj = computeDriftPhysicsAdjustment(tel, enabledCfg);
  assert.ok(activeAdj.rearLateralGripMultiplier < 1.0);
  assert.ok(activeAdj.steerTorqueMultiplier > 1.0);
});

test('embedBridge enforces strict HTTP/HTTPS origin allowlist and validates inbound commands', () => {
  assert.equal(normalizeHttpOrigin('*'), null);
  assert.equal(normalizeHttpOrigin('null'), null);
  assert.equal(normalizeHttpOrigin('javascript:alert(1)'), null);
  assert.equal(normalizeHttpOrigin('https://nova.example.com/games/cart'), 'https://nova.example.com');

  const cfg = resolveEmbedConfig({
    search: '?embed=1&autostart=1&level=3&hostOrigin=https%3A%2F%2Fnova.example.com',
    currentOrigin: 'https://cart-chaos.pages.dev',
    envAllowedOrigins: 'https://nova.example.com,https://staging.nova.example.com',
    isFramed: true,
  });

  assert.equal(cfg.isEmbed, true);
  assert.equal(cfg.autostart, true);
  assert.equal(cfg.initialLevelId, 3);
  assert.equal(cfg.targetOrigin, 'https://nova.example.com');

  const validCmd = parseInboundEmbedCommand(
    {
      namespace: EMBED_NAMESPACE,
      version: EMBED_PROTOCOL_VERSION,
      type: 'NOVA_START_LEVEL',
      payload: { levelId: 5 },
    },
    'https://nova.example.com',
    cfg.allowedOrigins
  );
  assert.ok(validCmd);
  assert.equal(validCmd?.type, 'NOVA_START_LEVEL');
  assert.equal(validCmd?.payload?.levelId, 5);

  const untrusted = parseInboundEmbedCommand(
    {
      namespace: EMBED_NAMESPACE,
      version: EMBED_PROTOCOL_VERSION,
      type: 'NOVA_PAUSE',
    },
    'https://evil.example.net',
    cfg.allowedOrigins
  );
  assert.equal(untrusted, null);

  const wrongVersion = parseInboundEmbedCommand(
    {
      namespace: EMBED_NAMESPACE,
      version: 99,
      type: 'NOVA_PAUSE',
    },
    'https://nova.example.com',
    cfg.allowedOrigins
  );
  assert.equal(wrongVersion, null);
});
