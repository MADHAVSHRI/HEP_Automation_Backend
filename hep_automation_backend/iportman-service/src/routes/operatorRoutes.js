const express = require("express");
const router = express.Router();
const operatorController = require("../controllers/operatorController");
const apiKeyAuth = require("../middlewares/apiKeyAuth");
const operatorAuth = require("../middlewares/operatorAuth");

// Creating operator accounts is an admin action, gated by the shared API key.
router.post("/", apiKeyAuth, operatorController.createOperator);

// Listing all operator accounts is also an admin action.
router.get("/", apiKeyAuth, operatorController.getAllOperators);

// Partial update of an operator's details (admin action).
router.patch("/:id", apiKeyAuth, operatorController.updateOperator);

// Permanently delete an operator (admin action).
router.delete("/:id", apiKeyAuth, operatorController.deleteOperator);

// Public login → returns a JWT.
router.post("/login", operatorController.loginOperator);

// JWT-protected profile.
router.get("/me", operatorAuth, operatorController.getProfile);

module.exports = router;
