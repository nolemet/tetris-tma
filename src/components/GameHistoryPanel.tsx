import { useState } from 'react'
import { useI18n } from '../i18n'
import type { BotDifficulty, GameMode, GameResult, MatchResult } from '../types'
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

const getModeLabelKey = (mode: GameMode) => {
  return mode === 'vsBot' ? ('mode.vsBot' as const) : ('mode.classic' as const)
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

const getMatchResultLabelKey = (result: MatchResult) => {
  switch (result) {
    case 'win':
      return 'vsBot.result.win' as const
    case 'loss':
      return 'vsBot.result.loss' as const
    case 'draw':
      return 'vsBot.result.draw' as const
  }
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
  const { t, formatInteger, formatDuration, formatDateTime } = useI18n()
  const [confirmClear, setConfirmClear] = useState(false)

  const hasHistory = history.length > 0

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>{t('history.title')}</h2>
          <p className={styles.subtitle}>{t('history.subtitle')}</p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.ghostButton} onClick={onBack}>
            {t('common.back')}
          </button>
          <button
            type="button"
            className={styles.dangerButton}
            onClick={() => setConfirmClear((prev) => !prev)}
            disabled={!hasHistory}
          >
            {t('history.clear')}
          </button>
        </div>
      </div>

      {confirmClear ? (
        <div className={styles.confirmCard}>
          <p className={styles.confirmText}>{t('history.clearConfirm')}</p>
          <div className={styles.confirmActions}>
            <button
              type="button"
              className={styles.dangerButton}
              onClick={() => {
                onClearHistory()
                setConfirmClear(false)
              }}
            >
              {t('history.clearApprove')}
            </button>
            <button type="button" className={styles.ghostButton} onClick={() => setConfirmClear(false)}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      ) : null}

      {!hasHistory ? (
        <div className={styles.emptyState}>{t('history.empty')}</div>
      ) : (
        <div className={styles.list}>
          {history.map((item) => {
            const replayAvailable = Boolean(item.replayId && availableReplayIds.has(item.replayId))
            const analysisAvailable = Boolean(item.replayId && availableAnalysisIds.has(item.replayId))

            return (
              <article key={item.id} className={styles.item}>
                <div className={styles.itemHeader}>
                  <div>
                    <h3 className={styles.itemTitle}>
                      {item.endedAt ? formatDateTime(item.endedAt) : t('history.unknownDate')}
                    </h3>
                    <p className={styles.itemMeta}>
                      {t(getModeLabelKey(item.mode))} · {t('common.grade')} {item.grade} · {t('common.rating')} {formatInteger(item.rating)}
                    </p>
                  </div>
                  <span className={styles.seedBadge}>
                    {t('common.seed')}: {item.seed}
                  </span>
                </div>

                <dl className={styles.grid}>
                  <div className={styles.stat}>
                    <dt>{t('common.score')}</dt>
                    <dd>{formatInteger(item.score)}</dd>
                  </div>
                  <div className={styles.stat}>
                    <dt>{t('common.lines')}</dt>
                    <dd>{formatInteger(item.lines)}</dd>
                  </div>
                  <div className={styles.stat}>
                    <dt>{t('common.pieces')}</dt>
                    <dd>{formatInteger(item.piecesPlaced)}</dd>
                  </div>
                  <div className={styles.stat}>
                    <dt>{t('common.duration')}</dt>
                    <dd>{formatDuration(item.timePlayedMs)}</dd>
                  </div>
                  {item.mode === 'vsBot' ? (
                    <>
                      <div className={styles.stat}>
                        <dt>{t('history.botScore')}</dt>
                        <dd>{formatInteger(item.botScore ?? 0)}</dd>
                      </div>
                      <div className={styles.stat}>
                        <dt>{t('history.result')}</dt>
                        <dd>{item.matchResult ? t(getMatchResultLabelKey(item.matchResult)) : '-'}</dd>
                      </div>
                      <div className={styles.stat}>
                        <dt>{t('history.eloChange')}</dt>
                        <dd>{item.eloChange === null || item.eloChange === undefined ? '-' : `${item.eloChange > 0 ? '+' : ''}${formatInteger(item.eloChange)}`}</dd>
                      </div>
                      <div className={styles.stat}>
                        <dt>{t('history.difficulty')}</dt>
                        <dd>{item.botDifficulty ? t(getDifficultyLabelKey(item.botDifficulty)) : '-'}</dd>
                      </div>
                    </>
                  ) : null}
                </dl>

                <div className={styles.actions}>
                  {replayAvailable && item.replayId ? (
                    <button type="button" className={styles.primaryButton} onClick={() => onOpenReplay(item.replayId!)}>
                      {t('common.replay')}
                    </button>
                  ) : (
                    <span className={styles.unavailable}>{t('history.replayUnavailable')}</span>
                  )}
                  {analysisAvailable && item.replayId ? (
                    <button type="button" className={styles.ghostButton} onClick={() => onOpenAnalysis(item.replayId!)}>
                      {t('common.analysis')}
                    </button>
                  ) : (
                    <span className={styles.unavailable}>{t('history.analysisUnavailable')}</span>
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
