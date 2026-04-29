// const axios = require("axios");
// const bcrypt = require("bcrypt");
// const { v4: uuidv4 } = require("uuid");
// const jwt = require("jsonwebtoken");
// const RefreshToken = require("../models/refreshTokenSchema");
// const { generateAccessToken, generateRefreshToken } = require("../utils/jwt");
// const {
//   getUserSession,
//   createUserSession,
//   deleteUserSession,
// } = require("../utils/sessionStore");

// /* ─────────────────────────────────────────────
//    Centralised structured logger
//    Prints: [TIMESTAMP] [LEVEL] [CONTEXT] message + optional payload
// ───────────────────────────────────────────── */
// const log = {
//   info: (ctx, msg, data) =>
//     console.log(
//       JSON.stringify({ ts: new Date().toISOString(), level: "INFO", ctx, msg, ...(data && { data }) })
//     ),
//   warn: (ctx, msg, data) =>
//     console.warn(
//       JSON.stringify({ ts: new Date().toISOString(), level: "WARN", ctx, msg, ...(data && { data }) })
//     ),
//   error: (ctx, msg, err, extra) => {
//     const payload = {
//       ts: new Date().toISOString(),
//       level: "ERROR",
//       ctx,
//       msg,
//       error: {
//         message: err?.message,
//         name: err?.name,
//         stack: err?.stack,
//         // Axios-specific fields
//         axiosUrl: err?.config?.url,
//         axiosMethod: err?.config?.method?.toUpperCase(),
//         axiosStatus: err?.response?.status,
//         axiosResponseData: err?.response?.data,
//         axiosCode: err?.code, // e.g. ECONNREFUSED, ETIMEDOUT
//       },
//       ...(extra && { extra }),
//     };
//     console.error(JSON.stringify(payload, null, 2));
//   },
// };

// /* ─────────────────────────────────────────────
//    Helper: identify which promise rejected in
//    Promise.all so we can give a precise message
// ───────────────────────────────────────────── */
// async function runParallel(captchaPromise, userPromise) {
//   const [captchaResult, userResult] = await Promise.allSettled([
//     captchaPromise,
//     userPromise,
//   ]);

//   if (captchaResult.status === "rejected") {
//     const err = captchaResult.reason;
//     log.error("LOGIN:CAPTCHA", "Captcha verification call failed", err);
//     const status = err?.response?.status;
//     if (status === 400) {
//       return { captchaError: { status: 400, message: "Invalid or expired security code" } };
//     }
//     return { captchaError: { status: 503, message: "Captcha service unavailable" } };
//   }

//   if (userResult.status === "rejected") {
//     const err = userResult.reason;
//     log.error("LOGIN:USER_FETCH", "User lookup call failed", err, {
//       hint:
//         err?.code === "ECONNREFUSED"
//           ? "Target service is DOWN or wrong URL in env"
//           : err?.code === "ETIMEDOUT"
//           ? "Target service timed out — check network/firewall"
//           : "Unexpected axios error",
//     });
//     return { userError: { status: 503, message: "User service unavailable" } };
//   }

//   return {
//     captchaResponse: captchaResult.value,
//     userResponse: userResult.value,
//   };
// }

// /* ─────────────────────────────────────────────
//    LOGIN
// ───────────────────────────────────────────── */
// exports.login = async (req, res) => {
//   const TAG = "LOGIN";

//   try {
//     const { loginId, password, captchaToken, captchaValue } = req.body;

//     /* ── 1. Input validation ── */
//     if (!loginId || !password || !captchaToken || !captchaValue) {
//       log.warn(TAG, "Missing required fields", {
//         hasLoginId: !!loginId,
//         hasPassword: !!password,
//         hasCaptchaToken: !!captchaToken,
//         hasCaptchaValue: !!captchaValue,
//       });
//       return res.status(400).json({
//         success: false,
//         message: "Login ID, password, and security code are required",
//       });
//     }

//     /* ── 2. Env var guard ── */
//     const missingEnv = [];
//     if (!process.env.USER_SERVICE_URL) missingEnv.push("USER_SERVICE_URL");
//     if (!process.env.ADMIN_SERVICE_URL) missingEnv.push("ADMIN_SERVICE_URL");
//     if (!process.env.SERVICE_AUTH_KEY) missingEnv.push("SERVICE_AUTH_KEY");
//     if (missingEnv.length) {
//       log.error(TAG, "Missing environment variables", new Error("Env var missing"), { missingEnv });
//       return res.status(500).json({ success: false, message: "Server misconfiguration" });
//     }

//     log.info(TAG, "Login attempt", { loginId, source: loginId.startsWith("190") ? "agent" : "admin" });

//     /* ── 3. Build downstream promises ── */
//     const captchaPromise = axios.post(
//       `${process.env.USER_SERVICE_URL}/api/captcha/verify-captcha`,
//       { token: captchaToken, value: captchaValue },
//       {
//         timeout: 5000,
//         headers: {
//           "x-service-key": process.env.SERVICE_AUTH_KEY,
//           "x-service-name": "AUTH-SERVICE",
//         },
//       }
//     );

