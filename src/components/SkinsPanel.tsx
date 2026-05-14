import { useI18n } from '../i18n'
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

const getSkinNameKey = (skinId: SkinId) => {
  switch (skinId) {
    case 'classic':
      return 'skins.skin.classic.name' as const
    case 'neon':
      return 'skins.skin.neon.name' as const
    case 'ice':
      return 'skins.skin.ice.name' as const
    case 'fire':
      return 'skins.skin.fire.name' as const
    case 'pixel':
      return 'skins.skin.pixel.name' as const
    case 'telegramBlue':
      return 'skins.skin.telegramBlue.name' as const
  }
}

const getSkinDescriptionKey = (skinId: SkinId) => {
  switch (skinId) {
    case 'classic':
      return 'skins.skin.classic.description' as const
    case 'neon':
      return 'skins.skin.neon.description' as const
    case 'ice':
      return 'skins.skin.ice.description' as const
    case 'fire':
      return 'skins.skin.fire.description' as const
    case 'pixel':
      return 'skins.skin.pixel.description' as const
    case 'telegramBlue':
      return 'skins.skin.telegramBlue.description' as const
  }
}

export const SkinsPanel = ({ selectedSkin, onSelectSkin, onBack }: SkinsPanelProps) => {
  const { t } = useI18n()

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>{t('skins.title')}</h2>
          <p className={styles.subtitle}>{t('skins.subtitle')}</p>
        </div>
        <button type="button" className={styles.backButton} onClick={onBack}>
          {t('common.back')}
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
                  <h3 className={styles.itemTitle}>{t(getSkinNameKey(skin.id))}</h3>
                  <p className={styles.itemDescription}>{t(getSkinDescriptionKey(skin.id))}</p>
                </div>
                {selected ? <span className={styles.selectedBadge}>{t('common.selected')}</span> : null}
              </div>

              <button
                type="button"
                className={selected ? styles.selectedButton : styles.selectButton}
                onClick={() => onSelectSkin(skin.id)}
              >
                {selected ? t('common.selected') : t('common.select')}
              </button>
            </article>
          )
        })}
      </div>
    </section>
  )
}
