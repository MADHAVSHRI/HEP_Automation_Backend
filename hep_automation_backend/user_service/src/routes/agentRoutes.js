const express = require("express");
const router = express.Router();
const verifyService = require("../middlewares/verifyService");
const verifyToken = require("../middlewares/verifyToken");
const upload = require("../middlewares/uploadMiddleware");
const agentController = require("../controllers/agentController");

router.post(
  "/registerAgent",
  upload.fields([
    { name: "entityFile", maxCount: 1 },
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
  agentController.agentAction
);

router.put(
  "/updateAgentByRevert",
  upload.fields([
    { name: "entityFile", maxCount: 1 },
    { name: "gstinDoc", maxCount: 1 },
    { name: "panDoc", maxCount: 1 },
    { name: "tanDoc", maxCount: 1 },
  ]),
  agentController.updateAgentByReference
);

module.exports = router;