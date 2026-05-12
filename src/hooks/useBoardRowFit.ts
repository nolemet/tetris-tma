import { useCallback, useLayoutEffect, useRef } from 'react'

const MIN_SCALE = 0.45

/**
 * Scales the board + sidebar row so it fits the available width (narrow TMA viewports).
 */
export const useBoardRowFit = () => {
  const sectionRef = useRef<HTMLElement | null>(null)
  const outerRef = useRef<HTMLDivElement | null>(null)
  const innerRef = useRef<HTMLDivElement | null>(null)
  const rowRef = useRef<HTMLDivElement | null>(null)

  const update = useCallback(() => {
    const section = sectionRef.current
    const outer = outerRef.current
    const inner = innerRef.current
    const row = rowRef.current
    if (!section || !outer || !inner || !row) {
      return
    }

    inner.style.transform = 'none'
    const w = row.offsetWidth
    const h = row.offsetHeight
    if (w <= 0 || h <= 0) {
      return
    }

    const avail = section.clientWidth
    const scale = Math.min(1, Math.max(MIN_SCALE, (avail - 4) / w))

    inner.style.transform = `scale(${scale})`
    inner.style.transformOrigin = 'top center'
    outer.style.height = `${Math.ceil(h * scale)}px`
  }, [])

  useLayoutEffect(() => {
    const run = () => {
      window.requestAnimationFrame(update)
    }
    run()

    const section = sectionRef.current
    const row = rowRef.current
    if (!section) {
      return undefined
    }

    const ro = new ResizeObserver(run)
    ro.observe(section)
    if (row) {
      ro.observe(row)
    }

    window.addEventListener('orientationchange', run)
    return () => {
      ro.disconnect()
      window.removeEventListener('orientationchange', run)
    }
  }, [update])

  return { sectionRef, outerRef, innerRef, rowRef }
}
