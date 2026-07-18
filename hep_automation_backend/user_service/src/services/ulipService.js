const axios = require("axios");
const ulipConfig = require("../config/ulipConfig");

const headers = {
  Authorization: `Bearer ${ulipConfig.token}`,
  "Content-Type": "application/json",
  Accept: "application/json",
};

const verifyVehicle = async (vehicleNumber) => {
  try {
    const response = await axios.post(
      `${ulipConfig.baseURL}/VAHAN/04`,
      {
        vehiclenumber: vehicleNumber,
      },
      { headers }
    );

    return response.data;
  } catch (error) {
    console.error("VAHAN ERROR:", error.response?.data || error.message);

    throw {
      status: error.response?.status || 500,
      message:
        error.response?.data?.message ||
        "Unable to verify vehicle registration number.",
    };
  }
};

const verifyDL = async (dlNumber) => {
  try {
    const response = await axios.post(
      `${ulipConfig.baseURL}/SARATHI/02`,
      {
        dlnumber: dlNumber,
      },
      { headers }
    );

    return response.data;
  } catch (error) {
    console.error("SARATHI ERROR:", error.response?.data || error.message);

    console.log("========== ULIP ERROR ==========");
    console.log("Status :", error.response?.status);
    console.log("Headers :", error.response?.headers);
    console.log("Response :", error.response?.data);
    console.log("Config :", error.config?.url);
    console.log("================================");

    throw error;


    throw {
      status: error.response?.status || 500,
      message:
        error.response?.data?.message ||
        "Unable to verify driving licence.",
    };
  }
};

module.exports = {
  verifyVehicle,
  verifyDL,
};