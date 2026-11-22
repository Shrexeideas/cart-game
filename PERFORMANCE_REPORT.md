# PERFORMANCE REPORT — Parallel Parking: Cart Chaos

## 1. Optimization & Memory Hygiene Audit

The final stabilization pass targeted GPU memory leaks, per-frame heap allocations, and physics-to-render coupling:

1. **Level Reload & Unmount Disposal (`CartChaosEngine.disposeHierarchy`)**:
   - **Previous issue**: `loadLevel()` removed children from `this.levelGroup` without disposing per-level geometries, materials, or dynamic `CanvasTexture`s (`bayTex`, parking sign text plates), accumulating GPU memory across restarts and round advances.
   - **Fix**: `loadLevel()`, `rebuildBayVisuals()`, and `dispose()` traverse and dispose every transient `BufferGeometry`, `Material`, and owned texture slot (`map`, `bumpMap`, `normalMap`, `roughnessMap`, `metalnessMap`, `emissiveMap`, `alphaMap`), while preserving shared long-lived textures (`shadowTex`, `groundTexMap`, `groundTexBump`) until engine `dispose()`.
2. **Shared Ground Contact Shadow Texture in Backdrop**:
   - `buildSupermarketBackdrop(maxAniso, this.shadowTex)` reuses the single `128×128` radial shadow `CanvasTexture` instead of allocating a duplicate texture.
3. **Per-Frame GC Reduction**:
   - Pooled particle matrix updates use module-scoped `_vec3A`, `_vec3B`, `_mat4`, `_quat`, `_scaleVec` (`CartChaosEngine.ts`), and `updateOwnerFacialExpression` (`ownerModel.ts`) uses module-scoped `_targetFaceColor` instead of instantiating `new THREE.Color()` every frame.
   - `AnimationClip`s for both `StoreOwnerCharacter` and `PedestrianCharacter` are built and cached once at module load rather than rebuilt per spawned NPC.
4. **Fixed-Timestep Physics + Pose Interpolation**:
   - Physics steps at a deterministic `60 Hz` (`fixedDt = 1/60`, capped at max 4 substeps per frame) with accumulator reset on every `loadLevel()`.
   - `syncPlayerMeshFromBody()` interpolates `(x, y, z, yaw)` using `alpha = physicsAccum / (1/60)` so rendering stays smooth on 60Hz, 120Hz, and 144Hz displays without micro-stutter.
5. **Software WebGL Graceful Fallback**:
   - `detectSoftwareGl()` identifies headless/software renderers (`SwiftShader`, `llvmpipe`, `softpipe`), disabling shadow maps, antialiasing, and HiDPI scaling (`pixelRatio = 1`), and pacing frames via WebGL2 `fenceSync` (`afterDraw`) so headless test environments remain responsive.

---

## 2. Verified Bundle Footprint (`vite build`)

- `dist/index.html`: `0.96 kB` (`0.48 kB` gzip)
- `dist/assets/index-*.css`: `29.07 kB` (`6.11 kB` gzip)
- `dist/assets/index-*.js`: `5,586.97 kB` (`2,010.09 kB` gzip — includes `@dimforge/rapier3d-compat` inline WASM binary + Three.js + React 19 UI)

*Honest note on bundle size*: The single JS chunk triggers Vite's >500 kB chunk warning solely because `@dimforge/rapier3d-compat` bundles its compiled WASM engine inline as base64 (~3.9 MB uncompressed before gzip) alongside Three.js (`~650 kB`). Dynamic `import()` code-splitting of the 3D engine after title render can reduce initial Title screen download if desired in a future optimization pass, though keeping it in one chunk simplifies self-contained NOVA static hosting without async chunk failures.
