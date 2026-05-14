import { useI18n } from '../i18n'
import type { BotDifficulty } from '../types'
import styles from './GameModesPanel.module.css'

interface GameModesPanelProps {
  onBack: () => void
  onPlayClassic: () => void
  onPlayVsBot: (difficulty: BotDifficulty) => void
}

const DIFFICULTIES: BotDifficulty[] = ['easy', 'medium', 'hard', 'expert']

const getDifficultyLabelKey = (difficulty: BotDifficulty) => {
  switch (difficulty) {
    case 'easy':
      return 'difficulty.easy' as const
    case 'medium':
      return 'difficulty.medium' as const
    case 'hard':
      return 'difficulty.hard' as const
    case 'expert':
      return 'difficulty.expert' as const
  }
}

export const GameModesPanel = ({ onBack, onPlayClassic, onPlayVsBot }: GameModesPanelProps) => {
  const { t } = useI18n()

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>{t('modes.title')}</h2>
          <p className={styles.text}>{t('modes.moreSoon')}</p>
        </div>
        <button type="button" className={styles.backButton} onClick={onBack}>
          {t('common.back')}
        </button>
      </div>

      <div className={styles.grid}>
        <article className={styles.modeCard}>
          <div className={styles.modeBody}>
            <h3 className={styles.modeTitle}>{t('modes.classicTitle')}</h3>
            <p className={styles.modeText}>{t('modes.classicDescription')}</p>
          </div>
          <button type="button" className={styles.primaryButton} onClick={onPlayClassic}>
            {t('modes.playClassic')}
          </button>
        </article>

        <article className={styles.modeCard}>
          <div className={styles.modeBody}>
            <h3 className={styles.modeTitle}>{t('modes.vsBotTitle')}</h3>
            <p className={styles.modeText}>{t('modes.vsBotDescription')}</p>
          </div>
          <div className={styles.difficultyGrid}>
            {DIFFICULTIES.map((difficulty) => (
              <button
                key={difficulty}
                type="button"
                className={styles.secondaryButton}
                onClick={() => onPlayVsBot(difficulty)}
              >
                {t(getDifficultyLabelKey(difficulty))}
              </button>
            ))}
          </div>
        </article>
      </div>
    </section>
  )
}
