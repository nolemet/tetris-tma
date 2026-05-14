import { useMemo, useState } from 'react'
import { analyzeGameMoves } from '../analysis'
import type { MoveAnalysis } from '../analysis/types'
import { useI18n } from '../i18n'
import { isReplayV3, type GameReplay } from '../replays/types'
import type { BoardMatrix, GameMode, TetrominoType } from '../types'
import styles from './GameAnalysisPanel.module.css'

interface GameAnalysisPanelProps {
  replay: GameReplay | null
  pieceColors: Record<TetrominoType, string>
  onOpenReplay: () => void
  onBackToHistory: () => void
  onBackToMenu: () => void
}

const getModeLabelKey = (mode: GameMode) => {
  return mode === 'vsBot' ? ('mode.vsBot' as const) : ('mode.classic' as const)
}

const getSeverityLabelKey = (value: string) => {
  if (value === 'good') {
    return 'analysis.severity.good' as const
  }
  if (value === 'inaccuracy') {
    return 'analysis.severity.inaccuracy' as const
  }
  if (value === 'mistake') {
    return 'analysis.severity.mistake' as const
  }
  return 'analysis.severity.blunder' as const
}

const getAccuracyLabelKey = (value: string) => {
  if (value === 'Excellent') {
    return 'analysis.accuracyLabel.excellent' as const
  }
  if (value === 'Good') {
    return 'analysis.accuracyLabel.good' as const
  }
  if (value === 'Average') {
    return 'analysis.accuracyLabel.average' as const
  }
  if (value === 'Weak') {
    return 'analysis.accuracyLabel.weak' as const
  }
  return 'analysis.accuracyLabel.poor' as const
}

const createLocalizedExplanation = (
  move: MoveAnalysis,
  helpers: {
    t: ReturnType<typeof useI18n>['t']
    formatInteger: ReturnType<typeof useI18n>['formatInteger']
    formatScoreLoss: ReturnType<typeof useI18n>['formatScoreLoss']
  },
) => {
  const { t, formatInteger, formatScoreLoss } = helpers
  const delta = move.playerEvaluation.delta
  const positives: string[] = []
  const negatives: string[] = []

  if (move.moveEvent.linesCleared > 0) {
    positives.push(
      t('analysis.explanation.clearedLines', {
        value: formatInteger(move.moveEvent.linesCleared),
      }),
    )
  }
  if (move.moveEvent.linesCleared === 4) {
    positives.push(t('analysis.explanation.madeTetris'))
  }
  if (delta.holes < 0) {
    positives.push(t('analysis.explanation.removedHoles', { value: formatInteger(Math.abs(delta.holes)) }))
  }
  if (delta.coveredHoles < 0) {
    positives.push(
      t('analysis.explanation.reducedCoveredHoles', {
        value: formatInteger(Math.abs(delta.coveredHoles)),
      }),
    )
  }
  if (delta.aggregateHeight < 0) {
    positives.push(
      t('analysis.explanation.loweredAggregateHeight', {
        value: formatInteger(Math.abs(delta.aggregateHeight)),
      }),
    )
  }
  if (delta.maxHeight < 0) {
    positives.push(
      t('analysis.explanation.loweredMaxHeight', {
        value: formatInteger(Math.abs(delta.maxHeight)),
      }),
    )
  }
  if (delta.bumpiness < 0) {
    positives.push(
      t('analysis.explanation.reducedBumpiness', {
        value: formatInteger(Math.abs(delta.bumpiness)),
      }),
    )
  }
  if (delta.rowTransitions < 0 || delta.columnTransitions < 0) {
    positives.push(t('analysis.explanation.reducedTransitions'))
  }

  if (move.scoreLoss > 0 && move.severity !== 'good') {
    negatives.push(t('analysis.explanation.bestAlternative', { value: formatScoreLoss(move.scoreLoss) }))
  }
  if (delta.holes > 0) {
    negatives.push(t('analysis.explanation.createdHoles', { value: formatInteger(delta.holes) }))
  }
  if (delta.coveredHoles > 0) {
    negatives.push(
      t('analysis.explanation.createdCoveredHoles', {
        value: formatInteger(delta.coveredHoles),
      }),
    )
  }
  if (delta.aggregateHeight > 0) {
    negatives.push(
      t('analysis.explanation.raisedAggregateHeight', {
        value: formatInteger(delta.aggregateHeight),
      }),
    )
  }
  if (delta.maxHeight > 0) {
    negatives.push(
      t('analysis.explanation.raisedMaxHeight', {
        value: formatInteger(delta.maxHeight),
      }),
    )
  }
  if (delta.bumpiness > 0) {
    negatives.push(
      t('analysis.explanation.increasedBumpiness', {
        value: formatInteger(delta.bumpiness),
      }),
    )
  }
  if (delta.rowTransitions > 0 || delta.columnTransitions > 0) {
    negatives.push(t('analysis.explanation.increasedTransitions'))
  }
  if (delta.wells > 0) {
    negatives.push(t('analysis.explanation.deeperWells', { value: formatInteger(delta.wells) }))
  }

  let summary = t('analysis.explanation.goodStable')
  if (move.severity === 'blunder') {
    summary = t('analysis.explanation.blunder')
  } else if (move.severity === 'mistake') {
    summary =
      delta.holes > 0 || delta.coveredHoles > 0
        ? t('analysis.explanation.mistakeHoles')
        : t('analysis.explanation.mistakeHeight')
  } else if (move.severity === 'inaccuracy') {
    summary = t('analysis.explanation.inaccuracy')
  } else if (move.moveEvent.linesCleared > 0) {
    summary = t('analysis.explanation.goodLines')
  }

  return {
    summary,
    positives,
    negatives,
  }
}

