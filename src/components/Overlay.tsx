import { calculateGameRating, formatAveragePieceTime, formatDuration } from '../game/results'
import type { GameResult, GameState } from '../types'
import styles from './Overlay.module.css'

interface OverlayProps {
  state: GameState
  score: number
  level: number
  lines: number
  isNewRecord: boolean
  gameResult: GameResult | null
  analysisAvailable?: boolean
  onStart: () => void
  onResume: () => void
  onRestart: () => void
  onShare: () => void
  onOpenAnalysis?: () => void
}

export const Overlay = ({
  state,
  score,
  level,
  lines,
  isNewRecord,
  gameResult,
  analysisAvailable = false,
  onStart,
  onResume,
  onRestart,
  onShare,
  onOpenAnalysis,
}: OverlayProps) => {
  if (state === 'PLAYING') {
    return null
  }

  if (state === 'START') {
    return (
      <div className={styles.overlay}>
        <h2 className={styles.title}>Ready?</h2>
        <p className={styles.text}>Tap to rotate, swipe to move, and open Settings to tune controls and keybinds.</p>
        <button type="button" className={styles.primary} onClick={onStart}>
          Start game
        </button>
      </div>
    )
  }

  if (state === 'PAUSED') {
    return (
      <div className={styles.overlay}>
        <h2 className={styles.title}>Paused</h2>
        <div className={styles.buttonRow}>
          <button type="button" className={styles.primary} onClick={onResume}>
            Resume
          </button>
          <button type="button" className={styles.secondary} onClick={onRestart}>
            New game
          </button>
        </div>
      </div>
    )
  }

  const rating = gameResult ? calculateGameRating(gameResult) : 0

  return (
    <div className={styles.overlay}>
      <h2 className={styles.title}>Game over</h2>
      <p className={styles.text}>Score: {score}</p>
      <p className={styles.text}>
        Level: {level} • Lines: {lines}
      </p>
      {isNewRecord ? <p className={styles.text}>New high score!</p> : null}
      {gameResult ? (
        <>
          <dl className={styles.statsGrid}>
            <div className={styles.statRow}>
              <dt>Pieces</dt>
              <dd>{gameResult.piecesPlaced}</dd>
            </div>
            <div className={styles.statRow}>
              <dt>Time</dt>
              <dd>{formatDuration(gameResult.timePlayedMs)}</dd>
            </div>
            <div className={styles.statRow}>
              <dt>Tetrises</dt>
              <dd>{gameResult.tetrises}</dd>
            </div>
            <div className={styles.statRow}>
              <dt>Max combo</dt>
              <dd>{gameResult.maxCombo}</dd>
            </div>
            <div className={styles.statRow}>
              <dt>Avg / piece</dt>
              <dd>{formatAveragePieceTime(gameResult.averageTimePerPieceMs)}</dd>
            </div>
            <div className={styles.statRow}>
              <dt>Rating</dt>
              <dd>{rating}</dd>
            </div>
            <div className={styles.statRow}>
              <dt>Grade</dt>
              <dd>{gameResult.grade}</dd>
            </div>
            <div className={styles.statRow}>
              <dt>Holes</dt>
              <dd>{gameResult.holesCreated}</dd>
            </div>
          </dl>
          <p className={styles.meta}>Mode: {gameResult.mode} • Seed: {gameResult.seed}</p>
        </>
      ) : null}
      <div className={styles.buttonRow}>
        <button type="button" className={styles.primary} onClick={onRestart}>
          Try again
        </button>
        <button type="button" className={styles.secondary} onClick={onShare}>
          Share result
        </button>
        {analysisAvailable && onOpenAnalysis ? (
          <button type="button" className={styles.secondary} onClick={onOpenAnalysis}>
            Разбор партии
          </button>
        ) : null}
      </div>
    </div>
  )
}
