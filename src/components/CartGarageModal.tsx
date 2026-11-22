import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  ACCESSORIES,
  CART_CATALOG,
  COLOR_SWATCHES,
  EFFECTS,
  WHEEL_STYLES,
  getCartDefinition,
} from '../game/carts';
import { buildCustomShoppingCart } from '../game/cartModels';
import { createRadialShadowTexture } from '../game/models';
import {
  type PlayerProgression,
  unlockCartWithCoins,
  unlockOrEquipCosmetic,
} from '../game/progression';
import type { CartDefinition, CartId, CosmeticLoadout } from '../game/types';

interface CartGarageModalProps {
  progression: PlayerProgression;
  onUpdateProgression: (next: PlayerProgression) => void;
  onUnlockSound: () => void;
  onCoinSound: () => void;
  onClose: () => void;
}

type CosmeticTab = 'paint' | 'wheels' | 'accessory' | 'effects';

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

const STAT_ROWS: Array<{
  key: keyof CartDefinition['stats'];
  label: string;
  invertBetter?: boolean;
}> = [
  { key: 'speed', label: 'SPEED' },
  { key: 'stability', label: 'STABILITY' },
  { key: 'steering', label: 'STEERING' },
  { key: 'weight', label: 'WEIGHT' },
  { key: 'difficulty', label: 'CHAOS / DIFFICULTY', invertBetter: true },
];

interface ShowroomProps {
  cartId: CartId;
  cosmetics: CosmeticLoadout;
}

