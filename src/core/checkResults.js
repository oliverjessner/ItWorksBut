export const CHECK_STATUSES = ["pass", "warn", "fail", "skip"];

export function normalizeCheckResult(check, value = {}, findings = []) {
  const status = normalizeStatus(value.status || deriveStatusFromFindings(findings));
  const details = Array.isArray(value.details) ? value.details : detailsFromFindings(findings);

  return {
    id: value.id || check.id,
    title: value.title || check.title,
    category: value.category || check.category,
    status,
    summary: value.summary || defaultSummary(status, findings),
    details,
    metadata: value.metadata || undefined
  };
}

export function deriveStatusFromFindings(findings = []) {
  if (!findings.length) return "pass";
  if (findings.some((finding) => finding.severity === "critical" || finding.severity === "high")) return "fail";
  return "warn";
}

export function countByStatus(checks = []) {
  return Object.fromEntries(
    CHECK_STATUSES.map((status) => [status, checks.filter((check) => check.status === status).length])
  );
}

function normalizeStatus(value) {
  const normalized = String(value || "pass").toLowerCase();
  return CHECK_STATUSES.includes(normalized) ? normalized : "fail";
}

function defaultSummary(status, findings) {
  if (status === "pass") return "No issues found.";
  if (status === "skip") return "Skipped.";
  if (!findings.length) return status === "fail" ? "Check failed." : "Check needs review.";

  const count = findings.length;
  const noun = count === 1 ? "finding" : "findings";
  return `${count} ${noun} reported.`;
}

function detailsFromFindings(findings) {
  return findings.map((finding) => ({
    message: finding.message,
    file: finding.file,
    line: finding.line,
    severity: finding.severity,
    recommendation: finding.recommendation
  }));
}
