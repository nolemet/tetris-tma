import type { TouchEvent } from 'react'
import { useI18n } from '../i18n'
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
  const { t, formatInteger } = useI18n()
  const pauseDisabled = gameState === 'START' || gameState === 'GAME_OVER'
  const shareDisabled = gameState !== 'GAME_OVER'
  const pauseLabel = gameState === 'PAUSED' ? t('common.resume') : t('common.pause')
  const stopTouchPropagation = (event: TouchEvent<HTMLElement>) => {
    event.stopPropagation()
  }

  const sectionClass = [styles.card, layout === 'sidebar' ? styles.sidebar : ''].filter(Boolean).join(' ')

  return (
    <section className={sectionClass} onTouchStart={stopTouchPropagation} onTouchEnd={stopTouchPropagation}>
      <h2 className={styles.title}>{t('game.stats')}</h2>
      <dl className={styles.list}>
        <div className={styles.row}>
          <dt>{t('common.score')}</dt>
          <dd>{formatInteger(stats.score)}</dd>
        </div>
        <div className={styles.row}>
          <dt>{t('common.level')}</dt>
          <dd>{formatInteger(stats.level)}</dd>
        </div>
        <div className={styles.row}>
          <dt>{t('common.lines')}</dt>
          <dd>{formatInteger(stats.lines)}</dd>
        </div>
        <div className={styles.row}>
          <dt>{t('game.highScore')}</dt>
          <dd>{formatInteger(stats.highScore)}</dd>
        </div>
        <div className={styles.row}>
          <dt>{t('game.combo')}</dt>
          <dd>{comboCount > 0 ? `x${formatInteger(comboCount)}` : '-'}</dd>
        </div>
        <div className={styles.row}>
          <dt>{t('game.comboGrace')}</dt>
          <dd>{comboCount > 0 ? `${formatInteger(comboGrace)}/3` : '-'}</dd>
        </div>
        <div className={styles.row}>
          <dt>{t('game.backToBack')}</dt>
          <dd>{backToBackActive ? t('game.active') : '-'}</dd>
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
          {t('common.newGame')}
        </button>
        <button
          type="button"
          className={styles.actionButton}
          onClick={onShareResult}
          disabled={shareDisabled}
          onTouchStart={stopTouchPropagation}
          onTouchEnd={stopTouchPropagation}
        >
          {t('overlay.shareResult')}
        </button>
        <button
          type="button"
          className={styles.secondaryActionButton}
          onClick={onBackToMenu}
          onTouchStart={stopTouchPropagation}
          onTouchEnd={stopTouchPropagation}
        >
          {t('common.menu')}
        </button>
      </div>
    </section>
  )
}
