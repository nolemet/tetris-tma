import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import { formatDuration } from '../game/results'
import { useBoardRowFit } from '../hooks/useBoardRowFit'
import {
  createReplayPlaybackState,
  getReplayCurrentTimeMs,
  getReplayDurationMs,
  getReplayKindLabel,
  getReplayRenderState,
  seekReplayPlayback,
} from '../replays/replayPlayer'
import type { GameReplay } from '../replays/types'
import type { BlockStyleId, TetrominoType } from '../types'
import { Board } from './Board'
import { NextPiece } from './NextPiece'
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
const SEEK_STEP_MS = 5_000

interface ReplayViewerSessionProps extends ReplayViewerProps {
  replay: GameReplay
}

export const ReplayViewer = ({
  replay,
  showGrid,
  blockStyle,
  pieceColors,
  ghostColor,
  onBackToHistory,
  onBackToMenu,
}: ReplayViewerProps) => {
  if (!replay) {
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
    <ReplayViewerSession
      key={`${replay.id}:${replay.version}`}
      replay={replay}
      showGrid={showGrid}
      blockStyle={blockStyle}
      pieceColors={pieceColors}
      ghostColor={ghostColor}
      onBackToHistory={onBackToHistory}
      onBackToMenu={onBackToMenu}
    />
  )
}

