import { useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import { BLOCK_STYLE_PRESETS, THEME_PRESETS } from '../theme/presets'
import { SKIN_PRESETS } from '../skins/catalog'
import { findActionForKeyCode, formatKeyCode, GAME_ACTION_LABELS, GAME_ACTIONS } from '../settings/keybinds'
import type { BlockStyleId, GameAction, GameSettings, SkinId, ThemeId } from '../types'
import type { DeepPartial } from '../settings/storage'
import styles from './SettingsPanel.module.css'

interface SettingsPanelProps {
  settings: GameSettings
  onChange: (patch: DeepPartial<GameSettings>) => void
  onResetKeybinds: () => void
  onResetAllSettings: () => void
}

const toggleLabel = (enabled: boolean): 'ON' | 'OFF' => {
  return enabled ? 'ON' : 'OFF'
}

export const SettingsPanel = ({
  settings,
  onChange,
  onResetKeybinds,
  onResetAllSettings,
}: SettingsPanelProps) => {
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
          `${GAME_ACTION_LABELS[bindingAction]} swapped with ${GAME_ACTION_LABELS[occupiedAction]}.`,
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
        setBindingMessage(`${GAME_ACTION_LABELS[bindingAction]} set to ${formatKeyCode(nextCode)}.`)
      }

      setBindingAction(null)
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [bindingAction, onChange, settings.controls.keybinds])

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

  const onBindingReset = () => {
    setBindingAction(null)
    setBindingMessage('Keybinds reset to defaults.')
    onResetKeybinds()
  }

  const onFullReset = () => {
    setBindingAction(null)
    setBindingMessage('All settings reset.')
    onResetAllSettings()
  }

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <h2 className={styles.title}>Settings</h2>
        <span className={styles.version}>v{settings.version}</span>
      </div>

      <div className={styles.group}>
        <h3 className={styles.groupTitle}>Gameplay</h3>
        <div className={styles.list}>
          <div className={styles.row}>
            <span>Ghost piece</span>
            <button
              type="button"
              onClick={() => onChange({ gameplay: { ghostPiece: !settings.gameplay.ghostPiece } })}
            >
              {toggleLabel(settings.gameplay.ghostPiece)}
            </button>
          </div>
          <div className={styles.row}>
            <span>Show next piece</span>
            <button
              type="button"
              onClick={() => onChange({ gameplay: { showNextPiece: !settings.gameplay.showNextPiece } })}
            >
              {toggleLabel(settings.gameplay.showNextPiece)}
            </button>
          </div>
          <div className={styles.row}>
            <span>Show hold piece</span>
            <button
              type="button"
              onClick={() => onChange({ gameplay: { showHoldPiece: !settings.gameplay.showHoldPiece } })}
            >
              {toggleLabel(settings.gameplay.showHoldPiece)}
            </button>
          </div>
          <div className={styles.row}>
            <label htmlFor="startLevel">Start level</label>
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
        <h3 className={styles.groupTitle}>Controls</h3>
        <div className={styles.list}>
          <div className={styles.row}>
            <span>Keyboard</span>
            <button
              type="button"
              onClick={() => onChange({ controls: { enableKeyboard: !settings.controls.enableKeyboard } })}
            >
              {toggleLabel(settings.controls.enableKeyboard)}
            </button>
          </div>
          <div className={styles.row}>
            <span>Touch controls</span>
            <button
              type="button"
              onClick={() =>
                onChange({ controls: { enableTouchControls: !settings.controls.enableTouchControls } })
              }
            >
              {toggleLabel(settings.controls.enableTouchControls)}
            </button>
          </div>
          <div className={styles.row}>
            <label htmlFor="swipeSensitivity">Swipe sensitivity</label>
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
          <p className={styles.hint}>Current swipe threshold: {settings.controls.swipeSensitivity}px</p>
        </div>
      </div>

      <div className={styles.group}>
        <h3 className={styles.groupTitle}>Visual</h3>
        <div className={styles.list}>
          <div className={styles.row}>
            <span>Show grid</span>
            <button type="button" onClick={() => onChange({ visual: { showGrid: !settings.visual.showGrid } })}>
              {toggleLabel(settings.visual.showGrid)}
            </button>
          </div>
          <div className={styles.row}>
            <span>Animations</span>
            <button
              type="button"
              onClick={() => onChange({ visual: { animations: !settings.visual.animations } })}
            >
              {toggleLabel(settings.visual.animations)}
            </button>
          </div>
          <div className={styles.row}>
            <label htmlFor="blockStyle">Block style</label>
            <select id="blockStyle" value={settings.visual.blockStyle} onChange={onBlockStyleChange}>
              {BLOCK_STYLE_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.row}>
            <label htmlFor="theme">Theme</label>
            <select id="theme" value={settings.visual.theme} onChange={onThemeChange}>
              {THEME_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.row}>
            <label htmlFor="selectedSkin">Skin</label>
            <select id="selectedSkin" value={settings.visual.selectedSkin} onChange={onSkinChange}>
              {SKIN_PRESETS.map((skin) => (
                <option key={skin.id} value={skin.id}>
                  {skin.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className={styles.group}>
        <h3 className={styles.groupTitle}>Sound</h3>
        <div className={styles.list}>
          <div className={styles.row}>
            <span>SFX</span>
            <button type="button" onClick={() => onChange({ sound: { sfx: !settings.sound.sfx } })}>
              {toggleLabel(settings.sound.sfx)}
            </button>
          </div>
          <div className={styles.row}>
            <span>Music</span>
            <button type="button" onClick={() => onChange({ sound: { music: !settings.sound.music } })}>
              {toggleLabel(settings.sound.music)}
            </button>
          </div>
          <div className={styles.row}>
            <span>Vibration</span>
            <button
              type="button"
              onClick={() => onChange({ sound: { vibration: !settings.sound.vibration } })}
            >
              {toggleLabel(settings.sound.vibration)}
            </button>
          </div>
          <div className={styles.row}>
            <label htmlFor="volume">Volume</label>
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
          <h3 className={styles.groupTitle}>Keybinds</h3>
          <div className={styles.keybindActions}>
            <button type="button" onClick={onBindingReset}>
              Reset keybinds
            </button>
            <button type="button" onClick={onFullReset}>
              Reset all
            </button>
          </div>
        </div>
        <div className={styles.keybindList}>
          {GAME_ACTIONS.map((action) => (
            <div key={action} className={styles.keybindRow}>
              <div>
                <div className={styles.keybindLabel}>{GAME_ACTION_LABELS[action]}</div>
                <div className={styles.keybindValue}>
                  {bindingAction === action ? 'Press new key...' : formatKeyCode(settings.controls.keybinds[action])}
                </div>
              </div>
              <div className={styles.keybindButtons}>
                {bindingAction === action ? (
                  <button type="button" onClick={() => setBindingAction(null)}>
                    Cancel
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setBindingMessage(null)
                      setBindingAction(action)
                    }}
                  >
                    Change
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
