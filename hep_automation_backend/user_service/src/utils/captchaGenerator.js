const generateCaptcha = () => {
  const operators = ["+", "-", "*", "/"];

  const random = (min, max) =>
    Math.floor(Math.random() * (max - min + 1)) + min;

  const operator = operators[Math.floor(Math.random() * operators.length)];

  let num1;
  let num2;
  let answer;

  switch (operator) {
    case "+":
      num1 = random(1, 15);
      num2 = random(1, 15);
      answer = num1 + num2;
      break;

    case "-":
      // avoid negative numbers
      num1 = random(1, 15);
      num2 = random(1, num1);
      answer = num1 - num2;
      break;

    case "*":
      // keep both numbers within 1–15
      num1 = random(1, 15);
      num2 = random(1, 15);
      answer = num1 * num2;
      break;

    case "/":
      // keep BOTH visible numbers within 1–15
      num2 = random(1, 15);

      // factors so num1 stays <=15
      const possibleAnswers = [];

      for (let i = 1; i <= 15; i++) {
        const dividend = num2 * i;

        if (dividend <= 15) {
          possibleAnswers.push(i);
        }
      }

      answer =
        possibleAnswers[Math.floor(Math.random() * possibleAnswers.length)];

      num1 = num2 * answer;
      break;

    default:
      break;
  }

  return {
    text: String(answer),
    question: `${num1} ${operator} ${num2} = ?`,
  };
};

module.exports = generateCaptcha;

// const svgCaptcha = require("svg-captcha");

// const generateCaptcha = () => {

//   const captcha = svgCaptcha.create({

//     size: 5,
//     noise: 5,
//     width: 200,
//     height: 80,
//     fontSize: 80,

//     ignoreChars: "0oO1ilI",

//     color: false,          // disable random colors
//     background: "#ffffff", // white background

//     charPreset: "ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghjklmnpqrstuvwxyz"

//   });

//   // Add style to force text color
//   const svg = captcha.data.replace(
//     "<svg",
//     '<svg style="fill:#0046ff;stroke:#0046ff"'
//   );

//   return {
//     text: captcha.text,
//     svg: svg
//   };

// };

// module.exports = generateCaptcha;
