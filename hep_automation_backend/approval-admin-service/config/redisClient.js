const redis = require("redis");

const client = redis.createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
  legacyMode: true
});

client.on("error", (err) => {
  console.error("Redis error:", err);
});

client.connect();

module.exports = client;