const CartShowroomCanvas: React.FC<ShowroomProps> = ({ cartId, cosmetics }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<{
    yaw: number;
    pitch: number;
    dragging: boolean;
    lastX: number;
    lastY: number;
    requestRender: () => void;
  }>({
    yaw: 0.68,
    pitch: 0.34,
    dragging: false,
    lastX: 0,
    lastY: 0,
    requestRender: () => {},
  });

  const sceneRefs = useRef<{
    scene: THREE.Scene;
    turntable: THREE.Group;
    shadowTex: THREE.CanvasTexture;
    cartRigGroup: THREE.Group | null;
  } | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const softwareGl = detectSoftwareGl();

    const width = Math.max(240, mount.clientWidth || 380);
    const height = Math.max(200, mount.clientHeight || 260);

    const renderer = new THREE.WebGLRenderer({
      antialias: !softwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(softwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !softwareGl;
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe0f2fe);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 40);
    const updateCamera = () => {
      const dist = 2.45;
      const { yaw, pitch } = stateRef.current;
      camera.position.set(
        Math.sin(yaw) * Math.cos(pitch) * dist,
        0.52 + Math.sin(pitch) * dist,
        Math.cos(yaw) * Math.cos(pitch) * dist
      );
      camera.lookAt(0, 0.48, 0);
    };
    updateCamera();

    const hemi = new THREE.HemisphereLight(0xf0f9ff, 0x334155, 0.78);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.85);
    keyLight.position.set(3.2, 5.2, 3.6);
    keyLight.castShadow = !softwareGl;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.6);
    rimLight.position.set(-3.5, 2.5, -3);
    scene.add(rimLight);

    // Showroom tiled floor & turntable plinth
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(4.5, 32),
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.86 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const turntable = new THREE.Group();
    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 1.02, 0.08, 32),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.45, metalness: 0.25 })
    );
    plinth.position.y = 0.04;
    plinth.receiveShadow = true;
    turntable.add(plinth);

    const plinthTop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.86, 0.86, 0.015, 32),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4, metalness: 0.15 })
    );
    plinthTop.position.y = 0.082;
    turntable.add(plinthTop);

    const innerDisk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.76, 0.76, 0.02, 32),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.55 })
    );
    innerDisk.position.y = 0.086;
    innerDisk.receiveShadow = true;
    turntable.add(innerDisk);

    scene.add(turntable);

    const shadowTex = createRadialShadowTexture();
    sceneRefs.current = { scene, turntable, shadowTex, cartRigGroup: null };

    let disposed = false;
    let frameId = 0;

    const renderOnce = () => {
      if (disposed) return;
      updateCamera();
      renderer.render(scene, camera);
    };
    stateRef.current.requestRender = renderOnce;

    let lastT = performance.now();
    const tick = (now: number) => {
      if (disposed) return;
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      if (!stateRef.current.dragging && !softwareGl) {
        stateRef.current.yaw += dt * 0.52;
      }
      renderOnce();
      if (!softwareGl) {
        frameId = requestAnimationFrame(tick);
      }
    };

    const onResize = () => {
      if (!mount || disposed) return;
      const w = Math.max(240, mount.clientWidth || 380);
      const h = Math.max(200, mount.clientHeight || 260);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderOnce();
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(mount);

    renderOnce();
    if (!softwareGl) {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      ro.disconnect();
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry?.dispose();
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          mats.forEach((mat) => mat?.dispose());
        }
      });
      shadowTex.dispose();
      envTex.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
      sceneRefs.current = null;
    };
  }, []);

  // Rebuild displayed cart whenever inspected cartId or cosmetics change
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs) return;
    if (refs.cartRigGroup) {
      refs.turntable.remove(refs.cartRigGroup);
      refs.cartRigGroup.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry?.dispose();
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          mats.forEach((mat) => mat?.dispose());
        }
      });
    }
    const rig = buildCustomShoppingCart(cartId, refs.shadowTex, cosmetics);
    rig.root.position.y = 0.09;
    refs.turntable.add(rig.root);
    refs.cartRigGroup = rig.root;
    stateRef.current.requestRender();
  }, [cartId, cosmetics]);

  const setPresetAngle = (yaw: number, pitch = 0.32) => {
    stateRef.current.yaw = yaw;
    stateRef.current.pitch = pitch;
    stateRef.current.requestRender();
  };

  return (
    <div className="relative rounded-2xl border-2 border-slate-900 overflow-hidden bg-sky-100 shadow-[4px_4px_0px_#0f172a]">
      <div
        ref={mountRef}
        data-testid="garage-showroom-canvas"
        className="w-full h-56 sm:h-64 cursor-grab active:cursor-grabbing touch-none"
        onPointerDown={(e) => {
          stateRef.current.dragging = true;
          stateRef.current.lastX = e.clientX;
          stateRef.current.lastY = e.clientY;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!stateRef.current.dragging) return;
          const dx = e.clientX - stateRef.current.lastX;
          const dy = e.clientY - stateRef.current.lastY;
          stateRef.current.lastX = e.clientX;
          stateRef.current.lastY = e.clientY;
          stateRef.current.yaw -= dx * 0.012;
          stateRef.current.pitch = Math.max(0.14, Math.min(0.75, stateRef.current.pitch + dy * 0.008));
          stateRef.current.requestRender();
        }}
        onPointerUp={() => {
          stateRef.current.dragging = false;
        }}
        onPointerCancel={() => {
          stateRef.current.dragging = false;
        }}
      />

      <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-slate-900/90 text-amber-300 text-[10px] font-black tracking-wider uppercase pointer-events-none">
        DRAG TO INSPECT 360°
      </div>

      <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1">
        {[
          { label: '3/4', yaw: 0.68 },
          { label: 'SIDE', yaw: Math.PI * 0.5 },
          { label: 'FRONT', yaw: 0.05 },
        ].map((btn) => (
          <button
            key={btn.label}
            type="button"
            onClick={() => setPresetAngle(btn.yaw)}
            className="px-2 py-1 rounded-md bg-white/95 hover:bg-amber-200 border border-slate-900 text-[10px] font-black text-slate-900 cursor-pointer"
          >
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export const CartGarageModal: React.FC<CartGarageModalProps> = ({
  progression,
  onUpdateProgression,
  onUnlockSound,
  onCoinSound,
  onClose,
}) => {
  const [inspectedId, setInspectedId] = useState<CartId>(progression.selectedCartId);
  const [cosmeticTab, setCosmeticTab] = useState<CosmeticTab>('paint');
  const [justUnlockedName, setJustUnlockedName] = useState<string | null>(null);

  const inspectedCart = useMemo(() => getCartDefinition(inspectedId), [inspectedId]);
  const equippedCart = useMemo(
    () => getCartDefinition(progression.selectedCartId),
    [progression.selectedCartId]
  );

  const isUnlocked = progression.unlockedCarts.includes(inspectedId);
  const isEquipped = progression.selectedCartId === inspectedId;

  const handleSelectOrBuyCart = () => {
    if (isUnlocked) {
      onCoinSound();
      onUpdateProgression({ ...progression, selectedCartId: inspectedId });
      return;
    }
    const res = unlockCartWithCoins(progression, inspectedId);
    if (res.ok) {
      onUnlockSound();
      setJustUnlockedName(inspectedCart.name);
      onUpdateProgression(res.progression);
      setTimeout(() => setJustUnlockedName(null), 2600);
    }
  };

  const handleCosmeticAction = (
    cosmeticId: string,
    apply: (loadout: CosmeticLoadout) => CosmeticLoadout
  ) => {
    const alreadyOwned = progression.unlockedCosmetics.includes(cosmeticId);
    const res = unlockOrEquipCosmetic(progression, cosmeticId, apply);
    if (!res.ok) return;
    if (alreadyOwned) {
      onCoinSound();
    } else {
      onUnlockSound();
    }
    onUpdateProgression(res.progression);
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-2.5 sm:p-5"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.78)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Cart Showroom and Collection"
    >
      <div className="w-full max-w-5xl rounded-2xl bg-slate-50 border-3 border-slate-900 shadow-[8px_8px_0px_#0f172a] p-4 sm:p-6 max-h-[94vh] overflow-y-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b-2 border-slate-200">
          <div>
            <div className="text-[10px] font-black tracking-widest uppercase text-red-600">
              MEGA MART TROLLEY SHOWROOM
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              CART GARAGE ({progression.unlockedCarts.length} / {CART_CATALOG.length})
            </h2>
          </div>

          <div className="flex items-center gap-2.5">
            <div
              className="px-3.5 py-1.5 rounded-xl bg-amber-300 border-2 border-slate-900 shadow-[2px_2px_0px_#0f172a] font-black text-sm text-slate-950 tabular-nums"
              data-testid="garage-coins"
            >
              {progression.coins.toLocaleString()} COINS
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-sm border-2 border-slate-900 cursor-pointer"
            >
              DONE
            </button>
          </div>
        </div>

        {justUnlockedName && (
          <div className="mb-3 px-4 py-2 rounded-xl bg-emerald-500 border-2 border-slate-900 text-white font-black text-sm text-center shadow-[3px_3px_0px_#0f172a]">
            NEW CART UNLOCKED &amp; EQUIPPED: {justUnlockedName.toUpperCase()}!
          </div>
        )}

        {/* Main 2-Column Garage Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left: 3D Showroom + Cart Specs & Unlock CTA */}
          <div className="lg:col-span-6 flex flex-col gap-3">
            <CartShowroomCanvas cartId={inspectedId} cosmetics={progression.cosmetics} />

            {/* Inspected Cart Header & CTA */}
            <div className="p-4 rounded-2xl bg-white border-2 border-slate-900 shadow-[3px_3px_0px_#0f172a]">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xl font-black text-slate-900">{inspectedCart.name}</h3>
                    {isEquipped && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-600 text-white uppercase">
                        EQUIPPED
                      </span>
                    )}
                    {!isUnlocked && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded bg-slate-800 text-amber-300 uppercase">
                        LOCKED
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-slate-600 mt-0.5">
                    {inspectedCart.tagline}
                  </p>
                </div>
              </div>

              {/* 5-Axis Stats + Comparison vs Equipped */}
              <div className="space-y-1.5 my-3">
                {STAT_ROWS.map((row) => {
                  const val = inspectedCart.stats[row.key];
                  const eqVal = equippedCart.stats[row.key];
                  const diff = val - eqVal;
                  const diffColor =
                    diff === 0
                      ? 'text-slate-400'
                      : row.invertBetter
                        ? diff < 0
                          ? 'text-emerald-600'
                          : 'text-red-600'
                        : diff > 0
                          ? 'text-emerald-600'
                          : 'text-red-600';

                  return (
                    <div key={row.key} className="flex items-center gap-2">
                      <span className="w-32 text-[10px] font-black tracking-wider text-slate-700 shrink-0">
                        {row.label}
                      </span>
                      <div className="flex-1 h-2.5 bg-slate-200 rounded-full overflow-hidden border border-slate-300">
                        <div
                          className="h-full rounded-full transition-all duration-200"
                          style={{
                            width: `${val * 10}%`,
                            backgroundColor: row.invertBetter
                              ? val >= 7
                                ? '#ef4444'
                                : '#f59e0b'
                              : '#0ea5e9',
                          }}
                        />
                      </div>
                      <span className="w-8 text-right text-xs font-black tabular-nums text-slate-900">
                        {val}/10
                      </span>
                      <span className={`w-8 text-right text-[10px] font-black tabular-nums ${diffColor}`}>
                        {!isEquipped && diff !== 0 ? (diff > 0 ? `+${diff}` : diff) : ''}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Unlock Challenge Hint + Equip / Purchase CTA */}
              {!isUnlocked && (
                <div className="mb-2.5 px-3 py-1.5 rounded-lg bg-amber-100 border border-amber-400 text-[11px] font-bold text-slate-800">
                  Challenge Unlock: {inspectedCart.challengeHint}
                </div>
              )}

              <button
                type="button"
                disabled={!isUnlocked && progression.coins < inspectedCart.cost}
                onClick={handleSelectOrBuyCart}
                className={`w-full py-2.5 px-4 rounded-xl font-black text-sm border-2 border-slate-900 shadow-[3px_3px_0px_#0f172a] transition-colors ${
                  isEquipped
                    ? 'bg-emerald-600 text-white cursor-default'
                    : isUnlocked
                      ? 'bg-amber-300 hover:bg-amber-200 text-slate-950 cursor-pointer'
                      : progression.coins >= inspectedCart.cost
                        ? 'bg-red-600 hover:bg-red-500 text-white cursor-pointer'
                        : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                }`}
              >
                {isEquipped
                  ? 'CURRENTLY EQUIPPED'
                  : isUnlocked
                    ? `EQUIP ${inspectedCart.name.toUpperCase()}`
                    : progression.coins >= inspectedCart.cost
                      ? `UNLOCK FOR ${inspectedCart.cost} COINS`
                      : `NEED ${inspectedCart.cost} COINS (${inspectedCart.cost - progression.coins} MORE)`}
              </button>
            </div>
          </div>

          {/* Right: 10-Cart Selector Grid + Cosmetics Customizer */}
          <div className="lg:col-span-6 flex flex-col gap-3">
            {/* Cart Collection Grid */}
            <div className="p-3.5 rounded-2xl bg-white border-2 border-slate-900 shadow-[3px_3px_0px_#0f172a]">
              <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">
                SELECT TROLLEY TO INSPECT ({CART_CATALOG.length} MODELS)
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-2 gap-1.5 max-h-[276px] overflow-y-auto pr-1">
                {CART_CATALOG.map((cart) => {
                  const unlocked = progression.unlockedCarts.includes(cart.id);
                  const equipped = progression.selectedCartId === cart.id;
                  const active = inspectedId === cart.id;
                  return (
                    <button
                      key={cart.id}
                      type="button"
                      data-testid={`garage-cart-${cart.id}`}
                      onClick={() => setInspectedId(cart.id)}
                      className={`text-left p-2 rounded-xl border-2 transition-colors cursor-pointer ${
                        active
                          ? 'border-red-600 bg-amber-50 shadow-[2px_2px_0px_#dc2626]'
                          : 'border-slate-900 bg-slate-50 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span
                          className="w-3 h-3 rounded-full border border-slate-900 shrink-0"
                          style={{
                            backgroundColor: `#${cart.primaryColor.toString(16).padStart(6, '0')}`,
                          }}
                        />
                        {equipped ? (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-600 text-white">
                            ACTIVE
                          </span>
                        ) : unlocked ? (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-slate-200 text-slate-800">
                            OWNED
                          </span>
                        ) : (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-300 text-slate-950">
                            {cart.cost} C
                          </span>
                        )}
                      </div>
                      <div className="font-black text-xs text-slate-900 truncate">{cart.name}</div>
                      <div className="text-[10px] font-semibold text-slate-500 truncate">
                        SPD {cart.stats.speed} · STB {cart.stats.stability}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cosmetics Customizer */}
            <div className="p-3.5 rounded-2xl bg-white border-2 border-slate-900 shadow-[3px_3px_0px_#0f172a]">
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                  CUSTOMIZE LOADOUT
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateProgression({
                      ...progression,
                      cosmetics: {
                        accentColor: null,
                        wheelStyle: null,
                        accessory: 'none',
                        effect: 'none',
                      },
                    })
                  }
                  className="text-[10px] font-black text-slate-600 hover:text-red-600 underline cursor-pointer"
                >
                  RESET STOCK
                </button>
              </div>

              {/* Tabs */}
              <div className="grid grid-cols-4 gap-1.5 mb-3">
                {(
                  [
                    { id: 'paint', label: 'PAINT' },
                    { id: 'wheels', label: 'WHEELS' },
                    { id: 'accessory', label: 'GEAR' },
                    { id: 'effects', label: 'TRAIL' },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setCosmeticTab(t.id)}
                    className={`py-1.5 rounded-lg font-black text-[11px] border-2 border-slate-900 cursor-pointer ${
                      cosmeticTab === t.id
                        ? 'bg-slate-900 text-amber-300'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-900'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tab Items */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {cosmeticTab === 'paint' &&
                  COLOR_SWATCHES.map((sw) => {
                    const owned = progression.unlockedCosmetics.includes(sw.id);
                    const equipped = progression.cosmetics.accentColor === sw.value;
                    return (
                      <button
                        key={sw.id}
                        type="button"
                        disabled={!owned && progression.coins < sw.cost}
                        onClick={() =>
                          handleCosmeticAction(sw.id, (prev) => ({
                            ...prev,
                            accentColor: prev.accentColor === sw.value ? null : sw.value,
                          }))
                        }
                        className={`p-2 rounded-xl border-2 text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                          equipped
                            ? 'border-emerald-600 bg-emerald-50'
                            : 'border-slate-900 bg-slate-50 hover:bg-amber-50'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <span
                            className="w-4 h-4 rounded-full border border-slate-900"
                            style={{
                              backgroundColor: `#${sw.value.toString(16).padStart(6, '0')}`,
                            }}
                          />
                          <span className="text-[10px] font-black text-slate-900 truncate">
                            {sw.label}
                          </span>
                        </div>
                        <div className="text-[10px] font-black text-slate-600">
                          {equipped ? 'EQUIPPED' : owned ? 'OWNED' : `${sw.cost} COINS`}
                        </div>
                      </button>
                    );
                  })}

                {cosmeticTab === 'wheels' &&
                  WHEEL_STYLES.map((wh) => {
                    const owned = progression.unlockedCosmetics.includes(wh.id);
                    const equipped = progression.cosmetics.wheelStyle === wh.value;
                    return (
                      <button
                        key={wh.id}
                        type="button"
                        disabled={!owned && progression.coins < wh.cost}
                        onClick={() =>
                          handleCosmeticAction(wh.id, (prev) => ({
                            ...prev,
                            wheelStyle: prev.wheelStyle === wh.value ? null : wh.value,
                          }))
                        }
                        className={`p-2 rounded-xl border-2 text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                          equipped
                            ? 'border-emerald-600 bg-emerald-50'
                            : 'border-slate-900 bg-slate-50 hover:bg-amber-50'
                        }`}
                      >
                        <div className="text-[11px] font-black text-slate-900 truncate">
                          {wh.label}
                        </div>
                        <div className="text-[10px] font-black text-slate-600 mt-0.5">
                          {equipped ? 'EQUIPPED' : owned ? 'OWNED' : `${wh.cost} COINS`}
                        </div>
                      </button>
                    );
                  })}

                {cosmeticTab === 'accessory' &&
                  ACCESSORIES.map((acc) => {
                    const owned = progression.unlockedCosmetics.includes(acc.id);
                    const equipped = progression.cosmetics.accessory === acc.value;
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        disabled={!owned && progression.coins < acc.cost}
                        onClick={() =>
                          handleCosmeticAction(acc.id, (prev) => ({
                            ...prev,
                            accessory: acc.value,
                          }))
                        }
                        className={`p-2 rounded-xl border-2 text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                          equipped
                            ? 'border-emerald-600 bg-emerald-50'
                            : 'border-slate-900 bg-slate-50 hover:bg-amber-50'
                        }`}
                      >
                        <div className="text-[11px] font-black text-slate-900 truncate">
                          {acc.label}
                        </div>
                        <div className="text-[10px] font-black text-slate-600 mt-0.5">
                          {equipped ? 'EQUIPPED' : owned ? 'OWNED' : `${acc.cost} COINS`}
                        </div>
                      </button>
                    );
                  })}

                {cosmeticTab === 'effects' &&
                  EFFECTS.map((fx) => {
                    const owned = progression.unlockedCosmetics.includes(fx.id);
                    const equipped = progression.cosmetics.effect === fx.value;
                    return (
                      <button
                        key={fx.id}
                        type="button"
                        disabled={!owned && progression.coins < fx.cost}
                        onClick={() =>
                          handleCosmeticAction(fx.id, (prev) => ({
                            ...prev,
                            effect: fx.value,
                          }))
                        }
                        className={`p-2 rounded-xl border-2 text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                          equipped
                            ? 'border-emerald-600 bg-emerald-50'
                            : 'border-slate-900 bg-slate-50 hover:bg-amber-50'
                        }`}
                      >
                        <div className="text-[11px] font-black text-slate-900 truncate">
                          {fx.label}
                        </div>
                        <div className="text-[10px] font-black text-slate-600 mt-0.5">
                          {equipped ? 'EQUIPPED' : owned ? 'OWNED' : `${fx.cost} COINS`}
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
