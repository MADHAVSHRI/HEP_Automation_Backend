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
    const existingLockVal = await redisClient.get(lockKey);

    // Fetch user details for the username
    let userName = "Another Approver";
    try {
      const userRes = await pool.query('SELECT "userName" FROM "users" WHERE id = $1', [userId]);
      if (userRes.rows.length > 0) {
        userName = userRes.rows[0].userName;
      }
    } catch (dbErr) {
      console.error("Error fetching username for lock:", dbErr);
    }

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

    // Set lock with a TTL of 15 seconds (frontend heartbeat will extend this)
    const newLockData = {
      userId,
      userName,
      lockedAt: new Date().toISOString(),
    };

    await redisClient.set(lockKey, JSON.stringify(newLockData), { EX: 15 });

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
    const existingLockVal = await redisClient.get(lockKey);

    if (existingLockVal) {
      const lockData = JSON.parse(existingLockVal);
      // Only release if the lock belongs to the current user
      if (String(lockData.userId) === String(userId)) {
        await redisClient.del(lockKey);
        return res.status(200).json({
          success: true,
          message: "Lock released successfully",
        });
      } else {
        return res.status(403).json({
          success: false,
          message: "You do not own the lock on this application",
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "No lock found to release",
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
    const keys = await redisClient.keys("lock:application:*");
    const activeLocks = {
      pass: [],
      "vendor-pass": [],
      company: [],
    };

    for (const key of keys) {
      const val = await redisClient.get(key);
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
