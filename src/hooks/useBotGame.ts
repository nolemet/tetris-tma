import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createInitialBackToBackState, createInitialComboState, resolveChainsAfterLock } from '../game/chains'
import { countBoardHoles, getBoardHeight } from '../game/metrics'
import { createPieceGenerator, getNextPiece, peekNextPiece, type PieceGenerator } from '../game/pieceGenerator'
import { calculateGameGrade, calculateGameRating } from '../game/results'
import { calculateLockScore, levelByLines } from '../game/scoring'
import { TETROMINO_SHAPES } from '../game/tetrominoes'
import { canPlacePiece, createEmptyBoard, lockAndSpawn, projectGhostPiece } from '../game/engine'
import { chooseBotMove } from '../bot'
import { cloneShape, rotateClockwise } from '../utils/piece'
import type {
  ActivePiece,
  BoardMatrix,
  BotDifficulty,
  GameMode,
  GameResult,
  GameState,
  GameStats,
  TetrominoType,
} from '../types'

interface GameTimingState {
  startedAtMs: number | null
  pausedAtMs: number | null
  pausedDurationMs: number
}

interface BotGameModel {
  board: BoardMatrix
  activePiece: ActivePiece | null
  ghostPiece: ActivePiece | null
  nextPieceType: TetrominoType
  pieceGenerator: PieceGenerator
  comboState: ReturnType<typeof createInitialComboState>
  backToBackState: ReturnType<typeof createInitialBackToBackState>
  stats: GameStats
  state: GameState
  startLevel: number
  timing: GameTimingState
  tick: number
  completedGameResult: GameResult | null
}

interface UseBotGameOptions {
  startLevel: number
  difficulty: BotDifficulty
  mode?: GameMode
  turbo?: boolean
}

const DEFAULT_MODE: GameMode = 'vsBot'

const BOT_SPEED_BY_DIFFICULTY: Record<BotDifficulty, number> = {
  easy: 1200,
  medium: 900,
  hard: 650,
  expert: 450,
}

const getElapsedTimeMs = (timing: GameTimingState, nowMs: number): number => {
  if (timing.startedAtMs === null) {
    return 0
  }

  const activePauseMs = timing.pausedAtMs === null ? 0 : nowMs - timing.pausedAtMs
  return Math.max(0, nowMs - timing.startedAtMs - timing.pausedDurationMs - activePauseMs)
}

const syncTimeStats = (stats: GameStats, timing: GameTimingState, nowMs: number): GameStats => {
  const timePlayedMs = getElapsedTimeMs(timing, nowMs)
  return {
    ...stats,
    timePlayedMs,
    averageTimePerPieceMs: stats.piecesPlaced > 0 ? timePlayedMs / stats.piecesPlaced : 0,
  }
}

const createStats = (startLevel: number, seed: string, mode: GameMode): GameStats => ({
  score: 0,
  level: startLevel,
  lines: 0,
  highScore: 0,
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
  mode,
  seed,
})

const createResult = (stats: GameStats, endedAt: string): GameResult => ({
  ...stats,
  id: `${stats.seed}-${endedAt}-bot`,
  endedAt,
  finalLevel: stats.level,
  grade: calculateGameGrade(stats),
  rating: calculateGameRating(stats),
})

const createPlacedPiece = (pieceType: TetrominoType, rotation: number, x: number, y: number): ActivePiece => {
  let shape = cloneShape(TETROMINO_SHAPES[pieceType])
  const normalizedRotation = ((rotation % 4) + 4) % 4

  for (let step = 0; step < normalizedRotation; step += 1) {
    shape = rotateClockwise(shape)
  }

  return {
    type: pieceType,
    shape,
    x,
    y,
  }
}

const prepareRun = (seed: string, mode: GameMode) => {
  const generator = createPieceGenerator(seed, mode)
  const firstPiece = getNextPiece(generator)
  const secondPiece = getNextPiece(firstPiece.generator)

  return {
    activePiece: createPlacedPiece(firstPiece.pieceType, 0, Math.floor((10 - TETROMINO_SHAPES[firstPiece.pieceType][0].length) / 2), 0),
    nextPieceType: secondPiece.pieceType,
    pieceGenerator: secondPiece.generator,
  }
}

