const fs = require("fs");
const { pool } = require("../dbconfig/db");
const { resolveUploadPath } = require("../utils/faceEnrollmentSync");
const { ACCESS_AREAS } = require("../constants/constants");
const { canSeeFullPII, sanitizePersonRecord } = require("../utils/dataMasking");
const { errorLogger } = require("../logger/logger");

/*
 * CISF face verification.
 *
 * face_verify only says whose face this is. Whether that person may pass is
 * decided here, from pass_persons as it stands now, so a pass that was
 * enrolled and later rejected or expired is never shown as verified.
 */

const PERSON_QUERY = `
  SELECT
    pp.id,
    pp."passRequestId",
    pr."referenceNo",
    pp."personPassNo",
    pp.name,
    pp.mobile,
    pp.email,
    pp."aadharNo",
    pp.nationality,
    c.name AS "countryName",
    pp.dob,
    a."entityName" AS company,
    COALESCE(d.name, pp."designationOther") AS designation,
    ht.name AS "hepType",
    pp."accessAreaId",
    pp."passType",
    pp."passPeriod",
    pp."dateFrom",
    pp."dateTo",
    pp."idProofType",
    pp."idProofNumber",
    pp."vehicleNo",
    pp.status,
    pp."photoFilePath",
    pp."LivePhotoPath",
    pp."FaceEnrolledAt",
    (CURRENT_DATE BETWEEN pp."dateFrom"::date AND pp."dateTo"::date) AS "isWithinValidity"
  FROM pass_persons pp
  JOIN pass_requests pr ON pr.id = pp."passRequestId"
  LEFT JOIN "Agents" a ON a.id = pr."agentId"
  LEFT JOIN designations d ON d.id = pp."designationId"
  LEFT JOIN hep_types ht ON ht.id = pp."hepTypeId"
  LEFT JOIN countries c ON c.id = pp."countryId"
`;

const accessAreaLabel = (accessAreaId) => {
  const area = ACCESS_AREAS.find(
    (a) => String(a.id) === String(accessAreaId) || a.value === String(accessAreaId).toUpperCase(),
  );
  return area ? area.value : accessAreaId;
};

// Same operating point as face_verify's recognitionEngine.
const MATCH_THRESHOLD = 0.48;
const MIN_RANK_MARGIN = 0.03;

const notVerified = (res, reason, message, confidence = null) =>
  res.json({ success: true, verified: false, reason, message, confidence });

