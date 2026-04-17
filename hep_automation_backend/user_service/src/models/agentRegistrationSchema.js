const { pool } = require("../dbconfig/db");

const Agent = {

  async findDuplicate(email, mobileNo, panNumber, gstinNumber) {
    const query = `
      SELECT * FROM "Agents"
      WHERE email=$1 OR "mobileNo"=$2 OR "panNumber"=$3 OR "gstinNumber"=$4
      LIMIT 1
    `;
    const values = [email, mobileNo, panNumber, gstinNumber];

    const result = await pool.query(query, values);
    return result.rows[0];
  },

//   async generateReferenceNumber() {

//   const result = await pool.query(
//     `SELECT COUNT(*) FROM "Agents"`
//   );

//   const next = parseInt(result.rows[0].count) + 1;

//   const padded = String(next).padStart(5,"0");

//   return `CHPT${padded}`;
// },

  async generateReferenceNumber() {

    const result = await pool.query(
      `SELECT nextval('agent_reference_seq')`
    );

    const next = result.rows[0].nextval;

    const padded = String(next).padStart(5,"0");

    return `CHPT${padded}`;
  },
  
  async updateEmailStatus(agentId) {

    const query = `
      UPDATE "Agents"
      SET "isRefNoSentByEmail" = true
      WHERE id = $1
    `;

    await pool.query(query, [agentId]);

  },

  async create(agentData) {

    const referenceNumber = await Agent.generateReferenceNumber();

    const query = `
      INSERT INTO "Agents"(
  "userTypeId",
  "userTypeName",
  "entityName",
  "mobileNo",
  "email",
  "entityFile",

  "addressLine",
  "city",
  "state",
  "pincode",
  "country",

  "gstinNumber",
  "gstinDoc",

  "panNumber",
  "panDoc",

  "tanNumber",
  "tanDoc",

  "remark",
  "referenceNumber",

  "title",
  "firstName",
  "lastName",
  "contactMobile",
  "contactEmail",
  "termsAccepted"
  
)
  VALUES (
    $1, $2, $3, $4, $5,
    $6, $7, $8, $9, $10,
    $11, $12,
    $13, $14,
    $15, $16,
    $17,
    $18, $19, $20, $21, $22,
    $23, $24, $25 
  )
  RETURNING *
`;

    const values = [
      agentData.userTypeId,
      agentData.userTypeName,
      agentData.entityName,
      agentData.mobileNo,
      agentData.email,
      agentData.entityFile,

      agentData.addressLine,
      agentData.city,
      agentData.state,
      agentData.pincode,
      agentData.country,

      agentData.gstinNumber,
      agentData.gstinDoc,

      agentData.panNumber,
      agentData.panDoc,

      agentData.tanNumber,
      agentData.tanDoc,

      agentData.remark,
      referenceNumber,


      agentData.title,
      agentData.firstName,
      agentData.lastName,
      agentData.contactMobile,
      agentData.contactEmail,
      agentData.termsAccepted
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  },

  async getAllRegisteredAgents(isApproved) {

    let query = `
      SELECT *
      FROM "Agents"
    `;

    let values = [];

    if (isApproved !== undefined) {
      query += ` WHERE "isApproved" = $1`;
      values.push(isApproved === 'true');
    }
    query += ` ORDER BY "createdAt" DESC`;
    const result = await pool.query(query, values);
    return result.rows;
  },

  async updateEmailStatusByReference(referenceNumber) {

  const query = `
    UPDATE "Agents"
    SET "isRefNoSentByEmail" = true
    WHERE "referenceNumber" = $1
  `;

  await pool.query(query, [referenceNumber]);

},

async approveAgent(agentId, loginId, password){

    const query = `
      UPDATE "Agents"
      SET
        "isApproved" = true,
        "status" = 'approved',
        "loginId" = $2,
        "password" = $3
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query,[agentId,loginId,password]);

    return result.rows[0];

  },

  async rejectAgent(agentId, reason){

    const query = `
      UPDATE "Agents"
      SET
        "status"='rejected',
        "rejectedReason"=$2
      WHERE id=$1
      RETURNING *
    `;

    const result = await pool.query(query,[agentId,reason]);

    return result.rows[0];

  },

  async updateCredentialEmailStatus(agentId){

    const query = `
      UPDATE "Agents"
      SET "isCredentialSentByEmail" = true
      WHERE id = $1
    `;

    await pool.query(query,[agentId]);

  },

  async getAgentById(agentId) {

  const query = `
    SELECT
      id,
      "userTypeName",
      "entityName",
      "firstName",
      "lastName",
      "email",
      "mobileNo",
      "city",
      "state",
      "country",
      "addressLine",
      "pincode",
      "gstinNumber",
      "referenceNumber",
      "loginId",
      "role",
      "status",
      "createdAt"
    FROM "Agents"
    WHERE id = $1
    AND status = 'approved'
  `;

  const result = await pool.query(query, [agentId]);

  return result.rows[0];

},

  async getLoginUser(loginId) {

    const query = `
      SELECT
        id,
        password,
        role
      FROM "Agents"
      WHERE "loginId" = $1
      AND "isApproved" = true
    `;

    const result = await pool.query(query, [loginId]);

    return result.rows[0];

  },

  async trackRequest(referenceNumber) {

    const query = `
      SELECT
        "entityName",
        "mobileNo",
        "email",
        "title",
        "firstName",
        "status",
        "createdAt"
      FROM "Agents"
      WHERE "referenceNumber" = $1
    `;

    const result = await pool.query(query, [referenceNumber]);

    return result.rows[0];

  },

  async getDocumentPath(referenceNumber, documentType) {
    let columnName;
    switch (documentType) {
      case "entity":
        columnName = "entityFile";
        break;
      case "pan":
        columnName = "panDoc";
        break;
      case "gst":
        columnName = "gstinDoc";
        break;
      case "tan":
        columnName = "tanDoc";
        break;
      default:
        throw new Error("Invalid document type");
    }

    const query = `
      SELECT "${columnName}"
      FROM "Agents"
      WHERE "referenceNumber" = $1
    `;

    const result = await pool.query(query, [referenceNumber]);

    return result.rows[0];
  }

};


module.exports = Agent;






































































