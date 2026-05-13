import { createDefaultKeybinds } from './keybinds'
import { isSkinId } from '../skins/catalog'
import type { BlockStyleId, GameSettings, SkinId, ThemeId } from '../types'

const STORAGE_KEY = 'tetris-tma-settings'
const LEGACY_STORAGE_KEY = 'tetris-tma-settings-v1'
const SETTINGS_VERSION = 1
const MIN_START_LEVEL = 1
const MAX_START_LEVEL = 20
const MIN_SWIPE_SENSITIVITY = 12
const MAX_SWIPE_SENSITIVITY = 120
const MIN_LOCK_DELAY = 0
const MAX_LOCK_DELAY = 1000

const BLOCK_STYLE_IDS = new Set<BlockStyleId>(['CLASSIC', 'NEON', 'PIXEL'])
const THEME_IDS = new Set<ThemeId>(['DEFAULT_DARK', 'AMOLED', 'RETRO'])

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K]
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value))
}

const getBoolean = (value: unknown, fallback: boolean): boolean => {
  return typeof value === 'boolean' ? value : fallback
}

const getString = (value: unknown, fallback: string): string => {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback
}

const getNumber = (value: unknown, fallback: number, min?: number, max?: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }

  if (typeof min === 'number' && typeof max === 'number') {
    return clamp(value, min, max)
  }

  return value
}

const getBlockStyle = (value: unknown, fallback: BlockStyleId): BlockStyleId => {
  return typeof value === 'string' && BLOCK_STYLE_IDS.has(value as BlockStyleId) ? (value as BlockStyleId) : fallback
}

const getTheme = (value: unknown, fallback: ThemeId): ThemeId => {
  return typeof value === 'string' && THEME_IDS.has(value as ThemeId) ? (value as ThemeId) : fallback
}

const getSkin = (value: unknown, fallback: SkinId): SkinId => {
  return isSkinId(value) ? value : fallback
}

export const getDefaultSettings = (): GameSettings => {
  return {
    version: SETTINGS_VERSION,
    controls: {
      keybinds: createDefaultKeybinds(),
      swipeSensitivity: 30,
      enableKeyboard: true,
      enableTouchControls: true,
    },
    gameplay: {
      ghostPiece: true,
      showNextPiece: true,
      showHoldPiece: true,
      startLevel: 1,
      lockDelay: 500,
    },
    visual: {
      showGrid: true,
      animations: true,
      selectedSkin: 'classic',
      theme: 'DEFAULT_DARK',
      blockStyle: 'CLASSIC',
    },
    sound: {
      music: true,
      sfx: true,
      vibration: true,
      volume: 0.65,
    },
  }
}

