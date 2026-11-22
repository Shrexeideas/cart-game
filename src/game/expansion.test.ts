import test from 'node:test';
import assert from 'node:assert/strict';
import { CART_CATALOG, applyCartModifiersToHandling, getCartDefinition } from './carts';
import { LEVELS } from './levels';
import {
  applyAngerDelta,
  computeOwnerReaction,
  getAngerStage,
  pickOwnerDialogue,
} from './ownerLogic';
import {
  DEFAULT_PROGRESSION,
  applyRunOutcome,
  unlockCartWithCoins,
} from './progression';
import type { ParkingEvaluation } from './types';

test('cart catalog includes at least 10 visually and physically distinct carts', () => {
  assert.ok(CART_CATALOG.length >= 10);
  const ids = new Set(CART_CATALOG.map((c) => c.id));
  assert.equal(ids.size, CART_CATALOG.length);

  const speedDemon = getCartDefinition('speed_demon');
  const heavyDuty = getCartDefinition('heavy_duty');
  assert.ok(speedDemon.physics.maxSpeedMult > heavyDuty.physics.maxSpeedMult);
  assert.ok(heavyDuty.physics.mass > speedDemon.physics.mass);

  const base = LEVELS[0].handling;
  const modFast = applyCartModifiersToHandling(base, speedDemon, false);
  const modChaos = applyCartModifiersToHandling(base, speedDemon, true);
  assert.ok(modChaos.maxSpeed > modFast.maxSpeed);
});

test('owner anger stages and anti-repeat dialogue work accurately', () => {
  assert.equal(getAngerStage(10), 1);
  assert.equal(getAngerStage(25), 2);
  assert.equal(getAngerStage(50), 3);
  assert.equal(getAngerStage(75), 4);
  assert.equal(getAngerStage(95), 5);

  const line1 = pickOwnerDialogue('crash', [], 0);
  const line2 = pickOwnerDialogue('crash', [line1], 0);
  assert.notEqual(line1, line2, 'dialogue selector should avoid immediate repeats');

  const reaction = computeOwnerReaction('perfect_park', 50, [], 0);
  assert.equal(reaction.anim, 'celebrate');
  assert.equal(reaction.expression, 'impressed');

  const furiousAnger = applyAngerDelta(50, 20, 'nightmare');
  assert.ok(furiousAnger > 70, 'nightmare mode amplifies owner anger gains');
});

test('progression awards coins and unlocks Speed Demon, Luxury Cart, and Golden Cart on challenges', () => {
  const cleanEval: ParkingEvaluation = {
    accuracyPct: 95,
    centerDistance: 0.08,
    angleErrorDeg: 2,
    containmentPct: 100,
    inBounds: true,
    collisions: 0,
    timeTaken: 18.4,
    steeringCorrections: 4,
    stars: 3,
    score: 2600,
    commentary: 'CLEAN!',
    passed: true,
  };

  let prog = { ...DEFAULT_PROGRESSION, zeroCrashWins: 4 };
  const res = applyRunOutcome(prog, {
    levelId: 2,
    mode: 'career',
    evaluation: cleanEval,
    survivedStage5: true,
  });

  assert.ok(res.coinsEarned >= 150);
  assert.ok(res.newlyUnlockedCarts.includes('speed_demon'), 'under 30s unlocks Speed Demon');
  assert.ok(res.newlyUnlockedCarts.includes('luxury'), '5 zero-crash wins unlocks Luxury Cart');
  assert.ok(res.newlyUnlockedCarts.includes('golden'), 'surviving stage 5 unlocks Golden Cart');

  // Coin purchase check
  const withCoins = { ...DEFAULT_PROGRESSION, coins: 200 };
  const bought = unlockCartWithCoins(withCoins, 'basket_cart');
  assert.equal(bought.ok, true);
  assert.equal(bought.progression.coins, 80);
  assert.ok(bought.progression.unlockedCarts.includes('basket_cart'));
});
