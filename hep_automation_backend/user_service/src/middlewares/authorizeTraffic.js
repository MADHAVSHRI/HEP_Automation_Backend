/**
 * authorizeTraffic.js — user_service
 *
 * Guards the Traffic Department cargo-analytics endpoints. Allows:
 *  - global admins
 *  - Traffic Manager roles (tm / traffic manager / traffic_manager)
 *  - Shipping Control roles (ss / sm / asm)
 *  - approval-type roles whose department is a Traffic department
 *    (Traffic, Traffic Operation, Traffic B-Section, ...)
 *  - any role whose name itself contains "traffic"
 *
 * Mirrors the role/department rules in HEP_Frontend/src/lib/roleRouting.js and
 * approval-admin-service/src/middlewares/authorizeTrafficApprover.js.
 * Must run AFTER verifyToken (which populates req.user from the JWT).
 */

const ADMIN_ROLES = new Set(["admin", "administrator", "super admin", "superadmin"]);
const TM_ROLES = new Set(["tm", "traffic manager", "traffic_manager"]);
const SHIPPING_CONTROL_ROLES = new Set(["ss", "sm", "asm"]);
const TRAFFIC_APPROVAL_ROLES = new Set([
  "approval",
  "hod",
  "safety officer",
  "senior deputy traffic manager",
]);

module.exports = (req, res, next) => {
  const role = String(req.user?.role || "").toLowerCase().trim();
  const deptName = String(req.user?.departmentName || "").toLowerCase().trim();

  const allowed =
    ADMIN_ROLES.has(role) ||
    TM_ROLES.has(role) ||
    SHIPPING_CONTROL_ROLES.has(role) ||
    role.includes("traffic") ||
    (TRAFFIC_APPROVAL_ROLES.has(role) && deptName.includes("traffic"));

  if (!allowed) {
    return res.status(403).json({
      success: false,
      message: "Access denied: Traffic Department role required",
    });
  }

  next();
};
