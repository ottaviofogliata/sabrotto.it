import { createError, defineEventHandler } from 'h3';
import { assertRateLimit, readPublicScores } from '../../utils/minigameScores.js';

function toHttpError(err) {
  return createError({
    statusCode: err.statusCode || 500,
    statusMessage: err.message || 'Score read error',
  });
}

export default defineEventHandler(async (event) => {
  try {
    assertRateLimit(event, 'minigame-scores-read', 120, 60 * 1000);
    return {
      limit: 50,
      scores: await readPublicScores(),
    };
  } catch (err) {
    throw toHttpError(err);
  }
});
