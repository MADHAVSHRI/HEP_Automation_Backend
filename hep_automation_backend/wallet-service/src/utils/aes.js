const crypto = require("crypto");

/**
 * SBI uses first 16 bytes of merchant key
 * as AES Key and IV.
 */

const getKeyAndIV = (merchantKey) => {

    const key = Buffer.from(merchantKey, "utf8").slice(0, 16);

    return {

        key,

        iv: key

    };

};

/**
 * Encrypt
 */

const encrypt = (plainText, merchantKey) => {

    const { key, iv } = getKeyAndIV(merchantKey);

    const cipher = crypto.createCipheriv(

        "aes-128-cbc",

        key,

        iv

    );

    let encrypted = cipher.update(

        plainText,

        "utf8",

        "base64"

    );

    encrypted += cipher.final("base64");

    return encrypted;

};

/**
 * Decrypt
 */

const decrypt = (cipherText, merchantKey) => {

    const { key, iv } = getKeyAndIV(merchantKey);

    const decipher = crypto.createDecipheriv(

        "aes-128-cbc",

        key,

        iv

    );

    let decrypted = decipher.update(

        cipherText,

        "base64",

        "utf8"

    );

    decrypted += decipher.final("utf8");

    return decrypted;

};

module.exports = {

    encrypt,

    decrypt

};