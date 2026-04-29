// const allowedOrigins = require("./allowedOrigins");

// function allowCredentials(req, res, next) {
//   const origin = req.headers.origin;
//   console.log("Request Origin:", origin);  // Log the origin
//   if (allowedOrigins.includes(origin) || !origin) {
//     res.header("Access-Control-Allow-Origin", origin);
//     res.header("Access-Control-Allow-Credentials", true);
//   } else {
//     console.log(`Origin "${origin}" is not allowed by CORS.`);
//   }
//   next();
// }

// module.exports = allowCredentials;


function allowCredentials(req, res, next) {
  // Log the request's origin for debugging purposes
  const origin = req.headers.origin;
  console.log("Request Origin:", origin);  // Log the origin
  
  // Temporarily allow all origins
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Credentials", true); // Allow credentials

  // Optional: Log the change for debugging purposes
  console.log("CORS temporarily disabled. All origins are allowed.");

  next();  // Call the next middleware or route handler
}

module.exports = allowCredentials;