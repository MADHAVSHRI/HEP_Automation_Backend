const axios = require("axios");

exports.getAgentRequests = async (req, res) => {

  try {

    const response = await axios.get(
      "http://localhost:5001/api/agents/getAllRegisteredUsers",
      {
        headers: {
          "x-service-name": "APPROVAL-SERVICE"
        }
      }
    );

    return res.status(200).json(response.data);

  } catch (error) {

    console.error("Error fetching agents:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch agent registrations"
    });

  }

};