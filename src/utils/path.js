import path from "node:path";

export function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

export function normalizeRelativePath(value) {
  return toPosixPath(value).replace(/^\.\//, "").replace(/^\/+/, "");
}

export function relativePath(rootPath, absolutePath) {
  return normalizeRelativePath(path.relative(rootPath, absolutePath));
}

export function basename(value) {
  const normalized = normalizeRelativePath(value);
  const parts = normalized.split("/");
  return parts[parts.length - 1] || normalized;
}

export function hasGlobMagic(pattern) {
  return /[*?[\]{}]/.test(pattern);
}

export function matchesGlob(filePath, pattern) {
  const normalizedPath = normalizeRelativePath(filePath);
  const normalizedPattern = normalizeRelativePath(pattern).replace(/^\//, "");

  if (!normalizedPattern) return false;

  if (normalizedPattern.endsWith("/**")) {
    const base = normalizedPattern.slice(0, -3).replace(/\/$/, "");
    return normalizedPath === base || normalizedPath.startsWith(`${base}/`);
  }

  if (normalizedPattern.endsWith("/")) {
    const base = normalizedPattern.slice(0, -1);
    return normalizedPath === base || normalizedPath.startsWith(`${base}/`);
  }

  const target = normalizedPattern.includes("/") ? normalizedPath : basename(normalizedPath);
  return globToRegExp(normalizedPattern.includes("/") ? normalizedPattern : normalizedPattern).test(target);
}

export function matchesAnyGlob(filePath, patterns = []) {
  return patterns.some((pattern) => matchesGlob(filePath, pattern));
}

function globToRegExp(pattern) {
  let source = "";
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    const next = pattern[index + 1];

    if (char === "*" && next === "*") {
      source += ".*";
      index += 1;
    } else if (char === "*") {
      source += "[^/]*";
    } else if (char === "?") {
      source += "[^/]";
    } else {
      source += escapeRegExp(char);
    }
  }
  return new RegExp(`^${source}$`);
}

function escapeRegExp(value) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}
