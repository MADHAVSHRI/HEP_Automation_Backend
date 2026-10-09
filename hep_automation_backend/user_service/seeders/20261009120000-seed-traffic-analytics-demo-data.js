"use strict";

/**
 * Demo data for the Traffic Department "Cargo Analytics" dashboard.
 *
 * The ingestion tables (TOS EIR / Form 13, weighbridge, customs, gate events)
 * are empty on local/demo environments because the external systems are not
 * connected. This seeder inserts ~60 days of coherent, reversible sample data
 * so the analytics endpoints and UI can be developed and demonstrated.
 *
 * Everything inserted carries a DEMO- prefix (or a demo operator / gate code)
 * so `down` removes only what `up` created. Schema is never changed.
 *
 * @type {import("sequelize-cli").Migration}
 */

const bcrypt = require("bcrypt");

const DAYS = 60;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// Deterministic PRNG so repeated runs produce the same data set.
function mulberry32(seed) {
  return function rand() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261009);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const chance = (p) => rand() < p;
const between = (min, max) => min + rand() * (max - min);
const intBetween = (min, max) => Math.floor(between(min, max + 1));
const pad = (n, w) => String(n).padStart(w, "0");

const TERMINALS = ["CITPL", "CCTPL", "CCTL"];
const LINES = ["MSC", "MAERSK", "CMA CGM", "HAPAG-LLOYD", "ONE", "COSCO", "EVERGREEN", "PIL", "WAN HAI"];
const LINE_PREFIX = { MSC: "MSCU", MAERSK: "MRKU", "CMA CGM": "CMAU", "HAPAG-LLOYD": "HLXU", ONE: "ONEU", COSCO: "CSNU", EVERGREEN: "EGHU", PIL: "PCIU", "WAN HAI": "WHLU" };
const DEST_GROUPS = ["CFS", "ICD", "DIRECT", "FACTORY"];
const DEST_NAMES = {
  CFS: ["Sanco CFS", "Chennai Container CFS", "Gateway Distriparks CFS", "Balmer Lawrie CFS"],
  ICD: ["ICD Tondiarpet", "ICD Irugur", "ICD Bengaluru"],
  DIRECT: ["Direct Delivery"],
  FACTORY: ["Hyundai Sriperumbudur", "Ford Maraimalai Nagar", "Nokia SEZ", "Apollo Tyres Oragadam"],
};
const WEIGHBRIDGES = ["Zero Gate WB-1", "Zero Gate WB-2", "Bharathi Dock WB"];
const CARGOS = ["Iron Ore", "Granite Blocks", "Coal", "Fertilizer", "Steel Coils", "Timber Logs", "Project Cargo", "Cement Clinker", "Food Grains"];
const CLIENTS = [
  "ABC Exports Pvt Ltd", "Coromandel International", "Tata Steel Ltd", "JSW Steel", "Chettinad Cement",
  "Southern Granites", "Madras Fertilizers", "Hyundai Motor India", "Sical Logistics", "Allcargo Logistics",
];
const GATES = [
  { gateCode: "ZERO_GATE", gateName: "Zero Gate", laneName: "Entry Lane A", location: "Main Entry" },
  { gateCode: "GATE_2_CT", gateName: "Gate 2", laneName: "Entry Lane B", location: "Container Terminal" },
  { gateCode: "BHARATHI_DOCK", gateName: "Bharathi Dock Gate", laneName: "Exit Lane A", location: "Bharathi Dock" },
];
const DEVICES = ["DEMO-ANPR-01", "DEMO-ANPR-02", "DEMO-OCR-01", "DEMO-QR-01", "DEMO-FACE-01"];
const STATE_CODES = ["TN01", "TN04", "TN09", "TN18", "TN20", "TN22", "AP16", "KA51", "PY01"];

/** Build a UTC Date from an IST wall-clock. */
function istDate(y, m, d, hh = 0, mm = 0, ss = 0) {
  return new Date(Date.UTC(y, m, d, hh, mm, ss) - IST_OFFSET_MS);
}
function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}
function istParts(date) {
  const shifted = new Date(date.getTime() + IST_OFFSET_MS);
  return {
    date: shifted.toISOString().slice(0, 10),
    time: shifted.toISOString().slice(11, 19),
  };
}

