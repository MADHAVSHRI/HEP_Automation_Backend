const UserType = require("../models/userTypeSchema");
const captchaService = require("../services/captchaService");

exports.getUserTypes = async (req, res) => {
  try {
    const userTypes = await UserType.getAllUserTypes();

    const captcha = await captchaService.createCaptcha();

    res.status(200).json({
      success: true,
      userTypes: userTypes,
      captchaSvg: captcha.captchaSvg,
      captchaToken: captcha.captchaToken,
      expiresIn: captcha.expiresIn
    });

  } catch (error) {
    console.error("Error fetching user types:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};