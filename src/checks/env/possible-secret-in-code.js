import { isCodeLikeFile, isEnvExampleFile, isLockfile } from "../helpers.js";

const SECRET_NAMES = [
  "OPENAI_API_KEY",
  "STRIPE_SECRET_KEY",
  "GITHUB_TOKEN",
  "JWT_SECRET",
  "PRIVATE_KEY",
  "DATABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "AWS_SECRET_ACCESS_KEY"
];

const PLACEHOLDER_RE = /^(your_|example|changeme|change_me|todo|test|dummy|xxx|placeholder|<|""|''|null|undefined)/i;

export default {
  id: "env.possible-secret-in-code",
  title: "Possible hardcoded secrets should not appear in source",
  category: "env",
  severity: "critical",
  tags: ["secrets", "static-analysis"],
  run: async (context) => {
    const findings = [];

    for (const file of context.textFiles) {
      if (isLockfile(file) || isEnvExampleFile(file) || !isCodeLikeFile(file)) continue;

      const content = await context.readFileSafe(file);
      if (!content) continue;
      const lines = content.split(/\r?\n/);

      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];

        if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(line)) {
          findings.push(secretFinding(file, index + 1, "PRIVATE_KEY"));
          continue;
        }

        for (const secretName of SECRET_NAMES) {
          const regex = new RegExp(`(?:^|[\\s{,;])["']?(${escapeRegExp(secretName)})["']?\\s*(?:=|:)\\s*["']?([^"'\\s,;]+)`, "i");
          const match = line.match(regex);
          if (!match) continue;

          const possibleValue = match[2] || "";
          if (PLACEHOLDER_RE.test(possibleValue) || /process\.env|import\.meta\.env/i.test(possibleValue)) continue;
          findings.push(secretFinding(file, index + 1, secretName));
        }
      }
    }

    return findings.slice(0, 100);
  }
};

function secretFinding(file, line, secretType) {
  return {
    message: `A possible ${secretType} value appears to be hardcoded. The value was not printed.`,
    file,
    line,
    recommendation: "Move the secret to a secure runtime secret store or CI secret, rotate it if it was committed, and keep only safe placeholders in examples.",
    heuristic: true,
    metadata: {
      secretType,
      valueRedacted: true
    }
  };
}

function escapeRegExp(value) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}
