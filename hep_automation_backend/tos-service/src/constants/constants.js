const TERMINAL = Object.freeze({
  CCTL: "CCTL",
  CITPL: "CITPL",
});

const MOVEMENT_TYPE = Object.freeze({
  EXPORT: "Export",
  IMPORT: "Import",
});

const FULL_EMPTY = Object.freeze({
  FULL: "Full",
  EMPTY: "Empty",
});

const YES_NO = Object.freeze({
  YES: "Yes",
  NO: "No",
});

module.exports = {
  TERMINAL,
  TERMINAL_LIST: Object.values(TERMINAL),
  MOVEMENT_TYPE,
  MOVEMENT_TYPE_LIST: Object.values(MOVEMENT_TYPE),
  FULL_EMPTY,
  FULL_EMPTY_LIST: Object.values(FULL_EMPTY),
  YES_NO,
  YES_NO_LIST: Object.values(YES_NO),
};
