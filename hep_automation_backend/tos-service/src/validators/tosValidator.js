const {
  TERMINAL_LIST,
  MOVEMENT_TYPE_LIST,
  FULL_EMPTY_LIST,
  YES_NO_LIST,
} = require("../constants/constants");

function normalizeTerminal(terminal) {
  if (!terminal || typeof terminal !== "string") return terminal;
  const t = terminal.trim().toUpperCase();
  if (t === "CCTL" || t === "CCTPL" || t.includes("CHENNAI CONTAINER TERMINAL")) {
    return "CCTPL";
  }
  if (t === "CITPL" || t.includes("CHENNAI INTERNATIONAL")) {
    return "CITPL";
  }
  return terminal.trim().toUpperCase();
}

function deriveContainerSize(containerISO, containerSize) {
  if (containerSize) return String(containerSize);
  if (!containerISO || typeof containerISO !== "string") return "20";

  const iso = containerISO.trim();
  const firstChar = iso.charAt(0);

  if (firstChar === "2") return "20";
  if (firstChar === "4" || firstChar === "9" || firstChar === "L") return "40";
  if (iso.startsWith("45")) return "45";

  return "20";
}

function normalizeEirItem(item) {
  if (!item || typeof item !== "object") return null;

  const rawTerminal = item.terminal || item.TERMINAL_CODE || item.TERMINAL_NAME || null;
  const terminal = normalizeTerminal(rawTerminal);
  const inGateRaw = item.inGateDateTime || item.GATEINTIME || item.BOXARRIVALTIME || null;
  const outGateRaw = item.outGateDateTime || item.GATEOUTTIME || item.BOXDEPTTIME || null;

  const containerNumber = item.containerNumber || item.Container || item.ContainerNumber || null;
  const containerISO = item.containerISO || item.ISOcode || null;
  const containerSize = deriveContainerSize(containerISO, item.containerSize);

  let movementType = item.movementType || item.ImpExp || null;
  if (movementType === "E") movementType = "Export";
  if (movementType === "I") movementType = "Import";

  let fullEmpty = item.fullEmpty || item.Emptytruck || null;
  if (fullEmpty === "Y") fullEmpty = "Empty";
  if (fullEmpty === "N") fullEmpty = "Full";

  const line = item.line || item.LinerID || null;
  const trailerNumber = item.trailerNumber || item.TruckNumber || null;

  const rawOoc = item.oocStatus || item.OocStatus || item.OOC_STATUS || item.OOC || null;
  let oocStatus = null;
  if (rawOoc) {
    const v = String(rawOoc).trim().toUpperCase();
    if (v === "Y" || v === "YES") oocStatus = "Yes";
    else if (v === "N" || v === "NO") oocStatus = "No";
    else oocStatus = rawOoc;
  }

  const destinationGroup = item.destinationGroup || item.GROUPCODE || null;
  const destinationName = item.destinationName || item.Destination || null;

  const rawScan = item.markedForScanning || item.MarkedForScanning || item.MARKED_FOR_SCANNING || item.MARKED_FOR_SCAN || item.Scanning || item.SCANNING || null;
  let markedForScanning = null;
  if (rawScan) {
    const v = String(rawScan).trim().toUpperCase();
    if (v === "Y" || v === "YES") markedForScanning = "Yes";
    else if (v === "N" || v === "NO") markedForScanning = "No";
    else markedForScanning = rawScan;
  }

  const eirNo = item.eirNo || null;

  return {
    eirNo,
    terminal,
    inGateDateTime: inGateRaw ? new Date(inGateRaw) : null,
    outGateDateTime: outGateRaw ? new Date(outGateRaw) : null,
    containerNumber,
    containerISO,
    containerSize,
    movementType,
    fullEmpty,
    line,
    trailerNumber,
    oocStatus,
    destinationGroup,
    destinationName,
    markedForScanning,
  };
}

function normalizeForm13Payload(payload) {
  if (!payload || typeof payload !== "object") return payload;

  const normalized = { ...payload };

  if (normalized.terminal) {
    normalized.terminal = normalizeTerminal(normalized.terminal);
  }

  let rawContainers = normalized.containers;
  if (rawContainers === undefined || rawContainers === null) {
    if (normalized.container !== undefined && normalized.container !== null) {
      rawContainers = normalized.container;
    }
  }

  let containersArray = null;

  if (Array.isArray(rawContainers)) {
    containersArray = rawContainers;
  } else if (rawContainers && typeof rawContainers === "object") {
    containersArray = [rawContainers];
  } else if (
    normalized.movementType !== undefined ||
    normalized.containerNumber !== undefined ||
    normalized.containerISO !== undefined ||
    normalized.containerSize !== undefined
  ) {
    containersArray = [
      {
        movementType: normalized.movementType,
        containerNumber: normalized.containerNumber,
        containerISO: normalized.containerISO,
        containerSize: normalized.containerSize,
        containerType: normalized.containerType,
      },
    ];
  }

  if (Array.isArray(containersArray)) {
    normalized.containers = containersArray.map((c) => {
      if (!c || typeof c !== "object") return c;

      let movementType = c.movementType;
      if (typeof movementType === "string") {
        const mtUpper = movementType.trim().toUpperCase();
        if (mtUpper === "E" || mtUpper === "EXPORT") {
          movementType = "Export";
        } else if (mtUpper === "I" || mtUpper === "IMPORT") {
          movementType = "Import";
        }
      }

      const containerISO = c.containerISO || c.ISOcode || null;
      const containerNumber = c.containerNumber || c.ContainerNumber || c.Container || null;
      const containerSize = deriveContainerSize(containerISO, c.containerSize);
      const containerType = c.containerType || null;

      return {
        ...c,
        movementType,
        containerNumber,
        containerISO,
        containerSize,
        containerType,
      };
    });
  } else {
    normalized.containers = rawContainers;
  }

  return normalized;
}

