const fs = require("fs");
const axios = require("axios");

const VendorMaterialLink =
  require("../models/vendorMaterialLinkSchema");

const {
  generatePublicToken,
  hashToken,
  encryptToken,
  decryptToken,
} = require("../utils/vendorMaterialToken");

const {
  getPagination,
  buildPaginatedResponse,
} = require("../utils/pagination");

const FRONTEND_BASE_URL =
  process.env.FRONTEND_BASE_URL ||
  process.env.FRONTEND_URL;

const EMAIL_SERVICE_URL =
  process.env.EMAIL_SERVICE_URL;

function removeUploadedFiles(req) {
  if (!req.files) return;

  const files = Array.isArray(req.files)
    ? req.files
    : Object.values(req.files).flat();

  for (const file of files) {
    if (!file?.path) continue;

    fs.unlink(file.path, (error) => {
      if (
        error &&
        error.code !== "ENOENT"
      ) {
        console.error(
          "[vendorMaterialLink] Failed to delete file:",
          error
        );
      }
    });
  }
}

function buildPublicLink(rawToken) {
  if (!FRONTEND_BASE_URL) {
    throw new Error(
      "FRONTEND_BASE_URL is not configured."
    );
  }

  const base = FRONTEND_BASE_URL.replace(/\/+$/, "");

  return `${base}/vendor-material-pass/${encodeURIComponent(
    rawToken
  )}`;
}

async function sendLinkEmail({
  vendorEmail,
  companyName,
  referenceNo,
  departmentName,
  validFrom,
  validTo,
  rawToken,
}) {
  if (!EMAIL_SERVICE_URL) {
    console.error(
      "[vendorMaterialLink] EMAIL_SERVICE_URL is not configured."
    );

    return false;
  }

  try {
    await axios.post(
      `${EMAIL_SERVICE_URL}/api/email/sendVendorMaterialLink`,
      {
        email: vendorEmail,
        companyName,
        referenceNo,
        departmentName,
        validFrom,
        validTo,
        link: buildPublicLink(rawToken),
      },
      {
        headers: {
          "x-service-name": "USER-SERVICE",
        },
        timeout: 8000,
      }
    );

    return true;
  } catch (error) {
    console.error(
      "[vendorMaterialLink] Email delivery failed:",
      error.response?.data || error.message
    );

    return false;
  }
}

exports.getLinkMasters = async (req, res) => {
  try {
    const data =
      await VendorMaterialLink.getLinkMasters();

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(
      "Vendor material link master fetch error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load vendor material link master data.",
    });
  }
};

exports.createLink = async (req, res) => {
  let databaseCommitted = false;

  try {
    const userId = Number(req.user?.userId);
    const departmentId =
      Number(req.user?.departmentId);

    if (
      !Number.isSafeInteger(userId) ||
      userId <= 0 ||
      !Number.isSafeInteger(departmentId) ||
      departmentId <= 0
    ) {
      removeUploadedFiles(req);

      return res.status(403).json({
        success: false,
        message:
          "A valid department user is required.",
      });
    }

    const payload = req.body;

    const workOrder =
      req.files
        ?.vendorMaterialLinkWorkOrder?.[0];

    const rawToken = generatePublicToken();

    /*
     * Build this before saving so a missing frontend URL
     * cannot leave a committed link with a failed response.
     */
    const publicLink =
      buildPublicLink(rawToken);

    const link =
      await VendorMaterialLink.createDepartmentLink({
        userId,
        departmentId,
        tokenHash: hashToken(rawToken),
        tokenCipher: encryptToken(rawToken),
        payload,
        workOrder: workOrder
          ? {
              path: workOrder.path,
              originalname:
                workOrder.originalname,
            }
          : null,
      });

    databaseCommitted = true;

    /*
     * Email delivery occurs after the model has committed
     * and released its database connection.
     */
    const emailSent = await sendLinkEmail({
      vendorEmail: link.vendorEmail,
      companyName: link.companyName,
      referenceNo: link.referenceNo,
      departmentName: link.departmentName,
      validFrom: link.validFrom,
      validTo: link.validTo,
      rawToken,
    });

    if (emailSent) {
      try {
        await VendorMaterialLink.markEmailSent(
          link.id
        );
      } catch (error) {
        console.error(
          "Failed to update lastEmailSentAt:",
          error
        );
      }
    }

    return res.status(201).json({
      success: true,
      message: emailSent
        ? "Vendor material application link generated and sent successfully."
        : "The link was generated, but email delivery failed. You can resend it from the generated-links list.",
      data: {
        id: link.id,
        referenceNo: link.referenceNo,
        vendorLink: publicLink,
        gateSelectionMode:
          link.gateSelectionMode,
        requiresTrafficApproval:
          link.requiresTrafficApproval,
        emailSent,
      },
    });
  } catch (error) {
    if (!databaseCommitted) {
      removeUploadedFiles(req);
    }

    if (
      error instanceof
      VendorMaterialLink.SubmissionError
    ) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    console.error(
      "Create vendor material link error:",
      error
    );

    const databaseErrors = {
      "23503": {
        status: 422,
        message:
          "The department, user, purpose or gate record is invalid.",
      },
      "23505": {
        status: 409,
        message:
          "A duplicate reference number or secure token was detected. Please try again.",
      },
      "23514": {
        status: 422,
        message:
          "The submitted data violates a required business rule.",
      },
    };

    const mapped =
      databaseErrors[error.code];

    return res
      .status(mapped?.status || 500)
      .json({
        success: false,
        message:
          mapped?.message ||
          "Unable to generate the vendor material application link.",
      });
  }
};

