/**
 * enrichmentService.js — gate-service
 *
 * Turns a bare device identifier into the details the console has to show.
 * The hardware sends an identifier only; everything displayed is read here
 * from the existing tables owned by user_service and tos-service.
 *
 * Reads are deliberately raw SELECTs against the shared `hep_automation`
 * database rather than re-declared Sequelize models, so this service does not
 * duplicate models that already live in the owning services.
 */

const { sequelize } = require("../../models");
const { QueryTypes } = require("sequelize");
const { SUBJECT_TYPES } = require("../constants/constants");

/**
 * Person behind a QR card number, master person id, or face template id.
 * Source: user_service `master_persons`.
 */
const findPerson = async (identifier) => {
  const rows = await sequelize.query(
    `SELECT p.id,
            p."name",
            p."cardNumber",
            p."mobile",
            p."email",
            p."photoFilePath",
            p."vehicleNo",
            p."idProofType",
            p."idProofNumber",
            d."name" AS "designation"
       FROM master_persons p
       LEFT JOIN designations d ON d.id = p."designationId"
      WHERE p."cardNumber" = :identifier
         OR CAST(p.id AS TEXT) = :identifier
      LIMIT 1`,
    { replacements: { identifier }, type: QueryTypes.SELECT },
  );

  if (!rows.length) return null;
  const person = rows[0];

  return {
    type: SUBJECT_TYPES.PERSON,
    id: person.id,
    name: person.name,
    passId: person.cardNumber,
    mobile: person.mobile,
    email: person.email,
    designation: person.designation,
    photoPath: person.photoFilePath,
    registeredVehicleNo: person.vehicleNo,
    idProofType: person.idProofType,
    idProofNumber: person.idProofNumber,
  };
};

/**
 * Vehicle behind an ANPR plate read or RFID tag.
 * Source: user_service `master_vehicles`.
 */
const findVehicle = async (identifier) => {
  const normalised = String(identifier).replace(/\s+/g, "").toUpperCase();

  const rows = await sequelize.query(
    `SELECT v.id,
            v."registrationNo",
            v."rfidCardNumber",
            v."insuranceExpiry",
            v."rcValidity",
            v."isActive",
            t."name" AS "vehicleType"
       FROM master_vehicles v
       LEFT JOIN vehicle_types t ON t.id = v."vehicleTypeId"
      WHERE REPLACE(UPPER(v."registrationNo"), ' ', '') = :normalised
         OR v."rfidCardNumber" = :identifier
      LIMIT 1`,
    { replacements: { normalised, identifier }, type: QueryTypes.SELECT },
  );

  if (!rows.length) return null;
  const vehicle = rows[0];

  return {
    type: SUBJECT_TYPES.VEHICLE,
    id: vehicle.id,
    registrationNo: vehicle.registrationNo,
    rfidCardNumber: vehicle.rfidCardNumber,
    vehicleType: vehicle.vehicleType,
    rcValidity: vehicle.rcValidity,
    insuranceExpiry: vehicle.insuranceExpiry,
    isActive: vehicle.isActive,
  };
};

/**
 * Container / cargo movement behind a container number.
 * Source: tos-service `tos_eir_records` (most recent movement wins).
 */
const findContainer = async (identifier) => {
  const normalised = String(identifier).replace(/\s+/g, "").toUpperCase();

  const rows = await sequelize.query(
    `SELECT "eirNo",
            "terminal",
            "containerNumber",
            "containerISO",
            "containerSize",
            "movementType",
            "fullEmpty",
            "line",
            "trailerNumber",
            "oocStatus",
            "destinationName",
            "markedForScanning",
            "inGateDateTime",
            "outGateDateTime"
       FROM tos_eir_records
      WHERE REPLACE(UPPER("containerNumber"), ' ', '') = :normalised
      ORDER BY COALESCE("inGateDateTime", "createdAt") DESC
      LIMIT 1`,
    { replacements: { normalised }, type: QueryTypes.SELECT },
  );

  if (!rows.length) return null;
  const record = rows[0];

  return {
    type: SUBJECT_TYPES.CONTAINER,
    containerNumber: record.containerNumber,
    eirNo: record.eirNo,
    terminal: record.terminal,
    containerISO: record.containerISO,
    containerSize: record.containerSize,
    movementType: record.movementType,
    fullEmpty: record.fullEmpty,
    line: record.line,
    trailerNumber: record.trailerNumber,
    oocStatus: record.oocStatus,
    destinationName: record.destinationName,
    markedForScanning: record.markedForScanning,
    inGateDateTime: record.inGateDateTime,
    outGateDateTime: record.outGateDateTime,
  };
};

module.exports = {
  findPerson,
  findVehicle,
  findContainer,
};
