const { pool } = require("../dbconfig/db");
const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");

/**
 * Format a date value for IST display without UTC conversion artifacts.
 * PostgreSQL DATE/TIMESTAMP values when converted with toLocaleString
 * show 5:30 AM instead of midnight due to UTC→IST conversion.
 * This helper extracts the calendar date and treats it as IST.
 */
const formatISTDateTime = (dateValue, isEndOfDay = false) => {
  if (!dateValue) return null;

  let dateStr;
  if (dateValue instanceof Date) {
    dateStr = dateValue.toISOString();
  } else if (typeof dateValue === "string") {
    dateStr = dateValue.trim();
  } else {
    return null;
  }

  // Try to extract full datetime: YYYY-MM-DD HH:MM:SS or YYYY-MM-DDTHH:MM:SS
  // This preserves the actual time from DB without UTC→IST shifting
  const dtMatch = dateStr.match(
    /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):(\d{2})/
  );
  if (dtMatch) {
    const [, year, month, day, hour, minute] = dtMatch;
    // Build IST datetime using the EXTRACTED time (not converted)
    const istDateStr = `${year}-${month}-${day}T${hour}:${minute}:00+05:30`;
    const d = new Date(istDateStr);
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    });
  }

  // Fallback: date only (YYYY-MM-DD)
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const [, year, month, day] = match;
  const hour = isEndOfDay ? 23 : 0;
  const minute = isEndOfDay ? 59 : 0;
  const istDateStr = `${year}-${month}-${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+05:30`;
  const d = new Date(istDateStr);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
};

exports.getQrData = async (passRequestId, type ='null', entityId='null') => {

  const personsQuery = `
  SELECT
    pp.id,
    pp."passRequestId",
    pp."qrUuid",
    pr."referenceNo",
    pp.name,
    pp.mobile,
    pp."aadharNo",
    pp."personPassNo",
    pp."dateFrom",
    pp."dateTo",
    pp."photoFilePath",
    a."entityName" AS company
  FROM pass_persons pp
  JOIN pass_requests pr ON pr.id = pp."passRequestId"
  JOIN "Agents" a ON a.id = pr."agentId"
  WHERE pp."passRequestId"=$1
  AND pp.status='approved'
  ${type === "person" && entityId ? `AND pp.id=${Number(entityId)}` : ""}
  `;

  const vehiclesQuery = `
  SELECT
    pv.id,
    pv."passRequestId",
    pv."qrUuid",
    pr."referenceNo",
    pv."registrationNo",
    pv."vehiclePassNo",
    pv."dateFrom",
    pv."dateTo",
    a."entityName" AS company
  FROM pass_vehicles pv
  JOIN pass_requests pr ON pr.id = pv."passRequestId"
  JOIN "Agents" a ON a.id = pr."agentId"
  WHERE pv."passRequestId"=$1
  AND pv.status='approved'
  ${type === "vehicle" && entityId ? `AND pv.id=${Number(entityId)}` : ""}
  `;

  const [personsResult, vehiclesResult] = await Promise.all([
    pool.query(personsQuery, [passRequestId]),
    pool.query(vehiclesQuery, [passRequestId]),
  ]);

  // Convert photoFilePath → base64 for each person — all reads in parallel
  const persons = await Promise.all(
    personsResult.rows.map(async (person) => {
      let photoBase64 = null;
      let photoMimeType = "image/jpeg";

      if (person.photoFilePath) {
        try {
          const fullPath = path.isAbsolute(person.photoFilePath)
            ? person.photoFilePath
            : path.join(__dirname, "../../", person.photoFilePath);

          if (fsSync.existsSync(fullPath)) {
            const fileBuffer = await fs.readFile(fullPath);
            photoBase64 = fileBuffer.toString("base64");

            const ext = path.extname(fullPath).toLowerCase();
            if (ext === ".png")  photoMimeType = "image/png";
            if (ext === ".webp") photoMimeType = "image/webp";
          }
        } catch (err) {
          console.error(`Photo read error for person ${person.id}:`, err.message);
        }
      }

      return {
        ...person,
        validFrom: formatISTDateTime(person.dateFrom, false),
        validTo: formatISTDateTime(person.dateTo, false),
        photoBase64,
        photoMimeType,
      };
    })
  );

  const vehicles = vehiclesResult.rows.map((vehicle) => ({
    ...vehicle,
    validFrom: formatISTDateTime(vehicle.dateFrom, false),
    validTo: formatISTDateTime(vehicle.dateTo, false),
  }));

  return { persons, vehicles };
};

