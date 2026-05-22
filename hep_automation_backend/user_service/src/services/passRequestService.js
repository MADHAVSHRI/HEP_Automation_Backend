// const { pool } = require("../dbconfig/db");

// exports.getQrData = async (passRequestId) => {

//   const personsQuery = `
//   SELECT
//     pp.id,
//     pp.name,
//     pp.mobile,
//     pp."aadharNo",
//     pp."personPassNo",
//     pp."dateFrom",
//     pp."dateTo",
//     pp."photoFilePath",
//     a."entityName" AS company
//   FROM pass_persons pp
//   JOIN pass_requests pr
//     ON pr.id = pp."passRequestId"
//   JOIN "Agents" a
//     ON a.id = pr."agentId"
//   WHERE pp."passRequestId"=$1
//   AND pp.status='approved'
//   `;

//   const vehiclesQuery = `
//   SELECT
//     pv.id,
//     pv."registrationNo",
//     pv."vehiclePassNo",
//     pv."dateFrom",
//     pv."dateTo",
//     a."entityName" AS company
//   FROM pass_vehicles pv
//   JOIN pass_requests pr
//     ON pr.id = pv."passRequestId"
//   JOIN "Agents" a
//     ON a.id = pr."agentId"
//   WHERE pv."passRequestId"=$1
//   AND pv.status='approved'
//   `;

//   const personsResult = await pool.query(personsQuery,[passRequestId]);
//   const vehiclesResult = await pool.query(vehiclesQuery,[passRequestId]);

//   return {
//     persons: personsResult.rows,
//     vehicles: vehiclesResult.rows
//   };

// };

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

exports.getQrData = async (passRequestId) => {

  const personsQuery = `
  SELECT
    pp.id,
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
  `;

  const vehiclesQuery = `
  SELECT
    pv.id,
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
    `SELECT "referenceNo", "companyName" FROM "vendor_pass_requests"
     WHERE id = $1 AND status = 'APPROVED'`,
    [vendorPassId]
  );

  if (vprResult.rows.length === 0) {
    throw new Error("No approved vendor pass found");
  }

  const { referenceNo, companyName } = vprResult.rows[0];

  // Query approved persons from vendor_pass_persons table
  const personsResult = await pool.query(
    `SELECT * FROM "vendor_pass_persons"
     WHERE "vendorPassRequestId" = $1 AND status = 'approved'
     ORDER BY id ASC`,
    [vendorPassId]
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
        id: person.personPassNo || person.id,
        name: person.name,
        mobile: person.mobile,
        aadharNo: person.aadharNo,
        personPassNo: person.personPassNo,
        validFrom: formatISTDateTime(person.dateFrom, false),
        validTo: formatISTDateTime(person.dateTo, false),
        photoBase64,
        photoMimeType,
        company: companyName,
        hepType: person.passType || "Personal",
      };
    })
  );

  // Query approved vehicles from vendor_pass_vehicles table
  const vehiclesResult = await pool.query(
    `SELECT * FROM "vendor_pass_vehicles"
     WHERE "vendorPassRequestId" = $1 AND status = 'approved'
     ORDER BY id ASC`,
    [vendorPassId]
  );

  const vehicles = vehiclesResult.rows.map((vehicle) => ({
    id: vehicle.vehiclePassNo || vehicle.id,
    registrationNo: vehicle.vehicleRegistrationNo,
    vehiclePassNo: vehicle.vehiclePassNo,
    validFrom: formatISTDateTime(vehicle.dateFrom, false),
    validTo: formatISTDateTime(vehicle.dateTo, false),
    company: companyName,
    vehicleType: vehicle.vehicleType,
  }));

  // Fallback: for legacy passes submitted before new tables existed,
  // read from JSONB if new tables are empty
  if (persons.length === 0 && vehicles.length === 0) {
    return await getVendorQrDataLegacy(vendorPassId);
  }

  return { persons, vehicles, referenceNo };
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
    AND v.status = 'APPROVED'
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
      .filter((p) => p.status === "approved")
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
        };
      })
  );

  const vehicles = submittedVehicles
    .filter((v) => v.status === "approved")
    .map((vehicle) => ({
      id: vehicle.vehiclePassNo || vehicle.id,
      registrationNo: vehicle.vehicleRegistrationNo,
      vehiclePassNo: vehicle.vehiclePassNo,
      validFrom: formatISTDateTime(vehicle.dateFrom, false),
      validTo: formatISTDateTime(vehicle.dateTo, false) || formatISTDateTime(row.validUpto, false),
      company: row.companyName,
      vehicleType: vehicle.vehicleType,
    }));

  return { persons, vehicles, referenceNo: row.referenceNo };
}