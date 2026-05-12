import { hasText, isEnvExampleFile, isLockfile, lineFromOffset } from "../helpers.js";

const CLIENT_DIRECTIVE_RE = /^\s*["'`]use client["'`]\s*;?/m;
const RISKY_CLIENT_CODE_RE =
  /\bfrom\s+["'`](?:node:)?(?:fs|path|child_process|crypto)["'`]|\brequire\s*\(\s*["'`](?:node:)?(?:fs|path|child_process|crypto)["'`]\s*\)|\bfrom\s+["'`](?:@prisma\/client|server-only|@\/lib\/(?:db|prisma)|(?:\.\.\/)+lib\/(?:db|prisma))["'`]|\brequire\s*\(\s*["'`](?:@prisma\/client|server-only|@\/lib\/(?:db|prisma)|(?:\.\.\/)+lib\/(?:db|prisma))["'`]\s*\)|\bprisma\b|\bprocess\.env\.(?:DATABASE_URL|JWT_SECRET|STRIPE_SECRET_KEY|OPENAI_API_KEY)\b/g;

export default {
  id: "next.public-server-code-risk",
  title: "Next.js Client Components should not import server-only code",
  category: "next",
  severity: "high",
  tags: ["next", "frontend", "server-only", "heuristic"],
  run: async (context) => {
    if (!(await isNextProject(context))) return [];

    const findings = [];
    for (const file of context.textFiles) {
      if (isLockfile(file) || isEnvExampleFile(file) || !isNextClientCandidate(file)) continue;
      const content = await context.readFileSafe(file);
      if (!content || !CLIENT_DIRECTIVE_RE.test(content)) continue;

      RISKY_CLIENT_CODE_RE.lastIndex = 0;
      let match;
      while ((match = RISKY_CLIENT_CODE_RE.exec(content)) !== null) {
        findings.push({
          message: "A Next.js Client Component appears to import server-side code or access server-only configuration.",
          file,
          line: lineFromOffset(content, match.index),
          recommendation:
            "Move database, filesystem, secret and server-only logic into Server Components, API routes or server actions. Keep Client Components free of backend dependencies.",
          heuristic: true,
          metadata: { pattern: classifyRisk(match[0]) }
        });
      }
    }

    return findings.slice(0, 100);
  }
};

async function isNextProject(context) {
  return (
    context.hasDependency("next") ||
    context.hasDevDependency("next") ||
    context.allFiles.some((file) => /^next\.config\.[cm]?[jt]s$/.test(file)) ||
    context.allFiles.some((file) => file.startsWith("app/")) ||
    (await hasText(context, /\bfrom\s+["'`]next\//g, { files: context.textFiles.filter((file) => /\.[cm]?[jt]sx?$/.test(file)) }))
  );
}

function isNextClientCandidate(file) {
  return (
    /\.(?:js|jsx|ts|tsx)$/.test(file) &&
    (file.startsWith("app/") || file.startsWith("components/") || file.includes("/components/"))
  );
}

function classifyRisk(value) {
  if (/process\.env/.test(value)) return "server-secret-env-access";
  if (/prisma|db/.test(value)) return "database-import";
  if (/child_process/.test(value)) return "child-process-import";
  if (/server-only/.test(value)) return "server-only-import";
  return "node-server-import";
}
