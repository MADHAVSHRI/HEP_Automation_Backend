const { z } = require("zod");

const parseBoolean = z.preprocess(
  (value) => {
    if (
      value === true ||
      value === "true" ||
      value === "1"
    ) {
      return true;
    }

    if (
      value === false ||
      value === "false" ||
      value === "0"
    ) {
      return false;
    }

    return value;
  },
  z.boolean({
    required_error:
      "Work Order applicability is required.",
    invalid_type_error:
      "Invalid Work Order applicability value.",
  })
);

const parseGateIds = z.preprocess(
  (value) => {
    if (value === undefined) {
      return [];
    }

    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }

    return value;
  },
  z
    .array(
      z.preprocess(
        (value) => {
          if (
            typeof value === "string" &&
            /^[1-9]\d*$/.test(value)
          ) {
            return Number(value);
          }

          return value;
        },
        z
          .number()
          .int()
          .positive()
          .max(Number.MAX_SAFE_INTEGER)
      )
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
);

const optionalTrimmedString = (
  maximumLength,
  errorMessage
) =>
  z
    .string()
    .trim()
    .max(
      maximumLength,
      errorMessage
    )
    .optional()
    .nullable()
    .transform(
      (value) =>
        value || null
    );

function getTodayInIndia() {
  const parts =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone:
          "Asia/Kolkata",

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",
      }
    ).formatToParts(
      new Date()
    );

  const dateParts = {};

  for (const part of parts) {
    if (
      part.type === "year" ||
      part.type === "month" ||
      part.type === "day"
    ) {
      dateParts[part.type] =
        part.value;
    }
  }

  return (
    `${dateParts.year}-` +
    `${dateParts.month}-` +
    `${dateParts.day}`
  );
}

function isValidDateString(
  value
) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      value
    )
  ) {
    return false;
  }

  const [
    year,
    month,
    day,
  ] = value
    .split("-")
    .map(Number);

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  return (
    date.getUTCFullYear() ===
      year &&
    date.getUTCMonth() ===
      month - 1 &&
    date.getUTCDate() ===
      day
  );
}

function addCalendarMonths(
  dateString,
  numberOfMonths
) {
  const [
    year,
    month,
    day,
  ] = dateString
    .split("-")
    .map(Number);

  const targetMonthIndex =
    month -
    1 +
    numberOfMonths;

  const targetYear =
    year +
    Math.floor(
      targetMonthIndex / 12
    );

  const normalizedMonthIndex =
    (
      (
        targetMonthIndex %
        12
      ) +
      12
    ) % 12;

  const daysInTargetMonth =
    new Date(
      Date.UTC(
        targetYear,
        normalizedMonthIndex +
          1,
        0
      )
    ).getUTCDate();

  const targetDay =
    Math.min(
      day,
      daysInTargetMonth
    );

  return (
    `${targetYear}-` +
    `${String(
      normalizedMonthIndex + 1
    ).padStart(2, "0")}-` +
    `${String(
      targetDay
    ).padStart(2, "0")}`
  );
}

const dateSchema = (
  requiredMessage
) =>
  z
    .string({
      required_error:
        requiredMessage,
    })
    .trim()
    .refine(
      isValidDateString,
      "Enter a valid date in YYYY-MM-DD format."
    );

