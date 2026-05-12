import type { BlockStyleId, TetrominoType, ThemeId } from '../types'

export interface BlockStylePreset {
  id: BlockStyleId
  label: string
}

export interface ThemePreset {
  id: ThemeId
  label: string
  cssVars: Record<string, string>
  pieceColors: Record<TetrominoType, string>
  ghostColor: string
}

const DEFAULT_PIECE_COLORS: Record<TetrominoType, string> = {
  I: '#35d9ff',
  O: '#ffd166',
  T: '#b57dff',
  S: '#4cd964',
  Z: '#ff5f6d',
  J: '#5f7cff',
  L: '#ff9f43',
}

const AMOLED_PIECE_COLORS: Record<TetrominoType, string> = {
  I: '#1de9ff',
  O: '#ffc400',
  T: '#d074ff',
  S: '#24f38d',
  Z: '#ff4d7e',
  J: '#4e7cff',
  L: '#ff8f36',
}

const RETRO_PIECE_COLORS: Record<TetrominoType, string> = {
  I: '#7de8b4',
  O: '#ffd86b',
  T: '#d8adff',
  S: '#9ae66e',
  Z: '#ff8a80',
  J: '#8db2ff',
  L: '#ffbc73',
}

export const BLOCK_STYLE_PRESETS: BlockStylePreset[] = [
  { id: 'CLASSIC', label: 'Classic' },
  { id: 'NEON', label: 'Neon' },
  { id: 'PIXEL', label: 'Pixel' },
]

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'DEFAULT_DARK',
    label: 'Default Dark',
    cssVars: {
      '--tg-bg-color': '#10131a',
      '--tg-secondary-bg-color': '#1d2232',
      '--tg-text-color': '#f5f7fb',
      '--tg-hint-color': '#98a1b5',
      '--tg-button-color': '#3b82f6',
      '--tg-button-text-color': '#ffffff',
      '--game-app-bg': '#10131a',
      '--game-panel-bg': 'rgba(255, 255, 255, 0.03)',
      '--game-panel-border': 'rgba(255, 255, 255, 0.08)',
      '--game-board-bg': '#0a0d13',
      '--game-board-border': 'rgba(255, 255, 255, 0.09)',
      '--game-grid-line': 'rgba(255, 255, 255, 0.07)',
      '--game-overlay-bg': 'rgba(7, 9, 14, 0.85)',
      '--game-feedback': '#ffffff',
      '--game-feedback-combo': '#ffd166',
      '--game-feedback-b2b': '#7dd3fc',
      '--game-feedback-level': '#86efac',
      '--game-accent': '#3b82f6',
    },
    pieceColors: DEFAULT_PIECE_COLORS,
    ghostColor: 'rgba(210, 220, 245, 0.26)',
  },
  {
    id: 'AMOLED',
    label: 'AMOLED',
    cssVars: {
      '--tg-bg-color': '#000000',
      '--tg-secondary-bg-color': '#111217',
      '--tg-text-color': '#f7f8fc',
      '--tg-hint-color': '#9398ab',
      '--tg-button-color': '#2f81f7',
      '--tg-button-text-color': '#ffffff',
      '--game-app-bg': '#000000',
      '--game-panel-bg': 'rgba(255, 255, 255, 0.04)',
      '--game-panel-border': 'rgba(255, 255, 255, 0.1)',
      '--game-board-bg': '#050608',
      '--game-board-border': 'rgba(255, 255, 255, 0.12)',
      '--game-grid-line': 'rgba(255, 255, 255, 0.09)',
      '--game-overlay-bg': 'rgba(3, 3, 3, 0.88)',
      '--game-feedback': '#ffffff',
      '--game-feedback-combo': '#ffde7a',
      '--game-feedback-b2b': '#67e8f9',
      '--game-feedback-level': '#4ade80',
      '--game-accent': '#2f81f7',
    },
    pieceColors: AMOLED_PIECE_COLORS,
    ghostColor: 'rgba(195, 210, 255, 0.28)',
  },
  {
    id: 'RETRO',
    label: 'Retro',
    cssVars: {
      '--tg-bg-color': '#1b1d14',
      '--tg-secondary-bg-color': '#2c3021',
      '--tg-text-color': '#edf5d2',
      '--tg-hint-color': '#b8c58b',
      '--tg-button-color': '#6b8f23',
      '--tg-button-text-color': '#f7ffe4',
      '--game-app-bg': '#1b1d14',
      '--game-panel-bg': 'rgba(237, 245, 210, 0.07)',
      '--game-panel-border': 'rgba(237, 245, 210, 0.16)',
      '--game-board-bg': '#10120d',
      '--game-board-border': 'rgba(237, 245, 210, 0.2)',
      '--game-grid-line': 'rgba(237, 245, 210, 0.12)',
      '--game-overlay-bg': 'rgba(13, 15, 10, 0.87)',
      '--game-feedback': '#f7ffe2',
      '--game-feedback-combo': '#facc6b',
      '--game-feedback-b2b': '#8be9fd',
      '--game-feedback-level': '#bef264',
      '--game-accent': '#7fbf3f',
    },
    pieceColors: RETRO_PIECE_COLORS,
    ghostColor: 'rgba(211, 234, 167, 0.24)',
  },
]

const THEME_BY_ID = new Map(THEME_PRESETS.map((item) => [item.id, item]))
const BLOCK_STYLE_BY_ID = new Map(BLOCK_STYLE_PRESETS.map((item) => [item.id, item]))

export const getThemePreset = (themeId: ThemeId): ThemePreset => {
  return THEME_BY_ID.get(themeId) ?? THEME_PRESETS[0]
}

export const getBlockStylePreset = (styleId: BlockStyleId): BlockStylePreset => {
  return BLOCK_STYLE_BY_ID.get(styleId) ?? BLOCK_STYLE_PRESETS[0]
}
