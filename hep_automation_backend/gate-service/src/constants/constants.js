/**
 * constants.js — gate-service
 *
 * Verification types are open-ended by design: adding a new device category
 * means adding a type here plus a handler in services/verificationTypes.js.
 * Nothing else in the pipeline needs to change.
 */

const VERIFICATION_TYPES = {
  QR: "QR",
  FACE: "FACE",
  VEHICLE: "VEHICLE",
  CONTAINER: "CONTAINER",
  CARGO: "CARGO",
};

const VERIFICATION_TYPE_LIST = Object.values(VERIFICATION_TYPES);

const VERIFICATION_STATUS = {
  PASSED: "PASSED",
  FAILED: "FAILED",
  PENDING: "PENDING",
};

const VERIFICATION_STATUS_LIST = Object.values(VERIFICATION_STATUS);

/** Subject categories a normalised event can carry. */
const SUBJECT_TYPES = {
  PERSON: "PERSON",
  VEHICLE: "VEHICLE",
  CONTAINER: "CONTAINER",
};

/** Socket.IO namespace and event names shared with the mobile client. */
const REALTIME = {
  NAMESPACE: "/gate-verification",
  EVENT_VERIFICATION: "verification:event",
  EVENT_ASSIGNED_GATES: "gates:assigned",
  EVENT_ERROR: "gate:error",
  ROOM_PREFIX: "gate:",
};

module.exports = {
  VERIFICATION_TYPES,
  VERIFICATION_TYPE_LIST,
  VERIFICATION_STATUS,
  VERIFICATION_STATUS_LIST,
  SUBJECT_TYPES,
  REALTIME,
};
