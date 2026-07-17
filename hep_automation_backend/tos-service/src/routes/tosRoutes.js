const express = require("express");
const router = express.Router();
const tosController = require("../controllers/tosController");
const tosAuth = require("../middlewares/tosAuth");

router.post("/login", tosController.login);
router.post("/form13/push", tosAuth, tosController.pushForm13);
router.post("/eir/push", tosAuth, tosController.pushEir);

module.exports = router;
