const express = require("express");
const router = express.Router();

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

router.patch(
  "/updateEmailStatus",
  agentController.updateEmailStatus
);

router.get(
  "/getAllRegisteredUsers",
  agentController.getAllRegisteredUsers
);

router.put(
  "/action",
  agentController.agentAction
);

module.exports = router;