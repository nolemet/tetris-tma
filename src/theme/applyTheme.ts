import type { ThemeId } from '../types'
import { getThemePreset } from './presets'

export const applyThemePreset = (themeId: ThemeId): void => {
  const theme = getThemePreset(themeId)
  const root = document.documentElement

  Object.entries(theme.cssVars).forEach(([name, value]) => {
    root.style.setProperty(name, value)
  })
}
