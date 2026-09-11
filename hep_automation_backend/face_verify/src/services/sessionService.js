const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const { pool } = require("../dbconfig/db");
const { generateToken, hashToken } = require("../utils/crypto");
const { processAndStore, ImageError } = require("../utils/image");
const realtime = require("./realtime");

const UPLOAD_DIR = path.resolve(
  __dirname,
  "../../uploads/liveCaptures"
);

const DEFAULT_TTL_MINUTES = Number(process.env.SESSION_TTL_MINUTES || 30);
const MAX_UPLOAD_ATTEMPTS = Number(process.env.MAX_UPLOAD_ATTEMPTS || 5);

class SessionError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "SessionError";
    this.status = status;
    this.code = code;
  }
}

/**
 * What a watching screen is told.
 *
 * The whole state every time, never a delta — a screen that reconnects after a
 * dropped connection is then correct immediately, with nothing to replay.
 */
const toState = (row) => ({
  sessionId: row.id,
  referenceId: row.referenceId,
  applicantName: row.applicantName,
  status: row.status,
  expiresAt: row.expiresAt,
  openedAt: row.openedAt,
  completedAt: row.completedAt,
  // A path, never a token. Live credentials must not travel inside a broadcast
  // or come to rest in a log; the portal appends its own.
  photoUrl: row.livePhotoPath ? `/api/face/photos/${row.id}` : null,
});

const findByCaptureToken = async (token) => {
  const { rows } = await pool.query(
    `SELECT * FROM face_capture_sessions WHERE "captureTokenHash" = $1`,
    [hashToken(token)]
  );
  return rows[0] || null;
};

/** The applicant's link for a capture token. */
const captureUrlFor = (token) => {
  const base = (process.env.CAPTURE_BASE_URL || "http://localhost:4200").replace(/\/+$/, "");
  return `${base}/c/${token}`;
};

