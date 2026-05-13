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
import { calculateGameGrade, calculateGameRating } from '../game/results'
import { generateGameSeed } from '../game/seededRandom'
import { TETROMINO_SHAPES } from '../game/tetrominoes'
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
import type { ReplayFrame, ReplayMoveEvent, VisualFrame, VisualFrameEvent, VisualPieceSnapshot } from '../replays/types'
import { createPiece, rotateClockwise } from '../utils/piece'
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

interface ActiveMoveReplaySeed {
  pieceIndex: number
  pieceType: TetrominoType
  nextPieceType: TetrominoType | null
  boardBefore: BoardMatrix
  spawnTick: number
  spawnTimeMs: number
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
  replayFrames: ReplayFrame[]
  visualReplayFrames: VisualFrame[]
  moveReplayEvents: ReplayMoveEvent[]
  activeMoveReplaySeed: ActiveMoveReplaySeed | null
}

interface UseGameOptions {
  startLevel: number
  animationsEnabled: boolean
}

const GAME_MODE: GameMode = 'classic'
// We keep replay capture lightweight: authoritative frames for exact results and visual frames
// capped around 30fps, instead of storing 60 full board snapshots per second like a video.
const VISUAL_CAPTURE_INTERVAL_MS = 1000 / 30
const KEYFRAME_VISUAL_EVENTS = new Set<VisualFrameEvent>(['start', 'lock', 'lineClear', 'gameOver', 'hardDrop'])

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
    rating: calculateGameRating(stats),
  }
}

const cloneBoard = (board: BoardMatrix): BoardMatrix => {
  return board.map((row) => [...row])
}

const createActiveMoveReplaySeed = ({
  board,
  activePiece,
  nextPieceType,
  pieceIndex,
  spawnTick,
  spawnTimeMs,
}: {
  board: BoardMatrix
  activePiece: ActivePiece | null
  nextPieceType: TetrominoType | null
  pieceIndex: number
  spawnTick: number
  spawnTimeMs: number
}): ActiveMoveReplaySeed | null => {
  if (!activePiece) {
    return null
  }

  return {
    pieceIndex,
    pieceType: activePiece.type,
    nextPieceType,
    boardBefore: cloneBoard(board),
    spawnTick,
    spawnTimeMs: Math.max(0, Math.round(spawnTimeMs)),
  }
}

const createReplayMoveEvent = ({
  seed,
  moveSeed,
  lockedPiece,
  boardAfter,
  lockTick,
  lockTimeMs,
  linesCleared,
  scoreAfter,
  levelAfter,
  comboAfter,
}: {
  seed: string
  moveSeed: ActiveMoveReplaySeed
  lockedPiece: ActivePiece
  boardAfter: BoardMatrix
  lockTick: number
  lockTimeMs: number
  linesCleared: number
  scoreAfter: number
  levelAfter: number
  comboAfter: number
}): ReplayMoveEvent => {
  return {
    id: `${seed}-move-${moveSeed.pieceIndex}-${Math.max(0, Math.round(lockTimeMs))}`,
    pieceIndex: moveSeed.pieceIndex,
    pieceType: moveSeed.pieceType,
    nextPieceType: moveSeed.nextPieceType,
    boardBefore: cloneBoard(moveSeed.boardBefore),
    boardAfter: cloneBoard(boardAfter),
    spawnTick: moveSeed.spawnTick,
    lockTick,
    spawnTimeMs: moveSeed.spawnTimeMs,
    lockTimeMs: Math.max(0, Math.round(lockTimeMs)),
    playerPlacement: {
      pieceType: lockedPiece.type,
      x: lockedPiece.x,
      y: lockedPiece.y,
      rotation: getPieceRotation(lockedPiece),
      linesCleared,
    },
    linesCleared,
    scoreAfter,
    levelAfter,
    comboAfter,
  }
}

