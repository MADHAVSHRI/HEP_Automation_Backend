const cors = require("cors");
const allowedOrigins = require("./allowedOrigins");

module.exports = (app) => {
  const corsOptions = {
    origin: (origin, callback) => {
      // Check if the requesting origin is in the allowedOrigins[]
      if (allowedOrigins.includes(origin) || !origin) {
        callback(null, true);
      } else {
        callback(new Error(`Origin "${origin}" is not allowed by CORS.`));
      }
    },
    // methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // Allowed HTTP methods
    // allowedHeaders: ["Content-Type", "Authorization", "Set-Cookie"], // Allowed headers
    credentials: true,
    optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
  };

  app.use(cors(corsOptions));
  // app.options("*", cors(corsOptions)); // Handle preflight requests
};
