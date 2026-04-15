const express = require("express");
const router = express.Router();
const verifyToken = require("../middlewares/verifyToken");


const adminController = require("../controllers/loginController");

// router.post("/create-dept-user",verifyToken,adminController.createDeptUser);

module.exports = router;