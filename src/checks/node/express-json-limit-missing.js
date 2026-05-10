import { hasText } from "../helpers.js";

export default {
  id: "node.express-json-limit-missing",
  title: "express.json should set a body size limit",
  category: "node",
  severity: "medium",
  tags: ["node", "express", "availability"],
  run: async (context) => {
    const expressDetected = context.hasDependency("express") || (await hasText(context, /\bfrom\s+["']express["']|\brequire\(["']express["']\)/g));
    if (!expressDetected) return [];

    const findings = [];
    for (const match of await context.grep(/express\.json\s*\(([^)]*)\)/g, {
      include: ["*.js", "*.ts", "*.mjs", "*.cjs"],
      maxMatches: 100
    })) {
      const args = match.match[1] || "";
      if (/\blimit\s*:/.test(args)) continue;
      findings.push({
        message: "Express JSON body parsing appears to be used without an explicit request body size limit.",
        file: match.file,
        line: match.line,
        column: match.column,
        recommendation: "Set a conservative JSON body parser limit such as 100kb, and tune it per route when needed."
      });
    }
    return findings;
  }
};