const normalizeSettings = (raw: unknown): GameSettings => {
  const defaults = getDefaultSettings()
  if (!isRecord(raw)) {
    return defaults
  }

  const controls = isRecord(raw.controls) ? raw.controls : {}
  const gameplay = isRecord(raw.gameplay) ? raw.gameplay : {}
  const visual = isRecord(raw.visual) ? raw.visual : {}
  const sound = isRecord(raw.sound) ? raw.sound : {}
  const keybinds = isRecord(controls.keybinds) ? controls.keybinds : {}

  return {
    version: SETTINGS_VERSION,
    controls: {
      keybinds: {
        moveLeft: getString(keybinds.moveLeft, getString(raw.moveLeft, defaults.controls.keybinds.moveLeft)),
        moveRight: getString(keybinds.moveRight, getString(raw.moveRight, defaults.controls.keybinds.moveRight)),
        softDrop: getString(keybinds.softDrop, getString(raw.softDrop, defaults.controls.keybinds.softDrop)),
        hardDrop: getString(keybinds.hardDrop, getString(raw.hardDrop, defaults.controls.keybinds.hardDrop)),
        rotateCW: getString(keybinds.rotateCW, getString(raw.rotateCW, defaults.controls.keybinds.rotateCW)),
        rotateCCW: getString(keybinds.rotateCCW, getString(raw.rotateCCW, defaults.controls.keybinds.rotateCCW)),
        hold: getString(keybinds.hold, getString(raw.hold, defaults.controls.keybinds.hold)),
        pause: getString(keybinds.pause, getString(raw.pause, defaults.controls.keybinds.pause)),
      },
      swipeSensitivity: getNumber(
        controls.swipeSensitivity,
        defaults.controls.swipeSensitivity,
        MIN_SWIPE_SENSITIVITY,
        MAX_SWIPE_SENSITIVITY,
      ),
      enableKeyboard: getBoolean(controls.enableKeyboard, defaults.controls.enableKeyboard),
      enableTouchControls: getBoolean(controls.enableTouchControls, defaults.controls.enableTouchControls),
    },
    gameplay: {
      ghostPiece: getBoolean(gameplay.ghostPiece ?? raw.ghostPiece, defaults.gameplay.ghostPiece),
      showNextPiece: getBoolean(gameplay.showNextPiece, defaults.gameplay.showNextPiece),
      showHoldPiece: getBoolean(gameplay.showHoldPiece, defaults.gameplay.showHoldPiece),
      startLevel: getNumber(gameplay.startLevel, defaults.gameplay.startLevel, MIN_START_LEVEL, MAX_START_LEVEL),
      lockDelay: getNumber(gameplay.lockDelay, defaults.gameplay.lockDelay, MIN_LOCK_DELAY, MAX_LOCK_DELAY),
    },
    visual: {
      showGrid: getBoolean(visual.showGrid, defaults.visual.showGrid),
      animations: getBoolean(visual.animations, defaults.visual.animations),
      selectedSkin: getSkin(visual.selectedSkin, defaults.visual.selectedSkin),
      theme: getTheme(visual.theme ?? raw.theme, defaults.visual.theme),
      blockStyle: getBlockStyle(visual.blockStyle ?? raw.blockStyle, defaults.visual.blockStyle),
    },
    sound: {
      music: getBoolean(sound.music ?? raw.musicEnabled, defaults.sound.music),
      sfx: getBoolean(sound.sfx ?? raw.soundEnabled, defaults.sound.sfx),
      vibration: getBoolean(sound.vibration, defaults.sound.vibration),
      volume: getNumber(sound.volume ?? raw.volume, defaults.sound.volume, 0, 1),
    },
  }
}

const mergeSettings = (base: GameSettings, patch: DeepPartial<GameSettings>): GameSettings => {
  return normalizeSettings({
    ...base,
    ...patch,
    controls: {
      ...base.controls,
      ...patch.controls,
      keybinds: {
        ...base.controls.keybinds,
        ...patch.controls?.keybinds,
      },
    },
    gameplay: {
      ...base.gameplay,
      ...patch.gameplay,
    },
    visual: {
      ...base.visual,
      ...patch.visual,
    },
    sound: {
      ...base.sound,
      ...patch.sound,
    },
  })
}

const safeGetStorage = (): Storage | null => {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

const readStoredJson = (): string | null => {
  const storage = safeGetStorage()
  if (!storage) {
    return null
  }

  const primaryValue = storage.getItem(STORAGE_KEY)
  if (primaryValue) {
    return primaryValue
  }

  return storage.getItem(LEGACY_STORAGE_KEY)
}

export const loadSettings = (): GameSettings => {
  const json = readStoredJson()
  if (!json) {
    return getDefaultSettings()
  }

  try {
    return normalizeSettings(JSON.parse(json))
  } catch {
    const storage = safeGetStorage()
    storage?.removeItem(STORAGE_KEY)
    storage?.removeItem(LEGACY_STORAGE_KEY)
    return getDefaultSettings()
  }
}

export const saveSettings = (settings: GameSettings): GameSettings => {
  const storage = safeGetStorage()
  const normalized = normalizeSettings(settings)

  if (storage) {
    storage.setItem(STORAGE_KEY, JSON.stringify(normalized))
    storage.removeItem(LEGACY_STORAGE_KEY)
  }

  return normalized
}

export const resetSettings = (): GameSettings => {
  return saveSettings(getDefaultSettings())
}

export const updateSettings = (partialSettings: DeepPartial<GameSettings>): GameSettings => {
  const merged = mergeSettings(loadSettings(), partialSettings)
  return saveSettings(merged)
}

export const getStoredSettings = loadSettings

export const setStoredSettings = saveSettings