function validateForm13Payload(payload) {
  const errors = [];
  if (!payload || typeof payload !== "object") {
    return ["Invalid payload format"];
  }

  const normalized = normalizeForm13Payload(payload);
  const { terminal, trailerNumber, containers } = normalized;

  if (!terminal) errors.push("terminal is required");
  if (!trailerNumber) errors.push("trailerNumber is required");

  if (terminal && !TERMINAL_LIST.includes(terminal)) {
    errors.push(`Invalid terminal '${terminal}'. Allowed values: ${TERMINAL_LIST.join(", ")}`);
  }

  if (!Array.isArray(containers) || containers.length === 0) {
    errors.push("containers is required");
    return errors;
  }

  if (containers.length > 4) {
    errors.push("maximum 4 container objects are allowed");
  }

  const exportContainers = containers.filter((item) => item && item.movementType === "Export");
  const importContainers = containers.filter((item) => item && item.movementType === "Import");

  if (exportContainers.length > 2) {
    errors.push("maximum 2 Export containers are allowed");
  }

  if (importContainers.length > 2) {
    errors.push("maximum 2 Import containers are allowed");
  }

  containers.forEach((item, index) => {
    if (!item || typeof item !== "object") {
      errors.push(`containers[${index}] must be an object`);
      return;
    }

    if (!MOVEMENT_TYPE_LIST.includes(item.movementType)) {
      errors.push(
        `containers[${index}].movementType is invalid. Allowed values: ${MOVEMENT_TYPE_LIST.join(", ")}`,
      );
      return;
    }

    if (item.movementType === "Export") {
      if (!item.containerNumber) {
        errors.push(`containers[${index}].containerNumber is required for Export`);
      }
      if (!item.containerISO) {
        errors.push(`containers[${index}].containerISO is required for Export`);
      }
      if (!item.containerSize) {
        errors.push(`containers[${index}].containerSize is required for Export`);
      }
    }
  });

  return errors;
}

function validateEirItem(item) {
  const errors = [];

  if (!item || typeof item !== "object") {
    return { valid: false, errors: ["Invalid payload item format"] };
  }

  const requiredNonNullable = [
    "terminal",
    "inGateDateTime",
    "outGateDateTime",
    "containerNumber",
    "containerISO",
    "containerSize",
    "movementType",
    "fullEmpty",
    "line",
    "trailerNumber",
    "destinationGroup",
  ];

  const missing = requiredNonNullable.filter(
    (field) => item[field] === undefined || item[field] === null || item[field] === "",
  );

  if (missing.length) {
    errors.push(`Missing required fields: ${missing.join(", ")}`);
  }

  if (item.terminal && !TERMINAL_LIST.includes(item.terminal)) {
    errors.push(`Invalid terminal '${item.terminal}'. Allowed: ${TERMINAL_LIST.join(", ")}`);
  }

  if (item.movementType && !MOVEMENT_TYPE_LIST.includes(item.movementType)) {
    errors.push(`Invalid movementType '${item.movementType}'. Allowed: ${MOVEMENT_TYPE_LIST.join(", ")}`);
  }

  if (item.fullEmpty && !FULL_EMPTY_LIST.includes(item.fullEmpty)) {
    errors.push(`Invalid fullEmpty '${item.fullEmpty}'. Allowed: ${FULL_EMPTY_LIST.join(", ")}`);
  }

  if (item.oocStatus && !YES_NO_LIST.includes(item.oocStatus)) {
    errors.push(`Invalid oocStatus '${item.oocStatus}'. Allowed: ${YES_NO_LIST.join(", ")}`);
  }

  if (item.markedForScanning && !YES_NO_LIST.includes(item.markedForScanning)) {
    errors.push(`Invalid markedForScanning '${item.markedForScanning}'. Allowed: ${YES_NO_LIST.join(", ")}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

module.exports = {
  deriveContainerSize,
  normalizeTerminal,
  normalizeEirItem,
  normalizeForm13Payload,
  validateForm13Payload,
  validateEirItem,
};
