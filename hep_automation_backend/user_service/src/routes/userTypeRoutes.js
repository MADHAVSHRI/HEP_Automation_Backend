const express = require("express");
const router = express.Router();

const userTypeController = require("../controllers/userTypeController");

router.get("/getUserTypes", userTypeController.getUserTypes);

module.exports = router;