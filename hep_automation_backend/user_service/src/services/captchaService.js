const crypto = require('crypto');
const redisClient = require('../../config/redisClient');

/**
 * CAPTCHA Service for generating and verifying math-based CAPTCHA challenges
 * Implements Requirements: 23.1-23.5, 23.9
 */

const CAPTCHA_TTL = 120; // 120 seconds as per Requirement 23.5
const CAPTCHA_KEY_PREFIX = 'captcha:';

/**
 * Generate a math-based CAPTCHA challenge
 * Requirement 23.1: Display a math-based CAPTCHA challenge
 * Requirement 23.2: Generate simple arithmetic questions (X + Y or X - Y with single-digit integers)
 * Requirement 23.3: Generate a unique UUID token for each CAPTCHA challenge
 * 
 * @returns {Object} Object containing question and token
 * @returns {string} return.question - The math question (e.g., "What is 7 + 5?")
 * @returns {string} return.token - Unique UUID token for this CAPTCHA
 * @returns {number} return.expiresIn - TTL in seconds
 */
const generateCaptcha = () => {
  // Generate two single-digit random numbers (0-9)
  const num1 = Math.floor(Math.random() * 10);
  const num2 = Math.floor(Math.random() * 10);
  
  // Randomly choose between addition and subtraction
  const operation = Math.random() < 0.5 ? '+' : '-';
  
  let answer;
  let question;
  
  if (operation === '+') {
    answer = num1 + num2;
    question = `${num1} + ${num2} = ?`;
  } else {
    // For subtraction, ensure the result is non-negative
    if (num1 >= num2) {
      answer = num1 - num2;
      question = `${num1} - ${num2} = ?`;
    } else {
      answer = num2 - num1;
      question = `${num2} - ${num1} = ?`;
    }
  }
  
  // Generate unique UUID token (Requirement 23.3)
  const token = crypto.randomUUID();
  
  return {
    question,
    token,
    answer,
    expiresIn: CAPTCHA_TTL
  };
};

/**
 * Store CAPTCHA answer in Redis with TTL
 * Requirement 23.4: Store the correct answer in Redis with the UUID token as the key
 * Requirement 23.5: Set the CAPTCHA expiry to 120 seconds
 * 
 * @param {string} token - UUID token for the CAPTCHA
 * @param {number} answer - The correct answer to store
 * @returns {Promise<boolean>} True if stored successfully
 * @throws {Error} If Redis operation fails
 */
const storeCaptchaAnswer = async (token, answer) => {
  try {
    const key = `${CAPTCHA_KEY_PREFIX}${token}`;
    
    // Store answer with 120 second TTL (Requirement 23.5)
    await redisClient.setEx(key, CAPTCHA_TTL, answer.toString());
    
    return true;
  } catch (error) {
    console.error('Error storing CAPTCHA answer in Redis:', error);
    throw new Error('Failed to store CAPTCHA answer');
  }
};

/**
 * Verify CAPTCHA answer and delete token from Redis
 * Requirement 23.9: Delete the CAPTCHA token from Redis after verification attempt to enforce one-time use
 * 
 * @param {string} token - UUID token for the CAPTCHA
 * @param {string|number} answer - The answer provided by the user
 * @returns {Promise<boolean>} True if answer is correct, false otherwise
 * @throws {Error} If Redis operation fails
 */
const verifyCaptcha = async (token, answer) => {
  try {
    const key = `${CAPTCHA_KEY_PREFIX}${token}`;
    
    // Retrieve the stored answer from Redis
    const storedAnswer = await redisClient.get(key);
    
    // Delete the token from Redis immediately (Requirement 23.9 - one-time use)
    await redisClient.del(key);
    
    // If no stored answer found, token is invalid or expired
    if (storedAnswer === null) {
      return false;
    }
    
    // Compare answers (convert both to strings for comparison)
    return storedAnswer === answer.toString();
  } catch (error) {
    console.error('Error verifying CAPTCHA:', error);
    throw new Error('Failed to verify CAPTCHA');
  }
};

module.exports = {
  generateCaptcha,
  storeCaptchaAnswer,
  verifyCaptcha
};
