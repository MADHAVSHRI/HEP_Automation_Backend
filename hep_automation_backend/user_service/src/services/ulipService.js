const axios = require("axios");
const ulipConfig = require("../config/ulipConfig");

// ── Token cache ──────────────────────────────────────────────────────────────
let cachedToken = null;
let tokenFetchedAt = null;
const TOKEN_TTL_MS = 25 * 60 * 1000; // refresh 5 min before the 30-min expiry

/**
 * Returns a valid Bearer token, logging in automatically when the token is
 * absent or older than TOKEN_TTL_MS.
 */
async function getToken() {
  const now = Date.now();
  if (cachedToken && tokenFetchedAt && now - tokenFetchedAt < TOKEN_TTL_MS) {
    return cachedToken;
  }

  try {
    const response = await axios.post(
      `${ulipConfig.baseURL}/user/login`,
      { username: ulipConfig.username, password: ulipConfig.password },
      { headers: { Accept: "application/json", "Content-Type": "application/json" } }
    );

    // The ULIP login endpoint returns the JWT directly in the Authorization header
    // or inside the response body – handle both.
    const token =
      response.headers["authorization"]?.replace("Bearer ", "") ||
      response.data?.token ||
      response.data?.accessToken ||
      response.data?.data?.token;

    if (!token) {
      throw new Error("ULIP login succeeded but no token found in response.");
    }

    cachedToken = token;
    tokenFetchedAt = now;
    console.log("[ULIP] Token refreshed successfully.");
    return cachedToken;
  } catch (error) {
    console.error("[ULIP] Login failed:", error.response?.data || error.message);
    throw new Error("Unable to authenticate with ULIP. Check ULIP_USERNAME / ULIP_PASSWORD.");
  }
}

/**
 * Build headers with a fresh token.
 */
async function buildHeaders() {
  const token = await getToken();
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

/**
 * Generic ULIP POST wrapper with automatic token retry on 401/403.
 */
async function ulipPost(endpoint, body) {
  let headers = await buildHeaders();
  try {
    const response = await axios.post(`${ulipConfig.baseURL}${endpoint}`, body, { headers });
    return response.data;
  } catch (error) {
    // If the token was rejected, force-refresh once and retry
    if (error.response?.status === 401 || error.response?.status === 403) {
      console.warn("[ULIP] Token rejected, forcing re-login...");
      cachedToken = null;
      tokenFetchedAt = null;
      headers = await buildHeaders();
      const retry = await axios.post(`${ulipConfig.baseURL}${endpoint}`, body, { headers });
      return retry.data;
    }
    throw error;
  }
}

// ── VAHAN/04 – vehicle number → JSON response ────────────────────────────────
const verifyVehicle = async (vehicleNumber) => {
  try {
    return await ulipPost("/VAHAN/04", { vehiclenumber: vehicleNumber });
  } catch (error) {
    console.error("VAHAN/04 ERROR:", error.response?.data || error.message);
    throw {
      status: error.response?.status || 500,
      message:
        error.response?.data?.message || "Unable to verify vehicle registration number.",
    };
  }
};

// ── SARATHI/02 – driving licence verification ────────────────────────────────
const verifyDL = async (dlNumber) => {
  try {
    return await ulipPost("/SARATHI/02", { dlnumber: dlNumber });
  } catch (error) {
    console.error("SARATHI/02 ERROR:", error.response?.data || error.message);
    throw {
      status: error.response?.status || 500,
      message: error.response?.data?.message || "Unable to verify driving licence.",
    };
  }
};

// ── VAHAN/05 – chassis number → JSON response ────────────────────────────────
const verifyByChassis = async (chassisNumber) => {
  try {
    return await ulipPost("/VAHAN/05", { chasisnumber: chassisNumber });
  } catch (error) {
    console.error("VAHAN/05 ERROR:", error.response?.data || error.message);
    throw {
      status: error.response?.status || 500,
      message: error.response?.data?.message || "Unable to verify chassis number.",
    };
  }
};

// ── VAHAN/06 – engine number → JSON response ─────────────────────────────────
const verifyByEngine = async (engineNumber) => {
  try {
    return await ulipPost("/VAHAN/06", { enginenumber: engineNumber });
  } catch (error) {
    console.error("VAHAN/06 ERROR:", error.response?.data || error.message);
    throw {
      status: error.response?.status || 500,
      message: error.response?.data?.message || "Unable to verify engine number.",
    };
  }
};

module.exports = {
  verifyVehicle,
  verifyDL,
  verifyByChassis,
  verifyByEngine,
};
