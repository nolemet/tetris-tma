import { createSeededRandom } from '../game/seededRandom'
import { TETROMINO_SHAPES } from '../game/tetrominoes'
import { cloneShape } from '../utils/piece'
import type { ActivePiece, BoardMatrix, GameAction, TetrominoType } from '../types'
import { evaluatePlacement, compareMoveToBest } from './moveEvaluator'
import { generateLegalPlacements, getUniqueRotations } from './moveGenerator'
import type {
  AnalyzePlayerMoveResult,
  BestMoveResult,
  BotDifficulty,
  BotPlacement,
  BotSearchOptions,
  MoveEvaluation,
} from './types'

const DEFAULT_LOOKAHEAD_WEIGHT = 0.35

const normalizePiece = (piece: ActivePiece | TetrominoType): ActivePiece => {
  if (typeof piece === 'string') {
    return {
      type: piece,
      shape: cloneShape(TETROMINO_SHAPES[piece]),
      x: 0,
      y: 0,
    }
  }

  return {
    ...piece,
    shape: piece.shape.map((row) => [...row]),
  }
}

const resolveDifficulty = (difficulty?: BotDifficulty): BotDifficulty => difficulty ?? 'expert'

const getCandidatePoolSize = (difficulty: BotDifficulty, totalMoves: number): number => {
  if (difficulty === 'expert') {
    return 1
  }
  if (difficulty === 'hard') {
    return Math.min(2, totalMoves)
  }
  if (difficulty === 'medium') {
    return Math.min(5, totalMoves)
  }
  return Math.min(12, totalMoves)
}

const createFallbackRng = (board: BoardMatrix, piece: ActivePiece, difficulty: BotDifficulty): (() => number) => {
  const boardSignature = board.map((row) => row.map((cell) => cell ?? '.').join('')).join('/')
  return createSeededRandom(`${difficulty}:${piece.type}:${boardSignature}`)
}

const sortEvaluations = (evaluations: MoveEvaluation[]): MoveEvaluation[] => {
  return [...evaluations].sort((left, right) => right.score - left.score)
}

const ensureEvaluations = (evaluations: MoveEvaluation[], pieceType: TetrominoType): MoveEvaluation[] => {
  if (evaluations.length === 0) {
    throw new Error(`No legal placements found for piece ${pieceType}`)
  }

  return evaluations
}

const appendLookaheadSummary = (
  evaluation: MoveEvaluation,
  nextPieceType: TetrominoType,
  followUpScore: number,
): MoveEvaluation => {
  return {
    ...evaluation,
    explanation: {
      ...evaluation.explanation,
      summary: `${evaluation.explanation.summary} Lookahead also likes the ${nextPieceType} follow-up (${Math.round(followUpScore)}).`,
    },
  }
}

const getRotationKey = (shape: ActivePiece['shape']): string => {
  return shape.map((row) => row.join('')).join('|')
}

const inferRotationIndex = (piece: ActivePiece): number => {
  const currentShapeKey = getRotationKey(piece.shape)

  for (let rotation = 0; rotation < 4; rotation += 1) {
    const normalizedShape = normalizePiece(piece.type).shape
    let rotatedShape = normalizedShape

    for (let step = 0; step < rotation; step += 1) {
      rotatedShape = rotatedShape[0].map((_, columnIndex) =>
        rotatedShape.map((row) => row[columnIndex]).reverse(),
      )
    }

    if (getRotationKey(rotatedShape) === currentShapeKey) {
      return rotation
    }
  }

  return 0
}

const selectRotationActions = (piece: ActivePiece, placement: BotPlacement): GameAction[] => {
  const uniqueRotations = getUniqueRotations(piece)
  const currentRotation = inferRotationIndex(piece)
  const currentIndex = Math.max(0, uniqueRotations.indexOf(currentRotation))
  const targetRotation = ((placement.rotation % 4) + 4) % 4
  const targetIndex = Math.max(0, uniqueRotations.indexOf(targetRotation))

  if (uniqueRotations.length <= 1 || currentIndex === targetIndex) {
    return []
  }

  const clockwiseSteps = (targetIndex - currentIndex + uniqueRotations.length) % uniqueRotations.length
  const counterClockwiseSteps = (currentIndex - targetIndex + uniqueRotations.length) % uniqueRotations.length

  if (clockwiseSteps <= counterClockwiseSteps) {
    return Array.from({ length: clockwiseSteps }, () => 'rotateCW' as const)
  }

  return Array.from({ length: counterClockwiseSteps }, () => 'rotateCCW' as const)
}

const buildBotResult = (
  evaluation: MoveEvaluation,
  evaluatedMoves: MoveEvaluation[],
  difficulty: BotDifficulty,
): BestMoveResult => {
  return {
    bestPlacement: evaluation.placement,
    bestScore: evaluation.score,
    evaluatedMoves,
    explanation: evaluation.explanation,
    difficulty,
  }
}

