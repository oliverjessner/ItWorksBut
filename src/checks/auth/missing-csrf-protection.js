import { isCodeLikeFile, isEnvExampleFile, isLockfile, lineFromOffset } from "../helpers.js";

const COOKIE_AUTH_RE =
  /\b(?:res\.cookie|cookies\(\)\.set|response\.cookies\.set|setCookie|serialize)\s*\(\s*["'`](?:session|token|auth|jwt)["'`]|cookieSession\s*\(|express-session|\bsession\s*\(|credentials\s*:\s*["'`]include["'`]|withCredentials\s*:\s*true/gi;
const CSRF_PROTECTION_RE =
  /\b(?:csrf|csurf|csrfToken|anti-csrf|verifyCsrf|validateCsrf|csrfProtection)\b|double\s+submit|\bsameSite\s*:\s*["'`]?(?:strict|lax)["'`]?\b/gi;
const STATE_CHANGING_ROUTE_RE =
  /\b(?:app|router|server)\.(?:post|put|patch|delete)\s*\(|\bmethod\s*:\s*["'`](?:POST|PUT|PATCH|DELETE)["'`]|\breq\.method\s*={0,3}\s*["'`](?:POST|PUT|PATCH|DELETE)["'`]|\bexport\s+async\s+function\s+(?:POST|PUT|PATCH|DELETE)\s*\(/g;

export default {
  id: "auth.missing-csrf-protection",
  title: "Cookie-based authentication should include CSRF protection",
  category: "auth",
  severity: "high",
  tags: ["auth", "csrf", "cookies", "heuristic"],
  run: async (context) => {
    const cookieMatches = [];
    const stateChangingRoutes = [];
    let csrfProtectionSeen = false;

    for (const file of context.textFiles) {
      if (isLockfile(file) || isEnvExampleFile(file) || !isCodeLikeFile(file)) continue;
      const content = await context.readFileSafe(file);
      if (!content) continue;

      CSRF_PROTECTION_RE.lastIndex = 0;
      if (CSRF_PROTECTION_RE.test(content)) {
        csrfProtectionSeen = true;
        break;
      }

      COOKIE_AUTH_RE.lastIndex = 0;
      let cookieMatch;
      while ((cookieMatch = COOKIE_AUTH_RE.exec(content)) !== null) {
        cookieMatches.push({
          file,
          line: lineFromOffset(content, cookieMatch.index),
          pattern: normalizePattern(cookieMatch[0])
        });
        if (cookieMatches.length >= 25) break;
      }

      STATE_CHANGING_ROUTE_RE.lastIndex = 0;
      let routeMatch;
      while ((routeMatch = STATE_CHANGING_ROUTE_RE.exec(content)) !== null) {
        stateChangingRoutes.push({
          file,
          line: lineFromOffset(content, routeMatch.index),
          pattern: normalizePattern(routeMatch[0])
        });
        if (stateChangingRoutes.length >= 25) break;
      }
    }

    if (csrfProtectionSeen || cookieMatches.length === 0 || stateChangingRoutes.length === 0) return [];

    const primaryCookie = cookieMatches[0];
    return stateChangingRoutes.slice(0, 25).map((route) => ({
      message: "Cookie-based authentication appears to be used without an obvious CSRF protection mechanism.",
      file: route.file,
      line: route.line,
      recommendation: "Use SameSite cookies, CSRF tokens or another explicit CSRF mitigation for state-changing routes.",
      heuristic: true,
      metadata: {
        pattern: "cookie-auth-with-state-changing-route",
        cookieFile: primaryCookie.file,
        cookieLine: primaryCookie.line
      }
    }));
  }
};

function normalizePattern(value) {
  return String(value || "").replace(/\s+/g, " ").slice(0, 80);
}
