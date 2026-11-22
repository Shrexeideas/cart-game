import * as THREE from 'three';
import { expDamp } from './cartPhysicsMath';
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
import type { OwnerAnimState, OwnerExpression } from './types';

export const OWNER_HIP_HEIGHT = 0.72;
export const OWNER_LEG_LENGTH = 0.71;
export const OWNER_WALK_SWING_AMP = 0.44;
export const OWNER_RUN_SWING_AMP = 0.62;
export const OWNER_WALK_STRIDE_LENGTH = computeStrideLength(
  OWNER_LEG_LENGTH,
  OWNER_WALK_SWING_AMP,
  1.0
);
export const OWNER_RUN_STRIDE_LENGTH = computeStrideLength(
  OWNER_LEG_LENGTH,
  OWNER_RUN_SWING_AMP,
  1.0
);

export interface OwnerRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  torsoPivot: THREE.Group;
  headPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  leftBrow: THREE.Mesh;
  rightBrow: THREE.Mesh;
  mouthMesh: THREE.Mesh;
  faceMat: THREE.MeshStandardMaterial;
  walkPhase: number;
  character?: StoreOwnerCharacter;
}

function buildSampleTimes(steps: number, duration: number): number[] {
  const times: number[] = [];
  for (let i = 0; i <= steps; i++) {
    times.push((i / steps) * duration);
  }
  return times;
}

