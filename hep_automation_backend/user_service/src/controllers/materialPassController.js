const fs = require("fs");
const path = require("path");

const { 
  portLocations,
  materialPassRequest,
  getMaterialPass,
  materialPassType,
  units
 } = require("../models/materialPassSchema");

const { getPagination, buildPaginatedResponse } = require("../utils/pagination");


exports.getPortLocations = async (req, res) => {
  try {
    const locations = await portLocations.getAllPortLocations();

    res.status(200).json({
      success: true,
      data: locations,
    });
  } catch (error) {
    console.error("Locations Fetch Error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.getRegularPassTypes = async (req, res) => {
  try {
    const passTypes = await materialPassType.getRegularPassTypes();

    res.status(200).json({
      success: true,
      data: passTypes,
    });
  } catch (error) {
    console.error("Pass Types Fetch Error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.getUnits = async (req, res) => {
  try {
    const unitList = await units.getAllUnits();

    res.status(200).json({
      success: true,
      data: unitList,
    });
  } catch (error) {
    console.error("Units Fetch Error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.createRegularMaterialPassRequest = async (req, res) => {

  const deleteFiles = () => {
    const files = req.files;
    if (!files) return;
    Object.values(files).forEach((arr) => {
      arr.forEach((file) => {
        if (file?.path && fs.existsSync(file.path)) {
          fs.unlink(file.path, (err) => {
            if (err && err.code !== "ENOENT") {
              console.error("File delete error:", err);
            }
          });
        }
      });
    });
  };

  try {
    const payload = req.body; // already parsed + zod-validated by the route middlewares

    payload.agentId = req.user.userId;

    const expiryDate = new Date(payload.entryDate);
    expiryDate.setDate(expiryDate.getDate() + 2);
    payload.expiryDate = expiryDate;

    const requisitionLetter = req.files?.materialPassRequisitionLetter?.[0];
    const workOrder = req.files?.materialPassWorkOrder?.[0];

    if (!requisitionLetter) {
      deleteFiles();
      return res.status(400).json({
        success: false,
        message: "Requisition Letter is mandatory.",
      });
    }

    payload.requisitionLetterFilePath = requisitionLetter.path;
    payload.requisitionLetterFileName = requisitionLetter.originalname;
    payload.workOrderFilePath = workOrder?.path || null;
    payload.workOrderFileName = workOrder?.originalname || null;

    // TODO: Check whether the requesting company is blacklisted.

    const passRequestId =
      await materialPassRequest.createRegularMaterialPass(payload);

    res.status(201).json({
      success: true,
      message: "Material pass request submitted successfully",
      passRequestId,
    });
  } catch (error) {
    deleteFiles();
    console.error("Material Pass Creation Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create material pass request",
    });
  }
};

exports.viewMaterialPassDocument = async (req, res) => {
  try {
    const { passRequestId, documentType } = req.query;

    if (!passRequestId || !documentType) {
      return res.status(400).json({
        success: false,
        message: "passRequestId and documentType required"
      });
    }

    const fileData = await materialPassRequest.getMaterialPassDocumentPath(
      passRequestId,
      documentType
    );

    if (!fileData) {
      return res.status(404).json({
        success: false,
        message: "Document not found"
      });
    }

    const filePath = Object.values(fileData)[0];

    if (!filePath) {
      return res.status(404).json({
        success: false,
        message: "File path not found"
      });
    }

    const absolutePath = path.join(process.cwd(), filePath);

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({
        success: false,
        message: "File missing on server"
      });
    }

    let contentType = "application/octet-stream";
    try {
      const fd = fs.openSync(absolutePath, "r");
      const buffer = Buffer.alloc(4);
      fs.readSync(fd, buffer, 0, 4, 0);
      fs.closeSync(fd);

      if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
        contentType = "application/pdf";
      } else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
        contentType = "image/png";
      } else if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
        contentType = "image/jpeg";
      } else {
        const pathExt = path.extname(absolutePath).toLowerCase();
        if (pathExt === ".pdf") contentType = "application/pdf";
        if (pathExt === ".jpg" || pathExt === ".jpeg") contentType = "image/jpeg";
        if (pathExt === ".png") contentType = "image/png";
      }
    } catch (err) {
      console.error("Error reading file magic bytes, falling back to extension:", err);
      const pathExt = path.extname(absolutePath).toLowerCase();
      if (pathExt === ".pdf") contentType = "application/pdf";
      if (pathExt === ".jpg" || pathExt === ".jpeg") contentType = "image/jpeg";
      if (pathExt === ".png") contentType = "image/png";
    }

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", "inline");

    const stream = fs.createReadStream(absolutePath);

    stream.on("error", (error) => {
      console.error("Stream error:", error);
      res.status(500).end("Error reading file");
    });

    stream.pipe(res);

  } catch (error) {
    console.error("View material pass request document error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

exports.getMaterialPassRequests = async (req, res) => {
  try {
    const agentId = req.user.userId;

    const {
      page = 1,
      limit = 10,
      search,
      status,
      movement,
      dateFrom,
      dateTo,
    } = req.query;

    const { rows, pagination, counts } =
      await getMaterialPass.getSubmittedMaterialPassRequests(agentId, {
        page,
        limit,
        search,
        status,
        movement,
        dateFrom,
        dateTo,
      });

    res.status(200).json({
      success: true,
      data: rows,
      pagination,
      counts,
    });
  } catch (error) {
    console.error("submittedRequests Fetch Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.getMaterialPassRequestsToApproverAdmin = async (req, res) => {
  try {
    // Allow null/"null" departmentId for Admin users — they see all departments
    const rawId = req.params.departmentId;
    const departmentId = (rawId && rawId !== "null" && rawId !== "undefined")
      ? Number(rawId)
      : null;

    // Only reject if an id was provided but is not a valid number
    if (rawId && rawId !== "null" && rawId !== "undefined" && !departmentId) {
      return res.status(400).json({
        success: false,
        message: "Invalid department id",
      });
    }

    // Parse pagination + search/sort/filter params from query string
    const pag = getPagination(req.query);

    const userId = req.query.userId ? Number(req.query.userId) : null;
    const processedByMe =
      req.query.processedByMe === "true" || req.query.processedByMe === true;

    const result = await getMaterialPass.getMaterialPassRequestsToApproverAdmin(
      departmentId,
      {
        ...pag,
        processedByMe,
        userId,
      }
    );

    // Compute the correct total records for the active tab (pending vs processed)
    let totalRecordsForTab = result.counts.total;
    if (pag.status === "pending") {
      totalRecordsForTab = result.counts.pending;
    } else if (pag.status === "processed") {
      totalRecordsForTab = result.counts.processed;
    }


    return res.status(200).json(
      buildPaginatedResponse(
        result.data,
        result.counts,
        totalRecordsForTab,
        pag.page,
        pag.limit
      )
    );
  } catch (error) {
    console.error("Material Pass Requests Fetch Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/*
=====================================================
COMPLETE MATERIAL PASS REVIEW
Bundles returnable + non-returnable decisions into one
call.
=====================================================
*/
exports.completeMaterialPassReview = async (req, res) => {
  try {

    const { passRequestId, passes } = req.body;
    const userId = req.user ? req.user.userId : null;

    if (!passRequestId) {
      return res.status(400).json({
        success: false,
        message: "passRequestId is required"
      });
    }

    if (!Array.isArray(passes) || passes.length === 0) {
      return res.status(400).json({
        success: false,
        message: "passes array is required and must contain at least one pass"
      });
    }

    const result = await materialPassRequest.completeMaterialPassReview(
      passRequestId,
      passes,
      userId
    );

    return res.json({
      success: true,
      data: result
    });

  } catch (error) {

    console.error("Complete Material Pass Review Error:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
};

/*
=====================================================
GET MATERIAL PASS DETAILS
=====================================================
*/
exports.getMaterialPassDetails = async (req, res) => {
  try {
    const { passRequestId } = req.params;

    const passData = await getMaterialPass.getMaterialPassById(passRequestId);

    if (!passData) {
      return res.status(404).json({
        success: false,
        message: "Material pass request not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: passData
    });

  } catch (error) {
    console.error("GET MATERIAL PASS DETAILS ERROR", error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.getMaterialQrData = async (req, res) => {
  try {
    const { passRequestId } = req.params;
    const { type, passId } = req.query;

    const data = await getMaterialPass.getMaterialQrData(
      passRequestId,
      type,
      passId
    );

    return res.json(data);
  } catch (error) {
    console.error("MATERIAL QR DATA ERROR", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// controller
exports.saveMaterialQrPdfPath = async (req, res) => {
  try {
    const { passId, qrPdfPath } = req.body;

    const result = await materialPassRequest.saveMaterialQrPdfPath(
      passId,
      qrPdfPath
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error("SAVE MATERIAL QR PDF PATH ERROR", err);

    return res.status(500).json({
      success: false,
      message: "Failed to save qr pdf path",
    });
  }
};


exports.resubmitRevertedMaterialPass = async (req, res) => {
  try {
    const passRequestId = Number(req.params.passRequestId);
    const agentId = req.user.userId;

    if (!passRequestId) {
      return res.status(400).json({
        success: false,
        message: "Invalid pass request id",
      });
    }

    // req.body is already validated + shaped by resubmitRevertedPassSchema —
    // only { returnable?, nonReturnable? } keys with valid material arrays
    // reach this point.
    const passes = req.body;

    const result = await materialPassRequest.resubmitRevertedMaterialPass(
      passRequestId,
      agentId,
      passes
    );

    return res.status(200).json({
      success: true,
      message: "Material pass resubmitted successfully",
      data: result,
    });
  } catch (error) {
    console.error("Resubmit Reverted Material Pass Error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to resubmit material pass",
    });
  }
};

