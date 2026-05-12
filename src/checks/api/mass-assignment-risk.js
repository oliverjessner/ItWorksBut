import { isCodeLikeFile, isEnvExampleFile, isLockfile, lineFromOffset, readNearby } from "../helpers.js";

const MASS_ASSIGNMENT_PATTERNS = [
  {
    regex: /\b(?:prisma\.\w+\.)?(?:create|update|upsert)\s*\(\s*{[\s\S]{0,600}?\bdata\s*:\s*(?:req\.body|body|input)\b/g,
    label: "direct data object",
    severity: "high"
  },
  {
    regex: /\b(?:db|database|collection|\w+)\.(?:update|updateOne|updateMany|findOneAndUpdate)\s*\([\s\S]{0,300}?(?:req\.body|body|input)\b/g,
    label: "direct update payload",
    severity: "high"
  },
  {
    regex: /\b(?:User|Account|Profile|Model|model|\w+)\.(?:create|update)\s*\(\s*(?:req\.body|body|input)\b/g,
    label: "model create/update payload",
    severity: "high"
  },
  {
    regex: /\$set\s*:\s*(?:req\.body|body|input)\b/g,
    label: "mongodb set payload",
    severity: "high"
  },
  {
    regex: /Object\.assign\s*\(\s*(?:user|entity|account|profile|record|model)[\w$]*\s*,\s*(?:req\.body|body|input)\b/g,
    label: "object assign from request input",
    severity: "medium"
  },
  {
    regex: /\{\s*\.\.\.(?:req\.body|body)\s*}/g,
    label: "spread request body",
    severity: "medium",
    requiresCreateOrUpdateContext: true
  }
];

const SAFE_FIELD_RE =
  /\b(?:pick|omit|allowedFields|allowlist|whitelist|safeData|validatedData|schema\.parse|schema\.safeParse|safeParse|zod|Joi|joi|yup|valibot)\b/i;
const RISKY_FIELD_RE =
  /\b(?:role|isAdmin|admin|plan|verified|emailVerified|ownerId|userId|tenantId|accountId|permissions|credits|balance|price|status)\b/i;
const CREATE_OR_UPDATE_RE = /\b(?:create|update|upsert|insert|save|data\s*:|\$set)\b/i;

export default {
  id: "api.mass-assignment-risk",
  title: "Create and update operations should not trust raw request bodies",
  category: "api",
  severity: "high",
  tags: ["api", "database", "mass-assignment", "heuristic"],
  run: async (context) => {
    const findings = [];

    for (const file of context.textFiles) {
      if (isLockfile(file) || isEnvExampleFile(file) || !isCodeLikeFile(file)) continue;
      const content = await context.readFileSafe(file);
      if (!content || !/\b(?:req\.body|body|input|Object\.assign|\$set)\b/.test(content)) continue;

      for (const pattern of MASS_ASSIGNMENT_PATTERNS) {
        pattern.regex.lastIndex = 0;
        let match;
        while ((match = pattern.regex.exec(content)) !== null) {
          const line = lineFromOffset(content, match.index);
          const nearby = await readNearby(context, file, line, 8);
          if (pattern.requiresCreateOrUpdateContext && !CREATE_OR_UPDATE_RE.test(nearby)) continue;
          if (SAFE_FIELD_RE.test(nearby)) continue;

          findings.push({
            severity: RISKY_FIELD_RE.test(nearby) ? "high" : pattern.severity === "high" ? "high" : "medium",
            message: "User-controlled input appears to be passed directly into a create or update operation.",
            file,
            line,
            recommendation: "Whitelist allowed fields explicitly. Never pass req.body directly into database create/update calls.",
            heuristic: true,
            metadata: { pattern: pattern.label }
          });
        }
      }
    }

    return findings.slice(0, 100);
  }
};
