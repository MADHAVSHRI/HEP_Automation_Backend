/**
 * excelParserService.js
 *
 * Parses one or more Excel (.xlsx/.xls) files, validates every row using
 * bulkPassValidators.js and photoValidationService.js, and builds error
 * reports as xlsx buffers.
 *
 * Exported functions:
 *   parseAndValidate(filePaths, fileNames)  → { rows: ParsedRow[], summary }
 *   buildErrorReport(rows)                  → Buffer (xlsx with Error column)
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 6.1, 6.2
 */

const ExcelJS = require("exceljs");
const path = require("path");
const {
  validateAadhaar,
  validateMobile,
  validateDOB,
  validateVehicleNumber,
} = require("../utils/bulkPassValidators");
const { validateEmbeddedPhoto } = require("./photoValidationService");

// ── Constants ──────────────────────────────────────────────────────────────
const MAX_ROWS_PER_FILE = 200; // Requirement 5.10
const MAX_TOTAL_ROWS = 1000;   // Requirement 5.9

// Expected column header names (case-insensitive match)
const REQUIRED_COLUMNS = ["name", "aadhaar number", "date of birth", "mobile number"];
const OPTIONAL_COLUMNS = [];
const PHOTO_COLUMN = "photo";

// ── Column header → field name mapping ────────────────────────────────────
const HEADER_MAP = {
  "name": "name",
  "aadhaar number": "aadhaar",
  "date of birth": "dob",
  "date of birth (dd/mm/yyyy)": "dob",
  "mobile number": "mobile",
  "photo": "photo",
};

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Normalise a cell value to a plain string (trim, handle numbers/dates).
 */
function cellToString(cell) {
  if (cell === null || cell === undefined) return "";
  const v = cell.value !== undefined ? cell.value : cell;
  if (v === null || v === undefined) return "";
  if (v instanceof Date) {
    const dd = String(v.getDate()).padStart(2, "0");
    const mm = String(v.getMonth() + 1).padStart(2, "0");
    const yyyy = String(v.getFullYear());
    return `${dd}/${mm}/${yyyy}`;
  }
  if (typeof v === "object" && v.text !== undefined) return String(v.text).trim();
  if (typeof v === "object" && v.richText) {
    return v.richText.map((rt) => rt.text || "").join("").trim();
  }
  return String(v).trim();
}

/**
 * Build a map of { rowIndex → imageBuffer } from worksheet.getImages().
 * ExcelJS image anchors use 0-based row indices; we convert to 1-based
 * row numbers to align with worksheet row numbering.
 */
function buildImageRowMap(worksheet, workbook) {
  const map = new Map(); // rowNumber (1-based) → Buffer
  try {
    const images = worksheet.getImages ? worksheet.getImages() : [];
    const media = (workbook.model && workbook.model.media) ? workbook.model.media : [];
    for (const img of images) {
      // imageId can be a number index - find by index value
      const imageId = img.imageId;
      const mediaItem = media.find((m) => m.index === imageId);
      if (!mediaItem || !mediaItem.buffer) continue;
      // tl.nativeRow is 0-based; add 1 to convert to 1-based row number
      const nativeRow = img.range && img.range.tl && img.range.tl.nativeRow != null
        ? Number(img.range.tl.nativeRow)
        : 0;
      const rowNum = nativeRow + 1;
      if (!map.has(rowNum)) {
        map.set(rowNum, Buffer.from(mediaItem.buffer));
      }
    }
  } catch (err) {
    // Non-fatal: if image extraction fails, continue without photos
    console.warn("[excelParser] buildImageRowMap failed:", err.message);
  }
  return map;
}

/**
 * Validate a single parsed row object.
 *
 * Duplicate Aadhaar detection is performed FIRST (before photo) so that
 * cross-file duplicates are always flagged regardless of photo status.
 * The `seenAadhaar` Set is mutated by the caller's pre-pass; here we only
 * read from `duplicateAadhaarSet` (rows whose Aadhaar appeared more than once).
 *
 * @param {object} rowData            — raw extracted cell values
 * @param {Buffer|null} photoBuffer
 * @param {Set<string>} seenAadhaar   — mutable; populated on first occurrence
 * @param {Set<string>} duplicateAadhaarSet — pre-populated by the pre-pass
 * @param {string} fileName
 * @param {number} rowNumber
 * @returns {Promise<{ validationStatus: string, errorMessage: string }>}
 */
