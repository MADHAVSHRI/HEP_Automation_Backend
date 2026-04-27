const { pool } = require("../dbconfig/db");

exports.getQrData = async (passRequestId) => {

  const personsQuery = `
    SELECT
      id,
      name,
      "aadharNo",
      "personPassNo"
    FROM pass_persons
    WHERE "passRequestId"=$1
    AND status='approved'
  `;

  const vehiclesQuery = `
    SELECT
      id,
      "registrationNo",
      "vehiclePassNo"
    FROM pass_vehicles
    WHERE "passRequestId"=$1
    AND status='approved'
  `;

  const personsResult = await pool.query(personsQuery,[passRequestId]);
  const vehiclesResult = await pool.query(vehiclesQuery,[passRequestId]);

  return {
    persons: personsResult.rows,
    vehicles: vehiclesResult.rows
  };

};