const cors = require("cors");

module.exports = (app) => {
  const corsOptions = {
    origin: [
      "http://10.184.3.133:3000",
      "http://14.139.180.40:3000",
    ],

    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],

    allowedHeaders: ["Content-Type", "Authorization", "Set-Cookie"],

    credentials: true,

    optionsSuccessStatus: 200,
  };

  app.use(cors(corsOptions));
};