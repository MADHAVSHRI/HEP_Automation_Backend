const https = require("https");
const axios = require("axios");

const log = require("../logger/logger");

const TAG = "PORT_ENTRY_PERMIT_CLIENT";

const DEFAULT_URL = "https://115.124.102.26:8001/iportman/portentrypermit";

/*
 * The endpoint is addressed by IP over TLS, so its certificate cannot match a
 * hostname. Verification is therefore disabled for this one client — never for
 * the process as a whole, which is why the agent is scoped here rather than set
 * through NODE_TLS_REJECT_UNAUTHORIZED.
 *
 * Set IPORTMAN_PUSH_STRICT_TLS=true once the endpoint presents a certificate
 * that chains to a trusted root.
 */
const httpsAgent = new https.Agent({
  rejectUnauthorized: process.env.IPORTMAN_PUSH_STRICT_TLS === "true",
});

const client = axios.create({
  httpsAgent,
  // A slow third party must not hold a database transaction or a user's
  // request open; the caller treats a timeout as a failed push and moves on.
  timeout: Number(process.env.IPORTMAN_PUSH_TIMEOUT_MS || 15000),
  // Read the body ourselves rather than letting axios throw on 4xx/5xx, so the
  // remote system's own error text reaches the log.
  validateStatus: () => true,
});

/**
 * Pushes one Port Entry Permit to the iPortman system.
 *
 * Never throws: a push failure must not roll back an approval that has already
 * been committed. The result says what happened so the caller can log it.
 *
 * @param {object} payload  The PortEntryPermit document.
 * @returns {Promise<{success: boolean, status: number|null, data: any, message: string}>}
 */
const pushPortEntryPermit = async (payload) => {
  const url = process.env.IPORTMAN_PUSH_URL || DEFAULT_URL;
  const apiKey = process.env.IPORTMAN_PUSH_API_KEY;

  if (!apiKey) {
    const message =
      "IPORTMAN_PUSH_API_KEY is not configured; skipping Port Entry Permit push.";
    log.error(TAG, message, new Error("Missing env var"));
    return { success: false, status: null, data: null, message };
  }

  const reference = payload?.PortEntryPermit?.PassReferenceNo || "unknown";

  try {
    log.info(TAG, "Pushing Port Entry Permit", { reference, url });

    const response = await client.post(url, payload, {
      headers: {
        "Content-Type": "application/json",
        "X-Gravitee-Api-Key": apiKey,
      },
    });

    const ok = response.status >= 200 && response.status < 300;

    if (ok) {
      log.info(TAG, "Port Entry Permit accepted", {
        reference,
        status: response.status,
      });
    } else {
      log.error(TAG, "Port Entry Permit rejected", new Error("Non-2xx"), {
        reference,
        status: response.status,
        body: response.data,
      });
    }

    return {
      success: ok,
      status: response.status,
      data: response.data,
      message: ok
        ? "Port Entry Permit pushed successfully."
        : `iPortman responded with ${response.status}.`,
    };
  } catch (error) {
    // Network failure, DNS, TLS handshake or timeout.
    log.error(TAG, "Port Entry Permit push failed", error, { reference });
    return {
      success: false,
      status: null,
      data: null,
      message: error.message || "Port Entry Permit push failed.",
    };
  }
};

module.exports = { pushPortEntryPermit };
