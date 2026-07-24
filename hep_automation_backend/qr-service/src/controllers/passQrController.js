const passQrService = require("../services/passQrService");

exports.generatePassQR = async (req, res) => {
  try {
    const { passRequestId } = req.params;

    // NEW
    const { type, entityId } = req.query;

    if (!passRequestId) {
      return res.status(400).json({
        success: false,
        message: "passRequestId required",
      });
    }

    const token = req.headers.authorization;

    // MODIFIED
    const pdfBuffer = await passQrService.generatePass(
      passRequestId,
      token,
      type,
      entityId
    );

    res.setHeader("Content-Type", "application/pdf");

    return res.send(pdfBuffer);
  } catch (error) {
    if (error.message === "No approved passes found") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.validateQr = async (
  req,
  res
) => {
  try {
    const { qrToken } = req.body;

    if (!qrToken) {
      return res.status(400).json({
        success: false,
        message: "qrToken required",
      });
    }

    const result =
      await passQrService.validateQr(
        qrToken
      );

    return res.status(200).json(
      result
    );

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.generateMaterialPassQr = async (req, res) => {
  try {
    const { passRequestId } = req.params;
    const { type, passId } = req.query;

    if (!passRequestId) {
      return res.status(400).json({
        success: false,
        message: "passRequestId required",
      });
    }

    const token = req.headers.authorization;

    const pdfBuffer =
      await passQrService.generateMaterialPass(
        passRequestId,
        token,
        type,
        passId
      );

    res.setHeader("Content-Type", "application/pdf");

    return res.send(pdfBuffer);
  } catch (error) {

    if (error.message === "Approved material pass not found") {
      return res.status(404).json({
        success:false,
        message:error.message,
      });
    }

    return res.status(500).json({
      success:false,
      message:error.message,
    });
  }
};


// const passQrService = require("../services/passQrService");

// exports.generatePassQR = async (req,res) => {

//   try{

//     const { passRequestId } = req.params;

//     if(!passRequestId){
//       return res.status(400).json({
//         success:false,
//         message:"passRequestId required"
//       });
//     }

//     const token = req.headers.authorization;

//     const pdfBuffer = await passQrService.generatePass(passRequestId, token);

//     res.setHeader("Content-Type","application/pdf");

//     return res.send(pdfBuffer);

//   }
//   catch(error){

//     if(error.message === "No approved passes found"){
//         return res.status(404).json({
//         success:false,
//         message:error.message
//         });
//     }

//     return res.status(500).json({
//         success:false,
//         message:error.message
//     });
//     }

// };

exports.generateVendorQr = async (req, res) => {
  try {
    const { vendorPassId } = req.params;
    if (!vendorPassId) {
      return res.status(400).json({
        success: false,
        message: "vendorPassId required"
      });
    }
    const pdfBuffer = await passQrService.generateVendorPass(vendorPassId);
    res.setHeader("Content-Type", "application/pdf");
    return res.send(pdfBuffer);
  } catch (error) {
    if (error.message === "No approved vendor passes found") {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.generateVendorSingleQr = async (req, res) => {
  try {
    const { vendorPassId, entityType, entityIndex } = req.params;
    if (!vendorPassId || !entityType || entityIndex === undefined) {
      return res.status(400).json({
        success: false,
        message: "vendorPassId, entityType, and entityIndex are required"
      });
    }
    const pdfBuffer = await passQrService.generateVendorSinglePass(vendorPassId, entityType, entityIndex);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="VendorPass_${entityType}_${entityIndex}.pdf"`);
    return res.send(pdfBuffer);
  } catch (error) {
    if (error.message === "Person not found" || error.message === "Vehicle not found") {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


/*
============================================
BULK PASS QR CONTROLLERS
============================================
*/

// POST /api/qr/bulk-pass/:batchId
// Internal — called by approval-admin-service at approval time.
// Generates the QR PDF, stores it, and returns the PDF buffer plus the
// absolute file path via the X-Pdf-Path response header.
exports.generateBulkQr = async (req, res) => {
  try {
    const { batchId } = req.params;
    if (!batchId) {
      return res.status(400).json({ success: false, message: "batchId required" });
    }

    const { pdfBuffer, filePath } = await passQrService.generateBulkPass(batchId);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("X-Pdf-Path", filePath);
    res.setHeader("Access-Control-Expose-Headers", "X-Pdf-Path");
    return res.send(pdfBuffer);
  } catch (error) {
    if (error.message === "Batch not found") {
      return res.status(404).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/qr/bulk-pass-view/:batchId
// Public inline PDF viewer — only serves COMPLETED (approved) batches.
exports.viewBulkPass = async (req, res) => {
  try {
    const { batchId } = req.params;
    if (!batchId) {
      return res.status(400).json({ success: false, message: "batchId required" });
    }

    const { pdfBuffer } = await passQrService.generateBulkPass(batchId, {
      requireCompleted: true,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="BulkPass_${batchId}.pdf"`);
    return res.send(pdfBuffer);
  } catch (error) {
    if (error.message === "Batch not approved") {
      return res.status(403).json({ success: false, message: "This pass is not yet approved" });
    }
    if (error.message === "Batch not found") {
      return res.status(404).json({ success: false, message: "Pass not found" });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};
