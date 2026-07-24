const { z } = require("zod");


const materialSchema = z.object({
    name: z
        .string({
            required_error: "Please enter an item.",
        })
        .trim()
        .min(1, "Please enter an item.")
        .max(100, "Item name cannot exceed 100 characters."),

    quantity: z
        .number({
            required_error: "Please enter a quantity.",
            invalid_type_error: "Quantity must be a number.",
        })
        .int("Quantity must be a whole number.")
        .positive("Please enter a valid quantity."),
    
    unit: z
        .number({
            required_error: "Please select a unit.",
            invalid_type_error: "Unit must be a number.",
        })
        .int("Invalid unit.")
        .positive("Please select a unit."),
    
    description: z
        .string()
        .trim()
        .max(250, "Description cannot exceed 250 characters.")
        .transform(value => value === "" ? undefined : value)
        .optional(),
});

const materialPassRequestSchema = z.object({
    purpose: z
        .number({
            required_error: "Please select a purpose of visit.",
            invalid_type_error: "Purpose must be a number.",
        })
        .int()
        .positive(),
    
    purposeOther: z
        .string()
        .trim()
        .max(250, "Purpose cannot exceed 250 characters.")
        .transform(value => value === "" ? undefined : value)
        .optional(),
    
    concernedDepartment: z
        .number({
            required_error: "Please select a department.",
            invalid_type_error: "Department must be a number.",
        })
        .int()
        .positive(),
    
    location: z
        .number({
            required_error: "Please select a location.",
            invalid_type_error: "Location must be a number.",
        })
        .int()
        .positive(),

    locationOther: z
        .string()
        .trim()
        .max(250, "Location cannot exceed 250 characters.")
        .transform(value => value === "" ? undefined : value)
        .optional(),

    entryDate: z
        .coerce
        .date()
        .refine((date) => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const selectedDate = new Date(date);
            selectedDate.setHours(0, 0, 0, 0);

            return selectedDate >= today;
        }, {
            message: "Entry date cannot be before today.",
        }),

    returnables: z.array(materialSchema).default([]),

    nonReturnables: z.array(materialSchema).default([]),
})
.strict()
.superRefine((data, ctx) => {
    // At least one material should be present
    if (
        data.returnables.length === 0 &&
        data.nonReturnables.length === 0
    ) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["returnables"],
            message:
                "Please add at least one Returnable or Non-Returnable material.",
        });
    }
})

module.exports = {
    materialSchema,
    materialPassRequestSchema
}