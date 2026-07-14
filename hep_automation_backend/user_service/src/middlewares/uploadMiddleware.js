const multer = require("multer");
const path = require("path");
const fs = require("fs");

/* ===== CHANGE =====
Predefine directories to avoid repeated path.join calls during upload
*/
const baseDir = "uploads/agent_docs";
const passRequestBaseDir = "uploads/passRequestDocs";
const vendorPassBaseDir = "uploads/vendorPassDocs";



const PAN_DIR = path.join(baseDir, "pan");
const GST_DIR = path.join(baseDir, "gst");
const TAN_DIR = path.join(baseDir, "tan");
const WORK_ORDER_DIR = path.join(baseDir, "workOrder");
const AGENT_REQUISITION_DIR = path.join(baseDir,"requisitionLetter");
// const ENTITY_DIR = path.join(baseDir, "entity");

const AUTH_DIR = path.join(passRequestBaseDir, "authLetters");
const PHOTO_DIR = path.join(passRequestBaseDir, "personPhotos");
const AADHAR_DIR = path.join(passRequestBaseDir, "personAadhar");
const IDPROOF_DIR = path.join(passRequestBaseDir, "personIdProof");
const REQLETTER_DIR = path.join(passRequestBaseDir, "passRequisitionLetter");
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
const CDC_DIR = path.join(passRequestBaseDir,"cdcDocument");
const DECLARATION_DIR = path.join(passRequestBaseDir,"declarationForm");

const VENDOR_WORK_ORDER_DIR = path.join(vendorPassBaseDir, "workOrder");

if (!fs.existsSync(VENDOR_WORK_ORDER_DIR)) {
  fs.mkdirSync(VENDOR_WORK_ORDER_DIR, { recursive: true });
}

/* ===== ORIGINAL LOGIC (unchanged) ===== */

const folders = ["pan", "gst", "tan", "workOrder", "requisitionLetter"];
const passRequestFolders = [
  "authLetters",
  "personPhotos",
  "personAadhar",
  "personIdProof",
  "passRequisitionLetter",
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
  "vehicleEmission",
  "cdcDocument",
  "declarationForm"
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
    const fieldPrefix = file.fieldname.replace(/_\d+$/, "");
    switch (fieldPrefix) {

      case "panDoc":
        cb(null, PAN_DIR);
        break;

      case "gstinDoc":
        cb(null, GST_DIR);
        break;

      case "tanDoc":
        cb(null, TAN_DIR);
        break;

      case "workOrder":
        cb(null, WORK_ORDER_DIR);
        break;

      case "requisitionLetter":
        cb(null, AGENT_REQUISITION_DIR);
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

      case "passRequisitionLetter":
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

      case "cdcDocument":
        cb(null, CDC_DIR);
        break;

      case "declarationForm":
        cb(null, DECLARATION_DIR);
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

      case "vendorWorkOrder":
        cb(null, VENDOR_WORK_ORDER_DIR);
        break;

      default:
        cb(new Error("Invalid upload field"), "null");
    }

  },

  filename: function (req, file, cb) {

    const company = sanitizeName(req.body.entityName || "COMPANY");
    const timestamp = generateTimestamp();

    let fileName = "";
    const fieldPrefix = file.fieldname.replace(/_\d+$/, "");

    if (fieldPrefix === "panDoc") {
      fileName = `${company}PAN${timestamp}.pdf`;
    }

    else if (fieldPrefix === "gstinDoc") {
      fileName = `${company}GST${timestamp}.pdf`;
    }

    else if (fieldPrefix === "tanDoc") {
      fileName = `${company}TAN${timestamp}.pdf`;
    }

    else if (fieldPrefix === "workOrder") {
      fileName = `${company}WORKORDER${timestamp}.pdf`;
    }

    else if (fieldPrefix === "requisitionLetter") {
      fileName = `${company}REQUISITIONLETTER${timestamp}.pdf`;
    }

    else if (fieldPrefix === "authLetter") {
      fileName = `AUTHLETTER${timestamp}.pdf`;
    }

    else if (fieldPrefix === "personPhoto") {
      fileName = `PERSONPHOTO${timestamp}${path.extname(file.originalname)}`;
    }

    else if (fieldPrefix === "personAadhar") {
      fileName = `PERSONAADHAR${timestamp}.pdf`;
    }

    else if (fieldPrefix === "personIdProof") {
      fileName = `PERSONIDPROOF${timestamp}.pdf`;
    }

    else if (fieldPrefix === "passRequisitionLetter") {
      fileName = `PASSREQUISITIONLETTER${timestamp}.pdf`;
    }

    else if (fieldPrefix === "vehicleRC") {
      fileName = `VEHICLERC${timestamp}.pdf`;
    }


    else if (fieldPrefix === "driverLicense") {
      fileName = `DRIVERLICENSE${timestamp}.pdf`;
    }

    else if (fieldPrefix === "policeVerification") {
      fileName = `POLICEVERIFY${timestamp}.pdf`;
    }

    else if (fieldPrefix === "employmentProof") {
      fileName = `EMPLOYMENTPROOF${timestamp}.pdf`;
    }

    else if (fieldPrefix === "chaLicenseCopy") {
      fileName = `CHALICENSE${timestamp}.pdf`;
    }

    else if (fieldPrefix === "passportDoc") {
      fileName = `PASSPORT${timestamp}.pdf`;
    }

    else if (fieldPrefix === "vehicleInsurance") {
      fileName = `VEHICLEINSURANCE${timestamp}.pdf`;
    }

    else if (fieldPrefix === "vehiclePermit") {
      fileName = `VEHICLEPERMIT${timestamp}.pdf`;
    }

    else if (fieldPrefix === "vehicleFitness") {
      fileName = `VEHICLEFITNESS${timestamp}.pdf`;
    }

    else if (fieldPrefix === "vehicleRequestLetter") {
      fileName = `VEHICLEREQUEST${timestamp}.pdf`;
    }

    else if (fieldPrefix === "vehicleTax") {
      fileName = `VEHICLETAX${timestamp}.pdf`;
    }

    else if (fieldPrefix === "vehicleEmission") {
      fileName = `VEHICLEEMISSION${timestamp}.pdf`;
    }

    else if (fieldPrefix === "vendorWorkOrder") {
      fileName = `VENDORWORKORDER${timestamp}${path.extname(file.originalname)}`;
    }

    else if (fieldPrefix === "cdcDocument") {
      fileName = `CDCDOCUMENT${timestamp}.pdf`;
    }

    else if (fieldPrefix === "declarationForm") {
      fileName = `DECLARATIONFORM${timestamp}.pdf`;
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

/* ===== MAGIC BYTE VALIDATORS ===== */

// PDF magic bytes: %PDF- (25 50 44 46 2D)
const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D]);
// JPEG magic bytes: FF D8 FF
const JPEG_MAGIC = Buffer.from([0xFF, 0xD8, 0xFF]);
// PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

