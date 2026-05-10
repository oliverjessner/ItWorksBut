import { hasText } from "../helpers.js";

export default {
  id: "electron.node-integration-enabled",
  title: "Electron nodeIntegration should be disabled",
  category: "electron",
  severity: "high",
  tags: ["electron", "desktop", "xss"],
  run: async (context) => {
    const electronDetected = context.hasDependency("electron") || (await hasText(context, /\bfrom\s+["']electron["']|\brequire\(["']electron["']\)/g));
    if (!electronDetected) return [];

    const matches = await context.grep(/nodeIntegration\s*:\s*true/g, {
      include: ["*.js", "*.ts", "*.mjs", "*.cjs"],
      maxMatches: 100
    });

    return matches.map((match) => ({
      message: "Electron BrowserWindow webPreferences enables nodeIntegration.",
      file: match.file,
      line: match.line,
      column: match.column,
      recommendation: "Set nodeIntegration: false, keep contextIsolation: true, and expose only minimal APIs through a strict preload script."
    }));
  }
};
