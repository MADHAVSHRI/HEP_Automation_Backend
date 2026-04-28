const QRCode = require("qrcode");
const PDFDocument = require("pdfkit");
const axios = require("axios");
const puppeteer = require("puppeteer");
const path = require("path");
const LOGO_PATH       = path.join(__dirname, "../assets/PortTrustLogo.jpeg");
const FONT_REGULAR    = path.join(__dirname, "../assets/NotoSansDevanagari-Regular.ttf");
const FONT_BOLD       = path.join(__dirname, "../assets/NotoSansDevanagari-Bold.ttf");

const USER_SERVICE = process.env.USER_SERVICE_URL;
exports.generatePass = async (passRequestId, token) => {
  const response = await axios.get(
    `${USER_SERVICE}/api/pass-request/qr-data/${passRequestId}`,
    {
      headers: {
        Authorization: token,
        "x-service-name": "QR Service"
    }
    }
    );
  const data = response.data;
  if ((!data.persons || data.persons.length === 0) &&
    (!data.vehicles || data.vehicles.length === 0)) {
    throw new Error("No approved passes found");
}
  return await generatePDF(data);

};

async function generateQR(data){
  return await QRCode.toDataURL(data);

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
    const qr = await generateQR(person.personPassNo || String(person.id));

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
    const qr = await generateQR(vehicle.vehiclePassNo || String(vehicle.id));

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



