async function validateRow(rowData, photoBuffer, seenAadhaar, duplicateAadhaarSet, fileName, rowNumber) {
  // ── Aadhaar format ────────────────────────────────────────────────────
  const aadhaarResult = validateAadhaar(rowData.aadhaar || "");
  if (!aadhaarResult.valid) {
    return { validationStatus: "invalid", errorMessage: aadhaarResult.error };
  }

  // ── Duplicate Aadhaar (checked before photo so it's always detectable) ─
  const aadhaarKey = rowData.aadhaar;
  if (duplicateAadhaarSet.has(aadhaarKey)) {
    // Only flag once the second occurrence is seen (seenAadhaar tracks first)
    if (seenAadhaar.has(aadhaarKey)) {
      return {
        validationStatus: "invalid",
        errorMessage: `Duplicate Aadhaar found in ${fileName} Row ${rowNumber}`,
      };
    }
  }
  seenAadhaar.add(aadhaarKey);

  // ── Photo ─────────────────────────────────────────────────────────────
  if (!photoBuffer) {
    return { validationStatus: "invalid", errorMessage: "Photo missing" };
  }

  const photoResult = await validateEmbeddedPhoto(photoBuffer);
  if (!photoResult.valid) {
    return { validationStatus: "invalid", errorMessage: photoResult.error };
  }

  // ── DOB ───────────────────────────────────────────────────────────────
  const dobResult = validateDOB(rowData.dob || "");
  if (!dobResult.valid) {
    return { validationStatus: "invalid", errorMessage: dobResult.error };
  }

  // ── Mobile ────────────────────────────────────────────────────────────
  const mobileResult = validateMobile(rowData.mobile || "");
  if (!mobileResult.valid) {
    return { validationStatus: "invalid", errorMessage: mobileResult.error };
  }

  // ── Required text fields ──────────────────────────────────────────────
  if (!rowData.name || rowData.name.trim() === "") {
    return { validationStatus: "invalid", errorMessage: "Name is required" };
  }

  return { validationStatus: "valid", errorMessage: "" };
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Parse and validate one or more Excel files.
 *
 * Two-pass approach:
 *   Pass 1 — extract raw row data and images from all files; collect all
 *            Aadhaar values to build a duplicate set.
 *   Pass 2 — validate each extracted row (duplicate Aadhaar checked first,
 *            then photo, then other fields).
 *
 * @param {string[]} filePaths  - absolute/relative paths to xlsx files on disk
 * @param {string[]} fileNames  - display names corresponding to each filePath
 * @returns {Promise<{ rows: ParsedRow[], summary: { total, valid, invalid } }>}
 */
async function parseAndValidate(filePaths, fileNames) {
  // ── Pass 1: extract raw rows from all files ──────────────────────────
  const extractedRows = []; // { fileName, rowNumber, rowData, photoBuffer, isBeyondLimit }
  const aadhaarCounts = new Map(); // aadhaar → count (for duplicate detection)
  let totalExtracted = 0;

  for (let fileIdx = 0; fileIdx < filePaths.length; fileIdx++) {
    const filePath = filePaths[fileIdx];

    // Guard: ensure filePath is a string
    if (typeof filePath !== "string") {
      throw new Error(`filePaths[${fileIdx}] must be a string, got ${typeof filePath}: ${JSON.stringify(filePath)}`);
    }

    const fileName = fileNames[fileIdx] || path.basename(filePath);

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.readFile(filePath);
    } catch (readErr) {
      console.warn(`[excelParser] Failed to read file ${fileName}:`, readErr.message);
      continue;
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) continue;

    // Parse header row
    const headerRow = worksheet.getRow(1);
    const colMap = {};
    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const header = cellToString(cell).toLowerCase();
      const fieldName = HEADER_MAP[header];
      if (fieldName) colMap[colNumber] = fieldName;
    });

    // Build image → row map
    const imageRowMap = buildImageRowMap(worksheet, workbook);

    let fileRowCount = 0;
    const lastRow = worksheet.lastRow ? worksheet.lastRow.number : 1;

    for (let rowNum = 2; rowNum <= lastRow; rowNum++) {
      if (totalExtracted >= MAX_TOTAL_ROWS) break;

      const wsRow = worksheet.getRow(rowNum);

      // Skip fully empty rows
      let hasData = false;
      wsRow.eachCell({ includeEmpty: false }, () => { hasData = true; });
      if (!hasData) continue;

      // Skip example/guide rows (any cell value starting with "e.g.")
      let isGuideRow = false;
      wsRow.eachCell({ includeEmpty: false }, (cell) => {
        if (cellToString(cell).trim().toLowerCase().startsWith("e.g.")) isGuideRow = true;
      });
      if (isGuideRow) continue;

      fileRowCount++;
      const dataRowNumber = fileRowCount; // 1-based data row within this file

      // Enforce per-file row limit (Req 5.10)
      if (fileRowCount > MAX_ROWS_PER_FILE) {
        extractedRows.push({
          fileName,
          rowNumber: dataRowNumber,
          rowData: {},
          photoBuffer: null,
          isBeyondLimit: true,
        });
        totalExtracted++;
        continue;
      }

      // Extract cell values
      const rowData = {};
      wsRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const fieldName = colMap[colNumber];
        if (fieldName) rowData[fieldName] = cellToString(cell);
      });

      // Track Aadhaar counts for duplicate detection (only for rows within limit)
      const aadhaar = (rowData.aadhaar || "").trim();
      if (aadhaar && /^\d{12}$/.test(aadhaar)) {
        aadhaarCounts.set(aadhaar, (aadhaarCounts.get(aadhaar) || 0) + 1);
      }

      const photoBuffer = imageRowMap.get(rowNum) || null;
      extractedRows.push({ fileName, rowNumber: dataRowNumber, rowData, photoBuffer, isBeyondLimit: false });
      totalExtracted++;
    }

    if (totalExtracted >= MAX_TOTAL_ROWS) break;
  }

  // Build duplicate Aadhaar set (Aadhaar values that appear more than once)
  const duplicateAadhaarSet = new Set(
    [...aadhaarCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([aadhaar]) => aadhaar)
  );

  // ── Pass 2: validate each extracted row ──────────────────────────────
  const rows = [];
  const seenAadhaar = new Set(); // tracks first occurrence of each Aadhaar

  for (const extracted of extractedRows) {
    // Rows beyond per-file limit
    if (extracted.isBeyondLimit) {
      rows.push({
        fileName: extracted.fileName,
        rowNumber: extracted.rowNumber,
        name: "",
        aadhaar: "",
        dob: "",
        mobile: "",
        photoBuffer: null,
        photoThumbnail: null,
        validationStatus: "invalid",
        errorMessage: `File ${extracted.fileName} exceeds 200 rows`,
      });
      continue;
    }

    const { validationStatus, errorMessage } = await validateRow(
      extracted.rowData,
      extracted.photoBuffer,
      seenAadhaar,
      duplicateAadhaarSet,
      extracted.fileName,
      extracted.rowNumber
    );

    let photoThumbnail = null;
    if (extracted.photoBuffer) {
      photoThumbnail = `data:image/jpeg;base64,${extracted.photoBuffer.toString("base64")}`;
    }

    rows.push({
      fileName: extracted.fileName,
      rowNumber: extracted.rowNumber,
      name: extracted.rowData.name || "",
      aadhaar: extracted.rowData.aadhaar || "",
      dob: extracted.rowData.dob || "",
      mobile: extracted.rowData.mobile || "",
      photoBuffer: extracted.photoBuffer,
      photoThumbnail,
      validationStatus,
      errorMessage,
    });
  }

  const validCount = rows.filter((r) => r.validationStatus === "valid").length;
  const invalidCount = rows.filter((r) => r.validationStatus === "invalid").length;

  return {
    rows,
    summary: {
      total: rows.length,
      valid: validCount,
      invalid: invalidCount,
    },
  };
}

