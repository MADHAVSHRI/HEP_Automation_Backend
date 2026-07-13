const express = require("express");
const router = express.Router();
const operatorController = require("../controllers/operatorController");
const apiKeyAuth = require("../middlewares/apiKeyAuth");
const operatorAuth = require("../middlewares/operatorAuth");

// Creating operator accounts is an admin action, gated by the shared API key.
router.post("/", apiKeyAuth, operatorController.createOperator);

// Public login → returns a JWT.
router.post("/login", operatorController.loginOperator);

// JWT-protected profile.
router.get("/me", operatorAuth, operatorController.getProfile);

module.exports = router;
