import { isCodeLikeFile, isEnvExampleFile, isLockfile, lineFromOffset } from "../helpers.js";

const DEBUG_FLAG_RE =
  /\b(?:debug|verbose|dev|exposeErrors|stackTrace|showStack)\s*:\s*true\b|\bapp\.set\s*\(\s*["'`]env["'`]\s*,\s*["'`]development["'`]\s*\)|\bNODE_ENV\s*=\s*["'`]development["'`]|\bdevtool\s*:\s*["'`](?:eval|eval-source-map|inline-source-map|cheap-module-source-map)["'`]/gi;

export default {
  id: "config.debug-production",
  title: "Production configuration should not enable debug behavior",
  category: "config",
  severity: "medium",
  tags: ["config", "debug", "heuristic"],
  run: async (context) => {
    const findings = [];

    for (const file of context.textFiles) {
      if (isLockfile(file) || isEnvExampleFile(file) || !isCodeLikeFile(file)) continue;
      if (!isRiskyConfigFile(file)) continue;

      const content = await context.readFileSafe(file);
      if (!content) continue;

      DEBUG_FLAG_RE.lastIndex = 0;
      let match;
      while ((match = DEBUG_FLAG_RE.exec(content)) !== null) {
        const productionLike = isProductionLikeFile(file);
        findings.push({
          severity: productionLike ? "high" : "medium",
          message: "Debug or development flags appear to be enabled in production-like configuration.",
          file,
          line: lineFromOffset(content, match.index),
          recommendation:
            "Disable verbose errors and debug flags in production. Avoid exposing stack traces, internal paths or development tooling.",
          heuristic: true,
          metadata: {
            productionLike,
            pattern: classifyDebugPattern(match[0])
          }
        });
      }
    }

    return findings.slice(0, 100);
  }
};

function isRiskyConfigFile(file) {
  return (
    isProductionLikeFile(file) ||
    /^next\.config\.[cm]?[jt]s$/.test(file) ||
    /^vite\.config\.[cm]?[jt]s$/.test(file) ||
    /^webpack\.config\.[cm]?[jt]s$/.test(file) ||
    /(^|\/)(server|app)\.[cm]?[jt]s$/.test(file)
  );
}

function isProductionLikeFile(file) {
  return /^config\/production\./.test(file) || /\.production\./.test(file);
}

function classifyDebugPattern(value) {
  if (/devtool/i.test(value)) return "unsafe-devtool";
  if (/NODE_ENV|app\.set/i.test(value)) return "development-environment";
  if (/stack|showStack|exposeErrors/i.test(value)) return "verbose-errors";
  return "debug-flag";
}