function buildOwnerAnimationClips(): Record<OwnerAnimState, THREE.AnimationClip> {
  // 1. Walk (1.0s normalized = 1 full 2-step stride of OWNER_WALK_STRIDE_LENGTH meters)
  const walkTimes = buildSampleTimes(24, GAIT_CLIP_DURATION);
  const walkClip = new THREE.AnimationClip('owner_walk', GAIT_CLIP_DURATION, [
    positionTrack('ownerBodyPivot', walkTimes, (t) => {
      const s = sampleGaitCycle(t, OWNER_LEG_LENGTH, OWNER_WALK_SWING_AMP, 0.045, 0);
      return [0, OWNER_HIP_HEIGHT + s.hipOffsetY, 0];
    }),
    positionTrack('ownerLeftLegPivot', walkTimes, (t) => {
      const s = sampleGaitCycle(t, OWNER_LEG_LENGTH, OWNER_WALK_SWING_AMP, 0.045, 0);
      return [-0.14, s.leftLegLiftY, 0];
    }),
    positionTrack('ownerRightLegPivot', walkTimes, (t) => {
      const s = sampleGaitCycle(t, OWNER_LEG_LENGTH, OWNER_WALK_SWING_AMP, 0.045, 0);
      return [0.14, s.rightLegLiftY, 0];
    }),
    eulerTrack('ownerLeftLegPivot', walkTimes, (t) => {
      const s = sampleGaitCycle(t, OWNER_LEG_LENGTH, OWNER_WALK_SWING_AMP, 0.045, 0);
      return [s.leftLegX, 0, 0];
    }),
    eulerTrack('ownerRightLegPivot', walkTimes, (t) => {
      const s = sampleGaitCycle(t, OWNER_LEG_LENGTH, OWNER_WALK_SWING_AMP, 0.045, 0);
      return [s.rightLegX, 0, 0];
    }),
    eulerTrack('ownerLeftArmPivot', walkTimes, (t) => {
      const s = sampleGaitCycle(t, OWNER_LEG_LENGTH, OWNER_WALK_SWING_AMP, 0.045, 0);
      return [-s.leftLegX * 0.52, 0, 0.1];
    }),
    eulerTrack('ownerRightArmPivot', walkTimes, (t) => {
      const s = sampleGaitCycle(t, OWNER_LEG_LENGTH, OWNER_WALK_SWING_AMP, 0.045, 0);
      return [-s.rightLegX * 0.52, 0, -0.1];
    }),
    eulerTrack('ownerTorsoPivot', walkTimes, (t) => [
      0.05,
      Math.sin(t * Math.PI * 2) * 0.04,
      0,
    ]),
    eulerTrack('ownerHeadPivot', walkTimes, () => [0, 0, 0]),
  ]);

  // 2. Run (1.0s normalized = 1 full 2-step stride of OWNER_RUN_STRIDE_LENGTH meters)
  const runTimes = buildSampleTimes(24, GAIT_CLIP_DURATION);
  const runClip = new THREE.AnimationClip('owner_run', GAIT_CLIP_DURATION, [
    positionTrack('ownerBodyPivot', runTimes, (t) => {
      const s = sampleGaitCycle(t, OWNER_LEG_LENGTH, OWNER_RUN_SWING_AMP, 0.085, 0.032);
      return [0, OWNER_HIP_HEIGHT + s.hipOffsetY, 0];
    }),
    positionTrack('ownerLeftLegPivot', runTimes, (t) => {
      const s = sampleGaitCycle(t, OWNER_LEG_LENGTH, OWNER_RUN_SWING_AMP, 0.085, 0.032);
      return [-0.14, s.leftLegLiftY, 0];
    }),
    positionTrack('ownerRightLegPivot', runTimes, (t) => {
      const s = sampleGaitCycle(t, OWNER_LEG_LENGTH, OWNER_RUN_SWING_AMP, 0.085, 0.032);
      return [0.14, s.rightLegLiftY, 0];
    }),
    eulerTrack('ownerLeftLegPivot', runTimes, (t) => {
      const s = sampleGaitCycle(t, OWNER_LEG_LENGTH, OWNER_RUN_SWING_AMP, 0.085, 0.032);
      return [s.leftLegX, 0, 0];
    }),
    eulerTrack('ownerRightLegPivot', runTimes, (t) => {
      const s = sampleGaitCycle(t, OWNER_LEG_LENGTH, OWNER_RUN_SWING_AMP, 0.085, 0.032);
      return [s.rightLegX, 0, 0];
    }),
    eulerTrack('ownerLeftArmPivot', runTimes, (t) => {
      const s = sampleGaitCycle(t, OWNER_LEG_LENGTH, OWNER_RUN_SWING_AMP, 0.085, 0.032);
      return [-s.leftLegX * 0.78 - 0.24, 0, 0.18];
    }),
    eulerTrack('ownerRightArmPivot', runTimes, (t) => {
      const s = sampleGaitCycle(t, OWNER_LEG_LENGTH, OWNER_RUN_SWING_AMP, 0.085, 0.032);
      return [-s.rightLegX * 0.78 - 0.24, 0, -0.18];
    }),
    eulerTrack('ownerTorsoPivot', runTimes, (t) => [
      0.15,
      Math.sin(t * Math.PI * 2) * 0.06,
      0,
    ]),
    eulerTrack('ownerHeadPivot', runTimes, () => [-0.06, 0, 0]),
  ]);

  // 3. Angry walk (same stride kinematics so zero foot slide, plus tense forward lean & sharp arm pump)
  const angryWalkClip = new THREE.AnimationClip('owner_angry_walk', GAIT_CLIP_DURATION, [
    positionTrack('ownerBodyPivot', walkTimes, (t) => {
      const s = sampleGaitCycle(t, OWNER_LEG_LENGTH, OWNER_WALK_SWING_AMP, 0.052, 0.01);
      return [0, OWNER_HIP_HEIGHT + s.hipOffsetY, 0];
    }),
    positionTrack('ownerLeftLegPivot', walkTimes, (t) => {
      const s = sampleGaitCycle(t, OWNER_LEG_LENGTH, OWNER_WALK_SWING_AMP, 0.052, 0.01);
      return [-0.14, s.leftLegLiftY, 0];
    }),
    positionTrack('ownerRightLegPivot', walkTimes, (t) => {
      const s = sampleGaitCycle(t, OWNER_LEG_LENGTH, OWNER_WALK_SWING_AMP, 0.052, 0.01);
      return [0.14, s.rightLegLiftY, 0];
    }),
    eulerTrack('ownerLeftLegPivot', walkTimes, (t) => {
      const s = sampleGaitCycle(t, OWNER_LEG_LENGTH, OWNER_WALK_SWING_AMP, 0.052, 0.01);
      return [s.leftLegX, 0, 0];
    }),
    eulerTrack('ownerRightLegPivot', walkTimes, (t) => {
      const s = sampleGaitCycle(t, OWNER_LEG_LENGTH, OWNER_WALK_SWING_AMP, 0.052, 0.01);
      return [s.rightLegX, 0, 0];
    }),
    eulerTrack('ownerLeftArmPivot', walkTimes, (t) => {
      const s = sampleGaitCycle(t, OWNER_LEG_LENGTH, OWNER_WALK_SWING_AMP, 0.052, 0.01);
      return [-s.leftLegX * 0.72 - 0.35, 0, 0.16];
    }),
    eulerTrack('ownerRightArmPivot', walkTimes, (t) => {
      const s = sampleGaitCycle(t, OWNER_LEG_LENGTH, OWNER_WALK_SWING_AMP, 0.052, 0.01);
      return [-s.rightLegX * 0.72 - 0.35, 0, -0.16];
    }),
    eulerTrack('ownerTorsoPivot', walkTimes, (t) => [
      0.13,
      Math.sin(t * Math.PI * 2) * 0.075,
      0,
    ]),
    eulerTrack('ownerHeadPivot', walkTimes, () => [-0.08, 0, 0]),
  ]);

  // 4. Turn-in-place pivot step cycle (natural small stepping lifts so stationary yaw turns aren't rigid)
  const turnDuration = 0.72;
  const turnTimes = buildSampleTimes(16, turnDuration);
  const turnClip = new THREE.AnimationClip('owner_turn', turnDuration, [
    positionTrack('ownerBodyPivot', turnTimes, (t) => {
      const u = (t / turnDuration) * Math.PI * 2;
      return [0, OWNER_HIP_HEIGHT - 0.015 + Math.abs(Math.sin(u)) * 0.018, 0];
    }),
    positionTrack('ownerLeftLegPivot', turnTimes, (t) => {
      const u = (t / turnDuration) * Math.PI * 2;
      return [-0.14, Math.max(0, Math.sin(u)) * 0.045, 0];
    }),
    positionTrack('ownerRightLegPivot', turnTimes, (t) => {
      const u = (t / turnDuration) * Math.PI * 2;
      return [0.14, Math.max(0, -Math.sin(u)) * 0.045, 0];
    }),
    eulerTrack('ownerLeftLegPivot', turnTimes, (t) => {
      const u = (t / turnDuration) * Math.PI * 2;
      return [Math.sin(u) * 0.1, 0, 0];
    }),
    eulerTrack('ownerRightLegPivot', turnTimes, (t) => {
      const u = (t / turnDuration) * Math.PI * 2;
      return [-Math.sin(u) * 0.1, 0, 0];
    }),
    eulerTrack('ownerLeftArmPivot', turnTimes, (t) => {
      const u = (t / turnDuration) * Math.PI * 2;
      return [-0.14 + Math.cos(u) * 0.08, 0, 0.14];
    }),
    eulerTrack('ownerRightArmPivot', turnTimes, (t) => {
      const u = (t / turnDuration) * Math.PI * 2;
      return [-0.14 - Math.cos(u) * 0.08, 0, -0.14];
    }),
    eulerTrack('ownerTorsoPivot', turnTimes, (t) => {
      const u = (t / turnDuration) * Math.PI * 2;
      return [0.03, Math.sin(u) * 0.08, 0];
    }),
    eulerTrack('ownerHeadPivot', turnTimes, () => [0, 0, 0]),
  ]);

  const makeStandingClip = (
    name: string,
    duration: number,
    steps: number,
    evalPose: (u: number) => {
      torso: [number, number, number];
      head: [number, number, number];
      lArm: [number, number, number];
      rArm: [number, number, number];
    }
  ): THREE.AnimationClip => {
    const times = buildSampleTimes(steps, duration);
    const phaseOf = (t: number) => (t / duration) * Math.PI * 2;
    return new THREE.AnimationClip(name, duration, [
      positionTrack('ownerBodyPivot', times, () => [0, OWNER_HIP_HEIGHT, 0]),
      positionTrack('ownerLeftLegPivot', times, () => [-0.14, 0, 0]),
      positionTrack('ownerRightLegPivot', times, () => [0.14, 0, 0]),
      eulerTrack('ownerLeftLegPivot', times, () => [0, 0, 0]),
      eulerTrack('ownerRightLegPivot', times, () => [0, 0, 0]),
      eulerTrack('ownerTorsoPivot', times, (t) => evalPose(phaseOf(t)).torso),
      eulerTrack('ownerHeadPivot', times, (t) => evalPose(phaseOf(t)).head),
      eulerTrack('ownerLeftArmPivot', times, (t) => evalPose(phaseOf(t)).lArm),
      eulerTrack('ownerRightArmPivot', times, (t) => evalPose(phaseOf(t)).rArm),
    ]);
  };

  return {
    walk: walkClip,
    angry_walk: angryWalkClip,
    run: runClip,
    turn: turnClip,
    idle: makeStandingClip('owner_idle', 4.6, 16, (u) => ({
      torso: [Math.sin(u) * 0.018, 0, 0],
      head: [0, Math.sin(u * 0.5) * 0.04, 0],
      lArm: [Math.sin(u) * 0.03, 0, 0.1],
      rArm: [-Math.sin(u) * 0.03, 0, -0.1],
    })),
    point: makeStandingClip('owner_point', 2.0, 12, (u) => ({
      torso: [0.08 + Math.sin(u) * 0.015, 0, 0],
      head: [0, 0, 0],
      lArm: [0, 0, 0.2],
      rArm: [-1.42 + Math.sin(u) * 0.04, 0, -0.05],
    })),
    angry_gesture: makeStandingClip('owner_angry_gesture', 1.2, 14, (u) => ({
      torso: [Math.sin(u) * 0.05, 0, 0],
      head: [0, 0, Math.sin(u) * 0.04],
      lArm: [-1.15 + Math.sin(u) * 0.28, 0, 0.38],
      rArm: [-1.15 + Math.cos(u) * 0.28, 0, -0.38],
    })),
    shake_fist: makeStandingClip('owner_shake_fist', 0.92, 14, (u) => ({
      torso: [0.1, 0, 0],
      head: [0, 0, Math.sin(u) * 0.06],
      lArm: [-0.52, 0, 0.34],
      rArm: [-2.05 + Math.sin(u) * 0.24, 0, -0.18],
    })),
    hands_on_head: makeStandingClip('owner_hands_on_head', 1.8, 12, (u) => ({
      torso: [-0.06 + Math.sin(u) * 0.03, 0, 0],
      head: [0.18, 0, Math.sin(u) * 0.03],
      lArm: [-2.55, 0, -0.52],
      rArm: [-2.55, 0, 0.52],
    })),
    shocked: makeStandingClip('owner_shocked', 1.4, 14, (u) => ({
      torso: [-0.16 + Math.sin(u) * 0.025, 0, 0],
      head: [-0.14, Math.sin(u * 0.5) * 0.06, 0],
      lArm: [-1.75 + Math.sin(u) * 0.12, 0, 0.68],
      rArm: [-1.75 + Math.sin(u) * 0.12, 0, -0.68],
    })),
    facepalm: makeStandingClip('owner_facepalm', 2.6, 14, (u) => ({
      torso: [0.04, 0, 0],
      head: [0.24, 0, Math.sin(u) * 0.05],
      lArm: [0, 0, 0.14],
      rArm: [-2.3, 0, 0.4],
    })),
    arms_crossed: makeStandingClip('owner_arms_crossed', 4.5, 16, (u) => ({
      torso: [0, Math.sin(u) * 0.04, 0],
      head: [0, 0, 0.06],
      lArm: [-1.02, 0, -0.7],
      rArm: [-1.02, 0, 0.7],
    })),
    celebrate: makeStandingClip('owner_celebrate', 1.3, 14, (u) => ({
      torso: [0, Math.sin(u) * 0.12, 0],
      head: [-0.1, 0, 0],
      lArm: [-2.65 + Math.sin(u) * 0.2, 0, 0.4],
      rArm: [-2.65 - Math.sin(u) * 0.2, 0, -0.4],
    })),
  };
}

