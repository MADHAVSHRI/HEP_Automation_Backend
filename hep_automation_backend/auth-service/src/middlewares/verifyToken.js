const jwt = require("jsonwebtoken");
const RefreshToken = require("../models/refreshTokenSchema");

module.exports = async (req, res, next) => {
  try {

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        message: "Token missing",
      });
    }

    const token = authHeader.split(" ")[1];

    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      return res.status(500).json({
        message: "Server misconfiguration: JWT secret not set",
      });
    }

    const decoded = jwt.verify(token, jwtSecret);

    // jwt.verify can return a string or an object; ensure we have an object payload
    if (typeof decoded === "string" || decoded === null) {
      return res.status(401).json({
        message: "Invalid token payload",
      });
    }

    const userId = decoded.userId;
    const sessionId = decoded.sessionId;

    // const session = await RefreshToken.getSession(userId);

    // if (!session || session.sessionId !== sessionId) {
    //   return res.status(401).json({
    //     message: "Session expired",
    //   });
    // }
    const session = await RefreshToken.getSessionBySessionId(sessionId);

    if (!session) {
      return res.status(401).json({
        message: "Session expired"
      });
}

    req.user = decoded;

    next();

  } catch (error) {

    return res.status(401).json({
      message: "Invalid token",
    });

  }
};












































// const jwt = require("jsonwebtoken");
// const RefreshToken = require("../models/refreshTokenSchema");

// module.exports = async (req, res, next) => {
//   try {
//     const authHeader = req.headers.authorization;

//     if (!authHeader) {
//       return res.status(401).json({
//         message: "Token missing",
//       });
//     }

//     const token = authHeader.split(" ")[1];

//     const jwtSecret = process.env.JWT_SECRET;
//     if (!jwtSecret) {
//       return res.status(500).json({
//         message: "Server misconfiguration: JWT secret not set",
//       });
//     }

//     const decoded = jwt.verify(token, jwtSecret);
//     const payload = decoded;

//     const session = await RefreshToken.getSession(payload.userId);

//     if (!session || session.sessionId !== payload.sessionId) {
//       return res.status(401).json({
//         message: "Session expired",
//       });
//     }

//     req.user = payload;

//     next();
//   } catch (error) {
//     return res.status(401).json({
//       message: "Invalid token",
//     });
//   }
// };
