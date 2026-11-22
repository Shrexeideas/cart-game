# GAME EMBED API — NOVA `postMessage` Bridge

**Implementation**: `src/game/embedBridge.ts`  
**Protocol Namespace**: `'NOVA_CART_CHAOS'`  
**Protocol Version**: `1`

All cross-window communication between the NOVA host page and **Parallel Parking: Cart Chaos** uses versioned JSON messages over `window.postMessage` with explicit origin verification (never wildcard `'*'`).

---

## 1. Origin Trust & Validation Rules

1. **Allowed Origins Resolution (`resolveEmbedConfig`)**:
   - If `VITE_NOVA_ALLOWED_ORIGINS` is set at build time (comma-separated HTTP/HTTPS origins), **only** those origins (plus same-origin `window.location.origin`) are accepted for inbound commands.
   - Otherwise, during development or dynamic previews, validated `http:` / `https:` origins from `?hostOrigin=...` and `document.referrer` are added alongside same-origin.
   - Non-HTTP schemes (`javascript:`, `data:`, `file:`), `'null'`, and `'*'` are rejected by `normalizeHttpOrigin()`.
2. **Inbound Verification (`parseInboundEmbedCommand`)**:
   - Verifies `event.source === window.parent`.
   - Verifies `event.origin` matches the resolved allowlist.
   - Validates `namespace === 'NOVA_CART_CHAOS'`, `version === 1`, known `type`, and integer bounds on `payload.levelId` (`1..8`).

---

## 2. Outbound Events (Game -> NOVA Host)

Every outbound message follows:
```ts
interface OutboundEmbedMessage<T> {
  namespace: 'NOVA_CART_CHAOS';
  version: 1;
  type: OutboundEmbedEventType;
  timestamp: number; // Date.now()
  payload: T;
}
```

| Event `type` | When Emitted | `payload` Fields |
| :--- | :--- | :--- |
| `GAME_READY` | Three.js + Rapier WASM initialized and scene loaded | `{ embed: boolean, levels: number, carts: number }` |
| `GAME_STARTED` | Gameplay begins via Play, Level Select, `autostart=1`, or `NOVA_START_LEVEL` | `{ levelId: number, levelName: string, mode: GameMode, cartId: CartId }` |
| `GAME_PAUSED` | Player pauses, host sends `NOVA_PAUSE`, or tab becomes hidden | `{ levelId: number, reason: 'user' \| 'visibility' \| 'host' }` |
| `GAME_RESUMED` | Player clicks Resume / presses Esc/P, or host sends `NOVA_RESUME` | `{ levelId: number, reason: 'user' \| 'host' }` |
| `LEVEL_COMPLETED` | Round ends (spot parked, Stage 5 Meltdown defeat, or Time Trial expiry) | `{ levelId, levelName, mode, cartId, passed, stars, score, accuracyPct, timeTaken, collisions, coinsEarned }` |
| `SCORE_UPDATED` | Emitted alongside `LEVEL_COMPLETED` with updated career totals | `{ bestScore: number, totalStars: number, coins: number, latestScore: number, latestLevelId: number }` |
| `GAME_EXITED` | Player clicks `EXIT TO NOVA` or host sends `NOVA_REQUEST_EXIT` | `{ levelId: number, phase: GamePhase, bestScore: number, totalStars: number, coins: number }` |
| `GAME_ERROR` | WebGL or Rapier initialization failure | `{ code: string, message: string }` |

---

## 3. Inbound Commands (NOVA Host -> Game)

Send commands via `iframe.contentWindow.postMessage(cmd, gameOrigin)`:

| Command `type` | Optional `payload` | Game Action |
| :--- | :--- | :--- |
| `NOVA_PAUSE` | — | Pauses active play (`reason: 'host'`), silences loops, emits `GAME_PAUSED`. |
| `NOVA_RESUME` | — | Resumes paused level (`reason: 'host'`), emits `GAME_RESUMED`. |
| `NOVA_RESTART` | — | Reloads the current level from spawn and emits `GAME_STARTED`. |
| `NOVA_MUTE` | `{ muted?: boolean }` | Sets explicit mute state if `boolean` provided, or toggles mute. |
| `NOVA_START_LEVEL` | `{ levelId?: number }` | Launches level `1..8` immediately and emits `GAME_STARTED`. |
| `NOVA_REQUEST_EXIT` | — | Pauses active play if needed and emits `GAME_EXITED` with latest scores. |

### Minimal Host Listener Example
```ts
const GAME_ORIGIN = 'https://games.nova.example.com';

window.addEventListener('message', (event) => {
  if (event.origin !== GAME_ORIGIN) return;
  const msg = event.data;
  if (!msg || msg.namespace !== 'NOVA_CART_CHAOS' || msg.version !== 1) return;

  switch (msg.type) {
    case 'GAME_READY':
      console.log('Cart Chaos ready:', msg.payload);
      break;
    case 'LEVEL_COMPLETED':
    case 'SCORE_UPDATED':
      // Persist leaderboard / mission progress in NOVA backend
      break;
    case 'GAME_EXITED':
      // Unmount iframe modal / return to NOVA arcade hub
      break;
  }
});
```
