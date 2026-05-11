import { isCodeLikeFile, isEnvExampleFile, isLockfile } from "../helpers.js";

const LOG_CALL_RE = /\b(?:console\.(?:log|error|debug|info|warn)|logger\.(?:info|debug|error|warn|trace))\s*\(([^)]*)\)/g;
const SECRET_TERMS = [
  "SECRET",
  "TOKEN",
  "KEY",
  "PASSWORD",
  "DATABASE_URL",
  "PRIVATE",
  "SERVICE_ROLE",
  "OPENAI_API_KEY",
  "STRIPE_SECRET_KEY",
  "JWT_SECRET",
  "GITHUB_TOKEN",
  "AWS_SECRET_ACCESS_KEY"
];

export default {
  id: "secrets.secrets-in-logs",
  title: "Logs should not include secrets or sensitive request data",
  category: "secrets",
  severity: "high",
  tags: ["secrets", "logging", "heuristic"],
  run: async (context) => {
    const findings = [];

    for (const file of context.textFiles) {
      if (isLockfile(file) || isEnvExampleFile(file) || !isCodeLikeFile(file)) continue;
      const content = await context.readFileSafe(file);
      if (!content) continue;
      const lines = content.split(/\r?\n/);

      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        LOG_CALL_RE.lastIndex = 0;

        let match;
        while ((match = LOG_CALL_RE.exec(line)) !== null) {
          const args = match[1] || "";
          if (!containsSensitiveLogTarget(args)) continue;

          findings.push({
            message:
              "Logging environment variables, headers, request bodies or secret-like config values may expose sensitive data.",
            file,
            line: index + 1,
            recommendation:
              "Remove sensitive logging, mask secrets, and log only explicit non-sensitive fields.",
            heuristic: true,
            metadata: {
              secretType: detectSecretType(args),
              valueRedacted: true
            }
          });
          break;
        }
      }
    }

    return findings.slice(0, 100);
  }
};

function containsSensitiveLogTarget(value) {
  return (
    /\bprocess\.env(?:\.[A-Z0-9_]+)?\b/.test(value) ||
    /\b(?:req|request)\.(?:headers|body)\b/.test(value) ||
    /\bconfig\b/i.test(value) ||
    SECRET_TERMS.some((term) => new RegExp(`\\b${escapeRegExp(term)}\\b`, "i").test(value))
  );
}

function detectSecretType(value) {
  const match = SECRET_TERMS.find((term) => new RegExp(`\\b${escapeRegExp(term)}\\b`, "i").test(value));
  if (match) return match;
  if (/\bprocess\.env\b/.test(value)) return "ENVIRONMENT";
  if (/\b(?:req|request)\.headers\b/.test(value)) return "REQUEST_HEADERS";
  if (/\b(?:req|request)\.body\b/.test(value)) return "REQUEST_BODY";
  if (/\bconfig\b/i.test(value)) return "CONFIG";
  return "UNKNOWN";
}

function escapeRegExp(value) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}
