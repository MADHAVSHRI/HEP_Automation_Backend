/**
 * trafficAnalyticsSchema.js — read-only analytics over externally ingested feeds.
 *
 * Sources (shared hep_automation DB, written by other services, never modified here):
 *   tos_eir_records, tos_form13, tos_form13_containers, tos_operators   (tos-service)
 *   weighbridge_records, weighbridge_operators                          (iportman-service)
 *   customs_ooc, customs_rapiscan, customs_examinations                 (customs-service)
 *   gate_verification_events, gates                                     (gate-service)
 */

const { pool } = require("../dbconfig/db");
const q = require("../utils/reportQuery");

const IST = q.IST;

// ---------------------------------------------------------------------------
// Resilient querying: an integration whose tables/columns are not present on
// this server (e.g. gate-service not deployed yet) must not take the whole
// dashboard down. Undefined-table / undefined-column errors degrade that
// source to "no data" and are reported via sourceIssues().
// ---------------------------------------------------------------------------
const DEGRADED_TTL_MS = 10 * 60 * 1000;
const degradedSources = new Map();

async function safeQuery(text, params) {
  try {
    return await pool.query(text, params);
  } catch (err) {
    if (err && (err.code === "42P01" || err.code === "42703")) {
      const m = /relation "([^"]+)" does not exist|column ([^\s]+) does not exist/.exec(err.message || "");
      const label = m ? (m[1] || m[2]) : err.message;
      if (!degradedSources.has(label)) console.warn(`[traffic-analytics] source unavailable: ${err.message}`);
      degradedSources.set(label, Date.now());
      return { rows: [], rowCount: 0, degraded: true };
    }
    throw err;
  }
}

function sourceIssues() {
  const now = Date.now();
  for (const [k, t] of degradedSources) if (now - t > DEGRADED_TTL_MS) degradedSources.delete(k);
  return Array.from(degradedSources.keys());
}

// ---------------------------------------------------------------------------
// Shared SQL fragments
// ---------------------------------------------------------------------------

/** Weighbridge rows store a naive IST date + time; convert to timestamptz. */
const WB_TS = `((w."weighDate" + w."weighTime") AT TIME ZONE '${IST}')`;

/** Net weight normalised to kilograms. */
const WB_NET_KG = `(CASE LOWER(w."weightUnit")
  WHEN 'ton' THEN w."netWeight" * 1000
  WHEN 'lb'  THEN w."netWeight" * 0.45359237
  WHEN 'g'   THEN w."netWeight" / 1000
  ELSE w."netWeight" END)`;
const WB_GROSS_KG = WB_NET_KG.replace(/"netWeight"/g, '"grossWeight"');
const WB_TARE_KG = WB_NET_KG.replace(/"netWeight"/g, '"tareWeight"');

/** Operators type the weighbridge name free-hand on each ticket; the operator
 *  account carries the canonical name, so prefer that. */
const WB_NAME = `COALESCE(NULLIF(op."weighBridgeName", ''), w."weighBridgeName")`;
const WB_FROM = `FROM weighbridge_records w LEFT JOIN weighbridge_operators op ON op.id = w."operatorId"`;

const EIR_TS = `e."inGateDateTime"`;
const EIR_EVENT_TS = `COALESCE(e."outGateDateTime", e."inGateDateTime")`;

const bucketExpr = (bucket, tsExpr) =>
  `date_trunc('${bucket}', ${tsExpr} AT TIME ZONE '${IST}')`;

const pickBucket = (filters) => {
  const from = q.cleanText(filters.fromDate);
  const to = q.cleanText(filters.toDate);
  if (!from || !to) return "day";
  const days = (new Date(to) - new Date(from)) / 86400000;
  return days <= 2 ? "hour" : "day";
};

const mapRows = (rows, key) =>
  rows.reduce((acc, r) => {
    acc[r[key]] = r;
    return acc;
  }, {});

const toNum = (v) => (v === null || v === undefined ? 0 : Number(v));

// ---------------------------------------------------------------------------
// Where-clause builders per source
// ---------------------------------------------------------------------------

function eirWhere(filters, { includeDate = true } = {}) {
  const where = [];
  const params = [];
  if (includeDate) q.addDateRange(where, params, EIR_TS, filters);
  q.addLocalTimeFilters(where, params, EIR_TS, filters);
  q.addIn(where, params, `e."terminal"`, filters.terminal);
  q.addEquals(where, params, `e."movementType"`, filters.movementType);
  q.addEquals(where, params, `e."fullEmpty"`, filters.fullEmpty);
  q.addIn(where, params, `e."line"`, filters.line);
  q.addEquals(where, params, `e."oocStatus"`, filters.oocStatus);
  q.addEquals(where, params, `e."markedForScanning"`, filters.markedForScanning);
  q.addIn(where, params, `e."destinationGroup"`, filters.destinationGroup);
  q.addNormalizedLike(where, params, `e."containerNumber"`, filters.containerNumber);
  q.addNormalizedLike(where, params, `e."trailerNumber"`, filters.trailerNumber);
  if (String(filters.openOnly) === "true") where.push(`e."outGateDateTime" IS NULL`);
  if (q.cleanText(filters.search)) {
    params.push(`%${q.cleanText(filters.search)}%`);
    where.push(
      `CONCAT_WS(' ', e."eirNo", e."containerNumber", e."trailerNumber", e."line", e."destinationName", e."destinationGroup", e."terminal") ILIKE $${params.length}`,
    );
  }
  return { where, params };
}

function form13Where(filters) {
  const where = [];
  const params = [];
  q.addDateRange(where, params, `f."createdAt"`, filters);
  q.addLocalTimeFilters(where, params, `f."createdAt"`, filters);
  q.addIn(where, params, `f."terminal"`, filters.terminal);
  q.addEquals(where, params, `c."movementType"`, filters.movementType);
  q.addNormalizedLike(where, params, `f."trailerNumber"`, filters.trailerNumber);
  q.addNormalizedLike(where, params, `c."containerNumber"`, filters.containerNumber);
  if (q.cleanText(filters.search)) {
    params.push(`%${q.cleanText(filters.search)}%`);
    where.push(
      `CONCAT_WS(' ', f."form13No", f."trailerNumber", f."terminal", c."containerNumber", c."containerISO", c."containerType") ILIKE $${params.length}`,
    );
  }
  return { where, params };
}

function weighbridgeWhere(filters) {
  const where = [];
  const params = [];
  q.addDateRange(where, params, WB_TS, filters);
  q.addLocalTimeFilters(where, params, WB_TS, filters);
  q.addIn(where, params, WB_NAME, filters.weighBridgeName);
  q.addEquals(where, params, `w."movementType"::text`, filters.movementType);
  q.addIn(where, params, `w."cargo"`, filters.cargo);
  q.addLike(where, params, `w."clientName"`, filters.clientName);
  q.addNormalizedLike(where, params, `w."vehicleNumber"`, filters.vehicleNumber);
  q.addLike(where, params, `w."serialNo"`, filters.serialNo);
  if (q.cleanText(filters.minNet)) {
    params.push(Number(filters.minNet));
    where.push(`${WB_NET_KG} >= $${params.length}`);
  }
  if (q.cleanText(filters.maxNet)) {
    params.push(Number(filters.maxNet));
    where.push(`${WB_NET_KG} <= $${params.length}`);
  }
  if (String(filters.mismatchOnly) === "true") {
    where.push(`ABS(w."netWeight" - (w."grossWeight" - w."tareWeight")) > GREATEST(1, 0.01 * w."grossWeight")`);
  }
  if (q.cleanText(filters.search)) {
    params.push(`%${q.cleanText(filters.search)}%`);
    where.push(
      `CONCAT_WS(' ', w."serialNo", w."vehicleNumber", w."cargo", w."clientName", ${WB_NAME}) ILIKE $${params.length}`,
    );
  }
  return { where, params };
}

