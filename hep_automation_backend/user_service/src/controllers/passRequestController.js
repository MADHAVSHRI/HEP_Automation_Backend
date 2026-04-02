const {
  PASS_TYPES,
  NATIONALITIES,
  ID_PROOF_TYPES,
  ACCESS_AREAS,
} = require("../constants/constants");
const { Designation, vehicleTypes, PassRequest } = require("../models/passRequestSchema");

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



const createPassRequest = async (req, res) => {
  try {

    const payload = JSON.parse(req.body.payload);

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

    console.error("Pass Request Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create pass request"
    });

  }
};




module.exports = {
  getNationalities,
  getPassTypes,
  getIdProofTypes,
  getAccessAreas,
  getDesignations,
  getvehicleTypes,
  createPassRequest
};
