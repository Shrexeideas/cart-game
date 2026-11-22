import type {
  GameMode,
  OwnerAnimState,
  OwnerExpression,
  OwnerStateSnapshot,
  OwnerTrigger,
} from './types';

export interface OwnerReactionOutput {
  anim: OwnerAnimState;
  expression: OwnerExpression;
  dialogue: string;
  shouldApproach: boolean;
}

const DIALOGUE_BANK: Record<OwnerTrigger, string[]> = {
  idle: [
    'KEEP BOTH HANDS ON THE HANDLE!',
    'NO DRIFTING NEAR THE PRODUCE!',
    'THOSE CASTERS COST ME TWELVE DOLLARS!',
  ],
  crash: [
    "HEY! THAT'S MY CART!",
    'WATCH THE CHROME! WATCH THE CHROME!',
    'YOU JUST TOOK THREE MONTHS OFF THAT AXLE!',
  ],
  crash_car: [
    'HEY!! THAT SEDAN BELONGS TO A VIP SHOPPER!',
    'MY INSURANCE PREMIUM JUST TRIPLED!',
    'STOP USING OTHER PEOPLES BUMPERS AS BRAKES!!',
  ],
  hit_cart: [
    'ARE YOU COLLECTING DAMAGES OR WHAT?',
    'STOP INTRODUCING MY CARTS TO EACH OTHER!',
    'THAT WAS A PERFECTLY GOOD TROLLEY!',
  ],
  slow: [
    "I'VE SEEN PEOPLE PARK FASTER IN THEIR SLEEP!",
    'MY GRANDMOTHER PARALLELS WITH A WALKER FASTER THAN THIS!',
    'ANY DAY NOW! THE STORE CLOSES ON TUESDAY!',
  ],
  circles: [
    'THIS IS A PARKING LOT, NOT A RACE TRACK!',
    'ARE WE DOING DONUTS IN AISLE ZERO NOW?!',
    'STOP SPINNING AND PUT IT IN THE BOX!',
  ],
  perfect_park: [
    'FINALLY! SOMEONE WITH A BRAIN!',
    'WAIT... THAT WAS ACTUALLY CLEAN. IMPOSSIBLE!',
    'HIRE THIS PERSON! NO, WAIT, CHECK FOR DENTS FIRST!',
  ],
  property_damage: [
    'WHO IS PAYING FOR THAT?',
    'MY BEAUTIFUL PARKING BOLLARD!',
    'THAT CURB HAD A FAMILY!',
  ],
  repeat_fail: [
    'JUST GIVE ME THE CART!',
    'HAND OVER YOUR GROCERY PRIVILEGES!',
    'HAVE YOU CONSIDERED CARRYING TWO BAGS INSTEAD?',
  ],
  line_cross: [
    'THE YELLOW LINE IS NOT A SUGGESTION!',
    'IN OR OUT! PICK A SIDE OF THE PAINT!',
    'STOP STRADDLING THE PARKING BAY!',
  ],
  escaped: [
    'GET BACK HERE WITH MY TROLLEY!!',
    'RUNNING AWAY WON’T FIX THAT WHEEL ALIGNMENT!',
    'STOP! YOU’RE HEADING INTO THE DELIVERY BAY!!',
  ],
  blocked: [
    'WHO PARKED ALL THIS JUNK IN MY AISLE?!',
    'MOVE OUT OF THE WAY! STORE MANAGER COMING THROUGH!',
    'I CAN’T EVEN REACH YOU THROUGH THIS CAR PILEUP!',
  ],
  meltdown: [
    'ENOUGH!! SECURITY! GET THE MOP AND THE MEGAPHONE!!',
    "THAT'S IT! I'M CALLING CORPORATE! RUN FOR IT!!",
    'MY BLOOD PRESSURE IS HIGHER THAN EGG PRICES!!',
  ],
};

