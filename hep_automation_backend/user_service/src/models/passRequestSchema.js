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
        baseTotal,
        grossTotal,
        gstAmount,
        netAmount,
        persons,
        vehicles
      } = payload;

      const authLetter = files.authLetter?.[0];

      const passRequestResult = await client.query(
        `
        INSERT INTO pass_requests
        ("agentId","purposeOfVisitId","authLetterFilePath","authLetterFileName","paymentMode","baseTotal",
        "grossTotal","gstAmount","netAmount","status","submittedAt","createdAt","updatedAt")
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'SUBMITTED',NOW(),NOW(),NOW())
        RETURNING id
        `,
        [
          agentId,
          purposeOfVisitId,
          authLetter.path,
          authLetter.originalname,
          paymentMode,
          baseTotal,
          grossTotal,
          gstAmount,
          netAmount
        ]
      );

      const passRequestId = passRequestResult.rows[0].id;

      for (let i = 0; i < persons.length; i++) {

      const person = persons[i];

      const aadharFile = files.personAadhar?.[i];
      const photoFile = files.personPhoto?.[i];
      const idProofFile = files.personIdProof?.[i];
      const dlFile = files.driverLicense?.[i];
      const policeFile = files.policeVerification?.[i];
      const employFile = files.employmentProof?.[i];
      const chaFile = files.chaLicenseCopy?.[i];
      const passportFile = files.passportDoc?.[i];

        await client.query(
        `
        INSERT INTO pass_persons
        ("passRequestId","rateId","hepTypeId","name","aadharNo",
        "aadharPDFFilePATH","aadharPDFFileName",
        "mobile","email","nationality","countryId","designationId",
        "cardNumber","accessAreaId","withTwoWheeler","vehicleNo",
        "idProofType","idProofNumber",
        "idProofFilePath","idProofFileName",
        "photoFilePath","photoFileName","driverLicensePath","driverLicenseName",
        "policeVerificationPath","policeVerificationName",
        "employmentProofPath","employmentProofName",
        "chaLicensePath","chaLicenseName",
        "passportPath","passportName",
        "passType","passPeriod","dateFrom","dateTo","amount",
        "createdAt","updatedAt")

        VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,
         $23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,NOW(),NOW())
        `,
        [
        passRequestId,
        person.rateId,
        person.hepTypeId,
        person.name,
        person.aadharNo,

        aadharFile?.path || null,
        aadharFile?.originalname || null,

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

        dlFile?.path || null, dlFile?.originalname || null,
        policeFile?.path || null, policeFile?.originalname || null,
        employFile?.path || null, employFile?.originalname || null,
        chaFile?.path || null, chaFile?.originalname || null,
        passportFile?.path || null, passportFile?.originalname || null,

        person.passType,
        person.passPeriod,
        person.dateFrom,
        person.dateTo,
        person.amount
        ]
        );

      }

      for (let i = 0; i < vehicles.length; i++) {

      const vehicle = vehicles[i];
      const vehicleFile = files.vehicleRC?.[i];
      const insuranceFile = files.vehicleInsurance?.[i];
      const permitFile = files.vehiclePermit?.[i];
      const fitnessFile = files.vehicleFitness?.[i];
      const reqLetterFile = files.vehicleRequestLetter?.[i];
      const taxFile = files.vehicleTax?.[i];
      const emissionFile = files.vehicleEmission?.[i];

        await client.query(
          `
          INSERT INTO pass_vehicles
          (
            "passRequestId","rateId","vehicleTypeId","registrationNo",
            "rfidCardNumber",

            "scannedCopyFilePath","scannedCopyFileName",

            "insuranceExpiry","rcValidity","accessAreaId",

            "insuranceFilePath","insuranceFileName",
            "permitFilePath","permitFileName",
            "fitnessFilePath","fitnessFileName",
            "requestLetterPath","requestLetterName",
            "taxDocPath","taxDocName",
            "emissionCertPath","emissionCertName",

            "passType","passPeriod","dateFrom","dateTo","amount",
            "createdAt","updatedAt"
          )

          VALUES
          (
            $1,$2,$3,$4,$5,
            $6,$7,
            $8,$9,$10,
            $11,$12,
            $13,$14,
            $15,$16,
            $17,$18,
            $19,$20,
            $21,$22,
            $23,$24,$25,$26,$27,
            NOW(),NOW()
          )
          `,
          [
            passRequestId,
            vehicle.rateId,
            vehicle.vehicleTypeId,
            vehicle.registrationNo,
            vehicle.rfidCardNumber,

            vehicleFile?.path || null,
            vehicleFile?.originalname || null,

            vehicle.insuranceExpiry,
            vehicle.rcValidity,
            vehicle.accessAreaId,

            insuranceFile?.path || null,
            insuranceFile?.originalname || null,

            permitFile?.path || null,
            permitFile?.originalname || null,

            fitnessFile?.path || null,
            fitnessFile?.originalname || null,

            reqLetterFile?.path || null,
            reqLetterFile?.originalname || null,

            taxFile?.path || null,
            taxFile?.originalname || null,

            emissionFile?.path || null,
            emissionFile?.originalname || null,

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
        pr."paymentMode",
        pr."grossTotal",
        pr."gstAmount",
        pr."netAmount",

        json_agg(DISTINCT to_jsonb(pp)) 
          FILTER (WHERE pp.id IS NOT NULL) AS persons,

        json_agg(DISTINCT to_jsonb(pv)) 
          FILTER (WHERE pv.id IS NOT NULL) AS vehicles

        

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

const getAgentPassRequestsDetails = {

  async getAgentPassRequestsToApproverAdmin(role, departmentId){

  let query = `
  SELECT
  pr.id,
  pr."referenceNo",
  pr.status,
  pr."submittedAt",
  pr."createdAt",

  json_agg(DISTINCT to_jsonb(pp))
  FILTER (WHERE pp.id IS NOT NULL) AS persons,

  json_agg(DISTINCT to_jsonb(pv))
  FILTER (WHERE pv.id IS NOT NULL) AS vehicles

  FROM pass_requests pr

  LEFT JOIN pass_persons pp
  ON pp."passRequestId" = pr.id

  LEFT JOIN pass_vehicles pv
  ON pv."passRequestId" = pr.id

  LEFT JOIN hep_types ht
  ON ht.id = pp."hepTypeId"

  WHERE pr."isActive" = true
  `;

  let params = [];

  /*
  ==========================================
  Approval Department Filtering Logic
  ==========================================
  */

  if (role === "Approval") {

    if (departmentId === 7) {

      // Marine department → only Seafarers

      query += `
      AND ht.name = 'Seafarers'
      `;

    } else {

      // Traffic / EDP departments → Drivers + Personnel

      query += `
      AND ht.name IN ('Drivers','Personnel')
      `;

    }

  }

  /*
  ==========================================
  Grouping
  ==========================================
  */

  query += `
  GROUP BY pr.id
  ORDER BY pr."createdAt" DESC
  `;

  const result = await pool.query(query, params);

  return result.rows;

}
}



module.exports = {
  Designation,
  vehicleTypes,
  PassRequest,
  countries,
  hepTypes,
  visitPurpose,
  getPassRequest,
  Master,
  getAgentPassRequestsDetails
};


















// json_agg(
//           DISTINCT jsonb_build_object(
//             'personId', pp.id,
//             'name', pp.name,
//             'aadharNo', pp."aadharNo",
//             'mobile', pp.mobile,
//             'passType', pp."passType",
//             'dateFrom', pp."dateFrom",
//             'dateTo', pp."dateTo"
//           )
//         ) FILTER (WHERE pp.id IS NOT NULL) AS persons,

//         json_agg(
//           DISTINCT jsonb_build_object(
//             'vehicleId', pv.id,
//             'registrationNo', pv."registrationNo",
//             'passType', pv."passType",
//             'dateFrom', pv."dateFrom",
//             'dateTo', pv."dateTo"
//           )
//         ) FILTER (WHERE pv.id IS NOT NULL) AS vehicles