import {
  ACCESSORIES,
  CART_CATALOG,
  COLOR_SWATCHES,
  EFFECTS,
  WHEEL_STYLES,
} from './carts';
import type {
  CartId,
  CosmeticLoadout,
  GameMode,
  ParkingEvaluation,
} from './types';

const PROGRESSION_KEY = 'cart_chaos_progression_v1';

export interface PlayerProgression {
  coins: number;
  selectedCartId: CartId;
  unlockedCarts: CartId[];
  unlockedCosmetics: string[];
  cosmetics: CosmeticLoadout;
  zeroCrashWins: number;
  threeStarLevels: number[];
  completedLevels: number[];
  completedChaosMode: boolean;
  survivedMeltdownCount: number;
  fastestClearTime: number | null;
}

export const DEFAULT_PROGRESSION: PlayerProgression = {
  coins: 0,
  selectedCartId: 'classic',
  unlockedCarts: ['classic'],
  unlockedCosmetics: ['color_red', 'wheel_standard', 'acc_none', 'fx_none'],
  cosmetics: {
    accentColor: null,
    wheelStyle: null,
    accessory: 'none',
    effect: 'none',
  },
  zeroCrashWins: 0,
  threeStarLevels: [],
  completedLevels: [],
  completedChaosMode: false,
  survivedMeltdownCount: 0,
  fastestClearTime: null,
};

export function loadProgression(): PlayerProgression {
  try {
    const raw = localStorage.getItem(PROGRESSION_KEY);
    if (!raw) return { ...DEFAULT_PROGRESSION, cosmetics: { ...DEFAULT_PROGRESSION.cosmetics } };
    const parsed = JSON.parse(raw) as Partial<PlayerProgression>;
    return {
      ...DEFAULT_PROGRESSION,
      ...parsed,
      unlockedCarts: Array.from(new Set(['classic', ...(parsed.unlockedCarts ?? [])])) as CartId[],
      unlockedCosmetics: Array.from(
        new Set([
          ...DEFAULT_PROGRESSION.unlockedCosmetics,
          ...(parsed.unlockedCosmetics ?? []),
        ])
      ),
      cosmetics: {
        ...DEFAULT_PROGRESSION.cosmetics,
        ...(parsed.cosmetics ?? {}),
      },
    };
  } catch {
    return { ...DEFAULT_PROGRESSION, cosmetics: { ...DEFAULT_PROGRESSION.cosmetics } };
  }
}

export function saveProgression(prog: PlayerProgression): void {
  try {
    localStorage.setItem(PROGRESSION_KEY, JSON.stringify(prog));
  } catch {
    // Ignore storage quota issues
  }
}

export function computeCoinsEarned(
  evaluation: ParkingEvaluation,
  mode: GameMode
): number {
  if (!evaluation.passed || evaluation.meltdownDefeat || evaluation.timeExpired) {
    return 10; // Consolation coins for trying!
  }
  const base = 35;
  const starBonus = evaluation.stars * 25;
  const accuracyBonus = Math.round(evaluation.accuracyPct * 0.45);
  const cleanBonus = evaluation.collisions === 0 ? 40 : 0;
  const modeBonus =
    mode === 'nightmare' ? 1.5 : mode === 'chaos' ? 1.35 : mode === 'timetrial' ? 1.25 : 1.0;

  return Math.round((base + starBonus + accuracyBonus + cleanBonus) * modeBonus);
}

export interface RunRewardResult {
  progression: PlayerProgression;
  coinsEarned: number;
  newlyUnlockedCarts: CartId[];
}

