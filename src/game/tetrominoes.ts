import type { ShapeMatrix, TetrominoType } from '../types'

export const TETROMINO_SHAPES: Record<TetrominoType, ShapeMatrix> = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
}

export const TETROMINO_SEQUENCE: TetrominoType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L']

export const TETROMINO_COLORS: Record<TetrominoType, string> = {
  I: '#35d9ff',
  O: '#ffd166',
  T: '#b57dff',
  S: '#4cd964',
  Z: '#ff5f6d',
  J: '#5f7cff',
  L: '#ff9f43',
}
