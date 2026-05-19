import fs from "node:fs/promises";
import path from "node:path";

const ANSI_PATTERN = /\u001B\[[0-?]*[ -/]*[@-~]/g;

export async function writeStressMarkdownReport(result, options = {}) {
  const filePath = options.filePath || path.join(options.directoryPath || process.cwd(), "stress-report.md");
  let overwritten = false;

  try {
    await fs.access(filePath);
    overwritten = true;
  } catch {
    overwritten = false;
  }

  await fs.writeFile(filePath, reportStressMarkdown(result), "utf8");
  return { filePath, overwritten };
}

export function reportStressMarkdown(result) {
  const details = result.details || {};
  const tested = details.testedEndpoints || [];
  const skipped = details.skippedEndpoints || [];

  return stripAnsi(`${[
    "# ItWorksBut Stress Report",
    "",
    `Generated: ${formatTimestamp(details.completedAt || new Date())}`,
    "",
    `Target: ${details.target || "unknown"}`,
    `Duration: ${details.duration ?? "unknown"}s`,
    `Arrival rate: ${details.arrivalRate ?? "unknown"} req/s`,
    `Max virtual users: ${details.maxVusers ?? "unknown"}`,
    "",
    "## Summary",
    "",
    "| Metric | Value |",
    "|---|---:|",
    `| Endpoints found | ${details.endpointsFound || 0} |`,
    `| Endpoints tested | ${tested.length} |`,
    `| Endpoints skipped | ${skipped.length} |`,
    `| Warnings | ${details.warnings || 0} |`,
    `| Failed | ${details.failed || 0} |`,
    "",
    "## Tested Endpoints",
    "",
    renderTestedEndpoints(tested),
    "",
    "## Skipped Endpoints",
    "",
    renderSkippedEndpoints(skipped),
    renderArtilleryError(details.artilleryError),
    renderRecommendations(result),
  ].filter((line) => line !== null && line !== undefined).join("\n")}\n`);
}

function renderTestedEndpoints(endpoints) {
  if (!endpoints.length) return "None.";

  return [
    "| Method | Path | Status | p95 | p99 | Errors | Error Rate |",
    "|---|---|---|---:|---:|---:|---:|",
    ...endpoints.map((endpoint) => (
      `| ${escapeTable(endpoint.method)} | ${escapeTable(endpoint.path)} | ${escapeTable(endpoint.status)} | ${formatMs(endpoint.p95)} | ${formatMs(endpoint.p99)} | ${endpoint.errors || 0} | ${formatPercent(endpoint.errorRate)} |`
    ))
  ].join("\n");
}

function renderSkippedEndpoints(endpoints) {
  if (!endpoints.length) return "None.";

  return [
    "| Method | Path | Reason |",
    "|---|---|---|",
    ...endpoints.map((endpoint) => (
      `| ${escapeTable(endpoint.method)} | ${escapeTable(endpoint.path)} | ${escapeTable(endpoint.reason)} |`
    ))
  ].join("\n");
}

function renderRecommendations(result) {
  const details = result.details || {};
  const recommendations = [];

  if ((details.warnings || 0) > 0) {
    recommendations.push("Review slow endpoints.");
    recommendations.push("Add caching or pagination where needed.");
  }
  if ((details.failed || 0) > 0 || result.status === "fail") {
    recommendations.push("Investigate failed requests before increasing load.");
  }
  if ((details.skippedEndpoints || []).some((endpoint) => endpoint.reason === "unsafe method")) {
    recommendations.push("Test mutating endpoints manually in a safe staging environment.");
  }
  recommendations.push("Add rate limits before public deployment.");

  return [
    "",
    "## Recommendations",
    "",
    ...unique(recommendations).map((recommendation) => `- ${recommendation}`),
    ""
  ].join("\n");
}

function renderArtilleryError(error) {
  if (!error) return "";

  return [
    "",
    "## Artillery Error",
    "",
    error,
    ""
  ].join("\n");
}

function formatTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  const pad = (number) => String(number).padStart(2, "0");
  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    " ",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
    ":",
    pad(date.getSeconds())
  ].join("");
}

function formatMs(value) {
  return value === null || value === undefined ? "n/a" : `${Math.round(value)} ms`;
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(Number.isInteger(value) ? 0 : 2).replace(/\.00$/, "")}%`;
}

function escapeTable(value) {
  return stripAnsi(String(value ?? "unknown")).replace(/\|/g, "\\|");
}

function stripAnsi(value) {
  return String(value).replace(ANSI_PATTERN, "");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
