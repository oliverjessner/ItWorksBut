import fs from "node:fs/promises";
import path from "node:path";
import { isCodeLikeFile, isEnvExampleFile, isLockfile, lineFromOffset } from "../helpers.js";
import { normalizeRelativePath } from "../../utils/path.js";

const SOURCEMAP_CONFIG_RE =
  /\b(?:sourcemap|productionBrowserSourceMaps)\s*:\s*true\b|\bGENERATE_SOURCEMAP\s*=\s*true\b|\bdevtool\s*:\s*["'`](?:source-map|inline-source-map|eval-source-map)["'`]/gi;
const SOURCEMAP_DIRS = ["dist", "build", ".next", "out"];
const MAX_SOURCEMAP_FILES = 100;

export default {
  id: "frontend.sourcemaps-production",
  title: "Production source maps should not be served publicly by accident",
  category: "frontend",
  severity: "medium",
  tags: ["frontend", "sourcemaps", "heuristic"],
  run: async (context) => {
    const findings = [];

    for (const file of context.textFiles) {
      if (isLockfile(file) || isEnvExampleFile(file) || !isCodeLikeFile(file)) continue;
      const content = await context.readFileSafe(file);
      if (!content) continue;

      SOURCEMAP_CONFIG_RE.lastIndex = 0;
      let match;
      while ((match = SOURCEMAP_CONFIG_RE.exec(content)) !== null) {
        findings.push(sourceMapFinding(file, lineFromOffset(content, match.index), "sourcemap-config-enabled"));
      }
    }

    const mapFiles = await collectGeneratedSourceMaps(context.rootPath);
    for (const file of mapFiles) {
      findings.push(sourceMapFinding(file, undefined, "generated-map-file"));
    }

    return findings.slice(0, 100);
  }
};

function sourceMapFinding(file, line, pattern) {
  return {
    message: "Production source maps appear to be enabled or generated.",
    file,
    line,
    recommendation:
      "Disable public production source maps unless intentionally needed. If needed, upload them privately to error tracking instead of serving them publicly.",
    heuristic: true,
    metadata: {
      pattern
    }
  };
}

async function collectGeneratedSourceMaps(rootPath) {
  const results = [];

  for (const directory of SOURCEMAP_DIRS) {
    await visit(path.join(rootPath, directory), rootPath, results);
    if (results.length >= MAX_SOURCEMAP_FILES) break;
  }

  return results.slice(0, MAX_SOURCEMAP_FILES);
}

async function visit(directory, rootPath, results) {
  if (results.length >= MAX_SOURCEMAP_FILES) return;

  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (results.length >= MAX_SOURCEMAP_FILES) return;
    if (entry.name === "node_modules") continue;

    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await visit(absolutePath, rootPath, results);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".map")) {
      results.push(normalizeRelativePath(path.relative(rootPath, absolutePath)));
    }
  }
}
