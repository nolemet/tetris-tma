import { createInitialBackToBackState, createInitialComboState, resolveChainsAfterLock } from '../game/chains'
import { countBoardHoles, getBoardHeight } from '../game/metrics'
import { createPieceGenerator, getNextPiece, type PieceGenerator } from '../game/pieceGenerator'
import {
  createEmptyBoard,
  lockAndSpawn,
  movePiece,
  projectGhostPiece,
  rotateWithWallKick,
} from '../game/engine'
import { calculateGameGrade, calculateGameRating } from '../game/results'
import { calculateLockScore, levelByLines, softDropScore, tickMsByLevel } from '../game/scoring'
import { TETROMINO_SHAPES } from '../game/tetrominoes'
import { createPiece, rotateClockwise } from '../utils/piece'
import type { ActivePiece, BoardMatrix, GameAction, GameResult, GameState, GameStats, TetrominoType } from '../types'
import type {
  GameReplay,
  GameReplayV1,
  GameReplayV2,
  GameReplayV3,
  ReplayFinalStats,
  ReplayFrame,
  VisualFrame,
  VisualPieceSnapshot,
} from './types'
import { isReplayV2, isReplayV3 } from './types'

interface LegacyReplayModel {
  board: BoardMatrix
  activePiece: ActivePiece | null
  ghostPiece: ActivePiece | null
  nextPieceType: TetrominoType
  heldPieceType: TetrominoType | null
  canHold: boolean
  pieceGenerator: PieceGenerator
  comboState: ReturnType<typeof createInitialComboState>
  backToBackState: ReturnType<typeof createInitialBackToBackState>
  stats: GameStats
  state: GameState
  startLevel: number
  tick: number
  completedGameResult: GameResult | null
}

export interface ReplayRenderState {
  board: BoardMatrix
  activePiece: ActivePiece | null
  ghostPiece: ActivePiece | null
  nextPieceType: TetrominoType | null
  score: number
  lines: number
  pieces: number
  level: number
  tick: number
  grade: GameResult['grade'] | null
  rating: number | null
}

interface ReplayPlaybackBase<TReplay extends GameReplay, TKind extends 'legacy' | 'snapshot' | 'smooth'> {
  kind: TKind
  replay: TReplay
  currentTimeMs: number
  finished: boolean
  warning: string | null
}

export interface LegacyReplayPlaybackState extends ReplayPlaybackBase<GameReplayV1, 'legacy'> {
  model: LegacyReplayModel
  inputIndex: number
  simulatedTimeMs: number
}

export interface SnapshotReplayPlaybackState extends ReplayPlaybackBase<GameReplayV2, 'snapshot'> {
  frameIndex: number
}

export interface SmoothReplayPlaybackState extends ReplayPlaybackBase<GameReplayV3, 'smooth'> {
  frameIndex: number
}

export type ReplayPlaybackState =
  | LegacyReplayPlaybackState
  | SnapshotReplayPlaybackState
  | SmoothReplayPlaybackState

const GAME_MODE = 'classic' as const
const LEGACY_WARNING = 'Legacy input replay may differ from original'
const SNAPSHOT_WARNING = 'Replay finished, result may differ from original'

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value))
}

const sameBoard = (left: BoardMatrix, right: BoardMatrix): boolean => {
  if (left.length !== right.length) {
    return false
  }

  for (let rowIndex = 0; rowIndex < left.length; rowIndex += 1) {
    if (left[rowIndex].length !== right[rowIndex].length) {
      return false
    }
    for (let columnIndex = 0; columnIndex < left[rowIndex].length; columnIndex += 1) {
      if (left[rowIndex][columnIndex] !== right[rowIndex][columnIndex]) {
        return false
      }
    }
  }

  return true
}

const createReplayStats = (replay: GameReplayV1): GameStats => {
  return {
    score: 0,
    level: replay.startLevel,
    lines: 0,
    highScore: replay.finalStats.score,
    piecesPlaced: 0,
    singles: 0,
    doubles: 0,
    triples: 0,
    tetrises: 0,
    maxCombo: 0,
    currentCombo: 0,
    holdsUsed: 0,
    rotationsUsed: 0,
    hardDropsUsed: 0,
    softDropsUsed: 0,
    maxBoardHeight: 0,
    holesCreated: 0,
    timePlayedMs: 0,
    averageTimePerPieceMs: 0,
    mode: GAME_MODE,
    seed: replay.seed,
  }
}

