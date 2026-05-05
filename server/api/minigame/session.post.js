import { createError, defineEventHandler, readBody } from 'h3';
import {
  assertRateLimit,
  assertTopNameAvailable,
  createScoreSession,
  normalizeHeroKey,
  validatePlayerName,
} from '../../utils/minigameScores.js';

function toHttpError(err) {
  return createError({
    statusCode: err.statusCode || 500,
    statusMessage: err.message || 'Score session error',
  });
}

export default defineEventHandler(async (event) => {
  try {
    assertRateLimit(event, 'minigame-session', 20, 10 * 60 * 1000);
    const body = await readBody(event);
    const playerName = validatePlayerName(body && body.name);
    const heroKey = normalizeHeroKey(body && body.heroKey);
    await assertTopNameAvailable(playerName);
    return createScoreSession({ playerName, heroKey });
  } catch (err) {
    throw toHttpError(err);
  }
});
