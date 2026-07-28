const express = require("express");
const router = express.Router();
const verifyToken = require("../middlewares/verifyToken");
const vvipPassApprovalController = require("../controllers/vvipPassApprovalController");

router.get("/queue", verifyToken, vvipPassApprovalController.getQueue);
router.get("/:id", verifyToken, vvipPassApprovalController.getDetail);
router.post("/:id/approve", verifyToken, vvipPassApprovalController.approveRequest);
router.post("/:id/reject", verifyToken, vvipPassApprovalController.rejectRequest);
router.post("/:id/return", verifyToken, vvipPassApprovalController.returnRequest);

module.exports = router;
