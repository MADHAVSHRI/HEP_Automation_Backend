const { pool } = require("../dbconfig/db");
const ReferenceNumber = require("./referenceNumberSchema");
const crypto = require("crypto");

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
      const passRequisitionLetter = files.passRequisitionLetter?.[0];

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
            ("referenceNo","agentId","purposeOfVisitId","authLetterFilePath","authLetterFileName","requisitionLetterFilePath",
            "requisitionLetterFileName","paymentMode","baseTotal",
            "grossTotal","gstAmount","netAmount","status","originType","submittedAt","createdAt","updatedAt")
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'SUBMITTED','AGENT',NOW(),NOW(),NOW())
            RETURNING id
            `,
            [
              referenceNo,
              agentId,
              purposeOfVisitId,
              authLetter.path,
              authLetter.originalname,
              passRequisitionLetter?.path,
              passRequisitionLetter?.originalname,
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

        let masterPersonId = person.masterPersonId;

        if (!masterPersonId) {
          const aadharFile = files.personAadhar?.[i];
          const photoFile = files.personPhoto?.[i];
          const idProofFile = files.personIdProof?.[i];
          const dlFile = files.driverLicense?.[i];
          const policeFile = files.policeVerification?.[i];
          const employFile = files.employmentProof?.[i];
          const chaFile = files.chaLicenseCopy?.[i];
          const passportFile = files.passportDoc?.[i];

          const existingPerson = await client.query(
            `
          SELECT id
          FROM master_persons
          WHERE "agentId" = $1
          AND "aadharNo" = $2
          LIMIT 1
          `,
            [agentId, person.aadharNo],
          );

          if (existingPerson.rows.length > 0) {
            masterPersonId = existingPerson.rows[0].id;
          } else {
            const masterInsert = await client.query(
              `
            INSERT INTO master_persons
            (
              "agentId",
              "hepTypeId",
              "name",
              "aadharNo",
              "mobile",
              "email",
              "nationality",
              "countryId",
              "visaNo",
              "designationId",
              "designationOther",
              "cardNumber",
              "accessAreaId",
              "withTwoWheeler",
              "vehicleNo",
              "idProofType",
              "idProofNumber",

              "aadharPDFFilePATH",
              "aadharPDFFileName",

              "idProofFilePath",
              "idProofFileName",

              "photoFilePath",
              "photoFileName",

              "driverLicensePath",
              "driverLicenseName",

              "policeVerificationPath",
              "policeVerificationName",

              "employmentProofPath",
              "employmentProofName",

              "chaLicensePath",
              "chaLicenseName",

              "passportPath",
              "passportName",

              "createdAt",
              "updatedAt"
            )
            VALUES
            (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
              $11,$12,$13,$14,$15,$16,$17,
              $18,$19,$20,$21,$22,$23,$24,$25,
              $26,$27,$28,$29,$30,$31,$32,$33,
              NOW(),NOW()
            )
            RETURNING id
            `,
              [
                agentId,
                person.hepTypeId,
                person.name,
                person.aadharNo,
                person.mobile,
                person.email,
                person.nationality,
                person.countryId,
                person.visaNo,
                person.designationId,
                person.designationOther,
                person.cardNumber,
                person.accessAreaId,
                person.withTwoWheeler,
                person.vehicleNo,
                person.idProofType,
                person.idProofNumber,

                aadharFile?.path || null,
                aadharFile?.originalname || null,

                idProofFile?.path || null,
                idProofFile?.originalname || null,

                photoFile?.path || null,
                photoFile?.originalname || null,

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
              ],
            );

            masterPersonId = masterInsert.rows[0].id;
          }
        }

        const personPassNo = await ReferenceNumber.generatePersonPassNo(client);

        await client.query(
          `
        INSERT INTO pass_persons
        (
          "personPassNo",
          "passRequestId",
          "masterPersonId",
          "rateId",
          "hepTypeId",
          "passType",
          "passPeriod",
          "dateFrom",
          "dateTo",
          "amount",
          "createdAt",
          "updatedAt"
        )
        VALUES
        (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
          NOW(),NOW()
        )
        `,
          [
            personPassNo,
            passRequestId,
            masterPersonId,
            person.rateId,
            person.hepTypeId,
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

        let masterVehicleId = vehicle.masterVehicleId;

        if (!masterVehicleId) {
          const vehicleFile = files.vehicleRC?.[i];
          const insuranceFile = files.vehicleInsurance?.[i];
          const permitFile = files.vehiclePermit?.[i];
          const fitnessFile = files.vehicleFitness?.[i];
          const reqLetterFile = files.vehicleRequestLetter?.[i];
          const taxFile = files.vehicleTax?.[i];
          const emissionFile = files.vehicleEmission?.[i];

          const existingVehicle = await client.query(
            `
            SELECT id
            FROM master_vehicles
            WHERE "agentId" = $1
            AND "registrationNo" = $2
            LIMIT 1
            `,
            [agentId, vehicle.registrationNo],
          );

          if (existingVehicle.rows.length > 0) {
            masterVehicleId = existingVehicle.rows[0].id;
          } else {
            const vehicleInsert = await client.query(
              `
              INSERT INTO master_vehicles
              (
                "agentId",
                "vehicleTypeId",
                "registrationNo",
                "rfidCardNumber",

                "scannedCopyFilePath",
                "scannedCopyFileName",

                "insuranceFilePath",
                "insuranceFileName",

                "permitFilePath",
                "permitFileName",

                "fitnessFilePath",
                "fitnessFileName",

                "requestLetterPath",
                "requestLetterName",

                "taxDocPath",
                "taxDocName",

                "emissionCertPath",
                "emissionCertName",

                "insuranceExpiry",
                "rcValidity",
                "accessAreaId",

                "createdAt",
                "updatedAt"
              )
              VALUES
              (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
                $11,$12,$13,$14,$15,$16,$17,$18,
                $19,$20,$21,
                NOW(),NOW()
              )
              RETURNING id
              `,
              [
                agentId,
                vehicle.vehicleTypeId,
                vehicle.registrationNo,
                vehicle.rfidCardNumber || null,

                vehicleFile?.path || null,
                vehicleFile?.originalname || null,

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

                vehicle.insuranceExpiry,
                vehicle.rcValidity,
                vehicle.accessAreaId,
              ],
            );

            masterVehicleId = vehicleInsert.rows[0].id;
          }
        }

        const vehiclePassNo =
          await ReferenceNumber.generateVehiclePassNo(client);

        await client.query(
          `
          INSERT INTO pass_vehicles
          (
            "vehiclePassNo",
            "passRequestId",
            "masterVehicleId",
            "rateId",
            "passType",
            "passPeriod",
            "dateFrom",
            "dateTo",
            "amount",
            "createdAt",
            "updatedAt"
          )
          VALUES
          (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,
            NOW(),NOW()
          )
          `,
          [
            vehiclePassNo,
            passRequestId,
            masterVehicleId,
            vehicle.rateId,
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
      SET
        status = 'approved',

        "qrUuid" = CASE
          WHEN "qrUuid" IS NULL
          THEN gen_random_uuid()
          ELSE "qrUuid"
        END,

        "qrIssuedAt" = CASE
          WHEN "qrIssuedAt" IS NULL
          THEN NOW()
          ELSE "qrIssuedAt"
        END

      WHERE id = $1
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
      SET
        status = 'approved',

        "qrUuid" = CASE
          WHEN "qrUuid" IS NULL
          THEN gen_random_uuid()
          ELSE "qrUuid"
        END,

        "qrIssuedAt" = CASE
          WHEN "qrIssuedAt" IS NULL
          THEN NOW()
          ELSE "qrIssuedAt"
        END

      WHERE id = $1
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

  async revertPerson(personId, reason) {
    const query = `
        UPDATE pass_persons
        SET status='reverted',
            "rejectedReason"=$2
        WHERE id=$1
        RETURNING *
      `;

    const result = await pool.query(query, [personId, reason]);

    return result.rows[0];
  },

  async revertVehicle(vehicleId, reason) {
    const query = `
      UPDATE pass_vehicles
      SET status='reverted',
          "rejectedReason"=$2
      WHERE id=$1
      RETURNING *
    `;

    const result = await pool.query(query, [vehicleId, reason]);

    return result.rows[0];
  },

  async completePassReview(passRequestId, approvedByUserId) {
    const pendingCheck = `
        SELECT
        (SELECT COUNT(*) FROM pass_persons
        WHERE "passRequestId"=$1 AND status='pending') as pendingPersons,

        (SELECT COUNT(*) FROM pass_vehicles
        WHERE "passRequestId"=$1 AND status='pending') as pendingVehicles,

        (SELECT COUNT(*) FROM pass_persons
        WHERE "passRequestId"=$1 AND status='reverted') as revertedPersons,

        (SELECT COUNT(*) FROM pass_vehicles
        WHERE "passRequestId"=$1 AND status='reverted') as revertedVehicles
      `;

    const check = await pool.query(pendingCheck, [passRequestId]);

    const { pendingpersons, pendingvehicles, revertedpersons, revertedvehicles } = check.rows[0];

    if (pendingpersons > 0 || pendingvehicles > 0) {
      throw new Error("All entities must be reviewed before completing");
    }

    let approvedBy = null;
    if (approvedByUserId) {
      try {
        const userRes = await pool.query('SELECT "userName" FROM "users" WHERE id = $1', [approvedByUserId]);
        if (userRes.rows.length > 0) {
          approvedBy = userRes.rows[0].userName;
        }
      } catch (userErr) {
        console.error("Error looking up approver user details:", userErr);
      }
    }

    // Check if any entities were reverted
    const hasReverted = (revertedpersons > 0 || revertedvehicles > 0);
    
    if (hasReverted) {
      // If reverted entities exist, update pass request with revert tracking
      // Set status to 'REVERTED' so it moves to processed tab for approver
      // But stays in "Reverted Applications" for user
      const query = `
        UPDATE pass_requests
        SET 
          status = 'REVERTED',
          "hasRevertedEntities" = true,
          "revertCount" = "revertCount" + 1,
          "lastRevertedAt" = NOW(),
          "approvedBy" = $2
        WHERE id=$1
        RETURNING *
      `;
      const result = await pool.query(query, [passRequestId, approvedBy]);
      
      return {
        ...result.rows[0],
        reviewStatus: 'REVERTED',
        message: 'Review saved. Pass request has reverted entities that need correction.',
        revertedEntities: {
          persons: parseInt(revertedpersons),
          vehicles: parseInt(revertedvehicles)
        }
      };
    }

    // No reverted entities - mark as COMPLETED
    const query = `
        UPDATE pass_requests
        SET status='COMPLETED', "approvedBy" = $2
        WHERE id=$1
        RETURNING *
      `;

    const result = await pool.query(query, [passRequestId, approvedBy]);

    return {
      ...result.rows[0],
      reviewStatus: 'COMPLETED',
      message: 'Review completed successfully.'
    };
  },

  // ============================================
  // PHASE 2: EDIT AND RESUBMIT REVERTED PASSES
  // ============================================

  async updateRevertedPerson(personId, updateData) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check if person exists
      const checkQuery = `
        SELECT id FROM pass_persons WHERE id = $1
      `;
      const checkResult = await client.query(checkQuery, [personId]);

      if (checkResult.rows.length === 0) {
        return { success: false, message: 'Person not found' };
      }

      // Build update query dynamically based on provided fields
      // Only include fields that exist in pass_persons table
      const allowedFields = [
        'name', 'mobile', 'aadharNo', 'hepTypeId', 'passType',
        'passPeriod', 'dateFrom', 'dateTo', 'amount', 'countryId',
        'idProofType', 'photoFilePath', 'photoFileName',
        'aadharPDFFilePATH', 'aadharPDFFileName',
        'idProofFilePath', 'idProofFileName',
        'driverLicensePath', 'driverLicenseName',
        'policeVerificationPath', 'policeVerificationName',
        'employmentProofPath', 'employmentProofName',
        'chaLicensePath', 'chaLicenseName',
        'passportPath', 'passportName',
        'requisitionLetterPath', 'requisitionLetterName',
        'cdcDocumentPath', 'cdcDocumentName',
        'declarationFormPath', 'declarationFormName'
      ];

      const updates = [];
      const values = [];
      let paramIndex = 1;

      // File-related fields should only be updated if they have a real value
      // (skip empty strings to avoid overwriting existing file paths)
      const fileFields = new Set([
        'photoFilePath', 'photoFileName',
        'aadharPDFFilePATH', 'aadharPDFFileName',
        'idProofFilePath', 'idProofFileName',
        'driverLicensePath', 'driverLicenseName',
        'policeVerificationPath', 'policeVerificationName',
        'employmentProofPath', 'employmentProofName',
        'chaLicensePath', 'chaLicenseName',
        'passportPath', 'passportName',
        'requisitionLetterPath', 'requisitionLetterName',
        'cdcDocumentPath', 'cdcDocumentName',
        'declarationFormPath', 'declarationFormName'
      ]);

      for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
          // Skip empty strings for file fields to avoid wiping existing paths
          if (fileFields.has(field) && updateData[field] === '') continue;
          // Use exact column names from DB schema (camelCase)
          updates.push(`"${field}" = $${paramIndex}`);
          values.push(updateData[field]);
          paramIndex++;
        }
      }

      // Only update updatedAt, not status
      updates.push(`"updatedAt" = $${paramIndex}`);
      values.push(new Date());
      paramIndex++;

      // Add personId as the last parameter
      values.push(personId);

      const updateQuery = `
        UPDATE pass_persons
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await client.query(updateQuery, values);
      await client.query('COMMIT');

      return {
        success: true,
        data: result.rows[0],
        message: 'Person updated successfully'
      };

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('UPDATE REVERTED PERSON ERROR:', error);
      return { success: false, message: error.message };
    } finally {
      client.release();
    }
  },

  async updateRevertedVehicle(vehicleId, updateData) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      console.log('UPDATE REVERTED VEHICLE - vehicleId:', vehicleId);
      console.log('UPDATE REVERTED VEHICLE - updateData:', JSON.stringify(updateData));

      // Check if vehicle exists
      const checkQuery = `
        SELECT id FROM pass_vehicles WHERE id = $1
      `;
      const checkResult = await client.query(checkQuery, [vehicleId]);

      if (checkResult.rows.length === 0) {
        return { success: false, message: 'Vehicle not found' };
      }

      // Build update query dynamically
      // Only include fields that exist in pass_vehicles table
      const allowedFields = [
        'registrationNo', 'vehicleTypeId', 'insuranceExpiry',
        'rcValidity', 'passType', 'passPeriod', 'dateFrom', 'dateTo', 'amount',
        'scannedCopyFilePath', 'scannedCopyFileName',
        'insuranceFilePath', 'insuranceFileName',
        'permitFilePath', 'permitFileName',
        'fitnessFilePath', 'fitnessFileName',
        'requestLetterPath', 'requestLetterName',
        'taxDocPath', 'taxDocName',
        'emissionCertPath', 'emissionCertName'
      ];

      const updates = [];
      const values = [];
      let paramIndex = 1;

      // Use registrationNo if regNo is also provided (they map to same column)
      const regNo = updateData.registrationNo || updateData.regNo;

      // File-related fields should only be updated if they have a real value
      // (skip empty strings to avoid overwriting existing file paths)
      const fileFields = new Set([
        'scannedCopyFilePath', 'scannedCopyFileName',
        'insuranceFilePath', 'insuranceFileName',
        'permitFilePath', 'permitFileName',
        'fitnessFilePath', 'fitnessFileName',
        'requestLetterPath', 'requestLetterName',
        'taxDocPath', 'taxDocName',
        'emissionCertPath', 'emissionCertName'
      ]);

      for (const field of allowedFields) {
        let fieldValue = updateData[field];

        // Handle special case for registrationNo/regNo
        if (field === 'registrationNo') {
          fieldValue = regNo;
        }

        if (fieldValue !== undefined) {
          // Skip empty strings for file fields to avoid wiping existing paths
          if (fileFields.has(field) && fieldValue === '') continue;
          // Use exact column names from DB schema (camelCase)
          updates.push(`"${field}" = $${paramIndex}`);
          values.push(fieldValue);
          paramIndex++;
        }
      }

      console.log('UPDATE REVERTED VEHICLE - updates:', updates);
      console.log('UPDATE REVERTED VEHICLE - values:', values);

      // Only update updatedAt, not status
      updates.push(`"updatedAt" = $${paramIndex}`);
      values.push(new Date());
      paramIndex++;

      // Add vehicleId as the last parameter
      values.push(vehicleId);

      const updateQuery = `
        UPDATE pass_vehicles
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await client.query(updateQuery, values);
      await client.query('COMMIT');

      return {
        success: true,
        data: result.rows[0],
        message: 'Vehicle updated successfully'
      };

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('UPDATE REVERTED VEHICLE ERROR:', error);
      return { success: false, message: error.message };
    } finally {
      client.release();
    }
  },

  async resubmitRevertedPassRequest(passRequestId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check if pass exists and is in REVERTED status
      const checkQuery = `
        SELECT id, status FROM pass_requests WHERE id = $1
      `;
      const checkResult = await client.query(checkQuery, [passRequestId]);

      if (checkResult.rows.length === 0) {
        return { success: false, message: 'Pass request not found' };
      }

      if (checkResult.rows[0].status !== 'REVERTED') {
        return { success: false, message: 'Pass is not in reverted status' };
      }

      // Reset reverted persons and vehicles to 'pending' so only they need re-review
      // Already approved/rejected entities stay as-is
      await client.query(`
        UPDATE pass_persons
        SET status = 'pending',
            "rejectedReason" = NULL,
            "updatedAt" = NOW()
        WHERE "passRequestId" = $1 AND status = 'reverted'
      `, [passRequestId]);

      await client.query(`
        UPDATE pass_vehicles
        SET status = 'pending',
            "rejectedReason" = NULL,
            "updatedAt" = NOW()
        WHERE "passRequestId" = $1 AND status = 'reverted'
      `, [passRequestId]);

      // Update pass status back to SUBMITTED
      const updateQuery = `
        UPDATE pass_requests
        SET status = 'SUBMITTED',
            "hasRevertedEntities" = false,
            "updatedAt" = NOW()
        WHERE id = $1
        RETURNING *
      `;

      const result = await client.query(updateQuery, [passRequestId]);
      await client.query('COMMIT');

      return {
        success: true,
        data: result.rows[0],
        message: 'Pass resubmitted successfully'
      };

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('RESUBMIT REVERTED PASS ERROR:', error);
      return { success: false, message: error.message };
    } finally {
      client.release();
    }
  },
};

const getPassRequest = {

  async getAgentPassRequests(agentId, pagination = {}) {
    const {
      page = 1,
      limit = 20,
      offset = 0,
      search = "",
      status = "",
      sortOrder = "DESC",
    } = pagination;

    // ─── Search filter SQL builder ───
    let searchFilter = "";
    const params = [agentId];
    let paramIdx = 2;

    if (search) {
      const searchParam = `%${search}%`;
      params.push(searchParam);
      searchFilter = `
        AND (
          pr."referenceNo" ILIKE $${paramIdx}
          OR EXISTS (
            SELECT 1 FROM pass_persons pp
            WHERE pp."passRequestId" = pr.id
              AND (pp.name ILIKE $${paramIdx} OR pp."aadharNo" ILIKE $${paramIdx})
          )
          OR EXISTS (
            SELECT 1 FROM pass_vehicles pv
            WHERE pv."passRequestId" = pr.id
              AND pv."registrationNo" ILIKE $${paramIdx}
          )
        )`;
      paramIdx++;
    }

    // ─── Status filter SQL builder ───
    let statusFilter = "";
    if (status === "reverted") {
      statusFilter = `AND (pr.status::TEXT = 'REVERTED' OR pr."hasRevertedEntities" = true)`;
    } else if (status && status !== "all") {
      params.push(status.toUpperCase());
      statusFilter = `AND pr.status::TEXT = $${paramIdx}`;
      paramIdx++;
    }

    /* =============================================
       QUERY 1 — Global Counts for Agent's Dashboard
    ============================================= */
    const countQuery = `
      SELECT
        COUNT(*) AS total,
        COUNT(CASE WHEN pr.status::TEXT = 'REVERTED' OR pr."hasRevertedEntities" = true THEN 1 END) AS reverted
      FROM pass_requests pr
      WHERE pr."agentId" = $1 AND pr."isActive" = true
    `;
    const countRes = await pool.query(countQuery, [agentId]);
    const cnt = countRes.rows[0];
    const counts = {
      total: parseInt(cnt.total || 0),
      reverted: parseInt(cnt.reverted || 0),
    };

    /* =============================================
       QUERY 2 — Paginated IDs
       We pass limit and offset as parameters to prevent SQL injection.
    ============================================= */
    const limitIdx = paramIdx;
    const offsetIdx = paramIdx + 1;
    const pagParams = [...params, limit, offset];

    const idQuery = `
      SELECT id
      FROM pass_requests pr
      WHERE pr."agentId" = $1 AND pr."isActive" = true
        ${searchFilter}
        ${statusFilter}
      ORDER BY pr."createdAt" ${sortOrder}
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const idRes = await pool.query(idQuery, pagParams);
    const passIds = idRes.rows.map(r => r.id);

    if (passIds.length === 0) {
      return { data: [], counts };
    }

    /* =============================================
       QUERY 3 — Full Detail Hydration
    ============================================= */
    const placeholders = passIds.map((_, i) => `$${i + 1}`).join(",");
    const detailQuery = `
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
        pr."requisitionLetterFilePath",
        pr."requisitionLetterFileName",

        COALESCE(p.persons, '[]'::json) AS persons,
        COALESCE(v.vehicles, '[]'::json) AS vehicles

      FROM pass_requests pr

      LEFT JOIN (
        SELECT
          pp."passRequestId",
          json_agg(
            jsonb_build_object(
              'id',           pp.id,
              'name',         mp.name,
              'email',        mp.email,
              'aadharNo',     mp."aadharNo",
              'mobile',       mp.mobile,
              'hepTypeId',    pp."hepTypeId",
              'passType',     pp."passType",
              'passPeriod',   pp."passPeriod",
              'dateFrom',     pp."dateFrom",
              'dateTo',       pp."dateTo",
              'amount',       pp.amount,
              'status',       pp.status,
              'rejectedReason', pp."rejectedReason",
              'personPassNo', pp."personPassNo",
              'designationId', mp."designationId",
              'accessAreaId', mp."accessAreaId",
              'nationality', mp.nationality,
              'countryId', mp."countryId",
              'visaNo', mp."visaNo",
              'cardNumber', mp."cardNumber",
              'withTwoWheeler', mp."withTwoWheeler",
              'vehicleNo', mp."vehicleNo",
              'idProofType', mp."idProofType",
              'idProofNumber', mp."idProofNumber",
              'photoFilePath', mp."photoFilePath",
              'photoFileName', mp."photoFileName",

              'aadharPDFFilePATH', mp."aadharPDFFilePATH",
              'aadharPDFFileName', mp."aadharPDFFileName",

              'idProofFilePath', mp."idProofFilePath",
              'idProofFileName', mp."idProofFileName",

              'driverLicensePath', mp."driverLicensePath",
              'driverLicenseName', mp."driverLicenseName",

              'policeVerificationPath', mp."policeVerificationPath",
              'policeVerificationName', mp."policeVerificationName",

              'employmentProofPath', mp."employmentProofPath",
              'employmentProofName', mp."employmentProofName",

              'chaLicensePath', mp."chaLicensePath",
              'chaLicenseName', mp."chaLicenseName",

              'passportPath', mp."passportPath",
              'passportName', mp."passportName"
            )
          ) AS persons
        FROM pass_persons pp

        LEFT JOIN master_persons mp
          ON mp.id = pp."masterPersonId"

        GROUP BY pp."passRequestId"
      ) p ON p."passRequestId" = pr.id

      LEFT JOIN (
        SELECT
          pv."passRequestId",
          json_agg(
            jsonb_build_object(
              'id',               pv.id,
              'registrationNo',   mv."registrationNo",
              'vehicleTypeId',    mv."vehicleTypeId",
              'rfidCardNumber',   mv."rfidCardNumber",
              'passType',         pv."passType",
              'passPeriod',       pv."passPeriod",
              'dateFrom',         pv."dateFrom",
              'dateTo',           pv."dateTo",
              'amount',           pv.amount,
              'status',           pv.status,
              'rejectedReason',   pv."rejectedReason",
              'vehiclePassNo',    pv."vehiclePassNo",
              'insuranceExpiry',  mv."insuranceExpiry",
              'rcValidity',       mv."rcValidity",
              'accessAreaId',     mv."accessAreaId",
              'scannedCopyFilePath', mv."scannedCopyFilePath",
              'scannedCopyFileName', mv."scannedCopyFileName",

              'insuranceFilePath', mv."insuranceFilePath",
              'insuranceFileName', mv."insuranceFileName",

              'permitFilePath', mv."permitFilePath",
              'permitFileName', mv."permitFileName",

              'fitnessFilePath', mv."fitnessFilePath",
              'fitnessFileName', mv."fitnessFileName",

              'requestLetterPath', mv."requestLetterPath",
              'requestLetterName', mv."requestLetterName",

              'taxDocPath', mv."taxDocPath",
              'taxDocName', mv."taxDocName",

              'emissionCertPath', mv."emissionCertPath",
              'emissionCertName', mv."emissionCertName"
            )
          ) AS vehicles
        FROM pass_vehicles pv

        LEFT JOIN master_vehicles mv
          ON mv.id = pv."masterVehicleId"

        GROUP BY pv."passRequestId"
      ) v ON v."passRequestId" = pr.id

      WHERE pr.id IN (${placeholders})
      ORDER BY pr."createdAt" ${sortOrder}
    `;

    const detailRes = await pool.query(detailQuery, passIds);
    return { data: detailRes.rows, counts };
  },
};