const prepareLegacyReplayRun = (replay: GameReplayV1): {
  activePiece: ActivePiece
  nextPieceType: TetrominoType
  pieceGenerator: PieceGenerator
} => {
  const generator = createPieceGenerator(replay.seed, GAME_MODE)
  const firstPiece = getNextPiece(generator)
  const secondPiece = getNextPiece(firstPiece.generator)

  return {
    activePiece: createPiece(firstPiece.pieceType),
    nextPieceType: secondPiece.pieceType,
    pieceGenerator: secondPiece.generator,
  }
}

const createLegacyReplayGameResult = (stats: GameStats, replay: GameReplayV1): GameResult => {
  const completedStats: GameStats = {
    ...stats,
    timePlayedMs: replay.durationMs,
    averageTimePerPieceMs: stats.piecesPlaced > 0 ? replay.durationMs / stats.piecesPlaced : 0,
  }

  return {
    ...completedStats,
    id: replay.gameId,
    endedAt: new Date(replay.finishedAt).toISOString(),
    finalLevel: completedStats.level,
    grade: calculateGameGrade(completedStats),
    rating: calculateGameRating(completedStats),
    replayId: replay.id,
  }
}

const createLegacyReplayModel = (replay: GameReplayV1): LegacyReplayModel => {
  const prepared = prepareLegacyReplayRun(replay)
  const board = createEmptyBoard()

  return {
    board,
    activePiece: prepared.activePiece,
    ghostPiece: projectGhostPiece(board, prepared.activePiece),
    nextPieceType: prepared.nextPieceType,
    heldPieceType: null,
    canHold: false,
    pieceGenerator: prepared.pieceGenerator,
    comboState: createInitialComboState(),
    backToBackState: createInitialBackToBackState(),
    stats: createReplayStats(replay),
    state: 'PLAYING',
    startLevel: replay.startLevel,
    tick: 0,
    completedGameResult: null,
  }
}

const buildPieceFromSnapshot = (snapshot: VisualPieceSnapshot | null | undefined): ActivePiece | null => {
  if (!snapshot) {
    return null
  }

  let shape = TETROMINO_SHAPES[snapshot.type].map((row) => [...row])
  for (let rotation = 0; rotation < snapshot.rotation; rotation += 1) {
    shape = rotateClockwise(shape)
  }

  return {
    type: snapshot.type,
    shape,
    x: snapshot.x,
    y: snapshot.y,
  }
}

const interpolatePieceSnapshot = (
  current: VisualPieceSnapshot | null | undefined,
  next: VisualPieceSnapshot | null | undefined,
  progress: number,
): VisualPieceSnapshot | null => {
  if (!current) {
    return null
  }
  if (!next) {
    return current
  }
  if (current.type !== next.type || current.rotation !== next.rotation) {
    return current
  }

  return {
    ...current,
    x: current.x + (next.x - current.x) * progress,
    y: current.y + (next.y - current.y) * progress,
  }
}

const findFrameIndexByTime = <TFrame extends { timeMs: number }>(frames: TFrame[], timeMs: number): number => {
  if (frames.length === 0) {
    return 0
  }

  let low = 0
  let high = frames.length - 1

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    if (frames[mid].timeMs <= timeMs) {
      low = mid + 1
    } else {
      high = mid - 1
    }
  }

  return clamp(high, 0, frames.length - 1)
}

const getReplayFinalGrade = (replay: GameReplay): GameResult['grade'] => {
  return replay.finalStats.grade
}

const matchesFinalStats = (
  candidate: Pick<ReplayFinalStats, 'score' | 'linesCleared' | 'piecesPlaced' | 'grade' | 'rating'>,
  finalStats: ReplayFinalStats,
): boolean => {
  return (
    candidate.score === finalStats.score &&
    candidate.linesCleared === finalStats.linesCleared &&
    candidate.piecesPlaced === finalStats.piecesPlaced &&
    candidate.grade === finalStats.grade &&
    candidate.rating === finalStats.rating
  )
}

