import type { GameReplay } from './types'
import type { GameAction } from '../types'

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

const normalizeReplay = (raw: unknown): GameReplay | null => {
  if (!isRecord(raw) || !Array.isArray(raw.inputs) || !isRecord(raw.finalStats)) {
    return null
  }

  const inputs = raw.inputs
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

  const finalStats = raw.finalStats
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
    inputs,
    finalStats: {
      score: getNumber(finalStats.score),
      linesCleared: getNumber(finalStats.linesCleared),
      piecesPlaced: getNumber(finalStats.piecesPlaced),
      grade:
        getString(finalStats.grade) === 'S' ||
        getString(finalStats.grade) === 'A' ||
        getString(finalStats.grade) === 'B' ||
        getString(finalStats.grade) === 'C' ||
        getString(finalStats.grade) === 'D'
          ? (getString(finalStats.grade) as GameReplay['finalStats']['grade'])
          : 'D',
      rating: getNumber(finalStats.rating),
    },
  }
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
