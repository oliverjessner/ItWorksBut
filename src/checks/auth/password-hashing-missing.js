import { isCodeLikeFile, isEnvExampleFile, isLockfile, lineFromOffset } from "../helpers.js";

const USER_CREATE_TERMS_RE = /\b(register|signup|createUser|users|INSERT\s+INTO\s+users|prisma\.user\.create|db\.user\.create)\b/i;
const PASSWORD_TERM_RE = /\bpassword\b/i;
const HASHING_RE = /\b(?:bcrypt|bcryptjs|argon2|scrypt|crypto\.scrypt|pbkdf2|hashPassword|passwordHash|hashedPassword)\b/i;

const RISKY_PASSWORD_STORAGE_RE =
  /\bpassword\s*:\s*(?:password|req\.body\.password|request\.body\.password|body\.password)|\bpassword\s*=\s*(?:password|req\.body\.password|request\.body\.password|body\.password)|INSERT\s+INTO\s+users\s*\([^)]*password|prisma\.user\.create\s*\(\s*{[\s\S]{0,800}?data\s*:\s*{[\s\S]{0,500}?password\s*:|db\.user\.create\s*\(\s*{[\s\S]{0,800}?password\s*:/gi;

export default {
  id: "auth.password-hashing-missing",
  title: "User passwords should be hashed before storage",
  category: "auth",
  severity: "critical",
  tags: ["auth", "passwords", "heuristic"],
  run: async (context) => {
    const findings = [];

    for (const file of context.textFiles) {
      if (isLockfile(file) || isEnvExampleFile(file) || !isCodeLikeFile(file)) continue;
      const content = await context.readFileSafe(file);
      if (!content || !PASSWORD_TERM_RE.test(content) || !USER_CREATE_TERMS_RE.test(content)) continue;

      RISKY_PASSWORD_STORAGE_RE.lastIndex = 0;
      let match;
      while ((match = RISKY_PASSWORD_STORAGE_RE.exec(content)) !== null) {
        const line = lineFromOffset(content, match.index);
        const nearby = nearbyText(content, line, 10);
        if (HASHING_RE.test(nearby)) continue;

        findings.push({
          message:
            "This code appears to create users or store passwords without an obvious password hashing step.",
          file,
          line,
          recommendation:
            "Hash passwords with argon2, bcrypt, scrypt or PBKDF2 before storage. Never store raw passwords.",
          heuristic: true,
          metadata: {
            pattern: "password-storage-without-nearby-hashing"
          }
        });
        break;
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