const createSnapshotMismatchWarning = (replay: GameReplayV2): string | null => {
  const finalFrame = replay.frames.at(-1)
  if (!finalFrame) {
    return SNAPSHOT_WARNING
  }

  return matchesFinalStats(
    {
      score: finalFrame.score,
      linesCleared: finalFrame.linesCleared,
      piecesPlaced: finalFrame.piecesPlaced,
      grade: finalFrame.grade ?? replay.finalStats.grade,
      rating: finalFrame.rating ?? replay.finalStats.rating,
    },
    replay.finalStats,
  )
    ? null
    : SNAPSHOT_WARNING
}

const createSmoothMismatchWarning = (replay: GameReplayV3): string | null => {
  const finalVisualFrame = replay.visualFrames.at(-1)
  const finalFrame = replay.frames.at(-1)
  const candidate = finalVisualFrame ?? finalFrame
  if (!candidate) {
    return SNAPSHOT_WARNING
  }

  return matchesFinalStats(
    {
      score: candidate.score,
      linesCleared: candidate.linesCleared,
      piecesPlaced: candidate.piecesPlaced,
      grade: candidate.grade ?? replay.finalStats.grade,
      rating: candidate.rating ?? replay.finalStats.rating,
    },
    replay.finalStats,
  )
    ? null
    : SNAPSHOT_WARNING
}

const resolveLegacyLock = (
  prev: LegacyReplayModel,
  lockedPiece: ActivePiece,
  hardDropDistance: number,
  wasHardDrop: boolean,
  replay: GameReplayV1,
): LegacyReplayModel => {
  const stepped = lockAndSpawn(prev.board, lockedPiece, prev.nextPieceType, prev.pieceGenerator)
  const chains = resolveChainsAfterLock(prev.comboState, prev.backToBackState, stepped.clearedLines)
  const score = calculateLockScore({
    clearedLines: stepped.clearedLines,
    comboIndex: chains.comboIndex,
    hardDropDistance,
    backToBackActive: chains.backToBackForScore,
  })
  const lines = prev.stats.lines + stepped.clearedLines
  const level = levelByLines(lines, prev.startLevel)
  const totalScore = prev.stats.score + score.total
  const previousHoles = countBoardHoles(prev.board)
  const nextHoles = countBoardHoles(stepped.board)
  const piecesPlaced = prev.stats.piecesPlaced + 1
  const statsWithLock: GameStats = {
    ...prev.stats,
    score: totalScore,
    level,
    lines,
    highScore: Math.max(prev.stats.highScore, totalScore),
    piecesPlaced,
    singles: prev.stats.singles + Number(stepped.clearedLines === 1),
    doubles: prev.stats.doubles + Number(stepped.clearedLines === 2),
    triples: prev.stats.triples + Number(stepped.clearedLines === 3),
    tetrises: prev.stats.tetrises + Number(stepped.clearedLines === 4),
    maxCombo: Math.max(prev.stats.maxCombo, chains.combo.count),
    currentCombo: chains.combo.count,
    hardDropsUsed: prev.stats.hardDropsUsed + Number(wasHardDrop),
    maxBoardHeight: Math.max(prev.stats.maxBoardHeight, getBoardHeight(stepped.board)),
    holesCreated: prev.stats.holesCreated + Math.max(0, nextHoles - previousHoles),
  }
  const nextState: GameState = stepped.gameOver ? 'GAME_OVER' : 'PLAYING'

  return {
    ...prev,
    board: stepped.board,
    activePiece: stepped.activePiece,
    ghostPiece: projectGhostPiece(stepped.board, stepped.activePiece),
    nextPieceType: stepped.nextPieceType,
    pieceGenerator: stepped.pieceGenerator,
    comboState: chains.combo,
    backToBackState: chains.backToBack,
    stats: statsWithLock,
    state: nextState,
    canHold: false,
    completedGameResult: stepped.gameOver ? createLegacyReplayGameResult(statsWithLock, replay) : null,
  }
}

