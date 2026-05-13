import type { BoardMatrix, Cell, GameAction, GameGrade, TetrominoType } from '../types'
import type {
  GameReplay,
  GameReplayV1,
  GameReplayV2,
  GameReplayV3,
  ReplayFinalStats,
  ReplayFrame,
  ReplayLegacyFinalStats,
  VisualFrame,
  VisualFrameEvent,
  VisualPieceSnapshot,
} from './types'

const REPLAYS_KEY = 'tetris-tma-replays'
const REPLAY_LIMIT = 20
const GAME_ACTIONS = new Set<GameAction>([
  'moveLeft',
  'moveRight',
  'softDrop',
  'hardDrop',
  'rotateCW',
  'rotateCCW',
  'hold',
  'pause',
])
const TETROMINO_TYPES = new Set<TetrominoType>(['I', 'O', 'T', 'S', 'Z', 'J', 'L'])
const FRAME_TYPES = new Set<ReplayFrame['type']>(['start', 'pieceLocked', 'lineClear', 'gameOver'])
const VISUAL_FRAME_EVENTS = new Set<VisualFrameEvent>([
  'start',
  'input',
  'gravity',
  'softDrop',
  'hardDrop',
  'rotate',
  'lock',
  'lineClear',
  'gameOver',
])
const GRADES = new Set<GameGrade>(['S', 'A', 'B', 'C', 'D'])

