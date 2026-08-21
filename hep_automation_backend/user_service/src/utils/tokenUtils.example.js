/**
 * Token Utilities Usage Examples
 * 
 * This file demonstrates how to use the token encryption utilities
 * for the Multiple Pass Submissions feature.
 */

// Load environment variables
require("dotenv").config();

const {
  generateUploadToken,
  encryptToken,
  decryptToken,
  verifyUploadToken
} = require("./tokenUtils");

// ============================================================================
// Example 1: Department-Initiated Workflow
// ============================================================================

console.log("=== Example 1: Department-Initiated Workflow ===\n");

// Step 1: Department creates a bulk pass with multiple submissions enabled
const departmentBatchId = 123;
const departmentSource = "DEPARTMENT";

// Generate JWT token
const deptJwt = generateUploadToken(departmentBatchId, departmentSource);
console.log("1. Generated JWT:", deptJwt.substring(0, 50) + "...");

// Encrypt the token for secure transmission
const deptEncryptedToken = encryptToken(deptJwt);
console.log("2. Encrypted Token:", deptEncryptedToken.substring(0, 50) + "...");

// This encrypted token would be sent to the applicant via email
const uploadLink = `https://hep.chennaiport.gov.in/bulk-upload/${deptEncryptedToken}`;
console.log("3. Upload Link:", uploadLink.substring(0, 80) + "...\n");

// ============================================================================
// Example 2: Public Request Workflow
// ============================================================================

console.log("=== Example 2: Public Request Workflow ===\n");

// Step 1: General Admin approves a public request
const parentRequestId = 456;
const publicSource = "PUBLIC_WEBSITE";

// Generate JWT token with longer expiry
const publicJwt = generateUploadToken(parentRequestId, publicSource, {
  expiresIn: "180d" // 6 months
});
console.log("1. Generated JWT:", publicJwt.substring(0, 50) + "...");

// Encrypt the token
const publicEncryptedToken = encryptToken(publicJwt);
console.log("2. Encrypted Token:", publicEncryptedToken.substring(0, 50) + "...");

// Send to applicant
const publicUploadLink = `https://hep.chennaiport.gov.in/bulk-upload/${publicEncryptedToken}`;
console.log("3. Upload Link:", publicUploadLink.substring(0, 80) + "...\n");

// ============================================================================
// Example 3: Token Validation (Backend API)
// ============================================================================

console.log("=== Example 3: Token Validation ===\n");

// When applicant accesses the upload link, backend validates the token
try {
  // Extract token from URL params
  const tokenFromUrl = deptEncryptedToken;
  
  // Verify and decrypt
  const payload = verifyUploadToken(tokenFromUrl);
  
  console.log("Token is valid!");
  console.log("Batch ID:", payload.batchId);
  console.log("Source:", payload.source);
  console.log("Type:", payload.type);
  console.log("Issued At:", new Date(payload.iat * 1000).toISOString());
  console.log("Expires At:", new Date(payload.exp * 1000).toISOString());
} catch (error) {
  console.error("Token validation failed:", error.message);
}

console.log("\n");

// ============================================================================
// Example 4: Error Handling
// ============================================================================

console.log("=== Example 4: Error Handling ===\n");

// Example: Invalid encrypted token
try {
  verifyUploadToken("invalid-token-string");
} catch (error) {
  console.log("✓ Caught invalid token error:", error.message);
}

// Example: Expired token
try {
  const shortLivedJwt = generateUploadToken(999, "DEPARTMENT", { expiresIn: "1s" });
  const shortLivedEncrypted = encryptToken(shortLivedJwt);
  
  // Wait for token to expire
  setTimeout(() => {
    try {
      verifyUploadToken(shortLivedEncrypted);
    } catch (error) {
      console.log("✓ Caught expired token error:", error.message);
    }
  }, 1500);
} catch (error) {
  console.log("Error:", error.message);
}

// Example: Invalid batch ID
try {
  generateUploadToken("not-a-number", "DEPARTMENT");
} catch (error) {
  console.log("✓ Caught invalid batchId error:", error.message);
}

// Example: Invalid source
try {
  generateUploadToken(123, "INVALID_SOURCE");
} catch (error) {
  console.log("✓ Caught invalid source error:", error.message);
}

console.log("\n");

// ============================================================================
// Example 5: Controller Integration Pattern
// ============================================================================

console.log("=== Example 5: Controller Integration Pattern ===\n");

// Pseudo-code for how to use in controllers

const exampleCreateBatchController = async (req, res) => {
  try {
    // ... batch creation logic ...
    
    const batchId = 123; // from database
    const source = req.body.source || "DEPARTMENT";
    
    // Generate and encrypt token
    const jwt = generateUploadToken(batchId, source);
    const encryptedToken = encryptToken(jwt);
    
    // Store encrypted token in database
    // await Batch.update({ token: encryptedToken }, { where: { id: batchId } });
    
    // Generate upload link
    const uploadLink = `${process.env.FRONTEND_BASE_URL}/bulk-upload/${encryptedToken}`;
    
    // Send email with link
    // await sendEmail(applicantEmail, uploadLink);
    
    console.log("✓ Batch created with upload link");
    // res.status(201).json({ uploadLink });
  } catch (error) {
    console.error("Error creating batch:", error.message);
    // res.status(500).json({ error: "Failed to create batch" });
  }
};

const exampleValidateTokenController = async (req, res) => {
  try {
    const { token } = req.params;
    
    // Verify and decrypt token
    const payload = verifyUploadToken(token);
    
    // Check if batch exists and is within validity period
    // const batch = await Batch.findByPk(payload.batchId);
    // if (!batch) return res.status(404).json({ error: "Batch not found" });
    
    // Check validity period
    // const now = new Date();
    // if (now > batch.validityUpto) {
    //   return res.status(403).json({ error: "The submission period has expired" });
    // }
    
    console.log("✓ Token validated successfully");
    // res.json({ 
    //   valid: true, 
    //   batchId: payload.batchId,
    //   source: payload.source
    // });
  } catch (error) {
    if (error.message.includes("expired")) {
      console.log("✓ Token expired");
      // res.status(403).json({ error: "Token has expired" });
    } else {
      console.log("✓ Invalid token");
      // res.status(401).json({ error: "Invalid token" });
    }
  }
};

console.log("Example controller patterns defined");
console.log("\n");

// ============================================================================
// Example 6: Manual Decrypt/Encrypt Operations
// ============================================================================

console.log("=== Example 6: Manual Operations ===\n");

// Sometimes you may need to decrypt a token without verifying JWT
const sampleToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJiYXRjaElkIjoxMjM...";
const encrypted = encryptToken(sampleToken);
console.log("Encrypted:", encrypted.substring(0, 40) + "...");

const decrypted = decryptToken(encrypted);
console.log("Decrypted:", decrypted.substring(0, 40) + "...");
console.log("Match:", decrypted === sampleToken);

console.log("\n=== All Examples Complete ===");
