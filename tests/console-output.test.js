import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { printIntro, isFancyOutputEnabled, shouldUseSpinner } from "../src/cli/terminal.js";
import { reportConsole } from "../src/reporters/consoleReporter.js";
import { formatSeverity, getShipStatus } from "../src/reporters/consoleStyle.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(repoRoot, "bin/itworksbut.js");

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

test("--no-banner suppresses intro output", () => {
  const output = captureStdout(() => {
    withTty(true, () => {
      printIntro({ noBanner: true, theme: "default" });
    });
  });

  assert.equal(output, "");
});

test("--compact creates one-line finding output", () => {
  const output = captureStdout(() => {
    reportConsole(sampleResult(), {
      compact: true,
      noColor: true,
      noBanner: true,
      noSpinner: true,
      theme: "mono"
    });
  });

  assert.match(output, /CRITICAL env\.env-file-tracked \.env - It works, but your \.env is tracked\./);
});

test("severity formatter exposes expected labels", () => {
  assert.equal(formatSeverity("critical", { noColor: true, theme: "mono" }).label, "CRITICAL");
  assert.equal(formatSeverity("high", { noColor: true, theme: "mono" }).label, "HIGH");
  assert.equal(formatSeverity("medium", { noColor: true, theme: "mono" }).label, "MEDIUM");
  assert.equal(formatSeverity("low", { noColor: true, theme: "mono" }).label, "LOW");
  assert.equal(formatSeverity("info", { noColor: true, theme: "mono" }).label, "INFO");
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

  assert.equal(isFancyOutputEnabled({ theme: "default" }, env, fakeStdout), false);
  assert.equal(shouldUseSpinner({ theme: "default" }, env, fakeStdout), false);
});

async function fixture() {
  return await fs.mkdtemp(path.join(os.tmpdir(), "itworksbut-output-"));
}

function sampleResult() {
  return {
    findings: [
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
    ],
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
