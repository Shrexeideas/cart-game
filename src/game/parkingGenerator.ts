import { buildNavGrid, findGridPath, resolveSingleObstaclePush } from './npcNavigation';
import type {
  LevelConfig,
  MovingActorSpec,
  ObstacleSpec,
  ParkingScenarioType,
  PhysicsEventType,
  WeatherTheme,
} from './types';
import {
  CANDIDATE_PARKING_BAYS,
  type CandidateBaySpec,
  PERMANENT_LOT_OBSTACLES,
} from './worldLayout';

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function getDailyChallengeSeed(date = new Date()): number {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  return y * 10000 + m * 100 + d;
}

const SCENARIO_LIST: ParkingScenarioType[] = [
  'easy',
  'normal',
  'tight',
  'awkward',
  'reverse',
  'chaos',
  'impossible',
];

export const SCENARIO_LABELS: Record<ParkingScenarioType, string> = {
  easy: 'OPEN BAY',
  normal: 'STANDARD SQUEEZE',
  tight: 'TIGHT FIT',
  awkward: 'AWKWARD ANGLE',
  reverse: 'REVERSE ONLY',
  chaos: 'RUSH HOUR CHAOS',
  impossible: 'IMPOSSIBLE GAP',
};

const CAR_PALETTE = [0x3b82f6, 0xef4444, 0xf59e0b, 0x10b981, 0x8b5cf6, 0x06b6d4, 0xe11d48, 0x1e293b];
const SHIRT_PALETTE = [0xf97316, 0x06b6d4, 0x8b5cf6, 0xec4899, 0x10b981, 0xeab308];
const WEATHER_THEMES: WeatherTheme[] = ['day', 'day', 'sunset', 'overcast'];

function overlapsAnyObstacle(
  x: number,
  z: number,
  radius: number,
  obstacles: ObstacleSpec[]
): boolean {
  for (let i = 0; i < obstacles.length; i++) {
    const res = resolveSingleObstaclePush(x, z, radius, obstacles[i]);
    if (res.hit) return true;
  }
  return false;
}

function overlapsBayZone(x: number, z: number, radius: number, bay: CandidateBaySpec['bay']): boolean {
  const dx = x - bay.x;
  const dz = z - bay.z;
  const sinY = Math.sin(bay.yaw);
  const cosY = Math.cos(bay.yaw);
  const lx = dx * cosY - dz * sinY;
  const lz = dx * sinY + dz * cosY;
  return (
    Math.abs(lx) < bay.width / 2 + radius &&
    Math.abs(lz) < bay.length / 2 + radius
  );
}

/**
 * Verifies that a cart of radius `cartRadius` can reach the target bay entrance
 * from spawn using the 2D A* navgrid.
 */
export function verifyRouteExists(
  obstacles: ObstacleSpec[],
  spawnX: number,
  spawnZ: number,
  bayX: number,
  bayZ: number,
  cartRadius = 0.56
): boolean {
  const grid = buildNavGrid(obstacles, cartRadius, 0.7, false);
  const path = findGridPath(grid, spawnX, spawnZ, bayX, bayZ);
  return path.found && !path.blocked;
}

export interface PreviousBayHint {
  x: number;
  z: number;
  yaw: number;
  bayId?: string;
}

export interface GenerateChallengeOptions {
  seed: number;
  scenario?: ParkingScenarioType;
  recentBayIds?: string[];
  previousBay?: PreviousBayHint;
  isDaily?: boolean;
}

