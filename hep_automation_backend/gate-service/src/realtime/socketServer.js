/**
 * socketServer.js — gate-service
 *
 * Socket.IO server for the CISF console.
 *
 * Security model: the client presents the access token it already holds from
 * auth-service — no second login. The server verifies that token, reads the
 * officer's identity from it, then looks the assigned gates up in the
 * database and joins those rooms itself. The client never names a gate, so
 * editing a gateId in the app grants nothing.
 */

const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

const { REALTIME } = require("../constants/constants");
const gateAccessService = require("../services/gateAccessService");
const emitter = require("./emitter");
const { successLogger, errorLogger } = require("../logger/logger");

const CISF_ROLE = "CISF";

/** Pulls the token from either the auth payload or the Authorization header. */
const readToken = (socket) => {
  const fromAuth = socket.handshake.auth && socket.handshake.auth.token;
  if (fromAuth) {
    return String(fromAuth).replace(/^Bearer\s+/i, "");
  }

  const header = socket.handshake.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    return header.slice(7);
  }

  return null;
};

const attachSocketServer = (httpServer, corsOrigins) => {
  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  const namespace = io.of(REALTIME.NAMESPACE);

  /* ── Handshake: authenticate, then resolve gates server-side ───────── */
  namespace.use(async (socket, next) => {
    try {
      const token = readToken(socket);
      if (!token) {
        return next(new Error("UNAUTHORIZED: token missing"));
      }

      const secret = process.env.JWT_SECRET;
      if (!secret) {
        errorLogger.error({
          context: "SOCKET_AUTH",
          message: "JWT_SECRET is not set",
        });
        return next(new Error("SERVER_MISCONFIGURED"));
      }

      let decoded;
      try {
        decoded = jwt.verify(token, secret);
      } catch (error) {
        return next(new Error("UNAUTHORIZED: invalid or expired token"));
      }

      // Role and department come from the signed token, never the client body
      // — the same rule auth-service applies when it refuses to return the
      // role in the login response.
      const role = (decoded.role || "").toUpperCase();
      const department = (decoded.departmentName || "").toUpperCase();
      if (role !== CISF_ROLE && department !== CISF_ROLE) {
        return next(new Error("FORBIDDEN: not a CISF officer"));
      }

      const gates = await gateAccessService.getAssignedGates(decoded.userId);
      if (!gates.length) {
        return next(new Error("FORBIDDEN: no gates assigned to this officer"));
      }

      socket.data.userId = decoded.userId;
      socket.data.sessionId = decoded.sessionId;
      socket.data.gates = gates;
      return next();
    } catch (error) {
      errorLogger.error({
        context: "SOCKET_AUTH",
        message: error.message,
      });
      return next(new Error("UNAUTHORIZED"));
    }
  });

  /* ── Connection: join the officer's own gate rooms ─────────────────── */
  namespace.on("connection", (socket) => {
    const { userId, gates } = socket.data;

    gates.forEach((gate) => socket.join(emitter.roomFor(gate.gateCode)));

    successLogger.info({
      context: "SOCKET_CONNECT",
      userId,
      socketId: socket.id,
      gates: gates.map((gate) => gate.gateCode),
    });

    // Tells the console which gates it is watching, so the UI can label the
    // gate bar from the server rather than hardcoding it.
    socket.emit(REALTIME.EVENT_ASSIGNED_GATES, { gates });

    // A client asking to join a gate is answered from the assignment table,
    // not from what it asked for.
    socket.on("gates:refresh", async () => {
      try {
        const current = await gateAccessService.getAssignedGates(userId);

        gates.forEach((gate) => socket.leave(emitter.roomFor(gate.gateCode)));
        current.forEach((gate) => socket.join(emitter.roomFor(gate.gateCode)));
        socket.data.gates = current;

        socket.emit(REALTIME.EVENT_ASSIGNED_GATES, { gates: current });
      } catch (error) {
        errorLogger.error({
          context: "SOCKET_REFRESH",
          userId,
          message: error.message,
        });
        socket.emit(REALTIME.EVENT_ERROR, {
          message: "Could not refresh assigned gates",
        });
      }
    });

    socket.on("disconnect", (reason) => {
      successLogger.info({
        context: "SOCKET_DISCONNECT",
        userId,
        socketId: socket.id,
        reason,
      });
    });
  });

  emitter.register(namespace);
  return io;
};

module.exports = { attachSocketServer };
