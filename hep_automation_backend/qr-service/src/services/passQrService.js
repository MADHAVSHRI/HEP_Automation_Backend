const QRCode = require("qrcode");
const PDFDocument = require("pdfkit");
const axios = require("axios");

const USER_SERVICE = process.env.USER_SERVICE_URL;
exports.generatePass = async (passRequestId, token) => {
  const response = await axios.get(
    `${USER_SERVICE}/api/pass-request/qr-data/${passRequestId}`,
    {
      headers: {
        Authorization: token
    }
    }
    );
  const data = response.data;
  if(!data.persons.length && !data.vehicles.length){
   throw new Error("No approved passes found");
    }
  return await generatePDF(data);

};

async function generateQR(data){
  return await QRCode.toDataURL(data);

}
async function generatePDF(data){

  const doc = new PDFDocument({size:"A4"});

  const buffers = [];

  doc.on("data",buffers.push.bind(buffers));

  for(const person of data.persons){

    const qr = await generateQR(person.personPassNo);

    doc.fontSize(18).text("CHENNAI PORT AUTHORITY");

    doc.moveDown();

    doc.text(`NAME: ${person.name}`);
    doc.text(`PASS NO: ${person.personPassNo}`);
    doc.text(`AADHAR: ${person.aadharNo}`);

    doc.image(qr,{ fit:[120,120] });

    doc.addPage();

  }

  for(const vehicle of data.vehicles){

  const qr = await generateQR(vehicle.vehiclePassNo);

  doc.fontSize(18).text("CHENNAI PORT AUTHORITY");

  doc.text(`VEHICLE NO: ${vehicle.registrationNo}`);
  doc.text(`PASS NO: ${vehicle.vehiclePassNo}`);

  doc.image(qr,{fit:[120,120]});

  doc.addPage();

}

  doc.end();

  return await new Promise(resolve=>{

    doc.on("end",()=>{

      resolve(Buffer.concat(buffers));

    });

  });

}