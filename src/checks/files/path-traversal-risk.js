import { isCodeLikeFile, isEnvExampleFile, isLockfile, isServerOrApiFile, lineFromOffset, readNearby } from "../helpers.js";

const FILE_PATH_SINK_RE =
  /\b(?:fs\.(?:readFile|readFileSync|writeFile|writeFileSync|createReadStream|createWriteStream)|res\.sendFile|reply\.sendFile|path\.(?:join|resolve)|Bun\.file|Deno\.readTextFile)\s*\(/g;
const REQUEST_PATH_SOURCE_RE =
  /\breq\.(?:query|params|body)\.(?:file|path|filename|filepath|filePath)\b|\brequest\.query\b|\bsearchParams\.get\s*\(\s*["'`](?:file|path)["'`]\s*\)|\bformData\.get\s*\(\s*["'`](?:file|path)["'`]\s*\)/i;
const GENERIC_PATH_SOURCE_RE = /\b(?:userInput|filename|filepath|filePath|pathParam)\b/i;
const PATH_MITIGATION_RE =
  /\b(?:path\.basename|allowlist|allowedPaths|sanitizeFilename|safeJoin|validatePath|rejectPathSeparators)\b|(?:\bnormalize\b[\s\S]{0,160}\bstartsWith\s*\()|(?:\bstartsWith\s*\([\s\S]{0,160}\bbaseDir\b)|(?:\.\.["'`][\s\S]{0,120}(?:includes|reject|throw|return))/i;

export default {
  id: "files.path-traversal-risk",
  title: "File path operations should not trust request input",
  category: "files",
  severity: "critical",
  tags: ["files", "path-traversal", "heuristic"],
  run: async (context) => {
    const findings = [];

    for (const file of context.textFiles) {
      if (isLockfile(file) || isEnvExampleFile(file) || !isCodeLikeFile(file)) continue;
      const content = await context.readFileSafe(file);
      if (!content || !/\b(?:fs\.|sendFile|path\.|Bun\.file|Deno\.readTextFile)\b/.test(content)) continue;

      FILE_PATH_SINK_RE.lastIndex = 0;
      let match;
      while ((match = FILE_PATH_SINK_RE.exec(content)) !== null) {
        const line = lineFromOffset(content, match.index);
        const nearby = await readNearby(context, file, line, 8);
        if (!hasRiskyPathSource(file, nearby)) continue;
        if (PATH_MITIGATION_RE.test(nearby)) continue;

        findings.push({
          message: "User-controlled input appears to be used in a file path operation.",
          file,
          line,
          recommendation:
            "Normalize and validate paths, use allowlists, reject traversal sequences, and ensure resolved paths stay inside an intended base directory.",
          heuristic: true,
          metadata: { pattern: "user-input-file-path" }
        });
      }
    }

    return findings.slice(0, 100);
  }
};

function hasRiskyPathSource(file, nearby) {
  if (REQUEST_PATH_SOURCE_RE.test(nearby)) return true;
  if (!GENERIC_PATH_SOURCE_RE.test(nearby)) return false;
  return (
    isServerOrApiFile(file) ||
    file.startsWith("server/") ||
    file.startsWith("routes/") ||
    file.startsWith("api/") ||
    file.includes("/server/") ||
    file.includes("/routes/") ||
    file.includes("/controllers/") ||
    file.includes("/handlers/")
  );
}
