import type { MoveEvaluation, MoveExplanation, MoveSeverity } from '../bot'
import type { BoardMatrix, TetrominoType } from '../types'
import type { ReplayMoveEvent } from '../replays/types'

export type AnalysisAccuracyLabel = 'Excellent' | 'Good' | 'Average' | 'Weak' | 'Poor'

export interface MoveAnalysis {
  moveIndex: number
  pieceType: TetrominoType
  timeMs: number
  playerEvaluation: MoveEvaluation
  bestEvaluation: MoveEvaluation
  scoreLoss: number
  severity: MoveSeverity
  explanation: MoveExplanation
  suggestedPlacement: MoveEvaluation['placement']
  boardBefore: BoardMatrix
  boardAfter: BoardMatrix
  suggestedBoard: BoardMatrix
  moveEvent: ReplayMoveEvent
}

export interface SkippedMoveAnalysis {
  moveIndex: number
  pieceType: TetrominoType
  timeMs: number
  reason: string
}

export interface GameAnalysisResult {
  totalMoves: number
  analyzedMoves: number
  accuracy: number
  accuracyLabel: AnalysisAccuracyLabel
  totalScoreLoss: number
  averageScoreLoss: number
  goodMoves: number
  inaccuracies: number
  mistakes: number
  blunders: number
  topMistakes: MoveAnalysis[]
  moveAnalyses: MoveAnalysis[]
  skippedMoves: SkippedMoveAnalysis[]
}
