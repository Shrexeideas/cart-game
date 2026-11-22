# ORIGINAL ASSETS — Parallel Parking: Cart Chaos

This document catalogs all original assets authored specifically for **Parallel Parking: Cart Chaos**. All assets below were written from scratch in TypeScript, HTML5 Canvas 2D, Web Audio API, and inline SVG without copying or extracting any third-party models, textures, audio samples, or UI sprites.

---

## 1. Procedural 3D Models (`src/game/models.ts` & `src/game/CartChaosEngine.ts`)

1. **Hero & 10 Unlockable Shopping Cart Models (`buildShoppingCart`, `buildCustomShoppingCart`)**
   - Multi-part `THREE.Group` models across 10 visually distinct silhouettes (`Classic Cart`, `Speed Demon`, `Heavy Duty`, `Wobbly Wheels`, `Tiny Trolley`, `Luxury Cart`, `Rust Bucket`, `Monster Cart`, `Shopping Basket Cart`, `Golden Cart`), 4 wheel designs (`standard`, `sport`, `offroad`, `gold`), and 4 attachable cosmetics (`spoiler`, `flag`, `horn`, `umbrella`), complete with articulated front caster forks and in-basket grocery props.
2. **Animated 3D Store Owner NPC (`buildStoreOwner`, `StoreOwnerCharacter`)**
   - Multi-part articulated 3D character with shirt, tie, apron, nametag, balding hair rim, mustache, limbs, and expressive face (animated eyebrows, mouth, and anger blush) supporting 13 `AnimationMixer` states (`idle`, `walk`, `angry_walk`, `run`, `turn`, `point`, `angry_gesture`, `shake_fist`, `hands_on_head`, `shocked`, `facepalm`, `arms_crossed`, `celebrate`) and 6 facial expressions.
3. **Parked & Cruising Customer Cars (`buildParkedCar`)**
   - Multi-part beveled `ExtrudeGeometry` `THREE.Group` across 3 silhouettes (`sedan`, `suv`, `hatchback`) with contoured tinted glass greenhouse, side mirrors, grille, bumpers, emissive headlights/taillights, SUV roof rails, 4 tires with metallic rims, and radial ground contact shadow.
4. **Pedestrian Shoppers (`buildPedestrian`)**
   - Multi-part `THREE.Group` with hip-pivoted capsule legs, sneakers, jacket torso, shoulder-pivoted arms, carried grocery tote bag, head, cap, and ground contact shadow.
5. **Expanded 68m × 44m Supermarket Plaza, Landmarks & Props (`buildSupermarketBackdrop`, `buildCartCorral`, `buildBollard`, `buildWheelStop`, `buildBench`, `buildTrashBin`, `buildParkingSign`, `buildParkingBarrier`, `buildIsland`, `buildLoadingDock`)**
   - 52m storefront facade, pilasters, sliding doors, signboard, Parking Attendant Booth, West Loading Dock with roll-up doors and crates, landscaped curbed divider islands, arched barrel-vault Cart Corrals, benches, trash bins, signage, safety barriers, beveled concrete wheel stops, zebra crosswalks, 3-aisle lane markings, and streetlamps.
6. **Cart Showroom Turntable & VFX (`CartGarageModal.tsx`, `CartChaosEngine.ts`)**
   - Interactive 3D showroom turntable plinth, bay decal (`PARK` / `REV IN`), 4 LED corner beacons, floating target chevron, pooled spilled grocery bags, and a 48-instance `InstancedMesh` pool for impact bursts and cosmetic trails.

---

## 2. Procedural 2D Canvas Textures (`src/game/models.ts`)

1. **`createAsphaltTextures`** — Generates matching 512×512 seamless albedo and bump-map `CanvasTexture` surfaces using randomized mineral aggregate speckles and pavement seam lines.
2. **`createParkingBayTexture`** — Generates a 512×512 transparent `CanvasTexture` with dashed yellow/green boundary markings, alignment corner brackets, and centered `"PARK"` label.
3. **`createStorefrontSignTexture`** — Generates a 1024×256 supermarket signboard texture (`"MEGA MART — FRESH PRODUCE · LOOSE CASTERS · ZERO BRAKES"`).
4. **`createRadialShadowTexture`** — Generates a 128×128 radial alpha gradient `CanvasTexture` used for grounded contact shadows under carts, cars, pedestrians, and the Store Owner.

---

## 3. Procedural Web Audio Sound Effects (`src/game/audio.ts`)

All sound effects are synthesized in real time via the browser's native Web Audio API (`AudioContext`, `OscillatorNode`, `BiquadFilterNode`, `GainNode`, and procedurally filled white-noise `AudioBuffer`):
- Speed-reactive rolling wheel rattle (filtered white noise + triangle LFO).
- Turning/wobble caster squeak (frequency-modulated sine wave).
- Reverse warning beeper (980 Hz square-wave pulse).
- Emergency brake skid (frequency-swept bandpass noise).
- Velocity-scaled metallic wire-basket crash clang (inharmonic triangle/sine partials).
- Store Owner vocalizations scaled by anger stage (1–5), Owner footsteps, and Stage 5 Meltdown siren.
- Coin chime, cart unlock fanfare, grocery bag spill rustle, pedestrian surprise chirp, chaos event alert, barcode-scanner victory fanfare, and descending fail sting.

---

## 4. Original Vector UI & Animations

- **Inline SVGs**: Custom `CART CHAOS` title lockup emblem (`src/components/TitleOverlay.tsx`), star rating sockets, camera/audio/restart/pause icons, and live top-down steering & caster-angle indicator (`src/components/GameHud.tsx`, `src/components/Modals.tsx`).
- **Procedural Kinematics & Animations**: Real-time caster swivel math (`src/game/cartPhysicsMath.ts`), 13-state Store Owner `AnimationMixer` rig (`src/game/ownerModel.ts`), velocity-synced pedestrian walk/push cycles (`src/game/pedestrianModel.ts`), acceleration/braking basket tilt, hitstop/trauma camera shake, and fixed-timestep pose interpolation (`src/game/CartChaosEngine.ts`).
