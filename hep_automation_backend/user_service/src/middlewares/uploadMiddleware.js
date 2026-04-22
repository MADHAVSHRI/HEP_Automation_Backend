const multer = require("multer");
const path = require("path");
const fs = require("fs");

/* ===== CHANGE =====
Predefine directories to avoid repeated path.join calls during upload
*/
const baseDir = "uploads/agent_docs";
const passRequestBaseDir = "uploads/passRequestDocs";



const PAN_DIR = path.join(baseDir, "pan");
const GST_DIR = path.join(baseDir, "gst");
const TAN_DIR = path.join(baseDir, "tan");
const ENTITY_DIR = path.join(baseDir, "entity");

const AUTH_DIR = path.join(passRequestBaseDir, "authLetters");
const PHOTO_DIR = path.join(passRequestBaseDir, "personPhotos");
const AADHAR_DIR = path.join(passRequestBaseDir, "personAadhar");
const IDPROOF_DIR = path.join(passRequestBaseDir, "personIdProof");
const REQLETTER_DIR = path.join(passRequestBaseDir, "requisitionLetter");
const RC_DIR = path.join(passRequestBaseDir, "vehicleRC");

const DL_DIR = path.join(passRequestBaseDir,"driverLicense");
const POLICE_DIR = path.join(passRequestBaseDir,"policeVerification");
const EMPLOY_DIR = path.join(passRequestBaseDir,"employmentProof");
const CHA_DIR = path.join(passRequestBaseDir,"chaLicenseCopy");
const PASSPORT_DIR = path.join(passRequestBaseDir,"passport");

const INSURANCE_DIR = path.join(passRequestBaseDir,"vehicleInsurance");
const PERMIT_DIR = path.join(passRequestBaseDir,"vehiclePermit");
const FITNESS_DIR = path.join(passRequestBaseDir,"vehicleFitness");
const TAX_DIR = path.join(passRequestBaseDir,"vehicleTax");
const EMISSION_DIR = path.join(passRequestBaseDir,"vehicleEmission");

/* ===== ORIGINAL LOGIC (unchanged) ===== */

const folders = ["pan", "gst", "tan", "entity"];
const passRequestFolders = [
  "authLetters",
  "personPhotos",
  "personAadhar",
  "personIdProof",
  "requisitionLetter",
  "vehicleRC",
  "driverLicense",
  "policeVerification",
  "employmentProof",
  "chaLicenseCopy",
  "passport",
  "vehicleInsurance",
  "vehiclePermit",
  "vehicleFitness",
  "vehicleRequestLetter",
  "vehicleTax",
  "vehicleEmission"
];

