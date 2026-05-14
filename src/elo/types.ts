import type { BotDifficulty, MatchResult } from '../types'

export interface LocalEloState {
  version: 1
  playerRating: number
  gamesPlayed: number
  wins: number
  losses: number
  draws: number
  peakRating: number
  lastUpdatedAt: number
}

export interface EloUpdateResult {
  expectedScore: number
  kFactor: number
  ratingChange: number
  nextState: LocalEloState
}

export type EloGameResult = MatchResult

export const BOT_ELO_RATINGS: Record<BotDifficulty, number> = {
  easy: 800,
  medium: 1100,
  hard: 1400,
  expert: 1700,
}
