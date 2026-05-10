import path from "node:path";
import { loadConfig } from "./config.js";
import { walkProject } from "./fileWalker.js";
import { checkIgnored, collectGitInfo } from "./git.js";
import { fileExists as fileExistsAbsolute, readFileSafe as readFileSafeAbsolute, resolveInside } from "../utils/fs.js";
import { detectPackageManager, hasDependency as packageHasDependency, hasDevDependency as packageHasDevDependency, readPackageJson } from "../utils/packageJson.js";
import { matchesGlob, normalizeRelativePath } from "../utils/path.js";
import { maskSecret } from "../utils/mask.js";

export async function createContext(options = {}) {
  const rootPath = path.resolve(options.rootPath || ".");
  const config = await loadConfig(rootPath, options.configPath, { failOn: options.failOn });
  const { allFiles, textFiles } = await walkProject(rootPath, config.ignore);
  const packageJson = await readPackageJson(rootPath);
  const gitInfo = await collectGitInfo(rootPath);
  const ignoredTrackedByCheckIgnore = gitInfo.available ? await checkIgnored(rootPath, gitInfo.trackedFiles) : [];

  const context = {
    rootPath,
    packageJson,
    packageManager: detectPackageManager(packageJson, allFiles),
    allFiles,
    textFiles,
    gitTrackedFiles: gitInfo.trackedFiles,
    gitIgnoredFiles: gitInfo.ignoredFiles,
    gitIgnoredTrackedFiles: unique([...gitInfo.ignoredTrackedFiles, ...ignoredTrackedByCheckIgnore]),
    gitStatusShort: gitInfo.statusShort,
    gitAvailable: gitInfo.available,
    config,
    maskSecret,
    readFileSafe: async (relativePath) => await readFileSafeAbsolute(resolveInside(rootPath, relativePath)),
    fileExists: async (relativePath) => await fileExistsAbsolute(resolveInside(rootPath, relativePath)),
    hasDependency: (name) => packageHasDependency(packageJson, name),
    hasDevDependency: (name) => packageHasDevDependency(packageJson, name),
    findFiles: (pattern) => allFiles.filter((file) => matchesGlob(file, pattern)),
    grep: async (pattern, grepOptions = {}) => grep(context, pattern, grepOptions)
  };

  return context;
}

async function grep(context, pattern, options) {
  const results = [];
  const regex = pattern instanceof RegExp ? ensureGlobal(pattern) : new RegExp(escapeRegExp(String(pattern)), "g");
  const include = options.include || ["**"];
  const exclude = options.exclude || [];
  const maxMatches = options.maxMatches || 500;

  for (const file of context.textFiles) {
    if (!include.some((glob) => glob === "**" || matchesGlob(file, glob))) continue;
    if (exclude.some((glob) => matchesGlob(file, glob))) continue;

    const content = await context.readFileSafe(file);
    if (!content) continue;
    const lines = content.split(/\r?\n/);

    for (let index = 0; index < lines.length; index += 1) {
      regex.lastIndex = 0;
      let match;
      while ((match = regex.exec(lines[index])) !== null) {
        results.push({
          file: normalizeRelativePath(file),
          line: index + 1,
          column: match.index + 1,
          match,
          text: lines[index]
        });
        if (results.length >= maxMatches) return results;
        if (match.index === regex.lastIndex) regex.lastIndex += 1;
      }
    }
  }

  return results;
}

function ensureGlobal(regex) {
  return regex.global ? regex : new RegExp(regex.source, `${regex.flags}g`);
}

function escapeRegExp(value) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function unique(values) {
  return [...new Set(values)];
}
