import type { LocalEloState } from './types'

const ELO_STORAGE_KEY = 'tetris-tma-elo'
const ELO_VERSION = 1

const safeGetStorage = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
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

export const getDefaultEloState = (): LocalEloState => {
  return {
    version: ELO_VERSION,
    playerRating: 1000,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    peakRating: 1000,
    lastUpdatedAt: 0,
  }
}

const normalizeEloState = (raw: unknown): LocalEloState => {
  const defaults = getDefaultEloState()
  if (!isRecord(raw)) {
    return defaults
  }

  const playerRating = Math.max(0, Math.round(getNumber(raw.playerRating, defaults.playerRating)))
  const gamesPlayed = Math.max(0, Math.round(getNumber(raw.gamesPlayed, defaults.gamesPlayed)))
  const wins = Math.max(0, Math.round(getNumber(raw.wins, defaults.wins)))
  const losses = Math.max(0, Math.round(getNumber(raw.losses, defaults.losses)))
  const draws = Math.max(0, Math.round(getNumber(raw.draws, defaults.draws)))

  return {
    version: ELO_VERSION,
    playerRating,
    gamesPlayed,
    wins,
    losses,
    draws,
    peakRating: Math.max(playerRating, Math.round(getNumber(raw.peakRating, defaults.peakRating))),
    lastUpdatedAt: Math.max(0, Math.round(getNumber(raw.lastUpdatedAt, defaults.lastUpdatedAt))),
  }
}

export const loadEloState = (): LocalEloState => {
  const json = safeGetStorage()?.getItem(ELO_STORAGE_KEY)
  if (!json) {
    return getDefaultEloState()
  }

  try {
    return normalizeEloState(JSON.parse(json))
  } catch {
    safeGetStorage()?.removeItem(ELO_STORAGE_KEY)
    return getDefaultEloState()
  }
}

export const saveEloState = (state: LocalEloState): LocalEloState => {
  const normalized = normalizeEloState(state)
  safeGetStorage()?.setItem(ELO_STORAGE_KEY, JSON.stringify(normalized))
  return normalized
}

export const resetEloState = (): LocalEloState => {
  return saveEloState(getDefaultEloState())
}
