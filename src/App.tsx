import { useCallback, useEffect, useMemo, useState } from 'react'
import { useBoardRowFit } from './hooks/useBoardRowFit'
import { FEEDBACK_ANIMATION_MS, BOARD_LOCK_FLASH_MS, HARD_DROP_FLASH_MS } from './animations/constants'
import { Board } from './components/Board'
import { useControls } from './hooks/useControls'
import { useGame } from './hooks/useGame'
import { useTelegram } from './hooks/useTelegram'
import { ControlPad } from './components/ControlPad'
import { GameFeedback } from './components/GameFeedback'
import { NextPiece } from './components/NextPiece'
import { Overlay } from './components/Overlay'
import { SettingsPanel } from './components/SettingsPanel'
import { Stats } from './components/Stats'
import { createDefaultKeybinds } from './settings/keybinds'
import { loadSettings, resetSettings, updateSettings } from './settings/storage'
import { soundManager } from './sound/manager'
import { applyThemePreset } from './theme/applyTheme'
import { getThemePreset } from './theme/presets'
import type { GameAction, GameSettings } from './types'
import { shareResult } from './utils/share'
import styles from './App.module.css'

function App() {
  const { webApp } = useTelegram()
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings())
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
  const dispatchCoreGameAction = game.dispatchGameAction
  const startCoreGame = game.startGame
  const restartCoreGame = game.restartGame

  const themePreset = useMemo(() => getThemePreset(settings.visual.theme), [settings.visual.theme])

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

    if (messages.length > 0 && settings.visual.animations) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFeedbackMessages((prev) => [...prev, ...messages])
      messages.forEach((message) => {
        window.setTimeout(() => {
          setFeedbackMessages((prev) => prev.filter((item) => item.id !== message.id))
        }, FEEDBACK_ANIMATION_MS)
      })
    }
  }, [game.lastLockFeedback, game.stats.level, settings.sound, settings.visual.animations])

  useEffect(() => {
    if (game.lockFlashKey === 0) {
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLockPulse(true)
    const timer = window.setTimeout(() => setLockPulse(false), BOARD_LOCK_FLASH_MS)
    return () => window.clearTimeout(timer)
  }, [game.lockFlashKey])

  useEffect(() => {
    if (game.hardDropFlashKey === 0) {
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHardDropPulse(true)
    const timer = window.setTimeout(() => setHardDropPulse(false), HARD_DROP_FLASH_MS)
    return () => window.clearTimeout(timer)
  }, [game.hardDropFlashKey])

  useEffect(() => {
    if (game.gameOverFlashKey === 0) {
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGameOverPulse(true)
    const timer = window.setTimeout(() => setGameOverPulse(false), 260)
    return () => window.clearTimeout(timer)
  }, [game.gameOverFlashKey])

  const playButtonClick = useCallback(() => {
    soundManager.play('buttonClick', settings.sound)
  }, [settings.sound])

  const dispatchGameAction = useCallback(
    (action: GameAction): boolean => {
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
    [dispatchCoreGameAction, settings.sound],
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

  const onHold = useCallback(() => {
    dispatchGameAction('hold')
  }, [dispatchGameAction])

  const onTogglePause = useCallback(() => {
    dispatchGameAction('pause')
  }, [dispatchGameAction])

  const onStartGame = useCallback(() => {
    playButtonClick()
    setFeedbackMessages([])
    startCoreGame()
  }, [playButtonClick, startCoreGame])

  const onRestartGame = useCallback(() => {
    playButtonClick()
    setFeedbackMessages([])
    restartCoreGame()
  }, [playButtonClick, restartCoreGame])

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

  const { bindBoardControls } = useControls({
    gameState: game.state,
    keybinds: settings.controls.keybinds,
    swipeSensitivity: settings.controls.swipeSensitivity,
    enableKeyboard: settings.controls.enableKeyboard,
    enableTouchControls: settings.controls.enableTouchControls,
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

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1 className={styles.title}>TETRIS</h1>
        <p className={styles.caption}>{webApp ? 'Telegram Mini App' : 'Web mode'}</p>
      </header>

      <main className={styles.main}>
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
                    pieceColors={themePreset.pieceColors}
                    ghostColor={themePreset.ghostColor}
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
                    onTogglePause={onTogglePause}
                    onNewGame={onRestartGame}
                    onShareResult={handleShareResult}
                    layout="sidebar"
                  />
                  {settings.gameplay.showHoldPiece ? (
                    <NextPiece
                      title="HOLD"
                      pieceType={game.heldPieceType}
                      pieceColors={themePreset.pieceColors}
                      layout="sidebar"
                    />
                  ) : null}
                  {settings.gameplay.showNextPiece ? (
                    <NextPiece pieceType={game.nextPieceType} pieceColors={themePreset.pieceColors} layout="sidebar" />
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>

        <ControlPad
          state={game.state}
          touchControlsEnabled={settings.controls.enableTouchControls}
          onLeft={onMoveLeft}
          onRight={onMoveRight}
          onRotate={onRotate}
          onSoftDrop={onSoftDrop}
          onHardDrop={onHardDrop}
          onHold={onHold}
        />

        <SettingsPanel
          settings={settings}
          onChange={onSettingsChange}
          onResetKeybinds={onResetKeybinds}
          onResetAllSettings={onResetAllSettings}
        />
      </main>
    </div>
  )
}

export default App
