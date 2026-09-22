const express = require("express");
const router = express.Router();
const tosController = require("../controllers/tosController");
const tosAuth = require("../middlewares/tosAuth");
const apiKeyAuth = require("../middlewares/apiKeyAuth");

/**
 * Allows a route to be accessed via either:
 *   • a JWT bearer token  (Authorization: Bearer <token>)
 *   • a static API key    (x-api-key: <key>)
 *
 * Strategy:
 *   1. If the request has an  x-api-key  header → use apiKeyAuth only.
 *   2. Otherwise → use tosAuth (JWT) only.
 *
 * This keeps the logic simple and the error messages precise.
 */
function authEither(req, res, next) {
  if (req.headers["x-api-key"]) {
    return apiKeyAuth(req, res, next);
  }
  return tosAuth(req, res, next);
}

router.post("/login", tosController.login);

// Push routes: accept either a valid JWT bearer token OR a static API key
router.post("/form13/push", authEither, tosController.pushForm13);
router.post("/eir/push", authEither, tosController.pushEir);

module.exports = router;
