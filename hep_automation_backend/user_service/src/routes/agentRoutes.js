const express = require("express");
const router = express.Router();
const verifyService = require("../middlewares/verifyService");
const verifyToken = require("../middlewares/verifyToken");
const upload = require("../middlewares/uploadMiddleware");
const agentController = require("../controllers/agentController");
const forgotPasswordLimiter = require("../middlewares/forgotPasswordLimiter");

// router.post(
//   "/registerAgent",
//   upload.fields([
//     { name: "entityFile", maxCount: 1 },
//     { name: "gstinDoc", maxCount: 1 },
//     { name: "panDoc", maxCount: 1 },
//     { name: "tanDoc", maxCount: 1 },
//   ]),
//   agentController.registerAgent
// );

router.post(
  "/registerAgent",
  upload.fields([
    { name: "workOrder", maxCount: 1 },
    { name: "requisitionLetter", maxCount: 1 },
    { name: "licenseDoc", maxCount: 1 },
    { name: "gstinDoc", maxCount: 1 },
    { name: "panDoc", maxCount: 1 },
    { name: "tanDoc", maxCount: 1 },
  ]),
  agentController.registerAgent
);

router.post(
  "/login",verifyService,
  agentController.getLoginUser
);

router.patch(
  "/updateEmailStatus",
  agentController.updateEmailStatus
);

router.patch("/updateCredentialEmailStatus", agentController.updateCredentialEmailStatus);

router.get(
  "/getAllRegisteredUsers",
  agentController.getAllRegisteredUsers
);

router.get(
  "/profile",verifyToken,
  agentController.getAgentProfile
);

router.get(
  "/getTrackRequest",
  agentController.trackRequest
);

router.get("/viewAgentDocument", agentController.viewAgentDocument);

router.put(
  "/action",
  verifyToken,
  agentController.agentAction
);

router.put(
  "/updateAgentByRevert",
  upload.fields([
    { name: "workOrder", maxCount: 1 },
    { name: "requisitionLetter", maxCount: 1 },
    { name: "licenseDoc", maxCount: 1 },
    { name: "gstinDoc", maxCount: 1 },
    { name: "panDoc", maxCount: 1 },
    { name: "tanDoc", maxCount: 1 },
  ]),
  agentController.updateAgentByReference
);
router.get(
  "/getAgentById/:agentId",
  agentController.getAgentDetailsById
);
router.post(
  "/change-password",
  verifyToken,
  agentController.changePassword
);

router.post(
  "/forgot-password/send-otp",forgotPasswordLimiter,
  verifyService,
  agentController.sendForgotPasswordOtp
);

router.post(
  "/forgot-password/verify-otp",
  verifyService,
  agentController.verifyForgotPasswordOtp
);

router.post(
  "/forgot-password/reset-password",
  verifyService,
  agentController.resetForgotPassword
);

// ── COMPANY PROFILE & LICENSE UPDATE ROUTES ──────────────────────────
const profileUploadMiddleware = upload.fields([
  { name: "licenseDoc", maxCount: 1 },
  { name: "entityNameDoc", maxCount: 1 },
  { name: "addressDoc", maxCount: 1 },
  { name: "gstinDoc", maxCount: 1 },
  { name: "panDoc", maxCount: 1 },
  { name: "tanDoc", maxCount: 1 },
]);

router.post("/submitProfileUpdateRequest", verifyToken, profileUploadMiddleware, agentController.submitProfileUpdateRequest);
router.post("/profile-update-requests", verifyToken, profileUploadMiddleware, agentController.submitProfileUpdateRequest);

router.get("/getProfileUpdateRequestStatus", verifyToken, agentController.getProfileUpdateRequestStatus);
router.get("/profile-update-requests/my-requests", verifyToken, agentController.getProfileUpdateRequestStatus);

router.get("/getProfileUpdateRequests", agentController.getProfileUpdateRequests);
router.get("/profile-update-requests", agentController.getProfileUpdateRequests);

router.get("/getProfileUpdateRequestById/:id", agentController.getProfileUpdateRequestById);
router.get("/profile-update-requests/:id", agentController.getProfileUpdateRequestById);

router.put("/actionProfileUpdateRequest", verifyToken, agentController.actionProfileUpdateRequest);
router.post("/profile-update-requests/:id/action", verifyToken, agentController.actionProfileUpdateRequest);
router.put("/profile-update-requests/:id/action", verifyToken, agentController.actionProfileUpdateRequest);

router.get("/viewProfileUpdateDocument", agentController.viewProfileUpdateDocument);
router.get("/profile-update-requests/document", agentController.viewProfileUpdateDocument);

module.exports = router;