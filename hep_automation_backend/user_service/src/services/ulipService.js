const axios = require("axios");
const ulipConfig = require("../config/ulipConfig");

// ── Token cache ──────────────────────────────────────────────────────────────
let cachedToken = null;
let tokenFetchedAt = null;
const TOKEN_TTL_MS = 25 * 60 * 1000; // refresh 5 min before the 30-min expiry

/**
 * Attempt to obtain a fresh token via ULIP login.
 * Returns the token string or throws on failure.
 */
async function loginAndGetToken() {
  const response = await axios.post(
    `${ulipConfig.baseURL}/user/login`,
    { username: ulipConfig.username, password: ulipConfig.password },
    { headers: { Accept: "application/json", "Content-Type": "application/json" } }
  );

  // ULIP login returns the JWT in response.data.response.id
  const token =
    response.headers["authorization"]?.replace("Bearer ", "") ||
    response.data?.response?.id ||
    response.data?.token ||
    response.data?.accessToken ||
    response.data?.data?.token;

  if (!token) throw new Error("ULIP login succeeded but no token found in response.");
  return token;
}

/**
 * Returns a valid Bearer token.
 * Priority:
 *   1. In-memory cache (still within TTL)
 *   2. ULIP_STATIC_TOKEN from .env  (used when account is locked or login is unavailable)
 *   3. Fresh login via credentials
 */
async function getToken() {
  const now = Date.now();

  // 1. Use cached token if still fresh
  if (cachedToken && tokenFetchedAt && now - tokenFetchedAt < TOKEN_TTL_MS) {
    return cachedToken;
  }

  // 2. Try fresh login first (normal path)
  if (ulipConfig.username && ulipConfig.password) {
    try {
      const token = await loginAndGetToken();
      cachedToken = token;
      tokenFetchedAt = now;
      console.log("[ULIP] Token refreshed via login.");
      return cachedToken;
    } catch (loginErr) {
      const msg = loginErr.response?.data?.message || loginErr.message || "";
      console.warn("[ULIP] Login failed:", msg, "— trying static token fallback.");
    }
  }

  // 3. Fall back to static token from .env
  const staticToken = ulipConfig.staticToken;
  if (staticToken) {
    console.log("[ULIP] Using static token from ULIP_STATIC_TOKEN.");
    cachedToken = staticToken;
    tokenFetchedAt = now;
    return cachedToken;
  }

  throw new Error("Unable to authenticate with ULIP. Login failed and no ULIP_STATIC_TOKEN set.");
}

/**
 * Build headers with a valid token.
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
 * Generic ULIP POST wrapper.
 * On 401/403 the cache is cleared and we retry once — this handles
 * the static token becoming stale after the account is re-unlocked and
 * a fresh login token is issued.
 */
async function ulipPost(endpoint, body) {
  let headers = await buildHeaders();
  try {
    const response = await axios.post(`${ulipConfig.baseURL}${endpoint}`, body, { headers });
    console.log("\n================ RAW ULIP RESPONSE ================\n");

    console.dir(response.data,{
        depth:null,
        colors:true
    });

    console.log("\n===================================================\n");
    return response.data;
  } catch (error) {
    if (error.response?.status === 401 || error.response?.status === 403) {
      console.warn("[ULIP] Token rejected, clearing cache and retrying...");
      cachedToken = null;
      tokenFetchedAt = null;
      headers = await buildHeaders();
      const retry = await axios.post(`${ulipConfig.baseURL}${endpoint}`, body, { headers });
      return retry.data;
    }
    throw error;
  }
}
async function ulipRequest(endpoint, body) {

    let token = await getToken();

    try {

        return await axios.post(
            ulipConfig.baseURL + endpoint,
            body,
            {
                headers:{
                    Authorization:`Bearer ${token}`
                }
            }
        );

    } catch(err){

        if(
            err.response?.status===401 ||
            err.response?.status===403
        ){

            cachedToken=null;

            token=await getToken();

            return axios.post(
                ulipConfig.baseURL+endpoint,
                body,
                {
                    headers:{
                        Authorization:`Bearer ${token}`
                    }
                }
            );
        }

        throw err;
    }
}

