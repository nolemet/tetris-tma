import { formatDuration } from '../game/results'
import type { GameResult } from '../types'
import type { TelegramWebAppUser } from '../types/telegram'
import styles from './ProfilePanel.module.css'

interface ProfilePanelProps {
  user: TelegramWebAppUser | null
  history: GameResult[]
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

export const ProfilePanel = ({ user, history, onOpenHistory, onOpenSkins, onBack }: ProfilePanelProps) => {
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

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Профиль игрока</h2>
          <p className={styles.subtitle}>Profile stats are stored locally on this device.</p>
        </div>
        <button type="button" className={styles.backButton} onClick={onBack}>
          Назад
        </button>
      </div>

      <div className={styles.identity}>
        <div className={styles.avatar}>{user?.first_name?.slice(0, 1).toUpperCase() ?? 'W'}</div>
        <div>
          <h3 className={styles.identityName}>{user ? `${user.first_name} ${user.last_name ?? ''}`.trim() : 'Web player'}</h3>
          <p className={styles.identityMeta}>
            {user?.username ? `@${user.username} • Telegram mode` : user ? 'Telegram mode' : 'Web mode'}
          </p>
        </div>
      </div>

      {totalGames === 0 ? (
        <div className={styles.emptyState}>Пока нет сыгранных игр</div>
      ) : (
        <dl className={styles.grid}>
          <div className={styles.stat}>
            <dt>Total games</dt>
            <dd>{totalGames}</dd>
          </div>
          <div className={styles.stat}>
            <dt>High score</dt>
            <dd>{highScore}</dd>
          </div>
          <div className={styles.stat}>
            <dt>Best grade</dt>
            <dd>{bestGrade ?? '-'}</dd>
          </div>
          <div className={styles.stat}>
            <dt>Best rating</dt>
            <dd>{bestRating}</dd>
          </div>
          <div className={styles.stat}>
            <dt>Total lines</dt>
            <dd>{totalLines}</dd>
          </div>
          <div className={styles.stat}>
            <dt>Total pieces</dt>
            <dd>{totalPieces}</dd>
          </div>
          <div className={styles.stat}>
            <dt>Total tetrises</dt>
            <dd>{totalTetrises}</dd>
          </div>
          <div className={styles.stat}>
            <dt>Best combo</dt>
            <dd>{bestCombo}</dd>
          </div>
          <div className={styles.stat}>
            <dt>Average score</dt>
            <dd>{averageScore}</dd>
          </div>
          <div className={styles.stat}>
            <dt>Total time played</dt>
            <dd>{formatDuration(totalTimePlayed)}</dd>
          </div>
          <div className={styles.statWide}>
            <dt>Last played</dt>
            <dd>{lastPlayedAt ? new Date(lastPlayedAt).toLocaleString() : '-'}</dd>
          </div>
        </dl>
      )}

      <div className={styles.actions}>
        <button type="button" className={styles.primaryButton} onClick={onOpenHistory}>
          История игр
        </button>
        <button type="button" className={styles.secondaryButton} onClick={onOpenSkins}>
          Скины
        </button>
      </div>
    </section>
  )
}
