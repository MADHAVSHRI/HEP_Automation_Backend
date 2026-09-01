const fs = require("fs");
const path = require("path");
const {
  PASS_TYPES,
  NATIONALITIES,
  ID_PROOF_TYPES,
  ACCESS_AREAS,
} = require("../constants/constants");
const passRequestService = require("../services/passRequestService");
const {
  Designation,
  vehicleTypes,
  PassRequest,
  hepTypes,
  countries,
  states,
  cities,
  visitPurpose,
  getPassRequest,
  Master,
  getAgentPassRequestsDetails,
  viewPassRequestsDocuments,
} = require("../models/passRequestSchema");
const { pool } = require("../dbconfig/db");
const { sendEmailEvent } = require("../utils/kafka/producer");
const { get } = require( "http" );

const isOilDockArea = (val) => {
  if (!val) return false;
  const str = String(val).toUpperCase();
  return str === "1" || str.includes("OIL JETTY") || str.includes("OIL_JETTY");
};

const getNationalities = (req, res) => {
  const sorted = NATIONALITIES.slice().sort((a, b) =>
    a.label.localeCompare(b.label),
  );

  res.json(sorted);
};

const getPassTypes = (req, res) => {
  const sorted = PASS_TYPES.slice().sort((a, b) =>
    a.label.localeCompare(b.label),
  );

  res.json(sorted);
};

const getIdProofTypes = (req, res) => {
  const sorted = ID_PROOF_TYPES.slice().sort((a, b) =>
    a.label.localeCompare(b.label),
  );

  res.json(sorted);
};

const getAccessAreas = (req, res) => {
  const sorted = ACCESS_AREAS.slice().sort((a, b) =>
    a.label.localeCompare(b.label),
  );

  res.json(sorted);
};