exports.getPublicLinkDetails = async (
  req,
  res
) => {
  try {
    const token = String(
      req.params.token || ""
    ).trim();

    if (
      !/^[A-Za-z0-9_-]{43}$/.test(token)
    ) {
      return res.status(410).json({
        success: false,
        message:
          "This application link is unavailable.",
      });
    }

    const data =
      await VendorMaterialLink
        .getPublicApplicationDetails(
          hashToken(token)
        );

    if (!data) {
      return res.status(410).json({
        success: false,
        message:
          "This application link is unavailable.",
      });
    }

    const { link, availableGates } = data;

    return res.status(200).json({
      success: true,
      data: {
        referenceNo: link.referenceNo,
        departmentName:
          link.departmentName,
        companyName: link.companyName,

        vendorEmail:
          maskEmail(link.vendorEmail),

        vendorMobile:
          maskMobile(link.vendorMobile),

        purpose: link.purpose,
        validFrom: link.validFrom,
        validTo: link.validTo,

        gateSelectionMode:
          link.gateSelectionMode,

        gatesLocked:
          link.gateSelectionMode ===
          "DEPARTMENT",

        permittedGates:
          link.permittedGates || [],

        /*
         * Populated only when the vendor selects gates.
         */
        availableGates,

        requiresTrafficApproval:
          link.requiresTrafficApproval,

        hasWorkOrder:
          link.hasWorkOrder,

        referenceDocumentNo:
          link.referenceDocumentNo,

        totalVendorSubmissions:
          Number(
            link.totalVendorSubmissions
          ),

        vendorRequestLimit:
          Number(link.vendorRequestLimit),

        canSubmit:
          link.withinValidity &&
          Number(
            link.totalVendorSubmissions
          ) <
            Number(
              link.vendorRequestLimit
            ),
      },
    });
  } catch (error) {
    console.error(
      "Get public vendor material link error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load the application link.",
    });
  }
};

exports.listLinks = async (req, res) => {
  try {
    if (!req.user?.departmentId) {
      return res.status(403).json({
        success: false,
        message:
          "A valid department user is required.",
      });
    }

    const pagination = getPagination(req.query);

    const result =
      await VendorMaterialLink.list({
        ...pagination,
        departmentId:
          req.user.departmentId,

        createdByUserId:
          req.query.scope === "mine"
            ? req.user.userId
            : undefined,
      });

    const rows = result.rows.map((row) => {
      let vendorLink = null;

      /*
       * Only authenticated department users receive a
       * reconstructed public link.
       */
      if (row.status === "ACTIVE") {
        try {
          vendorLink = buildPublicLink(
            decryptToken(row.tokenCipher)
          );
        } catch (error) {
          console.error(
            `Unable to decrypt token for vendor material link ${row.id}:`,
            error
          );
        }
      }

      return {
        id: row.id,
        referenceNo: row.referenceNo,

        companyName: row.companyName,
        vendorEmail: row.vendorEmail,
        vendorMobile: row.vendorMobile,

        purpose: row.purpose,

        validFrom: row.validFrom,
        validTo: row.validTo,

        permittedGates:
          row.permittedGates || [],

        requestCount:
          Number(row.requestCount || 0),

        status: row.status,

        createdByUserName:
          row.createdByUserName,

        departmentName:
          row.departmentName,

        createdAt: row.createdAt,
        lastEmailSentAt:
          row.lastEmailSentAt,

        vendorLink,

        gateSelectionMode:
          row.gateSelectionMode,

        requiresTrafficApproval:
          row.requiresTrafficApproval,
      };
    });

    return res.status(200).json(
      buildPaginatedResponse(
        rows,
        {
          total: result.total,
        },
        result.total,
        pagination.page,
        pagination.limit
      )
    );
  } catch (error) {
    console.error(
      "List vendor material links error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load vendor material application links.",
    });
  }
};

