const { pool } = require("../dbconfig/db");

/* The port this deployment issues permits for. Fixed, as in the agreed spec. */
const PORT_CODE = "INMAA1";

/* Agent type codes expected by iPortman, keyed on our own user-type names. */
const AGENT_TYPE_CODES = [
  { match: ["transport", "truck", "trailer", "lorry", "logistics"], code: "TRA" },
  { match: ["steamer", "shipping", "agent"], code: "SAG" },
  { match: ["cha", "custom"], code: "CHA" },
  { match: ["govt", "government"], code: "GOV" },
  { match: ["vendor"], code: "VEN" },
];

const agentTypeCode = (userTypeName) => {
  const name = String(userTypeName || "").toLowerCase();
  const hit = AGENT_TYPE_CODES.find((entry) =>
    entry.match.some((kw) => name.includes(kw)),
  );
  // TRA is the commonest agent and the safest default; iPortman rejects blanks.
  return hit ? hit.code : "TRA";
};

/* "2023-08-19 16:48:05" — iPortman's format for every timestamp but one. */
const toDateTime = (value) => {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
    `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  );
};

/* VehicleInsuranceValidity is the one field sent as "19-12-2023". */
const toDayMonthYear = (value) => {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`;
};

/* "DAILY" -> "Daily", to match the casing in the agreed payload. */
const titleCase = (value) => {
  const v = String(value || "").trim();
  if (!v) return "";
  return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
};

/**
 * Builds the iPortman Port Entry Permit document for one pass request.
 *
 * Returns null when the request has no approved person or vehicle — there is
 * nothing to register, and iPortman rejects empty permits.
 */
const buildPortEntryPermitPayload = async (passRequestId) => {
  const { rows: requestRows } = await pool.query(
    `
    SELECT
      pr.id,
      pr."referenceNo",
      pr."updatedAt",
      a."entityName",
      a."userTypeName",
      a."referenceNumber" AS "agentReferenceNumber",
      a."mobileNo"        AS "agentMobileNo",
      vp.name             AS "purposeOfVisit"
    FROM pass_requests pr
    LEFT JOIN agents a         ON a.id = pr."agentId"
    LEFT JOIN visit_purposes vp ON vp.id = pr."purposeOfVisitId"
    WHERE pr.id = $1
    `,
    [passRequestId],
  );

  const request = requestRows[0];
  if (!request) return null;

  const { rows: persons } = await pool.query(
    `
    SELECT
      pp.name,
      pp."idProofNumber",
      pp."idProofType",
      pp."aadharNo",
      pp."passType",
      pp."dateFrom",
      pp."dateTo",
      ht.name AS "hepTypeName"
    FROM pass_persons pp
    LEFT JOIN hep_types ht ON ht.id = pp."hepTypeId"
    WHERE pp."passRequestId" = $1 AND pp.status = 'approved'
    ORDER BY pp.id ASC
    `,
    [passRequestId],
  );

  const { rows: vehicles } = await pool.query(
    `
    SELECT
      pv."registrationNo",
      pv."insuranceExpiry",
      pv."passType",
      pv."dateFrom",
      pv."dateTo",
      pv."rfidCardNumber",
      pv."qrUuid",
      pv."vehiclePassNo",
      vt.name AS "vehicleTypeName"
    FROM pass_vehicles pv
    LEFT JOIN vehicle_types vt ON vt.id = pv."vehicleTypeId"
    WHERE pv."passRequestId" = $1 AND pv.status = 'approved'
    ORDER BY pv.id ASC
    `,
    [passRequestId],
  );

  if (persons.length === 0 && vehicles.length === 0) return null;

  const passFor =
    persons.length > 0 && vehicles.length > 0
      ? "Both"
      : persons.length > 0
        ? "Person"
        : "Vehicle";

  return {
    PortEntryPermit: {
      AgentType: agentTypeCode(request.userTypeName),
      AgentCode: String(request.agentReferenceNumber || ""),
      AgentName: request.entityName || "",
      Passfor: passFor,
      PurposeofPass: request.purposeOfVisit || "",
      PassIssueDT: toDateTime(request.updatedAt || new Date()),
      PassReferenceNo: String(request.referenceNo || ""),
      Portcode: PORT_CODE,
    },

    PersonDetails: persons.map((p) => ({
      PersonPassType: p.hepTypeName || "",
      PersonName: p.name || "",
      PersonLicenseNo: p.idProofNumber || "",
      // We do not capture licence expiry; iPortman expects the field present
      // and reads this sentinel as "not supplied".
      PersonLicenseValidity: "1900-01-01 00:00:00",
      PersonIDType: p.idProofType || "AADHAR CARD",
      PersonIDNo: p.aadharNo || p.idProofNumber || "",
      PassType: titleCase(p.passType),
      PersonPassValidFrom: toDateTime(p.dateFrom),
      PersonPassValidTo: toDateTime(p.dateTo),
    })),

    VehicleDetails: vehicles.map((v) => ({
      VehicleRegdNo: v.registrationNo || "",
      VehicleType: v.vehicleTypeName || "",
      VehicleInsuranceValidity: toDayMonthYear(v.insuranceExpiry),
      PassType: titleCase(v.passType),
      PassValidFrom: toDateTime(v.dateFrom),
      PassValidTo: toDateTime(v.dateTo),
      ContactNo: request.agentMobileNo || "",
      ContactPerson: "",
      RFIDCardNo: v.rfidCardNumber || "",
      QRCode: String(v.qrUuid || v.vehiclePassNo || ""),
    })),
  };
};

module.exports = {
  buildPortEntryPermitPayload,
  PORT_CODE,
  // exported for tests
  agentTypeCode,
  toDateTime,
  toDayMonthYear,
};
