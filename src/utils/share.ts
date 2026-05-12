import type { TelegramWebApp } from '../types/telegram'

export interface ShareStats {
  score: number
  level: number
  lines: number
  isNewRecord: boolean
}

export const buildShareText = ({ score, level, lines, isNewRecord }: ShareStats): string => {
  const base = `Я набрал ${score} очков в TETRIS. Уровень: ${level}, линий: ${lines}. Сможешь побить мой рекорд?`
  return isNewRecord ? `${base} Новый рекорд!` : base
}

export const buildShareUrl = (text: string, gameUrl: string): string => {
  const safeText = encodeURIComponent(text)
  const safeUrl = encodeURIComponent(gameUrl)
  return `https://t.me/share/url?url=${safeUrl}&text=${safeText}`
}

export const shareResult = (webApp: TelegramWebApp | null, payload: ShareStats, gameUrl: string): void => {
  const text = buildShareText(payload)
  const link = buildShareUrl(text, gameUrl)

  if (webApp?.openTelegramLink) {
    webApp.openTelegramLink(link)
    return
  }

  window.open(link, '_blank', 'noopener,noreferrer')
}
