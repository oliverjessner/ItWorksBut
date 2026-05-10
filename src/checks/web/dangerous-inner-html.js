const PATTERNS = [
  { regex: /dangerouslySetInnerHTML/g, label: "dangerouslySetInnerHTML" },
  { regex: /\.innerHTML\s*=/g, label: "innerHTML assignment" },
  { regex: /insertAdjacentHTML\s*\(/g, label: "insertAdjacentHTML" }
];

export default {
  id: "web.dangerous-inner-html",
  title: "Direct HTML injection APIs should be reviewed",
  category: "web",
  severity: "high",
  tags: ["web", "xss", "frontend"],
  run: async (context) => {
    const findings = [];
    for (const pattern of PATTERNS) {
      const matches = await context.grep(pattern.regex, {
        include: ["*.js", "*.ts", "*.jsx", "*.tsx", "*.vue", "*.svelte", "*.html"],
        maxMatches: 100
      });
      for (const match of matches) {
        findings.push({
          message: `${pattern.label} appears to be used. This can create XSS risk if any input is attacker-controlled.`,
          file: match.file,
          line: match.line,
          column: match.column,
          recommendation: "Avoid raw HTML insertion when possible. If HTML is required, sanitize with a proven sanitizer and keep trusted and untrusted content separate.",
          heuristic: true
        });
      }
    }
    return findings;
  }
};
