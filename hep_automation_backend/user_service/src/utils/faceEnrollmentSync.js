const fs = require("fs");
const path = require("path");
const { pool } = require("../dbconfig/db");

/**
 * Enrolls approved persons' live photos into the face_verify gallery.
 *
 * Runs on a timer rather than from each approval path, so every way a person
 * becomes 'approved' is covered, people approved before this existed are
 * picked up too, and a face_verify outage only delays enrollment.
 */

const SYNC_INTERVAL_MS = 60 * 1000;
const BATCH_SIZE = 50;

let running = false;

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

/**
 * Absolute path of a stored upload, or null when the stored value points
 * outside uploads/ — file path columns can be written from request bodies, so
 * they are not trusted as filesystem paths on their own.
 */
function resolveUploadPath(storedPath) {
  if (!storedPath) return null;
  const absolutePath = path.resolve(process.cwd(), storedPath);
  return absolutePath.startsWith(UPLOADS_DIR + path.sep) ? absolutePath : null;
}

async function enrollPerson(person) {
  const filePath = resolveUploadPath(person.LivePhotoPath);
  if (!filePath || !fs.existsSync(filePath)) {
    return { permanentError: "Live photo file missing on server" };
  }

  const form = new FormData();
  form.append(
    "photo",
    new Blob([fs.readFileSync(filePath)], { type: "image/jpeg" }),
    path.basename(filePath),
  );
  form.append("passPersonId", String(person.id));
  if (person.masterPersonId) form.append("masterPersonId", String(person.masterPersonId));
  form.append("name", person.name);
  form.append("passNumber", person.personPassNo);
  if (person.dateTo) form.append("expiryDate", new Date(person.dateTo).toISOString());

  const response = await fetch(`${process.env.FACE_VERIFY_URL}/api/face/hep/enroll`, {
    method: "POST",
    headers: { "x-service-key": process.env.SERVICE_AUTH_KEY || "" },
    body: form,
    signal: AbortSignal.timeout(30000),
  });

  if (response.ok) return {};
  const body = await response.json().catch(() => ({}));
  if (response.status === 422) return { permanentError: body.message || "No face detected" };
  throw new Error(`face_verify responded ${response.status}: ${body.message || ""}`);
}

async function syncFaceEnrollments() {
  if (running || !process.env.FACE_VERIFY_URL) return;
  running = true;
  try {
    const { rows } = await pool.query(
      `SELECT id, "masterPersonId", name, "personPassNo", "dateTo", "LivePhotoPath"
         FROM pass_persons
        WHERE status = 'approved'
          AND "LivePhotoPath" IS NOT NULL
          AND "FaceEnrolledAt" IS NULL
          AND "FaceEnrollError" IS NULL
        ORDER BY id
        LIMIT $1`,
      [BATCH_SIZE],
    );

    for (const person of rows) {
      try {
        const { permanentError } = await enrollPerson(person);
        if (permanentError) {
          await pool.query(
            `UPDATE pass_persons SET "FaceEnrollError" = $2 WHERE id = $1`,
            [person.id, permanentError.slice(0, 500)],
          );
          console.warn(`[FaceEnrollmentSync] Person ${person.id} not enrolled: ${permanentError}`);
        } else {
          await pool.query(
            `UPDATE pass_persons SET "FaceEnrolledAt" = NOW() WHERE id = $1`,
            [person.id],
          );
          console.log(`[FaceEnrollmentSync] Enrolled person ${person.id} (${person.personPassNo})`);
        }
      } catch (err) {
        // face_verify unreachable or failing: stop this run and retry later.
        console.error(`[FaceEnrollmentSync] Person ${person.id}: ${err.message}`);
        break;
      }
    }
  } catch (error) {
    console.error("[FaceEnrollmentSync] Sync error:", error.message);
  } finally {
    running = false;
  }
}

function startFaceEnrollmentSync() {
  syncFaceEnrollments();
  setInterval(syncFaceEnrollments, SYNC_INTERVAL_MS);
}

module.exports = { syncFaceEnrollments, startFaceEnrollmentSync, resolveUploadPath };
