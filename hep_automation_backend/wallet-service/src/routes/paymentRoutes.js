const express = require("express");

const router = express.Router();

const paymentController = require("../controllers/paymentController");

router.get(
    "/payment/initiate",
    paymentController.initiatePayment
);

router.post(
    "/payment/success",
    paymentController.success
);

router.post(
    "/payment/failure",
    paymentController.failure
);

router.post(
    "/payment/push",
    paymentController.push
);

module.exports = router;