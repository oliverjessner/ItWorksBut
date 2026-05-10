import { SEVERITIES } from "./config.js";

export const severityRank = new Map(SEVERITIES.map((severity, index) => [severity, SEVERITIES.length - index]));

export function normalizeFinding(check, finding) {
  return {
    checkId: finding.checkId || check.id,
    title: finding.title || check.title,
    category: finding.category || check.category,
    severity: normalizeFindingSeverity(finding.severity || check.severity),
    message: finding.message || check.title,
    file: finding.file,
    line: finding.line,
    column: finding.column,
    recommendation: finding.recommendation,
    tags: finding.tags || check.tags || [],
    heuristic: Boolean(finding.heuristic),
    metadata: finding.metadata || undefined
  };
}

export function normalizeFindingSeverity(value) {
  const normalized = String(value || "info").toLowerCase();
  return SEVERITIES.includes(normalized) ? normalized : "info";
}

export function isAtOrAbove(severity, threshold) {
  return severityRank.get(severity) >= severityRank.get(threshold);
}

export function getExitCode(findings, failOn) {
  return findings.some((finding) => isAtOrAbove(finding.severity, failOn)) ? 1 : 0;
}

export function countBySeverity(findings) {
  return Object.fromEntries(
    SEVERITIES.map((severity) => [severity, findings.filter((finding) => finding.severity === severity).length])
  );
}
