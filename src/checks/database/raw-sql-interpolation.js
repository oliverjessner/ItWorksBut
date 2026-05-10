import { lineFromOffset } from "../helpers.js";

const SQL_TEMPLATE_RE = /`[^`]*\b(SELECT|INSERT|UPDATE|DELETE|WITH)\b[^`]*\$\{[^`]*`/gi;
const SQL_CONCAT_RE = /\b(SELECT|INSERT|UPDATE|DELETE|WITH)\b[^;\n]*(?:["'`]\s*\+|\+\s*["'`])[^;\n]*/gi;

export default {
  id: "database.raw-sql-interpolation",
  title: "Raw SQL should not be built with string interpolation",
  category: "database",
  severity: "high",
  tags: ["database", "sql-injection"],
  run: async (context) => {
    const findings = [];

    for (const file of context.textFiles) {
      if (!/\.[cm]?[jt]sx?$/.test(file)) continue;
      const content = await context.readFileSafe(file);
      if (!content) continue;

      for (const pattern of [
        { regex: SQL_TEMPLATE_RE, label: "template string interpolation" },
        { regex: SQL_CONCAT_RE, label: "string concatenation" }
      ]) {
        pattern.regex.lastIndex = 0;
        let match;
        while ((match = pattern.regex.exec(content)) !== null) {
          findings.push({
            message: `Possible SQL injection risk: raw SQL appears to be built with ${pattern.label}.`,
            file,
            line: lineFromOffset(content, match.index),
            recommendation: "Use parameterized queries, prepared statements, or ORM query builders instead of interpolating values into SQL strings.",
            heuristic: true,
            metadata: { pattern: pattern.label }
          });
        }
      }
    }

    return findings.slice(0, 100);
  }
};