const applyLegacyReplayAction = (
  prev: LegacyReplayModel,
  action: GameAction,
  replay: GameReplayV1,
): LegacyReplayModel => {
  if (prev.state !== 'PLAYING' || !prev.activePiece) {
    return prev
  }

  switch (action) {
    case 'moveLeft': {
      const moved = movePiece(prev.board, prev.activePiece, -1, 0)
      return moved
        ? {
            ...prev,
            activePiece: moved,
            ghostPiece: projectGhostPiece(prev.board, moved),
          }
        : prev
    }
    case 'moveRight': {
      const moved = movePiece(prev.board, prev.activePiece, 1, 0)
      return moved
        ? {
            ...prev,
            activePiece: moved,
            ghostPiece: projectGhostPiece(prev.board, moved),
          }
        : prev
    }
    case 'rotateCW': {
      const rotated = rotateWithWallKick(prev.board, prev.activePiece, 'CW')
      return rotated !== prev.activePiece
        ? {
            ...prev,
            activePiece: rotated,
            ghostPiece: projectGhostPiece(prev.board, rotated),
            stats: {
              ...prev.stats,
              rotationsUsed: prev.stats.rotationsUsed + 1,
            },
          }
        : prev
    }
    case 'rotateCCW': {
      const rotated = rotateWithWallKick(prev.board, prev.activePiece, 'CCW')
      return rotated !== prev.activePiece
        ? {
            ...prev,
            activePiece: rotated,
            ghostPiece: projectGhostPiece(prev.board, rotated),
            stats: {
              ...prev.stats,
              rotationsUsed: prev.stats.rotationsUsed + 1,
            },
          }
        : prev
    }
    case 'softDrop': {
      const moved = movePiece(prev.board, prev.activePiece, 0, 1)
      if (moved) {
        const scoreDelta = softDropScore(1)
        const score = prev.stats.score + scoreDelta
        return {
          ...prev,
          activePiece: moved,
          ghostPiece: projectGhostPiece(prev.board, moved),
          stats: {
            ...prev.stats,
            score,
            highScore: Math.max(prev.stats.highScore, score),
            softDropsUsed: prev.stats.softDropsUsed + 1,
          },
        }
      }

      return resolveLegacyLock(prev, prev.activePiece, 0, false, replay)
    }
    case 'hardDrop': {
      let droppedPiece = prev.activePiece
      let distance = 0

      while (true) {
        const moved = movePiece(prev.board, droppedPiece, 0, 1)
        if (!moved) {
          break
        }
        droppedPiece = moved
        distance += 1
      }

      return resolveLegacyLock(prev, droppedPiece, distance, true, replay)
    }
    case 'hold':
    case 'pause':
      return prev
    default:
      return prev
  }
}

const advanceLegacyGravity = (prev: LegacyReplayModel, replay: GameReplayV1): LegacyReplayModel => {
  if (prev.state !== 'PLAYING' || !prev.activePiece) {
    return prev
  }

  const moved = movePiece(prev.board, prev.activePiece, 0, 1)
  if (moved) {
    return {
      ...prev,
      activePiece: moved,
      ghostPiece: projectGhostPiece(prev.board, moved),
      tick: prev.tick + 1,
    }
  }

  return {
    ...resolveLegacyLock(prev, prev.activePiece, 0, false, replay),
    tick: prev.tick + 1,
  }
}

const getLegacyStepDurationMs = (state: LegacyReplayPlaybackState): number => {
  return Math.max(50, Math.round(tickMsByLevel(state.model.stats.level, 760, 120)))
}

const stepLegacyReplay = (state: LegacyReplayPlaybackState): LegacyReplayPlaybackState => {
  if (state.finished) {
    return state
  }

  let model = state.model
  let inputIndex = state.inputIndex

  while (
    inputIndex < state.replay.inputs.length &&
    state.replay.inputs[inputIndex].tick === model.tick &&
    model.state !== 'GAME_OVER'
  ) {
    model = applyLegacyReplayAction(model, state.replay.inputs[inputIndex].action, state.replay)
    inputIndex += 1
  }

  if (model.state === 'PLAYING') {
    model = advanceLegacyGravity(model, state.replay)
  }

  const stepDurationMs = getLegacyStepDurationMs(state)
  const simulatedTimeMs = Math.min(state.replay.durationMs, state.simulatedTimeMs + stepDurationMs)
  return {
    ...state,
    model,
    inputIndex,
    simulatedTimeMs,
    currentTimeMs: simulatedTimeMs,
    finished: model.state === 'GAME_OVER' || simulatedTimeMs >= state.replay.durationMs,
    warning: LEGACY_WARNING,
  }
}

