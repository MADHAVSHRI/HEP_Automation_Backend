// const redis = require("redis");

// const client = redis.createClient({
//   url: process.env.REDIS_URL || "redis://localhost:6379"
// });

// client.on("error", (err) => {
//   console.error("Redis error:", err);
// });

// client.connect();

// module.exports = client;

const redis = require("redis");

const client = redis.createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

client.on("error", (err) => {
  console.error("Redis error:", err);
});

client.on("connect", () => {
  console.log("Redis connecting...");
});

client.on("ready", () => {
  console.log("Redis connected.");
});

(async () => {
  try {
    await client.connect();
  } catch (err) {
    console.error("Redis connect failed:", err);
  }
})();

module.exports = client;