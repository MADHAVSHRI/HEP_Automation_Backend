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

exports.verifyCaptcha = async (req, res) => {
  try {
    const { token, value } = req.body;

    if (!token || !value) {
      return res
        .status(400)
        .json({ success: false, message: "Token and value required" });
    }

    const isValid = await captchaService.verifyCaptcha(token, value);

    if (!isValid) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired captcha" });
    }

    return res.status(200).json({ success: true, message: "Captcha valid" });
  } catch (error) {
    console.error("Captcha verification error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Verification failed" });
  }
};