const { pool } = require("../dbconfig/db");

const Designation = {

  async getAllDesignations() {

    const query = `
      SELECT id, name
      FROM designations
      WHERE "isActive" = true
      ORDER BY name ASC
    `;

    const result = await pool.query(query);

    return result.rows;
  }

};

const vehicleTypes = {

  async getAllVehicleTypes() {

    const query = `
      SELECT id, name
      FROM vehicle_types
      WHERE "isActive" = true
      ORDER BY name ASC
    `;

    const result = await pool.query(query);

    return result.rows;
  }

};


const PassRequest = {

  async createPassRequest(payload, files) {

    const client = await pool.connect();

    try {

      await client.query("BEGIN");

      const {
        agentId,
        purposeOfVisitId,
        paymentMode,
        persons,
        vehicles
      } = payload;

      const authLetter = files.authLetter?.[0];

      const passRequestResult = await client.query(
        `
        INSERT INTO pass_requests
        ("agentId","purposeOfVisitId","authLetterFilePath","authLetterFileName","paymentMode","status","createdAt","updatedAt")
        VALUES ($1,$2,$3,$4,$5,'SUBMITTED',NOW(),NOW())
        RETURNING id
        `,
        [
          agentId,
          purposeOfVisitId,
          authLetter.path,
          authLetter.originalname,
          paymentMode
        ]
      );

      const passRequestId = passRequestResult.rows[0].id;

      for (const person of persons) {

      const aadharFile = files.personAadhar?.[0];
        const photoFile = files.personPhoto?.[0];
        const idProofFile = files.personIdProof?.[0];

        await client.query(
        `
        INSERT INTO pass_persons
        ("passRequestId","rateId","hepTypeId","name","aadharNo",
        "aadharPDFFilePATH","aadharPDFFileName",
        "mobile","email","nationality","countryId","designationId",
        "cardNumber","accessAreaId","withTwoWheeler","vehicleNo",
        "idProofType","idProofNumber",
        "idProofFilePath","idProofFileName",
        "photoFilePath","photoFileName",
        "passType","passPeriod","dateFrom","dateTo","amount",
        "createdAt","updatedAt")

        VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,NOW(),NOW())
        `,
        [
        passRequestId,
        person.rateId,
        person.hepTypeId,
        person.name,
        person.aadharNo,

        aadharFile?.path,
        aadharFile?.originalname,

        person.mobile,
        person.email,
        person.nationality,
        person.countryId,
        person.designationId,
        person.cardNumber,
        person.accessAreaId,
        person.withTwoWheeler,
        person.vehicleNo,
        person.idProofType,
        person.idProofNumber,

        idProofFile?.path,
        idProofFile?.originalname,

        photoFile?.path,
        photoFile?.originalname,

        person.passType,
        person.passPeriod,
        person.dateFrom,
        person.dateTo,
        person.amount
        ]
        );

      }

      for (const vehicle of vehicles) {

        const vehicleFile = files.vehicleRC?.[0];

        await client.query(
          `
          INSERT INTO pass_vehicles
                  ("passRequestId","rateId","vehicleTypeId","registrationNo",
        "rfidCardNumber","scannedCopyFilePath","scannedCopyFileName",
        "insuranceExpiry","rcValidity","accessAreaId",
        "passType","passPeriod","dateFrom","dateTo","amount","createdAt","updatedAt")

          VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW(),NOW())
          `,
          [
            passRequestId,
            vehicle.rateId,
            vehicle.vehicleTypeId,
            vehicle.registrationNo,
            vehicle.rfidCardNumber,
            vehicleFile.path,
            vehicleFile.originalname,
            vehicle.insuranceExpiry,
            vehicle.rcValidity,
            vehicle.accessAreaId,
            vehicle.passType,
            vehicle.passPeriod,
            vehicle.dateFrom,
            vehicle.dateTo,
            vehicle.amount
          ]
        );

      }

      await client.query("COMMIT");

      return passRequestId;

    } catch (error) {

      await client.query("ROLLBACK");
      throw error;

    } finally {

      client.release();

    }

  }

};


module.exports = {
  Designation,
  vehicleTypes,
  PassRequest
};