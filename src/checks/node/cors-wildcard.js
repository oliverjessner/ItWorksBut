export default {
  id: "node.cors-wildcard",
  title: "CORS should not be broadly open by default",
  category: "node",
  severity: "high",
  tags: ["node", "cors", "api"],
  run: async (context) => {
    const findings = [];
    const patterns = [
      { regex: /origin\s*:\s*["']\*["']/g, label: "origin: \"*\"" },
      { regex: /Access-Control-Allow-Origin["']?\s*,\s*["']\*["']/g, label: "Access-Control-Allow-Origin: *" },
      { regex: /\bcors\s*\(\s*\)/g, label: "cors() with default open origin" },
      { regex: /origin\s*:\s*true/g, label: "origin: true" }
    ];

    for (const pattern of patterns) {
      const matches = await context.grep(pattern.regex, {
        include: ["*.js", "*.ts", "*.mjs", "*.cjs"],
        maxMatches: 100
      });
      for (const match of matches) {
        findings.push({
          message: `CORS configuration appears broadly open (${pattern.label}).`,
          file: match.file,
          line: match.line,
          column: match.column,
          recommendation: "Restrict CORS origins to the exact trusted application origins and handle credentials carefully.",
          heuristic: true
        });
      }
    }

    return findings;
  }
};
