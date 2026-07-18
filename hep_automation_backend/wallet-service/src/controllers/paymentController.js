const sbiService = require("../services/sbiEpayService");
const config = require("../config/sbiepayConfig");

const initiatePayment = (req, res) => {

    try {

        const response = sbiService.generateEncryptedRequest({

            amount: 100,

            orderNumber: "ORDER1001",

            customerId: "CUSTOMER01"

        });

        const html = `
        <!DOCTYPE html>
        <html>

        <head>

            <title>Redirecting to SBI ePay...</title>

        </head>

        <body>

            <h3>Redirecting to SBI ePay...</h3>

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

            </form>

            <script>

                document.getElementById("sbiForm").submit();

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

    console.log("SUCCESS CALLBACK");

    console.log(req.body);

    res.send("SUCCESS CALLBACK RECEIVED");

};

const failure = (req, res) => {

    console.log("FAILURE CALLBACK");

    console.log(req.body);

    res.send("FAILURE CALLBACK RECEIVED");

};

const push = (req, res) => {

    console.log("PUSH CALLBACK");

    console.log(req.body);

    res.send("OK");

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