import { isCodeLikeFile, isEnvExampleFile, isLockfile } from "../helpers.js";

const STORAGE_TOKEN_RE =
  /\b(?:window\.)?(localStorage|sessionStorage)\.setItem\s*\(\s*["'`]([^"'`]*(?:token|jwt|access|refresh|auth|bearer|session)[^"'`]*)["'`]/gi;

export default {
  id: "frontend.localstorage-token",
  title: "Authentication tokens should not live in browser storage by default",
  category: "frontend",
  severity: "high",
  tags: ["frontend", "auth", "xss", "heuristic"],
  run: async (context) => {
    const findings = [];

    for (const file of context.textFiles) {
      if (isLockfile(file) || isEnvExampleFile(file) || !isCodeLikeFile(file)) continue;
      const content = await context.readFileSafe(file);
      if (!content || !/(?:localStorage|sessionStorage)\.setItem/.test(content)) continue;
      const lines = content.split(/\r?\n/);

      for (let index = 0; index < lines.length; index += 1) {
        STORAGE_TOKEN_RE.lastIndex = 0;
        let match;
        while ((match = STORAGE_TOKEN_RE.exec(lines[index])) !== null) {
          findings.push({
            message: "Authentication tokens appear to be stored in localStorage or sessionStorage.",
            file,
            line: index + 1,
            recommendation:
              "Prefer secure, httpOnly cookies for session tokens where appropriate. If browser storage is unavoidable, minimize token lifetime and harden XSS protections.",
            heuristic: true,
            metadata: {
              pattern: `${match[1]}.setItem(auth-token-key)`
            }
          });
        }
      }
    }

    return findings.slice(0, 100);
  }
};
