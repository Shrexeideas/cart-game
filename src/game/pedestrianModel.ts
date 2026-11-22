import * as THREE from 'three';
import {
  type ActionBlendEntry,
  GAIT_CLIP_DURATION,
  blendMixerActions,
  computePlaybackTimeScale,
  computeStrideLength,
  eulerTrack,
  positionTrack,
  sampleGaitCycle,
} from './characterAnimation';

export const PEDESTRIAN_HIP_HEIGHT = 0.66;
export const PEDESTRIAN_LEG_LENGTH = 0.655;
export const PEDESTRIAN_WALK_SWING_AMP = 0.42;
export const PEDESTRIAN_RUN_SWING_AMP = 0.56;
export const PEDESTRIAN_WALK_STRIDE_LENGTH = computeStrideLength(
  PEDESTRIAN_LEG_LENGTH,
  PEDESTRIAN_WALK_SWING_AMP,
  1.0
);
export const PEDESTRIAN_RUN_STRIDE_LENGTH = computeStrideLength(
  PEDESTRIAN_LEG_LENGTH,
  PEDESTRIAN_RUN_SWING_AMP,
  1.0
);

export type PedestrianAnimState = 'idle' | 'walk' | 'run' | 'push_idle' | 'push_walk';

export interface PedestrianRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  character?: PedestrianCharacter;
}

function buildSampleTimes(steps: number, duration: number): number[] {
  const times: number[] = [];
  for (let i = 0; i <= steps; i++) {
    times.push((i / steps) * duration);
  }
  return times;
}

