import { isCodeLikeFile, isLockfile } from "../helpers.js";

const PUBLIC_SECRET_RE = /\b((?:VITE_|NEXT_PUBLIC_|PUBLIC_)[A-Z0-9_]*(?:SECRET|TOKEN|PRIVATE|KEY|SERVICE_ROLE|DATABASE_URL)[A-Z0-9_]*)\b/g;

export default {
  id: "env.frontend-secret-exposure",
  title: "Frontend-public environment variables should not look secret",
  category: "env",
  severity: "high",
  tags: ["secrets", "frontend", "env"],
  run: async (context) => {
    const findings = [];
    const seen = new Set();

    for (const file of context.textFiles) {
      if (isLockfile(file) || !isCodeLikeFile(file)) continue;
      const content = await context.readFileSafe(file);
      if (!content) continue;

      const lines = content.split(/\r?\n/);
      for (let index = 0; index < lines.length; index += 1) {
        PUBLIC_SECRET_RE.lastIndex = 0;
        let match;
        while ((match = PUBLIC_SECRET_RE.exec(lines[index])) !== null) {
          const envName = match[1];
          if (/_RE$|_REGEX$/.test(envName)) continue;
          const key = `${file}:${index + 1}:${envName}`;
          if (seen.has(key)) continue;
          seen.add(key);
          findings.push({
            message: `Potential frontend-exposed secret-like environment variable ${envName} appears in client-visible code or config.`,
            file,
            line: index + 1,
            recommendation: "Do not expose secrets through VITE_, NEXT_PUBLIC_, or PUBLIC_ variables. Move secret operations to server-side code.",
            heuristic: true,
            metadata: { envName }
          });
        }
      }
    }

    return findings.slice(0, 100);
  }
};