//     let source;
//     let userPromise;

//     if (loginId.startsWith("190")) {
//       source = "agent";
//       userPromise = axios.post(
//         `${process.env.USER_SERVICE_URL}/api/agents/login`,
//         { loginId },
//         {
//           timeout: 5000,
//           headers: {
//             "x-service-key": process.env.SERVICE_AUTH_KEY,
//             "x-service-name": "AUTH-SERVICE",
//           },
//         }
//       );
//     } else {
//       source = "admin";
//       userPromise = axios.post(
//         `${process.env.ADMIN_SERVICE_URL}/api/user/login`,
//         { loginId },
//         {
//           timeout: 5000,
//           headers: {
//             "x-service-key": process.env.SERVICE_AUTH_KEY,
//             "x-service-name": "AUTH-SERVICE"
//           }
//         }
//       );
//     }

//     /* ── 4. Run captcha + user fetch in parallel (with per-promise error isolation) ── */
//     const parallel = await runParallel(captchaPromise, userPromise);

//     if (parallel.captchaError) {
//       return res.status(parallel.captchaError.status).json({
//         success: false,
//         message: parallel.captchaError.message,
//       });
//     }

//     if (parallel.userError) {
//       return res.status(parallel.userError.status).json({
//         success: false,
//         message: parallel.userError.message,
//       });
//     }

//     const user = parallel.userResponse.data?.data;

//     /* ── 5. User existence check ── */
//     if (!user) {
//       log.warn(TAG, "User not found", { loginId });
//       // Dummy bcrypt to prevent timing attack
//       await bcrypt.compare(password, "$2b$10$invalidhashpadding000000000000000000000000000000000000");
//       return res.status(404).json({ success: false, message: "User not found" });
//     }

//     log.info(TAG, "User record fetched", { userId: user.id, role: user.role, source });

//     /* ── 6. Password verification ── */
//     const isValid = await bcrypt.compare(password, user.password);
//     if (!isValid) {
//       log.warn(TAG, "Password mismatch", { userId: user.id });
//       return res.status(401).json({ success: false, message: "Invalid credentials" });
//     }

//     /* ── 7. Account status check ── */
//     if (source === "admin") {
//       if (user.status !== "active" || user.isApprovedByAdmin !== true) {
//         log.warn(TAG, "Admin account not activated", { userId: user.id, status: user.status });
//         return res.status(403).json({
//           success: false,
//           message: "Your account is not activated by admin",
//         });
//       }
//     } else if (source === "agent") {
//       if (user.status !== "approved") {
//         log.warn(TAG, "Agent account not approved", { userId: user.id, status: user.status });
//         return res.status(403).json({
//           success: false,
//           message: "Your account is not approved yet",
//         });
//       }
//     }

//     /* ── 8. Existing session check (Redis + DB) ── */
//     let existingSession;
//     try {
//       existingSession = await getUserSession(user.id);
//       log.info(TAG, "Redis session lookup", { userId: user.id, found: !!existingSession });
//     } catch (redisErr) {
//       log.error(TAG, "Redis getUserSession failed", redisErr, { userId: user.id });
//       // Non-fatal: proceed without session check rather than blocking login
//     }

//     if (existingSession) {
//       let dbSession;
//       try {
//         dbSession = await RefreshToken.getSessionBySessionId(existingSession);
//         log.info(TAG, "DB session lookup", { sessionId: existingSession, found: !!dbSession });
//       } catch (dbErr) {
//         log.error(TAG, "DB getSessionBySessionId failed", dbErr, { sessionId: existingSession });
//         return res.status(500).json({ success: false, message: "Session check failed" });
//       }

//       if (dbSession) {
//         log.warn(TAG, "Concurrent session conflict", { userId: user.id, sessionId: existingSession });
//         return res.status(409).json({
//           success: false,
//           message: "User already logged in from another device",
//         });
//       } else {
//         // Stale Redis key — clean it up
//         log.warn(TAG, "Stale Redis session found, cleaning up", { userId: user.id });
//         try {
//           await deleteUserSession(user.id);
//         } catch (cleanupErr) {
//           log.error(TAG, "Failed to delete stale Redis session", cleanupErr, { userId: user.id });
//           // Non-fatal — continue
//         }
//       }
//     }

//     /* ── 9. Token generation ── */
//     const sessionId = uuidv4();

//     const tokenPayload = {
//       userId: user.id,
//       role: user.role,
//       departmentId: user.departmentId,
//       departmentName: user.departmentName,
//       sessionId,
//       source,
//     };

//     const accessToken = generateAccessToken(tokenPayload);
//     const refreshToken = generateRefreshToken(tokenPayload);

//     log.info(TAG, "Tokens generated", { userId: user.id, sessionId });

