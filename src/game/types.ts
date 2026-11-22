export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';

export type CameraMode = 'chase' | 'overhead';

export type GameMode = 'career' | 'nightmare' | 'chaos' | 'timetrial';

export type CartId =
  | 'classic'
  | 'speed_demon'
  | 'heavy_duty'
  | 'wobbly_wheels'
  | 'tiny_trolley'
  | 'luxury'
  | 'rust_bucket'
  | 'monster'
  | 'basket_cart'
  | 'golden';

export type WheelStyle = 'standard' | 'sport' | 'offroad' | 'gold';
export type CartAccessory = 'none' | 'spoiler' | 'flag' | 'horn' | 'umbrella';
export type CartEffect = 'none' | 'sparkles' | 'tire_smoke' | 'confetti';

export interface CosmeticLoadout {
  accentColor: number | null; // null = cart default
  wheelStyle: WheelStyle | null; // null = cart default
  accessory: CartAccessory;
  effect: CartEffect;
}

export interface CartStatsDisplay {
  speed: number;      // 1-10
  stability: number;  // 1-10
  steering: number;   // 1-10
  weight: number;     // 1-10
  difficulty: number; // 1-10
}

export interface CartPhysicsModifiers {
  mass: number;
  maxSpeedMult: number;
  pushMult: number;
  reverseMult: number;
  steerMult: number;
  casterLagMult: number;
  badWheelBias: number;
  wobbleBias: number;
  reverseInstabilityMult: number;
  lateralGripMult: number;
  restitution: number;
  footprintW: number;
  footprintL: number;
}

export interface CartDefinition {
  id: CartId;
  name: string;
  tagline: string;
  cost: number;
  challengeHint: string;
  primaryColor: number;
  frameColor: number;
  defaultWheelStyle: WheelStyle;
  stats: CartStatsDisplay;
  physics: CartPhysicsModifiers;
}

export type PhysicsEventType =
  | 'wobble'
  | 'reverse_drift'
  | 'rogue_cart'
  | 'pedestrian'
  | 'curb_snag'
  | 'bag_drop'
  | 'downhill_cart'
  | 'owner_ambush'
  | 'abandoned_cart'
  | 'stuck_trolley'
  | 'cart_cluster'
  | 'owner_rearrange'
  | 'runaway_cart'
  | 'exiting_car'
  | 'bay_reassigned'
  | 'twin_crossing';

export type OwnerAnimState =
  | 'idle'
  | 'walk'
  | 'angry_walk'
  | 'run'
  | 'turn'
  | 'point'
  | 'angry_gesture'
  | 'shake_fist'
  | 'hands_on_head'
  | 'shocked'
  | 'facepalm'
  | 'arms_crossed'
  | 'celebrate';

export type OwnerExpression =
  | 'neutral'
  | 'annoyed'
  | 'angry'
  | 'furious'
  | 'shocked'
  | 'impressed';

export type OwnerTrigger =
  | 'idle'
  | 'crash'
  | 'crash_car'
  | 'hit_cart'
  | 'slow'
  | 'circles'
  | 'perfect_park'
  | 'property_damage'
  | 'repeat_fail'
  | 'line_cross'
  | 'escaped'
  | 'blocked'
  | 'meltdown';

export interface OwnerStateSnapshot {
  anger: number;       // 0..100
  stage: 1 | 2 | 3 | 4 | 5;
  anim: OwnerAnimState;
  expression: OwnerExpression;
  dialogue: string | null;
  meltdownActive: boolean;
  survivedStage5: boolean;
}

export interface Vec2 {
  x: number;
  z: number;
}

export type ObstacleKind =
  | 'cart'
  | 'car'
  | 'curb'
  | 'bollard'
  | 'corral'
  | 'island'
  | 'wheel_stop'
  | 'bench'
  | 'trash_bin'
  | 'sign'
  | 'barrier'
  | 'loading_dock';

export interface ObstacleSpec {
  id: string;
  kind: ObstacleKind;
  x: number;
  z: number;
  yaw: number;
  width: number;  // full width (X in local space)
  length: number; // full length (Z in local space)
  height: number;
  color?: number;
  variant?: 'sedan' | 'suv' | 'hatchback';
  label?: string;
}

