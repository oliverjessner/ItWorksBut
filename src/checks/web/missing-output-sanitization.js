import { lineFromOffset } from "../helpers.js";

const UNSAFE_HTML_RESPONSE_RE = /\b(?:res\.(?:send|end|write)|reply\.send|new Response)\s*\(\s*`[^`]*<[^`]*\$\{[^}]*(?:req\.(?:body|query|params)|request|searchParams|params)[^}]*\}[^`]*`/gis;

export default {
  id: "web.missing-output-sanitization",
  title: "HTML built from request data should be sanitized or escaped",
  category: "web",
  severity: "medium",
  tags: ["web", "xss", "heuristic"],
  run: async (context) => {
    const findings = [];

    for (const file of context.textFiles) {
      if (!/\.[cm]?[jt]sx?$/.test(file)) continue;
      const content = await context.readFileSafe(file);
      if (!content) continue;

      let match;
      UNSAFE_HTML_RESPONSE_RE.lastIndex = 0;
      while ((match = UNSAFE_HTML_RESPONSE_RE.exec(content)) !== null) {
        findings.push({
          message: "Possible HTML response construction from request-controlled data appears without obvious escaping.",
          file,
          line: lineFromOffset(content, match.index),
          recommendation: "Escape output by context or use a templating/rendering layer that escapes by default. Sanitize only when raw HTML is explicitly required.",
          heuristic: true
        });
      }
    }

    return findings.slice(0, 100);
  }
};