//     /* ── 10. Persist session ── */
//     try {
//       await RefreshToken.createSession({ userId: user.id, refreshToken, sessionId });
//       log.info(TAG, "DB session created", { sessionId });
//     } catch (dbErr) {
//       log.error(TAG, "DB createSession failed", dbErr, { userId: user.id, sessionId });
//       return res.status(500).json({ success: false, message: "Session creation failed" });
//     }

//     try {
//       await createUserSession(user.id, sessionId, 86400);
//       log.info(TAG, "Redis session created", { userId: user.id, sessionId });
//     } catch (redisErr) {
//       log.error(TAG, "Redis createUserSession failed — rolling back DB session", redisErr, {
//         userId: user.id,
//         sessionId,
//       });
//       // Rollback DB session to keep stores consistent
//       try {
//         await RefreshToken.deleteSessionBySessionId(sessionId);
//       } catch (rollbackErr) {
//         log.error(TAG, "Rollback of DB session also failed", rollbackErr, { sessionId });
//       }
//       return res.status(500).json({ success: false, message: "Session creation failed" });
//     }

//     log.info(TAG, "Login successful", { userId: user.id, role: user.role, sessionId });

//     return res.json({
//       success: true,
//       accessToken,
//       refreshToken,
//       role: user.role,
//     });
//   } catch (error) {
//     log.error(TAG, "Unhandled login error", error);
//     return res.status(500).json({ success: false, message: "Login failed" });
//   }
// };

// /* ─────────────────────────────────────────────
//    REFRESH TOKEN
// ───────────────────────────────────────────── */
// exports.refreshToken = async (req, res) => {
//   const TAG = "REFRESH_TOKEN";

//   const { refreshToken } = req.body;

//   if (!refreshToken) {
//     log.warn(TAG, "No refresh token in request body");
//     return res.status(401).json({ message: "Refresh token required" });
//   }

//   try {
//     const secret = process.env.JWT_REFRESH_SECRET;
//     if (!secret) {
//       log.error(TAG, "JWT_REFRESH_SECRET is not set", new Error("Missing env var"));
//       return res.status(500).json({ message: "Server misconfiguration" });
//     }

//     let decoded;
//     try {
//       decoded = jwt.verify(refreshToken, secret);
//     } catch (jwtErr) {
//       log.warn(TAG, "JWT verification failed", { error: jwtErr.message });
//       return res.status(401).json({ message: "Invalid refresh token" });
//     }

//     if (!decoded || typeof decoded !== "object" || !("userId" in decoded)) {
//       log.warn(TAG, "Decoded token has unexpected shape", { decoded });
//       return res.status(401).json({ message: "Invalid refresh token" });
//     }

//     // FIX: also destructure departmentId and departmentName
//     const { userId, role, sessionId, departmentId, departmentName, source } = decoded;

//     log.info(TAG, "Token decoded", { userId, role, sessionId });

//     let session;
//     try {
//       session = await RefreshToken.getSessionBySessionId(sessionId);
//     } catch (dbErr) {
//       log.error(TAG, "DB getSessionBySessionId failed", dbErr, { sessionId });
//       return res.status(500).json({ message: "Session lookup failed" });
//     }

//     if (!session || session.refreshToken !== refreshToken) {
//       log.warn(TAG, "Session not found or token mismatch", {
//         sessionId,
//         sessionExists: !!session,
//       });
//       return res.status(401).json({ message: "Invalid session" });
//     }

//     if (new Date(session.expiresAt) < new Date()) {
//       log.warn(TAG, "Refresh token expired", { sessionId, expiresAt: session.expiresAt });
//       return res.status(401).json({ message: "Refresh token expired" });
//     }

//     // FIX: carry ALL original claims forward into new access token
//     const newAccessToken = generateAccessToken({
//       userId,
//       role,
//       departmentId,
//       departmentName,
//       sessionId,
//       source,
//     });

//     log.info(TAG, "Access token refreshed", { userId, sessionId });

//     return res.json({ accessToken: newAccessToken });
//   } catch (error) {
//     log.error(TAG, "Unhandled refresh token error", error);
//     return res.status(401).json({ message: "Invalid refresh token" });
//   }
// };

// /* ─────────────────────────────────────────────
//    LOGOUT
// ───────────────────────────────────────────── */
// exports.logout = async (req, res) => {
//   const TAG = "LOGOUT";

//   try {
//     const { userId, sessionId } = req.user;

//     log.info(TAG, "Logout attempt", { userId, sessionId });

//     let activeSession;
//     try {
//       activeSession = await getUserSession(userId);
//       log.info(TAG, "Redis session fetched", { userId, activeSession });
//     } catch (redisErr) {
//       log.error(TAG, "Redis getUserSession failed during logout", redisErr, { userId });
//       // Non-fatal: proceed with DB cleanup anyway
//     }

