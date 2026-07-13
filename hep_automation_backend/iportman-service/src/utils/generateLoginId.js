const crypto = require("crypto");

// Generates a random 8-digit numeric login id (10000000 - 99999999).
function generateLoginId() {
  return String(crypto.randomInt(10000000, 100000000));
}

module.exports = generateLoginId;
