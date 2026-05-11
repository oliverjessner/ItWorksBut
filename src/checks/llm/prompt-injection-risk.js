import { isCodeLikeFile, isEnvExampleFile, isLockfile, lineFromOffset } from "../helpers.js";

const LLM_USAGE_RE =
  /\b(?:openai\.chat\.completions\.create|openai\.responses\.create|anthropic\.messages\.create|generateText|streamText|ollama|langchain|aiOutput|completion|modelOutput|llmResponse)\b/i;
const LLM_OUTPUT_RE = /\b(?:aiOutput|completion|modelOutput|llmResponse|llmResult|modelResponse)\b/i;
const DANGEROUS_USE_RE =
  /\b(?:eval|exec|execSync|spawn|spawnSync|db\.query|JSON\.parse|fetch)\s*\(\s*([^)\n;]+)|\bnew\s+Function\s*\(\s*([^)\n;]+)|\bprisma\.\$queryRawUnsafe\s*\(\s*([^)\n;]+)|\binnerHTML\s*=\s*([^;\n]+)|dangerouslySetInnerHTML\s*=\s*{{[\s\S]{0,200}?__html\s*:\s*([^}\n]+)|\bfs\.writeFile\s*\([^,\n]+,\s*([^)\n;]+)/gi;

export default {
  id: "llm.prompt-injection-risk",
  title: "LLM output should not flow directly into dangerous actions",
  category: "llm",
  severity: "high",
  tags: ["llm", "prompt-injection", "heuristic"],
  run: async (context) => {
    const findings = [];

    for (const file of context.textFiles) {
      if (isLockfile(file) || isEnvExampleFile(file) || !isCodeLikeFile(file)) continue;
      const content = await context.readFileSafe(file);
      if (!content || !LLM_USAGE_RE.test(content)) continue;

      DANGEROUS_USE_RE.lastIndex = 0;
      let match;
      while ((match = DANGEROUS_USE_RE.exec(content)) !== null) {
        const argument = match.slice(1).find(Boolean) || "";
        if (!LLM_OUTPUT_RE.test(argument)) continue;

        findings.push({
          message:
            "LLM output appears to flow into code execution, shell commands, HTML injection, database queries, file writes or network requests.",
          file,
          line: lineFromOffset(content, match.index),
          recommendation:
            "Treat model output as untrusted input. Validate with schemas, use allowlists, require human approval for dangerous actions, and never execute raw model output.",
          heuristic: true,
          metadata: {
            pattern: classifyDangerousUse(match[0])
          }
        });
      }
    }

    return findings.slice(0, 100);
  }
};

function classifyDangerousUse(value) {
  if (/\beval\b|\bFunction\b/.test(value)) return "code-execution";
  if (/\bexec|spawn/.test(value)) return "shell-command";
  if (/innerHTML|dangerouslySetInnerHTML/.test(value)) return "html-injection";
  if (/query/.test(value)) return "database-query";
  if (/writeFile/.test(value)) return "file-write";
  if (/fetch/.test(value)) return "network-request";
  if (/JSON\.parse/.test(value)) return "unvalidated-json-parse";
  return "dangerous-llm-output-use";
}
