const express = require("express");
const router = express.Router();
const customsController = require("../controllers/customsController");
const customsAuth = require("../middlewares/customsAuth");

router.post("/login", customsController.login);
router.post("/rapiscan/push", customsAuth, customsController.pushRapiscan);
router.post("/examination", customsAuth, customsController.submitExamination);
router.post("/ooc/push", customsAuth, customsController.pushOoc);

module.exports = router;