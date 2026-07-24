const fs = require("fs");
const path = require("path");
const {
  PASS_TYPES,
  NATIONALITIES,
  ID_PROOF_TYPES,
  ACCESS_AREAS
} = require("../constants/constants");
const passRequestService = require("../services/passRequestService");
const { Designation, vehicleTypes, PassRequest, hepTypes,
        countries, states, cities, visitPurpose, getPassRequest, Master, getAgentPassRequestsDetails, viewPassRequestsDocuments } = require("../models/passRequestSchema");
const { pool } = require("../dbconfig/db");

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
        3: "YEARLY"
      };

      return map[type] || type;

    };


    if (payload.persons && Array.isArray(payload.persons)) {

      payload.persons = payload.persons.map((p) => ({
        ...p,
        passType: normalizePassType(p.passType)
      }));

    }

    if (payload.vehicles && Array.isArray(payload.vehicles)) {

      payload.vehicles = payload.vehicles.map((v) => ({
        ...v,
        passType: normalizePassType(v.passType)
      }));

    }

    /* ===== CHANGE END ===== */

    // 0. Check Agent License Expiry & Duration Lock (Duration-Aware Validation)
    if (payload.agentId) {
      const agentRes = await pool.query(
        'SELECT id, TO_CHAR("licenseValidityDate", \'YYYY-MM-DD\') AS "licenseValidityDate", "entityName" FROM "Agents" WHERE id = $1',
        [payload.agentId]
      );
      if (agentRes.rows.length > 0 && agentRes.rows[0].licenseValidityDate) {
        const licenseValidityStr = String(agentRes.rows[0].licenseValidityDate).split('T')[0];
        const [yyyy, mm, dd] = licenseValidityStr.split('-').map(Number);

        if (yyyy && mm && dd) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const licenseExpEnd = new Date(yyyy, mm - 1, dd, 23, 59, 59, 999);
          const licenseExpStart = new Date(yyyy, mm - 1, dd, 0, 0, 0, 0);

          const diffMs = licenseExpStart.getTime() - today.getTime();
          const remainingDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
          const formattedExpDate = `${String(dd).padStart(2, '0')}/${String(mm).padStart(2, '0')}/${yyyy}`;

          // Calculate max requested pass end date from persons and vehicles
          let maxRequestedDate = new Date();
          const allItems = [...(payload.persons || []), ...(payload.vehicles || [])];
          for (const item of allItems) {
            let itemTo = null;
            if (item.toDate) {
              itemTo = new Date(item.toDate);
            } else {
              const start = item.fromDate ? new Date(item.fromDate) : new Date(today);
              itemTo = new Date(start);
              const pType = String(item.passType || "").toUpperCase();
              if (pType === "MONTHLY" || pType === "2") {
                itemTo.setMonth(itemTo.getMonth() + 1);
              } else if (pType === "YEARLY" || pType === "ANNUAL" || pType === "3") {
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
              message: `Your company license expired on ${formattedExpDate}. Pass generation is blocked. Please submit a Profile/License Update Request to update your license.`
            });
          }

          if (maxRequestedDate > licenseExpEnd) {
            return res.status(403).json({
              success: false,
              code: "PASS_EXCEEDS_LICENSE",
              message: `Your company license expires in ${remainingDays} days (on ${formattedExpDate}). You cannot apply for a pass valid beyond your license expiry date. Please update your company license.`
            });
          }
        }
      }
    }

    // 1. Check Company blacklisting
    if (payload.agentId) {
      const agentRes = await pool.query('SELECT id, "loginId" FROM "Agents" WHERE id = $1', [payload.agentId]);
      if (agentRes.rows.length > 0) {
        const companyName = agentRes.rows[0].loginId;
        const companyIdStr = String(agentRes.rows[0].id || payload.agentId);
        const blacklistRes = await pool.query(
          "SELECT id, reason FROM blacklist_entries WHERE entity_type = 'COMPANY' AND (UPPER(identifier) = UPPER($1) OR identifier = $2) AND status IN ('BLACKLISTED', 'UNBLACKLIST_REQUESTED')",
          [companyName, companyIdStr]
        );
        if (blacklistRes.rows.length > 0) {
          return res.status(403).json({
            success: false,
            message: `Pass application blocked. Your company (${companyName}) is blacklisted. Reason: ${blacklistRes.rows[0].reason}`
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
            [identifier]
          );
          if (blacklistRes.rows.length > 0) {
            return res.status(403).json({
              success: false,
              message: `Pass application blocked. Person/Driver with Primary ID (${identifier}) is blacklisted as ${blacklistRes.rows[0].entity_type}. Reason: ${blacklistRes.rows[0].reason}`
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
            [vehicle.registrationNo]
          );
          if (blacklistRes.rows.length > 0) {
            skippedVehicles.push({
              registrationNo: vehicle.registrationNo,
              reason: blacklistRes.rows[0].reason
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
    const personCount = (payload.persons && Array.isArray(payload.persons)) ? payload.persons.length : 0;
    if (personCount === 0 && skippedVehicles.length > 0 && payload.vehicles.length === 0) {
      return res.status(403).json({
        success: false,
        message: `Pass application blocked. All vehicles in the request are blacklisted. Reasons: ${skippedVehicles.map(v => `${v.registrationNo}: ${v.reason}`).join("; ")}`
      });
    }

    const passRequestId = await PassRequest.createPassRequest(
      payload,
      req.files
    );

    let successMessage = "Pass request submitted successfully";
    if (skippedVehicles.length > 0) {
      successMessage = `Pass request submitted successfully. Note: Blacklisted vehicle(s) [${skippedVehicles.map(v => v.registrationNo).join(", ")}] were excluded.`;
    }

    res.status(201).json({
      success: true,
      message: successMessage,
      passRequestId
    });

  } catch (error) {

    deleteFiles();

    console.error("Pass Request Error:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Failed to create pass request"
    });

  }

};

const getAgentPassRequests = async (req, res) => {
  try {

    const agentId = req.user.userId; // from JWT

    const { getPagination, buildPaginatedResponse } = require("../utils/pagination");
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
        pag.limit
      )
    );

  } catch (error) {

    console.error("Fetch pass requests error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });

  }
};

const getMasterDirectory = async (req, res) => {
  try {

    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    const agentId = req.user.userId;
    const { getPagination, buildPaginatedResponse } = require("../utils/pagination");

    const isPaginated = req.query.page || req.query.limit || req.query.search;

    if (isPaginated) {
      const pag = getPagination(req.query);
      const search = req.query.search || "";
      const type = req.query.type || "personnel";

      const [personCount, vehicleCount] = await Promise.all([
        Master.getPersonCount(agentId, search),
        Master.getVehicleCount(agentId, search)
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

      return res.status(200).json(
        buildPaginatedResponse(
          data,
          { personCount, vehicleCount },
          totalRecords,
          pag.page,
          pag.limit
        )
      );
    } else {
      const [
        persons,
        vehicles,
        personCount,
        vehicleCount
      ] = await Promise.all([
        Master.getPersonsByAgent(agentId, { limit: 100000, offset: 0 }),
        Master.getVehiclesByAgent(agentId, { limit: 100000, offset: 0 }),
        Master.getPersonCount(agentId),
        Master.getVehicleCount(agentId)
      ]);

      return res.status(200).json({
        success: true,
        data: {
          persons,
          vehicles,
          personCount,
          vehicleCount
        }
      });
    }

  } catch (error) {

    console.error("Fetch directory error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });

  }
};

const viewMasterDocument = async (req, res) => {
  try {

    const {
      masterId,
      entityType,
      documentType
    } = req.query;

    const result =
      await viewPassRequestsDocuments.getMasterDocumentPath(
        masterId,
        entityType,
        documentType
      );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Document not found"
      });
    }

    return res.sendFile(
      path.resolve(result.filePath)
    );

  } catch (err) {

    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Internal server error"
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
    const { getPagination, buildPaginatedResponse } = require("../utils/pagination");
    const pag = getPagination(req.query);

    const result = await getAgentPassRequestsDetails.getAgentPassRequestsToApproverAdmin(
      role, departmentId, {
        ...pag,
        processedByMe: req.query.processedByMe === "true" || req.query.processedByMe === true,
        userId,
        roleId
      }
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
        pag.limit
      )
    );

  } catch (error) {

    console.error("Approval pass fetch error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });

  }

};

const viewPassRequestsDocument = async (req, res) => {
  try {

    const { passRequestId, documentType, entityIndex, isVendorPass } = req.query;

    if (!passRequestId || !documentType) {
      return res.status(400).json({
        success: false,
        message: "passRequestId and documentType required"
      });
    }

    const fileData = await viewPassRequestsDocuments.getPassDocumentPath(
      passRequestId,
      documentType,
      entityIndex ? parseInt(entityIndex) : 0,
      isVendorPass === 'true'
    );

    if (!fileData) {
      return res.status(404).json({
        success: false,
        message: "Document not found"
      });
    }

    const filePath = Object.values(fileData)[0];

    if (!filePath) {
      return res.status(404).json({
        success: false,
        message: "File path not found"
      });
    }

    const absolutePath = path.join(process.cwd(), filePath);
    

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({
        success: false,
        message: "File missing on server"
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
      if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
        contentType = "application/pdf";
      } else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
        contentType = "image/png";
      } else if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
        contentType = "image/jpeg";
      } else {
        const pathExt = path.extname(absolutePath).toLowerCase();
        if (pathExt === ".pdf") contentType = "application/pdf";
        if (pathExt === ".jpg" || pathExt === ".jpeg") contentType = "image/jpeg";
        if (pathExt === ".png") contentType = "image/png";
      }
    } catch (err) {
      console.error("Error reading file magic bytes, falling back to extension:", err);
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
      message: "Internal server error"
    });

  }
};

const approvePerson = async(req,res)=>{

  try{

    const {personId, remarks} = req.body;
    const role = req.user?.role;
    const roleId = req.user?.roleId;

    if (roleId === 28 || role === 'Senior Deputy Traffic Manager') {
      const query = `
        UPDATE pass_persons
        SET "srDtmApproved" = true, "srDtmRemarks" = $2, "updatedAt" = NOW()
        WHERE id = $1
        RETURNING *
      `;
      const personRes = await pool.query(query, [personId, remarks || null]);
      const person = personRes.rows[0];
      if (!person) {
        return res.status(404).json({ success: false, message: "Person not found" });
      }

      const passRequestId = person.passRequestId;

      const allPersonsQuery = `
        SELECT pp.id, pp."srDtmApproved", pp."accessAreaId"
        FROM pass_persons pp
        WHERE pp."passRequestId" = $1
      `;
      const allPersonsRes = await pool.query(allPersonsQuery, [passRequestId]);
      const oilDockPersons = allPersonsRes.rows.filter(p => isOilDockArea(p.accessAreaId));
      const allApproved = oilDockPersons.every(p => p.srDtmApproved);

      if (allApproved) {
        // Update workflow state — Pass Section query now uses per-entity flags directly
        await pool.query(
          `UPDATE pass_requests SET "workflowState" = 'PENDING_PASS_SECTION', "updatedAt" = NOW() WHERE id = $1`,
          [passRequestId]
        );
      }

      return res.json({
        success: true,
        data: person
      });
    } else {
      const person = await PassRequest.approvePerson(personId);
      return res.json({
        success:true,
        data:person
      });
    }

  }catch(error){

    console.error(error);

    res.status(500).json({
      success:false,
      message:"Internal server error"
    });

  }

}

const rejectPerson = async(req,res)=>{

  try{

    const {personId, rejectedReason} = req.body;

    const person = await PassRequest.rejectPerson(personId, rejectedReason);

    return res.json({
      success:true,
      data:person
    });

  }catch(error){

    console.error(error);

    res.status(500).json({
      success:false,
      message:"Internal server error"
    });

  }

}

const approveVehicle = async(req,res)=>{

  try{

    const {vehicleId, remarks} = req.body;
    const role = req.user?.role;
    const roleId = req.user?.roleId;

    if (roleId === 26 || role === 'Safety Officer') {
      const query = `
        UPDATE pass_vehicles
        SET "twistLockCertified" = true, "twistLockRemarks" = $2, "updatedAt" = NOW()
        WHERE id = $1
        RETURNING *
      `;
      const vehicleRes = await pool.query(query, [vehicleId, remarks || null]);
      const vehicle = vehicleRes.rows[0];
      if (!vehicle) {
        return res.status(404).json({ success: false, message: "Vehicle not found" });
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
      const allVehiclesRes = await pool.query(allVehiclesQuery, [passRequestId]);
      // Only monthly/yearly vehicles strictly require twistLockCertified to advance.
      // Daily oil dock vehicles are certified individually via this same endpoint (twistLockCertified=true).
      // The overall state transition is handled by completePassReview.
      const monthlyYearlyVehicles = allVehiclesRes.rows.filter(v => ["MONTHLY", "YEARLY", "ANNUAL"].includes(v.passType));
      const allCertified = monthlyYearlyVehicles.length === 0 || monthlyYearlyVehicles.every(v => v.twistLockCertified);

      if (allCertified) {
        const prRes = await pool.query(`SELECT "isOilDock" FROM pass_requests WHERE id = $1`, [passRequestId]);
        const isOilDock = prRes.rows[0]?.isOilDock;

        const nextState = isOilDock ? 'PENDING_FIRE_SAFETY' : 'PENDING_PASS_SECTION';

        await pool.query(
          `UPDATE pass_requests SET "workflowState" = $2, "updatedAt" = NOW() WHERE id = $1`,
          [passRequestId, nextState]
        );
      }

      return res.json({
        success: true,
        data: vehicle
      });

    } else if (roleId === 27 || role === 'Fire Safety Officer') {
      const query = `
        UPDATE pass_vehicles
        SET "sparkArresterCertified" = true, "sparkArresterRemarks" = $2, "updatedAt" = NOW()
        WHERE id = $1
        RETURNING *
      `;
      const vehicleRes = await pool.query(query, [vehicleId, remarks || null]);
      const vehicle = vehicleRes.rows[0];
      if (!vehicle) {
        return res.status(404).json({ success: false, message: "Vehicle not found" });
      }

      const passRequestId = vehicle.passRequestId;

      const allVehiclesQuery = `
        SELECT id, "sparkArresterCertified", "accessAreaId"
        FROM pass_vehicles
        WHERE "passRequestId" = $1
      `;
      const allVehiclesRes = await pool.query(allVehiclesQuery, [passRequestId]);
      const oilDockVehicles = allVehiclesRes.rows.filter(v => isOilDockArea(v.accessAreaId));
      const allCertified = oilDockVehicles.every(v => v.sparkArresterCertified);

      if (allCertified) {
        await pool.query(
          `UPDATE pass_requests SET "workflowState" = 'PENDING_SR_DTM', "updatedAt" = NOW() WHERE id = $1`,
          [passRequestId]
        );
      }

      return res.json({
        success: true,
        data: vehicle
      });

    } else if (roleId === 28 || role === 'Senior Deputy Traffic Manager') {
      const query = `
        UPDATE pass_vehicles
        SET "srDtmApproved" = true, "srDtmRemarks" = $2, "updatedAt" = NOW()
        WHERE id = $1
        RETURNING *
      `;
      const vehicleRes = await pool.query(query, [vehicleId, remarks || null]);
      const vehicle = vehicleRes.rows[0];
      if (!vehicle) {
        return res.status(404).json({ success: false, message: "Vehicle not found" });
      }

      const passRequestId = vehicle.passRequestId;

      // Check if ALL oil dock vehicles in this request have been srDtmApproved
      const allVehiclesQuery = `
        SELECT id, "srDtmApproved", "accessAreaId"
        FROM pass_vehicles
        WHERE "passRequestId" = $1
      `;
      const allVehiclesRes = await pool.query(allVehiclesQuery, [passRequestId]);
      const oilDockVehicles = allVehiclesRes.rows.filter(v => isOilDockArea(v.accessAreaId));
      const allApproved = oilDockVehicles.every(v => v.srDtmApproved);

      if (allApproved) {
        // Update workflow state — Pass Section query now uses per-entity flags directly
        await pool.query(
          `UPDATE pass_requests SET "workflowState" = 'PENDING_PASS_SECTION', "updatedAt" = NOW() WHERE id = $1`,
          [passRequestId]
        );
      }

      return res.json({
        success: true,
        data: vehicle
      });

    } else {
      const vehicle = await PassRequest.approveVehicle(vehicleId);
      return res.json({
        success:true,
        data:vehicle
      });
    }

  }catch(error){

    console.error(error);

    res.status(500).json({
      success:false,
      message:"Internal server error"
    });

  }

}

const rejectVehicle = async(req,res)=>{

  try{

    const {vehicleId, rejectedReason} = req.body;

    const vehicle = await PassRequest.rejectVehicle(vehicleId, rejectedReason);

    return res.json({
      success:true,
      data:vehicle
    });

  }catch(error){

    console.error(error);

    res.status(500).json({
      success:false,
      message:"Internal server error"
    });

  }

}

const revertPerson = async(req,res)=>{

  try{

    const {personId, revertReason} = req.body;

    if(!revertReason){
      return res.status(400).json({
        success:false,
        message:"Revert reason is required"
      });
    }

    const person = await PassRequest.revertPerson(personId, revertReason);

    return res.json({
      success:true,
      data:person
    });

  }catch(error){

    console.error(error);

    res.status(500).json({
      success:false,
      message:"Internal server error"
    });

  }

}

const revertVehicle = async(req,res)=>{

  try{

    const {vehicleId, revertReason} = req.body;

    if(!revertReason){
      return res.status(400).json({
        success:false,
        message:"Revert reason is required"
      });
    }

    const vehicle = await PassRequest.revertVehicle(vehicleId, revertReason);

    return res.json({
      success:true,
      data:vehicle
    });

  }catch(error){

    console.error(error);

    res.status(500).json({
      success:false,
      message:"Internal server error"
    });

  }

}

const completeReview = async(req,res)=>{

  try{

    const {passRequestId} = req.body;
    const userId = req.user ? req.user.userId : null;
    const role = req.user ? req.user.role : null;
    const roleId = req.user ? req.user.roleId : null;
    const result = await PassRequest.completePassReview(passRequestId, userId, role, roleId);

    return res.json({
      success:true,
      data:result
    });

  }catch(error){

    console.error(error);

    res.status(500).json({
      success:false,
      message:error.message
    });

  }

}


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
      entityId
    );

    return res.json(data);

  } catch (error) {

    console.error("QR DATA ERROR", error);

    return res.status(500).json({
      success:false,
      message:error.message
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
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const getPassDetails = async (req, res) => {
  try {
    const { passRequestId } = req.params;

    const passData = await getAgentPassRequestsDetails.getPassById(passRequestId);

    if (!passData) {
      return res.status(404).json({
        success: false,
        message: "Pass request not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: passData
    });

  } catch (error) {
    console.error("GET PASS DETAILS ERROR", error);
    return res.status(500).json({
      success: false,
      message: error.message
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
    attachFile(updateData, "personAadhar", "aadharPDFFilePATH", "aadharPDFFileName");
    attachFile(updateData, "personIdProof", "idProofFilePath", "idProofFileName");
    attachFile(updateData, "driverLicense", "driverLicensePath", "driverLicenseName");
    attachFile(updateData, "requisitionLetter", "requisitionLetterPath", "requisitionLetterName");
    attachFile(updateData, "policeVerification", "policeVerificationPath", "policeVerificationName");
    attachFile(updateData, "employmentProof", "employmentProofPath", "employmentProofName");
    attachFile(updateData, "chaLicenseCopy", "chaLicensePath", "chaLicenseName");
    attachFile(updateData, "passportDoc", "passportPath", "passportName");
    attachFile(updateData, "cdcDocument", "cdcDocumentPath", "cdcDocumentName");
    attachFile(updateData, "entryAuthorization", "entryAuthorizationFilePath", "entryAuthorizationFileName");

    if (updateData.designation) {
      if (updateData.designation === "Crew" || updateData.designation === "Supernumerary" || updateData.designation === "Others") {
        updateData.designationId = null;
        updateData.designationOther = updateData.designationOther || updateData.designation;
      } else {
        updateData.designationId = parseInt(updateData.designation, 10) || null;
      }
    }

    if (updateData.nationality) {
      if (updateData.nationality === "1" || String(updateData.nationality).toUpperCase().includes("IND")) {
        updateData.nationality = "INDIAN";
      } else if (updateData.nationality === "2" || String(updateData.nationality).toUpperCase().includes("FOR")) {
        updateData.nationality = "FOREIGNER";
      }
    }

    if (updateData.withTwoWheeler !== undefined) {
      updateData.withTwoWheeler = updateData.withTwoWheeler === true || updateData.withTwoWheeler === "true";
    }

    const { PassRequest } = require("../models/passRequestSchema");

    const result = await PassRequest.updateRevertedPerson(personId, updateData);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }

    return res.status(200).json({
      success: true,
      message: "Person updated successfully",
      data: result.data
    });

  } catch (error) {
    console.error("UPDATE PASS PERSON ERROR", error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const updatePassVehicle = async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const updateData = req.body;

    console.log('UPDATE VEHICLE - vehicleId:', vehicleId);
    console.log('UPDATE VEHICLE - updateData:', updateData);

    // Attach files if any
    const files = req.files || {};
    const attachFile = (entry, fieldName, pathKey, nameKey) => {
      const f = files[fieldName]?.[0];
      if (f) {
        entry[pathKey] = f.path;
        entry[nameKey] = f.originalname;
      }
    };

    attachFile(updateData, "vehicleRC", "scannedCopyFilePath", "scannedCopyFileName");
    attachFile(updateData, "vehicleInsurance", "insuranceFilePath", "insuranceFileName");
    attachFile(updateData, "vehiclePermit", "permitFilePath", "permitFileName");
    attachFile(updateData, "vehicleFitness", "fitnessFilePath", "fitnessFileName");
    attachFile(updateData, "vehicleRequestLetter", "requestLetterPath", "requestLetterName");
    attachFile(updateData, "vehicleTax", "taxDocPath", "taxDocName");
    attachFile(updateData, "vehicleEmission", "emissionCertPath", "emissionCertName");
    attachFile(updateData, "sparkArrester", "sparkArresterFilePath", "sparkArresterFileName");
    attachFile(updateData, "twistLock", "twistLockFilePath", "twistLockFileName");

    const { PassRequest } = require("../models/passRequestSchema");

    const result = await PassRequest.updateRevertedVehicle(vehicleId, updateData);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }

    return res.status(200).json({
      success: true,
      message: "Vehicle updated successfully",
      data: result.data
    });

  } catch (error) {
    console.error("UPDATE PASS VEHICLE ERROR", error);
    return res.status(500).json({
      success: false,
      message: error.message
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
        message: result.message
      });
    }

    return res.status(200).json({
      success: true,
      message: "Pass resubmitted successfully",
      data: result.data
    });

  } catch (error) {
    console.error("RESUBMIT REVERTED PASS ERROR", error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const validateQrPass = async (req, res) => {
  try {
    const { passNo } = req.params;
    if (!passNo) {
      return res.status(400).json({
        success: false,
        message: "passNo is required"
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
      if (row.status !== 'approved') {
        return res.status(403).json({
          success: false,
          valid: false,
          message: "Pass is not approved",
          data: { status: row.status }
        });
      }
      if (row.dateTo && new Date(row.dateTo) < now) {
        return res.status(403).json({
          success: false,
          valid: false,
          message: "Pass has expired",
          data: { validTo: row.dateTo }
        });
      }
      return res.status(200).json({
        success: true,
        valid: true,
        message: "Pass is valid",
        data: {
          entityType: 'person',
          passNo: row.personPassNo,
          name: row.name,
          company: row.company,
          referenceNo: row.referenceNo,
          validFrom: row.dateFrom,
          validTo: row.dateTo,
        }
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
      if (row.status !== 'approved') {
        return res.status(403).json({
          success: false,
          valid: false,
          message: "Pass is not approved",
          data: { status: row.status }
        });
      }
      if (row.dateTo && new Date(row.dateTo) < now) {
        return res.status(403).json({
          success: false,
          valid: false,
          message: "Pass has expired",
          data: { validTo: row.dateTo }
        });
      }
      return res.status(200).json({
        success: true,
        valid: true,
        message: "Pass is valid",
        data: {
          entityType: 'vehicle',
          passNo: row.vehiclePassNo,
          registrationNo: row.registrationNo,
          company: row.company,
          referenceNo: row.referenceNo,
          validFrom: row.dateFrom,
          validTo: row.dateTo,
        }
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
      if (row.status !== 'approved') {
        return res.status(403).json({
          success: false,
          valid: false,
          message: "Pass is not approved",
          data: { status: row.status }
        });
      }
      if (row.dateTo && new Date(row.dateTo) < now) {
        return res.status(403).json({
          success: false,
          valid: false,
          message: "Pass has expired",
          data: { validTo: row.dateTo }
        });
      }
      return res.status(200).json({
        success: true,
        valid: true,
        message: "Pass is valid",
        data: {
          entityType: 'vendor-person',
          passNo: row.personPassNo,
          name: row.name,
          company: row.company,
          referenceNo: row.referenceNo,
          validFrom: row.dateFrom,
          validTo: row.dateTo,
        }
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
      if (row.status !== 'approved') {
        return res.status(403).json({
          success: false,
          valid: false,
          message: "Pass is not approved",
          data: { status: row.status }
        });
      }
      if (row.dateTo && new Date(row.dateTo) < now) {
        return res.status(403).json({
          success: false,
          valid: false,
          message: "Pass has expired",
          data: { validTo: row.dateTo }
        });
      }
      return res.status(200).json({
        success: true,
        valid: true,
        message: "Pass is valid",
        data: {
          entityType: 'vendor-vehicle',
          passNo: row.vehiclePassNo,
          registrationNo: row.vehicleRegistrationNo,
          company: row.company,
          referenceNo: row.referenceNo,
          validFrom: row.dateFrom,
          validTo: row.dateTo,
        }
      });
    }

    // Pass not found
    return res.status(404).json({
      success: false,
      valid: false,
      message: "Pass not found"
    });

  } catch (error) {
    console.error("validateQrPass error:", error);
    return res.status(500).json({
      success: false,
      valid: false,
      message: error.message
    });
  }
};

const saveQrPdfPath = async (
  req,
  res
) => {
  try {

    const {
      type,
      entityId,
      qrPdfPath,
    } = req.body;

    const result =
      await passRequestService.saveQrPdfPath(
        type,
        entityId,
        qrPdfPath
      );

    return res.status(200).json({
      success: true,
      data: result,
    });

  } catch (err) {

    console.error(
      "SAVE QR PDF PATH ERROR",
      err
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to save qr pdf path",
    });
  }
};

const validateSecureQr = async (
  req,
  res
) => {
  try {
    const {
      entityId,
      passRequestId,
      qrUuid,
      type,
    } = req.body;

    if (
      !entityId ||
      !passRequestId ||
      !qrUuid ||
      !type
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Missing validation payload",
      });
    }

    const result =
      await passRequestService.validateQr({
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
    console.error(
      "VALIDATE QR ERROR",
      error
    );

    return res.status(500).json({
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
  viewMasterDocument
};
