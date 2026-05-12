import type { GameGrade, GameStats } from '../types'

export const calculateGameGrade = (stats: GameStats): GameGrade => {
  let points = 0

  points += stats.score / 1000
  points += stats.lines * 2
  points += stats.tetrises * 10
  points += stats.maxCombo * 5
  points -= stats.holesCreated * 2
  points -= Math.max(0, stats.piecesPlaced - stats.lines * 1.5) * 0.1
  points -= Math.max(0, stats.timePlayedMs / 1000 - 180) * 0.08

  if (points >= 120) {
    return 'S'
  }
  if (points >= 90) {
    return 'A'
  }
  if (points >= 60) {
    return 'B'
  }
  if (points >= 30) {
    return 'C'
  }
  return 'D'
}

export const calculateGameRating = (stats: GameStats): number => {
  const survivalBonus = Math.max(0, Math.round(stats.timePlayedMs / 1000))
  return Math.max(
    0,
    Math.round(
      stats.score * 0.12 +
        stats.lines * 18 +
        stats.tetrises * 80 +
        stats.maxCombo * 32 +
        survivalBonus -
        stats.holesCreated * 24,
    ),
  )
}

export const formatDuration = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export const formatAveragePieceTime = (ms: number): string => {
  return `${(Math.max(0, ms) / 1000).toFixed(2)}s`
}
