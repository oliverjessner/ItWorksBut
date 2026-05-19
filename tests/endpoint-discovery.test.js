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

test("endpoint discovery applies mounted API prefixes to router routes", async () => {
  const root = await fixture();
  await writeFile(root, "server.js", 'app.use("/api", router);\n');
  await writeFile(root, "routes/users.js", 'router.get("/users", handler);\n');

  const result = await discoverEndpoints(root);

  assertEndpoint(result.safeEndpoints, "GET", "/api/users");
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

function assertSkipped(result, method, routePath, reason) {
  const endpoint = result.skippedEndpoints.find((candidate) => candidate.method === method && candidate.path === routePath);
  assert.ok(endpoint, `Expected skipped ${method} ${routePath}`);
  assert.equal(endpoint.reason, reason);
}