const Master = {
  async getPersonsByAgent(agentId, pagination = {}) {
    const { limit = 20, offset = 0, search = "" } = pagination;
    const params = [agentId];
    let i = 2;
    let searchFilter = "";

    if (search) {
      params.push(`%${search}%`);
      searchFilter = `AND (mp.name ILIKE $${i} OR mp."aadharNo" ILIKE $${i} OR mp.mobile ILIKE $${i})`;
      i++;
    }

    const query = `
    SELECT 
    mp.id,
    pp."passRequestId",
    mp.name,
    mp."aadharNo",
    mp.mobile,
    mp.email,
    mp.nationality,
    mp."countryId",
    mp."visaNo",
    mp."designationId",
    mp."designationOther",
    mp."cardNumber",
    mp."accessAreaId",
    mp."withTwoWheeler",
    mp."vehicleNo",
    mp."idProofType",
    mp."idProofNumber",
    
    mp."aadharPDFFilePATH",
    mp."aadharPDFFileName",
    mp."idProofFilePath",
    mp."idProofFileName",
    mp."photoFilePath",
    mp."photoFileName",
    pr."requisitionLetterFilePath" AS "requisitionLetterPath",
    pr."requisitionLetterFileName" AS "requisitionLetterName",
    mp."driverLicensePath",
    mp."driverLicenseName",
    mp."policeVerificationPath",
    mp."policeVerificationName",
    mp."employmentProofPath",
    mp."employmentProofName",
    mp."chaLicensePath",
    mp."chaLicenseName",
    mp."passportPath",
    mp."passportName",
    
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

    LEFT JOIN master_persons mp
    ON mp.id = pp."masterPersonId"
    
    LEFT JOIN designations d
    ON d.id = mp."designationId"
    
    WHERE pr."agentId" = $1
    AND pp."isActive" = true
    ${searchFilter}
    
    ORDER BY pp."createdAt" DESC
    LIMIT $${i} OFFSET $${i + 1}
    `;

    const result = await pool.query(query, [...params, limit, offset]);
    return result.rows;
  },

  async getVehiclesByAgent(agentId, pagination = {}) {
    const { limit = 20, offset = 0, search = "" } = pagination;
    const params = [agentId];
    let i = 2;
    let searchFilter = "";

    if (search) {
      params.push(`%${search}%`);
      searchFilter = `AND (mv."registrationNo" ILIKE $${i} OR mv."rfidCardNumber" ILIKE $${i})`;
      i++;
    }

    const query = `
    SELECT 
    mv.id,
    pv."passRequestId",
    mv."registrationNo",
    mv."rfidCardNumber",

    mv."scannedCopyFilePath",
    mv."scannedCopyFileName",
    mv."insuranceFilePath",
    mv."insuranceFileName",
    mv."permitFilePath",
    mv."permitFileName",
    mv."fitnessFilePath",
    mv."fitnessFileName",
    mv."requestLetterPath",
    mv."requestLetterName",
    mv."taxDocPath",
    mv."taxDocName",
    mv."emissionCertPath",
    mv."emissionCertName",

    mv."insuranceExpiry",
    mv."rcValidity",
    mv."accessAreaId",
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

    LEFT JOIN master_vehicles mv
    ON mv.id = pv."masterVehicleId"

    LEFT JOIN vehicle_types vt
    ON vt.id = mv."vehicleTypeId"
    
    
    
    WHERE pr."agentId" = $1
    AND pv."isActive" = true
    ${searchFilter}
    
    ORDER BY pv."createdAt" DESC
    LIMIT $${i} OFFSET $${i + 1}
    `;

    const result = await pool.query(query, [...params, limit, offset]);
    return result.rows;
  },

  async getPersonCount(agentId, search = "") {
    const params = [agentId];
    let searchFilter = "";

    if (search) {
      params.push(`%${search}%`);
      searchFilter = `
        AND (
          mp.name ILIKE $2
          OR mp."aadharNo" ILIKE $2
          OR mp.mobile ILIKE $2
        )
      `;
    }

    const query = `
      SELECT COUNT(*) AS "personCount"
      FROM master_persons mp

      WHERE mp."agentId" = $1
      AND mp."isActive" = true
      ${searchFilter}
    `;

    const result = await pool.query(query, params);

    return parseInt(result.rows[0].personCount || 0);
  },

  async getVehicleCount(agentId, search = "") {
    const params = [agentId];
    let searchFilter = "";

    if (search) {
      params.push(`%${search}%`);
      searchFilter = `
        AND (
          mv."registrationNo" ILIKE $2
          OR mv."rfidCardNumber" ILIKE $2
        )
      `;
    }

    const query = `
      SELECT COUNT(*) AS "vehicleCount"
      FROM master_vehicles mv

      WHERE mv."agentId" = $1
      AND mv."isActive" = true
      ${searchFilter}
    `;

    const result = await pool.query(query, params);

    return parseInt(result.rows[0].vehicleCount || 0);
  }
};

