import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LINE_CLEAR_ANIMATION_MS } from '../animations/constants'
import {
  createInitialBackToBackState,
  createInitialComboState,
  resolveChainsAfterLock,
} from '../game/chains'
import { BASE_TICK_MS, MIN_TICK_MS } from '../game/constants'
import { countBoardHoles, getBoardHeight } from '../game/metrics'
import { createPieceGenerator, getNextPiece, peekNextPiece, type PieceGenerator } from '../game/pieceGenerator'
import { calculateGameGrade } from '../game/results'
import { generateGameSeed } from '../game/seededRandom'
import {
  canPlacePiece,
  createEmptyBoard,
  lockAndSpawn,
  movePiece,
  projectGhostPiece,
  rotateWithWallKick,
  spawnNextPiece,
} from '../game/engine'
import { calculateLockScore, levelByLines, softDropScore, tickMsByLevel } from '../game/scoring'
import { saveGameResult } from '../settings/gameHistoryStorage'
import { createPiece } from '../utils/piece'
import { getHighScore, setHighScore } from '../utils/storage'
import type { ActivePiece, BoardMatrix, GameAction, GameMode, GameResult, GameState, GameStats, TetrominoType } from '../types'

interface PendingSpawnState {
  board: BoardMatrix
  activePiece: ActivePiece | null
  nextPieceType: TetrominoType
  pieceGenerator: PieceGenerator
  state: GameState
}

interface GameTimingState {
  startedAtMs: number | null
  pausedAtMs: number | null
  pausedDurationMs: number
}

export interface LockFeedback {
  id: number
  clearedLines: number
  comboCount: number
  comboGrace: number
  backToBackActive: boolean
  backToBackAwarded: boolean
  levelUp: boolean
  wasHardDrop: boolean
  gameOver: boolean
}

interface GameModel {
  board: BoardMatrix
  activePiece: ActivePiece | null
  ghostPiece: ActivePiece | null
  nextPieceType: TetrominoType
  heldPieceType: TetrominoType | null
  canHold: boolean
  pieceGenerator: PieceGenerator
  pendingSpawn: PendingSpawnState | null
  lineClearRows: number[]
  comboState: ReturnType<typeof createInitialComboState>
  backToBackState: ReturnType<typeof createInitialBackToBackState>
  stats: GameStats
  state: GameState
  startLevel: number
  timing: GameTimingState
  runStartHighScore: number
  lockFlashKey: number
  hardDropFlashKey: number
  gameOverFlashKey: number
  lastLockFeedback: LockFeedback | null
  completedGameResult: GameResult | null
  tick: number
}

interface UseGameOptions {
  startLevel: number
  animationsEnabled: boolean
}

const GAME_MODE: GameMode = 'classic'

const createGameStats = (highScore: number, startLevel: number, seed: string): GameStats => {
  return {
    score: 0,
    level: startLevel,
    lines: 0,
    highScore,
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
    seed,
  }
}

const createLobbyGenerator = (seed: string): { pieceGenerator: PieceGenerator; nextPieceType: TetrominoType } => {
  const pieceGenerator = createPieceGenerator(seed, GAME_MODE)
  return {
    pieceGenerator,
    nextPieceType: peekNextPiece(pieceGenerator),
  }
}