/**
 * Get QR data for vendor passes
 * Reads from vendor_pass_persons and vendor_pass_vehicles relational tables
 * so each person/vehicle retains its own dateFrom/dateTo.
 */
exports.getVendorQrData = async (vendorPassId) => {
  // Verify vendor pass is approved
  const vprResult = await pool.query(
    `SELECT "referenceNo", "companyName", "submittedPersons", "submittedVehicles", status,
            "workOrderFilePath", "workOrderFileName", "visitorTypeId", "purposeOfVisitId"
     FROM "vendor_pass_requests"
     WHERE id = $1 AND status IN ('APPROVED', 'COMPLETED', 'REVERTED', 'VENDOR_SUBMITTED', 'REJECTED')`,
    [vendorPassId]
  );

  if (vprResult.rows.length === 0) {
    throw new Error("No approved vendor pass found");
  }

  const { referenceNo, companyName, submittedPersons, submittedVehicles, status,
          workOrderFilePath, workOrderFileName, visitorTypeId, purposeOfVisitId } = vprResult.rows[0];

  // Build lookup maps from JSONB so we can enrich relational rows with full form fields
  const jsonbPersons = Array.isArray(submittedPersons) ? submittedPersons : [];
  const jsonbVehicles = Array.isArray(submittedVehicles) ? submittedVehicles : [];

  const personsResult = await pool.query(
    `SELECT * FROM "vendor_pass_persons"
     WHERE "vendorPassRequestId" = $1
     ORDER BY id ASC`,
    [vendorPassId]
  );

  // Process persons with photo base64
  const persons = await Promise.all(
    personsResult.rows.map(async (person, idx) => {
      let photoBase64 = null;
      let photoMimeType = "image/jpeg";

      if (person.photoFilePath) {
        try {
          const fullPath = path.isAbsolute(person.photoFilePath)
            ? person.photoFilePath
            : path.join(__dirname, "../../", person.photoFilePath);

          if (fsSync.existsSync(fullPath)) {
            const fileBuffer = await fs.readFile(fullPath);
            photoBase64 = fileBuffer.toString("base64");

            const ext = path.extname(fullPath).toLowerCase();
            if (ext === ".png") photoMimeType = "image/png";
            if (ext === ".webp") photoMimeType = "image/webp";
          }
        } catch (err) {
          console.error(
            `Photo read error for vendor person ${person.name}:`
          );
        }
      }

      // Merge full form fields from JSONB for this person (matched by index or name)
      const jsonbMatch = jsonbPersons[idx] || jsonbPersons.find(p => p.name === person.name) || {};

      return {
        id: person.id,
        personPassNo: person.personPassNo,
        name: person.name,
        mobile: person.mobile,
        email: person.email || jsonbMatch.email || '',
        aadharNo: person.aadharNo,
        nationality: jsonbMatch.nationality || person.nationality || 'INDIAN',
        dateFrom: person.dateFrom,
        dateTo: person.dateTo,
        passType: person.passType || jsonbMatch.passType || '',
        passPeriod: person.passPeriod || jsonbMatch.passPeriod || 1,
        amount: person.amount || jsonbMatch.amount || '',
        status: person.status,
        rejectedReason: person.rejectedReason,
        revertReason: person.revertReason,
        // Full form fields from JSONB
        hepTypeId: jsonbMatch.hepTypeId || jsonbMatch.hepType || '',
        designationId: jsonbMatch.designationId || jsonbMatch.designation || '',
        idProofType: jsonbMatch.idProofType || '',
        idProofNumber: jsonbMatch.idProofNumber || '',
        countryId: jsonbMatch.countryId || jsonbMatch.country || '75',
        accessAreaId: jsonbMatch.accessAreaId || jsonbMatch.accessArea || '',
        cardNumber: jsonbMatch.cardNumber || '',
        visaNo: jsonbMatch.visaNo || '',
        passportNo: jsonbMatch.passportNo || '',
        cdcNumber: jsonbMatch.cdcNumber || '',
        seafarerPassFor: jsonbMatch.seafarerPassFor || 'Sign-On',
        seafarerIdType: jsonbMatch.seafarerIdType || '',
        withTwoWheeler: jsonbMatch.withTwoWheeler || false,
        vehicleNo: jsonbMatch.vehicleNo || '',
        // File names
        photoFileName: person.photoFileName || jsonbMatch.photoFileName || '',
        aadharPDFFileName: person.aadharPDFFileName || jsonbMatch.aadharPDFFileName || '',
        passportName: person.passportName || jsonbMatch.passportName || '',
        requisitionLetterName: person.requisitionLetterName || jsonbMatch.requisitionLetterName || '',
        driverLicenseName: person.driverLicenseName || jsonbMatch.driverLicenseName || '',
        policeVerificationName: person.policeVerificationName || jsonbMatch.policeVerificationName || '',
        employmentProofName: person.employmentProofName || jsonbMatch.employmentProofName || '',
        chaLicenseName: person.chaLicenseName || jsonbMatch.chaLicenseName || '',
        idProofFileName: person.idProofFileName || jsonbMatch.idProofFileName || '',
        cdcDocumentName: jsonbMatch.cdcDocumentName || '',
        declarationFormName: jsonbMatch.declarationFormName || '',
        // File paths (required for DocumentCard visibility in traffic approval)
        aadharPDFFilePATH: person.aadharPDFFilePATH || '',
        idProofFilePath: person.idProofFilePath || '',
        photoFilePath: person.photoFilePath || '',
        passportPath: person.passportPath || '',
        requisitionLetterPath: person.requisitionLetterPath || '',
        driverLicensePath: person.driverLicensePath || '',
        policeVerificationPath: person.policeVerificationPath || '',
        employmentProofPath: person.employmentProofPath || '',
        chaLicensePath: person.chaLicensePath || '',
        // QR display fields
        validFrom: formatISTDateTime(person.dateFrom, false),
        validTo: formatISTDateTime(person.dateTo, false),
        photoBase64,
        photoMimeType,
        company: companyName,
        hepType: person.passType || 'Personal',
      };
    })
  );

  const vehiclesResult = await pool.query(
    `SELECT * FROM "vendor_pass_vehicles"
     WHERE "vendorPassRequestId" = $1
     ORDER BY id ASC`,
    [vendorPassId]
  );

  const vehicles = vehiclesResult.rows.map((vehicle, idx) => {
    const jsonbMatch = jsonbVehicles[idx] || jsonbVehicles.find(v => v.vehicleRegistrationNo === vehicle.vehicleRegistrationNo || v.regNo === vehicle.vehicleRegistrationNo) || {};
    return {
      id: vehicle.id,
      vehiclePassNo: vehicle.vehiclePassNo,
      registrationNo: vehicle.vehicleRegistrationNo,
      dateFrom: vehicle.dateFrom,
      dateTo: vehicle.dateTo,
      passType: vehicle.passType || jsonbMatch.passType || '',
      passPeriod: vehicle.passPeriod || jsonbMatch.passPeriod || 1,
      amount: vehicle.amount || jsonbMatch.amount || '',
      status: vehicle.status,
      rejectedReason: vehicle.rejectedReason,
      revertReason: vehicle.revertReason,
      // Full form fields from JSONB
      vehicleTypeId: jsonbMatch.vehicleTypeId || jsonbMatch.type || '',
      vehicleType: vehicle.vehicleType || jsonbMatch.vehicleType || '',
      fuelType: jsonbMatch.fuelType || '',
      insuranceExpiry: jsonbMatch.insuranceExpiry || '',
      rcValidity: jsonbMatch.rcValidity || '',
      accessAreaId: jsonbMatch.accessAreaId || jsonbMatch.accessArea || '',
      // File names
      scannedCopyFileName: vehicle.scannedCopyFileName || jsonbMatch.scannedCopyFileName || '',
      insuranceFileName: vehicle.insuranceFileName || jsonbMatch.insuranceFileName || '',
      permitFileName: vehicle.permitFileName || jsonbMatch.permitFileName || '',
      fitnessFileName: vehicle.fitnessFileName || jsonbMatch.fitnessFileName || '',
      requestLetterName: vehicle.requestLetterName || jsonbMatch.requestLetterName || '',
      taxDocName: vehicle.taxFileName || jsonbMatch.taxDocName || '',
      emissionCertName: vehicle.emissionFileName || jsonbMatch.emissionCertName || '',
      // File paths (required for DocumentCard visibility in traffic approval)
      scannedCopyFilePath: vehicle.scannedCopyFilePath || '',
      insuranceFilePath: vehicle.insuranceFilePath || '',
      permitFilePath: vehicle.permitFilePath || '',
      fitnessFilePath: vehicle.fitnessFilePath || '',
      requestLetterPath: vehicle.requestLetterPath || '',
      taxFilePath: vehicle.taxFilePath || '',
      emissionFilePath: vehicle.emissionFilePath || '',
      // QR display fields
      validFrom: formatISTDateTime(vehicle.dateFrom, false),
      validTo: formatISTDateTime(vehicle.dateTo, false),
      company: companyName,
    };
  });

  // Fallback: for legacy passes submitted before new tables existed,
  // read from JSONB if new tables are empty
  if (persons.length === 0 && vehicles.length === 0) {
    return await getVendorQrDataLegacy(vendorPassId);
  }

  return { persons, vehicles, referenceNo, companyName, status,
           workOrderFilePath, workOrderFileName, visitorTypeId, purposeOfVisitId };
};

