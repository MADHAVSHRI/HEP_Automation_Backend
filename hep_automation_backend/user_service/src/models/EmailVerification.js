const { pool } = require("../dbconfig/db");
const bcrypt = require("bcrypt");

/**
 * EmailVerification Model
 * 
 * Manages OTP-based email verification for public bulk pass requests.
 * Stores OTP hashes (bcrypt), tracks expiry, verification status, and attempts.
 * 
 * Requirements: 22.3, 22.4, 22.8
 */
const EmailVerification = {

  /**
   * Create a new email verification record
   * 
   * @param {Object} data - Verification data
   * @param {string} data.email - Email address to verify
   * @param {string} data.otp_hash - Bcrypt hashed OTP
   * @param {Date} data.expires_at - Expiry timestamp (10 minutes from creation)
   * @returns {Promise<Object>} Created verification record
   */
  async create(data) {
    const query = `
      INSERT INTO email_verifications (
        email,
        otp,
        expires_at,
        verified,
        attempts,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *
    `;

    const values = [
      data.email,
      data.otp_hash,
      data.expires_at,
      data.verified || false,
      data.attempts || 0
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  },

  /**
   * Find the latest verification record for an email
   * 
   * @param {string} email - Email address
   * @returns {Promise<Object|null>} Latest verification record or null
   */
  async findLatestByEmail(email) {
    const query = `
      SELECT
        id,
        email,
        otp as otp_hash,
        expires_at,
        verified,
        attempts,
        created_at
      FROM email_verifications
      WHERE email = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const result = await pool.query(query, [email]);
    return result.rows[0] || null;
  },

  /**
   * Get verification record by ID
   * 
   * @param {number} id - Verification record ID
   * @returns {Promise<Object|null>} Verification record or null
   */
  async getById(id) {
    const query = `
      SELECT
        id,
        email,
        otp as otp_hash,
        expires_at,
        verified,
        attempts,
        created_at
      FROM email_verifications
      WHERE id = $1
    `;

    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  },

  /**
   * Check if OTP is expired
   * 
   * @param {Object} verification - Verification record
   * @returns {boolean} True if expired, false otherwise
   */
  isExpired(verification) {
    if (!verification || !verification.expires_at) {
      return true;
    }
    
    const expiryTime = new Date(verification.expires_at).getTime();
    const currentTime = Date.now();
    
    return currentTime > expiryTime;
  },

  /**
   * Increment verification attempts counter
   * 
   * @param {number} id - Verification record ID
   * @returns {Promise<Object>} Updated verification record
   */
  async incrementAttempts(id) {
    const query = `
      UPDATE email_verifications
      SET attempts = attempts + 1
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [id]);
    return result.rows[0];
  },

  /**
   * Mark email as verified
   * 
   * @param {number} id - Verification record ID
   * @returns {Promise<Object>} Updated verification record
   */
  async markVerified(id) {
    const query = `
      UPDATE email_verifications
      SET verified = true
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [id]);
    return result.rows[0];
  },

  /**
   * Delete expired verification records (cleanup utility)
   * 
   * @returns {Promise<number>} Number of deleted records
   */
  async cleanupExpired() {
    const query = `
      DELETE FROM email_verifications
      WHERE expires_at < NOW()
    `;

    const result = await pool.query(query);
    return result.rowCount;
  },

  /**
   * Validate email format (RFC 5322 compliant)
   * 
   * @param {string} email - Email address to validate
   * @returns {boolean} True if valid, false otherwise
   */
  validateEmailFormat(email) {
    if (!email || typeof email !== 'string') {
      return false;
    }

    // RFC 5322 email validation regex
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    
    return emailRegex.test(email) && email.length <= 255;
  },

  /**
   * Generate a 6-digit OTP
   * 
   * @returns {string} 6-digit numeric OTP
   */
  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  },

  /**
   * Hash OTP using bcrypt
   * 
   * @param {string} otp - Plain text OTP
   * @returns {Promise<string>} Bcrypt hashed OTP
   */
  async hashOTP(otp) {
    const saltRounds = 10;
    return await bcrypt.hash(otp, saltRounds);
  },

  /**
   * Verify OTP against hash
   * 
   * @param {string} otp - Plain text OTP to verify
   * @param {string} hash - Bcrypt hash to compare against
   * @returns {Promise<boolean>} True if OTP matches, false otherwise
   */
  async verifyOTP(otp, hash) {
    if (!otp || !hash) {
      return false;
    }
    
    return await bcrypt.compare(otp, hash);
  },

  /**
   * Calculate expiry timestamp (10 minutes from now)
   * 
   * @returns {Date} Expiry timestamp
   */
  calculateExpiry() {
    const expiry = new Date();
    expiry.setMinutes(expiry.getMinutes() + 10);
    return expiry;
  },

  /**
   * Count verification requests for rate limiting
   * 
   * @param {string} email - Email address
   * @param {number} minutes - Time window in minutes
   * @returns {Promise<number>} Count of verification requests
   */
  async countRecentRequests(email, minutes) {
    const query = `
      SELECT COUNT(*) as count
      FROM email_verifications
      WHERE email = $1
        AND created_at > NOW() - INTERVAL '${minutes} minutes'
    `;

    const result = await pool.query(query, [email]);
    return parseInt(result.rows[0].count, 10);
  },

  /**
   * Check if email verification is within rate limits
   * 
   * Requirements: 22.12, 22.13
   * - 1 request per minute per email
   * - 5 requests per hour per email
   * 
   * @param {string} email - Email address
   * @returns {Promise<Object>} { allowed: boolean, reason: string }
   */
  async checkRateLimit(email) {
    // Check 1 request per minute
    const countLastMinute = await this.countRecentRequests(email, 1);
    if (countLastMinute >= 1) {
      return {
        allowed: false,
        reason: 'Rate limit exceeded. Please wait 1 minute before requesting another OTP.'
      };
    }

    // Check 5 requests per hour
    const countLastHour = await this.countRecentRequests(email, 60);
    if (countLastHour >= 5) {
      return {
        allowed: false,
        reason: 'Rate limit exceeded. You have reached the maximum of 5 OTP requests per hour.'
      };
    }

    return { allowed: true };
  }

};

module.exports = EmailVerification;
