
// const multer = require("multer");
// const path = require("path");
// const fs = require("fs");

// // Base upload directory
// const baseDir = "uploads/agent_docs";
// const passRequestBaseDir = "uploads/passRequestDocs";

// // Create directories if not exist
// const folders = ["pan", "gst", "tan", "entity"];
// const passRequestFolders = [
//   "authLetters",
//   "personPhotos",
//   "personAadhar",
//   "personIdProof",
//   "vehicleRC"
// ];

// folders.forEach((folder) => {
//   const dir = path.join(baseDir, folder);
//   if (!fs.existsSync(dir)) {
//     fs.mkdirSync(dir, { recursive: true });
//   }
// });

// passRequestFolders.forEach((folder) => {
//   const dir = path.join(passRequestBaseDir, folder);
//   if (!fs.existsSync(dir)) {
//     fs.mkdirSync(dir, { recursive: true });
//   }
// });

// // Generate timestamp DDMMHHMM
// const generateTimestamp = () => {
//   const now = new Date();

//   const DD = String(now.getDate()).padStart(2, "0");
//   const MM = String(now.getMonth() + 1).padStart(2, "0");
//   const HH = String(now.getHours()).padStart(2, "0");
//   const mm = String(now.getMinutes()).padStart(2, "0");

//   return `${DD}${MM}${HH}${mm}`;
// };

// // Clean company name
// const sanitizeName = (name) => {
//   return name.replace(/\s+/g, "").replace(/[^a-zA-Z0-9]/g, "");
// };

// const storage = multer.diskStorage({

//   destination: function (req, file, cb) {

//     if (file.fieldname === "panDoc") {
//       cb(null, path.join(baseDir, "pan"));
//     }

//     else if (file.fieldname === "gstinDoc") {
//       cb(null, path.join(baseDir, "gst"));
//     }

//     else if (file.fieldname === "tanDoc") {
//       cb(null, path.join(baseDir, "tan"));
//     }

//     else if (file.fieldname === "entityFile") {
//       cb(null, path.join(baseDir, "entity"));
//     }

//     // PASS REQUEST FILES

//     else if (file.fieldname === "authLetter") {
//       cb(null, path.join(passRequestBaseDir, "authLetters"));
//     }

//     else if (file.fieldname === "personPhoto") {
//       cb(null, path.join(passRequestBaseDir, "personPhotos"));
//     }

//     else if (file.fieldname === "personAadhar") {
//       cb(null, path.join(passRequestBaseDir, "personAadhar"));
//     }

//     else if (file.fieldname === "personIdProof") {
//       cb(null, path.join(passRequestBaseDir, "personIdProof"));
//     }

//     else if (file.fieldname === "vehicleRC") {
//       cb(null, path.join(passRequestBaseDir, "vehicleRC"));
//     }

//   },

//   filename: function (req, file, cb) {

//     const company = sanitizeName(req.body.entityName || "COMPANY");
//     const timestamp = generateTimestamp();

//     let fileName = "";

//     if (file.fieldname === "panDoc") {
//       fileName = `${company}PAN${timestamp}.pdf`;
//     }

//     else if (file.fieldname === "gstinDoc") {
//       fileName = `${company}GST${timestamp}.pdf`;
//     }

//     else if (file.fieldname === "tanDoc") {
//       fileName = `${company}TAN${timestamp}.pdf`;
//     }

//     else if (file.fieldname === "entityFile") {
//       fileName = `${company}ENTITY${timestamp}.pdf`;
//     }

//     // PASS REQUEST FILE NAMES

//     else if (file.fieldname === "authLetter") {
//       fileName = `AUTHLETTER${timestamp}.pdf`;
//     }

//     else if (file.fieldname === "personPhoto") {
//       fileName = `PERSONPHOTO${timestamp}${path.extname(file.originalname)}`;
//     }

//     else if (file.fieldname === "personAadhar") {
//       fileName = `PERSONAADHAR${timestamp}.pdf`;
//     }

//     else if (file.fieldname === "personIdProof") {
//       fileName = `PERSONIDPROOF${timestamp}.pdf`;
//     }

//     else if (file.fieldname === "vehicleRC") {
//       fileName = `VEHICLERC${timestamp}.pdf`;
//     }

//     cb(null, fileName);
//   },

// });

// const fileFilter = (req, file, cb) => {

//   if (
//   file.mimetype !== "application/pdf" &&
//   !file.mimetype.startsWith("image/")
// ) {
//   return cb(new Error("Only PDF or Image files allowed"));
// }

//   cb(null, true);
// };

// const upload = multer({
//   storage,
//   fileFilter,
//   limits: { fileSize: 1024 * 1024 },
//   preservePath: true,
// });

// module.exports = upload;


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
const RC_DIR = path.join(passRequestBaseDir, "vehicleRC");

/* ===== ORIGINAL LOGIC (unchanged) ===== */

const folders = ["pan", "gst", "tan", "entity"];
const passRequestFolders = [
  "authLetters",
  "personPhotos",
  "personAadhar",
  "personIdProof",
  "vehicleRC"
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

      case "vehicleRC":
        cb(null, RC_DIR);
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

    else if (file.fieldname === "vehicleRC") {
      fileName = `VEHICLERC${timestamp}.pdf`;
    }

    cb(null, fileName);
  }

});

/* ===== FILE VALIDATION ===== */

const fileFilter = (req, file, cb) => {

  if (
    file.mimetype !== "application/pdf" &&
    !file.mimetype.startsWith("image/")
  ) {
    return cb(new Error("Only PDF or Image files allowed"));
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