/**
 * Reads the first 8 bytes of a file and checks magic bytes against the
 * declared extension. Returns true if the content matches, false otherwise.
 * @param {string} filePath  Absolute path to the uploaded file on disk
 * @param {string} fieldname Multer field name (e.g. "workOrder", "personPhoto")
 * @returns {boolean}
 */
function verifyFileMagicBytes(filePath, fieldname) {
  try {
    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(8);
    fs.readSync(fd, buf, 0, 8, 0);
    fs.closeSync(fd);

    const fieldPrefix = fieldname.replace(/_\d+$/, "");

    // personPhoto is the only field that accepts images; everything else must be PDF
    if (fieldPrefix === "personPhoto") {
      return (
        buf.slice(0, JPEG_MAGIC.length).equals(JPEG_MAGIC) ||
        buf.slice(0, PNG_MAGIC.length).equals(PNG_MAGIC)
      );
    }

    // All other fields expect a real PDF
    return buf.slice(0, PDF_MAGIC.length).equals(PDF_MAGIC);
  } catch {
    // Cannot read → treat as invalid
    return false;
  }
}

/**
 * Express middleware — must be placed AFTER the multer upload middleware.
 * Iterates over every file multer wrote to disk and validates magic bytes.
 * Deletes invalid files and returns 400 immediately.
 */
function validateUploadedFileTypes(req, res, next) {
  // Collect all uploaded files from req.file (single) and req.files (fields/array)
  const uploadedFiles = [];

  if (req.file) {
    uploadedFiles.push(req.file);
  }

  if (req.files) {
    if (Array.isArray(req.files)) {
      uploadedFiles.push(...req.files);
    } else {
      // req.files is an object keyed by field name
      for (const files of Object.values(req.files)) {
        uploadedFiles.push(...files);
      }
    }
  }

  for (const file of uploadedFiles) {
    if (!verifyFileMagicBytes(file.path, file.fieldname)) {
      // Delete all files already written to disk before responding
      for (const f of uploadedFiles) {
        try { fs.unlinkSync(f.path); } catch { /* ignore */ }
      }
      return res.status(400).json({
        success: false,
        message: "Invalid file content. Only genuine PDF documents are allowed for document uploads.",
      });
    }
  }

  next();
}

/* ===== CHANGE =====
Better limits for performance and protection
*/
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,   // 5MB max per file (PDFs + photos can be large)
    files: 200                    // realistic max: 10 persons × 11 docs + 10 vehicles × 7 docs
  },
  preservePath: true
});

module.exports = upload;
module.exports.validateUploadedFileTypes = validateUploadedFileTypes;