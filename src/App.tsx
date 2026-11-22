import { useCallback, useEffect, useRef, useState } from 'react';
import { CartChaosEngine } from './game/CartChaosEngine';
import { type EmbedBridge, createEmbedBridge } from './game/embedBridge';
import { LEVELS } from './game/levels';
import { createInitialOwnerSnapshot } from './game/ownerLogic';
import {
  type PlayerProgression,
  applyRunOutcome,
  loadProgression,
  saveProgression,
} from './game/progression';
import {
  getBestOverallScore,
  getTotalStars,
  loadRecords,
  saveLevelRecord,
  type RecordsMap,
} from './game/storage';
import type {
  GameMode,
  GamePhase,
  HudSnapshot,
  InputState,
  LevelConfig,
  ParkingEvaluation,
} from './game/types';
import { TitleOverlay } from './components/TitleOverlay';
import { GameHud } from './components/GameHud';
import { CartGarageModal } from './components/CartGarageModal';
import {
  HowToPlayModal,
  LevelSelectModal,
  PauseModal,
  ResultsModal,
} from './components/Modals';

const INITIAL_HUD: HudSnapshot = {
  levelId: 1,
  levelName: LEVELS[0].name,
  gameMode: 'career',
  cartId: 'classic',
  elapsedTime: 0,
  timeLimit: null,
  collisions: 0,
  steeringCorrections: 0,
  forecastStars: 3,
  steeringInput: 0,
  leftCasterAngle: 0,
  rightCasterAngle: 0,
  speed: 0,
  reversing: false,
  braking: false,
  inBay: false,
  bayAccuracyPct: 0,
  parkProgress: 0,
  activeEventBanner: null,
  cameraMode: 'chase',
  owner: createInitialOwnerSnapshot(),
  coins: 0,
  bayDistance: 6.4,
  bayBearingRad: 0,
  requireReverse: false,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<CartChaosEngine | null>(null);
  const bridgeRef = useRef<EmbedBridge | null>(null);
  if (!bridgeRef.current) {
    bridgeRef.current = createEmbedBridge();
  }
  const isEmbed = bridgeRef.current.config.isEmbed;

  const [engineStatus, setEngineStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [engineError, setEngineError] = useState<string | null>(null);

  const [phase, setPhase] = useState<GamePhase>('title');
  const phaseRef = useRef<GamePhase>('title');

  const [gameMode, setGameMode] = useState<GameMode>('career');
  const gameModeRef = useRef<GameMode>('career');

  const [progression, setProgression] = useState<PlayerProgression>(() => loadProgression());
  const progressionRef = useRef<PlayerProgression>(progression);

  const [showLevelSelect, setShowLevelSelect] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showGarage, setShowGarage] = useState(false);
  const modalOpenRef = useRef(false);

  const [hud, setHud] = useState<HudSnapshot>(() => ({
    ...INITIAL_HUD,
    cartId: progression.selectedCartId,
    coins: progression.coins,
  }));
  const [muted, setMuted] = useState(false);
  const [touchMode, setTouchMode] = useState(false);
  const [records, setRecords] = useState<RecordsMap>(() => loadRecords());
  const recordsRef = useRef<RecordsMap>(records);
  const [completedInfo, setCompletedInfo] = useState<{
    evaluation: ParkingEvaluation;
    level: LevelConfig;
  } | null>(null);

  const syncPhase = useCallback((next: GamePhase) => {
    phaseRef.current = next;
    setPhase(next);
    document.body.dataset.state = next;
  }, []);

  const updateProgression = useCallback((next: PlayerProgression) => {
    progressionRef.current = next;
    setProgression(next);
    saveProgression(next);
    const engine = engineRef.current;
    if (engine) {
      engine.setCoinsDisplay(next.coins);
      if (phaseRef.current === 'title') {
        engine.loadLevel(
          1,
          'title',
          gameModeRef.current,
          next.selectedCartId,
          next.cosmetics
        );
      }
    }
  }, []);

  const handleChangeGameMode = useCallback((mode: GameMode) => {
    gameModeRef.current = mode;
    setGameMode(mode);
  }, []);

  useEffect(() => {
    modalOpenRef.current = showLevelSelect || showHowToPlay || showGarage;
  }, [showLevelSelect, showHowToPlay, showGarage]);

  useEffect(() => {
    const checkTouch = () => {
      const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
      setTouchMode(coarse || window.innerWidth < 820);
    };
    checkTouch();
    window.addEventListener('resize', checkTouch);
    return () => window.removeEventListener('resize', checkTouch);
  }, []);

  const startLevel = useCallback(
    (levelId: number) => {
      const engine = engineRef.current;
      if (!engine) return;
      engine.sound.unlock();
      setShowLevelSelect(false);
      setShowHowToPlay(false);
      setShowGarage(false);
      setCompletedInfo(null);
      syncPhase('playing');
      const prog = progressionRef.current;
      engine.setCoinsDisplay(prog.coins);
      engine.loadLevel(
        levelId,
        'playing',
        gameModeRef.current,
        prog.selectedCartId,
        prog.cosmetics
      );
      const lvl = engine.getCurrentLevel();
      bridgeRef.current?.emitStarted({
        levelId: lvl.id,
        levelName: lvl.name,
        mode: gameModeRef.current,
        cartId: prog.selectedCartId,
      });
    },
    [syncPhase]
  );

  const handlePlayFromTitle = useCallback(() => {
    startLevel(1);
  }, [startLevel]);

  const handlePause = useCallback(
    (reason: 'user' | 'visibility' | 'host' = 'user') => {
      const engine = engineRef.current;
      if (!engine || phaseRef.current !== 'playing') return;
      engine.setPhase('paused');
      syncPhase('paused');
      bridgeRef.current?.emitPaused({
        levelId: engine.getCurrentLevel().id,
        reason,
      });
    },
    [syncPhase]
  );

  const handleResume = useCallback(
    (reason: 'user' | 'host' = 'user') => {
      const engine = engineRef.current;
      if (!engine || phaseRef.current !== 'paused') return;
      engine.sound.unlock();
      engine.setPhase('playing');
      syncPhase('playing');
      bridgeRef.current?.emitResumed({
        levelId: engine.getCurrentLevel().id,
        reason,
      });
    },
    [syncPhase]
  );

  const handleRestart = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const currentId = engine.getCurrentLevel().id;
    startLevel(currentId);
  }, [startLevel]);

  const handleMainMenu = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    setCompletedInfo(null);
    setShowLevelSelect(false);
    setShowHowToPlay(false);
    setShowGarage(false);
    syncPhase('title');
    const prog = progressionRef.current;
    engine.setCoinsDisplay(prog.coins);
    engine.loadLevel(1, 'title', gameModeRef.current, prog.selectedCartId, prog.cosmetics);
  }, [syncPhase]);

  const handleExitEmbed = useCallback(() => {
    const engine = engineRef.current;
    if (phaseRef.current === 'playing' && engine) {
      engine.setPhase('paused');
      syncPhase('paused');
    }
    const recs = recordsRef.current;
    const prog = progressionRef.current;
    bridgeRef.current?.emitExited({
      levelId: engine?.getCurrentLevel().id ?? 1,
      phase: phaseRef.current,
      bestScore: getBestOverallScore(recs),
      totalStars: getTotalStars(recs),
      coins: prog.coins,
    });
  }, [syncPhase]);

  const handleToggleMute = useCallback(
    (forcedMuted?: boolean) => {
      const engine = engineRef.current;
      if (!engine) return;
      engine.sound.unlock();
      const nextMuted = typeof forcedMuted === 'boolean' ? forcedMuted : !engine.sound.isMuted();
      engine.sound.setMuted(nextMuted);
      setMuted(nextMuted);
    },
    []
  );

  const handleToggleCamera = useCallback(() => {
    engineRef.current?.toggleCameraMode();
  }, []);

  const handleTouchInput = useCallback((key: keyof InputState, pressed: boolean) => {
    const engine = engineRef.current;
    if (!engine) return;
    if (pressed) engine.sound.unlock();
    engine.setInputKey(key, pressed);
  }, []);

  // Mount Three.js + Rapier3D once + wire NOVA postMessage bridge
  useEffect(() => {
    const mount = canvasMountRef.current;
    const bridge = bridgeRef.current;
    if (!mount || !bridge) return;

    document.body.dataset.state = 'title';
    document.body.dataset.embed = bridge.config.isEmbed ? '1' : '0';
    const autostart = bridge.config.autostart;
    const initialLvl = bridge.config.initialLevelId;

    const engine = new CartChaosEngine(mount, {
      onHudUpdate: (snapshot) => {
        setHud(snapshot);
      },
      onLevelComplete: (evaluation, level) => {
        const ownerSnap = engine.getOwnerSnapshot();
        const reward = applyRunOutcome(progressionRef.current, {
          levelId: level.id,
          mode: engine.getGameMode(),
          evaluation,
          survivedStage5: ownerSnap.survivedStage5,
        });
        progressionRef.current = reward.progression;
        setProgression(reward.progression);
        saveProgression(reward.progression);
        engine.setCoinsDisplay(reward.progression.coins);

        const enrichedEval: ParkingEvaluation = {
          ...evaluation,
          coinsEarned: reward.coinsEarned,
          newlyUnlockedCarts: reward.newlyUnlockedCarts,
        };

        if (reward.newlyUnlockedCarts.length > 0) {
          engine.sound.playUnlockFanfare();
        } else if (evaluation.passed && !evaluation.meltdownDefeat && !evaluation.timeExpired) {
          engine.sound.playCoinChime();
        }

        let latestRecords = recordsRef.current;
        if (evaluation.passed && !evaluation.meltdownDefeat && !evaluation.timeExpired) {
          latestRecords = saveLevelRecord(
            level.id,
            evaluation.stars,
            evaluation.score,
            evaluation.accuracyPct,
            evaluation.timeTaken
          );
          recordsRef.current = latestRecords;
          setRecords(latestRecords);
        }

        bridge.emitLevelCompleted({
          levelId: level.id,
          levelName: level.name,
          mode: engine.getGameMode(),
          cartId: reward.progression.selectedCartId,
          passed: Boolean(evaluation.passed && !evaluation.meltdownDefeat && !evaluation.timeExpired),
          stars: evaluation.stars,
          score: evaluation.score,
          accuracyPct: evaluation.accuracyPct,
          timeTaken: evaluation.timeTaken,
          collisions: evaluation.collisions,
          coinsEarned: reward.coinsEarned,
        });
        bridge.emitScoreUpdated({
          bestScore: getBestOverallScore(latestRecords),
          totalStars: getTotalStars(latestRecords),
          coins: reward.progression.coins,
          latestScore: evaluation.score,
          latestLevelId: level.id,
        });

        setCompletedInfo({ evaluation: enrichedEval, level });
        syncPhase('gameover');
      },
      onReady: () => {
        setEngineStatus('ready');
        setEngineError(null);
        const prog = progressionRef.current;
        engine.setCoinsDisplay(prog.coins);
        if (autostart) {
          syncPhase('playing');
          engine.loadLevel(
            initialLvl,
            'playing',
            gameModeRef.current,
            prog.selectedCartId,
            prog.cosmetics
          );
          const lvl = engine.getCurrentLevel();
          bridge.emitStarted({
            levelId: lvl.id,
            levelName: lvl.name,
            mode: gameModeRef.current,
            cartId: prog.selectedCartId,
          });
        } else {
          engine.loadLevel(
            1,
            'title',
            gameModeRef.current,
            prog.selectedCartId,
            prog.cosmetics
          );
        }
        bridge.emitReady({ levels: LEVELS.length, carts: 10 });
      },
    });

    engineRef.current = engine;
    void engine.init().catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Unable to start 3D WebGL or physics runtime.';
      setEngineError(msg);
      setEngineStatus('error');
      bridge.emitError({ code: 'ENGINE_INIT_FAILED', message: msg });
    });

    const unsubscribeBridge = bridge.subscribe((cmd) => {
      switch (cmd.type) {
        case 'NOVA_PAUSE':
          handlePause('host');
          break;
        case 'NOVA_RESUME':
          handleResume('host');
          break;
        case 'NOVA_RESTART':
          handleRestart();
          break;
        case 'NOVA_MUTE':
          handleToggleMute(cmd.payload?.muted);
          break;
        case 'NOVA_REQUEST_EXIT':
          handleExitEmbed();
          break;
        case 'NOVA_START_LEVEL':
          startLevel(cmd.payload?.levelId ?? 1);
          break;
      }
    });

    return () => {
      unsubscribeBridge();
      engine.dispose();
      engineRef.current = null;
    };
  }, [handleExitEmbed, handlePause, handleRestart, handleResume, handleToggleMute, startLevel, syncPhase]);

  // Unified window keyboard + blur hygiene
  useEffect(() => {
    const mapKeyToInput = (code: string): keyof InputState | null => {
      switch (code) {
        case 'KeyW':
        case 'ArrowUp':
          return 'forward';
        case 'KeyS':
        case 'ArrowDown':
          return 'backward';
        case 'KeyA':
        case 'ArrowLeft':
          return 'left';
        case 'KeyD':
        case 'ArrowRight':
          return 'right';
        case 'Space':
          return 'brake';
        default:
          return null;
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const targetTag = (e.target as HTMLElement | null)?.tagName;
      if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || targetTag === 'SELECT') return;

      const engine = engineRef.current;
      if (!engine) return;

      if (phaseRef.current === 'title') {
        if (!modalOpenRef.current && (e.code === 'Enter' || e.code === 'Space')) {
          e.preventDefault();
          handlePlayFromTitle();
        } else if (e.code === 'Escape' && modalOpenRef.current) {
          setShowLevelSelect(false);
          setShowHowToPlay(false);
          setShowGarage(false);
        }
        return;
      }

      if (phaseRef.current === 'paused') {
        if (e.code === 'Escape' || e.code === 'KeyP') {
          e.preventDefault();
          handleResume('user');
        }
        return;
      }

      if (phaseRef.current === 'gameover') {
        if (e.code === 'Escape' && showGarage) {
          setShowGarage(false);
        } else if (e.code === 'KeyR' && !showGarage) {
          e.preventDefault();
          handleRestart();
        }
        return;
      }

      // Playing state
      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        handlePause('user');
        return;
      }
      if (e.code === 'KeyR') {
        e.preventDefault();
        handleRestart();
        return;
      }
      if (e.code === 'KeyM') {
        e.preventDefault();
        handleToggleMute();
        return;
      }
      if (e.code === 'KeyC' || e.code === 'KeyV') {
        e.preventDefault();
        handleToggleCamera();
        return;
      }

      if (e.code === 'KeyQ') {
        e.preventDefault();
        engine.setOrbitKey('left', true);
        return;
      }
      if (e.code === 'KeyE') {
        e.preventDefault();
        engine.setOrbitKey('right', true);
        return;
      }

      const mapped = mapKeyToInput(e.code);
      if (mapped) {
        e.preventDefault();
        engine.sound.unlock();
        engine.setInputKey(mapped, true);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyQ') {
        engineRef.current?.setOrbitKey('left', false);
        return;
      }
      if (e.code === 'KeyE') {
        engineRef.current?.setOrbitKey('right', false);
        return;
      }
      const mapped = mapKeyToInput(e.code);
      if (mapped) {
        engineRef.current?.setInputKey(mapped, false);
      }
    };

    const onBlur = () => {
      engineRef.current?.clearInputs();
    };

    const onVisibility = () => {
      if (document.hidden) {
        engineRef.current?.clearInputs();
        if (phaseRef.current === 'playing') {
          handlePause('visibility');
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [
    handlePause,
    handlePlayFromTitle,
    handleRestart,
    handleResume,
    handleToggleCamera,
    handleToggleMute,
    showGarage,
  ]);

  const bestScore = getBestOverallScore(records);
  const totalStars = getTotalStars(records);
  const currentLevel = engineRef.current?.getCurrentLevel() ?? LEVELS[0];
  const nextLevelId =
    completedInfo && completedInfo.level.id < LEVELS.length
      ? completedInfo.level.id + 1
      : completedInfo
        ? 7
        : null;

  return (
    <main className="relative w-full h-dvh max-h-dvh overflow-hidden bg-sky-100 select-none">
      {/* Isolated WebGL Canvas Mount */}
      <div
        ref={canvasMountRef}
        data-testid="game-canvas-container"
        className="absolute inset-0 w-full h-full z-0 overflow-hidden"
      />

      {/* Engine Loading Indicator */}
      {engineStatus === 'loading' && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(219, 234, 254, 0.92)' }}
          role="status"
          aria-live="polite"
        >
          <div className="rounded-2xl bg-slate-50 border-3 border-slate-900 shadow-[6px_6px_0px_#0f172a] px-6 py-5 text-center max-w-xs">
            <div className="text-xs font-black tracking-widest uppercase text-red-600 mb-1">
              MEGA MART LOT
            </div>
            <div className="text-xl font-black text-slate-900">LOADING CART CHAOS...</div>
            <p className="text-xs font-bold text-slate-600 mt-1">
              Preparing 3D parking lot &amp; caster physics
            </p>
          </div>
        </div>
      )}

      {/* Engine Init Fallback Screen */}
      {engineStatus === 'error' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.85)' }}
          role="alert"
        >
          <div className="rounded-2xl bg-slate-50 border-3 border-slate-900 shadow-[8px_8px_0px_#0f172a] p-6 text-center max-w-sm">
            <div className="text-xs font-black tracking-widest uppercase text-red-600 mb-1">
              GRAPHICS / PHYSICS ERROR
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">CANNOT START 3D LOT</h2>
            <p className="text-xs font-bold text-slate-600 mb-4">
              {engineError ?? 'WebGL or physics runtime failed to initialize in this browser.'}
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="w-full py-2.5 rounded-xl bg-amber-300 hover:bg-amber-200 text-slate-950 font-black text-sm border-2 border-slate-900 shadow-[3px_3px_0px_#0f172a] cursor-pointer"
              >
                RELOAD GAME
              </button>
              {isEmbed && (
                <button
                  type="button"
                  onClick={handleExitEmbed}
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 font-black text-sm border-2 border-slate-900 cursor-pointer"
                >
                  EXIT TO NOVA
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {engineStatus === 'ready' && phase === 'title' && (
        <TitleOverlay
          bestScore={bestScore}
          totalStars={totalStars}
          coins={progression.coins}
          selectedCartId={progression.selectedCartId}
          unlockedCount={progression.unlockedCarts.length}
          gameMode={gameMode}
          onChangeGameMode={handleChangeGameMode}
          onPlay={handlePlayFromTitle}
          onOpenGarage={() => {
            engineRef.current?.sound.unlock();
            setShowGarage(true);
          }}
          onOpenLevels={() => setShowLevelSelect(true)}
          onOpenHowToPlay={() => setShowHowToPlay(true)}
          isEmbed={isEmbed}
          onExit={handleExitEmbed}
        />
      )}

      {phase === 'playing' && (
        <GameHud
          hud={hud}
          muted={muted}
          touchMode={touchMode}
          onToggleMute={() => handleToggleMute()}
          onToggleCamera={handleToggleCamera}
          onRestart={handleRestart}
          onPause={() => handlePause('user')}
          onTouchInput={handleTouchInput}
        />
      )}

      {showLevelSelect && (
        <LevelSelectModal
          records={records}
          gameMode={gameMode}
          onSelectLevel={startLevel}
          onClose={() => setShowLevelSelect(false)}
        />
      )}

      {showHowToPlay && <HowToPlayModal onClose={() => setShowHowToPlay(false)} />}

      {phase === 'paused' && (
        <PauseModal
          level={currentLevel}
          onResume={() => handleResume('user')}
          onRestart={handleRestart}
          onMainMenu={handleMainMenu}
          isEmbed={isEmbed}
          onExit={handleExitEmbed}
        />
      )}

      {phase === 'gameover' && completedInfo && !showGarage && (
        <ResultsModal
          level={completedInfo.level}
          evaluation={completedInfo.evaluation}
          hasNextLevel={nextLevelId !== null}
          onRetry={handleRestart}
          onNextLevel={() => nextLevelId && startLevel(nextLevelId)}
          onOpenGarage={() => setShowGarage(true)}
          onMainMenu={handleMainMenu}
          isEmbed={isEmbed}
          onExit={handleExitEmbed}
        />
      )}

      {showGarage && (
        <CartGarageModal
          progression={progression}
          onUpdateProgression={updateProgression}
          onUnlockSound={() => {
            engineRef.current?.sound.unlock();
            engineRef.current?.sound.playUnlockFanfare();
          }}
          onCoinSound={() => {
            engineRef.current?.sound.unlock();
            engineRef.current?.sound.playCoinChime();
          }}
          onClose={() => setShowGarage(false)}
        />
      )}
    </main>
  );
}
