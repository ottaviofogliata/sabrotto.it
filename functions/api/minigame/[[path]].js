const SCORE_LIMIT = 50;
const SESSION_TTL_SECONDS = 60 * 60 * 2;
const SCORE_BASE = 10000;
const NAME_RE = /^[A-Z0-9][A-Z0-9 '-]*$/;
const HEROES = new Set(['otto', 'sabrina']);

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders,
    },
  });
}

function apiError(status, message) {
  return json({ statusCode: status, statusMessage: message }, status);
}

function normalizePlayerName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toUpperCase();
}

function validatePlayerName(value) {
  const normalized = normalizePlayerName(value);
  if (normalized.length < 2 || normalized.length > 12) {
    throw new ApiValidationError(400, 'Use 2-12 chars');
  }
  if (!NAME_RE.test(normalized) || !/[A-Z0-9].*[A-Z0-9]/.test(normalized)) {
    throw new ApiValidationError(400, 'Invalid player name');
  }
  return normalized;
}

function normalizeHeroKey(value) {
  return HEROES.has(value) ? value : 'otto';
}

function calculateScore(stats) {
  return SCORE_BASE +
    Math.max(0, Math.floor(stats.coins || 0)) * 100 +
    Math.max(0, Math.ceil(stats.timeRemaining || 0)) * 10 +
    Math.max(0, Math.floor(stats.lives || 0)) * 1000;
}

function validateStats(stats) {
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
    throw new ApiValidationError(400, 'Run not completed');
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
    throw new ApiValidationError(400, 'Invalid score stats');
  }

  normalized.timeRemaining = Math.ceil(normalized.timeRemaining);
  normalized.score = calculateScore(normalized);
  return normalized;
}

async function readJson(request) {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 4096) {
    throw new ApiValidationError(413, 'Request too large');
  }

  try {
    return await request.json();
  } catch {
    throw new ApiValidationError(400, 'Invalid JSON');
  }
}

function publicScore(row, index) {
  return {
    rank: index + 1,
    playerName: row.player_name,
    normalizedName: row.normalized_name,
    heroKey: row.hero_key,
    score: row.score,
    coins: row.coins,
    timeRemaining: row.time_remaining,
    lives: row.lives,
    completedAt: row.completed_at,
  };
}

async function readScores(database) {
  const result = await database.prepare(`
    SELECT
      player_name,
      normalized_name,
      hero_key,
      score,
      coins,
      time_remaining,
      lives,
      completed_at
    FROM minigame_scores
    ORDER BY score DESC, completed_at ASC, id ASC
    LIMIT ?1
  `).bind(SCORE_LIMIT).all();

  return (result.results || []).map(publicScore);
}

async function createSession(request, database) {
  const body = await readJson(request);
  const playerName = validatePlayerName(body && body.name);
  const heroKey = normalizeHeroKey(body && body.heroKey);
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + SESSION_TTL_SECONDS;
  const token = crypto.randomUUID();

  const existing = await database.prepare(`
    SELECT 1
    FROM minigame_scores
    WHERE normalized_name = ?1 COLLATE NOCASE
    LIMIT 1
  `).bind(playerName).first();

  if (existing) {
    throw new ApiValidationError(409, 'Name already in top 50');
  }

  await database.batch([
    database.prepare('DELETE FROM minigame_sessions WHERE expires_at < ?1').bind(now),
    database.prepare(`
      INSERT INTO minigame_sessions (
        token,
        player_name,
        normalized_name,
        hero_key,
        expires_at
      ) VALUES (?1, ?2, ?3, ?4, ?5)
    `).bind(token, playerName, playerName, heroKey, expiresAt),
  ]);

  return json({
    token,
    playerName,
    normalizedName: playerName,
    heroKey,
    expiresAt,
  });
}

async function saveScore(request, database) {
  const body = await readJson(request);
  const token = typeof body.token === 'string' ? body.token : '';
  if (!token) {
    throw new ApiValidationError(401, 'Missing token');
  }

  const session = await database.prepare(`
    SELECT token, player_name, normalized_name, hero_key, expires_at
    FROM minigame_sessions
    WHERE token = ?1
    LIMIT 1
  `).bind(token).first();

  if (!session) {
    throw new ApiValidationError(401, 'Invalid token');
  }

  const now = Math.floor(Date.now() / 1000);
  if (session.expires_at < now) {
    await database.prepare('DELETE FROM minigame_sessions WHERE token = ?1').bind(token).run();
    throw new ApiValidationError(401, 'Expired token');
  }

  const stats = validateStats(body.stats);
  const completedAt = new Date().toISOString();

  try {
    await database.batch([
      database.prepare(`
        INSERT INTO minigame_scores (
          player_name,
          normalized_name,
          hero_key,
          score,
          coins,
          time_remaining,
          lives,
          duration_ms,
          level_index,
          levels_cleared,
          completed_at,
          session_token
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
      `).bind(
        session.player_name,
        session.normalized_name,
        session.hero_key,
        stats.score,
        stats.coins,
        stats.timeRemaining,
        stats.lives,
        Math.floor(stats.durationMs),
        stats.levelIndex,
        stats.levelsCleared,
        completedAt,
        token,
      ),
      database.prepare('DELETE FROM minigame_sessions WHERE token = ?1').bind(token),
      database.prepare(`
        DELETE FROM minigame_scores
        WHERE id NOT IN (
          SELECT id
          FROM minigame_scores
          ORDER BY score DESC, completed_at ASC, id ASC
          LIMIT ?1
        )
      `).bind(SCORE_LIMIT),
    ]);
  } catch (error) {
    const message = String(error && error.message || '');
    if (message.includes('UNIQUE') || message.includes('constraint')) {
      throw new ApiValidationError(409, 'Name already in top 50');
    }
    throw error;
  }

  const scores = await readScores(database);
  const rank = scores.findIndex((row) => row.normalizedName === session.normalized_name) + 1;
  return json({
    kept: rank > 0,
    rank: rank || null,
    score: stats.score,
    scores,
  });
}

class ApiValidationError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  if (!env.MINIGAME_DB) {
    return apiError(503, 'Score database unavailable');
  }

  const path = new URL(request.url).pathname.replace(/\/+$/, '');

  try {
    if (path === '/api/minigame/scores' && request.method === 'GET') {
      return json({ limit: SCORE_LIMIT, scores: await readScores(env.MINIGAME_DB) });
    }
    if (path === '/api/minigame/scores' && request.method === 'POST') {
      return await saveScore(request, env.MINIGAME_DB);
    }
    if (path === '/api/minigame/session' && request.method === 'POST') {
      return await createSession(request, env.MINIGAME_DB);
    }
    if (path === '/api/minigame/scores' || path === '/api/minigame/session') {
      return apiError(405, 'Method not allowed');
    }
    return apiError(404, 'Not found');
  } catch (error) {
    if (error instanceof ApiValidationError) {
      return apiError(error.status, error.message);
    }
    console.error('Minigame API error', error);
    return apiError(500, 'Score server error');
  }
}
