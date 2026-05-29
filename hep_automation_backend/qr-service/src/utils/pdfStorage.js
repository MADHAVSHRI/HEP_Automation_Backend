const fs = require("fs");
const path = require("path");

const BASE_DIR = path.join(process.cwd(), "uploads", "qr-passes");

function getPdfPath({
  passReferenceNo,
  type,
  passNo,
}) {
  const subFolder =
    type === "person"
      ? "persons"
      : "vehicles";

  const folderPath = path.join(
    BASE_DIR,
    passReferenceNo,
    subFolder
  );

  const filePath = path.join(
    folderPath,
    `${passNo}.pdf`
  );

  return {
    folderPath,
    filePath,
  };
}

async function ensureDirectory(folderPath) {
  await fs.promises.mkdir(folderPath, {
    recursive: true,
  });
}

async function fileExists(filePath) {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  getPdfPath,
  ensureDirectory,
  fileExists,
};