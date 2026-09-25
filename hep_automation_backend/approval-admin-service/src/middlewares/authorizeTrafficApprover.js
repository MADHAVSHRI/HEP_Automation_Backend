/**
 * authorizeTrafficApprover.js — approval-admin-service
 *
 * Guards Bulk Pass state-changing routes (approve / reject / undo / finalize /
 * return / resend). Without this, every such route was protected by verifyToken
 * only, so ANY authenticated user from ANY department could approve persons,
 * finalize batches (issuing real QR passes + "approved" emails), or reject/return
 * batches — the gateway forwards a trusted service key to user_service, which
 * does not re-check the role for these actions.
 *
 * The role/department test mirrors the read-side check in
 * user_service bulkPassController.getBatchDetail, so any officer who can already
 * open a batch detail can still act on it.
 *
 * Must run AFTER verifyToken (which populates req.user from the JWT).
 */
module.exports = (req, res, next) => {
  const role = (req.user?.role || "").toLowerCase();
  const deptName = (req.user?.departmentName || "").toLowerCase();

  const isAdmin =
    role === "admin" ||
    role === "administrator" ||
    role === "super admin" ||
    role === "superadmin";
  const isTrafficApprover =
    (role === "approval" && deptName.includes("traffic")) || role.includes("traffic");

  if (!isAdmin && !isTrafficApprover) {
    return res.status(403).json({
      success: false,
      message: "Access denied: Traffic approver role required",
    });
  }

  next();
};
