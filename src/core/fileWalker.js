import fs from "node:fs/promises";
import path from "node:path";
import { isLikelyTextFile } from "../utils/fs.js";
import { matchesAnyGlob, normalizeRelativePath, relativePath } from "../utils/path.js";

export async function walkProject(rootPath, ignorePatterns) {
  const allFiles = [];
  const textFiles = [];

  async function visit(directory) {
    let entries;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      const relPath = relativePath(rootPath, absolutePath);
      if (!relPath || matchesAnyGlob(relPath, ignorePatterns)) continue;

      if (entry.isSymbolicLink()) continue;

      if (entry.isDirectory()) {
        await visit(absolutePath);
        continue;
      }

      if (!entry.isFile()) continue;
      const normalized = normalizeRelativePath(relPath);
      allFiles.push(normalized);
      if (await isLikelyTextFile(absolutePath)) {
        textFiles.push(normalized);
      }
    }
  }

  await visit(rootPath);

  allFiles.sort();
  textFiles.sort();
  return { allFiles, textFiles };
}
