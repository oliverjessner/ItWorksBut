import { parseJsonWithComments } from "../helpers.js";

export default {
  id: "tauri.dangerous-allowlist-or-capabilities",
  title: "Tauri allowlists and capabilities should be narrowly scoped",
  category: "tauri",
  severity: "high",
  tags: ["tauri", "desktop", "capabilities"],
  run: async (context) => {
    const findings = [];
    await inspectTauriConfig(context, findings);
    await inspectCapabilities(context, findings);
    return findings;
  }
};

async function inspectTauriConfig(context, findings) {
  const configFiles = ["src-tauri/tauri.conf.json", "src-tauri/tauri.conf.json5"].filter((file) => context.allFiles.includes(file));
  for (const file of configFiles) {
    const content = await context.readFileSafe(file);
    if (!content) continue;

    let config;
    try {
      config = parseJsonWithComments(content);
    } catch {
      findings.push({
        severity: "medium",
        message: "Tauri config could not be parsed as JSON. Dangerous allowlist checks may be incomplete.",
        file,
        recommendation: "Keep Tauri config valid and review permissions manually."
      });
      continue;
    }

    const allowlist = config.tauri?.allowlist || config.allowlist || {};
    if (allowlist.all === true) {
      findings.push(broadFinding(file, "Tauri allowlist all=true grants broad API access.", "Set allowlist.all to false and enable only the APIs required by the app."));
    }
    if (allowlist.shell?.all === true || allowlist.shell?.open === true) {
      findings.push(broadFinding(file, "Tauri shell permissions appear broadly enabled.", "Restrict shell/open permissions to explicit commands and scopes."));
    }
    if (allowlist.fs?.all === true || allowlist.fs?.scope === true || includesBroadScope(allowlist.fs?.scope)) {
      findings.push(broadFinding(file, "Tauri filesystem permissions appear broadly scoped.", "Restrict filesystem scopes to app-specific directories and exact file patterns."));
    }

    const security = config.tauri?.security || config.app?.security || {};
    if (!security.csp || /\b(unsafe-inline|unsafe-eval|\*)\b/i.test(String(security.csp))) {
      findings.push({
        severity: "medium",
        message: "Tauri CSP is missing or appears overly permissive.",
        file,
        recommendation: "Define a strict CSP without unsafe-inline, unsafe-eval, or wildcard sources unless there is a documented exception.",
        heuristic: true
      });
    }

    const windows = config.tauri?.windows || config.app?.windows || [];
    for (const windowConfig of Array.isArray(windows) ? windows : []) {
      const url = String(windowConfig.url || "");
      if (/^https?:\/\//i.test(url)) {
        findings.push({
          severity: "medium",
          message: "Tauri window loads a remote URL. This increases the impact of remote content compromise.",
          file,
          recommendation: "Prefer bundled local assets. If remote URLs are required, restrict navigation, enforce strict CSP, and audit permissions carefully.",
          heuristic: true,
          metadata: { remoteUrl: url.replace(/[?#].*$/, "") }
        });
      }
    }
  }
}

async function inspectCapabilities(context, findings) {
  const capabilityFiles = context.findFiles("src-tauri/capabilities/*.json");
  for (const file of capabilityFiles) {
    const content = await context.readFileSafe(file);
    if (!content) continue;

    let capability;
    try {
      capability = parseJsonWithComments(content);
    } catch {
      findings.push({
        severity: "medium",
        message: "Tauri capability file could not be parsed as JSON.",
        file,
        recommendation: "Keep capability files valid and review permissions manually."
      });
      continue;
    }

    const permissions = flattenPermissions(capability.permissions || []);
    for (const permission of permissions) {
      if (isBroadPermission(permission)) {
        findings.push(broadFinding(file, `Tauri capability includes broad permission ${permission}.`, "Replace broad permissions with the narrowest command and path scopes required."));
      }
    }

    if (includesBroadScope(capability.scope) || includesBroadScope(capability.fs?.scope)) {
      findings.push(broadFinding(file, "Tauri capability appears to include a broad filesystem scope.", "Limit scopes to app-owned directories and exact files."));
    }
  }
}

function broadFinding(file, message, recommendation) {
  return {
    severity: "high",
    message,
    file,
    recommendation,
    heuristic: true
  };
}

function flattenPermissions(permissions) {
  const result = [];
  for (const permission of permissions) {
    if (typeof permission === "string") result.push(permission);
    else if (permission && typeof permission.identifier === "string") result.push(permission.identifier);
  }
  return result;
}

function isBroadPermission(permission) {
  return (
    permission === "*" ||
    permission.endsWith(":*") ||
    permission.includes("allow-all") ||
    permission.includes("shell:allow-open") ||
    permission.includes("fs:allow")
  );
}

function includesBroadScope(scope) {
  const values = Array.isArray(scope) ? scope : scope ? [scope] : [];
  return values.some((value) => {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    return /\*\*|^\*$|^\/$|\$HOME|\$APPDATA|\$RESOURCE|\.\./i.test(text);
  });
}
