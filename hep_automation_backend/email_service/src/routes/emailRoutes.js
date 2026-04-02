const express = require("express");
const router = express.Router();
const emailController = require("../controllers/emailController");

router.post("/sendReferenceNo", emailController.sendReference);

module.exports = router;