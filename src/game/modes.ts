import type { GameMode } from '../types'

export interface GameModeConfig {
  id: GameMode
  name: string
  enableHold: boolean
  showHoldPreview: boolean
  showSettingsInGame: boolean
}

export const CLASSIC_MODE_CONFIG: GameModeConfig = {
  id: 'classic',
  name: 'Classic',
  enableHold: false,
  showHoldPreview: false,
  showSettingsInGame: false,
}
