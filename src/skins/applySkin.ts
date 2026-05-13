import { getSkinPreset, type SkinPreset } from './catalog'
import type { SkinId } from '../types'

export const applySkinPreset = (skinId: SkinId): SkinPreset => {
  return getSkinPreset(skinId)
}