//     if (activeSession && activeSession !== sessionId) {
//       log.warn(TAG, "Session mismatch on logout — token belongs to replaced session", {
//         userId,
//         tokenSessionId: sessionId,
//         activeSessionId: activeSession,
//       });
//       // FIX: return success: false — logout didn't actually do anything
//       return res.status(200).json({
//         success: false,
//         message: "Session already replaced. Logout ignored.",
//       });
//     }

//     /* ── Delete DB session ── */
//     try {
//       await RefreshToken.deleteSessionBySessionId(sessionId);
//       log.info(TAG, "DB session deleted", { sessionId });
//     } catch (dbErr) {
//       log.error(TAG, "DB deleteSessionBySessionId failed", dbErr, { sessionId });
//       return res.status(500).json({ success: false, message: "Logout failed" });
//     }

//     /* ── Delete Redis session ── */
//     try {
//       const redisSession = await getUserSession(userId);
//       if (redisSession === sessionId) {
//         await deleteUserSession(userId);
//         log.info(TAG, "Redis session deleted", { userId, sessionId });
//       } else {
//         log.warn(TAG, "Redis session no longer matches — skip delete", {
//           userId,
//           expected: sessionId,
//           found: redisSession,
//         });
//       }
//     } catch (redisErr) {
//       log.error(TAG, "Redis deleteUserSession failed", redisErr, { userId });
//       // Non-fatal: DB session already cleared — user is effectively logged out
//     }

//     log.info(TAG, "Logout successful", { userId, sessionId });

//     return res.json({ success: true, message: "Logged out successfully" });
//   } catch (error) {
//     log.error(TAG, "Unhandled logout error", error);
//     return res.status(500).json({ success: false, message: "Logout failed" });
//   }
// }; 













const axios = require("axios");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");
const RefreshToken = require("../models/refreshTokenSchema");
const { generateAccessToken, generateRefreshToken } = require("../utils/jwt");
const {
  getUserSession,
  createUserSession,
  deleteUserSession,
  refreshUserSession,
} = require("../utils/sessionStore");

/* ─────────────────────────────────────────────
   Centralised structured logger
───────────────────────────────────────────── */
const log = {
  info: (ctx, msg, data) =>
    console.log(
      JSON.stringify({ ts: new Date().toISOString(), level: "INFO", ctx, msg, ...(data && { data }) })
    ),
  warn: (ctx, msg, data) =>
    console.warn(
      JSON.stringify({ ts: new Date().toISOString(), level: "WARN", ctx, msg, ...(data && { data }) })
    ),
  error: (ctx, msg, err, extra) => {
    const payload = {
      ts: new Date().toISOString(),
      level: "ERROR",
      ctx,
      msg,
      error: {
        message: err?.message,
        name: err?.name,
        stack: err?.stack,
        axiosUrl: err?.config?.url,
        axiosMethod: err?.config?.method?.toUpperCase(),
        axiosStatus: err?.response?.status,
        axiosResponseData: err?.response?.data,
        axiosCode: err?.code,
      },
      ...(extra && { extra }),
    };
    console.error(JSON.stringify(payload, null, 2));
  },
};

/* ─────────────────────────────────────────────
   DIAGNOSTIC HELPER
   Call on startup or via GET /auth/diagnose
   Checks: env vars, captcha service, user service, admin service, Redis, DB
───────────────────────────────────────────── */
async function runDiagnostics() {
  const results = {};

  /* ── 1. Env vars ── */
  const requiredEnv = [
    "USER_SERVICE_URL",
    "ADMIN_SERVICE_URL",
    "SERVICE_AUTH_KEY",
    "JWT_SECRET",
    "JWT_REFRESH_SECRET",
  ];
  const missingEnv = requiredEnv.filter((k) => !process.env[k]);
  results.envVars = {
    ok: missingEnv.length === 0,
    missing: missingEnv,
    present: requiredEnv.filter((k) => !!process.env[k]),
  };

  /* ── 2. Captcha service reachability ── */
  try {
    await axios.get(`${process.env.USER_SERVICE_URL}/health`, { timeout: 3000 });
    results.captchaService = { ok: true, url: process.env.USER_SERVICE_URL };
  } catch (err) {
    results.captchaService = {
      ok: false,
      url: process.env.USER_SERVICE_URL,
      code: err?.code,
      status: err?.response?.status,
      hint:
        err?.code === "ECONNREFUSED"
          ? "USER_SERVICE is DOWN or USER_SERVICE_URL is wrong"
          : err?.code === "ETIMEDOUT"
          ? "USER_SERVICE is unreachable — check network/firewall"
          : err?.response?.status
          ? `Service responded with HTTP ${err.response.status} — likely up but /health not defined (non-fatal)`
          : err.message,
    };
  }

  /* ── 3. Admin service reachability ── */
  try {
    await axios.get(`${process.env.ADMIN_SERVICE_URL}/health`, { timeout: 3000 });
    results.adminService = { ok: true, url: process.env.ADMIN_SERVICE_URL };
  } catch (err) {
    results.adminService = {
      ok: false,
      url: process.env.ADMIN_SERVICE_URL,
      code: err?.code,
      status: err?.response?.status,
      hint:
        err?.code === "ECONNREFUSED"
          ? "ADMIN_SERVICE is DOWN or ADMIN_SERVICE_URL is wrong"
          : err?.code === "ETIMEDOUT"
          ? "ADMIN_SERVICE is unreachable — check network/firewall"
          : err?.response?.status
          ? `Service responded with HTTP ${err.response.status} — likely up but /health not defined (non-fatal)`
          : err.message,
    };
  }

  /* ── 4. Redis reachability ── */
  try {
    // getUserSession with a dummy id — just tests connectivity
    await getUserSession("__diag_probe__");
    results.redis = { ok: true };
  } catch (err) {
    results.redis = {
      ok: false,
      message: err?.message,
      hint: "Redis may be down or REDIS_URL/host config is wrong",
    };
  }

  /* ── 5. DB reachability ── */
  try {
    await RefreshToken.getSessionBySessionId("__diag_probe__");
    results.db = { ok: true };
  } catch (err) {
    results.db = {
      ok: false,
      message: err?.message,
      hint: "DB connection may be down or model is misconfigured",
    };
  }

  return results;
}

