import type { GameAction, GameMode, GameResult } from '../types'
import type { GameReplay, ReplayInput } from './types'

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
): GameReplay => {
  return {
    version: 1,
    id: generateReplayId(recorder.seed, recorder.startedAt),
    gameId: gameResult.id,
    mode: recorder.mode,
    seed: recorder.seed,
    startLevel: recorder.startLevel,
    startedAt: recorder.startedAt,
    finishedAt,
    durationMs: gameResult.timePlayedMs,
    inputs: recorder.inputs,
    finalStats: {
      score: gameResult.score,
      linesCleared: gameResult.lines,
      piecesPlaced: gameResult.piecesPlaced,
      grade: gameResult.grade,
      rating: gameResult.rating,
    },
  }
}
