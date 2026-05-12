import { useEffect, useMemo } from 'react'
import type { TelegramThemeParams, TelegramWebApp } from '../types/telegram'

const applyThemeParams = (theme: TelegramThemeParams): void => {
  const root = document.documentElement
  const map: Record<string, string | undefined> = {
    '--tg-bg-color': theme.bg_color,
    '--tg-secondary-bg-color': theme.secondary_bg_color,
    '--tg-text-color': theme.text_color,
    '--tg-hint-color': theme.hint_color,
    '--tg-link-color': theme.link_color,
    '--tg-button-color': theme.button_color,
    '--tg-button-text-color': theme.button_text_color,
    '--tg-header-bg-color': theme.header_bg_color,
  }

  Object.entries(map).forEach(([name, value]) => {
    if (value) {
      root.style.setProperty(name, value)
    }
  })
}

const applyViewportVars = (webApp: TelegramWebApp): void => {
  const root = document.documentElement
  root.style.setProperty('--tg-viewport-height', `${webApp.viewportHeight}px`)
  root.style.setProperty('--tg-viewport-stable-height', `${webApp.viewportStableHeight}px`)
}

const isTelegramRuntime = (webApp: TelegramWebApp | null): webApp is TelegramWebApp => {
  if (!webApp) {
    return false
  }

  return Boolean(webApp.initData) || webApp.platform !== 'unknown'
}

export const useTelegram = () => {
  const webApp = useMemo<TelegramWebApp | null>(() => {
    if (typeof window === 'undefined') {
      return null
    }

    const app = window.Telegram?.WebApp ?? null
    return isTelegramRuntime(app) ? app : null
  }, [])

  useEffect(() => {
    const app = webApp
    if (!app) {
      return
    }

    app.ready()
    app.expand()
    applyThemeParams(app.themeParams)
    applyViewportVars(app)

    const onThemeChanged = () => applyThemeParams(app.themeParams)
    const onViewportChanged = () => applyViewportVars(app)

    app.onEvent('themeChanged', onThemeChanged)
    app.onEvent('viewportChanged', onViewportChanged)

    return () => {
      app.offEvent('themeChanged', onThemeChanged)
      app.offEvent('viewportChanged', onViewportChanged)
    }
  }, [webApp])

  const isDark = useMemo(() => webApp?.colorScheme === 'dark', [webApp])

  return {
    webApp,
    isDark,
    user: webApp?.initDataUnsafe.user ?? null,
  }
}
