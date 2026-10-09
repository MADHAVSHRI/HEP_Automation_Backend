/**
 * trafficAnalyticsController.js — Traffic Department cargo analytics (read-only).
 *
 * All list endpoints accept `format=json|csv|xlsx`. CSV/XLSX return the FULL
 * filtered set (capped by MAX_EXPORT_ROWS), not just the current page.
 */

const TrafficAnalytics = require("../models/trafficAnalyticsSchema");

const EXPORT_FORMATS = new Set(["csv", "xlsx"]);

const safeFilename = (base) => {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `${base}_${stamp}`;
};

const csvCell = (value) => {
  if (value === null || value === undefined) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

async function sendExport(res, format, baseName, rows, columns) {
  const cols = (columns && columns.length ? columns : Object.keys(rows[0] || {}).map((k) => ({ key: k, label: k })))
    .filter((c) => !/Iso$/.test(c.key) && c.key !== "id");

  if (format === "csv") {
    const lines = [cols.map((c) => csvCell(c.label)).join(",")];
    rows.forEach((row) => lines.push(cols.map((c) => csvCell(row[c.key])).join(",")));
    const body = `﻿${lines.join("\r\n")}`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${safeFilename(baseName)}.csv"`);
    return res.send(body);
  }

  const ExcelJS = require("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "APACS Cargo Analytics";
  const ws = workbook.addWorksheet(baseName.slice(0, 31));
  ws.columns = cols.map((c) => ({
    header: c.label,
    key: c.key,
    width: Math.min(40, Math.max(12, c.label.length + 4)),
  }));
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A1E4D" } };
  ws.getRow(1).alignment = { vertical: "middle" };
  ws.getRow(1).height = 22;
  ws.views = [{ state: "frozen", ySplit: 1 }];
  rows.forEach((row) => {
    const out = {};
    cols.forEach((c) => {
      const v = row[c.key];
      out[c.key] = v && typeof v === "object" && !(v instanceof Date) ? JSON.stringify(v) : v;
    });
    ws.addRow(out);
  });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };

  const buffer = await workbook.xlsx.writeBuffer();
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${safeFilename(baseName)}.xlsx"`);
  return res.send(buffer);
}

const listHandler = (method, baseName, label) => async (req, res) => {
  const format = String(req.query.format || "json").toLowerCase();
  try {
    if (EXPORT_FORMATS.has(format)) {
      const result = await TrafficAnalytics[method](req.query, true);
      return sendExport(res, format, baseName, result.data, result.columns);
    }
    const result = await TrafficAnalytics[method](req.query, false);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error(`Traffic analytics ${label} error:`, error);
    return res.status(500).json({ success: false, message: `Failed to fetch ${label}` });
  }
};

exports.getFilterOptions = async (req, res) => {
  try {
    const options = await TrafficAnalytics.getFilterOptions();
    return res.status(200).json({ success: true, ...options });
  } catch (error) {
    console.error("Traffic analytics filter options error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch filter options" });
  }
};

exports.getOverview = async (req, res) => {
  try {
    const overview = await TrafficAnalytics.getOverview(req.query);
    return res.status(200).json({ success: true, ...overview });
  } catch (error) {
    console.error("Traffic analytics overview error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch cargo analytics overview" });
  }
};

exports.getJourney = async (req, res) => {
  try {
    const { container, vehicle } = req.query;
    if (!String(container || "").trim() && !String(vehicle || "").trim()) {
      return res.status(400).json({ success: false, message: "Provide a container or vehicle number" });
    }
    const journey = await TrafficAnalytics.getJourney({ container, vehicle });
    return res.status(200).json({ success: true, ...journey });
  } catch (error) {
    console.error("Traffic analytics journey error:", error);
    return res.status(500).json({ success: false, message: "Failed to build journey" });
  }
};

exports.getEirList = listHandler("getEirList", "tos_eir_records", "EIR records");
exports.getForm13List = listHandler("getForm13List", "tos_form13", "Form 13 records");
exports.getWeighbridgeList = listHandler("getWeighbridgeList", "weighbridge_records", "weighbridge records");
exports.getCustomsList = listHandler("getCustomsList", "customs_records", "customs records");
exports.getGateEventList = listHandler("getGateEventList", "gate_events", "gate events");