const seekLegacyReplayPlayback = (state: LegacyReplayPlaybackState, targetTimeMs: number): LegacyReplayPlaybackState => {
  const clampedTimeMs = clamp(targetTimeMs, 0, state.replay.durationMs)
  let cursor =
    clampedTimeMs >= state.simulatedTimeMs
      ? state
      : ({
          kind: 'legacy',
          replay: state.replay,
          model: createLegacyReplayModel(state.replay),
          inputIndex: 0,
          simulatedTimeMs: 0,
          currentTimeMs: 0,
          finished: false,
          warning: LEGACY_WARNING,
        } satisfies LegacyReplayPlaybackState)

  while (!cursor.finished) {
    const stepDurationMs = getLegacyStepDurationMs(cursor)
    if (cursor.simulatedTimeMs + stepDurationMs > clampedTimeMs) {
      break
    }
    cursor = stepLegacyReplay(cursor)
  }

  return {
    ...cursor,
    currentTimeMs: clampedTimeMs,
    finished: clampedTimeMs >= cursor.replay.durationMs ? cursor.finished || cursor.model.state === 'GAME_OVER' : cursor.finished,
    warning: LEGACY_WARNING,
  }
}

const canInterpolateVisualFrames = (current: VisualFrame, next: VisualFrame): boolean => {
  if (!current.activePiece || !next.activePiece) {
    return false
  }

  return (
    current.activePiece.type === next.activePiece.type &&
    current.activePiece.rotation === next.activePiece.rotation &&
    sameBoard(current.board, next.board)
  )
}

const createRenderStateFromSnapshotFrame = (
  frame: ReplayFrame | undefined,
  replay: GameReplayV2,
): ReplayRenderState => {
  if (!frame) {
    return {
      board: createEmptyBoard(),
      activePiece: null,
      ghostPiece: null,
      nextPieceType: null,
      score: 0,
      lines: 0,
      pieces: 0,
      level: replay.startLevel,
      tick: 0,
      grade: replay.finalStats.grade,
      rating: replay.finalStats.rating,
    }
  }

  return {
    board: frame.board,
    activePiece: null,
    ghostPiece: null,
    nextPieceType: frame.nextPiece ?? null,
    score: frame.score,
    lines: frame.linesCleared,
    pieces: frame.piecesPlaced,
    level: frame.level,
    tick: frame.tick,
    grade: frame.grade ?? replay.finalStats.grade,
    rating: frame.rating ?? replay.finalStats.rating,
  }
}

const createRenderStateFromVisualFrame = (
  playback: SmoothReplayPlaybackState,
): ReplayRenderState => {
  const currentFrame = playback.replay.visualFrames[playback.frameIndex]
  const nextFrame = playback.replay.visualFrames[playback.frameIndex + 1]
  if (!currentFrame) {
    return {
      board: createEmptyBoard(),
      activePiece: null,
      ghostPiece: null,
      nextPieceType: null,
      score: 0,
      lines: 0,
      pieces: 0,
      level: playback.replay.startLevel,
      tick: 0,
      grade: playback.replay.finalStats.grade,
      rating: playback.replay.finalStats.rating,
    }
  }

  let progress = 0
  if (nextFrame && nextFrame.timeMs > currentFrame.timeMs) {
    progress = clamp(
      (playback.currentTimeMs - currentFrame.timeMs) / (nextFrame.timeMs - currentFrame.timeMs),
      0,
      1,
    )
  }

  const activePiece = canInterpolateVisualFrames(currentFrame, nextFrame ?? currentFrame)
    ? buildPieceFromSnapshot(interpolatePieceSnapshot(currentFrame.activePiece, nextFrame?.activePiece, progress))
    : buildPieceFromSnapshot(currentFrame.activePiece)
  const ghostPiece = canInterpolateVisualFrames(currentFrame, nextFrame ?? currentFrame)
    ? buildPieceFromSnapshot(interpolatePieceSnapshot(currentFrame.ghostPiece, nextFrame?.ghostPiece, progress))
    : buildPieceFromSnapshot(currentFrame.ghostPiece)

  return {
    board: currentFrame.board,
    activePiece,
    ghostPiece,
    nextPieceType: currentFrame.nextPiece ?? null,
    score: currentFrame.score,
    lines: currentFrame.linesCleared,
    pieces: currentFrame.piecesPlaced,
    level: currentFrame.level,
    tick: currentFrame.tick,
    grade: currentFrame.grade ?? playback.replay.finalStats.grade,
    rating: currentFrame.rating ?? playback.replay.finalStats.rating,
  }
}