const getAgentPassRequestsDetails = {

  async getAgentPassRequestsToApproverAdmin(role, departmentId, pagination = {}) {
    const {
      page   = 1,
      limit  = 20,
      offset = 0,
      search = "",
      status = "",
      sortOrder = "DESC",
      processedByMe = false,
      userId = null,
    } = pagination;

    let approvedByUserName = null;
    if (processedByMe && userId) {
      try {
        const userRes = await pool.query('SELECT "userName" FROM "users" WHERE id = $1', [userId]);
        if (userRes.rows.length > 0) {
          approvedByUserName = userRes.rows[0].userName;
        }
      } catch (err) {
        console.error("Error looking up user for processedByMe filter:", err);
      }
    }

    const PENDING_STATUSES  = ["SUBMITTED", "PENDING", "IN_REVIEW"];
    const PROCESSED_STATUSES = ["APPROVED", "REJECTED", "REVERTED", "PROCESSED", "COMPLETED"];
    const VENDOR_PENDING    = ["VENDOR_SUBMITTED"];
    const VENDOR_PROCESSED  = ["APPROVED", "REJECTED", "REVERTED", "COMPLETED"];
    const ALL_VENDOR_STATUSES = [...VENDOR_PENDING, ...VENDOR_PROCESSED];

    const includeVendor = role === "Approval" && departmentId !== 7;

    // ─── Department filter SQL for normal passes ───
    let deptFilter = "";
    if (role === "Approval") {
      if (departmentId === 7) {
        deptFilter = `
          AND EXISTS (
            SELECT 1 FROM pass_persons pp
            JOIN hep_types ht ON ht.id = pp."hepTypeId"
            WHERE pp."passRequestId" = pr.id AND ht.name = 'Seafarers'
          )`;
      } else {
        deptFilter = `
          AND (
            EXISTS (
              SELECT 1 FROM pass_persons pp
              JOIN hep_types ht ON ht.id = pp."hepTypeId"
              WHERE pp."passRequestId" = pr.id AND ht.name IN ('Drivers','Personnel')
            )
            OR EXISTS (
              SELECT 1 FROM pass_vehicles pv WHERE pv."passRequestId" = pr.id
            )
          )`;
      }
    }

    // ─── Search filter SQL builders ───
    let normalSearchFilter = "";
    let vendorSearchFilter = "";
    const searchParams = [];
    let paramIdx = 1;

    if (search) {
      const searchParam = `%${search}%`;
      searchParams.push(searchParam);
      normalSearchFilter = `
        AND (
          pr."referenceNo" ILIKE $${paramIdx}
          OR EXISTS (SELECT 1 FROM "Agents" a WHERE a.id = pr."agentId" AND a."entityName" ILIKE $${paramIdx})
          OR EXISTS (
          SELECT 1 FROM pass_persons pp JOIN master_persons mp ON mp.id = pp."masterPersonId" WHERE pp."passRequestId" = pr.id AND (
            mp.name ILIKE $${paramIdx}
            OR mp."aadharNo" ILIKE $${paramIdx}
          )
        )
          OR EXISTS (
            SELECT 1
            FROM pass_vehicles pv
            JOIN master_vehicles mv
              ON mv.id = pv."masterVehicleId"
            WHERE pv."passRequestId" = pr.id
            AND mv."registrationNo" ILIKE $${paramIdx}
          )
        )`;
      vendorSearchFilter = `
        AND (
          v."referenceNo" ILIKE $${paramIdx}
          OR v."companyName" ILIKE $${paramIdx}
          OR v."vendorEmail" ILIKE $${paramIdx}
          OR EXISTS (SELECT 1 FROM vendor_pass_persons vpp WHERE vpp."vendorPassRequestId" = v.id AND (vpp.name ILIKE $${paramIdx} OR vpp."aadharNo" ILIKE $${paramIdx}))
          OR EXISTS (SELECT 1 FROM vendor_pass_vehicles vpv WHERE vpv."vendorPassRequestId" = v.id AND vpv."vehicleRegistrationNo" ILIKE $${paramIdx})
        )`;
      paramIdx++;
    }

    // ─── Status filter ───
    let normalStatusFilter = "";
    let vendorStatusFilter = "";
    if (status === "pending") {
      normalStatusFilter = `AND pr.status::TEXT IN ('SUBMITTED','PENDING','IN_REVIEW','UNDER_REVIEW')`;
      vendorStatusFilter = `AND v.status IN ('VENDOR_SUBMITTED')`;
    } else if (status === "processed") {
      normalStatusFilter = `AND pr.status::TEXT IN ('APPROVED','REJECTED','REVERTED','PROCESSED','COMPLETED')`;
      vendorStatusFilter = `AND v.status IN ('APPROVED','REJECTED','REVERTED','COMPLETED')`;
      
      if (processedByMe && approvedByUserName) {
        normalStatusFilter += ` AND pr."approvedBy" = $${paramIdx} `;
        vendorStatusFilter += ` AND v."approvedBy" = $${paramIdx} `;
        searchParams.push(approvedByUserName);
        paramIdx++;
      }
    }

    /* =============================================
       QUERY 1 — Global Counts (lightweight)
    ============================================= */
    let normalCountParams = [];
    let normalCountSQL = `
      SELECT
        COUNT(*) AS total,
        COUNT(CASE WHEN pr.status::TEXT IN ('SUBMITTED','PENDING','IN_REVIEW','UNDER_REVIEW') THEN 1 END) AS pending,
        COUNT(CASE WHEN pr.status::TEXT IN ('APPROVED','REJECTED','REVERTED','PROCESSED','COMPLETED') ${processedByMe && approvedByUserName ? `AND pr."approvedBy" = $1` : ""} THEN 1 END) AS processed
      FROM pass_requests pr
      WHERE pr."isActive" = true ${deptFilter}
    `;
    if (processedByMe && approvedByUserName) {
      normalCountParams.push(approvedByUserName);
    }

    let vendorCountPromise = null;
    if (includeVendor) {
      let vendorCountParams = [];
      let vendorCountSQL = `
        SELECT
          COUNT(*) AS total,
          COUNT(CASE WHEN status = 'VENDOR_SUBMITTED' THEN 1 END) AS pending,
          COUNT(CASE WHEN status IN ('APPROVED','REJECTED','REVERTED','COMPLETED') ${processedByMe && approvedByUserName ? `AND "approvedBy" = $1` : ""} THEN 1 END) AS processed
        FROM vendor_pass_requests
        WHERE status IN ('VENDOR_SUBMITTED','APPROVED','REJECTED','REVERTED','COMPLETED')
      `;
      if (processedByMe && approvedByUserName) {
        vendorCountParams.push(approvedByUserName);
      }
      vendorCountPromise = pool.query(vendorCountSQL, vendorCountParams);
    }

    const [normalCountRes, vendorCountRes] = await Promise.all([
      pool.query(normalCountSQL, normalCountParams),
      vendorCountPromise || Promise.resolve(null),
    ]);

    const nc = normalCountRes.rows[0];
    const vc = vendorCountRes ? vendorCountRes.rows[0] : { total: "0", pending: "0", processed: "0" };

    const counts = {
      pending:   parseInt(nc.pending) + parseInt(vc.pending),
      processed: parseInt(nc.processed) + parseInt(vc.processed),
    };
    counts.total = counts.pending + counts.processed;

    /* =============================================
       QUERY 2 — Paginated IDs via UNION ALL
    ============================================= */
    const limitParam = paramIdx;
    const offsetParam = paramIdx + 1;
    const paginationParams = [...searchParams, limit, offset];

    let idQuery = `
      SELECT id, 'NORMAL' AS origin, "createdAt"
      FROM pass_requests pr
      WHERE pr."isActive" = true ${deptFilter} ${normalSearchFilter} ${normalStatusFilter}
    `;

    if (includeVendor) {
      idQuery += `
      UNION ALL
      SELECT id, 'VENDOR' AS origin, "createdAt"
      FROM vendor_pass_requests v
      WHERE v.status IN ('VENDOR_SUBMITTED','APPROVED','REJECTED','REVERTED','COMPLETED')
        ${vendorSearchFilter} ${vendorStatusFilter}
      `;
    }

    idQuery += `
      ORDER BY "createdAt" ${sortOrder}
      LIMIT $${limitParam} OFFSET $${offsetParam}
    `;

    const idResult = await pool.query(idQuery, paginationParams);
    const pageIds = idResult.rows;

    if (pageIds.length === 0) {
      return { data: [], counts };
    }

    // Split IDs by origin
    const normalIds = pageIds.filter(r => r.origin === "NORMAL").map(r => r.id);
    const vendorIds = pageIds.filter(r => r.origin === "VENDOR").map(r => r.id);

    /* =============================================
       QUERY 3 — Full Detail Hydration
    ============================================= */
    let normalRows = [];
    let vendorRows = [];

    // 3a — Normal pass detail (only for the IDs on this page)
    if (normalIds.length > 0) {
      const placeholders = normalIds.map((_, i) => `$${i + 1}`).join(",");
      const detailQuery = `
        SELECT
          pr.id,
          pr."referenceNo",
          pr.status,
          pr."submittedAt",
          pr."createdAt",
          pr."approvedBy",

          a."entityName",
          a."email",
          a."mobileNo",
          a."gstinNumber",
          a."panNumber",

          COALESCE(p.persons, '[]') AS persons,
          COALESCE(v.vehicles, '[]') AS vehicles

        FROM pass_requests pr

        LEFT JOIN "Agents" a ON a.id = pr."agentId"

        LEFT JOIN (
          SELECT
            pp."passRequestId",
            json_agg(
  (
    to_jsonb(pp)

    ||

    jsonb_build_object(
      'country', c.name,
      'hepType', ht.name
    )

    ||

      jsonb_build_object(
        'name', mp.name,
        'email', mp.email,
        'mobile', mp.mobile,
        'aadharNo', mp."aadharNo",

        'photoFilePath', mp."photoFilePath",
        'photoFileName', mp."photoFileName",

        'aadharPDFFilePATH', mp."aadharPDFFilePATH",
        'aadharPDFFileName', mp."aadharPDFFileName",

        'idProofFilePath', mp."idProofFilePath",
        'idProofFileName', mp."idProofFileName",

        'driverLicensePath', mp."driverLicensePath",
        'driverLicenseName', mp."driverLicenseName",

        'policeVerificationPath', mp."policeVerificationPath",
        'policeVerificationName', mp."policeVerificationName",

        'employmentProofPath', mp."employmentProofPath",
        'employmentProofName', mp."employmentProofName",

        'chaLicensePath', mp."chaLicensePath",
        'chaLicenseName', mp."chaLicenseName",

        'passportPath', mp."passportPath",
        'passportName', mp."passportName",

        'designationId', d.name,
        'accessAreaId', mp."accessAreaId",
        'vehicleNo', mp."vehicleNo",
        'withTwoWheeler', mp."withTwoWheeler",
        'idProofType', mp."idProofType",
        'idProofNumber', mp."idProofNumber"
      )
    )
    ORDER BY pp.id ASC
  ) AS persons,
            array_agg(ht.name) AS "hepTypes"
          FROM pass_persons pp

          LEFT JOIN master_persons mp
          ON mp.id = pp."masterPersonId"

          LEFT JOIN countries c
          ON c.id = COALESCE(mp."countryId", pp."countryId")

          LEFT JOIN hep_types ht
          ON ht.id = COALESCE(mp."hepTypeId", pp."hepTypeId")

          LEFT JOIN designations d
          ON d.id = mp."designationId"
          GROUP BY pp."passRequestId"
        ) p ON p."passRequestId" = pr.id

        LEFT JOIN (
      SELECT
        pv."passRequestId",

        json_agg(
          (
            to_jsonb(pv)

            ||

            jsonb_build_object(
              'registrationNo', mv."registrationNo",
              'vehicleTypeId', mv."vehicleTypeId",
              'vehicleTypeName', vt.name,
              'rfidCardNumber', mv."rfidCardNumber",

              'scannedCopyFilePath', mv."scannedCopyFilePath",
              'scannedCopyFileName', mv."scannedCopyFileName",

              'insuranceFilePath', mv."insuranceFilePath",
              'insuranceFileName', mv."insuranceFileName",

              'permitFilePath', mv."permitFilePath",
              'permitFileName', mv."permitFileName",

              'fitnessFilePath', mv."fitnessFilePath",
              'fitnessFileName', mv."fitnessFileName",

              'requestLetterPath', mv."requestLetterPath",
              'requestLetterName', mv."requestLetterName",

              'taxDocPath', mv."taxDocPath",
              'taxDocName', mv."taxDocName",

              'emissionCertPath', mv."emissionCertPath",
              'emissionCertName', mv."emissionCertName",

              'insuranceExpiry', mv."insuranceExpiry",
              'rcValidity', mv."rcValidity",
              'accessAreaId', mv."accessAreaId"
            )
          )
        ) AS vehicles
          FROM pass_vehicles pv
          LEFT JOIN master_vehicles mv
          ON mv.id = pv."masterVehicleId"

          LEFT JOIN vehicle_types vt
          ON vt.id = mv."vehicleTypeId"
          GROUP BY pv."passRequestId"
        ) v ON v."passRequestId" = pr.id

        WHERE pr.id IN (${placeholders})
        ORDER BY pr."createdAt" ${sortOrder}
      `;
      const normalRes = await pool.query(detailQuery, normalIds);
      normalRows = normalRes.rows;
    }

    // 3b — Vendor pass detail (only for the IDs on this page)
    if (vendorIds.length > 0) {
      const placeholders = vendorIds.map((_, i) => `$${i + 1}`).join(",");
      const vendorDetailQuery = `
        SELECT
          v.id,
          v."referenceNo",
          v.status,
          v."submittedAt",
          v."createdAt",
          v."approvedBy",
          v."companyName"  AS "entityName",
          v."vendorEmail"  AS "email",
          v."vendorMobile" AS "mobileNo",
          COALESCE(p.persons, '[]') AS persons,
          COALESCE(veh.vehicles, '[]') AS vehicles
        FROM vendor_pass_requests v
        LEFT JOIN (
          SELECT "vendorPassRequestId",
            json_agg(to_jsonb(vpp) ORDER BY vpp.id ASC) AS persons
          FROM vendor_pass_persons vpp
          GROUP BY "vendorPassRequestId"
        ) p ON p."vendorPassRequestId" = v.id
        LEFT JOIN (
          SELECT "vendorPassRequestId",
            json_agg(to_jsonb(vpv) ORDER BY vpv.id ASC) AS vehicles
          FROM vendor_pass_vehicles vpv
          GROUP BY "vendorPassRequestId"
        ) veh ON veh."vendorPassRequestId" = v.id
        WHERE v.id IN (${placeholders})
        ORDER BY v."createdAt" ${sortOrder}
      `;
      const vendorRes = await pool.query(vendorDetailQuery, vendorIds);
      vendorRows = vendorRes.rows.map((v) => ({
        id: v.id,
        referenceNo: v.referenceNo,
        status: v.status === "VENDOR_SUBMITTED" ? "SUBMITTED" : v.status,
        submittedAt: v.submittedAt,
        createdAt: v.createdAt,
        approvedBy: v.approvedBy,
        entityName: v.entityName,
        email: v.email,
        mobileNo: v.mobileNo,
        gstinNumber: null,
        panNumber: null,
        persons: (Array.isArray(v.persons) ? v.persons : []).map(
          (p, i) => ({ ...p, id: `vpr-${v.id}-p-${i}` })
        ),
        vehicles: (Array.isArray(v.vehicles) ? v.vehicles : []).map(
          (veh, i) => ({
            ...veh,
            registrationNo: veh.vehicleRegistrationNo || veh.registrationNo || veh.regNo,
            regNo: veh.vehicleRegistrationNo || veh.registrationNo || veh.regNo,
            id: `vpr-${v.id}-v-${i}`
          })
        ),
        originType: "VENDOR",
      }));
    }

    // Merge and re-sort to match the UNION ALL order
    const allRows = [...normalRows, ...vendorRows];
    allRows.sort((a, b) => {
      const da = new Date(a.createdAt).getTime();
      const db = new Date(b.createdAt).getTime();
      return sortOrder === "DESC" ? db - da : da - db;
    });

    return { data: allRows, counts };
  },

  async getPassById(passRequestId) {
    const query = `
    SELECT
      pr.id,
      pr."referenceNo",
      pr.status,
      pr."submittedAt",
      pr."createdAt",
      pr."hasRevertedEntities",
      pr."revertCount",
      pr."lastRevertedAt",

      a."entityName" AS "agentName",
      a."email" AS "agentEmail",
      a."mobileNo" AS "agentMobile",
      a."firstName",
      a."lastName",

      COALESCE(p.persons, '[]') AS persons,
      COALESCE(v.vehicles, '[]') AS vehicles

    FROM pass_requests pr

    LEFT JOIN "Agents" a
      ON a.id = pr."agentId"

    LEFT JOIN (
      SELECT
        pp."passRequestId",
        json_agg(
  (
    to_jsonb(pp)

    ||

    jsonb_build_object(
      'country', c.name,
      'hepType', ht.name
    )

    ||

      jsonb_build_object(
        'name', mp.name,
        'email', mp.email,
        'mobile', mp.mobile,
        'aadharNo', mp."aadharNo",

        'photoFilePath', mp."photoFilePath",
        'photoFileName', mp."photoFileName",

        'aadharPDFFilePATH', mp."aadharPDFFilePATH",
        'aadharPDFFileName', mp."aadharPDFFileName",

        'idProofFilePath', mp."idProofFilePath",
        'idProofFileName', mp."idProofFileName",

        'driverLicensePath', mp."driverLicensePath",
        'driverLicenseName', mp."driverLicenseName",

        'policeVerificationPath', mp."policeVerificationPath",
        'policeVerificationName', mp."policeVerificationName",

        'employmentProofPath', mp."employmentProofPath",
        'employmentProofName', mp."employmentProofName",

        'chaLicensePath', mp."chaLicensePath",
        'chaLicenseName', mp."chaLicenseName",

        'passportPath', mp."passportPath",
        'passportName', mp."passportName",

        'designationId', d.name,
        'accessAreaId', mp."accessAreaId",
        'vehicleNo', mp."vehicleNo",
        'withTwoWheeler', mp."withTwoWheeler",
        'idProofType', mp."idProofType",
        'idProofNumber', mp."idProofNumber"
      )
    )
    ORDER BY pp.id ASC
  ) AS persons
      FROM pass_persons pp
      LEFT JOIN master_persons mp   ON mp.id = pp."masterPersonId"
      LEFT JOIN countries c 
      ON c.id = COALESCE(mp."countryId", pp."countryId")

      LEFT JOIN hep_types ht
      ON ht.id = COALESCE(mp."hepTypeId", pp."hepTypeId")
      LEFT JOIN designations d ON d.id = mp."designationId"
      GROUP BY pp."passRequestId"
    ) p ON p."passRequestId" = pr.id

    LEFT JOIN (
        SELECT
          pv."passRequestId",

          json_agg(
            (
              to_jsonb(pv)

              ||

              jsonb_build_object(
                'registrationNo', mv."registrationNo",
                'vehicleTypeId', mv."vehicleTypeId",
                'rfidCardNumber', mv."rfidCardNumber",

                'scannedCopyFilePath', mv."scannedCopyFilePath",
                'scannedCopyFileName', mv."scannedCopyFileName",

                'insuranceFilePath', mv."insuranceFilePath",
                'insuranceFileName', mv."insuranceFileName",

                'permitFilePath', mv."permitFilePath",
                'permitFileName', mv."permitFileName",

                'fitnessFilePath', mv."fitnessFilePath",
                'fitnessFileName', mv."fitnessFileName",

                'requestLetterPath', mv."requestLetterPath",
                'requestLetterName', mv."requestLetterName",

                'taxDocPath', mv."taxDocPath",
                'taxDocName', mv."taxDocName",

                'emissionCertPath', mv."emissionCertPath",
                'emissionCertName', mv."emissionCertName",

                'insuranceExpiry', mv."insuranceExpiry",
                'rcValidity', mv."rcValidity",
                'accessAreaId', mv."accessAreaId"
              )
            )
          ) AS vehicles

        FROM pass_vehicles pv

        LEFT JOIN master_vehicles mv
          ON mv.id = pv."masterVehicleId"
      GROUP BY pv."passRequestId"
    ) v ON v."passRequestId" = pr.id

    WHERE pr.id = $1 AND pr."isActive" = true
    `;

    const result = await pool.query(query, [passRequestId]);
    return result.rows[0] || null;
  },
};

