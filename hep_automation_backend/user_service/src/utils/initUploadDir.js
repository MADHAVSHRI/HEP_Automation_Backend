const fs = require("fs");
const path = require("path");

const baseDir = "uploads/agent_docs";
const passRequestBaseDir = "uploads/passRequestDocs";

const folders = ["pan", "gst", "tan", "entity"];
const passRequestFolders = [
  "authLetters",
  "personPhotos",
  "personAadhar",
  "personIdProof",
  "vehicleRC"
];

function initUploadDirs() {

  folders.forEach(folder => {
    const dir = path.join(baseDir, folder);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  passRequestFolders.forEach(folder => {
    const dir = path.join(passRequestBaseDir, folder);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

}

module.exports = initUploadDirs;