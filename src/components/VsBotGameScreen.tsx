import { useCallback, useEffect, useRef, useState } from 'react'
import { BOT_ELO_RATINGS, saveEloState, type LocalEloState, updateEloAfterMatch } from '../elo'
import { CLASSIC_MODE_CONFIG, VS_BOT_MODE_CONFIG } from '../game/modes'
import { generateGameSeed } from '../game/seededRandom'
import { useBotGame } from '../hooks/useBotGame'
import { useControls } from '../hooks/useControls'
import { useGame } from '../hooks/useGame'
import { useI18n } from '../i18n'
import { createReplayRecorder, finalizeReplay, recordReplayAction, type ReplayRecorderSession } from '../replays/recorder'
import { saveReplay } from '../replays/replayStorage'
import type { GameReplay } from '../replays/types'
import { saveGameResult } from '../settings/gameHistoryStorage'
import type {
  BotDifficulty,
  GameAction,
  GameResult,
  GameSettings,
  MatchResult,
  TetrominoType,
} from '../types'
import { Board } from './Board'
import { ControlPad } from './ControlPad'
import { NextPiece } from './NextPiece'
import styles from './VsBotGameScreen.module.css'

interface MatchSummary {
  playerScore: number
  botScore: number
  result: MatchResult
  oldElo: number
  newElo: number
  eloChange: number
  difficulty: BotDifficulty
  botRating: number
}

interface VsBotGameScreenProps {
  settings: GameSettings
  difficulty: BotDifficulty
  eloState: LocalEloState
  pieceColors: Record<TetrominoType, string>
  ghostColor: string
  onBackToMenu: () => void
  onHistoryChange: (history: GameResult[]) => void
  onReplaysChange: (replays: GameReplay[]) => void
  onEloChange: (eloState: LocalEloState) => void
  onOpenReplay: (replayId: string) => void
  onOpenAnalysis: (replayId: string) => void
}

const getDifficultyLabelKey = (difficulty: BotDifficulty) => {
  switch (difficulty) {
    case 'easy':
      return 'difficulty.easy' as const
    case 'medium':
      return 'difficulty.medium' as const
    case 'hard':
      return 'difficulty.hard' as const
    case 'expert':
      return 'difficulty.expert' as const
  }
}

const getMatchResult = (playerResult: GameResult, botResult: GameResult): MatchResult => {
  if (playerResult.score > botResult.score) {
    return 'win'
  }
  if (playerResult.score < botResult.score) {
    return 'loss'
  }
  if (playerResult.lines > botResult.lines) {
    return 'win'
  }
  if (playerResult.lines < botResult.lines) {
    return 'loss'
  }
  if (playerResult.piecesPlaced < botResult.piecesPlaced) {
    return 'win'
  }
  if (playerResult.piecesPlaced > botResult.piecesPlaced) {
    return 'loss'
  }
  return 'draw'
}

