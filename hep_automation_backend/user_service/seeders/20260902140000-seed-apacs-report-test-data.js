'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const { QueryTypes } = require('sequelize');
    const count = 20000;
    const now = new Date();
    const transaction = await queryInterface.sequelize.transaction();
    const companies = ['Chennai Port Logistics', 'Bayline Exports', 'HarbourLink Transport', 'Gateway Customs Agency'];
    const names = ['Ramesh Kumar', 'Priya Devi', 'Arun Prakash', 'Kavitha Rajan'];
    let personPassTypes;
    let personStatuses;
    let personPassStatuses;
    let personNationalities;
    let vehiclePassTypes;
    let vehicleStatuses;
    let vehiclePassStatuses;
    let requestStatuses;
    let requestPaymentModes;
    let requestOriginTypes;
    let vendorRequestStatuses;
    let vendorPaymentModes;
    let vendorPersonStatuses;
    let vendorPersonNationalities;
    let vendorVehicleStatuses;

    const insert = async (table, rows) => {
      for (let i = 0; i < rows.length; i += 250) {
        await queryInterface.bulkInsert(table, rows.slice(i, i + 250), { transaction });
      }
    };
    const existing = async (table, column, prefix) => {
      const [rows] = await queryInterface.sequelize.query(
        `SELECT "${column}" AS value FROM "${table}" WHERE "${column}" LIKE '${prefix}%'`,
        { transaction }
      );
      return new Set(rows.map((row) => row.value));
    };
    const enumValues = async (table, column) => {
      const values = await queryInterface.sequelize.query(
        `SELECT e.enumlabel AS value
         FROM pg_attribute a
         JOIN pg_class c ON c.oid = a.attrelid
         JOIN pg_type t ON t.oid = a.atttypid
         JOIN pg_enum e ON e.enumtypid = t.oid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = :table AND a.attname = :column
         ORDER BY e.enumsortorder`,
        { replacements: { table, column }, transaction, type: QueryTypes.SELECT }
      );
      return values.map((row) => row.value);
    };
    const preferredValues = (available, preferred, label) => {
      const selected = preferred.filter((value) => available.includes(value));
      if (!selected.length) throw new Error(`No supported ${label} enum values found.`);
      return selected;
    };

    try {
      const [userType] = await queryInterface.sequelize.query('SELECT id, name FROM "User_types" ORDER BY id LIMIT 1', { transaction, type: QueryTypes.SELECT });
      const [purpose] = await queryInterface.sequelize.query('SELECT id FROM visit_purposes ORDER BY id LIMIT 1', { transaction, type: QueryTypes.SELECT });
      const [hepType] = await queryInterface.sequelize.query('SELECT id FROM hep_types ORDER BY id LIMIT 1', { transaction, type: QueryTypes.SELECT });
      const [rate] = await queryInterface.sequelize.query('SELECT id FROM hep_rates ORDER BY id LIMIT 1', { transaction, type: QueryTypes.SELECT });
      const [vehicleType] = await queryInterface.sequelize.query('SELECT id FROM vehicle_types ORDER BY id LIMIT 1', { transaction, type: QueryTypes.SELECT });
      const [user] = await queryInterface.sequelize.query('SELECT id FROM users ORDER BY id LIMIT 1', { transaction, type: QueryTypes.SELECT });
      const [department] = await queryInterface.sequelize.query('SELECT id, "departmentName" AS name FROM port_departments ORDER BY id LIMIT 1', { transaction, type: QueryTypes.SELECT });
      if (!userType || !purpose || !hepType || !rate || !user || !department) {
        throw new Error('Run all master seeders before the APACS report test-data seeder.');
      }
      personPassTypes = preferredValues(await enumValues('pass_persons', 'passType'), ['DAILY', 'MONTHLY', 'YEARLY'], 'person pass type');
      personStatuses = preferredValues(await enumValues('pass_persons', 'status'), ['approved', 'pending', 'rejected'], 'person status');
      personPassStatuses = preferredValues(await enumValues('pass_persons', 'passStatus'), ['ACTIVE', 'DISABLED'], 'person pass status');
      personNationalities = preferredValues(await enumValues('pass_persons', 'nationality'), ['INDIAN', 'FOREIGNER'], 'person nationality');
      vehiclePassTypes = preferredValues(await enumValues('pass_vehicles', 'passType'), ['DAILY', 'MONTHLY', 'YEARLY'], 'vehicle pass type');
      vehicleStatuses = preferredValues(await enumValues('pass_vehicles', 'status'), ['approved', 'pending', 'rejected'], 'vehicle status');
      vehiclePassStatuses = preferredValues(await enumValues('pass_vehicles', 'passStatus'), ['ACTIVE', 'DISABLED'], 'vehicle pass status');
      requestStatuses = preferredValues(await enumValues('pass_requests', 'status'), ['APPROVED', 'UNDER_REVIEW', 'SUBMITTED', 'REJECTED'], 'request status');
      requestPaymentModes = await enumValues('pass_requests', 'paymentMode');
      requestOriginTypes = preferredValues(await enumValues('pass_requests', 'originType'), ['AGENT'], 'request origin type');
      vendorRequestStatuses = preferredValues(await enumValues('vendor_pass_requests', 'status'), ['APPROVED', 'VENDOR_SUBMITTED', 'LINK_SENT', 'REJECTED'], 'vendor request status');
      vendorPaymentModes = await enumValues('vendor_pass_requests', 'paymentMode');
      vendorPersonStatuses = preferredValues(await enumValues('vendor_pass_persons', 'status'), ['approved', 'pending', 'rejected'], 'vendor person status');
      vendorPersonNationalities = preferredValues(await enumValues('vendor_pass_persons', 'nationality'), ['INDIAN', 'FOREIGNER'], 'vendor person nationality');
      vendorVehicleStatuses = preferredValues(await enumValues('vendor_pass_vehicles', 'status'), ['approved', 'pending', 'rejected'], 'vendor vehicle status');
      if (!requestPaymentModes.length || !vendorPaymentModes.length) {
        throw new Error('Payment mode enum values are missing from the target database.');
      }

      const allAgents = [
        ...Array.from({ length: count }, (_, i) => {
        const n = String(i + 1).padStart(5, '0');
        return { userTypeId: userType.id, userTypeName: userType.name, entityName: `${companies[i % companies.length]} - Test ${n}`, mobileNo: `8${String(100000000 + i).slice(-9)}`, email: `company.${n}@example.test`, addressLine: `${i + 1}, Chennai Port Road`, city: 'Chennai', state: 'Tamil Nadu', pincode: '600001', country: 'India', firstName: names[i % names.length].split(' ')[0], lastName: names[i % names.length].split(' ')[1], referenceNumber: `APACS-TEST-AGENT-${n}`, loginId: `APACS-TEST-${n}`, termsAccepted: true, isApproved: true, status: 'approved', role: 'user', createdAt: now, updatedAt: now };
        }),
      ];
      const existingAgents = await existing('Agents', 'referenceNumber', 'APACS-TEST-AGENT-');
      await insert('Agents', allAgents.filter((r) => !existingAgents.has(r.referenceNumber)));
      const [agentRows] = await queryInterface.sequelize.query(`SELECT id, "referenceNumber" FROM "Agents" WHERE "referenceNumber" LIKE 'APACS-TEST-AGENT-%'`, { transaction });
      const agentIds = new Map(agentRows.map((r) => [r.referenceNumber, r.id]));

      const allPassRequests = [
        ...Array.from({ length: count }, (_, i) => {
        const n = String(i + 1).padStart(5, '0'); const base = [50, 500, 1500][i % 3];
        return { agentId: agentIds.get(`APACS-TEST-AGENT-${n}`), referenceNo: `APACS-TEST-REQ-${n}`, purposeOfVisitId: purpose.id, authLetterFilePath: 'test/authorization.pdf', authLetterFileName: 'authorization.pdf', baseTotal: base, grossTotal: base, gstAmount: base * 0.18, netAmount: base * 1.18, paymentMode: requestPaymentModes[i % requestPaymentModes.length], status: requestStatuses[i % requestStatuses.length], submittedAt: now, isActive: true, isBlocked: false, originType: requestOriginTypes[i % requestOriginTypes.length], createdAt: now, updatedAt: now };
        }),
      ];
      const existingRequests = await existing('pass_requests', 'referenceNo', 'APACS-TEST-REQ-');
      await insert('pass_requests', allPassRequests.filter((r) => !existingRequests.has(r.referenceNo)));
      const [requestRows] = await queryInterface.sequelize.query(`SELECT id, "referenceNo" FROM pass_requests WHERE "referenceNo" LIKE 'APACS-TEST-REQ-%'`, { transaction });
      const requestIds = new Map(requestRows.map((r) => [r.referenceNo, r.id]));

      const allPassPersons = [
        ...Array.from({ length: count }, (_, i) => {
        const n = String(i + 1).padStart(5, '0'); const status = personStatuses[i % personStatuses.length]; const from = new Date(now - (i % 30) * 86400000); const to = new Date(+from + [1, 30, 365][i % 3] * 86400000);
        return { passRequestId: requestIds.get(`APACS-TEST-REQ-${n}`), rateId: rate.id, hepTypeId: hepType.id, name: names[i % names.length], aadharNo: `7${String(10000000000 + i).slice(-11)}`, mobile: `9${String(100000000 + i).slice(-9)}`, nationality: personNationalities[i % personNationalities.length], idProofType: 'AADHAAR', passType: personPassTypes[i % personPassTypes.length], passPeriod: [1, 30, 365][i % 3], dateFrom: from, dateTo: to, amount: [50, 500, 1500][i % 3], status, personPassNo: `APACS-TEST-P-${n}`, qrUuid: status === 'approved' ? `10000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}` : null, qrIssuedAt: status === 'approved' ? now : null, qrRevoked: status === 'rejected', scanCount: i % 20, passStatus: personPassStatuses[i % personPassStatuses.length], createdAt: now, updatedAt: now };
        }),
      ];
      const existingPersons = await existing('pass_persons', 'personPassNo', 'APACS-TEST-P-');
      await insert('pass_persons', allPassPersons.filter((r) => !existingPersons.has(r.personPassNo)));

      const allPassVehicles = [
        ...Array.from({ length: count }, (_, i) => {
        const n = String(i + 1).padStart(5, '0'); const status = vehicleStatuses[i % vehicleStatuses.length]; const from = new Date(now - (i % 30) * 86400000); const to = new Date(+from + [1, 30, 365][i % 3] * 86400000);
        return { passRequestId: requestIds.get(`APACS-TEST-REQ-${n}`), rateId: rate.id, vehicleTypeId: vehicleType?.id || null, registrationNo: `TN${String(i % 99 + 1).padStart(2, '0')}AP${n.slice(-4)}`, passType: vehiclePassTypes[i % vehiclePassTypes.length], passPeriod: [1, 30, 365][i % 3], dateFrom: from, dateTo: to, amount: [100, 1000, 3000][i % 3], status, vehiclePassNo: `APACS-TEST-V-${n}`, qrUuid: status === 'approved' ? `20000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}` : null, qrIssuedAt: status === 'approved' ? now : null, qrRevoked: status === 'rejected', scanCount: i % 20, passStatus: vehiclePassStatuses[i % vehiclePassStatuses.length], createdAt: now, updatedAt: now };
        }),
      ];
      const existingVehicles = await existing('pass_vehicles', 'vehiclePassNo', 'APACS-TEST-V-');
      await insert('pass_vehicles', allPassVehicles.filter((r) => !existingVehicles.has(r.vehiclePassNo)));

      const allVendorPassRequests = [
        ...Array.from({ length: count }, (_, i) => { const n = String(i + 1).padStart(5, '0'); return { referenceNo: `APACS-TEST-VREQ-${n}`, token: `APACS-TEST-TOKEN-${n}`, createdByUserId: user.id, departmentId: department.id, departmentName: department.name, companyName: `${companies[i % companies.length]} - Vendor ${n}`, vendorEmail: `vendor.${n}@example.test`, vendorMobile: `8${String(200000000 + i).slice(-9)}`, noOfPersonsAllowed: 1, noOfVehiclesAllowed: 1, paymentMode: vendorPaymentModes[i % vendorPaymentModes.length], validUpto: new Date(+now + 365 * 86400000), status: vendorRequestStatuses[i % vendorRequestStatuses.length], submittedAt: now, createdAt: now, updatedAt: now }; }),
      ];
      const existingVendorRequests = await existing('vendor_pass_requests', 'referenceNo', 'APACS-TEST-VREQ-');
      await insert('vendor_pass_requests', allVendorPassRequests.filter((r) => !existingVendorRequests.has(r.referenceNo)));
      const [vendorRows] = await queryInterface.sequelize.query(`SELECT id, "referenceNo" FROM vendor_pass_requests WHERE "referenceNo" LIKE 'APACS-TEST-VREQ-%'`, { transaction });
      const vendorIds = new Map(vendorRows.map((r) => [r.referenceNo, r.id]));

      const allVendorPassPersons = [
        ...Array.from({ length: count }, (_, i) => { const n = String(i + 1).padStart(5, '0'); return { vendorPassRequestId: vendorIds.get(`APACS-TEST-VREQ-${n}`), personPassNo: `APACS-TEST-VP-${n}`, name: names[i % names.length], mobile: `9${String(300000000 + i).slice(-9)}`, nationality: vendorPersonNationalities[i % vendorPersonNationalities.length], dateFrom: now, dateTo: new Date(+now + 30 * 86400000), passType: personPassTypes[i % personPassTypes.length], amount: [50, 500, 1500][i % 3], status: vendorPersonStatuses[i % vendorPersonStatuses.length], createdAt: now, updatedAt: now }; }),
      ];
      const existingVendorPersons = await existing('vendor_pass_persons', 'personPassNo', 'APACS-TEST-VP-');
      await insert('vendor_pass_persons', allVendorPassPersons.filter((r) => !existingVendorPersons.has(r.personPassNo)));

      const allVendorPassVehicles = [
        ...Array.from({ length: count }, (_, i) => { const n = String(i + 1).padStart(5, '0'); return { vendorPassRequestId: vendorIds.get(`APACS-TEST-VREQ-${n}`), vehiclePassNo: `APACS-TEST-VV-${n}`, vehicleRegistrationNo: `TN${String(i % 99 + 1).padStart(2, '0')}VP${n.slice(-4)}`, vehicleType: 'LMV', dateFrom: now, dateTo: new Date(+now + 30 * 86400000), passType: vehiclePassTypes[i % vehiclePassTypes.length], amount: [100, 1000, 3000][i % 3], status: vendorVehicleStatuses[i % vendorVehicleStatuses.length], createdAt: now, updatedAt: now }; }),
      ];
      const existingVendorVehicles = await existing('vendor_pass_vehicles', 'vehiclePassNo', 'APACS-TEST-VV-');
      await insert('vendor_pass_vehicles', allVendorPassVehicles.filter((r) => !existingVendorVehicles.has(r.vehiclePassNo)));
      await transaction.commit();
    } catch (error) { await transaction.rollback(); throw error; }
  },

  async down(queryInterface) {
    const q = queryInterface.sequelize;
    await q.query(`DELETE FROM vendor_pass_persons WHERE "personPassNo" LIKE 'APACS-TEST-VP-%'`);
    await q.query(`DELETE FROM vendor_pass_vehicles WHERE "vehiclePassNo" LIKE 'APACS-TEST-VV-%'`);
    await q.query(`DELETE FROM vendor_pass_requests WHERE "referenceNo" LIKE 'APACS-TEST-VREQ-%'`);
    await q.query(`DELETE FROM pass_persons WHERE "personPassNo" LIKE 'APACS-TEST-P-%'`);
    await q.query(`DELETE FROM pass_vehicles WHERE "vehiclePassNo" LIKE 'APACS-TEST-V-%'`);
    await q.query(`DELETE FROM pass_requests WHERE "referenceNo" LIKE 'APACS-TEST-REQ-%'`);
    await q.query(`DELETE FROM "Agents" WHERE "referenceNumber" LIKE 'APACS-TEST-AGENT-%'`);
  },
};
