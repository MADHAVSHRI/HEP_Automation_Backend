const axios = require("axios");

exports.createDeptUser = async (req, res) => {
  try {

    const {
      userName,
      email,
      phoneNumber,
      roleId,
      departmentId,
      password
    } = req.body;

    if (!userName || !email || !phoneNumber || !roleId || !departmentId) {
      return res.status(400).json({
        success: false,
        message: "Required fields missing"
      });
    }

    const response = await axios.post(
      `${process.env.ADMIN_SERVICE_URL}/api/user/create-user`,
      {
        userName,
        email,
        phoneNumber,
        roleId,
        departmentId,
        password
      },
      {
        headers: {
          Authorization: req.headers.authorization,
          "x-service-key": process.env.SERVICE_AUTH_KEY,
          "x-service-name": "AUTH-SERVICE"
        },
        timeout: 5000
      }
    );

    return res.status(response.status).json(response.data);

  } catch (error) {

    console.error(
      "Create Dept User Error:",
      error.response?.data || error.message
    );

    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }

    return res.status(500).json({
      success: false,
      message: "Approval service unavailable"
    });
  }
};