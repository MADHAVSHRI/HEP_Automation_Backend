// const multer = require("multer");
// const path = require("path");
// const fs = require("fs");

// const uploadDir = "uploads/agent_docs";

// if (!fs.existsSync(uploadDir)) {
//   fs.mkdirSync(uploadDir, { recursive: true });
// }

// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, uploadDir);
//   },

//   filename: function (req, file, cb) {
//     const uniqueName =
//       Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(file.originalname);

//     cb(null, uniqueName);
//   },
// });

// const fileFilter = (req, file, cb) => {
//   const allowedTypes = ["application/pdf"];

//   if (!allowedTypes.includes(file.mimetype)) {
//     return cb(new Error("Only PDF files are allowed"));
//   }

//   cb(null, true);
// };

// const upload = multer({
//   storage,
//   fileFilter,
//   limits: { fileSize: 400 * 1024 }, // 400KB
// });

// module.exports = upload;


const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Base upload directory
const baseDir = "uploads/agent_docs";
const passRequestBaseDir = "uploads/passRequestDocs";

// Create directories if not exist
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

// Generate timestamp DDMMHHMM
const generateTimestamp = () => {
  const now = new Date();

  const DD = String(now.getDate()).padStart(2, "0");
  const MM = String(now.getMonth() + 1).padStart(2, "0");
  const HH = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");

  return `${DD}${MM}${HH}${mm}`;
};

// Clean company name
const sanitizeName = (name) => {
  return name.replace(/\s+/g, "").replace(/[^a-zA-Z0-9]/g, "");
};

const storage = multer.diskStorage({

  destination: function (req, file, cb) {

    if (file.fieldname === "panDoc") {
      cb(null, path.join(baseDir, "pan"));
    }

    else if (file.fieldname === "gstinDoc") {
      cb(null, path.join(baseDir, "gst"));
    }

    else if (file.fieldname === "tanDoc") {
      cb(null, path.join(baseDir, "tan"));
    }

    else if (file.fieldname === "entityFile") {
      cb(null, path.join(baseDir, "entity"));
    }

    // PASS REQUEST FILES

    else if (file.fieldname === "authLetter") {
      cb(null, path.join(passRequestBaseDir, "authLetters"));
    }

    else if (file.fieldname === "personPhoto") {
      cb(null, path.join(passRequestBaseDir, "personPhotos"));
    }

    else if (file.fieldname === "personAadhar") {
      cb(null, path.join(passRequestBaseDir, "personAadhar"));
    }

    else if (file.fieldname === "personIdProof") {
      cb(null, path.join(passRequestBaseDir, "personIdProof"));
    }

    else if (file.fieldname === "vehicleRC") {
      cb(null, path.join(passRequestBaseDir, "vehicleRC"));
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

    // PASS REQUEST FILE NAMES

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
  },

});

const fileFilter = (req, file, cb) => {

  if (
  file.mimetype !== "application/pdf" &&
  !file.mimetype.startsWith("image/")
) {
  return cb(new Error("Only PDF or Image files allowed"));
}

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 4000 * 1024 }
});

module.exports = upload;