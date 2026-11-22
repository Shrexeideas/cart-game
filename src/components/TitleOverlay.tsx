import React from 'react';
import { getCartDefinition } from '../game/carts';
import type { CartId, GameMode } from '../game/types';

interface TitleOverlayProps {
  bestScore: number;
  totalStars: number;
  coins: number;
  selectedCartId: CartId;
  unlockedCount: number;
  gameMode: GameMode;
  onChangeGameMode: (mode: GameMode) => void;
  onPlay: () => void;
  onOpenGarage: () => void;
  onOpenLevels: () => void;
  onOpenHowToPlay: () => void;
  isEmbed?: boolean;
  onExit?: () => void;
}

const MODE_OPTIONS: Array<{ id: GameMode; label: string; tag: string }> = [
  { id: 'career', label: 'Career', tag: 'Classic' },
  { id: 'nightmare', label: 'Nightmare', tag: '1.5× Coins' },
  { id: 'chaos', label: 'Chaos', tag: '1.35× Coins' },
  { id: 'timetrial', label: 'Time Trial', tag: '1.25× Coins' },
];

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  bestScore,
  totalStars,
  coins,
  selectedCartId,
  unlockedCount,
  gameMode,
  onChangeGameMode,
  onPlay,
  onOpenGarage,
  onOpenLevels,
  onOpenHowToPlay,
  isEmbed = false,
  onExit,
}) => {
  const activeCart = getCartDefinition(selectedCartId);

  return (
    <div className="absolute inset-0 w-full h-full z-20 pointer-events-none flex flex-col justify-between p-3 sm:p-5 overflow-hidden">
      {/* Asymmetric Left Title Lockup over calm negative space */}
      <div className="max-w-md pointer-events-auto mt-0.5 sm:mt-2 max-h-[calc(100%-3rem)] overflow-y-auto rounded-2xl">
        <div
          className="inline-block w-full rounded-2xl p-3.5 sm:p-5 border-2 border-slate-900/90 shadow-[6px_6px_0px_#0f172a]"
          style={{ backgroundColor: 'rgba(248, 250, 252, 0.94)' }}
        >
          {/* Bespoke inline SVG Title Lockup */}
          <svg
            viewBox="0 0 380 120"
            className="w-full max-w-[310px] sm:max-w-[340px] h-auto block mb-2.5"
            aria-label="Parallel Parking: Cart Chaos"
          >
            <rect x="4" y="4" width="210" height="28" rx="6" fill="#dc2626" />
            <text
              x="16"
              y="23"
              fill="#fef08a"
              fontSize="14"
              fontWeight="900"
              letterSpacing="2.2"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              PARALLEL PARKING
            </text>

            <text
              x="4"
              y="70"
              fill="#0f172a"
              fontSize="46"
              fontWeight="900"
              letterSpacing="-1.5"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              CART
            </text>
            <text
              x="4"
              y="112"
              fill="#dc2626"
              stroke="#0f172a"
              strokeWidth="2.5"
              paintOrder="stroke fill"
              fontSize="46"
              fontWeight="900"
              letterSpacing="-1.2"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              CHAOS
            </text>

            <g transform="translate(272, 18)">
              <circle cx="48" cy="48" r="42" fill="#facc15" stroke="#0f172a" strokeWidth="4" />
              <path
                d="M22 30 H68 L62 58 H30 Z"
                fill="none"
                stroke="#0f172a"
                strokeWidth="4.5"
                strokeLinejoin="round"
              />
              <path
                d="M16 24 H23 L29 58"
                fill="none"
                stroke="#0f172a"
                strokeWidth="4.5"
                strokeLinecap="round"
              />
              <circle cx="34" cy="70" r="6" fill="#dc2626" stroke="#0f172a" strokeWidth="2.5" />
              <circle cx="58" cy="70" r="6" fill="#0f172a" />
            </g>
          </svg>

          {/* Compact Career Stats + Coins + Equipped Cart */}
          <div className="grid grid-cols-3 gap-2 mb-3 py-2 px-3 rounded-xl bg-slate-900 text-slate-50">
            <div>
              <div className="text-[9px] font-bold tracking-widest text-amber-300 uppercase">
                Score
              </div>
              <div className="text-base sm:text-lg font-black tabular-nums leading-tight">
                {bestScore.toLocaleString()}
              </div>
            </div>
            <div className="border-x border-slate-700 px-2">
              <div className="text-[9px] font-bold tracking-widest text-amber-300 uppercase">
                Stars
              </div>
              <div className="text-base sm:text-lg font-black tabular-nums leading-tight">
                {totalStars}/18 ★
              </div>
            </div>
            <div className="pl-1">
              <div className="text-[9px] font-bold tracking-widest text-amber-300 uppercase">
                Coins
              </div>
              <div
                className="text-base sm:text-lg font-black tabular-nums leading-tight text-amber-300"
                data-testid="title-coins"
              >
                {coins.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Game Mode Selector */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-black tracking-widest uppercase text-slate-500">
                Game Mode
              </span>
              <span className="text-[10px] font-black text-slate-700">
                Cart: {activeCart.name} ({unlockedCount}/10)
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {MODE_OPTIONS.map((m) => {
                const active = gameMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    data-testid={`mode-${m.id}`}
                    onClick={() => onChangeGameMode(m.id)}
                    className={`py-1.5 px-2 rounded-lg border-2 border-slate-900 text-left transition-colors cursor-pointer ${
                      active
                        ? 'bg-slate-900 text-amber-300'
                        : 'bg-white hover:bg-amber-50 text-slate-900'
                    }`}
                  >
                    <div className="text-[11px] font-black leading-tight">{m.label}</div>
                    <div
                      className={`text-[9px] font-bold leading-tight ${
                        active ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      {m.tag}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              data-start="true"
              onClick={(e) => {
                e.currentTarget.blur();
                onPlay();
              }}
              className="w-full py-3 px-6 rounded-xl bg-red-600 hover:bg-red-500 active:translate-y-0.5 text-white font-black text-base sm:text-lg tracking-wide border-2 border-slate-900 shadow-[4px_4px_0px_#0f172a] transition-colors cursor-pointer"
            >
              PLAY NOW
            </button>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                data-testid="open-garage-btn"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onOpenGarage();
                }}
                className="py-2 px-2 rounded-xl bg-amber-300 hover:bg-amber-200 text-slate-950 font-black text-xs sm:text-sm border-2 border-slate-900 shadow-[3px_3px_0px_#0f172a] transition-colors cursor-pointer"
              >
                CART GARAGE
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onOpenLevels();
                }}
                className="py-2 px-2 rounded-xl bg-white hover:bg-slate-100 text-slate-950 font-extrabold text-xs sm:text-sm border-2 border-slate-900 shadow-[3px_3px_0px_#0f172a] transition-colors cursor-pointer"
              >
                LEVELS
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onOpenHowToPlay();
                }}
                className="py-2 px-2 rounded-xl bg-white hover:bg-slate-100 text-slate-950 font-extrabold text-xs sm:text-sm border-2 border-slate-900 shadow-[3px_3px_0px_#0f172a] transition-colors cursor-pointer"
              >
                HOW TO PLAY
              </button>
            </div>
            {isEmbed && onExit && (
              <button
                type="button"
                data-testid="embed-exit-btn"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onExit();
                }}
                className="w-full py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 font-black text-xs tracking-wider border-2 border-slate-900 shadow-[3px_3px_0px_#0f172a] transition-colors cursor-pointer"
              >
                EXIT TO NOVA
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Single flat borderless control-hint line in bottom safe margin */}
      <div className="text-center">
        <p
          className="inline-block text-[11px] sm:text-sm font-bold tracking-wide text-slate-900 px-3 py-1 rounded-md"
          style={{ backgroundColor: 'rgba(248, 250, 252, 0.8)' }}
        >
          W/S Push &amp; Reverse · A/D Steer · Space Brake · Q/E/Drag Orbit · Scroll Zoom · C Camera · R Restart · Esc Pause
        </p>
      </div>
    </div>
  );
};
