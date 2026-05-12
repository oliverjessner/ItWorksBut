import { isServerOrApiFile, lineFromOffset, readNearby } from "../helpers.js";

const REQUEST_INPUT_RE =
  /\breq\.(?:body|query|params)\b|\brequest\.json\s*\(|\bsearchParams\.get\s*\(|\bnew\s+URL\s*\(\s*(?:req|request)\.url\s*\)\.searchParams\b|\bformData\s*\(|\bctx\.request\.body\b/g;
const VALIDATION_RE =
  /\b(?:zod|Joi|joi|yup|valibot|ajv|superstruct|TypeBox|validator|validatedData)\b|\.safeParse\s*\(|\.parse\s*\(\s*(?:req\.body|body|input|payload|data)|\.validate\s*\(\s*(?:req\.body|body|input|payload|data)|\bschema\.(?:validate|parse|safeParse)\b/i;
const GLOBAL_VALIDATION_RE = /\b(?:app|router|server)\.use\s*\([^)]*(?:validate|validator|schema|zod|joi|yup|ajv|valibot)/i;

export default {
  id: "api.no-schema-validation",
  title: "API request input should be schema validated",
  category: "api",
  severity: "high",
  tags: ["api", "validation", "heuristic"],
  run: async (context) => {
    const findings = [];
    const globalValidationSeen = await hasGlobalValidationMiddleware(context);
    if (globalValidationSeen) return [];

    for (const file of context.textFiles) {
      if (!isApiFile(file)) continue;
      const content = await context.readFileSafe(file);
      if (!content) continue;
      if (VALIDATION_RE.test(content)) continue;

      REQUEST_INPUT_RE.lastIndex = 0;
      const match = REQUEST_INPUT_RE.exec(content);
      if (!match) continue;

      const line = lineFromOffset(content, match.index);
      const nearby = await readNearby(context, file, line, 10);
      if (VALIDATION_RE.test(nearby)) continue;

      findings.push({
        message: "This API route appears to consume request input without an obvious schema validation step.",
        file,
        line,
        recommendation: "Validate request body, query and params with a schema library such as Zod, Joi, Valibot, AJV or equivalent.",
        heuristic: true,
        metadata: { pattern: "request-input-without-schema-validation" }
      });
    }

    return findings.slice(0, 100);
  }
};

function isApiFile(file) {
  return (
    /\.[cm]?[jt]sx?$/.test(file) &&
    (isServerOrApiFile(file) ||
      file.startsWith("api/") ||
      file.startsWith("routes/") ||
      file.startsWith("handlers/") ||
      file.startsWith("controllers/") ||
      file.includes("/handlers/") ||
      file.includes("/controllers/"))
  );
}

async function hasGlobalValidationMiddleware(context) {
  for (const file of context.textFiles) {
    if (!/\.[cm]?[jt]sx?$/.test(file) || !isServerOrApiFile(file)) continue;
    const content = await context.readFileSafe(file);
    if (content && GLOBAL_VALIDATION_RE.test(content)) return true;
  }
  return false;
}