function gateWhere(filters) {
  const where = [];
  const params = [];
  q.addDateRange(where, params, `ev."occurredAt"`, filters);
  q.addLocalTimeFilters(where, params, `ev."occurredAt"`, filters);
  q.addIn(where, params, `g."gateCode"`, filters.gateCode);
  q.addIn(where, params, `ev."verificationType"::text`, filters.verificationType);
  q.addIn(where, params, `ev."status"::text`, filters.status);
  q.addNormalizedLike(where, params, `ev."identifier"`, filters.identifier);
  if (q.cleanText(filters.search)) {
    params.push(`%${q.cleanText(filters.search)}%`);
    where.push(
      `CONCAT_WS(' ', ev."identifier", ev."reason", ev."deviceId", g."gateName", g."gateCode", to_jsonb(g)->>'laneName') ILIKE $${params.length}`,
    );
  }
  return { where, params };
}

const whereSql = (where) => (where.length ? `WHERE ${where.join(" AND ")}` : "");

// ---------------------------------------------------------------------------
// Generic paged runner
// ---------------------------------------------------------------------------

async function runPaged({ selectSql, fromSql, where, params, orderSql, filters, exportAll }) {
  const wsql = whereSql(where);
  if (exportAll) {
    const rows = await safeQuery(
      `${selectSql} ${fromSql} ${wsql} ${orderSql} LIMIT ${q.MAX_EXPORT_ROWS}`,
      params,
    );
    return { data: rows.rows, pagination: { page: 1, limit: rows.rowCount, totalRecords: rows.rowCount } };
  }
  const limit = q.normalizeLimit(filters.limit);
  const page = q.toPositiveInt(filters.page, 1);
  const offset = (page - 1) * limit;
  const total = await safeQuery(`SELECT COUNT(*)::int AS total ${fromSql} ${wsql}`, params);
  const pageParams = [...params, limit, offset];
  const rows = await safeQuery(
    `${selectSql} ${fromSql} ${wsql} ${orderSql} LIMIT $${pageParams.length - 1} OFFSET $${pageParams.length}`,
    pageParams,
  );
  return {
    data: rows.rows,
    pagination: { page, limit, totalRecords: total.rows[0]?.total || 0 },
  };
}

// ---------------------------------------------------------------------------
// Column definitions (used for export headers and FE table defaults)
// ---------------------------------------------------------------------------

const COLUMNS = {
  eir: [
    { key: "eirNo", label: "EIR No" },
    { key: "terminal", label: "Terminal" },
    { key: "containerNumber", label: "Container" },
    { key: "containerSize", label: "Size" },
    { key: "containerISO", label: "ISO" },
    { key: "movementType", label: "Movement" },
    { key: "fullEmpty", label: "Full / Empty" },
    { key: "line", label: "Shipping Line" },
    { key: "trailerNumber", label: "Trailer" },
    { key: "inGate", label: "Gate In (IST)" },
    { key: "outGate", label: "Gate Out (IST)" },
    { key: "dwellMinutes", label: "Dwell (min)" },
    { key: "oocStatus", label: "OOC" },
    { key: "markedForScanning", label: "Scan Flag" },
    { key: "destinationGroup", label: "Dest. Group" },
    { key: "destinationName", label: "Destination" },
    { key: "operator", label: "Pushed By" },
    { key: "receivedAt", label: "Received (IST)" },
  ],
  form13: [
    { key: "form13No", label: "Form 13 No" },
    { key: "terminal", label: "Terminal" },
    { key: "trailerNumber", label: "Trailer" },
    { key: "containerNumber", label: "Container" },
    { key: "containerSize", label: "Size" },
    { key: "containerISO", label: "ISO" },
    { key: "containerType", label: "Type" },
    { key: "movementType", label: "Movement" },
    { key: "containersOnForm", label: "Containers on Form" },
    { key: "operator", label: "Pushed By" },
    { key: "receivedAt", label: "Received (IST)" },
  ],
  weighbridge: [
    { key: "serialNo", label: "Serial No" },
    { key: "weighBridgeName", label: "Weighbridge" },
    { key: "weighedAt", label: "Weighed At (IST)" },
    { key: "vehicleNumber", label: "Vehicle" },
    { key: "movementType", label: "Movement" },
    { key: "cargo", label: "Cargo" },
    { key: "clientName", label: "Client" },
    { key: "grossWeight", label: "Gross" },
    { key: "tareWeight", label: "Tare" },
    { key: "netWeight", label: "Net" },
    { key: "weightUnit", label: "Unit" },
    { key: "netKg", label: "Net (kg)" },
    { key: "weightVariance", label: "Net − (Gross − Tare)" },
    { key: "operatorLogin", label: "Operator" },
  ],
  customs: [
    { key: "recordType", label: "Record" },
    { key: "containerNumber", label: "Container" },
    { key: "containerSize", label: "Size" },
    { key: "status", label: "Status" },
    { key: "reference", label: "Reference" },
    { key: "eventAt", label: "Event Time (IST)" },
    { key: "details", label: "Details" },
    { key: "receivedAt", label: "Received (IST)" },
  ],
  gate: [
    { key: "occurredAt", label: "Time (IST)" },
    { key: "gateCode", label: "Gate Code" },
    { key: "gateName", label: "Gate" },
    { key: "laneName", label: "Lane" },
    { key: "verificationType", label: "Type" },
    { key: "identifier", label: "Identifier" },
    { key: "status", label: "Status" },
    { key: "matchScore", label: "Score" },
    { key: "reason", label: "Reason" },
    { key: "deviceId", label: "Device" },
    { key: "source", label: "Source" },
  ],
};

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

