import path from "node:path";
import { matchesGlob } from "../utils/path.js";

export const CODE_FILE_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".vue",
  ".svelte",
  ".astro",
  ".html",
  ".css",
  ".json",
  ".yml",
  ".yaml",
  ".env"
]);

export function isCodeLikeFile(file) {
  if (isLockfile(file)) return false;
  const extension = path.extname(file);
  return CODE_FILE_EXTENSIONS.has(extension) || file.includes(".env");
}

export function isLockfile(file) {
  return ["package-lock.json", "pnpm-lock.yaml", "yarn.lock"].includes(file);
}

export function isEnvFile(file) {
  const base = path.basename(file);
  return base === ".env" || (base.startsWith(".env.") && !isEnvExampleFile(file));
}

export function isEnvExampleFile(file) {
  const base = path.basename(file);
  return [".env.example", ".env.sample", ".env.template", ".env.defaults"].includes(base);
}

export function isExpressProject(context) {
  return context.hasDependency("express") || context.textFiles.some((file) => file.endsWith(".js") || file.endsWith(".ts"));
}

export async function hasText(context, regex, options = {}) {
  const files = options.files || context.textFiles;
  for (const file of files) {
    const content = await context.readFileSafe(file);
    if (content && regex.test(content)) {
      regex.lastIndex = 0;
      return true;
    }
    regex.lastIndex = 0;
  }
  return false;
}

export async function collectCiFiles(context) {
  return context.textFiles.filter((file) => {
    return (
      matchesGlob(file, ".github/workflows/*.yml") ||
      matchesGlob(file, ".github/workflows/*.yaml") ||
      file === ".gitlab-ci.yml" ||
      file === ".circleci/config.yml" ||
      file === "Jenkinsfile" ||
      file.startsWith("ci/") ||
      file.startsWith(".buildkite/")
    );
  });
}

export async function readNearby(context, file, line, radius = 6) {
  const content = await context.readFileSafe(file);
  if (!content) return "";
  const lines = content.split(/\r?\n/);
  const start = Math.max(0, line - radius - 1);
  const end = Math.min(lines.length, line + radius);
  return lines.slice(start, end).join("\n");
}

export function hasAuthKeyword(text) {
  return /\b(auth|authenticate|authenticated|authorization|authorize|requireAuth|requireUser|session|passport|jwt|bearer|getServerSession|clerk|supabase\.auth|currentUser|isAuthenticated)\b/i.test(
    text
  );
}

export function hasOwnerKeyword(text) {
  return /\b(userId|ownerId|accountId|tenantId|orgId|organizationId|workspaceId|teamId|createdBy|authorId)\b/i.test(text);
}

export function lineFromOffset(content, offset) {
  return content.slice(0, offset).split(/\r?\n/).length;
}

export function isFrontendFile(file) {
  return /\.(jsx|tsx|vue|svelte|astro)$/.test(file) || file.startsWith("src/components/") || file.startsWith("src/pages/");
}

export function isServerOrApiFile(file) {
  return (
    file.includes("/api/") ||
    file.includes("/routes/") ||
    file.includes("/server/") ||
    file.includes("/middleware") ||
    file.startsWith("pages/api/") ||
    file.startsWith("app/api/") ||
    /server\.[cm]?[jt]s$/.test(file) ||
    /app\.[cm]?[jt]s$/.test(file)
  );
}

export function parseJsonWithComments(content) {
  try {
    return JSON.parse(content);
  } catch {
    const withoutComments = content
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|\s)\/\/.*$/gm, "$1");
    return JSON.parse(withoutComments);
  }
}
