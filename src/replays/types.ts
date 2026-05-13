import type { GameAction, GameGrade, GameMode } from '../types'

export interface ReplayInput {
  tick: number
  timeMs: number
  action: GameAction
}

export interface ReplayFinalStats {
  score: number
  linesCleared: number
  piecesPlaced: number
  grade: GameGrade
  rating: number
}

export interface GameReplay {
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
  finalStats: ReplayFinalStats
}
