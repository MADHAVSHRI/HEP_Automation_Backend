const axios = require("axios");

/*
 * Notifies iportman-service that a pass has been completed, so it can register
 * the Port Entry Permit with iPortman.
 *
 * The third-party integration itself — URL, key, payload shape — lives in
 * iportman-service. This is only the trigger.
 */
const IPORTMAN_SERVICE_URL =
  process.env.IPORTMAN_SERVICE_URL || "http://localhost:5008";
const SERVICE_AUTH_KEY = process.env.SERVICE_AUTH_KEY || "";

/**
 * Fires the push without making the caller wait for it.
 *
 * The approval is already committed by the time this runs. A slow or failing
 * third party must not delay the approver's response or undo their decision,
 * so this never throws and never rejects — failures are logged and left for
 * the operator to retry.
 *
 * @param {number|string} passRequestId
 */
const notifyPassCompleted = (passRequestId) => {
  if (!passRequestId) return;

  if (!SERVICE_AUTH_KEY) {
    console.error(
      "IPORTMAN PUSH: SERVICE_AUTH_KEY is not configured; skipping push for",
      passRequestId,
    );
    return;
  }

  axios
    .post(
      `${IPORTMAN_SERVICE_URL}/api/iportman/port-entry-permit`,
      { passRequestId },
      {
        headers: {
          "Content-Type": "application/json",
          "x-service-key": SERVICE_AUTH_KEY,
          "x-service-name": "USER-SERVICE",
        },
        timeout: Number(process.env.IPORTMAN_PUSH_TIMEOUT_MS || 20000),
      },
    )
    .then((response) => {
      if (response.data?.pushed) {
        console.log("IPORTMAN PUSH: sent for pass request", passRequestId);
      } else {
        console.error(
          "IPORTMAN PUSH: not sent for pass request",
          passRequestId,
          response.data?.message,
        );
      }
    })
    .catch((error) => {
      console.error(
        "IPORTMAN PUSH: request failed for pass request",
        passRequestId,
        error.message,
      );
    });
};

module.exports = { notifyPassCompleted };
