const svgCaptcha = require("svg-captcha");

const generateCaptcha = () => {

  const captcha = svgCaptcha.create({
  size: 5,
  noise: 4,
  width: 160,
  height: 60,
  fontSize: 50,
  ignoreChars: "0oO1ilI",
  color: true,
  background: "#f8f9fa"
});

  return {
    text: captcha.text,
    svg: captcha.data
  };
};

module.exports = generateCaptcha;