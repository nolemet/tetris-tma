import { useI18n } from '../i18n'
import styles from './MainMenu.module.css'

interface MainMenuProps {
  onPlay: () => void
  onOpenHistory: () => void
  onOpenProfile: () => void
  onOpenSkins: () => void
  onOpenModes: () => void
  onOpenSettings: () => void
}

export const MainMenu = ({
  onPlay,
  onOpenHistory,
  onOpenProfile,
  onOpenSkins,
  onOpenModes,
  onOpenSettings,
}: MainMenuProps) => {
  const { t } = useI18n()

  return (
    <section className={styles.card}>
      <div className={styles.body}>
        <button type="button" className={styles.primaryButton} onClick={onPlay}>
          {t('mainMenu.play')}
        </button>
        <button type="button" className={styles.secondaryButton} onClick={onOpenHistory}>
          {t('mainMenu.history')}
        </button>
        <button type="button" className={styles.secondaryButton} onClick={onOpenProfile}>
          {t('mainMenu.profile')}
        </button>
        <button type="button" className={styles.secondaryButton} onClick={onOpenSkins}>
          {t('mainMenu.skins')}
        </button>
        <button type="button" className={styles.secondaryButton} onClick={onOpenModes}>
          {t('mainMenu.modes')}
        </button>
        <button type="button" className={styles.secondaryButton} onClick={onOpenSettings}>
          {t('mainMenu.settings')}
        </button>
      </div>
    </section>
  )
}
