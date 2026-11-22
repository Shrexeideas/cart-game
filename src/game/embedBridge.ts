import type { CartId, GameMode, GamePhase } from './types';

export const EMBED_NAMESPACE = 'NOVA_CART_CHAOS' as const;
export const EMBED_PROTOCOL_VERSION = 1 as const;

export type OutboundEmbedEventType =
  | 'GAME_READY'
  | 'GAME_STARTED'
  | 'GAME_PAUSED'
  | 'GAME_RESUMED'
  | 'LEVEL_COMPLETED'
  | 'SCORE_UPDATED'
  | 'GAME_EXITED'
  | 'GAME_ERROR';

export type InboundEmbedCommandType =
  | 'NOVA_PAUSE'
  | 'NOVA_RESUME'
  | 'NOVA_RESTART'
  | 'NOVA_MUTE'
  | 'NOVA_REQUEST_EXIT'
  | 'NOVA_START_LEVEL';

export interface OutboundEmbedMessage<T = Record<string, unknown>> {
  namespace: typeof EMBED_NAMESPACE;
  version: typeof EMBED_PROTOCOL_VERSION;
  type: OutboundEmbedEventType;
  timestamp: number;
  payload: T;
}

export interface InboundEmbedCommand {
  namespace: typeof EMBED_NAMESPACE;
  version: typeof EMBED_PROTOCOL_VERSION;
  type: InboundEmbedCommandType;
  payload?: {
    levelId?: number;
    muted?: boolean;
  };
}

export interface EmbedEnvironmentConfig {
  isEmbed: boolean;
  autostart: boolean;
  initialLevelId: number;
  targetOrigin: string | null;
  allowedOrigins: string[];
}

export function normalizeHttpOrigin(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '*' || trimmed === 'null') return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

export function resolveEmbedConfig(options: {
  search: string;
  currentOrigin: string;
  referrer?: string;
  envAllowedOrigins?: string;
  isFramed?: boolean;
}): EmbedEnvironmentConfig {
  const params = new URLSearchParams(options.search);
  const isEmbed = params.get('embed') === '1' || Boolean(options.isFramed);
  const autostart = params.get('autostart') === '1';
  const rawLevel = Number(params.get('level'));
  const initialLevelId =
    Number.isFinite(rawLevel) && rawLevel >= 1 && rawLevel <= 8 ? Math.floor(rawLevel) : 1;

  const configuredList = (options.envAllowedOrigins ?? '')
    .split(',')
    .map((entry) => normalizeHttpOrigin(entry))
    .filter((entry): entry is string => entry !== null);

  const curOrigin = normalizeHttpOrigin(options.currentOrigin);
  const refOrigin = normalizeHttpOrigin(options.referrer);
  const paramOrigin = normalizeHttpOrigin(params.get('hostOrigin'));

  const allowSet = new Set<string>();
  if (curOrigin) allowSet.add(curOrigin);

  if (configuredList.length > 0) {
    for (const o of configuredList) allowSet.add(o);
  } else {
    if (paramOrigin) allowSet.add(paramOrigin);
    if (refOrigin) allowSet.add(refOrigin);
  }

  let targetOrigin: string | null = null;
  if (paramOrigin && allowSet.has(paramOrigin)) {
    targetOrigin = paramOrigin;
  } else if (refOrigin && allowSet.has(refOrigin)) {
    targetOrigin = refOrigin;
  } else if (curOrigin && allowSet.has(curOrigin)) {
    targetOrigin = curOrigin;
  }

  return {
    isEmbed,
    autostart,
    initialLevelId,
    targetOrigin,
    allowedOrigins: Array.from(allowSet),
  };
}

const VALID_INBOUND_TYPES = new Set<InboundEmbedCommandType>([
  'NOVA_PAUSE',
  'NOVA_RESUME',
  'NOVA_RESTART',
  'NOVA_MUTE',
  'NOVA_REQUEST_EXIT',
  'NOVA_START_LEVEL',
]);

