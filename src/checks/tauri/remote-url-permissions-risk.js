import { lineFromOffset, parseJsonWithComments } from "../helpers.js";

const CONFIG_FILES = ["src-tauri/tauri.conf.json", "src-tauri/tauri.conf.json5", "src-tauri/Tauri.toml"];
const WEAK_CSP_RE =
  /"csp"\s*:\s*(?:null|false|""|"[^"]*(?:\*|unsafe-inline|unsafe-eval)[^"]*")|csp\s*=\s*(?:false|""|"[^"]*(?:\*|unsafe-inline|unsafe-eval)[^"]*")/gi;
const DANGEROUS_ASSET_CSP_RE = /"dangerousDisableAssetCspModification"\s*:\s*true|dangerousDisableAssetCspModification\s*=\s*true/gi;
const BROAD_ALLOWLIST_RE = /"allowlist"\s*:\s*{[\s\S]{0,400}?"all"\s*:\s*true|"all"\s*:\s*true[\s\S]{0,120}?"(?:shell|fs|http)"/gi;
const BROAD_PERMISSION_RE =
  /"permissions"\s*:\s*\[[\s\S]{0,240}?["'`]\*["'`]|["'`](?:shell|fs|http):(?:\*|allow-\*|allow-all|allow-execute|allow-fetch)["'`]|["'`]fs:allow-[^"'`]*["'`][\s\S]{0,160}(?:\*\*|["'`]\*["'`]|\/)|["'`]http:allow-fetch["'`][\s\S]{0,220}(?:["'`]\*["'`]|https?:\/\/\*)/gi;
const REMOTE_URL_RE = /"(?:devUrl|frontendDist|url)"\s*:\s*"https?:\/\/(?!localhost\b|127\.0\.0\.1\b|0\.0\.0\.0\b)[^"]+"|(?:devUrl|frontendDist|url)\s*=\s*"https?:\/\/(?!localhost\b|127\.0\.0\.1\b|0\.0\.0\.0\b)[^"]+"/gi;

export default {
  id: "tauri.remote-url-permissions-risk",
  title: "Tauri remote URLs and permissions should be least privilege",
  category: "tauri",
  severity: "high",
  tags: ["tauri", "desktop", "permissions", "heuristic"],
  run: async (context) => {
    if (!isTauriProject(context)) return [];
    const findings = [];

    for (const file of collectTauriFiles(context)) {
      const content = await context.readFileSafe(file);
      if (!content) continue;

      if (file.endsWith(".json") || file.endsWith(".json5")) {
        inspectParsedJson(content, file, findings);
      }

      inspectRegexPattern(content, file, findings, WEAK_CSP_RE, "weak-csp");
      inspectRegexPattern(content, file, findings, DANGEROUS_ASSET_CSP_RE, "dangerous-asset-csp");
      inspectRegexPattern(content, file, findings, BROAD_ALLOWLIST_RE, "broad-allowlist");
      inspectRegexPattern(content, file, findings, BROAD_PERMISSION_RE, "broad-permission");
      inspectRegexPattern(content, file, findings, REMOTE_URL_RE, "remote-url");
    }

    return dedupe(findings).slice(0, 100);
  }
};

function isTauriProject(context) {
  return (
    context.allFiles.some((file) => file.startsWith("src-tauri/")) ||
    context.hasDependency("@tauri-apps/api") ||
    context.hasDevDependency("@tauri-apps/cli") ||
    context.hasDependency("@tauri-apps/cli")
  );
}

function collectTauriFiles(context) {
  return context.textFiles.filter((file) => {
    return (
      CONFIG_FILES.includes(file) ||
      /^src-tauri\/capabilities\/[^/]+\.json$/i.test(file) ||
      /^src-tauri\/permissions\/[^/]+\.json$/i.test(file)
    );
  });
}

function inspectParsedJson(content, file, findings) {
  let parsed;
  try {
    parsed = parseJsonWithComments(content);
  } catch {
    return;
  }

  const security = parsed?.app?.security || parsed?.tauri?.security || {};
  if (security.csp === null || security.csp === false || security.csp === "") {
    findings.push(finding(file, lineOfKey(content, "csp"), "weak-csp"));
  }
  if (security.dangerousDisableAssetCspModification === true) {
    findings.push(finding(file, lineOfKey(content, "dangerousDisableAssetCspModification"), "dangerous-asset-csp"));
  }

  const permissions = JSON.stringify(parsed?.permissions || parsed?.app?.permissions || parsed?.tauri?.allowlist || []);
  if (/"\*"|"all":true|shell:allow-execute|fs:allow-|http:allow-fetch/.test(permissions)) {
    findings.push(finding(file, undefined, "broad-permission"));
  }
}

function inspectRegexPattern(content, file, findings, regex, pattern) {
  regex.lastIndex = 0;
  let match;
  while ((match = regex.exec(content)) !== null) {
    findings.push(finding(file, lineFromOffset(content, match.index), pattern));
  }
}

function finding(file, line, pattern) {
  return {
    message: "Tauri configuration appears to allow broad permissions, remote URLs or weak CSP settings.",
    file,
    line,
    recommendation:
      "Use least-privilege capabilities, restrict shell/fs/http permissions, avoid broad wildcards, and configure a strict CSP.",
    heuristic: true,
    metadata: { pattern }
  };
}

function lineOfKey(content, key) {
  const index = content.indexOf(`"${key}"`);
  return index >= 0 ? lineFromOffset(content, index) : undefined;
}

function dedupe(findings) {
  const seen = new Set();
  return findings.filter((item) => {
    const key = `${item.file}:${item.line || 0}:${item.metadata?.pattern || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
