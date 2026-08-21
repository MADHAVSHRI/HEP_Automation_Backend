# Rate Limiting Middleware - Usage Guide

## Overview

The `rateLimitMiddleware.js` provides Redis-based rate limiting for the Multiple Pass Submissions feature. It implements three types of rate limiting:

1. **OTP Rate Limiting** - Controls OTP request frequency
2. **CAPTCHA Rate Limiting** - Prevents brute-force CAPTCHA attacks
3. **Public Request Rate Limiting** - Limits public bulk pass request submissions

## Requirements Implemented

- **22.12**: 1 OTP request per minute per email
- **22.13**: 5 OTP requests per hour per email
- **23.11**: 10 failed CAPTCHA attempts per IP before blocking
- **19.1**: IP-based rate limiting (20 OTP requests per hour per IP)
- **31.1-31.5**: Public request rate limiting and security controls

## Middleware Functions

### 1. OTP Rate Limiting

**Limits:**
- 1 request per minute per email
- 5 requests per hour per email
- 20 requests per hour per IP

**Usage in Routes:**
```javascript
const { otpRateLimiter } = require('../middlewares/rateLimitMiddleware');

router.post('/api/bulk-pass/public/request-otp', otpRateLimiter, requestOTPController);
```

**Direct Function Usage:**
```javascript
const { checkOTPRateLimit } = require('../middlewares/rateLimitMiddleware');

async function requestOTP(req, res) {
  const email = req.body.email;
  const ipAddress = req.ip;
  
  const result = await checkOTPRateLimit(email, ipAddress);
  
  if (!result.allowed) {
    return res.status(429).json({
      success: false,
      message: result.message,
      retryAfter: result.retryAfter
    });
  }
  
  // Continue with OTP generation...
}
```

### 2. CAPTCHA Rate Limiting

**Limits:**
- 10 failed attempts per 15 minutes per IP
- 1 hour IP block after 10 failed attempts

**Usage in Routes:**
```javascript
const { captchaRateLimiter } = require('../middlewares/rateLimitMiddleware');

router.post('/api/captcha/verify-captcha', captchaRateLimiter, verifyCaptchaController);
```

**Recording CAPTCHA Failures:**
```javascript
const { recordCAPTCHAFailure } = require('../middlewares/rateLimitMiddleware');

async function verifyCaptcha(req, res) {
  const ipAddress = req.ip;
  const isValid = validateCaptcha(req.body.token, req.body.answer);
  
  if (!isValid) {
    // Record the failure
    await recordCAPTCHAFailure(ipAddress);
    
    return res.status(401).json({
      success: false,
      message: "Incorrect CAPTCHA answer"
    });
  }
  
  // Continue with valid CAPTCHA...
}
```

### 3. Public Request Rate Limiting

**Limits:**
- 1 request per 24 hours per email
- 5 requests per hour per IP

**Usage in Routes:**
```javascript
const { publicRequestRateLimiter } = require('../middlewares/rateLimitMiddleware');

router.post(
  '/api/bulk-pass/public/request',
  publicRequestRateLimiter,
  validatePublicRequest,
  submitPublicRequestController
);
```

## Response Format

All rate limiting middleware returns 429 status code when limits are exceeded:

```json
{
  "success": false,
  "message": "Too many OTP requests. Please try again after 45 seconds.",
  "retryAfter": 45
}
```

## Redis Key Naming Conventions

The middleware uses the following Redis key patterns:

### OTP Rate Limits
- `ratelimit:otp:email:minute:{email}` - TTL: 60 seconds
- `ratelimit:otp:email:hour:{email}` - TTL: 3600 seconds (1 hour)
- `ratelimit:otp:ip:hour:{ipAddress}` - TTL: 3600 seconds (1 hour)

### CAPTCHA Rate Limits
- `ratelimit:captcha:failures:{ipAddress}` - TTL: 900 seconds (15 minutes)
- `ratelimit:captcha:block:{ipAddress}` - TTL: 3600 seconds (1 hour)

### Public Request Rate Limits
- `ratelimit:publicrequest:email:day:{email}` - TTL: 86400 seconds (24 hours)
- `ratelimit:publicrequest:ip:hour:{ipAddress}` - TTL: 3600 seconds (1 hour)

## Error Handling

The middleware implements "fail-open" behavior. If Redis is unavailable or an error occurs, the request is allowed through to prevent blocking legitimate users due to infrastructure issues.

```javascript
try {
  // Rate limiting logic...
} catch (error) {
  console.error("Rate limit check error:", error);
  return { allowed: true }; // Fail open
}
```

## IP Address Extraction

The middleware extracts IP addresses from multiple sources to work with different proxy configurations:

```javascript
const ipAddress = req.ip || 
                  req.connection.remoteAddress || 
                  req.headers['x-forwarded-for']?.split(',')[0];
```

## Testing

To test the rate limiting functionality:

1. Make multiple requests to OTP endpoint
2. Verify that second request within 1 minute is blocked
3. Check that error message includes retry time
4. Verify Redis keys are created with correct TTL

Example test:
```javascript
const request = require('supertest');
const app = require('../app');

describe('OTP Rate Limiting', () => {
  it('should block second OTP request within 1 minute', async () => {
    const email = 'test@example.com';
    
    // First request - should succeed
    await request(app)
      .post('/api/bulk-pass/public/request-otp')
      .send({ email })
      .expect(200);
    
    // Second request - should be rate limited
    const response = await request(app)
      .post('/api/bulk-pass/public/request-otp')
      .send({ email })
      .expect(429);
    
    expect(response.body.message).toContain('Too many OTP requests');
    expect(response.body.retryAfter).toBeLessThanOrEqual(60);
  });
});
```

## Security Considerations

1. **Redis Availability**: Rate limiting depends on Redis. Monitor Redis health.
2. **Key Expiry**: All keys have TTL to prevent memory leaks.
3. **Fail Open**: If Redis fails, requests are allowed (trade-off for availability).
4. **IP Spoofing**: Trust proxy headers carefully. Configure Express `trust proxy` setting.
5. **Distributed Systems**: This implementation works per server instance. For load-balanced systems, Redis provides shared state.

## Maintenance

### Monitoring

Monitor these metrics:
- Rate limit hit rate (how often 429 responses are sent)
- Redis memory usage for rate limit keys
- Failed CAPTCHA attempts per IP
- OTP request patterns

### Adjusting Limits

To adjust rate limits, modify the constants in the middleware:

```javascript
// Example: Change OTP minute limit from 1 to 2
if (emailMinuteCount && parseInt(emailMinuteCount) >= 2) { // Changed from 1
  // ...
}
```

Remember to update the documentation and requirements if limits are changed.
