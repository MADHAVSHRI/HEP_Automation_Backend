const express = require("express");
const router = express.Router();

const reportController = require("../controllers/reportController");

router.get(
  "/registered-users/options",
  reportController.getRegisteredUserOptions,
);

router.get(
  "/registered-users",
  reportController.getRegisteredUsersReport,
);

router.get(
  "/type-of-pass-issued",
  reportController.getTypeOfPassIssuedReport,
);

module.exports = router;
