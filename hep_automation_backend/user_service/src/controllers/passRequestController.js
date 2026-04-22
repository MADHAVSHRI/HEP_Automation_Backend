const fs = require("fs");
const path = require("path");
const {
  PASS_TYPES,
  NATIONALITIES,
  ID_PROOF_TYPES,
  ACCESS_AREAS
} = require("../constants/constants");
const { Designation, vehicleTypes, PassRequest, hepTypes, 
        countries, visitPurpose, getPassRequest, Master, getAgentPassRequestsDetails, viewPassRequestsDocuments } = require("../models/passRequestSchema");

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
            if (err) console.error("File delete error:", err);
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
      message: "Failed to create pass request"
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

    const { passRequestId, documentType } = req.query;

    if (!passRequestId || !documentType) {
      return res.status(400).json({
        success: false,
        message: "passRequestId and documentType required"
      });
    }

    const fileData = await viewPassRequestsDocuments.getPassDocumentPath(passRequestId, documentType);

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
  viewPassRequestsDocument

};
