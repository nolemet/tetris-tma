import type { TouchEvent } from 'react'
import type { GameState, GameStats } from '../types'
import styles from './Stats.module.css'

interface StatsProps {
  stats: GameStats
  gameState: GameState
  comboCount: number
  comboGrace: number
  backToBackActive: boolean
  onBackToMenu: () => void
  onTogglePause: () => void
  onNewGame: () => void
  onShareResult: () => void
  layout?: 'stacked' | 'sidebar'
}

export const Stats = ({
  stats,
  gameState,
  comboCount,
  comboGrace,
  backToBackActive,
  onBackToMenu,
  onTogglePause,
  onNewGame,
  onShareResult,
  layout = 'stacked',
}: StatsProps) => {
  const pauseDisabled = gameState === 'START' || gameState === 'GAME_OVER'
  const shareDisabled = gameState !== 'GAME_OVER'
  const pauseLabel = gameState === 'PAUSED' ? 'Resume' : 'Pause'
  const stopTouchPropagation = (event: TouchEvent<HTMLElement>) => {
    event.stopPropagation()
  }

  const sectionClass = [styles.card, layout === 'sidebar' ? styles.sidebar : ''].filter(Boolean).join(' ')

  return (
    <section className={sectionClass} onTouchStart={stopTouchPropagation} onTouchEnd={stopTouchPropagation}>
      <h2 className={styles.title}>STATS</h2>
      <dl className={styles.list}>
        <div className={styles.row}>
          <dt>Score</dt>
          <dd>{stats.score}</dd>
        </div>
        <div className={styles.row}>
          <dt>Level</dt>
          <dd>{stats.level}</dd>
        </div>
        <div className={styles.row}>
          <dt>Lines</dt>
          <dd>{stats.lines}</dd>
        </div>
        <div className={styles.row}>
          <dt>High score</dt>
          <dd>{stats.highScore}</dd>
        </div>
        <div className={styles.row}>
          <dt>Combo</dt>
          <dd>{comboCount > 0 ? `x${comboCount}` : '-'}</dd>
        </div>
        <div className={styles.row}>
          <dt>Combo grace</dt>
          <dd>{comboCount > 0 ? `${comboGrace}/3` : '-'}</dd>
        </div>
        <div className={styles.row}>
          <dt>Back-to-back</dt>
          <dd>{backToBackActive ? 'Active' : '-'}</dd>
        </div>
      </dl>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.actionButton}
          onClick={onTogglePause}
          disabled={pauseDisabled}
          onTouchStart={stopTouchPropagation}
          onTouchEnd={stopTouchPropagation}
        >
          {pauseLabel}
        </button>
        <button
          type="button"
          className={styles.actionButton}
          onClick={onNewGame}
          onTouchStart={stopTouchPropagation}
          onTouchEnd={stopTouchPropagation}
        >
          New game
        </button>
        <button
          type="button"
          className={styles.actionButton}
          onClick={onShareResult}
          disabled={shareDisabled}
          onTouchStart={stopTouchPropagation}
          onTouchEnd={stopTouchPropagation}
        >
          Share result
        </button>
        <button
          type="button"
          className={styles.secondaryActionButton}
          onClick={onBackToMenu}
          onTouchStart={stopTouchPropagation}
          onTouchEnd={stopTouchPropagation}
        >
          Menu
        </button>
      </div>
    </section>
  )
}
