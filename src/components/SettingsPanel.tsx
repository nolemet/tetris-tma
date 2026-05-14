import { useEffect, useState, type ChangeEvent } from 'react'
import { BLOCK_STYLE_PRESETS, THEME_PRESETS } from '../theme/presets'
import { SKIN_PRESETS } from '../skins/catalog'
import { useI18n } from '../i18n'
import { findActionForKeyCode, GAME_ACTIONS } from '../settings/keybinds'
import type { BlockStyleId, GameAction, GameSettings, SkinId, ThemeId, UiLanguage } from '../types'
import type { DeepPartial } from '../settings/storage'
import styles from './SettingsPanel.module.css'

interface SettingsPanelProps {
  settings: GameSettings
  onChange: (patch: DeepPartial<GameSettings>) => void
  onResetKeybinds: () => void
  onResetAllSettings: () => void
}

const getActionLabelKey = (action: GameAction) => {
  switch (action) {
    case 'moveLeft':
      return 'settings.action.moveLeft' as const
    case 'moveRight':
      return 'settings.action.moveRight' as const
    case 'softDrop':
      return 'settings.action.softDrop' as const
    case 'hardDrop':
      return 'settings.action.hardDrop' as const
    case 'rotateCW':
      return 'settings.action.rotateCW' as const
    case 'rotateCCW':
      return 'settings.action.rotateCCW' as const
    case 'hold':
      return 'settings.action.hold' as const
    case 'pause':
      return 'settings.action.pause' as const
  }
}

const getBlockStyleLabelKey = (styleId: BlockStyleId) => {
  switch (styleId) {
    case 'CLASSIC':
      return 'settings.blockStyle.classic' as const
    case 'NEON':
      return 'settings.blockStyle.neon' as const
    case 'PIXEL':
      return 'settings.blockStyle.pixel' as const
  }
}

const getThemeLabelKey = (themeId: ThemeId) => {
  switch (themeId) {
    case 'DEFAULT_DARK':
      return 'settings.theme.defaultDark' as const
    case 'AMOLED':
      return 'settings.theme.amoled' as const
    case 'RETRO':
      return 'settings.theme.retro' as const
  }
}

const getSkinNameKey = (skinId: SkinId) => {
  switch (skinId) {
    case 'classic':
      return 'skins.skin.classic.name' as const
    case 'neon':
      return 'skins.skin.neon.name' as const
    case 'ice':
      return 'skins.skin.ice.name' as const
    case 'fire':
      return 'skins.skin.fire.name' as const
    case 'pixel':
      return 'skins.skin.pixel.name' as const
    case 'telegramBlue':
      return 'skins.skin.telegramBlue.name' as const
  }
}

const toggleLabel = (enabled: boolean, onLabel: string, offLabel: string): string => {
  return enabled ? onLabel : offLabel
}

