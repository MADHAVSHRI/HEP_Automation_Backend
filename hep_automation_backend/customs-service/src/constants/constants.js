const DISCREPANCY_FOUND = Object.freeze({
  YES: "Yes",
  NO: "No",
});

const SCANNING_STATUS = Object.freeze({
  CLEAN: "Clean",
  MISMATCH: "Mismatch",
});

const SUPPORTED_IMAGE_MIMES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
];

const SUPPORTED_IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
];

module.exports = {
  DISCREPANCY_FOUND,
  DISCREPANCY_FOUND_LIST: Object.values(DISCREPANCY_FOUND),
  SCANNING_STATUS,
  SCANNING_STATUS_LIST: Object.values(SCANNING_STATUS),
  SUPPORTED_IMAGE_MIMES,
  SUPPORTED_IMAGE_EXTENSIONS,
};