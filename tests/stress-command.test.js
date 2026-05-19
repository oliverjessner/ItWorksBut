import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { runStress } from "../src/commands/stress.js";

test("runStress discovers safe endpoints and parses mocked Artillery results", async () => {
  const root = await fixture();
  await writeFile(root, "server.js", 'app.get("/api/health", handler);\n');
  let capturedConfig;

  const result = await runStress({
    rootPath: root,
    target: "http://localhost:3000",
    duration: 30,
    arrivalRate: 5,
    maxVusers: 50
  }, {
    execute: async (config) => {
      capturedConfig = config;
      return {
        ok: true,
        report: {
          aggregate: {
            counters: {
              "http.requests": 150,
              "http.codes.200": 150
            },
            summaries: {
              "http.response_time": { p95: 42, p99: 80 }
            }
          }
        }
      };
    }
  });

  assert.equal(result.status, "pass");
  assert.equal(result.details.testedEndpoints[0].path, "/api/health");
  assert.deepEqual(capturedConfig.scenarios[0].flow, [{ get: { url: "/api/health" } }]);
});

test("runStress fails when only unsafe endpoints are discovered", async () => {
  const root = await fixture();
  await writeFile(root, "server.js", 'app.post("/api/users", handler);\n');

  const result = await runStress({
    rootPath: root,
    target: "http://localhost:3000",
    duration: 30,
    arrivalRate: 5,
    maxVusers: 50
  }, {
    execute: async () => {
      throw new Error("runner should not be called");
    }
  });

  assert.equal(result.status, "fail");
  assert.equal(result.details.testedEndpoints.length, 0);
  assert.equal(result.details.skippedEndpoints[0].reason, "unsafe method");
});

async function fixture() {
  return await fs.mkdtemp(path.join(os.tmpdir(), "itworksbut-stress-command-"));
}

async function writeFile(root, relativePath, content) {
  const absolutePath = path.join(root, relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, content);
}