const vendorMaterialLinkSchema = z
  .object({
    companyName: z
      .string({
        required_error:
          "Company name is required.",
      })
      .trim()
      .min(
        2,
        "Company name must contain at least 2 characters."
      )
      .max(
        100,
        "Company name must not exceed 100 characters."
      ),

    vendorEmail: z
      .string({
        required_error:
          "Vendor email is required.",
      })
      .trim()
      .toLowerCase()
      .email(
        "Enter a valid vendor email."
      )
      .max(
        254,
        "Vendor email is too long."
      ),

    vendorMobile: z
      .string({
        required_error:
          "Vendor mobile number is required.",
      })
      .trim()
      .regex(
        /^[6-9]\d{9}$/,
        "Enter a valid 10-digit Indian mobile number."
      ),

    purposeOfVisitId: z.coerce
      .number({
        required_error:
          "Purpose of material movement is required.",
        invalid_type_error:
          "Invalid purpose of material movement.",
      })
      .int(
        "Purpose ID must be an integer."
      )
      .positive(
        "Purpose of material movement is required."
      ),

    /*
     * The controller will make this mandatory
     * only when the selected database purpose
     * is Others.
     */
    purposeOther:
      optionalTrimmedString(
        250,
        "Purpose details must not exceed 250 characters."
      ),

    /*
     * Gate selection is optional during link
     * generation. If no gates are selected,
     * this becomes an empty array.
     */
    permittedGateIds:
      parseGateIds.default([]),

    validFrom:
      dateSchema(
        "Validity start date is required."
      ),

    validTo:
      dateSchema(
        "Validity end date is required."
      ),

    /*
     * Indicates whether a Work Order document
     * was selected. It does not make the Work
     * Order number mandatory.
     *
     */
    hasWorkOrder:
      parseBoolean.default(
        false
      ),

    /*
     * Work Order / PO / Requisition reference
     * number is optional.
     */
    referenceDocumentNo:
      optionalTrimmedString(
        60,
        "Reference document number must not exceed 60 characters."
      ),

    remarks:
      optionalTrimmedString(
        500,
        "Remarks must not exceed 500 characters."
      ),
    
    gateSelectionMode: z
      .enum([
        "DEPARTMENT",
        "VENDOR",
      ])
      .default("DEPARTMENT"),

    requiresTrafficApproval: z.preprocess(
      (value) => {
        if (value === undefined) {
          return false;
        }

        if (
          value === true ||
          value === "true"
        ) {
          return true;
        }

        if (
          value === false ||
          value === "false"
        ) {
          return false;
        }

        return value;
      },
      z.boolean({
        invalid_type_error:
          "Invalid Traffic approval setting.",
      })
    ),
  })
  .superRefine(
    (data, context) => {
      if (
        data.gateSelectionMode === "DEPARTMENT" &&
        data.permittedGateIds.length === 0
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["permittedGateIds"],
          message:
            "Please select at least one gate.",
        });
      }

      if (
        data.gateSelectionMode === "VENDOR" &&
        data.permittedGateIds.length > 0
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["permittedGateIds"],
          message:
            "Clear department gates when the vendor will select gates.",
        });
      }

      /*
      * Avoid calendar calculations on invalid dates.
      * The individual date fields already report the error.
      */
      if (
        !isValidDateString(data.validFrom) ||
        !isValidDateString(data.validTo)
      ) {
        return;
      }

      const todayInIndia =
        getTodayInIndia();

      if (
        data.validFrom <
        todayInIndia
      ) {
        context.addIssue({
          code:
            z.ZodIssueCode
              .custom,

          path: [
            "validFrom",
          ],

          message:
            "Validity start date cannot be in the past.",
        });
      }

      if (
        data.validTo <
        data.validFrom
      ) {
        context.addIssue({
          code:
            z.ZodIssueCode
              .custom,

          path: [
            "validTo",
          ],

          message:
            "Validity end date must be on or after the start date.",
        });

        return;
      }

      const maximumValidTo =
        addCalendarMonths(
          data.validFrom,
          6
        );

      if (
        data.validTo >
        maximumValidTo
      ) {
        context.addIssue({
          code:
            z.ZodIssueCode
              .custom,

          path: [
            "validTo",
          ],

          message:
            "Link validity cannot exceed six months.",
        });
      }
    }
  );

const revokeVendorMaterialLinkSchema =
  z.object({
    reason: z
      .string({
        required_error:
          "Revocation reason is required.",
      })
      .trim()
      .min(
        5,
        "Revocation reason must contain at least 5 characters."
      )
      .max(
        500,
        "Revocation reason must not exceed 500 characters."
      ),
  });

module.exports = {
  vendorMaterialLinkSchema,
  revokeVendorMaterialLinkSchema,
};