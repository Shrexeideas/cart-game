import type { CartHandlingProfile, InputState, ParkingZoneSpec } from './types';
import { CART_LENGTH, CART_WIDTH } from './levels';

export interface CasterState {
  leftAngle: number;
  rightAngle: number;
  steerSmoothed: number;
  wobblePhase: number;
}

export interface CartForcesOutput {
  forceX: number;
  forceZ: number;
  torqueY: number;
  signedForwardSpeed: number;
  lateralSpeed: number;
}

export function clampAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function expDamp(current: number, target: number, rate: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}

/**
 * Computes realistic shopping cart caster swivel + delayed handle response + reverse jackknife dynamics.
 * Forward in local cart space is +Z when yaw = 0:
 *   forwardVec = (sin(yaw), cos(yaw))
 *   rightVec   = (-cos(yaw), sin(yaw))  [right-handed Y-up: +yaw turns left/CCW]
 */
export function stepCartDynamics(
  state: CasterState,
  yaw: number,
  vx: number,
  vz: number,
  angVelY: number,
  input: InputState,
  handling: CartHandlingProfile,
  dt: number,
  events: { wobbleActive: boolean; reverseDriftActive: boolean; curbSnagActive: boolean }
): CartForcesOutput {
  const sinY = Math.sin(yaw);
  const cosY = Math.cos(yaw);

  // Forward (+local Z) and Right (-local X in Three.js Y-up when +yaw is CCW/left)
  const fwdX = sinY;
  const fwdZ = cosY;
  const rightX = -cosY;
  const rightZ = sinY;

  const signedForwardSpeed = vx * fwdX + vz * fwdZ;
  const lateralSpeed = vx * rightX + vz * rightZ;
  const speed = Math.hypot(vx, vz);

  // Delayed steering input (you can't instantly whip a heavy loaded cart)
  const rawSteer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  state.steerSmoothed = expDamp(state.steerSmoothed, rawSteer, handling.casterLagRate, dt);

  // Advance wheel wobble oscillator
  state.wobblePhase += dt * (events.wobbleActive ? 26 : 11);
  const wobbleFactor = events.wobbleActive
    ? Math.max(0.85, handling.wobbleAmplitude)
    : handling.wobbleAmplitude;

  // Caster swivel targets:
  // When pushing forward, casters align with velocity + steer offset.
  // When reversing, front casters flip toward trailing direction and jitter!
  const isReversing = signedForwardSpeed < -0.15 || (input.backward && !input.forward);
  const speedFactor = Math.min(1, speed / 1.8);
  const wobbleOffset =
    Math.sin(state.wobblePhase) * wobbleFactor * 0.48 * Math.min(1, 0.25 + speedFactor);

  let targetLeftCaster = state.steerSmoothed * 0.55 + wobbleOffset;
  let targetRightCaster =
    state.steerSmoothed * 0.55 + handling.badWheelPull * 0.32 + wobbleOffset * 0.4;

  if (isReversing) {
    // Casters swing wide/awkwardly when backing up
    targetLeftCaster = Math.PI * 0.82 * Math.sign(targetLeftCaster || 1) - state.steerSmoothed * 0.65 + wobbleOffset;
    targetRightCaster = Math.PI * 0.82 * Math.sign(targetRightCaster || -1) - state.steerSmoothed * 0.65;
  }

  const swivelRate = isReversing ? handling.casterLagRate * 0.72 : handling.casterLagRate * 1.35;
  state.leftAngle = expDamp(state.leftAngle, targetLeftCaster, swivelRate, dt);
  state.rightAngle = expDamp(state.rightAngle, targetRightCaster, swivelRate, dt);

  // Longitudinal push/reverse force
  let drive = 0;
  if (input.forward && !input.brake) {
    drive += handling.pushForce;
  }
  if (input.backward && !input.brake) {
    drive -= handling.reverseForce;
  }

  // Emergency brake resists all motion strongly; stationary idle on level ground settles cleanly without jitter
  const noDriveInput = !input.forward && !input.backward;
  const slopeMag = Math.hypot(handling.slopeX, handling.slopeZ);
  const isFlatSettle = noDriveInput && !input.brake && speed < 0.08 && slopeMag < 0.25;

  const brakeDrag = input.brake ? 11.5 : isFlatSettle ? 4.2 : 1.1;

  // Lateral grip drops sharply when reversing or during reverse drift event
  const activeLateralGrip =
    handling.lateralGrip *
    (isReversing ? Math.max(0.32, 1 - handling.reverseInstability * 0.55) : 1.0) *
    (events.reverseDriftActive ? 0.35 : 1.0);

  // Local forces -> world forces
  const localForwardForce =
    drive - signedForwardSpeed * brakeDrag * (input.brake ? 1.85 : isFlatSettle ? 1.0 : 0.45);
  const localLateralForce = -lateralSpeed * activeLateralGrip * (input.brake ? 1.95 : isFlatSettle ? 1.4 : 1.0);

  // Curb snag adds brief resistance and slight kick
  const snagDrag = events.curbSnagActive ? 0.45 : 1.0;

  // On flat level ground when nearly motionless without drive input, suppress sub-threshold micro-drift
  const effectiveSlopeX = isFlatSettle ? 0 : handling.slopeX * 14;
  const effectiveSlopeZ = isFlatSettle ? 0 : handling.slopeZ * 14;

  // Combine with slope gravity
  const forceX =
    (fwdX * localForwardForce + rightX * localLateralForce) * snagDrag + effectiveSlopeX;
  const forceZ =
    (fwdZ * localForwardForce + rightZ * localLateralForce) * snagDrag + effectiveSlopeZ;

  // Yaw torque:
  // 1) Handle push steering torque (scales with push/speed so you can pivot, plus slight stationary pivot)
  const moveAuthority = 0.42 + 0.58 * Math.min(1, speed / 2.2);
  const steerDir = input.backward && !input.forward && signedForwardSpeed < -0.1 ? -1 : 1;
  const steerTorque = state.steerSmoothed * handling.steerTorque * moveAuthority * steerDir;

  // 2) Bad front-right/left wheel pull + wobble shimmy torque (zeroed at rest so stationary carts don't shiver)
  const speedRamp = speed > 0.06 ? Math.min(1, speed / 1.5) : 0;
  const badWheelTorque =
    -handling.badWheelPull * 3.4 * speedRamp * (isReversing ? -1.25 : 1);
  const wobbleTorque =
    Math.sin(state.wobblePhase * 1.15) *
    wobbleFactor *
    (events.wobbleActive ? 4.2 : 1.35) *
    (speed > 0.06 ? Math.min(1, speed / 1.2) : 0);

  // 3) Reverse instability (jackknife amplification when angular velocity builds in reverse)
  const reverseJackknife = isReversing
    ? angVelY * handling.reverseInstability * 1.45 * Math.min(1, Math.abs(signedForwardSpeed) / 1.5)
    : 0;

  // 4) Angular damping (higher when braking or settling at rest)
  const angDampRate = input.brake ? 9.5 : isFlatSettle && !input.left && !input.right ? 6.8 : 3.4;
  const angDampingTorque = -angVelY * angDampRate;

  const torqueY =
    steerTorque + badWheelTorque + wobbleTorque + reverseJackknife + angDampingTorque;

  return {
    forceX,
    forceZ,
    torqueY,
    signedForwardSpeed,
    lateralSpeed,
  };
}