function evaluateVehicleStatus(result) {
  const today = new Date();
  console.log("FULL RESULT");
  console.dir(result, { depth: null });
  console.log(JSON.stringify(result, null, 2));
  if(
        !result.response ||
        !result.response.length ||
        result.response[0].responseStatus!=="SUCCESS" ||
        !result.response[0].response
    ){

        return{

            vehicleActive:false,

            validation:{
                rcValid:false,
                insuranceValid:false,
                permitValid:false,
                fitnessValid:false,
                blacklisted:false
            }

        };

    }

  const response = result.response?.[0]?.response || {};

  const parseDate = (dateStr) => {
  if (!dateStr) return null;

  const months = {
    Jan: 0,
    Feb: 1,
    Mar: 2,
    Apr: 3,
    May: 4,
    Jun: 5,
    Jul: 6,
    Aug: 7,
    Sep: 8,
    Oct: 9,
    Nov: 10,
    Dec: 11,
  };

  const [day, month, year] = dateStr.split("-");

  if (!day || !month || !year) {
    return null;
  }

  return new Date(
    parseInt(year),
    months[month],
    parseInt(day),
    23,
    59,
    59
  );
};

  const rcDate = parseDate(response.rcRegnUpto);
  console.log("Today        :", today);
console.log("rcRegnUpto   :", response.rcRegnUpto);
console.log("Parsed RC    :", rcDate);
console.log("RC Timestamp :", rcDate?.getTime());
console.log("Today TS     :", today.getTime());
console.log("Insurance :", response.rcInsuranceUpto);
console.log("Parsed Insurance :", response.insuranceDate);

console.log("Fitness :", response.rcFitUpto);
console.log("Parsed Fitness :", response.fitnessDate);

  const rcValid =
    rcDate !== null &&
    rcDate >= today;

  const insuranceDate = parseDate(response.rcInsuranceUpto);

  const insuranceValid =
    insuranceDate !== null &&
    insuranceDate >= today;

  const permitDate = parseDate(response.rcPermitValidUpto);

const permitValid =
  response.rcPermitValidUpto == null
    ? true
    : permitDate !== null && permitDate >= today;

  const fitnessDate = parseDate(
  response.rcFitValidTo || response.rcFitUpto
);

const fitnessValid =
  fitnessDate !== null &&
  fitnessDate >= today;

  const blacklisted =
  !!response.rcBlacklistStatus &&
  response.rcBlacklistStatus.trim() !== "";

  const vehicleActive =
  result.code === "200" &&
  result.error === "false" &&
  result.response?.[0]?.responseStatus === "SUCCESS" &&
  rcValid &&
  insuranceValid &&
  fitnessValid &&
  permitValid &&
  !blacklisted &&
  response.rcStatus === "ACTIVE";

  return {
    vehicleActive,

    validation: {
      rcValid,
      insuranceValid,
      permitValid,
      fitnessValid,
      blacklisted
    }
  };
}


// ── VAHAN/04 – vehicle number → JSON response ────────────────────────────────
const verifyVehicle = async (vehicleNumber) => {
  try {
      const payload = {
        vehiclenumber: String(vehicleNumber).trim().toUpperCase()
    };

    console.log("VAHAN Payload");
    console.dir(payload,{depth:null});

    const result = await ulipPost("/VAHAN/04", payload);
    if (
        result.response &&
        result.response[0] &&
        result.response[0].responseStatus === "ERROR"
    ){
        console.error(
            "ULIP returned ERROR:",
            result.response[0].message
        );

        return {
            ...result,
            vehicleStatus:"INACTIVE",
            validation:{
                rcValid:false,
                insuranceValid:false,
                permitValid:false,
                fitnessValid:false,
                blacklisted:false
            }
        };
    }

  const status = evaluateVehicleStatus(result);

  return {
    ...result,

    vehicleStatus: status.vehicleActive
      ? "ACTIVE"
      : "INACTIVE",

    validation: status.validation
  };
    // return await ulipPost("/VAHAN/04", { vehiclenumber: vehicleNumber });
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
  evaluateVehicleStatus
};