export const VsBotGameScreen = ({
  settings,
  difficulty,
  eloState,
  pieceColors,
  ghostColor,
  onBackToMenu,
  onHistoryChange,
  onReplaysChange,
  onEloChange,
  onOpenReplay,
  onOpenAnalysis,
}: VsBotGameScreenProps) => {
  const { t, formatInteger, formatDuration } = useI18n()
  const [savedReplayId, setSavedReplayId] = useState<string | null>(null)
  const [summary, setSummary] = useState<MatchSummary | null>(null)
  const [matchSeed, setMatchSeed] = useState<string | null>(null)
  const [startingElo, setStartingElo] = useState(eloState.playerRating)
  const activeReplayRef = useRef<ReplayRecorderSession | null>(null)
  const savedMatchIdRef = useRef<string | null>(null)
  const eloBeforeRef = useRef<LocalEloState>(eloState)
  const autoStartedRef = useRef(false)
  const playerGame = useGame({
    startLevel: settings.gameplay.startLevel,
    animationsEnabled: settings.visual.animations,
    mode: 'vsBot',
  })
  const botNeedsTurbo = playerGame.state === 'GAME_OVER'
  const botGame = useBotGame({
    startLevel: settings.gameplay.startLevel,
    difficulty,
    mode: 'vsBot',
    turbo: botNeedsTurbo,
  })

  const botRating = BOT_ELO_RATINGS[difficulty]

  const startMatch = useCallback(() => {
    const seed = generateGameSeed()
    eloBeforeRef.current = eloState
    setStartingElo(eloState.playerRating)
    activeReplayRef.current = createReplayRecorder({
      mode: 'vsBot',
      seed,
      startLevel: settings.gameplay.startLevel,
      startedAt: Date.now(),
    })
    savedMatchIdRef.current = null
    setSavedReplayId(null)
    setSummary(null)
    setMatchSeed(seed)
    playerGame.startGame(seed)
    botGame.startGame(seed)
  }, [botGame, eloState, playerGame, settings.gameplay.startLevel])

  useEffect(() => {
    if (autoStartedRef.current) {
      return
    }
    autoStartedRef.current = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    startMatch()
  }, [startMatch])

  useEffect(() => {
    if (!playerGame.completedGameResult || !botGame.completedGameResult) {
      return
    }
    if (savedMatchIdRef.current === playerGame.completedGameResult.id) {
      return
    }

    const matchResult = getMatchResult(playerGame.completedGameResult, botGame.completedGameResult)
    const eloUpdate = updateEloAfterMatch(eloBeforeRef.current, botRating, matchResult)
    const nextEloState = saveEloState(eloUpdate.nextState)
    onEloChange(nextEloState)

    const enrichedResult: GameResult = {
      ...playerGame.completedGameResult,
      mode: 'vsBot',
      botDifficulty: difficulty,
      botScore: botGame.completedGameResult.score,
      matchResult,
      eloBefore: eloBeforeRef.current.playerRating,
      eloAfter: nextEloState.playerRating,
      eloChange: eloUpdate.ratingChange,
      botRating,
    }

    let replayId: string | null = null
    if (activeReplayRef.current) {
      const replay = finalizeReplay(
        activeReplayRef.current,
        enrichedResult,
        Date.now(),
        playerGame.replayFrames,
        playerGame.visualReplayFrames,
        playerGame.moveReplayEvents,
      )
      const nextReplays = saveReplay(replay)
      onReplaysChange(nextReplays)
      replayId = replay.id
      setSavedReplayId(replay.id)
      activeReplayRef.current = null
    }

    const nextHistory = saveGameResult({
      ...enrichedResult,
      replayId,
    })
    onHistoryChange(nextHistory)
    savedMatchIdRef.current = playerGame.completedGameResult.id
    setSummary({
      playerScore: enrichedResult.score,
      botScore: botGame.completedGameResult.score,
      result: matchResult,
      oldElo: eloBeforeRef.current.playerRating,
      newElo: nextEloState.playerRating,
      eloChange: eloUpdate.ratingChange,
      difficulty,
      botRating,
    })
  }, [
    botGame.completedGameResult,
    botRating,
    difficulty,
    onEloChange,
    onHistoryChange,
    onReplaysChange,
    playerGame.completedGameResult,
    playerGame.moveReplayEvents,
    playerGame.replayFrames,
    playerGame.visualReplayFrames,
  ])

  useEffect(() => {
    if (!playerGame.completedGameResult || botGame.completedGameResult) {
      return
    }

    if (botGame.stats.score > playerGame.completedGameResult.score) {
      botGame.forceComplete()
    }
  }, [botGame, playerGame.completedGameResult])

  const dispatchPlayerAction = useCallback(
    (action: GameAction) => {
      if (action === 'hold' && !VS_BOT_MODE_CONFIG.enableHold) {
        return false
      }

      if (activeReplayRef.current && (playerGame.state === 'PLAYING' || action === 'pause')) {
        activeReplayRef.current = recordReplayAction(activeReplayRef.current, action, playerGame.tick)
      }

      return playerGame.dispatchGameAction(action)
    },
    [playerGame],
  )

  const handlePauseMatch = useCallback(() => {
    playerGame.togglePause()
    botGame.togglePause()
  }, [botGame, playerGame])

  const { bindBoardControls } = useControls({
    gameState: playerGame.state,
    keybinds: settings.controls.keybinds,
    swipeSensitivity: settings.controls.swipeSensitivity,
    enableKeyboard: settings.controls.enableKeyboard,
    enableTouchControls: settings.controls.enableTouchControls,
    dispatchGameAction: dispatchPlayerAction,
  })

  const boardControls = bindBoardControls()
  const isPaused = playerGame.state === 'PAUSED'
  const isMatchFinished = playerGame.state === 'GAME_OVER' && botGame.state === 'GAME_OVER'
  const isBotFinishing = playerGame.state === 'GAME_OVER' && botGame.state !== 'GAME_OVER'
  const pauseLabel = isPaused ? t('vsBot.resumeMatch') : t('vsBot.pauseMatch')

  const statusLabel = isMatchFinished
    ? t('vsBot.matchFinished')
    : isBotFinishing
      ? t('vsBot.botFinishing')
      : t('vsBot.matchRunning')

  return (
    <section className={styles.wrapper}>
      <div className={styles.topBar}>
        <div>
          <h2 className={styles.title}>{t('vsBot.title')}</h2>
          <p className={styles.subtitle}>
            {t('vsBot.modeLabel')} · {t('vsBot.difficulty')}: {t(getDifficultyLabelKey(difficulty))}
          </p>
        </div>
        <div className={styles.topActions}>
          <button type="button" className={styles.secondaryButton} onClick={handlePauseMatch} disabled={isMatchFinished}>
            {pauseLabel}
          </button>
          <button type="button" className={styles.secondaryButton} onClick={onBackToMenu}>
            {t('common.backToMenu')}
          </button>
        </div>
      </div>

      <div className={styles.badgeRow}>
        <span className={styles.badge}>
          {t('vsBot.currentElo')}: {formatInteger(startingElo)}
        </span>
        <span className={styles.badge}>
          {t('vsBot.botElo')}: {formatInteger(botRating)}
        </span>
        <span className={styles.badge}>
          {t('vsBot.botSpeed')}: {botGame.speedMs} ms
        </span>
        <span className={styles.badge}>{statusLabel}</span>
        {matchSeed ? <span className={styles.badge}>{t('common.seed')}: {matchSeed}</span> : null}
      </div>

      <div className={styles.boardGrid}>
        <article className={styles.boardCard}>
          <div className={styles.boardHeader}>
            <h3 className={styles.boardTitle}>{t('vsBot.playerBoard')}</h3>
          </div>
          <div className={styles.boardWrap}>
            <Board
              board={playerGame.board}
              activePiece={playerGame.activePiece}
              ghostPiece={settings.gameplay.ghostPiece ? playerGame.ghostPiece : null}
              lineClearRows={playerGame.lineClearRows}
              showGrid={settings.visual.showGrid}
              blockStyle={settings.visual.blockStyle}
              pieceColors={pieceColors}
              ghostColor={ghostColor}
              onTouchStart={boardControls.onTouchStart}
              onTouchEnd={boardControls.onTouchEnd}
            />
          </div>
          <NextPiece pieceType={playerGame.nextPieceType} pieceColors={pieceColors} />
          <dl className={styles.statsGrid}>
            <div className={styles.statItem}>
              <dt>{t('common.score')}</dt>
              <dd>{formatInteger(playerGame.stats.score)}</dd>
            </div>
            <div className={styles.statItem}>
              <dt>{t('common.lines')}</dt>
              <dd>{formatInteger(playerGame.stats.lines)}</dd>
            </div>
            <div className={styles.statItem}>
              <dt>{t('common.level')}</dt>
              <dd>{formatInteger(playerGame.stats.level)}</dd>
            </div>
            <div className={styles.statItem}>
              <dt>{t('common.pieces')}</dt>
              <dd>{formatInteger(playerGame.stats.piecesPlaced)}</dd>
            </div>
          </dl>
        </article>

        <article className={styles.boardCard}>
          <div className={styles.boardHeader}>
            <h3 className={styles.boardTitle}>{t('vsBot.botBoard')}</h3>
          </div>
          <div className={styles.boardWrap}>
            <Board
              board={botGame.board}
              activePiece={botGame.activePiece}
              ghostPiece={settings.gameplay.ghostPiece ? botGame.ghostPiece : null}
              lineClearRows={[]}
              showGrid={settings.visual.showGrid}
              blockStyle={settings.visual.blockStyle}
              pieceColors={pieceColors}
              ghostColor={ghostColor}
            />
          </div>
          <NextPiece pieceType={botGame.nextPieceType} pieceColors={pieceColors} />
          <dl className={styles.statsGrid}>
            <div className={styles.statItem}>
              <dt>{t('common.score')}</dt>
              <dd>{formatInteger(botGame.stats.score)}</dd>
            </div>
            <div className={styles.statItem}>
              <dt>{t('common.lines')}</dt>
              <dd>{formatInteger(botGame.stats.lines)}</dd>
            </div>
            <div className={styles.statItem}>
              <dt>{t('common.level')}</dt>
              <dd>{formatInteger(botGame.stats.level)}</dd>
            </div>
            <div className={styles.statItem}>
              <dt>{t('common.pieces')}</dt>
              <dd>{formatInteger(botGame.stats.piecesPlaced)}</dd>
            </div>
          </dl>
        </article>
      </div>

      {summary ? (
        <section className={styles.summaryCard}>
          <div className={styles.summaryHeader}>
            <div>
              <h3 className={styles.summaryTitle}>{t('vsBot.matchFinished')}</h3>
              <p className={styles.summaryText}>
                {t('vsBot.result')}: {t(`vsBot.result.${summary.result}` as const)}
              </p>
            </div>
            <span className={styles.resultBadge}>{t(`vsBot.result.${summary.result}` as const)}</span>
          </div>
          <dl className={styles.summaryGrid}>
            <div className={styles.statItem}>
              <dt>{t('common.score')}</dt>
              <dd>{formatInteger(summary.playerScore)}</dd>
            </div>
            <div className={styles.statItem}>
              <dt>{t('vsBot.botScore')}</dt>
              <dd>{formatInteger(summary.botScore)}</dd>
            </div>
            <div className={styles.statItem}>
              <dt>{t('vsBot.oldElo')}</dt>
              <dd>{formatInteger(summary.oldElo)}</dd>
            </div>
            <div className={styles.statItem}>
              <dt>{t('vsBot.newElo')}</dt>
              <dd>{formatInteger(summary.newElo)}</dd>
            </div>
            <div className={styles.statItem}>
              <dt>{t('vsBot.eloChange')}</dt>
              <dd>{`${summary.eloChange > 0 ? '+' : ''}${formatInteger(summary.eloChange)}`}</dd>
            </div>
            <div className={styles.statItem}>
              <dt>{t('vsBot.difficulty')}</dt>
              <dd>{t(getDifficultyLabelKey(summary.difficulty))}</dd>
            </div>
          </dl>
          <div className={styles.summaryActions}>
            <button type="button" className={styles.primaryButton} onClick={startMatch}>
              {t('vsBot.rematch')}
            </button>
            {savedReplayId ? (
              <button type="button" className={styles.secondaryButton} onClick={() => onOpenReplay(savedReplayId)}>
                {t('common.replay')}
              </button>
            ) : null}
            {savedReplayId ? (
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => onOpenAnalysis(savedReplayId)}
              >
                {t('vsBot.openAnalysis')}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      <ControlPad
        state={playerGame.state}
        touchControlsEnabled={settings.controls.enableTouchControls}
        showHoldButton={CLASSIC_MODE_CONFIG.enableHold}
        onLeft={() => dispatchPlayerAction('moveLeft')}
        onRight={() => dispatchPlayerAction('moveRight')}
        onRotate={() => dispatchPlayerAction('rotateCW')}
        onSoftDrop={() => dispatchPlayerAction('softDrop')}
        onHardDrop={() => dispatchPlayerAction('hardDrop')}
      />

      {!summary ? (
        <div className={styles.footerNote}>
          {playerGame.state === 'GAME_OVER' && botGame.state !== 'GAME_OVER'
            ? t('vsBot.botFinishing')
            : `${t('common.time')}: ${formatDuration(Math.max(playerGame.stats.timePlayedMs, botGame.stats.timePlayedMs))}`}
        </div>
      ) : null}
    </section>
  )
}