export const createReplayPlaybackState = (replay: GameReplay): ReplayPlaybackState => {
  if (isReplayV3(replay)) {
    return {
      kind: 'smooth',
      replay,
      currentTimeMs: 0,
      frameIndex: 0,
      finished: replay.durationMs <= 0,
      warning: replay.durationMs <= 0 ? createSmoothMismatchWarning(replay) : null,
    }
  }

  if (isReplayV2(replay)) {
    return {
      kind: 'snapshot',
      replay,
      currentTimeMs: 0,
      frameIndex: 0,
      finished: replay.durationMs <= 0,
      warning: replay.durationMs <= 0 ? createSnapshotMismatchWarning(replay) : null,
    }
  }

  return {
    kind: 'legacy',
    replay,
    model: createLegacyReplayModel(replay),
    inputIndex: 0,
    simulatedTimeMs: 0,
    currentTimeMs: 0,
    finished: false,
    warning: LEGACY_WARNING,
  }
}

export const getReplayDurationMs = (playback: ReplayPlaybackState): number => playback.replay.durationMs

export const getReplayCurrentTimeMs = (playback: ReplayPlaybackState): number => playback.currentTimeMs

export const getReplayKindLabel = (replay: GameReplay): string => {
  if (isReplayV3(replay)) {
    return 'Smooth replay'
  }
  if (isReplayV2(replay)) {
    return 'Snapshot replay'
  }
  return 'Legacy replay'
}

export const seekReplayPlayback = (state: ReplayPlaybackState, targetTimeMs: number): ReplayPlaybackState => {
  const clampedTimeMs = clamp(targetTimeMs, 0, state.replay.durationMs)

  if (state.kind === 'smooth') {
    const frameIndex = findFrameIndexByTime(state.replay.visualFrames, clampedTimeMs)
    const finished = clampedTimeMs >= state.replay.durationMs
    return {
      ...state,
      currentTimeMs: clampedTimeMs,
      frameIndex,
      finished,
      warning: finished ? createSmoothMismatchWarning(state.replay) : null,
    }
  }

  if (state.kind === 'snapshot') {
    const frameIndex = findFrameIndexByTime(state.replay.frames, clampedTimeMs)
    const finished = clampedTimeMs >= state.replay.durationMs
    return {
      ...state,
      currentTimeMs: clampedTimeMs,
      frameIndex,
      finished,
      warning: finished ? createSnapshotMismatchWarning(state.replay) : null,
    }
  }

  return seekLegacyReplayPlayback(state, clampedTimeMs)
}

export const getReplayRenderState = (playback: ReplayPlaybackState): ReplayRenderState => {
  if (playback.kind === 'smooth') {
    return createRenderStateFromVisualFrame(playback)
  }

  if (playback.kind === 'snapshot') {
    return createRenderStateFromSnapshotFrame(playback.replay.frames[playback.frameIndex], playback.replay)
  }

  return {
    board: playback.model.board,
    activePiece: playback.model.activePiece,
    ghostPiece: playback.model.ghostPiece,
    nextPieceType: playback.model.nextPieceType,
    score: playback.model.stats.score,
    lines: playback.model.stats.lines,
    pieces: playback.model.stats.piecesPlaced,
    level: playback.model.stats.level,
    tick: playback.model.tick,
    grade: playback.model.completedGameResult?.grade ?? getReplayFinalGrade(playback.replay),
    rating: playback.model.completedGameResult?.rating ?? playback.replay.finalStats.rating,
  }
}
