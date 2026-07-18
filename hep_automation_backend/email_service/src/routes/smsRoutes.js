const express = require("express");
const router =express.Router();
const {sendRegistrationSMS} =require("../controllers/smsController");

router.post("/sendRegistrationSms",sendRegistrationSMS);

module.exports = router;