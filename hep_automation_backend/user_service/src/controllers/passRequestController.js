const fs = require("fs");
const path = require("path");
const {
  PASS_TYPES,
  NATIONALITIES,
  ID_PROOF_TYPES,
  ACCESS_AREAS
} = require("../constants/constants");
const { Designation, vehicleTypes, PassRequest, hepTypes, 
        countries, visitPurpose, getPassRequest, Master, getAgentPassRequestsDetails } = require("../models/passRequestSchema");

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
  getAgentPassRequestsToApproverAdmin

};
