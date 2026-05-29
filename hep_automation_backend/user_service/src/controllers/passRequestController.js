const fs = require("fs");
const path = require("path");
const {
  PASS_TYPES,
  NATIONALITIES,
  ID_PROOF_TYPES,
  ACCESS_AREAS
} = require("../constants/constants");
const passRequestService = require("../services/passRequestService");
const { Designation, vehicleTypes, PassRequest, hepTypes,
        countries, visitPurpose, getPassRequest, Master, getAgentPassRequestsDetails, viewPassRequestsDocuments } = require("../models/passRequestSchema");
const { pool } = require("../dbconfig/db");

const getNationalities = (req, res) => {
  const sorted = NATIONALITIES.slice().sort((a, b) =>
    a.label.localeCompare(b.label),
  );

  res.json(sorted);
};

const getPassTypes = (req, res) => {
  const sorted = PASS_TYPES.slice().sort((a, b) =>
    a.label.localeCompare(b.label),
  );

  res.json(sorted);
};

const getIdProofTypes = (req, res) => {
  const sorted = ID_PROOF_TYPES.slice().sort((a, b) =>
    a.label.localeCompare(b.label),
  );

  res.json(sorted);
};

const getAccessAreas = (req, res) => {
  const sorted = ACCESS_AREAS.slice().sort((a, b) =>
    a.label.localeCompare(b.label),
  );

  res.json(sorted);
};

