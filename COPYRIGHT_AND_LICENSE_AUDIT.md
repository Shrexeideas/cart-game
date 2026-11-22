# COPYRIGHT AND LICENSE AUDIT — Parallel Parking: Cart Chaos

**Audit Date**: 2026-11-21  
**Scope**: Full workspace file tree, `src/` imports, `index.html`, `src/index.css`, `package.json`, and `node_modules/*/package.json` metadata.

---

## 1. Audit Methodology & Scan Findings

1. **Binary & Media File Scan (`find src index.html -type f`)**:
   - **Result**: **0 external media files found.** No `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.glb`, `.gltf`, `.obj`, `.fbx`, `.mp3`, `.wav`, `.ogg`, `.woff`, `.woff2`, or `.ttf` files exist anywhere in `src/`, `public/`, or the project root.
2. **External URL & Network Fetch Scan (`grep -rnE "http://|https://" src/ index.html`)**:
   - **Result**: **0 external asset fetches or CDN URLs found.** The only URL strings in `src/` are origin-validation fixtures in `src/game/stabilization.test.ts` and the `'http://localhost:3000'` SSR fallback origin in `src/game/embedBridge.ts`. No CDN scripts, Google Fonts `<link>` tags, external `@font-face` rules, or remote texture/model fetches exist in the codebase.
3. **Codebase Import Scan (`src/`)**:
   - **Runtime Libraries Used**:
     - `three` (`0.187.0` — **MIT**) including `three/addons/environments/RoomEnvironment.js` (**MIT**)
     - `@dimforge/rapier3d-compat` (`0.21.0` — **Apache-2.0**, embeds compiled Rust/WASM physics runtime)
     - `react` & `react-dom` (`19.3.1` — **MIT**)
   - **Unused Starter Dependencies**: `@google/genai`, `express`, `dotenv`, `lucide-react`, and `motion` remain listed in `package.json` from the initial environment template, but `grep` confirmed **zero imports** in `src/`.
4. **Original Asset Verification**:
   - All 3D models (`buildShoppingCart`, `buildParkedCar`, `buildPedestrian`, `buildSupermarketBackdrop`, `buildCartCorral`, `buildBollard`), 2D canvas textures (`createAsphaltTextures`, `createParkingBayTexture`, `createStorefrontSignTexture`, `createRadialShadowTexture`), Web Audio SFX (`SoundEngine`), and inline SVG UI elements were authored directly in project source files.

---

## 2. License Compatibility & Commercial Use Assessment

| Category | Status | Notes |
| :--- | :--- | :--- |
| **Original Models, Textures, Audio & SVGs** | **Clear (Original Code)** | Authored procedurally in TypeScript; no third-party media extracted or copied. |
| **Runtime Dependencies (`three`, `react`, `react-dom`)** | **Permissive (MIT)** | Commercial use permitted. Must retain copyright and MIT license notices in distributed builds/documentation. |
| **Physics Engine (`@dimforge/rapier3d-compat`)** | **Permissive (Apache-2.0)** | Commercial use permitted. Must include Apache-2.0 license text, copyright notices, and attribution notice when redistributing. |
| **Copyleft / Restrictive Licenses (GPL/AGPL)** | **None Found in Direct Dependencies** | Direct `dependencies` and `devDependencies` inspected via `node_modules/*/package.json` use MIT, Apache-2.0, ISC, or BSD-2-Clause. |

---

## 3. Flagged Items & Recommendations Before Commercial Release

While no infringing third-party media assets were found, complete honesty requires noting the following verification items before commercial publication:

1. **Include Open-Source License Notices in Production Distribution**:
   - Generate and ship a `THIRD_PARTY_NOTICES.txt` (or about/credits notice) containing the MIT and Apache-2.0 license texts for `three`, `@dimforge/rapier3d-compat` (which embeds a WASM binary), `react`, and `react-dom` when deploying commercially.
2. **Transitive Sub-Dependency Audit**:
   - This audit verified all direct `dependencies` and `devDependencies` in `package.json`. Before commercial distribution, run a full transitive dependency license checker (e.g., `npx license-checker`) on `bun.lock` / `node_modules` to confirm no nested build tool carries unexpected terms.
3. **Trademark Clearance on Fictional Branding**:
   - The procedural storefront sign uses the fictional name `"MEGA MART"`, and the game title is `"Parallel Parking: Cart Chaos"`. Neither copies a specific copyrighted logo or trade dress, though standard trademark screening is advised if publishing commercially under those names.
4. **Optional Cleanup**:
   - Unused starter packages (`@google/genai`, `express`, `dotenv`, `lucide-react`, `motion`) are not bundled into Vite's client output (tree-shaken/unimported), and can be removed from `package.json` if a minimal manifest is desired.

---

## 4. Audit Conclusion

Based on verifiable file-tree, URL, import, and `node_modules` package-metadata inspection, **all game assets (3D geometry, textures, audio, animations, and UI SVGs) are original procedural works**, and all bundled runtime dependencies use permissive open-source licenses (**MIT** and **Apache-2.0**) compatible with commercial use provided standard license notices are retained.