/**
 * Legacy JSONB fallback for vendor passes created before vendor_pass_persons/
 * vendor_pass_vehicles tables existed.
 */
async function getVendorQrDataLegacy(vendorPassId) {
  const query = `
    SELECT
      v."referenceNo",
      v."companyName",
      v."submittedPersons",
      v."submittedVehicles",
      v."validUpto"
    FROM "vendor_pass_requests" v
    WHERE v.id = $1
    AND v.status IN ('APPROVED', 'COMPLETED', 'REVERTED', 'REJECTED')
  `;

  const result = await pool.query(query, [vendorPassId]);

  if (result.rows.length === 0) {
    throw new Error("No approved vendor pass found");
  }

  const row = result.rows[0];
  const submittedPersons = Array.isArray(row.submittedPersons) ? row.submittedPersons : [];
  const submittedVehicles = Array.isArray(row.submittedVehicles) ? row.submittedVehicles : [];

  const persons = await Promise.all(
    submittedPersons
      .map(async (person) => {
        let photoBase64 = null;
        let photoMimeType = "image/jpeg";
        if (person.photoFilePath) {
          try {
            const fullPath = path.isAbsolute(person.photoFilePath)
              ? person.photoFilePath
              : path.join(__dirname, "../../", person.photoFilePath);
            if (fsSync.existsSync(fullPath)) {
              const fileBuffer = await fs.readFile(fullPath);
              photoBase64 = fileBuffer.toString("base64");
              const ext = path.extname(fullPath).toLowerCase();
              if (ext === ".png") photoMimeType = "image/png";
              if (ext === ".webp") photoMimeType = "image/webp";
            }
          } catch (err) {
            console.error(`Photo read error for vendor person ${person.personName}:`, err.message);
          }
        }
        return {
          id: person.personPassNo || person.id,
          name: person.personName,
          mobile: person.mobileNumber,
          aadharNo: person.aadharNumber,
          personPassNo: person.personPassNo,
          validFrom: formatISTDateTime(person.dateFrom, false),
          validTo: formatISTDateTime(person.dateTo, false) || formatISTDateTime(row.validUpto, false),
          photoBase64,
          photoMimeType,
          company: row.companyName,
          hepType: person.passType || "Personal",
          status: person.status,
          rejectedReason: person.rejectedReason,
          revertReason: person.revertReason
        };
      })
  );

  const vehicles = submittedVehicles
    .map((vehicle) => ({
      id: vehicle.vehiclePassNo || vehicle.id,
      registrationNo: vehicle.vehicleRegistrationNo,
      vehiclePassNo: vehicle.vehiclePassNo,
      validFrom: formatISTDateTime(vehicle.dateFrom, false),
      validTo: formatISTDateTime(vehicle.dateTo, false) || formatISTDateTime(row.validUpto, false),
      company: row.companyName,
      vehicleType: vehicle.vehicleType,
      status: vehicle.status,
      rejectedReason: vehicle.rejectedReason,
      revertReason: vehicle.revertReason
    }));

  return { persons, vehicles, referenceNo: row.referenceNo };
};

