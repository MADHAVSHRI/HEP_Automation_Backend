
const cors = require("cors");

module.exports = (app) => {
  const corsOptions = {
    origin: [
      "http://localhost:3000",
      "http://172.20.10.2:3000",
      "http://14.139.180.41:3000",
      "http://10.184.3.133:3000",
      "http://14.139.180.41:5006"
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // Allowed HTTP methods
    allowedHeaders: ["Content-Type", "Authorization", "Set-Cookie"], // Allow these headers in requests
    credentials: true, // Allow credentials (cookies, authorization headers, etc.)
    optionsSuccessStatus: 200, // Some legacy browsers (IE11, various SmartTVs) choke on 204
  };

  app.use(cors(corsOptions));
};