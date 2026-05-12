export const COMBO_GRACE_TURNS = 3

export interface ComboState {
  count: number
  turnsWithoutClear: number
}

export interface BackToBackState {
  tetrisStreak: number
}

export interface ChainResolution {
  combo: ComboState
  backToBack: BackToBackState
  comboIndex: number
  backToBackForScore: boolean
  backToBackActive: boolean
}

export const createInitialComboState = (): ComboState => ({
  count: 0,
  turnsWithoutClear: 0,
})

export const createInitialBackToBackState = (): BackToBackState => ({
  tetrisStreak: 0,
})

export const resolveChainsAfterLock = (
  comboState: ComboState,
  backToBackState: BackToBackState,
  clearedLines: number,
): ChainResolution => {
  let nextCombo = comboState
  let nextBackToBack = backToBackState
  let comboIndex = 0
  let backToBackForScore = false

  if (clearedLines > 0) {
    comboIndex = comboState.count + 1
    nextCombo = {
      count: comboIndex,
      turnsWithoutClear: 0,
    }
  } else if (comboState.count > 0) {
    const turnsWithoutClear = comboState.turnsWithoutClear + 1
    if (turnsWithoutClear >= COMBO_GRACE_TURNS) {
      nextCombo = createInitialComboState()
    } else {
      nextCombo = {
        ...comboState,
        turnsWithoutClear,
      }
    }
  }

  if (clearedLines === 4) {
    backToBackForScore = backToBackState.tetrisStreak >= 1
    nextBackToBack = {
      tetrisStreak: backToBackState.tetrisStreak + 1,
    }
  } else {
    nextBackToBack = createInitialBackToBackState()
  }

  return {
    combo: nextCombo,
    backToBack: nextBackToBack,
    comboIndex,
    backToBackForScore,
    backToBackActive: nextBackToBack.tetrisStreak >= 2,
  }
}
