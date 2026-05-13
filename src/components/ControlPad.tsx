import type { TouchEvent } from 'react'
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
  const disabled = state !== 'PLAYING' || !touchControlsEnabled
  const stopTouchPropagation = (event: TouchEvent<HTMLElement>) => {
    event.stopPropagation()
  }

  return (
    <section className={styles.card} onTouchStart={stopTouchPropagation} onTouchEnd={stopTouchPropagation}>
      <h2 className={styles.title}>Controls</h2>
      <div className={styles.grid}>
        <button
          type="button"
          onClick={onLeft}
          disabled={disabled}
          onTouchStart={stopTouchPropagation}
          onTouchEnd={stopTouchPropagation}
        >
          Left
        </button>
        <button
          type="button"
          onClick={onRotate}
          disabled={disabled}
          onTouchStart={stopTouchPropagation}
          onTouchEnd={stopTouchPropagation}
        >
          Rotate
        </button>
        <button
          type="button"
          onClick={onRight}
          disabled={disabled}
          onTouchStart={stopTouchPropagation}
          onTouchEnd={stopTouchPropagation}
        >
          Right
        </button>
        <button
          type="button"
          className={styles.down}
          onClick={onSoftDrop}
          disabled={disabled}
          onTouchStart={stopTouchPropagation}
          onTouchEnd={stopTouchPropagation}
        >
          Down
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
            Hold
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
          Hard drop
        </button>
      </div>
    </section>
  )
}
