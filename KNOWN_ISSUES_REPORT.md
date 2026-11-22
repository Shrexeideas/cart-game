# KNOWN ISSUES & HANDOVER REPORT — Parallel Parking: Cart Chaos

This report documents the final stabilization status, verified behaviors, and honest remaining technical constraints at handover.

---

## 1. Stabilization Fixes Verified

- **Cart Physics & Rest Stability**: Eliminated idle vibration/shivering on level asphalt (`stepCartDynamics` static settle damping & speed-gated wobble/bad-wheel pull) while preserving slope roll (`slopeX`/`slopeZ`), caster swivel lag, reverse jackknife instability, and collision response. Spawn height (`0.44m`) matches cuboid collider half-height (`0.44m`) to avoid drop bounce.
- **Fixed-Timestep & Wheel Accuracy**: Player visual mesh interpolates between `prevCartPose` and `curCartPose` using `physicsAccum / (1/60)`, and all cart wheel rotations (player cart, loose carts, pedestrian-pushed carts) derive angular velocity from each rig's true `wheelRadius`.
- **Compound Collider Alignment**: `pedestrian_cart` moving actors now attach both a pedestrian capsule collider and a `+0.92m` front shopping cart cuboid collider to a shared kinematic `RigidBody` whose rotation syncs smoothly with travel heading.
- **Owner & Pedestrian Animation Polish**: Added `angry_walk`, `turn`, and `shocked` clips to `StoreOwnerCharacter` (`13` total states with single `AnimationMixer.update(dt)` per frame), smoothed `ownerCurrentSpeed` with `expDamp`, decayed speed immediately when path-blocked so Owner never walks in place against walls, and kept `walk <-> angry_walk <-> run` phase-synced to prevent stride pops.
- **GPU Resource Hygiene**: `loadLevel()`, `rebuildBayVisuals()`, and `dispose()` dispose all per-level geometries, materials, and transient `CanvasTexture`s while preserving shared `shadowTex` and asphalt maps until full teardown.
- **Opt-In Cart Drift Prep**: `src/game/cartDrift.ts` is wired with `DEFAULT_DRIFT_CONFIG.enabled = false`, leaving active parallel-parking gameplay unchanged until explicitly enabled.
- **NOVA Embed Readiness**: Added relative `./` Vite base config, `?embed=1` exit buttons, loading & WebGL/Rapier error fallback screens, `visibilitychange` auto-pause, `ctrl/meta/alt` keyboard passthrough, and strict origin-allowlisted `postMessage` bridge (`src/game/embedBridge.ts`).

---

## 2. Known Limitations & Notes

1. **Software WebGL Pacing in Headless Browsers**:
   - In environments without hardware GPU acceleration (`SwiftShader` / `llvmpipe`), `CartChaosEngine` intentionally disables shadows, uses `pixelRatio = 1`, and inserts an `80ms` post-draw GPU fence wait (`afterDraw`) to prevent CPU starvation. Full 60fps+ rendering requires hardware WebGL2 acceleration on end-user devices.
2. **Single-Chunk Bundle Size (`~2.01 MB` gzip)**:
   - Because `@dimforge/rapier3d-compat` inlines its Rust WASM runtime inside the Vite JS bundle alongside Three.js, `dist/assets/index-*.js` is `5.59 MB` uncompressed (`2.01 MB` gzip). Hosting servers should enable gzip or Brotli compression.
3. **Garage Turntable During Active Play**:
   - `CartGarageModal` creates a lightweight temporary Three.js preview canvas while open (from the Title or Results screens) and disposes its renderer and geometries on close; on low-end mobile devices with strict WebGL context limits, opening and closing the Garage rapidly relies on browser GC to reclaim the temporary context, which works normally in modern Chromium/Safari/Firefox.
4. **Unused Starter Dependencies in `package.json`**:
   - Starter-template packages (`@google/genai`, `express`, `dotenv`, `lucide-react`, `motion`) remain listed in `package.json` but are not imported anywhere in `src/` and are excluded from the built `dist/` bundle by Vite tree-shaking.
5. **Local Browser Persistence**:
   - High scores, stars, coins, and unlocked carts persist in `localStorage` (`cart_chaos_records_v1`, `cart_chaos_progression_v1`). If NOVA embeds the game in a cross-origin iframe with strict third-party storage partitioning or incognito restrictions, progression remains session-scoped unless NOVA bridges `SCORE_UPDATED` / `LEVEL_COMPLETED` events to its backend.