let cachedOwnerClips: Record<OwnerAnimState, THREE.AnimationClip> | null = null;
function getOwnerClips(): Record<OwnerAnimState, THREE.AnimationClip> {
  if (!cachedOwnerClips) {
    cachedOwnerClips = buildOwnerAnimationClips();
  }
  return cachedOwnerClips;
}

export class StoreOwnerCharacter {
  public readonly rig: OwnerRig;
  public readonly mixer: THREE.AnimationMixer;
  public readonly actions: Record<OwnerAnimState, THREE.AnimationAction>;
  private readonly blendEntries: Record<string, ActionBlendEntry> = {};
  public activeState: OwnerAnimState = 'idle';
  public currentSpeedMps = 0;

  constructor(rig: OwnerRig) {
    this.rig = rig;
    this.mixer = new THREE.AnimationMixer(rig.root);
    const clips = getOwnerClips();
    const actions = {} as Record<OwnerAnimState, THREE.AnimationAction>;

    (Object.keys(clips) as OwnerAnimState[]).forEach((state) => {
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

  public getPlaybackTimeScale(state: OwnerAnimState): number {
    return this.actions[state].timeScale;
  }

  public getActiveStepIntervalSeconds(): number {
    const activeScale = Math.max(0.25, this.actions[this.activeState].timeScale);
    return 0.5 / activeScale;
  }

  public update(
    anim: OwnerAnimState,
    expression: OwnerExpression,
    speedMps: number,
    dt: number
  ): void {
    const prevState = this.activeState;
    this.activeState = anim;
    this.currentSpeedMps = Math.max(0, speedMps);

    const isLocomotion = (s: OwnerAnimState) => s === 'walk' || s === 'angry_walk' || s === 'run';
    // Phase-sync walk <-> angry_walk <-> run so stride transitions never pop legs
    if (isLocomotion(prevState) && isLocomotion(anim) && prevState !== anim) {
      this.actions[anim].time = this.actions[prevState].time;
    }

    // Calibrate locomotion timeScale strictly to actual ground speed / strideLength
    const walkScale = computePlaybackTimeScale(this.currentSpeedMps, OWNER_WALK_STRIDE_LENGTH);
    const runScale = computePlaybackTimeScale(this.currentSpeedMps, OWNER_RUN_STRIDE_LENGTH);
    this.actions.walk.timeScale = walkScale;
    this.actions.angry_walk.timeScale = walkScale;
    this.actions.run.timeScale = runScale;

    // Keep standing & reaction gesture clips at natural 1.0x cadence
    this.actions.idle.timeScale = 1;
    this.actions.turn.timeScale = 1;
    this.actions.point.timeScale = 1;
    this.actions.angry_gesture.timeScale = 1;
    this.actions.shake_fist.timeScale = 1;
    this.actions.hands_on_head.timeScale = 1;
    this.actions.shocked.timeScale = 1;
    this.actions.facepalm.timeScale = 1;
    this.actions.arms_crossed.timeScale = 1;
    this.actions.celebrate.timeScale = 1;

    blendMixerActions(this.blendEntries, anim, 10, dt);
    this.mixer.update(dt);

    // Keep walkPhase synchronized with actual stride cycle angle for telemetry/compat
    if (anim === 'walk' || anim === 'angry_walk' || anim === 'run') {
      const stride = anim === 'run' ? OWNER_RUN_STRIDE_LENGTH : OWNER_WALK_STRIDE_LENGTH;
      this.rig.walkPhase += ((this.currentSpeedMps * dt) / stride) * (Math.PI * 2);
    }

    updateOwnerFacialExpression(this.rig, expression, dt);
  }
}

const _targetFaceColor = new THREE.Color();

function updateOwnerFacialExpression(
  rig: OwnerRig,
  expression: OwnerExpression,
  dt: number
): void {
  const faceRate = 6.5;
  let browTilt = 0;
  let browY = 0.275;
  let mouthScaleY = 1;
  let mouthScaleX = 1;
  let faceTint = 0xfdba74;

  switch (expression) {
    case 'neutral':
      browTilt = 0;
      mouthScaleY = 0.6;
      break;
    case 'annoyed':
      browTilt = 0.22;
      browY = 0.265;
      mouthScaleX = 1.1;
      mouthScaleY = 0.7;
      break;
    case 'angry':
      browTilt = 0.45;
      browY = 0.255;
      mouthScaleY = 1.6;
      faceTint = 0xfca5a5;
      break;
    case 'furious':
      browTilt = 0.65;
      browY = 0.248;
      mouthScaleX = 1.35;
      mouthScaleY = 2.4;
      faceTint = 0xf87171;
      break;
    case 'shocked':
      browTilt = -0.25;
      browY = 0.305;
      mouthScaleX = 0.8;
      mouthScaleY = 2.8;
      break;
    case 'impressed':
      browTilt = -0.2;
      browY = 0.295;
      mouthScaleX = 1.4;
      mouthScaleY = 1.1;
      break;
  }

  rig.leftBrow.rotation.z = expDamp(rig.leftBrow.rotation.z, -browTilt, faceRate, dt);
  rig.rightBrow.rotation.z = expDamp(rig.rightBrow.rotation.z, browTilt, faceRate, dt);
  rig.leftBrow.position.y = expDamp(rig.leftBrow.position.y, browY, faceRate, dt);
  rig.rightBrow.position.y = expDamp(rig.rightBrow.position.y, browY, faceRate, dt);
  rig.mouthMesh.scale.set(
    expDamp(rig.mouthMesh.scale.x, mouthScaleX, faceRate, dt),
    expDamp(rig.mouthMesh.scale.y, mouthScaleY, faceRate, dt),
    1
  );
  _targetFaceColor.setHex(faceTint);
  rig.faceMat.color.lerp(_targetFaceColor, Math.min(1, dt * 4.5));
}

export function buildStoreOwner(shadowTex: THREE.CanvasTexture): OwnerRig {
  const root = new THREE.Group();

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.46, 18),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.68,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015;
  root.add(shadow);

  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.86 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.72 });
  const apronMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.78 });
  const tieMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.45 });
  const faceMat = new THREE.MeshStandardMaterial({ color: 0xfdba74, roughness: 0.62 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.85 });
  const darkFeatureMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });

  // Unified pelvis pivot at hip height (y = 0.72m) so stride drop moves legs & torso together
  const bodyPivot = new THREE.Group();
  bodyPivot.name = 'ownerBodyPivot';
  bodyPivot.position.set(0, OWNER_HIP_HEIGHT, 0);
  root.add(bodyPivot);

  // Articulated legs pivoted at hip (local y = 0 -> world y = 0.72; sole at -0.71m)
  const makeLeg = (x: number, name: string) => {
    const pivot = new THREE.Group();
    pivot.name = name;
    pivot.position.set(x, 0, 0);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.44, 4, 8), pantsMat);
    leg.position.y = -0.34;
    leg.castShadow = true;
    pivot.add(leg);

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.24), shoeMat);
    shoe.position.set(0, -0.66, 0.04);
    shoe.castShadow = true;
    pivot.add(shoe);

    bodyPivot.add(pivot);
    return pivot;
  };

  const leftLegPivot = makeLeg(-0.14, 'ownerLeftLegPivot');
  const rightLegPivot = makeLeg(0.14, 'ownerRightLegPivot');

  // Upper body pivot at waist (local y = 0 on bodyPivot)
  const torsoPivot = new THREE.Group();
  torsoPivot.name = 'ownerTorsoPivot';
  torsoPivot.position.set(0, 0, 0);
  bodyPivot.add(torsoPivot);

  // Shirt torso + apron + boss tie
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.62, 0.3), shirtMat);
  torso.position.y = 0.34;
  torso.castShadow = true;
  torsoPivot.add(torso);

  const apron = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.52, 0.04), apronMat);
  apron.position.set(0, 0.28, 0.155);
  torsoPivot.add(apron);

  const badge = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.06, 0.02),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3 })
  );
  badge.position.set(-0.1, 0.46, 0.175);
  torsoPivot.add(badge);

  const tie = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.26, 0.03), tieMat);
  tie.position.set(0, 0.46, 0.17);
  torsoPivot.add(tie);

  // Articulated arms pivoted at shoulders (y = 0.58 relative to torso)
  const makeArm = (x: number, name: string) => {
    const pivot = new THREE.Group();
    pivot.name = name;
    pivot.position.set(x, 0.58, 0);
    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.36, 4, 8), shirtMat);
    sleeve.position.y = -0.22;
    sleeve.castShadow = true;
    pivot.add(sleeve);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), faceMat);
    hand.position.y = -0.46;
    pivot.add(hand);

    torsoPivot.add(pivot);
    return pivot;
  };

  const leftArmPivot = makeArm(-0.33, 'ownerLeftArmPivot');
  const rightArmPivot = makeArm(0.33, 'ownerRightArmPivot');

  // Head pivot at neck (y = 0.68 relative to torso)
  const headPivot = new THREE.Group();
  headPivot.name = 'ownerHeadPivot';
  headPivot.position.set(0, 0.68, 0);
  torsoPivot.add(headPivot);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 16, 14), faceMat);
  head.position.y = 0.2;
  head.castShadow = true;
  headPivot.add(head);

  const hairRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.045, 6, 16, Math.PI * 1.35),
    hairMat
  );
  hairRim.rotation.x = Math.PI / 2;
  hairRim.rotation.z = -Math.PI * 0.18;
  hairRim.position.set(0, 0.25, -0.02);
  headPivot.add(hairRim);

  const eyeGeo = new THREE.SphereGeometry(0.028, 8, 8);
  for (const sx of [-0.075, 0.075]) {
    const eye = new THREE.Mesh(eyeGeo, darkFeatureMat);
    eye.position.set(sx, 0.22, 0.185);
    headPivot.add(eye);
  }

  const browGeo = new THREE.BoxGeometry(0.085, 0.026, 0.03);
  const leftBrow = new THREE.Mesh(browGeo, hairMat);
  leftBrow.position.set(-0.078, 0.275, 0.19);
  headPivot.add(leftBrow);

  const rightBrow = new THREE.Mesh(browGeo, hairMat);
  rightBrow.position.set(0.078, 0.275, 0.19);
  headPivot.add(rightBrow);

  const stache = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.045, 0.045), hairMat);
  stache.position.set(0, 0.155, 0.195);
  headPivot.add(stache);

  const mouthMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.035, 0.03),
    new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.6 })
  );
  mouthMesh.position.set(0, 0.1, 0.19);
  headPivot.add(mouthMesh);

  const rig: OwnerRig = {
    root,
    bodyPivot,
    torsoPivot,
    headPivot,
    leftLegPivot,
    rightLegPivot,
    leftArmPivot,
    rightArmPivot,
    leftBrow,
    rightBrow,
    mouthMesh,
    faceMat,
    walkPhase: 0,
  };
  rig.character = new StoreOwnerCharacter(rig);
  return rig;
}

export function animateOwnerRig(
  rig: OwnerRig,
  anim: OwnerAnimState,
  expression: OwnerExpression,
  moveDistance: number,
  _time: number,
  dt: number
): void {
  if (!rig.character) {
    rig.character = new StoreOwnerCharacter(rig);
  }
  const speedMps = dt > 0 ? moveDistance / dt : 0;
  rig.character.update(anim, expression, speedMps, dt);
}
