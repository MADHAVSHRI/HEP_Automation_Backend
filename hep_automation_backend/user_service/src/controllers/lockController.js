const redisClient = require("../../config/redisClient");
const { pool } = require("../dbconfig/db");

exports.acquireLock = async (req, res) => {
  try {
    const { applicationId, type } = req.body;
    const userId = req.user ? req.user.userId : null;

    if (!applicationId || !type || !userId) {
      return res.status(400).json({
        success: false,
        message: "applicationId, type, and authentication are required",
      });
    }

    if (!["pass", "vendor-pass", "company"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid application type. Must be 'pass', 'vendor-pass', or 'company'",
      });
    }

    const lockKey = `lock:application:${type}:${applicationId}`;
    const now = new Date();
    // 5 minutes lock TTL as requested by user
    const LOCK_TTL_MINUTES = 5;
    const expiresAt = new Date(now.getTime() + LOCK_TTL_MINUTES * 60 * 1000);

    // 1. Check Redis cache first (Fast 0-DB read)
    try {
      const existingLockVal = await redisClient.get(lockKey);
      if (existingLockVal) {
        const lockData = JSON.parse(existingLockVal);
        if (String(lockData.userId) !== String(userId)) {
          return res.status(409).json({
            success: false,
            message: `Application is currently in-use by ${lockData.userName}`,
            lock: lockData,
          });
        }
      }
    } catch (redisErr) {
      console.error("Redis get error in acquireLock:", redisErr);
    }

    // 2. Lookup username
    let userName = req.user.userName || req.user.username || "Another Approver";
    try {
      const userRes = await pool.query('SELECT "userName" FROM "users" WHERE id = $1', [userId]);
      if (userRes.rows.length > 0 && userRes.rows[0].userName) {
        userName = userRes.rows[0].userName;
      }
    } catch (dbErr) {
      console.error("Error fetching username for lock:", dbErr);
    }

    // 3. Clean expired DB locks & check current DB state
    try {
      await pool.query('DELETE FROM application_locks WHERE expires_at <= NOW()');
      const dbCheck = await pool.query(
        'SELECT user_id, user_name, locked_at, expires_at FROM application_locks WHERE application_id = $1 AND application_type = $2 AND expires_at > NOW()',
        [String(applicationId), type]
      );

      if (dbCheck.rows.length > 0) {
        const lockRow = dbCheck.rows[0];
        if (String(lockRow.user_id) !== String(userId)) {
          const existingLockData = {
            userId: lockRow.user_id,
            userName: lockRow.user_name,
            lockedAt: lockRow.locked_at,
            expiresAt: lockRow.expires_at,
          };
          const ttlSec = Math.max(1, Math.floor((new Date(lockRow.expires_at).getTime() - Date.now()) / 1000));
          await redisClient.set(lockKey, JSON.stringify(existingLockData), { EX: ttlSec }).catch(() => {});

          return res.status(409).json({
            success: false,
            message: `Application is currently in-use by ${lockRow.user_name}`,
            lock: existingLockData,
          });
        }
      }

      // 4. Save lock in PostgreSQL DB
      await pool.query(
        `INSERT INTO application_locks (application_id, application_type, user_id, user_name, locked_at, expires_at)
         VALUES ($1, $2, $3, $4, NOW(), $5)
         ON CONFLICT (application_id, application_type)
         DO UPDATE SET user_id = $3, user_name = $4, locked_at = NOW(), expires_at = $5`,
        [String(applicationId), type, userId, userName, expiresAt]
      );
    } catch (dbWriteErr) {
      console.error("Database lock operation error:", dbWriteErr);
    }

    const newLockData = {
      userId,
      userName,
      lockedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    // 5. Cache lock in Redis with 5 minutes (300 seconds) TTL
    try {
      await redisClient.set(lockKey, JSON.stringify(newLockData), { EX: LOCK_TTL_MINUTES * 60 });
    } catch (redisSetErr) {
      console.error("Redis set error in acquireLock:", redisSetErr);
    }

    return res.status(200).json({
      success: true,
      message: "Lock acquired successfully",
      lock: newLockData,
    });
  } catch (error) {
    console.error("Error acquiring lock:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.releaseLock = async (req, res) => {
  try {
    const { applicationId, type } = req.body;
    const userId = req.user ? req.user.userId : null;

    if (!applicationId || !type || !userId) {
      return res.status(400).json({
        success: false,
        message: "applicationId, type, and authentication are required",
      });
    }

    const lockKey = `lock:application:${type}:${applicationId}`;

    // Release from DB
    try {
      await pool.query(
        'DELETE FROM application_locks WHERE application_id = $1 AND application_type = $2 AND user_id = $3',
        [String(applicationId), type, userId]
      );
    } catch (dbErr) {
      console.error("Error releasing lock from DB:", dbErr);
    }

    // Release from Redis
    try {
      await redisClient.del(lockKey);
    } catch (redisErr) {
      console.error("Error deleting lock from Redis:", redisErr);
    }

    return res.status(200).json({
      success: true,
      message: "Lock released successfully",
    });
  } catch (error) {
    console.error("Error releasing lock:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.getActiveLocks = async (req, res) => {
  try {
    const activeLocks = {
      pass: [],
      "vendor-pass": [],
      company: [],
    };

    // 1. Try Redis first (0 DB hits)
    try {
      const keys = await redisClient.keys("lock:application:*");
      if (keys && keys.length > 0) {
        const vals = await redisClient.mGet(keys);
        keys.forEach((key, idx) => {
          const val = vals[idx];
          if (val) {
            const parts = key.split(":");
            const type = parts[2];
            const id = parts[3];
            if (activeLocks[type]) {
              activeLocks[type].push({
                applicationId: id,
                ...JSON.parse(val),
              });
            }
          }
        });
        return res.status(200).json({
          success: true,
          data: activeLocks,
        });
      }
    } catch (redisErr) {
      console.error("Redis getActiveLocks error, falling back to DB:", redisErr);
    }

    // 2. DB fallback if Redis empty or unavailable
    try {
      const dbRes = await pool.query(
        'SELECT application_id, application_type, user_id, user_name, locked_at FROM application_locks WHERE expires_at > NOW()'
      );
      dbRes.rows.forEach((row) => {
        const type = row.application_type;
        if (activeLocks[type]) {
          activeLocks[type].push({
            applicationId: row.application_id,
            userId: row.user_id,
            userName: row.user_name,
            lockedAt: row.locked_at,
          });
        }
      });
    } catch (dbErr) {
      console.error("DB getActiveLocks fallback error:", dbErr);
    }

    return res.status(200).json({
      success: true,
      data: activeLocks,
    });
  } catch (error) {
    console.error("Error getting active locks:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