/* ─────────────────────────────────────────────
   DIAGNOSTIC ENDPOINT HANDLER
   Register as: GET /auth/diagnose
   Disable in production via env flag if needed
───────────────────────────────────────────── */
exports.diagnose = async (req, res) => {
  if (process.env.ENABLE_DIAG_ENDPOINT !== "true") {
    return res.status(404).json({ message: "Not found" });
  }
  const results = await runDiagnostics();
  const allOk = Object.values(results).every((r) => r.ok);
  log.info("DIAG", "Diagnostics run", results);
  return res.status(allOk ? 200 : 503).json({ success: allOk, results });
};

/* ─────────────────────────────────────────────
   Run diagnostics on startup and print to logs
   so you see the state immediately on boot
───────────────────────────────────────────── */
(async () => {
  try {
    const results = await runDiagnostics();
    const allOk = Object.values(results).every((r) => r.ok);
    if (allOk) {
      log.info("STARTUP:DIAG", "All dependency checks passed", results);
    } else {
      log.warn("STARTUP:DIAG", "One or more dependency checks FAILED — see details", results);
    }
  } catch (err) {
    log.error("STARTUP:DIAG", "Diagnostic check threw unexpectedly", err);
  }
})();

/* ─────────────────────────────────────────────
   Helper: identify which promise rejected in
   Promise.allSettled so we can give a precise message
───────────────────────────────────────────── */
async function runParallel(captchaPromise, userPromise) {
  const [captchaResult, userResult] = await Promise.allSettled([
    captchaPromise,
    userPromise,
  ]);

  if (captchaResult.status === "rejected") {
    const err = captchaResult.reason;
    log.error("LOGIN:CAPTCHA", "Captcha verification call failed", err, {
      hint:
        err?.code === "ECONNREFUSED"
          ? "USER_SERVICE is DOWN — check USER_SERVICE_URL env var"
          : err?.code === "ETIMEDOUT"
          ? "Captcha service timed out — check network/firewall"
          : err?.response?.status === 400
          ? "Captcha value was rejected by the service"
          : "Unexpected axios error on captcha call",
    });
    const status = err?.response?.status;
    if (status === 400) {
      return { captchaError: { status: 400, message: "Invalid or expired security code" } };
    }
    return { captchaError: { status: 503, message: "Captcha service unavailable" } };
  }

  if (userResult.status === "rejected") {
    const err = userResult.reason;
    log.error("LOGIN:USER_FETCH", "User lookup call failed", err, {
      hint:
        err?.code === "ECONNREFUSED"
          ? "Target service is DOWN or wrong URL in env — run GET /auth/diagnose"
          : err?.code === "ETIMEDOUT"
          ? "Target service timed out — check network/firewall or raise axios timeout"
          : err?.response?.status === 401 || err?.response?.status === 403
          ? "SERVICE_AUTH_KEY may be wrong or missing"
          : "Unexpected axios error — check axiosUrl and axiosStatus in this log",
    });
    return { userError: { status: 503, message: "User service unavailable" } };
  }

  return {
    captchaResponse: captchaResult.value,
    userResponse: userResult.value,
  };
}

