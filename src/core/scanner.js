import checks from "../checks/index.js";
import { createContext } from "./context.js";
import { normalizeCheckResult } from "./checkResults.js";
import { normalizeFinding, severityRank } from "./findings.js";
import { packageInfo } from "./packageInfo.js";

export async function scanProject(options = {}) {
  const startedAt = new Date();
  const context = await createContext(options);
  const includedCategories = normalizeFilter(options.categories);
  const findings = [];
  const checkResults = [];
  const warnings = [];

  for (const check of checks) {
    if (includedCategories && !includedCategories.has(check.category)) continue;

    if (context.config.checks[check.id] === false) {
      checkResults.push(normalizeCheckResult(check, {
        status: "skip",
        summary: "Disabled by configuration."
      }));
      continue;
    }

    try {
      const rawResult = await check.run(context);
      const checkFindings = Array.isArray(rawResult) ? rawResult : rawResult?.findings;
      const explicitCheckResult = Array.isArray(rawResult) ? null : rawResult?.result || rawResult?.checkResult;

      if (!Array.isArray(checkFindings)) {
        warnings.push({
          checkId: check.id,
          message: "Check returned a non-array result and was ignored."
        });
        checkResults.push(normalizeCheckResult(check, {
          status: "fail",
          summary: "Check returned an invalid result.",
          details: [{ message: "Check returned a non-array result and was ignored." }]
        }));
        continue;
      }

      const normalizedFindings = [];
      for (const finding of checkFindings) {
        const normalizedFinding = normalizeFinding(check, finding);
        normalizedFindings.push(normalizedFinding);
        findings.push(normalizedFinding);
      }
      checkResults.push(normalizeCheckResult(check, explicitCheckResult || {}, normalizedFindings));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push({
        checkId: check.id,
        message
      });
      checkResults.push(normalizeCheckResult(check, {
        status: "fail",
        summary: message,
        details: [{ message }]
      }));
    }
  }

  findings.sort((a, b) => {
    const bySeverity = severityRank.get(b.severity) - severityRank.get(a.severity);
    if (bySeverity !== 0) return bySeverity;
    return `${a.checkId}:${a.file || ""}:${a.line || 0}`.localeCompare(`${b.checkId}:${b.file || ""}:${b.line || 0}`);
  });

  return {
    findings,
    checks: checkResults,
    warnings,
    config: context.config,
    meta: {
      tool: "ItWorksBut",
      version: packageInfo.version,
      rootPath: context.rootPath,
      packageName: context.packageJson?.name,
      categories: includedCategories ? [...includedCategories] : undefined,
      packageManager: context.packageManager,
      gitAvailable: context.gitAvailable,
      filesScanned: context.allFiles.length,
      textFilesScanned: context.textFiles.length,
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString()
    }
  };
}

function normalizeFilter(values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  return new Set(values.map((value) => String(value).trim()).filter(Boolean));
}
