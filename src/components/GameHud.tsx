import React from 'react';
import { getCartDefinition } from '../game/carts';
import type { HudSnapshot, InputState } from '../game/types';

interface GameHudProps {
  hud: HudSnapshot;
  muted: boolean;
  touchMode: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onRestart: () => void;
  onPause: () => void;
  onTouchInput: (key: keyof InputState, pressed: boolean) => void;
}

function formatTimer(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

const ANGER_STAGE_META: Record<
  1 | 2 | 3 | 4 | 5,
  { label: string; barColor: string; badgeBg: string; badgeText: string }
> = {
  1: { label: 'ANNOYED', barColor: '#38bdf8', badgeBg: 'bg-sky-200', badgeText: 'text-slate-900' },
  2: { label: 'IRRITATED', barColor: '#facc15', badgeBg: 'bg-amber-300', badgeText: 'text-slate-950' },
  3: { label: 'ANGRY', barColor: '#f97316', badgeBg: 'bg-orange-500', badgeText: 'text-white' },
  4: { label: 'FURIOUS', barColor: '#ef4444', badgeBg: 'bg-red-600', badgeText: 'text-white' },
  5: { label: 'MELTDOWN!', barColor: '#991b1b', badgeBg: 'bg-red-900', badgeText: 'text-amber-200' },
};

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  muted,
  touchMode,
  onToggleMute,
  onToggleCamera,
  onRestart,
  onPause,
  onTouchInput,
}) => {
  const steerDeg = Math.round(hud.steeringInput * 32);
  const leftCasterDeg = Math.round((hud.leftCasterAngle * 180) / Math.PI);
  const rightCasterDeg = Math.round((hud.rightCasterAngle * 180) / Math.PI);

  const activeCart = getCartDefinition(hud.cartId);
  const stageMeta = ANGER_STAGE_META[hud.owner.stage];
  const isTimeTrial = hud.timeLimit !== null;
  const remaining = isTimeTrial ? Math.max(0, (hud.timeLimit ?? 0) - hud.elapsedTime) : hud.elapsedTime;
  const timeDanger = isTimeTrial && remaining <= 10;

  return (
    <div className="absolute inset-0 w-full h-full z-10 pointer-events-none select-none flex flex-col justify-between p-2.5 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] overflow-hidden">
      {/* Top Perimeter Block */}
      <div className="flex flex-col gap-1.5 sm:gap-2">
        <div className="flex items-start justify-between gap-2">
          {/* Top-Left Supermarket Tag Status Cluster */}
          <div
            className="rounded-xl border-2 border-slate-900 shadow-[3px_3px_0px_#0f172a] sm:shadow-[4px_4px_0px_#0f172a] px-2.5 py-2 sm:px-3.5 sm:py-2.5 text-slate-900 min-w-0 max-w-[238px] sm:max-w-[330px]"
            style={{ backgroundColor: 'rgba(248, 250, 252, 0.93)' }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-600 text-amber-200 shrink-0">
                {hud.levelId === 8 ? 'DAILY' : hud.levelId === 7 ? '∞' : `LVL ${String(hud.levelId).padStart(2, '0')}`}
              </span>
              <span className="text-[11px] sm:text-sm font-black tracking-tight text-slate-900 truncate">
                {hud.levelName}
              </span>
              {hud.gameMode !== 'career' && (
                <span className="hidden sm:inline-block text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-900 text-amber-300 shrink-0">
                  {hud.gameMode}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5 sm:gap-3.5">
              {/* Timer / Time Trial Countdown */}
              <div>
                <div className="text-[8px] sm:text-[9px] font-bold uppercase tracking-widest text-slate-500">
                  {isTimeTrial ? 'LEFT' : 'TIME'}
                </div>
                <div
                  className={`text-base sm:text-xl font-black tabular-nums leading-none ${
                    timeDanger ? 'text-red-600' : 'text-slate-900'
                  }`}
                  data-testid="hud-timer"
                >
                  {formatTimer(remaining)}
                </div>
              </div>

              <div className="h-5 w-px bg-slate-300" />

              {/* Collisions */}
              <div>
                <div className="text-[8px] sm:text-[9px] font-bold uppercase tracking-widest text-slate-500">
                  CRASHES
                </div>
                <div
                  className={`text-base sm:text-xl font-black tabular-nums leading-none ${
                    hud.collisions > 0 ? 'text-red-600' : 'text-slate-900'
                  }`}
                  data-testid="hud-collisions"
                >
                  {hud.collisions}
                </div>
              </div>

              <div className="h-5 w-px bg-slate-300" />

              {/* Star Rating Forecast */}
              <div>
                <div className="text-[8px] sm:text-[9px] font-bold uppercase tracking-widest text-slate-500">
                  STARS
                </div>
                <div className="flex items-center gap-0.5" aria-label={`${hud.forecastStars} stars forecast`}>
                  {[1, 2, 3].map((idx) => (
                    <svg key={idx} viewBox="0 0 24 24" className="w-3.5 h-3.5 sm:w-4 sm:h-4">
                      <path
                        d="M12 2.5L14.9 8.4L21.4 9.3L16.7 13.9L17.8 20.4L12 17.3L6.2 20.4L7.3 13.9L2.6 9.3L9.1 8.4L12 2.5Z"
                        fill={idx <= hud.forecastStars ? '#facc15' : '#e2e8f0'}
                        stroke="#0f172a"
                        strokeWidth="1.8"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ))}
                </div>
              </div>
            </div>

            {/* Bay Alignment Mini-Bar + Active Cart + Bay Compass */}
            <div className="mt-1.5 pt-1 border-t border-slate-200 flex items-center justify-between gap-2">
              <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider text-slate-600 truncate">
                {hud.inBay ? 'IN BAY — BRAKE' : activeCart.name}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900 text-amber-300 text-[9px] sm:text-[10px] font-black tabular-nums"
                  title="Bay Direction & Distance"
                  data-testid="bay-compass"
                >
                  <svg
                    viewBox="0 0 16 16"
                    className="w-2.5 h-2.5 sm:w-3 sm:h-3"
                    style={{ transform: `rotate(${Math.round((hud.bayBearingRad * 180) / Math.PI)}deg)` }}
                  >
                    <path d="M8 1L13 13L8 10L3 13L8 1Z" fill="#facc15" />
                  </svg>
                  {hud.bayDistance.toFixed(0)}m
                </span>
                <span className="text-[10px] sm:text-xs font-black tabular-nums text-emerald-700">
                  {Math.round(hud.bayAccuracyPct)}%
                </span>
              </div>
            </div>
            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mt-0.5">
              <div
                className="h-full transition-all duration-100"
                style={{
                  width: `${hud.inBay ? Math.max(15, hud.parkProgress * 100) : hud.bayAccuracyPct}%`,
                  backgroundColor: hud.inBay ? '#16a34a' : '#f59e0b',
                }}
              />
            </div>
            {(hud.requireReverse || hud.scenarioLabel) && (
              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                {hud.requireReverse && (
                  <span className="text-[8px] sm:text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-orange-500 text-white">
                    REVERSE IN ONLY
                  </span>
                )}
                {hud.scenarioLabel && (
                  <span className="hidden sm:inline-block text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-sky-100 text-slate-800 border border-slate-300">
                    {hud.scenarioLabel}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Desktop Center Column: Owner Anger Meter + Event Banner */}
          <div className="hidden sm:flex flex-col items-center gap-2 flex-1 max-w-md mx-2">
            {/* Store Owner Anger Meter */}
            <div
              className="w-full rounded-xl border-2 border-slate-900 shadow-[4px_4px_0px_#0f172a] px-3.5 py-2"
              style={{ backgroundColor: 'rgba(248, 250, 252, 0.94)' }}
              data-testid="owner-anger-meter"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">
                  STORE OWNER ANGER
                </span>
                <span
                  className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded border border-slate-900 ${stageMeta.badgeBg} ${stageMeta.badgeText}`}
                >
                  STAGE {hud.owner.stage}: {stageMeta.label}
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden border border-slate-900/30">
                <div
                  className="h-full transition-all duration-150"
                  style={{
                    width: `${Math.max(4, hud.owner.anger)}%`,
                    backgroundColor: stageMeta.barColor,
                  }}
                />
              </div>
            </div>

            {/* Owner Dialogue Speech Bubble (Desktop) */}
            {hud.owner.dialogue && (
              <div
                data-testid="owner-dialogue-bubble"
                className="w-full rounded-xl border-2 border-slate-900 shadow-[4px_4px_0px_#0f172a] px-3.5 py-2 bg-white flex items-center gap-2.5"
              >
                <span className="px-2 py-0.5 rounded-md bg-red-600 text-amber-200 font-black text-[10px] uppercase shrink-0">
                  OWNER
                </span>
                <span className="text-xs font-black text-slate-900 leading-snug">
                  “{hud.owner.dialogue}”
                </span>
              </div>
            )}

            {/* Funny Physics Event Toast */}
            {hud.activeEventBanner && (
              <div
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border-2 border-slate-900 shadow-[3px_3px_0px_#0f172a] text-slate-950 font-black text-[11px] uppercase tracking-wide"
                style={{ backgroundColor: '#fde047' }}
              >
                <span>!</span>
                <span>{hud.activeEventBanner}</span>
              </div>
            )}
          </div>

          {/* Top-Right Square SVG Utility Controls (2x2 on narrow mobile, 1x4 on desktop) */}
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <div className="grid grid-cols-2 sm:flex items-center gap-1.5 sm:gap-2 pointer-events-auto">
              <button
                type="button"
                tabIndex={-1}
                aria-label={`Switch camera view (${hud.cameraMode})`}
                title="Toggle Camera [C]"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleCamera();
                }}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_#0f172a] sm:shadow-[3px_3px_0px_#0f172a] bg-white hover:bg-amber-100 flex items-center justify-center cursor-pointer"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 sm:w-5 sm:h-5">
                  <path
                    d="M4 8H8L10 5H14L16 8H20V19H4V8Z"
                    fill="#e2e8f0"
                    stroke="#0f172a"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  <circle cx="12" cy="13.5" r="3.2" fill="#38bdf8" stroke="#0f172a" strokeWidth="1.8" />
                </svg>
              </button>

              <button
                type="button"
                tabIndex={-1}
                aria-label={muted ? 'Unmute audio' : 'Mute audio'}
                title="Toggle Mute [M]"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleMute();
                }}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_#0f172a] sm:shadow-[3px_3px_0px_#0f172a] bg-white hover:bg-amber-100 flex items-center justify-center cursor-pointer"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 sm:w-5 sm:h-5">
                  <path
                    d="M4 9H8L13 5V19L8 15H4V9Z"
                    fill={muted ? '#94a3b8' : '#facc15'}
                    stroke="#0f172a"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  {muted ? (
                    <path d="M16 9L21 15M21 9L16 15" stroke="#dc2626" strokeWidth="2.2" strokeLinecap="round" />
                  ) : (
                    <path
                      d="M16.5 8.5C18 10 18 14 16.5 15.5M19 6C21.5 9 21.5 15 19 18"
                      fill="none"
                      stroke="#0f172a"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  )}
                </svg>
              </button>

              <button
                type="button"
                tabIndex={-1}
                aria-label="Restart level"
                title="Restart [R]"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onRestart();
                }}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_#0f172a] sm:shadow-[3px_3px_0px_#0f172a] bg-white hover:bg-amber-100 flex items-center justify-center cursor-pointer"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 sm:w-5 sm:h-5">
                  <path
                    d="M4 12A8 8 0 1 1 6.3 17.6M4 12V7M4 12H9"
                    fill="none"
                    stroke="#0f172a"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              <button
                type="button"
                tabIndex={-1}
                aria-label="Pause game"
                title="Pause [P / Esc]"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onPause();
                }}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_#0f172a] sm:shadow-[3px_3px_0px_#0f172a] bg-amber-300 hover:bg-amber-200 flex items-center justify-center cursor-pointer"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 sm:w-5 sm:h-5">
                  <rect x="6" y="5" width="4" height="14" rx="1" fill="#0f172a" />
                  <rect x="14" y="5" width="4" height="14" rx="1" fill="#0f172a" />
                </svg>
              </button>
            </div>

            <div className="hidden sm:block px-2.5 py-1 rounded-lg border-2 border-slate-900 bg-amber-300 font-black text-[11px] text-slate-950 tabular-nums shadow-[2px_2px_0px_#0f172a]">
              {hud.coins.toLocaleString()} COINS
            </div>
          </div>
        </div>

        {/* Mobile Compact Owner Anger Bar + Dialogue Bubble */}
        <div className="sm:hidden flex flex-col gap-1">
          <div
            className="w-full rounded-lg border-2 border-slate-900 shadow-[2px_2px_0px_#0f172a] px-2.5 py-1 flex items-center gap-2"
            style={{ backgroundColor: 'rgba(248, 250, 252, 0.92)' }}
          >
            <span className="text-[9px] font-black uppercase text-slate-700 shrink-0">OWNER</span>
            <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden border border-slate-900/30">
              <div
                className="h-full transition-all duration-150"
                style={{
                  width: `${Math.max(4, hud.owner.anger)}%`,
                  backgroundColor: stageMeta.barColor,
                }}
              />
            </div>
            <span
              className={`text-[9px] font-black px-1.5 py-0.5 rounded border border-slate-900 ${stageMeta.badgeBg} ${stageMeta.badgeText}`}
            >
              {stageMeta.label}
            </span>
          </div>

          {hud.owner.dialogue && (
            <div className="mx-auto max-w-[340px] rounded-lg border-2 border-slate-900 shadow-[2px_2px_0px_#0f172a] px-2.5 py-1 bg-white text-[11px] font-black text-slate-900 text-center">
              <span className="text-red-600 mr-1">OWNER:</span>“{hud.owner.dialogue}”
            </div>
          )}
        </div>
      </div>

      {/* Mobile Event Toast */}
      {hud.activeEventBanner && (
        <div className="sm:hidden mx-auto text-center">
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border-2 border-slate-900 shadow-[2px_2px_0px_#0f172a] text-slate-950 font-black text-[11px] uppercase"
            style={{ backgroundColor: '#fde047' }}
          >
            <span>!</span>
            <span>{hud.activeEventBanner}</span>
          </div>
        </div>
      )}

      {/* Center Parking Lock Prompt (only when in bay) */}
      {hud.inBay && (
        <div className="mx-auto text-center">
          <div
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border-2 border-slate-900 shadow-[3px_3px_0px_#0f172a] text-white font-black text-xs sm:text-sm tracking-wide"
            style={{ backgroundColor: '#16a34a' }}
          >
            <span>ALIGNED! HOLD SPACE TO LOCK PARKING</span>
            <span className="tabular-nums">{Math.round(hud.parkProgress * 100)}%</span>
          </div>
        </div>
      )}

      {/* Bottom Perimeter: Stacked cleanly on mobile so touch pads never clip */}
      <div className="flex flex-col gap-2">
        <div className="flex items-end justify-between gap-2">
          {touchMode ? (
            <div className="flex items-center gap-1.5 pointer-events-auto">
              <button
                type="button"
                aria-label="Steer left"
                onPointerDown={() => onTouchInput('left', true)}
                onPointerUp={() => onTouchInput('left', false)}
                onPointerLeave={() => onTouchInput('left', false)}
                onPointerCancel={() => onTouchInput('left', false)}
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl border-2 border-slate-900 shadow-[3px_3px_0px_#0f172a] bg-white/95 active:bg-amber-300 font-black text-lg text-slate-900 flex items-center justify-center touch-none"
              >
                ◀
              </button>
              <button
                type="button"
                aria-label="Steer right"
                onPointerDown={() => onTouchInput('right', true)}
                onPointerUp={() => onTouchInput('right', false)}
                onPointerLeave={() => onTouchInput('right', false)}
                onPointerCancel={() => onTouchInput('right', false)}
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl border-2 border-slate-900 shadow-[3px_3px_0px_#0f172a] bg-white/95 active:bg-amber-300 font-black text-lg text-slate-900 flex items-center justify-center touch-none"
              >
                ▶
              </button>
            </div>
          ) : (
            <div />
          )}

          {/* Compact Steering & Live Caster Indicator (Desktop) */}
          <div
            className="hidden sm:flex mx-auto rounded-xl border-2 border-slate-900 shadow-[4px_4px_0px_#0f172a] px-3.5 py-2 items-center gap-3"
            style={{ backgroundColor: 'rgba(248, 250, 252, 0.92)' }}
          >
            <svg viewBox="0 0 64 52" className="w-12 h-10 shrink-0" aria-label="Caster wheel indicator">
              <rect x="18" y="10" width="28" height="32" rx="4" fill="#e2e8f0" stroke="#0f172a" strokeWidth="2" />
              <g transform={`translate(32, 42) rotate(${-steerDeg * 0.5})`}>
                <line x1="-13" y1="0" x2="13" y2="0" stroke="#dc2626" strokeWidth="4" strokeLinecap="round" />
              </g>
              <g transform={`translate(20, 12) rotate(${-leftCasterDeg})`}>
                <rect x="-3" y="-6" width="6" height="12" rx="2" fill="#f59e0b" stroke="#0f172a" strokeWidth="1.5" />
              </g>
              <g transform={`translate(44, 12) rotate(${-rightCasterDeg})`}>
                <rect x="-3" y="-6" width="6" height="12" rx="2" fill="#0f172a" stroke="#0f172a" strokeWidth="1.5" />
              </g>
            </svg>

            <div className="text-left">
              <div className="flex items-center gap-2">
                <span
                  className={`text-[11px] font-black px-1.5 py-0.5 rounded uppercase ${
                    hud.braking
                      ? 'bg-red-600 text-white'
                      : hud.reversing
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-emerald-600 text-white'
                  }`}
                >
                  {hud.braking ? 'BRAKE' : hud.reversing ? 'REV' : 'PUSH'}
                </span>
                <span className="text-sm font-black tabular-nums text-slate-900">
                  {(hud.speed * 2.2).toFixed(0)} <span className="text-[10px] text-slate-500">KM/H</span>
                </span>
              </div>
              <div className="text-[10px] font-bold text-slate-500 mt-0.5 tabular-nums">
                CASTER {leftCasterDeg}° / {rightCasterDeg}°
              </div>
            </div>
          </div>

          {touchMode ? (
            <div className="flex items-center gap-1.5 pointer-events-auto">
              <button
                type="button"
                aria-label="Emergency brake"
                onPointerDown={() => onTouchInput('brake', true)}
                onPointerUp={() => onTouchInput('brake', false)}
                onPointerLeave={() => onTouchInput('brake', false)}
                onPointerCancel={() => onTouchInput('brake', false)}
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl border-2 border-slate-900 shadow-[3px_3px_0px_#0f172a] bg-red-600 active:bg-red-500 font-black text-[11px] text-white flex items-center justify-center touch-none"
              >
                STOP
              </button>
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  aria-label="Push forward"
                  onPointerDown={() => onTouchInput('forward', true)}
                  onPointerUp={() => onTouchInput('forward', false)}
                  onPointerLeave={() => onTouchInput('forward', false)}
                  onPointerCancel={() => onTouchInput('forward', false)}
                  className="w-12 h-11 sm:w-14 sm:h-12 rounded-xl border-2 border-slate-900 shadow-[3px_3px_0px_#0f172a] bg-emerald-500 active:bg-emerald-400 font-black text-sm text-white flex items-center justify-center touch-none"
                >
                  ▲
                </button>
                <button
                  type="button"
                  aria-label="Reverse"
                  onPointerDown={() => onTouchInput('backward', true)}
                  onPointerUp={() => onTouchInput('backward', false)}
                  onPointerLeave={() => onTouchInput('backward', false)}
                  onPointerCancel={() => onTouchInput('backward', false)}
                  className="w-12 h-11 sm:w-14 sm:h-12 rounded-xl border-2 border-slate-900 shadow-[3px_3px_0px_#0f172a] bg-amber-400 active:bg-amber-300 font-black text-sm text-slate-950 flex items-center justify-center touch-none"
                >
                  ▼
                </button>
              </div>
            </div>
          ) : (
            <div />
          )}
        </div>

        {/* Mobile-only compact bottom caster pill */}
        <div className="sm:hidden flex justify-center -mt-1">
          <div
            className="rounded-lg border-2 border-slate-900 shadow-[2px_2px_0px_#0f172a] px-2.5 py-1 flex items-center gap-2"
            style={{ backgroundColor: 'rgba(248, 250, 252, 0.92)' }}
          >
            <span
              className={`text-[10px] font-black px-1 py-0.5 rounded uppercase ${
                hud.braking
                  ? 'bg-red-600 text-white'
                  : hud.reversing
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-emerald-600 text-white'
              }`}
            >
              {hud.braking ? 'BRK' : hud.reversing ? 'REV' : 'PUSH'}
            </span>
            <span className="text-[11px] font-black tabular-nums text-slate-900">
              {leftCasterDeg}° / {rightCasterDeg}°
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
