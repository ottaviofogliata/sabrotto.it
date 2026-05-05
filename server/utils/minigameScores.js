import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const SCORE_LIMIT = 50;
const SESSION_TTL_SECONDS = 60 * 60 * 2;
const SCORE_FILE = process.env.MINIGAME_SCORE_FILE || resolve(process.cwd(), 'data/minigame-scores.txt');
const NAME_RE = /^[A-Z0-9][A-Z0-9 '-]*$/;
const HEROES = new Set(['otto', 'sabrina']);
const SCORE_BASE = 10000;
const rateBuckets = new Map();

let writeQueue = Promise.resolve();

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function fromBase64url(input) {
  const padded = input + '='.repeat((4 - input.length % 4) % 4);
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function scoreSecret() {
  const secret = process.env.MINIGAME_SCORE_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('MINIGAME_SCORE_SECRET is required in production');
  }
  return 'sabrotto-minigame-dev-secret';
}

function signToken(header, payload) {
  const unsigned = base64url(JSON.stringify(header)) + '.' + base64url(JSON.stringify(payload));
  const signature = createHmac('sha256', scoreSecret()).update(unsigned).digest();
  return unsigned + '.' + base64url(signature);
}

export function normalizePlayerName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toUpperCase();
}

export function validatePlayerName(value) {
  const normalized = normalizePlayerName(value);
  if (normalized.length < 2 || normalized.length > 12) {
    const err = new Error('Use 2-12 chars');
    err.statusCode = 400;
    throw err;
  }
  if (!NAME_RE.test(normalized) || !/[A-Z0-9].*[A-Z0-9]/.test(normalized)) {
    const err = new Error('Invalid player name');
    err.statusCode = 400;
    throw err;
  }
  return normalized;
}

export function normalizeHeroKey(value) {
  return HEROES.has(value) ? value : 'otto';
}

export function calculateScore(stats) {
  return SCORE_BASE +
    Math.max(0, Math.floor(stats.coins || 0)) * 100 +
    Math.max(0, Math.ceil(stats.timeRemaining || 0)) * 10 +
    Math.max(0, Math.floor(stats.lives || 0)) * 1000;
}

function publicRecord(record, index) {
  return {
    rank: index + 1,
    playerName: record.playerName,
    normalizedName: record.normalizedName,
    heroKey: record.heroKey,
    score: record.score,
    coins: record.coins,
    timeRemaining: record.timeRemaining,
    lives: record.lives,
    completedAt: record.completedAt,
  };
}

function sortScores(records) {
  return records.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return String(a.completedAt).localeCompare(String(b.completedAt));
  });
}

export async function readScoreRecords() {
  let raw = '';
  try {
    raw = await readFile(SCORE_FILE, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') return [];
    throw err;
  }

  const records = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed.score === 'number' && parsed.normalizedName) {
        records.push(parsed);
      }
    } catch (err) {
      // Ignore corrupt lines so one bad record does not take the board down.
    }
  }
  return sortScores(records).slice(0, SCORE_LIMIT);
}

export async function readPublicScores() {
  const records = await readScoreRecords();
  return records.map(publicRecord);
}

export async function assertTopNameAvailable(normalizedName) {
  const existing = await readScoreRecords();
  if (existing.some((record) => record.normalizedName === normalizedName)) {
    const err = new Error('Name already in top 50');
    err.statusCode = 409;
    throw err;
  }
}

export function createScoreSession({ playerName, heroKey }) {
  const normalizedName = validatePlayerName(playerName);
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + SESSION_TTL_SECONDS;
  const payload = {
    typ: 'minigame-score',
    playerName: normalizedName,
    normalizedName,
    heroKey: normalizeHeroKey(heroKey),
    nonce: randomBytes(16).toString('hex'),
    iat: now,
    exp: expiresAt,
  };
  const token = signToken({ alg: 'HS256', typ: 'JWT' }, payload);
  return { token, playerName: normalizedName, normalizedName, heroKey: payload.heroKey, expiresAt };
}

export function verifyScoreSession(token) {
  if (!token || typeof token !== 'string') {
    const err = new Error('Missing token');
    err.statusCode = 401;
    throw err;
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    const err = new Error('Invalid token');
    err.statusCode = 401;
    throw err;
  }

  const unsigned = parts[0] + '.' + parts[1];
  const expected = createHmac('sha256', scoreSecret()).update(unsigned).digest();
  const actual = fromBase64url(parts[2]);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    const err = new Error('Invalid token');
    err.statusCode = 401;
    throw err;
  }

  let payload;
  try {
    payload = JSON.parse(fromBase64url(parts[1]).toString('utf8'));
  } catch (err) {
    const tokenErr = new Error('Invalid token');
    tokenErr.statusCode = 401;
    throw tokenErr;
  }

  if (!payload || payload.typ !== 'minigame-score' || !payload.nonce) {
    const err = new Error('Invalid token');
    err.statusCode = 401;
    throw err;
  }
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    const err = new Error('Expired token');
    err.statusCode = 401;
    throw err;
  }
  payload.normalizedName = validatePlayerName(payload.normalizedName || payload.playerName);
  payload.playerName = payload.normalizedName;
  payload.heroKey = normalizeHeroKey(payload.heroKey);
  return payload;
}

