const { z } = require("zod");
const sanitizeHtml = require("sanitize-html");

/**
 * Sanitizes text input to prevent XSS attacks
 * Validates: Requirements 21.15
 * 
 * @param {string} input - The input string to sanitize
 * @returns {string|*} - Sanitized string or original input if not a string
 */
function sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    
    // Strip all HTML tags - sanitize-html returns text content without tags
    // The textFilter option is used to get plain text output
    const sanitized = sanitizeHtml(input, {
        allowedTags: [],
        allowedAttributes: {},
        textFilter: function(text) {
            // Decode HTML entities that sanitize-html may have encoded
            return text
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#x27;/g, "'")
                .replace(/&#x2F;/g, '/');
        }
    });
    
    return sanitized;
}

/**
 * Public Request Validation Schema
 * Validates all fields for public bulk pass request submission
 * Validates: Requirements 21.3-21.9, 21.15
 */
const publicRequestSchema = z.object({
    // Validates: Requirement 21.3 - Company name validation
    companyName: z
        .string({
            required_error: "Company name is required.",
        })
        .trim()
        .transform(sanitizeInput)
        .pipe(
            z.string()
                .min(3, "Company name must be at least 3 characters.")
                .max(255, "Company name cannot exceed 255 characters.")
                .regex(
                    /^[a-zA-Z0-9\s\.\-,&()]+$/,
                    "Company name contains invalid characters. Only alphanumeric characters and basic punctuation (.,&-()) are allowed."
                )
        ),

    // Validates: Requirement 21.8 - Email format validation (RFC 5322)
    applicantEmail: z
        .string({
            required_error: "Applicant email is required.",
        })
        .trim()
        .transform(sanitizeInput)
        .pipe(
            z.string()
                .email("Invalid email format. Please provide a valid email address.")
                .max(255, "Email cannot exceed 255 characters.")
                .toLowerCase()
        ),

    // Validates: Requirement 21.9 - Mobile number validation (10 digits, starts with 6-9)
    applicantMobile: z
        .string({
            required_error: "Applicant mobile number is required.",
        })
        .regex(
            /^[6-9]\d{9}$/,
            "Invalid mobile number. Must be 10 digits starting with 6, 7, 8, or 9."
        ),

    // Validates: Requirement 21.3 - Visitor type validation
    visitorType: z
        .enum(['VENDOR', 'CONTRACTOR', 'VISITOR', 'TEMPORARY_STAFF'], {
            errorMap: () => ({ message: "Invalid visitor type. Must be one of: VENDOR, CONTRACTOR, VISITOR, TEMPORARY_STAFF." })
        }),

    // Validates: Requirement 21.6 - Number of persons validation (0-30)
    noOfPersons: z
        .number({
            required_error: "Number of persons is required.",
            invalid_type_error: "Number of persons must be a number.",
        })
        .int("Number of persons must be a whole number.")
        .min(0, "Number of persons cannot be negative.")
        .max(30, "Number of persons cannot exceed 30."),

    // Validates: Requirement 21.7 - Number of vehicles validation (0-20)
    noOfVehicles: z
        .number({
            required_error: "Number of vehicles is required.",
            invalid_type_error: "Number of vehicles must be a number.",
        })
        .int("Number of vehicles must be a whole number.")
        .min(0, "Number of vehicles cannot be negative.")
        .max(20, "Number of vehicles cannot exceed 20."),

    // Validates: Requirement 21.5 - Validity from date (optional for public form)
    validityFrom: z
        .string()
        .optional()
        .transform((val) => {
            if (!val || val === "") return undefined;
            const d = new Date(val);
            return isNaN(d.getTime()) ? undefined : d;
        }),

    // Validates: Requirement 21.3 - Validity upto date (future date)
    validityUpto: z
        .coerce
        .date({
            required_error: "Validity upto date is required.",
            invalid_type_error: "Invalid date format for validity upto.",
        })
        .refine((date) => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const selectedDate = new Date(date);
            selectedDate.setHours(0, 0, 0, 0);
            return selectedDate > today;
        }, {
            message: "Validity date must be in the future.",
        }),

    // Validates: Requirement 21.3 - Payment mode validation
    paymentMode: z
        .enum(['CASH', 'ONLINE', 'CHEQUE', 'DD'], {
            errorMap: () => ({ message: "Invalid payment mode. Must be one of: CASH, ONLINE, CHEQUE, DD." })
        })
        .optional(),

    // Optional fields
    purpose: z
        .string()
        .trim()
        .transform(value => value === "" ? undefined : sanitizeInput(value))
        .pipe(
            z.string()
                .max(1000, "Purpose cannot exceed 1000 characters.")
                .optional()
        )
        .optional(),

    workOrderRequired: z
        .boolean({
            invalid_type_error: "Work order required must be a boolean.",
        })
        .optional(),

    refDocNo: z
        .string()
        .trim()
        .transform(value => value === "" ? undefined : sanitizeInput(value))
        .pipe(
            z.string()
                .max(100, "Reference document number cannot exceed 100 characters.")
                .regex(
                    /^[a-zA-Z0-9\-\/]*$/,
                    "Reference document number contains invalid characters. Only alphanumeric, hyphen, and forward slash are allowed."
                )
                .optional()
        )
        .optional(),

    remarks: z
        .string()
        .trim()
        .transform(value => value === "" ? undefined : sanitizeInput(value))
        .pipe(
            z.string()
                .max(1000, "Remarks cannot exceed 1000 characters.")
                .optional()
        )
        .optional(),

    // Validates: Requirement 21.3 - CAPTCHA token validation
    // Optional: captcha is already verified during the OTP request step;
    // if provided here, the controller will re-verify.
    captchaToken: z
        .string()
        .uuid("Invalid CAPTCHA token format.")
        .optional(),

    // Validates: Requirement 21.3 - CAPTCHA answer validation
    // Optional: captcha is already verified during the OTP request step.
    captchaAnswer: z
        .string()
        .regex(/^\d+$/, "CAPTCHA answer must be numeric.")
        .optional(),

    // Validates: Email verification requirement
    emailVerified: z
        .boolean({
            required_error: "Email verification is required.",
            invalid_type_error: "Email verified must be a boolean.",
        })
        .refine((val) => val === true, {
            message: "Email must be verified before submission.",
        }),
})
.strict()
.superRefine((data, ctx) => {
    // Validates: Requirement 21.5 - Validity from date must be before validity upto date
    if (data.validityFrom && data.validityUpto) {
        const fromDate = new Date(data.validityFrom);
        const uptoDate = new Date(data.validityUpto);
        fromDate.setHours(0, 0, 0, 0);
        uptoDate.setHours(0, 0, 0, 0);

        if (fromDate >= uptoDate) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["validityUpto"],
                message: "Validity upto date must be after validity from date.",
            });
        }
    }
});

/**
 * Middleware function to validate public request data
 * Validates: Requirements 21.3-21.9, 21.15
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
function validatePublicRequest(req, res, next) {
    try {
        const result = publicRequestSchema.safeParse(req.body);

        if (!result.success) {
            const errors = result.error.issues.map(err => ({
                field: err.path.join('.'),
                message: err.message
            }));

            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors
            });
        }

        // Store validated and sanitized data
        req.validatedData = result.data;
        next();
    } catch (error) {
        console.error("Validation error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error during validation"
        });
    }
}

module.exports = {
    publicRequestSchema,
    validatePublicRequest,
    sanitizeInput
};
