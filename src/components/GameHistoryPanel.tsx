import { useMemo, useState } from 'react'
import { formatDuration } from '../game/results'
import type { GameResult } from '../types'
import styles from './GameHistoryPanel.module.css'

interface GameHistoryPanelProps {
  history: GameResult[]
  availableReplayIds: Set<string>
  availableAnalysisIds: Set<string>
  onOpenReplay: (replayId: string) => void
  onOpenAnalysis: (replayId: string) => void
  onBack: () => void
  onClearHistory: () => void
}

const formatPlayedAt = (value: string): string => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleString()
}

export const GameHistoryPanel = ({
  history,
  availableReplayIds,
  availableAnalysisIds,
  onOpenReplay,
  onOpenAnalysis,
  onBack,
  onClearHistory,
}: GameHistoryPanelProps) => {
  const [confirmClear, setConfirmClear] = useState(false)

  const hasHistory = history.length > 0
  const replayAvailability = useMemo(() => availableReplayIds, [availableReplayIds])

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>История игр</h2>
          <p className={styles.subtitle}>Последние локально сохранённые партии и доступные реплеи.</p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.ghostButton} onClick={onBack}>
            Назад
          </button>
          <button
            type="button"
            className={styles.dangerButton}
            onClick={() => setConfirmClear((prev) => !prev)}
            disabled={!hasHistory}
          >
            Clear history
          </button>
        </div>
      </div>

      {confirmClear ? (
        <div className={styles.confirmCard}>
          <p className={styles.confirmText}>Очистить историю и связанные локальные реплеи?</p>
          <div className={styles.confirmActions}>
            <button
              type="button"
              className={styles.dangerButton}
              onClick={() => {
                onClearHistory()
                setConfirmClear(false)
              }}
            >
              Да, очистить
            </button>
            <button type="button" className={styles.ghostButton} onClick={() => setConfirmClear(false)}>
              Отмена
            </button>
          </div>
        </div>
      ) : null}

      {!hasHistory ? (
        <div className={styles.emptyState}>Пока нет сыгранных партий</div>
      ) : (
        <div className={styles.list}>
          {history.map((item) => {
            const replayAvailable = Boolean(item.replayId && replayAvailability.has(item.replayId))
            const analysisAvailable = Boolean(item.replayId && availableAnalysisIds.has(item.replayId))
            return (
              <article key={item.id} className={styles.item}>
                <div className={styles.itemHeader}>
                  <div>
                    <h3 className={styles.itemTitle}>{formatPlayedAt(item.endedAt)}</h3>
                    <p className={styles.itemMeta}>
                      {item.mode} • Grade {item.grade} • Rating {item.rating}
                    </p>
                  </div>
                  <span className={styles.seedBadge}>Seed: {item.seed}</span>
                </div>

                <dl className={styles.grid}>
                  <div className={styles.stat}>
                    <dt>Score</dt>
                    <dd>{item.score}</dd>
                  </div>
                  <div className={styles.stat}>
                    <dt>Lines</dt>
                    <dd>{item.lines}</dd>
                  </div>
                  <div className={styles.stat}>
                    <dt>Pieces</dt>
                    <dd>{item.piecesPlaced}</dd>
                  </div>
                  <div className={styles.stat}>
                    <dt>Duration</dt>
                    <dd>{formatDuration(item.timePlayedMs)}</dd>
                  </div>
                </dl>

                <div className={styles.actions}>
                  {replayAvailable && item.replayId ? (
                    <button type="button" className={styles.primaryButton} onClick={() => onOpenReplay(item.replayId!)}>
                      Replay
                    </button>
                  ) : (
                    <span className={styles.unavailable}>Replay unavailable</span>
                  )}
                  {analysisAvailable && item.replayId ? (
                    <button type="button" className={styles.ghostButton} onClick={() => onOpenAnalysis(item.replayId!)}>
                      Analysis
                    </button>
                  ) : (
                    <span className={styles.unavailable}>Analysis unavailable</span>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
