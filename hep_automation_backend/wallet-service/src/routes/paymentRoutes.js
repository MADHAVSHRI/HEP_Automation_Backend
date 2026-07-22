const express = require("express");

const router = express.Router();

const paymentController = require("../controllers/paymentController");

router.post(
    "/payment/initiate",
    paymentController.initiatePayment
);

router.get(
    "/payment/test",
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