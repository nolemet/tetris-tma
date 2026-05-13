import type { BoardMatrix, GameAction, GameGrade, GameMode, TetrominoType } from '../types'

export interface ReplayInput {
  tick: number
  timeMs: number
  action: GameAction
}

export interface ReplayLegacyFinalStats {
  score: number
  linesCleared: number
  piecesPlaced: number
  grade: GameGrade
  rating: number
}

export interface ReplayFinalStats extends ReplayLegacyFinalStats {
  durationMs: number
}

export type ReplayFrameType = 'start' | 'pieceLocked' | 'lineClear' | 'gameOver'

export interface ReplayFrame {
  type: ReplayFrameType
  tick: number
  timeMs: number
  board: BoardMatrix
  score: number
  linesCleared: number
  piecesPlaced: number
  level: number
  combo: number
  currentPiece?: TetrominoType | null
  nextPiece?: TetrominoType | null
  grade?: GameGrade
  rating?: number
}

export type VisualFrameEvent =
  | 'start'
  | 'input'
  | 'gravity'
  | 'softDrop'
  | 'hardDrop'
  | 'rotate'
  | 'lock'
  | 'lineClear'
  | 'gameOver'

export interface VisualPieceSnapshot {
  type: TetrominoType
  x: number
  y: number
  rotation: number
}

export interface VisualFrame {
  timeMs: number
  tick: number
  board: BoardMatrix
  activePiece?: VisualPieceSnapshot | null
  ghostPiece?: VisualPieceSnapshot | null
  nextPiece?: TetrominoType | null
  score: number
  linesCleared: number
  piecesPlaced: number
  level: number
  combo: number
  grade?: GameGrade
  rating?: number
  event?: VisualFrameEvent
}

export interface GameReplayV1 {
  version: 1
  id: string
  gameId: string
  mode: GameMode
  seed: string
  startLevel: number
  startedAt: number
  finishedAt: number
  durationMs: number
  inputs: ReplayInput[]
  finalStats: ReplayLegacyFinalStats
}

export interface GameReplayV2 {
  version: 2
  id: string
  gameId: string
  mode: GameMode
  seed: string
  startLevel: number
  startedAt: number
  finishedAt: number
  durationMs: number
  inputs: ReplayInput[]
  frames: ReplayFrame[]
  finalStats: ReplayFinalStats
}

export interface GameReplayV3 {
  version: 3
  id: string
  gameId: string
  mode: GameMode
  seed: string
  startLevel: number
  startedAt: number
  finishedAt: number
  durationMs: number
  inputs: ReplayInput[]
  frames: ReplayFrame[]
  visualFrames: VisualFrame[]
  finalStats: ReplayFinalStats
}

export type GameReplay = GameReplayV1 | GameReplayV2 | GameReplayV3

export const isReplayV2 = (replay: GameReplay): replay is GameReplayV2 => replay.version === 2
export const isReplayV3 = (replay: GameReplay): replay is GameReplayV3 => replay.version === 3
