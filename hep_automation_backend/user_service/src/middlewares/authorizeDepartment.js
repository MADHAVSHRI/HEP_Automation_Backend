/**
 * authorizeDepartment.js
 *
 * Middleware to authorize access based on the user's departmentName
 * (from the port_departments table, embedded in the JWT during login).
 *
 * Usage:
 *   authorizeDepartment("General Administration")
 *   authorizeDepartment("General Administration", "Traffic")
 *
 * The check is case-insensitive to avoid mismatches from minor casing
 * differences between the DB value and the middleware argument.
 */
module.exports = (...allowedDepartments) => {
  // Normalise allowed department names once at registration time
  const normalised = allowedDepartments.map((d) => d.toLowerCase().trim());

  return (req, res, next) => {
    const userDept = (req.user?.departmentName || "").toLowerCase().trim();

    if (!userDept || !normalised.includes(userDept)) {
      return res.status(403).json({
        message: "Access denied — your department is not authorised for this action",
      });
    }

    next();
  };
};