export interface BayPoseMetrics {
  centerDistance: number;
  angleErrorDeg: number;
  containmentPct: number;
  inBounds: boolean;
  alignmentPct: number;
}

/**
 * Evaluates how accurately the cart sits inside the painted parking bay.
 * Parallel parking allows facing either +bayYaw or +bayYaw + PI (either parallel direction).
 */
export function evaluateBayPose(
  cartX: number,
  cartZ: number,
  cartYaw: number,
  bay: ParkingZoneSpec
): BayPoseMetrics {
  const dx = cartX - bay.x;
  const dz = cartZ - bay.z;
  const centerDistance = Math.hypot(dx, dz);

  // Transform cart corners into bay-local coordinates:
  // bay forward (+Z in bay space): (sin(bay.yaw), cos(bay.yaw))
  // bay right (+X in bay space): (-cos(bay.yaw), sin(bay.yaw))
  const bSin = Math.sin(bay.yaw);
  const bCos = Math.cos(bay.yaw);

  const halfBayL = bay.length / 2;
  const halfBayW = bay.width / 2;

  const cSin = Math.sin(cartYaw);
  const cCos = Math.cos(cartYaw);
  const halfCartL = CART_LENGTH / 2;
  const halfCartW = CART_WIDTH / 2;

  const localCorners = [
    { lx: -halfCartW, lz: -halfCartL },
    { lx: halfCartW, lz: -halfCartL },
    { lx: halfCartW, lz: halfCartL },
    { lx: -halfCartW, lz: halfCartL },
  ];

  let cornersInside = 0;
  let maxOverhang = 0;

  for (const c of localCorners) {
    // World offset from cart center
    const wx = cartX + (-cCos * c.lx + cSin * c.lz);
    const wz = cartZ + (cSin * c.lx + cCos * c.lz);

    const relX = wx - bay.x;
    const relZ = wz - bay.z;

    const bayLocalW = relX * -bCos + relZ * bSin;
    const bayLocalL = relX * bSin + relZ * bCos;

    const overW = Math.max(0, Math.abs(bayLocalW) - halfBayW);
    const overL = Math.max(0, Math.abs(bayLocalL) - halfBayL);
    const overhang = Math.hypot(overW, overL);
    maxOverhang = Math.max(maxOverhang, overhang);
    if (overW <= 0.04 && overL <= 0.04) {
      cornersInside++;
    }
  }

  // Parallel alignment: either 0° or 180° relative to bay axis unless requireReverse enforces exact bay facing
  const rawDiff = Math.abs(clampAngle(cartYaw - bay.yaw));
  const parallelDiff = bay.requireReverse ? rawDiff : Math.min(rawDiff, Math.abs(Math.PI - rawDiff));
  const angleErrorDeg = (parallelDiff * 180) / Math.PI;

  const containmentPct = Math.max(
    0,
    Math.min(100, (cornersInside / 4) * 100 - maxOverhang * 45)
  );
  const inBounds = cornersInside === 4 && angleErrorDeg <= 24;

  // Combined live alignment percentage
  const distScore = Math.max(0, 1 - centerDistance / Math.max(halfBayL, 1.2));
  const angleScore = Math.max(0, 1 - angleErrorDeg / 35);
  const alignmentPct = Math.round(
    Math.max(0, Math.min(100, (containmentPct * 0.5 + distScore * 30 + angleScore * 20)))
  );

  return {
    centerDistance,
    angleErrorDeg,
    containmentPct,
    inBounds,
    alignmentPct,
  };
}
