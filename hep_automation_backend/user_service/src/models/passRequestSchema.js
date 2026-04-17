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

const countries = {

  async getAllCountries() {

    const query = `
      SELECT id, name
      FROM countries
      WHERE "isActive" = true
      ORDER BY name ASC
    `;

    const result = await pool.query(query);

    return result.rows;
  }

};

const hepTypes = {

  async getAllHepTypes() {

    const query = `
      SELECT id, name
      FROM hep_types
      WHERE "isActive" = true
      ORDER BY name ASC
    `;

    const result = await pool.query(query);

    return result.rows;
  }

};

const visitPurpose = {

  async getAllVisitPurposes() {

    const query = `
      SELECT id, name
      FROM visit_purposes
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

        idProofFile?.path || null,
        idProofFile?.originalname || null,

        photoFile?.path || null,
        photoFile?.originalname || null,

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

const getPassRequest = {

  async getAgentPassRequests(agentId) {

    const query = `
      SELECT
        pr.id,
        pr."referenceNo",
        pr.status,
        pr."submittedAt",
        pr."grossTotal",
        pr."gstAmount",
        pr."netAmount",

        json_agg(
          DISTINCT jsonb_build_object(
            'personId', pp.id,
            'name', pp.name,
            'aadharNo', pp."aadharNo",
            'mobile', pp.mobile,
            'passType', pp."passType",
            'dateFrom', pp."dateFrom",
            'dateTo', pp."dateTo"
          )
        ) FILTER (WHERE pp.id IS NOT NULL) AS persons,

        json_agg(
          DISTINCT jsonb_build_object(
            'vehicleId', pv.id,
            'registrationNo', pv."registrationNo",
            'passType', pv."passType",
            'dateFrom', pv."dateFrom",
            'dateTo', pv."dateTo"
          )
        ) FILTER (WHERE pv.id IS NOT NULL) AS vehicles

      FROM "pass_requests" pr

      LEFT JOIN "pass_persons" pp
        ON pp."passRequestId" = pr.id

      LEFT JOIN "pass_vehicles" pv
        ON pv."passRequestId" = pr.id

      WHERE pr."agentId" = $1
      AND pr."isActive" = true

      GROUP BY pr.id
      ORDER BY pr."createdAt" DESC
    `;

    const result = await pool.query(query, [agentId]);

    return result.rows;
  }

};


const Master = {

  async getPersonsByAgent(agentId){

    const query = `
    SELECT
    pp.id,
    pp.name,
    pp."aadharNo",
    pp.mobile,
    pp.email,
    pp."passType",
    pp."dateFrom",
    pp."dateTo",
    pp."createdAt",
    d.name AS "designationName",
    pr."referenceNo"

    FROM pass_persons pp

    JOIN pass_requests pr
    ON pr.id = pp."passRequestId"

    LEFT JOIN designations d
    ON d.id = pp."designationId"

    WHERE pr."agentId" = $1
    AND pp."isActive" = true

    ORDER BY pp."createdAt" DESC
    `;

    const result = await pool.query(query,[agentId]);

    return result.rows;

  },

  async getVehiclesByAgent(agentId){

    const query = `
    SELECT
    pv.id,
    pv."registrationNo",
    pv."passType",
    pv."dateFrom",
    pv."dateTo",
    pv."createdAt",
    vt.name AS "vehicleTypeName",
    pr."referenceNo"

    FROM pass_vehicles pv

    JOIN pass_requests pr
    ON pr.id = pv."passRequestId"

    LEFT JOIN vehicle_types vt
    ON vt.id = pv."vehicleTypeId"

    WHERE pr."agentId" = $1
    AND pv."isActive" = true

    ORDER BY pv."createdAt" DESC
    `;

    const result = await pool.query(query,[agentId]);

    return result.rows;

  },


  async getPersonCount(agentId){

    const query = `
    SELECT COUNT(*) AS "personCount"
    FROM pass_persons pp

    JOIN pass_requests pr
    ON pr.id = pp."passRequestId"

    WHERE pr."agentId" = $1
    AND pp."isActive" = true
    `;

    const result = await pool.query(query,[agentId]);

    return result.rows[0].personCount;

  },


  async getVehicleCount(agentId){

    const query = `
    SELECT COUNT(*) AS "vehicleCount"
    FROM pass_vehicles pv

    JOIN pass_requests pr
    ON pr.id = pv."passRequestId"

    WHERE pr."agentId" = $1
    AND pv."isActive" = true
    `;

    const result = await pool.query(query,[agentId]);

    return result.rows[0].vehicleCount;

  }

};



module.exports = {
  Designation,
  vehicleTypes,
  PassRequest,
  countries,
  hepTypes,
  visitPurpose,
  getPassRequest,
  Master
};