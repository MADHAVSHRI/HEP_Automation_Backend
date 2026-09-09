/**
 * verificationTypes.js — gate-service
 *
 * Registry mapping a verification type to the lookup that resolves its
 * identifier into displayable detail.
 *
 * To support a new device category (e.g. WEIGHBRIDGE, RFID_SEAL): add the type
 * to constants.js and add one handler here. The controller, the event
 * pipeline, the socket layer and the mobile client need no changes — the
 * client renders whatever `subject` it is given.
 */

const { VERIFICATION_TYPES } = require("../constants/constants");
const enrichment = require("./enrichmentService");

const handlers = {
  [VERIFICATION_TYPES.QR]: {
    // A QR pass encodes the person's card number.
    resolve: (identifier) => enrichment.findPerson(identifier),
    notFoundReason: "PASS NOT FOUND FOR SCANNED QR",
  },

  [VERIFICATION_TYPES.FACE]: {
    resolve: (identifier) => enrichment.findPerson(identifier),
    notFoundReason: "NO REGISTERED PERSON FOR THIS FACE ID",
  },

  [VERIFICATION_TYPES.VEHICLE]: {
    resolve: (identifier) => enrichment.findVehicle(identifier),
    notFoundReason: "VEHICLE NOT REGISTERED",
  },

  [VERIFICATION_TYPES.CONTAINER]: {
    resolve: (identifier) => enrichment.findContainer(identifier),
    notFoundReason: "CONTAINER NOT FOUND IN EIR RECORDS",
  },

  [VERIFICATION_TYPES.CARGO]: {
    // Cargo events are raised against the container carrying the cargo.
    resolve: (identifier) => enrichment.findContainer(identifier),
    notFoundReason: "CARGO DOCUMENTATION NOT FOUND",
  },
};

const isSupported = (verificationType) =>
  Object.prototype.hasOwnProperty.call(handlers, verificationType);

const getHandler = (verificationType) => handlers[verificationType] || null;

module.exports = {
  isSupported,
  getHandler,
};
