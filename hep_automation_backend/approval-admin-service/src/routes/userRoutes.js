const express = require("express");
const router = express.Router();
const adminController = require("../controllers/userCreationController");
const verifyService = require("../middlewares/verifyService");
const verifyToken = require( "../middlewares/verifyToken" );
const authorizeToken = require( "../middlewares/authorizeToken" );

router.post("/create-user",verifyService,verifyToken,authorizeToken("Admin"), adminController.createUser);

router.post("/login",verifyService, adminController.getAdminUser);

router.get("/roles", adminController.getRoles);

router.get("/departments", adminController.getDepartments);

router.get("/dept-admin-users", adminController.getDeptAdminUsers);

router.get("/admin-users", adminController.getAdminUsers);

router.get("/agent-users", adminController.getAgentRequests);

router.put("/agent-request", adminController.agentRequestAction);

router.patch(
  "/update-user-approval", verifyToken,
  adminController.updateUserApproval
);

router.post("/forgot-password", verifyService, adminController.forgotPassword);
router.post("/verify-otp", verifyService, adminController.verifyOtp);
router.post("/reset-password", verifyService, adminController.resetPassword);
router.post("/change-password", verifyToken, adminController.changePassword);

module.exports = router;
