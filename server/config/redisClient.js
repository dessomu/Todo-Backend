// for redis in local set-up
// const { createClient } = require("redis");

// const redisClient = createClient({
//   url: process.env.REDIS_URL || "redis://localhost:6379",
// });

// redisClient.on("error", (err) => console.error("Redis Error:", err));

// // Async init function to connect
// async function connectRedis() {
//   if (!redisClient.isOpen) {
//     await redisClient.connect();
//     console.log("✅ Redis connected successfully");
//   }
// }

// module.exports = { redisClient, connectRedis };

const { Redis } = require("@upstash/redis");
require("dotenv").config();

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

module.exports = redis;
