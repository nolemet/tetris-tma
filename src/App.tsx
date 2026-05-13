import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FEEDBACK_ANIMATION_MS, BOARD_LOCK_FLASH_MS, HARD_DROP_FLASH_MS } from './animations/constants'
import { Board } from './components/Board'
import { ControlPad } from './components/ControlPad'
import { GameFeedback } from './components/GameFeedback'
import { GameHistoryPanel } from './components/GameHistoryPanel'
import { GameModesPanel } from './components/GameModesPanel'
import { MainMenu } from './components/MainMenu'
import { NextPiece } from './components/NextPiece'
import { Overlay } from './components/Overlay'
import { ProfilePanel } from './components/ProfilePanel'
import { ReplayViewer } from './components/ReplayViewer'
import { SettingsPanel } from './components/SettingsPanel'
import { SkinsPanel } from './components/SkinsPanel'
import { Stats } from './components/Stats'
import { CLASSIC_MODE_CONFIG } from './game/modes'
import { generateGameSeed } from './game/seededRandom'
import { useBoardRowFit } from './hooks/useBoardRowFit'
import { useControls } from './hooks/useControls'
import { useGame } from './hooks/useGame'
import { useTelegram } from './hooks/useTelegram'
import { createReplayRecorder, finalizeReplay, recordReplayAction, type ReplayRecorderSession } from './replays/recorder'
import { clearReplays, loadReplays, saveReplay } from './replays/replayStorage'
import { createDefaultKeybinds } from './settings/keybinds'
import { clearGameHistory, loadGameHistory, saveGameResult } from './settings/gameHistoryStorage'
import { loadSettings, resetSettings, updateSettings } from './settings/storage'
import { applySkinPreset } from './skins/applySkin'
import { soundManager } from './sound/manager'
import { applyThemePreset } from './theme/applyTheme'
import type { GameAction, GameSettings } from './types'
import { shareResult } from './utils/share'
import styles from './App.module.css'

type AppScreen = 'menu' | 'game' | 'modes' | 'settings' | 'history' | 'replay' | 'skins' | 'profile'

