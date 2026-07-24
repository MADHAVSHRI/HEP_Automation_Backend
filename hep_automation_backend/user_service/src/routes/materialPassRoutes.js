const express = require("express");
const router = express.Router();

const {
  getPortLocations,
  createRegularMaterialPassRequest,
  getMaterialPassRequests,
  getMaterialPassRequestsToApproverAdmin,
  completeMaterialPassReview,
  getMaterialQrData,
  saveMaterialQrPdfPath,
} = require("../controllers/materialPassController");

const validate = require("../middlewares/validate");

const {
  materialPassRequestSchema,
} = require("../validations/materialPass.validation");

const verifyToken = require("../middlewares/verifyToken");





router.get("/locations",getPortLocations);

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

module.exports = router;