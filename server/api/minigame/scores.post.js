import { createError, defineEventHandler, readBody } from 'h3';
import {
  assertRateLimit,
  saveScore,
  validateStats,
  verifyScoreSession,
} from '../../utils/minigameScores.js';

function toHttpError(err) {
  return createError({
    statusCode: err.statusCode || 500,
    statusMessage: err.message || 'Score submit error',
  });
}

export default defineEventHandler(async (event) => {
  try {
    assertRateLimit(event, 'minigame-scores-write', 10, 10 * 60 * 1000);
    const body = await readBody(event);
    const payload = verifyScoreSession(body && body.token);
    const stats = validateStats(body && body.stats);
    const result = await saveScore(payload, stats);
    return {
      kept: result.kept,
      rank: result.rank,
      score: result.score,
      scores: result.scores,
    };
  } catch (err) {
    throw toHttpError(err);
  }
});
