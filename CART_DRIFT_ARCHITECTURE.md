# CART DRIFT ARCHITECTURE — Future Opt-In Extension

**Status in Current Build**: **Inactive (`enabled: false`)**  
**Module**: `src/game/cartDrift.ts`  
**Engine Hook**: `CartChaosEngine.stepPhysics()`, `getDriftTelemetry()`, `setDriftConfig()`

This document defines the modular architecture added during the stabilization pass to support a future **Cart Drift Mode** without altering current parallel-parking physics, difficulty curves, or balance.

---

## 1. Current Guarantee (Zero Impact When Disabled)

`DEFAULT_DRIFT_CONFIG.enabled` is strictly `false`:
- `stepDriftDetector()` returns immediately on line 96 (`if (!config.enabled) return createInitialDriftTelemetry();`).
- `computeDriftPhysicsAdjustment()` returns `{ rearLateralGripMultiplier: 1.0, steerTorqueMultiplier: 1.0, trailingFrictionMultiplier: 1.0 }` whenever `config.enabled` is `false` or `telemetry.active` is `false`.
- Active parking physics in `src/game/cartPhysicsMath.ts` (`stepCartDynamics`) remain untouched until a future update explicitly enables drift mode.

---

## 2. Core Data Contracts (`src/game/cartDrift.ts`)

### `DriftConfig`
- `enabled: boolean` — Master toggle (`false` by default).
- `minActivationSpeedMps: number` — Minimum forward speed (`2.35 m/s`) required to initiate a drift.
- `minDriftAngleDeg: number` — Minimum slip angle (`14°`) between heading and velocity vector to sustain drift scoring.
- `rearLateralGripScale: number` — Future lateral grip multiplier (`0.48`) applied while drifting.
- `yawAuthorityScale: number` — Future steering torque multiplier (`1.28`) applied while drifting.
- `trailingFrictionScale: number` — Longitudinal rolling drag multiplier (`0.88`) to carry speed through corners.
- `maxScoreMultiplier: number` — Combo ceiling (`4.0×`).
- `minHoldSecForBonus: number` — Minimum sustained hold duration (`0.35s`) before drift points accrue.

### `DriftTelemetry`
Tracks live state transitions (`'none' | 'initiating' | 'drifting' | 'recovering'`), `driftAngleDeg` computed via `computeSlipAngleDeg(forwardSpeedMps, lateralSpeedMps)`, `driftDurationSec`, `lateralSpeedMps`, `longitudinalSpeedMps`, `angularVelocityRadSec`, `scoreMultiplier`, and `accumulatedDriftScore`.

---

## 3. Enabling Cart Drift in a Future Update

1. **Mode Selection**: Add `'drift'` (or per-level toggle) in `GameMode` (`src/game/types.ts`) and call `engine.setDriftConfig({ enabled: true })` inside `CartChaosEngine.loadLevel()` only for that mode.
2. **Physics Application**: Pass `computeDriftPhysicsAdjustment(this.driftTelemetry, this.driftConfig)` into `stepCartDynamics()` to scale `activeLateralGrip`, `steerTorque`, and forward rolling drag during active drifts.
3. **VFX & Audio**: Drive skid trail particles (`spawnParticles`) and brake-skid noise (`SoundEngine.playBrake`) from `telemetry.state === 'drifting'`.
4. **HUD & Scoring**: Expose `driftTelemetry` inside `HudSnapshot` for combo meters and add `accumulatedDriftScore` to `evaluateParkingScore()`.