const createSpawnPiece = (pieceType: TetrominoType): ActivePiece => {
  const shape = cloneShape(TETROMINO_SHAPES[pieceType])
  const width = shape[0].length
  const topOffset = shape.findIndex((row) => row.some((cell) => cell === 1))

  return {
    type: pieceType,
    shape,
    x: Math.floor((10 - width) / 2),
    y: -(topOffset === -1 ? 0 : topOffset),
  }
}

const createInitialModel = (startLevel: number, mode: GameMode): BotGameModel => {
  const seed = 'bot-lobby-seed'
  const generator = createPieceGenerator(seed, mode)

  return {
    board: createEmptyBoard(),
    activePiece: null,
    ghostPiece: null,
    nextPieceType: peekNextPiece(generator),
    pieceGenerator: generator,
    comboState: createInitialComboState(),
    backToBackState: createInitialBackToBackState(),
    stats: createStats(startLevel, seed, mode),
    state: 'START',
    startLevel,
    timing: {
      startedAtMs: null,
      pausedAtMs: null,
      pausedDurationMs: 0,
    },
    tick: 0,
    completedGameResult: null,
  }
}

export const useBotGame = ({ startLevel, difficulty, mode = DEFAULT_MODE, turbo = false }: UseBotGameOptions) => {
  const [model, setModel] = useState<BotGameModel>(() => createInitialModel(startLevel, mode))
  const speedMs = turbo ? 180 : BOT_SPEED_BY_DIFFICULTY[difficulty]
  const timerRef = useRef<number | null>(null)
  const difficultyRef = useRef(difficulty)

  useEffect(() => {
    difficultyRef.current = difficulty
  }, [difficulty])

  const startGame = useCallback(
    (seed: string) => {
      const nowMs = typeof performance !== 'undefined' ? performance.now() : 0
      const prepared = prepareRun(seed, mode)
      const activePiece = createSpawnPiece(prepared.activePiece.type)
      const board = createEmptyBoard()

      setModel({
        board,
        activePiece,
        ghostPiece: projectGhostPiece(board, activePiece),
        nextPieceType: prepared.nextPieceType,
        pieceGenerator: prepared.pieceGenerator,
        comboState: createInitialComboState(),
        backToBackState: createInitialBackToBackState(),
        stats: createStats(startLevel, seed, mode),
        state: 'PLAYING',
        startLevel,
        timing: {
          startedAtMs: nowMs,
          pausedAtMs: null,
          pausedDurationMs: 0,
        },
        tick: 0,
        completedGameResult: null,
      })
    },
    [mode, startLevel],
  )

  const togglePause = useCallback(() => {
    const nowMs = typeof performance !== 'undefined' ? performance.now() : 0
    setModel((prev) => {
      if (prev.state === 'PLAYING') {
        return {
          ...prev,
          state: 'PAUSED',
          stats: syncTimeStats(prev.stats, prev.timing, nowMs),
          timing: {
            ...prev.timing,
            pausedAtMs: nowMs,
          },
        }
      }

      if (prev.state === 'PAUSED') {
        const pausedAtMs = prev.timing.pausedAtMs ?? nowMs
        return {
          ...prev,
          state: 'PLAYING',
          timing: {
            startedAtMs: prev.timing.startedAtMs,
            pausedAtMs: null,
            pausedDurationMs: prev.timing.pausedDurationMs + (nowMs - pausedAtMs),
          },
        }
      }

      return prev
    })
  }, [])

  const forceComplete = useCallback(() => {
    const endedAt = new Date().toISOString()
    const nowMs = typeof performance !== 'undefined' ? performance.now() : 0

    setModel((prev) => {
      if (prev.state === 'GAME_OVER') {
        return prev
      }

      const finalStats = syncTimeStats(prev.stats, prev.timing, nowMs)
      return {
        ...prev,
        state: 'GAME_OVER',
        activePiece: null,
        ghostPiece: null,
        stats: finalStats,
        completedGameResult: createResult(finalStats, endedAt),
      }
    })
  }, [])

  useEffect(() => {
    if (model.state !== 'PLAYING' || !model.activePiece) {
      return
    }

    timerRef.current = window.setTimeout(() => {
      const nowMs = typeof performance !== 'undefined' ? performance.now() : 0
      const endedAt = new Date().toISOString()

      setModel((prev) => {
        if (prev.state !== 'PLAYING' || !prev.activePiece) {
          return prev
        }

        let selectedPlacement
        try {
          selectedPlacement = chooseBotMove(prev.board, prev.activePiece, difficultyRef.current, {
            nextPiece: prev.nextPieceType,
          }).bestPlacement
        } catch {
          const finalStats = syncTimeStats(prev.stats, prev.timing, nowMs)
          return {
            ...prev,
            state: 'GAME_OVER',
            completedGameResult: createResult(finalStats, endedAt),
            stats: finalStats,
            activePiece: null,
            ghostPiece: null,
          }
        }

        const lockedPiece = createPlacedPiece(
          prev.activePiece.type,
          selectedPlacement.rotation,
          selectedPlacement.x,
          selectedPlacement.y,
        )

        if (!canPlacePiece(prev.board, lockedPiece)) {
          const finalStats = syncTimeStats(prev.stats, prev.timing, nowMs)
          return {
            ...prev,
            state: 'GAME_OVER',
            completedGameResult: createResult(finalStats, endedAt),
            stats: finalStats,
            activePiece: null,
            ghostPiece: null,
          }
        }

        const stepped = lockAndSpawn(prev.board, lockedPiece, prev.nextPieceType, prev.pieceGenerator)
        const chains = resolveChainsAfterLock(prev.comboState, prev.backToBackState, stepped.clearedLines)
        const hardDropDistance = Math.max(0, selectedPlacement.y - prev.activePiece.y)
        const scoreBreakdown = calculateLockScore({
          clearedLines: stepped.clearedLines,
          comboIndex: chains.comboIndex,
          hardDropDistance,
          backToBackActive: chains.backToBackForScore,
        })
        const lines = prev.stats.lines + stepped.clearedLines
        const level = levelByLines(lines, prev.startLevel)
        const totalScore = prev.stats.score + scoreBreakdown.total
        const previousHoles = countBoardHoles(prev.board)
        const nextHoles = countBoardHoles(stepped.board)
        const piecesPlaced = prev.stats.piecesPlaced + 1

        const nextStats = syncTimeStats(
          {
            ...prev.stats,
            score: totalScore,
            highScore: Math.max(prev.stats.highScore, totalScore),
            level,
            lines,
            piecesPlaced,
            singles: prev.stats.singles + Number(stepped.clearedLines === 1),
            doubles: prev.stats.doubles + Number(stepped.clearedLines === 2),
            triples: prev.stats.triples + Number(stepped.clearedLines === 3),
            tetrises: prev.stats.tetrises + Number(stepped.clearedLines === 4),
            maxCombo: Math.max(prev.stats.maxCombo, chains.combo.count),
            currentCombo: chains.combo.count,
            hardDropsUsed: prev.stats.hardDropsUsed + 1,
            maxBoardHeight: Math.max(prev.stats.maxBoardHeight, getBoardHeight(stepped.board)),
            holesCreated: prev.stats.holesCreated + Math.max(0, nextHoles - previousHoles),
          },
          prev.timing,
          nowMs,
        )

        const nextState: GameState = stepped.gameOver ? 'GAME_OVER' : 'PLAYING'
        const nextActivePiece = stepped.gameOver ? null : stepped.activePiece

        return {
          ...prev,
          board: stepped.board,
          activePiece: nextActivePiece,
          ghostPiece: stepped.gameOver ? null : projectGhostPiece(stepped.board, stepped.activePiece),
          nextPieceType: stepped.nextPieceType,
          pieceGenerator: stepped.pieceGenerator,
          comboState: chains.combo,
          backToBackState: chains.backToBack,
          stats: nextStats,
          state: nextState,
          tick: prev.tick + 1,
          completedGameResult: stepped.gameOver ? createResult(nextStats, endedAt) : null,
        }
      })
    }, speedMs)

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [model.activePiece, model.state, speedMs])

  const isRunning = useMemo(() => model.state === 'PLAYING', [model.state])

  return {
    board: model.board,
    activePiece: model.activePiece,
    ghostPiece: model.ghostPiece,
    nextPieceType: model.nextPieceType,
    stats: model.stats,
    state: model.state,
    completedGameResult: model.completedGameResult,
    isRunning,
    speedMs,
    startGame,
    togglePause,
    forceComplete,
  }
}
