/**
 * Mock RGS Server for local development without a real RGS backend.
 *
 * Usage:
 *   node mock-rgs-server.mjs
 *
 * Then start the game with:
 *   pnpm run dev --filter=lines
 *
 * Open: http://localhost:3001/?rgs_url=localhost:3456&sessionID=mock-session&lang=en
 *
 * This mock server handles all RGS endpoints and returns realistic game data
 * from embedded sample books so the game runs fully offline.
 */

import http from 'node:http';

const PORT = 3456;
const API_AMOUNT_MULTIPLIER = 1_000_000;

// ─── Mock State ──────────────────────────────────────────────────────────────

let mockBalance = 10_000 * API_AMOUNT_MULTIPLIER; // $10,000 starting balance
let currentRound = null;
let roundIdCounter = 1;

// ─── Embedded Sample Books (from apps/lines/src/stories/data) ────────────────

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
					[{ name: 'L2' }, { name: 'L1' }, { name: 'L4' }, { name: 'H2' }, { name: 'L1' }],
					[{ name: 'H1' }, { name: 'L5' }, { name: 'L2' }, { name: 'H3' }, { name: 'L4' }],
					[{ name: 'L3' }, { name: 'L5' }, { name: 'L3' }, { name: 'H4' }, { name: 'L4' }],
					[{ name: 'H4' }, { name: 'H3' }, { name: 'L4' }, { name: 'L5' }, { name: 'L1' }],
					[{ name: 'H3' }, { name: 'L3' }, { name: 'L3' }, { name: 'H1' }, { name: 'H1' }],
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
	// Book 2: Small win (0.2x)
	{
		id: 2,
		payoutMultiplier: 0.2,
		events: [
			{
				index: 0,
				type: 'reveal',
				board: [
					[
						{ name: 'L3' },
						{ name: 'W', wild: true, multiplier: 1 },
						{ name: 'H4' },
						{ name: 'L2' },
						{ name: 'L3' },
					],
					[{ name: 'L1' }, { name: 'H1' }, { name: 'H4' }, { name: 'L4' }, { name: 'H4' }],
					[
						{ name: 'L3' },
						{ name: 'S', scatter: true },
						{ name: 'L4' },
						{ name: 'L5' },
						{ name: 'L4' },
					],
					[
						{ name: 'H2' },
						{ name: 'H3' },
						{ name: 'H3' },
						{ name: 'L5' },
						{ name: 'W', wild: true, multiplier: 1 },
					],
					[{ name: 'L5' }, { name: 'L3' }, { name: 'L3' }, { name: 'L3' }, { name: 'H3' }],
				],
				paddingPositions: [54, 155, 9, 148, 174],
				gameType: 'basegame',
				anticipation: [0, 0, 0, 0, 0],
			},
			{
				index: 1,
				type: 'winInfo',
				totalWin: 20,
				wins: [
					{
						symbol: 'L4',
						kind: 3,
						win: 20,
						positions: [
							{ reel: 0, row: 1 },
							{ reel: 1, row: 3 },
							{ reel: 2, row: 2 },
						],
						meta: {
							lineIndex: 16,
							multiplier: 1,
							winWithoutMult: 20,
							globalMult: 1,
							lineMultiplier: 1.0,
						},
					},
				],
			},
			{ index: 2, type: 'setWin', amount: 20, winLevel: 2 },
			{ index: 3, type: 'setTotalWin', amount: 20 },
			{ index: 4, type: 'finalWin', amount: 20 },
		],
		criteria: 'basegame',
		baseGameWins: 0.2,
		freeGameWins: 0.0,
	},
	// Book 3: Medium win (2.0x) with multiple line wins
	{
		id: 3,
		payoutMultiplier: 2.0,
		events: [
			{
				index: 0,
				type: 'reveal',
				board: [
					[{ name: 'H1' }, { name: 'H1' }, { name: 'H1' }, { name: 'L2' }, { name: 'L3' }],
					[{ name: 'L2' }, { name: 'H3' }, { name: 'L4' }, { name: 'L5' }, { name: 'H4' }],
					[{ name: 'L3' }, { name: 'L5' }, { name: 'L3' }, { name: 'H4' }, { name: 'L4' }],
					[{ name: 'H4' }, { name: 'H3' }, { name: 'L4' }, { name: 'L5' }, { name: 'L1' }],
					[{ name: 'H3' }, { name: 'L3' }, { name: 'L3' }, { name: 'H1' }, { name: 'H1' }],
				],
				paddingPositions: [100, 150, 200, 50, 75],
				gameType: 'basegame',
				anticipation: [0, 0, 0, 0, 0],
			},
			{
				index: 1,
				type: 'winInfo',
				totalWin: 200,
				wins: [
					{
						symbol: 'H1',
						kind: 3,
						win: 200,
						positions: [
							{ reel: 0, row: 0 },
							{ reel: 0, row: 1 },
							{ reel: 0, row: 2 },
						],
						meta: {
							lineIndex: 0,
							multiplier: 1,
							winWithoutMult: 200,
							globalMult: 1,
							lineMultiplier: 1.0,
						},
					},
				],
			},
			{ index: 2, type: 'setWin', amount: 200, winLevel: 3 },
			{ index: 3, type: 'setTotalWin', amount: 200 },
			{ index: 4, type: 'finalWin', amount: 200 },
		],
		criteria: 'basegame',
		baseGameWins: 2.0,
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
					[{ name: 'L1' }, { name: 'H2' }, { name: 'L3' }, { name: 'H4' }, { name: 'L5' }],
					[{ name: 'H3' }, { name: 'L4' }, { name: 'H1' }, { name: 'L2' }, { name: 'H2' }],
					[{ name: 'L5' }, { name: 'L1' }, { name: 'L2' }, { name: 'H3' }, { name: 'L3' }],
					[{ name: 'H2' }, { name: 'H4' }, { name: 'L5' }, { name: 'L1' }, { name: 'H1' }],
					[{ name: 'L4' }, { name: 'L2' }, { name: 'H3' }, { name: 'L4' }, { name: 'L2' }],
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
	// Book 5: Small win (0.5x)
	{
		id: 5,
		payoutMultiplier: 0.5,
		events: [
			{
				index: 0,
				type: 'reveal',
				board: [
					[{ name: 'L4' }, { name: 'L4' }, { name: 'L4' }, { name: 'H2' }, { name: 'L1' }],
					[{ name: 'H1' }, { name: 'L5' }, { name: 'L2' }, { name: 'H3' }, { name: 'L4' }],
					[{ name: 'L3' }, { name: 'L5' }, { name: 'L3' }, { name: 'H4' }, { name: 'L4' }],
					[{ name: 'H4' }, { name: 'H3' }, { name: 'L4' }, { name: 'L5' }, { name: 'L1' }],
					[{ name: 'H3' }, { name: 'L3' }, { name: 'L3' }, { name: 'H1' }, { name: 'H1' }],
				],
				paddingPositions: [45, 90, 135, 22, 180],
				gameType: 'basegame',
				anticipation: [0, 0, 0, 0, 0],
			},
			{
				index: 1,
				type: 'winInfo',
				totalWin: 50,
				wins: [
					{
						symbol: 'L4',
						kind: 3,
						win: 50,
						positions: [
							{ reel: 0, row: 0 },
							{ reel: 0, row: 1 },
							{ reel: 0, row: 2 },
						],
						meta: {
							lineIndex: 0,
							multiplier: 1,
							winWithoutMult: 50,
							globalMult: 1,
							lineMultiplier: 1.0,
						},
					},
				],
			},
			{ index: 2, type: 'setWin', amount: 50, winLevel: 2 },
			{ index: 3, type: 'setTotalWin', amount: 50 },
			{ index: 4, type: 'finalWin', amount: 50 },
		],
		criteria: 'basegame',
		baseGameWins: 0.5,
		freeGameWins: 0.0,
	},
	// Book 6: Free spin trigger (bonus)
	{
		id: 6,
		payoutMultiplier: 3.9,
		events: [
			{
				index: 0,
				type: 'reveal',
				board: [
					[
						{ name: 'H2' },
						{ name: 'S', scatter: true },
						{ name: 'L4' },
						{ name: 'L2' },
						{ name: 'H4' },
					],
					[
						{ name: 'L5' },
						{ name: 'L2' },
						{ name: 'H4' },
						{ name: 'S', scatter: true },
						{ name: 'L5' },
					],
					[
						{ name: 'H1' },
						{ name: 'S', scatter: true },
						{ name: 'H2' },
						{ name: 'H2' },
						{ name: 'L1' },
					],
					[
						{ name: 'H2' },
						{ name: 'L1' },
						{ name: 'L2' },
						{ name: 'H4' },
						{ name: 'L5' },
					],
					[
						{ name: 'L5' },
						{ name: 'L4' },
						{ name: 'S', scatter: true },
						{ name: 'L3' },
						{ name: 'L5' },
					],
				],
				paddingPositions: [167, 7, 167, 213, 71],
				gameType: 'basegame',
				anticipation: [0, 0, 1, 2, 3],
			},
			{ index: 1, type: 'setTotalWin', amount: 0 },
			{
				index: 2,
				type: 'freeSpinTrigger',
				totalFs: 12,
				positions: [
					{ reel: 0, row: 1 },
					{ reel: 1, row: 3 },
					{ reel: 2, row: 1 },
					{ reel: 4, row: 2 },
				],
			},
			{ index: 3, type: 'updateFreeSpin', amount: 0, total: 12 },
			{
				index: 4,
				type: 'reveal',
				board: [
					[{ name: 'L2' }, { name: 'L1' }, { name: 'L5' }, { name: 'L3' }, { name: 'L3' }],
					[{ name: 'H3' }, { name: 'H1' }, { name: 'H2' }, { name: 'H3' }, { name: 'H2' }],
					[{ name: 'H3' }, { name: 'L5' }, { name: 'L3' }, { name: 'L2' }, { name: 'L1' }],
					[{ name: 'H1' }, { name: 'H3' }, { name: 'L2' }, { name: 'L5' }, { name: 'L3' }],
					[{ name: 'L1' }, { name: 'L4' }, { name: 'L1' }, { name: 'H4' }, { name: 'L5' }],
				],
				paddingPositions: [20, 60, 100, 140, 180],
				gameType: 'freegame',
				anticipation: [0, 0, 0, 0, 0],
			},
			{
				index: 5,
				type: 'winInfo',
				totalWin: 100,
				wins: [
					{
						symbol: 'H3',
						kind: 3,
						win: 100,
						positions: [
							{ reel: 1, row: 0 },
							{ reel: 2, row: 0 },
							{ reel: 3, row: 1 },
						],
						meta: {
							lineIndex: 4,
							multiplier: 1,
							winWithoutMult: 100,
							globalMult: 1,
							lineMultiplier: 1.0,
						},
					},
				],
			},
			{ index: 6, type: 'setWin', amount: 100, winLevel: 2 },
			{ index: 7, type: 'updateFreeSpin', amount: 1, total: 12 },
			{
				index: 8,
				type: 'reveal',
				board: [
					[{ name: 'L5' }, { name: 'H2' }, { name: 'L4' }, { name: 'H1' }, { name: 'L2' }],
					[{ name: 'H4' }, { name: 'H1' }, { name: 'L5' }, { name: 'L1' }, { name: 'H4' }],
					[{ name: 'L4' }, { name: 'L3' }, { name: 'L2' }, { name: 'L4' }, { name: 'L1' }],
					[{ name: 'L1' }, { name: 'L2' }, { name: 'H3' }, { name: 'L5' }, { name: 'H2' }],
					[{ name: 'H1' }, { name: 'L4' }, { name: 'H2' }, { name: 'H3' }, { name: 'L3' }],
				],
				paddingPositions: [55, 95, 135, 175, 15],
				gameType: 'freegame',
				anticipation: [0, 0, 0, 0, 0],
			},
			{ index: 9, type: 'setTotalWin', amount: 100 },
			{ index: 10, type: 'updateFreeSpin', amount: 2, total: 12 },
			{
				index: 11,
				type: 'reveal',
				board: [
					[{ name: 'H3' }, { name: 'L1' }, { name: 'L2' }, { name: 'H4' }, { name: 'L5' }],
					[{ name: 'L4' }, { name: 'H2' }, { name: 'L3' }, { name: 'L1' }, { name: 'H1' }],
					[{ name: 'L1' }, { name: 'L5' }, { name: 'H1' }, { name: 'L3' }, { name: 'L2' }],
					[{ name: 'H2' }, { name: 'L4' }, { name: 'L5' }, { name: 'H3' }, { name: 'L4' }],
					[{ name: 'L3' }, { name: 'H4' }, { name: 'L1' }, { name: 'L2' }, { name: 'H2' }],
				],
				paddingPositions: [70, 110, 150, 30, 190],
				gameType: 'freegame',
				anticipation: [0, 0, 0, 0, 0],
			},
			{ index: 12, type: 'setTotalWin', amount: 100 },
			{ index: 13, type: 'updateFreeSpin', amount: 3, total: 12 },
			{
				index: 14,
				type: 'reveal',
				board: [
					[{ name: 'L2' }, { name: 'H1' }, { name: 'L4' }, { name: 'L3' }, { name: 'H3' }],
					[{ name: 'H4' }, { name: 'L5' }, { name: 'H2' }, { name: 'L1' }, { name: 'L2' }],
					[
						{ name: 'L3' },
						{ name: 'L2' },
						{ name: 'W', wild: true, multiplier: 2 },
						{ name: 'H4' },
						{ name: 'L5' },
					],
					[{ name: 'L1' }, { name: 'H3' }, { name: 'L5' }, { name: 'L4' }, { name: 'H1' }],
					[{ name: 'H2' }, { name: 'L4' }, { name: 'L1' }, { name: 'L5' }, { name: 'L3' }],
				],
				paddingPositions: [85, 25, 165, 45, 125],
				gameType: 'freegame',
				anticipation: [0, 0, 0, 0, 0],
			},
			{ index: 15, type: 'setTotalWin', amount: 100 },
			{ index: 16, type: 'updateFreeSpin', amount: 4, total: 12 },
			{
				index: 17,
				type: 'reveal',
				board: [
					[{ name: 'H1' }, { name: 'L3' }, { name: 'L5' }, { name: 'H2' }, { name: 'L4' }],
					[{ name: 'L2' }, { name: 'H4' }, { name: 'L1' }, { name: 'L5' }, { name: 'H3' }],
					[{ name: 'L5' }, { name: 'L1' }, { name: 'H3' }, { name: 'L2' }, { name: 'L4' }],
					[{ name: 'H3' }, { name: 'L2' }, { name: 'L4' }, { name: 'H1' }, { name: 'L1' }],
					[{ name: 'L4' }, { name: 'H2' }, { name: 'L3' }, { name: 'L1' }, { name: 'H4' }],
				],
				paddingPositions: [40, 130, 80, 170, 10],
				gameType: 'freegame',
				anticipation: [0, 0, 0, 0, 0],
			},
			{ index: 18, type: 'setTotalWin', amount: 100 },
			{ index: 19, type: 'updateFreeSpin', amount: 5, total: 12 },
			{
				index: 20,
				type: 'reveal',
				board: [
					[{ name: 'L3' }, { name: 'H2' }, { name: 'L1' }, { name: 'L4' }, { name: 'H1' }],
					[{ name: 'H4' }, { name: 'L5' }, { name: 'L2' }, { name: 'H3' }, { name: 'L3' }],
					[{ name: 'L1' }, { name: 'L4' }, { name: 'H1' }, { name: 'L5' }, { name: 'L2' }],
					[{ name: 'L5' }, { name: 'H3' }, { name: 'L3' }, { name: 'L2' }, { name: 'H4' }],
					[{ name: 'H2' }, { name: 'L1' }, { name: 'L5' }, { name: 'H4' }, { name: 'L4' }],
				],
				paddingPositions: [110, 50, 190, 90, 140],
				gameType: 'freegame',
				anticipation: [0, 0, 0, 0, 0],
			},
			{
				index: 21,
				type: 'winInfo',
				totalWin: 150,
				wins: [
					{
						symbol: 'L1',
						kind: 3,
						win: 50,
						positions: [
							{ reel: 0, row: 2 },
							{ reel: 1, row: 0 },
							{ reel: 2, row: 0 },
						],
						meta: {
							lineIndex: 2,
							multiplier: 1,
							winWithoutMult: 50,
							globalMult: 1,
							lineMultiplier: 1.0,
						},
					},
				],
			},
			{ index: 22, type: 'setWin', amount: 50, winLevel: 2 },
			{ index: 23, type: 'setTotalWin', amount: 150 },
			{ index: 24, type: 'updateFreeSpin', amount: 6, total: 12 },
			{
				index: 25,
				type: 'reveal',
				board: [
					[{ name: 'H4' }, { name: 'L2' }, { name: 'L5' }, { name: 'H1' }, { name: 'L3' }],
					[{ name: 'L1' }, { name: 'H3' }, { name: 'L4' }, { name: 'L2' }, { name: 'H2' }],
					[{ name: 'L5' }, { name: 'L1' }, { name: 'H2' }, { name: 'L4' }, { name: 'L3' }],
					[{ name: 'H1' }, { name: 'L4' }, { name: 'L1' }, { name: 'H3' }, { name: 'L5' }],
					[{ name: 'L2' }, { name: 'H4' }, { name: 'L3' }, { name: 'L5' }, { name: 'H1' }],
				],
				paddingPositions: [15, 75, 155, 35, 115],
				gameType: 'freegame',
				anticipation: [0, 0, 0, 0, 0],
			},
			{ index: 26, type: 'setTotalWin', amount: 150 },
			{ index: 27, type: 'updateFreeSpin', amount: 7, total: 12 },
			{
				index: 28,
				type: 'reveal',
				board: [
					[{ name: 'L4' }, { name: 'H1' }, { name: 'L2' }, { name: 'L5' }, { name: 'H3' }],
					[{ name: 'H2' }, { name: 'L3' }, { name: 'L1' }, { name: 'H4' }, { name: 'L4' }],
					[{ name: 'L3' }, { name: 'L5' }, { name: 'H3' }, { name: 'L1' }, { name: 'L2' }],
					[{ name: 'L5' }, { name: 'H4' }, { name: 'L4' }, { name: 'L2' }, { name: 'H1' }],
					[{ name: 'H3' }, { name: 'L1' }, { name: 'L5' }, { name: 'L3' }, { name: 'L4' }],
				],
				paddingPositions: [65, 105, 25, 145, 185],
				gameType: 'freegame',
				anticipation: [0, 0, 0, 0, 0],
			},
			{ index: 29, type: 'setTotalWin', amount: 150 },
			{ index: 30, type: 'updateFreeSpin', amount: 8, total: 12 },
			{
				index: 31,
				type: 'reveal',
				board: [
					[{ name: 'H2' }, { name: 'L4' }, { name: 'L1' }, { name: 'H3' }, { name: 'L5' }],
					[{ name: 'L3' }, { name: 'H1' }, { name: 'L5' }, { name: 'L2' }, { name: 'H4' }],
					[{ name: 'L2' }, { name: 'L3' }, { name: 'H4' }, { name: 'L4' }, { name: 'L1' }],
					[{ name: 'H4' }, { name: 'L5' }, { name: 'L2' }, { name: 'H1' }, { name: 'L3' }],
					[{ name: 'L1' }, { name: 'H2' }, { name: 'L4' }, { name: 'L5' }, { name: 'H3' }],
				],
				paddingPositions: [95, 55, 175, 15, 135],
				gameType: 'freegame',
				anticipation: [0, 0, 0, 0, 0],
			},
			{
				index: 32,
				type: 'winInfo',
				totalWin: 140,
				wins: [
					{
						symbol: 'L5',
						kind: 3,
						win: 40,
						positions: [
							{ reel: 0, row: 4 },
							{ reel: 1, row: 2 },
							{ reel: 2, row: 0 },
						],
						meta: {
							lineIndex: 8,
							multiplier: 1,
							winWithoutMult: 40,
							globalMult: 1,
							lineMultiplier: 1.0,
						},
					},
				],
			},
			{ index: 33, type: 'setWin', amount: 40, winLevel: 2 },
			{ index: 34, type: 'setTotalWin', amount: 190 },
			{ index: 35, type: 'updateFreeSpin', amount: 9, total: 12 },
			{
				index: 36,
				type: 'reveal',
				board: [
					[{ name: 'L1' }, { name: 'H3' }, { name: 'L4' }, { name: 'L2' }, { name: 'H2' }],
					[{ name: 'H1' }, { name: 'L5' }, { name: 'L3' }, { name: 'H4' }, { name: 'L1' }],
					[{ name: 'L4' }, { name: 'L2' }, { name: 'H1' }, { name: 'L5' }, { name: 'L3' }],
					[{ name: 'L2' }, { name: 'H4' }, { name: 'L5' }, { name: 'L1' }, { name: 'H3' }],
					[{ name: 'H2' }, { name: 'L3' }, { name: 'L2' }, { name: 'H1' }, { name: 'L4' }],
				],
				paddingPositions: [120, 40, 160, 80, 200],
				gameType: 'freegame',
				anticipation: [0, 0, 0, 0, 0],
			},
			{ index: 37, type: 'setTotalWin', amount: 190 },
			{ index: 38, type: 'updateFreeSpin', amount: 10, total: 12 },
			{
				index: 39,
				type: 'reveal',
				board: [
					[{ name: 'L5' }, { name: 'H4' }, { name: 'L1' }, { name: 'L3' }, { name: 'H2' }],
					[{ name: 'L2' }, { name: 'H1' }, { name: 'L4' }, { name: 'H3' }, { name: 'L5' }],
					[{ name: 'H3' }, { name: 'L3' }, { name: 'L5' }, { name: 'L1' }, { name: 'L2' }],
					[{ name: 'L4' }, { name: 'L2' }, { name: 'H2' }, { name: 'L5' }, { name: 'H4' }],
					[{ name: 'L1' }, { name: 'H1' }, { name: 'L3' }, { name: 'L4' }, { name: 'L2' }],
				],
				paddingPositions: [35, 115, 75, 155, 195],
				gameType: 'freegame',
				anticipation: [0, 0, 0, 0, 0],
			},
			{
				index: 40,
				type: 'winInfo',
				totalWin: 200,
				wins: [
					{
						symbol: 'H3',
						kind: 3,
						win: 100,
						positions: [
							{ reel: 1, row: 3 },
							{ reel: 2, row: 0 },
							{ reel: 3, row: 3 },
						],
						meta: {
							lineIndex: 10,
							multiplier: 1,
							winWithoutMult: 100,
							globalMult: 1,
							lineMultiplier: 1.0,
						},
					},
				],
			},
			{ index: 41, type: 'setWin', amount: 100, winLevel: 2 },
			{ index: 42, type: 'setTotalWin', amount: 290 },
			{ index: 43, type: 'updateFreeSpin', amount: 11, total: 12 },
			{
				index: 44,
				type: 'reveal',
				board: [
					[{ name: 'H1' }, { name: 'L2' }, { name: 'L4' }, { name: 'H3' }, { name: 'L5' }],
					[{ name: 'L3' }, { name: 'H4' }, { name: 'L1' }, { name: 'L2' }, { name: 'H2' }],
					[{ name: 'L5' }, { name: 'L4' }, { name: 'H2' }, { name: 'L3' }, { name: 'L1' }],
					[{ name: 'H3' }, { name: 'L5' }, { name: 'L3' }, { name: 'H4' }, { name: 'L4' }],
					[{ name: 'L2' }, { name: 'H1' }, { name: 'L5' }, { name: 'L1' }, { name: 'H3' }],
				],
				paddingPositions: [50, 90, 130, 170, 10],
				gameType: 'freegame',
				anticipation: [0, 0, 0, 0, 0],
			},
			{ index: 45, type: 'setTotalWin', amount: 290 },
			{ index: 46, type: 'updateFreeSpin', amount: 12, total: 12 },
			{ index: 47, type: 'freeSpinEnd', amount: 390, winLevel: 3 },
			{ index: 48, type: 'setTotalWin', amount: 390 },
			{ index: 49, type: 'finalWin', amount: 390 },
		],
		criteria: 'freegame',
		baseGameWins: 0.0,
		freeGameWins: 3.9,
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

// ─── BOOK_AMOUNT_MULTIPLIER = 100; amounts in books are in centi-units ──────
// When bet = $1.00 (API_AMOUNT_MULTIPLIER = 1000000), and book says amount=20
// Then payout = betAmount * book.payoutMultiplier
// book amount values are relative to a 1-unit bet (100 centi-units)
const BOOK_AMOUNT_MULTIPLIER = 100;

// ─── Route Handlers ──────────────────────────────────────────────────────────

async function handleAuthenticate(req, res) {
	const body = await readBody(req);
	console.log('[mock-rgs] POST /wallet/authenticate', body);

	// Reset state on authenticate
	currentRound = null;

	sendJson(res, 200, {
		status: { statusCode: 'SUCCESS' },
		balance: {
			amount: mockBalance,
			currency: 'USD',
		},
		config: {
			gameID: 'mock-lines',
			minBet: BET_LEVELS[0],
			maxBet: BET_LEVELS[BET_LEVELS.length - 1],
			stepBet: 100000,
			defaultBetLevel: 1000000,
			betLevels: BET_LEVELS,
			betModes: {},
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
	console.log('[mock-rgs] POST /wallet/play', body);

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
	console.log('[mock-rgs] POST /wallet/end-round', body);

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
	console.log('[mock-rgs] POST /bet/event', body);

	sendJson(res, 200, {
		status: { statusCode: 'SUCCESS' },
		event: body.event || '0',
	});
}

async function handleAction(req, res) {
	const body = await readBody(req);
	console.log('[mock-rgs] POST /bet/action', body);

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
	console.log('[mock-rgs] POST /wallet/balance', body);

	sendJson(res, 200, {
		status: { statusCode: 'SUCCESS' },
		balance: {
			amount: mockBalance,
			currency: 'USD',
		},
	});
}

async function handleReplay(req, res) {
	console.log('[mock-rgs] GET /bet/replay/...');

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
					console.log(`[mock-rgs] Unknown POST ${pathname}`);
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
					message: 'Mock RGS Server is running',
					balance: mockBalance / API_AMOUNT_MULTIPLIER,
				});
			}
		}

		console.log(`[mock-rgs] Unhandled ${req.method} ${pathname}`);
		sendJson(res, 200, { status: { statusCode: 'SUCCESS' } });
	} catch (err) {
		console.error('[mock-rgs] Error:', err);
		sendJson(res, 500, { error: 'Internal mock server error' });
	}
});

server.listen(PORT, () => {
	console.log(`\n🎰 Mock RGS Server running at http://localhost:${PORT}`);
	console.log(`\n📋 Open your game at:`);
	console.log(`   http://localhost:3001/?rgs_url=localhost:${PORT}&sessionID=mock-session&lang=en\n`);
	console.log(`💰 Starting balance: $${(mockBalance / API_AMOUNT_MULTIPLIER).toLocaleString()}`);
	console.log(`📚 ${BASE_BOOKS.length} sample books loaded (mix of wins, losses, and bonus rounds)\n`);
});
