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
  resubmitRevertedMaterialPass,
  viewMaterialPassDocument
} = require("../controllers/materialPassController");

const validate = require("../middlewares/validate");
const parseJsonPayload = require("../middlewares/parseJsonPayload");
const upload = require("../middlewares/uploadMiddleware");
const { validateUploadedFileTypes } = require("../middlewares/uploadMiddleware");


const {
  materialPassRequestSchema,
  resubmitRevertedPassSchema
} = require("../validations/materialPass.validation");

const verifyToken = require("../middlewares/verifyToken");





router.get("/locations", verifyToken, getPortLocations);

router.get("/RegularPassTypes", verifyToken, getRegularPassTypes);

router.get("/units", getUnits);

router.post(
    "/createRegularMaterialPassRequest",
    verifyToken,
    upload.fields([
        { name: "materialPassRequisitionLetter", maxCount: 1 },
        { name: "materialPassWorkOrder", maxCount: 1 },    
    ]),
    validateUploadedFileTypes,
    parseJsonPayload,
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

router.get("/viewMaterialPassDocument", viewMaterialPassDocument);

module.exports = router;