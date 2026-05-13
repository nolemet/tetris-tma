import { SKIN_PRESETS } from '../skins/catalog'
import type { SkinId, TetrominoType } from '../types'
import styles from './SkinsPanel.module.css'

interface SkinsPanelProps {
  selectedSkin: SkinId
  onSelectSkin: (skinId: SkinId) => void
  onBack: () => void
}

const PREVIEW_ROWS: Array<Array<TetrominoType | null>> = [
  ['I', 'I', 'I', 'I'],
  [null, 'T', null, 'O'],
  ['S', 'T', 'T', 'O'],
  ['S', 'Z', 'J', 'L'],
]

export const SkinsPanel = ({ selectedSkin, onSelectSkin, onBack }: SkinsPanelProps) => {
  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Скины фигур</h2>
          <p className={styles.subtitle}>Выбранный скин применяется сразу к полю, Next и ghost piece.</p>
        </div>
        <button type="button" className={styles.backButton} onClick={onBack}>
          Назад
        </button>
      </div>

      <div className={styles.grid}>
        {SKIN_PRESETS.map((skin) => {
          const selected = skin.id === selectedSkin
          return (
            <article key={skin.id} className={styles.item}>
              <div className={styles.preview}>
                {PREVIEW_ROWS.map((row, rowIndex) => (
                  <div key={rowIndex} className={styles.previewRow}>
                    {row.map((cell, cellIndex) => (
                      <span
                        key={`${skin.id}-${rowIndex}-${cellIndex}`}
                        className={styles.previewCell}
                        style={{
                          background: cell ? skin.pieceColors[cell] : 'transparent',
                          borderColor: cell ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>

              <div className={styles.info}>
                <div>
                  <h3 className={styles.itemTitle}>{skin.name}</h3>
                  <p className={styles.itemDescription}>{skin.description}</p>
                </div>
                {selected ? <span className={styles.selectedBadge}>Selected</span> : null}
              </div>

              <button
                type="button"
                className={selected ? styles.selectedButton : styles.selectButton}
                onClick={() => onSelectSkin(skin.id)}
              >
                {selected ? 'Выбрано' : 'Выбрать'}
              </button>
            </article>
          )
        })}
      </div>
    </section>
  )
}
