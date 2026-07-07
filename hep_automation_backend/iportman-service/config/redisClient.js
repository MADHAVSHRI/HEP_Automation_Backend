const redis = require("redis");

const client = redis.createClient({
  url:
    process.env.REDIS_URL ||
    "redis://localhost:6379",
});

// Error handler
client.on("error", (err) => {
  console.error(
    "Redis error:",
    err
  );
});

// Connected
client.on("connect", () => {
  console.log(
    "Redis Connected"
  );
});

// Reconnecting
client.on(
  "reconnecting",
  () => {
    console.log(
      "Redis reconnecting..."
    );
  }
);

// Connect safely
(async () => {
  try {
    await client.connect();

    console.log(
      "Redis connection established"
    );
  } catch (err) {
    console.error(
      "Redis connection failed:",
      err
    );
  }
})();

module.exports = client;



// const redis = require("redis");

// const client = redis.createClient({
//   url: process.env.REDIS_URL || "redis://localhost:6379"
// });

// client.on("error", (err) => {
//   console.error("Redis error:", err);
// });

// client.connect();

// module.exports = client;