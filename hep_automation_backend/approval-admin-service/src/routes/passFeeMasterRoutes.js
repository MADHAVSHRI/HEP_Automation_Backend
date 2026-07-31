// routes/passFeeMasterRoutes.js
const express = require('express');
const router = express.Router();
const { getActiveFees } = require('../controllers/passFeeMasterController');

router.get("/", getActiveFees);

module.exports = router;