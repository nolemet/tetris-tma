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
  return (
    <section className={styles.card}>
      <div className={styles.body}>
        <button type="button" className={styles.primaryButton} onClick={onPlay}>
          Играть
        </button>
        <button type="button" className={styles.secondaryButton} onClick={onOpenHistory}>
          История игр
        </button>
        <button type="button" className={styles.secondaryButton} onClick={onOpenProfile}>
          Профиль
        </button>
        <button type="button" className={styles.secondaryButton} onClick={onOpenSkins}>
          Скины
        </button>
        <button type="button" className={styles.secondaryButton} onClick={onOpenModes}>
          Режимы игры
        </button>
        <button type="button" className={styles.secondaryButton} onClick={onOpenSettings}>
          Настройки
        </button>
      </div>
    </section>
  )
}
