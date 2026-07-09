const MOVEMENT_TYPE = Object.freeze({
  EXPORT: "export",
  IMPORT: "import"
});

const WEIGHT_UNIT = Object.freeze({
  KG: "kg",
  TON: "ton",
  LB: "lb",
  G: "g"
});

module.exports = {
  MOVEMENT_TYPE,
  MOVEMENT_TYPE_LIST: Object.values(MOVEMENT_TYPE),
  WEIGHT_UNIT,
  WEIGHT_UNIT_LIST: Object.values(WEIGHT_UNIT)
};