/* ─────────────────────────────────────────────
   LOGIN
───────────────────────────────────────────── */
exports.login = async (req, res) => {
  const TAG = "LOGIN";

  try {
    const { loginId, password, captchaToken, captchaValue } = req.body;

    /* ── 1. Input validation ── */
    if (!loginId || !password || !captchaToken || !captchaValue) {
      log.warn(TAG, "Missing required fields", {
        hasLoginId: !!loginId,
        hasPassword: !!password,
        hasCaptchaToken: !!captchaToken,
        hasCaptchaValue: !!captchaValue,
      });
      return res.status(400).json({
        success: false,
        message: "Login ID, password, and security code are required",
      });
    }

    /* ── 2. Env var guard ── */
    const missingEnv = [];
    if (!process.env.USER_SERVICE_URL) missingEnv.push("USER_SERVICE_URL");
    if (!process.env.ADMIN_SERVICE_URL) missingEnv.push("ADMIN_SERVICE_URL");
    if (!process.env.SERVICE_AUTH_KEY) missingEnv.push("SERVICE_AUTH_KEY");
    if (missingEnv.length) {
      log.error(TAG, "Missing environment variables", new Error("Env var missing"), { missingEnv });
      return res.status(500).json({ success: false, message: "Server misconfiguration" });
    }

    log.info(TAG, "Login attempt", {
      loginId,
      source: loginId.startsWith("190") ? "agent" : "admin",
    });

    /* ── 3. Build downstream promises ── */
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

    let source;
    let userPromise;

    if (loginId.startsWith("190")) {
      source = "agent";
      userPromise = axios.post(
        `${process.env.USER_SERVICE_URL}/api/agents/login`,
        { loginId },
        {
          timeout: 5000,
          headers: {
            "x-service-key": process.env.SERVICE_AUTH_KEY,
            "x-service-name": "AUTH-SERVICE",
          },
        }
      );
    } else {
      source = "admin";
      userPromise = axios.post(
        `${process.env.ADMIN_SERVICE_URL}/api/user/login`,
        { loginId },
        {
          timeout: 5000,
          headers: {
            "x-service-key": process.env.SERVICE_AUTH_KEY,
            "x-service-name": "AUTH-SERVICE",
          },
        }
      );
    }

    /* ── 4. Run captcha + user fetch in parallel (with per-promise error isolation) ── */
    const parallel = await runParallel(captchaPromise, userPromise);

    if (parallel.captchaError) {
      return res.status(parallel.captchaError.status).json({
        success: false,
        message: parallel.captchaError.message,
      });
    }

    if (parallel.userError) {
      return res.status(parallel.userError.status).json({
        success: false,
        message: parallel.userError.message,
      });
    }

    const user = parallel.userResponse.data?.data;

    /* ── 5. User existence check ── */
    if (!user) {
      log.warn(TAG, "User not found", { loginId });
      // Dummy bcrypt to prevent timing attack
      await bcrypt.compare(password, "$2b$10$invalidhashpadding000000000000000000000000000000000000");
      return res.status(404).json({ success: false, message: "User not found" });
    }

    log.info(TAG, "User record fetched", { userId: user.id, role: user.role, source });

    /* ── 6. Password verification ── */
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      log.warn(TAG, "Password mismatch", { userId: user.id });
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    /* ── 7. Account status check ── */
    if (source === "admin") {
      if (user.status !== "active" || user.isApprovedByAdmin !== true) {
        log.warn(TAG, "Admin account not activated", { userId: user.id, status: user.status });
        return res.status(403).json({
          success: false,
          message: "Your account is not activated by admin",
        });
      }
    } else if (source === "agent") {
      if (user.status !== "approved") {
        log.warn(TAG, "Agent account not approved", { userId: user.id, status: user.status });
        return res.status(403).json({
          success: false,
          message: "Your account is not approved yet",
        });
      }
    }

    /* ── 8. Existing session check (Redis + DB) ── */
    let existingSession;
    try {
      existingSession = await getUserSession(user.id);
      log.info(TAG, "Redis session lookup", { userId: user.id, found: !!existingSession });
    } catch (redisErr) {
      log.error(TAG, "Redis getUserSession failed", redisErr, { userId: user.id });
      // Non-fatal: proceed without session check rather than blocking login
    }

    if (existingSession) {
      let dbSession;
      try {
        dbSession = await RefreshToken.getSessionBySessionId(existingSession);
        log.info(TAG, "DB session lookup", { sessionId: existingSession, found: !!dbSession });
      } catch (dbErr) {
        log.error(TAG, "DB getSessionBySessionId failed", dbErr, { sessionId: existingSession });
        return res.status(500).json({ success: false, message: "Session check failed" });
      }

      if (dbSession) {
        log.warn(TAG, "Concurrent session conflict", {
          userId: user.id,
          sessionId: existingSession,
        });
        return res.status(409).json({
          success: false,
          message: "User already logged in from another device",
        });
      } else {
        // Stale Redis key — clean it up
        log.warn(TAG, "Stale Redis session found, cleaning up", { userId: user.id });
        try {
          await deleteUserSession(user.id);
        } catch (cleanupErr) {
          log.error(TAG, "Failed to delete stale Redis session", cleanupErr, { userId: user.id });
          // Non-fatal — continue
        }
      }
    }

    /* ── 9. Token generation ── */
    const sessionId = uuidv4();

    const tokenPayload = {
      userId: user.id,
      role: user.role,
      departmentId: user.departmentId,
      departmentName: user.departmentName,
      sessionId,
      source,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    log.info(TAG, "Tokens generated", { userId: user.id, sessionId });

    /* ── 10. Persist session ── */
    try {
      await RefreshToken.createSession({ userId: user.id, refreshToken, sessionId });
      log.info(TAG, "DB session created", { sessionId });
    } catch (dbErr) {
      log.error(TAG, "DB createSession failed", dbErr, { userId: user.id, sessionId });
      return res.status(500).json({ success: false, message: "Session creation failed" });
    }

    try {
      await createUserSession(user.id, sessionId);
      log.info(TAG, "Redis session created", { userId: user.id, sessionId });
    } catch (redisErr) {
      log.error(TAG, "Redis createUserSession failed — rolling back DB session", redisErr, {
        userId: user.id,
        sessionId,
      });
      try {
        await RefreshToken.deleteSessionBySessionId(sessionId);
      } catch (rollbackErr) {
        log.error(TAG, "Rollback of DB session also failed", rollbackErr, { sessionId });
      }
      return res.status(500).json({ success: false, message: "Session creation failed" });
    }

    log.info(TAG, "Login successful", { userId: user.id, role: user.role, sessionId });

    return res.json({
      success: true,
      accessToken,
      refreshToken,
      role: user.role,
    });
  } catch (error) {
    log.error(TAG, "Unhandled login error", error);
    return res.status(500).json({ success: false, message: "Login failed" });
  }
};

/* ─────────────────────────────────────────────
   REFRESH TOKEN
───────────────────────────────────────────── */
exports.refreshToken = async (req, res) => {
  const TAG = "REFRESH_TOKEN";

  const { refreshToken } = req.body;

  if (!refreshToken) {
    log.warn(TAG, "No refresh token in request body");
    return res.status(401).json({ message: "Refresh token required" });
  }

  try {
    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret) {
      log.error(TAG, "JWT_REFRESH_SECRET is not set", new Error("Missing env var"));
      return res.status(500).json({ message: "Server misconfiguration" });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, secret);
    } catch (jwtErr) {
      log.warn(TAG, "JWT verification failed", { error: jwtErr.message });
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    if (!decoded || typeof decoded !== "object" || !("userId" in decoded)) {
      log.warn(TAG, "Decoded token has unexpected shape", { decoded });
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const { userId, role, sessionId, departmentId, departmentName, source } = decoded;

    log.info(TAG, "Token decoded", { userId, role, sessionId });

    let session;
    try {
      session = await RefreshToken.getSessionBySessionId(sessionId);
    } catch (dbErr) {
      log.error(TAG, "DB getSessionBySessionId failed", dbErr, { sessionId });
      return res.status(500).json({ message: "Session lookup failed" });
    }

    if (!session || session.refreshToken !== refreshToken) {
      log.warn(TAG, "Session not found or token mismatch", {
        sessionId,
        sessionExists: !!session,
      });
      return res.status(401).json({ message: "Invalid session" });
    }

    if (new Date(session.expiresAt) < new Date()) {
      log.warn(TAG, "Refresh token expired", { sessionId, expiresAt: session.expiresAt });
      return res.status(401).json({ message: "Refresh token expired" });
    }

    const newAccessToken = generateAccessToken({
      userId,
      role,
      departmentId,
      departmentName,
      sessionId,
      source,
    });

    log.info(TAG, "Access token refreshed", { userId, sessionId });

    return res.json({ accessToken: newAccessToken });
  } catch (error) {
    log.error(TAG, "Unhandled refresh token error", error);
    return res.status(401).json({ message: "Invalid refresh token" });
  }
};

/* ─────────────────────────────────────────────
   HEARTBEAT
   Called by the frontend every 60 s while the tab is open.
   Slides the Redis TTL forward so the session stays alive.
   When the tab closes, heartbeats stop and Redis auto-expires the key.
───────────────────────────────────────────── */
exports.heartbeat = async (req, res) => {
  const TAG = "HEARTBEAT";

  try {
    const { userId, sessionId } = req.user; // populated by verifyToken middleware

    const refreshed = await refreshUserSession(userId, sessionId);

    if (!refreshed) {
      log.warn(TAG, "Heartbeat — session not found or mismatched, forcing re-login", {
        userId,
        sessionId,
      });
      return res.status(401).json({ success: false, message: "Session expired" });
    }

    log.info(TAG, "Session TTL refreshed", { userId, sessionId });
    return res.json({ success: true });
  } catch (error) {
    log.error(TAG, "Heartbeat error", error);
    return res.status(500).json({ success: false, message: "Heartbeat failed" });
  }
};

/* ─────────────────────────────────────────────
   BEACON LOGOUT
   Called by navigator.sendBeacon when the browser tab/window is closed.
   sendBeacon cannot set custom headers, so the access token is read from
   the request body instead of the Authorization header.
───────────────────────────────────────────── */
exports.beaconLogout = async (req, res) => {
  const TAG = "BEACON_LOGOUT";

  try {
    // Body arrives as application/x-www-form-urlencoded from sendBeacon (no CORS preflight)
    const { accessToken } = req.body;

    log.info(TAG, "Beacon received", {
      contentType: req.headers["content-type"],
      hasToken: !!accessToken,
    });

    if (!accessToken) {
      log.warn(TAG, "No access token in beacon body");
      return res.status(400).json({ success: false, message: "Token required" });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      log.error(TAG, "JWT_SECRET not set", new Error("Missing env var"));
      return res.status(500).json({ success: false, message: "Server misconfiguration" });
    }

    let decoded;
    try {
      decoded = jwt.verify(accessToken, jwtSecret);
    } catch (jwtErr) {
      // Token may be expired — still attempt cleanup using the unverified payload
      // so a closed tab with an expired token doesn't leave a stale Redis key
      decoded = jwt.decode(accessToken);
      if (!decoded) {
        log.warn(TAG, "Could not decode beacon token at all");
        return res.status(400).json({ success: false, message: "Invalid token" });
      }
    }

    if (!decoded || !decoded.userId || !decoded.sessionId) {
      log.warn(TAG, "Beacon token payload missing userId/sessionId", { decoded });
      return res.status(400).json({ success: false, message: "Invalid token payload" });
    }

    const { userId, sessionId } = decoded;

    log.info(TAG, "Beacon logout received", { userId, sessionId });

    /* ── Delete DB session ── */
    try {
      await RefreshToken.deleteSessionBySessionId(sessionId);
      log.info(TAG, "DB session deleted via beacon", { sessionId });
    } catch (dbErr) {
      log.error(TAG, "DB deleteSessionBySessionId failed in beacon logout", dbErr, { sessionId });
      // Continue — still try to clear Redis
    }

    /* ── Delete Redis session ── */
    try {
      const redisSession = await getUserSession(userId);
      if (redisSession === sessionId) {
        await deleteUserSession(userId);
        log.info(TAG, "Redis session deleted via beacon", { userId, sessionId });
      } else {
        log.warn(TAG, "Redis session mismatch in beacon logout — skip delete", {
          userId,
          expected: sessionId,
          found: redisSession,
        });
      }
    } catch (redisErr) {
      log.error(TAG, "Redis deleteUserSession failed in beacon logout", redisErr, { userId });
    }

    return res.json({ success: true, message: "Session cleared" });
  } catch (error) {
    log.error(TAG, "Unhandled beacon logout error", error);
    return res.status(500).json({ success: false, message: "Beacon logout failed" });
  }
};

/* ─────────────────────────────────────────────
   LOGOUT
───────────────────────────────────────────── */
exports.logout = async (req, res) => {
  const TAG = "LOGOUT";

  try {
    const { userId, sessionId } = req.user;

    log.info(TAG, "Logout attempt", { userId, sessionId });

    let activeSession;
    try {
      activeSession = await getUserSession(userId);
      log.info(TAG, "Redis session fetched", { userId, activeSession });
    } catch (redisErr) {
      log.error(TAG, "Redis getUserSession failed during logout", redisErr, { userId });
      // Non-fatal: proceed with DB cleanup anyway
    }

    if (activeSession && activeSession !== sessionId) {
      log.warn(TAG, "Session mismatch on logout — token belongs to replaced session", {
        userId,
        tokenSessionId: sessionId,
        activeSessionId: activeSession,
      });
      return res.status(200).json({
        success: false,
        message: "Session already replaced. Logout ignored.",
      });
    }

    /* ── Delete DB session ── */
    try {
      await RefreshToken.deleteSessionBySessionId(sessionId);
      log.info(TAG, "DB session deleted", { sessionId });
    } catch (dbErr) {
      log.error(TAG, "DB deleteSessionBySessionId failed", dbErr, { sessionId });
      return res.status(500).json({ success: false, message: "Logout failed" });
    }

    /* ── Delete Redis session ── */
    try {
      const redisSession = await getUserSession(userId);
      if (redisSession === sessionId) {
        await deleteUserSession(userId);
        log.info(TAG, "Redis session deleted", { userId, sessionId });
      } else {
        log.warn(TAG, "Redis session no longer matches — skip delete", {
          userId,
          expected: sessionId,
          found: redisSession,
        });
      }
    } catch (redisErr) {
      log.error(TAG, "Redis deleteUserSession failed", redisErr, { userId });
      // Non-fatal: DB session already cleared — user is effectively logged out
    }

    log.info(TAG, "Logout successful", { userId, sessionId });

    return res.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    log.error(TAG, "Unhandled logout error", error);
    return res.status(500).json({ success: false, message: "Logout failed" });
  }
};