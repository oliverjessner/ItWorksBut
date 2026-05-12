import { isServerOrApiFile, lineFromOffset, readNearby } from "../helpers.js";

const ALL_ROUTE_RE = /\b(?:app|router|server)\.all\s*\(/g;
const NEXT_PAGES_HANDLER_RE = /\bexport\s+default\s+(?:async\s+)?function\s+\w*\s*\(\s*(?:req|request)\s*,\s*(?:res|response)\s*\)/g;
const NAMED_HANDLER_RE = /\bexport\s+(?:async\s+)?function\s+handler\s*\(\s*(?:req|request)\s*,\s*(?:res|response)\s*\)/g;
const METHOD_GUARD_RE =
  /\b(?:req|request)\.method\b|\bswitch\s*\(\s*(?:req|request)\.method\s*\)|\ballowedMethods\b|\bmethodNotAllowed\b|\breturn\s+new\s+Response\s*\([^)]*405|\bstatus\s*\(\s*405\s*\)/i;
const METHOD_EXPORT_RE = /\bexport\s+(?:async\s+)?function\s+(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*\(/;

export default {
  id: "api.missing-method-guard",
  title: "API handlers should restrict HTTP methods",
  category: "api",
  severity: "medium",
  tags: ["api", "http-methods", "heuristic"],
  run: async (context) => {
    const findings = [];

    for (const file of context.textFiles) {
      if (!isApiCandidate(file)) continue;
      const content = await context.readFileSafe(file);
      if (!content) continue;

      ALL_ROUTE_RE.lastIndex = 0;
      let allMatch;
      while ((allMatch = ALL_ROUTE_RE.exec(content)) !== null) {
        const line = lineFromOffset(content, allMatch.index);
        const nearby = await readNearby(context, file, line, 8);
        if (/\b(?:allowedMethods|methodNotAllowed|405)\b/i.test(nearby)) continue;
        findings.push(methodFinding(file, line, "app-router-all"));
      }

      if (METHOD_EXPORT_RE.test(content) || METHOD_GUARD_RE.test(content)) continue;

      for (const pattern of [NEXT_PAGES_HANDLER_RE, NAMED_HANDLER_RE]) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(content)) !== null) {
          findings.push(methodFinding(file, lineFromOffset(content, match.index), "handler-without-method-guard"));
        }
      }
    }

    return findings.slice(0, 100);
  }
};

function isApiCandidate(file) {
  return (
    /\.[cm]?[jt]sx?$/.test(file) &&
    (isServerOrApiFile(file) ||
      file.startsWith("routes/") ||
      file.startsWith("api/") ||
      file.includes("/controllers/") ||
      file.includes("/handlers/"))
  );
}

function methodFinding(file, line, pattern) {
  return {
    message: "This API handler appears to process requests without an explicit HTTP method guard.",
    file,
    line,
    recommendation: "Restrict API routes to the intended HTTP methods and return 405 Method Not Allowed for unsupported methods.",
    heuristic: true,
    metadata: { pattern }
  };
}
