import { countBySeverity, getExitCode } from "../core/findings.js";

export function reportJson(result) {
  return {
    tool: result.meta.tool,
    version: result.meta.version,
    meta: result.meta,
    summary: {
      total: result.findings.length,
      bySeverity: countBySeverity(result.findings),
      failOn: result.config.failOn,
      exitCode: getExitCode(result.findings, result.config.failOn)
    },
    findings: result.findings,
    warnings: result.warnings
  };
}
