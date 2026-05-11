import { isCodeLikeFile, isEnvExampleFile, isLockfile } from "../helpers.js";

const WEAK_JWT_VALUES = [
  "secret",
  "changeme",
  "change-me",
  "dev-secret",
  "development",
  "password",
  "123456",
  "jwt-secret",
  "supersecret",
  "test",
  "local"
];

const WEAK_VALUE_RE = `(?:${WEAK_JWT_VALUES.map(escapeRegExp).join("|")})`;
const DIRECT_JWT_RE = new RegExp(`\\bjwt\\.(?:sign|verify)\\s*\\([^\\n;]*?,\\s*["'\`]${WEAK_VALUE_RE}["'\`]`, "i");
const FALLBACK_RE = new RegExp(`\\bprocess\\.env\\.JWT_SECRET\\s*(?:\\|\\||\\?\\?)\\s*["'\`]${WEAK_VALUE_RE}["'\`]`, "i");
const ASSIGNMENT_RE = new RegExp(`\\bJWT_SECRET\\b\\s*(?:=|:)\\s*["'\`]${WEAK_VALUE_RE}["'\`]`, "i");

export default {
  id: "auth.jwt-secret-weak-or-fallback",
  title: "JWT secrets should not use weak hardcoded values or fallbacks",
  category: "auth",
  severity: "high",
  tags: ["auth", "jwt", "secrets", "heuristic"],
  run: async (context) => {
    const findings = [];

    for (const file of context.textFiles) {
      if (isLockfile(file) || isEnvExampleFile(file) || !isCodeLikeFile(file)) continue;
      const content = await context.readFileSafe(file);
      if (!content || !/\bJWT_SECRET\b|\bjwt\.(?:sign|verify)\b/i.test(content)) continue;

      const lines = content.split(/\r?\n/);
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];

        if (DIRECT_JWT_RE.test(line)) {
          findings.push(jwtFinding(file, index + 1, "direct-hardcoded-jwt-secret", "critical"));
        } else if (FALLBACK_RE.test(line)) {
          findings.push(jwtFinding(file, index + 1, "environment-fallback", "high"));
        } else if (ASSIGNMENT_RE.test(line)) {
          findings.push(jwtFinding(file, index + 1, "weak-jwt-secret-assignment", "high"));
        }
      }
    }

    return findings.slice(0, 100);
  }
};

function jwtFinding(file, line, pattern, severity) {
  return {
    severity,
    message: "JWT signing or verification appears to use a weak hardcoded secret or a development fallback.",
    file,
    line,
    recommendation:
      "Require a strong JWT secret from the environment in production and fail startup if it is missing.",
    heuristic: true,
    metadata: {
      pattern,
      valueRedacted: true
    }
  };
}

function escapeRegExp(value) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}
