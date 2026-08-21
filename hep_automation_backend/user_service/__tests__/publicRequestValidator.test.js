const {
    publicRequestSchema,
    validatePublicRequest,
    sanitizeInput
} = require('../src/validations/publicRequestValidator');

describe('Public Request Validator', () => {
    describe('sanitizeInput', () => {
        it('should remove HTML tags from input', () => {
            const input = '<script>alert("XSS")</script>Company Name';
            const result = sanitizeInput(input);
            expect(result).toBe('Company Name');
        });

        it('should return non-string input as-is', () => {
            expect(sanitizeInput(123)).toBe(123);
            expect(sanitizeInput(null)).toBe(null);
            expect(sanitizeInput(undefined)).toBe(undefined);
        });

        it('should remove all HTML attributes', () => {
            const input = '<div onclick="malicious()">Text</div>';
            const result = sanitizeInput(input);
            expect(result).toBe('Text');
        });
    });

    describe('publicRequestSchema', () => {
        const validRequest = {
            companyName: 'ABC Corporation Ltd.',
            applicantEmail: 'test@example.com',
            applicantMobile: '9876543210',
            visitorType: 'VENDOR',
            noOfPersons: 15,
            noOfVehicles: 5,
            validityFrom: new Date('2026-07-01'),
            validityUpto: new Date('2026-12-31'),
            paymentMode: 'CASH',
            purpose: 'Business meeting',
            workOrderRequired: false,
            refDocNo: 'REF-2026-001',
            remarks: 'Test remarks',
            captchaToken: '550e8400-e29b-41d4-a716-446655440000',
            captchaAnswer: '42',
            emailVerified: true
        };

        describe('companyName validation', () => {
            it('should accept valid company name', () => {
                const result = publicRequestSchema.safeParse(validRequest);
                expect(result.success).toBe(true);
            });

            it('should reject company name shorter than 3 characters', () => {
                const request = { ...validRequest, companyName: 'AB' };
                const result = publicRequestSchema.safeParse(request);
                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.issues[0].path[0]).toBe('companyName');
                }
            });

            it('should reject company name longer than 255 characters', () => {
                const request = { ...validRequest, companyName: 'A'.repeat(256) };
                const result = publicRequestSchema.safeParse(request);
                expect(result.success).toBe(false);
            });

            it('should sanitize and validate company name with invalid characters', () => {
                const request = { ...validRequest, companyName: 'Company<script>alert()</script>' };
                const result = publicRequestSchema.safeParse(request);
                // After sanitization, script tags and their content are removed, leaving just "Company"
                expect(result.success).toBe(true);
                if (result.success) {
                    expect(result.data.companyName).toBe('Company');
                }
            });

            it('should accept alphanumeric and basic punctuation', () => {
                const request = { ...validRequest, companyName: 'ABC Corp. & Co. (India) Ltd-123' };
                const result = publicRequestSchema.safeParse(request);
                expect(result.success).toBe(true);
            });
        });

        describe('applicantEmail validation', () => {
            it('should accept valid email', () => {
                const result = publicRequestSchema.safeParse(validRequest);
                expect(result.success).toBe(true);
            });

            it('should reject invalid email format', () => {
                const request = { ...validRequest, applicantEmail: 'invalid-email' };
                const result = publicRequestSchema.safeParse(request);
                expect(result.success).toBe(false);
            });

            it('should convert email to lowercase', () => {
                const request = { ...validRequest, applicantEmail: 'TEST@EXAMPLE.COM' };
                const result = publicRequestSchema.safeParse(request);
                expect(result.success).toBe(true);
                expect(result.data.applicantEmail).toBe('test@example.com');
            });

            it('should reject email longer than 255 characters', () => {
                const longEmail = 'a'.repeat(250) + '@test.com';
                const request = { ...validRequest, applicantEmail: longEmail };
                const result = publicRequestSchema.safeParse(request);
                expect(result.success).toBe(false);
            });
        });

        describe('applicantMobile validation', () => {
            it('should accept valid mobile starting with 6', () => {
                const request = { ...validRequest, applicantMobile: '6123456789' };
                const result = publicRequestSchema.safeParse(request);
                expect(result.success).toBe(true);
            });

            it('should accept valid mobile starting with 7', () => {
                const request = { ...validRequest, applicantMobile: '7123456789' };
                const result = publicRequestSchema.safeParse(request);
                expect(result.success).toBe(true);
            });

            it('should accept valid mobile starting with 8', () => {
                const request = { ...validRequest, applicantMobile: '8123456789' };
                const result = publicRequestSchema.safeParse(request);
                expect(result.success).toBe(true);
            });

            it('should accept valid mobile starting with 9', () => {
                const request = { ...validRequest, applicantMobile: '9123456789' };
                const result = publicRequestSchema.safeParse(request);
                expect(result.success).toBe(true);
            });

            it('should reject mobile not starting with 6-9', () => {
                const request = { ...validRequest, applicantMobile: '5123456789' };
                const result = publicRequestSchema.safeParse(request);
                expect(result.success).toBe(false);
            });

            it('should reject mobile with less than 10 digits', () => {
                const request = { ...validRequest, applicantMobile: '912345678' };
                const result = publicRequestSchema.safeParse(request);
                expect(result.success).toBe(false);
            });

            it('should reject mobile with more than 10 digits', () => {
                const request = { ...validRequest, applicantMobile: '91234567890' };
                const result = publicRequestSchema.safeParse(request);
                expect(result.success).toBe(false);
            });
        });

        describe('visitorType validation', () => {
            it('should accept VENDOR', () => {
                const request = { ...validRequest, visitorType: 'VENDOR' };
                const result = publicRequestSchema.safeParse(request);
                expect(result.success).toBe(true);
            });

            it('should accept CONTRACTOR', () => {
                const request = { ...validRequest, visitorType: 'CONTRACTOR' };
                const result = publicRequestSchema.safeParse(request);
                expect(result.success).toBe(true);
            });

            it('should accept VISITOR', () => {
                const request = { ...validRequest, visitorType: 'VISITOR' };
                const result = publicRequestSchema.safeParse(request);
                expect(result.success).toBe(true);
            });

            it('should accept TEMPORARY_STAFF', () => {
                const request = { ...validRequest, visitorType: 'TEMPORARY_STAFF' };
                const result = publicRequestSchema.safeParse(request);
                expect(result.success).toBe(true);
            });

            it('should reject invalid visitor type', () => {
                const request = { ...validRequest, visitorType: 'INVALID_TYPE' };
                const result = publicRequestSchema.safeParse(request);
                expect(result.success).toBe(false);
            });
        });

        describe('noOfPersons validation', () => {
            it('should accept 0 persons', () => {
                const request = { ...validRequest, noOfPersons: 0 };
                const result = publicRequestSchema.safeParse(request);
                expect(result.success).toBe(true);
            });

            it('should accept 30 persons (max)', () => {
                const request = { ...validRequest, noOfPersons: 30 };
                const result = publicRequestSchema.safeParse(request);
                expect(result.success).toBe(true);
            });

            it('should reject negative persons', () => {
                const request = { ...validRequest, noOfPersons: -1 };
                const result = publicRequestSchema.safeParse(request);
                expect(result.success).toBe(false);
            });

            it('should reject persons exceeding 30', () => {
                const request = { ...validRequest, noOfPersons: 31 };
                const result = publicRequestSchema.safeParse(request);
                expect(result.success).toBe(false);
            });

            it('should reject non-integer persons', () => {
                const request = { ...validRequest, noOfPersons: 15.5 };
                const result = publicRequestSchema.safeParse(request);
                expect(result.success).toBe(false);
            });
        });

        describe('noOfVehicles validation', () => {
            it('should accept 0 vehicles', () => {
                const request = { ...validRequest, noOfVehicles: 0 };
                const result = publicRequestSchema.safeParse(request);
                expect(result.success).toBe(true);
            });

            it('should accept 20 vehicles (max)', () => {
                const request = { ...validRequest, noOfVehicles: 20 };
                const result = publicRequestSchema.safeParse(request);
                expect(result.success).toBe(true);
            });

            it('should reject negative vehicles', () => {
                const request = { ...validRequest, noOfVehicles: -1 };
                const result = publicRequestSchema.safeParse(request);
                expect(result.success).toBe(false);
            });

            it('should reject vehicles exceeding 20', () => {
                const request = { ...validRequest, noOfVehicles: 21 };
                const result = publicRequestSchema.safeParse(request);
                expect(result.success).toBe(false);
            });
        });

        describe('validity date validation', () => {
            it('should accept future validity date', () => {
                const futureDate = new Date();
                futureDate.setDate(futureDate.getDate() + 30);
                const request = { 
                    ...validRequest, 
                    validityFrom: new Date(),
                    validityUpto: futureDate 
                };
                const result = publicRequestSchema.safeParse(request);
                expect(result.success).toBe(true);
            });

            it('should reject past validity date', () => {
                const pastDate = new Date('2020-01-01');
                const request = { 
                    ...validRequest, 
                    validityFrom: new Date('2019-12-01'),
                    validityUpto: pastDate 
                };
                const result = publicRequestSchema.safeParse(request);
                expect(result.success).toBe(false);
            });

            it('should reject when validityUpto is before validityFrom', () => {
                const request = {
                    ...validRequest,
                    validityFrom: new Date('2026-12-31'),
                    validityUpto: new Date('2026-07-01')
                };
                const result = publicRequestSchema.safeParse(request);
                expect(result.success).toBe(false);
            });

            it('should reject when validityUpto equals validityFrom', () => {
                const sameDate = new Date('2026-12-31');
                const request = {
                    ...validRequest,
                    validityFrom: sameDate,
                    validityUpto: sameDate
                };
                const result = publicRequestSchema.safeParse(request);
                expect(result.success).toBe(false);
            });
        });

        describe('paymentMode validation', () => {
            it('should accept CASH', () => {
                const request = { ...validRequest, paymentMode: 'CASH' };
                const result = publicRequestSchema.safeParse(request);
                expect(result.success).toBe(true);
            });

            it('should accept ONLINE', () => {
                const request = { ...validRequest, paymentMode: 'ONLINE' };
                const result = publicRequestSchema.safeParse(request);
                expect(result.success).toBe(true);
            });

            it('should accept CHEQUE', () => {
                const request = { ...validRequest, paymentMode: 'CHEQUE' };
                const result = publicRequestSchema.safeParse(request);
                expect(result.success).toBe(true);
            });

            it('should accept DD', () => {
                const request = { ...validRequest, paymentMode: 'DD' };
                const result = publicRequestSchema.safeParse(request);
                expect(result.success).toBe(true);
            });

            it('should reject invalid payment mode', () => {
                const request = { ...validRequest, paymentMode: 'CREDIT_CARD' };
                const result = publicRequestSchema.safeParse(request);
                expect(result.success).toBe(false);
            });

            it('should accept undefined payment mode (optional)', () => {
                const { paymentMode, ...requestWithoutPaymentMode } = validRequest;
                const result = publicRequestSchema.safeParse(requestWithoutPaymentMode);
                expect(result.success).toBe(true);
            });
        });

        describe('captchaToken validation', () => {
            it('should accept valid UUID', () => {
                const result = publicRequestSchema.safeParse(validRequest);
                expect(result.success).toBe(true);
            });

            it('should reject invalid UUID format', () => {
                const request = { ...validRequest, captchaToken: 'not-a-uuid' };
                const result = publicRequestSchema.safeParse(request);
                expect(result.success).toBe(false);
            });

            it('should reject missing captcha token', () => {
                const { captchaToken, ...requestWithoutToken } = validRequest;
                const result = publicRequestSchema.safeParse(requestWithoutToken);
                expect(result.success).toBe(false);
            });
        });

        describe('captchaAnswer validation', () => {
            it('should accept numeric string answer', () => {
                const request = { ...validRequest, captchaAnswer: '123' };
                const result = publicRequestSchema.safeParse(request);
                expect(result.success).toBe(true);
            });

            it('should reject non-numeric answer', () => {
                const request = { ...validRequest, captchaAnswer: 'abc' };
                const result = publicRequestSchema.safeParse(request);
                expect(result.success).toBe(false);
            });

            it('should reject alphanumeric answer', () => {
                const request = { ...validRequest, captchaAnswer: '12a' };
                const result = publicRequestSchema.safeParse(request);
                expect(result.success).toBe(false);
            });
        });

        describe('emailVerified validation', () => {
            it('should accept true value', () => {
                const result = publicRequestSchema.safeParse(validRequest);
                expect(result.success).toBe(true);
            });

            it('should reject false value', () => {
                const request = { ...validRequest, emailVerified: false };
                const result = publicRequestSchema.safeParse(request);
                expect(result.success).toBe(false);
            });

            it('should reject missing emailVerified', () => {
                const { emailVerified, ...requestWithoutVerified } = validRequest;
                const result = publicRequestSchema.safeParse(requestWithoutVerified);
                expect(result.success).toBe(false);
            });
        });

        describe('optional fields', () => {
            it('should accept empty optional fields', () => {
                const minimalRequest = {
                    companyName: 'ABC Corporation',
                    applicantEmail: 'test@example.com',
                    applicantMobile: '9876543210',
                    visitorType: 'VENDOR',
                    noOfPersons: 15,
                    noOfVehicles: 5,
                    validityFrom: new Date('2026-07-01'),
                    validityUpto: new Date('2026-12-31'),
                    captchaToken: '550e8400-e29b-41d4-a716-446655440000',
                    captchaAnswer: '42',
                    emailVerified: true
                };
                const result = publicRequestSchema.safeParse(minimalRequest);
                expect(result.success).toBe(true);
            });

            it('should validate purpose max length', () => {
                const request = { ...validRequest, purpose: 'A'.repeat(1001) };
                const result = publicRequestSchema.safeParse(request);
                expect(result.success).toBe(false);
            });

            it('should validate refDocNo pattern', () => {
                const request = { ...validRequest, refDocNo: 'REF/2026-001' };
                const result = publicRequestSchema.safeParse(request);
                expect(result.success).toBe(true);
            });

            it('should reject refDocNo with invalid characters', () => {
                const request = { ...validRequest, refDocNo: 'REF@2026#001' };
                const result = publicRequestSchema.safeParse(request);
                expect(result.success).toBe(false);
            });
        });
    });

    describe('validatePublicRequest middleware', () => {
        let req, res, next;

        beforeEach(() => {
            req = {
                body: {
                    companyName: 'ABC Corporation',
                    applicantEmail: 'test@example.com',
                    applicantMobile: '9876543210',
                    visitorType: 'VENDOR',
                    noOfPersons: 15,
                    noOfVehicles: 5,
                    validityFrom: new Date('2026-07-01'),
                    validityUpto: new Date('2026-12-31'),
                    paymentMode: 'CASH',
                    captchaToken: '550e8400-e29b-41d4-a716-446655440000',
                    captchaAnswer: '42',
                    emailVerified: true
                }
            };
            res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            next = jest.fn();
        });

        it('should call next() with valid request', () => {
            validatePublicRequest(req, res, next);
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
            expect(req.validatedData).toBeDefined();
        });

        it('should return 400 with validation errors for invalid request', () => {
            req.body.applicantMobile = '123'; // Invalid mobile
            validatePublicRequest(req, res, next);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    message: 'Validation failed',
                    errors: expect.any(Array)
                })
            );
            expect(next).not.toHaveBeenCalled();
        });

        it('should populate req.validatedData with sanitized values', () => {
            req.body.companyName = '<b>ABC</b> Corporation';
            validatePublicRequest(req, res, next);
            expect(next).toHaveBeenCalled();
            expect(req.validatedData.companyName).toBe('ABC Corporation');
        });

        it('should return multiple validation errors', () => {
            req.body = {
                companyName: 'AB', // Too short
                applicantEmail: 'invalid-email', // Invalid format
                applicantMobile: '123', // Invalid mobile
            };
            validatePublicRequest(req, res, next);
            expect(res.status).toHaveBeenCalledWith(400);
            const jsonCall = res.json.mock.calls[0][0];
            expect(jsonCall.errors.length).toBeGreaterThan(1);
        });
    });
});
