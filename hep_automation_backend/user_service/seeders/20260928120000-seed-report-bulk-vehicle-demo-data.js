"use strict";

/**
 * Local/demo data for reports whose operational source tables can be empty.
 *
 * This belongs in seeders (not migrations): it inserts reversible sample data
 * without changing the database schema.
 *
 * @type {import("sequelize-cli").Migration}
 */
module.exports = {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize;
    const transaction = await sequelize.transaction();

    try {
      const [user] = await sequelize.query(
        `SELECT id FROM users ORDER BY CASE WHEN "userName" = 'admin' THEN 0 ELSE 1 END, id LIMIT 1`,
        { transaction, type: sequelize.QueryTypes.SELECT },
      );
      const [department] = await sequelize.query(
        `SELECT id, "departmentName" FROM port_departments ORDER BY id LIMIT 1`,
        { transaction, type: sequelize.QueryTypes.SELECT },
      );
      const [agent] = await sequelize.query(
        `SELECT id FROM "Agents" ORDER BY CASE WHEN "loginId" = 'REPORTDEMO' THEN 0 ELSE 1 END, id LIMIT 1`,
        { transaction, type: sequelize.QueryTypes.SELECT },
      );
      const vehicleTypes = await sequelize.query(
        `SELECT id, name FROM vehicle_types ORDER BY id LIMIT 3`,
        { transaction, type: sequelize.QueryTypes.SELECT },
      );

      if (!user || !department || !agent || !vehicleTypes.length) {
        throw new Error(
          "Bulk/vehicle report demo data requires users, port_departments, Agents, and vehicle_types master data.",
        );
      }

      const batchDefinitions = [
        {
          refNo: "APACS-DEMO-BULK-001",
          token: "APACS-DEMO-BULK-TOKEN-001",
          companyName: "Chennai Harbour Logistics Pvt Ltd",
          status: "COMPLETED",
          paymentMode: "CASH",
          createdAt: new Date("2026-09-20T03:30:00.000Z"),
          updatedAt: new Date("2026-09-20T06:45:00.000Z"),
        },
        {
          refNo: "APACS-DEMO-BULK-002",
          token: "APACS-DEMO-BULK-TOKEN-002",
          companyName: "Coromandel Stevedoring Services",
          status: "UNDER_REVIEW",
          paymentMode: "FREE",
          createdAt: new Date("2026-09-21T04:15:00.000Z"),
          updatedAt: new Date("2026-09-21T08:20:00.000Z"),
        },
      ];

      const existingBatches = await sequelize.query(
        `SELECT "refNo" FROM bulk_pass_batches WHERE "refNo" LIKE 'APACS-DEMO-BULK-%'`,
        { transaction, type: sequelize.QueryTypes.SELECT },
      );
      const existingBatchRefs = new Set(existingBatches.map((row) => row.refNo));

      const newBatches = batchDefinitions
        .filter((batch) => !existingBatchRefs.has(batch.refNo))
        .map((batch) => ({
          ...batch,
          tokenActive: true,
          createdByUserId: user.id,
          departmentId: department.id,
          departmentName: department.departmentName,
          visitorType: "CONTRACTOR",
          applicantEmail: "reports.demo@chennaipuram.example",
          applicantMobile: "9876501200",
          refDocNo: `REF-${batch.refNo.slice(-3)}`,
          workOrderRequired: false,
          noOfPersons: 3,
          noOfVehicles: 2,
          purpose: "Port operations and cargo handling demonstration",
          validityFrom: new Date("2026-09-20T00:00:00.000Z"),
          validityUpto: new Date("2026-10-20T23:59:59.000Z"),
          remarks: "APACS reports demonstration record",
          submittedAt: batch.createdAt,
          linkValidityHours: 48,
          multipleSubmissionsEnabled: false,
          submission_number: 1,
          request_source: "DEPARTMENT",
        }));

      if (newBatches.length) {
        await queryInterface.bulkInsert("bulk_pass_batches", newBatches, { transaction });
      }

      const batches = await sequelize.query(
        `SELECT id, "refNo" FROM bulk_pass_batches WHERE "refNo" LIKE 'APACS-DEMO-BULK-%'`,
        { transaction, type: sequelize.QueryTypes.SELECT },
      );
      const batchIds = new Map(batches.map((batch) => [batch.refNo, batch.id]));

      const people = [
        {
          batchId: batchIds.get("APACS-DEMO-BULK-001"),
          rowNumber: 1,
          name: "Arjun Raman",
          aadhaar: "711122223301",
          dob: "1991-04-12",
          mobile: "9876501301",
          address: "Royapuram, Chennai",
          approvalStatus: "APPROVED",
          approvedBy: user.id,
          approvedAt: new Date("2026-09-20T05:30:00.000Z"),
          createdAt: new Date("2026-09-20T03:40:00.000Z"),
        },
        {
          batchId: batchIds.get("APACS-DEMO-BULK-001"),
          rowNumber: 2,
          name: "Meena Krishnan",
          aadhaar: "711122223302",
          dob: "1988-11-23",
          mobile: "9876501302",
          address: "Tondiarpet, Chennai",
          vehicleNumber: "TN04AP2026",
          vehicleType: "CAR",
          approvalStatus: "APPROVED",
          approvedBy: user.id,
          approvedAt: new Date("2026-09-20T06:00:00.000Z"),
          createdAt: new Date("2026-09-20T03:45:00.000Z"),
        },
        {
          batchId: batchIds.get("APACS-DEMO-BULK-001"),
          rowNumber: 3,
          name: "Karthik Selvan",
          aadhaar: "711122223303",
          dob: "1985-07-18",
          mobile: "9876501303",
          address: "Manali, Chennai",
          driverLicenseNumber: "TN042026000301",
          approvalStatus: "APPROVED",
          approvedBy: user.id,
          approvedAt: new Date("2026-09-20T06:15:00.000Z"),
          createdAt: new Date("2026-09-20T03:50:00.000Z"),
        },
        {
          batchId: batchIds.get("APACS-DEMO-BULK-002"),
          rowNumber: 1,
          name: "Nandhini Kumar",
          aadhaar: "711122223304",
          dob: "1994-02-09",
          mobile: "9876501304",
          address: "Washermanpet, Chennai",
          approvalStatus: "PENDING",
          createdAt: new Date("2026-09-21T04:25:00.000Z"),
        },
      ];

      const existingPeople = await sequelize.query(
        `SELECT aadhaar FROM bulk_pass_persons WHERE aadhaar LIKE '7111222233%'`,
        { transaction, type: sequelize.QueryTypes.SELECT },
      );
      const existingAadhaar = new Set(existingPeople.map((person) => person.aadhaar));
      const newPeople = people
        .filter((person) => person.batchId && !existingAadhaar.has(person.aadhaar))
        .map((person) => ({
          ...person,
          fileName: "apacs-report-demo.xlsx",
          validationStatus: "valid",
          inCharge: person.rowNumber === 1,
        }));

      if (newPeople.length) {
        await queryInterface.bulkInsert("bulk_pass_persons", newPeople, { transaction });
      }

      const vehicleDefinitions = [
        ["TN04AP1001", 0, "2027-08-31", "2028-03-31", true, "OTHER GATES ONLY", "2026-09-22T05:15:00.000Z"],
        ["TN04AP1002", 1, "2027-06-30", "2028-01-15", true, "OIL JETTY AND OTHER GATES", "2026-09-22T06:30:00.000Z"],
        ["TN04AP1003", 2, "2026-10-31", "2027-09-30", false, "OTHER GATES ONLY", "2026-09-23T09:45:00.000Z"],
      ];
      const existingVehicles = await sequelize.query(
        `SELECT "registrationNo" FROM master_vehicles WHERE "registrationNo" LIKE 'TN04AP10%'`,
        { transaction, type: sequelize.QueryTypes.SELECT },
      );
      const existingRegistrationNos = new Set(existingVehicles.map((vehicle) => vehicle.registrationNo));
      const newVehicles = vehicleDefinitions
        .filter(([registrationNo]) => !existingRegistrationNos.has(registrationNo))
        .map(([registrationNo, typeIndex, insuranceExpiry, rcValidity, isActive, accessAreaId, timestamp]) => ({
          agentId: agent.id,
          vehicleTypeId: vehicleTypes[typeIndex % vehicleTypes.length].id,
          registrationNo,
          rfidCardNumber: `RFID-${registrationNo}`,
          scannedCopyFilePath: `demo/vehicles/${registrationNo}-rc.pdf`,
          scannedCopyFileName: `${registrationNo}-RC.pdf`,
          insuranceFilePath: `demo/vehicles/${registrationNo}-insurance.pdf`,
          insuranceFileName: `${registrationNo}-Insurance.pdf`,
          insuranceExpiry,
          rcValidity,
          accessAreaId,
          isActive,
          ulip_verified: true,
          vehicle_status: isActive ? "ACTIVE" : "INACTIVE",
          ulip_verified_at: new Date(timestamp),
          createdAt: new Date(timestamp),
          updatedAt: new Date(timestamp),
        }));

      if (newVehicles.length) {
        await queryInterface.bulkInsert("master_vehicles", newVehicles, { transaction });
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.bulkDelete(
        "bulk_pass_persons",
        { aadhaar: ["711122223301", "711122223302", "711122223303", "711122223304"] },
        { transaction },
      );
      await queryInterface.bulkDelete(
        "bulk_pass_batches",
        { refNo: ["APACS-DEMO-BULK-001", "APACS-DEMO-BULK-002"] },
        { transaction },
      );
      await queryInterface.bulkDelete(
        "master_vehicles",
        { registrationNo: ["TN04AP1001", "TN04AP1002", "TN04AP1003"] },
        { transaction },
      );
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
