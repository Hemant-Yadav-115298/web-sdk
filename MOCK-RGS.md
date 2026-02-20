# Mock RGS Server — Local Development Guide

Run games in dev mode **fully offline** without a real RGS backend.

---

## Quick Start — Lines

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

## Quick Start — Ways

**Terminal 1** — Start the mock server:

```bash
node mock-rgs-server-ways.mjs
```

**Terminal 2** — Start the game:

```bash
pnpm run dev --filter=ways
```

**Browser** — Open:

```
http://localhost:3001/?rgs_url=localhost:3457&sessionID=mock-session&lang=en
```

> **Note:** The two mock servers use different ports (3456 for lines, 3457 for ways) so they can run simultaneously.

---

## What It Does

The mock server (`mock-rgs-server.mjs` / `mock-rgs-server-ways.mjs`) is a zero-dependency Node.js HTTP server that emulates all RGS endpoints. It returns realistic game data so the full game loop works locally.

| Game  | File                        | Port | Mechanics                                      |
| ----- | --------------------------- | ---- | ---------------------------------------------- |
| Lines | `mock-rgs-server.mjs`       | 3456 | 5×5 board, line-based wins, 12 free spins      |
| Ways  | `mock-rgs-server-ways.mjs`  | 3457 | 5×5 board, ways-pays, wild multipliers, 15 FS  |

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

### Sample Books — Lines

The Lines mock server embeds **6 sample books** covering all common game outcomes:

| Book | Payout Multiplier | Type                          |
| ---- | ----------------- | ----------------------------- |
| 1    | 0.0x              | No win                        |
| 2    | 0.2x              | Small win (single line)       |
| 3    | 2.0x              | Medium win (H1 three-of-a-kind) |
| 4    | 0.0x              | No win (different board)      |
| 5    | 0.5x              | Small win (L4 match)          |
| 6    | 3.9x              | Bonus round with 12 free spins |

### Sample Books — Ways

The Ways mock server embeds **6 sample books** with ways-pays mechanics:

| Book | Payout Multiplier | Type                                            |
| ---- | ----------------- | ----------------------------------------------- |
| 1    | 0.0x              | No win                                          |
| 2    | 1.7x              | Small ways win (L4 + L3)                        |
| 3    | 5.0x              | Medium win (H1 4-of-a-kind, 4 ways)             |
| 4    | 0.0x              | No win (different board)                         |
| 5    | 0.4x              | Small win (H5 3-of-a-kind)                       |
| 6    | 32.3x             | Bonus: 15 free spins with wild multipliers (×3, ×5) |

Each play request randomly picks one book so you'll see a mix of wins, losses, and bonus triggers.

### Mock Balance

- **Starting balance:** $10,000
- Balance updates realistically — bets are deducted, wins are credited
- Balance resets when the server restarts or on a new `/wallet/authenticate` call

---

## How It Works

### Changes Made

#### 1. `mock-rgs-server.mjs` (new file — Lines)

Standalone Node.js HTTP server for the **Lines** game with:
- All RGS API endpoints with CORS support
- Embedded sample book data from `apps/lines/src/stories/data/`
- Realistic balance tracking and payout calculation
- Console logging for every request

#### 1b. `mock-rgs-server-ways.mjs` (new file — Ways)

Standalone Node.js HTTP server for the **Ways** game with:
- Ways-pays win mechanics (`ways`, `globalMult`, `winWithoutMult`, `symbolMult`)
- Wild symbols with multipliers (1-5× during free games)
- `betModes` config: `BASE` (1×) and `BONUS` (100× buy bonus)
- 15 free spins with `freeSpinTrigger`, `updateFreeSpin`, `freeSpinEnd` events
- Runs on port 3457 (different from Lines on 3456)

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
"dev:mock": "node ../../mock-rgs-server.mjs & vite dev --host --port 3001",
"dev:mock:win": "start /B node ../../mock-rgs-server.mjs && vite dev --host --port 3001"
```

#### 3b. `apps/ways/package.json` (modified)

Added convenience scripts:

```json
"dev:mock": "node ../../mock-rgs-server-ways.mjs & vite dev --host --port 3001",
"dev:mock:win": "start /B node ../../mock-rgs-server-ways.mjs && vite dev --host --port 3001"
```

- `dev:mock` — for macOS/Linux (uses `&` for background process)
- `dev:mock:win` — for Windows (uses `start /B`)

---

## URL Parameters

The game reads configuration from query string parameters. For mock mode, use:

| Parameter   | Lines Value        | Ways Value         | Description                  |
| ----------- | ------------------ | ------------------ | ---------------------------- |
| `rgs_url`   | `localhost:3456`   | `localhost:3457`   | Points to the mock server    |
| `sessionID` | `mock-session`     | `mock-session`     | Any non-empty string works   |
| `lang`      | `en`               | `en`               | Language code (en, pt, etc.) |

Optional parameters also work: `currency`, `device`, `social`, `demo`.

---

## Switching Back to Real RGS

To connect to a real RGS, simply use the real query string parameters from Stake Engine instead of the mock ones. The `getProtocol()` change is backward-compatible — any non-localhost URL still uses `https://`.

---

## Troubleshooting

| Problem                              | Solution                                                                       |
| ------------------------------------ | ------------------------------------------------------------------------------ |
| Error screen on game load            | Make sure the correct mock server is running for your game                      |
| `fetch failed` / network error       | Check that `rgs_url=localhost:3456` (or `:3457`) is in the browser URL          |
| Port already in use                  | Kill the old process or change `PORT` in the mock server file                   |
| CORS errors in browser console       | The mock server includes CORS headers — restart it if they're missing          |
| Game loads but spins don't work      | Check the mock server terminal for request logs                                |
| Balance goes negative                | Restart the mock server to reset to $10,000                                    |
