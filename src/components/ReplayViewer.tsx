import { useEffect, useMemo, useState } from 'react'
import { useBoardRowFit } from '../hooks/useBoardRowFit'
import { formatDuration } from '../game/results'
import { Board } from './Board'
import { NextPiece } from './NextPiece'
import { createReplayPlaybackState, getReplayStepDurationMs, stepReplayPlayback } from '../replays/replayPlayer'
import type { GameReplay } from '../replays/types'
import type { BlockStyleId, TetrominoType } from '../types'
import styles from './ReplayViewer.module.css'

interface ReplayViewerProps {
  replay: GameReplay | null
  showGrid: boolean
  blockStyle: BlockStyleId
  pieceColors: Record<TetrominoType, string>
  ghostColor: string
  onBackToHistory: () => void
  onBackToMenu: () => void
}

const SPEED_OPTIONS = [0.5, 1, 2, 4] as const

export const ReplayViewer = ({
  replay,
  showGrid,
  blockStyle,
  pieceColors,
  ghostColor,
  onBackToHistory,
  onBackToMenu,
}: ReplayViewerProps) => {
  const [speed, setSpeed] = useState<number>(1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playback, setPlayback] = useState(() => (replay ? createReplayPlaybackState(replay) : null))
  const { sectionRef, outerRef, innerRef, rowRef } = useBoardRowFit()

  useEffect(() => {
    if (!playback?.warning) {
      return
    }

    console.warn(playback.warning, playback.replay.id)
  }, [playback?.warning, playback?.replay.id])

  useEffect(() => {
    if (!playback || !isPlaying || playback.finished) {
      return
    }

    const timerId = window.setTimeout(() => {
      setPlayback((prev) => {
        if (!prev) {
          return prev
        }

        const next = stepReplayPlayback(prev)
        if (next.finished) {
          setIsPlaying(false)
        }
        return next
      })
    }, getReplayStepDurationMs(playback, speed))

    return () => window.clearTimeout(timerId)
  }, [isPlaying, playback, speed])

  const statusLabel = useMemo(() => {
    if (!playback) {
      return 'Replay unavailable'
    }
    if (playback.finished) {
      return playback.warning ? 'Finished with warning' : 'Finished'
    }
    return isPlaying ? 'Playing' : 'Paused'
  }, [isPlaying, playback])

  if (!replay || !playback) {
    return (
      <section className={styles.card}>
        <h2 className={styles.title}>Replay not found</h2>
        <p className={styles.text}>This replay is unavailable on this device.</p>
        <div className={styles.actions}>
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

  return (
    <section className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>TETRIS Replay</h2>
          <p className={styles.text}>
            {new Date(replay.finishedAt).toLocaleString()} - Seed: {replay.seed}
          </p>
        </div>
        <div className={styles.headerButtons}>
          <button type="button" className={styles.secondaryButton} onClick={onBackToHistory}>
            Back to history
          </button>
          <button type="button" className={styles.secondaryButton} onClick={onBackToMenu}>
            Back to menu
          </button>
        </div>
      </div>

      {playback.warning ? <div className={styles.warning}>{playback.warning}</div> : null}

      <div className={styles.metaRow}>
        <span className={styles.badge}>Mode: {replay.mode}</span>
        <span className={styles.badge}>Status: {statusLabel}</span>
        <span className={styles.badge}>Original duration: {formatDuration(replay.durationMs)}</span>
      </div>

      <section ref={sectionRef} className={styles.boardSection}>
        <div ref={outerRef} className={styles.scaleOuter}>
          <div ref={innerRef} className={styles.scaleInner}>
            <div ref={rowRef} className={styles.boardRow}>
              <div className={styles.boardWrap}>
                <Board
                  board={playback.model.board}
                  activePiece={playback.model.activePiece}
                  ghostPiece={playback.model.ghostPiece}
                  lineClearRows={[]}
                  showGrid={showGrid}
                  blockStyle={blockStyle}
                  pieceColors={pieceColors}
                  ghostColor={ghostColor}
                />
              </div>

              <div className={styles.sideHud}>
                <article className={styles.statsCard}>
                  <h3 className={styles.cardTitle}>Replay stats</h3>
                  <dl className={styles.statsList}>
                    <div className={styles.statRow}>
                      <dt>Score</dt>
                      <dd>{playback.model.stats.score}</dd>
                    </div>
                    <div className={styles.statRow}>
                      <dt>Lines</dt>
                      <dd>{playback.model.stats.lines}</dd>
                    </div>
                    <div className={styles.statRow}>
                      <dt>Pieces</dt>
                      <dd>{playback.model.stats.piecesPlaced}</dd>
                    </div>
                    <div className={styles.statRow}>
                      <dt>Tick</dt>
                      <dd>{playback.model.tick}</dd>
                    </div>
                    <div className={styles.statRow}>
                      <dt>Final grade</dt>
                      <dd>{replay.finalStats.grade}</dd>
                    </div>
                    <div className={styles.statRow}>
                      <dt>Final rating</dt>
                      <dd>{replay.finalStats.rating}</dd>
                    </div>
                  </dl>
                </article>

                <NextPiece pieceType={playback.model.nextPieceType} pieceColors={pieceColors} layout="sidebar" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => setIsPlaying((prev) => !prev)}
          disabled={playback.finished}
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => {
            setIsPlaying(false)
            setPlayback(createReplayPlaybackState(replay))
          }}
        >
          Restart
        </button>
        <div className={styles.speedGroup}>
          {SPEED_OPTIONS.map((value) => (
            <button
              key={value}
              type="button"
              className={value === speed ? styles.speedActive : styles.speedButton}
              onClick={() => setSpeed(value)}
            >
              {value}x
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
