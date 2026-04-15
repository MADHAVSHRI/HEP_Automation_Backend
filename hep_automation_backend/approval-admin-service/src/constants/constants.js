const DEPARTMENT_USER_ACCOUNT_STATUS = Object.freeze({
  ACTIVE: "active",
  INACTIVE: "inactive",
  DISABLED: "disabled",
});

module.exports = {
    DEPARTMENT_USER_ACCOUNT_STATUS,
    DEPARTMENT_USER_ACCOUNT_STATUS_LIST: Object.values(DEPARTMENT_USER_ACCOUNT_STATUS)
};