function buildPedestrianAnimationClips(): Record<PedestrianAnimState, THREE.AnimationClip> {
  const gaitTimes = buildSampleTimes(24, GAIT_CLIP_DURATION);

  const walkClip = new THREE.AnimationClip('ped_walk', GAIT_CLIP_DURATION, [
    positionTrack('pedBodyPivot', gaitTimes, (t) => {
      const s = sampleGaitCycle(t, PEDESTRIAN_LEG_LENGTH, PEDESTRIAN_WALK_SWING_AMP, 0.04, 0);
      return [0, PEDESTRIAN_HIP_HEIGHT + s.hipOffsetY, 0];
    }),
    positionTrack('pedLeftLeg', gaitTimes, (t) => {
      const s = sampleGaitCycle(t, PEDESTRIAN_LEG_LENGTH, PEDESTRIAN_WALK_SWING_AMP, 0.04, 0);
      return [-0.11, s.leftLegLiftY, 0];
    }),
    positionTrack('pedRightLeg', gaitTimes, (t) => {
      const s = sampleGaitCycle(t, PEDESTRIAN_LEG_LENGTH, PEDESTRIAN_WALK_SWING_AMP, 0.04, 0);
      return [0.11, s.rightLegLiftY, 0];
    }),
    eulerTrack('pedLeftLeg', gaitTimes, (t) => {
      const s = sampleGaitCycle(t, PEDESTRIAN_LEG_LENGTH, PEDESTRIAN_WALK_SWING_AMP, 0.04, 0);
      return [s.leftLegX, 0, 0];
    }),
    eulerTrack('pedRightLeg', gaitTimes, (t) => {
      const s = sampleGaitCycle(t, PEDESTRIAN_LEG_LENGTH, PEDESTRIAN_WALK_SWING_AMP, 0.04, 0);
      return [s.rightLegX, 0, 0];
    }),
    eulerTrack('pedLeftArm', gaitTimes, (t) => {
      const s = sampleGaitCycle(t, PEDESTRIAN_LEG_LENGTH, PEDESTRIAN_WALK_SWING_AMP, 0.04, 0);
      return [-s.leftLegX * 0.54, 0, 0.06];
    }),
    eulerTrack('pedRightArm', gaitTimes, (t) => {
      const s = sampleGaitCycle(t, PEDESTRIAN_LEG_LENGTH, PEDESTRIAN_WALK_SWING_AMP, 0.04, 0);
      return [-s.rightLegX * 0.54, 0, -0.06];
    }),
  ]);

  const runClip = new THREE.AnimationClip('ped_run', GAIT_CLIP_DURATION, [
    positionTrack('pedBodyPivot', gaitTimes, (t) => {
      const s = sampleGaitCycle(t, PEDESTRIAN_LEG_LENGTH, PEDESTRIAN_RUN_SWING_AMP, 0.075, 0.028);
      return [0, PEDESTRIAN_HIP_HEIGHT + s.hipOffsetY, 0];
    }),
    positionTrack('pedLeftLeg', gaitTimes, (t) => {
      const s = sampleGaitCycle(t, PEDESTRIAN_LEG_LENGTH, PEDESTRIAN_RUN_SWING_AMP, 0.075, 0.028);
      return [-0.11, s.leftLegLiftY, 0];
    }),
    positionTrack('pedRightLeg', gaitTimes, (t) => {
      const s = sampleGaitCycle(t, PEDESTRIAN_LEG_LENGTH, PEDESTRIAN_RUN_SWING_AMP, 0.075, 0.028);
      return [0.11, s.rightLegLiftY, 0];
    }),
    eulerTrack('pedLeftLeg', gaitTimes, (t) => {
      const s = sampleGaitCycle(t, PEDESTRIAN_LEG_LENGTH, PEDESTRIAN_RUN_SWING_AMP, 0.075, 0.028);
      return [s.leftLegX, 0, 0];
    }),
    eulerTrack('pedRightLeg', gaitTimes, (t) => {
      const s = sampleGaitCycle(t, PEDESTRIAN_LEG_LENGTH, PEDESTRIAN_RUN_SWING_AMP, 0.075, 0.028);
      return [s.rightLegX, 0, 0];
    }),
    eulerTrack('pedLeftArm', gaitTimes, (t) => {
      const s = sampleGaitCycle(t, PEDESTRIAN_LEG_LENGTH, PEDESTRIAN_RUN_SWING_AMP, 0.075, 0.028);
      return [-s.leftLegX * 0.78 - 0.22, 0, 0.1];
    }),
    eulerTrack('pedRightArm', gaitTimes, (t) => {
      const s = sampleGaitCycle(t, PEDESTRIAN_LEG_LENGTH, PEDESTRIAN_RUN_SWING_AMP, 0.075, 0.028);
      return [-s.rightLegX * 0.78 - 0.22, 0, -0.1];
    }),
  ]);

  const pushWalkClip = new THREE.AnimationClip('ped_push_walk', GAIT_CLIP_DURATION, [
    positionTrack('pedBodyPivot', gaitTimes, (t) => {
      const s = sampleGaitCycle(t, PEDESTRIAN_LEG_LENGTH, PEDESTRIAN_WALK_SWING_AMP, 0.04, 0);
      return [0, PEDESTRIAN_HIP_HEIGHT + s.hipOffsetY, 0];
    }),
    positionTrack('pedLeftLeg', gaitTimes, (t) => {
      const s = sampleGaitCycle(t, PEDESTRIAN_LEG_LENGTH, PEDESTRIAN_WALK_SWING_AMP, 0.04, 0);
      return [-0.11, s.leftLegLiftY, 0];
    }),
    positionTrack('pedRightLeg', gaitTimes, (t) => {
      const s = sampleGaitCycle(t, PEDESTRIAN_LEG_LENGTH, PEDESTRIAN_WALK_SWING_AMP, 0.04, 0);
      return [0.11, s.rightLegLiftY, 0];
    }),
    eulerTrack('pedLeftLeg', gaitTimes, (t) => {
      const s = sampleGaitCycle(t, PEDESTRIAN_LEG_LENGTH, PEDESTRIAN_WALK_SWING_AMP, 0.04, 0);
      return [s.leftLegX, 0, 0];
    }),
    eulerTrack('pedRightLeg', gaitTimes, (t) => {
      const s = sampleGaitCycle(t, PEDESTRIAN_LEG_LENGTH, PEDESTRIAN_WALK_SWING_AMP, 0.04, 0);
      return [s.rightLegX, 0, 0];
    }),
    eulerTrack('pedLeftArm', gaitTimes, (t) => [
      -1.02 + Math.sin(t * Math.PI * 2) * 0.04,
      0,
      0.04,
    ]),
    eulerTrack('pedRightArm', gaitTimes, (t) => [
      -1.02 - Math.sin(t * Math.PI * 2) * 0.04,
      0,
      -0.04,
    ]),
  ]);

  const idleTimes = buildSampleTimes(12, 4.0);
  const idleClip = new THREE.AnimationClip('ped_idle', 4.0, [
    positionTrack('pedBodyPivot', idleTimes, () => [0, PEDESTRIAN_HIP_HEIGHT, 0]),
    positionTrack('pedLeftLeg', idleTimes, () => [-0.11, 0, 0]),
    positionTrack('pedRightLeg', idleTimes, () => [0.11, 0, 0]),
    eulerTrack('pedLeftLeg', idleTimes, () => [0, 0, 0]),
    eulerTrack('pedRightLeg', idleTimes, () => [0, 0, 0]),
    eulerTrack('pedLeftArm', idleTimes, (t) => [
      Math.sin((t / 4.0) * Math.PI * 2) * 0.03,
      0,
      0.06,
    ]),
    eulerTrack('pedRightArm', idleTimes, (t) => [
      -Math.sin((t / 4.0) * Math.PI * 2) * 0.03,
      0,
      -0.06,
    ]),
  ]);

  const pushIdleClip = new THREE.AnimationClip('ped_push_idle', 4.0, [
    positionTrack('pedBodyPivot', idleTimes, () => [0, PEDESTRIAN_HIP_HEIGHT, 0]),
    positionTrack('pedLeftLeg', idleTimes, () => [-0.11, 0, 0]),
    positionTrack('pedRightLeg', idleTimes, () => [0.11, 0, 0]),
    eulerTrack('pedLeftLeg', idleTimes, () => [0, 0, 0]),
    eulerTrack('pedRightLeg', idleTimes, () => [0, 0, 0]),
    eulerTrack('pedLeftArm', idleTimes, () => [-1.02, 0, 0.04]),
    eulerTrack('pedRightArm', idleTimes, () => [-1.02, 0, -0.04]),
  ]);

  return {
    idle: idleClip,
    walk: walkClip,
    run: runClip,
    push_idle: pushIdleClip,
    push_walk: pushWalkClip,
  };
}

