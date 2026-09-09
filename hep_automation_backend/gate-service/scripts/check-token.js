#!/usr/bin/env node
/**
 * check-token.js — gate-service
 *
 * Answers "why does the console say gate feed error / not authorised?" for a
 * given access token, without needing the mobile app.
 *
 *   node scripts/check-token.js <accessToken>
 *
 * Reports, in the order the socket handshake checks them:
 *   1. does the token verify with THIS service's JWT_SECRET?
 *   2. is the holder a CISF officer?
 *   3. does that user exist in this database?
 *   4. do they have an active gate posting?
 */

require("dotenv").config();
const jwt = require("jsonwebtoken");
const { sequelize, Gate, GateOfficerAssignment } = require("../models");

const token = (process.argv[2] || "").replace(/^Bearer\s+/i, "");

const fail = (message, hint) => {
  console.log(`\n  FAIL  ${message}`);
  if (hint) console.log(`        → ${hint}`);
  process.exit(1);
};

const ok = (message) => console.log(`  OK    ${message}`);

(async () => {
  if (!token) {
    console.log("usage: node scripts/check-token.js <accessToken>");
    process.exit(2);
  }

  // Keep the report readable — this is a diagnostic, not a query log.
  sequelize.options.logging = false;

  console.log("\nGate feed token check\n");

  /* 1. Signature */
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    fail("JWT_SECRET is not set in gate-service/.env");
  }

  let claims;
  try {
    claims = jwt.verify(token, secret);
  } catch (error) {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded) {
      fail("Token is not a readable JWT", "Copy the whole accessToken value.");
    }
    fail(
      `Token does not verify with this service's JWT_SECRET (${error.message})`,
      "The app logged in against a different environment than this gate-service. " +
        "Point the app at the same auth-service, or copy that environment's " +
        "JWT_SECRET into gate-service/.env.",
    );
  }
  ok(`Signature valid — userId=${claims.userId}, role=${claims.role}, ` +
     `department=${claims.departmentName}`);

  /* 2. Role */
  const role = (claims.role || "").toUpperCase();
  const department = (claims.departmentName || "").toUpperCase();
  if (role !== "CISF" && department !== "CISF") {
    fail(
      `Holder is not CISF (role=${claims.role}, department=${claims.departmentName})`,
      "The gate feed is only served to CISF officers.",
    );
  }
  ok("Holder is a CISF officer");

  /* 3. User exists here */
  const [user] = await sequelize.query(
    'SELECT id, "userName" FROM users WHERE id = :id',
    { replacements: { id: claims.userId }, type: sequelize.QueryTypes.SELECT },
  );
  if (!user) {
    fail(
      `No user with id ${claims.userId} in this database`,
      "The token was issued by an environment with a different user table.",
    );
  }
  ok(`User exists here — ${user.userName} (id ${user.id})`);

  /* 4. Gate posting */
  const assignments = await GateOfficerAssignment.findAll({
    where: { userId: claims.userId, isActive: true },
    include: [{ model: Gate, as: "gate", where: { isActive: true } }],
  });

  if (!assignments.length) {
    const gates = await Gate.findAll({ where: { isActive: true } });
    fail(
      "Officer has no active gate posting",
      "Assign one, e.g.\n        INSERT INTO gate_officer_assignments " +
        `("gateId","userId","isActive","createdAt","updatedAt")\n        VALUES (` +
        `(SELECT id FROM gates WHERE "gateCode"='${gates[0]?.gateCode || "GATE_01"}'), ` +
        `${claims.userId}, true, NOW(), NOW());`,
    );
  }

  ok(
    `Posted to ${assignments.length} gate(s): ` +
      assignments.map((a) => a.gate.gateCode).join(", "),
  );

  console.log("\n  This token can open the gate feed.\n");
  await sequelize.close();
})().catch(async (error) => {
  console.error("\n  ERROR", error.message, "\n");
  process.exit(3);
});
