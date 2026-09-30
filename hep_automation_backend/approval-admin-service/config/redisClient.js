const redis = require("redis");

const client = redis.createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
  legacyMode: true
});

client.on("error", (err) => {
  console.error("Redis error:", err);
});

(async () => {
  try {
    await client.connect();
    console.log("Redis connected.");
  } catch (err) {
    console.error("Redis connect failed:", err);
  }
})();

module.exports = client;

