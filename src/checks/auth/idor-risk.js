import { hasOwnerKeyword, lineFromOffset, readNearby } from "../helpers.js";

const IDOR_PATTERNS = [
  { regex: /findUnique\s*\(\s*{[\s\S]{0,220}?where\s*:\s*{[\s\S]{0,120}?\bid\b/g, label: "findUnique by id" },
  { regex: /\bSELECT\b[\s\S]{0,180}?\bWHERE\b[\s\S]{0,80}?\bid\s*=\s*(?:\?|[$:]\w+|\$\{)/gi, label: "SQL lookup by id" },
  { regex: /["'`]\/api\/[^"'`]*\/:id["'`]/g, label: "API route with :id parameter" }
];

export default {
  id: "api.idor-risk",
  title: "Object lookup by id should be scoped to the authenticated owner",
  category: "auth",
  severity: "high",
  tags: ["api", "auth", "idor", "heuristic"],
  run: async (context) => {
    const findings = [];

    for (const file of context.textFiles) {
      if (!/\.[cm]?[jt]sx?$/.test(file)) continue;
      const content = await context.readFileSafe(file);
      if (!content) continue;

      for (const pattern of IDOR_PATTERNS) {
        pattern.regex.lastIndex = 0;
        let match;
        while ((match = pattern.regex.exec(content)) !== null) {
          const line = lineFromOffset(content, match.index);
          const nearby = await readNearby(context, file, line, 8);
          if (hasOwnerKeyword(nearby)) continue;

          findings.push({
            message: `Potential IDOR risk: ${pattern.label} appears without a nearby owner, tenant, or user scope check.`,
            file,
            line,
            recommendation: "Scope object reads and writes by authenticated user, owner, account, tenant, or organization, not by id alone.",
            heuristic: true,
            metadata: { pattern: pattern.label }
          });
        }
      }
    }

    return findings.slice(0, 100);
  }
};
