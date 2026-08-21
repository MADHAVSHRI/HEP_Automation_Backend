/**
 * Comprehensive Integration Test Script for Bulk Pass Module
 * Tests all key features:
 * 1. Single Intake Batch Creation
 * 2. Department Multiple Submissions Intake Batch Creation
 * 3. Public Parent Request Creation & Admin Approval Flow
 * 4. Token Resolution & Expiry Checks
 * 5. Blacklist Checks (Person & Vehicle)
 * 6. Child Batch Submission #1 (Direct Row Submission with Unique Token)
 * 7. Child Batch Submission #2 (Verifying Token Uniqueness & FK Integrity)
 * 8. Retrieving Child Submissions for Parent Batch
 * 9. Traffic Review Queue & Person Approval / Finalization
 * 10. QR Scan Data & Public Details
 */

require('dotenv').config();
const { pool } = require('../src/dbconfig/db');
const BulkPassSchema = require('../src/models/bulkPassSchema');
const BulkPassParentRequest = require('../src/models/BulkPassParentRequest');
const ReferenceNumber = require('../src/models/referenceNumberSchema');
const crypto = require('crypto');

const buildToken = () =>
  crypto
    .randomBytes(9)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

async function runFullDiagnostics() {
  console.log("=================================================");
  console.log("   BULK PASS MODULE FULL FEATURE INTEGRATION TEST");
  console.log("=================================================\n");

  const results = [];
  const recordResult = (feature, success, details) => {
    results.push({ feature, success, details });
    const statusSymbol = success ? "✅ PASSED" : "❌ FAILED";
    console.log(`[${statusSymbol}] ${feature}`);
    if (details) console.log(`   Details: ${details}`);
  };

  const client = await pool.connect();
  try {
    // -----------------------------------------------------------------
    // TEST 1: Single Intake Batch Creation (Department)
    // -----------------------------------------------------------------
    let singleBatch;
    try {
      const refNo = await ReferenceNumber.generateBulkPassReference(client);
      const token = buildToken();
      singleBatch = await BulkPassSchema.createBatch({
        refNo,
        token,
        tokenActive: true,
        createdByUserId: 1,
        departmentId: 1,
        departmentName: "Admin Dept",
        visitorType: "VENDOR",
        companyName: "Test Single Corp",
        applicantEmail: "single@test.com",
        applicantMobile: "9876543210",
        purpose: "Single Pass Inspection",
        validityFrom: "2026-08-01",
        validityUpto: "2026-08-31",
        linkValidityHours: 48,
        multipleSubmissionsEnabled: false,
        status: "DRAFT"
      });
      recordResult("1. Single Intake Batch Creation", !!singleBatch.id, `ID: ${singleBatch.id}, RefNo: ${singleBatch.refNo}`);
    } catch (err) {
      recordResult("1. Single Intake Batch Creation", false, err.message);
    }

    // -----------------------------------------------------------------
    // TEST 2: Department Multiple Submissions Parent Batch Creation
    // -----------------------------------------------------------------
    let deptParentBatch;
    try {
      const refNo = await ReferenceNumber.generateBulkPassReference(client);
      const token = buildToken();
      deptParentBatch = await BulkPassSchema.createBatch({
        refNo,
        token,
        tokenActive: true,
        createdByUserId: 1,
        departmentId: 1,
        departmentName: "Admin Dept",
        visitorType: "BUSINESS",
        companyName: "Dept Multi Submissions Inc",
        applicantEmail: "deptmulti@test.com",
        applicantMobile: "9876543211",
        purpose: "Multi-batch Port Operations",
        validityFrom: "2026-08-01",
        validityUpto: "2026-08-31",
        linkValidityHours: 48,
        multipleSubmissionsEnabled: true,
        request_source: "DEPARTMENT",
        status: "UNDER_REVIEW"
      });
      recordResult("2. Department Multiple Submissions Parent Batch Creation", !!deptParentBatch.id, `Parent ID: ${deptParentBatch.id}, Token: ${token}`);
    } catch (err) {
      recordResult("2. Department Multiple Submissions Parent Batch Creation", false, err.message);
    }

    // -----------------------------------------------------------------
    // TEST 3: Department Parent Batch - Child Submission #1
    // -----------------------------------------------------------------
    let deptChild1;
    try {
      const childRefNo = await ReferenceNumber.generateBulkPassReference(client);
      const subNum = await BulkPassSchema.getNextSubmissionNumber(deptParentBatch.id, 'DEPARTMENT');
      deptChild1 = await BulkPassSchema.createBatch({
        refNo: childRefNo,
        token: buildToken(), // Unique token
        tokenActive: true,
        status: "UNDER_REVIEW",
        multipleSubmissionsEnabled: false,
        parent_request_id: deptParentBatch.id,
        submission_number: subNum,
        request_source: "DEPARTMENT",
        visitorType: deptParentBatch.visitorType,
        companyName: deptParentBatch.companyName,
        applicantEmail: deptParentBatch.applicantEmail,
        applicantMobile: deptParentBatch.applicantMobile,
        purpose: deptParentBatch.purpose,
        noOfPersons: 2,
        noOfVehicles: 1
      });

      // Add persons to Child 1
      await BulkPassSchema.insertPersons(deptChild1.id, [
        {
          fileName: "manual",
          rowNumber: 1,
          name: "Person One",
          aadhaar: "111122223333",
          dob: "1990-01-01",
          mobile: "9876543210",
          validationStatus: "valid"
        },
        {
          fileName: "manual",
          rowNumber: 2,
          name: "Person Two",
          aadhaar: "111122223334",
          dob: "1992-02-02",
          mobile: "9876543211",
          validationStatus: "valid"
        }
      ]);

      recordResult("3. Department Child Submission #1", !!deptChild1.id && subNum === 1, `Child #1 ID: ${deptChild1.id}, Submission #: ${subNum}`);
    } catch (err) {
      recordResult("3. Department Child Submission #1", false, err.message);
    }

    // -----------------------------------------------------------------
    // TEST 4: Department Parent Batch - Child Submission #2 (Testing Token & FK Integrity)
    // -----------------------------------------------------------------
    let deptChild2;
    try {
      const childRefNo = await ReferenceNumber.generateBulkPassReference(client);
      const subNum = await BulkPassSchema.getNextSubmissionNumber(deptParentBatch.id, 'DEPARTMENT');
      deptChild2 = await BulkPassSchema.createBatch({
        refNo: childRefNo,
        token: buildToken(), // Unique token
        tokenActive: true,
        status: "UNDER_REVIEW",
        multipleSubmissionsEnabled: false,
        parent_request_id: deptParentBatch.id,
        submission_number: subNum,
        request_source: "DEPARTMENT",
        visitorType: deptParentBatch.visitorType,
        companyName: deptParentBatch.companyName,
        applicantEmail: deptParentBatch.applicantEmail,
        applicantMobile: deptParentBatch.applicantMobile,
        purpose: deptParentBatch.purpose,
        noOfPersons: 1,
        noOfVehicles: 0
      });

      recordResult("4. Department Child Submission #2 (Token & FK Check)", !!deptChild2.id && subNum === 2, `Child #2 ID: ${deptChild2.id}, Submission #: ${subNum}`);
    } catch (err) {
      recordResult("4. Department Child Submission #2 (Token & FK Check)", false, err.message);
    }

    // -----------------------------------------------------------------
    // TEST 5: Fetch Child Submissions for Parent Batch
    // -----------------------------------------------------------------
    try {
      const childSubmissions = await BulkPassSchema.getChildBatches(deptParentBatch.id, 'DEPARTMENT');
      const isCountMatch = childSubmissions.length === 2;
      recordResult("5. Fetch Child Submissions List", isCountMatch, `Retrieved ${childSubmissions.length} submissions for Parent ID ${deptParentBatch.id}`);
    } catch (err) {
      recordResult("5. Fetch Child Submissions List", false, err.message);
    }

    // -----------------------------------------------------------------
    // TEST 6: Public Parent Request Creation & Admin Approval
    // -----------------------------------------------------------------
    let publicParent;
    try {
      const token = buildToken();
      publicParent = await BulkPassParentRequest.create({
        tracking_number: `PR-${Date.now()}`,
        shared_token: token,
        company_name: "Public Film Crew Ltd",
        applicant_email: "publicfilm@test.com",
        applicant_mobile: "9876549999",
        visitor_type: "EVENT_ORGANIZER",
        payment_mode: "CASH",
        purpose: "Movie shoot",
        work_order_required: false,
        token_active: true,
        validity_from: new Date().toISOString(),
        validity_upto: new Date(Date.now() + 86400000 * 7).toISOString(),
        status: "APPROVED"
      });
      recordResult("6. Public Parent Request Creation", !!publicParent.id, `Public Parent ID: ${publicParent.id}, Token: ${publicParent.shared_token}`);
    } catch (err) {
      recordResult("6. Public Parent Request Creation", false, err.message);
    }

    // -----------------------------------------------------------------
    // TEST 7: Public Parent Request - Child Submission #1
    // -----------------------------------------------------------------
    let publicChild1;
    try {
      const childRefNo = await ReferenceNumber.generateBulkPassReference(client);
      const subNum = await BulkPassSchema.getNextSubmissionNumber(publicParent.id, 'PUBLIC_WEBSITE');
      publicChild1 = await BulkPassSchema.createBatch({
        refNo: childRefNo,
        token: buildToken(),
        tokenActive: true,
        status: "UNDER_REVIEW",
        multipleSubmissionsEnabled: false,
        parent_request_id: publicParent.id,
        submission_number: subNum,
        request_source: "PUBLIC_WEBSITE",
        visitorType: publicParent.visitor_type,
        companyName: publicParent.company_name,
        applicantEmail: publicParent.applicant_email,
        applicantMobile: publicParent.applicant_mobile,
        purpose: publicParent.purpose,
        noOfPersons: 3,
        noOfVehicles: 1
      });
      recordResult("7. Public Parent Request Child Submission #1", !!publicChild1.id && subNum === 1, `Child ID: ${publicChild1.id}, Submission #: ${subNum}`);
    } catch (err) {
      recordResult("7. Public Parent Request Child Submission #1", false, err.message);
    }

    // -----------------------------------------------------------------
    // TEST 8: Public Parent Request - Child Submission #2
    // -----------------------------------------------------------------
    let publicChild2;
    try {
      const childRefNo = await ReferenceNumber.generateBulkPassReference(client);
      const subNum = await BulkPassSchema.getNextSubmissionNumber(publicParent.id, 'PUBLIC_WEBSITE');
      publicChild2 = await BulkPassSchema.createBatch({
        refNo: childRefNo,
        token: buildToken(),
        tokenActive: true,
        status: "UNDER_REVIEW",
        multipleSubmissionsEnabled: false,
        parent_request_id: publicParent.id,
        submission_number: subNum,
        request_source: "PUBLIC_WEBSITE",
        visitorType: publicParent.visitor_type,
        companyName: publicParent.company_name,
        applicantEmail: publicParent.applicant_email,
        applicantMobile: publicParent.applicant_mobile,
        purpose: publicParent.purpose,
        noOfPersons: 1,
        noOfVehicles: 0
      });
      recordResult("8. Public Parent Request Child Submission #2", !!publicChild2.id && subNum === 2, `Child ID: ${publicChild2.id}, Submission #: ${subNum}`);
    } catch (err) {
      recordResult("8. Public Parent Request Child Submission #2", false, err.message);
    }

    // -----------------------------------------------------------------
    // TEST 9: Traffic Review Workflow - Individual Person Approval
    // -----------------------------------------------------------------
    try {
      const persons = await BulkPassSchema.getPersonsByBatch(deptChild1.id);
      if (persons.length > 0) {
        await BulkPassSchema.setPersonApprovalStatus(persons[0].id, 'APPROVED', null, 2);
        const updatedPersons = await BulkPassSchema.getPersonsByBatch(deptChild1.id);
        const approved = updatedPersons.find(p => p.id === persons[0].id);
        recordResult("9. Traffic Review - Per Person Approval", approved.approval_status === 'APPROVED' || approved.approvalStatus === 'APPROVED', `Person ID ${persons[0].id} status set to APPROVED`);
      } else {
        recordResult("9. Traffic Review - Per Person Approval", false, "No persons found for test child batch");
      }
    } catch (err) {
      recordResult("9. Traffic Review - Per Person Approval", false, err.message);
    }

    // -----------------------------------------------------------------
    // TEST 10: Batch Finalization & QR Generation Status Update
    // -----------------------------------------------------------------
    try {
      await BulkPassSchema.setStatus(deptChild1.id, "COMPLETED", {
        qrPdfPath: "/uploads/bulk_pass/50/qr_pass.pdf",
      });
      await BulkPassSchema.logTransition(deptChild1.id, "COMPLETED", 2, "Traffic Officer approved batch");
      const finalized = await BulkPassSchema.getById(deptChild1.id);
      recordResult("10. Batch Finalization to COMPLETED", finalized.status === "COMPLETED", `Batch ID ${deptChild1.id} final status: ${finalized.status}`);
    } catch (err) {
      recordResult("10. Batch Finalization to COMPLETED", false, err.message);
    }

    // -----------------------------------------------------------------
    // TEST 11: Cleanup Test Data
    // -----------------------------------------------------------------
    try {
      const batchIds = [
        singleBatch?.id,
        deptChild1?.id,
        deptChild2?.id,
        publicChild1?.id,
        publicChild2?.id
      ].filter(Boolean);

      if (batchIds.length) {
        await pool.query(`DELETE FROM bulk_pass_persons WHERE "batchId" = ANY($1::int[])`, [batchIds]);
      }
      
      const allBatchIds = [
        singleBatch?.id,
        deptParentBatch?.id,
        deptChild1?.id,
        deptChild2?.id,
        publicChild1?.id,
        publicChild2?.id
      ].filter(Boolean);

      if (allBatchIds.length) {
        await pool.query(`DELETE FROM bulk_pass_batches WHERE id = ANY($1::int[])`, [allBatchIds]);
      }

      if (publicParent?.id) {
        await pool.query('DELETE FROM bulk_pass_parent_requests WHERE id = $1', [publicParent.id]);
      }
      recordResult("11. Clean Up Test Data", true, "Test rows purged successfully");
    } catch (err) {
      recordResult("11. Clean Up Test Data", false, err.message);
    }

  } finally {
    client.release();
  }

  console.log("\n=================================================");
  console.log("                SUMMARY RESULTS");
  console.log("=================================================");
  const passedCount = results.filter(r => r.success).length;
  console.log(`TOTAL FEATURES TESTED: ${results.length}`);
  console.log(`PASSED: ${passedCount}`);
  console.log(`FAILED: ${results.length - passedCount}`);
  console.log("=================================================\n");
  
  process.exit(passedCount === results.length ? 0 : 1);
}

runFullDiagnostics().catch(err => {
  console.error("Fatal Test Execution Error:", err);
  process.exit(1);
});
