const express = require("express");
const router = express.Router();
const verifyToken = require("../middlewares/verifyToken");
const lockController = require("../controllers/lockController");

router.post("/acquire", verifyToken, lockController.acquireLock);
router.post("/release", verifyToken, lockController.releaseLock);
router.get("/active", verifyToken, lockController.getActiveLocks);

module.exports = router;
