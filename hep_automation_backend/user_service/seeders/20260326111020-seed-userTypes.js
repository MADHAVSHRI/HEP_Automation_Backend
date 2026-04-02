"use strict";

/** @type {import('sequelize-cli').Migration} */
"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert("User_types", [
      {
        name: "Steamer Agent",
        document_instruction: "Upload Customs License & Port approval letter",
      },

      {
        name: "CHA",
        document_instruction: "Upload Customs License",
      },

      {
        name: "Stevedore",
        document_instruction: "Upload Port approval letter",
      },

      {
        name: "Importer/Exporter",
        document_instruction: "Upload IECode",
      },

      {
        name: "CFS",
        document_instruction: "Upload Customs License",
      },

      {
        name: "Console Agents/Main Line Operators/Exporter",
        document_instruction: "Upload Customs License",
      },

      {
        name: "Transporting firms",
        document_instruction:
          "Upload Certificate of incorporation/Undertaking Letter Head",
      },

      {
        name: "Associations",
        document_instruction: "Upload Register of societies",
      },

      {
        name: "Govt Departments",
        document_instruction: "Upload Govt Dept Letterpad",
      },

      {
        name: "Chipping/Painting",
        document_instruction: "Upload License/Authorization letter",
      },

      {
        name: "Container/Operator",
        document_instruction: "Upload Agreement/Proof of CFS operator",
      },

      {
        name: "Contractor",
        document_instruction: "Upload Work Order/Authorised Letter",
      },

      {
        name: "Co-Operative Stores",
        document_instruction: "Upload Proof of Operation/Authorization Letter",
      },

      {
        name: "Custom House and Steamer Agent",
        document_instruction: "Upload License/Authorization Letter",
      },

      {
        name: "Custom House Agent",
        document_instruction: "Upload License/Authorization Letter",
      },

      {
        name: "Department",
        document_instruction: "Upload Recommendation/Authorization Letter",
      },

      {
        name: "Labour Licence",
        document_instruction: "Upload License/Authorization Letter",
      },

      {
        name: "Lounch Operation",
        document_instruction:
          "Upload License/Proof of Work/Authorization Letter",
      },

      {
        name: "Lease and Plot holder",
        document_instruction: "Upload Allotment Order",
      },

      {
        name: "MLO or Consol Agent",
        document_instruction: "Upload Proof of Registration",
      },

      {
        name: "Reg. Transport Association",
        document_instruction: "Upload Proof of Registration/ Request letter",
      },

      {
        name: "Self Clearing(Customs)",
        document_instruction: "Upload License/Authorization Letter",
      },

      {
        name: "Ship Chandlers",
        document_instruction: "Upload License/Authorization Letter",
      },

      {
        name: "Ship Garbage Disposal",
        document_instruction: "Upload License/Authorization Letter",
      },

      {
        name: "Sailors Society",
        document_instruction: "Upload Proof of Registration/ Request letter",
      },

      {
        name: "Storage Tank",
        document_instruction: "Upload Allotment Order",
      },

      {
        name: "Surveyours",
        document_instruction: "Upload Proof of Registration as Surveyor",
      },

      {
        name: "Unions",
        document_instruction: "Upload Request Letter/Authorisation Letter",
      },

      {
        name: "Water Supplier",
        document_instruction: "Upload Request Letter/Authorisation Letter",
      },

      {
        name: "Society",
        document_instruction: "Upload Request Letter/Authorisation Letter",
      },

      {
        name: "Terminal Operator",
        document_instruction:
          "Upload Certificate of incorporation/Undertaking Letter Head",
      },

      {
        name: "Ship repairer",
        document_instruction: "Upload Plot License/Authorization Letter",
      },

      {
        name: "Others",
        document_instruction: "Upload Supporting Document",
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("User_types", null, {});
  },
};
