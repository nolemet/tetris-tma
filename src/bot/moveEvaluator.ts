import type { ActivePiece, BoardMatrix } from '../types'
import { analyzeBoard } from './boardAnalysis'
import { simulatePlacement } from './moveGenerator'
import type {
  BoardMetricDelta,
  BoardMetrics,
  BotEvaluationWeights,
  BotPlacement,
  MoveComparison,
  MoveEvaluation,
  MoveExplanation,
  MoveSeverity,
} from './types'

const DEFAULT_EVALUATION_WEIGHTS: BotEvaluationWeights = {
  linesCleared: 120,
  tetrisBonus: 280,
  holes: -90,
  coveredHoles: -120,
  aggregateHeight: -5,
  maxHeight: -12,
  bumpiness: -10,
  wells: -3,
  rowTransitions: -2,
  columnTransitions: -2,
}

const clampSeverity = (scoreLoss: number): MoveSeverity => {
  if (scoreLoss <= 50) {
    return 'good'
  }
  if (scoreLoss <= 150) {
    return 'inaccuracy'
  }
  if (scoreLoss <= 300) {
    return 'mistake'
  }
  return 'blunder'
}

const createMetricDelta = (before: BoardMetrics, after: BoardMetrics): BoardMetricDelta => {
  return {
    aggregateHeight: after.aggregateHeight - before.aggregateHeight,
    maxHeight: after.maxHeight - before.maxHeight,
    holes: after.holes - before.holes,
    coveredHoles: after.coveredHoles - before.coveredHoles,
    bumpiness: after.bumpiness - before.bumpiness,
    wells: after.wells - before.wells,
    completedLines: after.completedLines - before.completedLines,
    columnHeights: after.columnHeights.map((height, index) => height - (before.columnHeights[index] ?? 0)),
    rowTransitions: after.rowTransitions - before.rowTransitions,
    columnTransitions: after.columnTransitions - before.columnTransitions,
  }
}

const resolveEvaluationWeights = (weights?: Partial<BotEvaluationWeights>): BotEvaluationWeights => {
  return {
    ...DEFAULT_EVALUATION_WEIGHTS,
    ...weights,
  }
}

const scoreBoard = (
  metricsAfter: BoardMetrics,
  linesCleared: number,
  weights: BotEvaluationWeights,
): number => {
  const lineClearScore = linesCleared * weights.linesCleared + (linesCleared === 4 ? weights.tetrisBonus : 0)

  return (
    lineClearScore +
    metricsAfter.holes * weights.holes +
    metricsAfter.coveredHoles * weights.coveredHoles +
    metricsAfter.aggregateHeight * weights.aggregateHeight +
    metricsAfter.maxHeight * weights.maxHeight +
    metricsAfter.bumpiness * weights.bumpiness +
    metricsAfter.wells * weights.wells +
    metricsAfter.rowTransitions * weights.rowTransitions +
    metricsAfter.columnTransitions * weights.columnTransitions
  )
}

const pluralize = (value: number, noun: string): string => {
  return `${value} ${noun}${value === 1 ? '' : 's'}`
}

const inferStandaloneSeverity = (
  score: number,
  linesCleared: number,
  delta: BoardMetricDelta,
): MoveSeverity => {
  if (delta.holes >= 2 || delta.coveredHoles >= 6 || delta.maxHeight >= 5 || score <= -300) {
    return 'blunder'
  }
  if (delta.holes > 0 || delta.maxHeight >= 3 || delta.bumpiness >= 5 || score <= -120) {
    return 'mistake'
  }
  if (delta.aggregateHeight > 0 || delta.rowTransitions > 0 || delta.columnTransitions > 0 || score < 0) {
    return 'inaccuracy'
  }
  if (linesCleared > 0 || delta.aggregateHeight < 0 || delta.holes < 0) {
    return 'good'
  }
  return 'good'
}

