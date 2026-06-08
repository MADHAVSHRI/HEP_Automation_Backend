const { z } = require("zod");

const changePasswordSchema = z
  .object({
    loginId: z.string().min(1, "Login ID is required"),

    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(15, "Password cannot exceed 15 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(
        /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/,
        "Password must contain at least one special character"
      ),

    confirmPassword: z.string()
  })
  .refine(
    (data) => data.newPassword === data.confirmPassword,
    {
      message: "Passwords do not match",
      path: ["confirmPassword"]
    }
  )
  .refine(
    (data) => data.newPassword !== "APPROVAL",
    {
      message: "New password cannot be APPROVAL",
      path: ["newPassword"]
    }
  );

module.exports = {
  changePasswordSchema
};