export interface MovingActorSpec {
  id: string;
  kind: 'pedestrian' | 'rogue_cart' | 'car_cruise' | 'pedestrian_cart';
  startX: number;
  startZ: number;
  endX: number;
  endZ: number;
  speed: number;
  phaseOffset?: number;
  shirtColor?: number;
  waypoints?: Vec2[];
}

export interface ParkingZoneSpec {
  x: number;
  z: number;
  yaw: number;    // target orientation in radians (parallel to bay length)
  width: number;  // bay width (perpendicular to length)
  length: number; // bay length
  requireReverse?: boolean;
}

export type ParkingScenarioType =
  | 'easy'
  | 'normal'
  | 'tight'
  | 'awkward'
  | 'reverse'
  | 'chaos'
  | 'impossible';

export type WeatherTheme = 'day' | 'sunset' | 'overcast';

export interface CartHandlingProfile {
  maxSpeed: number;
  pushForce: number;
  reverseForce: number;
  steerTorque: number;
  casterLagRate: number;      // lower = slower caster response
  badWheelPull: number;       // -1..1 steady pull torque
  wobbleAmplitude: number;    // 0..1 flutter intensity
  reverseInstability: number; // 0..1 jackknife multiplier
  lateralGrip: number;        // lower = more drift
  slopeX: number;             // gravity tilt along X (m/s^2)
  slopeZ: number;             // gravity tilt along Z (m/s^2)
}

export interface LevelConfig {
  id: number;
  code: string;
  name: string;
  subtitle: string;
  parTime: number;
  spawn: { x: number; z: number; yaw: number };
  bay: ParkingZoneSpec;
  obstacles: ObstacleSpec[];
  movingActors: MovingActorSpec[];
  handling: CartHandlingProfile;
  eventInterval: number; // seconds between funny random events (0 = disabled)
  allowedEvents: PhysicsEventType[];
  isRandom?: boolean;
  isDaily?: boolean;
  scenario?: ParkingScenarioType;
  weather?: WeatherTheme;
  bayId?: string;
}

export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  brake: boolean;
}

export interface CartTelemetry {
  x: number;
  z: number;
  yaw: number;
  speed: number;
  signedForwardSpeed: number;
  steeringInput: number;
  leftCasterAngle: number;
  rightCasterAngle: number;
  wobbleActive: boolean;
  reverseDriftActive: boolean;
  inBay: boolean;
  bayAlignmentPct: number;
  bayCoveragePct: number;
  parkProgress: number; // 0..1 settle timer while inside bay
}

export interface HudSnapshot {
  levelId: number;
  levelName: string;
  gameMode: GameMode;
  cartId: CartId;
  elapsedTime: number;
  timeLimit: number | null;
  collisions: number;
  steeringCorrections: number;
  forecastStars: number;
  steeringInput: number;
  leftCasterAngle: number;
  rightCasterAngle: number;
  speed: number;
  reversing: boolean;
  braking: boolean;
  inBay: boolean;
  bayAccuracyPct: number;
  parkProgress: number;
  activeEventBanner: string | null;
  cameraMode: CameraMode;
  owner: OwnerStateSnapshot;
  coins: number;
  bayDistance: number;
  bayBearingRad: number;
  requireReverse: boolean;
  scenarioLabel?: string;
}

export interface ParkingEvaluation {
  accuracyPct: number;
  centerDistance: number;
  angleErrorDeg: number;
  containmentPct: number;
  inBounds: boolean;
  collisions: number;
  timeTaken: number;
  steeringCorrections: number;
  stars: 1 | 2 | 3;
  score: number;
  commentary: string;
  passed: boolean;
  meltdownDefeat?: boolean;
  timeExpired?: boolean;
  coinsEarned?: number;
  newlyUnlockedCarts?: CartId[];
  ownerReaction?: string;
}

export interface LevelBestRecord {
  bestStars: number;
  bestScore: number;
  bestAccuracy: number;
  bestTime: number;
}
