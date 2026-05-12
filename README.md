# Tetris Telegram Mini App

Production-ready Tetris for Telegram Mini App built with React, Vite and TypeScript.

## Local run

```bash
npm install
npm run dev
```

Default local URL:

`http://127.0.0.1:4173/` (if started with `npm run dev -- --host 127.0.0.1 --port 4173`)

## Production build

```bash
npm run build
```

Build output is generated in `dist/`.

## What to pass to BotFather

- **File in deployment:** `dist/index.html` (served by hosting as site root)
- **Web App URL for BotFather:** root HTTPS URL of deployed app, for example:
  - `https://your-project.vercel.app/`
- In BotFather, set this HTTPS URL as the Mini App URL for your bot.

## Vercel deploy (short)

1. Push repo to GitHub.
2. Open [Vercel](https://vercel.com) and import the repository.
3. Framework preset: **Vite** (auto-detected).
4. Build command: `npm run build`
5. Output directory: `dist`
6. Deploy and get URL like `https://your-project.vercel.app`
7. Paste this URL into BotFather as Web App URL.

`vercel.json` is included for clean URLs and SPA-safe rewrites.

## HTTPS readiness

Project is ready for HTTPS deployment:

- Telegram SDK loaded via `https://telegram.org/js/telegram-web-app.js`
- no hardcoded `http://` API endpoints
- static assets are local and served from the same HTTPS origin
- works inside Telegram WebView with theme and viewport integration

## Telegram WebView checklist

Open Mini App from Telegram and verify:

- [ ] app opens inside WebView without blank screen
- [ ] Telegram theme is applied (light/dark colors)
- [ ] viewport height is correct (no clipped bottom controls)
- [ ] safe area insets are respected on notched devices
- [ ] start game button works
- [ ] touch gestures work: left/right/down swipe and tap rotate
- [ ] hard drop button works
- [ ] pause/resume works
- [ ] score, lines, level update during play
- [ ] high score persists after app restart
- [ ] game over overlay appears correctly