export function validateStats(stats) {
  const body = stats && typeof stats === 'object' ? stats : {};
  const normalized = {
    completed: body.completed === true,
    coins: Number(body.coins),
    timeRemaining: Number(body.timeRemaining),
    lives: Number(body.lives),
    durationMs: Number(body.durationMs),
    levelIndex: Number(body.levelIndex),
    levelsCleared: Number(body.levelsCleared),
  };

  if (!normalized.completed) {
    const err = new Error('Run not completed');
    err.statusCode = 400;
    throw err;
  }
  const checks = [
    Number.isInteger(normalized.coins) && normalized.coins >= 0 && normalized.coins <= 5000,
    Number.isFinite(normalized.timeRemaining) && normalized.timeRemaining >= 0 && normalized.timeRemaining <= 360,
    Number.isInteger(normalized.lives) && normalized.lives >= 0 && normalized.lives <= 3,
    Number.isFinite(normalized.durationMs) && normalized.durationMs >= 1000 && normalized.durationMs <= 30 * 60 * 1000,
    Number.isInteger(normalized.levelIndex) && normalized.levelIndex >= 0,
    Number.isInteger(normalized.levelsCleared) && normalized.levelsCleared >= 1,
  ];
  if (checks.some((ok) => !ok)) {
    const err = new Error('Invalid score stats');
    err.statusCode = 400;
    throw err;
  }
  normalized.timeRemaining = Math.ceil(normalized.timeRemaining);
  normalized.score = calculateScore(normalized);
  return normalized;
}

async function writeScoreRecords(records) {
  await mkdir(dirname(SCORE_FILE), { recursive: true });
  const tmp = SCORE_FILE + '.' + process.pid + '.' + Date.now() + '.tmp';
  const body = records.map((record) => JSON.stringify(record)).join('\n');
  await writeFile(tmp, body ? body + '\n' : '', 'utf8');
  await rename(tmp, SCORE_FILE);
}

async function saveScoreNow(payload, stats) {
  const existing = await readScoreRecords();
  if (existing.some((record) => record.normalizedName === payload.normalizedName)) {
    const err = new Error('Name already in top 50');
    err.statusCode = 409;
    throw err;
  }
  if (existing.some((record) => record.sessionNonce === payload.nonce)) {
    const err = new Error('Score already submitted');
    err.statusCode = 409;
    throw err;
  }

  const record = {
    playerName: payload.playerName,
    normalizedName: payload.normalizedName,
    heroKey: payload.heroKey,
    score: stats.score,
    coins: stats.coins,
    timeRemaining: stats.timeRemaining,
    lives: stats.lives,
    durationMs: stats.durationMs,
    levelIndex: stats.levelIndex,
    levelsCleared: stats.levelsCleared,
    completedAt: new Date().toISOString(),
    sessionNonce: payload.nonce,
  };

  const sorted = sortScores(existing.concat(record));
  const keptRecords = sorted.slice(0, SCORE_LIMIT);
  const keptIndex = keptRecords.findIndex((item) => item.sessionNonce === payload.nonce);
  await writeScoreRecords(keptRecords);
  return {
    kept: keptIndex !== -1,
    rank: keptIndex === -1 ? null : keptIndex + 1,
    score: record.score,
    record: keptIndex === -1 ? record : keptRecords[keptIndex],
    scores: keptRecords.map(publicRecord),
  };
}

export function saveScore(payload, stats) {
  const operation = writeQueue.then(() => saveScoreNow(payload, stats));
  writeQueue = operation.catch(() => {});
  return operation;
}

export function getClientKey(event) {
  const forwarded = event.node.req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = event.node.req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) return realIp.trim();
  return event.node.req.socket.remoteAddress || 'local';
}

export function assertRateLimit(event, action, maxRequests, windowMs) {
  const now = Date.now();
  const key = action + ':' + getClientKey(event);
  const bucket = rateBuckets.get(key) || { count: 0, resetAt: now + windowMs };
  if (bucket.resetAt <= now) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
  }
  bucket.count += 1;
  rateBuckets.set(key, bucket);
  if (bucket.count > maxRequests) {
    const err = new Error('Rate limit exceeded');
    err.statusCode = 429;
    throw err;
  }
}
