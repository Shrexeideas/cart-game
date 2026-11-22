import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateParkingScore, forecastStars, pickFunnyCommentary } from './scoring';
import { evaluateBayPose } from './cartPhysicsMath';
import { LEVELS } from './levels';

test('awards 3 stars for clean, centered, zero-collision parking within par', () => {
  const bay = LEVELS[0].bay;
  const pose = evaluateBayPose(bay.x + 0.05, bay.z, bay.yaw + 0.03, bay);
  const res = evaluateParkingScore({
    pose,
    collisions: 0,
    timeTaken: 14.5,
    parTime: 22,
    steeringCorrections: 6,
  });

  assert.equal(res.stars, 3);
  assert.equal(res.passed, true);
  assert.ok(res.accuracyPct >= 90);
});

test('penalizes collisions and crooked angle with 1 star and hilarious commentary', () => {
  const bay = LEVELS[1].bay;
  const pose = evaluateBayPose(bay.x + 0.35, bay.z + 0.25, bay.yaw + 0.34, bay);
  const res = evaluateParkingScore({
    pose,
    collisions: 5,
    timeTaken: 45,
    parTime: 26,
    steeringCorrections: 22,
  });

  assert.equal(res.stars, 1);
  assert.ok(
    ['WHO GAVE YOU A LICENSE?', 'THAT CART HAS TRUST ISSUES.'].includes(res.commentary),
    `Expected collision roast, got: ${res.commentary}`
  );
});

test('crab angle triggers YOU PARKED LIKE A CRAB commentary', () => {
  const msg = pickFunnyCommentary(1, 18, 1, 0);
  assert.equal(msg, 'YOU PARKED LIKE A CRAB.');
});

test('forecastStars degrades gracefully with collisions and slow time', () => {
  assert.equal(forecastStars(0, 10, 25, 92), 3);
  assert.equal(forecastStars(1, 10, 25, 92), 2);
  assert.equal(forecastStars(4, 10, 25, 92), 1);
});
