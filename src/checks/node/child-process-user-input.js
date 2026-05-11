import { isCodeLikeFile, isEnvExampleFile, isLockfile, lineFromOffset } from "../helpers.js";

const CHILD_PROCESS_RE = /\b(?:exec|execSync|spawn|spawnSync|fork)\s*\(([^;\n]*)/gi;
const CHILD_PROCESS_IMPORT_RE = /\bchild_process\b|\bfrom\s+["'`]node:child_process["'`]|\brequire\s*\(\s*["'`](?:node:)?child_process["'`]\s*\)/i;
const USER_INPUT_RE =
  /\b(?:req\.(?:body|query|params)|request\.body|searchParams|process\.argv|formData|userInput|input|filename|branch|url)\b/i;
const ALLOWLIST_RE = /\b(?:allowlist|allowed|whitelist|safeList|zod|schema|validate|validator|assertAllowed)\b/i;

export default {
  id: "node.child-process-user-input",
  title: "Child process commands should not trust user input",
  category: "node",
  severity: "critical",
  tags: ["node", "command-injection", "heuristic"],
  run: async (context) => {
    const findings = [];

    for (const file of context.textFiles) {
      if (isLockfile(file) || isEnvExampleFile(file) || !isCodeLikeFile(file)) continue;
      const content = await context.readFileSafe(file);
      if (!content || !CHILD_PROCESS_IMPORT_RE.test(content)) continue;

      CHILD_PROCESS_RE.lastIndex = 0;
      let match;
      while ((match = CHILD_PROCESS_RE.exec(content)) !== null) {
        const line = lineFromOffset(content, match.index);
        const nearby = nearbyText(content, line, 8);
        if (!USER_INPUT_RE.test(match[1] || nearby)) continue;
        if (ALLOWLIST_RE.test(nearby)) continue;

        findings.push({
          message: "User-controlled input appears to flow into a child process command.",
          file,
          line,
          recommendation:
            "Avoid shell execution with user input. Use spawn with fixed command and argument arrays, validate against allowlists, and never concatenate shell strings.",
          heuristic: true,
          metadata: {
            pattern: "child-process-user-input"
          }
        });
      }
    }

    return findings.slice(0, 100);
  }
};

function nearbyText(content, line, radius) {
  const lines = content.split(/\r?\n/);
  const start = Math.max(0, line - radius - 1);
  const end = Math.min(lines.length, line + radius);
  return lines.slice(start, end).join("\n");
}
