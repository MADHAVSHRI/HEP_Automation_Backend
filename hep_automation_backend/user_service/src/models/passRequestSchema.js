const { pool } = require("../dbconfig/db");
const ReferenceNumber = require("./referenceNumberSchema");

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
  },
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
  },
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
  },
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
  },
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
  },
};

const PassRequest = {
  // async createPassRequest(payload, files) {

  //   const client = await pool.connect();

  //   try {

  //     await client.query("BEGIN");

  //     const {
  //       agentId,
  //       purposeOfVisitId,
  //       paymentMode,
  //       baseTotal,
  //       grossTotal,
  //       gstAmount,
  //       netAmount,
  //       persons,
  //       vehicles
  //     } = payload;

  //     const authLetter = files.authLetter?.[0];

  //     const passRequestResult = await client.query(
  //       `
  //       INSERT INTO pass_requests
  //       ("agentId","purposeOfVisitId","authLetterFilePath","authLetterFileName","paymentMode","baseTotal",
  //       "grossTotal","gstAmount","netAmount","status","submittedAt","createdAt","updatedAt")
  //       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'SUBMITTED',NOW(),NOW(),NOW())
  //       RETURNING id
  //       `,
  //       [
  //         agentId,
  //         purposeOfVisitId,
  //         authLetter.path,
  //         authLetter.originalname,
  //         paymentMode,
  //         baseTotal,
  //         grossTotal,
  //         gstAmount,
  //         netAmount
  //       ]
  //     );

  //     const passRequestId = passRequestResult.rows[0].id;

  //     for (let i = 0; i < persons.length; i++) {

  //     const person = persons[i];

  //     const aadharFile = files.personAadhar?.[i];
  //     const photoFile = files.personPhoto?.[i];
  //     const idProofFile = files.personIdProof?.[i];
  //     const dlFile = files.driverLicense?.[i];
  //     const requisitionFile = files.requisitionLetter?.[i];
  //     const policeFile = files.policeVerification?.[i];
  //     const employFile = files.employmentProof?.[i];
  //     const chaFile = files.chaLicenseCopy?.[i];
  //     const passportFile = files.passportDoc?.[i];

  //       await client.query(
  //       `
  //       INSERT INTO pass_persons
  //       ("passRequestId","rateId","hepTypeId","name","aadharNo",
  //       "aadharPDFFilePATH","aadharPDFFileName",
  //       "mobile","email","nationality","countryId","designationId",
  //       "cardNumber","accessAreaId","withTwoWheeler","vehicleNo",
  //       "idProofType","idProofNumber",
  //       "idProofFilePath","idProofFileName",
  //       "photoFilePath","photoFileName","requisitionLetterPath","requisitionLetterName","driverLicensePath","driverLicenseName",
  //       "policeVerificationPath","policeVerificationName",
  //       "employmentProofPath","employmentProofName",
  //       "chaLicensePath","chaLicenseName",
  //       "passportPath","passportName",
  //       "passType","passPeriod","dateFrom","dateTo","amount",
  //       "createdAt","updatedAt")

  //       VALUES
  //       ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,
  //       $23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,NOW(),NOW())
  //       `,
  //       [
  //       passRequestId,
  //       person.rateId,
  //       person.hepTypeId,
  //       person.name,
  //       person.aadharNo,

  //       aadharFile?.path || null,
  //       aadharFile?.originalname || null,

  //       person.mobile,
  //       person.email,
  //       person.nationality,
  //       person.countryId,
  //       person.designationId,
  //       person.cardNumber,
  //       person.accessAreaId,
  //       person.withTwoWheeler,
  //       person.vehicleNo,
  //       person.idProofType,
  //       person.idProofNumber,

  //       idProofFile?.path || null,
  //       idProofFile?.originalname || null,

  //       photoFile?.path || null,
  //       photoFile?.originalname || null,

  //       requisitionFile?.path || null,
  //       requisitionFile?.originalname || null,

  //       dlFile?.path || null, dlFile?.originalname || null,
  //       policeFile?.path || null, policeFile?.originalname || null,
  //       employFile?.path || null, employFile?.originalname || null,
  //       chaFile?.path || null, chaFile?.originalname || null,
  //       passportFile?.path || null, passportFile?.originalname || null,

  //       person.passType,
  //       person.passPeriod,
  //       person.dateFrom,
  //       person.dateTo,
  //       person.amount
  //       ]
  //       );

  //     }

  //     for (let i = 0; i < vehicles.length; i++) {

  //     const vehicle = vehicles[i];
  //     const vehicleFile = files.vehicleRC?.[i];
  //     const insuranceFile = files.vehicleInsurance?.[i];
  //     const permitFile = files.vehiclePermit?.[i];
  //     const fitnessFile = files.vehicleFitness?.[i];
  //     const reqLetterFile = files.vehicleRequestLetter?.[i];
  //     const taxFile = files.vehicleTax?.[i];
  //     const emissionFile = files.vehicleEmission?.[i];

  //       await client.query(
  //         `
  //         INSERT INTO pass_vehicles
  //         (
  //           "passRequestId","rateId","vehicleTypeId","registrationNo",
  //           "rfidCardNumber",

  //           "scannedCopyFilePath","scannedCopyFileName",

  //           "insuranceExpiry","rcValidity","accessAreaId",

  //           "insuranceFilePath","insuranceFileName",
  //           "permitFilePath","permitFileName",
  //           "fitnessFilePath","fitnessFileName",
  //           "requestLetterPath","requestLetterName",
  //           "taxDocPath","taxDocName",
  //           "emissionCertPath","emissionCertName",

  //           "passType","passPeriod","dateFrom","dateTo","amount",
  //           "createdAt","updatedAt"
  //         )

  //         VALUES
  //         (
  //           $1,$2,$3,$4,$5,
  //           $6,$7,
  //           $8,$9,$10,
  //           $11,$12,
  //           $13,$14,
  //           $15,$16,
  //           $17,$18,
  //           $19,$20,
  //           $21,$22,
  //           $23,$24,$25,$26,$27,
  //           NOW(),NOW()
  //         )
  //         `,
  //         [
  //           passRequestId,
  //           vehicle.rateId,
  //           vehicle.vehicleTypeId,
  //           vehicle.registrationNo,
  //           vehicle.rfidCardNumber,

  //           vehicleFile?.path || null,
  //           vehicleFile?.originalname || null,

  //           vehicle.insuranceExpiry,
  //           vehicle.rcValidity,
  //           vehicle.accessAreaId,

  //           insuranceFile?.path || null,
  //           insuranceFile?.originalname || null,

  //           permitFile?.path || null,
  //           permitFile?.originalname || null,

  //           fitnessFile?.path || null,
  //           fitnessFile?.originalname || null,

  //           reqLetterFile?.path || null,
  //           reqLetterFile?.originalname || null,

  //           taxFile?.path || null,
  //           taxFile?.originalname || null,

  //           emissionFile?.path || null,
  //           emissionFile?.originalname || null,

  //           vehicle.passType,
  //           vehicle.passPeriod,
  //           vehicle.dateFrom,
  //           vehicle.dateTo,
  //           vehicle.amount
  //         ]
  //       );
  //     }

  //     await client.query("COMMIT");

  //     return passRequestId;

  //   } catch (error) {

  //     await client.query("ROLLBACK");
  //     throw error;

  //   } finally {

  //     client.release();

  //   }

  // },

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
        vehicles,
      } = payload;

      const authLetter = files.authLetter?.[0];

      /* ===== CHANGE START =====
          Generate Pass Request Reference Number
        ===== */

      /* ===== CHANGE START =====
   SAFE REFERENCE NUMBER GENERATION (Retry Logic)
===== */

      let referenceNo;
      let passRequestId;
      let inserted = false;
      let retries = 0;

      while (!inserted && retries < 5) {
        referenceNo = await ReferenceNumber.generatePassReference(client);

        try {
          const passRequestResult = await client.query(
            `
            INSERT INTO pass_requests
            ("referenceNo","agentId","purposeOfVisitId","authLetterFilePath","authLetterFileName","paymentMode","baseTotal",
            "grossTotal","gstAmount","netAmount","status","originType","submittedAt","createdAt","updatedAt")
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'SUBMITTED','AGENT',NOW(),NOW(),NOW())
            RETURNING id
            `,
            [
              referenceNo,
              agentId,
              purposeOfVisitId,
              authLetter.path,
              authLetter.originalname,
              paymentMode,
              baseTotal,
              grossTotal,
              gstAmount,
              netAmount,
            ],
          );

          passRequestId = passRequestResult.rows[0].id;
          inserted = true;
        } catch (err) {
          if (err.code === "23505") {
            console.warn("Duplicate reference detected, retrying...");
            retries++;
          } else {
            throw err;
          }
        }
      }

      if (!inserted) {
        throw new Error("Failed to generate unique reference number");
      }

      /* ===== CHANGE END ===== */

      // const passRequestId = passRequestResult.rows[0].id;

      /*
        ===============================
        INSERT PERSON PASSES
        ===============================
        */

      for (let i = 0; i < persons.length; i++) {
        const person = persons[i];

        const aadharFile = files.personAadhar?.[i];
        const photoFile = files.personPhoto?.[i];
        const idProofFile = files.personIdProof?.[i];
        const dlFile = files.driverLicense?.[i];
        const requisitionFile = files.requisitionLetter?.[i];
        const policeFile = files.policeVerification?.[i];
        const employFile = files.employmentProof?.[i];
        const chaFile = files.chaLicenseCopy?.[i];
        const passportFile = files.passportDoc?.[i];

        /* ===== CHANGE START =====
            Generate Person Pass Number
          ===== */

        const personPassNo = await ReferenceNumber.generatePersonPassNo(client);

        /* ===== CHANGE END ===== */

        await client.query(
          `
            INSERT INTO pass_persons
            ("personPassNo","passRequestId","rateId","hepTypeId","name","aadharNo",
            "aadharPDFFilePATH","aadharPDFFileName",
            "mobile","email","nationality","countryId","designationId",
            "cardNumber","accessAreaId","withTwoWheeler","vehicleNo",
            "idProofType","idProofNumber",
            "idProofFilePath","idProofFileName",
            "photoFilePath","photoFileName","requisitionLetterPath","requisitionLetterName","driverLicensePath","driverLicenseName",
            "policeVerificationPath","policeVerificationName",
            "employmentProofPath","employmentProofName",
            "chaLicensePath","chaLicenseName",
            "passportPath","passportName",
            "passType","passPeriod","dateFrom","dateTo","amount",
            "createdAt","updatedAt")

            VALUES
            ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,
            $23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,NOW(),NOW())
            `,
          [
            personPassNo,
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

            requisitionFile?.path || null,
            requisitionFile?.originalname || null,

            dlFile?.path || null,
            dlFile?.originalname || null,
            policeFile?.path || null,
            policeFile?.originalname || null,
            employFile?.path || null,
            employFile?.originalname || null,
            chaFile?.path || null,
            chaFile?.originalname || null,
            passportFile?.path || null,
            passportFile?.originalname || null,

            person.passType,
            person.passPeriod,
            person.dateFrom,
            person.dateTo,
            person.amount,
          ],
        );
      }

      /*
        ===============================
        INSERT VEHICLE PASSES
        ===============================
        */

      for (let i = 0; i < vehicles.length; i++) {
        const vehicle = vehicles[i];

        const vehicleFile = files.vehicleRC?.[i];
        const insuranceFile = files.vehicleInsurance?.[i];
        const permitFile = files.vehiclePermit?.[i];
        const fitnessFile = files.vehicleFitness?.[i];
        const reqLetterFile = files.vehicleRequestLetter?.[i];
        const taxFile = files.vehicleTax?.[i];
        const emissionFile = files.vehicleEmission?.[i];

        /* ===== CHANGE START =====
            Generate Vehicle Pass Number
          ===== */

        const vehiclePassNo =
          await ReferenceNumber.generateVehiclePassNo(client);

        /* ===== CHANGE END ===== */

        await client.query(
          `
            INSERT INTO pass_vehicles
            (
              "vehiclePassNo","passRequestId","rateId","vehicleTypeId","registrationNo",
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
              $1,$2,$3,$4,$5,$6,
              $7,$8,
              $9,$10,$11,
              $12,$13,
              $14,$15,
              $16,$17,
              $18,$19,
              $20,$21,
              $22,$23,
              $24,$25,$26,$27,$28,
              NOW(),NOW()
            )
            `,
          [
            vehiclePassNo,
            passRequestId,
            vehicle.rateId,
            vehicle.vehicleTypeId,
            vehicle.registrationNo,
            vehicle.rfidCardNumber || null,

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
            vehicle.amount,
          ],
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
  },

  async approvePerson(personId) {
    const query = `
        UPDATE pass_persons
        SET status='approved'
        WHERE id=$1
        RETURNING *
      `;

    const result = await pool.query(query, [personId]);

    return result.rows[0];
  },

  async rejectPerson(personId, reason) {
    const query = `
        UPDATE pass_persons
        SET status='rejected',
            "rejectedReason"=$2
        WHERE id=$1
        RETURNING *
      `;

    const result = await pool.query(query, [personId, reason]);

    return result.rows[0];
  },

  async approveVehicle(vehicleId) {
    const query = `
        UPDATE pass_vehicles
        SET status='approved'
        WHERE id=$1
        RETURNING *
      `;

    const result = await pool.query(query, [vehicleId]);

    return result.rows[0];
  },

  async rejectVehicle(vehicleId, reason) {
    const query = `
      UPDATE pass_vehicles
      SET status='rejected',
          "rejectedReason"=$2
      WHERE id=$1
      RETURNING *
    `;

    const result = await pool.query(query, [vehicleId, reason]);

    return result.rows[0];
  },

  async completePassReview(passRequestId) {
    const pendingCheck = `
        SELECT
        (SELECT COUNT(*) FROM pass_persons
        WHERE "passRequestId"=$1 AND status='pending') as pendingPersons,

        (SELECT COUNT(*) FROM pass_vehicles
        WHERE "passRequestId"=$1 AND status='pending') as pendingVehicles
      `;

    const check = await pool.query(pendingCheck, [passRequestId]);

    const { pendingpersons, pendingvehicles } = check.rows[0];

    if (pendingpersons > 0 || pendingvehicles > 0) {
      throw new Error("All entities must be reviewed before completing");
    }

    const query = `
        UPDATE pass_requests
        SET status='COMPLETED'
        WHERE id=$1
        RETURNING *
      `;

    const result = await pool.query(query, [passRequestId]);

    return result.rows[0];
  },
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
        pr."createdAt",

        COALESCE(p.persons, '[]'::json) AS persons,
        COALESCE(v.vehicles, '[]'::json) AS vehicles

      FROM pass_requests pr

      LEFT JOIN (
        SELECT
          pp."passRequestId",
          json_agg(
            jsonb_build_object(
              'id',           pp.id,
              'name',         pp.name,
              'aadharNo',     pp."aadharNo",
              'mobile',       pp.mobile,
              'hepTypeId',    pp."hepTypeId",
              'passType',     pp."passType",
              'passPeriod',   pp."passPeriod",
              'dateFrom',     pp."dateFrom",
              'dateTo',       pp."dateTo",
              'amount',       pp.amount,
              'status',       pp.status,
              'rejectedReason', pp."rejectedReason",
              'personPassNo', pp."personPassNo",
              'photoFilePath', pp."photoFilePath",
              'designationId', pp."designationId",
              'accessAreaId', pp."accessAreaId",
              'nationality',  pp.nationality,
              'countryId',    pp."countryId",
              'visaNo',       pp."visaNo",
              'cardNumber',   pp."cardNumber",
              'withTwoWheeler', pp."withTwoWheeler",
              'vehicleNo',    pp."vehicleNo",
              'idProofType',  pp."idProofType",
              'idProofNumber', pp."idProofNumber",
              'aadharPDFFilePATH', pp."aadharPDFFilePATH",
              'idProofFilePath', pp."idProofFilePath",
              'requisitionLetterPath', pp."requisitionLetterPath",
              'driverLicensePath', pp."driverLicensePath",
              'policeVerificationPath', pp."policeVerificationPath",
              'employmentProofPath', pp."employmentProofPath",
              'chaLicensePath', pp."chaLicensePath",
              'passportPath', pp."passportPath"
            )
          ) AS persons
        FROM pass_persons pp
        GROUP BY pp."passRequestId"
      ) p ON p."passRequestId" = pr.id

      LEFT JOIN (
        SELECT
          pv."passRequestId",
          json_agg(
            jsonb_build_object(
              'id',               pv.id,
              'registrationNo',   pv."registrationNo",
              'vehicleTypeId',    pv."vehicleTypeId",
              'rfidCardNumber',   pv."rfidCardNumber",
              'passType',         pv."passType",
              'passPeriod',       pv."passPeriod",
              'dateFrom',         pv."dateFrom",
              'dateTo',           pv."dateTo",
              'amount',           pv.amount,
              'status',           pv.status,
              'rejectedReason',   pv."rejectedReason",
              'vehiclePassNo',    pv."vehiclePassNo",
              'insuranceExpiry',  pv."insuranceExpiry",
              'rcValidity',       pv."rcValidity",
              'accessAreaId',     pv."accessAreaId",
              'scannedCopyFilePath', pv."scannedCopyFilePath",
              'insuranceFilePath', pv."insuranceFilePath",
              'permitFilePath',   pv."permitFilePath",
              'fitnessFilePath',  pv."fitnessFilePath",
              'requestLetterPath', pv."requestLetterPath",
              'taxDocPath',       pv."taxDocPath",
              'emissionCertPath', pv."emissionCertPath"
            )
          ) AS vehicles
        FROM pass_vehicles pv
        GROUP BY pv."passRequestId"
      ) v ON v."passRequestId" = pr.id

      WHERE pr."agentId" = $1
      AND pr."isActive" = true

      ORDER BY pr."createdAt" DESC
    `;

    const result = await pool.query(query, [agentId]);

    return result.rows;
  },
};

const Master = {
  async getPersonsByAgent(agentId) {
    const query = `
    SELECT 
    pp.id,
    pp."passRequestId",
    pp.name,
    pp."aadharNo",
    pp.mobile,
    pp.email,
    pp.nationality,
    pp."countryId",
    pp."visaNo",
    pp."designationId",
    pp."designationOther",
    pp."cardNumber",
    pp."accessAreaId",
    pp."withTwoWheeler",
    pp."vehicleNo",
    pp."idProofType",
    pp."idProofNumber",
    
    -- ALL FILES (Added missing mandatory docs)
    pp."aadharPDFFilePATH",
    pp."aadharPDFFileName",
    pp."idProofFilePath",
    pp."idProofFileName",
    pp."photoFilePath",
    pp."photoFileName",
    pp."requisitionLetterPath",
    pp."requisitionLetterName",
    pp."driverLicensePath",
    pp."driverLicenseName",
    pp."policeVerificationPath",
    pp."policeVerificationName",
    pp."employmentProofPath",
    pp."employmentProofName",
    pp."chaLicensePath",
    pp."chaLicenseName",
    pp."passportPath",
    pp."passportName",
    
    -- PASS DETAILS
    pp."passType",
    pp."passPeriod",
    pp."dateFrom",
    pp."dateTo",
    pp.amount,
    pp."createdAt",
    pp."updatedAt",
    
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

    const result = await pool.query(query, [agentId]);
    return result.rows;
  },

  async getVehiclesByAgent(agentId) {
    const query = `
    SELECT 
    pv.id,
    pv."passRequestId",
    pv."registrationNo",
    pv."rfidCardNumber",
    
    -- ALL FILES (Added missing mandatory docs)
    pv."scannedCopyFilePath",
    pv."scannedCopyFileName",
    pv."insuranceFilePath",
    pv."insuranceFileName",
    pv."permitFilePath",
    pv."permitFileName",
    pv."fitnessFilePath",
    pv."fitnessFileName",
    pv."requestLetterPath",
    pv."requestLetterName",
    pv."taxDocPath",
    pv."taxDocName",
    pv."emissionCertPath",
    pv."emissionCertName",
    
    pv."insuranceExpiry",
    pv."rcValidity",
    pv."accessAreaId",
    pv."passType",
    pv."passPeriod",
    pv."dateFrom",
    pv."dateTo",
    pv.amount,
    pv."createdAt",
    pv."updatedAt",
    
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

    const result = await pool.query(query, [agentId]);
    return result.rows;
  },

  async getPersonCount(agentId) {
    const query = `
    SELECT COUNT(*) AS "personCount"
    FROM pass_persons pp

    JOIN pass_requests pr
    ON pr.id = pp."passRequestId"

    WHERE pr."agentId" = $1
    AND pp."isActive" = true
    `;

    const result = await pool.query(query, [agentId]);

    return result.rows[0].personCount;
  },

  async getVehicleCount(agentId) {
    const query = `
    SELECT COUNT(*) AS "vehicleCount"
    FROM pass_vehicles pv

    JOIN pass_requests pr
    ON pr.id = pv."passRequestId"

    WHERE pr."agentId" = $1
    AND pv."isActive" = true
    `;

    const result = await pool.query(query, [agentId]);

    return result.rows[0].vehicleCount;
  },
};

// const getAgentPassRequestsDetails = {
//   async getAgentPassRequestsToApproverAdmin(role, departmentId) {

//     let query = `
//   SELECT
//   pr.id,
//   pr."referenceNo",
//   pr.status,
//   pr."submittedAt",
//   pr."createdAt",

//   MAX(a."entityName") AS "entityName",
//   MAX(a."email") AS "email",
//   MAX(a."mobileNo") AS "mobileNo",
//   MAX(a."gstinNumber") AS "gstinNumber",
//   MAX(a."panNumber") AS "panNumber",

//   /*
//   ===================================================
//   CHANGE START
//   Add country name inside persons JSON
//   ===================================================
//   */

//   json_agg(
//     DISTINCT (
//       to_jsonb(pp)
//       || jsonb_build_object(
//         'country', c.name
//       )
//     )
//   )
//   FILTER (WHERE pp.id IS NOT NULL) AS persons,

//   /*
//   ===================================================
//   CHANGE END
//   ===================================================
//   */

//   json_agg(DISTINCT to_jsonb(pv))
//   FILTER (WHERE pv.id IS NOT NULL) AS vehicles

//   FROM pass_requests pr

//   LEFT JOIN "Agents" a
//   ON a.id = pr."agentId"

//   LEFT JOIN pass_persons pp
//   ON pp."passRequestId" = pr.id

//   LEFT JOIN pass_vehicles pv
//   ON pv."passRequestId" = pr.id

//   LEFT JOIN hep_types ht
//   ON ht.id = pp."hepTypeId"

//   /*
//   ===================================================
//   CHANGE START
//   Join countries table
//   ===================================================
//   */

//   LEFT JOIN countries c
//   ON c.id = pp."countryId"

//   /*
//   ===================================================
//   CHANGE END
//   ===================================================
//   */

//   WHERE pr."isActive" = true
//   `;

//     let params = [];

//     /*
//   ==========================================
//   Approval Department Filtering Logic
//   ==========================================
//   */

//     if (role === "Approval") {

//       if (departmentId === 7) {

//         query += `
//         AND (
//           ht.name = 'Seafarers'
//           OR pp.id IS NULL
//         )
//         `;

//       } else {

//         query += `
//         AND (
//           ht.name IN ('Drivers','Personnel')
//           OR pp.id IS NULL
//         )
//         `;
//       }
//     }

//     /*
//   ==========================================
//   Grouping
//   ==========================================
//   */

//     query += `
//   GROUP BY
//   pr.id,
//   pr."referenceNo",
//   pr.status,
//   pr."submittedAt",
//   pr."createdAt"
//   ORDER BY pr."createdAt" DESC
//   `;

//     const result = await pool.query(query, params);

//     return result.rows;
//   },
// };

const getAgentPassRequestsDetails = {
  async getAgentPassRequestsToApproverAdmin(role, departmentId) {
    let query = `
    SELECT
      pr.id,
      pr."referenceNo",
      pr.status,
      pr."submittedAt",
      pr."createdAt",

      a."entityName",
      a."email",
      a."mobileNo",
      a."gstinNumber",
      a."panNumber",

      COALESCE(p.persons, '[]') AS persons,
      COALESCE(v.vehicles, '[]') AS vehicles

    FROM pass_requests pr

    LEFT JOIN "Agents" a
      ON a.id = pr."agentId"

    /* =========================================
       PERSONS AGGREGATION
    ========================================= */

    LEFT JOIN (
      SELECT
        pp."passRequestId",

        json_agg(
          to_jsonb(pp) ||
          jsonb_build_object(
            'country', c.name,
            'hepType', ht.name
          )
        ) AS persons,

        array_agg(ht.name) AS "hepTypes"

      FROM pass_persons pp

      LEFT JOIN countries c
        ON c.id = pp."countryId"

      LEFT JOIN hep_types ht
        ON ht.id = pp."hepTypeId"

      GROUP BY pp."passRequestId"
    ) p
      ON p."passRequestId" = pr.id

    /* =========================================
       VEHICLES AGGREGATION
    ========================================= */

    LEFT JOIN (
      SELECT
        pv."passRequestId",
        json_agg(to_jsonb(pv)) AS vehicles

      FROM pass_vehicles pv
      GROUP BY pv."passRequestId"
    ) v
      ON v."passRequestId" = pr.id

    WHERE pr."isActive" = true
    `;

    /* =========================================
       APPROVAL DEPARTMENT FILTERING
    ========================================= */

    if (role === "Approval") {
      if (departmentId === 7) {
        /* Marine Dept → Only Seafarers persons */

        query += `
        AND EXISTS (
          SELECT 1
          FROM pass_persons pp
          JOIN hep_types ht
            ON ht.id = pp."hepTypeId"
          WHERE pp."passRequestId" = pr.id
          AND ht.name = 'Seafarers'
        )
        `;
      } else {
        /* Traffic Dept → Drivers + Personnel + Vehicles */

        query += `
        AND (
          EXISTS (
            SELECT 1
            FROM pass_persons pp
            JOIN hep_types ht
              ON ht.id = pp."hepTypeId"
            WHERE pp."passRequestId" = pr.id
            AND ht.name IN ('Drivers','Personnel')
          )
          OR EXISTS (
            SELECT 1
            FROM pass_vehicles pv
            WHERE pv."passRequestId" = pr.id
          )
        )
        `;
      }
    }

    query += `
    ORDER BY pr."createdAt" DESC
    `;

    const result = await pool.query(query);
    let rows = result.rows;

    /* =========================================
       Append Vendor Pass submissions
       (Traffic-side approvers only — Marine = 7 excluded)
       Include VENDOR_SUBMITTED, APPROVED, and REJECTED statuses
    ========================================= */
    if (role === "Approval" && departmentId !== 7) {
      const vendorRes = await pool.query(`
        SELECT
          v.id,
          v."referenceNo",
          v.status,
          v."submittedAt",
          v."createdAt",
          v."companyName"      AS "entityName",
          v."vendorEmail"      AS "email",
          v."vendorMobile"     AS "mobileNo",
          v."submittedPersons",
          v."submittedVehicles"
        FROM vendor_pass_requests v
        WHERE v.status IN ('VENDOR_SUBMITTED', 'APPROVED', 'REJECTED')
        ORDER BY v."submittedAt" DESC
      `);

      const vendorRows = vendorRes.rows.map((v) => ({
        id: v.id,
        referenceNo: v.referenceNo,
        status: v.status === 'VENDOR_SUBMITTED' ? 'SUBMITTED' : v.status,
        submittedAt: v.submittedAt,
        createdAt: v.createdAt,
        entityName: v.entityName,
        email: v.email,
        mobileNo: v.mobileNo,
        gstinNumber: null,
        panNumber: null,
        persons: (Array.isArray(v.submittedPersons) ? v.submittedPersons : []).map(
          (p, i) => ({ id: `vpr-${v.id}-p-${i}`, ...p })
        ),
        vehicles: (Array.isArray(v.submittedVehicles) ? v.submittedVehicles : []).map(
          (veh, i) => ({ id: `vpr-${v.id}-v-${i}`, ...veh })
        ),
        originType: "VENDOR",
      }));

      rows = [...vendorRows, ...rows];
    }

    return rows;
  },
};

const viewPassRequestsDocuments = {
  async getPassDocumentPath(passRequestId, documentType, entityIndex = 0, isVendorPass = false) {
    // Vendor pass documents are stored in JSONB fields
    if (isVendorPass) {
      const vendorQuery = `
        SELECT "submittedPersons", "submittedVehicles"
        FROM vendor_pass_requests
        WHERE id = $1
      `;
      const vendorRes = await pool.query(vendorQuery, [passRequestId]);
      if (vendorRes.rows.length === 0) {
        return null;
      }

      const submittedPersons = vendorRes.rows[0].submittedPersons || [];
      const submittedVehicles = vendorRes.rows[0].submittedVehicles || [];

      let entity;
      let pathKey;

      // Map document types to JSONB keys for persons
      const personDocMap = {
        personPhoto: "photoFilePath",
        personAadhar: "aadharPDFFilePATH",
        personIdProof: "idProofFilePath",
        requisitionLetter: "requisitionLetterPath",
        driverLicense: "driverLicensePath",
        policeVerification: "policeVerificationPath",
        employmentProof: "employmentProofPath",
        chaLicenseCopy: "chaLicensePath",
        passportDoc: "passportDocPath",
      };

      // Map document types to JSONB keys for vehicles
      const vehicleDocMap = {
        vehicleRC: "scannedCopyFilePath",
        vehicleInsurance: "insuranceFilePath",
        vehiclePermit: "permitFilePath",
        vehicleFitness: "fitnessFilePath",
        vehicleRequestLetter: "requestLetterPath",
        vehicleTax: "taxFilePath",
        vehicleEmission: "emissionFilePath",
      };

      if (personDocMap[documentType]) {
        pathKey = personDocMap[documentType];
        if (submittedPersons[entityIndex] && submittedPersons[entityIndex][pathKey]) {
          return { filePath: submittedPersons[entityIndex][pathKey] };
        }
      } else if (vehicleDocMap[documentType]) {
        pathKey = vehicleDocMap[documentType];
        if (submittedVehicles[entityIndex] && submittedVehicles[entityIndex][pathKey]) {
          return { filePath: submittedVehicles[entityIndex][pathKey] };
        }
      }

      return null;
    }

    // Normal pass request documents (from pass_persons and pass_vehicles tables)
    let columnName;
    let tableName;

    switch (documentType) {
      // PERSON FILES
      case "personPhoto":
        columnName = "photoFilePath";
        tableName = "pass_persons";
        break;

      case "personAadhar":
        columnName = "aadharPDFFilePATH";
        tableName = "pass_persons";
        break;

      case "personIdProof":
        columnName = "idProofFilePath";
        tableName = "pass_persons";
        break;

      case "requisitionLetter":
        columnName = "requisitionLetterPath";
        tableName = "pass_persons";
        break;

      case "driverLicense":
        columnName = "driverLicensePath";
        tableName = "pass_persons";
        break;

      case "policeVerification":
        columnName = "policeVerificationPath";
        tableName = "pass_persons";
        break;

      case "employmentProof":
        columnName = "employmentProofPath";
        tableName = "pass_persons";
        break;

      case "chaLicenseCopy":
        columnName = "chaLicensePath";
        tableName = "pass_persons";
        break;

      case "passportDoc":
        columnName = "passportPath";
        tableName = "pass_persons";
        break;

      // VEHICLE FILES
      case "vehicleRC":
        columnName = "scannedCopyFilePath";
        tableName = "pass_vehicles";
        break;

      case "vehicleInsurance":
        columnName = "insuranceFilePath";
        tableName = "pass_vehicles";
        break;

      case "vehiclePermit":
        columnName = "permitFilePath";
        tableName = "pass_vehicles";
        break;

      case "vehicleFitness":
        columnName = "fitnessFilePath";
        tableName = "pass_vehicles";
        break;

      case "vehicleRequestLetter":
        columnName = "requestLetterPath";
        tableName = "pass_vehicles";
        break;

      case "vehicleTax":
        columnName = "taxDocPath";
        tableName = "pass_vehicles";
        break;

      case "vehicleEmission":
        columnName = "emissionCertPath";
        tableName = "pass_vehicles";
        break;

      default:
        throw new Error("Invalid document type");
    }

    const query = `
      SELECT "${columnName}"
      FROM "${tableName}"
      WHERE "passRequestId" = $1
      AND "${columnName}" IS NOT NULL
      LIMIT 1
    `;

    const result = await pool.query(query, [passRequestId]);

    return result.rows[0];
  },
};

module.exports = {
  Designation,
  vehicleTypes,
  PassRequest,
  countries,
  hepTypes,
  visitPurpose,
  getPassRequest,
  Master,
  getAgentPassRequestsDetails,
  viewPassRequestsDocuments,
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
