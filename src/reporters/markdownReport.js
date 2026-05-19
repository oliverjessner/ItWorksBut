import fs from "node:fs/promises";
import path from "node:path";
import { countByStatus } from "../core/checkResults.js";

const ANSI_PATTERN = /\u001B\[[0-?]*[ -/]*[@-~]/g;

export async function writeMarkdownReport(result, options = {}) {
  const filePath = options.filePath || path.join(options.directoryPath || process.cwd(), "report.md");
  let overwritten = false;

  try {
    await fs.access(filePath);
    overwritten = true;
  } catch {
    overwritten = false;
  }

  await fs.writeFile(filePath, reportMarkdown(result), "utf8");
  return { filePath, overwritten };
}

export function reportMarkdown(result) {
  const checks = result.checks || checksFromFindings(result.findings || []);
  const counts = countByStatus(checks);
  const projectName = result.meta?.packageName || path.basename(result.meta?.rootPath || "") || "unknown";
  const generatedAt = formatTimestamp(result.meta?.completedAt || new Date());

  return stripAnsi(`${[
    "# ItWorksBut Scan Report",
    "",
    `Generated: ${generatedAt}`,
    "",
    `Project: ${projectName}`,
    `Path: ${result.meta?.rootPath || "unknown"}`,
    "",
    "## Summary",
    "",
    "| Status | Count |",
    "|---|---:|",
    `| Pass | ${counts.pass} |`,
    `| Warn | ${counts.warn} |`,
    `| Fail | ${counts.fail} |`,
    `| Skip | ${counts.skip} |`,
    "",
    "## Checks",
    "",
    renderChecks(checks),
    renderScannerWarnings(result.warnings || []),
    renderRecommendations(checks, result.findings || []),
  ].filter((line) => line !== null && line !== undefined).join("\n")}\n`);
}

function renderChecks(checks) {
  if (!checks.length) return "No checks were recorded.\n";

  return checks.map(renderCheck).join("\n");
}

function renderCheck(check) {
  return [
    `### ${check.title || check.id}`,
    "",
    `Status: ${check.status || "unknown"}`,
    "",
    "Summary:",
    check.summary || "No summary available.",
    "",
    "Details:",
    renderDetails(check),
    ""
  ].join("\n");
}

function renderDetails(check) {
  const details = Array.isArray(check.details) ? check.details : [];
  if (!details.length) return "None.";

  if (isOutdatedPackageCheck(check)) {
    return renderOutdatedPackageTable(details);
  }

  return details.map(renderDetailBullet).join("\n");
}

function renderOutdatedPackageTable(details) {
  const packageDetails = details.filter((detail) => detail?.name);
  if (!packageDetails.length) return details.map(renderDetailBullet).join("\n");

  return [
    "| Package | Current | Wanted | Latest | Type |",
    "|---|---:|---:|---:|---|",
    ...packageDetails.map((detail) => (
      `| ${escapeTable(detail.name)} | ${escapeTable(detail.current)} | ${escapeTable(detail.wanted)} | ${escapeTable(detail.latest)} | ${escapeTable(detail.type)} |`
    ))
  ].join("\n");
}

function renderDetailBullet(detail) {
  if (typeof detail === "string") return `- ${detail}`;
  if (!detail || typeof detail !== "object") return `- ${String(detail)}`;

  if (detail.message) return `- ${detail.message}`;
  return `- ${Object.entries(detail).map(([key, value]) => `${key}: ${String(value)}`).join(", ")}`;
}

function renderScannerWarnings(warnings) {
  if (!warnings.length) return "";

  return [
    "## Scanner Warnings",
    "",
    ...warnings.map((warning) => `- ${warning.checkId}: ${warning.message}`),
    ""
  ].join("\n");
}

function renderRecommendations(checks, findings) {
  const needsReview = checks.some((check) => check.status === "warn" || check.status === "fail");
  if (!needsReview && findings.length === 0) return "";

  const recommendations = [];
  if (checks.some((check) => isOutdatedPackageCheck(check) && (check.status === "warn" || check.status === "fail"))) {
    recommendations.push("Update outdated packages carefully.");
    recommendations.push("Review major-version upgrades manually.");
    recommendations.push("Run tests after dependency updates.");
  }

  for (const finding of findings) {
    if (finding.recommendation) recommendations.push(finding.recommendation);
  }

  if (checks.some((check) => check.status === "fail")) {
    recommendations.push("Review failed checks and scanner warnings before shipping.");
  }
  if (recommendations.length === 0) {
    recommendations.push("Review warning and failure details before shipping.");
  }

  return [
    "## Recommendations",
    "",
    ...unique(recommendations).map((recommendation) => `- ${recommendation}`),
    ""
  ].join("\n");
}

function checksFromFindings(findings) {
  const byCheck = new Map();
  for (const finding of findings) {
    const existing = byCheck.get(finding.checkId) || {
      id: finding.checkId,
      title: finding.title,
      category: finding.category,
      status: finding.severity === "critical" || finding.severity === "high" ? "fail" : "warn",
      summary: "Finding reported.",
      details: []
    };
    existing.details.push({
      message: finding.message,
      file: finding.file,
      line: finding.line,
      severity: finding.severity
    });
    byCheck.set(finding.checkId, existing);
  }
  return [...byCheck.values()];
}

function isOutdatedPackageCheck(check) {
  return check.id === "dependencies.outdated-packages" || check.title === "Outdated packages";
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

function escapeTable(value) {
  return stripAnsi(String(value ?? "unknown")).replace(/\|/g, "\\|");
}

function stripAnsi(value) {
  return String(value).replace(ANSI_PATTERN, "");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