const getDesignations = async (req, res) => {
  try {
    const designations = await Designation.getAllDesignations();

    res.status(200).json({
      success: true,
      data: designations,
    });
  } catch (error) {
    console.error("Designation Fetch Error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getvehicleTypes = async (req, res) => {
  try {
    const types = await vehicleTypes.getAllVehicleTypes();

    res.status(200).json({
      success: true,
      data: types,
    });
  } catch (error) {
    console.error("Vehicle Types Fetch Error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getHepTypes = async (req, res) => {
  try {
    const types = await hepTypes.getAllHepTypes();

    res.status(200).json({
      success: true,
      data: types,
    });
  } catch (error) {
    console.error("Hep Types Fetch Error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getCountries = async (req, res) => {
  try {
    const countryList = await countries.getAllCountries();

    res.status(200).json({
      success: true,
      data: countryList,
    });
  } catch (error) {
    console.error("Countries Fetch Error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getStates = async (req, res) => {
  try {
    const { countryId } = req.query;
    if (!countryId) {
      return res.status(400).json({
        success: false,
        message: "countryId is required",
      });
    }

    const stateList = await states.getStatesByCountry(countryId);

    res.status(200).json({
      success: true,
      data: stateList,
    });
  } catch (error) {
    console.error("States Fetch Error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getCities = async (req, res) => {
  try {
    const { stateId } = req.query;
    if (!stateId) {
      return res.status(400).json({
        success: false,
        message: "stateId is required",
      });
    }

    const cityList = await cities.getCitiesByState(stateId);

    res.status(200).json({
      success: true,
      data: cityList,
    });
  } catch (error) {
    console.error("Cities Fetch Error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getVisitPurposes = async (req, res) => {
  try {
    const purposes = await visitPurpose.getAllVisitPurposes();

    res.status(200).json({
      success: true,
      data: purposes,
    });
  } catch (error) {
    console.error("Visit Purposes Fetch Error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const createPassRequest = async (req, res) => {
  const deleteFiles = () => {
    const files = req.files;
    if (!files) return;

    const allFiles = [];
    if (Array.isArray(files)) {
      allFiles.push(...files);
    } else if (typeof files === "object") {
      Object.values(files).forEach((item) => {
        if (Array.isArray(item)) {
          allFiles.push(...item);
        } else if (item && typeof item === "object") {
          allFiles.push(item);
        }
      });
    }

    allFiles.forEach((file) => {
      if (file && file.path && fs.existsSync(file.path)) {
        fs.unlink(file.path, (err) => {
          if (err && err.code !== "ENOENT") {
            console.error("File delete error:", err);
          }
        });
      }
    });
  };

  try {
    const payload = JSON.parse(req.body.payload);

    payload.agentId = req.user.userId; // from JWT

    /* ===== CHANGE START =====
       Normalize passType values coming from frontend
       Frontend sometimes sends YEARLY but DB expects ANNUAL
    ===== */

    const normalizePassType = (type) => {
      if (!type) return null;

      const map = {
        DAILY: "DAILY",
        MONTHLY: "MONTHLY",
        ANNUAL: "YEARLY",
        YEARLY: "YEARLY",
        1: "DAILY",
        2: "MONTHLY",
        3: "YEARLY",
      };

      return map[type] || type;
    };

    if (payload.persons && Array.isArray(payload.persons)) {
      payload.persons = payload.persons.map((p) => ({
        ...p,
        passType: normalizePassType(p.passType),
      }));
    }

    if (payload.vehicles && Array.isArray(payload.vehicles)) {
      payload.vehicles = payload.vehicles.map((v) => ({
        ...v,
        passType: normalizePassType(v.passType),
      }));
    }

    /* ===== CHANGE END ===== */

    // 0. Check Agent License Expiry & Duration Lock (Duration-Aware Validation)
    if (payload.agentId) {
      const agentRes = await pool.query(
        'SELECT id, "isLifetimeLicense", TO_CHAR("licenseValidityDate", \'YYYY-MM-DD\') AS "licenseValidityDate", "entityName" FROM "Agents" WHERE id = $1',
        [payload.agentId],
      );
      if (
        agentRes.rows.length > 0 &&
        !agentRes.rows[0].isLifetimeLicense &&
        agentRes.rows[0].licenseValidityDate
      ) {
        const licenseValidityStr = String(
          agentRes.rows[0].licenseValidityDate,
        ).split("T")[0];
        const [yyyy, mm, dd] = licenseValidityStr.split("-").map(Number);

        if (yyyy && mm && dd) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const licenseExpEnd = new Date(yyyy, mm - 1, dd, 23, 59, 59, 999);
          const licenseExpStart = new Date(yyyy, mm - 1, dd, 0, 0, 0, 0);

          const diffMs = licenseExpStart.getTime() - today.getTime();
          const remainingDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
          const formattedExpDate = `${String(dd).padStart(2, "0")}/${String(mm).padStart(2, "0")}/${yyyy}`;

          // Calculate max requested pass end date from persons and vehicles
          let maxRequestedDate = new Date();
          const allItems = [
            ...(payload.persons || []),
            ...(payload.vehicles || []),
          ];
          for (const item of allItems) {
            let itemTo = null;
            if (item.toDate) {
              itemTo = new Date(item.toDate);
            } else {
              const start = item.fromDate
                ? new Date(item.fromDate)
                : new Date(today);
              itemTo = new Date(start);
              const pType = String(item.passType || "").toUpperCase();
              if (pType === "MONTHLY" || pType === "2") {
                itemTo.setMonth(itemTo.getMonth() + 1);
              } else if (
                pType === "YEARLY" ||
                pType === "ANNUAL" ||
                pType === "3"
              ) {
                itemTo.setFullYear(itemTo.getFullYear() + 1);
              } else {
                const p = parseInt(item.passPeriod || 1, 10);
                itemTo.setDate(itemTo.getDate() + p);
              }
            }
            if (itemTo && itemTo > maxRequestedDate) maxRequestedDate = itemTo;
          }

          if (today > licenseExpEnd) {
            return res.status(403).json({
              success: false,
              code: "LICENSE_EXPIRED",
              message: `Your company license expired on ${formattedExpDate}. Pass generation is blocked. Please submit a Profile/License Update Request to update your license.`,
            });
          }

          if (maxRequestedDate > licenseExpEnd) {
            return res.status(403).json({
              success: false,
              code: "PASS_EXCEEDS_LICENSE",
              message: `Your company license expires in ${remainingDays} days (on ${formattedExpDate}). You cannot apply for a pass valid beyond your license expiry date. Please update your company license.`,
            });
          }
        }
      }
    }

    // 0. Check Overstay Charges — block pass if agent has any PENDING or EXCEPTION_REJECTED charges
    // 0. Check Overstay Charges — block pass if agent has any PENDING or EXCEPTION_REJECTED charges
    //    (only if ATM has this enforcement switched on)
    if (payload.agentId) {
      const Overstay = require("../../../approval-admin-service/src/models/overstaySchema"); // adjust path as needed
      const blockSetting = await Overstay.getPassBlockSetting();

      if (blockSetting.value) {
        // Global block: any pending charge blocks this agent
        const overstayBlock = await pool.query(
          `SELECT id, identifier, total_amount, status
           FROM overstay_charges
           WHERE agent_id = $1 AND status IN ('PENDING','EXCEPTION_REJECTED')
           LIMIT 5`,
          [payload.agentId],
        );
        if (overstayBlock.rows.length > 0) {
          return res.status(403).json({
            success: false,
            message:
              "You have unpaid overstay charges. Please clear them before applying for a new pass.",
            overstay_charges: overstayBlock.rows,
          });
        }
      } else {
        // Per-company block: enforce only for agents explicitly switched on by ATM.
        const agentBlockSetting = await Overstay.getAgentPassBlockSetting(
          payload.agentId,
        );
        if (agentBlockSetting.value) {
          const overstayBlock = await pool.query(
            `SELECT id, identifier, total_amount, status
             FROM overstay_charges
             WHERE agent_id = $1 AND status IN ('PENDING','EXCEPTION_REJECTED')
             LIMIT 5`,
            [payload.agentId],
          );
          if (overstayBlock.rows.length > 0) {
            return res.status(403).json({
              success: false,
              message:
                "Your company has been blocked from applying for new passes due to an unpaid overstay charge. Please contact the ATM office.",
              overstay_charges: overstayBlock.rows,
            });
          }
        }
      }
    }

    // Auto-backdate persons/vehicles that cleared overstay charges (§5.6.7)
    if (payload.agentId) {
      const cleared = await pool.query(
        `SELECT identifier, entity_type, date_to FROM overstay_charges
         WHERE agent_id = $1 AND status IN ('PAID','EXCEPTION_APPROVED','WAIVED')
         ORDER BY date_to DESC`,
        [payload.agentId],
      );
      if (cleared.rows.length > 0) {
        const today = new Date().toISOString().slice(0, 10);
        const clearedMap = {};
        for (const row of cleared.rows) {
          const key = row.identifier.toUpperCase().replace(/[\s-]/g, "");
          if (!clearedMap[key]) {
            const dt = row.date_to;
            clearedMap[key] =
              dt instanceof Date
                ? dt.toISOString().slice(0, 10)
                : String(dt).slice(0, 10);
          }
        }
        if (payload.persons) {
          for (const p of payload.persons) {
            const key = (p.aadharNo || "").toUpperCase().replace(/[\s-]/g, "");
            if (clearedMap[key]) {
              p.dateFrom = clearedMap[key];
              p.dateTo = today;
            }
          }
        }
        if (payload.vehicles) {
          for (const v of payload.vehicles) {
            const key = (v.registrationNo || "")
              .toUpperCase()
              .replace(/[\s-]/g, "");
            if (clearedMap[key]) {
              v.dateFrom = clearedMap[key];
              v.dateTo = today;
            }
          }
        }
      }
    }

    // 1. Check Company blacklisting
    if (payload.agentId) {
      const agentRes = await pool.query(
        'SELECT id, "loginId" FROM "Agents" WHERE id = $1',
        [payload.agentId],
      );
      if (agentRes.rows.length > 0) {
        const companyName = agentRes.rows[0].loginId;
        const companyIdStr = String(agentRes.rows[0].id || payload.agentId);
        const blacklistRes = await pool.query(
          "SELECT id, reason FROM blacklist_entries WHERE entity_type = 'COMPANY' AND (UPPER(identifier) = UPPER($1) OR identifier = $2) AND status IN ('BLACKLISTED', 'UNBLACKLIST_REQUESTED')",
          [companyName, companyIdStr],
        );
        if (blacklistRes.rows.length > 0) {
          return res.status(403).json({
            success: false,
            message: `Pass application blocked. Your company (${companyName}) is blacklisted. Reason: ${blacklistRes.rows[0].reason}`,
          });
        }
      }
    }

    // 2. Check Persons & Drivers blacklisting
    // Note: person.aadharNo holds either the Aadhaar number OR the Passport number
    // for Seafarers who chose Passport as their primary ID (stored in same column).
    if (payload.persons && Array.isArray(payload.persons)) {
      for (const person of payload.persons) {
        if (person.aadharNo) {
          const identifier = person.aadharNo.toUpperCase().trim();
          const blacklistRes = await pool.query(
            "SELECT id, reason, entity_type FROM blacklist_entries WHERE entity_type IN ('PERSON', 'DRIVER') AND identifier = $1 AND status IN ('BLACKLISTED', 'UNBLACKLIST_REQUESTED', 'PENDING_BLACKLIST')",
            [identifier],
          );
          if (blacklistRes.rows.length > 0) {
            return res.status(403).json({
              success: false,
              message: `Pass application blocked. Person/Driver with Primary ID (${identifier}) is blacklisted as ${blacklistRes.rows[0].entity_type}. Reason: ${blacklistRes.rows[0].reason}`,
            });
          }
        }
      }
    }

    // 3. Check Vehicles blacklisting (exclude blacklisted vehicles instead of blocking the entire request)
    let skippedVehicles = [];
    if (payload.vehicles && Array.isArray(payload.vehicles)) {
      const activeVehicles = [];
      for (let idx = 0; idx < payload.vehicles.length; idx++) {
        const vehicle = payload.vehicles[idx];
        if (vehicle.registrationNo) {
          const blacklistRes = await pool.query(
            "SELECT id, reason FROM blacklist_entries WHERE entity_type = 'VEHICLE' AND REPLACE(REPLACE(UPPER(identifier), ' ', ''), '-', '') = REPLACE(REPLACE(UPPER($1), ' ', ''), '-', '') AND status IN ('BLACKLISTED', 'UNBLACKLIST_REQUESTED', 'PENDING_BLACKLIST')",
            [vehicle.registrationNo],
          );
          if (blacklistRes.rows.length > 0) {
            skippedVehicles.push({
              registrationNo: vehicle.registrationNo,
              reason: blacklistRes.rows[0].reason,
            });
            continue; // Exclude this blacklisted vehicle
          }
        }
        vehicle.originalIndex = idx; // Preserve original index for correct file attachment on the backend
        activeVehicles.push(vehicle);
      }
      payload.vehicles = activeVehicles;
    }

    // If there are no persons in the payload AND all vehicles were blacklisted/skipped, block the request
    const personCount =
      payload.persons && Array.isArray(payload.persons)
        ? payload.persons.length
        : 0;
    if (
      personCount === 0 &&
      skippedVehicles.length > 0 &&
      payload.vehicles.length === 0
    ) {
      return res.status(403).json({
        success: false,
        message: `Pass application blocked. All vehicles in the request are blacklisted. Reasons: ${skippedVehicles.map((v) => `${v.registrationNo}: ${v.reason}`).join("; ")}`,
      });
    }

    const passRequestId = await PassRequest.createPassRequest(
      payload,
      req.files,
    );

    let successMessage = "Pass request submitted successfully";
    if (skippedVehicles.length > 0) {
      successMessage = `Pass request submitted successfully. Note: Blacklisted vehicle(s) [${skippedVehicles.map((v) => v.registrationNo).join(", ")}] were excluded.`;
    }

    res.status(201).json({
      success: true,
      message: successMessage,
      passRequestId,
    });
  } catch (error) {
    deleteFiles();

    console.error("Pass Request Error:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Failed to create pass request",
    });
  }
};

const getAgentPassRequests = async (req, res) => {
  try {
    const agentId = req.user.userId; // from JWT

    const {
      getPagination,
      buildPaginatedResponse,
    } = require("../utils/pagination");
    const pag = getPagination(req.query);

    const result = await getPassRequest.getAgentPassRequests(agentId, pag);

    // Compute the correct total records for the active tab (reverted vs view/all)
    let totalRecordsForTab = result.counts.total;
    if (pag.status === "reverted") {
      totalRecordsForTab = result.counts.reverted;
    }

    return res.json(
      buildPaginatedResponse(
        result.data,
        result.counts,
        totalRecordsForTab,
        pag.page,
        pag.limit,
      ),
    );
  } catch (error) {
    console.error("Fetch pass requests error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getMasterDirectory = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const agentId = req.user.userId;
    const {
      getPagination,
      buildPaginatedResponse,
    } = require("../utils/pagination");

    const isPaginated = req.query.page || req.query.limit || req.query.search;

    if (isPaginated) {
      const pag = getPagination(req.query);
      const search = req.query.search || "";
      const type = req.query.type || "personnel";

      const [personCount, vehicleCount] = await Promise.all([
        Master.getPersonCount(agentId, search),
        Master.getVehicleCount(agentId, search),
      ]);

      let data = [];
      let totalRecords = 0;

      if (type === "personnel") {
        data = await Master.getPersonsByAgent(agentId, { ...pag, search });
        totalRecords = personCount;
      } else {
        data = await Master.getVehiclesByAgent(agentId, { ...pag, search });
        totalRecords = vehicleCount;
      }

      return res
        .status(200)
        .json(
          buildPaginatedResponse(
            data,
            { personCount, vehicleCount },
            totalRecords,
            pag.page,
            pag.limit,
          ),
        );
    } else {
      const [persons, vehicles, personCount, vehicleCount] = await Promise.all([
        Master.getPersonsByAgent(agentId, { limit: 100000, offset: 0 }),
        Master.getVehiclesByAgent(agentId, { limit: 100000, offset: 0 }),
        Master.getPersonCount(agentId),
        Master.getVehicleCount(agentId),
      ]);

      return res.status(200).json({
        success: true,
        data: {
          persons,
          vehicles,
          personCount,
          vehicleCount,
        },
      });
    }
  } catch (error) {
    console.error("Fetch directory error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const viewMasterDocument = async (req, res) => {
  try {
    const { masterId, entityType, documentType } = req.query;

    const result = await viewPassRequestsDocuments.getMasterDocumentPath(
      masterId,
      entityType,
      documentType,
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    return res.sendFile(path.resolve(result.filePath));
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getAgentPassRequestsToApproverAdmin = async (req, res) => {
  try {
    const role = req.user.role;
    const roleId = req.user.roleId;
    const departmentId = req.user.departmentId;
    const userId = req.user.userId;

    // Parse pagination + search params from query string
    const {
      getPagination,
      buildPaginatedResponse,
    } = require("../utils/pagination");
    const pag = getPagination(req.query);

    const result =
      await getAgentPassRequestsDetails.getAgentPassRequestsToApproverAdmin(
        role,
        departmentId,
        {
          ...pag,
          processedByMe:
            req.query.processedByMe === "true" ||
            req.query.processedByMe === true,
          userId,
          roleId,
        },
      );

    // Compute the correct total records for the active tab (pending vs processed)
    let totalRecordsForTab = result.counts.total;
    if (pag.status === "pending") {
      totalRecordsForTab = result.counts.pending;
    } else if (pag.status === "processed") {
      totalRecordsForTab = result.counts.processed;
    }

    return res.json(
      buildPaginatedResponse(
        result.data,
        result.counts,
        totalRecordsForTab,
        pag.page,
        pag.limit,
      ),
    );
  } catch (error) {
    console.error("Approval pass fetch error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const viewPassRequestsDocument = async (req, res) => {
  try {
    const { passRequestId, documentType, entityIndex, isVendorPass } =
      req.query;

    if (!passRequestId || !documentType) {
      return res.status(400).json({
        success: false,
        message: "passRequestId and documentType required",
      });
    }

    const fileData = await viewPassRequestsDocuments.getPassDocumentPath(
      passRequestId,
      documentType,
      entityIndex ? parseInt(entityIndex) : 0,
      isVendorPass === "true",
    );

    if (!fileData) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    const filePath = Object.values(fileData)[0];

    if (!filePath) {
      return res.status(404).json({
        success: false,
        message: "File path not found",
      });
    }

    const absolutePath = path.join(process.cwd(), filePath);

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({
        success: false,
        message: "File missing on server",
      });
    }
    let contentType = "application/octet-stream";
    try {
      const fd = fs.openSync(absolutePath, "r");
      const buffer = Buffer.alloc(4);
      fs.readSync(fd, buffer, 0, 4, 0);
      fs.closeSync(fd);

      // Check magic bytes:
      // PDF: %PDF (0x25 0x50 0x44 0x46)
      // PNG: 0x89 0x50 0x4E 0x47
      // JPEG: 0xFF 0xD8 0xFF
      if (
        buffer[0] === 0x25 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x44 &&
        buffer[3] === 0x46
      ) {
        contentType = "application/pdf";
      } else if (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47
      ) {
        contentType = "image/png";
      } else if (
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff
      ) {
        contentType = "image/jpeg";
      } else {
        const pathExt = path.extname(absolutePath).toLowerCase();
        if (pathExt === ".pdf") contentType = "application/pdf";
        if (pathExt === ".jpg" || pathExt === ".jpeg")
          contentType = "image/jpeg";
        if (pathExt === ".png") contentType = "image/png";
      }
    } catch (err) {
      console.error(
        "Error reading file magic bytes, falling back to extension:",
        err,
      );
      const pathExt = path.extname(absolutePath).toLowerCase();
      if (pathExt === ".pdf") contentType = "application/pdf";
      if (pathExt === ".jpg" || pathExt === ".jpeg") contentType = "image/jpeg";
      if (pathExt === ".png") contentType = "image/png";
    }

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", "inline");

    const stream = fs.createReadStream(absolutePath);

    stream.on("error", (error) => {
      console.error("Stream error:", error);
      res.status(500).end("Error reading file");
    });

    stream.pipe(res);
  } catch (error) {
    console.error("View pass request document error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const approvePerson = async (req, res) => {
  try {
    const { personId, remarks } = req.body;
    const role = req.user?.role;
    const roleId = req.user?.roleId;

    if (roleId === 28 || role === "Senior Deputy Traffic Manager") {
      const query = `
        UPDATE pass_persons
        SET "srDtmApproved" = true, "srDtmRemarks" = $2, "updatedAt" = NOW()
        WHERE id = $1
        RETURNING *
      `;
      const personRes = await pool.query(query, [personId, remarks || null]);
      const person = personRes.rows[0];
      if (!person) {
        return res
          .status(404)
          .json({ success: false, message: "Person not found" });
      }

      const passRequestId = person.passRequestId;

      const allPersonsQuery = `
        SELECT pp.id, pp."srDtmApproved", pp."accessAreaId"
        FROM pass_persons pp
        WHERE pp."passRequestId" = $1
      `;
      const allPersonsRes = await pool.query(allPersonsQuery, [passRequestId]);
      const oilDockPersons = allPersonsRes.rows.filter((p) =>
        isOilDockArea(p.accessAreaId),
      );
      const allApproved = oilDockPersons.every((p) => p.srDtmApproved);

      if (allApproved) {
        // Update workflow state — Pass Section query now uses per-entity flags directly
        await pool.query(
          `UPDATE pass_requests SET "workflowState" = 'PENDING_PASS_SECTION', "updatedAt" = NOW() WHERE id = $1`,
          [passRequestId],
        );
      }

      return res.json({
        success: true,
        data: person,
      });
    } else {
      const person = await PassRequest.approvePerson(personId);
      return res.json({
        success: true,
        data: person,
      });
    }
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const rejectPerson = async (req, res) => {
  try {
    const { personId, rejectedReason } = req.body;

    const person = await PassRequest.rejectPerson(personId, rejectedReason);

    return res.json({
      success: true,
      data: person,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const approveVehicle = async (req, res) => {
  try {
    const { vehicleId, remarks } = req.body;
    const role = req.user?.role;
    const roleId = req.user?.roleId;
    const departmentId = req.user?.departmentId;

    const isMarineFireSafety =
      role === "Fire Safety Officer" && Number(departmentId) === 7;

    if (roleId === 26 || role === "Safety Officer") {
      const query = `
        UPDATE pass_vehicles
        SET "twistLockCertified" = true, "twistLockRemarks" = $2, "updatedAt" = NOW()
        WHERE id = $1
        RETURNING *
      `;
      const vehicleRes = await pool.query(query, [vehicleId, remarks || null]);
      const vehicle = vehicleRes.rows[0];
      if (!vehicle) {
        return res
          .status(404)
          .json({ success: false, message: "Vehicle not found" });
      }

      const passRequestId = vehicle.passRequestId;

      // SRS §386: All vehicles (oil dock daily AND monthly/yearly) now route through Safety Officer.
      // Monthly/yearly vehicles require twistLockCertified.
      // Daily oil dock vehicles just need to be individually certified (twistLockCertified set to true).
      // "Complete Review" button handles the actual state transition — here we just track per-vehicle.
      // Check if ALL monthly/yearly vehicles in this request have been twist-lock certified.
      const allVehiclesQuery = `
        SELECT id, "twistLockCertified", "passType", "accessAreaId"
        FROM pass_vehicles
        WHERE "passRequestId" = $1
      `;
      const allVehiclesRes = await pool.query(allVehiclesQuery, [
        passRequestId,
      ]);
      // Only monthly/yearly vehicles strictly require twistLockCertified to advance.
      // Daily oil dock vehicles are certified individually via this same endpoint (twistLockCertified=true).
      // The overall state transition is handled by completePassReview.
      const monthlyYearlyVehicles = allVehiclesRes.rows.filter((v) =>
        ["MONTHLY", "YEARLY", "ANNUAL"].includes(v.passType),
      );
      const allCertified =
        monthlyYearlyVehicles.length === 0 ||
        monthlyYearlyVehicles.every((v) => v.twistLockCertified);

      if (allCertified) {
        const prRes = await pool.query(
          `SELECT "isOilDock" FROM pass_requests WHERE id = $1`,
          [passRequestId],
        );
        const isOilDock = prRes.rows[0]?.isOilDock;

        const nextState = isOilDock
          ? "PENDING_FIRE_SAFETY"
          : "PENDING_PASS_SECTION";

        await pool.query(
          `UPDATE pass_requests SET "workflowState" = $2, "updatedAt" = NOW() WHERE id = $1`,
          [passRequestId, nextState],
        );
      }

      return res.json({
        success: true,
        data: vehicle,
      });
    } else if (isMarineFireSafety) {
      const vehicleCheck = await pool.query(
        `
      SELECT
        pv.*,
        vt.name AS "vehicleTypeName",
        pr."workflowState"
      FROM pass_vehicles pv
      LEFT JOIN vehicle_types vt
        ON vt.id = pv."vehicleTypeId"
      INNER JOIN pass_requests pr
        ON pr.id = pv."passRequestId"
      WHERE pv.id = $1
    `,
        [vehicleId],
      );

      const vehicle = vehicleCheck.rows[0];

      if (!vehicle) {
        return res.status(404).json({
          success: false,
          message: "Vehicle not found",
        });
      }

      const vehicleTypeName = String(vehicle.vehicleTypeName || "")
        .trim()
        .toUpperCase();

      const isTrailerVehicle =
        vehicleTypeName === "TRAILORS" || vehicleTypeName === "TRAILER LORRY";

      const isAnnual =
        String(vehicle.passType || "")
          .trim()
          .toUpperCase() === "YEARLY" ||
        String(vehicle.passType || "")
          .trim()
          .toUpperCase() === "ANNUAL";

      if (!isTrailerVehicle || !isAnnual) {
        return res.status(403).json({
          success: false,
          message:
            "Marine Fire Safety approval is applicable only for Annual Trailers and Trailer Lorry vehicles.",
        });
      }

      if (vehicle.workflowState !== "PENDING_MARINE_SAFETY") {
        return res.status(403).json({
          success: false,
          message: "This vehicle is not pending Marine Fire Safety approval.",
        });
      }

      const updateQuery = `
    UPDATE pass_vehicles
    SET
      "marineSafetyApproved" = true,
      "marineSafetyRemarks" = $2,
      "marineSafetyApprovedBy" = $3,
      "marineSafetyApprovedAt" = NOW(),
      "qrUuid" = CASE
        WHEN "qrUuid" IS NULL
        THEN gen_random_uuid()
        ELSE "qrUuid"
      END,
      "qrIssuedAt" = CASE
        WHEN "qrIssuedAt" IS NULL
        THEN NOW()
        ELSE "qrIssuedAt"
      END,
      "updatedAt" = NOW()
    WHERE id = $1
    RETURNING *
  `;

      const vehicleRes = await pool.query(updateQuery, [
        vehicleId,
        remarks || null,
        req.user?.userId || null,
      ]);

      const approvedVehicle = vehicleRes.rows[0];

      const remainingQuery = `
    SELECT
      pv.id,
      pv.status,
      pv."marineSafetyApproved",
      pv."passType",
      vt.name AS "vehicleTypeName"
    FROM pass_vehicles pv
    LEFT JOIN vehicle_types vt
      ON vt.id = pv."vehicleTypeId"
    WHERE pv."passRequestId" = $1
  `;

      const remainingRes = await pool.query(remainingQuery, [
        approvedVehicle.passRequestId,
      ]);

      const marineVehicles = remainingRes.rows.filter((v) => {
        const typeName = String(v.vehicleTypeName || "")
          .trim()
          .toUpperCase();

        const annual =
          String(v.passType || "")
            .trim()
            .toUpperCase() === "YEARLY" ||
          String(v.passType || "")
            .trim()
            .toUpperCase() === "ANNUAL";

        return (
          (typeName === "TRAILORS" || typeName === "TRAILER LORRY") &&
          annual &&
          v.status !== "rejected" &&
          v.status !== "reverted"
        );
      });

      const allMarineApproved = marineVehicles.every(
        (v) => v.marineSafetyApproved === true,
      );

      if (marineVehicles.length > 0 && allMarineApproved) {
        await pool.query(
          `
        UPDATE pass_requests
        SET
          "workflowState" = 'COMPLETED',
          "status" = 'COMPLETED',
          "updatedAt" = NOW()
        WHERE id = $1
      `,
          [approvedVehicle.passRequestId],
        );
      }

      return res.json({
        success: true,
        data: approvedVehicle,
      });
    } else if (
      (roleId === 27 || role === "Fire Safety Officer") &&
      Number(departmentId) !== 7
    ) {
      const query = `
        UPDATE pass_vehicles
        SET "sparkArresterCertified" = true, "sparkArresterRemarks" = $2, "updatedAt" = NOW()
        WHERE id = $1
        RETURNING *
      `;
      const vehicleRes = await pool.query(query, [vehicleId, remarks || null]);
      const vehicle = vehicleRes.rows[0];
      if (!vehicle) {
        return res
          .status(404)
          .json({ success: false, message: "Vehicle not found" });
      }

      const passRequestId = vehicle.passRequestId;

      const allVehiclesQuery = `
        SELECT id, "sparkArresterCertified", "accessAreaId"
        FROM pass_vehicles
        WHERE "passRequestId" = $1
      `;
      const allVehiclesRes = await pool.query(allVehiclesQuery, [
        passRequestId,
      ]);
      const oilDockVehicles = allVehiclesRes.rows.filter((v) =>
        isOilDockArea(v.accessAreaId),
      );
      const allCertified = oilDockVehicles.every(
        (v) => v.sparkArresterCertified,
      );

      if (allCertified) {
        await pool.query(
          `UPDATE pass_requests SET "workflowState" = 'PENDING_SR_DTM', "updatedAt" = NOW() WHERE id = $1`,
          [passRequestId],
        );
      }

      return res.json({
        success: true,
        data: vehicle,
      });
    } else if (roleId === 28 || role === "Senior Deputy Traffic Manager") {
      const query = `
        UPDATE pass_vehicles
        SET "srDtmApproved" = true, "srDtmRemarks" = $2, "updatedAt" = NOW()
        WHERE id = $1
        RETURNING *
      `;
      const vehicleRes = await pool.query(query, [vehicleId, remarks || null]);
      const vehicle = vehicleRes.rows[0];
      if (!vehicle) {
        return res
          .status(404)
          .json({ success: false, message: "Vehicle not found" });
      }

      const passRequestId = vehicle.passRequestId;

      // Check if ALL oil dock vehicles in this request have been srDtmApproved
      const allVehiclesQuery = `
        SELECT id, "srDtmApproved", "accessAreaId"
        FROM pass_vehicles
        WHERE "passRequestId" = $1
      `;
      const allVehiclesRes = await pool.query(allVehiclesQuery, [
        passRequestId,
      ]);
      const oilDockVehicles = allVehiclesRes.rows.filter((v) =>
        isOilDockArea(v.accessAreaId),
      );
      const allApproved = oilDockVehicles.every((v) => v.srDtmApproved);

      if (allApproved) {
        // Update workflow state — Pass Section query now uses per-entity flags directly
        await pool.query(
          `UPDATE pass_requests SET "workflowState" = 'PENDING_PASS_SECTION', "updatedAt" = NOW() WHERE id = $1`,
          [passRequestId],
        );
      }

      return res.json({
        success: true,
        data: vehicle,
      });
    } else {
      const vehicle = await PassRequest.approveVehicle(vehicleId);
      return res.json({
        success: true,
        data: vehicle,
      });
    }
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const rejectVehicle = async (req, res) => {
  try {
    const { vehicleId, rejectedReason } = req.body;

    const vehicle = await PassRequest.rejectVehicle(vehicleId, rejectedReason);

    return res.json({
      success: true,
      data: vehicle,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const revertPerson = async (req, res) => {
  try {
    const { personId, revertReason } = req.body;

    if (!revertReason) {
      return res.status(400).json({
        success: false,
        message: "Revert reason is required",
      });
    }

    const person = await PassRequest.revertPerson(personId, revertReason);

    return res.json({
      success: true,
      data: person,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const revertVehicle = async (req, res) => {
  try {
    const { vehicleId, revertReason } = req.body;

    if (!revertReason) {
      return res.status(400).json({
        success: false,
        message: "Revert reason is required",
      });
    }

    const vehicle = await PassRequest.revertVehicle(vehicleId, revertReason);

    return res.json({
      success: true,
      data: vehicle,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const completeReview = async (req, res) => {
  try {
    const { passRequestId } = req.body;
    const userId = req.user ? req.user.userId : null;
    const role = req.user ? req.user.role : null;
    const roleId = req.user ? req.user.roleId : null;
    const result = await PassRequest.completePassReview(
      passRequestId,
      userId,
      role,
      roleId,
    );

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// const getQrData = async (req, res) => {
//   try {

//     const { passRequestId } = req.params;

//     const data = await passRequestService.getQrData(passRequestId);

//     return res.json(data);

//   } catch (error) {

//     console.error("QR DATA ERROR", error);

//     return res.status(500).json({
//       success:false,
//       message:error.message
//     });

//   }
// };

const getQrData = async (req, res) => {
  try {
    const { passRequestId } = req.params;

    // NEW
    const { type, entityId } = req.query;

    const data = await passRequestService.getQrData(
      passRequestId,
      type,
      entityId,
    );

    return res.json(data);
  } catch (error) {
    console.error("QR DATA ERROR", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getVendorQrData = async (req, res) => {
  try {
    const { vendorPassId } = req.params;

    const data = await passRequestService.getVendorQrData(vendorPassId);

    return res.json(data);
  } catch (error) {
    console.error("VENDOR QR DATA ERROR", error);

    if (error.message === "No approved vendor pass found") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getPassDetails = async (req, res) => {
  try {
    const { passRequestId } = req.params;

    const passData = await getAgentPassRequestsDetails.getPassById(
      passRequestId,
      req.user.role,
    );

    if (!passData) {
      return res.status(404).json({
        success: false,
        message: "Pass request not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: passData,
    });
  } catch (error) {
    console.error("GET PASS DETAILS ERROR", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================
// PHASE 2: EDIT AND RESUBMIT REVERTED PASSES
// ============================================

const updatePassPerson = async (req, res) => {
  try {
    const { personId } = req.params;
    const updateData = req.body;

    // Attach files if any
    const files = req.files || {};
    const attachFile = (entry, fieldName, pathKey, nameKey) => {
      const f = files[fieldName]?.[0];
      if (f) {
        entry[pathKey] = f.path;
        entry[nameKey] = f.originalname;
      }
    };

    attachFile(updateData, "personPhoto", "photoFilePath", "photoFileName");
    attachFile(
      updateData,
      "personAadhar",
      "aadharPDFFilePATH",
      "aadharPDFFileName",
    );
    attachFile(
      updateData,
      "personIdProof",
      "idProofFilePath",
      "idProofFileName",
    );
    attachFile(
      updateData,
      "driverLicense",
      "driverLicensePath",
      "driverLicenseName",
    );
    attachFile(
      updateData,
      "requisitionLetter",
      "requisitionLetterPath",
      "requisitionLetterName",
    );
    attachFile(
      updateData,
      "policeVerification",
      "policeVerificationPath",
      "policeVerificationName",
    );
    attachFile(
      updateData,
      "employmentProof",
      "employmentProofPath",
      "employmentProofName",
    );
    attachFile(
      updateData,
      "chaLicenseCopy",
      "chaLicensePath",
      "chaLicenseName",
    );
    attachFile(updateData, "passportDoc", "passportPath", "passportName");
    attachFile(updateData, "visaDoc", "visaDocPath", "visaDocName");
    attachFile(
      updateData,
      "immigrationDoc",
      "immigrationDocPath",
      "immigrationDocName",
    );
    attachFile(updateData, "cdcDocument", "cdcDocumentPath", "cdcDocumentName");
    attachFile(
      updateData,
      "entryAuthorization",
      "entryAuthorizationFilePath",
      "entryAuthorizationFileName",
    );

    if (updateData.designation) {
      if (
        updateData.designation === "Crew" ||
        updateData.designation === "Supernumerary" ||
        updateData.designation === "Others"
      ) {
        updateData.designationId = null;
        updateData.designationOther =
          updateData.designationOther || updateData.designation;
      } else {
        updateData.designationId = parseInt(updateData.designation, 10) || null;
      }
    }

    if (updateData.nationality) {
      if (
        updateData.nationality === "1" ||
        String(updateData.nationality).toUpperCase().includes("IND")
      ) {
        updateData.nationality = "INDIAN";
      } else if (
        updateData.nationality === "2" ||
        String(updateData.nationality).toUpperCase().includes("FOR")
      ) {
        updateData.nationality = "FOREIGNER";
      }
    }

    if (updateData.withTwoWheeler !== undefined) {
      updateData.withTwoWheeler =
        updateData.withTwoWheeler === true ||
        updateData.withTwoWheeler === "true";
    }

    const { PassRequest } = require("../models/passRequestSchema");

    const result = await PassRequest.updateRevertedPerson(personId, updateData);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Person updated successfully",
      data: result.data,
    });
  } catch (error) {
    console.error("UPDATE PASS PERSON ERROR", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const updatePassVehicle = async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const updateData = req.body;

    console.log("UPDATE VEHICLE - vehicleId:", vehicleId);
    console.log("UPDATE VEHICLE - updateData:", updateData);

    // Attach files if any
    const files = req.files || {};
    const attachFile = (entry, fieldName, pathKey, nameKey) => {
      const f = files[fieldName]?.[0];
      if (f) {
        entry[pathKey] = f.path;
        entry[nameKey] = f.originalname;
      }
    };

    attachFile(
      updateData,
      "vehicleRC",
      "scannedCopyFilePath",
      "scannedCopyFileName",
    );
    attachFile(
      updateData,
      "vehicleInsurance",
      "insuranceFilePath",
      "insuranceFileName",
    );
    attachFile(updateData, "vehiclePermit", "permitFilePath", "permitFileName");
    attachFile(
      updateData,
      "vehicleFitness",
      "fitnessFilePath",
      "fitnessFileName",
    );
    attachFile(
      updateData,
      "vehicleRequestLetter",
      "requestLetterPath",
      "requestLetterName",
    );
    attachFile(updateData, "vehicleTax", "taxDocPath", "taxDocName");
    attachFile(
      updateData,
      "vehicleEmission",
      "emissionCertPath",
      "emissionCertName",
    );
    attachFile(
      updateData,
      "sparkArrester",
      "sparkArresterFilePath",
      "sparkArresterFileName",
    );
    attachFile(
      updateData,
      "twistLock",
      "twistLockFilePath",
      "twistLockFileName",
    );

    const { PassRequest } = require("../models/passRequestSchema");

    const result = await PassRequest.updateRevertedVehicle(
      vehicleId,
      updateData,
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Vehicle updated successfully",
      data: result.data,
    });
  } catch (error) {
    console.error("UPDATE PASS VEHICLE ERROR", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const resubmitRevertedPass = async (req, res) => {
  try {
    const { passRequestId } = req.params;

    const { PassRequest } = require("../models/passRequestSchema");

    const result = await PassRequest.resubmitRevertedPassRequest(passRequestId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Pass resubmitted successfully",
      data: result.data,
    });
  } catch (error) {
    console.error("RESUBMIT REVERTED PASS ERROR", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const validateQrPass = async (req, res) => {
  try {
    const { passNo } = req.params;
    if (!passNo) {
      return res.status(400).json({
        success: false,
        message: "passNo is required",
      });
    }

    const now = new Date();

    // 1. Try normal pass persons
    const personQuery = `
      SELECT pp.id, pp.name, pp.mobile, pp."aadharNo", pp."personPassNo",
             pp."dateFrom", pp."dateTo", pp.status,
             a."entityName" AS company,
             'person' AS entityType,
             pr."referenceNo"
      FROM pass_persons pp
      JOIN pass_requests pr ON pr.id = pp."passRequestId"
      JOIN "Agents" a ON a.id = pr."agentId"
      WHERE pp."personPassNo" = $1
    `;
    const personResult = await pool.query(personQuery, [passNo]);
    if (personResult.rows.length > 0) {
      const row = personResult.rows[0];
      if (row.status !== "approved") {
        return res.status(403).json({
          success: false,
          valid: false,
          message: "Pass is not approved",
          data: { status: row.status },
        });
      }
      if (row.dateTo && new Date(row.dateTo) < now) {
        return res.status(403).json({
          success: false,
          valid: false,
          message: "Pass has expired",
          data: { validTo: row.dateTo },
        });
      }
      return res.status(200).json({
        success: true,
        valid: true,
        message: "Pass is valid",
        data: {
          entityType: "person",
          passNo: row.personPassNo,
          name: row.name,
          company: row.company,
          referenceNo: row.referenceNo,
          validFrom: row.dateFrom,
          validTo: row.dateTo,
        },
      });
    }

    // 2. Try normal pass vehicles
    const vehicleQuery = `
      SELECT pv.id, pv."registrationNo", pv."vehiclePassNo",
             pv."dateFrom", pv."dateTo", pv.status,
             a."entityName" AS company,
             'vehicle' AS entityType,
             pr."referenceNo"
      FROM pass_vehicles pv
      JOIN pass_requests pr ON pr.id = pv."passRequestId"
      JOIN "Agents" a ON a.id = pr."agentId"
      WHERE pv."vehiclePassNo" = $1
    `;
    const vehicleResult = await pool.query(vehicleQuery, [passNo]);
    if (vehicleResult.rows.length > 0) {
      const row = vehicleResult.rows[0];
      if (row.status !== "approved") {
        return res.status(403).json({
          success: false,
          valid: false,
          message: "Pass is not approved",
          data: { status: row.status },
        });
      }
      if (row.dateTo && new Date(row.dateTo) < now) {
        return res.status(403).json({
          success: false,
          valid: false,
          message: "Pass has expired",
          data: { validTo: row.dateTo },
        });
      }
      return res.status(200).json({
        success: true,
        valid: true,
        message: "Pass is valid",
        data: {
          entityType: "vehicle",
          passNo: row.vehiclePassNo,
          registrationNo: row.registrationNo,
          company: row.company,
          referenceNo: row.referenceNo,
          validFrom: row.dateFrom,
          validTo: row.dateTo,
        },
      });
    }

    // 3. Try vendor pass persons
    const vpPersonQuery = `
      SELECT vp.id, vp.name, vp.mobile, vp."aadharNo", vp."personPassNo",
             vp."dateFrom", vp."dateTo", vp.status,
             vpr."companyName" AS company,
             'vendor-person' AS entityType,
             vpr."referenceNo"
      FROM vendor_pass_persons vp
      JOIN vendor_pass_requests vpr ON vpr.id = vp."vendorPassRequestId"
      WHERE vp."personPassNo" = $1
    `;
    const vpPersonResult = await pool.query(vpPersonQuery, [passNo]);
    if (vpPersonResult.rows.length > 0) {
      const row = vpPersonResult.rows[0];
      if (row.status !== "approved") {
        return res.status(403).json({
          success: false,
          valid: false,
          message: "Pass is not approved",
          data: { status: row.status },
        });
      }
      if (row.dateTo && new Date(row.dateTo) < now) {
        return res.status(403).json({
          success: false,
          valid: false,
          message: "Pass has expired",
          data: { validTo: row.dateTo },
        });
      }
      return res.status(200).json({
        success: true,
        valid: true,
        message: "Pass is valid",
        data: {
          entityType: "vendor-person",
          passNo: row.personPassNo,
          name: row.name,
          company: row.company,
          referenceNo: row.referenceNo,
          validFrom: row.dateFrom,
          validTo: row.dateTo,
        },
      });
    }

    // 4. Try vendor pass vehicles
    const vpVehicleQuery = `
      SELECT vv.id, vv."vehicleRegistrationNo", vv."vehiclePassNo",
             vv."dateFrom", vv."dateTo", vv.status,
             vpr."companyName" AS company,
             'vendor-vehicle' AS entityType,
             vpr."referenceNo"
      FROM vendor_pass_vehicles vv
      JOIN vendor_pass_requests vpr ON vpr.id = vv."vendorPassRequestId"
      WHERE vv."vehiclePassNo" = $1
    `;
    const vpVehicleResult = await pool.query(vpVehicleQuery, [passNo]);
    if (vpVehicleResult.rows.length > 0) {
      const row = vpVehicleResult.rows[0];
      if (row.status !== "approved") {
        return res.status(403).json({
          success: false,
          valid: false,
          message: "Pass is not approved",
          data: { status: row.status },
        });
      }
      if (row.dateTo && new Date(row.dateTo) < now) {
        return res.status(403).json({
          success: false,
          valid: false,
          message: "Pass has expired",
          data: { validTo: row.dateTo },
        });
      }
      return res.status(200).json({
        success: true,
        valid: true,
        message: "Pass is valid",
        data: {
          entityType: "vendor-vehicle",
          passNo: row.vehiclePassNo,
          registrationNo: row.vehicleRegistrationNo,
          company: row.company,
          referenceNo: row.referenceNo,
          validFrom: row.dateFrom,
          validTo: row.dateTo,
        },
      });
    }

    // Pass not found
    return res.status(404).json({
      success: false,
      valid: false,
      message: "Pass not found",
    });
  } catch (error) {
    console.error("validateQrPass error:", error);
    return res.status(500).json({
      success: false,
      valid: false,
      message: error.message,
    });
  }
};

const saveQrPdfPath = async (req, res) => {
  try {
    const { type, entityId, qrPdfPath } = req.body;

    const result = await passRequestService.saveQrPdfPath(
      type,
      entityId,
      qrPdfPath,
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error("SAVE QR PDF PATH ERROR", err);

    return res.status(500).json({
      success: false,
      message: "Failed to save qr pdf path",
    });
  }
};

const validateSecureQr = async (req, res) => {
  try {
    const { entityId, passRequestId, qrUuid, type } = req.body;

    if (!entityId || !passRequestId || !qrUuid || !type) {
      return res.status(400).json({
        success: false,
        message: "Missing validation payload",
      });
    }

    const result = await passRequestService.validateQr({
      entityId,
      passRequestId,
      qrUuid,
      type,
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("VALIDATE QR ERROR", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const submitTwoWheelerUpdate = async (req, res) => {
  try {
    const { personId, passRequestId, newVehicleNo, reason } = req.body;
    if (!personId || !newVehicleNo) {
      return res.status(400).json({
        success: false,
        message: "Person ID and new vehicle number are required.",
      });
    }

    // Vehicle Number Regex Validation (Indian vehicle registration number)
    const vehicleNoClean = newVehicleNo.toUpperCase().trim();
    const vehicleRegex =
      /^[A-Z]{2}[-\s]?[0-9]{1,2}[-\s]?[A-Z]{1,3}[-\s]?[0-9]{1,4}$/i;
    if (!vehicleRegex.test(vehicleNoClean)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid two-wheeler vehicle number format. Valid examples: MH01AB1234, KA-02-C-5678.",
      });
    }

    // Fetch person details
    let personRes = await pool.query(
      `SELECT * FROM pass_persons WHERE id = $1`,
      [personId],
    );
    let isVendor = false;
    if (personRes.rows.length === 0) {
      personRes = await pool.query(
        `SELECT * FROM vendor_pass_persons WHERE id = $1`,
        [personId],
      );
      isVendor = true;
    }

    if (personRes.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Person record not found." });
    }

    const person = personRes.rows[0];

    // Check Annual/Yearly pass type
    const passTypeStr = String(person.passType || "").toUpperCase();
    const isAnnual =
      passTypeStr === "YEARLY" ||
      passTypeStr === "ANNUAL" ||
      passTypeStr === "3";
    if (!isAnnual) {
      return res.status(400).json({
        success: false,
        message:
          "Two-wheeler number update is only permitted for Annual/Yearly passes.",
      });
    }

    // Check two wheeler enablement
    const hasTwoWheeler =
      person.withTwoWheeler === true ||
      String(person.withTwoWheeler) === "true";
    if (!hasTwoWheeler) {
      return res.status(400).json({
        success: false,
        message: "Two-wheeler pass was not availed for this person.",
      });
    }

    // Check 3-change limit
    const changeCount = parseInt(person.twoWheelerChangeCount || 0, 10);
    if (changeCount >= 3) {
      return res.status(400).json({
        success: false,
        message:
          "You have changed the two-wheeler number 3 times already this year, so you cannot change it again.",
      });
    }

    // Check pending request lock
    const pendingCheck = await pool.query(
      `SELECT * FROM two_wheeler_change_requests WHERE "personId" = $1 AND status = 'PENDING'`,
      [personId],
    );
    if (pendingCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          "A two-wheeler update request for this person is already under review by the Pass Section.",
      });
    }

    // Get company name and email
    let companyName = "";
    let email = "";
    const targetPassId = passRequestId || person.passRequestId;
    if (targetPassId) {
      if (isVendor) {
        const vpRes = await pool.query(
          `SELECT email, "companyName" FROM vendor_pass_requests WHERE id = $1`,
          [targetPassId],
        );
        if (vpRes.rows.length > 0) {
          companyName = vpRes.rows[0].companyName || "";
          email = vpRes.rows[0].email || "";
        }
      } else {
        const prRes = await pool.query(
          `SELECT a.email, a."entityName" FROM pass_requests pr JOIN "Agents" a ON pr."agentId" = a.id WHERE pr.id = $1`,
          [targetPassId],
        );
        if (prRes.rows.length > 0) {
          companyName = prRes.rows[0].entityName || "";
          email = prRes.rows[0].email || "";
        }
      }
    }

    // Insert update request
    const insertRes = await pool.query(
      `INSERT INTO two_wheeler_change_requests 
       ("passRequestId", "personId", "isVendorPass", "personName", "personPassNo", "companyName", "oldVehicleNo", "newVehicleNo", "reason", "status", "changeCount", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING', $10, NOW(), NOW())
       RETURNING *`,
      [
        passRequestId || person.passRequestId || null,
        personId,
        isVendor,
        person.name,
        person.personPassNo || "",
        companyName,
        person.vehicleNo || "",
        vehicleNoClean,
        reason || "Two-wheeler vehicle number change",
        changeCount + 1,
      ],
    );

    if (email) {
      setImmediate(() => {
        sendEmailEvent({
          type: "TWO_WHEELER_UPDATE_SUBMITTED",
          email,
          name: companyName,
          referenceNumber: person.personPassNo || `REQ-${targetPassId}`,
          oldVehicleNo: person.vehicleNo || "N/A",
          newVehicleNo: vehicleNoClean,
          rejectedReason: null,
        }).catch((err) =>
          console.error("Email notification error:", err.message),
        );
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Two-wheeler update request submitted successfully for approval.",
      data: insertRes.rows[0],
    });
  } catch (error) {
    console.error("submitTwoWheelerUpdate error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getTwoWheelerUpdateRequests = async (req, res) => {
  try {
    const { status } = req.query;
    let query = `SELECT * FROM two_wheeler_change_requests`;
    let params = [];
    if (status) {
      query += ` WHERE status = $1`;
      params.push(status);
    }
    query += ` ORDER BY id DESC`;

    const result = await pool.query(query, params);
    return res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error("getTwoWheelerUpdateRequests error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const approveTwoWheelerUpdate = async (req, res) => {
  try {
    const { id } = req.params;
    const reqRes = await pool.query(
      `SELECT * FROM two_wheeler_change_requests WHERE id = $1`,
      [id],
    );
    if (reqRes.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Update request not found." });
    }

    const changeReq = reqRes.rows[0];
    if (changeReq.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: `Request is already ${changeReq.status}`,
      });
    }

    // Update person vehicleNo & twoWheelerChangeCount
    const table = changeReq.isVendorPass
      ? "vendor_pass_persons"
      : "pass_persons";
    await pool.query(
      `UPDATE ${table} 
       SET "vehicleNo" = $1, "twoWheelerChangeCount" = COALESCE("twoWheelerChangeCount", 0) + 1, "updatedAt" = NOW()
       WHERE id = $2`,
      [changeReq.newVehicleNo, changeReq.personId],
    );

    // Update change request status
    await pool.query(
      `UPDATE two_wheeler_change_requests SET status = 'APPROVED', "updatedAt" = NOW() WHERE id = $1`,
      [id],
    );

    // Send Approval Email Notification
    if (changeReq.passRequestId) {
      let email = "";
      if (changeReq.isVendorPass) {
        const vpRes = await pool.query(
          `SELECT email FROM vendor_pass_requests WHERE id = $1`,
          [changeReq.passRequestId],
        );
        if (vpRes.rows.length > 0) email = vpRes.rows[0].email || "";
      } else {
        const prRes = await pool.query(
          `SELECT a.email FROM pass_requests pr JOIN "Agents" a ON pr."agentId" = a.id WHERE pr.id = $1`,
          [changeReq.passRequestId],
        );
        if (prRes.rows.length > 0) email = prRes.rows[0].email || "";
      }

      if (email) {
        setImmediate(() => {
          sendEmailEvent({
            type: "TWO_WHEELER_UPDATE_APPROVED",
            email,
            name: changeReq.companyName,
            referenceNumber:
              changeReq.personPassNo || `REQ-${changeReq.passRequestId}`,
            oldVehicleNo: changeReq.oldVehicleNo || "N/A",
            newVehicleNo: changeReq.newVehicleNo,
            rejectedReason: null,
          }).catch((err) =>
            console.error("Email notification error:", err.message),
          );
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Two-wheeler number update approved successfully.",
    });
  } catch (error) {
    console.error("approveTwoWheelerUpdate error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const rejectTwoWheelerUpdate = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectedReason } = req.body;
    const reqRes = await pool.query(
      `SELECT * FROM two_wheeler_change_requests WHERE id = $1`,
      [id],
    );
    if (reqRes.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Update request not found." });
    }

    const changeReq = reqRes.rows[0];
    if (changeReq.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: `Request is already ${changeReq.status}`,
      });
    }

    const finalReason = rejectedReason || "Request rejected by approver";
    await pool.query(
      `UPDATE two_wheeler_change_requests SET status = 'REJECTED', "rejectedReason" = $1, "updatedAt" = NOW() WHERE id = $2`,
      [finalReason, id],
    );

    // Send Rejection Email Notification
    if (changeReq.passRequestId) {
      let email = "";
      if (changeReq.isVendorPass) {
        const vpRes = await pool.query(
          `SELECT email FROM vendor_pass_requests WHERE id = $1`,
          [changeReq.passRequestId],
        );
        if (vpRes.rows.length > 0) email = vpRes.rows[0].email || "";
      } else {
        const prRes = await pool.query(
          `SELECT a.email FROM pass_requests pr JOIN "Agents" a ON pr."agentId" = a.id WHERE pr.id = $1`,
          [changeReq.passRequestId],
        );
        if (prRes.rows.length > 0) email = prRes.rows[0].email || "";
      }

      if (email) {
        setImmediate(() => {
          sendEmailEvent({
            type: "TWO_WHEELER_UPDATE_REJECTED",
            email,
            name: changeReq.companyName,
            referenceNumber:
              changeReq.personPassNo || `REQ-${changeReq.passRequestId}`,
            oldVehicleNo: changeReq.oldVehicleNo || "N/A",
            newVehicleNo: changeReq.newVehicleNo,
            rejectedReason: finalReason,
          }).catch((err) =>
            console.error("Email notification error:", err.message),
          );
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Two-wheeler update request rejected.",
    });
  } catch (error) {
    console.error("rejectTwoWheelerUpdate error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updatePersonStatus = async (req, res) => {
  try {
    // if (!req.user || !req.user.userId) {
    //   return res.status(401).json({
    //     success: false,
    //     message: "Unauthorized"
    //   });
    // }

    const agentId = req.user.userId;

    const { masterPersonId, isActive } = req.body;

    const result = await Master.updatePersonStatus(
      agentId,
      masterPersonId,
      isActive,
    );

    if (!result.success) {
      return res.status(404).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Update Person Status Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const updateVehicleStatus = async (req, res) => {
  try {
    // if (!req.user || !req.user.userId) {
    //   return res.status(401).json({
    //     success: false,
    //     message: "Unauthorized"
    //   });
    // }

    const agentId = req.user.userId;

    const { masterVehicleId, isActive } = req.body;

    const result = await Master.updateVehicleStatus(
      agentId,
      masterVehicleId,
      isActive,
    );

    if (!result.success) {
      return res.status(404).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Update Vehicle Status Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const disablePersonPass = async (req, res) => {
  try {
    const agentId = req.user.userId;

    const { passPersonId, reason } = req.body;

    if (!passPersonId || !reason) {
      return res.status(400).json({
        success: false,
        message: "Pass Person ID and reason are required",
      });
    }

    const result = await getPassRequest.disablePersonPass(
      agentId,
      passPersonId,
      reason,
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

const getDisabledPasses = async (req, res) => {
  try {
    const agentId = req.user.userId;

    const result = await getPassRequest.getDisabledPasses(agentId);

    return res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

const disableVehiclePass = async (req, res) => {
  try {
    const agentId = req.user.userId;

    const { passVehicleId, reason } = req.body;

    if (!passVehicleId || !reason) {
      return res.status(400).json({
        success: false,
        message: "Pass Vehicle ID and reason are required",
      });
    }

    const result = await getPassRequest.disableVehiclePass(
      agentId,
      passVehicleId,
      reason,
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

const enablePersonPass = async (req, res) => {
  try {
    const { passPersonId } = req.body;

    if (!passPersonId) {
      return res.status(400).json({
        success: false,
        message: "passPersonId is required.",
      });
    }

    const agentId = req.user?.id || req.user?.userId;

    const result = await getPassRequest.enablePersonPass(agentId, passPersonId);

    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error("Enable person pass error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Unable to enable person pass.",
    });
  }
};

const enableVehiclePass = async (req, res) => {
  try {
    const { passVehicleId } = req.body;

    if (!passVehicleId) {
      return res.status(400).json({
        success: false,
        message: "passVehicleId is required.",
      });
    }

    const agentId = req.user?.id || req.user?.userId;

    const result = await getPassRequest.enableVehiclePass(
      agentId,
      passVehicleId,
    );

    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error("Enable vehicle pass error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Unable to enable vehicle pass.",
    });
  }
};

const getMarineSafetyPassRequests = async (req, res) => {
  try {
    const userId = Number(req.user?.userId ?? req.user?.id);

    if (!Number.isInteger(userId)) {
      return res.status(401).json({
        success: false,
        message: "Unable to identify logged-in user.",
      });
    }

    const {
      page = 1,
      limit = 20,
      status = "pending",
      search = "",
      sortOrder = "DESC",
    } = req.query;

    console.log("========== MARINE SAFETY REQUEST ==========");
    console.log("Marine user ID :", userId);
    console.log("Status         :", status);
    console.log("Search         :", search);
    console.log("============================================");

    const result = await getPassRequest.getMarineSafetyPassRequests({
      userId,
      page,
      limit,
      status,
      search,
      sortOrder,
    });

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Marine safety pass request error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

const approveMarineSafetyVehicle = async (req, res) => {
  try {
    const role = req.user?.role;
    const departmentId = Number(req.user?.departmentId);

    if (role !== "Fire Safety Officer" || departmentId !== 7) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const { vehicleId, remarks } = req.body;

    if (!vehicleId) {
      return res.status(400).json({
        success: false,
        message: "vehicleId is required",
      });
    }

    const result = await PassRequest.approveMarineSafetyVehicle(
      vehicleId,
      req.user.userId,
      remarks,
    );

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("MARINE SAFETY APPROVAL ERROR", error);

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const rejectMarineSafetyVehicle = async (req, res) => {
  try {
    const role = req.user?.role;
    const departmentId = Number(req.user?.departmentId);

    if (role !== "Fire Safety Officer" || departmentId !== 7) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const { vehicleId, rejectedReason } = req.body;

    if (!vehicleId) {
      return res.status(400).json({
        success: false,
        message: "vehicleId is required",
      });
    }

    if (!rejectedReason?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
    }
    const userId = Number(req.user?.userId ?? req.user?.id);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authenticated user ID is missing",
      });
    }

    const vehicle = await PassRequest.rejectMarineSafetyVehicle(
      vehicleId,
      rejectedReason.trim(),
      userId,
    );

    return res.status(200).json({
      success: true,
      data: vehicle,
    });
  } catch (error) {
    console.error("MARINE SAFETY REJECT ERROR:", error);

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const revertMarineSafetyVehicle = async (req, res) => {
  try {
    const role = req.user?.role;
    const departmentId = Number(req.user?.departmentId);

    if (role !== "Fire Safety Officer" || departmentId !== 7) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const { vehicleId, revertReason } = req.body;

    if (!vehicleId) {
      return res.status(400).json({
        success: false,
        message: "vehicleId is required",
      });
    }

    if (!revertReason?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Revert reason is required",
      });
    }

    const userId = Number(req.user?.userId ?? req.user?.id);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authenticated user ID is missing",
      });
    }

    const vehicle = await PassRequest.revertMarineSafetyVehicle(
      vehicleId,
      revertReason.trim(),
      userId,
    );

    return res.status(200).json({
      success: true,
      data: vehicle,
    });
  } catch (error) {
    console.error("MARINE SAFETY REVERT ERROR:", error);

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const getEssentialOilDockStage = (req) => {
  const role = String(req.user?.role || "").trim();
  const departmentId = Number(req.user?.departmentId);

  if (
    departmentId === 7 &&
    ["Dy. Conservator", "Fire Safety Officer"].includes(role)
  ) {
    return "PENDING_MARINE_ESSENTIAL";
  }

  if (role === "Approval" && departmentId === 3) {
    return "PENDING_CIVIL_ESSENTIAL";
  }

  if (role === "Approval" && departmentId === 4) {
    return "PENDING_MECHANICAL_ESSENTIAL";
  }

  if (
    [
      "CISF",
      "CISF Asst Commandant",
      "CISF Assistant Commandant",
      "Cisf.Assistant Commandant",
    ].includes(role)
  ) {
    return "PENDING_CISF_ESSENTIAL";
  }

  if (role === "Approval" && departmentId === 9) {
    return "PENDING_PASS_SECTION_ESSENTIAL";
  }

  return null;
};

const getEssentialOilDockPassRequests = async (req, res) => {
  try {
    const stage = getEssentialOilDockStage(req);

    if (!stage) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized for the Essential Oil Dock workflow.",
      });
    }

    // const result = await PassRequest.getEssentialOilDockPassRequests({
    //   userId: Number(req.user?.userId ?? req.user?.id),
    //   stage,
    //   status: req.query.status || "pending",
    //   page: req.query.page || 1,
    //   limit: req.query.limit || 20,
    //   search: req.query.search || "",
    //   sortOrder: req.query.sortOrder || "DESC",
    // });

    const result = await PassRequest.getEssentialOilDockPassRequests({
      userId: Number(req.user?.userId ?? req.user?.id),
      roleId: Number(req.user?.roleId),
      departmentId: Number(req.user?.departmentId),
      stage,
      status: req.query.status || "pending",
      page: req.query.page || 1,
      limit: req.query.limit || 20,
      search: req.query.search || "",
      sortOrder: req.query.sortOrder || "DESC",
    });

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("ESSENTIAL OIL DOCK FETCH ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const essentialOilDockVehicleAction = async (req, res) => {
  try {
    const stage = getEssentialOilDockStage(req);
    console.log("ESSENTIAL VEHICLE ACTION REQUEST:", {
      userId: req.user?.userId ?? req.user?.id,
      role: req.user?.role,
      departmentId: req.user?.departmentId,
      stage,
      body: req.body,
    });

    if (!stage) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized for the Essential Oil Dock workflow.",
      });
    }

    const { vehicleId, decision, rejectedReason, revertReason, remarks } =
      req.body;

    if (!vehicleId || !decision) {
      return res.status(400).json({
        success: false,
        message: "vehicleId and decision are required",
      });
    }

    const userId = Number(req.user?.userId ?? req.user?.id);
    console.log("ESSENTIAL ACTION IDENTITY CHECK:", {
      userId,
      roleId: req.user?.roleId,
      role: req.user?.role,
      departmentId: req.user?.departmentId,
      stage,
      vehicleId,
      decision,
    });

    const result = await PassRequest.actionEssentialOilDockVehicle({
      vehicleId,
      stage,
      decision: String(decision).toUpperCase(),
      remarks: rejectedReason || revertReason || remarks || null,
      userId,
      roleId: req.user?.roleId || null,
      departmentId: Number(req.user?.departmentId) || null,
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("ESSENTIAL OIL DOCK ACTION ERROR:", error);

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const getEssentialOilDockPersonPassRequests = async (req, res) => {
  try {
    const workflow = getEssentialOilDockPersonStage(req);

    if (!workflow) {
      return res.status(403).json({
        success: false,
        message:
          "You are not authorized for the Essential person workflow.",
      });
    }

    const result =
      await PassRequest.getEssentialOilDockPersonPassRequests({
        userId: workflow.assignedUserId,
        departmentId: Number(req.user?.departmentId),
        stage: workflow.stage,
        status: req.query.status || "pending",
        page: req.query.page || 1,
        limit: req.query.limit || 20,
        search: req.query.search || "",
        sortOrder: req.query.sortOrder || "DESC",
      });

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error(
      "ESSENTIAL OIL DOCK PERSON FETCH ERROR:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getEssentialOilDockPersonStage = (req) => {
  const role = String(req.user?.role || "").trim();
  const departmentId = Number(req.user?.departmentId);
  const userId = Number(req.user?.userId ?? req.user?.id);

  // Civil
  if (
    role === "Approval" &&
    departmentId === 3
  ) {
    return {
      stage: "PENDING_CIVIL_PERSON_ESSENTIAL",
      assignedUserId: userId,
    };
  }

  // Mechanical
  if (
    role === "Approval" &&
    departmentId === 4
  ) {
    return {
      stage: "PENDING_MECHANICAL_PERSON_ESSENTIAL",
      assignedUserId: userId,
    };
  }

  // Traffic / Pass Section
  if (
    role === "Approval" &&
    departmentId === 9
  ) {
    return {
      stage: "PENDING_TRAFFIC_PERSON_ESSENTIAL",
      assignedUserId: userId,
    };
  }

  return null;
};

const essentialOilDockPersonAction = async (req, res) => {
  try {
    const workflowStage = getEssentialOilDockStage(req);

    if (!workflowStage) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized for the Essential Oil Dock workflow.",
      });
    }

    const personStageMap = {
      PENDING_CIVIL_ESSENTIAL: "PENDING_CIVIL_PERSON_ESSENTIAL",
      PENDING_MECHANICAL_ESSENTIAL: "PENDING_MECHANICAL_PERSON_ESSENTIAL",
      PENDING_PASS_SECTION_ESSENTIAL: "PENDING_TRAFFIC_PERSON_ESSENTIAL",
    };

    const stage = personStageMap[workflowStage];

    if (!stage) {
      return res.status(403).json({
        success: false,
        message:
          "You are not authorized for the Essential Oil Dock person workflow.",
      });
    }

    const { personId, decision, rejectedReason, revertReason, remarks } =
      req.body;

    if (!personId || !decision) {
      return res.status(400).json({
        success: false,
        message: "personId and decision are required",
      });
    }

    const userId = Number(req.user?.userId ?? req.user?.id);

    const result = await PassRequest.actionEssentialOilDockPerson({
      personId,
      stage,
      decision: String(decision).trim().toUpperCase(),
      remarks: rejectedReason || revertReason || remarks || null,
      userId,
      roleId: req.user?.roleId || null,
      departmentId: Number(req.user?.departmentId) || null,
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("ESSENTIAL OIL DOCK PERSON ACTION ERROR:", error);

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getNationalities,
  getPassTypes,
  getIdProofTypes,
  getAccessAreas,
  getVisitPurposes,
  getDesignations,
  getvehicleTypes,
  createPassRequest,
  getHepTypes,
  getCountries,
  getStates,
  getCities,
  getAgentPassRequests,
  getMasterDirectory,
  getAgentPassRequestsToApproverAdmin,
  viewPassRequestsDocument,
  approvePerson,
  rejectPerson,
  revertPerson,
  approveVehicle,
  rejectVehicle,
  revertVehicle,
  completeReview,
  getQrData,
  getVendorQrData,
  getPassDetails,
  validateQrPass,
  // Phase 2: Edit and resubmit reverted passes
  updatePassPerson,
  updatePassVehicle,
  resubmitRevertedPass,
  saveQrPdfPath,
  validateSecureQr,
  viewMasterDocument,
  submitTwoWheelerUpdate,
  getTwoWheelerUpdateRequests,
  approveTwoWheelerUpdate,
  rejectTwoWheelerUpdate,
  updateVehicleStatus,
  updatePersonStatus,
  disablePersonPass,
  getDisabledPasses,
  disableVehiclePass,
  enablePersonPass,
  enableVehiclePass,
  getMarineSafetyPassRequests,
  approveMarineSafetyVehicle,
  rejectMarineSafetyVehicle,
  revertMarineSafetyVehicle,
  getEssentialOilDockPassRequests,
  essentialOilDockVehicleAction,
  getEssentialOilDockPersonPassRequests,
  getEssentialOilDockPersonStage,
  essentialOilDockPersonAction

};
