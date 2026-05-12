import { hasText, lineFromOffset, readNearby } from "../helpers.js";

const LOAD_REMOTE_RE =
  /\b(?:mainWindow|win|window|BrowserWindow|\w+)\.loadURL\s*\(\s*(?:["'`]https?:\/\/[^"'`]+["'`]|remoteUrl|process\.env\.\w+|config\.url)\s*\)/g;
const RISKY_WEB_PREFERENCES_RE =
  /\b(?:nodeIntegration\s*:\s*true|contextIsolation\s*:\s*false|webSecurity\s*:\s*false|allowRunningInsecureContent\s*:\s*true|experimentalFeatures\s*:\s*true|enableRemoteModule\s*:\s*true|sandbox\s*:\s*false)\b/i;

export default {
  id: "electron.remote-content-with-node",
  title: "Electron remote content should not run with privileged renderer settings",
  category: "electron",
  severity: "critical",
  tags: ["electron", "desktop", "xss", "heuristic"],
  run: async (context) => {
    if (!(await isElectronProject(context))) return [];
    const findings = [];

    for (const file of context.textFiles) {
      if (!/\.[cm]?[jt]s$/.test(file)) continue;
      const content = await context.readFileSafe(file);
      if (!content || !/loadURL\s*\(/.test(content) || !RISKY_WEB_PREFERENCES_RE.test(content)) continue;

      LOAD_REMOTE_RE.lastIndex = 0;
      let match;
      while ((match = LOAD_REMOTE_RE.exec(content)) !== null) {
        const line = lineFromOffset(content, match.index);
        const nearby = await readNearby(context, file, line, 20);
        if (!RISKY_WEB_PREFERENCES_RE.test(nearby) && !RISKY_WEB_PREFERENCES_RE.test(content)) continue;

        findings.push({
          message: "Electron appears to load remote content while enabling risky renderer privileges.",
          file,
          line,
          recommendation:
            "Avoid loading remote content with Node.js integration. Use nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true and a minimal preload bridge.",
          heuristic: true,
          metadata: { pattern: "remote-load-url-with-risky-web-preferences" }
        });
      }
    }

    return findings.slice(0, 100);
  }
};

async function isElectronProject(context) {
  return (
    context.hasDependency("electron") ||
    context.hasDevDependency("electron") ||
    (await hasText(context, /\b(?:from\s+["'`]electron["'`]|require\s*\(\s*["'`]electron["'`]\s*\)|BrowserWindow)\b/g))
  );
}