folders.forEach((folder) => {
  const dir = path.join(baseDir, folder);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

passRequestFolders.forEach((folder) => {
  const dir = path.join(passRequestBaseDir, folder);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

/* ===== ORIGINAL LOGIC ===== */

const generateTimestamp = () => {
  const now = new Date();

  const DD = String(now.getDate()).padStart(2, "0");
  const MM = String(now.getMonth() + 1).padStart(2, "0");
  const HH = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");

  return `${DD}${MM}${HH}${mm}`;
};

const sanitizeName = (name) => {
  return name.replace(/\s+/g, "").replace(/[^a-zA-Z0-9]/g, "");
};

/* ===== STORAGE CONFIG ===== */

const storage = multer.diskStorage({

  /* ===== CHANGE =====
     Switch statement is faster than multiple if-else checks
  */
  destination: function (req, file, cb) {

    switch (file.fieldname) {

      case "panDoc":
        cb(null, PAN_DIR);
        break;

      case "gstinDoc":
        cb(null, GST_DIR);
        break;

      case "tanDoc":
        cb(null, TAN_DIR);
        break;

      case "entityFile":
        cb(null, ENTITY_DIR);
        break;

      case "authLetter":
        cb(null, AUTH_DIR);
        break;

      case "personPhoto":
        cb(null, PHOTO_DIR);
        break;

      case "personAadhar":
        cb(null, AADHAR_DIR);
        break;

      case "personIdProof":
        cb(null, IDPROOF_DIR);
        break;

      case "requisitionLetter":
        cb(null, REQLETTER_DIR);
        break;

      case "vehicleRC":
        cb(null, RC_DIR);
        break;
      
      case "driverLicense":
        cb(null, DL_DIR);
        break;

      case "policeVerification":
        cb(null, POLICE_DIR);
        break;

      case "employmentProof":
        cb(null, EMPLOY_DIR);
        break;

      case "chaLicenseCopy":
        cb(null, CHA_DIR);
        break;

      case "passportDoc":
        cb(null, PASSPORT_DIR);
        break;

      case "vehicleInsurance":
        cb(null, INSURANCE_DIR);
        break;

      case "vehiclePermit":
        cb(null, PERMIT_DIR);
        break;

      case "vehicleFitness":
        cb(null, FITNESS_DIR);
        break;

      case "vehicleRequestLetter":
        cb(null, REQLETTER_DIR);
        break;

      case "vehicleTax":
        cb(null, TAX_DIR);
        break;

      case "vehicleEmission":
        cb(null, EMISSION_DIR);
        break;

      default:
        cb(new Error("Invalid upload field"), "null");
    }

  },

  filename: function (req, file, cb) {

    const company = sanitizeName(req.body.entityName || "COMPANY");
    const timestamp = generateTimestamp();

    let fileName = "";

    if (file.fieldname === "panDoc") {
      fileName = `${company}PAN${timestamp}.pdf`;
    }

    else if (file.fieldname === "gstinDoc") {
      fileName = `${company}GST${timestamp}.pdf`;
    }

    else if (file.fieldname === "tanDoc") {
      fileName = `${company}TAN${timestamp}.pdf`;
    }

    else if (file.fieldname === "entityFile") {
      fileName = `${company}ENTITY${timestamp}.pdf`;
    }

    else if (file.fieldname === "authLetter") {
      fileName = `AUTHLETTER${timestamp}.pdf`;
    }

    else if (file.fieldname === "personPhoto") {
      fileName = `PERSONPHOTO${timestamp}${path.extname(file.originalname)}`;
    }

    else if (file.fieldname === "personAadhar") {
      fileName = `PERSONAADHAR${timestamp}.pdf`;
    }

    else if (file.fieldname === "personIdProof") {
      fileName = `PERSONIDPROOF${timestamp}.pdf`;
    }

    else if (file.fieldname === "requisitionLetter") {
      fileName = `REQUISITIONLETTER${timestamp}.pdf`;
    }

    else if (file.fieldname === "vehicleRC") {
      fileName = `VEHICLERC${timestamp}.pdf`;
    }


    else if (file.fieldname === "driverLicense") {
      fileName = `DRIVERLICENSE${timestamp}.pdf`;
    }

    else if (file.fieldname === "policeVerification") {
      fileName = `POLICEVERIFY${timestamp}.pdf`;
    }

    else if (file.fieldname === "employmentProof") {
      fileName = `EMPLOYMENTPROOF${timestamp}.pdf`;
    }

    else if (file.fieldname === "chaLicenseCopy") {
      fileName = `CHALICENSE${timestamp}.pdf`;
    }

    else if (file.fieldname === "passportDoc") {
      fileName = `PASSPORT${timestamp}.pdf`;
    }

    else if (file.fieldname === "vehicleInsurance") {
      fileName = `VEHICLEINSURANCE${timestamp}.pdf`;
    }

    else if (file.fieldname === "vehiclePermit") {
      fileName = `VEHICLEPERMIT${timestamp}.pdf`;
    }

    else if (file.fieldname === "vehicleFitness") {
      fileName = `VEHICLEFITNESS${timestamp}.pdf`;
    }

    else if (file.fieldname === "vehicleRequestLetter") {
      fileName = `VEHICLEREQUEST${timestamp}.pdf`;
    }

    else if (file.fieldname === "vehicleTax") {
      fileName = `VEHICLETAX${timestamp}.pdf`;
    }

    else if (file.fieldname === "vehicleEmission") {
      fileName = `VEHICLEEMISSION${timestamp}.pdf`;
    }

    else if (!fileName) {
      fileName = `FILE${timestamp}${path.extname(file.originalname)}`;
    }

    cb(null, fileName);
  }

});

/* ===== FILE VALIDATION ===== */

const fileFilter = (req, file, cb) => {

  const allowedMime = [
    "application/pdf",
    "image/jpeg",
    "image/png"
  ];

  const allowedExt = [
    ".pdf",
    ".jpg",
    ".jpeg",
    ".png"
  ];

  const ext = path.extname(file.originalname).toLowerCase();

  if (!allowedMime.includes(file.mimetype) || !allowedExt.includes(ext)) {
    return cb(new Error("Invalid file type. Only PDF, JPG, JPEG, PNG allowed"));
  }

  cb(null, true);
};

/* ===== CHANGE =====
Better limits for performance and protection
*/
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024,   // 2MB max
    files: 1000                     // maximum files per request
  },
  preservePath: true
});

module.exports = upload;