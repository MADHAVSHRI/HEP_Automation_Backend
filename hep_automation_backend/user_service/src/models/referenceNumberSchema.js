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
  }

};

module.exports = ReferenceNumber;