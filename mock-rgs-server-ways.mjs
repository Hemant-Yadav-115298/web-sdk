/**
 * Mock RGS Server for the WAYS game — local development without a real RGS backend.
 *
 * Usage:
 *   node mock-rgs-server-ways.mjs
 *
 * Then start the game with:
 *   pnpm run dev --filter=ways
 *
 * Open: http://localhost:3001/?rgs_url=localhost:3457&sessionID=mock-session&lang=en
 *
 * This mock server handles all RGS endpoints and returns realistic game data
 * using "ways" win mechanics (5×5 board, ways-pays, wild multipliers).
 */

import http from 'node:http';

const PORT = 3457; // Different port from lines mock (3456)
const API_AMOUNT_MULTIPLIER = 1_000_000;

// ─── Mock State ──────────────────────────────────────────────────────────────

let mockBalance = 10_000 * API_AMOUNT_MULTIPLIER; // $10,000 starting balance
let currentRound = null;
let roundIdCounter = 1;

// ─── Embedded Sample Books (ways game structure) ─────────────────────────────
// Board: 5 reels × 5 rows
// Symbols: H1-H5 (high), L1-L4 (low), W (wild+multiplier), S (scatter)
// Win meta: { ways, globalMult, winWithoutMult, symbolMult }

const BASE_BOOKS = [
	// Book 1: No win
	{
		id: 1,
		payoutMultiplier: 0.0,
		events: [
			{
				index: 0,
				type: 'reveal',
				board: [
					[{ name: 'H1' }, { name: 'H1' }, { name: 'L4' }, { name: 'L4' }, { name: 'L4' }],
					[{ name: 'H1' }, { name: 'H1' }, { name: 'L4' }, { name: 'L4' }, { name: 'H3' }],
					[{ name: 'L2' }, { name: 'L2' }, { name: 'L3' }, { name: 'L3' }, { name: 'H2' }],
					[{ name: 'L3' }, { name: 'H2' }, { name: 'H2' }, { name: 'H5' }, { name: 'H5' }],
					[{ name: 'L3' }, { name: 'H2' }, { name: 'H2' }, { name: 'L2' }, { name: 'L2' }],
				],
				paddingPositions: [216, 205, 195, 16, 65],
				gameType: 'basegame',
				anticipation: [0, 0, 0, 0, 0],
			},
			{ index: 1, type: 'setTotalWin', amount: 0 },
			{ index: 2, type: 'finalWin', amount: 0 },
		],
		criteria: '0',
		baseGameWins: 0.0,
		freeGameWins: 0.0,
	},
	// Book 2: Small ways win (1.7x)
	{
		id: 2,
		payoutMultiplier: 1.7,
		events: [
			{
				index: 0,
				type: 'reveal',
				board: [
					[{ name: 'L4' }, { name: 'L4' }, { name: 'H3' }, { name: 'H5' }, { name: 'L2' }],
					[{ name: 'L4' }, { name: 'H1' }, { name: 'L3' }, { name: 'L3' }, { name: 'H4' }],
					[{ name: 'L4' }, { name: 'L2' }, { name: 'H2' }, { name: 'L1' }, { name: 'H5' }],
					[{ name: 'H3' }, { name: 'L1' }, { name: 'H4' }, { name: 'H2' }, { name: 'L3' }],
					[{ name: 'H5' }, { name: 'L3' }, { name: 'L1' }, { name: 'H1' }, { name: 'L2' }],
				],
				paddingPositions: [54, 155, 9, 148, 174],
				gameType: 'basegame',
				anticipation: [0, 0, 0, 0, 0],
			},
			{
				index: 1,
				type: 'winInfo',
				totalWin: 170,
				wins: [
					{
						symbol: 'L4',
						kind: 3,
						win: 10,
						positions: [
							{ reel: 0, row: 0 },
							{ reel: 0, row: 1 },
							{ reel: 1, row: 0 },
							{ reel: 2, row: 0 },
						],
						meta: {
							ways: 2,
							globalMult: 1,
							winWithoutMult: 10,
							symbolMult: 0,
						},
					},
					{
						symbol: 'L3',
						kind: 3,
						win: 160,
						positions: [
							{ reel: 1, row: 2 },
							{ reel: 1, row: 3 },
							{ reel: 2, row: 0 },
							{ reel: 3, row: 0 },
							{ reel: 3, row: 4 },
							{ reel: 4, row: 1 },
						],
						meta: {
							ways: 8,
							globalMult: 1,
							winWithoutMult: 160,
							symbolMult: 0,
						},
					},
				],
			},
			{ index: 2, type: 'setWin', amount: 170, winLevel: 3 },
			{ index: 3, type: 'setTotalWin', amount: 170 },
			{ index: 4, type: 'finalWin', amount: 170 },
		],
		criteria: 'basegame',
		baseGameWins: 1.7,
		freeGameWins: 0.0,
	},
	// Book 3: Medium win with H1 (5.0x)
	{
		id: 3,
		payoutMultiplier: 5.0,
		events: [
			{
				index: 0,
				type: 'reveal',
				board: [
					[{ name: 'H1' }, { name: 'H1' }, { name: 'L2' }, { name: 'L4' }, { name: 'H5' }],
					[{ name: 'H1' }, { name: 'L3' }, { name: 'H4' }, { name: 'L1' }, { name: 'H3' }],
					[{ name: 'H1' }, { name: 'H5' }, { name: 'L3' }, { name: 'H2' }, { name: 'L4' }],
					[{ name: 'L2' }, { name: 'H3' }, { name: 'H1' }, { name: 'L1' }, { name: 'H4' }],
					[{ name: 'L1' }, { name: 'L4' }, { name: 'H2' }, { name: 'L3' }, { name: 'H5' }],
				],
				paddingPositions: [100, 150, 200, 50, 75],
				gameType: 'basegame',
				anticipation: [0, 0, 0, 0, 0],
			},
			{
				index: 1,
				type: 'winInfo',
				totalWin: 500,
				wins: [
					{
						symbol: 'H1',
						kind: 4,
						win: 500,
						positions: [
							{ reel: 0, row: 0 },
							{ reel: 0, row: 1 },
							{ reel: 1, row: 0 },
							{ reel: 2, row: 0 },
							{ reel: 3, row: 2 },
						],
						meta: {
							ways: 4,
							globalMult: 1,
							winWithoutMult: 500,
							symbolMult: 0,
						},
					},
				],
			},
			{ index: 2, type: 'setWin', amount: 500, winLevel: 4 },
			{ index: 3, type: 'setTotalWin', amount: 500 },
			{ index: 4, type: 'finalWin', amount: 500 },
		],
		criteria: 'basegame',
		baseGameWins: 5.0,
		freeGameWins: 0.0,
	},
	// Book 4: No win (different board)
	{
		id: 4,
		payoutMultiplier: 0.0,
		events: [
			{
				index: 0,
				type: 'reveal',
				board: [
					[{ name: 'L1' }, { name: 'H2' }, { name: 'L3' }, { name: 'H4' }, { name: 'L2' }],
					[{ name: 'H3' }, { name: 'L4' }, { name: 'H1' }, { name: 'L2' }, { name: 'H5' }],
					[{ name: 'L4' }, { name: 'L1' }, { name: 'H5' }, { name: 'H3' }, { name: 'L3' }],
					[{ name: 'H2' }, { name: 'H4' }, { name: 'L2' }, { name: 'L1' }, { name: 'H1' }],
					[{ name: 'L3' }, { name: 'L2' }, { name: 'H3' }, { name: 'H4' }, { name: 'L4' }],
				],
				paddingPositions: [30, 80, 120, 160, 200],
				gameType: 'basegame',
				anticipation: [0, 0, 0, 0, 0],
			},
			{ index: 1, type: 'setTotalWin', amount: 0 },
			{ index: 2, type: 'finalWin', amount: 0 },
		],
		criteria: '0',
		baseGameWins: 0.0,
		freeGameWins: 0.0,
	},
	// Book 5: Small win (0.4x) with symbolMult
	{
		id: 5,
		payoutMultiplier: 0.4,
		events: [
			{
				index: 0,
				type: 'reveal',
				board: [
					[{ name: 'H5' }, { name: 'H5' }, { name: 'L1' }, { name: 'L3' }, { name: 'H2' }],
					[{ name: 'H5' }, { name: 'L2' }, { name: 'L4' }, { name: 'H3' }, { name: 'L1' }],
					[{ name: 'H5' }, { name: 'H4' }, { name: 'L3' }, { name: 'L2' }, { name: 'H1' }],
					[{ name: 'L4' }, { name: 'L1' }, { name: 'H2' }, { name: 'H5' }, { name: 'L3' }],
					[{ name: 'L2' }, { name: 'H1' }, { name: 'H3' }, { name: 'L4' }, { name: 'H4' }],
				],
				paddingPositions: [45, 90, 135, 22, 180],
				gameType: 'basegame',
				anticipation: [0, 0, 0, 0, 0],
			},
			{
				index: 1,
				type: 'winInfo',
				totalWin: 40,
				wins: [
					{
						symbol: 'H5',
						kind: 3,
						win: 40,
						positions: [
							{ reel: 0, row: 0 },
							{ reel: 0, row: 1 },
							{ reel: 1, row: 0 },
							{ reel: 2, row: 0 },
						],
						meta: {
							ways: 2,
							globalMult: 1,
							winWithoutMult: 40,
							symbolMult: 0,
						},
					},
				],
			},
			{ index: 2, type: 'setWin', amount: 40, winLevel: 2 },
			{ index: 3, type: 'setTotalWin', amount: 40 },
			{ index: 4, type: 'finalWin', amount: 40 },
		],
		criteria: 'basegame',
		baseGameWins: 0.4,
		freeGameWins: 0.0,
	},
	// Book 6: Free spin trigger with wins (32.3x) — full bonus round
	{
		id: 6,
		payoutMultiplier: 32.3,
		events: [
			{
				index: 0,
				type: 'reveal',
				board: [
					[
						{ name: 'H3' },
						{ name: 'L1' },
						{ name: 'L1' },
						{ name: 'S', scatter: true },
						{ name: 'L4' },
					],
					[
						{ name: 'L3' },
						{ name: 'S', scatter: true },
						{ name: 'L2' },
						{ name: 'L2' },
						{ name: 'H2' },
					],
					[
						{ name: 'L1' },
						{ name: 'L4' },
						{ name: 'L4' },
						{ name: 'S', scatter: true },
						{ name: 'L1' },
					],
					[{ name: 'L3' }, { name: 'L3' }, { name: 'H2' }, { name: 'H2' }, { name: 'L4' }],
					[
						{ name: 'L2' },
						{ name: 'L1' },
						{ name: 'L1' },
						{ name: 'S', scatter: true },
						{ name: 'L4' },
					],
				],
				paddingPositions: [14, 73, 88, 40, 140],
				gameType: 'basegame',
				anticipation: [0, 0, 1, 2, 3],
			},
			{ index: 1, type: 'setTotalWin', amount: 0 },
			{
				index: 2,
				type: 'freeSpinTrigger',
				totalFs: 15,
				positions: [
					{ reel: 0, row: 3 },
					{ reel: 1, row: 1 },
					{ reel: 2, row: 3 },
					{ reel: 4, row: 3 },
				],
			},
			{ index: 3, type: 'updateFreeSpin', amount: 0, total: 15 },
			// Free spin 1
			{
				index: 4,
				type: 'reveal',
				board: [
					[{ name: 'L2' }, { name: 'H4' }, { name: 'H4' }, { name: 'L4' }, { name: 'L4' }],
					[
						{ name: 'W', wild: true, multiplier: 4 },
						{ name: 'L2' },
						{ name: 'L2' },
						{ name: 'L2' },
						{ name: 'H4' },
					],
					[{ name: 'H5' }, { name: 'H5' }, { name: 'L2' }, { name: 'L2' }, { name: 'L3' }],
					[{ name: 'L3' }, { name: 'L4' }, { name: 'L4' }, { name: 'H1' }, { name: 'H1' }],
					[
						{ name: 'L2' },
						{ name: 'L2' },
						{ name: 'L1' },
						{ name: 'L1' },
						{ name: 'S', scatter: true },
					],
				],
				paddingPositions: [163, 100, 130, 95, 139],
				gameType: 'freegame',
				anticipation: [0, 0, 0, 0, 0],
			},
			{ index: 5, type: 'setTotalWin', amount: 0 },
			{ index: 6, type: 'updateFreeSpin', amount: 1, total: 15 },
			// Free spin 2 — with ways win + wild multiplier
			{
				index: 7,
				type: 'reveal',
				board: [
					[{ name: 'L4' }, { name: 'L4' }, { name: 'L3' }, { name: 'L3' }, { name: 'H3' }],
					[
						{ name: 'H4' },
						{ name: 'H4' },
						{ name: 'L3' },
						{ name: 'W', wild: true, multiplier: 1 },
						{ name: 'W', wild: true, multiplier: 4 },
					],
					[{ name: 'L1' }, { name: 'L3' }, { name: 'L3' }, { name: 'L4' }, { name: 'L4' }],
					[{ name: 'L3' }, { name: 'H2' }, { name: 'H2' }, { name: 'L2' }, { name: 'L2' }],
					[{ name: 'L1' }, { name: 'L4' }, { name: 'L4' }, { name: 'H5' }, { name: 'H5' }],
				],
				paddingPositions: [9, 7, 93, 119, 81],
				gameType: 'freegame',
				anticipation: [0, 0, 0, 0, 0],
			},
			{
				index: 8,
				type: 'winInfo',
				totalWin: 170,
				wins: [
					{
						symbol: 'L4',
						kind: 3,
						win: 10,
						positions: [
							{ reel: 0, row: 0 },
							{ reel: 0, row: 1 },
							{ reel: 1, row: 3 },
							{ reel: 2, row: 3 },
							{ reel: 2, row: 4 },
						],
						meta: {
							ways: 4,
							globalMult: 1,
							winWithoutMult: 10,
							symbolMult: 0,
						},
					},
					{
						symbol: 'L3',
						kind: 3,
						win: 160,
						positions: [
							{ reel: 0, row: 2 },
							{ reel: 0, row: 3 },
							{ reel: 1, row: 2 },
							{ reel: 2, row: 1 },
							{ reel: 2, row: 2 },
							{ reel: 3, row: 0 },
						],
						meta: {
							ways: 8,
							globalMult: 1,
							winWithoutMult: 160,
							symbolMult: 0,
						},
					},
				],
			},
			{ index: 9, type: 'setWin', amount: 170, winLevel: 3 },
			{ index: 10, type: 'setTotalWin', amount: 170 },
			{ index: 11, type: 'updateFreeSpin', amount: 2, total: 15 },
			// Free spin 3
			{
				index: 12,
				type: 'reveal',
				board: [
					[{ name: 'L4' }, { name: 'L3' }, { name: 'L3' }, { name: 'H1' }, { name: 'H1' }],
					[
						{ name: 'H1' },
						{ name: 'L4' },
						{ name: 'L4' },
						{ name: 'H3' },
						{ name: 'W', wild: true, multiplier: 1 },
					],
					[{ name: 'H1' }, { name: 'H1' }, { name: 'H3' }, { name: 'H3' }, { name: 'L2' }],
					[{ name: 'L4' }, { name: 'L4' }, { name: 'H3' }, { name: 'H3' }, { name: 'L1' }],
					[{ name: 'L3' }, { name: 'L4' }, { name: 'L4' }, { name: 'H4' }, { name: 'H4' }],
				],
				paddingPositions: [42, 143, 45, 60, 59],
				gameType: 'freegame',
				anticipation: [0, 0, 0, 0, 0],
			},
			{ index: 13, type: 'setTotalWin', amount: 170 },
			{ index: 14, type: 'updateFreeSpin', amount: 3, total: 15 },
			// Free spin 4
			{
				index: 15,
				type: 'reveal',
				board: [
					[{ name: 'H3' }, { name: 'H5' }, { name: 'H5' }, { name: 'L2' }, { name: 'L2' }],
					[{ name: 'H5' }, { name: 'H5' }, { name: 'H4' }, { name: 'H4' }, { name: 'L3' }],
					[{ name: 'H5' }, { name: 'H5' }, { name: 'L2' }, { name: 'L2' }, { name: 'L3' }],
					[{ name: 'L2' }, { name: 'L3' }, { name: 'L3' }, { name: 'L3' }, { name: 'L4' }],
					[{ name: 'L2' }, { name: 'H5' }, { name: 'H5' }, { name: 'H5' }, { name: 'H2' }],
				],
				paddingPositions: [34, 130, 130, 92, 131],
				gameType: 'freegame',
				anticipation: [0, 0, 0, 0, 0],
			},
			{
				index: 16,
				type: 'winInfo',
				totalWin: 480,
				wins: [
					{
						symbol: 'H5',
						kind: 4,
						win: 320,
						positions: [
							{ reel: 0, row: 1 },
							{ reel: 0, row: 2 },
							{ reel: 1, row: 0 },
							{ reel: 1, row: 1 },
							{ reel: 2, row: 0 },
							{ reel: 2, row: 1 },
							{ reel: 4, row: 1 },
							{ reel: 4, row: 2 },
							{ reel: 4, row: 3 },
						],
						meta: {
							ways: 32,
							globalMult: 1,
							winWithoutMult: 320,
							symbolMult: 0,
						},
					},
					{
						symbol: 'L2',
						kind: 3,
						win: 160,
						positions: [
							{ reel: 0, row: 3 },
							{ reel: 0, row: 4 },
							{ reel: 2, row: 2 },
							{ reel: 2, row: 3 },
							{ reel: 4, row: 0 },
						],
						meta: {
							ways: 4,
							globalMult: 1,
							winWithoutMult: 160,
							symbolMult: 0,
						},
					},
				],
			},
			{ index: 17, type: 'setWin', amount: 480, winLevel: 4 },
			{ index: 18, type: 'setTotalWin', amount: 650 },
			{ index: 19, type: 'updateFreeSpin', amount: 4, total: 15 },
			// Free spin 5
			{
				index: 20,
				type: 'reveal',
				board: [
					[{ name: 'L3' }, { name: 'H2' }, { name: 'L1' }, { name: 'L4' }, { name: 'H1' }],
					[{ name: 'H4' }, { name: 'L3' }, { name: 'L2' }, { name: 'H3' }, { name: 'L3' }],
					[{ name: 'L1' }, { name: 'L4' }, { name: 'H1' }, { name: 'L2' }, { name: 'L2' }],
					[{ name: 'L4' }, { name: 'H3' }, { name: 'L3' }, { name: 'L2' }, { name: 'H4' }],
					[{ name: 'H2' }, { name: 'L1' }, { name: 'L4' }, { name: 'H5' }, { name: 'L4' }],
				],
				paddingPositions: [110, 50, 190, 90, 140],
				gameType: 'freegame',
				anticipation: [0, 0, 0, 0, 0],
			},
			{ index: 21, type: 'setTotalWin', amount: 650 },
			{ index: 22, type: 'updateFreeSpin', amount: 5, total: 15 },
			// Free spin 6
			{
				index: 23,
				type: 'reveal',
				board: [
					[{ name: 'H4' }, { name: 'L2' }, { name: 'L4' }, { name: 'H1' }, { name: 'L3' }],
					[{ name: 'L1' }, { name: 'H3' }, { name: 'L4' }, { name: 'L2' }, { name: 'H5' }],
					[{ name: 'L4' }, { name: 'L1' }, { name: 'H2' }, { name: 'L3' }, { name: 'L3' }],
					[{ name: 'H1' }, { name: 'L4' }, { name: 'L1' }, { name: 'H3' }, { name: 'L2' }],
					[{ name: 'L2' }, { name: 'H4' }, { name: 'L3' }, { name: 'L4' }, { name: 'H1' }],
				],
				paddingPositions: [15, 75, 155, 35, 115],
				gameType: 'freegame',
				anticipation: [0, 0, 0, 0, 0],
			},
			{ index: 24, type: 'setTotalWin', amount: 650 },
			{ index: 25, type: 'updateFreeSpin', amount: 6, total: 15 },
			// Free spin 7
			{
				index: 26,
				type: 'reveal',
				board: [
					[{ name: 'L4' }, { name: 'H1' }, { name: 'L2' }, { name: 'L3' }, { name: 'H3' }],
					[{ name: 'H2' }, { name: 'L3' }, { name: 'L1' }, { name: 'H4' }, { name: 'L4' }],
					[{ name: 'L3' }, { name: 'L4' }, { name: 'H3' }, { name: 'L1' }, { name: 'L2' }],
					[{ name: 'L1' }, { name: 'H5' }, { name: 'L4' }, { name: 'L2' }, { name: 'H1' }],
					[{ name: 'H3' }, { name: 'L1' }, { name: 'L3' }, { name: 'L3' }, { name: 'L4' }],
				],
				paddingPositions: [65, 105, 25, 145, 185],
				gameType: 'freegame',
				anticipation: [0, 0, 0, 0, 0],
			},
			{ index: 27, type: 'setTotalWin', amount: 650 },
			{ index: 28, type: 'updateFreeSpin', amount: 7, total: 15 },
			// Free spin 8 — with wild multiplier win
			{
				index: 29,
				type: 'reveal',
				board: [
					[{ name: 'H2' }, { name: 'L4' }, { name: 'L1' }, { name: 'H3' }, { name: 'L3' }],
					[
						{ name: 'L3' },
						{ name: 'H1' },
						{ name: 'W', wild: true, multiplier: 3 },
						{ name: 'L2' },
						{ name: 'H4' },
					],
					[{ name: 'L2' }, { name: 'L3' }, { name: 'H4' }, { name: 'L4' }, { name: 'L1' }],
					[{ name: 'H4' }, { name: 'L2' }, { name: 'L2' }, { name: 'H1' }, { name: 'L3' }],
					[{ name: 'L1' }, { name: 'H2' }, { name: 'L4' }, { name: 'L3' }, { name: 'H3' }],
				],
				paddingPositions: [95, 55, 175, 15, 135],
				gameType: 'freegame',
				anticipation: [0, 0, 0, 0, 0],
			},
			{
				index: 30,
				type: 'winInfo',
				totalWin: 540,
				wins: [
					{
						symbol: 'L3',
						kind: 3,
						win: 540,
						positions: [
							{ reel: 0, row: 4 },
							{ reel: 1, row: 0 },
							{ reel: 1, row: 2 },
							{ reel: 2, row: 1 },
						],
						meta: {
							ways: 2,
							globalMult: 1,
							winWithoutMult: 180,
							symbolMult: 3,
						},
					},
				],
			},
			{ index: 31, type: 'setWin', amount: 540, winLevel: 4 },
			{ index: 32, type: 'setTotalWin', amount: 1190 },
			{ index: 33, type: 'updateFreeSpin', amount: 8, total: 15 },
			// Free spin 9
			{
				index: 34,
				type: 'reveal',
				board: [
					[{ name: 'L1' }, { name: 'H3' }, { name: 'L4' }, { name: 'L2' }, { name: 'H5' }],
					[{ name: 'H1' }, { name: 'L4' }, { name: 'L3' }, { name: 'H4' }, { name: 'L1' }],
					[{ name: 'L4' }, { name: 'L2' }, { name: 'H1' }, { name: 'L3' }, { name: 'L3' }],
					[{ name: 'L2' }, { name: 'H4' }, { name: 'L1' }, { name: 'L1' }, { name: 'H3' }],
					[{ name: 'H5' }, { name: 'L3' }, { name: 'L2' }, { name: 'H1' }, { name: 'L4' }],
				],
				paddingPositions: [120, 40, 160, 80, 200],
				gameType: 'freegame',
				anticipation: [0, 0, 0, 0, 0],
			},
			{ index: 35, type: 'setTotalWin', amount: 1190 },
			{ index: 36, type: 'updateFreeSpin', amount: 9, total: 15 },
			// Free spin 10 — big ways win
			{
				index: 37,
				type: 'reveal',
				board: [
					[
						{ name: 'H2' },
						{ name: 'H2' },
						{ name: 'L1' },
						{ name: 'L3' },
						{ name: 'W', wild: true, multiplier: 2 },
					],
					[{ name: 'H2' }, { name: 'H2' }, { name: 'L4' }, { name: 'H3' }, { name: 'L3' }],
					[
						{ name: 'H2' },
						{ name: 'L3' },
						{ name: 'L1' },
						{ name: 'L1' },
						{ name: 'W', wild: true, multiplier: 5 },
					],
					[{ name: 'L4' }, { name: 'L2' }, { name: 'H2' }, { name: 'L1' }, { name: 'H4' }],
					[{ name: 'L1' }, { name: 'H1' }, { name: 'L3' }, { name: 'L4' }, { name: 'L2' }],
				],
				paddingPositions: [35, 115, 75, 155, 195],
				gameType: 'freegame',
				anticipation: [0, 0, 0, 0, 0],
			},
			{
				index: 38,
				type: 'winInfo',
				totalWin: 1040,
				wins: [
					{
						symbol: 'H2',
						kind: 4,
						win: 1040,
						positions: [
							{ reel: 0, row: 0 },
							{ reel: 0, row: 1 },
							{ reel: 0, row: 4 },
							{ reel: 1, row: 0 },
							{ reel: 1, row: 1 },
							{ reel: 2, row: 0 },
							{ reel: 2, row: 4 },
							{ reel: 3, row: 2 },
						],
						meta: {
							ways: 16,
							globalMult: 1,
							winWithoutMult: 520,
							symbolMult: 10,
						},
					},
				],
			},
			{ index: 39, type: 'setWin', amount: 1040, winLevel: 5 },
			{ index: 40, type: 'setTotalWin', amount: 2230 },
			{ index: 41, type: 'updateFreeSpin', amount: 10, total: 15 },
			// Free spin 11-15 (no wins to keep file reasonable)
			{
				index: 42,
				type: 'reveal',
				board: [
					[{ name: 'L3' }, { name: 'H5' }, { name: 'L2' }, { name: 'H4' }, { name: 'L1' }],
					[{ name: 'H3' }, { name: 'L4' }, { name: 'H1' }, { name: 'L1' }, { name: 'L2' }],
					[{ name: 'L1' }, { name: 'H2' }, { name: 'L4' }, { name: 'L3' }, { name: 'H5' }],
					[{ name: 'H1' }, { name: 'L3' }, { name: 'H5' }, { name: 'L2' }, { name: 'L4' }],
					[{ name: 'L4' }, { name: 'L1' }, { name: 'H3' }, { name: 'H2' }, { name: 'L3' }],
				],
				paddingPositions: [50, 90, 130, 170, 10],
				gameType: 'freegame',
				anticipation: [0, 0, 0, 0, 0],
			},
			{ index: 43, type: 'setTotalWin', amount: 2230 },
			{ index: 44, type: 'updateFreeSpin', amount: 11, total: 15 },
			{
				index: 45,
				type: 'reveal',
				board: [
					[{ name: 'H4' }, { name: 'L2' }, { name: 'H1' }, { name: 'L3' }, { name: 'L4' }],
					[{ name: 'L1' }, { name: 'H5' }, { name: 'L3' }, { name: 'H2' }, { name: 'L2' }],
					[{ name: 'L4' }, { name: 'L3' }, { name: 'H3' }, { name: 'L1' }, { name: 'H4' }],
					[{ name: 'L2' }, { name: 'H1' }, { name: 'L4' }, { name: 'H5' }, { name: 'L3' }],
					[{ name: 'H3' }, { name: 'L4' }, { name: 'L2' }, { name: 'L1' }, { name: 'H2' }],
				],
				paddingPositions: [70, 110, 150, 30, 190],
				gameType: 'freegame',
				anticipation: [0, 0, 0, 0, 0],
			},
			{ index: 46, type: 'setTotalWin', amount: 2230 },
			{ index: 47, type: 'updateFreeSpin', amount: 12, total: 15 },
			{
				index: 48,
				type: 'reveal',
				board: [
					[{ name: 'L1' }, { name: 'H3' }, { name: 'L4' }, { name: 'H2' }, { name: 'L3' }],
					[{ name: 'H5' }, { name: 'L2' }, { name: 'H1' }, { name: 'L3' }, { name: 'L4' }],
					[{ name: 'H2' }, { name: 'L1' }, { name: 'L3' }, { name: 'H4' }, { name: 'L2' }],
					[{ name: 'L3' }, { name: 'H4' }, { name: 'L2' }, { name: 'L1' }, { name: 'H5' }],
					[{ name: 'L4' }, { name: 'H1' }, { name: 'L1' }, { name: 'L2' }, { name: 'H3' }],
				],
				paddingPositions: [85, 25, 165, 45, 125],
				gameType: 'freegame',
				anticipation: [0, 0, 0, 0, 0],
			},
			{ index: 49, type: 'setTotalWin', amount: 2230 },
			{ index: 50, type: 'updateFreeSpin', amount: 13, total: 15 },
			{
				index: 51,
				type: 'reveal',
				board: [
					[{ name: 'H1' }, { name: 'L2' }, { name: 'L4' }, { name: 'H3' }, { name: 'L1' }],
					[{ name: 'L3' }, { name: 'H4' }, { name: 'L1' }, { name: 'L2' }, { name: 'H5' }],
					[{ name: 'L2' }, { name: 'L4' }, { name: 'H2' }, { name: 'L3' }, { name: 'L1' }],
					[{ name: 'H3' }, { name: 'L1' }, { name: 'L3' }, { name: 'H4' }, { name: 'L4' }],
					[{ name: 'L1' }, { name: 'H2' }, { name: 'L4' }, { name: 'L3' }, { name: 'H1' }],
				],
				paddingPositions: [40, 130, 80, 170, 10],
				gameType: 'freegame',
				anticipation: [0, 0, 0, 0, 0],
			},
			{ index: 52, type: 'setTotalWin', amount: 2230 },
			{ index: 53, type: 'updateFreeSpin', amount: 14, total: 15 },
			{
				index: 54,
				type: 'reveal',
				board: [
					[{ name: 'L4' }, { name: 'H5' }, { name: 'L3' }, { name: 'H1' }, { name: 'L2' }],
					[{ name: 'H2' }, { name: 'L1' }, { name: 'H4' }, { name: 'L3' }, { name: 'L4' }],
					[{ name: 'L3' }, { name: 'H3' }, { name: 'L2' }, { name: 'L1' }, { name: 'H5' }],
					[{ name: 'L2' }, { name: 'L4' }, { name: 'H1' }, { name: 'H3' }, { name: 'L1' }],
					[{ name: 'H4' }, { name: 'L3' }, { name: 'L1' }, { name: 'L4' }, { name: 'H2' }],
				],
				paddingPositions: [55, 95, 135, 175, 15],
				gameType: 'freegame',
				anticipation: [0, 0, 0, 0, 0],
			},
			{
				index: 55,
				type: 'winInfo',
				totalWin: 1000,
				wins: [
					{
						symbol: 'L3',
						kind: 4,
						win: 500,
						positions: [
							{ reel: 0, row: 2 },
							{ reel: 1, row: 3 },
							{ reel: 2, row: 0 },
							{ reel: 3, row: 3 },
							{ reel: 4, row: 1 },
						],
						meta: {
							ways: 1,
							globalMult: 1,
							winWithoutMult: 500,
							symbolMult: 0,
						},
					},
					{
						symbol: 'L1',
						kind: 3,
						win: 500,
						positions: [
							{ reel: 1, row: 1 },
							{ reel: 2, row: 3 },
							{ reel: 3, row: 4 },
							{ reel: 4, row: 2 },
						],
						meta: {
							ways: 1,
							globalMult: 1,
							winWithoutMult: 500,
							symbolMult: 0,
						},
					},
				],
			},
			{ index: 56, type: 'setWin', amount: 1000, winLevel: 5 },
			{ index: 57, type: 'setTotalWin', amount: 3230 },
			{ index: 58, type: 'updateFreeSpin', amount: 15, total: 15 },
			{ index: 59, type: 'freeSpinEnd', amount: 3230, winLevel: 5 },
			{ index: 60, type: 'setTotalWin', amount: 3230 },
			{ index: 61, type: 'finalWin', amount: 3230 },
		],
		criteria: 'freegame',
		baseGameWins: 0.0,
		freeGameWins: 32.3,
	},
];

