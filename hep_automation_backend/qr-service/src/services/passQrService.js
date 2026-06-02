const QRCode = require("qrcode");
const PDFDocument = require("pdfkit");
const axios = require("axios");
const fs = require("fs");
const puppeteer = require("puppeteer");
const path = require("path");
const jwt = require("jsonwebtoken");
const redisClient =require("../../config/redisClient");
const {
  getPdfPath,
  ensureDirectory,
  fileExists,
} = require("../utils/pdfStorage");
const LOGO_PATH       = path.join(__dirname, "../assets/PortTrustLogo.jpeg");
const FONT_REGULAR    = path.join(__dirname, "../assets/NotoSansDevanagari-Regular.ttf");
const FONT_BOLD       = path.join(__dirname, "../assets/NotoSansDevanagari-Bold.ttf");

const USER_SERVICE = process.env.USER_SERVICE_URL;

exports.generatePass = async (
  passRequestId,
  token,
  type = null,
  entityId = null
) => {

  let url = `${USER_SERVICE}/api/pass-request/qr-data/${passRequestId}`;

  // NEW LOGIC
  const queryParams = [];

  if (type) {
    queryParams.push(`type=${encodeURIComponent(type)}`);
  }

  if (entityId) {
    queryParams.push(`entityId=${encodeURIComponent(entityId)}`);
  }

  if (queryParams.length > 0) {
    url += `?${queryParams.join("&")}`;
  }

  const response = await axios.get(url, {
    headers: {
      Authorization: token,
      "x-service-name": "QR Service",
    },
  });

  const data = response.data;

  if (
    (!data.persons || data.persons.length === 0) &&
    (!data.vehicles || data.vehicles.length === 0)
  ) {
    throw new Error("No approved passes found");
  }

  // return await generatePDF(data);
  const pdfBuffer = await handlePdfStorage(
  data,
  type,
  entityId
);

return pdfBuffer;
};

// exports.generatePass = async (passRequestId, token) => {
//   const response = await axios.get(
//     `${USER_SERVICE}/api/pass-request/qr-data/${passRequestId}`,
//     {
//       headers: {
//         Authorization: token,
//         "x-service-name": "QR Service"
//       }
//     }
//   );
//   const data = response.data;
//   if ((!data.persons || data.persons.length === 0) &&
//     (!data.vehicles || data.vehicles.length === 0)) {
//     throw new Error("No approved passes found");
//   }
//   return await generatePDF(data);
// };

exports.generateVendorPass = async (vendorPassId) => {
  const response = await axios.get(
    `${USER_SERVICE}/api/pass-request/vendor-qr-data/${vendorPassId}`,
    {
      headers: {
        "x-service-name": "QR Service"
      }
    }
  );
  const data = response.data;
  
  // Filter only approved entities
  data.persons = (data.persons || []).filter(p => p.status === 'approved');
  data.vehicles = (data.vehicles || []).filter(v => v.status === 'approved');

  if (data.persons.length === 0 && data.vehicles.length === 0) {
    throw new Error("No approved vendor passes found");
  }
  return await generatePDF(data);
};

/**
 * Generate PDF for a single vendor pass entity (person or vehicle)
 * Reuses the same generatePDF template but filters to one entity
 */
exports.generateVendorSinglePass = async (vendorPassId, entityType, entityIndex) => {
  const response = await axios.get(
    `${USER_SERVICE}/api/pass-request/vendor-qr-data/${vendorPassId}`,
    {
      headers: {
        "x-service-name": "QR Service"
      }
    }
  );
  const data = response.data;

  // Filter only approved entities (since frontend maps over approved arrays)
  const approvedPersons = (data.persons || []).filter(p => p.status === 'approved');
  const approvedVehicles = (data.vehicles || []).filter(v => v.status === 'approved');

  // Filter to single entity
  let filteredData;
  if (entityType === "person") {
    const idx = parseInt(entityIndex, 10);
    if (!approvedPersons[idx]) {
      throw new Error("Person not found");
    }
    filteredData = { persons: [approvedPersons[idx]], vehicles: [], referenceNo: data.referenceNo };
  } else if (entityType === "vehicle") {
    const idx = parseInt(entityIndex, 10);
    if (!approvedVehicles[idx]) {
      throw new Error("Vehicle not found");
    }
    filteredData = { persons: [], vehicles: [approvedVehicles[idx]], referenceNo: data.referenceNo };
  } else {
    throw new Error("Invalid entity type. Use 'person' or 'vehicle'");
  }

  return await generatePDF(filteredData);
};

