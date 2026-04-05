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

  async generateReferenceNumber() {

  const result = await pool.query(
    `SELECT COUNT(*) FROM "Agents"`
  );

  const next = parseInt(result.rows[0].count) + 1;

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

  }

};


module.exports = Agent;






































































