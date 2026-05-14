import type { TouchEvent } from 'react'
import { useI18n } from '../i18n'
import type { GameState } from '../types'
import styles from './ControlPad.module.css'

interface ControlPadProps {
  state: GameState
  touchControlsEnabled: boolean
  showHoldButton?: boolean
  onLeft: () => void
  onRight: () => void
  onRotate: () => void
  onSoftDrop: () => void
  onHardDrop: () => void
  onHold?: () => void
}

export const ControlPad = ({
  state,
  touchControlsEnabled,
  showHoldButton = false,
  onLeft,
  onRight,
  onRotate,
  onSoftDrop,
  onHardDrop,
  onHold,
}: ControlPadProps) => {
  const { t } = useI18n()
  const disabled = state !== 'PLAYING' || !touchControlsEnabled
  const stopTouchPropagation = (event: TouchEvent<HTMLElement>) => {
    event.stopPropagation()
  }

  return (
    <section className={styles.card} onTouchStart={stopTouchPropagation} onTouchEnd={stopTouchPropagation}>
      <h2 className={styles.title}>{t('controls.title')}</h2>
      <div className={styles.grid}>
        <button
          type="button"
          onClick={onLeft}
          disabled={disabled}
          onTouchStart={stopTouchPropagation}
          onTouchEnd={stopTouchPropagation}
        >
          {t('controls.left')}
        </button>
        <button
          type="button"
          onClick={onRotate}
          disabled={disabled}
          onTouchStart={stopTouchPropagation}
          onTouchEnd={stopTouchPropagation}
        >
          {t('controls.rotate')}
        </button>
        <button
          type="button"
          onClick={onRight}
          disabled={disabled}
          onTouchStart={stopTouchPropagation}
          onTouchEnd={stopTouchPropagation}
        >
          {t('controls.right')}
        </button>
        <button
          type="button"
          className={styles.down}
          onClick={onSoftDrop}
          disabled={disabled}
          onTouchStart={stopTouchPropagation}
          onTouchEnd={stopTouchPropagation}
        >
          {t('controls.down')}
        </button>
        {showHoldButton ? (
          <button
            type="button"
            className={styles.hold}
            onClick={onHold}
            disabled={disabled}
            onTouchStart={stopTouchPropagation}
            onTouchEnd={stopTouchPropagation}
          >
            {t('controls.hold')}
          </button>
        ) : null}
        <button
          type="button"
          className={styles.hardDrop}
          onClick={onHardDrop}
          disabled={disabled}
          onTouchStart={stopTouchPropagation}
          onTouchEnd={stopTouchPropagation}
        >
          {t('controls.hardDrop')}
        </button>
      </div>
    </section>
  )
}
