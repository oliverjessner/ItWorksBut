import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { discoverEndpoints } from "../src/stress/discoverEndpoints.js";

test("endpoint discovery finds Express app.get routes", async () => {
  const root = await fixture();
  await writeFile(root, "server.js", 'app.get("/api/health", (req, res) => res.json({ ok: true }));\n');

  const result = await discoverEndpoints(root);

  assertEndpoint(result.safeEndpoints, "GET", "/api/health");
});

test("endpoint discovery finds Express router.get routes", async () => {
  const root = await fixture();
  await writeFile(root, "routes.js", 'router.get("/users", handler);\n');

  const result = await discoverEndpoints(root);

  assertEndpoint(result.safeEndpoints, "GET", "/users");
});

test("endpoint discovery ignores non-route get calls in frontend code", async () => {
  const root = await fixture();
  await writeFile(
    root,
    "frontend/app.js",
    'const path = formData.get("path");\nconst contentType = response.headers.get("content-type");\n'
  );

  const result = await discoverEndpoints(root);

  assert.equal(result.endpoints.length, 0);
  assert.equal(result.status, "skip");
});

test("endpoint discovery applies mounted API prefixes to router routes", async () => {
  const root = await fixture();
  await writeFile(root, "server.js", 'app.use("/api", router);\n');
  await writeFile(root, "routes/users.js", 'router.get("/users", handler);\n');

  const result = await discoverEndpoints(root);

  assertEndpoint(result.safeEndpoints, "GET", "/api/users");
  assertNoEndpoint(result.endpoints, "GET", "/users");
});

test("endpoint discovery scopes mounted router prefixes to imported router modules", async () => {
  const root = await fixture();
  await writeFile(
    root,
    "server.js",
    [
      'const { createUsersRouter } = require("./routes/users");',
      'const { createAdminRouter } = require("./routes/admin");',
      'app.use("/api/users", createUsersRouter());',
      'app.use("/api/admin", createAdminRouter());',
      'app.use("/vendor/widgets", express.static("vendor/widgets"));',
      'app.use("/api", rateLimit({ max: 10 }));',
      ""
    ].join("\n")
  );
  await writeFile(root, "routes/users.js", 'const router = express.Router();\nrouter.get("/list", handler);\n');
  await writeFile(root, "routes/admin.js", 'const router = express.Router();\nrouter.get("/dashboard", handler);\n');

  const result = await discoverEndpoints(root);

  assertEndpoint(result.safeEndpoints, "GET", "/api/users/list");
  assertEndpoint(result.safeEndpoints, "GET", "/api/admin/dashboard");
  assertNoEndpoint(result.endpoints, "GET", "/list");
  assertNoEndpoint(result.endpoints, "GET", "/dashboard");
  assertNoEndpoint(result.endpoints, "GET", "/api/list");
  assertNoEndpoint(result.endpoints, "GET", "/api/users/dashboard");
  assertNoEndpoint(result.endpoints, "GET", "/vendor/widgets/list");
});

test("endpoint discovery finds Fastify route calls and route objects", async () => {
  const root = await fixture();
  await writeFile(
    root,
    "server.js",
    'fastify.get("/api/health", handler);\nfastify.route({ method: "POST", url: "/api/users", handler });\n'
  );

  const result = await discoverEndpoints(root);

  assertEndpoint(result.safeEndpoints, "GET", "/api/health");
  assertSkipped(result, "POST", "/api/users", "unsafe method");
});

test("endpoint discovery finds Next.js App Router route files", async () => {
  const root = await fixture();
  await writeFile(root, "app/api/health/route.js", "export async function GET() {}\n");

  const result = await discoverEndpoints(root);

  assertEndpoint(result.safeEndpoints, "GET", "/api/health");
});

test("endpoint discovery finds Next.js App Router route handlers outside /api", async () => {
  const root = await fixture();
  await writeFile(root, "app/app/route.ts", "export async function GET() {}\n");

  const result = await discoverEndpoints(root);

  assertEndpoint(result.safeEndpoints, "GET", "/app");
});

test("endpoint discovery finds Next.js Pages Router files", async () => {
  const root = await fixture();
  await writeFile(root, "pages/api/health.js", "export default function handler(req, res) {}\n");

  const result = await discoverEndpoints(root);

  assertEndpoint(result.safeEndpoints, "GET", "/api/health");
});

