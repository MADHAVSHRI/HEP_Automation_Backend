const encryptionService = require("./encryptionService");

const config = require("../config/sbiepayConfig");

const constants = require("../constants/sbiEpayConstants");

/**
 * Build SBI Transaction Packet
 */

const createTransactionPacket = ({

    amount,

    orderNumber,

    customerId,

    payMode = constants.PAYMODE.NET_BANKING,

    otherDetails = constants.OTHER_DETAILS

}) => {

    const packet = [

        config.merchantId,

        config.operatingMode,

        config.country,

        config.currency,

        amount,

        otherDetails,

        config.successUrl,

        config.failureUrl,

        config.aggregatorId,

        orderNumber,

        customerId,

        payMode,

        constants.ACCESS_MEDIUM,

        constants.TRANSACTION_SOURCE

    ].join("|");

    return packet;

};

/**
 * Encrypt Transaction Packet
 */

const generateEncryptedRequest = (payload) => {

    const packet = createTransactionPacket(payload);

    const encrypted = encryptionService.encryptRequest(

        packet,

        config.merchantKey

    );

    return {

        packet,

        encrypted

    };

};

module.exports = {

    createTransactionPacket,

    generateEncryptedRequest

};