const shapesEqual = (left: number[][], right: number[][]): boolean => {
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

const getPieceRotation = (piece: ActivePiece): number => {
  let candidate = TETROMINO_SHAPES[piece.type]
  for (let rotation = 0; rotation < 4; rotation += 1) {
    if (shapesEqual(candidate, piece.shape)) {
      return rotation
    }
    candidate = rotateClockwise(candidate)
  }

  return 0
}

const createVisualPieceSnapshot = (piece: ActivePiece | null): VisualPieceSnapshot | null => {
  if (!piece) {
    return null
  }

  return {
    type: piece.type,
    x: piece.x,
    y: piece.y,
    rotation: getPieceRotation(piece),
  }
}

const samePieceSnapshot = (
  left: VisualPieceSnapshot | null | undefined,
  right: VisualPieceSnapshot | null | undefined,
): boolean => {
  if (!left && !right) {
    return true
  }
  if (!left || !right) {
    return false
  }

  return (
    left.type === right.type &&
    left.x === right.x &&
    left.y === right.y &&
    left.rotation === right.rotation
  )
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

const createReplayFrame = ({
  type,
  tick,
  timeMs,
  board,
  stats,
  combo,
  currentPiece,
  nextPiece,
  grade,
  rating,
}: {
  type: ReplayFrame['type']
  tick: number
  timeMs: number
  board: BoardMatrix
  stats: Pick<GameStats, 'score' | 'lines' | 'piecesPlaced' | 'level'>
  combo: number
  currentPiece?: TetrominoType | null
  nextPiece?: TetrominoType | null
  grade?: GameResult['grade']
  rating?: number
}): ReplayFrame => {
  return {
    type,
    tick,
    timeMs: Math.max(0, Math.round(timeMs)),
    board: cloneBoard(board),
    score: stats.score,
    linesCleared: stats.lines,
    piecesPlaced: stats.piecesPlaced,
    level: stats.level,
    combo,
    currentPiece: currentPiece ?? null,
    nextPiece: nextPiece ?? null,
    grade,
    rating,
  }
}

const createVisualFrame = ({
  timeMs,
  tick,
  board,
  activePiece,
  ghostPiece,
  nextPiece,
  stats,
  combo,
  grade,
  rating,
  event,
}: {
  timeMs: number
  tick: number
  board: BoardMatrix
  activePiece: ActivePiece | null
  ghostPiece: ActivePiece | null
  nextPiece: TetrominoType | null
  stats: Pick<GameStats, 'score' | 'lines' | 'piecesPlaced' | 'level'>
  combo: number
  grade?: GameResult['grade']
  rating?: number
  event?: VisualFrameEvent
}): VisualFrame => {
  return {
    timeMs: Math.max(0, Math.round(timeMs)),
    tick,
    board: cloneBoard(board),
    activePiece: createVisualPieceSnapshot(activePiece),
    ghostPiece: createVisualPieceSnapshot(ghostPiece),
    nextPiece,
    score: stats.score,
    linesCleared: stats.lines,
    piecesPlaced: stats.piecesPlaced,
    level: stats.level,
    combo,
    grade,
    rating,
    event,
  }
}

const sameVisualState = (left: VisualFrame, right: VisualFrame): boolean => {
  return (
    sameBoard(left.board, right.board) &&
    samePieceSnapshot(left.activePiece, right.activePiece) &&
    samePieceSnapshot(left.ghostPiece, right.ghostPiece) &&
    left.nextPiece === right.nextPiece &&
    left.score === right.score &&
    left.linesCleared === right.linesCleared &&
    left.piecesPlaced === right.piecesPlaced &&
    left.level === right.level &&
    left.combo === right.combo &&
    (left.grade ?? null) === (right.grade ?? null) &&
    (left.rating ?? null) === (right.rating ?? null)
  )
}

const appendVisualFrame = (
  frames: VisualFrame[],
  nextFrame: VisualFrame,
  options?: { force?: boolean },
): VisualFrame[] => {
  const lastFrame = frames.at(-1)
  if (!lastFrame) {
    return [nextFrame]
  }

  if (sameVisualState(lastFrame, nextFrame)) {
    return frames
  }

  const force = options?.force ?? false
  const lastIsKeyframe = lastFrame.event ? KEYFRAME_VISUAL_EVENTS.has(lastFrame.event) : false
  const nextIsKeyframe = nextFrame.event ? KEYFRAME_VISUAL_EVENTS.has(nextFrame.event) : false

  if (!force && !lastIsKeyframe && !nextIsKeyframe && nextFrame.timeMs - lastFrame.timeMs < VISUAL_CAPTURE_INTERVAL_MS) {
    return [...frames.slice(0, -1), nextFrame]
  }

  return [...frames, nextFrame]
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
    replayFrames: [],
    visualReplayFrames: [],
    moveReplayEvents: [],
    activeMoveReplaySeed: null,
  }
}

export const useGame = ({ startLevel, animationsEnabled }: UseGameOptions) => {
  const [model, setModel] = useState<GameModel>(() => createInitialModel(startLevel))
  const frameRef = useRef<number | null>(null)
  const lastTickRef = useRef<number>(0)
  const lockFeedbackIdRef = useRef(0)

  const resolveLock = useCallback(
    (
      prev: GameModel,
      lockedPiece: ActivePiece,
      hardDropDistance: number,
      wasHardDrop: boolean,
      lockTick: number,
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

      const moveSeed =
        prev.activeMoveReplaySeed ??
        createActiveMoveReplaySeed({
          board: prev.board,
          activePiece: lockedPiece,
          nextPieceType: prev.nextPieceType,
          pieceIndex: prev.stats.piecesPlaced + 1,
          spawnTick: prev.tick,
          spawnTimeMs: statsWithLock.timePlayedMs,
        })
      const nextMoveReplaySeed =
        stepped.clearedLines > 0 && animationsEnabled
          ? null
          : createActiveMoveReplaySeed({
              board: stepped.board,
              activePiece: stepped.gameOver ? null : stepped.activePiece,
              nextPieceType: stepped.nextPieceType,
              pieceIndex: statsWithLock.piecesPlaced + 1,
              spawnTick: lockTick,
              spawnTimeMs: statsWithLock.timePlayedMs,
            })
      const nextMoveReplayEvents = moveSeed
        ? [
            ...prev.moveReplayEvents,
            createReplayMoveEvent({
              seed: prev.stats.seed,
              moveSeed,
              lockedPiece,
              boardAfter: stepped.board,
              lockTick,
              lockTimeMs: statsWithLock.timePlayedMs,
              linesCleared: stepped.clearedLines,
              scoreAfter: statsWithLock.score,
              levelAfter: statsWithLock.level,
              comboAfter: chains.combo.count,
            }),
          ]
        : prev.moveReplayEvents

      const completedGameResult = stepped.gameOver ? createGameResult(statsWithLock, endedAt) : null
      const pieceLockedFrame = createReplayFrame({
        type: 'pieceLocked',
        tick: prev.tick,
        timeMs: statsWithLock.timePlayedMs,
        board: stepped.clearedLines > 0 && animationsEnabled ? stepped.mergedBoard : stepped.board,
        stats: statsWithLock,
        combo: chains.combo.count,
        currentPiece:
          stepped.clearedLines > 0 && animationsEnabled ? null : (stepped.activePiece?.type ?? null),
        nextPiece: stepped.nextPieceType,
      })
      const settledReplayFrames = [...prev.replayFrames, pieceLockedFrame]
      const visualEvent: VisualFrameEvent = wasHardDrop ? 'hardDrop' : 'lock'
      const settledVisualReplayFrames =
        stepped.clearedLines > 0 && animationsEnabled
          ? appendVisualFrame(
              prev.visualReplayFrames,
              createVisualFrame({
                timeMs: statsWithLock.timePlayedMs,
                tick: prev.tick,
                board: stepped.mergedBoard,
                activePiece: null,
                ghostPiece: null,
                nextPiece: stepped.nextPieceType,
                stats: statsWithLock,
                combo: chains.combo.count,
                event: 'lineClear',
              }),
              { force: true },
            )
          : appendVisualFrame(
              prev.visualReplayFrames,
              createVisualFrame({
                timeMs: statsWithLock.timePlayedMs,
                tick: prev.tick,
                board: stepped.board,
                activePiece: stepped.gameOver ? null : stepped.activePiece,
                ghostPiece: stepped.gameOver ? null : projectGhostPiece(stepped.board, stepped.activePiece),
                nextPiece: stepped.nextPieceType,
                stats: statsWithLock,
                combo: chains.combo.count,
                event: visualEvent,
              }),
              { force: true },
            )
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
        replayFrames: settledReplayFrames,
        visualReplayFrames: settledVisualReplayFrames,
        moveReplayEvents: nextMoveReplayEvents,
        activeMoveReplaySeed: nextMoveReplaySeed,
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

      if (stepped.gameOver && completedGameResult) {
        return {
          ...base,
          board: stepped.board,
          activePiece: stepped.activePiece,
          ghostPiece: projectGhostPiece(stepped.board, stepped.activePiece),
          pendingSpawn: null,
          lineClearRows: [],
          state: nextState,
          replayFrames: [
            ...settledReplayFrames,
            createReplayFrame({
              type: 'gameOver',
              tick: prev.tick,
              timeMs: statsWithLock.timePlayedMs,
              board: stepped.board,
              stats: statsWithLock,
              combo: chains.combo.count,
              currentPiece: null,
              nextPiece: stepped.nextPieceType,
              grade: completedGameResult.grade,
              rating: completedGameResult.rating,
            }),
          ],
          visualReplayFrames: [
            ...settledVisualReplayFrames,
            createVisualFrame({
              timeMs: statsWithLock.timePlayedMs,
              tick: prev.tick,
              board: stepped.board,
              activePiece: stepped.activePiece,
              ghostPiece: projectGhostPiece(stepped.board, stepped.activePiece),
              nextPiece: stepped.nextPieceType,
              stats: statsWithLock,
              combo: chains.combo.count,
              grade: completedGameResult.grade,
              rating: completedGameResult.rating,
              event: 'gameOver',
            }),
          ],
          activeMoveReplaySeed: null,
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
      lastTickRef.current = nowMs

      setModel((prev) => {
        const prepared = prepareNewRun(seed)
        const board = createEmptyBoard()
        const stats = createGameStats(prev.stats.highScore, startLevel, seed)
        const startFrame = createReplayFrame({
          type: 'start',
          tick: 0,
          timeMs: 0,
          board,
          stats,
          combo: 0,
          currentPiece: prepared.activePiece.type,
          nextPiece: prepared.nextPieceType,
        })
        const startVisualFrame = createVisualFrame({
          timeMs: 0,
          tick: 0,
          board,
          activePiece: prepared.activePiece,
          ghostPiece: projectGhostPiece(board, prepared.activePiece),
          nextPiece: prepared.nextPieceType,
          stats,
          combo: 0,
          event: 'start',
        })

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
          replayFrames: [startFrame],
          visualReplayFrames: [startVisualFrame],
          moveReplayEvents: [],
          activeMoveReplaySeed: createActiveMoveReplaySeed({
            board,
            activePiece: prepared.activePiece,
            nextPieceType: prepared.nextPieceType,
            pieceIndex: 1,
            spawnTick: 0,
            spawnTimeMs: 0,
          }),
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
    const nowMs = typeof performance !== 'undefined' ? performance.now() : 0
    setModel((prev) => {
      if (prev.state !== 'PLAYING' || !prev.activePiece) {
        return prev
      }
      const moved = movePiece(prev.board, prev.activePiece, -1, 0)
      if (!moved) {
        return prev
      }
      changed = true
      const ghostPiece = projectGhostPiece(prev.board, moved)
      return {
        ...prev,
        activePiece: moved,
        ghostPiece,
        visualReplayFrames: appendVisualFrame(
          prev.visualReplayFrames,
          createVisualFrame({
            timeMs: getElapsedTimeMs(prev.timing, nowMs),
            tick: prev.tick,
            board: prev.board,
            activePiece: moved,
            ghostPiece,
            nextPiece: prev.nextPieceType,
            stats: prev.stats,
            combo: prev.comboState.count,
            event: 'input',
          }),
        ),
      }
    })
    return changed
  }, [])

  const moveRight = useCallback((): boolean => {
    let changed = false
    const nowMs = typeof performance !== 'undefined' ? performance.now() : 0
    setModel((prev) => {
      if (prev.state !== 'PLAYING' || !prev.activePiece) {
        return prev
      }
      const moved = movePiece(prev.board, prev.activePiece, 1, 0)
      if (!moved) {
        return prev
      }
      changed = true
      const ghostPiece = projectGhostPiece(prev.board, moved)
      return {
        ...prev,
        activePiece: moved,
        ghostPiece,
        visualReplayFrames: appendVisualFrame(
          prev.visualReplayFrames,
          createVisualFrame({
            timeMs: getElapsedTimeMs(prev.timing, nowMs),
            tick: prev.tick,
            board: prev.board,
            activePiece: moved,
            ghostPiece,
            nextPiece: prev.nextPieceType,
            stats: prev.stats,
            combo: prev.comboState.count,
            event: 'input',
          }),
        ),
      }
    })
    return changed
  }, [])

  const rotateCW = useCallback((): boolean => {
    let changed = false
    const nowMs = typeof performance !== 'undefined' ? performance.now() : 0
    setModel((prev) => {
      if (prev.state !== 'PLAYING' || !prev.activePiece) {
        return prev
      }
      const rotated = rotateWithWallKick(prev.board, prev.activePiece, 'CW')
      if (rotated === prev.activePiece) {
        return prev
      }
      changed = true
      const ghostPiece = projectGhostPiece(prev.board, rotated)
      return {
        ...prev,
        activePiece: rotated,
        ghostPiece,
        stats: {
          ...prev.stats,
          rotationsUsed: prev.stats.rotationsUsed + 1,
        },
        visualReplayFrames: appendVisualFrame(
          prev.visualReplayFrames,
          createVisualFrame({
            timeMs: getElapsedTimeMs(prev.timing, nowMs),
            tick: prev.tick,
            board: prev.board,
            activePiece: rotated,
            ghostPiece,
            nextPiece: prev.nextPieceType,
            stats: prev.stats,
            combo: prev.comboState.count,
            event: 'rotate',
          }),
        ),
      }
    })
    return changed
  }, [])

  const rotateCCW = useCallback((): boolean => {
    let changed = false
    const nowMs = typeof performance !== 'undefined' ? performance.now() : 0
    setModel((prev) => {
      if (prev.state !== 'PLAYING' || !prev.activePiece) {
        return prev
      }
      const rotated = rotateWithWallKick(prev.board, prev.activePiece, 'CCW')
      if (rotated === prev.activePiece) {
        return prev
      }
      changed = true
      const ghostPiece = projectGhostPiece(prev.board, rotated)
      return {
        ...prev,
        activePiece: rotated,
        ghostPiece,
        stats: {
          ...prev.stats,
          rotationsUsed: prev.stats.rotationsUsed + 1,
        },
        visualReplayFrames: appendVisualFrame(
          prev.visualReplayFrames,
          createVisualFrame({
            timeMs: getElapsedTimeMs(prev.timing, nowMs),
            tick: prev.tick,
            board: prev.board,
            activePiece: rotated,
            ghostPiece,
            nextPiece: prev.nextPieceType,
            stats: prev.stats,
            combo: prev.comboState.count,
            event: 'rotate',
          }),
        ),
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
        const ghostPiece = projectGhostPiece(prev.board, moved)
        const nextStats = {
          ...prev.stats,
          score,
          highScore: Math.max(prev.stats.highScore, score),
          softDropsUsed: prev.stats.softDropsUsed + 1,
        }
        return {
          ...prev,
          activePiece: moved,
          ghostPiece,
          stats: nextStats,
          visualReplayFrames: appendVisualFrame(
            prev.visualReplayFrames,
            createVisualFrame({
              timeMs: getElapsedTimeMs(prev.timing, nowMs),
              tick: prev.tick,
              board: prev.board,
              activePiece: moved,
              ghostPiece,
              nextPiece: prev.nextPieceType,
              stats: nextStats,
              combo: prev.comboState.count,
              event: 'softDrop',
            }),
          ),
        }
      }

      return resolveLock(prev, prev.activePiece, 0, false, prev.tick, nowMs, endedAt)
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
      return resolveLock(prev, droppedPiece, distance, true, prev.tick, nowMs, endedAt)
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
            activeMoveReplaySeed: null,
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
          activeMoveReplaySeed: createActiveMoveReplaySeed({
            board: prev.board,
            activePiece: swappedPiece,
            nextPieceType: prev.nextPieceType,
            pieceIndex: prev.stats.piecesPlaced + 1,
            spawnTick: prev.tick,
            spawnTimeMs: getElapsedTimeMs(prev.timing, nowMs),
          }),
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
          activeMoveReplaySeed: null,
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
        activeMoveReplaySeed: createActiveMoveReplaySeed({
          board: prev.board,
          activePiece: spawned.activePiece,
          nextPieceType: spawned.nextPieceType,
          pieceIndex: prev.stats.piecesPlaced + 1,
          spawnTick: prev.tick,
          spawnTimeMs: getElapsedTimeMs(prev.timing, nowMs),
        }),
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
        const lineClearTimeMs = prev.stats.timePlayedMs + LINE_CLEAR_ANIMATION_MS
        const lineClearFrame = createReplayFrame({
          type: 'lineClear',
          tick: prev.tick,
          timeMs: lineClearTimeMs,
          board: pending.board,
          stats: prev.stats,
          combo: prev.comboState.count,
          currentPiece: pending.activePiece?.type ?? null,
          nextPiece: pending.nextPieceType,
        })
        const lineClearVisualFrame = createVisualFrame({
          timeMs: lineClearTimeMs,
          tick: prev.tick,
          board: pending.board,
          activePiece: pending.activePiece,
          ghostPiece: projectGhostPiece(pending.board, pending.activePiece),
          nextPiece: pending.nextPieceType,
          stats: prev.stats,
          combo: prev.comboState.count,
          event: 'lineClear',
        })
        const replayFrames =
          resolvedState === 'GAME_OVER' && prev.completedGameResult
            ? [
                ...prev.replayFrames,
                lineClearFrame,
                createReplayFrame({
                  type: 'gameOver',
                  tick: prev.tick,
                  timeMs: lineClearTimeMs,
                  board: pending.board,
                  stats: prev.stats,
                  combo: prev.comboState.count,
                  currentPiece: null,
                  nextPiece: pending.nextPieceType,
                  grade: prev.completedGameResult.grade,
                  rating: prev.completedGameResult.rating,
                }),
              ]
            : [...prev.replayFrames, lineClearFrame]
        const visualReplayFrames =
          resolvedState === 'GAME_OVER' && prev.completedGameResult
            ? [
                ...appendVisualFrame(prev.visualReplayFrames, lineClearVisualFrame, { force: true }),
                createVisualFrame({
                  timeMs: lineClearTimeMs,
                  tick: prev.tick,
                  board: pending.board,
                  activePiece: pending.activePiece,
                  ghostPiece: projectGhostPiece(pending.board, pending.activePiece),
                  nextPiece: pending.nextPieceType,
                  stats: prev.stats,
                  combo: prev.comboState.count,
                  grade: prev.completedGameResult.grade,
                  rating: prev.completedGameResult.rating,
                  event: 'gameOver',
                }),
              ]
            : appendVisualFrame(prev.visualReplayFrames, lineClearVisualFrame, { force: true })
        const nextMoveReplaySeed = createActiveMoveReplaySeed({
          board: pending.board,
          activePiece: pending.activePiece,
          nextPieceType: pending.nextPieceType,
          pieceIndex: prev.stats.piecesPlaced + 1,
          spawnTick: prev.tick,
          spawnTimeMs: lineClearTimeMs,
        })

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
          replayFrames,
          visualReplayFrames,
          activeMoveReplaySeed: resolvedState === 'GAME_OVER' ? null : nextMoveReplaySeed,
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
            const ghostPiece = projectGhostPiece(prev.board, moved)
            return {
              ...prev,
              activePiece: moved,
              ghostPiece,
              tick: prev.tick + 1,
              visualReplayFrames: appendVisualFrame(
                prev.visualReplayFrames,
                createVisualFrame({
                  timeMs: getElapsedTimeMs(prev.timing, ts),
                  tick: prev.tick + 1,
                  board: prev.board,
                  activePiece: moved,
                  ghostPiece,
                  nextPiece: prev.nextPieceType,
                  stats: prev.stats,
                  combo: prev.comboState.count,
                  event: 'gravity',
                }),
              ),
            }
          }

          return {
            ...resolveLock(prev, prev.activePiece, 0, false, prev.tick + 1, ts, endedAt),
            tick: prev.tick + 1,
          }
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
    replayFrames: model.replayFrames,
    visualReplayFrames: model.visualReplayFrames,
    moveReplayEvents: model.moveReplayEvents,
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
