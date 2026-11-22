import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import RAPIER from '@dimforge/rapier3d-compat';
import { getLevelById } from './levels';
import {
  applyCartModifiersToHandling,
  getCartDefinition,
} from './carts';
import {
  type CasterState,
  clampAngle,
  evaluateBayPose,
  expDamp,
  stepCartDynamics,
} from './cartPhysicsMath';
import {
  applyAngerDelta,
  computeOwnerReaction,
  createInitialOwnerSnapshot,
  getAngerStage,
} from './ownerLogic';
import { evaluateParkingScore, forecastStars } from './scoring';
import {
  type CartVisualRig,
  type PedestrianRig,
  buildBench,
  buildBollard,
  buildCartCorral,
  buildIsland,
  buildLoadingDock,
  buildParkedCar,
  buildParkingBarrier,
  buildParkingSign,
  buildPedestrian,
  buildShoppingCart,
  buildSupermarketBackdrop,
  buildTrashBin,
  buildWheelStop,
  createAsphaltTextures,
  createParkingBayTexture,
  createRadialShadowTexture,
} from './models';
import { buildCustomShoppingCart } from './cartModels';
import { type OwnerRig, StoreOwnerCharacter, buildStoreOwner } from './ownerModel';
import { PedestrianCharacter } from './pedestrianModel';
import {
  type DynamicCircleObstacle,
  type NavGrid,
  buildNavGrid,
  computeLocalAvoidance,
  findGridPath,
  resolveCircleObstacles,
} from './npcNavigation';
import { type PreviousBayHint, SCENARIO_LABELS } from './parkingGenerator';
import {
  CANDIDATE_PARKING_BAYS,
  LOT_CENTER_Z,
  PLAYABLE_MAX_X,
  PLAYABLE_MAX_Z,
  PLAYABLE_MIN_X,
  PLAYABLE_MIN_Z,
} from './worldLayout';
import {
  type DriftConfig,
  type DriftTelemetry,
  DEFAULT_DRIFT_CONFIG,
  createInitialDriftTelemetry,
  stepDriftDetector,
} from './cartDrift';
import { SoundEngine } from './audio';
import type {
  CameraMode,
  CartDefinition,
  CartHandlingProfile,
  CartId,
  CosmeticLoadout,
  GameMode,
  GamePhase,
  HudSnapshot,
  InputState,
  LevelConfig,
  ObstacleSpec,
  OwnerAnimState,
  OwnerExpression,
  OwnerStateSnapshot,
  OwnerTrigger,
  ParkingEvaluation,
  PhysicsEventType,
  Vec2,
  WeatherTheme,
} from './types';

interface MovingActorRuntime {
  specId: string;
  kind: 'pedestrian' | 'rogue_cart' | 'car_cruise' | 'pedestrian_cart';
  startX: number;
  startZ: number;
  endX: number;
  endZ: number;
  speed: number;
  currentSpeed: number;
  phaseOffset: number;
  progress: number;
  dir: 1 | -1;
  curX: number;
  curZ: number;
  body: RAPIER.RigidBody;
  colliderHandle: number;
  extraColliderHandles?: number[];
  mesh: THREE.Group;
  pedRig?: PedestrianRig;
  pedCharacter?: PedestrianCharacter;
  cartRig?: CartVisualRig;
}

interface DynamicLooseCart {
  body: RAPIER.RigidBody;
  colliderHandle: number;
  rig: CartVisualRig;
  wheelAngle: number;
}

interface DroppedBag {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rotSpeed: number;
  mesh: THREE.Mesh;
}

interface Particle {
  active: boolean;
  life: number;
  maxLife: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  scale: number;
}

export interface EngineCallbacks {
  onHudUpdate: (hud: HudSnapshot) => void;
  onLevelComplete: (evaluation: ParkingEvaluation, level: LevelConfig) => void;
  onReady: () => void;
}

const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _scaleVec = new THREE.Vector3();

function detectSoftwareGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

