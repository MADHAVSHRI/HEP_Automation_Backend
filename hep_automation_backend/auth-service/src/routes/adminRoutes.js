const express = require("express");
const router = express.Router();
const verifyToken = require("../middlewares/verifyToken");
const authorizeToken = require("../middlewares/authorizeToken");
const adminController = require("../controllers/adminController");
const loginController = require("../controllers/loginController");

router.post("/create-dept-user", verifyToken, authorizeToken("Admin"), adminController.createDeptUser);
router.get("/deletion-requests", verifyToken, authorizeToken("Admin"), loginController.getAccountDeletionRequests);
router.patch("/deletion-requests/:id", verifyToken, authorizeToken("Admin"), loginController.updateAccountDeletionStatus);

module.exports = router;