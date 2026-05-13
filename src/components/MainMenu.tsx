import styles from './MainMenu.module.css'

interface MainMenuProps {
  onPlay: () => void
  onOpenModes: () => void
  onOpenSettings: () => void
}

export const MainMenu = ({ onPlay, onOpenModes, onOpenSettings }: MainMenuProps) => {
  return (
    <section className={styles.card}>
      <div className={styles.body}>
        <button type="button" className={styles.primaryButton} onClick={onPlay}>
          Играть
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
