/**
 * emitter.js — gate-service
 *
 * Holds the Socket.IO namespace so the service layer can publish without
 * importing the HTTP server (and without a circular require).
 */

const { REALTIME } = require("../constants/constants");

let namespace = null;

const register = (io) => {
  namespace = io;
};

const roomFor = (gateCode) => `${REALTIME.ROOM_PREFIX}${gateCode}`;

/**
 * Publishes a normalised event to every officer currently posted to the gate.
 * Returns how many sockets were in the room, which the caller logs so an
 * event delivered to nobody is visible rather than silent.
 */
const emitToGate = (gateCode, payload) => {
  if (!namespace) return 0;

  const room = roomFor(gateCode);
  namespace.to(room).emit(REALTIME.EVENT_VERIFICATION, payload);

  const sockets = namespace.adapter.rooms.get(room);
  return sockets ? sockets.size : 0;
};

module.exports = {
  register,
  emitToGate,
  roomFor,
};
