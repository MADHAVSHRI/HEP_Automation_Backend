const sbiService = require("../services/sbiEpayService");
const config = require("../config/sbiepayConfig");
const generateOrderNumber = require("../utils/orderNumber");
const encryptionService = require("../services/encryptionService");

const initiatePayment = (req, res) => {

    try {

        const orderNumber = generateOrderNumber();
        const {

            amount = "100.00",

            customerId = "CUSTOMER01"

        } = req.body || {};

        // const customerId = "CUSTOMER01";

        // const amount = "100.00";

        const response = sbiService.generateEncryptedRequest({
            amount,
            orderNumber,
            customerId
        });

        console.log("========== SBI REQUEST ==========");
        console.log("Order No :", orderNumber);
        console.log("Packet   :", response.packet);
        console.log("Success URL:", config.successUrl);
        console.log("Failure URL:", config.failureUrl);
        console.log("Push URL:", config.pushUrl);
        console.log("Payment URL:", config.paymentUrl);
        console.log("Merchant:", config.merchantId);
        console.log("Aggregator:", config.aggregatorId);
        console.log("Encrypted:", response.encrypted);
        console.log("=================================");

        const html = `
        <!DOCTYPE html>
        <html>

        <head>

            <title>Redirecting to SBI ePay...</title>

        </head>

        <body>

            <h3>Please wait...</h3>

            <p>Redirecting to SBI ePay Secure Payment Gateway</p>

            <form
                id="sbiForm"
                method="POST"
                action="${config.paymentUrl}"
            >

                <input
                    type="hidden"
                    name="EncryptTrans"
                    value="${response.encrypted}"
                />

                <input
                    type="hidden"
                    name="merchIdVal"
                    value="${config.merchantId}"
                />

                <input
                    type="hidden"
                    name="aggIdVal"
                    value="${config.aggregatorId}"
                />

            </form>

            <script>

                window.onload = function () {
                    document.getElementById("sbiForm").submit();
                };

            </script>

        </body>

        </html>
        `;

        res.send(html);

    }

    catch(err){

        console.log(err);

        res.status(500).json({

            success:false,

            error:err.message

        });

    }

};

const success = (req, res) => {

    console.log("\n================ SUCCESS CALLBACK ================\n");

    console.log(req.body);

    const encryptedData =
        req.body.encData ||
        req.body.DecryptTrans ||
        req.body.EncryptTrans;

    if (encryptedData) {

        try {

            const decrypted =
                encryptionService.decryptResponse(
                    encryptedData,
                    config.merchantKey
                );

            console.log("\n========== DECRYPTED RESPONSE ==========");
            console.log(decrypted);
            console.log("========================================");

        }

        catch(err){

            console.log(err);

        }

    }

    res.send("SUCCESS");

};

const failure = (req, res) => {

    console.log("\n================ FAILURE CALLBACK ================\n");

    console.log("BODY");
    console.log(req.body);

    console.log("\nBODY KEYS");
    console.log(Object.keys(req.body));

    const encryptedData =
        req.body.encData ||
        req.body.DecryptTrans ||
        req.body.EncryptTrans;

    console.log("\nEncrypted Data:");
    console.log(encryptedData);

    if (!encryptedData) {

        console.log("\nNo encrypted data received from SBI.");

        return res.send("FAILED");

    }

    try {

        const decrypted =
            encryptionService.decryptResponse(
                encryptedData,
                config.merchantKey
            );

        console.log("\n========== DECRYPTED RESPONSE ==========");
        console.log(decrypted);
        console.log("========================================");

    }

    catch(err){

        console.log("\n========== DECRYPT ERROR ==========");
        console.log(err);
        console.log("===================================");

    }

    res.send("FAILED");

};

const push = (req, res) => {

    try {

        console.log("PUSH CALLBACK");

        console.log(req.body);

        if (req.body.DecryptTrans) {

            const decrypted = encryptionService.decryptResponse(
                req.body.DecryptTrans,
                config.merchantKey
            );

            console.log("Decrypted Response");

            console.log(decrypted);
        }

        res.send("OK");

    } catch (err) {

        console.log(err);

        res.status(500).send(err.message);

    }

};

module.exports = {

    initiatePayment,

    success,

    failure,

    push

};




















// const encryptionService = require("../services/encryptionService");
// const sbiService = require("../services/sbiEpayService");

// // const testEncryption = (req, res) => {

// //     try {

// //         const merchantKey = process.env.SBI_MERCHANT_KEY;

// //         const plainText = "HELLO SBI";

// //         const encrypted = encryptionService.encryptRequest(
// //             plainText,
// //             merchantKey
// //         );

// //         const decrypted = encryptionService.decryptResponse(
// //             encrypted,
// //             merchantKey
// //         );

// //         return res.status(200).json({

// //             success: true,

// //             original: plainText,

// //             encrypted,

// //             decrypted

// //         });

// //     } catch (err) {

// //         console.log(err);

// //         return res.status(500).json({

// //             success: false,

// //             message: err.message

// //         });

// //     }

// // };

// const testEncryption = (req, res) => {

//     try {

//         const response = sbiService.generateEncryptedRequest({

//             amount: 100,

//             orderNumber: "ORDER1001",

//             customerId: "CUSTOMER01"

//         });

//         return res.json({

//             success: true,

//             packet: response.packet,

//             encrypted: response.encrypted

//         });

//     }

//     catch(err){

//         console.log(err);

//         res.status(500).json({

//             success:false,

//             error:err.message

//         });

//     }

// };

// module.exports = {

//     testEncryption

// };