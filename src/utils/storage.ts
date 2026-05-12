const HIGH_SCORE_KEY = 'tetris-tma-high-score'

const safeGetStorage = (): Storage | null => {
  try {
    if (typeof window === 'undefined') {
      return null
    }

    return window.localStorage
  } catch {
    return null
  }
}

export const getHighScore = (): number => {
  const value = safeGetStorage()?.getItem(HIGH_SCORE_KEY)
  if (!value) {
    return 0
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export const setHighScore = (score: number): void => {
  safeGetStorage()?.setItem(HIGH_SCORE_KEY, String(Math.max(0, Math.floor(score))))
}
