/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, type PropsWithChildren } from 'react'
import { formatDuration as formatDurationValue } from '../game/results'
import type { TranslationParams, UiLanguage } from './types'
import { translations, type TranslationKey } from './translations'

interface I18nValue {
  language: UiLanguage
  t: (key: TranslationKey, params?: TranslationParams) => string
  formatInteger: (value: number) => string
  formatDecimal: (value: number, digits?: number) => string
  formatScoreLoss: (value: number) => string
  formatPercent: (value: number, digits?: number) => string
  formatDuration: (value: number) => string
  formatDateTime: (value: number | string | Date) => string
  formatKeyCode: (code: string) => string
}

const I18nContext = createContext<I18nValue | null>(null)

const LOCALE_BY_LANGUAGE: Record<UiLanguage, string> = {
  ru: 'ru-RU',
  en: 'en-US',
}

const interpolate = (template: string, params?: TranslationParams): string => {
  if (!params) {
    return template
  }

  return Object.entries(params).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template,
  )
}

export const createI18n = (language: UiLanguage): I18nValue => {
  const locale = LOCALE_BY_LANGUAGE[language]
  const integerFormatter = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  })

  const decimalFormatter = (digits: number) =>
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits,
    })

  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  const t = (key: TranslationKey, params?: TranslationParams): string => {
    const template = translations[language][key] ?? translations.en[key] ?? key
    return interpolate(template, params)
  }

  return {
    language,
    t,
    formatInteger: (value: number) => integerFormatter.format(Math.round(Number.isFinite(value) ? value : 0)),
    formatDecimal: (value: number, digits = 1) => decimalFormatter(digits).format(Number.isFinite(value) ? value : 0),
    formatScoreLoss: (value: number) => integerFormatter.format(Math.round(Math.max(0, Number.isFinite(value) ? value : 0))),
    formatPercent: (value: number, digits = 0) =>
      `${decimalFormatter(digits).format(Math.max(0, Number.isFinite(value) ? value : 0))}%`,
    formatDuration: (value: number) => formatDurationValue(value),
    formatDateTime: (value: number | string | Date) => {
      const date = value instanceof Date ? value : new Date(value)
      return Number.isNaN(date.getTime()) ? '-' : dateFormatter.format(date)
    },
    formatKeyCode: (code: string) => {
      const localizedKeys: Record<string, string> = {
        Space: t('settings.key.space'),
        Escape: t('settings.key.escape'),
        ArrowLeft: t('settings.key.arrowLeft'),
        ArrowRight: t('settings.key.arrowRight'),
        ArrowUp: t('settings.key.arrowUp'),
        ArrowDown: t('settings.key.arrowDown'),
      }

      if (localizedKeys[code]) {
        return localizedKeys[code]
      }

      if (code.startsWith('Key')) {
        return code.slice(3).toUpperCase()
      }

      if (code.startsWith('Digit')) {
        return code.slice(5)
      }

      if (code.startsWith('Numpad')) {
        return t('settings.key.numpad', { value: code.slice(6) })
      }

      return code
    },
  }
}

interface I18nProviderProps extends PropsWithChildren {
  value: I18nValue
}

export const I18nProvider = ({ value, children }: I18nProviderProps) => {
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export const useI18n = (): I18nValue => {
  const value = useContext(I18nContext)

  if (!value) {
    throw new Error('useI18n must be used inside I18nProvider')
  }

  return value
}

export const useCreateI18n = (language: UiLanguage): I18nValue => {
  return useMemo(() => createI18n(language), [language])
}
