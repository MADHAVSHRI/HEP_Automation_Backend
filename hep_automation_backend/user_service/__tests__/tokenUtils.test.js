const {
  generateUploadToken,
  encryptToken,
  decryptToken,
  verifyUploadToken
} = require("../src/utils/tokenUtils");

// Mock environment variables before requiring the module
process.env.ENCRYPTION_KEY = "8a5d3c2f1e9b7a4c6d8e2f1a3b5c7d9e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c";
process.env.ENCRYPTION_IV = "f4e3d2c1b0a9876543210fedcba98765";
process.env.UPLOAD_TOKEN_SECRET = "a7b9c3d1e5f2a8b4c6d0e9f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1";

describe("Token Utils - Multiple Pass Submissions", () => {
  
  describe("generateUploadToken", () => {
    it("should generate a valid JWT token with correct payload", () => {
      const batchId = 123;
      const source = "DEPARTMENT";
      
      const token = generateUploadToken(batchId, source);
      
      expect(token).toBeTruthy();
      expect(typeof token).toBe("string");
      expect(token.split(".").length).toBe(3); // JWT has 3 parts
    });

    it("should generate token with PUBLIC_WEBSITE source", () => {
      const batchId = 456;
      const source = "PUBLIC_WEBSITE";
      
      const token = generateUploadToken(batchId, source);
      
      expect(token).toBeTruthy();
      expect(typeof token).toBe("string");
    });

    it("should throw error for invalid batchId", () => {
      expect(() => {
        generateUploadToken(null, "DEPARTMENT");
      }).toThrow("Invalid batchId");
      
      expect(() => {
        generateUploadToken("invalid", "DEPARTMENT");
      }).toThrow("Invalid batchId");
    });

    it("should throw error for invalid source", () => {
      expect(() => {
        generateUploadToken(123, "INVALID_SOURCE");
      }).toThrow("Invalid source");
      
      expect(() => {
        generateUploadToken(123, null);
      }).toThrow("Invalid source");
    });

    it("should accept custom expiresIn option", () => {
      const batchId = 789;
      const source = "DEPARTMENT";
      
      const token = generateUploadToken(batchId, source, { expiresIn: "7d" });
      
      expect(token).toBeTruthy();
    });
  });

  describe("encryptToken", () => {
    it("should encrypt a token successfully", () => {
      const plainToken = "myPlainTextToken123";
      
      const encrypted = encryptToken(plainToken);
      
      expect(encrypted).toBeTruthy();
      expect(typeof encrypted).toBe("string");
      expect(encrypted).not.toBe(plainToken);
    });

    it("should produce different output each time with random IV... wait, same IV", () => {
      const plainToken = "myPlainTextToken123";
      
      const encrypted1 = encryptToken(plainToken);
      const encrypted2 = encryptToken(plainToken);
      
      // With fixed IV, should be same
      expect(encrypted1).toBe(encrypted2);
    });

    it("should throw error for invalid token input", () => {
      expect(() => {
        encryptToken(null);
      }).toThrow("Invalid token");
      
      expect(() => {
        encryptToken("");
      }).toThrow("Invalid token");
      
      expect(() => {
        encryptToken(123);
      }).toThrow("Invalid token");
    });
  });

  describe("decryptToken", () => {
    it("should decrypt an encrypted token successfully", () => {
      const plainToken = "myPlainTextToken123";
      
      const encrypted = encryptToken(plainToken);
      const decrypted = decryptToken(encrypted);
      
      expect(decrypted).toBe(plainToken);
    });

    it("should decrypt a JWT token", () => {
      const jwt = generateUploadToken(123, "DEPARTMENT");
      
      const encrypted = encryptToken(jwt);
      const decrypted = decryptToken(encrypted);
      
      expect(decrypted).toBe(jwt);
    });

    it("should throw error for invalid encrypted token", () => {
      expect(() => {
        decryptToken(null);
      }).toThrow("Invalid encrypted token");
      
      expect(() => {
        decryptToken("");
      }).toThrow("Invalid encrypted token");
    });

    it("should throw error for corrupted encrypted data", () => {
      expect(() => {
        decryptToken("invalidBase64EncryptedData");
      }).toThrow();
    });
  });

  describe("verifyUploadToken", () => {
    it("should verify a valid encrypted upload token", () => {
      const batchId = 123;
      const source = "DEPARTMENT";
      
      const jwt = generateUploadToken(batchId, source);
      const encrypted = encryptToken(jwt);
      
      const payload = verifyUploadToken(encrypted);
      
      expect(payload).toBeTruthy();
      expect(payload.batchId).toBe(batchId);
      expect(payload.source).toBe(source);
      expect(payload.type).toBe("upload_token");
      expect(payload.iat).toBeTruthy();
    });

    it("should verify token with PUBLIC_WEBSITE source", () => {
      const batchId = 456;
      const source = "PUBLIC_WEBSITE";
      
      const jwt = generateUploadToken(batchId, source);
      const encrypted = encryptToken(jwt);
      
      const payload = verifyUploadToken(encrypted);
      
      expect(payload.batchId).toBe(batchId);
      expect(payload.source).toBe(source);
    });

    it("should throw error for invalid encrypted token", () => {
      expect(() => {
        verifyUploadToken(null);
      }).toThrow("Invalid encrypted token");
      
      expect(() => {
        verifyUploadToken("");
      }).toThrow("Invalid encrypted token");
    });

    it("should throw error for expired token", (done) => {
      const batchId = 999;
      const source = "DEPARTMENT";
      
      // Generate token with 1 second expiry
      const jwt = generateUploadToken(batchId, source, { expiresIn: "1s" });
      const encrypted = encryptToken(jwt);
      
      // Wait for token to expire
      setTimeout(() => {
        expect(() => {
          verifyUploadToken(encrypted);
        }).toThrow("Token has expired");
        done();
      }, 1500);
    }, 3000);

    it("should throw error for token with invalid signature", () => {
      const batchId = 123;
      const source = "DEPARTMENT";
      
      // Generate token
      const jwt = generateUploadToken(batchId, source);
      
      // Tamper with the token
      const parts = jwt.split(".");
      parts[2] = "tamperedSignature";
      const tamperedJwt = parts.join(".");
      
      const encrypted = encryptToken(tamperedJwt);
      
      expect(() => {
        verifyUploadToken(encrypted);
      }).toThrow("Invalid token signature");
    });

    it("should throw error for non-upload-token type", () => {
      const jwt = require("jsonwebtoken");
      const secret = process.env.UPLOAD_TOKEN_SECRET;
      
      // Create a token with wrong type
      const wrongToken = jwt.sign(
        { batchId: 123, source: "DEPARTMENT", type: "wrong_type" },
        secret
      );
      
      const encrypted = encryptToken(wrongToken);
      
      expect(() => {
        verifyUploadToken(encrypted);
      }).toThrow("Invalid token type");
    });
  });

  describe("End-to-end workflow", () => {
    it("should handle complete token lifecycle for department workflow", () => {
      const batchId = 1001;
      const source = "DEPARTMENT";
      
      // Step 1: Generate JWT
      const jwt = generateUploadToken(batchId, source);
      expect(jwt).toBeTruthy();
      
      // Step 2: Encrypt JWT
      const encrypted = encryptToken(jwt);
      expect(encrypted).toBeTruthy();
      expect(encrypted).not.toBe(jwt);
      
      // Step 3: Decrypt and verify
      const payload = verifyUploadToken(encrypted);
      expect(payload.batchId).toBe(batchId);
      expect(payload.source).toBe(source);
      expect(payload.type).toBe("upload_token");
    });

    it("should handle complete token lifecycle for public website workflow", () => {
      const batchId = 2002;
      const source = "PUBLIC_WEBSITE";
      
      // Step 1: Generate JWT
      const jwt = generateUploadToken(batchId, source);
      
      // Step 2: Encrypt JWT
      const encrypted = encryptToken(jwt);
      
      // Step 3: Decrypt and verify
      const payload = verifyUploadToken(encrypted);
      expect(payload.batchId).toBe(batchId);
      expect(payload.source).toBe(source);
    });

    it("should handle multiple tokens independently", () => {
      const batch1 = { id: 100, source: "DEPARTMENT" };
      const batch2 = { id: 200, source: "PUBLIC_WEBSITE" };
      
      const token1 = encryptToken(generateUploadToken(batch1.id, batch1.source));
      const token2 = encryptToken(generateUploadToken(batch2.id, batch2.source));
      
      expect(token1).not.toBe(token2);
      
      const payload1 = verifyUploadToken(token1);
      const payload2 = verifyUploadToken(token2);
      
      expect(payload1.batchId).toBe(batch1.id);
      expect(payload1.source).toBe(batch1.source);
      expect(payload2.batchId).toBe(batch2.id);
      expect(payload2.source).toBe(batch2.source);
    });
  });
});
