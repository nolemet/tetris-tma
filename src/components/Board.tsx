import { useEffect, useRef } from 'react'
import type { TouchEvent } from 'react'
import { BOARD_HEIGHT, BOARD_WIDTH, BLOCK_SIZE } from '../game/constants'
import type { ActivePiece, BlockStyleId, BoardMatrix, TetrominoType } from '../types'

interface BoardProps {
  board: BoardMatrix
  activePiece: ActivePiece | null
  ghostPiece: ActivePiece | null
  lineClearRows: number[]
  showGrid: boolean
  blockStyle: BlockStyleId
  pieceColors: Record<TetrominoType, string>
  ghostColor: string
  onTouchStart?: (event: TouchEvent<HTMLCanvasElement>) => void
  onTouchEnd?: (event: TouchEvent<HTMLCanvasElement>) => void
}

const drawBlock = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  blockStyle: BlockStyleId,
) => {
  if (blockStyle === 'NEON') {
    ctx.save()
    ctx.fillStyle = color
    ctx.shadowColor = color
    ctx.shadowBlur = 9
    ctx.fillRect(x + 1, y + 1, size - 2, size - 2)
    ctx.shadowBlur = 0
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
    ctx.strokeRect(x + 1.5, y + 1.5, size - 3, size - 3)
    ctx.restore()
    return
  }

  if (blockStyle === 'PIXEL') {
    ctx.fillStyle = color
    ctx.fillRect(x, y, size, size)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)'
    ctx.fillRect(x + 2, y + 2, size - 6, size - 6)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)'
    ctx.fillRect(x + 4, y + 4, size - 8, size - 8)
    return
  }

  ctx.fillStyle = color
  ctx.fillRect(x, y, size, size)
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'
  ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1)
  ctx.fillStyle = 'rgba(255,255,255,0.16)'
  ctx.fillRect(x + 2, y + 2, size - 6, 4)
}

const drawPiece = (
  ctx: CanvasRenderingContext2D,
  piece: ActivePiece,
  blockStyle: BlockStyleId,
  pieceColors: Record<TetrominoType, string>,
) => {
  for (let y = 0; y < piece.shape.length; y += 1) {
    for (let x = 0; x < piece.shape[y].length; x += 1) {
      if (piece.shape[y][x] !== 1) {
        continue
      }
      const boardX = piece.x + x
      const boardY = piece.y + y
      if (boardY < 0 || boardY >= BOARD_HEIGHT || boardX < 0 || boardX >= BOARD_WIDTH) {
        continue
      }

      const px = boardX * BLOCK_SIZE
      const py = boardY * BLOCK_SIZE
      drawBlock(ctx, px, py, BLOCK_SIZE, pieceColors[piece.type], blockStyle)
    }
  }
}

export const Board = ({
  board,
  activePiece,
  ghostPiece,
  lineClearRows,
  showGrid,
  blockStyle,
  pieceColors,
  ghostColor,
  onTouchStart,
  onTouchEnd,
}: BoardProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const rootStyle = getComputedStyle(document.documentElement)
    const gridColor = rootStyle.getPropertyValue('--game-grid-line').trim() || 'rgba(255,255,255,0.07)'

    for (let y = 0; y < BOARD_HEIGHT; y += 1) {
      for (let x = 0; x < BOARD_WIDTH; x += 1) {
        const cell = board[y][x]
        const px = x * BLOCK_SIZE
        const py = y * BLOCK_SIZE

        if (cell) {
          drawBlock(ctx, px, py, BLOCK_SIZE, pieceColors[cell], blockStyle)
        } else if (showGrid) {
          ctx.strokeStyle = gridColor
          ctx.strokeRect(px + 0.5, py + 0.5, BLOCK_SIZE - 1, BLOCK_SIZE - 1)
        }
      }
    }

    if (ghostPiece) {
      ctx.save()
      for (let y = 0; y < ghostPiece.shape.length; y += 1) {
        for (let x = 0; x < ghostPiece.shape[y].length; x += 1) {
          if (ghostPiece.shape[y][x] !== 1) {
            continue
          }
          const boardX = ghostPiece.x + x
          const boardY = ghostPiece.y + y
          if (boardY < 0 || boardY >= BOARD_HEIGHT || boardX < 0 || boardX >= BOARD_WIDTH) {
            continue
          }

          const px = boardX * BLOCK_SIZE
          const py = boardY * BLOCK_SIZE
          ctx.fillStyle = ghostColor
          ctx.fillRect(px + 2, py + 2, BLOCK_SIZE - 4, BLOCK_SIZE - 4)
          ctx.strokeStyle = 'rgba(255,255,255,0.35)'
          ctx.strokeRect(px + 2.5, py + 2.5, BLOCK_SIZE - 5, BLOCK_SIZE - 5)
        }
      }
      ctx.restore()
    }

    if (activePiece) {
      drawPiece(ctx, activePiece, blockStyle, pieceColors)
    }

    if (lineClearRows.length > 0) {
      ctx.save()
      lineClearRows.forEach((row) => {
        const py = row * BLOCK_SIZE
        ctx.fillStyle = 'rgba(255, 255, 255, 0.28)'
        ctx.fillRect(0, py, BOARD_WIDTH * BLOCK_SIZE, BLOCK_SIZE)
      })
      ctx.restore()
    }
  }, [activePiece, blockStyle, board, ghostColor, ghostPiece, lineClearRows, pieceColors, showGrid])

  return (
    <canvas
      ref={canvasRef}
      width={BOARD_WIDTH * BLOCK_SIZE}
      height={BOARD_HEIGHT * BLOCK_SIZE}
      aria-label="Tetris game board"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{ touchAction: 'none' }}
    />
  )
}