test("endpoint discovery finds SvelteKit server routes", async () => {
  const root = await fixture();
  await writeFile(root, "src/routes/api/health/+server.ts", "export async function GET() {}\n");

  const result = await discoverEndpoints(root);

  assertEndpoint(result.safeEndpoints, "GET", "/api/health");
});

test("endpoint discovery finds exported const route handlers", async () => {
  const root = await fixture();
  await writeFile(root, "src/routes/api/health/+server.ts", "export const GET = async () => Response.json({ ok: true });\n");

  const result = await discoverEndpoints(root);

  assertEndpoint(result.safeEndpoints, "GET", "/api/health");
});

test("endpoint discovery finds Nitro server API routes", async () => {
  const root = await fixture();
  await writeFile(root, "server/api/health.get.ts", "export default defineEventHandler(() => ({ ok: true }));\n");

  const result = await discoverEndpoints(root);

  assertEndpoint(result.safeEndpoints, "GET", "/api/health");
});

test("endpoint discovery infers SAST API candidate files", async () => {
  const root = await fixture();
  await writeFile(root, "routes/health.js", "export default function handler(req, res) { res.json({ ok: true }); }\n");

  const result = await discoverEndpoints(root);

  assertEndpoint(result.safeEndpoints, "GET", "/health");
});

test("endpoint discovery does not infer vendored route assets as API endpoints", async () => {
  const root = await fixture();
  await writeFile(
    root,
    "src/routes/vendor/cytoscape-elk/history.js",
    "export function toJson(history) { return JSON.stringify(history); }\nconst response = new Response('{}');\n"
  );

  const result = await discoverEndpoints(root);

  assert.equal(result.endpoints.some((endpoint) => endpoint.path === "/vendor/cytoscape-elk/history"), false);
  assert.equal(result.status, "skip");
});

test("endpoint discovery marks dynamic routes as skipped", async () => {
  const root = await fixture();
  await writeFile(root, "app/api/users/[id]/route.ts", "export async function GET() {}\n");

  const result = await discoverEndpoints(root);

  const skipped = result.skippedEndpoints.find((endpoint) => endpoint.path === "/api/users/:id");
  assert.equal(skipped.method, "GET");
  assert.equal(skipped.reason, "dynamic route requires parameter");
});

test("endpoint discovery marks mutating methods as skipped", async () => {
  const root = await fixture();
  await writeFile(root, "server.js", 'app.post("/api/users", handler);\napp.delete("/api/users/:id", handler);\n');

  const result = await discoverEndpoints(root);

  assertSkipped(result, "POST", "/api/users", "unsafe method");
  assertSkipped(result, "DELETE", "/api/users/:id", "unsafe method");
  assert.equal(result.safeEndpoints.length, 0);
});

test("endpoint discovery returns skip status when no endpoints are found", async () => {
  const root = await fixture();
  await writeFile(root, "index.js", "console.log('hello');\n");

  const result = await discoverEndpoints(root);

  assert.equal(result.status, "skip");
  assert.equal(result.endpoints.length, 0);
});

async function fixture() {
  return await fs.mkdtemp(path.join(os.tmpdir(), "itworksbut-endpoints-"));
}

async function writeFile(root, relativePath, content) {
  const absolutePath = path.join(root, relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, content);
}

function assertEndpoint(endpoints, method, routePath) {
  assert.equal(
    endpoints.some((endpoint) => endpoint.method === method && endpoint.path === routePath),
    true,
    `Expected ${method} ${routePath}. Actual: ${endpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`).join(", ")}`
  );
}

function assertNoEndpoint(endpoints, method, routePath) {
  assert.equal(
    endpoints.some((endpoint) => endpoint.method === method && endpoint.path === routePath),
    false,
    `Did not expect ${method} ${routePath}. Actual: ${endpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`).join(", ")}`
  );
}

function assertSkipped(result, method, routePath, reason) {
  const endpoint = result.skippedEndpoints.find((candidate) => candidate.method === method && candidate.path === routePath);
  assert.ok(endpoint, `Expected skipped ${method} ${routePath}`);
  assert.equal(endpoint.reason, reason);
}
