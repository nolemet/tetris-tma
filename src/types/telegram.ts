export interface TelegramThemeParams {
  bg_color?: string
  secondary_bg_color?: string
  text_color?: string
  hint_color?: string
  link_color?: string
  button_color?: string
  button_text_color?: string
  header_bg_color?: string
  accent_text_color?: string
  section_bg_color?: string
  section_header_text_color?: string
  subtitle_text_color?: string
  destructive_text_color?: string
}

export interface TelegramViewportChangedEvent {
  isStateStable: boolean
}

export interface TelegramWebAppUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
}

export interface TelegramWebAppInitDataUnsafe {
  user?: TelegramWebAppUser
}

export interface TelegramWebApp {
  ready: () => void
  expand: () => void
  close: () => void
  openTelegramLink?: (url: string) => void
  switchInlineQuery?: (query: string, chooseChatTypes?: string[]) => void
  onEvent: (eventType: 'themeChanged' | 'viewportChanged', callback: () => void) => void
  offEvent: (eventType: 'themeChanged' | 'viewportChanged', callback: () => void) => void
  themeParams: TelegramThemeParams
  colorScheme: 'light' | 'dark'
  platform: string
  version: string
  viewportHeight: number
  viewportStableHeight: number
  isExpanded: boolean
  initData: string
  initDataUnsafe: TelegramWebAppInitDataUnsafe
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp
    }
  }
}
