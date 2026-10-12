const axios = require("axios");

const EMAIL_SERVICE_URL = process.env.EMAIL_SERVICE_URL || "http://localhost:5002";

const DEPARTMENT_NAMES = {
  1: "Traffic Department",
  2: "Marine Department",
  3: "Civil Engineering Department",
  4: "Mechanical Engineering Department",
  5: "CISF Security",
  6: "Pass Section",
  9: "Pass Section (Traffic Department)",
};

const getDepartmentName = (deptId) =>
  DEPARTMENT_NAMES[Number(deptId)] || "Chennai Port Authority";

/**
 * Dispatches an email request to the email_service.
 */
const postToEmailService = async (endpoint, payload) => {
  if (!EMAIL_SERVICE_URL) {
    console.warn(`[EssentialPassEmail] EMAIL_SERVICE_URL not configured; skipping ${endpoint}`);
    return false;
  }

  try {
    const url = `${EMAIL_SERVICE_URL.replace(/\/$/, "")}/api/email/${endpoint}`;
    const response = await axios.post(url, payload, {
      headers: {
        "x-service-name": "USER-SERVICE",
        "Content-Type": "application/json",
      },
      timeout: 8000,
    });

    if (response.data?.success) {
      console.log(`[EssentialPassEmail] Successfully dispatched ${endpoint} to ${payload.email}`);
      return true;
    } else {
      console.warn(`[EssentialPassEmail] ${endpoint} returned error:`, response.data);
      return false;
    }
  } catch (error) {
    console.error(
      `[EssentialPassEmail] Failed to send ${endpoint} to ${payload.email}:`,
      error.response?.data || error.message
    );
    return false;
  }
};

/**
 * Event 1: Notify agent that Essential Conversion Request was submitted.
 */
const notifyConversionSubmitted = async ({
  email,
  agentName,
  referenceNo,
  departmentId,
  purpose,
  conversionStartDate,
  conversionEndDate,
  items = [],
}) => {
  if (!email) return false;
  return postToEmailService("sendEssentialConversionSubmitted", {
    email,
    agentName,
    referenceNo,
    departmentName: getDepartmentName(departmentId),
    purpose,
    conversionStartDate,
    conversionEndDate,
    items,
    itemsCount: items.length,
  });
};

/**
 * Event 2: Notify agent and pass holder that Essential Conversion was approved.
 */
const notifyConversionApproved = async ({
  email,
  agentName,
  entityName,
  entityType,
  passNo,
  referenceNo,
  departmentId,
  validFrom,
  validUpto,
  qrLink,
}) => {
  if (!email) return false;
  return postToEmailService("sendEssentialPassApproved", {
    email,
    agentName,
    entityName,
    entityType,
    passNo,
    referenceNo,
    departmentName: getDepartmentName(departmentId),
    validFrom,
    validUpto,
    qrLink,
  });
};

/**
 * Event 3: Notify agent and pass holder that Essential Pass expired and reverted to Ordinary Pass.
 */
const notifyConversionExpired = async ({
  email,
  agentName,
  entityName,
  entityType,
  passNo,
  referenceNo,
  conversionStartDate,
  conversionEndDate,
  originalPassValidUpto,
  reapplyLink,
}) => {
  if (!email) return false;
  return postToEmailService("sendEssentialPassExpired", {
    email,
    agentName,
    entityName,
    entityType,
    passNo,
    referenceNo,
    conversionStartDate,
    conversionEndDate,
    originalPassValidUpto,
    reapplyLink,
  });
};

/**
 * Event 4: Notify agent and pass holder that Essential Conversion was reverted for corrections.
 */
const notifyConversionReverted = async ({
  email,
  agentName,
  entityName,
  entityType,
  passNo,
  referenceNo,
  departmentId,
  revertingDepartment,
  revertReason,
  loginLink,
}) => {
  if (!email) return false;
  return postToEmailService("sendEssentialPassReverted", {
    email,
    agentName,
    entityName,
    entityType,
    passNo,
    referenceNo,
    departmentName: getDepartmentName(departmentId),
    revertingDepartment: revertingDepartment || getDepartmentName(departmentId),
    revertReason,
    loginLink,
  });
};

module.exports = {
  getDepartmentName,
  notifyConversionSubmitted,
  notifyConversionApproved,
  notifyConversionExpired,
  notifyConversionReverted,
};

