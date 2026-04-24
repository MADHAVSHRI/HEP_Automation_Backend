const AGENT_STATUS = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
});

const USER_ROLES = {
  USER: "user",
  TRAFFIC_ADMIN: "trafficAdmin",
  MARINE_ADMIN: "marineAdmin"
};

const PASS_ENTITY_STATUS = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected"
});

const PASS_REQUEST_STATUS = Object.freeze({
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  UNDER_REVIEW: "UNDER_REVIEW",
  COMPLETED: "COMPLETED"
});


const PASS_TYPES = [
  { value: "DAILY", label: "Daily Pass" ,id: 1},
  { value: "MONTHLY", label: "Monthly Pass", id: 2 },
  { value: "YEARLY", label: "Annual Pass", id: 3 }
];

const NATIONALITIES = [
  { value: "INDIAN", label: "Indian", id: 1 },
  { value: "FOREIGNER", label: "Foreigner", id: 2 }
];

const ID_PROOF_TYPES = [
  { value: "DRIVING LICENSE", label: "Driving License", id: 1 },
  { value: "PAN CARD", label: "PAN Card", id: 2 },
  { value: "PASSPORT", label: "Passport", id: 3 },
  { value: "ELECTION CARD", label: "Voter ID", id: 4 },
  { value: "COMPANY ID CARD", label: "Company ID", id: 5 }
];

const VISIT_PURPOSES = [
  { value: "BUSINESS", label: "Business", id: 1 },
  { value: "LEISURE", label: "Leisure", id: 2 },
  { value: "MEDICAL", label: "Medical", id: 3 }
];

const ACCESS_AREAS = [
  { value: "OIL JETTY AND OTHER GATES", label: "Oil Jetty and Other Gates", id: 1 },
  { value: "OTHER GATES ONLY", label: "Other Gates Only", id: 2 }
];

module.exports = {
  AGENT_STATUS,
  AGENT_STATUS_LIST: Object.values(AGENT_STATUS),
  USER_ROLES,
  USER_ROLES_LIST: Object.values(USER_ROLES),
  PASS_TYPES,
  NATIONALITIES,
  ID_PROOF_TYPES,
  ACCESS_AREAS,
  PASS_ENTITY_STATUS,
  PASS_ENTITY_STATUS_LIST: Object.values(PASS_ENTITY_STATUS),
  PASS_REQUEST_STATUS,
  PASS_REQUEST_STATUS_LIST: Object.values(PASS_REQUEST_STATUS)
};