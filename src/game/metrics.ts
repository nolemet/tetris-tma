import { BOARD_HEIGHT } from './constants'
import type { BoardMatrix } from '../types'

export const getBoardHeight = (board: BoardMatrix): number => {
  for (let rowIndex = 0; rowIndex < board.length; rowIndex += 1) {
    if (board[rowIndex].some((cell) => cell !== null)) {
      return BOARD_HEIGHT - rowIndex
    }
  }

  return 0
}

export const countBoardHoles = (board: BoardMatrix): number => {
  let holes = 0

  for (let column = 0; column < board[0].length; column += 1) {
    let seenFilledCell = false

    for (let row = 0; row < board.length; row += 1) {
      if (board[row][column] !== null) {
        seenFilledCell = true
        continue
      }

      if (seenFilledCell) {
        holes += 1
      }
    }
  }

  return holes
}