exports.resendLink = async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid link ID.",
      });
    }

    const link =
      await VendorMaterialLink.getOwnedById(
        id,
        req.user.departmentId
      );

    if (!link) {
      return res.status(404).json({
        success: false,
        message:
          "Vendor material link not found.",
      });
    }

    if (link.status !== "ACTIVE") {
      return res.status(409).json({
        success: false,
        message:
          `The link cannot be resent because its status is ${link.status}.`,
      });
    }

    let rawToken;

    try {
      rawToken = decryptToken(
        link.tokenCipher
      );
    } catch (error) {
      console.error(
        "Vendor material token decryption failed:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "The stored link token could not be recovered.",
      });
    }

    const emailSent = await sendLinkEmail({
      vendorEmail: link.vendorEmail,
      companyName: link.companyName,
      referenceNo: link.referenceNo,
      departmentName:
        link.departmentName,
      validFrom: link.validFrom,
      validTo: link.validTo,
      rawToken,
    });

    if (!emailSent) {
      return res.status(502).json({
        success: false,
        message:
          "The link is valid, but the email service could not deliver it.",
      });
    }

    try {
      await VendorMaterialLink.markEmailSent(
        link.id
      );
    } catch (markError) {
      console.error(
        "Failed to update lastEmailSentAt after resend:",
        markError
      );
    }

    return res.status(200).json({
      success: true,
      message:
        "Vendor material application link sent successfully.",
    });
  } catch (error) {
    console.error(
      "Resend vendor material link error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to resend the vendor material link.",
    });
  }
};

exports.revokeLink = async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid link ID.",
      });
    }

    const existing =
      await VendorMaterialLink.getOwnedById(
        id,
        req.user.departmentId
      );

    if (!existing) {
      return res.status(404).json({
        success: false,
        message:
          "Vendor material link not found.",
      });
    }

    if (existing.status !== "ACTIVE") {
      return res.status(409).json({
        success: false,
        message:
          `Only active links can be revoked. Current status: ${existing.status}.`,
      });
    }

    const updated =
      await VendorMaterialLink.revoke({
        id,
        departmentId:
          req.user.departmentId,
        revokedByUserId:
          req.user.userId,
        reason: req.body.reason,
      });

    if (!updated) {
      return res.status(409).json({
        success: false,
        message:
          "The link is no longer active.",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Vendor material application link revoked successfully.",
    });
  } catch (error) {
    console.error(
      "Revoke vendor material link error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to revoke the vendor material link.",
    });
  }
};

exports.submitVendorMaterialRequest = async (req, res) => {
  try {
    const token = String(
      req.params.token || ""
    ).trim();

    if (
      !/^[A-Za-z0-9_-]{43}$/.test(
        token
      )
    ) {
      return res.status(410).json({
        success: false,
        message:
          "This application link is unavailable.",
      });
    }

    const result =
      await VendorMaterialLink
        .createVendorMaterialRequest(
          hashToken(token),
          req.body
        );

    return res.status(201).json({
      success: true,
      message:
        "Material pass request submitted successfully.",
      data: {
        requestId: result.id,
        referenceNumber:
          result.referenceNumber,
      },
    });
  } catch (error) {
    if (
      error instanceof VendorMaterialLink.SubmissionError
    ) {
      return res
        .status(error.status)
        .json({
          success: false,
          message:
            error.message,
        });
    }

    console.error(
      "Vendor material submission error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to submit the material pass request.",
    });
  }
};

exports.listPublicSubmittedRequests = async (req, res) => {
  try {
    const token = String(req.params.token || "").trim();

    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
      return res.status(410).json({
        success: false,
        message: "This application link is unavailable.",
      });
    }

    const allowedStatuses = new Set([
      "ALL",
      "PENDING",
      "REVERTED",
      "APPROVED",
      "REJECTED",
    ]);

    if (
      req.query.search !== undefined &&
      typeof req.query.search !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid search value.",
      });
    }

    if (
      req.query.status !== undefined &&
      typeof req.query.status !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid status filter.",
      });
    }

    const search = (req.query.search || "").trim();
    const status = (req.query.status || "ALL").toUpperCase();

    if (search.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Search must be 100 characters or fewer.",
      });
    }

    if (!allowedStatuses.has(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status filter.",
      });
    }

    // Keep page and limit aligned with the shared pagination utility.
    // Sorting is deliberately fixed to newest submissions first.
    const { page, limit } = getPagination(req.query);

    const result =
      await VendorMaterialLink.listPublicSubmittedRequests({
        tokenHash: hashToken(token),
        page,
        limit,
        search,
        status,
      });

    if (!result) {
      return res.status(410).json({
        success: false,
        message: "This application link is unavailable.",
      });
    }

    const response = buildPaginatedResponse(
      result.rows,
      result.counts,
      result.total,
      page,
      limit
    );

    return res.status(200).json(response);
  } catch (error) {
    console.error(
      "List public vendor material requests error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to load submitted requests.",
    });
  }
};

function maskEmail(email) {
  const [localPart, domain] =
    String(email || "").split("@");

  if (!localPart || !domain) {
    return "";
  }

  const visible =
    localPart.slice(0, Math.min(2, localPart.length));

  return `${visible}${"*".repeat(
    Math.max(localPart.length - visible.length, 3)
  )}@${domain}`;
}

function maskMobile(mobile) {
  const value = String(mobile || "");

  if (value.length < 4) {
    return "******";
  }

  return `${"*".repeat(
    value.length - 4
  )}${value.slice(-4)}`;
}