const axios = require("axios");

/*
 * Asks iportman-service to register a completed pass's Port Entry Permit with
 * iPortman.
 *
 * The third-party integration itself — URL, key, payload shape — lives in
 * iportman-service. This is only the trigger.
 */
const IPORTMAN_SERVICE_URL =
  process.env.IPORTMAN_SERVICE_URL || "http://localhost:5008";
const SERVICE_AUTH_KEY = process.env.SERVICE_AUTH_KEY || "";

/**
 * Shares the Port Entry Permit and waits for the outcome.
 *
 * Never throws: the approval is already committed by the time this runs, so a
 * failure is reported to the caller rather than raised.
 *
 * @param {number|string} passRequestId  Numeric id or pass reference number.
 * @returns {Promise<{pushed: boolean, message: string}>}
 */
const sharePassPermit = async (passRequestId) => {
  if (!passRequestId) {
    return { pushed: false, message: "passRequestId is required." };
  }

  if (!SERVICE_AUTH_KEY) {
    console.error(
      "IPORTMAN PUSH: SERVICE_AUTH_KEY is not configured; skipping push for",
      passRequestId,
    );
    return { pushed: false, message: "Permit sharing is not configured." };
  }

  try {
    const response = await axios.post(
      // iportman-service mounts this router under /api/cargo, not /api/iportman.
      `${IPORTMAN_SERVICE_URL}/api/cargo/port-entry-permit`,
      { passRequestId },
      {
        headers: {
          "Content-Type": "application/json",
          "x-service-key": SERVICE_AUTH_KEY,
          "x-service-name": "USER-SERVICE",
        },
        timeout: Number(process.env.IPORTMAN_PUSH_TIMEOUT_MS || 20000),
      },
    );

    const pushed = response.data?.pushed === true;
    const message =
      response.data?.message ||
      (pushed ? "Pass permit shared with iPortman." : "Pass permit was not shared.");

    if (pushed) {
      console.log("IPORTMAN PUSH: sent for pass request", passRequestId);
    } else {
      console.error("IPORTMAN PUSH: not sent for pass request", passRequestId, message);
    }
    return { pushed, message };
  } catch (error) {
    console.error(
      "IPORTMAN PUSH: request failed for pass request",
      passRequestId,
      error.message,
    );
    return {
      pushed: false,
      message: error.response?.data?.message || error.message || "Pass permit sharing failed.",
    };
  }
};

/**
 * Shares the permit without making the caller wait. Used where no one is
 * waiting on the result — marine safety's final approval.
 *
 * @param {number|string} passRequestId
 */
const notifyPassCompleted = (passRequestId) => {
  // sharePassPermit never rejects, so there is nothing to catch.
  sharePassPermit(passRequestId);
};

module.exports = { sharePassPermit, notifyPassCompleted };