async function generateQR(data){
  return await QRCode.toDataURL(data);

}

function generateSecureQrToken({
  entityId,
  passRequestId,
  qrUuid,
  type,
}) {
  const secret = process.env.QR_SECRET;
  if (!secret) {
    throw new Error("Environment variable QR_SECRET is required to sign tokens");
  }

  return jwt.sign(
    {
      entityId,
      passRequestId,
      qrUuid,
      type,
    },
    secret,
    {
      expiresIn: "36500d",
      issuer: "hep-qr-service",
    }
  );
}

async function handlePdfStorage(
  data,
  type,
  entityId
) {
  let pass;

  if (type === "person") {
    pass = data.persons?.find(
      (p) => p.id === Number(entityId)
    );
  } else {
    pass = data.vehicles?.find(
      (v) => v.id === Number(entityId)
    );
  }

  if (!pass) {
    throw new Error("Pass not found");
  }

  const passNo =
    type === "person"
      ? pass.personPassNo
      : pass.vehiclePassNo;

  const { filePath, folderPath } =
    getPdfPath({
      passReferenceNo: pass.referenceNo,
      type,
      passNo,
    });

  // FAST PATH → file exists
  const exists = await fileExists(filePath);

  if (exists) {
    console.log(
      `Serving cached PDF: ${filePath}`
    );

    return fs.promises.readFile(filePath);
  }

  // GENERATE PATH
  console.log(
    `Generating PDF: ${filePath}`
  );

  await ensureDirectory(folderPath);

  const pdfBuffer = await generatePDF(data);

  await fs.promises.writeFile(
    filePath,
    pdfBuffer
  );

  await axios.post(
  `${USER_SERVICE}/api/pass-request/save-qr-pdf-path`,
  {
    type,
    entityId,
    qrPdfPath: filePath,
  }
);

  return pdfBuffer;
}

