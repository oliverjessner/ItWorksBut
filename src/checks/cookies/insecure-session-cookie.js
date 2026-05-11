import { isCodeLikeFile, isEnvExampleFile, isLockfile, readNearby } from "../helpers.js";

const COOKIE_CALL_RE =
  /\b(?:res\.cookie|cookies\(\)\.set|response\.cookies\.set|setCookie|serialize)\s*\(\s*["'`]([^"'`]+)["'`]/g;
const AUTH_COOKIE_NAME_RE = /\b(session|auth|token|jwt)\b/i;

export default {
  id: "cookies.insecure-session-cookie",
  title: "Session cookies should use secure attributes",
  category: "cookies",
  severity: "high",
  tags: ["cookies", "auth", "heuristic"],
  run: async (context) => {
    const findings = [];

    for (const file of context.textFiles) {
      if (isLockfile(file) || isEnvExampleFile(file) || !isCodeLikeFile(file)) continue;
      const content = await context.readFileSafe(file);
      if (!content || !/cookie|setCookie|serialize/i.test(content)) continue;
      const lines = content.split(/\r?\n/);

      for (let index = 0; index < lines.length; index += 1) {
        COOKIE_CALL_RE.lastIndex = 0;
        let match;
        while ((match = COOKIE_CALL_RE.exec(lines[index])) !== null) {
          const cookieName = match[1] || "";
          const nearby = await readNearby(context, file, index + 1, 6);
          if (hasSecureCookieAttributes(nearby)) continue;

          findings.push({
            severity: AUTH_COOKIE_NAME_RE.test(cookieName) ? "high" : "medium",
            message: "A session or auth cookie appears to be set without secure cookie attributes.",
            file,
            line: index + 1,
            recommendation:
              "Set httpOnly, secure and sameSite for session cookies. Use secure: true in production.",
            heuristic: true,
            metadata: {
              cookieName: redactCookieName(cookieName),
              missingAttributes: missingAttributes(nearby)
            }
          });
        }
      }
    }

    return findings.slice(0, 100);
  }
};

function hasSecureCookieAttributes(value) {
  return (
    /\bhttpOnly\s*:\s*true\b/i.test(value) &&
    /\bsecure\s*:\s*true\b/i.test(value) &&
    /\bsameSite\s*:\s*["'`]?(?:lax|strict|none)["'`]?/i.test(value)
  );
}

function missingAttributes(value) {
  const missing = [];
  if (!/\bhttpOnly\s*:\s*true\b/i.test(value)) missing.push("httpOnly");
  if (!/\bsecure\s*:\s*true\b/i.test(value)) missing.push("secure");
  if (!/\bsameSite\s*:\s*["'`]?(?:lax|strict|none)["'`]?/i.test(value)) missing.push("sameSite");
  return missing;
}

function redactCookieName(cookieName) {
  return AUTH_COOKIE_NAME_RE.test(cookieName) ? cookieName : "non-auth-cookie";
}
