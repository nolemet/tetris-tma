import type { SkinId, TetrominoType } from '../types'

export interface SkinPreset {
  id: SkinId
  name: string
  description: string
  pieceColors: Record<TetrominoType, string>
  ghostColor: string
}

export const SKIN_PRESETS: SkinPreset[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Original arcade palette with bright, balanced colors.',
    pieceColors: {
      I: '#35d9ff',
      O: '#ffd166',
      T: '#b57dff',
      S: '#4cd964',
      Z: '#ff5f6d',
      J: '#5f7cff',
      L: '#ff9f43',
    },
    ghostColor: 'rgba(210, 220, 245, 0.26)',
  },
  {
    id: 'neon',
    name: 'Neon',
    description: 'Electric night colors with bold contrast.',
    pieceColors: {
      I: '#00f5ff',
      O: '#ffe600',
      T: '#e056fd',
      S: '#3dff8b',
      Z: '#ff4d9d',
      J: '#4d8dff',
      L: '#ff8f1f',
    },
    ghostColor: 'rgba(175, 255, 255, 0.3)',
  },
  {
    id: 'ice',
    name: 'Ice',
    description: 'Cool frosted tones with pale highlights.',
    pieceColors: {
      I: '#8de7ff',
      O: '#d4f6ff',
      T: '#a5d8ff',
      S: '#8cf0e2',
      Z: '#9ec5fe',
      J: '#6ea8fe',
      L: '#c7f0ff',
    },
    ghostColor: 'rgba(220, 244, 255, 0.28)',
  },
  {
    id: 'fire',
    name: 'Fire',
    description: 'Hot orange, ember, and lava-inspired pieces.',
    pieceColors: {
      I: '#ffd166',
      O: '#ffb703',
      T: '#ff7b00',
      S: '#ff9100',
      Z: '#ff4d00',
      J: '#ff6b35',
      L: '#ffcf33',
    },
    ghostColor: 'rgba(255, 180, 110, 0.28)',
  },
  {
    id: 'pixel',
    name: 'Pixel',
    description: 'Retro handheld palette with chunky contrast.',
    pieceColors: {
      I: '#92d36e',
      O: '#d7f171',
      T: '#b692ff',
      S: '#73d98f',
      Z: '#ff8b7b',
      J: '#7fa8ff',
      L: '#ffb86c',
    },
    ghostColor: 'rgba(214, 240, 159, 0.24)',
  },
  {
    id: 'telegramBlue',
    name: 'Telegram Blue',
    description: 'Mini App-friendly shades based on Telegram blue.',
    pieceColors: {
      I: '#74c7ff',
      O: '#91d5ff',
      T: '#4ea8ff',
      S: '#2f81f7',
      Z: '#1d5fe0',
      J: '#7ab8ff',
      L: '#9ad3ff',
    },
    ghostColor: 'rgba(122, 184, 255, 0.24)',
  },
]

const SKINS_BY_ID = new Map(SKIN_PRESETS.map((skin) => [skin.id, skin]))

export const isSkinId = (value: unknown): value is SkinId => {
  return typeof value === 'string' && SKINS_BY_ID.has(value as SkinId)
}

export const getSkinPreset = (skinId: SkinId): SkinPreset => {
  return SKINS_BY_ID.get(skinId) ?? SKIN_PRESETS[0]
}
