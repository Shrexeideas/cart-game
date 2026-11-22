import * as THREE from 'three';

export const GAIT_CLIP_DURATION = 1.0;

/**
 * Computes total distance traveled in one full 2-step stride cycle (left + right step).
 * Horizontal foot sweep during one stance phase is 2 * L * sin(swingAmp), so a full
 * 2-step stride covers 4 * L * sin(swingAmp) * flightFactor.
 */
export function computeStrideLength(
  legLength: number,
  swingAmplitudeRad: number,
  flightFactor = 1.0
): number {
  return 4 * legLength * Math.sin(swingAmplitudeRad) * flightFactor;
}

/**
 * Converts world horizontal movement speed (m/s) into Three.js AnimationAction.timeScale
 * so the character's stance foot travels backward relative to the hip at exact ground speed.
 */
export function computePlaybackTimeScale(
  speedMps: number,
  strideLength: number,
  clipDuration = GAIT_CLIP_DURATION
): number {
  if (speedMps <= 0 || strideLength <= 0) return 0;
  return (speedMps * clipDuration) / strideLength;
}

/**
 * Exact constant-ground-velocity leg pitch during stance (s in [0, 1]).
 * Negative rotation.x = leg swung forward (+Z), positive rotation.x = leg swung backward (-Z).
 * Foot local Z = -L * sin(alpha) becomes strictly linear in s: +L*sin(A) -> -L*sin(A),
 * eliminating foot sliding across the entire ground-contact phase.
 */
export function evaluateStanceLegAngle(s: number, swingAmplitudeRad: number): number {
  const clamped = Math.max(0, Math.min(1, s));
  const sinTarget = Math.sin(swingAmplitudeRad) * (2 * clamped - 1);
  return Math.asin(Math.max(-1, Math.min(1, sinTarget)));
}

/**
 * Smooth swing-leg recovery angle (w in [0, 1]) returning the lifted foot from +A to -A.
 */
export function evaluateSwingLegAngle(w: number, swingAmplitudeRad: number): number {
  const clamped = Math.max(0, Math.min(1, w));
  return swingAmplitudeRad * Math.cos(Math.PI * clamped);
}

export interface GaitSample {
  leftLegX: number;
  rightLegX: number;
  leftLegLiftY: number;
  rightLegLiftY: number;
  hipOffsetY: number;
}

/**
 * Evaluates a single normalized time u in [0, 1] of the gait cycle:
 * - [0.0, 0.5]: Left leg in stance, Right leg in swing
 * - [0.5, 1.0]: Right leg in stance, Left leg in swing
 */
export function sampleGaitCycle(
  u: number,
  legLength: number,
  swingAmplitudeRad: number,
  swingLiftY: number,
  flightBounceY = 0
): GaitSample {
  const phase = ((u % 1) + 1) % 1;
  let leftLegX: number;
  let rightLegX: number;
  let leftLegLiftY = 0;
  let rightLegLiftY = 0;
  let plantedAngle: number;

  if (phase < 0.5) {
    const t = phase * 2; // 0..1
    leftLegX = evaluateStanceLegAngle(t, swingAmplitudeRad);
    rightLegX = evaluateSwingLegAngle(t, swingAmplitudeRad);
    rightLegLiftY = swingLiftY * Math.sin(Math.PI * t);
    plantedAngle = leftLegX;
  } else {
    const t = (phase - 0.5) * 2; // 0..1
    rightLegX = evaluateStanceLegAngle(t, swingAmplitudeRad);
    leftLegX = evaluateSwingLegAngle(t, swingAmplitudeRad);
    leftLegLiftY = swingLiftY * Math.sin(Math.PI * t);
    plantedAngle = rightLegX;
  }

  // Drop hip by L * (1 - cos(plantedAngle)) so planted shoe stays flush on ground
  const stanceDrop = legLength * (1 - Math.cos(plantedAngle));
  // Subtle ballistic spring bounce for running around toe-off / flight transitions
  const bounce =
    flightBounceY > 0 ? flightBounceY * Math.pow(Math.abs(Math.sin(phase * Math.PI * 2)), 2) : 0;

  return {
    leftLegX,
    rightLegX,
    leftLegLiftY,
    rightLegLiftY,
    hipOffsetY: -stanceDrop + bounce,
  };
}

const _tmpEuler = new THREE.Euler(0, 0, 0, 'XYZ');
const _tmpQuat = new THREE.Quaternion();

export function eulerTrack(
  nodeName: string,
  times: number[],
  evalEuler: (t: number) => [number, number, number]
): THREE.QuaternionKeyframeTrack {
  const values: number[] = [];
  for (let i = 0; i < times.length; i++) {
    const [rx, ry, rz] = evalEuler(times[i]);
    _tmpEuler.set(rx, ry, rz, 'XYZ');
    _tmpQuat.setFromEuler(_tmpEuler);
    values.push(_tmpQuat.x, _tmpQuat.y, _tmpQuat.z, _tmpQuat.w);
  }
  return new THREE.QuaternionKeyframeTrack(`${nodeName}.quaternion`, times, values);
}

export function positionTrack(
  nodeName: string,
  times: number[],
  evalPos: (t: number) => [number, number, number]
): THREE.VectorKeyframeTrack {
  const values: number[] = [];
  for (let i = 0; i < times.length; i++) {
    const [x, y, z] = evalPos(times[i]);
    values.push(x, y, z);
  }
  return new THREE.VectorKeyframeTrack(`${nodeName}.position`, times, values);
}

export interface ActionBlendEntry {
  action: THREE.AnimationAction;
  weight: number;
}

/**
 * Smoothly blends weights across AnimationActions without crossFadeTo cancellation artifacts.
 */
export function blendMixerActions(
  entries: Record<string, ActionBlendEntry>,
  targetKey: string,
  blendRate: number,
  dt: number
): void {
  const alpha = 1 - Math.exp(-blendRate * Math.max(0, dt));
  let total = 0;

  for (const key of Object.keys(entries)) {
    const entry = entries[key];
    const target = key === targetKey ? 1 : 0;
    entry.weight += (target - entry.weight) * alpha;
    if (entry.weight < 0.0005) entry.weight = 0;
    total += entry.weight;
  }

  if (total <= 0) {
    entries[targetKey].weight = 1;
    total = 1;
  }

  for (const key of Object.keys(entries)) {
    const entry = entries[key];
    const w = entry.weight / total;
    entry.weight = w;
    entry.action.enabled = w > 0.0005;
    entry.action.setEffectiveWeight(w);
  }
}
