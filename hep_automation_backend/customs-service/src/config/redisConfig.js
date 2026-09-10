const parseRedisConnection = () => {
  if (process.env.REDIS_URL) {
    try {
      const parsed = new URL(process.env.REDIS_URL);
      return {
        host: parsed.hostname || "127.0.0.1",
        port: parseInt(parsed.port || "6379", 10),
        password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
        maxRetriesPerRequest: null,
      };
    } catch (e) {
      console.warn("Failed to parse REDIS_URL, using fallback config:", e.message);
    }
  }

  return {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
  };
};

module.exports = {
  redisConnection: parseRedisConnection(),
};
