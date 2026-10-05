const express = require("express");

const router = express.Router();

const verifyToken =
  require("../middlewares/verifyToken");

const validate =
  require("../middlewares/validate");

const upload =
  require("../middlewares/uploadMiddleware");

const {
  validateUploadedFileTypes,
} = require("../middlewares/uploadMiddleware");

const {
  vendorMaterialLinkSchema,
  revokeVendorMaterialLinkSchema,
} = require(
  "../validations/vendorMaterialLink.validation"
);

const {
  vendorMaterialRequestSchema,
} = require(
  "../validations/vendorMaterialRequest.validation"
);

const {
  getLinkMasters,
  createLink,
  listLinks,
  resendLink,
  revokeLink,
  getPublicLinkDetails,
  submitVendorMaterialRequest,
  listPublicSubmittedRequests,
} = require(
  "../controllers/vendorMaterialLinkController"
);

/*
 * Authenticated department endpoints
 */
router.get(
  "/link-masters",
  verifyToken,
  getLinkMasters
);

router.post(
  "/vendor-links",
  verifyToken,

  upload.fields([
    {
      name: "vendorMaterialLinkWorkOrder",
      maxCount: 1,
    },
  ]),

  validateUploadedFileTypes,
  validate(vendorMaterialLinkSchema),
  createLink
);

router.get(
  "/vendor-links",
  verifyToken,
  listLinks
);

router.post(
  "/vendor-links/:id/resend",
  verifyToken,
  resendLink
);

router.post(
  "/vendor-links/:id/revoke",
  verifyToken,
  validate(revokeVendorMaterialLinkSchema),
  revokeLink
);

/*
 * Public vendor endpoint.
 *
 * Add rate limiting at the application level.
 * Do not place verifyToken here.
 */
router.get(
  "/public/vendor-links/:token",
  getPublicLinkDetails
);

router.post(
  "/public/vendor-links/:token/requests",
  validate(vendorMaterialRequestSchema),
  submitVendorMaterialRequest
);

router.get(
  "/public/vendor-links/:token/requests",
  listPublicSubmittedRequests
);

module.exports = router;