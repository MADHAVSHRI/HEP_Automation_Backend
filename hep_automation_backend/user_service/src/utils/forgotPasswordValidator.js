const { z } = require("zod");

const forgotPasswordValidator = z
  .object({
    identifier: z
      .string()
      .trim()
      .min(1, "Login ID or Email is required"),

    otp: z
      .string()
      .trim()
      .length(6, "OTP must be 6 digits"),

    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(15, "Password cannot exceed 32 characters")
      .regex(
        /[A-Z]/,
        "Password must contain at least one uppercase letter"
      )
      .regex(
        /[a-z]/,
        "Password must contain at least one lowercase letter"
      )
      .regex(
        /[0-9]/,
        "Password must contain at least one number"
      )
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

module.exports = forgotPasswordValidator;
