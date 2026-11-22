# NOVA INTEGRATION GUIDE — Parallel Parking: Cart Chaos

This guide covers embedding **Parallel Parking: Cart Chaos** inside the NOVA web platform using an `<iframe>` or subpath static route while maintaining clean lifecycle, audio, sizing, and keyboard behavior.

---

## 1. Deployment Modes & URL Parameters

The compiled bundle supports both standalone execution and NOVA embedded hosting via Vite's relative `base: process.env.VITE_BASE_PATH || './'` configuration (`vite.config.ts`):

| Query Parameter | Values | Effect |
| :--- | :--- | :--- |
| `embed` | `1` | Enables NOVA embed affordances (`EXIT TO NOVA` buttons in Title, Pause, Results, and fatal error screens; sets `document.body.dataset.embed="1"`). Also auto-detected when `window.parent !== window`. |
| `autostart` | `1` | Skips the Title screen once Three.js + Rapier WASM finish initializing and immediately launches gameplay, emitting `GAME_READY` and `GAME_STARTED`. |
| `level` | `1` – `8` | Initial level launched when `autostart=1` (`1–6` career aisles, `7` Endless Shuffle, `8` Daily Challenge). |
| `hostOrigin` | URL-encoded HTTP/HTTPS origin | Optional parent host origin hint used for `postMessage` when `VITE_NOVA_ALLOWED_ORIGINS` is not statically baked at build time. |

**Recommended NOVA iframe URL**:
```text
https://<game-host>/cart-chaos/?embed=1&hostOrigin=https%3A%2F%2Fnova.example.com
```

---

## 2. Recommended `<iframe>` Container & Attributes

```html
<div class="nova-game-frame" style="position: relative; width: 100%; aspect-ratio: 16 / 9; min-height: 480px;">
  <iframe
    id="cart-chaos-iframe"
    src="https://games.nova.example.com/cart-chaos/?embed=1&hostOrigin=https%3A%2F%2Fnova.example.com"
    title="Parallel Parking: Cart Chaos"
    style="width: 100%; height: 100%; border: 0; display: block;"
    allow="autoplay; fullscreen"
    loading="eager"
  ></iframe>
</div>
```

### Key Integration Notes
- **Responsive Viewport Sizing**: The game renders inside a fluid `w-full h-dvh` root (`src/App.tsx`) driven by `ResizeObserver` + `window.visualViewport` resize listeners in `CartChaosEngine`. No fixed pixel dimensions or forced fullscreen calls are used.
- **Audio Autoplay**: Browsers require a user gesture before `AudioContext` unlocks. When embedded with `autostart=1`, audio unlocks cleanly on the player's first keypress, pointer click, or touch tap inside the iframe.
- **Tab / Visibility Auto-Pause**: Switching browser tabs or hiding the host modal triggers `visibilitychange` in `src/App.tsx`, clearing held inputs, silencing rolling audio loops, transitioning to `'paused'`, and emitting `GAME_PAUSED` (`reason: 'visibility'`).
- **Keyboard Shortcut Safety**: `App.tsx` ignores keyboard shortcuts when `ctrlKey`, `metaKey`, or `altKey` are held, or when focus is on `<input>`, `<textarea>`, or `<select>`, so browser and NOVA global hotkeys (`Ctrl/Cmd+R`, `Ctrl/Cmd+W`, etc.) are never blocked.

---

## 3. Recommended Security & CSP Headers for Hosting

When deploying behind NOVA's reverse proxy / CDN:
- Restrict framing with `Content-Security-Policy: frame-ancestors 'self' https://nova.example.com;`
- Avoid `sandbox` flags that strip `allow-scripts` or `allow-same-origin` (local `localStorage` progression persistence and WebGL/WASM initialization require scripts and origin storage; if `allow-same-origin` is intentionally omitted in a hardened sandbox, verify WebGL/WASM and storage fallback behavior).
- Configure `VITE_NOVA_ALLOWED_ORIGINS="https://nova.example.com"` at build time (`.env.example`) so outbound `postMessage` targets and inbound command checks strictly lock onto trusted NOVA origins.

---

## 4. Clean Teardown in Single-Page Host Apps

Before unmounting the `<iframe>` in NOVA's React/Vue router:
1. Optionally send `{ namespace: 'NOVA_CART_CHAOS', version: 1, type: 'NOVA_PAUSE' }` to silence audio immediately.
2. Listen for `GAME_EXITED` when the user clicks `EXIT TO NOVA`, then remove the `<iframe>` from the DOM (which fires React cleanup -> `CartChaosEngine.dispose()`, releasing the WebGL context, Rapier `World`/`EventQueue`, textures, geometries, and `AudioContext`).