export const findBestMove = (
  board: BoardMatrix,
  piece: ActivePiece,
  options?: BotSearchOptions,
): BestMoveResult => {
  const difficulty = resolveDifficulty(options?.difficulty)
  const placements = generateLegalPlacements(board, piece)
  const evaluatedMoves = ensureEvaluations(
    sortEvaluations(placements.map((placement) => evaluatePlacement(board, piece, placement, options?.weights))),
    piece.type,
  )

  return buildBotResult(evaluatedMoves[0], evaluatedMoves, difficulty)
}

export const findBestMoveWithNextPiece = (
  board: BoardMatrix,
  currentPiece: ActivePiece,
  nextPiece: ActivePiece | TetrominoType,
  options?: BotSearchOptions,
): BestMoveResult => {
  const difficulty = resolveDifficulty(options?.difficulty)
  const lookaheadWeight = options?.lookaheadWeight ?? DEFAULT_LOOKAHEAD_WEIGHT
  const normalizedNextPiece = normalizePiece(nextPiece)
  const currentPlacements = generateLegalPlacements(board, currentPiece)
  const evaluatedMoves = ensureEvaluations(
    sortEvaluations(
      currentPlacements.map((placement) => {
        const currentEvaluation = evaluatePlacement(board, currentPiece, placement, options?.weights)
        const nextPlacements = generateLegalPlacements(currentEvaluation.placement.resultingBoard, normalizedNextPiece)

        if (nextPlacements.length === 0) {
          return currentEvaluation
        }

        const nextBestEvaluation = sortEvaluations(
          nextPlacements.map((nextPlacement) =>
            evaluatePlacement(currentEvaluation.placement.resultingBoard, normalizedNextPiece, nextPlacement, options?.weights),
          ),
        )[0]

        return appendLookaheadSummary(
          {
            ...currentEvaluation,
            score: currentEvaluation.score + nextBestEvaluation.score * lookaheadWeight,
          },
          normalizedNextPiece.type,
          nextBestEvaluation.score,
        )
      }),
    ),
    currentPiece.type,
  )

  return buildBotResult(evaluatedMoves[0], evaluatedMoves, difficulty)
}

export const chooseBotMove = (
  board: BoardMatrix,
  piece: ActivePiece,
  difficulty: BotDifficulty,
  options?: Omit<BotSearchOptions, 'difficulty'>,
): BestMoveResult => {
  const searchOptions = {
    ...options,
    difficulty,
  } satisfies BotSearchOptions
  const baseResult =
    (difficulty === 'hard' || difficulty === 'expert') && options?.nextPiece
      ? findBestMoveWithNextPiece(board, piece, options.nextPiece, searchOptions)
      : findBestMove(board, piece, searchOptions)
  const candidatePoolSize = getCandidatePoolSize(difficulty, baseResult.evaluatedMoves.length)
  const candidatePool = baseResult.evaluatedMoves.slice(0, candidatePoolSize)
  const rng = options?.rng ?? createFallbackRng(board, piece, difficulty)
  const selectedEvaluation = candidatePool[Math.min(candidatePool.length - 1, Math.floor(rng() * candidatePool.length))]

  return buildBotResult(
    {
      ...selectedEvaluation,
      explanation: {
        ...selectedEvaluation.explanation,
        summary:
          difficulty === 'expert'
            ? selectedEvaluation.explanation.summary
            : `${selectedEvaluation.explanation.summary} ${difficulty.toUpperCase()} bot selected from top ${candidatePoolSize} candidate moves.`,
      },
    },
    baseResult.evaluatedMoves,
    difficulty,
  )
}

export const placementToActions = (currentPieceState: ActivePiece, placement: BotPlacement): GameAction[] => {
  const actions: GameAction[] = [...selectRotationActions(currentPieceState, placement)]
  const deltaX = placement.x - currentPieceState.x

  if (deltaX < 0) {
    actions.push(...Array.from({ length: Math.abs(deltaX) }, () => 'moveLeft' as const))
  } else if (deltaX > 0) {
    actions.push(...Array.from({ length: deltaX }, () => 'moveRight' as const))
  }

  // This is a future-facing plan builder. It intentionally returns a minimal target plan
  // and does not try to validate pathing against intermediate collision states yet.
  actions.push('hardDrop')

  return actions
}

export const analyzePlayerMove = (
  boardBefore: BoardMatrix,
  piece: ActivePiece,
  playerPlacement: BotPlacement,
  options?: BotSearchOptions,
): AnalyzePlayerMoveResult => {
  const bestResult = options?.nextPiece
    ? findBestMoveWithNextPiece(boardBefore, piece, options.nextPiece, options)
    : findBestMove(boardBefore, piece, options)
  const bestEvaluation = bestResult.evaluatedMoves[0]
  const playerEvaluation = evaluatePlacement(boardBefore, piece, playerPlacement, options?.weights)
  const comparison = compareMoveToBest(playerEvaluation, bestEvaluation)

  return {
    playerEvaluation,
    bestEvaluation,
    scoreLoss: comparison.scoreLoss,
    severity: comparison.severity,
    explanation: comparison.explanation,
    suggestedPlacement: bestEvaluation.placement,
  }
}
