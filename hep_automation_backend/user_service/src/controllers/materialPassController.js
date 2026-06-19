const portLocations = require("../models/materialPassSchema");

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