/** The token inside a capture link, or null if it is not one. */
const captureTokenFromLink = (link) => {
  try {
    const match = new URL(String(link)).pathname.match(/\/c\/([A-Za-z0-9_-]+)\/?$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
};

const findById = async (sessionId) => {
  const { rows } = await pool.query(
    `SELECT * FROM face_capture_sessions WHERE id = $1`,
    [sessionId]
  );
  return rows[0] || null;
};

/** Marks a lapsed row terminal so the state stops lying about itself. */
const expireIfLapsed = async (row) => {
  if (row.status === "COMPLETED" || row.status === "CANCELLED") return row;
  if (new Date(row.expiresAt).getTime() > Date.now()) return row;

  const { rows } = await pool.query(
    `UPDATE face_capture_sessions
        SET status = 'EXPIRED', "updatedAt" = NOW()
      WHERE id = $1
      RETURNING *`,
    [row.id]
  );
  const updated = rows[0];
  realtime.publish(updated.id, toState(updated));
  return updated;
};

const createSession = async ({ referenceId, applicantName, agentId, ttlMinutes }) => {
  const captureToken = generateToken();
  const subscriberToken = generateToken();
  const id = crypto.randomUUID();

  const minutes = Math.min(Math.max(Number(ttlMinutes) || DEFAULT_TTL_MINUTES, 1), 1440);
  const expiresAt = new Date(Date.now() + minutes * 60 * 1000);

  const { rows } = await pool.query(
    `INSERT INTO face_capture_sessions
      (id,"referenceId","applicantName","agentId","captureTokenHash","subscriberTokenHash",
       status,"uploadAttempts","expiresAt","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,'PENDING',0,$7,NOW(),NOW())
     RETURNING *`,
    [
      id,
      referenceId,
      applicantName || null,
      agentId || null,
      hashToken(captureToken),
      hashToken(subscriberToken),
      expiresAt,
    ]
  );

  // Both tokens are returned exactly once. Only their digests were stored.
  return {
    ...toState(rows[0]),
    captureUrl: captureUrlFor(captureToken),
    subscriberToken,
  };
};

/**
 * Opens a link for the applicant.
 *
 * Every refusal is a distinct code so the phone can say something the person
 * can act on, rather than a generic failure.
 */
const openCaptureSession = async (token) => {
  const found = await findByCaptureToken(token);
  if (!found) throw new SessionError(404, "LINK_INVALID", "This link is not valid.");

  const row = await expireIfLapsed(found);

  if (row.status === "COMPLETED") {
    throw new SessionError(409, "LINK_ALREADY_USED", "A photo was already sent.");
  }
  if (row.status === "CANCELLED") {
    throw new SessionError(409, "LINK_CANCELLED", "This request was withdrawn.");
  }
  if (row.status === "EXPIRED") {
    throw new SessionError(410, "LINK_EXPIRED", "This link has expired.");
  }
  if (row.uploadAttempts >= MAX_UPLOAD_ATTEMPTS) {
    throw new SessionError(429, "TOO_MANY_ATTEMPTS", "Too many attempts.");
  }

  // First open moves it to OPENED, which is what tells the agent the applicant
  // is actually there. A reopen must not reset that.
  if (row.status === "PENDING") {
    const { rows } = await pool.query(
      `UPDATE face_capture_sessions
          SET status = 'OPENED', "openedAt" = NOW(), "updatedAt" = NOW()
        WHERE id = $1
        RETURNING *`,
      [row.id]
    );
    realtime.publish(rows[0].id, toState(rows[0]));
    return rows[0];
  }

  return row;
};

/**
 * Stores the photograph and tells the watching screen.
 *
 * The file is written before the row is committed. A crash between the two
 * leaves an orphaned file, which is harmless; the reverse ordering would leave
 * the portal showing a broken image it could never recover from.
 */
const submitPhoto = async (token, buffer) => {
  const row = await openCaptureSession(token);

  await pool.query(
    `UPDATE face_capture_sessions
        SET "uploadAttempts" = "uploadAttempts" + 1, "updatedAt" = NOW()
      WHERE id = $1`,
    [row.id]
  );

  const stored = await processAndStore(buffer, UPLOAD_DIR, `live_${row.id}`);

  try {
    const { rows } = await pool.query(
      `UPDATE face_capture_sessions
          SET status = 'COMPLETED',
              "livePhotoPath" = $2,
              "livePhotoName" = $3,
              "completedAt" = NOW(),
              "updatedAt" = NOW()
        WHERE id = $1
        RETURNING *`,
      [row.id, stored.path, stored.fileName]
    );

    realtime.publish(rows[0].id, toState(rows[0]));
    return toState(rows[0]);
  } catch (error) {
    // The row never committed, so nothing must be left claiming otherwise.
    await fs.promises.unlink(stored.path).catch(() => {});
    throw error;
  }
};

/**
 * Reads a session on behalf of a watching screen.
 *
 * A wrong token is 404, not 403 — the same answer as a session that does not
 * exist, so session ids cannot be probed for validity.
 */
const getStateForSubscriber = async (sessionId, subscriberToken) => {
  const row = await findById(sessionId);
  if (!row || !subscriberToken) {
    throw new SessionError(404, "NOT_FOUND", "Not found.");
  }
  if (row.subscriberTokenHash !== hashToken(subscriberToken)) {
    throw new SessionError(404, "NOT_FOUND", "Not found.");
  }
  return toState(await expireIfLapsed(row));
};

const getPhotoForSubscriber = async (sessionId, subscriberToken) => {
  const row = await findById(sessionId);
  if (!row || !subscriberToken) {
    throw new SessionError(404, "NOT_FOUND", "Not found.");
  }
  if (row.subscriberTokenHash !== hashToken(subscriberToken)) {
    throw new SessionError(404, "NOT_FOUND", "Not found.");
  }
  if (!row.livePhotoPath || !fs.existsSync(row.livePhotoPath)) {
    throw new SessionError(404, "NOT_FOUND", "Not found.");
  }
  return { path: row.livePhotoPath, fileName: row.livePhotoName };
};

const cancelSession = async (sessionId, agentId) => {
  const row = await findById(sessionId);
  if (!row || (row.agentId && agentId && row.agentId !== agentId)) {
    throw new SessionError(404, "NOT_FOUND", "Not found.");
  }
  if (row.status === "COMPLETED") {
    throw new SessionError(409, "LINK_ALREADY_USED", "A photo was already sent.");
  }

  const { rows } = await pool.query(
    `UPDATE face_capture_sessions
        SET status = 'CANCELLED', "updatedAt" = NOW()
      WHERE id = $1
      RETURNING *`,
    [sessionId]
  );
  realtime.publish(rows[0].id, toState(rows[0]));
  return toState(rows[0]);
};

/**
 * Emails a capture link to the applicant from the port's mail address.
 *
 * Only the link's own token is trusted: it must hash to this session's capture
 * token, so the caller has to already hold the link they are sending, and the
 * address in the email is rebuilt here rather than taken from the request. The
 * endpoint therefore cannot be used to mail an arbitrary URL under the port's
 * name.
 */
const emailCaptureLink = async ({ sessionId, agentId, email, link, agentName }) => {
  const found = await findById(sessionId);
  if (!found || (found.agentId && agentId && found.agentId !== agentId)) {
    throw new SessionError(404, "NOT_FOUND", "Not found.");
  }

  const token = captureTokenFromLink(link);
  if (!token || hashToken(token) !== found.captureTokenHash) {
    throw new SessionError(400, "LINK_MISMATCH", "This link does not belong to this capture request.");
  }

  const row = await expireIfLapsed(found);
  if (row.status === "COMPLETED") {
    throw new SessionError(409, "LINK_ALREADY_USED", "A photo was already sent on this link.");
  }
  if (row.status === "CANCELLED") {
    throw new SessionError(409, "LINK_CANCELLED", "This link was cancelled.");
  }
  if (row.status === "EXPIRED") {
    throw new SessionError(410, "LINK_EXPIRED", "This link has expired. Create a new one.");
  }

  const emailServiceUrl = (process.env.EMAIL_SERVICE_URL || "").replace(/\/+$/, "");
  if (!emailServiceUrl) {
    throw new Error("EMAIL_SERVICE_URL is not configured");
  }

  let response;
  try {
    response = await fetch(`${emailServiceUrl}/api/email/sendPhotoCaptureLink`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        personName: row.applicantName,
        agentName,
        link: captureUrlFor(token),
      }),
      signal: AbortSignal.timeout(30000),
    });
  } catch (error) {
    throw new SessionError(502, "EMAIL_FAILED", "The email could not be sent. Please try again.");
  }
  if (!response.ok) {
    throw new SessionError(502, "EMAIL_FAILED", "The email could not be sent. Please try again.");
  }
};

module.exports = {
  createSession,
  emailCaptureLink,
  openCaptureSession,
  submitPhoto,
  getStateForSubscriber,
  getPhotoForSubscriber,
  cancelSession,
  toState,
  SessionError,
  ImageError,
  MAX_UPLOAD_ATTEMPTS,
};
