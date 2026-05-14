import { NEXT_PREVIEW_BLOCK_SIZE } from '../game/constants'
import { TETROMINO_SHAPES } from '../game/tetrominoes'
import { useI18n } from '../i18n'
import type { TetrominoType } from '../types'
import styles from './NextPiece.module.css'

interface NextPieceProps {
  title?: string
  pieceType: TetrominoType | null
  pieceColors: Record<TetrominoType, string>
  layout?: 'stacked' | 'sidebar'
}

const EMPTY_PREVIEW = [
  [0, 0, 0, 0],
  [0, 0, 0, 0],
]

export const NextPiece = ({ title, pieceType, pieceColors, layout = 'stacked' }: NextPieceProps) => {
  const { t } = useI18n()
  const shape = pieceType ? TETROMINO_SHAPES[pieceType] : EMPTY_PREVIEW
  const resolvedTitle = title ?? t('game.next')
  const sectionClass = [styles.card, layout === 'sidebar' ? styles.sidebar : ''].filter(Boolean).join(' ')

  return (
    <section className={sectionClass}>
      <h2 className={styles.title}>{resolvedTitle}</h2>
      <div className={styles.preview}>
        {shape.map((row, y) => (
          <div key={y} className={styles.row}>
            {row.map((cell, x) => (
              <span
                key={`${x}-${y}`}
                className={styles.cell}
                style={{
                  width: NEXT_PREVIEW_BLOCK_SIZE,
                  height: NEXT_PREVIEW_BLOCK_SIZE,
                  backgroundColor: cell && pieceType ? pieceColors[pieceType] : 'transparent',
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}
