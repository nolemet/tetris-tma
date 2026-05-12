import { LEVEL_STEP_LINES } from './constants'

export const LINE_CLEAR_POINTS: Record<number, number> = {
  1: 100,
  2: 300,
  3: 500,
  4: 800,
}

export const COMBO_BONUS_STEP = 50
export const SOFT_DROP_POINT = 1
export const HARD_DROP_POINT_PER_ROW = 2
export const BACK_TO_BACK_TETRIS_MULTIPLIER = 1.5

export interface LockScoreInput {
  clearedLines: number
  comboIndex: number
  hardDropDistance: number
  backToBackActive: boolean
}

export interface LockScoreBreakdown {
  lineClearPoints: number
  comboBonus: number
  hardDropPoints: number
  total: number
}

export const calculateLockScore = ({
  clearedLines,
  comboIndex,
  hardDropDistance,
  backToBackActive,
}: LockScoreInput): LockScoreBreakdown => {
  const base = LINE_CLEAR_POINTS[clearedLines] ?? 0
  const lineClearPoints =
    clearedLines === 4 && backToBackActive ? Math.floor(base * BACK_TO_BACK_TETRIS_MULTIPLIER) : base
  const comboBonus = clearedLines > 0 ? COMBO_BONUS_STEP * Math.max(1, comboIndex) : 0
  const hardDropPoints = Math.max(0, hardDropDistance) * HARD_DROP_POINT_PER_ROW
  const total = lineClearPoints + comboBonus + hardDropPoints

  return {
    lineClearPoints,
    comboBonus,
    hardDropPoints,
    total,
  }
}

export const softDropScore = (steps = 1): number => {
  return Math.max(0, steps) * SOFT_DROP_POINT
}

export const levelByLines = (lines: number, startLevel = 1): number => {
  return Math.floor(lines / LEVEL_STEP_LINES) + Math.max(1, startLevel)
}

export const tickMsByLevel = (level: number, baseTick: number, minTick: number): number => {
  const speedUp = (level - 1) * 55
  return Math.max(minTick, baseTick - speedUp)
}
