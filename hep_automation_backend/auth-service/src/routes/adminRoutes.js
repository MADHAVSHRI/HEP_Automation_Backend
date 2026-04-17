const express = require("express");
const router = express.Router();
const verifyToken = require("../middlewares/verifyToken");
const authorizeToken = require("../middlewares/authorizeToken");
const adminController = require("../controllers/adminController");

router.post("/create-dept-user",verifyToken,authorizeToken("Admin"),adminController.createDeptUser);

module.exports = router;