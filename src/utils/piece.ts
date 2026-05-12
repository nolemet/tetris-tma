import { BOARD_WIDTH } from '../game/constants'
import { TETROMINO_SHAPES } from '../game/tetrominoes'
import type { ActivePiece, TetrominoType } from '../types'

export const cloneShape = (shape: number[][]): number[][] => {
  return shape.map((row) => [...row])
}

export const createPiece = (type: TetrominoType): ActivePiece => {
  const shape = cloneShape(TETROMINO_SHAPES[type])
  const width = shape[0].length
  return {
    type,
    shape,
    x: Math.floor((BOARD_WIDTH - width) / 2),
    y: -getTopOffset(shape),
  }
}

export const rotateClockwise = (shape: number[][]): number[][] => {
  const h = shape.length
  const w = shape[0].length
  const rotated: number[][] = Array.from({ length: w }, () => Array(h).fill(0))
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      rotated[x][h - 1 - y] = shape[y][x]
    }
  }
  return rotated
}

export const rotateCounterClockwise = (shape: number[][]): number[][] => {
  const h = shape.length
  const w = shape[0].length
  const rotated: number[][] = Array.from({ length: w }, () => Array(h).fill(0))
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      rotated[w - 1 - x][y] = shape[y][x]
    }
  }
  return rotated
}

export const getTopOffset = (shape: number[][]): number => {
  for (let y = 0; y < shape.length; y += 1) {
    if (shape[y].some((cell) => cell === 1)) {
      return y
    }
  }
  return 0
}
