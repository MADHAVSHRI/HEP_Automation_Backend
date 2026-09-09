const fs = require("fs");
const sessionService = require("../services/sessionService");
const realtime = require("../services/realtime");
const { errorLogger } = require("../logger/logger");

const REFERENCE_PATTERN = /^[A-Za-z0-9._:\-/]{1,128}$/;

const fail = (res, error, fallbackMessage) => {
  if (error instanceof sessionService.SessionError) {
    return res.status(error.status).json({ code: error.code, message: error.message });
  }
  if (error instanceof sessionService.ImageError) {
    return res.status(400).json({ code: error.code, message: error.message });
  }
  errorLogger.error(`${new Date().toISOString()} | face_verify | ${error.stack || error.message}`);
  return res.status(500).json({ code: "SERVER_ERROR", message: fallbackMessage });
};

/** POST /api/face/sessions — the portal asks for a link. */
const createSession = async (req, res) => {
  try {
    const { referenceId, applicantName, ttlMinutes } = req.body || {};

    if (!referenceId || !REFERENCE_PATTERN.test(String(referenceId))) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "referenceId is required and must be 1-128 characters of A-Z a-z 0-9 . _ : - /",
      });
    }

    const session = await sessionService.createSession({
      referenceId: String(referenceId),
      applicantName: applicantName ? String(applicantName).slice(0, 150) : null,
      agentId: req.user?.id || req.user?.agentId || null,
      ttlMinutes,
    });

    return res.status(201).json(session);
  } catch (error) {
    return fail(res, error, "Could not create the capture link.");
  }
};

/** GET /api/face/sessions/:id?t= — one read, covering anything missed before the stream opened. */
const getSession = async (req, res) => {
  try {
    const state = await sessionService.getStateForSubscriber(req.params.id, req.query.t);
    return res.json(state);
  } catch (error) {
    return fail(res, error, "Could not read the session.");
  }
};

/** GET /api/face/sessions/:id/stream?t= — the live channel the portal listens on. */
const streamSession = async (req, res) => {
  try {
    const state = await sessionService.getStateForSubscriber(req.params.id, req.query.t);
    realtime.attach(req, res, req.params.id);
    // Send the current state at once, so a screen is correct the moment it
    // connects rather than only at the next transition.
    res.write(`event: session.state\ndata: ${JSON.stringify(state)}\n\n`);
  } catch (error) {
    return fail(res, error, "Could not open the stream.");
  }
};

/** POST /api/face/sessions/:id/cancel */
const cancelSession = async (req, res) => {
  try {
    const state = await sessionService.cancelSession(
      req.params.id,
      req.user?.id || req.user?.agentId || null
    );
    return res.json(state);
  } catch (error) {
    return fail(res, error, "Could not cancel the session.");
  }
};

/** GET /api/face/capture/:token — the applicant opens the link. */
const openCapture = async (req, res) => {
  try {
    const row = await sessionService.openCaptureSession(req.params.token);
    // The applicant is told only what they need: who this is for and how long
    // they have. Nothing about the application itself.
    return res.json({
      referenceId: row.referenceId,
      applicantName: row.applicantName,
      status: row.status,
      expiresAt: row.expiresAt,
    });
  } catch (error) {
    return fail(res, error, "Could not open this link.");
  }
};

/** POST /api/face/capture/:token/photo */
const submitPhoto = async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ code: "PHOTO_MISSING", message: "No photo was received." });
    }

    const state = await sessionService.submitPhoto(req.params.token, req.file.buffer);
    return res.status(201).json({ status: state.status, completedAt: state.completedAt });
  } catch (error) {
    return fail(res, error, "Could not save the photo.");
  }
};

/** GET /api/face/photos/:sessionId?t= — the portal renders this. */
const getPhoto = async (req, res) => {
  try {
    const photo = await sessionService.getPhotoForSubscriber(req.params.sessionId, req.query.t);

    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("X-Content-Type-Options", "nosniff");
    // A photograph of a person is personal data; it must not come to rest in a
    // shared cache between the applicant and the officer looking at it.
    res.setHeader("Cache-Control", "private, no-store");

    return fs.createReadStream(photo.path).pipe(res);
  } catch (error) {
    return fail(res, error, "Could not read the photo.");
  }
};

module.exports = {
  createSession,
  getSession,
  streamSession,
  cancelSession,
  openCapture,
  submitPhoto,
  getPhoto,
};
