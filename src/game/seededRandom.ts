export interface SeededRandomState {
  value: number
}

const FALLBACK_SEED = 0x1a2b3c4d

export const hashSeed = (seed: string | number): number => {
  const source = String(seed)
  let hash = 2166136261

  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0 || FALLBACK_SEED
}

export const createSeededRandomState = (seed: string | number): SeededRandomState => {
  return {
    value: hashSeed(seed),
  }
}

export const takeSeededRandom = (state: SeededRandomState): { value: number; state: SeededRandomState } => {
  const nextValue = (state.value + 0x6d2b79f5) >>> 0
  let mixed = nextValue

  mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1)
  mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)

  return {
    value: ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296,
    state: {
      value: nextValue || FALLBACK_SEED,
    },
  }
}

export const createSeededRandom = (seed: string | number): (() => number) => {
  let state = createSeededRandomState(seed)

  return () => {
    const next = takeSeededRandom(state)
    state = next.state
    return next.value
  }
}

export const generateGameSeed = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const values = crypto.getRandomValues(new Uint32Array(2))
    return `${values[0].toString(36)}-${values[1].toString(36)}`
  }

  const timePart = Date.now().toString(36)
  const perfPart =
    typeof performance !== 'undefined' ? Math.floor(performance.now() * 1000).toString(36) : 'seedless'

  return `${timePart}-${perfPart}`
}
