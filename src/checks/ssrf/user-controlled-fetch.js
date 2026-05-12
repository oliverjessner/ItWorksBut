import { isCodeLikeFile, isEnvExampleFile, isLockfile, isFrontendFile, isServerOrApiFile, lineFromOffset, readNearby } from "../helpers.js";

const HTTP_REQUEST_RE =
  /\b(?:fetch|got|request|ky)\s*\(|\baxios\.(?:get|post|put|patch|delete|request)\s*\(|\baxios\s*\(\s*{|\bundici\.request\s*\(|\bhttps?\.get\s*\(/g;
const USER_URL_SOURCE_RE =
  /\breq\.(?:body|query|params)\.url\b|\bsearchParams\.get\s*\(\s*["'`]url["'`]\s*\)|\bformData\.get\s*\(\s*["'`]url["'`]\s*\)|\b(?:requestUrl|userUrl|targetUrl|webhookUrl|callbackUrl|imageUrl|avatarUrl)\b/i;
const URL_ALLOWLIST_RE =
  /\b(?:allowlist|allowedHosts|allowedDomains|hostname\s*(?:===|!==|==|!=)|private\s+IP|localhost\s+block|metadata\s+IP|validateUrl|isAllowedUrl|isPrivateIp|blockPrivate|blockLocalhost)\b|169\.254\.169\.254|127\.0\.0\.1|localhost/i;

export default {
  id: "ssrf.user-controlled-fetch",
  title: "Server-side HTTP requests should not trust user-controlled URLs",
  category: "ssrf",
  severity: "critical",
  tags: ["ssrf", "api", "network", "heuristic"],
  run: async (context) => {
    const findings = [];

    for (const file of context.textFiles) {
      if (isLockfile(file) || isEnvExampleFile(file) || !isCodeLikeFile(file) || isFrontendFile(file)) continue;
      const content = await context.readFileSafe(file);
      if (!content || !isLikelyServerSide(file, content) || !/\b(?:fetch|axios|got|request|undici|http|https|ky)\b/.test(content)) continue;

      HTTP_REQUEST_RE.lastIndex = 0;
      let match;
      while ((match = HTTP_REQUEST_RE.exec(content)) !== null) {
        const line = lineFromOffset(content, match.index);
        const nearby = await readNearby(context, file, line, 8);
        if (!USER_URL_SOURCE_RE.test(nearby)) continue;
        if (URL_ALLOWLIST_RE.test(nearby)) continue;

        findings.push({
          message: "User-controlled input appears to flow into a server-side HTTP request.",
          file,
          line,
          recommendation:
            "Use strict URL allowlists, block private/internal IP ranges including 127.0.0.1, localhost, 169.254.169.254 and RFC1918 ranges, and avoid fetching arbitrary user-provided URLs.",
          heuristic: true,
          metadata: { pattern: "user-controlled-server-fetch" }
        });
      }
    }

    return findings.slice(0, 100);
  }
};

function isLikelyServerSide(file, content) {
  return (
    isServerOrApiFile(file) ||
    /^server\.[cm]?[jt]s$/.test(file) ||
    file.startsWith("server/") ||
    file.startsWith("routes/") ||
    file.startsWith("api/") ||
    file.includes("/server/") ||
    file.includes("/routes/") ||
    file.includes("/controllers/") ||
    /\b(?:req\.body|req\.query|req\.params|request\.json|ctx\.request|express|fastify|hono)\b/.test(content)
  );
}