function App() {
  const { webApp, user } = useTelegram()
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings())
  const [history, setHistory] = useState(() => loadGameHistory())
  const [replays, setReplays] = useState(() => loadReplays())
  const [screen, setScreen] = useState<AppScreen>('menu')
  const [selectedReplayId, setSelectedReplayId] = useState<string | null>(null)
  const game = useGame({
    startLevel: settings.gameplay.startLevel,
    animationsEnabled: settings.visual.animations,
  })
  const [feedbackMessages, setFeedbackMessages] = useState<
    Array<{ id: number; text: string; tone: 'combo' | 'b2b' | 'level' | 'neutral' }>
  >([])
  const [lockPulse, setLockPulse] = useState(false)
  const [hardDropPulse, setHardDropPulse] = useState(false)
  const [gameOverPulse, setGameOverPulse] = useState(false)
  const activeReplayRef = useRef<ReplayRecorderSession | null>(null)
  const savedResultIdRef = useRef<string | null>(null)
  const dispatchCoreGameAction = game.dispatchGameAction
  const startCoreGame = game.startGame

  const isGameScreen = screen === 'game'
  const isCenteredScreen = screen === 'menu' || screen === 'modes'
  const selectedSkinPreset = useMemo(() => applySkinPreset(settings.visual.selectedSkin), [settings.visual.selectedSkin])
  const holdEnabledInCurrentMode = CLASSIC_MODE_CONFIG.enableHold
  const showHoldPreviewInCurrentMode =
    holdEnabledInCurrentMode && CLASSIC_MODE_CONFIG.showHoldPreview && settings.gameplay.showHoldPiece
  const availableReplayIds = useMemo(() => new Set(replays.map((replay) => replay.id)), [replays])
  const selectedReplay = useMemo(
    () => replays.find((replay) => replay.id === selectedReplayId) ?? null,
    [replays, selectedReplayId],
  )

  useEffect(() => {
    applyThemePreset(settings.visual.theme)
  }, [settings.visual.theme])

  useEffect(() => {
    soundManager.updateMusicState(settings.sound)
  }, [settings.sound])

  useEffect(() => {
    if (!game.lastLockFeedback) {
      return
    }

    const feedback = game.lastLockFeedback
    const messages: Array<{ id: number; text: string; tone: 'combo' | 'b2b' | 'level' | 'neutral' }> = []
    if (feedback.comboCount >= 2 && feedback.clearedLines > 0) {
      messages.push({
        id: feedback.id * 10 + 1,
        text: `Combo x${feedback.comboCount}`,
        tone: 'combo',
      })
      soundManager.play('combo', settings.sound)
    }
    if (feedback.backToBackAwarded && feedback.clearedLines === 4) {
      messages.push({
        id: feedback.id * 10 + 2,
        text: 'Back-to-Back',
        tone: 'b2b',
      })
      soundManager.play('backToBack', settings.sound)
    }
    if (feedback.levelUp) {
      messages.push({
        id: feedback.id * 10 + 3,
        text: `Level ${game.stats.level}!`,
        tone: 'level',
      })
      soundManager.play('levelUp', settings.sound)
    }

    if (feedback.clearedLines > 0) {
      soundManager.play(feedback.clearedLines === 4 ? 'tetrisClear' : 'lineClear', settings.sound)
      soundManager.vibrate(feedback.clearedLines === 4 ? [14, 18, 14] : 12, settings.sound)
    }
    if (feedback.wasHardDrop) {
      soundManager.play('hardDrop', settings.sound)
      soundManager.vibrate(8, settings.sound)
    }
    if (feedback.gameOver) {
      soundManager.play('gameOver', settings.sound)
      soundManager.vibrate([28, 20, 28], settings.sound)
    }

    if (messages.length > 0 && settings.visual.animations && isGameScreen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFeedbackMessages((prev) => [...prev, ...messages])
      messages.forEach((message) => {
        window.setTimeout(() => {
          setFeedbackMessages((prev) => prev.filter((item) => item.id !== message.id))
        }, FEEDBACK_ANIMATION_MS)
      })
    }
  }, [game.lastLockFeedback, game.stats.level, isGameScreen, settings.sound, settings.visual.animations])

  useEffect(() => {
    if (game.lockFlashKey === 0 || !isGameScreen) {
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLockPulse(true)
    const timer = window.setTimeout(() => setLockPulse(false), BOARD_LOCK_FLASH_MS)
    return () => window.clearTimeout(timer)
  }, [game.lockFlashKey, isGameScreen])

  useEffect(() => {
    if (game.hardDropFlashKey === 0 || !isGameScreen) {
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHardDropPulse(true)
    const timer = window.setTimeout(() => setHardDropPulse(false), HARD_DROP_FLASH_MS)
    return () => window.clearTimeout(timer)
  }, [game.hardDropFlashKey, isGameScreen])

  useEffect(() => {
    if (game.gameOverFlashKey === 0 || !isGameScreen) {
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGameOverPulse(true)
    const timer = window.setTimeout(() => setGameOverPulse(false), 260)
    return () => window.clearTimeout(timer)
  }, [game.gameOverFlashKey, isGameScreen])

  useEffect(() => {
    if (!game.completedGameResult || savedResultIdRef.current === game.completedGameResult.id) {
      return
    }

    let replayId: string | null = null
    const recorder = activeReplayRef.current
    if (recorder) {
      const replay = finalizeReplay(recorder, game.completedGameResult, Date.now())
      setReplays(saveReplay(replay))
      replayId = replay.id
      activeReplayRef.current = null
    }

    setHistory(
      saveGameResult({
        ...game.completedGameResult,
        replayId,
      }),
    )
    savedResultIdRef.current = game.completedGameResult.id
  }, [game.completedGameResult])

  const playButtonClick = useCallback(() => {
    soundManager.play('buttonClick', settings.sound)
  }, [settings.sound])

  const beginClassicRun = useCallback(
    (navigateToGame: boolean) => {
      const seed = generateGameSeed()
      activeReplayRef.current = createReplayRecorder({
        mode: 'classic',
        seed,
        startLevel: settings.gameplay.startLevel,
        startedAt: Date.now(),
      })
      savedResultIdRef.current = null
      setFeedbackMessages([])
      startCoreGame(seed)
      if (navigateToGame) {
        setScreen('game')
      }
    },
    [settings.gameplay.startLevel, startCoreGame],
  )

  const dispatchGameAction = useCallback(
    (action: GameAction): boolean => {
      if (action === 'hold' && !holdEnabledInCurrentMode) {
        return false
      }

      if (activeReplayRef.current && (game.state === 'PLAYING' || action === 'pause')) {
        activeReplayRef.current = recordReplayAction(activeReplayRef.current, action, game.tick)
      }

      const handled = dispatchCoreGameAction(action)
      if (!handled) {
        return false
      }

      if (action === 'moveLeft' || action === 'moveRight') {
        soundManager.play('move', settings.sound)
      }
      if (action === 'rotateCW' || action === 'rotateCCW') {
        soundManager.play('rotate', settings.sound)
      }
      if (action === 'hold' || action === 'pause') {
        soundManager.play('buttonClick', settings.sound)
      }

      return true
    },
    [dispatchCoreGameAction, game.state, game.tick, holdEnabledInCurrentMode, settings.sound],
  )

  const handleShareResult = useCallback(() => {
    playButtonClick()
    shareResult(
      webApp,
      {
        score: game.stats.score,
        level: game.stats.level,
        lines: game.stats.lines,
        isNewRecord: game.isNewRecord,
      },
      window.location.href,
    )
  }, [game.isNewRecord, game.stats.level, game.stats.lines, game.stats.score, playButtonClick, webApp])

  const handlePlayClassic = useCallback(() => {
    playButtonClick()
    beginClassicRun(true)
  }, [beginClassicRun, playButtonClick])

  const onMoveLeft = useCallback(() => {
    dispatchGameAction('moveLeft')
  }, [dispatchGameAction])

  const onMoveRight = useCallback(() => {
    dispatchGameAction('moveRight')
  }, [dispatchGameAction])

  const onRotate = useCallback(() => {
    dispatchGameAction('rotateCW')
  }, [dispatchGameAction])

  const onSoftDrop = useCallback(() => {
    dispatchGameAction('softDrop')
  }, [dispatchGameAction])

  const onHardDrop = useCallback(() => {
    dispatchGameAction('hardDrop')
  }, [dispatchGameAction])

  const onTogglePause = useCallback(() => {
    dispatchGameAction('pause')
  }, [dispatchGameAction])

  const onStartGame = useCallback(() => {
    playButtonClick()
    beginClassicRun(false)
  }, [beginClassicRun, playButtonClick])

  const onRestartGame = useCallback(() => {
    playButtonClick()
    beginClassicRun(false)
  }, [beginClassicRun, playButtonClick])

  const onSettingsChange = useCallback((patch: Parameters<typeof updateSettings>[0]) => {
    setSettings(updateSettings(patch))
  }, [])

  const onResetKeybinds = useCallback(() => {
    setSettings(
      updateSettings({
        controls: {
          keybinds: createDefaultKeybinds(),
        },
      }),
    )
  }, [])

  const onResetAllSettings = useCallback(() => {
    setSettings(resetSettings())
  }, [])

  const onOpenHistory = useCallback(() => {
    playButtonClick()
    setScreen('history')
  }, [playButtonClick])

  const onOpenProfile = useCallback(() => {
    playButtonClick()
    setScreen('profile')
  }, [playButtonClick])

  const onOpenSkins = useCallback(() => {
    playButtonClick()
    setScreen('skins')
  }, [playButtonClick])

  const onOpenModes = useCallback(() => {
    playButtonClick()
    setScreen('modes')
  }, [playButtonClick])

  const onOpenSettings = useCallback(() => {
    playButtonClick()
    setScreen('settings')
  }, [playButtonClick])

  const onBackToMenu = useCallback(() => {
    playButtonClick()
    if (isGameScreen && game.state === 'PLAYING') {
      dispatchGameAction('pause')
    }
    setSelectedReplayId(null)
    setScreen('menu')
  }, [dispatchGameAction, game.state, isGameScreen, playButtonClick])

  const onOpenReplay = useCallback(
    (replayId: string) => {
      playButtonClick()
      setSelectedReplayId(replayId)
      setScreen('replay')
    },
    [playButtonClick],
  )

  const onBackToHistory = useCallback(() => {
    playButtonClick()
    setScreen('history')
  }, [playButtonClick])

  const onClearStoredHistory = useCallback(() => {
    clearGameHistory()
    clearReplays()
    setHistory([])
    setReplays([])
    setSelectedReplayId(null)
  }, [])

  const onSelectSkin = useCallback(
    (skinId: GameSettings['visual']['selectedSkin']) => {
      playButtonClick()
      setSettings(
        updateSettings({
          visual: {
            selectedSkin: skinId,
          },
        }),
      )
    },
    [playButtonClick],
  )

  const { bindBoardControls } = useControls({
    gameState: game.state,
    keybinds: settings.controls.keybinds,
    swipeSensitivity: settings.controls.swipeSensitivity,
    enableKeyboard: isGameScreen && settings.controls.enableKeyboard,
    enableTouchControls: isGameScreen && settings.controls.enableTouchControls,
    dispatchGameAction,
  })
  const boardControls = bindBoardControls()
  const { sectionRef, outerRef, innerRef, rowRef } = useBoardRowFit()

  const boardWrapClass = [
    styles.boardWrap,
    settings.visual.animations && lockPulse ? styles.lockPulse : '',
    settings.visual.animations && hardDropPulse ? styles.hardDropPulse : '',
    settings.visual.animations && gameOverPulse ? styles.gameOverPulse : '',
  ]
    .filter(Boolean)
    .join(' ')

  const mainClassName = [styles.main, isCenteredScreen ? styles.centerMain : ''].filter(Boolean).join(' ')

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1 className={styles.title}>TETRIS</h1>
        <p className={styles.caption}>{webApp ? 'Telegram Mini App' : 'Web mode'}</p>
      </header>

      <main className={mainClassName}>
        {screen === 'menu' ? (
          <MainMenu
            onPlay={handlePlayClassic}
            onOpenHistory={onOpenHistory}
            onOpenProfile={onOpenProfile}
            onOpenSkins={onOpenSkins}
            onOpenModes={onOpenModes}
            onOpenSettings={onOpenSettings}
          />
        ) : null}

        {screen === 'modes' ? <GameModesPanel onBack={onBackToMenu} /> : null}

        {screen === 'settings' ? (
          <section className={styles.screenPanel}>
            <div className={styles.screenPanelHeader}>
              <button type="button" className={styles.backButton} onClick={onBackToMenu}>
                Back
              </button>
            </div>
            <SettingsPanel
              settings={settings}
              onChange={onSettingsChange}
              onResetKeybinds={onResetKeybinds}
              onResetAllSettings={onResetAllSettings}
            />
          </section>
        ) : null}

        {screen === 'history' ? (
          <GameHistoryPanel
            history={history}
            availableReplayIds={availableReplayIds}
            onOpenReplay={onOpenReplay}
            onBack={onBackToMenu}
            onClearHistory={onClearStoredHistory}
          />
        ) : null}

        {screen === 'skins' ? (
          <SkinsPanel selectedSkin={settings.visual.selectedSkin} onSelectSkin={onSelectSkin} onBack={onBackToMenu} />
        ) : null}

        {screen === 'profile' ? (
          <ProfilePanel
            user={user}
            history={history}
            onOpenHistory={onOpenHistory}
            onOpenSkins={onOpenSkins}
            onBack={onBackToMenu}
          />
        ) : null}

        {screen === 'replay' ? (
          <ReplayViewer
            key={selectedReplayId ?? 'replay-missing'}
            replay={selectedReplay}
            showGrid={settings.visual.showGrid}
            blockStyle={settings.visual.blockStyle}
            pieceColors={selectedSkinPreset.pieceColors}
            ghostColor={selectedSkinPreset.ghostColor}
            onBackToHistory={onBackToHistory}
            onBackToMenu={onBackToMenu}
          />
        ) : null}

        {screen === 'game' ? (
          <>
            <section ref={sectionRef} className={styles.boardSection}>
              <div ref={outerRef} className={styles.scaleOuter}>
                <div ref={innerRef} className={styles.scaleInner}>
                  <div ref={rowRef} className={styles.boardRow}>
                    <div className={boardWrapClass}>
                      <Board
                        board={game.board}
                        activePiece={game.activePiece}
                        ghostPiece={settings.gameplay.ghostPiece ? game.ghostPiece : null}
                        lineClearRows={game.lineClearRows}
                        showGrid={settings.visual.showGrid}
                        blockStyle={settings.visual.blockStyle}
                        pieceColors={selectedSkinPreset.pieceColors}
                        ghostColor={selectedSkinPreset.ghostColor}
                        onTouchStart={boardControls.onTouchStart}
                        onTouchEnd={boardControls.onTouchEnd}
                      />
                      <GameFeedback messages={feedbackMessages} />
                      <Overlay
                        state={game.state}
                        score={game.stats.score}
                        level={game.stats.level}
                        lines={game.stats.lines}
                        isNewRecord={game.isNewRecord}
                        gameResult={game.completedGameResult}
                        onStart={onStartGame}
                        onResume={onTogglePause}
                        onRestart={onRestartGame}
                        onShare={handleShareResult}
                      />
                    </div>
                    <div className={styles.sideHud}>
                      <Stats
                        stats={game.stats}
                        gameState={game.state}
                        comboCount={game.comboCount}
                        comboGrace={game.comboGrace}
                        backToBackActive={game.backToBackActive}
                        onBackToMenu={onBackToMenu}
                        onTogglePause={onTogglePause}
                        onNewGame={onRestartGame}
                        onShareResult={handleShareResult}
                        layout="sidebar"
                      />
                      {settings.gameplay.showNextPiece ? (
                        <NextPiece
                          pieceType={game.nextPieceType}
                          pieceColors={selectedSkinPreset.pieceColors}
                          layout="sidebar"
                        />
                      ) : null}
                      {showHoldPreviewInCurrentMode ? (
                        <NextPiece
                          title="HOLD"
                          pieceType={game.heldPieceType}
                          pieceColors={selectedSkinPreset.pieceColors}
                          layout="sidebar"
                        />
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <ControlPad
              state={game.state}
              touchControlsEnabled={settings.controls.enableTouchControls}
              showHoldButton={holdEnabledInCurrentMode}
              onLeft={onMoveLeft}
              onRight={onMoveRight}
              onRotate={onRotate}
              onSoftDrop={onSoftDrop}
              onHardDrop={onHardDrop}
            />
          </>
        ) : null}
      </main>
    </div>
  )
}

export default App
