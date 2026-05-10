import boxen from "boxen";
import Table from "cli-table3";
import { SEVERITIES } from "../core/config.js";
import { getChalk, normalizeTheme } from "../cli/terminal.js";

const EDGY_TITLES = {
  "env.env-file-tracked": "It works, but your .env is tracked.",
  "env.possible-secret-in-code": "It works, but your repo may be leaking secrets.",
  "env.frontend-secret-exposure": "It works, but your frontend env variable smells like a backend secret.",
  "git.gitignore-missing": "It works, but your repo forgot what not to commit.",
  "git.gitignore-incomplete": "It works, but your .gitignore has holes.",
  "git.ignored-files-tracked": "It works, but Git is already tracking files you meant to ignore.",
  "dependencies.lockfile-missing": "It works on your machine, but your dependency tree is not locked.",
  "dependencies.multiple-lockfiles": "It works, but your package managers are fighting.",
  "ci.no-ci-config": "It works, but nobody checks it before it ships.",
  "ci.npm-install-instead-of-npm-ci": "It works, but your CI is installing instead of reproducing.",
  "ci.no-test-step": "It works, but your CI is basically decorative.",
  "node.express-json-limit-missing": "It works, but your API accepts oversized bodies.",
  "node.rate-limit-missing": "It works, but your endpoints have no brakes.",
  "node.helmet-missing": "It works, but your HTTP headers are underdressed.",
  "node.cors-wildcard": "It works, but CORS is holding the door open.",
  "web.dangerous-inner-html": "It works, but your frontend is injecting HTML with sharp edges.",
  "api.missing-auth-on-routes": "It works, but this API route appears to trust strangers.",
  "api.idor-risk": "It works, but this ID lookup may belong to someone else.",
  "database.raw-sql-interpolation": "It works, but your SQL query is one template string away from pain.",
  "database.no-migrations": "It works, but your database schema has no paper trail.",
  "electron.node-integration-enabled": "It works, but Electron is holding the Node.js door open.",
  "electron.context-isolation-disabled": "It works, but your renderer and backend are sharing a room.",
  "tauri.dangerous-allowlist-or-capabilities": "It works, but your Tauri permissions look too generous."
};

const SEVERITY_META = {
  critical: { symbol: "✖", label: "CRITICAL" },
  high: { symbol: "▲", label: "HIGH" },
  medium: { symbol: "◆", label: "MEDIUM" },
  low: { symbol: "•", label: "LOW" },
  info: { symbol: "i", label: "INFO" }
};

export function getConsoleFindingTitle(finding) {
  if (EDGY_TITLES[finding.checkId]) return EDGY_TITLES[finding.checkId];
  if (finding.heuristic) return `It works, but this pattern may be risky: ${finding.title || finding.checkId}.`;
  return `It works, but ${lowercaseFirst(finding.title || finding.message || finding.checkId)}.`;
}

export function formatSeverity(severity, options = {}) {
  const colors = getChalk(options);
  const meta = SEVERITY_META[severity] || SEVERITY_META.info;
  const raw = `${meta.symbol}  ${meta.label}`;

  if (normalizeTheme(options.theme) === "mono") {
    return {
      ...meta,
      text: colors.bold(raw),
      compactText: colors.bold(`${meta.symbol} ${meta.label}`)
    };
  }

  const stylers = {
    critical: (value) => colors.bgRed.white.bold(value),
    high: (value) => colors.red.bold(value),
    medium: (value) => colors.yellow.bold(value),
    low: (value) => colors.blue(value),
    info: (value) => colors.gray(value)
  };

  const style = stylers[severity] || stylers.info;
  return {
    ...meta,
    text: style(raw),
    compactText: style(`${meta.symbol} ${meta.label}`)
  };
}

export function getShipStatus(counts) {
  if (counts.critical > 0) {
    return {
      status: "DO NOT SHIP",
      tone: "Fix the red stuff before production.",
      severity: "critical"
    };
  }
  if (counts.high > 0) {
    return {
      status: "FIX BEFORE SHIP",
      tone: "Close the obvious holes before shipping.",
      severity: "high"
    };
  }
  if (counts.medium > 0) {
    return {
      status: "SHIP WITH CAUTION",
      tone: "You can ship, but future-you will ask questions.",
      severity: "medium"
    };
  }
  return {
    status: "SHIP IT, BUT STAY PARANOID",
    tone: "Suspiciously clean. Ship it, but stay paranoid.",
    severity: "info"
  };
}

export function renderSummaryBox(counts, options = {}) {
  const colors = getChalk(options);
  const ship = getShipStatus(counts);
  const severity = formatSeverity(ship.severity, options);
  const content = [
    colors.bold("It works, but..."),
    "",
    `Ship status: ${severity.label === "INFO" ? colors.bold(ship.status) : severityColor(ship.status, ship.severity, colors)}`,
    `Critical: ${counts.critical}`,
    `High:     ${counts.high}`,
    `Medium:   ${counts.medium}`,
    "",
    ship.tone
  ].join("\n");

  return boxen(content, {
    padding: 1,
    margin: 1,
    borderStyle: "round",
    borderColor: ship.severity === "critical" || ship.severity === "high" ? "red" : ship.severity === "medium" ? "yellow" : "green"
  });
}

export function renderSummaryTable(counts, options = {}) {
  const table = new Table({
    head: ["Severity", "Count"],
    style: {
      head: [],
      border: []
    }
  });

  for (const severity of SEVERITIES) {
    const formatted = formatSeverity(severity, options);
    table.push([formatted.compactText, counts[severity]]);
  }

  return table.toString();
}

function severityColor(value, severity, colors) {
  if (severity === "critical") return colors.bgRed.white.bold(value);
  if (severity === "high") return colors.red.bold(value);
  if (severity === "medium") return colors.yellow.bold(value);
  return colors.bold(value);
}

function lowercaseFirst(value) {
  if (!value) return value;
  const normalized = String(value).replace(/\.$/, "");
  return `${normalized.charAt(0).toLowerCase()}${normalized.slice(1)}`;
}
