'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const count = 20000;
    const now = new Date();
    const names = ['Ramesh Kumar', 'Priya Devi', 'Arun Prakash', 'Kavitha Rajan'];
    const reasons = ['Pass validity exceeded', 'Unauthorized access attempt', 'Safety document expired', 'Port access rule violation'];

    const allBlacklistEntries = [
      ...Array.from({ length: count }, (_, i) => {
      const n = String(i + 1).padStart(5, '0'); const vehicle = i % 2 === 1; const penalty = i % 4 !== 0;
      return { entity_type: vehicle ? 'VEHICLE' : 'PERSON', identifier: vehicle ? `TN${String(i % 99 + 1).padStart(2, '0')}BL${n.slice(-4)}` : `APACS-TEST-P-${n}`, entity_name: vehicle ? `APACS Test Vehicle ${n}` : names[i % names.length], reason: reasons[i % reasons.length], scenario: i % 2 ? 'OVERSTAY' : 'SECURITY', has_penalty: penalty, penalty_amount: penalty ? [100, 250, 500][i % 3] : null, penalty_status: penalty ? (i % 2 ? 'PAID' : 'PENDING') : 'NOT_APPLICABLE', status: i % 10 ? 'BLACKLISTED' : 'UNBLACKLISTED', blacklisted_at: new Date(+now - (i % 30) * 86400000), compliance_notes: 'APACS reports test data', authorizing_officer: 'APACS Test Officer', permit_one_gate_out: false, gate_out_used: false, payment_method: penalty ? (i % 2 ? 'ACCOUNT' : 'E-CASH') : null, transaction_id: `APACS-TEST-BL-TXN-${n}`, createdAt: now, updatedAt: now };
      }),
    ];

    const allOverstayCharges = [
      ...Array.from({ length: count }, (_, i) => {
      const n = String(i + 1).padStart(5, '0'); const vehicle = i % 2 === 1; const days = i % 15 + 1; const rate = vehicle ? 32 : 13; const to = new Date(+now - days * 86400000);
      return { entity_type: vehicle ? 'VEHICLE' : 'PERSON', identifier: vehicle ? `TN${String(i % 99 + 1).padStart(2, '0')}OS${n.slice(-4)}` : `APACS-TEST-P-${n}`, entity_name: vehicle ? `APACS Test Vehicle ${n}` : names[i % names.length], pass_no: vehicle ? `APACS-TEST-V-${n}` : `APACS-TEST-P-${n}`, date_from: new Date(+to - 30 * 86400000), date_to: to, overstay_days: days, daily_rate: rate, total_amount: days * rate, status: ['PENDING', 'PAID', 'NOTIFIED'][i % 3], payment_method: i % 2 ? 'ACCOUNT' : 'E-CASH', transaction_id: `APACS-TEST-OS-TXN-${n}`, levied_by: 'APACS Test Officer', levied_at: now, email_sent: i % 3 === 2, notes: 'APACS reports test data', pass_blocked: i % 5 === 0, pass_type: ['DAILY', 'MONTHLY', 'YEARLY'][i % 3], created_at: now, updated_at: now };
      }),
    ];

    const [blacklistRows] = await queryInterface.sequelize.query(`SELECT transaction_id FROM blacklist_entries WHERE transaction_id LIKE 'APACS-TEST-BL-TXN-%'`);
    const existingBlacklist = new Set(blacklistRows.map((row) => row.transaction_id));
    const newBlacklistEntries = allBlacklistEntries.filter((row) => !existingBlacklist.has(row.transaction_id));
    for (let i = 0; i < newBlacklistEntries.length; i += 250) await queryInterface.bulkInsert('blacklist_entries', newBlacklistEntries.slice(i, i + 250), {});

    const [overstayRows] = await queryInterface.sequelize.query(`SELECT transaction_id FROM overstay_charges WHERE transaction_id LIKE 'APACS-TEST-OS-TXN-%'`);
    const existingOverstay = new Set(overstayRows.map((row) => row.transaction_id));
    const newOverstayCharges = allOverstayCharges.filter((row) => !existingOverstay.has(row.transaction_id));
    for (let i = 0; i < newOverstayCharges.length; i += 250) await queryInterface.bulkInsert('overstay_charges', newOverstayCharges.slice(i, i + 250), {});
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`DELETE FROM overstay_charges WHERE transaction_id LIKE 'APACS-TEST-OS-TXN-%'`);
    await queryInterface.sequelize.query(`DELETE FROM blacklist_entries WHERE transaction_id LIKE 'APACS-TEST-BL-TXN-%'`);
  },
};
