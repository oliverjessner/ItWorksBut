import { isCodeLikeFile, isEnvExampleFile, isLockfile, lineFromOffset } from "../helpers.js";

const PUBLIC_UPLOAD_PATH_RE = /(?:public|static|dist|build|\.next\/static)\/(?:uploads|files)/i;
const PUBLIC_UPLOAD_PATTERNS = [
  /multer\s*\(\s*{[\s\S]{0,500}?dest\s*:\s*["'`](?:public|static|dist|build|\.next\/static)\/(?:uploads|files)["'`]/gi,
  /\b(?:uploadDir|uploadsDir|destination)\b\s*=\s*["'`](?:public|static|dist|build|\.next\/static)\/(?:uploads|files)["'`]/gi,
  /path\.join\s*\([^)]*["'`](?:public|static|dist|build)["'`]\s*,\s*["'`](?:uploads|files)["'`]/gi,
  /fs\.writeFile\s*\(\s*["'`](?:public|static|dist|build|\.next\/static)\/(?:uploads|files)\//gi,
  /app\.use\s*\(\s*["'`]\/(?:uploads|files)["'`]\s*,\s*express\.static\s*\(/gi,
  /express\.static\s*\(\s*["'`](?:public|static)["'`]\s*\)/gi
];
const VALIDATION_RE = /\b(?:fileFilter|limits\s*:\s*{[\s\S]{0,120}?fileSize|limits\.fileSize|mimetype|allowedTypes|allowedMimeTypes)\b/i;

export default {
  id: "uploads.public-executable-upload",
  title: "Uploads should not be stored directly in public web roots",
  category: "uploads",
  severity: "high",
  tags: ["uploads", "static-files", "heuristic"],
  run: async (context) => {
    const findings = [];

    for (const file of context.textFiles) {
      if (isLockfile(file) || isEnvExampleFile(file) || !isCodeLikeFile(file)) continue;
      const content = await context.readFileSafe(file);
      if (!content || !/(upload|multer|express\.static|writeFile|public\/|static\/)/i.test(content)) continue;

      for (const regex of PUBLIC_UPLOAD_PATTERNS) {
        regex.lastIndex = 0;
        let match;
        while ((match = regex.exec(content)) !== null) {
          if (!PUBLIC_UPLOAD_PATH_RE.test(match[0]) && !/\/(?:uploads|files)/i.test(match[0])) continue;
          const line = lineFromOffset(content, match.index);
          const validationMissing = !VALIDATION_RE.test(nearbyText(content, line, 12));

          findings.push({
            message:
              "Uploaded files appear to be stored in a public directory, possibly without strict file type and size validation.",
            file,
            line,
            recommendation:
              "Store uploads outside the public web root, validate MIME type and extension, enforce file size limits, and serve files through controlled routes.",
            heuristic: true,
            metadata: {
              validationMissing
            }
          });
          break;
        }
        if (findings.some((finding) => finding.file === file)) break;
      }
    }

    return findings.slice(0, 100);
  }
};

function nearbyText(content, line, radius) {
  const lines = content.split(/\r?\n/);
  const start = Math.max(0, line - radius - 1);
  const end = Math.min(lines.length, line + radius);
  return lines.slice(start, end).join("\n");
}