const ReplayViewerSession = ({
  replay,
  showGrid,
  blockStyle,
  pieceColors,
  ghostColor,
  onBackToHistory,
  onBackToMenu,
}: ReplayViewerSessionProps) => {
  const [speed, setSpeed] = useState<number>(1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playback, setPlayback] = useState(() => createReplayPlaybackState(replay))
  const animationFrameRef = useRef<number | null>(null)
  const lastAnimationTimeRef = useRef<number | null>(null)
  const speedRef = useRef(speed)
  const playbackRef = useRef(playback)
  const { sectionRef, outerRef, innerRef, rowRef } = useBoardRowFit()

  useEffect(() => {
    speedRef.current = speed
  }, [speed])

  const commitPlayback = (nextPlayback: typeof playback) => {
    playbackRef.current = nextPlayback
    setPlayback(nextPlayback)
  }

  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      lastAnimationTimeRef.current = null
      return
    }

    const tick = (now: number) => {
      const previousNow = lastAnimationTimeRef.current
      lastAnimationTimeRef.current = now

      if (previousNow !== null) {
        const deltaMs = now - previousNow
        if (deltaMs > 0) {
          const currentPlayback = playbackRef.current
          if (!currentPlayback || currentPlayback.finished) {
            setIsPlaying(false)
            return
          }

          const nextPlayback = seekReplayPlayback(
            currentPlayback,
            getReplayCurrentTimeMs(currentPlayback) + deltaMs * speedRef.current,
          )
          playbackRef.current = nextPlayback
          setPlayback(nextPlayback)

          if (nextPlayback.finished) {
            setIsPlaying(false)
            return
          }
        }
      }

      animationFrameRef.current = window.requestAnimationFrame(tick)
    }

    animationFrameRef.current = window.requestAnimationFrame(tick)

    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      lastAnimationTimeRef.current = null
    }
  }, [isPlaying, replay?.id])

  const renderState = useMemo(() => getReplayRenderState(playback), [playback])

  const durationMs = playback ? getReplayDurationMs(playback) : replay?.durationMs ?? 0
  const currentTimeMs = playback ? getReplayCurrentTimeMs(playback) : 0
  const sliderMax = Math.max(Math.ceil(durationMs), 1)
  const sliderValue = Math.min(currentTimeMs, sliderMax)
  const replayKindLabel = replay ? getReplayKindLabel(replay) : 'Replay unavailable'
  const frameCount = playback
    ? playback.kind === 'smooth'
      ? playback.replay.visualFrames.length
      : playback.kind === 'snapshot'
        ? playback.replay.frames.length
        : playback.replay.inputs.length
    : 0
  const frameCounter = playback
    ? playback.kind === 'smooth'
      ? `${Math.min(frameCount, playback.frameIndex + 1)}/${frameCount}`
      : playback.kind === 'snapshot'
        ? `${Math.min(frameCount, playback.frameIndex + 1)}/${frameCount}`
        : `${Math.min(frameCount, playback.inputIndex)}/${frameCount}`
    : '0/0'

  const statusLabel = useMemo(() => {
    if (!playback) {
      return 'Replay unavailable'
    }
    if (playback.finished) {
      return playback.warning ? 'Finished with warning' : 'Finished'
    }
    return isPlaying ? 'Playing' : 'Paused'
  }, [isPlaying, playback])

  const resetAnimationClock = () => {
    lastAnimationTimeRef.current = null
  }

  const seekTo = (targetTimeMs: number) => {
    resetAnimationClock()
    commitPlayback(seekReplayPlayback(playbackRef.current, targetTimeMs))
  }

  const jumpBy = (deltaMs: number) => {
    resetAnimationClock()
    commitPlayback(seekReplayPlayback(playbackRef.current, getReplayCurrentTimeMs(playbackRef.current) + deltaMs))
  }

  const handleTimelineChange = (event: ChangeEvent<HTMLInputElement>) => {
    seekTo(Number(event.target.value))
  }

  const handleRestart = () => {
    if (!replay) {
      return
    }

    resetAnimationClock()
    setIsPlaying(false)
    commitPlayback(createReplayPlaybackState(replay))
  }

  const handlePlayPause = () => {
    if (!replay) {
      return
    }

    if (isPlaying) {
      setIsPlaying(false)
      return
    }

    resetAnimationClock()
    if (playback?.finished) {
      commitPlayback(createReplayPlaybackState(replay))
    }
    setIsPlaying(true)
  }

  return (
    <section className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>TETRIS Replay</h2>
          <p className={styles.text}>
            {new Date(replay.finishedAt).toLocaleString()} - Seed: {replay.seed}
          </p>
          <p className={styles.text}>{replayKindLabel}</p>
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
        <span className={styles.badge}>Original duration: {formatDuration(durationMs)}</span>
        <span className={styles.badge}>{replayKindLabel}</span>
        <span className={styles.badge}>
          {playback.kind === 'smooth'
            ? `Visual frames: ${frameCounter}`
            : playback.kind === 'snapshot'
              ? `Snapshots: ${frameCounter}`
              : `Inputs: ${frameCounter}`}
        </span>
      </div>

      <section ref={sectionRef} className={styles.boardSection}>
        <div ref={outerRef} className={styles.scaleOuter}>
          <div ref={innerRef} className={styles.scaleInner}>
            <div ref={rowRef} className={styles.boardRow}>
              <div className={styles.boardWrap}>
                <Board
                  board={renderState.board}
                  activePiece={renderState.activePiece}
                  ghostPiece={renderState.ghostPiece}
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
                      <dd>{renderState.score}</dd>
                    </div>
                    <div className={styles.statRow}>
                      <dt>Lines</dt>
                      <dd>{renderState.lines}</dd>
                    </div>
                    <div className={styles.statRow}>
                      <dt>Pieces</dt>
                      <dd>{renderState.pieces}</dd>
                    </div>
                    <div className={styles.statRow}>
                      <dt>Level</dt>
                      <dd>{renderState.level}</dd>
                    </div>
                    <div className={styles.statRow}>
                      <dt>Tick</dt>
                      <dd>{renderState.tick}</dd>
                    </div>
                    <div className={styles.statRow}>
                      <dt>Final grade</dt>
                      <dd>{renderState.grade}</dd>
                    </div>
                    <div className={styles.statRow}>
                      <dt>Final rating</dt>
                      <dd>{renderState.rating}</dd>
                    </div>
                  </dl>
                </article>

                <NextPiece pieceType={renderState.nextPieceType} pieceColors={pieceColors} layout="sidebar" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className={styles.timelineCard}>
        <div className={styles.transportRow}>
          <button type="button" className={styles.primaryButton} onClick={handlePlayPause}>
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <button type="button" className={styles.secondaryButton} onClick={handleRestart}>
            Restart
          </button>
          <button type="button" className={styles.secondaryButton} onClick={() => jumpBy(-SEEK_STEP_MS)}>
            -5s
          </button>
          <button type="button" className={styles.secondaryButton} onClick={() => jumpBy(SEEK_STEP_MS)}>
            +5s
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

        <div className={styles.timelineRow}>
          <span className={styles.timeReadout}>{formatDuration(currentTimeMs)}</span>
          <input
            type="range"
            min={0}
            max={sliderMax}
            step={1}
            value={sliderValue}
            onChange={handleTimelineChange}
            className={styles.timelineSlider}
            aria-label="Replay timeline"
          />
          <span className={styles.timeReadout}>{formatDuration(durationMs)}</span>
        </div>
      </div>
    </section>
  )
}