const TrafficAnalytics = {
  COLUMNS,

  async getFilterOptions() {
    const [terminals, lines, destGroups, weighbridges, cargos, clients, gates] = await Promise.all([
      safeQuery(`SELECT DISTINCT terminal AS value FROM tos_eir_records WHERE terminal <> ''
                  UNION SELECT DISTINCT terminal FROM tos_form13 WHERE terminal <> '' ORDER BY 1`),
      safeQuery(`SELECT line AS value, COUNT(*)::int AS n FROM tos_eir_records WHERE line <> '' GROUP BY line ORDER BY n DESC, line LIMIT 50`),
      safeQuery(`SELECT DISTINCT "destinationGroup" AS value FROM tos_eir_records WHERE "destinationGroup" IS NOT NULL AND "destinationGroup" <> '' ORDER BY 1`),
      safeQuery(`SELECT DISTINCT ${WB_NAME} AS value ${WB_FROM} WHERE ${WB_NAME} <> ''
                  UNION SELECT DISTINCT "weighBridgeName" FROM weighbridge_operators WHERE "isActive" = true ORDER BY 1`),
      safeQuery(`SELECT cargo AS value, COUNT(*)::int AS n FROM weighbridge_records WHERE cargo <> '' GROUP BY cargo ORDER BY n DESC, cargo LIMIT 50`),
      safeQuery(`SELECT "clientName" AS value, COUNT(*)::int AS n FROM weighbridge_records WHERE "clientName" <> '' GROUP BY "clientName" ORDER BY n DESC, "clientName" LIMIT 50`),
      safeQuery(`SELECT g."gateCode" AS value, g."gateName" AS label, to_jsonb(g)->>'laneName' AS "laneName" FROM gates g WHERE g."isActive" = true ORDER BY g."gateCode"`),
    ]);
    return {
      terminals: terminals.rows.map((r) => r.value),
      lines: lines.rows.map((r) => r.value),
      destinationGroups: destGroups.rows.map((r) => r.value),
      weighbridges: weighbridges.rows.map((r) => r.value),
      cargos: cargos.rows.map((r) => r.value),
      clients: clients.rows.map((r) => r.value),
      gates: gates.rows,
      movementTypes: ["Export", "Import"],
      verificationTypes: ["QR", "FACE", "VEHICLE", "CONTAINER", "CARGO"],
      gateStatuses: ["PASSED", "FAILED", "PENDING"],
      customsRecordTypes: ["OOC", "RAPISCAN", "EXAMINATION"],
      sourceIssues: sourceIssues(),
    };
  },

  // -------------------------------------------------------------------------
  // Overview: KPIs + series + breakdowns + dwell + exceptions in one payload
  // -------------------------------------------------------------------------
  async getOverview(filters = {}) {
    const bucket = pickBucket(filters);

    const [current, previous, series, breakdowns, dwell, exceptions] = await Promise.all([
      this._coreCounts(filters),
      this._previousPeriodCounts(filters),
      this._series(filters, bucket),
      this._breakdowns(filters),
      this._dwell(filters),
      this._exceptions(filters),
    ]);

    return {
      range: { fromDate: filters.fromDate || null, toDate: filters.toDate || null, bucket },
      kpis: current,
      previous,
      series,
      breakdowns,
      dwell,
      exceptions: exceptions.items,
      feeds: exceptions.feeds,
      sourceIssues: sourceIssues(),
    };
  },

  async _coreCounts(filters) {
    const e = eirWhere(filters);
    const f = form13Where(filters);
    const w = weighbridgeWhere(filters);
    const g = gateWhere(filters);
    const customsDate = (col) => {
      const where = [];
      const params = [];
      q.addDateRange(where, params, col, filters);
      return { where, params };
    };
    const ooc = customsDate(`o."dateTime"`);
    const rapi = customsDate(`r."scanningDateTime"`);
    const exam = customsDate(`(x."dateOfExamination"::timestamp AT TIME ZONE '${IST}')`);

    const [eir, form13, wb, oocR, rapiR, examR, gate] = await Promise.all([
      safeQuery(
        `SELECT COUNT(*)::int AS movements,
                COUNT(e."outGateDateTime")::int AS "gateOut",
                COUNT(*) FILTER (WHERE e."outGateDateTime" IS NULL)::int AS "openInside",
                COUNT(*) FILTER (WHERE LOWER(e."movementType")='export')::int AS export,
                COUNT(*) FILTER (WHERE LOWER(e."movementType")='import')::int AS import,
                COUNT(*) FILTER (WHERE LOWER(e."fullEmpty")='full')::int AS full,
                COUNT(*) FILTER (WHERE LOWER(e."fullEmpty")='empty')::int AS empty,
                COUNT(*) FILTER (WHERE e."oocStatus"='Yes')::int AS "oocYes",
                COUNT(*) FILTER (WHERE e."markedForScanning"='Yes')::int AS "markedForScanning",
                COUNT(DISTINCT ${q.sqlNorm('e."containerNumber"')})::int AS containers,
                COUNT(DISTINCT ${q.sqlNorm('e."trailerNumber"')})::int AS trailers,
                COUNT(*) FILTER (WHERE e."containerSize"='20')::int AS teu20,
                COUNT(*) FILTER (WHERE e."containerSize" IN ('40','45'))::int AS teu40
           FROM tos_eir_records e ${whereSql(e.where)}`,
        e.params,
      ),
      safeQuery(
        `SELECT COUNT(DISTINCT f.id)::int AS forms,
                COUNT(c.id)::int AS containers,
                COUNT(DISTINCT ${q.sqlNorm('f."trailerNumber"')})::int AS trailers
           FROM tos_form13 f LEFT JOIN tos_form13_containers c ON c."form13Id" = f.id ${whereSql(f.where)}`,
        f.params,
      ),
      safeQuery(
        `SELECT COUNT(*)::int AS weighments,
                COALESCE(SUM(${WB_NET_KG}),0)::float AS "netKg",
                COALESCE(AVG(${WB_NET_KG}),0)::float AS "avgNetKg",
                COALESCE(MAX(${WB_NET_KG}),0)::float AS "maxNetKg",
                COUNT(*) FILTER (WHERE w."movementType"::text='export')::int AS export,
                COUNT(*) FILTER (WHERE w."movementType"::text='import')::int AS import,
                COUNT(DISTINCT ${q.sqlNorm('w."vehicleNumber"')})::int AS vehicles,
                COUNT(DISTINCT w."clientName")::int AS clients,
                COUNT(*) FILTER (WHERE ABS(w."netWeight" - (w."grossWeight" - w."tareWeight")) > GREATEST(1, 0.01 * w."grossWeight"))::int AS "weightMismatch"
           ${WB_FROM} ${whereSql(w.where)}`,
        w.params,
      ),
      safeQuery(`SELECT COUNT(*)::int AS total FROM customs_ooc o ${whereSql(ooc.where)}`, ooc.params),
      safeQuery(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE LOWER(r."scanningStatus")='clean')::int AS clean,
                COUNT(*) FILTER (WHERE LOWER(r."scanningStatus")='mismatch')::int AS mismatch
           FROM customs_rapiscan r ${whereSql(rapi.where)}`,
        rapi.params,
      ),
      safeQuery(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE LOWER(x."discrepancyFound")='yes')::int AS discrepancy
           FROM customs_examinations x ${whereSql(exam.where)}`,
        exam.params,
      ),
      safeQuery(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE ev.status='PASSED')::int AS passed,
                COUNT(*) FILTER (WHERE ev.status='FAILED')::int AS failed,
                COUNT(*) FILTER (WHERE ev.status='PENDING')::int AS pending,
                COUNT(*) FILTER (WHERE ev."verificationType"='VEHICLE')::int AS vehicle,
                COUNT(*) FILTER (WHERE ev."verificationType"='CONTAINER')::int AS container
           FROM gate_verification_events ev LEFT JOIN gates g ON g.id = ev."gateId" ${whereSql(g.where)}`,
        g.params,
      ),
    ]);

    return {
      eir: eir.rows[0] || {},
      form13: form13.rows[0] || {},
      weighbridge: wb.rows[0] || {},
      customs: {
        ooc: oocR.rows[0]?.total || 0,
        rapiscan: rapiR.rows[0] || { total: 0, clean: 0, mismatch: 0 },
        examinations: examR.rows[0] || { total: 0, discrepancy: 0 },
      },
      gate: gate.rows[0] || { total: 0, passed: 0, failed: 0, pending: 0, vehicle: 0, container: 0 },
    };
  },

  /** Same counts for the immediately preceding window of equal length (for deltas). */
  async _previousPeriodCounts(filters) {
    const from = q.cleanText(filters.fromDate);
    const to = q.cleanText(filters.toDate);
    if (!from || !to) return null;
    const fromD = new Date(`${from}T00:00:00Z`);
    const toD = new Date(`${to}T00:00:00Z`);
    const spanDays = Math.max(1, Math.round((toD - fromD) / 86400000) + 1);
    const prevTo = new Date(fromD.getTime() - 86400000);
    const prevFrom = new Date(prevTo.getTime() - (spanDays - 1) * 86400000);
    const fmt = (d) => d.toISOString().slice(0, 10);
    const prev = await this._coreCounts({ ...filters, fromDate: fmt(prevFrom), toDate: fmt(prevTo) });
    return { fromDate: fmt(prevFrom), toDate: fmt(prevTo), ...prev };
  },

  async _series(filters, bucket) {
    const e = eirWhere(filters);
    const w = weighbridgeWhere(filters);
    const g = gateWhere(filters);
    const oocWhere = [];
    const oocParams = [];
    q.addDateRange(oocWhere, oocParams, `o."dateTime"`, filters);
    const rapiWhere = [];
    const rapiParams = [];
    q.addDateRange(rapiWhere, rapiParams, `r."scanningDateTime"`, filters);

    // EIR gate-out events are bucketed on their own timestamp, so run two queries.
    const eOut = eirWhere(filters, { includeDate: false });
    q.addDateRange(eOut.where, eOut.params, `e."outGateDateTime"`, filters);
    eOut.where.push(`e."outGateDateTime" IS NOT NULL`);

    const [eirIn, eirOut, wb, ooc, rapi, gate] = await Promise.all([
      safeQuery(
        `SELECT ${bucketExpr(bucket, EIR_TS)} AS b,
                COUNT(*)::int AS "eirIn",
                COUNT(*) FILTER (WHERE LOWER(e."movementType")='export')::int AS export,
                COUNT(*) FILTER (WHERE LOWER(e."movementType")='import')::int AS import
           FROM tos_eir_records e ${whereSql(e.where)} GROUP BY 1 ORDER BY 1`,
        e.params,
      ),
      safeQuery(
        `SELECT ${bucketExpr(bucket, 'e."outGateDateTime"')} AS b, COUNT(*)::int AS "eirOut"
           FROM tos_eir_records e ${whereSql(eOut.where)} GROUP BY 1 ORDER BY 1`,
        eOut.params,
      ),
      safeQuery(
        `SELECT ${bucketExpr(bucket, WB_TS)} AS b, COUNT(*)::int AS weighments,
                COALESCE(SUM(${WB_NET_KG}),0)::float AS "netKg"
           ${WB_FROM} ${whereSql(w.where)} GROUP BY 1 ORDER BY 1`,
        w.params,
      ),
      safeQuery(
        `SELECT ${bucketExpr(bucket, 'o."dateTime"')} AS b, COUNT(*)::int AS ooc
           FROM customs_ooc o ${whereSql(oocWhere)} GROUP BY 1 ORDER BY 1`,
        oocParams,
      ),
      safeQuery(
        `SELECT ${bucketExpr(bucket, 'r."scanningDateTime"')} AS b, COUNT(*)::int AS scans,
                COUNT(*) FILTER (WHERE LOWER(r."scanningStatus")='mismatch')::int AS mismatch
           FROM customs_rapiscan r ${whereSql(rapiWhere)} GROUP BY 1 ORDER BY 1`,
        rapiParams,
      ),
      safeQuery(
        `SELECT ${bucketExpr(bucket, 'ev."occurredAt"')} AS b, COUNT(*)::int AS "gateEvents",
                COUNT(*) FILTER (WHERE ev.status='FAILED')::int AS "gateFailed"
           FROM gate_verification_events ev LEFT JOIN gates g ON g.id = ev."gateId" ${whereSql(g.where)} GROUP BY 1 ORDER BY 1`,
        g.params,
      ),
    ]);

    const merged = new Map();
    const touch = (rows) => {
      rows.forEach((r) => {
        const key = r.b instanceof Date ? r.b.toISOString() : String(r.b);
        if (!merged.has(key)) merged.set(key, { bucket: key });
        const target = merged.get(key);
        Object.entries(r).forEach(([k, v]) => {
          if (k !== "b") target[k] = toNum(v);
        });
      });
    };
    [eirIn.rows, eirOut.rows, wb.rows, ooc.rows, rapi.rows, gate.rows].forEach(touch);

    return Array.from(merged.values())
      .sort((a, b) => (a.bucket < b.bucket ? -1 : 1))
      .map((row) => ({
        bucket: row.bucket,
        eirIn: row.eirIn || 0,
        eirOut: row.eirOut || 0,
        export: row.export || 0,
        import: row.import || 0,
        weighments: row.weighments || 0,
        netKg: row.netKg || 0,
        ooc: row.ooc || 0,
        scans: row.scans || 0,
        mismatch: row.mismatch || 0,
        gateEvents: row.gateEvents || 0,
        gateFailed: row.gateFailed || 0,
      }));
  },

  async _breakdowns(filters) {
    const e = eirWhere(filters);
    const w = weighbridgeWhere(filters);
    const g = gateWhere(filters);

    const [terminal, line, destGroup, weighbridge, cargo, client, gate, size] = await Promise.all([
      safeQuery(
        `SELECT e.terminal AS name, COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE LOWER(e."movementType")='export' AND LOWER(e."fullEmpty")='full')::int AS "exportFull",
                COUNT(*) FILTER (WHERE LOWER(e."movementType")='export' AND LOWER(e."fullEmpty")='empty')::int AS "exportEmpty",
                COUNT(*) FILTER (WHERE LOWER(e."movementType")='import' AND LOWER(e."fullEmpty")='full')::int AS "importFull",
                COUNT(*) FILTER (WHERE LOWER(e."movementType")='import' AND LOWER(e."fullEmpty")='empty')::int AS "importEmpty",
                COUNT(*) FILTER (WHERE e."outGateDateTime" IS NULL)::int AS "openInside"
           FROM tos_eir_records e ${whereSql(e.where)} GROUP BY 1 ORDER BY total DESC`,
        e.params,
      ),
      safeQuery(
        `SELECT e.line AS name, COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE LOWER(e."movementType")='export')::int AS export,
                COUNT(*) FILTER (WHERE LOWER(e."movementType")='import')::int AS import
           FROM tos_eir_records e ${whereSql(e.where)} GROUP BY 1 ORDER BY total DESC LIMIT 10`,
        e.params,
      ),
      safeQuery(
        `SELECT COALESCE(NULLIF(e."destinationGroup",''),'Unspecified') AS name, COUNT(*)::int AS total
           FROM tos_eir_records e ${whereSql(e.where)} GROUP BY 1 ORDER BY total DESC LIMIT 10`,
        e.params,
      ),
      safeQuery(
        `SELECT ${WB_NAME} AS name, COUNT(*)::int AS total,
                COALESCE(SUM(${WB_NET_KG}),0)::float AS "netKg",
                COALESCE(AVG(${WB_NET_KG}),0)::float AS "avgNetKg",
                COUNT(*) FILTER (WHERE w."movementType"::text='export')::int AS export,
                COUNT(*) FILTER (WHERE w."movementType"::text='import')::int AS import
           ${WB_FROM} ${whereSql(w.where)} GROUP BY 1 ORDER BY total DESC`,
        w.params,
      ),
      safeQuery(
        `SELECT w.cargo AS name, COUNT(*)::int AS total, COALESCE(SUM(${WB_NET_KG}),0)::float AS "netKg"
           ${WB_FROM} ${whereSql(w.where)} GROUP BY 1 ORDER BY "netKg" DESC LIMIT 10`,
        w.params,
      ),
      safeQuery(
        `SELECT w."clientName" AS name, COUNT(*)::int AS total, COALESCE(SUM(${WB_NET_KG}),0)::float AS "netKg"
           ${WB_FROM} ${whereSql(w.where)} GROUP BY 1 ORDER BY "netKg" DESC LIMIT 10`,
        w.params,
      ),
      safeQuery(
        `SELECT COALESCE(g."gateName", 'Unknown') AS name, g."gateCode", COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE ev.status='PASSED')::int AS passed,
                COUNT(*) FILTER (WHERE ev.status='FAILED')::int AS failed,
                COUNT(*) FILTER (WHERE ev.status='PENDING')::int AS pending
           FROM gate_verification_events ev LEFT JOIN gates g ON g.id = ev."gateId" ${whereSql(g.where)}
          GROUP BY 1,2 ORDER BY total DESC`,
        g.params,
      ),
      safeQuery(
        `SELECT COALESCE(NULLIF(e."containerSize",''),'?') AS name, COUNT(*)::int AS total
           FROM tos_eir_records e ${whereSql(e.where)} GROUP BY 1 ORDER BY 1`,
        e.params,
      ),
    ]);

    return {
      terminal: terminal.rows,
      line: line.rows,
      destinationGroup: destGroup.rows,
      weighbridge: weighbridge.rows,
      cargo: cargo.rows,
      client: client.rows,
      gate: gate.rows,
      containerSize: size.rows,
    };
  },

  async _dwell(filters) {
    const e = eirWhere(filters);
    const dwellMin = `EXTRACT(EPOCH FROM (e."outGateDateTime" - e."inGateDateTime"))/60`;
    const [terminal, ooc, byHour] = await Promise.all([
      safeQuery(
        `SELECT e.terminal AS name, COUNT(*)::int AS samples,
                ROUND(AVG(${dwellMin})::numeric,1)::float AS "avgMinutes",
                ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${dwellMin}))::numeric,1)::float AS "medianMinutes",
                ROUND((PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY ${dwellMin}))::numeric,1)::float AS "p90Minutes"
           FROM tos_eir_records e
          ${whereSql([...e.where, `e."outGateDateTime" IS NOT NULL`, `e."outGateDateTime" > e."inGateDateTime"`])}
          GROUP BY 1 ORDER BY 1`,
        e.params,
      ),
      safeQuery(
        `WITH imports AS (
           SELECT e.id, e.terminal, e."inGateDateTime", ${q.sqlNorm('e."containerNumber"')} AS cn
             FROM tos_eir_records e
            ${whereSql([...e.where, `LOWER(e."movementType")='import'`])}
         ), firstOoc AS (
           SELECT ${q.sqlNorm('o."containerNumber"')} AS cn, MIN(o."dateTime") AS "oocAt"
             FROM customs_ooc o GROUP BY 1
         )
         SELECT i.terminal AS name, COUNT(*)::int AS samples,
                ROUND(AVG(EXTRACT(EPOCH FROM (f."oocAt" - i."inGateDateTime"))/60)::numeric,1)::float AS "avgMinutes",
                ROUND((PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (f."oocAt" - i."inGateDateTime"))/60))::numeric,1)::float AS "p90Minutes"
           FROM imports i JOIN firstOoc f ON f.cn = i.cn AND f."oocAt" >= i."inGateDateTime"
          GROUP BY 1 ORDER BY 1`,
        e.params,
      ),
      safeQuery(
        `SELECT EXTRACT(HOUR FROM e."inGateDateTime" AT TIME ZONE '${IST}')::int AS hour,
                COUNT(*)::int AS "gateIn",
                ROUND((AVG(${dwellMin}) FILTER (WHERE e."outGateDateTime" IS NOT NULL))::numeric,1)::float AS "avgMinutes"
           FROM tos_eir_records e ${whereSql(e.where)} GROUP BY 1 ORDER BY 1`,
        e.params,
      ),
    ]);
    return { terminalDwell: terminal.rows, eirToOoc: ooc.rows, byHour: byHour.rows };
  },

  /** Which feeds have ever delivered a row (independent of the date filter). */
  async _feedPresence() {
    const probe = (table) => safeQuery(`SELECT EXISTS (SELECT 1 FROM ${table} LIMIT 1) AS present`).then((r) => Boolean(r.rows[0]?.present));
    const [ooc, rapiscan, examinations, weighbridge, gate, eir, form13] = await Promise.all([
      probe("customs_ooc"), probe("customs_rapiscan"), probe("customs_examinations"),
      probe("weighbridge_records"), probe("gate_verification_events"), probe("tos_eir_records"), probe("tos_form13"),
    ]);
    return { customs_ooc: ooc, customs_rapiscan: rapiscan, customs_examinations: examinations, weighbridge_records: weighbridge, gate_verification_events: gate, tos_eir_records: eir, tos_form13: form13 };
  },

  async _exceptions(filters) {
    const e = eirWhere(filters);
    const w = weighbridgeWhere(filters);
    const f = form13Where(filters);
    const limit = 20;
    const feeds = await this._feedPresence();

    const defs = [
      {
        key: "importWithoutOoc",
        title: "Import gate-out without Customs OOC",
        severity: "critical",
        dependsOn: ["customs_ooc"],
        sql: `SELECT e."eirNo", e.terminal, e."containerNumber", e."trailerNumber", e.line,
                     ${q.istDateTime('e."outGateDateTime"')} AS "outGate"
                FROM tos_eir_records e
               ${whereSql([
                 ...e.where,
                 `LOWER(e."movementType")='import'`,
                 `e."outGateDateTime" IS NOT NULL`,
                 `COALESCE(e."oocStatus",'') <> 'Yes'`,
                 `NOT EXISTS (SELECT 1 FROM customs_ooc o WHERE ${q.sqlNorm('o."containerNumber"')} = ${q.sqlNorm('e."containerNumber"')})`,
               ])}`,
        params: e.params,
        order: `ORDER BY e."outGateDateTime" DESC`,
        link: { tab: "eir", movementType: "Import", oocStatus: "No" },
      },
      {
        key: "scanFlaggedNotCleared",
        title: "Marked for scanning, no Clean Rapiscan",
        severity: "serious",
        dependsOn: ["customs_rapiscan"],
        sql: `SELECT e."eirNo", e.terminal, e."containerNumber", e."trailerNumber", e.line,
                     ${q.istDateTime('e."inGateDateTime"')} AS "inGate"
                FROM tos_eir_records e
               ${whereSql([
                 ...e.where,
                 `e."markedForScanning"='Yes'`,
                 `NOT EXISTS (SELECT 1 FROM customs_rapiscan r WHERE ${q.sqlNorm('r."containerNumber"')} = ${q.sqlNorm('e."containerNumber"')} AND LOWER(r."scanningStatus")='clean')`,
               ])}`,
        params: e.params,
        order: `ORDER BY e."inGateDateTime" DESC`,
        link: { tab: "eir", markedForScanning: "Yes" },
      },
      {
        key: "rapiscanMismatch",
        title: "Rapiscan mismatch",
        severity: "critical",
        dependsOn: ["customs_rapiscan"],
        sql: (() => {
          const where = [];
          const params = [];
          q.addDateRange(where, params, `r."scanningDateTime"`, filters);
          where.push(`LOWER(r."scanningStatus")='mismatch'`);
          return {
            text: `SELECT r."containerNumber", r."containerSize", r."scanningStatus" AS status,
                          ${q.istDateTime('r."scanningDateTime"')} AS "scannedAt"
                     FROM customs_rapiscan r ${whereSql(where)}`,
            params,
          };
        })(),
        order: `ORDER BY r."scanningDateTime" DESC`,
        link: { tab: "customs", recordType: "RAPISCAN", status: "Mismatch" },
      },
      {
        key: "weightMismatch",
        title: "Weighment net ≠ gross − tare",
        severity: "warning",
        dependsOn: ["weighbridge_records"],
        sql: `SELECT w."serialNo", ${WB_NAME} AS "weighBridgeName", w."vehicleNumber", w.cargo,
                     w."grossWeight", w."tareWeight", w."netWeight", w."weightUnit",
                     ${q.istDateTime(WB_TS)} AS "weighedAt"
                ${WB_FROM}
               ${whereSql([
                 ...w.where,
                 `ABS(w."netWeight" - (w."grossWeight" - w."tareWeight")) > GREATEST(1, 0.01 * w."grossWeight")`,
               ])}`,
        params: w.params,
        order: `ORDER BY ${WB_TS} DESC`,
        link: { tab: "weighbridge", mismatchOnly: "true" },
      },
      {
        key: "loadedWithoutWeighment",
        title: "Loaded EIR trailers not weighed that day",
        severity: "info",
        note: "Weighing is not mandatory for container trucks; shown as coverage, not a fault.",
        dependsOn: ["weighbridge_records"],
        sql: `SELECT e."eirNo", e.terminal, e."containerNumber", e."trailerNumber", e."movementType",
                     ${q.istDateTime('e."inGateDateTime"')} AS "inGate"
                FROM tos_eir_records e
               ${whereSql([
                 ...e.where,
                 `LOWER(e."fullEmpty")='full'`,
                 `NOT EXISTS (SELECT 1 FROM weighbridge_records w
                               WHERE ${q.sqlNorm('w."vehicleNumber"')} = ${q.sqlNorm('e."trailerNumber"')}
                                 AND w."weighDate" = (e."inGateDateTime" AT TIME ZONE '${IST}')::date)`,
               ])}`,
        params: e.params,
        order: `ORDER BY e."inGateDateTime" DESC`,
        link: { tab: "eir", fullEmpty: "Full" },
      },
      {
        key: "form13WithoutEir",
        title: "Form 13 container with no EIR",
        severity: "serious",
        dependsOn: ["tos_form13"],
        sql: `SELECT f."form13No", f.terminal, f."trailerNumber", c."containerNumber", c."movementType",
                     ${q.istDateTime('f."createdAt"')} AS "receivedAt"
                FROM tos_form13 f JOIN tos_form13_containers c ON c."form13Id" = f.id
               ${whereSql([
                 ...f.where,
                 `c."containerNumber" IS NOT NULL`,
                 `NOT EXISTS (SELECT 1 FROM tos_eir_records e WHERE ${q.sqlNorm('e."containerNumber"')} = ${q.sqlNorm('c."containerNumber"')})`,
               ])}`,
        params: f.params,
        order: `ORDER BY f."createdAt" DESC`,
        link: { tab: "form13" },
      },
    ];

    const results = await Promise.all(
      defs.map(async (d) => {
        const missing = (d.dependsOn || []).filter((src) => !feeds[src]);
        if (missing.length) {
          // The feed this check depends on has never delivered a row: do not
          // report thousands of false exceptions, report that we are waiting.
          return { key: d.key, title: d.title, severity: d.severity, note: d.note, count: 0, sample: [], link: d.link, awaiting: missing };
        }
        const text = typeof d.sql === "string" ? d.sql : d.sql.text;
        const params = typeof d.sql === "string" ? d.params : d.sql.params;
        const [count, rows] = await Promise.all([
          safeQuery(`SELECT COUNT(*)::int AS total FROM (${text}) t`, params),
          safeQuery(`${text} ${d.order} LIMIT ${limit}`, params),
        ]);
        return {
          key: d.key,
          title: d.title,
          severity: d.severity,
          note: d.note,
          count: count.rows[0]?.total || 0,
          sample: rows.rows,
          link: d.link,
          awaiting: null,
        };
      }),
    );
    return { items: results, feeds };
  },

  // -------------------------------------------------------------------------
  // Paginated lists (also used for export with exportAll=true)
  // -------------------------------------------------------------------------
  async getEirList(filters = {}, exportAll = false) {
    const { where, params } = eirWhere(filters);
    const sortMap = {
      inGate: `e."inGateDateTime"`,
      outGate: `e."outGateDateTime"`,
      receivedAt: `e."createdAt"`,
      terminal: `e.terminal`,
      containerNumber: `e."containerNumber"`,
      trailerNumber: `e."trailerNumber"`,
      line: `e.line`,
      dwellMinutes: `(e."outGateDateTime" - e."inGateDateTime")`,
    };
    const sort = q.resolveSort(sortMap, filters.sortBy, "inGate");
    const order = q.normalizeSortOrder(filters.sortOrder);
    return runPaged({
      selectSql: `SELECT e.id, e."eirNo", e.terminal, e."containerNumber", e."containerSize", e."containerISO",
                         e."movementType", e."fullEmpty", e.line, e."trailerNumber",
                         ${q.istDateTime('e."inGateDateTime"')} AS "inGate",
                         ${q.istDateTime('e."outGateDateTime"')} AS "outGate",
                         ROUND((EXTRACT(EPOCH FROM (e."outGateDateTime" - e."inGateDateTime"))/60)::numeric)::int AS "dwellMinutes",
                         e."oocStatus", e."markedForScanning", e."destinationGroup", e."destinationName",
                         op."loginId" AS operator,
                         ${q.istDateTime('e."createdAt"')} AS "receivedAt",
                         e."inGateDateTime" AS "inGateIso", e."outGateDateTime" AS "outGateIso"`,
      fromSql: `FROM tos_eir_records e LEFT JOIN tos_operators op ON op.id = e."createdBy"`,
      where,
      params,
      orderSql: `ORDER BY ${sort} ${order} NULLS LAST, e.id ${order}`,
      filters,
      exportAll,
    }).then((r) => ({ ...r, columns: COLUMNS.eir }));
  },

  async getForm13List(filters = {}, exportAll = false) {
    const { where, params } = form13Where(filters);
    const sortMap = {
      receivedAt: `f."createdAt"`,
      form13No: `f."form13No"`,
      terminal: `f.terminal`,
      trailerNumber: `f."trailerNumber"`,
      containerNumber: `c."containerNumber"`,
    };
    const sort = q.resolveSort(sortMap, filters.sortBy, "receivedAt");
    const order = q.normalizeSortOrder(filters.sortOrder);
    return runPaged({
      selectSql: `SELECT c.id, f."form13No", f.terminal, f."trailerNumber",
                         c."containerNumber", c."containerSize", c."containerISO", c."containerType", c."movementType",
                         (SELECT COUNT(*) FROM tos_form13_containers cc WHERE cc."form13Id" = f.id)::int AS "containersOnForm",
                         op."loginId" AS operator,
                         ${q.istDateTime('f."createdAt"')} AS "receivedAt"`,
      fromSql: `FROM tos_form13 f
                LEFT JOIN tos_form13_containers c ON c."form13Id" = f.id
                LEFT JOIN tos_operators op ON op.id = f."createdBy"`,
      where,
      params,
      orderSql: `ORDER BY ${sort} ${order} NULLS LAST, c.id ${order}`,
      filters,
      exportAll,
    }).then((r) => ({ ...r, columns: COLUMNS.form13 }));
  },

  async getWeighbridgeList(filters = {}, exportAll = false) {
    const { where, params } = weighbridgeWhere(filters);
    const sortMap = {
      weighedAt: WB_TS,
      serialNo: `w."serialNo"`,
      vehicleNumber: `w."vehicleNumber"`,
      netKg: WB_NET_KG,
      grossWeight: WB_GROSS_KG,
      cargo: `w.cargo`,
      clientName: `w."clientName"`,
      weighBridgeName: WB_NAME,
    };
    const sort = q.resolveSort(sortMap, filters.sortBy, "weighedAt");
    const order = q.normalizeSortOrder(filters.sortOrder);
    return runPaged({
      selectSql: `SELECT w.id, w."serialNo", ${WB_NAME} AS "weighBridgeName",
                         ${q.istDateTime(WB_TS)} AS "weighedAt",
                         w."vehicleNumber", INITCAP(w."movementType"::text) AS "movementType", w.cargo, w."clientName",
                         w."grossWeight"::float AS "grossWeight", w."tareWeight"::float AS "tareWeight", w."netWeight"::float AS "netWeight",
                         w."weightUnit", ROUND(${WB_NET_KG}::numeric, 2)::float AS "netKg",
                         ROUND((w."netWeight" - (w."grossWeight" - w."tareWeight"))::numeric, 2)::float AS "weightVariance",
                         op."loginId" AS "operatorLogin",
                         ${WB_TS} AS "weighedAtIso"`,
      fromSql: WB_FROM,
      where,
      params,
      orderSql: `ORDER BY ${sort} ${order} NULLS LAST, w.id ${order}`,
      filters,
      exportAll,
    }).then((r) => ({ ...r, columns: COLUMNS.weighbridge }));
  },

  async getCustomsList(filters = {}, exportAll = false) {
    // Unified view of the three customs feeds.
    const unionSql = `
      SELECT 'OOC' AS "recordType", o.id, o."containerNumber", o."containerSize", o."oocStatus" AS status,
             o."oocNumber" AS reference, o."dateTime" AS "eventAt", NULL::text AS details, o."createdAt"
        FROM customs_ooc o
      UNION ALL
      SELECT 'RAPISCAN', r.id, r."containerNumber", r."containerSize", r."scanningStatus",
             NULL, r."scanningDateTime", NULL, r."createdAt"
        FROM customs_rapiscan r
      UNION ALL
      SELECT 'EXAMINATION', x.id, x."containerNumber", NULL,
             CASE WHEN LOWER(x."discrepancyFound")='yes' THEN 'Discrepancy' ELSE 'No Discrepancy' END,
             x."igmNumber", (x."dateOfExamination"::timestamp AT TIME ZONE '${IST}'),
             x."examinationFindings", x."createdAt"
        FROM customs_examinations x`;

    const where = [];
    const params = [];
    q.addDateRange(where, params, `u."eventAt"`, filters);
    q.addLocalTimeFilters(where, params, `u."eventAt"`, filters);
    q.addIn(where, params, `u."recordType"`, filters.recordType);
    q.addEquals(where, params, `u.status`, filters.status);
    q.addNormalizedLike(where, params, `u."containerNumber"`, filters.containerNumber);
    if (q.cleanText(filters.search)) {
      params.push(`%${q.cleanText(filters.search)}%`);
      where.push(`CONCAT_WS(' ', u."containerNumber", u.reference, u.status, u.details) ILIKE $${params.length}`);
    }
    const sortMap = {
      eventAt: `u."eventAt"`,
      containerNumber: `u."containerNumber"`,
      recordType: `u."recordType"`,
      status: `u.status`,
      receivedAt: `u."createdAt"`,
    };
    const sort = q.resolveSort(sortMap, filters.sortBy, "eventAt");
    const order = q.normalizeSortOrder(filters.sortOrder);
    return runPaged({
      selectSql: `SELECT u."recordType", u.id, u."containerNumber", u."containerSize", u.status, u.reference,
                         ${q.istDateTime('u."eventAt"')} AS "eventAt", u.details,
                         ${q.istDateTime('u."createdAt"')} AS "receivedAt", u."eventAt" AS "eventAtIso"`,
      fromSql: `FROM (${unionSql}) u`,
      where,
      params,
      orderSql: `ORDER BY ${sort} ${order} NULLS LAST, u.id ${order}`,
      filters,
      exportAll,
    }).then((r) => ({ ...r, columns: COLUMNS.customs }));
  },

  async getGateEventList(filters = {}, exportAll = false) {
    const { where, params } = gateWhere(filters);
    const sortMap = {
      occurredAt: `ev."occurredAt"`,
      gateCode: `g."gateCode"`,
      verificationType: `ev."verificationType"`,
      status: `ev.status`,
      identifier: `ev.identifier`,
      matchScore: `ev."matchScore"`,
    };
    const sort = q.resolveSort(sortMap, filters.sortBy, "occurredAt");
    const order = q.normalizeSortOrder(filters.sortOrder);
    return runPaged({
      selectSql: `SELECT ev.id, ${q.istDateTime('ev."occurredAt"')} AS "occurredAt",
                         g."gateCode", g."gateName", to_jsonb(g)->>'laneName' AS "laneName",
                         ev."verificationType"::text AS "verificationType", ev.identifier, ev.status::text AS status,
                         ev."matchScore", ev.reason, ev."deviceId", ev.source, ev."occurredAt" AS "occurredAtIso"`,
      fromSql: `FROM gate_verification_events ev LEFT JOIN gates g ON g.id = ev."gateId"`,
      where,
      params,
      orderSql: `ORDER BY ${sort} ${order} NULLS LAST, ev.id ${order}`,
      filters,
      exportAll,
    }).then((r) => ({ ...r, columns: COLUMNS.gate }));
  },

  // -------------------------------------------------------------------------
  // Journey: every event for one container or one vehicle, across all feeds
  // -------------------------------------------------------------------------
  async getJourney({ container, vehicle } = {}) {
    const cn = q.normalizeIdentifier(container);
    const vn = q.normalizeIdentifier(vehicle);
    if (!cn && !vn) return { subject: null, events: [], summary: null };

    const events = [];

    if (cn) {
      const [eir, f13, ooc, rapi, exam, gate] = await Promise.all([
        safeQuery(
          `SELECT e."eirNo", e.terminal, e."containerNumber", e."trailerNumber", e."movementType", e."fullEmpty", e.line,
                  e."inGateDateTime", e."outGateDateTime", e."oocStatus", e."markedForScanning", e."destinationName", e."containerSize"
             FROM tos_eir_records e WHERE ${q.sqlNorm('e."containerNumber"')} = $1 ORDER BY e."inGateDateTime"`,
          [cn],
        ),
        safeQuery(
          `SELECT f."form13No", f.terminal, f."trailerNumber", c."containerNumber", c."movementType", c."containerSize", f."createdAt"
             FROM tos_form13 f JOIN tos_form13_containers c ON c."form13Id" = f.id
            WHERE ${q.sqlNorm('c."containerNumber"')} = $1 ORDER BY f."createdAt"`,
          [cn],
        ),
        safeQuery(
          `SELECT o."oocNumber", o."oocStatus", o."dateTime", o."containerSize" FROM customs_ooc o
            WHERE ${q.sqlNorm('o."containerNumber"')} = $1 ORDER BY o."dateTime"`,
          [cn],
        ),
        safeQuery(
          `SELECT r."scanningStatus", r."scanningDateTime", r."containerSize" FROM customs_rapiscan r
            WHERE ${q.sqlNorm('r."containerNumber"')} = $1 ORDER BY r."scanningDateTime"`,
          [cn],
        ),
        safeQuery(
          `SELECT x."igmNumber", x."dateOfExamination", x."examinationFindings", x."discrepancyFound", x."createdAt"
             FROM customs_examinations x WHERE ${q.sqlNorm('x."containerNumber"')} = $1 ORDER BY x."dateOfExamination"`,
          [cn],
        ),
        safeQuery(
          `SELECT ev."occurredAt", ev."verificationType"::text AS "verificationType", ev.status::text AS status, ev.reason, ev."deviceId",
                  g."gateName", g."gateCode", to_jsonb(g)->>'laneName' AS "laneName"
             FROM gate_verification_events ev LEFT JOIN gates g ON g.id = ev."gateId"
            WHERE ${q.sqlNorm("ev.identifier")} = $1 ORDER BY ev."occurredAt"`,
          [cn],
        ),
      ]);

      eir.rows.forEach((r) => {
        events.push({
          at: r.inGateDateTime, source: "TOS", type: "EIR_GATE_IN",
          title: `Terminal gate-in at ${r.terminal}`,
          detail: `${r.movementType} · ${r.fullEmpty} · ${r.line} · trailer ${r.trailerNumber}${r.destinationName ? ` · to ${r.destinationName}` : ""}`,
          meta: { eirNo: r.eirNo, oocStatus: r.oocStatus, markedForScanning: r.markedForScanning, trailerNumber: r.trailerNumber, containerSize: r.containerSize },
        });
        if (r.outGateDateTime) {
          events.push({
            at: r.outGateDateTime, source: "TOS", type: "EIR_GATE_OUT",
            title: `Terminal gate-out at ${r.terminal}`,
            detail: `EIR ${r.eirNo} · trailer ${r.trailerNumber}`,
            meta: { eirNo: r.eirNo, trailerNumber: r.trailerNumber },
          });
        }
      });
      f13.rows.forEach((r) =>
        events.push({
          at: r.createdAt, source: "TOS", type: "FORM13",
          title: `Form 13 issued (${r.terminal})`,
          detail: `${r.form13No} · ${r.movementType} · trailer ${r.trailerNumber || "—"}`,
          meta: { form13No: r.form13No, trailerNumber: r.trailerNumber },
        }),
      );
      ooc.rows.forEach((r) =>
        events.push({
          at: r.dateTime, source: "CUSTOMS", type: "OOC",
          title: "Customs Out of Charge",
          detail: `${r.oocNumber} · ${r.oocStatus}`,
          meta: { oocNumber: r.oocNumber, status: r.oocStatus },
        }),
      );
      rapi.rows.forEach((r) =>
        events.push({
          at: r.scanningDateTime, source: "CUSTOMS", type: "RAPISCAN",
          title: `Rapiscan ${r.scanningStatus}`,
          detail: `Container scan result: ${r.scanningStatus}`,
          meta: { status: r.scanningStatus },
        }),
      );
      exam.rows.forEach((r) =>
        events.push({
          at: r.createdAt, source: "CUSTOMS", type: "EXAMINATION",
          title: `Physical examination · ${String(r.discrepancyFound).toLowerCase() === "yes" ? "Discrepancy" : "No discrepancy"}`,
          detail: `IGM ${r.igmNumber} · ${r.examinationFindings}`,
          meta: { igmNumber: r.igmNumber, discrepancyFound: r.discrepancyFound, dateOfExamination: r.dateOfExamination },
        }),
      );
      gate.rows.forEach((r) =>
        events.push({
          at: r.occurredAt, source: "GATE", type: `GATE_${r.verificationType}`,
          title: `${r.gateName || r.gateCode || "Gate"} · ${r.verificationType} ${r.status}`,
          detail: [r.laneName, r.reason, r.deviceId].filter(Boolean).join(" · "),
          meta: { status: r.status },
        }),
      );
    }

    // Vehicle side: explicit vehicle, or every trailer that carried this container.
    const vehicles = new Set();
    if (vn) vehicles.add(vn);
    events.forEach((ev) => {
      if (ev.meta?.trailerNumber) vehicles.add(q.normalizeIdentifier(ev.meta.trailerNumber));
    });

    if (vehicles.size) {
      const list = Array.from(vehicles);
      const [wb, gate, eirByTrailer] = await Promise.all([
        safeQuery(
          `SELECT w."serialNo", ${WB_NAME} AS "weighBridgeName", w."vehicleNumber", w."movementType"::text AS "movementType", w.cargo, w."clientName",
                  w."grossWeight"::float AS "grossWeight", w."tareWeight"::float AS "tareWeight", w."netWeight"::float AS "netWeight", w."weightUnit",
                  ${WB_TS} AS "weighedAt"
             ${WB_FROM} WHERE ${q.sqlNorm('w."vehicleNumber"')} = ANY($1) ORDER BY 11`,
          [list],
        ),
        safeQuery(
          `SELECT ev."occurredAt", ev.identifier, ev."verificationType"::text AS "verificationType", ev.status::text AS status, ev.reason, ev."deviceId",
                  g."gateName", g."gateCode", to_jsonb(g)->>'laneName' AS "laneName"
             FROM gate_verification_events ev LEFT JOIN gates g ON g.id = ev."gateId"
            WHERE ${q.sqlNorm("ev.identifier")} = ANY($1) ORDER BY ev."occurredAt"`,
          [list],
        ),
        cn
          ? Promise.resolve({ rows: [] })
          : safeQuery(
              `SELECT e."eirNo", e.terminal, e."containerNumber", e."trailerNumber", e."movementType", e."fullEmpty", e.line,
                      e."inGateDateTime", e."outGateDateTime", e."oocStatus", e."markedForScanning", e."destinationName"
                 FROM tos_eir_records e WHERE ${q.sqlNorm('e."trailerNumber"')} = ANY($1) ORDER BY e."inGateDateTime"`,
              [list],
            ),
      ]);

      wb.rows.forEach((r) =>
        events.push({
          at: r.weighedAt, source: "WEIGHBRIDGE", type: "WEIGHMENT",
          title: `Weighed at ${r.weighBridgeName}`,
          detail: `${r.vehicleNumber} · ${r.cargo} · ${r.clientName} · net ${r.netWeight} ${r.weightUnit} (gross ${r.grossWeight} / tare ${r.tareWeight})`,
          meta: { serialNo: r.serialNo, netWeight: r.netWeight, weightUnit: r.weightUnit, movementType: r.movementType },
        }),
      );
      gate.rows.forEach((r) =>
        events.push({
          at: r.occurredAt, source: "GATE", type: `GATE_${r.verificationType}`,
          title: `${r.gateName || r.gateCode || "Gate"} · ${r.verificationType} ${r.status}`,
          detail: [r.identifier, r.laneName, r.reason, r.deviceId].filter(Boolean).join(" · "),
          meta: { status: r.status },
        }),
      );
      eirByTrailer.rows.forEach((r) => {
        events.push({
          at: r.inGateDateTime, source: "TOS", type: "EIR_GATE_IN",
          title: `Terminal gate-in at ${r.terminal}`,
          detail: `${r.containerNumber} · ${r.movementType} · ${r.fullEmpty} · ${r.line}`,
          meta: { eirNo: r.eirNo, containerNumber: r.containerNumber, oocStatus: r.oocStatus, markedForScanning: r.markedForScanning },
        });
        if (r.outGateDateTime) {
          events.push({
            at: r.outGateDateTime, source: "TOS", type: "EIR_GATE_OUT",
            title: `Terminal gate-out at ${r.terminal}`,
            detail: `${r.containerNumber} · EIR ${r.eirNo}`,
            meta: { eirNo: r.eirNo, containerNumber: r.containerNumber },
          });
        }
      });
    }

    events.sort((a, b) => new Date(a.at) - new Date(b.at));
    const withGaps = events.map((ev, i) => ({
      ...ev,
      gapMinutes: i === 0 ? null : Math.round((new Date(ev.at) - new Date(events[i - 1].at)) / 60000),
    }));

    const first = withGaps[0]?.at || null;
    const last = withGaps[withGaps.length - 1]?.at || null;
    const summary = {
      firstSeen: first,
      lastSeen: last,
      totalMinutes: first && last ? Math.round((new Date(last) - new Date(first)) / 60000) : 0,
      eirMovements: withGaps.filter((e) => e.type === "EIR_GATE_IN").length,
      weighments: withGaps.filter((e) => e.type === "WEIGHMENT").length,
      oocGranted: withGaps.some((e) => e.type === "OOC"),
      scanStatus: [...withGaps].reverse().find((e) => e.type === "RAPISCAN")?.meta?.status || null,
      examination: [...withGaps].reverse().find((e) => e.type === "EXAMINATION")?.meta?.discrepancyFound || null,
      gateFailures: withGaps.filter((e) => e.source === "GATE" && e.meta?.status === "FAILED").length,
      vehicles: Array.from(vehicles),
    };

    return {
      subject: { container: cn || null, vehicle: vn || null },
      events: withGaps,
      summary,
    };
  },
};

TrafficAnalytics._safeQuery = safeQuery;
TrafficAnalytics.sourceIssues = sourceIssues;

module.exports = TrafficAnalytics;
