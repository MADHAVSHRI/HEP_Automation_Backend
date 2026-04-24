const express = require("express");
const router = express.Router();
const adminController = require("../controllers/userCreationController");
const verifyService = require("../middlewares/verifyService");
const verifyToken = require( "../middlewares/verifyToken" );
const authorizeToken = require( "../middlewares/authorizeToken" );
const passRequestAction  = require( "../controllers/passApprovalController" );

router.patch(
  "/agent-pass-request-action",
  verifyToken,
  passRequestAction.passRequestAction
);

module.exports = router;
