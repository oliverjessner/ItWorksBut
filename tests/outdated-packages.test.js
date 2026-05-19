import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseOutdatedOutput,
  runOutdatedPackagesCheck
} from "../src/checks/dependencies/outdated-packages.js";

test("npm outdated JSON is normalized", () => {
  const parsed = parseOutdatedOutput("npm", JSON.stringify({
    express: {
      current: "4.18.2",
      wanted: "4.18.3",
      latest: "5.1.0",
      type: "dependencies"
    }
  }));

  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.packages, [
    {
      name: "express",
      current: "4.18.2",
      wanted: "4.18.3",
      latest: "5.1.0",
      type: "dependencies"
    }
  ]);
});

test("yarn classic outdated JSON lines are normalized", () => {
  const output = [
    JSON.stringify({ type: "info", data: "Color legend" }),
    JSON.stringify({
      type: "table",
      data: {
        head: ["Package", "Current", "Wanted", "Latest", "Package Type", "URL"],
        body: [["zod", "3.22.4", "3.25.1", "3.25.1", "dependencies", "https://zod.dev"]]
      }
    })
  ].join("\n");

  const parsed = parseOutdatedOutput("yarn", output);

  assert.equal(parsed.ok, true);
  assert.equal(parsed.packages[0].name, "zod");
  assert.equal(parsed.packages[0].current, "3.22.4");
  assert.equal(parsed.packages[0].type, "dependencies");
});

test("empty outdated output produces a passing check", async () => {
  const result = await runOutdatedPackagesCheck(context(), {
    runCommand: async () => commandResult({ stdout: "{}" })
  });

  assert.equal(result.status, "pass");
  assert.equal(result.summary, "all dependencies are up to date");
  assert.deepEqual(result.details, []);
});

test("outdated packages produce a warning check", async () => {
  const result = await runOutdatedPackagesCheck(context(), {
    runCommand: async () => commandResult({
      exitCode: 1,
      stdout: JSON.stringify({
        express: {
          current: "4.18.2",
          wanted: "4.18.3",
          latest: "5.1.0",
          type: "dependencies"
        }
      })
    })
  });

  assert.equal(result.status, "warn");
  assert.equal(result.summary, "1 package outdated");
  assert.equal(result.details[0].name, "express");
});

test("missing package.json skips outdated package check", async () => {
  const result = await runOutdatedPackagesCheck({
    rootPath: "/tmp/project",
    packageJson: null,
    allFiles: []
  });

  assert.equal(result.status, "skip");
  assert.equal(result.summary, "skipped, no package.json found");
});

test("command errors produce a failing check", async () => {
  const result = await runOutdatedPackagesCheck(context(), {
    runCommand: async () => commandResult({
      exitCode: 2,
      stderr: "registry unavailable"
    })
  });

  assert.equal(result.status, "fail");
  assert.match(result.summary, /npm outdated failed/);
  assert.equal(result.details[0].exitCode, 2);
});

test("missing package manager produces a failing check without throwing", async () => {
  const result = await runOutdatedPackagesCheck(context({
    allFiles: ["package.json", "pnpm-lock.yaml"]
  }), {
    runCommand: async () => commandResult({
      command: "pnpm",
      args: ["outdated", "--json"],
      exitCode: "ENOENT",
      stderr: "spawn pnpm ENOENT",
      error: { code: "ENOENT" }
    })
  });

  assert.equal(result.status, "fail");
  assert.match(result.summary, /pnpm is not installed/);
});

test("exit code 1 with valid outdated JSON is not fatal", async () => {
  const result = await runOutdatedPackagesCheck(context(), {
    runCommand: async () => commandResult({
      exitCode: 1,
      stdout: JSON.stringify({
        zod: {
          current: "3.22.4",
          wanted: "3.25.1",
          latest: "3.25.1"
        }
      })
    })
  });

  assert.equal(result.status, "warn");
  assert.equal(result.details[0].name, "zod");
});

test("invalid outdated JSON produces a failing check", async () => {
  const result = await runOutdatedPackagesCheck(context(), {
    runCommand: async () => commandResult({
      stdout: "not-json"
    })
  });

  assert.equal(result.status, "fail");
  assert.match(result.summary, /could not be parsed/);
});

function context(overrides = {}) {
  return {
    rootPath: "/tmp/project",
    packageJson: {
      dependencies: {
        express: "^4.18.0",
        zod: "^3.22.0"
      }
    },
    allFiles: ["package.json", "package-lock.json"],
    ...overrides
  };
}

function commandResult(overrides = {}) {
  return {
    command: "npm",
    args: ["outdated", "--json"],
    stdout: "",
    stderr: "",
    exitCode: 0,
    ...overrides
  };
}
