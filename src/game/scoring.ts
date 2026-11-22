import type { ParkingEvaluation } from './types';
import type { BayPoseMetrics } from './cartPhysicsMath';

export interface ScoringInput {
  pose: BayPoseMetrics;
  collisions: number;
  timeTaken: number;
  parTime: number;
  steeringCorrections: number;
}

const PERFECT_QUOTES = [
  'SURGICAL CHROME PRECISION. THE MANAGER SHED A TEAR.',
  'CERTIFIED AISLE DRIFT KING. CLEANER THAN A FRESH LINED RECEIPT.',
  'ZERO SCRATCHES. THAT CART FINALLY RESPECTS YOU.',
];

const GOOD_QUOTES = [
  'CLOSE ENOUGH. PROBABLY.',
  'NOT BAD FOR A CART WITH THREE WORKING BRAIN CELLS.',
  'MOSTLY INSIDE THE LINES. SECURITY IS ONLY HALF-WATCHING.',
];

const MESSY_QUOTES = [
  'WHO GAVE YOU A LICENSE?',
  'THAT CART HAS TRUST ISSUES.',
  'YOU PARKED LIKE A CRAB.',
  'THE CART IS DISAPPOINTED IN YOU.',
];

export function pickFunnyCommentary(
  stars: 1 | 2 | 3,
  angleErrorDeg: number,
  collisions: number,
  seedIndex = 0
): string {
  if (collisions >= 4) {
    return seedIndex % 2 === 0 ? 'WHO GAVE YOU A LICENSE?' : 'THAT CART HAS TRUST ISSUES.';
  }
  if (angleErrorDeg > 14) {
    return 'YOU PARKED LIKE A CRAB.';
  }
  if (stars === 3) {
    return PERFECT_QUOTES[Math.abs(seedIndex) % PERFECT_QUOTES.length];
  }
  if (stars === 2) {
    return GOOD_QUOTES[Math.abs(seedIndex) % GOOD_QUOTES.length];
  }
  return MESSY_QUOTES[Math.abs(seedIndex) % MESSY_QUOTES.length];
}

export function forecastStars(
  collisions: number,
  elapsedTime: number,
  parTime: number,
  _alignmentPct: number
): 1 | 2 | 3 {
  if (collisions >= 3 || elapsedTime > parTime * 2.0) return 1;
  if (collisions >= 1 || elapsedTime > parTime * 1.35) {
    return 2;
  }
  return 3;
}

export function evaluateParkingScore(input: ScoringInput, seedIndex = 0): ParkingEvaluation {
  const { pose, collisions, timeTaken, parTime, steeringCorrections } = input;

  // Weighted accuracy score (0..100%)
  const centerComponent = Math.max(0, 1 - pose.centerDistance / 1.1) * 35;
  const angleComponent = Math.max(0, 1 - pose.angleErrorDeg / 25) * 35;
  const containmentComponent = (pose.containmentPct / 100) * 30;
  const collisionPenalty = collisions * 7;

  const rawAccuracy = centerComponent + angleComponent + containmentComponent - collisionPenalty;
  const accuracyPct = Math.round(Math.max(12, Math.min(100, rawAccuracy)));

  const timeBonus = Math.max(0, Math.round((parTime - timeTaken) * 18));
  const correctionPenalty = Math.max(0, steeringCorrections - 10) * 6;
  const score = Math.max(
    100,
    Math.round(accuracyPct * 25 + timeBonus - collisions * 180 - correctionPenalty)
  );

  let stars: 1 | 2 | 3 = 1;
  if (accuracyPct >= 86 && collisions === 0 && timeTaken <= parTime * 1.35 && pose.inBounds) {
    stars = 3;
  } else if (accuracyPct >= 62 && collisions <= 2 && timeTaken <= parTime * 2.0) {
    stars = 2;
  } else {
    stars = 1;
  }

  const commentary = pickFunnyCommentary(
    stars,
    pose.angleErrorDeg,
    collisions,
    seedIndex + Math.round(timeTaken * 10)
  );

  return {
    accuracyPct,
    centerDistance: Number(pose.centerDistance.toFixed(2)),
    angleErrorDeg: Math.round(pose.angleErrorDeg),
    containmentPct: Math.round(pose.containmentPct),
    inBounds: pose.inBounds,
    collisions,
    timeTaken: Number(timeTaken.toFixed(1)),
    steeringCorrections,
    stars,
    score,
    commentary,
    passed: pose.containmentPct >= 55,
  };
}
