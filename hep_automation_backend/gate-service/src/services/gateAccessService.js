/**
 * gateAccessService.js — gate-service
 *
 * The single authority on which gates an officer may see. Everything else
 * (REST routes, socket rooms) asks this module; nothing trusts a gate id that
 * arrived from a client.
 */

const { Gate, GateOfficerAssignment } = require("../../models");

/**
 * Gates the given user (users.id from the signed JWT) is posted to.
 * Returns [] when the officer has no active posting.
 */
const getAssignedGates = async (userId) => {
  const assignments = await GateOfficerAssignment.findAll({
    where: { userId, isActive: true },
    include: [
      {
        model: Gate,
        as: "gate",
        where: { isActive: true },
        required: true,
      },
    ],
  });

  return assignments.map((assignment) => ({
    id: assignment.gate.id,
    gateCode: assignment.gate.gateCode,
    gateName: assignment.gate.gateName,
    laneName: assignment.gate.laneName,
    location: assignment.gate.location,
  }));
};

/**
 * True when the officer is posted to the given gate code.
 *
 * Used both by the REST layer and before a socket joins a gate room, so a
 * client that edits a gateId gains nothing.
 */
const canAccessGate = async (userId, gateCode) => {
  const gates = await getAssignedGates(userId);
  return gates.some((gate) => gate.gateCode === gateCode);
};

/** Resolves a gate code to its row; null when unknown or inactive. */
const findGateByCode = async (gateCode) => {
  return Gate.findOne({ where: { gateCode, isActive: true } });
};

module.exports = {
  getAssignedGates,
  canAccessGate,
  findGateByCode,
};