/**
 * Build a downloadable error-report xlsx buffer.
 * Contains all rows from the parse result plus an "Error" column.
 *
 * @param {ParsedRow[]} rows
 * @returns {Promise<Buffer>}
 */
async function buildErrorReport(rows) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Error Report");

  // ── Header row ─────────────────────────────────────────────────────────
  worksheet.addRow([
    "File",
    "Row #",
    "Name",
    "Aadhaar Number",
    "Date of Birth",
    "Mobile Number",
    "Status",
    "Error",
  ]);

  // ── Data rows ──────────────────────────────────────────────────────────
  for (const row of rows) {
    worksheet.addRow([
      row.fileName || "",
      row.rowNumber || "",
      row.name || "",
      row.aadhaar || "",
      row.dob || "",
      row.mobile || "",
      row.validationStatus || "",
      row.errorMessage || "",
    ]);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

/**
 * parseExcelNoPhoto — new flow.
 * Parses Excel files without requiring embedded photos.
 * Returns raw editable rows; photo field is left null.
 * Validates Aadhaar, DOB, mobile, name, and duplicate Aadhaar.
 *
 * @param {string[]} filePaths
 * @param {string[]} fileNames
 * @returns {Promise<EditableRow[]>}
 */
async function parseExcelNoPhoto(filePaths, fileNames) {
  const extractedRows = [];
  const aadhaarCounts = new Map();
  let totalExtracted = 0;

  for (let fileIdx = 0; fileIdx < filePaths.length; fileIdx++) {
    const filePath = filePaths[fileIdx];
    if (typeof filePath !== "string") continue;
    const fileName = fileNames[fileIdx] || path.basename(filePath);

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.readFile(filePath);
    } catch {
      continue;
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) continue;

    const headerRow = worksheet.getRow(1);
    const colMap = {};
    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const header = cellToString(cell).toLowerCase();
      const fieldName = HEADER_MAP[header];
      if (fieldName) colMap[colNumber] = fieldName;
    });

    let fileRowCount = 0;
    const lastRow = worksheet.lastRow ? worksheet.lastRow.number : 1;

    for (let rowNum = 2; rowNum <= lastRow; rowNum++) {
      if (totalExtracted >= MAX_TOTAL_ROWS) break;
      const wsRow = worksheet.getRow(rowNum);

      let hasData = false;
      wsRow.eachCell({ includeEmpty: false }, () => { hasData = true; });
      if (!hasData) continue;

      const firstCellVal = cellToString(wsRow.getCell(1)).trim().toLowerCase();
      if (firstCellVal.startsWith("e.g.")) continue;

      fileRowCount++;
      if (fileRowCount > MAX_ROWS_PER_FILE) break;

      const rowData = {};
      wsRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const fieldName = colMap[colNumber];
        if (fieldName && fieldName !== "photo") rowData[fieldName] = cellToString(cell);
      });

      const aadhaar = (rowData.aadhaar || "").trim();
      if (aadhaar) {
        aadhaarCounts.set(aadhaar, (aadhaarCounts.get(aadhaar) || 0) + 1);
      }

      extractedRows.push({ fileName, rowNumber: fileRowCount, rowData });
      totalExtracted++;
    }
  }

  const duplicateAadhaarSet = new Set(
    [...aadhaarCounts.entries()].filter(([, c]) => c > 1).map(([a]) => a)
  );
  const seenAadhaar = new Set();

  const rows = extractedRows.map((extracted, idx) => {
    const { rowData, fileName, rowNumber } = extracted;
    const errors = [];

    const aadhaar = (rowData.aadhaar || "").trim();

    // Validate Aadhaar (soft — mark error but keep row editable)
    const aadhaarRes = validateAadhaar(aadhaar);
    if (!aadhaarRes.valid) {
      errors.push(aadhaarRes.error);
    } else if (duplicateAadhaarSet.has(aadhaar) && seenAadhaar.has(aadhaar)) {
      errors.push("Duplicate Aadhaar");
    }
    if (aadhaar) seenAadhaar.add(aadhaar);

    // Validate DOB if present
    if (rowData.dob) {
      const dobRes = validateDOB(rowData.dob);
      if (!dobRes.valid) errors.push(dobRes.error);
    }

    // Validate mobile if present
    if (rowData.mobile) {
      const mobRes = validateMobile(rowData.mobile);
      if (!mobRes.valid) errors.push(mobRes.error);
    }

    return {
      id: `row_${idx}`,
      fileName,
      rowNumber,
      name: rowData.name || "",
      aadhaar: aadhaar,
      dob: rowData.dob || "",
      mobile: rowData.mobile || "",
      gender: rowData.gender || "",
      address: rowData.address || "",
      vehicleNumber: rowData.vehicleNumber || "",
      photoDataUrl: null,
      parseErrors: errors,    // validation issues found during parse (soft — user can fix)
    };
  });

  return rows;
}

module.exports = { parseAndValidate, buildErrorReport, parseExcelNoPhoto };
