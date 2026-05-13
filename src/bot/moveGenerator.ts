import { canPlacePiece as canPlacePieceOnBoard, resolveLockedBoard } from '../game/engine'
import { TETROMINO_SHAPES } from '../game/tetrominoes'
import { cloneShape, rotateClockwise } from '../utils/piece'
import type { ActivePiece, BoardMatrix, ShapeMatrix, TetrominoType } from '../types'
import type { BotPlacement } from './types'

interface ShapeBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

type PlacementLike = Pick<BotPlacement, 'x' | 'y' | 'rotation'>

const getShapeKey = (shape: ShapeMatrix): string => {
  return shape.map((row) => row.join('')).join('|')
}

const getRotatedShape = (pieceType: TetrominoType, rotation: number): ShapeMatrix => {
  let shape = cloneShape(TETROMINO_SHAPES[pieceType])
  const normalizedRotation = ((rotation % 4) + 4) % 4

  for (let step = 0; step < normalizedRotation; step += 1) {
    shape = rotateClockwise(shape)
  }

  return shape
}

const getShapeBounds = (shape: ShapeMatrix): ShapeBounds => {
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (let y = 0; y < shape.length; y += 1) {
    for (let x = 0; x < shape[y].length; x += 1) {
      if (shape[y][x] !== 1) {
        continue
      }

      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }
  }

  return {
    minX: Number.isFinite(minX) ? minX : 0,
    maxX: Number.isFinite(maxX) ? maxX : 0,
    minY: Number.isFinite(minY) ? minY : 0,
    maxY: Number.isFinite(maxY) ? maxY : 0,
  }
}

const buildPieceState = (
  pieceType: TetrominoType,
  rotation: number,
  x: number,
  y: number,
): ActivePiece => {
  return {
    type: pieceType,
    shape: getRotatedShape(pieceType, rotation),
    x,
    y,
  }
}

export const getUniqueRotations = (piece: ActivePiece): number[] => {
  const uniqueRotations: number[] = []
  const seen = new Set<string>()

  for (let rotation = 0; rotation < 4; rotation += 1) {
    const shape = getRotatedShape(piece.type, rotation)
    const key = getShapeKey(shape)

    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    uniqueRotations.push(rotation)
  }

  return uniqueRotations
}

export const canPlacePiece = (
  board: BoardMatrix,
  piece: ActivePiece,
  x: number,
  y: number,
  rotation: number,
): boolean => {
  return canPlacePieceOnBoard(board, buildPieceState(piece.type, rotation, x, y))
}

export const dropPieceToBottom = (
  board: BoardMatrix,
  piece: ActivePiece,
  x: number,
  rotation: number,
): number | null => {
  const bounds = getShapeBounds(getRotatedShape(piece.type, rotation))
  let y = -bounds.minY

  if (!canPlacePiece(board, piece, x, y, rotation)) {
    return null
  }

  while (canPlacePiece(board, piece, x, y + 1, rotation)) {
    y += 1
  }

  return y
}

export const simulatePlacement = (
  board: BoardMatrix,
  piece: ActivePiece,
  placement: PlacementLike,
): {
  board: BoardMatrix
  linesCleared: number
} => {
  const placedPiece = buildPieceState(piece.type, placement.rotation, placement.x, placement.y)

  if (!canPlacePieceOnBoard(board, placedPiece)) {
    throw new Error(`Illegal placement for piece ${piece.type} at x=${placement.x}, y=${placement.y}, r=${placement.rotation}`)
  }

  const resolved = resolveLockedBoard(board, placedPiece)

  return {
    board: resolved.board,
    linesCleared: resolved.clearedLines,
  }
}

export const generateLegalPlacements = (board: BoardMatrix, piece: ActivePiece): BotPlacement[] => {
  const boardWidth = board[0]?.length ?? 0
  const seen = new Set<string>()
  const placements: BotPlacement[] = []

  for (const rotation of getUniqueRotations(piece)) {
    const shape = getRotatedShape(piece.type, rotation)
    const bounds = getShapeBounds(shape)
    const minX = -bounds.minX
    const maxX = boardWidth - 1 - bounds.maxX

    for (let x = minX; x <= maxX; x += 1) {
      const y = dropPieceToBottom(board, piece, x, rotation)
      if (y === null) {
        continue
      }

      const key = `${rotation}:${x}:${y}`
      if (seen.has(key)) {
        continue
      }

      seen.add(key)
      const simulation = simulatePlacement(board, piece, { x, y, rotation })
      placements.push({
        pieceType: piece.type,
        x,
        y,
        rotation,
        linesCleared: simulation.linesCleared,
        resultingBoard: simulation.board.map((row) => [...row]),
      })
    }
  }

  return placements
}
