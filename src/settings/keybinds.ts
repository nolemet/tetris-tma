import type { GameAction, KeybindSettings } from '../types'

export const DEFAULT_KEYBINDS: KeybindSettings = {
  moveLeft: 'ArrowLeft',
  moveRight: 'ArrowRight',
  softDrop: 'ArrowDown',
  hardDrop: 'Space',
  rotateCW: 'ArrowUp',
  rotateCCW: 'KeyZ',
  hold: 'KeyC',
  pause: 'Escape',
}

export const GAME_ACTIONS: GameAction[] = [
  'moveLeft',
  'moveRight',
  'softDrop',
  'hardDrop',
  'rotateCW',
  'rotateCCW',
  'hold',
  'pause',
]

export const GAME_ACTION_LABELS: Record<GameAction, string> = {
  moveLeft: 'Move Left',
  moveRight: 'Move Right',
  softDrop: 'Soft Drop',
  hardDrop: 'Hard Drop',
  rotateCW: 'Rotate',
  rotateCCW: 'Rotate Back',
  hold: 'Hold',
  pause: 'Pause',
}

const KEY_CODE_LABELS: Record<string, string> = {
  Space: 'Space',
  Escape: 'Esc',
  ArrowLeft: 'Left Arrow',
  ArrowRight: 'Right Arrow',
  ArrowUp: 'Up Arrow',
  ArrowDown: 'Down Arrow',
}

export const formatKeyCode = (code: string): string => {
  if (KEY_CODE_LABELS[code]) {
    return KEY_CODE_LABELS[code]
  }

  if (code.startsWith('Key')) {
    return code.slice(3).toUpperCase()
  }

  if (code.startsWith('Digit')) {
    return code.slice(5)
  }

  if (code.startsWith('Numpad')) {
    return `Num ${code.slice(6)}`
  }

  return code
}

export const createDefaultKeybinds = (): KeybindSettings => {
  return { ...DEFAULT_KEYBINDS }
}

export const getActionByKeyCode = (code: string, keybinds: KeybindSettings): GameAction | null => {
  const entry = Object.entries(keybinds).find(([, value]) => value === code)
  return (entry?.[0] as GameAction | undefined) ?? null
}

export const findActionForKeyCode = (code: string, keybinds: KeybindSettings): GameAction | null => {
  return getActionByKeyCode(code, keybinds)
}