const safeGetStorage = (): Storage | null => {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const getNumber = (value: unknown, fallback = 0): number => {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

const getString = (value: unknown, fallback = ''): string => {
  return typeof value === 'string' ? value : fallback
}

const getPieceType = (value: unknown): TetrominoType | null => {
  return typeof value === 'string' && TETROMINO_TYPES.has(value as TetrominoType) ? (value as TetrominoType) : null
}

const getGrade = (value: unknown, fallback: GameGrade = 'D'): GameGrade => {
  return typeof value === 'string' && GRADES.has(value as GameGrade) ? (value as GameGrade) : fallback
}

const normalizeBoard = (value: unknown): BoardMatrix | null => {
  if (!Array.isArray(value)) {
    return null
  }

  const board: BoardMatrix = []
  for (const rawRow of value) {
    if (!Array.isArray(rawRow)) {
      return null
    }

    const row: Cell[] = rawRow.map((cell) => {
      if (typeof cell === 'string' && TETROMINO_TYPES.has(cell as TetrominoType)) {
        return cell as TetrominoType
      }
      return null
    })
    board.push(row)
  }

  return board
}

const normalizePieceSnapshot = (value: unknown): VisualPieceSnapshot | null => {
  if (!isRecord(value)) {
    return null
  }

  const type = getPieceType(value.type)
  if (!type) {
    return null
  }

  return {
    type,
    x: getNumber(value.x),
    y: getNumber(value.y),
    rotation: Math.max(0, Math.min(3, Math.round(getNumber(value.rotation)))),
  }
}

const normalizeInputs = (value: unknown): GameReplay['inputs'] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((input) => {
      if (!isRecord(input)) {
        return null
      }

      const action = getString(input.action)
      if (!GAME_ACTIONS.has(action as GameAction)) {
        return null
      }

      return {
        tick: getNumber(input.tick),
        timeMs: getNumber(input.timeMs),
        action: action as GameAction,
      }
    })
    .filter((item): item is GameReplay['inputs'][number] => item !== null)
}

const normalizeLegacyFinalStats = (value: unknown): ReplayLegacyFinalStats | null => {
  if (!isRecord(value)) {
    return null
  }

  return {
    score: getNumber(value.score),
    linesCleared: getNumber(value.linesCleared),
    piecesPlaced: getNumber(value.piecesPlaced),
    grade: getGrade(value.grade),
    rating: getNumber(value.rating),
  }
}

const normalizeReplayFinalStats = (value: unknown): ReplayFinalStats | null => {
  const legacy = normalizeLegacyFinalStats(value)
  if (!legacy || !isRecord(value)) {
    return null
  }

  return {
    ...legacy,
    durationMs: getNumber(value.durationMs),
  }
}

const normalizeFrames = (value: unknown): ReplayFrame[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((frame): ReplayFrame | null => {
      if (!isRecord(frame)) {
        return null
      }

      const type = getString(frame.type)
      if (!FRAME_TYPES.has(type as ReplayFrame['type'])) {
        return null
      }

      const board = normalizeBoard(frame.board)
      if (!board) {
        return null
      }

      return {
        type: type as ReplayFrame['type'],
        tick: getNumber(frame.tick),
        timeMs: getNumber(frame.timeMs),
        board,
        score: getNumber(frame.score),
        linesCleared: getNumber(frame.linesCleared),
        piecesPlaced: getNumber(frame.piecesPlaced),
        level: Math.max(1, getNumber(frame.level, 1)),
        combo: getNumber(frame.combo),
        currentPiece: getPieceType(frame.currentPiece),
        nextPiece: getPieceType(frame.nextPiece),
        grade: frame.grade === undefined ? undefined : getGrade(frame.grade),
        rating: frame.rating === undefined ? undefined : getNumber(frame.rating),
      }
    })
    .filter((item): item is ReplayFrame => item !== null)
}

const normalizeVisualFrames = (value: unknown): VisualFrame[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((frame): VisualFrame | null => {
      if (!isRecord(frame)) {
        return null
      }

      const board = normalizeBoard(frame.board)
      if (!board) {
        return null
      }

      const event = getString(frame.event)
      return {
        timeMs: getNumber(frame.timeMs),
        tick: getNumber(frame.tick),
        board,
        activePiece: frame.activePiece === undefined ? undefined : normalizePieceSnapshot(frame.activePiece),
        ghostPiece: frame.ghostPiece === undefined ? undefined : normalizePieceSnapshot(frame.ghostPiece),
        nextPiece: getPieceType(frame.nextPiece),
        score: getNumber(frame.score),
        linesCleared: getNumber(frame.linesCleared),
        piecesPlaced: getNumber(frame.piecesPlaced),
        level: Math.max(1, getNumber(frame.level, 1)),
        combo: getNumber(frame.combo),
        grade: frame.grade === undefined ? undefined : getGrade(frame.grade),
        rating: frame.rating === undefined ? undefined : getNumber(frame.rating),
        event: VISUAL_FRAME_EVENTS.has(event as VisualFrameEvent) ? (event as VisualFrameEvent) : undefined,
      }
    })
    .filter((item): item is VisualFrame => item !== null)
}

const normalizeReplayV1 = (raw: Record<string, unknown>): GameReplayV1 | null => {
  const finalStats = normalizeLegacyFinalStats(raw.finalStats)
  if (!finalStats) {
    return null
  }

  return {
    version: 1,
    id: getString(raw.id),
    gameId: getString(raw.gameId),
    mode: getString(raw.mode, 'classic') === 'classic' ? 'classic' : 'classic',
    seed: getString(raw.seed, 'unknown-seed'),
    startLevel: Math.max(1, getNumber(raw.startLevel, 1)),
    startedAt: getNumber(raw.startedAt),
    finishedAt: getNumber(raw.finishedAt),
    durationMs: getNumber(raw.durationMs),
    inputs: normalizeInputs(raw.inputs),
    finalStats,
  }
}

const normalizeReplayV2 = (raw: Record<string, unknown>): GameReplayV2 | null => {
  const finalStats = normalizeReplayFinalStats(raw.finalStats)
  const frames = normalizeFrames(raw.frames)
  if (!finalStats || frames.length === 0) {
    return null
  }

  return {
    version: 2,
    id: getString(raw.id),
    gameId: getString(raw.gameId),
    mode: getString(raw.mode, 'classic') === 'classic' ? 'classic' : 'classic',
    seed: getString(raw.seed, 'unknown-seed'),
    startLevel: Math.max(1, getNumber(raw.startLevel, 1)),
    startedAt: getNumber(raw.startedAt),
    finishedAt: getNumber(raw.finishedAt),
    durationMs: getNumber(raw.durationMs),
    inputs: normalizeInputs(raw.inputs),
    frames,
    finalStats,
  }
}

const normalizeReplayV3 = (raw: Record<string, unknown>): GameReplayV3 | null => {
  const finalStats = normalizeReplayFinalStats(raw.finalStats)
  const frames = normalizeFrames(raw.frames)
  const visualFrames = normalizeVisualFrames(raw.visualFrames)
  if (!finalStats || frames.length === 0 || visualFrames.length === 0) {
    return null
  }

  return {
    version: 3,
    id: getString(raw.id),
    gameId: getString(raw.gameId),
    mode: getString(raw.mode, 'classic') === 'classic' ? 'classic' : 'classic',
    seed: getString(raw.seed, 'unknown-seed'),
    startLevel: Math.max(1, getNumber(raw.startLevel, 1)),
    startedAt: getNumber(raw.startedAt),
    finishedAt: getNumber(raw.finishedAt),
    durationMs: getNumber(raw.durationMs),
    inputs: normalizeInputs(raw.inputs),
    frames,
    visualFrames,
    finalStats,
  }
}

const normalizeReplay = (raw: unknown): GameReplay | null => {
  if (!isRecord(raw)) {
    return null
  }

  const version = getNumber(raw.version, 1)
  if (version === 3) {
    return normalizeReplayV3(raw)
  }
  if (version === 2) {
    return normalizeReplayV2(raw)
  }
  return normalizeReplayV1(raw)
}

const writeReplays = (replays: GameReplay[]): GameReplay[] => {
  safeGetStorage()?.setItem(REPLAYS_KEY, JSON.stringify(replays))
  return replays
}

export const loadReplays = (): GameReplay[] => {
  const storage = safeGetStorage()
  const json = storage?.getItem(REPLAYS_KEY)
  if (!json) {
    return []
  }

  try {
    const parsed = JSON.parse(json)
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.map(normalizeReplay).filter((item): item is GameReplay => item !== null).slice(0, REPLAY_LIMIT)
  } catch {
    storage?.removeItem(REPLAYS_KEY)
    return []
  }
}

export const saveReplay = (replay: GameReplay): GameReplay[] => {
  const replays = [replay, ...loadReplays().filter((item) => item.id !== replay.id)].slice(0, REPLAY_LIMIT)
  return writeReplays(replays)
}

export const clearReplays = (): void => {
  safeGetStorage()?.removeItem(REPLAYS_KEY)
}

export const getReplayById = (replayId: string): GameReplay | null => {
  return loadReplays().find((replay) => replay.id === replayId) ?? null
}
