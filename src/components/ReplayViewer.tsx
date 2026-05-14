import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useBoardRowFit } from '../hooks/useBoardRowFit'
import { useI18n } from '../i18n'
import {
  createReplayPlaybackState,
  getReplayCurrentTimeMs,
  getReplayDurationMs,
  getReplayRenderState,
  seekReplayPlayback,
} from '../replays/replayPlayer'
import type { GameReplay } from '../replays/types'
import type { BlockStyleId, GameMode, TetrominoType } from '../types'
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

const getReplayKindLabelKey = (replay: GameReplay) => {
  if (replay.version === 3) {
    return 'replay.smooth' as const
  }
  if (replay.version === 2) {
    return 'replay.snapshot' as const
  }
  return 'replay.legacy' as const
}

const getModeLabelKey = (mode: GameMode) => {
  return mode === 'vsBot' ? ('mode.vsBot' as const) : ('mode.classic' as const)
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
  const { t } = useI18n()

  if (!replay) {
    return (
      <section className={styles.card}>
        <h2 className={styles.title}>{t('replay.notFound')}</h2>
        <p className={styles.text}>{t('replay.notFoundText')}</p>
        <div className={styles.actions}>
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
  const { t, formatDuration, formatInteger, formatDateTime } = useI18n()
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
  }, [isPlaying, replay.id])

  const renderState = useMemo(() => getReplayRenderState(playback), [playback])

  const durationMs = playback ? getReplayDurationMs(playback) : replay.durationMs
  const currentTimeMs = playback ? getReplayCurrentTimeMs(playback) : 0
  const sliderMax = Math.max(Math.ceil(durationMs), 1)
  const sliderValue = Math.min(currentTimeMs, sliderMax)
  const replayKindLabel = t(getReplayKindLabelKey(replay))
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
      return t('common.notAvailable')
    }
    if (playback.finished) {
      return playback.warning ? t('replay.statusFinishedWarning') : t('replay.statusFinished')
    }
    return isPlaying ? t('replay.statusPlaying') : t('replay.statusPaused')
  }, [isPlaying, playback, t])

  const warningText = playback.warning
    ? playback.kind === 'legacy'
      ? t('replay.warningLegacy')
      : t('replay.warningMismatch')
    : null

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
    resetAnimationClock()
    setIsPlaying(false)
    commitPlayback(createReplayPlaybackState(replay))
  }

  const handlePlayPause = () => {
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
          <h2 className={styles.title}>{t('replay.title')}</h2>
          <p className={styles.text}>
            {formatDateTime(replay.finishedAt)} - {t('common.seed')}: {replay.seed}
          </p>
          <p className={styles.text}>{replayKindLabel}</p>
        </div>
        <div className={styles.headerButtons}>
          <button type="button" className={styles.secondaryButton} onClick={onBackToHistory}>
            {t('common.backToHistory')}
          </button>
          <button type="button" className={styles.secondaryButton} onClick={onBackToMenu}>
            {t('common.backToMenu')}
          </button>
        </div>
      </div>

      {warningText ? <div className={styles.warning}>{warningText}</div> : null}

      <div className={styles.metaRow}>
        <span className={styles.badge}>
          {t('common.mode')}: {t(getModeLabelKey(replay.mode))}
        </span>
        <span className={styles.badge}>
          {t('common.status')}: {statusLabel}
        </span>
        <span className={styles.badge}>
          {t('replay.originalDuration')}: {formatDuration(durationMs)}
        </span>
        <span className={styles.badge}>{replayKindLabel}</span>
        <span className={styles.badge}>
          {playback.kind === 'smooth'
            ? t('replay.visualFrames', { count: frameCounter })
            : playback.kind === 'snapshot'
              ? t('replay.snapshots', { count: frameCounter })
              : t('replay.inputs', { count: frameCounter })}
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
                  <h3 className={styles.cardTitle}>{t('replay.statsTitle')}</h3>
                  <dl className={styles.statsList}>
                    <div className={styles.statRow}>
                      <dt>{t('common.score')}</dt>
                      <dd>{formatInteger(renderState.score)}</dd>
                    </div>
                    <div className={styles.statRow}>
                      <dt>{t('common.lines')}</dt>
                      <dd>{formatInteger(renderState.lines)}</dd>
                    </div>
                    <div className={styles.statRow}>
                      <dt>{t('common.pieces')}</dt>
                      <dd>{formatInteger(renderState.pieces)}</dd>
                    </div>
                    <div className={styles.statRow}>
                      <dt>{t('common.level')}</dt>
                      <dd>{formatInteger(renderState.level)}</dd>
                    </div>
                    <div className={styles.statRow}>
                      <dt>{t('replay.tick')}</dt>
                      <dd>{formatInteger(renderState.tick)}</dd>
                    </div>
                    <div className={styles.statRow}>
                      <dt>{t('replay.finalGrade')}</dt>
                      <dd>{renderState.grade}</dd>
                    </div>
                    <div className={styles.statRow}>
                      <dt>{t('replay.finalRating')}</dt>
                      <dd>{formatInteger(renderState.rating ?? 0)}</dd>
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
            {isPlaying ? t('replay.pause') : t('replay.play')}
          </button>
          <button type="button" className={styles.secondaryButton} onClick={handleRestart}>
            {t('replay.restart')}
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
