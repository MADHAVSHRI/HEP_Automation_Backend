/**
 * Central Export for Raw SQL Models
 * 
 * This file provides a centralized export point for all raw SQL-based models
 * in the user_service. These models use direct SQL queries via the connection pool
 * rather than Sequelize ORM.
 * 
 * Requirements: 2.3, 9.4
 */

const BulkPassSchema = require("./bulkPassSchema");
const BulkPassParentRequest = require("./BulkPassParentRequest");
const EmailVerification = require("./EmailVerification");
const ReferenceNumberSchema = require("./referenceNumberSchema");
const VendorPassRequestSchema = require("./vendorPassRequestSchema");
const PassRequestSchema = require("./passRequestSchema");
const MaterialPassSchema = require("./materialPassSchema");
const VvipPassSchema = require("./vvipPassSchema");
const AgentRegistrationSchema = require("./agentRegistrationSchema");
const AgentProfileUpdateRequestSchema = require("./agentProfileUpdateRequestSchema");
const ReportSchema = require("./reportSchema");
const UserTypeSchema = require("./userTypeSchema");

/**
 * Model Associations (Database Level)
 * 
 * The following foreign key relationships are established at the database level
 * through migrations (specifically 20270810000001 and 20270810000003) and 
 * enforced by PostgreSQL:
 * 
 * 1. BulkPassParentRequest Associations:
 *    - belongsTo User (approved_by_user_id) - User who approved the parent request
 *    - belongsTo User (rejected_by_user_id) - User who rejected the parent request
 *    - hasMany BulkPassBatch (parent_request_id) - Child batches created from this parent request
 * 
 * 2. BulkPassBatch Associations:
 *    - belongsTo BulkPassParentRequest (parent_request_id) - Links to parent request for public workflow
 *      OR self-referential (parent_request_id references another bulk_pass_batches.id) for 
 *      department-created parent batches with multiple submissions enabled
 *    - belongsTo User (createdByUserId) - User who created the batch
 *    - belongsTo Department (departmentId) - Department that owns the batch
 *    - hasMany BulkPassPerson (batchId) - Persons in this batch
 *    - hasMany BulkPassVehicle (batchId) - Vehicles in this batch
 *    - hasMany BulkPassUpload (batchId) - File uploads for this batch
 * 
 * 3. EmailVerification Associations:
 *    - No direct foreign keys to other tables
 *    - Used for OTP verification during public request submission
 * 
 * Multiple Submissions Architecture:
 * - When multipleSubmissionsEnabled=true on a BulkPassBatch, it becomes a parent batch
 * - Each submission creates a child batch with parent_request_id pointing to the parent batch
 * - submission_number tracks the sequence (1, 2, 3, etc.)
 * - request_source differentiates between 'DEPARTMENT' and 'PUBLIC_WEBSITE' workflows
 * 
 * Note: Since this project uses raw SQL queries rather than Sequelize ORM,
 * associations are enforced through database foreign key constraints defined
 * in migration files (20270810000001-create-bulk-pass-parent-requests.js and
 * 20270810000003-add-multiple-submissions-columns.js), not through Sequelize's 
 * association methods.
 */

module.exports = {
  // Bulk Pass Models
  BulkPassSchema,
  BulkPassParentRequest,
  EmailVerification,
  
  // Other Pass Models
  VendorPassRequestSchema,
  PassRequestSchema,
  MaterialPassSchema,
  VvipPassSchema,
  
  // Agent Models
  AgentRegistrationSchema,
  AgentProfileUpdateRequestSchema,
  
  // Utility Models
  ReferenceNumberSchema,
  ReportSchema,
  UserTypeSchema,
};
