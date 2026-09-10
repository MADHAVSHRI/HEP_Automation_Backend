/**
 * dev-gateway.js — local development only
 *
 * In production nginx puts every service behind one origin at /api/*. Locally
 * each service listens on its own port, but the mobile app has a single
 * baseUrl — this proxy reproduces that single origin so the app can run
 * against the local stack unchanged.
 *
 *   node dev-gateway.js          # listens on 8080
 *
 * Routing mirrors the prefixes each service mounts under /api.
 */

const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");

const PORT = process.env.GATEWAY_PORT || 8080;

const AUTH = "http://localhost:5006";
const USER = "http://localhost:5001";
const ADMIN = "http://localhost:5005";
const QR = "http://localhost:5007";
const TOS = "http://localhost:5009";
const FACE = "http://localhost:5013";
const GATE = "http://localhost:5012";
const CUSTOMS = "http://localhost:5011";

const app = express();

// Express strips the mount path before a middleware runs, so the prefix is
// restored from originalUrl — the services expect the full /api/... path.
const to = (target, extra = {}) =>
  createProxyMiddleware({
    target,
    changeOrigin: true,
    xfwd: true,
    pathRewrite: (path, req) => req.originalUrl,
    ...extra,
  });

/* ── Socket.IO for the CISF gate console ──────────────────────────────────
   Proxied with ws:true so the app reaches the gate feed on the same origin
   as the REST API. The middleware is kept so its upgrade handler can be
   bound to the HTTP server below — without that the websocket never
   completes its handshake. */
const socketProxy = to(GATE, { ws: true });
app.use("/socket.io", socketProxy);

/* ── auth-service ─────────────────────────────────────────────────────── */
app.use("/api/auth", to(AUTH));
app.use("/api/admin", to(AUTH));

/* ── approval-admin-service ───────────────────────────────────────────────
   Only this one /pass-request endpoint belongs to approval-admin; it must be
   registered before the generic /api/pass-request rule below. */
app.use("/api/pass-request/agent-pass-request-action", to(ADMIN));
app.use("/api/user", to(ADMIN));
app.use("/api/blacklist", to(ADMIN));
app.use("/api/overstay", to(ADMIN));
app.use("/api/pass-fee-master", to(ADMIN));
app.use("/api/hep-rate", to(ADMIN));

/* ── user_service ─────────────────────────────────────────────────────── */
app.use("/api/captcha", to(USER));
app.use("/api/pass-request", to(USER));
app.use("/api/agents", to(USER));
app.use("/api/user-types", to(USER));
app.use("/api/ulip", to(USER));
app.use("/api/vendor-pass", to(USER));
app.use("/api/material-pass", to(USER));
app.use("/api/bulk-pass", to(USER));
app.use("/api/vvip-pass", to(USER));
app.use("/api/locks", to(USER));
app.use("/api/chatbot", to(USER));
app.use("/api/reports", to(USER));
app.use("/uploads", to(USER));

/* ── remaining services ───────────────────────────────────────────────── */
app.use("/api/qr", to(QR));
app.use("/api/tos", to(TOS));
app.use("/api/face", to(FACE));
app.use("/api/gate-verification", to(GATE));
app.use("/api/customs", to(CUSTOMS));

app.get("/health", (req, res) => res.json({ status: "ok", gateway: true }));

app.use((req, res) => {
  console.warn(`[gateway] no route for ${req.method} ${req.originalUrl}`);
  res.status(404).json({ success: false, message: "Route not found" });
});

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Dev gateway on http://localhost:${PORT}`);
  console.log("  /api/auth,/api/admin                      -> 5006 auth");
  console.log("  /api/captcha,/api/pass-request,/api/agents-> 5001 user");
  console.log("  /api/user,/api/blacklist                  -> 5005 approval-admin");
  console.log("  /api/qr 5007  /api/tos 5009  /api/face 5013  /api/customs 5011");
  console.log("  /api/gate-verification + /socket.io       -> 5012 gate");
});

// Required for the websocket upgrade to reach gate-service.
server.on("upgrade", socketProxy.upgrade);
