import type { BoardMatrix, Cell } from '../types'
import type { BoardMetrics } from './types'

export const isCellFilled = (cell: Cell): boolean => cell !== null

export const calculateColumnHeights = (board: BoardMatrix): number[] => {
  const height = board.length
  const width = board[0]?.length ?? 0
  const columnHeights = Array<number>(width).fill(0)

  for (let column = 0; column < width; column += 1) {
    for (let row = 0; row < height; row += 1) {
      if (isCellFilled(board[row][column])) {
        columnHeights[column] = height - row
        break
      }
    }
  }

  return columnHeights
}

export const countHoles = (board: BoardMatrix): number => {
  const width = board[0]?.length ?? 0
  let holes = 0

  for (let column = 0; column < width; column += 1) {
    let seenFilledCell = false

    for (let row = 0; row < board.length; row += 1) {
      if (isCellFilled(board[row][column])) {
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

export const countCoveredHoles = (board: BoardMatrix): number => {
  const width = board[0]?.length ?? 0
  let coveredHoles = 0

  for (let column = 0; column < width; column += 1) {
    let seenFilledCell = false
    let filledCellsAbove = 0

    for (let row = 0; row < board.length; row += 1) {
      if (isCellFilled(board[row][column])) {
        seenFilledCell = true
        filledCellsAbove += 1
        continue
      }

      if (seenFilledCell) {
        coveredHoles += filledCellsAbove
      }
    }
  }

  return coveredHoles
}

export const calculateBumpiness = (columnHeights: number[]): number => {
  let bumpiness = 0

  for (let index = 0; index < columnHeights.length - 1; index += 1) {
    bumpiness += Math.abs(columnHeights[index] - columnHeights[index + 1])
  }

  return bumpiness
}

export const calculateAggregateHeight = (columnHeights: number[]): number => {
  return columnHeights.reduce((sum, value) => sum + value, 0)
}

export const calculateMaxHeight = (columnHeights: number[]): number => {
  return columnHeights.reduce((maxHeight, value) => Math.max(maxHeight, value), 0)
}

export const countCompletedLines = (board: BoardMatrix): number => {
  let completedLines = 0

  for (const row of board) {
    if (row.length > 0 && row.every((cell) => isCellFilled(cell))) {
      completedLines += 1
    }
  }

  return completedLines
}

export const calculateWells = (columnHeights: number[]): number => {
  if (columnHeights.length === 0) {
    return 0
  }

  const boundaryHeight = Math.max(...columnHeights, 0)
  let wells = 0

  for (let index = 0; index < columnHeights.length; index += 1) {
    const leftHeight = index === 0 ? boundaryHeight : columnHeights[index - 1]
    const rightHeight = index === columnHeights.length - 1 ? boundaryHeight : columnHeights[index + 1]
    const wellDepth = Math.min(leftHeight, rightHeight) - columnHeights[index]

    if (wellDepth > 0) {
      wells += (wellDepth * (wellDepth + 1)) / 2
    }
  }

  return wells
}

export const calculateRowTransitions = (board: BoardMatrix): number => {
  const width = board[0]?.length ?? 0
  let transitions = 0

  for (let row = 0; row < board.length; row += 1) {
    let previousFilled = true

    for (let column = 0; column < width; column += 1) {
      const filled = isCellFilled(board[row][column])
      if (filled !== previousFilled) {
        transitions += 1
      }
      previousFilled = filled
    }

    if (!previousFilled) {
      transitions += 1
    }
  }

  return transitions
}

export const calculateColumnTransitions = (board: BoardMatrix): number => {
  const width = board[0]?.length ?? 0
  let transitions = 0

  for (let column = 0; column < width; column += 1) {
    let previousFilled = true

    for (let row = 0; row < board.length; row += 1) {
      const filled = isCellFilled(board[row][column])
      if (filled !== previousFilled) {
        transitions += 1
      }
      previousFilled = filled
    }

    if (!previousFilled) {
      transitions += 1
    }
  }

  return transitions
}

export const analyzeBoard = (board: BoardMatrix): BoardMetrics => {
  const columnHeights = calculateColumnHeights(board)

  return {
    aggregateHeight: calculateAggregateHeight(columnHeights),
    maxHeight: calculateMaxHeight(columnHeights),
    holes: countHoles(board),
    coveredHoles: countCoveredHoles(board),
    bumpiness: calculateBumpiness(columnHeights),
    wells: calculateWells(columnHeights),
    completedLines: countCompletedLines(board),
    columnHeights,
    rowTransitions: calculateRowTransitions(board),
    columnTransitions: calculateColumnTransitions(board),
  }
}
