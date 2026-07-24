const express = require("express");
const router = express.Router();
const adminController = require("../controllers/userCreationController");
const verifyService = require("../middlewares/verifyService");
const verifyToken = require( "../middlewares/verifyToken" );
const authorizeToken = require( "../middlewares/authorizeToken" );

router.post("/create-user",verifyService,verifyToken,authorizeToken("Admin"), adminController.createUser);

router.post("/login",verifyService, adminController.getAdminUser);

router.get("/roles", verifyToken, authorizeToken("Admin"), adminController.getRoles);

router.get("/departments", adminController.getDepartments);

router.get("/dept-admin-users", adminController.getDeptAdminUsers);

router.get("/admin-users", adminController.getAdminUsers);

router.get("/agent-users", verifyToken, adminController.getAgentRequests);

router.put("/agent-request", adminController.agentRequestAction);

router.get("/agent-profile-update-requests", verifyToken, adminController.getAgentProfileUpdateRequests);
router.get("/profile-update-requests", verifyToken, adminController.getAgentProfileUpdateRequests);

router.put("/action-agent-profile-update-request", verifyToken, adminController.actionAgentProfileUpdateRequest);
router.post("/action-agent-profile-update-request", verifyToken, adminController.actionAgentProfileUpdateRequest);
router.put("/profile-update-requests/:id/action", verifyToken, adminController.actionAgentProfileUpdateRequest);
router.post("/profile-update-requests/:id/action", verifyToken, adminController.actionAgentProfileUpdateRequest);

router.get("/view-profile-update-doc", adminController.viewProfileUpdateDocument);
router.get("/profile-update-requests/document", adminController.viewProfileUpdateDocument);

router.get("/agent/:agentId", verifyToken, adminController.getAgentById);

router.patch(
  "/update-user-approval", verifyToken,
  adminController.updateUserApproval
);

router.post("/forgot-password", verifyService, adminController.forgotPassword);
router.post("/verify-otp", verifyService, adminController.verifyOtp);
router.post("/reset-password", verifyService, adminController.resetPassword);
router.post("/change-password", verifyToken, adminController.changePassword);

module.exports = router;