/** POST /api/pass-request/face-verify — CISF scans a face. */
const verifyFace = async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ success: false, message: "photo is required" });
    }

    const form = new FormData();
    form.append("photo", new Blob([req.file.buffer], { type: "image/jpeg" }), "scan.jpg");

    const response = await fetch(`${process.env.FACE_VERIFY_URL}/api/face/passenger/identify`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(30000),
    });
    const match = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`face_verify responded ${response.status}: ${match.message || ""}`);
    }

    if (match.biometric_status === "RECAPTURE_REQUIRED") {
      return notVerified(res, "RECAPTURE", "Face not clear. Please scan again.");
    }

    // Only HEP pass holders can be verified, so the decision is made among
    // them alone: an LFW test entry (even of the same face) cannot outrank or
    // crowd out a pass holder, and several passes of one person are one match.
    const hep = (match.candidates || []).filter(
      (c) => c.passPersonId && c.similarity >= MATCH_THRESHOLD,
    );
    if (hep.length === 0) {
      return notVerified(res, "NO_MATCH", "No approved pass holder matches this face.", match.similarity ?? null);
    }

    const personKey = (c) => (c.masterPersonId ? `m${c.masterPersonId}` : `p${c.passPersonId}`);
    const best = hep[0];
    const rival = hep.find((c) => personKey(c) !== personKey(best));
    if (rival && best.similarity - rival.similarity < MIN_RANK_MARGIN) {
      return notVerified(res, "AMBIGUOUS", "Face matches more than one pass holder. Please scan again.", best.similarity);
    }

    const passIds = hep.filter((c) => personKey(c) === personKey(best)).map((c) => c.passPersonId);
    const { rows } = await pool.query(`${PERSON_QUERY} WHERE pp.id = ANY($1::int[])`, [passIds]);
    const approved = rows.filter((r) => r.status === "approved" && r.LivePhotoPath);
    const person = approved.find((r) => r.isWithinValidity);

    if (approved.length === 0) {
      return notVerified(res, "PASS_NOT_APPROVED", "This person does not hold an approved pass.", best.similarity);
    }
    if (!person) {
      return notVerified(res, "PASS_NOT_VALID_TODAY", "This person's pass is not valid today.", best.similarity);
    }

    const { photoFilePath, LivePhotoPath, FaceEnrolledAt, isWithinValidity, ...details } = person;

    return res.json({
      success: true,
      verified: true,
      message: "Verified",
      confidence: best.similarity,
      person: {
        ...sanitizePersonRecord(details, canSeeFullPII(req.user?.role)),
        accessArea: accessAreaLabel(person.accessAreaId),
        hasUploadedPhoto: Boolean(photoFilePath),
        hasLivePhoto: Boolean(LivePhotoPath),
      },
    });
  } catch (error) {
    errorLogger.error(`${new Date().toISOString()} | faceVerify | ${error.stack || error.message}`);
    return res.status(502).json({ success: false, message: "Face verification is unavailable. Please try again." });
  }
};

/**
 * GET /api/pass-request/face-verify/photo/:personId?kind=uploaded|live
 *
 * Only for enrolled, approved persons: this route exists for the result
 * screen, not as a general way to read any applicant's photo.
 */
const getPersonPhoto = async (req, res) => {
  try {
    const column = req.query.kind === "live" ? "LivePhotoPath" : "photoFilePath";
    const { rows } = await pool.query(
      `SELECT "${column}" AS "filePath"
         FROM pass_persons
        WHERE id = $1 AND status = 'approved' AND "FaceEnrolledAt" IS NOT NULL`,
      [Number(req.params.personId)],
    );

    const absolutePath = resolveUploadPath(rows[0]?.filePath);
    if (!absolutePath || !fs.existsSync(absolutePath)) {
      return res.status(404).json({ success: false, message: "Photo not found" });
    }
    return res.sendFile(absolutePath);
  } catch (error) {
    errorLogger.error(`${new Date().toISOString()} | faceVerifyPhoto | ${error.stack || error.message}`);
    return res.status(500).json({ success: false, message: "Could not load photo" });
  }
};

/** GET /api/pass-request/face-verify/enrolled — pass holders a scan can match. */
const getEnrolledPersons = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT pp.id, pp."personPassNo", pp.name, a."entityName" AS company,
              COALESCE(d.name, pp."designationOther") AS designation,
              pp."accessAreaId", pp."dateTo"
         FROM pass_persons pp
         JOIN pass_requests pr ON pr.id = pp."passRequestId"
         LEFT JOIN "Agents" a ON a.id = pr."agentId"
         LEFT JOIN designations d ON d.id = pp."designationId"
        WHERE pp.status = 'approved'
          AND pp."FaceEnrolledAt" IS NOT NULL
          AND pp."dateTo"::date >= CURRENT_DATE
        ORDER BY pp.name`,
    );

    return res.json({
      success: true,
      data: rows.map((row) => ({ ...row, accessArea: accessAreaLabel(row.accessAreaId) })),
    });
  } catch (error) {
    errorLogger.error(`${new Date().toISOString()} | faceVerifyEnrolled | ${error.stack || error.message}`);
    return res.status(500).json({ success: false, message: "Could not load enrolled persons" });
  }
};

module.exports = { verifyFace, getPersonPhoto, getEnrolledPersons };
