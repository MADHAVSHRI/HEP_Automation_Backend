const express = require("express");
const router = express.Router();

const reportController = require("../controllers/reportController");

router.get(
  "/all-pass-issuance/options",
  reportController.getAllPassIssuanceOptions,
);

router.get(
  "/all-pass-issuance",
  reportController.getAllPassIssuanceReport,
);

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
