const { successLogger, errorLogger } = require("../logger/logger");
const {
  buildPortEntryPermitPayload,
} = require("../services/portEntryPermitPayload");
const { pushPortEntryPermit } = require("../services/portEntryPermitClient");

const TAG = "PORT_ENTRY_PERMIT";

/**
 * POST /api/iportman/port-entry-permit
 * Body: { passRequestId }
 *
 * Called by user_service the moment a pass reaches COMPLETED. Always answers
 * 200: the approval is already committed, and a push failure must not read as
 * an approval failure to the caller. The body says whether the push landed.
 */
const pushPassRequest = async (req, res) => {
  const { passRequestId } = req.body || {};

  if (!passRequestId) {
    return res
      .status(400)
      .json({ success: false, message: "passRequestId is required" });
  }

  try {
    // Only a COMPLETED pass may be registered; a manual call must not push
    // one that is still under review.
    const { payload, reason } = await buildPortEntryPermitPayload(passRequestId);

    if (!payload) {
      errorLogger.error(
        `${TAG} | nothing to push | passRequestId=${passRequestId} | ${reason}`,
      );
      return res.json({ success: false, pushed: false, message: reason });
    }

    const result = await pushPortEntryPermit(payload);

    return res.json({
      success: result.success,
      pushed: result.success,
      status: result.status,
      message: result.message,
    });
  } catch (error) {
    errorLogger.error(
      `${TAG} | push errored | passRequestId=${passRequestId} | ${error.message}`,
    );
    return res.json({
      success: false,
      pushed: false,
      message: error.message,
    });
  }
};

/**
 * GET /api/iportman/port-entry-permit/:passRequestId/preview
 *
 * Returns the document that would be sent, without sending it. Kept because
 * the mapping is the part most likely to need checking against iPortman.
 */
const previewPassRequest = async (req, res) => {
  try {
    // Preview sends nothing, so it will shape a pass at any status — that is
    // the point of being able to look before the pass is finalised.
    const { payload, reason } = await buildPortEntryPermitPayload(
      req.params.passRequestId,
      { requireCompleted: false },
    );
    if (!payload) {
      return res.status(404).json({ success: false, message: reason });
    }
    return res.json({ success: true, data: payload });
  } catch (error) {
    errorLogger.error(`${TAG} | preview failed | ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { pushPassRequest, previewPassRequest };