const viewPassRequestsDocuments = {
  async getPassDocumentPath(passRequestId, documentType, entityIndex = 0, isVendorPass = false) {
    // Vendor pass documents are stored in relational tables
    if (isVendorPass) {
      let resolvedId = passRequestId;
      if (passRequestId && !/^\d+$/.test(String(passRequestId))) {
        const { decryptToken } = require("../utils/cryptoUtils");
        const decrypted = decryptToken(passRequestId);
        const finalTokenOrId = decrypted || passRequestId;

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

      // Map document types to keys for persons
      const personDocMap = {
        personPhoto: "photoFilePath",
        personAadhar: "aadharPDFFilePATH",
        personIdProof: "idProofFilePath",
        requisitionLetter: "requisitionLetterPath",
        driverLicense: "driverLicensePath",
        policeVerification: "policeVerificationPath",
        employmentProof: "employmentProofPath",
        chaLicenseCopy: "chaLicensePath",
        passportDoc: "passportPath",
      };

      // Map document types to keys for vehicles
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
        const pathKey = personDocMap[documentType];
        const res = await pool.query(
          `SELECT "${pathKey}" AS path 
           FROM "vendor_pass_persons" 
           WHERE "vendorPassRequestId" = $1 
           ORDER BY id ASC`,
          [resolvedId]
        );
        const row = res.rows[entityIndex];
        if (row && row.path) {
          return { filePath: row.path };
        }
      } else if (vehicleDocMap[documentType]) {
        const pathKey = vehicleDocMap[documentType];
        const res = await pool.query(
          `SELECT "${pathKey}" AS path 
           FROM "vendor_pass_vehicles" 
           WHERE "vendorPassRequestId" = $1 
           ORDER BY id ASC`,
          [resolvedId]
        );
        const row = res.rows[entityIndex];
        if (row && row.path) {
          return { filePath: row.path };
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

      case "passRequisitionLetter":
        columnName = "requisitionLetterFilePath";
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

      case "authLetter":
        columnName = "authLetterFilePath";
        tableName = "pass_requests";
        break;

      case "passRequisitionLetter":
        columnName = "requisitionLetterFilePath";
        tableName = "pass_requests";
        break;

      default:
        throw new Error("Invalid document type");
    }

    /* =========================================
        PASS REQUEST LEVEL DOCUMENTS
      ========================================= */

    if (
      documentType === "authLetter" ||
      documentType === "passRequisitionLetter"
    ) {
      const query = `
          SELECT "${columnName}" 
          FROM pass_requests
          WHERE id = $1
        `;

      const result = await pool.query(query, [passRequestId]);

      return result.rows[0] || null;
    }

    /* =========================================
        PERSON DOCUMENTS
      ========================================= */

    const personDocuments = [
      "personPhoto",
      "personAadhar",
      "personIdProof",
      "driverLicense",
      "policeVerification",
      "employmentProof",
      "chaLicenseCopy",
      "passportDoc",
    ];

    if (personDocuments.includes(documentType)) {
      const query = `
          SELECT
            mp."${columnName}" 
          FROM pass_persons pp

          INNER JOIN master_persons mp
            ON mp.id = pp."masterPersonId"

          WHERE pp."passRequestId" = $1
          AND mp."${columnName}" IS NOT NULL

          ORDER BY pp.id
        `;

      const result = await pool.query(query, [passRequestId]);

      return result.rows[entityIndex] || null;
    }

    /* =========================================
        VEHICLE DOCUMENTS
      ========================================= */

    const vehicleDocuments = [
      "vehicleRC",
      "vehicleInsurance",
      "vehiclePermit",
      "vehicleFitness",
      "vehicleRequestLetter",
      "vehicleTax",
      "vehicleEmission",
    ];

    if (vehicleDocuments.includes(documentType)) {
      const query = `
          SELECT
            mv."${columnName}" 
          FROM pass_vehicles pv

          INNER JOIN master_vehicles mv
            ON mv.id = pv."masterVehicleId"

          WHERE pv."passRequestId" = $1
          AND mv."${columnName}" IS NOT NULL

          ORDER BY pv.id
        `;

      const result = await pool.query(query, [passRequestId]);

      return result.rows[entityIndex] || null;
    }

    return null;
  },

  async getMasterDocumentPath(masterId, entityType, documentType) {
    const personDocMap = {
      personPhoto: "photoFilePath",
      personAadhar: "aadharPDFFilePATH",
      personIdProof: "idProofFilePath",
      driverLicense: "driverLicensePath",
      policeVerification: "policeVerificationPath",
      employmentProof: "employmentProofPath",
      chaLicenseCopy: "chaLicensePath",
      passportDoc: "passportPath",
    };

    const vehicleDocMap = {
      vehicleRC: "scannedCopyFilePath",
      vehicleInsurance: "insuranceFilePath",
      vehiclePermit: "permitFilePath",
      vehicleFitness: "fitnessFilePath",
      vehicleRequestLetter: "requestLetterPath",
      vehicleTax: "taxDocPath",
      vehicleEmission: "emissionCertPath",
    };

    if (!masterId) {
      return null;
    }

    /* =====================================
        PERSON DOCUMENTS
    ===================================== */

    if (entityType === "person") {
      const columnName = personDocMap[documentType];

      if (!columnName) {
        return null;
      }

      const query = `
        SELECT "${columnName}" AS "filePath"
        FROM master_persons
        WHERE id = $1
      `;

      const result = await pool.query(query, [masterId]);

      return result.rows[0] || null;
    }

    /* =====================================
        VEHICLE DOCUMENTS
    ===================================== */

    if (entityType === "vehicle") {
      const columnName = vehicleDocMap[documentType];

      if (!columnName) {
        return null;
      }

      const query = `
        SELECT "${columnName}" AS "filePath"
        FROM master_vehicles
        WHERE id = $1
      `;

      const result = await pool.query(query, [masterId]);

      return result.rows[0] || null;
    }

    return null;
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
