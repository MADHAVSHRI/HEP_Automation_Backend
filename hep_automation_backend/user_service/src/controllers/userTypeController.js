const UserType = require("../models/userTypeSchema");
const generateCaptcha = require("../utils/captchaGenerator");
const { saveCaptcha } = require("../utils/captchaStore");
const crypto = require("crypto");

exports.getUserTypes = async (req, res) => {

  try {

    const userTypes = await UserType.getAllUserTypes();

    const captcha = generateCaptcha();

    const captchaToken = crypto.randomUUID();

    saveCaptcha(captchaToken, captcha.text);

    res.status(200).json({
      success: true,
      userTypes: userTypes,
      captchaSvg: captcha.svg,
      captchaToken: captchaToken
    });

  } catch (error) {

    console.error("Error fetching user types:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error"
    });

  }

};