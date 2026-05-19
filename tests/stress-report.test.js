import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { reportStressMarkdown, writeStressMarkdownReport } from "../src/reporters/stressMarkdownReport.js";

test("stress markdown report includes summary, tested endpoints, skipped endpoints, and no ANSI", () => {
  const markdown = reportStressMarkdown(sampleResult());

  assert.match(markdown, /^# ItWorksBut Stress Report/m);
  assert.match(markdown, /\| Metric \| Value \|/);
  assert.match(markdown, /## Tested Endpoints/);
  assert.match(markdown, /\| GET \| \/api\/health \| pass \| 42 ms \| 80 ms \| 0 \| 0% \|/);
  assert.match(markdown, /## Skipped Endpoints/);
  assert.match(markdown, /\| POST \| \/api\/users \| unsafe method \|/);
  assert.doesNotMatch(markdown, /\u001B\[[0-?]*[ -/]*[@-~]/);
});

test("stress markdown report writer creates stress-report.md", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "itworksbut-stress-report-"));
  const result = await writeStressMarkdownReport(sampleResult(), { directoryPath: root });
  const markdown = await fs.readFile(path.join(root, "stress-report.md"), "utf8");

  assert.equal(result.overwritten, false);
  assert.match(markdown, /^# ItWorksBut Stress Report/m);
  assert.doesNotMatch(markdown, /\u001B\[[0-?]*[ -/]*[@-~]/);
});

function sampleResult() {
  return {
    id: "stress-test",
    title: "API stress test",
    status: "warn",
    summary: "2 endpoints tested, 1 warning, 0 failed",
    details: {
      target: "http://localhost:3000",
      duration: 30,
      arrivalRate: 5,
      maxVusers: 50,
      endpointsFound: 3,
      warnings: 1,
      failed: 0,
      completedAt: "2026-05-19T10:34:56.000Z",
      testedEndpoints: [
        {
          method: "GET",
          path: "/api/health",
          status: "pass",
          requests: 150,
          p95: 42,
          p99: 80,
          errors: 0,
          errorRate: 0
        },
        {
          method: "GET",
          path: "/api/search",
          status: "warn",
          requests: 150,
          p95: 820,
          p99: 1300,
          errors: 2,
          errorRate: 1.3
        }
      ],
      skippedEndpoints: [
        { method: "POST", path: "/api/users", reason: "unsafe method" }
      ]
    }
  };
}