exports.saveQrPdfPath = async (
  type,
  entityId,
  qrPdfPath
) => {

  const table =
    type === "person"
      ? "pass_persons"
      : "pass_vehicles";

  const query = `
    UPDATE ${table}
    SET "qrPdfPath" = $1
    WHERE id = $2
    RETURNING *
  `;

  const result = await pool.query(
    query,
    [qrPdfPath, entityId]
  );

  return result.rows[0];
};

exports.validateQr = async ({
  entityId,
  passRequestId,
  qrUuid,
  type,
}) => {
  const table =
    type === "vehicle"
      ? "pass_vehicles"
      : "pass_persons";

  const passNoColumn =
    type === "vehicle"
      ? `"vehiclePassNo"`
      : `"personPassNo"`;

  const now = new Date();

  const query = `
    SELECT
      id,
      ${passNoColumn} AS "passNo",
      status,
      "dateFrom",
      "dateTo",
      "isActive",
      "isBlocked",
      "qrRevoked",
      "scanCount"
    FROM ${table}
    WHERE id = $1
    AND "passRequestId" = $2
    AND "qrUuid" = $3
    LIMIT 1
  `;

  const result = await pool.query(query, [
    entityId,
    passRequestId,
    qrUuid,
  ]);

  if (result.rows.length === 0) {
    return {
      valid: false,
      message: "Invalid QR",
    };
  }

  const row = result.rows[0];

  // approved?
  if (row.status !== "approved") {
    return {
      valid: false,
      message: "Pass not approved",
    };
  }

  // revoked?
  if (row.qrRevoked) {
    return {
      valid: false,
      message: "QR revoked",
    };
  }

  // active?
  if (!row.isActive) {
    return {
      valid: false,
      message: "Pass inactive",
    };
  }

  // blocked?
  if (row.isBlocked) {
    return {
      valid: false,
      message: "Pass blocked",
    };
  }

  // date valid?
  if (
    row.dateFrom &&
    new Date(row.dateFrom) > now
  ) {
    return {
      valid: false,
      message: "Pass not yet active",
    };
  }

  if (
    row.dateTo &&
    new Date(row.dateTo) < now
  ) {
    return {
      valid: false,
      message: "Pass expired",
    };
  }

  // atomic scan update
  await pool.query(
    `
      UPDATE ${table}
      SET
        "scanCount" = "scanCount" + 1,
        "lastScannedAt" = NOW()
      WHERE id = $1
    `,
    [row.id]
  );

  return {
    valid: true,
    message: "Pass valid",
    data: {
      passNo: row.passNo,
      scanCount:
        Number(row.scanCount) + 1,
    },
  };
};