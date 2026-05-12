import { useEffect, useRef } from 'react'
import type { TouchEvent } from 'react'
import { TAP_MAX_DISTANCE, TAP_MAX_DURATION_MS } from '../game/constants'
import { getActionByKeyCode } from '../settings/keybinds'
import type { GameAction, GameState, KeybindSettings, TouchPoint } from '../types'

interface UseControlsParams {
  gameState: GameState
  keybinds: KeybindSettings
  swipeSensitivity: number
  enableKeyboard: boolean
  enableTouchControls: boolean
  dispatchGameAction: (action: GameAction) => boolean
}

interface BindControlsResult {
  onTouchStart: (event: TouchEvent<HTMLElement>) => void
  onTouchEnd: (event: TouchEvent<HTMLElement>) => void
}

export const useControls = ({
  gameState,
  keybinds,
  swipeSensitivity,
  enableKeyboard,
  enableTouchControls,
  dispatchGameAction,
}: UseControlsParams) => {
  const touchStartRef = useRef<TouchPoint | null>(null)

  useEffect(() => {
    if (!enableKeyboard) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const action = getActionByKeyCode(event.code, keybinds)
      if (!action) {
        return
      }

      if (action === 'pause') {
        if (gameState === 'PLAYING' || gameState === 'PAUSED') {
          event.preventDefault()
          dispatchGameAction(action)
        }
        return
      }

      if (gameState !== 'PLAYING') {
        return
      }

      event.preventDefault()
      dispatchGameAction(action)
    }

    window.addEventListener('keydown', onKeyDown, { passive: false })
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [dispatchGameAction, enableKeyboard, gameState, keybinds])

  const onTouchStart = (event: TouchEvent<HTMLElement>) => {
    if (!enableTouchControls) {
      return
    }

    event.preventDefault()
    const firstTouch = event.touches[0]
    touchStartRef.current = {
      x: firstTouch.clientX,
      y: firstTouch.clientY,
      at: performance.now(),
    }
  }

  const onTouchEnd = (event: TouchEvent<HTMLElement>) => {
    if (!enableTouchControls) {
      touchStartRef.current = null
      return
    }

    event.preventDefault()
    if (gameState !== 'PLAYING') {
      touchStartRef.current = null
      return
    }

    const start = touchStartRef.current
    const endTouch = event.changedTouches[0]
    if (!start || !endTouch) {
      return
    }

    const deltaX = endTouch.clientX - start.x
    const deltaY = endTouch.clientY - start.y
    const duration = performance.now() - start.at
    const absX = Math.abs(deltaX)
    const absY = Math.abs(deltaY)

    if (absX <= TAP_MAX_DISTANCE && absY <= TAP_MAX_DISTANCE && duration <= TAP_MAX_DURATION_MS) {
      dispatchGameAction('rotateCW')
      touchStartRef.current = null
      return
    }

    if (absX > absY && absX >= swipeSensitivity) {
      dispatchGameAction(deltaX > 0 ? 'moveRight' : 'moveLeft')
      touchStartRef.current = null
      return
    }

    if (absY >= swipeSensitivity && deltaY > 0) {
      dispatchGameAction('softDrop')
    }

    touchStartRef.current = null
  }

  const bindBoardControls = (): BindControlsResult => ({
    onTouchStart,
    onTouchEnd,
  })

  return {
    bindBoardControls,
  }
}
