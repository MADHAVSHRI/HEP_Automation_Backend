module.exports = {
    merchantId: process.env.SBI_MERCHANT_ID,
    merchantKey: process.env.SBI_MERCHANT_KEY,

    aggregatorId: process.env.SBI_AGGREGATOR_ID,

    paymentUrl: process.env.SBI_PAYMENT_URL,

    statusUrl: process.env.SBI_STATUS_URL,

    refundUrl: process.env.SBI_REFUND_URL,

    successUrl: process.env.SBI_SUCCESS_URL,

    failureUrl: process.env.SBI_FAILURE_URL,

    pushUrl: process.env.SBI_PUSH_URL,

    operatingMode: process.env.SBI_OPERATING_MODE,

    country: process.env.SBI_COUNTRY,

    currency: process.env.SBI_CURRENCY
};