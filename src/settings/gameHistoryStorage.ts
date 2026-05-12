import type { GameResult } from '../types'

const HISTORY_KEY = 'tetris-tma-game-history'
const HISTORY_LIMIT = 20

const safeGetStorage = (): Storage | null => {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export const loadGameHistory = (): GameResult[] => {
  const storage = safeGetStorage()
  const json = storage?.getItem(HISTORY_KEY)
  if (!json) {
    return []
  }

  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? (parsed as GameResult[]) : []
  } catch {
    storage?.removeItem(HISTORY_KEY)
    return []
  }
}

export const saveGameResult = (result: GameResult): GameResult[] => {
  const storage = safeGetStorage()
  const history = [result, ...loadGameHistory()].slice(0, HISTORY_LIMIT)

  storage?.setItem(HISTORY_KEY, JSON.stringify(history))

  return history
}

export const clearGameHistory = (): void => {
  safeGetStorage()?.removeItem(HISTORY_KEY)
}
