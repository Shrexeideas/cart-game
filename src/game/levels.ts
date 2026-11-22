import {
  generateCareerRoundVariant,
  generateParkingChallenge,
  getDailyChallengeSeed,
  type PreviousBayHint,
} from './parkingGenerator';
import type { LevelConfig } from './types';
import { PERMANENT_LOT_OBSTACLES } from './worldLayout';

// Cart physical footprint: 0.64m wide x 1.04m long
export const CART_WIDTH = 0.64;
export const CART_LENGTH = 1.04;

// Expanded facility half-extents (68m x 44m)
export const LOT_HALF_WIDTH = 34;
export const LOT_HALF_LENGTH = 22;

const CAREER_BASE_LEVELS: LevelConfig[] = [
  {
    id: 1,
    code: 'LVL 01',
    name: 'The Training Ground',
    subtitle: 'Wide bay. Get a feel for those squeaky swivel casters.',
    parTime: 22,
    spawn: { x: -4.2, z: 2.8, yaw: Math.PI / 2 }, // facing +X down the lane
    bay: { x: 2.2, z: -2.2, yaw: Math.PI / 2, width: 2.1, length: 3.4 },
    obstacles: [
      { id: 'c1', kind: 'curb', x: 2.2, z: -3.9, yaw: 0, width: 6.8, length: 0.36, height: 0.22 },
      { id: 'cart_l', kind: 'cart', x: -1.3, z: -2.2, yaw: Math.PI / 2, width: 0.68, length: 1.1, height: 0.95 },
      { id: 'cart_r', kind: 'cart', x: 5.7, z: -2.2, yaw: Math.PI / 2, width: 0.68, length: 1.1, height: 0.95 },
      { id: 'car_bg1', kind: 'car', x: -6.5, z: -2.2, yaw: Math.PI / 2, width: 1.9, length: 4.1, height: 1.45, color: 0x3b82f6, variant: 'sedan' },
      { id: 'car_bg2', kind: 'car', x: 10.5, z: -2.2, yaw: Math.PI / 2, width: 1.9, length: 4.1, height: 1.45, color: 0xef4444, variant: 'suv' },
    ],
    movingActors: [
      { id: 'car_cruise_1', kind: 'car_cruise', startX: -24, startZ: 13.4, endX: 24, endZ: 13.4, speed: 3.2, phaseOffset: 0.5, shirtColor: 0x0ea5e9 },
    ],
    handling: {
      maxSpeed: 5.4,
      pushForce: 19,
      reverseForce: 14,
      steerTorque: 7.2,
      casterLagRate: 4.8,
      badWheelPull: 0.04,
      wobbleAmplitude: 0.12,
      reverseInstability: 0.35,
      lateralGrip: 4.5,
      slopeX: 0,
      slopeZ: 0,
    },
    eventInterval: 14,
    allowedEvents: ['wobble', 'bag_drop'],
    weather: 'day',
  },
  {
    id: 2,
    code: 'LVL 02',
    name: 'Tight Squeeze',
    subtitle: 'Two abandoned carts left almost zero wiggle room.',
    parTime: 26,
    spawn: { x: -5.2, z: 2.4, yaw: Math.PI / 2 },
    bay: { x: 1.8, z: -2.1, yaw: Math.PI / 2, width: 1.65, length: 2.55 },
    obstacles: [
      { id: 'curb_2', kind: 'curb', x: 1.8, z: -3.55, yaw: 0, width: 8.5, length: 0.38, height: 0.24 },
      { id: 'cart_2a', kind: 'cart', x: -0.35, z: -2.1, yaw: Math.PI / 2 + 0.08, width: 0.68, length: 1.1, height: 0.95 },
      { id: 'cart_2b', kind: 'cart', x: 3.95, z: -2.1, yaw: Math.PI / 2 - 0.06, width: 0.68, length: 1.1, height: 0.95 },
      { id: 'bol_2a', kind: 'bollard', x: -2.4, z: -2.6, yaw: 0, width: 0.35, length: 0.35, height: 0.9 },
      { id: 'bol_2b', kind: 'bollard', x: 6.0, z: -2.6, yaw: 0, width: 0.35, length: 0.35, height: 0.9 },
      { id: 'car_2c', kind: 'car', x: -6.8, z: -2.3, yaw: Math.PI / 2, width: 1.9, length: 4.1, height: 1.45, color: 0xf59e0b, variant: 'hatchback' },
    ],
    movingActors: [
      { id: 'ped_2a', kind: 'pedestrian', startX: -11, startZ: -4.8, endX: 11, endZ: -4.8, speed: 1.05, phaseOffset: 0.3, shirtColor: 0x06b6d4 },
    ],
    handling: {
      maxSpeed: 6.4,
      pushForce: 33,
      reverseForce: 25,
      steerTorque: 10.8,
      casterLagRate: 4.3,
      badWheelPull: 0.08,
      wobbleAmplitude: 0.22,
      reverseInstability: 0.48,
      lateralGrip: 4.1,
      slopeX: 0,
      slopeZ: 0,
    },
    eventInterval: 11,
    allowedEvents: ['wobble', 'reverse_drift', 'curb_snag', 'bag_drop'],
    weather: 'day',
  },
  {
    id: 3,
    code: 'LVL 03',
    name: 'The Terrible Wheels',
    subtitle: 'Front-left caster is bent. Fight the pull into the bay.',
    parTime: 28,
    spawn: { x: -5.4, z: 2.9, yaw: Math.PI / 2 },
    bay: { x: 2.0, z: -2.0, yaw: Math.PI / 2, width: 1.75, length: 2.7 },
    obstacles: [
      { id: 'curb_3', kind: 'curb', x: 2.0, z: -3.55, yaw: 0, width: 9.0, length: 0.38, height: 0.24 },
      { id: 'cart_3a', kind: 'cart', x: -0.2, z: -2.0, yaw: Math.PI / 2, width: 0.68, length: 1.1, height: 0.95 },
      { id: 'cart_3b', kind: 'cart', x: 4.2, z: -2.0, yaw: Math.PI / 2, width: 0.68, length: 1.1, height: 0.95 },
      { id: 'corral_3', kind: 'corral', x: -5.2, z: -3.0, yaw: 0, width: 2.4, length: 3.4, height: 1.1 },
      { id: 'car_3', kind: 'car', x: 7.4, z: -2.1, yaw: Math.PI / 2, width: 1.9, length: 4.1, height: 1.45, color: 0x10b981, variant: 'suv' },
    ],
    movingActors: [
      { id: 'car_cruise_3', kind: 'car_cruise', startX: 25, startZ: 13.4, endX: -25, endZ: 13.4, speed: 3.4, phaseOffset: 1.2, shirtColor: 0x8b5cf6 },
    ],
    handling: {
      maxSpeed: 6.5,
      pushForce: 34,
      reverseForce: 25,
      steerTorque: 11.0,
      casterLagRate: 3.6,
      badWheelPull: 0.44,
      wobbleAmplitude: 0.55,
      reverseInstability: 0.62,
      lateralGrip: 3.6,
      slopeX: 0,
      slopeZ: 0,
    },
    eventInterval: 8.5,
    allowedEvents: ['wobble', 'reverse_drift', 'bag_drop'],
    weather: 'overcast',
  },
  {
    id: 4,
    code: 'LVL 04',
    name: 'Supermarket Traffic',
    subtitle: 'Weekend rush! Dodge shoppers, carts and cruising cars.',
    parTime: 30,
    spawn: { x: -5.8, z: 2.8, yaw: Math.PI / 2 },
    bay: { x: 2.4, z: -2.1, yaw: Math.PI / 2, width: 1.7, length: 2.6 },
    obstacles: [
      { id: 'curb_4', kind: 'curb', x: 2.4, z: -3.6, yaw: 0, width: 10.5, length: 0.38, height: 0.24 },
      { id: 'car_4a', kind: 'car', x: -1.1, z: -2.1, yaw: Math.PI / 2, width: 1.85, length: 3.9, height: 1.45, color: 0x6366f1, variant: 'sedan' },
      { id: 'car_4b', kind: 'car', x: 5.9, z: -2.1, yaw: Math.PI / 2, width: 1.85, length: 3.9, height: 1.45, color: 0xf43f5e, variant: 'hatchback' },
    ],
    movingActors: [
      { id: 'ped_4a', kind: 'pedestrian', startX: -7.5, startZ: 0.4, endX: 8.5, endZ: 0.4, speed: 1.15, phaseOffset: 0.2, shirtColor: 0xf97316 },
      { id: 'ped_4b', kind: 'pedestrian_cart', startX: 7.5, startZ: 4.1, endX: -6.5, endZ: 4.1, speed: 1.0, phaseOffset: 1.8, shirtColor: 0x06b6d4 },
      { id: 'rogue_4a', kind: 'rogue_cart', startX: 7.0, startZ: 1.8, endX: -5.5, endZ: 1.8, speed: 1.85, phaseOffset: 1.0 },
      { id: 'car_cruise_4', kind: 'car_cruise', startX: -26, startZ: 13.4, endX: 26, endZ: 13.4, speed: 3.4, phaseOffset: 0.4, shirtColor: 0xef4444 },
    ],
    handling: {
      maxSpeed: 6.5,
      pushForce: 34,
      reverseForce: 25,
      steerTorque: 11.2,
      casterLagRate: 3.9,
      badWheelPull: 0.22,
      wobbleAmplitude: 0.35,
      reverseInstability: 0.58,
      lateralGrip: 3.7,
      slopeX: 0,
      slopeZ: 0,
    },
    eventInterval: 9,
    allowedEvents: ['wobble', 'reverse_drift', 'pedestrian', 'rogue_cart', 'bag_drop', 'twin_crossing'],
    weather: 'day',
  },
  {
    id: 5,
    code: 'LVL 05',
    name: 'The Impossible Gap',
    subtitle: 'SUVs boxed you in. Thread the chrome needle.',
    parTime: 34,
    spawn: { x: -5.6, z: 2.1, yaw: Math.PI / 2 },
    bay: { x: 1.5, z: -2.1, yaw: Math.PI / 2, width: 1.42, length: 2.08 },
    obstacles: [
      { id: 'curb_5', kind: 'curb', x: 1.5, z: -3.45, yaw: 0, width: 11.0, length: 0.38, height: 0.25 },
      { id: 'car_5a', kind: 'car', x: -1.65, z: -2.1, yaw: Math.PI / 2, width: 1.85, length: 4.0, height: 1.55, color: 0x1e293b, variant: 'suv' },
      { id: 'car_5b', kind: 'car', x: 4.65, z: -2.1, yaw: Math.PI / 2, width: 1.85, length: 4.0, height: 1.55, color: 0xeab308, variant: 'suv' },
      { id: 'cart_5c', kind: 'cart', x: -2.5, z: 4.4, yaw: 0.4, width: 0.68, length: 1.1, height: 0.95 },
      { id: 'cart_5d', kind: 'cart', x: 3.4, z: 4.5, yaw: -0.3, width: 0.68, length: 1.1, height: 0.95 },
      { id: 'bol_5a', kind: 'bollard', x: 0.4, z: 4.3, yaw: 0, width: 0.36, length: 0.36, height: 0.9 },
    ],
    movingActors: [
      { id: 'ped_5a', kind: 'pedestrian', startX: 6.5, startZ: 1.2, endX: -6.0, endZ: 1.2, speed: 1.1, phaseOffset: 0.6, shirtColor: 0x8b5cf6 },
    ],
    handling: {
      maxSpeed: 6.4,
      pushForce: 33,
      reverseForce: 25,
      steerTorque: 11.2,
      casterLagRate: 3.7,
      badWheelPull: -0.26,
      wobbleAmplitude: 0.4,
      reverseInstability: 0.66,
      lateralGrip: 3.5,
      slopeX: 0,
      slopeZ: 0,
    },
    eventInterval: 8.5,
    allowedEvents: ['wobble', 'reverse_drift', 'curb_snag', 'bag_drop', 'exiting_car'],
    weather: 'sunset',
  },
  {
    id: 6,
    code: 'LVL 06',
    name: 'Absolute Chaos',
    subtitle: 'Sloped lot, possessed wheels, runaway traffic. Good luck.',
    parTime: 36,
    spawn: { x: -5.8, z: 2.7, yaw: Math.PI / 2 },
    bay: { x: 2.2, z: -2.0, yaw: Math.PI / 2, width: 1.54, length: 2.24 },
    obstacles: [
      { id: 'curb_6', kind: 'curb', x: 2.2, z: -3.5, yaw: 0, width: 12.0, length: 0.4, height: 0.25 },
      { id: 'car_6a', kind: 'car', x: -1.1, z: -2.0, yaw: Math.PI / 2, width: 1.85, length: 3.9, height: 1.45, color: 0xdc2626, variant: 'sedan' },
      { id: 'cart_6b', kind: 'cart', x: 4.1, z: -2.0, yaw: Math.PI / 2, width: 0.68, length: 1.1, height: 0.95 },
      { id: 'bol_6a', kind: 'bollard', x: 5.5, z: -2.3, yaw: 0, width: 0.36, length: 0.36, height: 0.9 },
      { id: 'corral_6', kind: 'corral', x: -5.5, z: -2.8, yaw: 0, width: 2.3, length: 3.2, height: 1.1 },
    ],
    movingActors: [
      { id: 'ped_6a', kind: 'pedestrian_cart', startX: -7.5, startZ: 0.5, endX: 8.5, endZ: 0.5, speed: 1.15, phaseOffset: 0.1, shirtColor: 0xec4899 },
      { id: 'rogue_6a', kind: 'rogue_cart', startX: 7.5, startZ: 2.1, endX: -5.5, endZ: 2.1, speed: 2.1, phaseOffset: 1.4 },
      { id: 'rogue_6b', kind: 'rogue_cart', startX: -5.0, startZ: 4.0, endX: 6.5, endZ: 4.0, speed: 1.7, phaseOffset: 2.5 },
      { id: 'car_cruise_6', kind: 'car_cruise', startX: 25, startZ: 13.4, endX: -25, endZ: 13.4, speed: 3.5, phaseOffset: 0.9, shirtColor: 0x3b82f6 },
    ],
    handling: {
      maxSpeed: 6.8,
      pushForce: 36,
      reverseForce: 27,
      steerTorque: 11.5,
      casterLagRate: 3.1,
      badWheelPull: 0.48,
      wobbleAmplitude: 0.68,
      reverseInstability: 0.78,
      lateralGrip: 3.1,
      slopeX: 0.65,
      slopeZ: -0.95,
    },
    eventInterval: 7,
    allowedEvents: ['wobble', 'reverse_drift', 'rogue_cart', 'pedestrian', 'curb_snag', 'bag_drop', 'exiting_car', 'twin_crossing'],
    weather: 'sunset',
  },
];

export const LEVELS: LevelConfig[] = CAREER_BASE_LEVELS.map((lvl) => ({
  ...lvl,
  obstacles: [...lvl.obstacles, ...PERMANENT_LOT_OBSTACLES],
}));

export function generateRandomLevel(
  seed: number,
  recentBayIds: string[] = [],
  previousBay?: PreviousBayHint
): LevelConfig {
  return generateParkingChallenge({
    seed,
    recentBayIds,
    previousBay,
    isDaily: false,
  });
}

export function generateDailyLevel(): LevelConfig {
  return generateParkingChallenge({
    seed: getDailyChallengeSeed(),
    scenario: 'chaos',
    isDaily: true,
  });
}

export function getLevelById(
  id: number,
  randomSeed = Date.now(),
  recentBayIds: string[] = [],
  previousBay?: PreviousBayHint,
  randomizeCareer = false
): LevelConfig {
  if (id === 7) return generateRandomLevel(randomSeed, recentBayIds, previousBay);
  if (id === 8) return generateDailyLevel();
  const base = LEVELS.find((l) => l.id === id) ?? LEVELS[0];
  if (randomizeCareer) {
    return generateCareerRoundVariant(base, randomSeed, recentBayIds, previousBay);
  }
  return base;
}
