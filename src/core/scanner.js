import checks from "../checks/index.js";
import { createContext } from "./context.js";
import { normalizeFinding, severityRank } from "./findings.js";

export async function scanProject(options = {}) {
  const startedAt = new Date();
  const context = await createContext(options);
  const findings = [];
  const warnings = [];

  for (const check of checks) {
    if (context.config.checks[check.id] === false) continue;

    try {
      const checkFindings = await check.run(context);
      if (!Array.isArray(checkFindings)) {
        warnings.push({
          checkId: check.id,
          message: "Check returned a non-array result and was ignored."
        });
        continue;
      }
      for (const finding of checkFindings) {
        findings.push(normalizeFinding(check, finding));
      }
    } catch (error) {
      warnings.push({
        checkId: check.id,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  findings.sort((a, b) => {
    const bySeverity = severityRank.get(b.severity) - severityRank.get(a.severity);
    if (bySeverity !== 0) return bySeverity;
    return `${a.checkId}:${a.file || ""}:${a.line || 0}`.localeCompare(`${b.checkId}:${b.file || ""}:${b.line || 0}`);
  });

  return {
    findings,
    warnings,
    config: context.config,
    meta: {
      tool: "ItWorksBut",
      version: "0.1.0",
      rootPath: context.rootPath,
      packageManager: context.packageManager,
      gitAvailable: context.gitAvailable,
      filesScanned: context.allFiles.length,
      textFilesScanned: context.textFiles.length,
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString()
    }
  };
}
