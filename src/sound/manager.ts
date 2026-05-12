export type SoundId =
  | 'move'
  | 'rotate'
  | 'hardDrop'
  | 'lineClear'
  | 'tetrisClear'
  | 'combo'
  | 'backToBack'
  | 'levelUp'
  | 'gameOver'
  | 'buttonClick'

export interface SoundSettings {
  sfx: boolean
  music: boolean
  vibration: boolean
  volume: number
}

interface Tone {
  frequency: number
  duration: number
  type?: OscillatorType
}

const SOUND_COOLDOWN_MS: Partial<Record<SoundId, number>> = {
  move: 35,
  rotate: 45,
  buttonClick: 55,
}

const SOUND_PATTERNS: Record<SoundId, Tone[]> = {
  move: [{ frequency: 300, duration: 0.04, type: 'square' }],
  rotate: [{ frequency: 430, duration: 0.06, type: 'triangle' }],
  hardDrop: [
    { frequency: 260, duration: 0.06, type: 'square' },
    { frequency: 180, duration: 0.08, type: 'square' },
  ],
  lineClear: [
    { frequency: 520, duration: 0.05, type: 'triangle' },
    { frequency: 650, duration: 0.07, type: 'triangle' },
  ],
  tetrisClear: [
    { frequency: 540, duration: 0.05, type: 'triangle' },
    { frequency: 760, duration: 0.06, type: 'triangle' },
    { frequency: 960, duration: 0.08, type: 'triangle' },
  ],
  combo: [
    { frequency: 700, duration: 0.05, type: 'sine' },
    { frequency: 820, duration: 0.05, type: 'sine' },
  ],
  backToBack: [
    { frequency: 620, duration: 0.05, type: 'triangle' },
    { frequency: 820, duration: 0.05, type: 'triangle' },
    { frequency: 1020, duration: 0.08, type: 'triangle' },
  ],
  levelUp: [
    { frequency: 720, duration: 0.05, type: 'square' },
    { frequency: 900, duration: 0.05, type: 'square' },
    { frequency: 1100, duration: 0.08, type: 'square' },
  ],
  gameOver: [
    { frequency: 320, duration: 0.09, type: 'sawtooth' },
    { frequency: 250, duration: 0.1, type: 'sawtooth' },
    { frequency: 180, duration: 0.14, type: 'sawtooth' },
  ],
  buttonClick: [{ frequency: 460, duration: 0.05, type: 'triangle' }],
}

class SoundManager {
  private ctx: AudioContext | null = null

  private gain: GainNode | null = null

  private lastPlayedAt = new Map<SoundId, number>()

  private getContext(): { ctx: AudioContext; gain: GainNode } | null {
    if (typeof window === 'undefined') {
      return null
    }

    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioCtx) {
        return null
      }
      this.ctx = new AudioCtx()
      this.gain = this.ctx.createGain()
      this.gain.connect(this.ctx.destination)
    }

    if (!this.gain) {
      return null
    }

    return {
      ctx: this.ctx,
      gain: this.gain,
    }
  }

  updateMusicState(settings: SoundSettings): void {
    // Music pipeline is intentionally lightweight for now.
    void settings.music
  }

  play(soundId: SoundId, settings: SoundSettings): void {
    if (!settings.sfx) {
      return
    }

    const audio = this.getContext()
    if (!audio) {
      return
    }

    if (audio.ctx.state === 'suspended') {
      void audio.ctx.resume()
    }

    const nowMs = performance.now()
    const lastPlayed = this.lastPlayedAt.get(soundId) ?? 0
    const cooldown = SOUND_COOLDOWN_MS[soundId] ?? 0
    if (nowMs - lastPlayed < cooldown) {
      return
    }
    this.lastPlayedAt.set(soundId, nowMs)

    const volume = Math.max(0, Math.min(1, settings.volume))
    audio.gain.gain.setValueAtTime(volume * 0.18, audio.ctx.currentTime)

    let offset = 0
    SOUND_PATTERNS[soundId].forEach((tone) => {
      const oscillator = audio.ctx.createOscillator()
      const nodeGain = audio.ctx.createGain()
      const start = audio.ctx.currentTime + offset
      const end = start + tone.duration

      oscillator.type = tone.type ?? 'sine'
      oscillator.frequency.setValueAtTime(tone.frequency, start)

      nodeGain.gain.setValueAtTime(0.0001, start)
      nodeGain.gain.exponentialRampToValueAtTime(volume * 0.25, start + Math.min(0.02, tone.duration * 0.45))
      nodeGain.gain.exponentialRampToValueAtTime(0.0001, end)

      oscillator.connect(nodeGain)
      nodeGain.connect(audio.gain)
      oscillator.start(start)
      oscillator.stop(end)

      offset += tone.duration * 0.78
    })
  }

  vibrate(pattern: number | number[], settings: SoundSettings): void {
    if (!settings.vibration || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
      return
    }

    navigator.vibrate(pattern)
  }
}

export const soundManager = new SoundManager()
