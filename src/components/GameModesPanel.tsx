import styles from './GameModesPanel.module.css'

interface GameModesPanelProps {
  onBack: () => void
}

const UPCOMING_MODES = ['Classic', 'Extended Pieces', 'Vs Bot', 'Training']

export const GameModesPanel = ({ onBack }: GameModesPanelProps) => {
  return (
    <section className={styles.card}>
      <h2 className={styles.title}>Режимы игры</h2>
      <p className={styles.text}>Скоро здесь появятся новые режимы игры.</p>
      <ul className={styles.list}>
        {UPCOMING_MODES.map((mode) => (
          <li key={mode} className={styles.item}>
            {mode}
          </li>
        ))}
      </ul>
      <button type="button" className={styles.backButton} onClick={onBack}>
        Назад
      </button>
    </section>
  )
}
