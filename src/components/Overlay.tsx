import { calculateGameRating, formatAveragePieceTime } from '../game/results'
import { useI18n } from '../i18n'
import type { GameMode, GameResult, GameState } from '../types'
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

const getModeLabelKey = (mode: GameMode) => {
  return mode === 'vsBot' ? ('mode.vsBot' as const) : ('mode.classic' as const)
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
  const { t, formatInteger, formatDuration } = useI18n()

  if (state === 'PLAYING') {
    return null
  }

  if (state === 'START') {
    return (
      <div className={styles.overlay}>
        <h2 className={styles.title}>{t('overlay.readyTitle')}</h2>
        <p className={styles.text}>{t('overlay.readyText')}</p>
        <button type="button" className={styles.primary} onClick={onStart}>
          {t('overlay.startGame')}
        </button>
      </div>
    )
  }

  if (state === 'PAUSED') {
    return (
      <div className={styles.overlay}>
        <h2 className={styles.title}>{t('overlay.paused')}</h2>
        <div className={styles.buttonRow}>
          <button type="button" className={styles.primary} onClick={onResume}>
            {t('common.resume')}
          </button>
          <button type="button" className={styles.secondary} onClick={onRestart}>
            {t('common.newGame')}
          </button>
        </div>
      </div>
    )
  }

  const rating = gameResult ? calculateGameRating(gameResult) : 0

  return (
    <div className={styles.overlay}>
      <h2 className={styles.title}>{t('overlay.gameOver')}</h2>
      <p className={styles.text}>{t('common.score')}: {formatInteger(score)}</p>
      <p className={styles.text}>
        {t('common.level')}: {formatInteger(level)} · {t('common.lines')}: {formatInteger(lines)}
      </p>
      {isNewRecord ? <p className={styles.text}>{t('overlay.newHighScore')}</p> : null}
      {gameResult ? (
        <>
          <dl className={styles.statsGrid}>
            <div className={styles.statRow}>
              <dt>{t('common.pieces')}</dt>
              <dd>{formatInteger(gameResult.piecesPlaced)}</dd>
            </div>
            <div className={styles.statRow}>
              <dt>{t('common.time')}</dt>
              <dd>{formatDuration(gameResult.timePlayedMs)}</dd>
            </div>
            <div className={styles.statRow}>
              <dt>{t('common.tetrises')}</dt>
              <dd>{formatInteger(gameResult.tetrises)}</dd>
            </div>
            <div className={styles.statRow}>
              <dt>{t('overlay.maxCombo')}</dt>
              <dd>{formatInteger(gameResult.maxCombo)}</dd>
            </div>
            <div className={styles.statRow}>
              <dt>{t('overlay.avgPerPiece')}</dt>
              <dd>{formatAveragePieceTime(gameResult.averageTimePerPieceMs)}</dd>
            </div>
            <div className={styles.statRow}>
              <dt>{t('common.rating')}</dt>
              <dd>{formatInteger(rating)}</dd>
            </div>
            <div className={styles.statRow}>
              <dt>{t('common.grade')}</dt>
              <dd>{gameResult.grade}</dd>
            </div>
            <div className={styles.statRow}>
              <dt>{t('overlay.holes')}</dt>
              <dd>{formatInteger(gameResult.holesCreated)}</dd>
            </div>
          </dl>
          <p className={styles.meta}>
            {t('common.mode')}: {t(getModeLabelKey(gameResult.mode))} · {t('common.seed')}: {gameResult.seed}
          </p>
        </>
      ) : null}
      <div className={styles.buttonRow}>
        <button type="button" className={styles.primary} onClick={onRestart}>
          {t('overlay.tryAgain')}
        </button>
        <button type="button" className={styles.secondary} onClick={onShare}>
          {t('overlay.shareResult')}
        </button>
        {analysisAvailable && onOpenAnalysis ? (
          <button type="button" className={styles.secondary} onClick={onOpenAnalysis}>
            {t('overlay.gameAnalysis')}
          </button>
        ) : null}
      </div>
    </div>
  )
}
