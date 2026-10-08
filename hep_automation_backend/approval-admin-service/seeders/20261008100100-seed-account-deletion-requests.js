"use strict";

/**
 * Seeder: account_deletion_requests
 *
 * Inserts sample / demo deletion requests so developers can test the
 * Admin > Account Deletion Requests dashboard without having to submit
 * real requests through the UI.
 *
 * Safe to run multiple times — uses loginId dedup check.
 *
 * @type {import('sequelize-cli').Migration}
 */

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    // Helper to create an offset date
    const daysAgo = (d) => new Date(now - d * 24 * 60 * 60 * 1000);

    const allRequests = [
      // ── PENDING requests (awaiting admin review) ──────────────────────────
      {
        userId: null,
        userType: "agent",
        loginId: "1900001",
        email: "agent.kumar@chennaiport.gov.in",
        reason: "I have retired from service and no longer require access to APACS.",
        status: "PENDING",
        ipAddress: "192.168.1.101",
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36",
        reviewedBy: null,
        reviewedAt: null,
        adminNotes: null,
        createdAt: daysAgo(3),
        updatedAt: daysAgo(3),
      },
      {
        userId: null,
        userType: "agent",
        loginId: "1900045",
        email: "priya.devi@chennaiport.gov.in",
        reason: "Transferred to another department; access is no longer needed.",
        status: "PENDING",
        ipAddress: "10.0.0.55",
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 Safari/605.1.15",
        reviewedBy: null,
        reviewedAt: null,
        adminNotes: null,
        createdAt: daysAgo(1),
        updatedAt: daysAgo(1),
      },
      {
        userId: null,
        userType: "port_user",
        loginId: "portuser_arun",
        email: "arun.prakash@example.com",
        reason: "No longer associated with Chennai Port operations.",
        status: "PENDING",
        ipAddress: "172.16.5.22",
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
        reviewedBy: null,
        reviewedAt: null,
        adminNotes: null,
        createdAt: daysAgo(0),
        updatedAt: daysAgo(0),
      },

      // ── APPROVED requests ─────────────────────────────────────────────────
      {
        userId: null,
        userType: "agent",
        loginId: "1900012",
        email: "rajesh.transport@example.com",
        reason: "Business operations permanently closed.",
        status: "APPROVED",
        ipAddress: "192.168.2.10",
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0 Safari/537.36",
        reviewedBy: "admin_superuser",
        reviewedAt: daysAgo(5),
        adminNotes:
          "Verified closure documents. Account deactivated as per policy.",
        createdAt: daysAgo(10),
        updatedAt: daysAgo(5),
      },
      {
        userId: null,
        userType: "port_user",
        loginId: "portuser_kavitha",
        email: "kavitha.rajan@example.com",
        reason: "Duplicate account — using a different loginId.",
        status: "APPROVED",
        ipAddress: "10.10.1.88",
        userAgent:
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
        reviewedBy: "admin_superuser",
        reviewedAt: daysAgo(7),
        adminNotes:
          "Confirmed duplicate. Primary account (portuser_kavitha_v2) remains active.",
        createdAt: daysAgo(14),
        updatedAt: daysAgo(7),
      },

      // ── REJECTED requests ─────────────────────────────────────────────────
      {
        userId: null,
        userType: "agent",
        loginId: "1900099",
        email: "suresh.logistics@example.com",
        reason: "I forgot my password and wanted to create a new account.",
        status: "REJECTED",
        ipAddress: "192.168.3.77",
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/123.0 Safari/537.36",
        reviewedBy: "admin_superuser",
        reviewedAt: daysAgo(15),
        adminNotes:
          "Request rejected — password reset should be used instead of account deletion. User notified.",
        createdAt: daysAgo(20),
        updatedAt: daysAgo(15),
      },
    ];

    // ── Deduplication: skip loginIds already present ──────────────────────
    const [existingRows] = await queryInterface.sequelize.query(
      `SELECT "loginId" FROM "account_deletion_requests" WHERE "loginId" IN (:ids)`,
      {
        replacements: { ids: allRequests.map((r) => r.loginId) },
      }
    );

    const existingIds = new Set((existingRows || []).map((r) => r.loginId));
    const newRecords = allRequests.filter((r) => !existingIds.has(r.loginId));

    if (newRecords.length > 0) {
      await queryInterface.bulkInsert("account_deletion_requests", newRecords);
      console.log(
        `[SEEDER] account_deletion_requests: inserted ${newRecords.length} sample record(s).`
      );
    } else {
      console.log(
        "[SEEDER] account_deletion_requests: all sample records already exist, nothing inserted."
      );
    }
  },

  async down(queryInterface) {
    // Only deletes the sample/seeded loginIds — does NOT touch real data
    const seededLoginIds = [
      "1900001",
      "1900045",
      "portuser_arun",
      "1900012",
      "portuser_kavitha",
      "1900099",
    ];

    await queryInterface.sequelize.query(
      `DELETE FROM "account_deletion_requests" WHERE "loginId" IN (:ids)`,
      {
        replacements: { ids: seededLoginIds },
      }
    );

    console.log(
      "[SEEDER] account_deletion_requests: sample seed records removed."
    );
  },
};