let cachedPedestrianClips: Record<PedestrianAnimState, THREE.AnimationClip> | null = null;
function getPedestrianClips(): Record<PedestrianAnimState, THREE.AnimationClip> {
  if (!cachedPedestrianClips) {
    cachedPedestrianClips = buildPedestrianAnimationClips();
  }
  return cachedPedestrianClips;
}

export class PedestrianCharacter {
  public readonly rig: PedestrianRig;
  public readonly mixer: THREE.AnimationMixer;
  public readonly actions: Record<PedestrianAnimState, THREE.AnimationAction>;
  private readonly blendEntries: Record<string, ActionBlendEntry> = {};
  public activeState: PedestrianAnimState = 'idle';
  public currentSpeedMps = 0;

  constructor(rig: PedestrianRig) {
    this.rig = rig;
    this.mixer = new THREE.AnimationMixer(rig.root);
    const clips = getPedestrianClips();
    const actions = {} as Record<PedestrianAnimState, THREE.AnimationAction>;

    (Object.keys(clips) as PedestrianAnimState[]).forEach((state) => {
      const action = this.mixer.clipAction(clips[state]);
      action.loop = THREE.LoopRepeat;
      action.enabled = state === 'idle';
      action.setEffectiveWeight(state === 'idle' ? 1 : 0);
      action.play();
      actions[state] = action;
      this.blendEntries[state] = {
        action,
        weight: state === 'idle' ? 1 : 0,
      };
    });

    this.actions = actions;
    this.mixer.update(0);
  }

  public getPlaybackTimeScale(state: PedestrianAnimState): number {
    return this.actions[state].timeScale;
  }

