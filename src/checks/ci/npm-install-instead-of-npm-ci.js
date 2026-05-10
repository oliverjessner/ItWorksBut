import { collectCiFiles } from "../helpers.js";

export default {
  id: "ci.npm-install-instead-of-npm-ci",
  title: "CI should prefer npm ci over npm install",
  category: "ci",
  severity: "medium",
  tags: ["ci", "dependencies", "reproducibility"],
  run: async (context) => {
    const findings = [];
    for (const file of await collectCiFiles(context)) {
      const content = await context.readFileSafe(file);
      if (!content) continue;
      const lines = content.split(/\r?\n/);
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        if (/\bnpm\s+install\b/.test(line) && !/\bnpm\s+install\s+(-g|--global)\b/.test(line)) {
          findings.push({
            message: "CI appears to use npm install instead of npm ci.",
            file,
            line: index + 1,
            recommendation: "Use npm ci in CI so installs are clean and lockfile-driven."
          });
        }
      }
    }
    return findings;
  }
};
