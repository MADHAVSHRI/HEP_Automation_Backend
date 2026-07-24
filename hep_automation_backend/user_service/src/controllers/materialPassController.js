
const { 
  portLocations,
  materialPassRequest,
  getMaterialPass,
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

exports.createRegularMaterialPassRequest = async (req, res) => {
  try {
    const payload = req.body;

    // Agent ID from JWT
    payload.agentId = req.user.userId;
    // payload.agentId = req?.user?.userId || 1;

    // Expiry Date = Entry Date + 2 days
    const expiryDate = new Date(payload.entryDate);
    expiryDate.setDate(expiryDate.getDate() + 2);

    payload.expiryDate = expiryDate;

    // TODO: Check whether the requesting company is blacklisted.

    const passRequestId =
      await materialPassRequest.createRegularMaterialPass(payload);
    


    res.status(201).json({
      success: true,
      message: "Material pass request submitted successfully",
      passRequestId,
    });
  } catch (error) {

    console.error(
      "Material Pass Creation Error:",
      error
    );

    res.status(500).json({
      success: false,
      message: error.message || "Failed to create material pass request",
    });
  }
}

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
    const departmentId = Number(req.params.departmentId);

    if (!departmentId) {
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


