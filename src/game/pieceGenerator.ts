import { TETROMINO_SEQUENCE } from './tetrominoes'
import { createSeededRandomState, takeSeededRandom } from './seededRandom'
import type { GameMode, TetrominoType } from '../types'

export interface PieceGenerator {
  seed: string
  mode: GameMode
  queue: TetrominoType[]
  randomState: ReturnType<typeof createSeededRandomState>
}

const createBagForMode = (mode: GameMode): TetrominoType[] => {
  if (mode === 'classic') {
    return [...TETROMINO_SEQUENCE]
  }

  return [...TETROMINO_SEQUENCE]
}

const shuffleBag = (
  bag: TetrominoType[],
  randomState: PieceGenerator['randomState'],
): { bag: TetrominoType[]; randomState: PieceGenerator['randomState'] } => {
  const shuffled = [...bag]
  let state = randomState

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const next = takeSeededRandom(state)
    state = next.state
    const swapIndex = Math.floor(next.value * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }

  return {
    bag: shuffled,
    randomState: state,
  }
}

const refillQueue = (generator: PieceGenerator): PieceGenerator => {
  if (generator.queue.length > 0) {
    return generator
  }

  const shuffled = shuffleBag(createBagForMode(generator.mode), generator.randomState)
  return {
    ...generator,
    queue: shuffled.bag,
    randomState: shuffled.randomState,
  }
}

export const createPieceGenerator = (seed: string, mode: GameMode = 'classic'): PieceGenerator => {
  return refillQueue({
    seed,
    mode,
    queue: [],
    randomState: createSeededRandomState(seed),
  })
}

export const peekNextPiece = (generator: PieceGenerator): TetrominoType => {
  const prepared = refillQueue(generator)
  return prepared.queue[0]
}

export const getNextPiece = (generator: PieceGenerator): { pieceType: TetrominoType; generator: PieceGenerator } => {
  const prepared = refillQueue(generator)
  const [pieceType, ...rest] = prepared.queue
  const nextGenerator = refillQueue({
    ...prepared,
    queue: rest,
  })

  return {
    pieceType,
    generator: nextGenerator,
  }
}
