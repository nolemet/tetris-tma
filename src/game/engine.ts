import { BOARD_HEIGHT, BOARD_WIDTH } from './constants'
import { getNextPiece, type PieceGenerator } from './pieceGenerator'
import { createPiece, rotateClockwise, rotateCounterClockwise } from '../utils/piece'
import type { ActivePiece, BoardMatrix, Cell, TetrominoType } from '../types'

export interface LockedBoardResult {
  mergedBoard: BoardMatrix
  board: BoardMatrix
  clearedLines: number
  clearedRows: number[]
}

export interface SpawnResult {
  activePiece: ActivePiece | null
  nextPieceType: TetrominoType
  pieceGenerator: PieceGenerator
  gameOver: boolean
}

export interface LockAndSpawnResult extends LockedBoardResult, SpawnResult {}

export const createEmptyBoard = (): BoardMatrix => {
  return Array.from({ length: BOARD_HEIGHT }, () => Array<Cell>(BOARD_WIDTH).fill(null))
}

export const canPlacePiece = (board: BoardMatrix, piece: ActivePiece): boolean => {
  for (let y = 0; y < piece.shape.length; y += 1) {
    for (let x = 0; x < piece.shape[y].length; x += 1) {
      if (piece.shape[y][x] !== 1) {
        continue
      }

      const boardX = piece.x + x
      const boardY = piece.y + y

      if (boardX < 0 || boardX >= BOARD_WIDTH || boardY >= BOARD_HEIGHT) {
        return false
      }

      if (boardY >= 0 && board[boardY][boardX] !== null) {
        return false
      }
    }
  }

  return true
}

export const movePiece = (board: BoardMatrix, piece: ActivePiece, dx: number, dy: number): ActivePiece | null => {
  const moved: ActivePiece = {
    ...piece,
    x: piece.x + dx,
    y: piece.y + dy,
  }
  return canPlacePiece(board, moved) ? moved : null
}

export const rotateWithWallKick = (board: BoardMatrix, piece: ActivePiece, direction: 'CW' | 'CCW' = 'CW'): ActivePiece => {
  const rotatedShape = direction === 'CCW' ? rotateCounterClockwise(piece.shape) : rotateClockwise(piece.shape)
  const offsets = [0, -1, 1, -2, 2]

  for (const offset of offsets) {
    const candidate: ActivePiece = {
      ...piece,
      shape: rotatedShape,
      x: piece.x + offset,
    }
    if (canPlacePiece(board, candidate)) {
      return candidate
    }
  }

  return piece
}

export const mergePieceIntoBoard = (board: BoardMatrix, piece: ActivePiece): BoardMatrix => {
  const merged = board.map((row) => [...row])

  for (let y = 0; y < piece.shape.length; y += 1) {
    for (let x = 0; x < piece.shape[y].length; x += 1) {
      if (piece.shape[y][x] !== 1) {
        continue
      }
      const boardX = piece.x + x
      const boardY = piece.y + y
      if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
        merged[boardY][boardX] = piece.type
      }
    }
  }

  return merged
}

export const clearFullLines = (board: BoardMatrix): { board: BoardMatrix; cleared: number } => {
  const keptRows = board.filter((row) => row.some((cell) => cell === null))
  const cleared = BOARD_HEIGHT - keptRows.length
  if (cleared === 0) {
    return { board, cleared: 0 }
  }
  const newRows = Array.from({ length: cleared }, () => Array<Cell>(BOARD_WIDTH).fill(null))
  return { board: [...newRows, ...keptRows], cleared }
}

export const getFullLineRows = (board: BoardMatrix): number[] => {
  const rows: number[] = []
  for (let y = 0; y < BOARD_HEIGHT; y += 1) {
    if (board[y].every((cell) => cell !== null)) {
      rows.push(y)
    }
  }
  return rows
}

export const clearRows = (board: BoardMatrix, rows: number[]): BoardMatrix => {
  if (rows.length === 0) {
    return board
  }

  const rowSet = new Set(rows)
  const keptRows = board.filter((_, rowIndex) => !rowSet.has(rowIndex))
  const newRows = Array.from({ length: rows.length }, () => Array<Cell>(BOARD_WIDTH).fill(null))
  return [...newRows, ...keptRows]
}

export const resolveLockedBoard = (board: BoardMatrix, activePiece: ActivePiece): LockedBoardResult => {
  const mergedBoard = mergePieceIntoBoard(board, activePiece)
  const clearedRows = getFullLineRows(mergedBoard)
  const boardAfterClear = clearRows(mergedBoard, clearedRows)

  return {
    mergedBoard,
    board: boardAfterClear,
    clearedLines: clearedRows.length,
    clearedRows,
  }
}

export const spawnNextPiece = (
  board: BoardMatrix,
  nextPieceType: TetrominoType,
  pieceGenerator: PieceGenerator,
): SpawnResult => {
  const spawnedPiece = createPiece(nextPieceType)
  const gameOver = !canPlacePiece(board, spawnedPiece)
  const nextPiece = getNextPiece(pieceGenerator)

  return {
    activePiece: gameOver ? null : spawnedPiece,
    nextPieceType: nextPiece.pieceType,
    pieceGenerator: nextPiece.generator,
    gameOver,
  }
}

export const lockAndSpawn = (
  board: BoardMatrix,
  activePiece: ActivePiece,
  nextPieceType: TetrominoType,
  pieceGenerator: PieceGenerator,
): LockAndSpawnResult => {
  const locked = resolveLockedBoard(board, activePiece)
  const spawned = spawnNextPiece(locked.board, nextPieceType, pieceGenerator)
  return {
    ...locked,
    ...spawned,
  }
}

export const mergeBoardAndPiece = (board: BoardMatrix, activePiece: ActivePiece | null): BoardMatrix => {
  if (!activePiece) {
    return board
  }
  return mergePieceIntoBoard(board, activePiece)
}

export const projectGhostPiece = (board: BoardMatrix, activePiece: ActivePiece | null): ActivePiece | null => {
  if (!activePiece) {
    return null
  }

  let ghost = activePiece

  while (true) {
    const moved = movePiece(board, ghost, 0, 1)
    if (!moved) {
      break
    }
    ghost = moved
  }

  return ghost
}
