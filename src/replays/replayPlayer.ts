import { createInitialBackToBackState, createInitialComboState, resolveChainsAfterLock } from '../game/chains'
import { BASE_TICK_MS, MIN_TICK_MS } from '../game/constants'
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
import { createPiece } from '../utils/piece'
import type { ActivePiece, BoardMatrix, GameAction, GameResult, GameState, GameStats, TetrominoType } from '../types'
import type { GameReplay } from './types'

interface ReplayModel {
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

export interface ReplayPlaybackState {
  replay: GameReplay
  model: ReplayModel
  inputIndex: number
  finished: boolean
  warning: string | null
}

const GAME_MODE = 'classic' as const

const createReplayStats = (replay: GameReplay): GameStats => {
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

const prepareReplayRun = (replay: GameReplay): {
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

const createReplayGameResult = (stats: GameStats, replay: GameReplay): GameResult => {
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

const createReplayModel = (replay: GameReplay): ReplayModel => {
  const prepared = prepareReplayRun(replay)
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

const resolveLock = (
  prev: ReplayModel,
  lockedPiece: ActivePiece,
  hardDropDistance: number,
  wasHardDrop: boolean,
  replay: GameReplay,
): ReplayModel => {
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
    completedGameResult: stepped.gameOver ? createReplayGameResult(statsWithLock, replay) : null,
  }
}

const applyReplayAction = (prev: ReplayModel, action: GameAction, replay: GameReplay): ReplayModel => {
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

      return resolveLock(prev, prev.activePiece, 0, false, replay)
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

      return resolveLock(prev, droppedPiece, distance, true, replay)
    }
    case 'hold':
    case 'pause':
      return prev
    default:
      return prev
  }
}

const advanceGravity = (prev: ReplayModel, replay: GameReplay): ReplayModel => {
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
    ...resolveLock(prev, prev.activePiece, 0, false, replay),
    tick: prev.tick + 1,
  }
}

const createWarning = (replay: GameReplay, model: ReplayModel): string | null => {
  const result = model.completedGameResult
  if (!result) {
    return null
  }

  const matches =
    result.score === replay.finalStats.score &&
    result.lines === replay.finalStats.linesCleared &&
    result.piecesPlaced === replay.finalStats.piecesPlaced

  return matches ? null : 'Replay finished, result may differ from original'
}

export const createReplayPlaybackState = (replay: GameReplay): ReplayPlaybackState => {
  return {
    replay,
    model: createReplayModel(replay),
    inputIndex: 0,
    finished: false,
    warning: null,
  }
}

export const stepReplayPlayback = (state: ReplayPlaybackState): ReplayPlaybackState => {
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
    model = applyReplayAction(model, state.replay.inputs[inputIndex].action, state.replay)
    inputIndex += 1
  }

  if (model.state === 'PLAYING') {
    model = advanceGravity(model, state.replay)
  }

  const finished = model.state === 'GAME_OVER'
  return {
    ...state,
    model,
    inputIndex,
    finished,
    warning: finished ? createWarning(state.replay, model) : null,
  }
}

export const getReplayStepDurationMs = (state: ReplayPlaybackState, speed: number): number => {
  const safeSpeed = speed > 0 ? speed : 1
  return Math.max(50, Math.round(tickMsByLevel(state.model.stats.level, BASE_TICK_MS, MIN_TICK_MS) / safeSpeed))
}
