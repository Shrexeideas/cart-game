import React from 'react';
import { getCartDefinition } from '../game/carts';
import { LEVELS } from '../game/levels';
import type { RecordsMap } from '../game/storage';
import type { GameMode, LevelConfig, ParkingEvaluation } from '../game/types';

interface LevelSelectModalProps {
  records: RecordsMap;
  gameMode: GameMode;
  onSelectLevel: (levelId: number) => void;
  onClose: () => void;
}

export const LevelSelectModal: React.FC<LevelSelectModalProps> = ({
  records,
  gameMode,
  onSelectLevel,
  onClose,
}) => {
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.72)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Level Selection"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-slate-50 border-3 border-slate-900 shadow-[8px_8px_0px_#0f172a] p-5 sm:p-6 max-h-[88dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">SELECT AISLE</h2>
            <p className="text-xs font-bold text-slate-500">
              Mode: <span className="uppercase text-red-600">{gameMode}</span> · Pick your favorite wheel disaster.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-900 font-black text-sm border-2 border-slate-900 cursor-pointer"
          >
            CLOSE
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {LEVELS.map((lvl) => {
            const rec = records[lvl.id];
            return (
              <button
                key={lvl.id}
                type="button"
                onClick={() => onSelectLevel(lvl.id)}
                className="text-left p-3.5 rounded-xl bg-white hover:bg-amber-50 border-2 border-slate-900 shadow-[3px_3px_0px_#0f172a] transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-black px-2 py-0.5 rounded bg-red-600 text-amber-200">
                    {lvl.code}
                  </span>
                  <span className="text-sm font-black text-amber-500">
                    {'★'.repeat(rec?.bestStars ?? 0)}
                    {'☆'.repeat(3 - (rec?.bestStars ?? 0))}
                  </span>
                </div>
                <div className="font-black text-base text-slate-900">{lvl.name}</div>
                <div className="text-xs font-medium text-slate-600 mt-0.5 line-clamp-2">
                  {lvl.subtitle}
                </div>
                {rec && (
                  <div className="mt-2 text-[11px] font-bold text-emerald-700 tabular-nums">
                    Best: {rec.bestAccuracy}% · {rec.bestTime.toFixed(1)}s
                  </div>
                )}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => onSelectLevel(7)}
            className="text-left p-3.5 rounded-xl bg-amber-300 hover:bg-amber-200 border-2 border-slate-900 shadow-[3px_3px_0px_#0f172a] transition-colors cursor-pointer flex items-center justify-between gap-3"
          >
            <div>
              <span className="text-[11px] font-black px-2 py-0.5 rounded bg-slate-900 text-amber-300">
                ENDLESS SHUFFLE
              </span>
              <div className="font-black text-base text-slate-950 mt-1">
                Randomized Lot Generator
              </div>
              <div className="text-xs font-bold text-slate-800">
                Fresh bay across the 68m complex, random obstacles &amp; weather.
              </div>
            </div>
            <span className="font-black text-xs px-2.5 py-2 rounded-lg bg-slate-900 text-white shrink-0">
              SHUFFLE
            </span>
          </button>

          <button
            type="button"
            onClick={() => onSelectLevel(8)}
            className="text-left p-3.5 rounded-xl bg-sky-200 hover:bg-sky-100 border-2 border-slate-900 shadow-[3px_3px_0px_#0f172a] transition-colors cursor-pointer flex items-center justify-between gap-3"
          >
            <div>
              <span className="text-[11px] font-black px-2 py-0.5 rounded bg-red-600 text-amber-200">
                DAILY CHALLENGE
              </span>
              <div className="font-black text-base text-slate-950 mt-1">
                Today&apos;s Seeded Chaos
              </div>
              <div className="text-xs font-bold text-slate-800">
                Same chaotic supermarket layout for all players today.
              </div>
            </div>
            <span className="font-black text-xs px-2.5 py-2 rounded-lg bg-slate-900 text-white shrink-0">
              PLAY
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export const HowToPlayModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div
    className="fixed inset-0 z-30 flex items-center justify-center p-4"
    style={{ backgroundColor: 'rgba(15, 23, 42, 0.72)' }}
    role="dialog"
    aria-modal="true"
    aria-label="How to Play"
  >
    <div className="w-full max-w-lg rounded-2xl bg-slate-50 border-3 border-slate-900 shadow-[8px_8px_0px_#0f172a] p-6 max-h-[88dvh] overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-black text-slate-900">HOW TO CART</h2>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-900 font-black text-sm border-2 border-slate-900 cursor-pointer"
        >
          GOT IT
        </button>
      </div>

      <div className="space-y-3 text-sm text-slate-700 font-medium">
        <div className="p-3 rounded-xl bg-white border-2 border-slate-900">
          <div className="font-black text-slate-900 mb-0.5">1. Respect Caster Lag</div>
          Shopping carts steer from the back handle while front casters swivel late. Start turning early!
        </div>
        <div className="p-3 rounded-xl bg-white border-2 border-slate-900">
          <div className="font-black text-slate-900 mb-0.5">2. Watch the Store Owner</div>
          Crashing, hitting carts, or doing donuts fills the Store Owner’s Anger Meter. Hit Stage 5 Meltdown for too long and you’re banned!
        </div>
        <div className="p-3 rounded-xl bg-white border-2 border-slate-900">
          <div className="font-black text-slate-900 mb-0.5">3. Unlock 10 Trolleys</div>
          Earn Coins &amp; complete rare challenges to unlock carts like Speed Demon, Monster Cart, Luxury Cart, and the 24K Golden Cart.
        </div>
        <div className="p-3 rounded-xl bg-white border-2 border-slate-900">
          <div className="font-black text-slate-900 mb-0.5">4. Brake Inside the Painted Bay</div>
          Line up inside the yellow-green bay and hold{' '}
          <kbd className="px-1.5 py-0.5 bg-slate-200 rounded font-black">Space</kbd> to lock your wheels.
        </div>
      </div>
    </div>
  </div>
);

interface PauseModalProps {
  level: LevelConfig;
  onResume: () => void;
  onRestart: () => void;
  onMainMenu: () => void;
  isEmbed?: boolean;
  onExit?: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  level,
  onResume,
  onRestart,
  onMainMenu,
  isEmbed = false,
  onExit,
}) => (
  <div
    className="fixed inset-0 z-30 flex items-center justify-center p-4"
    style={{ backgroundColor: 'rgba(15, 23, 42, 0.72)' }}
    role="dialog"
    aria-modal="true"
    aria-label="Paused"
  >
    <div className="w-full max-w-sm rounded-2xl bg-slate-50 border-3 border-slate-900 shadow-[8px_8px_0px_#0f172a] p-6 text-center">
      <div className="text-xs font-black uppercase tracking-widest text-red-600 mb-1">
        {level.code} · {level.name}
      </div>
      <h2 className="text-3xl font-black text-slate-900 mb-5">PAUSED</h2>

      <div className="flex flex-col gap-2.5">
        <button
          type="button"
          onClick={onResume}
          className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-black text-base border-2 border-slate-900 shadow-[3px_3px_0px_#0f172a] cursor-pointer"
        >
          RESUME
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="w-full py-3 rounded-xl bg-amber-300 hover:bg-amber-200 text-slate-950 font-black text-base border-2 border-slate-900 shadow-[3px_3px_0px_#0f172a] cursor-pointer"
        >
          RESTART LEVEL
        </button>
        <button
          type="button"
          onClick={onMainMenu}
          className="w-full py-3 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-black text-base border-2 border-slate-900 shadow-[3px_3px_0px_#0f172a] cursor-pointer"
        >
          MAIN MENU
        </button>
        {isEmbed && onExit && (
          <button
            type="button"
            data-testid="pause-exit-btn"
            onClick={onExit}
            className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 font-black text-sm border-2 border-slate-900 shadow-[3px_3px_0px_#0f172a] cursor-pointer"
          >
            EXIT TO NOVA
          </button>
        )}
      </div>
    </div>
  </div>
);

interface ResultsModalProps {
  level: LevelConfig;
  evaluation: ParkingEvaluation;
  hasNextLevel: boolean;
  onRetry: () => void;
  onNextLevel: () => void;
  onOpenGarage: () => void;
  onMainMenu: () => void;
  isEmbed?: boolean;
  onExit?: () => void;
}

export const ResultsModal: React.FC<ResultsModalProps> = ({
  level,
  evaluation,
  hasNextLevel,
  onRetry,
  onNextLevel,
  onOpenGarage,
  onMainMenu,
  isEmbed = false,
  onExit,
}) => {
  const isDefeat = Boolean(evaluation.meltdownDefeat || evaluation.timeExpired || !evaluation.passed);
  const headline = evaluation.meltdownDefeat
    ? 'OWNER MELTDOWN!'
    : evaluation.timeExpired
      ? 'TIME EXPIRED!'
      : evaluation.stars === 3
        ? 'SPOTLESS PARK!'
        : evaluation.stars === 2
          ? 'PARKED!'
          : 'BARELY LEGAL';

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Parking Results"
    >
      <div className="w-full max-w-md rounded-2xl bg-slate-50 border-3 border-slate-900 shadow-[8px_8px_0px_#0f172a] p-5 sm:p-6 text-center max-h-[90dvh] overflow-y-auto">
        <div className="text-xs font-black uppercase tracking-widest text-red-600">
          {level.code} · {level.name}
        </div>
        <h2
          className={`text-3xl font-black mt-1 ${
            isDefeat ? 'text-red-600' : 'text-slate-900'
          }`}
        >
          {headline}
        </h2>

        {/* Star Rating (only on pass) */}
        {!isDefeat && (
          <div
            className="flex items-center justify-center gap-2 my-2.5"
            aria-label={`Earned ${evaluation.stars} out of 3 stars`}
          >
            {[1, 2, 3].map((idx) => (
              <svg key={idx} viewBox="0 0 24 24" className="w-10 h-10">
                <path
                  d="M12 2.5L14.9 8.4L21.4 9.3L16.7 13.9L17.8 20.4L12 17.3L6.2 20.4L7.3 13.9L2.6 9.3L9.1 8.4L12 2.5Z"
                  fill={idx <= evaluation.stars ? '#facc15' : '#e2e8f0'}
                  stroke="#0f172a"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              </svg>
            ))}
          </div>
        )}

        {/* Coins Earned Pill */}
        {typeof evaluation.coinsEarned === 'number' && (
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-900 text-amber-300 font-black text-xs uppercase tracking-wider my-1">
            +{evaluation.coinsEarned} COINS EARNED
          </div>
        )}

        {/* Newly Unlocked Carts Celebration */}
        {evaluation.newlyUnlockedCarts && evaluation.newlyUnlockedCarts.length > 0 && (
          <div className="my-2.5 p-2.5 rounded-xl bg-emerald-500 border-2 border-slate-900 text-white shadow-[3px_3px_0px_#0f172a]">
            <div className="text-[10px] font-black uppercase tracking-wider">
              NEW TROLLEY UNLOCKED!
            </div>
            <div className="text-sm font-black">
              {evaluation.newlyUnlockedCarts
                .map((id) => getCartDefinition(id).name)
                .join(' · ')}
            </div>
          </div>
        )}

        {/* Hilarious Commentary / Owner Reaction */}
        <div className="my-2.5 py-2.5 px-4 rounded-xl bg-amber-300 border-2 border-slate-900 font-black text-sm text-slate-950">
          “{evaluation.commentary}”
        </div>
        {evaluation.ownerReaction && evaluation.ownerReaction !== evaluation.commentary && (
          <div className="mb-2.5 py-2 px-3 rounded-xl bg-white border-2 border-slate-900 text-xs font-black text-slate-800">
            <span className="text-red-600 uppercase mr-1">Store Owner:</span>“{evaluation.ownerReaction}”
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-2 my-3 text-left">
          <div className="p-2.5 rounded-xl bg-white border-2 border-slate-900">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
              ACCURACY
            </div>
            <div className="text-xl font-black tabular-nums text-emerald-600">
              {evaluation.accuracyPct}%
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-white border-2 border-slate-900">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
              TIME TAKEN
            </div>
            <div className="text-xl font-black tabular-nums text-slate-900">
              {evaluation.timeTaken.toFixed(1)}s
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-white border-2 border-slate-900">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
              COLLISIONS
            </div>
            <div
              className={`text-xl font-black tabular-nums ${
                evaluation.collisions > 0 ? 'text-red-600' : 'text-slate-900'
              }`}
            >
              {evaluation.collisions}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-white border-2 border-slate-900">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
              ANGLE ERROR
            </div>
            <div className="text-xl font-black tabular-nums text-slate-900">
              {evaluation.angleErrorDeg}°
            </div>
          </div>
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-2">
          {!isDefeat && hasNextLevel && (
            <button
              type="button"
              data-start="true"
              onClick={onNextLevel}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-black text-base border-2 border-slate-900 shadow-[3px_3px_0px_#0f172a] cursor-pointer"
            >
              {level.isRandom ? 'ROLL NEXT CHAOS' : 'NEXT LEVEL'}
            </button>
          )}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={onRetry}
              className="py-2.5 rounded-xl bg-amber-300 hover:bg-amber-200 text-slate-950 font-black text-xs sm:text-sm border-2 border-slate-900 shadow-[3px_3px_0px_#0f172a] cursor-pointer"
            >
              RETRY
            </button>
            <button
              type="button"
              onClick={onOpenGarage}
              className="py-2.5 rounded-xl bg-sky-200 hover:bg-sky-100 text-slate-950 font-black text-xs sm:text-sm border-2 border-slate-900 shadow-[3px_3px_0px_#0f172a] cursor-pointer"
            >
              GARAGE
            </button>
            <button
              type="button"
              onClick={onMainMenu}
              className="py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-black text-xs sm:text-sm border-2 border-slate-900 shadow-[3px_3px_0px_#0f172a] cursor-pointer"
            >
              MENU
            </button>
          </div>
          {isEmbed && onExit && (
            <button
              type="button"
              data-testid="results-exit-btn"
              onClick={onExit}
              className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 font-black text-xs tracking-wider border-2 border-slate-900 shadow-[3px_3px_0px_#0f172a] cursor-pointer"
            >
              EXIT TO NOVA
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