export function getAngerStage(anger: number): 1 | 2 | 3 | 4 | 5 {
  if (anger >= 90) return 5;
  if (anger >= 65) return 4;
  if (anger >= 40) return 3;
  if (anger >= 20) return 2;
  return 1;
}

export function pickOwnerDialogue(
  trigger: OwnerTrigger,
  recentHistory: string[],
  seed = 0
): string {
  const pool = DIALOGUE_BANK[trigger] ?? DIALOGUE_BANK.idle;
  const fresh = pool.filter((line) => !recentHistory.includes(line));
  const candidates = fresh.length > 0 ? fresh : pool;
  return candidates[Math.abs(seed) % candidates.length];
}

export function computeOwnerReaction(
  trigger: OwnerTrigger,
  anger: number,
  recentHistory: string[],
  seed = 0
): OwnerReactionOutput {
  const stage = getAngerStage(anger);
  const dialogue = pickOwnerDialogue(trigger, recentHistory, seed);

  switch (trigger) {
    case 'perfect_park':
      return {
        anim: 'celebrate',
        expression: 'impressed',
        dialogue,
        shouldApproach: false,
      };
    case 'meltdown':
      return {
        anim: 'shake_fist',
        expression: 'furious',
        dialogue,
        shouldApproach: true,
      };
    case 'crash_car':
      return {
        anim: stage >= 4 ? 'shake_fist' : stage >= 3 ? 'hands_on_head' : 'shocked',
        expression: stage >= 3 ? 'furious' : 'shocked',
        dialogue,
        shouldApproach: true,
      };
    case 'escaped':
      return {
        anim: 'point',
        expression: stage >= 3 ? 'furious' : 'angry',
        dialogue,
        shouldApproach: true,
      };
    case 'blocked':
      return {
        anim: 'angry_gesture',
        expression: 'angry',
        dialogue,
        shouldApproach: false,
      };
    case 'crash':
    case 'property_damage':
      return {
        anim: stage >= 4 ? 'shake_fist' : stage >= 3 ? 'angry_gesture' : 'point',
        expression: stage >= 4 ? 'furious' : stage >= 2 ? 'angry' : 'shocked',
        dialogue,
        shouldApproach: stage >= 3,
      };
    case 'hit_cart':
      return {
        anim: stage >= 3 ? 'hands_on_head' : stage === 2 ? 'angry_gesture' : 'shocked',
        expression: stage >= 4 ? 'furious' : 'shocked',
        dialogue,
        shouldApproach: stage >= 3,
      };
    case 'repeat_fail':
    case 'slow':
      return {
        anim: stage >= 3 ? 'facepalm' : 'arms_crossed',
        expression: stage >= 3 ? 'angry' : 'annoyed',
        dialogue,
        shouldApproach: stage >= 4,
      };
    case 'circles':
    case 'line_cross':
      return {
        anim: stage >= 3 ? 'angry_gesture' : 'point',
        expression: stage >= 3 ? 'angry' : 'annoyed',
        dialogue,
        shouldApproach: stage >= 4,
      };
    default:
      return {
        anim: stage >= 3 ? 'arms_crossed' : 'idle',
        expression: stage >= 3 ? 'angry' : stage >= 2 ? 'annoyed' : 'neutral',
        dialogue,
        shouldApproach: false,
      };
  }
}

export function applyAngerDelta(
  currentAnger: number,
  delta: number,
  gameMode: GameMode
): number {
  const modeMult =
    delta > 0
      ? gameMode === 'nightmare'
        ? 1.45
        : gameMode === 'chaos'
          ? 1.15
          : 1.0
      : 1.0;
  return Math.max(0, Math.min(100, currentAnger + delta * modeMult));
}

export function createInitialOwnerSnapshot(): OwnerStateSnapshot {
  return {
    anger: 8,
    stage: 1,
    anim: 'idle',
    expression: 'neutral',
    dialogue: null,
    meltdownActive: false,
    survivedStage5: false,
  };
}
