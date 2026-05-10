import { hasAuthKeyword, isFrontendFile, isServerOrApiFile } from "../helpers.js";

const CLIENT_AUTH_RE = /\b(role\s*={2,3}\s*["']admin["']|isAdmin|user\.role|roles\.includes|hasRole)\b/i;

export default {
  id: "web.client-side-auth-only",
  title: "Authorization should not appear to exist only in frontend code",
  category: "web",
  severity: "medium",
  tags: ["web", "auth", "heuristic"],
  run: async (context) => {
    const clientMatches = [];
    let serverAuthDetected = false;

    for (const file of context.textFiles) {
      const content = await context.readFileSafe(file);
      if (!content) continue;

      if (isFrontendFile(file) && CLIENT_AUTH_RE.test(content)) {
        clientMatches.push(file);
      }

      if (isServerOrApiFile(file) && (CLIENT_AUTH_RE.test(content) || hasAuthKeyword(content))) {
        serverAuthDetected = true;
      }
    }

    if (clientMatches.length === 0 || serverAuthDetected) return [];

    return [
      {
        message: "Possible role or admin checks appear in frontend files, but matching server/API authorization checks were not detected.",
        file: clientMatches[0],
        recommendation: "Enforce authorization on the server/API side. Treat frontend checks as UI hints only.",
        heuristic: true,
        metadata: { frontendFiles: clientMatches.slice(0, 10) }
      }
    ];
  }
};
