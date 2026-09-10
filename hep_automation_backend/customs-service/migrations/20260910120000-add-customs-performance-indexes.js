"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Indexes for customs_rapiscan
    await queryInterface.addIndex("customs_rapiscan", ["containerNumber"], {
      name: "idx_customs_rapiscan_container_number",
      using: "BTREE",
    });

    await queryInterface.addIndex("customs_rapiscan", ["scanningDateTime"], {
      name: "idx_customs_rapiscan_scanning_date_time",
      using: "BTREE",
    });

    await queryInterface.addIndex("customs_rapiscan", ["containerNumber", "scanningDateTime"], {
      name: "idx_customs_rapiscan_container_datetime",
      using: "BTREE",
    });

    // 2. Indexes for customs_examinations
    await queryInterface.addIndex("customs_examinations", ["containerNumber"], {
      name: "idx_customs_examinations_container_number",
      using: "BTREE",
    });

    await queryInterface.addIndex("customs_examinations", ["igmNumber"], {
      name: "idx_customs_examinations_igm_number",
      using: "BTREE",
    });

    await queryInterface.addIndex("customs_examinations", ["containerNumber", "igmNumber"], {
      name: "idx_customs_examinations_container_igm",
      using: "BTREE",
    });

    // 3. Indexes for customs_ooc
    await queryInterface.addIndex("customs_ooc", ["oocNumber"], {
      name: "idx_customs_ooc_ooc_number",
      using: "BTREE",
    });

    await queryInterface.addIndex("customs_ooc", ["containerNumber"], {
      name: "idx_customs_ooc_container_number",
      using: "BTREE",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex("customs_rapiscan", "idx_customs_rapiscan_container_number");
    await queryInterface.removeIndex("customs_rapiscan", "idx_customs_rapiscan_scanning_date_time");
    await queryInterface.removeIndex("customs_rapiscan", "idx_customs_rapiscan_container_datetime");

    await queryInterface.removeIndex("customs_examinations", "idx_customs_examinations_container_number");
    await queryInterface.removeIndex("customs_examinations", "idx_customs_examinations_igm_number");
    await queryInterface.removeIndex("customs_examinations", "idx_customs_examinations_container_igm");

    await queryInterface.removeIndex("customs_ooc", "idx_customs_ooc_ooc_number");
    await queryInterface.removeIndex("customs_ooc", "idx_customs_ooc_container_number");
  },
};
