const redisClient = require("../config/redisClient");

const SESSION_PREFIX = "session:user:";

/*
 * Short TTL: 2 minutes.
 * The frontend sends a heartbeat every 60 s to slide this forward.
 * If the tab is closed, heartbeats stop and Redis auto-expires the key
 * after SESSION_TTL_SECONDS — no sendBeacon / beforeunload needed.
 */
const SESSION_TTL_SECONDS = 120; // 2 minutes

/*
 * Check if session exists — returns the sessionId string or null
 */
exports.getUserSession = async (userId) => {
  return await redisClient.get(`${SESSION_PREFIX}${userId}`);
};

/*
 * Create session with TTL
 */
exports.createUserSession = async (userId, sessionId) => {
  await redisClient.set(
    `${SESSION_PREFIX}${userId}`,
    sessionId,
    { EX: SESSION_TTL_SECONDS }
  );
};

/*
 * Slide the TTL forward — called by the heartbeat endpoint.
 * Only refreshes if the stored sessionId matches (guards against
 * a stale heartbeat from a replaced session).
 * Returns true if refreshed, false if session not found or mismatched.
 */
exports.refreshUserSession = async (userId, sessionId) => {
  const stored = await redisClient.get(`${SESSION_PREFIX}${userId}`);
  if (!stored || stored !== sessionId) return false;
  await redisClient.expire(`${SESSION_PREFIX}${userId}`, SESSION_TTL_SECONDS);
  return true;
};

/*
 * Delete session explicitly (logout)
 */
exports.deleteUserSession = async (userId) => {
  await redisClient.del(`${SESSION_PREFIX}${userId}`);
};

exports.SESSION_TTL_SECONDS = SESSION_TTL_SECONDS;
