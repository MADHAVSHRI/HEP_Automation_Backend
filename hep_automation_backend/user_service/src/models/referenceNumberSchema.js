const { pool } = require("../dbconfig/db");

const ReferenceNumber = {

  /*
  ==========================================
  Generate Pass Request Reference Number
  ==========================================
  */

  async generatePassReference(client){

  const today = new Date().toISOString().slice(0,10);

  const query = `
    INSERT INTO daily_pass_counters(date,"passRequestCounter")
    VALUES($1,1)
    ON CONFLICT(date)
    DO UPDATE SET "passRequestCounter" =
    daily_pass_counters."passRequestCounter" + 1
    RETURNING "passRequestCounter"
  `;

  const result = await client.query(query,[today]);

    const count = result.rows[0].passRequestCounter;

    const padded = String(count).padStart(4,"0");

    const d = new Date(today);

    const day = String(d.getDate()).padStart(2,"0");
    const month = String(d.getMonth()+1).padStart(2,"0");
    const year = String(d.getFullYear()).slice(-2);

    return `PASS${day}${month}${year}${padded}`;
  },

  /*
  ==========================================
  Generate Person Pass Number
  ==========================================
  */

  async generatePersonPassNo(client){

    const today = new Date().toISOString().slice(0,10);

    const query = `
      INSERT INTO daily_pass_counters(date,"personCounter")
      VALUES($1,1)
      ON CONFLICT(date)
      DO UPDATE SET "personCounter" = daily_pass_counters."personCounter" + 1
      RETURNING "personCounter"
    `;

    const result = await client.query(query,[today]);

    const count = result.rows[0].personCounter;

    const padded = String(count).padStart(4,"0");

    const d = new Date(today);

    const day = String(d.getDate()).padStart(2,"0");
    const month = String(d.getMonth()+1).padStart(2,"0");
    const year = String(d.getFullYear()).slice(-2);

    return `PER${day}${month}${year}${padded}`;
  },

  /*
  ==========================================
  Generate Vehicle Pass Number
  ==========================================
  */

  async generateVehiclePassNo(client){

    const today = new Date().toISOString().slice(0,10);

    const query = `
      INSERT INTO daily_pass_counters(date,"vehicleCounter")
      VALUES($1,1)
      ON CONFLICT(date)
      DO UPDATE SET "vehicleCounter" = daily_pass_counters."vehicleCounter" + 1
      RETURNING "vehicleCounter"
    `;

    const result = await client.query(query,[today]);

    const count = result.rows[0].vehicleCounter;

    const padded = String(count).padStart(4,"0");

    const d = new Date(today);

    const day = String(d.getDate()).padStart(2,"0");
    const month = String(d.getMonth()+1).padStart(2,"0");
    const year = String(d.getFullYear()).slice(-2);

    return `VEH${day}${month}${year}${padded}`;
  },

  /*
  ==========================================
  Generate Vendor Pass Reference Number
  ==========================================
  */

  async generateVendorPassReference(client){

  const today = new Date().toISOString().slice(0,10);

  const query = `
    INSERT INTO daily_pass_counters(date,"vendorPassCounter")
    VALUES($1,1)
    ON CONFLICT(date)
    DO UPDATE SET "vendorPassCounter" =
    daily_pass_counters."vendorPassCounter" + 1
    RETURNING "vendorPassCounter"
  `;

  const result = await client.query(query,[today]);

    const count = result.rows[0].vendorPassCounter;

    const padded = String(count).padStart(4,"0");

    const d = new Date(today);

    const day = String(d.getDate()).padStart(2,"0");
    const month = String(d.getMonth()+1).padStart(2,"0");
    const year = String(d.getFullYear()).slice(-2);

    return `V${day}${month}${year}${padded}`;
  },

  /*
  ==========================================
  Generate Bulk Pass Reference Number
  ==========================================
  */

  async generateBulkPassReference(client){

    const today = new Date().toISOString().slice(0,10);

    const query = `
      INSERT INTO daily_pass_counters(date,"bulkPassCounter")
      VALUES($1,1)
      ON CONFLICT(date)
      DO UPDATE SET "bulkPassCounter" =
      daily_pass_counters."bulkPassCounter" + 1
      RETURNING "bulkPassCounter"
    `;

    const result = await client.query(query,[today]);

    const count = result.rows[0].bulkPassCounter;

    const padded = String(count).padStart(4,"0");

    const d = new Date(today);

    const day = String(d.getDate()).padStart(2,"0");
    const month = String(d.getMonth()+1).padStart(2,"0");
    const year = String(d.getFullYear()).slice(-2);

    return `BLK${day}${month}${year}${padded}`;
  },

  /*
  ==========================================
  Generate Profile Update Reference Number
  ==========================================
  */

  async generateProfileUpdateReference(client){

    const today = new Date().toISOString().slice(0,10);

    const query = `
      INSERT INTO daily_pass_counters(date,"profileUpdateCounter")
      VALUES($1,1)
      ON CONFLICT(date)
      DO UPDATE SET "profileUpdateCounter" =
      COALESCE(daily_pass_counters."profileUpdateCounter", 0) + 1
      RETURNING "profileUpdateCounter"
    `;

    const result = await client.query(query,[today]);

    const count = result.rows[0].profileUpdateCounter;

    const padded = String(count).padStart(4,"0");

    const d = new Date(today);

    const day = String(d.getDate()).padStart(2,"0");
    const month = String(d.getMonth()+1).padStart(2,"0");
    const year = String(d.getFullYear()).slice(-2);

    return `PUR${day}${month}${year}${padded}`;
  },

  /*
  ==========================================
  Generate Material Pass Reference Number
  ==========================================
  */

  async generateMaterialPassReference(client) {

      const today = new Date().toISOString().slice(0, 10);

      const query = `
          INSERT INTO daily_pass_counters(date,"materialPassRequestCounter")
          VALUES($1,1)
          ON CONFLICT(date)
          DO UPDATE SET "materialPassRequestCounter" =
          daily_pass_counters."materialPassRequestCounter" + 1
          RETURNING "materialPassRequestCounter"
      `;

      const result = await client.query(query, [today]);

      const count = result.rows[0].materialPassRequestCounter;

      const padded = String(count).padStart(4, "0");

      const d = new Date(today);

      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = String(d.getFullYear()).slice(-2);

      return `MAT${day}${month}${year}${padded}`;
  },

  /*
  ==========================================
  Generate Returnable Pass Number
  ==========================================
  */

  async generateReturnablePassNo(client) {

      const today = new Date().toISOString().slice(0, 10);

      const query = `
          INSERT INTO daily_pass_counters(date,"returnableCounter")
          VALUES($1,1)
          ON CONFLICT(date)
          DO UPDATE SET "returnableCounter" =
          daily_pass_counters."returnableCounter" + 1
          RETURNING "returnableCounter"
      `;

      const result = await client.query(query, [today]);

      const count = result.rows[0].returnableCounter;

      const padded = String(count).padStart(4, "0");

      const d = new Date(today);

      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = String(d.getFullYear()).slice(-2);

      return `RET${day}${month}${year}${padded}`;
  },

  /*
  ==========================================
  Generate Non-Returnable Pass Number
  ==========================================
  */

  async generateNonReturnablePassNo(client) {

      const today = new Date().toISOString().slice(0, 10);

      const query = `
          INSERT INTO daily_pass_counters(date,"nonReturnableCounter")
          VALUES($1,1)
          ON CONFLICT(date)
          DO UPDATE SET "nonReturnableCounter" =
          daily_pass_counters."nonReturnableCounter" + 1
          RETURNING "nonReturnableCounter"
      `;

      const result = await client.query(query, [today]);

      const count = result.rows[0].nonReturnableCounter;

      const padded = String(count).padStart(4, "0");

      const d = new Date(today);

      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = String(d.getFullYear()).slice(-2);

      return `NRT${day}${month}${year}${padded}`;
  },

  /*
  ==========================================
  Generate Surplus Pass Number
  ==========================================
  */

  async generateSurplusPassNo(client) {

      const today = new Date().toISOString().slice(0, 10);

      const query = `
          INSERT INTO daily_pass_counters(date,"surplusCounter")
          VALUES($1,1)
          ON CONFLICT(date)
          DO UPDATE SET "surplusCounter" =
          daily_pass_counters."surplusCounter" + 1
          RETURNING "surplusCounter"
      `;

      const result = await client.query(query, [today]);

      const count = result.rows[0].surplusCounter;

      const padded = String(count).padStart(4, "0");

      const d = new Date(today);

      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = String(d.getFullYear()).slice(-2);

      return `SUR${day}${month}${year}${padded}`;
  },

  /*
  ==========================================
  Generate Debris Pass Number
  ==========================================
  */

  async generateDebrisPassNo(client) {

      const today = new Date().toISOString().slice(0, 10);

      const query = `
          INSERT INTO daily_pass_counters(date,"debrisCounter")
          VALUES($1,1)
          ON CONFLICT(date)
          DO UPDATE SET "debrisCounter" =
          daily_pass_counters."debrisCounter" + 1
          RETURNING "debrisCounter"
      `;

      const result = await client.query(query, [today]);

      const count = result.rows[0].debrisCounter;

      const padded = String(count).padStart(4, "0");

      const d = new Date(today);

      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = String(d.getFullYear()).slice(-2);

      return `DEB${day}${month}${year}${padded}`;
  },

};

module.exports = ReferenceNumber;