  public update(speedMps: number, dt: number, pushingCart = false): void {
    this.currentSpeedMps = Math.max(0, speedMps);
    const isMoving = this.currentSpeedMps > 0.06;

    const targetState: PedestrianAnimState = pushingCart
      ? isMoving
        ? 'push_walk'
        : 'push_idle'
      : !isMoving
        ? 'idle'
        : this.currentSpeedMps >= 1.6
          ? 'run'
          : 'walk';

    const prevState = this.activeState;
    if (
      (prevState === 'walk' && targetState === 'run') ||
      (prevState === 'run' && targetState === 'walk')
    ) {
      this.actions[targetState].time = this.actions[prevState].time;
    }
    this.activeState = targetState;

    const walkScale = computePlaybackTimeScale(
      this.currentSpeedMps,
      PEDESTRIAN_WALK_STRIDE_LENGTH
    );
    const runScale = computePlaybackTimeScale(
      this.currentSpeedMps,
      PEDESTRIAN_RUN_STRIDE_LENGTH
    );

    this.actions.walk.timeScale = walkScale;
    this.actions.push_walk.timeScale = walkScale;
    this.actions.run.timeScale = runScale;
    this.actions.idle.timeScale = 1;
    this.actions.push_idle.timeScale = 1;

    blendMixerActions(this.blendEntries, targetState, 10, dt);
    this.mixer.update(dt);
  }
}

/**
 * Builds a multi-part articulated pedestrian shopper with jacket, shoes, hair, and grocery tote.
 */
export function buildPedestrian(
  shadowTex: THREE.CanvasTexture,
  shirtColor = 0xf97316
): PedestrianRig {
  const root = new THREE.Group();

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.38, 16),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.62,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015;
  root.add(shadow);

  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.65 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.68 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xfdba74, roughness: 0.62 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.88 });
  const bagMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.72 });

  const bodyPivot = new THREE.Group();
  bodyPivot.name = 'pedBodyPivot';
  bodyPivot.position.set(0, PEDESTRIAN_HIP_HEIGHT, 0);
  root.add(bodyPivot);

  const makeLeg = (x: number, name: string) => {
    const pivot = new THREE.Group();
    pivot.name = name;
    pivot.position.set(x, 0, 0);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.42, 4, 8), pantsMat);
    leg.position.y = -0.32;
    leg.castShadow = true;
    pivot.add(leg);

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.22), shoeMat);
    shoe.position.set(0, -0.61, 0.04);
    shoe.castShadow = true;
    pivot.add(shoe);

    bodyPivot.add(pivot);
    return pivot;
  };
  const leftLeg = makeLeg(-0.11, 'pedLeftLeg');
  const rightLeg = makeLeg(0.11, 'pedRightLeg');

  // Jacket torso + collar (relative to bodyPivot at y = 0.66)
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.34, 6, 12), shirtMat);
  torso.scale.set(1.05, 1.0, 0.72);
  torso.position.set(0, 0.28, 0);
  torso.castShadow = true;
  bodyPivot.add(torso);

  const makeArm = (x: number, name: string) => {
    const pivot = new THREE.Group();
    pivot.name = name;
    pivot.position.set(x, 0.46, 0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.34, 4, 8), shirtMat);
    arm.position.y = -0.2;
    arm.castShadow = true;
    pivot.add(arm);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), skinMat);
    hand.position.y = -0.41;
    pivot.add(hand);

    bodyPivot.add(pivot);
    return pivot;
  };
  const leftArm = makeArm(-0.26, 'pedLeftArm');
  const rightArm = makeArm(0.26, 'pedRightArm');

  const bag = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, 0.14), bagMat);
  bag.position.set(0.03, -0.46, 0.04);
  rightArm.add(bag);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 12), skinMat);
  head.position.set(0, 0.72, 0);
  head.castShadow = true;
  bodyPivot.add(head);

  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.56),
    hairMat
  );
  cap.position.set(0, 0.74, 0);
  bodyPivot.add(cap);

  const rig: PedestrianRig = {
    root,
    bodyPivot,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
  };
  rig.character = new PedestrianCharacter(rig);
  return rig;
}