const vehiclePool = Array.from({ length: 180 }, (_, i) => `${pick(STATE_CODES)}${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + ((i * 7) % 26))}${pad(intBetween(1000, 9999), 4)}`);
const vehicleOf = () => pick(vehiclePool);
const containerOf = (line) => `${LINE_PREFIX[line]}${pad(intBetween(1000000, 9999999), 7)}`;
const isoOf = (size) => (size === "20" ? pick(["22G1", "22G0", "22R1"]) : size === "45" ? "L5G1" : pick(["42G1", "45G1", "42R1", "45R1"]));

async function chunkedInsert(queryInterface, table, rows, transaction, size = 500) {
  for (let i = 0; i < rows.length; i += size) {
    await queryInterface.bulkInsert(table, rows.slice(i, i + size), { transaction });
  }
}

module.exports = {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize;
    const transaction = await sequelize.transaction();
    try {
      const [already] = await sequelize.query(
        `SELECT COUNT(*)::int AS n FROM tos_eir_records WHERE "eirNo" LIKE 'DEMO-EIR-%'`,
        { transaction, type: sequelize.QueryTypes.SELECT },
      );
      if (already.n > 0) {
        console.log("Traffic analytics demo data already present; skipping.");
        await transaction.commit();
        return;
      }

      const now = new Date();
      const passwordHash = await bcrypt.hash("Demo@1234", 10);

      // ------------------------------------------------------------------
      // Operators (one per terminal / weighbridge) + customs operator + gates
      // ------------------------------------------------------------------
      await queryInterface.bulkInsert(
        "tos_operators",
        TERMINALS.map((t) => ({ loginId: `DEMO_${t}`, terminal: t, password: passwordHash, isActive: true, createdAt: now, updatedAt: now })),
        { transaction },
      );
      await queryInterface.bulkInsert(
        "weighbridge_operators",
        WEIGHBRIDGES.map((w, i) => ({ loginId: `9900000${i + 1}`, weighBridgeName: w, password: passwordHash, isActive: true, createdAt: now, updatedAt: now })),
        { transaction },
      );
      await queryInterface.bulkInsert(
        "customs_operators",
        [{ loginId: "DEMO_CUSTOMS", password: passwordHash, isActive: true, createdAt: now, updatedAt: now }],
        { transaction },
      );
      const existingGates = await sequelize.query(
        `SELECT "gateCode" FROM gates WHERE "gateCode" IN (:codes)`,
        { transaction, type: sequelize.QueryTypes.SELECT, replacements: { codes: GATES.map((g) => g.gateCode) } },
      );
      const haveGate = new Set(existingGates.map((g) => g.gateCode));
      const newGates = GATES.filter((g) => !haveGate.has(g.gateCode)).map((g) => ({ ...g, isActive: true, createdAt: now, updatedAt: now }));
      if (newGates.length) await queryInterface.bulkInsert("gates", newGates, { transaction });

      const tosOps = await sequelize.query(`SELECT id, terminal FROM tos_operators WHERE "loginId" LIKE 'DEMO_%'`, { transaction, type: sequelize.QueryTypes.SELECT });
      const wbOps = await sequelize.query(`SELECT id, "weighBridgeName" FROM weighbridge_operators WHERE "loginId" LIKE '9900000%'`, { transaction, type: sequelize.QueryTypes.SELECT });
      const [customsOp] = await sequelize.query(`SELECT id FROM customs_operators WHERE "loginId" = 'DEMO_CUSTOMS'`, { transaction, type: sequelize.QueryTypes.SELECT });
      const gateRows = await sequelize.query(`SELECT id, "gateCode" FROM gates WHERE "gateCode" IN (:codes)`, { transaction, type: sequelize.QueryTypes.SELECT, replacements: { codes: GATES.map((g) => g.gateCode) } });
      const tosOpId = Object.fromEntries(tosOps.map((o) => [o.terminal, o.id]));
      const wbOpId = Object.fromEntries(wbOps.map((o) => [o.weighBridgeName, o.id]));
      const gateId = Object.fromEntries(gateRows.map((g) => [g.gateCode, g.id]));

      // ------------------------------------------------------------------
      // Generate coherent movements
      // ------------------------------------------------------------------
      const eirRows = [];
      const form13Headers = [];
      const form13Containers = []; // { form13No, ...container }
      const wbRows = [];
      const oocRows = [];
      const rapiRows = [];
      const examRows = [];
      const gateEvents = [];

      let eirSeq = 0;
      let f13Seq = 0;
      let wbSeq = 0;
      let oocSeq = 0;
      let igmSeq = 0;

      const today = new Date(now.getTime() + IST_OFFSET_MS);
      const y = today.getUTCFullYear();
      const m = today.getUTCMonth();
      const d = today.getUTCDate();

      for (let dayOffset = DAYS - 1; dayOffset >= 0; dayOffset -= 1) {
        const dayStart = istDate(y, m, d - dayOffset);
        const weekday = new Date(dayStart.getTime() + IST_OFFSET_MS).getUTCDay();
        const dailyMovements = weekday === 0 ? intBetween(8, 14) : intBetween(20, 34);

        // Trucks for the day: each trailer may carry 1–2 containers (same movement).
        let produced = 0;
        while (produced < dailyMovements) {
          const terminal = pick(TERMINALS);
          const trailer = vehicleOf();
          const movement = chance(0.55) ? "Import" : "Export";
          const containersOnTruck = chance(0.3) ? 2 : 1;
          const line = pick(LINES);
          // Peak hours 06–11 and 14–20, quieter at night.
          const hour = chance(0.75) ? pick([6, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19]) : intBetween(0, 23);
          const inGate = addMinutes(dayStart, hour * 60 + intBetween(0, 59));
          const isFuture = inGate > now;
          if (isFuture) break;

          const containerRecords = [];
          for (let c = 0; c < containersOnTruck; c += 1) {
            const size = containersOnTruck === 2 ? "20" : pick(["20", "40", "40", "45"]);
            const full = movement === "Import" ? chance(0.85) : chance(0.7);
            const container = containerOf(line);
            const dwellMinutes = intBetween(25, 240) + (chance(0.08) ? intBetween(240, 900) : 0);
            const outGate = addMinutes(inGate, dwellMinutes);
            const hasOut = outGate < now && chance(0.93);
            const marked = full && chance(0.15);
            const oocYes = movement === "Import" && full ? chance(0.9) : false;
            const destGroup = movement === "Import" ? pick(DEST_GROUPS) : "DIRECT";

            eirSeq += 1;
            const eirNo = `DEMO-EIR-${terminal}-${pad(eirSeq, 6)}`;
            eirRows.push({
              eirNo,
              terminal,
              inGateDateTime: inGate,
              outGateDateTime: hasOut ? outGate : null,
              containerNumber: container,
              containerISO: isoOf(size),
              containerSize: size,
              movementType: movement,
              fullEmpty: full ? "Full" : "Empty",
              line,
              trailerNumber: trailer,
              oocStatus: movement === "Import" ? (oocYes ? "Yes" : "No") : null,
              destinationGroup: destGroup,
              destinationName: pick(DEST_NAMES[destGroup]),
              markedForScanning: marked ? "Yes" : "No",
              createdBy: tosOpId[terminal],
              createdAt: addMinutes(inGate, intBetween(1, 6)),
              updatedAt: addMinutes(inGate, intBetween(1, 6)),
            });
            containerRecords.push({ container, size, full, marked, oocYes, inGate, outGate: hasOut ? outGate : null });

            // Customs: OOC for released imports (a little before gate-out).
            if (oocYes) {
              oocSeq += 1;
              oocRows.push({
                containerNumber: container,
                containerSize: size,
                oocStatus: "Out of Charge",
                oocNumber: `DEMO-OOC-${pad(oocSeq, 6)}`,
                dateTime: addMinutes(inGate, intBetween(-600, dwellMinutes - 10)),
                receivedBy: customsOp.id,
                createdAt: inGate,
                updatedAt: inGate,
              });
            }
            // Customs: Rapiscan for flagged containers (and a few random extra).
            if (marked || chance(0.04)) {
              const mismatch = chance(0.07);
              rapiRows.push({
                containerNumber: container,
                containerSize: size,
                scanningStatus: mismatch ? "Mismatch" : "Clean",
                scanningDateTime: addMinutes(inGate, intBetween(10, 120)),
                createdBy: customsOp.id,
                createdAt: inGate,
                updatedAt: inGate,
              });
              if (mismatch || chance(0.3)) {
                igmSeq += 1;
                const discrepancy = mismatch ? chance(0.7) : chance(0.08);
                examRows.push({
                  containerNumber: container,
                  igmNumber: `DEMO-IGM-${pad(2260000 + igmSeq, 7)}`,
                  dateOfExamination: istParts(addMinutes(inGate, intBetween(60, 300))).date,
                  examinationFindings: discrepancy
                    ? pick(["Quantity short by 4 cartons", "Undeclared items found in rear pallets", "HS code mismatch with declaration", "Seal number differs from documents"])
                    : pick(["Goods tally with declaration", "Seal intact, cargo as declared", "Random check – no issues found"]),
                  discrepancyFound: discrepancy ? "Yes" : "No",
                  createdBy: customsOp.id,
                  createdAt: addMinutes(inGate, intBetween(60, 300)),
                  updatedAt: addMinutes(inGate, intBetween(60, 300)),
                });
              }
            }
          }

          // Form 13 for export trucks (95%; the rest produce "Form 13 missing" cases).
          if (movement === "Export" && chance(0.95)) {
            f13Seq += 1;
            const form13No = `DEMO-F13-${terminal}-${pad(f13Seq, 6)}`;
            const issuedAt = addMinutes(inGate, -intBetween(30, 360));
            form13Headers.push({ form13No, trailerNumber: trailer, terminal, createdBy: tosOpId[terminal], createdAt: issuedAt, updatedAt: issuedAt });
            containerRecords.forEach((cr) =>
              form13Containers.push({
                form13No,
                containerNumber: cr.container,
                containerSize: cr.size,
                containerISO: isoOf(cr.size),
                containerType: cr.size === "20" ? "GP" : pick(["GP", "HC", "RF"]),
                movementType: "Export",
                createdAt: issuedAt,
                updatedAt: issuedAt,
              }),
            );
            // Occasionally a Form 13 lists an extra container that never got an EIR.
            if (chance(0.04)) {
              form13Containers.push({
                form13No, containerNumber: containerOf(line), containerSize: "20", containerISO: "22G1", containerType: "GP",
                movementType: "Export", createdAt: issuedAt, updatedAt: issuedAt,
              });
            }
          }

          // Weighbridge: loaded trucks get weighed near the terminal gate-in (80%).
          const anyFull = containerRecords.some((cr) => cr.full);
          if (anyFull && chance(0.8)) {
            wbSeq += 1;
            const wbName = pick(WEIGHBRIDGES);
            const weighedAt = addMinutes(inGate, movement === "Export" ? -intBetween(15, 90) : intBetween(20, dwellMinutesOrDefault(containerRecords)));
            const teu = containerRecords.reduce((n, cr) => n + (cr.size === "20" ? 1 : 2), 0);
            const tare = intBetween(9000, 14000) + teu * 2200;
            const net = intBetween(8000, 14000) * teu;
            const gross = tare + net;
            const bad = chance(0.03);
            const { date, time } = istParts(weighedAt);
            wbRows.push({
              weighBridgeName: wbName,
              serialNo: `DEMO-WB-${pad(wbSeq, 6)}`,
              weighDate: date,
              weighTime: time,
              vehicleNumber: trailer,
              movementType: movement.toLowerCase(),
              cargo: "Containerised Cargo",
              clientName: pick(CLIENTS),
              grossWeight: gross,
              tareWeight: tare,
              netWeight: bad ? net + intBetween(600, 2500) : net,
              weightUnit: "kg",
              operatorId: wbOpId[wbName],
              createdAt: weighedAt,
              updatedAt: weighedAt,
            });
          }

          // Gate events: ANPR vehicle read on arrival (70%), container OCR (40%).
          if (chance(0.7)) {
            const failed = chance(0.05);
            const pending = !failed && chance(0.03);
            const gate = pick(GATES);
            const at = addMinutes(inGate, -intBetween(5, 40));
            gateEvents.push(makeGateEvent({
              gateId: gateId[gate.gateCode], type: "VEHICLE", identifier: trailer, at,
              status: failed ? "FAILED" : pending ? "PENDING" : "PASSED",
              score: failed ? intBetween(30, 60) : intBetween(85, 99),
              reason: failed ? "VEHICLE NOT REGISTERED" : pending ? "DETAIL LOOKUP UNAVAILABLE — MANUAL CHECK REQUIRED" : null,
              device: pick(["DEMO-ANPR-01", "DEMO-ANPR-02"]),
            }));
            if (chance(0.4)) {
              const cr = containerRecords[0];
              gateEvents.push(makeGateEvent({
                gateId: gateId[gate.gateCode], type: "CONTAINER", identifier: cr.container, at: addMinutes(at, 1),
                status: chance(0.96) ? "PASSED" : "FAILED", score: intBetween(80, 99),
                reason: null, device: "DEMO-OCR-01",
              }));
            }
          }

          produced += containersOnTruck;
        }

        // Bulk (non-container) weighments: 4–9 per working day.
        const bulkCount = weekday === 0 ? intBetween(1, 3) : intBetween(4, 9);
        for (let b = 0; b < bulkCount; b += 1) {
          const weighedAt = addMinutes(dayStart, intBetween(5, 21) * 60 + intBetween(0, 59));
          if (weighedAt > now) break;
          wbSeq += 1;
          const wbName = pick(WEIGHBRIDGES);
          const tare = intBetween(9500, 16000);
          const net = intBetween(18000, 42000);
          const bad = chance(0.03);
          const { date, time } = istParts(weighedAt);
          wbRows.push({
            weighBridgeName: wbName,
            serialNo: `DEMO-WB-${pad(wbSeq, 6)}`,
            weighDate: date,
            weighTime: time,
            vehicleNumber: vehicleOf(),
            movementType: chance(0.6) ? "export" : "import",
            cargo: pick(CARGOS),
            clientName: pick(CLIENTS),
            grossWeight: tare + net,
            tareWeight: tare,
            netWeight: bad ? net - intBetween(500, 3000) : net,
            weightUnit: chance(0.1) ? "ton" : "kg",
            operatorId: wbOpId[wbName],
            createdAt: weighedAt,
            updatedAt: weighedAt,
          });
          const last = wbRows[wbRows.length - 1];
          if (last.weightUnit === "ton") {
            last.grossWeight = +(last.grossWeight / 1000).toFixed(3);
            last.tareWeight = +(last.tareWeight / 1000).toFixed(3);
            last.netWeight = +(last.netWeight / 1000).toFixed(3);
          }
        }
      }

      // ------------------------------------------------------------------
      // Insert
      // ------------------------------------------------------------------
      await chunkedInsert(queryInterface, "tos_eir_records", eirRows, transaction);
      await chunkedInsert(queryInterface, "tos_form13", form13Headers, transaction);
      const headerIds = await sequelize.query(
        `SELECT id, "form13No" FROM tos_form13 WHERE "form13No" LIKE 'DEMO-F13-%'`,
        { transaction, type: sequelize.QueryTypes.SELECT },
      );
      const idByForm = Object.fromEntries(headerIds.map((h) => [h.form13No, h.id]));
      await chunkedInsert(
        queryInterface,
        "tos_form13_containers",
        form13Containers.map(({ form13No, ...rest }) => ({ form13Id: idByForm[form13No], ...rest })),
        transaction,
      );
      await chunkedInsert(queryInterface, "weighbridge_records", wbRows, transaction);
      await chunkedInsert(queryInterface, "customs_ooc", oocRows, transaction);
      await chunkedInsert(queryInterface, "customs_rapiscan", rapiRows, transaction);
      await chunkedInsert(queryInterface, "customs_examinations", examRows, transaction);
      await chunkedInsert(queryInterface, "gate_verification_events", gateEvents, transaction);

      await transaction.commit();
      console.log(
        `Traffic analytics demo data inserted: ${eirRows.length} EIR, ${form13Headers.length} Form 13 (${form13Containers.length} containers), ` +
          `${wbRows.length} weighments, ${oocRows.length} OOC, ${rapiRows.length} Rapiscan, ${examRows.length} examinations, ${gateEvents.length} gate events.`,
      );
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const sequelize = queryInterface.sequelize;
    const transaction = await sequelize.transaction();
    try {
      await sequelize.query(`DELETE FROM gate_verification_events WHERE "deviceId" LIKE 'DEMO-%'`, { transaction });
      await sequelize.query(`DELETE FROM customs_examinations WHERE "igmNumber" LIKE 'DEMO-IGM-%'`, { transaction });
      await sequelize.query(`DELETE FROM customs_rapiscan WHERE "createdBy" IN (SELECT id FROM customs_operators WHERE "loginId" = 'DEMO_CUSTOMS')`, { transaction });
      await sequelize.query(`DELETE FROM customs_ooc WHERE "oocNumber" LIKE 'DEMO-OOC-%'`, { transaction });
      await sequelize.query(`DELETE FROM weighbridge_records WHERE "serialNo" LIKE 'DEMO-WB-%'`, { transaction });
      await sequelize.query(`DELETE FROM tos_form13_containers WHERE "form13Id" IN (SELECT id FROM tos_form13 WHERE "form13No" LIKE 'DEMO-F13-%')`, { transaction });
      await sequelize.query(`DELETE FROM tos_form13 WHERE "form13No" LIKE 'DEMO-F13-%'`, { transaction });
      await sequelize.query(`DELETE FROM tos_eir_records WHERE "eirNo" LIKE 'DEMO-EIR-%'`, { transaction });
      await sequelize.query(`DELETE FROM customs_operators WHERE "loginId" = 'DEMO_CUSTOMS'`, { transaction });
      await sequelize.query(`DELETE FROM weighbridge_operators WHERE "loginId" LIKE '9900000%'`, { transaction });
      await sequelize.query(`DELETE FROM tos_operators WHERE "loginId" LIKE 'DEMO_%'`, { transaction });
      await sequelize.query(
        `DELETE FROM gates WHERE "gateCode" IN (:codes) AND NOT EXISTS (SELECT 1 FROM gate_verification_events ev WHERE ev."gateId" = gates.id)`,
        { transaction, replacements: { codes: GATES.map((g) => g.gateCode) } },
      );
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};

function dwellMinutesOrDefault(containerRecords) {
  const withOut = containerRecords.find((cr) => cr.outGate);
  if (!withOut) return 90;
  return Math.max(30, Math.round((withOut.outGate - withOut.inGate) / 60000) - 5);
}

function makeGateEvent({ gateId, type, identifier, at, status, score, reason, device }) {
  const payload = {
    gateId,
    verificationType: type,
    identifier,
    verified: status === "PASSED",
    matchScore: score,
    deviceId: device,
    eventTimestamp: at.toISOString(),
  };
  return {
    eventId: uuidFromSeed(),
    gateId,
    verificationType: type,
    identifier,
    status,
    matchScore: score,
    reason,
    deviceId: device,
    payload: JSON.stringify(payload),
    rawPayload: JSON.stringify({ plateNumber: type === "VEHICLE" ? identifier : undefined, containerNumber: type === "CONTAINER" ? identifier : undefined, confidence: score / 100, device, timestamp: at.toISOString() }),
    source: "SIMULATION",
    occurredAt: at,
    createdAt: at,
    updatedAt: at,
  };
}

function uuidFromSeed() {
  const hex = () => Math.floor(rand() * 16).toString(16);
  const s = (n) => Array.from({ length: n }, hex).join("");
  return `${s(8)}-${s(4)}-4${s(3)}-${pick(["8", "9", "a", "b"])}${s(3)}-${s(12)}`;
}