const getDesignations = async (req, res) => {
  try {
    const designations = await Designation.getAllDesignations();

    res.status(200).json({
      success: true,
      data: designations,
    });
  } catch (error) {
    console.error("Designation Fetch Error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getvehicleTypes = async (req, res) => {
  try {
    const types = await vehicleTypes.getAllVehicleTypes();

    res.status(200).json({
      success: true,
      data: types,
    });
  } catch (error) {
    console.error("Vehicle Types Fetch Error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getHepTypes = async (req, res) => {
  try {
    const types = await hepTypes.getAllHepTypes();

    res.status(200).json({
      success: true,
      data: types,
    });
  } catch (error) {
    console.error("Hep Types Fetch Error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getCountries = async (req, res) => {
  try {
    const countryList = await countries.getAllCountries();

    res.status(200).json({
      success: true,
      data: countryList,
    });
  } catch (error) {
    console.error("Countries Fetch Error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getVisitPurposes = async (req, res) => {
  try {
    const purposes = await visitPurpose.getAllVisitPurposes();

    res.status(200).json({
      success: true,
      data: purposes,
    });
  } catch (error) {
    console.error("Visit Purposes Fetch Error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const createPassRequest = async (req, res) => {

  const deleteFiles = () => {
    const files = req.files || {};

    Object.values(files).forEach((fileArray) => {
      fileArray.forEach((file) => {
        if (fs.existsSync(file.path)) {
          fs.unlink(file.path, (err) => {
            if(err && err.code !== "ENOENT"){
              console.error("File delete error:",err);
            }
          });
        }
      });
    });
  };

  try {

    const payload = JSON.parse(req.body.payload);

    payload.agentId = req.user.userId; // from JWT


    /* ===== CHANGE START =====
       Normalize passType values coming from frontend
       Frontend sometimes sends YEARLY but DB expects ANNUAL
    ===== */

    const normalizePassType = (type) => {

      if (!type) return null;

      const map = {
        DAILY: "DAILY",
        MONTHLY: "MONTHLY",
        ANNUAL: "YEARLY",
        YEARLY: "YEARLY",
        1: "DAILY",
        2: "MONTHLY",
        3: "YEARLY"
      };

      return map[type] || type;

    };

    /* ===== CHANGE END ===== */


    /* ===== CHANGE START =====
       Normalize passType for persons
    ===== */

    if (payload.persons && Array.isArray(payload.persons)) {

      payload.persons = payload.persons.map((p) => ({
        ...p,
        passType: normalizePassType(p.passType)
      }));

    }

    /* ===== CHANGE END ===== */


    /* ===== CHANGE START =====
       Normalize passType for vehicles
    ===== */

    if (payload.vehicles && Array.isArray(payload.vehicles)) {

      payload.vehicles = payload.vehicles.map((v) => ({
        ...v,
        passType: normalizePassType(v.passType)
      }));

    }

    /* ===== CHANGE END ===== */


    const passRequestId = await PassRequest.createPassRequest(
      payload,
      req.files
    );


    res.status(201).json({
      success: true,
      message: "Pass request submitted successfully",
      passRequestId
    });

  } catch (error) {

    deleteFiles();

    console.error("Pass Request Error:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Failed to create pass request"
    });

  }

};

const getAgentPassRequests = async (req, res) => {
  try {

    const agentId = req.user.userId; // from JWT

    const passes = await getPassRequest.getAgentPassRequests(agentId);

    return res.status(200).json({
      success: true,
      data: passes
    });

  } catch (error) {

    console.error("Fetch pass requests error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });

  }
};

const getMasterDirectory = async (req, res) => {
  try {

    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    const agentId = req.user.userId;

    const [
      persons,
      vehicles,
      personCount,
      vehicleCount
    ] = await Promise.all([
      Master.getPersonsByAgent(agentId),
      Master.getVehiclesByAgent(agentId),
      Master.getPersonCount(agentId),
      Master.getVehicleCount(agentId)
    ]);

    return res.status(200).json({
      success: true,
      data: {
        persons,
        vehicles,
        personCount,
        vehicleCount
      }
    });

  } catch (error) {

    console.error("Fetch directory error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });

  }
};

const getAgentPassRequestsToApproverAdmin = async (req, res) => {

  try {

    const role = req.user.role;
    const departmentId = req.user.departmentId;

    const passes = await getAgentPassRequestsDetails.getAgentPassRequestsToApproverAdmin(role, departmentId);

    return res.status(200).json({
      success: true,
      data: passes
    });

  } catch (error) {

    console.error("Approval pass fetch error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });

  }

};

const viewPassRequestsDocument = async (req, res) => {
  try {

    const { passRequestId, documentType, entityIndex, isVendorPass } = req.query;

    if (!passRequestId || !documentType) {
      return res.status(400).json({
        success: false,
        message: "passRequestId and documentType required"
      });
    }

    const fileData = await viewPassRequestsDocuments.getPassDocumentPath(
      passRequestId,
      documentType,
      entityIndex ? parseInt(entityIndex) : 0,
      isVendorPass === 'true'
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
    const pathExt = path.extname(absolutePath).toLowerCase();
    let contentType = "application/octet-stream";

    if (pathExt === ".pdf") contentType = "application/pdf";
    if (pathExt === ".jpg" || pathExt === ".jpeg") contentType = "image/jpeg";
    if (pathExt === ".png") contentType = "image/png";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", "inline");

    const stream = fs.createReadStream(absolutePath);

    stream.on("error", (error) => {
      console.error("Stream error:", error);
      res.status(500).end("Error reading file");
    });

    stream.pipe(res);

  } catch (error) {

    console.error("View pass request document error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error"
    });

  }
};

const approvePerson = async(req,res)=>{

  try{

    const {personId} = req.body;

    const person = await PassRequest.approvePerson(personId);

    return res.json({
      success:true,
      data:person
    });

  }catch(error){

    console.error(error);

    res.status(500).json({
      success:false,
      message:"Internal server error"
    });

  }

}

const rejectPerson = async(req,res)=>{

  try{

    const {personId, rejectedReason} = req.body;

    const person = await PassRequest.rejectPerson(personId, rejectedReason);

    return res.json({
      success:true,
      data:person
    });

  }catch(error){

    console.error(error);

    res.status(500).json({
      success:false,
      message:"Internal server error"
    });

  }

}

const approveVehicle = async(req,res)=>{

  try{

    const {vehicleId} = req.body;

    const vehicle = await PassRequest.approveVehicle(vehicleId);

    return res.json({
      success:true,
      data:vehicle
    });

  }catch(error){

    console.error(error);

    res.status(500).json({
      success:false,
      message:"Internal server error"
    });

  }

}

const rejectVehicle = async(req,res)=>{

  try{

    const {vehicleId, rejectedReason} = req.body;

    const vehicle = await PassRequest.rejectVehicle(vehicleId, rejectedReason);

    return res.json({
      success:true,
      data:vehicle
    });

  }catch(error){

    console.error(error);

    res.status(500).json({
      success:false,
      message:"Internal server error"
    });

  }

}

const revertPerson = async(req,res)=>{

  try{

    const {personId, revertReason} = req.body;

    if(!revertReason){
      return res.status(400).json({
        success:false,
        message:"Revert reason is required"
      });
    }

    const person = await PassRequest.revertPerson(personId, revertReason);

    return res.json({
      success:true,
      data:person
    });

  }catch(error){

    console.error(error);

    res.status(500).json({
      success:false,
      message:"Internal server error"
    });

  }

}

const revertVehicle = async(req,res)=>{

  try{

    const {vehicleId, revertReason} = req.body;

    if(!revertReason){
      return res.status(400).json({
        success:false,
        message:"Revert reason is required"
      });
    }

    const vehicle = await PassRequest.revertVehicle(vehicleId, revertReason);

    return res.json({
      success:true,
      data:vehicle
    });

  }catch(error){

    console.error(error);

    res.status(500).json({
      success:false,
      message:"Internal server error"
    });

  }

}

const completeReview = async(req,res)=>{

  try{

    const {passRequestId} = req.body;

    const result = await PassRequest.completePassReview(passRequestId);

    return res.json({
      success:true,
      data:result
    });

  }catch(error){

    console.error(error);

    res.status(500).json({
      success:false,
      message:error.message
    });

  }

}


// const getQrData = async (req, res) => {
//   try {

//     const { passRequestId } = req.params;

//     const data = await passRequestService.getQrData(passRequestId);

//     return res.json(data);

//   } catch (error) {

//     console.error("QR DATA ERROR", error);

//     return res.status(500).json({
//       success:false,
//       message:error.message
//     });

//   }
// };


const getQrData = async (req, res) => {
  try {

    const { passRequestId } = req.params;

    // NEW
    const { type, entityId } = req.query;

    const data = await passRequestService.getQrData(
      passRequestId,
      type,
      entityId
    );

    return res.json(data);

  } catch (error) {

    console.error("QR DATA ERROR", error);

    return res.status(500).json({
      success:false,
      message:error.message
    });

  }
};


const getVendorQrData = async (req, res) => {
  try {
    const { vendorPassId } = req.params;

    const data = await passRequestService.getVendorQrData(vendorPassId);

    return res.json(data);

  } catch (error) {
    console.error("VENDOR QR DATA ERROR", error);

    if (error.message === "No approved vendor pass found") {
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

const getPassDetails = async (req, res) => {
  try {
    const { passRequestId } = req.params;

    const passData = await getAgentPassRequestsDetails.getPassById(passRequestId);

    if (!passData) {
      return res.status(404).json({
        success: false,
        message: "Pass request not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: passData
    });

  } catch (error) {
    console.error("GET PASS DETAILS ERROR", error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================
// PHASE 2: EDIT AND RESUBMIT REVERTED PASSES
// ============================================

const updatePassPerson = async (req, res) => {
  try {
    const { personId } = req.params;
    const updateData = req.body;

    const { PassRequest } = require("../models/passRequestSchema");

    const result = await PassRequest.updateRevertedPerson(personId, updateData);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }

    return res.status(200).json({
      success: true,
      message: "Person updated successfully",
      data: result.data
    });

  } catch (error) {
    console.error("UPDATE PASS PERSON ERROR", error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const updatePassVehicle = async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const updateData = req.body;

    console.log('UPDATE VEHICLE - vehicleId:', vehicleId);
    console.log('UPDATE VEHICLE - updateData:', updateData);

    const { PassRequest } = require("../models/passRequestSchema");

    const result = await PassRequest.updateRevertedVehicle(vehicleId, updateData);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }

    return res.status(200).json({
      success: true,
      message: "Vehicle updated successfully",
      data: result.data
    });

  } catch (error) {
    console.error("UPDATE PASS VEHICLE ERROR", error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const resubmitRevertedPass = async (req, res) => {
  try {
    const { passRequestId } = req.params;

    const { PassRequest } = require("../models/passRequestSchema");

    const result = await PassRequest.resubmitRevertedPassRequest(passRequestId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }

    return res.status(200).json({
      success: true,
      message: "Pass resubmitted successfully",
      data: result.data
    });

  } catch (error) {
    console.error("RESUBMIT REVERTED PASS ERROR", error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const validateQrPass = async (req, res) => {
  try {
    const { passNo } = req.params;
    if (!passNo) {
      return res.status(400).json({
        success: false,
        message: "passNo is required"
      });
    }

    const now = new Date();

    // 1. Try normal pass persons
    const personQuery = `
      SELECT pp.id, pp.name, pp.mobile, pp."aadharNo", pp."personPassNo",
             pp."dateFrom", pp."dateTo", pp.status,
             a."entityName" AS company,
             'person' AS entityType,
             pr."referenceNo"
      FROM pass_persons pp
      JOIN pass_requests pr ON pr.id = pp."passRequestId"
      JOIN "Agents" a ON a.id = pr."agentId"
      WHERE pp."personPassNo" = $1
    `;
    const personResult = await pool.query(personQuery, [passNo]);
    if (personResult.rows.length > 0) {
      const row = personResult.rows[0];
      if (row.status !== 'approved') {
        return res.status(403).json({
          success: false,
          valid: false,
          message: "Pass is not approved",
          data: { status: row.status }
        });
      }
      if (row.dateTo && new Date(row.dateTo) < now) {
        return res.status(403).json({
          success: false,
          valid: false,
          message: "Pass has expired",
          data: { validTo: row.dateTo }
        });
      }
      return res.status(200).json({
        success: true,
        valid: true,
        message: "Pass is valid",
        data: {
          entityType: 'person',
          passNo: row.personPassNo,
          name: row.name,
          company: row.company,
          referenceNo: row.referenceNo,
          validFrom: row.dateFrom,
          validTo: row.dateTo,
        }
      });
    }

    // 2. Try normal pass vehicles
    const vehicleQuery = `
      SELECT pv.id, pv."registrationNo", pv."vehiclePassNo",
             pv."dateFrom", pv."dateTo", pv.status,
             a."entityName" AS company,
             'vehicle' AS entityType,
             pr."referenceNo"
      FROM pass_vehicles pv
      JOIN pass_requests pr ON pr.id = pv."passRequestId"
      JOIN "Agents" a ON a.id = pr."agentId"
      WHERE pv."vehiclePassNo" = $1
    `;
    const vehicleResult = await pool.query(vehicleQuery, [passNo]);
    if (vehicleResult.rows.length > 0) {
      const row = vehicleResult.rows[0];
      if (row.status !== 'approved') {
        return res.status(403).json({
          success: false,
          valid: false,
          message: "Pass is not approved",
          data: { status: row.status }
        });
      }
      if (row.dateTo && new Date(row.dateTo) < now) {
        return res.status(403).json({
          success: false,
          valid: false,
          message: "Pass has expired",
          data: { validTo: row.dateTo }
        });
      }
      return res.status(200).json({
        success: true,
        valid: true,
        message: "Pass is valid",
        data: {
          entityType: 'vehicle',
          passNo: row.vehiclePassNo,
          registrationNo: row.registrationNo,
          company: row.company,
          referenceNo: row.referenceNo,
          validFrom: row.dateFrom,
          validTo: row.dateTo,
        }
      });
    }

    // 3. Try vendor pass persons
    const vpPersonQuery = `
      SELECT vp.id, vp.name, vp.mobile, vp."aadharNo", vp."personPassNo",
             vp."dateFrom", vp."dateTo", vp.status,
             vpr."companyName" AS company,
             'vendor-person' AS entityType,
             vpr."referenceNo"
      FROM vendor_pass_persons vp
      JOIN vendor_pass_requests vpr ON vpr.id = vp."vendorPassRequestId"
      WHERE vp."personPassNo" = $1
    `;
    const vpPersonResult = await pool.query(vpPersonQuery, [passNo]);
    if (vpPersonResult.rows.length > 0) {
      const row = vpPersonResult.rows[0];
      if (row.status !== 'approved') {
        return res.status(403).json({
          success: false,
          valid: false,
          message: "Pass is not approved",
          data: { status: row.status }
        });
      }
      if (row.dateTo && new Date(row.dateTo) < now) {
        return res.status(403).json({
          success: false,
          valid: false,
          message: "Pass has expired",
          data: { validTo: row.dateTo }
        });
      }
      return res.status(200).json({
        success: true,
        valid: true,
        message: "Pass is valid",
        data: {
          entityType: 'vendor-person',
          passNo: row.personPassNo,
          name: row.name,
          company: row.company,
          referenceNo: row.referenceNo,
          validFrom: row.dateFrom,
          validTo: row.dateTo,
        }
      });
    }

    // 4. Try vendor pass vehicles
    const vpVehicleQuery = `
      SELECT vv.id, vv."vehicleRegistrationNo", vv."vehiclePassNo",
             vv."dateFrom", vv."dateTo", vv.status,
             vpr."companyName" AS company,
             'vendor-vehicle' AS entityType,
             vpr."referenceNo"
      FROM vendor_pass_vehicles vv
      JOIN vendor_pass_requests vpr ON vpr.id = vv."vendorPassRequestId"
      WHERE vv."vehiclePassNo" = $1
    `;
    const vpVehicleResult = await pool.query(vpVehicleQuery, [passNo]);
    if (vpVehicleResult.rows.length > 0) {
      const row = vpVehicleResult.rows[0];
      if (row.status !== 'approved') {
        return res.status(403).json({
          success: false,
          valid: false,
          message: "Pass is not approved",
          data: { status: row.status }
        });
      }
      if (row.dateTo && new Date(row.dateTo) < now) {
        return res.status(403).json({
          success: false,
          valid: false,
          message: "Pass has expired",
          data: { validTo: row.dateTo }
        });
      }
      return res.status(200).json({
        success: true,
        valid: true,
        message: "Pass is valid",
        data: {
          entityType: 'vendor-vehicle',
          passNo: row.vehiclePassNo,
          registrationNo: row.vehicleRegistrationNo,
          company: row.company,
          referenceNo: row.referenceNo,
          validFrom: row.dateFrom,
          validTo: row.dateTo,
        }
      });
    }

    // Pass not found
    return res.status(404).json({
      success: false,
      valid: false,
      message: "Pass not found"
    });

  } catch (error) {
    console.error("validateQrPass error:", error);
    return res.status(500).json({
      success: false,
      valid: false,
      message: error.message
    });
  }
};

const saveQrPdfPath = async (
  req,
  res
) => {
  try {

    const {
      type,
      entityId,
      qrPdfPath,
    } = req.body;

    const result =
      await passRequestService.saveQrPdfPath(
        type,
        entityId,
        qrPdfPath
      );

    return res.status(200).json({
      success: true,
      data: result,
    });

  } catch (err) {

    console.error(
      "SAVE QR PDF PATH ERROR",
      err
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to save qr pdf path",
    });
  }
};

const validateSecureQr = async (
  req,
  res
) => {
  try {
    const {
      entityId,
      passRequestId,
      qrUuid,
      type,
    } = req.body;

    if (
      !entityId ||
      !passRequestId ||
      !qrUuid ||
      !type
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Missing validation payload",
      });
    }

    const result =
      await passRequestService.validateQr({
        entityId,
        passRequestId,
        qrUuid,
        type,
      });

    return res.status(200).json({
      success: true,
      ...result,
    });

  } catch (error) {
    console.error(
      "VALIDATE QR ERROR",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getNationalities,
  getPassTypes,
  getIdProofTypes,
  getAccessAreas,
  getVisitPurposes,
  getDesignations,
  getvehicleTypes,
  createPassRequest,
  getHepTypes,
  getCountries,
  getAgentPassRequests,
  getMasterDirectory,
  getAgentPassRequestsToApproverAdmin,
  viewPassRequestsDocument,
  approvePerson,
  rejectPerson,
  revertPerson,
  approveVehicle,
  rejectVehicle,
  revertVehicle,
  completeReview,
  getQrData,
  getVendorQrData,
  getPassDetails,
  validateQrPass,
  // Phase 2: Edit and resubmit reverted passes
  updatePassPerson,
  updatePassVehicle,
  resubmitRevertedPass,
  saveQrPdfPath,
  validateSecureQr
};