const prepareNewRun = (
  seed: string,
): { activePiece: ActivePiece; nextPieceType: TetrominoType; pieceGenerator: PieceGenerator } => {
  const generator = createPieceGenerator(seed, GAME_MODE)
  const firstPiece = getNextPiece(generator)
  const secondPiece = getNextPiece(firstPiece.generator)

  return {
    activePiece: createPiece(firstPiece.pieceType),
    nextPieceType: secondPiece.pieceType,
    pieceGenerator: secondPiece.generator,
  }
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

const createGameResult = (stats: GameStats, endedAt: string): GameResult => {
  return {
    ...stats,
    id: `${stats.seed}-${endedAt}`,
    endedAt,
    finalLevel: stats.level,
    grade: calculateGameGrade(stats),
  }
}

const createInitialModel = (startLevel: number): GameModel => {
  const highScore = getHighScore()
  const seed = generateGameSeed()
  const lobbyState = createLobbyGenerator(seed)

  return {
    board: createEmptyBoard(),
    activePiece: null,
    ghostPiece: null,
    nextPieceType: lobbyState.nextPieceType,
    heldPieceType: null,
    canHold: true,
    pieceGenerator: lobbyState.pieceGenerator,
    pendingSpawn: null,
    lineClearRows: [],
    comboState: createInitialComboState(),
    backToBackState: createInitialBackToBackState(),
    stats: createGameStats(highScore, startLevel, seed),
    state: 'START',
    startLevel,
    timing: {
      startedAtMs: null,
      pausedAtMs: null,
      pausedDurationMs: 0,
    },
    runStartHighScore: highScore,
    lockFlashKey: 0,
    hardDropFlashKey: 0,
    gameOverFlashKey: 0,
    lastLockFeedback: null,
    completedGameResult: null,
    tick: 0,
  }
}

export const useGame = ({ startLevel, animationsEnabled }: UseGameOptions) => {
  const [model, setModel] = useState<GameModel>(() => createInitialModel(startLevel))
  const frameRef = useRef<number | null>(null)
  const lastTickRef = useRef<number>(0)
  const lockFeedbackIdRef = useRef(0)
  const savedResultIdRef = useRef<string | null>(null)

  const resolveLock = useCallback(
    (
      prev: GameModel,
      lockedPiece: ActivePiece,
      hardDropDistance: number,
      wasHardDrop: boolean,
      nowMs: number,
      endedAt: string,
    ): GameModel => {
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
      const highScore = Math.max(prev.stats.highScore, totalScore)
      const nextState: GameState = stepped.gameOver ? 'GAME_OVER' : 'PLAYING'
      const levelUp = level > prev.stats.level
      const previousHoles = countBoardHoles(prev.board)
      const nextHoles = countBoardHoles(stepped.board)
      const piecesPlaced = prev.stats.piecesPlaced + 1

      lockFeedbackIdRef.current += 1
      const feedback: LockFeedback = {
        id: lockFeedbackIdRef.current,
        clearedLines: stepped.clearedLines,
        comboCount: chains.combo.count,
        comboGrace: chains.combo.turnsWithoutClear,
        backToBackActive: chains.backToBackActive,
        backToBackAwarded: chains.backToBackForScore,
        levelUp,
        wasHardDrop,
        gameOver: stepped.gameOver,
      }

      const statsWithLock = syncTimeStats(
        {
          ...prev.stats,
          score: totalScore,
          level,
          lines,
          highScore,
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
        },
        prev.timing,
        nowMs,
      )

      const completedGameResult = stepped.gameOver ? createGameResult(statsWithLock, endedAt) : null
      const base: GameModel = {
        ...prev,
        nextPieceType: stepped.nextPieceType,
        pieceGenerator: stepped.pieceGenerator,
        comboState: chains.combo,
        backToBackState: chains.backToBack,
        stats: statsWithLock,
        canHold: true,
        lockFlashKey: prev.lockFlashKey + 1,
        hardDropFlashKey: wasHardDrop ? prev.hardDropFlashKey + 1 : prev.hardDropFlashKey,
        gameOverFlashKey: stepped.gameOver ? prev.gameOverFlashKey + 1 : prev.gameOverFlashKey,
        lastLockFeedback: feedback,
        completedGameResult,
      }

      if (stepped.clearedLines > 0 && animationsEnabled) {
        return {
          ...base,
          board: stepped.mergedBoard,
          activePiece: null,
          ghostPiece: null,
          lineClearRows: stepped.clearedRows,
          pendingSpawn: {
            board: stepped.board,
            activePiece: stepped.activePiece,
            nextPieceType: stepped.nextPieceType,
            pieceGenerator: stepped.pieceGenerator,
            state: nextState,
          },
          state: 'PLAYING',
        }
      }

      return {
        ...base,
        board: stepped.board,
        activePiece: stepped.activePiece,
        ghostPiece: projectGhostPiece(stepped.board, stepped.activePiece),
        pendingSpawn: null,
        lineClearRows: [],
        state: nextState,
      }
    },
    [animationsEnabled],
  )

  const startGame = useCallback(
    (seedOverride?: string) => {
      const seed = seedOverride ?? generateGameSeed()
      const nowMs = typeof performance !== 'undefined' ? performance.now() : 0
      savedResultIdRef.current = null
      lastTickRef.current = nowMs

      setModel((prev) => {
        const prepared = prepareNewRun(seed)
        const board = createEmptyBoard()
        const stats = createGameStats(prev.stats.highScore, startLevel, seed)

        return {
          ...prev,
          board,
          activePiece: prepared.activePiece,
          ghostPiece: projectGhostPiece(board, prepared.activePiece),
          nextPieceType: prepared.nextPieceType,
          heldPieceType: null,
          canHold: true,
          pieceGenerator: prepared.pieceGenerator,
          pendingSpawn: null,
          lineClearRows: [],
          comboState: createInitialComboState(),
          backToBackState: createInitialBackToBackState(),
          stats,
          state: 'PLAYING',
          startLevel,
          timing: {
            startedAtMs: nowMs,
            pausedAtMs: null,
            pausedDurationMs: 0,
          },
          runStartHighScore: prev.stats.highScore,
          lastLockFeedback: null,
          completedGameResult: null,
          tick: 0,
        }
      })
    },
    [startLevel],
  )

  const restartGame = useCallback(
    (seedOverride?: string) => {
      startGame(seedOverride)
    },
    [startGame],
  )

  const togglePause = useCallback(() => {
    const nowMs = typeof performance !== 'undefined' ? performance.now() : 0
    lastTickRef.current = nowMs

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

  const moveLeft = useCallback((): boolean => {
    let changed = false
    setModel((prev) => {
      if (prev.state !== 'PLAYING' || !prev.activePiece) {
        return prev
      }
      const moved = movePiece(prev.board, prev.activePiece, -1, 0)
      if (!moved) {
        return prev
      }
      changed = true
      return {
        ...prev,
        activePiece: moved,
        ghostPiece: projectGhostPiece(prev.board, moved),
      }
    })
    return changed
  }, [])

  const moveRight = useCallback((): boolean => {
    let changed = false
    setModel((prev) => {
      if (prev.state !== 'PLAYING' || !prev.activePiece) {
        return prev
      }
      const moved = movePiece(prev.board, prev.activePiece, 1, 0)
      if (!moved) {
        return prev
      }
      changed = true
      return {
        ...prev,
        activePiece: moved,
        ghostPiece: projectGhostPiece(prev.board, moved),
      }
    })
    return changed
  }, [])

  const rotateCW = useCallback((): boolean => {
    let changed = false
    setModel((prev) => {
      if (prev.state !== 'PLAYING' || !prev.activePiece) {
        return prev
      }
      const rotated = rotateWithWallKick(prev.board, prev.activePiece, 'CW')
      if (rotated === prev.activePiece) {
        return prev
      }
      changed = true
      return {
        ...prev,
        activePiece: rotated,
        ghostPiece: projectGhostPiece(prev.board, rotated),
        stats: {
          ...prev.stats,
          rotationsUsed: prev.stats.rotationsUsed + 1,
        },
      }
    })
    return changed
  }, [])

  const rotateCCW = useCallback((): boolean => {
    let changed = false
    setModel((prev) => {
      if (prev.state !== 'PLAYING' || !prev.activePiece) {
        return prev
      }
      const rotated = rotateWithWallKick(prev.board, prev.activePiece, 'CCW')
      if (rotated === prev.activePiece) {
        return prev
      }
      changed = true
      return {
        ...prev,
        activePiece: rotated,
        ghostPiece: projectGhostPiece(prev.board, rotated),
        stats: {
          ...prev.stats,
          rotationsUsed: prev.stats.rotationsUsed + 1,
        },
      }
    })
    return changed
  }, [])

  const softDrop = useCallback((): boolean => {
    let changed = false
    const nowMs = typeof performance !== 'undefined' ? performance.now() : 0
    const endedAt = new Date().toISOString()

    setModel((prev) => {
      if (prev.state !== 'PLAYING' || !prev.activePiece) {
        return prev
      }

      const moved = movePiece(prev.board, prev.activePiece, 0, 1)
      if (moved) {
        changed = true
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

      return resolveLock(prev, prev.activePiece, 0, false, nowMs, endedAt)
    })
    return changed
  }, [resolveLock])

  const hardDrop = useCallback((): boolean => {
    let changed = false
    const nowMs = typeof performance !== 'undefined' ? performance.now() : 0
    const endedAt = new Date().toISOString()

    setModel((prev) => {
      if (prev.state !== 'PLAYING' || !prev.activePiece) {
        return prev
      }

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

      changed = true
      return resolveLock(prev, droppedPiece, distance, true, nowMs, endedAt)
    })
    return changed
  }, [resolveLock])

  const hold = useCallback((): boolean => {
    let changed = false
    const nowMs = typeof performance !== 'undefined' ? performance.now() : 0
    const endedAt = new Date().toISOString()

    setModel((prev) => {
      if (prev.state !== 'PLAYING' || !prev.activePiece || !prev.canHold) {
        return prev
      }

      const nextStats = {
        ...prev.stats,
        holdsUsed: prev.stats.holdsUsed + 1,
      }

      if (prev.heldPieceType) {
        const swappedPiece = createPiece(prev.heldPieceType)
        if (!canPlacePiece(prev.board, swappedPiece)) {
          changed = true
          const finalizedStats = syncTimeStats(nextStats, prev.timing, nowMs)
          return {
            ...prev,
            activePiece: null,
            ghostPiece: null,
            heldPieceType: prev.activePiece.type,
            canHold: false,
            stats: finalizedStats,
            state: 'GAME_OVER',
            completedGameResult: createGameResult(finalizedStats, endedAt),
            gameOverFlashKey: prev.gameOverFlashKey + 1,
            lastLockFeedback: null,
          }
        }

        changed = true
        return {
          ...prev,
          activePiece: swappedPiece,
          ghostPiece: projectGhostPiece(prev.board, swappedPiece),
          heldPieceType: prev.activePiece.type,
          canHold: false,
          stats: nextStats,
        }
      }

      const spawned = spawnNextPiece(prev.board, prev.nextPieceType, prev.pieceGenerator)
      if (spawned.gameOver) {
        changed = true
        const finalizedStats = syncTimeStats(nextStats, prev.timing, nowMs)
        return {
          ...prev,
          activePiece: null,
          ghostPiece: null,
          nextPieceType: spawned.nextPieceType,
          pieceGenerator: spawned.pieceGenerator,
          heldPieceType: prev.activePiece.type,
          canHold: false,
          stats: finalizedStats,
          state: 'GAME_OVER',
          completedGameResult: createGameResult(finalizedStats, endedAt),
          gameOverFlashKey: prev.gameOverFlashKey + 1,
          lastLockFeedback: null,
        }
      }

      changed = true
      return {
        ...prev,
        activePiece: spawned.activePiece,
        ghostPiece: projectGhostPiece(prev.board, spawned.activePiece),
        nextPieceType: spawned.nextPieceType,
        pieceGenerator: spawned.pieceGenerator,
        heldPieceType: prev.activePiece.type,
        canHold: false,
        stats: nextStats,
      }
    })
    return changed
  }, [])

  const dispatchGameAction = useCallback(
    (action: GameAction): boolean => {
      // Centralized action dispatch keeps keyboard, touch, and future replays on one path.
      switch (action) {
        case 'moveLeft':
          return moveLeft()
        case 'moveRight':
          return moveRight()
        case 'softDrop':
          return softDrop()
        case 'hardDrop':
          return hardDrop()
        case 'rotateCW':
          return rotateCW()
        case 'rotateCCW':
          return rotateCCW()
        case 'hold':
          return hold()
        case 'pause':
          togglePause()
          return true
        default:
          return false
      }
    },
    [hardDrop, hold, moveLeft, moveRight, rotateCCW, rotateCW, softDrop, togglePause],
  )

  useEffect(() => {
    setHighScore(model.stats.highScore)
  }, [model.stats.highScore])

  useEffect(() => {
    if (!model.completedGameResult || savedResultIdRef.current === model.completedGameResult.id) {
      return
    }

    saveGameResult(model.completedGameResult)
    savedResultIdRef.current = model.completedGameResult.id
  }, [model.completedGameResult])

  useEffect(() => {
    if (!model.pendingSpawn) {
      return
    }

    const timerId = window.setTimeout(() => {
      setModel((prev) => {
        if (!prev.pendingSpawn) {
          return prev
        }

        const pending = prev.pendingSpawn
        const resolvedState: GameState = prev.state === 'PAUSED' ? 'PAUSED' : pending.state
        return {
          ...prev,
          board: pending.board,
          activePiece: pending.activePiece,
          ghostPiece: projectGhostPiece(pending.board, pending.activePiece),
          nextPieceType: pending.nextPieceType,
          pieceGenerator: pending.pieceGenerator,
          state: resolvedState,
          pendingSpawn: null,
          lineClearRows: [],
        }
      })
    }, LINE_CLEAR_ANIMATION_MS)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [model.pendingSpawn])

  useEffect(() => {
    const loop = (ts: number) => {
      const tickMs = tickMsByLevel(model.stats.level, BASE_TICK_MS, MIN_TICK_MS)
      if (model.state === 'PLAYING' && ts - lastTickRef.current >= tickMs) {
        lastTickRef.current = ts
        const endedAt = new Date().toISOString()

        setModel((prev) => {
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

          return resolveLock(prev, prev.activePiece, 0, false, ts, endedAt)
        })
      }
      frameRef.current = window.requestAnimationFrame(loop)
    }

    frameRef.current = window.requestAnimationFrame(loop)
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
      }
    }
  }, [model.state, model.stats.level, resolveLock])

  const isNewRecord = useMemo(() => {
    return model.stats.highScore > model.runStartHighScore
  }, [model.runStartHighScore, model.stats.highScore])

  return {
    board: model.board,
    activePiece: model.activePiece,
    ghostPiece: model.ghostPiece,
    nextPieceType: model.nextPieceType,
    heldPieceType: model.heldPieceType,
    stats: model.stats,
    state: model.state,
    lineClearRows: model.lineClearRows,
    comboCount: model.comboState.count,
    comboGrace: model.comboState.turnsWithoutClear,
    backToBackActive: model.backToBackState.tetrisStreak >= 2,
    lockFlashKey: model.lockFlashKey,
    hardDropFlashKey: model.hardDropFlashKey,
    gameOverFlashKey: model.gameOverFlashKey,
    lastLockFeedback: model.lastLockFeedback,
    completedGameResult: model.completedGameResult,
    tick: model.tick,
    isNewRecord,
    startGame,
    restartGame,
    togglePause,
    dispatchGameAction,
    moveLeft,
    moveRight,
    rotate: rotateCW,
    rotateCW,
    rotateCCW,
    softDrop,
    hardDrop,
    hold,
  }
}