function normalizeYawDiff(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

function selectDistinctBay(
  rng: () => number,
  recent: Set<string>,
  previousBay?: PreviousBayHint
): CandidateBaySpec {
  let bayPool = CANDIDATE_PARKING_BAYS.filter((b) => {
    if (recent.has(b.id)) return false;
    if (previousBay) {
      if (previousBay.bayId && b.id === previousBay.bayId) return false;
      if (Math.hypot(b.bay.x - previousBay.x, b.bay.z - previousBay.z) < 8.0) return false;
    }
    return true;
  });

  if (bayPool.length === 0) {
    bayPool = CANDIDATE_PARKING_BAYS.filter((b) =>
      previousBay
        ? b.id !== previousBay.bayId &&
          Math.hypot(b.bay.x - previousBay.x, b.bay.z - previousBay.z) >= 5.5
        : true
    );
  }
  if (bayPool.length === 0) bayPool = CANDIDATE_PARKING_BAYS;

  if (previousBay) {
    const variedOrientationPool = bayPool.filter(
      (b) => normalizeYawDiff(b.bay.yaw, previousBay.yaw) > 0.3
    );
    if (variedOrientationPool.length > 0 && rng() > 0.15) {
      bayPool = variedOrientationPool;
    }
  }

  return bayPool[Math.floor(rng() * bayPool.length)];
}

/**
 * Generates a unique, physically reachable, non-overlapping parking challenge
 * across the expanded 68m x 44m supermarket complex.
 */
export function generateParkingChallenge(options: GenerateChallengeOptions): LevelConfig {
  const rng = mulberry32(options.seed);
  const scenario =
    options.scenario ?? SCENARIO_LIST[Math.floor(rng() * SCENARIO_LIST.length)];
  const recent = new Set(options.recentBayIds ?? []);

  const chosenBaySpec = selectDistinctBay(rng, recent, options.previousBay);
  const chosenSpawn =
    chosenBaySpec.spawns[Math.floor(rng() * chosenBaySpec.spawns.length)];

  // Scenario tuning with randomized bay width/length and angle variation
  let bayWidth = chosenBaySpec.bay.width;
  let bayLength = chosenBaySpec.bay.length;
  let requireReverse = false;
  let angleJitter = 0;

  switch (scenario) {
    case 'easy':
      bayWidth = 1.95 + rng() * 0.22;
      bayLength = 3.1 + rng() * 0.3;
      break;
    case 'normal':
      bayWidth = 1.68 + rng() * 0.18;
      bayLength = 2.6 + rng() * 0.28;
      break;
    case 'tight':
      bayWidth = 1.48 + rng() * 0.14;
      bayLength = 2.24 + rng() * 0.2;
      break;
    case 'awkward':
      bayWidth = 1.66 + rng() * 0.12;
      bayLength = 2.52 + rng() * 0.18;
      angleJitter = (rng() > 0.5 ? 1 : -1) * (0.28 + rng() * 0.24);
      break;
    case 'reverse':
      bayWidth = 1.7 + rng() * 0.14;
      bayLength = 2.62 + rng() * 0.18;
      requireReverse = true;
      break;
    case 'chaos':
      bayWidth = 1.6 + rng() * 0.18;
      bayLength = 2.38 + rng() * 0.24;
      angleJitter = rng() > 0.65 ? (rng() - 0.5) * 0.24 : 0;
      break;
    case 'impossible':
      bayWidth = 1.42 + rng() * 0.08;
      bayLength = 2.1 + rng() * 0.12;
      break;
  }

  const bayYaw = chosenBaySpec.bay.yaw + angleJitter;
  const bay = {
    x: chosenBaySpec.bay.x,
    z: chosenBaySpec.bay.z,
    yaw: bayYaw,
    width: Number(bayWidth.toFixed(2)),
    length: Number(bayLength.toFixed(2)),
    requireReverse,
  };

  // Start with permanent lot infrastructure, filtering out any permanent obstacle that overlaps spawn or target bay
  const obstacles: ObstacleSpec[] = PERMANENT_LOT_OBSTACLES.filter((o) => {
    const nearBay = overlapsBayZone(o.x, o.z, Math.max(o.width, o.length) * 0.5 + 0.6, bay);
    const nearSpawn = Math.hypot(o.x - chosenSpawn.x, o.z - chosenSpawn.z) < Math.max(o.width, o.length) * 0.5 + 1.4;
    return !nearBay && !nearSpawn;
  }).map((o) => ({ ...o }));

  // Optional rear wheel stop / curb behind bay
  if (chosenBaySpec.curbOffset) {
    const cx = bay.x + chosenBaySpec.curbOffset.dx;
    const cz = bay.z + chosenBaySpec.curbOffset.dz;
    if (!overlapsBayZone(cx, cz, 0.2, bay)) {
      obstacles.push({
        id: `gen_curb_${chosenBaySpec.id}`,
        kind: 'curb',
        x: cx,
        z: cz,
        yaw: chosenBaySpec.curbOffset.yaw,
        width: chosenBaySpec.curbOffset.width,
        length: 0.36,
        height: 0.22,
      });
    }
  }

  // Bay axis forward vector (+local Z in bay space)
  const axisX = Math.sin(bayYaw);
  const axisZ = Math.cos(bayYaw);
  const approachX = bay.x + chosenBaySpec.laneNormal.x * (bay.width / 2 + 1.4);
  const approachZ = bay.z + chosenBaySpec.laneNormal.z * (bay.width / 2 + 1.4);

  // Add flanking cars or carts on both ends of the parallel bay (except 'easy' which uses cones/carts further away)
  const flankVariants: Array<'sedan' | 'suv' | 'hatchback'> = ['sedan', 'suv', 'hatchback'];
  for (const sign of [-1, 1] as const) {
    const useCar =
      scenario === 'impossible' ||
      scenario === 'tight' ||
      (scenario !== 'easy' && rng() > 0.35);
    const gapExtra = scenario === 'easy' ? 1.15 : scenario === 'impossible' ? 0.16 : 0.34;
    const flankLength = useCar ? 3.85 : 1.08;
    const flankWidth = useCar ? 1.84 : 0.68;
    const distAlong = bayLength / 2 + flankLength / 2 + gapExtra;

    const fx = bay.x + axisX * distAlong * sign;
    const fz = bay.z + axisZ * distAlong * sign;

    if (
      !overlapsAnyObstacle(fx, fz, useCar ? 1.2 : 0.45, obstacles) &&
      Math.hypot(fx - chosenSpawn.x, fz - chosenSpawn.z) > 2.6 &&
      Math.hypot(fx - approachX, fz - approachZ) > 1.35
    ) {
      obstacles.push({
        id: `gen_flank_${sign > 0 ? 'f' : 'r'}`,
        kind: useCar ? 'car' : 'cart',
        x: fx,
        z: fz,
        yaw: bayYaw + (rng() - 0.5) * (scenario === 'awkward' ? 0.16 : 0.08),
        width: flankWidth,
        length: flankLength,
        height: useCar ? 1.48 : 0.95,
        color: CAR_PALETTE[Math.floor(rng() * CAR_PALETTE.length)],
        variant: flankVariants[Math.floor(rng() * flankVariants.length)],
      });
    }
  }

  // Add extra scattered carts / bollards / barriers in aisles while strictly checking route & clearance
  const clutterBudget =
    scenario === 'chaos' ? 6 : scenario === 'impossible' ? 5 : scenario === 'easy' ? 1 : 3;

  for (let i = 0; i < clutterBudget; i++) {
    const t = 0.22 + rng() * 0.6;
    const candX =
      chosenSpawn.x + (bay.x - chosenSpawn.x) * t + (rng() - 0.5) * 6.5;
    const candZ =
      chosenSpawn.z + (bay.z - chosenSpawn.z) * t + (rng() - 0.5) * 4.5;

    if (
      candX < -29 ||
      candX > 29 ||
      candZ < -3.0 ||
      candZ > 26.5 ||
      overlapsBayZone(candX, candZ, 1.35, bay) ||
      Math.hypot(candX - chosenSpawn.x, candZ - chosenSpawn.z) < 2.6 ||
      Math.hypot(candX - approachX, candZ - approachZ) < 2.1 ||
      overlapsAnyObstacle(candX, candZ, 1.05, obstacles)
    ) {
      continue;
    }

    const roll = rng();
    const candidateObs: ObstacleSpec =
      roll < 0.52
        ? {
            id: `gen_cart_${i}`,
            kind: 'cart',
            x: candX,
            z: candZ,
            yaw: rng() * Math.PI * 2,
            width: 0.68,
            length: 1.08,
            height: 0.95,
            color: CAR_PALETTE[Math.floor(rng() * CAR_PALETTE.length)],
          }
        : roll < 0.8
          ? {
              id: `gen_bol_${i}`,
              kind: 'bollard',
              x: candX,
              z: candZ,
              yaw: 0,
              width: 0.36,
              length: 0.36,
              height: 0.9,
            }
          : {
              id: `gen_bar_${i}`,
              kind: 'barrier',
              x: candX,
              z: candZ,
              yaw: rng() * Math.PI,
              width: 2.0,
              length: 0.42,
              height: 0.85,
            };

    const withCandidate = [...obstacles, candidateObs];
    if (
      verifyRouteExists(
        withCandidate,
        chosenSpawn.x,
        chosenSpawn.z,
        approachX,
        approachZ,
        0.58
      )
    ) {
      obstacles.push(candidateObs);
    }
  }

  // Lively supermarket traffic: shoppers, shopper+cart pairs, rogue carts, and cruising aisle cars
  const movingActors: MovingActorSpec[] = [];
  const pedCount = scenario === 'chaos' ? 3 : scenario === 'easy' ? 1 : 2;
  for (let i = 0; i < pedCount; i++) {
    const laneZ = -4.9 + (i % 2 === 0 ? 0 : 7.5 + i * 3.8);
    const clampedZ = Math.max(-5.2, Math.min(24.5, laneZ));
    const dir = rng() > 0.5 ? 1 : -1;
    const sx = -16 * dir + (rng() - 0.5) * 4;
    const ex = 16 * dir + (rng() - 0.5) * 4;
    const isWithCart = i === 1 && clampedZ > -2;
    movingActors.push({
      id: `gen_ped_${i}`,
      kind: isWithCart ? 'pedestrian_cart' : 'pedestrian',
      startX: sx,
      startZ: clampedZ,
      endX: ex,
      endZ: clampedZ,
      speed: 0.95 + rng() * 0.3,
      phaseOffset: rng() * 3,
      shirtColor: SHIRT_PALETTE[Math.floor(rng() * SHIRT_PALETTE.length)],
    });
  }

  // Cruising vehicles along main aisles (avoiding direct spawn/bay collisions via engine yielding too)
  const carCount = scenario === 'chaos' ? 2 : 1;
  const cruiseLanesZ = [1.8, 13.4, 24.4];
  for (let i = 0; i < carCount; i++) {
    // Pick an aisle farthest from the bay center so cruising cars roam naturally without camping the bay
    const sortedLanes = [...cruiseLanesZ].sort(
      (a, b) => Math.abs(b - bay.z) - Math.abs(a - bay.z)
    );
    const cz = sortedLanes[i % sortedLanes.length];
    const dir = i % 2 === 0 ? 1 : -1;
    movingActors.push({
      id: `gen_car_cruise_${i}`,
      kind: 'car_cruise',
      startX: -27 * dir,
      startZ: cz,
      endX: 27 * dir,
      endZ: cz,
      speed: 3.1 + rng() * 1.1,
      phaseOffset: rng() * 4,
      shirtColor: CAR_PALETTE[Math.floor(rng() * CAR_PALETTE.length)],
    });
  }

  // Handling parameters tuned per scenario
  const slopeOn = scenario === 'chaos' || scenario === 'impossible' || rng() > 0.5;
  const pullMag =
    scenario === 'easy'
      ? 0.06
      : scenario === 'impossible' || scenario === 'chaos'
        ? 0.34 + rng() * 0.14
        : 0.16 + rng() * 0.22;
  const pullSign = rng() > 0.5 ? 1 : -1;

  const weather = options.isDaily
    ? WEATHER_THEMES[Math.floor(rng() * WEATHER_THEMES.length)]
    : WEATHER_THEMES[Math.floor(rng() * WEATHER_THEMES.length)];

  const scenarioTag = SCENARIO_LABELS[scenario];
  const distToBay = Math.hypot(bay.x - chosenSpawn.x, bay.z - chosenSpawn.z);
  const parTime = Math.round(24 + distToBay * 0.9 + (scenario === 'impossible' ? 8 : 0));

  return {
    id: options.isDaily ? 8 : 7,
    code: options.isDaily ? 'DAILY' : 'SHUFFLE',
    name: options.isDaily
      ? `Daily Lot: ${chosenBaySpec.zoneLabel}`
      : `${chosenBaySpec.zoneLabel}`,
    subtitle: requireReverse
      ? `${scenarioTag} · Back in reverse only! No sloppy U-turns.`
      : `${scenarioTag} · Navigate across the 68m Mega Mart lot.`,
    parTime,
    spawn: { ...chosenSpawn },
    bay,
    obstacles,
    movingActors,
    handling: {
      maxSpeed: 6.7,
      pushForce: 34.5,
      reverseForce: 26,
      steerTorque: 11.2,
      casterLagRate: 3.4 + rng() * 1.0,
      badWheelPull: pullSign * pullMag,
      wobbleAmplitude: scenario === 'easy' ? 0.14 : 0.28 + rng() * 0.34,
      reverseInstability: scenario === 'easy' ? 0.38 : 0.5 + rng() * 0.25,
      lateralGrip: 3.3 + rng() * 0.85,
      slopeX: slopeOn ? (rng() - 0.5) * 0.85 : 0,
      slopeZ: slopeOn ? -0.25 - rng() * 0.5 : 0,
    },
    eventInterval: scenario === 'chaos' ? 6.5 : 9.5,
    allowedEvents: [
      'wobble',
      'reverse_drift',
      'rogue_cart',
      'pedestrian',
      'curb_snag',
      'bag_drop',
      'exiting_car',
      'twin_crossing',
      'bay_reassigned',
    ],
    isRandom: true,
    isDaily: options.isDaily,
    scenario,
    weather,
    bayId: chosenBaySpec.id,
  };
}

const CAREER_SCENARIO_BY_ID: Record<number, ParkingScenarioType> = {
  1: 'easy',
  2: 'tight',
  3: 'normal',
  4: 'normal',
  5: 'impossible',
  6: 'chaos',
};

/**
 * Generates a fresh randomized location, orientation, width, flanking traffic,
 * and spawn point for Career rounds (1..6) while preserving the level's signature
 * cart handling profile, title, and mechanics.
 */
export function generateCareerRoundVariant(
  baseLevel: LevelConfig,
  seed: number,
  recentBayIds: string[] = [],
  previousBay?: PreviousBayHint
): LevelConfig {
  const scenario = CAREER_SCENARIO_BY_ID[baseLevel.id] ?? 'normal';
  const generated = generateParkingChallenge({
    seed,
    scenario,
    recentBayIds,
    previousBay,
    isDaily: false,
  });

  // Preserve Career level identity and signature handling (e.g. Level 3 bent wheel, Level 6 slope)
  return {
    ...generated,
    id: baseLevel.id,
    code: baseLevel.code,
    name: `${baseLevel.name} · ${generated.name}`,
    subtitle: baseLevel.subtitle,
    parTime: Math.max(baseLevel.parTime, generated.parTime),
    handling: { ...baseLevel.handling },
    eventInterval: baseLevel.eventInterval,
    allowedEvents: [...baseLevel.allowedEvents],
    isRandom: false,
  };
}