async function generatePDF(data) {
  const PAGE_W   = 595;
  const PAGE_H   = 230;  // ← reduced from 310, tight like reference
  const HEADER_H = 62;

  const doc = new PDFDocument({
    size: [PAGE_W, PAGE_H],
    margins: { top: 0, bottom: 0, left: 0, right: 0 }
  });

  doc.registerFont("Noto", FONT_REGULAR);

  const buffers = [];
  doc.on("data", buffers.push.bind(buffers));

  const persons  = data.persons  || [];
  const vehicles = data.vehicles || [];

  const drawHeader = () => {
    doc.rect(0, 0, PAGE_W, HEADER_H).fill("#E87722");

    const LOGO_SIZE = 48, LOGO_X = 10;
    const LOGO_Y = (HEADER_H - LOGO_SIZE) / 2;
    doc.save();
    doc.circle(LOGO_X + LOGO_SIZE / 2, LOGO_Y + LOGO_SIZE / 2, LOGO_SIZE / 2).clip();
    doc.image(LOGO_PATH, LOGO_X, LOGO_Y, { width: LOGO_SIZE, height: LOGO_SIZE });
    doc.restore();

    const TX = LOGO_X + LOGO_SIZE + 6;
    const TW = PAGE_W - TX - 10;
    doc.fillColor("white").font("Noto").fontSize(9)
      .text("चेन्नई पत्तन न्यास", TX, 10, { width: TW, align: "center" });
    doc.fillColor("white").font("Helvetica-Bold").fontSize(14)
      .text("CHENNAI PORT AUTHORITY", TX, 24, { width: TW, align: "center" });
    doc.fillColor("white").font("Helvetica").fontSize(9)
      .text("USER IDENTITY CARD", TX, 44, { width: TW, align: "center" });
  };

  // ── PERSON PAGES ──────────────────────────────────────────
  for (let i = 0; i < persons.length; i++) {
    const person = persons[i];
    // const qr = await generateQR(person.personPassNo || String(person.id));
    const secureQrToken = generateSecureQrToken({
      entityId: person.id,
      passRequestId: person.passRequestId,
      qrUuid: person.qrUuid,
      type: "person",
    });

    const qr = await generateQR(secureQrToken);

    drawHeader();

    const BODY_Y  = HEADER_H + 8;
    const PHOTO_X = 12;
    const PHOTO_W = 115;
    const PHOTO_H = PAGE_H - HEADER_H - 16; // ← tight to page height

    // Photo (left)
    // In generatePDF, replace the photo block with:
    if (person.photoBase64) {
      const photoBuffer = Buffer.from(person.photoBase64, "base64");
      doc.image(photoBuffer, PHOTO_X, BODY_Y, { width: PHOTO_W, height: PHOTO_H });
    } else {
      doc.rect(PHOTO_X, BODY_Y, PHOTO_W, PHOTO_H)
        .lineWidth(0.5).strokeColor("#aaaaaa").stroke();
      doc.fillColor("#aaaaaa").font("Helvetica").fontSize(9)
        .text("PHOTO", PHOTO_X, BODY_Y + PHOTO_H / 2 - 6,
              { width: PHOTO_W, align: "center" });
    }

    // Details (middle)
    const QR_W  = 85;
    const MID_X = PHOTO_X + PHOTO_W + 14;
    const MID_W = PAGE_W - MID_X - QR_W - 24;
    let y = BODY_Y;

    doc.fillColor("black").font("Helvetica-Bold").fontSize(16)
      .text(person.name || "-", MID_X, y, { width: MID_W });
    y += 20;

    const field = (label, value, bold = false) => {
      doc.font("Helvetica-Bold").fontSize(7).fillColor("#555555")
        .text(label, MID_X, y, { continued: true, width: MID_W });
      doc.font(bold ? "Helvetica-Bold" : "Helvetica")
        .fillColor("black").fontSize(8)
        .text(` ${value || "-"}`);
      y += 13;
    };

    field("Pass No.:",    person.personPassNo, true);
    field("COMPANY:",     person.company);
    field("TYPE OF HEP:", person.hepType || "Personal");
    field("CONTACT NO:",  person.mobile);
    field("AADHAR NO.:",  person.aadharNo);

    // Valid Till
    y += 2;
    doc.font("Helvetica-Bold").fontSize(7).fillColor("#555555")
      .text("VALID", MID_X,     y)
      .text("TILL",  MID_X,     y + 8)
      .text(":",     MID_X,     y + 16);

    const VX = MID_X + 28;
    doc.fillColor("black").font("Helvetica-Bold").fontSize(8.5)
      .text(`From:  ${person.validFrom || "-"}`, VX, y + 2);
    doc.font("Helvetica").fontSize(8.5)
      .text(`To:  ${person.validTo || "-"}`, VX + 8, y + 14);

    // QR + Authorized (right)
    const QR_X = PAGE_W - QR_W - 14;
    const QR_Y = BODY_Y + 2;

    doc.image(qr, QR_X, QR_Y, { fit: [QR_W, QR_W] });
    doc.fillColor("black").font("Helvetica").fontSize(7)
      .text("AUTHORIZED BY",   QR_X - 4, QR_Y + QR_W + 5,  { width: QR_W + 8, align: "center" })
      .text("TRAFFIC MANAGER", QR_X - 4, QR_Y + QR_W + 15, { width: QR_W + 8, align: "center" });

    // Bottom divider
    doc.moveTo(12, PAGE_H - 6).lineTo(PAGE_W - 12, PAGE_H - 6)
      .strokeColor("#dddddd").lineWidth(0.5).stroke();

    if (i < persons.length - 1) doc.addPage();
  }

  // ── VEHICLE PAGES ──────────────────────────────────────────
  for (let i = 0; i < vehicles.length; i++) {
    const vehicle = vehicles[i];
    // const qr = await generateQR(vehicle.vehiclePassNo || String(vehicle.id));
    const secureQrToken = generateSecureQrToken({
      entityId: vehicle.id,
      passRequestId: vehicle.passRequestId,
      qrUuid: vehicle.qrUuid,
      type: "vehicle",
    });

    const qr = await generateQR(secureQrToken);

    if (persons.length > 0 || i > 0) doc.addPage();

    drawHeader();

    const BODY_Y = HEADER_H + 10;
    const QR_W   = 85;
    const QR_X   = PAGE_W - QR_W - 14;
    const MID_W  = PAGE_W - 30 - QR_W - 20;
    let y = BODY_Y;

    doc.fillColor("black").font("Helvetica-Bold").fontSize(15)
      .text(vehicle.registrationNo || "-", 16, y, { width: MID_W });
    y += 20;

    const vfield = (label, value, bold = false) => {
      doc.font("Helvetica-Bold").fontSize(7).fillColor("#555555")
        .text(label, 16, y, { continued: true });
      doc.font(bold ? "Helvetica-Bold" : "Helvetica")
        .fillColor("black").fontSize(8)
        .text(` ${value || "-"}`);
      y += 13;
    };

    vfield("Pass No.:",     vehicle.vehiclePassNo, true);
    vfield("VEHICLE TYPE:", vehicle.vehicleType);
    vfield("VALID FROM:",   vehicle.validFrom);
    vfield("VALID TO:",     vehicle.validTo);

    doc.image(qr, QR_X, BODY_Y, { fit: [QR_W, QR_W] });
    doc.fillColor("black").font("Helvetica").fontSize(7)
      .text("AUTHORIZED BY",   QR_X - 4, BODY_Y + QR_W + 5,  { width: QR_W + 8, align: "center" })
      .text("TRAFFIC MANAGER", QR_X - 4, BODY_Y + QR_W + 15, { width: QR_W + 8, align: "center" });

    doc.moveTo(12, PAGE_H - 6).lineTo(PAGE_W - 12, PAGE_H - 6)
      .strokeColor("#dddddd").lineWidth(0.5).stroke();
  }

  doc.end();

  return new Promise(resolve => {
    doc.on("end", () => resolve(Buffer.concat(buffers)));
  });
}

