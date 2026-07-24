const express = require("express");
const router = express.Router();

const {
  getMaterialPassRequests,
  materialPassRequestAction,
} = require("../controllers/materialPassController")

const verifyToken = require("../middlewares/verifyToken");

router.get(
	"/material-pass-requests",
	verifyToken,
	getMaterialPassRequests
)

router.patch(
	"/material-pass-request-action",
	verifyToken,
	materialPassRequestAction
)

module.exports = router;