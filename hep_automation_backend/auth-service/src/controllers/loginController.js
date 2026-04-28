const axios = require("axios");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");
const RefreshToken = require("../models/refreshTokenSchema");
const { generateAccessToken, generateRefreshToken } = require("../utils/jwt");
const {
  getUserSession,
  createUserSession,
  deleteUserSession
} = require("../utils/sessionStore");

exports.login = async (req, res) => {
  try {

    const { loginId, password, captchaToken, captchaValue } = req.body;

    if (!loginId || !password || !captchaToken || !captchaValue) {
      return res.status(400).json({
        success: false,
        message: "Login ID, password, and security code are required",
      });
    }

    const captchaPromise = axios.post(
      `${process.env.USER_SERVICE_URL}/api/captcha/verify-captcha`,
      { token: captchaToken, value: captchaValue },
      {
        timeout: 5000,
        headers: {
          "x-service-key": process.env.SERVICE_AUTH_KEY,
          "x-service-name": "AUTH-SERVICE",
        },
      }
    );

    let user;
    let role;
    let source;


    let userPromise;

    if (loginId.startsWith("190")) {

      userPromise = axios.post(
        `${process.env.USER_SERVICE_URL}/api/agents/login`,
        { loginId },
        {
          timeout: 5000,
          headers: {
            "x-service-key": process.env.SERVICE_AUTH_KEY,
            "x-service-name": "AUTH-SERVICE"
          }
        }
      );

      source = "agent";

    } else {

      userPromise = axios.post(
        `${process.env.ADMIN_SERVICE_URL}/api/user/login`,
        { loginId },
        {
          timeout: 5000,
          headers: {
            "x-service-key": process.env.SERVICE_AUTH_KEY,
            "x-service-name": "AUTH-SERVICE"
          }
        }
      );

      source = "admin";

    }


    let userResponse;

    try {

      const results = await Promise.all([captchaPromise, userPromise]);

      userResponse = results[1];

    } catch (error) {

      /* Captcha failure */
      if (error?.response?.status === 400) {
        return res.status(400).json({
          success: false,
          message: "Invalid or expired security code",
        });
      }

      throw error;
    }

    user = userResponse.data.data;

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }


    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }



    if (source === "admin") {

      // Admin / Department users

      if (user.status !== "active" || user.isApprovedByAdmin !== true) {
        return res.status(403).json({
          success: false,
          message: "Your account is not activated by admin"
        });
      }

    } else if (source === "agent") {

      // Agent / Company users

      if (user.status !== "approved") {
        return res.status(403).json({
          success: false,
          message: "Your account is not approved yet"
        });
      }

    }

    /* =====================================================
   ===== NEW: Check existing session in Redis
   ===================================================== */

    const existingSession = await getUserSession(user.id);
    if (existingSession) {
      const dbSession = await RefreshToken.getSessionBySessionId(existingSession);
      if (dbSession) {
        return res.status(409).json({
          success: false,
          message: "User already logged in from another device"
        });
      }

    }

    // const existingSession = await getUserSession(user.id);
    //   if (existingSession) {

    //     console.log("Existing session found. Replacing session...");

    //     // delete redis session
    //     await deleteUserSession(user.id);

    //     // delete refresh token in DB
    //     await RefreshToken.deleteUserSessions(user.id);

    //   }

    const sessionId = uuidv4();
    const accessToken = generateAccessToken({
      userId: user.id,
      role: user.role,
      departmentId:user.departmentId,
      departmentName:user.departmentName,
      sessionId,
      source
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
      role: user.role,
      departmentId:user.departmentId,
      departmentName:user.departmentName,
      sessionId,
      source
    });

    await RefreshToken.createSession({
      userId: user.id,
      refreshToken,
      sessionId
    });
    await createUserSession(user.id, sessionId, 86400); // 24 hours

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

    const session = await RefreshToken.getSessionBySessionId(sessionId);

    if (!session || session.refreshToken !== refreshToken) {
      return res.status(401).json({
        message: "Invalid session",
      });
    }

    if (new Date(session.expiresAt) < new Date()) {
      return res.status(401).json({
        message: "Refresh token expired"
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

    const { userId, sessionId } = req.user;
    const activeSession = await getUserSession(userId);
    if (activeSession !== sessionId) {

      return res.json({
        success: true,
        message: "Session already replaced. Logout ignored."
      });

    }

    await RefreshToken.deleteSessionBySessionId(sessionId);
    const redisSession = await getUserSession(userId);
    if (redisSession === sessionId) {
      await deleteUserSession(userId);
    }

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