export class CartChaosEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  public readonly sound = new SoundEngine();

  private isSoftwareGl = false;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private levelGroup = new THREE.Group();

  private hemiLight!: THREE.HemisphereLight;
  private sunLight!: THREE.DirectionalLight;
  private rimLight!: THREE.DirectionalLight;

  private shadowTex!: THREE.CanvasTexture;
  private groundTexMap: THREE.CanvasTexture | null = null;
  private groundTexBump: THREE.CanvasTexture | null = null;
  private envTexture: THREE.Texture | null = null;
  private bayMesh: THREE.Mesh | null = null;
  private bayBeaconGroup = new THREE.Group();
  private bayCornerLights: THREE.Mesh[] = [];
  private bayChevronMesh: THREE.Mesh | null = null;

  private playerRig!: CartVisualRig;
  private cartBody: RAPIER.RigidBody | null = null;
  private cartColliderHandle = -1;
  private prevCartPose = { x: 0, y: 0.44, z: 0, yaw: 0 };
  private curCartPose = { x: 0, y: 0.44, z: 0, yaw: 0 };
  private driftConfig: DriftConfig = { ...DEFAULT_DRIFT_CONFIG };
  private driftTelemetry: DriftTelemetry = createInitialDriftTelemetry();
  private obstacleHandles = new Set<number>();
  private carHandles = new Set<number>();
  private parkedCartHandles = new Set<number>();
  private curbHandles = new Set<number>();
  private actorHandles = new Map<number, MovingActorRuntime>();
  private looseCartHandles = new Set<number>();
  private dynamicLooseCarts: DynamicLooseCart[] = [];

  // Navigation Grid & Store Owner NPC runtime
  private navGrid: NavGrid | null = null;
  private ownerRig!: OwnerRig;
  private ownerCharacter: StoreOwnerCharacter | null = null;
  private ownerBody: RAPIER.RigidBody | null = null;
  private ownerColliderHandle = -1;
  private ownerPos = new THREE.Vector3(5.6, 0, -4.6);
  private ownerYaw = 0;
  private ownerCurrentSpeed = 0;
  private ownerAnger = 8;
  private ownerStage: 1 | 2 | 3 | 4 | 5 = 1;
  private ownerAnim: OwnerAnimState = 'idle';
  private ownerExpression: OwnerExpression = 'neutral';
  private ownerDialogue: string | null = null;
  private ownerDialogueTimer = 0;
  private ownerRecentDialogues: string[] = [];
  private ownerReactionTimer = 0;
  private ownerApproachTimer = 0;
  private ownerFootstepTimer = 0;
  private ownerMeltdownTimer = 0;
  private ownerSurvivedStage5 = false;
  private ownerPath: Vec2[] = [];
  private ownerPathTimer = 0;
  private ownerLastGoal = { x: 0, z: 0 };
  private ownerBlockedCooldown = 0;
  private ownerEscapedCooldown = 0;
  private slowWarningSent = false;
  private circleSpinAccum = 0;
  private wasInBay = false;
  private lineCrossCount = 0;

  private rapierReady = false;
  private world: RAPIER.World | null = null;
  private eventQueue: RAPIER.EventQueue | null = null;
  private movingActors: MovingActorRuntime[] = [];

  private particles: Particle[] = [];
  private particleMesh!: THREE.InstancedMesh;
  private particleCursor = 0;
  private trailAccum = 0;

  private droppedBags: DroppedBag[] = [];
  private bagCursor = 0;

  private phase: GamePhase = 'title';
  private gameMode: GameMode = 'career';
  private cameraMode: CameraMode = 'chase';
  private level: LevelConfig = getLevelById(1);
  private activeCartDef: CartDefinition = getCartDefinition('classic');
  private activeHandling: CartHandlingProfile = this.level.handling;
  private activeCosmetics: Partial<CosmeticLoadout> = {};
  private coinsDisplay = 0;
  private levelSeed = (Date.now() ^ Math.floor(Math.random() * 0xffffff)) >>> 0;
  private recentBayIds: string[] = [];
  private lastCompletedBay: PreviousBayHint | undefined;
  private hasCompletedRound = false;

  private input: InputState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    brake: false,
  };
  private orbitInput = { left: false, right: false };
  private camYawOffset = 0;
  private camZoom = 1.0;
  private pointerDragging = false;
  private lastPointerX = 0;

  private prevSteerDir = 0;
  private casterState: CasterState = {
    leftAngle: 0,
    rightAngle: 0,
    steerSmoothed: 0,
    wobblePhase: 0,
  };

  private elapsedTime = 0;
  private timeLimit: number | null = null;
  private collisions = 0;
  private steeringCorrections = 0;
  private collisionCooldown = 0;
  private hitstopTimer = 0;
  private cameraTrauma = 0;
  private parkProgress = 0;
  private wheelSpinAngle = 0;
  private titleOrbitTime = 0;

  private nextEventTimer = 10;
  private wobbleTimer = 0;
  private reverseDriftTimer = 0;
  private curbSnagTimer = 0;
  private eventBanner: string | null = null;
  private eventBannerTimer = 0;

  private camPos = new THREE.Vector3(-8, 5.5, 8);
  private camLook = new THREE.Vector3(0, 0.6, 0);

  private disposed = false;
  private frameId = 0;
  private lastTimestamp = 0;
  private physicsAccum = 0;
  private hudEmitTimer = 0;
  private resizeObserver: ResizeObserver | null = null;

  constructor(container: HTMLElement, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
  }

  private getViewportSize(): { width: number; height: number } {
    const rect = this.container?.getBoundingClientRect();
    const rawW = rect?.width || this.container?.clientWidth || window.innerWidth;
    const rawH = rect?.height || this.container?.clientHeight || window.innerHeight;
    return {
      width: Math.max(240, Math.round(rawW)),
      height: Math.max(200, Math.round(rawH)),
    };
  }

  public async init(): Promise<void> {
    this.isSoftwareGl = detectSoftwareGl();

    const { width, height } = this.getViewportSize();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(width, height, false);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const skyColor = new THREE.Color(0xdbeafe);
    this.scene.background = skyColor;
    this.scene.fog = new THREE.Fog(skyColor, 34, 92);

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTexture;
    pmremGenerator.dispose();

    this.camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 160);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);

    this.setupLighting();
    this.setupStaticGround();
    this.setupParticleAndBagPools();
    this.bindCameraInputListeners();

    this.scene.add(this.levelGroup);

    await RAPIER.init();
    this.rapierReady = true;

    this.loadLevel(1, 'title', this.gameMode, this.activeCartDef.id, this.activeCosmetics);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);
    window.addEventListener('resize', this.handleResize);
    window.visualViewport?.addEventListener('resize', this.handleResize);

    this.callbacks.onReady();
    this.lastTimestamp = performance.now();
    this.scheduleNextFrame();
  }

  private bindCameraInputListeners(): void {
    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', this.onCanvasPointerDown);
    window.addEventListener('pointermove', this.onCanvasPointerMove);
    window.addEventListener('pointerup', this.onCanvasPointerUp);
    dom.addEventListener('wheel', this.onCanvasWheel, { passive: true });
  }

  private onCanvasPointerDown = (e: PointerEvent): void => {
    if (this.phase !== 'playing' || e.button !== 0) return;
    this.pointerDragging = true;
    this.lastPointerX = e.clientX;
  };

  private onCanvasPointerMove = (e: PointerEvent): void => {
    if (!this.pointerDragging || this.phase !== 'playing') return;
    const dx = e.clientX - this.lastPointerX;
    this.lastPointerX = e.clientX;
    this.camYawOffset = Math.max(-2.2, Math.min(2.2, this.camYawOffset - dx * 0.0065));
  };

  private onCanvasPointerUp = (): void => {
    this.pointerDragging = false;
  };

  private onCanvasWheel = (e: WheelEvent): void => {
    if (this.phase !== 'playing') return;
    this.camZoom = Math.max(0.68, Math.min(1.85, this.camZoom + e.deltaY * 0.0008));
  };

  private setupLighting(): void {
    this.hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x334155, 0.76);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff4d6, 1.85);
    this.sunLight.position.set(18, 28, 16);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 75;
    this.sunLight.shadow.camera.left = -28;
    this.sunLight.shadow.camera.right = 28;
    this.sunLight.shadow.camera.top = 24;
    this.sunLight.shadow.camera.bottom = -24;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);

    this.rimLight = new THREE.DirectionalLight(0x93c5fd, 0.48);
    this.rimLight.position.set(-18, 12, -18);
    this.scene.add(this.rimLight);
  }

  private applyWeatherTheme(theme: WeatherTheme = 'day'): void {
    if (!this.scene || !this.hemiLight || !this.sunLight || !this.rimLight) return;
    if (theme === 'sunset') {
      const col = new THREE.Color(0xfed7aa);
      this.scene.background = col;
      (this.scene.fog as THREE.Fog).color.copy(col);
      this.hemiLight.color.setHex(0xffedd5);
      this.hemiLight.groundColor.setHex(0x475569);
      this.hemiLight.intensity = 0.72;
      this.sunLight.color.setHex(0xfdba74);
      this.sunLight.intensity = 2.05;
      this.sunLight.position.set(-22, 16, 14);
      this.rimLight.color.setHex(0xf9a8d4);
    } else if (theme === 'overcast') {
      const col = new THREE.Color(0xcbd5e1);
      this.scene.background = col;
      (this.scene.fog as THREE.Fog).color.copy(col);
      this.hemiLight.color.setHex(0xe2e8f0);
      this.hemiLight.groundColor.setHex(0x334155);
      this.hemiLight.intensity = 0.92;
      this.sunLight.color.setHex(0xf8fafc);
      this.sunLight.intensity = 1.25;
      this.sunLight.position.set(10, 32, 12);
      this.rimLight.color.setHex(0x94a3b8);
    } else {
      const col = new THREE.Color(0xdbeafe);
      this.scene.background = col;
      (this.scene.fog as THREE.Fog).color.copy(col);
      this.hemiLight.color.setHex(0xe0f2fe);
      this.hemiLight.groundColor.setHex(0x334155);
      this.hemiLight.intensity = 0.76;
      this.sunLight.color.setHex(0xfff4d6);
      this.sunLight.intensity = 1.85;
      this.sunLight.position.set(18, 28, 16);
      this.rimLight.color.setHex(0x93c5fd);
    }
  }

  private setupStaticGround(): void {
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.shadowTex = createRadialShadowTexture();
    const { map, bumpMap } = createAsphaltTextures(maxAniso);
    this.groundTexMap = map;
    this.groundTexBump = bumpMap;

    const asphaltMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map,
      bumpMap,
      bumpScale: 0.025,
      roughness: 0.88,
      metalness: 0.04,
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 120), asphaltMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, LOT_CENTER_Z);
    ground.receiveShadow = true;
    this.scene.add(ground);

    const backdrop = buildSupermarketBackdrop(maxAniso, this.shadowTex);
    this.scene.add(backdrop);
  }

  private disposeHierarchy(root: THREE.Object3D, preserveTextures?: Set<THREE.Texture | null>): void {
    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) {
          if (!mat) continue;
          const std = mat as THREE.MeshStandardMaterial & THREE.MeshBasicMaterial;
          const texSlots: Array<THREE.Texture | null | undefined> = [
            std.map,
            std.bumpMap,
            std.normalMap,
            std.roughnessMap,
            std.metalnessMap,
            std.emissiveMap,
            std.alphaMap,
          ];
          for (const tex of texSlots) {
            if (tex && !preserveTextures?.has(tex)) {
              tex.dispose();
            }
          }
          mat.dispose();
        }
      }
    });
  }

  private setupParticleAndBagPools(): void {
    const pGeo = new THREE.BoxGeometry(0.11, 0.11, 0.11);
    const pMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      roughness: 0.5,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.35,
    });
    this.particleMesh = new THREE.InstancedMesh(pGeo, pMat, 48);
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleMesh.frustumCulled = false;

    for (let i = 0; i < 48; i++) {
      this.particles.push({
        active: false,
        life: 0,
        maxLife: 0.5,
        x: 0,
        y: -10,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        scale: 0,
      });
      _mat4.makeScale(0, 0, 0);
      this.particleMesh.setMatrixAt(i, _mat4);
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.particleMesh);

    const bagGeo = new THREE.BoxGeometry(0.24, 0.28, 0.18);
    const bagColors = [0xd97706, 0x16a34a, 0xef4444, 0x3b82f6];
    for (let i = 0; i < 6; i++) {
      const bag = new THREE.Mesh(
        bagGeo,
        new THREE.MeshStandardMaterial({ color: bagColors[i % bagColors.length], roughness: 0.85 })
      );
      bag.visible = false;
      bag.castShadow = true;
      this.scene.add(bag);
      this.droppedBags.push({
        active: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        rotSpeed: 0,
        mesh: bag,
      });
    }
  }

  public setCoinsDisplay(coins: number): void {
    this.coinsDisplay = coins;
  }

  public setPhase(phase: GamePhase): void {
    this.phase = phase;
    if (phase !== 'playing') {
      this.clearInputs();
      this.sound.silenceLoops();
    }
  }

  public setCameraMode(mode: CameraMode): void {
    this.cameraMode = mode;
    this.emitHud();
  }

  public toggleCameraMode(): CameraMode {
    this.cameraMode = this.cameraMode === 'chase' ? 'overhead' : 'chase';
    this.emitHud();
    return this.cameraMode;
  }

  public setOrbitKey(dir: 'left' | 'right', pressed: boolean): void {
    this.orbitInput[dir] = pressed;
  }

  public resetCameraView(): void {
    this.camYawOffset = 0;
    this.camZoom = 1.0;
  }

  public setInputKey(key: keyof InputState, pressed: boolean): void {
    if (key === 'brake' && pressed && !this.input.brake && this.phase === 'playing') {
      const vel = this.cartBody?.linvel();
      const speed = vel ? Math.hypot(vel.x, vel.z) : 0;
      this.sound.playBrake(speed);
    }
    this.input[key] = pressed;
  }

  public clearInputs(): void {
    this.input.forward = false;
    this.input.backward = false;
    this.input.left = false;
    this.input.right = false;
    this.input.brake = false;
    this.orbitInput.left = false;
    this.orbitInput.right = false;
    this.pointerDragging = false;
  }

  public getCurrentLevel(): LevelConfig {
    return this.level;
  }

  public getGameMode(): GameMode {
    return this.gameMode;
  }

  public getDriftTelemetry(): DriftTelemetry {
    return { ...this.driftTelemetry };
  }

  public setDriftConfig(partial: Partial<DriftConfig>): void {
    this.driftConfig = { ...this.driftConfig, ...partial };
    if (!this.driftConfig.enabled) {
      this.driftTelemetry = createInitialDriftTelemetry();
    }
  }

  public loadLevel(
    levelId: number,
    nextPhase: GamePhase = 'playing',
    mode: GameMode = this.gameMode,
    cartId: CartId = this.activeCartDef.id,
    cosmetics: Partial<CosmeticLoadout> = this.activeCosmetics
  ): void {
    if (!this.rapierReady) return;

    this.levelSeed = (this.levelSeed + 997 + (Date.now() & 0x3ff)) >>> 0;
    const shouldRandomizeCareer =
      nextPhase === 'playing' && (this.hasCompletedRound || levelId >= 2);
    this.level = getLevelById(
      levelId,
      this.levelSeed,
      this.recentBayIds,
      this.lastCompletedBay,
      shouldRandomizeCareer
    );
    if (this.level.bayId) {
      this.recentBayIds = [this.level.bayId, ...this.recentBayIds.slice(0, 6)];
    }

    this.gameMode = mode;
    this.activeCartDef = getCartDefinition(cartId);
    this.activeCosmetics = { ...cosmetics };
    this.activeHandling = applyCartModifiersToHandling(
      this.level.handling,
      this.activeCartDef,
      mode === 'chaos'
    );
    this.phase = nextPhase;
    this.timeLimit = mode === 'timetrial' ? Math.round(this.level.parTime * 1.2) : null;
    this.applyWeatherTheme(this.level.weather ?? 'day');

    const sharedTex = new Set<THREE.Texture | null>([
      this.shadowTex,
      this.groundTexMap,
      this.groundTexBump,
    ]);
    this.disposeHierarchy(this.levelGroup, sharedTex);
    this.levelGroup.clear();
    this.bayMesh = null;
    this.bayChevronMesh = null;
    this.bayCornerLights = [];
    this.bayBeaconGroup.clear();
    this.movingActors = [];
    this.dynamicLooseCarts = [];
    this.actorHandles.clear();
    this.obstacleHandles.clear();
    this.carHandles.clear();
    this.parkedCartHandles.clear();
    this.curbHandles.clear();
    this.looseCartHandles.clear();

    for (const b of this.droppedBags) {
      b.active = false;
      b.mesh.visible = false;
    }

    if (this.eventQueue) {
      this.eventQueue.free();
      this.eventQueue = null;
    }
    if (this.world) {
      this.world.free();
      this.world = null;
    }

    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.eventQueue = new RAPIER.EventQueue(true);

    // Build 2D NavGrid from level obstacles for realistic NPC pathfinding
    this.navGrid = buildNavGrid(this.level.obstacles, 0.42, 0.65, true);

    // Static ground slab covering the expanded 68m x 44m facility
    const groundBody = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(40, 0.25, 36)
        .setTranslation(0, -0.25, LOT_CENTER_Z)
        .setFriction(0.05)
        .setRestitution(0.1),
      groundBody
    );

    // Expanded lot perimeter walls
    const wallSpecs = [
      { x: 0, z: PLAYABLE_MIN_Z, hx: 35, hz: 0.45 },
      { x: 0, z: PLAYABLE_MAX_Z, hx: 35, hz: 0.45 },
      { x: PLAYABLE_MIN_X, z: LOT_CENTER_Z, hx: 0.45, hz: 24 },
      { x: PLAYABLE_MAX_X, z: LOT_CENTER_Z, hx: 0.45, hz: 24 },
    ];
    for (const w of wallSpecs) {
      const wb = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(w.x, 0.6, w.z)
      );
      const col = this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(w.hx, 0.8, w.hz)
          .setRestitution(0.35)
          .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
        wb
      );
      this.obstacleHandles.add(col.handle);
    }

    // Build parking bay decal + glowing beacons
    this.rebuildBayVisuals();

    // Build static obstacles with compound colliders and rich procedural 3D meshes
    for (const obs of this.level.obstacles) {
      this.spawnStaticObstacle(obs);
    }

    // Build moving actors (pedestrians with capsule colliders, shopper+cart pairs, rogue carts, cruising cars)
    for (const actor of this.level.movingActors) {
      this.spawnMovingActor(actor);
    }

    // Spawn Store Owner NPC on sidewalk or safe bay vantage spot
    this.ownerRig = buildStoreOwner(this.shadowTex);
    this.ownerCharacter = this.ownerRig.character ?? new StoreOwnerCharacter(this.ownerRig);
    const idealOwnerX = Math.max(-28, Math.min(28, this.level.bay.x + 3.4));
    const idealOwnerZ = this.level.bay.z < 5 ? -4.7 : Math.max(-3.6, this.level.bay.z - 4.8);
    const safeOwnerStart = resolveCircleObstacles(
      idealOwnerX,
      idealOwnerZ,
      0.4,
      this.level.obstacles,
      [],
      true
    );
    this.ownerPos.set(safeOwnerStart.x, 0, safeOwnerStart.z);
    this.ownerYaw = 0;
    this.ownerRig.root.position.copy(this.ownerPos);
    this.levelGroup.add(this.ownerRig.root);

    this.ownerBody = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        this.ownerPos.x,
        0.82,
        this.ownerPos.z
      )
    );
    const ownerCol = this.world.createCollider(
      RAPIER.ColliderDesc.capsule(0.48, 0.34)
        .setRestitution(0.4)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      this.ownerBody
    );
    this.ownerColliderHandle = ownerCol.handle;

    // Reset Owner state
    const initOwner = createInitialOwnerSnapshot();
    this.ownerAnger = mode === 'nightmare' ? 35 : initOwner.anger;
    this.ownerStage = getAngerStage(this.ownerAnger);
    this.ownerAnim = mode === 'nightmare' ? 'arms_crossed' : 'idle';
    this.ownerExpression = mode === 'nightmare' ? 'annoyed' : 'neutral';
    this.ownerDialogue =
      mode === 'nightmare' ? "DON'T EVEN THINK ABOUT SCRATCHING MY CARTS!" : null;
    this.ownerDialogueTimer = mode === 'nightmare' ? 3.0 : 0;
    this.ownerRecentDialogues = [];
    this.ownerReactionTimer = 0;
    this.ownerApproachTimer = 0;
    this.ownerFootstepTimer = 0;
    this.ownerMeltdownTimer = 0;
    this.ownerSurvivedStage5 = false;
    this.ownerPath = [];
    this.ownerPathTimer = 0;
    this.ownerBlockedCooldown = 0;
    this.ownerEscapedCooldown = 0;
    this.slowWarningSent = false;
    this.circleSpinAccum = 0;
    this.wasInBay = false;
    this.lineCrossCount = 0;

    // Build Player Custom Shopping Cart + Rapier body
    this.playerRig = buildCustomShoppingCart(
      this.activeCartDef.id,
      this.shadowTex,
      this.activeCosmetics
    );
    this.playerRig.badWheelRing.visible = Math.abs(this.activeHandling.badWheelPull) > 0.25;
    this.levelGroup.add(this.playerRig.root);

    const spawn = this.level.spawn;
    const cartRbDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(spawn.x, 0.44, spawn.z)
      .setRotation({
        x: 0,
        y: Math.sin(spawn.yaw / 2),
        z: 0,
        w: Math.cos(spawn.yaw / 2),
      })
      .enabledRotations(false, true, false)
      .setLinearDamping(0.35)
      .setAngularDamping(0.45);
    this.cartBody = this.world.createRigidBody(cartRbDesc);
    const cartCol = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(
        this.activeCartDef.physics.footprintW / 2,
        0.44,
        this.activeCartDef.physics.footprintL / 2
      )
        .setMass(this.activeCartDef.physics.mass)
        .setFriction(0.02)
        .setRestitution(this.activeCartDef.physics.restitution)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      this.cartBody
    );
    this.cartColliderHandle = cartCol.handle;

    // Reset runtime counters, fixed-timestep accumulators, pose snapshots & camera orbit
    this.casterState = { leftAngle: 0, rightAngle: 0, steerSmoothed: 0, wobblePhase: 0 };
    this.prevCartPose = { x: spawn.x, y: 0.44, z: spawn.z, yaw: spawn.yaw };
    this.curCartPose = { x: spawn.x, y: 0.44, z: spawn.z, yaw: spawn.yaw };
    this.driftTelemetry = createInitialDriftTelemetry();
    this.elapsedTime = 0;
    this.physicsAccum = 0;
    this.wheelSpinAngle = 0;
    this.hudEmitTimer = 0;
    this.trailAccum = 0;
    this.ownerCurrentSpeed = 0;
    this.collisions = 0;
    this.steeringCorrections = 0;
    this.prevSteerDir = 0;
    this.collisionCooldown = 0;
    this.hitstopTimer = 0;
    this.cameraTrauma = 0;
    this.parkProgress = 0;
    this.camYawOffset = 0;
    this.camZoom = 1.0;
    this.wobbleTimer = 0;
    this.reverseDriftTimer = 0;
    this.curbSnagTimer = 0;
    this.nextEventTimer = mode === 'chaos' ? 4.8 : this.level.eventInterval || 11;
    this.eventBanner = null;
    this.eventBannerTimer = 0;

    this.syncPlayerMeshFromBody(0.016);
    if (nextPhase === 'playing') {
      const fwdX = Math.sin(spawn.yaw);
      const fwdZ = Math.cos(spawn.yaw);
      this.camPos.set(spawn.x - fwdX * 5.2, 4.3, spawn.z - fwdZ * 5.2);
      this.camLook.set(spawn.x + fwdX * 1.4, 0.65, spawn.z + fwdZ * 1.4);
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camLook);
    }

    this.emitHud();
    this.renderer?.render(this.scene, this.camera);
  }

  private rebuildBayVisuals(): void {
    if (this.bayMesh) {
      this.levelGroup.remove(this.bayMesh);
      this.disposeHierarchy(this.bayMesh);
      this.bayMesh = null;
    }
    this.levelGroup.remove(this.bayBeaconGroup);
    this.disposeHierarchy(this.bayBeaconGroup);
    this.bayBeaconGroup.clear();
    this.bayCornerLights = [];

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const bayTex = createParkingBayTexture(
      this.level.bay.width,
      this.level.bay.length,
      maxAniso,
      Boolean(this.level.bay.requireReverse)
    );
    const bayGeo = new THREE.PlaneGeometry(this.level.bay.width, this.level.bay.length);
    bayGeo.rotateX(-Math.PI / 2);
    const bayMat = new THREE.MeshBasicMaterial({
      map: bayTex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.bayMesh = new THREE.Mesh(bayGeo, bayMat);
    this.bayMesh.rotation.set(0, this.level.bay.yaw, 0);
    this.bayMesh.position.set(this.level.bay.x, 0.028, this.level.bay.z);
    this.levelGroup.add(this.bayMesh);

    this.bayBeaconGroup.position.set(this.level.bay.x, 0.04, this.level.bay.z);
    this.bayBeaconGroup.rotation.y = this.level.bay.yaw;
    const hw = this.level.bay.width / 2;
    const hl = this.level.bay.length / 2;
    for (const [cx, cz] of [
      [-hw, -hl],
      [hw, -hl],
      [-hw, hl],
      [hw, hl],
    ]) {
      const cone = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.1, 0.24, 10),
        new THREE.MeshStandardMaterial({
          color: 0xfacc15,
          emissive: 0xfacc15,
          emissiveIntensity: 0.45,
          roughness: 0.4,
        })
      );
      cone.position.set(cx, 0.12, cz);
      this.bayBeaconGroup.add(cone);
      this.bayCornerLights.push(cone);
    }

    const chevronGeo = new THREE.ConeGeometry(0.32, 0.52, 4);
    chevronGeo.rotateX(Math.PI);
    this.bayChevronMesh = new THREE.Mesh(
      chevronGeo,
      new THREE.MeshStandardMaterial({
        color: this.level.bay.requireReverse ? 0xfb923c : 0xfacc15,
        emissive: this.level.bay.requireReverse ? 0xfb923c : 0xfacc15,
        emissiveIntensity: 0.65,
        roughness: 0.3,
      })
    );
    this.bayChevronMesh.position.set(0, 1.9, 0);
    this.bayBeaconGroup.add(this.bayChevronMesh);
    this.levelGroup.add(this.bayBeaconGroup);
  }

  private spawnStaticObstacle(obs: ObstacleSpec): void {
    if (!this.world) return;
    const rbDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(obs.x, 0, obs.z)
      .setRotation({
        x: 0,
        y: Math.sin(obs.yaw / 2),
        z: 0,
        w: Math.cos(obs.yaw / 2),
      });
    const rb = this.world.createRigidBody(rbDesc);

    if (obs.kind === 'corral') {
      // Multi-collider U-shape: left rail, right rail, back rail (open front!)
      const sideX = Math.max(0.5, obs.width / 2 - 0.08);
      const backZ = -Math.max(0.5, obs.length / 2 - 0.12);
      const parts = [
        { x: -sideX, y: 0.55, z: 0, hx: 0.09, hy: 0.55, hz: obs.length / 2 },
        { x: sideX, y: 0.55, z: 0, hx: 0.09, hy: 0.55, hz: obs.length / 2 },
        { x: 0, y: 0.55, z: backZ, hx: obs.width / 2, hy: 0.55, hz: 0.09 },
      ];
      for (const p of parts) {
        const col = this.world.createCollider(
          RAPIER.ColliderDesc.cuboid(p.hx, p.hy, p.hz)
            .setTranslation(p.x, p.y, p.z)
            .setRestitution(0.32)
            .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
          rb
        );
        this.obstacleHandles.add(col.handle);
      }
    } else if (obs.kind === 'car') {
      // Compound 2-part vehicle collider: lower chassis + upper greenhouse
      const chassisCol = this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(obs.width / 2, 0.42, obs.length / 2)
          .setTranslation(0, 0.46, 0)
          .setRestitution(0.28)
          .setFriction(0.25)
          .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
        rb
      );
      const cabinCol = this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(obs.width * 0.42, 0.3, obs.length * 0.28)
          .setTranslation(0, 1.15, -0.15)
          .setRestitution(0.28)
          .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
        rb
      );
      this.carHandles.add(chassisCol.handle);
      this.carHandles.add(cabinCol.handle);
    } else {
      const col = this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(obs.width / 2, obs.height / 2, obs.length / 2)
          .setTranslation(0, obs.height / 2, 0)
          .setRestitution(obs.kind === 'cart' ? 0.52 : 0.28)
          .setFriction(0.2)
          .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
        rb
      );
      if (obs.kind === 'curb' || obs.kind === 'wheel_stop') {
        this.curbHandles.add(col.handle);
      } else if (obs.kind === 'cart') {
        this.parkedCartHandles.add(col.handle);
      } else {
        this.obstacleHandles.add(col.handle);
      }
    }

    let mesh: THREE.Group;
    switch (obs.kind) {
      case 'cart':
        mesh = buildShoppingCart(this.shadowTex, obs.color ?? 0x2563eb, false).root;
        break;
      case 'car':
        mesh = buildParkedCar(this.shadowTex, obs.color ?? 0x3b82f6, obs.variant ?? 'sedan');
        break;
      case 'corral':
        mesh = buildCartCorral();
        break;
      case 'bollard':
        mesh = buildBollard();
        break;
      case 'bench':
        mesh = buildBench();
        break;
      case 'trash_bin':
        mesh = buildTrashBin();
        break;
      case 'sign':
        mesh = buildParkingSign(obs.label ?? 'P');
        break;
      case 'barrier':
        mesh = buildParkingBarrier(obs.width);
        break;
      case 'island':
        mesh = buildIsland(obs.width, obs.length);
        break;
      case 'loading_dock':
        mesh = buildLoadingDock(obs.width, obs.length);
        break;
      case 'wheel_stop':
      case 'curb':
      default:
        mesh = buildWheelStop(obs.width, obs.height, obs.length);
        break;
    }
    mesh.position.set(obs.x, 0, obs.z);
    mesh.rotation.y = obs.yaw;
    this.levelGroup.add(mesh);
  }

  private spawnMovingActor(actor: LevelConfig['movingActors'][number]): void {
    if (!this.world) return;
    const isCar = actor.kind === 'car_cruise';
    const isPed = actor.kind === 'pedestrian' || actor.kind === 'pedestrian_cart';
    const initYaw = Math.atan2(actor.endX - actor.startX, actor.endZ - actor.startZ);

    const rb = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(actor.startX, 0, actor.startZ)
        .setRotation({
          x: 0,
          y: Math.sin(initYaw / 2),
          z: 0,
          w: Math.cos(initYaw / 2),
        })
    );

    const primaryDesc = isPed
      ? RAPIER.ColliderDesc.capsule(0.45, 0.28).setTranslation(0, 0.8, 0)
      : isCar
        ? RAPIER.ColliderDesc.cuboid(0.92, 0.7, 2.0).setTranslation(0, 0.72, 0)
        : RAPIER.ColliderDesc.cuboid(0.34, 0.44, 0.52).setTranslation(0, 0.44, 0);

    const col = this.world.createCollider(
      primaryDesc
        .setRestitution(isCar ? 0.35 : 0.6)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      rb
    );

    const extraColliderHandles: number[] = [];
    if (actor.kind === 'pedestrian_cart') {
      // Compound collider covering the shopping cart pushed +0.92m in front of the shopper
      const frontCartCol = this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.32, 0.44, 0.5)
          .setTranslation(0, 0.44, 0.92)
          .setRestitution(0.55)
          .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
        rb
      );
      extraColliderHandles.push(frontCartCol.handle);
    }

    let mesh: THREE.Group;
    let pedRig: PedestrianRig | undefined;
    let cartRig: CartVisualRig | undefined;

    if (actor.kind === 'pedestrian') {
      pedRig = buildPedestrian(this.shadowTex, actor.shirtColor ?? 0xf97316);
      mesh = pedRig.root;
    } else if (actor.kind === 'pedestrian_cart') {
      const combo = new THREE.Group();
      pedRig = buildPedestrian(this.shadowTex, actor.shirtColor ?? 0x06b6d4);
      cartRig = buildShoppingCart(this.shadowTex, actor.shirtColor ?? 0xdc2626, false);
      cartRig.root.position.set(0, 0, 0.92);
      combo.add(pedRig.root);
      combo.add(cartRig.root);
      mesh = combo;
    } else if (actor.kind === 'car_cruise') {
      mesh = buildParkedCar(this.shadowTex, actor.shirtColor ?? 0x0ea5e9, 'sedan');
    } else {
      cartRig = buildShoppingCart(this.shadowTex, 0x0ea5e9, false);
      mesh = cartRig.root;
    }

    const dist = Math.hypot(actor.endX - actor.startX, actor.endZ - actor.startZ) || 1;
    const initProgress = ((actor.phaseOffset ?? 0) * actor.speed / dist) % 1;
    const ix = actor.startX + (actor.endX - actor.startX) * initProgress;
    const iz = actor.startZ + (actor.endZ - actor.startZ) * initProgress;

    mesh.position.set(ix, 0, iz);
    mesh.rotation.y = initYaw;
    this.levelGroup.add(mesh);

    const runtime: MovingActorRuntime = {
      specId: actor.id,
      kind: actor.kind,
      startX: actor.startX,
      startZ: actor.startZ,
      endX: actor.endX,
      endZ: actor.endZ,
      speed: actor.speed,
      currentSpeed: actor.speed,
      phaseOffset: actor.phaseOffset ?? 0,
      progress: initProgress,
      dir: 1,
      curX: ix,
      curZ: iz,
      body: rb,
      colliderHandle: col.handle,
      extraColliderHandles,
      mesh,
      pedRig,
      pedCharacter: pedRig ? (pedRig.character ?? new PedestrianCharacter(pedRig)) : undefined,
      cartRig,
    };
    rb.setNextKinematicTranslation({ x: ix, y: 0, z: iz });
    rb.setNextKinematicRotation({
      x: 0,
      y: Math.sin(initYaw / 2),
      z: 0,
      w: Math.cos(initYaw / 2),
    });
    this.movingActors.push(runtime);
    this.actorHandles.set(col.handle, runtime);
    for (const h of extraColliderHandles) {
      this.actorHandles.set(h, runtime);
    }
  }

  private scheduleNextFrame(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(() => this.tick());
    } else {
      this.frameId = requestAnimationFrame(() => this.tick());
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick(): void {
    if (this.disposed) return;

    const now = performance.now();
    const rawDt = (now - this.lastTimestamp) / 1000;
    this.lastTimestamp = now;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

    this.stepFrame(dt);
    this.renderer.render(this.scene, this.camera);
    this.scheduleNextFrame();
  }

  private stepFrame(dt: number): void {
    this.updateParticles(dt);
    this.updateDroppedBags(dt);
    this.cameraTrauma = Math.max(0, this.cameraTrauma - dt * 1.8);

    if (this.eventBannerTimer > 0) {
      this.eventBannerTimer -= dt;
      if (this.eventBannerTimer <= 0) {
        this.eventBanner = null;
      }
    }

    if (this.phase === 'title') {
      this.titleOrbitTime += dt;
      this.updateMovingActors(dt);
      if (this.ownerCharacter) {
        this.ownerCharacter.update('arms_crossed', 'annoyed', 0, dt);
      }
      const t = this.titleOrbitTime * 0.24;
      const targetX = this.level.spawn.x + Math.cos(t) * 6.8;
      const targetZ = this.level.spawn.z + Math.sin(t) * 5.6 + 1.5;
      this.camPos.x = expDamp(this.camPos.x, targetX, 3.2, dt);
      this.camPos.y = expDamp(this.camPos.y, 3.6 + Math.sin(t * 1.4) * 0.4, 3.2, dt);
      this.camPos.z = expDamp(this.camPos.z, targetZ, 3.2, dt);
      this.camLook.x = expDamp(this.camLook.x, this.level.spawn.x + 1.2, 4, dt);
      this.camLook.y = expDamp(this.camLook.y, 0.75, 4, dt);
      this.camLook.z = expDamp(this.camLook.z, this.level.spawn.z - 0.8, 4, dt);
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camLook);
      return;
    }

    if (this.phase !== 'playing' || !this.world || !this.cartBody) {
      return;
    }

    // Q/E keyboard camera orbit
    const orbitDir = (this.orbitInput.left ? 1 : 0) - (this.orbitInput.right ? 1 : 0);
    if (orbitDir !== 0) {
      this.camYawOffset = Math.max(-2.2, Math.min(2.2, this.camYawOffset + orbitDir * dt * 1.65));
    }

    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      this.updateFollowCamera(dt);
      return;
    }

    this.elapsedTime += dt;
    this.collisionCooldown = Math.max(0, this.collisionCooldown - dt);
    this.wobbleTimer = Math.max(0, this.wobbleTimer - dt);
    this.reverseDriftTimer = Math.max(0, this.reverseDriftTimer - dt);
    this.curbSnagTimer = Math.max(0, this.curbSnagTimer - dt);
    this.ownerBlockedCooldown = Math.max(0, this.ownerBlockedCooldown - dt);
    this.ownerEscapedCooldown = Math.max(0, this.ownerEscapedCooldown - dt);

    if (this.timeLimit !== null && this.elapsedTime >= this.timeLimit) {
      this.triggerTimeExpiredDefeat();
      return;
    }

    const steerDir = (this.input.left ? 1 : 0) - (this.input.right ? 1 : 0);
    if (steerDir !== 0 && steerDir !== this.prevSteerDir) {
      this.steeringCorrections++;
      this.prevSteerDir = steerDir;
    } else if (steerDir === 0) {
      this.prevSteerDir = 0;
    }

    const eventCadence = this.gameMode === 'chaos' ? 4.8 : this.level.eventInterval;
    if (eventCadence > 0) {
      this.nextEventTimer -= dt;
      if (this.nextEventTimer <= 0) {
        this.nextEventTimer = eventCadence * (0.78 + Math.random() * 0.44);
        this.triggerRandomPhysicsEvent();
      }
    }

    this.physicsAccum += dt;
    const fixedDt = 1 / 60;
    let substeps = 0;
    while (this.physicsAccum >= fixedDt && substeps < 4) {
      this.stepPhysics(fixedDt);
      this.physicsAccum -= fixedDt;
      substeps++;
    }

    this.updateMovingActors(dt);
    this.syncLooseCarts(dt);
    this.updateOwnerBehavior(dt);
    this.syncPlayerMeshFromBody(dt);
    this.spawnCosmeticTrails(dt);
    this.evaluateParkingProgress(dt);
    this.updateFollowCamera(dt);

    const vel = this.cartBody.linvel();
    const speed = Math.hypot(vel.x, vel.z);
    const yaw = this.getCartYaw();
    const signedFwd = vel.x * Math.sin(yaw) + vel.z * Math.cos(yaw);
    this.sound.updateRolling(
      speed,
      signedFwd < -0.15 || this.input.backward,
      this.wobbleTimer > 0 || Math.abs(this.activeHandling.badWheelPull) > 0.35,
      Math.abs(this.casterState.steerSmoothed),
      dt
    );

    this.hudEmitTimer += dt;
    if (this.hudEmitTimer >= 0.08) {
      this.hudEmitTimer = 0;
      this.emitHud();
    }
  }

  private getCartYaw(): number {
    if (!this.cartBody) return 0;
    const r = this.cartBody.rotation();
    return 2 * Math.atan2(r.y, r.w);
  }

  private stepPhysics(dt: number): void {
    if (!this.world || !this.cartBody || !this.eventQueue) return;

    this.prevCartPose = { ...this.curCartPose };

    const vel = this.cartBody.linvel();
    const ang = this.cartBody.angvel();
    const yaw = this.getCartYaw();

    const forces = stepCartDynamics(
      this.casterState,
      yaw,
      vel.x,
      vel.z,
      ang.y,
      this.input,
      this.activeHandling,
      dt,
      {
        wobbleActive: this.wobbleTimer > 0,
        reverseDriftActive: this.reverseDriftTimer > 0,
        curbSnagActive: this.curbSnagTimer > 0,
      }
    );

    // Future opt-in Cart Drift detector (early-returns inert telemetry when disabled)
    this.driftTelemetry = stepDriftDetector(
      this.driftTelemetry,
      this.input,
      {
        signedForwardSpeed: forces.signedForwardSpeed,
        lateralSpeed: forces.lateralSpeed,
        angularVelocityY: ang.y,
      },
      this.driftConfig,
      dt
    );

    const massScale = this.activeCartDef.physics.mass / 12;
    const speed = Math.hypot(vel.x, vel.z);
    if (speed > this.activeHandling.maxSpeed) {
      const ratio = this.activeHandling.maxSpeed / speed;
      this.cartBody.setLinvel({ x: vel.x * ratio, y: vel.y, z: vel.z * ratio }, true);
    }

    this.cartBody.resetForces(true);
    this.cartBody.resetTorques(true);
    this.cartBody.addForce(
      { x: forces.forceX * massScale, y: 0, z: forces.forceZ * massScale },
      true
    );
    this.cartBody.addTorque({ x: 0, y: forces.torqueY * massScale, z: 0 }, true);

    this.world.step(this.eventQueue);

    const nextPos = this.cartBody.translation();
    this.curCartPose = {
      x: nextPos.x,
      y: nextPos.y,
      z: nextPos.z,
      yaw: this.getCartYaw(),
    };

    this.eventQueue.drainCollisionEvents((h1, h2, started) => {
      if (!started) return;
      const other =
        h1 === this.cartColliderHandle ? h2 : h2 === this.cartColliderHandle ? h1 : -1;
      if (other === -1) return;

      const curVel = this.cartBody!.linvel();
      const impactSpeed = Math.hypot(curVel.x, curVel.z);

      if (other === this.ownerColliderHandle) {
        if (this.collisionCooldown <= 0) {
          this.triggerOwnerEvent('crash', 18, 'YOU RAN OVER THE BOSS!!');
          this.registerCollision(Math.max(1.4, impactSpeed), 'CAREFUL! YOU BUMPED THE STORE OWNER!', false, false);
        }
        return;
      }

      if (this.carHandles.has(other)) {
        if (impactSpeed > 0.45 && this.collisionCooldown <= 0) {
          this.triggerOwnerEvent('crash_car', 18);
          this.registerCollision(impactSpeed, 'DENTED A CUSTOMER CAR!!', impactSpeed > 1.4, false);
        }
        return;
      }

      if (this.curbHandles.has(other)) {
        if (impactSpeed > 0.65 && this.collisionCooldown <= 0) {
          this.curbSnagTimer = 1.0;
          this.triggerOwnerEvent('property_damage', 14);
          this.registerCollision(impactSpeed, 'CURB SNAG! WATCH THE BUMPERS!', false, false);
        }
        return;
      }

      if (this.parkedCartHandles.has(other) || this.looseCartHandles.has(other)) {
        if (impactSpeed > 0.5 && this.collisionCooldown <= 0) {
          this.triggerOwnerEvent('hit_cart', 16);
          this.registerCollision(impactSpeed, null, impactSpeed > 1.5, false);
        }
        return;
      }

      const actor = this.actorHandles.get(other);
      if (actor) {
        if (this.collisionCooldown <= 0) {
          if (actor.kind === 'car_cruise') {
            this.triggerOwnerEvent('crash_car', 20);
            this.registerCollision(Math.max(1.6, impactSpeed), 'FENDER BENDER WITH AISLE TRAFFIC!', true, false);
          } else if (actor.kind === 'pedestrian' || actor.kind === 'pedestrian_cart') {
            this.sound.playPedestrianHey();
            this.triggerOwnerEvent('crash', 15);
            this.registerCollision(Math.max(1.2, impactSpeed), 'SHOPPER COLLISION! "WATCH IT!"', true, false);
          } else {
            this.triggerOwnerEvent('hit_cart', 16);
            this.registerCollision(Math.max(1.4, impactSpeed), 'RUNAWAY CART FENDER BENDER!', true, false);
          }
        }
        return;
      }

      if (this.obstacleHandles.has(other) && impactSpeed > 0.55 && this.collisionCooldown <= 0) {
        this.triggerOwnerEvent('property_damage', 14);
        this.registerCollision(impactSpeed, null, impactSpeed > 1.7, false);
      }
    });
  }

  private triggerOwnerEvent(
    trigger: OwnerTrigger,
    angerDelta: number,
    overrideDialogue?: string
  ): void {
    const prevStage = this.ownerStage;
    this.ownerAnger = applyAngerDelta(this.ownerAnger, angerDelta, this.gameMode);
    this.ownerStage = getAngerStage(this.ownerAnger);

    const reaction = computeOwnerReaction(
      trigger,
      this.ownerAnger,
      this.ownerRecentDialogues,
      Math.round(this.elapsedTime * 10 + this.collisions)
    );

    this.ownerAnim = reaction.anim;
    this.ownerExpression = reaction.expression;
    this.ownerDialogue = overrideDialogue ?? reaction.dialogue;
    this.ownerDialogueTimer = 3.1;
    this.ownerReactionTimer = 2.4;
    if (reaction.shouldApproach) {
      this.ownerApproachTimer = 3.8;
    }

    if (this.ownerDialogue) {
      this.ownerRecentDialogues = [
        this.ownerDialogue,
        ...this.ownerRecentDialogues.slice(0, 3),
      ];
    }

    if (this.ownerStage === 5 && prevStage < 5) {
      this.ownerMeltdownTimer = 5.0;
      const mReact = computeOwnerReaction('meltdown', 95, this.ownerRecentDialogues, 0);
      this.ownerAnim = mReact.anim;
      this.ownerExpression = mReact.expression;
      this.ownerDialogue = mReact.dialogue;
      this.ownerDialogueTimer = 4.0;
      this.ownerApproachTimer = 5.5;
      this.sound.playMeltdownSiren();
      this.showBanner('OWNER STAGE 5: ABSOLUTE MELTDOWN!!');
    } else {
      this.sound.playOwnerVoice(this.ownerStage, trigger === 'perfect_park');
    }

    if (this.gameMode === 'nightmare' && this.ownerAnger >= 100) {
      this.triggerMeltdownDefeat();
    }
  }

  private collectDynamicCircles(excludeOwner = false): DynamicCircleObstacle[] {
    const list: DynamicCircleObstacle[] = [];
    if (this.cartBody) {
      const p = this.cartBody.translation();
      list.push({ x: p.x, z: p.z, radius: 0.56 });
    }
    if (!excludeOwner) {
      list.push({ x: this.ownerPos.x, z: this.ownerPos.z, radius: 0.4 });
    }
    for (const lc of this.dynamicLooseCarts) {
      const p = lc.body.translation();
      list.push({ x: p.x, z: p.z, radius: 0.48 });
    }
    for (const a of this.movingActors) {
      list.push({
        x: a.curX,
        z: a.curZ,
        radius: a.kind === 'car_cruise' ? 1.5 : 0.4,
      });
    }
    return list;
  }

  private updateOwnerBehavior(dt: number): void {
    if (!this.ownerRig || !this.cartBody || !this.ownerBody || !this.navGrid) return;

    const cartPos = this.cartBody.translation();
    const vel = this.cartBody.linvel();
    const angVel = this.cartBody.angvel();
    const speed = Math.hypot(vel.x, vel.z);

    if (Math.abs(angVel.y) > 1.85 && speed > 1.0) {
      this.circleSpinAccum += dt;
      if (this.circleSpinAccum > 2.4) {
        this.circleSpinAccum = 0;
        this.triggerOwnerEvent('circles', 10);
      }
    } else {
      this.circleSpinAccum = Math.max(0, this.circleSpinAccum - dt * 0.8);
    }

    if (!this.slowWarningSent && this.elapsedTime > this.level.parTime * 1.25) {
      this.slowWarningSent = true;
      this.triggerOwnerEvent('slow', 9);
    }

    if (this.ownerReactionTimer <= 0 && speed < 3.6) {
      this.ownerAnger = Math.max(0, this.ownerAnger - dt * 1.4);
      this.ownerStage = getAngerStage(this.ownerAnger);
    }

    if (this.ownerStage === 5) {
      this.ownerMeltdownTimer -= dt;
      if (this.ownerMeltdownTimer <= 0) {
        this.ownerSurvivedStage5 = true;
      }
    }

    if (this.ownerDialogueTimer > 0) {
      this.ownerDialogueTimer -= dt;
      if (this.ownerDialogueTimer <= 0) {
        this.ownerDialogue = null;
      }
    }
    if (this.ownerReactionTimer > 0) {
      this.ownerReactionTimer -= dt;
    }

    const dxToCart = cartPos.x - this.ownerPos.x;
    const dzToCart = cartPos.z - this.ownerPos.z;
    const distToCart = Math.hypot(dxToCart, dzToCart);

    // Trigger 'escaped' when player bolts far away while owner is furious
    if (this.ownerStage >= 3 && distToCart > 15 && speed > 2.5 && this.ownerEscapedCooldown <= 0) {
      this.ownerEscapedCooldown = 9;
      this.triggerOwnerEvent('escaped', 4);
    }

    // Decide goal position: sidewalk/bay vantage patrol OR chasing player
    const patrolCenterX = Math.max(-28, Math.min(28, this.level.bay.x + 3.4));
    const patrolBaseZ = this.level.bay.z < 5 ? -4.7 : Math.max(-3.6, this.level.bay.z - 4.8);
    let targetX = patrolCenterX + Math.sin(this.elapsedTime * 0.35) * 2.6;
    let targetZ = patrolBaseZ;
    let moveSpeed = 1.05;
    let isChasing = false;

    if (this.ownerApproachTimer > 0 || this.ownerStage >= 4) {
      this.ownerApproachTimer = Math.max(0, this.ownerApproachTimer - dt);
      isChasing = true;
      const stopDist = this.ownerStage >= 5 && this.gameMode === 'nightmare' ? 0.65 : 2.15;
      if (distToCart > stopDist) {
        targetX = cartPos.x - (dxToCart / Math.max(0.01, distToCart)) * (stopDist * 0.8);
        targetZ = cartPos.z - (dzToCart / Math.max(0.01, distToCart)) * (stopDist * 0.8);
        moveSpeed = this.ownerStage >= 5 ? 2.35 : this.ownerStage >= 4 ? 1.95 : 1.45;
      } else {
        targetX = this.ownerPos.x;
        targetZ = this.ownerPos.z;
        if (this.gameMode === 'nightmare' && this.ownerStage === 5 && distToCart <= 0.95) {
          this.triggerMeltdownDefeat();
          return;
        }
      }
    }

    // Recompute A* navigation path periodically or when goal shifts significantly
    this.ownerPathTimer -= dt;
    const goalShift = Math.hypot(targetX - this.ownerLastGoal.x, targetZ - this.ownerLastGoal.z);
    if (this.ownerPathTimer <= 0 || goalShift > 1.4) {
      this.ownerPathTimer = 0.42;
      this.ownerLastGoal = { x: targetX, z: targetZ };
      const pathRes = findGridPath(
        this.navGrid,
        this.ownerPos.x,
        this.ownerPos.z,
        targetX,
        targetZ
      );
      if (pathRes.found && !pathRes.blocked) {
        this.ownerPath = pathRes.waypoints;
      } else {
        this.ownerPath = [];
        if (isChasing && this.ownerBlockedCooldown <= 0) {
          this.ownerBlockedCooldown = 6;
          this.triggerOwnerEvent('blocked', 3);
        }
      }
    }

    // Smooth acceleration/deceleration and obstacle-aware locomotion
    let stepDist = 0;
    let moveDirX = 0;
    let moveDirZ = 0;
    let pathActive = false;

    if (this.ownerPath.length > 0) {
      while (
        this.ownerPath.length > 1 &&
        Math.hypot(this.ownerPath[0].x - this.ownerPos.x, this.ownerPath[0].z - this.ownerPos.z) < 0.55
      ) {
        this.ownerPath.shift();
      }
      const wp = this.ownerPath[0];
      const wdx = wp.x - this.ownerPos.x;
      const wdz = wp.z - this.ownerPos.z;
      const wDist = Math.hypot(wdx, wdz);

      if (wDist > 0.14) {
        pathActive = true;
        this.ownerCurrentSpeed = expDamp(this.ownerCurrentSpeed, moveSpeed, 6.5, dt);

        const rawDirX = wdx / wDist;
        const rawDirZ = wdz / wDist;
        const dynCircles = this.collectDynamicCircles(true);
        const avoid = computeLocalAvoidance(
          this.ownerPos.x,
          this.ownerPos.z,
          rawDirX,
          rawDirZ,
          dynCircles,
          1.35
        );

        let steerX = rawDirX + avoid.x * 0.9;
        let steerZ = rawDirZ + avoid.z * 0.9;
        const sLen = Math.hypot(steerX, steerZ) || 1;
        steerX /= sLen;
        steerZ /= sLen;

        const step = Math.min(wDist, this.ownerCurrentSpeed * dt);
        const nextX = this.ownerPos.x + steerX * step;
        const nextZ = this.ownerPos.z + steerZ * step;

        // Hard collision resolution guarantees Owner NEVER clips through walls, cars, carts, or barriers!
        const resolved = resolveCircleObstacles(
          nextX,
          nextZ,
          0.38,
          this.level.obstacles,
          dynCircles,
          true
        );

        const actualDx = resolved.x - this.ownerPos.x;
        const actualDz = resolved.z - this.ownerPos.z;
        stepDist = Math.hypot(actualDx, actualDz);
        this.ownerPos.x = resolved.x;
        this.ownerPos.z = resolved.z;

        if (stepDist > 0.002) {
          moveDirX = actualDx / stepDist;
          moveDirZ = actualDz / stepDist;
        } else {
          // Blocked by an obstacle: decay smoothed speed to avoid walking in place against walls
          this.ownerCurrentSpeed = expDamp(this.ownerCurrentSpeed, 0, 14, dt);
        }

        if (stepDist > 0.004) {
          this.ownerFootstepTimer -= dt;
          if (this.ownerFootstepTimer <= 0) {
            this.ownerFootstepTimer =
              this.ownerCharacter?.getActiveStepIntervalSeconds() ??
              (moveSpeed > 1.85 ? 0.36 : 0.5);
            this.sound.playOwnerFootstep();
          }
        }
      }
    }

    if (!pathActive) {
      this.ownerCurrentSpeed = expDamp(this.ownerCurrentSpeed, 0, 10, dt);
    }

    // Smooth turning toward travel direction while walking/running, or toward player when standing
    const lookDx = stepDist > 0.008 ? moveDirX : dxToCart;
    const lookDz = stepDist > 0.008 ? moveDirZ : dzToCart;
    const desiredYaw = Math.atan2(lookDx, lookDz);
    const diff = clampAngle(desiredYaw - this.ownerYaw);
    this.ownerYaw += diff * Math.min(1, dt * 5.5);

    this.ownerRig.root.position.copy(this.ownerPos);
    this.ownerRig.root.rotation.y = this.ownerYaw;
    this.ownerBody.setNextKinematicTranslation({
      x: this.ownerPos.x,
      y: 0.82,
      z: this.ownerPos.z,
    });

    const actualSpeed = dt > 0 ? stepDist / dt : 0;
    const isMoving = actualSpeed > 0.08;
    const activeAnim: OwnerAnimState = isMoving
      ? moveSpeed >= 1.85 || actualSpeed >= 1.75
        ? 'run'
        : this.ownerStage >= 3 || this.ownerApproachTimer > 0
          ? 'angry_walk'
          : 'walk'
      : this.ownerReactionTimer > 0
        ? this.ownerAnim
        : Math.abs(diff) > 0.16
          ? 'turn'
          : this.ownerStage >= 3
            ? 'arms_crossed'
            : 'idle';

    this.ownerCharacter?.update(
      activeAnim,
      this.ownerExpression,
      actualSpeed,
      dt
    );
  }

  private registerCollision(
    impactSpeed: number,
    customBanner: string | null,
    canDropBag: boolean,
    triggerOwner = true
  ): void {
    this.collisions++;
    this.collisionCooldown = 0.55;
    this.cameraTrauma = Math.min(1, 0.35 + impactSpeed * 0.16);
    if (impactSpeed > 1.8) {
      this.hitstopTimer = 0.045;
    }

    this.sound.playCrash(Math.min(1.5, impactSpeed / 2.2));
    if (triggerOwner) {
      this.triggerOwnerEvent('crash', 12);
    }

    const pos = this.cartBody?.translation();
    if (pos) {
      this.spawnParticles(pos.x, 0.55, pos.z, 12);
      if (canDropBag && Math.random() < 0.65) {
        this.spawnDroppedBag(pos.x, pos.z);
        this.showBanner(customBanner ?? 'GROCERY SPILL! A BAG FELL OUT!');
      } else if (customBanner) {
        this.showBanner(customBanner);
      }
    }
    this.emitHud();
  }

  private spawnLooseDynamicCart(x: number, z: number, vx: number, vz: number, color = 0x2563eb): void {
    if (!this.world || this.dynamicLooseCarts.length >= 6) return;
    const rb = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, 0.45, z)
        .setLinvel(vx, 0, vz)
        .enabledRotations(false, true, false)
        .setLinearDamping(0.45)
        .setAngularDamping(0.8)
    );
    const col = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.34, 0.44, 0.52)
        .setMass(10)
        .setRestitution(0.48)
        .setFriction(0.12)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      rb
    );
    this.looseCartHandles.add(col.handle);
    const rig = buildShoppingCart(this.shadowTex, color, false);
    rig.root.position.set(x, 0, z);
    this.levelGroup.add(rig.root);

    this.dynamicLooseCarts.push({
      body: rb,
      colliderHandle: col.handle,
      rig,
      wheelAngle: 0,
    });
  }

  private syncLooseCarts(dt: number): void {
    for (const lc of this.dynamicLooseCarts) {
      const p = lc.body.translation();
      const r = lc.body.rotation();
      const yaw = 2 * Math.atan2(r.y, r.w);
      const v = lc.body.linvel();
      const signedFwd = v.x * Math.sin(yaw) + v.z * Math.cos(yaw);
      lc.rig.root.position.set(p.x, Math.max(0, Math.min(0.12, p.y - 0.44)), p.z);
      lc.rig.root.rotation.y = yaw;
      lc.wheelAngle += (signedFwd * dt) / (lc.rig.wheelRadius || 0.068);
      for (const w of lc.rig.wheelMeshes) {
        w.rotation.x = lc.wheelAngle;
      }
    }
  }

  private triggerRandomPhysicsEvent(): void {
    const chaosPool: PhysicsEventType[] = [
      'wobble',
      'reverse_drift',
      'curb_snag',
      'bag_drop',
      'downhill_cart',
      'owner_ambush',
      'abandoned_cart',
      'stuck_trolley',
      'cart_cluster',
      'owner_rearrange',
      'runaway_cart',
      'exiting_car',
      'twin_crossing',
      'bay_reassigned',
    ];
    const pool =
      this.gameMode === 'chaos'
        ? chaosPool
        : Array.from(
            new Set([
              ...this.level.allowedEvents,
              'downhill_cart',
              'abandoned_cart',
              'exiting_car',
            ])
          );
    const pick = pool[Math.floor(Math.random() * pool.length)] as PhysicsEventType;

    switch (pick) {
      case 'wobble':
        this.wobbleTimer = 2.8;
        this.showBanner('CHAOS EVENT: FRONT WHEEL WOBBLE!');
        this.sound.playEventAlert();
        break;
      case 'reverse_drift':
        this.reverseDriftTimer = 3.2;
        this.showBanner('CHAOS EVENT: SLICK FLOOR! REVERSE DRIFT!');
        this.sound.playEventAlert();
        break;
      case 'curb_snag':
      case 'stuck_trolley':
        this.curbSnagTimer = 1.6;
        this.showBanner('CHAOS EVENT: JAMMED CASTER! PUSH HARDER!');
        this.sound.playEventAlert();
        break;
      case 'bag_drop': {
        const pos = this.cartBody?.translation();
        if (pos) this.spawnDroppedBag(pos.x, pos.z);
        this.showBanner('WHOOPS! A BAG OF APPLES ESCAPED!');
        break;
      }
      case 'downhill_cart':
      case 'runaway_cart': {
        const dir = Math.random() > 0.5 ? 1 : -1;
        this.spawnLooseDynamicCart(
          this.level.bay.x - dir * 8.5,
          Math.max(-2, Math.min(24, this.level.bay.z + 2.5)),
          dir * 3.4,
          -0.4,
          0x0ea5e9
        );
        this.showBanner('LOOK OUT! RUNAWAY CART ROLLING ACROSS THE LOT!');
        this.sound.playEventAlert();
        break;
      }
      case 'abandoned_cart': {
        this.spawnLooseDynamicCart(
          this.level.bay.x + (Math.random() - 0.5) * 0.6,
          this.level.bay.z + 1.2,
          0,
          -0.6,
          0xf97316
        );
        this.showBanner('A CUSTOMER LEFT THEIR CART BY YOUR BAY!');
        this.sound.playEventAlert();
        break;
      }
      case 'cart_cluster': {
        this.spawnLooseDynamicCart(this.level.bay.x - 1.5, this.level.bay.z + 3.2, 1.2, -0.3, 0x2563eb);
        this.spawnLooseDynamicCart(this.level.bay.x + 1.5, this.level.bay.z + 3.5, -1.0, -0.2, 0x16a34a);
        this.showBanner('CART TRAFFIC JAM IN THE AISLE!');
        this.sound.playEventAlert();
        break;
      }
      case 'exiting_car': {
        if (this.movingActors.length < 7) {
          const laneZ = this.level.bay.z > 8 ? 13.4 : 1.8;
          this.spawnMovingActor({
            id: `event_car_${Date.now()}`,
            kind: 'car_cruise',
            startX: -26,
            startZ: laneZ,
            endX: 26,
            endZ: laneZ,
            speed: 3.4,
            phaseOffset: 0.1,
            shirtColor: 0x10b981,
          });
          this.showBanner('HEADS UP! CUSTOMER CAR PULLING THROUGH AISLE!');
          this.sound.playEventAlert();
        }
        break;
      }
      case 'twin_crossing': {
        if (this.movingActors.length < 7) {
          const cz = Math.max(-4.8, Math.min(24, this.level.bay.z + 1.6));
          this.spawnMovingActor({
            id: `twin_ped_${Date.now()}`,
            kind: 'pedestrian',
            startX: Math.max(-28, this.level.bay.x - 8),
            startZ: cz,
            endX: Math.min(28, this.level.bay.x + 8),
            endZ: cz,
            speed: 1.4,
            phaseOffset: 0,
            shirtColor: 0xec4899,
          });
          this.showBanner('TWIN SHOPPERS CROSSING AHEAD!');
          this.sound.playPedestrianHey();
        }
        break;
      }
      case 'bay_reassigned': {
        // Fair reassignment: ONLY if player is still far away and hasn't entered or locked the bay
        const pos = this.cartBody?.translation();
        const dist = pos ? Math.hypot(pos.x - this.level.bay.x, pos.z - this.level.bay.z) : 0;
        if (this.level.isRandom && !this.wasInBay && this.parkProgress === 0 && dist > 5.5) {
          const alt = CANDIDATE_PARKING_BAYS.find(
            (b) =>
              b.id !== this.level.bayId &&
              Math.hypot(b.bay.x - this.level.bay.x, b.bay.z - this.level.bay.z) > 6 &&
              Math.hypot(b.bay.x - this.level.bay.x, b.bay.z - this.level.bay.z) < 18
          );
          if (alt) {
            this.level = {
              ...this.level,
              name: alt.zoneLabel,
              bayId: alt.id,
              bay: {
                ...alt.bay,
                width: this.level.bay.width,
                length: this.level.bay.length,
                requireReverse: this.level.bay.requireReverse,
              },
            };
            this.rebuildBayVisuals();
            this.showBanner(`BAY REASSIGNED -> ${alt.zoneLabel.toUpperCase()}!`);
            this.sound.playEventAlert();
          }
        }
        break;
      }
      case 'owner_ambush': {
        const cartPos = this.cartBody?.translation();
        if (cartPos) {
          const safe = resolveCircleObstacles(
            cartPos.x - 2.4,
            cartPos.z + 1.8,
            0.4,
            this.level.obstacles,
            [],
            true
          );
          this.ownerPos.set(safe.x, 0, safe.z);
          this.ownerPath = [];
          this.triggerOwnerEvent('circles', 6, 'FOUND YOU! STOP THAT CART RIGHT NOW!');
          this.showBanner('THE STORE OWNER APPEARED IN YOUR AISLE!');
        }
        break;
      }
      case 'owner_rearrange': {
        this.ownerApproachTimer = 2.4;
        this.spawnLooseDynamicCart(this.level.bay.x - 1.4, this.level.bay.z + 1.8, 0.9, -0.4, 0x6366f1);
        this.triggerOwnerEvent('idle', 4, 'EVERYTHING IN THIS LOT IS CROOKED!');
        this.showBanner('OWNER IS REARRANGING CARTS IN THE LOT!');
        break;
      }
      case 'pedestrian':
        this.showBanner('WATCH OUT! DISTRACTED SHOPPER!');
        this.sound.playPedestrianHey();
        break;
      case 'rogue_cart':
        this.showBanner('LOOSE CART ON THE LOOSE!');
        this.sound.playEventAlert();
        break;
    }
  }

  private showBanner(text: string): void {
    this.eventBanner = text;
    this.eventBannerTimer = 2.6;
    this.emitHud();
  }

  private updateMovingActors(dt: number): void {
    const cartPos = this.cartBody?.translation();
    const dynCircles = this.collectDynamicCircles(false);

    for (const actor of this.movingActors) {
      const dx = actor.endX - actor.startX;
      const dz = actor.endZ - actor.startZ;
      const dist = Math.hypot(dx, dz) || 1;
      const ux = (dx / dist) * actor.dir;
      const uz = (dz / dist) * actor.dir;

      // Cruising cars & pedestrians yield smoothly if player cart blocks their immediate nose
      let targetSpeed = actor.speed;
      if (actor.kind === 'car_cruise' && cartPos) {
        const toCartX = cartPos.x - actor.curX;
        const toCartZ = cartPos.z - actor.curZ;
        const dCart = Math.hypot(toCartX, toCartZ);
        const aheadDot = (toCartX * ux + toCartZ * uz) / Math.max(0.01, dCart);
        if (dCart < 4.5 && aheadDot > 0.5) {
          targetSpeed = 0; // polite brake yield
        }
      }
      actor.currentSpeed = expDamp(actor.currentSpeed, targetSpeed, 5.5, dt);

      actor.progress += (actor.currentSpeed * actor.dir * dt) / dist;
      if (actor.progress >= 1) {
        actor.progress = 1;
        actor.dir = -1;
      } else if (actor.progress <= 0) {
        actor.progress = 0;
        actor.dir = 1;
      }

      let nx = actor.startX + dx * actor.progress;
      let nz = actor.startZ + dz * actor.progress;

      // Pedestrians locally sidestep obstacles/carts instead of clipping straight through
      if (actor.kind === 'pedestrian' || actor.kind === 'pedestrian_cart') {
        const avoid = computeLocalAvoidance(nx, nz, ux, uz, dynCircles, 1.1);
        nx += avoid.x * dt * 1.6;
        nz += avoid.z * dt * 1.6;
        const res = resolveCircleObstacles(nx, nz, 0.34, this.level.obstacles, [], true);
        nx = res.x;
        nz = res.z;
      }

      const moveDx = nx - actor.curX;
      const moveDz = nz - actor.curZ;
      const stepDist = Math.hypot(moveDx, moveDz);
      actor.curX = nx;
      actor.curZ = nz;

      if (this.phase === 'playing') {
        actor.body.setNextKinematicTranslation({ x: nx, y: 0, z: nz });
      }

      actor.mesh.position.set(nx, 0, nz);
      if (stepDist > 0.0005) {
        const targetYaw = Math.atan2(moveDx, moveDz);
        const curYaw = actor.mesh.rotation.y;
        const yawDiff = clampAngle(targetYaw - curYaw);
        const nextYaw =
          actor.kind === 'car_cruise'
            ? targetYaw
            : curYaw + yawDiff * Math.min(1, dt * 6.5);
        actor.mesh.rotation.y = nextYaw;
        if (
          this.phase === 'playing' &&
          (actor.kind === 'car_cruise' ||
            actor.kind === 'rogue_cart' ||
            actor.kind === 'pedestrian_cart')
        ) {
          actor.body.setNextKinematicRotation({
            x: 0,
            y: Math.sin(nextYaw / 2),
            z: 0,
            w: Math.cos(nextYaw / 2),
          });
        }
      }

      if (actor.pedCharacter) {
        const actualSpeed = dt > 0 ? stepDist / dt : 0;
        actor.pedCharacter.update(actualSpeed, dt, actor.kind === 'pedestrian_cart');
      }
      if (actor.cartRig) {
        const wheelR = actor.cartRig.wheelRadius || 0.068;
        for (const w of actor.cartRig.wheelMeshes) {
          w.rotation.x += stepDist / wheelR;
        }
      }
    }
  }

  private syncPlayerMeshFromBody(dt: number): void {
    if (!this.cartBody || !this.playerRig) return;
    const vel = this.cartBody.linvel();
    const speed = Math.hypot(vel.x, vel.z);

    // Interpolate between previous and current fixed-timestep physics poses
    const alpha = Math.max(0, Math.min(1, this.physicsAccum / (1 / 60)));
    const ix = this.prevCartPose.x + (this.curCartPose.x - this.prevCartPose.x) * alpha;
    const iy = this.prevCartPose.y + (this.curCartPose.y - this.prevCartPose.y) * alpha;
    const iz = this.prevCartPose.z + (this.curCartPose.z - this.prevCartPose.z) * alpha;
    const iyaw =
      this.prevCartPose.yaw +
      clampAngle(this.curCartPose.yaw - this.prevCartPose.yaw) * alpha;

    this.playerRig.root.position.set(ix, Math.max(0, Math.min(0.12, iy - 0.44)), iz);
    this.playerRig.root.rotation.y = iyaw;

    this.playerRig.leftCasterPivot.rotation.y = this.casterState.leftAngle;
    this.playerRig.rightCasterPivot.rotation.y = this.casterState.rightAngle;

    const signedFwd = vel.x * Math.sin(iyaw) + vel.z * Math.cos(iyaw);
    const wheelR = this.playerRig.wheelRadius || 0.068;
    this.wheelSpinAngle += (signedFwd * dt) / wheelR;
    for (const w of this.playerRig.wheelMeshes) {
      w.rotation.x = this.wheelSpinAngle;
    }

    const targetPitch =
      (this.input.forward ? -0.045 : this.input.backward ? 0.04 : 0) +
      (this.input.brake && speed > 0.5 ? 0.06 : 0);
    const targetRoll =
      this.casterState.steerSmoothed * 0.055 * Math.min(1, speed / 2) +
      (this.wobbleTimer > 0 ? Math.sin(this.casterState.wobblePhase) * 0.04 : 0);

    this.playerRig.bodyTiltGroup.rotation.x = expDamp(
      this.playerRig.bodyTiltGroup.rotation.x,
      targetPitch,
      12,
      dt
    );
    this.playerRig.bodyTiltGroup.rotation.z = expDamp(
      this.playerRig.bodyTiltGroup.rotation.z,
      targetRoll,
      12,
      dt
    );

    this.playerRig.badWheelRing.visible =
      this.wobbleTimer > 0 || Math.abs(this.activeHandling.badWheelPull) > 0.35;
    if (this.playerRig.badWheelRing.visible) {
      const s = 1 + Math.sin(performance.now() * 0.015) * 0.14;
      this.playerRig.badWheelRing.scale.set(s, s, 1);
    }
  }

  private spawnCosmeticTrails(dt: number): void {
    const fx = this.activeCosmetics.effect ?? 'none';
    if (fx === 'none' || !this.cartBody) return;
    const vel = this.cartBody.linvel();
    const speed = Math.hypot(vel.x, vel.z);
    if (speed < 1.2) return;

    this.trailAccum += dt * (fx === 'tire_smoke' ? 14 : 9);
    if (this.trailAccum >= 1) {
      this.trailAccum = 0;
      const pos = this.cartBody.translation();
      this.spawnParticles(pos.x, 0.16, pos.z, 1);
    }
  }

  private evaluateParkingProgress(dt: number): void {
    if (!this.cartBody) return;
    const pos = this.cartBody.translation();
    const vel = this.cartBody.linvel();
    const speed = Math.hypot(vel.x, vel.z);
    const yaw = this.getCartYaw();

    const pose = evaluateBayPose(pos.x, pos.z, yaw, this.level.bay);
    const isInsideEnough =
      pose.inBounds || (pose.containmentPct >= 62 && pose.centerDistance <= 0.72 && (!this.level.bay.requireReverse || pose.angleErrorDeg <= 28));

    if (this.wasInBay && !isInsideEnough && speed > 0.8) {
      this.lineCrossCount++;
      if (this.lineCrossCount % 2 === 0) {
        this.triggerOwnerEvent('line_cross', 7);
      }
    }
    this.wasInBay = isInsideEnough;

    const beaconColor = pose.inBounds ? 0x4ade80 : isInsideEnough ? 0x38bdf8 : 0xfacc15;
    for (const cone of this.bayCornerLights) {
      const mat = cone.material as THREE.MeshStandardMaterial;
      mat.color.setHex(beaconColor);
      mat.emissive.setHex(beaconColor);
      mat.emissiveIntensity = pose.inBounds ? 0.95 : 0.45;
    }

    if (this.bayChevronMesh) {
      const t = performance.now() * 0.004;
      this.bayChevronMesh.position.y = 1.8 + Math.sin(t) * 0.18;
      this.bayChevronMesh.rotation.y += dt * 1.8;
      const cMat = this.bayChevronMesh.material as THREE.MeshStandardMaterial;
      cMat.color.setHex(beaconColor);
      cMat.emissive.setHex(beaconColor);
      this.bayChevronMesh.visible = !pose.inBounds;
    }

    if (isInsideEnough && speed < 0.34) {
      const rate = this.input.brake ? 1.55 : 0.92;
      this.parkProgress = Math.min(1, this.parkProgress + dt * rate);
      if (this.parkProgress >= 1) {
        this.completeLevel(pose);
      }
    } else {
      this.parkProgress = Math.max(0, this.parkProgress - dt * 1.8);
    }
  }

  private completeLevel(pose: ReturnType<typeof evaluateBayPose>): void {
    this.phase = 'gameover';
    this.clearInputs();
    this.sound.silenceLoops();
    this.hasCompletedRound = true;
    this.lastCompletedBay = {
      x: this.level.bay.x,
      z: this.level.bay.z,
      yaw: this.level.bay.yaw,
      bayId: this.level.bayId,
    };

    const evaluation = evaluateParkingScore(
      {
        pose,
        collisions: this.collisions,
        timeTaken: this.elapsedTime,
        parTime: this.level.parTime,
        steeringCorrections: this.steeringCorrections,
      },
      this.level.id
    );

    if (evaluation.stars === 3) {
      this.triggerOwnerEvent('perfect_park', -25);
    } else if (evaluation.stars === 1) {
      this.triggerOwnerEvent('repeat_fail', 8);
    }
    evaluation.ownerReaction = this.ownerDialogue ?? evaluation.commentary;

    if (evaluation.stars >= 2) {
      this.sound.playVictory(evaluation.stars);
    } else {
      this.sound.playFail();
    }

    this.emitHud();
    this.callbacks.onLevelComplete(evaluation, this.level);
  }

  private triggerMeltdownDefeat(): void {
    this.phase = 'gameover';
    this.clearInputs();
    this.sound.silenceLoops();
    this.sound.playFail();

    const evaluation: ParkingEvaluation = {
      accuracyPct: 0,
      centerDistance: 9.9,
      angleErrorDeg: 90,
      containmentPct: 0,
      inBounds: false,
      collisions: this.collisions,
      timeTaken: Number(this.elapsedTime.toFixed(1)),
      steeringCorrections: this.steeringCorrections,
      stars: 1,
      score: 50,
      commentary: 'JUST GIVE ME THE CART! BANNED FROM MEGA MART!',
      passed: false,
      meltdownDefeat: true,
      ownerReaction: this.ownerDialogue ?? 'ENOUGH!! GET OUT OF MY PARKING LOT!!',
    };
    this.emitHud();
    this.callbacks.onLevelComplete(evaluation, this.level);
  }

  private triggerTimeExpiredDefeat(): void {
    this.phase = 'gameover';
    this.clearInputs();
    this.sound.silenceLoops();
    this.sound.playFail();

    const evaluation: ParkingEvaluation = {
      accuracyPct: 0,
      centerDistance: 9.9,
      angleErrorDeg: 90,
      containmentPct: 0,
      inBounds: false,
      collisions: this.collisions,
      timeTaken: Number(this.elapsedTime.toFixed(1)),
      steeringCorrections: this.steeringCorrections,
      stars: 1,
      score: 50,
      commentary: "TIME'S UP! THE STORE CLOSED WHILE YOU WERE TURNING!",
      passed: false,
      timeExpired: true,
      ownerReaction: "I'VE SEEN GLACIERS PARK FASTER THAN YOU!",
    };
    this.emitHud();
    this.callbacks.onLevelComplete(evaluation, this.level);
  }

  private clampCameraAgainstWallsAndBuildings(
    lookX: number,
    lookY: number,
    lookZ: number,
    camX: number,
    camY: number,
    camZ: number
  ): { x: number; y: number; z: number } {
    let cx = camX;
    let cy = camY;
    let cz = camZ;

    // Prevent camera from entering the storefront building (z <= -9.5) or outside lot bounds
    if (cz < -8.8) {
      const t = Math.max(0.15, (lookZ - -8.8) / Math.max(0.01, lookZ - cz));
      cx = lookX + (cx - lookX) * t;
      cy = Math.max(2.2, lookY + (cy - lookY) * t);
      cz = -8.8;
    }

    // Clamp outside left/right/south lot bounds smoothly
    cx = Math.max(-33.5, Math.min(33.5, cx));
    cz = Math.min(29.5, cz);

    // Pull in slightly if camera is intersecting a tall solid obstacle like loading dock or trees
    for (const obs of this.level.obstacles) {
      if (obs.kind !== 'loading_dock' && obs.kind !== 'car') continue;
      if (cy < obs.height + 0.45) {
        const halfW = obs.width / 2 + 0.5;
        const halfL = obs.length / 2 + 0.5;
        if (Math.abs(cx - obs.x) < halfW && Math.abs(cz - obs.z) < halfL) {
          cy = obs.height + 0.85;
        }
      }
    }

    return { x: cx, y: cy, z: cz };
  }

  private updateFollowCamera(dt: number): void {
    if (!this.cartBody) return;
    const pos = this.cartBody.translation();
    const vel = this.cartBody.linvel();
    const yaw = this.getCartYaw();
    const signedFwd = vel.x * Math.sin(yaw) + vel.z * Math.cos(yaw);
    const isReversing = signedFwd < -0.25 || (this.input.backward && !this.input.forward);

    const viewYaw = yaw + this.camYawOffset;
    const fwdX = Math.sin(viewYaw);
    const fwdZ = Math.cos(viewYaw);

    const portraitBoost =
      this.camera.aspect < 1 ? Math.min(1.65, 1.05 / Math.max(0.45, this.camera.aspect)) : 1;

    if (this.cameraMode === 'overhead') {
      const dist = Math.hypot(pos.x - this.level.bay.x, pos.z - this.level.bay.z);
      const bayWeight = Math.max(0.12, Math.min(0.42, 6 / Math.max(6, dist)));
      const midX = pos.x * (1 - bayWeight) + this.level.bay.x * bayWeight;
      const midZ = pos.z * (1 - bayWeight) + this.level.bay.z * bayWeight + 0.7;
      _vec3A.set(midX, 13.8 * portraitBoost * this.camZoom, midZ + 6.0 * portraitBoost * this.camZoom);
      _vec3B.set(midX, 0.2, midZ);
    } else {
      const distToBay = Math.hypot(pos.x - this.level.bay.x, pos.z - this.level.bay.z);
      const bayBias = Math.max(0, 1 - distToBay / 8.5) * 0.28;
      const revZoom = isReversing ? 1.18 : 1.0;
      const followDist = 4.65 * portraitBoost * this.camZoom * revZoom;
      const followHeight = (isReversing ? 4.35 : 3.85) * portraitBoost * Math.pow(this.camZoom, 0.65);

      _vec3A.set(
        pos.x - fwdX * followDist,
        followHeight,
        pos.z - fwdZ * followDist + (this.camYawOffset === 0 ? 0.9 : 0)
      );
      _vec3B.set(
        pos.x * (1 - bayBias) + this.level.bay.x * bayBias + fwdX * (isReversing ? 0.2 : 1.15),
        0.55,
        pos.z * (1 - bayBias) + this.level.bay.z * bayBias + fwdZ * (isReversing ? 0.2 : 1.15)
      );
    }

    const safeCam = this.clampCameraAgainstWallsAndBuildings(
      _vec3B.x,
      _vec3B.y,
      _vec3B.z,
      _vec3A.x,
      _vec3A.y,
      _vec3A.z
    );

    this.camPos.x = expDamp(this.camPos.x, safeCam.x, 6.2, dt);
    this.camPos.y = expDamp(this.camPos.y, safeCam.y, 6.2, dt);
    this.camPos.z = expDamp(this.camPos.z, safeCam.z, 6.2, dt);

    this.camLook.x = expDamp(this.camLook.x, _vec3B.x, 8.5, dt);
    this.camLook.y = expDamp(this.camLook.y, _vec3B.y, 8.5, dt);
    this.camLook.z = expDamp(this.camLook.z, _vec3B.z, 8.5, dt);

    const shake = this.cameraTrauma * this.cameraTrauma;
    const sx = (Math.random() - 0.5) * shake * 0.35;
    const sy = (Math.random() - 0.5) * shake * 0.35;

    this.camera.position.set(this.camPos.x + sx, this.camPos.y + sy, this.camPos.z);
    this.camera.lookAt(this.camLook);
  }

  private spawnParticles(x: number, y: number, z: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.particleCursor];
      this.particleCursor = (this.particleCursor + 1) % this.particles.length;
      p.active = true;
      p.life = 0;
      p.maxLife = 0.35 + Math.random() * 0.28;
      p.x = x + (Math.random() - 0.5) * 0.3;
      p.y = y + Math.random() * 0.25;
      p.z = z + (Math.random() - 0.5) * 0.3;
      const angle = Math.random() * Math.PI * 2;
      const spd = 1.4 + Math.random() * 3.0;
      p.vx = Math.cos(angle) * spd;
      p.vy = 2.0 + Math.random() * 2.5;
      p.vz = Math.sin(angle) * spd;
      p.scale = 0.7 + Math.random() * 0.9;
    }
  }

  private updateParticles(dt: number): void {
    let dirty = false;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      dirty = true;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        _mat4.makeScale(0, 0, 0);
        this.particleMesh.setMatrixAt(i, _mat4);
        continue;
      }
      p.vy -= 9.8 * dt;
      p.x += p.vx * dt;
      p.y = Math.max(0.04, p.y + p.vy * dt);
      p.z += p.vz * dt;
      const s = p.scale * (1 - p.life / p.maxLife);
      _scaleVec.set(s, s, s);
      _vec3A.set(p.x, p.y, p.z);
      _mat4.compose(_vec3A, _quat, _scaleVec);
      this.particleMesh.setMatrixAt(i, _mat4);
    }
    if (dirty) {
      this.particleMesh.instanceMatrix.needsUpdate = true;
    }
  }

  private spawnDroppedBag(cartX: number, cartZ: number): void {
    const bag = this.droppedBags[this.bagCursor];
    this.bagCursor = (this.bagCursor + 1) % this.droppedBags.length;
    bag.active = true;
    bag.x = cartX + (Math.random() - 0.5) * 0.4;
    bag.y = 0.75;
    bag.z = cartZ + (Math.random() - 0.5) * 0.4;
    const angle = Math.random() * Math.PI * 2;
    bag.vx = Math.cos(angle) * 1.6;
    bag.vy = 2.8;
    bag.vz = Math.sin(angle) * 1.6;
    bag.rotSpeed = (Math.random() - 0.5) * 8;
    bag.mesh.position.set(bag.x, bag.y, bag.z);
    bag.mesh.visible = true;
    this.sound.playBagDrop();
  }

  private updateDroppedBags(dt: number): void {
    for (const b of this.droppedBags) {
      if (!b.active) continue;
      if (b.y > 0.14 || b.vy > 0) {
        b.vy -= 12 * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.z += b.vz * dt;
        b.mesh.rotation.x += b.rotSpeed * dt;
        b.mesh.rotation.z += b.rotSpeed * 0.7 * dt;
        if (b.y <= 0.14) {
          b.y = 0.14;
          b.vy = Math.abs(b.vy) > 1.2 ? -b.vy * 0.35 : 0;
          b.vx *= 0.45;
          b.vz *= 0.45;
          b.rotSpeed *= 0.4;
        }
        b.mesh.position.set(b.x, b.y, b.z);
      }
    }
  }

  public getOwnerSnapshot(): OwnerStateSnapshot {
    return {
      anger: Math.round(this.ownerAnger),
      stage: this.ownerStage,
      anim: this.ownerAnim,
      expression: this.ownerExpression,
      dialogue: this.ownerDialogue,
      meltdownActive: this.ownerStage === 5,
      survivedStage5: this.ownerSurvivedStage5 || this.ownerStage === 5,
    };
  }

  private emitHud(): void {
    if (!this.cartBody) return;
    const pos = this.cartBody.translation();
    const vel = this.cartBody.linvel();
    const yaw = this.getCartYaw();
    const speed = Math.hypot(vel.x, vel.z);
    const signedFwd = vel.x * Math.sin(yaw) + vel.z * Math.cos(yaw);
    const pose = evaluateBayPose(pos.x, pos.z, yaw, this.level.bay);

    const toBayX = this.level.bay.x - pos.x;
    const toBayZ = this.level.bay.z - pos.z;
    const bayDistance = Math.hypot(toBayX, toBayZ);
    const fwdDot = toBayX * Math.sin(yaw) + toBayZ * Math.cos(yaw);
    const rightDot = toBayX * -Math.cos(yaw) + toBayZ * Math.sin(yaw);
    const bayBearingRad = Math.atan2(rightDot, fwdDot);

    this.callbacks.onHudUpdate({
      levelId: this.level.id,
      levelName: this.level.name,
      gameMode: this.gameMode,
      cartId: this.activeCartDef.id,
      elapsedTime: this.elapsedTime,
      timeLimit: this.timeLimit,
      collisions: this.collisions,
      steeringCorrections: this.steeringCorrections,
      forecastStars: forecastStars(
        this.collisions,
        this.elapsedTime,
        this.level.parTime,
        pose.alignmentPct
      ),
      steeringInput: this.casterState.steerSmoothed,
      leftCasterAngle: this.casterState.leftAngle,
      rightCasterAngle: this.casterState.rightAngle,
      speed,
      reversing: signedFwd < -0.15 || (this.input.backward && !this.input.forward),
      braking: this.input.brake,
      inBay:
        pose.inBounds ||
        (pose.containmentPct >= 62 &&
          pose.centerDistance <= 0.72 &&
          (!this.level.bay.requireReverse || pose.angleErrorDeg <= 28)),
      bayAccuracyPct: pose.alignmentPct,
      parkProgress: this.parkProgress,
      activeEventBanner: this.eventBanner,
      cameraMode: this.cameraMode,
      owner: this.getOwnerSnapshot(),
      coins: this.coinsDisplay,
      bayDistance,
      bayBearingRad,
      requireReverse: Boolean(this.level.bay.requireReverse),
      scenarioLabel: this.level.scenario ? SCENARIO_LABELS[this.level.scenario] : undefined,
    });
  }

  private handleResize = (): void => {
    if (!this.renderer || !this.camera || !this.container) return;
    const { width, height } = this.getViewportSize();
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.renderer.render(this.scene, this.camera);
  };

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.resizeObserver?.disconnect();
    window.removeEventListener('resize', this.handleResize);
    window.visualViewport?.removeEventListener('resize', this.handleResize);
    if (this.renderer?.domElement) {
      this.renderer.domElement.removeEventListener('pointerdown', this.onCanvasPointerDown);
      this.renderer.domElement.removeEventListener('wheel', this.onCanvasWheel);
    }
    window.removeEventListener('pointermove', this.onCanvasPointerMove);
    window.removeEventListener('pointerup', this.onCanvasPointerUp);
    this.sound.dispose();

    if (this.eventQueue) {
      this.eventQueue.free();
      this.eventQueue = null;
    }
    if (this.world) {
      this.world.free();
      this.world = null;
    }

    if (this.scene) {
      this.disposeHierarchy(this.scene);
    }
    this.shadowTex?.dispose();
    this.groundTexMap?.dispose();
    this.groundTexBump?.dispose();
    this.envTexture?.dispose();
    this.groundTexMap = null;
    this.groundTexBump = null;
    this.envTexture = null;

    this.renderer?.dispose();
    if (this.renderer?.domElement?.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