// ─── Bet Level Configuration ─────────────────────────────────────────────────

const BET_LEVELS = [
	100000, 200000, 300000, 500000, 700000, 1000000, 1500000, 2000000, 3000000,
	5000000, 7000000, 10000000, 15000000, 20000000, 30000000, 50000000,
	70000000, 100000000, 150000000, 200000000, 300000000, 500000000,
	700000000, 1000000000,
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pickRandomBook() {
	return BASE_BOOKS[Math.floor(Math.random() * BASE_BOOKS.length)];
}

function sendJson(res, statusCode, data) {
	res.writeHead(statusCode, {
		'Content-Type': 'application/json',
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type',
	});
	res.end(JSON.stringify(data));
}

function readBody(req) {
	return new Promise((resolve) => {
		let body = '';
		req.on('data', (chunk) => (body += chunk));
		req.on('end', () => {
			try {
				resolve(JSON.parse(body));
			} catch {
				resolve({});
			}
		});
	});
}

// ─── Route Handlers ──────────────────────────────────────────────────────────

async function handleAuthenticate(req, res) {
	const body = await readBody(req);
	console.log('[mock-rgs-ways] POST /wallet/authenticate', body);

	// Reset state on authenticate
	currentRound = null;

	sendJson(res, 200, {
		status: { statusCode: 'SUCCESS' },
		balance: {
			amount: mockBalance,
			currency: 'USD',
		},
		config: {
			gameID: 'mock-ways',
			minBet: BET_LEVELS[0],
			maxBet: BET_LEVELS[BET_LEVELS.length - 1],
			stepBet: 100000,
			defaultBetLevel: 1000000,
			betLevels: BET_LEVELS,
			betModes: {
				BASE: { cost: 1 },
				BONUS: { cost: 100 },
			},
			jurisdiction: {
				socialCasino: false,
				disabledFullscreen: false,
				disabledTurbo: false,
				disabledSuperTurbo: false,
				disabledAutoplay: false,
				disabledSlamstop: false,
				disabledSpacebar: false,
				disabledBuyFeature: false,
				displayNetPosition: false,
				displayRTP: false,
				displaySessionTimer: false,
				minimumRoundDuration: 0,
			},
		},
		round: null,
	});
}

async function handlePlay(req, res) {
	const body = await readBody(req);
	console.log('[mock-rgs-ways] POST /wallet/play', body);

	const betAmount = body.amount || 1000000; // default $1
	const book = pickRandomBook();

	// Deduct bet
	mockBalance -= betAmount;

	// Calculate payout: betAmount * payoutMultiplier
	const payout = Math.round(betAmount * book.payoutMultiplier);
	const isBonusGame = book.events.some((e) => e.type === 'freeSpinTrigger');

	// For single-round wins (non-bonus), add payout to balance immediately
	// For bonus wins, payout is added on end-round
	if (!isBonusGame && payout > 0) {
		mockBalance += payout;
	}

	const roundId = roundIdCounter++;
	currentRound = {
		roundID: roundId,
		amount: betAmount,
		payout: payout,
		payoutMultiplier: book.payoutMultiplier,
		active: isBonusGame && payout > 0,
		state: book.events,
		mode: body.mode || 'BASE',
		event: null,
	};

	sendJson(res, 200, {
		status: { statusCode: 'SUCCESS' },
		balance: {
			amount: mockBalance,
			currency: body.currency || 'USD',
		},
		round: currentRound,
	});
}

async function handleEndRound(req, res) {
	const body = await readBody(req);
	console.log('[mock-rgs-ways] POST /wallet/end-round', body);

	// If there's an active bonus round, add payout now
	if (currentRound && currentRound.active && currentRound.payout > 0) {
		mockBalance += currentRound.payout;
	}

	currentRound = null;

	sendJson(res, 200, {
		status: { statusCode: 'SUCCESS' },
		balance: {
			amount: mockBalance,
			currency: 'USD',
		},
	});
}

async function handleEvent(req, res) {
	const body = await readBody(req);
	console.log('[mock-rgs-ways] POST /bet/event', body);

	sendJson(res, 200, {
		status: { statusCode: 'SUCCESS' },
		event: body.event || '0',
	});
}

async function handleAction(req, res) {
	const body = await readBody(req);
	console.log('[mock-rgs-ways] POST /bet/action', body);

	sendJson(res, 200, {
		status: { statusCode: 'SUCCESS' },
		balance: {
			amount: mockBalance,
			currency: 'USD',
		},
		action: currentRound,
	});
}

async function handleBalance(req, res) {
	const body = await readBody(req);
	console.log('[mock-rgs-ways] POST /wallet/balance', body);

	sendJson(res, 200, {
		status: { statusCode: 'SUCCESS' },
		balance: {
			amount: mockBalance,
			currency: 'USD',
		},
	});
}

async function handleReplay(req, res) {
	console.log('[mock-rgs-ways] GET /bet/replay/...');

	const book = pickRandomBook();

	sendJson(res, 200, {
		roundID: 1,
		amount: 1000000,
		payout: Math.round(1000000 * book.payoutMultiplier),
		payoutMultiplier: book.payoutMultiplier,
		active: true,
		state: book.events,
		mode: 'BASE',
		event: '0',
	});
}

// ─── Server ──────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
	// Handle CORS preflight
	if (req.method === 'OPTIONS') {
		res.writeHead(204, {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
		});
		res.end();
		return;
	}

	const url = new URL(req.url, `http://localhost:${PORT}`);
	const pathname = url.pathname;

	try {
		if (req.method === 'POST') {
			switch (pathname) {
				case '/wallet/authenticate':
					return await handleAuthenticate(req, res);
				case '/wallet/play':
					return await handlePlay(req, res);
				case '/wallet/end-round':
					return await handleEndRound(req, res);
				case '/bet/event':
					return await handleEvent(req, res);
				case '/bet/action':
					return await handleAction(req, res);
				case '/wallet/balance':
					return await handleBalance(req, res);
				case '/session/start':
					return sendJson(res, 200, { status: { statusCode: 'SUCCESS' } });
				case '/game/search':
					return sendJson(res, 200, { balance: { amount: mockBalance, currency: 'USD' } });
				default:
					console.log(`[mock-rgs-ways] Unknown POST ${pathname}`);
					return sendJson(res, 200, { status: { statusCode: 'SUCCESS' } });
			}
		}

		if (req.method === 'GET') {
			if (pathname.startsWith('/bet/replay/')) {
				return await handleReplay(req, res);
			}

			// Health check
			if (pathname === '/' || pathname === '/health') {
				return sendJson(res, 200, {
					status: 'ok',
					message: 'Mock RGS Server (Ways) is running',
					balance: mockBalance / API_AMOUNT_MULTIPLIER,
				});
			}
		}

		console.log(`[mock-rgs-ways] Unhandled ${req.method} ${pathname}`);
		sendJson(res, 200, { status: { statusCode: 'SUCCESS' } });
	} catch (err) {
		console.error('[mock-rgs-ways] Error:', err);
		sendJson(res, 500, { error: 'Internal mock server error' });
	}
});

server.listen(PORT, () => {
	console.log(`\n🎰 Mock RGS Server (Ways) running at http://localhost:${PORT}`);
	console.log(`\n📋 Open your game at:`);
	console.log(`   http://localhost:3001/?rgs_url=localhost:${PORT}&sessionID=mock-session&lang=en\n`);
	console.log(`💰 Starting balance: $${(mockBalance / API_AMOUNT_MULTIPLIER).toLocaleString()}`);
	console.log(`📚 ${BASE_BOOKS.length} sample books loaded:`);
	console.log(`   - 2 no-win books`);
	console.log(`   - 2 base game wins (0.4x, 1.7x ways wins)`);
	console.log(`   - 1 medium base win (5.0x H1 4-of-a-kind)`);
	console.log(`   - 1 bonus round (32.3x with 15 free spins, wild multipliers)\n`);
});
