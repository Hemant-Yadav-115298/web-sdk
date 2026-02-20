# Mock RGS Server — Local Development Guide

Run the game in dev mode **fully offline** without a real RGS backend.

---

## Quick Start

**Terminal 1** — Start the mock server:

```bash
node mock-rgs-server.mjs
```

**Terminal 2** — Start the game:

```bash
pnpm run dev --filter=lines
```

**Browser** — Open:

```
http://localhost:3001/?rgs_url=localhost:3456&sessionID=mock-session&lang=en
```

---

## What It Does

The mock server (`mock-rgs-server.mjs`) is a zero-dependency Node.js HTTP server that emulates all RGS endpoints. It runs on **port 3456** and returns realistic game data so the full game loop works locally.

### Mocked Endpoints

| Endpoint                | Method | Description                              |
| ----------------------- | ------ | ---------------------------------------- |
| `/wallet/authenticate`  | POST   | Returns balance, bet config, jurisdiction |
| `/wallet/play`          | POST   | Deducts bet, returns a random book        |
| `/wallet/end-round`     | POST   | Settles bonus payouts, returns balance    |
| `/bet/event`            | POST   | Acknowledges event index                  |
| `/bet/action`           | POST   | Returns current round state               |
| `/wallet/balance`       | POST   | Returns current balance                   |
| `/session/start`        | POST   | Returns success                           |
| `/game/search`          | POST   | Returns balance                           |
| `/bet/replay/*`         | GET    | Returns a random book for replay mode     |
| `/` or `/health`        | GET    | Health check                              |

### Sample Books Included

The server embeds **6 sample books** covering all common game outcomes:

| Book | Payout Multiplier | Type                          |
| ---- | ----------------- | ----------------------------- |
| 1    | 0.0x              | No win                        |
| 2    | 0.2x              | Small win (single line)       |
| 3    | 2.0x              | Medium win (H1 three-of-a-kind) |
| 4    | 0.0x              | No win (different board)      |
| 5    | 0.5x              | Small win (L4 match)          |
| 6    | 3.9x              | Bonus round with 12 free spins |

Each play request randomly picks one of these books so you'll see a mix of wins, losses, and bonus triggers.

### Mock Balance

- **Starting balance:** $10,000
- Balance updates realistically — bets are deducted, wins are credited
- Balance resets when the server restarts or on a new `/wallet/authenticate` call

---

## How It Works

### Changes Made

#### 1. `mock-rgs-server.mjs` (new file, project root)

Standalone Node.js HTTP server with:
- All RGS API endpoints with CORS support
- Embedded sample book data from `apps/lines/src/stories/data/`
- Realistic balance tracking and payout calculation
- Console logging for every request

#### 2. `packages/rgs-fetcher/src/rgsFetcher.ts` (modified)

Added a `getProtocol()` helper that uses `http://` when the `rgs_url` points to `localhost` or `127.0.0.1`, and `https://` otherwise. This is the only change needed — the rest of the codebase works as-is.

```ts
const getProtocol = (rgsUrl: string) => {
    const isLocal = rgsUrl.startsWith('localhost') || rgsUrl.startsWith('127.0.0.1');
    return isLocal ? 'http' : 'https';
};
```

#### 3. `apps/lines/package.json` (modified)

Added convenience scripts:

```json
"dev:mock": "node ../../mock-rgs-server.mjs & vite dev --host --port 3001 --open \"/?rgs_url=localhost:3456&sessionID=mock-session&lang=en\"",
"dev:mock:win": "start /B node ../../mock-rgs-server.mjs && vite dev --host --port 3001 --open \"/?rgs_url=localhost:3456&sessionID=mock-session&lang=en\""
```

- `dev:mock` — for macOS/Linux (uses `&` for background process)
- `dev:mock:win` — for Windows (uses `start /B`)

---

## URL Parameters

The game reads configuration from query string parameters. For mock mode, use:

| Parameter   | Value              | Description                  |
| ----------- | ------------------ | ---------------------------- |
| `rgs_url`   | `localhost:3456`   | Points to the mock server    |
| `sessionID` | `mock-session`     | Any non-empty string works   |
| `lang`      | `en`               | Language code (en, pt, etc.) |

Optional parameters also work: `currency`, `device`, `social`, `demo`.

---

## Switching Back to Real RGS

To connect to a real RGS, simply use the real query string parameters from Stake Engine instead of the mock ones. The `getProtocol()` change is backward-compatible — any non-localhost URL still uses `https://`.

---

## Troubleshooting

| Problem                              | Solution                                                              |
| ------------------------------------ | --------------------------------------------------------------------- |
| Error screen on game load            | Make sure mock server is running (`node mock-rgs-server.mjs`)         |
| `fetch failed` / network error       | Check that `rgs_url=localhost:3456` is in the browser URL             |
| Port 3456 already in use             | Kill the old process or change `PORT` in `mock-rgs-server.mjs`        |
| CORS errors in browser console       | The mock server includes CORS headers — restart it if they're missing |
| Game loads but spins don't work      | Check the mock server terminal for request logs                       |
| Balance goes negative                | Restart the mock server to reset to $10,000                           |
