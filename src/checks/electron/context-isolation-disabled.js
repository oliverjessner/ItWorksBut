import { hasText, lineFromOffset } from "../helpers.js";

const WEB_PREFERENCES_RE = /webPreferences\s*:\s*{([\s\S]{0,800}?)}\s*[,}]/g;

export default {
  id: "electron.context-isolation-disabled",
  title: "Electron contextIsolation should be explicitly enabled",
  category: "electron",
  severity: "high",
  tags: ["electron", "desktop", "xss"],
  run: async (context) => {
    const electronDetected = context.hasDependency("electron") || (await hasText(context, /\bfrom\s+["']electron["']|\brequire\(["']electron["']\)/g));
    if (!electronDetected) return [];

    const findings = [];
    const disabled = await context.grep(/contextIsolation\s*:\s*false/g, {
      include: ["*.js", "*.ts", "*.mjs", "*.cjs"],
      maxMatches: 100
    });
    for (const match of disabled) {
      findings.push({
        message: "Electron BrowserWindow webPreferences disables contextIsolation.",
        file: match.file,
        line: match.line,
        column: match.column,
        recommendation: "Set contextIsolation: true and expose narrow, validated APIs from preload."
      });
    }

    for (const file of context.textFiles) {
      if (!/\.[cm]?[jt]s$/.test(file)) continue;
      const content = await context.readFileSafe(file);
      if (!content || !/new\s+BrowserWindow\s*\(/.test(content)) continue;

      WEB_PREFERENCES_RE.lastIndex = 0;
      let match;
      while ((match = WEB_PREFERENCES_RE.exec(content)) !== null) {
        if (/contextIsolation\s*:/.test(match[1])) continue;
        findings.push({
          message: "Electron BrowserWindow webPreferences appears to omit contextIsolation.",
          file,
          line: lineFromOffset(content, match.index),
          recommendation: "Set contextIsolation: true explicitly and review preload exposure.",
          heuristic: true
        });
      }
    }

    return findings.slice(0, 100);
  }
};
