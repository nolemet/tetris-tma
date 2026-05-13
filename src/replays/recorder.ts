import type { GameAction, GameMode, GameResult } from '../types'
import type { GameReplayV3, ReplayFrame, ReplayInput, ReplayMoveEvent, VisualFrame } from './types'

interface ReplayRecorderSetup {
  mode: GameMode
  seed: string
  startLevel: number
  startedAt: number
}

export interface ReplayRecorderSession extends ReplayRecorderSetup {
  startedAtPerf: number
  inputs: ReplayInput[]
}

const generateReplayId = (seed: string, startedAt: number): string => {
  return `replay-${seed}-${startedAt}`
}

const cloneBoard = <T extends { board: ReplayFrame['board'] }>(frame: T): T => {
  return {
    ...frame,
    board: frame.board.map((row) => [...row]),
  }
}

const resolveReplayDurationMs = (
  gameResultDurationMs: number,
  inputs: ReplayInput[],
  frames: ReplayFrame[],
  visualFrames: VisualFrame[],
  moveEvents: ReplayMoveEvent[],
): number => {
  const latestInputTime = inputs.at(-1)?.timeMs ?? 0
  const latestFrameTime = frames.at(-1)?.timeMs ?? 0
  const latestVisualFrameTime = visualFrames.at(-1)?.timeMs ?? 0
  const latestMoveEventTime = moveEvents.at(-1)?.lockTimeMs ?? 0

  return Math.max(Math.round(gameResultDurationMs), latestInputTime, latestFrameTime, latestVisualFrameTime, latestMoveEventTime)
}

export const createReplayRecorder = ({
  mode,
  seed,
  startLevel,
  startedAt,
}: ReplayRecorderSetup): ReplayRecorderSession => {
  return {
    mode,
    seed,
    startLevel,
    startedAt,
    startedAtPerf: typeof performance !== 'undefined' ? performance.now() : 0,
    inputs: [],
  }
}

export const recordReplayAction = (
  recorder: ReplayRecorderSession,
  action: GameAction,
  tick: number,
): ReplayRecorderSession => {
  if (recorder.mode === 'classic' && action === 'hold') {
    return recorder
  }

  const nextInput: ReplayInput = {
    tick,
    timeMs: Math.max(0, Math.round((typeof performance !== 'undefined' ? performance.now() : 0) - recorder.startedAtPerf)),
    action,
  }

  return {
    ...recorder,
    inputs: [...recorder.inputs, nextInput],
  }
}

export const finalizeReplay = (
  recorder: ReplayRecorderSession,
  gameResult: GameResult,
  finishedAt: number,
  frames: ReplayFrame[],
  visualFrames: VisualFrame[],
  moveEvents: ReplayMoveEvent[],
): GameReplayV3 => {
  const durationMs = resolveReplayDurationMs(gameResult.timePlayedMs, recorder.inputs, frames, visualFrames, moveEvents)

  return {
    version: 3,
    id: generateReplayId(recorder.seed, recorder.startedAt),
    gameId: gameResult.id,
    mode: recorder.mode,
    seed: recorder.seed,
    startLevel: recorder.startLevel,
    startedAt: recorder.startedAt,
    finishedAt,
    durationMs,
    inputs: recorder.inputs,
    frames: frames.map((frame) => cloneBoard(frame)),
    visualFrames: visualFrames.map((frame) => cloneBoard(frame)),
    moveEvents: moveEvents.map((moveEvent) => ({
      ...moveEvent,
      boardBefore: moveEvent.boardBefore.map((row) => [...row]),
      boardAfter: moveEvent.boardAfter.map((row) => [...row]),
      playerPlacement: {
        ...moveEvent.playerPlacement,
      },
    })),
    finalStats: {
      score: gameResult.score,
      linesCleared: gameResult.lines,
      piecesPlaced: gameResult.piecesPlaced,
      grade: gameResult.grade,
      rating: gameResult.rating,
      durationMs,
    },
  }
}
