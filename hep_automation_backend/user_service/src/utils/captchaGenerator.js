// const svgCaptcha = require("svg-captcha");

// const generateCaptcha = () => {

//   const captcha = svgCaptcha.create({
//   size: 5,
//   noise: 4,
//   width: 160,
//   height: 60,
//   fontSize: 50,

//   ignoreChars: "0oO1ilI",
//   color: false,
//   background: "#287e72ff"
// });

//   return {
//     text: captcha.text,
//     svg: captcha.data
//   };
// };

// module.exports = generateCaptcha;

const svgCaptcha = require("svg-captcha");

const generateCaptcha = () => {

  const captcha = svgCaptcha.create({

    size: 5,
    noise: 5,
    width: 200,
    height: 80,
    fontSize: 80,

    ignoreChars: "0oO1ilI",

    color: false,          // disable random colors
    background: "#ffffff", // white background

    charPreset: "ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghjklmnpqrstuvwxyz"

  });

  // Add style to force text color
  const svg = captcha.data.replace(
    "<svg",
    '<svg style="fill:#0046ff;stroke:#0046ff"'
  );

  return {
    text: captcha.text,
    svg: svg
  };

};

module.exports = generateCaptcha;