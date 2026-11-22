# BUILD AND DEPLOY GUIDE — Parallel Parking: Cart Chaos

## 1. Environment Variables (`.env.example`)

All build-time client configuration uses Vite's `VITE_` prefix (never place secrets or API keys in client env vars):

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `VITE_BASE_PATH` | `./` | Public base URL for static assets (`./` works for both root domains and subpath mounts like `/arcade/cart-chaos/`). |
| `VITE_NOVA_ALLOWED_ORIGINS` | `""` | Comma-separated allowlist of trusted parent HTTP/HTTPS origins for `postMessage` when embedded in NOVA (e.g., `https://nova.example.com`). |

---

## 2. Commands

```bash
# Install dependencies
npm install

# Run unit test suite (pure physics, scoring, collection, owner logic, nav, animations, drift hook, embed bridge)
npx tsx --test src/game/cartPhysicsMath.test.ts src/game/scoring.test.ts src/game/expansion.test.ts src/game/overhaul.test.ts src/game/stabilization.test.ts

# Type-check with TypeScript compiler
npm run lint

# Build production static bundle into dist/
npm run build

# Preview production bundle locally
npm run preview
```

---

## 3. Verified Production Build Output (`npm run build`)

Built with **Vite `8.3.8`** (`43 modules transformed` in `1.05s`):

| Output File | Uncompressed Size | Gzip Size | Notes |
| :--- | :--- | :--- | :--- |
| `dist/index.html` | `0.96 kB` | `0.48 kB` | Relative `./assets/...` references ready for root or subpath hosting |
| `dist/assets/index-*.css` | `29.07 kB` | `6.11 kB` | Compiled Tailwind CSS v4 styles |
| `dist/assets/index-*.js` | `5,586.97 kB` | `2,010.09 kB` | Application TypeScript + React 19 + Three.js (`0.187.0`) + `@dimforge/rapier3d-compat` (`0.21.0`, includes inline compiled physics WASM) |

**Zero external network dependencies at runtime**: All 3D geometry, procedural canvas textures, Web Audio SFX, and inline SVG graphics run self-contained from the static `dist/` directory.

---

## 4. Static Hosting Checklist (CDN / Nginx / Cloudflare Pages / S3 / NOVA Subpath)

1. Serve `dist/` as static files with standard MIME types (`text/html`, `application/javascript`, `text/css`). Because `@dimforge/rapier3d-compat` embeds its WASM payload inside the JS bundle, no special `.wasm` server rewrite is required.
2. Enable gzip or Brotli compression (`~2.0 MB` gzip transfer for the full JS+WASM+Three.js bundle).
3. Configure immutable long-lived `Cache-Control: public, max-age=31536000, immutable` on `dist/assets/*` and `no-cache` on `dist/index.html`.
4. Set `Content-Security-Policy` `frame-ancestors` to permit your NOVA domain(s) if deploying in an iframe.
