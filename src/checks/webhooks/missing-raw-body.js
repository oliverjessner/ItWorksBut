import { isCodeLikeFile, isEnvExampleFile, isLockfile, lineFromOffset } from "../helpers.js";

const PROVIDER_RE =
  /\b(?:stripe\.webhooks\.constructEvent|github webhook signature|x-hub-signature|svix|clerk|lemon\s*squeezy|lemonsqueezy|polar|paddle|webhook signature)\b/i;
const PARSED_BODY_SIGNATURE_RE = /\b(?:stripe\.webhooks\.)?constructEvent\s*\(\s*req\.body\b/gi;
const RAW_BODY_RE = /\b(?:express\.raw\s*\(|bodyParser\.raw\s*\(|rawBody|req\.rawBody|buffer)\b/i;
const GLOBAL_JSON_RE = /\bapp\.use\s*\(\s*express\.json\s*\(/i;
const WEBHOOK_ROUTE_RE = /\bapp\.(?:post|put|patch)\s*\(\s*["'`][^"'`]*webhook/i;

export default {
  id: "webhooks.missing-raw-body",
  title: "Signed webhooks should verify the exact raw body",
  category: "webhooks",
  severity: "high",
  tags: ["webhooks", "signatures", "heuristic"],
  run: async (context) => {
    const findings = [];

    for (const file of context.textFiles) {
      if (isLockfile(file) || isEnvExampleFile(file) || !isCodeLikeFile(file)) continue;
      const content = await context.readFileSafe(file);
      if (!content || !PROVIDER_RE.test(content)) continue;

      PARSED_BODY_SIGNATURE_RE.lastIndex = 0;
      let match;
      while ((match = PARSED_BODY_SIGNATURE_RE.exec(content)) !== null) {
        const line = lineFromOffset(content, match.index);
        if (RAW_BODY_RE.test(nearbyText(content, line, 12))) continue;
        findings.push(webhookFinding(file, line, "parsed-body-signature-check"));
      }

      const jsonLine = firstLineMatching(content, GLOBAL_JSON_RE);
      const routeLine = firstLineMatching(content, WEBHOOK_ROUTE_RE);
      if (jsonLine && routeLine && jsonLine < routeLine && !RAW_BODY_RE.test(content)) {
        findings.push(webhookFinding(file, jsonLine, "json-parser-before-webhook-route"));
      }
    }

    return dedupe(findings).slice(0, 100);
  }
};

function webhookFinding(file, line, pattern) {
  return {
    message:
      "Webhook signature verification appears to use a parsed request body. Some providers require the exact raw body.",
    file,
    line,
    recommendation:
      "Use a raw body parser for signed webhook routes and register it before JSON parsing middleware.",
    heuristic: true,
    metadata: {
      pattern
    }
  };
}

function firstLineMatching(content, regex) {
  const lines = content.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    regex.lastIndex = 0;
    if (regex.test(lines[index])) return index + 1;
  }
  return null;
}

function nearbyText(content, line, radius) {
  const lines = content.split(/\r?\n/);
  const start = Math.max(0, line - radius - 1);
  const end = Math.min(lines.length, line + radius);
  return lines.slice(start, end).join("\n");
}

function dedupe(findings) {
  const seen = new Set();
  return findings.filter((finding) => {
    const key = `${finding.file}:${finding.line}:${finding.metadata.pattern}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
