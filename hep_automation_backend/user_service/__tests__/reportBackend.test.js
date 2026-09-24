const reportMethodNames = [
  "getRegisteredUserOptions",
  "getRegisteredUsersReport",
  "getTypeOfPassIssuedReport",
  "getAllPassIssuanceOptions",
  "getAllPassIssuanceReport",
  "getRevenueReport",
  "getPassApprovalReport",
  "getQrInventorySummary",
  "getGateSummary",
  "getPassPenaltyReport",
  "getShiftWiseApprovalReport",
  "getBulkPassReport",
  "getBlacklistingReport",
  "getMaterialMovementReport",
  "getVehicleMasterReport",
];

const mockReportModel = Object.fromEntries(
  reportMethodNames.map((method) => [method, jest.fn()]),
);

jest.mock("../src/models/reportSchema", () => mockReportModel);

const reportController = require("../src/controllers/reportController");
const reportRoutes = require("../src/routes/reportRoutes");

const endpointToController = {
  "/registered-users/options": "getRegisteredUserOptions",
  "/registered-users": "getRegisteredUsersReport",
  "/type-of-pass-issued": "getTypeOfPassIssuedReport",
  "/all-pass-issuance/options": "getAllPassIssuanceOptions",
  "/all-pass-issuance": "getAllPassIssuanceReport",
  "/revenue-report": "getRevenueReport",
  "/pass-approval-report": "getPassApprovalReport",
  "/gate-wise-in-out-summary": "getGateWiseSummary",
  "/gate-lane-wise-in-out-summary": "getGateLaneWiseSummary",
  "/card-inventory-summary": "getQrInventorySummary",
  "/card-penalty-report": "getPassPenaltyReport",
  "/shift-wise-approval-rejection": "getShiftWiseApprovalReport",
  "/bulk-pass-report": "getBulkPassReport",
  "/blacklisting-report": "getBlacklistingReport",
  "/material-movement-report": "getMaterialMovementReport",
  "/vehicle-master": "getVehicleMasterReport",
};

function createResponse() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe("Reports backend", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    reportMethodNames.forEach((method) => {
      mockReportModel[method].mockResolvedValue({ data: [], pagination: {} });
    });
  });

  test("registers every report GET endpoint", () => {
    const registeredPaths = reportRoutes.stack
      .filter((layer) => layer.route?.methods?.get)
      .map((layer) => layer.route.path);

    expect(registeredPaths).toEqual(expect.arrayContaining(Object.keys(endpointToController)));
    expect(registeredPaths).toHaveLength(Object.keys(endpointToController).length);
  });

  test.each(Object.entries(endpointToController))(
    "%s returns a successful JSON response through %s",
    async (endpoint, controllerName) => {
      const request = { query: { search: "sample", page: "1", limit: "10" } };
      const response = createResponse();

      await reportController[controllerName](request, response);

      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);

      if (controllerName === "getGateLaneWiseSummary") {
        expect(mockReportModel.getGateSummary).toHaveBeenCalledWith(request.query, true);
      } else if (controllerName === "getRegisteredUserOptions") {
        expect(mockReportModel.getRegisteredUserOptions).toHaveBeenCalledTimes(1);
      } else if (controllerName === "getAllPassIssuanceOptions") {
        expect(mockReportModel.getAllPassIssuanceOptions).toHaveBeenCalledTimes(1);
      } else {
        const modelMethod = {
          getGateWiseSummary: "getGateSummary",
        }[controllerName] || controllerName;
        expect(mockReportModel[modelMethod]).toHaveBeenCalledWith(request.query);
      }
    },
  );

  test("returns a controlled 500 response when a report query fails", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    mockReportModel.getVehicleMasterReport.mockRejectedValueOnce(new Error("database unavailable"));
    const response = createResponse();

    await reportController.getVehicleMasterReport({ query: {} }, response);

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      success: false,
      message: "Failed to fetch vehicle master report",
    });
    consoleError.mockRestore();
  });
});
