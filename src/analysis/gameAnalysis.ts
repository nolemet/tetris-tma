import { analyzePlayerMove } from '../bot'
import { createPiece } from '../utils/piece'
import type { ReplayMoveEvent } from '../replays/types'
import type { GameAnalysisResult, MoveAnalysis, SkippedMoveAnalysis } from './types'

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value))
}

const getAccuracyLabel = (accuracy: number): GameAnalysisResult['accuracyLabel'] => {
  if (accuracy >= 95) {
    return 'Excellent'
  }
  if (accuracy >= 85) {
    return 'Good'
  }
  if (accuracy >= 70) {
    return 'Average'
  }
  if (accuracy >= 50) {
    return 'Weak'
  }
  return 'Poor'
}

const cloneBoard = (board: ReplayMoveEvent['boardBefore']) => board.map((row) => [...row])

const scoreSeverityPenalty = (analysis: MoveAnalysis): number => {
  const basePenalty =
    analysis.severity === 'blunder'
      ? 12
      : analysis.severity === 'mistake'
        ? 6
        : analysis.severity === 'inaccuracy'
          ? 2
          : 0
  const scoreLossPenalty = analysis.severity === 'good' ? 0 : Math.min(4, analysis.scoreLoss / 250)

  return basePenalty + scoreLossPenalty
}

export const analyzeMoveEvent = (moveEvent: ReplayMoveEvent): MoveAnalysis => {
  const piece = createPiece(moveEvent.pieceType)
  const playerPlacement = {
    ...moveEvent.playerPlacement,
    resultingBoard: cloneBoard(moveEvent.boardAfter),
  }
  const result = analyzePlayerMove(moveEvent.boardBefore, piece, playerPlacement, {
    nextPiece: moveEvent.nextPieceType ?? null,
  })

  return {
    moveIndex: moveEvent.pieceIndex,
    pieceType: moveEvent.pieceType,
    timeMs: moveEvent.lockTimeMs,
    playerEvaluation: result.playerEvaluation,
    bestEvaluation: result.bestEvaluation,
    scoreLoss: result.scoreLoss,
    severity: result.severity,
    explanation: result.explanation,
    suggestedPlacement: result.suggestedPlacement,
    boardBefore: cloneBoard(moveEvent.boardBefore),
    boardAfter: cloneBoard(moveEvent.boardAfter),
    suggestedBoard: cloneBoard(result.bestEvaluation.placement.resultingBoard),
    moveEvent,
  }
}

export const calculateAccuracy = (moveAnalyses: MoveAnalysis[]): number => {
  if (moveAnalyses.length === 0) {
    return 0
  }

  const totalPenalty = moveAnalyses.reduce((sum, analysis) => sum + scoreSeverityPenalty(analysis), 0)
  return Math.round(clamp(100 - totalPenalty, 0, 100) * 10) / 10
}

export const getTopMistakes = (moveAnalyses: MoveAnalysis[], limit = 5): MoveAnalysis[] => {
  const seriousMoves = moveAnalyses
    .filter((analysis) => analysis.severity !== 'good' && analysis.scoreLoss > 0)
    .sort((left, right) => right.scoreLoss - left.scoreLoss)

  return seriousMoves.slice(0, Math.max(0, limit))
}

export const analyzeGameMoves = (moveEvents: ReplayMoveEvent[]): GameAnalysisResult => {
  const moveAnalyses: MoveAnalysis[] = []
  const skippedMoves: SkippedMoveAnalysis[] = []

  for (const moveEvent of moveEvents) {
    try {
      moveAnalyses.push(analyzeMoveEvent(moveEvent))
    } catch (error) {
      skippedMoves.push({
        moveIndex: moveEvent.pieceIndex,
        pieceType: moveEvent.pieceType,
        timeMs: moveEvent.lockTimeMs,
        reason: error instanceof Error ? error.message : 'Move analysis failed',
      })
    }
  }

  const totalScoreLoss = moveAnalyses.reduce((sum, analysis) => sum + analysis.scoreLoss, 0)
  const accuracy = calculateAccuracy(moveAnalyses)
  const goodMoves = moveAnalyses.filter((analysis) => analysis.severity === 'good').length
  const inaccuracies = moveAnalyses.filter((analysis) => analysis.severity === 'inaccuracy').length
  const mistakes = moveAnalyses.filter((analysis) => analysis.severity === 'mistake').length
  const blunders = moveAnalyses.filter((analysis) => analysis.severity === 'blunder').length

  return {
    totalMoves: moveEvents.length,
    analyzedMoves: moveAnalyses.length,
    accuracy,
    accuracyLabel: getAccuracyLabel(accuracy),
    totalScoreLoss,
    averageScoreLoss: moveAnalyses.length > 0 ? Math.round((totalScoreLoss / moveAnalyses.length) * 10) / 10 : 0,
    goodMoves,
    inaccuracies,
    mistakes,
    blunders,
    topMistakes: getTopMistakes(moveAnalyses),
    moveAnalyses,
    skippedMoves,
  }
}
