import { countBySeverity, getExitCode } from "../core/findings.js";
import { countByStatus } from "../core/checkResults.js";

export function reportJson(result) {
  return {
    tool: result.meta.tool,
    version: result.meta.version,
    meta: result.meta,
    summary: {
      total: result.findings.length,
      bySeverity: countBySeverity(result.findings),
      byStatus: countByStatus(result.checks || []),
      failOn: result.config.failOn,
      exitCode: getExitCode(result.findings, result.config.failOn)
    },
    checks: result.checks || [],
    findings: result.findings,
    warnings: result.warnings
  };
}
