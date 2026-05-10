import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { printIntro, isFancyOutputEnabled, shouldUseSpinner } from "../src/cli/terminal.js";
import { reportConsole } from "../src/reporters/consoleReporter.js";
import { formatSeverity, getFixPrompt, getShipStatus } from "../src/reporters/consoleStyle.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(repoRoot, "bin/itworksbut.js");
const packageJson = JSON.parse(await fs.readFile(path.join(repoRoot, "package.json"), "utf8"));

test("--json contains no banner and is valid JSON", async () => {
  const root = await fixture();
  const output = execFileSync(process.execPath, [cliPath, "scan", "--path", root, "--json", "--fail-on", "critical"], {
    encoding: "utf8",
    env: { ...process.env, CI: "true" }
  });

  const parsed = JSON.parse(output);

  assert.equal(parsed.tool, "ItWorksBut");
  assert.equal(output.includes("AI-built? Nice."), false);
  assert.equal(output.includes("It works, but"), false);
  assert.equal(output.includes("receipts"), false);
});

test("--version prints package version", () => {
  const output = execFileSync(process.execPath, [cliPath, "--version"], {
    encoding: "utf8"
  });

  assert.match(output.trim(), new RegExp(`\\b${escapeRegExp(packageJson.version)}\\b`));
});

test("--no-banner suppresses intro output", () => {
  const output = captureStdout(() => {
    withTty(true, () => {
      printIntro({ noBanner: true });
    });
  });

  assert.equal(output, "");
});

test("console output renders medium findings and caution summary", () => {
  const output = captureStdout(() => {
    reportConsole(resultWithFindings([
      {
        checkId: "dependencies.lockfile-missing",
        severity: "medium",
        title: "Package lockfile should be committed",
        category: "dependencies",
        message: "package.json exists, but no package lockfile was found.",
        file: "package.json",
        recommendation: "Commit exactly one lockfile.",
        tags: ["dependencies"]
      }
    ]), {
      noColor: true,
      noBanner: true
    });
  });

  assert.match(output, /MEDIUM\s+It works on your machine, but your dependency tree is not locked\./);
  assert.match(output, /ship status: SHIP WITH CAUTION/);
  assert.match(output, /- medium: 1/);
});

test("console output renders low findings without blocking ship status", () => {
  const output = captureStdout(() => {
    reportConsole(resultWithFindings([
      {
        checkId: "dependencies.audit-script-missing",
        severity: "low",
        title: "Dependency security audit should be available",
        category: "dependencies",
        message: "package.json does not appear to define an audit or security script.",
        file: "package.json",
        recommendation: "Add an npm audit or equivalent security script.",
        tags: ["dependencies"]
      }
    ]), {
      noColor: true,
      noBanner: true
    });
  });

  assert.match(output, /LOW\s+It works, but dependency security audit should be available\./);
  assert.match(output, /ship status: SHIP IT, BUT STAY PARANOID/);
  assert.match(output, /- low: 1/);
});

test("console fix output is an actionable prompt", () => {
  const output = captureStdout(() => {
    reportConsole(sampleResult(), {
      noColor: true,
      noBanner: true
    });
  });

  assert.match(output, /Prompt:\s+You are a senior security engineer working in this repository\./);
  assert.match(output, /Fix the ItWorksBut finding env\.env-file-tracked at \.env\./);
  assert.match(output, /Do not print, log, or preserve raw secret values/);
});

test("fix prompt redacts secret values by construction", () => {
  const prompt = getFixPrompt({
    checkId: "env.possible-secret-in-code",
    severity: "critical",
    category: "env",
    message: "A possible OPENAI_API_KEY value appears to be hardcoded. The value was not printed.",
    file: "src/app.js",
    line: 12,
    recommendation: "Move the secret to a secure runtime secret store.",
    tags: ["secrets"],
    metadata: {
      secretType: "OPENAI_API_KEY",
      valueRedacted: true
    }
  });

  assert.match(prompt, /Fix the ItWorksBut finding env\.possible-secret-in-code at src\/app\.js:12/);
  assert.match(prompt, /Do not print, log, or preserve raw secret values/);
  assert.doesNotMatch(prompt, /sk-[A-Za-z0-9]/);
});

test("severity formatter exposes expected labels", () => {
  assert.equal(formatSeverity("critical", { noColor: true }).label, "CRITICAL");
  assert.equal(formatSeverity("high", { noColor: true }).label, "HIGH");
  assert.equal(formatSeverity("medium", { noColor: true }).label, "MEDIUM");
  assert.equal(formatSeverity("low", { noColor: true }).label, "LOW");
  assert.equal(formatSeverity("info", { noColor: true }).label, "INFO");
});

test("summary ship status follows highest finding severity", () => {
  assert.equal(getShipStatus({ critical: 1, high: 0, medium: 0, low: 0, info: 0 }).status, "DO NOT SHIP");
  assert.equal(getShipStatus({ critical: 0, high: 1, medium: 0, low: 0, info: 0 }).status, "FIX BEFORE SHIP");
  assert.equal(getShipStatus({ critical: 0, high: 0, medium: 1, low: 0, info: 0 }).status, "SHIP WITH CAUTION");
  assert.equal(getShipStatus({ critical: 0, high: 0, medium: 0, low: 0, info: 0 }).status, "SHIP IT, BUT STAY PARANOID");
});

test("CI disables fancy output and spinner", () => {
  const fakeStdout = { isTTY: true };
  const env = { CI: "true" };

  assert.equal(isFancyOutputEnabled({}, env, fakeStdout), false);
  assert.equal(shouldUseSpinner({}, env, fakeStdout), false);
});

async function fixture() {
  return await fs.mkdtemp(path.join(os.tmpdir(), "itworksbut-output-"));
}

function sampleResult() {
  return resultWithFindings([
      {
        checkId: "env.env-file-tracked",
        severity: "critical",
        title: "Environment files must not be tracked",
        category: "env",
        message: ".env appears to be tracked by git. Secrets may be exposed.",
        file: ".env",
        recommendation: "Remove it from git index, rotate secrets, and commit .env.example.",
        tags: ["secrets"]
      }
    ]);
}

function resultWithFindings(findings) {
  return {
    findings,
    warnings: [],
    config: { failOn: "high" },
    meta: {
      filesScanned: 1,
      textFilesScanned: 1,
      gitAvailable: false
    }
  };
}

function captureStdout(fn) {
  const originalWrite = process.stdout.write;
  let output = "";
  process.stdout.write = (chunk, ...args) => {
    output += String(chunk);
    const callback = args.find((arg) => typeof arg === "function");
    if (callback) callback();
    return true;
  };

  try {
    fn();
  } finally {
    process.stdout.write = originalWrite;
  }

  return output;
}

function withTty(value, fn) {
  const descriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
  Object.defineProperty(process.stdout, "isTTY", {
    configurable: true,
    value
  });

  try {
    fn();
  } finally {
    if (descriptor) {
      Object.defineProperty(process.stdout, "isTTY", descriptor);
    } else {
      delete process.stdout.isTTY;
    }
  }
}

function escapeRegExp(value) {
  return String(value).replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}
