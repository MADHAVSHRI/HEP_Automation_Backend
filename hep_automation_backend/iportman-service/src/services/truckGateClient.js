const https = require("https");
const axios = require("axios");

const { successLogger, errorLogger } = require("../logger/logger");

const TAG = "TRUCK_GATE_CLIENT";

const DEFAULT_GATE_IN_URL = "https://115.124.102.26:8001/iportman/truckgatein";
const DEFAULT_GATE_OUT_URL = "https://115.124.102.26:8001/iportman/truckgateout";

/*
 * Same host as the Port Entry Permit endpoint: addressed by IP over TLS, so its
 * certificate cannot match a hostname. Verification is disabled for this client
 * only — never process-wide — and can be turned back on with
 * IPORTMAN_PUSH_STRICT_TLS=true once a trusted certificate is presented.
 */
const httpsAgent = new https.Agent({
  rejectUnauthorized: process.env.IPORTMAN_PUSH_STRICT_TLS === "true",
});

const client = axios.create({
  httpsAgent,
  timeout: Number(process.env.IPORTMAN_PUSH_TIMEOUT_MS || 15000),
  // Read the status ourselves so the remote system's own error text reaches
  // the log rather than being swallowed by an axios throw.
  validateStatus: () => true,
});

/**
 * Posts one document to an iPortman truck-gate endpoint.
 *
 * Never throws: a gate movement is a record of something that already
 * happened, so a failed push must not fail the caller's own operation. The
 * result says what happened.
 */
const post = async ({ url, apiKey, apiKeyName, payload, reference, label }) => {
  if (!apiKey) {
    const message = `${apiKeyName} is not configured; skipping ${label} push.`;
    errorLogger.error(`${TAG} | ${message}`);
    console.error(TAG, message);
    return { success: false, status: null, data: null, message };
  }

  try {
    successLogger.info(`${TAG} | pushing ${label} | ref=${reference} | url=${url}`);

    const response = await client.post(url, payload, {
      headers: {
        "Content-Type": "application/json",
        "X-Gravitee-Api-Key": apiKey,
      },
    });

    const ok = response.status >= 200 && response.status < 300;

    if (ok) {
      successLogger.info(
        `${TAG} | ${label} accepted | ref=${reference} | status=${response.status}`,
      );
    } else {
      errorLogger.error(
        `${TAG} | ${label} rejected | ref=${reference} | ` +
          `status=${response.status} | body=${JSON.stringify(response.data)}`,
      );
    }

    return {
      success: ok,
      status: response.status,
      data: response.data,
      message: ok
        ? `${label} pushed successfully.`
        : `iPortman responded with ${response.status}.`,
    };
  } catch (error) {
    // Network failure, DNS, TLS handshake or timeout.
    errorLogger.error(
      `${TAG} | ${label} push failed | ref=${reference} | ${error.message}`,
    );
    return {
      success: false,
      status: null,
      data: null,
      message: error.message || `${label} push failed.`,
    };
  }
};

/**
 * Pushes a truck gate-in movement.
 * @param {object} payload The TruckGateIn document.
 */
const pushTruckGateIn = (payload) =>
  post({
    url: process.env.IPORTMAN_TRUCK_GATE_IN_URL || DEFAULT_GATE_IN_URL,
    // Each endpoint carries its own Gravitee key; they are not interchangeable.
    apiKey: process.env.IPORTMAN_TRUCK_GATE_IN_API_KEY,
    apiKeyName: "IPORTMAN_TRUCK_GATE_IN_API_KEY",
    payload,
    reference: payload?.TruckGateIn?.VehiclePassReferenceNo || "unknown",
    label: "Truck Gate-In",
  });

/**
 * Pushes a truck gate-out movement.
 * @param {object} payload The TruckGateOut document.
 */
const pushTruckGateOut = (payload) =>
  post({
    url: process.env.IPORTMAN_TRUCK_GATE_OUT_URL || DEFAULT_GATE_OUT_URL,
    apiKey: process.env.IPORTMAN_TRUCK_GATE_OUT_API_KEY,
    apiKeyName: "IPORTMAN_TRUCK_GATE_OUT_API_KEY",
    payload,
    reference: payload?.TruckGateOut?.VehiclePassReferenceNo || "unknown",
    label: "Truck Gate-Out",
  });

module.exports = { pushTruckGateIn, pushTruckGateOut };
