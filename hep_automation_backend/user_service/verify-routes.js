/**
 * Simple script to verify route registration
 */

const routes = require("./src/routes/index");

console.log("\n=== Registered Routes ===\n");

routes.stack.forEach((layer, index) => {
  if (layer.route) {
    const path = layer.route.path;
    const methods = Object.keys(layer.route.methods).join(", ").toUpperCase();
    console.log(`${index + 1}. ${methods} ${path}`);
  } else if (layer.name === "router" && layer.regexp) {
    const path = layer.regexp.toString()
      .replace("/^\\", "")
      .replace("\\/?(?=\\/|$)/i", "")
      .replace(/\\\//g, "/");
    console.log(`${index + 1}. ROUTER: ${path}`);
  } else if (layer.handle && layer.handle.stack) {
    // This is a mounted router - show its mount path
    const pathMatch = layer.regexp ? layer.regexp.toString().match(/\/([^\\\/]+)/) : null;
    const mountPath = pathMatch ? `/${pathMatch[1]}` : "unknown";
    console.log(`${index + 1}. ROUTER mounted at: ${mountPath}`);
  }
});

console.log("\n=== Verification Complete ===\n");
