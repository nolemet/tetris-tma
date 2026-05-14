import type { LocalEloState } from '../elo'
import { useI18n } from '../i18n'
import type { GameResult } from '../types'
import type { TelegramWebAppUser } from '../types/telegram'
import styles from './ProfilePanel.module.css'

interface ProfilePanelProps {
  user: TelegramWebAppUser | null
  history: GameResult[]
  eloState: LocalEloState
  onOpenHistory: () => void
  onOpenSkins: () => void
  onBack: () => void
}

const GRADE_ORDER = ['S', 'A', 'B', 'C', 'D'] as const

const getBestGrade = (history: GameResult[]): GameResult['grade'] | null => {
  return history.reduce<GameResult['grade'] | null>((best, item) => {
    if (!best) {
      return item.grade
    }

    return GRADE_ORDER.indexOf(item.grade) < GRADE_ORDER.indexOf(best) ? item.grade : best
  }, null)
}

export const ProfilePanel = ({ user, history, eloState, onOpenHistory, onOpenSkins, onBack }: ProfilePanelProps) => {
  const { t, formatInteger, formatDuration, formatDateTime, formatPercent } = useI18n()
  const totalGames = history.length
  const highScore = history.reduce((best, item) => Math.max(best, item.score), 0)
  const bestRating = history.reduce((best, item) => Math.max(best, item.rating), 0)
  const totalLines = history.reduce((sum, item) => sum + item.lines, 0)
  const totalPieces = history.reduce((sum, item) => sum + item.piecesPlaced, 0)
  const totalTetrises = history.reduce((sum, item) => sum + item.tetrises, 0)
  const bestCombo = history.reduce((best, item) => Math.max(best, item.maxCombo), 0)
  const averageScore = totalGames > 0 ? Math.round(history.reduce((sum, item) => sum + item.score, 0) / totalGames) : 0
  const totalTimePlayed = history.reduce((sum, item) => sum + item.timePlayedMs, 0)
  const bestGrade = getBestGrade(history)
  const lastPlayedAt = history[0]?.endedAt ?? null
  const winRate = eloState.gamesPlayed > 0 ? (eloState.wins / eloState.gamesPlayed) * 100 : 0

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>{t('profile.title')}</h2>
          <p className={styles.subtitle}>{t('profile.localOnly')}</p>
        </div>
        <button type="button" className={styles.backButton} onClick={onBack}>
          {t('common.back')}
        </button>
      </div>

      <div className={styles.identity}>
        <div className={styles.avatar}>{user?.first_name?.slice(0, 1).toUpperCase() ?? 'W'}</div>
        <div>
          <h3 className={styles.identityName}>{user ? `${user.first_name} ${user.last_name ?? ''}`.trim() : t('profile.webPlayer')}</h3>
          <p className={styles.identityMeta}>
            {user?.username ? `@${user.username} · ${t('profile.telegramMode')}` : user ? t('profile.telegramMode') : t('profile.webMode')}
          </p>
        </div>
      </div>

      {totalGames === 0 ? (
        <div className={styles.emptyState}>{t('profile.empty')}</div>
      ) : (
        <dl className={styles.grid}>
          <div className={styles.stat}>
            <dt>{t('profile.totalGames')}</dt>
            <dd>{formatInteger(totalGames)}</dd>
          </div>
          <div className={styles.stat}>
            <dt>{t('profile.highScore')}</dt>
            <dd>{formatInteger(highScore)}</dd>
          </div>
          <div className={styles.stat}>
            <dt>{t('profile.bestGrade')}</dt>
            <dd>{bestGrade ?? '-'}</dd>
          </div>
          <div className={styles.stat}>
            <dt>{t('profile.bestRating')}</dt>
            <dd>{formatInteger(bestRating)}</dd>
          </div>
          <div className={styles.stat}>
            <dt>{t('profile.totalLines')}</dt>
            <dd>{formatInteger(totalLines)}</dd>
          </div>
          <div className={styles.stat}>
            <dt>{t('profile.totalPieces')}</dt>
            <dd>{formatInteger(totalPieces)}</dd>
          </div>
          <div className={styles.stat}>
            <dt>{t('profile.totalTetrises')}</dt>
            <dd>{formatInteger(totalTetrises)}</dd>
          </div>
          <div className={styles.stat}>
            <dt>{t('profile.bestCombo')}</dt>
            <dd>{formatInteger(bestCombo)}</dd>
          </div>
          <div className={styles.stat}>
            <dt>{t('profile.averageScore')}</dt>
            <dd>{formatInteger(averageScore)}</dd>
          </div>
          <div className={styles.stat}>
            <dt>{t('profile.totalTimePlayed')}</dt>
            <dd>{formatDuration(totalTimePlayed)}</dd>
          </div>
          <div className={styles.statWide}>
            <dt>{t('profile.lastPlayed')}</dt>
            <dd>{lastPlayedAt ? formatDateTime(lastPlayedAt) : '-'}</dd>
          </div>
        </dl>
      )}

      <section className={styles.eloCard}>
        <h3 className={styles.eloTitle}>{t('profile.eloTitle')}</h3>
        <dl className={styles.eloGrid}>
          <div className={styles.stat}>
            <dt>{t('profile.currentElo')}</dt>
            <dd>{formatInteger(eloState.playerRating)}</dd>
          </div>
          <div className={styles.stat}>
            <dt>{t('profile.peakElo')}</dt>
            <dd>{formatInteger(eloState.peakRating)}</dd>
          </div>
          <div className={styles.stat}>
            <dt>{t('profile.vsBotGames')}</dt>
            <dd>{formatInteger(eloState.gamesPlayed)}</dd>
          </div>
          <div className={styles.stat}>
            <dt>{t('profile.wins')}</dt>
            <dd>{formatInteger(eloState.wins)}</dd>
          </div>
          <div className={styles.stat}>
            <dt>{t('profile.losses')}</dt>
            <dd>{formatInteger(eloState.losses)}</dd>
          </div>
          <div className={styles.stat}>
            <dt>{t('profile.draws')}</dt>
            <dd>{formatInteger(eloState.draws)}</dd>
          </div>
          <div className={styles.statWide}>
            <dt>{t('profile.winRate')}</dt>
            <dd>{formatPercent(winRate)}</dd>
          </div>
        </dl>
      </section>

      <div className={styles.actions}>
        <button type="button" className={styles.primaryButton} onClick={onOpenHistory}>
          {t('mainMenu.history')}
        </button>
        <button type="button" className={styles.secondaryButton} onClick={onOpenSkins}>
          {t('mainMenu.skins')}
        </button>
      </div>
    </section>
  )
}
