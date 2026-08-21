/**
 * Route Registration Verification Test
 * 
 * Verifies that all routes including the new public request routes
 * are properly registered in the application.
 */

const express = require("express");
const routes = require("../src/routes/index");

describe("Route Registration Verification", () => {
  let app;
  let router;

  beforeAll(() => {
    app = express();
    router = routes;
  });

  test("should have publicRequestRoutes registered", () => {
    const routeStack = router.stack || [];
    const bulkPassPublicRoute = routeStack.find(
      (layer) => layer.regexp && layer.regexp.test("/bulk-pass/public")
    );
    expect(bulkPassPublicRoute).toBeDefined();
  });

  test("should have adminPublicRequestRoutes registered", () => {
    const routeStack = router.stack || [];
    const bulkPassAdminRoute = routeStack.find(
      (layer) => layer.regexp && layer.regexp.test("/bulk-pass/admin")
    );
    expect(bulkPassAdminRoute).toBeDefined();
  });

  test("should have captchaRoutes registered", () => {
    const routeStack = router.stack || [];
    const captchaRoute = routeStack.find(
      (layer) => layer.regexp && layer.regexp.test("/captcha")
    );
    expect(captchaRoute).toBeDefined();
  });

  test("should have bulkPassRoutes registered", () => {
    const routeStack = router.stack || [];
    const bulkPassRoute = routeStack.find(
      (layer) => layer.regexp && layer.regexp.test("/bulk-pass") && 
      !layer.regexp.test("/bulk-pass/public") && 
      !layer.regexp.test("/bulk-pass/admin")
    );
    expect(bulkPassRoute).toBeDefined();
  });

  test("should have correct route order (specific before general)", () => {
    const routeStack = router.stack || [];
    const routes = routeStack
      .filter((layer) => layer.regexp)
      .map((layer) => layer.regexp.toString());
    
    const bulkPassPublicIndex = routes.findIndex((r) => r.includes("bulk-pass/public"));
    const bulkPassAdminIndex = routes.findIndex((r) => r.includes("bulk-pass/admin"));
    const bulkPassIndex = routes.findIndex((r) => 
      r.includes("bulk-pass") && 
      !r.includes("bulk-pass/public") && 
      !r.includes("bulk-pass/admin")
    );

    // More specific routes should come before general routes
    if (bulkPassPublicIndex !== -1 && bulkPassIndex !== -1) {
      expect(bulkPassPublicIndex).toBeLessThan(bulkPassIndex);
    }
    if (bulkPassAdminIndex !== -1 && bulkPassIndex !== -1) {
      expect(bulkPassAdminIndex).toBeLessThan(bulkPassIndex);
    }
  });
});
