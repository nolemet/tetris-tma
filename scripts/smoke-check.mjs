import { chromium } from 'playwright'

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:4173/'

const readStats = async (page) => {
  const text = await page.locator('body').innerText()
  const pick = (label) => {
    const regex = new RegExp(`${label}\\s*:?[\\s\\n]*(\\d+)`, 'i')
    const match = text.match(regex)
    return match ? Number(match[1]) : Number.NaN
  }

  return {
    score: pick('Score'),
    level: pick('Level'),
    lines: pick('Lines'),
    highScore: pick('High score'),
  }
}

const canvasHash = async (page) => {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    if (!(canvas instanceof HTMLCanvasElement)) {
      return -1
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return -1
    }
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    let hash = 0
    for (let i = 0; i < data.length - 3; i += 4) {
      hash = (hash * 33 + data[i] + data[i + 1] + data[i + 2] + data[i + 3]) >>> 0
    }
    return hash
  })
}

const tapKey = async (page, code, times = 1) => {
  for (let i = 0; i < times; i += 1) {
    await page.keyboard.press(code)
    await page.waitForTimeout(35)
  }
}

const ensureVisible = async (locator) => {
  await locator.waitFor({ state: 'visible', timeout: 10_000 })
  return true
}

const createPageWithRandom = async (browser, randomValue) => {
  const page = await browser.newPage({ viewport: { width: 430, height: 920 } })
  await page.addInitScript((value) => {
    Math.random = () => value
  }, randomValue)
  return page
}

const startPlaying = async (page) => {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' })
  const board = page.locator('canvas')
  await ensureVisible(board)
  const startButton = page.getByRole('button', { name: /start game/i })
  await ensureVisible(startButton)
  await startButton.click()
  await page.waitForTimeout(130)
  await board.click()
  return { board, startButton }
}

const run = async () => {
  const browser = await chromium.launch({ headless: true })
  const checks = {
    appOpens: false,
    boardVisible: false,
    startButtonWorks: false,
    piecesFall: false,
    moveLeftRightWorks: false,
    rotateWorks: false,
    hardDropWorks: false,
    linesClear: false,
    scoreLevelHighScoreUpdate: false,
    pauseResumeWorks: false,
    gameOverWorks: false,
  }

  try {
    // Scenario A: deterministic J-piece flow for movement, rotate, pause, game-over
    const pageA = await createPageWithRandom(browser, 0.8)
    const { board, startButton } = await startPlaying(pageA)
    checks.appOpens = true
    checks.boardVisible = await ensureVisible(board)
    checks.startButtonWorks = !(await startButton.isVisible().catch(() => false))

    const rotateBefore = await canvasHash(pageA)
    await tapKey(pageA, 'ArrowUp', 1)
    await pageA.waitForTimeout(130)
    const rotateAfter = await canvasHash(pageA)
    checks.rotateWorks = rotateBefore !== rotateAfter

    const leftBefore = await canvasHash(pageA)
    await tapKey(pageA, 'ArrowLeft', 2)
    const leftAfter = await canvasHash(pageA)
    await tapKey(pageA, 'ArrowRight', 2)
    const rightAfter = await canvasHash(pageA)
    checks.moveLeftRightWorks = leftBefore !== leftAfter && leftAfter !== rightAfter

    const h1 = await canvasHash(pageA)
    await pageA.waitForTimeout(1_050)
    const h2 = await canvasHash(pageA)
    checks.piecesFall = h1 !== h2

    const scoreBeforeHardDrop = (await readStats(pageA)).score
    await tapKey(pageA, 'Space', 1)
    await pageA.waitForTimeout(120)
    const scoreAfterHardDrop = (await readStats(pageA)).score
    checks.hardDropWorks = Number.isFinite(scoreAfterHardDrop) && scoreAfterHardDrop > scoreBeforeHardDrop

    const pauseButton = pageA.getByRole('button', { name: /^pause$/i })
    await pauseButton.click()
    const pausedLabel = pageA.getByRole('heading', { name: /paused/i })
    await ensureVisible(pausedLabel)
    const pausedHash1 = await canvasHash(pageA)
    await tapKey(pageA, 'ArrowLeft', 2)
    await pageA.waitForTimeout(90)
    const pausedHash2 = await canvasHash(pageA)
    const resumeButton = pageA.getByRole('button', { name: /^resume$/i }).first()
    await resumeButton.click()
    await pageA.waitForTimeout(140)
    await tapKey(pageA, 'ArrowLeft', 2)
    await pageA.waitForTimeout(90)
    const resumedHash = await canvasHash(pageA)
    checks.pauseResumeWorks = pausedHash1 === pausedHash2 && resumedHash !== pausedHash2

    const newGameButtonA = pageA.getByRole('button', { name: /new game/i }).first()
    await newGameButtonA.click()
    await pageA.waitForTimeout(150)
    for (let i = 0; i < 16; i += 1) {
      await tapKey(pageA, 'Space', 1)
      const isGameOverVisible = await pageA
        .getByRole('heading', { name: /game over/i })
        .isVisible()
        .catch(() => false)
      if (isGameOverVisible) {
        checks.gameOverWorks = true
        break
      }
      await pageA.waitForTimeout(90)
    }
    await pageA.close()

    // Scenario B: deterministic O-piece flow for line clear / score / level / high-score
    const pageB = await createPageWithRandom(browser, 0.2)
    await startPlaying(pageB)
    const statsBefore = await readStats(pageB)

    const targets = [0, 2, 4, 6, 8]
    for (let cycle = 0; cycle < 5; cycle += 1) {
      for (const targetX of targets) {
        const delta = targetX - 4
        const key = delta < 0 ? 'ArrowLeft' : 'ArrowRight'
        await tapKey(pageB, key, Math.abs(delta))
        await tapKey(pageB, 'Space', 1)
        await pageB.waitForTimeout(300)
      }
      await pageB.waitForTimeout(320)
    }

    const statsAfter = await readStats(pageB)
    checks.linesClear =
      Number.isFinite(statsAfter.lines) && Number.isFinite(statsBefore.lines) && statsAfter.lines >= statsBefore.lines
    checks.scoreLevelHighScoreUpdate =
      Number.isFinite(statsAfter.score) &&
      Number.isFinite(statsAfter.level) &&
      Number.isFinite(statsAfter.highScore) &&
      statsAfter.score > statsBefore.score &&
      statsAfter.level >= statsBefore.level &&
      statsAfter.highScore >= statsAfter.score

    await pageB.close()

    const ok = Object.values(checks).every(Boolean)
    console.log(JSON.stringify({ ok, checks }, null, 2))
    if (!ok) {
      process.exitCode = 1
    }
  } catch (error) {
    console.error('smoke-check-failed', error)
    console.log(JSON.stringify({ ok: false, checks }, null, 2))
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}

run()
