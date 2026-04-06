const express = require("express");
const router = express.Router();
const adminController = require("../controllers/userCreationController");
const verifyService = require("../middlewares/verifyService");

router.post("/create-user", adminController.createUser);

router.post("/login",verifyService, adminController.getAdminUser);

router.get("/roles", adminController.getRoles);

router.get("/departments", adminController.getDepartments);

router.get("/dept-admin-users", adminController.getDeptAdminUsers);

router.get("/admin-users", adminController.getAdminUsers);

router.get("/agent-users", adminController.getAgentRequests);

router.put("/agent-request", adminController.agentRequestAction);

module.exports = router;
