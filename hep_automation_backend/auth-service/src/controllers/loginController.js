const axios = require("axios");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");

const RefreshToken = require("../models/refreshTokenSchema");
const { generateAccessToken, generateRefreshToken } = require("../utils/jwt");

exports.login = async (req, res) => {
  try {

    const { loginId, password } = req.body;

    if (!loginId || !password) {
      return res.status(400).json({
        success: false,
        message: "loginId and password required"
      });
    }

    let user;
    let role;
    let source;

    // ----------------------------------
    // 1️⃣ Check which service to call
    // ----------------------------------

    if (loginId.startsWith("190")) {

      const response = await axios.post(
        `${process.env.USER_SERVICE_URL}/api/agents/login`,
        { loginId },
        {headers: {
            "x-service-key": process.env.SERVICE_AUTH_KEY,
            "x-service-name": "AUTH-SERVICE"
        }}
      );

      user = response.data.data;
      source = "agent";

    } else {

      const response = await axios.post(
        `${process.env.ADMIN_SERVICE_URL}/api/user/login`,
        { loginId },
        {headers: {
            "x-service-key": process.env.SERVICE_AUTH_KEY
        }}
      );

      user = response.data.data;
      source = "admin";

    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // ----------------------------------
    // 2️⃣ Password check
    // ----------------------------------

    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    // ----------------------------------
    // 3️⃣ Create session
    // ----------------------------------

    const sessionId = uuidv4();

    await RefreshToken.deleteUserSessions(user.id);

    const accessToken = generateAccessToken({
      userId: user.id,
      role: user.role,
      sessionId,
      source
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
      role: user.role,
      sessionId,
      source
    });
    await RefreshToken.createSession({
      userId: user.id,
      refreshToken,
      sessionId
    });
    

    // ----------------------------------
    // 4️⃣ Return tokens
    // ----------------------------------

    return res.json({
      success: true,
      accessToken,
      refreshToken,
      role: user.role
    });

  } catch (error) {

    console.error("Login error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Login failed"
    });

  }
};

// exports.login = async (req, res) => {
//   try {
//     const { loginId, password } = req.body;

//     if (!loginId || !password) {
//       return res.status(400).json({
//         success: false,
//         message: "loginId and password required",
//       });
//     }

//     // fetch user from user_service
//     const user = await getUserByLoginId(loginId);

//     if (!user) {
//       return res.status(401).json({
//         success: false,
//         message: "Invalid credentials",
//       });
//     }

//     const isValid = await bcrypt.compare(password, user.password);

//     if (!isValid) {
//       return res.status(401).json({
//         success: false,
//         message: "Invalid credentials",
//       });
//     }

//     // generate session id
//     const sessionId = uuidv4();

//     const payload = {
//       userId: user.id,
//       role: user.role,
//       sessionId,
//     };

//     const accessToken = generateAccessToken(payload);
//     const refreshToken = generateRefreshToken(payload);

//     // invalidate previous sessions
//     await RefreshToken.deleteUserSessions(user.id);

//     // store new session
//     await RefreshToken.createSession({
//       userId: user.id,
//       refreshToken,
//       sessionId,
//     });

//     return res.json({
//       success: true,
//       accessToken,
//       refreshToken,
//       role: user.role,
//     });
//   } catch (error) {
//     console.error(error);

//     res.status(500).json({
//       success: false,
//       message: "Login failed",
//     });
//   }
// };

exports.refreshToken = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({
      message: "Refresh token required",
    });
  }

  try {
    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret) {
      console.error("Missing JWT_REFRESH_SECRET environment variable");
      return res.status(500).json({
        message: "Server misconfiguration",
      });
    }

    const decoded = jwt.verify(refreshToken, secret);

    // Ensure decoded is an object with the expected properties
    if (!decoded || typeof decoded !== "object" || !("userId" in decoded)) {
      return res.status(401).json({
        message: "Invalid refresh token",
      });
    }

    const { userId, role, sessionId } = decoded;

    const session = await RefreshToken.getSession(userId);

    if (!session || session.refreshToken !== refreshToken) {
      return res.status(401).json({
        message: "Invalid session",
      });
    }

    const newAccessToken = generateAccessToken({
      userId,
      role,
      sessionId,
    });

    return res.json({
      accessToken: newAccessToken,
    });
  } catch (error) {
    return res.status(401).json({
      message: "Invalid refresh token",
    });
  }
};

exports.logout = async (req, res) => {
  try {

    const userId = req.user.userId;

    await RefreshToken.deleteUserSessions(userId);

    return res.json({
      success: true,
      message: "Logged out successfully"
    });

  } catch (error) {

    console.error("Logout error:", error);

    return res.status(500).json({
      success: false,
      message: "Logout failed"
    });

  }
};