export const createMoveExplanation = (
  metricsBefore: BoardMetrics,
  metricsAfter: BoardMetrics,
  linesCleared: number,
  score: number,
): MoveExplanation => {
  const delta = createMetricDelta(metricsBefore, metricsAfter)
  const positives: string[] = []
  const negatives: string[] = []

  if (linesCleared > 0) {
    positives.push(`Cleared ${pluralize(linesCleared, 'line')}`)
  }
  if (linesCleared === 4) {
    positives.push('Found a Tetris-sized clear')
  }
  if (delta.holes < 0) {
    positives.push(`Removed ${pluralize(Math.abs(delta.holes), 'hole')}`)
  }
  if (delta.coveredHoles < 0) {
    positives.push(`Reduced buried holes by ${Math.abs(delta.coveredHoles)}`)
  }
  if (delta.aggregateHeight < 0) {
    positives.push(`Lowered aggregate height by ${Math.abs(delta.aggregateHeight)}`)
  }
  if (delta.maxHeight < 0) {
    positives.push(`Reduced max height by ${Math.abs(delta.maxHeight)}`)
  }
  if (delta.bumpiness < 0) {
    positives.push(`Smoothed the surface by ${Math.abs(delta.bumpiness)}`)
  }
  if (delta.rowTransitions < 0) {
    positives.push(`Reduced row transitions by ${Math.abs(delta.rowTransitions)}`)
  }
  if (delta.columnTransitions < 0) {
    positives.push(`Reduced column transitions by ${Math.abs(delta.columnTransitions)}`)
  }

  if (delta.holes > 0) {
    negatives.push(`Created ${pluralize(delta.holes, 'hole')}`)
  }
  if (delta.coveredHoles > 0) {
    negatives.push(`Made buried holes worse by ${delta.coveredHoles}`)
  }
  if (delta.aggregateHeight > 0) {
    negatives.push(`Raised aggregate height by ${delta.aggregateHeight}`)
  }
  if (delta.maxHeight > 0) {
    negatives.push(`Increased max height by ${delta.maxHeight}`)
  }
  if (delta.bumpiness > 0) {
    negatives.push(`Increased bumpiness by ${delta.bumpiness}`)
  }
  if (delta.rowTransitions > 0) {
    negatives.push(`Increased row transitions by ${delta.rowTransitions}`)
  }
  if (delta.columnTransitions > 0) {
    negatives.push(`Increased column transitions by ${delta.columnTransitions}`)
  }
  if (delta.wells > 0) {
    negatives.push(`Created deeper wells worth ${delta.wells}`)
  }

  const severity = inferStandaloneSeverity(score, linesCleared, delta)
  let summary = 'Solid move: keeps the board stable.'

  if (linesCleared > 0 && delta.holes <= 0 && delta.aggregateHeight <= 0) {
    summary = 'Good move: clears lines and keeps the board low.'
  } else if (delta.holes > 0) {
    summary = 'Risky move: creates holes that will be expensive to fix later.'
  } else if (delta.maxHeight > 0 && delta.bumpiness > 0) {
    summary = 'Unstable move: raises the stack and makes future placements rougher.'
  } else if (score < 0) {
    summary = 'Questionable move: gives up board quality for limited short-term value.'
  }

  return {
    summary,
    positives,
    negatives,
    severity,
  }
}

export const getDefaultEvaluationWeights = (): BotEvaluationWeights => {
  return { ...DEFAULT_EVALUATION_WEIGHTS }
}

export const evaluateBoard = (
  boardBefore: BoardMatrix,
  boardAfter: BoardMatrix,
  linesCleared: number,
  weights?: Partial<BotEvaluationWeights>,
): {
  score: number
  metricsBefore: BoardMetrics
  metricsAfter: BoardMetrics
  delta: BoardMetricDelta
  explanation: MoveExplanation
} => {
  const resolvedWeights = resolveEvaluationWeights(weights)
  const metricsBefore = analyzeBoard(boardBefore)
  const metricsAfter = analyzeBoard(boardAfter)
  const score = scoreBoard(metricsAfter, linesCleared, resolvedWeights)
  const delta = createMetricDelta(metricsBefore, metricsAfter)
  const explanation = createMoveExplanation(metricsBefore, metricsAfter, linesCleared, score)

  return {
    score,
    metricsBefore,
    metricsAfter,
    delta,
    explanation,
  }
}

export const evaluatePlacement = (
  boardBefore: BoardMatrix,
  piece: ActivePiece,
  placement: BotPlacement,
  weights?: Partial<BotEvaluationWeights>,
): MoveEvaluation => {
  const simulated = simulatePlacement(boardBefore, piece, placement)
  const resolvedPlacement: BotPlacement = {
    ...placement,
    pieceType: piece.type,
    linesCleared: simulated.linesCleared,
    resultingBoard: simulated.board.map((row) => [...row]),
  }
  const evaluation = evaluateBoard(boardBefore, resolvedPlacement.resultingBoard, resolvedPlacement.linesCleared, weights)

  return {
    placement: resolvedPlacement,
    score: evaluation.score,
    metricsBefore: evaluation.metricsBefore,
    metricsAfter: evaluation.metricsAfter,
    delta: evaluation.delta,
    explanation: evaluation.explanation,
  }
}

export const compareMoveToBest = (
  playerEvaluation: MoveEvaluation,
  bestEvaluation: MoveEvaluation,
): MoveComparison => {
  const scoreLoss = Math.max(0, bestEvaluation.score - playerEvaluation.score)
  const severity = clampSeverity(scoreLoss)
  const positives =
    severity === 'good'
      ? ['Matched the engine best move within the current evaluation window']
      : [...playerEvaluation.explanation.positives.slice(0, 2)]
  const negatives =
    severity === 'good'
      ? []
      : [
          `Best alternative scores ${Math.round(scoreLoss)} points higher`,
          ...playerEvaluation.explanation.negatives.slice(0, 2),
        ]

  return {
    scoreLoss,
    severity,
    explanation: {
      summary:
        severity === 'good'
          ? 'Good move: this choice is effectively as strong as the engine recommendation.'
          : `The move is a ${severity}: the best alternative scores ${Math.round(scoreLoss)} points higher.`,
      positives,
      negatives,
      severity,
    },
  }
}
