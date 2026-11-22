import type { InputState } from './types';

/**
 * Future Cart Drift Mode configuration.
 *
 * IMPORTANT: `enabled` defaults to `false` in the current release so standard
 * parallel-parking physics remain completely unchanged. When activated in a
 * future update, these parameters control rear-caster lateral slip, yaw
 * oversteer authority, and score combo multipliers.
 */
export interface DriftConfig {
  enabled: boolean;
  minActivationSpeedMps: number;
  minDriftAngleDeg: number;
  rearLateralGripScale: number;
  yawAuthorityScale: number;
  trailingFrictionScale: number;
  maxScoreMultiplier: number;
  minHoldSecForBonus: number;
}

export type DriftPhase = 'none' | 'initiating' | 'drifting' | 'recovering';

export interface DriftTelemetry {
  active: boolean;
  state: DriftPhase;
  driftAngleDeg: number;
  driftDurationSec: number;
  lateralSpeedMps: number;
  longitudinalSpeedMps: number;
  angularVelocityRadSec: number;
  scoreMultiplier: number;
  accumulatedDriftScore: number;
}

export interface DriftPhysicsAdjustment {
  rearLateralGripMultiplier: number;
  steerTorqueMultiplier: number;
  trailingFrictionMultiplier: number;
}

export const DEFAULT_DRIFT_CONFIG: DriftConfig = {
  enabled: false,
  minActivationSpeedMps: 2.35,
  minDriftAngleDeg: 14,
  rearLateralGripScale: 0.48,
  yawAuthorityScale: 1.28,
  trailingFrictionScale: 0.88,
  maxScoreMultiplier: 4.0,
  minHoldSecForBonus: 0.35,
};

export function createInitialDriftTelemetry(): DriftTelemetry {
  return {
    active: false,
    state: 'none',
    driftAngleDeg: 0,
    driftDurationSec: 0,
    lateralSpeedMps: 0,
    longitudinalSpeedMps: 0,
    angularVelocityRadSec: 0,
    scoreMultiplier: 1.0,
    accumulatedDriftScore: 0,
  };
}

/**
 * Computes slip angle in degrees between the cart's heading vector and velocity vector.
 */
export function computeSlipAngleDeg(
  forwardSpeedMps: number,
  lateralSpeedMps: number
): number {
  const speed = Math.hypot(forwardSpeedMps, lateralSpeedMps);
  if (speed < 0.08) return 0;
  const rad = Math.atan2(Math.abs(lateralSpeedMps), Math.max(0.05, Math.abs(forwardSpeedMps)));
  return (rad * 180) / Math.PI;
}

/**
 * Pure drift state detector & telemetry updater.
 * When `config.enabled` is false, immediately returns inert telemetry so
 * standard parking behavior cannot be altered.
 */
export function stepDriftDetector(
  prev: DriftTelemetry,
  input: Pick<InputState, 'forward' | 'left' | 'right' | 'brake'>,
  motion: {
    signedForwardSpeed: number;
    lateralSpeed: number;
    angularVelocityY: number;
  },
  config: DriftConfig,
  dt: number
): DriftTelemetry {
  if (!config.enabled) {
    return createInitialDriftTelemetry();
  }

  const speed = Math.hypot(motion.signedForwardSpeed, motion.lateralSpeed);
  const slipDeg = computeSlipAngleDeg(motion.signedForwardSpeed, motion.lateralSpeed);
  const hasSteer = input.left !== input.right;
  const isInitiating =
    motion.signedForwardSpeed >= config.minActivationSpeedMps &&
    hasSteer &&
    (input.brake || slipDeg >= config.minDriftAngleDeg * 0.65);
  const isSustaining =
    speed >= config.minActivationSpeedMps * 0.72 &&
    slipDeg >= config.minDriftAngleDeg &&
    motion.signedForwardSpeed > 0.25;

  if (isSustaining) {
    const nextDuration = prev.driftDurationSec + dt;
    const rawMult = 1 + Math.floor(nextDuration / 0.8) * 0.5;
    const scoreMultiplier = Math.min(config.maxScoreMultiplier, rawMult);
    const earned =
      nextDuration >= config.minHoldSecForBonus
        ? Math.round(dt * 120 * scoreMultiplier)
        : 0;
    return {
      active: true,
      state: nextDuration >= 0.14 ? 'drifting' : 'initiating',
      driftAngleDeg: Math.round(slipDeg),
      driftDurationSec: nextDuration,
      lateralSpeedMps: motion.lateralSpeed,
      longitudinalSpeedMps: motion.signedForwardSpeed,
      angularVelocityRadSec: motion.angularVelocityY,
      scoreMultiplier,
      accumulatedDriftScore: prev.accumulatedDriftScore + earned,
    };
  }

  if (isInitiating) {
    return {
      active: true,
      state: 'initiating',
      driftAngleDeg: Math.round(slipDeg),
      driftDurationSec: prev.driftDurationSec + dt,
      lateralSpeedMps: motion.lateralSpeed,
      longitudinalSpeedMps: motion.signedForwardSpeed,
      angularVelocityRadSec: motion.angularVelocityY,
      scoreMultiplier: prev.scoreMultiplier,
      accumulatedDriftScore: prev.accumulatedDriftScore,
    };
  }

  if (prev.active && prev.state !== 'recovering' && slipDeg >= 6) {
    return {
      ...prev,
      active: false,
      state: 'recovering',
      driftAngleDeg: Math.round(slipDeg),
      lateralSpeedMps: motion.lateralSpeed,
      longitudinalSpeedMps: motion.signedForwardSpeed,
      angularVelocityRadSec: motion.angularVelocityY,
    };
  }

  return {
    active: false,
    state: 'none',
    driftAngleDeg: Math.round(slipDeg),
    driftDurationSec: 0,
    lateralSpeedMps: motion.lateralSpeed,
    longitudinalSpeedMps: motion.signedForwardSpeed,
    angularVelocityRadSec: motion.angularVelocityY,
    scoreMultiplier: 1.0,
    accumulatedDriftScore: prev.accumulatedDriftScore,
  };
}

/**
 * Computes future physics multipliers from active drift telemetry.
 * Always returns neutral 1.0 multipliers when `config.enabled` is false.
 */
export function computeDriftPhysicsAdjustment(
  telemetry: DriftTelemetry,
  config: DriftConfig
): DriftPhysicsAdjustment {
  if (!config.enabled || !telemetry.active) {
    return {
      rearLateralGripMultiplier: 1.0,
      steerTorqueMultiplier: 1.0,
      trailingFrictionMultiplier: 1.0,
    };
  }

  return {
    rearLateralGripMultiplier: config.rearLateralGripScale,
    steerTorqueMultiplier: config.yawAuthorityScale,
    trailingFrictionMultiplier: config.trailingFrictionScale,
  };
}
