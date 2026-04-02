const captchaService = require("../services/captchaService");

exports.getCaptcha = async (req, res) => {

  try {

    const captcha = await captchaService.createCaptcha();

    res.status(200).json({
      success: true,
      captchaSvg: captcha.captchaSvg,
      captchaToken: captcha.captchaToken,
      expiresIn: captcha.expiresIn
    });

  } catch (error) {

    console.error("Captcha generation error:", error);

    res.status(500).json({
      success: false,
      message: "Captcha generation failed"
    });

  }

};