// exports.validateQr = async (
//   qrToken
// ) => {

//   const secret =
//     process.env.QR_SECRET;

//   if (!secret) {
//     throw new Error(
//       "Environment variable QR_SECRET is required"
//     );
//   }

//   const payload = jwt.verify(
//     qrToken,
//     secret,
//     {
//       issuer: "hep-qr-service",
//     }
//   );

//   // TYPE GUARD
//   if (
//     typeof payload === "string"
//   ) {
//     throw new Error(
//       "Invalid QR payload"
//     );
//   }

//   const response =
//     await axios.post(
//       `${USER_SERVICE}/api/pass-request/validate-qr`,
//       {
//         entityId:
//           payload.entityId,

//         passRequestId:
//           payload.passRequestId,

//         qrUuid:
//           payload.qrUuid,

//         type:
//           payload.type,
//       },
//       {
//         headers: {
//           "x-service-name":
//             "QR Service",
//         },
//       }
//     );

//   return response.data;
// };


exports.validateQr = async (
  qrToken
) => {

  const secret =
    process.env.QR_SECRET;

  if (!secret) {
    throw new Error(
      "Environment variable QR_SECRET is required"
    );
  }

  const payload = jwt.verify(
    qrToken,
    secret,
    {
      issuer: "hep-qr-service",
    }
  );

  // TYPE GUARD
  if (
    typeof payload === "string"
  ) {
    throw new Error(
      "Invalid QR payload"
    );
  }

  /*
  ============================================
  REDIS CACHE CHECK (NEW)
  ============================================
  */

  const cacheKey =
    `qr-validation:${payload.qrUuid}`;

  const cachedData =
    await redisClient.get(
      cacheKey
    );

  if (cachedData) {
    console.log(
      "QR validation cache hit"
    );

    return JSON.parse(
      cachedData
    );
  }

  /*
  ============================================
  EXISTING LOGIC (UNCHANGED)
  ============================================
  */

  const response =
    await axios.post(
      `${USER_SERVICE}/api/pass-request/validate-qr`,
      {
        entityId:
          payload.entityId,

        passRequestId:
          payload.passRequestId,

        qrUuid:
          payload.qrUuid,

        type:
          payload.type,
      },
      {
        headers: {
          "x-service-name":
            "QR Service",
        },
      }
    );

  /*
  ============================================
  STORE CACHE (NEW)
  ============================================
  */

  if (
    response.data?.valid &&
    response.data?.dateTo
  ) {

    const expiryDate =
      new Date(
        response.data.dateTo
      );

    const ttlSeconds =
      Math.max(
        1,
        Math.floor(
          (
            expiryDate.getTime() -
            Date.now()
          ) / 1000
        )
      );

    await redisClient.set(
      cacheKey,
      JSON.stringify(
        response.data
      ),
      {
        EX: ttlSeconds,
      }
    );

    console.log(
      `QR validation cached (${ttlSeconds}s)`
    );
  }

  return response.data;
};
















