const redisClient = require("../config/redisClient");

const SESSION_PREFIX = "session:user:";

/*
Check if session exists
*/
exports.getUserSession = async (userId) => {
  return await redisClient.get(`${SESSION_PREFIX}${userId}`);
};

/*
Create session with TTL
*/
exports.createUserSession = async (userId, sessionId, ttlSeconds) => {

  await redisClient.set(
    `${SESSION_PREFIX}${userId}`,
    sessionId,
    {
      EX: ttlSeconds
    }
  );

};

/*
Delete session
*/
exports.deleteUserSession = async (userId) => {
  await redisClient.del(`${SESSION_PREFIX}${userId}`);
};