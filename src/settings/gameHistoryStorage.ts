import { calculateGameGrade, calculateGameRating } from '../game/results'
import type { BotDifficulty, GameResult, GameStats, GameMode, MatchResult } from '../types'

const HISTORY_KEY = 'tetris-tma-game-history'
const HISTORY_LIMIT = 20

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

const getGameMode = (value: unknown): GameMode => {
  return value === 'vsBot' ? 'vsBot' : 'classic'
}

const getBotDifficulty = (value: unknown): BotDifficulty | null => {
  return value === 'easy' || value === 'medium' || value === 'hard' || value === 'expert' ? value : null
}

const getMatchResult = (value: unknown): MatchResult | null => {
  return value === 'win' || value === 'loss' || value === 'draw' ? value : null
}

const normalizeHistoryStats = (raw: Record<string, unknown>): GameStats => {
  return {
    score: getNumber(raw.score),
    level: Math.max(1, getNumber(raw.level, 1)),
    lines: getNumber(raw.lines),
    highScore: Math.max(getNumber(raw.highScore), getNumber(raw.score)),
    piecesPlaced: getNumber(raw.piecesPlaced),
    singles: getNumber(raw.singles),
    doubles: getNumber(raw.doubles),
    triples: getNumber(raw.triples),
    tetrises: getNumber(raw.tetrises),
    maxCombo: getNumber(raw.maxCombo),
    currentCombo: getNumber(raw.currentCombo),
    holdsUsed: getNumber(raw.holdsUsed),
    rotationsUsed: getNumber(raw.rotationsUsed),
    hardDropsUsed: getNumber(raw.hardDropsUsed),
    softDropsUsed: getNumber(raw.softDropsUsed),
    maxBoardHeight: getNumber(raw.maxBoardHeight),
    holesCreated: getNumber(raw.holesCreated),
    timePlayedMs: getNumber(raw.timePlayedMs),
    averageTimePerPieceMs: getNumber(raw.averageTimePerPieceMs),
    mode: getGameMode(raw.mode),
    seed: getString(raw.seed, 'unknown-seed'),
  }
}

const normalizeGameResult = (raw: unknown): GameResult | null => {
  if (!isRecord(raw)) {
    return null
  }

  const stats = normalizeHistoryStats(raw)
  const endedAt = getString(raw.endedAt, new Date(0).toISOString())
  const replayId = getString(raw.replayId, '') || null
  const rating = getNumber(raw.rating, calculateGameRating(stats))
  const gradeSource = getString(raw.grade, '')

  return {
    ...stats,
    id: getString(raw.id, `${stats.seed}-${endedAt}`),
    endedAt,
    finalLevel: Math.max(1, getNumber(raw.finalLevel, stats.level)),
    grade: gradeSource === 'S' || gradeSource === 'A' || gradeSource === 'B' || gradeSource === 'C' || gradeSource === 'D'
      ? gradeSource
      : calculateGameGrade(stats),
    rating,
    replayId,
    botDifficulty: getBotDifficulty(raw.botDifficulty),
    botScore: raw.botScore === undefined ? null : getNumber(raw.botScore),
    matchResult: getMatchResult(raw.matchResult),
    eloBefore: raw.eloBefore === undefined ? null : getNumber(raw.eloBefore),
    eloAfter: raw.eloAfter === undefined ? null : getNumber(raw.eloAfter),
    eloChange: raw.eloChange === undefined ? null : getNumber(raw.eloChange),
    botRating: raw.botRating === undefined ? null : getNumber(raw.botRating),
  }
}

const writeHistory = (history: GameResult[]): GameResult[] => {
  const storage = safeGetStorage()
  storage?.setItem(HISTORY_KEY, JSON.stringify(history))
  return history
}

export const loadGameHistory = (): GameResult[] => {
  const storage = safeGetStorage()
  const json = storage?.getItem(HISTORY_KEY)
  if (!json) {
    return []
  }

  try {
    const parsed = JSON.parse(json)
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.map(normalizeGameResult).filter((item): item is GameResult => item !== null).slice(0, HISTORY_LIMIT)
  } catch {
    storage?.removeItem(HISTORY_KEY)
    return []
  }
}

export const saveGameResult = (result: GameResult): GameResult[] => {
  const history = [result, ...loadGameHistory().filter((item) => item.id !== result.id)].slice(0, HISTORY_LIMIT)
  return writeHistory(history)
}

export const clearGameHistory = (): void => {
  safeGetStorage()?.removeItem(HISTORY_KEY)
}