const MiniBoardPreview = ({
  board,
  pieceColors,
  title,
}: {
  board: BoardMatrix
  pieceColors: Record<TetrominoType, string>
  title: string
}) => {
  return (
    <section className={styles.boardCard}>
      <h5 className={styles.boardTitle}>{title}</h5>
      <div className={styles.boardGrid} aria-label={title}>
        {board.map((row, rowIndex) =>
          row.map((cell, columnIndex) => (
            <span
              key={`${title}-${rowIndex}-${columnIndex}`}
              className={styles.boardCell}
              style={{
                background: cell ? pieceColors[cell] : 'rgba(255, 255, 255, 0.04)',
                boxShadow: cell ? `inset 0 0 0 1px rgba(255, 255, 255, 0.12), 0 0 12px ${pieceColors[cell]}22` : 'none',
              }}
            />
          )),
        )}
      </div>
    </section>
  )
}

export const GameAnalysisPanel = ({
  replay,
  pieceColors,
  onOpenReplay,
  onBackToHistory,
  onBackToMenu,
}: GameAnalysisPanelProps) => {
  const { t, formatInteger, formatDecimal, formatScoreLoss, formatPercent, formatDuration, formatDateTime } = useI18n()
  const [expandedMoves, setExpandedMoves] = useState<Record<string, boolean>>({})

  const analysis = useMemo(() => {
    if (!replay || !isReplayV3(replay) || replay.moveEvents.length === 0) {
      return null
    }

    return analyzeGameMoves(replay.moveEvents)
  }, [replay])

  if (!replay) {
    return (
      <section className={styles.card}>
        <h2 className={styles.title}>{t('analysis.title')}</h2>
        <p className={styles.subtitle}>{t('analysis.notAvailable')}</p>
        <div className={styles.buttonRow}>
          <button type="button" className={styles.secondaryButton} onClick={onBackToHistory}>
            {t('common.backToHistory')}
          </button>
          <button type="button" className={styles.secondaryButton} onClick={onBackToMenu}>
            {t('common.backToMenu')}
          </button>
        </div>
      </section>
    )
  }

  const analysisResult = isReplayV3(replay) && replay.moveEvents.length > 0 ? analysis : null
  const summaryValues = analysisResult
    ? {
        accuracy: formatPercent(analysisResult.accuracy),
        totalMoves: formatInteger(analysisResult.totalMoves),
        goodMoves: formatInteger(analysisResult.goodMoves),
        inaccuracies: formatInteger(analysisResult.inaccuracies),
        mistakes: formatInteger(analysisResult.mistakes),
        blunders: formatInteger(analysisResult.blunders),
        totalScoreLoss: formatScoreLoss(analysisResult.totalScoreLoss),
      }
    : null
  const summaryItems = analysisResult
    ? [
        {
          key: 'analysis.accuracy' as const,
          value: summaryValues?.accuracy,
          hint: t(getAccuracyLabelKey(analysisResult.accuracyLabel)),
        },
        { key: 'analysis.totalMoves' as const, value: summaryValues?.totalMoves },
        { key: 'analysis.goodMoves' as const, value: summaryValues?.goodMoves },
        { key: 'analysis.inaccuracies' as const, value: summaryValues?.inaccuracies },
        { key: 'analysis.mistakes' as const, value: summaryValues?.mistakes },
        { key: 'analysis.blunders' as const, value: summaryValues?.blunders },
        { key: 'analysis.totalScoreLoss' as const, value: summaryValues?.totalScoreLoss },
      ]
    : []

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>{t('analysis.title')}</h2>
          <p className={styles.subtitle}>
            {t('analysis.subtitle', {
              mode: t(getModeLabelKey(replay.mode)),
              seed: replay.seed,
              date: formatDateTime(replay.finishedAt),
            })}
          </p>
        </div>
        <div className={styles.buttonRow}>
          <button type="button" className={styles.secondaryButton} onClick={onBackToHistory}>
            {t('common.backToHistory')}
          </button>
          <button type="button" className={styles.secondaryButton} onClick={onBackToMenu}>
            {t('common.backToMenu')}
          </button>
          <button type="button" className={styles.primaryButton} onClick={onOpenReplay}>
            {t('analysis.openReplay')}
          </button>
        </div>
      </div>

      {!analysisResult ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>{t('analysis.unavailableReplay')}</p>
          <p className={styles.helperText}>{t('analysis.unavailableHelp')}</p>
        </div>
      ) : (
        <>
          <div className={styles.summaryGrid}>
            {summaryItems.map((item) => (
              <article key={item.key} className={styles.summaryCard}>
                <h3 className={styles.summaryTitle}>{t(item.key)}</h3>
                <p className={styles.summaryValue}>{item.value ?? '-'}</p>
                {item.hint ? <p className={styles.summaryHint}>{item.hint}</p> : null}
              </article>
            ))}
          </div>

          <div className={styles.metaRow}>
            <span className={styles.badge}>{t('analysis.analyzedMoves', { count: formatInteger(analysisResult.analyzedMoves) })}</span>
            <span className={styles.badge}>{t('analysis.averageScoreLoss', { value: formatDecimal(analysisResult.averageScoreLoss) })}</span>
            <span className={styles.badge}>{t('common.duration')}: {formatDuration(replay.durationMs)}</span>
            {analysisResult.skippedMoves.length > 0 ? (
              <span className={styles.badge}>{t('analysis.skippedMoves', { count: formatInteger(analysisResult.skippedMoves.length) })}</span>
            ) : null}
          </div>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div>
                <h3 className={styles.sectionTitle}>{t('analysis.topMistakes')}</h3>
                <p className={styles.sectionText}>{t('analysis.topMistakesText')}</p>
              </div>
            </div>

            {analysisResult.topMistakes.length === 0 ? (
              <div className={styles.emptyState}>
                <p className={styles.emptyText}>{t('analysis.none')}</p>
                <p className={styles.helperText}>{t('analysis.noneText')}</p>
              </div>
            ) : (
              <div className={styles.mistakeList}>
                {analysisResult.topMistakes.map((move) => {
                  const isExpanded = expandedMoves[move.moveEvent.id] ?? false
                  const explanation = createLocalizedExplanation(move, {
                    t,
                    formatInteger,
                    formatScoreLoss,
                  })

                  return (
                    <article key={move.moveEvent.id} className={styles.mistakeCard}>
                      <div className={styles.mistakeHeader}>
                        <div>
                          <h4 className={styles.mistakeTitle}>{t('analysis.moveNumber', { number: move.moveIndex })}</h4>
                          <p className={styles.mistakeMeta}>
                            {t('analysis.moveMeta', {
                              piece: move.pieceType,
                              time: formatDuration(move.timeMs),
                              loss: formatScoreLoss(move.scoreLoss),
                            })}
                          </p>
                        </div>
                        <span className={`${styles.severityBadge} ${styles[`severity${move.severity.charAt(0).toUpperCase()}${move.severity.slice(1)}`]}`}>
                          {t(getSeverityLabelKey(move.severity))}
                        </span>
                      </div>

                      <p className={styles.summaryText}>{explanation.summary}</p>

                      <div className={styles.explanationGrid}>
                        <div className={styles.explanationCard}>
                          <h5 className={styles.explanationTitle}>{t('analysis.positives')}</h5>
                          {explanation.positives.length > 0 ? (
                            <ul className={styles.explanationList}>
                              {explanation.positives.map((item, index) => (
                                <li key={`${move.moveEvent.id}-positive-${index}`}>{item}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className={styles.helperText}>{t('analysis.noPositives')}</p>
                          )}
                        </div>

                        <div className={styles.explanationCard}>
                          <h5 className={styles.explanationTitle}>{t('analysis.negatives')}</h5>
                          {explanation.negatives.length > 0 ? (
                            <ul className={styles.explanationList}>
                              {explanation.negatives.map((item, index) => (
                                <li key={`${move.moveEvent.id}-negative-${index}`}>{item}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className={styles.helperText}>{t('analysis.noNegatives')}</p>
                          )}
                        </div>
                      </div>

                      <div className={styles.buttonRow}>
                        <button
                          type="button"
                          className={styles.secondaryButton}
                          onClick={() =>
                            setExpandedMoves((prev) => ({
                              ...prev,
                              [move.moveEvent.id]: !isExpanded,
                            }))
                          }
                        >
                          {isExpanded ? t('analysis.hideBoards') : t('analysis.showBoards')}
                        </button>
                      </div>

                      {isExpanded ? (
                        <div className={styles.boardsRow}>
                          <MiniBoardPreview board={move.boardBefore} pieceColors={pieceColors} title={t('analysis.before')} />
                          <MiniBoardPreview board={move.boardAfter} pieceColors={pieceColors} title={t('analysis.yourMove')} />
                          <MiniBoardPreview board={move.suggestedBoard} pieceColors={pieceColors} title={t('analysis.suggestedMove')} />
                        </div>
                      ) : null}
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </>
      )}
    </section>
  )
}
