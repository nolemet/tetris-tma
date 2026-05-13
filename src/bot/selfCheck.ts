import { createEmptyBoard } from '../game/engine'
import { createPiece } from '../utils/piece'
import { findBestMove } from './botEngine'
import { analyzeBoard } from './boardAnalysis'
import { generateLegalPlacements } from './moveGenerator'

export interface BotSelfCheckResult {
  emptyBoardStable: boolean
  legalPlacementsFound: boolean
  bestMoveFound: boolean
  boardNotMutated: boolean
  scoreIsNumber: boolean
  explanationHasSummary: boolean
}

export const runBotSelfCheck = (): BotSelfCheckResult => {
  const board = createEmptyBoard()
  const originalSnapshot = board.map((row) => [...row])
  const piece = createPiece('T')
  const metrics = analyzeBoard(board)
  const placements = generateLegalPlacements(board, piece)
  const bestMove = findBestMove(board, piece)
  const boardNotMutated =
    board.length === originalSnapshot.length &&
    board.every((row, rowIndex) => row.every((cell, columnIndex) => cell === originalSnapshot[rowIndex][columnIndex]))

  return {
    emptyBoardStable: metrics.holes === 0 && metrics.aggregateHeight === 0,
    legalPlacementsFound: placements.length > 0,
    bestMoveFound: Boolean(bestMove.bestPlacement),
    boardNotMutated,
    scoreIsNumber: Number.isFinite(bestMove.bestScore),
    explanationHasSummary: bestMove.explanation.summary.length > 0,
  }
}
