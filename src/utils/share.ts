import type { UiLanguage } from '../types'
import type { TelegramWebApp } from '../types/telegram'

export interface ShareStats {
  score: number
  level: number
  lines: number
  isNewRecord: boolean
}

export const buildShareText = ({ score, level, lines, isNewRecord }: ShareStats, language: UiLanguage = 'en'): string => {
  if (language === 'ru') {
    const base = `Я набрал ${score} очков в TETRIS. Уровень: ${level}, линий: ${lines}. Сможешь побить мой рекорд?`
    return isNewRecord ? `${base} Новый рекорд!` : base
  }

  const base = `I scored ${score} points in TETRIS. Level: ${level}, lines: ${lines}. Can you beat my record?`
  return isNewRecord ? `${base} New high score!` : base
}

export const buildShareUrl = (text: string, gameUrl: string): string => {
  const safeText = encodeURIComponent(text)
  const safeUrl = encodeURIComponent(gameUrl)
  return `https://t.me/share/url?url=${safeUrl}&text=${safeText}`
}

export const shareResult = (
  webApp: TelegramWebApp | null,
  payload: ShareStats,
  gameUrl: string,
  language: UiLanguage = 'en',
): void => {
  const text = buildShareText(payload, language)
  const link = buildShareUrl(text, gameUrl)

  if (webApp?.openTelegramLink) {
    webApp.openTelegramLink(link)
    return
  }

  window.open(link, '_blank', 'noopener,noreferrer')
}
