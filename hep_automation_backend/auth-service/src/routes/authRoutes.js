const express = require("express");

const router = express.Router();

const loginController = require("../controllers/loginController");

const verifyToken = require("../middlewares/verifyToken");

router.post("/login",loginController.login);

router.post("/refresh",loginController.refreshToken);

router.post("/logout",verifyToken,loginController.logout);

module.exports = router;