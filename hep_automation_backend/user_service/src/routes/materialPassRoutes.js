const express = require("express");
const router = express.Router();

const {
  getPortLocations,
  getRegularPassTypes,
  getUnits,
  createRegularMaterialPassRequest,
  getMaterialPassRequests,
  getMaterialPassRequestsToApproverAdmin,
  completeMaterialPassReview,
  getMaterialQrData,
  saveMaterialQrPdfPath,
  resubmitRevertedMaterialPass
} = require("../controllers/materialPassController");

const validate = require("../middlewares/validate");

const {
  materialPassRequestSchema,
  resubmitRevertedPassSchema
} = require("../validations/materialPass.validation");

const verifyToken = require("../middlewares/verifyToken");





router.get("/locations", verifyToken, getPortLocations);

router.get("/RegularPassTypes", verifyToken, getRegularPassTypes);

router.get("/units", verifyToken, getUnits);

router.post(
    "/createRegularMaterialPassRequest",
    verifyToken,
    validate(materialPassRequestSchema),
    createRegularMaterialPassRequest
)

router.get("/materialPassRequests", verifyToken, getMaterialPassRequests);

router.get(
    "/material-pass-requests/:departmentId",
    verifyToken,
    getMaterialPassRequestsToApproverAdmin
);

router.put(
    "/complete-review",
    verifyToken,
    completeMaterialPassReview
);

router.get(
    "/qr-data/:passRequestId",
    verifyToken,
    getMaterialQrData
);

router.post(
    "/save-qr-pdf-path",
    verifyToken,
    saveMaterialQrPdfPath
)

router.put(
    "/resubmit-reverted-pass/:passRequestId",
    verifyToken,
    validate(resubmitRevertedPassSchema),
    resubmitRevertedMaterialPass
)

module.exports = router;