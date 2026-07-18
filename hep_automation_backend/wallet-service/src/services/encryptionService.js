const aes = require("../utils/aes");

const encryptRequest = (plainText, merchantKey) => {

    return aes.encrypt(

        plainText,

        merchantKey

    );

};

const decryptResponse = (

    encrypted,

    merchantKey

) => {

    return aes.decrypt(

        encrypted,

        merchantKey

    );

};

module.exports = {

    encryptRequest,

    decryptResponse

};