export const SettingsPanel = ({
  settings,
  onChange,
  onResetKeybinds,
  onResetAllSettings,
}: SettingsPanelProps) => {
  const { t, formatKeyCode } = useI18n()
  const [bindingAction, setBindingAction] = useState<GameAction | null>(null)
  const [bindingMessage, setBindingMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!bindingAction) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()

      const nextCode = event.code
      const currentCode = settings.controls.keybinds[bindingAction]
      const occupiedAction = findActionForKeyCode(nextCode, settings.controls.keybinds)
      const actionLabel = t(getActionLabelKey(bindingAction))

      if (occupiedAction && occupiedAction !== bindingAction) {
        onChange({
          controls: {
            keybinds: {
              ...settings.controls.keybinds,
              [bindingAction]: nextCode,
              [occupiedAction]: currentCode,
            },
          },
        })
        setBindingMessage(
          t('settings.bindingSwapped', {
            action: actionLabel,
            occupied: t(getActionLabelKey(occupiedAction)),
          }),
        )
      } else {
        onChange({
          controls: {
            keybinds: {
              ...settings.controls.keybinds,
              [bindingAction]: nextCode,
            },
          },
        })
        setBindingMessage(
          t('settings.bindingSet', {
            action: actionLabel,
            key: formatKeyCode(nextCode),
          }),
        )
      }

      setBindingAction(null)
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [bindingAction, formatKeyCode, onChange, settings.controls.keybinds, t])

  const onVolumeChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ sound: { volume: Number(event.target.value) / 100 } })
  }

  const onSwipeSensitivityChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ controls: { swipeSensitivity: Number(event.target.value) } })
  }

  const onBlockStyleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onChange({ visual: { blockStyle: event.target.value as BlockStyleId } })
  }

  const onThemeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onChange({ visual: { theme: event.target.value as ThemeId } })
  }

  const onSkinChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onChange({ visual: { selectedSkin: event.target.value as SkinId } })
  }

  const onStartLevelChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ gameplay: { startLevel: Number(event.target.value) } })
  }

  const onLanguageChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onChange({ ui: { language: event.target.value as UiLanguage } })
  }

  const onBindingReset = () => {
    setBindingAction(null)
    setBindingMessage(t('settings.bindingReset'))
    onResetKeybinds()
  }

  const onFullReset = () => {
    setBindingAction(null)
    setBindingMessage(t('settings.allReset'))
    onResetAllSettings()
  }

  const onLabel = t('settings.toggle.on')
  const offLabel = t('settings.toggle.off')

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <h2 className={styles.title}>{t('settings.title')}</h2>
        <span className={styles.version}>v{settings.version}</span>
      </div>

      <div className={styles.group}>
        <h3 className={styles.groupTitle}>{t('settings.section.interface')}</h3>
        <div className={styles.list}>
          <div className={styles.row}>
            <label htmlFor="interfaceLanguage">{t('settings.language')}</label>
            <select id="interfaceLanguage" value={settings.ui.language} onChange={onLanguageChange}>
              <option value="ru">{t('settings.language.ru')}</option>
              <option value="en">{t('settings.language.en')}</option>
            </select>
          </div>
        </div>
      </div>

      <div className={styles.group}>
        <h3 className={styles.groupTitle}>{t('settings.section.gameplay')}</h3>
        <div className={styles.list}>
          <div className={styles.row}>
            <span>{t('settings.ghostPiece')}</span>
            <button
              type="button"
              onClick={() => onChange({ gameplay: { ghostPiece: !settings.gameplay.ghostPiece } })}
            >
              {toggleLabel(settings.gameplay.ghostPiece, onLabel, offLabel)}
            </button>
          </div>
          <div className={styles.row}>
            <span>{t('settings.showNextPiece')}</span>
            <button
              type="button"
              onClick={() => onChange({ gameplay: { showNextPiece: !settings.gameplay.showNextPiece } })}
            >
              {toggleLabel(settings.gameplay.showNextPiece, onLabel, offLabel)}
            </button>
          </div>
          <div className={styles.row}>
            <span>{t('settings.showHoldPiece')}</span>
            <button
              type="button"
              onClick={() => onChange({ gameplay: { showHoldPiece: !settings.gameplay.showHoldPiece } })}
            >
              {toggleLabel(settings.gameplay.showHoldPiece, onLabel, offLabel)}
            </button>
          </div>
          <div className={styles.row}>
            <label htmlFor="startLevel">{t('settings.startLevel')}</label>
            <input
              id="startLevel"
              type="number"
              min={1}
              max={20}
              value={settings.gameplay.startLevel}
              onChange={onStartLevelChange}
            />
          </div>
        </div>
      </div>

      <div className={styles.group}>
        <h3 className={styles.groupTitle}>{t('settings.section.controls')}</h3>
        <div className={styles.list}>
          <div className={styles.row}>
            <span>{t('settings.keyboard')}</span>
            <button
              type="button"
              onClick={() => onChange({ controls: { enableKeyboard: !settings.controls.enableKeyboard } })}
            >
              {toggleLabel(settings.controls.enableKeyboard, onLabel, offLabel)}
            </button>
          </div>
          <div className={styles.row}>
            <span>{t('settings.touchControls')}</span>
            <button
              type="button"
              onClick={() => onChange({ controls: { enableTouchControls: !settings.controls.enableTouchControls } })}
            >
              {toggleLabel(settings.controls.enableTouchControls, onLabel, offLabel)}
            </button>
          </div>
          <div className={styles.row}>
            <label htmlFor="swipeSensitivity">{t('settings.swipeSensitivity')}</label>
            <input
              id="swipeSensitivity"
              type="range"
              min={12}
              max={120}
              step={2}
              value={settings.controls.swipeSensitivity}
              onChange={onSwipeSensitivityChange}
            />
          </div>
          <p className={styles.hint}>{t('settings.swipeThreshold', { pixels: settings.controls.swipeSensitivity })}</p>
        </div>
      </div>

      <div className={styles.group}>
        <h3 className={styles.groupTitle}>{t('settings.section.visual')}</h3>
        <div className={styles.list}>
          <div className={styles.row}>
            <span>{t('settings.showGrid')}</span>
            <button type="button" onClick={() => onChange({ visual: { showGrid: !settings.visual.showGrid } })}>
              {toggleLabel(settings.visual.showGrid, onLabel, offLabel)}
            </button>
          </div>
          <div className={styles.row}>
            <span>{t('settings.animations')}</span>
            <button type="button" onClick={() => onChange({ visual: { animations: !settings.visual.animations } })}>
              {toggleLabel(settings.visual.animations, onLabel, offLabel)}
            </button>
          </div>
          <div className={styles.row}>
            <label htmlFor="blockStyle">{t('settings.blockStyle')}</label>
            <select id="blockStyle" value={settings.visual.blockStyle} onChange={onBlockStyleChange}>
              {BLOCK_STYLE_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {t(getBlockStyleLabelKey(preset.id))}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.row}>
            <label htmlFor="theme">{t('settings.theme')}</label>
            <select id="theme" value={settings.visual.theme} onChange={onThemeChange}>
              {THEME_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {t(getThemeLabelKey(preset.id))}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.row}>
            <label htmlFor="selectedSkin">{t('settings.skin')}</label>
            <select id="selectedSkin" value={settings.visual.selectedSkin} onChange={onSkinChange}>
              {SKIN_PRESETS.map((skin) => (
                <option key={skin.id} value={skin.id}>
                  {t(getSkinNameKey(skin.id))}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className={styles.group}>
        <h3 className={styles.groupTitle}>{t('settings.section.sound')}</h3>
        <div className={styles.list}>
          <div className={styles.row}>
            <span>{t('settings.sfx')}</span>
            <button type="button" onClick={() => onChange({ sound: { sfx: !settings.sound.sfx } })}>
              {toggleLabel(settings.sound.sfx, onLabel, offLabel)}
            </button>
          </div>
          <div className={styles.row}>
            <span>{t('settings.music')}</span>
            <button type="button" onClick={() => onChange({ sound: { music: !settings.sound.music } })}>
              {toggleLabel(settings.sound.music, onLabel, offLabel)}
            </button>
          </div>
          <div className={styles.row}>
            <span>{t('settings.vibration')}</span>
            <button type="button" onClick={() => onChange({ sound: { vibration: !settings.sound.vibration } })}>
              {toggleLabel(settings.sound.vibration, onLabel, offLabel)}
            </button>
          </div>
          <div className={styles.row}>
            <label htmlFor="volume">{t('settings.volume')}</label>
            <input
              id="volume"
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(settings.sound.volume * 100)}
              onChange={onVolumeChange}
            />
          </div>
        </div>
      </div>

      <div className={styles.group}>
        <div className={styles.keybindHeader}>
          <h3 className={styles.groupTitle}>{t('settings.section.keybinds')}</h3>
          <div className={styles.keybindActions}>
            <button type="button" onClick={onBindingReset}>
              {t('settings.resetKeybinds')}
            </button>
            <button type="button" onClick={onFullReset}>
              {t('settings.resetAll')}
            </button>
          </div>
        </div>
        <div className={styles.keybindList}>
          {GAME_ACTIONS.map((action) => (
            <div key={action} className={styles.keybindRow}>
              <div>
                <div className={styles.keybindLabel}>{t(getActionLabelKey(action))}</div>
                <div className={styles.keybindValue}>
                  {bindingAction === action ? t('settings.pressNewKey') : formatKeyCode(settings.controls.keybinds[action])}
                </div>
              </div>
              <div className={styles.keybindButtons}>
                {bindingAction === action ? (
                  <button type="button" onClick={() => setBindingAction(null)}>
                    {t('common.cancel')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setBindingMessage(null)
                      setBindingAction(action)
                    }}
                  >
                    {t('common.change')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        {bindingMessage ? <p className={styles.hint}>{bindingMessage}</p> : null}
      </div>
    </section>
  )
}
