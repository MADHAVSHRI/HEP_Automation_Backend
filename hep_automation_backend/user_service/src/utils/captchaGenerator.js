const svgCaptcha = require("svg-captcha");

const generateCaptcha = () => {

  const captcha = svgCaptcha.create({
    size: 5,
    noise: 3,
    color: true,
    background: "#f2f2f2"
  });

  return {
    text: captcha.text,
    svg: captcha.data
  };
};

module.exports = generateCaptcha;