import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { reportMarkdown, writeMarkdownReport } from "../src/reporters/markdownReport.js";

test("markdown report includes summary and outdated package details without ANSI", () => {
  const markdown = reportMarkdown(sampleResult());

  assert.match(markdown, /^# ItWorksBut Scan Report/m);
  assert.match(markdown, /\| Status \| Count \|/);
  assert.match(markdown, /### Outdated packages/);
  assert.match(markdown, /\| express \| 4\.18\.2 \| 4\.18\.3 \| 5\.1\.0 \| dependencies \|/);
  assert.match(markdown, /## Recommendations/);
  assert.doesNotMatch(markdown, /\u001B\[[0-?]*[ -/]*[@-~]/);
});

test("markdown report writer overwrites report.md", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "itworksbut-report-"));
  const filePath = path.join(root, "report.md");
  await fs.writeFile(filePath, "old report\n", "utf8");

  const result = await writeMarkdownReport(sampleResult(), { filePath });
  const markdown = await fs.readFile(filePath, "utf8");

  assert.equal(result.overwritten, true);
  assert.match(markdown, /^# ItWorksBut Scan Report/m);
  assert.doesNotMatch(markdown, /old report/);
  assert.doesNotMatch(markdown, /\u001B\[[0-?]*[ -/]*[@-~]/);
});

function sampleResult() {
  return {
    findings: [],
    warnings: [],
    config: { failOn: "low" },
    meta: {
      tool: "ItWorksBut",
      version: "0.5.0",
      rootPath: "/tmp/my-project",
      packageName: "my-project",
      completedAt: "2026-05-19T10:34:56.000Z"
    },
    checks: [
      {
        id: "git.gitignore-missing",
        title: "Gitignore",
        category: "git",
        status: "pass",
        summary: ".gitignore exists and contains common Node.js ignores.",
        details: [
          { message: "node_modules/ ignored" },
          { message: ".env ignored" },
          { message: "dist/ ignored" }
        ]
      },
      {
        id: "dependencies.outdated-packages",
        title: "Outdated packages",
        category: "dependencies",
        status: "warn",
        summary: "1 package outdated",
        details: [
          {
            name: "express",
            current: "4.18.2",
            wanted: "4.18.3",
            latest: "5.1.0",
            type: "dependencies"
          }
        ]
      }
    ]
  };
}
