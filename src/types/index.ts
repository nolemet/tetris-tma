export type TetrominoType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L'

export type GameState = 'START' | 'PLAYING' | 'PAUSED' | 'GAME_OVER'

export type BlockStyleId = 'CLASSIC' | 'NEON' | 'PIXEL'

export type ThemeId = 'DEFAULT_DARK' | 'AMOLED' | 'RETRO'

export type SkinId = 'classic' | 'neon' | 'ice' | 'fire' | 'pixel' | 'telegramBlue'

export type GameMode = 'classic'

export type GameAction =
  | 'moveLeft'
  | 'moveRight'
  | 'softDrop'
  | 'hardDrop'
  | 'rotateCW'
  | 'rotateCCW'
  | 'hold'
  | 'pause'

export type GameGrade = 'S' | 'A' | 'B' | 'C' | 'D'

export type Cell = TetrominoType | null

export type BoardMatrix = Cell[][]

export type ShapeMatrix = number[][]

export interface ActivePiece {
  type: TetrominoType
  shape: ShapeMatrix
  x: number
  y: number
}

export interface KeybindSettings {
  moveLeft: string
  moveRight: string
  softDrop: string
  hardDrop: string
  rotateCW: string
  rotateCCW: string
  hold: string
  pause: string
}

export interface ControlsSettings {
  keybinds: KeybindSettings
  swipeSensitivity: number
  enableKeyboard: boolean
  enableTouchControls: boolean
}

export interface GameplaySettings {
  ghostPiece: boolean
  showNextPiece: boolean
  showHoldPiece: boolean
  startLevel: number
  lockDelay: number
}

export interface VisualSettings {
  showGrid: boolean
  animations: boolean
  selectedSkin: SkinId
  theme: ThemeId
  blockStyle: BlockStyleId
}

export interface SoundSettings {
  music: boolean
  sfx: boolean
  vibration: boolean
  volume: number
}

export interface GameStats {
  score: number
  level: number
  lines: number
  highScore: number
  piecesPlaced: number
  singles: number
  doubles: number
  triples: number
  tetrises: number
  maxCombo: number
  currentCombo: number
  holdsUsed: number
  rotationsUsed: number
  hardDropsUsed: number
  softDropsUsed: number
  maxBoardHeight: number
  holesCreated: number
  timePlayedMs: number
  averageTimePerPieceMs: number
  mode: GameMode
  seed: string
}

export interface GameInputRecord {
  tick: number
  action: GameAction
}

export interface GameResult extends GameStats {
  id: string
  endedAt: string
  finalLevel: number
  grade: GameGrade
  rating: number
  replayId?: string | null
}

export interface GameSettings {
  version: number
  controls: ControlsSettings
  gameplay: GameplaySettings
  visual: VisualSettings
  sound: SoundSettings
}

export interface TouchPoint {
  x: number
  y: number
  at: number
}
