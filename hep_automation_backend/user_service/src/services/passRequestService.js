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
  // Resolve id from token if it is a token
  let resolvedId = vendorPassId;
  if (vendorPassId && !/^\d+$/.test(String(vendorPassId))) {
    const { decryptToken } = require("../utils/cryptoUtils");
    const decrypted = decryptToken(vendorPassId);
    const finalTokenOrId = decrypted || vendorPassId;

    if (/^\d+$/.test(String(finalTokenOrId))) {
      resolvedId = Number(finalTokenOrId);
    } else {
      const tokenRes = await pool.query(
        `SELECT id FROM "vendor_pass_requests" WHERE "token" = $1`,
        [finalTokenOrId]
      );
      resolvedId = tokenRes.rows[0]?.id || null;
    }
  }

  // Verify vendor pass is approved
  const vprResult = await pool.query(
    `SELECT "referenceNo", "companyName", status,
            "workOrderFilePath", "workOrderFileName", "visitorTypeId", "purposeOfVisitId"
     FROM "vendor_pass_requests"
     WHERE id = $1 AND status IN ('APPROVED', 'COMPLETED', 'REVERTED', 'VENDOR_SUBMITTED', 'REJECTED')`,
    [resolvedId]
  );

  if (vprResult.rows.length === 0) {
    throw new Error("No approved vendor pass found");
  }

  const { referenceNo, companyName, status,
          workOrderFilePath, workOrderFileName, visitorTypeId, purposeOfVisitId } = vprResult.rows[0];

  const personsResult = await pool.query(
    `SELECT * FROM "vendor_pass_persons"
     WHERE "vendorPassRequestId" = $1
     ORDER BY id ASC`,
    [resolvedId]
  );

  // Process persons with photo base64
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
            if (ext === ".png") photoMimeType = "image/png";
            if (ext === ".webp") photoMimeType = "image/webp";
          }
        } catch (err) {
          console.error(
            `Photo read error for vendor person ${person.name}:`
          );
        }
      }

      return {
        id: person.id,
        personPassNo: person.personPassNo,
        name: person.name,
        mobile: person.mobile,
        email: person.email || '',
        aadharNo: person.aadharNo,
        nationality: person.nationality || 'INDIAN',
        dateFrom: person.dateFrom,
        dateTo: person.dateTo,
        passType: person.passType || '',
        passPeriod: person.passPeriod || 1,
        amount: person.amount || '',
        status: person.status,
        rejectedReason: person.rejectedReason,
        revertReason: person.revertReason,
        // Full form fields
        hepTypeId: person.hepTypeId || '',
        designationId: person.designationId || '',
        designationOther: person.designationOther || '',
        idProofType: person.idProofType || '',
        idProofNumber: person.idProofNumber || '',
        countryId: person.countryId || '75',
        accessAreaId: person.accessAreaId || '',
        cardNumber: person.cardNumber || '',
        visaNo: person.visaNo || '',
        passportNo: person.passportNo || '',
        cdcNumber: person.cdcNumber || '',
        seafarerPassFor: person.seafarerPassFor || 'Sign-On',
        seafarerIdType: person.seafarerIdType || '',
        withTwoWheeler: person.withTwoWheeler || false,
        vehicleNo: person.vehicleNo || '',
        // File names
        photoFileName: person.photoFileName || '',
        aadharPDFFileName: person.aadharPDFFileName || '',
        passportName: person.passportName || '',
        requisitionLetterName: person.requisitionLetterName || '',
        driverLicenseName: person.driverLicenseName || '',
        policeVerificationName: person.policeVerificationName || '',
        employmentProofName: person.employmentProofName || '',
        chaLicenseName: person.chaLicenseName || '',
        idProofFileName: person.idProofFileName || '',
        cdcDocumentName: person.cdcDocumentName || '',
        declarationFormName: person.declarationFormName || '',
        entryAuthorizationFileName: person.entryAuthorizationFileName || '',
        // File paths
        aadharPDFFilePATH: person.aadharPDFFilePATH || '',
        idProofFilePath: person.idProofFilePath || '',
        photoFilePath: person.photoFilePath || '',
        passportPath: person.passportPath || '',
        requisitionLetterPath: person.requisitionLetterPath || '',
        driverLicensePath: person.driverLicensePath || '',
        policeVerificationPath: person.policeVerificationPath || '',
        employmentProofPath: person.employmentProofPath || '',
        chaLicensePath: person.chaLicensePath || '',
        cdcDocumentPath: person.cdcDocumentPath || '',
        declarationFormPath: person.declarationFormPath || '',
        entryAuthorizationFilePath: person.entryAuthorizationFilePath || '',
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
    [resolvedId]
  );

  const vehicles = vehiclesResult.rows.map((vehicle) => {
    return {
      id: vehicle.id,
      vehiclePassNo: vehicle.vehiclePassNo,
      registrationNo: vehicle.vehicleRegistrationNo,
      dateFrom: vehicle.dateFrom,
      dateTo: vehicle.dateTo,
      passType: vehicle.passType || '',
      passPeriod: vehicle.passPeriod || 1,
      amount: vehicle.amount || '',
      status: vehicle.status,
      rejectedReason: vehicle.rejectedReason,
      revertReason: vehicle.revertReason,
      // Full form fields
      vehicleTypeId: vehicle.vehicleTypeId || '',
      vehicleType: vehicle.vehicleType || '',
      fuelType: vehicle.fuelType || '',
      insuranceExpiry: vehicle.insuranceExpiry || '',
      rcValidity: vehicle.rcValidity || '',
      accessAreaId: vehicle.accessAreaId || '',
      // File names
      scannedCopyFileName: vehicle.scannedCopyFileName || '',
      insuranceFileName: vehicle.insuranceFileName || '',
      permitFileName: vehicle.permitFileName || '',
      fitnessFileName: vehicle.fitnessFileName || '',
      requestLetterName: vehicle.requestLetterName || '',
      taxDocName: vehicle.taxFileName || '',
      emissionCertName: vehicle.emissionFileName || '',
      sparkArresterFileName: vehicle.sparkArresterFileName || '',
      twistLockFileName: vehicle.twistLockFileName || '',
      // File paths
      scannedCopyFilePath: vehicle.scannedCopyFilePath || '',
      insuranceFilePath: vehicle.insuranceFilePath || '',
      permitFilePath: vehicle.permitFilePath || '',
      fitnessFilePath: vehicle.fitnessFilePath || '',
      requestLetterPath: vehicle.requestLetterPath || '',
      taxFilePath: vehicle.taxFilePath || '',
      emissionFilePath: vehicle.emissionFilePath || '',
      sparkArresterFilePath: vehicle.sparkArresterFilePath || '',
      twistLockFilePath: vehicle.twistLockFilePath || '',
      // QR display fields
      validFrom: formatISTDateTime(vehicle.dateFrom, false),
      validTo: formatISTDateTime(vehicle.dateTo, false),
      company: companyName,
    };
  });

  return { persons, vehicles, referenceNo, companyName, status,
           workOrderFilePath, workOrderFileName, visitorTypeId, purposeOfVisitId };
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

// exports.updateQrScanAudit =
//   async (
//     entityId,
//     type
//   ) => {

//     const model =
//       type === "person"
//         ? PassPerson
//         : PassVehicle;

//     await model.increment(
//       {
//         scanCount: 1,
//       },
//       {
//         where: {
//           id: entityId,
//         },
//       }
//     );

//     await model.update(
//       {
//         lastScannedAt:
//           new Date(),
//       },
//       {
//         where: {
//           id: entityId,
//         },
//       }
//     );
//   };