import type { EloGameResult, EloUpdateResult, LocalEloState } from './types'

const getNumericResult = (result: EloGameResult): number => {
  if (result === 'win') {
    return 1
  }
  if (result === 'draw') {
    return 0.5
  }
  return 0
}

const resolveKFactor = (playerRating: number, gamesPlayed: number): number => {
  if (playerRating >= 1600) {
    return 16
  }
  if (gamesPlayed < 20) {
    return 40
  }
  return 24
}

export const calculateExpectedScore = (playerRating: number, opponentRating: number): number => {
  return 1 / (1 + 10 ** ((opponentRating - playerRating) / 400))
}

export const calculateEloChange = (
  playerRating: number,
  opponentRating: number,
  result: EloGameResult,
  gamesPlayed: number,
): number => {
  const expectedScore = calculateExpectedScore(playerRating, opponentRating)
  const kFactor = resolveKFactor(playerRating, gamesPlayed)
  return Math.round(kFactor * (getNumericResult(result) - expectedScore))
}

export const updateEloAfterMatch = (
  currentElo: LocalEloState,
  opponentRating: number,
  result: EloGameResult,
): EloUpdateResult => {
  const expectedScore = calculateExpectedScore(currentElo.playerRating, opponentRating)
  const kFactor = resolveKFactor(currentElo.playerRating, currentElo.gamesPlayed)
  const ratingChange = Math.round(kFactor * (getNumericResult(result) - expectedScore))
  const playerRating = Math.max(0, currentElo.playerRating + ratingChange)

  const nextState: LocalEloState = {
    ...currentElo,
    playerRating,
    gamesPlayed: currentElo.gamesPlayed + 1,
    wins: currentElo.wins + Number(result === 'win'),
    losses: currentElo.losses + Number(result === 'loss'),
    draws: currentElo.draws + Number(result === 'draw'),
    peakRating: Math.max(currentElo.peakRating, playerRating),
    lastUpdatedAt: Date.now(),
  }

  return {
    expectedScore,
    kFactor,
    ratingChange,
    nextState,
  }
}
