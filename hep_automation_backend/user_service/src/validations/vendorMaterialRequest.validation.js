const { z } = require("zod");

const quantityPattern =
  /^\d{1,15}(?:\.\d{1,3})?$/;

const optionalText = (max) =>
  z.string().trim().max(max);

const itemSchema = z
  .object({
    materialType: z.enum([
      "RETURNABLE",
      "NON_RETURNABLE",
    ]),

    name: z
      .string()
      .trim()
      .min(1, "Enter the material name.")
      .max(255),

    isHazardous: z.boolean(),

    // The frontend sends null when quantity is unspecified.
    requestedQty: z
      .union([
        z.string().trim(),
        z.null(),
      ]),

    unitId: z
      .union([
        z.number().int().positive(),
        z.null(),
      ]),

    description: optionalText(1000),
  })
  .strict()
  .superRefine((item, ctx) => {
    const quantity = item.requestedQty || "";
    const hasQuantity = quantity !== "";
    const hasUnit = item.unitId !== null;

    if (
      item.materialType === "RETURNABLE" ||
      hasQuantity
    ) {
      const valid =
        quantityPattern.test(quantity) &&
        BigInt(
          quantity.replace(".", "")
        ) > 0n;

      if (!valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["requestedQty"],
          message:
            "Enter a positive quantity with up to 3 decimal places.",
        });
      }
    }

    if (
      item.materialType === "RETURNABLE" &&
      !hasUnit
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["unitId"],
        message:
          "Select a unit for returnable material.",
      });
    }

    if (
      item.materialType === "NON_RETURNABLE" &&
      hasQuantity !== hasUnit
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [hasQuantity ? "unitId" : "requestedQty"],
        message:
          "For non-returnable material, provide both quantity and unit, or leave both empty.",
      });
    }
  });

const vendorMaterialRequestSchema = z
  .object({
    vehicleNumber: z
      .string()
      .trim()
      .toUpperCase()
      .refine(
        (value) =>
          !value ||
          /^[A-Z0-9 -]{3,20}$/.test(value),
        "Enter a valid vehicle number."
      ),

    personName: optionalText(150),

    aadhaarNumber: z
      .string()
      .trim()
      .refine(
        (value) =>
          !value ||
          /^\d{12}$/.test(value),
        "Aadhaar must contain exactly 12 digits."
      ),

    permittedGateIds: z
      .array(
        z
          .number()
          .int()
          .positive()
          .max(Number.MAX_SAFE_INTEGER)
      )
      .max(
        11,
        "Select at most 11 gates."
      )
      .refine(
        (ids) =>
          new Set(ids).size === ids.length,
        "Duplicate gates are not allowed."
      )
      .optional(),

    vendorRemarks: optionalText(1000),

    agreed: z.literal(true, {
      errorMap: () => ({
        message:
          "Confirm the information before submitting.",
      }),
    }),

    items: z
      .array(itemSchema)
      .min(
        1,
        "Add at least one material."
      )
      .max(
        60,
        "Too many materials."
      ),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (
      data.aadhaarNumber &&
      !data.personName
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["personName"],
        message:
          "Enter the person's name when providing Aadhaar.",
      });
    }

    const counts = {
      RETURNABLE: 0,
      NON_RETURNABLE: 0,
    };

    const seen = new Set();

    data.items.forEach((item, index) => {
      counts[item.materialType] += 1;

      const key =
        `${item.materialType}:` +
        item.name.toLowerCase();

      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [
            "items",
            index,
            "name",
          ],
          message:
            "This material is already listed in the same category.",
        });
      }

      seen.add(key);
    });

    for (
      const [type, count]
      of Object.entries(counts)
    ) {
      if (count > 30) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["items"],
          message:
            `Add no more than 30 ${type === "RETURNABLE"
              ? "returnable"
              : "non-returnable"
            } materials.`,
        });
      }
    }
  });

module.exports = {
  vendorMaterialRequestSchema,
};