export function parseInboundEmbedCommand(
  data: unknown,
  origin: string,
  allowedOrigins: readonly string[]
): InboundEmbedCommand | null {
  const normalizedOrigin = normalizeHttpOrigin(origin);
  if (!normalizedOrigin || !allowedOrigins.includes(normalizedOrigin)) {
    return null;
  }
  if (!data || typeof data !== 'object') return null;

  const rec = data as Record<string, unknown>;
  if (rec.namespace !== EMBED_NAMESPACE || rec.version !== EMBED_PROTOCOL_VERSION) {
    return null;
  }
  if (typeof rec.type !== 'string' || !VALID_INBOUND_TYPES.has(rec.type as InboundEmbedCommandType)) {
    return null;
  }

  const cmd: InboundEmbedCommand = {
    namespace: EMBED_NAMESPACE,
    version: EMBED_PROTOCOL_VERSION,
    type: rec.type as InboundEmbedCommandType,
  };

  if (rec.payload && typeof rec.payload === 'object') {
    const rawPayload = rec.payload as Record<string, unknown>;
    const cleanPayload: NonNullable<InboundEmbedCommand['payload']> = {};
    if (
      typeof rawPayload.levelId === 'number' &&
      Number.isInteger(rawPayload.levelId) &&
      rawPayload.levelId >= 1 &&
      rawPayload.levelId <= 8
    ) {
      cleanPayload.levelId = rawPayload.levelId;
    }
    if (typeof rawPayload.muted === 'boolean') {
      cleanPayload.muted = rawPayload.muted;
    }
    cmd.payload = cleanPayload;
  }

  return cmd;
}

export interface EmbedBridge {
  config: EmbedEnvironmentConfig;
  emitReady: (details: { levels: number; carts: number }) => void;
  emitStarted: (details: { levelId: number; levelName: string; mode: GameMode; cartId: CartId }) => void;
  emitPaused: (details: { levelId: number; reason: 'user' | 'visibility' | 'host' }) => void;
  emitResumed: (details: { levelId: number; reason: 'user' | 'host' }) => void;
  emitLevelCompleted: (details: {
    levelId: number;
    levelName: string;
    mode: GameMode;
    cartId: CartId;
    passed: boolean;
    stars: number;
    score: number;
    accuracyPct: number;
    timeTaken: number;
    collisions: number;
    coinsEarned: number;
  }) => void;
  emitScoreUpdated: (details: {
    bestScore: number;
    totalStars: number;
    coins: number;
    latestScore: number;
    latestLevelId: number;
  }) => void;
  emitExited: (details: {
    levelId: number;
    phase: GamePhase;
    bestScore: number;
    totalStars: number;
    coins: number;
  }) => void;
  emitError: (details: { code: string; message: string }) => void;
  subscribe: (handler: (command: InboundEmbedCommand) => void) => () => void;
}

export function createEmbedBridge(): EmbedBridge {
  const isFramed =
    typeof window !== 'undefined' && typeof window.parent !== 'undefined' && window.parent !== window;

  const config =
    typeof window === 'undefined'
      ? resolveEmbedConfig({ search: '', currentOrigin: 'http://localhost:3000' })
      : resolveEmbedConfig({
          search: window.location.search,
          currentOrigin: window.location.origin,
          referrer: document.referrer,
          envAllowedOrigins: import.meta.env?.VITE_NOVA_ALLOWED_ORIGINS as string | undefined,
          isFramed,
        });

  const post = <T extends Record<string, unknown>>(type: OutboundEmbedEventType, payload: T): void => {
    if (typeof window === 'undefined' || !config.targetOrigin) return;
    if (!window.parent || window.parent === window) return;

    const message: OutboundEmbedMessage<T> = {
      namespace: EMBED_NAMESPACE,
      version: EMBED_PROTOCOL_VERSION,
      type,
      timestamp: Date.now(),
      payload,
    };
    window.parent.postMessage(message, config.targetOrigin);
  };

  return {
    config,
    emitReady: (details) => post('GAME_READY', { embed: config.isEmbed, ...details }),
    emitStarted: (details) => post('GAME_STARTED', details),
    emitPaused: (details) => post('GAME_PAUSED', details),
    emitResumed: (details) => post('GAME_RESUMED', details),
    emitLevelCompleted: (details) => post('LEVEL_COMPLETED', details),
    emitScoreUpdated: (details) => post('SCORE_UPDATED', details),
    emitExited: (details) => post('GAME_EXITED', details),
    emitError: (details) => post('GAME_ERROR', details),
    subscribe: (handler) => {
      if (typeof window === 'undefined') return () => {};
      const onMessage = (event: MessageEvent) => {
        if (event.source !== window.parent) return;
        const cmd = parseInboundEmbedCommand(event.data, event.origin, config.allowedOrigins);
        if (cmd) {
          handler(cmd);
        }
      };
      window.addEventListener('message', onMessage);
      return () => window.removeEventListener('message', onMessage);
    },
  };
}
