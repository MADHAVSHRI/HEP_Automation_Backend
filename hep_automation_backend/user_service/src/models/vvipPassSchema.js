const { pool } = require("../dbconfig/db");

const VvipPassSchema = {
  async createRequest(data) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const requestResult = await client.query(
        `
          INSERT INTO "vvip_pass_requests" (
            "referenceNo",
            "createdByUserId",
            "departmentId",
            "departmentName",
            "visitPurpose",
            "visitDate",
            "validityFrom",
            "validityTo",
            "noOfPasses",
            "remarks",
            "status",
            "createdAt",
            "updatedAt"
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'UNDER_REVIEW',NOW(),NOW())
          RETURNING *;
        `,
        [
          data.referenceNo,
          data.createdByUserId || null,
          data.departmentId || null,
          data.departmentName || null,
          data.visitPurpose || null,
          data.visitDate || null,
          data.validityFrom || null,
          data.validityTo || null,
          Number(data.noOfPasses) || 0,
          data.remarks || null,
        ],
      );

      const request = requestResult.rows[0];

      for (const person of data.persons || []) {
        await client.query(
          `
            INSERT INTO "vvip_pass_persons" (
              "requestId",
              "name",
              "designation",
              "mobile",
              "idProofType",
              "idProofNo",
              "idProofFilePath",
              "documentPath",
              "createdAt",
              "updatedAt"
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW());
          `,
          [
            request.id,
            person.name || null,
            person.designation || null,
            person.mobile || null,
            person.idProofType || null,
            person.idProofNo || null,
            person.idProofFilePath || null,
            person.documentPath || null,
          ],
        );
      }

      for (const vehicle of data.vehicles || []) {
        await client.query(
          `
            INSERT INTO "vvip_pass_vehicles" (
              "requestId",
              "vehicleNo",
              "vehicleType",
              "driverName",
              "driverMobile",
              "documentPath",
              "rcBookPath",
              "insuranceDocumentPath",
              "createdAt",
              "updatedAt"
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW());
          `,
          [
            request.id,
            vehicle.vehicleNo || null,
            vehicle.vehicleType || null,
            vehicle.driverName || null,
            vehicle.driverMobile || null,
            vehicle.documentPath || null,
            vehicle.rcBookPath || null,
            vehicle.insuranceDocumentPath || null,
          ],
        );
      }

      await client.query("COMMIT");
      return this.getById(request.id);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  async replaceRequest(id, data) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const requestResult = await client.query(
        `
          UPDATE "vvip_pass_requests"
          SET
            "departmentName" = $2,
            "visitPurpose" = $3,
            "visitDate" = $4,
            "validityFrom" = $5,
            "validityTo" = $6,
            "noOfPasses" = $7,
            "remarks" = $8,
            "status" = 'UNDER_REVIEW',
            "approvedBy" = NULL,
            "approvedAt" = NULL,
            "rejectedReason" = NULL,
            "updatedAt" = NOW()
          WHERE id = $1
          RETURNING *;
        `,
        [
          id,
          data.departmentName || null,
          data.visitPurpose || null,
          data.visitDate || null,
          data.validityFrom || null,
          data.validityTo || null,
          Number(data.noOfPasses) || 0,
          data.remarks || null,
        ],
      );

      const request = requestResult.rows[0];
      if (!request) {
        await client.query("ROLLBACK");
        return null;
      }

      await client.query(`DELETE FROM "vvip_pass_persons" WHERE "requestId" = $1`, [id]);
      await client.query(`DELETE FROM "vvip_pass_vehicles" WHERE "requestId" = $1`, [id]);

      for (const person of data.persons || []) {
        await client.query(
          `
            INSERT INTO "vvip_pass_persons" (
              "requestId",
              "name",
              "designation",
              "mobile",
              "idProofType",
              "idProofNo",
              "idProofFilePath",
              "documentPath",
              "createdAt",
              "updatedAt"
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW());
          `,
          [
            request.id,
            person.name || null,
            person.designation || null,
            person.mobile || null,
            person.idProofType || null,
            person.idProofNo || null,
            person.idProofFilePath || null,
            person.documentPath || null,
          ],
        );
      }

      for (const vehicle of data.vehicles || []) {
        await client.query(
          `
            INSERT INTO "vvip_pass_vehicles" (
              "requestId",
              "vehicleNo",
              "vehicleType",
              "driverName",
              "driverMobile",
              "documentPath",
              "rcBookPath",
              "insuranceDocumentPath",
              "createdAt",
              "updatedAt"
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW());
          `,
          [
            request.id,
            vehicle.vehicleNo || null,
            vehicle.vehicleType || null,
            vehicle.driverName || null,
            vehicle.driverMobile || null,
            vehicle.documentPath || null,
            vehicle.rcBookPath || null,
            vehicle.insuranceDocumentPath || null,
          ],
        );
      }

      await client.query("COMMIT");
      return this.getById(request.id);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  async list(filters = {}) {
    const where = [];
    const values = [];
    let paramIndex = 1;

    if (filters.createdByUserId) {
      where.push(`r."createdByUserId" = $${paramIndex++}`);
      values.push(filters.createdByUserId);
    }

    if (filters.status) {
      where.push(`r."status" = $${paramIndex++}`);
      values.push(filters.status);
    }

    const result = await pool.query(
      `
        SELECT
          r.*,
          COUNT(DISTINCT p.id)::int AS "personsCount",
          COUNT(DISTINCT v.id)::int AS "vehiclesCount"
        FROM "vvip_pass_requests" r
        LEFT JOIN "vvip_pass_persons" p ON p."requestId" = r.id
        LEFT JOIN "vvip_pass_vehicles" v ON v."requestId" = r.id
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        GROUP BY r.id
        ORDER BY r."createdAt" DESC;
      `,
      values,
    );

    return result.rows;
  },

  async getById(id) {
    const requestResult = await pool.query(
      `SELECT * FROM "vvip_pass_requests" WHERE id = $1`,
      [id],
    );
    const request = requestResult.rows[0];

    if (!request) return null;

    const [personsResult, vehiclesResult] = await Promise.all([
      pool.query(
        `SELECT * FROM "vvip_pass_persons" WHERE "requestId" = $1 ORDER BY id ASC`,
        [id],
      ),
      pool.query(
        `SELECT * FROM "vvip_pass_vehicles" WHERE "requestId" = $1 ORDER BY id ASC`,
        [id],
      ),
    ]);

    return {
      ...request,
      persons: personsResult.rows,
      vehicles: vehiclesResult.rows,
    };
  },

  async updateStatus(id, data) {
    const result = await pool.query(
      `
        UPDATE "vvip_pass_requests"
        SET
          "status" = $2::"enum_vvip_pass_requests_status",
          "approvedBy" = $3,
          "approvedAt" = CASE WHEN $2::text = 'APPROVED' THEN NOW() ELSE "approvedAt" END,
          "rejectedReason" = $4,
          "qrPdfPath" = COALESCE($5, "qrPdfPath"),
          "updatedAt" = NOW()
        WHERE id = $1
        RETURNING *;
      `,
      [
        id,
        data.status,
        data.approvedBy || null,
        data.rejectedReason || null,
        data.qrPdfPath || null,
      ],
    );

    return result.rows[0] || null;
  },
};

module.exports = VvipPassSchema;
