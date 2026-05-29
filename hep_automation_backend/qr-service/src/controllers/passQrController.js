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