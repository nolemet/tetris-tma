import type { ActivePiece, BoardMatrix, GameAction, TetrominoType } from '../types'

export type BotDifficulty = 'easy' | 'medium' | 'hard' | 'expert'

export type MoveSeverity = 'good' | 'inaccuracy' | 'mistake' | 'blunder'

export interface BotPlacement {
  pieceType: TetrominoType
  x: number
  y: number
  rotation: number
  linesCleared: number
  resultingBoard: BoardMatrix
}

export interface BoardMetrics {
  aggregateHeight: number
  maxHeight: number
  holes: number
  coveredHoles: number
  bumpiness: number
  wells: number
  completedLines: number
  columnHeights: number[]
  rowTransitions: number
  columnTransitions: number
}

export interface BoardMetricDelta {
  aggregateHeight: number
  maxHeight: number
  holes: number
  coveredHoles: number
  bumpiness: number
  wells: number
  completedLines: number
  columnHeights: number[]
  rowTransitions: number
  columnTransitions: number
}

export interface MoveExplanation {
  summary: string
  positives: string[]
  negatives: string[]
  severity: MoveSeverity
}

export interface MoveEvaluation {
  placement: BotPlacement
  score: number
  metricsBefore: BoardMetrics
  metricsAfter: BoardMetrics
  delta: BoardMetricDelta
  explanation: MoveExplanation
}

export interface BestMoveResult {
  bestPlacement: BotPlacement
  bestScore: number
  evaluatedMoves: MoveEvaluation[]
  explanation: MoveExplanation
  difficulty: BotDifficulty
}

export interface BotPlan {
  placement: BotPlacement
  actions: GameAction[]
}

export interface BotEvaluationWeights {
  linesCleared: number
  tetrisBonus: number
  holes: number
  coveredHoles: number
  aggregateHeight: number
  maxHeight: number
  bumpiness: number
  wells: number
  rowTransitions: number
  columnTransitions: number
}

export interface BotSearchOptions {
  difficulty?: BotDifficulty
  weights?: Partial<BotEvaluationWeights>
  rng?: () => number
  lookaheadWeight?: number
  nextPiece?: ActivePiece | TetrominoType | null
}

export interface MoveComparison {
  scoreLoss: number
  severity: MoveSeverity
  explanation: MoveExplanation
}

export interface AnalyzePlayerMoveResult {
  playerEvaluation: MoveEvaluation
  bestEvaluation: MoveEvaluation
  scoreLoss: number
  severity: MoveSeverity
  explanation: MoveExplanation
  suggestedPlacement: BotPlacement
}
