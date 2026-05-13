import { useMemo, useState } from 'react'
import { analyzeGameMoves } from '../analysis'
import { formatDuration } from '../game/results'
import { isReplayV3, type GameReplay } from '../replays/types'
import type { BoardMatrix, TetrominoType } from '../types'
import styles from './GameAnalysisPanel.module.css'

interface GameAnalysisPanelProps {
  replay: GameReplay | null
  pieceColors: Record<TetrominoType, string>
  onOpenReplay: () => void
  onBackToHistory: () => void
  onBackToMenu: () => void
}

const SUMMARY_LABELS = [
  { key: 'accuracy', title: 'Accuracy' },
  { key: 'totalMoves', title: 'Total moves' },
  { key: 'goodMoves', title: 'Good moves' },
  { key: 'inaccuracies', title: 'Inaccuracies' },
  { key: 'mistakes', title: 'Mistakes' },
  { key: 'blunders', title: 'Blunders' },
  { key: 'totalScoreLoss', title: 'Total score loss' },
] as const

const formatSeverity = (value: string): string => {
  if (value === 'good') {
    return 'Good'
  }
  if (value === 'inaccuracy') {
    return 'Inaccuracy'
  }
  if (value === 'mistake') {
    return 'Mistake'
  }
  return 'Blunder'
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
        <h2 className={styles.title}>Разбор партии</h2>
        <p className={styles.subtitle}>Analysis data is unavailable on this device.</p>
        <div className={styles.buttonRow}>
          <button type="button" className={styles.secondaryButton} onClick={onBackToHistory}>
            Back to history
          </button>
          <button type="button" className={styles.secondaryButton} onClick={onBackToMenu}>
            Back to menu
          </button>
        </div>
      </section>
    )
  }

  const analysisResult = isReplayV3(replay) && replay.moveEvents.length > 0 ? analysis : null
  const summaryValues = analysisResult
    ? {
        accuracy: `${analysisResult.accuracy}%`,
        totalMoves: `${analysisResult.totalMoves}`,
        goodMoves: `${analysisResult.goodMoves}`,
        inaccuracies: `${analysisResult.inaccuracies}`,
        mistakes: `${analysisResult.mistakes}`,
        blunders: `${analysisResult.blunders}`,
        totalScoreLoss: `${analysisResult.totalScoreLoss}`,
      }
    : null

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Разбор партии</h2>
          <p className={styles.subtitle}>
            Classic · Seed {replay.seed} · {new Date(replay.finishedAt).toLocaleString()}
          </p>
        </div>
        <div className={styles.buttonRow}>
          <button type="button" className={styles.secondaryButton} onClick={onBackToHistory}>
            Back to history
          </button>
          <button type="button" className={styles.secondaryButton} onClick={onBackToMenu}>
            Back to menu
          </button>
          <button type="button" className={styles.primaryButton} onClick={onOpenReplay}>
            Open replay
          </button>
        </div>
      </div>

      {!analysisResult ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>Analysis unavailable for this replay.</p>
          <p className={styles.helperText}>
            Older replays can still be watched, but only newer replay v3 runs include move events for post-game analysis.
          </p>
        </div>
      ) : (
        <>
          <div className={styles.summaryGrid}>
            {SUMMARY_LABELS.map((item) => (
              <article key={item.key} className={styles.summaryCard}>
                <h3 className={styles.summaryTitle}>{item.title}</h3>
                <p className={styles.summaryValue}>{summaryValues?.[item.key] ?? '-'}</p>
                {item.key === 'accuracy' ? (
                  <p className={styles.summaryHint}>{analysisResult.accuracyLabel}</p>
                ) : null}
              </article>
            ))}
          </div>

          <div className={styles.metaRow}>
            <span className={styles.badge}>Analyzed moves: {analysisResult.analyzedMoves}</span>
            <span className={styles.badge}>Average score loss: {analysisResult.averageScoreLoss}</span>
            <span className={styles.badge}>Duration: {formatDuration(replay.durationMs)}</span>
            {analysisResult.skippedMoves.length > 0 ? (
              <span className={styles.badge}>Skipped: {analysisResult.skippedMoves.length}</span>
            ) : null}
          </div>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div>
                <h3 className={styles.sectionTitle}>Top mistakes</h3>
                <p className={styles.sectionText}>The largest score losses are shown first, using real board snapshots from the game.</p>
              </div>
            </div>

            {analysisResult.topMistakes.length === 0 ? (
              <div className={styles.emptyState}>
                <p className={styles.emptyText}>No major mistakes detected in this game.</p>
                <p className={styles.helperText}>The move log is available, but the evaluator did not find meaningful score loss in the recorded placements.</p>
              </div>
            ) : (
              <div className={styles.mistakeList}>
                {analysisResult.topMistakes.map((move) => {
                  const isExpanded = expandedMoves[move.moveEvent.id] ?? false

                  return (
                    <article key={move.moveEvent.id} className={styles.mistakeCard}>
                      <div className={styles.mistakeHeader}>
                        <div>
                          <h4 className={styles.mistakeTitle}>Move #{move.moveIndex}</h4>
                          <p className={styles.mistakeMeta}>
                            Piece {move.pieceType} · Time {formatDuration(move.timeMs)} · Score loss {move.scoreLoss}
                          </p>
                        </div>
                        <span className={`${styles.severityBadge} ${styles[`severity${formatSeverity(move.severity)}`]}`}>
                          {formatSeverity(move.severity)}
                        </span>
                      </div>

                      <p className={styles.summaryText}>{move.explanation.summary}</p>

                      <div className={styles.explanationGrid}>
                        <div className={styles.explanationCard}>
                          <h5 className={styles.explanationTitle}>Positives</h5>
                          {move.explanation.positives.length > 0 ? (
                            <ul className={styles.explanationList}>
                              {move.explanation.positives.map((item, index) => (
                                <li key={`${move.moveEvent.id}-positive-${index}`}>{item}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className={styles.helperText}>No meaningful upside was recorded for this move.</p>
                          )}
                        </div>

                        <div className={styles.explanationCard}>
                          <h5 className={styles.explanationTitle}>Negatives</h5>
                          {move.explanation.negatives.length > 0 ? (
                            <ul className={styles.explanationList}>
                              {move.explanation.negatives.map((item, index) => (
                                <li key={`${move.moveEvent.id}-negative-${index}`}>{item}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className={styles.helperText}>This move did not produce negative structural metrics.</p>
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
                          {isExpanded ? 'Hide boards' : 'Show boards'}
                        </button>
                      </div>

                      {isExpanded ? (
                        <div className={styles.boardsRow}>
                          <MiniBoardPreview board={move.boardBefore} pieceColors={pieceColors} title="Before" />
                          <MiniBoardPreview board={move.boardAfter} pieceColors={pieceColors} title="Your move" />
                          <MiniBoardPreview board={move.suggestedBoard} pieceColors={pieceColors} title="Suggested move" />
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