export function applyRunOutcome(
  prev: PlayerProgression,
  input: {
    levelId: number;
    mode: GameMode;
    evaluation: ParkingEvaluation;
    survivedStage5: boolean;
  }
): RunRewardResult {
  const { levelId, mode, evaluation, survivedStage5 } = input;
  const coinsEarned = computeCoinsEarned(evaluation, mode);

  const next: PlayerProgression = {
    ...prev,
    coins: prev.coins + coinsEarned,
    unlockedCarts: [...prev.unlockedCarts],
    unlockedCosmetics: [...prev.unlockedCosmetics],
    threeStarLevels: [...prev.threeStarLevels],
    completedLevels: [...prev.completedLevels],
    cosmetics: { ...prev.cosmetics },
  };

  if (evaluation.passed && !evaluation.meltdownDefeat && !evaluation.timeExpired) {
    if (!next.completedLevels.includes(levelId)) {
      next.completedLevels.push(levelId);
    }
    if (evaluation.stars === 3 && !next.threeStarLevels.includes(levelId)) {
      next.threeStarLevels.push(levelId);
    }
    if (evaluation.collisions === 0) {
      next.zeroCrashWins += 1;
    }
    if (next.fastestClearTime === null || evaluation.timeTaken < next.fastestClearTime) {
      next.fastestClearTime = evaluation.timeTaken;
    }
    if (mode === 'chaos') {
      next.completedChaosMode = true;
    }
    if (survivedStage5) {
      next.survivedMeltdownCount += 1;
    }
  }

  // Evaluate rare cart challenge unlocks
  const newlyUnlockedCarts: CartId[] = [];
  const grant = (id: CartId) => {
    if (!next.unlockedCarts.includes(id)) {
      next.unlockedCarts.push(id);
      newlyUnlockedCarts.push(id);
    }
  };

  if (next.threeStarLevels.length >= 2) grant('basket_cart');
  if (next.zeroCrashWins >= 3) grant('heavy_duty');
  if (evaluation.passed && evaluation.accuracyPct >= 94) grant('tiny_trolley');
  if (evaluation.passed && evaluation.collisions >= 10) grant('wobbly_wheels');
  if (next.completedLevels.includes(3)) grant('rust_bucket');
  if (evaluation.passed && !evaluation.meltdownDefeat && evaluation.timeTaken < 30) {
    grant('speed_demon');
  }
  if (next.completedChaosMode) grant('monster');
  if (next.zeroCrashWins >= 5) grant('luxury');
  if (next.survivedMeltdownCount >= 1) grant('golden');

  return {
    progression: next,
    coinsEarned,
    newlyUnlockedCarts,
  };
}

export function unlockCartWithCoins(
  prev: PlayerProgression,
  cartId: CartId
): { ok: boolean; progression: PlayerProgression } {
  if (prev.unlockedCarts.includes(cartId)) {
    return { ok: true, progression: { ...prev, selectedCartId: cartId } };
  }
  const cart = CART_CATALOG.find((c) => c.id === cartId);
  if (!cart || prev.coins < cart.cost) {
    return { ok: false, progression: prev };
  }
  return {
    ok: true,
    progression: {
      ...prev,
      coins: prev.coins - cart.cost,
      unlockedCarts: [...prev.unlockedCarts, cartId],
      selectedCartId: cartId,
    },
  };
}

export function findCosmeticCost(cosmeticId: string): number {
  const all = [...COLOR_SWATCHES, ...WHEEL_STYLES, ...ACCESSORIES, ...EFFECTS];
  return all.find((x) => x.id === cosmeticId)?.cost ?? 9999;
}

export function unlockOrEquipCosmetic(
  prev: PlayerProgression,
  cosmeticId: string,
  apply: (loadout: CosmeticLoadout) => CosmeticLoadout
): { ok: boolean; progression: PlayerProgression } {
  const alreadyOwned = prev.unlockedCosmetics.includes(cosmeticId);
  const cost = alreadyOwned ? 0 : findCosmeticCost(cosmeticId);
  if (prev.coins < cost) {
    return { ok: false, progression: prev };
  }
  return {
    ok: true,
    progression: {
      ...prev,
      coins: prev.coins - cost,
      unlockedCosmetics: alreadyOwned
        ? prev.unlockedCosmetics
        : [...prev.unlockedCosmetics, cosmeticId],
      cosmetics: apply({ ...prev.cosmetics }),
    },
  };
}
