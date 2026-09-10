const { PORT_CODE } = require("./portEntryPermitPayload");

/* "2026-05-05 16:42:30" — the same timestamp format the permit push uses. */
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

/* iPortman expects the literal "Y" or "N", not a boolean. */
const toYesNo = (value) => {
  if (value === true) return "Y";
  if (value === false) return "N";
  const v = String(value ?? "").trim().toUpperCase();
  if (["Y", "YES", "TRUE", "1"].includes(v)) return "Y";
  if (["N", "NO", "FALSE", "0"].includes(v)) return "N";
  return "";
};

/* "Empty" / "Loaded", as in the agreed payloads. */
const toTruckStatus = (value) => {
  const v = String(value ?? "").trim();
  if (!v) return "";
  return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
};

const REQUIRED = [
  "VehicleRegdNo",
  "VehiclePassReferenceNo",
  "VehiclePassValidTo",
  "TruckStatus",
  "IsContainer",
  "GateNo",
];

/**
 * Shapes and checks one gate movement.
 *
 * @param {object} input   Caller's fields, in the same names as the document.
 * @param {"IN"|"OUT"} direction
 * @returns {{payload: object|null, missing: string[]}}
 *          `missing` lists any required field the caller left blank; when it is
 *          non-empty `payload` is null and nothing should be sent.
 */
const buildTruckGatePayload = (input = {}, direction) => {
  const isIn = direction === "IN";

  const movementAt = isIn ? input.GateInDT : input.GateOutDT;

  const body = {
    // The example gate-in document leaves Portcode blank, but every other
    // iPortman document carries it; default to ours and let a caller override.
    Portcode: input.Portcode || PORT_CODE,
    VehicleRegdNo: String(input.VehicleRegdNo || "").trim(),
    VehiclePassReferenceNo: String(input.VehiclePassReferenceNo || "").trim(),
    VehiclePassValidTo: toDateTime(input.VehiclePassValidTo),
    TruckStatus: toTruckStatus(input.TruckStatus),
    IsContainer: toYesNo(input.IsContainer),
    GateNo: String(input.GateNo || "").trim(),
    [isIn ? "GateInDT" : "GateOutDT"]: toDateTime(movementAt || new Date()),
  };

  const missing = REQUIRED.filter((field) => !body[field]);

  if (missing.length > 0) return { payload: null, missing };

  return {
    payload: { [isIn ? "TruckGateIn" : "TruckGateOut"]: body },
    missing: [],
  };
};

module.exports = {
  buildTruckGatePayload,
  // exported for tests
  toDateTime,
  toYesNo,
  toTruckStatus,
};
