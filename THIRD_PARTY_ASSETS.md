# THIRD-PARTY ASSETS & LIBRARIES — Parallel Parking: Cart Chaos

This project contains **zero external art, image, 3D model, audio, or font files**. All third-party content in the project consists exclusively of open-source software libraries installed via `package.json`.

---

## 1. Runtime Libraries Bundled into the Game

| Package / Component | Version | Asset Type | Source / Maintainer | License | Commercial Use | Attribution / Compliance Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`three`** | `0.187.0` | 3D WebGL Rendering Library | Mr.doob & Three.js Contributors (`https://threejs.org/`) | **MIT** | Permitted | Include Three.js copyright notice and MIT permission notice in source/binary distributions. |
| **`three/addons/environments/RoomEnvironment.js`** | `0.187.0` (bundled in `three`) | Procedural Studio IBL Scene Module | Three.js Contributors (`https://github.com/mrdoob/three.js`) | **MIT** | Permitted | Covered by Three.js MIT License notice. |
| **`@dimforge/rapier3d-compat`** | `0.21.0` | 3D Rigid-Body Physics Engine + Embedded WASM Binary | Dimforge / Sébastien Crozet (`https://rapier.rs`) | **Apache-2.0** | Permitted | Must retain copyright notice, Apache-2.0 license text, and any applicable `NOTICE` file when distributing. |
| **`react`** & **`react-dom`** | `19.3.1` | UI Component Runtime | Meta Platforms, Inc. & React Contributors (`https://react.dev/`) | **MIT** | Permitted | Include React MIT copyright & permission notice in distributions. |
| **`tailwindcss`** / **`@tailwindcss/vite`** | `4.3.5` | Build-Time CSS Utility Framework | Tailwind Labs (`https://tailwindcss.com`) | **MIT** | Permitted | Standard MIT notice (CSS output generated at build time). |

---

## 2. Operating System Fonts (Not Bundled)

- **System Sans-Serif Stack**: `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
  - **Source**: Resolved locally by the player's operating system and web browser.
  - **Redistribution**: No `.ttf`, `.otf`, `.woff`, or `.woff2` font files are stored in the repository or fetched over the network.

---

## 3. Unimported Starter-Template Packages in `package.json`

A static import scan of `src/` confirmed that the following packages present in `package.json` from the initial workspace template are **not imported or executed** by the game client:
- `@google/genai` (`2.32.0`, Apache-2.0) — unused.
- `express` (`4.22.3`, MIT) — unused.
- `dotenv` (`17.4.2`, BSD-2-Clause) — unused.
- `lucide-react` (`0.546.0`, ISC) — unused (custom inline SVGs are used instead).
- `motion` (`12.43.0`, MIT) — unused.

*(Build/dev-only tooling: `vite` [MIT], `@vitejs/plugin-react` [MIT], `typescript` [Apache-2.0], `tsx` [MIT], `esbuild` [MIT], `autoprefixer` [MIT], `@types/*` [MIT] — not shipped in the production browser bundle.)*
