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
const fs = require("fs");
const path = require("path");

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

  const personsResult = await pool.query(personsQuery, [passRequestId]);
  const vehiclesResult = await pool.query(vehiclesQuery, [passRequestId]);

  // Convert photoFilePath → base64 for each person
  const persons = personsResult.rows.map((person) => {
    let photoBase64 = null;
    let photoMimeType = "image/jpeg"; // default

    if (person.photoFilePath) {
      try {
        // Adjust this base path to where your uploads are stored
        const fullPath = path.isAbsolute(person.photoFilePath)
        ? person.photoFilePath
        : path.join(__dirname, "../../", person.photoFilePath);

        if (fs.existsSync(fullPath)) {
          const fileBuffer = fs.readFileSync(fullPath);
          photoBase64 = fileBuffer.toString("base64");

          // Detect mime type from extension
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
      validFrom: person.dateFrom
        ? new Date(person.dateFrom).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
        : null,
      validTo: person.dateTo
        ? new Date(person.dateTo).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
        : null,
      photoBase64,
      photoMimeType,
    };
  });

  const vehicles = vehiclesResult.rows.map((vehicle) => ({
    ...vehicle,
    validFrom: vehicle.dateFrom
      ? new Date(vehicle.dateFrom).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
      : null,
    validTo: vehicle.dateTo
      ? new Date(vehicle.dateTo).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
      : null,
  }));

  return { persons, vehicles };
};